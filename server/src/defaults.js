/**
 * Factory defaults for the reference data the system can't run without:
 * agency categories/units (profile + request form), a drop-off/pickup place
 * (request form + "ready" step) and the system settings row.
 *
 * ensureDefaults() fills any of these that are *empty* and never touches a
 * table that already has rows — so whatever an Admin has edited stays
 * as it is. It runs:
 *   - right after "clear all data" (src/backup.js clearAll), so a cleared
 *     system is immediately usable again;
 *   - after a backup file is loaded, in case the file's tables were empty
 *     (e.g. a file made before these tables existed);
 *   - once at startup (src/app.js), for a brand-new empty database.
 *
 * The lists match what the add_agencies / add_locations migrations seeded
 * originally. Everything here is ordinary data afterwards — editable,
 * archivable and deletable from the admin pages like anything else.
 */

const SETTINGS_ID = 1;

const DEFAULT_AGENCY_CATEGORIES = [
  {
    nameTh: "สำนักวิชา", nameEn: "School", allowsFreeText: false,
    units: [
      ["สำนักวิชาศิลปศาสตร์", "School of Liberal Arts"],
      ["สำนักวิชาวิทยาศาสตร์", "School of Science"],
      ["สำนักวิชาการจัดการ", "School of Management"],
      ["สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์", "School of Applied Digital Technology"],
      ["สำนักวิชาอุตสาหกรรมเกษตร", "School of Agro-Industry"],
      ["สำนักวิชานิติศาสตร์", "School of Law"],
      ["สำนักวิชาวิทยาศาสตร์เครื่องสำอาง", "School of Cosmetic Science"],
      ["สำนักวิชาวิทยาศาสตร์สุขภาพ", "School of Health Science"],
      ["สำนักวิชาพยาบาลศาสตร์", "School of Nursing"],
      ["สำนักวิชาเวชศาสตร์ชะลอวัยและฟื้นฟูสุขภาพ", "School of Anti-Aging and Regenerative Medicine"],
      ["สำนักวิชาแพทยศาสตร์", "School of Medicine"],
      ["สำนักวิชาทันตแพทยศาสตร์", "School of Dentistry"],
      ["สำนักวิชานวัตกรรมสังคม", "School of Social Innovation"],
      ["สำนักวิชาจีนวิทยา", "School of Sinology"],
      ["สำนักวิชาการแพทย์บูรณาการ", "School of Integrative Medicine"]
    ]
  },
  {
    nameTh: "ศูนย์", nameEn: "Centre", allowsFreeText: false,
    units: [
      ["ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ", "Centre for Digital Technology and Information"],
      ["ศูนย์เครื่องมือวิทยาศาสตร์และเทคโนโลยี", "Scientific and Technological Instruments Centre"],
      ["ศูนย์บรรณสารและสื่อการศึกษา", "Learning Resources and Educational Media Centre"],
      ["ศูนย์บริการวิชาการ", "Centre for Academic Services"],
      ["โรงพยาบาลศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง", "MFU Medical Centre Hospital"]
    ]
  },
  {
    nameTh: "สถาบัน", nameEn: "Institute", allowsFreeText: false,
    units: [
      ["สถาบันนวัตกรรมการเรียนรู้มหาวิทยาลัยแม่ฟ้าหลวง", "MFU Learning Innovation Institute"]
    ]
  },
  {
    nameTh: "สำนักงานบริหารกลาง", nameEn: "Central Administration Office", allowsFreeText: false,
    units: [
      ["ส่วนสารบรรณและอำนวยการ", "Correspondence and Document Division"],
      ["ส่วนทรัพยากรบุคคล", "Human Resources Division"],
      ["ส่วนนโยบายและแผน", "Policy and Planning Division"],
      ["ส่วนการเงินและบัญชี", "Finance and Accounting Division"],
      ["ส่วนพัสดุ", "Procurement and Supplies Division"],
      ["ส่วนประชาสัมพันธ์", "Public Relations Division"],
      ["ส่วนอาคารสถานที่", "Buildings and Grounds Division"],
      ["ส่วนนิติการ", "Division of Legal Affairs"]
    ]
  },
  {
    nameTh: "สำนักงานวิชาการ", nameEn: "Academic Affairs Office", allowsFreeText: false,
    units: [
      ["ส่วนทะเบียนและประมวลผล", "Registrar Division"],
      ["ส่วนพัฒนานักศึกษา", "Student Development Affairs Division"],
      ["ส่วนพัฒนาความสัมพันธ์ระหว่างประเทศ", "Global Relations Division"],
      ["ส่วนประกันคุณภาพการศึกษาและพัฒนาหลักสูตร", "Quality Assurance and Curriculum Development Division"],
      ["สำนักงานบัณฑิตศึกษา", "Office of the Postgraduate Studies"],
      ["ส่วนจัดหางานและฝึกงานของนักศึกษา", "Placement and Co-operative Education Division"],
      ["โรงพยาบาลมหาวิทยาลัยแม่ฟ้าหลวง กรุงเทพมหานคร", "MFU Hospital, Bangkok"],
      ["ศูนย์กีฬามหาวิทยาลัยแม่ฟ้าหลวง", "MFU Sport Complex Centre"],
      ["วนาศรม", "Wanasom"],
      ["สำนักงานให้คำปรึกษาและช่วยเหลือนักศึกษา", "Counselling Service Center"]
    ]
  },
  {
    nameTh: "สำนักงานวิจัย", nameEn: "Research Office", allowsFreeText: false,
    units: [
      ["ส่วนบริหารงานวิจัย", "Research Administration Division"],
      ["ส่วนจัดการทรัพย์สินทางปัญญาและนวัตกรรม", "Intellectual Property and Innovation Management Division"],
      ["ศูนย์นวัตกรรมสมุนไพรครบวงจร มหาวิทยาลัยแม่ฟ้าหลวง", "Medicinal Plant Innovation Centre of Mae Fah Luang University"],
      ["สถาบันศิลปวัฒนธรรมและอารยธรรมลุ่มน้ำโขง", "Institute for Mekong Basin Civilization, Art, and Culture"],
      ["ศูนย์ความเป็นเลิศทางด้านการวิจัยเชื้อรา", "Centre of Excellence in Fungal Research"],
      ["สถาบันชาและกาแฟ แห่งมหาวิทยาลัยแม่ฟ้าหลวง", "Tea and Coffee Institute of Mae Fah Luang University"],
      ["ศูนย์ความเป็นเลิศด้านนวัตกรรมผลิตภัณฑ์ธรรมชาติ", "Centre of Excellence in Natural Products Innovation"],
      ["ศูนย์จัดการทรัพยากรธรรมชาติและสิ่งแวดล้อม", "Centre for Natural Resources and Environmental Management"],
      ["ศูนย์วิจัยและนวัตกรรมสังคมเชิงพื้นที่ เพื่อการพัฒนาอย่างยั่งยืน", "Centre for Area-based Social Innovation and Research for Sustainable Development"]
    ]
  },
  {
    nameTh: "สำนักงานสภามหาวิทยาลัย", nameEn: "Office of the University Council", allowsFreeText: false,
    units: [
      ["สำนักงานสภามหาวิทยาลัย", "Office of the University Council"]
    ]
  },
  {
    nameTh: "หน่วยตรวจสอบภายใน", nameEn: "Internal Audit Division", allowsFreeText: false,
    units: [
      ["หน่วยตรวจสอบภายใน", "Internal Audit Division"]
    ]
  },
  {
    nameTh: "สำนักงานจัดการทรัพย์สินและรายได้", nameEn: "Property and Asset Management Office", allowsFreeText: false,
    units: [
      ["สำนักงานจัดการทรัพย์สินและรายได้", "Property and Asset Management Office"]
    ]
  },
  {
    nameTh: "ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง", nameEn: "MFU Wellness Centre (Northern Region & GMS)", allowsFreeText: false,
    units: [
      ["ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง", "MFU Wellness Centre"]
    ]
  },
  {
    nameTh: "หน่วยงานพิเศษ", nameEn: "Special Unit", allowsFreeText: false,
    units: [
      ["ศูนย์ภาษาและวัฒนธรรมจีนสิรินธร", "Sirindhorn Chinese Language and Culture Centre"]
    ]
  },
  {
    nameTh: "หน่วยงานอื่นๆ", nameEn: "Other", allowsFreeText: true,
    units: []
  }
];

const DEFAULT_LOCATION = {
  nameTh: "เคาน์เตอร์ฝ่ายทะเบียน",
  nameEn: "Registrar Division Counter",
  acceptsDropoff: true,
  acceptsPickup: true,
  isDefaultDropoff: true,
  isDefaultPickup: true,
  sortOrder: 1
};

const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  officerEmailNotificationsEnabled: true,
  maintenanceModeEnabled: false
};

// Works with either the Prisma client or a transaction client. Returns the
// names of the groups it filled, e.g. ["agencies", "locations"].
async function ensureDefaults(db) {
  const filled = [];

  if ((await db.agencyCategory.count()) === 0) {
    for (let i = 0; i < DEFAULT_AGENCY_CATEGORIES.length; i++) {
      const c = DEFAULT_AGENCY_CATEGORIES[i];
      const category = await db.agencyCategory.create({
        data: { nameTh: c.nameTh, nameEn: c.nameEn, allowsFreeText: c.allowsFreeText, sortOrder: i + 1 }
      });
      if (c.units.length) {
        await db.agencyUnit.createMany({
          data: c.units.map(([nameTh, nameEn], j) => ({ categoryId: category.id, nameTh, nameEn, sortOrder: j + 1 }))
        });
      }
    }
    filled.push("agencies");
  }

  if ((await db.location.count()) === 0) {
    await db.location.create({ data: DEFAULT_LOCATION });
    filled.push("locations");
  }

  if ((await db.systemSetting.count()) === 0) {
    await db.systemSetting.create({ data: DEFAULT_SETTINGS });
    filled.push("settings");
  }

  return filled;
}

module.exports = { ensureDefaults, DEFAULT_AGENCY_CATEGORIES, DEFAULT_LOCATION };
