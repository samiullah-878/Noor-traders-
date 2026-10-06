// urdu-shape.js v1.0 (2026-10-06) — Urdu/Arabic ko "jure hue harf" (Unicode presentation forms) mein badal kar ULTA (visual LTR)
// kar deta hai, taake "bewaqoof" printer (TSC, TTF font ke saath) seedha harf-ba-harf chhape aur Urdu theek jure.
// Hindse / English waise hi (LTR) rehte hain. shape(text) -> string (presentation forms, visual order)
const F = {   // base: [isolated, final, initial, medial]  (initial/medial na ho = sirf dayen se jurta)
  0x0621: [0xFE80], 0x0622: [0xFE81, 0xFE82], 0x0623: [0xFE83, 0xFE84], 0x0624: [0xFE85, 0xFE86], 0x0625: [0xFE87, 0xFE88],
  0x0626: [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C], 0x0627: [0xFE8D, 0xFE8E], 0x0628: [0xFE8F, 0xFE90, 0xFE91, 0xFE92],
  0x0629: [0xFE93, 0xFE94], 0x062A: [0xFE95, 0xFE96, 0xFE97, 0xFE98], 0x062B: [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C],
  0x062C: [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0], 0x062D: [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4], 0x062E: [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8],
  0x062F: [0xFEA9, 0xFEAA], 0x0630: [0xFEAB, 0xFEAC], 0x0631: [0xFEAD, 0xFEAE], 0x0632: [0xFEAF, 0xFEB0],
  0x0633: [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4], 0x0634: [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8], 0x0635: [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC],
  0x0636: [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0], 0x0637: [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4], 0x0638: [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8],
  0x0639: [0xFEC9, 0xFECA, 0xFECB, 0xFECC], 0x063A: [0xFECD, 0xFECE, 0xFECF, 0xFED0], 0x0641: [0xFED1, 0xFED2, 0xFED3, 0xFED4],
  0x0642: [0xFED5, 0xFED6, 0xFED7, 0xFED8], 0x0643: [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC], 0x0644: [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0],
  0x0645: [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4], 0x0646: [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8], 0x0647: [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC],
  0x0648: [0xFEED, 0xFEEE], 0x0649: [0xFEEF, 0xFEF0], 0x064A: [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4],
  // Urdu
  0x0679: [0xFB66, 0xFB67, 0xFB68, 0xFB69], 0x067E: [0xFB56, 0xFB57, 0xFB58, 0xFB59], 0x0686: [0xFB7A, 0xFB7B, 0xFB7C, 0xFB7D],
  0x0688: [0xFB88, 0xFB89], 0x0691: [0xFB8C, 0xFB8D], 0x0698: [0xFB8A, 0xFB8B], 0x06A9: [0xFB8E, 0xFB8F, 0xFB90, 0xFB91],
  0x06AF: [0xFB92, 0xFB93, 0xFB94, 0xFB95], 0x06BA: [0xFB9E, 0xFB9F], 0x06BE: [0xFBAA, 0xFBAB, 0xFBAC, 0xFBAD],
  0x06C1: [0xFBA6, 0xFBA7, 0xFBA8, 0xFBA9], 0x06C3: [0xFBA4, 0xFBA5], 0x06CC: [0xFBFC, 0xFBFD, 0xFBFE, 0xFBFF], 0x06D2: [0xFBAE, 0xFBAF],
  0x06D3: [0xFBB0, 0xFBB1]
};
const LAM_ALEF = { 0x0622: [0xFEF5, 0xFEF6], 0x0623: [0xFEF7, 0xFEF8], 0x0625: [0xFEF9, 0xFEFA], 0x0627: [0xFEFB, 0xFEFC] };
const isAr = c => (c >= 0x0600 && c <= 0x06FF) || (c >= 0xFB50 && c <= 0xFEFF);
const isMark = c => (c >= 0x064B && c <= 0x065F) || c === 0x0670 || (c >= 0x06D6 && c <= 0x06ED);   // zer zabar pesh (chhor do)
const joinsLeft = c => F[c] && F[c].length === 4;   // agle harf se jur sakta hai
function shapeRun(cps, rev = true) {
  const out = [];
  const letters = cps.filter(c => !isMark(c));
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i], f = F[c];
    if (!f) { out.push(c); continue; }
    const prev = letters[i - 1], next = letters[i + 1];
    // lam-alef ligature
    if (c === 0x0644 && next && LAM_ALEF[next]) { const la = LAM_ALEF[next]; const pj = prev != null && joinsLeft(prev); out.push(pj ? la[1] : la[0]); i++; continue; }
    const pj = prev != null && joinsLeft(prev) && F[prev];
    const nj = next != null && F[next] && f.length === 4;
    let g;
    if (pj && nj) g = f[3]; else if (pj) g = f[1]; else if (nj) g = f[2]; else g = f[0];
    out.push(g);
  }
  return rev ? out.reverse() : out;   // RTL -> visual LTR (printer khud ulta kare to rev=false)
}
function shape(text, opt = {}) {
  const rev = opt.reverse !== false;
  if (!rev) { const cps0 = [...String(text || '')].map(ch => ch.codePointAt(0)); const words = []; let w = [];
    for (const c of cps0) { if (c === 0x20) { words.push(w); w = []; } else w.push(c); } words.push(w);
    return words.map(x => x.some(isAr) ? shapeRun(x, false) : x).map(x => x.map(c => String.fromCodePoint(c)).join('')).join(' '); }
  const cps = [...String(text || '')].map(ch => ch.codePointAt(0));
  // runs: Arabic (with spaces inside) vs other; poori line RTL hai -> runs ka order bhi ulta
  const runs = []; let cur = null;
  for (const c of cps) {
    const ar = isAr(c), sp = c === 0x20;
    if (!cur) { cur = { ar, cps: [c] }; continue; }
    if (sp) { cur.cps.push(c); continue; }
    if (ar === cur.ar) cur.cps.push(c); else { runs.push(cur); cur = { ar, cps: [c] }; }
  }
  if (cur) runs.push(cur);
  // space sirf run ke kinaron par ho to seedha; Arabic run ulta + shaped; LTR run waisa hi
  const vis = runs.map(r => {
    let cps = r.cps, lead = 0; while (cps.length && cps[cps.length - 1] === 0x20) { cps = cps.slice(0, -1); lead++; }   // aakhri space -> aage (visual)
    const body = r.ar ? shapeRunWithSpaces(cps) : cps;
    return Array(lead).fill(0x20).concat(body);
  });
  return vis.reverse().flat().map(c => String.fromCodePoint(c)).join('');
}
function shapeRunWithSpaces(cps) {
  // spaces se tor kar har lafz shape, phir lafzon ka order ulta (RTL)
  const words = []; let w = [];
  for (const c of cps) { if (c === 0x20) { words.push(w); w = []; } else w.push(c); }
  words.push(w);
  const out = [];
  for (let i = words.length - 1; i >= 0; i--) { out.push(...shapeRun(words[i])); if (i > 0) out.push(0x20); }
  return out;
}
module.exports = { shape };
