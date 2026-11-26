// =========================================================
//  pos-jaanch.js  v3.0 (2026-11-26: v2 mein setting / layout / file kuch nahi mila -> (5) procedures / views ki likhai jin mein PrevBal / PreviousBalance
//    (bill ka data yahan se) (6) har table ke prev / balance khanon ke naam (7) setting jaise table (naam setting / config / company / print…, <= 2000 qatar)
//    ki show / print / bal / wholesale qeemat + 'prev' / 'balance' wali qatar (8) Consus ka folder: CIM + shortcut + C / D; config files ki sirf
//    prev / balance / wholesale wali lines (connection / password wali line KABHI nahi) — SIRF PARHNA)
//  pos-jaanch.js  v2.0 (2026-11-26: 📄 WHOLESALE BILL ka 'Previous Balance' kahan se — setting khane (naam prev / balance) + layout / report jo DB mein para ho
//    (varbinary / ntext mein 'previous bal…') + Consus ka folder; nateeja LOCAL file C:\\khata-sync\\pos-jaanch.txt (Claude parhta hai) — SIRF PARHNA, POS mein kuch nahi)
//  pos-jaanch.js  v1.0 (2026-11-10) — 🔎 POS BILL JAANCH (SIRF PARHNA — POS mein kuch nahi likhta)
//  Malik: "delivery charges wali tahreer POS ke apne bill par aa sakti hai? · us ko edit karne ka koi tareeqa nikalo".
//  Qadam 1 = sirf dekhna: (a) POS database mein bill ke upar wali likhai ("GULYANA", dukan ka number) KIS table / khane mein hai
//  (b) is PC par POS ke bill ki template files (.rpt Crystal / .rdlc / .repx / .frx / .mrt) kahan hain.
//  Nateeja: blueAccess/posBillJaanch { at, host, v, j: JSON text } → app Settings → 🖥️ PC scripts → "🔎 POS bill jaanch".
//  Password jaise khane (pass / pwd / key / secret / token / pin) KABHI nahi parhe / bheje jate. rate-change.js shuru mein ek dafa chalata hai (v badle to dobara).
// =========================================================
const fs = require('fs'), path = require('path'), os = require('os');
const { execFile } = require('child_process');
const V = 3, NEEDLES = ['GULYANA', '03450412515', '0345-0412515', '0345 0412515'];
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
    for (const base of ['C:\\', 'D:\\', 'E:\\', 'C:\\Program Files', 'C:\\Program Files (x86)']) { try { for (const n of fs.readdirSync(base)) if (/consus|cognit|pos|solution|retail|erp|shop|store|sale/i.test(n)) { const d = path.join(base, n); try { if (fs.statSync(d).isDirectory() && !skip.test(d + '\\')) roots.add(d); } catch {} } } catch {} }
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

// v2.0: 📄 'Previous Balance' (malik 26 Nov: 'wholesale bill par customer ka sabqa baqaya na aaye') — SIRF SELECT, har sawal 8 s hadd
const PB_NEEDLE = ['previous bal', 'prev bal', 'prev. bal', 'prv bal', 'pre bal', 'pre. bal', 'old bal', 'previous b', 'sabqa', 'opening bal'];
const PB_COL = /prev|balance|\bbal|sabqa|outstand|oldbal|opening/i;
async function pbScan(pool, sql) {
  const out = { cols: [], text: [], blob: [], err: [] };
  const q = async (t, ms) => { const rq = pool.request(); rq.timeout = ms || 8000; return (await rq.query(t)).recordset; };
  const rows = new Map();
  for (const r of await q(`SELECT s.name AS S, t.name AS T, SUM(p.rows) AS N FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1) GROUP BY s.name, t.name`, 20000)) rows.set(r.S + '.' + r.T, Number(r.N) || 0);
  const cols = await q(`SELECT c.TABLE_SCHEMA AS S, c.TABLE_NAME AS T, c.COLUMN_NAME AS C, c.DATA_TYPE AS D FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'`, 20000);
  const qi = x => '[' + String(x).replace(/]/g, ']]') + ']';
  // (1) setting jaise chhote table (≤ 60 qatar) ke khane jin ke naam mein prev / balance … — qeemat ke saath
  let n1 = 0;
  for (const c of cols) {
    const k = c.S + '.' + c.T, n = rows.get(k) || 0;
    if (n < 1 || n > 60 || !PB_COL.test(c.C) || SECRET.test(c.C) || /binary|image|xml/i.test(c.D)) continue;
    if (n1++ > 80) break;
    try { const rs = await q(`SELECT TOP 4 ${qi(c.C)} AS V FROM ${qi(c.S)}.${qi(c.T)}`); out.cols.push({ t: k, n, c: c.C, d: c.D, v: rs.map(r => cut(r.V, 40)) }); }
    catch (e) { out.err.push(k + '.' + c.C + ': ' + cut(e.message, 80)); }
  }
  // (2) likhai ke khane (≤ 3000 qatar) jin mein 'previous bal…' likha ho — table / khana + 160 harf
  const byT = new Map();
  for (const c of cols) { const k = c.S + '.' + c.T, n = rows.get(k) || 0; if (n < 1 || n > 3000 || SECRET.test(c.C)) continue;
    if (!byT.has(k)) byT.set(k, { S: c.S, T: c.T, txt: [], bin: [], n }); const o = byT.get(k);
    if (/char|text/i.test(c.D)) o.txt.push(c.C); else if (/binary|image/i.test(c.D)) o.bin.push(c); }
  const like = col => PB_NEEDLE.map(w => `LOWER(CAST(${col} AS NVARCHAR(MAX))) LIKE N'%${w}%'`).join(' OR ');
  let n2 = 0;
  for (const [k, o] of byT) {
    if (n2++ > 700 || out.text.length >= 20) break;
    for (const c of o.txt.slice(0, 40)) {
      try { const rs = await q(`SELECT TOP 2 CAST(${qi(c)} AS NVARCHAR(MAX)) AS V FROM ${qi(o.S)}.${qi(o.T)} WHERE ${like(qi(c))}`);
        for (const r of rs) { const v = String(r.V || ''), i = Math.max(0, v.toLowerCase().search(/prev|pre\.? bal|old bal|sabqa|opening bal/)); out.text.push({ t: k, n: o.n, c, len: v.length, s: cut(v.slice(Math.max(0, i - 60), i + 160), 230) }); }
      } catch (e) { /* agla */ }
    }
  }
  // (3) blob (varbinary / image, ≤ 500 qatar) — report layout DB mein ho to 'previous' ka ilaqa (ASCII + UTF-16 dono)
  let n3 = 0;
  for (const [k, o] of byT) {
    if (o.n > 500) continue;
    for (const c of o.bin) {
      if (n3++ > 120 || out.blob.length >= 20) break;
      const b = `CAST(${qi(c.C)} AS VARBINARY(MAX))`;
      try {
        const rs = await q(`SELECT TOP 3 DATALENGTH(${qi(c.C)}) AS L,
          CHARINDEX('previous', LOWER(CAST(${b} AS VARCHAR(MAX)))) AS A, CHARINDEX(N'previous', LOWER(CAST(${b} AS NVARCHAR(MAX)))) AS U,
          SUBSTRING(CAST(${b} AS VARCHAR(MAX)), 1, 120) AS H
          FROM ${qi(o.S)}.${qi(o.T)} WHERE ${qi(c.C)} IS NOT NULL`, 15000);
        for (const r of rs) {
          const L = Number(r.L) || 0, A = Number(r.A) || 0, U = Number(r.U) || 0;
          if (L < 200) continue;
          let s2 = '';
          if (A || U) { try { const z = await q(A ? `SELECT TOP 1 SUBSTRING(CAST(${b} AS VARCHAR(MAX)), ${Math.max(1, A - 300)}, 700) AS S FROM ${qi(o.S)}.${qi(o.T)} WHERE CHARINDEX('previous', LOWER(CAST(${b} AS VARCHAR(MAX)))) = ${A}`
            : `SELECT TOP 1 SUBSTRING(CAST(${b} AS NVARCHAR(MAX)), ${Math.max(1, U - 300)}, 700) AS S FROM ${qi(o.S)}.${qi(o.T)} WHERE CHARINDEX(N'previous', LOWER(CAST(${b} AS NVARCHAR(MAX)))) = ${U}`, 15000); s2 = cut(String((z[0] || {}).S || '').replace(/[^\x20-\x7e]+/g, ' '), 700); } catch {} }
          out.blob.push({ t: k, n: o.n, c: c.C, d: c.D, L, A, U, h: cut(String(r.H || '').replace(/[^\x20-\x7e]+/g, ' '), 100), s: s2 });
        }
      } catch (e) { out.err.push(k + '.' + c.C + ' (blob): ' + cut(e.message, 80)); }
    }
  }
  return out;
}
async function consusDir() {
  if (process.platform !== 'win32') return null;
  const o = await ps("Get-Process | Where-Object { $_.Path -and ($_.ProcessName -match 'consus|cognit|pos') } | ForEach-Object { $_.ProcessName + '|' + $_.Path } | Sort-Object -Unique");
  const L = o.split(/\r?\n/).map(x => x.trim()).filter(Boolean), res = { procs: L.slice(0, 10), dirs: [] };
  for (const line of L.slice(0, 3)) {
    const d = path.dirname(line.split('|').slice(1).join('|'));
    if (!d || res.dirs.some(x => x.d === d)) continue;
    const names = []; const hit = [];
    const walk = (x, depth) => { let E = []; try { E = fs.readdirSync(x, { withFileTypes: true }); } catch { return; }
      for (const e of E) { const p = path.join(x, e.name); if (depth === 0 && names.length < 250) names.push((e.isDirectory() ? '[D] ' : '') + e.name);
        if (e.isDirectory()) { if (depth < 3) walk(p, depth + 1); }
        else if (/report|invoice|bill|receipt|print|layout|template|\.repx|\.rpt|\.rdlc|\.frx|\.mrt|\.xml$|\.config$/i.test(e.name) && hit.length < 120) { try { hit.push(path.relative(d, p) + ' (' + Math.round(fs.statSync(p).size / 1024) + ' KB)'); } catch {} } } };
    walk(d, 0); res.dirs.push({ d, names, hit });
  }
  return res;
}
function pbText(dbr, pb, cd) {
  const L = ['POS JAANCH v' + V + ' — ' + new Date().toISOString() + ' — ' + os.hostname() + '  (SIRF PARHNA — POS mein kuch nahi likha)', ''];
  L.push('== (0) dukan ka naam / number DB mein (v1) =='); for (const r of dbr) L.push(`${r.t} (${r.n} qatar) · khane: ${r.hit.join(', ')}`);
  L.push('', '== (1) setting khane (naam: prev / balance / bal …, ≤ 60 qatar) ==');
  for (const c of (pb && pb.cols) || []) L.push(`${c.t} (${c.n}) · ${c.c} [${c.d}] = ${c.v.join(' | ')}`);
  L.push('', "== (2) likhai mein 'previous bal…' =="); for (const t of (pb && pb.text) || []) L.push(`${t.t} (${t.n}) · ${t.c} · len ${t.len} :: ${t.s}`);
  L.push('', '== (3) blob (report layout?) =='); for (const b of (pb && pb.blob) || []) L.push(`${b.t} (${b.n}) · ${b.c} [${b.d}] · ${b.L} bytes · ascii@${b.A} utf16@${b.U} · shuru: ${b.h}${b.s ? '\n    :: ' + b.s : ''}`);
  L.push('', '== (4) Consus / POS ka folder =='); if (cd) { L.push('process: ' + cd.procs.join(' ; ')); for (const d of cd.dirs) { L.push('DIR ' + d.d, '  ' + d.names.join(' · '), '  report-jaisi files:'); for (const h of d.hit) L.push('   ' + h); } } else L.push('(nahi mila)');
  if (pb && pb.err.length) L.push('', '== ghaltiyan ==', ...pb.err.slice(0, 30));
  return L.join('\r\n');
}

// v3.0: procedures / views + har table ke khane + setting table + Consus folder (SIRF PARHNA)
const HIDE = /pass|pwd|secret|token|apikey|api_key|licen|serial|hash|salt|connection|data source|user id|uid=|initial catalog/i;
const PBRX = /prev\w*\s*bal\w*|previous\s*b\w*|pre_?bal\w*|old_?bal\w*|show_?bal\w*|print_?bal\w*/ig;
async function v3Scan(pool) {
  const out = { mods: [], prn: [], names: [], set: [], err: [] };
  const q = async (t, ms) => { const rq = pool.request(); rq.timeout = ms || 20000; return (await rq.query(t)).recordset; };
  const qi = x => '[' + String(x).replace(/]/g, ']]') + ']';
  try {
    const rs = await q(`SELECT TOP 30 SCHEMA_NAME(o.schema_id) + '.' + o.name AS N, o.type_desc AS T, m.definition AS D
      FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
      WHERE m.definition LIKE '%prev%bal%' OR m.definition LIKE '%previous%b%' OR m.definition LIKE '%prebal%' OR m.definition LIKE '%pre_bal%'
         OR m.definition LIKE '%oldbal%' OR m.definition LIKE '%showbal%' ORDER BY o.name`, 30000);
    for (const r of rs) {
      const d = String(r.D || ''), hits = [], seen = new Set(); let m; PBRX.lastIndex = 0;
      while ((m = PBRX.exec(d)) && hits.length < 5) {
        const a = d.lastIndexOf('\n', m.index - 1), b = d.indexOf('\n', m.index);
        let line = d.slice(a < 0 ? 0 : a + 1, b < 0 ? d.length : b).replace(/\s+/g, ' ').trim();
        if (HIDE.test(line)) line = '(line chhupi — password / connection jaisa lafz)';
        if (!seen.has(line)) { seen.add(line); hits.push(cut(line, 220)); }
      }
      out.mods.push({ n: r.N, t: r.T, len: d.length, ws: /wholesale|whole_?sale|is_?ws\b|salet?ype/i.test(d) ? 1 : 0, h: hits });
    }
  } catch (e) { out.err.push('mods: ' + cut(e.message, 120)); }
  try {
    const rs = await q(`SELECT TOP 60 SCHEMA_NAME(schema_id) + '.' + name AS N, type_desc AS T FROM sys.objects
      WHERE type IN ('P', 'V', 'FN', 'IF', 'TF') AND (name LIKE '%print%' OR name LIKE '%invoice%' OR name LIKE '%receipt%' OR name LIKE '%report%' OR name LIKE '%bill%') ORDER BY name`);
    out.prn = rs.map(r => r.N + ' (' + String(r.T || '').replace('SQL_', '').replace('_PROCEDURE', ' P').toLowerCase() + ')');
  } catch (e) { out.err.push('prn: ' + cut(e.message, 120)); }
  let cols = [], rows = new Map();
  try {
    for (const r of await q(`SELECT s.name AS S, t.name AS T, SUM(p.rows) AS N FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1) GROUP BY s.name, t.name`)) rows.set(r.S + '.' + r.T, Number(r.N) || 0);
    cols = await q(`SELECT c.TABLE_SCHEMA AS S, c.TABLE_NAME AS T, c.COLUMN_NAME AS C, c.DATA_TYPE AS D FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'`);
  } catch (e) { out.err.push('cols: ' + cut(e.message, 120)); }
  for (const c of cols) if (/prev|pre_?bal|oldbal|showbal|printbal|balance|wholesale/i.test(c.C) && !SECRET.test(c.C) && out.names.length < 100)
    out.names.push(`${c.S}.${c.T} (${rows.get(c.S + '.' + c.T) || 0}) · ${c.C} [${c.D}]`);
  const byT = new Map();
  for (const c of cols) { const k = c.S + '.' + c.T, n = rows.get(k) || 0;
    if (n < 1 || n > 2000 || !/setting|config|option|pref|param|setup|company|system|general|invoice|print|report|default|control|flag/i.test(c.T)) continue;
    if (!byT.has(k)) byT.set(k, { S: c.S, T: c.T, n, all: [] }); byT.get(k).all.push(c); }
  for (const [k, o] of byT) {
    if (out.set.length >= 60) break;
    const ok = o.all.filter(c => !SECRET.test(c.C) && !HIDE.test(c.C) && !/binary|image|xml/i.test(c.D));
    const flag = ok.filter(c => /show|print|bal|prev|whole|ws|sabq/i.test(c.C)).slice(0, 25);
    if (flag.length) { try { const rs = await q(`SELECT TOP 3 ${flag.map(c => qi(c.C)).join(', ')} FROM ${qi(o.S)}.${qi(o.T)}`);
      out.set.push({ t: k, n: o.n, k: 'khane', v: flag.map(c => c.C + '=' + rs.map(r => cut(r[c.C], 30)).join('|')) }); } catch (e) { out.err.push(k + ': ' + cut(e.message, 80)); } }
    const txt = ok.filter(c => /char|text/i.test(c.D)).slice(0, 15);
    if (txt.length) { try {
      const w = txt.map(c => `LOWER(CAST(${qi(c.C)} AS NVARCHAR(MAX))) LIKE N'%prev%' OR LOWER(CAST(${qi(c.C)} AS NVARCHAR(MAX))) LIKE N'%balance%'`).join(' OR ');
      const rs = await q(`SELECT TOP 8 ${ok.slice(0, 12).map(c => qi(c.C)).join(', ')} FROM ${qi(o.S)}.${qi(o.T)} WHERE ${w}`);
      for (const r of rs) { const line = ok.slice(0, 12).map(c => c.C + '=' + cut(r[c.C], 40)).join(' · '); out.set.push({ t: k, n: o.n, k: 'qatar', v: [HIDE.test(line) ? '(chhupi)' : line] }); }
    } catch (e) { out.err.push(k + ' (qatar): ' + cut(e.message, 80)); } }
  }
  return out;
}
async function consusDir3() {
  const res = { procs: [], lnk: [], dirs: [], cfg: [] };
  if (process.platform !== 'win32') return res;
  res.procs = (await ps("Get-Process | Where-Object { $_.ProcessName -match 'consus|cognit' } | ForEach-Object { $_.ProcessName + ' (pid ' + $_.Id + ')' } ; Get-CimInstance Win32_Process -Filter \"Name LIKE 'Consus%'\" | ForEach-Object { 'CIM ' + $_.Name + ' | ' + $_.ExecutablePath }")).split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 10);
  res.lnk = (await ps("$w = New-Object -ComObject WScript.Shell; Get-ChildItem -Path 'C:\\Users\\*\\Desktop','C:\\Users\\Public\\Desktop','C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs','C:\\Users\\*\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs' -Filter *.lnk -Recurse -Depth 2 -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'consus|cognit|pos' } | ForEach-Object { $_.Name + ' -> ' + $w.CreateShortcut($_.FullName).TargetPath }", 30000)).split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 15);
  const dirs = new Set();
  for (const l of [...res.procs, ...res.lnk]) { const m = l.match(/([A-Za-z]:\\[^|<>"]+\.exe)/i); if (m) dirs.add(path.dirname(m[1].trim())); }
  for (const base of ['C:\\', 'D:\\', 'E:\\', 'C:\\Program Files', 'C:\\Program Files (x86)']) { try { for (const n of fs.readdirSync(base)) if (/consus|cognit/i.test(n)) { const d = path.join(base, n); try { if (fs.statSync(d).isDirectory()) dirs.add(d); } catch {} } } catch {} }
  for (const d of [...dirs].slice(0, 4)) {
    const names = [], hit = [];
    const walk = (x, depth) => { let E = []; try { E = fs.readdirSync(x, { withFileTypes: true }); } catch { return; }
      for (const e of E) { const p = path.join(x, e.name);
        if (depth === 0 && names.length < 300) { let kb = ''; try { if (!e.isDirectory()) kb = ' ' + Math.round(fs.statSync(p).size / 1024) + 'K'; } catch {} names.push((e.isDirectory() ? '[D] ' : '') + e.name + kb); }
        if (e.isDirectory()) { if (depth < 2) walk(p, depth + 1); continue; }
        if (/\.(config|ini|xml|json|txt|settings|cfg)$/i.test(e.name) && res.cfg.length < 60) {
          try { const st = fs.statSync(p); if (st.size > 2 << 20) continue;
            const L = fs.readFileSync(p, 'utf8').split(/\r?\n/);
            L.forEach((ln, i) => { if (res.cfg.length < 60 && /prev|balance|wholesale|whole_?sale/i.test(ln) && !HIDE.test(ln)) res.cfg.push(path.relative(d, p) + ':' + (i + 1) + ' ' + cut(ln.trim(), 200)); });
          } catch {}
        }
        if (/report|invoice|bill|receipt|print|layout|template|\.repx|\.rpt|\.rdlc|\.frx|\.mrt/i.test(e.name) && hit.length < 80) { try { hit.push(path.relative(d, p) + ' (' + Math.round(fs.statSync(p).size / 1024) + ' KB)'); } catch {} } } };
    walk(d, 0); res.dirs.push({ d, names, hit });
  }
  return res;
}
function v3Text(v3, c3, roots) {
  const L = ['', '== (5) procedures / views jin mein PrevBal / PreviousBalance (bill ka data) =='];
  for (const m of (v3 && v3.mods) || []) { L.push(`${m.n} [${m.t}] · ${m.len} harf${m.ws ? ' · wholesale ka zikr' : ''}`); for (const h of m.h) L.push('    :: ' + h); }
  L.push('', '== (5b) print / invoice / receipt / report / bill naam wale procedure / view =='); L.push(((v3 && v3.prn) || []).join(' ; '));
  L.push('', '== (6) har table ke prev / balance / wholesale khanon ke naam (qeemat nahi) =='); for (const n of (v3 && v3.names) || []) L.push(n);
  L.push('', '== (7) setting jaise table (<= 2000 qatar) =='); for (const x of (v3 && v3.set) || []) L.push(`${x.t} (${x.n}) ${x.k}: ${x.v.join(' · ')}`);
  L.push('', '== (8) Consus =='); L.push('process: ' + ((c3 && c3.procs) || []).join(' ; ')); L.push('shortcut: ' + ((c3 && c3.lnk) || []).join(' ; '));
  for (const d of (c3 && c3.dirs) || []) { L.push('DIR ' + d.d, '  ' + d.names.join(' · '), '  report-jaisi files:'); for (const h of d.hit) L.push('   ' + h); }
  L.push('  config lines (prev / balance / wholesale):'); for (const x of (c3 && c3.cfg) || []) L.push('   ' + x);
  L.push('', '== (9) v1 file talaash ke folder =='); L.push((roots || []).join(' ; '));
  if (v3 && v3.err.length) L.push('', '== v3 ghaltiyan ==', ...v3.err.slice(0, 30));
  return L.join('\r\n');
}
async function run(pool, sql, ref, log) {
  try {
    const old = (await ref.get()).data() || {};
    if (Number(old.v) === V && old.host === os.hostname() && Date.now() - (Number(old.at) || 0) < 7 * 86400000) return;
    log('🔎 POS bill jaanch shuru (sirf parhna)…');
    let dbr = [], dbErr = '', fr = { roots: [], files: [], total: 0 };
    try { dbr = await dbScan(pool, sql); } catch (e) { dbErr = String(e.message || e).slice(0, 160); }
    try { fr = await fileScan(); } catch (e) { fr.err = String(e.message || e).slice(0, 160); }
    let pb = null, cd = null;
    try { pb = await pbScan(pool, sql); } catch (e) { pb = { cols: [], text: [], blob: [], err: ['pb: ' + String(e.message || e).slice(0, 160)] }; }
    try { cd = await consusDir(); } catch (e) { cd = null; }
    let v3 = null, c3 = null;
    try { v3 = await v3Scan(pool); } catch (e) { v3 = { mods: [], prn: [], names: [], set: [], err: ['v3: ' + String(e.message || e).slice(0, 160)] }; }
    try { c3 = await consusDir3(); } catch (e) { c3 = null; }
    try { fs.writeFileSync(path.join(__dirname, 'pos-jaanch.txt'), pbText(dbr, pb, cd) + v3Text(v3, c3, fr.roots)); } catch (e) { log('🔎 jaanch file: ' + (e.message || e)); }
    let j = JSON.stringify({ db: dbr, dbErr, ...fr, pb }); if (j.length > 600000) j = JSON.stringify({ db: dbr.slice(0, 4), dbErr, roots: fr.roots, files: fr.files.slice(0, 30), total: fr.total });   // pb poora sirf local file mein
    await ref.set({ at: Date.now(), host: os.hostname(), v: V, j });
    log(`🔎 POS bill jaanch v${V}: database ${dbr.length} jagah · template files ${fr.total} · prev/balance khane ${pb ? pb.cols.length : 0} · likhai ${pb ? pb.text.length : 0} · blob ${pb ? pb.blob.length : 0} · proc ${v3 ? v3.mods.length : 0} · setting ${v3 ? v3.set.length : 0} · Consus folder ${c3 ? c3.dirs.length : 0} → pos-jaanch.txt`);
  } catch (e) { log('🔎 jaanch: ' + (e.message || e)); }
}
module.exports = { run, V };
