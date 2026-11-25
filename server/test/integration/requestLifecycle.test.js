/**
 * Integration tests: src/requests.js against a REAL PostgreSQL database
 * (Prisma, migrations, counters, the audit-log trigger), not fakes.
 *
 * Skipped unless TEST_DATABASE_URL is set, so plain `npm test` still needs no
 * database. Point it at a throwaway local database only; the tests create
 * their own requests (requester int-test@mfu.ac.th) and remove them at the end.
 *
 *   docker run -d --rm --name odprs_it -e POSTGRES_USER=odprs -e POSTGRES_PASSWORD=it \
 *     -e POSTGRES_DB=odprs -p 55433:5432 postgres:16-alpine
 *   TEST_DATABASE_URL=postgresql://odprs:it@localhost:55433/odprs npm run test:integration
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const URL_ = process.env.TEST_DATABASE_URL;
const SAFE = URL_ && /@(localhost|127\.0\.0\.1)[:/]/.test(URL_);
const skip = !URL_ ? "TEST_DATABASE_URL not set" : !SAFE ? "TEST_DATABASE_URL must point at localhost" : false;

let prisma, requests, businessDays, ctx;
const REQUESTER = "int-test@mfu.ac.th";
const OTHER = "someone-else@mfu.ac.th";
const OFFICER = { officerEmail: "int-officer@mfu.ac.th", officerName: "Integration Officer" };
const created = [];

function ymd(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// A valid form submission, as the route hands it to requests.create().
function validInput(extra) {
  return {
    requesterEmail: REQUESTER, requesterName: "Integration Tester", requesterTel: "081-000-0000",
    unitTypeId: ctx.unit.categoryId, unitId: ctx.unit.id,
    documentType: "general", colorMode: "bw", printSide: "double", paperSize: "A4",
    itemList: "integration test", originalPages: "10", numberOfCopies: "3",
    finishingMethods: [], appointmentDateProposed: ctx.date, dropoffLocationId: ctx.locationId,
    ...extra
  };
}

async function newRequest(extra) {
  const r = await requests.create(validInput(extra));
  assert.ok(!r.error, "create failed: " + r.error);
  created.push(r.referenceNo);
  return r;
}
const row = (ref) => prisma.request.findUnique({ where: { requestReferenceNo: ref } });

test.before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.SMTP_HOST = ""; // never send real email from tests
  const { execSync } = require("node:child_process");
  execSync("npx prisma migrate deploy", { cwd: __dirname + "/../..", env: process.env, stdio: "ignore" });
  prisma = require("../../src/prisma");
  requests = require("../../src/requests");
  businessDays = require("../../src/businessDays");
  await require("../../src/defaults").ensureDefaults(prisma);
  const unit = await prisma.unit.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  const loc = await prisma.location.findFirst({ orderBy: { id: "asc" } });
  ctx = { unit, locationId: loc ? loc.id : null, date: ymd(businessDays.minCompletionDate(new Date())) };
});

test.after(async () => {
  if (skip || !prisma) return;
  await prisma.evaluation.deleteMany({ where: { requestReferenceNo: { in: created } } });
  await prisma.notification.deleteMany({ where: { requestReferenceNo: { in: created } } }).catch(() => {});
  await prisma.request.deleteMany({ where: { requestReferenceNo: { in: created } } });
  await prisma.$disconnect();
});

test("create: saves the request as awaiting the original, with a REQ-YYYY-NNNNNN number", { skip }, async () => {
  const r = await newRequest();
  assert.match(r.referenceNo, /^REQ-\d{4}-\d{6}$/);
  const saved = await row(r.referenceNo);
  assert.equal(saved.status, "AWAITING_ORIGINAL_DOCUMENT");
  assert.equal(saved.requesterEmail, REQUESTER);
  assert.equal(saved.numberOfCopies, 3);
  assert.equal(saved.runNumber, null);
});

test("create: two requests in a row get consecutive reference numbers", { skip }, async () => {
  const a = await newRequest();
  const b = await newRequest();
  const n = (ref) => Number(ref.split("-")[2]);
  assert.equal(n(b.referenceNo), n(a.referenceNo) + 1);
});

test("create: server-side rules refuse bad input", { skip }, async () => {
  const cases = [
    [{ appointmentDateProposed: ymd(new Date()) }, "completion-date-too-soon"],
    [{ itemList: "x".repeat(500) }, "item-list-too-long"],
    [{ colorMode: "" }, "missing-required-field"],
    [{ finishingMethods: ["saddleStitch"], printSide: "single" }, "finishing-requires-double-side"],
    [{ numberOfCopies: "0" }, "copies-out-of-range"]
  ];
  for (const [extra, expected] of cases) {
    const r = await requests.create(validInput(extra));
    assert.equal(r.error, expected, JSON.stringify(extra));
  }
});

test("full lifecycle: approve, mark ready, hand over", { skip }, async () => {
  const r = await newRequest();

  const approved = await requests.approve(r.referenceNo, { confirmedDate: ctx.date, ...OFFICER });
  assert.ok(approved, "approve returned null");
  let saved = await row(r.referenceNo);
  assert.equal(saved.status, "PRINTING_IN_PROGRESS");
  assert.match(saved.runNumber, /^RN-\d{4}-\d{6}$/);
  assert.match(saved.claimCode, /^\d{6}$/);
  assert.equal(saved.reviewedByOfficerEmail, OFFICER.officerEmail);

  assert.equal(await requests.approve(r.referenceNo, { confirmedDate: ctx.date, ...OFFICER }), null, "approved twice");

  const ready = await requests.markReady(r.referenceNo, { ...OFFICER });
  assert.ok(ready && !ready.error, "markReady failed: " + (ready && ready.error));
  saved = await row(r.referenceNo);
  assert.equal(saved.status, "READY_FOR_PICKUP");
  assert.ok(saved.readyAt);

  const found = await requests.getByClaimCode(saved.claimCode);
  assert.equal(found && found.referenceNo, r.referenceNo, "claim code lookup");

  const done = await requests.handover(r.referenceNo, {
    receiverName: "Receiver", receiverPosition: "Lecturer", receiverWorkplace: "School", receiverWorkPhone: "053-000-000", ...OFFICER
  });
  assert.ok(done, "handover returned null");
  saved = await row(r.referenceNo);
  assert.equal(saved.status, "COMPLETED");
  assert.equal(saved.receiverName, "Receiver");
  assert.ok(saved.completedTimestamp);

  const ev = await requests.evaluationState(r.referenceNo, REQUESTER);
  assert.equal(ev.state, "open", "a completed request should be open for rating");
});

test("steps out of order are refused", { skip }, async () => {
  const r = await newRequest();
  assert.equal(await requests.markReady(r.referenceNo, { ...OFFICER }), null, "ready before approval");
  assert.equal(await requests.handover(r.referenceNo, { receiverName: "x", ...OFFICER }), null, "handover before ready");
  assert.equal((await row(r.referenceNo)).status, "AWAITING_ORIGINAL_DOCUMENT");
});

test("reject stores the reason and blocks approval afterwards", { skip }, async () => {
  const r = await newRequest();
  const rejected = await requests.reject(r.referenceNo, { reason: "ไฟล์ไม่ชัด", ...OFFICER });
  assert.ok(rejected);
  const saved = await row(r.referenceNo);
  assert.equal(saved.status, "REJECTED");
  assert.equal(saved.rejectionReason, "ไฟล์ไม่ชัด");
  assert.equal(await requests.approve(r.referenceNo, { confirmedDate: ctx.date, ...OFFICER }), null);
});

test("only the owner can edit or cancel, and only while awaiting", { skip }, async () => {
  const r = await newRequest();
  const byOther = await requests.update(r.referenceNo, validInput({ requesterEmail: OTHER, numberOfCopies: "9" }));
  assert.equal(byOther.error, "not-editable");
  const byOwner = await requests.update(r.referenceNo, validInput({ numberOfCopies: "7" }));
  assert.ok(!byOwner.error);
  assert.equal((await row(r.referenceNo)).numberOfCopies, 7);

  assert.equal(await requests.cancel(r.referenceNo, { requesterEmail: OTHER }), null, "someone else cancelled it");
  assert.ok(await requests.cancel(r.referenceNo, { requesterEmail: REQUESTER }));
  assert.equal((await row(r.referenceNo)).status, "CANCELLED");

  const afterCancel = await requests.update(r.referenceNo, validInput({ numberOfCopies: "2" }));
  assert.equal(afterCancel.error, "not-editable");
});

test("history search finds a request by its reference number", { skip }, async () => {
  const r = await newRequest();
  const res = await requests.searchHistory({ q: r.referenceNo, page: 1, pageSize: 20 });
  const refs = (res.records || res.items || res.rows || []).map((x) => x.referenceNo);
  assert.ok(refs.includes(r.referenceNo), "not found in history search");
});

test("access log (audit_log) is append-only: UPDATE, DELETE and TRUNCATE are refused", { skip }, async () => {
  await prisma.auditLog.create({ data: { actorEmail: REQUESTER, action: "test.integration", entityType: "auth", entityLabel: "it" } });
  await assert.rejects(prisma.$executeRawUnsafe("UPDATE audit_log SET entity_label = 'changed' WHERE action = 'test.integration'"));
  await assert.rejects(prisma.$executeRawUnsafe("DELETE FROM audit_log WHERE action = 'test.integration'"));
  await assert.rejects(prisma.$executeRawUnsafe("TRUNCATE audit_log"));
});
