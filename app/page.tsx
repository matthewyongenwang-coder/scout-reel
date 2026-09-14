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

      <section className="flex flex-col gap-3" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-semibold">
          Upcoming V5RC events
        </h2>
        <Suspense fallback={<p className="text-sm text-muted">Loading upcoming events</p>}>
          <UpcomingList />
        </Suspense>
      </section>
    </div>
  );
}

async function loadUpcoming(): Promise<{ events: EventSummary[] } | { error: string }> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const seasonId = await getCurrentSeasonId(PROGRAM_V5RC, today);
    if (!seasonId) return { error: "No current V5RC season was found." };
    return { events: await getUpcomingEvents(seasonId, today) };
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
  return <UpcomingEvents events={result.events} />;
}
