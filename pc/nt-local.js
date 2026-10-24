// =========================================================
//  nt-local.js  v1.0 (2026-10-24) — NT LOCAL SERVER (laptop, C:\khata-sync)
//  Maqsad: internet na ho to dukaan ke WiFi (TP-Link) par phones isi laptop se baat karein
//  aur print / sale / purchase / stock chalta rahe. Server PC (DESKTOP-Q1SLV77) hi asal server hai —
//  POS database wahin hai; ye laptop us se LAN / WiFi par judta hai.
//  Update 1 (ye): sirf JAANCH — POS mein kuch NAHI likhta.
//    GET /ping  -> {ok, host, ver, ip, sql:{ok, ms, items, err}}  (app ka "📡 Local server jaanch")
//    GET /      -> chhota status page (phone ke browser se seedha kholne ke liye)
//  Chalana: nt-local-auto.bat (Startup) — har chalne se pehle GitHub se taaza nt-local.js (net ho to).
//  Lock: port 47900 khud (doosri copy foran band). Har 6 ghante khud band -> bat taaza file ke saath dobara.
//  Log: nt-local-log.txt
// =========================================================
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VER = '1.0.1';   // 1.0.1: local-config ka BOM (Windows PowerShell UTF8) ab parh leta hai
const PORT = 47900;
const DIR = __dirname;
const LOG = path.join(DIR, 'nt-local-log.txt');
const RESTART_MS = 6 * 60 * 60 * 1000;

function log(t) {
  const line = new Date().toLocaleString('en-GB', { hour12: false }) + '  ' + t;
  try {
    fs.appendFileSync(LOG, line + '\r\n');
    if (fs.statSync(LOG).size > 512 * 1024) { const s = fs.readFileSync(LOG, 'utf8'); fs.writeFileSync(LOG, s.slice(-256 * 1024)); }
  } catch {}
}

function ips() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}

// ---- SQL (POS) jaanch: sirf SELECT ----
let sqlCfg = null, sqlLib = null, pool = null, last = null, lastAt = 0, busy = null;
function loadSql() {
  if (sqlCfg) return null;
  try { sqlLib = require('mssql'); } catch { return 'mssql install nahi (setup dobara chalayein)'; }
  try {
    const local = JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8').replace(/^\uFEFF/, '')) || {};
    if (!local.sql || !local.sql.server) return 'local-config.json mein SQL setting nahi';
    sqlCfg = { ...local.sql, connectionTimeout: 6000, requestTimeout: 6000, pool: { max: 2, min: 0, idleTimeoutMillis: 60000 },
      options: { encrypt: false, trustServerCertificate: true, ...(local.sql.options || {}) } };
  } catch (e) { return fs.existsSync(path.join(DIR, 'local-config.json')) ? 'local-config.json parhi nahi gayi: ' + e.message : 'local-config.json nahi mili'; }
  return null;
}
async function sqlCheck() {
  if (last && Date.now() - lastAt < 10000) return last;
  if (busy) return busy;
  busy = (async () => {
    const t0 = Date.now();
    const bad = loadSql();
    if (bad) return { ok: false, err: bad };
    try {
      if (!pool) pool = await new sqlLib.ConnectionPool(sqlCfg).connect();
      const r = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.Items');
      return { ok: true, ms: Date.now() - t0, items: r.recordset[0].n, server: String(sqlCfg.server) };
    } catch (e) {
      try { if (pool) pool.close(); } catch {}
      pool = null;
      const m = String(e && e.message || e).replace(/password[^,;]*/ig, '***');
      log('SQL nahi juda: ' + m);
      return { ok: false, ms: Date.now() - t0, err: m.slice(0, 160), server: String(sqlCfg.server) };
    }
  })();
  try { last = await busy; lastAt = Date.now(); return last; } finally { busy = null; }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Cache-Control', 'no-store');
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/ping') {
    const sql = await sqlCheck();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, app: 'nt-local', ver: VER, host: os.hostname(), ip: ips(), at: Date.now(), sql }));
  }
  if (url.pathname === '/') {
    const sql = await sqlCheck();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>NT Local Server</title>
<body style="font-family:system-ui;padding:16px;max-width:520px;margin:auto"><h2>✅ NT Local Server chal raha hai</h2>
<p>Laptop: <b>${os.hostname()}</b> · v${VER}</p><p>${sql.ok ? '✅ POS database jura hua (' + sql.items + ' items, ' + sql.ms + ' ms)' : '❌ POS database nahi juda: ' + String(sql.err || '').replace(/</g, '&lt;')}</p>
<p style="color:#64748b">Ab app mein Settings → 📡 Local server jaanch dabayein.</p></body>`);
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"ok":false,"err":"nahi mila"}');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log('NT Local Server pehle se chal raha hai.'); process.exit(3); }
  log('server ghalti: ' + e.message); process.exit(1);
});
server.listen(PORT, '0.0.0.0', async () => {
  log(`NT LOCAL SERVER v${VER} shuru — ${os.hostname()} · ${ips().join(', ')} · port ${PORT}`);
  const s = await sqlCheck();
  log(s.ok ? `✓ POS database jura (${s.server}, ${s.items} items, ${s.ms} ms)` : `⚠ POS database nahi juda: ${s.err}`);
});
setTimeout(() => { log('6 ghante — taaza file ke liye dobara shuru'); process.exit(0); }, RESTART_MS).unref();
process.on('uncaughtException', e => { log('ghalti: ' + (e && e.stack || e)); process.exit(1); });
