"use server";

import { redirect } from "next/navigation";
import { parseConfirmParams } from "@/lib/auth/forms";
import { takeNextPath } from "@/lib/auth/next-path";
import { accountsEnabled } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConfirmState = { error: string | null };

/**
 * Finishes signing in from the email link. It only runs when the person presses Continue,
 * so email scanners that open links on their own cannot use the link up.
 */
export async function confirmSignIn(_prev: ConfirmState, data: FormData): Promise<ConfirmState> {
  if (!accountsEnabled()) return { error: "Accounts are not open yet." };
  const parsed = parseConfirmParams(data.get("tokenHash"), data.get("type"));
  if (!parsed) return { error: "This sign-in link is not complete. Ask for a new one." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type });
  if (error) return { error: "This sign-in link has expired or was already used. Ask for a new one." };
  redirect(await takeNextPath("/account"));
}
