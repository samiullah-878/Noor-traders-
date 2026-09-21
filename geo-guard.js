// geo-guard.js — v1.88.0 MULAZIM ki app sirf DUKAN ke andar
// - Malik dukan mein khare ho kar jagah set karta hai (blueAccess/geo: lat, lng, radius). Jagah set na ho = koi rok nahi.
// - Mulazim (har scope) ki app: kholte waqt, har 3 minute, screen wapas aane par, aur har SAVE par location check.
//   Bahar ki 2 reading lagataar (ya location ki ijazat band / 3 dafa location na mile) -> poori screen LOCK.
// - Malik ka "🔒 Sab mulazim abhi band" (lockAll) — sab ko lock, "🔓 Khol do" se wapas.
// - 🔑 Chhoot password (sirf hash + salt save): sahi ho to AAJ RAAT 12 BAJE tak sab pabandi khatam. 5 ghalat = 10 min ruko.
//   Malik password badle ya dobara "Sab band" dabaye to pehle wali chhoot khatam.
// - Log (geoLog, sirf malik parhta): bahar se kholna, chhoot password, ghalat password, location band. SIRF FAASLA + waqt,
//   asal jagah (lat/lng) mulazim ki kabhi save NAHI hoti.
// - App band ho to koi tracking nahi (sirf jab app khuli ho). Yeh check PHONE par hai — malik ko bataya gaya hai.

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BYPASS_KEY = 'sam-geo-chhoot', TRIES_KEY = 'sam-geo-tries', LOGT_KEY = 'sam-geo-lastlog';
const CHECK_MS = 3 * 60 * 1000;

let cloud = null, sessionOf = () => null, notice = () => {}, logout = () => {};
let cfg = null, stopCfg = null, timer = null, running = false;
let lastFix = null, outStreak = 0, failStreak = 0, locked = '', checking = null;

// ---------- hisaab ----------
export function haversine(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// GPS ki ghalti (accuracy) ka 100 m tak fayda: dukan ke andar GPS 20-60 m ghalat ho to bhi lock na ho
export function geoInside(fix, c) {
  const d = haversine(fix, c), acc = Math.min(Math.max(Number(fix.acc) || 0, 0), 100);
  return { dist: Math.round(d), inside: d - acc <= (Number(c.radius) || 100) };
}
export async function passHash(salt, pw) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(salt) + ':' + String(pw)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const km = m => m >= 1000 ? (Math.round(m / 100) / 10) + ' km' : Math.round(m) + ' meter';
const dayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const midnight = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); };
const hasPlace = () => !!cfg && Number.isFinite(Number(cfg.lat)) && Number.isFinite(Number(cfg.lng)) && cfg.lat != null && cfg.lng != null;
const isStaff = () => sessionOf()?.role === 'staff';
function bypassOk() {
  try {
    const b = JSON.parse(localStorage.getItem(BYPASS_KEY) || 'null');
    return !!b && !!cfg && b.uid === sessionOf()?.user?.uid && b.until > Date.now() && b.passVer === cfg.passVer && b.at > (Number(cfg.lockAt) || 0);
  } catch { return false; }
}
function readFix() {
  return new Promise(res => {
    if (!navigator.geolocation) { res({ err: 'none' }); return; }
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }),
      e => res({ err: e && e.code === 1 ? 'denied' : 'fail' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}
async function log(kind, dist, acc) {
  if (!cloud?.logGeo || !isStaff()) return;
  try {
    if (kind === 'outside' || kind === 'noloc') {   // bahar wali log har 15 minute mein ek
      const t = JSON.parse(localStorage.getItem(LOGT_KEY) || '{}');
      if (Date.now() - (t[kind] || 0) < 15 * 60000) return;
      t[kind] = Date.now(); localStorage.setItem(LOGT_KEY, JSON.stringify(t));
    }
    const s = sessionOf();
    await cloud.logGeo({ by: s.user.uid, who: String(s.scope || 'full') + (s.credentialId ? ' · ' + String(s.credentialId).slice(-4) : ''),
      kind, dist: Number.isFinite(dist) ? Math.round(dist) : -1, acc: Number.isFinite(acc) ? Math.round(acc) : -1, at: Date.now(), day: dayStr() });
  } catch (e) { console.warn('geo log', e); }
}

// ---------- lock ki screen ----------
const WHY = {
  outside: () => `Aap dukan se <b>${esc(km(lastFix?.dist || 0))}</b> door hain.<br>App sirf dukan ke andar chalti hai.`,
  noloc: () => 'Phone mein is app ki <b>Location ki ijazat band</b> hai.<br>Browser ki settings mein is site ko Location "Allow" karein, phir "Dobara check" dabayein.',
  nofix: () => 'Location nahi mil rahi.<br>Phone ka GPS / Location on karein, phir "Dobara check" dabayein.',
  band: () => 'Malik ne abhi <b>sab mulazim ki app band</b> ki hui hai.'
};
function lock(why) {
  locked = why;
  try { if ($('dialog')?.open) $('dialog').close(); } catch {}
  let el = $('geoLock');
  if (!el) {
    el = document.createElement('div'); el.id = 'geoLock'; el.className = 'geo-lock';
    el.innerHTML = `<div class="geo-card"><h2>🔒 App band</h2><p id="geoWhy"></p>
      <button type="button" id="geoRetry" class="got">🔄 Dobara check karo</button>
      <details id="geoPassBox"><summary>🔑 Chhoot password</summary>
        <input id="geoPass" type="password" autocomplete="off" placeholder="Malik ka diya hua chhoot password">
        <button type="button" id="geoPassGo">Kholo</button><p id="geoPassMsg" class="stat-note"></p></details>
      <button type="button" id="geoLogout" class="ghost">Logout</button></div>`;
    document.body.appendChild(el);
    $('geoRetry').onclick = async () => { $('geoRetry').disabled = true; $('geoWhy').innerHTML = 'Location dekh raha hoon…'; outStreak = 1; await check(true); const b = $('geoRetry'); if (b) b.disabled = false; if (locked) paint(); };
    $('geoPassGo').onclick = tryPass;
    $('geoPass').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); tryPass(); } };
    $('geoLogout').onclick = () => logout();
  }
  paint(); el.hidden = false; document.body.classList.add('geo-locked');
}
function paint() { const w = $('geoWhy'); if (w) w.innerHTML = (WHY[locked] || WHY.outside)(); }
function unlock() {
  locked = '';
  const el = $('geoLock'); if (el) el.hidden = true;
  document.body.classList.remove('geo-locked');
}
async function tryPass() {
  const msg = $('geoPassMsg'), inp = $('geoPass'); if (!msg || !inp) return;
  let t; try { t = JSON.parse(localStorage.getItem(TRIES_KEY) || '{"n":0,"until":0}'); } catch { t = { n: 0, until: 0 }; }
  if (t.until > Date.now()) { msg.textContent = `Bohat ghalat koshish — ${Math.ceil((t.until - Date.now()) / 60000)} minute baad dobara.`; return; }
  if (!cfg?.passHash || !cfg?.salt) { msg.textContent = 'Malik ne abhi chhoot password nahi rakha.'; return; }
  const pw = inp.value; if (!pw) { msg.textContent = 'Password likhein'; return; }
  const h = await passHash(cfg.salt, pw);
  if (h === cfg.passHash) {
    localStorage.setItem(BYPASS_KEY, JSON.stringify({ uid: sessionOf()?.user?.uid, until: midnight(), at: Date.now(), passVer: cfg.passVer }));
    localStorage.setItem(TRIES_KEY, JSON.stringify({ n: 0, until: 0 }));
    inp.value = ''; msg.textContent = '';
    log('chhoot', lastFix?.dist, lastFix?.acc);
    unlock(); notice('🔑 Chhoot — aaj raat 12 baje tak pabandi nahi');
  } else {
    t.n = (t.n || 0) + 1;
    if (t.n >= 5) { t = { n: 0, until: Date.now() + 10 * 60000 }; log('wrongpass', lastFix?.dist, lastFix?.acc); msg.textContent = '5 dafa ghalat — 10 minute baad dobara.'; }
    else msg.textContent = `Ghalat password (${t.n}/5)`;
    localStorage.setItem(TRIES_KEY, JSON.stringify(t)); inp.value = '';
  }
}

// ---------- check ----------
async function check(force = false) {
  if (!running || !isStaff()) { unlock(); return true; }
  if (checking && !force) return checking;
  checking = (async () => {
    if (bypassOk()) { unlock(); return true; }
    if (cfg?.lockAll) { lock('band'); return false; }
    if (!hasPlace()) { unlock(); return true; }
    const f = await readFix();
    if (f.err === 'denied' || f.err === 'none') { lock('noloc'); log('noloc'); return false; }
    if (f.err) { failStreak++; if (failStreak >= 3) { lock('nofix'); return false; } return !locked; }
    failStreak = 0;
    const g = geoInside(f, cfg); lastFix = { ...f, ...g };
    if (g.inside) { outStreak = 0; unlock(); return true; }
    outStreak++;
    if (outStreak >= 2) { lock('outside'); log('outside', g.dist, f.acc); return false; }
    return !locked;   // pehli bahar reading: GPS ka jhatka ho sakta hai, abhi lock nahi
  })();
  try { return await checking; } finally { checking = null; }
}
// har SAVE se pehle (cloud ke likhne wale kaam is se guzarte hain)
export async function geoEnsure() {
  if (!running || !isStaff()) return;
  if (bypassOk()) return;
  if (cfg?.lockAll) { lock('band'); throw Error('🔒 Malik ne app band ki hui hai — save nahi hua'); }
  if (!hasPlace()) return;
  if (locked) throw Error('🔒 App band hai (dukan se bahar) — save nahi hua');
  if (lastFix?.inside && Date.now() - lastFix.at < CHECK_MS + 30000) return;
  await check(true);
  if (!locked && lastFix && !lastFix.inside) await check(true);   // doosri reading se tasdeeq
  if (locked) throw Error('🔒 Aap dukan se bahar hain — save nahi hua');
}

// ---------- chalu / band ----------
export function geoSetup(o) { cloud = o.cloud; sessionOf = o.session || sessionOf; notice = o.notice || notice; logout = o.logout || logout; }
export function geoWatch() {
  const staff = isStaff() && !!cloud?.listenGeo;
  if (!staff) { geoStop(); return; }
  if (running) return;
  running = true; outStreak = 0; failStreak = 0; lastFix = null;
  stopCfg = cloud.listenGeo(d => { cfg = d || null; check(true); }, e => console.warn('geo cfg', e));
  timer = setInterval(() => { if (document.visibilityState === 'visible') check(); }, CHECK_MS);
}
export function geoStop() {
  running = false; cfg = null; lastFix = null;
  if (stopCfg) { try { stopCfg(); } catch {} stopCfg = null; }
  if (timer) { clearInterval(timer); timer = null; }
  unlock();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && running) check(true); });

// ---------- MALIK ki screen ----------
export async function geoOwnerForm(modal) {
  modal('📍 Dukan location · Chhoot password', '<p>Parh raha hoon…</p>');
  let c = {};
  try { c = (await cloud.getGeo()) || {}; } catch (e) { $('dialogBody').innerHTML = '<p>Nahi khula: ' + esc(e?.message || e) + '</p>'; return; }
  const set = Number.isFinite(Number(c.lat)) && c.lat != null;
  $('dialogBody').innerHTML = `<div class="geo-own">
    <p>Mulazim ki app sirf dukan ke ghere mein chalegi (malik par koi pabandi nahi). App band ho to koi tracking nahi.</p>
    <p><b>Dukan ki jagah:</b> ${set ? `✅ set hai${c.placeAcc ? ' (±' + Math.round(c.placeAcc) + ' m)' : ''}` : '❌ set nahi — abhi koi location pabandi nahi'}</p>
    <button type="button" id="geoSetHere" class="got">📍 Dukan ki jagah YAHAN set karo</button>
    <button type="button" id="geoWhere">📏 Main abhi dukan se kitna door hoon?</button>
    ${set ? '<button type="button" id="geoClear" class="danger">Location pabandi hatao</button>' : ''}
    <label>Ghera (meter)<input id="geoRadius" type="number" inputmode="numeric" min="30" max="2000" step="10" value="${Number(c.radius) || 100}"></label>
    <button type="button" id="geoRadiusSave">Ghera save</button>
    <hr>
    <p><b>🔑 Chhoot password:</b> ${c.passHash ? '✅ laga hai' : '❌ nahi laga'} <small>(mulazim ka login password se alag; sahi likhne par aaj raat 12 baje tak pabandi nahi)</small></p>
    <input id="geoNewPass" type="password" autocomplete="new-password" placeholder="Naya chhoot password (kam az kam 4)">
    <button type="button" id="geoPassSave">Chhoot password save</button>
    <hr>
    <p><b>Sab mulazim:</b> ${c.lockAll ? '🔒 BAND hain' : '🔓 chal rahe hain'}</p>
    <button type="button" id="geoLockAll" class="${c.lockAll ? 'got' : 'danger'}">${c.lockAll ? '🔓 Khol do' : '🔒 Sab mulazim abhi band'}</button>
    <p id="geoMsg" role="status" class="stat-note"></p>
    <hr><details id="geoLogBox"><summary>📋 Log (bahar se kholna / chhoot)</summary><div id="geoLogList"><p>…</p></div></details>
  </div>`;
  const msg = t => { const m = $('geoMsg'); if (m) m.textContent = t; };
  const again = () => geoOwnerForm(modal);
  $('geoSetHere').onclick = async () => {
    msg('Location le raha hoon… (dukan ke andar hi dabayein)');
    const f = await readFix();
    if (f.err) { msg(f.err === 'denied' ? 'Location ki ijazat band hai — browser mein allow karein.' : 'Location nahi mili — GPS on kar ke dobara.'); return; }
    if (f.acc > 60 && !confirm(`GPS abhi kamzor hai (±${Math.round(f.acc)} m). Behtar hai thora ruk kar ya darwaze ke paas dobara dabayein.\n\nPhir bhi yahi jagah save karein?`)) { msg(''); return; }
    try { await cloud.setGeo({ lat: f.lat, lng: f.lng, placeAcc: Math.round(f.acc), placeAt: Date.now(), radius: Number($('geoRadius').value) || 100 }); notice('📍 Dukan ki jagah save'); again(); }
    catch (e) { msg('Save nahi hua: ' + (e?.message || e)); }
  };
  $('geoWhere').onclick = async () => {
    if (!set) { msg('Pehle dukan ki jagah set karein.'); return; }
    msg('Dekh raha hoon…'); const f = await readFix();
    if (f.err) { msg('Location nahi mili.'); return; }
    const g = geoInside(f, c); msg(`Aap dukan se ${km(g.dist)} door hain (GPS ±${Math.round(f.acc)} m) — mulazim yahan ${g.inside ? '✅ chala sakta' : '🔒 NAHI chala sakta'}.`);
  };
  if ($('geoClear')) $('geoClear').onclick = async () => {
    if (!confirm('Location ki pabandi hata dein? (mulazim kahin se bhi chala sakega)')) return;
    try { await cloud.setGeo({ lat: null, lng: null }); again(); } catch (e) { msg('Nahi hua: ' + (e?.message || e)); }
  };
  $('geoRadiusSave').onclick = async () => {
    const r = Math.round(Number($('geoRadius').value) || 0);
    if (r < 30 || r > 2000) { msg('Ghera 30 se 2000 meter ke beech'); return; }
    if (r < 80 && !confirm(`${r} meter bohat kam hai — dukan ke andar GPS 20-60 m ghalat hota hai, mulazim andar bhi lock ho sakta hai. Phir bhi?`)) return;
    try { await cloud.setGeo({ radius: r }); notice('Ghera ' + r + ' meter'); again(); } catch (e) { msg('Nahi hua: ' + (e?.message || e)); }
  };
  $('geoPassSave').onclick = async () => {
    const pw = $('geoNewPass').value;
    if (pw.length < 4) { msg('Kam az kam 4 harf/hindse'); return; }
    const salt = [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, '0')).join('');
    try { await cloud.setGeo({ salt, passHash: await passHash(salt, pw), passVer: Date.now() }); notice('🔑 Chhoot password save — pehle ki sab chhoot khatam'); again(); }
    catch (e) { msg('Nahi hua: ' + (e?.message || e)); }
  };
  $('geoLockAll').onclick = async () => {
    const on = !c.lockAll;
    if (on && !confirm('Sab mulazim ki app ABHI band kar dein? (chhoot password se hi khulegi)')) return;
    try { await cloud.setGeo(on ? { lockAll: true, lockAt: Date.now() } : { lockAll: false }); notice(on ? '🔒 Sab mulazim band' : '🔓 Sab mulazim khul gaye'); again(); }
    catch (e) { msg('Nahi hua: ' + (e?.message || e)); }
  };
  $('geoLogBox').ontoggle = async () => {
    if (!$('geoLogBox').open) return;
    try {
      const rows = await cloud.geoLogs();
      const K = { outside: '🚫 Bahar se kholna', chhoot: '🔑 Chhoot password', wrongpass: '❌ 5 ghalat password', noloc: '📵 Location band' };
      $('geoLogList').innerHTML = rows.length ? rows.map(r => `<div class="geo-log"><b>${esc(K[r.kind] || r.kind)}</b><small>${esc(new Date(r.at).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(r.who || '')}${r.dist >= 0 ? ' · dukan se ' + esc(km(r.dist)) : ''}</small></div>`).join('') : '<p>Abhi koi log nahi.</p>';
    } catch (e) { $('geoLogList').innerHTML = '<p>Log nahi khula: ' + esc(e?.message || e) + '</p>'; }
  };
}
