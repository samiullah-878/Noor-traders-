// bank-inbox.js — v2.99.33 (2026-10-12): 📩 HBL INBOX — HBL ke SMS (paise AAYE, phone par MacroDroid) aur email (paise GAYE, Gmail Apps Script)
// Firestore businesses/noor-traders/bankSms (rules 2.38) mein aate hain. Yahan: parhna (bank-sms.js), khata ka andaza (yaad + naam),
// ✓ par HBL khate mein entry: aaye = khata -> HBL transfer · gaye = HBL -> khata transfer · Cash Deposit = closing ka cash HBL ko ("Cash diya").
// Bina ✓ kuch nahi lagta. Ek len-den ek hi dafa (TXN ID). Malik: Setup (chaabi, MacroDroid ki body, Gmail ka script).
import { parseBank, bankKeyOf, guessParty, aliasKey } from './bank-sms.js?v=2.99.34';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
let O = {}, docs = null, stop = null, alias = {}, tab = 'baqi', pick = new Map(), qOpen = '', busy = new Set(), key = null, onCount = () => {};
export function bankSetup(o) { O = o || {}; onCount = o.onCount || onCount; }
const m = v => (O.money ? O.money(v) : 'Rs ' + (v / 100).toLocaleString('en-PK'));
const who = () => (O.who ? O.who() : {}) || {};
const canUse = () => (O.canUse ? O.canUse() : false);
export function bankWatch() {
  if (stop || !O.cloud?.listenBankSms || !canUse()) return;
  stop = O.cloud.listenBankSms(list => {
    if (!list) { docs = docs || []; return; }
    alias = (list.find(d => d.id === '_alias') || {}).m || {};
    docs = list.filter(d => d.id !== '_alias');
    onCount(rows().pend.length); if (isOpen()) paint();
  });
}
const isOpen = () => !!document.querySelector('#dialogBody .bk-root');
// sab docs -> parsed + dubara wale alag
function rows() {
  const all = (docs || []).map(d => { const r = parseBank(d.text, d.src, d.subj); return { d, r, k: r.ok ? bankKeyOf(r) : 'X' + d.id }; });
  all.sort((a, b) => (b.r.day + b.r.time).localeCompare(a.r.day + a.r.time) || String(b.d.at || '').localeCompare(String(a.d.at || '')));
  const seen = new Map(); for (const x of all) if (x.d.st === 'done' || x.d.st === 'skip') seen.set(x.k, x);
  const pend = [], done = [], bad = [], dup = [];
  for (const x of all) {
    if (x.d.st === 'done' || x.d.st === 'skip') { done.push(x); continue; }
    if (!x.r.ok) { bad.push(x); continue; }
    if (seen.has(x.k)) { dup.push(x); continue; }
    seen.set(x.k, x); pend.push(x);
  }
  return { pend, done, bad, dup, all };
}
export const bankCount = () => (docs ? rows().pend.length : 0);
const hbl = () => { const id = O.bankId ? O.bankId() : ''; return id && O.party ? O.party(id) : null; };
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
  const okDis = busy.has(x.d.id) || (!cash && !s) || (cash && r.dir !== 'in');
  return `<article class="bk-card ${r.dir}">
    <div class="bk-top"><span class="bk-dir">${r.dir === 'in' ? '🟢 Aaye' : '🔴 Gaye'}</span><b class="bk-amt">${m(r.amt)}</b><span class="bk-src">${x.d.src === 'email' ? '✉️' : '💬'}</span></div>
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
  else if (tab === 'bad') body = R.bad.slice(0, 40).map(x => `<div class="bk-raw"><small>${x.d.src === 'email' ? '✉️ ' + esc(x.d.subj || '') : '💬 ' + esc(x.d.from || '')}</small><p>${esc(String(x.d.text).slice(0, 400))}</p><button type="button" class="give" data-bk-skip="${esc(x.d.id)}">✕ Hatao</button></div>`).join('') || '<p class="bk-empty">Sab samajh aa gaye 👍</p>';
  else body = (H ? '' : `<div class="bk-warn">⚠️ HBL khata nahi chuna. ${banks.length ? `<select data-bk-bank><option value="">— chunein —</option>${banks.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>` : 'Pehle bank ka khata banayein.'}</div>`)
    + (R.pend.map(cardHTML).join('') || `<div class="bk-empty">🎉<b>Sab lag gaye</b><small>Naya SMS / email aate hi yahan aayega</small></div>`) + (R.dup.length ? `<small class="bk-note">${R.dup.length} dubara aaye hue (wahi TXN) chhupaye</small>` : '');
  return `<div class="bk-root"><div class="bk-sum"><div><small>Aaj aaye</small><b class="green">${m(inT)}</b></div><div><small>Aaj gaye</small><b class="red">${m(outT)}</b></div><div><small>Baqi</small><b>${R.pend.length}</b></div></div>
    <div class="bk-live">💬 aakhri SMS: ${esc(last('sms'))} · ✉️ aakhri email: ${esc(last('email'))}${H ? ' · 🏦 ' + esc(H.name) : ''}</div>
    <div class="mchips bk-tabs">${tabs.map(([k, l]) => `<button type="button" class="rc${tab === k ? ' on' : ''}" data-bk-tab="${k}">${l}</button>`).join('')}</div>${body}</div>`;
}
function paint() { const b = $('dialogBody'); if (b && isOpen()) { const q = qOpen && b.querySelector(`[data-bk-q="${CSS.escape(qOpen)}"]`)?.value; b.innerHTML = html(); if (qOpen) { const i = b.querySelector(`[data-bk-q="${CSS.escape(qOpen)}"]`); if (i) { i.value = q || ''; i.focus(); search(i); } } } }
export function openBankInbox(t) {
  if (!canUse()) { O.notice?.('HBL Inbox: malik ya Full mulazim'); return; }
  bankWatch(); if (t) tab = t;
  const dl = $('dialog'); dl.classList.remove('search-dialog'); dl.classList.add('full-dialog');
  $('dialogTitle').textContent = '📩 HBL Inbox';
  $('dialogBody').innerHTML = docs ? html() : '<div class="bk-root"><p class="bk-empty">⏳ aa raha hai…</p></div>';
  if (!dl.open) dl.showModal();
  if (tab === 'setup') loadKey();
}
// ---------- ✓ lagao ----------
async function apply(id) {
  const x = rows().pend.find(z => z.d.id === id); if (!x || busy.has(id)) return;
  const H = hbl(); if (!H) { O.notice?.('Pehle HBL khata chunein'); return; }
  const r = x.r, w = who(), own = O.owner && O.owner(), today = O.today ? O.today() : '';
  const date = own && r.day && r.day <= today ? r.day : today;
  const note = (`HBL ${r.dir === 'in' ? 'aaye' : 'gaye'} · ${r.name}${r.bank ? ' (' + r.bank + ')' : ''}${r.via ? ' · ' + r.via : ''}${r.txn ? ' · TXN ' + r.txn : ''}${date !== r.day && r.day ? ' · asal din ' + r.day : ''}`).slice(0, 900);
  busy.add(id); paint();
  try {
    let partyId = '', entryId = '';
    if (r.kind === 'cash') {
      if (r.dir !== 'in') throw Error('ATM / cash nikalna khata mein haath se lagayein');
      entryId = await O.cashGive({ partyId: H.id, amount: r.amt, date, note });
      partyId = H.id;
    } else {
      const s = sugOf(x); if (!s) throw Error('Khata chunein');
      partyId = s.p.id; entryId = (crypto.randomUUID ? crypto.randomUUID() : 'bk' + Date.now());
      const ok = await O.pay({ id: entryId, rev: 0, fromPartyId: r.dir === 'in' ? s.p.id : H.id, toPartyId: r.dir === 'in' ? H.id : s.p.id, amount: r.amt, date, note, posPending: false, posVoucher: '' });
      if (ok === false) throw Error('Entry nahi lagi');
      const k = aliasKey(r.name); if (k && alias[k] !== s.p.id) { alias = { ...alias, [k]: s.p.id }; O.cloud.bankAliasSet(alias).catch(() => {}); }
    }
    await O.cloud.bankSmsSet(id, { st: 'done', by: String(w.uid || ''), byName: String(w.name || '').slice(0, 60), doneAt: Date.now(), partyId, entryId: String(entryId || ''), kind: r.kind });
    pick.delete(id); O.notice?.(`✓ ${m(r.amt)} — ${r.kind === 'cash' ? 'cash HBL mein jama' : (r.dir === 'in' ? r.name + ' → HBL' : 'HBL → ' + r.name)}`);
  } catch (e) { O.notice?.('⚠️ ' + (e?.message || e)); }
  finally { busy.delete(id); paint(); onCount(rows().pend.length); }
}
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
const smsBody = k => `{"fields":{"k":{"stringValue":"${k}"},"src":{"stringValue":"sms"},"from":{"stringValue":"14250"},"text":{"stringValue":"SMS_YAHAN"}}}`;
function gasCode(k) {
  return `// Blue Khata — HBL email (paise GAYE) -> 📩 HBL Inbox. Google ke server par har 5 minute. Kuch mitata / bhejta nahi, sirf parhta hai.
const KEY = '${k}';
const URL = '${restUrl()}';
function hblMail() {
  const label = GmailApp.getUserLabelByName('BK') || GmailApp.createLabel('BK');
  const threads = GmailApp.search('from:digital.banking@hbl.com -label:BK newer_than:7d', 0, 30);
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
  if (!key) return `<div class="bk-set"><h4>🔑 Pehle khufia chaabi</h4><p>Yeh chaabi sirf aap ke phone (MacroDroid) aur Gmail script mein jayegi — is ke baghair koi aur HBL Inbox mein kuch nahi daal sakta.</p><button type="button" class="got" data-bk-newkey="1">🔑 Chaabi banao</button></div>`;
  return `<div class="bk-set"><h4>💬 1 · Paise AAYE — SMS (isi phone par, ek dafa)</h4><ol>
    <li>Play Store se <b>MacroDroid</b> install karein, kholein.</li>
    <li><b>Add Macro</b> → Trigger ➕ → <b>Call/SMS → SMS Received</b> → "Contact / number" mein <b>14250</b> → Any content → OK.</li>
    <li>Action ➕ → <b>Connectivity → HTTP Request</b> → Method <b>POST</b>.</li>
    <li>URL: ${copyBtn('url', 'URL copy')} → URL ke khane mein paste.</li>
    <li>Content body → type <b>application/json</b> → ${copyBtn('body', 'Body copy')} → paste karein. Phir body mein <b>SMS_YAHAN</b> ko mita kar wahan <b>Magic Text (…)</b> se <b>"SMS message"</b> (message ka text) daalein.</li>
    <li>Macro ka naam "HBL → Blue Khata" → Save ✓.</li>
    <li>Phone Settings → Apps → MacroDroid → Battery → <b>Unrestricted</b> (warna phone band kar deta hai).</li>
    <li>Test: macro kholein → ⋮ → <b>Test actions</b> → yahan "❓ Samajh nahi" mein ek khali card aa jaye = rabta theek ✓ (use ✕ kar dein).</li></ol>
    <h4>✉️ 2 · Paise GAYE — Gmail (NOORTRADERS145@gmail.com, ek dafa)</h4><ol>
    <li>Browser mein <b>script.google.com</b> kholein (NOORTRADERS145 se login) → <b>New project</b>.</li>
    <li>Wahan likha sab mita kar ${copyBtn('gas', 'Script copy')} paste → 💾 Save.</li>
    <li>Upar function list mein <b>setup</b> chunein → <b>▶ Run</b> → Review permissions → apna account → Advanced → "Go to … (unsafe)" → <b>Allow</b>.</li>
    <li>Bas — ab har 5 minute HBL ki nayi email yahan aayegi (Gmail mein "BK" label lagta hai).</li></ol>
    <p class="bk-note">🔒 Chaabi kisi ko na bhejein. Shak ho to ${O.owner && O.owner() ? '<button type="button" class="bk-mini" data-bk-newkey="1">🔁 nayi chaabi</button>' : ''} — phir MacroDroid body aur script dobara lagani hogi.</p></div>`;
}
async function copy(what) {
  const t = what === 'url' ? restUrl() : what === 'body' ? smsBody(key) : gasCode(key);
  try { await navigator.clipboard.writeText(t); O.notice?.('📋 Copy ho gaya'); } catch { prompt('Copy karein:', t); }
}
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-hb="bank"],#bkOpenBtn')) { openBankInbox(); return; }
  const t = e.target.closest?.('[data-bk-tab],[data-bk-ok],[data-bk-skip],[data-bk-chg],[data-bk-pick],[data-bk-copy],[data-bk-newkey]'); if (!t || !isOpen()) return;
  const d = t.dataset;
  if (d.bkTab) { tab = d.bkTab; paint(); if (tab === 'setup') loadKey(); return; }
  if (d.bkOk) { apply(d.bkOk); return; }
  if (d.bkSkip) { skip(d.bkSkip); return; }
  if (d.bkChg) { qOpen = d.bkChg; pick.delete(d.bkChg); paint(); return; }
  if (d.bkPick) { const [id, pid] = d.bkPick.split('|'); pick.set(id, pid); qOpen = ''; paint(); return; }
  if (d.bkCopy) { copy(d.bkCopy); return; }
  if (d.bkNewkey) { if (key && !confirm('Nayi chaabi? Purani wali MacroDroid aur Gmail script kaam karna band kar denge — dono dobara lagani hongi.')) return;
    const a = new Uint8Array(16); crypto.getRandomValues(a); const k = [...a].map(b => b.toString(16).padStart(2, '0')).join('');
    O.cloud.setBankKey(k).then(() => { key = k; paint(); O.notice?.('🔑 Chaabi ban gayi'); }).catch(er => O.notice?.('⚠️ ' + (er?.message || er))); }
});
document.addEventListener('input', e => { if (e.target.matches?.('[data-bk-q]')) { qOpen = e.target.dataset.bkQ; search(e.target); } });
document.addEventListener('change', e => { if (e.target.matches?.('[data-bk-bank]') && e.target.value) { O.setBank?.(e.target.value); paint(); } });
export const _bankTest = { rows, html, apply, gasCode, smsBody, setDocs: d => { docs = d; alias = (d.find(x => x.id === '_alias') || {}).m || {}; docs = d.filter(x => x.id !== '_alias'); }, setKey: k => { key = k; }, setTab: t => { tab = t; } };
