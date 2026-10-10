// audit.js — v2.22.0: 🕘 HISTORY — poori app ki har harkat ek jagah (kis ne, kab, kya kiya, kya badla)
// - App ki har likhai cloud.js ke methods se guzarti hai: auditAttach(cloud) un methods ko lapet kar auditLog/<id> likhta hai.
// - Khata (blueKhata) ki entry/party/closing... app.js save() se auditKhata(payload, existing) — PEHLE/BAAD ka farq (diff) ke sath.
// - History screen: 30 din, filter chips (waqt · kaun · qism · search), din ke hisaab se, tap -> record khule.
//   Jo records PC ne likhe (POS sync) ya is update se PEHLE ke hain, un ka sirf "kab bani / kab badli / kis ne" record ke apne stamp se.
// - Rules 2.12: auditLog sirf JOR sakte hain (create), badal/mita nahi (sirf malik mita sake). Parh sakte: malik + Full mulazim.
// - 30 din: malik History kholta hai to purani (30 din se pehle) khud saaf; button bhi hai.
import { smartHit } from './smart-search.js?v=2.99.15';   // v2.98: 🔎 spelling-maafi list search
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK').format(Math.round((Number(n) || 0) * 100) / 100);
const rs = n => 'Rs ' + num(n);
const dayOf = (ms = Date.now()) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayOf(d.getTime()); };
const clock = ms => { try { return new Date(ms).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const KEEP_DAYS = 30;

let cloud = null, notice = () => {}, whoOf = () => ({ uid: '', name: '', role: '', scope: '' }), recordsOf = () => [], partyNameOf = () => '', openRef = () => false;
let logs = [], stop = null, stopFrom = '', names = new Map(), pruned = false;
let fPeriod = 'today', fWho = 'all', fArea = 'all', fQ = '';

export function auditSetup(o) {
  cloud = o.cloud || cloud; notice = o.notice || notice; whoOf = o.who || whoOf;
  recordsOf = o.records || recordsOf; partyNameOf = o.partyName || partyNameOf; openRef = o.open || openRef;
}
export function auditStop() { if (stop) { try { stop(); } catch {} stop = null; stopFrom = ''; } }

// ---------- likhna ----------
const ID = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function auditEvent(ev) {   // {area, act, what, ref, refType, party, amount(Rs), diff:[{f,a,b}], note}
  try {
    if (!cloud?.addAudit) return;
    const w = whoOf() || {};
    if (!w.uid) return;
    const d = {
      id: ID(), at: Date.now(), day: dayOf(), by: String(w.uid), byName: String(w.name || (w.role === 'owner' ? 'Malik' : 'Mulazim')).slice(0, 60),
      role: String(w.role || '').slice(0, 12), scope: String(w.scope || '').slice(0, 12),
      area: String(ev.area || 'app').slice(0, 20), act: String(ev.act || 'add').slice(0, 20), what: String(ev.what || '').slice(0, 120),
      ref: String(ev.ref || '').slice(0, 120), refType: String(ev.refType || '').slice(0, 20), party: String(ev.party || '').slice(0, 120),
      note: String(ev.note || '').slice(0, 200),
      diff: (Array.isArray(ev.diff) ? ev.diff : []).slice(0, 12).map(x => ({ f: String(x.f || '').slice(0, 40), a: String(x.a ?? '').slice(0, 80), b: String(x.b ?? '').slice(0, 80) })),
    };
    if (ev.amount != null && Number.isFinite(Number(ev.amount))) d.amount = Math.round(Number(ev.amount) * 100) / 100;
    Promise.resolve(cloud.addAudit(d)).catch(e => console.warn('history nahi likhi', e));
  } catch (e) { console.warn('audit', e); }
}

// ---------- KHATA: pehle / baad ka farq ----------
const KINDS = { purchaseCash: 'Cash purchase', sale: 'Daily sale', collection: 'Wasooli', payment: 'Party ko payment', expense: 'Akhrajat', credit: 'Udhar diya', borrow: 'Hum ne dena hai' };
const FIELDS = {
  entry: [['amount', 'raqam', v => rs((Number(v) || 0) / 100)], ['partyId', 'party', v => partyNameOf(v) || v], ['kind', 'qism', v => KINDS[v] || v], ['date', 'tareekh'], ['note', 'note'], ['account', 'account'], ['dailyIncluded', 'daily mein', v => v === false ? 'nahi' : 'haan'], ['posPending', 'POS mein daalni', v => v ? 'haan' : 'nahi'], ['deleted', 'delete', v => v ? 'haan' : 'nahi']],
  party: [['name', 'naam'], ['phone', 'phone'], ['category', 'qism'], ['opening', 'opening', v => rs((Number(v) || 0) / 100)], ['note', 'note'], ['dasti', 'dasti', v => v ? 'haan' : 'nahi'], ['deleted', 'delete', v => v ? 'haan' : 'nahi']],
  closing: [['cash', 'cash', v => rs((Number(v) || 0) / 100)], ['change', 'change', v => rs((Number(v) || 0) / 100)], ['opening', 'opening', v => rs((Number(v) || 0) / 100)]],
  reminder: [['dueDate', 'due date'], ['note', 'note'], ['repeat', 'repeat'], ['deleted', 'delete', v => v ? 'haan' : 'nahi']],
  cashCustody: [['moves', 'harkatein', v => (Array.isArray(v) ? v.length : 0) + ' move']],
  expenseAccount: [['name', 'naam'], ['deleted', 'delete', v => v ? 'haan' : 'nahi']],
};
export function diffOf(before, after, type) {
  const out = [];
  for (const [f, lab, fmt] of (FIELDS[type] || FIELDS.entry)) {
    const a = before?.[f], b = after?.[f];
    const same = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (same) continue;
    const F = fmt || (v => v == null || v === '' ? '—' : String(v));
    out.push({ f: lab, a: F(a), b: F(b) });
  }
  return out;
}
const whatOfRecord = r => r?.type === 'entry' ? (KINDS[r.kind] || 'Entry') + (r.purchase ? ' (purchase)' : '') : r?.type === 'party' ? 'Khata (party)' : r?.type === 'closing' ? 'Closing cash' : r?.type === 'cashCustody' ? 'Dasti / custody' : r?.type === 'reminder' ? 'Reminder' : r?.type === 'expenseAccount' ? 'Akhrajat account' : r?.type === 'dayPhoto' ? 'Din ki tasveer' : (r?.type || 'Record');
export function auditKhata(payload, existing) {
  try {
    if (!payload) return;
    const t = payload.type || 'entry';
    const act = !existing ? 'add' : (payload.deleted && !existing.deleted) ? 'del' : (!payload.deleted && existing.deleted) ? 'restore' : 'edit';
    const diff = existing ? diffOf(existing, payload, t) : [];
    if (existing && !diff.length && act === 'edit') return;   // kuch badla hi nahi
    const party = t === 'party' ? payload.name : (payload.partyId ? partyNameOf(payload.partyId) : (payload.account || ''));
    auditEvent({ area: 'khata', act, what: whatOfRecord(payload), ref: payload.id, refType: 'khata', party, amount: t === 'entry' ? (Number(payload.amount) || 0) / 100 : undefined, diff, note: act === 'add' && payload.note ? payload.note : '' });
  } catch (e) { console.warn('auditKhata', e); }
}

// ---------- cloud.js ke methods lapetna ----------
const cnt = a => Array.isArray(a) ? a.length : 0;
const MAP = {
  saveAppPurchase: ([d]) => ({ area: 'purchase', act: d?.editOf ? 'edit' : 'add', what: 'POS purchase bill' + (d?.editOf?.billNo ? ' ' + d.editOf.billNo : ''), ref: d?.id, refType: 'purchase', party: d?.partyName, amount: d?.total, note: cnt(d?.lines) + ' items' + (d?.invoiceNo ? ' · bill # ' + d.invoiceNo : '') }),
  updateAppPurchase: ([id, p]) => ({ area: 'purchase', act: p?.status === 'cancel' ? 'cancel' : p?.status === 'new' ? 'retry' : p?.editDone ? 'done' : 'edit', what: 'POS purchase bill', ref: id, refType: 'purchase', note: p?.status ? 'status: ' + p.status : '' }),
  saveAppSale: ([d]) => ({ area: 'sale', act: 'add', what: 'Sale bill', ref: d?.id, refType: 'sale', party: d?.partyName || d?.customer || '', amount: d?.total, note: cnt(d?.lines) + ' items' + (d?.mode ? ' · ' + d.mode : '') }),
  reprintAppSale: ([id]) => ({ area: 'sale', act: 'print', what: 'Sale bill dobara print', ref: id, refType: 'sale' }),
  requestTransfer: ([d]) => ({ area: 'stock', act: d?.op === 'delete' ? 'del' : 'add', what: 'Transfer note (godam ' + (d?.from ?? '') + ' → ' + (d?.to ?? '') + ')', ref: d?.transferId || '', refType: 'transfer', note: cnt(d?.lines) + ' items' }),
  requestFarqPost: ([d]) => ({ area: 'stock', act: 'post', what: 'Ginti ka farq POS mein', note: d?.round ? 'round ' + d.round : '' }),
  requestItem: ([j]) => ({ area: 'stock', act: j?.op === 'edit' || j?.itemId ? 'edit' : 'add', what: 'Item ' + (j?.op === 'edit' || j?.itemId ? 'badla' : 'banaya') + (j?.name ? ': ' + j.name : ''), ref: j?.itemId || '', refType: 'item' }),
  requestSubcode: ([d]) => ({ area: 'stock', act: d?.op || 'edit', what: 'Sub-barcode' + (d?.code ? ' ' + d.code : ''), ref: d?.itemId || '', refType: 'item' }),
  requestLabel: ([d]) => ({ area: 'stock', act: 'print', what: 'Barcode label' + (d?.name ? ': ' + d.name : ''), ref: d?.itemId || '', refType: 'item', note: (d?.copies || 1) + ' copies' }),
  requestPrint: ([d]) => ({ area: 'stock', act: 'print', what: 'Dobara print (' + (d?.kind || '') + ')', ref: d?.id || '', note: d?.reason || '' }),
  requestRates: ([d]) => ({ area: 'stock', act: 'edit', what: 'Rates lagaye', note: cnt(d?.lines) + ' items' }),
  requestPost: ([d]) => ({ area: 'khata', act: 'post', what: 'POS mein post (' + (d?.op || '') + ')', note: cnt(d?.items) + ' entries' }),
  saveStockCount: ([r]) => ({ area: 'stock', act: 'count', what: 'Ginti' + (r?.name ? ': ' + r.name : ''), ref: r?.id || '', refType: 'item', note: r?.qty != null ? 'ginti ' + num(r.qty) : '' }),
  setStockLock: ([v]) => ({ area: 'stock', act: 'setting', what: 'Ginti ' + (v ? 'band' : 'chalu') }),
  setStockRound: ([v]) => ({ area: 'stock', act: 'setting', what: 'Ginti ka round: ' + (v || '') }),
  setItemEdit: ([v]) => ({ area: 'stock', act: 'setting', what: 'Mulazim item badal sake: ' + (v ? 'haan' : 'nahi') }),
  setAlias: ([id, txt]) => ({ area: 'stock', act: 'edit', what: 'Doosre naam yaad', ref: id, refType: 'item', note: String(txt || '').slice(0, 120) }),
  setDayLock: ([day]) => ({ area: 'din', act: day ? 'close' : 'open', what: day ? 'Din band' : 'Din khola' }),
  setStaffPassword: ([, scope]) => ({ area: 'staff', act: 'password', what: 'Mulazim password badla: ' + (scope || 'full') }),
  addGallaCall: ([d]) => ({ area: 'galla', act: 'add', what: 'Galla ko awaaz', ref: d?.id, refType: 'galla', party: d?.partyName, amount: (Number(d?.amount) || 0) / 100 }),
  payGallaCall: ([c]) => ({ area: 'galla', act: 'pay', what: 'Galla ne paise de diye', ref: c?.id, refType: 'galla', party: c?.partyName, amount: (Number(c?.amount) || 0) / 100 }),
};
export function auditAttach(obj) {
  if (!obj || obj._audited) return obj;
  for (const [k, desc] of Object.entries(MAP)) {
    const orig = obj[k]; if (typeof orig !== 'function') continue;
    obj[k] = function (...args) {
      const r = orig.apply(obj, args);
      const log = () => { try { auditEvent(desc(args)); } catch (e) { console.warn('audit', k, e); } };
      if (r && typeof r.then === 'function') return r.then(v => { log(); return v; });
      log(); return r;
    };
  }
  obj._audited = true;
  return obj;
}

// ---------- parhna / screen ----------
function watch() {
  const from = daysAgo(KEEP_DAYS - 1);
  if (stop && stopFrom === from) return;
  auditStop(); stopFrom = from;
  stop = cloud?.listenAudit ? cloud.listenAudit(from, list => { logs = (list || []).filter(x => x && x.id); for (const x of logs) if (x.by && x.byName) names.set(x.by, x.byName); paint(); }) : null;
}
const ACT = { add: ['➕', 'nayi', 'add'], edit: ['✏️', 'badli', 'edit'], del: ['🗑', 'hatai', 'del'], restore: ['↩', 'wapas', 'add'], post: ['📌', 'post', 'post'], pay: ['💵', 'diye', 'pay'], print: ['🖨', 'print', 'edit'], cancel: ['✕', 'cancel', 'del'], retry: ['🔁', 'dobara', 'edit'], done: ['✓', 'ho gaya', 'add'], count: ['🔢', 'ginti', 'edit'], setting: ['⚙️', 'setting', 'edit'], close: ['🔒', 'band', 'del'], open: ['🔓', 'khola', 'add'], password: ['🔑', 'password', 'edit'], login: ['👤', 'login', 'edit'] };
const AREA = { khata: '📒 Khata', purchase: '🧾 Purchase', sale: '🧾 Sale', stock: '📦 Stock', galla: '💰 Galla', din: '📅 Din', staff: '👤 Mulazim', app: 'App' };
const nameOfUid = (uid, ev) => ev?.byName || names.get(uid) || (!uid ? '🖥 PC' : (whoOf()?.uid === uid ? (whoOf().name || 'Main') : 'Mulazim'));
function stampEvents() {   // records ke apne stamp — jin ki history auditLog mein nahi (PC / purani)
  const out = [], have = new Set(logs.map(x => x.refType + '|' + x.ref + '|' + Math.round((x.at || 0) / 15000)));
  const from = new Date(daysAgo(KEEP_DAYS - 1)).getTime();
  for (const r of recordsOf() || []) {
    if (!r || !r.id) continue;
    const mk = (at, by, act) => { if (!(at >= from)) return; const k = 'khata|' + r.id + '|' + Math.round(at / 15000); if (have.has(k)) return;
      out.push({ id: 'st-' + r.id + '-' + at, at, day: dayOf(at), by: by || '', byName: '', area: 'khata', act, what: whatOfRecord(r), ref: r.id, refType: 'khata', party: r.type === 'party' ? r.name : (r.partyId ? partyNameOf(r.partyId) : (r.account || '')), amount: r.type === 'entry' ? (Number(r.amount) || 0) / 100 : undefined, diff: [], stamp: true }); };
    mk(Number(r.createdAt) || 0, r.by, 'add');
    if (Number(r.updatedAt) > (Number(r.createdAt) || 0) + 2000 && (Number(r.rev) || 0) > 1) mk(Number(r.updatedAt), r.updatedBy, r.deleted ? 'del' : 'edit');
  }
  return out;
}
function periodFrom() { return fPeriod === 'today' ? dayOf() : fPeriod === '7' ? daysAgo(6) : daysAgo(KEEP_DAYS - 1); }
function filtered() {
  const from = periodFrom(), q = fQ.trim().toLowerCase();
  return logs.concat(stampEvents())
    .filter(x => x.day >= from)
    .filter(x => fWho === 'all' || (x.by || 'pc') === fWho)
    .filter(x => fArea === 'all' || x.area === fArea)
    .filter(x => !q || smartHit([x.what, x.party, x.note, x.byName, x.amount != null ? String(Math.round(x.amount)) : '', ...(x.diff || []).flatMap(d => [d.f, d.a, d.b])].join(' '), q))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}
export function renderHistory() {
  watch();
  const w = whoOf();
  if (w?.role === 'owner' && !pruned && cloud?.pruneAudit) { pruned = true; Promise.resolve(cloud.pruneAudit(daysAgo(KEEP_DAYS - 1))).then(n => { if (n) console.log('history: purani', n, 'saaf'); }).catch(() => {}); }
  $('summary').innerHTML = '<div class="hs-root" id="hsRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  paint();
}
function paint() {
  const root = $('hsRoot'); if (!root) return;
  const all = filtered();
  const people = new Map(); for (const x of logs.concat(stampEvents())) { if (x.day < periodFrom()) continue; const k = x.by || 'pc'; people.set(k, (people.get(k) || 0) + 1); }
  const who = whoOf();
  const bySum = [...people.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button type="button" class="rc${fWho === k ? ' on' : ''}" data-hs-who="${esc(k)}">${esc(nameOfUid(k === 'pc' ? '' : k))} ${n}</button>`).join('');
  let day = '', rows = '';
  for (const x of all.slice(0, 400)) {
    if (x.day !== day) { day = x.day; rows += `<div class="hs-day">${day === dayOf() ? 'Aaj' : day === daysAgo(1) ? 'Kal' : esc(day)}</div>`; }
    const a = ACT[x.act] || ['•', x.act, 'edit'];
    rows += `<button type="button" class="hs-row ${a[2]}" data-hs-open="${esc(x.refType || '')}|${esc(x.ref || '')}">
      <span class="hs-time">${esc(clock(x.at))}</span>
      <span class="hs-main"><span class="hs-top"><b class="hs-act ${a[2]}">${a[0]} ${esc(a[1])}</b><span class="hs-what">${esc(x.what || '')}</span>${x.party ? `<span class="hs-party">${esc(x.party)}</span>` : ''}${x.amount != null ? `<span class="hs-amt">${rs(x.amount)}</span>` : ''}</span>
      ${(x.diff && x.diff.length) ? `<span class="hs-diff">${x.diff.map(d => `<i>${esc(d.f)}: <s>${esc(d.a)}</s> → <b>${esc(d.b)}</b></i>`).join('')}</span>` : ''}
      <span class="hs-meta">${esc(nameOfUid(x.by, x))}${x.scope && x.scope !== 'full' && x.scope !== 'owner' ? ' · ' + esc(x.scope) : ''}${x.note ? ' · ' + esc(x.note) : ''}${x.stamp ? ' · <em>record ka stamp</em>' : ''}</span></span></button>`;
  }
  root.innerHTML = `<div class="hs-head"><div class="mchips">${[['today', 'Aaj'], ['7', '7 din'], ['30', '30 din']].map(([k, l]) => `<button type="button" class="rc${fPeriod === k ? ' on' : ''}" data-hs-p="${k}">${l}</button>`).join('')}</div>
    <div class="mchips">${[['all', 'Sab'], ['khata', '📒 Khata'], ['purchase', '🧾 Purchase'], ['sale', '🧾 Sale'], ['stock', '📦 Stock'], ['galla', '💰 Galla'], ['din', '📅 Din'], ['staff', '👤 Mulazim']].map(([k, l]) => `<button type="button" class="rc${fArea === k ? ' on' : ''}" data-hs-a="${k}">${l}</button>`).join('')}</div>
    <div class="mchips"><button type="button" class="rc${fWho === 'all' ? ' on' : ''}" data-hs-who="all">Sab log</button>${bySum}</div>
    <label class="hs-search"><input type="search" placeholder="🔍 naam, raqam, note…" value="${esc(fQ)}" data-hs-q="1"></label>
    <div class="hs-sum"><b>${all.length}</b> harkatein${all.length > 400 ? ' (pehli 400)' : ''}</div></div>
    <div class="hs-list">${rows || '<p class="hs-empty">Is filter mein kuch nahi</p>'}</div>
    ${who?.role === 'owner' ? `<p class="hs-foot">History ${KEEP_DAYS} din rehti hai — purani khud saaf ho jati hai. <button type="button" class="hs-prune" data-hs-prune="1">🗑 ${KEEP_DAYS} din se purani abhi saaf karein</button></p>` : `<p class="hs-foot">History ${KEEP_DAYS} din rehti hai.</p>`}`;
}
document.addEventListener('click', async e => {
  if (!$('hsRoot')) return;
  const t = e.target.closest?.('[data-hs-p],[data-hs-a],[data-hs-who],[data-hs-open],[data-hs-prune]'); if (!t) return;
  const d = t.dataset;
  if (d.hsP) { fPeriod = d.hsP; paint(); return; }
  if (d.hsA) { fArea = d.hsA; paint(); return; }
  if (d.hsWho) { fWho = d.hsWho; paint(); return; }
  if (d.hsPrune) { if (!confirm(KEEP_DAYS + ' din se purani history mita dein?')) return; t.disabled = true; try { const n = await cloud.pruneAudit(daysAgo(KEEP_DAYS - 1)); notice('🗑 ' + (n || 0) + ' purani harkatein saaf'); } catch (er) { notice('Nahi hui: ' + (er?.message || er)); } finally { t.disabled = false; } return; }
  if (d.hsOpen != null) { const [type, id] = String(d.hsOpen).split('|'); if (id && !openRef(type, id)) notice('Ye record yahan nahi khulta'); }
});
document.addEventListener('input', e => { if (e.target.matches?.('[data-hs-q]')) { fQ = e.target.value || ''; const l = document.querySelector('.hs-list'); if (l) { const keep = document.activeElement; paint(); try { const q = document.querySelector('[data-hs-q]'); if (keep?.matches?.('[data-hs-q]') && q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } catch {} } } });
