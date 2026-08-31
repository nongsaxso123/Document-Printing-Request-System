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

function formatDropoffLabel(info, lang) {
  const dateStr = formatDate(info.date, lang);
  if (lang === "en") {
    return info.sameDay
      ? `Today (${dateStr}), before 15:00`
      : `${dateStr}, during business hours 09:00-15:00`;
  }
  return info.sameDay
    ? `วันนี้ (${dateStr}) ก่อนเวลา 15:00 น.`
    : `${dateStr} ในเวลาทำการ 09:00–15:00 น.`;
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
  "nav.section.admin": { th: "สำหรับผู้ดูแลระบบ", en: "For Admin" },
  "nav.adminOfficers": { th: "จัดการบัญชีเจ้าหน้าที่", en: "Officer Accounts" },

  "crumb.myRequests": { th: "คำขอของฉัน / <strong>ภาพรวม</strong>", en: "My Requests / <strong>Overview</strong>" },
  "crumb.newRequest": { th: "สร้างคำขอพิมพ์เอกสาร / <strong>กรอกแบบฟอร์ม</strong>", en: "New Print Request / <strong>Fill Form</strong>" },
  "crumb.submitted": { th: "สร้างคำขอพิมพ์เอกสาร / <strong>ส่งคำขอสำเร็จ</strong>", en: "New Print Request / <strong>Submitted</strong>" },

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

  "newRequest.title": { th: "สร้างคำขอพิมพ์เอกสาร", en: "New Print Request" },
  "newRequest.subtitle": { th: "กรอกรายละเอียดคำขอพิมพ์เอกสาร — ระบบจะยังไม่มีการแนบไฟล์ในขั้นตอนนี้", en: "Fill in your print request details — no file attachment is needed at this step." },
  "newRequest.notice.title": { th: "ไม่ต้องแนบไฟล์เอกสาร", en: "No file attachment required" },
  "newRequest.notice.body": { th: "หลังส่งคำขอสำเร็จ ระบบจะออกใบคำขอให้พิมพ์ และแจ้งกำหนดเวลาที่ต้อง<strong>นำเอกสารต้นฉบับมาส่งด้วยตัวเอง</strong>ที่เคาน์เตอร์ฝ่ายทะเบียน", en: "Once submitted, the system will generate a printable Request Form and tell you the deadline to <strong>hand-deliver the physical original documents</strong> to the Registrar counter." },
  "newRequest.cardTitle.requester": { th: "ข้อมูลผู้ขอ", en: "Requester Information" },
  "newRequest.cardTitle.printJob": { th: "รายละเอียดงานพิมพ์", en: "Print Job Details" },
  "newRequest.error.dateTooSoon": { th: "วันที่เลือกไม่ถูกต้อง", en: "Invalid completion date" },
  "newRequest.error.missingField": { th: "กรอกข้อมูลไม่ครบ", en: "Missing required fields" },
  "newRequest.error.missingField.body": { th: "กรุณาเลือกโหมดสี รูปแบบการพิมพ์ ประเภทเอกสาร และผู้จัดเตรียมกระดาษ (ถ้าเป็นข้อสอบ) ให้ครบก่อนส่งคำขอ", en: "Please choose Color Mode, Print Side, Document Type, and Paper Source (if Exam) before submitting." },

  "field.requesterName": { th: "ชื่อผู้ขอ *", en: "Requester Name *" },
  "field.requesterName.hint": { th: "ดึงจากบัญชีที่ล็อกอินให้อัตโนมัติ แก้ไขได้ เช่น เพิ่มคำนำหน้า/ยศ หรือแก้ให้ตรงกับชื่อจริง", en: "Auto-filled from your login account — you may edit it, e.g. to add a title or correct your real name." },
  "field.tel": { th: "เบอร์โทรศัพท์ *", en: "Phone Number *" },
  "field.tel.placeholder": { th: "08X-XXX-XXXX", en: "08X-XXX-XXXX" },
  "field.tel.hint": { th: "ใช้เบอร์มือถือส่วนตัวหรือเบอร์สำนักงานก็ได้", en: "A personal mobile number or an office/workplace number" },
  "field.agencyCategory": { th: "ประเภทหน่วยงาน *", en: "Agency Category *" },
  "field.agencyUnit": { th: "หน่วยงาน *", en: "Agency/Unit *" },
  "field.agencyUnit.placeholder": { th: "พิมพ์ชื่อหน่วยงาน", en: "Type the agency/unit name" },
  "field.paperSize": { th: "ขนาดกระดาษ *", en: "Paper Size *" },
  "field.paperSize.other.placeholder": { th: "ระบุขนาดกระดาษ เช่น B5, Letter, F4", en: "Specify paper size, e.g. B5, Letter, F4" },
  "field.finishingMethod": { th: "งานตกแต่ง / การเข้าเล่ม", en: "Finishing / Binding" },
  "field.itemList": { th: "รายการเอกสารที่ต้องการพิมพ์ *", en: "Items to be Printed *" },
  "field.itemList.placeholder": { th: "เช่น เอกสารประมวลรายวิชา บทที่ 1-5, ใบปะหน้า", en: "e.g. Course syllabus chapters 1-5, cover sheet" },
  "field.originalPages": { th: "จำนวนหน้าต้นฉบับ *", en: "Original Page Count *" },
  "field.copies": { th: "จำนวนชุดที่ต้องการ *", en: "Number of Copies *" },
  "field.copies.maxError": { th: "จำนวนชุดต้องไม่เกิน 999 ชุด", en: "Number of copies cannot exceed 999." },
  "field.completionDate": { th: "วันที่ต้องการรับเอกสาร *", en: "Requested Completion Date *" },
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
  "field.finishingMethod.examLocked": { th: "ข้อสอบเลือกได้เฉพาะ \"ไม่ต้องการ\" หรือ \"เย็บมุม\" เท่านั้น — ตัวเลือกอื่นถูกปิดไว้", en: "Exams may only use \"None\" or \"Corner Staple\" — other options are disabled." },
  "field.finishingMethod.saddleStitchForcesDouble": { th: "เย็บมุงหลังคาต้องพิมพ์สองหน้า ระบบเปลี่ยนรูปแบบการพิมพ์ให้อัตโนมัติ", en: "Saddle-stitch requires double-sided printing — Print Side was switched automatically." },
  "field.finishingMethod.pageCount.saddleStitch": { th: "เย็บมุงหลังคา: จำนวนหน้าต้นฉบับต้องหารด้วย 4 ลงตัว และไม่เกิน 60 หน้า", en: "Saddle-stitch: original page count must be a multiple of 4, up to 60 pages." },
  "field.finishingMethod.pageCount.glue": { th: "เข้าเล่มสันกาว: จำนวนหน้าต้นฉบับต้องมีอย่างน้อย 20 หน้า เพื่อให้มีสันพอให้กาวยึด", en: "Glue binding: needs at least 20 original pages for the spine to hold." },
  "field.finishingMethod.pageCount.corner": { th: "เย็บมุม: จำนวนหน้าต้นฉบับต้องไม่เกิน 80 หน้า มิฉะนั้นลวดเย็บจะกดไม่ทะลุ", en: "Corner staple: original page count must not exceed 80 pages, or a standard stapler can't punch through." },

  "field.colorMode": { th: "โหมดสี *", en: "Color Mode *" },
  "field.printSide": { th: "รูปแบบการพิมพ์ (หน้า) *", en: "Print Side *" },
  "field.documentType": { th: "ประเภทเอกสาร *", en: "Document Type *" },
  "field.documentType.hint": { th: "คำขอนี้ต้องเป็นข้อสอบหรือเอกสารทั่วไปอย่างใดอย่างหนึ่งเท่านั้น หากมีทั้งสองประเภทต้องแยกส่งคนละคำขอ", en: "A request must be either Exam or General Document, not a mix — submit a separate request if you have both." },
  "field.paperSource": { th: "ผู้จัดเตรียมกระดาษ *", en: "Paper Source *" },
  "field.paperSource.fixedNotice": { th: "เอกสารทั่วไป: ผู้ขอเป็นผู้จัดเตรียมกระดาษเอง (Requester-provided) — ไม่มีตัวเลือกอื่น", en: "General Document: paper is always Requester-provided — no choice offered." },
  "field.paperSource.selectDocTypeFirst": { th: "เลือกประเภทเอกสารก่อน", en: "Select a Document Type first" },
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

  "newRequest.calc.title": { th: "สรุปจำนวนกระดาษที่ต้องใช้", en: "Paper Usage Summary" },
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
  "option.finishing.corner": { th: "เย็บมุม", en: "Corner Stapling" },
  "option.finishing.hole": { th: "เจาะรู", en: "Hole Punch" },

  "btn.cancel": { th: "ยกเลิก", en: "Cancel" },
  "btn.submit": { th: "ส่งคำขอ", en: "Submit Request" },

  "submitted.title": { th: "ส่งคำขอสำเร็จ", en: "Request Submitted" },
  "submitted.subtitle": { th: "กรุณาพิมพ์ใบคำขอด้านล่างและนำไปพร้อมกับเอกสารต้นฉบับ", en: "Please print the Request Form below and bring it together with the physical original documents." },
  "submitted.deadline.label": { th: "นำเอกสารต้นฉบับมาส่งภายใน:", en: "Deliver the physical original documents by:" },
  "submitted.deadline.body": { th: "หากไม่นำมาส่งภายในกำหนด คำขอจะยังคงค้างสถานะ \"รอส่งเอกสารต้นฉบับ\" — กรุณาติดต่อเจ้าหน้าที่หากมีปัญหา", en: "If not delivered by the deadline, the request simply stays in \"Awaiting Original Document\" status — please contact an Officer if there's an issue." },
  "submitted.formCardTitle": { th: "ใบคำขอพิมพ์เอกสาร (สำหรับพิมพ์)", en: "Print Request Form (Printable)" },
  "submitted.printBtn": { th: "พิมพ์ใบคำขอ", en: "Print Request Form" },
  "submitted.downloadPdfBtn": { th: "ดาวน์โหลด PDF", en: "Download PDF" },
  "submitted.formHeading": { th: "ใบคำขอพิมพ์เอกสาร — ODPRS", en: "Print Request Form — ODPRS" },
  "submitted.formSub": { th: "ฝ่ายทะเบียน มหาวิทยาลัยแม่ฟ้าหลวง", en: "Registrar Division, Mae Fah Luang University" },
  "submitted.newBtn": { th: "สร้างคำขอใหม่", en: "Create New Request" },
  "submitted.goToMyRequests": { th: "ไปที่คำขอของฉัน", en: "Go to My Requests" },

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
  "summary.completion": { th: "วันที่ต้องการรับเอกสาร", en: "Requested Completion Date" },
  "summary.deadline": { th: "กำหนดส่งเอกสารต้นฉบับ", en: "Original Document Deadline" },
  "summary.status": { th: "สถานะ", en: "Status" },

  "crumb.officerQueue": { th: "คิวรอเอกสารต้นฉบับ / <strong>ภาพรวม</strong>", en: "Awaiting Original Queue / <strong>Overview</strong>" },
  "crumb.requestDetail": { th: "คิวรอเอกสารต้นฉบับ / <strong>รายละเอียดคำขอ</strong>", en: "Awaiting Original Queue / <strong>Request Detail</strong>" },
  "crumb.printingJobs": { th: "งานที่กำลังปริ้น / <strong>ภาพรวม</strong>", en: "Printing Jobs / <strong>Overview</strong>" },
  "crumb.counterHandover": { th: "จุดส่งมอบเอกสาร / <strong>ยืนยันตัวตนผู้รับ</strong>", en: "Counter Handover / <strong>Verify Receiver</strong>" },

  "officerQueue.title": { th: "คิวรอเอกสารต้นฉบับ", en: "Awaiting Original Queue" },
  "officerQueue.subtitle": { th: "รายการคำขอที่รอผู้ขอนำเอกสารต้นฉบับมาส่งที่เคาน์เตอร์", en: "Requests waiting for the Requester to hand-deliver the physical original documents." },
  "officerQueue.filterLabel": { th: "แสดงเฉพาะที่เลยกำหนดส่ง (ค้าง)", en: "Show only overdue" },
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
  "detail.specTitle": { th: "รายละเอียดคำขอที่ผู้ขอส่งไว้ในระบบ", en: "Specification Submitted by the Requester" },
  "detail.compareNotice": { th: "เทียบรายการด้านล่างกับเอกสารต้นฉบับและใบคำขอที่ผู้ขอนำมาส่งจริงที่เคาน์เตอร์", en: "Compare the details below against the physical original documents and Request Form the Requester brought to the counter." },
  "detail.approveTitle": { th: "อนุมัติและรับต้นฉบับ", en: "Approve and Receive Master" },
  "detail.approveHint": { th: "ยืนยันหรือปรับวันที่รับเอกสารจริง ระบบจะออก RUN NUMBER และ Claim Code ทันที", en: "Confirm or adjust the actual completion date. The system will immediately issue a RUN NUMBER and Claim Code." },
  "detail.confirmDateLabel": { th: "วันที่รับเอกสารจริง (ยืนยัน/ปรับ)", en: "Confirmed Completion Date" },
  "detail.approveBtn": { th: "อนุมัติและรับต้นฉบับ", en: "Approve and Receive Master" },
  "detail.rejectTitle": { th: "ปฏิเสธคำขอ", en: "Reject Request" },
  "detail.rejectHint": { th: "ใช้เมื่อเอกสารต้นฉบับไม่ตรงกับสเปกที่ยื่นไว้ในระบบ", en: "Use this when the physical originals do not match the submitted specification." },
  "detail.rejectReasonLabel": { th: "เหตุผลที่ปฏิเสธ *", en: "Rejection Reason *" },
  "detail.rejectReasonPlaceholder": { th: "เช่น จำนวนหน้าต้นฉบับไม่ตรงกับที่ระบุไว้", en: "e.g. Original page count does not match what was submitted" },
  "detail.rejectReasonRequired": { th: "กรุณาระบุเหตุผลที่ปฏิเสธ", en: "Please provide a rejection reason." },
  "detail.rejectBtn": { th: "ปฏิเสธคำขอ", en: "Reject Request" },
  "detail.approvedNotice": { th: "อนุมัติคำขอเรียบร้อย — RUN NUMBER และ Claim Code ด้านล่างนี้ (ระบบจริงจะส่งอีเมลนี้ให้ผู้ขอทันที)", en: "Request approved — the RUN NUMBER and Claim Code below (the real system would email these to the Requester immediately)" },
  "detail.rejectedNotice": { th: "ปฏิเสธคำขอเรียบร้อย (ระบบจริงจะส่งอีเมลแจ้งเหตุผลให้ผู้ขอทันที)", en: "Request rejected (the real system would email the reason to the Requester immediately)" },
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
  "printingJobs.th.completion": { th: "วันนัดรับ (ยืนยันแล้ว)", en: "Confirmed Completion Date" },
  "printingJobs.th.action": { th: "การดำเนินการ", en: "Action" },
  "printingJobs.markReady": { th: "ทำเครื่องหมายพร้อมส่งมอบ", en: "Mark Ready for Pickup" },

  "handover.title": { th: "จุดส่งมอบเอกสาร", en: "Counter Handover" },
  "handover.subtitle": { th: "ตรวจสอบ Claim Code และบันทึกข้อมูลผู้รับก่อนยืนยันส่งมอบ", en: "Verify the Claim Code and record the Receiver's info before confirming handover." },
  "handover.searchTitle": { th: "ค้นหาด้วย Claim Code", en: "Look Up by Claim Code" },
  "handover.claimCodeLabel": { th: "Claim Code (6 หลัก)", en: "Claim Code (6 digits)" },
  "handover.searchBtn": { th: "ค้นหา", en: "Search" },
  "handover.notFound": { th: "ไม่พบคำขอที่ตรงกับรหัสนี้ หรือคำขอยังไม่พร้อมส่งมอบ กรุณาตรวจสอบ Claim Code อีกครั้ง", en: "No request matches this code, or it isn't ready for pickup yet. Please check the Claim Code again." },
  "handover.matchTitle": { th: "พบคำขอที่ตรงกัน — บันทึกข้อมูลผู้รับก่อนส่งมอบ", en: "Match found — record Receiver info before handover" },
  "handover.sameAsRequesterBtn": { th: "ผู้รับคือผู้ขอเอง (กรอกให้อัตโนมัติ)", en: "Receiver is the Requester (autofill)" },
  "handover.receiverInfo.hint": { th: "ข้อมูลนี้เป็นบันทึกความรับผิดชอบว่าใครเป็นผู้รับเอกสาร ไม่ใช่การตรวจสอบยืนยันตัวตน — ไม่ต้องตรวจบัตรประชาชน", en: "This is an accountability record of who collected the documents, not an identity check — no physical ID is inspected." },
  "handover.receiverName": { th: "ชื่อผู้รับ *", en: "Receiver Name *" },
  "handover.receiverPosition": { th: "ตำแหน่ง (หน้าที่ในที่ทำงาน) *", en: "Position (Job Role) *" },
  "handover.receiverWorkplace": { th: "ที่ทำงาน *", en: "Workplace *" },
  "handover.receiverWorkPhone": { th: "เบอร์โทรศัพท์ที่ทำงาน *", en: "Work Phone Number *" },
  "handover.receiverName.required": { th: "กรุณากรอกชื่อผู้รับ", en: "Please enter the receiver's name." },
  "handover.receiverPosition.required": { th: "กรุณากรอกตำแหน่งผู้รับ", en: "Please enter the receiver's position." },
  "handover.receiverWorkplace.required": { th: "กรุณากรอกที่ทำงานของผู้รับ", en: "Please enter the receiver's workplace." },
  "handover.receiverWorkPhone.required": { th: "กรุณากรอกเบอร์โทรศัพท์ที่ทำงาน", en: "Please enter the receiver's work phone number." },
  "handover.confirmBtn": { th: "ยืนยันส่งมอบ", en: "Confirm Handover" },
  "handover.successNotice": { th: "ส่งมอบเอกสารสำเร็จ — บันทึกผู้ขอ+เจ้าหน้าที่+ผู้รับ+เวลาไว้ในระบบแล้ว", en: "Handover completed — Requester + Officer + Receiver + timestamp have been recorded." },
  "handover.searchAgain": { th: "ค้นหารายการถัดไป", en: "Look Up Next Request" },

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
  "user.logoutModalTitle": { th: "ยืนยันการออกจากระบบ", en: "Confirm Logout"},
  "user.logoutModalMessage": { th: "คุณต้องการที่จะออกจากระบบใช่ไหม?"}, en: "Are you sure you want to log out?",
  "user.logoutBtn": { th: "ออกจากระบบ", en: "Log out"},
  "crumb.admin": { th: "จัดการบัญชีเจ้าหน้าที่ / <strong>ภาพรวม</strong>", en: "Officer Accounts / <strong>Overview</strong>" },

  "admin.title": { th: "จัดการบัญชีเจ้าหน้าที่", en: "Officer Account Management" },
  "admin.subtitle": { th: "กำหนดว่าอีเมลมหาวิทยาลัยใดได้รับสิทธิ์เป็นเจ้าหน้าที่ (Officer) — อีเมลที่ไม่อยู่ในรายชื่อนี้จะเป็นสิทธิ์ผู้ขอ (Requester) โดยอัตโนมัติ", en: "Control which university emails have the Officer role — any email not listed here defaults to the Requester role." },
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
  "admin.empty": { th: "ยังไม่มีเจ้าหน้าที่ในระบบ", en: "No officer accounts yet." },

  "requestForm.crumb": { th: "ใบคำขอพิมพ์เอกสาร", en: "Request Form" },
  "requestForm.subtitle": { th: "ใบคำขอพิมพ์เอกสารฉบับเต็ม สำหรับตรวจสอบหรือพิมพ์ซ้ำ", en: "Full Request Form, for review or re-printing." },
  "requestForm.backToHistory": { th: "กลับไปที่ประวัติคำขอ", en: "Back to History" },

  "crumb.dashboard": { th: "แดชบอร์ดสรุปข้อมูล / <strong>ภาพรวม</strong>", en: "Dashboard / <strong>Overview</strong>" },
  "dashboard.title": { th: "แดชบอร์ดสรุปข้อมูล", en: "Summary Dashboard" },
  "dashboard.subtitle": { th: "ภาพรวมปริมาณคำขอและการพิมพ์ ใช้ประกอบการประมาณการงบประมาณ", en: "Overview of request and print volume — for budget estimation." },
  "dashboard.yearFilter": { th: "ปีที่ต้องการดู", en: "Year" },
  "dashboard.yearFilter.all": { th: "ทุกปี", en: "All years" },
  "dashboard.filterNote": { th: "ตัวกรองปีนี้มีผลกับสถิติและกราฟทุกส่วนด้านล่าง ยกเว้นกราฟ \"แนวโน้มรายปี\" ซึ่งแสดงทุกปีเสมอเพื่อการเปรียบเทียบ", en: "This year filter scopes every stat and chart below, except the \"Requests per Year\" trend chart, which always shows every year for comparison." },

  "dashboard.kpi.totalRequests": { th: "จำนวนคำขอทั้งหมด", en: "Total Requests" },
  "dashboard.kpi.totalCopies": { th: "จำนวนชุดที่ปริ้นแล้ว (รวม)", en: "Copies Printed (Total)" },
  "dashboard.kpi.totalPages": { th: "จำนวนหน้าที่ปริ้นแล้ว (รวม)", en: "Pages Printed (Total)" },
  "dashboard.kpi.completionRate": { th: "อัตราคำขอที่สำเร็จ", en: "Completion Rate" },

  "dashboard.trendTitle": { th: "จำนวนคำขอต่อปี", en: "Requests per Year" },
  "dashboard.trendNote": { th: "ภาพรวมทุกปี (ไม่ผูกกับตัวกรองด้านบน)", en: "All years shown (unaffected by the year filter above)" },

  "dashboard.agencyCountTitle": { th: "จำนวนคำขอ แยกตามประเภทหน่วยงาน", en: "Requests by Agency Category" },
  "dashboard.agencyPagesTitle": { th: "จำนวนหน้าที่ปริ้นรวม แยกตามประเภทหน่วยงาน", en: "Total Pages Printed by Agency Category" },
  "dashboard.agencyPagesNote": { th: "คำนวณจากคำขอที่ได้รับการอนุมัติและปริ้นแล้วเท่านั้น (ไม่รวมคำขอที่ถูกปฏิเสธหรือยังรอเอกสารต้นฉบับ) — ใช้ตัวเลขนี้ประกอบการประมาณการงบประมาณ", en: "Calculated only from approved/printed requests (excludes rejected and still-awaiting requests) — use this figure for budget estimation." },

  "dashboard.tableTitle": { th: "ตารางสรุปรายหน่วยงาน", en: "Agency Summary Table" },
  "dashboard.th.agency": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "dashboard.th.requests": { th: "จำนวนคำขอ", en: "Requests" },
  "dashboard.th.copies": { th: "จำนวนชุดที่ปริ้นแล้ว", en: "Copies Printed" },
  "dashboard.th.pages": { th: "จำนวนหน้าที่ปริ้นแล้ว", en: "Pages Printed" },
  "dashboard.th.avgPages": { th: "เฉลี่ยหน้า/คำขอ", en: "Avg. Pages / Request" },

  "dashboard.highest": { th: "สูงสุด", en: "Highest" },
  "dashboard.lowest": { th: "ต่ำสุด", en: "Lowest" },
  "dashboard.noData": { th: "ไม่มีข้อมูลสำหรับปีที่เลือก", en: "No data for the selected year." }
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

  // Copy-to-clipboard button
  "copy": `<svg ${SVG_ATTRS}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,

  // Notices
  "info": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  "clock": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  "check-circle": `<svg ${SVG_ATTRS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  "x-circle": `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  "alert-triangle": `<svg ${SVG_ATTRS}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  // Sidebar section collapse/expand
  "chevron-down": `<svg ${SVG_ATTRS}><polyline points="6 9 12 15 18 9"/></svg>`
};

function applyIcons() {
  document.querySelectorAll("[data-icon]").forEach(function (el) {
    const svg = ICONS[el.getAttribute("data-icon")];
    if (svg) el.innerHTML = svg;
  });
}

document.addEventListener("DOMContentLoaded", applyIcons);

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
  if(!link) return ;
  e.preventDefault();
  showConfirmModal({
    title: t("user.logoutModalTitle"),
    message: t("user.logoutModalMessage"),
    confirmText: t("user.logoutBtn"),
    danger: true,
    onConfirm: function(){
      window.location.href = link.href;
    }
  });
});

/* =====================================================================
   Confirm modal — a custom popup used instead of window.confirm(), so
   destructive/important actions (revoke, add) get an explicit second step.
   showConfirmModal({ title, message, confirmText, cancelText, danger, onConfirm })
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

function showConfirmModal(options) {
  const overlay = ensureModal();
  overlay.querySelector(".modal-title").textContent = options.title || "";
  overlay.querySelector(".modal-message").textContent = options.message || "";

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
    closeModal();
    if (handler) handler();
  });
  newCancelBtn.addEventListener("click", closeModal);

  overlay.hidden = false;
}
