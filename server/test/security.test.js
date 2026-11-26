// Unit tests for the pre-production security fixes (document/security/
// 2026-11-26_security-remediation-plan.md, DEV-02 .. DEV-09). Run with: npm test
//
// No database and no real Chromium: in-memory fakes stand in for
// src/prisma.js and puppeteer-core (same approach as audit.test.js).
// The HTTP-level checks (kiosk lock, logout, 429/403 over real requests,
// real PDF, CSP) live in test/e2e/security.e2e.test.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

process.env.ALLOWED_EMAIL_DOMAIN = "@mfu.ac.th";
process.env.ALLOW_LAMDUAN_FOR_TESTING = "false";
process.env.TEST_ALLOWED_EMAILS = "";
process.env.PDF_CONCURRENCY = "2";

// ---- fakes ------------------------------------------------------------------
const auditRows = [];
const claimCodesInUse = new Set();
const fakePrisma = {
  auditLog: { async create({ data }) { auditRows.push(data); return data; } },
  request: {
    async findFirst({ where }) { return claimCodesInUse.has(where.claimCode) ? { claimCode: where.claimCode } : null; }
  }
};
const prismaPath = path.join(__dirname, "..", "src", "prisma.js");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

// Fake Chromium: records what pdf.js does with it and how many run at once.
const chrome = { running: 0, maxRunning: 0, cookies: [], aborted: [], continued: [], delayMs: 40 };
const fakePuppeteer = {
  async launch() {
    chrome.running++;
    chrome.maxRunning = Math.max(chrome.maxRunning, chrome.running);
    const handlers = {};
    const page = {
      setDefaultTimeout() {},
      async setRequestInterception(on) { page.intercept = on; },
      on(ev, fn) { handlers[ev] = fn; },
      async goto(url, opts) {
        chrome.gotoTimeout = opts.timeout;
        // The page asks for its own files plus a few outside ones.
        for (const u of [url, "http://localhost:3000/assets/css/style.css", "https://fonts.googleapis.com/css2?family=Kanit", "https://lh3.googleusercontent.com/a/x", "https://evil.example/steal"]) {
          handlers.request({ url: () => u, continue: () => chrome.continued.push(u), abort: () => chrome.aborted.push(u) });
        }
        await new Promise((r) => setTimeout(r, chrome.delayMs));
        return { ok: () => true, status: () => 200 };
      },
      async emulateMediaType() {},
      async pdf(opts) { chrome.pdfTimeout = opts.timeout; return new Uint8Array([37, 80, 68, 70]); }
    };
    return {
      async setCookie(...c) { chrome.cookies.push(...c); },
      async newPage() { return page; },
      async close() { chrome.running--; }
    };
  }
};
const puppeteerPath = require.resolve("puppeteer-core");
require.cache[puppeteerPath] = { id: puppeteerPath, filename: puppeteerPath, loaded: true, exports: fakePuppeteer };

const audit = require("../src/audit");
const { createLimiter } = require("../src/rateLimit");
const pdf = require("../src/pdf");
const auth = require("../src/auth");
const locations = require("../src/locations");
const requests = require("../src/requests");
const reports = require("../src/reports");

// Minimal Express req/res stand-ins for middleware tests.
function fakeReq(extra) {
  return { ip: "10.0.0.9", method: "GET", originalUrl: "/x", url: "/x", user: { email: "user@mfu.ac.th" }, ...extra };
}
function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.type = () => res;
  res.send = (b) => { res.body = b; return res; };
  return res;
}
function hit(mw, req) {
  const res = fakeRes();
  let passed = false;
  mw(req, res, () => { passed = true; });
  return { passed, res };
}
const tick = () => new Promise((r) => setImmediate(r));

test.beforeEach(() => { auditRows.length = 0; });

// ---- DEV-02 PDF limits --------------------------------------------------------
test("DEV-02 pdfLimiter: 10 PDFs per minute per account, the 11th gets 429", () => {
  const req = () => fakeReq({ user: { email: "pdf-user@mfu.ac.th" }, originalUrl: "/requester/request-submitted/REQ-1/pdf" });
  for (let i = 1; i <= 10; i++) assert.equal(hit(pdf.pdfLimiter, req()).passed, true, "request " + i + " should pass");
  const eleventh = hit(pdf.pdfLimiter, req());
  assert.equal(eleventh.passed, false);
  assert.equal(eleventh.res.statusCode, 429);
  assert.ok(Number(eleventh.res.headers["Retry-After"]) > 0);
  // Another account still has its own budget.
  assert.equal(hit(pdf.pdfLimiter, fakeReq({ user: { email: "other@mfu.ac.th" } })).passed, true);
});

test("DEV-02 at most 2 Chromiums run at once; the rest wait in line and still finish", async () => {
  chrome.maxRunning = 0;
  const jobs = Array.from({ length: 6 }, () => pdf.renderPagePdf("/requester/request-submitted/REQ-1", "connect.sid=s%3Aabc"));
  const results = await Promise.all(jobs);
  assert.equal(chrome.maxRunning, 2);
  assert.equal(results.length, 6);
  for (const b of results) assert.equal(b.slice(0, 4).toString(), "%PDF");
});

test("DEV-02 when 10 jobs are already waiting, the next one is refused with 503 instead of piling up", async () => {
  const jobs = Array.from({ length: 12 }, () => pdf.renderPagePdf("/x", null).then(() => "ok", (e) => e.status));
  const results = await Promise.all(jobs);
  assert.equal(results.filter((r) => r === "ok").length, 12);
  // 2 running + 10 waiting fit; a 13th and 14th must be refused.
  const more = Array.from({ length: 14 }, () => pdf.renderPagePdf("/x", null).then(() => "ok", (e) => e.status));
  const r2 = await Promise.all(more);
  assert.equal(r2.filter((r) => r === 503).length, 2);
  assert.equal(r2.filter((r) => r === "ok").length, 12);
});

test("DEV-02 20 s timeout on page load and PDF print", async () => {
  await pdf.renderPagePdf("/x", null);
  assert.equal(chrome.gotoTimeout, 20000);
  assert.equal(chrome.pdfTimeout, 20000);
});

test("DEV-02 only the session cookie is passed, scoped to localhost; outside requests are blocked", async () => {
  chrome.cookies.length = 0; chrome.aborted.length = 0; chrome.continued.length = 0;
  await pdf.renderPagePdf("/requester/request-submitted/REQ-1", "_ga=GA1.2.3; connect.sid=s%3Asecret.sig; theme=dark");
  assert.deepEqual(chrome.cookies, [{ name: "connect.sid", value: "s%3Asecret.sig", domain: "localhost", path: "/", httpOnly: true }]);
  assert.ok(chrome.continued.every((u) => u.startsWith("http://localhost:3000/")));
  assert.deepEqual(chrome.aborted.sort(), ["https://evil.example/steal", "https://fonts.googleapis.com/css2?family=Kanit", "https://lh3.googleusercontent.com/a/x"]);
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "pdf.js"), "utf8");
  assert.ok(!src.includes("setExtraHTTPHeaders"), "cookie must not be sent as an extra header on every sub-request");
});

// ---- DEV-05 Excel formula injection -------------------------------------------
test("DEV-05 sanitizeCell: text starting with = + - @ tab CR becomes plain text", () => {
  for (const bad of ["=1+1", "=HYPERLINK(\"http://evil\",\"x\")", "+66812345678", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
    assert.equal(reports.sanitizeCell(bad), "'" + bad);
  }
  for (const ok of ["ปกติ", "REQ-2026-000001", "A4", "", "-", 42, -5, null, undefined]) {
    assert.equal(reports.sanitizeCell(ok), ok);
  }
  const d = new Date();
  assert.equal(reports.sanitizeCell(d), d);
});

test("DEV-05 a formula typed by a user is stored as text in the real .xlsx file", async () => {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("t");
  ws.getCell("A1").value = reports.sanitizeCell("=HYPERLINK(\"http://evil\",\"click\")");
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(await wb.xlsx.writeBuffer());
  const cell = back.getWorksheet("t").getCell("A1");
  assert.equal(cell.type, ExcelJS.ValueType.String);
  assert.equal(cell.formula, undefined);
});

// ---- DEV-06 claim code ----------------------------------------------------------
test("DEV-06 claim codes come from crypto.randomInt, never Math.random", async () => {
  const crypto = require("crypto");
  const realRandomInt = crypto.randomInt;
  const realMathRandom = Math.random;
  let cryptoCalls = 0;
  crypto.randomInt = (a, b) => { cryptoCalls++; return realRandomInt(a, b); };
  Math.random = () => { throw new Error("Math.random must not be used for claim codes"); };
  try {
    for (let i = 0; i < 200; i++) {
      const code = await requests.generateUniqueClaimCode();
      assert.match(code, /^\d{6}$/);
    }
  } finally {
    crypto.randomInt = realRandomInt;
    Math.random = realMathRandom;
  }
  assert.ok(cryptoCalls >= 200);
});

test("DEV-06 a code already in use is skipped", async () => {
  const crypto = require("crypto");
  const real = crypto.randomInt;
  const seq = [123456, 123456, 654321];
  crypto.randomInt = () => seq.shift();
  claimCodesInUse.add("123456");
  try {
    assert.equal(await requests.generateUniqueClaimCode(), "654321");
  } finally {
    crypto.randomInt = real;
    claimCodesInUse.clear();
  }
});

test("DEV-06 no Math.random anywhere in the server source", () => {
  const dir = path.join(__dirname, "..", "src");
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : files.push(path.join(d, f.name)); })(dir);
  const hits = files.filter((f) => f.endsWith(".js") && /Math\.random\s*\(/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(hits, []);
});

// ---- DEV-07 OAuth: email_verified, nothing extra in the session -----------------
test("DEV-07 Google account with an unverified email is refused; session keeps only the needed fields", async () => {
  let verify;
  const passport = { use(strategy) { verify = strategy._verify; }, serializeUser() {}, deserializeUser() {} };
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "x";
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "x";
  process.env.GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback";
  fakePrisma.officer = { async findUnique() { return null; } };
  auth.configure(passport);
  const run = (json) => new Promise((resolve) => verify("at", "rt", {
    displayName: "Staff", emails: [{ value: json.email }], photos: [], _json: json
  }, (err, user, info) => resolve({ err, user, info })));

  const unverified = await run({ email: "staff@mfu.ac.th", email_verified: false, sub: "1" });
  assert.equal(unverified.user, false);
  assert.equal(unverified.info.message, "email-not-verified");

  const ok = await run({ email: "staff@mfu.ac.th", email_verified: true, sub: "1", locale: "th", hd: "mfu.ac.th" });
  assert.deepEqual(Object.keys(ok.user).sort(), ["email", "isRealAllowedDomain", "name", "picture", "role"]);
  assert.equal(ok.user.raw, undefined);
});

// ---- DEV-08 server-side validation ------------------------------------------------
test("DEV-08 officer email must be a real address in the allowed domain", () => {
  for (const good of ["staff@mfu.ac.th", "  Staff.Name@MFU.AC.TH "]) assert.equal(auth.isAllowedEmail(good), true, good);
  for (const bad of ["", "staff", "staff@gmail.com", "staff@evil-mfu.ac.th.com", "a b@mfu.ac.th", "x@lamduan.mfu.ac.th", "@mfu.ac.th", "x@sub.mfu.ac.th.evil.com"]) {
    assert.equal(auth.isAllowedEmail(bad), false, bad);
  }
});

test("DEV-08 location map link: only http/https is accepted", async () => {
  const base = { nameTh: "ห้อง", nameEn: "Room", detailTh: "ชั้น 1", detailEn: "Floor 1", phone: "053-000000", acceptsDropoff: true, hoursFromDay: "1", hoursToDay: "5", hoursOpen: "08:30", hoursClose: "16:30" };
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "not a url"]) {
    const r = await locations.create({ ...base, mapUrl: bad }, "admin@mfu.ac.th");
    assert.equal(r.error, "map-url-invalid", bad);
  }
});

// ---- DEV-09 audit log of security events ----------------------------------------------
test("DEV-09 rate limit hit is written to the audit log once per window, with who and from where", async () => {
  const lim = createLimiter({ windowMs: 60000, max: 2, name: "unit-test" });
  await audit.context.run({ ip: "10.20.30.40" }, async () => {
    for (let i = 0; i < 6; i++) hit(lim, fakeReq({ user: { email: "spammer@mfu.ac.th" } }));
    await tick();
  });
  const logged = auditRows.filter((r) => r.action === "rateLimit.exceeded");
  assert.equal(logged.length, 1);
  assert.equal(logged[0].actorEmail, "spammer@mfu.ac.th");
  assert.equal(logged[0].ipAddress, "10.20.30.40");
  assert.equal(logged[0].entityLabel, "unit-test");
});

test("DEV-09 403 from requireRole/requireAdmin is logged (auth.forbidden), at most once a minute per user + path", async () => {
  await audit.context.run({ ip: "10.1.1.1" }, async () => {
    const req = () => fakeReq({ user: { email: "requester@mfu.ac.th", role: "Requester" }, originalUrl: "/admin/officers?x=1" });
    for (let i = 0; i < 3; i++) {
      const r = hit(auth.requireAdmin, req());
      assert.equal(r.res.statusCode, 403);
    }
    const r2 = hit(auth.requireRole("Officer", "Admin"), fakeReq({ user: { email: "requester@mfu.ac.th", role: "Requester" }, originalUrl: "/officer/queue" }));
    assert.equal(r2.res.statusCode, 403);
    await tick();
  });
  const logged = auditRows.filter((r) => r.action === "auth.forbidden");
  assert.equal(logged.length, 2);
  assert.deepEqual(logged.map((r) => r.entityLabel), ["role GET /admin/officers", "role GET /officer/queue"]);
  assert.ok(logged.every((r) => r.actorEmail === "requester@mfu.ac.th" && r.ipAddress === "10.1.1.1" && r.entityType === "security"));
});

// A fake HTTP response that collects what the streaming writer sends.
function fakeStreamRes(user) {
  const { PassThrough } = require("node:stream");
  const res = new PassThrough();
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.headers = {};
  res.headersSent = false;
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.removeHeader = (k) => { delete res.headers[k]; };
  res.req = { user };
  res.body = () => new Promise((resolve) => res.on("end", () => resolve(Buffer.concat(chunks))));
  return res;
}

// History rows the fake database hands out, in batches like Prisma would.
function fakeHistoryRows(n) {
  return Array.from({ length: n }, (_, i) => ({
    requestReferenceNo: "REQ-2026-" + String(n - i).padStart(6, "0"), runNumber: null,
    submissionDate: new Date(2026, 0, 1, 9, 0, 0), status: "COMPLETED",
    requesterName: i === 0 ? "=HYPERLINK(\"http://evil\",\"x\")" : "ผู้ขอ " + i, requesterEmail: "r" + i + "@mfu.ac.th", requesterTel: "+66812345678",
    unitType: "สำนักวิชา", unit: "หน่วย " + (i % 7), documentType: "general", paperSource: "office", itemList: "เอกสาร " + i,
    paperSize: "A4", colorMode: "bw", printSide: "single", originalPages: 2, numberOfCopies: 3
  }));
}

test("DEV-05/DEV-09 history export streams batches, keeps formulas as text, and is logged (report.export)", async () => {
  const ExcelJS = require("exceljs");
  const all = fakeHistoryRows(4500);
  const calls = [];
  fakePrisma.request.count = async () => all.length;
  fakePrisma.request.findMany = async ({ skip, take }) => { calls.push([skip, take]); return all.slice(skip, skip + take); };
  const res = fakeStreamRes({ email: "officer@mfu.ac.th" });
  const body = res.body();
  await audit.context.run({ ip: "10.5.5.5" }, () => reports.streamWorkbook(res, "history", {}, { lang: "th", user: "officer@mfu.ac.th" }));
  await tick();
  // Read from the database 2000 rows at a time, never all at once.
  assert.deepEqual(calls, [[0, 2000], [2000, 2000], [4000, 500]]);
  assert.match(res.headers["Content-Disposition"], /attachment/);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await body);
  const ws = wb.worksheets[0];
  assert.ok(ws.getCell(6, 1).value, "header row exists");
  assert.equal(ws.getCell(7, 1).value, "REQ-2026-004500");
  assert.equal(ws.getCell(7 + 4499, 1).value, "REQ-2026-000001"); // last row present: nothing skipped
  const nameCell = ws.getCell(7, 5);
  assert.equal(nameCell.value, "'=HYPERLINK(\"http://evil\",\"x\")");
  assert.equal(nameCell.formula, undefined);
  assert.equal(ws.getCell(7, 7).value, "'+66812345678");
  assert.deepEqual(ws.views[0] && { state: ws.views[0].state, ySplit: ws.views[0].ySplit }, { state: "frozen", ySplit: 6 });

  const row = auditRows.find((r) => r.action === "report.export");
  assert.deepEqual({ a: row.actorEmail, l: row.entityLabel, ip: row.ipAddress, t: row.entityType }, { a: "officer@mfu.ac.th", l: "history", ip: "10.5.5.5", t: "report" });
});

test("export failing midway cuts the connection instead of sending a broken file, and is not logged", async () => {
  const all = fakeHistoryRows(4500);
  fakePrisma.request.count = async () => all.length;
  fakePrisma.request.findMany = async ({ skip, take }) => { if (skip >= 2000) throw new Error("db went away"); return all.slice(skip, skip + take); };
  const res = fakeStreamRes({ email: "officer@mfu.ac.th" });
  res.on("data", () => { res.headersSent = true; });
  let destroyed = null;
  res.destroy = (err) => { destroyed = err; };
  const realError = console.error;
  console.error = () => {};
  try {
    await reports.streamWorkbook(res, "history", {}, { lang: "en", user: "x" });
  } finally {
    console.error = realError;
  }
  assert.equal(destroyed && destroyed.message, "db went away");
  assert.equal(auditRows.filter((r) => r.action === "report.export").length, 0);
});

test("DEV-08 a normal https map link is still accepted (reaches the database step)", async () => {
  const base = { nameTh: "ห้อง", nameEn: "Room", detailTh: "ชั้น 1", detailEn: "Floor 1", phone: "053-000000", acceptsDropoff: true, hoursFromDay: "1", hoursToDay: "5", hoursOpen: "08:30", hoursClose: "16:30" };
  let reachedDb = false;
  fakePrisma.$transaction = async () => { reachedDb = true; return { ok: true }; };
  const r = await locations.create({ ...base, mapUrl: "https://maps.app.goo.gl/abc" }, "admin@mfu.ac.th");
  assert.equal(r.error, undefined);
  assert.equal(reachedDb, true);
});

test("DEV-09 a 403 logged before the IP context exists (CSRF guard) still records the IP", async () => {
  await audit.recordForbidden(fakeReq({ user: null, ip: "::ffff:10.7.7.7", method: "POST", originalUrl: "/api/requests/REQ-1/approve" }), "csrf");
  const row = auditRows.find((r) => r.action === "auth.forbidden" && r.entityLabel.startsWith("csrf"));
  assert.equal(row.ipAddress, "10.7.7.7");
  assert.equal(row.actorEmail, "anonymous");
});
