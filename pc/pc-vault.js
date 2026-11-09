// =========================================================
//  pc-vault.js  v1.0 (2026-11-09) — 🖥 SERVER KI CHAABI KA TAALE WALA BACKUP (naya server PC ke liye)
//  Malik (9 Nov): "Firestore mein aisi file rakhni chahiye — jab bhi download kar ke new server par lagayein to sab kuch wahan bhi chal jaye".
//
//  Kaam (server PC, doctor chalata hai — pc-vault-auto.bat):
//    • Har 6 ghante (aur shuru ke 1 min baad): firebase-key.json + local-config.json (SQL setting, pcName, printer) + label-settings.json
//      + label-numbers.json (jo maujood hon) → businesses/noor-traders/pcVault/main {j: JSON text, h: sha256, names, host, at}.
//      Sirf badle (h) ya 24 ghante purana ho to likhta hai. Firestore rules: pcVault SIRF malik parh sakta hai, likhta sirf PC (admin).
//      (Wahi faisla jo NVR / AI key ka — malik-only doc; Firebase project ka owner bhi malik hi hai.)
//    • Naye PC par: server-setup.ps1 → server-join.js 6 hindse ka code dikhata hai → malik app Settings → 🖥 Naya server jodo → app ye
//      backup ECDH (P-256) + AES-GCM se SIRF us PC ke liye taale mein band kar ke bhejti hai → naya PC files rakh kar KHATA-DOCTOR chala deta hai.
//    • Counter PC (jis ki local-config mein SQL nahi) par kuch nahi karta — sirf asal server ka backup.
//  POS mein KUCH nahi. AI NAHI. Lock 47845. Log: pc-vault-log.txt.
// =========================================================
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const crypto = require('crypto');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const DIR = __dirname, LOCK_PORT = 47845, VER = '1.0';
const FILES = ['firebase-key.json', 'local-config.json', 'label-settings.json', 'label-numbers.json'];
const STATE = path.join(DIR, 'pc-vault-state.json');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore(), REF = db.collection('businesses').doc('noor-traders').collection('pcVault').doc('main');

let busy = false;
async function backup(why) {
  if (busy) return; busy = true;
  try {
    let lc = {}; try { lc = JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')) || {}; } catch {}
    if (!(lc.sql && lc.sql.password)) { log('ℹ local-config mein SQL nahi — ye asal server nahi, backup nahi'); return; }
    const files = {};
    for (const n of FILES) { const p = path.join(DIR, n); if (!fs.existsSync(p)) continue; const t = fs.readFileSync(p, 'utf8'); try { JSON.parse(t); } catch { log(`⚠ ${n} JSON theek nahi — chhor di`); continue; } files[n] = t; }
    if (!files['firebase-key.json'] || !files['local-config.json']) { log('⚠ chaabi / local-config nahi mili'); return; }
    const j = JSON.stringify({ v: 1, files }), h = crypto.createHash('sha256').update(j).digest('hex');
    let st = {}; try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')) || {}; } catch {}
    if (st.h === h && Date.now() - (Number(st.at) || 0) < 24 * 3600000) return;
    await REF.set({ j, h, names: Object.keys(files), host: os.hostname(), at: Date.now(), ver: VER, sz: j.length });
    try { fs.writeFileSync(STATE, JSON.stringify({ h, at: Date.now() })); } catch {}
    log(`💾 backup (${why}): ${Object.keys(files).join(', ')} · ${Math.round(j.length / 1024)} KB`);
  } catch (e) { log('⚠ backup: ' + e.message); }
  finally { busy = false; }
}

function main() {
  log(`🖥 pc-vault v${VER} shuru — ${os.hostname()} · lock ${LOCK_PORT}`);
  setTimeout(() => backup('shuru'), 60000);
  setInterval(ZINDA.guard ? ZINDA.guard(() => backup('6 ghante'), 10 * 60000, 'backup') : () => backup('6 ghante'), 6 * 3600000);
}
const lock = net.createServer();
lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] pc-vault pehle se chal raha hai (lock ${LOCK_PORT})`); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', () => { try { main(); } catch (e) { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); } });
