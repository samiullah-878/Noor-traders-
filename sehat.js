// =========================================================
//  sehat.js v1.0 (2026-11-19, app v2.323.0) — 📸 SEHAT LOCK ki photo (sirf malik)
//  Malik: "fruit / nuts / coffee / paani na piyun to mobile access na kar paun — cheez ki picture do, AI khud dekhe · LIVE camera, gallery nahi".
//  MacroDroid popup "📸 Photo do" → #sehat=<kind>.<nonce> → yeh khirki: SIRF live camera (getUserMedia — file / gallery ka koi raasta nahi)
//  → 🤖 Gemini (app ki AI key, A.aiImage) cheez dekhe → sahi = phone ko webhook `nt_sehat?shOk=<nonce>` (Falcon wala fxCfg.wh) → lock khatam.
//  🚨 = `nt_sehat?shZ=1` (phone khud din mein 1 dafa hi maanta hai). Tasveer kahin save NAHI hoti. Aaj ki ginti sirf isi phone par (localStorage).
//  AI: sirf photo jaanch. Waqt / lock = phone ka macro (md/tools/sehat.py), AI nahi.
// =========================================================
const K = {
  paani: { i: '💧', t: 'Paani ka glass', d: 'a glass, cup or bottle with drinking water in it' },
  coffee: { i: '☕', t: 'Coffee ka cup', d: 'a cup or mug of coffee (hot or cold, coffee liquid visible)' },
  fruit: { i: '🍎', t: 'Fruit', d: 'real fresh fruit (e.g. apple, banana, orange, grapes, guava, mango, pomegranate, melon) — not juice box, not a picture' },
  nuts: { i: '🥜', t: 'Nuts / dry fruit', d: 'nuts or dry fruit (almonds, walnuts, cashews, pistachios, peanuts, raisins, dates, figs)' },
};
let A = null, S = null;   // S = { kind, n, stream, busy, done }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const dayKey = () => { const d = new Date(); return 'sam-sehat-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const tally = () => { try { return JSON.parse(localStorage.getItem(dayKey()) || '{}') || {}; } catch { return {}; } };
const bump = k => { try { const t = tally(); t[k] = (Number(t[k]) || 0) + 1; localStorage.setItem(dayKey(), JSON.stringify(t)); } catch {} };
const withT = (p, ms, why) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Error(why)), ms))]);

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
  const t = tally();
  return Object.entries(K).map(([k, v]) => `<span class="${(Number(t[k]) || 0) > 0 ? 'is-in' : ''}">${v.i} ${Number(t[k]) || 0}</span>`).join('');
}
function st(cls, txt) { const b = $('shSt'); if (b) { b.className = 'sh-st' + (cls ? ' ' + cls : ''); b.textContent = txt; } }

export async function open(deps) {
  A = deps || {}; css();
  const kind = K[deps.kind] ? deps.kind : '', n = String(deps.n || '').replace(/\D/g, '').slice(0, 12);
  if (!kind || !n) { A.notice?.('✕ Sehat link adhoora — phone ke popup se dobara "📸 Photo do" dabayein'); return; }
  close();
  const v = K[kind];
  const d = document.createElement('dialog'); d.id = 'shDlg';
  d.innerHTML = `<video class="sh-v" id="shV" playsinline muted autoplay></video><img class="sh-shot" id="shShot" alt="">
    <div class="sh-top"><div class="sh-ttl">${v.i} ${esc(v.t)} ki photo<small>Sirf live camera · 🤖 AI dekhega · tasveer save nahi hoti</small></div>
      <button type="button" class="sh-c red" data-sh="zaroori">🚨 10 min</button><button type="button" class="sh-c" data-sh="x" aria-label="Band">✕</button></div>
    <div class="sh-tl" id="shTl">${tallyHTML()}</div>
    <div class="sh-bot"><div class="sh-st" id="shSt">⏳ Camera khul raha hai…</div>
      <div class="sh-row"><button type="button" class="sh-go" id="shGo" data-sh="go" disabled aria-label="Photo lo">📸</button></div>
      <div class="sh-hint">${esc(v.t)} camera ke saamne saaf rakhein — phir 📸</div></div>`;
  document.body.appendChild(d);
  S = { kind, n, stream: null, busy: false, done: false };
  d.addEventListener('click', onClick);
  d.addEventListener('close', () => { stop(); d.remove(); if (S && S.d === d) S = null; });
  S.d = d;
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntShClose = () => { close(); return true; };
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
  const C = (await A.cloud?.getFxCfg?.()) || {}, m = String(C.wh || '').trim().match(/^(https:\/\/trigger\.macrodroid\.com\/[A-Za-z0-9_-]{6,})\//);
  if (!m) throw Error('Phone ka webhook link nahi mila — Gaari → ⚙️ Falcon setup mein MacroDroid ka link lagayein');
  return m[1];
}
async function tell(q) { const h = await hook(); await withT(fetch(h + '/nt_sehat?' + q + '&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' }), 12000, 'Phone tak paigham nahi gaya (internet?)'); }

function frame() {
  const vd = $('shV'), w0 = vd.videoWidth, h0 = vd.videoHeight; if (!w0 || !h0) throw Error('Camera ki tasveer abhi tayyar nahi — 1 sec ruk kar dobara');
  const sc = Math.min(1, 768 / Math.max(w0, h0)), c = document.createElement('canvas');
  c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc); c.getContext('2d').drawImage(vd, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
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
  S.busy = true; $('shGo').disabled = true;
  const sh = $('shShot'); sh.src = url; S.d.classList.add('is-frz');
  st('', '⏳ 🤖 AI dekh raha hai…');
  let r = null;
  try {
    if (!A.aiImage) throw Error('AI tayyar nahi');
    const out = await withT(A.aiImage(url.split(',')[1], prompt(S.kind)), 30000, 'AI ne 30 sec mein jawab nahi diya');
    const m = String(out || '').match(/\{[\s\S]*\}/); r = m ? JSON.parse(m[0]) : null;
    if (!r || typeof r.ok !== 'boolean') throw Error('AI ka jawab samajh nahi aaya');
  } catch (e) {
    S.busy = false; $('shGo').disabled = false; S.d.classList.remove('is-frz');
    st('bad', '✕ ' + (e?.message || e) + ' — dobara 📸'); return;
  }
  const v = K[S.kind];
  if (r.screen) { S.busy = false; $('shGo').disabled = false; S.d.classList.remove('is-frz'); st('bad', '✕ Screen / chhapi tasveer ki photo nahi chalegi — asli ' + v.t + ' ki photo lo'); return; }
  if (!r.ok) { S.busy = false; $('shGo').disabled = false; S.d.classList.remove('is-frz'); st('bad', `✕ ${v.t} nazar nahi aaya${r.seen ? ' (AI ko dikha: ' + String(r.seen).slice(0, 60) + ')' : ''} — qareeb se, roshni mein dobara 📸`); return; }
  S.done = true; st('ok', `✅ ${v.i} ${v.t} — sahi! Phone ko bata raha hoon…`);
  try {
    await tell('shOk=' + encodeURIComponent(S.n));
    bump(S.kind); const tl = $('shTl'); if (tl) tl.innerHTML = tallyHTML();
    st('ok', '✅ Shabash! 10–20 sec mein phone ki apps khul jayengi');
    stop(); setTimeout(close, 3500);
  } catch (e) {
    S.done = false; S.busy = false; $('shGo').disabled = false; S.d.classList.remove('is-frz');
    st('bad', '✕ ' + (e?.message || e) + ' — internet dekh kar dobara 📸');
  }
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
  if (k === 'go') go(); else if (k === 'x') close(); else if (k === 'zaroori') zaroori();
}
