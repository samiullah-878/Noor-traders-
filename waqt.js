// waqt.js — v1.1 (2026-11-21, app v2.341.0: ⇄ transfer bhi wapas (naya transfer, dono khate) + 🖥 POS mein voucher abhi ho to wapas ROK — dohra na bane) · v1.0 (app v2.340.0): 🕒 IS WAQT KI ENTRIES — sirf malik.
// Malik (21 Nov): "Naeem ki entry ke neeche time likha hai — us time ki entries ka data do to hum wapis recover kar lein".
// Tareekh + waqt (± 10 / 30 / 60 min · 3 ghante) -> us dauran jo bhi khata entry BANI / BADLI / HATAI gayi (sab khate) ek list mein.
// Data = app ke apne records (createdAt / updatedAt stamps) — koi naya Firestore read / PC kaam nahi. Hatai hui par ☐ tick -> ↩ Wapas lao
// (default sab un-tick; transfer / HBL jora / POS purchase bill yahan se wapas nahi). AI nahi.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let C = null, W = null, PN = new Map();
const pname = e => PN.get(e.partyId) || e.account || '';
export function wqSetup(ctx) { C = ctx; }

const tOf = v => { if (v == null || v === '') return 0; const n = Number(v); if (Number.isFinite(n) && n > 0) return n; const p = Date.parse(String(v)); return Number.isFinite(p) ? p : 0; };
const pad = n => String(n).padStart(2, '0');
const dayOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const hmOf = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const clock = ms => { try { return new Date(ms).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', second: '2-digit' }); } catch { return ''; } };
const WINS = [[10, '± 10 min'], [30, '± 30 min'], [60, '± 1 ghanta'], [180, '± 3 ghante']];
const nc = c => String(c || '').toUpperCase().replace(/\s+/g, '').replace(/-0+(\d)/, '-$1');
const PL = new Map();   // khata -> Set(POS voucher codes) | null (data nahi) | 0 (parh raha)
function posHas(e) { if (!e.posCode) return null; const s = PL.get(e.partyId); if (s === undefined || s === 0) return undefined; return s ? s.has(nc(e.posCode)) : null; }
let plBusy = false;
async function posLoad() {
  if (plBusy || !W || !C.posLines) return; const S = W;
  const need = [...new Set(rows().filter(x => x.act === 'del' && x.e.posCode && PL.get(x.e.partyId) === undefined).map(x => x.e.partyId))].slice(0, 40);
  if (!need.length) return; plBusy = true; need.forEach(id => PL.set(id, 0));
  for (const id of need) { try { const d = await C.posLines(id); let L = []; try { L = JSON.parse((d && d.j) || '[]'); } catch {} PL.set(id, d ? new Set(L.map(r => nc(r[1]))) : null); } catch { PL.set(id, null); } }
  plBusy = false; if (W === S && !S.busy) paint();
}
const ACT = { del: ['🗑', 'hatai'], add: ['➕', 'bani'], edit: ['✏️', 'badli'] };

function why(e) {   // khali = wapas la sakte hain
  if (!e.deleted) return '';
  if (e.transferId && C.trDone(e)) return '✅ yeh transfer wapas aa chuka';
  const ph = e.transferId ? (C.records().some(r => r.transferId === e.transferId && posHas(r) === true) ? true : posHas(e)) : posHas(e); if (ph === true) return '🖥 POS mein yeh voucher ABHI hai — wapas = dohra (khate ki Farq screen se 📱 App ko POS jaisa)';
  if (C.bkPair && C.bkPair(e)) return '🏦 HBL jora — HBL screen se';
  if (/^pos-\d+$/.test(String(e.id)) || e.purchase === true) return 'POS purchase bill';
  return '';
}
function rows() {
  const win = W.win * 60000, hit = t => t > 0 && Math.abs(t - W.at) <= win, out = [];
  PN = new Map();
  for (const e of C.records()) {
    if (e.type === 'party') { PN.set(e.id, e.name || ''); continue; }
    if (e.type !== 'entry') continue;
    const c = tOf(e.createdAt), u = tOf(e.updatedAt);
    let act = '', t = 0;
    if (hit(u) && e.deleted) { act = 'del'; t = u; }
    else if (hit(c)) { act = 'add'; t = c; }
    else if (hit(u) && Math.abs(u - c) > 2000) { act = 'edit'; t = u; }
    if (!act) continue;
    if (W.only === 'del' && act !== 'del') continue;
    out.push({ e, act, t });
  }
  return out.sort((a, b) => a.t - b.t).slice(0, 400);
}
function html() {
  const L = rows(), ok = L.filter(x => x.act === 'del' && !why(x.e) && posHas(x.e) !== undefined && !W.st[x.e.id]), n = ok.filter(x => W.sel.has(x.e.id)).length;
  const nd = L.filter(x => x.act === 'del').length;
  return `<div class="dd-root wq-root" data-wq-root="1">
<div class="dd-bar"><input type="date" data-wq-day value="${esc(dayOf(W.at))}"><input type="time" data-wq-time value="${esc(hmOf(W.at))}">${WINS.map(([m, t]) => `<button type="button" data-wq-win="${m}" class="${W.win === m ? 'is-in' : ''}">${t}</button>`).join('')}<button type="button" data-wq-only class="${W.only === 'del' ? 'is-in' : ''}">🗑 Sirf hatai hui</button></div>
<p class="stat-note dd-note">${L.length} entries${L.length >= 400 ? ' (pehli 400)' : ''} · 🗑 ${nd} hatai · ➕ ${L.filter(x => x.act === 'add').length} bani · ✏️ ${L.filter(x => x.act === 'edit').length} badli${ok.length ? ` · <b>✓ ${n}/${ok.length}</b>` : ''}</p>
<div class="dd-list">${L.map(x => {
    const e = x.e, w = x.act === 'del' ? why(e) : '', s = W.st[e.id], ph = x.act === 'del' ? posHas(e) : null, can = x.act === 'del' && !w && !s && ph !== undefined, on = can && W.sel.has(e.id);
    const pc = /^(pos-sync|pc-)/.test(String(e.updatedBy || '')) ? '🖥 PC' : '📱 app';
    const sub = [clock(x.t) + ' ' + ACT[x.act][1], pc, 'entry ' + (e.date || ''), e.posCode ? '🖥 ' + String(e.posCode).replace(/-0+(\d)/, '-$1') : '', String(e.note || '').slice(0, 60), e.transferId && x.act === 'del' && !w ? '⇄ dono khaton mein wapas' : '', ph === undefined ? '⏳ POS dekh raha hoon' : ph === false ? '✓ POS mein nahi' : '', w ? '⛔ ' + w : ''].filter(Boolean).join(' · ');
    return `<label class="dd-r wq-${x.act}${can ? '' : ' wq-ro'}${on ? ' is-in' : ''}${s === '✅' ? ' done' : ''}"><input type="checkbox" data-wq-pick="${esc(e.id)}"${on ? ' checked' : ''}${can ? '' : ' disabled'}><span class="dd-a ${C.red(e) ? 'red' : 'green'}">${ACT[x.act][0]} ${esc(C.money(e.amount))}</span><span class="dd-t"><b>${esc(pname(e) || '—')}</b><i>${esc(C.label(e))}</i><small>${esc(sub)}</small></span>${s ? `<em class="dd-s">${esc(s)}</em>` : ''}</label>`;
  }).join('') || '<p class="stat-note">Is waqt ke aas paas koi entry nahi mili — waqt ka daira (± ) bara karein</p>'}</div>
<button type="button" class="dd-go wq-go" data-wq-go${n && !W.busy ? '' : ' disabled'}>↩ ${n} entries wapas lao</button>
<p class="stat-note dd-note">Sirf 🗑 hatai hui entry par tick lagta hai (default sab khali). Wapas aane par entry apne khate mein aa jati hai aur shop PC us ka POS voucher dobara bana deta hai (1–2 min) — baad mein khate ka ⚖️ POS milan dekh lein. ⇄ Transfer = naya transfer banta hai (dono khaton mein, ek tick kaafi). Jis voucher ka POS mein ABHI hona nazar aaye us par tick band hai (dohra na bane).</p></div>`;
}
function paint() { const r = document.querySelector('#dialogBody [data-wq-root]'); if (r) r.outerHTML = html(); void posLoad(); }
export function wqOpen(at) {
  if (!C || !C.owner()) return;
  const t = tOf(at) || Date.now();
  W = { at: t, win: 30, only: '', sel: new Set(), st: {}, busy: false };
  C.modal('🕒 Is waqt ki entries', html()); void posLoad();
}
async function go() {
  if (!W || W.busy || !C.owner()) return;
  const S = W, L = rows().filter(x => x.act === 'del' && !why(x.e) && posHas(x.e) !== undefined && !S.st[x.e.id] && S.sel.has(x.e.id)).map(x => x.e);
  if (!L.length) return;
  const tot = L.reduce((n, e) => n + (Number(e.amount) || 0), 0);
  if (!confirm(`↩ ${L.length} entries wapas lani hain (kul ${C.money(tot)}):\n\n${L.slice(0, 12).map(e => '• ' + C.money(e.amount) + ' · ' + (pname(e) || '') + ' · ' + (e.date || '')).join('\n')}${L.length > 12 ? '\n…' : ''}\n\n• Har entry apne khate mein wapas aayegi\n• Shop PC POS mein voucher dobara banayega\n\nPakka wapas layein?`)) return;
  S.busy = true; L.forEach(e => { S.st[e.id] = '⏳'; }); if (W === S) paint();
  for (const e of L) {
    try { const cur = C.records().find(r => r.id === e.id); if (!cur) throw Error('entry nahi mili'); if (!cur.deleted) { S.st[e.id] = '✅'; continue; } await C.restore(cur); S.st[e.id] = '✅'; if (cur.transferId) for (const r of C.records()) if (r.transferId === cur.transferId) S.st[r.id] = '✅'; }
    catch (er) { S.st[e.id] = '✕ ' + String(er?.message || er).slice(0, 60); }
    if (W === S) paint();
  }
  S.busy = false; S.sel.clear(); if (W === S) paint();
  const okN = L.filter(e => S.st[e.id] === '✅').length;
  C.notice(`↩ ${okN}/${L.length} entries wapas aa gayi`);
  try { C.render(); } catch {}
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-wq-win],[data-wq-only],[data-wq-go]'); if (!b || !W || !b.closest('[data-wq-root]')) return;
  e.preventDefault();
  if ('wqGo' in b.dataset) { void go(); return; }
  if (W.busy) return;
  if (b.dataset.wqWin) W.win = Number(b.dataset.wqWin) || 30; else W.only = W.only === 'del' ? '' : 'del';
  W.sel.clear(); paint();
});
document.addEventListener('change', e => {
  const t = e.target; if (!W || !t?.closest?.('[data-wq-root]')) return;
  if (t.dataset.wqPick) { if (t.checked) W.sel.add(t.dataset.wqPick); else W.sel.delete(t.dataset.wqPick); paint(); return; }
  if (W.busy) return;
  if ('wqDay' in t.dataset || 'wqTime' in t.dataset) {
    const r = t.closest('[data-wq-root]'), d = r.querySelector('[data-wq-day]')?.value, tm = r.querySelector('[data-wq-time]')?.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || !/^\d{2}:\d{2}/.test(tm || '')) return;
    const ms = new Date(d + 'T' + tm.slice(0, 5) + ':00').getTime(); if (!Number.isFinite(ms)) return;
    W.at = ms; W.sel.clear(); W.st = {}; paint();
  }
});
