# ODPRS — Deployment Handoff Checklist (สำหรับส่งมอบให้ IT มหาวิทยาลัย)

เอกสารนี้สำหรับให้ทีมพัฒนา (นักศึกษา) ใช้เตรียมของก่อนส่งมอบ และให้ฝ่าย IT ของมหาวิทยาลัยใช้ตอนติดตั้งระบบจริงบนเซิร์ฟเวอร์ของมหาวิทยาลัย

---

## 1. สิ่งที่ต้องส่งมอบ (Deliverables)

- [ ] Source code ทั้งหมดในโฟลเดอร์ `server/` (ผ่าน Git repo หรือ zip ก็ได้)
- [ ] `docker-compose.yml`, `Caddyfile` (อยู่ที่ root ของโปรเจกต์)
- [ ] เอกสารนี้ (checklist) + SRS (`file.md` หรือ `SRS_DocPrintingReqForm_*.pdf`)
- [ ] **ไม่ส่ง** ไฟล์ `.env` จริงไปพร้อม source code แบบเปิดเผย (มี secret อยู่ข้างใน) — ส่งค่าที่จำเป็นแยกต่างหาก ผ่านช่องทางที่ปลอดภัย (เช่น พิมพ์ให้ IT กรอกเอง ไม่ใช่แนบไฟล์ในอีเมล)

---

## 2. สิ่งที่เซิร์ฟเวอร์ปลายทางต้องมี (Prerequisites)

- [ ] ติดตั้ง **Docker Engine** + **Docker Compose plugin** (เวอร์ชันใหม่พอสมควร)
- [ ] เปิด inbound port **80** และ **443** จาก internet/เครือข่ายมหาวิทยาลัยเข้ามาที่เซิร์ฟเวอร์นี้ (สำหรับ HTTPS ผ่าน Caddy)
- [ ] มี domain name จริงชี้ (DNS A record) มาที่ IP ของเซิร์ฟเวอร์นี้ เช่น `odprs.mfu.ac.th`
- [ ] เซิร์ฟเวอร์นี้ **ไม่จำเป็นต้องมี** Node.js, Postgres, หรือ tool อื่นติดตั้งไว้ก่อน — ทุกอย่างรันอยู่ใน Docker container ของตัวเอง ไม่กระทบ/ไม่ต้องเข้ากันกับ database หรือ software อื่นที่เซิร์ฟเวอร์มีอยู่แล้ว

---

## 3. ตั้งค่า Google OAuth สำหรับ production

ตอนนี้ระบบทดสอบด้วย Google OAuth client ของนักศึกษาเอง ต้องเปลี่ยนเป็นของจริงก่อนใช้งานจริง:

- [ ] ให้ผู้ดูแล Google Workspace/Cloud ของมหาวิทยาลัยสร้าง **OAuth 2.0 Client ID** ใหม่ใน Google Cloud Console (ผูกกับบัญชีองค์กร ไม่ใช่บัญชีส่วนตัวนักศึกษา)
- [ ] ตั้งค่า **Authorized redirect URI** ให้ตรงกับ domain จริง เช่น:
  `https://odprs.mfu.ac.th/auth/google/callback`
- [ ] เก็บค่า `Client ID` และ `Client Secret` ที่ได้ไว้ ใช้กรอกใน `.env` (ขั้นตอนถัดไป)

---

## 4. ตั้งค่าไฟล์ `.env` สำหรับ production

คัดลอกจาก `server/.env.example` แล้วแก้ไขค่าต่อไปนี้ (ห้ามใช้ค่าที่ใช้ตอน dev/ทดสอบ):

| ตัวแปร | ค่าที่ต้องใส่ตอน production |
|---|---|
| `DATABASE_URL` | ปล่อยตามเดิม (`postgresql://odprs:odprs@db:5432/odprs?schema=public`) — ยังชี้ไป Postgres container ภายใน แต่ **ควรเปลี่ยน password ของ `odprs` user** ให้ต่างจาก dev (ดูข้อ 4.1) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ค่าจริงจากข้อ 3 |
| `GOOGLE_CALLBACK_URL` | `https://odprs.mfu.ac.th/auth/google/callback` (โดเมนจริง) |
| `SESSION_SECRET` | สุ่มค่าใหม่ ยาวๆ (อย่าใช้ค่า dev เดิม) — เช่นสร้างด้วย `openssl rand -hex 32` |
| `ALLOWED_EMAIL_DOMAIN` | `@mfu.ac.th` (ตามเดิม) |
| `ALLOW_LAMDUAN_FOR_TESTING` | **ต้องเปลี่ยนเป็น `false`** — ค่านี้เปิดไว้แค่ตอน dev/ทดสอบเท่านั้น |
| `TEST_ALLOWED_EMAILS` | **ต้องเว้นว่าง** — ลบอีเมลทดสอบ (เช่น Gmail ส่วนตัว) ออกทั้งหมด |
| `ADMIN_EMAILS` | อีเมล @mfu.ac.th จริงของแอดมินที่จะดูแลระบบ (ไม่ใช่อีเมลนักศึกษา) |

**4.1** — แนะนำให้เปลี่ยน `POSTGRES_PASSWORD` ใน `docker-compose.yml` (service `db`) เป็นรหัสผ่านใหม่ ไม่ใช้ `odprs`/`odprs` ที่เป็นค่า dev เดิม แล้วอัปเดต `DATABASE_URL` ให้ตรงกัน

---

## 5. ปรับ `Caddyfile` ให้ใช้โดเมนจริง (เปิด HTTPS อัตโนมัติ)

ไฟล์ `Caddyfile` ปัจจุบัน (`:80 { reverse_proxy app:3000 }`) เป็นค่าสำหรับ localhost เท่านั้น ต้องแก้เป็น:

```
odprs.mfu.ac.th {
	reverse_proxy app:3000
}
```

(ใส่โดเมนจริงแทน `odprs.mfu.ac.th`) — Caddy จะขอ HTTPS certificate จาก Let's Encrypt ให้อัตโนมัติ ไม่ต้องตั้งค่า SSL เอง แต่ **ต้องเปิด port 443 ให้เข้าถึงจาก internet ได้จริง** (ข้อ 2) ไม่งั้น Caddy ขอ certificate ไม่สำเร็จ

`docker-compose.yml`'s `caddy` service ก็ต้องเพิ่ม mapping port 443 ด้วย (ปัจจุบัน map แค่ `8080:80`)

---

## 6. ขั้นตอน deploy ครั้งแรก

```
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

(รันบน production ควรใช้ `prisma migrate deploy` ไม่ใช่ `migrate dev`)

- [ ] เช็คว่า container ทั้ง 3 ตัว (`db`, `app`, `caddy`) status เป็น `Up` ด้วย `docker compose ps`
- [ ] เปิด `https://odprs.mfu.ac.th` (โดเมนจริง) แล้วเช็คว่าขึ้นหน้า login และ HTTPS ล็อกสีเขียว/ไม่มี warning

---

## 7. ทดสอบหลัง deploy (Smoke test)

- [ ] Login ด้วยบัญชี @mfu.ac.th จริง (staff) → ได้ role ที่ถูกต้อง
- [ ] Requester ยื่นคำขอใหม่ 1 รายการ → ได้เลขอ้างอิงจริง
- [ ] Officer เห็นคำขอในคิว, อนุมัติ/ปฏิเสธได้จริง
- [ ] ดาวน์โหลด PDF ได้ (ทดสอบทั้งฝั่ง Requester และ Officer)
- [ ] ลบข้อมูลทดสอบที่สร้างไว้ในขั้นตอนนี้ออกจาก production database

---

## 8. สำรองข้อมูล (Backup) — ส่งมอบให้ IT รับผิดชอบต่อ

- [ ] แจ้ง IT ว่า database จริงอยู่ใน Docker volume ชื่อ `pgdata` — แนะนำตั้ง cron job รัน `pg_dump` เป็นระยะ (รายวัน/รายสัปดาห์ตามนโยบายของมหาวิทยาลัย) แล้วเก็บไฟล์ backup ไว้นอกเซิร์ฟเวอร์นี้
- [ ] คำสั่งตัวอย่างสำหรับ backup (ใส่ใน cron ได้เลย):
  ```
  docker compose exec -T db pg_dump -U odprs -d odprs -F c > backup_$(date +%F).dump
  ```

---

## 9. หลังจากนี้ ใครดูแลอะไร

- [ ] **IT มหาวิทยาลัย**: ดูแลเซิร์ฟเวอร์ (uptime, backup, security patch ของ OS/Docker, ต่ออายุ/monitor การ deploy)
- [ ] **แอดมินระบบ (ผู้ใช้งานใน `ADMIN_EMAILS`)**: จัดการ Officer account ผ่านหน้า `/admin/officers` ในตัวแอปเอง — ไม่ต้องแตะโค้ด
- [ ] **นักศึกษา/ผู้พัฒนา**: ส่งมอบ source code + เอกสารนี้ครบแล้วถือว่าจบหน้าที่ ไม่ต้องเป็นคน maintain ต่อ เว้นแต่มีข้อตกลงเพิ่มเติมเรื่อง bug fix/support หลังส่งมอบ
