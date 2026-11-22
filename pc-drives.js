// =========================================================
//  pc-drives.js v1.0 (2026-11-20, app v2.334.0) — 💽 RECORDING KAHAN — Settings → 🖥️ PC scripts ka dabba (sirf malik)
//  Malik: "PC scripts mein poora drive show karwa do — C ya D dono · phir selection ka option · kis mein rakhna hai ·
//          us mein 10 din ki video bhi pari rahe".
//  PC bill-clip v2.16 → blueAccess/billClipPc.drv (har drive: khali / kul / recording) + dk (asal jagah, roz kitne GB, kitne din aa sakte).
//  Chunao → blueAccess/billClip {rdrv, rkd} (setBillClipPart — bina `at`, PC Rabta test / recording dobara nahi chalata).
//  Purani jagah ki recording move NAHI hoti — wahin parhi jati hai aur din pure kar ke khud mitti hai. AI nahi.
//  v1.1 (app v2.347.0, 22 Nov, malik: 'AI ko filhal band kar do aur script mein on karne ka option'): upar 🤖 Camera AI ki patli line (#pcAi) —
//    switch → blueAccess/gintiCam.ai 1 / 0 (saveGintiCam) · PC ginti-cam v2.1 jawab gintiPc.ai → ⏳ / ✅ / ⚫ chip. Default BAND.
// =========================================================
let A = {}, wired = false, stop = null, pc = null, cfg = null, want = '', wantD = 0, busy = '';
let gc = null, gp = null, aiStop = null, aiWant = null, aiBusy = false;   // v1.1: 🤖 Camera AI (gintiCam / gintiPc)
const aiBox = () => document.getElementById('pcAi');
const box = () => document.getElementById('pcDrv');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : Math.floor(m / 60) + ' ghante pehle'; };
const DAYS = [2, 5, 10, 15, 30, 60];
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
}

export async function open(force) {
  if (!box()) return;
  aiOpen();
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
  if (wantD && Number(pc.rkd) !== wantD) return `<span class="pdv-st w">⏳ ${wantD} din lag rahe…</span>`;
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
  const chips = DAYS.map(n => `<button type="button" class="pdv-c${n === days ? ' is-in' : ''}" data-pdv="k" data-n="${n}"${busy ? ' disabled' : ''}>${n} din</button>`).join('');
  let info = '';
  if (dk.day > 0) {
    info = `<p class="pdv-ln">📼 Abhi recording ${gb(dk.used)} · roz ${dk.est ? '≈' : ''}${gb(dk.day)} · ${esc(act)}: par ≈ <b>${Number(dk.can) || 0} din</b> ki jagah</p>`;
    const need = dk.day * days;
    if (dk.can && days > dk.can) info += `<p class="pdv-ln r">⚠️ ${days} din ≈ ${gb(need)} — ${esc(act)}: par sirf ≈ ${dk.can} din ki jagah. Jagah 25 GB se kam hui to sab se purani recording pehle mitegi.</p>`;
    else info += `<p class="pdv-ln g">✓ ${days} din ≈ ${gb(need)} — aaram se aa jayegi</p>`;
    if (dk.est) info += '<p class="pdv-note">≈ = abhi 1 din se kam recording hai, kal tak pakka hisaab.</p>';
  } else info = '<p class="pdv-note">⏳ Roz kitne GB lagte hain — recording ke 10-20 min baad yahan.</p>';
  return `<div class="pdv-box">${hd}<p class="pdv-note">Camera ki recording kis hard par rahe — drive par tap karein.</p>
    <div class="pdv-list">${rows}</div>
    <div class="pdv-days"><span>📅 Kitne din rakhein</span>${chips}</div>${info}
    <p class="pdv-note">Drive badli to purani recording wahin se ${days} din pure kar ke khud mitegi (move nahi hoti). Bill video / WhatsApp waqt ki video / ginti dono jagah se chalti hai. AI nahi.</p></div>`;
}
function paint() { const b = box(); if (b) b.innerHTML = html(); }

async function pickDrive(d) {
  if (!d || busy) return;
  const x = (pc?.drv || []).find(y => y.d === d); if (!x) return;
  if (pc?.dk?.d === d && !want) { A.notice?.(`✓ Recording pehle se ${d}: par hai`); return; }
  const days = curDays();
  if (!confirm(`💽 Camera ki recording ab ${d}: drive par hogi (sab cameras).\n\n${d}: par ${gb(x.free)} khali hai.\nPurani recording jahan hai wahin se ${days} din pure kar ke khud mitegi.\n\nOK?`)) return;
  busy = 'd'; want = d; paint();
  try { await A.cloud.setBillClipPart({ rdrv: d }); cfg = { ...(cfg || {}), rdrv: d }; A.notice?.(`⏳ ${d}: par recording shuru ho rahi hai — PC 1-2 min mein bata dega`); }
  catch (e) { want = ''; A.notice?.('✕ ' + (e?.message || e)); }
  busy = ''; paint();
}

async function pickDays(n) {
  if (!(n > 0) || busy || n === curDays()) return;
  busy = 'k'; wantD = n; paint();
  try { await A.cloud.setBillClipPart({ rkd: n }); cfg = { ...(cfg || {}), rkd: n }; A.notice?.(`✓ Recording ${n} din rakhi jayegi`); }
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
