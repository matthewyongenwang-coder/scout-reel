"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { RATING_FIELDS } from "@/lib/scouting/forms";
import { averageRating, filterReports, type ReportSort, type ReportSummary, sortReports } from "@/lib/scouting/list";
import { inputClass } from "./ui";

// Dates only: saves are stamped by the database in UTC, and the app never shows clock times.
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const SORTS: { value: ReportSort; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "rating", label: "Highest average rating" },
  { value: "team", label: "Team number" },
];

export function ScoutingList({ reports }: { reports: ReportSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ReportSort>("recent");
  const deferred = useDeferredValue(query);
  const shown = useMemo(() => sortReports(filterReports(reports, deferred), sort), [reports, deferred, sort]);

  return (
    <section aria-labelledby="scouted-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="scouted-heading" className="text-lg font-semibold">
          Scouted teams <span className="font-normal text-muted">({reports.length})</span>
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1 text-sm sm:w-64">
            <span className="font-medium">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Team number or notes"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-56">
            <span className="font-medium">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as ReportSort)} className={inputClass}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-muted">
          No scouting cards yet. Open any team from an event page and fill in its scouting card.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted" aria-live="polite">{`No scouted teams match "${query}".`}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {shown.map((r) => {
            const average = averageRating(r);
            return (
              <li key={`${r.teamId}:${r.seasonId}`}>
                <Link
                  // The season keeps the link on this card, even when it is from an older season.
                  href={`/team/${r.teamId}?season=${r.seasonId}`}
                  className="flex h-full flex-col gap-2 rounded-md border border-line bg-panel p-3 hover:border-accent"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{r.teamNumber}</span>
                    <span className="text-sm text-muted">
                      {average === null ? "Not rated" : `Average ${average.toFixed(1)} out of 10`}
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {RATING_FIELDS.map((f) => (
                      <span key={f.name}>
                        <span className="text-muted">{`${f.label} `}</span>
                        {r[f.name] ?? "Not rated"}
                      </span>
                    ))}
                  </span>
                  {/* Notes are plain text, never HTML. */}
                  {r.notes ? <span className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{r.notes}</span> : null}
                  <span className="text-xs text-muted">{`Updated ${day.format(new Date(r.updatedAt))}`}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
