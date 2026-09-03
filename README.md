# PCM — Patsara Contractor Matching

แพลตฟอร์มจับคู่เจ้าของบ้านกับผู้รับเหมา ด้วยระบบ AI Matching

## เวอร์ชัน

| เวอร์ชัน | รายละเอียด | ที่อยู่ |
|----------|------------|---------|
| **v1.0-demo** | Demo หน้าเดียว (radar/heatmap เปรียบเทียบผู้รับเหมา) | branch `v1-demo` / tag `v1.0-demo` |
| **v2 (ปัจจุบัน)** | แพลตฟอร์มเต็ม 15 ฟังก์ชัน + Admin + backend | branch `main` |

## v2 — โครงสร้าง

```
PCM/
├── server.js        Express API + AI Matching engine
├── database.js      sql.js (SQLite) schema + seed
├── public/          15 หน้าเว็บ + admin + css/js
└── render.yaml      config สำหรับ deploy บน Render
```

### ฟีเจอร์
- **Phase 1 (MVP):** Homepage, Create Project Wizard, AI Matching, Match Result, Contractor Profile, Compare, RFQ, Meeting, Chat
- **Phase 2:** Dashboard, Proposal Review, Contract, Payment Tracking, Handover, Review & Rating
- **Admin:** จัดการผู้รับเหมา + ตัวชี้วัดการประเมิน 8 เกณฑ์ (`/admin`)

### AI Matching
ประเภทงาน 30% · งบประมาณ 20% · ระยะทาง 15% · ผลงาน 20% · รีวิว 15%

## รันบนเครื่อง (local)

```bash
npm install
node server.js
# เปิด http://localhost:3000
```

## Deploy (Render)

1. เชื่อม repo นี้กับ Render (New → Web Service)
2. Render อ่าน `render.yaml` อัตโนมัติ (build: `npm install`, start: `node server.js`)
3. ได้ลิงก์สาธารณะ

> หมายเหตุ: ฐานข้อมูลเป็นไฟล์ SQLite (`pcm.db`) — บน Render free tier ข้อมูลจะ reset เมื่อ restart เหมาะสำหรับ demo อนาคตย้ายไป Supabase
