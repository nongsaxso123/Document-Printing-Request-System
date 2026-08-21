/**
 * Fixture data for exercising the Officer views (queue, detail, printing,
 * handover, history) before the Requester-side submission flow exists.
 * Run: node prisma/seed.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();

  const records = [
    {
      requestReferenceNo: `REQ-${year}-000001`,
      requesterEmail: "somchai.j@mfu.ac.th",
      requesterName: "ดร. สมชาย ใจดี",
      requesterTel: "081-234-5678",
      agencyCategory: "สำนักวิชา",
      agencyUnit: "สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์ (School of Applied Digital Technology)",
      paperSize: "A4",
      colorMode: "ขาวดำ",
      printSide: "พิมพ์สองหน้า",
      documentType: "เอกสารทั่วไป",
      paperSource: "ผู้ขอจัดเตรียมเอง",
      itemList: "เอกสารประมวลรายวิชา บทที่ 1-5",
      originalPages: 12,
      numberOfCopies: 60,
      submissionDate: addDays(now, -1),
      originalDocDeadline: addDays(now, 1),
      appointmentDateProposed: addDays(now, 4),
      status: "AWAITING_ORIGINAL_DOCUMENT"
    },
    {
      requestReferenceNo: `REQ-${year}-000002`,
      requesterEmail: "piyada.s@mfu.ac.th",
      requesterName: "อ.ปิยะดา แสงทอง",
      requesterTel: "089-555-1234",
      agencyCategory: "ศูนย์",
      agencyUnit: "ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ (Centre for Digital Technology and Information)",
      paperSize: "A4",
      colorMode: "สี",
      printSide: "พิมพ์หน้าเดียว",
      documentType: "เอกสารทั่วไป",
      paperSource: "ผู้ขอจัดเตรียมเอง",
      finishingMethods: ["เย็บมุม"],
      itemList: "โปสเตอร์ประชาสัมพันธ์กิจกรรม",
      originalPages: 3,
      numberOfCopies: 25,
      submissionDate: addDays(now, -5),
      originalDocDeadline: addDays(now, -3), // overdue — for testing the queue's overdue filter
      appointmentDateProposed: addDays(now, -1),
      status: "AWAITING_ORIGINAL_DOCUMENT"
    },
    {
      requestReferenceNo: `REQ-${year}-000003`,
      runNumber: `RN-${year}-000001`,
      requesterEmail: "weera.p@mfu.ac.th",
      requesterName: "คุณวีระ พงษ์ไพบูลย์",
      requesterTel: "085-777-8899",
      agencyCategory: "สำนักงานบริหารกลาง",
      agencyUnit: "ส่วนพัสดุ (Procurement and Supplies Division)",
      paperSize: "A4",
      colorMode: "ขาวดำ",
      printSide: "พิมพ์สองหน้า",
      documentType: "เอกสารทั่วไป",
      paperSource: "ผู้ขอจัดเตรียมเอง",
      finishingMethods: ["เข้าเล่มสันกาว"],
      itemList: "ระเบียบจัดซื้อจัดจ้าง ฉบับปรับปรุง",
      originalPages: 40,
      numberOfCopies: 15,
      submissionDate: addDays(now, -6),
      originalDocDeadline: addDays(now, -5),
      originalDocReceivedTimestamp: addDays(now, -4),
      appointmentDateProposed: addDays(now, 2),
      appointmentDateConfirmed: addDays(now, 2),
      claimCode: "482910",
      status: "PRINTING_IN_PROGRESS",
      reviewedByOfficerEmail: "jariya.t@mfu.ac.th",
      reviewedByOfficerName: "คุณจริยา ทองดี"
    },
    {
      requestReferenceNo: `REQ-${year}-000004`,
      runNumber: `RN-${year}-000002`,
      requesterEmail: "somying.t@mfu.ac.th",
      requesterName: "คุณสมหญิง ตันติวงศ์",
      requesterTel: "080-111-2233",
      agencyCategory: "สำนักงานวิชาการ",
      agencyUnit: "ส่วนพัฒนานักศึกษา (Student Development Affairs Division)",
      paperSize: "A4",
      colorMode: "สี",
      printSide: "พิมพ์สองหน้า",
      documentType: "เอกสารทั่วไป",
      paperSource: "ผู้ขอจัดเตรียมเอง",
      finishingMethods: ["เข้าเล่มห่วงสัน (Coil)"],
      itemList: "คู่มือปฐมนิเทศนักศึกษาใหม่",
      originalPages: 24,
      numberOfCopies: 300,
      submissionDate: addDays(now, -9),
      originalDocDeadline: addDays(now, -8),
      originalDocReceivedTimestamp: addDays(now, -8),
      appointmentDateProposed: addDays(now, -1),
      appointmentDateConfirmed: addDays(now, -1),
      claimCode: "603312",
      status: "READY_FOR_PICKUP",
      reviewedByOfficerEmail: "vipawan.p@mfu.ac.th",
      reviewedByOfficerName: "คุณวิภาวรรณ เพชรรัตน์"
    },
    {
      requestReferenceNo: `REQ-${year}-000005`,
      runNumber: `RN-${year}-000003`,
      requesterEmail: "somchai.j@mfu.ac.th",
      requesterName: "ดร. สมชาย ใจดี",
      requesterTel: "081-234-5678",
      agencyCategory: "สำนักวิชา",
      agencyUnit: "สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์ (School of Applied Digital Technology)",
      paperSize: "A4",
      colorMode: "ขาวดำ",
      printSide: "พิมพ์สองหน้า",
      documentType: "เอกสารทั่วไป",
      paperSource: "ผู้ขอจัดเตรียมเอง",
      itemList: "ใบประกาศนียบัตรอบรม",
      originalPages: 1,
      numberOfCopies: 50,
      submissionDate: addDays(now, -14),
      originalDocDeadline: addDays(now, -13),
      originalDocReceivedTimestamp: addDays(now, -13),
      appointmentDateProposed: addDays(now, -4),
      appointmentDateConfirmed: addDays(now, -4),
      claimCode: "215567",
      status: "COMPLETED",
      reviewedByOfficerEmail: "jariya.t@mfu.ac.th",
      reviewedByOfficerName: "คุณจริยา ทองดี",
      handedOverByOfficerEmail: "prasert.s@mfu.ac.th",
      handedOverByOfficerName: "คุณประเสริฐ ศักดิ์สิทธิ์",
      receiverName: "สมชาย ใจดี",
      receiverIdInfo: "บัตรประชาชน 1-XXXX-XXXXX-XX-X",
      completedTimestamp: addDays(now, -4)
    },
    {
      requestReferenceNo: `REQ-${year}-000006`,
      requesterEmail: "piyada.s@mfu.ac.th",
      requesterName: "อ.ปิยะดา แสงทอง",
      requesterTel: "089-555-1234",
      agencyCategory: "ศูนย์",
      agencyUnit: "ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ (Centre for Digital Technology and Information)",
      paperSize: "A4",
      colorMode: "ขาวดำ",
      printSide: "พิมพ์สองหน้า",
      documentType: "เอกสารทั่วไป",
      paperSource: "ผู้ขอจัดเตรียมเอง",
      itemList: "รายงานประจำปี ฉบับร่าง",
      originalPages: 35,
      numberOfCopies: 20,
      submissionDate: addDays(now, -16),
      originalDocDeadline: addDays(now, -15),
      originalDocReceivedTimestamp: addDays(now, -15),
      appointmentDateProposed: addDays(now, -11),
      status: "REJECTED",
      rejectionReason: "จำนวนหน้าต้นฉบับที่นำมาส่ง (28 หน้า) ไม่ตรงกับที่ระบุไว้ในคำขอ (35 หน้า)",
      reviewedByOfficerEmail: "vipawan.p@mfu.ac.th",
      reviewedByOfficerName: "คุณวิภาวรรณ เพชรรัตน์"
    }
  ];

  // create-only: re-running this after real approve/reject/handover actions
  // (e.g. during manual testing) must not clobber that live state back to
  // the original fixture values, so existing rows are left untouched.
  for (const data of records) {
    const exists = await prisma.request.findUnique({ where: { requestReferenceNo: data.requestReferenceNo } });
    if (!exists) await prisma.request.create({ data });
  }

  // Keep the atomic counters ahead of these hand-picked fixture numbers so a
  // real submission later this year won't collide with REQ/RN-<year>-00000N.
  await prisma.counter.upsert({
    where: { counterType_year: { counterType: "REQ", year } },
    create: { counterType: "REQ", year, lastValue: 6 },
    update: { lastValue: 6 }
  });
  await prisma.counter.upsert({
    where: { counterType_year: { counterType: "RN", year } },
    create: { counterType: "RN", year, lastValue: 3 },
    update: { lastValue: 3 }
  });

  console.log(`Seeded ${records.length} requests.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
