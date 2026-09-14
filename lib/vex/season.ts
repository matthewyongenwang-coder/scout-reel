import { type ApiMatch, matchesForTeam, type TeamMatch } from "./matches";

/**
 * A team's season, split into events it has played (with its matches) and
 * events it is registered for but has not played yet.
 */

export type SeasonEvent = {
  id: number;
  sku: string;
  name: string;
  start: string | null;
  end: string | null;
  level: string | null;
};

/** Matches from /teams/{id}/matches carry the event they were played at. */
export type SeasonMatch = ApiMatch & { event?: { id: number; name?: string; code?: string | null } | null };

export type PlayedEvent = { event: SeasonEvent; matches: TeamMatch[] };

const day = (iso: string | null | undefined) => iso?.slice(0, 10) ?? "";

/** Not canceled, and its last day is today or later (`today` is YYYY-MM-DD). Includes events already underway. */
export function isCurrentOrUpcoming(
  event: { name: string; start: string | null; end: string | null },
  today: string,
): boolean {
  if (event.name.toUpperCase().startsWith("CANCELED")) return false;
  const lastDay = day(event.end ?? event.start);
  return lastDay !== "" && lastDay >= today;
}

/** Today falls between the event's first and last day. */
export function isOngoing(event: { start: string | null; end: string | null }, today: string): boolean {
  const first = day(event.start);
  const last = day(event.end ?? event.start);
  return first !== "" && first <= today && today <= last;
}

export function groupSeason(
  events: SeasonEvent[],
  matches: SeasonMatch[],
  teamId: number,
  today: string,
): { played: PlayedEvent[]; upcoming: SeasonEvent[] } {
  const byEvent = new Map<number, SeasonMatch[]>();
  for (const match of matches) {
    const id = match.event?.id;
    if (id === undefined) continue;
    const list = byEvent.get(id) ?? [];
    list.push(match);
    byEvent.set(id, list);
  }

  const played: PlayedEvent[] = [];
  const upcoming: SeasonEvent[] = [];
  for (const event of events) {
    const teamMatches = matchesForTeam(byEvent.get(event.id) ?? [], teamId);
    if (teamMatches.length > 0) {
      played.push({ event, matches: teamMatches });
    } else if (day(event.end ?? event.start) >= today) {
      upcoming.push(event);
    } else {
      // Finished, but no match results were published for this team.
      played.push({ event, matches: [] });
    }
  }

  // The two API endpoints can disagree: keep matches whose event is missing from the team's event list.
  const known = new Set(events.map((e) => e.id));
  for (const [id, list] of byEvent) {
    if (known.has(id)) continue;
    const teamMatches = matchesForTeam(list, teamId);
    if (teamMatches.length === 0) continue;
    const info = list[0].event;
    const times = teamMatches
      .map((m) => m.started ?? m.scheduled)
      .filter((t): t is string => Boolean(t))
      .sort();
    played.push({
      event: {
        id,
        sku: info?.code ?? `event-${id}`,
        name: info?.name ?? "Unlisted event",
        start: times[0] ?? null,
        end: times.at(-1) ?? null,
        level: null,
      },
      matches: teamMatches,
    });
  }

  played.sort((a, b) => day(b.event.start).localeCompare(day(a.event.start)));
  upcoming.sort((a, b) => day(a.start).localeCompare(day(b.start)));
  return { played, upcoming };
}

export type SeasonRecord = { events: number; matches: number; wins: number; losses: number; ties: number };

export function seasonRecord(played: PlayedEvent[]): SeasonRecord {
  const record: SeasonRecord = { events: 0, matches: 0, wins: 0, losses: 0, ties: 0 };
  for (const { matches } of played) {
    if (matches.length > 0) record.events++;
    for (const m of matches) {
      record.matches++;
      if (m.result === "win") record.wins++;
      else if (m.result === "loss") record.losses++;
      else if (m.result === "tie") record.ties++;
    }
  }
  return record;
}
