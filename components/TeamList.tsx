"use client";

import Link from "next/link";
import { Suspense, use, useDeferredValue, useState } from "react";
import { formatLocation } from "@/lib/format";
import type { TeamSummary } from "@/lib/vex/api";
import { inputClass } from "./ui";

export function TeamList({
  eventSku,
  teams,
  scouted,
}: {
  eventSku: string;
  teams: TeamSummary[];
  /**
   * Team ids the signed-in user's workspace has a scouting card for this season. Passed as a
   * promise so the list and its search box render at once and the markers stream in after.
   */
  scouted?: Promise<number[]>;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const q = deferred.trim().toLowerCase();
  const shown = q
    ? teams.filter((t) =>
        [t.number, t.name, t.organization, t.city, t.region, t.country].some((v) => v?.toLowerCase().includes(q)),
      )
    : teams;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="teams-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="teams-heading" className="text-lg font-semibold">
            Teams attending <span className="font-normal text-muted">({teams.length})</span>
          </h2>
          <p className="text-sm text-muted">Pick a team to see its matches and match videos from this season.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm sm:w-80">
          <span className="font-medium">Search teams</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Number, name, school, or city"
            className={inputClass}
          />
        </label>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted">No teams have registered for this event yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted" aria-live="polite">{`No teams match "${query}".`}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <li key={t.id}>
              <Link
                href={`/team/${t.id}?event=${eventSku}`}
                className="block h-full rounded-md border border-line bg-panel p-3 hover:border-accent"
              >
                <span className="font-semibold">{t.number}</span>
                {t.name ? <span className="ml-2 text-muted">{t.name}</span> : null}
                {scouted ? (
                  <Suspense fallback={null}>
                    <ScoutedBadge scouted={scouted} teamId={t.id} />
                  </Suspense>
                ) : null}
                <span className="mt-1 block text-xs text-muted">
                  {formatLocation([t.organization, t.city, t.region]) || "Location not listed"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoutedBadge({ scouted, teamId }: { scouted: Promise<number[]>; teamId: number }) {
  const ids = use(scouted);
  if (!ids.includes(teamId)) return null;
  return <span className="ml-2 rounded border border-accent px-1.5 text-xs font-medium text-accent">Scouted</span>;
}
