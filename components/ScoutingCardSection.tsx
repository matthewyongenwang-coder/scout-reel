import Link from "next/link";
import type { ReactNode } from "react";
import { accountsEnabled } from "@/lib/env";
import { getTeamReport } from "@/lib/scouting/data";
import { getWorkspaceContext } from "@/lib/workspaces/data";
import { ScoutingCardForm } from "./ScoutingCardForm";

function Frame({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="scouting-heading" className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
      <h2 id="scouting-heading" className="font-semibold">
        Scouting card
      </h2>
      {children}
    </section>
  );
}

/** The private scouting card for this team and season. Reads the session, so it must sit inside Suspense. */
export async function ScoutingCardSection({
  teamId,
  teamNumber,
  seasonId,
  returnPath,
}: {
  teamId: number;
  teamNumber: string;
  seasonId: number;
  /** Where sign in should come back to: this team page. */
  returnPath: string;
}) {
  if (!accountsEnabled()) return null;
  const context = await getWorkspaceContext();
  if (!context) {
    return (
      <Frame>
        <p className="text-sm text-muted">
          <Link href={`/sign-in?next=${encodeURIComponent(returnPath)}`} className="text-accent hover:underline">
            Sign in
          </Link>{" "}
          to rate this team and keep private notes that only your team can see.
        </p>
      </Frame>
    );
  }
  if (!context.active) {
    return (
      <Frame>
        <p className="text-sm text-muted">
          To start a scouting card,{" "}
          <Link href="/account" className="text-accent hover:underline">
            create or join a workspace
          </Link>{" "}
          for your team.
        </p>
      </Frame>
    );
  }

  const { active, viewer } = context;
  let loaded: Awaited<ReturnType<typeof getTeamReport>>;
  try {
    loaded = await getTeamReport(active.workspaceId, teamId, seasonId, viewer.userId);
  } catch {
    return (
      <Frame>
        <p className="text-sm text-muted">The scouting card could not be loaded right now. Reload the page to try again.</p>
      </Frame>
    );
  }
  const { report, revisions } = loaded;
  return (
    <Frame>
      <p className="text-sm text-muted">{`Private to ${active.name}. Only people in this workspace can see it.`}</p>
      <ScoutingCardForm
        // A new save gives new starting values, so remount the form with them.
        key={report?.updatedAt ?? "new"}
        workspaceId={active.workspaceId}
        workspaceName={active.name}
        teamId={teamId}
        seasonId={seasonId}
        teamNumber={teamNumber}
        report={report}
        revisions={revisions}
      />
    </Frame>
  );
}
