#!/usr/bin/env node
/**
 * Checks the real Supabase project from the outside, as an anonymous visitor.
 * Every table must return nothing or be refused, and every function must be refused.
 * Uses only the public anon key from .env.local and never prints it.
 *
 *   node scripts/check-rls-live.mjs
 */
import { readFileSync } from "node:fs";

function readEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Fall back to the process environment, for example in CI.
  }
  return env;
}

const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local first.");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const ZERO = "00000000-0000-4000-8000-000000000000";

const tables = ["workspaces", "memberships", "join_attempts", "scouting_reports", "report_revisions"];
const functions = {
  create_workspace: { p_name: "Probe", p_team_label: null },
  join_workspace: { p_code: "0".repeat(32) },
  rotate_invite: { p_workspace: ZERO },
  workspace_members: { p_workspace: ZERO },
  delete_workspace: { p_workspace: ZERO },
  delete_my_account: {},
  save_scouting_report: {
    p_workspace: ZERO,
    p_team_id: 1,
    p_season_id: 1,
    p_team_number: "1A",
    p_driving: null,
    p_consistency: null,
    p_field_sense: null,
    p_autonomous: null,
    p_notes: "",
  },
};

const refused = (status) => status === 401 || status === 403 || status === 404;
let failures = 0;

async function check(label, request, passes) {
  const response = await request();
  const body = await response.text();
  const ok = passes(response.status, body);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (HTTP ${response.status})`);
}

for (const table of tables) {
  await check(
    `anon cannot read ${table}`,
    () => fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers }),
    (status, body) => refused(status) || (status === 200 && body.trim() === "[]"),
  );
  await check(
    `anon cannot insert into ${table}`,
    () => fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: "{}" }),
    (status) => refused(status),
  );
}

for (const [name, args] of Object.entries(functions)) {
  await check(
    `anon cannot call ${name}`,
    () => fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(args) }),
    (status) => refused(status),
  );
}

await check(
  "private helper schema is not reachable",
  () => fetch(`${url}/rest/v1/rpc/is_member`, { method: "POST", headers, body: JSON.stringify({ p_workspace: ZERO }) }),
  (status) => refused(status),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
