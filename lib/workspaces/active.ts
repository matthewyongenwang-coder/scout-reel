export type Membership = {
  workspaceId: string;
  name: string;
  role: "owner" | "member";
  joinedAt: string;
};

/** Name of the cookie remembering which workspace a user last picked. Holds only a workspace id. */
export const ACTIVE_WORKSPACE_COOKIE = "sr_ws";

/**
 * The workspace the app shows. The cookie is only a preference: it counts only if it
 * names a workspace the user really belongs to, otherwise the oldest membership is used.
 */
export function pickActiveWorkspace(memberships: Membership[], cookieValue: string | undefined): Membership | null {
  if (memberships.length === 0) return null;
  const chosen = cookieValue ? memberships.find((m) => m.workspaceId === cookieValue) : undefined;
  if (chosen) return chosen;
  return memberships.reduce((oldest, m) => (m.joinedAt < oldest.joinedAt ? m : oldest));
}
