// pc-names.js v1.2 (2026-11-24: KEIME1D -> RN6QU6D) · v1.1 (2026-11-17) — 🖥 COUNTER KA NAAM = PC KA APNA NAAM (NT-PRINT se) · v1.0 (2026-11-16)
// Malik (17 Nov, camera setup): "RN6QU6D wala aur Abdurehman wala system ek hi hai — Abdurehman ki bajaye PC ka naam aaye, NT-PRINT se".
//   Naam ab: NT-PRINT ka naam (printPCs/<id>.name — sirf jab us PC ki NT-PRINT setting mein host se alag naam likha ho) warna PC ka host
//   (DESKTOP- hata kar, jaise RN6QU6D). Purane insaanon wale naam (Mithu / Abdurehman / Bilal) DIKHANE mein NAHI — sirf purana camera
//   channel dhoondne (chFind) ke liye (LEGACY). local-config pcNames bhi sirf channel ke liye.
//   🔗 blueAccess/pcAlias.m {purana naam: NT-PRINT wala naam} — app ⚙️ Camera setup mein malik jode (POS par PC ka naam NT-PRINT se alag
//   ho to ek hi PC do dafa na dikhe). App tally.js disp() HUBAHU yehi qaida — ek badlo to doosra bhi.
// Sirf parhta hai (printPCs + pcAlias). POS mein kuch nahi likhta. AI nahi.
const fs = require('fs'), path = require('path');
// v1.2 (2026-11-24, malik ki screenshot: Sab cameras par 'KEIME1D' khali — 'kemihd wala system delete kar do, us ki jagah RN6 wala'): KEIME1D PC hat gaya,
//   us counter ka camera (purana naam Abdurehman) ab RN6QU6D ka. App tally.js LEG bhi HUBAHU.
const LEGACY = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-RN6QU6D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
const PC_DEFAULT = {};   // v1.1: dikhane ke liye koi pakka naam nahi (purani scripts ke liye khali export)
const bare = h => String(h || '').trim().replace(/^DESKTOP-/i, '');
let NT = {}, NTN = {}, AL = {}, started = false;
function start(biz) {
  if (started || !biz) return; started = true;
  try {
    biz.collection('printPCs').onSnapshot(s => {
      const m = {}, raw = {};
      s.forEach(d => { const x = d.data() || {}, h = String(x.host || '').toUpperCase().trim(), n = String(x.name || '').trim().slice(0, 40);
        if (!h) return; raw[h] = n; m[h] = n && n.toUpperCase() !== h ? n : bare(h); });
      NT = m; NTN = raw;
    }, () => {});
  } catch {}
  try { biz.collection('blueAccess').doc('pcAlias').onSnapshot(d => { const x = d.exists ? (d.data() || {}) : {}; AL = x.m && typeof x.m === 'object' ? x.m : {}; }, () => {}); } catch {}
}
function local(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'local-config.json'), 'utf8')).pcNames || {}; } catch { return {}; } }
// host (BARE HARF BARE) -> naam. Pehle NT-PRINT wale PC (unhi ka host pehle mile — live ka ulta lookup), phir 🔗 jore hue purane naam.
function names() {
  const m = { ...NT };
  for (const [f, t] of Object.entries(AL)) { const k = String(f || '').trim().toUpperCase(), to = String(t || '').trim(); if (!k || !to) continue;
    if (!(k in m)) m[k] = to; if (!('DESKTOP-' + k in m)) m['DESKTOP-' + k] = to; }
  return m;
}
// camera channel (billClip.ch) is naam ka — naya naam na mile to purane naam / host / jore hue naam se
function chFind(ch, nm) {
  ch = ch && typeof ch === 'object' ? ch : {}; const n = String(nm || '').trim(); if (!n) return 0;
  const m = names(), loc = local(__dirname), keys = [n], hosts = new Set([n.toUpperCase(), 'DESKTOP-' + n.toUpperCase()]);
  for (const [h, v] of Object.entries(m)) if (v === n) hosts.add(h);
  for (const h of hosts) keys.push(LEGACY[h], loc[h], NTN[h], h, bare(h));
  for (const [f, t] of Object.entries(AL)) if (String(t) === n) keys.push(f, LEGACY['DESKTOP-' + String(f).toUpperCase()]);
  for (const k of keys) { if (!k) continue; const v = Number(ch[k] ?? ch[String(k).toLowerCase()]); if (v > 0) return v; }
  return 0;
}
// purana naam (camera setting ki chaabi) -> aaj ka naam (live list mein ek PC do dafa na aaye jab tak malik ⚙️ Save na kare)
function nowName(k) {
  const n = String(k || '').trim(); if (!n) return n; const m = names();
  if (Object.values(m).includes(n)) return n;
  const al = AL[n] || AL[n.toUpperCase()]; if (al) return String(al);
  const h = Object.keys(LEGACY).find(x => LEGACY[x] === n) || Object.keys(m).find(x => bare(x) === n.toUpperCase()) || '';
  return h ? (m[h] || bare(h)) : n;
}
function oldName(nm) {   // purana API (v1.0) — pehla purana naam
  const n = String(nm || '');
  for (const [h, v] of Object.entries(names())) if (v === n) return LEGACY[h] || local(__dirname)[h] || h;
  return '';
}
module.exports = { PC_DEFAULT, LEGACY, start, names, chFind, nowName, oldName, bare };
