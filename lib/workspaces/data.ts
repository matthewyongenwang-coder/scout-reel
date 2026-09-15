import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, type Membership, pickActiveWorkspace } from "./active";

export type WorkspaceMember = { userId: string; role: "owner" | "member"; joinedAt: string; label: string };

export type WorkspaceContext = {
  viewer: Viewer;
  memberships: Membership[];
  active: Membership | null;
};

type MembershipRow = {
  workspace_id: string;
  role: "owner" | "member";
  created_at: string;
  workspaces: { name: string } | null;
};

/**
 * The viewer, every workspace they belong to, and the one the app is showing.
 * Private per user: never put this in "use cache", whose keys are shared and stored as text.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id, role, created_at, workspaces(name)")
    .eq("user_id", viewer.userId)
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();
  if (error) throw new Error("Could not load your workspaces");
  const memberships: Membership[] = (data ?? []).map((row) => ({
    workspaceId: row.workspace_id,
    name: row.workspaces?.name ?? "Workspace",
    role: row.role,
    joinedAt: row.created_at,
  }));
  const store = await cookies();
  return { viewer, memberships, active: pickActiveWorkspace(memberships, store.get(ACTIVE_WORKSPACE_COOKIE)?.value) };
});

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("workspace_members", { p_workspace: workspaceId });
  if (error) throw new Error("Could not load the members of this workspace");
  return ((data ?? []) as { user_id: string; role: "owner" | "member"; joined_at: string; label: string }[]).map((m) => ({
    userId: m.user_id,
    role: m.role,
    joinedAt: m.joined_at,
    label: m.label,
  }));
}
