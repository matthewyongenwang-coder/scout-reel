/**
 * Reads the structured description Robot Stats puts on every per-match clip:
 * the VEX event id, the match name, both alliances and scores, and chapter
 * times for "Auton Start" and "Driver Start". Two description styles exist
 * (plain and emoji-prefixed); both keep the same labels, so patterns are unanchored.
 *
 * Descriptions are third-party text, so a clip is only trusted when it agrees
 * with the official results (see clipShowsMatch).
 */

export type ClipInfo = {
  eventId: number;
  matchName: string;
  red: string[];
  blue: string[];
  redScore: number | null;
  blueScore: number | null;
  autonStartS: number | null;
  driverStartS: number | null;
};

const EVENT_ID = [/events\.vex\.com\/api\/v2\/events\/(\d+)/, /robotstatistics\.com\/event\/(\d+)/];

// A match clip is a few minutes long; anything past this is not a real chapter time.
const MAX_CHAPTER_S = 20 * 60;

function teams(line: string | undefined): string[] {
  if (!line) return [];
  return line
    .replace(/\(.*$/, "")
    .split("&")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[0-9]{1,6}[A-Z]{0,2}$/.test(t));
}

function score(description: string, color: "Red" | "Blue"): number | null {
  const plain = description.match(new RegExp(`${color} score:\\s*(\\d+)`, "i"));
  const inline = description.match(new RegExp(`${color} Alliance:[^\\n]*\\(Score:\\s*(\\d+)\\)`, "i"));
  const m = plain ?? inline;
  return m ? Number(m[1]) : null;
}

function chapterSeconds(description: string, label: string): number | null {
  const m = description.match(new RegExp(`(?:^|\\n)\\s*(?:(\\d{1,2}):)?(\\d{1,2}):(\\d{2})\\s+${label}\\b`, "i"));
  if (!m) return null;
  const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return seconds <= MAX_CHAPTER_S ? seconds : null;
}

export function parseClipDescription(description: string): ClipInfo | null {
  let eventId: number | null = null;
  for (const pattern of EVENT_ID) {
    const m = description.match(pattern);
    if (m) {
      eventId = Number(m[1]);
      break;
    }
  }
  const matchName = description.match(/Match:\s*([^\n]+)/)?.[1]?.trim();
  const red = teams(description.match(/Red Alliance:\s*([^\n]+)/)?.[1]);
  const blue = teams(description.match(/Blue Alliance:\s*([^\n]+)/)?.[1]);
  if (!eventId || !matchName || red.length === 0 || blue.length === 0) return null;
  return {
    eventId,
    matchName,
    red,
    blue,
    redScore: score(description, "Red"),
    blueScore: score(description, "Blue"),
    autonStartS: chapterSeconds(description, "Auton Start"),
    driverStartS: chapterSeconds(description, "Driver Start"),
  };
}

export type MatchFacts = {
  name: string;
  red: string[];
  blue: string[];
  redScore?: number | null;
  blueScore?: number | null;
};

const sameTeams = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

const scoresAgree = (clipScore: number | null, officialScore: number | null | undefined) =>
  clipScore === null || officialScore == null || clipScore === officialScore;

/**
 * True when a clip shows exactly this official match: same name, the same teams
 * on each alliance, and, whenever both sides know them, the same scores.
 */
export function clipShowsMatch(clip: ClipInfo, match: MatchFacts): boolean {
  return (
    clip.matchName === match.name &&
    sameTeams(clip.red, match.red.map((t) => t.toUpperCase())) &&
    sameTeams(clip.blue, match.blue.map((t) => t.toUpperCase())) &&
    scoresAgree(clip.redScore, match.redScore) &&
    scoresAgree(clip.blueScore, match.blueScore)
  );
}
