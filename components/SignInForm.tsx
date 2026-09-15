"use client";

import { useActionState, useState } from "react";
import { type CodeStepState, type EmailStepState, sendSignInEmail, verifySignInCode } from "@/app/sign-in/actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export function SignInForm({ next }: { next: string }) {
  const [emailState, emailAction, sending] = useActionState<EmailStepState, FormData>(sendSignInEmail, {
    sentTo: null,
    error: null,
  });
  const [codeState, codeAction, verifying] = useActionState<CodeStepState, FormData>(verifySignInCode, { error: null });
  const [changing, setChanging] = useState(false);
  const sentTo = changing ? null : emailState.sentTo;

  if (!sentTo) {
    return (
      <form action={emailAction} onSubmit={() => setChanging(false)} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            className={inputClass}
            aria-invalid={emailState.error ? true : undefined}
            aria-describedby={emailState.error ? "email-error" : undefined}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input name="age" type="checkbox" required className="mt-1" />
          <span>I am 13 or older.</span>
        </label>
        {emailState.error ? (
          <p id="email-error" role="alert" className="text-sm text-alliance-red">
            {emailState.error}
          </p>
        ) : null}
        <button type="submit" disabled={sending} className={`${primaryButtonClass} self-start`}>
          {sending ? "Sending" : "Email me a sign-in link"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" aria-live="polite">
        {`We sent an email to ${sentTo}. Open the link in it, or type the code from the email below. It can take a minute to arrive, so check your spam folder too.`}
      </p>
      <form action={codeAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={sentTo} />
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Code from the email</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={12}
            className={inputClass}
            aria-invalid={codeState.error ? true : undefined}
            aria-describedby={codeState.error ? "code-error" : undefined}
          />
        </label>
        {codeState.error ? (
          <p id="code-error" role="alert" className="text-sm text-alliance-red">
            {codeState.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={verifying} className={primaryButtonClass}>
            {verifying ? "Signing in" : "Sign in"}
          </button>
          <button type="button" onClick={() => setChanging(true)} className={secondaryButtonClass}>
            Use a different email
          </button>
        </div>
      </form>
    </div>
  );
}
