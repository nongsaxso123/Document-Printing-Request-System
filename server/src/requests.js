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
const notifications = require("./notifications");
const locations = require("./locations");
const agencies = require("./agencies");

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
  COMPLETED: "completed",
  CANCELLED: "cancelled"
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
    agencyCategoryId: r.agencyCategoryId,
    agencyUnitId: r.agencyUnitId,
    // Live English name when the caller included the relation (getByRef —
    // follows a rename), else null (print form / detail views fall back to
    // AGENCY_CATEGORY_EN's static copy for older cached lookups without it).
    agencyCategoryNameEn: r.agencyCategoryRef ? r.agencyCategoryRef.nameEn : null,
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
    reviewedByOfficerEmail: r.reviewedByOfficerEmail,
    handedOverByOfficer: r.handedOverByOfficerName,
    handedOverByOfficerEmail: r.handedOverByOfficerEmail,
    receiverName: r.receiverName,
    receiverPosition: r.receiverPosition,
    receiverWorkplace: r.receiverWorkplace,
    receiverWorkPhone: r.receiverWorkPhone,
    completedTimestamp: r.completedTimestamp ? r.completedTimestamp.toISOString() : null,
    // Live Location row when the caller included the relation (getByRef —
    // follows renames), otherwise what was true at submission.
    dropoffLocation: r.dropoffLocation ? locations.snapshotOf(r.dropoffLocation) : (r.dropoffLocationSnapshot || null),
    pickupLocation: r.pickupLocation ? locations.snapshotOf(r.pickupLocation) : (r.pickupLocationSnapshot || null),
    pickupAvailableFrom: r.pickupAvailableFrom ? r.pickupAvailableFrom.toISOString() : null
  };
}

async function list() {
  const rows = await prisma.request.findMany({ orderBy: { submissionDate: "desc" } });
  return rows.map(toClientJSON);
}

async function getByRef(ref) {
  const row = await prisma.request.findUnique({
    where: { requestReferenceNo: ref },
    include: { dropoffLocation: true, pickupLocation: true, agencyCategoryRef: true }
  });
  return row ? toClientJSON(row) : null;
}

// Counter Handover's only use of a claim code is looking up the one request
// currently waiting for pickup — scoping to READY_FOR_PICKUP here (rather
// than an unordered findFirst across all statuses) matters because claim
// codes are a random 6-digit value with no uniqueness check at generation
// (see approve()'s history before the collision fix), so the same code can
// legitimately exist on an unrelated older/completed request; without this
// scope, findFirst could return that other row instead and the counter
// would wrongly report "not found" even though the real match exists.
async function getByClaimCode(code) {
  const row = await prisma.request.findFirst({
    where: { claimCode: code, status: "READY_FOR_PICKUP" },
    include: { pickupLocation: true }
  });
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
// Shared by searchHistory (one page for the table) and the Excel export in
// src/reports.js (every matching row), so the export always matches exactly
// what the filters on screen show.
async function buildHistoryWhere({ status, agencyCategory, year, month, q, fromDate, toDate } = {}) {
  const andClauses = [];
  if (status && CODE_TO_STATUS[status]) andClauses.push({ status: CODE_TO_STATUS[status] });
  if (agencyCategory) andClauses.push({ agencyCategory });

  const hasCustomRange = !!(fromDate || toDate);
  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";
  if (hasCustomRange) {
    const range = {};
    if (fromDate) range.gte = parseDateOnly(fromDate);
    if (toDate) {
      const to = parseDateOnly(toDate);
      to.setDate(to.getDate() + 1); // toDate itself is inclusive
      range.lt = to;
    }
    andClauses.push({ submissionDate: range });
  } else if (hasYear && hasMonth) {
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

  return andClauses.length > 0 ? { AND: andClauses } : {};
}

async function searchHistory({ status, agencyCategory, year, month, q, page, pageSize, fromDate, toDate } = {}) {
  const where = await buildHistoryWhere({ status, agencyCategory, year, month, q, fromDate, toDate });
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
  agencyCategoryId: true,
  agencyUnit: true,
  agencyUnitId: true,
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

// Parses a plain "YYYY-MM-DD" (from an <input type="date">) as a *local*
// midnight Date, matching how submissionDate (a full DateTime, not @db.Date)
// is already bucketed elsewhere in this function via `new Date(y, 0, 1)` —
// unlike the @db.Date columns elsewhere in this codebase, this one is not
// UTC-midnight-normalized, so a "Z" suffix here would shift it by a day.
function parseDateOnly(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Dashboard aggregation, computed server-side so the browser never has to
// download/process every raw request row — the naive version of this
// (GET /api/requests + summing in browser JS) visibly slows down once the
// table has tens of thousands of rows. Two mutually-exclusive time-scoping
// modes, matching the UI's toggle: `year` (+ optional `month`, same
// year/month combination logic as searchHistory/searchEvaluations — either
// alone, together, or month-alone matching that calendar month across every
// year with data) as the default calendar mode, or `fromDate`/`toDate`
// (either or both) for an arbitrary custom range when the officer explicitly
// wants day-level precision. The custom range takes priority if both are
// somehow present.
async function dashboardSummary({ year, month, documentType, paperSource, fromDate, toDate } = {}) {
  const scopedWhere = {};
  if (documentType) scopedWhere.documentType = documentType;
  if (paperSource) scopedWhere.paperSource = paperSource;

  const hasCustomRange = !!(fromDate || toDate);
  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";

  if (hasCustomRange) {
    const range = {};
    if (fromDate) range.gte = parseDateOnly(fromDate);
    if (toDate) {
      const to = parseDateOnly(toDate);
      to.setDate(to.getDate() + 1); // toDate itself is inclusive
      range.lt = to;
    }
    scopedWhere.submissionDate = range;
  } else if (hasYear && hasMonth) {
    const y = Number(year), m = Number(month);
    scopedWhere.submissionDate = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
  } else if (hasYear) {
    const y = Number(year);
    scopedWhere.submissionDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  } else if (hasMonth) {
    // No year given — match this calendar month across every year that has any data.
    const m = Number(month);
    const years = await listAvailableYears();
    scopedWhere.OR = years.map((y) => ({ submissionDate: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } }));
  }

  // Trend chart always spans every year but still respects documentType/paperSource.
  // When no date filter is set at all, that's the exact same query as
  // scopedRows — skip the duplicate round-trip and reuse the one result for both.
  const dateFilterActive = hasCustomRange || hasYear || hasMonth;
  const scopedRows = await prisma.request.findMany({ where: scopedWhere, select: DASHBOARD_SELECT });
  const trendRows = dateFilterActive
    ? await prisma.request.findMany({
        where: { documentType: scopedWhere.documentType, paperSource: scopedWhere.paperSource },
        select: DASHBOARD_SELECT
      })
    : scopedRows;

  const printedRows = scopedRows.filter((r) => PRINTED_STATUS_ENUMS.includes(r.status));
  const totalRequests = scopedRows.length;
  const totalSheets = printedRows.reduce((sum, r) => sum + computeSheets(r), 0);
  const avgSheets = totalRequests > 0 ? Math.round(totalSheets / totalRequests) : 0;
  // Grouped by id when the request has one (survives a category/unit
  // rename — see the plan comment on Request.agencyCategoryId), falling
  // back to the raw strings for older/unmatched rows that have none.
  const activeUnits = new Set(printedRows.map((r) => (r.agencyUnitId != null ? `id:${r.agencyUnitId}` : `str:${r.agencyCategory}||${r.agencyUnit}`))).size;

  // Current category names (nameEn especially) for whichever ids show up
  // below — cheap, the whole table is a dozen rows — so a rename is
  // reflected immediately instead of only in newly-submitted rows.
  const categoryById = new Map((await agencies.listAllCategories()).map((c) => [c.id, c]));

  const categoryMap = {};
  const unitMap = {};
  scopedRows.forEach((r) => {
    const live = r.agencyCategoryId != null ? categoryById.get(r.agencyCategoryId) : null;
    const catKey = r.agencyCategoryId != null ? `id:${r.agencyCategoryId}` : `str:${r.agencyCategory}`;
    if (!categoryMap[catKey]) {
      categoryMap[catKey] = {
        category: live ? live.nameTh : r.agencyCategory,
        categoryEn: live ? live.nameEn : null,
        count: 0, copies: 0, sheets: 0
      };
    }
    categoryMap[catKey].count += 1;

    const unitKey = r.agencyUnitId != null ? `id:${r.agencyUnitId}` : `str:${catKey}||${r.agencyUnit}`;
    if (!unitMap[unitKey]) {
      unitMap[unitKey] = {
        unit: r.agencyUnit,
        category: categoryMap[catKey].category,
        categoryEn: categoryMap[catKey].categoryEn,
        count: 0, copies: 0, sheets: 0
      };
    }
    unitMap[unitKey].count += 1;

    if (PRINTED_STATUS_ENUMS.includes(r.status)) {
      const sheets = computeSheets(r);
      categoryMap[catKey].copies += Number(r.numberOfCopies || 0);
      categoryMap[catKey].sheets += sheets;
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
//
// Shared by create() and update(): validates one submitted form and maps it
// to the DB columns. `submissionDate` is "now" for a new request but the
// original submission time when editing, so an edit never moves the
// minimum-completion-date goalposts (a request filed Monday can still keep
// its date if edited Thursday).
function buildRequestFields(input, submissionDate) {
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

  return {
    fields: {
      requesterName: input.requesterName,
      requesterTel: input.requesterTel,
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
      appointmentDateProposed: proposed
    }
  };
}

// Where the Requester will bring the original document. With no drop-off
// place configured at all there is nothing to choose (no fields, not an
// error); with exactly one the form doesn't ask, so a missing id means "that
// one"; with several the id must name an active one that accepts drop-offs —
// re-checked here rather than trusting the form's <select>.
async function resolveDropoff(rawId) {
  const options = await locations.listActive("dropoff");
  if (options.length === 0) return { fields: {} };

  const id = parseInt(rawId, 10);
  const chosen = id ? options.find((l) => l.id === id) : (options.length === 1 ? options[0] : null);
  if (!chosen) return { error: "dropoff-location-invalid" };

  return { fields: { dropoffLocationId: chosen.id, dropoffLocationSnapshot: locations.snapshotOf(chosen) }, location: chosen };
}

async function create(input) {
  const submissionDate = new Date();
  const built = buildRequestFields(input, submissionDate);
  if (built.error) return built;
  const dropoffLocation = await resolveDropoff(input.dropoffLocationId);
  if (dropoffLocation.error) return dropoffLocation;
  const agency = await agencies.resolveAgency({
    categoryId: input.agencyCategoryId, unitId: input.agencyUnitId, unitText: input.agencyUnitText
  });
  if (agency.error) return agency;

  const dropoffWindow = locations.hourWindowOf(dropoffLocation.location);
  const dropoff = businessDays.computeDropoffDeadline(submissionDate, dropoffWindow ? dropoffWindow.end : undefined);
  const requestReferenceNo = await counters.nextReferenceNo();

  const created = await prisma.request.create({
    data: {
      requestReferenceNo,
      requesterEmail: input.requesterEmail,
      ...built.fields,
      ...dropoffLocation.fields,
      ...agency.fields,
      submissionDate,
      originalDocDeadline: dropoff.date,
      status: "AWAITING_ORIGINAL_DOCUMENT"
    }
  });

  // Best-effort and non-blocking: the submission already succeeded in the
  // database, so email/notification delivery (which can be slow) must not
  // delay the HTTP response — a slow response is what caused requesters to
  // double-click submit and create duplicate requests.
  notifications.notifyRequesterStatusChange(created, "submitted")
    .catch((err) => console.error("[notifications] submitted notify failed:", err.message));
  notifications.notifyOfficersNewRequest(created)
    .catch((err) => console.error("[notifications] new-request officer notify failed:", err.message));

  return toClientJSON(created);
}

// A request can be corrected until an Officer acts on it: the Requester has
// to bring the original document to the counter before anyone approves it,
// so it normally sits in AWAITING_ORIGINAL_DOCUMENT for a while. Ownership
// and status live in the WHERE of a single updateMany (same pattern as
// cancel() below) so an edit can never overwrite a request an Officer just
// approved/rejected, or one that isn't the caller's.
async function findEditable(ref, requesterEmail) {
  return prisma.request.findFirst({
    where: { requestReferenceNo: ref, requesterEmail, status: "AWAITING_ORIGINAL_DOCUMENT" }
  });
}

async function update(ref, input) {
  const existing = await findEditable(ref, input.requesterEmail);
  if (!existing) return { error: "not-editable" };

  const built = buildRequestFields(input, existing.submissionDate);
  if (built.error) return built;
  const dropoffLocation = await resolveDropoff(input.dropoffLocationId);
  if (dropoffLocation.error) return dropoffLocation;
  const agency = await agencies.resolveAgency({
    categoryId: input.agencyCategoryId, unitId: input.agencyUnitId, unitText: input.agencyUnitText
  });
  if (agency.error) return agency;

  const result = await prisma.request.updateMany({
    where: { requestReferenceNo: ref, requesterEmail: input.requesterEmail, status: "AWAITING_ORIGINAL_DOCUMENT" },
    data: { ...built.fields, ...dropoffLocation.fields, ...agency.fields }
  });
  if (result.count === 0) return { error: "not-editable" };

  const updated = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  return toClientJSON(updated);
}

// Inverse of the write-boundary mapping in buildRequestFields: turns a
// stored request back into the short codes / raw values the request form's
// own inputs use, so the same form can be re-opened pre-filled for editing.
function invertMap(map) {
  return Object.fromEntries(Object.entries(map).map(([code, label]) => [label, code]));
}

async function getEditPrefill(ref, requesterEmail) {
  const row = await findEditable(ref, requesterEmail);
  if (!row) return null;

  const finishingByLabel = invertMap(FINISHING_METHOD_TH);
  return {
    referenceNo: row.requestReferenceNo,
    requesterName: row.requesterName,
    requesterTel: row.requesterTel,
    agencyCategory: row.agencyCategory,
    agencyUnit: row.agencyUnit,
    agencyCategoryId: row.agencyCategoryId,
    agencyUnitId: row.agencyUnitId,
    dropoffLocationId: row.dropoffLocationId,
    form: {
      documentType: invertMap(DOCUMENT_TYPE_TH)[row.documentType] || "",
      paperSource: invertMap(PAPER_SOURCE_TH)[row.paperSource] || "",
      paperSize: row.paperSize,
      colorMode: invertMap(COLOR_MODE_TH)[row.colorMode] || "",
      printSide: invertMap(PRINT_SIDE_TH)[row.printSide] || "",
      finishingMethods: row.finishingMethods.map((label) => finishingByLabel[label]).filter(Boolean),
      itemList: row.itemList,
      originalPages: row.originalPages,
      copies: row.numberOfCopies,
      copyLabelEnabled: row.copyLabelEnabled,
      copyLabelMode: row.copyLabelMode || "auto",
      copyLabelManual: row.copyLabelManual[0] || "",
      completionDate: toDateInputValue(row.appointmentDateProposed)
    }
  };
}

// Claim Code is a random 6-digit value (1M possible codes) with no
// database-level uniqueness constraint — at the ~19k codes already issued
// in this dataset, birthday-paradox collisions are expected (found 184
// duplicate codes in the live data, 2026-09-01), and a collision against an
// unrelated request can make Counter Handover's claim-code search wrongly
// report "not found" for a real, ready-for-pickup request (see the scoped
// query in getByClaimCode above, added the same day as a fix for exactly
// that).
//
// Only checked against requests still "live" (PRINTING_IN_PROGRESS /
// READY_FOR_PICKUP) — a claim code stops mattering once a request is
// COMPLETED (Counter Handover never looks it up again after that), so
// there's no need to keep checking against the whole ever-growing request
// history forever. This also keeps the live set roughly constant-sized
// over time instead of the check getting slower/more collision-prone as
// total request volume grows.
async function generateUniqueClaimCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const clash = await prisma.request.findFirst({
      where: { claimCode: code, status: { in: ["PRINTING_IN_PROGRESS", "READY_FOR_PICKUP"] } }
    });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique claim code");
}

// FR-10 — Approve and Receive Master: issues RUN NUMBER + Claim Code via
// the atomic counters, confirms the completion date, moves the request
// into Printing In Progress.
async function approve(ref, { confirmedDate, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "AWAITING_ORIGINAL_DOCUMENT") return null;

  const runNumber = await counters.nextRunNumber();
  const claimCode = await generateUniqueClaimCode();

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

  // Non-blocking: don't make the officer wait on email/notification delivery
  // before the UI can report the approval as done.
  notifications.notifyRequesterStatusChange(updated, "approved", {
    claimCode: updated.claimCode,
    confirmedDate: updated.appointmentDateConfirmed
  }).catch((err) => console.error("[notifications] approved notify failed:", err.message));

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

  notifications.notifyRequesterStatusChange(updated, "rejected", { reason: updated.rejectionReason })
    .catch((err) => console.error("[notifications] rejected notify failed:", err.message));

  return toClientJSON(updated);
}

// Requester-initiated withdrawal of a request that hasn't been acted on yet
// (same window as update() above). updateMany's WHERE
// (not a findUnique-then-update) makes the status flip and that race check
// one atomic statement: if the Officer's approve()/reject() already moved
// the row off AWAITING_ORIGINAL_DOCUMENT, this simply matches zero rows
// instead of overwriting whatever they just did.
async function cancel(ref, { requesterEmail }) {
  const result = await prisma.request.updateMany({
    where: { requestReferenceNo: ref, requesterEmail, status: "AWAITING_ORIGINAL_DOCUMENT" },
    data: { status: "CANCELLED" }
  });
  if (result.count === 0) return null;

  const updated = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });

  notifications.notifyOfficersCancelled(updated)
    .catch((err) => console.error("[notifications] cancelled notify failed:", err.message));

  return toClientJSON(updated);
}

// Where the finished copies can be collected. Unlike the drop-off place the
// Requester chooses, this is the Officer's call, made when marking ready:
// nothing sent means "the default pickup place"; an id must name an active
// place that accepts pickups. With no pickup place configured at all there is
// nothing to record (no fields, not an error).
async function resolvePickup(rawId) {
  const options = await locations.listActive("pickup");
  if (options.length === 0) return { fields: {} };

  const id = parseInt(rawId, 10);
  const chosen = id
    ? options.find((l) => l.id === id)
    : (options.find((l) => l.isDefaultPickup) || options[0]);
  if (!chosen) return { error: "pickup-location-invalid" };

  return { fields: { pickupLocationId: chosen.id, pickupLocationSnapshot: locations.snapshotOf(chosen) }, location: chosen };
}

// The moment from which the Requester may collect the copies, chosen by the
// Officer. Must fall on a business day inside the pickup place's real hours
// (`window`, from locations.hourWindowOf — the site-wide default window
// when that place has no structured hours, or none was chosen at all);
// re-checked here rather than trusting the modal's lists. Omitted means "as
// soon as possible": now if the counter is open, otherwise the next
// opening.
function resolvePickupTime(raw, now = new Date(), window) {
  const start = window ? window.start : businessDays.BUSINESS_HOUR_START;
  const end = window ? window.end : businessDays.BUSINESS_HOUR_END;
  const hourOf = (d) => d.getHours() + d.getMinutes() / 60;

  if (raw == null || raw === "") {
    if (businessDays.isBusinessDay(now) && hourOf(now) < end) {
      if (hourOf(now) >= start) return { value: now };
      const opening = businessDays.setClockHour(new Date(now), start);
      return { value: opening };
    }
    const next = businessDays.setClockHour(businessDays.nextBusinessDay(now), start);
    return { value: next };
  }

  const at = new Date(raw);
  if (isNaN(at.getTime())) return { error: "pickup-time-invalid" };
  const fiveMinutes = 5 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (at.getTime() < now.getTime() - fiveMinutes || at.getTime() > now.getTime() + thirtyDays) return { error: "pickup-time-invalid" };
  if (!businessDays.isBusinessDay(at) || hourOf(at) < start || hourOf(at) >= end) return { error: "pickup-time-invalid" };
  return { value: at };
}

// FR-12 — Mark Ready for Pickup. Returns null when the request isn't in
// Printing In Progress, { error } for a bad pickup place or time.
async function markReady(ref, { pickupLocationId, pickupAvailableFrom } = {}) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "PRINTING_IN_PROGRESS") return null;

  const pickup = await resolvePickup(pickupLocationId);
  if (pickup.error) return pickup;
  const pickupWindow = locations.hourWindowOf(pickup.location);
  const availableFrom = resolvePickupTime(pickupAvailableFrom, new Date(), pickupWindow);
  if (availableFrom.error) return availableFrom;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: { status: "READY_FOR_PICKUP", ...pickup.fields, pickupAvailableFrom: availableFrom.value }
  });

  notifications.notifyRequesterStatusChange(updated, "ready")
    .catch((err) => console.error("[notifications] ready notify failed:", err.message));

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

  notifications.notifyRequesterStatusChange(updated, "completed")
    .catch((err) => console.error("[notifications] completed notify failed:", err.message));

  return toClientJSON(updated);
}

// D — location relocation notices (src/locations.js admin edit/archive
// flows). "In-flight" for a purpose means a request that still needs that
// place: AWAITING_ORIGINAL_DOCUMENT for drop-off, READY_FOR_PICKUP for
// pickup — anything past that has already used the place, so a later edit
// there can't affect it.
const IN_FLIGHT_STATUS = { dropoff: "AWAITING_ORIGINAL_DOCUMENT", pickup: "READY_FOR_PICKUP" };
const IN_FLIGHT_FIELD = { dropoff: "dropoffLocationId", pickup: "pickupLocationId" };

async function findInFlightForLocation(locationId, purpose) {
  return prisma.request.findMany({
    where: { [IN_FLIGHT_FIELD[purpose]]: Number(locationId), status: IN_FLIGHT_STATUS[purpose] }
  });
}

// Single-location counts for the "does this edit/archive affect anyone?"
// check the admin UI needs before it even offers the typo/moved choice.
async function countInFlightForLocation(locationId) {
  const [dropoff, pickup] = await Promise.all([
    prisma.request.count({ where: { dropoffLocationId: Number(locationId), status: IN_FLIGHT_STATUS.dropoff } }),
    prisma.request.count({ where: { pickupLocationId: Number(locationId), status: IN_FLIGHT_STATUS.pickup } })
  ]);
  return { dropoff, pickup };
}

// Bulk version of the same counts, keyed by location id — what the admin
// locations list uses so it isn't N+1 queries for N locations.
async function countInFlightByLocation() {
  const [dropoffRows, pickupRows] = await Promise.all([
    prisma.request.groupBy({
      by: ["dropoffLocationId"],
      where: { status: IN_FLIGHT_STATUS.dropoff, dropoffLocationId: { not: null } },
      _count: { _all: true }
    }),
    prisma.request.groupBy({
      by: ["pickupLocationId"],
      where: { status: IN_FLIGHT_STATUS.pickup, pickupLocationId: { not: null } },
      _count: { _all: true }
    })
  ]);
  const map = {};
  dropoffRows.forEach((r) => {
    map[r.dropoffLocationId] = { dropoff: r._count._all, pickup: (map[r.dropoffLocationId] || {}).pickup || 0 };
  });
  pickupRows.forEach((r) => {
    map[r.pickupLocationId] = { dropoff: (map[r.pickupLocationId] || {}).dropoff || 0, pickup: r._count._all };
  });
  return map;
}

// Notifies every in-flight request for `purpose` that the place changed —
// either in place (an admin-confirmed "actually moved" edit, where
// fromLocationId === toLocationId and only the place's own data changed)
// or onto a replacement (archiving a place that still has in-flight
// requests). Only the second case reassigns the request's location id —
// an in-place edit already shows the new details wherever the request's
// live relation is read (see getByRef/getByClaimCode), no reassignment
// needed. Returns how many requests were notified, for the admin banner.
async function notifyLocationChange({ purpose, fromLocationId, toLocationId, oldLocation, newLocation }) {
  const affected = await findInFlightForLocation(fromLocationId, purpose);
  if (affected.length === 0) return 0;

  if (Number(toLocationId) !== Number(fromLocationId)) {
    await prisma.request.updateMany({
      where: { [IN_FLIGHT_FIELD[purpose]]: Number(fromLocationId), status: IN_FLIGHT_STATUS[purpose] },
      data: { [IN_FLIGHT_FIELD[purpose]]: Number(toLocationId) }
    });
  }

  await Promise.all(affected.map((r) => notifications.notifyLocationMoved(r, purpose, oldLocation, newLocation)));
  return affected.length;
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

// Overview KPIs for the officer-facing evaluation report — same server-side
// aggregation philosophy as dashboardSummary (never ship every raw row to
// the browser just to average it). Scoped by the year the evaluation was
// *submitted*; in practice this lines up with the completion year almost
// always, since requireNoPendingEvaluation blocks a Requester's next
// submission until they clear the backlog, so evaluations happen soon after
// handover rather than piling up across years.
async function evaluationsSummary({ year } = {}) {
  const allEvaluations = await prisma.evaluation.findMany({
    select: {
      ratingStaffService: true, ratingSystemEase: true, ratingSpeed: true,
      ratingPrintQuality: true, ratingOverall: true, submittedAt: true, comment: true
    }
  });

  const availableYears = Array.from(new Set(allEvaluations.map((e) => e.submittedAt.getFullYear())))
    .sort((a, b) => b - a);

  const scoped = year ? allEvaluations.filter((e) => e.submittedAt.getFullYear() === Number(year)) : allEvaluations;
  const totalEvaluated = scoped.length;
  const totalWithComments = scoped.filter((e) => e.comment).length;

  const averages = {};
  RATING_FIELDS.forEach((field) => {
    averages[field] = totalEvaluated > 0
      ? Math.round((scoped.reduce((sum, e) => sum + e[field], 0) / totalEvaluated) * 10) / 10
      : 0;
  });

  const completedWhere = { status: "COMPLETED" };
  if (year) {
    const y = Number(year);
    completedWhere.completedTimestamp = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }
  const totalCompleted = await prisma.request.count({ where: completedWhere });

  return { totalEvaluated, totalCompleted, totalWithComments, averages, availableYears };
}

// All years that have at least one evaluation, regardless of any other
// filter — mirrors listAvailableYears() for requests, used the same way:
// building the "match this calendar month across every year with data" OR
// clause below when a month is picked without a year.
async function listEvaluationYears() {
  const rows = await prisma.evaluation.findMany({ select: { submittedAt: true } });
  return Array.from(new Set(rows.map((r) => r.submittedAt.getFullYear()))).sort((a, b) => b - a);
}

// Individual feedback log — paginated + searchable, same server-side pattern
// as searchHistory (including the year/month combination logic below, copied
// from there). `hasComment` narrows to evaluations with written feedback
// (used by the Overview tab's "needs attention" feed, and by the list tab's
// "only with comments" checkbox); `sort: "lowest"` surfaces the worst-rated
// feedback first instead of the most recent, since the point of the Overview
// feed is spotting what to improve, not a chronological log.
// Shared by searchEvaluations and the Excel export (src/reports.js).
async function buildEvaluationsWhere({ year, month, q, hasComment } = {}) {
  const andClauses = [];

  const hasYear = year !== undefined && year !== null && year !== "";
  const hasMonth = month !== undefined && month !== null && month !== "";
  if (hasYear && hasMonth) {
    const y = Number(year), m = Number(month);
    andClauses.push({ submittedAt: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } });
  } else if (hasYear) {
    const y = Number(year);
    andClauses.push({ submittedAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } });
  } else if (hasMonth) {
    const m = Number(month);
    const years = await listEvaluationYears();
    andClauses.push({
      OR: years.map((y) => ({ submittedAt: { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) } }))
    });
  }

  if (hasComment) {
    andClauses.push({ comment: { not: null } });
  }
  if (q) {
    const contains = { contains: q, mode: "insensitive" };
    andClauses.push({
      OR: [
        { requestReferenceNo: contains },
        { comment: contains },
        { request: { requesterName: contains } },
        { request: { runNumber: contains } }
      ]
    });
  }

  return andClauses.length > 0 ? { AND: andClauses } : {};
}

function evaluationsOrderBy(sort) {
  return sort === "lowest"
    ? [{ ratingOverall: "asc" }, { submittedAt: "desc" }]
    : { submittedAt: "desc" };
}

async function searchEvaluations({ year, month, q, page, pageSize, hasComment, sort } = {}) {
  const where = await buildEvaluationsWhere({ year, month, q, hasComment });
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
  const orderBy = sort === "lowest"
    ? [{ ratingOverall: "asc" }, { submittedAt: "desc" }]
    : { submittedAt: "desc" };

  const [total, rows] = await Promise.all([
    prisma.evaluation.count({ where }),
    prisma.evaluation.findMany({
      where,
      orderBy,
      skip: (pageNum - 1) * size,
      take: size,
      include: {
        request: {
          select: {
            runNumber: true, requesterName: true, itemList: true,
            reviewedByOfficerName: true, handedOverByOfficerName: true
          }
        }
      }
    })
  ]);

  // Mirrors the officerLabel fallback used in officer/history.ejs: prefer
  // whoever handed the finished job over (the Requester's last real
  // interaction), fall back to whoever approved it at drop-off.
  const records = rows.map((e) => ({
    referenceNo: e.requestReferenceNo,
    runNumber: e.request.runNumber,
    requesterName: e.request.requesterName,
    itemList: e.request.itemList,
    officerName: e.request.handedOverByOfficerName || e.request.reviewedByOfficerName || null,
    ratingStaffService: e.ratingStaffService,
    ratingSystemEase: e.ratingSystemEase,
    ratingSpeed: e.ratingSpeed,
    ratingPrintQuality: e.ratingPrintQuality,
    ratingOverall: e.ratingOverall,
    comment: e.comment,
    submittedAt: e.submittedAt.toISOString()
  }));

  return { records, total, page: pageNum, pageSize: size };
}

module.exports = {
  list, getByRef, getByClaimCode, listByRequester, listAwaiting, listPrinting, listAvailableYears, searchHistory,
  create, update, getEditPrefill, approve, reject, cancel, markReady, resolvePickupTime, handover, dashboardSummary, getPendingEvaluation, getEvaluation, submitEvaluation,
  evaluationsSummary, searchEvaluations,
  buildHistoryWhere, buildEvaluationsWhere, evaluationsOrderBy, computeSheets, PRINTED_STATUS_ENUMS,
  countInFlightForLocation, countInFlightByLocation, notifyLocationChange,
  STATUS_TO_CODE, CODE_TO_STATUS
};
