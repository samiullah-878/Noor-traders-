// galla.js — v2.21.0: 💰 GALLA SCREEN
// Purchase wala larka bill bhejte waqt "💵 Galla se abhi cash" chunta hai -> gallaCalls/<id> (status 'new').
// Galla wale ke phone par (login "💰 Sirf Galla") yahi screen: ghanti + vibrate + URDU awaaz
// ("Amjad Islam ko 25200 rupay dein"), bare hindse, noton ki rangeen tasveerein, aur "✅ Paise de diye".
// "De diye" = gallaCalls 'paid' + (kind 'payment') khata mein supplier ki "Party ko payment" entry EK batch mein
// (rules v2.11 dono ko getAfter se jorte hain). kind 'cash' (photo wali cash purchase) = entry pehle se, sirf 'paid'.
// Awaaz: browser ka apna speechSynthesis (free, AI nahi). Browser ki shart: app khulne ke baad EK dafa button dabana
// parta hai ("🔔 Awaaz chalu karein") — us ke baghair phone awaaz nahi nikalne deta.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rsOf = paisa => Math.round((Number(paisa) || 0) / 100);
const money = paisa => 'Rs ' + new Intl.NumberFormat('en-PK').format(rsOf(paisa));
const clock = ms => { try { return new Date(ms).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let cloud = null, notice = () => {}, uidOf = () => '', nameOf = () => '', ownerOf = () => false, canSeeOf = () => false;
// v2.99.90: 💰 GALLA CHECK — naqad supplier (purchase "Galla se abhi cash", gallaCalls.needCheck) — pehle Mubeen / Sonu / Zeeshan / Malik
//   "✓ Check kar liya" (checkBy / checkName / checkUr / checkAt) -> server PC (pos-khata-sync + galla-parchi.js) EK Urdu parchi (prnState done),
//   phir hi galla ka "Paise de diye" (rules 2.53 bhi). blueAccess/gallaCheck {on, people:[{n, ur}]} — malik galla screen par badle.
const DEF_PEOPLE = [{ n: 'Mubeen', ur: 'مبین' }, { n: 'Sonu', ur: 'سونو' }, { n: 'Zeeshan', ur: 'زیشان' }, { n: 'Malik', ur: 'مالک' }];
let gcfg = null, gcStop = null, chk = [], chkStop = null, chkDay = '', chkSeen = new Set(), chkBusy = new Set(), setOpen = false;
let calls = [], stop = null, stopDay = '', audioOn = false, actx = null, wake = null, ringTimer = null;
let heard = new Set(), confirmId = '', busy = new Set(), lastPaint = '';

export function gallaSetup(o) {
  cloud = o.cloud || cloud; notice = o.notice || notice; uidOf = o.uid || uidOf; nameOf = o.name || nameOf; ownerOf = o.owner || ownerOf; canSeeOf = o.canSee || canSeeOf;
}
// ---------- 💰 galla check (v2.99.90) ----------
const isOwnerG = () => { try { return !!ownerOf(); } catch { return false; } };
const people = () => (gcfg && Array.isArray(gcfg.people) && gcfg.people.length ? gcfg.people : DEF_PEOPLE);
const checkOn = () => !gcfg || gcfg.on !== false;
const nkey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function meChecker() {   // [roman, urdu] ya null
  const P = people();
  if (isOwnerG()) { const m = P.find(p => nkey(p.n) === 'malik'); return [m?.n || 'Malik', m?.ur || 'مالک']; }
  const me = nkey(nameOf()); if (me.length < 3) return null;
  const p = P.find(x => { const k = nkey(x.n); return k.length >= 3 && (me.includes(k) || k.includes(me)); });
  return p ? [p.n, p.ur] : null;
}
window.ntGallaNeedCheck = () => checkOn();
export function gallaWarm() {
  if (!cloud) return;
  if (!gcStop && cloud.listenGallaCheck) gcStop = cloud.listenGallaCheck(c => { gcfg = c || { on: true, people: DEF_PEOPLE }; chkWatch(); chkPaint(); if ($('glRoot')) paint(true); });
  chkWatch();
}
function chkWatch() {
  const can = (() => { try { return !!canSeeOf(); } catch { return false; } })();
  if (!can || !(isOwnerG() || meChecker())) { chkPaint(); return; }
  const day = todayStr(); if (chkStop && chkDay === day) return;
  if (chkStop) { try { chkStop(); } catch {} }
  chkDay = day;
  chkStop = cloud?.listenGallaCalls ? cloud.listenGallaCalls(day, list => {
    chk = (list || []).filter(c => c && c.needCheck && c.status === 'new');
    const fresh = chk.filter(c => !c.checkAt && !chkSeen.has(c.id)); fresh.forEach(c => chkSeen.add(c.id));
    if (fresh.length) { try { navigator.vibrate?.([120, 80, 120]); } catch {} }
    chkPaint(); if ($('glChkList')) chkDlgPaint();
  }) : null;
}
function chkPaint() {
  let bar = $('glChk');
  const todo = chk.filter(c => !c.checkAt), bad = isOwnerG() ? chk.filter(c => c.prnState === 'err') : [];
  if (!(todo.length || bad.length) || !(isOwnerG() || meChecker())) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('button'); bar.type = 'button'; bar.id = 'glChk'; bar.className = 'gl-chkbar'; bar.dataset.glChk = '1'; document.body.appendChild(bar); }
  const c = todo[0];
  bar.classList.toggle('bad', !todo.length);
  bar.innerHTML = todo.length ? `<span>💰 Galla check (${todo.length})</span><b>${esc(c.partyName || '')} · ${money(c.amount)}</b>` : `<span>❌ Galla parchi nahi nikli (${bad.length})</span><b>Tap — phir bhejo</b>`;
}
function chkDlg() {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '💰 Galla payment check';
  $('dialogBody').innerHTML = '<div class="gl-chk" id="glChkList"></div>'; if (!d.open) d.showModal(); chkDlgPaint();
}
function chkDlgPaint() {
  const el = $('glChkList'); if (!el) return; const me = meChecker();
  const list = chk.slice().sort((a, b) => (a.checkAt ? 1 : 0) - (b.checkAt ? 1 : 0) || (a.at || 0) - (b.at || 0));
  el.innerHTML = list.map(c => { const st = !c.checkAt ? '' : c.prnState === 'done' ? `<div class="gl-cst ok">✓ ${esc(c.checkName || '')} ne check kiya · 🖨 parchi nikal gayi</div>` : c.prnState === 'err' ? `<div class="gl-cst bad">❌ Parchi nahi nikli: ${esc(c.prnErr || '')}${isOwnerG() ? `<button type="button" data-gl-retry="${esc(c.id)}">🖨 Phir bhejo</button>` : ''}</div>` : `<div class="gl-cst">✓ ${esc(c.checkName || '')} ne check kiya · 🖨 parchi nikal rahi…</div>`;
    return `<div class="gl-ccard"><div class="gl-who">🧾 ${esc(c.partyName || 'Supplier')}</div><div class="gl-amt">${money(c.amount)}</div>
      <small class="gl-meta">${esc(c.byName || '')} ne bheja · ${esc(clock(c.at))}${c.note ? ' · ' + esc(c.note) : ''}</small>
      ${c.checkAt ? st : me ? `<div class="gl-acts"><button type="button" class="gl-no" data-gl-stop="${esc(c.id)}">✕ Rok do</button><button type="button" class="gl-paid" data-gl-check="${esc(c.id)}"${chkBusy.has(c.id) ? ' disabled' : ''}>✓ Check kar liya</button></div><small class="gl-meta">Parchi par: چیک کیا: ${esc(me[1])}</small>` : '<small class="gl-meta">Aap checker list mein nahi</small>'}</div>`; }).join('') || '<div class="gl-empty">✓<b>Koi payment check ke liye nahi</b></div>';
}
async function doCheck(id) {
  const me = meChecker(), c = chk.find(x => x.id === id); if (!me || !c || c.checkAt || chkBusy.has(id)) return;
  chkBusy.add(id); Object.assign(c, { checkAt: Date.now(), checkName: me[0] }); chkPaint(); chkDlgPaint();   // foran
  try { await cloud.checkGallaCall(id, me[0], me[1]); notice('✓ Check — galla ki parchi server printer par nikal rahi hai'); }
  catch (e) { delete c.checkAt; notice('Nahi hua: ' + (e?.code === 'permission-denied' ? 'ijazat nahi (rules 2.53 publish?)' : (e?.message || e))); }
  finally { chkBusy.delete(id); chkPaint(); chkDlgPaint(); }
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-gl-chk],[data-gl-check],[data-gl-stop],[data-gl-retry],[data-gl-set],[data-gl-padd],[data-gl-pdel],[data-gl-psave],[data-gl-on]'); if (!t) return;
  const d = t.dataset;
  if (d.glChk) { chkDlg(); return; }
  if (d.glCheck) { doCheck(d.glCheck); return; }
  if (d.glStop) { const c = chk.find(x => x.id === d.glStop); const me = meChecker(); if (!c || !me || !confirm(`${c.partyName} ki ${money(c.amount)} payment ROK dein?`)) return;
    Promise.resolve(cloud.stopGallaCall(c.id, me[0])).then(() => notice('✕ Payment rok di')).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.glRetry) { if (!confirm('Parchi dobara bhejni hai? (pehli nahi nikli thi)')) return; Promise.resolve(cloud.retryGallaPrint(d.glRetry)).then(() => notice('🖨 Dobara bheji')).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.glSet) { setOpen = !setOpen; paint(true); return; }
  if (d.glOn) { const on = !checkOn(); Promise.resolve(cloud.setGallaCheck({ on, people: people() })).then(() => notice(on ? '✓ Galla check chalu' : 'Galla check band')).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
  if (d.glPadd) { gcfg = { ...(gcfg || { on: true }), people: [...people(), { n: '', ur: '' }] }; paint(true); return; }
  if (d.glPdel) { const P = people().slice(); P.splice(Number(d.glPdel), 1); gcfg = { ...(gcfg || { on: true }), people: P }; paint(true); return; }
  if (d.glPsave) { const rows = [...document.querySelectorAll('[data-gl-pn]')].map((el, i) => ({ n: el.value.trim().slice(0, 30), ur: String(document.querySelector(`[data-gl-pu="${i}"]`)?.value || '').trim().slice(0, 30) })).filter(p => p.n);
    if (rows.some(p => !p.ur || /[A-Za-z]/.test(p.ur))) { notice('Har naam ka Urdu naam (sirf Urdu) likhein — parchi par yahi chhapega'); return; }
    Promise.resolve(cloud.setGallaCheck({ on: checkOn(), people: rows })).then(() => { notice('✓ Check karne wale save'); setOpen = false; }).catch(er => notice('Nahi hua: ' + (er?.message || er))); }
});
function setHTML() {
  if (!isOwnerG()) return '';
  return `<div class="gl-set"><button type="button" class="gl-sethead" data-gl-set="1">⚙️ Galla check · ${checkOn() ? '✅ chalu' : '⏸ band'} · ${people().map(p => esc(p.n)).join(', ')}</button>
    ${setOpen ? `<div class="gl-setbody"><button type="button" class="gl-test" data-gl-on="1">${checkOn() ? '⏸ Band karein (bina check paise)' : '✅ Chalu karein'}</button>
      <small>Sirf NAQAD supplier (purchase "💵 Galla se abhi cash") par. Udhaar wale / customer par nahi.</small>
      ${people().map((p, i) => `<div class="gl-prow"><input data-gl-pn="${i}" value="${esc(p.n)}" placeholder="Naam (jaise Mubeen)"><input data-gl-pu="${i}" dir="rtl" value="${esc(p.ur)}" placeholder="اردو نام"><button type="button" data-gl-pdel="${i}">✕</button></div>`).join('')}
      <div class="gl-acts"><button type="button" class="gl-say" data-gl-padd="1">➕ Naam</button><button type="button" class="gl-paid" data-gl-psave="1">✓ Save</button></div></div>` : ''}</div>`;
}
export function gallaStop() {
  if (stop) { try { stop(); } catch {} stop = null; stopDay = ''; }
  clearInterval(ringTimer); ringTimer = null;
  try { wake?.release?.(); } catch {} wake = null;
}
function watch() {
  const day = todayStr();
  if (stop && stopDay === day) return;
  if (stop) { try { stop(); } catch {} }
  stopDay = day; heard = new Set(); let first = true;
  stop = cloud?.listenGallaCalls ? cloud.listenGallaCalls(day, list => {
    calls = (list || []).filter(c => c && c.id);
    const fresh = calls.filter(c => c.status === 'new' && !heard.has(c.id));
    for (const c of fresh) heard.add(c.id);
    if (fresh.length && !first) alarm(fresh[fresh.length - 1]);   // app khulte waqt ki purani wali par ek dum shor nahi — loop 30s mein bolega
    else if (fresh.length && first && audioOn) alarm(fresh[0]);
    first = false;
    paint();
  }) : null;
  if (!ringTimer) ringTimer = setInterval(() => { const p = pending(); if (p.length && audioOn) alarm(p[0], true); if (todayStr() !== stopDay) watch(); }, 30000);
}
const pending = () => calls.filter(c => c.status === 'new').sort((a, b) => (a.at || 0) - (b.at || 0));
const doneList = () => calls.filter(c => c.status === 'paid').sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

// ---------- awaaz ----------
function beep() {
  try {
    if (!actx) return;
    const t0 = actx.currentTime;
    [[880, 0], [660, 0.28], [880, 0.56], [660, 0.84]].forEach(([f, dt]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.24);
      o.connect(g); g.connect(actx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.26);
    });
  } catch {}
}
const ONES = ['', 'ek', 'do', 'teen', 'chaar', 'paanch', 'chhe', 'saat', 'aath', 'nau', 'das', 'gyarah', 'barah', 'terah', 'chaudah', 'pandrah', 'solah', 'satrah', 'atharah', 'unnees',
  'bees', 'ikkees', 'baees', 'teyees', 'chaubees', 'pachees', 'chhabbees', 'sattaees', 'atthaees', 'untees', 'tees', 'iktees', 'battees', 'taintees', 'chauntees', 'paintees', 'chhattees', 'saintees', 'artees', 'untaalees',
  'chaalees', 'iktaalees', 'bayaalees', 'taintaalees', 'chawaalees', 'paintaalees', 'chhiyaalees', 'saintaalees', 'artaalees', 'unchaas', 'pachaas', 'ikyaavan', 'baavan', 'tirpan', 'chauvan', 'pachpan', 'chhappan', 'sattaavan', 'atthaavan', 'unsath',
  'saath', 'iksath', 'baasath', 'tirsath', 'chaunsath', 'painsath', 'chhiyaasath', 'sarsath', 'arsath', 'unhattar', 'sattar', 'ikhattar', 'bahattar', 'tihattar', 'chauhattar', 'pachhattar', 'chhihattar', 'sathattar', 'athhattar', 'unaasi',
  'assi', 'ikyaasi', 'bayaasi', 'tiraasi', 'chauraasi', 'pachaasi', 'chhiyaasi', 'sattaasi', 'athaasi', 'navaasi', 'nabbe', 'ikyaanave', 'baanave', 'tiraanave', 'chauraanave', 'pachaanave', 'chhiyaanave', 'sattaanave', 'atthaanave', 'ninyaanave'];
export function romanWords(n) {   // 25200 -> "pachees hazaar do sau" (lakh/crore wala hisaab)
  n = Math.floor(Math.abs(Number(n) || 0)); if (!n) return 'sifar';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7; const lakh = Math.floor(n / 1e5); n %= 1e5;
  const hz = Math.floor(n / 1000); n %= 1000; const sau = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(romanWords(crore) + ' crore');
  if (lakh) parts.push(ONES[lakh] + ' lakh');
  if (hz) parts.push(ONES[hz] + ' hazaar');
  if (sau) parts.push(ONES[sau] + ' sau');
  if (n) parts.push(ONES[n]);
  return parts.join(' ');
}
function voices() { try { return speechSynthesis.getVoices() || []; } catch { return []; } }
function voiceKind() { const v = voices(); return v.find(x => /^ur/i.test(x.lang)) ? 'ur' : v.find(x => /^hi/i.test(x.lang)) ? 'hi' : v.length ? 'other' : 'unknown'; }
function say(c, times = 2) {
  if (!('speechSynthesis' in window) || !c) return;
  const rs = rsOf(c.amount), nm = String(c.partyName || 'supplier').trim();
  const vs = voices(), ur = vs.find(x => /^ur/i.test(x.lang)), hi = vs.find(x => /^hi/i.test(x.lang));
  let text, voice = null, lang;
  if (ur || !vs.length) { voice = ur || null; lang = ur?.lang || 'ur-PK'; text = `${nm} کو ${rs} روپے دیں۔`; }       // ginti TTS khud Urdu mein parhta hai
  else if (hi) { voice = hi; lang = hi.lang; text = `${nm} को ${rs} रुपये दें।`; }
  else { lang = 'en-IN'; text = `${nm} ko ${romanWords(rs)} rupay dein.`; }
  try {
    speechSynthesis.cancel();
    for (let k = 0; k < times; k++) { const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.lang = lang; u.rate = 0.85; u.volume = 1; speechSynthesis.speak(u); }
  } catch {}
}
function alarm(c, again = false) {
  if (!audioOn) { paint(); return; }
  beep();
  try { navigator.vibrate?.([500, 200, 500, 200, 900]); } catch {}
  setTimeout(() => say(c, again ? 1 : 2), 1200);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { navigator.serviceWorker?.getRegistration?.().then(r => r?.showNotification?.('💰 ' + money(c.amount) + ' dene hain', { body: String(c.partyName || '') + ' ko', tag: 'galla-' + c.id, renotify: true, vibrate: [500, 200, 500] })).catch(() => {}); } catch {}
  }
}
async function unlock() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); await actx.resume(); } catch {}
  audioOn = true;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(voiceKind() === 'hi' ? 'आवाज़ चालू' : 'آواز چالو'); u.lang = voiceKind() === 'hi' ? 'hi-IN' : 'ur-PK'; speechSynthesis.speak(u); } catch {}
  keepAwake();
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch {}
  paint(true);
  const p = pending(); if (p.length) setTimeout(() => alarm(p[0]), 900);
}
async function keepAwake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener?.('release', () => { wake = null; }); } } catch { wake = null; } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.querySelector('[data-galla-root]')) { keepAwake(); const p = pending(); if (p.length && audioOn) alarm(p[0], true); } });

// ---------- noton ki tasveerein ----------
const NOTES = [[5000, 'n5000'], [1000, 'n1000'], [500, 'n500'], [100, 'n100'], [50, 'n50'], [20, 'n20'], [10, 'n10'], [5, 'c'], [2, 'c'], [1, 'c']];
export function notesOf(rs) { let r = Math.round(Number(rs) || 0); const out = []; for (const [v, cls] of NOTES) { const n = Math.floor(r / v); if (n) { out.push({ v, n, cls }); r -= n * v; } } return out; }
const notesHTML = rs => notesOf(rs).map(x => `<span class="gl-note ${x.cls}${x.cls === 'c' ? ' coin' : ''}"><b>${x.v}</b><i>× ${x.n}</i></span>`).join('');

// ---------- screen ----------
export function renderGalla() {
  watch();
  $('summary').innerHTML = '<div class="gl-root" data-galla-root="1" id="glRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  paint(true);
}
function paint(force) {
  const root = $('glRoot'); if (!root) return;
  const p = pending(), d = doneList(), paidSum = d.reduce((n, c) => n + (Number(c.amount) || 0), 0);
  const vk = voiceKind();
  const html = `${setHTML()}${audioOn ? '' : `<button type="button" class="gl-unlock" data-gl-unlock="1">🔔 Awaaz chalu karein<small>App kholne ke baad har dafa EK dafa yahan dabayein — phir paise ki awaaz khud aayegi</small></button>`}
    <div class="gl-head"><span>💰 Galla</span><span class="gl-chip">Aaj diye ${money(paidSum)} · ${d.length}</span>${p.length ? `<span class="gl-chip warn">⏳ ${p.length} baqi</span>` : ''}</div>
    ${audioOn && vk === 'other' ? '<p class="gl-tip">⚠️ Is phone mein Urdu/Hindi awaaz nahi mili — Settings mein "Text-to-speech" par Google ki Urdu awaaz daal dein (warna angrezi lehje mein bolega).</p>' : ''}
    ${p.length ? p.map(c => cardHTML(c)).join('') : `<div class="gl-empty">✓<b>Abhi koi paisa nahi dena</b><small>Nayi darkhwast aate hi ghanti bajegi</small></div>`}
    ${d.length ? `<details class="gl-done"><summary>Aaj diye (${d.length}) · ${money(paidSum)}</summary>${d.map(c => `<div class="gl-drow"><span>${esc(clock(c.paidAt))}</span><b>${esc(c.partyName || '')}</b><span>${money(c.amount)}</span><span class="gl-ok">✓</span></div>`).join('')}</details>` : ''}
    ${audioOn ? '<button type="button" class="gl-test" data-gl-test="1">🔊 Awaaz aazmayein</button>' : ''}`;
  if (!force && html === lastPaint) return;
  lastPaint = html; root.innerHTML = html;
}
function cardHTML(c) {
  const rs = rsOf(c.amount), wait = busy.has(c.id);
  return `<div class="gl-card${confirmId === c.id ? ' ask' : ''}">
    <div class="gl-who">🧾 ${esc(c.partyName || 'Supplier')}</div>
    <div class="gl-amt">${money(c.amount)}</div>
    <div class="gl-words">${esc(romanWords(rs))} rupay</div>
    <div class="gl-notes">${notesHTML(rs)}</div>
    <small class="gl-meta">${esc(c.byName || '')} ne bheja · ${esc(clock(c.at))}${c.note ? ' · ' + esc(c.note) : ''}</small>
    ${c.needCheck && c.prnState !== 'done' ? `<div class="gl-lock${c.prnState === 'err' ? ' bad' : ''}">${!c.checkAt ? `⏳ Check baqi — ${esc(people().map(p => p.n).join(' / '))}` : c.prnState === 'err' ? `❌ Parchi nahi nikli — malik "phir bhejo" kare` : `✓ ${esc(c.checkName || '')} ne check kiya · 🖨 parchi nikal rahi…`}<small>Parchi milne ke baad hi paise dein</small></div>` : c.needCheck ? `<div class="gl-lock ok">✓ ${esc(c.checkName || '')} ne check kiya · 🖨 parchi nikal gayi</div>` : ''}
    ${c.needCheck && c.prnState !== 'done' ? '' : confirmId === c.id
      ? `<div class="gl-confirm"><b>Pakka ${money(c.amount)} de diye?</b><div class="gl-acts"><button type="button" class="gl-no" data-gl-no="1">✕ Nahi</button><button type="button" class="gl-paid" data-gl-yes="${esc(c.id)}"${wait ? ' disabled' : ''}>✅ Haan, de diye</button></div></div>`
      : `<div class="gl-acts"><button type="button" class="gl-say" data-gl-say="${esc(c.id)}">🔊 Dobara suno</button><button type="button" class="gl-paid" data-gl-paid="${esc(c.id)}">✅ Paise de diye</button></div>`}
  </div>`;
}
async function pay(id) {
  const c = calls.find(x => x.id === id); if (!c || c.status !== 'new' || busy.has(id)) return;
  if (c.needCheck && c.prnState !== 'done') { notice('⏳ Pehle check + parchi'); return; }
  busy.add(id); confirmId = '';
  const keep = { ...c };
  c.status = 'paid'; c.paidAt = Date.now(); paint(true);   // foran — net dheema ho to bhi screen aage
  try {
    await Promise.race([cloud.payGallaCall(keep, { uid: uidOf(), name: nameOf() }), new Promise(res => setTimeout(res, 3000))]);
    notice('✓ ' + money(keep.amount) + ' de diye' + (keep.kind === 'payment' ? ' — khata mein bhi' : ''));
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(voiceKind() === 'hi' ? 'शुक्रिया' : 'شکریہ'); u.lang = voiceKind() === 'hi' ? 'hi-IN' : 'ur-PK'; speechSynthesis.speak(u); } catch {}
  } catch (e) {
    Object.assign(c, keep); paint(true);
    notice('⚠️ Save nahi hua: ' + ((e && (e.code === 'permission-denied' ? 'ijazat nahi (din band? malik se kahein)' : e.message)) || 'dobara dabayein'));
  } finally { busy.delete(id); paint(true); }
}
document.addEventListener('click', e => {
  if (!document.querySelector('[data-galla-root]')) return;
  const t = e.target.closest?.('[data-gl-unlock],[data-gl-test],[data-gl-say],[data-gl-paid],[data-gl-yes],[data-gl-no]'); if (!t) return;
  const d = t.dataset;
  if (d.glUnlock) { unlock(); return; }
  if (d.glTest) { beep(); say({ partyName: 'Test', amount: 25200 * 100 }, 1); return; }
  if (d.glSay) { if (!audioOn) { unlock(); return; } say(calls.find(x => x.id === d.glSay), 2); return; }
  if (d.glPaid) { confirmId = d.glPaid; paint(true); return; }
  if (d.glNo) { confirmId = ''; paint(true); return; }
  if (d.glYes) { pay(d.glYes); }
});
