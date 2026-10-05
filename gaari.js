// gaari.js — 🚚 GAARI KA HISAAB (v2.92, 2026-10-05)
// Ek gaari (GJL640630): bilty / kiraya, driver commission, diesel (litre, rate, meter reading), kharche, Falcon-i tracker ke km
// (screenshot -> AI). Mahine ka nafa/nuqsan, asal average vs 5.5, "diesel kitna banna chahiye tha" — farq par laal nishan.
// Data: businesses/noor-traders/gaari/{id}  (kind: bilty | diesel | kharch | reading | tracker | driver) + gaari/_config.
// Likhte: malik, Full mulazim, "Sirf Gaari" (driver). Mitana: malik (ya apni aaj ki entry).
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: d });
const rs = v => 'Rs ' + num(Math.round(Number(v) || 0));
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KHARCH = ['Toll / parchi', 'Repair', 'Tyre', 'Oil / filter', 'Khana', 'Police / challan', 'Parking', 'Doosra'];

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '', modal = null, closeModal = () => {}, ai = null, pdf = null, shrink = null;
let un = null, rows = [], cfg = { avg: 5.5, commType: 'pct', commVal: 10, driver: '', no: 'GJL640630' }, month = today().slice(0, 7), mounted = false, err = '';

export function gaariSetup(o) {
  cloud = o.cloud; notice = o.notice || notice; isOwner = o.owner || isOwner; byName = o.byName || byName; uidOf = o.uid || uidOf;
  modal = o.modal; closeModal = o.close || closeModal; ai = o.ai || null; pdf = o.pdf || null; shrink = o.shrink || null;
}
export function gaariStop() { if (!mounted) return; mounted = false; try { un?.(); } catch {} un = null; }

function start() {
  if (un || !cloud?.listenGaari) return;
  un = cloud.listenGaari(list => {
    err = '';
    const c = list.find(r => r.id === '_config'); if (c) cfg = { ...cfg, ...c };
    rows = list.filter(r => r.id !== '_config' && !r.deleted);
    if (mounted) paint();
  }, e => { err = e?.message || 'rabta nahi'; if (mounted) paint(); });
}

export function renderGaari() {
  mounted = true;
  if ($('list')) $('list').innerHTML = '';
  if ($('actions')) $('actions').innerHTML = '';
  if ($('tabs')) $('tabs').hidden = true;
  start(); paint();
}

const commOf = b => b.comm != null && b.comm !== '' ? Number(b.comm) || 0 : (cfg.commType === 'fixed' ? Number(cfg.commVal) || 0 : r2((Number(b.kiraya) || 0) * (Number(cfg.commVal) || 0) / 100));
const inMonth = r => String(r.date || '').slice(0, 7) === month;

function calc() {
  const m = rows.filter(inMonth);
  const by = k => m.filter(r => r.kind === k);
  const bilty = by('bilty'), diesel = by('diesel'), kharch = by('kharch'), tracker = by('tracker'), driver = by('driver');
  const kiraya = bilty.reduce((s, b) => s + (Number(b.kiraya) || 0), 0);
  const comm = bilty.reduce((s, b) => s + commOf(b), 0);
  const litre = diesel.reduce((s, d) => s + (Number(d.litre) || 0), 0);
  const dieselRs = diesel.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const kharchRs = kharch.reduce((s, k) => s + (Number(k.amount) || 0), 0);
  const kharchCat = {}; kharch.forEach(k => { kharchCat[k.cat || 'Doosra'] = (kharchCat[k.cat || 'Doosra'] || 0) + (Number(k.amount) || 0); });
  // meter: pichhle mahine ki aakhri reading (ya is mahine ki pehli) se is mahine ki aakhri tak
  const rd = rows.filter(r => Number(r.reading) > 0).map(r => ({ d: String(r.date || ''), at: Number(r.at) || 0, v: Number(r.reading) })).sort((a, b) => a.d.localeCompare(b.d) || a.at - b.at);
  const before = rd.filter(x => x.d.slice(0, 7) < month), inside = rd.filter(x => x.d.slice(0, 7) === month);
  const startR = before.length ? before[before.length - 1].v : (inside[0]?.v || 0), endR = inside.length ? inside[inside.length - 1].v : 0;
  const km = endR && startR && endR > startR ? endR - startR : 0;
  const trackerKm = tracker.reduce((s, t) => s + (Number(t.km) || 0), 0);
  const avg = Number(cfg.avg) || 5.5;
  const realAvg = litre > 0 && km > 0 ? km / litre : 0;
  const shouldL = km > 0 ? km / avg : 0;
  const extraL = litre - shouldL, rate = litre > 0 ? dieselRs / litre : 0;
  const paid = driver.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const kharchTotal = dieselRs + comm + kharchRs;
  const nafa = kiraya - kharchTotal;
  // driver ka kul baqaya (sab mahine)
  const allComm = rows.filter(r => r.kind === 'bilty').reduce((s, b) => s + commOf(b), 0), allPaid = rows.filter(r => r.kind === 'driver').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  return { m, bilty, diesel, kharch, tracker, driver, kiraya, comm, litre, dieselRs, kharchRs, kharchCat, startR, endR, km, trackerKm, avg, realAvg, shouldL, extraL, rate, paid, kharchTotal, nafa, perKm: km > 0 ? kharchTotal / km : 0, driverBaqi: allComm - allPaid };
}

function monthName(m) { const [y, mm] = m.split('-'); return MONTHS[Number(mm) - 1] + ' ' + y; }
function shiftMonth(d) { const [y, m] = month.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); month = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; paint(); }

function alerts(c) {
  const a = [];
  if (c.km > 0 && c.litre > 0 && c.extraL > Math.max(5, c.shouldL * 0.08)) a.push(`⛽ Diesel <b>${num(c.extraL, 1)} litre zyada</b> laga (~${rs(c.extraL * c.rate)}) — ${num(c.km)} km par ${num(c.shouldL, 1)} L banta tha (average ${c.avg})`);
  if (c.km > 0 && c.trackerKm > 0 && Math.abs(c.km - c.trackerKm) > Math.max(30, c.km * 0.05)) a.push(`📍 Meter ${num(c.km)} km, tracker ${num(c.trackerKm)} km — <b>${num(Math.abs(c.km - c.trackerKm))} km ka farq</b>`);
  if (c.km === 0 && c.litre > 0) a.push('📍 Is mahine ki meter reading nahi — diesel ka hisaab adhoora (diesel daalte waqt reading zaroor likhein)');
  return a;
}

function paint() {
  const sum = $('summary'); if (!sum) return;
  const c = calc(), al = alerts(c);
  const own = isOwner();
  sum.innerHTML = `<div class="gr-card">
    <div class="gr-head"><div><small>🚚 ${esc(cfg.no || 'Gaari')}${cfg.driver ? ' · ' + esc(cfg.driver) : ''}</small><b>Gaari ka hisaab</b></div>
      <div class="gr-month"><button type="button" data-gr-m="-1">‹</button><span>${esc(monthName(month))}</span><button type="button" data-gr-m="1">›</button></div></div>
    ${err ? `<p class="gr-err">⚠ ${esc(err)}</p>` : ''}
    <div class="gr-big ${c.nafa >= 0 ? 'up' : 'down'}"><small>${c.nafa >= 0 ? 'Nafa' : 'Nuqsan'}</small><strong>${rs(Math.abs(c.nafa))}</strong><em>Kiraya ${rs(c.kiraya)} − kharch ${rs(c.kharchTotal)}</em></div>
    <div class="gr-grid">
      <div><small>Chali</small><b>${num(c.km)} km</b><em>${c.startR ? num(c.startR) + ' → ' + num(c.endR) : 'reading nahi'}</em></div>
      <div><small>Tracker</small><b>${c.trackerKm ? num(c.trackerKm) + ' km' : '—'}</b><em>Falcon-i</em></div>
      <div><small>Diesel</small><b>${num(c.litre, 1)} L</b><em>${rs(c.dieselRs)}${c.rate ? ' · ' + num(c.rate, 1) + '/L' : ''}</em></div>
      <div><small>Average</small><b class="${c.realAvg && c.realAvg < c.avg * 0.92 ? 'bad' : ''}">${c.realAvg ? num(c.realAvg, 2) : '—'}</b><em>chahiye ${c.avg} km/L</em></div>
      <div><small>Bilty</small><b>${c.bilty.length}</b><em>${rs(c.kiraya)}</em></div>
      <div><small>Driver commission</small><b>${rs(c.comm)}</b><em>${cfg.commType === 'fixed' ? rs(cfg.commVal) + ' fi bilty' : num(cfg.commVal, 1) + '% kiraya'}</em></div>
      <div><small>Doosre kharche</small><b>${rs(c.kharchRs)}</b><em>${c.kharch.length} entry</em></div>
      <div><small>Fi km kharch</small><b>${c.perKm ? 'Rs ' + num(c.perKm, 1) : '—'}</b><em>sab mila kar</em></div>
    </div>
    ${al.length ? `<div class="gr-alerts">${al.map(x => `<p>${x}</p>`).join('')}</div>` : (c.km && c.litre ? '<p class="gr-ok">✅ Diesel aur km theek mel kha rahe hain</p>' : '')}
    <p class="gr-driver">👤 Driver ka baqaya (sab mahine): <b>${rs(c.driverBaqi)}</b>${c.paid ? ` · is mahine diye ${rs(c.paid)}` : ''}</p>
    <div class="gr-btns">
      <button type="button" data-gr-add="bilty">📄 Bilty / kiraya</button><button type="button" data-gr-add="diesel">⛽ Diesel</button>
      <button type="button" data-gr-add="kharch">🧾 Kharcha</button><button type="button" data-gr-add="reading">📍 Meter reading</button>
      <button type="button" data-gr-add="tracker">📸 Tracker km</button>${own ? '<button type="button" data-gr-add="driver">👤 Driver ko diye</button>' : ''}
      <button type="button" data-gr-pdf="1">⇩ PDF</button>${own ? '<button type="button" data-gr-cfg="1">⚙ Setting</button>' : ''}
    </div></div>`;
  const list = $('list'); if (!list) return;
  const sorted = c.m.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.at) || 0) - (Number(a.at) || 0));
  list.innerHTML = sorted.length ? `<div class="gr-list">${sorted.map(r => rowHTML(r)).join('')}</div>` : `<p class="gr-empty">${esc(monthName(month))} mein abhi koi entry nahi. Upar se bilty, diesel ya reading daalein.</p>`;
}

function rowHTML(r) {
  const d = String(r.date || '').slice(8, 10) + ' ' + (MONTHS[Number(String(r.date).slice(5, 7)) - 1] || '');
  const can = isOwner() || (r.by === uidOf() && r.date === today());
  let t = '', v = '';
  if (r.kind === 'bilty') { t = `📄 ${esc(r.from || '?')} → ${esc(r.to || '?')}${r.party ? ' · ' + esc(r.party) : ''}`; v = `${rs(r.kiraya)}<small>comm ${rs(commOf(r))}</small>`; }
  else if (r.kind === 'diesel') { t = `⛽ ${num(r.litre, 1)} L × ${num(r.rate, 1)}${r.reading ? ' · reading ' + num(r.reading) : ''}${r.pump ? ' · ' + esc(r.pump) : ''}`; v = rs(r.amount); }
  else if (r.kind === 'kharch') { t = `🧾 ${esc(r.cat || 'Kharcha')}${r.note ? ' · ' + esc(r.note) : ''}`; v = rs(r.amount); }
  else if (r.kind === 'reading') { t = `📍 Meter reading${r.note ? ' · ' + esc(r.note) : ''}`; v = num(r.reading) + ' km'; }
  else if (r.kind === 'tracker') { t = `📸 Tracker (Falcon-i)${r.note ? ' · ' + esc(r.note) : ''}`; v = num(r.km) + ' km'; }
  else if (r.kind === 'driver') { t = `👤 Driver ko diye${r.note ? ' · ' + esc(r.note) : ''}`; v = rs(r.amount); }
  return `<div class="gr-row gr-${esc(r.kind)}"><span class="gr-d">${esc(d)}</span><span class="gr-t">${t}<small>${esc(r.byName || '')}</small></span><span class="gr-v">${v}</span>${can ? `<button type="button" class="gr-x" data-gr-del="${esc(r.id)}" title="Hatao">✕</button>` : ''}</div>`;
}

// ---------- forms ----------
const field = (name, label, type = 'number', val = '', extra = '') => `<label>${label}<input name="${name}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(val)}" ${extra}></label>`;
const photoBtn = (what) => ai ? `<label class="gr-photo">📷 ${what} ki photo — AI khud bhar dega<input type="file" accept="image/*" capture="environment" data-gr-photo hidden></label><p class="gr-ai" hidden></p>` : '';

function openForm(kind) {
  const d = today(), lastR = Math.max(0, ...rows.map(r => Number(r.reading) || 0));
  const F = {
    bilty: ['📄 Bilty / kiraya', `${field('date', 'Tareekh', 'date', d)}<div class="gr-2">${field('from', 'Kahan se', 'text', '', 'placeholder="Kharian"')}${field('to', 'Kahan tak', 'text', '', 'placeholder="Lahore"')}</div>${field('party', 'Party / maal', 'text')}${field('kiraya', 'Bilty kiraya (Rs)', 'number', '', 'required')}${field('comm', `Driver commission (khali = ${cfg.commType === 'fixed' ? rs(cfg.commVal) : num(cfg.commVal, 1) + '%'})`)}${field('note', 'Note', 'text')}`],
    diesel: ['⛽ Diesel', `${photoBtn('Pump parchi / meter')}${field('date', 'Tareekh', 'date', d)}<div class="gr-2">${field('litre', 'Litre', 'number', '', 'required')}${field('rate', 'Rate fi litre')}</div>${field('amount', 'Kul raqam (Rs)')}${field('reading', `Meter reading (pichhli ${lastR ? num(lastR) : '—'})`, 'number', '', 'required')}${field('pump', 'Pump', 'text')}`],
    kharch: ['🧾 Kharcha', `${field('date', 'Tareekh', 'date', d)}<label>Kis cheez ka<select name="cat">${KHARCH.map(k => `<option>${k}</option>`).join('')}</select></label>${field('amount', 'Raqam (Rs)', 'number', '', 'required')}${field('note', 'Tafseel', 'text')}`],
    reading: ['📍 Meter reading', `${photoBtn('Meter')}${field('date', 'Tareekh', 'date', d)}${field('reading', `Reading (pichhli ${lastR ? num(lastR) : '—'})`, 'number', '', 'required')}${field('note', 'Note', 'text', '', 'placeholder="mahine ki shuru / aakhir"')}`],
    tracker: ['📸 Tracker ke km', `${photoBtn('Falcon-i report (Mileage/Trip)')}${field('date', 'Tareekh (din ya mahine ki aakhri)', 'date', d)}${field('km', 'Km (tracker ke mutabiq)', 'number', '', 'required')}${field('note', 'Note', 'text', '', 'placeholder="1-31 Oct ki report"')}`],
    driver: ['👤 Driver ko diye', `${field('date', 'Tareekh', 'date', d)}${field('amount', 'Raqam (Rs)', 'number', '', 'required')}${field('note', 'Note', 'text', '', 'placeholder="commission / advance"')}`]
  }[kind];
  if (!F) return;
  modal(F[0], `<form id="grForm" class="gr-form" data-kind="${kind}">${F[1]}<p class="gr-msg"></p><button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grForm');
  if (kind === 'diesel') f.addEventListener('input', e => { const L = Number(f.elements.litre.value) || 0, R = Number(f.elements.rate.value) || 0, A = Number(f.elements.amount.value) || 0;
    if (e.target.name !== 'amount' && L && R) f.elements.amount.value = Math.round(L * R); else if (e.target.name === 'amount' && L && A && !R) f.elements.rate.value = r2(A / L); });
  f.querySelector('[data-gr-photo]')?.addEventListener('change', e => readPhoto(kind, f, e.target.files?.[0]));
  f.onsubmit = async e => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(f)); const msg = f.querySelector('.gr-msg');
    const n = k => o[k] === '' || o[k] == null ? null : Number(o[k]);
    const doc = { kind, date: String(o.date || d).slice(0, 10), note: String(o.note || '').slice(0, 200) };
    if (kind === 'bilty') Object.assign(doc, { from: String(o.from || '').slice(0, 60), to: String(o.to || '').slice(0, 60), party: String(o.party || '').slice(0, 80), kiraya: n('kiraya') || 0, comm: n('comm') });
    if (kind === 'diesel') Object.assign(doc, { litre: n('litre') || 0, rate: n('rate') || (n('amount') && n('litre') ? r2(n('amount') / n('litre')) : 0), amount: n('amount') || Math.round((n('litre') || 0) * (n('rate') || 0)), reading: n('reading') || 0, pump: String(o.pump || '').slice(0, 60) });
    if (kind === 'kharch') Object.assign(doc, { cat: String(o.cat || 'Doosra').slice(0, 40), amount: n('amount') || 0 });
    if (kind === 'reading') Object.assign(doc, { reading: n('reading') || 0 });
    if (kind === 'tracker') Object.assign(doc, { km: n('km') || 0 });
    if (kind === 'driver') Object.assign(doc, { amount: n('amount') || 0 });
    if (doc.comm == null) delete doc.comm;
    const amt = doc.kiraya ?? doc.amount ?? doc.reading ?? doc.km ?? doc.litre;
    if (!(Number(amt) > 0)) { msg.textContent = 'Raqam / tadad likhein'; return; }
    if (doc.reading && lastR && doc.reading < lastR - 1 && !confirm(`Reading ${num(doc.reading)} pichhli (${num(lastR)}) se kam hai — phir bhi save karein?`)) return;
    try { f.querySelector('button[type=submit]').disabled = true; await cloud.addGaari({ ...doc, by: uidOf(), byName: byName() || '', at: Date.now() }); closeModal(); notice('✓ Save ho gaya'); if (doc.date.slice(0, 7) !== month) { month = doc.date.slice(0, 7); paint(); } }
    catch (er) { f.querySelector('button[type=submit]').disabled = false; msg.textContent = 'Nahi hua: ' + (er?.message || er); }
  };
}

async function readPhoto(kind, f, file) {
  const out = f.querySelector('.gr-ai'); if (!file || !out) return;
  out.hidden = false; out.textContent = '🤖 AI parh raha hai… (10-30 second)';
  const P = {
    diesel: 'Ye petrol pump ki parchi ya gaari ke meter ki photo hai. Sirf JSON do: {"litre":n,"rate":n,"amount":n,"reading":n,"pump":"naam"} — jo nazar na aaye wo 0 / "". reading = odometer ke km (sirf hindse).',
    reading: 'Ye gaari ke odometer (meter) ki photo hai. Kul km reading parh kar sirf JSON do: {"reading":n}. Trip meter nahi, ODO wala bara number.',
    tracker: 'Ye Falcon-i / TPL tracker app ki report ka screenshot hai. Kul chale hue km (Distance / Mileage / Total km) parh kar sirf JSON do: {"km":n,"from":"tareekh","to":"tareekh"}. Agar kai din hain to un ka jor.'
  }[kind];
  try {
    const img = await shrink(file, 1600, 0.85);
    const txt = await ai([img], P);
    const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) throw Error('AI ko kuch samajh nahi aaya');
    const j = JSON.parse(m[0]); const got = [];
    for (const k of ['litre', 'rate', 'amount', 'reading', 'km']) if (Number(j[k]) > 0 && f.elements[k]) { f.elements[k].value = Number(j[k]); got.push(k); }
    if (j.pump && f.elements.pump) f.elements.pump.value = j.pump;
    if (kind === 'tracker' && (j.from || j.to) && f.elements.note && !f.elements.note.value) f.elements.note.value = [j.from, j.to].filter(Boolean).join(' – ');
    out.textContent = got.length ? '✓ AI ne bhar diya — ek nazar dekh kar Save karein' : 'AI ko hindse saaf nahi mile — khud likh dein';
  } catch (e) { out.textContent = '⚠ ' + (e?.message || e) + ' — khud likh dein'; }
}

function openCfg() {
  modal('⚙ Gaari setting', `<form id="grCfg" class="gr-form">${field('no', 'Gaari number', 'text', cfg.no || '')}${field('driver', 'Driver ka naam', 'text', cfg.driver || '')}${field('avg', 'Sahi average (km fi litre)', 'number', cfg.avg ?? 5.5)}
    <label>Driver commission<select name="commType"><option value="pct"${cfg.commType !== 'fixed' ? ' selected' : ''}>% kiraya ka</option><option value="fixed"${cfg.commType === 'fixed' ? ' selected' : ''}>Fixed fi bilty (Rs)</option></select></label>
    ${field('commVal', 'Commission (% ya Rs)', 'number', cfg.commVal ?? 10)}<p class="gr-msg"></p><button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grCfg');
  f.onsubmit = async e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f));
    try { await cloud.setGaariConfig({ no: String(o.no || '').slice(0, 30), driver: String(o.driver || '').slice(0, 40), avg: Number(o.avg) || 5.5, commType: o.commType === 'fixed' ? 'fixed' : 'pct', commVal: Number(o.commVal) || 0, updatedAt: Date.now() }); closeModal(); notice('✓ Setting save'); }
    catch (er) { f.querySelector('.gr-msg').textContent = 'Nahi hua: ' + (er?.message || er); } };
}

function makePdf() {
  const c = calc(); if (!pdf) return;
  const line = (a, b) => `<tr><td>${a}</td><td class="iv-n">${b}</td></tr>`;
  const sorted = c.m.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  pdf(`🚚 Gaari ${cfg.no || ''} — ${monthName(month)}`, `<h1>NOOR TRADERS</h1><h2>Gaari ${esc(cfg.no || '')} — ${esc(monthName(month))}${cfg.driver ? ' · Driver: ' + esc(cfg.driver) : ''}</h2>
    <table class="iv-tbl"><tbody>${line('Bilty kiraya (' + c.bilty.length + ')', rs(c.kiraya))}${line('Diesel (' + num(c.litre, 1) + ' L)', '− ' + rs(c.dieselRs))}${line('Driver commission', '− ' + rs(c.comm))}
    ${Object.entries(c.kharchCat).map(([k, v]) => line(esc(k), '− ' + rs(v))).join('')}${line('<b>' + (c.nafa >= 0 ? 'NAFA' : 'NUQSAN') + '</b>', '<b>' + rs(Math.abs(c.nafa)) + '</b>')}</tbody></table>
    <table class="iv-tbl"><tbody>${line('Meter', c.startR ? num(c.startR) + ' → ' + num(c.endR) + ' = ' + num(c.km) + ' km' : '—')}${line('Tracker', c.trackerKm ? num(c.trackerKm) + ' km' : '—')}
    ${line('Average', c.realAvg ? num(c.realAvg, 2) + ' km/L (chahiye ' + c.avg + ')' : '—')}${line('Diesel banta tha', c.shouldL ? num(c.shouldL, 1) + ' L — farq ' + num(c.extraL, 1) + ' L' : '—')}${line('Fi km kharch', c.perKm ? 'Rs ' + num(c.perKm, 1) : '—')}${line('Driver baqaya (kul)', rs(c.driverBaqi))}</tbody></table>
    ${alerts(c).map(a => `<p>⚠ ${a}</p>`).join('')}
    <table class="iv-tbl"><thead><tr><th>Tareekh</th><th>Tafseel</th><th>Raqam / km</th></tr></thead><tbody>${sorted.map(r => { const h = rowHTML(r); const t = h.match(/<span class="gr-t">([\s\S]*?)<small>/)?.[1] || ''; const v = h.match(/<span class="gr-v">([\s\S]*?)<\/span>/)?.[1] || ''; return `<tr><td>${esc(r.date)}</td><td>${t}</td><td class="iv-n">${v.replace(/<small>.*<\/small>/, '')}</td></tr>`; }).join('')}</tbody></table>`);
}

document.addEventListener('click', e => {
  if (!mounted) return;
  const m = e.target.closest?.('[data-gr-m]'); if (m) { shiftMonth(Number(m.dataset.grM)); return; }
  const a = e.target.closest?.('[data-gr-add]'); if (a) { openForm(a.dataset.grAdd); return; }
  if (e.target.closest?.('[data-gr-cfg]')) { if (isOwner()) openCfg(); return; }
  if (e.target.closest?.('[data-gr-pdf]')) { makePdf(); return; }
  const x = e.target.closest?.('[data-gr-del]'); if (x) { if (!confirm('Ye entry hata dein?')) return; cloud.delGaari(x.dataset.grDel).then(() => notice('Hata di')).catch(er => notice('Nahi hua: ' + (er?.message || er))); }
});
