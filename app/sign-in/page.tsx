import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Problem } from "@/components/Problem";
import { SignInForm } from "@/components/SignInForm";
import { safeNextPath } from "@/lib/auth/forms";
import { getViewer } from "@/lib/auth/viewer";
import { accountsEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted">
          Sign in to keep private scouting notes with your team. You do not need an account to browse events, teams, or
          match videos.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading</p>}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
      <p className="text-xs text-muted">
        Scout Reel stores only your email address, to sign you in. There are no public profiles. You must be 13 or older.
        See the{" "}
        <Link href="/about" className="text-accent hover:underline">
          About page
        </Link>{" "}
        for what is stored and how to delete it.
      </p>
    </div>
  );
}

async function SignInContent({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  if (!accountsEnabled()) {
    return <Problem title="Accounts are not open yet" detail="Scouting accounts are still being set up. Browsing works as usual." />;
  }
  const { next } = await searchParams;
  const viewer = await getViewer();
  if (viewer) {
    return (
      <p className="text-sm">
        {"You are already signed in. "}
        <Link href="/account" className="text-accent hover:underline">
          Go to your account
        </Link>
      </p>
    );
  }
  return <SignInForm next={safeNextPath(next)} />;
}
