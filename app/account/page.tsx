import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import {
  CreateWorkspaceForm,
  DeleteAccountForm,
  DeleteWorkspaceForm,
  InviteCodePanel,
  JoinWorkspaceForm,
} from "@/components/AccountForms";
import { Problem } from "@/components/Problem";
import { secondaryButtonClass } from "@/components/ui";
import { accountsEnabled } from "@/lib/env";
import { getWorkspaceContext, getWorkspaceMembers } from "@/lib/workspaces/data";
import { chooseWorkspace, leaveWorkspace, removeMember, signOut } from "./actions";

export const metadata: Metadata = { title: "Account" };

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function AccountPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading your account</p>}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  if (!accountsEnabled()) {
    return <Problem title="Accounts are not open yet" detail="Scouting accounts are still being set up. Browsing works as usual." />;
  }
  const context = await getWorkspaceContext();
  if (!context) {
    return (
      <p className="text-sm">
        {"You are not signed in. "}
        <Link href="/sign-in?next=/account" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    );
  }

  const { viewer, memberships, active } = context;
  const members = active ? await getWorkspaceMembers(active.workspaceId) : [];
  const isOwner = active?.role === "owner";

  return (
    <>
      <Section title="You">
        <p className="text-sm">{`Signed in as ${viewer.email ?? "your email address"}. Only you can see this.`}</p>
        <form action={signOut}>
          <button type="submit" className={secondaryButtonClass}>
            Sign out
          </button>
        </form>
      </Section>

      <Section title="Your workspaces">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted">
            You are not in a workspace yet. Create one for your team below, or join one with an invite code from a teammate.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memberships.map((m) => (
              <li key={m.workspaceId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted">{m.role === "owner" ? ", owner" : ", member"}</span>
                </span>
                {m.workspaceId === active?.workspaceId ? (
                  <span className="text-muted">Showing now</span>
                ) : (
                  <form action={chooseWorkspace}>
                    <input type="hidden" name="workspaceId" value={m.workspaceId} />
                    <button type="submit" className={secondaryButtonClass}>
                      Show this workspace
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {active ? (
        <Section title={`People in ${active.name}`}>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{member.label}</span>
                  <span className="text-muted">
                    {`${member.role === "owner" ? ", owner" : ", member"}, joined ${day.format(new Date(member.joinedAt))}`}
                  </span>
                </span>
                {isOwner && member.role === "member" ? (
                  <form action={removeMember}>
                    <input type="hidden" name="workspaceId" value={active.workspaceId} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <button type="submit" className={secondaryButtonClass}>
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {isOwner ? (
            <InviteCodePanel workspaceId={active.workspaceId} />
          ) : (
            <form action={leaveWorkspace}>
              <input type="hidden" name="workspaceId" value={active.workspaceId} />
              <button type="submit" className={secondaryButtonClass}>
                Leave this workspace
              </button>
            </form>
          )}
        </Section>
      ) : null}

      <Section title="Create a workspace">
        <p className="text-sm text-muted">Make one workspace for your team. You become its owner and can invite teammates.</p>
        <CreateWorkspaceForm />
      </Section>

      <Section title="Join a workspace">
        <p className="text-sm text-muted">Ask your team&apos;s workspace owner for an invite code and paste it here.</p>
        <JoinWorkspaceForm />
      </Section>

      {isOwner && active ? (
        <Section title={`Delete ${active.name}`}>
          <DeleteWorkspaceForm workspaceId={active.workspaceId} name={active.name} />
        </Section>
      ) : null}

      <Section title="Delete your account">
        <DeleteAccountForm />
      </Section>
    </>
  );
}
