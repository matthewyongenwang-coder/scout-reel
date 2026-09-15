import { RATING_FIELDS, type RatingName } from "./forms";

/** One scouting card as the /scouting list and the team page show it. */
export type ReportSummary = {
  teamId: number;
  teamNumber: string;
  seasonId: number;
  notes: string;
  updatedAt: string;
} & Record<RatingName, number | null>;

export type ReportSort = "recent" | "rating" | "team";

/** Mean of the ratings that are filled in, to one decimal place, or null when none are. */
export function averageRating(report: ReportSummary): number | null {
  const ratings = RATING_FIELDS.map((f) => report[f.name]).filter((r): r is number => r !== null);
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10;
}

/** Matches the search against the team number and the notes, ignoring case. */
export function filterReports(reports: ReportSummary[], query: string): ReportSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return reports;
  return reports.filter((r) => r.teamNumber.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q));
}

const teamOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Returns a new, sorted list. */
export function sortReports(reports: ReportSummary[], sort: ReportSort): ReportSummary[] {
  const copy = [...reports];
  switch (sort) {
    case "recent":
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "team":
      return copy.sort((a, b) => teamOrder.compare(a.teamNumber, b.teamNumber));
    case "rating":
      return copy.sort((a, b) => {
        const ra = averageRating(a);
        const rb = averageRating(b);
        if (ra === rb) return teamOrder.compare(a.teamNumber, b.teamNumber);
        if (ra === null) return 1;
        if (rb === null) return -1;
        return rb - ra;
      });
  }
}
