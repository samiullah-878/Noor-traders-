// tolai.js — ⚖️ TOLAI (v2.7): bori khatam hone par label ki tasveer -> AI number parhe -> ginti khud
// Har label par PC (label-print v3) number chhapta hai: "3I-47" = 23 tareekh, September, us item ka 47wan label.
// Ginti = aaj ka aakhri number (pichhla number nahi ghatate — number roz 1 se shuru hota hai).
// Data: blueAccess/tolaiConfig (duty + har size ka waqt) aur tolai/<din> (har din ka hisaab).
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 100) / 100);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Jumma', 'Hafta'];
const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => dayStr(new Date());
const hhmm = t => new Date(t).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

let cloud = null, notice = () => {}, isOwner = () => false, aiLabel = null, itemsOf = () => [], uid = () => '';
let cfg = { from: '09:30', to: '18:00', rest: 60, offDay: -1, sizes: [{ name: '1 kg', min: 1 }, { name: '500 gm', min: 2 }], items: {} };
let cfgStop = null, dayStop = null, cur = { day: '', rows: [] }, pick = today(), month = new Date();
let busy = false, view = 'main';

export function tolaiSetup(o) {
  cloud = o.cloud; notice = o.notice || notice; isOwner = o.owner || isOwner;
  aiLabel = o.aiLabel || null; itemsOf = o.items || itemsOf; uid = o.uid || uid;
  if (!cfgStop && cloud?.listenTolaiConfig) cfgStop = cloud.listenTolaiConfig(c => { if (c && Object.keys(c).length) cfg = { ...cfg, ...c }; });
  watchDay(today());
}
function watchDay(day) {
  if (cur.day === day && dayStop) return;
  dayStop?.(); cur = { day, rows: [] };
  if (cloud?.listenTolaiDay) dayStop = cloud.listenTolaiDay(day, rows => { cur = { day, rows: rows || [] }; if ($('dialog')?.open) paint(); });
}

// ---------- hisaab ----------
const minOf = (name, itemId) => {
  const own = Number(cfg.items?.[String(itemId)]); if (own > 0) return own;
  const n = String(name || '').toLowerCase();
  for (const s of (cfg.sizes || [])) { const k = String(s.name || '').toLowerCase().replace(/\s+/g, '');
    if (k && n.replace(/\s+/g, '').includes(k)) return Number(s.min) || 0; }
  return Number(cfg.sizes?.[0]?.min) || 0;
};
function dutyMins() {
  const [a, b] = String(cfg.from || '09:30').split(':').map(Number);
  const [c, d] = String(cfg.to || '18:00').split(':').map(Number);
  return Math.max(0, ((c * 60 + d) - (a * 60 + b)) - (Number(cfg.rest) || 0));
}
export function tolaiSum(rows) {
  const items = new Map();
  for (const r of (rows || [])) {
    const k = String(r.itemId || r.name);
    const e = items.get(k) || { name: r.name, itemId: r.itemId, packets: 0, at: [], min: 0 };
    e.packets += Number(r.packets) || 0; e.at.push(r.at); e.name = r.name || e.name;
    items.set(k, e);
  }
  const list = [...items.values()].map(e => ({ ...e, min: r2((Number(minOf(e.name, e.itemId)) || 0) * e.packets), at: e.at.sort((a, b) => a - b) }));
  const packets = list.reduce((n, e) => n + e.packets, 0), mins = r2(list.reduce((n, e) => n + e.min, 0));
  const duty = dutyMins(), pc = duty > 0 ? Math.round(mins / duty * 100) : 0;
  return { list: list.sort((a, b) => b.min - a.min), packets, mins, duty, pc,
    conf: pc >= 80 ? 'g' : pc >= 50 ? 'y' : 'r',
    first: Math.min(...(rows || []).map(r => r.at).filter(Boolean), Infinity),
    last: Math.max(...(rows || []).map(r => r.at).filter(Boolean), 0) };
}

// ---------- screen ----------
export function openTolai() {
  const d = $('dialog'); if (!d) return;
  view = 'main'; pick = today(); watchDay(pick);
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  paint(); if (!d.open) d.showModal();
}
function paint() {
  if (view !== 'main') return;                 // doosri screen khuli ho to na chhero
  $('dialogTitle').textContent = '⚖️ Tolai';
  const s = tolaiSum(cur.rows);
  $('dialogBody').innerHTML = `
    <button type="button" class="tl-cam" data-tl-cam="1"${busy ? ' disabled' : ''}>
      <span>📷</span><b>${busy ? 'Parh raha hoon…' : 'Label ki tasveer lein'}</b>
      <small>Bori khatam hone par aakhri packet ka label</small></button>
    <div class="tl-sum ${s.conf}">
      <div><b>${num(s.packets)}</b><small>packet</small></div>
      <div><b>${num(s.mins)}</b><small>minute</small></div>
      <div><b>${s.pc}%</b><small>kaam</small></div>
    </div>
    ${s.packets ? `<p class="tl-note">Duty ${esc(cfg.from)}–${esc(cfg.to)} · rest ${num(cfg.rest)} min = ${num(s.duty)} min${s.last ? ` · pehla ${hhmm(s.first)} · aakhri ${hhmm(s.last)}` : ''}</p>` : ''}
    <div class="tl-list">${s.list.map(e => `<div class="tl-row">
      <div><b>${esc(e.name)}</b><small>${e.at.map(hhmm).join(' · ')}</small></div>
      <div class="tl-n"><b>${num(e.packets)}</b><small>${num(e.min)} min</small></div>
    </div>`).join('') || '<p class="muted">Aaj abhi kuch nahi.</p>'}</div>
    ${cur.rows.length ? `<div class="tl-undo"><button type="button" data-tl-undo="${esc(cur.rows[cur.rows.length - 1].id)}">↩ Aakhri wapas</button></div>` : ''}
    <div class="account-tools tl-acts">
      <button type="button" data-tl-cal="1">📅 Calendar</button>
      ${isOwner() ? '<button type="button" data-tl-cfg="1">⚙️ Setting</button>' : ''}
      <button type="button" data-tl-close="1">✕ Band</button></div>`;
}

// ---------- photo -> AI ----------
async function shoot() {
  if (busy) return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = (inp.files || [])[0]; inp.remove(); if (!f) return;
    if (!aiLabel) { notice('Is login par AI nahi chalta'); return; }
    busy = true; paint();
    try {
      const got = await aiLabel({ file: f });
      busy = false;
      if (!got || !(got.n > 0)) { paint(); return askManual(got || {}); }
      confirmBox(got);
    } catch (e) { busy = false; paint(); notice('Label parha nahi gaya: ' + (e?.message || e)); }
  };
  inp.click();
}
function itemMatch(name, code) {
  const list = itemsOf() || [], n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (code) { const c = list.find(x => String(x.code || '').trim() === String(code).trim()); if (c) return c; }
  if (!n) return null;
  return list.find(x => String(x.name || '').toLowerCase().includes(n) || n.includes(String(x.name || '').toLowerCase())) || null;
}
function confirmBox(got) {
  view = 'ask';
  const it = itemMatch(got.name, got.code);
  $('dialogTitle').textContent = '⚖️ Ginti';
  $('dialogBody').innerHTML = `<div class="tl-ask">
    <p class="tl-read">Label par: <b>${esc(got.tag || got.n)}</b></p>
    <label class="it-wide"><span>Item</span><input name="name" value="${esc(it?.name || got.name || '')}" maxlength="120"></label>
    <label class="it-wide"><span>Aakhri number (aaj ka)</span><input name="n" type="number" min="1" step="1" inputmode="numeric" value="${got.n || ''}"></label>
    <p class="muted">Aaj is item ke <b>${got.n || '—'}</b> packet bane. Number ghalat ho to yahan theek kar lein.</p>
    <div class="account-tools"><button type="button" class="primary" data-tl-save="${esc(it?.id || '')}">✓ Save</button>
      <button type="button" data-tl-back="1">Wapas</button></div></div>`;
}
function askManual(got) {
  view = 'ask';
  $('dialogTitle').textContent = '⚖️ Number likhein';
  $('dialogBody').innerHTML = `<div class="tl-ask">
    <p class="tl-read amber">Number saaf nahi parha — label dekh kar likh dein.</p>
    <label class="it-wide"><span>Item</span><input name="name" value="${esc(got.name || '')}" maxlength="120"></label>
    <label class="it-wide"><span>Aakhri number (aaj ka)</span><input name="n" type="number" min="1" step="1" inputmode="numeric" autofocus></label>
    <div class="account-tools"><button type="button" class="primary" data-tl-save="">✓ Save</button>
      <button type="button" data-tl-cam="1">📷 Dobara photo</button>
      <button type="button" data-tl-back="1">Wapas</button></div></div>`;
}
async function saveRow(itemId) {
  const body = $('dialogBody');
  const name = String(body.querySelector('[name=name]')?.value || '').trim();
  const n = Math.max(0, Math.floor(Number(body.querySelector('[name=n]')?.value) || 0));
  if (!name || !(n > 0)) { notice('Item aur number likhein'); return; }
  const it = itemId ? (itemsOf() || []).find(x => String(x.id) === String(itemId)) : itemMatch(name, '');
  const before = tolaiSum(cur.rows).list.find(e => String(e.itemId || e.name) === String(it?.id || name));
  const packets = Math.max(0, n - (before?.packets || 0));      // aaj ke number se, jo pehle darj hua us ke baad
  if (!(packets > 0)) { notice('Yeh number pehle darj ho chuka hai'); view = 'main'; paint(); return; }
  try {
    await cloud.saveTolai({ day: today(), itemId: String(it?.id || ''), name: it?.name || name, packets, lastN: n, at: Date.now() });
    view = 'main'; paint(); notice(`✓ ${num(packets)} packet darj`);
  } catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- calendar ----------
async function openCal() {
  view = 'cal';
  const d = new Date(month), y = d.getFullYear(), m = d.getMonth();
  $('dialogTitle').textContent = '📅 Tolai ka hisaab';
  $('dialogBody').innerHTML = '<p class="stat-note">Le raha hoon…</p>';
  let days = {};
  try { days = (await cloud.tolaiMonth(y, m + 1)) || {}; } catch {}
  const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<div></div>');
  for (let n = 1; n <= last; n++) {
    const key = dayStr(new Date(y, m, n)), rows = days[key] || [];
    const s = rows.length ? tolaiSum(rows) : null;
    cells.push(`<button type="button" class="tl-d ${s ? s.conf : ''}${key === pick ? ' on' : ''}" data-tl-day="${key}">
      <b>${n}</b>${s ? `<small>${num(s.packets)}</small>` : ''}</button>`);
  }
  const rows = days[pick] || [], s = rows.length ? tolaiSum(rows) : null;
  const mPk = Object.values(days).reduce((n, r) => n + tolaiSum(r).packets, 0);
  const mMin = Object.values(days).reduce((n, r) => n + tolaiSum(r).mins, 0);
  const pd = new Date(pick + 'T00:00:00');
  $('dialogBody').innerHTML = `
    <div class="tl-cal-head"><button type="button" data-tl-mon="-1">‹</button>
      <b>${MONTHS[m]} ${y}</b><button type="button" data-tl-mon="1">›</button></div>
    <div class="tl-cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<small>${x}</small>`).join('')}${cells.join('')}</div>
    <div class="tl-day">
      <b>${pd.getDate()} ${MONTHS[pd.getMonth()]} · ${DAYS[pd.getDay()]}</b>
      ${s ? `<div class="tl-list">${s.list.map(e => `<div class="tl-row"><div><b>${esc(e.name)}</b><small>${e.at.map(hhmm).join(' · ')}</small></div>
        <div class="tl-n"><b>${num(e.packets)}</b><small>${num(e.min)} min</small></div></div>`).join('')}</div>
        <p class="tl-tot ${s.conf}">Kul ${num(s.packets)} packet · ${num(s.mins)} / ${num(s.duty)} minute · <b>${s.pc}%</b></p>`
      : '<p class="muted">Is din kuch nahi.</p>'}
    </div>
    <p class="tl-note">Ye mahina: <b>${num(mPk)} packet</b> · ${num(mMin)} minute</p>
    <div class="account-tools tl-acts"><button type="button" class="primary" data-tl-pdf="1">⇩ PDF</button>
      <button type="button" data-tl-main="1">‹ Wapas</button></div>`;
  calCache = { days, y, m };
}
let calCache = null;
export function tolaiReport() {
  if (!calCache) return null;
  const { days, y, m } = calCache;
  const list = Object.entries(days).sort().map(([day, rows]) => {
    const s = tolaiSum(rows), d = new Date(day + 'T00:00:00');
    return { date: `${d.getDate()} ${MONTHS[d.getMonth()]}`, wd: DAYS[d.getDay()], conf: s.conf, pc: s.pc,
      packets: num(s.packets), mins: num(s.mins), duty: num(s.duty),
      items: s.list.map(e => `${e.name} ${num(e.packets)}`).join(' · '),
      waqt: s.last ? hhmm(s.first) + '–' + hhmm(s.last) : '' };
  });
  return { title: `${MONTHS[m]} ${y}`, rows: list,
    packets: num(list.reduce((n, x) => n + Number(String(x.packets).replace(/,/g, '')), 0)),
    mins: num(list.reduce((n, x) => n + Number(String(x.mins).replace(/,/g, '')), 0)) };
}

// ---------- setting (malik) ----------
function openCfg() {
  view = 'cfg';
  $('dialogTitle').textContent = '⚙️ Tolai ki setting';
  $('dialogBody').innerHTML = `<div class="tl-cfg">
    <div class="it-head">Duty ka waqt</div>
    <div class="it-grid">
      <label class="it-f"><span>Se</span><input type="time" name="from" value="${esc(cfg.from)}"></label>
      <label class="it-f"><span>Tak</span><input type="time" name="to" value="${esc(cfg.to)}"></label>
    </div>
    <div class="it-grid">
      <label class="it-f"><span>Rest (minute)</span><input type="number" min="0" step="5" name="rest" value="${Number(cfg.rest) || 0}"></label>
      <label class="it-f"><span>Chhutti ka din</span><select name="offDay">
        <option value="-1"${cfg.offDay < 0 ? ' selected' : ''}>—</option>
        ${DAYS.map((d, i) => `<option value="${i}"${Number(cfg.offDay) === i ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
    </div>
    <div class="it-head">Ek packet mein kitna waqt</div>
    <div class="tl-sizes">${(cfg.sizes || []).map((s, i) => `<div class="it-grid">
      <label class="it-f"><span>Size</span><input name="sn${i}" value="${esc(s.name)}" maxlength="20"></label>
      <label class="it-f"><span>Minute</span><input type="number" min="0" step="any" name="sm${i}" value="${Number(s.min) || 0}"></label>
    </div>`).join('')}</div>
    <div class="account-tools"><button type="button" data-tl-size="1">➕ Aur size</button></div>
    <p class="muted">Setting badlein to sirf aane wale din badlenge — purani report waisi hi rahegi.</p>
    <div class="account-tools tl-acts"><button type="button" class="primary" data-tl-cfgsave="1">💾 Save</button>
      <button type="button" data-tl-main="1">‹ Wapas</button></div></div>`;
}
async function saveCfg() {
  const b = $('dialogBody'), g = n => b.querySelector(`[name=${n}]`);
  const sizes = [];
  for (let i = 0; i < 12; i++) { const n = g('sn' + i), m = g('sm' + i); if (!n) break;
    const name = String(n.value || '').trim(); if (name) sizes.push({ name, min: Math.max(0, Number(m?.value) || 0) }); }
  const next = { from: g('from').value || '09:30', to: g('to').value || '18:00',
    rest: Math.max(0, Number(g('rest').value) || 0), offDay: Number(g('offDay').value), sizes, items: cfg.items || {} };
  try { await cloud.setTolaiConfig(next); cfg = { ...cfg, ...next }; notice('✓ Setting save'); view = 'main'; paint(); }
  catch (e) { notice('Save nahi hua: ' + (e?.message || e)); }
}

// ---------- clicks ----------
export function tolaiClick(e) {
  const b = e.target.closest?.('[data-tl-cam],[data-tl-save],[data-tl-back],[data-tl-cal],[data-tl-cfg],[data-tl-cfgsave],[data-tl-size],[data-tl-main],[data-tl-day],[data-tl-mon],[data-tl-pdf],[data-tl-undo],[data-tl-close]');
  if (!b) return false;
  const d = b.dataset;
  if (d.tlCam != null) shoot();
  else if (d.tlSave != null) saveRow(d.tlSave);
  else if (d.tlBack != null || d.tlMain != null) { view = 'main'; paint(); }
  else if (d.tlCal != null) openCal();
  else if (d.tlCfg != null) openCfg();
  else if (d.tlCfgsave != null) saveCfg();
  else if (d.tlSize != null) { cfg.sizes = [...(cfg.sizes || []), { name: '', min: 0 }]; openCfg(); }
  else if (d.tlDay != null) { pick = d.tlDay; openCal(); }
  else if (d.tlMon != null) { month = new Date(month.getFullYear(), month.getMonth() + Number(d.tlMon), 1); openCal(); }
  else if (d.tlPdf != null) tolaiPdfOf?.();
  else if (d.tlUndo != null) undo(d.tlUndo);
  else if (d.tlClose != null) $('dialog')?.close();
  return true;
}
async function undo(id) {
  if (!confirm('Aakhri ginti wapas le lein?')) return;
  try { await cloud.delTolai(cur.day, id); notice('↩ wapas'); } catch (e) { notice('Nahi hua: ' + (e?.message || e)); }
}
let tolaiPdfOf = null;
export function setTolaiPdf(fn) { tolaiPdfOf = fn; }
