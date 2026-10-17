// bank-inbox.js — v2.99.33 (2026-10-12): 📩 HBL INBOX — HBL ke SMS (paise AAYE, phone par MacroDroid) aur email (paise GAYE, Gmail Apps Script)
// Firestore businesses/noor-traders/bankSms (rules 2.38) mein aate hain. Yahan: parhna (bank-sms.js), khata ka andaza (yaad + naam),
// ✓ par HBL khate mein entry: aaye = khata -> HBL transfer · gaye = HBL -> khata transfer · Cash Deposit = closing ka cash HBL ko ("Cash diya").
// Bina ✓ kuch nahi lagta. Ek len-den ek hi dafa (TXN ID). Malik: Setup (chaabi, MacroDroid ki body, Gmail ka script).
import { parseBank, bankKeyOf, guessParty, aliasKey } from './bank-sms.js?v=2.103.16';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
let testBusy = false, testMsg = '', testOk = false;
let O = {}, docs = null, stop = null, alias = {}, tab = 'baqi', pick = new Map(), qOpen = '', busy = new Set(), key = null, onCount = () => {};
export function bankSetup(o) { O = o || {}; onCount = o.onCount || onCount; }
const m = v => (O.money ? O.money(v) : 'Rs ' + (v / 100).toLocaleString('en-PK'));
const who = () => (O.who ? O.who() : {}) || {};
const canUse = () => (O.canUse ? O.canUse() : false);
const capOk = k => (O.can ? O.can(k) !== false : true);   // v2.99.62: Settings → Mulazim (hbl.ok / hbl.skip / hbl.pdf)
export function bankWatch() {
  if (stop || !O.cloud?.listenBankSms || !canUse()) return;
  stop = O.cloud.listenBankSms(list => {
    if (!list) { docs = docs || []; return; }
    alias = (list.find(d => d.id === '_alias') || {}).m || {};
    try { O.bankShared?.(alias['@hbl'] || ''); } catch {}
    docs = list.filter(d => d.id !== '_alias');
    onCount(rows().pend.length); if (live()) paint();
    setTimeout(autoRun, 1500 + Math.random() * 2500);
  });
}
const isOpen = () => !!document.querySelector('#dialogBody .bk-root');
const onScreen = () => !!document.querySelector('#list .bk-screen');
const onDaily = () => !!document.querySelector('#list .bk-day');
const live = () => isOpen() || onScreen() || onDaily();
// sab docs -> parsed + dubara wale alag
const srcIc = s => s === 'email' ? '✉️' : s === 'notif' ? '🔔' : '💬';   // v2.99.74
// v2.99.74: 🔔 notification + baad mein usi len-den ka SMS / email = EK. TXN alag ho sakti hai (Raast) — is liye: aaye/gaye + raqam barabar
// aur waqt 30 min ke andar, aur zariya alag (notification vs SMS/email) -> ek hi key. Do asal alag len-den (dono SMS) kabhi nahi jurte.
const minOf = r => r && r.day && r.time ? Math.round(Date.parse(r.day + 'T' + r.time + ':00Z') / 60000) : null;
function twinKeys(all) {
  const isDone = x => x.d.st === 'done' || x.d.st === 'skip';
  for (const x of all) {
    if (!x.r.ok || x.d.src !== 'notif' || x.tw) continue;
    const m = minOf(x.r); if (m == null) continue;
    const y = all.find(z => z !== x && !z.tw && z.r.ok && z.d.src !== 'notif' && (z.r.bankAc || 'hbl') === (x.r.bankAc || 'hbl') && z.r.dir === x.r.dir && z.r.amt === x.r.amt && minOf(z.r) != null && Math.abs(minOf(z.r) - m) <= 30);
    if (!y) continue;
    x.tw = y; y.tw = x;
    if (isDone(x) && !isDone(y)) y.k = x.k; else x.k = y.k;   // jo lag chuka us ki key · dono baqi: SMS / email ki (TXN + poora naam)
  }
}
// v2.99.75: ⇄ APNA TRANSFER — ek bank se gaye (HBL notification) + doosre apne bank mein aaye (Alfalah SMS "from Noor Traders HABB…"),
// raqam barabar, 30 min ke andar -> EK transfer (A -> B). Aaye wala card chhupa (x.selfHide), gaye wale par "⇄ HBL → Alfalah".
// Ek taraf pehle hi us bank ke khate mein lag chuki ho (partyId = doosra bank) to doosri taraf dubara (dup).
function selfPairs(all) {
  const dn = x => x.d.st === 'done' || x.d.st === 'skip';
  for (const y of all) {
    if (!y.r.ok || y.r.dir !== 'in' || y.sp || y.r.kind === 'stmt') continue;
    const B = bankOf(y.r), my = minOf(y.r); if (!B || !isOwn(B.id) || my == null) continue;
    const x = all.find(z => z !== y && !z.sp && z.r.ok && z.r.dir === 'out' && z.r.kind === 'party' && z.r.amt === y.r.amt && minOf(z.r) != null && Math.abs(minOf(z.r) - my) <= 30
      && bankOf(z.r) && isOwn(bankOf(z.r).id) && bankOf(z.r).id !== B.id && (!dn(z) || z.d.partyId === B.id));
    if (!x) continue;
    x.sp = y; y.sp = x;
    if (dn(x) && !dn(y)) y.k = x.k; else if (!dn(x) && !dn(y)) { x.self = y; y.selfHide = true; }
  }
}
// v2.99.76: ✉️ Alfalah ki do emails (ibanking = naam · email.notification = account + charges) + SMS — wahi Ref (FT…) = EK len-den.
// Key pehle hi ek (bankKeyOf = 'T' + Ref). Yahan maloomat jorte hain taake jo bhi card dikhe us mein naam + account + charges sab hon.
function refMerge(all) {
  const g = new Map();
  for (const x of all) if (x.r.ok && x.r.bankAc === 'alfalah' && x.r.txn) { const k = x.r.txn.toUpperCase(); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  for (const xs of g.values()) {
    if (xs.length < 2) continue;
    const nm = xs.find(z => z.r.name && !z.r.noName), ac = xs.find(z => z.r.acct), fe = xs.find(z => z.r.fee > 0), ho = xs.find(z => z.r.holder);
    for (const x of xs) {
      if (nm && (x.r.noName || !x.r.name)) Object.assign(x.r, { name: nm.r.name, bank: nm.r.bank || x.r.bank, noName: false });
      if (ac && !x.r.acct) x.r.acct = ac.r.acct;
      if (fe && !(x.r.fee > 0)) x.r.fee = fe.r.fee;
      if (ho && !x.r.holder) x.r.holder = ho.r.holder;
    }
  }
}
function rows() {
  const all = (docs || []).filter(d => !('p' in d) || d.text).map(d => { const r = parseBank(d.text, d.src, d.subj); return { d, r, k: r.ok ? bankKeyOf(r) : 'X' + d.id }; });
  all.sort((a, b) => (b.r.day + b.r.time).localeCompare(a.r.day + a.r.time) || String(b.d.at || '').localeCompare(String(a.d.at || '')));
  refMerge(all); twinKeys(all); selfPairs(all);
  const seen = new Map(); for (const x of all) if (x.d.st === 'done' || x.d.st === 'skip') seen.set(x.k, x);
  const pend = [], done = [], bad = [], dup = [], info = [];
  for (const x of all) {
    if (x.d.st === 'done' || x.d.st === 'skip') { done.push(x); continue; }
    if (!x.r.ok) { bad.push(x); continue; }
    if (x.r.kind === 'stmt') { info.push(x); continue; }   // v2.99.75: 📄 card statement — sirf maloomat
    if (x.selfHide) { dup.push(x); continue; }
    if (seen.has(x.k)) { const o = seen.get(x.k);   // v2.99.74: dono baqi — SMS / email wala dikhe, notification jurwan mein
      if (o.d.src === 'notif' && x.d.src !== 'notif' && pend.includes(o) && !(o.d.st)) { pend.splice(pend.indexOf(o), 1, x); dup.push(o); seen.set(x.k, x); } else dup.push(x); continue; }
    seen.set(x.k, x); pend.push(x);
  }
  return { pend, done, bad, dup, all, info };
}
export const bankCount = () => (docs ? rows().pend.length : 0);
const hbl = () => { const id = O.bankId ? O.bankId() : ''; return id && O.party ? O.party(id) : null; };
// v2.99.59 🏦 KAUN SA ACCOUNT: SMS / email mein account number (A/C 0257*****46303 · From Account No. 0257…46303) ho to us ke aakhri 4
// number se khata (alias '@a:6303' — malik / mulazim ne aik dafa chuna). Number na ho (Raast "in your HBL A/C") = HBL Noor Traders.
// Anjaan number = null: khud nahi lagta, card par "kaun sa account?" (maslan loan 7999 ka SMS ghalti se HBL purana mein na jaye).
const acctK = a => { const d = String(a || '').replace(/\D/g, ''); return d.length >= 4 ? d.slice(-4) : ''; };
// v2.99.76: Alfalah ibanking email mein account number nahi — "Dear SAMI ULLAH" = *5826, "Dear NOOR TRADERS" = *0294 (malik ne bataya)
const ALF_HOLDER = { SAMIULLAH: '5826', NOORTRADERS: '0294' };
const holderAcct = r => r && r.bankAc === 'alfalah' && r.holder ? ALF_HOLDER[String(r.holder).toUpperCase().replace(/[^A-Z]/g, '')] || '' : '';
function bankOf(r) {
  if (r && r.kind === 'card') { const id = alias['@c:' + r.card]; return id && O.party ? O.party(id) || null : null; }   // v2.99.75: 💳 card ka khata
  const k = acctK(r && r.acct) || holderAcct(r); if (!k) return r && r.bankAc === 'alfalah' ? null : hbl(); const id = alias['@a:' + k]; return id && O.party ? O.party(id) || null : null; }
// v2.99.75: apne bank / card khate (alias se) — screen ki chips + apna transfer pehchanna
const ownIds = () => { const ids = []; for (const [k, v] of Object.entries(alias)) if ((k === '@hbl' || k.startsWith('@a:') || k.startsWith('@c:')) && v && !ids.includes(v) && O.party && O.party(v)) ids.push(v); return ids; };
const isOwn = id => !!id && ownIds().includes(id);
const cardOf = id => { for (const [k, v] of Object.entries(alias)) if (k.startsWith('@c:') && v === id) return k.slice(3); return ''; };
const SELF_RE = /noor\s*traders|sami\s*ullah|samiullah/i;   // apne naam — "Noor Traders HABB…" = HBL se apna paisa
// 💳 / fee ka kharcha kis khate mein — dukan ke naam se yaad: alias '@m:<KEY>' = 'expense:<naam>' / 'party:<id>'
const mKey = r => String(r.merchant || r.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24) || 'X';
function mTo(r) {
  const v = String(alias['@m:' + mKey(r)] || '');
  if (v.startsWith('expense:')) return { kind: 'expense', id: v, name: v.slice(8) };
  if (v.startsWith('party:')) { const p = O.party ? O.party(v.slice(6)) : null; return p ? { kind: 'party', id: v, name: p.name, p } : null; }
  return null;
}
const kTo = r => r.kind === 'bill' ? billTo() : (r.kind === 'card' || r.kind === 'fee') ? mTo(r) : null;
const isKh = r => r.kind === 'bill' || r.kind === 'card' || r.kind === 'fee';
const bankChoices = () => { const all = (O.parties ? O.parties() : []).filter(p => p && !p.deleted); const t = all.filter(p => p.bank || /hbl|bank|loan|meezan|alfalah|ubl|mcb/i.test(String(p.name || ''))); return t.length ? t : all.slice(0, 10); };
// v2.99.59 🧾 BILL (GEPCO waghera, HBL Mobile se): kis kharcha khate mein — alias '@bill' = 'expense:<naam>' ya 'party:<id>' (aik dafa chuna)
function billTo() {
  const v = String(alias['@bill'] || '');
  if (v.startsWith('expense:')) return { kind: 'expense', id: v, name: v.slice(8) };
  if (v.startsWith('party:')) { const p = O.party ? O.party(v.slice(6)) : null; return p ? { kind: 'party', id: v, name: p.name, p } : null; }
  return null;
}
const billChoices = q => { const l = (O.expenseChoices ? O.expenseChoices() : []); const qq = String(q || '').trim().toLowerCase();
  const hit = qq.length >= 2 ? (O.smartSearch ? O.smartSearch(l, qq, 10) : l.filter(a => String(a.name).toLowerCase().includes(qq)).slice(0, 10))
    : l.filter(a => a.kind === 'expense' || /kharch|harch|shop|dukan|bill/i.test(String(a.name))).slice(0, 10);
  return hit; };
// v2.99.75: ➕ naya bank / card khata (malik) — card par malik ka bataya outstanding opening (dena) + limit + due tareekh
async function newAcct(spec) {
  if (!O.addParty || !(O.owner && O.owner())) return;
  const [t, k] = spec.split('|'), ci = t === 'c' ? CARD_INFO[k] : null;
  const name = prompt(t === 'c' ? 'Card ke khate ka naam:' : 'Bank account ke khate ka naam:', t === 'c' ? 'Alfalah Card ' + k : k === '5826' ? 'Alfalah Samiullah (5826)' : 'Alfalah ' + k);
  if (!name || !name.trim()) return;
  let open = 0;
  if (t === 'c') { const v = prompt(`Card ${k} par ABHI kitna dena hai (outstanding)? 0 = khali`, ci ? String(ci.out) : '0'); if (v == null) return; open = -Math.round(Number(String(v).replace(/,/g, '')) * 100) || 0; }
  try {
    const id = await O.addParty({ name: name.trim().slice(0, 80), opening: open });
    if (!id) throw Error('Khata nahi bana');
    const add = t === 'c' ? { ['@c:' + k]: id, ...(ci ? { ['@lim:' + k]: String(ci.lim), ['@dd:' + k]: String(ci.dd) } : {}) } : { ['@a:' + k]: id };
    alias = { ...alias, ...add }; await O.cloud.bankAliasSet(alias);
    O.notice?.(`➕ "${name.trim()}" khata ban gaya${t === 'c' ? ' — purane card SMS (aaj se pehle ke) outstanding mein shamil hain, un ko ✕ kar dein' : ''}`);
  } catch (er) { O.notice?.('⚠️ ' + (er?.message || er)); }
  paint(); setTimeout(autoRun, 800);
}
async function editLim(c) {
  if (!(O.owner && O.owner())) return;
  const l = prompt(`Card ${c} ki LIMIT (Rs):`, String(Number(alias['@lim:' + c]) || (CARD_INFO[c] ? CARD_INFO[c].lim : ''))); if (l == null) return;
  const dd = prompt(`Card ${c} ki DUE tareekh (har mahine kaun si tareekh, 1-31):`, String(Number(alias['@dd:' + c]) || (CARD_INFO[c] ? CARD_INFO[c].dd : ''))); if (dd == null) return;
  alias = { ...alias, ['@lim:' + c]: String(Math.round(Number(String(l).replace(/,/g, '')) || 0)), ['@dd:' + c]: String(Math.max(0, Math.min(31, Math.round(Number(dd) || 0)))) };
  try { await O.cloud.bankAliasSet(alias); O.notice?.('💳 Card ' + c + ' ki limit / due tareekh save'); } catch (er) { O.notice?.('⚠️ ' + (er?.message || er)); }
  paint();
}
async function setAlias(k, v, msg) { alias = { ...alias, [k]: v }; paint(); try { await O.cloud.bankAliasSet(alias); if (msg) O.notice?.(msg); } catch (er) { O.notice?.('⚠️ ' + (er?.message || er)); } setTimeout(autoRun, 500); }
// v2.99.75: malik ke bataye card (limit / outstanding) — naya khata banate waqt opening
const CARD_INFO = { '4917': { lim: 1500000, out: 1453961, dd: 26 }, '0605': { lim: 1000000, out: 970314, dd: 6 } };
function acctAskHTML(x) {
  if (bankOf(x.r)) return '';
  if (x.r.kind === 'card') { const c = x.r.card;
    return `<div class="bkp-ask acct">💳 <b>Card …${esc(c)} kis khate ka?</b> <small>aik dafa — phir har card SMS khud</small><div class="bkp-opts">${O.addParty && O.owner && O.owner() ? `<button type="button" class="bkp-ic new" data-bk-newacct="c|${esc(c)}">➕ Naya khata: Alfalah Card ${esc(c)}</button>` : ''}${bankChoices().map(p => `<button type="button" class="bkp-ic" data-bk-cmap="${esc(c)}|${esc(p.id)}">💳 ${esc(p.name)}</button>`).join('')}</div></div>`; }
  const k = acctK(x.r.acct) || holderAcct(x.r); if (!k) return x.r.bankAc === 'alfalah' ? '<div class="bkp-ask acct">🏦 <b>Alfalah ka kaun sa account?</b> <small>SMS mein number nahi</small></div>' : '';
  return `<div class="bkp-ask acct">🏦 <b>Yeh kaun sa account hai?</b> <small>A/C …${esc(k)} — aik dafa chunein, phir yaad</small><div class="bkp-opts">${O.addParty && O.owner && O.owner() ? `<button type="button" class="bkp-ic new" data-bk-newacct="a|${esc(k)}">➕ Naya khata: ${x.r.bankAc === 'alfalah' ? 'Alfalah' : 'Bank'} ${esc(k)}</button>` : ''}${bankChoices().map(p => `<button type="button" class="bkp-ic" data-bk-acmap="${esc(k)}|${esc(p.id)}">🏦 ${esc(p.name)}</button>`).join('')}</div></div>`;
}
// 💳 / fee: kharcha kis khate mein (dukan ke naam se yaad)
function kharchWhoHTML(x) {
  const r = x.r, T = mTo(r), id = esc(x.d.id), mk = mKey(r);
  if (T && qOpen !== 'm:' + x.d.id) return `<div class="bkp-who"><span class="bkp-pk">🧾 Kharcha</span><b>${esc(T.name)}</b><small>${esc(bankOf(r)?.name || (r.kind === 'card' ? 'card' : 'bank'))} se · Daily mein nahi</small><button type="button" class="bkp-ic" data-bk-mchg="${id}" title="Badlo">✏️</button></div>`;
  return `<div class="bkp-ask">🧾 <b>"${esc(r.merchant || r.name)}" ka kharcha kis khate mein?</b> <small>aik dafa — phir isi naam par khud</small><input type="search" placeholder="🔍 kharcha / khata…" data-bk-mq="${id}" autocomplete="off"><div class="bkp-opts" id="bkM-${id}">${mOptsHTML('', mk)}</div></div>`;
}
const mOptsHTML = (q, mk) => billChoices(q).map(a => `<button type="button" class="bkp-ic" data-bk-mto="${esc(mk)}|${esc(a.id)}">${a.kind === 'expense' ? '🧾' : '👤'} ${esc(a.name)}</button>`).join('') || '<small>Nahi mila</small>';
function billWhoHTML(x) {
  const T = billTo(), id = esc(x.d.id);
  if (T && qOpen !== 'bill:' + x.d.id) return `<div class="bkp-who"><span class="bkp-pk">🧾 Kharcha</span><b>${esc(T.name)}</b><small>${esc(bankOf(x.r)?.name || 'HBL')} se minus · Daily mein nahi${x.r.consumer ? ' · Consumer ' + esc(x.r.consumer) : ''}</small><button type="button" class="bkp-ic" data-bk-billchg="${id}" title="Badlo">✏️</button></div>`;
  return `<div class="bkp-ask">🧾 <b>Bill kis kharcha khate mein?</b> <small>aik dafa — phir har bill khud</small><input type="search" placeholder="🔍 kharcha / khata…" data-bk-bq="${id}" autocomplete="off"><div class="bkp-opts" id="bkB-${id}">${billOptsHTML('')}</div></div>`;
}
const billOptsHTML = q => billChoices(q).map(a => `<button type="button" class="bkp-ic" data-bk-bill="${esc(a.id)}">${a.kind === 'expense' ? '🧾' : '👤'} ${esc(a.name)}</button>`).join('') || '<small>Nahi mila</small>';
const dShow = r => { if (!r.day) return ''; const [y, mo, d] = r.day.split('-'); return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mo) - 1]}${r.time ? ' · ' + r.time : ''}`; };
function sugOf(x) {
  if (pick.has(x.d.id)) { const p = O.party(pick.get(x.d.id)); if (p) return { p, why: 'aap ne chuna' }; }
  return guessParty(x.r.name, (O.parties ? O.parties() : []).filter(p => !p.bank), alias);
}
function cardHTML(x) {
  const r = x.r, id = esc(x.d.id), cash = r.kind === 'cash', s = cash ? null : sugOf(x), q = qOpen === x.d.id;
  const meta = [r.bank, r.via, dShow(r), r.txn ? 'TXN ' + r.txn : ''].filter(Boolean).map(esc).join(' · ');
  const sug = cash ? `<div class="bk-sug cash">🏦 ${r.dir === 'in' ? 'Closing / galle ka cash HBL mein jama ("Cash diya")' : 'ATM / cash nikala — khata mein haath se'}</div>`
    : s && !q ? `<div class="bk-sug">👤 <b>${esc(s.p.name)}</b><small>${esc(s.why)}</small><button type="button" class="bk-mini" data-bk-chg="${id}">✏️ Badlo</button></div>`
    : `<div class="bk-pick"><input type="search" placeholder="🔍 kis ka khata? naam likhein…" data-bk-q="${id}" autocomplete="off"><div class="bk-res" id="bkRes-${id}"></div></div>`;
  const okDis = busy.has(x.d.id) || !bankOf(r) || (x.self ? false : isKh(r) ? !kTo(r) : (r.dir !== 'in' && (cash || !s)));
  return `<article class="bk-card ${r.dir}">
    <div class="bk-top"><span class="bk-dir">${r.dir === 'in' ? '🟢 Aaye' : '🔴 Gaye'}</span><b class="bk-amt">${m(r.amt)}</b><span class="bk-src">${srcIc(x.d.src)}</span></div>
    <div class="bk-who"><b>${esc(r.name || '—')}</b><small>${meta}</small></div>${sug}
    <div class="bk-acts"><button type="button" class="give" data-bk-skip="${id}"${busy.has(x.d.id) ? ' disabled' : ''}>✕ Chhoro</button><button type="button" class="got" data-bk-ok="${id}"${okDis ? ' disabled' : ''}>${busy.has(x.d.id) ? '⏳ Lag raha hai…' : '✓ Lagao'}</button></div></article>`;
}
function doneHTML(x) {
  const r = x.r, p = x.d.partyId && O.party ? O.party(x.d.partyId) : null;
  return `<div class="bk-done ${r.dir}"><span>${x.d.st === 'skip' ? '✕' : '✓'}</span><div><b>${esc(r.name || x.d.text.slice(0, 40))}</b><small>${esc(dShow(r))}${p ? ' · 👤 ' + esc(p.name) : ''}${x.d.byName ? ' · ' + esc(x.d.byName) : ''}</small></div><b class="bk-amt">${r.amt ? (r.dir === 'in' ? '+' : '−') + m(r.amt) : ''}</b></div>`;
}
function html() {
  const R = rows(), today = O.today ? O.today() : '', T = R.pend.concat(R.done.filter(x => x.d.st === 'done')).filter(x => x.r.ok && x.r.day === today);   // dubara aaye (wahi TXN) ek hi dafa
  const inT = T.filter(x => x.r.dir === 'in').reduce((n, x) => n + x.r.amt, 0), outT = T.filter(x => x.r.dir === 'out').reduce((n, x) => n + x.r.amt, 0);
  const last = src => { const l = R.all.find(x => x.d.src === src && x.r.day); return l ? dShow(l.r) : 'abhi nahi'; };
  const H = hbl(), banks = (O.parties ? O.parties() : []).filter(p => p.bank);
  const tabs = [['baqi', `📥 Baqi ${R.pend.length}`], ['done', `✓ Lag gaye ${R.done.length}`], ['bad', `❓ Samajh nahi ${R.bad.length}`]].concat(O.owner && O.owner() ? [['setup', '⚙️ Setup']] : []);
  let body = '';
  if (tab === 'setup') body = setupHTML();
  else if (tab === 'done') body = R.done.slice(0, 80).map(doneHTML).join('') || '<p class="bk-empty">Abhi kuch nahi lagaya</p>';
  else if (tab === 'bad') body = R.bad.slice(0, 40).map(x => `<div class="bk-raw"><small>${x.d.src === 'email' ? '✉️ ' + esc(x.d.subj || '') : srcIc(x.d.src) + ' ' + esc(x.d.from || '')}</small><p>${x.d.text ? esc(String(x.d.text).slice(0, 400)) : '<b>⚠️ SMS ka text KHALI aaya.</b> MacroDroid ki body mein "text" ke quotes ke beech <b>Magic Text → SMS message</b> nahi laga — ya macro "Test actions" se chalaya (us mein SMS hota hi nahi). ⚙️ Setup mein tareeqa dekhein.'}</p><button type="button" class="give" data-bk-skip="${esc(x.d.id)}">✕ Hatao</button></div>`).join('') || '<p class="bk-empty">Sab samajh aa gaye 👍</p>';
  else body = (H ? '' : `<div class="bk-warn">⚠️ HBL khata nahi chuna. ${banks.length ? `<select data-bk-bank><option value="">— chunein —</option>${banks.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>` : 'Pehle bank ka khata banayein.'}</div>`)
    + (R.pend.map(cardHTML).join('') || `<div class="bk-empty">🎉<b>Sab lag gaye</b><small>Naya SMS / email aate hi yahan aayega</small></div>`) + (R.dup.length ? `<small class="bk-note">${R.dup.length} dubara aaye hue (wahi TXN) chhupaye</small>` : '');
  return `<div class="bk-root"><div class="bk-sum"><div><small>Aaj aaye</small><b class="green">${m(inT)}</b></div><div><small>Aaj gaye</small><b class="red">${m(outT)}</b></div><div><small>Baqi</small><b>${R.pend.length}</b></div></div>
    <div class="bk-live">🔔 aakhri notification: ${esc(last('notif'))} · 💬 aakhri SMS: ${esc(last('sms'))} · ✉️ aakhri email: ${esc(last('email'))}${H ? ' · 🏦 ' + esc(H.name) : ''}</div>
    <div class="mchips bk-tabs">${tabs.map(([k, l]) => `<button type="button" class="rc${tab === k ? ' on' : ''}" data-bk-tab="${k}">${l}</button>`).join('')}</div>${body}</div>`;
}
function paint() { if (onScreen()) renderHbl(); else if (onDaily() && O.rerender) O.rerender(); const b = $('dialogBody'); if (b && isOpen()) { const q = qOpen && b.querySelector(`[data-bk-q="${CSS.escape(qOpen)}"]`)?.value; b.innerHTML = html(); if (qOpen) { const i = b.querySelector(`[data-bk-q="${CSS.escape(qOpen)}"]`); if (i) { i.value = q || ''; i.focus(); search(i); } } } }
export function openBankInbox(t) {
  if (!canUse()) { O.notice?.('HBL Inbox: malik ya Full mulazim'); return; }
  bankWatch(); if (t) tab = t;
  const dl = $('dialog'); dl.classList.remove('search-dialog'); dl.classList.add('full-dialog');
  $('dialogTitle').textContent = '📩 HBL Inbox';
  $('dialogBody').innerHTML = docs ? html() : '<div class="bk-root"><p class="bk-empty">⏳ aa raha hai…</p></div>';
  if (!dl.open) dl.showModal();
  if (tab === 'setup') loadKey();
}
// v2.99.76 🏦 Alfalah email ka "Tax/Charges" — bank (H) se minus + kharcha. Khata: 'BANK FEE' wala yaad (@m:BANKFEE) warna "Bank charges".
// Pakki ID bk<doc>f / bk<doc>g — do dafa chale to bhi ek hi entry.
const feeTo = () => mTo({ merchant: 'BANK FEE' }) || { kind: 'expense', name: ((O.expenseChoices ? O.expenseChoices() : []).find(a => a.kind === 'expense' && /bank\s*(charge|fee)/i.test(String(a.name))) || {}).name || 'Bank charges' };
async function postFee(id, r, H, date) {
  if (!(r.fee > 0) || r.dir !== 'out' || !H) return '';
  const F = feeTo(), fn = (`🏦 ${H.name} · charges${r.name ? ' · ' + r.name : ''}${r.txn ? ' · TXN ' + r.txn : ''}`).slice(0, 900);
  if (F.kind === 'party') { const fid = 'bk' + id + 'f'; const ok = await O.pay({ id: fid, rev: 0, fromPartyId: H.id, toPartyId: F.p.id, amount: r.fee, date, note: fn, posPending: false, posVoucher: '' }); if (ok === false) throw Error('Charges nahi lage'); return fid; }
  if (!O.post) return '';
  const base = { amount: r.fee, date, note: fn, dailyIncluded: false, posPending: false, bankSms: id };
  await O.post([{ ...base, id: 'bk' + id + 'f', kind: 'collection', partyId: H.id, posNo: true }, { ...base, id: 'bk' + id + 'g', kind: 'expense', account: F.name, partyId: '' }]);
  return 'bk' + id + 'f|bk' + id + 'g';
}
// ---------- ✓ lagao ----------
async function apply(id, auto = false) {
  const x = rows().pend.find(z => z.d.id === id); if (!x || busy.has(id)) return;
  if (!auto && !capOk('hbl.ok')) { O.notice?.('Is kaam ki ijazat nahi — malik se kahein'); return; }
  const r = x.r, H = bankOf(r); if (!H) { if (!auto) O.notice?.(r.kind === 'card' ? 'Pehle chunein: card …' + r.card + ' kis khate ka' : (acctK(r.acct) || holderAcct(r)) ? 'Pehle chunein: yeh kaun sa account hai (A/C …' + (acctK(r.acct) || holderAcct(r)) + ')' : r.bankAc === 'alfalah' ? 'Pehle chunein: Alfalah ka kaun sa account' : 'Pehle HBL khata chunein'); return; }
  const BW = r.kind === 'card' ? 'Card' : r.bankAc === 'alfalah' ? 'Alfalah' : 'HBL';   // v2.99.75: note ka pehla lafz
  const w = who(), own = O.owner && O.owner(), today = O.today ? O.today() : '';
  const date = own && r.day && r.day <= today ? r.day : today;
  const note = (`${BW} ${r.dir === 'in' ? 'aaye' : 'gaye'} · ${r.name || 'naam nahi'}${r.bank ? ' (' + r.bank + ')' : ''}${r.via ? ' · ' + r.via : ''}${r.txn ? ' · TXN ' + r.txn : ''}${date !== r.day && r.day ? ' · asal din ' + r.day : ''}`).slice(0, 900);
  busy.add(id); paint();
  try {
    let partyId = '', entryId = '';
    if (x.self) {
      // v2.99.75 ⇄ APNA TRANSFER: A (yeh gaye) -> B (doosre bank mein aaye) — ek transfer, dono SMS / notification done
      const y = x.self, B = bankOf(y.r); if (!B) throw Error('Doosra bank khata nahi mila');
      entryId = (crypto.randomUUID ? crypto.randomUUID() : 'bk' + Date.now());
      const tn = (`⇄ Apna transfer · ${H.name} → ${B.name}${r.txn ? ' · TXN ' + r.txn : ''}${y.r.txn ? ' · ' + y.r.txn : ''}`).slice(0, 900);
      const ok = await O.pay({ id: entryId, rev: 0, fromPartyId: H.id, toPartyId: B.id, amount: r.amt, date, note: tn, posPending: false, posVoucher: '' });
      if (ok === false) throw Error('Transfer nahi laga');
      partyId = B.id;
      await O.cloud.bankSmsSet(y.d.id, { st: 'done', by: String(w.uid || ''), byName: String(w.name || '').slice(0, 60), doneAt: Date.now(), partyId: H.id, entryId: '', kind: 'self' });
    } else if (r.kind === 'card' || r.kind === 'fee') {
      // v2.99.75 💳 CARD istemal / 🏦 bank fee: card (ya bank) ka udhaar barha + kharcha khate mein. Daily mein nahi, POS mein nahi.
      const T = mTo(r); if (!T) throw Error('Pehle chunein: "' + (r.merchant || r.name) + '" ka kharcha kis khate mein');
      const bn = (`${r.kind === 'card' ? '💳 Card ' + r.card : '🏦 ' + H.name} · ${r.name}${r.avl ? ' · Avl Limit ' + (r.avl / 100).toLocaleString('en-US') : ''}${date !== r.day && r.day ? ' · asal din ' + r.day : ''}`).slice(0, 900);
      if (T.kind === 'party') {
        entryId = (crypto.randomUUID ? crypto.randomUUID() : 'bk' + Date.now());
        const ok = await O.pay({ id: entryId, rev: 0, fromPartyId: H.id, toPartyId: T.p.id, amount: r.amt, date, note: bn, posPending: false, posVoucher: '' });
        if (ok === false) throw Error('Entry nahi lagi');
        partyId = T.p.id;
      } else {
        if (!O.post) throw Error('Entry nahi lagi');
        const base = { amount: r.amt, date, note: bn, dailyIncluded: false, posPending: false, bankSms: id };
        await O.post([{ ...base, id: 'bk' + id + 'b', kind: r.kind === 'card' ? 'borrow' : 'collection', partyId: H.id, posNo: true }, { ...base, id: 'bk' + id + 'x', kind: 'expense', account: T.name, partyId: '' }]);
        entryId = 'bk' + id + 'b|bk' + id + 'x'; partyId = H.id;
      }
    } else if (r.kind === 'bill') {
      // v2.99.59 🧾 HBL se bill: bank se minus + kharcha khate mein. Daily (galla) mein nahi, POS mein voucher nahi (posNo).
      const T = billTo(); if (!T) throw Error('Pehle chunein: bill kis kharcha khate mein');
      const bn = (`HBL bill · ${r.name}${r.consumer ? ' · Consumer ' + r.consumer : ''}${r.txn ? ' · TXN ' + r.txn : ''}${date !== r.day && r.day ? ' · asal din ' + r.day : ''}`).slice(0, 900);
      if (T.kind === 'party') {
        entryId = (crypto.randomUUID ? crypto.randomUUID() : 'bk' + Date.now());
        const ok = await O.pay({ id: entryId, rev: 0, fromPartyId: H.id, toPartyId: T.p.id, amount: r.amt, date, note: bn, posPending: false, posVoucher: '' });
        if (ok === false) throw Error('Entry nahi lagi');
        partyId = T.p.id;
      } else {
        if (!O.post) throw Error('Entry nahi lagi');
        const base = { amount: r.amt, date, note: bn, dailyIncluded: false, posPending: false, bankSms: id };
        await O.post([{ ...base, id: 'bk' + id + 'b', kind: 'collection', partyId: H.id, posNo: true }, { ...base, id: 'bk' + id + 'x', kind: 'expense', account: T.name, partyId: '' }]);
        entryId = 'bk' + id + 'b|bk' + id + 'x'; partyId = H.id;
      }
    } else if (r.dir === 'in' && O.post) {
      // v2.99.58: AAYE = koi khata nahi poochna — seedha HBL Noor Traders: ek entry 'payment' (Daily: Akhrajat = galla ka paisa bank mein).
      // Server PC (bank-parchi v2) bhi yahi ID likhta hai — dono likhen to ek hi. Cash deposit bhi isi tarah.
      entryId = 'bk' + id + 'a'; partyId = H.id;
      await O.post([{ id: entryId, kind: 'payment', partyId: H.id, amount: r.amt, date, note, dailyIncluded: true, posPending: false, bankSms: id }]);
    } else if (r.kind === 'cash') {
      if (r.dir !== 'in') throw Error('ATM / cash nikalna khata mein haath se lagayein');
      entryId = await O.cashGive({ partyId: H.id, amount: r.amt, date, note });
      partyId = H.id;
    } else {
      const s = sugOf(x); if (!s) throw Error('Khata chunein');
      partyId = s.p.id;
      if (O.post && r.dir === 'in') {
        // v2.99.58 (v2.99.58: sirf AAYE): Daily Sale mein dono taraf — aaye: party ki WASOOLI + HBL ko PAYMENT (Akhrajat column) · gaye: HBL ki WASOOLI + party ko PAYMENT.
        // Galla barabar (wasooli = akhrajat), khaton ka baqaya transfer jaisa. Pakki ID (do phone ek saath lagayen to bhi do dafa nahi).
        const wId = 'bk' + id + 'w', aId = 'bk' + id + 'a', base = { amount: r.amt, date, note, dailyIncluded: true, posPending: false, bankSms: id };
        await O.post([{ ...base, id: wId, kind: 'collection', partyId: r.dir === 'in' ? s.p.id : H.id }, { ...base, id: aId, kind: 'payment', partyId: r.dir === 'in' ? H.id : s.p.id }]);
        entryId = wId + '|' + aId;
      } else {
        entryId = (crypto.randomUUID ? crypto.randomUUID() : 'bk' + Date.now());
        // v2.99.58: GAYE = seedha khate mein (HBL -> party transfer), Daily Sale mein NAHI (malik: "wasooli main nahi aiyega")
        const ok = await O.pay({ id: entryId, rev: 0, fromPartyId: r.dir === 'in' ? s.p.id : H.id, toPartyId: r.dir === 'in' ? H.id : s.p.id, amount: r.amt, date, note, posPending: false, posVoucher: '' });
        if (ok === false) throw Error('Entry nahi lagi');
      }
      const k = aliasKey(r.name); if (k && alias[k] !== s.p.id) { alias = { ...alias, [k]: s.p.id }; O.cloud.bankAliasSet(alias).catch(() => {}); }
    }
    const fe = await postFee(id, r, H, date); if (fe) entryId = (entryId ? entryId + '|' : '') + fe;   // v2.99.76: Alfalah charges
    await O.cloud.bankSmsSet(id, { st: 'done', by: String(w.uid || ''), byName: String(w.name || '').slice(0, 60), doneAt: Date.now(), partyId, entryId: String(entryId || ''), kind: r.kind });
    pick.delete(id); O.notice?.(`${auto ? '🤖 Khud laga: ' : '✓ '}${m(r.amt)} — ${x.self ? '⇄ ' + H.name + ' → ' + (bankOf(x.self.r)?.name || '') : (r.kind === 'card' || r.kind === 'fee') ? r.name + ' → ' + (mTo(r)?.name || 'kharcha') : r.kind === 'bill' ? r.name + ' → ' + (billTo()?.name || 'kharcha') : r.kind === 'cash' ? 'cash HBL mein jama' : (r.dir === 'in' ? r.name + ' → HBL' : 'HBL → ' + r.name)}`);
  } catch (e) { if (auto) autoFail.add(id); O.notice?.('⚠️ ' + (auto ? 'Khud nahi laga (' + (r.name || '') + '): ' : '') + (e?.message || e)); }
  finally { busy.delete(id); paint(); onCount(rows().pend.length); }
}
// 🤖 v2.99.58: jo naam app ko YAAD hai (malik ne pehle khud khata chuna) — SMS / email aate hi khud lag jaye. Naya naam = ☐ hi rahe.
const autoFail = new Set(), feeFail = new Set(); let autoBusy = false;
async function autoRun() {
  if (autoBusy || !docs || !canUse() || !O.post || !hbl()) return;
  autoBusy = true;
  try {
    await fixOnce();
    // v2.99.59 ek dafa (malik ke phone par): HBL Noor Traders ka apna number …6303 (cash deposit SMS "0257*****46303" + bill email
    // "From Account No. 0257…46303") — pehle se yaad, taake Server PC cash / aaye paise rok na de. Doosre number (loan) app poochegi.
    if (O.owner && O.owner() && alias['@hbl'] && !Object.keys(alias).some(k => k.startsWith('@a:'))) { alias = { ...alias, '@a:6303': alias['@hbl'] }; try { await O.cloud.bankAliasSet(alias); } catch {} }
    // v2.99.75 ek dafa (malik): Alfalah Noor Traders ka khata = A/C …0294 (malik ne bataya) + Server PC us mein aaye paise khud lagaye
    if (O.owner && O.owner() && !alias['@alf1']) { const p = (O.parties ? O.parties() : []).find(z => z && !z.deleted && /alfalah|alflah/i.test(z.name || '') && /noor|traders|\bnt\b/i.test(z.name || ''));
      alias = { ...alias, '@alf1': '1', ...(p && !alias['@a:0294'] ? { '@a:0294': p.id, '@pcin:0294': '1' } : {}) }; try { await O.cloud.bankAliasSet(alias); } catch {} }
    // v2.99.76: len-den pehle lag gaya (naam wali email se) aur charges wali email baad mein aayi — charges ab laga do (ek dafa, pakki ID)
    for (const x of rows().done) {
      if (!(x.r.fee > 0) || x.r.dir !== 'out' || x.d.st !== 'done' || x.d.kind === 'dup' || String(x.d.entryId || '').includes('bk' + x.d.id + 'f') || feeFail.has(x.d.id)) continue;
      if (!x.r.day || x.r.day < '2026-10-14' || !bankOf(x.r)) continue;
      try { const date = x.r.day <= (O.today ? O.today() : '') && O.owner && O.owner() ? x.r.day : (O.today ? O.today() : x.r.day);
        const fe = await postFee(x.d.id, x.r, bankOf(x.r), date);
        if (fe) await O.cloud.bankSmsSet(x.d.id, { entryId: (x.d.entryId ? x.d.entryId + '|' : '') + fe }); } catch { feeFail.add(x.d.id); }
    }
    for (const x of rows().pend) {
      if ((x.r.kind === 'cash' && x.r.dir !== 'in') || autoFail.has(x.d.id) || busy.has(x.d.id) || pick.has(x.d.id)) continue;
      if (!x.r.day || x.r.day !== (O.today ? O.today() : '')) continue;   // v2.99.58: purani tareekh = pehle poocho, khud nahi
      if (!bankOf(x.r)) continue;                                          // v2.99.59: anjaan account number = pehle poocho
      if (x.self) { /* v2.99.75: ⇄ apna transfer — dono taraf maloom, khud */ }
      else if (x.r.kind === 'card' || x.r.kind === 'fee') { if (!mTo(x.r)) continue; }   // v2.99.75: dukan ka kharcha khata yaad ho to khud
      else if (x.r.kind === 'bill') { if (!billTo()) continue; }                // v2.99.59: bill = kharcha khata yaad ho to khud
      else if (x.r.dir === 'in' && SELF_RE.test(x.r.name) && !x.sp && Date.now() - (minOf(x.r) || 0) * 60000 < 40 * 60000 + 5 * 3600000) continue;   // apna paisa: doosri taraf (HBL gaye) ka intezar
      else if (x.r.dir !== 'in') { const s = guessParty(x.r.name, (O.parties ? O.parties() : []).filter(p => !p.bank), alias); if (!s || s.why !== 'yaad') continue; }
      else await new Promise(res => setTimeout(res, 4000));   // PC pehle laga de to yahan dobara nahi (rows() mein done aa jata hai)
      if (!rows().pend.some(z => z.d.id === x.d.id)) continue;
      await apply(x.d.id, true);
    }
  } finally { autoBusy = false; }
}
setInterval(() => { try { autoRun(); } catch {} }, 45000);
// v2.99.58 ek dafa (malik ke phone par): (1) GAYE jo Wasooli+Akhrajat jore ban kar lage — Daily se nikal kar transfer (seedha khata)
// (2) SAMIH ULLAH ka khud-yaad jor tora (malik: "ghalat jor") — agli dafa app poochhe. Nishan: alias['@fix47'].
async function fixOnce() {
  if (!(O.owner && O.owner()) || alias['@fix47'] || !O.post || !O.unpost || !O.pay) return;
  const es = O.entries ? O.entries() : [];
  for (const d of docs || []) {
    if (d.st !== 'done' || !String(d.entryId || '').includes('|')) continue;
    const r = parseBank(d.text, d.src, d.subj); if (r.dir !== 'out') continue;
    const [wId, aId] = String(d.entryId).split('|'), a = es.find(e => e.id === aId), H = hbl();
    if (!a || !H || !a.partyId) continue;
    const tid = (crypto.randomUUID ? crypto.randomUUID() : 'bk' + Date.now());
    const ok = await O.pay({ id: tid, rev: 0, fromPartyId: H.id, toPartyId: a.partyId, amount: a.amount, date: a.date, note: a.note, posPending: false, posVoucher: '' });
    if (ok === false) continue;
    await O.unpost([wId, aId]);
    await O.cloud.bankSmsSet(d.id, { entryId: tid });
  }
  const nx = { ...alias, '@fix47': '1' }; delete nx['samih ullah'];
  alias = nx; try { await O.cloud.bankAliasSet(alias); } catch {}
}
export function bankCounts() { if (!docs) return { all: 0, out: 0, old: 0 }; const t = O.today ? O.today() : '', p = rows().pend; return { all: p.length, out: p.filter(x => x.r.dir === 'out' && x.r.kind !== 'cash').length, old: p.filter(x => x.r.day && x.r.day < t).length }; }
async function skip(id) {
  if (!confirm('Is SMS / email ko chhor dein? (khata mein kuch nahi lagega)')) return;
  const w = who(); busy.add(id); paint();
  try { await O.cloud.bankSmsSet(id, { st: 'skip', by: String(w.uid || ''), byName: String(w.name || '').slice(0, 60), doneAt: Date.now() }); } catch (e) { O.notice?.('⚠️ ' + (e?.message || e)); }
  finally { busy.delete(id); paint(); }
}
const normQ = s => String(s || '').toLowerCase();
function search(inp) {
  const id = inp.dataset.bkQ, q = normQ(inp.value).trim(), box = $('bkRes-' + id); if (!box) return;
  const ps = (O.parties ? O.parties() : []).filter(p => !p.bank);
  const hits = q.length < 2 ? [] : (O.smartSearch ? O.smartSearch(ps, q, 8) : ps.filter(p => normQ(p.name).includes(q)).slice(0, 8));
  box.innerHTML = hits.map(p => `<button type="button" data-bk-pick="${esc(id)}|${esc(p.id)}">${esc(p.name)}${p.phone ? ' <small>' + esc(p.phone) + '</small>' : ''}</button>`).join('');
}
// ---------- ⚙️ setup (malik) ----------
async function loadKey() { if (key !== null || !O.cloud?.getBankKey) return; try { key = (await O.cloud.getBankKey()) || ''; } catch { key = ''; } paint(); }
const restUrl = () => `https://firestore.googleapis.com/v1/projects/${O.projectId}/databases/(default)/documents/businesses/noor-traders/bankSms?key=${O.apiKey}`;
const notifBody = k => `{"fields":{"k":{"stringValue":"${k}"},"src":{"stringValue":"notif"},"from":{"stringValue":"HBL Mobile"},"text":{"stringValue":"{not_title} — {notification}"}}}`;   // v2.99.74: 🔔 MacroDroid Notification Received
const smsBody = k => `{"fields":{"k":{"stringValue":"${k}"},"src":{"stringValue":"sms"},"from":{"stringValue":"14250"},"text":{"stringValue":"{sms_message}"}}}`;   // v2.99.58: MacroDroid ka magic text seedha — copy = paste, kuch badalna nahi
function gasCode(k) {
  return `// Blue Khata v2 — HBL + Bank Alfalah emails -> 📩 Bank Inbox. Google ke server par har 5 minute. Kuch mitata / bhejta nahi, sirf parhta hai.
// Yehi EK code har us Gmail mein jahan bank ki email aati hai (NOORTRADERS145 · googel6235 · hp6235) — jo email us Gmail mein nahi, woh bas nahi milti.
const KEY = '${k}';
const URL = '${restUrl()}';
const HBL = 'from:digital.banking@hbl.com';
const ALF = 'from:(email.notification@bankalfalah.com OR ibanking@bankalfalah.com) after:2026/10/13';   // Alfalah: sirf len-den wali (statement nahi) · purani nahi
function hblMail() { bhejo(HBL + ' -label:BK newer_than:7d'); bhejo(ALF + ' -label:BK newer_than:7d'); }
// ▶ dobara: pichhle 14 din ki SAB emails phir bhejo (BK label ho tab bhi) — app wahi TXN / Ref dobara nahi lagati
function dobara() { bhejo(HBL + ' newer_than:14d'); bhejo(ALF + ' newer_than:14d'); }
function bhejo(q) {
  const label = GmailApp.getUserLabelByName('BK') || GmailApp.createLabel('BK');
  const threads = GmailApp.search(q, 0, 100);
  threads.forEach(t => {
    let ok = true;
    t.getMessages().forEach(msg => {
      const doc = { fields: { k: { stringValue: KEY }, src: { stringValue: 'email' }, from: { stringValue: msg.getFrom().slice(0, 110) },
        subj: { stringValue: msg.getSubject().slice(0, 190) }, text: { stringValue: msg.getPlainBody().slice(0, 2900) }, at: { integerValue: String(msg.getDate().getTime()) } } };
      const r = UrlFetchApp.fetch(URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify(doc), muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) { ok = false; console.log('Nahi gaya (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200)); }
    });
    if (ok) t.addLabel(label);   // sirf kamyab ho to BK — warna agli dafa phir koshish
  });
}
function setup() {
  ScriptApp.getProjectTriggers().forEach(tr => ScriptApp.deleteTrigger(tr));
  ScriptApp.newTrigger('hblMail').timeBased().everyMinutes(5).create();
  hblMail();
}`;
}
const copyBtn = (what, lab) => `<button type="button" class="bk-copy" data-bk-copy="${what}">📋 ${lab}</button>`;
function setupHTML() {
  if (key === null) return '<p class="bk-empty">⏳ …</p>';
  const testBox = `<div class="bk-test"><button type="button" class="got" data-bk-test="1"${testBusy ? ' disabled' : ''}>${testBusy ? '⏳ Test ho raha hai…' : '🔎 Rabta test (app se Firebase)'}</button>${testMsg ? `<div class="bk-tres ${testOk ? 'ok' : 'bad'}">${testMsg}</div>` : ''}<small>Yeh wohi kaam karta hai jo MacroDroid / Gmail script karte hain — jawab yahin dikhega.</small></div>`;
  if (!key) return `<div class="bk-set"><h4>🔑 Pehle khufia chaabi</h4><p>Yeh chaabi sirf aap ke phone (MacroDroid) aur Gmail script mein jayegi — is ke baghair koi aur HBL Inbox mein kuch nahi daal sakta.</p><button type="button" class="got" data-bk-newkey="1">🔑 Chaabi banao</button></div>`;
  return `<div class="bk-set">${testBox}<h4>💬 1 · Paise AAYE — SMS (isi phone par, ek dafa)</h4><ol>
    <li>Play Store se <b>MacroDroid</b> install karein, kholein.</li>
    <li><b>Add Macro</b> → Trigger ➕ → <b>Call/SMS → SMS Received</b> → "Contact / number" mein <b>14250</b> → Any content → OK.</li>
    <li>Action ➕ → <b>Connectivity → HTTP Request</b> → Method <b>POST</b>.</li>
    <li>URL: ${copyBtn('url', 'URL copy')} → URL ke khane mein paste.</li>
    <li>Content body → type <b>application/json</b> → ${copyBtn('body', 'Body copy')} → purana sab mita kar <b>paste</b> karein. Bas — is mein chaabi aur <b>{sms_message}</b> (SMS ka text) pehle se hain, kuch badalna nahi.</li>
    <li>Macro ka naam "HBL → Blue Khata" → Save ✓.</li>
    <li>Phone Settings → Apps → MacroDroid → Battery → <b>Unrestricted</b> (warna phone band kar deta hai).</li>
    <li>Test: macro kholein → ⋮ → <b>Test actions</b> → yahan "❓ Samajh nahi" mein ek khali card aa jaye = rabta theek ✓ (use ✕ kar dein).</li></ol>
    <h4>🔔 1-B · LIVE — HBL Mobile app ki notification (sab se tez · isi phone par jahan HBL app login hai)</h4><ol>
    <li>MacroDroid → <b>Add Macro</b> → Trigger ➕ → <b>Device Events → Notification</b> (Notification Received) → Application: <b>HBL Mobile</b> chunein → Any content → OK. (Pehli dafa MacroDroid "Notification access" maangega → Allow.)</li>
    <li>Action ➕ → <b>Connectivity → HTTP Request</b> → Method <b>POST</b> → URL: ${copyBtn('url', 'URL copy')} paste.</li>
    <li>Content body → <b>application/json</b> → ${copyBtn('nbody', 'Notification body copy')} → purana mita kar <b>paste</b>. Is mein <b>{not_title}</b> aur <b>{notification}</b> pehle se hain.</li>
    <li>Naam "HBL Notification → Blue Khata" → Save ✓. Battery: MacroDroid <b>Unrestricted</b> (upar wala qadam).</li>
    <li>Check: agla len-den hote hi yahan 🔔 card aaye. Card khali / "❓ Samajh nahi" mein aaye to us ki screenshot bhej dein.</li>
    <li>Baad mein usi len-den ka SMS / email aaye to <b>do dafa nahi lagta</b> — app jor deti hai (raqam + 30 min).</li></ol>
    <h4>🏦 1-C · BANK ALFALAH — SMS (8287) · account *0294 / *5826 + 💳 cards</h4><ol>
    <li>MacroDroid → <b>Add Macro</b> → Trigger ➕ → <b>Call/SMS → SMS Received</b> → number <b>8287</b> → Any content → OK.</li>
    <li>Action ➕ → <b>HTTP Request</b> → <b>POST</b> → URL: ${copyBtn('url', 'URL copy')} paste.</li>
    <li>Content body → <b>application/json</b> → ${copyBtn('abody', 'Alfalah body copy')} → purana mita kar <b>paste</b>.</li>
    <li>Naam "Alfalah → Blue Khata" → Save ✓. Pehla SMS aate hi yahan "kaun sa account / card?" — aik dafa chunein (➕ naya khata bhi).</li></ol>
    <h4>✉️ 2 · Gmail — HBL + Alfalah emails (har Gmail mein ek dafa)</h4><ol>
    <li><b>Kaun si Gmail:</b> HBL → <b>NOORTRADERS145</b> · Alfalah account / charges → <b>googel6235</b> · Alfalah "sent to …" (naam) → <b>hp6235</b>. <b>Yehi ek script</b> teeno mein.</li>
    <li>Browser mein <b>script.google.com</b> kholein (us Gmail se login) → <b>New project</b>. Jahan pehle se script lagi hai wahan wohi project kholein.</li>
    <li>Wahan likha sab mita kar ${copyBtn('gas', 'Script copy')} paste → 💾 Save.</li>
    <li>Upar function list mein <b>setup</b> chunein → <b>▶ Run</b> → Review permissions → apna account → Advanced → "Go to … (unsafe)" → <b>Allow</b>.</li>
    <li>Bas — ab har 5 minute nayi email yahan aayegi (Gmail mein "BK" label lagta hai). Alfalah ki do emails (naam wali + charges wali) ka Ref ek = <b>ek hi len-den</b>.</li>
    <li>Purani emails nahi aayin? Naya script paste → Save → function list mein <b>dobara</b> chunein → <b>▶ Run</b> = pichhle 14 din ki sab dobara (wahi TXN do dafa nahi lagta).</li></ol>
    <p class="bk-note">🔒 Chaabi kisi ko na bhejein. Shak ho to ${O.owner && O.owner() ? '<button type="button" class="bk-mini" data-bk-newkey="1">🔁 nayi chaabi</button>' : ''} — phir MacroDroid body aur script dobara lagani hogi.</p></div>`;
}
// 🔎 app se wahi REST POST — Firebase ka jawab Roman Urdu mein
async function rabtaTest() {
  if (testBusy || !key) return; testBusy = true; testMsg = ''; paint();
  // qadam 1: rules asal mein nayi hain? (malik ke login se _alias likhna sirf rules 2.38+ mein allowed)
  try { await O.cloud.bankAliasSet(alias || {}); }
  catch (e) { testOk = false; testMsg = `❌ Rules ASAL MEIN purani hain — Firebase ne malik ko bhi bankSms mein likhne nahi diya (${esc(e?.code || e?.message || e)}).<br><b>Hal:</b> Firebase → Firestore → Rules → poori purani mita kar nayi paste → <b>Publish</b> dabayein → upar "Rules published" aana chahiye. Agar laal error aaye to us ka screenshot bhejein.`; testBusy = false; paint(); return; }
  // qadam 2: 4 jaanch darwaze (rules 2.40) — kaun sa khulta hai
  const probes = [[1, 'sirf data'], [2, 'id != _alias'], [3, 'keys hasOnly'], [4, 'chaabi == bankKey.k']], res = [];
  for (const [pn, lab] of probes) {
    try {
      const r = await fetch(restUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { p: { integerValue: String(pn) }, ...(pn === 4 ? { k: { stringValue: key } } : {}) } }) });
      let j = {}; try { j = JSON.parse(await r.text()); } catch {}
      res.push(`${r.ok ? '✅' : '❌'} ${pn}: ${lab}${r.ok ? '' : ' — ' + esc(String(j?.error?.message || r.status).slice(0, 80))}`);
    } catch (e) { res.push(`❌ ${pn}: ${lab} — ${esc(e?.message || e)}`); }
  }
  const probeHTML = `<div class="bk-probe">${res.join('<br>')}</div>`;
  try {
    const body = JSON.parse(smsBody(key).replace('{sms_message}', 'RABTA TEST — app se (is card ko ✕ kar dein)'));
    const r = await fetch(restUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
    const msg = String(j?.error?.message || t).slice(0, 300), st = j?.error?.status || '';
    if (r.ok) { testOk = true; testMsg = '✅ Rules nayi hain aur rabta theek — Firebase ne qabool kiya. Ab "❓ Samajh nahi" mein ek test card hoga, use ✕ kar dein. Agar MacroDroid se phir bhi nahi aata to masla sirf MacroDroid ki body mein hai ({sms_message} / quotes).'; }
    else if (/API key|referer|blocked|forbidden|SERVICE_BLOCKED/i.test(msg) || /API_KEY/i.test(JSON.stringify(j?.error?.details || ''))) { testOk = false; testMsg = `❌ Google ne API key rok di (${r.status}): ${esc(msg)}<br><b>Hal:</b> console.cloud.google.com → APIs & Services → Credentials → Browser key → "Application restrictions" = None (ya is website ko allow) → Save.`; }
    else if (r.status === 403 || /PERMISSION_DENIED/.test(st)) { testOk = false; testMsg = `❌ Firebase ne mana kiya (${r.status} ${esc(st)}): <i>${esc(msg)}</i><br><b>Hal:</b> Firestore → Rules mein <b>v2.42</b> publish karein (doosri line mein "BLUE KHATA v2.42" likha ho). Rules theek hon to chaabi ka masla hai — "🔁 nayi chaabi" bana kar MacroDroid body dobara paste karein.`; }
    else if (r.status === 400) { testOk = false; testMsg = `❌ Body samajh nahi aayi (400): ${esc(msg)}`; }
    else { testOk = false; testMsg = `❌ ${r.status} ${esc(st)}: ${esc(msg)}`; }
  } catch (e) { testOk = false; testMsg = '❌ Internet / Google tak rasai nahi: ' + esc(e?.message || e); }
  testMsg = probeHTML + testMsg;
  testBusy = false; paint();
}
async function copy(what) {
  const t = what === 'url' ? restUrl() : what === 'body' ? smsBody(key) : what === 'abody' ? smsBody(key).replace('"14250"', '"8287"') : what === 'nbody' ? notifBody(key) : gasCode(key);
  try { await navigator.clipboard.writeText(t); O.notice?.('📋 Copy ho gaya'); } catch { prompt('Copy karein:', t); }
}
document.addEventListener('click', e => {
  // v2.99.58: 📩 HBL chip / Settings -> POORI HBL screen (pehle chhota dialog khulta tha)
  if (e.target.closest?.('[data-hb="bank"],#bkOpenBtn')) { if (O.route) { try { $('dialog')?.close(); } catch {} O.route('hbl'); } else openBankInbox(); return; }
  if (e.target.closest?.('[data-bk-inbox]')) { openBankInbox(e.target.closest('[data-bk-inbox]').dataset.bkInbox || ''); return; }
  const t = e.target.closest?.('[data-bk-tab],[data-bk-ok],[data-bk-skip],[data-bk-chg],[data-bk-pick],[data-bk-copy],[data-bk-newkey],[data-bk-test],[data-bk-acmap],[data-bk-bill],[data-bk-billchg],[data-bk-cur],[data-bk-newacct],[data-bk-cmap],[data-bk-mto],[data-bk-mchg],[data-bk-lim]'); if (!t || !live()) return;
  const d = t.dataset;
  // v2.99.75: kai account / card
  if (d.bkCur) { curId = d.bkCur; try { localStorage.setItem('sam-bank-cur', curId); } catch {} if (onScreen()) renderHbl(); else paint(); return; }
  if (d.bkCmap) { const [c, pid] = d.bkCmap.split('|'); setAlias('@c:' + c, pid, `💳 Card …${c} = ${O.party?.(pid)?.name || ''} (yaad)`); return; }
  if (d.bkMto) { const i = d.bkMto.indexOf('|'), mk = d.bkMto.slice(0, i), v = d.bkMto.slice(i + 1); qOpen = ''; const nm = v.startsWith('party:') ? (O.party?.(v.slice(6))?.name || '') : v.slice(8); setAlias('@m:' + mk, v, `🧾 Is dukan ka kharcha ab khud: ${nm}`); return; }
  if (d.bkMchg) { qOpen = 'm:' + d.bkMchg; paint(); return; }
  if (d.bkNewacct) { newAcct(d.bkNewacct); return; }
  if (d.bkLim) { editLim(d.bkLim); return; }
  if (d.bkAcmap) { const [k, pid] = d.bkAcmap.split('|'); setAlias('@a:' + k, pid, `🏦 A/C …${k} = ${O.party?.(pid)?.name || ''} (yaad)`); return; }
  if (d.bkBill) { qOpen = ''; const nm = d.bkBill.startsWith('party:') ? (O.party?.(d.bkBill.slice(6))?.name || '') : d.bkBill.slice(8); setAlias('@bill', d.bkBill, `🧾 Har bill ab khud: ${nm}`); return; }
  if (d.bkBillchg) { qOpen = 'bill:' + d.bkBillchg; paint(); return; }
  if (d.bkTab) { tab = d.bkTab; paint(); if (tab === 'setup') loadKey(); return; }
  if (d.bkOk) { apply(d.bkOk); return; }
  if (d.bkSkip) { skip(d.bkSkip); return; }
  if (d.bkChg) { qOpen = d.bkChg; pick.delete(d.bkChg); paint(); return; }
  if (d.bkPick) { const [id, pid] = d.bkPick.split('|'); pick.set(id, pid); qOpen = ''; paint(); return; }
  if (d.bkCopy) { copy(d.bkCopy); return; }
  if (d.bkTest) { rabtaTest(); return; }
  if (d.bkNewkey) { if (key && !confirm('Nayi chaabi? Purani wali MacroDroid aur Gmail script kaam karna band kar denge — dono dobara lagani hongi.')) return;
    const a = new Uint8Array(16); crypto.getRandomValues(a); const k = [...a].map(b => b.toString(16).padStart(2, '0')).join('');
    O.cloud.setBankKey(k).then(() => { key = k; paint(); O.notice?.('🔑 Chaabi ban gayi'); }).catch(er => O.notice?.('⚠️ ' + (er?.message || er))); }
});
document.addEventListener('input', e => { if (e.target.matches?.('[data-bk-mq]')) { const id = e.target.dataset.bkMq, x = rows().all.find(z => z.d.id === id), b = $('bkM-' + id); if (b && x) b.innerHTML = mOptsHTML(e.target.value, mKey(x.r)); }
  if (e.target.matches?.('[data-bk-q]')) { qOpen = e.target.dataset.bkQ; search(e.target); }
  if (e.target.matches?.('[data-bk-bq]')) { const b = $('bkB-' + e.target.dataset.bkBq); if (b) b.innerHTML = billOptsHTML(e.target.value); } });
document.addEventListener('change', e => { if (e.target.matches?.('[data-bk-bank]') && e.target.value) { O.setBank?.(e.target.value); paint(); } });

// ================= 🏦 HBL SCREEN (v2.99.58) — poori screen, din-war, Aaye / Gaye, HBL ka baqaya =================
// Malik: "hbl ki tab khulna pr jaise baqi tabs hain … lena wala dena wala or current balance … jitna bi paisa aiya checkbox".
// HBL khata = O.bankId() wala khata (purana "Hbl loan 7999 account"). Baqaya = khate ka baqaya + closing se diya cash (Cash diya → HBL).
// ☐ = abhi khata mein nahi laga (SMS/email) · ☑ = lag gaya (khate ki asal entry). Tick = party ↔ HBL transfer (dono khaton mein).
// v2.99.58: tick = do entries (Wasooli + Akhrajat, dailyIncluded:true) — Daily Sale mein dikhti hain, galla barabar. Purane transfer waise hi.
let range = 'mahina', stab = 'sab', pcfg = null, pstop = null;
try { const v = JSON.parse(localStorage.getItem('sam-hbl-v') || '{}'); if (['aaj', '7', 'mahina', 'sab'].includes(v.range)) range = v.range; if (['sab', 'baqi'].includes(v.stab)) stab = v.stab; } catch {}
const keepV = () => { try { localStorage.setItem('sam-hbl-v', JSON.stringify({ range, stab })); } catch {} };
const sgn = e => (['credit', 'payment'].includes(e.kind) ? 1 : ['borrow', 'collection'].includes(e.kind) ? -1 : 0);
// HBL ki asal (lagi hui) harkat: khate ki entries + closing se diya / wapas liya cash
function hblMoves(H) {
  if (!H) return [];
  const out = [];
  for (const e of (O.entries ? O.entries() : [])) {
    if (!e || e.deleted || e.partyId !== H.id) continue;
    const sg = sgn(e); if (!sg) continue;
    const bd = e.bankSms ? (docs || []).find(d => d.id === e.bankSms) : null, bp = bd && bd.partyId && O.party ? O.party(bd.partyId) : null;
    const other = e.transferId ? (sg > 0 ? e.fromName : e.toName) : bp && bp.id !== H.id ? bp.name : bd ? parseBank(bd.text, bd.src, bd.subj).name : '';
    out.push({ id: e.id, date: e.date, at: Number(e.updatedAt || e.createdAt || 0), amt: e.amount, dir: sg > 0 ? 'in' : 'out', name: other || (O.label ? O.label(e) : e.kind), note: e.note || '', e });
  }
  try {
    for (const r of (O.cashRows ? O.cashRows() : [])) {
      if (r.from === 'shop' && r.to === H.id) out.push({ id: r.id, date: r.date, at: r.at || 0, amt: r.outgoing, dir: 'in', name: 'Cash diya (closing se)', note: (r.note || '') + ' · Closing Cash khata mein (baqaye mein nahi)', cash: true });
      else if (r.to === 'shop' && r.from === H.id) out.push({ id: r.id, date: r.date, at: r.at || 0, amt: r.incoming, dir: 'out', name: 'Cash wapas (HBL se dukan)', note: r.note || '', cash: true });
    }
  } catch {}
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.at - a.at);
}
// v2.99.58: baqaya BILKUL khate jaisa (malik: "balance ka farq") — closing se diya cash (Closing Cash khata) alag dikhaya, jora nahi
function hblBalance(H) { return H && O.balanceOf ? O.balanceOf(H.id) : 0; }
function hblCash(H) { let c = 0; if (!H) return 0; try { for (const r of (O.cashRows ? O.cashRows() : [])) { if (r.from === 'shop' && r.to === H.id) c += r.outgoing; else if (r.to === 'shop' && r.from === H.id) c -= r.incoming; } } catch {} return c; }
const fromDay = () => { const t = O.today ? O.today() : new Date().toISOString().slice(0, 10); if (range === 'sab') return ''; if (range === 'aaj') return t; const d = new Date(t + 'T12:00:00'); if (range === '7') d.setDate(d.getDate() - 6); else d.setDate(1); return d.toISOString().slice(0, 10); };
// ☐ card (abhi nahi laga) — chhota, tick ke saath
function tickCard(x, compact) {
  const r = x.r, id = esc(x.d.id), cash = r.kind === 'cash', s = cash ? null : sugOf(x), q = qOpen === x.d.id, b = busy.has(x.d.id);
  const can = !b && !!bankOf(r) && capOk('hbl.ok') && (x.self ? true : isKh(r) ? !!kTo(r) : (r.dir === 'in' || (cash ? false : !!s)));
  const who = !bankOf(r) ? `<small>🏦 A/C …${esc(acctK(r.acct) || holderAcct(r))} — kaun sa account? HBL screen par chunein</small>` : r.kind === 'bill' ? (billTo() ? `🧾 <b>${esc(billTo().name)}</b> <small>bank se · Daily mein nahi</small>` : '<small>🧾 kharcha khata HBL screen par chunein</small>') : r.dir === 'in' ? `🏦 <b>${esc(hbl() ? hbl().name : 'HBL')}</b> <small>Akhrajat</small>` : cash ? (r.dir === 'in' ? '🏦 Cash jama (branch) → "Cash diya" closing se' : '🏧 ATM — khata mein haath se')
    : s && !q ? `👤 <b>${esc(s.p.name)}</b> <small>${esc(s.why)}</small>${compact ? '' : ` <button type="button" class="bk-mini" data-bk-chg="${id}">✏️</button>`}`
    : compact ? '<small>❓ khata nahi mila — HBL screen par chunein</small>' : `<div class="bk-pick"><input type="search" placeholder="🔍 kis ka khata?" data-bk-q="${id}" autocomplete="off"><div class="bk-res" id="bkRes-${id}"></div></div>`;
  return `<div class="bk-row pend ${r.dir}"><label class="bk-tick${can ? '' : ' off'}"><input type="checkbox" data-bk-tick="${id}"${can ? '' : ' disabled'}${b ? ' checked' : ''}><span></span></label>
    <div class="bk-rw"><div class="bk-rl"><b>${esc(r.name || '—')}</b><b class="bk-amt ${r.dir === 'in' ? 'green' : 'red'}">${r.dir === 'in' ? '+' : '−'}${m(r.amt)}</b></div>
    <small>${srcIc(x.d.src)} ${esc([r.bank, r.via, r.time, r.txn ? 'TXN ' + r.txn : ''].filter(Boolean).join(' · '))}</small><div class="bk-rs">${b ? '⏳ lag raha hai…' : who}</div></div>
    <div class="bk-side">${noteBtn(r.txn, 'p:' + x.d.id)}${compact || !capOk('hbl.skip') ? '' : `<button type="button" class="bk-x" title="Chhoro" data-bk-skip="${id}">✕</button>`}</div></div>`;
}
function doneRow(v) {
  const txn = (String(v.note).match(/TXN (\S+)/) || [])[1] || '', src = v.e ? (docs || []).find(d => d.st === 'done' && d.entryId && (d.entryId === v.e.transferId || String(d.entryId).split('|').includes(v.e.id))) : null;
  const undo = src && O.owner && O.owner() ? `<button type="button" class="bk-x" title="Wapas lo" data-bk-undo="${esc(src.id)}">↩</button>` : '';
  return `<div class="bk-row done ${v.dir}"><label class="bk-tick on"><input type="checkbox" checked disabled><span></span></label><div class="bk-rw"><div class="bk-rl"><b>${esc(v.name)}</b><b class="bk-amt ${v.dir === 'in' ? 'green' : 'red'}">${v.dir === 'in' ? '+' : '−'}${m(v.amt)}</b></div><small>${esc(String(v.note).replace(/^HBL (aaye|gaye) · /, '').slice(0, 110))}</small></div><div class="bk-side">${v.cash ? '' : noteBtn(txn, 'v:' + v.id)}${undo}</div></div>`;
}
// ---------- 🔔 note + reminder (v2.99.58) — note ki pehchan us ke text mein "TXN <id>" ----------
const notesNow = () => (O.notes ? O.notes() : []).filter(n => n && !n.deleted);
const noteOf = txn => txn ? notesNow().find(n => String(n.text || '').includes('TXN ' + txn)) : null;
function noteBtn(txn, ref) { if (!O.noteForm) return ''; const n = noteOf(txn); return `<button type="button" class="bk-nb${n ? ' has' : ''}" data-bk-note="${esc(ref)}" title="Note / reminder">${n ? (n.done ? '🔕 note' : '🔔 note hai') : '🔔 Note'}</button>`; }
function openNote(ref) {
  const [t, id] = [ref.slice(0, 1), ref.slice(2)], H = hbl();
  let txt = '', pid = '', amt = 0, txn = '', day = O.today ? O.today() : '';
  if (t === 'p') { const x = rows().all.find(z => z.d.id === id); if (!x) return; const r = x.r, s = r.kind === 'cash' ? null : sugOf(x); txn = r.txn; amt = r.amt; pid = s ? s.p.id : '';
    txt = `HBL ${r.dir === 'in' ? 'aaye' : 'gaye'} ${m(r.amt)} · ${r.name}${r.bank ? ' (' + r.bank + ')' : ''}${r.day ? ' · ' + dShow(r) : ''}${r.txn ? ' · TXN ' + r.txn : ''}\n`; }
  else { const v = hblMoves(H).find(z => z.id === id); if (!v) return; txn = (String(v.note).match(/TXN (\S+)/) || [])[1] || ''; amt = v.amt; pid = v.e ? (v.dir === 'in' ? v.e.fromPartyId : v.e.toPartyId) : '';
    txt = `HBL ${v.dir === 'in' ? 'aaye' : 'gaye'} ${m(v.amt)} · ${v.name} · ${v.date}${txn ? ' · TXN ' + txn : ''}\n`; }
  const ex = noteOf(txn); if (ex) { O.noteForm(ex); return; }
  const p = pid && O.party ? O.party(pid) : null;
  O.noteForm(null, { text: txt, day, partyId: p ? p.id : '', partyName: p ? p.name : '', amount: amt });
}
// ---------- ↩ wapas lo (malik) — dono khaton se transfer hatao, card phir ☐ ----------
async function undo(docId) {
  const d = (docs || []).find(z => z.id === docId); if (!d || !d.entryId) return;
  const ids = String(d.entryId).split('|'), feeIds = ids.filter(i => i === 'bk' + docId + 'f' || i === 'bk' + docId + 'g'), main = ids.filter(i => !feeIds.includes(i)).join('|');   // v2.99.76: charges alag
  const e = (O.entries ? O.entries() : []).find(z => z && !z.deleted && z.transferId === main && z.transferRole === 'out') || (O.entries ? O.entries() : []).find(z => z && !z.deleted && z.transferId === main);
  const r = parseBank(d.text, d.src, d.subj);
  if (!confirm(`↩ Wapas lein?\n\n${m(r.amt)} — ${r.name}\nDono entries (khata + Daily) hat jayengi aur card dobara ☐ ban jayega.`)) return;
  busy.add(docId); paint();
  try {
    if (feeIds.length) await O.unpost(feeIds);
    if (!main) { /* sirf charges the */ }
    else if (main.includes('|') || /^bk.+a$/.test(main)) { await O.unpost(main.split('|')); }
    else if (e) { const ok = await O.pay({ id: e.transferId, rev: e.rev, remove: true, fromPartyId: e.fromPartyId, toPartyId: e.toPartyId, amount: e.amount, date: e.date, note: e.note }); if (ok === false) throw Error('Transfer nahi hata'); }
    await O.cloud.bankSmsSet(docId, { st: '', by: '', byName: '', doneAt: 0, partyId: '', entryId: '', kind: '' });
    autoFail.add(docId);   // v2.99.59: wapas liya = is phone par khud dobara nahi lagega
    O.notice?.('↩ Wapas — ab sahi account mein ☐ tick karein');
  } catch (er) { O.notice?.('⚠️ ' + (er?.message || er)); }
  finally { busy.delete(docId); paint(); onCount(rows().pend.length); }
}
// ---------- 🏦 HBL account chunna (malik) — sab phones par ----------
async function saveHbl(id) {
  if (!id || !(O.owner && O.owner())) return;
  alias = { ...alias, '@hbl': id }; O.bankShared?.(id); O.setBank?.(id);
  try { await O.cloud.bankAliasSet(alias); O.notice?.('🏦 ' + (O.party?.(id)?.name || '') + ' = HBL account (sab phones par)'); } catch (er) { O.notice?.('⚠️ ' + (er?.message || er)); }
  paint();
}
function pickAcct() {
  const all = (O.parties ? O.parties() : []).filter(p => p && !p.deleted), cur = hbl();
  const top = all.filter(p => p.bank || /hbl|bank|meezan|alfalah|ubl|mcb/i.test(String(p.name || '')));
  const dl = $('dialog'); dl.classList.remove('full-dialog');
  $('dialogTitle').textContent = '🏦 HBL account chunein';
  $('dialogBody').innerHTML = `<div class="bk-acctpick"><p class="bk-hint">Jo khata chunein ge us mein HBL ke sab paise lagenge — sab phones par. Abhi: <b>${esc(cur ? cur.name : '—')}</b></p><input type="search" id="bkAcQ" placeholder="🔍 naam likhein… (hbl)" autocomplete="off"><div class="bk-res" id="bkAcL"></div></div>`;
  const paintL = () => { const q = ($('bkAcQ')?.value || '').trim(); const l = q.length >= 2 ? (O.smartSearch ? O.smartSearch(all, q, 12) : all.filter(p => String(p.name).toLowerCase().includes(q.toLowerCase())).slice(0, 12)) : (top.length ? top : all.slice(0, 12));
    $('bkAcL').innerHTML = l.map(p => `<button type="button" data-bk-acpick="${esc(p.id)}">${cur && cur.id === p.id ? '✓ ' : '🏦 '}${esc(p.name)}${p.bank ? ' <small>bank</small>' : ''}</button>`).join('') || '<small>Nahi mila</small>'; };
  paintL(); $('bkAcQ').oninput = paintL;
  if (!dl.open) dl.showModal();
}
window.addEventListener?.('sam-bank-pick', e => { if (e.detail && O.owner && O.owner() && alias['@hbl'] !== e.detail) saveHbl(e.detail); });
window.addEventListener?.('sam-notes', () => { if (onScreen()) renderHbl(); });
const dHead = d => { if (!d) return 'Tareekh nahi'; const t = O.today ? O.today() : ''; if (d === t) return 'Aaj · ' + d; const y = new Date(t + 'T12:00:00'); y.setDate(y.getDate() - 1); if (d === y.toISOString().slice(0, 10)) return 'Kal · ' + d; return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); };
// ================= v2.99.58 💎 PREMIUM HBL screen (sirf yahan — Daily column purane tickCard/doneRow se) =================
const initials = n => String(n || '?').replace(/[^A-Za-z0-9؀-ۿ ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
const nameFromNote = n => (String(n || '').match(/^(?:HBL|Alfalah|Card) (?:aaye|gaye) · ([^·(]+)/) || [])[1]?.trim() || '';
const qOf = () => String(($('search') && $('search').value) || '').trim().toLowerCase();
function hitQ(q, parts, amt) { if (!q) return true; const dig = q.replace(/[^\d]/g, ''); if (dig && dig.length >= 2 && String(Math.round(amt / 100)).includes(dig)) return true; return parts.join(' ').toLowerCase().includes(q); }
function pPend(x) {
  const r = x.r, id = esc(x.d.id), cash = r.kind === 'cash', s = cash ? null : sugOf(x), q = qOpen === x.d.id, b = busy.has(x.d.id), t = O.today ? O.today() : '';
  const old = !!(r.day && r.day < t), inn = r.dir === 'in', bill = r.kind === 'bill', B = bankOf(r), kh = isKh(r);
  const can = !b && !!B && capOk('hbl.ok') && (x.self ? true : kh ? !!kTo(r) : (inn || (cash ? false : !!s)));
  const meta = [r.bank, r.via, r.time].filter(Boolean).map(esc).join(' · ');
  const who = acctAskHTML(x) + (x.self ? `<div class="bkp-who self"><span class="bkp-pk">⇄ Apna transfer</span><b>${esc(B ? B.name : '')} → ${esc(bankOf(x.self.r)?.name || '')}</b><small>doosri taraf ka SMS bhi mil gaya (${esc(x.self.r.txn || dShow(x.self.r))}) — ek hi transfer</small></div>`
    : bill ? billWhoHTML(x) : kh ? kharchWhoHTML(x) : inn ? `<div class="bkp-who"><span class="bkp-pk">🏦 Khata</span><b>${esc(B ? B.name : (hbl() ? hbl().name : 'HBL'))}</b><small>Daily: Akhrajat</small></div>`
    : cash ? `<div class="bkp-who cash">🏦 ${r.dir === 'in' ? 'Branch mein cash jama → "Cash diya" (closing se)' : 'ATM se nikala — khata mein haath se'}</div>`
    : s && !q ? `<div class="bkp-who"><span class="bkp-pk">${r.dir === 'out' ? '💸 Diya' : '👤 Khata'}</span><b>${esc(s.p.name)}</b><small>${esc(s.why)}</small><button type="button" class="bkp-ic" data-bk-chg="${id}" title="Badlo">✏️</button></div>`
    : `<div class="bkp-ask">${r.dir === 'out' ? '💸 <b>Kis ko diya?</b>' : '👤 <b>Kis ka paisa?</b>'}<div class="bk-pick"><input type="search" placeholder="🔍 khata ka naam…" data-bk-q="${id}" autocomplete="off"><div class="bk-res" id="bkRes-${id}"></div></div></div>`);
  return `<article class="bkp-row pend ${r.dir}${old ? ' old' : ''}">
    <div class="bkp-av ${r.dir}">${r.dir === 'in' ? '↓' : '↑'}<i>${esc(initials(r.name))}</i></div>
    <div class="bkp-mid"><div class="bkp-top"><b class="bkp-nm">${esc(r.name || '—')}</b><span class="bkp-badge ${old ? 'old' : 'new'}">${old ? '📅 ' + esc(dShow(r).split(' · ')[0]) + ' · purana' : 'NAYA'}</span></div>
      <div class="bkp-meta">${srcIc(x.d.src)} ${meta}${r.txn ? ` <span class="bkp-txn">${esc(r.txn)}</span>` : ''}</div>${who}
      ${old ? `<div class="bkp-q">📅 Yeh <b>${esc(dShow(r).split(' · ')[0])}</b> ka purana len-den hai — khate mein lagana hai?</div>` : ''}
      <div class="bkp-acts"><button type="button" class="bkp-go" data-bk-ok="${id}"${can ? '' : ' disabled'}>${b ? '⏳ Lag raha hai…' : old ? '✓ Haan, lagao' : r.dir === 'out' ? '✓ Khate mein lagao' : '✓ Lagao'}</button>${capOk('hbl.skip') ? `<button type="button" class="bkp-no" data-bk-skip="${id}"${b ? ' disabled' : ''}>${old ? '✕ Nahi' : '✕'}</button>` : ''}${noteBtn(r.txn, 'p:' + x.d.id).replace('bk-nb', 'bkp-ic bk-nb')}</div></div>
    <div class="bkp-amt ${r.dir}">${r.dir === 'in' ? '+' : '−'}${m(r.amt)}<small>⏳ Baqi</small></div></article>`;
}
function pDone(v) {
  const txn = (String(v.note).match(/TXN (\S+)/) || [])[1] || '', src = v.e ? (docs || []).find(d => d.st === 'done' && d.entryId && (d.entryId === v.e.transferId || String(d.entryId).split('|').includes(v.e.id))) : null;
  const name = v.e && !v.e.transferId && !(v.e.bankSms) ? (nameFromNote(v.note) || v.name) : v.name;
  const r = src ? parseBank(src.text, src.src, src.subj) : null, meta = r ? [r.bank, r.via, r.time].filter(Boolean).join(' · ') : String(v.note).replace(/^HBL (aaye|gaye) · [^·]*· ?/, '').replace(/· TXN \S+/, '').slice(0, 70);
  const undo = src && O.owner && O.owner() ? `<button type="button" class="bkp-ic" title="Wapas lo" data-bk-undo="${esc(src.id)}">↩</button>` : '';
  const kindTag = v.cash ? 'Closing cash' : v.e && v.e.posNo ? 'Bill · kharcha' : v.e && v.e.transferId ? 'Khate mein' : 'Daily + khata';
  return `<article class="bkp-row done ${v.dir}"><div class="bkp-av ${v.dir}">${v.dir === 'in' ? '↓' : '↑'}<i>${esc(initials(name))}</i></div>
    <div class="bkp-mid"><div class="bkp-top"><b class="bkp-nm">${esc(name)}</b></div><div class="bkp-meta">${esc(meta)}${txn ? ` <span class="bkp-txn">${esc(txn)}</span>` : ''}</div>
      ${v.cash ? '' : `<div class="bkp-acts sm">${noteBtn(txn, 'v:' + v.id).replace('bk-nb', 'bkp-ic bk-nb')}${undo}</div>`}${v.e && O.printChip ? `<div class="bkp-prn">${O.printChip(v.e)}</div>` : ''}</div>
    <div class="bkp-amt ${v.dir}">${v.dir === 'in' ? '+' : '−'}${m(v.amt)}<small class="ok">✓ ${kindTag}</small></div></article>`;
}
function spark(H) {
  const t = O.today ? O.today() : '', mv = hblMoves(H).filter(v => !v.cash), days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); const ms = mv.filter(v => v.date === k); days.push({ k, i: ms.filter(v => v.dir === 'in').reduce((n, v) => n + v.amt, 0), o: ms.filter(v => v.dir === 'out').reduce((n, v) => n + v.amt, 0) }); }
  const mx = Math.max(1, ...days.map(d => Math.max(d.i, d.o)));
  return `<div class="bkp-spark" title="Pichhle 7 din">${days.map(d => `<span><i class="in" style="height:${Math.round(d.i / mx * 100)}%"></i><i class="out" style="height:${Math.round(d.o / mx * 100)}%"></i><em>${['At', 'Pi', 'Ma', 'Bu', 'Ju', 'Ju', 'Ha'][new Date(d.k + 'T12:00:00').getDay()]}</em></span>`).join('')}</div>`;
}
// ================= v2.99.75 🏦 KAI ACCOUNT — chips: HBL · Alfalah NT · Alfalah Samiullah · 💳 4917 · 💳 0605 =================
let curId = (() => { try { return localStorage.getItem('sam-bank-cur') || ''; } catch { return ''; } })();
function curAcct() { const ids = capOk('hbl.alf') ? ownIds() : []; if (curId && ids.includes(curId) && O.party) { const p = O.party(curId); if (p) return p; } return hbl(); }
const pendFor = (x, H) => { const B = bankOf(x.r); if (!B) return true; if (!H) return false; return B.id === H.id || (x.self && bankOf(x.self.r)?.id === H.id); };
const fmtR = v => (Math.round(v / 100)).toLocaleString('en-US');
function acctChips(H, R) {
  if (!capOk('hbl.alf')) return '';
  const ids = ownIds(); if (ids.length < 2) return '';
  return `<div class="bkp-accts">${ids.map(id => { const p = O.party(id), c = cardOf(id), n = R.pend.filter(x => bankOf(x.r)?.id === id).length;
    return `<button type="button" class="${H && H.id === id ? 'on' : ''}" data-bk-cur="${esc(id)}">${c ? '💳' : '🏦'} ${esc(c ? 'Card ' + c : p.name)}${n ? ` <b>${n}</b>` : ''}</button>`; }).join('')}</div>`;
}
// 💳 card ka hisaab: limit · istemal (khate ka dena) · bachi limit · SMS ki Avl Limit · statement (Amt Due / Min / Due date)
function cardBox(H, R) {
  const c = cardOf(H && H.id); if (!c) return '';
  const lim = Number(alias['@lim:' + c]) || (CARD_INFO[c] ? CARD_INFO[c].lim : 0), bal = hblBalance(H), owe = bal < 0 ? -bal : 0, left = lim ? lim * 100 - owe : 0;
  const last = R.all.filter(x => x.r.ok && x.r.kind === 'card' && x.r.card === c && x.r.avl).sort((a, b) => ((b.r.day || '') + (b.r.time || '')).localeCompare((a.r.day || '') + (a.r.time || '')))[0];
  const dd = Number(alias['@dd:' + c]) || (CARD_INFO[c] ? CARD_INFO[c].dd : 0);
  const st = R.all.filter(x => x.r.ok && x.r.kind === 'stmt' && (!dd || x.r.dueDay === dd)).sort((a, b) => String(b.r.due).localeCompare(String(a.r.due)))[0];
  const t = O.today ? O.today() : '', dLeft = st ? Math.round((Date.parse(st.r.due + 'T12:00:00') - Date.parse(t + 'T12:00:00')) / 864e5) : null;
  const pc = lim ? Math.min(100, Math.round(owe / (lim * 100) * 100)) : 0;
  return `<div class="bkp-card"><div class="bkp-cl"><span>Limit</span><b>Rs ${fmtR(lim * 100)}</b></div><i class="bkp-cbar"><u style="width:${pc}%"></u></i>
    <div class="bkp-crow"><div><small>Istemal (dena)</small><b class="red">Rs ${fmtR(owe)}</b></div><div><small>Bachi limit (app)</small><b class="green">Rs ${fmtR(Math.max(0, left))}</b></div>${last ? `<div><small>SMS Avl Limit · ${esc(dShow(last.r).split(' · ')[0])}</small><b>Rs ${fmtR(last.r.avl)}</b>${Math.abs(last.r.avl - left) > 100000 ? '<em class="bad">⚠ app se farq ' + fmtR(Math.abs(last.r.avl - left)) + '</em>' : ''}</div>` : ''}</div>
    ${st ? `<div class="bkp-stmt${dLeft != null && dLeft <= 3 ? ' due' : ''}">📄 <b>Statement:</b> Amt Due Rs ${fmtR(st.r.amt)} · Min Rs ${fmtR(st.r.minPmt || 0)} · <b>Due ${esc(st.r.due.split('-').reverse().join('/'))}</b>${dLeft != null ? (dLeft < 0 ? ` · <em>${-dLeft} din guzar gaye!</em>` : dLeft === 0 ? ' · <em>AAJ aakhri din!</em>' : ` · ${dLeft} din baqi`) : ''}</div>` : `<div class="bkp-stmt">📄 Statement ka SMS abhi nahi aaya${dd ? ' (due date har mahine ' + dd + ' tareekh)' : ''}</div>`}
    ${O.owner && O.owner() ? `<button type="button" class="bkp-chip" data-bk-lim="${esc(c)}">✏️ Limit / due tareekh</button>` : ''}</div>`;
}
export function renderHbl() {
  if (!$('list')) return;
  if (!canUse()) { $('summary').innerHTML = ''; $('list').innerHTML = '<div class="bk-screen"><p class="bk-empty">🏦 HBL screen sirf malik / Full mulazim</p></div>'; $('actions').innerHTML = ''; return; }
  bankWatch();
  const H = curAcct(), R = rows(), from = fromDay(), q = qOf(), isCard = !!cardOf(H && H.id), isHbl = !!(H && hbl() && H.id === hbl().id);
  const mv = hblMoves(H).filter(v => (!from || v.date >= from) && hitQ(q, [v.name, v.note, nameFromNote(v.note)], v.amt));
  const pendAll = R.pend.filter(x => pendFor(x, H) && hitQ(q, [x.r.name, x.r.bank, x.r.txn, x.r.via], x.r.amt)), pend = pendAll.filter(x => !from || !x.r.day || x.r.day >= from || stab === 'baqi');
  const inT = mv.filter(v => v.dir === 'in').reduce((n, v) => n + v.amt, 0), outT = mv.filter(v => v.dir === 'out').reduce((n, v) => n + v.amt, 0), bal = hblBalance(H);
  const nIn = mv.filter(v => v.dir === 'in').length, nOut = mv.filter(v => v.dir === 'out').length, own = O.owner && O.owner();
  const banks = (O.parties ? O.parties() : []).filter(p => p.bank), cashA = hblCash(H);
  $('summary').innerHTML = `${acctChips(H, R)}<div class="bkp-hero${isCard ? ' card' : ''}"><div class="bkp-hhead"><span class="bkp-bank">${isCard ? '💳' : '🏦'}</span><div><small>${isCard ? 'CREDIT CARD' : 'BANK ACCOUNT'}</small><b>${esc(H ? H.name : 'HBL khata nahi chuna')}</b></div>${own && isHbl ? '<button type="button" class="bkp-chip" data-hbl-acct="1">✏️ Badlo</button>' : ''}</div>
    <div class="bkp-bal"><small>${isCard ? 'Card ka udhaar' : 'Abhi ka baqaya'}</small><strong>${m(Math.abs(bal))}</strong><span class="bkp-st">${bal > 0 ? 'Lene hain' : bal < 0 ? 'Dene hain' : 'Barabar'} · khate jaisa</span></div>
    ${cardBox(H, R)}
    ${H ? spark(H) : ''}
    <div class="bkp-stats"><div class="in"><span>↓</span><div><small>Aaye</small><b>${m(inT)}</b><em>${nIn} len-den</em></div></div><div class="out"><span>↑</span><div><small>Gaye</small><b>${m(outT)}</b><em>${nOut} len-den</em></div></div></div>
    ${cashA && isHbl ? `<div class="bkp-cash">💵 Closing se HBL ko diya cash ${m(cashA)} — Closing Cash khata mein (baqaye mein nahi)</div>` : ''}</div>`;
  const seg = (a, v, cur, l) => `<button type="button" class="${cur === v ? 'on' : ''}" data-${a}="${v}">${l}</button>`;
  let list = '';
  if (stab === 'baqi') list = pend.map(pPend).join('') || `<div class="bkp-empty">🎉<b>${q ? 'Is search mein kuch baqi nahi' : 'Sab lag gaye'}</b><small>Naya SMS / email aate hi yahan aayega</small></div>`;
  else {
    const days = new Map(); const add = (d, k, v) => { if (!days.has(d)) days.set(d, { p: [], v: [] }); days.get(d)[k].push(v); };
    for (const x of pend) add(x.r.day || '', 'p', x); for (const v of mv) add(v.date || '', 'v', v);
    list = [...days.keys()].sort((a, b) => b.localeCompare(a)).map(d => { const g = days.get(d), di = g.v.filter(v => v.dir === 'in').reduce((n, v) => n + v.amt, 0), dO = g.v.filter(v => v.dir === 'out').reduce((n, v) => n + v.amt, 0);
      return `<section class="bkp-day"><header class="bkp-dh"><b>${esc(dHead(d))}</b><span>${di ? `<i class="in">+${m(di)}</i>` : ''}${dO ? `<i class="out">−${m(dO)}</i>` : ''}${g.p.length ? `<i class="pd">⏳ ${g.p.length}</i>` : ''}</span></header>${g.p.map(pPend).join('')}${g.v.map(pDone).join('')}</section>`; }).join('') || `<div class="bkp-empty">🔍<b>${q ? '"' + esc(q) + '" — kuch nahi mila' : 'Is muddat mein HBL mein kuch nahi'}</b></div>`;
  }
  const qv = qOpen && $('list').querySelector(`[data-bk-q="${CSS.escape(qOpen)}"]`)?.value;
  $('list').innerHTML = `<div class="bk-screen bkp">${H ? '' : `<div class="bk-warn">⚠️ HBL khata chunein: ${banks.length ? `<select data-bk-bank><option value="">— chunein —</option>${banks.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>` : 'pehle bank ka khata banayein'}</div>`}
    <div class="bkp-seg">${seg('hbl-tab', 'sab', stab, '📅 Din-war')}${seg('hbl-tab', 'baqi', stab, `⏳ Baqi${R.pend.length ? ' <b>' + R.pend.length + '</b>' : ''}`)}</div>
    ${stab === 'baqi' ? '' : `<div class="bkp-seg sm">${[['aaj', 'Aaj'], ['7', '7 din'], ['mahina', 'Mahina'], ['sab', 'Sab']].map(([v, l]) => seg('hbl-range', v, range, l)).join('')}</div>`}
    <details class="bkp-info"><summary>ⓘ Kaise kaam karta hai</summary><p>🟢 <b>Aaye</b>: koi khata nahi poochha jata — seedha HBL Noor Traders mein (Daily: Akhrajat), Server PC khud lagata hai aur HBL parchi foran nikalti hai. 🔴 <b>Gaye</b>: "kis ko diya?" — seedha us ke khate mein (Daily mein nahi); yaad naam khud lagte hain. 🧾 <b>Bill</b> (GEPCO waghera HBL Mobile se): HBL se minus + aap ka chuna kharcha khata (Daily / POS mein nahi). 🏦 SMS / email mein doosra account number (maslan loan) ho to pehle poochta hai. 📅 Purani tareekh wale pehle poochte hain. Upar search mein naam / raqam / TXN likhein.</p></details>
    ${list}</div>`;
  if (qOpen) { const i = $('list').querySelector(`[data-bk-q="${CSS.escape(qOpen)}"]`); if (i) { i.value = qv || ''; i.focus(); search(i); } }
  if (own && !pstop && O.cloud?.listenPrintConfig) pstop = O.cloud.listenPrintConfig(c => { pcfg = c || {}; if (onScreen()) renderHbl(); if (prnOpen()) $('dialogBody').innerHTML = prnHTML(); });
  const pOn = !pcfg || pcfg.bankPost !== false;
  $('actions').innerHTML = `${own ? `<button type="button" data-hbl-print="${pOn ? '0' : '1'}" title="Aaye paise Server PC khud HBL khate mein lagaye + parchi">${pOn ? '🤖 Auto ON' : '🤖 Auto BAND'}</button>` : ''}${H ? `<button type="button" data-hbl-khata="1">📒 ${isHbl ? 'HBL' : isCard ? 'Card' : 'Bank'} khata</button>` : ''}${own ? '<button type="button" data-prn-open="1">🖨 Printer</button><button type="button" data-bk-inbox="setup">⚙️ Setup</button>' : ''}${capOk('hbl.pdf') ? '<button type="button" data-hbl-pdf="1">📄 PDF · bhejo</button>' : ''}`;
}
// ================= v2.99.58 🖨 PRINTER KI HAALAT (TM-T88IV) — printConfig.voucherLog / vLast / vErr / vAlive (pos-khata-sync likhta hai) =================
const prnOpen = () => !!document.querySelector('#dialogBody .prn-root');
function prnHTML() {
  const c = pcfg || {}, L = (Array.isArray(c.voucherLog) ? c.voucherLog : []).slice().reverse(), now = Date.now(), alive = Number(c.vAlive) || 0, age = alive ? Math.round((now - alive) / 60000) : null;
  const t = ms => { const d = new Date(ms); return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }); };
  const today = O.today ? O.today() : '', isToday = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') === today; };
  const tOk = L.filter(x => x.ok && isToday(x.at)).length, tBad = L.filter(x => !x.ok && isToday(x.at)).length, live = age !== null && age <= 10;
  return `<div class="prn-root"><div class="prn-head ${live ? (c.vErr ? 'warn' : 'ok') : 'bad'}"><span class="prn-dot"></span><div><b>${live ? (c.vErr ? '⚠️ Aakhri parchi mein masla' : '✓ Server PC aur printer chal rahe hain') : age === null ? '❓ Abhi koi khabar nahi aayi' : `🔴 Server PC ${age} min se khamosh`}</b>
    <small>${c.vLast ? 'Aakhri parchi: ' + t(c.vLast) : 'Abhi koi parchi nahi'}${age !== null ? ' · aakhri dhadkan ' + (age < 1 ? 'abhi' : age + ' min pehle') : ''}</small>${c.vErr ? `<small class="prn-err">${esc(c.vErr)}</small>` : ''}</div></div>
    <div class="prn-stats"><div><b>${tOk}</b><small>Aaj chhapi</small></div><div class="${tBad ? 'bad' : ''}"><b>${tBad}</b><small>Aaj nahi chhapi</small></div><div><b>${L.length}</b><small>List mein</small></div></div>
    <div class="prn-list">${L.map(x => `<div class="prn-it ${x.ok ? 'ok' : 'bad'}"><span>${x.ok ? '✓' : '✕'}</span><div><b>${esc(x.name || x.code)}${x.bank ? ' <i>HBL</i>' : ''}${x.again ? ' <i>dobara</i>' : ''}</b><small>${esc(x.code)} · ${esc(t(x.at))}${x.ok ? '' : ' · ' + esc(x.err || '')}</small></div><em>Rs ${Number(x.amt || 0).toLocaleString('en-US')}</em>${x.code ? `<button type="button" class="prn-again" data-prn-again="${esc(x.code)}" data-prn-name="${esc(x.name || '')}">🖨</button>` : ''}</div>`).join('') || '<p class="bk-empty">Abhi list khali hai — agli parchi ke baad yahan aayegi</p>'}</div>
    <p class="bk-note">Printer band / kaghaz khatam ho to theek kar ke 🖨 dabayein — wohi parchi dobara nikal aayegi.</p></div>`;
}
export function openPrinter() {
  if (!(O.owner && O.owner())) { O.notice?.('Printer ki haalat sirf malik'); return; }
  if (!pstop && O.cloud?.listenPrintConfig) pstop = O.cloud.listenPrintConfig(c => { pcfg = c || {}; if (onScreen()) renderHbl(); if (prnOpen()) $('dialogBody').innerHTML = prnHTML(); });
  const dl = $('dialog'); dl.classList.remove('search-dialog'); dl.classList.add('full-dialog');
  $('dialogTitle').textContent = '🖨 Printer ki haalat · TM-T88IV';
  $('dialogBody').innerHTML = prnHTML();
  if (!dl.open) dl.showModal();
}
setInterval(() => { try { if (prnOpen()) $('dialogBody').innerHTML = prnHTML(); } catch {} }, 60000);
document.addEventListener('click', e => { if (e.target.closest?.('[data-prn-open],#prnStatusBtn')) openPrinter(); });
// Daily screen ka hissa — us din HBL mein kya aaya / gaya (cash hisaab se alag)
export function hblDay(date) {
  if (!canUse()) return '';
  bankWatch();
  const H = hbl(); if (!H) return '';
  const t = O.today ? O.today() : '', mv = hblMoves(H).filter(v => v.date === date && !v.cash), pend = rows().pend.filter(x => x.r.day === date || (date === t && (!x.r.day || x.r.day < t)));   // aaj: purane ☐ bhi
  if (!mv.length && !pend.length) return `<section class="bk-day empty"><div class="bk-dh"><b>🏦 ${esc(H.name)}</b><button type="button" class="bk-mini" data-hbl-open="1">Poori HBL screen ›</button></div><small>Is din HBL mein kuch nahi aaya / gaya · baqaya ${m(hblBalance(H))}</small></section>`;
  const di = mv.filter(v => v.dir === 'in').reduce((n, v) => n + v.amt, 0), dO = mv.filter(v => v.dir === 'out').reduce((n, v) => n + v.amt, 0);
  return `<section class="bk-day"><div class="bk-dh"><b>🏦 ${esc(H.name)}</b><button type="button" class="bk-mini" data-hbl-open="1">Poori HBL screen ›</button></div>
    <div class="bk-dsum"><span>🟢 Aaye <b class="green">${m(di)}</b></span><span>🔴 Gaye <b class="red">${m(dO)}</b></span><span>Baqaya <b>${m(hblBalance(H))}</b></span></div>
    ${pend.map(x => tickCard(x, false)).join('')}${mv.map(doneRow).join('')}<small class="bk-note">Wasooli + Akhrajat dono taraf barabar — galle ka farq nahi badalta.</small></section>`;
}
function hblPdf() {
  const H = curAcct(), from = fromDay(), mv = hblMoves(H).filter(v => !from || v.date >= from).slice().reverse();
  const inT = mv.filter(v => v.dir === 'in').reduce((n, v) => n + v.amt, 0), outT = mv.filter(v => v.dir === 'out').reduce((n, v) => n + v.amt, 0);
  return `<h1>NOOR TRADERS</h1><h2>🏦 ${esc(H ? H.name : 'HBL')} — ${esc({ aaj: 'Aaj', 7: '7 din', mahina: 'Is mahine', sab: 'Sab' }[range])}${from ? ' (' + esc(from) + ' se)' : ''}</h2>
  <table class="iv-tbl"><thead><tr><th>Tareekh</th><th>Kis se / kis ko</th><th>Tafseel</th><th>Aaye</th><th>Gaye</th></tr></thead><tbody>${mv.map(v => `<tr><td>${esc(v.date)}</td><td>${esc(v.name)}</td><td>${esc(String(v.note).replace(/^HBL (aaye|gaye) · /, '').slice(0, 90))}</td><td class="iv-n">${v.dir === 'in' ? m(v.amt) : ''}</td><td class="iv-n">${v.dir === 'out' ? m(v.amt) : ''}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="3"><b>Kul</b></td><td class="iv-n"><b>${m(inT)}</b></td><td class="iv-n"><b>${m(outT)}</b></td></tr><tr><td colspan="3"><b>Abhi ka baqaya</b></td><td colspan="2" class="iv-n"><b>${m(hblBalance(H))}</b></td></tr></tfoot></table>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-hbl-tab],[data-hbl-range],[data-hbl-khata],[data-hbl-pdf],[data-hbl-open],[data-hbl-print],[data-hbl-acct],[data-bk-acpick],[data-bk-note],[data-bk-undo]'); if (!t) return;
  const d = t.dataset;
  if (d.hblAcct) { pickAcct(); return; }
  if (d.bkAcpick) { try { $('dialog').close(); } catch {} saveHbl(d.bkAcpick); return; }
  if (d.bkNote) { openNote(d.bkNote); return; }
  if (d.bkUndo) { undo(d.bkUndo); return; }
  if (d.hblPrint) { const on = d.hblPrint === '1'; O.cloud?.setPrintConfig?.({ bankPost: on }).then(() => O.notice?.(on ? '🤖 Aaye paise khud HBL khate mein + parchi — ON' : '🤖 Auto BAND — aaye paise ☐ par haath se')).catch(er => O.notice?.('⚠️ ' + (er?.message || er))); return; }
  if (d.hblOpen) { O.route?.('hbl'); return; }
  if (d.hblKhata) { const H = curAcct(); if (H) O.route?.('khata', H.id); return; }
  if (d.hblPdf) { O.pdf?.(hblPdf(), 'HBL-' + range); return; }
  if (d.hblTab) stab = d.hblTab; else if (d.hblRange) range = d.hblRange;
  keepV(); renderHbl();
});
// Daily Sale ka "🏦 HBL" button: HBL column tak le jao (v2.99.58)
document.addEventListener('click', e => { if (!e.target.closest?.('[data-hbl-col]')) return; const c = document.querySelector('.hbl-col'); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1500); } else O.route?.('hbl'); });
document.addEventListener('change', e => { const t = e.target; if (!t.matches?.('[data-bk-tick]')) return; if (!t.checked) { t.checked = true; return; }
  const x = rows().pend.find(z => z.d.id === t.dataset.bkTick); if (!x) return;
  if (x.r.day && x.r.day < (O.today ? O.today() : '') && !confirm(`📅 Yeh ${x.r.day} ka purana len-den hai (${m(x.r.amt)} · ${x.r.name}).\nKhate mein lagana hai?`)) { t.checked = false; return; }
  const s = x.r.kind === 'cash' ? null : sugOf(x), H = hbl();
  apply(x.d.id); });
export const _bankTest = { prnHTML, setPcfg: c => { pcfg = c; }, fixOnce, bankCounts, autoRun, undo, openNote, saveHbl, pickAcct, renderHbl, hblDay, hblMoves, hblBalance, hblPdf, setRange: v => { range = v; }, setStab: v => { stab = v; }, rows, html, apply, gasCode, smsBody, setDocs: d => { docs = d; alias = (d.find(x => x.id === '_alias') || {}).m || {}; docs = d.filter(x => x.id !== '_alias'); }, setKey: k => { key = k; }, setTab: t => { tab = t; } };
