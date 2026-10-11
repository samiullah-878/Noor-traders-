// =========================================================
//  zinda.js  v1.0 (2026-10-11) — 💓 SACHI DHADKAN, sab PC scripts ke liye ek jagah
//
//  Pehle har script '<script>.alive' har 30 sec KHUD likhti thi — kaam atak jata (SQL / Firebase ka jawab na aaye)
//  to bhi doctor ko "zinda" dikhti aur dobara nahi chalata (11-Oct: stock 12 min ruka, raat ki report 3 ghante khamosh).
//
//  Ab: .alive SIRF tab likha jata hai jab asal jaanch kamyab ho —
//    har 1 min  POS SQL se 'SELECT 1' (sql: true wali scripts)         — 20 sec mein jawab
//    har 5 min  Firebase se ek chhota doc parhna                        — 30 sec mein jawab
//  Jaanch na guzre to dhadkan rukti hai -> doctor 3 min mein script dobara chalata hai. 5 dafa lagatar fail = script khud band (bat dobara chalati hai).
//  guard(fn, ms, naam): koi chakkar (tick) had se lamba chale = script band -> bat 30 sec mein dobara.
//
//  Istemal (script ke shuru mein, purani dhadkan wali line ki jagah):
//    const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'), w = () => { try { require('fs').writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();
//    setInterval(ZINDA.guard(tick, 10 * 60000, 'tick'), 30000);
//  SQL ki setting sql-config.js se (password yahan NAHI). Kuch nahi likhta — sirf parhta hai.
// =========================================================
const fs = require('fs');
const path = require('path');

module.exports = function zinda(file, o = {}) {
  const name = path.basename(file, '.js'), hb = path.join(path.dirname(file), name + '.alive');
  const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}] 💓 ${name}:`, ...a);
  const beat = () => { try { fs.writeFileSync(hb, String(Date.now())); } catch {} };
  beat();   // shuru hote hi (doctor shuru mein hi na maare)
  const every = Number(o.every) || 60000, fsEvery = Number(o.fsEvery) || 5;
  const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ne ${ms / 1000} sec mein jawab nahi diya`)), ms); })]).finally(() => clearTimeout(t)); };
  let pool = null, n = 0, fails = 0, busy = false;
  const dropPool = () => { const p = pool; pool = null; try { p && p.close(); } catch {} };
  async function sqlCheck() {
    const sql = require('mssql');
    if (!pool || !pool.connected) { dropPool(); pool = await new sql.ConnectionPool({ ...require('./sql-config.js'), pool: { max: 1, min: 0, idleTimeoutMillis: 120000 }, requestTimeout: 20000, connectionTimeout: 15000 }).connect(); }
    await pool.request().query('SELECT 1 AS ok');
  }
  async function fsCheck() {
    let A, F; try { A = require('firebase-admin/app'); F = require('firebase-admin/firestore'); } catch { return; }   // is PC par Firebase hi nahi (NT-PRINT awaz-only)
    if (!A.getApps().length) return;   // script ne abhi Firebase shuru nahi kiya
    const { getFirestore } = F;
    await getFirestore().collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcPing').get();
  }
  async function check() {
    if (busy) return; busy = true; n++;
    try {
      if (o.sql) await within(sqlCheck(), Number(o.sqlMs) || 25000, 'POS SQL');
      if (o.firebase !== false && n % fsEvery === 1) await within(fsCheck(), Number(o.fsMs) || 30000, 'Firebase');
      if (fails) log('jaanch theek — phir se zinda');
      fails = 0; beat();
    } catch (e) {
      fails++; dropPool();
      log(`jaanch fail (${fails}/5): ${e.message}`);
      if (fails >= 5) { log('5 dafa lagatar fail — script band, bat dobara chalayegi'); process.exit(5); }
    } finally { busy = false; }
  }
  const timer = setInterval(check, every); timer.unref?.();
  setTimeout(check, 5000).unref?.();
  // chowkidar: chakkar had se lamba = atka hua
  function guard(fn, ms, label = 'kaam') {
    return async (...a) => {
      const t = setTimeout(() => { log(`CHOWKIDAR: ${label} ${Math.round(ms / 60000)} min se atka — script band, bat dobara chalayegi`); process.exit(4); }, ms);
      t.unref?.();
      try { return await fn(...a); } finally { clearTimeout(t); }
    };
  }
  return { beat, guard, check, _state: () => ({ n, fails }) };
};
