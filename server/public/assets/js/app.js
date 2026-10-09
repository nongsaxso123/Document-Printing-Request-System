/* ODPRS prototype — shared helper logic (business day math, formatting, fake IDs)
   No backend: state is passed between pages via sessionStorage. Weekends only —
   no holiday calendar in this mockup. */

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ENG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 15;

/** English label for each Thai agency-category key in AGENCY_DATA (sub-unit strings already include an English name). */
const AGENCY_CATEGORY_EN = {
  "สำนักวิชา": "School",
  "ศูนย์": "Centre",
  "สถาบัน": "Institute",
  "สำนักงานบริหารกลาง": "Central Administration Office",
  "สำนักงานวิชาการ": "Academic Affairs Office",
  "สำนักงานวิจัย": "Research Office",
  "สำนักงานสภามหาวิทยาลัย": "Office of the University Council",
  "หน่วยตรวจสอบภายใน": "Internal Audit Division",
  "สำนักงานจัดการทรัพย์สินและรายได้": "Property and Asset Management Office",
  "ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง": "MFU Wellness Centre (Northern Region & GMS)",
  "หน่วยงานพิเศษ": "Special Unit",
  "หน่วยงานอื่นๆ": "Other"
};

/** หน่วยงาน/สังกัด: ประเภทหน่วยงาน -> รายชื่อหน่วยงานย่อย (ตามโครงสร้าง มฟล.) */
const AGENCY_DATA = {
  "สำนักวิชา": [
    "สำนักวิชาศิลปศาสตร์ (School of Liberal Arts)",
    "สำนักวิชาวิทยาศาสตร์ (School of Science)",
    "สำนักวิชาการจัดการ (School of Management)",
    "สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์ (School of Applied Digital Technology)",
    "สำนักวิชาอุตสาหกรรมเกษตร (School of Agro-Industry)",
    "สำนักวิชานิติศาสตร์ (School of Law)",
    "สำนักวิชาวิทยาศาสตร์เครื่องสำอาง (School of Cosmetic Science)",
    "สำนักวิชาวิทยาศาสตร์สุขภาพ (School of Health Science)",
    "สำนักวิชาพยาบาลศาสตร์ (School of Nursing)",
    "สำนักวิชาเวชศาสตร์ชะลอวัยและฟื้นฟูสุขภาพ (School of Anti-Aging and Regenerative Medicine)",
    "สำนักวิชาแพทยศาสตร์ (School of Medicine)",
    "สำนักวิชาทันตแพทยศาสตร์ (School of Dentistry)",
    "สำนักวิชานวัตกรรมสังคม (School of Social Innovation)",
    "สำนักวิชาจีนวิทยา (School of Sinology)",
    "สำนักวิชาการแพทย์บูรณาการ (School of Integrative Medicine)"
  ],
  "ศูนย์": [
    "ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ (Centre for Digital Technology and Information)",
    "ศูนย์เครื่องมือวิทยาศาสตร์และเทคโนโลยี (Scientific and Technological Instruments Centre)",
    "ศูนย์บรรณสารและสื่อการศึกษา (Learning Resources and Educational Media Centre)",
    "ศูนย์บริการวิชาการ (Centre for Academic Services)",
    "โรงพยาบาลศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง (MFU Medical Centre Hospital)"
  ],
  "สถาบัน": [
    "สถาบันนวัตกรรมการเรียนรู้มหาวิทยาลัยแม่ฟ้าหลวง (MFU Learning Innovation Institute)"
  ],
  "สำนักงานบริหารกลาง": [
    "ส่วนสารบรรณและอำนวยการ (Correspondence and Document Division)",
    "ส่วนทรัพยากรบุคคล (Human Resources Division)",
    "ส่วนนโยบายและแผน (Policy and Planning Division)",
    "ส่วนการเงินและบัญชี (Finance and Accounting Division)",
    "ส่วนพัสดุ (Procurement and Supplies Division)",
    "ส่วนประชาสัมพันธ์ (Public Relations Division)",
    "ส่วนอาคารสถานที่ (Buildings and Grounds Division)",
    "ส่วนนิติการ (Division of Legal Affairs)"
  ],
  "สำนักงานวิชาการ": [
    "ส่วนทะเบียนและประมวลผล (Registrar Division)",
    "ส่วนพัฒนานักศึกษา (Student Development Affairs Division)",
    "ส่วนพัฒนาความสัมพันธ์ระหว่างประเทศ (Global Relations Division)",
    "ส่วนประกันคุณภาพการศึกษาและพัฒนาหลักสูตร (Quality Assurance and Curriculum Development Division)",
    "สำนักงานบัณฑิตศึกษา (Office of the Postgraduate Studies)",
    "ส่วนจัดหางานและฝึกงานของนักศึกษา (Placement and Co-operative Education Division)",
    "โรงพยาบาลมหาวิทยาลัยแม่ฟ้าหลวง กรุงเทพมหานคร (MFU Hospital, Bangkok)",
    "ศูนย์กีฬามหาวิทยาลัยแม่ฟ้าหลวง (MFU Sport Complex Centre)",
    "วนาศรม (Wanasom)",
    "สำนักงานให้คำปรึกษาและช่วยเหลือนักศึกษา (Counselling Service Center)"
  ],
  "สำนักงานวิจัย": [
    "ส่วนบริหารงานวิจัย (Research Administration Division)",
    "ส่วนจัดการทรัพย์สินทางปัญญาและนวัตกรรม (Intellectual Property and Innovation Management Division)",
    "ศูนย์นวัตกรรมสมุนไพรครบวงจร มหาวิทยาลัยแม่ฟ้าหลวง (Medicinal Plant Innovation Centre of Mae Fah Luang University)",
    "สถาบันศิลปวัฒนธรรมและอารยธรรมลุ่มน้ำโขง (Institute for Mekong Basin Civilization, Art, and Culture)",
    "ศูนย์ความเป็นเลิศทางด้านการวิจัยเชื้อรา (Centre of Excellence in Fungal Research)",
    "สถาบันชาและกาแฟ แห่งมหาวิทยาลัยแม่ฟ้าหลวง (Tea and Coffee Institute of Mae Fah Luang University)",
    "ศูนย์ความเป็นเลิศด้านนวัตกรรมผลิตภัณฑ์ธรรมชาติ (Centre of Excellence in Natural Products Innovation)",
    "ศูนย์จัดการทรัพยากรธรรมชาติและสิ่งแวดล้อม (Centre for Natural Resources and Environmental Management)",
    "ศูนย์วิจัยและนวัตกรรมสังคมเชิงพื้นที่ เพื่อการพัฒนาอย่างยั่งยืน (Centre for Area-based Social Innovation and Research for Sustainable Development)"
  ],
  "สำนักงานสภามหาวิทยาลัย": [
    "สำนักงานสภามหาวิทยาลัย (Office of the University Council)"
  ],
  "หน่วยตรวจสอบภายใน": [
    "หน่วยตรวจสอบภายใน (Internal Audit Division)"
  ],
  "สำนักงานจัดการทรัพย์สินและรายได้": [
    "สำนักงานจัดการทรัพย์สินและรายได้ (Property and Asset Management Office)"
  ],
  "ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง": [
    "ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง (MFU Wellness Centre)"
  ],
  "หน่วยงานพิเศษ": [
    "ศูนย์ภาษาและวัฒนธรรมจีนสิรินธร (Sirindhorn Chinese Language and Culture Centre)"
  ],
  "หน่วยงานอื่นๆ": []
};

// A business day is Monday-Friday; Saturday/Sunday are government
// non-working days and never count (see server/src/businessDays.js, which
// re-validates this server-side — never trust this client copy alone).
function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addBusinessDays(date, count) {
  let d = new Date(date);
  let added = 0;
  while (added < count) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

function nextBusinessDay(date) {
  let d = addDays(date, 1);
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

function formatDateThai(date) {
  const buddhistYear = date.getFullYear() + 543;
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${buddhistYear}`;
}

function formatDateEn(date) {
  return `${date.getDate()} ${ENG_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDate(date, lang) {
  return lang === "en" ? formatDateEn(date) : formatDateThai(date);
}

function formatDateTimeThai(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateThai(date)}, ${hh}:${mm}`;
}

function formatDateTimeEn(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateEn(date)}, ${hh}:${mm}`;
}

function formatDateTime(date, lang) {
  return lang === "en" ? formatDateTimeEn(date) : formatDateTimeThai(date);
}

/** Earliest completion/appointment date a Requester may propose: submission + 3 business days. */
function minCompletionDate(submissionDate) {
  return addBusinessDays(submissionDate, 3);
}

/**
 * Deadline for hand-delivering the physical original documents.
 * Same business day by 15:00 if submitted within business hours on a business day;
 * otherwise the next business day, 09:00-15:00.
 * Returns raw data only (no label) so the label can be rendered in either language.
 */
function computeDropoffDeadline(submissionDate) {
  const hour = submissionDate.getHours() + submissionDate.getMinutes() / 60;
  const withinHours = hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;

  if (isBusinessDay(submissionDate) && withinHours) {
    return { date: submissionDate, sameDay: true };
  }

  const d = isBusinessDay(submissionDate) && hour < BUSINESS_HOUR_START
    ? submissionDate
    : nextBusinessDay(submissionDate);

  return { date: d, sameDay: false };
}

// Decimal-hour open/close window from a Location's structured hours (see
// src/locations.js hourWindowOf, the server-side equivalent this mirrors —
// no build step here, so keep the two in sync by hand) — null when the
// place has no structured hours (hand-typed legacy text, or none at all),
// so callers fall back to the site-wide BUSINESS_HOUR_START/END.
function hourWindowOf(loc) {
  if (!loc || loc.hoursOpenTime == null || loc.hoursCloseTime == null) return null;
  const toDecimal = (hhmm) => {
    const parts = hhmm.split(":");
    return Number(parts[0]) + Number(parts[1]) / 60;
  };
  return { fromDay: loc.hoursFromDay, toDay: loc.hoursToDay, start: toDecimal(loc.hoursOpenTime), end: toDecimal(loc.hoursCloseTime) };
}

function formatClockHour(hourDecimal) {
  const h = Math.floor(hourDecimal);
  const m = Math.round((hourDecimal % 1) * 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// The drop-off deadline split into the date and the time window, so a page can
// show them as a headline and a sub-line; formatDropoffLabel joins them back.
// `loc` is the drop-off place the request actually used (its real hours, not
// a hardcoded number) — pass it whenever it's known so this always agrees
// with wherever the same place's hours are shown elsewhere on the page.
function formatDropoffParts(info, lang, loc) {
  const dateStr = formatDate(info.date, lang);
  const window = hourWindowOf(loc);
  const closeText = formatClockHour(window ? window.end : BUSINESS_HOUR_END);
  const hoursText = loc ? pickLang(loc.hoursTh, loc.hoursEn, lang) : "";

  if (lang === "en") {
    return info.sameDay
      ? { date: `Today (${dateStr})`, time: `before ${closeText}` }
      : { date: dateStr, time: hoursText ? `during opening hours (${hoursText})` : `during business hours (before ${closeText})` };
  }
  return info.sameDay
    ? { date: `วันนี้ (${dateStr})`, time: `ก่อนเวลา ${closeText} น.` }
    : { date: dateStr, time: hoursText ? `ในเวลาทำการ (${hoursText})` : `ในเวลาทำการ (ก่อน ${closeText} น.)` };
}

function formatDropoffLabel(info, lang, loc) {
  const parts = formatDropoffParts(info, lang, loc);
  return parts.date + (lang === "en" ? ", " : " ") + parts.time;
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* =====================================================================
   Real data access lives in server/views/officer/*.ejs inline scripts now
   (fetch() calls against /api/requests, backed by Prisma/Postgres) — see
   file.md Appendix C step 3. The functions below (isOverdue, translateValue)
   are the only pieces of the old mock-store section still needed: pure
   helpers that operate on whatever record shape the real API returns.
   ===================================================================== */

function isOverdue(record) {
  return record.statusCode === "awaiting" && new Date(record.dropoffDeadlineDate) < new Date();
}

/** Looks up a stored spec value (e.g. "ขาวดำ สองหน้า") in TRANSLATIONS by its Thai canonical form and returns it in the current language; falls back to the raw value for free-text entries (e.g. a custom paper size). */
function translateValue(value) {
  for (const key in TRANSLATIONS) {
    if (TRANSLATIONS[key].th === value) return t(key);
  }
  return value;
}

/** Renders a list of stored option values (e.g. Finishing/Binding, each a Thai canonical string) as a translated, comma-joined list, or the "None" label when empty. */
function translateList(values) {
  return (values && values.length) ? values.map(translateValue).join(", ") : t("option.none");
}

// FR-17 — Total Sheets to Print, computed from stored data (never persisted
// — see the "Total Sheets to Print" definition). printSide is the stored
// Thai canonical value (see requests.js's PRINT_SIDE_TH), matching the
// convention translateValue() already relies on for every other stored option.
const PRINT_SIDE_DOUBLE_TH = "พิมพ์สองหน้า";
const PAPER_SOURCE_OFFICE_TH = "ฝ่ายทะเบียนจัดเตรียมให้";

// Printing loses ~5% of sheets to misfeeds/misprints/jams — when the
// Requester supplies their own paper (Exam paper-source choice, or any
// General Document, which is always Requester-provided), that loss is
// their problem, not the Registrar Division's. Surfacing the padded
// count up front — at form-fill time and again on the printed request
// slip's Paper Source field — is the agreed paper trail if a shortfall
// is disputed later.
const PAPER_WASTE_BUFFER_RATIO = 0.05;

function computeTotalSheets(originalPages, numberOfCopies, printSide) {
  const pages = Number(originalPages) || 0;
  const copies = Number(numberOfCopies) || 0;
  return printSide === PRINT_SIDE_DOUBLE_TH ? Math.ceil(pages / 2) * copies : pages * copies;
}

/** FR-17's paper-responsibility notice ("Requester must bring N sheets" / "Registrar Division will supply N sheets"), from a stored Paper Source value and an already-computed Total Sheets to Print. When the Requester is responsible, appends the ~5% print-waste-padded count they should actually bring. */
function paperResponsibilityText(paperSource, totalSheets, lang) {
  const numFmt = lang === "en" ? "en-US" : "th-TH";
  const sheets = Number(totalSheets) || 0;

  if (paperSource === PAPER_SOURCE_OFFICE_TH) {
    return t("newRequest.calc.responsibility.office").replace("{n}", sheets.toLocaleString(numFmt));
  }

  const buffered = Math.ceil(sheets * (1 + PAPER_WASTE_BUFFER_RATIO));
  return t("newRequest.calc.responsibility.requester")
    .replace("{n}", sheets.toLocaleString(numFmt))
    .replace("{buffered}", buffered.toLocaleString(numFmt));
}

/** FR-18's Copy Label range preview (e.g. "M-001 – M-050"), zero-padded to 3 digits, or null when there isn't enough data to compute one. */
function copyLabelRangeText(prefix, start, numberOfCopies) {
  const copies = Number(numberOfCopies) || 0;
  if (start === null || start === undefined || start === "" || !copies) return null;
  const pad = (n) => String(n).padStart(3, "0");
  const end = Number(start) + copies - 1;
  return `${prefix || ""}${pad(start)} – ${prefix || ""}${pad(end)}`;
}

/** FR-18 Copy Label display text for a request record, covering both "auto" (prefix + running number) and v0.7's "manual" mode — a single free-text label shared identically by every copy. Null when Copy Label wasn't requested. */
function copyLabelDisplayText(record) {
  if (!record.copyLabelEnabled) return null;
  if (record.copyLabelMode === "manual") {
    const values = record.copyLabelManual || [];
    if (!values.length) return null;
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : unique.join(", ");
  }
  return copyLabelRangeText(record.copyLabelPrefix, record.copyLabelStart, record.copies);
}

/** Clears an element and appends a run of text/element nodes — used for the
 * Officer/Receiver signoff cells, which mix a bold state label with plain
 * detail lines (never raw record text as markup, to avoid HTML injection). */
function setCellNodes(el, nodes) {
  el.replaceChildren(...nodes);
}

/** One line in the Officer/Receiver signoff cells: a small muted label
 * followed by the value, each on its own row (.pf-line/.pf-line-label CSS)
 * so a 4-5 line cell reads as a scannable list instead of a run-on
 * paragraph of same-weight text. */
function boldLine(text) {
  const div = document.createElement("div");
  div.className = "pf-line";
  const strong = document.createElement("strong");
  strong.textContent = text;
  div.appendChild(strong);
  return div;
}

function detailLine(label, value) {
  const div = document.createElement("div");
  div.className = "pf-line";
  const labelSpan = document.createElement("span");
  labelSpan.className = "pf-line-label";
  labelSpan.textContent = label + ":";
  div.append(labelSpan, document.createTextNode(" " + value));
  return div;
}

/** Same lookup as translateValue(), but always resolves to English regardless
 * of the app's current language toggle — the print/PDF form (unlike the rest
 * of the app) always shows both, so it needs each language on demand rather
 * than whichever one the UI happens to be set to. */
function translateValueEn(value) {
  for (const key in TRANSLATIONS) {
    if (TRANSLATIONS[key].th === value) return TRANSLATIONS[key].en;
  }
  return value;
}

/** "Thai (English)" for the print form's bilingual body text — omits the
 * parenthetical when there's no distinct English form (free text, or a
 * value like "A4" that reads the same in both languages). */
function bilingual(th, en) {
  return en && en !== th ? `${th} (${en})` : th;
}

/** Picks the Thai or English text for the current UI language, falling back to the other when one is empty. */
function pickLang(th, en, lang) {
  lang = lang || getLang();
  return lang === "en" ? (en || th || "") : (th || en || "");
}

/**
 * A Location (see src/locations.js) as one display string in the current
 * language: name, then building/floor/room. Same joining rule as
 * formatText() in src/locations.js — keep the two in sync by hand.
 */
function formatLocation(loc, lang) {
  if (!loc) return "";
  lang = lang || getLang();
  const name = pickLang(loc.nameTh, loc.nameEn, lang);
  const detail = pickLang(loc.detailTh, loc.detailEn, lang);
  if (!detail) return name;
  return lang === "en" ? name + ", " + detail : name + " " + detail;
}

/**
 * Populates the shared Request Form print/PDF partial (server/views/partials/print-form.ejs,
 * ids prefixed "pf-"), included identically by both officer/request-form-view.ejs and
 * requester/request-submitted.ejs so the two parties always see the same document —
 * the printed form is conceptually one sheet the Requester fills and hands to the Officer,
 * not two independently maintained views. Structure mirrors the wireframe at
 * ref and logos/wireframes/printing-request-form-redesign.html. Always bilingual
 * (Thai primary, English in parentheses) regardless of the app's TH/EN toggle —
 * see the comment atop print-form.ejs.
 */
function renderPrintForm(record) {
  document.getElementById("pf-refno").textContent = record.referenceNo;
  const runnoEl = document.getElementById("pf-runno");
  if (record.runNumber) {
    runnoEl.style.display = "";
    runnoEl.textContent = record.runNumber;
  } else {
    runnoEl.style.display = "none";
  }

  document.getElementById("pf-name").textContent = record.requesterName;
  document.getElementById("pf-tel").textContent = record.tel;
  document.getElementById("pf-agency-unit").textContent = record.agencyUnit;
  document.getElementById("pf-agency-category").textContent = bilingual(record.agencyCategory, record.agencyCategoryNameEn || AGENCY_CATEGORY_EN[record.agencyCategory]);

  document.getElementById("pf-documenttype").textContent = bilingual(record.documentType, translateValueEn(record.documentType));
  document.getElementById("pf-papersize").textContent = bilingual(record.paperSize, translateValueEn(record.paperSize));
  document.getElementById("pf-colormode").textContent = bilingual(record.colorMode, translateValueEn(record.colorMode));
  document.getElementById("pf-printside").textContent = bilingual(record.printSide, translateValueEn(record.printSide));
  document.getElementById("pf-finishing").textContent = (record.finishing && record.finishing.length)
    ? record.finishing.map(v => bilingual(v, translateValueEn(v))).join(", ")
    : "ไม่มี (None)";
  const totalSheets = computeTotalSheets(record.originalPages, record.copies, record.printSide);
  document.getElementById("pf-paperresponsibility").textContent =
    bilingual(paperResponsibilityText(record.paperSource, totalSheets, "th"), paperResponsibilityText(record.paperSource, totalSheets, "en"));
  document.getElementById("pf-copylabel").textContent = copyLabelDisplayText(record) || "ไม่มี (None)";

  document.getElementById("pf-itemlist").textContent = record.itemList;
  document.getElementById("pf-pages").textContent = record.originalPages;
  document.getElementById("pf-copies").textContent = record.copies;
  document.getElementById("pf-totalpages").textContent = String(Number(record.originalPages) * Number(record.copies));
  document.getElementById("pf-totalsheets").textContent = String(totalSheets);

  document.getElementById("pf-requester-name").textContent = record.requesterName;
  document.getElementById("pf-submitted").textContent = formatDateTime(new Date(record.submissionDate), "th");
  const receivedWrapEl = document.getElementById("pf-received-wrap");
  if (record.originalDocReceivedTimestamp) {
    receivedWrapEl.style.display = "";
    document.getElementById("pf-received").textContent = formatDateTime(new Date(record.originalDocReceivedTimestamp), "th");
  } else {
    receivedWrapEl.style.display = "none";
  }

  const officerEl = document.getElementById("pf-signoff-officer");
  if (record.statusCode === "awaiting") {
    setCellNodes(officerEl, []);
  } else if (record.statusCode === "rejected") {
    setCellNodes(officerEl, [
      boldLine("ถูกปฏิเสธ (Rejected)"),
      detailLine("เหตุผล (Reason)", record.rejectionReason),
      detailLine("ปฏิเสธโดย (Rejected By)", record.reviewedByOfficer)
    ]);
  } else if (record.statusCode === "cancelled") {
    setCellNodes(officerEl, [
      boldLine("ยกเลิกโดยผู้ขอ (Cancelled by Requester)")
    ]);
  } else {
    setCellNodes(officerEl, [
      boldLine("อนุมัติแล้ว (Approved)"),
      detailLine("วันนัดรับเอกสาร (Appointment Date)", formatDate(new Date(record.completionDateConfirmed + "T00:00:00"), "th")),
      detailLine("อนุมัติโดย (Approved By)", record.reviewedByOfficer)
    ]);
  }

  const receiverEl = document.getElementById("pf-signoff-receiver");
  if (record.receiverName) {
    setCellNodes(receiverEl, [
      boldLine(record.receiverName),
      detailLine("ตำแหน่ง (Position)", record.receiverPosition),
      detailLine("ที่ทำงาน (Workplace)", record.receiverWorkplace),
      detailLine("เบอร์โทรศัพท์ที่ทำงาน (Work Phone)", record.receiverWorkPhone),
      detailLine("เวลาที่มารับ (Received At)", formatDateTime(new Date(record.completedTimestamp), "th"))
    ]);
  } else {
    const em = document.createElement("em");
    em.textContent = "รอรับเอกสาร (Awaiting Pickup)";
    setCellNodes(receiverEl, [em]);
  }

  document.getElementById("pf-footnote").textContent = (record.claimCode ? `Claim Code: ${record.claimCode} · ` : "")
    + "เอกสารนี้สร้างโดยระบบ ODPRS (This document was generated by the ODPRS system)";
}

/* =====================================================================
   i18n — lightweight TH/EN toggle shared by every page.
   Elements opt in with data-i18n="key" (textContent) or
   data-i18n-placeholder="key" (placeholder attribute). Preference is
   stored in localStorage so it carries across page navigation. Pages
   with dynamically computed text (dates, agency dropdown, etc.) should
   listen for the "odprs:langchange" event and re-render themselves.
   ===================================================================== */

const TRANSLATIONS = {
  "brand.sub": { th: "ฝ่ายทะเบียน · มฟล.", en: "Registrar Division · MFU" },

  "login.title": { th: "ระบบขอพิมพ์เอกสารออนไลน์", en: "Online Document Printing Request System" },
  "login.subtitle": { th: "ฝ่ายทะเบียน มหาวิทยาลัยแม่ฟ้าหลวง", en: "Registrar Division, Mae Fah Luang University" },
  "login.hint": { th: "เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย (@mfu.ac.th)", en: "Sign in with your university Google account (@mfu.ac.th)" },
  "login.btn": { th: "เข้าสู่ระบบด้วย Google", en: "Log in with Google" },
  "login.deniedNotice": { th: "เข้าสู่ระบบไม่สำเร็จ — บัญชีนี้ต้องใช้อีเมลที่ลงท้ายด้วย {domain} เท่านั้น", en: "Login failed — this account must use an email ending in {domain}." },
  "login.staffOnly": { th: "สำหรับเจ้าหน้าที่เท่านั้น", en: "Officers only" },
  "login.kioskBtn": { th: "เปิดหน้าจอจุดรับเอกสาร", en: "Open Pickup Station" },
  "user.name": { th: "ดร. สมชาย ใจดี", en: "Dr. Somchai Jaidee" },
  "user.role.requester": { th: "ผู้ขอ", en: "Requester" },
  "user.name.officer": { th: "คุณสรวิศ ธนะขว้าง", en: "Sorrawit Thanakhwang" },
  "user.role.officer": { th: "เจ้าหน้าที่", en: "Officer" },

  "nav.section.requester": { th: "สำหรับผู้ขอ", en: "For Requester" },
  "nav.newRequest": { th: "สร้างคำขอพิมพ์เอกสาร", en: "New Print Request" },
  "nav.myRequests": { th: "คำขอของฉัน", en: "My Requests" },

  "nav.section.officer": { th: "สำหรับเจ้าหน้าที่", en: "For Officer" },
  "nav.officerQueue": { th: "คิวรอเอกสารต้นฉบับ", en: "Awaiting Original Queue" },
  "nav.printingJobs": { th: "งานที่กำลังปริ้น", en: "Printing Jobs" },
  "nav.counterHandover": { th: "จุดส่งมอบเอกสาร", en: "Counter Handover" },
  "nav.history": { th: "ประวัติคำขอทั้งหมด", en: "History / Audit Log" },
  "nav.dashboard": { th: "แดชบอร์ดสรุปข้อมูล", en: "Dashboard" },
  "nav.evaluations": { th: "ผลประเมินความพึงพอใจ", en: "Evaluation Results" },
  "nav.section.admin": { th: "สำหรับผู้ดูแลระบบ", en: "For Admin" },
  "nav.adminOfficers": { th: "จัดการบัญชีเจ้าหน้าที่", en: "Officer Accounts" },
  "nav.adminSettings": { th: "จัดการระบบ", en: "System Settings" },
  "nav.adminLocations": { th: "สถานที่รับ-ส่งเอกสาร", en: "Drop-off & Pickup Locations" },
  "nav.adminAgencies": { th: "หน่วยงาน", en: "Agencies" },
  "nav.adminAuditLog": { th: "ประวัติการแก้ไข", en: "Change History" },
  "nav.adminBackup": { th: "สำรองและกู้คืนข้อมูล", en: "Backup & Restore" },
  "nav.menu": { th: "เมนู", en: "Menu" },
  "nav.collapse": { th: "ย่อเมนู", en: "Collapse menu" },
  "nav.expand": { th: "ขยายเมนู", en: "Expand menu" },

  "crumb.myRequests": { th: "คำขอของฉัน / <strong>ภาพรวม</strong>", en: "My Requests / <strong>Overview</strong>" },
  "crumb.newRequest": { th: "สร้างคำขอพิมพ์เอกสาร / <strong>กรอกแบบฟอร์ม</strong>", en: "New Print Request / <strong>Fill Form</strong>" },
  "crumb.editRequest": { th: "คำขอของฉัน / <strong>แก้ไขคำขอ</strong>", en: "My Requests / <strong>Edit Request</strong>" },
  "crumb.submitted": { th: "สร้างคำขอพิมพ์เอกสาร / <strong>ส่งคำขอสำเร็จ</strong>", en: "New Print Request / <strong>Submitted</strong>" },
  "crumb.evaluate": { th: "คำขอของฉัน / <strong>ประเมินความพึงพอใจ</strong>", en: "My Requests / <strong>Satisfaction Survey</strong>" },

  "myRequests.title": { th: "คำขอของฉัน", en: "My Requests" },
  "myRequests.subtitle": { th: "ติดตามสถานะคำขอพิมพ์เอกสารที่คุณส่งทั้งหมด", en: "Track the status of every print request you've submitted." },
  "myRequests.cardTitle": { th: "คำขอล่าสุด", en: "Recent Requests" },
  "myRequests.newBtn": { th: "ขอพิมพ์เอกสาร", en: "New Print Request" },
  "myRequests.th.ref": { th: "เลขอ้างอิง / RUN NUMBER", en: "Reference No. / RUN NUMBER" },
  "myRequests.th.item": { th: "รายการ", en: "Item" },
  "myRequests.th.submitted": { th: "วันที่ส่งคำขอ", en: "Submitted" },
  "myRequests.th.completion": { th: "วันนัดรับ", en: "Completion Date" },
  "myRequests.th.status": { th: "สถานะ", en: "Status" },
  "myRequests.empty": { th: "คุณยังไม่มีคำขอพิมพ์เอกสาร", en: "You haven't submitted any print requests yet." },

  "myRequests.pendingEvaluation.message": { th: "คุณมีคำขอที่รอประเมินความพึงพอใจ: {item} (ต้องประเมินก่อนทำรายการถัดไป)", en: "You have a request awaiting your satisfaction survey: {item} (required before your next request)" },
  "myRequests.pendingEvaluation.evaluateBtn": { th: "ประเมินตอนนี้", en: "Evaluate Now" },
  "myRequests.pendingEvaluation.laterBtn": { th: "ทีหลัง", en: "Later" },

  "evaluate.title": { th: "ประเมินความพึงพอใจการใช้บริการ", en: "Satisfaction Survey" },
  "evaluate.subtitle": { th: "กรุณาประเมินคำขอที่ได้รับเอกสารเรียบร้อยแล้ว ก่อนส่งคำขอพิมพ์เอกสารใหม่ครั้งต่อไป", en: "Please evaluate this completed request before submitting your next print request." },
  "evaluate.ref": { th: "คำขอ", en: "Request" },
  "evaluate.formTitle": { th: "แบบประเมินความพึงพอใจ", en: "Satisfaction Survey" },
  "evaluate.scaleHint": { th: "ให้คะแนนแต่ละหัวข้อตั้งแต่ 1 (ไม่พึงพอใจอย่างมาก) ถึง 5 (พึงพอใจมากที่สุด)", en: "Rate each item from 1 (very dissatisfied) to 5 (very satisfied)." },
  "evaluate.q.staffService": { th: "การให้บริการของเจ้าหน้าที่", en: "Staff Service" },
  "evaluate.q.systemEase": { th: "ความสะดวกในการใช้งานระบบออนไลน์", en: "Ease of Using the Online System" },
  "evaluate.q.speed": { th: "ความรวดเร็วในการดำเนินการ", en: "Processing Speed" },
  "evaluate.q.printQuality": { th: "คุณภาพงานพิมพ์ที่ได้รับ", en: "Print Quality" },
  "evaluate.q.overall": { th: "ความพึงพอใจโดยรวม", en: "Overall Satisfaction" },
  "evaluate.q.comment": { th: "ความคิดเห็นเพิ่มเติม (ถ้ามี)", en: "Additional Comments (optional)" },
  "evaluate.q.comment.placeholder": { th: "ข้อเสนอแนะหรือสิ่งที่อยากให้ปรับปรุง", en: "Suggestions or anything you'd like to see improved" },
  "evaluate.submitBtn": { th: "ส่งแบบประเมิน", en: "Submit Survey" },
  "evaluate.quickFill": { th: "พึงพอใจทุกด้าน", en: "Satisfied with everything" },
  "evaluate.sentiment.1": { th: "ต้องปรับปรุงมาก", en: "Needs a lot of improvement" },
  "evaluate.sentiment.2": { th: "ต้องปรับปรุง", en: "Needs improvement" },
  "evaluate.sentiment.3": { th: "พอใช้", en: "Okay" },
  "evaluate.sentiment.4": { th: "ดี", en: "Good" },
  "evaluate.sentiment.5": { th: "เยี่ยมมาก!", en: "Excellent!" },
  "evaluate.error.invalidRating": { th: "กรุณาให้คะแนนทุกหัวข้อ", en: "Please rate every item" },
  "evaluate.error.invalidRating.body": { th: "กรุณาเลือกคะแนน 1-5 ให้ครบทุกหัวข้อก่อนส่งแบบประเมิน", en: "Please select a 1-5 rating for every item before submitting." },
  "evaluate.error.alreadyEvaluated": { th: "คำขอนี้ถูกประเมินไปแล้ว", en: "This request has already been evaluated." },
  "evaluate.error.generic": { th: "ไม่สามารถบันทึกแบบประเมินได้", en: "Couldn't save your survey response." },

  "row1.item": { th: "เอกสารประมวลรายวิชา (60 ชุด)", en: "Course syllabus (60 copies)" },
  "row1.submitted": { th: "20 ก.ค. 2569, 09:15", en: "20 Jul 2026, 09:15" },
  "row1.completion": { th: "24 ก.ค. 2569", en: "24 Jul 2026" },

  "row2.item": { th: "ข้อสอบ (30 ชุด)", en: "Exam sheet (30 copies)" },
  "row2.submitted": { th: "15 ก.ค. 2569, 13:40", en: "15 Jul 2026, 13:40" },
  "row2.completion": { th: "20 ก.ค. 2569", en: "20 Jul 2026" },

  "row3.item": { th: "เอกสารประกอบการประชุม (15 ชุด)", en: "Meeting handout (15 copies)" },
  "row3.submitted": { th: "10 ก.ค. 2569, 10:02", en: "10 Jul 2026, 10:02" },
  "row3.completion": { th: "15 ก.ค. 2569", en: "15 Jul 2026" },

  "row4.item": { th: "เล่มประกาศนียบัตร (5 ชุด)", en: "Certificate booklet (5 copies)" },
  "row4.submitted": { th: "02 ก.ค. 2569, 08:50", en: "02 Jul 2026, 08:50" },
  "row4.completion": { th: "07 ก.ค. 2569", en: "07 Jul 2026" },

  "row5.item": { th: "บันทึกข้อความภายใน (10 ชุด)", en: "Internal memo (10 copies)" },
  "row5.submitted": { th: "28 มิ.ย. 2569, 16:20", en: "28 Jun 2026, 16:20" },
  "row5.completion": { th: "03 ก.ค. 2569", en: "03 Jul 2026" },

  "status.awaiting": { th: "รอส่งเอกสารต้นฉบับ", en: "Awaiting Original Document" },
  "status.printing": { th: "กำลังปริ้น", en: "Printing In Progress" },
  "status.ready": { th: "พร้อมส่งมอบ", en: "Ready for Pickup" },
  "status.completed": { th: "เสร็จสมบูรณ์", en: "Completed" },
  "status.rejected": { th: "ถูกปฏิเสธ", en: "Rejected" },
  "status.cancelled": { th: "ยกเลิกโดยผู้ขอ", en: "Cancelled by Requester" },

  "common.moreInfo": { th: "ดูคำอธิบายเพิ่มเติม", en: "Show more info" },

  "newRequest.title": { th: "สร้างคำขอพิมพ์เอกสาร", en: "New Print Request" },
  "newRequest.edit.title": { th: "แก้ไขคำขอพิมพ์เอกสาร", en: "Edit Print Request" },
  "newRequest.edit.subtitle": { th: "แก้ไขรายละเอียดได้จนกว่าเจ้าหน้าที่จะรับเอกสารต้นฉบับของคุณ", en: "You can edit the details until an officer receives your original document." },
  "newRequest.subtitle": { th: "กรอกรายละเอียดคำขอพิมพ์เอกสาร", en: "Fill in your print request details." },
  "newRequest.notice.title": { th: "ไม่ต้องแนบไฟล์เอกสาร", en: "No file attachment required" },
  "newRequest.notice.body": { th: "ส่งคำขอสำเร็จแล้ว ระบบจะออกใบคำขอให้พิมพ์ กรุณา<strong>นำเอกสารต้นฉบับมาส่งด้วยตัวเอง</strong>ที่สถานที่ส่งเอกสารด้านล่าง ตามเวลาที่แจ้ง", en: "Once submitted, print the request form and <strong>bring the original documents in person</strong> to the drop-off location shown below by the notified deadline." },
  "newRequest.cardTitle.requester": { th: "ข้อมูลผู้ขอ", en: "Requester Information" },
  "newRequest.cardTitle.document": { th: "เอกสารที่ต้องการพิมพ์", en: "Documents to Print" },
  "newRequest.cardTitle.format": { th: "รูปแบบการพิมพ์", en: "Print Format" },
  "newRequest.cardTitle.delivery": { th: "การส่งเอกสารและวันรับ", en: "Drop-off & Pickup Date" },
  "newRequest.error.dateTooSoon": { th: "วันที่เลือกไม่ถูกต้อง", en: "Invalid completion date" },
  "newRequest.error.missingField": { th: "กรอกข้อมูลไม่ครบ", en: "Missing required fields" },
  "newRequest.error.missingField.body": { th: "กรุณาเลือกโหมดสี รูปแบบการพิมพ์ ประเภทเอกสาร และผู้จัดเตรียมกระดาษ (ถ้าเป็นข้อสอบ) ให้ครบก่อนส่งคำขอ", en: "Please choose Color Mode, Print Side, Document Type, and Paper Source (if Exam) before submitting." },

  "field.requesterName": { th: "ชื่อผู้ขอ *", en: "Requester Name *" },
  "field.requesterName.hint": { th: 'ดึงจากโปรไฟล์ของคุณให้อัตโนมัติ (หรือบัญชีที่ล็อกอิน หากยังไม่ได้ตั้งค่าโปรไฟล์) แก้ไขได้ทุกครั้ง — ไปตั้งค่าถาวรได้ที่ <a href="/profile">โปรไฟล์ของฉัน</a>', en: 'Auto-filled from your Profile (or your login account, if you haven\'t set one up yet) — you can still edit it each time. Set it permanently at <a href="/profile">My Profile</a>.' },
  "field.tel": { th: "เบอร์โทรศัพท์ *", en: "Phone Number *" },
  "field.tel.placeholder": { th: "08X-XXX-XXXX", en: "08X-XXX-XXXX" },
  "field.tel.hint": { th: "ใช้เบอร์มือถือส่วนตัวหรือเบอร์สำนักงานก็ได้ ดึงจากโปรไฟล์ของคุณให้อัตโนมัติถ้าตั้งค่าไว้", en: "A personal mobile number or an office/workplace number — auto-filled from your Profile if you've set one." },
  "field.agencyCategory": { th: "ประเภทหน่วยงาน *", en: "Agency Category *" },
  "field.agencyUnit": { th: "หน่วยงาน *", en: "Agency/Unit *" },
  "field.agencyUnit.placeholder": { th: "พิมพ์ชื่อหน่วยงาน", en: "Type the agency/unit name" },
  "field.dropoffLocation": { th: "สถานที่ส่งเอกสารต้นฉบับ *", en: "Original Document Drop-off Location *" },
  "location.hours": { th: "เวลาทำการ:", en: "Hours:" },
  "location.phone": { th: "โทร:", en: "Phone:" },
  "location.map": { th: "ดูแผนที่", en: "View map" },
  "field.paperSize": { th: "ขนาดกระดาษ *", en: "Paper Size *" },
  "field.paperSize.other.placeholder": { th: "ระบุขนาดกระดาษ เช่น B5, Letter, F4", en: "Specify paper size, e.g. B5, Letter, F4" },
  "field.finishingMethod": { th: "งานตกแต่ง / การเข้าเล่ม", en: "Finishing / Binding" },
  "field.itemList": { th: "รายการเอกสารที่ต้องการพิมพ์ *", en: "Items to be Printed *" },
  "field.itemList.placeholder": { th: "เช่น เอกสารประมวลรายวิชา บทที่ 1-5, ใบปะหน้า", en: "e.g. Course syllabus chapters 1-5, cover sheet" },
  "field.originalPages": { th: "จำนวนหน้าต้นฉบับ *", en: "Original Page Count *" },
  "field.copies": { th: "จำนวนชุดที่ต้องการ *", en: "Number of Copies *" },
  "field.copies.maxError": { th: "จำนวนชุดต้องไม่เกิน 999 ชุด", en: "Number of copies cannot exceed 999." },
  "field.completionDate": { th: "วันที่ต้องการรับเอกสาร *", en: "Requested Completion Date *" },
  "field.completionDate.placeholder": { th: "เลือกวันที่", en: "Select a date" },
  "field.completionDate.error": { th: "กรุณาเลือกวันที่ห่างจากวันนี้อย่างน้อย 3 วันทำการ", en: "Please choose a date at least 3 business days from today." },
  "field.completionDate.weekendError": { th: "วันที่เลือกตรงกับวันเสาร์หรืออาทิตย์ — กรุณาเลือกวันทำการ (จันทร์-ศุกร์)", en: "The selected date falls on a Saturday or Sunday — please choose a business day (Mon-Fri)." },

  "newRequest.error.finishingNotAllowedForExam": { th: "ตัวเลือกงานตกแต่งไม่ถูกต้อง", en: "Invalid Finishing Selection" },
  "newRequest.error.finishingNotAllowedForExam.body": { th: "ข้อสอบเลือกได้เฉพาะ \"ไม่ต้องการ\" หรือ \"เย็บมุม\" เท่านั้น", en: "Exams may only use \"None\" or \"Corner Staple\"." },
  "newRequest.error.finishingConflict": { th: "ตัวเลือกงานตกแต่งขัดแย้งกัน", en: "Conflicting Finishing Selection" },
  "newRequest.error.finishingConflict.body": { th: "เลือก \"เย็บมุม\"/\"เย็บข้าง\" ได้ทีละอย่าง และเลือกวิธีเข้าเล่ม (มุงหลังคา/ห่วงสัน/เทปผ้า/สันกาว) ได้ทีละแบบเท่านั้น", en: "Choose only one of Corner/Side Staple, and only one Binding method (Saddle-stitch/Coil/Cloth Tape/Glue)." },
  "newRequest.error.finishingRequiresDoubleSide": { th: "ตัวเลือกงานตกแต่งไม่ถูกต้อง", en: "Invalid Finishing Selection" },
  "newRequest.error.finishingRequiresDoubleSide.body": { th: "เย็บมุงหลังคาต้องพิมพ์สองหน้าเท่านั้น", en: "Saddle-stitch binding requires double-sided printing." },
  "newRequest.error.finishingPageCount": { th: "จำนวนหน้าไม่เหมาะกับงานตกแต่งที่เลือก", en: "Page Count Doesn't Fit the Selected Finishing" },
  "newRequest.error.finishingPageCount.body": { th: "กรุณาตรวจสอบจำนวนหน้าต้นฉบับให้เหมาะกับงานตกแต่ง/เข้าเล่มที่เลือก", en: "Please check that the original page count fits the selected finishing/binding method." },
  "newRequest.error.copyLabelManual": { th: "เลขรันประจำชุดแบบกรอกเองไม่ถูกต้อง", en: "Manually Entered Copy Labels Are Invalid" },
  "newRequest.error.copyLabelManual.body": { th: "กรุณากรอกข้อความที่ต้องการใช้กับทุกชุด", en: "Please enter the label text to use for every copy." },
  "newRequest.error.copiesOutOfRange": { th: "จำนวนชุดไม่ถูกต้อง", en: "Invalid Number of Copies" },
  "newRequest.error.copiesOutOfRange.body": { th: "กรุณาระบุจำนวนชุดระหว่าง 1 ถึง 999 ชุด", en: "Please enter a number of copies between 1 and 999." },
  "newRequest.error.dropoffLocation": { th: "สถานที่ส่งเอกสารไม่ถูกต้อง", en: "Invalid drop-off location" },
  "newRequest.error.dropoffLocation.body": { th: "สถานที่ที่เลือกไม่เปิดให้ส่งเอกสารแล้ว กรุณาเลือกสถานที่ใหม่", en: "The selected place no longer accepts drop-offs. Please choose another." },
  "field.finishingMethod.examLocked": { th: "ข้อสอบเลือกได้เฉพาะ \"ไม่ต้องการ\" หรือ \"เย็บมุม\"", en: "Exams may only use \"None\" or \"Corner Staple\"." },
  "field.finishingMethod.saddleStitchForcesDouble": { th: "เย็บมุงหลังคาต้องพิมพ์สองหน้า ระบบเปลี่ยนรูปแบบการพิมพ์ให้อัตโนมัติ", en: "Saddle-stitch requires double-sided printing — Print Side was switched automatically." },
  "field.finishingMethod.pageCount.saddleStitch": { th: "เย็บมุงหลังคา: จำนวนหน้าต้นฉบับต้องหารด้วย 4 ลงตัว และไม่เกิน 60 หน้า", en: "Saddle-stitch: original page count must be a multiple of 4, up to 60 pages." },
  "field.finishingMethod.pageCount.glue": { th: "เข้าเล่มสันกาว: จำนวนหน้าต้นฉบับต้องมีอย่างน้อย 20 หน้า เพื่อให้มีสันพอให้กาวยึด", en: "Glue binding: needs at least 20 original pages for the spine to hold." },
  "field.finishingMethod.pageCount.corner": { th: "เย็บมุม: จำนวนหน้าต้นฉบับต้องไม่เกิน 80 หน้า มิฉะนั้นลวดเย็บจะกดไม่ทะลุ", en: "Corner staple: original page count must not exceed 80 pages, or a standard stapler can't punch through." },

  "field.colorMode": { th: "โหมดสี *", en: "Color Mode *" },
  "field.printSide": { th: "รูปแบบการพิมพ์ (หน้า) *", en: "Print Side *" },
  "field.documentType": { th: "ประเภทเอกสาร *", en: "Document Type *" },
  "field.documentType.hint": { th: "เลือกได้ประเภทเดียวต่อคำขอ ถ้ามีทั้งสองประเภทให้แยกส่ง", en: "One type per request — submit separately if you have both." },
  "field.paperSource": { th: "ผู้จัดเตรียมกระดาษ *", en: "Paper Source *" },
  "field.paperSource.fixedNotice": { th: "เอกสารทั่วไป: ผู้ขอเป็นผู้จัดเตรียมกระดาษเอง (Requester-provided) — ไม่มีตัวเลือกอื่น", en: "General Document: paper is always Requester-provided — no choice offered." },
  "field.copyLabel.toggle": { th: "ต้องการเลขรันประจำชุด (Copy Label) หรือไม่", en: "Add a running number to each copy (Copy Label)" },
  "field.copyLabel.toggle.hint": { th: "เลขนี้จะพิมพ์ไว้ที่มุมขวาบนของหน้าแรกในแต่ละชุด เพื่อการติดตามของผู้ขอเอง ไม่เกี่ยวข้องกับเลขอ้างอิงคำขอหรือ RUN NUMBER", en: "Printed in the top-right corner of each copy's first page, for the Requester's own tracking — independent of the Request Reference No. and RUN NUMBER." },
  "field.copyLabel.mode.auto": { th: "รันเลขอัตโนมัติ", en: "Auto-generate running number" },
  "field.copyLabel.mode.manual": { th: "กรอกเอง (ข้อความเดียวกันทุกชุด)", en: "Type it myself (same text for every copy)" },
  "field.copyLabel.auto.hint": { th: "ระบบจะรันเลขให้อัตโนมัติ (เช่น 001–050) ตามจำนวนชุดที่ต้องการ", en: "The system auto-generates the numbers (e.g. 001–050) based on the number of copies requested." },
  "field.copyLabel.preview": { th: "ตัวอย่างเลขที่จะพิมพ์: {range}", en: "Preview: {range}" },
  "field.copyLabel.manual.hint": { th: "กรอกข้อความหรือเลขที่ต้องการ ระบบจะใช้ข้อความเดียวกันนี้กับทุกชุด", en: "Type the label you want — it will be used identically on every copy." },
  "field.copyLabel.manual.item": { th: "ข้อความที่ต้องการ (ใช้เหมือนกันทุกชุด) *", en: "Label text (same for every copy) *" },
  "field.copyLabel.manual.item.placeholder": { th: "เช่น ชุด A", en: "e.g. Set A" },

  "option.colorMode.bw": { th: "ขาวดำ", en: "Black & White" },
  "option.colorMode.color": { th: "สี", en: "Color" },
  "option.printSide.single": { th: "พิมพ์หน้าเดียว", en: "Single-sided" },
  "option.printSide.double": { th: "พิมพ์สองหน้า", en: "Double-sided" },
  "option.finishing.side": { th: "เย็บข้าง", en: "Side Staple" },
  "option.binding.glue": { th: "เข้าเล่มสันกาว", en: "Glue Binding" },
  "option.binding.coil": { th: "เข้าเล่มห่วงสัน (Coil)", en: "Coil Binding" },
  "option.binding.clothTape": { th: "เข้าเล่มเทปผ้า", en: "Cloth Tape Binding" },
  "option.binding.saddleStitch": { th: "เย็บมุงหลังคา (Saddle-stitch)", en: "Saddle-stitch Binding" },
  "option.documentType.exam": { th: "ข้อสอบ", en: "Exam" },
  "option.documentType.general": { th: "เอกสารทั่วไป", en: "General Document" },
  "option.paperSource.office": { th: "ฝ่ายทะเบียนจัดเตรียมให้", en: "Office-provided" },
  "option.paperSource.requester": { th: "ผู้ขอจัดเตรียมเอง", en: "Requester-provided" },

  "newRequest.summary.title": { th: "สรุปคำขอ", en: "Request Summary" },
  "newRequest.summary.dropoff": { th: "สถานที่ส่งเอกสารต้นฉบับ", en: "Original drop-off location" },
  "newRequest.summary.date": { th: "วันที่ต้องการรับเอกสาร", en: "Requested pickup date" },
  "newRequest.calc.totalPages": { th: "จำนวนหน้าที่ต้องพิมพ์ทั้งหมด", en: "Total Pages to Print" },
  "newRequest.calc.totalSheets": { th: "จำนวนแผ่นกระดาษที่ต้องใช้ทั้งหมด", en: "Total Sheets to Print" },
  "newRequest.calc.responsibility.requester": { th: "ผู้ขอต้องเตรียมกระดาษมาเอง {n} แผ่น (แนะนำให้เผื่อกระดาษเสียจากการพิมพ์ประมาณ 5% โดยเตรียมมาประมาณ {buffered} แผ่น)", en: "Requester must bring {n} sheets (recommend allowing ~5% for print waste — bring about {buffered} sheets)" },
  "newRequest.calc.responsibility.office": { th: "ฝ่ายทะเบียนจะจัดเตรียมกระดาษให้ {n} แผ่น", en: "Registrar Division will supply {n} sheets" },
  "newRequest.calc.responsibility.pending": { th: "กรอกข้อมูลด้านบนให้ครบเพื่อคำนวณ", en: "Fill in the fields above to calculate" },

  "option.select": { th: "— เลือก —", en: "— Select —" },
  "option.selectCategoryFirst": { th: "— เลือกประเภทหน่วยงานก่อน —", en: "— Select an agency category first —" },
  "option.paperSize.a4": { th: "A4", en: "A4" },
  "option.paperSize.a3": { th: "A3", en: "A3" },
  "option.paperSize.a5": { th: "A5", en: "A5" },
  "option.paperSize.other": { th: "อื่นๆ", en: "Other" },
  "option.none": { th: "ไม่มี", en: "None" },
  "option.finishingMethod.none": { th: "ไม่ต้องการ", en: "None" },
  "option.group.finishing": { th: "งานตกแต่ง", en: "Finishing" },
  "option.group.binding": { th: "เข้าเล่ม", en: "Binding" },
  "option.finishing.corner": { th: "เย็บมุม", en: "Corner Stapling" },
  "option.finishing.hole": { th: "เจาะรู", en: "Hole Punch" },

  "btn.cancel": { th: "ยกเลิก", en: "Cancel" },
  "btn.submit": { th: "ส่งคำขอ", en: "Submit Request" },
  "btn.saveChanges": { th: "บันทึกการแก้ไข", en: "Save Changes" },
  "btn.saving": { th: "กำลังบันทึก...", en: "Saving..." },
  "btn.submitting": { th: "กำลังส่งคำขอ...", en: "Submitting..." },
  "validation.enter": { th: "กรุณากรอก{field}", en: "Please enter {field}" },
  "validation.select": { th: "กรุณาเลือก{field}", en: "Please select {field}" },
  "processing.default": { th: "ระบบกำลังประมวลผล กรุณารอสักครู่...", en: "Processing, please wait..." },

  "submitted.title": { th: "ส่งคำขอสำเร็จ", en: "Request Submitted" },
  "submitted.subtitle": { th: "กรุณานำใบคำขอด้านล่างไปแสดงต่อเจ้าหน้าที่พร้อมกับเอกสารต้นฉบับ", en: "Please show the Request Form below to the officer along with the physical original documents." },
  "submitted.deadline.label": { th: "นำเอกสารต้นฉบับมาส่งภายใน", en: "Deliver the original documents by" },
  "submitted.deadline.body": { th: "เลยกำหนดแล้วคำขอจะยังค้างที่ \"รอส่งเอกสารต้นฉบับ\" ติดต่อเจ้าหน้าที่ได้หากมีปัญหา", en: "Past the deadline, the request stays at \"Awaiting Original Document\". Contact an Officer if you have any trouble." },
  "submitted.officeLocation": { th: "สถานที่:", en: "Location:" },
  "submitted.officePhone": { th: "โทร:", en: "Phone:" },
  "submitted.deadline.received.label": { th: "รับเอกสารต้นฉบับแล้วเมื่อ", en: "Original documents received on" },
  "submitted.deadline.received.body": { th: "เจ้าหน้าที่ตรวจรับเอกสารต้นฉบับของท่านเรียบร้อยแล้ว", en: "An Officer has confirmed receipt of your original documents." },
  "submitted.formCardTitle": { th: "ใบคำขอพิมพ์เอกสาร (สำหรับพิมพ์)", en: "Print Request Form (Printable)" },
  "submitted.printBtn": { th: "พิมพ์ใบคำขอ", en: "Print Request Form" },
  "submitted.downloadPdfBtn": { th: "ดาวน์โหลด PDF", en: "Download PDF" },
  "submitted.newBtn": { th: "สร้างคำขอใหม่", en: "Create New Request" },
  "submitted.goToMyRequests": { th: "ไปที่คำขอของฉัน", en: "Go to My Requests" },
  "submitted.editBtn": { th: "แก้ไขคำขอ", en: "Edit Request" },
  "submitted.cancelBtn": { th: "ยกเลิกคำขอ", en: "Cancel Request" },
  "submitted.cancelConfirmTitle": { th: "ยืนยันการยกเลิกคำขอ", en: "Confirm Cancellation" },
  "submitted.cancelConfirmMessage": { th: "คำขอนี้จะถูกยกเลิก และจะไม่ปรากฏในคิวของเจ้าหน้าที่อีกต่อไป หากต้องการแก้ไข กรุณาส่งคำขอใหม่อีกครั้ง ยืนยันหรือไม่?", en: "This request will be cancelled and removed from the Officer's queue. To make corrections, submit a new request afterward. Continue?" },
  "submitted.cancelSuccessTitle": { th: "ยกเลิกคำขอเรียบร้อย", en: "Request Cancelled" },
  "submitted.cancelSuccessMessage": { th: "คำขอนี้ถูกยกเลิกแล้ว และถูกนำออกจากคิวของเจ้าหน้าที่ หากต้องการแก้ไขข้อมูล กรุณาส่งคำขอใหม่อีกครั้ง", en: "This request has been cancelled and removed from the Officer's queue. To make corrections, please submit a new request." },
  "submitted.cancelErrorTitle": { th: "ยกเลิกคำขอไม่สำเร็จ", en: "Couldn't Cancel Request" },
  "submitted.cancelError": { th: "ไม่สามารถยกเลิกคำขอนี้ได้ เนื่องจากเจ้าหน้าที่เริ่มดำเนินการกับคำขอนี้ไปแล้ว กรุณารีเฟรชหน้าเพื่อตรวจสอบสถานะล่าสุด", en: "This request can no longer be cancelled — an Officer has already started processing it. Please refresh the page to see the latest status." },
  "submitted.cancelErrorGeneric": { th: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง", en: "A connection error occurred. Please try again." },

  "detail.rejectConfirmTitle": { th: "ยืนยันการปฏิเสธคำขอ", en: "Confirm Rejection" },
  "detail.rejectConfirmMessage": { th: "เหตุผล: {reason}\n\nยืนยันปฏิเสธคำขอนี้?", en: "Reason: {reason}\n\nConfirm rejecting this request?" },

  "summary.refno": { th: "เลขอ้างอิงคำขอ", en: "Request Reference No." },
  "summary.name": { th: "ชื่อผู้ขอ", en: "Requester Name" },
  "summary.agencyCategory": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "summary.agencyUnit": { th: "หน่วยงาน", en: "Agency/Unit" },
  "summary.tel": { th: "เบอร์โทรศัพท์", en: "Phone Number" },
  "summary.documentType": { th: "ประเภทเอกสาร", en: "Document Type" },
  "summary.paperSize": { th: "ขนาดกระดาษ", en: "Paper Size" },
  "summary.colorMode": { th: "โหมดสี", en: "Color Mode" },
  "summary.printSide": { th: "รูปแบบการพิมพ์ (หน้า)", en: "Print Side" },
  "summary.finishingMethod": { th: "งานตกแต่ง / การเข้าเล่ม", en: "Finishing / Binding" },
  "summary.itemList": { th: "รายการเอกสาร", en: "Items" },
  "summary.pages": { th: "จำนวนหน้าต้นฉบับ", en: "Original Pages" },
  "summary.copies": { th: "จำนวนชุด", en: "Number of Copies" },
  "summary.totalPages": { th: "จำนวนหน้าที่ต้องพิมพ์ทั้งหมด (หน้าต้นฉบับ × จำนวนชุด)", en: "Total Pages to Print (Original Pages × Copies)" },
  "summary.paperSource": { th: "การจัดเตรียมกระดาษ", en: "Paper Supply" },
  "summary.copyLabel": { th: "เลขรันประจำชุด (Copy Label)", en: "Copy Label" },
  "summary.submitted": { th: "วันที่ส่งคำขอ", en: "Submission Date" },
  "summary.receivedTimestamp": { th: "เวลาที่ผู้ขอมาส่งเอกสารต้นฉบับ", en: "Original Document Received At" },
  "summary.completion": { th: "วันที่ต้องการรับเอกสาร", en: "Requested Completion Date" },
  "summary.deadline": { th: "กำหนดส่งเอกสารต้นฉบับ", en: "Original Document Deadline" },
  "summary.status": { th: "สถานะ", en: "Status" },

  "crumb.officerQueue": { th: "คิวรอเอกสารต้นฉบับ / <strong>ภาพรวม</strong>", en: "Awaiting Original Queue / <strong>Overview</strong>" },
  "crumb.requestDetail": { th: "คิวรอเอกสารต้นฉบับ / <strong>รายละเอียดคำขอ</strong>", en: "Awaiting Original Queue / <strong>Request Detail</strong>" },
  "crumb.requestDetail.queue": { th: "คิวรอเอกสารต้นฉบับ / <strong>รายละเอียดคำขอ</strong>", en: "Awaiting Original Queue / <strong>Request Detail</strong>" },
  "crumb.requestDetail.printing": { th: "งานที่กำลังปริ้น / <strong>รายละเอียดคำขอ</strong>", en: "Printing Jobs / <strong>Request Detail</strong>" },
  "crumb.requestDetail.history": { th: "ประวัติคำขอทั้งหมด / <strong>รายละเอียดคำขอ</strong>", en: "History / Audit Log / <strong>Request Detail</strong>" },
  "crumb.printingJobs": { th: "งานที่กำลังปริ้น / <strong>ภาพรวม</strong>", en: "Printing Jobs / <strong>Overview</strong>" },
  "crumb.counterHandover": { th: "จุดส่งมอบเอกสาร / <strong>ยืนยันตัวตนผู้รับ</strong>", en: "Counter Handover / <strong>Verify Receiver</strong>" },

  "officerQueue.title": { th: "คิวรอเอกสารต้นฉบับ", en: "Awaiting Original Queue" },
  "officerQueue.subtitle": { th: "รายการคำขอที่รอผู้ขอนำเอกสารต้นฉบับมาส่งที่เคาน์เตอร์", en: "Requests waiting for the Requester to hand-deliver the physical original documents." },
  "officerQueue.filterLabel": { th: "เฉพาะที่เลยกำหนดส่ง", en: "Overdue only" },
  "officerQueue.searchPlaceholder": { th: "ค้นหาเลขอ้างอิง ชื่อผู้ขอ หรือหน่วยงาน", en: "Search by reference no., requester, or agency" },
  "officerQueue.empty": { th: "ไม่มีคำขอในคิวขณะนี้", en: "No requests in the queue right now." },
  "officerQueue.overdue": { th: "เลยกำหนด", en: "Overdue" },
  "officerQueue.th.ref": { th: "เลขอ้างอิงคำขอ", en: "Reference No." },
  "officerQueue.th.requester": { th: "ผู้ขอ", en: "Requester" },
  "officerQueue.th.agency": { th: "หน่วยงาน", en: "Agency" },
  "officerQueue.th.submitted": { th: "วันที่ส่งคำขอ", en: "Submitted" },
  "officerQueue.th.deadline": { th: "กำหนดส่งต้นฉบับ", en: "Drop-off Deadline" },
  "officerQueue.th.status": { th: "สถานะ", en: "Status" },

  "detail.notFound": { th: "ไม่พบคำขอนี้", en: "Request not found" },
  "detail.backToQueue": { th: "กลับไปที่คิว", en: "Back to Queue" },
  "detail.backToPrinting": { th: "กลับไปที่งานที่กำลังปริ้น", en: "Back to Printing Jobs" },
  "detail.backToHistory": { th: "กลับไปที่ประวัติคำขอทั้งหมด", en: "Back to History" },
  "detail.stat.totalPages": { th: "หน้าที่ต้องพิมพ์ทั้งหมด", en: "Total pages to print" },
  "detail.stat.totalSheets": { th: "แผ่นกระดาษที่ใช้ทั้งหมด", en: "Total sheets of paper" },
  "detail.section.print": { th: "ข้อกำหนดการพิมพ์", en: "Print specification" },
  "detail.section.dates": { th: "กำหนดเวลา", en: "Dates" },
  "detail.section.requester": { th: "ข้อมูลผู้ขอ", en: "Requester" },
  "detail.compareNotice": { th: "เทียบรายการด้านล่างกับเอกสารต้นฉบับและใบคำขอที่ผู้ขอนำมาส่งจริงที่เคาน์เตอร์", en: "Compare the details below against the physical original documents and Request Form the Requester brought to the counter." },
  "detail.approveTitle": { th: "อนุมัติและรับต้นฉบับ", en: "Approve and Receive Master" },
  "detail.approveHint": { th: "ระบบจะออก RUN NUMBER และ Claim Code ให้ทันที", en: "A RUN NUMBER and Claim Code are issued immediately." },
  "detail.confirmDateLabel": { th: "วันที่รับเอกสารจริง (ยืนยัน/ปรับ)", en: "Confirmed Completion Date" },
  "detail.approveBtn": { th: "อนุมัติและรับต้นฉบับ", en: "Approve and Receive Master" },
  "detail.rejectTitle": { th: "ปฏิเสธคำขอ", en: "Reject Request" },
  "detail.rejectHint": { th: "ใช้เมื่อเอกสารต้นฉบับไม่ตรงกับสเปกที่ยื่นไว้ในระบบ", en: "Use this when the physical originals do not match the submitted specification." },
  "detail.rejectReasonLabel": { th: "เหตุผลที่ปฏิเสธ *", en: "Rejection Reason *" },
  "detail.rejectReasonPlaceholder": { th: "เช่น จำนวนหน้าต้นฉบับไม่ตรงกับที่ระบุไว้", en: "e.g. Original page count does not match what was submitted" },
  "detail.rejectReasonRequired": { th: "กรุณาระบุเหตุผลที่ปฏิเสธ", en: "Please provide a rejection reason." },
  "detail.rejectBtn": { th: "ปฏิเสธคำขอ", en: "Reject Request" },
  "detail.approvedBand": { th: "อนุมัติแล้ว — รับต้นฉบับเรียบร้อย", en: "Approved — master received" },
  "detail.approvedNote": { th: "ระบบจริงจะส่งอีเมล RUN NUMBER และ Claim Code นี้ให้ผู้ขอทันที", en: "The real system would email this RUN NUMBER and Claim Code to the Requester immediately." },
  "detail.rejectedBand": { th: "ปฏิเสธคำขอแล้ว", en: "Request rejected" },
  "detail.rejectedNote": { th: "ระบบจริงจะส่งอีเมลแจ้งเหตุผลให้ผู้ขอทันที", en: "The real system would email the reason to the Requester immediately." },
  "detail.cancelledNotice": { th: "ผู้ขอยกเลิกคำขอนี้เอง ไม่ต้องดำเนินการต่อ", en: "The requester cancelled this request themselves — no action needed." },
  "detail.runNumberLabel": { th: "RUN NUMBER", en: "RUN NUMBER" },
  "detail.claimCodeLabel": { th: "Claim Code", en: "Claim Code" },
  "detail.rejectionReasonLabel": { th: "เหตุผลที่ปฏิเสธ", en: "Rejection Reason" },
  "detail.completedNotice": { th: "ส่งมอบเอกสารให้ผู้รับเรียบร้อยแล้ว", en: "Documents have been handed over to the Receiver." },
  "detail.receiverNameLabel": { th: "ผู้รับเอกสาร", en: "Receiver" },
  "detail.receiverPositionLabel": { th: "ตำแหน่ง", en: "Position" },
  "detail.receiverWorkplaceLabel": { th: "ที่ทำงาน", en: "Workplace" },
  "detail.receiverWorkPhoneLabel": { th: "เบอร์โทรศัพท์ที่ทำงาน", en: "Work Phone" },
  "detail.completedTimestampLabel": { th: "วันเวลาที่ส่งมอบสำเร็จ", en: "Handover Confirmed At" },
  "detail.copyBtn": { th: "คัดลอก", en: "Copy" },
  "detail.reviewedByLabel": { th: "ดำเนินการโดย (เจ้าหน้าที่)", en: "Reviewed By (Officer)" },
  "detail.approvedAtLabel": { th: "อนุมัติเมื่อ", en: "Approved At" },
  "detail.dropoffLocationLabel": { th: "สถานที่ส่งเอกสารต้นฉบับ", en: "Original Drop-off Location" },
  "detail.pickupLocationLabel": { th: "สถานที่รับเอกสาร", en: "Pickup Location" },
  "detail.handedOverByLabel": { th: "ตรวจรับ/ส่งมอบโดย (เจ้าหน้าที่)", en: "Handed Over By (Officer)" },

  "printingJobs.title": { th: "งานที่กำลังปริ้น", en: "Printing Jobs" },
  "printingJobs.subtitle": { th: "คำขอที่อนุมัติแล้วและกำลังพิมพ์/แพ็กเอกสารอยู่", en: "Approved requests currently being printed and packed." },
  "printingJobs.empty": { th: "ไม่มีงานที่กำลังปริ้นขณะนี้", en: "No printing jobs right now." },
  "printingJobs.th.runno": { th: "RUN NUMBER", en: "RUN NUMBER" },
  "printingJobs.th.requester": { th: "ผู้ขอ", en: "Requester" },
  "printingJobs.th.item": { th: "รายการ", en: "Item" },
  "printingJobs.th.totalPages": { th: "จำนวนหน้ารวม", en: "Total Pages" },
  "printingJobs.totalPagesUnit": { th: "{total} หน้า", en: "{total} pages" },
  "printingJobs.pagesBreakdown": { th: "({pages} หน้า × {copies} ชุด)", en: "({pages} pages × {copies} copies)" },
  "printingJobs.clickForDetail": { th: "คลิกเพื่อดูรายละเอียด", en: "Click for full detail" },
  "printingJobs.confirmReady.title": { th: "ยืนยันว่าพร้อมส่งมอบ", en: "Confirm Ready for Pickup" },
  "printingJobs.confirmReady.message": {
    th: "RUN NUMBER: {runno}\nผู้ขอ: {requester}\nรายการ: {item}\nจำนวนหน้าที่ต้องพิมพ์ทั้งหมด: {total} หน้า ({pages} หน้า × {copies} ชุด)\n\nยืนยันว่าปริ้นและแพ็กเอกสารครบถ้วนแล้ว พร้อมส่งมอบให้ผู้ขอ?",
    en: "RUN NUMBER: {runno}\nRequester: {requester}\nItem: {item}\nTotal Pages to Print: {total} pages ({pages} pages × {copies} copies)\n\nConfirm that printing and packing are complete and this job is ready for pickup?"
  },
  "printingJobs.confirmReady.confirmBtn": { th: "ยืนยัน พร้อมส่งมอบ", en: "Confirm Ready" },
  "printingJobs.pickupLabel": { th: "สถานที่รับเอกสาร", en: "Pickup location" },
  "printingJobs.availableFromLabel": { th: "รับเอกสารได้ตั้งแต่", en: "Available for pickup from" },
  "printingJobs.availableNow": { th: "ตอนนี้", en: "Now" },
  "printingJobs.availableToday": { th: "วันนี้", en: "Today" },
  "printingJobs.availableHint": { th: "เลือกได้เฉพาะวันทำการ เวลา {hours} น. (ตามเวลาทำการของสถานที่นี้) ผู้ขอจะได้รับแจ้งเวลานี้ทางอีเมล", en: "Business days, {hours} only (this place's own hours). The Requester is told this time by email." },
  "submitted.availableFrom": { th: "รับเอกสารได้ตั้งแต่:", en: "Available from:" },
  "handover.availableFrom": { th: "รับได้ตั้งแต่", en: "Available from" },
  "detail.availableFromLabel": { th: "รับเอกสารได้ตั้งแต่", en: "Available For Pickup From" },
  "printingJobs.readyError": { th: "บันทึกไม่สำเร็จ สถานที่รับที่เลือกอาจไม่พร้อมใช้งานแล้ว หรือคำขอถูกเปลี่ยนสถานะไปแล้ว กรุณาตรวจสอบและลองใหม่", en: "Couldn't save. The chosen pickup place may no longer be available, or the request has already changed status. Please check and try again." },
  "printingJobs.readyErrorTitle": { th: "ไม่สามารถดำเนินการได้", en: "Action failed" },
  "handover.pickupLocation": { th: "สถานที่รับเอกสาร", en: "Pickup location" },
  "submitted.pickupLocation": { th: "สถานที่รับเอกสาร:", en: "Pickup location:" },
  "printingJobs.th.completion": { th: "วันนัดรับ (ยืนยันแล้ว)", en: "Confirmed Completion Date" },
  "printingJobs.th.action": { th: "การดำเนินการ", en: "Action" },
  "printingJobs.markReady": { th: "ทำเครื่องหมายพร้อมส่งมอบ", en: "Mark Ready for Pickup" },

  "handover.title": { th: "จุดส่งมอบเอกสาร", en: "Counter Handover" },
  "handover.subtitle": { th: "ตรวจสอบ Claim Code และบันทึกข้อมูลผู้รับก่อนยืนยันส่งมอบ", en: "Verify the Claim Code and record the Receiver's info before confirming handover." },
  "handover.searchTitle": { th: "ค้นหาด้วย Claim Code", en: "Look Up by Claim Code" },
  "handover.claimCodeLabel": { th: "Claim Code (6 หลัก)", en: "Claim Code (6 digits)" },
  "handover.searchBtn": { th: "ค้นหา", en: "Search" },
  "handover.notFound": { th: "ไม่พบคำขอที่ตรงกับรหัสนี้ หรือคำขอยังไม่พร้อมส่งมอบ กรุณาตรวจสอบ Claim Code อีกครั้ง", en: "No request matches this code, or it isn't ready for pickup yet. Please check the Claim Code again." },
  "handover.matchTitle": { th: "พบคำขอที่ตรงกัน", en: "Match found" },
  "handover.receiverSectionTitle": { th: "ข้อมูลผู้รับ", en: "Receiver Information" },
  "handover.sameAsRequesterBtn": { th: "ผู้รับคือผู้ขอเอง (กรอกให้อัตโนมัติ)", en: "Receiver is the Requester (autofill)" },
  "handover.receiverInfo.hint": { th: "ข้อมูลนี้เป็นบันทึกว่าใครมารับเอกสาร", en: "A record of who collected the documents." },
  "handover.receiverName": { th: "ชื่อผู้รับ *", en: "Receiver Name *" },
  "handover.receiverPosition": { th: "ตำแหน่ง (หน้าที่ในที่ทำงาน) *", en: "Position (Job Role) *" },
  "handover.receiverWorkplace": { th: "ที่ทำงาน *", en: "Workplace *" },
  "handover.receiverWorkPhone": { th: "เบอร์โทรศัพท์ที่ทำงาน *", en: "Work Phone Number *" },
  "handover.receiverName.required": { th: "กรุณากรอกชื่อผู้รับ", en: "Please enter the receiver's name." },
  "handover.receiverPosition.required": { th: "กรุณากรอกตำแหน่งผู้รับ", en: "Please enter the receiver's position." },
  "handover.receiverWorkplace.required": { th: "กรุณากรอกที่ทำงานของผู้รับ", en: "Please enter the receiver's workplace." },
  "handover.receiverWorkPhone.required": { th: "กรุณากรอกเบอร์โทรศัพท์ที่ทำงาน", en: "Please enter the receiver's work phone number." },
  "handover.confirmBtn": { th: "ยืนยันส่งมอบ", en: "Confirm Handover" },
  "handover.successNotice": { th: "ส่งมอบเอกสารสำเร็จ บันทึกข้อมูลผู้ขอ เจ้าหน้าที่ ผู้รับ และเวลาไว้ในระบบแล้ว", en: "Handover completed. Requester, Officer, Receiver, and timestamp have been recorded." },
  "handover.searchAgain": { th: "ค้นหารายการถัดไป", en: "Look Up Next Request" },

  "kiosk.title": { th: "ตรวจสอบเอกสารพร้อมรับ", en: "Check Document Pickup Status" },
  "kiosk.backToLogin": { th: "กลับหน้าเข้าสู่ระบบ", en: "Back to Login" },
  "kiosk.subtitle": { th: "กรอก Claim Code 6 หลักที่ได้รับแจ้ง เพื่อตรวจสอบว่าเอกสารของท่านพร้อมรับหรือยัง", en: "Enter your 6-digit Claim Code to check whether your documents are ready for pickup." },
  "kiosk.readyTitle": { th: "เอกสารของท่านพร้อมรับแล้ว", en: "Your documents are ready" },
  "kiosk.forName": { th: "สำหรับ", en: "For" },
  "kiosk.confirmBtn": { th: "ยืนยันรับเอกสาร", en: "Confirm Pickup" },
  "kiosk.successNotice": { th: "รับเอกสารเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ", en: "Pickup confirmed. Thank you." },
  "kiosk.confirmError": { th: "ยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือแจ้งเจ้าหน้าที่", en: "Couldn't confirm pickup. Please try again, or ask staff for help." },
  "kiosk.tooManyRequests": { th: "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง", en: "Too many attempts. Please wait a moment and try again." },
  "kiosk.needSignInTitle": { th: "จุดรับเอกสารนี้ยังไม่พร้อมใช้งาน", en: "This pickup station isn't ready yet" },
  "kiosk.needSignIn": { th: "ต้องมีเจ้าหน้าที่เข้าสู่ระบบก่อน จึงจะใช้งานได้", en: "An Officer needs to sign in first before this can be used." },
  "kiosk.signInBtn": { th: "เจ้าหน้าที่เข้าสู่ระบบที่นี่", en: "Officer Sign In" },
  "kiosk.wrongAccountTitle": { th: "เข้าสู่ระบบผิดบัญชี", en: "Signed in with the wrong account" },
  "kiosk.wrongAccount": { th: "บัญชีนี้ไม่ใช่บัญชีเจ้าหน้าที่ จึงใช้งานจุดรับเอกสารนี้ไม่ได้", en: "This account isn't an Officer account, so it can't be used at this pickup station." },
  "kiosk.logoutBtn": { th: "ออกจากระบบ", en: "Sign Out" },
  "kiosk.responsibleOfficer": { th: "เจ้าหน้าที่ผู้รับผิดชอบ", en: "Responsible Officer" },

  "crumb.history": { th: "ประวัติคำขอทั้งหมด / <strong>ภาพรวม</strong>", en: "History / Audit Log / <strong>Overview</strong>" },
  "history.title": { th: "ประวัติคำขอทั้งหมด", en: "History / Audit Log" },
  "history.subtitle": { th: "ค้นหาและตรวจสอบคำขอทุกรายการในระบบ ไม่ว่าจะอยู่สถานะใด", en: "Search and review every request in the system, at any status." },
  "history.searchLabel": { th: "ค้นหา", en: "Search" },
  "history.searchPlaceholder": { th: "RUN NUMBER, เลขอ้างอิง, ชื่อผู้ขอ/ผู้รับ, หรือ Claim Code", en: "RUN NUMBER, reference no., requester/receiver name, or Claim Code" },
  "history.filterStatus": { th: "สถานะ", en: "Status" },
  "history.filterStatus.all": { th: "ทุกสถานะ", en: "All statuses" },
  "history.filterAgency": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "history.filterAgency.all": { th: "ทุกหน่วยงาน", en: "All agencies" },
  "history.filterYear": { th: "ปีที่ส่งคำขอ", en: "Submission Year" },
  "history.filterYear.all": { th: "ทุกปี", en: "All years" },
  "history.filterMonth": { th: "เดือนที่ส่งคำขอ", en: "Submission Month" },
  "history.filterMonth.all": { th: "ทุกเดือน", en: "All months" },
  "history.th.ref": { th: "เลขอ้างอิง / RUN NUMBER", en: "Reference No. / RUN NUMBER" },
  "history.th.requester": { th: "ผู้ขอ", en: "Requester" },
  "history.th.agency": { th: "หน่วยงาน", en: "Agency" },
  "history.th.item": { th: "รายการ", en: "Item" },
  "history.th.submitted": { th: "วันที่ส่งคำขอ", en: "Submitted" },
  "history.th.status": { th: "สถานะ", en: "Status" },
  "history.th.officer": { th: "เจ้าหน้าที่ผู้ดำเนินการ", en: "Processing Officer" },
  "history.th.form": { th: "ใบคำขอ", en: "Request Form" },
  "history.viewForm": { th: "ดูใบคำขอ", en: "View Form" },
  "history.empty": { th: "ไม่พบคำขอที่ตรงกับเงื่อนไขที่ค้นหา", en: "No requests match your search/filters." },
  "history.resultCount": { th: "แสดง {from}–{to} จาก {total} รายการ", en: "Showing {from}–{to} of {total}" },
  "history.rowsPerPage": { th: "แสดงต่อหน้า", en: "Rows per page" },
  "history.perPageSuffix": { th: "/ หน้า", en: "/ page" },
  "history.pageInfo": { th: "หน้า {page} จาก {pages}", en: "Page {page} of {pages}" },
  "history.prevPage": { th: "‹ ก่อนหน้า", en: "‹ Previous" },
  "history.nextPage": { th: "ถัดไป ›", en: "Next ›" },

  "user.role.admin": { th: "ผู้ดูแลระบบ", en: "Admin" },
  "user.logout": { th: "ออกจากระบบ", en: "Log out" },

  "notif.title": { th: "การแจ้งเตือน", en: "Notifications" },
  "notif.markAllRead": { th: "อ่านทั้งหมด", en: "Mark all read" },
  "notif.empty": { th: "ยังไม่มีการแจ้งเตือน", en: "No notifications yet" },
  "user.logoutModalTitle": { th: "ยืนยันการออกจากระบบ", en: "Confirm Logout" },
  "user.logoutModalMessage": { th: "คุณต้องการที่จะออกจากระบบใช่ไหม?" }, en: "Are you sure you want to log out?",
  "user.logoutBtn": { th: "ออกจากระบบ", en: "Log out" },
  "crumb.admin": { th: "จัดการบัญชีเจ้าหน้าที่ / <strong>ภาพรวม</strong>", en: "Officer Accounts / <strong>Overview</strong>" },

  "admin.title": { th: "จัดการบัญชีเจ้าหน้าที่", en: "Officer Account Management" },
  "admin.subtitle": { th: "อีเมลที่อยู่ในรายชื่อนี้ได้สิทธิ์เจ้าหน้าที่ (Officer) ส่วนอีเมลอื่นเป็นผู้ขอ (Requester) โดยอัตโนมัติ", en: "Listed emails get Officer access; all other emails are Requesters automatically." },
  "admin.addTitle": { th: "เพิ่มเจ้าหน้าที่ใหม่", en: "Add New Officer" },
  "admin.nameLabel": { th: "ชื่อ-นามสกุล *", en: "Full Name *" },
  "admin.nameError": { th: "กรุณากรอกชื่อ-นามสกุล", en: "Please enter a name." },
  "admin.emailLabel": { th: "อีเมลมหาวิทยาลัย *", en: "University Email *" },
  "admin.emailError.invalid": { th: "ต้องเป็นอีเมลที่ลงท้ายด้วย @mfu.ac.th เท่านั้น", en: "Must be an email ending in @mfu.ac.th" },
  "admin.emailError.duplicate": { th: "อีเมลนี้มีสิทธิ์เจ้าหน้าที่อยู่แล้ว", en: "This email already has the Officer role." },
  "admin.addBtn": { th: "เพิ่มเจ้าหน้าที่", en: "Add Officer" },
  "admin.tableTitle": { th: "รายชื่อเจ้าหน้าที่ปัจจุบัน", en: "Current Officer Accounts" },
  "admin.th.name": { th: "ชื่อ-นามสกุล", en: "Name" },
  "admin.th.email": { th: "อีเมล", en: "Email" },
  "admin.th.assignedBy": { th: "มอบสิทธิ์โดย", en: "Assigned By" },
  "admin.th.assignedDate": { th: "วันที่มอบสิทธิ์", en: "Assigned Date" },
  "admin.th.action": { th: "การดำเนินการ", en: "Action" },
  "admin.revokeBtn": { th: "เพิกถอนสิทธิ์", en: "Revoke" },
  "admin.confirmRevokeBtn": { th: "ยืนยันเพิกถอน", en: "Confirm Revoke" },
  "admin.revokeModalTitle": { th: "ยืนยันการเพิกถอนสิทธิ์", en: "Confirm Revoke" },
  "admin.revokeModalMessage": { th: "ต้องการเพิกถอนสิทธิ์เจ้าหน้าที่ของ {name} ({email}) ใช่หรือไม่? บัญชีนี้จะไม่สามารถเข้าใช้งานฝั่งเจ้าหน้าที่ได้อีกในครั้งถัดไปที่ล็อกอิน", en: "Revoke the Officer role for {name} ({email})? They will lose Officer access starting next login." },
  "admin.addModalTitle": { th: "ยืนยันการเพิ่มเจ้าหน้าที่", en: "Confirm New Officer" },
  "admin.addModalMessage": { th: "เพิ่ม {name} ({email}) เป็นเจ้าหน้าที่ใช่หรือไม่?", en: "Add {name} ({email}) as an Officer?" },
  "modal.cancel": { th: "ยกเลิก", en: "Cancel" },
  "modal.confirm": { th: "ยืนยัน", en: "Confirm" },
  "modal.ok": { th: "ตกลง", en: "OK" },
  "result.success": { th: "ทำรายการสำเร็จ", en: "Done" },
  "result.failure": { th: "ทำรายการไม่สำเร็จ", en: "Couldn't complete" },
  "result.network": { th: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง", en: "Couldn't reach the server. Check your connection and try again." },
  "result.generic": { th: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", en: "Something went wrong. Please try again." },
  "result.formError": { th: "ยังส่งไม่ได้ กรุณาแก้ไขตามที่แจ้งไว้ในหน้านี้", en: "Not sent yet — please fix what's shown on this page." },
  "result.msg.submitted": { th: "ส่งคำขอพิมพ์เอกสารเรียบร้อยแล้ว เลขที่คำขอและขั้นตอนต่อไปแสดงอยู่ในหน้านี้", en: "Your print request was submitted. The reference number and next steps are on this page." },
  "result.msg.edited": { th: "บันทึกการแก้ไขคำขอเรียบร้อยแล้ว", en: "Your changes to the request were saved." },
  "result.err.notEditable": { th: "แก้ไขคำขอไม่ได้แล้ว เนื่องจากเจ้าหน้าที่ดำเนินการคำขอนี้ไปแล้ว การแก้ไขจึงไม่ถูกบันทึก", en: "This request can no longer be edited — an officer has already acted on it, so your changes weren't saved." },
  "result.err.evaluationRequired": { th: "ยังสร้างคำขอใหม่ไม่ได้ กรุณาทำแบบประเมินความพึงพอใจของคำขอก่อนหน้าให้เสร็จก่อน", en: "You can't create a new request yet — please finish the satisfaction evaluation for your previous request first." },
  "profile.saveSuccess": { th: "บันทึกโปรไฟล์เรียบร้อยแล้ว", en: "Your profile was saved." },
  "profile.saveError": { th: "บันทึกโปรไฟล์ไม่สำเร็จ ข้อมูลหน่วยงานที่เลือกอาจถูกเปลี่ยนไปแล้ว ระบบจะโหลดหน้าใหม่ กรุณาเลือกอีกครั้ง", en: "Your profile wasn't saved — the selected department may have changed. The page will reload; please choose again." },
  "detail.result.approved": { th: "อนุมัติคำขอ {ref} แล้ว นัดรับวันที่ {date} ระบบแจ้งผู้ขอให้ทราบแล้ว", en: "Request {ref} approved for {date}. The requester has been notified." },
  "detail.result.rejected": { th: "ปฏิเสธคำขอ {ref} แล้ว ระบบแจ้งผู้ขอพร้อมเหตุผลแล้ว", en: "Request {ref} rejected. The requester has been notified with the reason." },
  "detail.result.notAwaiting": { th: "ดำเนินการคำขอ {ref} ไม่ได้ เนื่องจากคำขอนี้ถูกดำเนินการหรือยกเลิกไปแล้ว หน้านี้แสดงสถานะล่าสุดแล้ว", en: "Couldn't act on {ref} — it was already handled or cancelled. This page now shows its latest status." },
  "printingJobs.readySuccess": { th: "บันทึกว่าคำขอ {ref} พิมพ์เสร็จพร้อมรับแล้ว ระบบแจ้งผู้ขอให้ทราบแล้ว", en: "{ref} marked ready for pickup. The requester has been notified." },
  "handover.result.done": { th: "ส่งมอบเอกสารคำขอ {ref} ให้ {name} เรียบร้อยแล้ว", en: "Request {ref} handed over to {name}." },
  "handover.result.notReady": { th: "ส่งมอบคำขอ {ref} ไม่ได้ เนื่องจากคำขอนี้ไม่ได้อยู่ในสถานะพร้อมรับ (อาจส่งมอบไปแล้ว)", en: "Couldn't hand over {ref} — it isn't ready for pickup (it may already have been handed over)." },
  "admin.result.added": { th: "เพิ่ม {name} ({email}) เป็นเจ้าหน้าที่แล้ว", en: "{name} ({email}) was added as an officer." },
  "admin.result.removed": { th: "ยกเลิกสิทธิ์เจ้าหน้าที่ของ {name} ({email}) แล้ว", en: "Officer access for {name} ({email}) was revoked." },
  "settings.savedMsgFull": { th: "บันทึกการตั้งค่าระบบเรียบร้อยแล้ว", en: "System settings saved." },
  "result.msg.evaluated": { th: "ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณสำหรับความคิดเห็น", en: "Your evaluation was submitted. Thank you for the feedback." },
  "admin.empty": { th: "ยังไม่มีเจ้าหน้าที่ในระบบ", en: "No officer accounts yet." },

  "crumb.systemSettings": { th: "จัดการระบบ / <strong>ภาพรวม</strong>", en: "System Settings / <strong>Overview</strong>" },
  "crumb.adminLocations": { th: "สถานที่รับ-ส่งเอกสาร / <strong>ภาพรวม</strong>", en: "Drop-off & Pickup Locations / <strong>Overview</strong>" },
  "crumb.adminAuditLog": { th: "ประวัติการแก้ไข / <strong>ภาพรวม</strong>", en: "Change History / <strong>Overview</strong>" },
  "crumb.adminAgencies": { th: "หน่วยงาน / <strong>ภาพรวม</strong>", en: "Agencies / <strong>Overview</strong>" },
  "crumb.adminBackup": { th: "สำรองและกู้คืนข้อมูล / <strong>ภาพรวม</strong>", en: "Backup & Restore / <strong>Overview</strong>" },
  "backup.title": { th: "สำรองและกู้คืนข้อมูล", en: "Backup & Restore" },
  "backup.subtitle": { th: "เก็บข้อมูลทั้งหมดในระบบเป็นไฟล์ และเลือกไฟล์ที่ต้องการนำกลับมาใช้ได้ทุกเมื่อ", en: "Keep all system data as files, and bring any of them back whenever you need to." },
  "backup.current.title": { th: "ข้อมูลในระบบตอนนี้", en: "Data in the system now" },
  "backup.current.fromFile": { th: "มาจากไฟล์ “{name}”", en: "Loaded from “{name}”" },
  "backup.current.loadedAt": { th: "นำเข้าเมื่อ {date} (หลังจากนั้นอาจมีการใช้งานเพิ่ม)", en: "Loaded on {date} (it may have been used since)" },
  "backup.current.loadedAtDeleted": { th: "นำเข้าเมื่อ {date} — ไฟล์นี้ถูกลบออกจากรายการแล้ว แต่ข้อมูลในระบบยังอยู่ครบ", en: "Loaded on {date} — the file has since been deleted, the data is still here" },
  "backup.current.cleared": { th: "ล้างข้อมูลแล้ว (ใช้ค่าเริ่มต้น)", en: "Cleared (using defaults)" },
  "backup.current.clearedAt": { th: "ล้างเมื่อ {date}", en: "Cleared on {date}" },
  "backup.current.live": { th: "ข้อมูลที่ใช้งานอยู่ในระบบ", en: "The system's own working data" },
  "backup.current.liveHint": { th: "ยังไม่เคยนำไฟล์สำรองมาใช้", en: "No backup file has been loaded yet" },
  "backup.current.total": { th: "รายการทั้งหมด", en: "Total records" },
  "backup.current.saveBtn": { th: "บันทึกเป็นไฟล์ใหม่", en: "Save as new file" },
  "backup.current.saving": { th: "กำลังบันทึกข้อมูลเป็นไฟล์…", en: "Saving data to a file…" },
  "backup.current.clearBtn": { th: "ล้างข้อมูลทั้งหมด", en: "Clear all data" },
  "backup.files.title": { th: "ไฟล์สำรองข้อมูล", en: "Backup files" },
  "backup.files.desc": { th: "กด “ใช้ไฟล์นี้” เพื่อแทนที่ข้อมูลทั้งหมดในระบบด้วยข้อมูลในไฟล์ ก่อนทุกครั้งระบบจะสำรองข้อมูลปัจจุบันเก็บไว้ในรายการนี้ให้อัตโนมัติ จึงย้อนกลับได้เสมอ", en: "Press “Use this file” to replace all system data with the file's. The current data is always saved to this list automatically first, so you can go back." },
  "backup.files.uploadBtn": { th: "อัปโหลดไฟล์", en: "Upload file" },
  "backup.files.uploading": { th: "กำลังอัปโหลดและตรวจสอบไฟล์…", en: "Uploading and checking the file…" },
  "backup.files.dropHint": { th: "วางไฟล์ที่นี่เพื่ออัปโหลด", en: "Drop the file here to upload" },
  "backup.files.empty": { th: "ยังไม่มีไฟล์ — กด “บันทึกเป็นไฟล์ใหม่” หรือ “อัปโหลดไฟล์”", en: "No files yet — use “Save as new file” or “Upload file”" },
  "backup.files.useBtn": { th: "ใช้ไฟล์นี้", en: "Use this file" },
  "backup.files.downloadBtn": { th: "ดาวน์โหลด", en: "Download" },
  "backup.files.deleteBtn": { th: "ลบไฟล์", en: "Delete file" },
  "backup.files.activeBadge": { th: "ใช้อยู่", en: "In use" },
  "backup.files.autoBadge": { th: "อัตโนมัติ", en: "Automatic" },
  "backup.files.olderBadge": { th: "ระบบเวอร์ชันเก่า", en: "Older version" },
  "backup.files.olderHint": { th: "ไฟล์นี้มาจากระบบเวอร์ชันก่อนหน้า ใช้ได้ตามปกติ ข้อมูลส่วนที่เพิ่มเข้ามาในเวอร์ชันใหม่จะเป็นค่าเริ่มต้น", en: "This file is from an earlier version of the system. It can be used; anything added in later versions gets its default value." },
  "backup.files.newerBadge": { th: "ใช้ไม่ได้: มาจากระบบเวอร์ชันใหม่กว่า", en: "Can't use: from a newer version" },
  "backup.files.dataAt": { th: "ข้อมูล ณ {date}", en: "Data as of {date}" },
  "backup.files.requests": { th: "คำขอ {n} รายการ", en: "{n} requests" },
  "backup.files.autoKeep": { th: "ไฟล์อัตโนมัติจะเก็บไว้ล่าสุด {n} ไฟล์ ส่วนไฟล์ที่บันทึกหรืออัปโหลดเองจะอยู่จนกว่าจะลบ", en: "The latest {n} automatic files are kept; files you save or upload stay until you delete them." },
  "backup.kind.snapshot": { th: "สำรองข้อมูล {date}", en: "Backup {date}" },
  "backup.kind.autoBeforeApply": { th: "สำรองอัตโนมัติ ก่อนใช้ไฟล์ “{name}”", en: "Auto backup before using “{name}”" },
  "backup.kind.autoBeforeRestore": { th: "สำรองอัตโนมัติ ก่อนกู้คืน", en: "Auto backup before a restore" },
  "backup.kind.autoBeforeClear": { th: "สำรองอัตโนมัติ ก่อนล้างข้อมูล", en: "Auto backup before clearing" },
  "backup.apply.title": { th: "ใช้ไฟล์ “{name}”?", en: "Use “{name}”?" },
  "backup.apply.message": { th: "ข้อมูลปัจจุบันทั้งหมดในระบบจะถูกแทนที่ด้วยข้อมูลในไฟล์ “{name}” ระบบจะสำรองข้อมูลปัจจุบันเก็บไว้ในรายการให้อัตโนมัติก่อน", en: "All current data will be replaced by the data in “{name}”. The current data is saved to the list automatically first." },
  "backup.apply.messageFrom": { th: "ข้อมูลปัจจุบัน (จากไฟล์ “{current}”) จะถูกแทนที่ด้วยข้อมูลในไฟล์ “{name}” ระบบจะสำรองข้อมูลปัจจุบันเก็บไว้ในรายการให้อัตโนมัติก่อน", en: "The current data (from “{current}”) will be replaced by the data in “{name}”. The current data is saved to the list automatically first." },
  "backup.apply.processing": { th: "กำลังนำข้อมูลจากไฟล์เข้าระบบ…", en: "Loading the file's data…" },
  "backup.delete.title": { th: "ลบไฟล์ “{name}”?", en: "Delete “{name}”?" },
  "backup.delete.message": { th: "ไฟล์จะถูกลบออกจากรายการถาวร ข้อมูลในระบบไม่เปลี่ยนแปลง", en: "The file is removed from the list for good. The data in the system doesn't change." },
  "backup.delete.messageActive": { th: "ข้อมูลในระบบตอนนี้มาจากไฟล์นี้ — ลบไฟล์แล้วข้อมูลในระบบยังอยู่ครบ แต่จะใช้ไฟล์นี้ย้อนกลับไม่ได้อีก", en: "The current data came from this file — deleting it keeps the data, but you can no longer go back to this file." },
  "backup.clear.title": { th: "ล้างข้อมูลทั้งหมด?", en: "Clear all data?" },
  "backup.clear.message": { th: "ข้อมูลการใช้งานทั้งหมดจะถูกลบ (คำขอ ผู้ขอ บัญชีเจ้าหน้าที่ แจ้งเตือน ประวัติ) ส่วนหน่วยงาน สถานที่รับ-ส่งเอกสาร และการตั้งค่าระบบ จะกลับเป็นค่าเริ่มต้น เพื่อให้ระบบรับคำขอได้ทันที (แก้ไขต่อได้ตามปกติ) ค่าใน .env และสิทธิ์ Admin ไม่เปลี่ยน ระบบจะสำรองข้อมูลปัจจุบันเก็บไว้ในรายการให้อัตโนมัติก่อน", en: "All usage data is deleted (requests, requesters, officer accounts, notifications, history). Departments, drop-off/pickup places and system settings go back to their defaults so the system can take requests right away (still editable). .env values and Admin access don't change. The current data is saved to the list automatically first." },
  "backup.clear.processing": { th: "กำลังล้างข้อมูล…", en: "Clearing data…" },
  "backup.confirm.label": { th: "พิมพ์คำว่า", en: "Type" },
  "backup.confirm.label2": { th: "เพื่อยืนยัน", en: "to confirm" },
  "backup.compare.table": { th: "ข้อมูล", en: "Data" },
  "backup.compare.current": { th: "ในระบบตอนนี้", en: "Now" },
  "backup.compare.file": { th: "หลังใช้ไฟล์นี้", en: "After" },
  "backup.flash.applied": { th: "นำข้อมูลจากไฟล์ “{name}” เข้าระบบแล้ว ข้อมูลก่อนหน้าถูกสำรองไว้เป็นไฟล์อัตโนมัติในรายการ", en: "Loaded “{name}”. The previous data was saved as an automatic file in the list." },
  "backup.flash.cleared": { th: "ล้างข้อมูลทั้งหมดแล้ว หน่วยงาน สถานที่ และการตั้งค่ากลับเป็นค่าเริ่มต้น ข้อมูลก่อนล้างถูกสำรองไว้เป็นไฟล์อัตโนมัติในรายการ", en: "All data cleared; departments, places and settings are back to their defaults. The data from before was saved as an automatic file in the list." },
  "backup.flash.saved": { th: "บันทึกข้อมูลปัจจุบันเป็นไฟล์ “{name}” แล้ว", en: "Saved the current data as “{name}”." },
  "backup.flash.uploaded": { th: "อัปโหลดไฟล์ “{name}” แล้ว — ข้อมูลในระบบยังไม่เปลี่ยน จนกว่าจะกด “ใช้ไฟล์นี้”", en: "Uploaded “{name}” — the system's data doesn't change until you press “Use this file”." },
  "backup.flash.deleted": { th: "ลบไฟล์แล้ว", en: "File deleted." },
  "backup.history.title": { th: "ประวัติ", en: "History" },
  "backup.history.hint": { th: "การสำรอง อัปโหลด ใช้ไฟล์ ล้าง และลบไฟล์ทั้งหมด เรียงจากล่าสุด", en: "Every save, upload, load, clear and delete, newest first" },
  "backup.history.empty": { th: "ยังไม่มีประวัติ", en: "No history yet" },
  "backup.history.more": { th: "แสดงเพิ่ม", en: "Show more" },
  "backup.history.remaining": { th: "(เหลืออีก {n} รายการ)", en: "({n} more)" },
  "backup.history.backupExport": { th: "ดาวน์โหลดไฟล์สำรอง", en: "Downloaded a backup" },
  "backup.history.backupSnapshot": { th: "บันทึกเป็นไฟล์ใหม่", en: "Saved as new file" },
  "backup.history.backupUpload": { th: "อัปโหลดไฟล์", en: "Uploaded a file" },
  "backup.history.backupRestore": { th: "ใช้ไฟล์", en: "Used a file" },
  "backup.history.backupRollback": { th: "ย้อนกลับข้อมูล", en: "Rolled back" },
  "backup.history.backupClear": { th: "ล้างข้อมูลทั้งหมด", en: "Cleared all data" },
  "backup.history.backupDelete": { th: "ลบไฟล์", en: "Deleted a file" },
  "auditLog.action.backupExport": { th: "ดาวน์โหลดไฟล์สำรอง", en: "Downloaded a backup" },
  "auditLog.action.backupSnapshot": { th: "บันทึกไฟล์สำรอง", en: "Saved a backup file" },
  "auditLog.action.backupUpload": { th: "อัปโหลดไฟล์สำรอง", en: "Uploaded a backup file" },
  "auditLog.action.backupRestore": { th: "ใช้ไฟล์สำรอง", en: "Used a backup file" },
  "auditLog.action.backupRollback": { th: "ย้อนกลับข้อมูล", en: "Rolled back" },
  "auditLog.action.backupClear": { th: "ล้างข้อมูลทั้งหมด", en: "Cleared all data" },
  "auditLog.action.backupDelete": { th: "ลบไฟล์สำรอง", en: "Deleted a backup file" },
  "backup.table.Request": { th: "คำขอพิมพ์เอกสาร", en: "Print requests" },
  "backup.table.Evaluation": { th: "ผลประเมินความพึงพอใจ", en: "Evaluations" },
  "backup.table.Profile": { th: "โปรไฟล์ผู้ขอ", en: "Requester profiles" },
  "backup.table.Officer": { th: "บัญชีเจ้าหน้าที่", en: "Officer accounts" },
  "backup.table.AgencyCategory": { th: "ประเภทหน่วยงาน", en: "Agency categories" },
  "backup.table.AgencyUnit": { th: "หน่วยงาน", en: "Departments" },
  "backup.table.Location": { th: "สถานที่รับและส่งเอกสาร", en: "Locations" },
  "backup.table.Notification": { th: "การแจ้งเตือน", en: "Notifications" },
  "backup.table.AuditLog": { th: "ประวัติการแก้ไข", en: "Change history" },
  "backup.table.Counter": { th: "ตัวนับเลขคำขอ", en: "Number counters" },
  "backup.table.SystemSetting": { th: "การตั้งค่าระบบ", en: "System settings" },
  "backup.error.generic": { th: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", en: "Something went wrong. Please try again." },
  "backup.error.empty": { th: "ไฟล์ว่างเปล่า", en: "The file is empty." },
  "backup.error.unreadable": { th: "อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ .json.gz ที่ได้จากหน้านี้", en: "Couldn't read this file. Use a .json.gz file downloaded from this page." },
  "backup.error.notOdprs": { th: "ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของระบบนี้", en: "This isn't a backup file from this system." },
  "backup.error.formatVersion": { th: "รูปแบบไฟล์ไม่รองรับ", en: "Unsupported backup file format." },
  "backup.error.checksum": { th: "ไฟล์เสียหายหรือถูกแก้ไข จึงไม่สามารถใช้กู้คืนได้", en: "The file is damaged or was modified, so it can't be restored." },
  "backup.error.missingTable": { th: "ข้อมูลในไฟล์ไม่ครบ", en: "The file is missing data." },
  "backup.error.schemaNewer": { th: "ไฟล์นี้มาจากระบบเวอร์ชันที่ใหม่กว่าเครื่องนี้ กรุณาอัปเดตระบบบนเครื่องนี้ก่อน แล้วค่อยใช้ไฟล์", en: "This file is from a newer version of the system than this server. Update this server first, then use the file." },
  "backup.error.incompatible": { th: "ไฟล์นี้เก่าเกินกว่าจะแปลงเข้ากับระบบเวอร์ชันนี้ได้ ข้อมูลในระบบไม่ถูกเปลี่ยนแปลง", en: "This file is too old to convert to this version of the system. Nothing was changed." },
  "backup.error.notFound": { th: "ไม่พบไฟล์นี้แล้ว กรุณารีเฟรชหน้า", en: "That file no longer exists. Please refresh the page." },
  "backup.error.tooLarge": { th: "ไฟล์ใหญ่เกินกว่าที่รองรับ", en: "The file is too large." },
  "backup.error.confirmPhrase": { th: "คำยืนยันไม่ถูกต้อง", en: "The confirmation text doesn't match." },
  "backup.error.busy": { th: "มีการนำเข้าหรือล้างข้อมูลกำลังดำเนินการอยู่ กรุณารอสักครู่", en: "Another load or clear is still running. Please wait." },
  "settings.title": { th: "จัดการระบบ", en: "System Settings" },
  "settings.subtitle": { th: "แจ้งเตือนอีเมลเจ้าหน้าที่ และเปิด/ปิดระบบสำหรับผู้ขอ", en: "Officer email alerts and Requester access." },
  "settings.notif.title": { th: "แจ้งเตือนเจ้าหน้าที่", en: "Officer Alerts" },
  "settings.notif.toggle": { th: "ส่งอีเมลเมื่อมีคำขอใหม่", en: "Email officers on new requests" },
  "settings.notif.toggle.hint": { th: "การแจ้งเตือนในระบบ (กระดิ่ง) ทำงานเสมอ", en: "The in-app bell always stays on." },

  "adminLocations.title": { th: "สถานที่รับ-ส่งเอกสาร", en: "Drop-off & Pickup Locations" },
  "adminLocations.subtitle": { th: "กำหนดที่ส่งเอกสารต้นฉบับและที่รับเอกสารที่พิมพ์เสร็จ กรอกทั้งไทยและอังกฤษ", en: "Set where originals are dropped off and finished prints are picked up. Fill in both Thai and English." },
  "adminLocations.tableTitle": { th: "รายการสถานที่", en: "Locations" },
  "adminLocations.editHint": { th: "การแก้ไขชื่อหรือรายละเอียดจะแสดงกับคำขอที่ยังค้างอยู่ทันที แต่อีเมลที่ส่งไปแล้วแก้ไม่ได้", en: "Edits show immediately on requests still in progress, but emails already sent can't be changed." },
  "adminLocations.form.addTitle": { th: "เพิ่มสถานที่ใหม่", en: "Add Location" },
  "adminLocations.form.editTitle": { th: "แก้ไขสถานที่", en: "Edit Location" },
  "adminLocations.form.phone": { th: "เบอร์โทรติดต่อ", en: "Contact phone" },
  "adminLocations.form.phonePlaceholder": { th: "เช่น 053-916xxx (ชื่อผู้ติดต่อ)", en: "e.g. 053-916xxx (Contact name)" },
  "adminLocations.form.mapUrl": { th: "ลิงก์แผนที่ (ถ้ามี)", en: "Map link (optional)" },
  "adminLocations.form.mapUrlPlaceholder": { th: "เช่น https://maps.app.goo.gl/...", en: "e.g. https://maps.app.goo.gl/..." },
  "adminLocations.form.acceptsDropoff": { th: "เป็นจุดส่งเอกสารต้นฉบับ", en: "Drop-off point for original documents" },
  "adminLocations.form.acceptsPickup": { th: "เป็นจุดรับเอกสารที่พิมพ์เสร็จ", en: "Pickup point for finished copies" },
  "adminLocations.form.defaultDropoff": { th: "ใช้เป็นค่าเริ่มต้น", en: "Use as the default" },
  "adminLocations.form.defaultPickup": { th: "ใช้เป็นค่าเริ่มต้น", en: "Use as the default" },
  "adminLocations.addBtn": { th: "เพิ่มสถานที่", en: "Add Location" },
  "adminLocations.form.basicInfo": { th: "ชื่อและรายละเอียด", en: "Name & details" },
  "adminLocations.form.colTh": { th: "ภาษาไทย", en: "Thai" },
  "adminLocations.form.colEn": { th: "ภาษาอังกฤษ", en: "English" },
  "adminLocations.form.rowName": { th: "ชื่อสถานที่ *", en: "Name *" },
  "adminLocations.form.rowDetail": { th: "อาคาร / ชั้น / ห้อง", en: "Building / floor / room" },
  "adminLocations.form.hours": { th: "เวลาทำการ", en: "Opening hours" },
  "adminLocations.form.hoursFrom": { th: "ตั้งแต่วัน", en: "From" },
  "adminLocations.form.hoursTo": { th: "ถึงวัน", en: "to" },
  "adminLocations.form.hoursOpen": { th: "เปิด", en: "Opens" },
  "adminLocations.form.hoursClose": { th: "ปิด", en: "Closes" },
  "adminLocations.form.hoursNone": { th: "ไม่ระบุ", en: "Not set" },
  "adminLocations.form.hoursPreview": { th: "จะแสดงให้ผู้ใช้เห็นเป็น:", en: "Users will see:" },
  "adminLocations.form.hoursHint": { th: "เว้นว่างทั้งหมดถ้าไม่ต้องการแสดงเวลาทำการ", en: "Leave all blank to show no opening hours." },
  "adminLocations.form.hoursLegacy": { th: "เวลาเดิมที่เคยพิมพ์ไว้:", en: "Existing hours (typed earlier):" },
  "adminLocations.form.hoursLegacyHint": { th: "ระบบเปลี่ยนเป็นแบบเลือกแล้ว — ปล่อยว่างไว้เพื่อคงค่าเดิม หรือเลือกใหม่เพื่อแทนที่", en: "Hours are now picked from lists — leave blank to keep this, or choose new hours to replace it." },
  "adminLocations.form.contact": { th: "ติดต่อ", en: "Contact" },
  "adminLocations.form.usage": { th: "ใช้งานเป็น", en: "Used as" },
  "adminLocations.form.editTitleNamed": { th: "แก้ไขสถานที่: {name}", en: "Edit Location: {name}" },
  "adminLocations.deleteBtn": { th: "ลบ", en: "Delete" },
  "adminLocations.deleteConfirmTitle": { th: "ลบสถานที่นี้ถาวร?", en: "Delete this location permanently?" },
  "adminLocations.deleteConfirmMessage": { th: "“{name}” จะถูกลบถาวรและกู้คืนไม่ได้ ถ้าเคยมีคำขอใช้สถานที่นี้แล้วระบบจะไม่ให้ลบ ให้ใช้ “เก็บถาวร” แทน", en: "“{name}” will be deleted for good. If any request has used it, deletion is blocked — use “Archive” instead." },
  "adminLocations.err.inUse": { th: "ลบไม่ได้: มีคำขอ {n} รายการเคยใช้สถานที่นี้ กรุณาใช้ “เก็บถาวร” แทน", en: "Can't delete: {n} request(s) have used this place. Use “Archive” instead." },
  "adminLocations.err.hoursIncomplete": { th: "เวลาทำการไม่ครบ กรุณาเลือกทั้งวันเริ่ม วันสิ้นสุด เวลาเปิด และเวลาปิด หรือเว้นว่างทั้งหมด", en: "Opening hours are incomplete — choose both days and both times, or leave all blank." },
  "adminLocations.err.hoursInvalid": { th: "เวลาทำการไม่ถูกต้อง เวลาปิดต้องอยู่หลังเวลาเปิด และวันสิ้นสุดต้องไม่มาก่อนวันเริ่ม", en: "Invalid hours — closing must be after opening, and the last day can't be before the first." },
  "adminLocations.banner.saved": { th: "บันทึกสถานที่ “{name}” เรียบร้อยแล้ว", en: "Saved “{name}”." },
  "adminLocations.banner.deleted": { th: "ลบสถานที่ “{name}” แล้ว", en: "Deleted “{name}”." },
  "adminLocations.banner.archived": { th: "เก็บถาวร “{name}” แล้ว", en: "Archived “{name}”." },
  "adminLocations.banner.restored": { th: "นำ “{name}” กลับมาใช้แล้ว", en: "Restored “{name}”." },
  "adminLocations.form.saveBtn": { th: "บันทึกสถานที่", en: "Save Location" },
  "adminLocations.form.cancelEditBtn": { th: "ยกเลิกการแก้ไข", en: "Cancel Edit" },
  "adminLocations.th.name": { th: "สถานที่", en: "Location" },
  "adminLocations.th.usage": { th: "ใช้สำหรับ", en: "Used for" },
  "adminLocations.th.contact": { th: "เวลาทำการ / โทร", en: "Hours / phone" },
  "adminLocations.th.action": { th: "การดำเนินการ", en: "Actions" },
  "adminLocations.badge.dropoff": { th: "ส่งเอกสาร", en: "Drop-off" },
  "adminLocations.badge.pickup": { th: "รับเอกสาร", en: "Pickup" },
  "adminLocations.badge.default": { th: "เริ่มต้น", en: "Default" },
  "adminLocations.badge.archived": { th: "เก็บถาวร", en: "Archived" },
  "adminLocations.badge.missingEn": { th: "ยังไม่มีชื่อภาษาอังกฤษ", en: "English name missing" },
  "adminLocations.badge.inFlight": { th: "คำขอค้างอยู่ {n} รายการ", en: "{n} pending request(s)" },
  "adminLocations.editBtn": { th: "แก้ไข", en: "Edit" },
  "adminLocations.archiveBtn": { th: "เก็บถาวร", en: "Archive" },
  "adminLocations.restoreBtn": { th: "นำกลับมาใช้", en: "Restore" },
  "adminLocations.moveUp": { th: "เลื่อนขึ้น", en: "Move up" },
  "adminLocations.moveDown": { th: "เลื่อนลง", en: "Move down" },
  "adminLocations.archiveConfirmTitle": { th: "เก็บถาวรสถานที่นี้?", en: "Archive this location?" },
  "adminLocations.archiveConfirmMessage": { th: "“{name}” จะไม่แสดงเป็นตัวเลือกอีก คำขอที่เคยเลือกสถานที่นี้ยังคงเห็นชื่อเดิม", en: "“{name}” will no longer be offered as a choice. Requests that already use it keep showing its name." },
  "adminLocations.err.nameRequired": { th: "กรุณากรอกชื่อสถานที่ทั้งภาษาไทยและอังกฤษ", en: "Please enter the location name in both Thai and English." },
  "adminLocations.err.purposeRequired": { th: "กรุณาเลือกอย่างน้อยหนึ่งอย่าง: ส่งเอกสารต้นฉบับ หรือ รับเอกสารที่พิมพ์เสร็จ", en: "Choose at least one: drop-off or pickup." },
  "adminLocations.err.lastDropoff": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นสถานที่ส่งเอกสารแห่งสุดท้ายที่ยังใช้งานอยู่", en: "Can't archive — this is the last active drop-off location." },
  "adminLocations.err.lastPickup": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นสถานที่รับเอกสารแห่งสุดท้ายที่ยังใช้งานอยู่", en: "Can't archive — this is the last active pickup location." },
  "adminLocations.err.generic": { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", en: "Couldn't save. Please try again." },
  "adminLocations.empty": { th: "ยังไม่มีสถานที่", en: "No locations yet." },
  "newRequest.error.agency": { th: "ประเภทหน่วยงาน/หน่วยงานไม่ถูกต้อง", en: "Invalid agency category/unit" },
  "newRequest.error.agency.body": { th: "กรุณาเลือกประเภทหน่วยงานและหน่วยงานใหม่อีกครั้ง", en: "Please choose the agency category and unit again." },
  "adminLocations.movedModal.title": { th: "ยืนยันการแก้ไข", en: "Confirm this edit" },
  "adminLocations.movedModal.message": { th: "มีคำขอ {n} รายการที่ยังอ้างถึงสถานที่นี้อยู่ การแก้ไขนี้คือ...", en: "{n} request(s) still refer to this place. This edit is..." },
  "adminLocations.movedModal.optionTypo": { th: "แก้คำผิด/พิมพ์ตก (ไม่แจ้งใคร)", en: "Fixing a typo (no one is notified)" },
  "adminLocations.movedModal.optionMoved": { th: "ย้ายสถานที่จริง (แจ้งผู้ขอ {n} คน)", en: "An actual move ({n} requester(s) will be notified)" },
  "adminLocations.movedModal.confirmBtn": { th: "ยืนยันการแก้ไข", en: "Confirm edit" },
  "adminLocations.archiveReplaceModal.title": { th: "เลือกสถานที่ทดแทน", en: "Choose a replacement location" },
  "adminLocations.archiveReplaceModal.message": { th: "“{name}” มีคำขอ {n} รายการที่ยังอ้างถึงอยู่ กรุณาเลือกสถานที่ทดแทน ระบบจะย้ายคำขอเหล่านี้ไปที่นั่นและแจ้งผู้ขอให้ทราบ", en: "“{name}” still has {n} request(s) pointing at it. Choose a replacement — those requests will move there and their requesters will be notified." },
  "adminLocations.archiveReplaceModal.selectLabel": { th: "สถานที่ทดแทน", en: "Replacement location" },
  "adminLocations.archiveReplaceModal.confirmBtn": { th: "เก็บถาวรและย้ายคำขอ", en: "Archive and move requests" },
  "adminLocations.archiveReplaceModal.noOptions": { th: "ไม่มีสถานที่อื่นที่ใช้งานอยู่และรองรับประเภทเดียวกัน กรุณาเพิ่มสถานที่ใหม่ก่อนเก็บถาวรที่นี่", en: "No other active location accepts the same purpose(s). Add a new location before archiving this one." },
  "adminLocations.banner.savedNotified": { th: "บันทึกสถานที่ “{name}” และแจ้งผู้ขอ {n} คนเรื่องการย้ายแล้ว", en: "Saved “{name}” and notified {n} requester(s) about the move." },
  "adminLocations.banner.archivedNotified": { th: "เก็บถาวร “{name}” และย้ายคำขอ {n} รายการไปสถานที่ทดแทนแล้ว", en: "Archived “{name}” and moved {n} request(s) to the replacement location." },
  "adminLocations.err.replacementRequired": { th: "มีคำขอใหม่เข้ามาระหว่างนี้ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง", en: "New requests came in meanwhile — please reload the page and try again." },
  "adminLocations.err.replacementInvalid": { th: "สถานที่ทดแทนไม่ถูกต้องหรือไม่ได้ใช้งานอยู่", en: "The replacement location is invalid or inactive." },
  "adminLocations.err.replacementPurposeMismatch": { th: "สถานที่ทดแทนต้องรองรับประเภทเดียวกับที่มีคำขอค้างอยู่", en: "The replacement location must accept the same purpose(s) as the pending requests." },

  "auditLog.title": { th: "ประวัติการแก้ไข", en: "Change History" },
  "auditLog.subtitle": { th: "บันทึกว่าใครแก้ไขข้อมูลอ้างอิง (เช่น สถานที่รับ-ส่งเอกสาร) เมื่อไหร่ เรียงจากล่าสุด", en: "Who changed reference data (e.g. locations) and when, most recent first." },
  "auditLog.tableTitle": { th: "รายการล่าสุด", en: "Recent changes" },
  "auditLog.th.time": { th: "เวลา", en: "Time" },
  "auditLog.th.actor": { th: "ผู้แก้ไข", en: "Changed by" },
  "auditLog.th.action": { th: "การดำเนินการ", en: "Action" },
  "auditLog.th.entity": { th: "รายการ", en: "Item" },
  "auditLog.th.detail": { th: "รายละเอียดที่เปลี่ยน", en: "What changed" },
  "auditLog.action.locationCreate": { th: "เพิ่มสถานที่", en: "Added location" },
  "auditLog.action.locationUpdate": { th: "แก้ไขสถานที่", en: "Edited location" },
  "auditLog.action.locationArchive": { th: "เก็บถาวรสถานที่", en: "Archived location" },
  "auditLog.action.locationRestore": { th: "นำสถานที่กลับมาใช้", en: "Restored location" },
  "auditLog.action.locationDelete": { th: "ลบสถานที่", en: "Deleted location" },
  "auditLog.field.isActive": { th: "ใช้งานอยู่", en: "Active" },
  "auditLog.createdNote": { th: "สร้างใหม่", en: "Newly created" },
  "auditLog.deletedNote": { th: "ถูกลบ", en: "Deleted" },
  "auditLog.empty": { th: "ไม่พบประวัติที่ตรงกับเงื่อนไขที่เลือก", en: "No changes match the selected filters." },

  "adminAgencies.title": { th: "หน่วยงาน", en: "Agencies" },
  "adminAgencies.subtitle": { th: "กำหนดประเภทหน่วยงานและหน่วยงานย่อยที่ผู้ขอเลือกตอนส่งคำขอ กรอกทั้งภาษาไทยและอังกฤษ", en: "Set the agency categories and units Requesters pick from. Fill in both Thai and English." },
  "adminAgencies.categoriesTitle": { th: "ประเภทหน่วยงาน", en: "Agency Categories" },
  "adminAgencies.addCategoryBtn": { th: "เพิ่มประเภท", en: "Add Category" },
  "adminAgencies.addUnitBtn": { th: "เพิ่มหน่วยงาน", en: "Add Unit" },
  "adminAgencies.backBtn": { th: "ประเภทหน่วยงาน", en: "Agency Categories" },
  "adminAgencies.unitsOf": { th: "หน่วยงานย่อยของ: {name}", en: "Units of: {name}" },
  "adminAgencies.viewUnitsBtn": { th: "ดูหน่วยงาน ({n})", en: "View units ({n})" },
  "adminAgencies.freeTextHint": { th: "ผู้ขอพิมพ์ชื่อหน่วยงานเอง", en: "Requester types the unit name" },
  "adminAgencies.categoriesEmpty": { th: "ยังไม่มีประเภทหน่วยงาน", en: "No agency categories yet." },
  "adminAgencies.unitsEmpty": { th: "ยังไม่มีหน่วยงานในประเภทนี้", en: "No units in this category yet." },
  "adminAgencies.form.nameTh": { th: "ชื่อ (ไทย) *", en: "Name (Thai) *" },
  "adminAgencies.form.nameEn": { th: "ชื่อ (อังกฤษ) *", en: "Name (English) *" },
  "adminAgencies.form.allowsFreeText": { th: "ไม่มีรายชื่อหน่วยงานย่อย — ให้ผู้ขอพิมพ์ชื่อหน่วยงานเอง", en: "No fixed unit list — Requester types the unit name" },
  "adminAgencies.form.saveBtn": { th: "บันทึก", en: "Save" },
  "adminAgencies.categoryForm.addTitle": { th: "เพิ่มประเภทหน่วยงาน", en: "Add Agency Category" },
  "adminAgencies.categoryForm.editTitleNamed": { th: "แก้ไขประเภทหน่วยงาน: {name}", en: "Edit Agency Category: {name}" },
  "adminAgencies.unitForm.addTitle": { th: "เพิ่มหน่วยงาน", en: "Add Unit" },
  "adminAgencies.unitForm.editTitleNamed": { th: "แก้ไขหน่วยงาน: {name}", en: "Edit Unit: {name}" },
  "adminAgencies.unitForm.category": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "adminAgencies.unitForm.categoryHint": { th: "เปลี่ยนได้ถ้าต้องการย้ายหน่วยงานนี้ไปอีกประเภทหนึ่ง", en: "Change this to move the unit to a different category." },
  "adminAgencies.th.name": { th: "ชื่อ", en: "Name" },
  "adminAgencies.th.units": { th: "หน่วยงานย่อย", en: "Units" },
  "adminAgencies.th.action": { th: "การดำเนินการ", en: "Actions" },
  "adminAgencies.badge.freeText": { th: "พิมพ์เอง", en: "Free text" },
  "adminAgencies.badge.archived": { th: "เก็บถาวร", en: "Archived" },
  "adminAgencies.editBtn": { th: "แก้ไข", en: "Edit" },
  "adminAgencies.archiveBtn": { th: "เก็บถาวร", en: "Archive" },
  "adminAgencies.restoreBtn": { th: "นำกลับมาใช้", en: "Restore" },
  "adminAgencies.deleteBtn": { th: "ลบ", en: "Delete" },
  "adminAgencies.archiveConfirmTitle": { th: "เก็บถาวรรายการนี้?", en: "Archive this?" },
  "adminAgencies.archiveConfirmMessage": { th: "“{name}” จะไม่แสดงเป็นตัวเลือกอีก คำขอที่เคยเลือกไว้ยังคงเห็นชื่อเดิม", en: "“{name}” will no longer be offered as a choice. Requests that already use it keep showing its name." },
  "adminAgencies.deleteConfirmTitle": { th: "ลบถาวร?", en: "Delete permanently?" },
  "adminAgencies.deleteConfirmMessage": { th: "“{name}” จะถูกลบถาวรและกู้คืนไม่ได้ ถ้าเคยมีคำขอใช้แล้วระบบจะไม่ให้ลบ ให้ใช้ “เก็บถาวร” แทน", en: "“{name}” will be deleted for good. If any request has used it, deletion is blocked — use “Archive” instead." },
  "adminAgencies.banner.saved": { th: "บันทึก “{name}” เรียบร้อยแล้ว", en: "Saved “{name}”." },
  "adminAgencies.banner.archived": { th: "เก็บถาวร “{name}” แล้ว", en: "Archived “{name}”." },
  "adminAgencies.banner.restored": { th: "นำ “{name}” กลับมาใช้แล้ว", en: "Restored “{name}”." },
  "adminAgencies.banner.deleted": { th: "ลบ “{name}” แล้ว", en: "Deleted “{name}”." },
  "adminAgencies.err.nameRequired": { th: "กรุณากรอกชื่อทั้งภาษาไทยและอังกฤษ", en: "Please enter the name in both Thai and English." },
  "adminAgencies.err.categoryRequired": { th: "กรุณาเลือกประเภทหน่วยงาน", en: "Please choose an agency category." },
  "adminAgencies.err.categoryInvalid": { th: "ประเภทหน่วยงานไม่ถูกต้อง", en: "Invalid agency category." },
  "adminAgencies.err.lastCategory": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นประเภทหน่วยงานแห่งสุดท้ายที่ยังใช้งานอยู่", en: "Can't archive — this is the last active agency category." },
  "adminAgencies.err.lastFreeText": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นประเภท “พิมพ์เอง” แห่งสุดท้ายที่ยังใช้งานอยู่ — ผู้ขอที่ไม่ตรงกับหมวดใดเลยจะไม่มีตัวเลือกให้กรอก", en: "Can't archive — this is the last active free-text category. Requesters who don't fit any other category would have no option left." },
  "adminAgencies.err.hasUnits": { th: "ลบไม่ได้: ยังมีหน่วยงานย่อยอยู่ในประเภทนี้ กรุณาลบหรือย้ายหน่วยงานย่อยก่อน", en: "Can't delete: this category still has units. Delete or move them first." },
  "adminAgencies.err.inUse": { th: "ลบไม่ได้: มีคำขอ {n} รายการเคยใช้แล้ว กรุณาใช้ “เก็บถาวร” แทน", en: "Can't delete: {n} request(s) have used this. Use “Archive” instead." },
  "adminAgencies.err.generic": { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", en: "Couldn't save. Please try again." },
  "auditLog.filterActor.all": { th: "ผู้แก้ไขทั้งหมด", en: "All editors" },
  "auditLog.filterAction.all": { th: "การดำเนินการทั้งหมด", en: "All actions" },
  "settings.maint.title": { th: "ปิดระบบชั่วคราว", en: "Maintenance Mode" },
  "settings.maint.toggle": { th: "ปิดระบบสำหรับผู้ขอ", en: "Close the system to Requesters" },
  "settings.maint.toggle.hint": { th: "เจ้าหน้าที่และผู้ดูแลระบบยังใช้งานได้ตามปกติ", en: "Officers and Admins are unaffected." },
  "settings.maint.scheduleTitle": { th: "ช่วงเวลาปิดระบบ (ไม่บังคับ)", en: "Closing period (optional)" },
  "settings.maint.startLabel": { th: "ปิดระบบตั้งแต่", en: "Close from" },
  "settings.maint.startPlaceholder": { th: "ทันทีที่บันทึก", en: "As soon as you save" },
  "settings.maint.endLabel": { th: "เปิดระบบอีกครั้ง", en: "Reopen on" },
  "settings.maint.endPlaceholder": { th: "เมื่อปิดสวิตช์เอง", en: "When switched off by hand" },
  "settings.maint.timeLabel": { th: "เวลา", en: "Time" },
  "settings.maint.clearBtn": { th: "ล้าง", en: "Clear" },
  "settings.maint.status.off": { th: "ระบบเปิดให้ผู้ขอใช้งานตามปกติ", en: "The system is open to Requesters." },
  "settings.maint.status.closedIndefinitely": { th: "ระบบจะปิดสำหรับผู้ขอทันที จนกว่าจะปิดสวิตช์เอง", en: "Closed to Requesters now, until switched off." },
  "settings.maint.status.closedUntil": { th: "ระบบจะปิดสำหรับผู้ขอทันที และเปิดอีกครั้งอัตโนมัติ {end}", en: "Closed to Requesters now; reopens automatically on {end}." },
  "settings.maint.status.scheduled": { th: "ระบบจะปิดสำหรับผู้ขอ {start} และเปิดอีกครั้งอัตโนมัติ {end}", en: "Closes to Requesters on {start} and reopens automatically on {end}." },
  "settings.maint.status.scheduledOpenEnded": { th: "ระบบจะปิดสำหรับผู้ขอ {start} จนกว่าจะปิดสวิตช์เอง", en: "Closes to Requesters on {start}, until switched off." },
  "settings.maint.status.ended": { th: "ช่วงเวลาปิดระบบสิ้นสุดแล้ว ผู้ขอใช้งานได้ตามปกติ", en: "The closing period has ended; Requesters have access again." },
  "settings.maint.err.endBeforeStart": { th: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม", en: "The end time must be after the start time." },
  "settings.maint.err.endInPast": { th: "เวลาสิ้นสุดผ่านไปแล้ว กรุณาเลือกเวลาในอนาคต", en: "The end time has already passed. Please pick a future time." },
  "settings.maint.err.dateInvalid": { th: "วันที่หรือเวลาไม่ถูกต้อง", en: "Invalid date or time." },
  "settings.maint.confirmMessageScheduled": { th: "ผู้ขอ (Requester) ทุกคนจะเข้าใช้งานระบบไม่ได้ตั้งแต่ {start} ต้องการดำเนินการต่อหรือไม่?", en: "Every Requester will lose access to the system from {start}. Continue?" },
  "systemClosed.reopensAt": { th: "เปิดให้บริการอีกครั้ง {end}", en: "Reopens on {end}" },
  "settings.maint.messagesTitle": { th: "ข้อความแจ้งผู้ขอ (ไม่บังคับ)", en: "Message to Requesters (optional)" },
  "settings.maint.messageLabel": { th: "ภาษาไทย", en: "Thai" },
  "settings.maint.messagePlaceholder": { th: "เช่น ปิดรับคำขอช่วงสอบปลายภาค 1–15 ต.ค. 2569", en: "e.g. Closed for final exams, Oct 1–15." },
  "settings.maint.messageEnLabel": { th: "ภาษาอังกฤษ", en: "English" },
  "settings.maint.messageEnPlaceholder": { th: "เว้นว่าง = แปลอัตโนมัติ", en: "Blank = auto-translate" },
  "settings.maint.translateHint": { th: "เว้นว่างไว้ ระบบจะแปลจากภาษาไทยให้อัตโนมัติเมื่อบันทึก", en: "Leave blank to auto-translate from Thai on save." },
  "settings.maint.confirmTitle": { th: "ยืนยันการปิดระบบ", en: "Confirm Maintenance Mode" },
  "settings.maint.confirmMessage": { th: "ผู้ขอ (Requester) ทุกคนจะเข้าใช้งานระบบไม่ได้ทันทีหลังบันทึก ต้องการดำเนินการต่อหรือไม่?", en: "Every Requester will immediately lose access to the system after saving. Continue?" },
  "settings.saveBtn": { th: "บันทึกการตั้งค่า", en: "Save Settings" },
  "settings.savedMsg": { th: "บันทึกแล้ว", en: "Saved." },
  "systemClosed.title": { th: "ระบบปิดปรับปรุงชั่วคราว", en: "System Temporarily Closed" },
  "systemClosed.status": { th: "กำลังปรับปรุงระบบ", en: "Maintenance in progress" },
  "systemClosed.defaultMessage": { th: "ขณะนี้ระบบปิดรับคำขอพิมพ์เอกสารชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง", en: "The print request system is temporarily closed. Please check back later." },

  "profile.linkTitle": { th: "แก้ไขโปรไฟล์", en: "Edit Profile" },
  "crumb.profile": { th: "โปรไฟล์ของฉัน / <strong>แก้ไขข้อมูล</strong>", en: "My Profile / <strong>Edit</strong>" },
  "profile.title": { th: "โปรไฟล์ของฉัน", en: "My Profile" },
  "profile.section.personal": { th: "ข้อมูลส่วนตัว", en: "Personal Info" },
  "profile.section.workplace": { th: "ข้อมูลหน่วยงาน", en: "Workplace Info" },
  "profile.prefixLabel": { th: "คำนำหน้า", en: "Title" },
  "profile.prefix.none": { th: "— ไม่ระบุ —", en: "— Not set —" },
  "profile.prefix.mr": { th: "นาย", en: "Mr." },
  "profile.prefix.mrs": { th: "นาง", en: "Mrs." },
  "profile.prefix.miss": { th: "นางสาว", en: "Ms." },
  "profile.prefix.dr": { th: "ดร.", en: "Dr." },
  "profile.prefix.asstProf": { th: "ผศ.", en: "Asst. Prof." },
  "profile.prefix.asstProfDr": { th: "ผศ.ดร.", en: "Asst. Prof. Dr." },
  "profile.prefix.assocProf": { th: "รศ.", en: "Assoc. Prof." },
  "profile.prefix.assocProfDr": { th: "รศ.ดร.", en: "Assoc. Prof. Dr." },
  "profile.prefix.prof": { th: "ศ.", en: "Prof." },
  "profile.prefix.profDr": { th: "ศ.ดร.", en: "Prof. Dr." },
  "profile.prefixOther.placeholder": { th: "ระบุคำนำหน้า", en: "Enter a title" },
  "profile.nameLabel": { th: "ชื่อ-นามสกุล", en: "Full Name" },
  "profile.phoneLabel": { th: "เบอร์โทรศัพท์", en: "Phone Number" },
  "profile.workplaceCategoryLabel": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "profile.workplaceUnitLabel": { th: "หน่วยงาน", en: "Agency/Unit" },
  "profile.workplaceCategory.none": { th: "— ไม่ระบุ —", en: "— Not set —" },
  "profile.positionLabel": { th: "ตำแหน่ง", en: "Position" },
  "profile.saveBtn": { th: "บันทึกโปรไฟล์", en: "Save Profile" },

  "requestForm.crumb": { th: "ใบคำขอพิมพ์เอกสาร", en: "Request Form" },
  "requestForm.subtitle": { th: "ใบคำขอพิมพ์เอกสารฉบับเต็ม สำหรับตรวจสอบหรือพิมพ์ซ้ำ", en: "Full Request Form, for review or re-printing." },
  "requestForm.backToHistory": { th: "กลับไปที่ประวัติคำขอ", en: "Back to History" },

  "crumb.dashboard": { th: "แดชบอร์ดสรุปข้อมูล / <strong>ภาพรวม</strong>", en: "Dashboard / <strong>Overview</strong>" },
  "crumb.evaluations": { th: "ผลประเมินความพึงพอใจ / <strong>ภาพรวม</strong>", en: "Evaluation Results / <strong>Overview</strong>" },
  "dashboard.title": { th: "แดชบอร์ดสรุปข้อมูล", en: "Summary Dashboard" },
  "dashboard.subtitle": { th: "ภาพรวมการใช้ทรัพยากรกระดาษ แยกตามหน่วยงานและประเภทหน่วยงาน สำหรับใช้รายงานต่อมหาวิทยาลัย", en: "Overview of paper resource usage, broken down by department and department type — for reporting to the university." },
  "dashboard.yearFilter": { th: "ปีที่ต้องการดู", en: "Year" },
  "dashboard.yearFilter.all": { th: "ทุกปี", en: "All years" },
  "dashboard.monthFilter.all": { th: "ทุกเดือน", en: "All months" },
  "dashboard.dateMode.custom": { th: "กำหนดช่วงวันที่เอง", en: "Custom Date Range" },
  "dashboard.dateMode.clear": { th: "ล้าง", en: "Clear" },
  "dashboard.dateMode.rangeTo": { th: "ถึง", en: "to" },
  "dashboard.filter.period": { th: "ช่วงเวลา", en: "Period" },
  "export.excel": { th: "ส่งออก Excel", en: "Export to Excel" },
  "export.preparing": { th: "กำลังสร้างไฟล์…", en: "Building file…" },
  "export.failed": { th: "ส่งออกไม่สำเร็จ ลองใหม่", en: "Export failed, try again" },
  "filter.status": { th: "สถานะ", en: "Status" },
  "filter.agency": { th: "หน่วยงาน", en: "Department" },
  "filter.month": { th: "เดือน", en: "Month" },
  "filter.show": { th: "แสดง", en: "Show" },
  "filter.actor": { th: "ผู้แก้ไข", en: "Edited by" },
  "filter.action": { th: "การดำเนินการ", en: "Action" },
  "filter.dateRange": { th: "ช่วงวันที่", en: "Date range" },

  "dashboard.tab.overview": { th: "ภาพรวม", en: "Overview" },
  "dashboard.tab.category": { th: "ตามประเภทหน่วยงาน", en: "By Agency Category" },
  "dashboard.tab.unit": { th: "ตามหน่วยงาน", en: "By Department" },

  "dashboard.kpi.totalRequests": { th: "จำนวนคำขอทั้งหมด", en: "Total Requests" },
  "dashboard.kpi.totalSheets": { th: "จำนวนแผ่นกระดาษที่ใช้ไป (รวม)", en: "Paper Sheets Used (Total)" },
  "dashboard.kpi.avgSheets": { th: "เฉลี่ยแผ่นกระดาษ/คำขอ", en: "Avg. Sheets / Request" },
  "dashboard.kpi.activeUnits": { th: "จำนวนหน่วยงานที่มีการใช้งาน", en: "Active Departments" },

  "dashboard.documentTypeFilter": { th: "ประเภทเอกสาร", en: "Document Type" },
  "dashboard.documentTypeFilter.all": { th: "ทุกประเภทเอกสาร", en: "All document types" },
  "dashboard.documentTypeFilter.exam": { th: "ข้อสอบ", en: "Exam" },
  "dashboard.documentTypeFilter.general": { th: "เอกสารทั่วไป", en: "General Document" },

  "dashboard.paperSourceFilter": { th: "แหล่งที่มากระดาษ", en: "Paper Source" },
  "dashboard.paperSourceFilter.all": { th: "ทุกแหล่งที่มากระดาษ", en: "All paper sources" },
  "dashboard.paperSourceFilter.office": { th: "ฝ่ายทะเบียนจัดเตรียมให้", en: "Provided by Registrar Division" },
  "dashboard.paperSourceFilter.requester": { th: "ผู้ขอจัดเตรียมเอง", en: "Provided by Requester" },
  "dashboard.paperSourceDefaultNote": { th: "ค่าเริ่มต้นนับเฉพาะกระดาษที่ฝ่ายทะเบียนจัดเตรียม เพื่อใช้รายงานงบประมาณ", en: "By default, only paper provided by the Registrar Division is counted, for budget reporting." },

  "dashboard.trendSheetsTitle": { th: "จำนวนแผ่นกระดาษที่ใช้ต่อปี", en: "Paper Sheets Used per Year" },
  "dashboard.trendNote": { th: "ไม่ขึ้นกับตัวกรองช่วงเวลาด้านบน แต่ขึ้นกับตัวกรองประเภทเอกสารและแหล่งที่มากระดาษ", en: "Not affected by the time filter above, but follows the document type and paper source filters." },

  "dashboard.categorySheetsTitle": { th: "จำนวนแผ่นกระดาษที่ใช้ แยกตามประเภทหน่วยงาน", en: "Paper Sheets Used by Agency Category" },
  "dashboard.sheetsNote": { th: "คำนวณจากคำขอที่ได้รับการอนุมัติและปริ้นแล้วเท่านั้น (ไม่รวมคำขอที่ถูกปฏิเสธหรือยังรอเอกสารต้นฉบับ) นับเป็นจำนวนแผ่นกระดาษจริงที่ใช้ (พิมพ์สองหน้านับครึ่งหนึ่งของจำนวนหน้า) — ใช้ตัวเลขนี้ประกอบการรายงานและประมาณการงบประมาณ", en: "Calculated only from approved/printed requests (excludes rejected and still-awaiting requests). Counted as actual physical paper sheets used (double-sided printing counts as half the page count) — use this figure for reporting and budget estimation." },

  "dashboard.categoryTableTitle": { th: "ตารางสรุปรายประเภทหน่วยงาน", en: "Agency Category Summary Table" },
  "dashboard.unitTopTitle": { th: "10 อันดับหน่วยงานที่ใช้กระดาษมากที่สุด", en: "Top 10 Departments by Paper Usage" },
  "dashboard.unitTableTitle": { th: "ตารางสรุปรายหน่วยงาน (ทั้งหมด)", en: "Full Department Summary Table" },
  "dashboard.unitSearchLabel": { th: "ค้นหาหน่วยงาน", en: "Search Department" },
  "dashboard.unitSearchPlaceholder": { th: "พิมพ์ชื่อหน่วยงาน", en: "Type a department name" },
  "dashboard.unitCategoryFilterLabel": { th: "กรองตามประเภทหน่วยงาน", en: "Filter by Agency Category" },
  "dashboard.unitCategoryFilter.all": { th: "ทุกประเภทหน่วยงาน", en: "All agency categories" },

  "dashboard.th.category": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "dashboard.th.unit": { th: "หน่วยงาน", en: "Department" },
  "dashboard.th.requests": { th: "จำนวนคำขอ", en: "Requests" },
  "dashboard.th.copies": { th: "จำนวนชุดที่ปริ้นแล้ว", en: "Copies Printed" },
  "dashboard.th.sheets": { th: "จำนวนแผ่นกระดาษที่ใช้", en: "Paper Sheets Used" },
  "dashboard.th.avgSheets": { th: "เฉลี่ยแผ่น/คำขอ", en: "Avg. Sheets / Request" },

  "dashboard.highest": { th: "สูงสุด", en: "Highest" },
  "dashboard.lowest": { th: "ต่ำสุด", en: "Lowest" },
  "dashboard.noData": { th: "ไม่มีข้อมูลสำหรับปีที่เลือก", en: "No data for the selected year." },
  "dashboard.range.lastYears": { th: "{n} ปีล่าสุด", en: "Last {n} years" },
  "dashboard.range.all": { th: "ทั้งหมด", en: "All" },
  "dashboard.yearWord": { th: "ปี พ.ศ.", en: "Year" },
  "dashboard.trend.latest": { th: "ปีล่าสุด", en: "Latest year" },
  "dashboard.trend.change": { th: "เทียบกับปีก่อนหน้า", en: "vs. previous year" },
  "dashboard.trend.peak": { th: "ปีที่ใช้มากที่สุด", en: "Highest year" },
  "dashboard.trend.avg": { th: "เฉลี่ยต่อปี", en: "Yearly average" },
  "dashboard.trend.fromPrev": { th: "จากปีก่อนหน้า", en: "from previous year" },
  "dashboard.trend.yAxis": { th: "จำนวนแผ่นกระดาษ (แผ่น)", en: "Paper sheets" },
  "dashboard.trend.xAxis": { th: "ปี พ.ศ.", en: "Year" },
  "dashboard.trend.view.chart": { th: "กราฟ", en: "Chart" },
  "dashboard.trend.view.table": { th: "ตาราง", en: "Table" },
  "dashboard.trend.vsYear": { th: "เทียบกับปี {y}", en: "compared with {y}" },
  "dashboard.trend.rangeYears": { th: "ปี {from} ถึง {to}", en: "{from} to {to}" },
  "dashboard.trend.th.year": { th: "ปี พ.ศ.", en: "Year" },
  "dashboard.trend.th.change": { th: "เปลี่ยนแปลงจากปีก่อนหน้า", en: "Change from previous year" },
  "dashboard.sheetsUnit": { th: "แผ่น", en: "sheets" },

  "evalReport.title": { th: "ผลประเมินความพึงพอใจ", en: "Evaluation Results" },
  "evalReport.subtitle": { th: "ภาพรวมคะแนนความพึงพอใจและความคิดเห็นจากผู้ขอ หลังได้รับเอกสารเรียบร้อยแล้ว", en: "Overview of satisfaction scores and feedback comments from Requesters after handover." },
  "evalReport.yearFilter": { th: "ปีที่ประเมิน", en: "Evaluation Year" },
  "evalReport.yearFilter.all": { th: "ปีที่ประเมิน: ทุกปี", en: "Year: All years" },

  "evalReport.tab.overview": { th: "ภาพรวม", en: "Overview" },
  "evalReport.tab.list": { th: "ค้นหา / รายการทั้งหมด", en: "Search / All Results" },

  "evalReport.kpi.totalEvaluated": { th: "จำนวนที่ได้รับการประเมิน", en: "Evaluations Received" },
  "evalReport.kpi.totalCompleted": { th: "จำนวนคำขอที่เสร็จสมบูรณ์", en: "Completed Requests" },
  "evalReport.kpi.totalWithComments": { th: "จำนวนที่มีความคิดเห็น", en: "With a Comment" },

  "evalReport.scoresTitle": { th: "คะแนนเฉลี่ยแยกตามหัวข้อ (เต็ม 5)", en: "Average Score by Category (out of 5)" },

  "evalReport.commentsTitle": { th: "ความคิดเห็นล่าสุด", en: "Latest Comments" },
  "evalReport.feed.subtitleRecent": { th: "{n} ความคิดเห็นล่าสุดจากผู้ขอ", en: "The {n} most recent comments from requesters" },
  "evalReport.feed.subtitleLowest": { th: "{n} ความคิดเห็นที่ได้คะแนนต่ำที่สุด", en: "The {n} lowest-rated comments" },
  "evalReport.feedSort.recent": { th: "ล่าสุด", en: "Latest" },
  "evalReport.feedSort.lowest": { th: "คะแนนต่ำก่อน", en: "Lowest first" },
  "evalReport.feed.today": { th: "วันนี้", en: "Today" },
  "evalReport.feed.yesterday": { th: "เมื่อวาน", en: "Yesterday" },
  "evalReport.feed.daysAgo": { th: "{n} วันที่แล้ว", en: "{n} days ago" },
  "evalReport.commentsFeedEmpty": { th: "ยังไม่มีความคิดเห็นสำหรับปีที่เลือก", en: "No comments yet for the selected year." },
  "evalReport.viewAllComments": { th: "ดูความคิดเห็นทั้งหมด", en: "View All Comments" },
  "evalReport.hasCommentFilter": { th: "เฉพาะที่มีความเห็น", en: "With a comment only" },

  "evalReport.searchLabel": { th: "ค้นหา", en: "Search" },
  "evalReport.searchPlaceholder": { th: "เลขอ้างอิง, ชื่อผู้ขอ, หรือคำในความคิดเห็น", en: "Reference no., requester name, or a word from the comment" },
  "evalReport.monthFilter": { th: "เดือนที่ประเมิน", en: "Evaluation Month" },
  "evalReport.monthFilter.all": { th: "เดือนที่ประเมิน: ทุกเดือน", en: "Month: All months" },
  "evalReport.sortFilter": { th: "เรียงตาม", en: "Sort by" },
  "evalReport.sortFilter.recent": { th: "ล่าสุดก่อน", en: "Most recent first" },
  "evalReport.sortFilter.lowest": { th: "คะแนนต่ำไปสูง", en: "Lowest score first" },

  "evalReport.th.ref": { th: "เลขอ้างอิง / RUN NUMBER", en: "Reference No. / RUN NUMBER" },
  "evalReport.th.requester": { th: "ผู้ขอ", en: "Requester" },
  "evalReport.th.item": { th: "รายการ", en: "Item" },
  "evalReport.th.officer": { th: "พนักงานที่รับผิดชอบ", en: "Responsible Officer" },
  "evalReport.th.overall": { th: "คะแนนโดยรวม", en: "Overall Score" },
  "evalReport.th.comment": { th: "ความคิดเห็น", en: "Comment" },
  "evalReport.th.submitted": { th: "วันที่ประเมิน", en: "Submitted" },

  "evalReport.noComment": { th: "— ไม่มีความคิดเห็น —", en: "— No comment —" },
  "evalReport.empty": { th: "ไม่พบผลการประเมินที่ตรงกับเงื่อนไขที่ค้นหา", en: "No evaluations match your search/filters." },
  "evalReport.resultCount": { th: "แสดง {from}–{to} จาก {total} รายการ", en: "Showing {from}–{to} of {total}" },
  "evalReport.rowsPerPage": { th: "แสดงต่อหน้า", en: "Rows per page" },
  "evalReport.pageInfo": { th: "หน้า {page} จาก {pages}", en: "Page {page} of {pages}" },
  "evalReport.prevPage": { th: "‹ ก่อนหน้า", en: "‹ Previous" },
  "evalReport.nextPage": { th: "ถัดไป ›", en: "Next ›" },
  "evalReport.noData": { th: "ยังไม่มีการประเมินสำหรับปีที่เลือก", en: "No evaluations yet for the selected year." }
};

function getLang() {
  return localStorage.getItem("odprs_lang") || "th";
}

function setLang(lang) {
  localStorage.setItem("odprs_lang", lang);
}

function t(key) {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[getLang()] || entry.th;
}

function applyI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });

  document.querySelectorAll("[data-i18n-value]").forEach(function (el) {
    el.value = t(el.getAttribute("data-i18n-value"));
  });

  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    el.title = t(el.getAttribute("data-i18n-title"));
  });

  document.querySelectorAll(".lang-toggle [data-lang]").forEach(function (el) {
    el.classList.toggle("active", el.getAttribute("data-lang") === lang);
  });

  document.dispatchEvent(new CustomEvent("odprs:langchange", { detail: { lang: lang } }));
}

function initLangToggle() {
  document.querySelectorAll(".lang-toggle [data-lang]").forEach(function (el) {
    el.style.cursor = "pointer";
    el.addEventListener("click", function () {
      setLang(el.getAttribute("data-lang"));
      applyI18n();
    });
  });
  applyI18n();
}

document.addEventListener("DOMContentLoaded", initLangToggle);

/* =====================================================================
   Icons — inline SVG (Feather-style outline, stroke="currentColor" so
   they inherit whatever text colour the surrounding element has).
   Elements opt in with data-icon="name"; injected once on load since
   icons don't change with language.
   ===================================================================== */

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  // New Print Request — a document with a plus
  "file-plus": `<svg ${SVG_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,

  // My Requests — a clipboard
  "clipboard": `<svg ${SVG_ATTRS}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,

  // Awaiting Original Queue — an inbox tray
  "inbox": `<svg ${SVG_ATTRS}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,

  // Printing Jobs — a printer
  "printer": `<svg ${SVG_ATTRS}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  "download": `<svg ${SVG_ATTRS}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  "log-out": `<svg ${SVG_ATTRS}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,

  // Counter Handover — a verified receiver (person + check)
  "user-check": `<svg ${SVG_ATTRS}><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><polyline points="17 11 19 13 23 9"/></svg>`,

  // Admin — Officer Accounts
  "users": `<svg ${SVG_ATTRS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,

  // History / Audit Log
  "archive": `<svg ${SVG_ATTRS}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,

  // Dashboard
  "bar-chart": `<svg ${SVG_ATTRS}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,

  // View Request Form
  "eye": `<svg ${SVG_ATTRS}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,

  // Edit Request
  "edit": `<svg ${SVG_ATTRS}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,

  // Copy-to-clipboard button
  "copy": `<svg ${SVG_ATTRS}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,

  // Notices
  "info": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  "clock": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  "check-circle": `<svg ${SVG_ATTRS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  "x-circle": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  "alert-circle": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  "alert-triangle": `<svg ${SVG_ATTRS}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  // Sidebar section collapse/expand
  "chevron-down": `<svg ${SVG_ATTRS}><polyline points="6 9 12 15 18 9"/></svg>`,
  "arrow-left": `<svg ${SVG_ATTRS}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,

  // Evaluation Results
  "star": `<svg ${SVG_ATTRS}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,

  // Notification bell
  "bell": `<svg ${SVG_ATTRS}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,

  // Admin — System Settings
  "settings": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  "map-pin": `<svg ${SVG_ATTRS}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  "phone": `<svg ${SVG_ATTRS}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,

  // Location "used as" cards — a pickup point
  "package": `<svg ${SVG_ATTRS}><path d="M16.5 9.4L7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  "search": `<svg ${SVG_ATTRS}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
};

function applyIcons() {
  document.querySelectorAll("[data-icon]").forEach(function (el) {
    const svg = ICONS[el.getAttribute("data-icon")];
    if (svg) el.innerHTML = svg;
  });
}

document.addEventListener("DOMContentLoaded", applyIcons);

/* =====================================================================
   Field hint popovers — a small (i) button next to a field label that
   toggles a short explanation, so the form itself stays uncluttered.
   ===================================================================== */

function initHintToggles() {
  document.querySelectorAll(".hint-toggle").forEach(function (btn) {
    if (btn.dataset.hintBound) return;
    btn.dataset.hintBound = "1";

    const panel = btn.closest(".field").querySelector(".hint-popover");
    if (!panel) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const willOpen = panel.hidden;
      document.querySelectorAll(".hint-popover").forEach(function (p) { p.hidden = true; });
      document.querySelectorAll(".hint-toggle").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
      panel.hidden = !willOpen;
      btn.setAttribute("aria-expanded", String(willOpen));
    });
  });

  document.addEventListener("click", function () {
    document.querySelectorAll(".hint-popover").forEach(function (p) { p.hidden = true; });
    document.querySelectorAll(".hint-toggle").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  });
}

document.addEventListener("DOMContentLoaded", initHintToggles);

/* =====================================================================
   Phone-style inputs — silently keep the value digits-only and capped at
   a max length (e.g. the 10-digit Thai mobile/office number format), no
   error message shown. Any <input data-max-digits="N"> anywhere in the
   app gets this automatically — no per-page wiring needed.
   ===================================================================== */

function applyDigitCaps() {
  document.querySelectorAll("[data-max-digits]").forEach(function (input) {
    if (input.dataset.digitCapBound) return;
    input.dataset.digitCapBound = "1";

    const max = parseInt(input.getAttribute("data-max-digits"), 10);
    input.addEventListener("input", function () {
      const digitsOnly = input.value.replace(/\D/g, "").slice(0, max);
      if (digitsOnly !== input.value) input.value = digitsOnly;
    });
  });
}

document.addEventListener("DOMContentLoaded", applyDigitCaps);

/* =====================================================================
   Notification bell (header.ejs) — polls the unread count so the badge
   stays fresh even if nobody opens the dropdown, and only fetches the
   full list lazily on click (no point paying for that fetch on every
   single page load across the whole app).
   ===================================================================== */

async function refreshNotifBadge() {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  try {
    const res = await fetch("/api/notifications/unread-count");
    const data = await res.json();
    if (data.count > 0) {
      badge.textContent = data.count > 99 ? "99+" : String(data.count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  } catch (err) {
    // Offline or session expired — leave whatever the badge last showed.
  }
}

// title/body come back as { th, en } (rendered server-side from stored
// params, see src/messages.js) so a language toggle can re-render the
// already-fetched list without another round trip — see renderNotifList().
let notifCache = [];

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderNotifList() {
  const list = document.getElementById("notif-list");
  if (!list) return;
  const lang = getLang();

  if (notifCache.length === 0) {
    list.innerHTML = '<div class="empty-state">' + t("notif.empty") + '</div>';
    return;
  }

  list.innerHTML = notifCache.map(function (n) {
    return '<div class="notif-item' + (n.isRead ? '' : ' unread') + '" data-id="' + n.id + '" data-link="' + escapeHtml(n.link || '') + '">' +
      '<div class="notif-item-title">' + escapeHtml(n.title[lang]) + '</div>' +
      '<div class="notif-item-body">' + escapeHtml(n.body[lang]) + '</div>' +
      '<div class="notif-item-time">' + formatDateTime(new Date(n.createdAt), lang) + '</div>' +
      '</div>';
  }).join("");

  list.querySelectorAll(".notif-item").forEach(function (el) {
    el.addEventListener("click", async function () {
      const id = el.getAttribute("data-id");
      const link = el.getAttribute("data-link");
      if (el.classList.contains("unread")) {
        el.classList.remove("unread");
        await fetch("/api/notifications/" + id + "/read", { method: "POST" });
        refreshNotifBadge();
      }
      if (link) window.location.href = link;
    });
  });
}

async function loadNotifList() {
  const list = document.getElementById("notif-list");
  if (!list) return;

  const res = await fetch("/api/notifications?limit=20");
  notifCache = await res.json();
  renderNotifList();
}

function initNotifBell() {
  const btn = document.getElementById("notif-bell-btn");
  const dropdown = document.getElementById("notif-dropdown");
  const markAllBtn = document.getElementById("notif-mark-all-btn");
  if (!btn || !dropdown || !markAllBtn) return; // header not rendered on this page (e.g. login screen)

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    const willOpen = dropdown.hidden;
    dropdown.hidden = !willOpen;
    if (willOpen) loadNotifList();
  });

  document.addEventListener("click", function (e) {
    if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== btn) {
      dropdown.hidden = true;
    }
  });

  markAllBtn.addEventListener("click", async function (e) {
    e.stopPropagation();
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    document.querySelectorAll(".notif-item.unread").forEach(function (el) { el.classList.remove("unread"); });
    refreshNotifBadge();
  });

  document.addEventListener("odprs:langchange", function () {
    if (!dropdown.hidden) renderNotifList();
  });

  refreshNotifBadge();
  setInterval(refreshNotifBadge, 10000);
}

document.addEventListener("DOMContentLoaded", initNotifBell);

/* =====================================================================
   Sidebar nav sections — collapsible per role group (Requester/Officer/
   Admin). This is a server-rendered multi-page app, not an SPA, so the
   collapsed/expanded state has to be remembered in localStorage to
   survive a full page navigation, not just kept in memory. Whichever
   section contains the current page's active link is always forced
   open (without touching the saved preference), so navigating never
   hides the item you're currently on.
   ===================================================================== */

function initNavSections() {
  document.querySelectorAll(".nav-section").forEach(function (section) {
    const key = "odprs.navCollapsed." + section.getAttribute("data-nav-section");
    const label = section.querySelector(".nav-section-label");
    const items = section.querySelector(".nav-section-items");
    const hasActive = !!section.querySelector(".nav-item.active");

    const collapsed = !hasActive && localStorage.getItem(key) === "1";
    section.classList.toggle("collapsed", collapsed);
    items.hidden = collapsed;

    label.addEventListener("click", function () {
      const nowCollapsed = !section.classList.contains("collapsed");
      section.classList.toggle("collapsed", nowCollapsed);
      items.hidden = nowCollapsed;
      localStorage.setItem(key, nowCollapsed ? "1" : "0");
    });
  });
}

document.addEventListener("DOMContentLoaded", initNavSections);

/* =====================================================================
   Copy-to-clipboard — any <button class="copy-btn" data-copy-target="elId">
   copies that element's textContent, with a brief checkmark as feedback.
   ===================================================================== */

function fallbackCopyToClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* no-op: nothing more we can do */ }
  document.body.removeChild(ta);
}

function copyToClipboard(text, btn) {
  if (!text) return;

  function showCopied() {
    if (!btn) return;
    const original = btn.getAttribute("data-icon");
    btn.setAttribute("data-icon", "check-circle");
    btn.classList.add("copied");
    applyIcons();
    setTimeout(function () {
      btn.setAttribute("data-icon", original);
      btn.classList.remove("copied");
      applyIcons();
    }, 1200);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopied).catch(function () {
      fallbackCopyToClipboard(text);
      showCopied();
    });
  } else {
    fallbackCopyToClipboard(text);
    showCopied();
  }
}

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;
  const targetId = btn.getAttribute("data-copy-target");
  const targetEl = targetId && document.getElementById(targetId);
  if (targetEl) copyToClipboard(targetEl.textContent.trim(), btn);
});

document.addEventListener("click", function (e) {
  const link = e.target.closest(".logout-link")
  if (!link) return;
  e.preventDefault();
  showConfirmModal({
    title: t("user.logoutModalTitle"),
    message: t("user.logoutModalMessage"),
    confirmText: t("user.logoutBtn"),
    danger: true,
    onConfirm: function () {
      window.location.href = link.href;
    }
  });
});

/* =====================================================================
   Confirm modal — a custom popup used instead of window.confirm(), so
   destructive/important actions (revoke, add) get an explicit second step.
   showConfirmModal({ title, message, confirmText, cancelText, danger, onConfirm, build })
   `build(container)` fills extra form controls under the message and returns
   a function that reads their values; that result is passed to onConfirm.
   ===================================================================== */

let modalConfirmHandler = null;

function ensureModal() {
  let overlay = document.getElementById("odprs-modal-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "odprs-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="modal-box" role="dialog" aria-modal="true">' +
    '<h3 class="modal-title"></h3>' +
    '<p class="modal-message"></p>' +
    '<div class="modal-extra" hidden></div>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn btn-secondary modal-cancel"></button>' +
    '<button type="button" class="btn btn-primary modal-confirm"></button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  return overlay;
}

function closeModal() {
  const overlay = document.getElementById("odprs-modal-overlay");
  if (overlay) overlay.hidden = true;
  modalConfirmHandler = null;
}

/* =====================================================================
   Processing overlay — a non-dismissible popup shown while an officer
   action (approve, mark ready, handover, ...) is in flight, so a slow
   server response reads as "still working" instead of "did nothing".
   showProcessing(message?) / hideProcessing()
   ===================================================================== */

function ensureProcessingOverlay() {
  let overlay = document.getElementById("odprs-processing-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "odprs-processing-overlay";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="processing-box" role="status" aria-live="polite">' +
    '<div class="processing-spinner"></div>' +
    '<span class="processing-message"></span>' +
    '</div>';
  document.body.appendChild(overlay);
  return overlay;
}

// Excel report download (officer history / dashboard / evaluations — see
// src/reports.js). Fetched as a blob rather than a plain link so the button
// can show that a big export is still being built, and so a server error
// shows on the button instead of downloading an error page as ".xlsx".
async function downloadReport(url, btn) {
  if (btn && btn.classList.contains("is-busy")) return;
  const label = btn ? btn.querySelector(".export-btn-label") : null;
  const setLabel = function (key) { if (label) { label.setAttribute("data-i18n", key); label.textContent = t(key); } };
  const sep = url.indexOf("?") === -1 ? "?" : "&";
  if (btn) btn.classList.add("is-busy");
  setLabel("export.preparing");
  try {
    const res = await fetch(url + sep + "lang=" + encodeURIComponent(getLang()));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd);
    const plain = /filename="([^"]+)"/i.exec(cd);
    const name = utf8 ? decodeURIComponent(utf8[1]) : (plain ? plain[1] : "report.xlsx");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    setLabel("export.excel");
  } catch (e) {
    setLabel("export.failed");
    setTimeout(function () { setLabel("export.excel"); }, 3000);
  } finally {
    if (btn) btn.classList.remove("is-busy");
  }
}

// ---- Responsive shell ----
// Below 1025px the sidebar is an off-canvas drawer (see the "Responsive"
// block at the end of style.css): the header's ☰ button opens it, and the
// backdrop, Escape, or following a link closes it.
function initNavDrawer() {
  const toggle = document.getElementById("nav-toggle");
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("nav-backdrop");
  if (!toggle || !sidebar || !backdrop) return;
  function setOpen(open) {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    backdrop.hidden = !open;
  }
  // Same ☰ button, two jobs: on tablet/phone it opens the drawer; on a
  // desktop-width screen it folds the sidebar into an icon-only rail (and
  // back), remembered across pages via localStorage.
  const drawerMode = window.matchMedia("(max-width: 1024px)");
  let animatingTimer = null;
  function setCollapsed(collapsed) {
    // Held for the .25s grid-column transition (see "sidebar-animating" in style.css).
    const root = document.documentElement;
    root.classList.add("sidebar-animating");
    clearTimeout(animatingTimer);
    animatingTimer = setTimeout(function () { root.classList.remove("sidebar-animating"); }, 300);
    root.classList.toggle("sidebar-collapsed", collapsed);
    try { localStorage.setItem("odprs.sidebarCollapsed", collapsed ? "1" : "0"); } catch (e) {}
    syncToggleTitle();
  }
  function syncToggleTitle() {
    const key = drawerMode.matches ? "nav.menu"
      : (document.documentElement.classList.contains("sidebar-collapsed") ? "nav.expand" : "nav.collapse");
    toggle.setAttribute("data-i18n-title", key);
    toggle.title = t(key);
    toggle.setAttribute("aria-expanded", drawerMode.matches
      ? String(document.body.classList.contains("nav-open"))
      : String(!document.documentElement.classList.contains("sidebar-collapsed")));
  }
  // In the rail only icons show, so each item carries its label as a
  // tooltip (refreshed on language switch).
  function syncItemTitles() {
    sidebar.querySelectorAll("a.nav-item").forEach(function (a) {
      const label = a.querySelector("span[data-i18n]");
      if (label) a.title = label.textContent.trim();
    });
  }
  toggle.addEventListener("click", function () {
    if (drawerMode.matches) setOpen(!document.body.classList.contains("nav-open"));
    else setCollapsed(!document.documentElement.classList.contains("sidebar-collapsed"));
  });
  drawerMode.addEventListener("change", syncToggleTitle);
  document.addEventListener("odprs:langchange", function () { syncToggleTitle(); syncItemTitles(); });
  syncToggleTitle();
  syncItemTitles();
  backdrop.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  sidebar.addEventListener("click", function (e) { if (e.target.closest("a.nav-item")) setOpen(false); });
  // Rotating a tablet to a width where the drawer isn't used must not
  // leave the page locked behind an invisible backdrop.
  window.matchMedia("(min-width: 1025px)").addEventListener("change", function (e) { if (e.matches) setOpen(false); });
}

// Every data table gets a horizontal-scroll wrapper, so on a narrow screen
// the table scrolls sideways inside its card instead of squeezing columns
// into unreadable slivers or pushing the whole page wider than the screen.
function wrapScrollTables(root) {
  (root || document).querySelectorAll("table.data-table").forEach(function (table) {
    if (table.parentElement && table.parentElement.classList.contains("table-scroll")) return;
    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initNavDrawer();
  wrapScrollTables();
});

function showProcessing(message) {
  const overlay = ensureProcessingOverlay();
  overlay.querySelector(".processing-message").textContent = message || t("processing.default");
  overlay.hidden = false;
}

function hideProcessing() {
  const overlay = document.getElementById("odprs-processing-overlay");
  if (overlay) overlay.hidden = true;
}

function showConfirmModal(options) {
  const overlay = ensureModal();
  overlay.querySelector(".modal-title").textContent = options.title || "";
  overlay.querySelector(".modal-message").textContent = options.message || "";

  const extra = overlay.querySelector(".modal-extra");
  extra.innerHTML = "";
  extra.hidden = !options.build;
  const getExtra = options.build ? options.build(extra) : null;

  const cancelBtn = overlay.querySelector(".modal-cancel");
  const confirmBtn = overlay.querySelector(".modal-confirm");
  cancelBtn.textContent = options.cancelText || t("modal.cancel");
  confirmBtn.textContent = options.confirmText || t("modal.confirm");
  // classList, not className — overwriting className here used to wipe out
  // the .modal-confirm class the code above relies on to find this button,
  // so every showConfirmModal() call after the first one threw (confirmBtn
  // came back null) and the confirm/cancel buttons went dead until a reload.
  confirmBtn.classList.remove("btn-primary", "btn-danger");
  confirmBtn.classList.add(options.danger ? "btn-danger" : "btn-primary");

  modalConfirmHandler = options.onConfirm || null;

  // Swap in fresh clones so listeners from previous calls don't stack up.
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newConfirmBtn.addEventListener("click", function () {
    const handler = modalConfirmHandler;
    const chosen = getExtra ? getExtra() : undefined;
    closeModal();
    if (handler) handler(chosen);
  });
  newCancelBtn.addEventListener("click", closeModal);

  overlay.hidden = false;
}

/* =====================================================================
   Result modal — a single-button (OK) popup reporting the outcome of an
   action already taken (e.g. "cancelled successfully" / "couldn't cancel"),
   as opposed to showConfirmModal which asks before taking one. Same
   overlay/box styling, plus a coloured success/danger icon badge.
   showResultModal({ title, message, success, okText, onClose })
   ===================================================================== */

function ensureResultModal() {
  let overlay = document.getElementById("odprs-result-modal-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "odprs-result-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="modal-box result-modal-box" role="alertdialog" aria-modal="true">' +
    '<div class="result-modal-icon"><span class="icon" data-icon="info"></span></div>' +
    '<h3 class="modal-title"></h3>' +
    '<p class="modal-message"></p>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn btn-primary result-modal-ok"></button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeResultModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeResultModal();
  });

  return overlay;
}

let resultModalCloseHandler = null;

function closeResultModal() {
  const overlay = document.getElementById("odprs-result-modal-overlay");
  if (overlay) overlay.hidden = true;
  const handler = resultModalCloseHandler;
  resultModalCloseHandler = null;
  if (handler) handler();
}

function showResultModal(options) {
  const overlay = ensureResultModal();
  const box = overlay.querySelector(".result-modal-box");

  overlay.querySelector(".modal-title").textContent = options.title || "";
  overlay.querySelector(".modal-message").textContent = options.message || "";

  box.classList.remove("result-modal-success", "result-modal-danger");
  box.classList.add(options.success ? "result-modal-success" : "result-modal-danger");
  overlay.querySelector(".result-modal-icon .icon").setAttribute("data-icon", options.success ? "check-circle" : "x-circle");
  applyIcons();

  const okBtn = overlay.querySelector(".result-modal-ok");
  okBtn.textContent = options.okText || t("modal.ok");

  // Swap in a fresh clone so listeners from previous calls don't stack up.
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  resultModalCloseHandler = options.onClose || null;
  newOkBtn.addEventListener("click", closeResultModal);

  overlay.hidden = false;
}

/* =====================================================================
   Action results — every page that does something (submit, save, approve,
   delete, ...) reports the outcome in the result popup above, so the user
   always knows what happened.
     showActionResult(success, message, { title, onClose })
       title defaults to "ทำรายการสำเร็จ" / "ทำรายการไม่สำเร็จ".
     ?result=<key> on any URL — for server-side form posts that redirect
       (new request, edit, evaluation): shows result.msg.<key> as a success
       popup once (or result.err.<key> as a failure popup), then drops the
       parameter so a reload doesn't repeat it.
     [data-result-error] on a server-rendered error notice — shows a failure
       popup pointing at it (the notice itself keeps the details).
   ===================================================================== */

function showActionResult(success, message, opts) {
  opts = opts || {};
  showResultModal({
    success: success,
    title: opts.title || t(success ? "result.success" : "result.failure"),
    message: message || t(success ? "result.success" : "result.generic"),
    onClose: opts.onClose
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // After the page's own DOMContentLoaded setup (i18n, rendering) has run.
  setTimeout(function () {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("result");
    const success = key && TRANSLATIONS["result.msg." + key];
    if (success || (key && TRANSLATIONS["result.err." + key])) {
      params.delete("result");
      const rest = params.toString();
      history.replaceState(null, "", window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
      showActionResult(!!success, t((success ? "result.msg." : "result.err.") + key));
      return;
    }
    const errorNotice = document.querySelector("[data-result-error]");
    if (errorNotice) {
      showActionResult(false, t("result.formError"), {
        onClose: function () { errorNotice.scrollIntoView({ behavior: "smooth", block: "center" }); }
      });
    }
  }, 0);
});

/* =====================================================================
   FOUC guard (see the html.i18n-loading rule in style.css + the class on
   <html> in partials/head.ejs). Every full-page navigation used to show a
   beat of the raw server-rendered markup — Thai text and icon-less spans —
   before this script got around to translating/injecting them. Registered
   last so it runs after every other DOMContentLoaded handler above
   (listeners for one event fire in registration order), i.e. once the
   page is actually done setting itself up.
   ===================================================================== */
document.addEventListener("DOMContentLoaded", function () {
  document.documentElement.classList.remove("i18n-loading");
});

/* =====================================================================
   Custom date picker — shared by requester/new-request.ejs (business days
   only) and officer/request-detail.ejs (any day). Markup comes from
   views/partials/date-picker.ejs; behaviour is configured per page:
     minDate      first selectable day (local midnight)
     isSelectable optional extra rule (e.g. weekdays only); default is
                  just `date >= minDate`
     onChange     called after the user picks a day
     placeholderKey  optional i18n key shown while no day is picked
   A native <input type="date"> can't grey out specific weekdays, which is
   why this exists at all: unselectable cells are rendered `disabled`.
   ===================================================================== */

const DATE_PICKER_WEEKDAYS = {
  th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
};

function createDatePicker(root, opts) {
  const toggle = root.querySelector(".date-picker-input");
  const label = root.querySelector(".date-picker-label");
  const panel = root.querySelector(".date-picker-panel");
  const title = root.querySelector(".date-picker-panel-title");
  const weekdaysEl = root.querySelector(".date-picker-weekdays");
  const gridEl = root.querySelector(".date-picker-grid");
  const prevBtn = root.querySelector('.date-picker-nav[data-dir="-1"]');
  const hiddenInput = root.querySelector('input[type="hidden"]');

  const minDate = new Date(opts.minDate);
  minDate.setHours(0, 0, 0, 0);
  const isSelectable = function (date) {
    return date >= minDate && (!opts.isSelectable || opts.isSelectable(date));
  };
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  let selectedDate = null;
  let viewYear = minDate.getFullYear();
  let viewMonth = minDate.getMonth();

  function renderToggleLabel() {
    if (!selectedDate) {
      label.textContent = t(opts.placeholderKey || "field.completionDate.placeholder");
      toggle.classList.add("placeholder");
      return;
    }
    toggle.classList.remove("placeholder");
    label.textContent = formatDate(selectedDate, getLang());
  }

  function renderGrid() {
    const lang = getLang();
    weekdaysEl.innerHTML = DATE_PICKER_WEEKDAYS[lang].map(function (w) { return `<span>${w}</span>`; }).join("");

    const monthLabel = lang === "en" ? ENG_MONTHS[viewMonth] : THAI_MONTHS[viewMonth];
    const yearLabel = lang === "en" ? viewYear : viewYear + 543;
    title.textContent = `${monthLabel} ${yearLabel}`;

    const leadingBlanks = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < leadingBlanks; i++) {
      cells.push('<span class="date-picker-day empty"></span>');
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(viewYear, viewMonth, day);
      const classes = ["date-picker-day"];
      if (selectedDate && cellDate.getTime() === selectedDate.getTime()) classes.push("selected");
      if (cellDate.getTime() === todayMidnight.getTime()) classes.push("today");
      cells.push(
        `<button type="button" class="${classes.join(" ")}" data-date="${toDateInputValue(cellDate)}" ${isSelectable(cellDate) ? "" : "disabled"}>${day}</button>`
      );
    }
    gridEl.innerHTML = cells.join("");

    const minMonthTime = new Date(minDate.getFullYear(), minDate.getMonth(), 1).getTime();
    prevBtn.disabled = new Date(viewYear, viewMonth, 1).getTime() <= minMonthTime;
  }

  // Keep the whole popup on screen without making the user scroll for it:
  // if it would run off the bottom of the viewport, open it upward when
  // there's room above the field (usually the case on a phone/tablet when
  // the field sits at the bottom of the page); otherwise stay downward and
  // scroll just enough to bring the popup fully into view.
  function position() {
    const panelRect = panel.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const gap = 6;
    const margin = 12;
    if (panelRect.bottom + margin <= window.innerHeight) return;
    if (toggleRect.top - gap - margin >= panelRect.height) {
      panel.classList.add("open-up");
    } else {
      window.scrollBy({ top: panelRect.bottom + margin - window.innerHeight, behavior: "smooth" });
    }
  }

  function handleOutsideClick(e) {
    if (!root.contains(e.target)) close();
  }

  function handleEscKey(e) {
    if (e.key === "Escape") close();
  }

  function open() {
    renderGrid();
    panel.classList.remove("open-up");
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    position();
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEscKey);
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", handleOutsideClick);
    document.removeEventListener("keydown", handleEscKey);
  }

  function setDate(date) {
    selectedDate = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null;
    hiddenInput.value = selectedDate ? toDateInputValue(selectedDate) : "";
    if (selectedDate && selectedDate >= new Date(minDate.getFullYear(), minDate.getMonth(), 1)) {
      viewYear = selectedDate.getFullYear();
      viewMonth = selectedDate.getMonth();
    }
    renderToggleLabel();
    if (!panel.hidden) renderGrid();
  }

  toggle.addEventListener("click", function () {
    if (panel.hidden) open(); else close();
  });

  root.querySelectorAll(".date-picker-nav").forEach(function (btn) {
    btn.addEventListener("click", function () {
      viewMonth += Number(btn.getAttribute("data-dir"));
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderGrid();
    });
  });

  gridEl.addEventListener("click", function (e) {
    const btn = e.target.closest(".date-picker-day");
    if (!btn || btn.disabled || btn.classList.contains("empty")) return;
    const [y, m, d] = btn.getAttribute("data-date").split("-").map(Number);
    setDate(new Date(y, m - 1, d));
    close();
    if (opts.onChange) opts.onChange(selectedDate);
  });

  document.addEventListener("odprs:langchange", function () {
    renderToggleLabel();
    if (!panel.hidden) renderGrid();
  });

  renderToggleLabel();

  return {
    toggle: toggle,
    getDate: function () { return selectedDate; },
    setDate: setDate
  };
}
