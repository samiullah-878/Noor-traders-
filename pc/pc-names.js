// pc-names.js v1.0 (2026-11-16) — 🖥 COUNTER KA NAAM (host -> naam) EK JAGAH
// Malik (16 Nov, camera setup screenshot): "computer ke naam auto aane chahiye · naam device ka NT-PRINT ke zariye".
// Tarteeb: purani pakki list (PC_DEFAULT) < local-config.json pcNames < NT-PRINT ka apna naam (printPCs/<id>.name).
// NT-PRINT ka naam = us PC ki NT-PRINT setting (pcName); na ho to host hi hota hai -> phir purana naam rehta hai.
// oldName(naam) = us PC ka purana naam — camera channel (billClip.ch) purane naam se likha ho to bhi mile.
// Sirf parhta hai (printPCs). POS mein kuch nahi likhta. AI nahi.
const fs = require('fs'), path = require('path');
const PC_DEFAULT = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-KEIME1D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
let NT = {}, started = false;
function start(biz) {
  if (started || !biz) return; started = true;
  try {
    biz.collection('printPCs').onSnapshot(s => {
      const m = {};
      s.forEach(d => { const x = d.data() || {}, h = String(x.host || '').toUpperCase().trim(), n = String(x.name || '').trim().slice(0, 40);
        if (h && n && n.toUpperCase() !== h) m[h] = n; });
      NT = m;
    }, () => {});
  } catch {}
}
function local(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'local-config.json'), 'utf8')).pcNames || {}; } catch { return {}; } }
function names(dir) { return { ...PC_DEFAULT, ...local(dir || __dirname), ...NT }; }
function oldName(nm) {
  const n = String(nm || '');
  for (const [h, v] of Object.entries(NT)) if (v === n) { const loc = local(__dirname); return loc[h] || PC_DEFAULT[h] || h; }
  return '';
}
module.exports = { PC_DEFAULT, start, names, oldName };
