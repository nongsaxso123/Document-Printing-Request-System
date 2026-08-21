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

/**
 * Mockup-only stand-in for a real atomic per-year DB counter (see file.md Appendix A —
 * "Numbering Scheme"). Real system: REQ-YYYY-NNNNNN via an atomic UPDATE...RETURNING
 * on a per-year counter row, never computed in application code.
 */
function generateReferenceNo() {
  const year = new Date().getFullYear() + 543;
  const num = String(Math.floor(1 + Math.random() * 99999)).padStart(6, "0");
  return `REQ-${year}-${num}`;
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mockup-only stand-in for the atomic per-year RUN NUMBER counter (see file.md Appendix A). */
function generateRunNumber() {
  const year = new Date().getFullYear() + 543;
  const num = String(Math.floor(1 + Math.random() * 99999)).padStart(6, "0");
  return `RN-${year}-${num}`;
}

/** Random 6-digit Claim Code, issued alongside the RUN NUMBER at Approve and Receive Master. */
function generateClaimCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

/* =====================================================================
   Officer-side mock data store — this prototype has no backend, so the
   Officer flow (queue, approve/reject, printing jobs, counter handover)
   reads/writes a small localStorage-backed "database" instead. Seed
   dates are computed relative to "now" at first load so the demo (e.g.
   which request is Overdue) stays correct no matter when it's opened.
   ===================================================================== */

const MOCK_STORE_KEY = "odprs_mock_requests";

/** The officer "logged into" this demo session — stamped onto records when live actions happen. */
const CURRENT_OFFICER = "คุณสรวิศ ธนะขว้าง";

/** A small pool of other officer names, for realistic variety in seeded/historical audit records. */
const OFFICER_POOL = ["คุณจริยา ทองดี", "คุณประเสริฐ ศักดิ์สิทธิ์", "คุณวิภาวรรณ เพชรรัตน์", CURRENT_OFFICER];

function seedMockRequests() {
  const now = new Date();
  const records = [
    {
      referenceNo: "REQ-2569-000512", runNumber: null,
      requesterName: "ดร. สมชาย ใจดี", requesterEmail: "somchai.j@mfu.ac.th", tel: "081-234-5678",
      agencyCategory: "สำนักวิชา", agencyUnit: "สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์ (School of Applied Digital Technology)",
      paperSize: "A4", printOption: "ขาวดำ สองหน้า", finishing: "ไม่มี", binding: "ไม่มี", folding: "ไม่มี",
      itemList: "เอกสารประมวลรายวิชา บทที่ 1-5", originalPages: "12", copies: "60",
      submissionDate: addDays(now, -1).toISOString(),
      dropoffDeadlineDate: addDays(now, 1).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: null,
      completionDateProposed: toDateInputValue(addBusinessDays(now, 3)), completionDateConfirmed: null,
      claimCode: null, statusCode: "awaiting", rejectionReason: null,
      reviewedByOfficer: null, handedOverByOfficer: null,
      receiverName: null, receiverIdInfo: null, completedTimestamp: null
    },
    {
      referenceNo: "REQ-2569-000508", runNumber: null,
      requesterName: "อ.ปิยะดา แสงทอง", requesterEmail: "piyada.s@mfu.ac.th", tel: "089-555-1234",
      agencyCategory: "ศูนย์", agencyUnit: "ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ (Centre for Digital Technology and Information)",
      paperSize: "A4", printOption: "สี หน้าเดียว", finishing: "เย็บมุม", binding: "ไม่มี", folding: "ไม่มี",
      itemList: "โปสเตอร์ประชาสัมพันธ์กิจกรรม", originalPages: "3", copies: "25",
      submissionDate: addDays(now, -5).toISOString(),
      dropoffDeadlineDate: addDays(now, -3).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: null,
      completionDateProposed: toDateInputValue(addBusinessDays(addDays(now, -5), 3)), completionDateConfirmed: null,
      claimCode: null, statusCode: "awaiting", rejectionReason: null,
      reviewedByOfficer: null, handedOverByOfficer: null,
      receiverName: null, receiverIdInfo: null, completedTimestamp: null
    },
    {
      referenceNo: "REQ-2569-000495", runNumber: "RN-2569-000231",
      requesterName: "คุณวีระ พงษ์ไพบูลย์", requesterEmail: "weera.p@mfu.ac.th", tel: "085-777-8899",
      agencyCategory: "สำนักงานบริหารกลาง", agencyUnit: "ส่วนพัสดุ (Procurement and Supplies Division)",
      paperSize: "A4", printOption: "ขาวดำ สองหน้า", finishing: "ไม่มี", binding: "เข้าเล่มสันกาว", folding: "ไม่มี",
      itemList: "ระเบียบจัดซื้อจัดจ้าง ฉบับปรับปรุง", originalPages: "40", copies: "15",
      submissionDate: addDays(now, -6).toISOString(),
      dropoffDeadlineDate: addDays(now, -5).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: addDays(now, -4).toISOString(),
      completionDateProposed: toDateInputValue(addDays(now, 2)), completionDateConfirmed: toDateInputValue(addDays(now, 2)),
      claimCode: "482910", statusCode: "printing", rejectionReason: null,
      reviewedByOfficer: "คุณจริยา ทองดี", handedOverByOfficer: null,
      receiverName: null, receiverIdInfo: null, completedTimestamp: null
    },
    {
      referenceNo: "REQ-2569-000488", runNumber: "RN-2569-000225",
      requesterName: "ผศ.ดร. อรุณี ชัยวัฒน์", requesterEmail: "arunee.c@mfu.ac.th", tel: "086-321-9876",
      agencyCategory: "สำนักวิชา", agencyUnit: "สำนักวิชาวิทยาศาสตร์ (School of Science)",
      paperSize: "A4", printOption: "ขาวดำ หน้าเดียว", finishing: "เจาะรู", binding: "ไม่มี", folding: "ไม่มี",
      itemList: "ชุดข้อสอบปลายภาค วิชาเคมีทั่วไป", originalPages: "8", copies: "120",
      submissionDate: addDays(now, -7).toISOString(),
      dropoffDeadlineDate: addDays(now, -6).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: addDays(now, -6).toISOString(),
      completionDateProposed: toDateInputValue(addDays(now, 1)), completionDateConfirmed: toDateInputValue(addDays(now, 1)),
      claimCode: "719345", statusCode: "printing", rejectionReason: null,
      reviewedByOfficer: "คุณประเสริฐ ศักดิ์สิทธิ์", handedOverByOfficer: null,
      receiverName: null, receiverIdInfo: null, completedTimestamp: null
    },
    {
      referenceNo: "REQ-2569-000470", runNumber: "RN-2569-000198",
      requesterName: "คุณสมหญิง ตันติวงศ์", requesterEmail: "somying.t@mfu.ac.th", tel: "080-111-2233",
      agencyCategory: "สำนักงานวิชาการ", agencyUnit: "ส่วนพัฒนานักศึกษา (Student Development Affairs Division)",
      paperSize: "A4", printOption: "สี สองหน้า", finishing: "ไม่มี", binding: "เข้าเล่มห่วงสัน (Spiral)", folding: "ไม่มี",
      itemList: "คู่มือปฐมนิเทศนักศึกษาใหม่", originalPages: "24", copies: "300",
      submissionDate: addDays(now, -9).toISOString(),
      dropoffDeadlineDate: addDays(now, -8).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: addDays(now, -8).toISOString(),
      completionDateProposed: toDateInputValue(addDays(now, -1)), completionDateConfirmed: toDateInputValue(addDays(now, -1)),
      claimCode: "603312", statusCode: "ready", rejectionReason: null,
      reviewedByOfficer: "คุณวิภาวรรณ เพชรรัตน์", handedOverByOfficer: null,
      receiverName: null, receiverIdInfo: null, completedTimestamp: null
    },
    {
      referenceNo: "REQ-2569-000450", runNumber: "RN-2569-000180",
      requesterName: "ดร. สมชาย ใจดี", requesterEmail: "somchai.j@mfu.ac.th", tel: "081-234-5678",
      agencyCategory: "สำนักวิชา", agencyUnit: "สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์ (School of Applied Digital Technology)",
      paperSize: "A4", printOption: "ขาวดำ สองหน้า", finishing: "ไม่มี", binding: "ไม่มี", folding: "ไม่มี",
      itemList: "ใบประกาศนียบัตรอบรม", originalPages: "1", copies: "50",
      submissionDate: addDays(now, -14).toISOString(),
      dropoffDeadlineDate: addDays(now, -13).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: addDays(now, -13).toISOString(),
      completionDateProposed: toDateInputValue(addDays(now, -4)), completionDateConfirmed: toDateInputValue(addDays(now, -4)),
      claimCode: "215567", statusCode: "completed", rejectionReason: null,
      reviewedByOfficer: "คุณจริยา ทองดี", handedOverByOfficer: "คุณประเสริฐ ศักดิ์สิทธิ์",
      receiverName: "สมชาย ใจดี", receiverIdInfo: "บัตรประชาชน 1-XXXX-XXXXX-XX-X", completedTimestamp: addDays(now, -4).toISOString()
    },
    {
      referenceNo: "REQ-2569-000441", runNumber: null,
      requesterName: "อ.ปิยะดา แสงทอง", requesterEmail: "piyada.s@mfu.ac.th", tel: "089-555-1234",
      agencyCategory: "ศูนย์", agencyUnit: "ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ (Centre for Digital Technology and Information)",
      paperSize: "A4", printOption: "ขาวดำ สองหน้า", finishing: "ไม่มี", binding: "ไม่มี", folding: "ไม่มี",
      itemList: "รายงานประจำปี ฉบับร่าง", originalPages: "35", copies: "20",
      submissionDate: addDays(now, -16).toISOString(),
      dropoffDeadlineDate: addDays(now, -15).toISOString(), dropoffSameDay: false,
      originalDocReceivedTimestamp: addDays(now, -15).toISOString(),
      completionDateProposed: toDateInputValue(addDays(now, -11)), completionDateConfirmed: null,
      claimCode: null, statusCode: "rejected",
      rejectionReason: "จำนวนหน้าต้นฉบับที่นำมาส่ง (28 หน้า) ไม่ตรงกับที่ระบุไว้ในคำขอ (35 หน้า)",
      reviewedByOfficer: "คุณวิภาวรรณ เพชรรัตน์", handedOverByOfficer: null,
      receiverName: null, receiverIdInfo: null, completedTimestamp: null
    }
  ];

  records.push.apply(records, generateBulkMockRecords(150));

  localStorage.setItem(MOCK_STORE_KEY, JSON.stringify(records));
  return records;
}

/** Random filler data so History has enough rows to demonstrate search/filter/pagination. */
const BULK_SAMPLE_NAMES = [
  "ดร. สมชาย ใจดี", "อ.ปิยะดา แสงทอง", "คุณวีระ พงษ์ไพบูลย์", "ผศ.ดร. อรุณี ชัยวัฒน์", "คุณสมหญิง ตันติวงศ์",
  "อ.ธนกร ศรีสุข", "ดร. มณีรัตน์ บุญมาก", "คุณประภาส เรืองศรี", "ผศ. กัลยา วงศ์สวัสดิ์", "คุณอนุชา ทองใบ",
  "อ.รัตนา คำแก้ว", "คุณสุรชัย แก้วมณี", "ดร. เบญจวรรณ ศรีวิไล", "คุณชัยวัฒน์ พรหมมา", "อ.นภาพร ใจซื่อ"
];
const BULK_SAMPLE_ITEMS = [
  "เอกสารประกอบการสอน", "แบบฟอร์มขอทุนวิจัย", "คู่มือปฏิบัติงาน", "ใบปะหน้าโครงการ", "รายงานการประชุม",
  "แผ่นพับประชาสัมพันธ์", "ตารางสอบกลางภาค", "สไลด์ประกอบการบรรยาย", "สัญญาจ้างเหมาบริการ", "ใบสมัครทุนการศึกษา"
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function generateBulkMockRecords(count) {
  const now = new Date();
  const categories = Object.keys(AGENCY_DATA).filter(function (c) { return AGENCY_DATA[c].length > 0; });
  const statusPool = ["completed", "completed", "completed", "completed", "rejected", "printing", "printing", "ready", "awaiting", "awaiting"];
  const usedRefs = new Set();
  const usedRuns = new Set();

  function uniqueId(generator, used) {
    let id;
    do { id = generator(); } while (used.has(id));
    used.add(id);
    return id;
  }

  const records = [];
  for (let i = 0; i < count; i++) {
    const submission = addDays(now, -randomInt(2, 1095));
    const category = randomFrom(categories);
    const status = randomFrom(statusPool);
    const hasRun = status !== "awaiting" && status !== "rejected";

    records.push({
      referenceNo: uniqueId(generateReferenceNo, usedRefs),
      runNumber: hasRun ? uniqueId(generateRunNumber, usedRuns) : null,
      requesterName: randomFrom(BULK_SAMPLE_NAMES),
      requesterEmail: "user" + (i + 1) + "@mfu.ac.th",
      tel: "08" + randomInt(1, 9) + "-" + randomInt(100, 999) + "-" + randomInt(1000, 9999),
      agencyCategory: category,
      agencyUnit: randomFrom(AGENCY_DATA[category]),
      paperSize: randomFrom(["A4", "A3", "A5"]),
      printOption: randomFrom(["ขาวดำ หน้าเดียว", "ขาวดำ สองหน้า", "สี หน้าเดียว", "สี สองหน้า"]),
      finishing: randomFrom(["ไม่มี", "เย็บมุม", "เจาะรู"]),
      binding: randomFrom(["ไม่มี", "เข้าเล่มสันกาว", "เข้าเล่มห่วงสัน (Spiral)"]),
      folding: randomFrom(["ไม่มี", "พับสามตอน", "พับครึ่ง"]),
      itemList: randomFrom(BULK_SAMPLE_ITEMS),
      originalPages: String(randomInt(1, 60)),
      copies: String(randomInt(5, 300)),
      submissionDate: submission.toISOString(),
      dropoffDeadlineDate: addDays(submission, 1).toISOString(),
      dropoffSameDay: false,
      originalDocReceivedTimestamp: status === "awaiting" ? null : addDays(submission, 1).toISOString(),
      completionDateProposed: toDateInputValue(addDays(submission, 5)),
      completionDateConfirmed: hasRun ? toDateInputValue(addDays(submission, 5)) : null,
      claimCode: hasRun ? generateClaimCode() : null,
      statusCode: status,
      rejectionReason: status === "rejected" ? "จำนวนหน้าต้นฉบับไม่ตรงกับที่ระบุไว้ในคำขอ" : null,
      reviewedByOfficer: status === "awaiting" ? null : randomFrom(OFFICER_POOL),
      handedOverByOfficer: status === "completed" ? randomFrom(OFFICER_POOL) : null,
      receiverName: status === "completed" ? randomFrom(BULK_SAMPLE_NAMES) : null,
      receiverIdInfo: status === "completed" ? "บัตรประชาชน 1-XXXX-XXXXX-XX-X" : null,
      completedTimestamp: status === "completed" ? addDays(submission, 6).toISOString() : null
    });
  }
  return records;
}

function getMockRequests() {
  const raw = localStorage.getItem(MOCK_STORE_KEY);
  if (!raw) return seedMockRequests();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return seedMockRequests();
  }
}

function saveMockRequests(records) {
  localStorage.setItem(MOCK_STORE_KEY, JSON.stringify(records));
}

function findMockRequest(referenceNo) {
  return getMockRequests().find(function (r) { return r.referenceNo === referenceNo; }) || null;
}

function findMockRequestByClaimCode(claimCode) {
  return getMockRequests().find(function (r) { return r.claimCode === claimCode; }) || null;
}

function updateMockRequest(referenceNo, patch) {
  const records = getMockRequests();
  const idx = records.findIndex(function (r) { return r.referenceNo === referenceNo; });
  if (idx === -1) return null;
  records[idx] = Object.assign({}, records[idx], patch);
  saveMockRequests(records);
  return records[idx];
}

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

/* =====================================================================
   Officer Account (Role Assignment) mock store — see file.md Appendix A.
   Independent of the request store: revoking an officer here never rewrites
   the reviewedByOfficer/handedOverByOfficer already recorded on past requests
   (an auditable history shouldn't change just because access was revoked).
   ===================================================================== */

const OFFICER_ACCOUNTS_KEY = "odprs_mock_officer_accounts";
const CURRENT_ADMIN = "คุณกิตติพงศ์ ดวงแก้ว";

function seedOfficerAccounts() {
  const now = new Date();
  const accounts = [
    { email: "Sorrawit.tha@mfu.ac.th", name: CURRENT_OFFICER, assignedBy: CURRENT_ADMIN, assignedDate: toDateInputValue(addDays(now, -400)) },
    { email: "jariya.t@mfu.ac.th", name: "คุณจริยา ทองดี", assignedBy: CURRENT_ADMIN, assignedDate: toDateInputValue(addDays(now, -365)) },
    { email: "prasert.s@mfu.ac.th", name: "คุณประเสริฐ ศักดิ์สิทธิ์", assignedBy: CURRENT_ADMIN, assignedDate: toDateInputValue(addDays(now, -300)) },
    { email: "vipawan.p@mfu.ac.th", name: "คุณวิภาวรรณ เพชรรัตน์", assignedBy: CURRENT_ADMIN, assignedDate: toDateInputValue(addDays(now, -60)) }
  ];
  localStorage.setItem(OFFICER_ACCOUNTS_KEY, JSON.stringify(accounts));
  return accounts;
}

function getOfficerAccounts() {
  const raw = localStorage.getItem(OFFICER_ACCOUNTS_KEY);
  if (!raw) return seedOfficerAccounts();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return seedOfficerAccounts();
  }
}

function saveOfficerAccounts(accounts) {
  localStorage.setItem(OFFICER_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function addOfficerAccount(email, name) {
  const accounts = getOfficerAccounts();
  accounts.push({
    email: email,
    name: name,
    assignedBy: CURRENT_ADMIN,
    assignedDate: toDateInputValue(new Date())
  });
  saveOfficerAccounts(accounts);
  return accounts;
}

function removeOfficerAccount(email) {
  const accounts = getOfficerAccounts().filter(function (a) { return a.email !== email; });
  saveOfficerAccounts(accounts);
  return accounts;
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
  "newRequest.cardTitle": { th: "รายละเอียดคำขอ", en: "Request Details" },

  "field.requesterName": { th: "ชื่อผู้ขอ", en: "Requester Name" },
  "field.requesterName.hint": { th: "ดึงจากบัญชีอีเมลมหาวิทยาลัยที่ล็อกอิน", en: "Retrieved from your university SSO login" },
  "field.tel": { th: "เบอร์โทรศัพท์ *", en: "Phone Number *" },
  "field.agencyCategory": { th: "ประเภทหน่วยงาน *", en: "Agency Category *" },
  "field.agencyUnit": { th: "หน่วยงาน *", en: "Agency/Unit *" },
  "field.agencyUnit.placeholder": { th: "พิมพ์ชื่อหน่วยงาน", en: "Type the agency/unit name" },
  "field.paperSize": { th: "ขนาดกระดาษ *", en: "Paper Size *" },
  "field.paperSize.other.placeholder": { th: "ระบุขนาดกระดาษ เช่น B5, Letter, F4", en: "Specify paper size, e.g. B5, Letter, F4" },
  "field.printOption": { th: "รูปแบบการพิมพ์ *", en: "Print Option *" },
  "field.finishing": { th: "งานตกแต่ง (Finishing)", en: "Finishing" },
  "field.binding": { th: "การเข้าเล่ม (Binding)", en: "Binding" },
  "field.folding": { th: "การพับ (Folding)", en: "Folding" },
  "field.itemList": { th: "รายการเอกสารที่ต้องการพิมพ์ *", en: "Items to be Printed *" },
  "field.itemList.placeholder": { th: "เช่น เอกสารประมวลรายวิชา บทที่ 1-5, ใบปะหน้า", en: "e.g. Course syllabus chapters 1-5, cover sheet" },
  "field.originalPages": { th: "จำนวนหน้าต้นฉบับ *", en: "Original Page Count *" },
  "field.copies": { th: "จำนวนชุดที่ต้องการ *", en: "Number of Copies *" },
  "field.copies.hint": { th: "ไม่จำกัดจำนวนชุด", en: "No minimum or maximum" },
  "field.completionDate": { th: "วันที่ต้องการรับเอกสาร *", en: "Requested Completion Date *" },
  "field.completionDate.error": { th: "กรุณาเลือกวันที่ห่างจากวันนี้อย่างน้อย 3 วันทำการ", en: "Please choose a date at least 3 business days from today." },

  "option.select": { th: "— เลือก —", en: "— Select —" },
  "option.selectCategoryFirst": { th: "— เลือกประเภทหน่วยงานก่อน —", en: "— Select an agency category first —" },
  "option.paperSize.a4": { th: "A4", en: "A4" },
  "option.paperSize.a3": { th: "A3", en: "A3" },
  "option.paperSize.a5": { th: "A5", en: "A5" },
  "option.paperSize.other": { th: "อื่นๆ", en: "Other" },
  "option.print.bwSingle": { th: "ขาวดำ หน้าเดียว", en: "Black & White, Single-sided" },
  "option.print.bwDouble": { th: "ขาวดำ สองหน้า", en: "Black & White, Double-sided" },
  "option.print.colorSingle": { th: "สี หน้าเดียว", en: "Colour, Single-sided" },
  "option.print.colorDouble": { th: "สี สองหน้า", en: "Colour, Double-sided" },
  "option.none": { th: "ไม่มี", en: "None" },
  "option.finishing.corner": { th: "เย็บมุม", en: "Corner Stapling" },
  "option.finishing.hole": { th: "เจาะรู", en: "Hole Punch" },
  "option.binding.perfect": { th: "เข้าเล่มสันกาว", en: "Perfect Binding" },
  "option.binding.spiral": { th: "เข้าเล่มห่วงสัน (Spiral)", en: "Spiral Binding" },
  "option.folding.tri": { th: "พับสามตอน", en: "Tri-fold" },
  "option.folding.half": { th: "พับครึ่ง", en: "Half-fold" },

  "btn.cancel": { th: "ยกเลิก", en: "Cancel" },
  "btn.submit": { th: "ส่งคำขอ", en: "Submit Request" },

  "submitted.title": { th: "ส่งคำขอสำเร็จ", en: "Request Submitted" },
  "submitted.subtitle": { th: "กรุณาพิมพ์ใบคำขอด้านล่างและนำไปพร้อมกับเอกสารต้นฉบับ", en: "Please print the Request Form below and bring it together with the physical original documents." },
  "submitted.deadline.label": { th: "นำเอกสารต้นฉบับมาส่งภายใน:", en: "Deliver the physical original documents by:" },
  "submitted.deadline.body": { th: "หากไม่นำมาส่งภายในกำหนด คำขอจะยังคงค้างสถานะ \"รอส่งเอกสารต้นฉบับ\" — กรุณาติดต่อเจ้าหน้าที่หากมีปัญหา", en: "If not delivered by the deadline, the request simply stays in \"Awaiting Original Document\" status — please contact an Officer if there's an issue." },
  "submitted.formCardTitle": { th: "ใบคำขอพิมพ์เอกสาร (สำหรับพิมพ์)", en: "Print Request Form (Printable)" },
  "submitted.printBtn": { th: "พิมพ์ใบคำขอ", en: "Print Request Form" },
  "submitted.formHeading": { th: "ใบคำขอพิมพ์เอกสาร — ODPRS", en: "Print Request Form — ODPRS" },
  "submitted.formSub": { th: "ฝ่ายทะเบียน มหาวิทยาลัยแม่ฟ้าหลวง", en: "Registrar Division, Mae Fah Luang University" },
  "submitted.newBtn": { th: "สร้างคำขอใหม่", en: "Create New Request" },
  "submitted.goToMyRequests": { th: "ไปที่คำขอของฉัน", en: "Go to My Requests" },

  "summary.refno": { th: "เลขอ้างอิงคำขอ", en: "Request Reference No." },
  "summary.name": { th: "ชื่อผู้ขอ", en: "Requester Name" },
  "summary.agencyCategory": { th: "ประเภทหน่วยงาน", en: "Agency Category" },
  "summary.agencyUnit": { th: "หน่วยงาน", en: "Agency/Unit" },
  "summary.tel": { th: "เบอร์โทรศัพท์", en: "Phone Number" },
  "summary.paperSize": { th: "ขนาดกระดาษ", en: "Paper Size" },
  "summary.printOption": { th: "รูปแบบการพิมพ์", en: "Print Option" },
  "summary.finishing": { th: "งานตกแต่ง", en: "Finishing" },
  "summary.binding": { th: "การเข้าเล่ม", en: "Binding" },
  "summary.folding": { th: "การพับ", en: "Folding" },
  "summary.itemList": { th: "รายการเอกสาร", en: "Items" },
  "summary.pages": { th: "จำนวนหน้าต้นฉบับ", en: "Original Pages" },
  "summary.copies": { th: "จำนวนชุด", en: "Number of Copies" },
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
  "detail.receiverIdLabel": { th: "ข้อมูลยืนยันตัวตนผู้รับ", en: "Receiver ID Info" },
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
  "printingJobs.th.completion": { th: "วันนัดรับ (ยืนยันแล้ว)", en: "Confirmed Completion Date" },
  "printingJobs.th.action": { th: "การดำเนินการ", en: "Action" },
  "printingJobs.markReady": { th: "ทำเครื่องหมายพร้อมส่งมอบ", en: "Mark Ready for Pickup" },

  "handover.title": { th: "จุดส่งมอบเอกสาร", en: "Counter Handover" },
  "handover.subtitle": { th: "ตรวจสอบ Claim Code และบัตรประชาชนของผู้รับก่อนยืนยันส่งมอบ", en: "Verify the Claim Code and the Receiver's physical ID before confirming handover." },
  "handover.searchTitle": { th: "ค้นหาด้วย Claim Code", en: "Look Up by Claim Code" },
  "handover.claimCodeLabel": { th: "Claim Code (6 หลัก)", en: "Claim Code (6 digits)" },
  "handover.searchBtn": { th: "ค้นหา", en: "Search" },
  "handover.notFound": { th: "ไม่พบคำขอที่ตรงกับรหัสนี้ หรือคำขอยังไม่พร้อมส่งมอบ กรุณาตรวจสอบ Claim Code อีกครั้ง", en: "No request matches this code, or it isn't ready for pickup yet. Please check the Claim Code again." },
  "handover.matchTitle": { th: "พบคำขอที่ตรงกัน — ตรวจสอบบัตรประชาชนก่อนส่งมอบ", en: "Match found — verify physical ID before handover" },
  "handover.receiverName": { th: "ชื่อผู้รับ *", en: "Receiver Name *" },
  "handover.receiverId": { th: "เลขบัตรประชาชน / ข้อมูลยืนยันตัวตน *", en: "ID Number / Identifying Info *" },
  "handover.receiverName.required": { th: "กรุณากรอกชื่อผู้รับ", en: "Please enter the receiver's name." },
  "handover.receiverId.required": { th: "กรุณากรอกข้อมูลยืนยันตัวตน", en: "Please enter identifying information." },
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
  "crumb.admin": { th: "จัดการบัญชีเจ้าหน้าที่ / <strong>ภาพรวม</strong>", en: "Officer Accounts / <strong>Overview</strong>" },

  "admin.title": { th: "จัดการบัญชีเจ้าหน้าที่", en: "Officer Account Management" },
  "admin.subtitle": { th: "กำหนดว่าอีเมลมหาวิทยาลัยใดได้รับสิทธิ์เป็นเจ้าหน้าที่ (Officer) — อีเมลที่ไม่อยู่ในรายชื่อนี้จะเป็นสิทธิ์ผู้ขอ (Requester) โดยอัตโนมัติ", en: "Control which university emails have the Officer role — any email not listed here defaults to the Requester role." },
  "admin.addTitle": { th: "เพิ่มเจ้าหน้าที่ใหม่", en: "Add New Officer" },
  "admin.nameLabel": { th: "ชื่อ-นามสกุล *", en: "Full Name *" },
  "admin.nameError": { th: "กรุณากรอกชื่อ-นามสกุล", en: "Please enter a name." },
  "admin.emailLabel": { th: "อีเมลมหาวิทยาลัย *", en: "University Email *" },
  "admin.emailError.invalid": { th: "ต้องเป็นอีเมลที่ลงท้ายด้วย @mfu.ac.th เท่านั้น", en: "Must be an email ending in @mfu.ac.th." },
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
  "requestForm.placeholderNote": { th: "หน้านี้เป็นโครงเบื้องต้น รอสรุปแบบฟอร์มจริงจากฝ่ายทะเบียนก่อนออกแบบหน้าตาสุดท้าย", en: "This is a placeholder layout, pending the Registrar Division's final sign-off on the actual form design." },

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
  "alert-triangle": `<svg ${SVG_ATTRS}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
};

function applyIcons() {
  document.querySelectorAll("[data-icon]").forEach(function (el) {
    const svg = ICONS[el.getAttribute("data-icon")];
    if (svg) el.innerHTML = svg;
  });
}

document.addEventListener("DOMContentLoaded", applyIcons);

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
  confirmBtn.className = "btn " + (options.danger ? "btn-danger" : "btn-primary");

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
