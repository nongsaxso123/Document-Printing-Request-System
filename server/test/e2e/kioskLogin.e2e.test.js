/**
 * DEV-01 through the REAL sign-in code: starts src/app.js with Google's
 * OAuth strategy replaced by a stand-in (test/e2e/fakeGoogleApp.js), then
 * signs in exactly as a browser would: /auth/google -> /auth/google/callback
 * -> pages, carrying the session cookie the app hands out.
 *
 * Skipped unless E2E_DATABASE_URL is set (local/throwaway database only).
 *   E2E_DATABASE_URL=postgresql://odprs:odprs@localhost:5434/odprs npm run test:e2e
 */

require("dotenv").config({ path: require("node:path").join(__dirname, "..", "..", ".env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

const DB_URL = process.env.E2E_DATABASE_URL;
const SAFE = DB_URL && /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);
const skip = !DB_URL ? "E2E_DATABASE_URL not set" : !SAFE ? "E2E_DATABASE_URL must point at localhost" : false;

const PORT = 3007;
const BASE = "http://localhost:" + PORT;
const OFFICER = "e2e-kioskflow@mfu.ac.th";
let child, pool;

// A tiny browser: follows nothing by itself, keeps the session cookie.
function browser() {
  let jar = "";
  return async function go(p, method = "GET") {
    const r = await fetch(BASE + p, { method, redirect: "manual", headers: { Cookie: jar, "Sec-Fetch-Site": "same-origin" } });
    for (const c of r.headers.getSetCookie()) {
      const v = c.split(";")[0];
      if (v.startsWith("connect.sid=")) jar = /Expires=Thu, 01 Jan 1970/.test(c) ? "" : v;
    }
    // Read the whole response, as a browser does: express-session finishes
    // saving the session before the last byte, not before the headers.
    await r.arrayBuffer();
    return { status: r.status, location: r.headers.get("location") };
  };
}

async function signIn(go, returnTo) {
  const a = await go("/auth/google" + (returnTo ? "?returnTo=" + returnTo : ""));
  assert.equal(a.location, "/auth/google/callback");
  return go("/auth/google/callback");
}

test.before(async () => {
  if (skip) return;
  const { Pool } = require("pg");
  pool = new Pool({ connectionString: DB_URL });
  await pool.query("INSERT INTO officers (officer_email, officer_name, assigned_by) VALUES ($1, 'E2E kiosk flow', 'e2e-test') ON CONFLICT DO NOTHING", [OFFICER]);
  child = spawn(process.execPath, [path.join(__dirname, "fakeGoogleApp.js")], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: DB_URL, FAKE_GOOGLE_EMAIL: OFFICER, NODE_ENV: "test" },
    stdio: "ignore"
  });
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + "/privacy"); return; } catch (e) { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error("app did not start");
});

test.after(async () => {
  if (skip) return;
  if (child) child.kill();
  await pool.query("DELETE FROM officers WHERE officer_email = $1", [OFFICER]);
  await pool.query(`DELETE FROM "session" WHERE sess->'passport'->'user'->>'email' = $1`, [OFFICER]);
  await pool.end();
});

test("DEV-01 real sign-in from the kiosk's own button: locked to /kiosk", { skip }, async () => {
  const go = browser();
  const cb = await signIn(go, "/kiosk");
  assert.equal(cb.location, "/kiosk");
  assert.equal((await go("/kiosk")).status, 200);
  for (const p of ["/officer/queue", "/admin/officers", "/"]) assert.equal((await go(p)).location, "/kiosk", p);
  assert.equal((await go("/api/requests/awaiting")).status, 403);
});

test("DEV-01 officer signed in normally, THEN opens /kiosk: that browser is locked too", { skip }, async () => {
  const go = browser();
  const cb = await signIn(go, null);
  assert.equal(cb.location, "/");
  assert.equal((await go("/officer/queue")).status, 200, "normal sign-in reaches the queue");
  assert.equal((await go("/kiosk")).status, 200);
  for (const p of ["/officer/queue", "/officer/history", "/admin/officers", "/profile"]) assert.equal((await go(p)).location, "/kiosk", p);
  assert.equal((await go("/api/requests/awaiting")).status, 403);
  const { rows } = await pool.query("SELECT action FROM audit_log WHERE actor_email = $1 AND action = 'auth.kioskLock' ORDER BY id DESC LIMIT 1", [OFFICER]);
  assert.equal(rows.length, 1, "auth.kioskLock logged");
});

test("DEV-01 signing out of the kiosk and back in normally gives a normal session again", { skip }, async () => {
  const go = browser();
  await signIn(go, "/kiosk");
  assert.equal((await go("/officer/queue")).location, "/kiosk");
  const out = await go("/logout", "POST");
  assert.equal(out.location, "/");
  await signIn(go, null);
  assert.equal((await go("/officer/queue")).status, 200);
});
