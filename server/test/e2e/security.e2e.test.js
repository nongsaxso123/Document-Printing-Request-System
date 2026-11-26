/**
 * End-to-end security checks against a RUNNING app + its PostgreSQL
 * (document/security/2026-11-26_security-remediation-plan.md, DEV-01..DEV-09).
 * Real HTTP requests, real sessions in the "session" table, real Chromium PDFs.
 *
 * Google sign-in can't be scripted, so each test user's session is written
 * straight into the session table (exactly what express-session +
 * connect-pg-simple store after a real login) and the cookie is signed with
 * SESSION_SECRET. Everything after that goes through the normal app.
 *
 * Skipped unless E2E_BASE_URL is set. Needs a local/throwaway database only:
 * it adds 3 officer rows (e2e-*@mfu.ac.th) and removes them at the end.
 *
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_DATABASE_URL=postgresql://odprs:odprs@localhost:5434/odprs \
 *   npm run test:e2e
 *
 * Optional: E2E_CSP_URL=http://localhost:8081 (Caddy running Caddyfile.prod)
 * and CHROME_PATH=<local chrome> also load every page in headless Chrome
 * under the production CSP and fail on any CSP violation or console error.
 */

require("dotenv").config({ path: require("node:path").join(__dirname, "..", "..", ".env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const BASE = process.env.E2E_BASE_URL;
const DB_URL = process.env.E2E_DATABASE_URL;
const SAFE = DB_URL && /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);
const skip = !BASE ? "E2E_BASE_URL not set" : !SAFE ? "E2E_DATABASE_URL must point at localhost" : false;

const ADMIN = "e2e-admin@mfu.ac.th";
const OFFICER = "e2e-officer@mfu.ac.th";
const KIOSK = "e2e-kiosk@mfu.ac.th";
const REQUESTER = "e2e-requester@mfu.ac.th";
let startId = 0; // audit_log rows written by this run have a larger id
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

let pool;
const cookies = {};

// ---- helpers -------------------------------------------------------------------
async function makeSession(email, role, extra) {
  const sid = crypto.randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + EIGHT_HOURS);
  const sess = {
    cookie: { originalMaxAge: EIGHT_HOURS, expires: expires.toISOString(), secure: false, httpOnly: true, path: "/", sameSite: "lax" },
    passport: { user: { email, name: "E2E " + role, picture: null, isRealAllowedDomain: true, role } },
    loginAt: Date.now(),
    ...extra
  };
  await pool.query('INSERT INTO "session" (sid, sess, expire) VALUES ($1, $2, $3)', [sid, sess, expires]);
  const sig = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
  return { sid, cookie: "connect.sid=" + encodeURIComponent("s:" + sid + "." + sig) };
}

// Same-origin browser request by default (what the app's own pages send).
function get(path, cookie, headers) {
  return fetch(BASE + path, { redirect: "manual", headers: { "Sec-Fetch-Site": "same-origin", ...(cookie ? { Cookie: cookie } : {}), ...headers } });
}
function post(path, cookie, body, headers) {
  return fetch(BASE + path, {
    method: "POST", redirect: "manual",
    headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body || {})
  });
}
const loc = (res) => res.headers.get("location");
const sessionExists = async (sid) => (await pool.query('SELECT 1 FROM "session" WHERE sid = $1', [sid])).rowCount === 1;
const auditFor = async (email, action) => (await pool.query(
  "SELECT actor_email, action, entity_label, ip_address FROM audit_log WHERE actor_email = $1 AND action = $2 AND id > $3 ORDER BY id",
  [email, action, startId])).rows;

test.before(async () => {
  if (skip) return;
  const { Pool } = require("pg");
  pool = new Pool({ connectionString: DB_URL });
  startId = (await pool.query("SELECT COALESCE(MAX(id), 0) AS id FROM audit_log")).rows[0].id;
  for (const [email, isAdmin] of [[ADMIN, true], [OFFICER, false], [KIOSK, false]]) {
    await pool.query(
      "INSERT INTO officers (officer_email, officer_name, assigned_by, is_admin) VALUES ($1, $2, 'e2e-test', $3) ON CONFLICT (officer_email) DO UPDATE SET is_admin = EXCLUDED.is_admin",
      [email, "E2E " + email.split("@")[0], isAdmin]);
  }
  cookies.admin = await makeSession(ADMIN, "Admin");
  cookies.officer = await makeSession(OFFICER, "Officer");
  cookies.kiosk = await makeSession(KIOSK, "Officer", { kioskOnly: true });
  cookies.requester = await makeSession(REQUESTER, "Requester");
});

test.after(async () => {
  if (skip) return;
  await pool.query("DELETE FROM officers WHERE officer_email = ANY($1)", [[ADMIN, OFFICER, KIOSK]]);
  await pool.query(`DELETE FROM "session" WHERE sess->'passport'->'user'->>'email' LIKE 'e2e-%'`);
  await pool.end();
});

// ---- DEV-01 kiosk session ------------------------------------------------------------
test("DEV-01 kiosk sign-in: /kiosk works, every staff page and API is refused", { skip }, async () => {
  const k = cookies.kiosk.cookie;
  const page = await get("/kiosk", k);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /E2E Officer/); // signed-in (authorized) kiosk state

  const lookup = await get("/kiosk/lookup/000000", k);
  assert.equal(lookup.status, 200, "claim code lookup still works");

  for (const p of ["/officer/queue", "/officer/history", "/officer/dashboard", "/admin/officers", "/admin/access-log", "/requester/my-requests", "/profile", "/", "/auth/google"]) {
    const r = await get(p, k);
    assert.equal(r.status, 302, p);
    assert.equal(loc(r), "/kiosk", p);
  }
  for (const p of ["/api/requests/awaiting", "/api/admin/officers", "/api/reports/history.xlsx"]) {
    const r = await get(p, k);
    assert.equal(r.status, 403, p);
  }
  const add = await post("/api/admin/officers", k, { name: "x", email: "x@mfu.ac.th" });
  assert.equal(add.status, 403);
});

test("DEV-01 the same officer signed in normally (not via /kiosk) still reaches staff pages", { skip }, async () => {
  const r = await get("/officer/queue", cookies.officer.cookie);
  assert.equal(r.status, 200);
  const api = await get("/api/requests/awaiting", cookies.officer.cookie);
  assert.equal(api.status, 200);
});

// ---- DEV-02 PDF ------------------------------------------------------------------------------
test("DEV-02 PDF download works (real Chromium) for officer and requester pages", { skip }, async (t) => {
  const { rows } = await pool.query("SELECT request_reference_no AS ref FROM requests ORDER BY request_reference_no DESC LIMIT 1");
  assert.ok(rows.length, "needs at least one request in the database");
  const ref = rows[0].ref;
  const t0 = Date.now();
  const r = await get("/officer/request-form-view/pdf?ref=" + encodeURIComponent(ref), cookies.admin.cookie);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  const body = Buffer.from(await r.arrayBuffer());
  assert.equal(body.subarray(0, 4).toString(), "%PDF");
  t.diagnostic(`officer PDF ${ref}: ${body.length} bytes in ${Date.now() - t0} ms`);

  // Admin may open any requester page too: same PDF through the requester route.
  const r2 = await get("/requester/request-submitted/" + encodeURIComponent(ref) + "/pdf", cookies.admin.cookie);
  assert.equal(r2.status, 200);
  assert.equal(Buffer.from(await r2.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
});

test("DEV-02 5 PDFs requested at the same moment all succeed (queued, max 2 Chromiums)", { skip }, async (t) => {
  const { rows } = await pool.query("SELECT request_reference_no AS ref FROM requests ORDER BY request_reference_no DESC LIMIT 1");
  const s = await makeSession(ADMIN, "Admin"); // fresh account budget for this test
  const t0 = Date.now();
  const all = await Promise.all(Array.from({ length: 5 }, () =>
    get("/officer/request-form-view/pdf?ref=" + encodeURIComponent(rows[0].ref), s.cookie).then(async (r) => ({ status: r.status, head: Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString() }))));
  assert.deepEqual(all.map((x) => x.status), [200, 200, 200, 200, 200]);
  assert.ok(all.every((x) => x.head === "%PDF"));
  t.diagnostic(`5 parallel PDFs finished in ${Date.now() - t0} ms`);
});

test("DEV-02 more than 10 PDF requests a minute from one account get HTTP 429", { skip }, async () => {
  const c = cookies.requester.cookie;
  const statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await get("/requester/request-submitted/REQ-NOPE-" + i + "/pdf", c)).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(404));
  assert.equal(statuses[10], 429);
});

// ---- DEV-07 session lifecycle ---------------------------------------------------------------------
test("DEV-07 session cookie has an 8-hour Max-Age / Expires", { skip }, async () => {
  const r = await get("/auth/google?returnTo=/kiosk", null);
  assert.equal(r.status, 302); // off to Google
  const setCookie = r.headers.get("set-cookie") || "";
  assert.match(setCookie, /connect\.sid=/);
  const exp = /Expires=([^;]+)/i.exec(setCookie);
  assert.ok(exp, "cookie must carry an expiry: " + setCookie);
  const ms = new Date(exp[1]).getTime() - Date.now();
  assert.ok(ms > EIGHT_HOURS - 60000 && ms <= EIGHT_HOURS + 1000, "expiry about 8 h away, got " + ms);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
});

test("DEV-07 logout deletes the session row and clears the cookie; the old cookie no longer works", { skip }, async () => {
  const s = await makeSession(OFFICER, "Officer");
  assert.equal(await sessionExists(s.sid), true);
  const r = await post("/logout", s.cookie, "", { "Content-Type": "application/x-www-form-urlencoded" });
  assert.equal(r.status, 302);
  assert.equal(loc(r), "/");
  const setCookie = r.headers.get("set-cookie") || "";
  assert.match(setCookie, /connect\.sid=;/);
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970/);
  assert.equal(await sessionExists(s.sid), false, "session row must be gone");
  const replay = await get("/officer/queue", s.cookie);
  assert.equal(replay.status, 302);
  assert.equal(loc(replay), "/");
});

test("DEV-07 GET /logout (old links) also destroys the session; a cross-site one is refused", { skip }, async () => {
  const s = await makeSession(OFFICER, "Officer");
  const cross = await get("/logout", s.cookie, { "Sec-Fetch-Site": "cross-site" });
  assert.equal(cross.status, 403);
  assert.equal(await sessionExists(s.sid), true);
  const r = await get("/logout", s.cookie);
  assert.equal(r.status, 302);
  assert.equal(await sessionExists(s.sid), false);
});

// ---- DEV-08 validation + error handler -------------------------------------------------------------
test("DEV-08 adding an officer with an email outside the domain via the API directly gets 400", { skip }, async () => {
  for (const email of ["hacker@gmail.com", "not-an-email", "x@mfu.ac.th.evil.com"]) {
    const r = await post("/api/admin/officers", cookies.admin.cookie, { name: "X", email });
    assert.equal(r.status, 400, email);
    assert.deepEqual(await r.json(), { error: "email-invalid" });
  }
  const { rowCount } = await pool.query("SELECT 1 FROM officers WHERE officer_email = ANY($1)", [["hacker@gmail.com", "not-an-email", "x@mfu.ac.th.evil.com"]]);
  assert.equal(rowCount, 0);
});

test("DEV-08 a location map link that is not http/https via the API directly gets 400", { skip }, async () => {
  const body = { nameTh: "E2E", nameEn: "E2E", detailTh: "x", detailEn: "x", phone: "1", acceptsDropoff: true, hoursFromDay: "1", hoursToDay: "5", hoursOpen: "08:30", hoursClose: "16:30" };
  for (const mapUrl of ["javascript:alert(document.cookie)", "data:text/html,<script>alert(1)</script>"]) {
    const r = await post("/api/admin/locations", cookies.admin.cookie, { ...body, mapUrl });
    assert.equal(r.status, 400, mapUrl);
    assert.equal((await r.json()).error, "map-url-invalid");
  }
});

test("DEV-08 errors return a short message, never a stack trace", { skip }, async () => {
  const r = await post("/api/admin/officers", cookies.admin.cookie, "{not json");
  assert.equal(r.status, 400);
  const text = await r.text();
  assert.deepEqual(JSON.parse(text), { error: "bad-request" });
  assert.doesNotMatch(text, /at |node_modules|SyntaxError/);
});

test("DEV-08 every page loads under the production CSP with no violations or console errors", { skip: skip || (!process.env.E2E_CSP_URL ? "E2E_CSP_URL not set" : false) }, async (t) => {
  const CSP_BASE = process.env.E2E_CSP_URL;
  const head = await fetch(CSP_BASE + "/");
  const csp = head.headers.get("content-security-policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  t.diagnostic("CSP header: " + csp);

  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const problems = [];
  try {
    const value = decodeURIComponent(cookies.admin.cookie.split("=")[1]);
    await browser.setCookie({ name: "connect.sid", value, domain: "localhost", path: "/", httpOnly: true });
    const { rows: [latest] } = await pool.query("SELECT request_reference_no AS ref FROM requests ORDER BY request_reference_no DESC LIMIT 1");
    const ref = encodeURIComponent(latest.ref);
    // Every page route in src/routes/*.js and app.js. /kiosk is checked last
    // with its own session, because opening it locks a session to the kiosk.
    const pages = ["/privacy", "/profile",
      "/officer/queue", "/officer/request-detail?from=queue&ref=" + ref, "/officer/printing-jobs", "/officer/counter-handover",
      "/officer/history", "/officer/dashboard", "/officer/evaluations", "/officer/request-form-view?ref=" + ref,
      "/requester/my-requests", "/requester/new-request", "/requester/request-submitted/" + ref, "/requester/request-submitted/" + ref + "/edit",
      "/admin/officers", "/admin/settings", "/admin/locations", "/admin/audit-log", "/admin/access-log", "/admin/units",
      "/admin/evaluation-form", "/admin/evaluation-form/preview", "/admin/manuals", "/admin/contact-info"];
    for (const p of pages) {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        document.addEventListener("securitypolicyviolation", (e) => console.error("CSP violation: " + e.violatedDirective + " " + e.blockedURI));
      });
      // "Failed to load resource" console lines are checked by URL below instead.
      page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) problems.push(p + " :: " + m.text()); });
      // The app has never had a favicon; the browser's automatic /favicon.ico
      // request is not a CSP problem.
      page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico") && r.url() !== CSP_BASE + p) problems.push(p + " :: HTTP " + r.status() + " " + r.url()); });
      page.on("pageerror", (e) => problems.push(p + " :: " + e.message));
      const r = await page.goto(CSP_BASE + p, { waitUntil: "networkidle0", timeout: 30000 });
      if (r.status() >= 400 && r.status() !== 404) problems.push(p + " :: HTTP " + r.status());
      if (r.status() === 404) t.diagnostic("not a page here (skipped): " + p);
      await page.close();
    }
    // The kiosk page, in its own browser context with its own officer session.
    const kioskCtx = await browser.createBrowserContext();
    const kioskSession = await makeSession(OFFICER, "Officer");
    await kioskCtx.setCookie({ name: "connect.sid", value: decodeURIComponent(kioskSession.cookie.split("=")[1]), domain: "localhost", path: "/", httpOnly: true });
    const kiosk = await kioskCtx.newPage();
    kiosk.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) problems.push("/kiosk :: " + m.text()); });
    kiosk.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) problems.push("/kiosk :: HTTP " + r.status() + " " + r.url()); });
    await kiosk.goto(CSP_BASE + "/kiosk", { waitUntil: "networkidle0" });
    await kioskCtx.close();
    // The evaluation form only opens for the requester who owns a completed,
    // not yet evaluated request, so it gets that requester's own session.
    const { rows: [ev] } = await pool.query(`SELECT r.request_reference_no AS ref, r.requester_email AS email FROM requests r
      LEFT JOIN evaluations e ON e.request_reference_no = r.request_reference_no
      WHERE r.status = 'COMPLETED' AND e.id IS NULL ORDER BY r.completed_timestamp DESC NULLS LAST LIMIT 1`);
    if (ev) {
      const evSession = await makeSession(ev.email, "Requester");
      const evCtx = await browser.createBrowserContext();
      await evCtx.setCookie({ name: "connect.sid", value: decodeURIComponent(evSession.cookie.split("=")[1]), domain: "localhost", path: "/", httpOnly: true });
      const evPage = await evCtx.newPage();
      evPage.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) problems.push("/requester/evaluate :: " + m.text()); });
      evPage.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) problems.push("/requester/evaluate :: HTTP " + r.status() + " " + r.url()); });
      await evPage.goto(CSP_BASE + "/requester/evaluate/" + encodeURIComponent(ev.ref), { waitUntil: "networkidle0" });
      t.diagnostic("evaluation page: ended on " + new URL(evPage.url()).pathname);
      await evCtx.close();
      await pool.query('DELETE FROM "session" WHERE sid = $1', [evSession.sid]);
    }
    // Also the signed-out login page.
    const ctx = await browser.createBrowserContext();
    const login = await ctx.newPage();
    login.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) problems.push("/ (login) :: " + m.text()); });
    login.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) problems.push("/ (login) :: HTTP " + r.status() + " " + r.url()); });
    await login.goto(CSP_BASE + "/", { waitUntil: "networkidle0" });
    await ctx.close();
    t.diagnostic("pages checked: " + (pages.length + 3) + " (" + pages.map((p) => p.split("?")[0]).join(", ") + ", /kiosk, /requester/evaluate, / login)");
  } finally {
    await browser.close();
  }
  assert.deepEqual(problems, []);
});

// ---- DEV-09 audit log --------------------------------------------------------------------------------
test("DEV-03/DEV-05 all three Excel reports still download and open (exceljs + uuid 11, sanitizeCell)", { skip }, async (t) => {
  const ExcelJS = require("exceljs");
  const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
  for (const p of ["/api/reports/history.xlsx?year=" + y + "&month=" + m, "/api/reports/dashboard.xlsx?year=" + y, "/api/reports/evaluations.xlsx?year=" + y]) {
    const r = await get(p, cookies.admin.cookie);
    assert.equal(r.status, 200, p);
    const buf = Buffer.from(await r.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    t.diagnostic(p.split("?")[0] + ": " + buf.length + " bytes, sheets: " + wb.worksheets.map((w) => w.name).join(", "));
  }
});

test("EXTRA the unused whole-table endpoint GET /api/requests is gone (404)", { skip }, async () => {
  const r = await get("/api/requests", cookies.admin.cookie);
  assert.equal(r.status, 404);
});

test("DEV-09 Excel export, 403 and 429 are written to audit_log with email and IP", { skip }, async (t) => {
  const x = await get("/api/reports/history.xlsx?year=" + new Date().getFullYear() + "&month=" + (new Date().getMonth() + 1), cookies.admin.cookie);
  assert.equal(x.status, 200);
  await x.arrayBuffer();
  const req403 = await get("/admin/officers", cookies.requester.cookie);
  assert.equal(req403.status, 403);
  await new Promise((r) => setTimeout(r, 300)); // audit writes are fire-and-forget

  const exp = await auditFor(ADMIN, "report.export");
  assert.ok(exp.length >= 1, "report.export logged");
  assert.equal(exp[0].entity_label, "history");
  const forb = await auditFor(REQUESTER, "auth.forbidden");
  assert.ok(forb.some((r) => r.entity_label === "role GET /admin/officers"), "auth.forbidden logged");
  const kioskForb = await auditFor(KIOSK, "auth.forbidden");
  assert.ok(kioskForb.some((r) => r.entity_label.startsWith("kiosk-only")), "kiosk-only refusal logged");
  const rl = await auditFor(REQUESTER, "rateLimit.exceeded");
  assert.ok(rl.some((r) => r.entity_label === "pdf"), "rateLimit.exceeded logged");
  for (const row of [...exp, ...forb, ...kioskForb, ...rl]) assert.ok(row.ip_address, "IP recorded for " + row.action);
  t.diagnostic("sample rows: " + JSON.stringify([exp[0], forb[0], rl[0]]));
});
