// Unit tests for src/audit.js: the Computer Crime Act s.26 log
// (who, what, when, from where). Run with: npm test
//
// Same approach as counters.test.js: an in-memory fake stands in for
// src/prisma.js, so no database is needed.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const rows = [];
let failNextWrite = false;
const fakePrisma = {
  auditLog: {
    async create({ data }) {
      if (failNextWrite) { failNextWrite = false; throw new Error("database is down"); }
      rows.push(data);
      return data;
    },
    async findMany(args) { lastQuery = args.where; return []; },
    async count() { return 0; }
  }
};
let lastQuery = null;

const prismaPath = path.join(__dirname, "..", "src", "prisma.js");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
const audit = require("../src/audit");

test.beforeEach(() => { rows.length = 0; failNextWrite = false; });

test("records the visitor's IP for writes made while handling a request", async () => {
  await audit.context.run({ ip: "10.1.2.3" }, async () => {
    await Promise.resolve(); // the IP must survive an await, as in a real route handler
    await audit.write(null, { actorEmail: "a@mfu.ac.th", action: "location.update", entityType: "location" });
  });
  assert.equal(rows[0].ipAddress, "10.1.2.3");
});

test("two requests at the same time each keep their own IP", async () => {
  await Promise.all([
    audit.context.run({ ip: "10.0.0.1" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      await audit.recordRequest("one@mfu.ac.th", "approve", "REQ-2026-000001");
    }),
    audit.context.run({ ip: "10.0.0.2" }, async () => {
      await audit.recordRequest("two@mfu.ac.th", "reject", "REQ-2026-000002");
    })
  ]);
  const byActor = Object.fromEntries(rows.map((r) => [r.actorEmail, r.ipAddress]));
  assert.deepEqual(byActor, { "one@mfu.ac.th": "10.0.0.1", "two@mfu.ac.th": "10.0.0.2" });
});

test("outside an HTTP request (a script) the IP is empty, not an error", async () => {
  await audit.write(null, { actorEmail: "script", action: "unit.create", entityType: "unit" });
  assert.equal(rows[0].ipAddress, null);
});

test("recordRequest keeps only who, what and which request, no personal details", async () => {
  await audit.context.run({ ip: "10.9.9.9" }, () =>
    audit.recordRequest("officer@mfu.ac.th", "handover", "REQ-2026-000123"));
  assert.deepEqual(rows[0], {
    actorEmail: "officer@mfu.ac.th",
    action: "request.handover",
    entityType: "request",
    entityId: null,
    entityLabel: "REQ-2026-000123",
    before: null,
    after: null,
    ipAddress: "10.9.9.9"
  });
});

test("a failed log write after a successful action does not throw", async () => {
  failNextWrite = true;
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await assert.doesNotReject(audit.record({ actorEmail: "a@mfu.ac.th", action: "auth.login", entityType: "auth" }));
  } finally {
    console.error = originalError;
  }
  assert.equal(rows.length, 0);
  assert.match(logged[0], /auth\.login/); // still visible in the server log
});

test("write() itself still throws, so admin changes roll back with their transaction", async () => {
  failNextWrite = true;
  await assert.rejects(audit.write(null, { actorEmail: "a@mfu.ac.th", action: "unit.update", entityType: "unit" }));
});

test("search box: matches part of the email, IP or item, ignoring case", async () => {
  await audit.list({ entityType: "auth,request", q: "  Somchai  " });
  assert.deepEqual(lastQuery.entityType, { in: ["auth", "request"] });
  assert.deepEqual(lastQuery.OR, [
    { actorEmail: { contains: "Somchai", mode: "insensitive" } },
    { ipAddress: { contains: "Somchai", mode: "insensitive" } },
    { entityLabel: { contains: "Somchai", mode: "insensitive" } }
  ]);
});

test("search box: empty or spaces only means no search", async () => {
  await audit.list({ q: "   " });
  assert.equal(lastQuery.OR, undefined);
});

test("search box: very long input is cut to 100 characters", async () => {
  await audit.list({ q: "x".repeat(5000) });
  assert.equal(lastQuery.OR[0].actorEmail.contains.length, 100);
});
