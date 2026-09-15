"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type ConfirmState, confirmSignIn } from "@/app/auth/confirm/actions";
import { primaryButtonClass } from "./ui";

export function ConfirmSignIn({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmSignIn, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <p className="text-sm text-muted">Press Continue to finish signing in.</p>
      {state.error ? (
        <p role="alert" className="text-sm text-alliance-red">
          {state.error}{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Get a new link
          </Link>
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? "Signing in" : "Continue"}
      </button>
    </form>
  );
}
