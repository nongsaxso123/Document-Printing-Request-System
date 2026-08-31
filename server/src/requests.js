/**
 * Request queries + the DB-shape -> client-shape JSON mapper.
 * Client-side (server/views/officer/*.ejs inline scripts, ported almost
 * verbatim from prototype/officer/*.html) still expects the same field
 * names/status codes the old mock store used, so all mapping lives here
 * rather than touching every page's rendering logic.
 */

const prisma = require("./prisma");
const counters = require("./counters");
const businessDays = require("./businessDays");

// v0.4 print-spec fields: the new-request.ejs form submits short codes
// (client-side JS branches on these), but every display page (translateValue
// in app.js) works by matching the canonical Thai label text already used
// throughout this codebase for stored option values (paperSize, old
// printOption, etc.) — so incoming codes are mapped to that same canonical
// Thai text here, once, at the write boundary.
const COLOR_MODE_TH = { bw: "ขาวดำ", color: "สี" };
const PRINT_SIDE_TH = { single: "พิมพ์หน้าเดียว", double: "พิมพ์สองหน้า" };
// v0.6: Finishing/Binding is multi-select again — the Registrar Division
// counter's own stakeholder confirmed several finishing techniques really
// can be combined by hand (see schema.prisma's finishingMethods comment).
// No "none" code: an empty array means no finishing, nothing special to map.
const FINISHING_METHOD_TH = {
  corner: "เย็บมุม",
  side: "เย็บข้าง",
  hole: "เจาะรู",
  saddleStitch: "เย็บมุงหลังคา (Saddle-stitch)",
  coil: "เข้าเล่มห่วงสัน (Coil)",
  clothTape: "เข้าเล่มเทปผ้า",
  glue: "เข้าเล่มสันกาว"
};
const DOCUMENT_TYPE_TH = { exam: "ข้อสอบ", general: "เอกสารทั่วไป" };

// Exam print jobs at the counter only ever get a quick corner-staple (or
// nothing) — none of the book-binding methods are offered for exams in
// the real process, regardless of what the client sends.
const EXAM_ALLOWED_FINISHING = new Set(["corner"]);

// Groups where at most ONE member may be selected together — true
// regardless of who finishes the job by hand, so these don't need
// stakeholder confirmation: Corner vs. Side staple is a choice of
// position, not both at once, and the four true Binding methods
// (Saddle-stitch/Coil/Cloth Tape/Glue) each define a mutually exclusive
// final bound state of the whole document. Every other combination (e.g.
// staple + hole punch, staple + a Binding method) is left allowed for now
// pending the Registrar Division confirming the rest — see file.md
// Appendix B.
const EXCLUSIVE_FINISHING_GROUPS = [
  ["corner", "side"],
  ["saddleStitch", "coil", "clothTape", "glue"]
];

// Assumed physical limits of the counter's stapler/binding equipment,
// keyed by finishing code and checked against Original_Pages (the page
// count of one physical set — each copy is finished separately, so
// copies don't multiply the constraint). These numbers are generic
// office copy-shop figures, NOT yet confirmed against the Registrar
// Division's actual equipment — see file.md Appendix B. Kept in this one
// object so the real numbers are a single edit once known.
const FINISHING_PAGE_LIMITS = {
  // Saddle-stitch folds the sheet stack in half and staples through the
  // spine: the fold only lies flat up to ~60 pages, and each physical
  // sheet folds into 4 booklet pages, so the count must be a multiple of 4.
  saddleStitch: { min: 4, max: 60, multipleOf: 4 },
  // A perfect/glue-bound spine needs enough page thickness for the glue to
  // grip; a handful of sheets has no real spine to bind.
  glue: { min: 20 },
  // A standard stapler can't drive a staple through more than ~80 sheets.
  corner: { max: 80 }
};
const PAPER_SOURCE_TH = { office: "ฝ่ายทะเบียนจัดเตรียมให้", requester: "ผู้ขอจัดเตรียมเอง" };

// Copy Label's auto-run numbers are zero-padded to 3 digits (001..999) —
// capping copies here keeps that format from overflowing to 4 digits.
const MAX_COPIES = 999;

const STATUS_TO_CODE = {
  AWAITING_ORIGINAL_DOCUMENT: "awaiting",
  REJECTED: "rejected",
  PRINTING_IN_PROGRESS: "printing",
  READY_FOR_PICKUP: "ready",
  COMPLETED: "completed"
};

const CODE_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_CODE).map(([k, v]) => [v, k]));

// @db.Date columns come back as UTC-midnight JS Dates; using local getters
// here would shift the date by a day in timezones behind UTC.
function toDateInputValue(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toClientJSON(r) {
  return {
    referenceNo: r.requestReferenceNo,
    runNumber: r.runNumber,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    tel: r.requesterTel,
    agencyCategory: r.agencyCategory,
    agencyUnit: r.agencyUnit,
    paperSize: r.paperSize,
    colorMode: r.colorMode,
    printSide: r.printSide,
    finishing: r.finishingMethods,
    documentType: r.documentType,
    paperSource: r.paperSource,
    copyLabelEnabled: r.copyLabelEnabled,
    copyLabelMode: r.copyLabelMode,
    copyLabelPrefix: r.copyLabelPrefix,
    copyLabelStart: r.copyLabelStart,
    copyLabelManual: r.copyLabelManual,
    itemList: r.itemList,
    originalPages: r.originalPages,
    copies: r.numberOfCopies,
    submissionDate: r.submissionDate.toISOString(),
    dropoffDeadlineDate: r.originalDocDeadline.toISOString(),
    originalDocReceivedTimestamp: r.originalDocReceivedTimestamp ? r.originalDocReceivedTimestamp.toISOString() : null,
    completionDateProposed: toDateInputValue(r.appointmentDateProposed),
    completionDateConfirmed: r.appointmentDateConfirmed ? toDateInputValue(r.appointmentDateConfirmed) : null,
    claimCode: r.claimCode,
    statusCode: STATUS_TO_CODE[r.status],
    rejectionReason: r.rejectionReason,
    reviewedByOfficer: r.reviewedByOfficerName,
    handedOverByOfficer: r.handedOverByOfficerName,
    receiverName: r.receiverName,
    receiverPosition: r.receiverPosition,
    receiverWorkplace: r.receiverWorkplace,
    receiverWorkPhone: r.receiverWorkPhone,
    completedTimestamp: r.completedTimestamp ? r.completedTimestamp.toISOString() : null
  };
}

async function list() {
  const rows = await prisma.request.findMany({ orderBy: { submissionDate: "desc" } });
  return rows.map(toClientJSON);
}

async function getByRef(ref) {
  const row = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  return row ? toClientJSON(row) : null;
}

async function getByClaimCode(code) {
  const row = await prisma.request.findFirst({ where: { claimCode: code } });
  return row ? toClientJSON(row) : null;
}

async function listByRequester(requesterEmail) {
  const rows = await prisma.request.findMany({
    where: { requesterEmail },
    orderBy: { submissionDate: "desc" }
  });
  return rows.map(toClientJSON);
}

// officer/queue.ejs only ever needs this small, naturally-bounded slice —
// filtering server-side instead of fetching every request (GET /api/requests)
// and filtering in the browser, which visibly slowed down once the table
// grew into the tens of thousands of rows.
async function listAwaiting() {
  const rows = await prisma.request.findMany({
    where: { status: "AWAITING_ORIGINAL_DOCUMENT" },
    orderBy: { submissionDate: "asc" }
  });
  return rows.map(toClientJSON);
}

// officer/printing-jobs.ejs — same rationale as listAwaiting() above.
async function listPrinting() {
  const rows = await prisma.request.findMany({
    where: { status: "PRINTING_IN_PROGRESS" },
    orderBy: { originalDocReceivedTimestamp: "asc" }
  });
  return rows.map(toClientJSON);
}

// Single narrow-column scan (just submissionDate) — used to populate the
// history page's year filter, and internally by searchHistory() for a
// month-only filter (see below). Much cheaper than fetching full rows.
async function listAvailableYears() {
  const rows = await prisma.request.findMany({ select: { submissionDate: true } });
  return Array.from(new Set(rows.map((r) => r.submissionDate.getFullYear()))).sort((a, b) => b - a);
}

// officer/history.ejs search/filter/pagination, computed server-side —
// same rationale as listAwaiting() above: the old GET /api/requests + browser
// JS filter/paginate approach shipped every row over the network on every
// page load, which doesn't scale.
async function searchHistory({ status, agencyCategory, year, month, q, page, pageSize } = {}) {
  const andClauses = [];
  if (status && CODE_TO_STATUS[status]) andClauses.push({ status: CODE_TO_STATUS[status] });
  if (agencyCategory) andClauses.push({ agencyCategory });

  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";
  if (hasYear && hasMonth) {
    const y = Number(year), m = Number(month);
    andClauses.push({ submissionDate: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } });
  } else if (hasYear) {
    const y = Number(year);
    andClauses.push({ submissionDate: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } });
  } else if (hasMonth) {
    // No year given — match this calendar month across every year that has any data.
    const m = Number(month);
    const years = await listAvailableYears();
    andClauses.push({
      OR: years.map((y) => ({ submissionDate: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } }))
    });
  }

  if (q) {
    const contains = { contains: q, mode: "insensitive" };
    andClauses.push({
      OR: [
        { requestReferenceNo: contains },
        { runNumber: contains },
        { requesterName: contains },
        { receiverName: contains },
        { claimCode: contains },
        { reviewedByOfficerName: contains },
        { handedOverByOfficerName: contains }
      ]
    });
  }

  const where = andClauses.length > 0 ? { AND: andClauses } : {};
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

  const [total, rows] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.findMany({
      where,
      orderBy: { submissionDate: "desc" },
      skip: (pageNum - 1) * size,
      take: size
    })
  ]);

  return { records: rows.map(toClientJSON), total, page: pageNum, pageSize: size };
}

// Statuses that mean paper was actually consumed (mirrors PRINTED_STATUSES
// in officer/dashboard.ejs, but against the raw DB enum, not the client's
// translated status codes).
const PRINTED_STATUS_ENUMS = ["PRINTING_IN_PROGRESS", "READY_FOR_PICKUP", "COMPLETED"];

const DASHBOARD_SELECT = {
  agencyCategory: true,
  agencyUnit: true,
  originalPages: true,
  numberOfCopies: true,
  printSide: true,
  status: true,
  submissionDate: true
};

// Real physical paper sheets, not printed pages — double-sided halves the
// sheet count per page (matches the Total Sheets calc on the request form,
// FR-17, and the identical client-side helper this replaces in dashboard.ejs).
function computeSheets(r) {
  const pages = Number(r.originalPages || 0);
  const copies = Number(r.numberOfCopies || 0);
  if (r.printSide === PRINT_SIDE_TH.double) return Math.ceil(pages / 2) * copies;
  return pages * copies;
}

// Dashboard aggregation, computed server-side so the browser never has to
// download/process every raw request row — the naive version of this
// (GET /api/requests + summing in browser JS) visibly slows down once the
// table has tens of thousands of rows.
async function dashboardSummary({ year, documentType, paperSource } = {}) {
  const scopedWhere = {};
  if (documentType) scopedWhere.documentType = documentType;
  if (paperSource) scopedWhere.paperSource = paperSource;
  if (year) {
    const y = Number(year);
    scopedWhere.submissionDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }

  // Trend chart always spans every year but still respects documentType/paperSource.
  // When no year filter is set, that's the exact same query as scopedRows —
  // skip the duplicate round-trip and reuse the one result for both.
  const scopedRows = await prisma.request.findMany({ where: scopedWhere, select: DASHBOARD_SELECT });
  const trendRows = year
    ? await prisma.request.findMany({
        where: { documentType: scopedWhere.documentType, paperSource: scopedWhere.paperSource },
        select: DASHBOARD_SELECT
      })
    : scopedRows;

  const printedRows = scopedRows.filter((r) => PRINTED_STATUS_ENUMS.includes(r.status));
  const totalRequests = scopedRows.length;
  const totalSheets = printedRows.reduce((sum, r) => sum + computeSheets(r), 0);
  const avgSheets = totalRequests > 0 ? Math.round(totalSheets / totalRequests) : 0;
  const activeUnits = new Set(printedRows.map((r) => `${r.agencyCategory}||${r.agencyUnit}`)).size;

  const categoryMap = {};
  const unitMap = {};
  scopedRows.forEach((r) => {
    if (!categoryMap[r.agencyCategory]) categoryMap[r.agencyCategory] = { category: r.agencyCategory, count: 0, copies: 0, sheets: 0 };
    categoryMap[r.agencyCategory].count += 1;

    const unitKey = `${r.agencyCategory}||${r.agencyUnit}`;
    if (!unitMap[unitKey]) unitMap[unitKey] = { unit: r.agencyUnit, category: r.agencyCategory, count: 0, copies: 0, sheets: 0 };
    unitMap[unitKey].count += 1;

    if (PRINTED_STATUS_ENUMS.includes(r.status)) {
      const sheets = computeSheets(r);
      categoryMap[r.agencyCategory].copies += Number(r.numberOfCopies || 0);
      categoryMap[r.agencyCategory].sheets += sheets;
      unitMap[unitKey].copies += Number(r.numberOfCopies || 0);
      unitMap[unitKey].sheets += sheets;
    }
  });

  const yearTrend = {};
  trendRows.forEach((r) => {
    if (PRINTED_STATUS_ENUMS.includes(r.status)) {
      const y = r.submissionDate.getFullYear();
      yearTrend[y] = (yearTrend[y] || 0) + computeSheets(r);
    }
  });
  const availableYears = Array.from(new Set(trendRows.map((r) => r.submissionDate.getFullYear()))).sort((a, b) => b - a);

  return {
    totalRequests,
    totalSheets,
    avgSheets,
    activeUnits,
    availableYears,
    yearTrend,
    categoryBreakdown: Object.values(categoryMap),
    unitBreakdown: Object.values(unitMap)
  };
}

// FR-03/04/05 — validates the proposed completion date server-side (never
// trust the client's disabled-button UX alone) and assigns the Request
// Reference Number + drop-off deadline atomically.
async function create(input) {
  const submissionDate = new Date();
  // "Z" forces UTC-midnight parsing, matching the UTC convention @db.Date
  // columns round-trip as (see toDateInputValue below) — without it, this
  // parses as *local* midnight, which now that the server's TZ is
  // Asia/Bangkok (not UTC) shifted the stored date back by a day.
  const proposed = new Date(input.appointmentDateProposed + "T00:00:00Z");
  const minDate = businessDays.minCompletionDate(submissionDate);
  minDate.setHours(0, 0, 0, 0);

  if (isNaN(proposed.getTime()) || proposed < minDate) {
    return { error: "completion-date-too-soon" };
  }
  if (!businessDays.isBusinessDay(proposed)) {
    return { error: "completion-date-weekend" };
  }

  const colorMode = COLOR_MODE_TH[input.colorMode];
  const printSide = PRINT_SIDE_TH[input.printSide];
  const documentType = DOCUMENT_TYPE_TH[input.documentType];
  if (!colorMode || !printSide || !documentType) {
    return { error: "missing-required-field" };
  }

  // FR-03: Paper Source is only a real choice for Exam; for General
  // Document the system fixes it to Requester-provided regardless of what
  // (if anything) the client sent — never trust the client alone here,
  // the same way the completion-date checks above are re-verified server-side.
  let paperSource;
  if (input.documentType === "exam") {
    paperSource = PAPER_SOURCE_TH[input.paperSource];
    if (!paperSource) return { error: "missing-required-field" };
  } else {
    paperSource = PAPER_SOURCE_TH.requester;
  }

  // Unrecognized codes are dropped rather than rejected — same tolerance
  // the old array-based finishingOption/bindingOption fields had.
  const finishingCodes = [].concat(input.finishingMethods || [])
    .filter((code) => Object.prototype.hasOwnProperty.call(FINISHING_METHOD_TH, code));

  if (input.documentType === "exam" && finishingCodes.some((code) => !EXAM_ALLOWED_FINISHING.has(code))) {
    return { error: "finishing-not-allowed-for-exam" };
  }

  const hasExclusiveConflict = EXCLUSIVE_FINISHING_GROUPS.some(
    (group) => finishingCodes.filter((code) => group.includes(code)).length > 1
  );
  if (hasExclusiveConflict) {
    return { error: "finishing-conflict" };
  }

  // Saddle-stitch folds the sheet in half and staples through the spine,
  // which physically requires both sides to already be printed.
  if (finishingCodes.includes("saddleStitch") && input.printSide !== "double") {
    return { error: "finishing-requires-double-side" };
  }

  const originalPages = parseInt(input.originalPages, 10);
  const pageCountInvalid = finishingCodes.some((code) => {
    const limit = FINISHING_PAGE_LIMITS[code];
    if (!limit) return false;
    const tooFew = limit.min !== undefined && originalPages < limit.min;
    const tooMany = limit.max !== undefined && originalPages > limit.max;
    const notMultiple = limit.multipleOf !== undefined && originalPages % limit.multipleOf !== 0;
    return tooFew || tooMany || notMultiple;
  });
  if (pageCountInvalid) {
    return { error: "finishing-page-count-invalid" };
  }

  const finishingMethods = finishingCodes.map((code) => FINISHING_METHOD_TH[code]);

  const numberOfCopies = parseInt(input.numberOfCopies, 10);
  if (!numberOfCopies || numberOfCopies < 1 || numberOfCopies > MAX_COPIES) {
    return { error: "copies-out-of-range" };
  }

  const copyLabelEnabled = !!input.copyLabelEnabled;
  const copyLabelMode = copyLabelEnabled && input.copyLabelMode === "manual" ? "manual" : "auto";
  let copyLabelPrefix = null;
  let copyLabelStart = null;
  let copyLabelManual = [];

  if (copyLabelEnabled && copyLabelMode === "manual") {
    // v0.7 — free-text label per copy, entered directly by the Requester
    // instead of an auto-incrementing prefix+number. Never trust the
    // client's disabled-input UX alone: re-check the count and that none
    // are blank server-side too.
    copyLabelManual = [].concat(input.copyLabelManual || []).map((v) => (v || "").trim());
    if (copyLabelManual.length !== numberOfCopies || copyLabelManual.some((v) => !v)) {
      return { error: "copy-label-manual-invalid" };
    }
  } else if (copyLabelEnabled) {
    // Auto mode always runs 1..numberOfCopies (zero-padded to 3 digits on
    // display) — the Requester no longer picks a prefix or starting number.
    copyLabelStart = 1;
  }

  const dropoff = businessDays.computeDropoffDeadline(submissionDate);
  const requestReferenceNo = await counters.nextReferenceNo();

  const created = await prisma.request.create({
    data: {
      requestReferenceNo,
      requesterEmail: input.requesterEmail,
      requesterName: input.requesterName,
      requesterTel: input.requesterTel,
      agencyCategory: input.agencyCategory,
      agencyUnit: input.agencyUnit,
      paperSize: input.paperSize,
      colorMode,
      printSide,
      finishingMethods,
      documentType,
      paperSource,
      copyLabelEnabled,
      copyLabelMode: copyLabelEnabled ? copyLabelMode : null,
      copyLabelPrefix,
      copyLabelStart,
      copyLabelManual,
      itemList: input.itemList,
      originalPages,
      numberOfCopies,
      submissionDate,
      originalDocDeadline: dropoff.date,
      appointmentDateProposed: proposed,
      status: "AWAITING_ORIGINAL_DOCUMENT"
    }
  });

  return toClientJSON(created);
}

// FR-10 — Approve and Receive Master: issues RUN NUMBER + Claim Code via
// the atomic counters, confirms the completion date, moves the request
// into Printing In Progress.
async function approve(ref, { confirmedDate, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "AWAITING_ORIGINAL_DOCUMENT") return null;

  const runNumber = await counters.nextRunNumber();
  const claimCode = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      runNumber,
      claimCode,
      appointmentDateConfirmed: new Date(confirmedDate),
      originalDocReceivedTimestamp: new Date(),
      reviewedByOfficerEmail: officerEmail,
      reviewedByOfficerName: officerName,
      status: "PRINTING_IN_PROGRESS"
    }
  });
  return toClientJSON(updated);
}

// FR-11 — Reject with reason.
async function reject(ref, { reason, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "AWAITING_ORIGINAL_DOCUMENT") return null;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      reviewedByOfficerEmail: officerEmail,
      reviewedByOfficerName: officerName
    }
  });
  return toClientJSON(updated);
}

// FR-12 — Mark Ready for Pickup.
async function markReady(ref) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "PRINTING_IN_PROGRESS") return null;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: { status: "READY_FOR_PICKUP" }
  });
  return toClientJSON(updated);
}

// FR-14 — Record Receiver name/position/work phone (accountability record,
// not an identity check — no physical ID is inspected), confirm handover.
async function handover(ref, { receiverName, receiverPosition, receiverWorkplace, receiverWorkPhone, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "READY_FOR_PICKUP") return null;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      status: "COMPLETED",
      receiverName,
      receiverPosition,
      receiverWorkplace,
      receiverWorkPhone,
      completedTimestamp: new Date(),
      handedOverByOfficerEmail: officerEmail,
      handedOverByOfficerName: officerName
    }
  });
  return toClientJSON(updated);
}

const RATING_FIELDS = ["ratingStaffService", "ratingSystemEase", "ratingSpeed", "ratingPrintQuality", "ratingOverall"];

// The Requester is prompted to rate a completed request, and blocked from
// submitting a new one (see requireNoPendingEvaluation in routes/requester.js)
// while any of their completed requests still lacks an Evaluation. Always
// resolves the oldest one first, so a backlog of several unevaluated jobs
// gets cleared one at a time rather than all at once.
async function getPendingEvaluation(requesterEmail) {
  const row = await prisma.request.findFirst({
    where: { requesterEmail, status: "COMPLETED", evaluation: null },
    orderBy: { completedTimestamp: "asc" }
  });
  if (!row) return null;
  return { referenceNo: row.requestReferenceNo, itemList: row.itemList, completedTimestamp: row.completedTimestamp.toISOString() };
}

async function getEvaluation(ref) {
  return prisma.evaluation.findUnique({ where: { requestReferenceNo: ref } });
}

async function submitEvaluation(ref, { requesterEmail, ratings, comment }) {
  const request = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!request || request.requesterEmail !== requesterEmail || request.status !== "COMPLETED") {
    return { error: "not-eligible" };
  }

  const existing = await prisma.evaluation.findUnique({ where: { requestReferenceNo: ref } });
  if (existing) return { error: "already-evaluated" };

  const values = {};
  for (const field of RATING_FIELDS) {
    const n = parseInt((ratings || {})[field], 10);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: "invalid-rating" };
    values[field] = n;
  }

  const trimmedComment = comment ? String(comment).trim() : "";
  await prisma.evaluation.create({
    data: {
      requestReferenceNo: ref,
      requesterEmail,
      ...values,
      comment: trimmedComment || null
    }
  });
  return { ok: true };
}

module.exports = {
  list, getByRef, getByClaimCode, listByRequester, listAwaiting, listPrinting, listAvailableYears, searchHistory,
  create, approve, reject, markReady, handover, dashboardSummary, getPendingEvaluation, getEvaluation, submitEvaluation,
  STATUS_TO_CODE, CODE_TO_STATUS
};
