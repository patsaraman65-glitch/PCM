/* ═══════════════════════════════════════════════════════════
   PCM — shared helpers, API client, nav/footer injection
   ═══════════════════════════════════════════════════════════ */

// ── API client ──────────────────────────────────────────────
const API = {
  async get(path)        { return (await fetch('/api'+path)).json(); },
  async post(path, body) {
    const r = await fetch('/api'+path, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json()).error || 'error');
    return r.json();
  },
};

// ── localStorage state (current project / selections) ───────
const Store = {
  get(k, d=null){ try{ return JSON.parse(localStorage.getItem('pcm_'+k)) ?? d; }catch{ return d; } },
  set(k, v){ localStorage.setItem('pcm_'+k, JSON.stringify(v)); },
  del(k){ localStorage.removeItem('pcm_'+k); },
};

// ── helpers ─────────────────────────────────────────────────
const fmtMoney = n => {
  if (!n) return '-';
  if (n >= 1000000) return (n/1000000).toLocaleString('th-TH',{maximumFractionDigits:1}) + ' ล้าน';
  return Number(n).toLocaleString('th-TH');
};
const fmtBudget = (min,max) => {
  if (!min && !max) return 'ไม่ระบุ';
  if (min && max) return `${fmtMoney(min)} – ${fmtMoney(max)} บ.`;
  return fmtMoney(min||max) + ' บ.';
};
const stars = (rating) => {
  const full = Math.round(rating);
  let s = '<span class="stars">';
  for (let i=1;i<=5;i++) s += `<span class="${i<=full?'':'empty'}">★</span>`;
  return s + '</span>';
};
const initials = name => {
  const clean = name.replace(/(บริษัท|ห้างหุ้นส่วนจำกัด|จำกัด|\(.*?\))/g,'').trim();
  return clean.slice(0,2);
};
// สีประจำผู้รับเหมา (deterministic จาก id)
const palette = ['#2563eb','#0ea5e9','#14b8a6','#f59e0b','#8b5cf6','#10b981','#f43f5e','#6366f1'];
const colorOf = id => palette[(id-1) % palette.length];

function toast(msg, type='') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.className='toast '+type, 2800);
}

// ── NAVBAR ──────────────────────────────────────────────────
function renderNav(active='') {
  const links = [
    {href:'/',                label:'หน้าแรก',        key:'home'},
    {href:'/create-project',  label:'สร้างโปรเจกต์',   key:'create'},
    {href:'/results',         label:'ผลการจับคู่',     key:'results'},
    {href:'/compare',         label:'เปรียบเทียบ',     key:'compare'},
    {href:'/chat',            label:'ข้อความ',         key:'chat'},
  ];
  return `
  <nav class="nav">
    <div class="nav-inner">
      <a class="logo" href="/">
        <div class="logo-mark">PCM</div>
        <div class="logo-text"><strong>PCM</strong><span>Patsara Contractor Matching</span></div>
      </a>
      <div class="nav-links">
        ${links.map(l=>`<a class="nav-link ${l.key===active?'active':''}" href="${l.href}">${l.label}</a>`).join('')}
      </div>
      <div class="nav-actions">
        <a class="btn btn-ghost btn-sm" href="#" onclick="toast('ระบบเข้าสู่ระบบกำลังพัฒนา');return false">เข้าสู่ระบบ</a>
        <a class="btn btn-primary btn-sm" href="/create-project">เริ่มสร้างโปรเจกต์</a>
      </div>
    </div>
  </nav>`;
}

// ── FOOTER ──────────────────────────────────────────────────
function renderFooter() {
  return `
  <footer class="footer">
    <div class="container-wide">
      <div class="footer-grid">
        <div>
          <a class="logo" href="/" style="margin-bottom:14px">
            <div class="logo-mark">PCM</div>
            <div class="logo-text"><strong style="color:#fff">PCM</strong><span>Patsara Contractor Matching</span></div>
          </a>
          <p style="font-size:14px;color:#94a3b8;max-width:300px">แพลตฟอร์มจับคู่เจ้าของบ้านกับผู้รับเหมาที่เหมาะสม ด้วยระบบ AI Matching ภายในไม่กี่นาที</p>
        </div>
        <div>
          <h4>แพลตฟอร์ม</h4>
          <div class="footer-links">
            <a href="/create-project">สร้างโปรเจกต์</a>
            <a href="/results">ค้นหาผู้รับเหมา</a>
            <a href="/compare">เปรียบเทียบ</a>
          </div>
        </div>
        <div>
          <h4>สำหรับผู้รับเหมา</h4>
          <div class="footer-links">
            <a href="#" onclick="toast('กำลังพัฒนา');return false">ลงทะเบียน</a>
            <a href="#" onclick="toast('กำลังพัฒนา');return false">แพ็กเกจ</a>
            <a href="#" onclick="toast('กำลังพัฒนา');return false">คู่มือ</a>
          </div>
        </div>
        <div>
          <h4>ติดต่อ</h4>
          <div class="footer-links">
            <a href="#">support@pcm.co.th</a>
            <a href="#">02-000-0000</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">© 2026 PCM — Patsara Contractor Matching. สงวนลิขสิทธิ์</div>
    </div>
  </footer>`;
}

// auto-inject if placeholders exist
document.addEventListener('DOMContentLoaded', () => {
  const navEl = document.getElementById('nav');
  if (navEl) navEl.outerHTML = renderNav(document.body.dataset.page || '');
  const footEl = document.getElementById('footer');
  if (footEl) footEl.outerHTML = renderFooter();
});
