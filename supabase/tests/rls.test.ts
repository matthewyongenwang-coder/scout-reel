/**
 * Row level security tests. They run the real migration on PGlite (Postgres compiled to
 * WebAssembly) inside a small copy of Supabase's setup: the anon and authenticated roles,
 * Supabase's default grants, auth.users and auth.uid(). No Docker or live project needed.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  new URL("../migrations/20260914120000_accounts_and_scouting.sql", import.meta.url),
  "utf8",
);

// Mirrors what a new Supabase project already has before any migration runs.
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create extension pgcrypto schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth, extensions, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const OWNER_A = "00000000-0000-4000-8000-00000000000a";
const MEMBER_A = "00000000-0000-4000-8000-0000000000aa";
const OWNER_B = "00000000-0000-4000-8000-00000000000b";
const OUTSIDER = "00000000-0000-4000-8000-00000000000c";

const TABLES = ["workspaces", "memberships", "join_attempts", "scouting_reports", "report_revisions"];

type Ctx = { db: PGlite; wsA: string; codeA: string; wsB: string; codeB: string };

async function setup(): Promise<Ctx> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_SHIM);
  await db.exec(MIGRATION);
  await db.query(
    `insert into auth.users (id, email) values
      ($1, 'owner.a@example.com'), ($2, 'member.a@school.example'), ($3, 'owner.b@example.com'), ($4, 'outsider@example.com')`,
    [OWNER_A, MEMBER_A, OWNER_B, OUTSIDER],
  );
  const ctx = { db } as Ctx;
  await as(db, OWNER_A);
  ({ workspace_id: ctx.wsA, invite_code: ctx.codeA } = await one(db, "select * from public.create_workspace('Ctrl Z', '96Z')"));
  await as(db, OWNER_B);
  ({ workspace_id: ctx.wsB, invite_code: ctx.codeB } = await one(db, "select * from public.create_workspace('Other team', '1698V')"));
  await as(db, MEMBER_A);
  await db.query("select * from public.join_workspace($1)", [ctx.codeA]);
  await db.query(
    "select public.save_scouting_report($1, 141836, 204, '96Z', 7::smallint, 6::smallint, 8::smallint, 5::smallint, 'Fast cycles')",
    [ctx.wsA],
  );
  await admin(db);
  return ctx;
}

async function admin(db: PGlite) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
}

async function as(db: PGlite, user: string | null) {
  await admin(db);
  if (user === null) {
    await db.exec("set role anon");
    return;
  }
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, role: "authenticated" })]);
  await db.exec("set role authenticated");
}

async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function one<T = Record<string, string>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const result = await rows<T>(db, sql, params);
  if (result.length !== 1) throw new Error(`Expected one row, got ${result.length}`);
  return result[0];
}

async function affected(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query(sql, params)).affectedRows ?? 0;
}

describe("anonymous visitors", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
    await as(ctx.db, null);
  });

  it.each(TABLES)("cannot read %s", async (table) => {
    await expect(ctx.db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
  });

  it.each(TABLES)("cannot insert into %s", async (table) => {
    await expect(ctx.db.query(`insert into public.${table} default values`)).rejects.toThrow(/permission denied/);
  });

  it.each([
    ["select * from public.create_workspace('x', null)"],
    ["select * from public.join_workspace('00000000000000000000000000000000')"],
    ["select public.rotate_invite('00000000-0000-4000-8000-000000000000')"],
    ["select * from public.workspace_members('00000000-0000-4000-8000-000000000000')"],
    ["select public.delete_workspace('00000000-0000-4000-8000-000000000000')"],
    ["select public.delete_my_account()"],
    ["select public.save_scouting_report('00000000-0000-4000-8000-000000000000', 1, 1, '1A', null, null, null, null, '')"],
  ])("cannot call %s", async (sql) => {
    await expect(ctx.db.query(sql)).rejects.toThrow(/permission denied/);
  });
});

describe("grants", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
  });

  it("gives anon no table privileges at all", async () => {
    const found = await rows(
      ctx.db,
      `select c.relname, p.privilege from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         cross join (values ('select'), ('insert'), ('update'), ('delete')) p(privilege)
       where n.nspname in ('public', 'private') and c.relkind = 'r'
         and has_table_privilege('anon', c.oid, p.privilege)`,
    );
    expect(found).toEqual([]);
  });

  it("lets anon execute no app function", async () => {
    const found = await rows(
      ctx.db,
      `select p.proname from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')`,
    );
    expect(found).toEqual([]);
  });

  it("never lets clients touch join attempts", async () => {
    const found = await rows(
      ctx.db,
      `select p.privilege from (values ('select'), ('insert'), ('update'), ('delete')) p(privilege)
       where has_table_privilege('authenticated', 'public.join_attempts', p.privilege)`,
    );
    expect(found).toEqual([]);
  });
});

describe("another workspace", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
    await as(ctx.db, OWNER_B);
  });

  it("reads none of our reports, revisions, members or workspace", async () => {
    expect(await rows(ctx.db, "select * from public.scouting_reports where workspace_id = $1", [ctx.wsA])).toEqual([]);
    expect(await rows(ctx.db, "select * from public.report_revisions where workspace_id = $1", [ctx.wsA])).toEqual([]);
    expect(await rows(ctx.db, "select * from public.memberships where workspace_id = $1", [ctx.wsA])).toEqual([]);
    expect(await rows(ctx.db, "select id, name from public.workspaces where id = $1", [ctx.wsA])).toEqual([]);
  });

  it("sees only its own data when reading everything", async () => {
    const reports = await rows<{ workspace_id: string }>(ctx.db, "select workspace_id from public.scouting_reports");
    expect(reports.every((r) => r.workspace_id === ctx.wsB)).toBe(true);
    const workspaces = await rows<{ id: string }>(ctx.db, "select id from public.workspaces");
    expect(workspaces.map((w) => w.id)).toEqual([ctx.wsB]);
  });

  it("cannot write a report into our workspace", async () => {
    await expect(
      ctx.db.query("select public.save_scouting_report($1, 5, 204, '5A', 1::smallint, 1::smallint, 1::smallint, 1::smallint, 'x')", [
        ctx.wsA,
      ]),
    ).rejects.toThrow();
    await expect(
      ctx.db.query(
        "insert into public.scouting_reports (workspace_id, team_id, season_id, team_number) values ($1, 6, 204, '6A')",
        [ctx.wsA],
      ),
    ).rejects.toThrow();
  });

  it("changes and deletes nothing of ours", async () => {
    expect(await affected(ctx.db, "update public.scouting_reports set notes = 'hacked' where workspace_id = $1", [ctx.wsA])).toBe(0);
    expect(await affected(ctx.db, "delete from public.scouting_reports where workspace_id = $1", [ctx.wsA])).toBe(0);
    expect(await affected(ctx.db, "delete from public.memberships where workspace_id = $1", [ctx.wsA])).toBe(0);
    expect(await affected(ctx.db, "update public.workspaces set name = 'hacked' where id = $1", [ctx.wsA])).toBe(0);
    await admin(ctx.db);
    const report = await one(ctx.db, "select notes from public.scouting_reports where workspace_id = $1", [ctx.wsA]);
    expect(report.notes).toBe("Fast cycles");
    await as(ctx.db, OWNER_B);
  });

  it("cannot use our workspace's owner functions", async () => {
    await expect(ctx.db.query("select public.rotate_invite($1)", [ctx.wsA])).rejects.toThrow();
    await expect(ctx.db.query("select * from public.workspace_members($1)", [ctx.wsA])).rejects.toThrow();
    await expect(ctx.db.query("select public.delete_workspace($1)", [ctx.wsA])).rejects.toThrow();
  });
});

describe("members", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
    await as(ctx.db, MEMBER_A);
  });

  it("cannot make themselves an owner", async () => {
    await expect(ctx.db.query("update public.memberships set role = 'owner' where user_id = $1", [MEMBER_A])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("cannot add memberships directly", async () => {
    await expect(
      ctx.db.query("insert into public.memberships (workspace_id, user_id, role) values ($1, $2, 'owner')", [ctx.wsB, MEMBER_A]),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot rotate the invite, delete the workspace, or remove the owner", async () => {
    await expect(ctx.db.query("select public.rotate_invite($1)", [ctx.wsA])).rejects.toThrow();
    await expect(ctx.db.query("select public.delete_workspace($1)", [ctx.wsA])).rejects.toThrow();
    expect(await affected(ctx.db, "delete from public.memberships where user_id = $1", [OWNER_A])).toBe(0);
  });

  it("cannot read the invite hash but can read the workspace name", async () => {
    await expect(ctx.db.query("select invite_token_hash from public.workspaces")).rejects.toThrow(/permission denied/);
    expect(await rows(ctx.db, "select name, team_label from public.workspaces")).toEqual([{ name: "Ctrl Z", team_label: "96Z" }]);
  });

  it("cannot rename the workspace", async () => {
    expect(await affected(ctx.db, "update public.workspaces set name = 'Renamed' where id = $1", [ctx.wsA])).toBe(0);
  });

  it("sees teammates without their emails", async () => {
    const members = await rows<{ user_id: string; role: string; label: string }>(
      ctx.db,
      "select user_id, role, label from public.workspace_members($1)",
      [ctx.wsA],
    );
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.user_id === MEMBER_A)?.label).toBe("You");
    expect(members.find((m) => m.user_id === OWNER_A)?.label).toBe("Teammate");
    expect(members.some((m) => m.label.includes("@"))).toBe(false);
  });

  it("can leave the workspace", async () => {
    expect(await affected(ctx.db, "delete from public.memberships where user_id = $1 and workspace_id = $2", [MEMBER_A, ctx.wsA])).toBe(1);
    expect(await rows(ctx.db, "select * from public.scouting_reports")).toEqual([]);
  });
});

describe("owners", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
    await as(ctx.db, OWNER_A);
  });

  it("see a masked email for each member, never the full address", async () => {
    const members = await rows<{ user_id: string; label: string }>(ctx.db, "select user_id, label from public.workspace_members($1)", [
      ctx.wsA,
    ]);
    expect(members.find((m) => m.user_id === OWNER_A)?.label).toBe("You");
    const member = members.find((m) => m.user_id === MEMBER_A)?.label ?? "";
    expect(member).toBe("me...@school.example");
    expect(member).not.toContain("member.a");
  });

  it("can rename the workspace but not change its invite hash", async () => {
    expect(await affected(ctx.db, "update public.workspaces set name = 'Ctrl Z 96Z' where id = $1", [ctx.wsA])).toBe(1);
    await expect(ctx.db.query("update public.workspaces set invite_token_hash = '\\x00' where id = $1", [ctx.wsA])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("can remove a member but not themselves", async () => {
    expect(await affected(ctx.db, "delete from public.memberships where user_id = $1 and workspace_id = $2", [OWNER_A, ctx.wsA])).toBe(0);
    expect(await affected(ctx.db, "delete from public.memberships where user_id = $1 and workspace_id = $2", [MEMBER_A, ctx.wsA])).toBe(1);
  });

  it("can create at most 5 workspaces", async () => {
    for (let i = 0; i < 4; i++) await ctx.db.query("select * from public.create_workspace($1, null)", [`Extra ${i}`]);
    await expect(ctx.db.query("select * from public.create_workspace('One too many', null)")).rejects.toThrow(/5 workspaces/);
  });

  it.each([[""], ["x".repeat(61)], ["bad\nname"], ["   "]])("cannot create a workspace named %j", async (name) => {
    await expect(ctx.db.query("select * from public.create_workspace($1, null)", [name])).rejects.toThrow();
  });
});

describe("joining", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
  });

  it("makes a 128-bit code and stores only its hash", async () => {
    expect(ctx.codeA).toMatch(/^[0-9a-f]{32}$/);
    expect(ctx.codeA).not.toBe(ctx.codeB);
    await admin(ctx.db);
    const stored = await one<{ hash: string }>(ctx.db, "select encode(invite_token_hash, 'hex') as hash from public.workspaces where id = $1", [
      ctx.wsA,
    ]);
    expect(stored.hash).not.toContain(ctx.codeA);
    expect(stored.hash).toHaveLength(64);
  });

  it("always joins as a member, accepting spaces, dashes and capitals in the code", async () => {
    await as(ctx.db, OUTSIDER);
    const result = await one(ctx.db, "select * from public.join_workspace($1)", [ctx.codeB.toUpperCase().replace(/(.{4})/g, "$1-")]);
    expect(result).toEqual({ status: "joined", workspace_id: ctx.wsB });
    expect(await rows(ctx.db, "select role from public.memberships where user_id = $1 and workspace_id = $2", [OUTSIDER, ctx.wsB])).toEqual([
      { role: "member" },
    ]);
  });

  it("leaves an owner as owner when they use their own code", async () => {
    await as(ctx.db, OWNER_A);
    expect(await one(ctx.db, "select * from public.join_workspace($1)", [ctx.codeA])).toEqual({ status: "already_member", workspace_id: ctx.wsA });
    expect(await rows(ctx.db, "select role from public.memberships where user_id = $1 and workspace_id = $2", [OWNER_A, ctx.wsA])).toEqual([
      { role: "owner" },
    ]);
  });

  it("rejects a wrong code and remembers the attempt", async () => {
    await as(ctx.db, OWNER_B);
    expect(await one(ctx.db, "select * from public.join_workspace('ffffffffffffffffffffffffffffffff')")).toEqual({
      status: "invalid",
      workspace_id: null,
    });
    await admin(ctx.db);
    expect(await rows(ctx.db, "select success from public.join_attempts where user_id = $1", [OWNER_B])).toEqual([{ success: false }]);
  });

  it("refuses even a right code after 5 wrong ones in 10 minutes", async () => {
    await as(ctx.db, OWNER_B);
    for (let i = 0; i < 4; i++) await ctx.db.query("select * from public.join_workspace('not-a-code')");
    expect(await one(ctx.db, "select * from public.join_workspace($1)", [ctx.codeA])).toEqual({ status: "rate_limited", workspace_id: null });
  });

  it("keeps letting other people join while one account is rate limited", async () => {
    // OWNER_B is rate limited by now; others still get a normal answer.
    await as(ctx.db, OUTSIDER);
    expect((await one(ctx.db, "select * from public.join_workspace($1)", [ctx.codeB])).status).toBe("already_member");
    await as(ctx.db, MEMBER_A);
    expect((await one(ctx.db, "select * from public.join_workspace($1)", [ctx.codeB])).status).toBe("joined");
  });

  it("clears attempts older than two days", async () => {
    await admin(ctx.db);
    await ctx.db.query("insert into public.join_attempts (user_id, success, attempted_at) values ($1, false, now() - interval '3 days')", [
      OWNER_B,
    ]);
    await as(ctx.db, OWNER_A);
    await ctx.db.query("select * from public.join_workspace($1)", [ctx.codeA]);
    await admin(ctx.db);
    expect(await rows(ctx.db, "select id from public.join_attempts where attempted_at < now() - interval '2 days'")).toEqual([]);
  });

  it("stops the old code working after rotation", async () => {
    await as(ctx.db, OWNER_A);
    const { rotate_invite: fresh } = await one<{ rotate_invite: string }>(ctx.db, "select public.rotate_invite($1)", [ctx.wsA]);
    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    await as(ctx.db, OUTSIDER);
    expect((await one(ctx.db, "select * from public.join_workspace($1)", [ctx.codeA])).status).toBe("invalid");
    expect((await one(ctx.db, "select * from public.join_workspace($1)", [fresh])).status).toBe("joined");
  });
});

describe("scouting reports", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
    // The member also joins workspace B, to try moving a report between workspaces.
    await as(ctx.db, MEMBER_A);
    await ctx.db.query("select * from public.join_workspace($1)", [ctx.codeB]);
  });

  it("records who saved it, whatever the client sends", async () => {
    await as(ctx.db, MEMBER_A);
    const report = await one(ctx.db, "select updated_by, driving, notes from public.scouting_reports where workspace_id = $1", [ctx.wsA]);
    expect(report).toEqual({ updated_by: MEMBER_A, driving: 7, notes: "Fast cycles" });
    await expect(ctx.db.query("update public.scouting_reports set updated_by = $1", [OWNER_A])).rejects.toThrow(/permission denied/);
  });

  it("keeps a revision for every save, written by the database only", async () => {
    await as(ctx.db, OWNER_A);
    await ctx.db.query(
      "select public.save_scouting_report($1, 141836, 204, '96Z', 9::smallint, 6::smallint, 8::smallint, 5::smallint, 'Even faster')",
      [ctx.wsA],
    );
    const revisions = await rows(
      ctx.db,
      "select author_id, driving, notes from public.report_revisions where workspace_id = $1 order by id",
      [ctx.wsA],
    );
    expect(revisions).toEqual([
      { author_id: MEMBER_A, driving: 7, notes: "Fast cycles" },
      { author_id: OWNER_A, driving: 9, notes: "Even faster" },
    ]);
    const report = await one(ctx.db, "select updated_by, driving from public.scouting_reports where workspace_id = $1", [ctx.wsA]);
    expect(report).toEqual({ updated_by: OWNER_A, driving: 9 });
    await expect(
      ctx.db.query("insert into public.report_revisions (report_id, workspace_id, author_id) select id, workspace_id, $1 from public.scouting_reports", [
        OWNER_A,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(ctx.db.query("update public.report_revisions set notes = 'rewritten'")).rejects.toThrow(/permission denied/);
    await expect(ctx.db.query("delete from public.report_revisions")).rejects.toThrow(/permission denied/);
  });

  it("cannot be moved to another workspace or another team", async () => {
    await as(ctx.db, MEMBER_A);
    await expect(ctx.db.query("update public.scouting_reports set workspace_id = $1", [ctx.wsB])).rejects.toThrow(/permission denied/);
    await expect(ctx.db.query("update public.scouting_reports set team_id = 1")).rejects.toThrow(/permission denied/);
  });

  it.each([
    ["a rating of 11", "11::smallint", "'ok'"],
    ["a rating of 0", "0::smallint", "'ok'"],
    ["notes over 4000 characters", "5::smallint", `'${"x".repeat(4001)}'`],
  ])("rejects %s", async (_, rating, notes) => {
    await as(ctx.db, MEMBER_A);
    await expect(
      ctx.db.query(
        `select public.save_scouting_report($1, 7, 204, '7A', ${rating}, null::smallint, null::smallint, null::smallint, ${notes})`,
        [ctx.wsA],
      ),
    ).rejects.toThrow();
  });

  it("stores markup in notes as plain text", async () => {
    await as(ctx.db, MEMBER_A);
    const notes = "<script>alert(1)</script> javascript:alert(1)";
    await ctx.db.query(
      "select public.save_scouting_report($1, 8, 204, '8A', null::smallint, null::smallint, null::smallint, null::smallint, $2)",
      [ctx.wsA, notes],
    );
    expect(await one(ctx.db, "select notes from public.scouting_reports where team_id = 8")).toEqual({ notes });
  });

  it("stops new cards at 3000 per workspace but still lets existing cards be edited", async () => {
    await admin(ctx.db);
    await ctx.db.query(
      `insert into public.scouting_reports (workspace_id, team_id, season_id, team_number)
       select $1, 1000000 + n, 204, 'T' || n from generate_series(1, 3000 - (select count(*) from public.scouting_reports where workspace_id = $1)::int) n`,
      [ctx.wsA],
    );
    await as(ctx.db, MEMBER_A);
    await expect(
      ctx.db.query("select public.save_scouting_report($1, 9999999, 204, '9Z', 5::smallint, null::smallint, null::smallint, null::smallint, 'new')", [
        ctx.wsA,
      ]),
    ).rejects.toThrow(/3000 scouting cards/);
    await ctx.db.query(
      "select public.save_scouting_report($1, 141836, 204, '96Z', 8::smallint, null::smallint, null::smallint, null::smallint, 'still editable')",
      [ctx.wsA],
    );
    expect(await one(ctx.db, "select notes from public.scouting_reports where workspace_id = $1 and team_id = 141836", [ctx.wsA])).toEqual({
      notes: "still editable",
    });
    await admin(ctx.db);
    await ctx.db.query("delete from public.scouting_reports where workspace_id = $1 and team_id > 1000000", [ctx.wsA]);
  });

  it("can be deleted by the owner but not by a member", async () => {
    await as(ctx.db, MEMBER_A);
    expect(await affected(ctx.db, "delete from public.scouting_reports where workspace_id = $1", [ctx.wsA])).toBe(0);
    await as(ctx.db, OWNER_A);
    expect(await affected(ctx.db, "delete from public.scouting_reports where workspace_id = $1 and team_id = 141836", [ctx.wsA])).toBe(1);
  });
});

describe("deleting", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
  });

  it("will not delete the account of someone who still owns a workspace", async () => {
    await as(ctx.db, OWNER_A);
    expect(await one(ctx.db, "select public.delete_my_account() as status")).toEqual({ status: "owns_workspace" });
  });

  it("deletes a member's account and memberships", async () => {
    await as(ctx.db, MEMBER_A);
    expect(await one(ctx.db, "select public.delete_my_account() as status")).toEqual({ status: "deleted" });
    await admin(ctx.db);
    expect(await rows(ctx.db, "select id from auth.users where id = $1", [MEMBER_A])).toEqual([]);
    expect(await rows(ctx.db, "select * from public.memberships where user_id = $1", [MEMBER_A])).toEqual([]);
  });

  it("lets an owner delete the workspace with everything in it", async () => {
    await as(ctx.db, OWNER_A);
    await ctx.db.query("select public.delete_workspace($1)", [ctx.wsA]);
    await admin(ctx.db);
    expect(await rows(ctx.db, "select id from public.workspaces where id = $1", [ctx.wsA])).toEqual([]);
    expect(await rows(ctx.db, "select id from public.scouting_reports where workspace_id = $1", [ctx.wsA])).toEqual([]);
    expect(await rows(ctx.db, "select id from public.report_revisions where workspace_id = $1", [ctx.wsA])).toEqual([]);
    await as(ctx.db, OWNER_A);
    expect(await one(ctx.db, "select public.delete_my_account() as status")).toEqual({ status: "deleted" });
  });
});
