import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { vex } from "./client";
import type { ApiMatch } from "./matches";
import { eventCacheSeconds } from "./ttl";

/**
 * Cached reads from the VEX Events API. Results live in the shared remote cache,
 * so a cache hit never waits in the rate-limit queue.
 */

export class VexApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "VexApiError";
  }
}

export type EventSummary = {
  id: number;
  sku: string;
  name: string;
  start: string | null;
  end: string | null;
  level: string | null;
  seasonId: number;
  programId: number;
  city: string | null;
  region: string | null;
  country: string | null;
  divisions: { id: number; name: string }[];
};

export type TeamSummary = {
  id: number;
  number: string;
  name: string;
  organization: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

// The client types the error branch as `never`, so read the status through a plain parameter.
const statusOf = (res: { response?: Response }) => res.response?.status ?? 0;

const lifetime = (seconds: number) => ({
  stale: Math.min(300, seconds),
  revalidate: seconds,
  expire: seconds * 4,
});

type RawEvent = {
  id: number;
  sku: string;
  name: string;
  start?: string;
  end?: string;
  level?: string;
  season: { id: number };
  program: { id: number };
  location?: { city?: string | null; region?: string | null; country?: string | null };
  divisions?: { id?: number; name?: string }[];
};

function toEventSummary(e: RawEvent): EventSummary {
  return {
    id: e.id,
    sku: e.sku,
    name: e.name,
    start: e.start ?? null,
    end: e.end ?? null,
    level: e.level ?? null,
    seasonId: e.season.id,
    programId: e.program.id,
    city: e.location?.city ?? null,
    region: e.location?.region ?? null,
    country: e.location?.country ?? null,
    divisions: (e.divisions ?? []).flatMap((d) =>
      d.id !== undefined ? [{ id: d.id, name: d.name ?? `Division ${d.id}` }] : [],
    ),
  };
}

type RawTeam = {
  id: number;
  number: string;
  team_name?: string | null;
  organization?: string | null;
  location?: { city?: string | null; region?: string | null; country?: string | null };
};

function toTeamSummary(t: RawTeam): TeamSummary {
  return {
    id: t.id,
    number: t.number,
    name: t.team_name ?? "",
    organization: t.organization ?? null,
    city: t.location?.city ?? null,
    region: t.location?.region ?? null,
    country: t.location?.country ?? null,
  };
}

export async function getEventBySku(sku: string): Promise<EventSummary | null> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(`event:${sku}`);
  const res = await vex().api.GET("/events", { params: { query: { "sku[]": [sku] } } });
  if (res.error) throw new VexApiError(statusOf(res), "Could not load the event.");
  const event = res.data.data?.[0];
  return event ? toEventSummary(event as RawEvent) : null;
}

export async function getEventTeams(
  eventId: number,
  start: string | null,
  end: string | null,
): Promise<TeamSummary[]> {
  "use cache: remote";
  cacheLife(lifetime(eventCacheSeconds({ start, end })));
  cacheTag(`event-teams:${eventId}`);
  const res = await vex().api.PaginatedGET("/events/{id}/teams", { params: { path: { id: eventId } } });
  if (res.error) throw new VexApiError(statusOf(res), "Could not load the teams for this event.");
  return (res.data as RawTeam[])
    .map(toTeamSummary)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export async function getDivisionMatches(
  eventId: number,
  divisionId: number,
  start: string | null,
  end: string | null,
): Promise<ApiMatch[]> {
  "use cache: remote";
  cacheLife(lifetime(eventCacheSeconds({ start, end })));
  cacheTag(`event-matches:${eventId}:${divisionId}`);
  const res = await vex().api.PaginatedGET("/events/{id}/divisions/{div}/matches", {
    params: { path: { id: eventId, div: divisionId } },
  });
  if (res.error) throw new VexApiError(statusOf(res), "Could not load matches for this event.");
  return res.data as unknown as ApiMatch[];
}

export async function getTeam(teamId: number): Promise<TeamSummary | null> {
  "use cache: remote";
  cacheLife("days");
  cacheTag(`team:${teamId}`);
  const res = await vex().api.GET("/teams/{id}", { params: { path: { id: teamId } } });
  if (res.response.status === 404) return null;
  if (res.error) throw new VexApiError(statusOf(res), "Could not load the team.");
  return toTeamSummary(res.data as RawTeam);
}

/** Current season for a program: the newest season that has already started. */
export async function getCurrentSeasonId(programId: number, today: string): Promise<number | null> {
  "use cache: remote";
  cacheLife("days");
  const res = await vex().api.GET("/seasons", { params: { query: { "program[]": [programId] } } });
  if (res.error) throw new VexApiError(statusOf(res), "Could not load seasons.");
  const seasons = (res.data.data ?? []) as { id: number; start?: string }[];
  const started = seasons
    .filter((s) => s.start && s.start.slice(0, 10) <= today)
    .sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
  return started[0]?.id ?? null;
}

/** Events in a season starting on or after `today` (YYYY-MM-DD), soonest first. */
export async function getUpcomingEvents(seasonId: number, today: string): Promise<EventSummary[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(`upcoming:${seasonId}`);
  const res = await vex().api.PaginatedGET("/events", {
    params: { query: { "season[]": [seasonId], start: `${today}T00:00:00Z` } },
  });
  if (res.error) throw new VexApiError(statusOf(res), "Could not load upcoming events.");
  return (res.data as RawEvent[])
    .map(toEventSummary)
    .filter((e) => !e.name.startsWith("CANCELED"))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
}
