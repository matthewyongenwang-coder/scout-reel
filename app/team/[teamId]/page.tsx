import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Problem } from "@/components/Problem";
import { type ClipsResult, type MatchClip, type ScoutEvent, TeamScout } from "@/components/TeamScout";
import { getMatchTiming, PROGRAM_V5RC } from "@/config/seasons";
import { findClip } from "@/lib/footage/clip-index";
import { getRobotStatsClipIndex } from "@/lib/footage/clips-server";
import { formatEventDates, formatLocation } from "@/lib/format";
import {
  type EventSummary,
  getCurrentSeasonId,
  getEventBySku,
  getTeam,
  getTeamSeasonEvents,
  getTeamSeasonMatches,
  type TeamSummary,
} from "@/lib/vex/api";
import { parseEventInput } from "@/lib/vex/parse";
import { groupSeason, isOngoing, type PlayedEvent, type SeasonEvent, seasonRecord } from "@/lib/vex/season";

export default function TeamPage({ params, searchParams }: PageProps<"/team/[teamId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading this team&apos;s season</p>}>
      <TeamContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Loaded =
  | {
      kind: "ok";
      team: TeamSummary;
      focus: EventSummary | null;
      played: PlayedEvent[];
      upcoming: SeasonEvent[];
      programId: number;
      seasonId: number;
    }
  | { kind: "problem"; title: string; detail: string };

const problem = (title: string, detail: string): Loaded => ({ kind: "problem", title, detail });

async function loadTeam(teamIdRaw: string, eventRaw: string | undefined): Promise<Loaded> {
  const teamId = Number(teamIdRaw);
  if (!Number.isInteger(teamId) || teamId <= 0) return problem("Team not found", "That team link is not valid.");

  let focusSku: string | null = null;
  if (eventRaw) {
    const parsed = parseEventInput(eventRaw);
    if (!parsed.ok) return problem("Event not found", parsed.error);
    focusSku = parsed.sku;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [team, focus] = await Promise.all([getTeam(teamId), focusSku ? getEventBySku(focusSku) : null]);
    if (!team) return problem("Team not found", "No team with that id exists on events.vex.com.");
    if (focusSku && !focus) return problem("Event not found", `No event with SKU ${focusSku} exists on events.vex.com.`);

    const seasonId = focus?.seasonId ?? (await getCurrentSeasonId(PROGRAM_V5RC, today));
    if (!seasonId) return problem("No season found", "The current VEX V5 season could not be found.");

    const events = await getTeamSeasonEvents(team.id, seasonId);
    const live = events.some((e) => isOngoing(e, today));
    const matches = await getTeamSeasonMatches(team.id, seasonId, live);
    const { played, upcoming } = groupSeason(events, matches, team.id, today);
    const programId = focus?.programId ?? events[0]?.programId ?? PROGRAM_V5RC;
    return { kind: "ok", team, focus, played, upcoming, programId, seasonId };
  } catch {
    return problem("Could not reach the VEX Events API", "The API may be busy. Try again in a minute.");
  }
}

async function findClips(teamNumber: string, played: PlayedEvent[]): Promise<ClipsResult> {
  try {
    const result = await getRobotStatsClipIndex();
    if (!result.ok) return { status: "unavailable", clips: {} };
    const clips: Record<number, MatchClip> = {};
    for (const { event, matches } of played) {
      for (const m of matches) {
        const own = [teamNumber, ...m.partners];
        const isRed = m.color === "red";
        const clip = findClip(result.index, event.id, {
          name: m.name,
          red: isRed ? own : m.opponents,
          blue: isRed ? m.opponents : own,
          redScore: isRed ? m.score : m.opponentScore,
          blueScore: isRed ? m.opponentScore : m.score,
          eventStart: event.start,
        });
        if (clip) clips[m.id] = { videoId: clip.videoId, autonStartS: clip.autonStartS, driverStartS: clip.driverStartS };
      }
    }
    return { status: "ready", clips };
  } catch {
    return { status: "unavailable", clips: {} };
  }
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function recordText(played: PlayedEvent[]): string {
  const r = seasonRecord(played);
  if (r.matches === 0) return "No matches played yet this season.";
  return `This season: ${[
    count(r.events, "event", "events"),
    count(r.matches, "match", "matches"),
    count(r.wins, "win", "wins"),
    count(r.losses, "loss", "losses"),
    count(r.ties, "tie", "ties"),
  ].join(", ")}.`;
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
  await connection();
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

  const { team, focus, played, upcoming, programId, seasonId } = loaded;
  const events: ScoutEvent[] = played.map(({ event, matches }) => ({
    sku: event.sku,
    name: event.name,
    start: event.start,
    end: event.end,
    matches,
  }));
  // Not awaited: the match list shows at once and clips stream in when the index is ready.
  const clipsPromise = findClips(team.number, played);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={focus ? `/event/${focus.sku}` : "/"} className="text-sm text-muted hover:text-foreground">
          {focus ? `Back to ${focus.name}` : "Back to event search"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {team.number}
          {team.name ? <span className="font-normal text-muted">{` ${team.name}`}</span> : null}
        </h1>
        <p className="text-sm text-muted">{formatLocation([team.organization, team.city, team.region, team.country])}</p>
        {focus ? <p className="text-sm">{`Scouting for ${focus.name}, ${formatEventDates(focus.start, focus.end)}`}</p> : null}
        <p className="text-sm text-muted">{recordText(played)}</p>
      </div>

      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-heading" className="flex flex-col gap-2">
          <h2 id="upcoming-heading" className="text-sm font-medium">
            Registered for
          </h2>
          <ul className="flex flex-wrap gap-2">
            {upcoming.map((e) => (
              <li key={e.sku}>
                <Link
                  href={`/event/${e.sku}`}
                  className={`block rounded-md border px-3 py-1.5 text-sm hover:border-accent ${e.sku === focus?.sku ? "border-accent" : "border-line"}`}
                >
                  {`${e.name}, ${formatEventDates(e.start, e.end)}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TeamScout
        // Remount when the team or the event being scouted for changes, so no livestream or selection carries over.
        key={`${team.id}:${focus?.sku ?? "season"}`}
        events={events}
        timing={getMatchTiming(programId, seasonId)}
        focusSku={focus?.sku ?? null}
        clipsPromise={clipsPromise}
      />
    </div>
  );
}
