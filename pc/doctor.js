// =========================================================
//  v3.15 (2026-11-24, app v2.376.0, malik ki photo: 📊 PC ka bojh mein ↑ 0 KB · ↓ 0 KB): network ab .NET NetworkInterface se (Get-NetAdapter -Physical | Get-NetAdapterStatistics
//    is PC par khali deta tha) + pcLoad.nic = kaun sa network chal raha (Wi-Fi / LAN taar + link ki raftar) — cameras grey ki jaanch ke liye. AI nahi.
//  v3.14 (2026-11-24, app v2.373.0): 📊 PC KA BOJH — cpuTick ke naap har 5 min ek nuqta (CPU / RAM average, network ↑ / ↓, har kaam ka CPU + RAM) → blueAccess/pcLoad
//    (24 ghante, ek doc); network bytes usi PowerShell mein. 📼 sab cameras ki ffmpeg ab apne naam se (pehle 'bill ki clip' dikhti thi). Sirf naap. AI nahi.
//  v3.13 (2026-11-17, app v2.319.0): 🚨 DUKAN KI NABZ — nabz.js (alag file) har 60 s dukan ka haal ek doc (pcBeat/<chaabi>) mein, malik ke phone ka
//    MacroDroid '🚨 Dukan nigrani' parhta hai (PC / internet band, thermal phansa, WhatsApp toota, bill nahi …). Sirf server (BLOCKED nahi). AI nahi.
//  doctor.js  v3.1 (2026-11-10: 🔥 CPU list ab WMI Win32_Process se — SQL Server / antivirus jaise SYSTEM program bhi; ek jaise program jama (×N); 'baqi' line.)
//  v3.3 (2026-11-16: 🖨 is PC par lage printers ke naam + haalat har 2 min app ko (blueAccess/pcPrinters) + scripts ko jo naam chahiye (thermal TM-T88IV, label label-settings.json) mila ya nahi — malik: 'script wali screen mein jo printer add ho jayein un ka naam'. Sirf parhna.)
//  v3.0 (2026-11-10: 🔥 PC ka CPU / RAM + sab se zyada CPU wale 5 program har 1 min app ko (blueAccess/pcCpu) — malik: "CPU 100% · data app mein aa jaye". Async, doctor nahi rukta.)
//  v2.9 (2026-10-22: 🩹 21-Oct shaam 6:50 doctor CHUP ho gaya aur stock script bhi band — subah tak koi dobara chalane wala nahi. Ab: (1) taskkill /T (poora tree) KABHI NAHI —
//              Windows mare hue parent ka PID naye process ko de deta hai, /T phir be-taaluq scripts (stock) aur doctor ki apni loop bhi band kar deta · (2) WMIC / taskkill par waqt ki hadd
//              (WMIC atke to pehle doctor hamesha ke liye ruk jata) + WMIC na chale to PowerShell (CIM); list hi na mile = is chakkar mein koi script shuru / band NAHI · (3) chakkar 10 min se
//              atka = doctor khud band, .bat 20 sec mein naya · (4) NT-PRINT (server PC) doctor 15 min chup dekhe to jagata hai — doctor-jaga.txt ka paigham log mein)
//              · v2.8 (2026-10-20: .bat badle (jaise har 2 min → 1 min) to purani loop band kar ke nayi chalao — pehle purani loop chalti rehti thi, naya waqfa nahi lagta tha) · v2.7 (2026-10-08: GitHub par NAYA manifest version har 3 min dekho — naya ho to foran poori jaanch + update (pehle sirf 30 min) ·
//              purana / CDN ka baasi manifest (chhota version) par kuch nahi) · v2.6 (2026-10-04: sab scripts CHUPKE (chupa.vbs, koi window nahi) · ek dafa purani dikhti windows band kar ke chupke chalata hai ·
//              PC ka waqt ghalat -> "NT Waqt Theek" task + w32tm, pcStatus.clockOff app ko) · v2.5 (non-periodic zinda = node) · v2.4 (taskkill /F)
//              · v2.3 (2026-10-01: HEARTBEAT — latki script pakar kar dobara) · v2.2 (3 dafa ke baad bhi 30 min mein phir koshish) · v2.1 (UNAUTHENTICATED par doctor khud dobara · PC ka waqt jaanch) · v2 (2026-09-25) — KHATA PC DOCTOR
//  v2: sirf ZINDA nahi, KAAM bhi dekhta hai — qataar (appPurchases, appSales, labelJobs...) mein koi kaam 3 min se
//      zyada ruka ho to wohi script dobara shuru (10 min mein ek dafa, 3 dafa ke baad ruk kar batata hai). Har 2 min jaanch,
//      GitHub har 30 min. pcCheck ka rabta toote to khud dobara jurta hai.
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
const { execSync, execFileSync, execFile, spawn } = require('child_process');

const DIR = __dirname;
const VER = '3.15';
const EVERY = 30 * 60 * 1000;          // GitHub
const QUICK = 2 * 60 * 1000;           // zinda + atka kaam
const GITQ = 3 * 60 * 1000;            // v2.7: GitHub naya version? (chhota manifest)
const STUCK = 3 * 60 * 1000, REST_GAP = 10 * 60 * 1000;
const hung = {};   // v2.3: heartbeat se pakri latki scripts
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
// v2.9: WMIC kabhi atak jata hai — execSync BINA hadd = doctor hamesha ke liye ruka (report / "Abhi check" / scripts dobara chalana sab band). Ab 30 sec hadd;
//   WMIC na chale / atke to 1 ghanta PowerShell (CIM, 40 sec hadd). Dono na chalein = null → is chakkar mein KOI script shuru / band nahi (andhi list par sab "band" lagti thi).
let wmicBad = 0, lastList = null;
const parseProcs = out => String(out || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^Node,CommandLine/i.test(l)).map(l => {
  const parts = l.split(','); const pid = Number(parts.pop()); parts.shift(); return { cmd: parts.join(',').toLowerCase(), pid };
}).filter(p => p.pid > 0);
function procs() {
  if (Date.now() - wmicBad > 60 * 60 * 1000) {
    try { const l = parseProcs(execSync('wmic process where "name=\'node.exe\' or name=\'cmd.exe\'" get processid,commandline /format:csv', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 30000 })); if (l.length) return (lastList = l); }
    catch (e) { wmicBad = Date.now(); log('⚠ WMIC nahi chala / atka (' + String(e.code || e.message || e).slice(0, 40) + ') — 1 ghanta PowerShell se'); }
  }
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='cmd.exe'\" | ForEach-Object { 'x,' + ([string]$_.CommandLine -replace ',', ' ') + ',' + $_.ProcessId }"], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 40000 });
    const l = parseProcs(out); if (l.length) return (lastList = l);
  } catch (e) { log('⚠ PowerShell process list bhi nahi (' + String(e.code || e.message || e).slice(0, 40) + ')'); }
  return null;
}
// poora naam hi mile — "sync.js" ko "pos-khata-sync.js" na samjhe
const word = (hay, w) => new RegExp('(^|[\\s\\\\/"])' + w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s"]|$)').test(hay);
const runsScript = (p, s) => /node(\.exe)?"?\s/.test(p.cmd) && word(p.cmd, s.script);
const runsBat = (p, s) => word(p.cmd, s.bat);
function alive(s, list) { return list.some(p => runsScript(p, s) || (s.periodic && runsBat(p, s))); }   // v2.5: lambi script = node zaroori
// v2.6: Node ka spawn(detached + windowsHide) Windows par cmd ki window phir bhi dikha deta tha. Ab wscript + chupa.vbs
// (Run ..., 0 = window chhupi) — wscript khud GUI hai, us ki koi console nahi.
const CHUPA = path.join(DIR, 'chupa.vbs');
const CHUPA_TXT = "' chupa.vbs (KHATA-DOCTOR v2.6) - .bat ko bina window ke chalata hai\r\nIf WScript.Arguments.Count > 0 Then CreateObject(\"WScript.Shell\").Run \"cmd /c \"\"\" & WScript.Arguments(0) & \"\"\"\", 0, False\r\n";
function ensureChupa() {
  try { if (!fs.existsSync(CHUPA) || fs.readFileSync(CHUPA, 'utf8') !== CHUPA_TXT) fs.writeFileSync(CHUPA, CHUPA_TXT); return true; }
  catch (e) { log('⚠ chupa.vbs: ' + e.message); return false; }
}
function startBat(s) {
  const b = path.join(DIR, s.bat);
  if (!fs.existsSync(b)) { log(`⚠ ${s.bat} nahi mili`); return false; }
  if (process.platform === 'win32' && ensureChupa()) {
    try { spawn('wscript.exe', ['//B', '//Nologo', CHUPA, b], { cwd: DIR, detached: true, stdio: 'ignore', windowsHide: true }).unref(); return true; }
    catch (e) { log('⚠ wscript: ' + e.message + ' — purane tareeqe se'); }
  }
  spawn('cmd.exe', ['/c', b], { cwd: DIR, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return true;
}
// v2.9: /T (poora tree) KABHI NAHI — Windows mare hue parent (chupa.vbs ka wscript) ka PID naye process ko de deta hai; taskkill /T phir us PID ke
//   "bachche" samajh kar be-taaluq scripts (21-Oct: stock) aur doctor ki apni loop bhi band kar deta. Har process ALAG pakra jata hai (bat + node dono list mein) — tree ki zaroorat nahi.
function killPid(pid) {
  try { process.kill(pid); } catch {}
  try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true, timeout: 15000 }); } catch {}
}
function stopScript(s, list) {
  let n = 0;
  for (const p of list) if (runsScript(p, s)) { killPid(p.pid); n++; log(`■ ${s.script}: process ${p.pid} band ki`); }
  return n;
}
// v2.5: bat ki khaali window (node ke baghair) — purani loop band, warna do loop
function stopBatOnly(s, list) {
  let n = 0;
  for (const p of list) if (runsBat(p, s) && !runsScript(p, s) && /cmd(\.exe)?/.test(p.cmd)) { killPid(p.pid); n++; }
  return n;
}
// v2.6: ek dafa — jo bat loops pehle dikhti windows mein chal rahi thin unhein band kar ke chupke chalao
const HIDE_MARK = path.join(DIR, 'chupa.done');
function hideOnce(list) {
  if (process.platform !== 'win32' || fs.existsSync(HIDE_MARK)) return false;
  let n = 0;
  for (const s of services) for (const p of list) if (runsBat(p, s) && /cmd(\.exe)?/.test(p.cmd)) { killPid(p.pid); n++; }
  for (const s of services) for (const p of list) if (runsScript(p, s)) { killPid(p.pid); n++; }
  try { fs.writeFileSync(HIDE_MARK, String(Date.now())); } catch {}
  log(`🙈 v2.6: ${n} purani (dikhti) processes band — ab sab scripts chupke (bina window) chalengi`);
  return true;
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
// ---------- 🔥 v3.0: PC ka CPU / RAM app mein (malik 10 Nov: "CPU 100% chal raha hai · script se CPU ka data app mein aa jaye") ----------
//   Har 60 s (ASYNC — doctor kabhi nahi rukta, hadd 20 s): kul CPU (os.cpus farq) + RAM + sab se zyada CPU wale 5 program (Get-Process ka CPU waqt, do jaanch ka farq).
//   node / ffmpeg ka naam = script / kaam (command line se — command line KABHI Firestore / log mein nahi: us mein NVR ka password hota hai). → blueAccess/pcCpu.
const cpuRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcCpu');
const CPU = { prev: null, pt: null, pAt: 0, cmd: new Map(), hist: [], hot: 0, busy: false, cmdAt: 0 };
const cpuTotal = () => { let idle = 0, tot = 0; for (const c of os.cpus()) { for (const k in c.times) tot += c.times[k]; idle += c.times.idle; } return { idle, tot }; };
const psRun = (cmd, ms) => new Promise(res => { try { execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', windowsHide: true, timeout: ms || 20000, maxBuffer: 4 << 20 }, (e, out) => res(e ? '' : String(out || ''))); } catch { res(''); } });
function cpuLabel(name, pid) {
  const c = CPU.cmd.get(pid) || '', n = String(name || '').toLowerCase();
  if (n === 'node') { const m = c.match(/([\w-]+)\.js/i); return m ? m[1] + '.js' : 'node'; }
  if (n === 'ffmpeg') { const ch = (c.match(/clip-rec[\\/]ch(\d+)/i) || c.match(/channel=(\d+)/i) || [])[1]; return /sab-rec/i.test(c) ? 'ffmpeg · 📼 sab cameras (group recording)' : /clip-rec/i.test(c) && /segment/i.test(c) ? `ffmpeg · camera recording${ch ? ' ch ' + ch : ''}` : /rtp:\/\//i.test(c) ? 'ffmpeg · 🔴 live camera' : /clip-tmp|libx264/i.test(c) ? 'ffmpeg · 🎬 bill ki clip' : 'ffmpeg'; }
  if (n === 'sqlservr') return 'SQL Server (POS ka data)'; if (n === 'msmpeng') return 'Windows Defender (antivirus)'; if (n === 'powershell') return 'PowerShell'; if (n === 'chrome' || n === 'msedge') return n === 'chrome' ? 'Chrome' : 'Edge';
  return String(name || '?').slice(0, 40);
}
// ---------- 📊 v3.14: PC KA BOJH — 24 GHANTE KA HISAAB (malik 24 Nov: 'PC ka mukammal data usage, CPU aur RAM ka · chart · taake PC par se bojh kam kiya ja sake') ----------
//   cpuTick ke har 1 min ke naap jama → har 5 min EK nuqta (CPU / RAM ka average, network ↑ / ↓ KB, har kaam ka CPU + RAM) → blueAccess/pcLoad
//   {n: JSON naam ki list, p: JSON [[minute, cpu, ram, upKB, dnKB, [[naam#, cpu×10, MB]…]]…]} — aakhri 24 ghante (288 nuqte), ek doc, har 5 min ek likhai.
//   Shuru mein pehle purana doc parho (na parh sake = likhna band — warna 24 ghante ka hisaab mit jaye). Network = PC ke asli (physical) adapter ka kul —
//   cameras ka LAN bhi is mein hai (Windows har program ka internet alag nahi deta). Sirf naap — koi program band / badla nahi jata. AI nahi.
const loadRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcLoad');
const LOAD = { ready: false, tried: 0, pts: [], acc: null, at0: 0, net: null };
const loadKey = l => String(l || '?').replace(/ ch \d+$/, '').replace(/ ×\d+$/, '').slice(0, 60);   // har camera ki recording ek line (ch 1, ch 2 … jama)
async function loadInit() {
  if (LOAD.ready || Date.now() - LOAD.tried < 60000) return LOAD.ready; LOAD.tried = Date.now();
  const ref = loadRef(); if (!ref) return false;
  try {
    const s = await ref.get(), d = s.exists ? s.data() || {} : {};
    const N = JSON.parse(d.n || '[]'), P = JSON.parse(d.p || '[]'), lim = Math.round(Date.now() / 60000) - 24 * 60;
    LOAD.pts = (Array.isArray(P) ? P : []).filter(x => Array.isArray(x) && x[0] >= lim).map(x => ({ t: x[0], cpu: x[1], ram: x[2], up: x[3], dn: x[4], g: (Array.isArray(x[5]) ? x[5] : []).map(y => [String(N[y[0]] || '?'), (Number(y[1]) || 0) / 10, Number(y[2]) || 0]) }));
    LOAD.ready = true; return true;
  } catch (e) { log('⚠ pcLoad parhna: ' + String(e?.message || e).slice(0, 80)); return false; }
}
async function loadAdd(now, cpu, ram, grp, net) {
  let dUp = 0, dDn = 0;
  if (net && LOAD.net) { const a = net.rx - LOAD.net.rx, b = net.tx - LOAD.net.tx; if (a >= 0 && b >= 0 && a < 20e9 && b < 20e9) { dDn = a; dUp = b; } }
  if (net) { LOAD.net = net; LOAD.nic = net.ty || ''; }
  const A = LOAD.acc || (LOAD.acc = { n: 0, cpu: 0, ram: 0, up: 0, dn: 0, net: 0, g: new Map() }); if (!LOAD.at0) LOAD.at0 = now;
  A.n++; A.cpu += cpu; A.ram += ram; A.up += dUp; A.dn += dDn; if (net) A.net++;
  for (const g of grp.values()) { const k = loadKey(g.n), o = A.g.get(k) || { p: 0, m: 0 }; o.p += g.p; o.m += g.m; A.g.set(k, o); }
  if (now - LOAD.at0 < 5 * 60000 - 15000) return;
  const n = A.n; LOAD.acc = null; LOAD.at0 = now;   // agla nuqta theek 5 min baad
  if (!(await loadInit())) return;   // purana hisaab parha nahi gaya = likhna nahi
  const g = [...A.g.entries()].map(([k, o]) => [k, Math.round(o.p / n * 10) / 10, Math.round(o.m / n)]).filter(x => x[1] >= 0.3 || x[2] >= 300).sort((a, b) => b[1] - a[1]).slice(0, 10);
  LOAD.pts.push({ t: Math.round(now / 60000), cpu: Math.round(A.cpu / n), ram: Math.round(A.ram / n), up: A.net ? Math.round(A.up / 1024) : -1, dn: A.net ? Math.round(A.dn / 1024) : -1, g });
  const lim = Math.round(now / 60000) - 24 * 60; LOAD.pts = LOAD.pts.filter(x => x.t >= lim).slice(-300);
  const N = [], ix = new Map(), id = k => { if (!ix.has(k)) { ix.set(k, N.length); N.push(k); } return ix.get(k); };
  const P = LOAD.pts.map(x => [x.t, x.cpu, x.ram, x.up, x.dn, x.g.map(y => [id(y[0]), Math.round(y[1] * 10), y[2]])]);
  const ref = loadRef(); if (ref) await ref.set({ at: now, ver: VER, host: os.hostname(), cores: os.cpus().length || 1, ramGb: Math.round(os.totalmem() / (1 << 30)), nic: String(LOAD.nic || '').slice(0, 300), n: JSON.stringify(N), p: JSON.stringify(P) }).catch(e => log('⚠ pcLoad likhna: ' + String(e?.message || e).slice(0, 80)));
}
async function cpuTick() {
  if (BLOCKED || CPU.busy || process.platform !== 'win32') return; CPU.busy = true;
  try {
    const now = Date.now(), t = cpuTotal(), cores = os.cpus().length || 1;
    // v3.1: Win32_Process (WMI) — SYSTEM ke program (SQL Server, antivirus) ka CPU bhi deta hai (Get-Process bina admin 0 deta tha → "CPU 43%" magar list mein sirf 3%).
    //   Command line isi sawal mein (sirf node / ffmpeg ki) — sirf naam nikalne ko, memory mein; Firestore / log mein KABHI nahi.
    // v3.14: 📶 network ke bytes bhi ISI PowerShell mein (alag process nahi — PC par bojh na barhe); try/catch = purani Windows par sirf network khali, CPU list wahi
    const out = await psRun("Get-CimInstance Win32_Process | ForEach-Object { $n = [string]$_.Name; $cl = ''; if ($n -eq 'node.exe' -or $n -eq 'ffmpeg.exe') { $cl = [string]$_.CommandLine -replace '[\\r\\n|]', ' ' }; \"$($_.ProcessId)|$n|$([long](($_.KernelModeTime + $_.UserModeTime) / 10000))|$([int]($_.WorkingSetSize / 1MB))|$cl\" }" + (CPU.noNet >= 2 ? '; exit 0' :
      '; try { $rx = [long]0; $tx = [long]0; $ty = @(); foreach ($i in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) { if ([string]$i.OperationalStatus -ne \'Up\') { continue }; $k = [string]$i.NetworkInterfaceType; if ($k -eq \'Loopback\' -or $k -eq \'Tunnel\' -or $i.Description -match \'Virtual|Hyper-V|VMware|VirtualBox|TAP|VPN|Bluetooth|Miniport|Loopback\') { continue }; try { $s = $i.GetIPv4Statistics() } catch { continue }; $rx += [long]$s.BytesReceived; $tx += [long]$s.BytesSent; if ($s.BytesReceived -gt 0) { $ty += ($k + \'~\' + [long]($i.Speed / 1000000) + \'~\' + ([string]$i.Description -replace \'[|~,]\', \' \')) } }; \"NET|$rx|$tx|\" + ($ty -join \',\') } catch { \"NET||\" }; exit 0'));   // v3.15: .NET NetworkInterface (Get-NetAdapter wala raasta 0 deta tha) + kaun sa network (Wi-Fi / LAN taar, raftar)
    const cur = new Map(); CPU.cmd = new Map(); let net = null;
    for (const l of out.split(/\r?\n/)) { const a = l.trim().split('|'); if (a[0] === 'NET') { const rx = Number(a[1]), tx = Number(a[2]); if (a[1] && a[2] && rx >= 0 && tx >= 0) net = { rx, tx, ty: String(a[3] || '').slice(0, 300) }; continue; } const pid = Number(a[0]); if (a.length < 4 || !(pid > 0)) continue; const n = String(a[1] || '').replace(/\.exe$/i, ''); cur.set(pid, { n, c: Number(a[2]) || 0, m: Number(a[3]) || 0 }); if (a[4]) CPU.cmd.set(pid, a.slice(4).join(' ')); }
    if (!cur.size && !(CPU.noNet >= 2)) { CPU.noNet = (CPU.noNet || 0) + 1; if (CPU.noNet >= 2) log('⚠ PC ka bojh: network wala hissa PowerShell mein nahi chala — ab sirf CPU list (network khali)'); } else if (cur.size && !(CPU.noNet >= 2)) CPU.noNet = 0;   // v3.15: hifazat — CPU list kabhi na ruke
    const prev = CPU.prev, pt = CPU.pt, dt = now - CPU.pAt; CPU.prev = cur; CPU.pt = t; CPU.pAt = now;
    if (!prev || !pt || !cur.size || dt < 5000 || dt > 5 * 60000) return;
    const cpu = Math.max(0, Math.min(100, Math.round((1 - (t.idle - pt.idle) / Math.max(1, t.tot - pt.tot)) * 100)));
    const ram = Math.round((1 - os.freemem() / os.totalmem()) * 100);
    const grp = new Map(); let sum = 0;   // ek hi naam / kaam ke program jama (10 ffmpeg = ek line ×10)
    for (const [pid, x] of cur) {
      if (/^(system idle process|idle)$/i.test(x.n)) continue;
      const o = prev.get(pid); let d = o && o.n === x.n && x.c >= o.c ? x.c - o.c : !o ? x.c : 0;   // naya program (is minute mein shuru) = us ka poora waqt
      d = Math.min(d, dt * cores); if (d <= 0) continue;
      const p = d / (dt * cores) * 100; sum += p;
      const k = cpuLabel(x.n, pid), g = grp.get(k) || { n: k, p: 0, m: 0, c: 0 }; g.p += p; g.m += x.m; g.c++; grp.set(k, g);
    }
    try { const sp = grp.get('spoolsv'); spoolWatch(sp ? sp.p : 0, cores); } catch {}   // v3.6: 🛑 print spooler atka?
    let list = [...grp.values()].filter(g => g.p >= 0.5).sort((a, b) => b.p - a.p).slice(0, 6).map(g => ({ n: g.c > 1 ? `${g.n} ×${g.c}` : g.n, p: Math.min(100, Math.round(g.p * 10) / 10), m: g.m }));
    const rest = Math.round((cpu - list.reduce((a, g) => a + g.p, 0)) * 10) / 10;   // jo program minute ke andar shuru ho kar khatam ho gaye (chhoti ffmpeg / PowerShell) + chhote
    if (rest >= 3) list.push({ n: 'baqi (chhote + jo shuru ho kar khatam ho gaye)', p: rest, m: 0 });
    CPU.hist.push([Math.round(now / 60000), cpu]); if (CPU.hist.length > 60) CPU.hist = CPU.hist.slice(-60);
    if (cpu >= 90) { if (!CPU.hot) CPU.hot = now; } else CPU.hot = 0;
    const ref = cpuRef(); if (ref) await ref.set({ at: now, host: os.hostname(), cores, cpu, ram, ramGb: Math.round(os.totalmem() / (1 << 30)), top: list, hj: JSON.stringify(CPU.hist), hot: CPU.hot || 0, ver: VER }).catch(() => {});
    try { await loadAdd(now, cpu, ram, grp, net); } catch (e) { log('⚠ pcLoad: ' + String(e?.message || e).slice(0, 80)); }   // v3.14: 📊 24 ghante ka hisaab
  } catch (e) { log('⚠ cpu: ' + String(e?.message || e).slice(0, 80)); } finally { CPU.busy = false; }
}

// ---------- 🛑 v3.6: PRINT SPOOLER KA CHOWKIDAR (16 Nov 2026 12:03 — naye server par spoolsv 100% CPU, doctor 15 min chup; malik dukan par nahi: 'is ko auto karo') ----------
//   spoolsv 2 minute lagatar ek poore core se zyada (ya PC ka 8%+) = atka: (1) thermal-off.txt (thermal-name v1.1 -> scripts purana pakka naam, yani naye server par thermal print BAND)
//   (2) sab printers ki ruki jobs hatao + Spooler dobara (admin na ho to sirf jobs) (3) thermal wali scripts band -> agle chakkar mein naye naam se shuru.
//   Wapas chalu SIRF malik ke hukum se (app 🖨 dabba '▶ Thermal dobara chalu' -> blueAccess/thermalOn.at). 30 min mein ek dafa se zyada nahi. taskkill /T nahi.
const SPL = { n: 0, at: 0, busy: false, info: null, qPrev: 0 };
// v3.7: kis printer ki line mein kitni jobs ruki hain (malik: taar naye PC mein lagi hai, phir bhi spooler atka — kaun sa printer?). Sirf parhna.
async function jobsBy() {
  const out = await psRun('Get-CimInstance Win32_PrintJob | ForEach-Object { [string]$_.Name }', 15000); const m = {};
  for (const l of String(out || '').split(/\r?\n/)) { const n = l.trim().replace(/,\s*\d+\s*$/, ''); if (n) m[n] = (m[n] || 0) + 1; }
  return m;
}
const TH_SCRIPTS = ['pos-khata-sync.js', 'sale-post.js', 'transfer-sync.js', 'post-farq.js', 'factory-post.js', 'a4-print.js', 'wa-parchi.js'];
const thOffFile = () => path.join(DIR, 'thermal-off.txt');
const thOkFile = () => path.join(DIR, 'thermal-ok.txt');   // v3.9: malik ki ijazat (▶ Thermal dobara chalu) — is ke baghair thermal ka naam khud nahi chuna jata
function thRestart() { const list = procs(); let n = 0; if (list) for (const s of services) { if (!TH_SCRIPTS.includes(s.script)) continue; for (const q of list) if (runsScript(q, s)) { killPid(q.pid); n++; } } return n; }
function spoolWatch(p, cores) {
  const lim = Math.max(8, 100 / (cores || 1));
  if (p >= lim) SPL.n++; else SPL.n = 0;
  if (SPL.n >= 2 && !SPL.busy && Date.now() - SPL.at > 30 * 60000) spoolFix(p).catch(e => log('⚠ spooler: ' + String(e?.message || e).slice(0, 80)));
}
async function spoolFix(p, why, qn) {   // why 'q' (v3.8) = thermal ki line mein parchiyan phansi hain (printer chhap nahi raha), CPU nahi
  SPL.busy = true; SPL.at = Date.now();
  try {
    log(why === 'new' ? '🛑 thermal ka khud chuna naam ab malik ki ijazat se — print ROK kar line saaf kar raha hoon (Epson par parchi phans kar Spooler 100% tha)' : why === 'q' ? `🛑 thermal printer chhap nahi raha — ${qn} parchi line mein phansi; line saaf + thermal print ROK raha hoon` : `🛑 Print Spooler atka (spoolsv ${Math.round(p)}%) — ruki jobs hata raha hoon, thermal print ROK raha hoon`);
    try { fs.writeFileSync(thOffFile(), String(Date.now())); } catch {}
    try { fs.unlinkSync(thOkFile()); } catch {}
    const jb = await jobsBy(), jq = Object.entries(jb).map(([n, c]) => `${n}: ${c}`).join(' · ').slice(0, 300);
    const out = await psRun("$r=0; try { Stop-Service Spooler -Force -ErrorAction Stop; Remove-Item \"$env:windir\\System32\\spool\\PRINTERS\\*\" -Force -ErrorAction SilentlyContinue; Start-Service Spooler -ErrorAction Stop; $r=1 } catch { try { Start-Service Spooler -ErrorAction SilentlyContinue } catch {} }; $n=0; if ($r -eq 0) { Get-CimInstance Win32_Printer | ForEach-Object { $j=@(Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue); $n+=$j.Count; $j | Remove-PrintJob -ErrorAction SilentlyContinue } }; \"SPL|$n|$r\"", 90000);
    const m = String(out || '').match(/SPL\|(\d+)\|(\d)/);
    const k = thRestart();
    SPL.info = { at: Date.now(), cpu: Math.round(p), jobs: why === 'q' ? qn : (m ? Number(m[1]) : -1), rs: m ? Number(m[2]) : -1, k, q: jq, why: why || 'cpu' };
    if (jq) log('🛑 ruki jobs: ' + jq);
    log(`🛑 spooler: ${m ? m[1] + ' job hati, Spooler ' + (m[2] === '1' ? 'dobara chala' : 'dobara NAHI chala (admin nahi)') : 'PowerShell se jawab nahi'} · ${k} thermal script dobara shuru`);
    PRN.last = '';
  } finally { SPL.busy = false; SPL.n = 0; }
}
async function thOnCheck() {   // malik ka '▶ Thermal dobara chalu'
  let okNow = false; try { okNow = fs.existsSync(thOkFile()); } catch {}
  let offAt = 0; try { offAt = Number(fs.readFileSync(thOffFile(), 'utf8')) || 1; } catch {}
  if (okNow && !offAt) return;
  if (!okNow && !offAt) {   // v3.9: pehli dafa — ijazat nahi = rok do (ek dafa line saaf + scripts dobara), phir malik ke button ka intezar
    if (!SPL.busy) await spoolFix(0, 'new', 0).catch(e => log('⚠ thermal rok: ' + String(e?.message || e).slice(0, 80)));
    return;
  }
  const d = fb(); if (!d) return;
  try { const s = await d.collection('businesses').doc('noor-traders').collection('blueAccess').doc('thermalOn').get(); const at = Number(s.exists && s.data() && s.data().at) || 0;
    if (at > offAt) { try { fs.writeFileSync(thOkFile(), String(at)); } catch {} try { fs.unlinkSync(thOffFile()); } catch {} const k = thRestart(); SPL.info = null; SPL.at = 0; PRN.last = ''; log(`▶ thermal dobara chalu (malik) — ${k} script dobara shuru`); } } catch {}
}

// v3.3: 🖨 PRINTERS — Windows mein lage printers (naam · driver · port · haalat) + scripts ke zaroori naam. Sirf parhna, kuch nahi badalta. Async + hadd (doctor nahi rukta).
const prnRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcPrinters');
const PRN = { busy: false, last: '', at: 0 };
const PRN_SKIP = /^(microsoft (print to pdf|xps document writer)|fax|onenote|send to onenote|anydesk printer)/i;
function prnWant(names) {   // scripts jis naam se chhapti hain
  let lbl = 'TSC TTP-244 Pro';
  try { const o = JSON.parse(fs.readFileSync(path.join(__dirname, 'label-settings.json'), 'utf8')); if (o && typeof o.printer === 'string' && o.printer.trim()) lbl = o.printer.trim(); } catch {}
  return [{ k: 'Thermal parchi / bill', n: thName(names), th: 1 }, { k: 'Barcode label', n: lbl }];
}
// v3.5: 🧾 thermal ka naam khud (thermal-name.js) — "TM-T88IV" na ho to jis ke naam mein TM-T88 ho (naya server: "EPSON TM-T88IV Receipt"). File na aayi ho = purana pakka naam.
let TH_SAID = '';
function thName(names) {
  try { const T = require('./thermal-name.js'), n = (T.isOff && T.isOff()) ? T.DEF : T.pick(names || []); let c = null; try { c = JSON.parse(fs.readFileSync(T.FILE, 'utf8')); } catch {}
    if (names && names.length && (!c || c.n !== n || Date.now() - (Number(c.at) || 0) > 6 * 3600000)) T.save(n);
    if (n !== TH_SAID) { TH_SAID = n; log('🧾 thermal printer: ' + n); }
    return n; } catch (e) { return 'TM-T88IV'; }
}
async function prnTick() {
  if (BLOCKED || PRN.busy || process.platform !== 'win32') return; PRN.busy = true;
  try {
    await thOnCheck();
    const out = await psRun('Get-CimInstance Win32_Printer | ForEach-Object { "$($_.Name)|$($_.DriverName)|$($_.PortName)|$([int]$_.WorkOffline)|$([int]$_.PrinterStatus)|$([int]$_.Default)" }', 20000);
    if (!out.trim()) return;   // jawab nahi = kuch mat likho (khali list jhooti hoti)
    const list = [];
    for (const l of out.split(/\r?\n/)) { const a = l.trim().split('|'); if (a.length < 6 || !a[0] || PRN_SKIP.test(a[0])) continue;
      list.push({ n: a[0].slice(0, 80), d: String(a[1] || '').slice(0, 80), p: String(a[2] || '').slice(0, 40), off: a[3] === '1' || a[4] === '7' ? 1 : 0, def: a[5] === '1' ? 1 : 0 }); }
    const jb = await jobsBy(); for (const x of list) { const c = jb[x.n]; if (c) x.j = c; }
    // v3.8: thermal ki line mein 5+ parchi do jaanch (2 min) tak phansi rahein aur kam na hon = printer chhap nahi raha -> line saaf + thermal ROK (malik ke '▶ Dobara chalu' tak)
    try { const T = require('./thermal-name.js'); const tn = T.isOff() ? '' : T.pick(list.map(x => x.n)); const thN = tn ? (jb[tn] || 0) : 0;
      if (thN >= 5 && SPL.qPrev >= 5 && thN >= SPL.qPrev && !SPL.busy && Date.now() - SPL.at > 30 * 60000) spoolFix(0, 'q', thN).catch(e => log('⚠ thermal line: ' + String(e?.message || e).slice(0, 80)));
      SPL.qPrev = thN; } catch {}
    list.sort((x, y) => x.n.localeCompare(y.n));
    const low = s => String(s || '').trim().toLowerCase();
    const want = prnWant(list.map(x => x.n)).map(w => { const f = list.find(x => low(x.n) === low(w.n)); return { k: w.k, n: w.n, ok: f ? 1 : 0, off: f ? f.off : 0, d: f ? f.d : '', ...(w.th ? { th: 1, raw: f && /generic/i.test(f.d) ? 1 : 0 } : {}) }; });   // v3.12: thermal line ka driver + 'raw' (saada driver = hamari parchi nikalti hai)
    let thOff = 0; try { thOff = Number(fs.readFileSync(thOffFile(), 'utf8')) || 1; } catch {}
    const sp = thOff ? { off: thOff, ...(SPL.info || {}) } : null;
    const sig = JSON.stringify([list, want, sp]), now = Date.now();
    if (sig === PRN.last && now - PRN.at < 10 * 60000) return;   // sirf badle to / har 10 min
    const ref = prnRef(); if (!ref) return;
    await ref.set({ at: now, host: os.hostname(), list: list.slice(0, 30), want, sp, ver: VER }); PRN.last = sig; PRN.at = now;
  } catch (e) { log('⚠ printers: ' + String(e?.message || e).slice(0, 80)); } finally { PRN.busy = false; }
}

const statusRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcStatus');
const checkRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcCheck');

// ---------- 🔒 v3.2: SERVER KA NAAM (malik 15 Nov 2026: "ek system jis mein PC ka naam ho — wohi SQL wala server uthaye, confusion door") ----------
//   blueAccess/serverPc {host} (malik app Settings > PC scripts se; doc na ho = SRV_DEF). Is PC ka Windows naam wohi ho tabhi scripts chalti hain.
//   Naam na mile = is PC ki sab server scripts BAND (NT-PRINT nahi chhera — counter ka bill print) + blueAccess/pcBlocked (app mein warning); pcStatus / pcCpu kabhi nahi likhta.
//   Firestore na mile = pichhla jawab (server-pc.txt), wo bhi na ho = SRV_DEF. taskkill /T kabhi nahi.
const SRV_DEF = 'DESKTOP-Q1SLV77', SRV_FILE = path.join(DIR, 'server-pc.txt');
const srvRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('serverPc');
const blockRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcBlocked');
let BLOCKED = false, blockSaid = '';
// ---------- 🆔 v3.4: PC KI APNI PEHCHAN (malik 16 Nov 2026: purana + naya server DONO ka naam ek — dono chale, purane ne app ki entries hata din) ----------
//   Windows MachineGuid ka hash (har Windows ka alag; folder copy se nahi badalta / nahi jata). serverPc.mid (malik app se "Yehi server") ho to SIRF wohi PC server — naam nahi dekha jata.
//   mid na chuna ho = purana naam wala tala (kuch nahi badalta). Apni pehchan na mile = naam wala tala (asal server ghalti se band na ho).
//   Har PC (band wala bhi) blueAccess/pcSeen.m.<mid> likhta hai taake malik app mein dono dekh kar chune.
const ME = { mid: '', got: false, info: null, infoAt: 0 };
let SRV_MID = '';
function myMid() {
  if (ME.got) return ME.mid; ME.got = true;
  if (process.platform !== 'win32') return '';
  try {
    const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] });
    const g = (out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{8,})/) || [])[1] || '';
    if (g) ME.mid = crypto.createHash('sha256').update('nt-pc|' + g.toLowerCase()).digest('hex').slice(0, 12);
  } catch (e) { log('⚠ PC ki pehchan nahi mili: ' + String(e?.message || e).slice(0, 80)); ME.got = false; }
  return ME.mid;
}
const seenRef = () => fb()?.collection('businesses').doc('noor-traders').collection('blueAccess').doc('pcSeen');
async function seenTick(run) {
  const mid = myMid(); if (!mid) return;
  try {
    if (!ME.info || Date.now() - ME.infoAt > 6 * 3600000) {
      const out = await psRun('$o=Get-CimInstance Win32_OperatingSystem; $c=Get-CimInstance Win32_Processor | Select-Object -First 1; $s=Get-CimInstance Win32_ComputerSystem; "$($o.InstallDate.ToString(\'yyyy-MM-dd\'))|$($c.Name)|$([math]::Round($s.TotalPhysicalMemory/1GB))|$($s.Model)"', 20000).catch(() => '');
      const x = String(out || '').trim().split(/\r?\n/).pop().split('|');
      if (x.length >= 3) { ME.info = { win: String(x[0] || '').slice(0, 10), cpu: String(x[1] || '').replace(/\s+/g, ' ').trim().slice(0, 60), ram: Number(x[2]) || 0, mdl: String(x[3] || '').trim().slice(0, 40) }; ME.infoAt = Date.now(); }
    }
    let ip = ''; try { for (const l of Object.values(os.networkInterfaces())) for (const i of l || []) if (i.family === 'IPv4' && !i.internal && !ip) ip = i.address; } catch {}
    const ref = seenRef(); if (!ref) return;
    ME.run = run ? 1 : 0;
    await ref.set({ m: { [mid]: { at: Date.now(), host: os.hostname(), run: run ? 1 : 0, doctor: VER, ip, ...(ME.info || {}) } } }, { merge: true });
  } catch (e) { log('⚠ pcSeen: ' + String(e?.message || e).slice(0, 80)); }
}
// v3.11 (16 Nov, malik: 'har kuch second baad taza hona chahiye'): poori pehchan sirf bare chakkar (30 min) par jati thi -> app mein chalta PC '22 min pehle' dikhta tha.
// Ab har 20 s sirf waqt + haal (halki likhai, hadd 10 s, ek waqt mein ek).
async function seenBeat() {
  if (ME.beat || ME.run === undefined) return;
  const mid = ME.mid, ref = mid && seenRef(); if (!ref) return;
  ME.beat = true;
  try { await Promise.race([ref.set({ m: { [mid]: { at: Date.now(), run: ME.run } } }, { merge: true }), new Promise((_, no) => setTimeout(() => no(new Error('hadd')), 10000))]); } catch (e) {}
  ME.beat = false;
}
async function serverName() {
  let w = '', mid = '', ok = false; const ref = srvRef();
  if (ref) {
    let t;
    try {
      const d = await Promise.race([ref.get(), new Promise((_, no) => { t = setTimeout(() => no(Error('timeout')), 8000); })]);
      const x = (d.exists && d.data()) || {};
      w = String(x.host || '').trim() || SRV_DEF; mid = /^[0-9a-f]{12}$/.test(String(x.mid || '')) ? String(x.mid) : ''; ok = true;
      try { fs.writeFileSync(SRV_FILE, w + '|' + mid); } catch {}
    } catch (e) { w = ''; }
    finally { clearTimeout(t); }
  }
  if (!ok) { try { const c = fs.readFileSync(SRV_FILE, 'utf8').trim().split('|'); w = c[0] || ''; mid = /^[0-9a-f]{12}$/.test(c[1] || '') ? c[1] : ''; } catch {} }
  SRV_MID = mid;
  return w || SRV_DEF;
}
const isServer = w => { const me = SRV_MID ? myMid() : ''; return SRV_MID && me ? SRV_MID === me : String(w).trim().toUpperCase() === String(os.hostname()).trim().toUpperCase(); };
async function blockedCycle(want) {
  BLOCKED = true;
  const list = procs(); let n = 0;
  if (list) for (const s of services) {
    if (s.script === 'nt-print.js') continue;
    for (const q of list) if (runsBat(q, s) || runsScript(q, s)) { killPid(q.pid); n++; }
  }
  if (n) { try { execSync('taskkill /F /IM ffmpeg.exe', { stdio: 'ignore', windowsHide: true, timeout: 15000 }); } catch {} }
  if (n || blockSaid !== want) log(`⛔ ye PC (${os.hostname()}) server nahi — ${SRV_MID ? 'malik ne doosra PC server chuna hai' : 'server ka naam "' + want + '" hai'}. Scripts band${n ? ' (' + n + ' process band ki)' : ''}. App > Settings > PC scripts se badalta hai.`);
  blockSaid = want;
  const ref = blockRef();
  if (ref) await ref.set({ at: Date.now(), host: os.hostname(), want, doctor: VER, n, mid: myMid(), byMid: SRV_MID ? 1 : 0 }).catch(e => log('⚠ pcBlocked: ' + e.message));
}

// ---------- atka kaam (v2) ----------
const kick = {};   // script -> { at, n, key }
async function stuckOf(s) {
  const d = fb(); if (!d || !Array.isArray(s.queues) || !s.queues.length) return null;
  const now = Date.now(); let n = 0, oldest = Infinity, key = '';
  for (const q of s.queues) {
    try {
      const snap = await d.collection('businesses').doc('noor-traders').collection(q.col).where('status', 'in', q.status || ['new']).limit(30).get();
      for (const doc of snap.docs) {
        const x = doc.data(), at = Number(x.at || x.createdAt || x.updatedAt) || 0;
        if (!at || at > now - STUCK || at < now - 24 * 3600 * 1000) continue;   // taza ya bohat purana (chhoro)
        n++; if (at < oldest) { oldest = at; key = q.col + '/' + doc.id; }
      }
    } catch (e) { log(`⚠ ${q.col}: ${e.message}`); if (e?.code === 16 || /UNAUTHENTICATED|invalid authentication credentials/i.test(String(e?.message))) { log('Doctor ka Firebase rabta toota (UNAUTHENTICATED) — doctor khud dobara shuru ho raha hai, phir atke kaam dekhega'); restartSelf = true; } }
  }
  return n ? { n, oldest, key } : null;
}

// ---------- PC ka waqt (2026-10-01) — ghalat ho to Firebase "UNAUTHENTICATED" deta hai ----------
let clockAt = 0, clockOff = null, clockFixAt = 0;
function clockCheck() {
  if (Date.now() - clockAt < (clockOff != null && Math.abs(clockOff) > 120 ? 5 : 30) * 60 * 1000) return; clockAt = Date.now();
  try {
    require('https').request({ host: 'www.google.com', method: 'HEAD', path: '/', timeout: 8000 }, r => {
      const g = Date.parse(r.headers.date || ''); if (!g) return;
      const off = Math.round((Date.now() - g) / 1000); clockOff = off;
      if (Math.abs(off) > 120) {
        log(`⚠ PC ka waqt ${Math.round(off / 60)} minute ${off > 0 ? 'aage' : 'peeche'} hai — Firebase rabta tootega. Waqt theek kar raha hoon ("NT Waqt Theek" task + w32tm)...`);
        const cp = require('child_process'), o = { windowsHide: true };
        try { cp.exec('schtasks /run /tn "NT Waqt Theek"', o, e => { if (e) log('⚠ "NT Waqt Theek" task nahi chala (admin PowerShell wala block ek dafa chalayein)'); }); } catch {}
        try { cp.exec('w32tm /resync /nowait', o, () => {}); } catch {}
        clockFixAt = Date.now();
      } else if (clockFixAt) { log('✓ PC ka waqt ab theek hai'); clockFixAt = 0; }
    }).on('error', () => {}).end();
  } catch {}
}

// ---------- ek chakkar ----------
let services = [], manifestVer = '', lastGit = 0, busy = false, restartSelf = false, cycleAt = 0;
async function cycle(why, full = true) {
  clockCheck();
  if (busy) return; busy = true; cycleAt = Date.now();
  try {
    if (full) log(`— jaanch (${why}) —`);
    await ensureConfig();
    let changed = [];
    const m = full ? await manifest() : null;
    if (!full) {}
    else if (m) {
      manifestVer = String(m.version || ''); lastGit = Date.now();
      services = Array.isArray(m.services) ? m.services : services;
      changed = await update(m);
      if (changed.includes('doctor.js')) restartSelf = true;
    } else log('GitHub tak nahi pahuncha (internet?) — sirf jaanch');
    if (!services.length) try { services = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')).services || []; } catch {}
    const srvWant = await serverName();   // v3.2: 🔒 sirf server ke naam wala PC
    if (!isServer(srvWant)) { await blockedCycle(srvWant); if (full) await seenTick(false); if (restartSelf) { log('doctor.js khud nayi aayi — dobara shuru'); setTimeout(() => process.exit(0), 1500); } return; }
    if (BLOCKED) { BLOCKED = false; blockSaid = ''; log('✅ ab yehi PC server hai — scripts chalu'); }
    if (full) seenTick(true);   // v3.4: intezar nahi (chakkar na ruke)
    let list = procs();
    if (list && hideOnce(list)) { await new Promise(r => setTimeout(r, 3000)); list = procs() || list; }
    const blind = !list;   // v2.9: process list nahi mili — andhe ho kar kuch shuru / band NAHI
    if (blind) log('⚠ scripts ki list nahi mili (WMI) — is chakkar mein koi script shuru / band nahi, 2 min baad phir');
    const rows = [];
    for (const s of services) {
      if (blind) { const ll = s.log ? lastLine(s.log) : { line: '', at: 0 }; rows.push({ name: s.name || s.script, script: s.script, ver: verOf(s.script), action: 'list nahi mili (WMI) — pichhla haal', log: ll.line, logAt: ll.at, periodic: !!s.periodic }); continue; }
      let action = '';
      if (s.bat && changed.includes(s.bat)) {   // v2.8: bat (loop / waqfa) badla → poori loop dobara
        for (const q of list) if (runsBat(q, s) || runsScript(q, s)) { try { killPid(q.pid); } catch {} }
        await new Promise(r => setTimeout(r, 1500)); list = procs() || list; action = 'bat nayi — loop dobara shuru'; log(`↻ ${s.bat}: nayi bat, loop dobara`);
      }
      if (changed.includes(s.script) && alive(s, list)) { const n = stopScript(s, list); if (n) { action = 'nayi lagi — dobara shuru'; log(`↻ ${s.script}: nayi file, dobara shuru`); } }
      else if (changed.includes(s.script) && !action) action = 'nayi lagi';
      if (!alive(s, list)) {
        if (!s.periodic && stopBatOnly(s, list)) log(`■ ${s.bat}: window thi magar ${s.script} nahi chal rahi — purani loop band`);
        if (startBat(s)) { action = action || 'band thi — chala di'; log(`▶ ${s.script}: band thi, ${s.bat} chala di`); }
        else action = 'band — .bat nahi mili';
      }
      // 2026-10-01 v2.3: zinda dikh rahi magar HEARTBEAT 3 min purani = latki hui -> dobara
      if (!action && alive(s, list) && !s.periodic) {
        let age = null; try { const t = Number(fs.readFileSync(path.join(DIR, s.script.replace(/\.js$/, '') + '.alive'), 'utf8')); if (t > 0) age = Date.now() - t; } catch {}
        if (age != null && age > STUCK) {
          const h = hung[s.script] || (hung[s.script] = { at: 0 });
          if (Date.now() - h.at > REST_GAP) { const nk = stopScript(s, list); if (!nk) startBat(s); h.at = Date.now(); action = `latki thi (${Math.round(age / 60000)} min se be-khabar) — dobara chalayi`; log(`↻ ${s.script}: heartbeat ${Math.round(age / 60000)} min purani — latki hui, dobara shuru`); }
          else action = `latki (${Math.round(age / 60000)} min) — abhi dobara chalayi thi, intezar`;
        }
      }
      // v2: zinda hai magar kaam ruka hua?
      let stuck = null;
      if (!action && alive(s, list)) {
        stuck = await stuckOf(s);
        const k = kick[s.script] || (kick[s.script] = { at: 0, n: 0, key: '' });
        if (!stuck) { k.n = 0; k.key = ''; }
        else {
          if (k.key !== stuck.key) { k.n = 0; k.key = stuck.key; }
          const mins = Math.round((Date.now() - stuck.oldest) / 60000);
          if (k.n >= 3 && Date.now() - k.at > 30 * 60 * 1000) { k.n = 0; log(`↻ ${s.script}: 30 min baad phir koshish (haar nahi maani)`); }   // 2026-10-01: waqt / internet theek ho jaye to khud wapas aaye
          if (k.n >= 3) action = `atki — ${stuck.n} kaam ${mins} min se ruke, 3 dafa chalayi phir bhi nahi (30 min baad phir koshish)`;
          else if (Date.now() - k.at > REST_GAP) {
            const nk = stopScript(s, list); if (!nk) startBat(s);
            k.at = Date.now(); k.n++;
            action = `atki thi — ${stuck.n} kaam ${mins} min se ruke — dobara chalayi (${k.n})`;
            log(`↻ ${s.script}: ${stuck.n} kaam ${mins} min se ruke (${stuck.key}) — dobara shuru (${k.n}/3)`);
          } else action = `${stuck.n} kaam ruke — abhi dobara chalayi thi, intezar`;
        }
      }
      const ll = s.log ? lastLine(s.log) : { line: '', at: 0 };
      rows.push({ name: s.name || s.script, script: s.script, ver: verOf(s.script), action, log: ll.line, logAt: ll.at, periodic: !!s.periodic });
    }
    await new Promise(r => setTimeout(r, 4000));
    list = procs() || lastList || [];
    for (const r of rows) { const s = services.find(x => x.script === r.script); r.ok = s ? alive(s, list) : false; if (!r.ok && !r.action) r.action = 'band'; }
    const ref = statusRef();
    if (ref) await ref.set({ at: Date.now(), host: os.hostname(), bootAt: Date.now() - os.uptime() * 1000, doctor: VER, manifest: manifestVer, clockOff,
      lastGit, changed, services: rows, recent: recent.slice(-30), every: QUICK }).catch(e => log('⚠ report: ' + e.message));
    if (full || rows.some(r => r.action)) log(`✓ ${rows.filter(r => r.ok).length}/${rows.length} chal rahi${changed.length ? ' · nayi: ' + changed.join(', ') : ''}`);
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
  // v2.9: 🚑 NT-PRINT ne jagaya ho to us ka paigham (kyun / kitni der chup) log mein — app ki 🖥️ PC scripts mein nazar aaye
  try { const jf = path.join(DIR, 'doctor-jaga.txt'); if (fs.existsSync(jf)) { log('🚑 ' + fs.readFileSync(jf, 'utf8').trim().slice(0, 200)); fs.unlinkSync(jf); } } catch {}
  // v2.9: chakkar 10 min se atka (koi await kabhi poora na ho → busy hamesha true → report / "Abhi check" sab band) = doctor khud band, KHATA-DOCTOR.bat 20 sec mein naya
  setInterval(() => { if (busy && cycleAt && Date.now() - cycleAt > 10 * 60 * 1000) { log('⚠ chakkar 10 min se atka — doctor dobara shuru ho raha hai'); setTimeout(() => process.exit(1), 1000); } }, 30000);
  ensureStartup(); ensureModules(); ensureChupa();
  await cycle('shuru');
  setTimeout(cpuTick, 20000); setInterval(cpuTick, 60000);
  setInterval(() => { seenBeat().catch(() => {}); }, 20000);
  setTimeout(prnTick, 35000); setInterval(prnTick, 120000);   // v3.3: 🖨 printers app mein   // v3.0: 🔥 CPU app mein
  try { require('./nabz.js')({ fb, log, dir: DIR, blocked: () => BLOCKED, thermal: () => { let off = false; try { off = fs.existsSync(thOffFile()); } catch {} return { off, q: Number(SPL.qPrev) || 0 }; } }); } catch (e) { log('⚠ nabz: ' + String(e && e.message || e).slice(0, 80)); }   // v3.13: 🚨 phone ke liye dukan ki nabz
  setInterval(() => cycle('30 minute'), EVERY);
  setInterval(() => cycle('2 minute', false), QUICK);
  // v2.7: har 3 min sirf manifest ka version — naya ho to foran update (30 min ka intezar nahi)
  const vn = v => { const x = String(v || '').match(/^(\d{4}-\d{2}-\d{2})\.(\d+)$/); return x ? x[1] + '.' + x[2].padStart(4, '0') : ''; };
  setInterval(async () => { if (busy) return; try { const m = await manifest(); const nv = vn(m && m.version); if (nv && (!manifestVer || nv > vn(manifestVer))) cycle('GitHub par naya version ' + m.version); } catch {} }, GITQ);
  let lastAsk = 0;
  const listen = () => {
    const ref = checkRef(); if (!ref) return setTimeout(listen, 60000);
    const stop = ref.onSnapshot(d => { const at = Number(d.data()?.at) || 0; if (!lastAsk) { lastAsk = at || 1; return; } if (at > lastAsk) { lastAsk = at; cycle('app se "Abhi check"'); } },
      e => { log('⚠ pcCheck: ' + e.message + ' — 1 min baad dobara jurunga'); try { stop(); } catch {} setTimeout(listen, 60000); });
  };
  listen();
});
