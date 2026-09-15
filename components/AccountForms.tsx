"use client";

import { useActionState } from "react";
import {
  type AccountState,
  createWorkspace,
  deleteAccount,
  deleteWorkspace,
  joinWorkspace,
  rotateInvite,
} from "@/app/account/actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

const initial: AccountState = { error: null, message: null, inviteCode: null };

function Result({ state }: { state: AccountState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-sm text-alliance-red">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      {state.inviteCode ? (
        <p className="rounded-md border border-line bg-panel px-3 py-2 font-mono text-base break-all select-all">
          {state.inviteCode}
        </p>
      ) : null}
    </>
  );
}

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Workspace name</span>
          <input name="name" required maxLength={60} placeholder="Ctrl Z scouting" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:w-40">
          <span className="font-medium">Team number (optional)</span>
          <input name="teamLabel" maxLength={8} placeholder="96Z" className={inputClass} autoCapitalize="characters" />
        </label>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? "Creating" : "Create workspace"}
      </button>
    </form>
  );
}

export function JoinWorkspaceForm() {
  const [state, action, pending] = useActionState(joinWorkspace, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Invite code</span>
        <input name="code" required maxLength={100} autoComplete="off" spellCheck={false} className={`${inputClass} font-mono`} />
      </label>
      <Result state={state} />
      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? "Joining" : "Join workspace"}
      </button>
    </form>
  );
}

export function InviteCodePanel({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(rotateInvite, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <p className="text-sm text-muted">
        Invite codes are only shown once. Make a new one to invite someone, or if an old code was shared too widely. The
        old code stops working straight away.
      </p>
      <Result state={state} />
      <button type="submit" disabled={pending} className={`${secondaryButtonClass} self-start`}>
        {pending ? "Making a code" : "Make a new invite code"}
      </button>
    </form>
  );
}

export function DeleteWorkspaceForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteWorkspace, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label className="flex items-start gap-2 text-sm">
        <input name="confirm" type="checkbox" required className="mt-1" />
        <span>{`Delete ${name} and every scouting card in it for everyone. This cannot be undone.`}</span>
      </label>
      <Result state={state} />
      <button type="submit" disabled={pending} className={`${secondaryButtonClass} self-start`}>
        {pending ? "Deleting" : "Delete workspace"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input name="confirm" type="checkbox" required className="mt-1" />
        <span>Delete my account and email address. Scouting cards I wrote stay with my team without my name.</span>
      </label>
      <Result state={state} />
      <button type="submit" disabled={pending} className={`${secondaryButtonClass} self-start`}>
        {pending ? "Deleting" : "Delete my account"}
      </button>
    </form>
  );
}
