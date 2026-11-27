// =========================================================
//  pc-drives.js v1.0 (2026-11-20, app v2.334.0) — 💽 RECORDING KAHAN — Settings → 🖥️ PC scripts ka dabba (sirf malik)
//  Malik: "PC scripts mein poora drive show karwa do — C ya D dono · phir selection ka option · kis mein rakhna hai ·
//          us mein 10 din ki video bhi pari rahe".
//  PC bill-clip v2.16 → blueAccess/billClipPc.drv (har drive: khali / kul / recording) + dk (asal jagah, roz kitne GB, kitne din aa sakte).
//  Chunao → blueAccess/billClip {rdrv, rkd} (setBillClipPart — bina `at`, PC Rabta test / recording dobara nahi chalata).
//  Purani jagah ki recording move NAHI hoti — wahin parhi jati hai aur din pure kar ke khud mitti hai. AI nahi.
//  v1.1 (app v2.347.0, 22 Nov, malik: 'AI ko filhal band kar do aur script mein on karne ka option'): upar 🤖 Camera AI ki patli line (#pcAi) —
//    switch → blueAccess/gintiCam.ai 1 / 0 (saveGintiCam) · PC ginti-cam v2.1 jawab gintiPc.ai → ⏳ / ✅ / ⚫ chip. Default BAND.
//  v1.2 (app v2.378.0, 25 Nov, malik: 'WiFi pr shi chlta ha' — 4G par live '✕ Rabta nahi bana' · relay plan OK): sab se upar 🔁 Relay ka dabba (#pcRly) —
//    malik Cloudflare ka Turn Token ID + API Token paste kare → blueAccess/turnKey (SIRF malik; chaabi screen par dobara nahi dikhti, sirf aakhri 4 harf) →
//    PC live-cam v2.9 24 ghante ka chhota pass liveIce/cur → phone relay se jurta hai. Haal liveCamPc.tu (✅ pass N ghante / ✕ Cloudflare ki wajah / ⏳). AI nahi.
// =========================================================
let A = {}, wired = false, stop = null, pc = null, cfg = null, want = '', wantD = 0, busy = '';
let gc = null, gp = null, aiStop = null, aiWant = null, aiBusy = false;   // v1.1: 🤖 Camera AI (gintiCam / gintiPc)
const aiBox = () => document.getElementById('pcAi');
const box = () => document.getElementById('pcDrv');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : Math.floor(m / 60) + ' ghante pehle'; };
const DAYS = [0.125, 2, 5, 10, 15, 30, 60];   // v2.367.0: 0.125 = 3 ghante (har camera ki alag recording sirf bill video ke liye — lambi recording = 📼 Sab cameras)
const dl = n => n < 1 ? Math.round(n * 24) + ' ghante' : n + ' din';
const gb = x => x == null ? '?' : (x >= 100 ? Math.round(x) : (Math.round(x * 10) / 10)) + ' GB';

export function setup(deps) {
  A = deps || {};
  if (wired) return; wired = true;
  document.addEventListener('click', e => {
    const t = e.target.closest?.('[data-pdv]'); if (!t || !box()?.contains(t)) return;
    const k = t.dataset.pdv;
    if (k === 'd') pickDrive(t.dataset.d); else if (k === 'k') pickDays(Number(t.dataset.n)); else if (k === 'ref') open(true);
  });
  document.addEventListener('click', e => { const t = e.target.closest?.('[data-pai]'); if (t && aiBox()?.contains(t)) aiToggle(); });
  document.addEventListener('click', e => {   // v1.2: 🔁 relay
    const t = e.target.closest?.('[data-prl]'); if (!t || !rlBox()?.contains(t)) return;
    const k = t.dataset.prl;
    if (k === 'save') rlSave(); else if (k === 'rm') rlRemove();
    else if (k === 'ed') { rlEdit = true; rlErr = ''; rlPaint(true); setTimeout(() => document.getElementById('prlId')?.focus(), 50); }
    else if (k === 'cx') { rlEdit = false; rlErr = ''; rlPaint(true); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.id === 'prlTok' && rlBox()?.contains(e.target)) { e.preventDefault(); rlSave(); } });
  document.addEventListener('click', e => {   // v1.3: 🧾 posting nigrani
    const t = e.target.closest?.('[data-ppn]'); if (!t || !ppBox()?.contains(t)) return;
    const k = t.dataset.ppn;
    if (k === 'sw') ppToggle(); else if (k === 'ok') ppMine(t.dataset.h); else if (k === 'more') { ppMore = !ppMore; ppPaint(); } else if (k === 'auto') ppAuto();
  });
}

export async function open(force) {
  if (!box()) return;
  aiOpen(); rlOpen(); ppOpen();
  paint();
  try { cfg = await A.cloud.getBillClipCfg(); } catch { cfg = cfg || {}; }
  paint();
  if (!stop && A.cloud?.listenBillClipPc) stop = A.cloud.listenBillClipPc(d => { if (!box()) { try { stop && stop(); } catch {} stop = null; return; } pc = d; paint(); });
}

function curDays() { return Number(cfg?.rkd) > 0 ? Number(cfg.rkd) : (Number(pc?.rkd) > 0 ? Number(pc.rkd) : 10); }

function stChip() {
  if (!pc || !pc.at) return '<span class="pdv-st w">⏳ PC se list nahi aayi</span>';
  if (Date.now() - pc.at > 6 * 60000) return `<span class="pdv-st r">🔴 PC chup (${esc(ago(pc.at))})</span>`;
  if (!Array.isArray(pc.drv) || !pc.dk) return '<span class="pdv-st w">⏳ PC update ke 3-5 min baad</span>';
  const dk = pc.dk;
  if (want && dk.d !== want) return dk.err ? `<span class="pdv-st r">✕ ${esc(dk.err)}</span>` : `<span class="pdv-st w">⏳ ${esc(want)}: par le ja raha…</span>`;
  if (dk.err) return `<span class="pdv-st r">✕ ${esc(dk.err)}</span>`;
  if (wantD && Number(pc.rkd) !== wantD) return `<span class="pdv-st w">⏳ ${dl(wantD)} lag rahe…</span>`;
  return `<span class="pdv-st g">✅ Recording ${esc(dk.d)}: par</span>`;
}

function html() {
  const hd = `<div class="pdv-hd"><b>💽 Recording kahan</b>${stChip()}<button type="button" class="pdv-c sm" data-pdv="ref" title="Taza karo">🔄</button></div>`;
  if (!pc || !Array.isArray(pc.drv) || !pc.drv.length) {
    return `<div class="pdv-box">${hd}<p class="pdv-note">⏳ PC se drives ki list abhi nahi aayi. PC on ho to update ke 3-5 min baad yahan C, D… sab nazar aayengi (har 10 min taza).</p></div>`;
  }
  const dk = pc.dk || {}, act = dk.d || '', chosen = want || String(cfg?.rdrv || '');
  const rows = pc.drv.map(x => {
    const ok = x.t === 3 || x.t === 0, used = x.tot > 0 ? Math.max(2, Math.min(100, Math.round((x.tot - x.free) / x.tot * 100))) : 0;
    const kind = x.t === 2 ? '🔌 USB' : x.t === 4 ? '🌐 Network' : '';
    const sub = [gb(x.tot), x.lbl, x.sys ? 'Windows' : '', kind, x.use > 0 ? '📼 ' + gb(x.use) : ''].filter(Boolean).map(esc).join(' · ');
    const tag = x.d === act ? '<em class="pdv-tag g">✓ yahan</em>' : (x.d === chosen ? '<em class="pdv-tag w">⏳</em>' : (ok ? '' : '<em class="pdv-tag">✕</em>'));
    return `<button type="button" class="pdv-r${x.d === act ? ' is-in' : ''}" data-pdv="d" data-d="${esc(x.d)}"${ok && !busy ? '' : ' disabled'}>
      <span class="pdv-ic">💽</span><span class="pdv-nm"><b>${esc(x.d)}:</b><small>${sub || '&nbsp;'}</small></span>
      <span class="pdv-sz"><i class="pdv-bar"><i style="width:${used}%"></i></i><small>${gb(x.free)} khali</small></span>${tag}</button>`;
  }).join('');
  const days = curDays();
  const chips = DAYS.map(n => `<button type="button" class="pdv-c${n === days ? ' is-in' : ''}" data-pdv="k" data-n="${n}"${busy ? ' disabled' : ''}>${dl(n)}</button>`).join('');
  let info = '';
  if (dk.day > 0) {
    info = `<p class="pdv-ln">📼 Abhi recording ${gb(dk.used)} · roz ${dk.est ? '≈' : ''}${gb(dk.day)} · ${esc(act)}: par ≈ <b>${Number(dk.can) || 0} din</b> ki jagah</p>`;
    const need = dk.day * days;
    if (dk.can && days > dk.can) info += `<p class="pdv-ln r">⚠️ ${dl(days)} ≈ ${gb(need)} — ${esc(act)}: par sirf ≈ ${dk.can} din ki jagah. Jagah 25 GB se kam hui to sab se purani recording pehle mitegi.</p>`;
    else info += `<p class="pdv-ln g">✓ ${dl(days)} ≈ ${gb(need)} — aaram se aa jayegi</p>`;
    if (dk.est) info += '<p class="pdv-note">≈ = abhi 1 din se kam recording hai, kal tak pakka hisaab.</p>';
  } else info = '<p class="pdv-note">⏳ Roz kitne GB lagte hain — recording ke 10-20 min baad yahan.</p>';
  return `<div class="pdv-box">${hd}<p class="pdv-note">Camera ki recording kis hard par rahe — drive par tap karein.</p>
    <div class="pdv-list">${rows}</div>
    <div class="pdv-days"><span>📅 Kitne din rakhein</span>${chips}</div>${info}
    <p class="pdv-note">Drive badli to purani recording wahin se ${dl(days)} pure kar ke khud mitegi (move nahi hoti). Bill video / WhatsApp waqt ki video / ginti dono jagah se chalti hai. AI nahi.</p></div>`;
}
function paint() { const b = box(); if (b) b.innerHTML = html(); }

async function pickDrive(d) {
  if (!d || busy) return;
  const x = (pc?.drv || []).find(y => y.d === d); if (!x) return;
  if (pc?.dk?.d === d && !want) { A.notice?.(`✓ Recording pehle se ${d}: par hai`); return; }
  const days = curDays();
  if (!confirm(`💽 Camera ki recording ab ${d}: drive par hogi (sab cameras).\n\n${d}: par ${gb(x.free)} khali hai.\nPurani recording jahan hai wahin se ${dl(days)} pure kar ke khud mitegi.\n\nOK?`)) return;
  busy = 'd'; want = d; paint();
  try { await A.cloud.setBillClipPart({ rdrv: d }); cfg = { ...(cfg || {}), rdrv: d }; A.notice?.(`⏳ ${d}: par recording shuru ho rahi hai — PC 1-2 min mein bata dega`); }
  catch (e) { want = ''; A.notice?.('✕ ' + (e?.message || e)); }
  busy = ''; paint();
}

async function pickDays(n) {
  if (!(n > 0) || busy || n === curDays()) return;
  if (n < curDays() && !confirm(`📅 Har camera ki alag recording ab sirf ${dl(n)} rakhi jayegi.\n\nIs se purani recording MIT jayegi — wapas nahi aati.\n\nOK?`)) return;
  busy = 'k'; wantD = n; paint();
  try { await A.cloud.setBillClipPart({ rkd: n }); cfg = { ...(cfg || {}), rkd: n }; A.notice?.(`✓ Recording ${dl(n)} rakhi jayegi`); }
  catch (e) { wantD = 0; A.notice?.('✕ ' + (e?.message || e)); }
  busy = ''; paint();
}

// ---------- 🤖 v1.1: Camera AI (godam) — band / chalu (sirf malik) ----------
function aiOpen() {
  if (!aiBox()) { const b = box(); if (!b) return; const d = document.createElement('div'); d.id = 'pcAi'; b.before(d); }
  aiPaint();
  if (aiStop || !A.cloud?.listenGintiCam) return;
  const u1 = A.cloud.listenGintiCam(d => { if (!aiBox()) return aiOff(); gc = d || {}; if (aiWant != null && (Number(gc.ai) === 1) === aiWant) aiWant = null; aiPaint(); });
  const u2 = A.cloud.listenGintiPc ? A.cloud.listenGintiPc(d => { if (!aiBox()) return aiOff(); gp = d; aiPaint(); }) : () => {};
  aiStop = () => { try { u1(); } catch {} try { u2(); } catch {} };
}
function aiOff() { try { aiStop && aiStop(); } catch {} aiStop = null; }
function aiOn() { return aiWant != null ? aiWant : !!(gc && Number(gc.ai) === 1); }
function aiChip() {
  if (!gc) return '<span class="pai-st w">⏳</span>';
  const on = aiOn();
  if (aiBusy || aiWant != null) return `<span class="pai-st w">⏳ ${on ? 'chalu' : 'band'} ho rahi…</span>`;
  if (!gp || !gp.at) return `<span class="pai-st w">${on ? '⏳ PC ka jawab nahi' : '⚫ Band'}</span>`;
  if (Date.now() - Number(gp.at) > 12 * 60000) return `<span class="pai-st r">🔴 PC chup (${esc(ago(Number(gp.at)))})</span>`;
  if (gp.ai == null) return '<span class="pai-st w">⏳ PC update (3-5 min)</span>';
  if ((Number(gp.ai) === 1) !== on) return `<span class="pai-st w">⏳ PC ${on ? 'chalu' : 'band'} kar raha…</span>`;
  if (on && !gc.on) return '<span class="pai-st r">⚠️ Loading ginti ⚙️ mein camera BAND</span>';
  return on ? '<span class="pai-st g">✅ Chalu</span>' : '<span class="pai-st">⚫ Band</span>';
}
function aiPaint() {
  const b = aiBox(); if (!b) return; const on = aiOn();
  b.innerHTML = `<div class="pai-box"><div class="pai-r"><span class="pai-ic">🤖</span><span class="pai-nm"><b>Camera AI (godam)</b><small>carton ginti · 🧍 pose · 🙂 chehra · 🚨 bina note · HD</small></span>${aiChip()}
    <button type="button" class="pai-sw${on ? ' is-in' : ''}" data-pai="t" aria-label="Camera AI ${on ? 'band karo' : 'chalu karo'}"${aiBusy || !gc ? ' disabled' : ''}><i></i></button></div>
    <p class="pai-note">${on ? 'PC ka apna model chalta hai (internet nahi). Band karo to CPU / hard halki — recording, bill video, live waise hi.' : 'Abhi band hai — recording, bill video, gate pass video, live sab chal rahe hain. Switch dabayein to AI chalu (PC 1 min mein).'}</p></div>`;
}
async function aiToggle() {
  if (aiBusy || !gc) return; const nx = !aiOn();
  if (nx && !confirm('🤖 Godam camera ki AI chalu karein?\n\nCarton ginti, 🧍 pose, 🙂 chehra, 🚨 bina note alarm aur godam camera ki HD recording shuru ho jayegi (PC ka CPU aur hard zyada lagegi).')) return;
  aiBusy = true; aiWant = nx; aiPaint();
  try { await A.cloud.saveGintiCam({ ai: nx ? 1 : 0 }); A.notice?.(nx ? '🤖 Camera AI chalu — PC 1 min mein' : '⚫ Camera AI band — PC 1 min mein'); }
  catch (e) { aiWant = null; A.notice?.('✕ ' + (e?.message || e)); }
  aiBusy = false; aiPaint();
}

// ---------- 🔁 v1.2: RELAY — 4G par live (Cloudflare TURN chaabi · sirf malik) ----------
let rl = null, rlPc = null, rlStop = null, rlBusy = false, rlEdit = false, rlErr = '';
const rlBox = () => document.getElementById('pcRly');
const CF_URL = 'https://dash.cloudflare.com/?to=/:account/calls';
const RL_ID = /^[A-Za-z0-9_-]{16,80}$/, RL_TOK = /^[A-Za-z0-9_.-]{20,300}$/;
function rlOpen() {
  if (!rlBox()) { const ref = aiBox() || box(); if (!ref) return; const d = document.createElement('div'); d.id = 'pcRly'; ref.before(d); }
  rlPaint(true);
  if (A.cloud?.getTurnKey) A.cloud.getTurnKey().then(d => { rl = d || {}; rlPaint(true); })
    .catch(e => { rl = { _err: /permission|insufficient/i.test(String(e?.code || '') + ' ' + String(e?.message || '')) ? 'sirf malik' : 'parh nahi saka — 🔄' }; rlPaint(true); });
  if (!rlStop && A.cloud?.listenLiveCamPc) rlStop = A.cloud.listenLiveCamPc(d => { if (!rlBox()) { try { rlStop && rlStop(); } catch {} rlStop = null; return; } rlPc = d; rlPaint(false); });
}
const rlHas = () => !!(rl && RL_ID.test(String(rl.id || '')) && RL_TOK.test(String(rl.tok || '')));
const rlMine = t => !!(t && rl && t.k4 === String(rl.id || '').slice(-4));   // PC ka haal ISI chaabi ka hai (aakhri 4 harf)
function rlChip() {
  const c = (k, s) => `<span id="prlSt" class="pai-st${k ? ' ' + k : ''}">${s}</span>`;
  if (!rl) return c('w', '⏳');
  if (rl._err) return c('r', '✕ ' + esc(rl._err));
  if (rlBusy) return c('w', '⏳ lag rahi…');
  if (!rlHas()) return c('', '⚫ Band');
  const t = rlPc && rlPc.tu, at = Number(rlPc?.at) || 0;
  if (!at) return c('w', '⏳ PC ka jawab nahi');
  if (Date.now() - at > 6 * 60000) return c('r', `🔴 PC chup (${esc(ago(at))})`);
  if (!t) return c('w', '⏳ PC update (3-5 min)');
  if (!rlMine(t)) return c('w', '⏳ PC pass bana raha…');
  if (t.ok && Number(t.exp) > Date.now()) return c('g', '✅ Chalu');
  if (t.err) return c('r', '✕ Nahi laga');
  return c('w', '⏳ PC pass bana raha…');
}
function rlMsg() {
  if (rlErr) return `<p class="pdv-ln r">✕ ${esc(rlErr)}</p>`;
  const t = rlPc && rlPc.tu;
  if (rlHas() && rlMine(t) && t.err) return `<p class="pdv-ln r">✕ ${esc(t.err)}</p>`;
  if (rlHas() && rlMine(t) && t.ok && Number(t.exp) > Date.now()) return `<p class="pai-note">4G par live ab relay se judegi (pass ${Math.max(1, Math.round((Number(t.exp) - Date.now()) / 3600000))} ghante · PC khud naya banata hai) · Wi-Fi par seedha hi.</p>`;
  return '';
}
function rlForm() {
  return `<div class="prl-f"><input id="prlId" class="prl-in" placeholder="Turn Token ID" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <input id="prlTok" class="prl-in" type="password" placeholder="API Token" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button type="button" class="pdv-c is-in" data-prl="save"${rlBusy ? ' disabled' : ''}>💾 Lagao</button>${rlHas() ? '<button type="button" class="pdv-c" data-prl="cx" aria-label="Rehne do">✕</button>' : ''}</div>
    <details class="prl-how"${rlHas() ? '' : ' open'}><summary>Chaabi kaise milegi? (ek dafa, muft)</summary><ol>
      <li><a href="${CF_URL}" target="_blank" rel="noopener">Cloudflare kholein</a> — muft account banayein (email + password · card nahi chahiye).</li>
      <li>Baayein menu: <b>Realtime</b> → <b>TURN Server</b> → <b>Create</b>.</li>
      <li>Naam <b>noor</b> likh kar <b>Create</b>.</li>
      <li><b>Turn Token ID</b> aur <b>API Token</b> copy kar ke upar paste → 💾 Lagao.</li></ol>
      <p class="pdv-note">Har mahine 1,000 GB muft — live dekhne mein is ka thora sa hissa lagta hai. Yeh chaabi chat / WhatsApp mein kabhi na bhejein.</p></details>`;
}
function rlPaint(full) {
  const b = rlBox(); if (!b) return;
  const st = b.querySelector('#prlSt'), ms = b.querySelector('#prlMsg');
  if (!full && st && ms) { st.outerHTML = rlChip(); ms.innerHTML = rlMsg(); return; }   // haal badla = sirf chip / line (likhte waqt form dobara nahi — focus na toote)
  const has = rlHas();
  const body = !rl || rl._err ? '' : (!has || rlEdit) ? rlForm()
    : `<div class="prl-r2"><span>🔑 Chaabi lagi (…${esc(String(rl.id).slice(-4))})</span><button type="button" class="pdv-c sm" data-prl="ed">✏️ Badlo</button><button type="button" class="pdv-c sm" data-prl="rm">✕ Hatao</button></div>`;
  const vi = document.getElementById('prlId')?.value || '', vt = document.getElementById('prlTok')?.value || '';
  b.innerHTML = `<div class="pai-box prl-box"><div class="pai-r"><span class="pai-ic">🔁</span><span class="pai-nm"><b>Relay — 4G par live</b><small>Wi-Fi par live seedha · 4G / dukan ke bahar is relay se</small></span>${rlChip()}</div><div id="prlMsg">${rlMsg()}</div>${body}</div>`;
  if (vi) { const e = document.getElementById('prlId'); if (e) e.value = vi; }
  if (vt) { const e = document.getElementById('prlTok'); if (e) e.value = vt; }
}
async function rlSave() {
  if (rlBusy) return;
  const id = (document.getElementById('prlId')?.value || '').replace(/\s+/g, ''), tok = (document.getElementById('prlTok')?.value || '').replace(/\s+/g, '');
  if (!RL_ID.test(id)) { rlErr = 'Turn Token ID theek nahi lag raha — Cloudflare se poora copy karein'; rlPaint(true); return; }
  if (!RL_TOK.test(tok)) { rlErr = 'API Token theek nahi lag raha — Cloudflare se poora copy karein'; rlPaint(true); return; }
  rlErr = ''; rlBusy = true; rlPaint(true);
  try { await A.cloud.saveTurnKey({ id, tok }); rl = { id, tok, at: Date.now() }; rlEdit = false; A.notice?.('⏳ Relay lag raha — PC 1 min mein pass bana kar yahan ✅ dikhayega'); }
  catch (e) { rlErr = 'Save nahi hua: ' + String(e?.message || e); }
  rlBusy = false; rlPaint(true);
}
async function rlRemove() {
  if (rlBusy || !confirm('🔁 Relay hatayein?\n\n4G par live phir nahi judegi (Wi-Fi par chalti rahegi).')) return;
  rlBusy = true; rlPaint(true);
  try { await A.cloud.saveTurnKey({ id: '', tok: '' }); rl = { id: '', tok: '', at: Date.now() }; rlEdit = false; A.notice?.('⚫ Relay hata diya'); }
  catch (e) { rlErr = 'Nahi hua: ' + String(e?.message || e); }
  rlBusy = false; rlPaint(true);
}

// ---------- 🧾 v1.3 (app v2.393.0, 27 Nov, malik: 'es system ka ilawa koi aur system voucher posting mein involved ho to mujhe WhatsApp par text — time, naam' ·
//   'chip PC script mein hi'): POSTING NIGRANI — PC pos-sales-dekho v2.20 + post-pc.js: posted bill ki POS likhai ('… Post… By: On: at PC:') se PC + login +
//   waqt; 'apna' PC na ho = malik ko WhatsApp. Setting blueAccess/postPc {on, ok:[host]} (sirf malik) · haal blueAccess/postPcSt (PC). ok khali = PC khud
//   chunta hai (3 din mein sab se zyada posting). Patli line + PC ki list (✅ Apna). AI nahi. ----------
let pp = null, ppSt = null, ppStop = null, ppBusy = false, ppMore = false;
const ppBox = () => document.getElementById('pcPst');
const ppTm = t => { if (!t) return ''; const d = new Date(Number(t)); let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap; };
const ppSame = (k, h) => { k = String(k || '').toUpperCase(); h = String(h || '').toUpperCase(); return k === h || 'DESKTOP-' + k === h || k === 'DESKTOP-' + h; };
function ppOpen() {
  if (!ppBox()) { const b = box(); if (!b) return; const d = document.createElement('div'); d.id = 'pcPst'; b.before(d); }
  ppPaint();
  if (ppStop || !A.cloud?.listenPostPc) return;
  const u1 = A.cloud.listenPostPc(d => { if (!ppBox()) return ppOff(); if (!ppBusy) pp = d || {}; ppPaint(); });
  const u2 = A.cloud.listenPostPcSt ? A.cloud.listenPostPcSt(d => { if (!ppBox()) return ppOff(); ppSt = d; ppPaint(); }) : () => {};
  ppStop = () => { try { u1(); } catch {} try { u2(); } catch {} };
}
function ppOff() { try { ppStop && ppStop(); } catch {} ppStop = null; }
const ppOn = () => !pp || pp.on !== false;
const ppMineList = () => Array.isArray(pp?.ok) ? pp.ok.map(x => String(x || '').toUpperCase()).filter(Boolean) : [];
const ppOk = () => { const m = ppMineList(); return m.length ? m : (Array.isArray(ppSt?.ok) ? ppSt.ok.map(x => String(x || '').toUpperCase()) : []); };
const ppHs = () => { try { const a = JSON.parse(ppSt?.hs || '[]'); return Array.isArray(a) ? a.filter(x => Array.isArray(x) && x[0]) : []; } catch { return []; } };
function ppChip() {
  const c = (k, s) => `<span class="pai-st${k ? ' ' + k : ''}">${s}</span>`;
  if (!pp) return c('w', '⏳');
  if (ppBusy) return c('w', '⏳ save…');
  const s = ppSt;
  if (!s || !s.at) return c('w', ppOn() ? '⏳ PC update (3-5 min)' : '⚫ Band');
  if (Date.now() - Number(s.at) > 25 * 60000) return c('r', `🔴 PC chup (${esc(ago(Number(s.at)))})`);
  if (!ppOn()) return c('', '⚫ Band');
  if (s.err) return c('r', '⚠️ ' + esc(String(s.err).slice(0, 40)));
  if (!ppHs().length && Number(s.nh) > 0) return c('r', '⚠️ POS likhai mein PC nahi mila');
  return c('g', '✅ Chalu');
}
function ppPaint() {
  const b = ppBox(); if (!b) return;
  const on = ppOn(), s = ppSt || {}, hs = ppHs(), mine = ppMineList().length > 0, ok = ppOk();
  const nm = h => { const r = hs.find(x => ppSame(x[0], h)); return r ? r[1] : String(h || '').replace(/^DESKTOP-/i, ''); };
  const list = (ppMore ? hs : hs.slice(0, 6)).map(([h, n1, n, at, by, n3]) => {
    const isOk = ok.some(k => ppSame(k, h)), host = String(h).toUpperCase().endsWith(String(n1).toUpperCase()) ? '' : h;
    const sub = [host, 'aaj ' + (Number(n) || 0), Number(n3) ? '3 din ' + Number(n3) : '', at ? 'aakhri ' + ppTm(at) : '', by ? '👤 ' + by : ''].filter(Boolean).map(esc).join(' · ');
    return `<div class="pps-r${isOk ? ' ok' : ''}"><span class="pps-nm"><b>🖥 ${esc(n1)}</b><small>${sub}</small></span>
      <button type="button" class="pps-ok${isOk ? ' is-in' : ''}" data-ppn="ok" data-h="${esc(h)}"${ppBusy || !pp ? ' disabled' : ''}>${isOk ? '✅ Apna' : '☐ Apna'}</button></div>`;
  }).join('');
  const more = hs.length > 6 ? `<button type="button" class="pps-more" data-ppn="more">${ppMore ? '▲ Kam' : '＋ ' + (hs.length - 6) + ' aur PC'}</button>` : '';
  const la = s.la && s.la.at ? `<p class="pai-note">📲 Aakhri paigham: ${esc(ppTm(s.la.at))} · ${esc(nm(s.la.host))} · ${Number(s.la.n) || 0} bill${Number(s.al) ? ' · aaj ' + Number(s.al) + ' paigham' : ''}</p>` : '';
  const smp = !hs.length && Number(s.nh) > 0 && s.smp ? `<p class="pai-note pps-warn">POS ki likhai (namoona): ${esc(String(s.smp).slice(0, 160))}</p>` : '';
  const note = !on ? 'Band hai — posting gini jati hai, paigham nahi jata. Switch dabayein to chalu.'
    : mine ? 'Sirf ✅ Apna wale PC — baqi kisi PC se bill post ho to aap ke WhatsApp par (waqt · PC · login · bill · raqam).'
    : `Apna PC khud chuna: ${esc(ok.map(nm).join(', ') || '…')} (sab se zyada posting). ☐ / ✅ se badlein — baqi PC se posting = aap ke WhatsApp par.`;
  b.innerHTML = `<div class="pai-box"><div class="pai-r"><span class="pai-ic">🧾</span><span class="pai-nm"><b>Posting nigrani</b><small>doosre PC se bill post ho = WhatsApp</small></span>${ppChip()}
    <button type="button" class="pai-sw${on ? ' is-in' : ''}" data-ppn="sw" aria-label="Posting nigrani ${on ? 'band karo' : 'chalu karo'}"${ppBusy || !pp ? ' disabled' : ''}><i></i></button></div>
    <p class="pai-note">${note}${mine ? ' <button type="button" class="pps-more" data-ppn="auto">↺ Khud chuno</button>' : ''}</p>
    ${hs.length ? `<div class="pps-l">${list}${more}</div>` : (ppSt && ppSt.at ? '<p class="pai-note">Abhi kisi PC ki posting nazar nahi aayi.</p>' : '')}${la}${smp}</div>`;
}
async function ppSave(o, msg) {
  const was = pp; ppBusy = true; pp = { ...(pp || {}), ...o }; ppPaint();
  try { await A.cloud.savePostPc(o); A.notice?.(msg); }
  catch (e) { pp = was; A.notice?.('✕ ' + (e?.message || e)); }
  ppBusy = false; ppPaint();
}
function ppToggle() { if (ppBusy || !pp) return; const nx = !ppOn(); ppSave({ on: nx }, nx ? '🧾 Posting nigrani chalu' : '⚫ Posting nigrani band'); }
function ppMine(h) {
  if (ppBusy || !pp || !h) return;
  const cur = ppOk(), has = cur.some(k => ppSame(k, h)), nx = has ? cur.filter(k => !ppSame(k, h)) : [...cur, String(h).toUpperCase()];
  if (!nx.length) { A.notice?.('Kam az kam ek PC apna rahe'); return; }
  ppSave({ ok: nx.slice(0, 10) }, has ? '☐ Ab is PC ki posting par paigham aayega' : '✅ Yeh PC apna — is ki posting par paigham nahi');
}
function ppAuto() { if (ppBusy || !pp) return; ppSave({ ok: [] }, '↺ Apna PC ab PC khud chunega'); }
