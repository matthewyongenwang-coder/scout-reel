# Scout Reel

An open-source scouting app for VEX V5 Robotics Competition teams.

Pick the event you are going to, pick a team that is attending, and watch that team's auton and driver clips from every event they have played this season. Keep private scouting notes for your own team next to the video.

Built by Matthew Wang, strategist for team 96Z.

> Status: early development. Not yet deployed.

## Why

Scouting teams before a Signature Event or a big tournament means hunting through many livestreams on different channels, scrubbing for the right match, and keeping notes in a separate doc. Scout Reel does the finding and the organizing so you can spend the time actually watching.

## How it works

1. Paste an events.vex.com link or event SKU, or pick an upcoming event from the list.
2. Search the teams attending that event.
3. Open a team. Scout Reel loads their matches from every event this season and lines each match up with the event's livestream using the match start time and the stream start time.
4. Jump straight to the Auton or Driver part of any match.
5. Rate the team out of 10 on Driving, Consistency, Field Sense, and Autonomous, and write notes. Notes are private to your team's workspace.

If a clip lands at the wrong moment, anyone signed in can mark where the match actually starts. That correction fixes every match on the same stream for everyone.

## Tech

- Next.js (App Router), TypeScript, Tailwind CSS
- Supabase for sign-in, the database, and row level security
- VEX Events API v2 through the [`events.vex`](https://github.com/Jerrylum/events.vex) client
- YouTube Data API v3 for stream start times
- Vitest and Playwright for tests

## Run it locally

```bash
git clone https://github.com/matthewyongenwang-coder/scout-reel.git
cd scout-reel
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

You need:

- A VEX Events API key: https://events.vex.com/api/v2/accessRequest/create
- A YouTube Data API v3 key from the Google Cloud Console
- A Supabase project (free tier is fine)

Checks:

```bash
npm run lint
npm run typecheck
npm test
```

## Credits

The idea of lining up match start times with livestream start times comes from [VEX Match Jumper](https://github.com/axcdeng/Live-viewer) (jumper.robostem.org). Scout Reel is a separate, from-scratch codebase built around scouting a team across a whole season.

## Not affiliated

Scout Reel is a community project. It is not affiliated with or endorsed by VEX Robotics, the REC Foundation, or YouTube. Videos play through the official YouTube embed and belong to their owners.

## License

MIT. See [LICENSE](LICENSE).
