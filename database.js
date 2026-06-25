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

  contractors.forEach(c => {
    db.run(
      `INSERT INTO contractors
       (name,tagline,work_types,styles,budget_min,budget_max,province,district,lat,lng,
        founded_year,capital,team_size,engineers,architects,warranty_years,rating,review_count,
        projects_done,verified,about,phone,email,documents)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.name, c.tagline, JSON.stringify(c.work_types), JSON.stringify(c.styles),
       c.budget_min, c.budget_max, c.province, c.district, c.lat, c.lng,
       c.founded_year, c.capital, c.team_size, c.engineers, c.architects, c.warranty_years,
       c.rating, c.review_count, c.projects_done, c.verified, c.about, c.phone, c.email,
       JSON.stringify(c.documents)]
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

  persist();
  console.log('✅ Seeded contractors, portfolios, reviews');
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
