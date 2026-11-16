// ============================================================
//  thermal-name.js  v1.1 (2026-11-16 dopahar: 🛑 thermal-off.txt ho to khud chun-na BAND — purana pakka naam; doctor v3.6 spooler atakne par lagata hai) · v1.0 (2026-11-16) — 🧾 THERMAL PRINTER KA NAAM KHUD
//  Malik: naye server PC par printer ka naam "EPSON TM-T88IV Receipt" hai, scripts mein "TM-T88IV" pakka likha tha -> parchi nahi.
//  "Epson TM-T88IV receipt printer hi asal hai, us ko add kar do auto."
//  Qaida (pick): 1) bilkul "TM-T88IV" naam ka printer ho = wohi (purana server, kuch nahi badla)
//                2) warna jis ke naam mein "TM-T88" ho (Copy wala baad mein, chhota naam pehle)
//                3) kuch na mile = "TM-T88IV" (pehle jaisa)
//  Yaad: thermal-printer.txt {n, at} — doctor (prnTick) har 2 min taza rakhta hai; file na ho / 12 ghante purani = yahan ek dafa PowerShell (hadd 15 s).
//  Naam script ke shuru mein ek dafa liya jata hai — printer ka naam badle to script ke agle shuru hone par (PC roz band hota hai).
//  Sirf PARHTA hai — Windows ke printer ka naam / setting kabhi nahi badalta. AI nahi.
// ============================================================
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const DEF = 'TM-T88IV', FILE = path.join(__dirname, 'thermal-printer.txt');
function pick(names) {
  const l = (Array.isArray(names) ? names : []).map(x => String(x || '').trim()).filter(Boolean);
  const ex = l.find(x => x.toLowerCase() === DEF.toLowerCase()); if (ex) return ex;
  const c = l.filter(x => /tm-?\s?t88/i.test(x));
  c.sort((a, b) => (/copy/i.test(a) ? 1 : 0) - (/copy/i.test(b) ? 1 : 0) || a.length - b.length || a.localeCompare(b));
  return c[0] || DEF;
}
function save(n) { try { fs.writeFileSync(FILE, JSON.stringify({ n, at: Date.now() })); } catch {} }
const OFF = path.join(__dirname, 'thermal-off.txt');
const isOff = () => { try { return fs.existsSync(OFF); } catch { return false; } };
function name() {
  if (isOff()) return DEF;   // v1.1: 🛑 spooler atka tha — malik ke '▶ Dobara chalu' tak pakka naam (naye server par = print nahi, spooler mehfooz)
  let c = null; try { c = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  if (c && c.n && Date.now() - (Number(c.at) || 0) < 12 * 3600000) return String(c.n);
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Printer | ForEach-Object { $_.Name }'], { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] });
      const l = String(out || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      if (l.length) { const n = pick(l); save(n); return n; }
    } catch {}
  }
  return (c && c.n) ? String(c.n) : DEF;
}
module.exports = { name, pick, save, DEF, FILE, OFF, isOff };
