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

let cloud = null, notice = () => {}, uidOf = () => '', nameOf = () => '';
let calls = [], stop = null, stopDay = '', audioOn = false, actx = null, wake = null, ringTimer = null;
let heard = new Set(), confirmId = '', busy = new Set(), lastPaint = '';

export function gallaSetup(o) {
  cloud = o.cloud || cloud; notice = o.notice || notice; uidOf = o.uid || uidOf; nameOf = o.name || nameOf;
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
  const html = `${audioOn ? '' : `<button type="button" class="gl-unlock" data-gl-unlock="1">🔔 Awaaz chalu karein<small>App kholne ke baad har dafa EK dafa yahan dabayein — phir paise ki awaaz khud aayegi</small></button>`}
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
    ${confirmId === c.id
      ? `<div class="gl-confirm"><b>Pakka ${money(c.amount)} de diye?</b><div class="gl-acts"><button type="button" class="gl-no" data-gl-no="1">✕ Nahi</button><button type="button" class="gl-paid" data-gl-yes="${esc(c.id)}"${wait ? ' disabled' : ''}>✅ Haan, de diye</button></div></div>`
      : `<div class="gl-acts"><button type="button" class="gl-say" data-gl-say="${esc(c.id)}">🔊 Dobara suno</button><button type="button" class="gl-paid" data-gl-paid="${esc(c.id)}">✅ Paise de diye</button></div>`}
  </div>`;
}
async function pay(id) {
  const c = calls.find(x => x.id === id); if (!c || c.status !== 'new' || busy.has(id)) return;
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
