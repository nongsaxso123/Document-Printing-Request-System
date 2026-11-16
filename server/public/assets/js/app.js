/* ODPRS prototype — shared helper logic (business day math, formatting, fake IDs)
   No backend: state is passed between pages via sessionStorage. Weekends only —
   no holiday calendar in this mockup. */

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ENG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 15;

/** English label for each Thai unit-type key in UNIT_DATA (sub-unit strings already include an English name). */
const UNIT_TYPE_EN = {
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
const UNIT_DATA = {
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
    return tLang("newRequest.calc.responsibility.office", lang).replace("{n}", sheets.toLocaleString(numFmt));
  }

  const buffered = Math.ceil(sheets * (1 + PAPER_WASTE_BUFFER_RATIO));
  return tLang("newRequest.calc.responsibility.requester", lang)
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
  nodes = nodes.filter(Boolean);
  if (!nodes.length) { el.replaceChildren(); return; }
  // Laid out as a two-column grid (label | value) by .pf-lines CSS.
  const wrap = document.createElement("div");
  wrap.className = "pf-lines";
  wrap.append(...nodes);
  el.replaceChildren(wrap);
}

/** One line in the Officer/Receiver signoff cells: a small muted label
 * followed by the value, each on its own row (.pf-line/.pf-line-label CSS)
 * so a 4-5 line cell reads as a scannable list instead of a run-on
 * paragraph of same-weight text. */
function boldLine(th, en) {
  const div = document.createElement("div");
  div.className = "pf-line pf-line-head";
  const strong = document.createElement("strong");
  strong.append(...pfNodes(pickLang(th, en), bilingual(th, en)));
  div.appendChild(strong);
  return div;
}

/** labelKey is a TRANSLATIONS key; valuePrint defaults to value (free text). */
function detailLine(labelKey, value, valuePrint) {
  const div = document.createElement("div");
  div.className = "pf-line";
  const labelSpan = document.createElement("span");
  labelSpan.className = "pf-line-label";
  labelSpan.append(...pfNodes(t(labelKey), pfBilingualKey(labelKey)));
  const valueSpan = document.createElement("span");
  valueSpan.className = "pf-line-value";
  valueSpan.append(...pfNodes(value, valuePrint === undefined ? value : valuePrint));
  div.append(labelSpan, valueSpan);
  return div;
}

/* The Request Form has two faces (see print-form.ejs): the screen follows
 * the TH/EN toggle, print/PDF is "Thai (English)". pfNodes() returns the
 * text once when both faces agree, else a .pf-screen + .pf-print pair that
 * CSS switches between. */
function pfNodes(screenText, printText) {
  screenText = screenText == null ? "" : String(screenText);
  printText = printText == null ? "" : String(printText);
  if (screenText === printText) return [document.createTextNode(screenText)];
  const scr = document.createElement("span");
  scr.className = "pf-screen";
  scr.textContent = screenText;
  const prt = document.createElement("span");
  prt.className = "pf-print";
  prt.textContent = printText;
  return [scr, prt];
}

function pfSet(el, screenText, printText) {
  el.replaceChildren(...pfNodes(screenText, printText));
}

/** Thai/English value pair: one language on screen, "Thai (English)" on paper. */
function pfSetBi(el, th, en) {
  pfSet(el, pickLang(th, en), bilingual(th, en));
}

function pfBilingualKey(key) {
  const e = TRANSLATIONS[key];
  return e ? bilingual(e.th, e.en) : key;
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
 * ref and logos/wireframes/printing-request-form-redesign.html. On screen it
 * follows the TH/EN toggle; print/PDF stays bilingual (Thai primary, English
 * in parentheses). See the comment atop print-form.ejs.
 */
function renderPrintForm(record) {
  const lang = getLang();

  // Static labels: the hardcoded text in print-form.ejs is the print
  // wording (kept once in data-pf-print), the i18n key the screen wording.
  document.querySelectorAll(".print-doc [data-pf-label]").forEach(function (el) {
    if (el.dataset.pfPrint === undefined) el.dataset.pfPrint = el.textContent.trim();
    pfSet(el, t(el.dataset.pfLabel), el.dataset.pfPrint);
  });
  // Phone layout shows each item cell's label via CSS attr(data-label) (screen only).
  document.querySelectorAll(".print-doc [data-pf-cell]").forEach(function (el) {
    el.setAttribute("data-label", t(el.dataset.pfCell));
  });

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
  document.getElementById("pf-unit").textContent = record.unit;
  pfSetBi(document.getElementById("pf-unit-type"), record.unitType, record.unitTypeNameEn || UNIT_TYPE_EN[record.unitType]);

  pfSetBi(document.getElementById("pf-documenttype"), record.documentType, translateValueEn(record.documentType));
  pfSetBi(document.getElementById("pf-papersize"), record.paperSize, translateValueEn(record.paperSize));
  pfSetBi(document.getElementById("pf-colormode"), record.colorMode, translateValueEn(record.colorMode));
  pfSetBi(document.getElementById("pf-printside"), record.printSide, translateValueEn(record.printSide));
  const finishing = record.finishing || [];
  if (finishing.length) {
    pfSet(document.getElementById("pf-finishing"),
      finishing.map(v => pickLang(v, translateValueEn(v), lang)).join(", "),
      finishing.map(v => bilingual(v, translateValueEn(v))).join(", "));
  } else {
    pfSet(document.getElementById("pf-finishing"), t("pf.none"), pfBilingualKey("pf.none"));
  }
  const totalSheets = computeTotalSheets(record.originalPages, record.copies, record.printSide);
  // Screen: the full sentence (with the ~5% spare-paper tip). Print/PDF:
  // just who supplies how many sheets, so the cell stays one line.
  const shortKey = record.paperSource === PAPER_SOURCE_OFFICE_TH
    ? "newRequest.calc.responsibility.office" : "pf.paperRequesterShort";
  const sheetsFor = (lang) => totalSheets.toLocaleString(lang === "en" ? "en-US" : "th-TH");
  pfSet(document.getElementById("pf-paperresponsibility"),
    paperResponsibilityText(record.paperSource, totalSheets, lang),
    bilingual(tLang(shortKey, "th").replace("{n}", sheetsFor("th")), tLang(shortKey, "en").replace("{n}", sheetsFor("en"))));
  const copyLabel = copyLabelDisplayText(record);
  if (copyLabel) document.getElementById("pf-copylabel").textContent = copyLabel;
  else pfSet(document.getElementById("pf-copylabel"), t("pf.none"), pfBilingualKey("pf.none"));

  document.getElementById("pf-itemlist").textContent = record.itemList;
  document.getElementById("pf-pages").textContent = record.originalPages;
  document.getElementById("pf-copies").textContent = record.copies;
  document.getElementById("pf-totalpages").textContent = String(Number(record.originalPages) * Number(record.copies));
  document.getElementById("pf-totalsheets").textContent = String(totalSheets);

  // Dates: UI language on screen, Thai on paper (as before).
  const when = (d, withTime) => {
    const date = new Date(d);
    return withTime
      ? [formatDateTime(date, lang), formatDateTime(date, "th")]
      : [formatDate(date, lang), formatDate(date, "th")];
  };

  document.getElementById("pf-requester-name").textContent = record.requesterName;
  pfSet(document.getElementById("pf-submitted"), ...when(record.submissionDate, true));
  // Sign-off cells: every step lists who did it and when (a line is left
  // out when its value was never recorded, e.g. requests from before the
  // step times were stored).
  const bold = (key) => boldLine(TRANSLATIONS[key].th, TRANSLATIONS[key].en);
  const at = (key, iso) => iso ? detailLine(key, ...when(iso, true)) : null;
  // A step that did happen always gets its time line, even when the time
  // itself was never stored.
  const atStep = (key, iso) => iso ? at(key, iso) : detailLine(key, t("pf.notRecorded"), pfBilingualKey("pf.notRecorded"));
  const by = (key, name) => name ? detailLine(key, name) : null;
  const officerEl = document.getElementById("pf-signoff-officer");
  const receiverEl = document.getElementById("pf-signoff-receiver");
  const status = record.statusCode;

  if (status === "awaiting") {
    setCellNodes(officerEl, []);
  } else if (status === "rejected") {
    setCellNodes(officerEl, [
      bold("pf.rejected"),
      by("pf.reason", record.rejectionReason),
      by("pf.rejectedBy", record.reviewedByOfficer),
      atStep("pf.rejectedAt", record.rejectedAt)
    ]);
  } else if (status === "cancelled") {
    setCellNodes(officerEl, [
      bold("pf.cancelled"),
      atStep("pf.cancelledAt", record.cancelledAt)
    ]);
  } else {
    const appt = record.completionDateConfirmed ? when(record.completionDateConfirmed + "T00:00:00", false) : null;
    setCellNodes(officerEl, [
      bold("pf.approved"),
      by("pf.approvedBy", record.reviewedByOfficer),
      atStep("pf.originalReceivedAt", record.originalDocReceivedTimestamp),
      appt ? detailLine("pf.appointment", appt[0], appt[1]) : null,
      status === "ready" || status === "completed" ? atStep("pf.readyAt", record.readyAt) : null,
      by("pf.readyBy", record.markedReadyByOfficer),
      at("pf.pickupFrom", record.pickupAvailableFrom)
    ]);
  }

  if (record.receiverName) {
    setCellNodes(receiverEl, [
      boldLine(record.receiverName),
      by("pf.position", record.receiverPosition),
      by("pf.workplace", record.receiverWorkplace),
      by("pf.workPhone", record.receiverWorkPhone),
      atStep("pf.receivedAt", record.completedTimestamp),
      by("pf.handedOverBy", record.handedOverByOfficer)
    ]);
  } else if (status === "rejected" || status === "cancelled") {
    // Nothing will be collected.
    setCellNodes(receiverEl, []);
  } else {
    const em = document.createElement("em");
    em.append(...pfNodes(t("pf.awaitingPickup"), pfBilingualKey("pf.awaitingPickup")));
    setCellNodes(receiverEl, [em]);
  }

  const claim = record.claimCode ? `Claim Code: ${record.claimCode}   ` : "";
  pfSet(document.getElementById("pf-footnote"), claim + t("pf.generated"), claim + pfBilingualKey("pf.generated"));
}

/* =====================================================================
   i18n — lightweight TH/EN toggle shared by every page.
   Elements opt in with data-i18n="key" (textContent) or
   data-i18n-placeholder="key" (placeholder attribute). Preference is
   stored in localStorage so it carries across page navigation. Pages
   with dynamically computed text (dates, unit dropdown, etc.) should
   listen for the "odprs:langchange" event and re-render themselves.
   ===================================================================== */

const TRANSLATIONS = {
  "brand.tagline": { th: "ระบบขอพิมพ์เอกสารออนไลน์", en: "Online Document Printing" },
  "brand.sub": { th: "ฝ่ายทะเบียน มฟล.", en: "Registrar Division, MFU" },

  // Request Form on screen (print/PDF keeps the bilingual text in print-form.ejs)
  "pf.org": { th: "ฝ่ายทะเบียน มหาวิทยาลัยแม่ฟ้าหลวง", en: "Registrar Division, Mae Fah Luang University" },
  "pf.title": { th: "ใบคำขอพิมพ์เอกสาร", en: "Document Printing Request Form" },
  "pf.salutation": { th: "เรียน หัวหน้าฝ่ายทะเบียน", en: "To Head of the Registrar Division" },
  "pf.sec.requester": { th: "ข้อมูลผู้ขอ", en: "Requester Information" },
  "pf.sec.print": { th: "ข้อมูลการพิมพ์", en: "Print Specification" },
  "pf.sec.items": { th: "รายการที่ขอผลิต", en: "Items Requested" },
  "pf.name": { th: "ชื่อผู้ขอ", en: "Name" },
  "pf.tel": { th: "เบอร์โทรศัพท์", en: "Tel." },
  "pf.unit": { th: "หน่วยงาน", en: "Unit" },
  "pf.unitType": { th: "ประเภทหน่วยงาน", en: "Unit Type" },
  "pf.documentType": { th: "ประเภทเอกสาร", en: "Document Type" },
  "pf.paperSize": { th: "ขนาดกระดาษ", en: "Paper Size" },
  "pf.colorMode": { th: "โหมดสี", en: "Color Mode" },
  "pf.printSide": { th: "รูปแบบการพิมพ์", en: "Print Side" },
  "pf.finishing": { th: "งานตกแต่ง / การเข้าเล่ม", en: "Finishing / Binding" },
  "pf.paperSource": { th: "การจัดเตรียมกระดาษ", en: "Paper Source" },
  "pf.copyLabel": { th: "เลขรันประจำชุด", en: "Copy Label" },
  "pf.ref": { th: "เลขอ้างอิง / RUN NUMBER", en: "Reference / RUN NUMBER" },
  "pf.items": { th: "รายการเอกสาร", en: "Items" },
  "pf.pages": { th: "หน้าต้นฉบับ", en: "Orig. Pages" },
  "pf.copies": { th: "จำนวนชุด", en: "Copies" },
  "pf.totalPages": { th: "รวมหน้าพิมพ์", en: "Total Pages" },
  "pf.totalSheets": { th: "รวมแผ่นกระดาษ", en: "Total Sheets" },
  "pf.requester": { th: "ผู้ขอ", en: "Requester" },
  "pf.submitted": { th: "ส่งเมื่อ", en: "Submitted" },
  "pf.officer": { th: "เจ้าหน้าที่", en: "Officer" },
  "pf.receiver": { th: "ผู้รับเอกสาร", en: "Receiver" },
  "pf.none": { th: "ไม่มี", en: "None" },
  "pf.rejected": { th: "ถูกปฏิเสธ", en: "Rejected" },
  "pf.reason": { th: "เหตุผล", en: "Reason" },
  "pf.rejectedBy": { th: "ปฏิเสธโดย", en: "Rejected By" },
  "pf.cancelled": { th: "ยกเลิกโดยผู้ขอ", en: "Cancelled by Requester" },
  "pf.approved": { th: "อนุมัติแล้ว", en: "Approved" },
  "pf.appointment": { th: "วันนัดรับเอกสาร", en: "Appointment Date" },
  "pf.approvedBy": { th: "อนุมัติโดย", en: "Approved By" },
  "pf.position": { th: "ตำแหน่ง", en: "Position" },
  "pf.workplace": { th: "ที่ทำงาน", en: "Workplace" },
  "pf.workPhone": { th: "เบอร์โทรศัพท์ที่ทำงาน", en: "Work Phone" },
  "pf.receivedAt": { th: "มารับเอกสารเมื่อ", en: "Picked Up At" },
  "pf.paperRequesterShort": { th: "ผู้ขอต้องเตรียมกระดาษมาเอง {n} แผ่น", en: "Requester must bring {n} sheets" },
  "pf.notRecorded": { th: "ไม่ได้บันทึกเวลา", en: "Not recorded" },
  "pf.handedOverBy": { th: "ส่งมอบโดย", en: "Handed Over By" },
  "pf.rejectedAt": { th: "ปฏิเสธเมื่อ", en: "Rejected At" },
  "pf.cancelledAt": { th: "ยกเลิกเมื่อ", en: "Cancelled At" },
  "pf.originalReceivedAt": { th: "รับต้นฉบับเมื่อ", en: "Original Received At" },
  "pf.readyAt": { th: "พิมพ์เสร็จเมื่อ", en: "Printed At" },
  "pf.readyBy": { th: "พิมพ์เสร็จโดย", en: "Printed By" },
  "pf.pickupFrom": { th: "รับได้ตั้งแต่", en: "Pickup From" },
  "pf.awaitingPickup": { th: "รอรับเอกสาร", en: "Awaiting Pickup" },
  "pf.generated": { th: "เอกสารนี้สร้างโดยระบบ ODPRS", en: "This document was generated by the ODPRS system" },


  "login.title": { th: "ระบบขอพิมพ์เอกสารออนไลน์", en: "Online Document Printing Request System" },
  "login.subtitle": { th: "ฝ่ายทะเบียน มหาวิทยาลัยแม่ฟ้าหลวง", en: "Registrar Division, Mae Fah Luang University" },
  "login.hint": { th: "เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย (@mfu.ac.th)", en: "Sign in with your university Google account (@mfu.ac.th)" },
  "login.btn": { th: "เข้าสู่ระบบด้วย Google", en: "Log in with Google" },
  "login.deniedNotice": { th: "กรุณาเข้าสู่ระบบด้วยอีเมล {domain}", en: "Please sign in with an {domain} email." },
  "login.staffOnly": { th: "สำหรับเจ้าหน้าที่เท่านั้น", en: "Officers only" },
  "login.kioskBtn": { th: "เปิดหน้าจอจุดรับเอกสาร", en: "Open Pickup Station" },
  "login.manual": { th: "คู่มือการใช้งาน", en: "User manual" },
  "login.contactBtn": { th: "ติดต่อเรา", en: "Contact us" },
  "login.contactTitle": { th: "ติดต่อฝ่ายทะเบียน", en: "Contact the Registrar Division" },
  "login.contactPhone": { th: "โทรศัพท์", en: "Phone" },
  "login.contactEmail": { th: "อีเมล", en: "Email" },
  "settings.contact.title": { th: "ข้อมูลติดต่อฝ่ายทะเบียน", en: "Registrar Division Contact" },
  "settings.contact.hint": { th: "แสดงใต้กล่องเข้าสู่ระบบ เว้นว่างทั้งสองช่องถ้าไม่ต้องการแสดง", en: "Shown under the login box. Leave both blank to hide it." },
  "settings.contact.phone": { th: "เบอร์โทรศัพท์", en: "Phone" },
  "settings.contact.email": { th: "อีเมล", en: "Email" },
  "settings.contact.emailError": { th: "รูปแบบอีเมลไม่ถูกต้อง", en: "Invalid email address" },
  "auditLog.field.contactPhone": { th: "เบอร์ติดต่อ (หน้าเข้าสู่ระบบ)", en: "Contact phone (login page)" },
  "auditLog.field.contactEmail": { th: "อีเมลติดต่อ (หน้าเข้าสู่ระบบ)", en: "Contact email (login page)" },
  "manuals.title": { th: "คู่มือการใช้งาน", en: "User Manuals" },
  "manuals.subtitle": { th: "อัปโหลดคู่มือการใช้งาน (ไฟล์ PDF) แยกตามผู้ใช้แต่ละกลุ่ม ผู้ใช้เปิดอ่านได้ตามภาษาที่เลือก", en: "Upload user manuals (PDF) for each group of users. People open the one in their chosen language." },
  "manuals.requester": { th: "คู่มือสำหรับผู้ขอ", en: "Requester manual" },
  "manuals.officer": { th: "คู่มือสำหรับเจ้าหน้าที่", en: "Officer manual" },
  "manuals.admin": { th: "คู่มือสำหรับผู้ดูแลระบบ", en: "Admin manual" },
  "manuals.th.manual": { th: "คู่มือ", en: "Manual" },
  "manuals.lang.th": { th: "ภาษาไทย", en: "Thai" },
  "manuals.lang.en": { th: "ภาษาอังกฤษ", en: "English" },
  "manuals.empty": { th: "ยังไม่ได้อัปโหลด", en: "Not uploaded yet" },
  "manuals.emptyHint": { th: "ถ้ามีเพียงภาษาเดียว ผู้ใช้ทั้งสองภาษาจะเห็นไฟล์นั้น", en: "If only one language is uploaded, users of both languages see that file." },
  "manuals.uploadedBy": { th: "อัปโหลดโดย {email} เมื่อ {date}", en: "Uploaded by {email} on {date}" },
  "manuals.viewBtn": { th: "เปิดดู", en: "View" },
  "manuals.uploadBtn": { th: "อัปโหลดไฟล์", en: "Upload file" },
  "manuals.replaceBtn": { th: "อัปโหลดไฟล์ใหม่แทน", en: "Replace file" },
  "manuals.deleteBtn": { th: "ลบ", en: "Delete" },
  "manuals.uploading": { th: "กำลังอัปโหลด…", en: "Uploading…" },
  "manuals.rule": { th: "รับเฉพาะไฟล์ PDF ขนาดไม่เกิน {mb} MB อัปโหลดใหม่จะแทนที่ไฟล์เดิมทันที", en: "PDF only, up to {mb} MB. A new upload replaces the current file immediately." },
  "manuals.result.uploaded": { th: "อัปโหลด{lang} เรียบร้อยแล้ว", en: "{lang} uploaded." },
  "manuals.result.deleted": { th: "ลบ{lang} เรียบร้อยแล้ว", en: "{lang} deleted." },
  "manuals.error.notPdf": { th: "ไฟล์นี้ไม่ใช่ PDF กรุณาเลือกไฟล์ .pdf", en: "This is not a PDF file. Please choose a .pdf file." },
  "manuals.error.tooLarge": { th: "ไฟล์ใหญ่เกิน {mb} MB", en: "The file is larger than {mb} MB." },
  "manuals.deleteTitle": { th: "ยืนยันการลบคู่มือ", en: "Delete this manual?" },
  "manuals.deleteMessage": { th: "ลบ{lang} “{name}” ผู้ใช้จะเปิดไฟล์นี้ไม่ได้อีก", en: "Delete {lang} “{name}”? People will no longer be able to open it." },
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
  "nav.adminUnits": { th: "หน่วยงาน", en: "Units" },
  "nav.adminEvaluationForm": { th: "แบบประเมิน", en: "Evaluation form" },
  "evalForm.title": { th: "แบบประเมินความพึงพอใจ", en: "Satisfaction Evaluation Form" },
  "evalForm.preview": { th: "ดูตัวอย่างหน้าประเมิน", en: "Preview the form" },
  "evalForm.subtitle": { th: "กำหนดหัวข้อและคำถามที่ผู้ขอต้องตอบหลังรับเอกสาร และระยะเวลาที่ยังประเมินได้", en: "Set the sections and questions requesters answer after pickup, and how long they can still evaluate." },
  "evalForm.windowTitle": { th: "ระยะเวลาที่ให้ประเมิน", en: "Time to evaluate" },
  "evalForm.windowLead": { th: "ผู้ขอประเมินได้ภายใน", en: "Requesters can evaluate within" },
  "evalForm.windowTail": { th: "หลังรับเอกสาร", en: "after pickup" },
  "evalForm.windowUnlimited": { th: "ไม่จำกัดเวลา", en: "No time limit" },
  "evalForm.windowLimited": { th: "กำหนดระยะเวลา", en: "Set a time limit" },
  "evalForm.windowExample": { th: "ตัวอย่าง: รับเอกสาร {from} → ประเมินได้ถึง {to}", en: "Example: picked up {from} → can evaluate until {to}" },
  "evalForm.windowExampleNone": { th: "ผู้ขอประเมินคำขอที่รับเอกสารแล้วได้ตลอด ไม่มีวันหมดอายุ", en: "Requesters can always evaluate a picked-up request. It never expires." },
  "evalForm.windowHint": { th: "เลยกำหนดแล้ว ระบบจะไม่ขอให้ประเมินคำขอนั้นอีก และไม่บังคับประเมินก่อนส่งคำขอใหม่", en: "After that the request is no longer asked to be evaluated, and doesn't block a new request." },
  "evalForm.unit.minute": { th: "นาที", en: "minutes" },
  "evalForm.unit.hour": { th: "ชั่วโมง", en: "hours" },
  "evalForm.unit.day": { th: "วัน", en: "days" },
  "evalForm.unit.week": { th: "สัปดาห์", en: "weeks" },
  "evalForm.unit.month": { th: "เดือน", en: "months" },
  "evalForm.save": { th: "บันทึก", en: "Save" },
  "evalForm.discard": { th: "ยกเลิกการเปลี่ยนแปลง", en: "Discard changes" },
  "evalForm.unsaved": { th: "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก", en: "You have unsaved changes" },
  "evalForm.leaveTitle": { th: "ยังไม่ได้บันทึกระยะเวลาที่ให้ประเมิน", en: "Evaluation period not saved" },
  "unsaved.leaveTitle": { th: "ยังไม่ได้บันทึกการเปลี่ยนแปลง", en: "Changes not saved" },
  "unsaved.leaveMessage": { th: "ถ้าออกจากหน้านี้ การเปลี่ยนแปลงจะหายไป", en: "If you leave this page, your changes will be lost." },
  "unsaved.leaveConfirm": { th: "ออกโดยไม่บันทึก", en: "Leave without saving" },
  "unsaved.leaveStay": { th: "อยู่หน้านี้ต่อ", en: "Stay on this page" },
  "settings.leaveTitle": { th: "ยังไม่ได้บันทึกการตั้งค่า", en: "Settings not saved" },
  "evalForm.edit": { th: "แก้ไข", en: "Edit" },
  "evalForm.delete": { th: "ลบ", en: "Delete" },
  "evalForm.moveUp": { th: "เลื่อนขึ้น", en: "Move up" },
  "evalForm.moveDown": { th: "เลื่อนลง", en: "Move down" },
  "evalForm.addSection": { th: "เพิ่มหัวข้อ", en: "Add section" },
  "evalForm.addQuestion": { th: "เพิ่มคำถาม", en: "Add question" },
  "evalForm.noSections": { th: "ยังไม่มีหัวข้อ ระบบจะไม่ขอให้ผู้ขอประเมินจนกว่าจะมีคำถามอย่างน้อย 1 ข้อ", en: "No sections yet. Requesters won't be asked to evaluate until there is at least one question." },
  "evalForm.noQuestions": { th: "ยังไม่มีคำถามในหัวข้อนี้", en: "No questions in this section yet." },
  "evalForm.questionCount": { th: "{n} คำถาม", en: "{n} questions" },
  "evalForm.optional": { th: "(ไม่บังคับ)", en: "(optional)" },
  "evalForm.type.rating": { th: "คะแนน 1-5", en: "Rating 1-5" },
  "evalForm.type.single": { th: "เลือก 1 คำตอบ", en: "Pick one" },
  "evalForm.type.multi": { th: "เลือกได้หลายคำตอบ", en: "Pick any" },
  "evalForm.type.text": { th: "ข้อความ", en: "Text" },
  "evalForm.newSection": { th: "หัวข้อใหม่", en: "New section" },
  "evalForm.editSection": { th: "แก้ไขหัวข้อ", en: "Edit section" },
  "evalForm.sectionTh": { th: "ชื่อหัวข้อ (ไทย)", en: "Section title (Thai)" },
  "evalForm.sectionEn": { th: "ชื่อหัวข้อ (อังกฤษ)", en: "Section title (English)" },
  "evalForm.sectionThPh": { th: "เช่น ความพึงพอใจต่อระบบ", en: "e.g. ความพึงพอใจต่อระบบ" },
  "evalForm.sectionEnPh": { th: "e.g. System satisfaction", en: "e.g. System satisfaction" },
  "evalForm.newQuestion": { th: "คำถามใหม่", en: "New question" },
  "evalForm.editQuestion": { th: "แก้ไขคำถาม", en: "Edit question" },
  "evalForm.qType": { th: "รูปแบบคำตอบ", en: "Answer type" },
  "evalForm.qTh": { th: "คำถาม (ไทย)", en: "Question (Thai)" },
  "evalForm.qEn": { th: "คำถาม (อังกฤษ)", en: "Question (English)" },
  "evalForm.qThPh": { th: "เช่น ความง่ายในการใช้งาน", en: "e.g. ความง่ายในการใช้งาน" },
  "evalForm.qEnPh": { th: "e.g. Ease of use", en: "e.g. Ease of use" },
  "evalForm.options": { th: "ตัวเลือก (อย่างน้อย 2 ข้อ)", en: "Choices (at least 2)" },
  "evalForm.optionThPh": { th: "ตัวเลือก (ไทย)", en: "Choice (Thai)" },
  "evalForm.optionEnPh": { th: "ตัวเลือก (อังกฤษ)", en: "Choice (English)" },
  "evalForm.addOption": { th: "เพิ่มตัวเลือก", en: "Add choice" },
  "evalForm.removeOption": { th: "ลบ", en: "Remove" },
  "evalForm.required": { th: "บังคับตอบ", en: "Required" },
  "evalForm.guideTitle": { th: "รายงานผลประเมินแยกเป็นรายปี", en: "The evaluation report is yearly" },
  "evalForm.guideBody": { th: "แต่ละปีแสดงเฉพาะคำถามที่มีคนตอบในปีนั้น ถ้าเพิ่มหรือลบคำถามกลางปี รายงานจะบอกว่ามีคนตอบข้อนั้นกี่คนจากทั้งหมด และเริ่มใช้หรือใช้ถึงวันไหน", en: "Each year shows only the questions answered that year. If you add or remove a question mid-year, the report shows how many people answered it out of all, and when it started or stopped." },
  "evalForm.answerRule": { th: "การตอบ", en: "Answering" },
  "evalForm.inSection": { th: "อยู่ในหัวข้อ", en: "In section" },
  "evalForm.deleteSectionTitle": { th: "ลบหัวข้อนี้?", en: "Delete this section?" },
  "evalForm.deleteSectionMsg": { th: "ลบ “{name}” พร้อมคำถาม {n} ข้อในหัวข้อนี้ คำตอบที่เคยได้รับยังเก็บไว้ในรายงาน", en: "Delete “{name}” and its {n} questions? Answers already received stay in the report." },
  "evalForm.deleteQuestionTitle": { th: "ลบคำถามนี้?", en: "Delete this question?" },
  "evalForm.deleteQuestionMsg": { th: "ลบ “{name}” คำตอบที่เคยได้รับยังเก็บไว้ในรายงาน", en: "Delete “{name}”? Answers already received stay in the report." },
  "evalForm.saved.window": { th: "บันทึกระยะเวลาที่ให้ประเมินแล้ว", en: "Evaluation time limit saved." },
  "evalForm.err.generic": { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", en: "Couldn't save. Please try again." },
  "evalForm.err.fillThis": { th: "กรุณากรอกช่องนี้", en: "Please fill this in" },
  "evalForm.err.windowValue": { th: "กรุณาใส่ตัวเลขตั้งแต่ 1 ขึ้นไป", en: "Enter a number of 1 or more" },
  "evalForm.err.optionsFew": { th: "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ", en: "Add at least 2 choices" },
  "evalForm.err.optionHalf": { th: "กรอกตัวเลือกให้ครบทั้งภาษาไทยและอังกฤษ", en: "Fill in each choice in both Thai and English" },
  "nav.adminAuditLog": { th: "ประวัติการแก้ไข", en: "Change History" },
  "nav.adminManuals": { th: "คู่มือการใช้งาน", en: "User Manuals" },
  "nav.manuals": { th: "คู่มือการใช้งาน", en: "User manuals" },
  "nav.manual.requester": { th: "คู่มือผู้ขอ", en: "Requester manual" },
  "nav.manual.officer": { th: "คู่มือเจ้าหน้าที่", en: "Officer manual" },
  "nav.manual.admin": { th: "คู่มือผู้ดูแลระบบ", en: "Admin manual" },
  "manualFab.title": { th: "คู่มือการใช้งาน (ลากเพื่อย้ายได้)", en: "User manuals (drag to move)" },
  "manualFab.hide": { th: "ซ่อนปุ่มนี้ (ย้ายไปไว้ที่เมนูข้าง)", en: "Hide this button (move it to the sidebar)" },
  "manualFab.show": { th: "แสดงปุ่มลอยอีกครั้ง", en: "Show the floating button again" },
  "nav.group.system": { th: "บัญชีและระบบ", en: "Accounts & System" },
  "nav.group.reference": { th: "ข้อมูลพื้นฐาน", en: "Reference Data" },
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
  "evaluate.deadline": { th: "ประเมินได้ถึง", en: "Evaluate by" },
  "evaluate.error.missing": { th: "กรุณาตอบคำถามให้ครบ", en: "Please answer every required question" },
  "evaluate.error.missing.body": { th: "คำถามที่ยังไม่ได้ตอบหรือคำตอบไม่ถูกต้องมีกรอบสีแดงด้านล่าง", en: "Unanswered or invalid questions are outlined in red below." },
  "evaluate.error.required": { th: "กรุณาตอบคำถามนี้", en: "Please answer this question" },
  "evaluate.error.invalid": { th: "คำตอบไม่ถูกต้อง", en: "This answer isn't valid" },
  "evaluate.optional": { th: "(ไม่บังคับ)", en: "(optional)" },
  "evaluate.multiHint": { th: "เลือกได้มากกว่า 1 ข้อ", en: "You can choose more than one" },
  "evaluate.textPlaceholder": { th: "พิมพ์คำตอบของคุณ", en: "Type your answer" },
  "evaluate.preview.title": { th: "ตัวอย่างหน้าที่ผู้ขอจะเห็น", en: "Preview of what requesters see" },
  "evaluate.preview.body": { th: "ทดลองตอบและกดส่งได้ ระบบจะตรวจคำตอบเหมือนของจริงแต่ไม่บันทึก ข้อมูลคำขอด้านล่างเป็นตัวอย่าง", en: "Try answering and submitting. Answers are checked like the real page but nothing is saved. The request details are a sample." },
  "evaluate.preview.back": { th: "กลับไปแก้ไขแบบประเมิน", en: "Back to the form editor" },
  "evaluate.preview.empty": { th: "ยังไม่มีคำถามในแบบประเมิน ผู้ขอจะไม่ถูกขอให้ประเมิน", en: "The form has no questions yet, so requesters won't be asked to evaluate." },
  "evaluate.preview.ok": { th: "ตอบครบถ้วนแล้ว (นี่คือตัวอย่าง ระบบไม่ได้บันทึกคำตอบ)", en: "All required questions answered (this is a preview, nothing was saved)." },

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
  "field.requesterName.hint": { th: 'ดึงจากโปรไฟล์ของคุณให้อัตโนมัติ (หรือบัญชีที่ล็อกอิน หากยังไม่ได้ตั้งค่าโปรไฟล์) แก้ไขได้ทุกครั้ง ตั้งค่าถาวรได้ที่ <a href="/profile">โปรไฟล์ของฉัน</a>', en: 'Auto-filled from your Profile (or your login account, if you haven\'t set one up yet). You can still edit it each time. Set it permanently at <a href="/profile">My Profile</a>.' },
  "field.tel": { th: "เบอร์โทรศัพท์ *", en: "Phone Number *" },
  "field.tel.placeholder": { th: "08X-XXX-XXXX", en: "08X-XXX-XXXX" },
  "field.tel.hint": { th: "ใช้เบอร์มือถือส่วนตัวหรือเบอร์สำนักงานก็ได้ ดึงจากโปรไฟล์ของคุณให้อัตโนมัติถ้าตั้งค่าไว้", en: "A personal mobile number or an office/workplace number. Auto-filled from your Profile if you've set one." },
  "field.unitType": { th: "ประเภทหน่วยงาน *", en: "Unit Type *" },
  "field.unit": { th: "หน่วยงาน *", en: "Unit *" },
  "field.unit.placeholder": { th: "พิมพ์ชื่อหน่วยงาน", en: "Type the unit name" },
  "field.dropoffLocation": { th: "สถานที่ส่งเอกสารต้นฉบับ *", en: "Original Document Drop-off Location *" },
  "location.hours": { th: "เวลาทำการ:", en: "Hours:" },
  "location.phone": { th: "โทร:", en: "Phone:" },
  "location.map": { th: "ดูแผนที่", en: "View map" },
  "field.paperSize": { th: "ขนาดกระดาษ *", en: "Paper Size *" },
  "field.paperSize.other.placeholder": { th: "ระบุขนาดกระดาษ เช่น B5, Letter, F4", en: "Specify paper size, e.g. B5, Letter, F4" },
  "field.finishingMethod": { th: "งานตกแต่ง / การเข้าเล่ม", en: "Finishing / Binding" },
  "field.itemList": { th: "รายการเอกสารที่ต้องการพิมพ์ *", en: "Items to be Printed *" },
  "newRequest.error.itemListTooLong": { th: "รายการเอกสารยาวเกินไป", en: "Item list is too long" },
  "newRequest.error.itemListTooLong.body": { th: "พิมพ์ได้ไม่เกิน 120 ตัวอักษร เพื่อให้ใบคำขออยู่ในกระดาษหน้าเดียว", en: "Use up to 120 characters so the request form fits on one page." },
  "field.itemList.placeholder": { th: "เช่น เอกสารประมวลรายวิชา บทที่ 1-5, ใบปะหน้า", en: "e.g. Course syllabus chapters 1-5, cover sheet" },
  "field.originalPages": { th: "จำนวนหน้าต้นฉบับ *", en: "Original Page Count *" },
  "field.copies": { th: "จำนวนชุดที่ต้องการ *", en: "Number of Copies *" },
  "field.copies.maxError": { th: "จำนวนชุดต้องไม่เกิน 999 ชุด", en: "Number of copies cannot exceed 999." },
  "field.completionDate": { th: "วันที่ต้องการรับเอกสาร *", en: "Requested Completion Date *" },
  "field.completionDate.placeholder": { th: "เลือกวันที่", en: "Select a date" },
  "field.completionDate.error": { th: "กรุณาเลือกวันที่ห่างจากวันนี้อย่างน้อย 3 วันทำการ", en: "Please choose a date at least 3 business days from today." },
  "field.completionDate.weekendError": { th: "วันที่เลือกตรงกับวันเสาร์หรืออาทิตย์ กรุณาเลือกวันทำการ (จันทร์ถึงศุกร์)", en: "The selected date falls on a Saturday or Sunday. Please choose a business day (Monday to Friday)." },

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
  "field.finishingMethod.saddleStitchForcesDouble": { th: "เย็บมุงหลังคาต้องพิมพ์สองหน้า ระบบเปลี่ยนรูปแบบการพิมพ์ให้อัตโนมัติ", en: "Saddle-stitch requires double-sided printing. Print Side was switched automatically." },
  "field.finishingMethod.pageCount.saddleStitch": { th: "เย็บมุงหลังคา: จำนวนหน้าต้นฉบับต้องหารด้วย 4 ลงตัว และไม่เกิน 60 หน้า", en: "Saddle-stitch: original page count must be a multiple of 4, up to 60 pages." },
  "field.finishingMethod.pageCount.glue": { th: "เข้าเล่มสันกาว: จำนวนหน้าต้นฉบับต้องมีอย่างน้อย 20 หน้า เพื่อให้มีสันพอให้กาวยึด", en: "Glue binding: needs at least 20 original pages for the spine to hold." },
  "field.finishingMethod.pageCount.corner": { th: "เย็บมุม: จำนวนหน้าต้นฉบับต้องไม่เกิน 80 หน้า มิฉะนั้นลวดเย็บจะกดไม่ทะลุ", en: "Corner staple: original page count must not exceed 80 pages, or a standard stapler can't punch through." },

  "field.colorMode": { th: "โหมดสี *", en: "Color Mode *" },
  "field.printSide": { th: "รูปแบบการพิมพ์ (หน้า) *", en: "Print Side *" },
  "field.documentType": { th: "ประเภทเอกสาร *", en: "Document Type *" },
  "field.documentType.hint": { th: "เลือกได้ประเภทเดียวต่อคำขอ ถ้ามีทั้งสองประเภทให้แยกส่ง", en: "One type per request. Submit separately if you have both." },
  "field.paperSource": { th: "ผู้จัดเตรียมกระดาษ *", en: "Paper Source *" },
  "field.paperSource.fixedNotice": { th: "เอกสารทั่วไป: ผู้ขอเป็นผู้จัดเตรียมกระดาษเอง (Requester-provided) ไม่มีตัวเลือกอื่น", en: "General Document: paper is always Requester-provided, no other choice." },
  "field.copyLabel.toggle": { th: "ต้องการเลขรันประจำชุด (Copy Label) หรือไม่", en: "Add a running number to each copy (Copy Label)" },
  "field.copyLabel.toggle.hint": { th: "เลขนี้จะพิมพ์ไว้ที่มุมขวาบนของหน้าแรกในแต่ละชุด เพื่อการติดตามของผู้ขอเอง ไม่เกี่ยวข้องกับเลขอ้างอิงคำขอหรือ RUN NUMBER", en: "Printed in the top-right corner of each copy's first page, for the Requester's own tracking. Independent of the Request Reference No. and RUN NUMBER." },
  "field.copyLabel.mode.auto": { th: "รันเลขอัตโนมัติ", en: "Auto-generate running number" },
  "field.copyLabel.mode.manual": { th: "กรอกเอง (ข้อความเดียวกันทุกชุด)", en: "Type it myself (same text for every copy)" },
  "field.copyLabel.auto.hint": { th: "ระบบจะรันเลขให้อัตโนมัติ (เช่น 001–050) ตามจำนวนชุดที่ต้องการ", en: "The system auto-generates the numbers (e.g. 001–050) based on the number of copies requested." },
  "field.copyLabel.preview": { th: "ตัวอย่างเลขที่จะพิมพ์: {range}", en: "Preview: {range}" },
  "field.copyLabel.manual.hint": { th: "กรอกข้อความหรือเลขที่ต้องการ ระบบจะใช้ข้อความเดียวกันนี้กับทุกชุด", en: "Type the label you want. It will be used identically on every copy." },
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
  "newRequest.calc.responsibility.requester": { th: "ผู้ขอต้องเตรียมกระดาษมาเอง {n} แผ่น (แนะนำให้เผื่อกระดาษเสียจากการพิมพ์ประมาณ 5% โดยเตรียมมาประมาณ {buffered} แผ่น)", en: "Requester must bring {n} sheets (recommend allowing ~5% for print waste. Bring about {buffered} sheets)" },
  "newRequest.calc.responsibility.office": { th: "ฝ่ายทะเบียนจะจัดเตรียมกระดาษให้ {n} แผ่น", en: "Registrar Division will supply {n} sheets" },
  "newRequest.calc.responsibility.pending": { th: "กรอกข้อมูลด้านบนให้ครบเพื่อคำนวณ", en: "Fill in the fields above to calculate" },

  "option.select": { th: "เลือก", en: "Select" },
  "option.selectCategoryFirst": { th: "เลือกประเภทหน่วยงานก่อน", en: "Select a unit type first" },
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
  "submitted.subtitle": { th: "นำเอกสารต้นฉบับไปส่ง พร้อมแสดงเลขอ้างอิงหรือใบคำขอด้านล่างต่อเจ้าหน้าที่ (ไม่จำเป็นต้องพิมพ์ใบคำขอ)", en: "Bring the original documents and show the officer your reference number or the request form below (printing it is optional)." },
  "submitted.deadline.label": { th: "นำเอกสารต้นฉบับมาส่งภายใน", en: "Deliver the original documents by" },
  "submitted.deadline.body": { th: "วันรับเอกสารที่คุณเลือกเป็นวันที่ขอไว้ เจ้าหน้าที่จะยืนยันวันรับจริงอีกครั้งเมื่อรับเอกสารต้นฉบับ และแจ้งให้ทราบทางอีเมล เลยกำหนดส่งแล้วคำขอจะยังค้างที่ \"รอส่งเอกสารต้นฉบับ\" ติดต่อเจ้าหน้าที่ได้หากมีปัญหา", en: "The pickup date you chose is a request: the officer confirms the actual date when receiving your originals and emails it to you. Past the deadline, the request stays at \"Awaiting Original Document\". Contact an Officer if you have any trouble." },
  "submitted.officeLocation": { th: "สถานที่:", en: "Location:" },
  "submitted.officePhone": { th: "โทร:", en: "Phone:" },
  "submitted.deadline.received.label": { th: "รับเอกสารต้นฉบับแล้วเมื่อ", en: "Original documents received on" },
  "submitted.deadline.ready.label": { th: "เอกสารพิมพ์เสร็จแล้ว รับได้ตั้งแต่", en: "Your copies are ready. Collect from" },
  "submitted.deadline.ready.now": { th: "ตอนนี้", en: "Now" },
  "submitted.deadline.ready.body": { th: "มารับได้ที่สถานที่ด้านล่างในเวลาทำการ", en: "Collect them at the place below during opening hours." },
  "submitted.deadline.completed.label": { th: "รับเอกสารเรียบร้อยแล้วเมื่อ", en: "Copies collected on" },
  "submitted.deadline.completed.body": { th: "ขอบคุณที่ใช้บริการ", en: "Thank you for using the service." },
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
  "submitted.cancelError": { th: "ไม่สามารถยกเลิกคำขอนี้ได้ เนื่องจากเจ้าหน้าที่เริ่มดำเนินการกับคำขอนี้ไปแล้ว กรุณารีเฟรชหน้าเพื่อตรวจสอบสถานะล่าสุด", en: "This request can no longer be cancelled. An Officer has already started processing it. Please refresh the page to see the latest status." },
  "submitted.cancelErrorGeneric": { th: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง", en: "A connection error occurred. Please try again." },

  "detail.rejectConfirmTitle": { th: "ยืนยันการปฏิเสธคำขอ", en: "Confirm Rejection" },
  "detail.rejectConfirmMessage": { th: "เหตุผล: {reason}\n\nยืนยันปฏิเสธคำขอนี้?", en: "Reason: {reason}\n\nConfirm rejecting this request?" },

  "summary.refno": { th: "เลขอ้างอิงคำขอ", en: "Request Reference No." },
  "summary.name": { th: "ชื่อผู้ขอ", en: "Requester Name" },
  "summary.unitType": { th: "ประเภทหน่วยงาน", en: "Unit Type" },
  "summary.unit": { th: "หน่วยงาน", en: "Unit" },
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
  "officerQueue.searchPlaceholder": { th: "ค้นหาเลขอ้างอิง ชื่อผู้ขอ หรือหน่วยงาน", en: "Search by reference no., requester, or unit" },
  "officerQueue.empty": { th: "ไม่มีคำขอในคิวขณะนี้", en: "No requests in the queue right now." },
  "officerQueue.overdue": { th: "เลยกำหนด", en: "Overdue" },
  "officerQueue.th.ref": { th: "เลขอ้างอิงคำขอ", en: "Reference No." },
  "officerQueue.th.requester": { th: "ผู้ขอ", en: "Requester" },
  "officerQueue.th.unit": { th: "หน่วยงาน", en: "Unit" },
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
  "detail.bar.approve": { th: "ไปอนุมัติ", en: "Go to approve" },
  "detail.bar.reject": { th: "ปฏิเสธ", en: "Reject" },
  "detail.rejectHint": { th: "ใช้เมื่อเอกสารต้นฉบับไม่ตรงกับสเปกที่ยื่นไว้ในระบบ", en: "Use this when the physical originals do not match the submitted specification." },
  "detail.rejectReasonLabel": { th: "เหตุผลที่ปฏิเสธ *", en: "Rejection Reason *" },
  "detail.rejectReasonPlaceholder": { th: "เช่น จำนวนหน้าต้นฉบับไม่ตรงกับที่ระบุไว้", en: "e.g. Original page count does not match what was submitted" },
  "detail.rejectReasonRequired": { th: "กรุณาระบุเหตุผลที่ปฏิเสธ", en: "Please provide a rejection reason." },
  "detail.rejectBtn": { th: "ปฏิเสธคำขอ", en: "Reject Request" },
  "detail.approvedBand": { th: "อนุมัติแล้ว รับต้นฉบับเรียบร้อย", en: "Approved, master received" },
  "detail.approvedNote": { th: "ระบบจริงจะส่งอีเมล RUN NUMBER และ Claim Code นี้ให้ผู้ขอทันที", en: "The real system would email this RUN NUMBER and Claim Code to the Requester immediately." },
  "detail.rejectedBand": { th: "ปฏิเสธคำขอแล้ว", en: "Request rejected" },
  "detail.rejectedNote": { th: "ระบบจริงจะส่งอีเมลแจ้งเหตุผลให้ผู้ขอทันที", en: "The real system would email the reason to the Requester immediately." },
  "detail.cancelledNotice": { th: "ผู้ขอยกเลิกคำขอนี้เอง ไม่ต้องดำเนินการต่อ", en: "The requester cancelled this request themselves. No action needed." },
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
  "printingJobs.pickupDateLabel": { th: "วันที่รับเอกสาร", en: "Pickup date" },
  "printingJobs.pickupTimeLabel": { th: "รับได้ตั้งแต่เวลา", en: "Available from" },
  "printingJobs.pagesUnit": { th: "หน้า", en: "pages" },
  "printingJobs.pagesBreakdownShort": { th: "{pages} หน้า × {copies} ชุด", en: "{pages} × {copies} copies" },
  "timeWheel.unit.short": { th: "น.", en: "" },
  "printingJobs.confirmReady.question": { th: "ปริ้นและแพ็กเอกสารครบแล้ว พร้อมส่งมอบให้ผู้ขอใช่ไหม", en: "Printing and packing are done and this job is ready for pickup?" },
  "printingJobs.setTime": { th: "กำหนดเวลา", en: "Set a time" },
  "printingJobs.hoursHint": { th: "ผู้ขอจะได้รับแจ้งเวลานี้ พร้อมเวลาทำการของสถานที่ ({hours} น.)", en: "The requester is told this time, together with the place's opening hours ({hours})." },
  "printingJobs.availableNow": { th: "พร้อมรับทันที", en: "Available now" },
  "printingJobs.availableToday": { th: "วันนี้", en: "Today" },
  "printingJobs.availableHint": { th: "เลือกได้เฉพาะวันทำการ เวลา {hours} น. (ตามเวลาทำการของสถานที่นี้) ผู้ขอจะได้รับแจ้งเวลานี้ทางอีเมล", en: "Business days, {hours} only (this place's own hours). The Requester is told this time by email." },
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
  "history.filterUnit": { th: "ประเภทหน่วยงาน", en: "Unit Type" },
  "history.filterUnit.all": { th: "ทุกหน่วยงาน", en: "All units" },
  "history.filterYear": { th: "ปีที่ส่งคำขอ", en: "Submission Year" },
  "history.filterYear.all": { th: "ทุกปี", en: "All years" },
  "history.filterMonth": { th: "เดือนที่ส่งคำขอ", en: "Submission Month" },
  "history.filterMonth.all": { th: "ทุกเดือน", en: "All months" },
  "history.th.ref": { th: "เลขอ้างอิง / RUN NUMBER", en: "Reference No. / RUN NUMBER" },
  "history.th.requester": { th: "ผู้ขอ", en: "Requester" },
  "history.th.unit": { th: "หน่วยงาน", en: "Unit" },
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
  "admin.subtitle": { th: "อีเมลที่อยู่ในรายชื่อนี้ได้สิทธิ์เจ้าหน้าที่ (Officer) และตั้งให้บางคนเป็นผู้ดูแลระบบได้ ส่วนอีเมลอื่นเป็นผู้ขอ (Requester) โดยอัตโนมัติ", en: "Emails on this list are officers, and some can also be made admins. Every other email is a requester automatically." },
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
  "admin.th.assignedBy": { th: "เพิ่มโดย", en: "Added By" },
  "admin.th.assignedDate": { th: "วันที่เพิ่ม", en: "Date Added" },
  "admin.grantedBy": { th: "โดย {email}", en: "by {email}" },
  "admin.grantedAt": { th: "ให้สิทธิ์เมื่อ {date}", en: "Granted on {date}" },
  "admin.th.action": { th: "การดำเนินการ", en: "Action" },
  "admin.revokeBtn": { th: "เพิกถอนสิทธิ์", en: "Revoke" },
  "admin.confirmRevokeBtn": { th: "ยืนยันเพิกถอน", en: "Confirm Revoke" },
  "admin.revokeModalTitle": { th: "ยืนยันการเพิกถอนสิทธิ์", en: "Confirm Revoke" },
  "admin.revokeModalMessage": { th: "ต้องการเพิกถอนสิทธิ์เจ้าหน้าที่ของ {name} ({email}) ใช่หรือไม่? บัญชีนี้จะใช้งานฝั่งเจ้าหน้าที่ไม่ได้ทันที", en: "Remove officer access for {name} ({email})? They lose officer access immediately." },
  "admin.addModalTitle": { th: "ยืนยันการเพิ่มเจ้าหน้าที่", en: "Confirm New Officer" },
  "admin.addModalMessage": { th: "เพิ่ม {name} ({email}) เป็นเจ้าหน้าที่ใช่หรือไม่?", en: "Add {name} ({email}) as an Officer?" },
  "modal.cancel": { th: "ยกเลิก", en: "Cancel" },
  "modal.confirm": { th: "ยืนยัน", en: "Confirm" },
  "modal.ok": { th: "ตกลง", en: "OK" },
  "result.success": { th: "ทำรายการสำเร็จ", en: "Done" },
  "result.failure": { th: "ทำรายการไม่สำเร็จ", en: "Couldn't complete" },
  "result.network": { th: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง", en: "Couldn't reach the server. Check your connection and try again." },
  "result.generic": { th: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", en: "Something went wrong. Please try again." },
  "result.formError": { th: "ยังส่งไม่ได้ กรุณาแก้ไขตามที่แจ้งไว้ในหน้านี้", en: "Not sent yet. Please fix what's shown on this page." },
  "result.msg.submitted": { th: "ส่งคำขอพิมพ์เอกสารเรียบร้อยแล้ว เลขที่คำขอและขั้นตอนต่อไปแสดงอยู่ในหน้านี้", en: "Your print request was submitted. The reference number and next steps are on this page." },
  "result.msg.edited": { th: "บันทึกการแก้ไขคำขอเรียบร้อยแล้ว", en: "Your changes to the request were saved." },
  "result.err.notEditable": { th: "แก้ไขคำขอไม่ได้แล้ว เนื่องจากเจ้าหน้าที่ดำเนินการคำขอนี้ไปแล้ว การแก้ไขจึงไม่ถูกบันทึก", en: "This request can no longer be edited. An officer has already acted on it, so your changes weren't saved." },
  "result.err.evaluationRequired": { th: "ยังสร้างคำขอใหม่ไม่ได้ กรุณาทำแบบประเมินความพึงพอใจของคำขอก่อนหน้าให้เสร็จก่อน", en: "You can't create a new request yet. Please finish the satisfaction evaluation for your previous request first." },
  "profile.saveSuccess": { th: "บันทึกโปรไฟล์เรียบร้อยแล้ว", en: "Your profile was saved." },
  "profile.saveError": { th: "บันทึกโปรไฟล์ไม่สำเร็จ ข้อมูลหน่วยงานที่เลือกอาจถูกเปลี่ยนไปแล้ว ระบบจะโหลดหน้าใหม่ กรุณาเลือกอีกครั้ง", en: "Your profile wasn't saved. The selected department may have changed. The page will reload; please choose again." },
  "detail.result.approved": { th: "อนุมัติคำขอ {ref} แล้ว นัดรับวันที่ {date} ระบบแจ้งผู้ขอให้ทราบแล้ว", en: "Request {ref} approved for {date}. The requester has been notified." },
  "detail.result.rejected": { th: "ปฏิเสธคำขอ {ref} แล้ว ระบบแจ้งผู้ขอพร้อมเหตุผลแล้ว", en: "Request {ref} rejected. The requester has been notified with the reason." },
  "detail.result.notAwaiting": { th: "ดำเนินการคำขอ {ref} ไม่ได้ เนื่องจากคำขอนี้ถูกดำเนินการหรือยกเลิกไปแล้ว หน้านี้แสดงสถานะล่าสุดแล้ว", en: "Couldn't act on {ref}. It was already handled or cancelled. This page now shows its latest status." },
  "printingJobs.readySuccess": { th: "บันทึกว่าคำขอ {ref} พิมพ์เสร็จพร้อมรับแล้ว ระบบแจ้งผู้ขอให้ทราบแล้ว", en: "{ref} marked ready for pickup. The requester has been notified." },
  "handover.result.done": { th: "ส่งมอบเอกสารคำขอ {ref} ให้ {name} เรียบร้อยแล้ว", en: "Request {ref} handed over to {name}." },
  "handover.result.notReady": { th: "ส่งมอบคำขอ {ref} ไม่ได้ เนื่องจากคำขอนี้ไม่ได้อยู่ในสถานะพร้อมรับ (อาจส่งมอบไปแล้ว)", en: "Couldn't hand over {ref}. It isn't ready for pickup (it may already have been handed over)." },
  "admin.result.added": { th: "เพิ่ม {name} ({email}) เป็นเจ้าหน้าที่แล้ว", en: "{name} ({email}) was added as an officer." },
  "admin.result.removed": { th: "ยกเลิกสิทธิ์เจ้าหน้าที่ของ {name} ({email}) แล้ว", en: "Officer access for {name} ({email}) was revoked." },
  "settings.savedMsgFull": { th: "บันทึกการตั้งค่าระบบเรียบร้อยแล้ว", en: "System settings saved." },
  "settings.bar.clean": { th: "ไม่มีการเปลี่ยนแปลง", en: "No unsaved changes" },
  "settings.bar.dirty": { th: "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก", en: "You have unsaved changes" },
  "settings.bar.saving": { th: "กำลังบันทึก…", en: "Saving…" },
  "settings.bar.saved": { th: "บันทึกแล้ว", en: "Saved" },
  "settings.bar.discard": { th: "ยกเลิกการเปลี่ยนแปลง", en: "Discard changes" },
  "result.msg.evaluated": { th: "ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณสำหรับความคิดเห็น", en: "Your evaluation was submitted. Thank you for the feedback." },
  "result.err.evaluationExpired": { th: "หมดเวลาประเมินคำขอนี้แล้ว ไม่ต้องทำแบบประเมินสำหรับคำขอนี้", en: "The time to evaluate this request has passed. No evaluation is needed for it." },
  "admin.empty": { th: "ยังไม่มีเจ้าหน้าที่ในระบบ", en: "No officer accounts yet." },

  "crumb.systemSettings": { th: "จัดการระบบ / <strong>ภาพรวม</strong>", en: "System Settings / <strong>Overview</strong>" },
  "crumb.adminLocations": { th: "สถานที่รับ-ส่งเอกสาร / <strong>ภาพรวม</strong>", en: "Drop-off & Pickup Locations / <strong>Overview</strong>" },
  "crumb.adminAuditLog": { th: "ประวัติการแก้ไข / <strong>ภาพรวม</strong>", en: "Change History / <strong>Overview</strong>" },
  "crumb.adminUnits": { th: "หน่วยงาน / <strong>ภาพรวม</strong>", en: "Units / <strong>Overview</strong>" },
  "crumb.adminEvaluationForm": { th: "แบบประเมิน / <strong>แก้ไข</strong>", en: "Evaluation form / <strong>Edit</strong>" },
  "crumb.evaluationPreview": { th: "แบบประเมิน / <strong>ตัวอย่าง</strong>", en: "Evaluation form / <strong>Preview</strong>" },
  "crumb.adminManuals": { th: "คู่มือการใช้งาน / <strong>ภาพรวม</strong>", en: "User Manuals / <strong>Overview</strong>" },
  "auditLog.action.backupExport": { th: "ดาวน์โหลดไฟล์สำรอง", en: "Downloaded a backup" },
  "auditLog.action.backupSnapshot": { th: "บันทึกไฟล์สำรอง", en: "Saved a backup file" },
  "auditLog.action.backupUpload": { th: "อัปโหลดไฟล์สำรอง", en: "Uploaded a backup file" },
  "auditLog.action.backupRestore": { th: "ใช้ไฟล์สำรอง", en: "Used a backup file" },
  "auditLog.action.backupRollback": { th: "ย้อนกลับข้อมูล", en: "Rolled back" },
  "auditLog.action.backupClear": { th: "ล้างข้อมูลทั้งหมด", en: "Cleared all data" },
  "auditLog.action.backupDelete": { th: "ลบไฟล์สำรอง", en: "Deleted a backup file" },
  "auditLog.action.manualUpload": { th: "อัปโหลดคู่มือการใช้งาน", en: "Uploaded a user manual" },
  "auditLog.action.manualDelete": { th: "ลบคู่มือการใช้งาน", en: "Deleted a user manual" },
  "settings.title": { th: "จัดการระบบ", en: "System Settings" },
  "settings.subtitle": { th: "แจ้งเตือนอีเมลเจ้าหน้าที่ และเปิด/ปิดระบบสำหรับผู้ขอ", en: "Officer email alerts and Requester access." },
  "settings.notif.title": { th: "แจ้งเตือนเจ้าหน้าที่", en: "Officer Alerts" },
  "settings.notif.toggle": { th: "ส่งอีเมลเมื่อมีคำขอใหม่", en: "Email officers on new requests" },
  "settings.notif.toggle.hint": { th: "การแจ้งเตือนในระบบ (กระดิ่ง) ทำงานเสมอ", en: "The in-app bell always stays on." },

  "adminLocations.title": { th: "สถานที่รับ-ส่งเอกสาร", en: "Drop-off & Pickup Locations" },
  "adminLocations.subtitle": { th: "กำหนดที่ส่งเอกสารต้นฉบับและที่รับเอกสารที่พิมพ์เสร็จ กรอกทั้งไทยและอังกฤษ", en: "Set where originals are dropped off and finished prints are picked up. Fill in both Thai and English." },
  "adminLocations.tableTitle": { th: "รายการสถานที่", en: "Locations" },
  "adminLocations.form.addTitle": { th: "เพิ่มสถานที่ใหม่", en: "Add Location" },
  "adminLocations.form.editTitle": { th: "แก้ไขสถานที่", en: "Edit Location" },
  "adminLocations.form.phone": { th: "เบอร์โทรติดต่อ", en: "Contact phone" },
  "adminLocations.form.phonePlaceholder": { th: "เช่น 053-916xxx (ชื่อผู้ติดต่อ)", en: "e.g. 053-916xxx (Contact name)" },
  "adminLocations.form.mapUrl": { th: "ลิงก์แผนที่ (ถ้ามี)", en: "Map link (optional)" },
  "adminLocations.form.mapUrlPlaceholder": { th: "เช่น https://maps.app.goo.gl/...", en: "e.g. https://maps.app.goo.gl/..." },
  "adminLocations.addBtn": { th: "เพิ่มสถานที่", en: "Add Location" },
  "adminLocations.form.basicInfo": { th: "ชื่อและรายละเอียด", en: "Name & details" },
  "adminLocations.form.colTh": { th: "ภาษาไทย", en: "Thai" },
  "adminLocations.form.colEn": { th: "ภาษาอังกฤษ", en: "English" },
  "adminLocations.form.rowName": { th: "ชื่อสถานที่ *", en: "Name *" },
  "adminLocations.form.rowDetail": { th: "อาคาร / ชั้น / ห้อง *", en: "Building / floor / room *" },
  "adminLocations.form.hours": { th: "เวลาทำการ", en: "Opening hours" },
  "adminLocations.form.defaultTip": { th: "ระบบจะเลือกสถานที่นี้ไว้ให้ก่อน ผู้ใช้เปลี่ยนได้", en: "The system pre-selects this place; it can still be changed." },
  "adminLocations.form.makeDefault": { th: "ตั้งเป็นค่าเริ่มต้น", en: "Set as default" },
  "adminLocations.form.isDefault": { th: "ค่าเริ่มต้น", en: "Default" },
  "adminLocations.form.acceptsPickup": { th: "ผู้ขอมารับเอกสารที่พิมพ์เสร็จที่นี่", en: "Requesters collect finished copies here" },
  "adminLocations.form.acceptsDropoff": { th: "ผู้ขอนำเอกสารต้นฉบับมาส่งที่นี่", en: "Requesters drop off originals here" },
  "adminLocations.form.hoursUntil": { th: "ถึง", en: "to" },
  "adminLocations.form.hoursNone": { th: "ไม่ระบุ", en: "Not set" },
  "adminLocations.form.hoursLegacy": { th: "เวลาเดิมที่เคยพิมพ์ไว้:", en: "Existing hours (typed earlier):" },
  "adminLocations.form.hoursLegacyHint": { th: "ถ้าไม่เลือกวัน ระบบจะคงค่าเดิมไว้ ถ้าเลือกวันและเวลาใหม่ จะใช้ค่าใหม่แทน", en: "Leave the days unset to keep this, or pick new days and times to replace it." },
  "adminLocations.form.contact": { th: "ติดต่อ", en: "Contact" },
  "adminLocations.form.usage": { th: "สถานที่นี้ใช้ทำอะไร", en: "What is this place for?" },
  "adminLocations.form.editTitleNamed": { th: "แก้ไขสถานที่: {name}", en: "Edit Location: {name}" },
  "adminLocations.deleteBtn": { th: "ลบ", en: "Delete" },
  "adminLocations.deleteConfirmTitle": { th: "ลบสถานที่นี้ถาวร?", en: "Delete this location permanently?" },
  "adminLocations.deleteConfirmMessage": { th: "“{name}” จะถูกลบถาวรและกู้คืนไม่ได้ คำขอที่เสร็จสิ้นแล้วยังแสดงชื่อสถานที่เดิมได้ตามปกติ แต่ถ้ายังมีคำขอที่ดำเนินการไม่เสร็จใช้สถานที่นี้อยู่ ระบบจะไม่ให้ลบ", en: "“{name}” will be deleted for good. Finished requests keep showing this place as before, but deletion is blocked while any unfinished request still uses it." },
  "adminLocations.err.inUse": { th: "ลบไม่ได้: ยังมีคำขอที่ดำเนินการไม่เสร็จ {n} รายการใช้สถานที่นี้อยู่ กรุณารอให้เสร็จก่อน หรือใช้ “เก็บถาวร” เพื่อไม่ให้เลือกสถานที่นี้ได้อีก", en: "Can't delete: {n} unfinished request(s) still use this place. Wait until they're done, or use “Archive” so it can't be chosen any more." },
  "adminLocations.err.hoursIncomplete": { th: "เวลาทำการไม่ครบ กรุณาเลือกทั้งวันเริ่ม วันสิ้นสุด เวลาเปิด และเวลาปิด หรือเว้นว่างทั้งหมด", en: "Opening hours are incomplete. Choose both days and both times, or leave all blank." },
  "adminLocations.err.hoursInvalid": { th: "เวลาทำการไม่ถูกต้อง เวลาปิดต้องอยู่หลังเวลาเปิด และวันสิ้นสุดต้องไม่มาก่อนวันเริ่ม", en: "Invalid hours. Closing must be after opening, and the last day can't be before the first." },
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
  "adminLocations.badge.default": { th: "ค่าเริ่มต้น", en: "Default" },
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
  "adminLocations.err.missingFields": { th: "กรุณากรอกให้ครบ:", en: "Please fill in:" },
  "adminLocations.err.fillThis": { th: "กรุณากรอกช่องนี้", en: "Please fill this in" },
  "adminLocations.err.pickDays": { th: "กรุณาเลือกวันทำการ", en: "Please choose the opening days" },
  "adminLocations.err.pickUsage": { th: "กรุณาเลือกอย่างน้อย 1 ข้อ", en: "Please tick at least one" },
  "adminLocations.missing.nameTh": { th: "ชื่อสถานที่ (ไทย)", en: "Name (Thai)" },
  "adminLocations.missing.nameEn": { th: "ชื่อสถานที่ (อังกฤษ)", en: "Name (English)" },
  "adminLocations.missing.detailTh": { th: "อาคาร / ชั้น / ห้อง (ไทย)", en: "Building / floor / room (Thai)" },
  "adminLocations.missing.detailEn": { th: "อาคาร / ชั้น / ห้อง (อังกฤษ)", en: "Building / floor / room (English)" },
  "adminLocations.missing.hours": { th: "วันทำการ", en: "Opening days" },
  "adminLocations.missing.phone": { th: "เบอร์โทรติดต่อ", en: "Contact phone" },
  "adminLocations.missing.usage": { th: "สถานที่นี้ใช้ทำอะไร (เลือกอย่างน้อย 1 ข้อ)", en: "What this place is for (tick at least one)" },
  "adminLocations.err.purposeRequired": { th: "กรุณาเลือกอย่างน้อยหนึ่งอย่าง: ส่งเอกสารต้นฉบับ หรือ รับเอกสารที่พิมพ์เสร็จ", en: "Choose at least one: drop-off or pickup." },
  "adminLocations.err.lastDropoff": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นสถานที่ส่งเอกสารแห่งสุดท้ายที่ยังใช้งานอยู่", en: "Can't archive. This is the last active drop-off location." },
  "adminLocations.err.lastPickup": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นสถานที่รับเอกสารแห่งสุดท้ายที่ยังใช้งานอยู่", en: "Can't archive. This is the last active pickup location." },
  "adminLocations.err.generic": { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", en: "Couldn't save. Please try again." },
  "adminLocations.empty": { th: "ยังไม่มีสถานที่", en: "No locations yet." },
  "newRequest.error.unit": { th: "ประเภทหน่วยงาน/หน่วยงานไม่ถูกต้อง", en: "Invalid unit type/unit" },
  "newRequest.error.unit.body": { th: "กรุณาเลือกประเภทหน่วยงานและหน่วยงานใหม่อีกครั้ง", en: "Please choose the unit type and unit again." },
  "adminLocations.movedModal.title": { th: "ยืนยันการแก้ไข", en: "Confirm this edit" },
  "adminLocations.movedModal.message": { th: "มีคำขอ {n} รายการที่ยังอ้างถึงสถานที่นี้อยู่ การแก้ไขนี้คือ...", en: "{n} request(s) still refer to this place. This edit is..." },
  "adminLocations.movedModal.optionTypo": { th: "แก้คำผิด/พิมพ์ตก (ไม่แจ้งใคร)", en: "Fixing a typo (no one is notified)" },
  "adminLocations.movedModal.optionMoved": { th: "ย้ายสถานที่จริง (แจ้งผู้ขอ {n} คน)", en: "An actual move ({n} requester(s) will be notified)" },
  "adminLocations.movedModal.confirmBtn": { th: "ยืนยันการแก้ไข", en: "Confirm edit" },
  "adminLocations.archiveReplaceModal.title": { th: "เลือกสถานที่ทดแทน", en: "Choose a replacement location" },
  "adminLocations.archiveReplaceModal.message": { th: "“{name}” มีคำขอ {n} รายการที่ยังอ้างถึงอยู่ กรุณาเลือกสถานที่ทดแทน ระบบจะย้ายคำขอเหล่านี้ไปที่นั่นและแจ้งผู้ขอให้ทราบ", en: "“{name}” still has {n} request(s) pointing at it. Choose a replacement. Those requests will move there and their requesters will be notified." },
  "adminLocations.archiveReplaceModal.selectLabel": { th: "สถานที่ทดแทน", en: "Replacement location" },
  "adminLocations.archiveReplaceModal.confirmBtn": { th: "เก็บถาวรและย้ายคำขอ", en: "Archive and move requests" },
  "adminLocations.archiveReplaceModal.noOptions": { th: "ไม่มีสถานที่อื่นที่ใช้งานอยู่และรองรับประเภทเดียวกัน กรุณาเพิ่มสถานที่ใหม่ก่อนเก็บถาวรที่นี่", en: "No other active location accepts the same purpose(s). Add a new location before archiving this one." },
  "adminLocations.banner.savedNotified": { th: "บันทึกสถานที่ “{name}” และแจ้งผู้ขอ {n} คนเรื่องการย้ายแล้ว", en: "Saved “{name}” and notified {n} requester(s) about the move." },
  "adminLocations.banner.archivedNotified": { th: "เก็บถาวร “{name}” และย้ายคำขอ {n} รายการไปสถานที่ทดแทนแล้ว", en: "Archived “{name}” and moved {n} request(s) to the replacement location." },
  "adminLocations.err.replacementRequired": { th: "มีคำขอใหม่เข้ามาระหว่างนี้ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง", en: "New requests came in meanwhile. Please reload the page and try again." },
  "adminLocations.err.replacementInvalid": { th: "สถานที่ทดแทนไม่ถูกต้องหรือไม่ได้ใช้งานอยู่", en: "The replacement location is invalid or inactive." },
  "adminLocations.err.replacementPurposeMismatch": { th: "สถานที่ทดแทนต้องรองรับประเภทเดียวกับที่มีคำขอค้างอยู่", en: "The replacement location must accept the same purpose(s) as the pending requests." },

  "auditLog.title": { th: "ประวัติการแก้ไข", en: "Change History" },
  "auditLog.subtitle": { th: "บันทึกทุกการเปลี่ยนแปลงที่ผู้ดูแลระบบทำ เช่น สิทธิ์เจ้าหน้าที่ การตั้งค่าระบบ สถานที่ หน่วยงาน และคู่มือ เรียงจากล่าสุด", en: "Every change made by admins: officer access, system settings, locations, units and manuals, newest first." },
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

  "adminUnits.title": { th: "หน่วยงาน", en: "Units" },
  "adminUnits.subtitle": { th: "กำหนดประเภทหน่วยงานและหน่วยงานย่อยที่ผู้ขอเลือกตอนส่งคำขอ กรอกทั้งภาษาไทยและอังกฤษ", en: "Set the unit types and units Requesters pick from. Fill in both Thai and English." },
  "adminUnits.categoriesTitle": { th: "ประเภทหน่วยงาน", en: "Unit Types" },
  "adminUnits.addCategoryBtn": { th: "เพิ่มประเภท", en: "Add Category" },
  "adminUnits.addUnitBtn": { th: "เพิ่มหน่วยงาน", en: "Add Unit" },
  "adminUnits.backBtn": { th: "ประเภทหน่วยงาน", en: "Unit Types" },
  "adminUnits.unitTypeLabel": { th: "ประเภทหน่วยงาน", en: "Unit Type" },
  "adminUnits.unitCount": { th: "{n} หน่วยงาน", en: "{n} units" },
  "adminUnits.viewUnitsBtn": { th: "ดูหน่วยงาน ({n})", en: "View units ({n})" },
  "adminUnits.freeTextHint": { th: "ผู้ขอพิมพ์ชื่อหน่วยงานเอง", en: "Requester types the unit name" },
  "adminUnits.categoriesEmpty": { th: "ยังไม่มีประเภทหน่วยงาน", en: "No unit types yet." },
  "adminUnits.unitsEmpty": { th: "ยังไม่มีหน่วยงานในประเภทนี้", en: "No units in this category yet." },
  "adminUnits.form.nameTh": { th: "ชื่อ (ไทย) *", en: "Name (Thai) *" },
  "adminUnits.form.nameEn": { th: "ชื่อ (อังกฤษ) *", en: "Name (English) *" },
  "adminUnits.form.allowsFreeText": { th: "ไม่มีรายชื่อหน่วยงานย่อย ให้ผู้ขอพิมพ์ชื่อหน่วยงานเอง", en: "No fixed unit list. Requesters type the unit name." },
  "adminUnits.form.saveBtn": { th: "บันทึก", en: "Save" },
  "adminUnits.categoryForm.addTitle": { th: "เพิ่มประเภทหน่วยงาน", en: "Add Unit Type" },
  "adminUnits.categoryForm.editTitleNamed": { th: "แก้ไขประเภทหน่วยงาน: {name}", en: "Edit Unit Type: {name}" },
  "adminUnits.unitForm.addTitle": { th: "เพิ่มหน่วยงาน", en: "Add Unit" },
  "adminUnits.unitForm.editTitleNamed": { th: "แก้ไขหน่วยงาน: {name}", en: "Edit Unit: {name}" },
  "adminUnits.unitForm.category": { th: "ประเภทหน่วยงาน", en: "Unit Type" },
  "adminUnits.unitForm.categoryHint": { th: "เปลี่ยนได้ถ้าต้องการย้ายหน่วยงานนี้ไปอีกประเภทหนึ่ง", en: "Change this to move the unit to a different category." },
  "adminUnits.th.name": { th: "ชื่อ", en: "Name" },
  "adminUnits.th.units": { th: "หน่วยงานย่อย", en: "Units" },
  "adminUnits.th.action": { th: "การดำเนินการ", en: "Actions" },
  "adminUnits.badge.freeText": { th: "พิมพ์เอง", en: "Free text" },
  "adminUnits.badge.archived": { th: "เก็บถาวร", en: "Archived" },
  "adminUnits.editBtn": { th: "แก้ไข", en: "Edit" },
  "adminUnits.archiveBtn": { th: "เก็บถาวร", en: "Archive" },
  "adminUnits.restoreBtn": { th: "นำกลับมาใช้", en: "Restore" },
  "adminUnits.deleteBtn": { th: "ลบ", en: "Delete" },
  "adminUnits.archiveConfirmTitle": { th: "เก็บถาวรรายการนี้?", en: "Archive this?" },
  "adminUnits.archiveConfirmMessage": { th: "“{name}” จะไม่แสดงเป็นตัวเลือกอีก คำขอที่เคยเลือกไว้ยังคงเห็นชื่อเดิม", en: "“{name}” will no longer be offered as a choice. Requests that already use it keep showing its name." },
  "adminUnits.deleteConfirmTitle": { th: "ลบถาวร?", en: "Delete permanently?" },
  "adminUnits.deleteConfirmMessage": { th: "“{name}” จะถูกลบถาวรและกู้คืนไม่ได้ คำขอที่เสร็จสิ้นแล้วยังแสดงชื่อเดิมได้ตามปกติ แต่ถ้ายังมีคำขอที่ดำเนินการไม่เสร็จใช้อยู่ ระบบจะไม่ให้ลบ", en: "“{name}” will be deleted for good. Finished requests keep showing the name as before, but deletion is blocked while any unfinished request still uses it." },
  "adminUnits.banner.saved": { th: "บันทึก “{name}” เรียบร้อยแล้ว", en: "Saved “{name}”." },
  "adminUnits.banner.archived": { th: "เก็บถาวร “{name}” แล้ว", en: "Archived “{name}”." },
  "adminUnits.banner.restored": { th: "นำ “{name}” กลับมาใช้แล้ว", en: "Restored “{name}”." },
  "adminUnits.banner.deleted": { th: "ลบ “{name}” แล้ว", en: "Deleted “{name}”." },
  "adminUnits.err.nameRequired": { th: "กรุณากรอกชื่อทั้งภาษาไทยและอังกฤษ", en: "Please enter the name in both Thai and English." },
  "adminUnits.err.fillThis": { th: "กรุณากรอกช่องนี้", en: "Please fill this in" },
  "adminUnits.err.categoryRequired": { th: "กรุณาเลือกประเภทหน่วยงาน", en: "Please choose a unit type." },
  "adminUnits.err.categoryInvalid": { th: "ประเภทหน่วยงานไม่ถูกต้อง", en: "Invalid unit type." },
  "adminUnits.err.lastCategory": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นประเภทหน่วยงานแห่งสุดท้ายที่ยังใช้งานอยู่", en: "Can't archive. This is the last active unit type." },
  "adminUnits.err.lastFreeText": { th: "ไม่สามารถเก็บถาวรได้ เพราะเป็นประเภท “พิมพ์เอง” แห่งสุดท้ายที่ยังใช้งานอยู่ ถ้าเก็บถาวร ผู้ขอที่ไม่ตรงกับหมวดใดเลยจะไม่มีตัวเลือกให้กรอก", en: "Can't archive: this is the last active free-text category. Requesters who don't fit any other category would have no option left." },
  "adminUnits.err.hasUnits": { th: "ลบไม่ได้: ยังมีหน่วยงานย่อยอยู่ในประเภทนี้ กรุณาลบหรือย้ายหน่วยงานย่อยก่อน", en: "Can't delete: this category still has units. Delete or move them first." },
  "adminUnits.err.inUse": { th: "ลบไม่ได้: ยังมีคำขอที่ดำเนินการไม่เสร็จ {n} รายการใช้อยู่ กรุณารอให้เสร็จก่อน หรือใช้ “เก็บถาวร” เพื่อไม่ให้เลือกได้อีก", en: "Can't delete: {n} unfinished request(s) still use this. Wait until they're done, or use “Archive” so it can't be chosen any more." },
  "adminUnits.err.generic": { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", en: "Couldn't save. Please try again." },
  "auditLog.filterActor.all": { th: "ผู้แก้ไขทั้งหมด", en: "All editors" },
  "auditLog.filterAction.all": { th: "การดำเนินการทั้งหมด", en: "All actions" },
  "filter.category": { th: "หมวด", en: "Category" },
  "auditLog.filterType.all": { th: "ทุกหมวด", en: "All categories" },
  "auditLog.type.officer": { th: "บัญชีเจ้าหน้าที่", en: "Officer accounts" },
  "auditLog.type.settings": { th: "ตั้งค่าระบบ", en: "System settings" },
  "auditLog.type.location": { th: "สถานที่รับ-ส่งเอกสาร", en: "Locations" },
  "auditLog.type.unit": { th: "หน่วยงาน", en: "Units" },
  "auditLog.type.unitType": { th: "ประเภทหน่วยงาน", en: "Unit categories" },
  "auditLog.type.evaluationForm": { th: "แบบประเมิน", en: "Evaluation form" },
  "auditLog.type.system": { th: "คู่มือการใช้งาน", en: "User manuals" },
  "auditLog.action.officerAdd": { th: "เพิ่มเจ้าหน้าที่", en: "Added officer" },
  "auditLog.action.officerRemove": { th: "เพิกถอนสิทธิ์เจ้าหน้าที่", en: "Removed officer" },
  "auditLog.action.officerGrantAdmin": { th: "ให้สิทธิ์ผู้ดูแลระบบ", en: "Granted admin role" },
  "auditLog.action.officerRevokeAdmin": { th: "ยกเลิกสิทธิ์ผู้ดูแลระบบ", en: "Revoked admin role" },
  "auditLog.action.settingsUpdate": { th: "แก้ไขการตั้งค่าระบบ", en: "Changed system settings" },
  "auditLog.action.unitTypeCreate": { th: "เพิ่มประเภทหน่วยงาน", en: "Added unit category" },
  "auditLog.action.unitTypeUpdate": { th: "แก้ไขประเภทหน่วยงาน", en: "Edited unit category" },
  "auditLog.action.evalWindow": { th: "แก้ไขระยะเวลาที่ให้ประเมิน", en: "Changed the evaluation time limit" },
  "auditLog.action.evalSectionCreate": { th: "เพิ่มหัวข้อแบบประเมิน", en: "Added evaluation section" },
  "auditLog.action.evalSectionUpdate": { th: "แก้ไขหัวข้อแบบประเมิน", en: "Edited evaluation section" },
  "auditLog.action.evalSectionDelete": { th: "ลบหัวข้อแบบประเมิน", en: "Deleted evaluation section" },
  "auditLog.action.evalQuestionCreate": { th: "เพิ่มคำถามแบบประเมิน", en: "Added evaluation question" },
  "auditLog.action.evalQuestionUpdate": { th: "แก้ไขคำถามแบบประเมิน", en: "Edited evaluation question" },
  "auditLog.action.evalQuestionDelete": { th: "ลบคำถามแบบประเมิน", en: "Deleted evaluation question" },
  "auditLog.action.unitTypeArchive": { th: "เก็บถาวรประเภทหน่วยงาน", en: "Archived unit category" },
  "auditLog.action.unitTypeRestore": { th: "นำประเภทหน่วยงานกลับมาใช้", en: "Restored unit category" },
  "auditLog.action.unitTypeDelete": { th: "ลบประเภทหน่วยงาน", en: "Deleted unit category" },
  "auditLog.action.unitCreate": { th: "เพิ่มหน่วยงาน", en: "Added unit" },
  "auditLog.action.unitUpdate": { th: "แก้ไขหน่วยงาน", en: "Edited unit" },
  "auditLog.action.unitArchive": { th: "เก็บถาวรหน่วยงาน", en: "Archived unit" },
  "auditLog.action.unitRestore": { th: "นำหน่วยงานกลับมาใช้", en: "Restored unit" },
  "auditLog.action.unitDelete": { th: "ลบหน่วยงาน", en: "Deleted unit" },
  "auditLog.field.name": { th: "ชื่อ", en: "Name" },
  "auditLog.field.allowsFreeText": { th: "ให้พิมพ์ชื่อหน่วยงานเองได้", en: "Allows typed-in unit" },
  "auditLog.field.categoryId": { th: "ประเภทหน่วยงาน (รหัส)", en: "Category (id)" },
  "auditLog.field.isAdmin": { th: "สิทธิ์ผู้ดูแลระบบ", en: "Admin role" },
  "auditLog.field.officerEmail": { th: "ส่งอีเมลแจ้งเจ้าหน้าที่", en: "Email officers" },
  "auditLog.field.maintenanceMode": { th: "ปิดปรับปรุงระบบ", en: "Maintenance mode" },
  "auditLog.field.maintenanceStart": { th: "เริ่มปิดปรับปรุง", en: "Maintenance starts" },
  "auditLog.field.maintenanceEnd": { th: "สิ้นสุดปิดปรับปรุง", en: "Maintenance ends" },
  "auditLog.field.maintenanceMessage": { th: "ข้อความแจ้งผู้ใช้", en: "Notice to users" },
  "admin.th.role": { th: "บทบาท", en: "Role" },
  "admin.alsoAdmin": { th: "ให้สิทธิ์ผู้ดูแลระบบด้วย", en: "Also make this person an admin" },
  "admin.selfNote": { th: "บัญชีของคุณ", en: "Your account" },
  "admin.grantAdminBtn": { th: "ตั้งเป็นผู้ดูแลระบบ", en: "Make admin" },
  "admin.revokeAdminBtn": { th: "ยกเลิกสิทธิ์ผู้ดูแลระบบ", en: "Remove admin role" },
  "admin.grantAdminTitle": { th: "ยืนยันการให้สิทธิ์ผู้ดูแลระบบ", en: "Make this person an admin?" },
  "admin.grantAdminMessage": { th: "ให้ {name} ({email}) เป็นผู้ดูแลระบบ จะเข้าถึงเมนูผู้ดูแลระบบได้ทั้งหมด รวมถึงการสำรองและกู้คืนข้อมูล", en: "Make {name} ({email}) an admin? They will get every admin menu, including backup & restore." },
  "admin.grantAdminDone": { th: "{name} ({email}) เป็นผู้ดูแลระบบแล้ว", en: "{name} ({email}) is now an admin." },
  "admin.revokeAdminTitle": { th: "ยืนยันการยกเลิกสิทธิ์ผู้ดูแลระบบ", en: "Remove admin role?" },
  "admin.revokeAdminMessage": { th: "ยกเลิกสิทธิ์ผู้ดูแลระบบของ {name} ({email}) บัญชีนี้จะยังเป็นเจ้าหน้าที่อยู่", en: "Remove the admin role from {name} ({email})? They stay an officer." },
  "admin.revokeAdminDone": { th: "ยกเลิกสิทธิ์ผู้ดูแลระบบของ {name} ({email}) แล้ว", en: "Removed the admin role from {name} ({email})." },
  "admin.result.addedAdmin": { th: "เพิ่ม {name} ({email}) เป็นเจ้าหน้าที่และผู้ดูแลระบบแล้ว", en: "Added {name} ({email}) as an officer and admin." },
  "admin.error.self": { th: "ไม่สามารถเปลี่ยนสิทธิ์หรือเพิกถอนบัญชีของตัวเองได้ ให้ผู้ดูแลระบบคนอื่นเป็นผู้ดำเนินการ", en: "You can't change or remove your own account. Ask another admin." },
  "admin.error.last-admin": { th: "ทำไม่ได้ เพราะจะไม่เหลือผู้ดูแลระบบในระบบเลย กรุณาตั้งผู้ดูแลระบบคนอื่นก่อน", en: "Not allowed: there would be no admin left. Make someone else an admin first." },
  "admin.error.not-found": { th: "ไม่พบบัญชีนี้แล้ว กรุณารีเฟรชหน้า", en: "This account no longer exists. Please refresh." },
  "admin.envAdmins.title": { th: "ผู้ดูแลระบบที่กำหนดจากเซิร์ฟเวอร์", en: "Admins set on the server" },
  "admin.envAdmins.desc": { th: "บัญชีเหล่านี้เป็นผู้ดูแลระบบเสมอ (ตั้งค่าใน ADMIN_EMAILS ของไฟล์ .env) แก้ไขจากหน้านี้ไม่ได้ ใช้เป็นบัญชีสำรองกรณีฉุกเฉิน", en: "These accounts are always admins (ADMIN_EMAILS in the server .env file) and can't be changed here. They are the emergency fallback." },
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
  "settings.maint.clearAllBtn": { th: "ล้างช่วงเวลา", en: "Clear dates" },
  "timeWheel.title": { th: "เลือกเวลา", en: "Choose a time" },
  "timeWheel.hour": { th: "ชั่วโมง", en: "Hour" },
  "timeWheel.minute": { th: "นาที", en: "Minute" },
  "timeWheel.unit": { th: "เวลา (น.) เลื่อนหรือคลิกเพื่อเลือก", en: "24-hour, scroll or click to pick" },
  "timeWheel.done": { th: "ตกลง", en: "Done" },
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
  "systemClosed.reopensLabel": { th: "เปิดให้บริการอีกครั้ง", en: "Reopens on" },
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
  "profile.prefix.none": { th: "ไม่ระบุ", en: "Not set" },
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
  "profile.workplaceCategoryLabel": { th: "ประเภทหน่วยงาน", en: "Unit Type" },
  "profile.workplaceUnitLabel": { th: "หน่วยงาน", en: "Unit" },
  "profile.workplaceCategory.none": { th: "ไม่ระบุ", en: "Not set" },
  "profile.positionLabel": { th: "ตำแหน่ง", en: "Position" },
  "profile.saveBtn": { th: "บันทึกโปรไฟล์", en: "Save Profile" },

  "requestForm.crumb": { th: "ใบคำขอพิมพ์เอกสาร", en: "Request Form" },
  "requestForm.subtitle": { th: "ใบคำขอพิมพ์เอกสารฉบับเต็ม สำหรับตรวจสอบหรือพิมพ์ซ้ำ", en: "Full Request Form, for review or re-printing." },
  "requestForm.backToHistory": { th: "กลับไปที่ประวัติคำขอ", en: "Back to History" },

  "crumb.dashboard": { th: "แดชบอร์ดสรุปข้อมูล / <strong>ภาพรวม</strong>", en: "Dashboard / <strong>Overview</strong>" },
  "crumb.evaluations": { th: "ผลประเมินความพึงพอใจ / <strong>ภาพรวม</strong>", en: "Evaluation Results / <strong>Overview</strong>" },
  "dashboard.title": { th: "แดชบอร์ดสรุปข้อมูล", en: "Summary Dashboard" },
  "db.subtitle": { th: "การใช้กระดาษของแต่ละหน่วยงาน", en: "Paper use by unit" },
  "db.f.unitGroup": { th: "หน่วยงาน", en: "Unit" },
  "db.f.paperGroup": { th: "เอกสารและกระดาษ", en: "Document and paper" },
  "db.f.unitPh": { th: "ทุกหน่วยงาน", en: "All units" },
  "db.active.label": { th: "กำลังดู", en: "Showing" },
  "db.active.remove": { th: "เอาตัวกรองนี้ออก", en: "Remove this filter" },
  "db.share.back": { th: "ทุกประเภท", en: "All types" },
  "db.f.unitSearch": { th: "พิมพ์ชื่อหน่วยงาน (ไทยหรืออังกฤษ)", en: "Type a unit name (Thai or English)" },
  "db.f.unitNone": { th: "ไม่พบหน่วยงาน", en: "No unit found" },
  "db.kpi.units": { th: "หน่วยงานที่ใช้บริการ", en: "Active units" },
  "db.share.byType": { th: "สัดส่วนตามประเภทหน่วยงาน", en: "Share by unit type" },
  "db.share.inType": { th: "สัดส่วนหน่วยงานใน {name}", en: "Units in {name}" },
  "db.share.hintType": { th: "คลิกเพื่อกรองประเภทนั้น", en: "Click to filter to that type." },
  "db.share.hintUnit": { th: "คลิกเพื่อกรองหน่วยงานนั้น", en: "Click to filter to that unit." },
  "db.share.other": { th: "อื่นๆ ({n})", en: "Other ({n})" },
  "db.split.title": { th: "สัดส่วนเอกสารและกระดาษ", en: "Documents and paper" },
  "db.split.hint": { th: "คลิกเพื่อกรอง", en: "Click to filter." },
  "db.table.title": { th: "แยกตามหน่วยงาน", en: "By unit" },
  "db.table.hint": { th: "คลิกชื่อหน่วยงานเพื่อกรองเฉพาะหน่วยงานนั้น คลิกหัวคอลัมน์เพื่อเรียง", en: "Click a unit to filter to it. Click a column heading to sort." },
  "db.table.unit": { th: "หน่วยงาน", en: "Unit" },
  "db.table.new": { th: "ใหม่", en: "New" },
  "db.table.all": { th: "แสดงทั้งหมด ({n})", en: "Show all ({n})" },
  "db.table.less": { th: "แสดงแค่ 10 อันดับ", en: "Show top 10 only" },
  "db.reset": { th: "ล้างตัวกรอง", en: "Clear filters" },
  "db.yearN": { th: "ปี {y}", en: "{y}" },
  "db.noPrev": { th: "ไม่มีข้อมูลช่วงเดียวกันปีก่อน", en: "No data for the same period last year" },
  "db.kpi.req": { th: "คำขอที่พิมพ์แล้ว", en: "Printed requests" },
  "db.kpi.sheets": { th: "แผ่นกระดาษที่ใช้", en: "Sheets used" },
  "db.kpi.avg": { th: "แผ่นต่อคำขอ (เฉลี่ย)", en: "Sheets per request (avg)" },
  "db.kpi.rank": { th: "อันดับการใช้กระดาษ", en: "Paper use rank" },
  "db.sheetsUnit": { th: "แผ่น", en: "sheets" },
  "db.noData": { th: "ไม่มีข้อมูลในช่วงนี้", en: "No data for this selection" },
  "db.loading": { th: "กำลังโหลดข้อมูล…", en: "Loading…" },
  "db.loadError": { th: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า", en: "Could not load data. Try refreshing the page." },
  "db.mode.all": { th: "ทั้งหมด", en: "All time" },
  "db.mode.year": { th: "รายปี", en: "By year" },
  "db.mode.month": { th: "รายเดือน", en: "By month" },
  "db.mode.range": { th: "เลือกวันที่", en: "Date range" },
  "dd.search": { th: "พิมพ์เพื่อค้นหา", en: "Type to search" },
  "dd.none": { th: "ไม่พบรายการ", en: "No match" },
  "dd.choose": { th: "เลือก", en: "Choose" },
  "db.mode.fiscal": { th: "ปีงบประมาณ", en: "Fiscal year" },
  "db.fyN": { th: "ปีงบประมาณ {y}", en: "FY {y}" },
  "db.dd.year": { th: "เลือกปี", en: "Choose a year" },
  "db.dd.fy": { th: "เลือกปีงบประมาณ (1 ต.ค. ถึง 30 ก.ย.)", en: "Choose a fiscal year (1 Oct to 30 Sep)" },
  "db.dd.month": { th: "เลือกเดือน ปี {y}", en: "Choose a month, {y}" },
  "db.mode.allSpan": { th: "ทั้งหมด ({a} ถึง {b})", en: "All time ({a} to {b})" },
  "db.step.prev": { th: "ก่อนหน้า", en: "Previous" },
  "db.step.next": { th: "ถัดไป", en: "Next" },
  "db.upTo": { th: "(นับถึง {d})", en: "(counted to {d})" },
  "db.chart.day": { th: "แผ่นกระดาษรายวัน", en: "Sheets per day" },
  "db.chart.month": { th: "แผ่นกระดาษรายเดือน", en: "Sheets per month" },
  "db.chart.year": { th: "แผ่นกระดาษรายปี", en: "Sheets per year" },
  "db.chart.hintYear": { th: "คลิกปีเพื่อดูรายเดือนของปีนั้น", en: "Click a year to see its months." },
  "db.chart.hintMonth": { th: "คลิกเดือนเพื่อดูรายวันของเดือนนั้น", en: "Click a month to see its days." },
  "db.chart.clickYear": { th: "คลิกเพื่อดูปีนี้", en: "Click to view this year" },
  "db.chart.clickMonth": { th: "คลิกเพื่อดูเดือนนี้", en: "Click to view this month" },
  "db.chart.future": { th: "ยังไม่ถึง", en: "Not yet" },
  "db.legend.now": { th: "ช่วงที่เลือก", en: "Selected period" },
  "db.legend.prev": { th: "ช่วงเดียวกันปีก่อน", en: "Same period last year" },
  "db.chart.readHint": { th: "เส้นประคือยอดช่วงเดียวกันของปีก่อน แท่งสูงกว่าเส้นแปลว่าใช้มากขึ้น", en: "The dashed line is the same period last year. A bar above it means more paper was used." },
  "db.legend.prevShort": { th: "ปีก่อน", en: "Last year" },
  "db.cmp.prevLabel": { th: "ช่วงเดียวกันปีก่อน", en: "Same period last year" },
  "db.reqUnit": { th: "คำขอ", en: "requests" },
  "db.kpi.rankOf": { th: "เทียบกับทุกหน่วยงานในช่วงนี้", en: "Among all units in this period" },
  "db.table.vsPrev": { th: "เทียบปีก่อน", en: "Vs last year" },
  "dashboard.dateMode.custom": { th: "กำหนดช่วงวันที่เอง", en: "Custom Date Range" },
  "dashboard.dateMode.clear": { th: "ล้าง", en: "Clear" },
  "dashboard.dateMode.rangeTo": { th: "ถึง", en: "to" },
  "dashboard.filter.period": { th: "ช่วงเวลา", en: "Period" },
  "export.excel": { th: "ส่งออก Excel", en: "Export to Excel" },
  "export.preparing": { th: "กำลังสร้างไฟล์…", en: "Building file…" },
  "export.failed": { th: "ส่งออกไม่สำเร็จ ลองใหม่", en: "Export failed, try again" },
  "filter.status": { th: "สถานะ", en: "Status" },
  "filter.unit": { th: "หน่วยงาน", en: "Department" },
  "filter.month": { th: "เดือน", en: "Month" },
  "filter.show": { th: "แสดง", en: "Show" },
  "filter.toggle": { th: "ตัวกรอง", en: "Filters" },
  "auditLog.filterHint": { th: "กรองตามหมวด ผู้แก้ไข การดำเนินการ หรือช่วงวันที่", en: "Filter by category, editor, action or date range" },
  "filter.actor": { th: "ผู้แก้ไข", en: "Edited by" },
  "filter.action": { th: "การดำเนินการ", en: "Action" },
  "filter.dateRange": { th: "ช่วงวันที่", en: "Date range" },



  "dashboard.documentTypeFilter": { th: "ประเภทเอกสาร", en: "Document Type" },
  "dashboard.documentTypeFilter.all": { th: "ทุกประเภทเอกสาร", en: "All document types" },
  "dashboard.documentTypeFilter.exam": { th: "ข้อสอบ", en: "Exam" },
  "dashboard.documentTypeFilter.general": { th: "เอกสารทั่วไป", en: "General Document" },

  "dashboard.paperSourceFilter": { th: "แหล่งที่มากระดาษ", en: "Paper Source" },
  "dashboard.paperSourceFilter.all": { th: "ทุกแหล่งที่มากระดาษ", en: "All paper sources" },
  "dashboard.paperSourceFilter.office": { th: "ฝ่ายทะเบียนจัดเตรียมให้", en: "Provided by Registrar Division" },
  "dashboard.paperSourceFilter.requester": { th: "ผู้ขอจัดเตรียมเอง", en: "Provided by Requester" },



  "dashboard.unitCategoryFilter.all": { th: "ทุกประเภทหน่วยงาน", en: "All unit types" },



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
  "evalReport.th.overall": { th: "คะแนนเฉลี่ย", en: "Average score" },
  "evalReport.likert.1": { th: "น้อยที่สุด", en: "Very dissatisfied" },
  "evalReport.likert.2": { th: "น้อย", en: "Dissatisfied" },
  "evalReport.likert.3": { th: "ปานกลาง", en: "Neutral" },
  "evalReport.likert.4": { th: "มาก", en: "Satisfied" },
  "evalReport.likert.5": { th: "มากที่สุด", en: "Very satisfied" },
  "evalReport.likertTip": { th: "{n} คน ({pct}%)", en: "{n} people ({pct}%)" },
  "evalReport.likertAria": { th: "พอใจมากถึงมากที่สุด {pct}%", en: "{pct}% satisfied or very satisfied" },
  "evalReport.likertLow": { th: "← ไม่พอใจ", en: "← Dissatisfied" },
  "evalReport.likertHigh": { th: "พอใจ →", en: "Satisfied →" },
  "evalReport.avgShort": { th: "เฉลี่ย", en: "Avg" },
  "evalReport.overallTitle": { th: "ความพึงพอใจเฉลี่ย", en: "Average satisfaction" },
  "evalReport.peopleCount": { th: "{n} คนประเมิน", en: "{n} people" },
  "evalReport.reach": { th: "{n} จาก {total} คน", en: "{n} of {total} people" },
  "evalReport.addedOn": { th: "เริ่มใช้ {date}", en: "Added {date}" },
  "evalReport.removedOn": { th: "ใช้ถึง {date}", en: "Used until {date}" },
  "evalReport.tier.excellent": { th: "ดีมาก", en: "Excellent" },
  "evalReport.tier.good": { th: "ดี", en: "Good" },
  "evalReport.tier.fair": { th: "พอใช้", en: "Fair" },
  "evalReport.tier.low": { th: "ควรปรับปรุง", en: "Needs improvement" },
  "evalReport.readAnswers": { th: "อ่านคำตอบ", en: "Read answers" },
  "evalReport.avgAll": { th: "เฉลี่ยทุกข้อ", en: "Average of all ratings" },
  "evalReport.resultsTitle": { th: "ผลการประเมินแยกตามหัวข้อ", en: "Results by section" },
  "evalReport.answerCount": { th: "{n} คำตอบ", en: "{n} answers" },
  "evalReport.textAnswers": { th: "มีผู้ตอบ {n} คน ดูข้อความได้ที่แท็บ “ค้นหา / รายการทั้งหมด”", en: "{n} answers. Read them in the “Search / All” tab." },
  "evalReport.removedOption": { th: "(ตัวเลือกที่ลบแล้ว)", en: "(removed choice)" },
  "evalReport.removedQuestions": { th: "คำถามที่ถูกลบจากแบบประเมินแล้ว ({n})", en: "Questions removed from the form ({n})" },
  "evalReport.th.comment": { th: "ความคิดเห็น", en: "Comment" },
  "evalReport.th.submitted": { th: "วันที่ประเมิน", en: "Submitted" },

  "evalReport.noComment": { th: "ไม่มีความคิดเห็น", en: "No comment" },
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
  return tLang(key, getLang());
}

/** t() for a specific language, regardless of the UI toggle. */
function tLang(key, lang) {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[lang] || entry.th;
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

  // Manual links (top-bar menu) open the manual in the page's language.
  document.querySelectorAll("a[data-manual]").forEach(function (el) {
    el.href = "/manual/" + el.getAttribute("data-manual") + "/" + (lang === "en" ? "en" : "th");
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
  "mail": `<svg ${SVG_ATTRS}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/></svg>`,
  "database": `<svg ${SVG_ATTRS}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  "book-open": `<svg ${SVG_ATTRS}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,

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
  // Preferences are scoped to the current login (data-nav-scope = the
  // session's login time), so each new login starts from the defaults —
  // e.g. an Admin always lands with only the admin section open — while
  // expanding/collapsing still sticks for the rest of that login.
  const sidebar = document.getElementById("app-sidebar");
  const scope = (sidebar && sidebar.getAttribute("data-nav-scope")) || "default";
  const prefix = "odprs.navCollapsed.";
  try {
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf(prefix) === 0 && k.indexOf(prefix + scope + ".") !== 0) localStorage.removeItem(k);
    });
  } catch (e) { /* storage unavailable: defaults only */ }

  // Accordion: at most one section is open at a time. Opening one (e.g.
  // "สำหรับผู้ดูแล") folds the others away; clicking the open one closes it.
  // Stored as the open section's name ("" = all closed).
  const sections = Array.prototype.slice.call(document.querySelectorAll(".nav-section"));
  if (sections.length === 0) return;
  const key = prefix + scope + ".open";
  const nameOf = function (s) { return s.getAttribute("data-nav-section"); };

  // Slides a section open/closed by animating its pixel height (CSS can't
  // transition to/from height:auto), then hands height back to CSS so the
  // open section can still grow/shrink, e.g. on a language switch.
  function fold(section, collapse, animate) {
    const items = section.querySelector(".nav-section-items");
    section.querySelector(".nav-section-label").setAttribute("aria-expanded", String(!collapse));
    if (section.classList.contains("collapsed") === collapse) return;
    clearTimeout(items._foldTimer);
    if (!animate) {
      // Page load: snap straight to the state, no slide on every navigation.
      items.style.transition = "none";
      items.style.height = "";
      section.classList.toggle("collapsed", collapse);
      void items.offsetHeight;
      items.style.transition = "";
      return;
    }
    // offsetHeight = the current on-screen height, so a click mid-slide
    // reverses smoothly from where it is.
    items.style.height = items.offsetHeight + "px";
    void items.offsetHeight; // commit the start height before changing it
    section.classList.toggle("collapsed", collapse);
    items.style.height = collapse ? "0px" : items.scrollHeight + "px";
    // A timer rather than transitionend: it also fires under
    // prefers-reduced-motion, where no transition runs at all.
    items._foldTimer = setTimeout(function () { items.style.height = ""; }, 300);
  }

  function setOpen(name, animate) {
    sections.forEach(function (s) { fold(s, nameOf(s) !== name, animate); });
    try { localStorage.setItem(key, name || ""); } catch (e) { /* ignore */ }
  }

  let saved = null;
  try { saved = localStorage.getItem(key); } catch (e) { /* ignore */ }
  // The current page's section always wins, so navigating never hides the
  // item you're on; otherwise the last choice, otherwise the first section
  // not marked data-default-collapsed (the admin section for an Admin).
  const active = sections.find(function (s) { return s.querySelector(".nav-item.active"); });
  const fallback = sections.find(function (s) { return !s.hasAttribute("data-default-collapsed"); }) || sections[0];
  setOpen(active ? nameOf(active) : (saved !== null ? saved : nameOf(fallback)));

  sections.forEach(function (section) {
    section.querySelector(".nav-section-label").addEventListener("click", function () {
      setOpen(section.classList.contains("collapsed") ? nameOf(section) : "", true);
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

/**
 * Warns before leaving a page with unsaved changes. Links inside the app
 * ask with the app's own dialog; reload / close tab / back get the
 * browser's prompt (its wording can't be changed).
 * isDirty: () => boolean. titleKey: i18n key for the dialog title.
 */
// Every field of a form as one string, to tell later whether anything changed:
//   const snap = formSnapshot(form); ... formSnapshot(form) !== snap
function formSnapshot(form) {
  return JSON.stringify(Array.from(form.querySelectorAll("input, select, textarea")).map(function (el) {
    return (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value;
  }));
}

function guardUnsavedChanges(isDirty, titleKey) {
  let leaving = false;
  document.addEventListener("click", function (e) {
    const link = e.target.closest("a[href]");
    if (!link || leaving || !isDirty()) return;
    if (link.target === "_blank" || link.hasAttribute("download") || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href)) return;
    e.preventDefault();
    showConfirmModal({
      title: t((typeof titleKey === "function" ? titleKey() : titleKey) || "unsaved.leaveTitle"),
      message: t("unsaved.leaveMessage"),
      confirmText: t("unsaved.leaveConfirm"),
      cancelText: t("unsaved.leaveStay"),
      danger: true,
      onConfirm: function () { leaving = true; window.location.href = link.href; }
    });
  }, true);
  window.addEventListener("beforeunload", function (e) {
    if (!leaving && isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });
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
     inline       true: the calendar is always shown in place (no toggle
                  button, no popup) — e.g. inside a dialog
   Returns { toggle, getDate, setDate, refresh } — refresh() redraws the
   grid after isSelectable's answers change.
   A native <input type="date"> can't grey out specific weekdays, which is
   why this exists at all: unselectable cells are rendered `disabled`.
   ===================================================================== */

const DATE_PICKER_WEEKDAYS = {
  th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
};

/* Keeps a just-opened dropdown popup (calendar, time wheel) fully on screen.
   It always opens downward (flipping it above the field read as "the
   calendar jumped up"); if it would run off the bottom, the page scrolls
   just enough to show all of it — above any sticky bottom bar (.savebar)
   too, which would otherwise cover the last rows. Only at the very end of
   the page, where scrolling can't make room, does it open upward instead
   (.open-up). Sideways, it's nudged back inside the viewport when the popup
   is wider than its field (calendar's min-width on a narrow field). */
function placePopup(panel, toggle) {
  const gap = 6;
  const margin = 12;
  panel.style.transform = "";
  const r = panel.getBoundingClientRect();
  const viewW = document.documentElement.clientWidth;
  let dx = 0;
  if (r.right > viewW - margin) dx = (viewW - margin) - r.right;
  if (r.left + dx < margin) dx = margin - r.left;
  if (dx) panel.style.transform = "translateX(" + Math.round(dx) + "px)";

  const bar = document.querySelector(".savebar");
  const reserved = bar && bar.offsetParent ? bar.offsetHeight + 16 : 0;
  const overflow = r.bottom + margin + reserved - window.innerHeight;
  if (overflow <= 0) return;
  const canScroll = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  if (canScroll < overflow && toggle.getBoundingClientRect().top - gap - margin >= r.height) {
    panel.classList.add("open-up");
    return;
  }
  window.scrollBy({ top: overflow, behavior: "smooth" });
}

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

  function position() { placePopup(panel, toggle); }

  function handleOutsideClick(e) {
    if (!root.contains(e.target)) close();
  }

  function handleEscKey(e) {
    if (e.key === "Escape") close();
  }

  function open() {
    if (opts.inline) return;
    renderGrid();
    panel.classList.remove("open-up");
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    position();
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEscKey);
  }

  function close() {
    if (opts.inline) return;
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
    if (!panel.hidden || opts.inline) renderGrid();
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
  if (opts.inline) {
    root.classList.add("is-inline");
    toggle.hidden = true;
    panel.hidden = false;
    renderGrid();
  }

  return {
    toggle: toggle,
    getDate: function () { return selectedDate; },
    setDate: setDate,
    refresh: renderGrid
  };
}

/* =====================================================================
   Time wheel — an iPhone-alarm style "HH : MM" picker (markup:
   partials/time-wheel.ejs). Two scroll-snapping columns; the row in the
   centre band is the value. Works with a mouse wheel / trackpad, touch
   swipe, clicking a number, or ↑/↓ on a focused column. Always 24-hour.
   opts: { value: "HH:MM", minuteStep: 5, onChange(value), inline }
   inline: true shows the wheels in place (no button, no popup, no "done")
   — e.g. inside a dialog; call refresh() once it is visible on screen.
   Returns { get(), set("HH:MM"), setDisabled(bool), refresh() }.
   ===================================================================== */
function createTimeWheel(root, opts) {
  opts = opts || {};
  const toggle = root.querySelector(".time-wheel-input");
  const label = root.querySelector(".time-wheel-label");
  const panel = root.querySelector(".time-wheel-panel");
  const hourCol = root.querySelector('.time-wheel-col[data-unit="h"]');
  const minuteCol = root.querySelector('.time-wheel-col[data-unit="m"]');
  const doneBtn = root.querySelector(".time-wheel-done");
  const ITEM_H = 40; // keep in sync with .time-wheel-item height in style.css
  const step = opts.minuteStep || 5;
  const pad = function (n) { return String(n).padStart(2, "0"); };

  let hours = [];
  for (let h = 0; h < 24; h++) hours.push(pad(h));
  let minutes = [];
  let value = "08:00";

  function buildMinutes(extra) {
    minutes = [];
    for (let m = 0; m < 60; m += step) minutes.push(pad(m));
    // Keep an off-grid saved minute (e.g. 08:17) selectable instead of rounding it.
    if (extra && minutes.indexOf(extra) === -1) { minutes.push(extra); minutes.sort(); }
  }

  function fill(col, list) {
    col.innerHTML = list.map(function (v, i) {
      return '<div class="time-wheel-item" role="option" data-index="' + i + '">' + v + "</div>";
    }).join("");
  }

  function indexIn(col) {
    const list = col === hourCol ? hours : minutes;
    return Math.max(0, Math.min(list.length - 1, Math.round(col.scrollTop / ITEM_H)));
  }

  function mark(col) {
    const idx = indexIn(col);
    col.querySelectorAll(".time-wheel-item").forEach(function (el, i) {
      el.classList.toggle("selected", i === idx);
      el.setAttribute("aria-selected", String(i === idx));
    });
  }

  function scrollToValue(smooth) {
    const [h, m] = value.split(":");
    [[hourCol, hours.indexOf(h)], [minuteCol, minutes.indexOf(m)]].forEach(function (pair) {
      pair[0].scrollTo({ top: Math.max(0, pair[1]) * ITEM_H, behavior: smooth ? "smooth" : "auto" });
      mark(pair[0]);
    });
  }

  function render() { label.textContent = value; }

  // Read the value off the wheels once a column stops moving.
  function commit() {
    const next = hours[indexIn(hourCol)] + ":" + minutes[indexIn(minuteCol)];
    mark(hourCol); mark(minuteCol);
    if (next === value) return;
    value = next;
    render();
    if (opts.onChange) opts.onChange(value);
  }

  [hourCol, minuteCol].forEach(function (col) {
    let settleTimer = null;
    col.addEventListener("scroll", function () {
      mark(col);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(commit, 120);
    });
    col.addEventListener("click", function (e) {
      const item = e.target.closest(".time-wheel-item");
      if (!item) return;
      col.scrollTo({ top: Number(item.getAttribute("data-index")) * ITEM_H, behavior: "smooth" });
    });
    col.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      col.scrollTo({ top: (indexIn(col) + (e.key === "ArrowDown" ? 1 : -1)) * ITEM_H, behavior: "smooth" });
    });
  });

  function handleOutsideClick(e) { if (!root.contains(e.target)) close(); }
  function handleKey(e) { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); close(); toggle.focus(); } }

  function open() {
    if (opts.inline) return;
    panel.classList.remove("open-up");
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    scrollToValue(false);
    placePopup(panel, toggle);
    hourCol.focus({ preventScroll: true });
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
  }

  function close() {
    if (opts.inline) { commit(); return; }
    if (panel.hidden) return;
    commit();
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", handleOutsideClick);
    document.removeEventListener("keydown", handleKey);
  }

  // No stopPropagation: the same click must still reach a calendar's
  // outside-click handler so an open calendar closes when this opens.
  toggle.addEventListener("click", function () {
    if (panel.hidden) open(); else close();
  });
  doneBtn.addEventListener("click", function () { close(); toggle.focus(); });

  function set(v) {
    value = /^\d{2}:\d{2}$/.test(v || "") ? v : "08:00";
    buildMinutes(value.split(":")[1]);
    fill(minuteCol, minutes);
    render();
    if (!panel.hidden) scrollToValue(false);
  }

  fill(hourCol, hours);
  if (opts.inline) {
    root.classList.add("is-inline");
    toggle.hidden = true;
    panel.hidden = false;
    const foot = root.querySelector(".time-wheel-foot");
    if (foot) foot.hidden = true;
  }
  set(opts.value);

  return {
    get: function () { return value; },
    set: set,
    setDisabled: function (disabled) {
      toggle.disabled = !!disabled;
      root.classList.toggle("is-disabled", !!disabled);
      [hourCol, minuteCol].forEach(function (col) { col.tabIndex = disabled ? -1 : 0; });
      if (disabled) close();
    },
    // Scroll the wheels to the current value (needed once an inline wheel
    // that was built while hidden becomes visible).
    refresh: function () { scrollToValue(false); }
  };
}

/* Floating manuals button (partials/header.ejs) + its sidebar dock.
   - Click: toggle the small menu. Drag (moved > 5px): move the button; on
     release it snaps to the nearer left/right edge, top kept on screen.
   - "Hide" moves it into the sidebar dock; "Show floating button" there
     brings it back. Position + hidden state are a per-browser convenience
     in localStorage (odprs_manualFab); everything still works without it. */
function initManualFab() {
  const fab = document.getElementById("manual-fab");
  const btn = document.getElementById("manual-fab-btn");
  const menu = document.getElementById("manual-fab-menu");
  if (!fab || !btn || !menu) return;
  const KEY = "odprs_manualFab";
  const MARGIN = 16;
  const HEADER_H = 64;

  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveState(patch) {
    const next = Object.assign(loadState(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* private mode etc. */ }
    return next;
  }

  // ---- position ----
  function clampTop(top) {
    const max = window.innerHeight - fab.offsetHeight - MARGIN;
    return Math.max(HEADER_H + MARGIN, Math.min(max, top));
  }
  function applyPosition(state) {
    if (state.side !== "left" && state.side !== "right") return; // default CSS spot
    fab.style.bottom = "auto";
    fab.style.top = clampTop(state.top) + "px";
    fab.style.left = state.side === "left" ? MARGIN + "px" : "auto";
    fab.style.right = state.side === "right" ? MARGIN + "px" : "auto";
  }
  function syncMenuDirection() {
    const rect = fab.getBoundingClientRect();
    fab.classList.toggle("opens-down", rect.top < window.innerHeight / 2);
    fab.classList.toggle("on-left", rect.left + rect.width / 2 < window.innerWidth / 2);
  }

  // ---- menu ----
  function setOpen(open) {
    if (open) syncMenuDirection();
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("click", function (e) { if (!menu.hidden && !e.target.closest("#manual-fab")) setOpen(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); } });

  // ---- drag vs click ----
  let drag = null;
  btn.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    if (!drag.moved) { drag.moved = true; setOpen(false); fab.classList.add("is-dragging"); fab.classList.remove("is-snapping"); }
    const left = Math.max(0, Math.min(window.innerWidth - fab.offsetWidth, e.clientX - drag.dx));
    const top = Math.max(0, Math.min(window.innerHeight - fab.offsetHeight, e.clientY - drag.dy));
    fab.style.left = left + "px";
    fab.style.top = top + "px";
    fab.style.right = "auto";
    fab.style.bottom = "auto";
  });
  function endDrag(e) {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    if (!wasDrag) { if (e.type === "pointerup") setOpen(menu.hidden); return; }
    fab.classList.remove("is-dragging");
    const rect = fab.getBoundingClientRect();
    const side = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
    fab.classList.add("is-snapping");
    // Snap: switch from the free left offset to the chosen edge.
    if (side === "left") { fab.style.left = MARGIN + "px"; fab.style.right = "auto"; }
    else { fab.style.left = (window.innerWidth - fab.offsetWidth - MARGIN) + "px"; }
    const top = clampTop(rect.top);
    fab.style.top = top + "px";
    setTimeout(function () {
      fab.classList.remove("is-snapping");
      applyPosition(saveState({ side: side, top: top }));
    }, 220);
  }
  btn.addEventListener("pointerup", endDrag);
  btn.addEventListener("pointercancel", endDrag);
  // Keyboard users: Enter/Space fire "click" without pointer events.
  btn.addEventListener("click", function (e) { if (e.detail === 0) setOpen(menu.hidden); });

  window.addEventListener("resize", function () { applyPosition(loadState()); });

  // ---- hide into the sidebar / show again ----
  const dockBtn = document.getElementById("nav-manual-dock-btn");
  const dockPop = document.getElementById("manual-dock-pop");
  function setDockOpen(open) {
    if (!dockBtn || !dockPop) return;
    if (open) {
      // Beside the dock row, bottoms aligned; kept inside the window.
      dockPop.hidden = false;
      const r = dockBtn.getBoundingClientRect();
      const w = dockPop.offsetWidth, h = dockPop.offsetHeight;
      const left = Math.min(r.right + 8, window.innerWidth - w - 8);
      const top = Math.max(8, Math.min(r.bottom - h, window.innerHeight - h - 8));
      dockPop.style.left = Math.max(8, left) + "px";
      dockPop.style.top = top + "px";
    } else {
      dockPop.hidden = true;
    }
    dockBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function setDocked(docked) {
    document.documentElement.classList.toggle("manual-fab-docked", docked);
    saveState({ hidden: docked });
    setOpen(false);
    setDockOpen(false);
  }
  const hideBtn = document.getElementById("manual-fab-hide");
  if (hideBtn) hideBtn.addEventListener("click", function () { setDocked(true); });
  const showBtn = document.getElementById("manual-dock-show");
  if (showBtn) showBtn.addEventListener("click", function () { setDocked(false); });
  if (dockBtn && dockPop) {
    dockBtn.addEventListener("click", function (e) { e.stopPropagation(); setDockOpen(dockPop.hidden); });
    dockPop.addEventListener("click", function (e) { if (e.target.closest("a")) setDockOpen(false); });
    document.addEventListener("click", function (e) { if (!dockPop.hidden && !e.target.closest("#manual-dock-pop")) setDockOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !dockPop.hidden) { setDockOpen(false); dockBtn.focus(); } });
    window.addEventListener("resize", function () { setDockOpen(false); });
    const sidebarEl = document.getElementById("app-sidebar");
    if (sidebarEl) sidebarEl.addEventListener("scroll", function () { setDockOpen(false); });
  }

  const state = loadState();
  document.documentElement.classList.toggle("manual-fab-docked", !!state.hidden);
  applyPosition(state);
}
document.addEventListener("DOMContentLoaded", initManualFab);

/* =====================================================================
   Collapsible filter panels (history, dashboard, evaluations, audit log).
   Markup: a .filter-toggle button (aria-controls = the body) holding a
   .filter-toggle-count badge, and a .filter-collapse body wrapping a
   .filter-collapse-inner. Closed by default; open/closed is remembered per
   page in this browser. The badge shows how many filters are on (count()),
   so a closed panel never hides that the data is filtered.
   initFilterCollapse({ toggle, body, badge, key, count }) → { sync, open }
   ===================================================================== */
function initFilterCollapse(opts) {
  const toggle = document.getElementById(opts.toggle);
  const body = document.getElementById(opts.body);
  const badge = document.getElementById(opts.badge);
  if (!toggle || !body) return { sync: function () {}, open: function () {} };
  const key = "odprs_filters_open." + opts.key;

  function setOpen(open, save) {
    body.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (save) { try { localStorage.setItem(key, open ? "1" : "0"); } catch (e) { /* private mode etc. */ } }
  }
  function sync() {
    if (!badge) return;
    const n = opts.count ? opts.count() : 0;
    badge.textContent = n;
    badge.hidden = n === 0;
  }
  toggle.addEventListener("click", function () { setOpen(!body.classList.contains("is-open"), true); });
  // After the page's own handlers (e.g. a "clear" button) have run.
  ["change", "input", "click"].forEach(function (ev) {
    body.addEventListener(ev, function () { setTimeout(sync, 0); });
  });

  let startOpen = false;
  try { startOpen = localStorage.getItem(key) === "1"; } catch (e) { /* ignore */ }
  setOpen(startOpen, false);
  sync();
  return { sync: sync, open: function () { setOpen(true, true); } };
}

/* ---------- Tidy dropdowns for every <select> ----------
   Each <select> on a page is upgraded in place: the select stays in the
   page (visually hidden) and keeps working as the source of truth, so page
   scripts still read/set .value, fill options and listen for "change".
   A button shows the chosen option and opens a panel:
     - a grid of equal tiles when the choices are short (years, months),
     - otherwise a list with a check on the chosen row, a search box when
       there are many, and optgroup headings.
   The panel is position:fixed, so dialogs and scroll boxes never clip it,
   and it opens upwards when there is no room below.
   Opt out with data-native on the <select>; force a grid with
   data-dd-cols="N" or a list with data-dd-cols="0". */
(function () {
  let openPanel = null;
  const SEARCH_FROM = 15;

  function labelOf(opt) { return (opt.textContent || "").replace(/\s+/g, " ").trim(); }

  function enhance(sel) {
    if (sel.__dd || sel.multiple || sel.hasAttribute("data-native") || Number(sel.getAttribute("size")) > 1) return;
    const wrap = document.createElement("div");
    wrap.className = "dd dd-auto";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn " + (sel.className || "") + (sel.closest(".field") && !sel.classList.contains("toolbar-select") ? " dd-field" : "");
    // keep the look of an inline-styled select, but never its show/hide
    if (sel.getAttribute("style")) { btn.setAttribute("style", sel.getAttribute("style")); btn.style.display = ""; }
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="dd-value"></span><span class="icon dd-chevron">' + (ICONS["chevron-down"] || "") + "</span>";
    const panel = document.createElement("div");
    panel.className = "dd-panel dd-fixed";
    panel.hidden = true;
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(sel);
    document.body.appendChild(panel);
    sel.classList.add("dd-native");
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    // label the button like the select was labelled
    const aria = sel.getAttribute("aria-label") || (sel.id && document.querySelector('label[for="' + sel.id + '"]') ? document.querySelector('label[for="' + sel.id + '"]').textContent.trim() : "");
    if (aria) btn.setAttribute("aria-label", aria);

    function sync() {
      const opt = sel.options[sel.selectedIndex];
      const text = opt ? labelOf(opt) : (sel.options.length ? t("dd.choose") : "");
      btn.querySelector(".dd-value").textContent = text;
      btn.title = text.length > 24 ? text : "";
      btn.disabled = sel.disabled;
      btn.classList.toggle("is-placeholder", !opt || (opt.value === "" && sel.required));
      // follow the select's own visibility (some pages hide it with style/hidden)
      const hidden = sel.hidden || sel.style.display === "none";
      wrap.hidden = hidden;
      if (!panel.hidden && (hidden || sel.disabled)) close();
    }

    function layout() {
      const opts = Array.from(sel.options).filter((o) => !o.hidden);
      const real = opts.filter((o) => o.value !== "");
      const forced = sel.getAttribute("data-dd-cols");
      if (forced != null) return Number(forced) || 0;
      if (sel.querySelector("optgroup") || real.length < 5) return 0;
      if (real.every((o) => labelOf(o).length <= 9)) return real.length === 12 ? 3 : 4;
      return 0;
    }

    function place() {
      const r = btn.getBoundingClientRect();
      const below = innerHeight - r.bottom - 12, above = r.top - 12;
      const up = below < 220 && above > below;
      const room = Math.max(160, Math.min(400, up ? above : below));
      panel.style.maxHeight = room + "px";
      panel.style.minWidth = r.width + "px";
      panel.style.top = "0px"; panel.style.left = "0px";
      const w = panel.offsetWidth, h = panel.offsetHeight;
      let left = Math.min(r.left, innerWidth - 8 - w);
      left = Math.max(8, left);
      panel.style.left = left + "px";
      panel.style.top = (up ? r.top - 6 - h : r.bottom + 6) + "px";
    }

    function render(filter) {
      const cols = layout();
      const q = (filter || "").toLowerCase().replace(/\s+/g, "");
      const cur = sel.selectedIndex;
      let html = "";
      let lastGroup = null;
      Array.from(sel.options).forEach((o, i) => {
        if (o.hidden) return;
        const text = labelOf(o);
        if (q && !text.toLowerCase().replace(/\s+/g, "").includes(q)) return;
        const g = o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
        if (!cols && g && g !== lastGroup) { html += '<div class="dd-group">' + escapeHtml(g) + "</div>"; }
        lastGroup = g;
        const selected = i === cur;
        const wide = cols && o.value === "";
        html += '<button type="button" class="dd-opt' + (selected ? " is-selected" : "") + (wide ? " is-wide" : "") + '" role="option" aria-selected="' + selected + '" data-i="' + i + '"' + (o.disabled ? " disabled" : "") + ">" +
          (cols ? "" : '<span class="dd-check" aria-hidden="true">✓</span>') + '<span class="dd-label">' + escapeHtml(text) + "</span></button>";
      });
      if (!html) html = '<div class="dd-empty">' + escapeHtml(t("dd.none")) + "</div>";
      return { cols, html: '<div class="' + (cols ? "dd-grid" : "dd-list") + '" role="listbox"' + (cols ? ' style="--cols:' + cols + '"' : "") + ">" + html + "</div>" };
    }

    function bindOptions() {
      panel.querySelectorAll(".dd-opt").forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i)));
    }

    function open() {
      if (sel.disabled) return;
      if (openPanel) openPanel.close();
      const many = sel.options.length > SEARCH_FROM && !layout();
      const r = render("");
      panel.classList.toggle("is-grid", !!r.cols);
      panel.innerHTML = (many ? '<input type="text" class="dd-search" autocomplete="off" placeholder="' + escapeHtml(t("dd.search")) + '">' : "") + '<div class="dd-body">' + r.html + "</div>";
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      openPanel = api;
      bindOptions();
      place();
      const search = panel.querySelector(".dd-search");
      if (search) {
        search.addEventListener("input", () => { panel.querySelector(".dd-body").innerHTML = render(search.value).html; bindOptions(); });
        search.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); const f = panel.querySelector(".dd-opt:not(:disabled)"); if (f) f.focus(); }
          else if (e.key === "Enter") { e.preventDefault(); const f = panel.querySelector(".dd-opt:not(:disabled)"); if (f) f.click(); }
        });
        search.focus();
      }
      const chosen = panel.querySelector(".dd-opt.is-selected:not(:disabled)") || panel.querySelector(".dd-opt:not(:disabled)");
      if (chosen) { chosen.scrollIntoView({ block: "nearest" }); if (!search) chosen.focus(); }
    }

    function close(focus) {
      if (panel.hidden) return;
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (openPanel === api) openPanel = null;
      if (focus) btn.focus();
    }

    function choose(i) {
      close(true);
      if (i === sel.selectedIndex) return;
      sel.selectedIndex = i;
      sync();
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }

    btn.addEventListener("click", () => (panel.hidden ? open() : close()));
    btn.addEventListener("keydown", (e) => {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && panel.hidden) { e.preventDefault(); open(); }
    });
    panel.addEventListener("keydown", (e) => {
      const opts = Array.from(panel.querySelectorAll(".dd-opt:not(:disabled)"));
      const i = opts.indexOf(document.activeElement);
      const cols = panel.classList.contains("is-grid") ? Number((panel.querySelector(".dd-grid") || {}).style.getPropertyValue("--cols")) || 4 : 1;
      const grid = cols > 1;
      const move = { ArrowRight: grid ? 1 : 0, ArrowLeft: grid ? -1 : 0, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") close();
      else if (move && (i >= 0 || e.target.classList.contains("dd-search"))) {
        if (e.target.classList.contains("dd-search")) return;
        e.preventDefault();
        if (i + move < 0 && panel.querySelector(".dd-search")) { panel.querySelector(".dd-search").focus(); return; }
        const n = opts[Math.min(opts.length - 1, Math.max(0, i + move))];
        if (n) n.focus();
      }
    });
    sel.addEventListener("change", sync);
    // pages that focus a select to point at an error land on the button
    sel.addEventListener("focus", () => btn.focus());
    // the browser points at the select when a required one is empty
    sel.addEventListener("invalid", () => btn.classList.add("is-invalid"));
    sel.addEventListener("change", () => btn.classList.remove("is-invalid"));

    // page scripts set .value / .selectedIndex directly: keep the button in step
    ["value", "selectedIndex"].forEach((prop) => {
      const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
      Object.defineProperty(sel, prop, { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
    });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ["disabled", "hidden", "style", "selected", "label"] });
    const form = sel.form;
    if (form) form.addEventListener("reset", () => setTimeout(sync, 0));

    const api = { close, open, sync, place, panel, wrap };
    sel.__dd = api;
    sync();
    return api;
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll("select").forEach(enhance);
  }
  window.enhanceSelect = enhance;

  document.addEventListener("mousedown", (e) => {
    if (openPanel && !openPanel.panel.contains(e.target) && !openPanel.wrap.contains(e.target)) openPanel.close();
  });
  // follow the button while the page scrolls; a resize just closes it
  window.addEventListener("scroll", (e) => {
    if (!openPanel) return;
    if (openPanel.panel.contains(e.target)) return;
    const r = openPanel.wrap.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) openPanel.close(); else openPanel.place();
  }, true);
  window.addEventListener("resize", () => { if (openPanel) openPanel.close(); });
  document.addEventListener("odprs:langchange", () => {
    document.querySelectorAll("select").forEach((s) => { if (s.__dd) s.__dd.sync(); });
    if (openPanel) openPanel.close();
  });

  document.addEventListener("DOMContentLoaded", () => {
    enhanceAll();
    // selects added later (dialogs, re-rendered forms)
    new MutationObserver((list) => {
      list.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === "SELECT") enhance(n); else if (n.querySelector) enhanceAll(n);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
