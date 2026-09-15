"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatInviteCode, normalizeInviteCode } from "@/lib/auth/forms";
import { getViewer } from "@/lib/auth/viewer";
import { accountsEnabled } from "@/lib/env";
import { parseWorkspaceForm } from "@/lib/scouting/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspaces/active";

export type AccountState = { error: string | null; message: string | null; inviteCode: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_OUT: AccountState = { error: "You are signed out. Sign in again and retry.", message: null, inviteCode: null };
const fail = (error: string): AccountState => ({ error, message: null, inviteCode: null });

/** Every action checks the signed-in user itself; the page showing a form is not a permission. */
async function signedIn() {
  if (!accountsEnabled()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  return { viewer, supabase: await createSupabaseServerClient() };
}

const uuidField = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" && UUID.test(value) ? value : null;
};

async function rememberWorkspace(workspaceId: string) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createWorkspace(_prev: AccountState, data: FormData): Promise<AccountState> {
  const session = await signedIn();
  if (!session) return SIGNED_OUT;
  const parsed = parseWorkspaceForm(data);
  if (!parsed.ok) return fail(parsed.error);
  const { data: rows, error } = await session.supabase.rpc("create_workspace", {
    p_name: parsed.name,
    p_team_label: parsed.teamLabel,
  });
  const created = (rows as { workspace_id: string; invite_code: string }[] | null)?.[0];
  if (error || !created) {
    return fail(error?.message.includes("5 workspaces") ? "You can create at most 5 workspaces." : "The workspace could not be created. Try again.");
  }
  await rememberWorkspace(created.workspace_id);
  refresh();
  return {
    error: null,
    message: `${parsed.name} is ready. Send this invite code to your teammates. It is only shown now, but the owner can make a new one at any time.`,
    inviteCode: formatInviteCode(created.invite_code),
  };
}

export async function joinWorkspace(_prev: AccountState, data: FormData): Promise<AccountState> {
  const session = await signedIn();
  if (!session) return SIGNED_OUT;
  const raw = data.get("code");
  const code = typeof raw === "string" ? normalizeInviteCode(raw) : null;
  if (!code) return fail("That is not an invite code. Codes have 32 letters and numbers.");
  const { data: rows, error } = await session.supabase.rpc("join_workspace", { p_code: code });
  const result = (rows as { status: string; workspace_id: string | null }[] | null)?.[0];
  if (error || !result) return fail("Could not join right now. Try again.");
  switch (result.status) {
    case "joined":
    case "already_member":
      if (result.workspace_id) await rememberWorkspace(result.workspace_id);
      refresh();
      return {
        error: null,
        message: result.status === "joined" ? "You joined the workspace." : "You are already in that workspace.",
        inviteCode: null,
      };
    case "rate_limited":
      return fail("Too many wrong codes. Wait 10 minutes and try again.");
    case "too_many":
      return fail("You are in the most workspaces allowed. Leave one first.");
    default:
      return fail("That invite code did not work. Ask the workspace owner for the current code.");
  }
}

export async function rotateInvite(_prev: AccountState, data: FormData): Promise<AccountState> {
  const session = await signedIn();
  if (!session) return SIGNED_OUT;
  const workspaceId = uuidField(data, "workspaceId");
  if (!workspaceId) return fail("Reload the page and try again.");
  const { data: code, error } = await session.supabase.rpc("rotate_invite", { p_workspace: workspaceId });
  if (error || typeof code !== "string") {
    return fail("Could not make a new invite code. Only the workspace owner can, so check that and try again.");
  }
  return {
    error: null,
    message: "New invite code made. The old code no longer works. It is only shown now.",
    inviteCode: formatInviteCode(code),
  };
}

export async function deleteWorkspace(_prev: AccountState, data: FormData): Promise<AccountState> {
  const session = await signedIn();
  if (!session) return SIGNED_OUT;
  const workspaceId = uuidField(data, "workspaceId");
  if (!workspaceId) return fail("Reload the page and try again.");
  if (data.get("confirm") !== "on") return fail("Tick the box to confirm that all scouting in this workspace will be deleted.");
  const { error } = await session.supabase.rpc("delete_workspace", { p_workspace: workspaceId });
  if (error) return fail("Only the workspace owner can delete it.");
  refresh();
  return { error: null, message: "Workspace deleted.", inviteCode: null };
}

export async function deleteAccount(_prev: AccountState, data: FormData): Promise<AccountState> {
  const session = await signedIn();
  if (!session) return SIGNED_OUT;
  if (data.get("confirm") !== "on") return fail("Tick the box to confirm.");
  const { data: status, error } = await session.supabase.rpc("delete_my_account");
  if (error) return fail("Your account could not be deleted right now. Try again.");
  if (status === "owns_workspace") return fail("You own a workspace. Delete the workspaces you own first.");
  if (status !== "deleted") return fail("Account deletion is not available yet. Try again later.");
  await session.supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/");
}

export async function removeMember(data: FormData): Promise<void> {
  const session = await signedIn();
  const workspaceId = uuidField(data, "workspaceId");
  const userId = uuidField(data, "userId");
  if (!session || !workspaceId || !userId) return;
  // Row level security only lets an owner remove a member, or a member remove themselves.
  await session.supabase.from("memberships").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  refresh();
}

export async function leaveWorkspace(data: FormData): Promise<void> {
  const session = await signedIn();
  const workspaceId = uuidField(data, "workspaceId");
  if (!session || !workspaceId) return;
  await session.supabase.from("memberships").delete().eq("workspace_id", workspaceId).eq("user_id", session.viewer.userId);
  const store = await cookies();
  if (store.get(ACTIVE_WORKSPACE_COOKIE)?.value === workspaceId) store.delete(ACTIVE_WORKSPACE_COOKIE);
  refresh();
}

export async function chooseWorkspace(data: FormData): Promise<void> {
  const session = await signedIn();
  const workspaceId = uuidField(data, "workspaceId");
  if (!session || !workspaceId) return;
  const { data: rows } = await session.supabase
    .from("memberships")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", session.viewer.userId);
  if (rows?.length) await rememberWorkspace(workspaceId);
  refresh();
}

export async function signOut(): Promise<void> {
  if (accountsEnabled()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/");
}
