"use server";

import { refresh } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { accountsEnabled } from "@/lib/env";
import { parseReportForm } from "@/lib/scouting/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/vex/api";

export type SaveReportState = { error: string | null; saved: boolean };

/**
 * Saves a scouting card. The signed-in user is checked here, and row level security
 * refuses the save unless they belong to the workspace named in the form.
 */
export async function saveReport(_prev: SaveReportState, data: FormData): Promise<SaveReportState> {
  if (!accountsEnabled()) return { error: "Accounts are not open yet.", saved: false };
  const viewer = await getViewer();
  if (!viewer) return { error: "You are signed out. Sign in again, then save.", saved: false };
  const parsed = parseReportForm(data);
  if (!parsed.ok) return { error: parsed.error, saved: false };

  const r = parsed.report;
  // The team number shown to teammates comes from the VEX Events API, never from the form.
  let teamNumber: string;
  try {
    const team = await getTeam(r.teamId);
    if (!team) return { error: "That team does not exist on events.vex.com.", saved: false };
    teamNumber = team.number;
  } catch {
    return { error: "Could not check the team right now. Try again in a minute.", saved: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_scouting_report", {
    p_workspace: r.workspaceId,
    p_team_id: r.teamId,
    p_season_id: r.seasonId,
    p_team_number: teamNumber,
    p_driving: r.driving,
    p_consistency: r.consistency,
    p_field_sense: r.fieldSense,
    p_autonomous: r.autonomous,
    p_notes: r.notes,
  });
  if (error) return { error: "The card could not be saved. You may no longer be in this workspace.", saved: false };
  refresh();
  return { error: null, saved: true };
}
