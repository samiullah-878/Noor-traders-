// =========================================================
//  rec-dir.js  v1.0 (2026-11-20, app v2.334.0) — 💽 RECORDING KAHAN (bill-clip + ginti-cam EK qaida)
//  Malik (20 Nov): "PC scripts mein poora drive show karwa do — C ya D dono · phir selection ka option · kis mein rakhna hai ·
//                  us mein 10 din ki video bhi pari rahe".
//  - Malik ka chuna drive: blueAccess/billClip.rdrv ('D' waghera). Recording: <D>:\NT-Recording\clip-rec\ch<N>\s-YYYYMMDD-HHMMSS.mp4
//    (scripts wale drive par purani jagah: <script folder>\clip-rec — folder ka naam 'clip-rec' hi rakha, doctor ka ffmpeg naam isi se).
//  - Drive na mile / folder na ban sake = purani jagah (khamosh nahi: err wapas).
//  - Jagah badli to purani jagah ki recording bhi PARHI jati hai (clip / ginti) aur apne din pure kar ke khud mitti hai — move / copy nahi
//    (dukan ke waqt server ki hard par bojh nahi).
//  - Sirf parhna / naam banana — kuch nahi mitata (mitana bill-clip ka kaam).
// =========================================================
'use strict';
const fs = require('fs');
const path = require('path');

const WIN = process.platform === 'win32';
// test (Linux sandbox) ke liye: NT_DRV_ROOT/<D> = drive D ki jagah
const base = d => WIN ? d + ':\\' : (process.env.NT_DRV_ROOT ? path.join(process.env.NT_DRV_ROOT, d) : null);
const letter = v => { const d = String(v || '').trim().toUpperCase().slice(0, 1); return /^[C-Z]$/.test(d) ? d : ''; };
const ownOf = dir => WIN ? (path.parse(path.resolve(dir)).root || 'C').slice(0, 1).toUpperCase() : '';

// asal jagah (likhne wali): { root, d, err }
function active(dir, drv) {
  const def = path.join(dir, 'clip-rec'), d = letter(drv), own = ownOf(dir);
  if (!d || d === own) return { root: def, d: own || '', err: '' };
  const b = base(d);
  if (!b) return { root: def, d: own, err: '' };
  if (!fs.existsSync(b)) return { root: def, d: own, err: `${d}: drive nahi mili — recording ${own ? own + ': par' : 'purani jagah'}` };
  const root = WIN ? path.join(b, 'NT-Recording', 'clip-rec') : path.join(b, 'NT-Recording', 'clip-rec');
  try { fs.mkdirSync(root, { recursive: true }); } catch (e) { return { root: def, d: own, err: `${d}: par folder nahi ban saka (${String(e.code || e.message).slice(0, 40)}) — recording ${own ? own + ': par' : 'purani jagah'}` }; }
  return { root, d, err: '' };
}

// sab jagahein jahan recording ho sakti hai: [asal, purani script wali, baqi drives ki NT-Recording] — sirf jo maujood hon (60 s yaad)
let rc = { k: '', at: 0, v: [] };
function roots(dir, act) {
  const k = act + '|' + dir;
  if (rc.k === k && Date.now() - rc.at < 60000) return rc.v;
  const all = [act, path.join(dir, 'clip-rec')];
  for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') { const b = base(L); if (!b) continue; const p = path.join(b, 'NT-Recording', 'clip-rec'); try { if (fs.existsSync(p)) all.push(p); } catch {} }
  const v = [...new Set(all.map(p => path.resolve(p)))].filter((p, i) => i === 0 || fs.existsSync(p));
  rc = { k, at: Date.now(), v };
  return v;
}

// ek channel ke sab tukre (har jagah se), naam (waqt) ki tarteeb: [{f, n}]
function segFiles(rts, ch) {
  const seen = new Set(), out = [];
  for (const r of rts) {
    const d = path.join(r, 'ch' + ch); let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) { if (!/^s-\d{8}-\d{6}\.mp4$/.test(n) || seen.has(n)) continue; seen.add(n); out.push({ f: path.join(d, n), n }); }
  }
  out.sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
  return out;
}
const t0Of = n => { const m = n.match(/^s-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0; };
const driveOf = p => WIN ? (path.parse(path.resolve(p)).root || '').slice(0, 1).toUpperCase() : (process.env.NT_DRV_ROOT && path.resolve(p).startsWith(path.resolve(process.env.NT_DRV_ROOT) + path.sep) ? path.relative(process.env.NT_DRV_ROOT, p).split(path.sep)[0] : 'C');

module.exports = { active, roots, segFiles, t0Of, driveOf, letter, base, VER: '1.0' };
