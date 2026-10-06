// gaari.js — 🚚 GAARI KA HISAAB v3 (v2.94, 2026-10-06) — sab kuch "PHERA" ke gird
// Ek PHERA = ek page: biltiyan (kiraya, kahan se->tak, ☐ driver se le liya), kharche (chips + search), meter (shuru = pichhle
// phere ki aakhri, aakhri + 📷 AI), Falcon tracker km (📸 AI) — dono ka milan, diesel (litre × rate, ☐ tanki full) aur
// "km ÷ average = itna lagna chahiye tha" vs asal, phere ka nafa. Har khana khud save (intezar nahi — Firestore peeche).
// Main screen: mahine ka hero, calendar (har din kitne pheray), chips (💰 driver se lena, ⛽ average, 🧾 kharche phera-wise…),
// phera cards. Purani alag entries (bilty/diesel/kharch/reading/tracker/driver — v2.92) bhi jor mein rehti hain.
// Data: businesses/noor-traders/gaari/{id} kind 'phera' {date, startR, endR, trackerKm, bilties[{id,from,to,party,kiraya,comm,col}],
//   kharche[{n,a}], diesel[{l,rate,amount,full}], status open|closed, note, by, byName, at} + gaari/_config.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: d });
const rs = v => 'Rs ' + num(Math.round(Number(v) || 0));
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const N = v => Number(v) || 0;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Pir', 'Mng', 'Bud', 'Jum', 'Jma', 'Hft', 'Itw'];
const KHARCH = ['Toll / parchi', 'Khana', 'Police / challan', 'Repair', 'Tyre', 'Oil / filter', 'Parking', 'Mazdoori', 'Doosra'];
const uid6 = () => Math.random().toString(36).slice(2, 8);

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '', modal = null, closeModal = () => {}, ai = null, pdf = null, shrink = null;
let un = null, rows = [], cfg = { avg: 5.5, commType: 'pct', commVal: 10, driver: '', no: 'GJL640630' }, month = today().slice(0, 7), day = '', mounted = false, err = '';
let cur = null, curTimer = null;   // khula phera page (local copy)

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
    if (mounted && !cur) paint();
  }, e => { err = e?.message || 'rabta nahi'; if (mounted) paint(); });
}
export function renderGaari() {
  mounted = true;
  if ($('list')) $('list').innerHTML = '';
  if ($('actions')) $('actions').innerHTML = '';
  if ($('tabs')) $('tabs').hidden = true;
  start(); paint();
}

// ---------- hisaab ----------
const commOf = b => b.comm != null && b.comm !== '' ? N(b.comm) : (cfg.commType === 'fixed' ? N(cfg.commVal) : r2(N(b.kiraya) * N(cfg.commVal) / 100));
const avgOf = () => N(cfg.avg) || 5.5;
const pheras = () => rows.filter(r => r.kind === 'phera').sort((a, b) => String(a.date).localeCompare(String(b.date)) || N(a.at) - N(b.at));
function lastRate() { for (const p of pheras().slice().reverse()) for (const d of (p.diesel || []).slice().reverse()) if (N(d.rate)) return N(d.rate); for (const r of rows.slice().reverse()) if (r.kind === 'diesel' && N(r.rate)) return N(r.rate); return 0; }
function lastEnd(beforeAt) {
  let v = 0; for (const p of pheras()) { if (beforeAt && N(p.at) >= beforeAt) continue; if (N(p.endR) > v) v = N(p.endR); }
  if (!v) for (const r of rows) if (N(r.reading) > v) v = N(r.reading);
  return v;
}
function pc(p) {
  const B = p.bilties || [], K = p.kharche || [], D = p.diesel || [];
  const kiraya = B.reduce((s, b) => s + N(b.kiraya), 0), comm = B.reduce((s, b) => s + commOf(b), 0);
  const kh = K.reduce((s, k) => s + N(k.a), 0), dL = D.reduce((s, d) => s + N(d.l), 0), dRs = D.reduce((s, d) => s + N(d.amount), 0);
  const km = N(p.endR) > N(p.startR) && N(p.startR) ? N(p.endR) - N(p.startR) : 0;
  const rate = dL ? dRs / dL : lastRate();
  const shouldL = km / avgOf(), shouldRs = shouldL * rate;
  const tk = N(p.trackerKm), kmDiff = km && tk ? km - tk : 0, kmOk = !(km && tk) || Math.abs(kmDiff) <= Math.max(10, km * 0.05);
  const pending = B.filter(b => !b.col).reduce((s, b) => s + N(b.kiraya), 0);
  return { kiraya, comm, kh, dL, dRs, km, rate, shouldL, shouldRs, tk, kmDiff, kmOk, pending, nafa: kiraya - comm - kh - dRs, routes: B.map(b => `${b.from || '?'}→${b.to || '?'}`) };
}
// tanki full se tanki full: is phere ki full-fill par, pichhli full-fill (kisi bhi phere mein) ke baad se kitne km aur kitna diesel
function fullCheck(p) {
  const L = pheras(), i = L.findIndex(x => x.id === p.id); if (i < 0 || !(p.diesel || []).some(d => d.full)) return null;
  let j = i - 1; while (j >= 0 && !(L[j].diesel || []).some(d => d.full)) j--;
  if (j < 0 || !N(L[j].endR) || !N(p.endR)) return null;
  const km = N(p.endR) - N(L[j].endR); if (!(km > 0)) return null;
  let litre = 0, rs_ = 0; for (let k = j + 1; k <= i; k++) for (const d of L[k].diesel || []) { litre += N(d.l); rs_ += N(d.amount); }
  const should = km / avgOf(), rate = litre ? rs_ / litre : lastRate();
  return { km, litre, should, extra: litre - should, extraRs: (litre - should) * rate, avg: litre ? km / litre : 0, from: L[j].date };
}
function monthCalc() {
  const inM = r => String(r.date || '').slice(0, 7) === month && (!day || r.date === day);
  const P = pheras().filter(inM), old = rows.filter(r => r.kind !== 'phera' && inM(r));
  const s = { pheras: P, kiraya: 0, comm: 0, kh: 0, dL: 0, dRs: 0, km: 0, tk: 0, cat: {} };
  for (const p of P) { const c = pc(p); s.kiraya += c.kiraya; s.comm += c.comm; s.kh += c.kh; s.dL += c.dL; s.dRs += c.dRs; s.km += c.km; s.tk += c.tk; (p.kharche || []).forEach(k => { s.cat[k.n] = (s.cat[k.n] || 0) + N(k.a); }); }
  for (const r of old) {
    if (r.kind === 'bilty') { s.kiraya += N(r.kiraya); s.comm += commOf(r); (r.kharche || []).forEach(k => { s.kh += N(k.a); s.cat[k.n] = (s.cat[k.n] || 0) + N(k.a); }); }
    if (r.kind === 'diesel') { s.dL += N(r.litre); s.dRs += N(r.amount); }
    if (r.kind === 'kharch') { s.kh += N(r.amount); s.cat[r.cat || 'Doosra'] = (s.cat[r.cat || 'Doosra'] || 0) + N(r.amount); }
    if (r.kind === 'tracker') s.tk += N(r.km);
  }
  s.old = old; s.nafa = s.kiraya - s.comm - s.kh - s.dRs; s.realAvg = s.dL && s.km ? s.km / s.dL : 0; s.shouldL = s.km / avgOf();
  // driver se lena (sab mahine) + commission baqaya
  s.pendList = []; for (const p of pheras()) (p.bilties || []).forEach(b => { if (!b.col && N(b.kiraya)) s.pendList.push({ p, b }); });
  s.pending = s.pendList.reduce((t, x) => t + N(x.b.kiraya), 0);
  const allComm = pheras().reduce((t, p) => t + pc(p).comm, 0) + rows.filter(r => r.kind === 'bilty').reduce((t, b) => t + commOf(b), 0);
  s.driverBaqi = allComm - rows.filter(r => r.kind === 'driver').reduce((t, d) => t + N(d.amount), 0);
  return s;
}
function monthName(m) { const [y, mm] = m.split('-'); return MONTHS[Number(mm) - 1] + ' ' + y; }
function shiftMonth(d) { const [y, m] = month.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); month = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; day = ''; paint(); }

// ---------- main screen ----------
function calendar() {
  const [y, m] = month.split('-').map(Number), first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const cnt = {}; pheras().forEach(p => { if (String(p.date).slice(0, 7) === month) cnt[p.date] = (cnt[p.date] || 0) + 1; });
  const pad = (first.getDay() + 6) % 7, td = today(); let h = WD.map(w => `<i>${w}</i>`).join('') + '<span></span>'.repeat(pad);
  for (let d = 1; d <= days; d++) { const k = `${month}-${String(d).padStart(2, '0')}`, n = cnt[k] || 0;
    h += `<button type="button" data-gd="${k}" class="${n ? 'has' : ''}${k === day ? ' on' : ''}${k === td ? ' td' : ''}">${d}${n ? `<em>${n}</em>` : ''}</button>`; }
  return `<div class="gx-cal">${h}</div>`;
}
function paint() {
  const sum = $('summary'); if (!sum) return;
  const s = monthCalc(), up = s.nafa >= 0, own = isOwner();
  const chip = (k, ic, v, l, cls = '') => `<button type="button" class="gx-chip ${cls}" data-gr-open="${k}"><i>${ic}</i><b>${v}</b><small>${l}</small></button>`;
  const P = s.pheras.slice().reverse();
  sum.innerHTML = `<div class="gx">
    <div class="gx-hero" style="background:linear-gradient(135deg,#0b1a3a 0%,#1d3b7a 55%,#3a2c8f 100%);color:#fff">
      <div class="gx-top"><span class="gx-tag">🚚 ${esc(cfg.no || 'Gaari')}${cfg.driver ? ' · ' + esc(cfg.driver) : ''}</span>
        <span class="gx-month"><button type="button" data-gr-m="-1" style="color:#fff">‹</button><b style="color:#fff">${esc(monthName(month))}</b><button type="button" data-gr-m="1" style="color:#fff">›</button></span></div>
      <small style="color:rgba(255,255,255,.7)">${day ? esc(day.slice(8) + ' ' + monthName(month)) + ' ka ' : 'Is mahine ka '}${up ? 'NAFA' : 'NUQSAN'} · ${s.pheras.length} phera</small>
      <strong class="gx-big" style="color:${up ? '#6dffb0' : '#ff9a9a'}">${rs(Math.abs(s.nafa))}</strong>
      <div class="gx-bar"><span style="width:${s.kiraya > 0 ? Math.min(100, Math.round((s.comm + s.kh + s.dRs) / s.kiraya * 100)) : 0}%"></span></div>
      <small style="color:rgba(255,255,255,.75)">Kiraya ${rs(s.kiraya)} · Diesel ${rs(s.dRs)} · Kharche ${rs(s.kh)} · Comm ${rs(s.comm)}</small>
      ${err ? `<p class="gx-err">⚠ ${/permission/i.test(err) ? 'Ijazat nahi — Firebase mein Rules 2.32 publish karein' : esc(err)}</p>` : ''}
    </div>
    <button type="button" class="gx-new" data-gp-new="1">＋ Naya phera${day ? ' (' + esc(day.slice(8)) + ' tareekh)' : ''}</button>
    ${s.pending ? `<button type="button" class="gx-collect" data-gr-open="collect"><b>💰 Driver se lena hai</b><strong>${rs(s.pending)}</strong><small>${s.pendList.length} bilty · tap = jo le liya tick karein</small></button>` : ''}
    <div class="gx-chips">
      ${chip('km', '🛣️', s.km ? num(s.km) + ' km' : '—', 'Chali · tracker ' + (s.tk ? num(s.tk) : '—'))}
      ${chip('avg', '⛽', s.realAvg ? num(s.realAvg, 2) + ' km/L' : num(s.dL, 1) + ' L', 'Average (chahiye ' + avgOf() + ')', s.realAvg && s.realAvg < avgOf() * 0.92 ? 'gx-bad' : '')}
      ${chip('kharch', '🧾', rs(s.kh), 'Kharche · phera-wise')}
      ${chip('driver', '👤', rs(s.comm), 'Commission · baqi ' + rs(s.driverBaqi))}
    </div>
    <details class="gx-calbox"${day ? ' open' : ''}><summary>📅 Calendar — tareekh chunein${day ? ` · <b>${esc(day.slice(8))} ${esc(monthName(month))}</b> <a data-gd="">sab dikhao</a>` : ''}</summary>${calendar()}</details>
    <div class="gx-acts"><button type="button" data-gr-pdf="1">⇩ PDF report</button>${s.old.length ? `<button type="button" data-gr-open="old">📋 Purani entries ${s.old.length}</button>` : ''}${own ? '<button type="button" data-gr-add="driver">👤 Driver ko diye</button><button type="button" data-gr-cfg="1">⚙ Setting</button>' : ''}</div>
    <div class="gx-plist">${P.length ? P.map(cardHTML).join('') : `<p class="gr-empty">${day ? 'Is din koi phera nahi' : 'Is mahine abhi koi phera nahi'} — upar "＋ Naya phera" dabayein.</p>`}</div>
  </div>`;
  const list = $('list'); if (list) list.innerHTML = '';
}
function cardHTML(p) {
  const c = pc(p), d = String(p.date || '').slice(8, 10) + ' ' + (MONTHS[Number(String(p.date).slice(5, 7)) - 1] || '');
  const warn = [!c.kmOk ? '📍 km farq' : '', c.km && c.dL && c.dL - c.shouldL > Math.max(3, c.shouldL * 0.08) ? '⛽ diesel zyada' : '', c.pending ? '💰 ' + rs(c.pending) + ' lena' : ''].filter(Boolean);
  return `<button type="button" class="gp-card${p.status === 'closed' ? ' closed' : ''}" data-gp="${esc(p.id)}">
    <span class="gp-d"><b>${esc(d)}</b><small>${p.status === 'closed' ? '✅ band' : '🟢 khula'}</small></span>
    <span class="gp-m"><b>${esc(c.routes.join(' · ') || 'Bilty abhi nahi')}</b><small>${c.km ? num(c.km) + ' km' : 'reading baqi'} · ${num(c.dL, 1)} L · kharche ${rs(c.kh)}</small>${warn.length ? `<em>${warn.join(' · ')}</em>` : ''}</span>
    <span class="gp-v"><b class="${c.nafa >= 0 ? 'up' : 'down'}">${rs(c.nafa)}</b><small>kiraya ${rs(c.kiraya)}</small></span></button>`;
}

// ---------- PHERA page ----------
function newPhera() {
  const date = day || today();
  const p = { kind: 'phera', date, startR: lastEnd() || 0, endR: 0, trackerKm: 0, bilties: [{ id: uid6(), from: '', to: '', party: '', kiraya: 0, col: false }], kharche: [], diesel: [], status: 'open', note: '', by: uidOf(), byName: byName() || '', at: Date.now() };
  const id = cloud.newGaariId(); p.id = id;
  rows.push(p);   // foran screen par (Firestore peeche)
  cloud.putGaari(id, p).catch(e => notice('❌ Phera save nahi hua: ' + (e?.message || e)));
  openPhera(id);
}
function canEdit(p) { return isOwner() || p.status !== 'closed'; }
function save(fields) {
  if (!cur) return; Object.assign(cur, fields); cur.updatedAt = Date.now();
  const id = cur.id, data = { ...cur }; delete data.id;
  const r = rows.find(x => x.id === id); if (r) Object.assign(r, data);
  clearTimeout(curTimer); curTimer = setTimeout(() => cloud.putGaari(id, data).catch(e => notice('❌ Save nahi hua: ' + (e?.message || e))), 500);
}
function openPhera(id) {
  const p = rows.find(r => r.id === id); if (!p) return;
  cur = JSON.parse(JSON.stringify(p)); cur.id = id;
  modal(`🚚 Phera · ${cur.date.slice(8)} ${MONTHS[Number(cur.date.slice(5, 7)) - 1]}`, `<div id="gpPage" class="gp-page"></div>`, true);
  drawPhera();
  const dlg = $('dialog');
  const onClose = () => { dlg?.removeEventListener('close', onClose); if (curTimer) { clearTimeout(curTimer); const data = { ...cur }; delete data.id; cloud.putGaari(cur.id, data).catch(() => {}); } cur = null; if (mounted) paint(); };
  dlg?.addEventListener('close', onClose);
}
const inp = (k, v, ph = '', type = 'number', cls = '') => `<input data-f="${k}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(v ?? '')}" placeholder="${esc(ph)}" class="${cls}">`;
function drawPhera() {
  const box = $('gpPage'); if (!box || !cur) return;
  const ed = canEdit(cur), own = isOwner(), c = pc(cur), fc = fullCheck(cur);
  const dis = ed ? '' : ' disabled';
  box.innerHTML = `
  <div class="gp-sec"><div class="gp-h"><b>📄 Biltiyan</b>${ed ? '<button type="button" data-ga="bilty">＋ Bilty</button>' : ''}</div>
    ${(cur.bilties || []).map((b, i) => `<div class="gp-bilty" data-bi="${i}">
      <div class="gp-2">${inp('from', b.from, 'Kahan se', 'text')}${inp('to', b.to, 'Kahan tak', 'text')}</div>
      <div class="gp-2">${inp('party', b.party, 'Party / maal', 'text')}${inp('kiraya', b.kiraya || '', 'Kiraya Rs')}</div>
      <div class="gp-row"><label class="gp-chk"><input type="checkbox" data-f="col"${b.col ? ' checked' : ''}${own ? '' : ' disabled'}> 💰 Driver se kiraya le liya</label>
        <span class="gp-mini">comm ${rs(commOf(b))}</span>${ed ? `<button type="button" class="gp-x" data-gdel="bilty" data-i="${i}" title="Bilty hatao">🗑</button>` : ''}</div></div>`).join('') || '<p class="gr-empty">Bilty nahi</p>'}
  </div>
  <div class="gp-sec"><div class="gp-h"><b>🧾 Kharche</b><span class="gp-mini">${rs(c.kh)}</span></div>
    ${ed ? `<input type="search" class="gk-q" placeholder="🔍 Kharcha dhoondein ya naya likh kar Enter" autocomplete="off"><div class="gk-chips">${kChips()}</div>` : ''}
    <div class="gk-lines">${(cur.kharche || []).map((k, i) => `<div class="gk-line" data-ki="${i}"><span>${esc(k.n)}</span><input class="gk-a" data-f="a" type="number" inputmode="decimal" step="any" value="${esc(k.a || '')}" placeholder="Rs"${dis}>${ed ? `<button type="button" class="gk-x" data-gdel="kharch" data-i="${i}">✕</button>` : ''}</div>`).join('')}</div>
  </div>
  <div class="gp-sec"><div class="gp-h"><b>📍 Meter reading</b><span class="gp-mini">${c.km ? num(c.km) + ' km chali' : ''}</span></div>
    <div class="gp-2"><label>Shuru (pichhle phere se)${inp('startR', cur.startR || '', 'Shuru reading')}</label><label>Aakhri (wapsi par)${inp('endR', cur.endR || '', 'Aakhri reading')}</label></div>
    ${ed && ai ? `<div class="gp-2"><label class="gr-photo">📷 Meter ki photo<input type="file" accept="image/*" capture="environment" data-gph="reading" hidden></label><label class="gr-photo">📸 Falcon screenshot<input type="file" accept="image/*" data-gph="tracker" hidden></label></div><p class="gr-ai" id="gpAi" hidden></p>` : ''}
    <label>Falcon tracker km${inp('trackerKm', cur.trackerKm || '', 'Tracker ke mutabiq km')}</label>
    <p class="gp-match ${c.km && c.tk ? (c.kmOk ? 'ok' : 'bad') : ''}">${c.km && c.tk ? (c.kmOk ? `✅ Meter ${num(c.km)} km = tracker ${num(c.tk)} km` : `❌ Meter ${num(c.km)} km, tracker ${num(c.tk)} km — ${num(Math.abs(c.kmDiff))} km farq`) : 'Meter aur tracker dono likhein to milan dikhega'}</p>
  </div>
  <div class="gp-sec"><div class="gp-h"><b>⛽ Diesel</b>${ed ? '<button type="button" data-ga="diesel">＋ Diesel</button>' : ''}</div>
    ${ed && ai ? '<label class="gr-photo">📷 Pump parchi ki photo — AI line bana dega<input type="file" accept="image/*" capture="environment" data-gph="diesel" hidden></label>' : ''}
    ${(cur.diesel || []).map((d, i) => `<div class="gp-diesel" data-di="${i}"><div class="gp-3">${inp('l', d.l || '', 'Litre')}${inp('rate', d.rate || '', 'Rate')}${inp('amount', d.amount || '', 'Rs')}</div>
      <div class="gp-row"><label class="gp-chk"><input type="checkbox" data-f="full"${d.full ? ' checked' : ''}${dis}> Tanki full karwayi</label>${ed ? `<button type="button" class="gp-x" data-gdel="diesel" data-i="${i}">🗑</button>` : ''}</div></div>`).join('')}
    <p class="gp-dcheck">${c.km ? `${num(c.km)} km ÷ ${avgOf()} = <b>${num(c.shouldL, 1)} L lagna chahiye</b> (~${rs(c.shouldRs)}) · dala ${num(c.dL, 1)} L${c.dL ? (c.dL - c.shouldL > Math.max(3, c.shouldL * 0.08) ? ` · <b class="bad">${num(c.dL - c.shouldL, 1)} L zyada</b>` : ' ✓') : ''}` : 'Aakhri reading likhne par hisaab aayega'}</p>
    ${fc ? `<p class="gp-dcheck ${fc.extra > Math.max(3, fc.should * 0.08) ? 'bad' : 'ok'}">🛢 Tanki full se full (${esc(fc.from)} se): ${num(fc.km)} km, ${num(fc.litre, 1)} L laga = average <b>${num(fc.avg, 2)}</b> · banta ${num(fc.should, 1)} L${fc.extra > 0 ? ` · ${num(fc.extra, 1)} L (${rs(fc.extraRs)}) zyada — driver se poochein` : ' ✓'}</p>` : ''}
  </div>
  <div class="gp-sec gp-net"><div class="gp-h"><b>🧮 Phere ka nichod</b></div>
    <p><span>Kiraya</span><b>${rs(c.kiraya)}</b></p><p><span>− Kharche</span><b>${rs(c.kh)}</b></p><p><span>− Diesel</span><b>${rs(c.dRs)}</b></p><p><span>− Driver commission</span><b>${rs(c.comm)}</b></p>
    <p class="gp-tot ${c.nafa >= 0 ? 'up' : 'down'}"><span>${c.nafa >= 0 ? 'NAFA' : 'NUQSAN'}</span><b>${rs(Math.abs(c.nafa))}</b></p>
    ${c.pending ? `<p class="gp-pend">💰 Driver se abhi lena: <b>${rs(c.pending)}</b></p>` : ''}
  </div>
  <label>Note${inp('note', cur.note, 'Kuch likhna ho', 'text')}</label>
  <div class="gp-foot">${cur.status === 'closed' ? (own ? '<button type="button" data-gst="open">🔓 Dobara kholein</button>' : '<span class="gp-mini">✅ Phera band — sirf malik badal sakta hai</span>') : '<button type="button" class="gp-close" data-gst="closed">✅ Phera band karein</button>'}${own ? '<button type="button" class="gp-del" data-gp-del="1">🗑 Phera hatao</button>' : ''}</div>`;
  wirePhera(box);
}
function liveNet(box) { // poora page dobara banaye bagair sirf hisaab wale hisse (focus na toote)
  const keep = document.activeElement, sel = keep && keep.dataset ? [keep.closest('[data-bi]')?.dataset.bi, keep.closest('[data-ki]')?.dataset.ki, keep.closest('[data-di]')?.dataset.di, keep.dataset.f] : null;
  drawPhera();
  if (sel) { const b = $('gpPage'); let q = sel[0] != null ? `[data-bi="${sel[0]}"] ` : sel[1] != null ? `[data-ki="${sel[1]}"] ` : sel[2] != null ? `[data-di="${sel[2]}"] ` : '';
    const el = b?.querySelector(q + `[data-f="${sel[3]}"]`); if (el) { el.focus(); try { const v = el.value; el.value = ''; el.value = v; } catch {} } }
}
function wirePhera(box) {
  let t = null;
  box.oninput = e => {
    const el = e.target, f = el.dataset.f; if (!f || !cur) return;
    const v = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value);
    const bi = el.closest('[data-bi]'), ki = el.closest('[data-ki]'), di = el.closest('[data-di]');
    if (bi) { const b = cur.bilties[Number(bi.dataset.bi)]; b[f] = typeof v === 'string' ? v.slice(0, 80) : v; if (f === 'col') b.colAt = v ? Date.now() : 0; save({ bilties: cur.bilties }); }
    else if (ki) { cur.kharche[Number(ki.dataset.ki)].a = N(v); save({ kharche: cur.kharche }); }
    else if (di) { const d = cur.diesel[Number(di.dataset.di)]; d[f] = v;
      if (f === 'l' || f === 'rate') { if (N(d.l) && N(d.rate)) { d.amount = Math.round(N(d.l) * N(d.rate)); const a = di.querySelector('[data-f="amount"]'); if (a) a.value = d.amount; } }
      if (f === 'amount' && N(d.l) && !N(d.rate)) d.rate = r2(N(d.amount) / N(d.l));
      save({ diesel: cur.diesel }); }
    else { save({ [f]: typeof v === 'string' ? v.slice(0, 200) : v }); }
    clearTimeout(t); t = setTimeout(() => liveNet(box), el.type === 'checkbox' ? 0 : 900);
  };
  box.onclick = e => {
    const a = e.target.closest('[data-ga]'); if (a && cur) {
      if (a.dataset.ga === 'bilty') { cur.bilties.push({ id: uid6(), from: cur.bilties.at(-1)?.to || '', to: '', party: '', kiraya: 0, col: false }); save({ bilties: cur.bilties }); }
      else { cur.diesel.push({ l: 0, rate: lastRate() || 0, amount: 0, full: false }); save({ diesel: cur.diesel }); }
      drawPhera(); return; }
    const d = e.target.closest('[data-gdel]'); if (d && cur) { const i = Number(d.dataset.i), k = d.dataset.gdel;
      if (k === 'bilty') { if (!confirm('Ye bilty hata dein?')) return; cur.bilties.splice(i, 1); save({ bilties: cur.bilties }); }
      if (k === 'kharch') { cur.kharche.splice(i, 1); save({ kharche: cur.kharche }); }
      if (k === 'diesel') { cur.diesel.splice(i, 1); save({ diesel: cur.diesel }); }
      drawPhera(); return; }
    const g = e.target.closest('[data-gk]'); if (g && cur) { addK(g.dataset.gk); return; }
    const st = e.target.closest('[data-gst]'); if (st && cur) {
      if (st.dataset.gst === 'closed' && !N(cur.endR) && !confirm('Aakhri meter reading abhi nahi likhi — phir bhi band karein?')) return;
      save({ status: st.dataset.gst }); drawPhera(); notice(st.dataset.gst === 'closed' ? '✅ Phera band' : '🔓 Phera khul gaya'); return; }
    if (e.target.closest('[data-gp-del]') && cur) { if (!confirm('Poora phera (sab biltiyan, kharche, diesel) hata dein?')) return; const id = cur.id; clearTimeout(curTimer); curTimer = null; rows = rows.filter(r => r.id !== id); cloud.delGaari(id).catch(er => notice('Nahi hua: ' + (er?.message || er))); closeModal(); notice('Phera hata diya'); }
  };
  const q = box.querySelector('.gk-q');
  if (q) { q.addEventListener('input', () => { box.querySelector('.gk-chips').innerHTML = kChips(q.value.trim()); }); q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addK(q.value); } }); }
  box.querySelectorAll('[data-gph]').forEach(x => x.addEventListener('change', ev => photoPhera(x.dataset.gph, ev.target.files?.[0])));
}
function addK(n) {
  n = String(n || '').trim(); if (!n || !cur) return;
  cur.kharche.push({ n: n.slice(0, 40), a: 0 }); save({ kharche: cur.kharche }); drawPhera();
  const L = $('gpPage')?.querySelectorAll('.gk-line .gk-a'); L?.[L.length - 1]?.focus();
}
// kharchon ke naam: sab pheron + purani entries se yaad, zyada istemal pehle; malik Setting se chhupa sake (cfg.hideK)
function kNames() {
  const c = {}; const add = n => { n = String(n || '').trim(); if (n) c[n] = (c[n] || 0) + 1; };
  rows.forEach(r => { if (r.kind === 'kharch') add(r.cat); (r.kharche || []).forEach(k => add(k.n)); });
  KHARCH.forEach(k => { if (!c[k]) c[k] = 0; });
  const hide = new Set(Array.isArray(cfg.hideK) ? cfg.hideK : []);
  return Object.entries(c).filter(([n]) => !hide.has(n)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}
const kChips = (q = '') => { const L = kNames().filter(n => !q || n.toLowerCase().includes(q.toLowerCase())).slice(0, 14);
  return L.map(n => `<button type="button" class="gk-chip" data-gk="${esc(n)}">${esc(n)}</button>`).join('') || (q ? `<button type="button" class="gk-chip gk-new" data-gk="${esc(q)}">＋ "${esc(q)}" naya</button>` : ''); };

async function photoPhera(kind, file) {
  if (!file || !cur) return; const out = $('gpAi'); if (out) { out.hidden = false; out.textContent = '🤖 AI parh raha hai… (10-30 second)'; } else notice('🤖 AI parh raha hai…');
  const P = {
    reading: 'Ye gaari ke odometer (meter) ki photo hai. Kul km (ODO) parh kar sirf JSON do: {"reading":n}. Trip meter nahi.',
    tracker: 'Ye Falcon-i / TPL tracker app ka screenshot hai. Kul chale km (Distance/Mileage/Total) sirf JSON mein: {"km":n}. Kai din hon to jor. Odometer dikhe to {"km":n,"odo":n}.',
    diesel: 'Ye petrol pump ki parchi hai. Sirf JSON: {"litre":n,"rate":n,"amount":n}. Jo na dikhe 0.'
  }[kind];
  try {
    const img = await shrink(file, 1600, 0.85); const txt = await ai([img], P);
    const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) throw Error('AI ko kuch samajh nahi aaya'); const j = JSON.parse(m[0]);
    let msg = '';
    if (kind === 'reading' && N(j.reading)) { save({ endR: N(j.reading) }); msg = '✓ Aakhri reading ' + num(j.reading); }
    if (kind === 'tracker' && N(j.km)) { save({ trackerKm: N(j.km) }); msg = '✓ Tracker ' + num(j.km) + ' km'; }
    if (kind === 'diesel' && (N(j.litre) || N(j.amount))) { const l = N(j.litre), a = N(j.amount), r = N(j.rate) || (l && a ? r2(a / l) : lastRate()); cur.diesel.push({ l: l || (a && r ? r2(a / r) : 0), rate: r, amount: a || Math.round(l * r), full: false }); save({ diesel: cur.diesel }); msg = '✓ Diesel line ban gayi'; }
    drawPhera(); const o2 = $('gpAi'); if (o2) { o2.hidden = false; o2.textContent = msg ? msg + ' — ek nazar dekh lein' : 'AI ko hindse saaf nahi mile — khud likh dein'; }
  } catch (e) { const o2 = $('gpAi'); if (o2) { o2.hidden = false; o2.textContent = '⚠ ' + (e?.message || e) + ' — khud likh dein'; } else notice('⚠ ' + (e?.message || e)); }
}

// ---------- windows (chips) ----------
function openDetail(k) {
  const s = monthCalc(), own = isOwner();
  const kv = arr => `<div class="gx-kv">${arr.map(([a, b]) => `<p><span>${a}</span><b>${b}</b></p>`).join('')}</div>`;
  if (k === 'collect') {
    modal('💰 Driver se lena hai', `<div class="gx-win">${kv([['Kul', rs(s.pending)], ['Biltiyan', s.pendList.length]])}<div class="gr-list">${s.pendList.map(({ p, b }) => `<div class="gr-row"><span class="gr-d">${esc(String(p.date).slice(8))} ${esc(MONTHS[Number(String(p.date).slice(5, 7)) - 1] || '')}</span><span class="gr-t">${esc(b.from || '?')} → ${esc(b.to || '?')}<small>${esc(b.party || '')}</small></span><span class="gr-v">${rs(b.kiraya)}</span>${own ? `<button type="button" class="gk-chip" data-gcol="${esc(p.id)}|${esc(b.id)}">✓ Le liya</button>` : ''}</div>`).join('') || '<p class="gr-empty">Sab le liya ✅</p>'}</div></div>`);
    return;
  }
  if (k === 'kharch') {
    const P = s.pheras;
    modal('🧾 Kharche — phera-wise', `<div class="gx-win">${kv(Object.entries(s.cat).sort((a, b) => b[1] - a[1]).map(([a, b]) => [esc(a), rs(b)]).concat([['Kul', rs(s.kh)]]))}${P.map(p => { const c = pc(p); return (p.kharche || []).length ? `<div class="gp-kcard" data-gp="${esc(p.id)}"><b>${esc(String(p.date).slice(8))} ${esc(MONTHS[Number(String(p.date).slice(5, 7)) - 1])} · ${esc(c.routes.join(' · '))}</b><small>${(p.kharche || []).map(x => esc(x.n) + ' ' + num(x.a)).join(' · ')}</small><em>${rs(c.kh)}</em></div>` : ''; }).join('')}</div>`);
    return;
  }
  if (k === 'km' || k === 'avg') {
    modal(k === 'km' ? '🛣️ Km — phera-wise' : '⛽ Diesel / average', `<div class="gx-win">${kv([['Meter km', num(s.km)], ['Tracker km', s.tk ? num(s.tk) : '—'], ['Diesel', num(s.dL, 1) + ' L · ' + rs(s.dRs)], ['Average', s.realAvg ? num(s.realAvg, 2) + ' (chahiye ' + avgOf() + ')' : '—'], ['Banta tha', num(s.shouldL, 1) + ' L'], ['Farq', s.km ? num(s.dL - s.shouldL, 1) + ' L' : '—']])}${s.pheras.map(p => { const c = pc(p), f = fullCheck(p); return `<div class="gp-kcard${!c.kmOk ? ' bad' : ''}" data-gp="${esc(p.id)}"><b>${esc(String(p.date).slice(8))} ${esc(MONTHS[Number(String(p.date).slice(5, 7)) - 1])} · ${esc(c.routes.join(' · '))}</b><small>Meter ${num(c.km)} · tracker ${c.tk ? num(c.tk) : '—'} · diesel ${num(c.dL, 1)} L / banta ${num(c.shouldL, 1)}${f ? ` · full-se-full avg ${num(f.avg, 2)}` : ''}</small><em>${c.kmOk ? '✓' : '❌ ' + num(Math.abs(c.kmDiff)) + ' km'}</em></div>`; }).join('')}</div>`);
    return;
  }
  if (k === 'driver') {
    const D = rows.filter(r => r.kind === 'driver').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    modal('👤 Driver', `<div class="gx-win">${kv([['Is mahine commission', rs(s.comm)], ['Kul baqaya (sab mahine)', rs(s.driverBaqi)], ['Driver se kiraya lena', rs(s.pending)]])}<div class="gr-list">${D.map(r => `<div class="gr-row"><span class="gr-d">${esc(r.date)}</span><span class="gr-t">👤 Diye${r.note ? ' · ' + esc(r.note) : ''}</span><span class="gr-v">${rs(r.amount)}</span>${own ? `<button type="button" class="gr-x" data-gr-del="${esc(r.id)}">✕</button>` : ''}</div>`).join('')}</div></div>`);
    return;
  }
  if (k === 'old') {
    modal('📋 Purani entries', `<div class="gx-win"><div class="gr-list">${s.old.map(r => `<div class="gr-row"><span class="gr-d">${esc(r.date)}</span><span class="gr-t">${esc(r.kind)} ${esc(r.from ? r.from + '→' + (r.to || '') : r.cat || r.note || '')}</span><span class="gr-v">${num(r.kiraya || r.amount || r.reading || r.km || r.litre)}</span>${own ? `<button type="button" class="gr-x" data-gr-del="${esc(r.id)}">✕</button>` : ''}</div>`).join('')}</div></div>`);
  }
}

// ---------- chhote forms (driver ko diye / setting) ----------
const field = (name, label, type = 'number', val = '', extra = '') => `<label>${label}<input name="${name}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(val)}" ${extra}></label>`;
function openDriverPay() {
  modal('👤 Driver ko diye', `<form id="grForm" class="gr-form">${field('date', 'Tareekh', 'date', day || today())}${field('amount', 'Raqam (Rs)', 'number', '', 'required')}${field('note', 'Note', 'text', '', 'placeholder="commission / advance"')}<button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grForm');
  f.onsubmit = e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f)); if (!(N(o.amount) > 0)) return;
    const id = cloud.newGaariId(), d = { kind: 'driver', date: String(o.date).slice(0, 10), amount: N(o.amount), note: String(o.note || '').slice(0, 200), by: uidOf(), byName: byName() || '', at: Date.now() };
    rows.push({ ...d, id }); cloud.putGaari(id, d).catch(er => notice('❌ ' + (er?.message || er))); closeModal(); notice('✓ Save'); paint(); };
}
function openCfg() {
  modal('⚙ Gaari setting', `<form id="grCfg" class="gr-form">${field('no', 'Gaari number', 'text', cfg.no || '')}${field('driver', 'Driver ka naam', 'text', cfg.driver || '')}${field('avg', 'Sahi average (km fi litre)', 'number', cfg.avg ?? 5.5)}
    <label>Driver commission<select name="commType"><option value="pct"${cfg.commType !== 'fixed' ? ' selected' : ''}>% kiraya ka</option><option value="fixed"${cfg.commType === 'fixed' ? ' selected' : ''}>Fixed fi bilty (Rs)</option></select></label>
    ${field('commVal', 'Commission (% ya Rs)', 'number', cfg.commVal ?? 10)}
    <label class="gp-chk"><input type="checkbox" name="notifyOn"${cfg.notifyOn !== false ? ' checked' : ''}> 🔔 Roz sham notification: "driver se hisaab lena hai"</label>
    ${field('notifyTimes', 'Waqt (comma se)', 'text', (cfg.notifyTimes || ['18:00', '19:30', '21:00']).join(', '))}
    <p class="gr-ai">Notification server PC bhejta hai (app band ho tab bhi) — malik ke phone par Settings mein 🔔 notification ON honi chahiye.</p>
    <b>🧾 Yaad wale kharchon ke naam</b><div class="gk-chips">${kNames().map(n => `<button type="button" class="gk-chip" data-gk-hide="${esc(n)}">${esc(n)} ✕</button>`).join('')}</div>
    <p class="gr-msg"></p><button type="submit" class="primary">💾 Save</button></form>`);
  const f = $('grCfg');
  f.addEventListener('click', async e => { const b = e.target.closest('[data-gk-hide]'); if (!b) return; const h = new Set(Array.isArray(cfg.hideK) ? cfg.hideK : []); h.add(b.dataset.gkHide); cloud.setGaariConfig({ hideK: [...h].slice(0, 200) }).catch(() => {}); cfg.hideK = [...h]; b.remove(); });
  f.onsubmit = async e => { e.preventDefault(); const o = Object.fromEntries(new FormData(f));
    const times = String(o.notifyTimes || '').split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x)).map(x => x.padStart(5, '0')).slice(0, 6);
    try { await cloud.setGaariConfig({ no: String(o.no || '').slice(0, 30), driver: String(o.driver || '').slice(0, 40), avg: N(o.avg) || 5.5, commType: o.commType === 'fixed' ? 'fixed' : 'pct', commVal: N(o.commVal), notifyOn: !!o.notifyOn, notifyTimes: times.length ? times : ['18:00', '19:30', '21:00'], updatedAt: Date.now() }); closeModal(); notice('✓ Setting save'); }
    catch (er) { f.querySelector('.gr-msg').textContent = 'Nahi hua: ' + (er?.message || er); } };
}

function makePdf() {
  const s = monthCalc(); if (!pdf) return;
  const line = (a, b) => `<tr><td>${a}</td><td class="iv-n">${b}</td></tr>`;
  pdf(`🚚 Gaari ${cfg.no || ''} — ${monthName(month)}`, `<h1>NOOR TRADERS</h1><h2>Gaari ${esc(cfg.no || '')} — ${esc(day ? day : monthName(month))}${cfg.driver ? ' · Driver: ' + esc(cfg.driver) : ''}</h2>
    <table class="iv-tbl"><tbody>${line('Pheray', s.pheras.length)}${line('Kiraya', rs(s.kiraya))}${line('− Diesel (' + num(s.dL, 1) + ' L)', rs(s.dRs))}${line('− Kharche', rs(s.kh))}${line('− Driver commission', rs(s.comm))}
    ${line('<b>' + (s.nafa >= 0 ? 'NAFA' : 'NUQSAN') + '</b>', '<b>' + rs(Math.abs(s.nafa)) + '</b>')}${line('Km (meter / tracker)', num(s.km) + ' / ' + (s.tk ? num(s.tk) : '—'))}${line('Average', s.realAvg ? num(s.realAvg, 2) + ' (chahiye ' + avgOf() + ')' : '—')}${line('Driver se lena', rs(s.pending))}${line('Driver baqaya', rs(s.driverBaqi))}</tbody></table>
    <table class="iv-tbl"><thead><tr><th>Tareekh</th><th>Biltiyan</th><th>Kharche</th><th>Km</th><th>Diesel</th><th>Nafa</th></tr></thead><tbody>
    ${s.pheras.map(p => { const c = pc(p); return `<tr><td>${esc(p.date)}</td><td>${(p.bilties || []).map(b => `${esc(b.from)}→${esc(b.to)} ${rs(b.kiraya)}${b.col ? '' : ' (lena)'}`).join('<br>')}</td><td>${(p.kharche || []).map(k => esc(k.n) + ' ' + num(k.a)).join('<br>')}<br><b>${rs(c.kh)}</b></td><td class="iv-n">${num(c.km)}${c.tk ? '<br>trk ' + num(c.tk) : ''}${c.kmOk ? '' : ' ❌'}</td><td class="iv-n">${num(c.dL, 1)} L<br>${rs(c.dRs)}<br>banta ${num(c.shouldL, 1)}</td><td class="iv-n"><b>${rs(c.nafa)}</b></td></tr>`; }).join('')}</tbody></table>
    <table class="iv-tbl"><thead><tr><th>Kharcha</th><th>Kul</th></tr></thead><tbody>${Object.entries(s.cat).sort((a, b) => b[1] - a[1]).map(([a, b]) => line(esc(a), rs(b))).join('')}</tbody></table>`);
}

document.addEventListener('click', e => {
  if (!mounted) return;
  const col = e.target.closest?.('[data-gcol]'); if (col) { const [pid, bid] = col.dataset.gcol.split('|'); const p = rows.find(r => r.id === pid); const b = p?.bilties?.find(x => x.id === bid);
    if (b) { b.col = true; b.colAt = Date.now(); const data = { ...p }; delete data.id; cloud.putGaari(pid, data).catch(er => notice('❌ ' + (er?.message || er))); col.closest('.gr-row')?.remove(); notice('✓ ' + rs(b.kiraya) + ' le liya'); if (!cur) paint(); } return; }
  if ($('dialog')?.contains(e.target) && e.target.closest?.('#gpPage')) return;   // phera page apna click khud sambhalta hai
  const gpc = e.target.closest?.('[data-gp]'); if (gpc) { if ($('dialog')?.open) closeModal(); setTimeout(() => openPhera(gpc.dataset.gp), 30); return; }
  if (e.target.closest?.('[data-gp-new]')) { newPhera(); return; }
  const gd = e.target.closest?.('[data-gd]'); if (gd) { e.preventDefault(); day = gd.dataset.gd === day ? '' : gd.dataset.gd; paint(); return; }
  const m = e.target.closest?.('[data-gr-m]'); if (m) { shiftMonth(Number(m.dataset.grM)); return; }
  const o = e.target.closest?.('[data-gr-open]'); if (o) { openDetail(o.dataset.grOpen); return; }
  if (e.target.closest?.('[data-gr-add="driver"]')) { if (isOwner()) openDriverPay(); return; }
  if (e.target.closest?.('[data-gr-cfg]')) { if (isOwner()) openCfg(); return; }
  if (e.target.closest?.('[data-gr-pdf]')) { makePdf(); return; }
  const x = e.target.closest?.('[data-gr-del]'); if (x) { if (!confirm('Ye entry hata dein?')) return; rows = rows.filter(r => r.id !== x.dataset.grDel); cloud.delGaari(x.dataset.grDel).catch(er => notice('Nahi hua: ' + (er?.message || er))); x.closest('.gr-row')?.remove(); }
});
