import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RatingName } from "./forms";
import type { ReportSummary } from "./list";

/**
 * Reads scouting cards as the signed-in user, so row level security limits every query
 * to workspaces they belong to. Private per user: never wrap these in "use cache".
 */

type ReportRow = {
  id: string;
  team_id: number;
  team_number: string;
  season_id: number;
  driving: number | null;
  consistency: number | null;
  field_sense: number | null;
  autonomous: number | null;
  notes: string;
  updated_by: string | null;
  updated_at: string;
};

type RevisionRow = {
  id: number;
  driving: number | null;
  consistency: number | null;
  field_sense: number | null;
  autonomous: number | null;
  notes: string;
  author_id: string | null;
  created_at: string;
};

export type TeamReport = ReportSummary & { id: string; updatedByYou: boolean };

export type Revision = {
  id: number;
  notes: string;
  createdAt: string;
  byYou: boolean;
} & Record<RatingName, number | null>;

const REPORT_COLUMNS = "id, team_id, team_number, season_id, driving, consistency, field_sense, autonomous, notes, updated_by, updated_at";

function toSummary(row: ReportRow): ReportSummary {
  return {
    teamId: row.team_id,
    teamNumber: row.team_number,
    seasonId: row.season_id,
    driving: row.driving,
    consistency: row.consistency,
    fieldSense: row.field_sense,
    autonomous: row.autonomous,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

/** Every card in a workspace, newest first. */
export async function getWorkspaceReports(workspaceId: string): Promise<ReportSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scouting_reports")
    .select(REPORT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(2000)
    .returns<ReportRow[]>();
  if (error) throw new Error("Could not load scouting cards");
  return (data ?? []).map(toSummary);
}

/** One team's card for a season, with its most recent revisions. */
export async function getTeamReport(
  workspaceId: string,
  teamId: number,
  seasonId: number,
  viewerId: string,
): Promise<{ report: TeamReport | null; revisions: Revision[] }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scouting_reports")
    .select(REPORT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("team_id", teamId)
    .eq("season_id", seasonId)
    .returns<ReportRow[]>()
    .maybeSingle();
  if (error) throw new Error("Could not load the scouting card");
  if (!data) return { report: null, revisions: [] };

  const revisions = await supabase
    .from("report_revisions")
    .select("id, driving, consistency, field_sense, autonomous, notes, author_id, created_at")
    .eq("report_id", data.id)
    .order("id", { ascending: false })
    .limit(20)
    .returns<RevisionRow[]>();
  if (revisions.error) throw new Error("Could not load the card history");

  return {
    report: { ...toSummary(data), id: data.id, updatedByYou: data.updated_by === viewerId },
    revisions: (revisions.data ?? []).map((r) => ({
      id: r.id,
      driving: r.driving,
      consistency: r.consistency,
      fieldSense: r.field_sense,
      autonomous: r.autonomous,
      notes: r.notes,
      createdAt: r.created_at,
      byYou: r.author_id === viewerId,
    })),
  };
}

/** Team ids with a card in this workspace and season, for the Scouted marker on event pages. */
export async function getScoutedTeamIds(workspaceId: string, seasonId: number): Promise<number[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scouting_reports")
    .select("team_id")
    .eq("workspace_id", workspaceId)
    .eq("season_id", seasonId)
    .limit(5000)
    .returns<{ team_id: number }[]>();
  if (error) return [];
  return (data ?? []).map((r) => r.team_id);
}
