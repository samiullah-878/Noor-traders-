// =========================================================
//  sehat.js v1.3 (2026-11-19, app v2.328.0; v1.0 app v2.323.0) — 📸 SEHAT LOCK ki photo (sirf malik)
//  Malik: "fruit / nuts / coffee / paani na piyun to mobile access na kar paun — cheez ki picture do, AI khud dekhe · LIVE camera, gallery nahi".
//  MacroDroid popup "📸 Photo do" → #sehat=<kind>.<nonce> → yeh khirki: SIRF live camera (getUserMedia — file / gallery ka koi raasta nahi)
//  → 🤖 Gemini (app ki AI key, A.aiImage) cheez dekhe → sahi = phone ko webhook `nt_sehat?shOk=<nonce>` (Falcon wala fxCfg.wh) → lock khatam.
//  🚨 = `nt_sehat?shZ=1` (phone khud din mein 1 dafa hi maanta hai). Tasveer kahin save NAHI hoti. Aaj ki ginti sirf isi phone par (localStorage).
//  AI: sirf photo jaanch. Waqt / lock = phone ka macro (md/tools/sehat.py), AI nahi.
//  v1.1 (2026-11-19, app v2.325.0 — malik: "Chrome mein khulta hai, speed se nahi"): camera FORAN — login / data ka intezar sirf 📸 ke baad
//  (A.ready() = app ka session + malik → { cloud, aiImage }). Phone ab installed app (WebAPK) kholta hai, Chrome sirf jab app na mile.
//  v1.2 (2026-11-19, app v2.326.0 — malik: 'app mein bhi screen bana do paani ki picture lagane ke liye — wahan par bhi lagayi ja sake'):
//  ☰ → 📸 Sehat photo = open({mode:'app'}) — upar 4 chips (💧 ☕ 🍎 🥜, aaj ki ginti saath), wahi live camera + AI → phone ko
//  `nt_sehat?shOk=a:<kind>&shT=<sec>` (phone sirf 3 min ke andar ka maanta hai): wahi cheez baqi / lock = foran khule · paani pehle = agli yaad 40 min baad ·
//  coffee / fruit / nuts waqt se pehle = us din ki yaad nahi (md pkg v58).
//  v1.3 (2026-11-19, app v2.328.0 — malik: 'picture lagate hi screen band · baqi kaam background mein AI kare · notification aaye — apps khul gayi ya
//  dobara picture lagao · mujhe wait na karna pare'): 📸 = khirki FORAN band → photo service worker (sw.js shJob) ko: wahan 🤖 Gemini + phone ka webhook
//  (app band ho jaye tab bhi) → notification ✅ / ✕ (✕ par tap = #sehat=app.<cheez> = dobara camera). Purana SW (jawab na de) = yahi kaam app mein.
//  Notification ki ijazat na ho = app ke andar paigham. Ijazat 📸 dabate hi maangi jati hai (ek dafa).
//  v1.4 (2026-11-20, app v2.335.0, md pkg v61 — malik: 'beej ki picture don to Claude open ho jaye, baqi apps band jaise 11 baje tak · kaam mukammal kar ke
//  picture wapis · apni screen mein sabzi ka kaam aur paani / nuts kitna, date wise aaj kal parso' · '30 minute tak'): app wali screen mein 🌱 Sabzi
//  (beej / paudha / mitti — AI dekhe) = phone ko `nt_sehat?shOk=c:sabzi&shT=` -> Claude 30 min (sirf Claude; baqi list wahi band) · ✅ Kaam = sirf record.
//  📊 Hisaab = har sahi photo is phone ki IndexedDB 'nt-sehat' (store log {d, t, k, th}) mein — service worker bhi wahi likhta hai (app band ho tab bhi);
//  sabzi ki chhoti tasveer (320px) sirf isi phone par, Firestore / server par kuch nahi. Aaj · Kal · Parson chips. Purani localStorage ginti ek dafa idhar.
//  v1.5 (2026-11-27, app v2.390.0, md pkg v84, rules 2.112 — malik: 'lock screen wale popup mein Paani pee lo neeli line · check box lage to counting Blue Khata
//  mein · nuts / fruit / coffee time par, dabane par ghayab' + OK): phone ka 🧠 Falsafa popup ☐ tick par din ka POORA haal sehatTick/<din> {p, c, f, n, at}
//  mein likhta hai (MacroDroid, chaabi blueAccess/awazKey) → yahan 📊 Hisaab ki har line par ☑ (popup) + 📸 (AI photo) alag. Phone ko link + chaabi
//  (ntU / ntK, `nt_notes` — wahi jo 🎙 Meri baatein bhejti hai) yeh screen bhi din mein ek dafa bhejti hai. AI nahi (tick sirf ginti).
// =========================================================
import { firebaseConfig as F } from './config.js?v=2.392.0';
const K = {
  paani: { i: '💧', t: 'Paani ka glass', d: 'a glass, cup or bottle with drinking water in it' },
  coffee: { i: '☕', t: 'Coffee ka cup', d: 'a cup or mug of coffee (hot or cold, coffee liquid visible)' },
  fruit: { i: '🍎', t: 'Fruit', d: 'real fresh fruit (e.g. apple, banana, orange, grapes, guava, mango, pomegranate, melon) — not juice box, not a picture' },
  nuts: { i: '🥜', t: 'Nuts / dry fruit', d: 'nuts or dry fruit (almonds, walnuts, cashews, pistachios, peanuts, raisins, dates, figs)' },
  // v1.4: g = sabzi (sirf app wali screen) · qk = phone ko kya bhejna ('' = kuch nahi, sirf hisaab)
  sabzi: { i: '🌱', t: 'Sabzi — beej / paudha', c: 'Sabzi', g: 1, qk: 'c:sabzi', okT: '✅ 🌱 Sabzi — Claude 30 minute khul gayi', okB: 'Baqi apps pehle jaisi band. Kaam ho jaye to ✅ Kaam ki photo do.',
    d: 'vegetable gardening at home: seeds of any kind (vegetable / herb seeds, coriander or fenugreek seeds, garlic cloves, onion bulb, sprouted potato), a seedling or small plant, or a pot / bucket / bottle / container / ground with soil ready for planting, or gardening work in progress (hands in soil, planting, watering)' },
  kaam: { i: '✅', t: 'Sabzi ka kaam', c: 'Kaam', g: 1, qk: '', okT: '✅ Sabzi ka kaam — shabash!', okB: 'Hisaab mein lag gaya — 📊 Aaj mein dekhein.',
    d: 'finished home-gardening work: a pot / bucket / bottle / container / bed with soil where seeds were just planted (fresh soil, maybe wet), or seedlings / plants growing in soil, or plants that were just watered' },
};
let A = null, S = null;   // S = { kind, n, stream, busy, done }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const ymd = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// ---------- v1.4: 📊 hisaab — IndexedDB (sw.js ka shLog bhi BILKUL yehi db / store / index) ----------
function idb() { return new Promise((ok, no) => { const r = indexedDB.open('nt-sehat', 1); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { autoIncrement: true }).createIndex('d', 'd'); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); }
async function logAdd(recs) { const db = await idb(); try { await new Promise((ok, no) => { const tx = db.transaction('log', 'readwrite'), st = tx.objectStore('log'); for (const r of [].concat(recs)) st.add(r); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); } finally { db.close(); } }
async function logDay(d) { const db = await idb(); try { return await new Promise((ok, no) => { const q = db.transaction('log').objectStore('log').index('d').getAll(d); q.onsuccess = () => ok(q.result || []); q.onerror = () => no(q.error); }); } finally { db.close(); } }
let migDone = false;
async function mig() {   // purani ginti (localStorage 'sam-sehat-YYYY-MM-DD' {kind: n}) ek dafa hisaab mein — waqt ke baghair (t 0)
  if (migDone) return; migDone = true;
  try {
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sam-sehat-\d{4}-\d\d-\d\d$/.test(k || '')) keys.push(k); }
    for (const k of keys) {
      let t = {}; try { t = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch {}
      const recs = []; for (const [kind, n] of Object.entries(t)) if (K[kind]) for (let j = 0; j < Math.min(60, Number(n) || 0); j++) recs.push({ d: k.slice(10), t: 0, k: kind, old: 1 });
      if (recs.length) await logAdd(recs);
      localStorage.removeItem(k);
    }
  } catch {}
}
let CNT = {};   // aaj ki ginti {kind: n} — chips ke liye
async function loadCnt() { try { await mig(); const c = {}; for (const r of await logDay(ymd())) c[r.k] = (c[r.k] || 0) + 1; CNT = c; } catch {} const tl = $('shTl'); if (tl && S) tl.innerHTML = tallyHTML(); }
const withT = (p, ms, why) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Error(why)), ms))]);
// ---------- v1.5: ☑ phone popup ki ginti (sehatTick) ----------
async function cl() {   // khamosh login ka intezar (camera screen ki status line nahi chhoti)
  if (A?.cloud) return A.cloud;
  if (!A?.ready) return null;
  try { Object.assign(A, await withT(A.ready(), 60000, 'login')); } catch { return null; }
  return A.cloud || null;
}
async function phoneLink(c) {   // phone ke ntU / ntK (awazNotes ka link + chaabi) — din mein ek dafa; phone ka macro sehatTick ka link isi se banata hai
  try {
    const k = String((await c?.getAwazKey?.()) || ''); if (k.length < 16) return;
    const C = (await c.getFxCfg?.()) || {}, m = String(C.wh || '').trim().match(/^(https:\/\/trigger\.macrodroid\.com\/[A-Za-z0-9_-]{6,})\//); if (!m) return;
    const sig = ymd() + '|' + k.slice(0, 5) + '|' + m[1].slice(-5);
    try { if (localStorage.getItem('sam-sh-ntk') === sig) return; } catch {}
    const u = `https://firestore.googleapis.com/v1/projects/${F.projectId}/databases/(default)/documents/businesses/noor-traders/awazNotes?key=${F.apiKey}`;
    await withT(fetch(m[1] + '/nt_notes?ntU=' + encodeURIComponent(u) + '&ntK=' + encodeURIComponent(k) + '&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' }), 12000, 'net');
    try { localStorage.setItem('sam-sh-ntk', sig); } catch {}
  } catch {}
}
const TK = {};   // din -> { t, v } · v: {p,c,f,n,at} | null (kuch nahi aaya) — 30 s yaad
async function tickOf(day) {   // undefined = khul nahi saka
  const h = TK[day]; if (h && Date.now() - h.t < 30000) return h.v;
  const c = await cl(); if (!c?.getSehatTick) return undefined;
  let v; try { v = await withT(c.getSehatTick(day), 8000, 'net'); } catch { return undefined; }
  TK[day] = { t: Date.now(), v }; return v;
}

function css() {
  if ($('shCss')) return;
  const s = document.createElement('style'); s.id = 'shCss';
  s.textContent = `
html body dialog#shDlg{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#04070d;color:#fff;overflow:hidden}
html body dialog#shDlg::backdrop{background:#04070d}
#shDlg .sh-v,#shDlg .sh-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#04070d}
#shDlg .sh-shot{display:none}#shDlg.is-frz .sh-shot{display:block}
#shDlg .sh-top{position:absolute;left:0;right:0;top:0;padding:12px 12px 26px;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,rgba(4,7,13,.88),rgba(4,7,13,0))}
#shDlg .sh-ttl{flex:1;min-width:0;font:800 17px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#shDlg .sh-ttl small{display:block;font:600 12px/1.3 system-ui,sans-serif;opacity:.8}
html body #shDlg .sh-c{flex:none;height:34px!important;min-height:34px!important;padding:0 13px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.28)!important;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.06))!important;color:#fff!important;font:700 13px/1 system-ui,sans-serif!important;white-space:nowrap;box-shadow:none!important;backdrop-filter:blur(6px)}
html body #shDlg .sh-c.red{border-color:rgba(255,120,120,.55)!important;background:linear-gradient(180deg,rgba(220,60,60,.55),rgba(150,25,25,.45))!important}
#shDlg .sh-tl{position:absolute;left:0;right:0;top:64px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;padding:0 12px}
#shDlg .sh-tl span{height:24px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;font:700 12px/1 system-ui,sans-serif;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}
#shDlg .sh-tl span.is-in{background:rgba(52,199,89,.28);border-color:rgba(52,199,89,.6)}
html body #shDlg .sh-k{height:34px!important;min-height:34px!important;padding:0 12px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.26)!important;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05))!important;color:#fff!important;font:700 13px/1 system-ui,sans-serif!important;white-space:nowrap;box-shadow:none!important;backdrop-filter:blur(6px)}
html body #shDlg .sh-k.is-in{border-color:rgba(120,190,255,.9)!important;background:linear-gradient(180deg,rgba(60,140,255,.62),rgba(30,90,200,.5))!important}
html body #shDlg .sh-k b{margin-left:5px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,.28);font:800 11px/1 system-ui,sans-serif}
html body #shDlg .sh-k.has b{background:rgba(52,199,89,.55)}
html body #shDlg .sh-k.g{border-color:rgba(140,220,120,.45)!important}
html body dialog#shHis{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#070b14;color:#fff;overflow:auto}
html body dialog#shHis::backdrop{background:#04070d}
#shHis .hs-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:12px 12px 8px;background:#070b14}
#shHis .hs-top b{flex:1;min-width:0;font:800 17px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#shHis .hs-days{display:flex;gap:6px;padding:0 12px 10px;flex-wrap:wrap}
html body #shHis .hs-c{height:34px!important;min-height:34px!important;padding:0 14px!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.24)!important;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))!important;color:#fff!important;font:700 13px/1 system-ui,sans-serif!important;white-space:nowrap;box-shadow:none!important}
html body #shHis .hs-c.is-in{border-color:rgba(120,190,255,.9)!important;background:linear-gradient(180deg,rgba(60,140,255,.62),rgba(30,90,200,.5))!important}
#shHis .hs-body{padding:0 12px calc(20px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px}
#shHis .hs-r{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.12)}
#shHis .hs-r.ok{border-color:rgba(52,199,89,.5)}
#shHis .hs-i{font-size:24px;line-height:1.1;flex:none}
#shHis .hs-m{flex:1;min-width:0}
#shHis .hs-n{font:800 16px/1.25 system-ui,sans-serif}
#shHis .hs-s{font:600 13px/1.4 system-ui,sans-serif;opacity:.78;margin-top:2px;overflow-wrap:anywhere}
#shHis .hs-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(96px,100%),1fr));gap:8px;margin-top:8px}
#shHis .hs-ph figure{margin:0;border-radius:12px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.16);cursor:pointer}
#shHis .hs-ph img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
#shHis .hs-ph figcaption{font:700 12px/1.3 system-ui,sans-serif;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#shHis .hs-big{position:fixed;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.94)}
#shHis .hs-big.is-in{display:flex}#shHis .hs-big img{max-width:100%;max-height:100%;object-fit:contain}
#shDlg .sh-bot{position:absolute;left:0;right:0;bottom:0;padding:22px 14px calc(18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(0deg,rgba(4,7,13,.92),rgba(4,7,13,0))}
#shDlg .sh-st{min-height:34px;max-width:94%;padding:7px 14px;border-radius:14px;text-align:center;font:700 14px/1.35 system-ui,sans-serif;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2)}
#shDlg .sh-st.ok{background:rgba(52,199,89,.3);border-color:rgba(52,199,89,.7)}#shDlg .sh-st.bad{background:rgba(255,69,58,.28);border-color:rgba(255,69,58,.7)}
#shDlg .sh-row{display:flex;align-items:center;justify-content:center;gap:22px;width:100%}
html body #shDlg .sh-go{width:68px!important;height:68px!important;min-height:68px!important;padding:0!important;border-radius:50%!important;border:4px solid #fff!important;background:radial-gradient(circle,#fff 0 52%,rgba(255,255,255,.25) 54%)!important;color:#0b1730!important;font:800 22px/1 system-ui,sans-serif!important;box-shadow:0 6px 22px rgba(0,0,0,.5)!important}
html body #shDlg .sh-go:disabled{opacity:.45}
#shDlg .sh-hint{font:600 12px/1.3 system-ui,sans-serif;opacity:.75;text-align:center}`;
  document.head.appendChild(s);
}

function tallyHTML() {
  const t = CNT;
  // v1.2: app wali screen = yahi chips cheez chunne ke button (aaj ki ginti saath) · v1.4: 🌱 Sabzi + ✅ Kaam bhi (g)
  if (S && S.app) return Object.entries(K).map(([k, v]) => { const c = Number(t[k]) || 0; return `<button type="button" class="sh-k${S.kind === k ? ' is-in' : ''}${c ? ' has' : ''}${v.g ? ' g' : ''}" data-sh="k" data-k="${k}">${v.i} ${esc(v.c || v.t.split(' ')[0])}<b>${k === 'paani' ? c : c ? '✓' : '0'}</b></button>`; }).join('');
  return Object.entries(K).filter(([, v]) => !v.g).map(([k, v]) => `<span class="${(Number(t[k]) || 0) > 0 ? 'is-in' : ''}">${v.i} ${Number(t[k]) || 0}</span>`).join('');
}
// v1.1: app abhi login kar rahi ho to 📸 ke baad intezar (camera pehle hi khula)
async function need() {
  if (A.cloud && A.aiImage) return;
  if (!A.ready) throw Error('App tayyar nahi — dobara kholein');
  st('', '⏳ App login ho rahi hai…');
  Object.assign(A, await withT(A.ready(), 60000, 'Login nahi hua — app dobara kholein'));
}
function st(cls, txt) { const b = $('shSt'); if (b) { b.className = 'sh-st' + (cls ? ' ' + cls : ''); b.textContent = txt; } }

export async function open(deps) {
  A = deps || {}; css();
  const app = deps.mode === 'app';
  let last = ''; try { last = localStorage.getItem('sam-sehat-k') || ''; } catch {}
  const kind = (K[deps.kind] && (app || !K[deps.kind].g)) ? deps.kind : app ? (K[last] ? last : 'paani') : '', n = app ? '' : String(deps.n || '').replace(/\D/g, '').slice(0, 12);
  if (!kind || (!app && !n)) { A.notice?.('✕ Sehat link adhoora — phone ke popup se dobara "📸 Photo do" dabayein'); return; }
  close();
  const v = K[kind];
  const d = document.createElement('dialog'); d.id = 'shDlg';
  S = { kind, n, app, stream: null, busy: false, done: false };
  d.innerHTML = `<video class="sh-v" id="shV" playsinline muted autoplay></video><img class="sh-shot" id="shShot" alt="">
    <div class="sh-top"><div class="sh-ttl" id="shTtl">${app ? '📸 Sehat photo' : v.i + ' ' + esc(v.t) + ' ki photo'}<small>Sirf live camera · 📸 ke baad khirki band — 🤖 AI ka nateeja notification mein</small></div>
      <button type="button" class="sh-c" data-sh="his" aria-label="Hisaab">📊</button><button type="button" class="sh-c red" data-sh="zaroori">🚨 10 min</button><button type="button" class="sh-c" data-sh="x" aria-label="Band">✕</button></div>
    <div class="sh-tl" id="shTl">${tallyHTML()}</div>
    <div class="sh-bot"><div class="sh-st" id="shSt">⏳ Camera khul raha hai…</div>
      <div class="sh-row"><button type="button" class="sh-go" id="shGo" data-sh="go" disabled aria-label="Photo lo">📸</button></div>
      <div class="sh-hint" id="shHint">${esc(hintOf(kind))}</div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', onClick);
  d.addEventListener('close', () => { stop(); hisClose(); d.remove(); if (S && S.d === d) S = null; });
  S.d = d;
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntShClose = () => { if ($('shHis')) hisClose(); else close(); return true; };   // v1.4: pehle 📊 hisaab band, phir camera
  listen(); loadCnt();
  cl().then(c => c && phoneLink(c));   // v1.5: peeche — camera ka intezar nahi
  await cam();
}

async function cam() {
  if (!S) return;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Is browser mein camera nahi chalta');
    S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    const vd = $('shV'); vd.srcObject = S.stream; await vd.play().catch(() => {});
    $('shGo').disabled = false; st('', '📸 dabayein');
  } catch (e) {
    st('bad', '✕ Camera nahi khula — ' + (e?.name === 'NotAllowedError' ? 'Chrome ko camera ki ijazat dein (upar 🔒 → Camera → Allow)' : (e?.message || e)));
  }
}
function stop() { try { S?.stream?.getTracks().forEach(t => t.stop()); } catch {} if (S) S.stream = null; }
function close() { const d = $('shDlg'); if (d) { try { d.close(); } catch { d.remove(); } } stop(); if (window.ntShClose) window.ntShClose = null; }

async function hook() {
  await need();
  const C = (await A.cloud?.getFxCfg?.()) || {}, m = String(C.wh || '').trim().match(/^(https:\/\/trigger\.macrodroid\.com\/[A-Za-z0-9_-]{6,})\//);
  if (!m) throw Error('Phone ka webhook link nahi mila — Gaari → ⚙️ Falcon setup mein MacroDroid ka link lagayein');
  return m[1];
}
const tellH = (h, q) => withT(fetch(h + '/nt_sehat?' + q + '&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' }), 12000, 'Phone tak paigham nahi gaya (internet?)');
async function tell(q) { await tellH(await hook(), q); }

function frame(mx = 768, q = 0.82) {
  const vd = $('shV'), w0 = vd.videoWidth, h0 = vd.videoHeight; if (!w0 || !h0) throw Error('Camera ki tasveer abhi tayyar nahi — 1 sec ruk kar dobara');
  const sc = Math.min(1, mx / Math.max(w0, h0)), c = document.createElement('canvas');
  c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc); c.getContext('2d').drawImage(vd, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
const hintOf = k => k === 'sabzi' ? '🌱 Beej / paudha / mitti wala gamla saamne rakhein — sahi photo = Claude 30 min' : k === 'kaam' ? '✅ Lagaya hua gamla / paudha saamne rakhein — sirf hisaab mein' : K[k].t + ' camera ke saamne saaf rakhein — phir 📸';
const prompt = k => `You check a health-habit photo that was taken LIVE with a phone camera just now.
Required item: ${K[k].d}.
Reply with ONLY this JSON, nothing else: {"ok": true or false, "screen": true or false, "seen": "max 6 English words"}
- ok = true only if the required item is clearly and physically present in front of the camera (a real object).
- screen = true if the image looks like a photo of a phone / computer / TV screen or of a printed picture (pixels, moire, screen bezel, display glare). If screen is true, ok must be false.
- Be fair: any normal real example of the item counts. Partly eaten / half-full is fine.`;

async function go() {
  if (!S || S.busy || S.done) return;
  let url;
  try { url = frame(); } catch (e) { st('bad', '✕ ' + (e?.message || e)); return; }
  askPerm();
  let th = ''; if (K[S.kind].g) try { th = frame(320, 0.7); } catch {}
  const v = K[S.kind], now = new Date(), job = { kind: S.kind, app: !!S.app, n: S.n, b64: url.split(',')[1], prompt: prompt(S.kind), t: v.t, i: v.i, d: ymd(now), at: now.getTime(), th };
  if (v.qk !== undefined) Object.assign(job, { qk: v.qk, okT: v.okT, okB: v.okB });   // v1.4: sabzi = c:sabzi · kaam = phone ko kuch nahi
  S.done = true; close();   // v1.3: foran band — intezar nahi
  A.notice?.(`⏳ ${v.i} 🤖 AI dekh raha hai — nateeja notification mein aayega`);
  bg(job).catch(e => note(`✕ ${v.i} photo check nahi hui`, String(e?.message || e) + ' — dabayein, dobara photo', job.kind, false));
}
// ---------- v1.3: background — service worker (app band ho tab bhi) ya purane SW par yahin ----------
function askPerm() { try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch {} }
const canNote = () => { try { return !!(window.Notification && Notification.permission === 'granted' && navigator.serviceWorker); } catch { return false; } };
async function note(title, body, kind, ok) {   // ✕ par tap = dobara camera (app mode, wahi cheez)
  try { if (canNote()) { const reg = await withT(navigator.serviceWorker.ready, 3000, 'sw'); await reg.showNotification(title, { body, tag: 'sehat', renotify: true, icon: './icon-192.png', badge: './favicon-64.png', vibrate: ok ? [120, 80, 120] : [300], data: { url: ok ? './' : './#sehat=app.' + kind } }); return; } } catch {}
  A.notice?.(title + ' — ' + body);
}
let heard = false;
function listen() {   // SW ka nateeja: ginti + (ijazat na ho to) app ke andar paigham
  if (heard || !navigator.serviceWorker) return; heard = true;
  navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (d.type !== 'sehatR') return; if (d.ok) { loadCnt(); if ($('shHis')) hisPaint(); } if (!canNote()) A.notice?.(d.title + ' — ' + d.body); });   // v1.4: SW ne hisaab likh diya
}
async function viaSw(job) {
  try {
    if (!navigator.serviceWorker) return false;
    const reg = await withT(navigator.serviceWorker.ready, 3000, 'sw'), w = reg && reg.active; if (!w) return false;
    listen();
    return await new Promise(ok => { const ch = new MessageChannel(), t = setTimeout(() => ok(false), 2500); ch.port1.onmessage = e => { clearTimeout(t); ok(!!(e.data && e.data.ack)); }; w.postMessage({ type: 'sehat', job }, [ch.port2]); });
  } catch { return false; }
}
async function bg(j) {
  const bad = (title, why) => note(title, String(why) + ' — dabayein, dobara photo', j.kind, false);
  try { await need(); } catch (e) { return bad(`✕ ${j.i} photo check nahi hui`, e?.message || e); }
  let h = ''; if (j.qk !== '') try { h = await hook(); } catch (e) { return bad('✕ Phone ka link nahi mila', e?.message || e); }   // v1.4: ✅ Kaam = phone ko kuch nahi
  let ai = null; try { ai = A.aiCfg ? await A.aiCfg() : null; } catch (e) { return bad('✕ AI key', e?.message || e); }
  if (ai && ai.key && ai.model && await viaSw({ ...j, hook: h, key: ai.key, model: ai.model })) return;   // ab SW ka kaam (app band ho jaye to bhi)
  let r = null;   // purana SW — yahin (app khuli rahe)
  try {
    if (!A.aiImage) throw Error('AI tayyar nahi');
    const out = await withT(A.aiImage(j.b64, j.prompt), 30000, 'AI ne 30 sec mein jawab nahi diya');
    const m = String(out || '').match(/\{[\s\S]*\}/); r = m ? JSON.parse(m[0]) : null;
    if (!r || typeof r.ok !== 'boolean') throw Error('AI ka jawab samajh nahi aaya');
  } catch (e) { return bad(`✕ ${j.i} photo check nahi hui`, e?.message || e); }
  if (r.screen) return bad('✕ Screen / chhapi tasveer nahi chalegi', 'Asli ' + j.t + ' ki photo lo');
  if (!r.ok) return bad(`✕ ${j.i} ${j.t} nazar nahi aaya`, (r.seen ? 'AI ko dikha: ' + String(r.seen).slice(0, 60) + ' · ' : '') + 'qareeb se, roshni mein');
  if (j.qk !== '') {
    const sec = Math.floor(Date.now() / 1000);
    try { await tellH(h, j.qk ? 'shOk=' + encodeURIComponent(j.qk) + '&shT=' + sec : j.app ? 'shOk=' + encodeURIComponent('a:' + j.kind) + '&shT=' + sec : 'shOk=' + encodeURIComponent(j.n)); }
    catch (e) { return bad('✕ Phone tak paigham nahi gaya', 'Photo sahi thi magar ' + (e?.message || e)); }
  }
  try { await logAdd({ d: j.d || ymd(), t: j.at || Date.now(), k: j.kind, th: j.th || '' }); } catch {}
  loadCnt();
  note(j.okT || `✅ ${j.i} ${j.t} — shabash!`, j.okB || (j.app ? 'Gin li — raat 8 baje ke hisaab mein shamil' : 'Gin li — raat 8 baje ke hisaab mein shamil'), j.kind, true);
}

async function zaroori() {
  if (!S || S.busy) return;
  if (!confirm('🚨 10 minute ke liye sab apps khol dein?\nDin mein sirf 1 dafa milta hai.')) return;
  try { await tell('shZ=1'); A.notice?.('🚨 Phone ko kaha — 10 min ke liye apps khul jayengi (aaj ka ek dafa)'); close(); }
  catch (e) { st('bad', '✕ ' + (e?.message || e)); }
}

function onClick(e) {
  const b = e.target.closest?.('[data-sh]'); if (!b) return;
  const k = b.dataset.sh;
  if (k === 'go') go(); else if (k === 'x') close(); else if (k === 'zaroori') zaroori(); else if (k === 'k') pick(b.dataset.k); else if (k === 'his') hisOpen();
}
// v1.2: app wali screen — cheez badlo (camera chalta rahe)
function pick(k) {
  if (!S || !S.app || S.busy || S.done || !K[k]) return;
  S.kind = k; try { localStorage.setItem('sam-sehat-k', k); } catch {}
  const tl = $('shTl'); if (tl) tl.innerHTML = tallyHTML();
  const h = $('shHint'); if (h) h.textContent = hintOf(k);
  if (S.stream) st('', K[k].i + ' ' + K[k].t + ' — 📸 dabayein');
}

// ---------- v1.4: 📊 Hisaab — Aaj · Kal · Parson (sirf is phone ki IndexedDB) ----------
let HD = 0;   // 0 aaj · 1 kal · 2 parson
const dayOf = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const hm = t => { if (!t) return ''; const d = new Date(t); let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap; };
function hisOpen() {
  if ($('shHis')) return;
  const d = document.createElement('dialog'); d.id = 'shHis';
  d.innerHTML = `<div class="hs-top"><b>📊 Sehat hisaab</b><button type="button" class="hs-c" data-hs="x" aria-label="Band">✕</button></div>
    <div class="hs-days">${['Aaj', 'Kal', 'Parson'].map((t, i) => `<button type="button" class="hs-c" data-hs="d" data-n="${i}">${t}</button>`).join('')}</div>
    <div class="hs-body" id="hsBody"><div class="hs-s">⏳ …</div></div><div class="hs-big" data-hs="big"><img alt=""></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => {
    const b = e.target.closest?.('[data-hs]'); if (!b) return;
    const k = b.dataset.hs;
    if (k === 'x') hisClose(); else if (k === 'd') { HD = Number(b.dataset.n) || 0; hisPaint(); }
    else if (k === 'ph') { const bg = d.querySelector('.hs-big'); bg.querySelector('img').src = b.querySelector('img')?.src || ''; bg.classList.add('is-in'); }
    else if (k === 'big') b.classList.remove('is-in');
  });
  d.addEventListener('close', () => d.remove());
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  hisPaint();
}
function hisClose() { const d = $('shHis'); if (d) { try { d.close(); } catch {} d.remove(); } }
async function hisPaint() {
  const d = $('shHis'); if (!d) return;
  d.querySelectorAll('[data-hs="d"]').forEach(b => b.classList.toggle('is-in', Number(b.dataset.n) === HD));
  const day = dayOf(HD), key = ymd(day);
  let rows = []; try { await mig(); rows = await logDay(key); } catch (e) { const bd = $('hsBody'); if (bd) bd.innerHTML = `<div class="hs-s">✕ Hisaab nahi khula — ${esc(e?.message || e)}</div>`; return; }
  if (!$('shHis') || ymd(dayOf(HD)) !== key) return;
  rows.sort((a, b) => (a.t || 0) - (b.t || 0));
  const h0 = TK[key], tk = h0 ? h0.v : undefined;   // v1.5: ☑ phone popup — pehle IndexedDB foran, ginti peeche se (neeche)
  const of = k => rows.filter(r => r.k === k);
  const times = L => L.filter(r => r.t).map(r => hm(r.t)).join(' · ');
  const line = (k, label) => {
    const L = of(k), v = K[k], n = L.length, tt = times(L);
    const tn = !tk ? 0 : k === 'paani' ? (Number(tk.p) || 0) : (Number(tk[k[0]]) ? 1 : 0);   // coffee c · fruit f · nuts n
    const main = k === 'paani' ? ([tn ? `${tn} bottle ☑` : '', n ? `${n} glass 📸` : ''].filter(Boolean).join(' + ') || 'Koi nahi') + ' · hadaf 6'
      : (tn || n) ? '✓ ho gaya' + (tn ? ' ☑' : '') + (n ? ' 📸' + (n > 1 ? ` (${n} dafa)` : '') : '') : '— nahi';
    return `<div class="hs-r${(n || tn) ? ' ok' : ''}"><div class="hs-i">${v.i}</div><div class="hs-m"><div class="hs-n">${esc(label)} · ${esc(main)}</div>${tt ? `<div class="hs-s">🕒 ${esc(tt)}</div>` : ''}</div></div>`;
  };
  const tkLine = tk === undefined ? (h0 ? ' · ☑ popup ki ginti nahi khuli (internet?)' : ' · ☑ ⏳') : tk === null ? ' · ☑ popup se kuch nahi aaya' : tk.at ? ' · ☑ aakhri tick ' + hm(tk.at) : '';
  const G = rows.filter(r => K[r.k]?.g);
  const sab = `<div class="hs-r${G.length ? ' ok' : ''}"><div class="hs-i">🌱</div><div class="hs-m"><div class="hs-n">Sabzi · ${G.length ? of('sabzi').length + ' beej / paudha · ' + of('kaam').length + ' kaam' : '— nahi'}</div>
    ${G.length ? `<div class="hs-ph">${G.map(r => `<figure data-hs="ph">${r.th ? `<img src="${esc(r.th)}" alt="">` : ''}<figcaption>${K[r.k].i} ${r.k === 'sabzi' ? 'Beej' : 'Kaam'} ${esc(hm(r.t))}</figcaption></figure>`).join('')}</div>` : ''}</div></div>`;
  const bd = $('hsBody'); if (!bd) return;
  bd.innerHTML = `<div class="hs-s">📅 ${esc(day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))} · ☑ = phone popup ka tick · 📸 = AI photo${esc(tkLine)}</div>`
    + line('paani', 'Paani') + line('coffee', 'Coffee') + line('fruit', 'Fruit') + line('nuts', 'Nuts') + sab;
  if (!h0 || Date.now() - h0.t >= 30000) {   // v1.5: ginti peeche se — aaye to sirf isi din ka dobara paint
    const v = await tickOf(key);
    if (v === undefined) TK[key] = { t: Date.now() - 25000, v: TK[key]?.v };   // na khuli = purani (ho to) dikhao, agla paint 5 s baad hi dobara koshish — chakkar nahi
    if ($('shHis') && ymd(dayOf(HD)) === key) hisPaint();
  }
}
