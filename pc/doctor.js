// =========================================================
//  doctor.js  v1 (2026-09-25) — KHATA PC DOCTOR
//  PC on hote hi (KHATA-DOCTOR.bat, Startup se) chalta hai aur har 30 minute:
//   1) GitHub (repo ka pc/ folder) se manifest.json — jo script BADLI ho sirf wahi download, purani backup\<din>\ mein,
//      aur sirf USI ko dobara shuru (node band -> us ki .bat 30 sec mein nayi utha leti hai).
//   2) Har script zinda hai? Band ho to us ki .bat chupke se chala do.
//   3) Report Firebase blueAccess/pcStatus mein — app ki "🖥️ PC scripts" screen isi se. App "Abhi check" dabaye
//      (blueAccess/pcCheck) to 1 minute ke andar jaanch.
//  KABHI NAHI chhoota: local-config.json (SQL password), firebase-key.json, label-settings.json, label-numbers.json.
//  Log: doctor-log.txt. Lock port 47830.
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

const DIR = __dirname;
const VER = '1';
const EVERY = 30 * 60 * 1000;
const LOCK_PORT = 47830;
const NEVER = new Set(['local-config.json', 'firebase-key.json', 'label-settings.json', 'label-numbers.json', 'package.json', 'package-lock.json']);

const logFile = path.join(DIR, 'doctor-log.txt');
const recent = [];
function log(...a) {
  const line = `[${new Date().toLocaleString('en-PK')}] ` + a.join(' ');
  console.log(line); recent.push(line); if (recent.length > 60) recent.shift();
  try { fs.appendFileSync(logFile, line + '\r\n'); } catch {}
}

// ---------- local-config.json (SQL) ----------
function readLocal() { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')) || {}; } catch { return {}; } }
function oldSql() {
  for (const f of ['sync-stock.js', 'sync-bills.js', 'sync.js']) {
    try {
      const s = fs.readFileSync(path.join(DIR, f), 'utf8');
      const m = s.match(/const SQL_CONFIG\s*=\s*(\{[\s\S]*?\n\});/);
      if (!m) continue;
      const c = Function('return ' + m[1])();
      if (c && c.server && c.password && !/^\*+$/.test(String(c.password))) return c;
    } catch {}
  }
  return null;
}
async function ask(q) {
  if (!process.stdin.isTTY) return '';
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, a => { rl.close(); r(String(a || '').trim()); }));
}
async function ensureConfig() {
  const local = readLocal();
  if (local.sql && local.sql.password) return true;
  const c = oldSql();                                   // PEHLE purani scripts se (naye download se pehle!)
  if (c) {
    fs.writeFileSync(path.join(DIR, 'local-config.json'), JSON.stringify({ ...local, sql: { server: c.server, database: c.database, user: c.user, password: c.password } }, null, 2));
    log('local-config.json bana di (purani sync-stock.js se SQL ki setting li)');
    return true;
  }
  log('SQL ki setting nahi mili — poochh raha hoon');
  const server = await ask('SQL server (Enter = localhost\\SQLEXPRESS): ') || 'localhost\\SQLEXPRESS';
  const database = await ask('Database ka naam (Enter = POS): ') || 'POS';
  const user = await ask('User (Enter = sa): ') || 'sa';
  const password = await ask('Password: ');
  if (!password) { log('Password nahi diya — SQL wali scripts nahi chalengi. KHATA-DOCTOR.bat dobara chalayein.'); return false; }
  fs.writeFileSync(path.join(DIR, 'local-config.json'), JSON.stringify({ ...local, sql: { server, database, user, password } }, null, 2));
  log('local-config.json save ho gayi');
  return true;
}

// ---------- GitHub ----------
function repos() { const l = readLocal(); return l.repo ? [l.repo] : ['samiullah-878/Noor-traders-', 'samiullah-878/Noor-traders']; }
function get(url, n = 0) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'khata-doctor', 'Cache-Control': 'no-cache' }, timeout: 20000 }, r => {
      if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location && n < 4) { r.resume(); return res(get(r.headers.location, n + 1)); }
      if (r.statusCode !== 200) { r.resume(); return rej(Error('HTTP ' + r.statusCode)); }
      const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b)));
    }).on('error', rej).on('timeout', function () { this.destroy(Error('timeout')); });
  });
}
let base = '';
async function manifest() {
  const tries = base ? [base] : repos().map(r => `https://raw.githubusercontent.com/${r}/main/pc/`);
  for (const b of tries) {
    try { const m = JSON.parse((await get(b + 'manifest.json?t=' + Date.now())).toString('utf8')); if (m && m.files) { base = b; return m; } } catch {}
  }
  return null;
}
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
function localSha(f) { try { return sha(fs.readFileSync(path.join(DIR, f))); } catch { return ''; } }

async function update(m) {
  const changed = [];
  if (!(readLocal().sql && readLocal().sql.password)) { log('⚠ SQL ki setting (local-config.json) nahi — koi script nahi badli (warna sab ruk jatin)'); return changed; }
  const day = new Date().toISOString().slice(0, 10);
  for (const [f, want] of Object.entries(m.files || {}).sort((a, b) => (a[0] === 'sql-config.js' ? -1 : b[0] === 'sql-config.js' ? 1 : 0))) {
    if (NEVER.has(f) || f.includes('/') || f.includes('\\')) continue;
    if (localSha(f) === want) continue;
    try {
      const buf = await get(base + encodeURIComponent(f) + '?t=' + Date.now());
      if (sha(buf) !== want) { log(`⚠ ${f}: download adhoori (sha nahi mila) — purani rehne di`); continue; }
      const p = path.join(DIR, f);
      if (fs.existsSync(p)) { const bd = path.join(DIR, 'backup', day); fs.mkdirSync(bd, { recursive: true }); fs.copyFileSync(p, path.join(bd, f)); }
      fs.writeFileSync(p + '.new', buf); fs.renameSync(p + '.new', p);
      changed.push(f); log(`⬇ nayi lagi: ${f}`);
    } catch (e) { log(`⚠ ${f}: ${e.message}`); }
  }
  return changed;
}

// ---------- processes ----------
function procs() {
  try {
    const out = execSync('wmic process where "name=\'node.exe\' or name=\'cmd.exe\'" get processid,commandline /format:csv', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    return out.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^Node,CommandLine/i.test(l)).map(l => {
      const parts = l.split(','); const pid = Number(parts.pop()); parts.shift(); return { cmd: parts.join(',').toLowerCase(), pid };
    });
  } catch { return []; }
}
// poora naam hi mile — "sync.js" ko "pos-khata-sync.js" na samjhe
const word = (hay, w) => new RegExp('(^|[\\s\\\\/"])' + w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s"]|$)').test(hay);
const runsScript = (p, s) => /node(\.exe)?"?\s/.test(p.cmd) && word(p.cmd, s.script);
const runsBat = (p, s) => word(p.cmd, s.bat);
function alive(s, list) { return list.some(p => runsScript(p, s) || runsBat(p, s)); }
function startBat(s) {
  const b = path.join(DIR, s.bat);
  if (!fs.existsSync(b)) { log(`⚠ ${s.bat} nahi mili`); return false; }
  spawn('cmd.exe', ['/c', b], { cwd: DIR, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return true;
}
function stopScript(s, list) {
  let n = 0;
  for (const p of list) if (runsScript(p, s)) { try { process.kill(p.pid); n++; } catch {} }
  return n;
}
function verOf(f) { try { const h = fs.readFileSync(path.join(DIR, f), 'utf8').slice(0, 600); const m = h.match(/\bv(\d+(?:\.\d+)*)\b/); return m ? 'v' + m[1] : ''; } catch { return ''; } }
function lastLine(f) {
  try { const p = path.join(DIR, f); const st = fs.statSync(p); const fd = fs.openSync(p, 'r'); const len = Math.min(st.size, 3000); const b = Buffer.alloc(len);
    fs.readSync(fd, b, 0, len, st.size - len); fs.closeSync(fd);
    const ls = b.toString('utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean); return { line: (ls.pop() || '').slice(0, 160), at: st.mtimeMs };
  } catch { return { line: '', at: 0 }; }
}

// ---------- Firebase ----------
let db = null, FieldValue = null;
function fb() {
  if (db) return db;
  const key = path.join(DIR, 'firebase-key.json');
  if (!fs.existsSync(key)) { log('⚠ firebase-key.json nahi mili — app ko report nahi jayegi (purane PC se copy karein)'); return null; }
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const fsx = require('firebase-admin/firestore'); FieldValue = fsx.FieldValue;
    if (!getApps().length) initializeApp({ credential: cert(require(key)) });
    db = fsx.getFirestore(); return db;
  } catch (e) { log('⚠ Firebase: ' + e.message); return null; }
}
const statusRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcStatus');
const checkRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcCheck');

// ---------- ek chakkar ----------
let services = [], manifestVer = '', lastGit = 0, busy = false, restartSelf = false;
async function cycle(why) {
  if (busy) return; busy = true;
  try {
    log(`— jaanch (${why}) —`);
    await ensureConfig();
    let changed = [];
    const m = await manifest();
    if (m) {
      manifestVer = String(m.version || ''); lastGit = Date.now();
      services = Array.isArray(m.services) ? m.services : services;
      changed = await update(m);
      if (changed.includes('doctor.js')) restartSelf = true;
    } else log('GitHub tak nahi pahuncha (internet?) — sirf jaanch');
    if (!services.length) try { services = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')).services || []; } catch {}
    let list = procs();
    const rows = [];
    for (const s of services) {
      let action = '';
      if (changed.includes(s.script) && alive(s, list)) { const n = stopScript(s, list); if (n) { action = 'nayi lagi — dobara shuru'; log(`↻ ${s.script}: nayi file, dobara shuru`); } }
      else if (changed.includes(s.script)) action = 'nayi lagi';
      if (!alive(s, list)) {
        if (startBat(s)) { action = action || 'band thi — chala di'; log(`▶ ${s.script}: band thi, ${s.bat} chala di`); }
        else action = 'band — .bat nahi mili';
      }
      const ll = s.log ? lastLine(s.log) : { line: '', at: 0 };
      rows.push({ name: s.name || s.script, script: s.script, ver: verOf(s.script), action, log: ll.line, logAt: ll.at, periodic: !!s.periodic });
    }
    await new Promise(r => setTimeout(r, 4000));
    list = procs();
    for (const r of rows) { const s = services.find(x => x.script === r.script); r.ok = s ? alive(s, list) : false; if (!r.ok && !r.action) r.action = 'band'; }
    const ref = statusRef();
    if (ref) await ref.set({ at: Date.now(), host: os.hostname(), bootAt: Date.now() - os.uptime() * 1000, doctor: VER, manifest: manifestVer,
      lastGit, changed, services: rows, recent: recent.slice(-30) }).catch(e => log('⚠ report: ' + e.message));
    log(`✓ ${rows.filter(r => r.ok).length}/${rows.length} chal rahi${changed.length ? ' · nayi: ' + changed.join(', ') : ''}`);
  } catch (e) { log('⚠ ' + (e?.message || e)); }
  finally { busy = false; }
  if (restartSelf) { log('doctor.js khud nayi aayi — dobara shuru'); setTimeout(() => process.exit(0), 1500); }
}

// ---------- Startup mein apna shortcut ----------
function ensureStartup() {
  try {
    const st = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const vbs = path.join(st, 'KHATA-DOCTOR.vbs');
    const want = `' KHATA-DOCTOR — PC on ke 2 minute baad chupke se\r\nWScript.Sleep 120000\r\nCreateObject("WScript.Shell").Run "cmd /c ""${path.join(DIR, 'KHATA-DOCTOR.bat')}""", 0, False\r\n`;
    if (!fs.existsSync(vbs) || fs.readFileSync(vbs, 'utf8') !== want) { fs.writeFileSync(vbs, want); log('Startup mein KHATA-DOCTOR laga diya'); }
  } catch (e) { log('⚠ Startup: ' + e.message); }
}
function ensureModules() {
  const need = ['mssql', 'firebase-admin'].filter(p => !fs.existsSync(path.join(DIR, 'node_modules', p)));
  if (!need.length) return;
  log('Zaroori packages install ho rahe hain: ' + need.join(', ') + ' (pehli dafa, 1-2 minute)');
  try { execSync('npm install --no-audit --no-fund ' + need.join(' '), { cwd: DIR, stdio: 'inherit' }); } catch (e) { log('⚠ npm: ' + e.message); }
}

// ---------- shuru ----------
const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('KHATA-DOCTOR pehle se chal raha hai.'); process.exit(3); });
lock.on('listening', async () => {
  log(`KHATA-DOCTOR v${VER} shuru — ${os.hostname()}`);
  ensureStartup(); ensureModules();
  await cycle('shuru');
  setInterval(() => cycle('30 minute'), EVERY);
  let lastAsk = 0;
  const ref = checkRef();
  if (ref) ref.onSnapshot(d => { const at = Number(d.data()?.at) || 0; if (!lastAsk) { lastAsk = at || 1; return; } if (at > lastAsk) { lastAsk = at; cycle('app se "Abhi check"'); } }, e => log('⚠ pcCheck: ' + e.message));
});
