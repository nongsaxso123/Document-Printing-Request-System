-- Two-level admin-editable agency directory (E track), replacing the
-- hardcoded AGENCY_DATA/AGENCY_CATEGORY_EN objects in
-- public/assets/js/app.js. See src/agencies.js.
CREATE TABLE "agency_categories" (
    "id" SERIAL NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "allows_free_text" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_admin_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agency_units" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_admin_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_units_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agency_units_category_id_idx" ON "agency_units"("category_id");

ALTER TABLE "agency_units" ADD CONSTRAINT "agency_units_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "agency_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requests" ADD COLUMN "agency_category_id" INTEGER;
ALTER TABLE "requests" ADD COLUMN "agency_unit_id" INTEGER;
ALTER TABLE "requests" ADD CONSTRAINT "requests_agency_category_id_fkey"
    FOREIGN KEY ("agency_category_id") REFERENCES "agency_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests" ADD CONSTRAINT "requests_agency_unit_id_fkey"
    FOREIGN KEY ("agency_unit_id") REFERENCES "agency_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "profiles" ADD COLUMN "workplace_category_id" INTEGER;
ALTER TABLE "profiles" ADD COLUMN "workplace_unit_id" INTEGER;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_workplace_category_id_fkey"
    FOREIGN KEY ("workplace_category_id") REFERENCES "agency_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_workplace_unit_id_fkey"
    FOREIGN KEY ("workplace_unit_id") REFERENCES "agency_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed from the same 12 categories / 53 units public/assets/js/app.js has
-- hardcoded (AGENCY_DATA / AGENCY_CATEGORY_EN) — generated, not hand-typed,
-- from that same source so nothing was mistyped along the way.
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สำนักวิชา', 'School', false, 1);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('ศูนย์', 'Centre', false, 2);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สถาบัน', 'Institute', false, 3);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สำนักงานบริหารกลาง', 'Central Administration Office', false, 4);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สำนักงานวิชาการ', 'Academic Affairs Office', false, 5);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สำนักงานวิจัย', 'Research Office', false, 6);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สำนักงานสภามหาวิทยาลัย', 'Office of the University Council', false, 7);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('หน่วยตรวจสอบภายใน', 'Internal Audit Division', false, 8);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('สำนักงานจัดการทรัพย์สินและรายได้', 'Property and Asset Management Office', false, 9);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง', 'MFU Wellness Centre (Northern Region & GMS)', false, 10);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('หน่วยงานพิเศษ', 'Special Unit', false, 11);
INSERT INTO "agency_categories" ("name_th", "name_en", "allows_free_text", "sort_order") VALUES ('หน่วยงานอื่นๆ', 'Other', true, 12);

INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาศิลปศาสตร์', 'School of Liberal Arts', 1 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาวิทยาศาสตร์', 'School of Science', 2 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาการจัดการ', 'School of Management', 3 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์', 'School of Applied Digital Technology', 4 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาอุตสาหกรรมเกษตร', 'School of Agro-Industry', 5 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชานิติศาสตร์', 'School of Law', 6 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาวิทยาศาสตร์เครื่องสำอาง', 'School of Cosmetic Science', 7 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาวิทยาศาสตร์สุขภาพ', 'School of Health Science', 8 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาพยาบาลศาสตร์', 'School of Nursing', 9 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาเวชศาสตร์ชะลอวัยและฟื้นฟูสุขภาพ', 'School of Anti-Aging and Regenerative Medicine', 10 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาแพทยศาสตร์', 'School of Medicine', 11 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาทันตแพทยศาสตร์', 'School of Dentistry', 12 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชานวัตกรรมสังคม', 'School of Social Innovation', 13 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาจีนวิทยา', 'School of Sinology', 14 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักวิชาการแพทย์บูรณาการ', 'School of Integrative Medicine', 15 FROM "agency_categories" WHERE "name_th" = 'สำนักวิชา';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ', 'Centre for Digital Technology and Information', 1 FROM "agency_categories" WHERE "name_th" = 'ศูนย์';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์เครื่องมือวิทยาศาสตร์และเทคโนโลยี', 'Scientific and Technological Instruments Centre', 2 FROM "agency_categories" WHERE "name_th" = 'ศูนย์';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์บรรณสารและสื่อการศึกษา', 'Learning Resources and Educational Media Centre', 3 FROM "agency_categories" WHERE "name_th" = 'ศูนย์';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์บริการวิชาการ', 'Centre for Academic Services', 4 FROM "agency_categories" WHERE "name_th" = 'ศูนย์';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'โรงพยาบาลศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง', 'MFU Medical Centre Hospital', 5 FROM "agency_categories" WHERE "name_th" = 'ศูนย์';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สถาบันนวัตกรรมการเรียนรู้มหาวิทยาลัยแม่ฟ้าหลวง', 'MFU Learning Innovation Institute', 1 FROM "agency_categories" WHERE "name_th" = 'สถาบัน';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนสารบรรณและอำนวยการ', 'Correspondence and Document Division', 1 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนทรัพยากรบุคคล', 'Human Resources Division', 2 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนนโยบายและแผน', 'Policy and Planning Division', 3 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนการเงินและบัญชี', 'Finance and Accounting Division', 4 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนพัสดุ', 'Procurement and Supplies Division', 5 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนประชาสัมพันธ์', 'Public Relations Division', 6 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนอาคารสถานที่', 'Buildings and Grounds Division', 7 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนนิติการ', 'Division of Legal Affairs', 8 FROM "agency_categories" WHERE "name_th" = 'สำนักงานบริหารกลาง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนทะเบียนและประมวลผล', 'Registrar Division', 1 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนพัฒนานักศึกษา', 'Student Development Affairs Division', 2 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนพัฒนาความสัมพันธ์ระหว่างประเทศ', 'Global Relations Division', 3 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนประกันคุณภาพการศึกษาและพัฒนาหลักสูตร', 'Quality Assurance and Curriculum Development Division', 4 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักงานบัณฑิตศึกษา', 'Office of the Postgraduate Studies', 5 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนจัดหางานและฝึกงานของนักศึกษา', 'Placement and Co-operative Education Division', 6 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'โรงพยาบาลมหาวิทยาลัยแม่ฟ้าหลวง กรุงเทพมหานคร', 'MFU Hospital, Bangkok', 7 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์กีฬามหาวิทยาลัยแม่ฟ้าหลวง', 'MFU Sport Complex Centre', 8 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'วนาศรม', 'Wanasom', 9 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักงานให้คำปรึกษาและช่วยเหลือนักศึกษา', 'Counselling Service Center', 10 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิชาการ';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนบริหารงานวิจัย', 'Research Administration Division', 1 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ส่วนจัดการทรัพย์สินทางปัญญาและนวัตกรรม', 'Intellectual Property and Innovation Management Division', 2 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์นวัตกรรมสมุนไพรครบวงจร มหาวิทยาลัยแม่ฟ้าหลวง', 'Medicinal Plant Innovation Centre of Mae Fah Luang University', 3 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สถาบันศิลปวัฒนธรรมและอารยธรรมลุ่มน้ำโขง', 'Institute for Mekong Basin Civilization, Art, and Culture', 4 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์ความเป็นเลิศทางด้านการวิจัยเชื้อรา', 'Centre of Excellence in Fungal Research', 5 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สถาบันชาและกาแฟ แห่งมหาวิทยาลัยแม่ฟ้าหลวง', 'Tea and Coffee Institute of Mae Fah Luang University', 6 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์ความเป็นเลิศด้านนวัตกรรมผลิตภัณฑ์ธรรมชาติ', 'Centre of Excellence in Natural Products Innovation', 7 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์จัดการทรัพยากรธรรมชาติและสิ่งแวดล้อม', 'Centre for Natural Resources and Environmental Management', 8 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์วิจัยและนวัตกรรมสังคมเชิงพื้นที่ เพื่อการพัฒนาอย่างยั่งยืน', 'Centre for Area-based Social Innovation and Research for Sustainable Development', 9 FROM "agency_categories" WHERE "name_th" = 'สำนักงานวิจัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักงานสภามหาวิทยาลัย', 'Office of the University Council', 1 FROM "agency_categories" WHERE "name_th" = 'สำนักงานสภามหาวิทยาลัย';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'หน่วยตรวจสอบภายใน', 'Internal Audit Division', 1 FROM "agency_categories" WHERE "name_th" = 'หน่วยตรวจสอบภายใน';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'สำนักงานจัดการทรัพย์สินและรายได้', 'Property and Asset Management Office', 1 FROM "agency_categories" WHERE "name_th" = 'สำนักงานจัดการทรัพย์สินและรายได้';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง', 'MFU Wellness Centre', 1 FROM "agency_categories" WHERE "name_th" = 'ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง';
INSERT INTO "agency_units" ("category_id", "name_th", "name_en", "sort_order")
SELECT "id", 'ศูนย์ภาษาและวัฒนธรรมจีนสิรินธร', 'Sirindhorn Chinese Language and Culture Centre', 1 FROM "agency_categories" WHERE "name_th" = 'หน่วยงานพิเศษ';

-- Backfill existing Request/Profile rows (including the 3-year synthetic
-- dataset) by matching their stored strings against the rows just seeded.
-- agency_unit historically stores "<name_th> (<name_en>)" (the same
-- concatenation AGENCY_DATA used) when a real unit was picked, or plain
-- free-typed text under an allows_free_text category — the latter never
-- matches an agency_units row, which is expected (see the Request model's
-- comment): it keeps its string, just gets no unit id.
UPDATE "requests" r SET "agency_category_id" = c."id"
FROM "agency_categories" c WHERE c."name_th" = r."agency_category";

UPDATE "requests" r SET "agency_unit_id" = u."id"
FROM "agency_units" u
WHERE u."category_id" = r."agency_category_id"
  AND (u."name_th" || ' (' || u."name_en" || ')') = r."agency_unit";

UPDATE "profiles" p SET "workplace_category_id" = c."id"
FROM "agency_categories" c WHERE c."name_th" = p."workplace_category";

UPDATE "profiles" p SET "workplace_unit_id" = u."id"
FROM "agency_units" u
WHERE u."category_id" = p."workplace_category_id"
  AND (u."name_th" || ' (' || u."name_en" || ')') = p."workplace_unit";
