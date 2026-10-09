# คู่มือ Deploy ODPRS บน Ubuntu (ทีละขั้น)

ไม่ต้องรู้ Linux มาก่อน แค่ก๊อปคำสั่งในกล่องไปวางทีละกล่อง แล้วกด Enter

> คำศัพท์
> - **เซิร์ฟเวอร์** คือคอมพิวเตอร์ของมหาวิทยาลัยที่จะเปิดระบบทิ้งไว้ตลอด
> - **SSH** คือการพิมพ์คำสั่งสั่งเซิร์ฟเวอร์จากเครื่องเรา ผ่านหน้าต่างดำๆ
> - **Docker** คือกล่องที่บรรจุระบบ (เว็บ + ฐานข้อมูล + HTTPS) ไว้ครบ เซิร์ฟเวอร์ไม่ต้องลงอะไรเพิ่ม

---

## 0. ก่อนเริ่ม: ถามพี่ / IT ให้ได้ข้อมูลเหล่านี้

| ต้องรู้ | ตัวอย่าง | ใช้ทำอะไร |
|---|---|---|
| IP ของเซิร์ฟเวอร์ + ชื่อผู้ใช้ + รหัสผ่าน (หรือไฟล์ key) | `10.1.2.3`, `ubuntu` | เข้าเครื่องด้วย SSH |
| ชื่อเว็บ (domain) ที่จะใช้ | `odprs.mfu.ac.th` | ให้คนพิมพ์เข้าเว็บ + ขอ HTTPS |
| domain ชี้มาที่ IP เครื่องนี้แล้วหรือยัง (DNS) | — | ไม่ชี้ = เข้าเว็บไม่ได้ |
| เครื่องนี้ออกอินเทอร์เน็ตได้ไหม และเปิด port **80, 443** ให้เข้ามาได้ไหม | — | ดาวน์โหลด Docker + ขอใบรับรอง HTTPS |
| เข้าได้จากนอกมหาลัย หรือเฉพาะในเครือข่ายมหาลัย | — | ถ้าเฉพาะภายใน วิธีทำ HTTPS ต่างไปนิด |
| ใครเป็นคนสร้าง Google OAuth ของมหาลัย (ข้อ 4) | — | ให้ล็อกอินด้วยบัญชี @mfu.ac.th ได้ |
| (ถ้ามี) SMTP สำหรับส่งอีเมล | host / user / pass | ส่งอีเมลแจ้งสถานะ ไม่มีก็ใช้ระบบได้ แค่ไม่ส่งอีเมล |

ตอนติดตั้ง Ubuntu ให้เลือก **Ubuntu 22.04 หรือ 24.04 LTS** (แบบ Server ไม่ต้องมีหน้าจอ)

---

## 1. เตรียมฝั่งเครื่องเรา (ทำก่อนไป)

1. **commit + push โค้ดล่าสุดขึ้น GitHub ให้ครบ** รวมโฟลเดอร์ `server/prisma/migrations/` ทั้งหมด และ `deploy/`, `docker-compose.prod.yml`, `Caddyfile.prod`
   ถ้าตกไฟล์ migration ไปตัวเดียว ฐานข้อมูลบนเซิร์ฟเวอร์จะสร้างไม่ครบ
2. **ถ้าจะย้ายข้อมูลปัจจุบันไปด้วย**: เปิดหน้า Admin > สำรองข้อมูล > "บันทึกข้อมูลปัจจุบัน" แล้วกด **ดาวน์โหลด** ไฟล์ `.json.gz` เก็บไว้
3. repo บน GitHub เป็น private หรือเปล่า? ถ้า private ต้องสร้าง token ไว้ใช้ตอน clone:
   GitHub > Settings > Developer settings > Personal access tokens > Fine-grained > สิทธิ์ **Contents: Read-only** เฉพาะ repo นี้

---

## 2. เข้าเซิร์ฟเวอร์ (SSH)

บน Windows เปิด **PowerShell** แล้วพิมพ์ (เปลี่ยนชื่อผู้ใช้กับ IP เป็นของจริง)

```
ssh ubuntu@10.1.2.3
```

ครั้งแรกจะถาม `Are you sure you want to continue connecting` ให้พิมพ์ `yes`
ตอนพิมพ์รหัสผ่าน จะไม่มีตัวอักษรขึ้น เป็นเรื่องปกติ พิมพ์ให้ครบแล้วกด Enter

> ทุกคำสั่งในขั้นตอนต่อไปพิมพ์ในหน้าต่างนี้

---

## 3. ดาวน์โหลดโค้ด + ติดตั้ง Docker (ทำครั้งเดียว)

```
git clone https://github.com/nongsaxso123/Document-Printing-Request-System.git odprs
cd odprs
sudo bash deploy/install-docker.sh
```

- ถ้า repo เป็น private จะถาม Username (ชื่อ GitHub) กับ Password ให้วาง **token** จากข้อ 1.3 แทนรหัสผ่าน
- `sudo` จะถามรหัสผ่านของเซิร์ฟเวอร์
- สคริปต์จะ: เพิ่ม swap (แรมสำรอง) 2GB, ติดตั้ง Docker, เปิดไฟร์วอลล์ port 22/80/443

เสร็จแล้ว **ออกแล้วเข้าใหม่ 1 ครั้ง** เพื่อให้ใช้ Docker ได้โดยไม่ต้องใส่ sudo

```
exit
```
```
ssh ubuntu@10.1.2.3
cd odprs
```

---

## 4. สร้าง Google OAuth สำหรับเว็บจริง

ทำใน [Google Cloud Console](https://console.cloud.google.com/) ด้วย **บัญชีของมหาวิทยาลัย** (ให้พี่/IT ทำ หรือให้สิทธิ์เรา)

1. APIs & Services > Credentials > Create credentials > **OAuth client ID** > Web application
2. **Authorized redirect URIs** ใส่: `https://<domain>/auth/google/callback`
   เช่น `https://odprs.mfu.ac.th/auth/google/callback` (ต้องตรงทุกตัวอักษร)
3. จด **Client ID** และ **Client secret** ไว้

---

## 5. ตั้งค่าระบบ (`server/.env`)

```
cp server/.env.example server/.env
nano server/.env
```

`nano` คือโปรแกรมแก้ไฟล์ ใช้ลูกศรเลื่อน พิมพ์แก้ได้เลย เสร็จแล้วกด **Ctrl+O → Enter** เพื่อบันทึก และ **Ctrl+X** เพื่อออก

แก้ค่าเหล่านี้:

| ค่า | ใส่อะไร |
|---|---|
| `DOMAIN` | ชื่อเว็บ เช่น `odprs.mfu.ac.th` (ไม่ต้องมี https://) |
| `POSTGRES_PASSWORD` | รหัสผ่านฐานข้อมูล สุ่มเอง (ดูคำสั่งด้านล่าง) |
| `SESSION_SECRET` | สุ่มเอง (ดูคำสั่งด้านล่าง) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | จากข้อ 4 |
| `GOOGLE_CALLBACK_URL` | `https://<domain>/auth/google/callback` |
| `ALLOW_LAMDUAN_FOR_TESTING` | `false` |
| `TEST_ALLOWED_EMAILS` | เว้นว่าง |
| `ADMIN_EMAILS` | อีเมล @mfu.ac.th ของ Admin (หลายคนคั่นด้วย `,`) |
| `SMTP_*`, `MAIL_FROM` | ถ้ามีจาก IT ถ้ายังไม่มีเว้นว่างไว้ได้ |
| `DATABASE_URL` | **ไม่ต้องแก้** ระบบสร้างให้เองจาก `POSTGRES_PASSWORD` |

สุ่มรหัสยาวๆ (รันคำสั่งนี้ 2 ครั้ง ได้ 2 ค่า แล้วก๊อปไปใส่ `POSTGRES_PASSWORD` กับ `SESSION_SECRET`):

```
openssl rand -hex 24
```

> ⚠️ ห้ามเปลี่ยน `POSTGRES_PASSWORD` หลังเปิดระบบไปแล้ว (ฐานข้อมูลจำรหัสแรกไว้ เปลี่ยนแล้วจะต่อไม่ติด)

---

## 6. เปิดระบบ

```
bash deploy/deploy.sh
```

- สคริปต์จะตรวจ `server/.env` ก่อน ถ้าลืมแก้อะไรจะบอกว่าต้องแก้ตัวไหน
- ครั้งแรกใช้เวลาประมาณ 5–10 นาที (ดาวน์โหลด + สร้าง)
- ขึ้น `✅ ระบบเปิดแล้ว` = เสร็จ เปิดเว็บ `https://<domain>` ได้เลย

ระบบจะเปิดเองทุกครั้งที่เซิร์ฟเวอร์รีสตาร์ท ไม่ต้องสั่งใหม่

---

## 7. ทดสอบหลังเปิด

- [ ] เปิดเว็บ เห็นรูปกุญแจ (HTTPS) ไม่มีคำเตือน
- [ ] ล็อกอินด้วยอีเมลใน `ADMIN_EMAILS` แล้วได้สิทธิ์ Admin
- [ ] (ถ้าย้ายข้อมูล) Admin > สำรองข้อมูล > อัปโหลดไฟล์จากข้อ 1.2 > "ใช้ไฟล์นี้"
- [ ] Admin > จัดการเจ้าหน้าที่ > เพิ่มเจ้าหน้าที่
- [ ] ส่งคำขอทดสอบ 1 รายการ > เจ้าหน้าที่อนุมัติ > ดาวน์โหลด PDF ได้
- [ ] ลองล็อกอินด้วยอีเมลนักศึกษา @lamduan ต้อง **เข้าไม่ได้**

---

## 8. งานประจำ (หลังส่งมอบ)

ทุกคำสั่งต้องอยู่ในโฟลเดอร์ `odprs` ก่อน (`cd ~/odprs`)

| อยากทำ | คำสั่ง |
|---|---|
| อัปเดตเป็นโค้ดล่าสุดจาก GitHub | `git pull` แล้ว `bash deploy/deploy.sh` |
| ดูว่าระบบทำงานอยู่ไหม | `bash deploy/deploy.sh status` (ต้องเห็น 3 ตัว `Up`) |
| ดู log เวลาเกิดปัญหา | `bash deploy/deploy.sh logs` (กด Ctrl+C เพื่อออก) |
| ปิดระบบ (ข้อมูลไม่หาย) | `bash deploy/deploy.sh stop` |
| เปิดระบบอีกครั้ง | `bash deploy/deploy.sh` |

**สำรองข้อมูล:** ไฟล์สำรองในหน้า Admin อยู่บนเซิร์ฟเวอร์เครื่องเดียวกัน ถ้าเครื่องพังจะหายไปด้วย
ควร **ดาวน์โหลดไฟล์สำรองเก็บไว้ที่อื่น** เป็นประจำ (เช่น ทุกสัปดาห์ ใส่ Google Drive ของหน่วยงาน)

**อัปเดตความปลอดภัยของ Ubuntu** (เดือนละครั้งก็พอ):

```
sudo apt update && sudo apt upgrade -y
```

---

## 9. ปัญหาที่เจอบ่อย

| อาการ | สาเหตุที่น่าจะเป็น |
|---|---|
| เปิดเว็บไม่ขึ้นเลย | domain ยังไม่ชี้มาที่เครื่องนี้ หรือ port 80/443 ถูกปิดจากฝั่ง IT |
| เว็บขึ้นแต่เตือนเรื่องใบรับรอง | Caddy ขอ HTTPS ไม่สำเร็จ ดู `docker compose -f docker-compose.prod.yml logs caddy` |
| ล็อกอินแล้วขึ้น `redirect_uri_mismatch` | Redirect URI ใน Google (ข้อ 4) ไม่ตรงกับ `GOOGLE_CALLBACK_URL` |
| ล็อกอินได้แต่ไม่ใช่ Admin | อีเมลไม่ตรงกับ `ADMIN_EMAILS` แก้แล้วรัน `bash deploy/deploy.sh` ใหม่ |
| แก้ `server/.env` แล้วไม่มีผล | ต้องรัน `bash deploy/deploy.sh` ใหม่ทุกครั้งหลังแก้ |
