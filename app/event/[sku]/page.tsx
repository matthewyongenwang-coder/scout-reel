import Link from "next/link";
import { Suspense } from "react";
import { Problem } from "@/components/Problem";
import { TeamList } from "@/components/TeamList";
import { accountsEnabled } from "@/lib/env";
import { getScoutedTeamIds } from "@/lib/scouting/data";
import { getWorkspaceContext } from "@/lib/workspaces/data";
import { formatEventDates, formatLocation } from "@/lib/format";
import { type EventSummary, getEventBySku, getEventTeams, type TeamSummary } from "@/lib/vex/api";
import { parseEventInput } from "@/lib/vex/parse";

export default function EventPage({ params }: PageProps<"/event/[sku]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading event</p>}>
      <EventContent params={params} />
    </Suspense>
  );
}

type Loaded =
  | { kind: "ok"; event: EventSummary; teams: TeamSummary[] }
  | { kind: "problem"; title: string; detail: string };

async function loadEvent(raw: string): Promise<Loaded> {
  const parsed = parseEventInput(raw);
  if (!parsed.ok) return { kind: "problem", title: "Not a valid event", detail: parsed.error };
  try {
    const event = await getEventBySku(parsed.sku);
    if (!event) {
      return {
        kind: "problem",
        title: "Event not found",
        detail: `No event with SKU ${parsed.sku} exists on events.vex.com.`,
      };
    }
    const teams = await getEventTeams(event.id, event.start, event.end);
    return { kind: "ok", event, teams };
  } catch {
    return {
      kind: "problem",
      title: "Could not reach the VEX Events API",
      detail: "The API may be busy. Try again in a minute.",
    };
  }
}

async function EventContent({ params }: { params: PageProps<"/event/[sku]">["params"] }) {
  const { sku } = await params;
  const loaded = await loadEvent(decodeURIComponent(sku));
  if (loaded.kind === "problem") {
    return (
      <Problem
        title={loaded.title}
        detail={loaded.detail}
        action={
          <Link href="/" className="text-sm text-accent hover:underline">
            Back to event search
          </Link>
        }
      />
    );
  }

  const { event, teams } = loaded;
  const location = formatLocation([event.city, event.region, event.country]);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">
          {event.sku}
          {event.level && event.level !== "Other" ? `, ${event.level} event` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
        <p className="text-sm text-muted">
          {formatEventDates(event.start, event.end)}
          {location ? `, ${location}` : ""}
        </p>
        <a
          href={`https://events.vex.com/robot-competitions/vex-robotics-competition/${event.sku}.html`}
          className="text-sm text-accent hover:underline"
        >
          View on events.vex.com
        </a>
      </div>
      {/* Not awaited: the team list shows at once and Scouted markers stream in once the session is read. */}
      <TeamList eventSku={event.sku} teams={teams} scouted={accountsEnabled() ? scoutedTeamIds(event.seasonId) : undefined} />
    </div>
  );
}

/** Teams the viewer's active workspace has scouted this season. Empty when signed out or on any error. */
async function scoutedTeamIds(seasonId: number): Promise<number[]> {
  try {
    const context = await getWorkspaceContext();
    return context?.active ? await getScoutedTeamIds(context.active.workspaceId, seasonId) : [];
  } catch {
    return [];
  }
}
