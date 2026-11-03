// a4-print.js — v1.0 (2026-11-03, app v2.174.0) 🖨 APP KI HAR TASVEER → HP (WiFi) printer par A4
//   Malik: "printer apps ke saath connect karna hai — hum apps mein kisi saman ki pic add karein to us ka auto print nikle" · printer WiFi HP ·
//   "jo picture upload karein" (sab). Doosri chat ka browser-print tareeqa NAHI (wo sirf usi device se) — yahan kisi bhi phone se → dukan ka PC chhapta hai.
// Kaam: app mein KAHIN bhi tasveer chuni (har <input type=file accept=image>, document 'change' capture — naya form khud shamil) →
//   2000px JPEG (≤ 880 KB) + 150px namoona → cloud.a4Queue = a4Img/<id> + a4Jobs/<id> {k, t, th, by, byName, status new, copies} (ek writeBatch)
//   → PC pc/a4-print.js (WiFi IPP: JPEG / PDF · ya Windows printer) → status printing / done / failed / hold / old.
// Setting (sirf malik, Settings → 🔌 "🖨 A4 printer"): blueAccess/a4 {on, pr (printer id), copies, up 1|2, k {qism: false = band}, max (ghante ki hadd),
//   ip (khud likha IP), scanAt / testAt (PC ko hukum)}. PC ki haalat blueAccess/a4Pc {list, use, st {k,t,ink}, err, at}.
//   PC 20 min se chup / printer nahi = tasveer queue NAHI (dher na lage) — malik ko paigham. Mulazim CAP `app.a4` (band = us ki tasveer print nahi).
// Saamne sirf chhapi tasveeron ki list (⏳ / 🖨 / ✅ / ✕ / ⏸ + 🖨 Dobara); baqi sab ⋮ (keyboard qaida). AI NAHI.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tms = v => typeof v === 'number' ? v : v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0;
const ago = ms => { if (!ms) return ''; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' ghante' : Math.floor(m / 1440) + ' din'; };
export const A4K = [['kh', '📒', 'Khata entry'], ['rz', '📷', 'Roznamcha'], ['pu', '🧾', 'Purchase / bill'], ['pt', '👤', 'Khate ki photo'], ['nt', '🔔', 'Notes'], ['ga', '🚚', 'Gaari'], ['fc', '🏭', 'Factory'], ['wb', '🏪', 'Online dukan / rack'], ['ai', '🤖', 'AI wali (agent · milan · tolai)']];
const KN = Object.fromEntries(A4K.map(([k, i, n]) => [k, i + ' ' + n]));
// kaun si tasveer (qism) — input se pehchano; naya form = 'kh' (ya data-a4-k="..")
const KS = [['ai', '#agCamIn,#agGalIn,[data-ml-cam],[data-ml-gal],#tallyFiles'], ['ga', '[data-gph]'], ['wb', '#wdCam,#wdGal'], ['fc', '[data-ph-file]'], ['rz', '#dayCapture'],
  ['pt', 'input[name="photo"],input[name="photo2"],input[name="phCam"],input[name="phGal"]'], ['pu', 'input[name="goods"],input[name="bill"]'], ['nt', 'input[name="pics"]']];
export function a4KindOf(inp) {
  const own = inp?.dataset?.a4K || inp?.closest?.('[data-a4-k]')?.dataset?.a4K; if (own) return own;
  for (const [k, sel] of KS) { try { if (inp.matches(sel)) return k; } catch {} }
  if (/roznamcha/i.test(inp?.closest?.('label')?.textContent || '')) return 'rz';
  return 'kh';
}
function labelOf(inp, k) {
  const d = inp?.closest?.('dialog'); let t = '';
  if (d) t = d.id === 'dialog' ? ($('dialogTitle')?.textContent || '') : (d.querySelector('h1,h2,h3,header b')?.textContent || '');
  t = String(t || '').replace(/\s+/g, ' ').trim();
  return (t || KN[k] || 'Tasveer').slice(0, 80);
}
let C = null, cfg = null, cfgErr = '', cfgStop = null, cfgWait = [], pc = null, pcStop = null, pcLoaded = false, jobs = [], jobStop = null, jobErr = '', timer = null;
const seen = new Map(), live = new Map(), st = { ip: '', busy: '' };
export function a4Setup(ctx) { C = ctx; const go = () => { if (!C.signedIn()) { setTimeout(go, 3000); return; } cfgListen(); }; go(); }   // login ke baad foran sun-na (pehli tasveer par intezar nahi)
function cfgListen() {
  if (cfgStop || !C?.cloud?.listenA4 || !C.signedIn()) return;
  cfgStop = C.cloud.listenA4((d, e) => {
    if (d === null) { cfgErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { cfgStop?.(); } catch {} cfgStop = null; }
    else { cfg = d; cfgErr = ''; }
    wake(); paint();
  });
  if (!pcStop && C.cloud.listenA4Pc) pcStop = C.cloud.listenA4Pc((d, e) => { pcLoaded = true; if (d === undefined) { try { pcStop?.(); } catch {} pcStop = null; wake(); return; } pc = d; wake(); paint(); });
}
const wake = () => { if ((cfg || cfgErr) && (pcLoaded || !pcStop)) { const w = cfgWait; cfgWait = []; w.forEach(f => f()); } };
const cfgNow = () => cfg && pcLoaded ? Promise.resolve(cfg) : new Promise(res => { cfgListen(); if (!cfgStop && !cfg) { res(null); return; } const t = setTimeout(() => res(cfg), 4000); cfgWait.push(() => { clearTimeout(t); res(cfg); }); wake(); });
const pcFresh = () => pc && pc.use && Date.now() - tms(pc.at) < 20 * 60000;
// ---------- tasveer → print ke qabil JPEG + namoona ----------
function prep(file) {
  return new Promise((res, rej) => {
    let url = ''; try { url = URL.createObjectURL(file); } catch (e) { rej(e); return; }
    const im = new Image();
    im.onload = () => {
      try {
        const W0 = im.naturalWidth || 1, H0 = im.naturalHeight || 1, cv = document.createElement('canvas'), cx = cv.getContext('2d');
        let k = Math.min(1, 2000 / Math.max(W0, H0)), q = 0.86, out = '';
        const draw = () => { cv.width = Math.max(1, Math.round(W0 * k)); cv.height = Math.max(1, Math.round(H0 * k)); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height); out = cv.toDataURL('image/jpeg', q); };
        draw();
        while (out.length > 880000 && q > 0.5) { q -= 0.08; out = cv.toDataURL('image/jpeg', q); }
        while (out.length > 880000 && k > 0.25) { k *= 0.8; draw(); }
        const s = Math.min(1, 150 / Math.max(W0, H0)), tc = document.createElement('canvas'); tc.width = Math.max(1, Math.round(W0 * s)); tc.height = Math.max(1, Math.round(H0 * s));
        const tx = tc.getContext('2d'); tx.fillStyle = '#fff'; tx.fillRect(0, 0, tc.width, tc.height); tx.drawImage(im, 0, 0, tc.width, tc.height);
        const th = tc.toDataURL('image/jpeg', 0.6);
        res({ img: out.length <= 900000 ? out : '', th: th.length < 30000 ? th : '' });
      } catch (e) { rej(e); } finally { try { URL.revokeObjectURL(url); } catch {} }
    };
    im.onerror = () => { try { URL.revokeObjectURL(url); } catch {} rej(Error('tasveer khuli nahi')); };
    im.src = url;
  });
}
// ---------- har tasveer (kahin bhi chuni) ----------
export async function a4Send(file, k = 'kh', t = '') {
  if (!C?.cloud?.a4Queue || !C.signedIn()) return false;
  if (!C.owner() && !C.can('app.a4')) return false;
  const c = await cfgNow(); if (!c || c.on === false || (c.k && c.k[k] === false)) return false;
  if (!pcFresh()) { if (C.owner() && Date.now() - (a4Send.nag || 0) > 30 * 60000) { a4Send.nag = Date.now(); C.notice('🖨 A4: dukan ke PC se printer ka jawab nahi — yeh tasveer print nahi hui (Settings → 🖨 A4 printer)'); } return false; }   // paigham 30 min mein ek dafa
  const key = [file.name, file.size, file.lastModified].join('|'), now = Date.now();
  for (const [x, at] of seen) if (now - at > 10 * 60000) seen.delete(x);
  if (seen.has(key)) return false; seen.set(key, now);
  try {
    const { img, th } = await prep(file); if (!img) throw Error('tasveer bohat bari / kharab');
    const name = t || KN[k] || 'Tasveer';
    const id = await C.cloud.a4Queue({ img, th, k, t: name, byName: C.name(), copies: Number(c.copies) || 1 });
    C.notice('🖨 ⏳ A4 printer ko bheji — ' + name.slice(0, 40));
    watch(id, name);
    return id;
  } catch (e) {
    seen.delete(key);
    C.notice(/permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? '🔐 A4 print: Firebase rules 2.84 abhi nahi lagi (PC 5 min mein khud lagata hai)' : '⚠️ A4 print nahi gaya: ' + (e?.message || e));
    return false;
  }
}
function watch(id, name) {
  if (!C.cloud.watchA4Job) return;
  let stop = null, last = 'new';
  const end = () => { try { stop?.(); } catch {} live.delete(id); };
  const to = setTimeout(() => { if (last === 'new' && C.owner()) C.notice('⚠️ A4: PC ne 3 min mein nahi chhapa — Settings → 🖨 A4 printer dekhein'); end(); }, 180000);
  stop = C.cloud.watchA4Job(id, d => {
    if (!d) return; if (d.status === last) return; last = d.status;
    if (d.status === 'done') { clearTimeout(to); C.notice('✅ A4 chhap gayi — ' + name.slice(0, 40)); end(); }
    else if (d.status === 'failed' || d.status === 'old') { clearTimeout(to); C.notice('✕ A4 nahi chhapi: ' + String(d.err || '').slice(0, 80)); end(); }
    else if (d.status === 'hold') { clearTimeout(to); C.notice('⏸ A4 ruki — ghante ki hadd poori (malik ✓ kare)'); end(); }
  });
  live.set(id, end);
}
// document capture: app ka apna handler (jo input.value = '' karta hai) is ke BAAD chalta hai
document.addEventListener('change', ev => {
  const inp = ev.target;
  if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'file' || !/image/i.test(inp.accept || '')) return;
  if (inp.closest?.('[data-a4-no]') || inp.dataset?.a4No) return;
  const files = [...(inp.files || [])].filter(f => /^image\//i.test(f.type || '') || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(f.name || '')).slice(0, 6);
  if (!files.length || !C) return;
  const k = a4KindOf(inp), t = labelOf(inp, k);
  for (const f of files) a4Send(f, k, t);
}, true);

// ---------- malik ki khirki ----------
const SL = { new: ['w', '⏳ PC ko'], printing: ['w', '🖨 Chhap raha'], done: ['ok', '✅ Chhap gayi'], failed: ['bad', '✕ Nahi chhapi'], old: ['bad', '✕ Purani'], hold: ['hold', '⏸ Ruki (hadd)'] };
function jobsListen() {
  if (jobStop || !C.cloud.listenA4Jobs) return;
  jobStop = C.cloud.listenA4Jobs(40, (L, e) => {
    if (!L) { jobErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { jobStop?.(); } catch {} jobStop = null; }
    else { jobs = L; jobErr = ''; }
    paint();
  });
}
const C3 = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-a4-${k}="${esc(v)}">${lab}</button>`;
function html() {
  const c = cfg || {}, p = pc || {}, use = p.use, fresh = pcFresh(), on = c.on !== false, s = p.st || null, stk = !p.at ? 'bad' : !fresh ? 'bad' : s?.k || 'w';
  const pill = `${use ? '🖨 ' + esc(use.name) : '🖨 Printer nahi mila'}${use && s ? ' · ' + esc(s.t) : ''} · Auto ${on ? 'ON' : 'BAND'}`;
  const pcAge = tms(p.at), pcLine = !p.at ? '🖥 Dukan ke PC ne abhi tak jawab nahi diya — PC ki nayi script 3–5 min mein khud lagti hai (KHATA-DOCTOR).'
    : Date.now() - pcAge > 20 * 60000 ? `🖥 Dukan ka PC ${ago(pcAge)} se chup — PC ON hai? (A4 tasveerein abhi nahi chhapengi)`
    : !use ? '🔎 ' + esc(p.err || 'WiFi par printer nahi mila — printer ON ho aur dukan ke PC wale WiFi / router par. ⋮ → 🔄 Dhoondo / IP likhein') : '';
  const warn = (cfgErr === 'rules' || jobErr === 'rules') ? '<p class="a4-err">🔐 Firebase rules 2.84 abhi nahi lagi — shop PC 5 min mein khud lagata hai.</p>' : pcLine ? `<p class="a4-err">${pcLine}</p>` : p.err && use ? `<p class="a4-err soft">⚠️ ${esc(p.err)}</p>` : '';
  const list = (p.list || []);
  const prBox = `<div class="a4-prs" data-mn-box="a4.pr" data-mn-i="🖨" data-mn-t="Printer chunein" data-mn-s="${esc(use ? use.name : 'koi nahi')}" data-mn-g="🖨 A4 printer">
      ${list.length ? list.map(x => `<button type="button" class="a4-pr${use && use.id === x.id ? ' is-in' : ''}" data-a4-pr="${esc(x.id)}"><b>${x.how === 'ipp' ? '📶' : '🖥'} ${esc(x.name)}</b><small>${x.how === 'ipp' ? 'WiFi · ' + esc(x.ip) + (x.fmt ? ' · ' + esc(x.fmt.replace(/image\/|application\//g, '')) : '') : 'Windows' + (x.ip ? ' · ' + esc(x.ip) : '') + (x.drv ? ' · ' + esc(x.drv) : '')}</small></button>`).join('') : '<small class="a4-mut">Abhi koi printer nahi mila</small>'}
      <div class="a4-row"><button type="button" class="a4-chip" data-a4-scan="1"${st.busy === 'scan' ? ' disabled' : ''}>${st.busy === 'scan' ? '⏳ Dhoond raha…' : '🔄 Dobara dhoondo'}</button>${p.scanAt ? `<small class="a4-mut">aakhri ${ago(tms(p.scanAt))} pehle</small>` : ''}</div>
      <label class="a4-ip"><small>Printer ka IP (khud na mile to — printer ke panel / WiFi report par likha)</small><span><input type="text" inputmode="decimal" data-a4-ipin="1" placeholder="192.168.1.50" value="${esc(st.ip || c.ip || '')}"><button type="button" class="a4-chip" data-a4-ipsave="1">✓ Save</button></span></label></div>`;
  const ink = s?.ink?.length ? `<div class="a4-inks" data-mn-box="a4.ink" data-mn-i="🎨" data-mn-t="Ink / haalat" data-mn-s="${esc(s.t)}" data-mn-g="🖨 A4 printer">${s.ink.map(x => `<div class="a4-ink"><span>${esc(x.n)}</span><i><b style="width:${Math.max(0, Math.min(100, x.l))}%;${/^#[0-9a-f]{6}$/i.test(x.c) ? 'background:' + x.c : ''}"></b></i><small>${x.l >= 0 ? x.l + '%' : '?'}</small></div>`).join('')}</div>` : '';
  const kOff = c.k || {};
  const rows = jobs.map(j => { const [cl, lab] = SL[j.status] || ['w', esc(j.status)];
    return `<div class="a4-card ${cl}">${j.th ? `<img src="${esc(j.th)}" alt="" loading="lazy">` : '<span class="a4-noth">🖼</span>'}<span class="a4-tx"><b>${esc(j.t || KN[j.k] || 'Tasveer')}</b><small>${esc((KN[j.k] || '').split(' ')[0])} ${esc(j.byName || '')} · ${ago(tms(j.at))}${j.pr ? ' · ' + esc(j.pr) : ''}</small>${j.err && j.status !== 'done' ? `<small class="a4-e">${esc(j.err)}</small>` : ''}</span>
      <span class="a4-act"><i class="a4-st ${cl}">${j.pend ? '⏳ bhej raha' : lab}</i>${['done', 'failed', 'old', 'hold'].includes(j.status) ? `<button type="button" class="a4-chip" data-a4-re="${esc(j.id)}">${j.status === 'hold' ? '✓ Chhapo' : '🖨 Dobara'}</button>` : ''}</span></div>`; }).join('');
  return `<div class="a4-root" data-a4-root="1">
    <button type="button" class="rk-pill a4-pill ${stk}" data-mn-sheet="1"><span>${pill}</span><i>⋮</i></button>
    ${warn}
    <div class="mchips" data-mn-seg="a4.on" data-mn-i="🖨" data-mn-t="Tasveer lagte hi A4 print" data-mn-g="🖨 A4 printer">${C3(on, 'on', '1', '✅ ON')}${C3(!on, 'on', '0', '⛔ BAND')}</div>
    ${prBox}
    <button type="button" class="a4-chip a4-test" data-a4-test="1" data-mn="a4.test" data-mn-i="🧪" data-mn-t="Test page chhapo" data-mn-s="printer theek hai? A4 + 100 mm lakeer" data-mn-g="🖨 A4 printer"${st.busy === 'test' ? ' disabled' : ''}>${st.busy === 'test' ? '⏳ Test page PC ko…' : '🧪 Test page'}</button>
    <div class="mchips" data-mn-seg="a4.cp" data-mn-i="📄" data-mn-t="Har tasveer ki copies" data-mn-g="🖨 A4 printer">${C3((Number(c.copies) || 1) === 1, 'cp', '1', '1 copy')}${C3(Number(c.copies) === 2, 'cp', '2', '2 copies')}</div>
    <div class="mchips" data-mn-seg="a4.up" data-mn-i="🗂" data-mn-t="Ek page par" data-mn-s="2 = kaghaz aadha (15 sec doosri ka intezar)" data-mn-g="🖨 A4 printer">${C3(Number(c.up) !== 2, 'up', '1', '1 tasveer · poori sheet')}${C3(Number(c.up) === 2, 'up', '2', '2 tasveer')}</div>
    <div class="mchips a4-ks" data-mn-box="a4.k" data-mn-i="🏷" data-mn-t="Kaun si tasveerein" data-mn-s="${A4K.filter(([k]) => kOff[k] === false).length ? A4K.filter(([k]) => kOff[k] === false).length + ' band' : 'sab ON'}" data-mn-g="🖨 A4 printer">${A4K.map(([k, i, n]) => `<button type="button" class="rc${kOff[k] === false ? '' : ' on'}" data-a4-kt="${k}">${kOff[k] === false ? '☐' : '☑'} ${i} ${esc(n)}</button>`).join('')}</div>
    <div class="mchips" data-mn-seg="a4.max" data-mn-i="⏱" data-mn-t="Ek ghante mein zyada se zyada" data-mn-s="ghalti se dher na chhape" data-mn-g="🖨 A4 printer">${[20, 40, 100].map(n => C3((Number(c.max) || 40) === n, 'max', n, n + ' page')).join('')}</div>
    ${ink}
    <h4 class="a4-h">🖼 Chhapi tasveerein <small>— aakhri ${jobs.length} · app mein kahin bhi tasveer lagao, yahan aayegi</small></h4>
    <div class="a4-list">${rows || '<p class="a4-mut a4-empty">Abhi koi tasveer nahi chhapi. Kisi bhi khirki mein 📷 tasveer lagao — dukan ke PC se HP par A4 nikle gi.</p>'}</div>
  </div>`;
}
function paint() {
  const r = document.querySelector('#dialogBody [data-a4-root]'); if (!r) return;
  const ip = document.querySelector('[data-a4-ipin]'); if (ip && document.activeElement === ip) { st.ip = ip.value; return; }   // likhte waqt dobara nahi
  r.outerHTML = html();
  try { window.ntDlgMenu?.(); } catch {}
}
export function a4Open() {
  if (!C) return;
  if (!C.owner()) { C.notice('🖨 A4 printer ki setting sirf malik'); return; }
  cfgListen(); jobsListen();
  C.modal('🖨 A4 printer', html(), true);
  setTimeout(() => { try { window.ntDlgMenu?.(); } catch {} }, 30);
  clearInterval(timer); timer = setInterval(() => { if (!document.querySelector('#dialogBody [data-a4-root]')) { clearInterval(timer); timer = null; try { jobStop?.(); } catch {} jobStop = null; return; } paint(); }, 30000);
}
async function setCfg(patch, msg) {
  if (!C.owner()) return;
  cfg = { ...(cfg || {}), ...patch, ...(patch.k ? { k: { ...((cfg || {}).k || {}), ...patch.k } } : {}) }; paint();   // pehle UI
  try { await C.cloud.setA4(patch); if (msg) C.notice(msg); }
  catch (e) { C.notice(/permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? '🔐 Ijazat nahi (rules)' : '✕ Save nahi hua: ' + (e?.message || e)); }
}
document.addEventListener('click', e => {
  if (e.target.closest?.('#a4Btn')) { a4Open(); return; }
  const b = e.target.closest?.('[data-a4-on],[data-a4-pr],[data-a4-scan],[data-a4-test],[data-a4-cp],[data-a4-up],[data-a4-kt],[data-a4-max],[data-a4-ipsave],[data-a4-re]');
  if (!b || !C) return;
  const d = b.dataset;
  if (d.a4On != null) { setCfg({ on: d.a4On === '1' }, d.a4On === '1' ? '🖨 A4 auto print ON' : '⛔ A4 auto print BAND'); return; }
  if (d.a4Pr) { const x = (pc?.list || []).find(y => y.id === d.a4Pr); setCfg({ pr: d.a4Pr, prIp: x?.ip || '' }, '🖨 Printer chuna: ' + (x?.name || d.a4Pr)); return; }
  if (d.a4Scan) { st.busy = 'scan'; setCfg({ scanAt: Date.now() }, '🔄 PC printer dhoond raha hai (10–20 sec)…'); setTimeout(() => { st.busy = ''; paint(); }, 20000); return; }
  if (d.a4Test) { if (!pcFresh() && !pc?.at) { C.notice('🖥 Dukan ka PC abhi jawab nahi de raha'); return; } st.busy = 'test'; setCfg({ testAt: Date.now() }, '🧪 Test page PC ko bheja — printer dekhein'); setTimeout(() => { st.busy = ''; paint(); }, 25000); return; }
  if (d.a4Cp) { setCfg({ copies: Number(d.a4Cp) === 2 ? 2 : 1 }); return; }
  if (d.a4Up) { setCfg({ up: Number(d.a4Up) === 2 ? 2 : 1 }); return; }
  if (d.a4Max) { setCfg({ max: Number(d.a4Max) || 40 }); return; }
  if (d.a4Kt) { const off = (cfg?.k || {})[d.a4Kt] === false; setCfg({ k: { [d.a4Kt]: off } }); return; }
  if (d.a4Ipsave) { const v = String(document.querySelector('[data-a4-ipin]')?.value || '').trim(); if (v && !/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) { C.notice('IP aisa likhein: 192.168.1.50'); return; } st.ip = ''; setCfg({ ip: v, scanAt: Date.now() }, v ? '✓ IP save — PC us par printer dhoond raha hai' : 'IP hata diya'); return; }
  if (d.a4Re) { if (!C.owner()) return; const j = jobs.find(x => x.id === d.a4Re); if (j) { j.status = 'new'; j.err = ''; paint(); } C.cloud.a4Again(d.a4Re).then(() => C.notice('🖨 Dobara PC ko bheji')).catch(er => C.notice('✕ ' + (er?.message || er))); }
});
