// =========================================================
//  pos-jaanch.js  v1.0 (2026-11-10) — 🔎 POS BILL JAANCH (SIRF PARHNA — POS mein kuch nahi likhta)
//  Malik: "delivery charges wali tahreer POS ke apne bill par aa sakti hai? · us ko edit karne ka koi tareeqa nikalo".
//  Qadam 1 = sirf dekhna: (a) POS database mein bill ke upar wali likhai ("GULYANA", dukan ka number) KIS table / khane mein hai
//  (b) is PC par POS ke bill ki template files (.rpt Crystal / .rdlc / .repx / .frx / .mrt) kahan hain.
//  Nateeja: blueAccess/posBillJaanch { at, host, v, j: JSON text } → app Settings → 🖥️ PC scripts → "🔎 POS bill jaanch".
//  Password jaise khane (pass / pwd / key / secret / token / pin) KABHI nahi parhe / bheje jate. rate-change.js shuru mein ek dafa chalata hai (v badle to dobara).
// =========================================================
const fs = require('fs'), path = require('path'), os = require('os');
const { execFile } = require('child_process');
const V = 1, NEEDLES = ['GULYANA', '03450412515', '0345-0412515', '0345 0412515'];
const SECRET = /pass|pwd|secret|token|key|pin\b|licen|serial|hash|salt/i;
const TPL = /\.(rpt|rdlc|rdl|repx|frx|mrt|fr3|lbx|xsl|xslt)$/i;
const cut = (v, n) => { const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 16) : Buffer.isBuffer(v) ? '(binary)' : String(v); return s.length > n ? s.slice(0, n) + '…' : s; };

async function dbScan(pool, sql) {
  const out = [];
  const cols = (await pool.request().query(`SELECT c.TABLE_SCHEMA AS S, c.TABLE_NAME AS T, c.COLUMN_NAME AS C FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'
    WHERE c.DATA_TYPE IN ('varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext')`)).recordset;
  const rows = new Map();
  for (const r of (await pool.request().query(`SELECT s.name AS S, t.name AS T, SUM(p.rows) AS N FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1) GROUP BY s.name, t.name`)).recordset) rows.set(r.S + '.' + r.T, Number(r.N) || 0);
  const by = new Map();
  for (const c of cols) { if (SECRET.test(c.C)) continue; const k = c.S + '.' + c.T; if ((rows.get(k) || 0) > 3000 || !(rows.get(k) > 0)) continue; if (!by.has(k)) by.set(k, { S: c.S, T: c.T, C: [] }); by.get(k).C.push(c.C); }
  let tried = 0;
  for (const [k, t] of by) {
    if (out.length >= 8 || tried++ > 600) break;
    try {
      const rq = pool.request(); rq.timeout = 8000; NEEDLES.forEach((n, i) => rq.input('n' + i, sql.NVarChar(60), '%' + n + '%'));
      const wh = t.C.slice(0, 40).map(c => NEEDLES.map((_, i) => `CAST([${c.replace(/]/g, ']]')}] AS NVARCHAR(400)) LIKE @n${i}`).join(' OR ')).join(' OR ');
      const rs = (await rq.query(`SELECT TOP 2 * FROM [${t.S}].[${t.T.replace(/]/g, ']]')}] WHERE ${wh}`)).recordset;
      for (const r of rs) {
        const row = {}, hit = [];
        for (const [c, v] of Object.entries(r)) { if (SECRET.test(c) || Buffer.isBuffer(v)) continue; const s = cut(v, 70); row[c] = s; if (NEEDLES.some(n => String(v ?? '').toUpperCase().includes(n))) hit.push(c); }
        out.push({ t: k, n: rows.get(k) || 0, hit, row });
      }
    } catch (e) { /* ek table na parhi jaye = agli */ }
  }
  return out;
}
const ps = (cmd, ms) => new Promise(res => { try { execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', windowsHide: true, timeout: ms || 20000, maxBuffer: 4 << 20 }, (e, o) => res(e ? '' : String(o || ''))); } catch { res(''); } });
async function fileScan() {
  const roots = new Set(), skip = /\\(windows|node_modules|nodejs|microsoft|google|common files|windowsapps|khata-sync|\$recycle\.bin|programdata\\microsoft|system volume information)(\\|$)/i;
  if (process.platform === 'win32') {
    const o = await ps("Get-Process | Where-Object { $_.Path } | ForEach-Object { $_.Path } | Sort-Object -Unique");
    for (const p of o.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) { const d = path.dirname(p); if (!skip.test(d + '\\') && !/\\(chrome|edge|anydesk|teamviewer|onedrive|whatsapp)/i.test(d)) roots.add(d); }
    for (const base of ['C:\\', 'D:\\', 'E:\\', 'C:\\Program Files', 'C:\\Program Files (x86)']) { try { for (const n of fs.readdirSync(base)) if (/cognit|pos|solution|retail|erp|shop|store|sale/i.test(n)) { const d = path.join(base, n); try { if (fs.statSync(d).isDirectory() && !skip.test(d + '\\')) roots.add(d); } catch {} } } catch {} }
  }
  const files = [], seen = new Set(); let n = 0;
  const walk = (d, depth) => {
    if (depth > 5 || n > 40000 || files.length >= 120 || seen.has(d.toLowerCase())) return; seen.add(d.toLowerCase());
    let L = []; try { L = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of L) { n++; const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!skip.test(p + '\\')) walk(p, depth + 1); }
      else if (TPL.test(e.name)) { try { const st = fs.statSync(p); files.push({ p, kb: Math.round(st.size / 1024), m: new Date(st.mtimeMs).toISOString().slice(0, 10) }); } catch {} } }
  };
  for (const r of roots) walk(r, 0);
  const rank = f => (/sale|invoice|bill|receipt|pos/i.test(path.basename(f.p)) ? 0 : 1);
  files.sort((a, b) => rank(a) - rank(b) || a.p.localeCompare(b.p));
  return { roots: [...roots].slice(0, 25), files: files.slice(0, 80), total: files.length };
}
async function run(pool, sql, ref, log) {
  try {
    const old = (await ref.get()).data() || {};
    if (Number(old.v) === V && old.host === os.hostname() && Date.now() - (Number(old.at) || 0) < 7 * 86400000) return;
    log('🔎 POS bill jaanch shuru (sirf parhna)…');
    let dbr = [], dbErr = '', fr = { roots: [], files: [], total: 0 };
    try { dbr = await dbScan(pool, sql); } catch (e) { dbErr = String(e.message || e).slice(0, 160); }
    try { fr = await fileScan(); } catch (e) { fr.err = String(e.message || e).slice(0, 160); }
    let j = JSON.stringify({ db: dbr, dbErr, ...fr }); if (j.length > 600000) j = JSON.stringify({ db: dbr.slice(0, 4), dbErr, roots: fr.roots, files: fr.files.slice(0, 30), total: fr.total });
    await ref.set({ at: Date.now(), host: os.hostname(), v: V, j });
    log(`🔎 POS bill jaanch: database ${dbr.length} jagah · template files ${fr.total}`);
  } catch (e) { log('🔎 jaanch: ' + (e.message || e)); }
}
module.exports = { run, V };
