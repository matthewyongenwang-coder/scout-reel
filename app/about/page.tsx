import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About",
  description: "How Scout Reel finds match videos, where its data comes from, and what it stores.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-muted">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <article className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">About Scout Reel</h1>
        <p className="text-muted">
          Scout Reel helps VEX V5 teams scout other teams before an event. Pick the event you are going to, pick a
          team, and watch how that team drives and runs autonomous across the season, without digging through
          livestreams.
        </p>
      </div>

      <Section title="How to use it">
        <ol className="list-decimal space-y-1 pl-5">
          <li>On the home page, paste the event link or SKU from events.vex.com, or pick it from the upcoming list.</li>
          <li>On the event page, pick the team you want to scout.</li>
          <li>On the team page, press Auton or Driver on any match. If the match has a clip, it plays straight away.</li>
          <li>
            If there is no clip, paste that event&apos;s YouTube livestream link, play the video to the moment any match
            starts, and press Set start here on that match. Every other match on that stream then lines up.
          </li>
        </ol>
      </Section>

      <Section title="Where the videos come from">
        <p>
          Match clips come from the Robot Stats YouTube channel, which posts a clip for most matches at Signature
          events. Scout Reel only uses a clip when its event, match number, teams, and score all agree with the
          official results.
        </p>
        <p>
          Other events are watched through their own livestreams, which you paste in. Every video plays through
          YouTube&apos;s own player in privacy-enhanced mode and belongs to its owner.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Events, teams, matches, and scores come from the official VEX Events API. Match clock times are not shown
          because the API records every match in US Eastern time, whatever the event&apos;s real timezone.
        </p>
      </Section>

      <Section title="What is stored">
        <p>
          Nothing about you is stored on a server. When you sync a livestream, the video link and its start time are
          saved only in your own browser, so the sync is still there next time you open that event on the same device.
        </p>
      </Section>

      <Section title="Not affiliated">
        <p>
          Scout Reel is a community project. It is not affiliated with or endorsed by VEX Robotics, the REC Foundation,
          Robot Stats, or YouTube.
        </p>
        <p>
          The code is open source on{" "}
          <a href="https://github.com/matthewyongenwang-coder/scout-reel" className="text-accent hover:underline">
            GitHub
          </a>
          . Found a bug or a wrong clip? Open an issue there.
        </p>
      </Section>

      <Link href="/" className="text-sm text-accent hover:underline">
        Back to event search
      </Link>
    </article>
  );
}
