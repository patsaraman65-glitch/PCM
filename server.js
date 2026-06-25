const express = require('express');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');
const dbModule = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC));

// ── uploads ──────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => cb(null, uploadDir),
    filename:    (req, f, cb) => cb(null, `${Date.now()}_${f.originalname}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});
app.use('/uploads', express.static(uploadDir));

// ── helpers ──────────────────────────────────────────────────────
const J = (s, d=[]) => {
  if (Array.isArray(s) || (s && typeof s === 'object')) return s;
  try { return JSON.parse(s); } catch { return d; }
};
const haversine = (a1,o1,a2,o2) => {
  const R=6371, t=x=>x*Math.PI/180;
  const dLat=t(a2-a1), dLng=t(o2-o1);
  const h=Math.sin(dLat/2)**2 + Math.cos(t(a1))*Math.cos(t(a2))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

// ════════════════════════════════════════════════════════════════
//  AI MATCHING ENGINE
//  ประเภทงาน 30% | งบ 20% | ระยะทาง 15% | ผลงาน 20% | รีวิว 15%
// ════════════════════════════════════════════════════════════════
function computeMatch(project, contractor, portfolios) {
  // 1) work type 30
  const cTypes = J(contractor.work_types);
  const typeScore = cTypes.includes(project.work_type) ? 1
                  : cTypes.length ? 0.3 : 0;

  // 2) budget 20 — overlap ratio
  let budgetScore = 0;
  const pLo=project.budget_min, pHi=project.budget_max||project.budget_min;
  const cLo=contractor.budget_min, cHi=contractor.budget_max||contractor.budget_min;
  if (cHi>0 && pHi>0) {
    const lo=Math.max(pLo,cLo), hi=Math.min(pHi,cHi);
    if (hi>=lo) budgetScore = 1;
    else {
      const gap = lo>cHi ? lo-cHi : cLo-hi;
      const ref = Math.max(pHi,cHi);
      budgetScore = Math.max(0, 1 - gap/ref);
    }
  }

  // 3) distance 15 — within 150km scales 1→0
  let distScore = 0.5, dist = null;
  if (project.lat && contractor.lat) {
    dist = haversine(project.lat, project.lng, contractor.lat, contractor.lng);
    distScore = Math.max(0, 1 - dist/150);
  }

  // 4) portfolio 20 — matching type/style works
  const rel = portfolios.filter(p =>
    p.category && (project.work_type.includes('บ้าน') ? true : true) // any portfolio counts a bit
  );
  const styleMatch = portfolios.filter(p => p.style === project.style).length;
  const portfolioScore = Math.min(1, (portfolios.length*0.15) + (styleMatch*0.25));

  // 5) review 15
  const reviewScore = (contractor.rating||0)/5;

  const breakdown = {
    workType:  Math.round(typeScore*30),
    budget:    Math.round(budgetScore*20),
    distance:  Math.round(distScore*15),
    portfolio: Math.round(portfolioScore*20),
    review:    Math.round(reviewScore*15),
  };
  const score = breakdown.workType+breakdown.budget+breakdown.distance+breakdown.portfolio+breakdown.review;
  return { score, breakdown, distanceKm: dist!=null ? Math.round(dist) : null };
}

// ════════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════════
dbModule.getDb().then(() => {
  const { all, get, run } = dbModule;

  const hydrate = c => c && ({
    ...c,
    work_types: J(c.work_types), styles: J(c.styles), documents: J(c.documents),
  });

  // ── CONTRACTORS ──────────────────────────────────────────────
  app.get('/api/contractors', (req, res) => {
    const { work_type, style, province, verified, sort } = req.query;
    let rows = all('SELECT * FROM contractors').map(hydrate);
    if (work_type) rows = rows.filter(c => c.work_types.includes(work_type));
    if (style)     rows = rows.filter(c => c.styles.includes(style));
    if (province)  rows = rows.filter(c => c.province === province);
    if (verified)  rows = rows.filter(c => c.verified === 1);
    if (sort==='rating')   rows.sort((a,b)=>b.rating-a.rating);
    if (sort==='projects') rows.sort((a,b)=>b.projects_done-a.projects_done);
    res.json(rows);
  });

  app.get('/api/contractors/:id', (req, res) => {
    const c = hydrate(get('SELECT * FROM contractors WHERE id=?', [req.params.id]));
    if (!c) return res.status(404).json({ error: 'Not found' });
    c.portfolios = all('SELECT * FROM portfolios WHERE contractor_id=?', [c.id]).map(p=>({...p, images:J(p.images)}));
    c.reviews    = all('SELECT * FROM reviews WHERE contractor_id=? ORDER BY id DESC', [c.id]);
    res.json(c);
  });

  // ── PROJECTS ─────────────────────────────────────────────────
  app.post('/api/projects', (req, res) => {
    const b = req.body;
    if (!b.work_type) return res.status(400).json({ error: 'กรุณาเลือกประเภทงาน' });
    const r = run(
      `INSERT INTO projects
       (owner_name,work_type,budget_min,budget_max,province,district,lat,lng,style,
        floors,area,bedrooms,bathrooms,detail,files)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.owner_name||'เจ้าของบ้าน', b.work_type, b.budget_min||0, b.budget_max||0,
       b.province||'', b.district||'', b.lat||13.7563, b.lng||100.5018, b.style||'',
       b.floors||1, b.area||0, b.bedrooms||0, b.bathrooms||0, b.detail||'',
       JSON.stringify(b.files||[])]
    );
    res.status(201).json(get('SELECT * FROM projects WHERE id=?', [r.lastInsertRowid]));
  });

  app.get('/api/projects/:id', (req, res) => {
    const p = get('SELECT * FROM projects WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json({ ...p, files: J(p.files) });
  });

  // ── MATCHING ─────────────────────────────────────────────────
  app.get('/api/projects/:id/matches', (req, res) => {
    const p = get('SELECT * FROM projects WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const contractors = all('SELECT * FROM contractors').map(hydrate);
    const results = contractors.map(c => {
      const folio = all('SELECT * FROM portfolios WHERE contractor_id=?', [c.id]);
      const m = computeMatch(p, c, folio);
      return { contractor: c, ...m };
    }).sort((a,b)=>b.score-a.score);
    res.json({ project:{...p, files:J(p.files)}, results });
  });

  // ── QUOTATIONS (RFQ) ─────────────────────────────────────────
  app.post('/api/quotations', (req, res) => {
    const b = req.body;
    const rfq_no = 'RFQ-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*900+100);
    const r = run(
      `INSERT INTO quotations (rfq_no,project_id,contractor_ids,note,due_date,files,status)
       VALUES (?,?,?,?,?,?,?)`,
      [rfq_no, b.project_id||null, JSON.stringify(b.contractor_ids||[]), b.note||'',
       b.due_date||null, JSON.stringify(b.files||[]), 'pending']
    );
    res.status(201).json(get('SELECT * FROM quotations WHERE id=?', [r.lastInsertRowid]));
  });
  app.get('/api/quotations', (req,res)=> res.json(
    all('SELECT * FROM quotations ORDER BY id DESC').map(q=>({...q, contractor_ids:J(q.contractor_ids), files:J(q.files)}))
  ));

  // ── MEETINGS ─────────────────────────────────────────────────
  app.post('/api/meetings', (req, res) => {
    const b = req.body;
    if (!b.contractor_id) return res.status(400).json({ error: 'ไม่ระบุผู้รับเหมา' });
    const r = run(
      `INSERT INTO meetings (contractor_id,project_id,mode,date,time,location,note,status)
       VALUES (?,?,?,?,?,?,?,?)`,
      [b.contractor_id, b.project_id||null, b.mode||'online', b.date||null, b.time||null,
       b.location||'', b.note||'', 'requested']
    );
    res.status(201).json(get('SELECT * FROM meetings WHERE id=?', [r.lastInsertRowid]));
  });
  app.get('/api/meetings', (req,res)=> res.json(all('SELECT * FROM meetings ORDER BY id DESC')));

  // ── MESSAGES (chat) ──────────────────────────────────────────
  app.get('/api/messages/:contractorId', (req, res) => {
    res.json(all('SELECT * FROM messages WHERE contractor_id=? ORDER BY id', [req.params.contractorId]));
  });
  app.post('/api/messages', (req, res) => {
    const b = req.body;
    if (!b.contractor_id) return res.status(400).json({ error: 'ไม่ระบุผู้รับเหมา' });
    const r = run(`INSERT INTO messages (contractor_id,sender,body,attachment) VALUES (?,?,?,?)`,
      [b.contractor_id, b.sender||'owner', b.body||'', b.attachment||null]);
    const msg = get('SELECT * FROM messages WHERE id=?', [r.lastInsertRowid]);

    // auto-reply mock จากผู้รับเหมา
    if ((b.sender||'owner')==='owner') {
      const replies = [
        'รับทราบครับ เดี๋ยวทีมงานประเมินแล้วส่งใบเสนอราคาให้นะครับ',
        'ขอบคุณครับ สนใจนัดเข้าดูหน้างานช่วงไหนดีครับ?',
        'ได้เลยครับ ผมส่ง BOQ เบื้องต้นให้ดูก่อนได้ครับ',
        'ยินดีให้คำปรึกษาครับ งบประมาณนี้เราดูแลได้ครับ',
      ];
      run(`INSERT INTO messages (contractor_id,sender,body) VALUES (?,?,?)`,
        [b.contractor_id, 'contractor', replies[Math.floor(Math.random()*replies.length)]]);
    }
    res.status(201).json(msg);
  });

  // ── REVIEWS ──────────────────────────────────────────────────
  app.post('/api/reviews', (req, res) => {
    const b = req.body;
    const overall = ((+b.quality + +b.punctuality + +b.communication + +b.value)/4).toFixed(1);
    const r = run(
      `INSERT INTO reviews (contractor_id,author,quality,punctuality,communication,value,overall,comment)
       VALUES (?,?,?,?,?,?,?,?)`,
      [b.contractor_id, b.author||'เจ้าของบ้าน', b.quality, b.punctuality, b.communication, b.value, overall, b.comment||'']
    );
    res.status(201).json(get('SELECT * FROM reviews WHERE id=?', [r.lastInsertRowid]));
  });

  // ════════════════════════════════════════════════════════════
  //  PHASE 2 API
  // ════════════════════════════════════════════════════════════
  const DEMO_PROJECT = 100;  // โปรเจกต์ active สำหรับ demo

  // ── WORKSPACE (dashboard hub) ────────────────────────────────
  app.get('/api/workspace/:projectId?', (req, res) => {
    const pid = req.params.projectId || DEMO_PROJECT;
    const project = get('SELECT * FROM projects WHERE id=?', [pid]);
    if (!project) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const contract = get('SELECT * FROM contracts WHERE project_id=?', [pid]);
    const contractor = contract ? hydrate(get('SELECT * FROM contractors WHERE id=?', [contract.contractor_id])) : null;
    const milestones = all('SELECT * FROM milestones WHERE project_id=? ORDER BY ord', [pid]);
    const payments   = all('SELECT * FROM payments WHERE project_id=? ORDER BY id', [pid]);
    const handover   = all('SELECT * FROM handover_items WHERE project_id=? ORDER BY id', [pid]);
    const photos     = all('SELECT * FROM site_photos WHERE project_id=? ORDER BY id', [pid]);
    const overall = milestones.length ? Math.round(milestones.reduce((s,m)=>s+m.percent,0)/milestones.length) : 0;
    res.json({
      project:{...project, files:J(project.files)},
      contract: contract ? {...contract, payment_terms:J(contract.payment_terms)} : null,
      contractor, milestones, payments, handover, photos, overall,
    });
  });

  // ── PROPOSALS ────────────────────────────────────────────────
  app.get('/api/projects/:id/proposals', (req, res) => {
    const rows = all('SELECT * FROM proposals WHERE project_id=? ORDER BY price', [req.params.id]).map(p => ({
      ...p, boq:J(p.boq), timeline:J(p.timeline),
      contractor: hydrate(get('SELECT * FROM contractors WHERE id=?', [p.contractor_id])),
    }));
    res.json(rows);
  });
  app.post('/api/proposals/:id/accept', (req, res) => {
    const p = get('SELECT * FROM proposals WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'ไม่พบข้อเสนอ' });
    run('UPDATE proposals SET status=? WHERE project_id=?', ['submitted', p.project_id]);
    run('UPDATE proposals SET status=? WHERE id=?', ['accepted', p.id]);
    res.json({ success: true });
  });

  // ── CONTRACTS ────────────────────────────────────────────────
  app.get('/api/contracts/:projectId', (req, res) => {
    const c = get('SELECT * FROM contracts WHERE project_id=?', [req.params.projectId]);
    if (!c) return res.status(404).json({ error: 'ยังไม่มีสัญญา' });
    c.payment_terms = J(c.payment_terms);
    c.contractor = hydrate(get('SELECT * FROM contractors WHERE id=?', [c.contractor_id]));
    c.project = get('SELECT * FROM projects WHERE id=?', [c.project_id]);
    res.json(c);
  });
  app.post('/api/contracts/:id/sign', (req, res) => {
    const who = req.body.who === 'contractor' ? 'signed_contractor' : 'signed_owner';
    run(`UPDATE contracts SET ${who}=1 WHERE id=?`, [req.params.id]);
    const c = get('SELECT * FROM contracts WHERE id=?', [req.params.id]);
    if (c.signed_owner && c.signed_contractor) run(`UPDATE contracts SET status='active' WHERE id=?`, [c.id]);
    res.json(get('SELECT * FROM contracts WHERE id=?', [req.params.id]));
  });

  // ── MILESTONES ───────────────────────────────────────────────
  app.put('/api/milestones/:id', (req, res) => {
    const { percent } = req.body;
    const status = percent>=100 ? 'done' : percent>0 ? 'progress' : 'pending';
    run('UPDATE milestones SET percent=?, status=? WHERE id=?', [percent, status, req.params.id]);
    res.json(get('SELECT * FROM milestones WHERE id=?', [req.params.id]));
  });

  // ── PAYMENTS ─────────────────────────────────────────────────
  app.post('/api/payments/:id/pay', (req, res) => {
    run(`UPDATE payments SET status='paid', paid_date=date('now','localtime') WHERE id=?`, [req.params.id]);
    res.json(get('SELECT * FROM payments WHERE id=?', [req.params.id]));
  });

  // ── HANDOVER ─────────────────────────────────────────────────
  app.put('/api/handover/:id', (req, res) => {
    run('UPDATE handover_items SET status=? WHERE id=?', [req.body.status||'approved', req.params.id]);
    res.json(get('SELECT * FROM handover_items WHERE id=?', [req.params.id]));
  });

  // ── PAGE ROUTES (clean URLs) ─────────────────────────────────
  const pages = ['create-project','results','profile','compare','rfq','meeting','chat',
                 'dashboard','proposals','contract','payments','handover','review'];
  app.get('/', (req,res)=> res.sendFile(path.join(PUBLIC,'index.html')));
  pages.forEach(p => app.get('/'+p, (req,res)=> res.sendFile(path.join(PUBLIC, p+'.html'))));

  app.listen(PORT, () => {
    console.log(`\n  ✅ PCM Platform → http://localhost:${PORT}\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
