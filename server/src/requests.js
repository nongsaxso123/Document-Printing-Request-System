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
    copyLabelPrefix: r.copyLabelPrefix,
    copyLabelStart: r.copyLabelStart,
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
    receiverIdInfo: r.receiverIdInfo,
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

  const copyLabelEnabled = !!input.copyLabelEnabled;
  const copyLabelPrefix = copyLabelEnabled ? (input.copyLabelPrefix || null) : null;
  const copyLabelStart = copyLabelEnabled && input.copyLabelStart !== undefined && input.copyLabelStart !== ""
    ? parseInt(input.copyLabelStart, 10)
    : null;

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
      copyLabelPrefix,
      copyLabelStart,
      itemList: input.itemList,
      originalPages,
      numberOfCopies: parseInt(input.numberOfCopies, 10),
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

// FR-14 — Verify Claim Code + physical ID, confirm handover.
async function handover(ref, { receiverName, receiverIdInfo, officerEmail, officerName }) {
  const existing = await prisma.request.findUnique({ where: { requestReferenceNo: ref } });
  if (!existing || existing.status !== "READY_FOR_PICKUP") return null;

  const updated = await prisma.request.update({
    where: { requestReferenceNo: ref },
    data: {
      status: "COMPLETED",
      receiverName,
      receiverIdInfo,
      completedTimestamp: new Date(),
      handedOverByOfficerEmail: officerEmail,
      handedOverByOfficerName: officerName
    }
  });
  return toClientJSON(updated);
}

module.exports = { list, getByRef, getByClaimCode, listByRequester, create, approve, reject, markReady, handover, STATUS_TO_CODE, CODE_TO_STATUS };
