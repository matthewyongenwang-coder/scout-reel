/**
 * Shapes raw VEX match objects into what the team page shows. The input type
 * is a minimal structural subset of the API's MatchObj so these helpers stay
 * easy to test with recorded fixtures.
 */

export type ApiMatch = {
  id: number;
  name: string;
  field?: string | null;
  scheduled?: string | null;
  started?: string | null;
  scored?: boolean;
  round?: number;
  instance?: number;
  matchnum?: number;
  alliances?: {
    color: string;
    score?: number | null;
    teams?: { team?: { id: number; name: string } | null; sitting?: boolean }[];
  }[];
};

export type TeamMatch = {
  id: number;
  name: string;
  field: string | null;
  started: string | null;
  scheduled: string | null;
  color: "red" | "blue";
  partners: string[];
  opponents: string[];
  score: number | null;
  opponentScore: number | null;
  result: "win" | "loss" | "tie" | "unplayed";
};

function timeOf(match: ApiMatch): number {
  const iso = match.started ?? match.scheduled;
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function byPlayOrder(a: ApiMatch, b: ApiMatch): number {
  const ta = timeOf(a);
  const tb = timeOf(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return (
    (a.round ?? 0) - (b.round ?? 0) ||
    (a.instance ?? 0) - (b.instance ?? 0) ||
    (a.matchnum ?? 0) - (b.matchnum ?? 0)
  );
}

type Alliance = NonNullable<ApiMatch["alliances"]>[number];

const teamsOf = (alliance: Alliance | undefined) =>
  (alliance?.teams ?? []).flatMap((t) => (t.team ? [t.team] : []));

export function matchesForTeam(matches: ApiMatch[], teamId: number): TeamMatch[] {
  const result: TeamMatch[] = [];
  for (const match of [...matches].sort(byPlayOrder)) {
    const own = match.alliances?.find((a) => teamsOf(a).some((t) => t.id === teamId));
    if (!own) continue;
    const other = match.alliances?.find((a) => a !== own);
    const score = own.score ?? null;
    const opponentScore = other?.score ?? null;
    let outcome: TeamMatch["result"] = "unplayed";
    // The API's `scored` flag stays false even for finished matches, so a match
    // counts as played once it has a start time or any non-zero score.
    const played = Boolean(match.started) || (score ?? 0) > 0 || (opponentScore ?? 0) > 0;
    if (played && score !== null && opponentScore !== null) {
      outcome = score > opponentScore ? "win" : score < opponentScore ? "loss" : "tie";
    }
    result.push({
      id: match.id,
      name: match.name,
      field: match.field ?? null,
      started: match.started ?? null,
      scheduled: match.scheduled ?? null,
      color: own.color === "red" ? "red" : "blue",
      partners: teamsOf(own).filter((t) => t.id !== teamId).map((t) => t.name),
      opponents: teamsOf(other).map((t) => t.name),
      score,
      opponentScore,
      result: outcome,
    });
  }
  return result;
}

/** Start time of the next match on the same field, used to end a driver clip. */
export function nextStartOnField(matches: ApiMatch[], matchId: number): string | null {
  const current = matches.find((m) => m.id === matchId);
  if (!current?.started || !current.field) return null;
  const currentMs = Date.parse(current.started);
  let best: { ms: number; iso: string } | null = null;
  for (const m of matches) {
    if (m.id === matchId || m.field !== current.field || !m.started) continue;
    const ms = Date.parse(m.started);
    if (ms > currentMs && (!best || ms < best.ms)) best = { ms, iso: m.started };
  }
  return best?.iso ?? null;
}
