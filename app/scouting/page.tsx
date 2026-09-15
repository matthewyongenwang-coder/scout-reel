import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Problem } from "@/components/Problem";
import { ScoutingList } from "@/components/ScoutingList";
import { accountsEnabled } from "@/lib/env";
import { getWorkspaceReports } from "@/lib/scouting/data";
import { getWorkspaceContext } from "@/lib/workspaces/data";

export const metadata: Metadata = { title: "Scouting" };

export default function ScoutingPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Scouting</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading your scouting cards</p>}>
        <ScoutingContent />
      </Suspense>
    </div>
  );
}

async function ScoutingContent() {
  if (!accountsEnabled()) {
    return <Problem title="Accounts are not open yet" detail="Scouting accounts are still being set up. Browsing works as usual." />;
  }
  let context: Awaited<ReturnType<typeof getWorkspaceContext>>;
  let reports: Awaited<ReturnType<typeof getWorkspaceReports>> = [];
  try {
    context = await getWorkspaceContext();
    if (context?.active) reports = await getWorkspaceReports(context.active.workspaceId);
  } catch {
    return <Problem title="Scouting cards could not be loaded" detail="Reload the page to try again in a moment." />;
  }
  if (!context) {
    return (
      <p className="text-sm">
        <Link href="/sign-in?next=/scouting" className="text-accent hover:underline">
          Sign in
        </Link>{" "}
        to see every team your workspace has scouted.
      </p>
    );
  }
  if (!context.active) {
    return (
      <p className="text-sm">
        You are not in a workspace yet.{" "}
        <Link href="/account" className="text-accent hover:underline">
          Create or join one
        </Link>{" "}
        to start scouting with your team.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-muted">
        {`Scouting cards in ${context.active.name}. Only people in this workspace can see them.`}
        {context.memberships.length > 1 ? (
          <>
            {" "}
            <Link href="/account" className="text-accent hover:underline">
              Switch workspace
            </Link>
          </>
        ) : null}
      </p>
      <ScoutingList reports={reports} />
    </>
  );
}
