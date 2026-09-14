import { connection } from "next/server";
import { Suspense } from "react";
import { EventFinder } from "@/components/EventFinder";
import { UpcomingEvents } from "@/components/UpcomingEvents";
import { PROGRAM_V5RC } from "@/config/seasons";
import { type EventSummary, getCurrentSeasonId, getUpcomingEvents } from "@/lib/vex/api";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Scout a team before your next event</h1>
        <p className="max-w-2xl text-muted">
          Pick the event you are going to, then pick a team. Scout Reel pulls up their matches so you can watch their
          auton and driving without hunting through livestreams.
        </p>
        <EventFinder />
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-3">
        <h2 id="how-heading" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-md border border-line bg-panel p-4">
            <p className="font-medium">1. Pick your event</p>
            <p className="mt-1 text-sm text-muted">
              Paste the event link or SKU from events.vex.com above, or choose it from the upcoming list below.
            </p>
          </li>
          <li className="rounded-md border border-line bg-panel p-4">
            <p className="font-medium">2. Pick a team</p>
            <p className="mt-1 text-sm text-muted">
              Every team registered for that event is listed. Search by team number, name, or school.
            </p>
          </li>
          <li className="rounded-md border border-line bg-panel p-4">
            <p className="font-medium">3. Watch their matches</p>
            <p className="mt-1 text-sm text-muted">
              See the team&apos;s matches from the whole season. Press Auton or Driver to jump straight to that part of
              the match.
            </p>
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-semibold">
          Upcoming and ongoing V5RC events
        </h2>
        <Suspense fallback={<p className="text-sm text-muted">Loading upcoming events</p>}>
          <UpcomingList />
        </Suspense>
      </section>
    </div>
  );
}

async function loadUpcoming(): Promise<{ events: EventSummary[]; today: string } | { error: string }> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const seasonId = await getCurrentSeasonId(PROGRAM_V5RC, today);
    if (!seasonId) return { error: "No current V5RC season was found." };
    return { events: await getUpcomingEvents(seasonId, today), today };
  } catch {
    return { error: "Upcoming events could not be loaded right now. You can still paste an event link above." };
  }
}

async function UpcomingList() {
  await connection();
  const result = await loadUpcoming();
  if ("error" in result) {
    return (
      <p role="alert" className="text-sm text-muted">
        {result.error}
      </p>
    );
  }
  return <UpcomingEvents events={result.events} today={result.today} />;
}
