"use client";

import { useActionState, useState } from "react";
import { type SaveReportState, saveReport } from "@/app/scouting/actions";
import { NOTES_MAX, RATING_FIELDS, type RatingName } from "@/lib/scouting/forms";
import { inputClass, primaryButtonClass } from "./ui";

type Ratings = Record<RatingName, number | null>;

export type CardReport = Ratings & { notes: string; updatedAt: string; updatedByYou: boolean };
export type CardRevision = Ratings & { id: number; notes: string; createdAt: string; byYou: boolean };

// Dates only. Saves are stamped by the database in UTC, and clock times are never shown in the app.
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function ratingsText(r: Ratings): string {
  const parts = RATING_FIELDS.filter((f) => r[f.name] !== null).map((f) => `${f.label} ${r[f.name]}`);
  return parts.length ? parts.join(", ") : "No ratings";
}

export function ScoutingCardForm({
  workspaceId,
  workspaceName,
  teamId,
  seasonId,
  teamNumber,
  report,
  revisions,
}: {
  workspaceId: string;
  workspaceName: string;
  teamId: number;
  seasonId: number;
  teamNumber: string;
  report: CardReport | null;
  revisions: CardRevision[];
}) {
  const [state, action, pending] = useActionState<SaveReportState, FormData>(saveReport, { error: null, saved: false });
  const [notes, setNotes] = useState(report?.notes ?? "");
  // Any change after a save hides "Saved." until the next save.
  const [edited, setEdited] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={action}
        onChange={() => setEdited(true)}
        onSubmit={() => setEdited(false)}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="teamNumber" value={teamNumber} />
        <div className="grid grid-cols-2 gap-3">
          {RATING_FIELDS.map((field) => (
            <label key={field.name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{field.label}</span>
              <select name={field.name} defaultValue={report?.[field.name] ?? ""} className={inputClass}>
                <option value="">Not rated</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {`${n} out of 10`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={NOTES_MAX}
            rows={5}
            className={inputClass}
            aria-describedby="notes-count"
          />
          <span id="notes-count" className="text-xs text-muted">{`${notes.length} of ${NOTES_MAX} characters`}</span>
        </label>
        {state.error ? (
          <p role="alert" className="text-sm text-alliance-red">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "Saving" : "Save card"}
          </button>
          <p className="text-sm text-muted" aria-live="polite">
            {state.saved && !pending && !edited
              ? "Saved."
              : report
                ? `Last saved ${day.format(new Date(report.updatedAt))} by ${report.updatedByYou ? "you" : "a teammate"}.`
                : `Not scouted yet in ${workspaceName}.`}
          </p>
        </div>
      </form>

      {revisions.length > 0 ? (
        <details className="rounded-md border border-line">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{`History (${revisions.length})`}</summary>
          <ol className="flex flex-col gap-3 px-3 pb-3">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
                <span className="text-muted">{`${day.format(new Date(r.createdAt))}, ${r.byYou ? "you" : "a teammate"}`}</span>
                <span>{ratingsText(r)}</span>
                {/* Notes are shown as plain text, never as HTML. */}
                {r.notes ? <p className="whitespace-pre-wrap break-words">{r.notes}</p> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
