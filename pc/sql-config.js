// =========================================================
//  sql-config.js  v1 (2026-09-25) — SQL Server ki setting EK jagah se: local-config.json
//  local-config.json sirf PC par rehti hai (GitHub par KABHI nahi) — is liye yahi scripts kisi bhi PC par chal jati hain.
//  Shakal:  { "sql": { "server": "localhost\\SQLEXPRESS", "database": "POS", "user": "sa", "password": "..." } }
//  Pehli dafa na mile to purani scripts (sync-stock.js / sync-bills.js / sync.js) ke andar likhi setting se khud bana leti hai.
// =========================================================
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const FILE = path.join(DIR, 'local-config.json');

function fromOldScripts() {
  const dirs = [DIR, path.join(DIR, 'backup')];
  for (const d of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(d).map(String);
      if (d !== DIR) names = names.flatMap(n => { try { return fs.readdirSync(path.join(d, n)).map(x => path.join(n, x)); } catch { return [n]; } });
    } catch { continue; }
    const pick = names.filter(n => /(^|[\\/])(sync-stock|sync-bills|sync)(\.[a-z0-9-]+)?\.js$/i.test(n));
    for (const n of pick) {
      try {
        const s = fs.readFileSync(path.join(d, n), 'utf8');
        const m = s.match(/const SQL_CONFIG\s*=\s*(\{[\s\S]*?\n\});/);
        if (!m) continue;
        const c = Function('return ' + m[1])();
        if (c && c.server && c.database && c.user && c.password && !/^\*+$/.test(String(c.password))) return c;
      } catch {}
    }
  }
  return null;
}

let local = {};
try { local = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch {}
let sql = local.sql || null;
if (!sql) {
  sql = fromOldScripts();
  if (sql) { try { fs.writeFileSync(FILE, JSON.stringify({ ...local, sql }, null, 2)); } catch {} }
}
if (!sql) {
  console.log('local-config.json mein SQL ki setting nahi mili — KHATA-DOCTOR.bat chalayein, wo server / database / user / password poochh lega.');
  process.exit(1);
}
module.exports = { ...sql, options: { encrypt: false, trustServerCertificate: true, ...(sql.options || {}) } };
