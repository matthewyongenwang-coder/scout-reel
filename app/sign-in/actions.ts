"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NEXT_PATH_COOKIE, parseOtpForm, parseSignInForm } from "@/lib/auth/forms";
import { takeNextPath } from "@/lib/auth/next-path";
import { accountsEnabled, serverEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EmailStepState = { sentTo: string | null; error: string | null };
export type CodeStepState = { error: string | null };

const CLOSED = "Accounts are not open yet.";

/** Sends the sign-in email. The reply is the same whether or not an account already exists. */
export async function sendSignInEmail(_prev: EmailStepState, data: FormData): Promise<EmailStepState> {
  if (!accountsEnabled()) return { sentTo: null, error: CLOSED };
  const parsed = parseSignInForm(data);
  if (!parsed.ok) return { sentTo: null, error: parsed.error };

  const site = serverEnv().NEXT_PUBLIC_SITE_URL;
  if (!site) return { sentTo: null, error: CLOSED };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.email,
    options: { shouldCreateUser: true, emailRedirectTo: new URL("/auth/confirm", site).toString() },
  });
  if (error) {
    return {
      sentTo: null,
      error:
        error.status === 429
          ? "Too many sign-in emails have been sent. Wait a few minutes and try again."
          : "The email could not be sent right now. Try again in a few minutes.",
    };
  }

  (await cookies()).set(NEXT_PATH_COOKIE, parsed.next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return { sentTo: parsed.email, error: null };
}

/** Signs in with the one-time code from the email, for when the link opens on another device. */
export async function verifySignInCode(_prev: CodeStepState, data: FormData): Promise<CodeStepState> {
  if (!accountsEnabled()) return { error: CLOSED };
  const parsed = parseOtpForm(data);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.email, token: parsed.code, type: "email" });
  if (error) return { error: "That code did not work. Check it, or ask for a new email." };
  redirect(await takeNextPath(parsed.next));
}
