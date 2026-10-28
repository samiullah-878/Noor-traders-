// notes.js — v2.26.0 (📇 Google contacts, kai account) · v2.25.0 (contact: phone list / khata, 📞 Call · 💬 WhatsApp) · v2.23.0: 🔔 REMINDER + 📝 NOTES + 💸 HBL PAYMENT + push notification
// - notes/<id>: {kind 'note'|'order', text, items[{id,name}], partyId, partyName, amount(paisa), transferId,
//   remindDay 'YYYY-MM-DD', remindTime 'HH:MM', allDay, done, doneAt, hasPic, by, byName, createdAt, updatedBy, updatedAt, deleted}
//   Tasveer: entryPhotos/n-<id> {photos:[...]} (khata entries jaisa, 2 tak).
// - Accounts ke purane due-date reminders (blueKhata type 'reminder') bhi isi screen par (tap = khata).
// - HBL: khata ka jo account naam mein "HBL" rakhta hai (ya ek dafa chuna hua) — "💸 HBL payment" = account transfer
//   (HBL -> supplier, POS mein bhi) + order ka reminder note.
// - Notification: FCM token pushTokens/<hash>; Cloud Function (cloud-functions/) har 10 minute waqt aaye reminder bhejti hai.
import { saleStock } from './pos-stock.js?v=2.140.0';   // 📢 demand ke items (v2.106.0: 🛒 purchase order + po-formula hata diye)
import { voiceSearch, smartSearch, partyScore, smartHit } from './smart-search.js?v=2.140.0';
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
// v2.103.7: malik — "din chuna to jab tak band na karein har ghante yaad" — din wala reminder KHUD har 1 ghanta; nag 0 (rules 2.61) = 🔁 band
const nagBand = n => n != null && n.nag != null && n.nag !== '' && Number(n.nag) === 0;
const nagEff = n => !n?.remindDay || nagBand(n) ? 0 : (nagOk(n.nag) || 60);
let pushCfg = null, pushState = '';

export function notesSetup(o) {
  cloud = o.cloud || cloud; notice = o.notice || notice; whoOf = o.who || whoOf; recordsOf = o.records || recordsOf;
  partyOf = o.party || partyOf; partiesOf = o.parties || partiesOf; itemsOf = o.items || itemsOf; routeTo = o.route || routeTo;
  dlgOf = o.modal || dlgOf; closeDlg = o.close || closeDlg; payOf = o.pay || payOf; canUseOf = o.canUse || canUseOf; aiOf = o.ai || aiOf; stockOf = o.stock || stockOf; pdfOf = o.pdf || pdfOf; balanceOf = o.balance || balanceOf;
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
function dmWatch() { if (dmStop || !cloud?.listenDemands) return; dmStop = cloud.listenDemands(l => { dmList = (l || []).sort((a, b) => (b.at || 0) - (a.at || 0)); const d = $('dmBody'); if (d) d.innerHTML = dmHTML(); }); }
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

// v2.106.0: ⏰ "Khatam hone wala maal" (stockAlert) aur 🛒 "Purchase order" (posStats + AI order, supplier ke dabbe, bazaar list, godam se dukan)
//   Reminder screen se HATA diye — malik: "in sab ko bhi band kar do, ab is ki zaroorat nahi · app par awe load hai, khatam ho jaye · due account wala rahe".
//   Mangwana ab sirf 📦 Stock → 🧺 Rack bharo → 🛒 Mangwao (PDF). Na listener, na posStats ka bhari data, na po-formula.js. PC raat-report v1.3: subah ki khatam-maal khabar bhi band.
let pdfOf = null;   // notesSetup({pdf}) — purana raasta, ab yahan istemal nahi

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
  { const raw = n.nag !== undefined ? n.nag : old?.nag, g = nagOk(raw); if (d.remindDay) { if (g) d.nag = g; else if (raw != null && raw !== '' && Number(raw) === 0) d.nag = 0; } }   // v2.99.27: 🔁 · v2.103.7: na likha = khud har 1 ghanta, 0 = band
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
  const base = existing || { partyId: preset.partyId || '', partyName: preset.partyName || '', amount: preset.amount || 0, transferId: preset.transferId || '' };   // v2.99.58: HBL card se · v2.102.3: entry ka link
  const fNag = nagBand(n) ? 0 : (nagOk(n.nag) || 60);   // v2.103.7: default har 1 ghanta
  let chosen = [...(n.items || [])], picsNow = existing ? [...(pics.get(existing.id) || [])] : [], picsDirty = false;
  dlgOf(existing ? '✏️ Note badlein' : '📝 Naya note', `<form class="nt-form">
    <label>Note<textarea name="text" maxlength="1000" rows="3" placeholder="kya yaad rakhna hai…">${esc(n.text || '')}</textarea></label>
    <label>Item jorein (stock se)<input id="nfItemQ" type="search" autocomplete="off" placeholder="🔍 item ka naam…"></label><div class="nt-pick" id="nfItemList"></div>
    <div class="nt-chips" id="nfItems"></div>
    <div class="nt-when"><label>Reminder din<input name="day" type="date" value="${esc(n.remindDay || '')}"></label><label>Waqt<input name="time" type="time" value="${esc(n.remindTime || '')}"></label></div>
    <div class="mchips">${[[0, 'Aaj'], [1, 'Kal'], [2, '2 din'], [7, 'Hafta'], ['x', 'Reminder nahi']].map(([d, l]) => `<button type="button" class="rc" data-nf-day="${d}">${l}</button>`).join('')}<label class="nt-allday"><input type="checkbox" name="allDay"${n.allDay ? ' checked' : ''}> Poora din</label></div>
    <div class="nt-nag"><b>🔁 Baar baar yaad dilao</b><div class="mchips">${[...NAGS, 0].map(v => `<button type="button" class="rc${fNag === v ? ' on' : ''}" data-nf-nag="${v}">${v ? 'Har ' + nagTxt(v) : '🔕 Band (sirf ek dafa)'}</button>`).join('')}</div><small>Din lagaya to <b>khud har 1 ghanta</b> — waqt aane ke baad jab tak ✓ na karein (subah 7 – raat 11).</small><input type="hidden" name="nag" value="${fNag}"></div>
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
      const d = await saveNote({ ...base, contactName: f.elements.ctName.value.trim(), contactPhone: f.elements.ctPhone.value, text, items: chosen, remindDay: f.elements.day.value || '', remindTime: f.elements.time.value || '', allDay: !!f.elements.allDay.checked, hasPic: picsNow.length > 0, nag: f.elements.day.value ? (f.elements.nag.value === '0' ? 0 : (nagOk(f.elements.nag.value) || 60)) : undefined }, existing);
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
      ${/^(entry|transfer):/.test(n.transferId || '') ? `<button type="button" class="nt-elink" data-nt-elink="${esc(n.id)}">📒 ${esc(n.partyName || 'Entry')}${n.amount ? ' · ' + rsP(n.amount) : ''} — entry dekhein ›</button>` : ''}
      ${n.text ? `<div class="nt-text">${esc(n.text)}</div>` : ''}
      ${(n.items || []).length ? `<div class="nt-chips">${n.items.map(i => `<span class="nt-chip it">📦 ${esc(i.name)}</span>`).join('')}</div>` : ''}
      ${ph.length ? `<div class="nt-thumbs">${ph.map((p, i) => `<span class="nt-thumb" data-nt-pic="${esc(n.id)}|${i}"><img src="${p}" alt=""></span>`).join('')}</div>` : (n.hasPic ? '<small class="nt-meta">🖼 tasveer aa rahi hai…</small>' : '')}
      <div class="nt-meta">${n.remindDay ? `<span class="nt-when-chip${late ? ' late' : now ? ' now' : ''}">🔔 ${esc(nice(n.remindDay))}${n.remindTime ? ' · ' + esc(t12(n.remindTime)) : n.allDay ? ' · poora din' : ''}</span>` : ''}${nagEff(n) && !n.done ? `<span class="nt-nag-chip">🔁 har ${esc(nagTxt(nagEff(n)))}</span>` : ''}<span>${esc(n.byName || '')}</span>${n.done && n.doneAt ? `<span>✓ ${esc(nice(dayOf(n.doneAt)))}</span>` : ''}</div>
    </div></div>`;
}
function paint() {
  const root = $('ntRoot'); if (!root) return;
  const due = dueParty(), l = listFor(fTab), cnt = t => listFor(t).length;
  root.innerHTML = `<div class="nt-push" id="ntPush"></div>
    <label class="nt-search"><input type="search" placeholder="🔍 note, item, supplier, raqam…" value="${esc(fQ)}" data-nt-q="1"></label>
    <div class="mchips nt-tabs">${[['open', 'Sab khule'], ['today', '🔔 Aaj'], ['late', '⏰ Guzar gaye'], ['next', 'Aane wale'], ['order', '🧾 Order'], ['done', '✓ Ho gaye']].map(([k, lab]) => `<button type="button" class="rc${fTab === k ? ' on' : ''}" data-nt-tab="${k}">${lab} ${cnt(k)}</button>`).join('')}<button type="button" class="rc nt-selbtn${selMode ? ' on' : ''}" data-nt-selmode="1">${selMode ? '✕ Chunna band' : '☑ Kai chunein'}</button></div>
    <div class="nt-list">${l.map(card).join('') || `<div class="nt-empty">📝<b>${fQ ? 'Kuch nahi mila' : fTab === 'done' ? 'Abhi koi ho gaya note nahi' : 'Koi khula note nahi'}</b><small>Neeche "📝 Naya note" dabayein</small></div>`}</div>${selMode ? bulkHTML(l) : ''}
    ${due.length && fTab !== 'done' ? `<div class="nt-sec"><h3>📒 Accounts ke due</h3>${due.map(x => `<button type="button" class="nt-due${x.late ? ' late' : ''}" data-nt-party="${esc(x.p.id)}"><b>${esc(x.p.name)}</b><span>${esc(nice(x.r.dueDate))}${x.r.dueTime ? ' · ' + esc(t12(x.r.dueTime)) : ''}</span>${x.r.note ? `<small>${esc(x.r.note)}</small>` : ''}</button>`).join('')}</div>` : ''}
    <div id="ntGc">${gcLoad().accounts.length ? gcCardHTML() : ''}</div>`;
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
  const el = e.target.closest?.('[data-nt-elink]'); if (el) { e.stopPropagation(); const n = notes.find(x => x.id === el.dataset.ntElink); if (n) openEntryOf(n); return; }   // v2.102.3
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
// v2.103.5: 🔔 SAB KA KHUD CHALU (malik: "sab ka hi chalu karna hai, itna khapna nahi hota") — login ke baad: Allow pehle se = chup chaap
//   token (naam / role / scope); abhi poocha nahi = pehli tap par phone khud poochta hai (browser tap ke baghair nahi poochne deta); block = kuch nahi.
let pushAutoOn = false;
export function pushAuto() {
  if (pushAutoOn || !cloud?.pushRegister) return; pushAutoOn = true;
  try { if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'granted') { enablePush(true); return; }
    if (Notification.permission !== 'default') return;
    const go = () => { document.removeEventListener('pointerdown', go, true); enablePush(true); };
    document.addEventListener('pointerdown', go, true); } catch {}
}
export const pushInfo = () => { try { if (!('Notification' in window)) return 'none'; return Notification.permission === 'granted' ? (pushState === 'ok' ? 'on' : 'granted') : Notification.permission; } catch { return 'none'; } };
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


// ---------- v2.102.3: 🔔 ENTRY PAR REMINDER (malik: "entry se reminder tab khule — kisi bhi entry ka reminder lag sake") ----------
//   Link note.transferId = 'entry:<entryId>' ya 'transfer:<transferId>' (rules ka purana khana — naya key nahi). Entry card par chip / 🔔.
export function remFor(link) { if (!link) return null; const l = notes.filter(n => n.transferId === link); return l.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null; }
export const remWhen = n => n ? (n.done ? '✓ ho gaya' : n.remindDay ? nice(n.remindDay) + (n.remindTime ? ' ' + t12(n.remindTime) : '') : 'note') : '';
export const remLate = n => !!n && !n.done && !!n.remindDay && n.remindDay < dayOf();
export function noteOpen(id) { const n = notes.find(x => x.id === id); if (n) noteForm(n); }
export function entryRemForm(pre = {}) { const ex = remFor(pre.transferId); if (ex && !ex.done) { noteForm(ex); return; } noteForm(null, { day: addDays(1), ...pre }); }
export async function entryRemSave({ transferId, text = '', partyId = '', partyName = '', amount = 0, day = '', time = '' } = {}) {
  if (!cloud?.saveNote) throw Error('Notes ke liye app update karein');
  const old = remFor(transferId), keep = old && !old.done ? old : null;
  const d = await saveNote({ ...(keep || {}), kind: 'note', text: String(text || partyName || 'Reminder').slice(0, 1000), items: keep?.items || [], partyId, partyName, amount: Math.round(Number(amount) || 0), transferId,
    remindDay: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '', remindTime: /^\d{2}:\d{2}$/.test(time) ? time : '', allDay: false, done: false }, keep || undefined);
  badge(); return d;
}
function openEntryOf(n) { const m = /^(entry|transfer):(.+)$/.exec(n.transferId || ''); if (!m) return;
  const r = (recordsOf() || []).find(x => x && !x.deleted && (m[1] === 'entry' ? x.id === m[2] : x.transferId === m[2]));
  const pid = r?.partyId || r?.fromPartyId || n.partyId; if (!pid) { notice('Entry nahi mili (shayad delete ho gayi)'); return; }
  closeDlg(); routeTo('khata', pid); if (r) setTimeout(() => { const el = document.querySelector(`[data-eid="${CSS.escape(r.id)}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('ks-flash'); } }, 300); }

// ---------- v2.99.8: 🤖 NOOR AGENT — bol kar note / reminder, aur notes dhoondna ----------
export async function noteAgentSave({ text = '', day = '', time = '', partyId = '', items = [], nag, pics: photos = [] } = {}) {   // v2.103.59: pics = dataURL (2 tak) — agent photo note
  if (!canUseOf()) throw Error('Is login par notes ki ijazat nahi');
  if (!cloud?.saveNote) throw Error('Notes ke liye app update karein');
  const t = String(text || '').trim(); if (!t) throw Error('Note mein kuch likhein');
  const p = partyId ? partyOf(partyId) : null;
  const d = await saveNote({ kind: 'note', text: t, items: (items || []).slice(0, 20), partyId: p ? p.id : '', partyName: p ? p.name : '',
    remindDay: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '', remindTime: /^\d{2}:\d{2}$/.test(time) ? time : '', allDay: false, nag: !/^\d{4}-\d{2}-\d{2}$/.test(day) ? undefined : nag === 0 ? 0 : (nagOk(nag) || undefined), hasPic: Array.isArray(photos) && photos.length > 0 });   // v2.103.7: na bataya = khud har 1 ghanta · v2.106.0: 0 = 🔕 sirf ek dafa (agent ka 🔔 card)
  if (Array.isArray(photos) && photos.length && cloud?.putPhotos) { const P = photos.slice(0, 2).filter(x => typeof x === 'string' && x.startsWith('data:')); pics.set(d.id, P); cloud.putPhotos('n-' + d.id, P).catch(er => notice('⚠️ Tasveer save nahi hui: ' + (er?.message || er))); }
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
