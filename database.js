const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_FILE = path.join(__dirname, 'pcm.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();

  // ════════════════════════════════════════════════════════════════
  //  SCHEMA — PCM Contractor Matching Platform
  // ════════════════════════════════════════════════════════════════
  db.run(`
    -- ผู้รับเหมา / บริษัท
    CREATE TABLE IF NOT EXISTS contractors (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      logo          TEXT,
      cover         TEXT,
      tagline       TEXT DEFAULT '',
      work_types    TEXT NOT NULL DEFAULT '[]',   -- JSON array ของประเภทงานที่รับ
      styles        TEXT NOT NULL DEFAULT '[]',   -- JSON array ของสไตล์ที่ถนัด
      budget_min    INTEGER DEFAULT 0,
      budget_max    INTEGER DEFAULT 0,
      province      TEXT DEFAULT '',
      district      TEXT DEFAULT '',
      lat           REAL DEFAULT 13.7563,
      lng           REAL DEFAULT 100.5018,
      founded_year  INTEGER,
      capital       INTEGER DEFAULT 0,
      team_size     INTEGER DEFAULT 0,
      engineers     INTEGER DEFAULT 0,
      architects    INTEGER DEFAULT 0,
      warranty_years INTEGER DEFAULT 1,
      rating        REAL DEFAULT 0,
      review_count  INTEGER DEFAULT 0,
      projects_done INTEGER DEFAULT 0,
      verified      INTEGER DEFAULT 0,
      about         TEXT DEFAULT '',
      phone         TEXT DEFAULT '',
      email         TEXT DEFAULT '',
      documents     TEXT NOT NULL DEFAULT '[]',   -- JSON array {name, type, verified}
      scores        TEXT NOT NULL DEFAULT '{}',   -- JSON 8 ตัวชี้วัดประเมิน (0-10)
      status        TEXT NOT NULL DEFAULT 'active', -- active | review
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ผลงาน portfolio ของผู้รับเหมา
    CREATE TABLE IF NOT EXISTS portfolios (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contractor_id INTEGER NOT NULL,
      title         TEXT NOT NULL,
      category      TEXT DEFAULT '',              -- บ้านเดี่ยว / รีโนเวท / Interior ...
      style         TEXT DEFAULT '',
      budget        INTEGER DEFAULT 0,
      year          INTEGER,
      cover         TEXT,
      images        TEXT NOT NULL DEFAULT '[]',
      description   TEXT DEFAULT ''
    );

    -- โปรเจกต์จากเจ้าของบ้าน (จาก wizard)
    CREATE TABLE IF NOT EXISTS projects (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name    TEXT DEFAULT 'เจ้าของบ้าน',
      work_type     TEXT NOT NULL,
      budget_min    INTEGER DEFAULT 0,
      budget_max    INTEGER DEFAULT 0,
      province      TEXT DEFAULT '',
      district      TEXT DEFAULT '',
      lat           REAL DEFAULT 13.7563,
      lng           REAL DEFAULT 100.5018,
      style         TEXT DEFAULT '',
      floors        INTEGER DEFAULT 1,
      area          INTEGER DEFAULT 0,
      bedrooms      INTEGER DEFAULT 0,
      bathrooms     INTEGER DEFAULT 0,
      detail        TEXT DEFAULT '',
      files         TEXT NOT NULL DEFAULT '[]',
      status        TEXT NOT NULL DEFAULT 'matching',
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ผลการจับคู่ project ↔ contractor
    CREATE TABLE IF NOT EXISTS matches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      contractor_id INTEGER NOT NULL,
      score         REAL DEFAULT 0,
      breakdown     TEXT NOT NULL DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- คำขอใบเสนอราคา (RFQ)
    CREATE TABLE IF NOT EXISTS quotations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_no        TEXT NOT NULL,
      project_id    INTEGER,
      contractor_ids TEXT NOT NULL DEFAULT '[]',
      note          TEXT DEFAULT '',
      due_date      TEXT,
      files         TEXT NOT NULL DEFAULT '[]',
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- นัดหมาย
    CREATE TABLE IF NOT EXISTS meetings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contractor_id INTEGER NOT NULL,
      project_id    INTEGER,
      mode          TEXT NOT NULL DEFAULT 'online',  -- online | site
      date          TEXT,
      time          TEXT,
      location      TEXT DEFAULT '',
      note          TEXT DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'requested',
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ข้อความแชต
    CREATE TABLE IF NOT EXISTS messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contractor_id INTEGER NOT NULL,
      sender        TEXT NOT NULL DEFAULT 'owner',   -- owner | contractor
      body          TEXT DEFAULT '',
      attachment    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- รีวิว
    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contractor_id INTEGER NOT NULL,
      author        TEXT DEFAULT 'เจ้าของบ้าน',
      quality       INTEGER DEFAULT 5,
      punctuality   INTEGER DEFAULT 5,
      communication INTEGER DEFAULT 5,
      value         INTEGER DEFAULT 5,
      overall       REAL DEFAULT 5,
      comment       TEXT DEFAULT '',
      verified      INTEGER DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ═══ PHASE 2 ═══

    -- ข้อเสนอจากผู้รับเหมา (Proposal)
    CREATE TABLE IF NOT EXISTS proposals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      contractor_id INTEGER NOT NULL,
      price         INTEGER DEFAULT 0,
      duration_days INTEGER DEFAULT 0,
      scope         TEXT DEFAULT '',
      boq           TEXT NOT NULL DEFAULT '[]',   -- JSON [{item,qty,unit,price}]
      timeline      TEXT NOT NULL DEFAULT '[]',   -- JSON [{phase,weeks}]
      warranty_years INTEGER DEFAULT 1,
      version       INTEGER DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'submitted',  -- submitted | accepted | rejected
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- สัญญา
    CREATE TABLE IF NOT EXISTS contracts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      contractor_id INTEGER NOT NULL,
      contract_no   TEXT NOT NULL,
      value         INTEGER DEFAULT 0,
      duration_days INTEGER DEFAULT 0,
      start_date    TEXT,
      scope         TEXT DEFAULT '',
      payment_terms TEXT NOT NULL DEFAULT '[]',   -- JSON [{label,percent}]
      signed_owner      INTEGER DEFAULT 0,
      signed_contractor INTEGER DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'draft',  -- draft | active | completed
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- งวดงาน / Milestone
    CREATE TABLE IF NOT EXISTS milestones (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      name          TEXT NOT NULL,
      ord           INTEGER DEFAULT 0,
      percent       INTEGER DEFAULT 0,         -- ความคืบหน้าของ milestone นี้ (0-100)
      status        TEXT NOT NULL DEFAULT 'pending'  -- pending | progress | done
    );

    -- การชำระเงิน
    CREATE TABLE IF NOT EXISTS payments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      label         TEXT NOT NULL,
      amount        INTEGER DEFAULT 0,
      due_date      TEXT,
      paid_date     TEXT,
      status        TEXT NOT NULL DEFAULT 'pending'  -- pending | paid | overdue
    );

    -- รายการส่งมอบงาน (Handover)
    CREATE TABLE IF NOT EXISTS handover_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      name          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'  -- pending | approved
    );

    -- รูปหน้างาน
    CREATE TABLE IF NOT EXISTS site_photos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER NOT NULL,
      caption       TEXT DEFAULT '',
      icon          TEXT DEFAULT '🏗️',
      period        TEXT DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  persist();

  seedIfEmpty();
  return db;
}

// ════════════════════════════════════════════════════════════════
//  SEED
// ════════════════════════════════════════════════════════════════
function seedIfEmpty() {
  const n = db.exec('SELECT COUNT(*) n FROM contractors')[0]?.values[0][0] || 0;
  if (n > 0) return;

  const contractors = [
    {
      name: 'บริษัท ขจรณ์ เอ็นจิเนียริ่ง จำกัด',
      tagline: 'รับสร้างบ้านครบวงจร มาตรฐานวิศวกรรม',
      work_types: ['สร้างบ้านใหม่', 'ต่อเติม', 'งานระบบ'],
      styles: ['Modern', 'Luxury', 'Minimal'],
      budget_min: 3000000, budget_max: 30000000,
      province: 'ปทุมธานี', district: 'คลองหลวง', lat: 14.0208, lng: 100.5250,
      founded_year: 2008, capital: 20000000, team_size: 45, engineers: 6, architects: 4,
      warranty_years: 5, rating: 4.8, review_count: 64, projects_done: 89, verified: 1,
      about: 'ผู้เชี่ยวชาญงานก่อสร้างบ้านและอาคารกว่า 15 ปี ทีมวิศวกรและสถาปนิกครบครัน รับประกันโครงสร้าง 5 ปี',
      phone: '02-555-0089', email: 'contact@khajorn-eng.co.th',
      documents: [
        {name:'หนังสือรับรองบริษัท', type:'certificate', verified:true},
        {name:'ภพ.20', type:'tax', verified:true},
        {name:'ใบอนุญาตประกอบวิชาชีพวิศวกรรม', type:'license', verified:true},
      ],
      color: '#2563eb',
    },
    {
      name: 'บริษัท เกรทโฮม ดีไซน์ จำกัด',
      tagline: 'ออกแบบตกแต่งภายใน เนรมิตทุกพื้นที่',
      work_types: ['ตกแต่งภายใน', 'รีโนเวท'],
      styles: ['Minimal', 'Nordic', 'Loft'],
      budget_min: 500000, budget_max: 8000000,
      province: 'สมุทรปราการ', district: 'บางพลี', lat: 13.6000, lng: 100.7000,
      founded_year: 2015, capital: 3000000, team_size: 18, engineers: 1, architects: 5,
      warranty_years: 2, rating: 4.6, review_count: 58, projects_done: 62, verified: 1,
      about: 'สตูดิโอออกแบบตกแต่งภายในที่เน้นดีไซน์ร่วมสมัย ใส่ใจรายละเอียด ส่งมอบงานตรงเวลา',
      phone: '02-750-0062', email: 'hello@greathome.design',
      documents: [
        {name:'หนังสือรับรองบริษัท', type:'certificate', verified:true},
        {name:'ภพ.20', type:'tax', verified:true},
        {name:'ใบอนุญาตสถาปนิก', type:'license', verified:false},
      ],
      color: '#0ea5e9',
    },
    {
      name: 'ห้างหุ้นส่วนจำกัด อัสรา เอ็นจิเนียริ่ง แอนด์ คอนสตรัคชั่น',
      tagline: 'รับเหมาก่อสร้างทั่วไป ราคาเป็นกันเอง',
      work_types: ['สร้างบ้านใหม่', 'ต่อเติม', 'รีโนเวท'],
      styles: ['Modern', 'Tropical', 'Minimal'],
      budget_min: 800000, budget_max: 12000000,
      province: 'กรุงเทพมหานคร', district: 'บางกะปิ', lat: 13.7650, lng: 100.6440,
      founded_year: 2010, capital: 5000000, team_size: 28, engineers: 3, architects: 2,
      warranty_years: 3, rating: 4.4, review_count: 41, projects_done: 45, verified: 1,
      about: 'รับเหมาก่อสร้างและต่อเติมบ้านพักอาศัย ดูแลงานเองทุกขั้นตอน ราคายุติธรรม',
      phone: '02-377-0045', email: 'asara.eng@gmail.com',
      documents: [
        {name:'หนังสือรับรองห้างหุ้นส่วน', type:'certificate', verified:true},
        {name:'ภพ.20', type:'tax', verified:true},
      ],
      color: '#14b8a6',
    },
    {
      name: 'บริษัท จีซี ซีวิล 2017 จำกัด',
      tagline: 'งานโยธาและโครงสร้างขนาดใหญ่',
      work_types: ['งานระบบ', 'ต่อเติม', 'สร้างบ้านใหม่'],
      styles: ['Modern', 'Luxury'],
      budget_min: 5000000, budget_max: 50000000,
      province: 'นนทบุรี', district: 'บางบัวทอง', lat: 13.9100, lng: 100.4250,
      founded_year: 2017, capital: 10000000, team_size: 32, engineers: 5, architects: 1,
      warranty_years: 2, rating: 4.1, review_count: 23, projects_done: 28, verified: 0,
      about: 'รับงานโยธา ถนน สะพาน และโครงสร้างขนาดกลางถึงใหญ่ ทีมวิศวกรประสบการณ์สูง',
      phone: '02-925-0028', email: 'info@gccivil2017.com',
      documents: [
        {name:'หนังสือรับรองบริษัท', type:'certificate', verified:true},
        {name:'ภพ.20', type:'tax', verified:false},
      ],
      color: '#f59e0b',
    },
    {
      name: 'บริษัท นอร์ดิก ลิฟวิ่ง สตูดิโอ จำกัด',
      tagline: 'บ้านสไตล์สแกนดิเนเวียน อบอุ่นเรียบง่าย',
      work_types: ['สร้างบ้านใหม่', 'ตกแต่งภายใน'],
      styles: ['Nordic', 'Minimal', 'Modern'],
      budget_min: 2000000, budget_max: 15000000,
      province: 'กรุงเทพมหานคร', district: 'วัฒนา', lat: 13.7400, lng: 100.5800,
      founded_year: 2018, capital: 6000000, team_size: 22, engineers: 2, architects: 6,
      warranty_years: 3, rating: 4.9, review_count: 37, projects_done: 40, verified: 1,
      about: 'สตูดิโอออกแบบและสร้างบ้านสไตล์นอร์ดิก เน้นแสงธรรมชาติ วัสดุยั่งยืน และฟังก์ชันที่ลงตัว',
      phone: '02-260-0040', email: 'studio@nordicliving.co.th',
      documents: [
        {name:'หนังสือรับรองบริษัท', type:'certificate', verified:true},
        {name:'ภพ.20', type:'tax', verified:true},
        {name:'ใบอนุญาตสถาปนิก', type:'license', verified:true},
      ],
      color: '#8b5cf6',
    },
    {
      name: 'บริษัท ทรอปิคอล โฮมบิลเดอร์ จำกัด',
      tagline: 'บ้านเขตร้อน ระบายอากาศดี อยู่สบาย',
      work_types: ['สร้างบ้านใหม่', 'ต่อเติม', 'รีโนเวท'],
      styles: ['Tropical', 'Modern', 'Loft'],
      budget_min: 1500000, budget_max: 18000000,
      province: 'ชลบุรี', district: 'บางละมุง', lat: 12.9300, lng: 100.8800,
      founded_year: 2013, capital: 8000000, team_size: 30, engineers: 4, architects: 3,
      warranty_years: 4, rating: 4.5, review_count: 49, projects_done: 55, verified: 1,
      about: 'รับสร้างบ้านสไตล์ทรอปิคอลและรีสอร์ต เชี่ยวชาญการออกแบบเพื่อสภาพอากาศร้อนชื้น',
      phone: '038-420-0055', email: 'build@tropicalhome.co.th',
      documents: [
        {name:'หนังสือรับรองบริษัท', type:'certificate', verified:true},
        {name:'ภพ.20', type:'tax', verified:true},
      ],
      color: '#10b981',
    },
  ];

  // ตัวชี้วัดการประเมิน 8 เกณฑ์ (0-10) เรียงตาม contractor ด้านบน
  const scoreSeed = [
    {price:7,quality:9,advance:7,service:7,expertise:9,workSystem:8,financial:9,experience:9}, // ขจรณ์
    {price:6,quality:8,advance:4,service:9,expertise:7,workSystem:6,financial:5,experience:7}, // เกรทโฮม
    {price:8,quality:7,advance:6,service:8,expertise:7,workSystem:8,financial:7,experience:8}, // อัสรา
    {price:5,quality:4,advance:9,service:3,expertise:5,workSystem:3,financial:4,experience:5}, // จีซี
    {price:6,quality:9,advance:5,service:8,expertise:9,workSystem:8,financial:6,experience:7}, // นอร์ดิก
    {price:7,quality:8,advance:6,service:7,expertise:8,workSystem:7,financial:7,experience:8}, // ทรอปิคอล
  ];

  contractors.forEach((c, i) => {
    db.run(
      `INSERT INTO contractors
       (name,tagline,work_types,styles,budget_min,budget_max,province,district,lat,lng,
        founded_year,capital,team_size,engineers,architects,warranty_years,rating,review_count,
        projects_done,verified,about,phone,email,documents,scores,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.name, c.tagline, JSON.stringify(c.work_types), JSON.stringify(c.styles),
       c.budget_min, c.budget_max, c.province, c.district, c.lat, c.lng,
       c.founded_year, c.capital, c.team_size, c.engineers, c.architects, c.warranty_years,
       c.rating, c.review_count, c.projects_done, c.verified, c.about, c.phone, c.email,
       JSON.stringify(c.documents), JSON.stringify(scoreSeed[i]||{}), c.verified?'active':'review']
    );
  });

  // Portfolios (2-3 ต่อราย)
  const portfolioSeed = [
    [1,'บ้านเดี่ยว 2 ชั้น สไตล์โมเดิร์น','บ้านเดี่ยว','Modern',8500000,2023,'โครงการบ้านหรูพื้นที่ใช้สอย 320 ตร.ม. 4 ห้องนอน'],
    [1,'โรงงานอุตสาหกรรม นิคมนวนคร','อาคารพาณิชย์','Modern',45000000,2022,'โครงสร้างเหล็กพื้นที่ 2,000 ตร.ม.'],
    [1,'อาคารโรงเรียนเอกชน 5 ชั้น','อาคารพาณิชย์','Luxury',22000000,2024,'อาคารเรียนพร้อมระบบครบวงจร'],
    [2,'คอนโดรีโนเวท ทองหล่อ','รีโนเวท','Loft',1800000,2023,'ปรับปรุงห้องชุด 65 ตร.ม. สไตล์ลอฟท์'],
    [2,'ออฟฟิศ Co-working ลาดพร้าว','Interior','Minimal',3200000,2023,'ออกแบบตกแต่งสำนักงาน 250 ตร.ม.'],
    [2,'บ้านพักอาศัย Nordic บางนา','Interior','Nordic',2400000,2024,'ตกแต่งภายในบ้านสไตล์นอร์ดิก'],
    [3,'บ้านสองชั้น รามอินทรา','บ้านสองชั้น','Modern',5500000,2023,'บ้านพักอาศัย 280 ตร.ม.'],
    [3,'ต่อเติมครัวและโรงรถ','ต่อเติม','Tropical',900000,2024,'ต่อเติมพื้นที่ใช้สอย 60 ตร.ม.'],
    [4,'สะพานคอนกรีต บางบัวทอง','อาคารพาณิชย์','Modern',32000000,2023,'งานโยธาโครงสร้างสะพาน'],
    [4,'ถนนเชื่อม นนทบุรี-ปทุมธานี','อาคารพาณิชย์','Modern',18000000,2022,'งานถนนคอนกรีตเสริมเหล็ก'],
    [5,'บ้าน Nordic ทาวน์โฮม สุขุมวิท','บ้านเดี่ยว','Nordic',6800000,2024,'บ้านสไตล์สแกนดิเนเวียน 240 ตร.ม.'],
    [5,'รีโนเวทบ้านเก่าเป็น Minimal','รีโนเวท','Minimal',3500000,2023,'ปรับปรุงบ้าน 2 ชั้นทั้งหลัง'],
    [6,'บ้านพูลวิลล่า พัทยา','บ้านเดี่ยว','Tropical',12000000,2023,'บ้านพร้อมสระว่ายน้ำ 400 ตร.ม.'],
    [6,'รีสอร์ตขนาดเล็ก เกาะล้าน','อาคารพาณิชย์','Tropical',16000000,2024,'อาคารพักตากอากาศ 8 ยูนิต'],
  ];
  portfolioSeed.forEach(p => {
    db.run(`INSERT INTO portfolios (contractor_id,title,category,style,budget,year,description)
            VALUES (?,?,?,?,?,?,?)`, p);
  });

  // Reviews
  const reviewSeed = [
    [1,'คุณสมชาย',5,5,5,4,4.8,'ทีมงานมืออาชีพมาก คุมงานดีเยี่ยม ส่งมอบตรงเวลา'],
    [1,'คุณวีระ',5,4,5,5,4.8,'งานโครงสร้างแข็งแรง รับประกัน 5 ปีอุ่นใจ'],
    [2,'คุณนภา',5,5,4,5,4.6,'ดีไซน์สวยถูกใจมาก แก้งานให้จนพอใจ'],
    [3,'คุณอนุชา',4,4,5,5,4.4,'ราคาเป็นกันเอง คุยง่าย งานเรียบร้อย'],
    [5,'คุณพิมพ์',5,5,5,5,4.9,'ประทับใจสุดๆ บ้านออกมาเหมือนแบบเป๊ะ'],
    [6,'คุณธนา',5,4,4,5,4.5,'บ้านเย็นสบายจริง ออกแบบเข้าใจสภาพอากาศ'],
  ];
  reviewSeed.forEach(r => {
    db.run(`INSERT INTO reviews (contractor_id,author,quality,punctuality,communication,value,overall,comment)
            VALUES (?,?,?,?,?,?,?,?)`, r);
  });

  // ═══ PHASE 2 — seed active engagement ═══
  // โปรเจกต์ตัวอย่างที่กำลังก่อสร้าง (เลือกผู้รับเหมา = ขจรณ์ id 1)
  const today = new Date();
  const iso = d => d.toISOString().slice(0,10);
  const addD = n => { const d=new Date(today); d.setDate(d.getDate()+n); return iso(d); };

  db.run(`INSERT INTO projects
    (id,owner_name,work_type,budget_min,budget_max,province,district,lat,lng,style,floors,area,bedrooms,bathrooms,detail,status)
    VALUES (100,'คุณพัสสรา','สร้างบ้านใหม่',5000000,8000000,'ปทุมธานี','คลองหลวง',14.02,100.52,'Modern',2,320,4,3,'บ้านโมเดิร์น 2 ชั้น พร้อมสระว่ายน้ำ','active')`);

  // ข้อเสนอจาก 3 ผู้รับเหมา (สำหรับ Proposal Review)
  const boq1 = [
    {item:'งานฐานราก & เสาเข็ม',qty:1,unit:'งวด',price:850000},
    {item:'งานโครงสร้าง คสล.',qty:1,unit:'งวด',price:1800000},
    {item:'งานหลังคา & มุงกระเบื้อง',qty:1,unit:'งวด',price:720000},
    {item:'งานระบบไฟฟ้า-ประปา',qty:1,unit:'งวด',price:1100000},
    {item:'งานสถาปัตย์ & ตกแต่ง',qty:1,unit:'งวด',price:2030000},
  ];
  const tl1 = [{phase:'ฐานราก',weeks:4},{phase:'โครงสร้าง',weeks:10},{phase:'หลังคา',weeks:4},{phase:'งานระบบ',weeks:6},{phase:'ตกแต่ง',weeks:8}];
  const proposals = [
    [100,1,6500000,224,'งานสร้างบ้าน 2 ชั้นครบวงจร พร้อมรับประกันโครงสร้าง 5 ปี',JSON.stringify(boq1),JSON.stringify(tl1),5,1,'accepted'],
    [100,4,7200000,210,'งานก่อสร้างพร้อมทีมวิศวกร ควบคุมงานเข้มงวด',JSON.stringify(boq1),JSON.stringify(tl1),2,1,'submitted'],
    [100,3,5900000,245,'เน้นงานตกแต่งภายในระดับพรีเมียม',JSON.stringify(boq1),JSON.stringify(tl1),3,1,'submitted'],
  ];
  proposals.forEach(p => db.run(
    `INSERT INTO proposals (project_id,contractor_id,price,duration_days,scope,boq,timeline,warranty_years,version,status)
     VALUES (?,?,?,?,?,?,?,?,?,?)`, p));

  // สัญญา (เลือกขจรณ์)
  const terms = [
    {label:'งวดที่ 1 — เซ็นสัญญา & เริ่มงานฐานราก',percent:20},
    {label:'งวดที่ 2 — งานโครงสร้างแล้วเสร็จ',percent:30},
    {label:'งวดที่ 3 — งานหลังคา & ระบบ',percent:30},
    {label:'งวดที่ 4 — ส่งมอบงาน',percent:15},
    {label:'Retention — ประกันผลงาน',percent:5},
  ];
  db.run(`INSERT INTO contracts
    (project_id,contractor_id,contract_no,value,duration_days,start_date,scope,payment_terms,signed_owner,signed_contractor,status)
    VALUES (100,1,'CT-2026-0100',6500000,224,?, 'งานก่อสร้างบ้านพักอาศัย 2 ชั้น พื้นที่ใช้สอย 320 ตร.ม.',?,1,1,'active')`,
    [addD(-40), JSON.stringify(terms)]);

  // Milestones (5 งวด มาตรฐาน)
  const ms = [
    ['งานฐานราก',1,100,'done'],
    ['งานโครงสร้าง',2,100,'done'],
    ['งานหลังคา',3,60,'progress'],
    ['งานระบบ',4,0,'pending'],
    ['งานตกแต่ง',5,0,'pending'],
  ];
  ms.forEach(m => db.run(`INSERT INTO milestones (project_id,name,ord,percent,status) VALUES (100,?,?,?,?)`, m));

  // Payments
  const pays = [
    ['งวดที่ 1 — เซ็นสัญญา & ฐานราก',1300000,addD(-40),addD(-38),'paid'],
    ['งวดที่ 2 — งานโครงสร้าง',1950000,addD(-10),addD(-8),'paid'],
    ['งวดที่ 3 — งานหลังคา & ระบบ',1950000,addD(7),null,'pending'],
    ['งวดที่ 4 — ส่งมอบงาน',975000,addD(60),null,'pending'],
    ['Retention — ประกันผลงาน',325000,addD(90),null,'pending'],
  ];
  pays.forEach(p => db.run(`INSERT INTO payments (project_id,label,amount,due_date,paid_date,status) VALUES (100,?,?,?,?,?)`, p));

  // Handover checklist
  ['As-Built Drawing','คู่มือการใช้งานอุปกรณ์','เอกสารรับประกันงาน','รายการตรวจรับงาน (Defect List)','เอกสารรับรองความปลอดภัย']
    .forEach((n,i)=> db.run(`INSERT INTO handover_items (project_id,name,status) VALUES (100,?,?)`, [n, i<2?'approved':'pending']));

  // Site photos
  const photos = [
    ['เทคอนกรีตฐานราก','🏗️','สัปดาห์ที่ 3'],
    ['งานเสา-คาน ชั้น 1','🧱','สัปดาห์ที่ 8'],
    ['โครงสร้างชั้น 2','🏢','สัปดาห์ที่ 12'],
    ['ติดตั้งโครงหลังคา','🔨','สัปดาห์ที่ 16'],
  ];
  photos.forEach(p => db.run(`INSERT INTO site_photos (project_id,caption,icon,period) VALUES (100,?,?,?)`, p));

  persist();
  console.log('✅ Seeded contractors, portfolios, reviews + Phase 2 engagement');
}

// ════════════════════════════════════════════════════════════════
//  PERSIST + QUERY HELPERS
// ════════════════════════════════════════════════════════════════
function persist() {
  if (!db) return;
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

function all(sql, params = []) {
  const r = db.exec(sql, params);
  if (!r.length) return [];
  const { columns, values } = r[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastInsertRowid = db.exec('SELECT last_insert_rowid() id')[0]?.values[0][0];
  persist();
  return { lastInsertRowid };
}

module.exports = { getDb, all, get, run, persist };
