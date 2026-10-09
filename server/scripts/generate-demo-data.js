/**
 * Wipes all existing `requests`/`counters` rows and replaces them with
 * synthetic data spanning the last 3 calendar years up to today (partial
 * for the current year), capped at roughly 10,000 requests/year, to give
 * the officer dashboard a realistic multi-year dataset to render against.
 *
 * Does NOT touch the `officers` table.
 * Run: node scripts/generate-demo-data.js
 */

const prisma = require("../src/prisma");
const businessDays = require("../src/businessDays");

// ---------- static reference data ----------

// Mirrors AGENCY_DATA in public/assets/js/app.js (kept in sync manually —
// see file.md Appendix; this is demo-data-only, not read by the app itself).
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
  "สำนักงานสภามหาวิทยาลัย": ["สำนักงานสภามหาวิทยาลัย (Office of the University Council)"],
  "หน่วยตรวจสอบภายใน": ["หน่วยตรวจสอบภายใน (Internal Audit Division)"],
  "สำนักงานจัดการทรัพย์สินและรายได้": ["สำนักงานจัดการทรัพย์สินและรายได้ (Property and Asset Management Office)"],
  "ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง": [
    "ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง (MFU Wellness Centre)"
  ],
  "หน่วยงานพิเศษ": ["ศูนย์ภาษาและวัฒนธรรมจีนสิรินธร (Sirindhorn Chinese Language and Culture Centre)"],
  "หน่วยงานอื่นๆ": [
    "ชมรมศิษย์เก่ามหาวิทยาลัยแม่ฟ้าหลวง",
    "สโมสรนักศึกษา มหาวิทยาลัยแม่ฟ้าหลวง",
    "หน่วยงานภายนอก (หน่วยงานร่วมจัดกิจกรรม)"
  ]
};

// Relative request-volume weight per agency category (sums to 100) — Schools
// and Academic Affairs realistically generate the most print jobs.
const CATEGORY_WEIGHTS = [
  ["สำนักวิชา", 30],
  ["สำนักงานวิชาการ", 20],
  ["สำนักงานบริหารกลาง", 15],
  ["ศูนย์", 10],
  ["สำนักงานวิจัย", 8],
  ["สถาบัน", 3],
  ["ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง", 3],
  ["หน่วยงานพิเศษ", 3],
  ["สำนักงานสภามหาวิทยาลัย", 2],
  ["หน่วยตรวจสอบภายใน", 2],
  ["สำนักงานจัดการทรัพย์สินและรายได้", 2],
  ["หน่วยงานอื่นๆ", 2]
];

const FINISHING_PROFILES = [
  [[], 40],
  [["เย็บมุม"], 20],
  [["เย็บข้าง"], 8],
  [["เจาะรู"], 8],
  [["เย็บมุม", "เจาะรู"], 5],
  [["เข้าเล่มห่วงสัน (Coil)"], 6],
  [["เข้าเล่มสันกาว"], 5],
  [["เข้าเล่มเทปผ้า"], 4],
  [["เย็บมุงหลังคา (Saddle-stitch)"], 4]
];

const ITEM_LIST_EXAM = ["ข้อสอบกลางภาค", "ข้อสอบปลายภาค", "ข้อสอบซ่อม (Re-sit Exam)", "แบบทดสอบย่อย (Quiz)"];
const ITEM_LIST_GENERAL = [
  "เอกสารประกอบการสอน", "รายงานประจำปี", "หนังสือเวียนภายใน", "คู่มือนักศึกษาใหม่",
  "เอกสารประกอบการประชุม", "แบบฟอร์มคำร้องต่างๆ", "โปสเตอร์ประชาสัมพันธ์กิจกรรม",
  "ใบประกาศนียบัตร/วุฒิบัตร", "รายงานการประเมินคุณภาพการศึกษา", "ระเบียบ/ประกาศฉบับปรับปรุง",
  "เอกสารปฐมนิเทศ", "แผนยุทธศาสตร์ประจำปี"
];

const REJECTION_REASONS = [
  "จำนวนหน้าต้นฉบับที่นำมาส่งไม่ตรงกับที่ระบุไว้ในคำขอ",
  "เอกสารต้นฉบับไม่ครบตามจำนวนสำเนาที่ระบุ",
  "ไม่นำเอกสารต้นฉบับมาส่งภายในกำหนดเวลา",
  "ข้อมูลหน่วยงาน/ผู้ขอไม่ตรงกับที่ลงทะเบียนไว้",
  "เอกสารต้นฉบับชำรุด ไม่สามารถใช้พิมพ์ได้"
];

const RECEIVER_POSITIONS = ["เจ้าหน้าที่ธุรการ", "อาจารย์", "นักวิชาการศึกษา", "เจ้าหน้าที่บริหารงานทั่วไป", "เลขานุการ"];

// reused across many requests, same as real staff repeatedly using the system
const REQUESTERS = [
  ["ดร. สมชาย ใจดี", "somchai.j@mfu.ac.th", "081-234-5678"],
  ["อ.ปิยะดา แสงทอง", "piyada.s@mfu.ac.th", "089-555-1234"],
  ["คุณวีระ พงษ์ไพบูลย์", "weera.p@mfu.ac.th", "085-777-8899"],
  ["คุณสมหญิง ตันติวงศ์", "somying.t@mfu.ac.th", "080-111-2233"],
  ["อ.ธนกร วงศ์สุวรรณ", "thanakorn.w@mfu.ac.th", "086-234-1122"],
  ["คุณกมลชนก ศรีสุข", "kamonchanok.s@mfu.ac.th", "087-345-6677"],
  ["ดร.ศักดิ์ชัย บุญมี", "sakchai.b@mfu.ac.th", "081-999-8888"],
  ["คุณนภัสสร รักษ์ไทย", "napassorn.r@mfu.ac.th", "084-123-4567"],
  ["อ.วรรณา สายทอง", "wanna.s@mfu.ac.th", "089-222-3344"],
  ["คุณชัยวัฒน์ อินทร์แก้ว", "chaiwat.i@mfu.ac.th", "083-456-7890"],
  ["คุณพิมพ์ใจ ชูเกียรติ", "pimjai.c@mfu.ac.th", "088-111-2222"],
  ["ดร.สุนทร จันทร์เพ็ญ", "soonthorn.j@mfu.ac.th", "081-555-6666"],
  ["คุณอัญชลี ทองดี", "anchalee.t@mfu.ac.th", "085-333-4444"],
  ["อ.ธีรพงษ์ เพชรรัตน์", "theerapong.p@mfu.ac.th", "086-777-1111"],
  ["คุณมาลี ศักดิ์สิทธิ์", "malee.s@mfu.ac.th", "087-888-9999"],
  ["คุณวิชัย แสงทอง", "wichai.s@mfu.ac.th", "089-000-1111"],
  ["อ.อรุณี พงษ์ไพบูลย์", "arunee.p@mfu.ac.th", "080-222-3333"],
  ["คุณธนพล ตันติวงศ์", "thanapon.t@mfu.ac.th", "081-444-5555"],
  ["ดร.ศิริพร ใจดี", "siriporn.j@mfu.ac.th", "084-666-7777"],
  ["คุณประภาส วงศ์สุวรรณ", "prapas.w@mfu.ac.th", "086-888-0000"]
];

// weighted toward the 2 real Officer accounts already seeded
const OFFICERS = [
  ["6531503080@lamduan.mfu.ac.th", "Sorrawit Thanakhwang", 35],
  ["somnuk.sri@mfu.ac.th", "Somnuk Srijai", 35],
  ["jariya.t@mfu.ac.th", "คุณจริยา ทองดี", 15],
  ["vipawan.p@mfu.ac.th", "คุณวิภาวรรณ เพชรรัตน์", 10],
  ["prasert.s@mfu.ac.th", "คุณประเสริฐ ศักดิ์สิทธิ์", 5]
];

// ---------- helpers ----------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function weightedPick(pairs) {
  const total = pairs.reduce((sum, p) => sum + p[1], 0);
  let r = Math.random() * total;
  for (const [value, weight] of pairs) {
    if (r < weight) return value;
    r -= weight;
  }
  return pairs[pairs.length - 1][0];
}

function toUtcMidnight(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function randomBusinessDayInRange(start, end) {
  let d;
  do {
    const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    d = new Date(t);
    d.setHours(randomInt(9, 14), randomInt(0, 59), randomInt(0, 59), 0);
  } while (!businessDays.isBusinessDay(d));
  return d;
}

// Populated once in main() from the real agency_categories/agency_units
// tables (src/agencies.js) before any record is generated, so every
// generated request gets real ids — not just the strings AGENCY_DATA above
// mirrors — the same as a real submission through resolveAgency() would.
// Keyed exactly like the migration's own backfill: category by its Thai
// name, unit by "<category>||<name_th> (<name_en>)" (the same concatenation
// AGENCY_DATA already uses, so a lookup miss only happens for the
// "หน่วยงานอื่นๆ" free-text category, which has no real unit rows at all —
// same as a real free-text submission, its agencyUnitId is correctly null).
let CATEGORY_ID_BY_NAME = {};
let UNIT_ID_BY_NAME = {};

async function loadAgencyIds() {
  const categories = await prisma.agencyCategory.findMany();
  const units = await prisma.agencyUnit.findMany();
  const categoryNameById = {};
  categories.forEach((c) => {
    CATEGORY_ID_BY_NAME[c.nameTh] = c.id;
    categoryNameById[c.id] = c.nameTh;
  });
  units.forEach((u) => {
    const categoryName = categoryNameById[u.categoryId];
    UNIT_ID_BY_NAME[`${categoryName}||${u.nameTh} (${u.nameEn})`] = u.id;
  });
}

function pickAgency() {
  const category = weightedPick(CATEGORY_WEIGHTS);
  const unit = pick(AGENCY_DATA[category]);
  return {
    category, unit,
    categoryId: CATEGORY_ID_BY_NAME[category] || null,
    unitId: UNIT_ID_BY_NAME[`${category}||${unit}`] || null
  };
}

function pickDocumentType(category) {
  let examProb = 0;
  if (category === "สำนักวิชา") examProb = 0.35;
  else if (category === "สำนักงานวิชาการ") examProb = 0.08;
  return Math.random() < examProb ? "ข้อสอบ" : "เอกสารทั่วไป";
}

function pickPaperSource(documentType) {
  if (documentType === "เอกสารทั่วไป") return "ผู้ขอจัดเตรียมเอง";
  return Math.random() < 0.6 ? "ฝ่ายทะเบียนจัดเตรียมให้" : "ผู้ขอจัดเตรียมเอง";
}

function pickPages() {
  const r = Math.random();
  if (r < 0.55) return randomInt(1, 15);
  if (r < 0.85) return randomInt(16, 50);
  if (r < 0.97) return randomInt(51, 100);
  return randomInt(101, 200);
}

function pickCopies() {
  const r = Math.random();
  if (r < 0.4) return randomInt(1, 10);
  if (r < 0.75) return randomInt(11, 50);
  if (r < 0.93) return randomInt(51, 150);
  return randomInt(151, 500);
}

function pickPaperSize() {
  const r = Math.random();
  if (r < 0.9) return "A4";
  if (r < 0.95) return "A3";
  if (r < 0.98) return "A5";
  return pick(["B5", "F4", "Letter"]);
}

function pickFinishing(documentType, printSide, pages) {
  if (documentType === "ข้อสอบ") {
    return Math.random() < 0.5 ? ["เย็บมุม"] : [];
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const profile = weightedPick(FINISHING_PROFILES);
    if (profile.includes("เย็บมุงหลังคา (Saddle-stitch)")) {
      if (printSide !== "พิมพ์สองหน้า" || pages < 4 || pages > 60 || pages % 4 !== 0) continue;
    }
    if (profile.includes("เข้าเล่มสันกาว") && pages < 20) continue;
    if (profile.includes("เย็บมุม") && pages > 80) continue;
    return profile;
  }
  return [];
}

function pickStatus(daysSince) {
  if (daysSince > 14) {
    return Math.random() < 0.92 ? "COMPLETED" : "REJECTED";
  }
  const r = Math.random();
  if (r < 0.1) return "AWAITING_ORIGINAL_DOCUMENT";
  if (r < 0.2) return "REJECTED";
  if (r < 0.35) return "PRINTING_IN_PROGRESS";
  if (r < 0.45) return "READY_FOR_PICKUP";
  return "COMPLETED";
}

function pickOfficer() {
  const [email, name] = weightedPick(OFFICERS.map(([e, n, w]) => [[e, n], w]));
  return { email, name };
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / 86400000) + 1;
}

function fullYearTarget() {
  return randomInt(7000, 9500);
}

// ---------- record generation ----------

function generateRecord(submissionDate, now) {
  const { category, unit, categoryId, unitId } = pickAgency();
  const documentType = pickDocumentType(category);
  const paperSource = pickPaperSource(documentType);
  const originalPages = pickPages();
  const numberOfCopies = pickCopies();
  const colorMode = Math.random() < 0.8 ? "ขาวดำ" : "สี";
  const printSide = Math.random() < 0.6 ? "พิมพ์สองหน้า" : "พิมพ์หน้าเดียว";
  const finishingMethods = pickFinishing(documentType, printSide, originalPages);
  const paperSize = pickPaperSize();
  const itemList = documentType === "ข้อสอบ" ? pick(ITEM_LIST_EXAM) : pick(ITEM_LIST_GENERAL);
  const [requesterName, requesterEmail, requesterTel] = pick(REQUESTERS);

  const daysSince = (now - submissionDate) / 86400000;
  const status = pickStatus(daysSince);

  const appointmentDateProposed = toUtcMidnight(businessDays.minCompletionDate(submissionDate));
  const originalDocDeadline = businessDays.computeDropoffDeadline(submissionDate).date;

  const record = {
    requesterEmail, requesterName, requesterTel,
    agencyCategory: category, agencyUnit: unit, agencyCategoryId: categoryId, agencyUnitId: unitId,
    paperSize, colorMode, printSide, finishingMethods,
    documentType, paperSource,
    copyLabelEnabled: false, copyLabelMode: null, copyLabelPrefix: null, copyLabelStart: null, copyLabelManual: [],
    itemList, originalPages, numberOfCopies,
    submissionDate, originalDocDeadline,
    originalDocReceivedTimestamp: null,
    appointmentDateProposed, appointmentDateConfirmed: null,
    claimCode: null, status,
    reviewedByOfficerEmail: null, reviewedByOfficerName: null,
    handedOverByOfficerEmail: null, handedOverByOfficerName: null,
    rejectionReason: null,
    receiverName: null, receiverPosition: null, receiverWorkplace: null, receiverWorkPhone: null,
    completedTimestamp: null,
    _needsRunNumber: false
  };

  if (status === "REJECTED") {
    const officer = pickOfficer();
    record.reviewedByOfficerEmail = officer.email;
    record.reviewedByOfficerName = officer.name;
    record.rejectionReason = pick(REJECTION_REASONS);
    return record;
  }

  if (status === "AWAITING_ORIGINAL_DOCUMENT") return record;

  // PRINTING_IN_PROGRESS / READY_FOR_PICKUP / COMPLETED — all passed approval
  const officer = pickOfficer();
  record.reviewedByOfficerEmail = officer.email;
  record.reviewedByOfficerName = officer.name;
  record.claimCode = String(randomInt(0, 999999)).padStart(6, "0");
  record.originalDocReceivedTimestamp = new Date(submissionDate.getTime() + randomInt(1, 6) * 3600 * 1000);
  record.appointmentDateConfirmed = appointmentDateProposed;
  record._needsRunNumber = true;

  if (status === "COMPLETED") {
    const handoverOfficer = pickOfficer();
    record.receiverName = requesterName.replace(/^(ดร\.|อ\.|คุณ)\s*/, "");
    record.receiverPosition = pick(RECEIVER_POSITIONS);
    record.receiverWorkplace = unit.replace(/\s*\(.*\)$/, "");
    record.receiverWorkPhone = `053-9${randomInt(10, 99)}-${randomInt(100, 999)}`;
    record.handedOverByOfficerEmail = handoverOfficer.email;
    record.handedOverByOfficerName = handoverOfficer.name;
    const completed = new Date(record.appointmentDateConfirmed);
    completed.setHours(randomInt(9, 14), randomInt(0, 59), 0, 0);
    record.completedTimestamp = completed;
  }

  return record;
}

// ---------- main ----------

async function main() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  await loadAgencyIds();

  console.log("Deleting existing requests/counters...");
  await prisma.request.deleteMany({});
  await prisma.counter.deleteMany({});

  const records = [];
  for (const year of years) {
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = year === currentYear ? now : new Date(year, 11, 31, 23, 59, 59, 999);
    const elapsedFraction = year === currentYear ? dayOfYear(now) / 365 : 1;
    const target = Math.max(1, Math.round(fullYearTarget() * elapsedFraction));

    for (let i = 0; i < target; i++) {
      const submissionDate = randomBusinessDayInRange(yearStart, yearEnd);
      records.push(generateRecord(submissionDate, now));
    }
    console.log(`Year ${year}: generated ${target} requests.`);
  }

  // Assign requestReferenceNo sequentially per submission year.
  const byYearReq = {};
  records.forEach((r) => {
    const y = r.submissionDate.getFullYear();
    (byYearReq[y] = byYearReq[y] || []).push(r);
  });
  Object.keys(byYearReq).forEach((y) => {
    byYearReq[y].sort((a, b) => a.submissionDate - b.submissionDate);
    byYearReq[y].forEach((r, idx) => {
      r.requestReferenceNo = `REQ-${y}-${String(idx + 1).padStart(6, "0")}`;
    });
  });

  // Assign runNumber sequentially per submission year, approved requests only.
  const byYearRn = {};
  records.filter((r) => r._needsRunNumber).forEach((r) => {
    const y = r.submissionDate.getFullYear();
    (byYearRn[y] = byYearRn[y] || []).push(r);
  });
  Object.keys(byYearRn).forEach((y) => {
    byYearRn[y].sort((a, b) => a.submissionDate - b.submissionDate);
    byYearRn[y].forEach((r, idx) => {
      r.runNumber = `RN-${y}-${String(idx + 1).padStart(6, "0")}`;
    });
  });

  const insertData = records.map((r) => {
    const { _needsRunNumber, ...clean } = r;
    return clean;
  });

  console.log(`Inserting ${insertData.length} requests...`);
  const CHUNK = 1000;
  for (let i = 0; i < insertData.length; i += CHUNK) {
    await prisma.request.createMany({ data: insertData.slice(i, i + CHUNK) });
    console.log(`  ...${Math.min(i + CHUNK, insertData.length)}/${insertData.length}`);
  }

  console.log("Resetting counters...");
  for (const y of Object.keys(byYearReq)) {
    await prisma.counter.upsert({
      where: { counterType_year: { counterType: "REQ", year: Number(y) } },
      create: { counterType: "REQ", year: Number(y), lastValue: byYearReq[y].length },
      update: { lastValue: byYearReq[y].length }
    });
  }
  for (const y of Object.keys(byYearRn)) {
    await prisma.counter.upsert({
      where: { counterType_year: { counterType: "RN", year: Number(y) } },
      create: { counterType: "RN", year: Number(y), lastValue: byYearRn[y].length },
      update: { lastValue: byYearRn[y].length }
    });
  }

  console.log(`Done. Total requests: ${insertData.length}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
