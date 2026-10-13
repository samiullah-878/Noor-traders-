// notes.js — v2.26.0 (📇 Google contacts, kai account) · v2.25.0 (contact: phone list / khata, 📞 Call · 💬 WhatsApp) · v2.23.0: 🔔 REMINDER + 📝 NOTES + 💸 HBL PAYMENT + push notification
// - notes/<id>: {kind 'note'|'order', text, items[{id,name}], partyId, partyName, amount(paisa), transferId,
//   remindDay 'YYYY-MM-DD', remindTime 'HH:MM', allDay, done, doneAt, hasPic, by, byName, createdAt, updatedBy, updatedAt, deleted}
//   Tasveer: entryPhotos/n-<id> {photos:[...]} (khata entries jaisa, 2 tak).
// - Accounts ke purane due-date reminders (blueKhata type 'reminder') bhi isi screen par (tap = khata).
// - HBL: khata ka jo account naam mein "HBL" rakhta hai (ya ek dafa chuna hua) — "💸 HBL payment" = account transfer
//   (HBL -> supplier, POS mein bhi) + order ka reminder note.
// - Notification: FCM token pushTokens/<hash>; Cloud Function (cloud-functions/) har 10 minute waqt aaye reminder bhejti hai.
import { saleStock, stockAgentGodams, stockAgentTransfer } from './pos-stock.js?v=2.99.69';
import { planItem, shopIdx, hisaabLines } from './po-formula.js?v=2.99.69';   // v2.99.29: shaffaf order formula
import { voiceSearch, smartSearch, partyScore, smartHit } from './smart-search.js?v=2.99.69';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK').format(Math.round((Number(n) || 0) * 100) / 100);
const rsP = p => 'Rs ' + num((Number(p) || 0) / 100);
const dayOf = (ms = Date.now()) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return dayOf(d.getTime()); };
const nice = day => day === dayOf() ? 'Aaj' : day === addDays(1) ? 'Kal' : day === addDays(-1) ? 'Kal (guzra)' : day || '';
const t12 = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
const ID = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const BANK_KEY = 'sam-bank-party-v1';

let aiOf = null, stockOf = () => null, balanceOf = null;
let cloud = null, notice = () => {}, whoOf = () => ({}), recordsOf = () => [], partyOf = () => null, partiesOf = () => [], itemsOf = () => [], routeTo = () => {}, dlgOf = null, closeDlg = () => {}, payOf = null, canUseOf = () => false;
let notes = [], stop = null, fTab = 'open', fQ = '', pics = new Map(), picLoad = new Set(), animating = new Set();
let selMode = false, sel = new Set(), bulkBusy = false;   // v2.99.27: ☑ kai notes ek saath
const NAGS = [15, 30, 60], nagOk = v => NAGS.includes(Number(v)) ? Number(v) : 0, nagTxt = v => v === 60 ? '1 ghanta' : v + ' min';
let pushCfg = null, pushState = '';

export function notesSetup(o) {
  cloud = o.cloud || cloud; notice = o.notice || notice; whoOf = o.who || whoOf; recordsOf = o.records || recordsOf;
  partyOf = o.party || partyOf; partiesOf = o.parties || partiesOf; itemsOf = o.items || itemsOf; routeTo = o.route || routeTo;
  dlgOf = o.modal || dlgOf; closeDlg = o.close || closeDlg; payOf = o.pay || payOf; canUseOf = o.canUse || canUseOf; aiOf = o.ai || aiOf; stockOf = o.stock || stockOf; pdfOf = o.pdf || pdfOf; balanceOf = o.balance || balanceOf;
  alWatch();
  if (!stop && cloud?.listenNotes) stop = cloud.listenNotes(list => { notes = (list || []).filter(n => n && n.id && !n.deleted); if ($('ntRoot')) paint(); badge(); try { window.dispatchEvent(new Event('sam-notes')); } catch {} });
  window.addEventListener('hashchange', hashGo);
  setTimeout(hashGo, 1800);
}
export function notesStop() { if (stop) { try { stop(); } catch {} stop = null; } }
function badge() { const b = $('notesNav'); if (!b) return; const n = notes.filter(x => !x.done && x.remindDay && x.remindDay <= dayOf()).length + dueParty().length; b.dataset.count = n ? String(n) : ''; b.classList.toggle('has-count', n > 0); }
function hashGo() {
  const h = String(location.hash || '');
  let m = h.match(/^#note=([a-zA-Z0-9_-]+)/);
  if (m) { if (!canUseOf()) return setTimeout(hashGo, 1500); routeTo('notes'); setTimeout(() => { const el = document.querySelector(`[data-nt-id="${m[1]}"]`); el?.scrollIntoView({ block: 'center' }); el?.classList.add('nt-flash'); }, 400); history.replaceState(null, '', location.pathname + location.search); return; }
  m = h.match(/^#rem=([a-zA-Z0-9_-]+)/);
  if (m) { if (!canUseOf()) return setTimeout(hashGo, 1500); routeTo('khata', m[1]); history.replaceState(null, '', location.pathname + location.search); }
}

// ---------- HBL account ----------
// v2.99.58: malik ka chuna HBL account sab phones par (bankSms/_alias m['@hbl']) — pehle sirf isi phone par yaad rehta tha
let bankShared = '';
export function setBankShared(id) { bankShared = String(id || ''); }
export const notesList = () => notes;
export function bankId() {
  const all = (partiesOf() || []).filter(p => p && !p.deleted);
  if (bankShared && all.some(p => p.id === bankShared)) return bankShared;
  let id = ''; try { id = localStorage.getItem(BANK_KEY) || ''; } catch {}
  if (id && all.some(p => p.id === id)) return id;
  const flagged = all.filter(p => p.bank);   // v2.39: account edit mein "Bank / loan account" tick
  if (flagged.length === 1) return flagged[0].id;
  const hbl = all.filter(p => /\bhbl\b/i.test(String(p.name || '')));
  return hbl.length === 1 ? hbl[0].id : '';
}
export const isBank = id => !!id && (id === bankId() || !!partyOf(id)?.bank);
function pickBank(then) {
  const all = (partiesOf() || []).filter(p => p && !p.deleted);
  const hbl = all.filter(p => /hbl|bank/i.test(String(p.name || '')));
  dlgOf('🏦 HBL wala account chunein', `<p class="stat-note">Ek dafa chunein — phir yahi yaad rahega (isi phone par).</p>
    <label>Account dhoondein<input id="bkQ" type="search" autocomplete="off" placeholder="naam likhein…"></label><div class="nt-pick" id="bkList"></div>`);
  const paintB = () => { const q = $('bkQ')?.value || ''; const list = q ? all.map(p => [p, partyScore(p, q)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]) : (hbl.length ? hbl : all.slice(0, 12));
    $('bkList').innerHTML = list.map(p => `<button type="button" data-bk="${esc(p.id)}">🏦 ${esc(p.name)}</button>`).join('') || '<small>Nahi mila</small>'; };
  paintB(); $('bkQ').oninput = paintB;
  $('bkList').onclick = e => { const b = e.target.closest('[data-bk]'); if (!b) return; try { localStorage.setItem(BANK_KEY, b.dataset.bk); } catch {} bankShared = b.dataset.bk; try { window.dispatchEvent(new CustomEvent('sam-bank-pick', { detail: b.dataset.bk })); } catch {} notice('🏦 ' + (partyOf(b.dataset.bk)?.name || '') + ' = HBL account'); closeDlg(); then?.(b.dataset.bk); };
}
export function hblPayForm(forceBank) {
  const bid = forceBank || bankId();
  if (!bid) return pickBank(id => hblPayForm(id));
  const bank = partyOf(bid);
  let sup = '', chosen = [];
  dlgOf('💸 ' + esc(bank?.name || 'HBL') + ' se payment', `<form class="nt-form">
    <div class="nt-bank">🏦 <b>${esc(bank?.name || 'HBL')}</b> <button type="button" class="nt-link" data-bk-change="1">badlein</button></div>
    <label>Kis ko (supplier)<input id="hpSupQ" type="search" autocomplete="off" placeholder="supplier ka naam…" required></label><div class="nt-pick" id="hpSupList"></div>
    <div id="hpSupPicked" class="nt-picked"></div>
    <label>Raqam Rs<input name="amount" type="number" inputmode="decimal" min="1" step="1" required></label>
    <div class="nt-amt-chips mchips">${[10000, 25000, 50000, 100000].map(v => `<button type="button" class="rc" data-hp-amt="${v}">${num(v)}</button>`).join('')}</div>
    <label>Kya order kiya (items)<input id="hpItemQ" type="search" autocomplete="off" placeholder="🔍 item ka naam…"></label><div class="nt-pick" id="hpItemList"></div>
    <div class="nt-chips" id="hpItems"></div>
    <label>Note<textarea name="note" maxlength="500" placeholder="misal: 20 bori, parson tak maal"></textarea></label>
    <div class="nt-when"><label>Reminder din<input name="day" type="date" value="${addDays(2)}"></label><label>Waqt<input name="time" type="time" value="11:00"></label></div>
    <div class="mchips">${[[0, 'Aaj'], [1, 'Kal'], [2, '2 din'], [7, 'Hafta']].map(([d, l]) => `<button type="button" class="rc" data-hp-day="${d}">${l}</button>`).join('')}</div>
    <p class="stat-note">Save par: khata mein <b>${esc(bank?.name || 'HBL')} → supplier</b> transfer (POS mein bhi), aur "maal aana baqi" ka reminder.</p>
    <button type="submit" class="got">💸 Payment save + reminder</button></form>`);
  const f = document.querySelector('#dialogBody form');
  const paintSup = () => { const q = $('hpSupQ').value.trim(); const all = (partiesOf() || []).filter(p => p && !p.deleted && p.id !== bid);
    const list = q ? all.map(p => [p, partyScore(p, q)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]) : [];
    $('hpSupList').innerHTML = list.map(p => `<button type="button" data-hp-sup="${esc(p.id)}">${esc(p.name)}${p.category ? ' <small>' + esc(p.category) + '</small>' : ''}</button>`).join(''); };
  const paintItems = () => { $('hpItems').innerHTML = chosen.map((it, i) => `<span class="nt-chip">${esc(it.name)}<button type="button" data-hp-rm="${i}" aria-label="hatao">×</button></span>`).join(''); };
  const paintItemList = () => { const q = $('hpItemQ').value.trim(); const hits = q.length >= 2 ? smartSearch(itemsOf() || [], q, 8) : [];
    $('hpItemList').innerHTML = hits.map(r => `<button type="button" data-hp-it="${esc(r.id)}">${esc(r.name)}${r.code ? ' <small>' + esc(r.code) + '</small>' : ''}</button>`).join('') + (q.length >= 2 ? `<button type="button" data-hp-free="1">＋ "${esc(q)}" likh do</button>` : ''); };
  $('hpSupQ').oninput = paintSup; $('hpItemQ').oninput = paintItemList;
  f.addEventListener('click', e => {
    const t = e.target.closest('[data-hp-sup],[data-hp-it],[data-hp-free],[data-hp-rm],[data-hp-amt],[data-hp-day],[data-bk-change]'); if (!t) return;
    const d = t.dataset;
    if (d.bkChange) { try { localStorage.removeItem(BANK_KEY); } catch {} pickBank(id => hblPayForm(id)); return; }
    if (d.hpSup) { sup = d.hpSup; $('hpSupPicked').innerHTML = `<span class="nt-chip big">🧾 ${esc(partyOf(sup)?.name || '')}</span>`; $('hpSupList').innerHTML = ''; $('hpSupQ').value = partyOf(sup)?.name || ''; return; }
    if (d.hpIt) { const r = (itemsOf() || []).find(x => String(x.id) === d.hpIt); if (r && !chosen.some(c => c.id === String(r.id))) chosen.push({ id: String(r.id), name: String(r.name).slice(0, 80) }); $('hpItemQ').value = ''; $('hpItemList').innerHTML = ''; paintItems(); return; }
    if (d.hpFree) { const v = $('hpItemQ').value.trim().slice(0, 80); if (v) chosen.push({ id: '', name: v }); $('hpItemQ').value = ''; $('hpItemList').innerHTML = ''; paintItems(); return; }
    if (d.hpRm != null) { chosen.splice(Number(d.hpRm), 1); paintItems(); return; }
    if (d.hpAmt) { f.elements.amount.value = d.hpAmt; return; }
    if (d.hpDay != null) { f.elements.day.value = addDays(Number(d.hpDay)); }
  });
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector('[type=submit]'); if (b.disabled) return;
    const amt = Math.round(Number(f.elements.amount.value) || 0);
    if (!sup) { notice('Supplier chunein'); return; }
    if (!(amt > 0)) { notice('Raqam likhein'); return; }
    if (!payOf) { notice('Is login par transfer nahi'); return; }
    b.disabled = true; b.textContent = 'Save ho raha hai…';
    const sname = partyOf(sup)?.name || '', items = chosen.map(c => c.name).join(', ');
    const tid = ID();
    const tnote = ('HBL payment' + (items ? ' — ' + items : '') + (f.elements.note.value ? ' · ' + f.elements.note.value : '')).slice(0, 900);
    try {
      if (bank.bank && Number(bank.limit) > 0 && balanceOf) { const used = Math.max(0, -Number(balanceOf(bid) || 0)) + amt * 100; if (used > Number(bank.limit) && !confirm('⚠️ Is payment ke baad loan limit se ' + Math.round((used - Number(bank.limit)) / 100).toLocaleString('en-PK') + ' zyada ho jayega (limit ' + Math.round(Number(bank.limit) / 100).toLocaleString('en-PK') + '). Phir bhi bhejein?')) throw Error('Limit ki wajah se rok diya'); }
      const ok = await payOf({ id: tid, rev: 0, fromPartyId: bid, toPartyId: sup, amount: amt * 100, date: dayOf(), note: tnote, posPending: false });
      if (ok === false) throw Error('Transfer nahi hua');
      await saveNote({ id: 'o' + tid, contactName: sname.slice(0, 80), contactPhone: partyOf(sup)?.phone || '', kind: 'order', text: (f.elements.note.value || '').slice(0, 500), items: chosen.slice(0, 20), partyId: sup, partyName: sname.slice(0, 120), amount: amt * 100, transferId: tid, remindDay: f.elements.day.value || '', remindTime: f.elements.time.value || '', allDay: !f.elements.time.value }, null);
      closeDlg(); notice('💸 ' + sname + ' ko Rs ' + num(amt) + ' — reminder bhi lag gaya');
    } catch (er) { b.disabled = false; b.textContent = '💸 Payment save + reminder'; notice('⚠️ ' + (er?.message || er)); }
  };
}


// ---------- v2.25: 👤 CONTACT — phone ki list / khata se; card par 📞 Call + 💬 WhatsApp ----------
const cleanPhone = v => String(v || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 20);
function waNum(v) {                  // Pakistan: 0300xxxxxxx / 300xxxxxxx / 0092... -> 92300xxxxxxx
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  return d;
}
const telNum = v => { const w = waNum(v); return w.startsWith('92') ? '+' + w : String(v || '').replace(/[^\d+]/g, ''); };
const canPick = () => 'contacts' in navigator && typeof navigator.contacts?.select === 'function';
async function pickPhoneContact() {
  if (!canPick()) { notice('Is phone/browser mein contact list nahi khulti — naam aur number khud likh dein'); return null; }
  try {
    const r = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    const c = r && r[0]; if (!c) return null;
    const tel = (c.tel || []).map(cleanPhone).filter(Boolean);
    return { name: String((c.name || [])[0] || '').slice(0, 80), phone: tel[0] || '', more: tel.slice(1, 4) };
  } catch (e) { if (e?.name !== 'AbortError') notice('Contact nahi mila: ' + (e?.message || e)); return null; }
}
function contactBox(prefix, name, phone) {
  return `<div class="nt-contact" id="${prefix}Ct">
    <div class="nt-ct-head"><b>👤 Contact</b><span class="mchips">${canPick() ? `<button type="button" class="rc" data-ct-pick="${prefix}">📇 Phone ki list</button>` : ''}<button type="button" class="rc" data-ct-khata="${prefix}">📒 Khata se</button>${gcLoad().accounts.length ? `<span class="nt-gc-tip">📇 ${gcAll().length} Google contacts — naam likhein</span>` : ''}${name || phone ? `<button type="button" class="rc" data-ct-clear="${prefix}">✕</button>` : ''}</span></div>
    <div class="nt-pick" id="${prefix}CtList"></div>
    <div class="nt-pick nt-sugg" id="${prefix}CtSug"></div>
    <div class="nt-when"><label>Naam<input name="ctName" autocomplete="off" maxlength="80" value="${esc(name || '')}" placeholder="kis ka"></label><label>Number<input name="ctPhone" type="tel" inputmode="tel" maxlength="20" value="${esc(phone || '')}" placeholder="03xx xxxxxxx"></label></div>
  </div>`;
}
function wireContact(f, prefix) {       // form ke andar contact ke buttons
  const sug = () => { const q = f.elements.ctName.value; const l = ctSuggest(q); $(prefix + 'CtSug').innerHTML = l.map(c => `<button type="button" data-ct-sug="${esc(c.n)}|${esc(c.ph)}">${c.src} <b>${esc(c.n)}</b> <small>${esc(c.ph)}</small></button>`).join(''); };
  f.elements.ctName.addEventListener('input', sug); f.elements.ctPhone.addEventListener('input', () => { if (String(f.elements.ctPhone.value).replace(/\D/g, '').length >= 4 && !f.elements.ctName.value) { const l = ctSuggest(f.elements.ctPhone.value); $(prefix + 'CtSug').innerHTML = l.map(c => `<button type="button" data-ct-sug="${esc(c.n)}|${esc(c.ph)}">${c.src} <b>${esc(c.n)}</b> <small>${esc(c.ph)}</small></button>`).join(''); } });
  f.addEventListener('click', e => { const b = e.target.closest('[data-ct-sug]'); if (!b) return; const i = b.dataset.ctSug.lastIndexOf('|'); f.elements.ctName.value = b.dataset.ctSug.slice(0, i); f.elements.ctPhone.value = b.dataset.ctSug.slice(i + 1); $(prefix + 'CtSug').innerHTML = ''; });
  f.addEventListener('click', async e => {
    const t = e.target.closest(`[data-ct-pick="${prefix}"],[data-ct-khata="${prefix}"],[data-ct-clear="${prefix}"],[data-ct-p]`); if (!t) return;
    const list = $(prefix + 'CtList'), d = t.dataset;
    if (d.ctPick) { const c = await pickPhoneContact(); if (!c) return; f.elements.ctName.value = c.name; f.elements.ctPhone.value = c.phone;
      list.innerHTML = c.more.length ? c.more.map(ph => `<button type="button" data-ct-p="${esc(ph)}">📞 ${esc(ph)} <small>ye number lagao</small></button>`).join('') : ''; return; }
    if (d.ctP) { f.elements.ctPhone.value = d.ctP; list.innerHTML = ''; return; }
    if (d.ctClear) { f.elements.ctName.value = ''; f.elements.ctPhone.value = ''; list.innerHTML = ''; return; }
    if (d.ctKhata) {
      list.innerHTML = `<input type="search" id="${prefix}CtQ" autocomplete="off" placeholder="🔍 khata ka naam…"><div id="${prefix}CtRes" class="nt-pick"></div>`;
      const q = $(prefix + 'CtQ'); q.focus();
      q.oninput = () => { const v = q.value.trim(); const all = (partiesOf() || []).filter(p => p && !p.deleted);
        const hits = v ? all.map(p => [p, partyScore(p, v)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]) : [];
        $(prefix + 'CtRes').innerHTML = hits.map(p => `<button type="button" data-ct-party="${esc(p.id)}">${esc(p.name)} <small>${p.phone ? '📞 ' + esc(p.phone) : 'number nahi'}</small></button>`).join(''); };
    }
  });
  f.addEventListener('click', e => { const b = e.target.closest('[data-ct-party]'); if (!b) return; const p = partyOf(b.dataset.ctParty); if (!p) return;
    f.elements.ctName.value = String(p.name || '').slice(0, 80); f.elements.ctPhone.value = cleanPhone(p.phone || ''); $(prefix + 'CtList').innerHTML = '';
    if (!p.phone) notice('Is khate mein number nahi — khud likh dein'); });
}
const callBtns = n => { const ph = n.contactPhone; if (!ph) return '';
  return `<div class="nt-callrow"><span class="nt-ct-name">👤 ${esc(n.contactName || ph)}</span><a class="nt-call" href="tel:${esc(telNum(ph))}" data-nt-stop="1">📞 Call</a><a class="nt-wa" href="https://wa.me/${esc(waNum(ph))}" target="_blank" rel="noopener" data-nt-stop="1">💬 WhatsApp</a></div>`; };

// ---------- v2.26: 📇 GOOGLE CONTACTS — kai Gmail account, list SIRF isi phone par (localStorage), cloud par nahi ----------
// Google Identity Services token client (contacts.readonly + email) -> People API connections (names, phoneNumbers).
// Client ID: blueAccess/pushConfig.googleClientId (malik "⚙️ Client ID"). Har account alag: {email, at, list:[{n, p:[..]}]}.
const GC_KEY = 'sam-gcontacts-v1', GC_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly openid email';
let gcData = null, gcBusy = '', gisP = null;
function gcLoad() { if (gcData) return gcData; try { gcData = JSON.parse(localStorage.getItem(GC_KEY) || 'null'); } catch { gcData = null; } if (!gcData || !Array.isArray(gcData.accounts)) gcData = { accounts: [] }; return gcData; }
function gcSave() { try { localStorage.setItem(GC_KEY, JSON.stringify(gcData)); } catch (e) { notice('⚠️ Phone mein jagah kam — contacts save nahi hue'); } }
const gcAll = () => gcLoad().accounts.flatMap(a => a.list.map(c => ({ ...c, acc: a.email })));
const gcOwner = () => (whoOf() || {}).role === 'owner';
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisP) return gisP;
  gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(); s.onerror = () => { gisP = null; rej(Error('Google login load nahi hua — internet dekhein')); }; document.head.appendChild(s); });
  return gisP;
}
async function gcToken(hint) {
  pushCfg = pushCfg || await cloud.getPushConfig();
  const cid = String(pushCfg?.googleClientId || '').trim();
  if (!cid) throw Error('Pehle "⚙️ Client ID" save karein');
  await loadGis();
  return new Promise((res, rej) => {
    const tc = window.google.accounts.oauth2.initTokenClient({ client_id: cid, scope: GC_SCOPE, hint: hint || undefined, prompt: hint ? '' : 'select_account',
      callback: r => r?.access_token ? res(r.access_token) : rej(Error(r?.error_description || r?.error || 'Login nahi hua')),
      error_callback: e => rej(Error(e?.type === 'popup_closed' ? 'Login band kar diya' : (e?.message || e?.type || 'Login nahi hua'))) });
    tc.requestAccessToken();
  });
}
async function gcSync(hint) {        // naya account (hint khali) ya purana taza
  if (gcBusy) return; gcBusy = hint || 'new'; gcPaint();
  try {
    const tok = await gcToken(hint), H = { Authorization: 'Bearer ' + tok };
    const me = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: H })).json();
    const email = String(me?.email || hint || 'account').toLowerCase();
    const list = []; let page = '';
    for (let i = 0; i < 15; i++) {
      const u = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000' + (page ? '&pageToken=' + encodeURIComponent(page) : '');
      const r = await fetch(u, { headers: H }); const j = await r.json();
      if (!r.ok) throw Error(j?.error?.message || ('People API ' + r.status));
      for (const p of j.connections || []) { const ph = [...new Set((p.phoneNumbers || []).map(x => cleanPhone(x.canonicalForm || x.value)).filter(Boolean))].slice(0, 4);
        if (!ph.length) continue; list.push({ n: String(p.names?.[0]?.displayName || ph[0]).slice(0, 80), p: ph }); }
      page = j.nextPageToken || ''; if (!page) break;
    }
    const d = gcLoad(), i = d.accounts.findIndex(a => a.email === email), acc = { email, at: Date.now(), list };
    if (i >= 0) d.accounts[i] = acc; else d.accounts.push(acc);
    gcSave(); notice('📇 ' + email + ' — ' + list.length + ' contacts aa gaye');
  } catch (e) { notice('⚠️ Google contacts: ' + (e?.message || e)); }
  finally { gcBusy = ''; gcPaint(); }
}
function gcAgo(ms) { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; }
function gcCardHTML() {
  if (!gcOwner()) return '';
  const d = gcLoad(), cid = !!String(pushCfg?.googleClientId || '').trim();
  return `<div class="nt-gc"><div class="nt-gc-head"><b>📇 Google contacts</b><span>${d.accounts.reduce((n, a) => n + a.list.length, 0)} contacts · isi phone par</span></div>
    ${d.accounts.map(a => `<div class="nt-gc-acc${Date.now() - a.at > 7 * 864e5 ? ' old' : ''}"><span class="nt-gc-mail">${esc(a.email)}</span><small>${a.list.length} · ${esc(gcAgo(a.at))}</small>
      <button type="button" class="rc" data-gc-sync="${esc(a.email)}"${gcBusy ? ' disabled' : ''}>${gcBusy === a.email ? '⏳' : '🔄'}</button><button type="button" class="rc" data-gc-rm="${esc(a.email)}">✕</button></div>`).join('')}
    <div class="mchips"><button type="button" class="rc on" data-gc-add="1"${gcBusy || !cid ? ' disabled' : ''}>${gcBusy === 'new' ? '⏳ Login…' : '➕ ' + (d.accounts.length ? 'Aur account jorein' : 'Google account jorein')}</button><button type="button" class="nt-link" data-gc-cid="1">⚙️ Client ID${cid ? ' ✓' : ' (pehle ye)'}</button></div></div>`;
}
function gcPaint() { const b = $('ntGc'); if (b) b.innerHTML = gcLoad().accounts.length ? gcCardHTML() : ''; }
function gcCidForm() {
  dlgOf('⚙️ Google contacts — Client ID', `<form class="nt-form"><p class="stat-note">Google Cloud → <b>Google Auth Platform → Clients</b> → Web client → <b>Client ID</b> copy (…apps.googleusercontent.com) → yahan paste. Tafseel: GOOGLE_CONTACTS_SETUP.txt</p>
    <label>Client ID<input name="c" autocomplete="off" required minlength="20" value="${esc(pushCfg?.googleClientId || '')}" placeholder="1234-abc.apps.googleusercontent.com"></label><button type="submit" class="got">Save</button></form>`);
  const f = document.querySelector('#dialogBody form');
  f.onsubmit = async e => { e.preventDefault(); const v = f.elements.c.value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) { notice('Ye Client ID nahi lagti — aakhir mein .apps.googleusercontent.com hota hai'); return; }
    try { await cloud.setGoogleClientId(v); pushCfg = { ...(pushCfg || {}), googleClientId: v }; closeDlg(); notice('✓ Client ID save — ab "➕ Google account jorein"'); gcPaint(); } catch (er) { notice('⚠️ ' + (er?.message || er)); } };
}
function ctSuggest(q) {             // Google contacts + khata — naam ya number se
  const t = String(q || '').trim().toLowerCase(); if (t.length < 2) return [];
  const digits = t.replace(/\D/g, ''), out = [], seen = new Set();
  const add = (n, ph, src) => { const k = waNum(ph); if (!k || seen.has(k)) return; seen.add(k); out.push({ n, ph, src }); };
  for (const c of gcAll()) { if (out.length >= 10) break; const hit = c.n.toLowerCase().includes(t) || (digits.length >= 4 && c.p.some(p => p.replace(/\D/g, '').includes(digits))); if (hit) c.p.forEach(p => add(c.n, p, '📇')); }
  for (const p of (partiesOf() || [])) { if (out.length >= 12) break; if (!p || p.deleted || !p.phone) continue; if (String(p.name || '').toLowerCase().includes(t) || (digits.length >= 4 && String(p.phone).replace(/\D/g, '').includes(digits))) add(String(p.name).slice(0, 80), cleanPhone(p.phone), '📒'); }
  return out.slice(0, 10);
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-gc-add],[data-gc-sync],[data-gc-rm],[data-gc-cid]'); if (!t) return;
  const d = t.dataset;
  if (d.gcCid) { gcCidForm(); return; }
  if (d.gcAdd) { gcSync(''); return; }
  if (d.gcSync) { gcSync(d.gcSync); return; }
  if (d.gcRm) { if (!confirm(d.gcRm + ' ke contacts is phone se hata dein?')) return; const g = gcLoad(); g.accounts = g.accounts.filter(a => a.email !== d.gcRm); gcSave(); gcPaint(); }
});

// ---------- v2.36: 📢 DEMAND — mulazim item par "Khatam / Kam hai" dabaye -> purchase order mein 👦 chip ----------
// demands/<id> {id, i, n, lvl:'out'|'low', by, byName, at, st:'open'|'done'}
let dmList = [], dmStop = null, dmQ = '';
function dmWatch() { if (dmStop || !cloud?.listenDemands) return; dmStop = cloud.listenDemands(l => { dmList = (l || []).sort((a, b) => (b.at || 0) - (a.at || 0)); const b = $('ntPo'); if (b) b.innerHTML = poHTML(); const d = $('dmBody'); if (d) d.innerHTML = dmHTML(); }); }
const dmOpen = () => dmList.filter(d => d.st === 'open');
function dmItems() { try { const m = stockOf(); if (m && m.size) return [...m.values()]; } catch {}
  try { const st = saleStock(); const m = new Map(); for (const b of st.branches || []) for (const r of st.itemsFor(b) || []) if (!m.has(String(r.id))) m.set(String(r.id), r); return [...m.values()]; } catch { return []; } }
function dmHTML() {
  const w = whoOf() || {}, mine = dmOpen(), items = dmItems(), q = dmQ.trim();
  const hits = q ? smartSearch(items, q, 8) : [];
  return `<div class="dm-root">
    <label class="hs-search"><input type="search" id="dmQ" placeholder="🔍 item ka naam / code…" value="${esc(dmQ)}" autocomplete="off"><button type="button" class="dm-mic" data-dm-mic="1" title="Bol kar">🎤</button></label>
    ${q ? `<div class="dm-hits">${hits.map(it => `<div class="dm-hit"><span><b>${esc(it.name)}</b><small>stock ${esc(num(Number(it.stock) || 0))} ${esc(it.uName || '')}</small></span><button type="button" class="give" data-dm-add="${esc(String(it.id))}" data-lvl="out">Khatam</button><button type="button" data-dm-add="${esc(String(it.id))}" data-lvl="low">Kam hai</button></div>`).join('') || '<p class="muted">Kuch nahi mila — naam ka hissa likhein</p>'}</div>` : '<p class="muted">Item likhein ya 🎤 bolein, phir "Khatam" ya "Kam hai".</p>'}
    ${mine.length ? `<div class="dm-list"><b>📢 Khuli demand (${mine.length})</b>${mine.slice(0, 40).map(d => `<div class="dm-row${d.lvl === 'out' ? ' out' : ''}"><span>${esc(d.n)}<small>${d.lvl === 'out' ? 'khatam' : 'kam'} · ${esc(d.byName || '')} · ${esc(new Date(d.at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</small></span>${(d.by === w.uid || w.role === 'owner' || w.scope === 'full') ? `<button type="button" data-dm-x="${esc(d.id)}">✕</button>` : ''}</div>`).join('')}</div>` : ''}
  </div>`;
}
export function openDemand() { dmWatch(); dmQ = ''; dlgOf('📢 Demand — kya khatam / kam hai?', `<div id="dmBody">${dmHTML()}</div>`); setTimeout(() => $('dmQ')?.focus(), 50); }
document.addEventListener('input', e => { if (e.target?.id !== 'dmQ') return; dmQ = e.target.value || ''; const d = $('dmBody'); if (d) { d.innerHTML = dmHTML(); const q = $('dmQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });
document.addEventListener('click', async e => {
  if (e.target.closest?.('[data-demand]')) { openDemand(); return; }
  if (e.target.closest?.('[data-dm-mic]')) { const ok = voiceSearch(t => { dmQ = t; const d = $('dmBody'); if (d) d.innerHTML = dmHTML(); }); if (!ok) notice('Is phone mein awaz nahi chalti'); return; }
  const a = e.target.closest?.('[data-dm-add]');
  if (a) { const it = dmItems().find(x => String(x.id) === a.dataset.dmAdd); if (!it) return; const w = whoOf() || {};
    const dup = dmOpen().find(d => String(d.i) === String(it.id)); if (dup) { notice('📢 ' + it.name + ' ki demand pehle se khuli hai'); return; }
    const d = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), i: String(it.id), n: String(it.name).slice(0, 60), lvl: a.dataset.lvl === 'out' ? 'out' : 'low', by: String(w.uid || ''), byName: String(w.name || '').slice(0, 40), at: Date.now(), st: 'open' };
    dmList.unshift(d); dmQ = ''; const b = $('dmBody'); if (b) b.innerHTML = dmHTML(); $('dmQ')?.focus();
    try { await cloud.saveDemand(d); notice('📢 ' + it.name + ' — ' + (d.lvl === 'out' ? 'khatam' : 'kam') + ' likh diya, malik ko order mein dikhega'); try { navigator.vibrate?.(40); } catch {} } catch (er) { notice('⚠️ ' + (er?.message || er)); }
    return; }
  const x = e.target.closest?.('[data-dm-x]');
  if (x) { const d = dmList.find(z => z.id === x.dataset.dmX); if (!d) return; d.st = 'done'; const b = $('dmBody'); if (b) b.innerHTML = dmHTML(); try { await cloud.saveDemand(d); } catch (er) { notice('⚠️ ' + (er?.message || er)); } }
});

// ---------- v2.99.22: ⏰ MAAL KHATAM HONE SE PEHLE (PC raat-report.js -> blueAccess/stockAlert) ----------
// Har subah PC: kul stock ÷ roz ki bikri = kitne din baqi. 🔴 laal <= alertRed din, 🟡 peela <= alertYellow. Supplier ke hisaab se jama,
// 📲 WhatsApp order (POS ka phone), ➕ Order mein daalo (mojooda purchase order mein). Yahan AI nahi.
let alData = null, alStop = null, alOpen = true, alSupOpen = new Set();
function alWatch() { if (alStop || !cloud?.listenStockAlert) return; alStop = cloud.listenStockAlert(d => { alData = d === undefined ? null : d; const b = $('ntAl'); if (b) b.innerHTML = alHTML(); }); }
const alU = x => (x.u || 'Ctn').toLowerCase();
function alGroups() {
  const g = new Map();
  for (const x of (alData?.items || [])) { const k = x.party || 'Supplier nahi pata'; if (!g.has(k)) g.set(k, { party: k, phone: '', items: [] }); const G = g.get(k); if (x.phone) G.phone = x.phone; G.items.push(x); }
  return [...g.values()].sort((a, b) => b.items.filter(x => x.lvl === 'red').length - a.items.filter(x => x.lvl === 'red').length || b.items.length - a.items.length);
}
function alOrderText(G) { return `*NOOR TRADERS — Order*\n${new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}\n\n` + G.items.map(x => `• ${x.n} — ${num(x.need)} ${alU(x)}`).join('\n') + '\n\nShukriya'; }
function alHTML() {
  if (!alData) return '';
  const can = (whoOf() || {}).role === 'owner' || (whoOf() || {}).scope === 'full';
  const gs = alGroups(), red = Number(alData.redN) || 0, yel = Number(alData.yellowN) || 0;
  const head = `<button type="button" class="al-head${red ? ' red' : ''}" data-al-toggle="1"><b>⏰ Khatam hone wala maal</b><span>${red ? `🔴 ${red}` : ''}${red && yel ? ' · ' : ''}${yel ? `🟡 ${yel}` : ''}${!red && !yel ? '✓ sab theek' : ''}</span><small>${esc(new Date(alData.at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))} · ${alOpen ? '▲' : '▼'}</small></button>`;
  if (!alOpen || !gs.length) return head + (!gs.length && alOpen ? `<p class="al-empty">Koi item ${alData.yellow || 7} din ke andar khatam nahi ho raha 🎉</p>` : '');
  return head + gs.map(G => { const op = alSupOpen.has(G.party), rN = G.items.filter(x => x.lvl === 'red').length;
    return `<div class="al-sup${rN ? ' red' : ''}"><button type="button" class="al-sh" data-al-sup="${esc(G.party)}"><b>🧾 ${esc(G.party)}</b><span>${rN ? `🔴 ${rN}` : ''}${G.items.length - rN ? ` 🟡 ${G.items.length - rN}` : ''}</span></button>
      ${op || gs.length <= 2 ? `<div class="al-items">${G.items.map(x => `<div class="al-it ${x.lvl}"><span class="al-nm"><b>${esc(x.n)}</b><small>stock ${num(x.have)} ${esc(alU(x))} · roz ~${x.daily} · ${x.lq ? `pichli dafa ${num(x.lq)} ${esc(alU(x))}${x.ld ? ' (' + esc(x.ld.slice(5)) + ')' : ''}` : 'pehli dafa'}</small></span><span class="al-dn">${x.left <= 0 ? '<b>khatam</b>' : `<b>${x.left}</b> din`}</span><span class="al-need">mangwao <b>${num(x.need)}</b> ${esc(alU(x))}</span></div>`).join('')}
      ${can ? `<div class="al-acts">${G.phone ? `<button type="button" class="al-wa" data-al-wa="${esc(G.party)}">📲 WhatsApp order</button>` : `<button type="button" class="al-wa" data-al-wa="${esc(G.party)}">📲 Order bhejo</button>`}<button type="button" class="al-add" data-al-add="${esc(G.party)}">➕ Order mein daalo</button></div>` : ''}</div>` : ''}</div>`; }).join('');
}
document.addEventListener('click', async e => {
  if (e.target.closest?.('[data-al-toggle]')) { alOpen = !alOpen; const b = $('ntAl'); if (b) b.innerHTML = alHTML(); return; }
  const sp = e.target.closest?.('[data-al-sup]'); if (sp) { const k = sp.dataset.alSup; if (alSupOpen.has(k)) alSupOpen.delete(k); else alSupOpen.add(k); const b = $('ntAl'); if (b) b.innerHTML = alHTML(); return; }
  const wa = e.target.closest?.('[data-al-wa]'); if (wa) { const G = alGroups().find(g => g.party === wa.dataset.alWa); if (!G) return; const t = alOrderText(G); try { await navigator.clipboard?.writeText(t); } catch {} window.open('https://wa.me/' + (G.phone || '') + '?text=' + encodeURIComponent(t), '_blank'); return; }
  const ad = e.target.closest?.('[data-al-add]'); if (ad) {
    const G = alGroups().find(g => g.party === ad.dataset.alAdd); if (!G) return;
    const w = whoOf() || {}; let o = poList[0];
    if (!o || o.lines.every(l => l.items.every(x => x.st !== 'open'))) o = { id: 'po' + Date.now().toString(36), at: Date.now(), by: String(w.uid || ''), byName: String(w.name || '').slice(0, 60), note: '⏰ khatam alert', lines: [] };
    let ln = o.lines.find(l => l.party === G.party); if (!ln) { ln = { party: G.party, items: [] }; o.lines.push(ln); }
    let n = 0; for (const x of G.items) { if (ln.items.some(y => String(y.i) === String(x.i) && y.st === 'open')) continue; ln.items.push({ i: String(x.i), n: String(x.n).slice(0, 60), q: x.need, u: x.u || '', st: 'open' }); n++; }
    try { await poSave(o); notice(n ? `✓ ${n} item order mein — neeche 🛒 Purchase order` : 'Yeh items pehle se order mein hain'); } catch (er) { notice('Nahi hua: ' + (er?.message || er)); }
    return;
  }
});
// ---------- v2.34: 🛒 PURCHASE ORDER — POS ki 6 mahine ki bikri/purchase (posStats) + stock -> AI -> supplier-wise chips ----------
// purchaseOrders/<id> {id, at, by, byName, note, lines:[{party, items:[{i, n, q, u, st:'open'|'got'|'gone'}]}]}
// Chip: DOUBLE TAP = "✓ Maal aa gaya" mein; wahan TAP = gayab. Ek tap = tadad badlo (0 = hatao).
let poList = [], poStop = null, poBusy = false, poTap = { id: '', t: 0 }, poStatsAt = 0, pdfOf = null;
const PO_SKIP = 'sam-po-skip', poNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// v2.99.29: order ki setting Firestore (stockConfig.po) mein — har phone par ek jaisi: {skipParties[], skipItems{id:naam}, safety}
let poCfg = null, poCfgStop = null, poStats = null, poTr = [];
try { poTr = JSON.parse(localStorage.getItem('sam-po-tr') || '[]') || []; } catch {}
const poOwner = () => (whoOf() || {}).role === 'owner';
function poCfgWatch() { if (poCfgStop || !cloud?.listenStockConfig) return; poCfgStop = cloud.listenStockConfig(c => { poCfg = (c && c.po) || {}; if (!Array.isArray(poCfg.skipParties) && poOwner() && cloud.setPoConfig) { const old = poSkipLocal(); cloud.setPoConfig({ ...poCfg, skipParties: old }).catch(() => {}); } const b = $('ntPo'); if (b) b.innerHTML = poHTML(); }); }
function poSkipLocal() { try { const a = JSON.parse(localStorage.getItem(PO_SKIP) || 'null'); return Array.isArray(a) ? a : ['our factory']; } catch { return ['our factory']; } }
function poSkip() { return Array.isArray(poCfg?.skipParties) ? poCfg.skipParties : poSkipLocal(); }
const poSkipItems = () => (poCfg?.skipItems && typeof poCfg.skipItems === 'object') ? poCfg.skipItems : {};
const poSafety = () => [3, 5, 7].includes(Number(poCfg?.safety)) ? Number(poCfg.safety) : 5;
async function poCfgSet(patch) { const next = { skipParties: poSkip(), skipItems: poSkipItems(), safety: poSafety(), ...patch }; poCfg = next; const b = $('ntPo'); if (b) b.innerHTML = poHTML(); if (cloud?.setPoConfig && poOwner()) await cloud.setPoConfig(next); }
function poSkipSet(a) { try { localStorage.setItem(PO_SKIP, JSON.stringify(a)); } catch {} poCfgSet({ skipParties: a }).catch(e => notice('⚠️ ' + (e?.message || e))); }
const poSkipped = party => { const p = poNorm(party); return poSkip().some(s => poNorm(s) && (p === poNorm(s) || p.includes(poNorm(s))) ); };
const poGodamTxt = it => it?.gs ? Object.entries(it.gs).map(([g, q]) => g + ': ' + num(q)).join(' · ') : '';
const poUnit = it => (Number(it.pack) || 0) > 1 ? (it.cName || 'Ctn') : (it.uName || 'Pcs');
function poWatch() { poCfgWatch(); if (poStop || !cloud?.listenPurchaseOrders) return; poStop = cloud.listenPurchaseOrders(l => { poList = (l || []).sort((a, b) => (b.at || 0) - (a.at || 0)); const b = $('ntPo'); if (b) b.innerHTML = poHTML(); }); }
function poHTML() {
  const o = poList[0], can = (whoOf() || {}).role === 'owner' || (whoOf() || {}).scope === 'full';
  const head = `<div class="po-head"><b>🛒 Purchase order</b>${poStatsAt ? `<small>data: ${esc(new Date(poStatsAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</small>` : ''}${can ? `<button type="button" class="got po-make" data-po-make="1"${poBusy ? ' disabled' : ''}>${poBusy ? '⏳ AI soch raha hai…' : '🤖 Order banao'}</button>` : ''}</div>`;
  const own = poOwner(), si = Object.entries(poSkipItems());
  const skipRow = `<div class="po-skip"><small>🚫 Order se bahar:</small>${poSkip().map(s => `<button type="button" class="po-skipchip" data-po-unskip="${esc(s)}"${own ? '' : ' disabled'}>${esc(s)} ✕</button>`).join('') || '<small>koi nahi</small>'}${si.length ? `<small class="po-sk2">📦 Band items ${si.length}:</small>${si.slice(0, 30).map(([id, nm]) => `<button type="button" class="po-skipchip it" data-po-unitem="${esc(id)}"${own ? '' : ' disabled'}>${esc(nm || id)} ✕</button>`).join('')}` : ''}</div>`
    + `<div class="po-set"><small>🛡 Bachat stock:</small>${[3, 5, 7].map(d => `<button type="button" class="rc${poSafety() === d ? ' on' : ''}" data-po-safety="${d}"${own ? '' : ' disabled'}>${d} din</button>`).join('')}<small class="po-hint">Formula: roz ki bikri (mahine ke rujhan ke saath) × (agla order + bachat) − stock · chip dabao = 🧮 poora hisaab</small></div>`;
  const trBox = poTr.length ? `<div class="po-tr"><div class="po-party">🚚 Godam se dukan mangwao<small>${poTr.reduce((n, g) => n + g.items.length, 0)}</small></div>${poTr.map((g, gi) => `<div class="po-trg"><small>${esc(g.from)} → ${esc(g.to)}</small><div class="po-chips">${g.items.map(x => `<span class="po-chip tr">${esc(x.n)}<b>${esc(num(x.units))} ${esc(x.u)}</b><i>dukan ${esc(num(x.dk))} din</i></span>`).join('')}</div>${own || (whoOf() || {}).scope === 'full' ? `<button type="button" class="got po-trgo" data-po-tr="${gi}">🚚 Transfer note banao (${g.items.length})</button>` : ''}</div>`).join('')}</div>` : '';
  const dm = dmOpen().length ? `<small class="po-meta">📢 ${dmOpen().length} demand khuli — "Order banao" par sab se upar aayengi</small>` : '';
  if (!o) return head + skipRow + dm + trBox + '<p class="po-empty">Abhi koi order nahi — "🤖 Order banao" dabayein.</p>';
  const open = [], got = [];
  o.lines.forEach((ln, li) => ln.items.forEach((x, ii) => { if (x.st === 'got') got.push([li, ii, x, ln.party]); }));
  const lines = o.lines.map((ln, li) => { const its = ln.items.map((x, ii) => [ii, x]).filter(([, x]) => x.st === 'open'); if (!its.length) return '';
    return `<div class="po-line${its.some(([, x]) => x.d) ? ' has-dm' : ''}"><div class="po-party">🧾 ${esc(ln.party || 'Supplier nahi pata')}<small>${its.length}</small><button type="button" class="po-noline" data-po-skip="${esc(ln.party || '')}" title="Is supplier ko order mein na lao">🚫</button></div><div class="po-chips">${its.map(([ii, x]) => `<button type="button" class="po-chip${x.d ? ' dm' : ''}" data-po-chip="${li}|${ii}">${esc(x.n)}<b>${esc(num(x.q))} ${esc(x.u || '')}</b>${x.d ? `<i>👦 ${esc(x.d)}</i>` : x.why ? `<i>${esc(x.why)}</i>` : ''}${x.ai ? `<i class="po-ai">🤖 ${esc(x.ai)}</i>` : ''}</button>`).join('')}</div></div>`; }).join('');
  return head + skipRow + `<small class="po-meta">${esc(new Date(o.at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))} · ${esc(o.byName || '')}${o.note ? ' · ' + esc(o.note) : ''} · <i>chip: 1 tap = 🧮 hisaab / tadad · DOUBLE TAP = maal aa gaya</i></small>`
    + (lines || '<p class="po-empty">Sab maal aa gaya 🎉</p>') + trBox
    + `<div class="po-acts"><button type="button" data-po-bazaar="1">🧾 Bazaar list · WhatsApp</button><button type="button" data-po-pdf="1">📄 PDF</button></div>`
    + (got.length ? `<div class="po-got"><div class="po-party">✓ Maal aa gaya<small>${got.length} · tap = hatao</small></div><div class="po-chips">${got.map(([li, ii, x]) => `<button type="button" class="po-chip got" data-po-gone="${li}|${ii}">${esc(x.n)}<b>${esc(num(x.q))} ${esc(x.u || '')}</b></button>`).join('')}</div></div>` : '');
}
async function poSave(o) { const i = poList.findIndex(x => x.id === o.id); if (i >= 0) poList[i] = o; else poList.unshift(o); const b = $('ntPo'); if (b) b.innerHTML = poHTML(); await cloud.savePurchaseOrder(o); }
// v2.99.29: FORMULA se order (po-formula.js) — AI sirf "dhyan" ki baat likhta hai, tadad formula ki
async function poStatsGet(force) { if (!force && poStats && Date.now() - poStats.got < 10 * 60000) return poStats; const st = await cloud.getPosStats(); poStatsAt = st.at || 0; poStats = { ...st, meta: st.meta || {}, byId: new Map(st.items.map(x => [String(x.i), x])), shop: shopIdx(st.items, st.meta || {}), got: Date.now() }; return poStats; }
function poDukan() { try { return stockAgentGodams().find(g => g.dukan)?.name || ''; } catch { return ''; } }
function poPlan(id, st) { const it = (stockOf() || new Map()).get(String(id)); if (!it) return null; return planItem(it, st.byId.get(String(id)) || {}, { meta: st.meta, shop: st.shop, safety: poSafety(), today: new Date(), dukan: poDukan() }); }
async function poMake() {
  if (poBusy) return; poBusy = true; const box = $('ntPo'); if (box) box.innerHTML = poHTML();
  try {
    const st = await poStatsGet(true);
    if (!st.items.length) throw Error('POS ka data abhi nahi aaya — dukan ke PC par SALE-DATA.bat ek dafa chalayein');
    const stock = stockOf() || new Map(), skipI = poSkipItems(), hid = { ...((() => { try { return saleStock().hidden || {}; } catch { return {}; } })()), ...((cloud.getStockHidden ? await cloud.getStockHidden() : null) || {}) };   // v2.99.31: stock screen khuli na ho tab bhi chhupe items bahar
    const cand = [], trs = new Map();
    const partyOf2 = (h, s) => h.bp.last?.party || s?.lp?.party || '';
    for (const d of dmOpen()) {   // 📢 mulazim ki demand — hamesha, sab se pehle
      const h = poPlan(d.i, st); if (!h) continue; const s = st.byId.get(String(d.i)) || {};
      const q = Math.max(1, h.q || Math.ceil(h.bp.aam || h.bp.last?.q || 1));
      cand.push({ h, q, party: partyOf2(h, s), d: (d.byName || 'mulazim') + ': ' + (d.lvl === 'out' ? 'khatam' : 'kam'), di: d.id });
    }
    for (const s of st.items) {
      const id = String(s.i); if (cand.some(c => c.h.id === id) || skipI[id] || hid[id] || !stock.has(id)) continue;
      const h = poPlan(id, st); if (!h || h.noSale) continue;
      if (h.order) cand.push({ h, q: h.q, party: partyOf2(h, s) });
      else if (h.transfer) { const k = h.transfer.from + '→' + h.transfer.to; if (!trs.has(k)) trs.set(k, { from: h.transfer.from, to: h.transfer.to, items: [] }); trs.get(k).items.push({ i: id, n: h.name.slice(0, 60), units: h.transfer.units, pcs: h.transfer.pcs, pk: h.pk, u: h.unit, dk: h.transfer.dkLeft }); }
    }
    poTr = [...trs.values()].map(g => ({ ...g, items: g.items.sort((a, b) => a.dk - b.dk).slice(0, 40) })); try { localStorage.setItem('sam-po-tr', JSON.stringify(poTr)); } catch {}
    const cand2 = cand.filter(c => c.d || !poSkipped(c.party));   // 🚫 our factory waghera (demand phir bhi)
    cand2.sort((a, b) => (b.d ? 1 : 0) - (a.d ? 1 : 0) || a.h.left - b.h.left);
    const top = cand2.slice(0, 120);
    if (!top.length) { notice(poTr.length ? '✓ Order ki zaroorat nahi — 🚚 godam se dukan mangwane wale items neeche' : 'Sab items ka stock kaafi hai — abhi order ki zaroorat nahi'); return; }
    // 🤖 AI: tadad nahi badalta — sirf ajeeb baat pakarta hai (bikri ruki / achanak barhi / mausami)
    const aiNote = new Map();
    if (aiOf) {
      const table = top.slice(0, 80).map(c => [c.h.id, c.h.name, c.h.unit, 'stock ' + c.h.have, 'roz ' + c.h.daily, c.h.left + ' din', 'order ' + c.q, 'mahine ' + (c.h.mo || []).join('/'), 'hafte ' + ((st.byId.get(c.h.id)?.w) || []).slice(0, 8).map(x => Math.round(x / c.h.pk * 10) / 10).join('/'), c.h.trend].join(' | ')).join('\n');
      const prompt = ['Tum Pakistani wholesale dukan ke purchase manager ho. Neeche order ki list hai — tadad formula ne nikali hai (roz ki bikri × din − stock).',
        'Sirf woh items batao jin mein kuch AJEEB hai: bikri achanak ruk gayi (shayad mat mangwao), achanak bohat barhi (zyada chahiye), mausami / ek dafa ki bikri. Baqi chhor do. Max 15.',
        'Har note 8 lafz tak, Roman Urdu. SIRF JSON: [{"id":"...","note":"..."}]', '', table].join('\n');
      try { const txt = await aiOf(prompt); const j = JSON.parse(String(txt).replace(/```json|```/g, '').trim().replace(/^[^\[]*/, '').replace(/[^\]]*$/, '')); if (Array.isArray(j)) for (const x of j.slice(0, 15)) if (x && x.id && x.note) aiNote.set(String(x.id), String(x.note).slice(0, 60)); } catch {}
    }
    const g = new Map();
    for (const c of top) { const k = c.party || 'Supplier nahi pata'; if (!g.has(k)) g.set(k, []); const it = { i: c.h.id, n: String(c.h.name).slice(0, 60), q: c.q, u: c.h.unit, st: 'open', why: c.h.have <= 0 ? 'stock 0' : Math.round(c.h.left) + ' din baqi' }; if (c.d) { it.d = c.d; it.di = c.di; } if (aiNote.has(c.h.id)) it.ai = aiNote.get(c.h.id); g.get(k).push(it); }
    const lines = [...g].map(([party, items]) => ({ party: party.slice(0, 80), items: items.slice(0, 40) })).sort((a, b) => (b.items.some(x => x.d) ? 1 : 0) - (a.items.some(x => x.d) ? 1 : 0) || b.items.length - a.items.length).slice(0, 30);
    const w = whoOf() || {};
    await poSave({ id: 'po' + Date.now().toString(36), at: Date.now(), by: String(w.uid || ''), byName: String(w.name || '').slice(0, 60), note: 'formula · bachat ' + poSafety() + ' din · ' + lines.reduce((n, l) => n + l.items.length, 0) + ' items' + (aiNote.size ? ' · 🤖 ' + aiNote.size + ' dhyan' : ''), lines });
    notice('🛒 Order ban gaya — ' + lines.length + ' supplier' + (poTr.length ? ' · 🚚 ' + poTr.reduce((n, x) => n + x.items.length, 0) + ' godam se' : ''));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  finally { poBusy = false; const b = $('ntPo'); if (b) b.innerHTML = poHTML(); }
}
// 🧮 ek item ka poora hisaab + tadad badlo + aainda band
async function poCard(li, ii) {
  const o = poList[0], x = o?.lines[li]?.items[ii]; if (!x) return;
  let L = null; try { const st = await poStatsGet(); const h = poPlan(x.i, st); if (h) L = hisaabLines(h, st.meta, new Date()); } catch (e) { L = [['⚠️', esc(e?.message || e)]]; }
  const it = (stockOf() || new Map()).get(String(x.i));
  dlgOf('🧮 ' + x.n, `<div class="po-hcard">${x.d ? `<div class="po-hrow dm"><span>👦</span><div>${esc(x.d)}</div></div>` : ''}${x.ai ? `<div class="po-hrow ai"><span>🤖</span><div>${esc(x.ai)}</div></div>` : ''}${(L || [['📦', 'Stock — ' + esc(poGodamTxt(it) || num(it?.stock || 0))]]).map(([k, v]) => `<div class="po-hrow"><span>${k}</span><div>${v}</div></div>`).join('')}</div>
    <form class="po-hform"><label>Kitna mangwana hai (${esc(x.u || '')})<input name="q" type="number" step="any" min="0" inputmode="decimal" value="${esc(String(x.q))}"></label><div class="po-hacts">${poOwner() ? `<button type="button" class="give" data-po-band="${esc(x.i)}">🚫 Aainda na mangwao</button>` : ''}<button type="submit" class="got">💾 Save</button></div><small class="stat-note">0 = is order se hatao</small></form>`);
  const f = document.querySelector('#dialogBody .po-hform'); if (!f) return;
  f.onsubmit = ev => { ev.preventDefault(); const n = Number(f.elements.q.value); if (!Number.isFinite(n) || n < 0) return; if (n === 0) x.st = 'gone'; else x.q = Math.round(n * 100) / 100; closeDlg(); poSave(o).catch(er => notice('⚠️ ' + (er?.message || er))); };
  const band = f.querySelector('[data-po-band]'); if (band) band.onclick = async () => { if (!confirm('"' + x.n + '" aainda kisi order mein na aaye?\n(Upar "📦 Band items" se wapas la sakte hain)')) return; x.st = 'gone'; closeDlg(); try { await poCfgSet({ skipItems: { ...poSkipItems(), [x.i]: x.n } }); await poSave(o); notice('🚫 ' + x.n + ' — aainda order mein nahi aayega'); } catch (er) { notice('⚠️ ' + (er?.message || er)); } };
}
async function poTransfer(gi) {
  const g = poTr[gi]; if (!g) return;
  const gd = (() => { try { return stockAgentGodams(); } catch { return []; } })(), from = gd.find(x => x.name === g.from), to = gd.find(x => x.name === g.to);
  if (!from || !to) { notice('Godam nahi mila — stock screen se transfer karein'); return; }
  if (!confirm(`🚚 ${g.from} → ${g.to}\n\n${g.items.map(x => '• ' + x.n + ' — ' + num(x.units) + ' ' + x.u).join('\n')}\n\nTransfer note bana dein? (POS mein bhi banega)`)) return;
  notice('⏳ Transfer note ban raha hai…');
  try {
    const r = await stockAgentTransfer({ from: from.id, to: to.id, lines: g.items.map(x => x.pk > 1 ? { id: x.i, name: x.n, ctn: Math.floor(x.pcs / x.pk), pcs: Math.round((x.pcs - Math.floor(x.pcs / x.pk) * x.pk) * 1000) / 1000 } : { id: x.i, name: x.n, pcs: x.pcs }), note: 'Order screen: godam se dukan' });
    if (r.ok) { poTr.splice(gi, 1); try { localStorage.setItem('sam-po-tr', JSON.stringify(poTr)); } catch {} notice('✓ Transfer note ' + (r.no || '') + ' ban gaya'); }
    else notice((r.pending ? '⏳ ' : '⚠️ ') + (r.why || 'Transfer nahi bana'));
  } catch (e) { notice('⚠️ ' + (e?.message || e)); }
  const b = $('ntPo'); if (b) b.innerHTML = poHTML();
}
function poBazaarText(o) { return '🧾 Bazaar list — ' + new Date(o.at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) + '\n' + o.lines.map(ln => { const its = ln.items.filter(x => x.st === 'open'); return its.length ? '\n*' + (ln.party || 'Supplier nahi pata') + '*\n' + its.map(x => '• ' + x.n + ' — ' + num(x.q) + ' ' + (x.u || '') + (x.d ? ' (👦 ' + x.d + ')' : '')).join('\n') : ''; }).filter(Boolean).join('\n'); }
document.addEventListener('click', async e => {
  if (e.target.closest?.('[data-po-make]')) { poMake(); return; }
  const sk = e.target.closest?.('[data-po-skip]'); if (sk) { const p = sk.dataset.poSkip || 'Supplier nahi pata'; if (!confirm('"' + p + '" ko aainda order se bahar rakhein?')) return; const a = poSkip(); if (!a.some(s => poNorm(s) === poNorm(p))) a.push(p); poSkipSet(a); const o = poList[0]; if (o) { o.lines = o.lines.filter(l => !poSkipped(l.party)); poSave(o).catch(() => {}); } else { const b = $('ntPo'); if (b) b.innerHTML = poHTML(); } return; }
  const sf = e.target.closest?.('[data-po-safety]'); if (sf) { poCfgSet({ safety: Number(sf.dataset.poSafety) }).then(() => notice('🛡 Bachat ' + sf.dataset.poSafety + ' din — agla "Order banao" is se')).catch(er => notice('⚠️ ' + (er?.message || er))); return; }
  const ui = e.target.closest?.('[data-po-unitem]'); if (ui) { const m = { ...poSkipItems() }; delete m[ui.dataset.poUnitem]; poCfgSet({ skipItems: m }).catch(er => notice('⚠️ ' + (er?.message || er))); return; }
  const tg = e.target.closest?.('[data-po-tr]'); if (tg) { poTransfer(Number(tg.dataset.poTr)); return; }
  const us = e.target.closest?.('[data-po-unskip]'); if (us) { poSkipSet(poSkip().filter(s => s !== us.dataset.poUnskip)); const b = $('ntPo'); if (b) b.innerHTML = poHTML(); return; }
  if (e.target.closest?.('[data-po-bazaar]')) { const o = poList[0]; if (!o) return; const t = poBazaarText(o); try { await navigator.clipboard?.writeText(t); } catch {} if (navigator.share) { try { await navigator.share({ text: t }); return; } catch {} } window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank'); return; }
  if (e.target.closest?.('[data-po-pdf]')) { const o = poList[0]; if (!o || !pdfOf) return; pdfOf(`<h1>NOOR TRADERS</h1><h2>🧾 Bazaar list · ${esc(new Date(o.at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }))}</h2>` + o.lines.map(ln => { const its = ln.items.filter(x => x.st === 'open'); return its.length ? `<h3>${esc(ln.party || 'Supplier nahi pata')}</h3><table class="iv-tbl"><tbody>${its.map(x => `<tr><td>${esc(x.n)}${x.d ? ' <small>👦 ' + esc(x.d) + '</small>' : ''}</td><td class="iv-n">${esc(num(x.q))} ${esc(x.u || '')}</td><td>☐</td></tr>`).join('')}</tbody></table>` : ''; }).join(''), 'Bazaar list'); return; }
  const g = e.target.closest?.('[data-po-gone]'); if (g) { const o = poList[0]; if (!o) return; const [li, ii] = g.dataset.poGone.split('|').map(Number); const x = o.lines[li]?.items[ii]; if (!x) return; x.st = 'gone'; poSave(o).catch(er => notice('⚠️ ' + (er?.message || er))); return; }
  const c = e.target.closest?.('[data-po-chip]'); if (!c) return;
  const o = poList[0]; if (!o) return; const [li, ii] = c.dataset.poChip.split('|').map(Number), x = o.lines[li]?.items[ii]; if (!x) return;
  const now = Date.now();
  if (poTap.id === c.dataset.poChip && now - poTap.t < 400) { clearTimeout(poTap.timer); poTap = { id: '', t: 0 }; x.st = 'got'; if (x.di) { const d = dmList.find(z => z.id === x.di); if (d && d.st === 'open') { d.st = 'done'; cloud.saveDemand(d).catch(() => {}); } } try { navigator.vibrate?.(40); } catch {} poSave(o).then(() => notice('✓ ' + x.n + ' — maal aa gaya')).catch(er => notice('⚠️ ' + (er?.message || er))); return; }
  clearTimeout(poTap.timer);
  poTap = { id: c.dataset.poChip, t: now, timer: setTimeout(() => { poTap = { id: '', t: 0 }; poCard(li, ii); }, 420) };   // v2.99.29: 1 tap = 🧮 hisaab card
});

// ---------- notes likhna ----------
async function saveNote(n, old) {
  const w = whoOf() || {};
  const now = Date.now();
  const d = {
    id: String(n.id || old?.id || ID()), kind: n.kind || old?.kind || 'note', text: String(n.text ?? old?.text ?? '').slice(0, 1000),
    items: (n.items ?? old?.items ?? []).slice(0, 20).map(x => ({ id: String(x.id || '').slice(0, 60), name: String(x.name || '').slice(0, 80) })),
    partyId: String(n.partyId ?? old?.partyId ?? '').slice(0, 120), partyName: String(n.partyName ?? old?.partyName ?? '').slice(0, 120),
    amount: Math.round(Number(n.amount ?? old?.amount ?? 0)) || 0, transferId: String(n.transferId ?? old?.transferId ?? '').slice(0, 100),
    remindDay: String(n.remindDay ?? old?.remindDay ?? '').slice(0, 10), remindTime: String(n.remindTime ?? old?.remindTime ?? '').slice(0, 5),
    allDay: !!(n.allDay ?? old?.allDay), done: !!(n.done ?? old?.done), doneAt: Number(n.doneAt ?? old?.doneAt ?? 0) || 0,
    contactName: String(n.contactName ?? old?.contactName ?? '').slice(0, 80), contactPhone: cleanPhone(n.contactPhone ?? old?.contactPhone ?? ''),   // v2.25
    hasPic: !!(n.hasPic ?? old?.hasPic), by: old?.by || String(w.uid || ''), byName: String(old?.byName || w.name || '').slice(0, 60),
    createdAt: old?.createdAt || now, updatedBy: String(w.uid || ''), updatedAt: now, deleted: !!n.deleted,
  };
  { const g = nagOk(n.nag ?? old?.nag); if (g && d.remindDay) d.nag = g; }   // v2.99.27: 🔁 baar baar yaad (rules 2.37) — 0 ho to khana hi nahi
  const i = notes.findIndex(x => x.id === d.id); if (i >= 0) notes[i] = d; else notes.push(d);   // foran screen par
  if ($('ntRoot')) paint();
  await cloud.saveNote(d);
  return d;
}
async function shrink(file) {
  return new Promise(res => { let url = ''; try { url = URL.createObjectURL(file); } catch { res(''); return; }
    const img = new Image(); img.onload = () => { try { const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight, 1)); const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.7, out = c.toDataURL('image/jpeg', q); while (out.length > 250000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); } res(out.length <= 300000 ? out : ''); } catch { res(''); } try { URL.revokeObjectURL(url); } catch {} };
    img.onerror = () => { try { URL.revokeObjectURL(url); } catch {} res(''); }; img.src = url; });
}
function loadPics(n) {
  if (!n.hasPic || pics.has(n.id) || picLoad.has(n.id) || !cloud?.getPhotos) return;
  picLoad.add(n.id);
  Promise.resolve(cloud.getPhotos('n-' + n.id)).then(ph => { pics.set(n.id, Array.isArray(ph?.photos) ? ph.photos : []); if ($('ntRoot')) paint(); }).catch(() => pics.set(n.id, [])).finally(() => picLoad.delete(n.id));
}
export function noteForm(existing = null, preset = {}) {
  const n = existing || { kind: 'note', text: preset.text || '', items: [], remindDay: preset.day || '', remindTime: '', allDay: false };
  const base = existing || { partyId: preset.partyId || '', partyName: preset.partyName || '', amount: preset.amount || 0 };   // v2.99.58: HBL card se
  let chosen = [...(n.items || [])], picsNow = existing ? [...(pics.get(existing.id) || [])] : [], picsDirty = false;
  dlgOf(existing ? '✏️ Note badlein' : '📝 Naya note', `<form class="nt-form">
    <label>Note<textarea name="text" maxlength="1000" rows="3" placeholder="kya yaad rakhna hai…">${esc(n.text || '')}</textarea></label>
    <label>Item jorein (stock se)<input id="nfItemQ" type="search" autocomplete="off" placeholder="🔍 item ka naam…"></label><div class="nt-pick" id="nfItemList"></div>
    <div class="nt-chips" id="nfItems"></div>
    <div class="nt-when"><label>Reminder din<input name="day" type="date" value="${esc(n.remindDay || '')}"></label><label>Waqt<input name="time" type="time" value="${esc(n.remindTime || '')}"></label></div>
    <div class="mchips">${[[0, 'Aaj'], [1, 'Kal'], [2, '2 din'], [7, 'Hafta'], ['x', 'Reminder nahi']].map(([d, l]) => `<button type="button" class="rc" data-nf-day="${d}">${l}</button>`).join('')}<label class="nt-allday"><input type="checkbox" name="allDay"${n.allDay ? ' checked' : ''}> Poora din</label></div>
    <div class="nt-nag"><b>🔁 Baar baar yaad dilao</b><div class="mchips">${[0, ...NAGS].map(v => `<button type="button" class="rc${nagOk(n.nag) === v ? ' on' : ''}" data-nf-nag="${v}">${v ? 'Har ' + nagTxt(v) : 'Band'}</button>`).join('')}</div><small>Waqt aane ke baad jab tak ✓ na karein, phone par notification aati rahegi (subah 7 – raat 11).</small><input type="hidden" name="nag" value="${nagOk(n.nag)}"></div>
    ${contactBox('nf', n.contactName, n.contactPhone)}
    <label>Tasveer (2 tak)<input name="pics" type="file" accept="image/*" multiple></label><div class="nt-thumbs" id="nfPics"></div>
    <div class="nt-formacts">${existing ? '<button type="button" class="give" data-nf-del="1">🗑 Hatao</button>' : ''}<button type="submit" class="got">💾 Save</button></div></form>`);
  const f = document.querySelector('#dialogBody form');
  wireContact(f, 'nf');   // v2.25
  const paintItems = () => { $('nfItems').innerHTML = chosen.map((it, i) => `<span class="nt-chip">${esc(it.name)}<button type="button" data-nf-rm="${i}">×</button></span>`).join(''); };
  const paintPics = () => { $('nfPics').innerHTML = picsNow.map((p, i) => `<span class="nt-thumb"><img src="${p}" alt=""><button type="button" data-nf-prm="${i}">×</button></span>`).join(''); };
  paintItems(); paintPics();
  $('nfItemQ').oninput = () => { const q = $('nfItemQ').value.trim(); const hits = q.length >= 2 ? smartSearch(itemsOf() || [], q, 8) : [];
    $('nfItemList').innerHTML = hits.map(r => `<button type="button" data-nf-it="${esc(r.id)}">${esc(r.name)}${r.code ? ' <small>' + esc(r.code) + '</small>' : ''}</button>`).join(''); };
  f.elements.pics.onchange = async () => { const fl = [...(f.elements.pics.files || [])].slice(0, 2 - picsNow.length); for (const x of fl) { const s = await shrink(x); if (s) picsNow.push(s); } picsNow = picsNow.slice(0, 2); picsDirty = true; paintPics(); f.elements.pics.value = ''; };
  f.addEventListener('click', async e => {
    const t = e.target.closest('[data-nf-it],[data-nf-rm],[data-nf-day],[data-nf-prm],[data-nf-del],[data-nf-nag]'); if (!t) return;
    const d = t.dataset;
    if (d.nfIt) { const r = (itemsOf() || []).find(x => String(x.id) === d.nfIt); if (r && !chosen.some(c => c.id === String(r.id))) chosen.push({ id: String(r.id), name: String(r.name).slice(0, 80) }); $('nfItemQ').value = ''; $('nfItemList').innerHTML = ''; paintItems();
      const ta = f.elements.text; if (r && !ta.value.includes(r.name)) ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + r.name; return; }
    if (d.nfNag != null) { f.elements.nag.value = d.nfNag; f.querySelectorAll('[data-nf-nag]').forEach(b => b.classList.toggle('on', b === t)); if (Number(d.nfNag) && !f.elements.day.value) f.elements.day.value = addDays(0); return; }
    if (d.nfRm != null) { chosen.splice(Number(d.nfRm), 1); paintItems(); return; }
    if (d.nfPrm != null) { picsNow.splice(Number(d.nfPrm), 1); picsDirty = true; paintPics(); return; }
    if (d.nfDay != null) { if (d.nfDay === 'x') { f.elements.day.value = ''; f.elements.time.value = ''; } else f.elements.day.value = addDays(Number(d.nfDay)); return; }
    if (d.nfDel) { if (!confirm('Ye note hata dein?')) return; try { await saveNote({ ...existing, deleted: true }, existing); notes = notes.filter(x => x.id !== existing.id); closeDlg(); paint(); notice('🗑 Note hat gaya'); } catch (er) { notice('⚠️ ' + (er?.message || er)); } }
  });
  f.onsubmit = async e => {
    e.preventDefault(); const b = f.querySelector('[type=submit]'); if (b.disabled) return;
    const text = f.elements.text.value.trim();
    if (!text && !chosen.length && !picsNow.length && !f.elements.ctPhone.value.trim()) { notice('Kuch likhein'); return; }
    b.disabled = true;
    try {
      const d = await saveNote({ ...base, contactName: f.elements.ctName.value.trim(), contactPhone: f.elements.ctPhone.value, text, items: chosen, remindDay: f.elements.day.value || '', remindTime: f.elements.time.value || '', allDay: !!f.elements.allDay.checked, hasPic: picsNow.length > 0, nag: f.elements.day.value ? nagOk(f.elements.nag.value) : 0 }, existing);
      if (picsDirty && cloud.putPhotos) { pics.set(d.id, picsNow); cloud.putPhotos('n-' + d.id, picsNow).catch(er => notice('⚠️ Tasveer save nahi hui: ' + (er?.message || er))); }
      closeDlg(); notice((existing ? '✓ Note badal gaya' : '📝 Note save') + (d.remindDay ? ' · 🔔 ' + nice(d.remindDay) + (d.remindTime ? ' ' + t12(d.remindTime) : '') : '') + (d.nag ? ' · 🔁 har ' + nagTxt(d.nag) : ''));
    } catch (er) { b.disabled = false; notice('⚠️ ' + (er?.message || er)); }
  };
}

// ---------- screen ----------
function dueParty() {
  const today = dayOf();
  return (recordsOf() || []).filter(r => r && r.type === 'reminder' && !r.deleted && r.dueDate && r.dueDate <= addDays(1)).map(r => ({ r, p: partyOf(r.partyId) })).filter(x => x.p && !x.p.deleted)
    .sort((a, b) => (a.r.dueDate + (a.r.dueTime || '')).localeCompare(b.r.dueDate + (b.r.dueTime || ''))).map(x => ({ ...x, late: x.r.dueDate < today }));
}
const matchQ = (n, q) => !q || [n.text, n.partyName, n.contactName, n.contactPhone, ...(n.items || []).map(i => i.name), n.remindDay, n.amount ? String(Math.round(n.amount / 100)) : ''].join(' ').toLowerCase().includes(q) || smartHit([n.text, n.partyName, n.contactName, ...(n.items || []).map(i => i.name)].join(' '), q);
function listFor(tab) {
  const today = dayOf(), q = fQ.trim().toLowerCase();
  let l = notes.filter(n => matchQ(n, q));
  if (tab === 'open') l = l.filter(n => !n.done);
  else if (tab === 'today') l = l.filter(n => !n.done && n.remindDay && n.remindDay <= today);
  else if (tab === 'next') l = l.filter(n => !n.done && n.remindDay > today);
  else if (tab === 'late') l = l.filter(n => !n.done && n.remindDay && n.remindDay < today);
  else if (tab === 'order') l = l.filter(n => n.kind === 'order' && !n.done);
  else if (tab === 'done') l = l.filter(n => n.done);
  const key = n => (n.done ? '2' : n.remindDay ? '0' + n.remindDay + (n.remindTime || '99') : '1') + String(9e15 - (n.updatedAt || 0));
  return l.sort((a, b) => key(a).localeCompare(key(b)));
}
export function renderNotes() {
  $('summary').innerHTML = '<div class="nt-root" id="ntRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = `<button class="got" data-nt-new="1">📝 Naya note</button>${payOf ? '<button data-nt-hbl="1">💸 HBL payment</button>' : ''}`;
  paint();
  pushStatus();
  if (!pushCfg && cloud?.getPushConfig) cloud.getPushConfig().then(c => { pushCfg = c || {}; gcPaint(); }).catch(() => {});
}
function card(n) {
  loadPics(n);
  const today = dayOf(), late = !n.done && n.remindDay && n.remindDay < today, now = !n.done && n.remindDay === today;
  const ph = pics.get(n.id) || [];
  return `<div class="nt-card${n.done ? ' done' : ''}${selMode && sel.has(n.id) ? ' picked' : ''}${animating.has(n.id) ? ' anim' : ''}${late ? ' late' : ''}${n.kind === 'order' ? ' order' : ''}" data-nt-id="${esc(n.id)}">
    ${selMode ? `<label class="nt-check nt-sel"><input type="checkbox" data-nt-sel="${esc(n.id)}"${sel.has(n.id) ? ' checked' : ''}><span></span></label>` : `<label class="nt-check"><input type="checkbox" data-nt-done="${esc(n.id)}"${n.done ? ' checked' : ''}><span></span></label>`}
    <div class="nt-body" data-nt-edit="${esc(n.id)}">
      ${n.kind === 'order' ? `<div class="nt-order">🧾 <b>${esc(n.partyName || '')}</b><span class="nt-amt">${rsP(n.amount)}</span><span class="nt-tag">HBL · maal aana baqi</span></div>` : ''}
      ${callBtns(n)}
      ${n.text ? `<div class="nt-text">${esc(n.text)}</div>` : ''}
      ${(n.items || []).length ? `<div class="nt-chips">${n.items.map(i => `<span class="nt-chip it">📦 ${esc(i.name)}</span>`).join('')}</div>` : ''}
      ${ph.length ? `<div class="nt-thumbs">${ph.map((p, i) => `<span class="nt-thumb" data-nt-pic="${esc(n.id)}|${i}"><img src="${p}" alt=""></span>`).join('')}</div>` : (n.hasPic ? '<small class="nt-meta">🖼 tasveer aa rahi hai…</small>' : '')}
      <div class="nt-meta">${n.remindDay ? `<span class="nt-when-chip${late ? ' late' : now ? ' now' : ''}">🔔 ${esc(nice(n.remindDay))}${n.remindTime ? ' · ' + esc(t12(n.remindTime)) : n.allDay ? ' · poora din' : ''}</span>` : ''}${n.nag && !n.done ? `<span class="nt-nag-chip">🔁 har ${esc(nagTxt(n.nag))}</span>` : ''}<span>${esc(n.byName || '')}</span>${n.done && n.doneAt ? `<span>✓ ${esc(nice(dayOf(n.doneAt)))}</span>` : ''}</div>
    </div></div>`;
}
function paint() {
  const root = $('ntRoot'); if (!root) return;
  const due = dueParty(), l = listFor(fTab), cnt = t => listFor(t).length;
  poWatch(); dmWatch();
  root.innerHTML = `<div class="nt-push" id="ntPush"></div>
    <label class="nt-search"><input type="search" placeholder="🔍 note, item, supplier, raqam…" value="${esc(fQ)}" data-nt-q="1"></label>
    <div class="mchips nt-tabs">${[['open', 'Sab khule'], ['today', '🔔 Aaj'], ['late', '⏰ Guzar gaye'], ['next', 'Aane wale'], ['order', '🧾 Order'], ['done', '✓ Ho gaye']].map(([k, lab]) => `<button type="button" class="rc${fTab === k ? ' on' : ''}" data-nt-tab="${k}">${lab} ${cnt(k)}</button>`).join('')}<button type="button" class="rc nt-selbtn${selMode ? ' on' : ''}" data-nt-selmode="1">${selMode ? '✕ Chunna band' : '☑ Kai chunein'}</button></div>
    <div class="nt-list">${l.map(card).join('') || `<div class="nt-empty">📝<b>${fQ ? 'Kuch nahi mila' : fTab === 'done' ? 'Abhi koi ho gaya note nahi' : 'Koi khula note nahi'}</b><small>Neeche "📝 Naya note" dabayein</small></div>`}</div>${selMode ? bulkHTML(l) : ''}
    ${due.length && fTab !== 'done' ? `<div class="nt-sec"><h3>📒 Accounts ke due</h3>${due.map(x => `<button type="button" class="nt-due${x.late ? ' late' : ''}" data-nt-party="${esc(x.p.id)}"><b>${esc(x.p.name)}</b><span>${esc(nice(x.r.dueDate))}${x.r.dueTime ? ' · ' + esc(t12(x.r.dueTime)) : ''}</span>${x.r.note ? `<small>${esc(x.r.note)}</small>` : ''}</button>`).join('')}</div>` : ''}
    <div class="al-box" id="ntAl">${alHTML()}</div><div class="po-box" id="ntPo">${poHTML()}</div><div id="ntGc">${gcLoad().accounts.length ? gcCardHTML() : ''}</div>`;
  pushStatus();
}
// ---------- v2.99.27: ☑ KAI NOTES EK SAATH — din / waqt / baar baar / ho gaye ----------
let bkDay = '', bkTime = '', bkNag = -1;   // -1 = jo hai wahi
function bulkHTML(l) {
  const n = [...sel].filter(id => notes.some(x => x.id === id)).length, all = l.length && l.every(x => sel.has(x.id));
  const dayBtn = (v, lab) => `<button type="button" class="rc${bkDay === v ? ' on' : ''}" data-bk-day="${v}">${lab}</button>`;
  return `<div class="nt-bulk"><div class="nt-bk-top"><b>☑ ${n} chune</b><button type="button" class="nt-link" data-bk-all="1">${all ? 'Koi nahi' : 'Sab chuno (' + l.length + ')'}</button></div>
    <div class="mchips">${dayBtn(addDays(0), 'Aaj')}${dayBtn(addDays(1), 'Kal')}${dayBtn(addDays(2), 'Parson')}${dayBtn('', 'Din wahi')}<label class="nt-bk-in">📅<input type="date" data-bk-date="1" value="${esc(bkDay)}"></label><label class="nt-bk-in">⏰<input type="time" data-bk-time="1" value="${esc(bkTime)}"></label></div>
    <div class="mchips"><span class="nt-bk-lab">🔁</span>${[[-1, 'Wahi'], [0, 'Band'], ...NAGS.map(v => [v, nagTxt(v)])].map(([v, lab]) => `<button type="button" class="rc${bkNag === v ? ' on' : ''}" data-bk-nag="${v}">${lab}</button>`).join('')}</div>
    <div class="nt-bk-acts"><button type="button" class="give" data-bk-done="1"${n && !bulkBusy ? '' : ' disabled'}>✓ Sab ho gaye</button><button type="button" class="got" data-bk-go="1"${n && !bulkBusy ? '' : ' disabled'}>${bulkBusy ? '⏳ Lag raha hai…' : `🔔 ${n} notes par lagao`}</button></div></div>`;
}
// sab notes ek ek kar ke (har note apni rules check) — natija: kitne hue / kitne nahi
export async function bulkApply(ids, { day = null, time = null, nag = -1, done = false } = {}) {
  let ok = 0; const fail = [];
  for (const id of ids) {
    const o = notes.find(x => x.id === id); if (!o) continue;
    const patch = { ...o };
    if (done) { patch.done = true; patch.doneAt = Date.now(); }
    else {
      if (day) patch.remindDay = day;
      if (time != null) { patch.remindTime = time; if (time) patch.allDay = false; }
      if (nag >= 0) patch.nag = nag;
      if (patch.done && day) { patch.done = false; patch.doneAt = 0; }   // naya din = phir khula
    }
    try { await saveNote(patch, o); ok++; } catch (e) { fail.push(String(o.text || o.partyName || id).slice(0, 30) + ': ' + (e?.message || e)); }
  }
  badge(); return { ok, fail };
}
async function bulkGo(done) {
  const ids = [...sel].filter(id => notes.some(x => x.id === id)); if (!ids.length || bulkBusy) return;
  if (!done && !bkDay && !bkTime && bkNag < 0) { notice('Pehle din, waqt ya 🔁 chunein'); return; }
  if (done && !confirm(ids.length + ' notes "ho gaye" kar dein?')) return;
  bulkBusy = true; paint();
  const r = await bulkApply(ids, done ? { done: true } : { day: bkDay || null, time: bkTime || null, nag: bkNag });
  bulkBusy = false; sel = new Set(); selMode = false; bkDay = ''; bkTime = ''; bkNag = -1; paint();
  notice(r.fail.length ? `⚠️ ${r.ok} hue · ${r.fail.length} nahi: ${r.fail[0]}` : done ? `✓ ${r.ok} notes ho gaye` : `🔔 ${r.ok} notes badal gaye`);
}
async function toggleDone(id, on) {
  const n = notes.find(x => x.id === id); if (!n) return;
  animating.add(id); paint();
  setTimeout(async () => {
    animating.delete(id);
    try { await saveNote({ ...n, done: on, doneAt: on ? Date.now() : 0 }, n); if (on) notice('✓ ' + (n.partyName || n.text || 'Note').slice(0, 40)); }
    catch (er) { notice('⚠️ ' + (er?.message || er)); paint(); }
  }, 650);
}
document.addEventListener('click', e => {
  const nw = e.target.closest?.('[data-nt-new],[data-nt-hbl],[data-hbl-pay]');
  if (nw) { if (nw.dataset.ntNew) noteForm(); else hblPayForm(); return; }
  if (!$('ntRoot')) return;
  const bk = e.target.closest?.('[data-nt-selmode],[data-bk-all],[data-bk-day],[data-bk-nag],[data-bk-go],[data-bk-done]');
  if (bk) { const b = bk.dataset;
    if (b.ntSelmode) { selMode = !selMode; sel = new Set(); bkDay = ''; bkTime = ''; bkNag = -1; }
    else if (b.bkAll) { const l = listFor(fTab); sel = l.length && l.every(x => sel.has(x.id)) ? new Set() : new Set(l.map(x => x.id)); }
    else if (b.bkDay != null) bkDay = b.bkDay;
    else if (b.bkNag != null) bkNag = Number(b.bkNag);
    else if (b.bkGo) { bulkGo(false); return; }
    else if (b.bkDone) { bulkGo(true); return; }
    paint(); return; }
  const t = e.target.closest?.('[data-nt-tab],[data-nt-edit],[data-nt-party],[data-nt-pic],[data-nt-push],[data-nt-vapid]'); if (!t) return;
  const d = t.dataset;
  if (d.ntTab) { fTab = d.ntTab; paint(); return; }
  if (d.ntParty) { routeTo('khata', d.ntParty); return; }
  if (d.ntPic) { const [id, i] = d.ntPic.split('|'); const p = (pics.get(id) || [])[Number(i)]; if (p) dlgOf('🖼 Tasveer', `<img src="${p}" alt="" style="width:100%;border-radius:12px">`); return; }
  if (d.ntPush) { enablePush(); return; }
  if (d.ntVapid) { vapidForm(); return; }
  if (d.ntEdit && selMode) { if (e.target.closest('[data-nt-stop]')) return; sel.has(d.ntEdit) ? sel.delete(d.ntEdit) : sel.add(d.ntEdit); paint(); return; }   // chunne mein card dabana = chuno
  if (d.ntEdit) { if (e.target.closest('.nt-thumb') || e.target.closest('[data-nt-stop]')) return; const n = notes.find(x => x.id === d.ntEdit); if (n) noteForm(n); }
});
document.addEventListener('change', e => {
  const s = e.target.closest?.('[data-nt-sel]'); if (s) { s.checked ? sel.add(s.dataset.ntSel) : sel.delete(s.dataset.ntSel); paint(); return; }
  if (e.target.matches?.('[data-bk-date]')) { bkDay = e.target.value || ''; paint(); return; }
  if (e.target.matches?.('[data-bk-time]')) { bkTime = e.target.value || ''; paint(); return; }
  const c = e.target.closest?.('[data-nt-done]'); if (c) toggleDone(c.dataset.ntDone, c.checked); });
document.addEventListener('input', e => { if (e.target.matches?.('[data-nt-q]')) { fQ = e.target.value || ''; paint(); const q = document.querySelector('[data-nt-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });

// ---------- notification (push) ----------
function pushStatus() {
  const box = $('ntPush'); if (!box) return;
  const w = whoOf() || {};
  const ok = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  if (!ok) { box.innerHTML = '<div class="nt-pushcard off">🔕 Is browser mein notification nahi chalti — Chrome mein kholein aur "Install app" karein.</div>'; return; }
  if (Notification.permission === 'granted' && pushState === 'ok') { box.innerHTML = '<div class="nt-pushcard ok">🔔 Notification chalu — waqt aane par phone par aayegi (app band ho tab bhi).</div>'; return; }
  if (Notification.permission === 'denied') { box.innerHTML = '<div class="nt-pushcard off">🔕 Notification band hai — phone Settings → Apps → Chrome/Blue Khata → Notifications → On.</div>'; return; }
  box.innerHTML = `<div class="nt-pushcard"><b>🔔 App band ho tab bhi reminder aaye?</b><small>Ek dafa dabayein, phir "Allow".</small><button type="button" class="got" data-nt-push="1">🔔 Notification chalu karein</button>${w.role === 'owner' ? '<button type="button" class="nt-link" data-nt-vapid="1">⚙️ Push key (sirf malik, ek dafa)</button>' : ''}</div>`;
  if (Notification.permission === 'granted' && !pushState) enablePush(true);
}
function vapidForm() {
  dlgOf('⚙️ Push key (Firebase)', `<form class="nt-form"><p class="stat-note">Firebase console → ⚙️ Project settings → <b>Cloud Messaging</b> → "Web Push certificates" → <b>Generate key pair</b> → wo lambi key yahan paste karein.</p>
    <label>Key pair (public key)<input name="k" autocomplete="off" required minlength="40" placeholder="B..."></label><button type="submit" class="got">Save</button></form>`);
  const f = document.querySelector('#dialogBody form');
  f.onsubmit = async e => { e.preventDefault(); try { await cloud.setPushConfig({ vapidKey: f.elements.k.value }); pushCfg = null; closeDlg(); notice('✓ Push key save — ab "Notification chalu karein" dabayein'); } catch (er) { notice('⚠️ ' + (er?.message || er)); } };
}
async function enablePush(quiet) {
  try {
    pushState = 'wait';
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { pushState = ''; pushStatus(); return; }
    pushCfg = pushCfg || await cloud.getPushConfig();
    if (!pushCfg?.vapidKey) { pushState = ''; if (!quiet) notice('Pehle malik "⚙️ Push key" save kare'); pushStatus(); return; }
    const reg = await navigator.serviceWorker.ready;
    const w = whoOf() || {};
    await cloud.pushRegister(pushCfg.vapidKey, reg, { name: w.name || (w.role === 'owner' ? 'Malik' : 'Mulazim'), role: w.role, scope: w.scope });
    pushState = 'ok'; if (!quiet) notice('🔔 Notification chalu ho gayi');
  } catch (er) { pushState = ''; if (!quiet) notice('⚠️ Notification: ' + (er?.message || er)); }
  pushStatus();
}

// ---------- v2.99.8: 🤖 NOOR AGENT — bol kar note / reminder, aur notes dhoondna ----------
export async function noteAgentSave({ text = '', day = '', time = '', partyId = '', items = [], nag = 0 } = {}) {
  if (!canUseOf()) throw Error('Is login par notes ki ijazat nahi');
  if (!cloud?.saveNote) throw Error('Notes ke liye app update karein');
  const t = String(text || '').trim(); if (!t) throw Error('Note mein kuch likhein');
  const p = partyId ? partyOf(partyId) : null;
  const d = await saveNote({ kind: 'note', text: t, items: (items || []).slice(0, 20), partyId: p ? p.id : '', partyName: p ? p.name : '',
    remindDay: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '', remindTime: /^\d{2}:\d{2}$/.test(time) ? time : '', allDay: false, nag: nagOk(nag) });
  badge(); return d;
}
export function noteAgentFind(q = '', { open = true, n = 8 } = {}) {
  const today = dayOf();
  let l = notes.filter(x => matchQ(x, String(q || '').trim().toLowerCase()));
  if (open) l = l.filter(x => !x.done);
  const key = x => (x.done ? '2' : x.remindDay ? '0' + x.remindDay + (x.remindTime || '99') : '1') + String(9e15 - (x.updatedAt || 0));
  return l.sort((a, b) => key(a).localeCompare(key(b))).slice(0, Math.max(1, Math.min(20, n))).map(x => ({ id: x.id, text: String(x.text || '').slice(0, 160),
    reminder: x.remindDay || '', time: x.remindTime || '', account: x.partyName || '', items: (x.items || []).map(i => i.name).slice(0, 5), done: !!x.done, late: !!x.remindDay && !x.done && x.remindDay < today, by: x.byName || '', repeat_minutes: x.nag || 0 }));
}
// v2.99.27: agent ke liye — kaun se notes (filter / lafz / ids), aur sab par ek saath lagana
export function noteAgentPick({ filter = 'open', text = '', ids = [] } = {}) {
  const today = dayOf(), q = String(text || '').trim().toLowerCase();
  let l = notes.filter(x => !x.done);
  if (Array.isArray(ids) && ids.length) { const S = new Set(ids.map(String)); l = notes.filter(x => S.has(x.id)); }
  else {
    if (filter === 'today') l = l.filter(x => x.remindDay && x.remindDay <= today);
    else if (filter === 'late') l = l.filter(x => x.remindDay && x.remindDay < today);
    else if (filter === 'next') l = l.filter(x => x.remindDay > today);
    else if (filter === 'no_reminder') l = l.filter(x => !x.remindDay);
    if (q) l = l.filter(x => matchQ(x, q));
  }
  return l.slice(0, 40).map(x => ({ id: x.id, text: String(x.text || x.partyName || '').slice(0, 100), reminder: x.remindDay || '', time: x.remindTime || '', nag: x.nag || 0 }));
}
export async function noteAgentBulk(ids, o) {
  if (!canUseOf()) throw Error('Is login par notes ki ijazat nahi');
  return bulkApply(ids, { day: o.day || null, time: o.time != null && o.time !== '' ? o.time : null, nag: o.nag == null ? -1 : nagOk(o.nag) || (Number(o.nag) === 0 ? 0 : -1), done: !!o.done });
}
