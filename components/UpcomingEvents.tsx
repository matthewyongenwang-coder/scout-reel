"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { formatEventDates, formatLocation } from "@/lib/format";
import type { EventSummary } from "@/lib/vex/api";
import { inputClass } from "./ui";

const PAGE = 50;

export function UpcomingEvents({ events, today }: { events: EventSummary[]; today: string }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const q = deferred.trim().toLowerCase();
  const matches = q
    ? events.filter((e) =>
        [e.name, e.sku, e.city, e.region, e.country, e.level].some((v) => v?.toLowerCase().includes(q)),
      )
    : events;
  const shown = matches.slice(0, PAGE);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="font-medium">Search upcoming events</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Event name, city, region, or Signature"
          className={inputClass}
        />
      </label>
      <p className="text-sm text-muted" aria-live="polite">
        {matches.length === 0
          ? "No upcoming events match that search."
          : matches.length > PAGE
            ? `Showing the first ${PAGE} of ${matches.length} events. Search to narrow it down.`
            : `${matches.length} ${matches.length === 1 ? "event" : "events"}`}
      </p>
      <ul className="divide-y divide-line rounded-md border border-line bg-panel">
        {shown.map((e) => {
          // Events in the list have not ended, so one that has started is happening now.
          const inProgress = (e.start ?? "").slice(0, 10) <= today;
          return (
            <li key={e.id}>
              <Link
                href={`/event/${e.sku}`}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-background sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="font-medium">{e.name}</span>
                <span className="shrink-0 text-sm text-muted">
                  {[
                    inProgress ? "In progress" : null,
                    formatEventDates(e.start, e.end),
                    formatLocation([e.city, e.region]),
                    e.level === "Other" ? null : e.level,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
