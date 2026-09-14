export const RATING_FIELDS = [
  { name: "driving", label: "Driving" },
  { name: "consistency", label: "Consistency" },
  { name: "fieldSense", label: "Field Sense" },
  { name: "autonomous", label: "Autonomous" },
] as const;

export type RatingName = (typeof RATING_FIELDS)[number]["name"];

export type ReportInput = {
  workspaceId: string;
  teamId: number;
  seasonId: number;
  teamNumber: string;
  notes: string;
} & Record<RatingName, number | null>;

export const NOTES_MAX = 4000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEAM_NUMBER = /^[0-9A-Za-z]{1,8}$/;
const CONTROL = /[\x00-\x1f\x7f]/;

const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

function positiveInt(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

export function parseReportForm(data: FormData): { ok: true; report: ReportInput } | { ok: false; error: string } {
  const workspaceId = text(data, "workspaceId");
  const teamId = positiveInt(text(data, "teamId"));
  const seasonId = positiveInt(text(data, "seasonId"));
  const teamNumber = text(data, "teamNumber");
  if (!UUID.test(workspaceId) || teamId === null || seasonId === null || !TEAM_NUMBER.test(teamNumber)) {
    return { ok: false, error: "Something went wrong with this card. Reload the page and try again." };
  }

  const ratings = {} as Record<RatingName, number | null>;
  for (const { name } of RATING_FIELDS) {
    const raw = text(data, name).trim();
    if (raw === "") {
      ratings[name] = null;
    } else if (/^(10|[1-9])$/.test(raw)) {
      ratings[name] = Number(raw);
    } else {
      return { ok: false, error: "Ratings must be whole numbers from 1 to 10." };
    }
  }

  const notes = text(data, "notes").replace(/\r\n?/g, "\n");
  if (notes.length > NOTES_MAX) return { ok: false, error: `Notes can be at most ${NOTES_MAX} characters.` };

  return { ok: true, report: { workspaceId, teamId, seasonId, teamNumber, ...ratings, notes } };
}

export function parseWorkspaceForm(
  data: FormData,
): { ok: true; name: string; teamLabel: string | null } | { ok: false; error: string } {
  const name = text(data, "name").trim();
  if (name.length < 1 || name.length > 60 || CONTROL.test(name)) {
    return { ok: false, error: "Give the workspace a name of up to 60 characters." };
  }
  const label = text(data, "teamLabel").trim().toUpperCase();
  if (label && !/^[0-9A-Z]{1,8}$/.test(label)) {
    return { ok: false, error: "Team numbers use only letters and numbers, like 96Z." };
  }
  return { ok: true, name, teamLabel: label || null };
}
