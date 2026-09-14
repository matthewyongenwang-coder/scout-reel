import Link from "next/link";
import { Suspense } from "react";
import { Problem } from "@/components/Problem";
import { type ScoutMatch, TeamScout } from "@/components/TeamScout";
import { getMatchTiming } from "@/config/seasons";
import { formatLocation } from "@/lib/format";
import { type EventSummary, getDivisionMatches, getEventBySku, getTeam, type TeamSummary } from "@/lib/vex/api";
import { matchesForTeam, nextStartOnField } from "@/lib/vex/matches";
import { parseEventInput } from "@/lib/vex/parse";

export default function TeamPage({ params, searchParams }: PageProps<"/team/[teamId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading team</p>}>
      <TeamContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Loaded =
  | { kind: "ok"; team: TeamSummary; event: EventSummary; matches: ScoutMatch[] }
  | { kind: "problem"; title: string; detail: string };

const problem = (title: string, detail: string): Loaded => ({ kind: "problem", title, detail });

const playTime = (m: ScoutMatch) => {
  const ms = Date.parse(m.started ?? m.scheduled ?? "");
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
};

async function loadTeam(teamIdRaw: string, eventRaw: string | undefined): Promise<Loaded> {
  const teamId = Number(teamIdRaw);
  if (!Number.isInteger(teamId) || teamId <= 0) return problem("Team not found", "That team link is not valid.");
  if (!eventRaw) {
    return problem("Pick an event first", "Open this team from an event page. Scouting across a whole season is coming next.");
  }
  const parsed = parseEventInput(eventRaw);
  if (!parsed.ok) return problem("Event not found", parsed.error);

  try {
    const [team, event] = await Promise.all([getTeam(teamId), getEventBySku(parsed.sku)]);
    if (!team) return problem("Team not found", "No team with that id exists on events.vex.com.");
    if (!event) return problem("Event not found", `No event with SKU ${parsed.sku} exists on events.vex.com.`);

    const matches: ScoutMatch[] = [];
    for (const division of event.divisions) {
      const all = await getDivisionMatches(event.id, division.id, event.start, event.end);
      for (const m of matchesForTeam(all, team.id)) {
        matches.push({ ...m, nextStart: nextStartOnField(all, m.id) });
      }
    }
    matches.sort((a, b) => playTime(a) - playTime(b));
    return { kind: "ok", team, event, matches };
  } catch {
    return problem("Could not reach the VEX Events API", "The API may be busy. Try again in a minute.");
  }
}

async function TeamContent({
  params,
  searchParams,
}: {
  params: PageProps<"/team/[teamId]">["params"];
  searchParams: PageProps<"/team/[teamId]">["searchParams"];
}) {
  const { teamId } = await params;
  const { event: eventParam } = await searchParams;
  const loaded = await loadTeam(teamId, typeof eventParam === "string" ? eventParam : undefined);

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

  const { team, event, matches } = loaded;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/event/${event.sku}`} className="text-sm text-muted hover:text-foreground">
          Back to {event.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {team.number}
          {team.name ? <span className="font-normal text-muted">{` ${team.name}`}</span> : null}
        </h1>
        <p className="text-sm text-muted">{formatLocation([team.organization, team.city, team.region, team.country])}</p>
      </div>
      {/* Keyed by event so moving between events never reuses another event's video or sync. */}
      <TeamScout
        key={event.sku}
        eventSku={event.sku}
        matches={matches}
        timing={getMatchTiming(event.programId, event.seasonId)}
      />
    </div>
  );
}
