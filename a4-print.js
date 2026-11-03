// a4-print.js — v1.1 (2026-11-03 raat, app v2.175.0) 🖨 A4 PRINT — ALAG SCREEN
//   Malik: "wo aik ALEHDA screen ho jahan sirf us screen mein dali hui pictures auto A4 par niklein · baqi jaise chal raha hai waise chalta rehne do"
//          · "har mulazim default" · "wahan phone number bhi add kar sakein — wo number auto us tasveer par lag jaye" · "thermal printer par print ka option bhi".
//   (v1.0 / app v2.174.0 ne app ki HAR tasveer bhej di thi — meri ghalti, v2.174.1 mein band. Ab SIRF is screen ke `data-a4-in` input.)
// Screen (☰ "🖨 A4 Print" + malik ki Settings row): upar 📞 number (is phone par yaad) · kahan: 🖨 A4 / 🧾 Thermal / Dono · 📷 Camera · 🖼 Gallery (kai)
//   → tasveer chunte hi: A4 = 2000px JPEG + NEECHE SAFED PATTI mein number (bara) · Thermal = 640px saada JPEG + number (PC parchi par BARA likhta hai)
//   → cloud.a4Queue = a4Img/<id> + a4Jobs/<id> {k 'a4', to 'a4'|'th', ph, t, th (namoona), by, byName, status new, copies} (ek writeBatch)
//   → PC pc/a4-print.js v1.1: 'a4' = HP WiFi (IPP JPEG → A4 PDF → Windows) · 'th' = TM-T88IV parchi (NOOR TRADERS + tasveer + number + waqt).
// Neeche list: malik = sab ki · mulazim = sirf apni (is phone ki, localStorage) — ⏳ / 🖨 / ✅ / ✕ / ⏸ + 🖨 Dobara.
// ⋮ (sirf malik): printer chunein / 🔄 dhoondo / IP · 🧪 Test page · copies · ek page par 1/2 · ghante ki hadd · ink.
// CAP `app.a4` (default khula — malik: "har mulazim"). AI NAHI.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tms = v => typeof v === 'number' ? v : v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0;
const ago = ms => { if (!ms) return ''; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' ghante' : Math.floor(m / 1440) + ' din'; };
const LG = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, LS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
export const phClean = v => String(v || '').replace(/[^0-9+\-() ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
const TO = { a4: '🖨 A4', th: '🧾 Thermal', both: '🖨 + 🧾 Dono' };
let C = null, cfg = null, cfgErr = '', cfgStop = null, pc = null, pcStop = null, jobs = [], jobStop = null, jobErr = '', timer = null;
const st = { ph: LG('sam-a4-ph'), to: TO[LG('sam-a4-to')] ? LG('sam-a4-to') : 'a4', ip: '', busy: '' };
const pend = new Map(), mine = new Map(), mineStop = new Map();   // pend: abhi chuni (tayyar / bhej rahi) · mine: mulazim ke apne job
const mineIds = () => { try { return JSON.parse(LG('sam-a4-mine') || '[]').filter(x => typeof x === 'string').slice(0, 20); } catch { return []; } };
export function a4Setup(ctx) { C = ctx; window.ntA4Open = a4Open; }
function listen() {
  if (!C?.cloud?.listenA4 || !C.signedIn()) return;
  if (!cfgStop) cfgStop = C.cloud.listenA4((d, e) => {
    if (d === null) { cfgErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { cfgStop?.(); } catch {} cfgStop = null; }
    else { cfg = d; cfgErr = ''; }
    paint();
  });
  if (!pcStop && C.cloud.listenA4Pc) pcStop = C.cloud.listenA4Pc(d => { if (d === undefined) { try { pcStop?.(); } catch {} pcStop = null; return; } pc = d; paint(); });
  if (C.owner()) { if (!jobStop && C.cloud.listenA4Jobs) jobStop = C.cloud.listenA4Jobs(40, (L, e) => {
    if (!L) { jobErr = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { jobStop?.(); } catch {} jobStop = null; } else { jobs = L; jobErr = ''; }
    paint(); }); }
  else for (const id of mineIds()) watchMine(id);
}
function unlisten() {
  for (const f of [cfgStop, pcStop, jobStop]) { try { f?.(); } catch {} }
  cfgStop = pcStop = jobStop = null;
  for (const f of mineStop.values()) { try { f(); } catch {} } mineStop.clear();
}
function watchMine(id) {
  if (mineStop.has(id) || !C.cloud.watchA4Job) return;
  mineStop.set(id, C.cloud.watchA4Job(id, d => { const old = mine.get(id); if (d) mine.set(id, { id, ...d }); else mine.delete(id);
    if (old && d && old.status !== d.status && document.querySelector('#dialogBody [data-a4-root]')) {
      if (d.status === 'done') C.notice('✅ ' + (d.to === 'th' ? 'Thermal parchi' : 'A4') + ' chhap gayi');
      else if (d.status === 'failed' || d.status === 'old') C.notice('✕ Nahi chhapi: ' + String(d.err || '').slice(0, 80));
    }
    paint(); }));
}
const pcAlive = () => pc && Date.now() - tms(pc.at) < 20 * 60000;
const a4Ok = () => pcAlive() && !!pc.use;
// ---------- tasveer → A4 (number ki patti ke saath) + thermal (saada, chhoti) + namoona ----------
function prep(file, ph) {
  return new Promise((res, rej) => {
    let url = ''; try { url = URL.createObjectURL(file); } catch (e) { rej(e); return; }
    const im = new Image();
    im.onload = () => {
      try {
        const W0 = im.naturalWidth || 1, H0 = im.naturalHeight || 1, P = phClean(ph);
        const jpg = (maxPx, limit, stamp) => {
          const cv = document.createElement('canvas'), cx = cv.getContext('2d'); let k = Math.min(1, maxPx / Math.max(W0, H0)), q = 0.86, out = '';
          const draw = () => {
            const w = Math.max(1, Math.round(W0 * k)), h = Math.max(1, Math.round(H0 * k)), band = stamp && P ? Math.round(Math.max(70, Math.min(w, h * 1.4) * 0.13)) : 0;
            cv.width = w; cv.height = h + band; cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, w, h);
            if (band) {   // 📞 number — tasveer ke neeche safed patti, bara kaala
              cx.fillStyle = '#111'; cx.fillRect(0, h, w, Math.max(2, Math.round(band * 0.04)));
              const txt = '☎ ' + P; let fs = Math.round(band * 0.6); cx.font = `800 ${fs}px Arial, Helvetica, sans-serif`;
              while (cx.measureText(txt).width > w * 0.92 && fs > 10) { fs -= 2; cx.font = `800 ${fs}px Arial, Helvetica, sans-serif`; }
              cx.fillStyle = '#000'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, w / 2, h + band * 0.54);
            }
            out = cv.toDataURL('image/jpeg', q);
          };
          draw();
          while (out.length > limit && q > 0.5) { q -= 0.08; out = cv.toDataURL('image/jpeg', q); }
          while (out.length > limit && k > 0.2) { k *= 0.8; draw(); }
          return { out: out.length <= limit ? out : '', cv };
        };
        const A = jpg(2000, 880000, true), T = jpg(640, 200000, false);
        const s = Math.min(1, 150 / Math.max(A.cv.width, A.cv.height)), tc = document.createElement('canvas'); tc.width = Math.max(1, Math.round(A.cv.width * s)); tc.height = Math.max(1, Math.round(A.cv.height * s));
        tc.getContext('2d').drawImage(A.cv, 0, 0, tc.width, tc.height);
        const th = tc.toDataURL('image/jpeg', 0.6);
        res({ a4: A.out, small: T.out, th: th.length < 30000 ? th : '' });
      } catch (e) { rej(e); } finally { try { URL.revokeObjectURL(url); } catch {} }
    };
    im.onerror = () => { try { URL.revokeObjectURL(url); } catch {} rej(Error('tasveer khuli nahi')); };
    im.src = url;
  });
}
export async function a4Send(file) {
  if (!C?.cloud?.a4Queue || !C.signedIn()) return false;
  if (!C.owner() && !C.can('app.a4')) { C.notice('🖨 A4 Print ki ijazat nahi — malik se kahein'); return false; }
  const P = phClean(st.ph), dests = st.to === 'both' ? ['a4', 'th'] : [st.to];
  const go = dests.filter(d => d === 'th' ? pcAlive() : a4Ok());
  const tmp = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  let thumb = ''; try { thumb = URL.createObjectURL(file); } catch {}
  const t = P ? '📞 ' + P : 'Tasveer';
  if (!go.length) {
    const why = !pcAlive() ? '🖥 Dukan ka PC jawab nahi de raha — print nahi hogi' : '🖨 A4 printer nahi mila (malik: ⋮ → Printer chunein)';
    pend.set(tmp, { thumb, t, to: st.to, s: 'err', err: why, at: Date.now() }); paint(); C.notice('✕ ' + why); return false;
  }
  pend.set(tmp, { thumb, t, to: st.to, s: 'prep', at: Date.now() }); paint();
  try {
    const { a4, small, th } = await prep(file, P); if (!a4 || !small) throw Error('tasveer bohat bari / kharab');
    pend.get(tmp).s = 'send'; paint();
    const c = cfg || {};
    for (const to of go) {
      const id = await C.cloud.a4Queue({ img: to === 'a4' ? a4 : small, th, k: 'a4', to, ph: P, t, byName: C.name(), copies: Number(c.copies) || 1 });
      if (!C.owner()) { const L = [id, ...mineIds().filter(x => x !== id)].slice(0, 20); LS('sam-a4-mine', JSON.stringify(L)); mine.set(id, { id, to, t, th, ph: P, status: 'new', at: Date.now(), byName: C.name() }); watchMine(id); }
    }
    pend.delete(tmp); try { URL.revokeObjectURL(thumb); } catch {}
    C.notice('🖨 ⏳ ' + go.map(d => d === 'th' ? 'Thermal' : 'A4').join(' + ') + ' ko bheji' + (go.length < dests.length ? ' (' + (dests.includes('a4') && !go.includes('a4') ? 'A4 printer nahi mila' : 'PC chup') + ')' : ''));
    paint(); return true;
  } catch (e) {
    const m = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? '🔐 Firebase rules 2.85 abhi nahi lagi (PC 5 min mein khud lagata hai)' : String(e?.message || e);
    const p = pend.get(tmp); if (p) { p.s = 'err'; p.err = m; } paint(); C.notice('✕ Print nahi gaya: ' + m); return false;
  }
}
// SIRF is screen ke input (data-a4-in) — baqi app ki koi tasveer KABHI nahi (malik)
document.addEventListener('change', ev => {
  const inp = ev.target;
  if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'file' || !inp.hasAttribute('data-a4-in') || !C) return;
  const files = [...(inp.files || [])].filter(f => /^image\//i.test(f.type || '') || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(f.name || '')).slice(0, 10);
  inp.value = '';
  for (const f of files) a4Send(f);
});

// ---------- screen ----------
const SL = { new: ['w', '⏳ PC ko'], printing: ['w', '🖨 Chhap raha'], done: ['ok', '✅ Chhap gayi'], failed: ['bad', '✕ Nahi chhapi'], old: ['bad', '✕ Purani'], hold: ['hold', '⏸ Ruki (hadd)'] };
const C3 = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-a4-${k}="${esc(v)}">${lab}</button>`;
function cardHTML(j, own) {
  const [cl, lab] = j.pendS === 'prep' ? ['w', '⏳ Tayyar ho rahi'] : j.pendS === 'send' ? ['w', '⏳ Bhej rahi'] : j.pendS === 'err' ? ['bad', '✕ Nahi gayi'] : (SL[j.status] || ['w', esc(j.status)]);
  const img = j.thumb || j.th;
  return `<div class="a4-card ${cl}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="a4-noth">🖼</span>'}<span class="a4-tx"><b>${j.to === 'th' ? '🧾' : j.to === 'both' ? '🖨🧾' : '🖨'} ${esc(j.t || 'Tasveer')}</b><small>${esc(j.byName || '')}${j.byName ? ' · ' : ''}${ago(tms(j.at))}${j.pr ? ' · ' + esc(j.pr) : ''}</small>${j.err && j.status !== 'done' ? `<small class="a4-e">${esc(j.err)}</small>` : ''}</span>
    <span class="a4-act"><i class="a4-st ${cl}">${j.pend ? '⏳ bhej raha' : lab}</i>${j.id && ['done', 'failed', 'old', 'hold'].includes(j.status) && (C.owner() || own) ? `<button type="button" class="a4-chip" data-a4-re="${esc(j.id)}">${j.status === 'hold' && C.owner() ? '✓ Chhapo' : '🖨 Dobara'}</button>` : ''}</span></div>`;
}
function html() {
  const own = C.owner(), c = cfg || {}, p = pc || {}, use = p.use, s = p.st || null, alive = pcAlive();
  const stk = !alive ? 'bad' : !use ? 'warn' : s?.k || 'w';
  const pill = `${!alive ? '🖥 PC chup' : use ? '🖨 ' + esc(use.name) : '🖨 A4 printer nahi mila'}${alive && use && s ? ' · ' + esc(s.t) : ''}`;
  const pcLine = !p.at ? '🖥 Dukan ke PC ne abhi tak jawab nahi diya — PC ki nayi script 3–5 min mein khud lagti hai.'
    : !alive ? `🖥 Dukan ka PC ${ago(tms(p.at))} se chup — PC ON hai? (abhi print nahi hoga)`
    : !use && st.to !== 'th' ? '🔎 A4 printer nahi mila — printer ON ho aur dukan ke WiFi par.' + (own ? ' ⋮ → 🔄 Dhoondo / IP' : ' Malik ko batayein.') : '';
  const warn = (cfgErr === 'rules' || jobErr === 'rules') ? '<p class="a4-err">🔐 Firebase rules 2.85 abhi nahi lagi — shop PC 5 min mein khud lagata hai.</p>' : pcLine ? `<p class="a4-err">${pcLine}</p>` : p.err && use && own ? `<p class="a4-err soft">⚠️ ${esc(p.err)}</p>` : '';
  const list = p.list || [];
  const menu = !own ? '' : `<div class="a4-prs" data-mn-box="a4.pr" data-mn-i="🖨" data-mn-t="A4 printer chunein" data-mn-s="${esc(use ? use.name : 'koi nahi')}" data-mn-g="🖨 A4 Print">
      ${list.length ? list.map(x => `<button type="button" class="a4-pr${use && use.id === x.id ? ' is-in' : ''}" data-a4-pr="${esc(x.id)}"><b>${x.how === 'ipp' ? '📶' : '🖥'} ${esc(x.name)}</b><small>${x.how === 'ipp' ? 'WiFi · ' + esc(x.ip) + (x.fmt ? ' · ' + esc(String(x.fmt).replace(/image\/|application\//g, '')) : '') : 'Windows' + (x.ip ? ' · ' + esc(x.ip) : '') + (x.drv ? ' · ' + esc(x.drv) : '')}</small></button>`).join('') : '<small class="a4-mut">Abhi koi printer nahi mila</small>'}
      <div class="a4-row"><button type="button" class="a4-chip" data-a4-scan="1"${st.busy === 'scan' ? ' disabled' : ''}>${st.busy === 'scan' ? '⏳ Dhoond raha…' : '🔄 Dobara dhoondo'}</button>${p.scanAt ? `<small class="a4-mut">aakhri ${ago(tms(p.scanAt))} pehle</small>` : ''}</div>
      <label class="a4-ip"><small>Printer ka IP (khud na mile to — printer ke panel / WiFi report par likha)</small><span><input type="text" inputmode="decimal" data-a4-ipin="1" placeholder="192.168.1.50" value="${esc(st.ip || c.ip || '')}"><button type="button" class="a4-chip" data-a4-ipsave="1">✓ Save</button></span></label></div>
    <button type="button" class="a4-chip a4-test" data-a4-test="1" data-mn="a4.test" data-mn-i="🧪" data-mn-t="A4 test page" data-mn-s="printer theek hai? A4 + 100 mm lakeer" data-mn-g="🖨 A4 Print"${st.busy === 'test' ? ' disabled' : ''}>${st.busy === 'test' ? '⏳ Test page PC ko…' : '🧪 Test page'}</button>
    <div class="mchips" data-mn-seg="a4.cp" data-mn-i="📄" data-mn-t="Har tasveer ki copies" data-mn-g="🖨 A4 Print">${C3((Number(c.copies) || 1) === 1, 'cp', '1', '1 copy')}${C3(Number(c.copies) === 2, 'cp', '2', '2 copies')}</div>
    <div class="mchips" data-mn-seg="a4.up" data-mn-i="🗂" data-mn-t="A4 ek page par" data-mn-s="2 = kaghaz aadha (15 sec doosri ka intezar)" data-mn-g="🖨 A4 Print">${C3(Number(c.up) !== 2, 'up', '1', '1 tasveer · poori sheet')}${C3(Number(c.up) === 2, 'up', '2', '2 tasveer')}</div>
    <div class="mchips" data-mn-seg="a4.max" data-mn-i="⏱" data-mn-t="Ek ghante mein zyada se zyada" data-mn-s="ghalti se dher na chhape" data-mn-g="🖨 A4 Print">${[20, 40, 100].map(n => C3((Number(c.max) || 40) === n, 'max', n, n + ' page')).join('')}</div>
    ${s?.ink?.length ? `<div class="a4-inks" data-mn-box="a4.ink" data-mn-i="🎨" data-mn-t="Ink / haalat" data-mn-s="${esc(s.t)}" data-mn-g="🖨 A4 Print">${s.ink.map(x => `<div class="a4-ink"><span>${esc(x.n)}</span><i><b style="width:${Math.max(0, Math.min(100, x.l))}%;${/^#[0-9a-f]{6}$/i.test(x.c) ? 'background:' + x.c : ''}"></b></i><small>${x.l >= 0 ? x.l + '%' : '?'}</small></div>`).join('')}</div>` : ''}`;
  const rows = [...[...pend.values()].map(x => ({ ...x, pendS: x.s })).sort((a, b) => b.at - a.at), ...(own ? jobs : [...mine.values()].sort((a, b) => tms(b.at) - tms(a.at)))];
  return { top: `<div class="a4-top" data-a4-top="1">${own ? `<button type="button" class="rk-pill a4-pill ${stk}" data-mn-sheet="1"><span>${pill}</span><i>⋮</i></button>` : `<div class="rk-pill a4-pill ${stk}"><span>${pill}</span></div>`}${warn}</div>`,
    root: `<div class="a4-root" data-a4-root="1">${menu}
    <h4 class="a4-h">🖼 ${own ? 'Chhapi tasveerein' : 'Meri chhapi tasveerein'} <small>— aakhri ${rows.length}</small></h4>
    <div class="a4-list">${rows.map(j => cardHTML(j, !own)).join('') || '<p class="a4-mut a4-empty">📷 Camera ya 🖼 Gallery se tasveer lagao — foran print hogi.</p>'}</div></div>` };
}
// number + kahan + 📷 / 🖼 — EK dafa banta hai, kabhi dobara nahi (file picker khula ho to input DOM se na hate)
const padHTML = () => `<div class="a4-pad" data-a4-pad="1">
      <label class="a4-num"><span>📞 Number <small>— tasveer par likha jayega (khali = bina number)</small></span><span class="a4-numr"><input type="tel" inputmode="tel" data-a4-ph="1" maxlength="24" placeholder="0300-1234567" value="${esc(st.ph)}" autocomplete="off"><button type="button" class="a4-x" data-a4-phx="1" aria-label="Number hatao"${st.ph ? '' : ' hidden'}>✕</button></span></label>
      <div class="a4-to">${Object.entries(TO).map(([k, n]) => `<button type="button" class="a4-tc${st.to === k ? ' is-in' : ''}" data-a4-to="${k}">${n}</button>`).join('')}</div>
      <div class="a4-big"><label class="a4-pick">📷 Camera<input type="file" accept="image/*" capture="environment" data-a4-in="1" hidden></label><label class="a4-pick">🖼 Gallery<input type="file" accept="image/*" multiple data-a4-in="1" hidden></label></div>
    </div>`;
function padSync() {
  const P = document.querySelector('[data-a4-pad]'); if (!P) return;
  P.querySelectorAll('[data-a4-to]').forEach(b => b.classList.toggle('is-in', b.dataset.a4To === st.to));
  const x = P.querySelector('[data-a4-phx]'); if (x) x.hidden = !st.ph;
}
function paint() {
  const r = document.querySelector('#dialogBody [data-a4-root]'), t = document.querySelector('#dialogBody [data-a4-top]'); if (!r || !t) return;
  const H = html(); t.outerHTML = H.top;
  if (document.activeElement?.matches?.('[data-a4-ipin]')) return;   // IP likhte waqt neeche wala dobara nahi
  r.outerHTML = H.root; padSync();
  try { window.ntDlgMenu?.(); } catch {}
}
export function a4Open() {
  if (!C) return;
  if (!C.owner() && !C.can('app.a4')) { C.notice('🖨 A4 Print ki ijazat nahi — malik se kahein'); return; }
  listen();
  const H = html(); C.modal('🖨 A4 Print', `<div class="a4-all">${H.top}${padHTML()}${H.root}</div>`, true);
  setTimeout(() => { try { window.ntDlgMenu?.(); } catch {} }, 30);
  clearInterval(timer); timer = setInterval(() => { if (!document.querySelector('#dialogBody [data-a4-root]')) { clearInterval(timer); timer = null; unlisten(); return; } paint(); }, 30000);
}
async function setCfg(patch, msg) {
  if (!C.owner()) return;
  cfg = { ...(cfg || {}), ...patch }; paint();   // pehle UI
  try { await C.cloud.setA4(patch); if (msg) C.notice(msg); }
  catch (e) { C.notice(/permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? '🔐 Ijazat nahi (rules)' : '✕ Save nahi hua: ' + (e?.message || e)); }
}
document.addEventListener('input', e => { const i = e.target; if (i?.matches?.('[data-a4-ph]')) { st.ph = i.value; LS('sam-a4-ph', phClean(i.value)); padSync(); } else if (i?.matches?.('[data-a4-ipin]')) st.ip = i.value; });
document.addEventListener('click', e => {
  if (e.target.closest?.('#a4Btn,#a4Nav')) { a4Open(); return; }
  const b = e.target.closest?.('[data-a4-to],[data-a4-phx],[data-a4-pr],[data-a4-scan],[data-a4-test],[data-a4-cp],[data-a4-up],[data-a4-max],[data-a4-ipsave],[data-a4-re]');
  if (!b || !C) return;
  const d = b.dataset;
  if (d.a4To) { st.to = TO[d.a4To] ? d.a4To : 'a4'; LS('sam-a4-to', st.to); padSync(); paint(); return; }
  if (d.a4Phx) { st.ph = ''; LS('sam-a4-ph', ''); const i = document.querySelector('[data-a4-ph]'); if (i) i.value = ''; padSync(); return; }
  if (d.a4Re) { const j = (C.owner() ? jobs : [...mine.values()]).find(x => x.id === d.a4Re); if (j) { j.status = 'new'; j.err = ''; paint(); }
    C.cloud.a4Again(d.a4Re, C.owner()).then(() => C.notice('🖨 Dobara PC ko bheji')).catch(er => C.notice(/permission|insufficient/i.test(String(er?.code || '') + String(er?.message || '')) ? '🔐 Rules 2.85 abhi nahi lagi' : '✕ ' + (er?.message || er))); return; }
  if (!C.owner()) return;
  if (d.a4Pr) { const x = (pc?.list || []).find(y => y.id === d.a4Pr); setCfg({ pr: d.a4Pr, prIp: x?.ip || '' }, '🖨 Printer chuna: ' + (x?.name || d.a4Pr)); return; }
  if (d.a4Scan) { st.busy = 'scan'; setCfg({ scanAt: Date.now() }, '🔄 PC printer dhoond raha hai (10–20 sec)…'); setTimeout(() => { st.busy = ''; paint(); }, 20000); return; }
  if (d.a4Test) { if (!pcAlive()) { C.notice('🖥 Dukan ka PC abhi jawab nahi de raha'); return; } st.busy = 'test'; setCfg({ testAt: Date.now() }, '🧪 Test page PC ko bheja — printer dekhein'); setTimeout(() => { st.busy = ''; paint(); }, 25000); return; }
  if (d.a4Cp) { setCfg({ copies: Number(d.a4Cp) === 2 ? 2 : 1 }); return; }
  if (d.a4Up) { setCfg({ up: Number(d.a4Up) === 2 ? 2 : 1 }); return; }
  if (d.a4Max) { setCfg({ max: Number(d.a4Max) || 40 }); return; }
  if (d.a4Ipsave) { const v = String(document.querySelector('[data-a4-ipin]')?.value || '').trim(); if (v && !/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) { C.notice('IP aisa likhein: 192.168.1.50'); return; } st.ip = ''; setCfg({ ip: v, scanAt: Date.now() }, v ? '✓ IP save — PC us par printer dhoond raha hai' : 'IP hata diya'); }
});
