import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmSignIn } from "@/components/ConfirmSignIn";
import { Problem } from "@/components/Problem";
import { parseConfirmParams } from "@/lib/auth/forms";
import { accountsEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Finish signing in", robots: { index: false } };

export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Finish signing in</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading</p>}>
        <ConfirmContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ConfirmContent({ searchParams }: { searchParams: PageProps<"/auth/confirm">["searchParams"] }) {
  if (!accountsEnabled()) {
    return <Problem title="Accounts are not open yet" detail="Scouting accounts are still being set up." />;
  }
  const { token_hash, type } = await searchParams;
  const parsed = parseConfirmParams(token_hash, type);
  if (!parsed) {
    return (
      <Problem
        title="This sign-in link is not complete"
        detail="Copy the whole link from the email, or ask for a new one."
        action={
          <Link href="/sign-in" className="text-sm text-accent hover:underline">
            Get a new link
          </Link>
        }
      />
    );
  }
  return <ConfirmSignIn tokenHash={parsed.tokenHash} type={parsed.type} />;
}
