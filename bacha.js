// bacha.js — v2.218.0: 👶 BACHON KE PHONE (sirf malik). Malik 9 Nov 2026: "ghar par bachon ke mobile — roz 1:20 · TikTok / Shorts / social /
//   Play Store / Settings band · Phone · WhatsApp · Maps · Calendar · Alarm · Gemini · ChatGPT hamesha · time khatam = popup + patli awaaz ·
//   MacroDroid chhupa · uninstall papa ki ijazat se · app mein screen: kis ne kitna dekha, kitna bacha · ek command se sab phones".
// Raasta: bache ke phone ka EK MacroDroid macro (bacha/bacha.macro — PUBLIC, chaabi nahi) → pehli dafa CODE likho → har 5 min bachaCfg/<code>
//   (yahan ke qaide) parhta, har 10 min bachaUse {k,d,p} likhta. Yeh screen sirf parhti / qaide likhti hai. AI NAHI.
//   Qaide string mein (Firestore REST se macro ko seedhe parhne ke liye): lim · add+addU (aaj ka zyada, epoch tak) · papa (epoch tak sab khula) ·
//   stop (epoch tak band) · allow / block (",pkg,pkg,"). DEF_ALLOW / DEF_BLOCK = bacha/build_macro.py ke ALLOW / BLOCK jaisa — ek badlo to doosra bhi.
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
export const MACRO_URL = 'https://samiullah-878.github.io/Noor-traders-/bacha/bacha.macro';
export const DEF_LIM = 80;
export const DEF_ALLOW = ['com.google.android.dialer', 'com.android.dialer', 'com.samsung.android.dialer', 'com.android.contacts', 'com.google.android.contacts',
  'com.samsung.android.app.contacts', 'com.android.phone', 'com.android.server.telecom', 'com.android.incallui', 'com.samsung.android.incallui',
  'com.android.systemui', 'com.whatsapp', 'com.whatsapp.w4b', 'com.google.android.apps.maps',
  'com.google.android.calendar', 'com.samsung.android.calendar', 'com.android.calendar',
  'com.google.android.deskclock', 'com.sec.android.app.clockpackage', 'com.android.deskclock', 'com.android.alarmclock', 'com.transsion.deskclock',
  'com.google.android.apps.messaging', 'com.samsung.android.messaging', 'com.android.mms',
  'com.google.android.apps.bard', 'com.openai.chatgpt', 'com.google.android.permissioncontroller', 'com.android.permissioncontroller'];
export const DEF_BLOCK = ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go', 'com.ss.android.ugc.aweme',
  'com.facebook.katana', 'com.facebook.lite', 'com.facebook.orca', 'com.facebook.mlite', 'com.instagram.android', 'com.instagram.lite',
  'com.instagram.barcelona', 'com.snapchat.android', 'com.twitter.android', 'com.pinterest', 'com.reddit.frontpage', 'video.like',
  'com.kwai.video', 'com.kwai.bulldog', 'sg.bigo.live', 'com.imo.android.imoim', 'org.telegram.messenger', 'com.discord',
  'com.android.vending', 'com.sec.android.app.samsungapps', 'com.xiaomi.mipicks', 'com.heytap.market', 'com.bbk.appstore', 'com.huawei.appmarket',
  'com.android.settings', 'com.miui.securitycenter', 'com.arlosoft.macrodroid',
  'com.google.android.packageinstaller', 'com.android.packageinstaller', 'com.miui.packageinstaller', 'com.samsung.android.packageinstaller'];
// Jaani pehchani apps — ⚙️ Qaide mein ek chip = teen haalat (✅ hamesha · ⏱ time mein · ⛔ band)
export const KNOWN = [
  ['📞', 'Phone / Contacts', ['com.google.android.dialer', 'com.android.dialer', 'com.samsung.android.dialer', 'com.android.contacts', 'com.google.android.contacts', 'com.samsung.android.app.contacts', 'com.android.phone', 'com.android.server.telecom', 'com.android.incallui', 'com.samsung.android.incallui']],
  ['💬', 'WhatsApp', ['com.whatsapp', 'com.whatsapp.w4b']], ['🗺', 'Maps', ['com.google.android.apps.maps']],
  ['📅', 'Calendar', ['com.google.android.calendar', 'com.samsung.android.calendar', 'com.android.calendar']],
  ['⏰', 'Alarm / Ghari', ['com.google.android.deskclock', 'com.sec.android.app.clockpackage', 'com.android.deskclock', 'com.android.alarmclock', 'com.transsion.deskclock']],
  ['✉️', 'Messages (SMS)', ['com.google.android.apps.messaging', 'com.samsung.android.messaging', 'com.android.mms']],
  ['✨', 'Gemini', ['com.google.android.apps.bard']], ['🤖', 'ChatGPT', ['com.openai.chatgpt']],
  ['▶️', 'YouTube', ['com.google.android.youtube']], ['🧒', 'YouTube Kids', ['com.google.android.apps.youtube.kids']],
  ['🌐', 'Chrome', ['com.android.chrome']], ['📷', 'Camera', ['com.google.android.GoogleCamera', 'com.sec.android.app.camera', 'com.android.camera', 'com.transsion.camera']],
  ['🖼', 'Gallery / Photos', ['com.google.android.apps.photos', 'com.sec.android.gallery3d', 'com.miui.gallery', 'com.android.gallery3d', 'com.transsion.gallery']],
  ['🎵', 'TikTok', ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go', 'com.ss.android.ugc.aweme']],
  ['📘', 'Facebook / Messenger', ['com.facebook.katana', 'com.facebook.lite', 'com.facebook.orca', 'com.facebook.mlite']],
  ['📸', 'Instagram / Threads', ['com.instagram.android', 'com.instagram.lite', 'com.instagram.barcelona']], ['👻', 'Snapchat', ['com.snapchat.android']],
  ['🐦', 'X (Twitter)', ['com.twitter.android']], ['🎬', 'Likee / Kwai / Snack', ['video.like', 'com.kwai.video', 'com.kwai.bulldog']],
  ['📺', 'Bigo Live', ['sg.bigo.live']], ['💭', 'imo / Telegram / Discord', ['com.imo.android.imoim', 'org.telegram.messenger', 'com.discord']],
  ['📌', 'Pinterest / Reddit', ['com.pinterest', 'com.reddit.frontpage']],
  ['🛍', 'Play Store / app stores', ['com.android.vending', 'com.sec.android.app.samsungapps', 'com.xiaomi.mipicks', 'com.heytap.market', 'com.bbk.appstore', 'com.huawei.appmarket']],
  ['⚙️', 'Settings', ['com.android.settings', 'com.miui.securitycenter']], ['🤖', 'MacroDroid', ['com.arlosoft.macrodroid']],
  ['🗑', 'Install / Uninstall', ['com.google.android.packageinstaller', 'com.android.packageinstaller', 'com.miui.packageinstaller', 'com.samsung.android.packageinstaller']],
  ['🎮', 'Free Fire', ['com.dts.freefireth', 'com.dts.freefiremax']], ['🔫', 'PUBG', ['com.tencent.ig', 'com.pubg.imobile']], ['🧱', 'Roblox', ['com.roblox.client']],
  ['⛏', 'Minecraft', ['com.mojang.minecraftpe']], ['🍬', 'Candy Crush', ['com.king.candycrushsaga']], ['🏃', 'Subway Surfers', ['com.kiloo.subwaysurf']],
];
const NAME = {}; for (const [i, n, ps] of KNOWN) for (const p of ps) NAME[p] = i + ' ' + n;
Object.assign(NAME, { 'com.android.systemui': '📱 Phone ki upar wali patti', 'com.google.android.permissioncontroller': '🔐 Ijazat ki khirki', 'com.android.permissioncontroller': '🔐 Ijazat ki khirki' });
export const appName = p => NAME[p] || (() => { const s = String(p || '').split('.').filter(x => !/^(com|android|app|apps|google|org|net)$/.test(x)); const w = s[s.length - 1] || p; return '📦 ' + w.charAt(0).toUpperCase() + w.slice(1); })();

// ---------- ⏱ waqt (Pakistan) ----------
const PK = 5 * 3600e3;
export const pkDay = ms => new Date(ms + PK).toISOString().slice(0, 10);
export const endOfDay = ms => { const d = pkDay(ms); return Math.floor((new Date(d + 'T00:00:00Z').getTime() - PK + 864e5) / 1000) - 1; };   // aaj raat 11:59:59 (epoch s)
const hm = m => { m = Math.max(0, Math.round(Number(m) || 0)); return m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ' ghanta' : m + ' min'; };
const ago = s => { if (!s) return 'kabhi nahi'; const m = Math.round((Date.now() / 1000 - s) / 60); if (m < 1) return 'abhi'; if (m < 60) return m + ' min pehle'; const h = Math.round(m / 60); return h < 24 ? h + ' ghante pehle' : Math.round(h / 24) + ' din pehle'; };
const clock = s => new Date(s * 1000 + PK).toISOString().slice(11, 16);

// ---------- 📥 phone ka data ----------
// p = "v1|t=<epoch>|u=<aaj gina>|c=<aaj ki hadd>|b=<battery>|<log>" · log: "hh:mm~pkg," (har minute screen on) · "!B~pkg~hh:mm," band app · "!S~~" Shorts ·
//   "!U~pkg~" uninstall · "!X~~" time khatam · "!D~~" naya din
export function parseDoc(p) {
  const s = String(p || ''); const o = { t: 0, u: 0, c: 0, b: '', mins: {}, ev: [] };
  const head = s.split('|'); let i = 0;
  for (; i < head.length; i++) { const m = /^([tucbv])=?(.*)$/.exec(head[i]); if (!m || (head[i].indexOf('=') < 0 && m[1] !== 'v')) break; if (m[1] === 'v') continue; o[m[1]] = m[1] === 'b' ? m[2] : Number(m[2]) || 0; }
  const log = head.slice(i).join('|');
  for (const e of log.split(',')) {
    if (!e) continue;
    if (e[0] === '!') { const [k, pk, tm] = e.slice(1).split('~'); o.ev.push({ k, pk: pk || '', tm: tm || '' }); continue; }
    const j = e.indexOf('~'); if (j < 0) continue; const pk = e.slice(j + 1).trim(); if (!pk) continue; o.mins[pk] = (o.mins[pk] || 0) + 1;
  }
  return o;
}
export function summarize(docs, now = Date.now()) {
  const today = pkDay(now), out = { last: 0, used: 0, cap: 0, bat: '', mins: {}, ev: [], days: {} };
  const L = (docs || []).map(d => ({ ...parseDoc(d.p), id: d.id })).filter(x => x.t > 0).sort((a, b) => a.t - b.t);
  for (const x of L) {
    const day = pkDay(x.t * 1000);
    const D = out.days[day] || (out.days[day] = { used: 0, mins: {}, ev: [], ids: [] });
    D.used = Math.max(D.used, x.u); D.ids.push(x.id); D.ev.push(...x.ev);
    for (const [k, v] of Object.entries(x.mins)) D.mins[k] = (D.mins[k] || 0) + v;
    if (x.t >= out.last) { out.last = x.t; out.cap = x.c; out.bat = x.b; if (day === today) out.used = x.u; }
  }
  const T = out.days[today]; if (T) { out.mins = T.mins; out.ev = T.ev; out.used = Math.max(out.used, T.used); }
  return out;
}
const evName = { B: 'Band app kholi', S: 'YouTube Shorts', U: 'Uninstall ki koshish', X: 'Time khatam' };

// ---------- 🖼 khirki ----------
let A = null, P = null, U = {}, H = {}, err = '', mode = 'list', open = '', menu = false, newCode = '', draft = null, busy = '';
export function kdOpen(ctx) {
  A = ctx; mode = 'list'; open = ''; menu = false;
  let d = $('kdDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'kdDlg';
    d.innerHTML = `<div class="kd-in"><header class="kd-h"><button type="button" class="kd-x" data-kd="back" aria-label="Wapas">‹</button><b id="kdT">👶 Bachon ke phone</b><button type="button" class="kd-x" data-kd="menu" aria-label="Aur">⋮</button></header><div class="kd-menu" id="kdMenu" hidden></div><div class="kd-b" id="kdB"></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', onClick);
    d.addEventListener('cancel', e => { e.preventDefault(); back(); });
  }
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntKdClose = () => { back(); return true; };
  load(); paint();
}
function close() { const d = $('kdDlg'); try { d?.close(); } catch {} window.ntKdClose = null; }
function back() { if (menu) { menu = false; paint(); return; } if (mode !== 'list') { mode = 'list'; draft = null; paint(); return; } close(); }
async function load() {
  err = '';
  try {
    P = (await A.cloud.bachaList()).sort((a, b) => (a.at || 0) - (b.at || 0));
    paint();
    await Promise.all(P.map(async ph => { try { const docs = await A.cloud.bachaUse(ph.code); U[ph.code] = summarize(docs); clean(ph.code, docs, U[ph.code]); } catch (e) { U[ph.code] = { err: String(e?.code || e?.message || e) }; } }));
    try { const days = await A.cloud.bachaDays(); H = {}; for (const x of days) (H[x.code] || (H[x.code] = {}))[x.day] = x; } catch {}
  } catch (e) { err = String(e?.code || e?.message || e); P = P || []; }
  paint();
}
// 3 din se purana kacha data = din ka khulasa (bachaDay) + mita do (reads / jagah kam)
async function clean(code, docs, S) {
  try {
    const cut = pkDay(Date.now() - 2 * 864e5);
    for (const [day, D] of Object.entries(S.days || {})) {
      if (day >= cut) continue;
      const top = Object.entries(D.mins).sort((a, b) => b[1] - a[1]).slice(0, 12);
      const ev = {}; for (const e of D.ev) if (evName[e.k]) ev[e.k] = (ev[e.k] || 0) + 1;
      await A.cloud.bachaDaySet(code + '_' + day, { code, day, used: D.used, top: JSON.stringify(top), ev: JSON.stringify(ev), at: Date.now() });
      await A.cloud.bachaUseDel(D.ids);
    }
  } catch (e) { console.warn('bacha clean', e); }
}
async function save(code, patch, msg) {
  const ph = P.find(x => x.code === code); if (!ph) return;
  Object.assign(ph, patch); busy = code; paint();
  try { await A.cloud.bachaSet(code, { ...patch, at2: Date.now() }); A.notice((msg || '✅ Save') + ' — phone par 5 min mein'); }
  catch (e) { A.notice('❌ Save nahi hua: ' + (e?.code || e?.message || e)); load(); }
  busy = ''; paint();
}
const now = () => Math.floor(Date.now() / 1000);
const papaOn = ph => Number(ph.papa) > now();
const stopOn = ph => Number(ph.stop) > now();
const addOn = ph => Number(ph.addU) > now() ? Number(ph.add) || 0 : 0;
const lim = ph => Number(ph.lim) || DEF_LIM;

function paint() {
  const b = $('kdB'), m = $('kdMenu'); if (!b) return;
  $('kdT').textContent = mode === 'rules' ? '⚙️ Qaide — sab bachon ke phone' : mode === 'setup' ? '📲 Naya phone jorna' : '👶 Bachon ke phone';
  m.hidden = !menu; if (menu) m.innerHTML = `<div class="kd-row"><button type="button" class="kd-c pri" data-kd="add">➕ Naya phone</button><button type="button" class="kd-c" data-kd="rules">⚙️ Qaide (time · apps)</button><button type="button" class="kd-c" data-kd="setup">📲 Macro link / setup</button><button type="button" class="kd-c" data-kd="reload">🔄 Taza karo</button></div>`;
  if (mode === 'rules') { b.innerHTML = rulesHTML(); return; }
  if (mode === 'setup') { b.innerHTML = setupHTML(); return; }
  if (err) { b.innerHTML = `<div class="kd-empty"><b>⚠️ Data nahi aaya</b>${esc(err)}<br><small>Firestore rules (v2.96) PC par 5 min mein khud lagti hain — phir 🔄 Taza karo.</small></div>`; return; }
  if (!P) { b.innerHTML = '<div class="kd-empty">⏳ Load ho raha hai…</div>'; return; }
  if (!P.length) { b.innerHTML = `<div class="kd-empty"><b>Abhi koi phone nahi juda</b>⋮ → ➕ Naya phone se pehla phone jorein.<div class="kd-row c"><button type="button" class="kd-c pri" data-kd="add">➕ Naya phone</button></div></div>`; return; }
  b.innerHTML = P.map(cardHTML).join('');
}
function cardHTML(ph) {
  const S = U[ph.code], is = open === ph.code;
  const cap = lim(ph) + addOn(ph), used = S?.used || 0, left = Math.max(0, cap - used), pct = cap ? Math.min(100, Math.round(used / cap * 100)) : 0;
  const last = S?.last || 0, dot = !last ? '⚪' : (now() - last) < 1200 ? '🟢' : (now() - last) < 7200 ? '🟡' : '⚫';
  const top = Object.entries(S?.mins || {}).sort((a, b) => b[1] - a[1]);
  const evc = {}; for (const e of S?.ev || []) if (evName[e.k]) evc[e.k] = (evc[e.k] || 0) + 1;
  const badges = [papaOn(ph) ? `<i class="kd-bd g">🔓 Papa mode ${clock(Number(ph.papa))} tak</i>` : '', stopOn(ph) ? '<i class="kd-bd r">⏸ Aaj band</i>' : '', addOn(ph) ? `<i class="kd-bd b">➕ ${addOn(ph)} min aaj</i>` : '', busy === ph.code ? '<i class="kd-bd">⏳ save…</i>' : ''].join('');
  let h = `<div class="kd-card${is ? ' is-in' : ''}" data-kd-open="${esc(ph.code)}">
    <div class="kd-l1"><span>${dot} <b>${esc(ph.nm || 'Phone')}</b></span><small>${S?.err ? '⚠️ ' + esc(S.err) : last ? 'aakhri data ' + ago(last) + (S.bat ? ' · 🔋' + esc(S.bat) + '%' : '') : '⏳ abhi data nahi aaya'}</small></div>
    <div class="kd-big"><span>⏱ <b>${hm(used)}</b> dekha</span><span class="${left ? '' : 'over'}">${left ? '⏳ <b>' + hm(left) + '</b> bacha' : '⛔ <b>Time khatam</b>'}</span></div>
    <div class="kd-bar"><i style="width:${pct}%" class="${pct >= 100 ? 'over' : pct >= 85 ? 'warn' : ''}"></i></div>
    ${badges ? `<div class="kd-bds">${badges}</div>` : ''}
    ${top.length ? `<div class="kd-apps">${top.slice(0, is ? 30 : 3).map(([p, n]) => `<span data-kd-app="${esc(p)}">${esc(appName(p))} <b>${hm(n)}</b></span>`).join('')}</div>` : ''}
    ${Object.keys(evc).length ? `<div class="kd-ev">⚠️ ${Object.entries(evc).map(([k, n]) => esc(evName[k]) + ' ×' + n).join(' · ')}</div>` : ''}`;
  if (is) {
    const bl = (S?.ev || []).filter(e => e.k === 'B' || e.k === 'U').slice(-8).reverse();
    h += `<div class="kd-acts">
      <button type="button" class="kd-c" data-kd-act="add15">➕ 15 min</button><button type="button" class="kd-c" data-kd-act="add30">➕ 30 min</button>
      ${stopOn(ph) ? '<button type="button" class="kd-c pri" data-kd-act="unstop">▶ Phone kholo</button>' : '<button type="button" class="kd-c warn" data-kd-act="stop">⏸ Aaj band</button>'}
      ${papaOn(ph) ? '<button type="button" class="kd-c" data-kd-act="unpapa">🔒 Papa mode band</button>' : '<button type="button" class="kd-c" data-kd-act="papa">🔓 Papa mode 10 min</button>'}
      ${addOn(ph) ? '<button type="button" class="kd-c" data-kd-act="unadd">↺ Zyada time hatao</button>' : ''}
    </div>
    ${bl.length ? `<div class="kd-sub"><small>Aaj ki koshishein</small>${bl.map(e => `<div>${esc(e.tm)} · ${esc(evName[e.k])}${e.pk ? ' — ' + esc(appName(e.pk)) : ''}</div>`).join('')}</div>` : ''}
    ${histHTML(ph)}
    <p class="kd-note">Roz ki hadd: <b>${hm(lim(ph))}</b> (⚙️ Qaide se) · App par tap = us ko ✅ hamesha / ⏱ time / ⛔ band. Tabdeeli phone par 5 min mein.</p>
    <div class="kd-acts"><button type="button" class="kd-c" data-kd-act="name">✏️ Naam</button><button type="button" class="kd-c" data-kd-act="code">🔑 Code dikhao</button><button type="button" class="kd-c" data-kd-act="del">🗑 Phone hatao</button></div>`;
  }
  return h + '</div>';
}
function histHTML(ph) {
  const S = U[ph.code] || {}, M = { ...(H[ph.code] || {}) };
  for (const [d, D] of Object.entries(S.days || {})) M[d] = { day: d, used: D.used };
  const L = Object.values(M).sort((a, b) => b.day < a.day ? -1 : 1).slice(0, 7);
  if (L.length < 2) return '';
  const mx = Math.max(...L.map(x => x.used || 0), lim(ph));
  return `<div class="kd-sub"><small>📅 Pichhle din</small>${L.map(x => `<div class="kd-h7"><span>${x.day === pkDay(Date.now()) ? 'Aaj' : esc(x.day.slice(5))}</span><i><b style="width:${Math.round((x.used || 0) / mx * 100)}%"></b></i><em>${hm(x.used)}</em></div>`).join('')}</div>`;
}

// ---------- ⚙️ qaide (sab phones par ek saath) ----------
const setOf = s => new Set(String(s || '').split(',').filter(Boolean));
function rulesDraft() {
  const f = P?.[0] || {};
  return { lim: Number(f.lim) || DEF_LIM, allow: setOf(f.allow || ',' + DEF_ALLOW.join(',') + ','), block: setOf(f.block || ',' + DEF_BLOCK.join(',') + ',') };
}
const stateOf = ps => ps.every(p => draft.allow.has(p)) ? 'a' : ps.some(p => draft.block.has(p)) ? 'b' : 't';
function rulesHTML() {
  if (!draft) draft = rulesDraft();
  const known = new Set(KNOWN.flatMap(k => k[2]));
  const extra = [...draft.allow, ...draft.block].filter(p => !known.has(p) && !NAME[p]);
  const seen = new Set(); for (const S of Object.values(U)) for (const p of Object.keys(S?.mins || {})) if (!known.has(p) && !NAME[p]) seen.add(p);
  const chip = (lab, ps) => { const s = stateOf(ps); return `<button type="button" class="kd-q ${s}" data-kd-q="${esc(ps.join(' '))}"><b>${s === 'a' ? '✅' : s === 'b' ? '⛔' : '⏱'}</b> ${esc(lab)}</button>`; };
  return `<div class="kd-set">
    <h4>⏱ Roz ka time (sirf ⏱ wali apps ginti mein)</h4>
    <div class="kd-row">${[30, 45, 60, 80, 90, 120, 150].map(m => `<button type="button" class="kd-c${draft.lim === m ? ' is-in' : ''}" data-kd-lim="${m}">${hm(m)}</button>`).join('')}<button type="button" class="kd-c" data-kd-lim="?">✏️ Khud</button></div>
    <h4>📱 Apps — tap = ✅ Hamesha chale · ⏱ Time mein · ⛔ Hamesha band</h4>
    <div class="kd-qs">${KNOWN.map(([i, n, ps]) => chip(i + ' ' + n, ps)).join('')}</div>
    ${[...new Set([...extra, ...seen])].length ? `<h4>📦 Doosri apps (bachon ke phone par dekhi gayin)</h4><div class="kd-qs">${[...new Set([...extra, ...seen])].map(p => chip(appName(p).replace(/^📦 /, '') + ' · ' + p, [p])).join('')}</div>` : ''}
    <div class="kd-row"><button type="button" class="kd-c" data-kd="pkg">➕ Package naam se app</button><button type="button" class="kd-c" data-kd="defs">↺ Shuru wale qaide</button></div>
    <p class="kd-note">YouTube Shorts hamesha band (YouTube khud ⏱). Uninstall / naya app = ⛔ Install / Uninstall (🔓 Papa mode mein khulta hai). Settings / MacroDroid band rakhein warna bacha macro band kar sakta hai.</p>
    <div class="kd-row c"><button type="button" class="kd-c pri big" data-kd="saveRules">💾 Sab phones par lagao</button></div>
  </div>`;
}
function cycle(ps) {
  const s = stateOf(ps), nx = s === 'a' ? 't' : s === 't' ? 'b' : 'a';
  for (const p of ps) { draft.allow.delete(p); draft.block.delete(p); if (nx === 'a') draft.allow.add(p); if (nx === 'b') draft.block.add(p); }
}
async function saveRules() {
  if (!P?.length) { A.notice('Pehle ➕ Naya phone jorein'); return; }
  if (KNOWN.find(k => k[1] === 'Phone / Contacts')[2].some(p => draft.block.has(p))) { if (!confirm('Phone (call) band karna hai? Emergency call bhi nahi hogi.')) return; }
  const patch = { lim: String(draft.lim), allow: ',' + [...draft.allow].join(',') + ',', block: ',' + [...draft.block].join(',') + ',' };
  busy = 'rules'; paint();
  try { await Promise.all(P.map(ph => A.cloud.bachaSet(ph.code, { ...patch, at2: Date.now() }))); P.forEach(ph => Object.assign(ph, patch)); A.notice('✅ Qaide ' + P.length + ' phone par — 5 min mein lag jayenge'); mode = 'list'; draft = null; }
  catch (e) { A.notice('❌ Save nahi hua: ' + (e?.code || e?.message || e)); }
  busy = ''; paint();
}

// ---------- 📲 naya phone + setup ----------
function genCode() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = new Uint32Array(10); crypto.getRandomValues(r); return [...r].map(x => a[x % a.length]).join(''); }
async function addPhone() {
  const nm = (prompt('Phone ka naam (jaise: Zara ka phone)') || '').trim(); if (!nm) return;
  const f = P?.[0], code = genCode();
  const doc = { nm: nm.slice(0, 40), lim: String(f?.lim || DEF_LIM), add: '0', addU: '0', papa: String(now() + 1800), stop: '0',
    allow: f?.allow || ',' + DEF_ALLOW.join(',') + ',', block: f?.block || ',' + DEF_BLOCK.join(',') + ',', at: Date.now() };   // papa 30 min = setup ke dauran ijazatein (Settings) de sakein
  try { await A.cloud.bachaSet(code, doc, false); (P || (P = [])).push({ ...doc, code }); newCode = code; mode = 'setup'; menu = false; paint(); }
  catch (e) { A.notice('❌ Phone nahi bana: ' + (e?.code || e?.message || e)); }
}
function setupHTML() {
  const ph = P?.find(x => x.code === newCode);
  return `<div class="kd-set">
    ${ph ? `<div class="kd-code"><small>${esc(ph.nm)} ka code</small><b>${esc(ph.code)}</b><button type="button" class="kd-c" data-kd="copy">📋 Copy</button><em>Setup ke liye 30 min sab khula (🔓 Papa mode)</em></div>` : `<p class="kd-note">Har phone ka code: us phone ke card par tap → 🔑 Code dikhao.</p>`}
    <h4>Bache ke phone par (ek dafa, ~5 min)</h4>
    <ol>
      <li>Play Store se <b>MacroDroid</b> install karein (baad mein Play Store band ho jayega).</li>
      <li>Neeche wala <b>macro link</b> bache ke phone par kholein → MacroDroid mein <b>Import / Save</b>.</li>
      <li>Code poochhe to upar wala <b>code</b> likhein → "✅ Jur gaya" + patli awaaz aayegi.</li>
      <li>MacroDroid jo ijazat maange sab <b>Allow</b>: Accessibility, Usage access, Display over other apps, Battery = <b>Unrestricted</b>.</li>
      <li><b>Notification chhupana:</b> MacroDroid ki notification ko lamba dabayein → band (macro phir bhi chalta rahega).</li>
      <li>Awaaz na aaye to phone Settings → Text-to-speech → Google → <b>Hindi</b> awaaz download.</li>
      <li>Test: TikTok kholein → foran band. 10 min baad yahan data aa jayega.</li>
    </ol>
    <div class="kd-row c"><button type="button" class="kd-c pri" data-kd="wa">📲 Link WhatsApp par bhejo</button><button type="button" class="kd-c" data-kd="link">🔗 Link copy</button><a class="kd-c" href="${MACRO_URL}" download>📥 Macro file</a></div>
    <p class="kd-note">🛡 Sab se pakki rok: bache ke Gmail par Google <b>Family Link</b> (muft) — is ke saath bacha MacroDroid hata / phone reset nahi kar sakta.</p>
  </div>`;
}
async function copy(t, msg) { try { await navigator.clipboard.writeText(t); A.notice(msg || '📋 Copy ho gaya'); } catch { prompt('Copy karein:', t); } }

async function onClick(e) {
  const t = e.target.closest('[data-kd],[data-kd-open],[data-kd-act],[data-kd-lim],[data-kd-q],[data-kd-app]'); if (!t) return;
  const d = t.dataset;
  if (d.kd) {
    const k = d.kd; if (k !== 'menu') menu = false;
    if (k === 'back') return back();
    if (k === 'menu') { menu = !menu; return paint(); }
    if (k === 'add') return addPhone();
    if (k === 'rules') { mode = 'rules'; draft = null; return paint(); }
    if (k === 'setup') { mode = 'setup'; newCode = ''; return paint(); }
    if (k === 'reload') { P = null; U = {}; paint(); return load(); }
    if (k === 'saveRules') return saveRules();
    if (k === 'defs') { draft = { lim: DEF_LIM, allow: new Set(DEF_ALLOW), block: new Set(DEF_BLOCK) }; return paint(); }
    if (k === 'pkg') { const p = (prompt('App ka package naam (jaise com.example.game)') || '').trim().toLowerCase(); if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(p)) { if (p) A.notice('Package naam theek nahi'); return; } draft.block.add(p); return paint(); }
    if (k === 'copy') return copy(newCode, '📋 Code copy');
    if (k === 'link') return copy(MACRO_URL, '🔗 Link copy');
    if (k === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent('👶 Bachon ka phone — MacroDroid macro:\n' + MACRO_URL), '_blank'); return; }
    return;
  }
  if (d.kdLim) { let m = d.kdLim === '?' ? Number(prompt('Roz kitne minute? (jaise 80 = 1 ghanta 20 min)', String(draft.lim))) : Number(d.kdLim); if (!(m >= 5 && m <= 900)) return; draft.lim = Math.round(m); return paint(); }
  if (d.kdQ) { cycle(d.kdQ.split(' ')); return paint(); }
  if (d.kdApp && open !== t.closest('[data-kd-open]')?.dataset.kdOpen) { open = t.closest('[data-kd-open]')?.dataset.kdOpen || ''; return paint(); }
  if (d.kdApp) { e.stopPropagation(); const p = d.kdApp; mode = 'rules'; draft = null; paint(); setTimeout(() => $('kdB')?.querySelector(`[data-kd-q~="${CSS.escape(p)}"]`)?.scrollIntoView({ block: 'center' }), 50); return; }
  const card = t.closest('[data-kd-open]'), code = card?.dataset.kdOpen;
  if (d.kdAct && code) {
    e.stopPropagation(); const ph = P.find(x => x.code === code); if (!ph) return; const a = d.kdAct;
    if (a === 'add15' || a === 'add30') { const n = a === 'add15' ? 15 : 30; return save(code, { add: String(addOn(ph) + n), addU: String(endOfDay(Date.now())) }, `➕ ${n} min (aaj kul +${addOn(ph) + n})`); }
    if (a === 'unadd') return save(code, { add: '0', addU: '0' }, '↺ Zyada time hata');
    if (a === 'stop') return save(code, { stop: String(endOfDay(Date.now())) }, '⏸ Aaj phone band');
    if (a === 'unstop') return save(code, { stop: '0' }, '▶ Phone khul gaya');
    if (a === 'papa') return save(code, { papa: String(now() + 600) }, '🔓 Papa mode 10 min');
    if (a === 'unpapa') return save(code, { papa: '0' }, '🔒 Papa mode band');
    if (a === 'name') { const nm = (prompt('Naya naam', ph.nm || '') || '').trim(); if (nm) return save(code, { nm: nm.slice(0, 40) }, '✏️ Naam'); return; }
    if (a === 'code') { newCode = code; mode = 'setup'; return paint(); }
    if (a === 'del') {
      if (!confirm(`"${ph.nm}" hatana hai? Phone par macro aakhri qaide par chalta rahega magar data aana band — phone se macro bhi hatayein (🔓 Papa mode mein).`)) return;
      try { await A.cloud.bachaDel(code); P = P.filter(x => x.code !== code); A.notice('🗑 Hata diya'); } catch (er) { A.notice('❌ ' + (er?.code || er?.message || er)); }
      return paint();
    }
    return;
  }
  if (d.kdOpen) { open = open === d.kdOpen ? '' : d.kdOpen; paint(); }
}
