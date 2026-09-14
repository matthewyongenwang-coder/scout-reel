import { z } from "zod";

// Control characters and backslashes never belong in a path or a name.
const CONTROL_OR_BACKSLASH = /[\x00-\x1f\x7f\\]/;

/** Only paths on this site may be used after sign in; anything else goes to the home page. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || CONTROL_OR_BACKSLASH.test(value)) return "/";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  if (decoded.startsWith("//") || CONTROL_OR_BACKSLASH.test(decoded)) return "/";
  const base = "https://scout-reel.invalid";
  return new URL(value, base).origin === base ? value : "/";
}

const INVITE_CODE = /^[0-9a-f]{32}$/;

/** Accepts a pasted invite code with any spacing, dashes or capitals. */
export function normalizeInviteCode(input: string): string | null {
  if (input.length > 100) return null;
  const code = input.replace(/[\s-]/g, "").toLowerCase();
  return INVITE_CODE.test(code) ? code : null;
}

export function formatInviteCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

const emailSchema = z
  .string()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  .pipe(z.email());

type EmailResult = { ok: true; email: string } | { ok: false; error: string };

function readEmail(data: FormData): EmailResult {
  const raw = data.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return emailSchema.safeParse(email).success ? { ok: true, email } : { ok: false, error: "Enter a valid email address." };
}

export type SignInForm = { ok: true; email: string; next: string } | { ok: false; error: string };

export function parseSignInForm(data: FormData): SignInForm {
  const email = readEmail(data);
  if (!email.ok) return email;
  if (data.get("age") !== "on") {
    return { ok: false, error: "You need to be 13 or older to make an account. Tick the box to confirm." };
  }
  return { ok: true, email: email.email, next: safeNextPath(data.get("next")) };
}

export type OtpForm = { ok: true; email: string; code: string; next: string } | { ok: false; error: string };

export function parseOtpForm(data: FormData): OtpForm {
  const email = readEmail(data);
  if (!email.ok) return email;
  const raw = data.get("code");
  const code = typeof raw === "string" ? raw.replace(/\s/g, "") : "";
  if (!/^\d{6,10}$/.test(code)) return { ok: false, error: "Enter the code from the email. It is 6 to 10 digits." };
  return { ok: true, email: email.email, code, next: safeNextPath(data.get("next")) };
}
