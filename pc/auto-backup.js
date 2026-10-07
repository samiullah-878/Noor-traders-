// ============================================================
//  auto-backup.js  v1.0 (2026-10-05) — ☁️ AUTO BACKUP: din mein 2 dafa (app ki Settings se waqt) poora khata JSON mein,
//  C:\khata-sync\backups mein + Google Drive for Desktop ke folder ("Blue Khata Backup") mein — Drive khud upload karta hai.
//
//  App (Settings -> 💾 Backup -> ☁️ Auto backup) blueAccess/backupConfig likhti hai: {on, email, times:['14:00','22:00'], now}
//  Ye script har minute dekhti hai: waqt aa gaya (aur aaj us waqt ka backup nahi hua) ya 'now' naya -> backup.
//  Natija blueAccess/backupStatus: {at, ok, file, size, count, drive, error} — app Settings mein dikhati hai.
//
//  Backup files:
//    Noor-Traders-backup-YYYY-MM-DD_HHMM.json          (blueKhata — app ke "Backup download" jaisa; Restore se wapas aata hai)
//    Noor-Traders-extra-YYYY-MM-DD_HHMM.json.gz        (baaqi: blueAccess (keys/sessions nahi), appSales, appPurchases, notes,
//                                                       demands, gallaCalls, purchaseSuppliers, purchaseOrders, posLedger, tokens)
//  Aakhri 60 (30 din x 2) rakhta hai, purane khud mitata hai (PC aur Drive folder dono).
//  Drive folder khud dhoondta: local-config.json "driveFolder" || %USERPROFILE%\My Drive || G:\My Drive || "Google Drive" ...
//  Chalana: auto-backup-auto.bat (loop). Test: node auto-backup.js --now
// ============================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const zlib = require('zlib');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const VER = '1.3';   // v1.3 (2026-10-07): driver ki jeb se EXTRA kharcha (kind 'kharch', driver:true) khate se − (app v2.97.1) · v1.2 (2026-10-07): driver ka KHATA (app v2.96.1 jaisa) — phera + (kiraya − kharche − commission), liya −, advance + · v1.1: 🚚 gaari — roz sham malik ko notification "driver se hisaab lena hai"
const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47832;
const DIR = __dirname;
const KEEP = 60;
{ const hb = path.join(DIR, 'auto-backup.alive'); const w = () => { try { fs.writeFileSync(hb, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); }
const log = (...a) => console.log(`[${new Date().toLocaleString('en-GB')}]`, ...a);
const cfgLocal = () => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')) || {}; } catch { return {}; } };
const pad2 = n => String(n).padStart(2, '0');
const stamp = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
const dayOf = d => stamp(d).slice(0, 10);
const unauth = e => e?.code === 16 || /UNAUTHENTICATED|invalid authentication credentials/i.test(String(e?.message));

function driveFolder() {
  const c = cfgLocal();
  const cands = [c.driveFolder, path.join(os.homedir(), 'My Drive'), path.join(os.homedir(), 'Google Drive'), 'G:\\My Drive', 'H:\\My Drive', 'I:\\My Drive'].filter(Boolean);
  try { for (const d of fs.readdirSync(os.homedir())) if (/drive/i.test(d)) cands.push(path.join(os.homedir(), d)); } catch {}
  for (const d of cands) { try { if (fs.statSync(d).isDirectory()) { const f = path.join(d, 'Blue Khata Backup'); fs.mkdirSync(f, { recursive: true }); return f; } } catch {} }
  return '';
}
function prune(dir) {
  try {
    const fl = fs.readdirSync(dir).filter(f => /^Noor-Traders-(backup|extra)-\d{4}-\d{2}-\d{2}_\d{4}\.json(\.gz)?$/.test(f)).sort();
    const main = fl.filter(f => f.startsWith('Noor-Traders-backup-'));
    if (main.length > KEEP) for (const f of main.slice(0, main.length - KEEP)) { try { fs.unlinkSync(path.join(dir, f)); fs.unlinkSync(path.join(dir, f.replace('-backup-', '-extra-') + '.gz')); } catch {} }
  } catch {}
}

if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const base = db.collection('businesses').doc(BUSINESS_ID);

async function readAll(name, filter) {
  const s = await base.collection(name).get();
  return s.docs.map(d => ({ ...d.data(), id: d.id })).filter(filter || (() => true));
}
async function makeBackup(why) {
  const t0 = Date.now(), now = new Date(), st = stamp(now);
  const out = path.join(DIR, 'backups'); fs.mkdirSync(out, { recursive: true });
  const records = await readAll('blueKhata');
  const main = { format: 'sam-blue-khata-v1', records, source: 'server-auto-backup', projectId: 'note-traders-khata-7ccc1', exportedAt: now.toISOString(), importedPdfsIncluded: true, why };
  const f1 = `Noor-Traders-backup-${st}.json`;
  fs.writeFileSync(path.join(out, f1), JSON.stringify(main));
  const extra = {};
  for (const c of ['blueAccess', 'appSales', 'appPurchases', 'notes', 'demands', 'gallaCalls', 'purchaseSuppliers', 'purchaseOrders', 'posLedger', 'tokens', 'entryPhotos', 'partyPhotos']) {
    try { extra[c] = await readAll(c, c === 'blueAccess' ? (d => !/private|aiConfig|pushConfig/i.test(d.id)) : null); } catch (e) { extra[c] = { error: e.message }; }
  }
  const f2 = `Noor-Traders-extra-${st}.json.gz`;
  fs.writeFileSync(path.join(out, f2), zlib.gzipSync(Buffer.from(JSON.stringify({ exportedAt: now.toISOString(), ...extra }))));
  prune(out);
  const size = fs.statSync(path.join(out, f1)).size;
  const drive = driveFolder(); let copied = '';
  if (drive) { try { fs.copyFileSync(path.join(out, f1), path.join(drive, f1)); fs.copyFileSync(path.join(out, f2), path.join(drive, f2)); prune(drive); copied = drive; } catch (e) { log('Drive folder mein copy nahi hua: ' + e.message); } }
  const status = { at: Date.now(), ok: true, file: f1, size, count: records.length, drive: copied, pc: os.hostname(), ms: Date.now() - t0, why, ver: VER };
  await base.collection('blueAccess').doc('backupStatus').set(status);
  log(`✅ Backup: ${f1} (${Math.round(size / 1024)} KB, ${records.length} records) ${copied ? '-> ' + copied : '(Drive folder NAHI mila)'} · ${Date.now() - t0} ms`);
  return status;
}

// ---- v1.1: 🚚 GAARI NOTIFICATION (app band ho tab bhi — FCM, malik ke pushTokens par) ----
const gaariSent = new Set();
async function gaariNotify() {
  const now = new Date(), hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, day = dayOf(now);
  const cd = await base.collection('gaari').doc('_config').get(); const c = cd.exists ? cd.data() : {};
  if (c.notifyOn === false) return;
  const times = Array.isArray(c.notifyTimes) && c.notifyTimes.length ? c.notifyTimes : ['18:00', '19:30', '21:00'];
  const t = times.find(x => hm >= x && !gaariSent.has(day + ' ' + x) && (() => { const d = new Date(now); d.setHours(...String(x).split(':').map(Number), 0, 0); return Date.now() - d.getTime() < 40 * 60000; })());
  if (!t) return; gaariSent.add(day + ' ' + t);
  // v1.2: DRIVER KA KHATA — har phera + (kiraya − kharche − commission); driver se liya −; advance (dir out, salary nahi) +; purane tick/le liya −
  const N = v => Number(v) || 0, all = (await base.collection('gaari').get()).docs.map(d => d.data()).filter(x => x && !x.deleted);
  const comm = b => b.comm != null && b.comm !== '' ? N(b.comm) : !(N(b.kiraya) > 0) ? 0 : (c.commType === 'fixed' ? N(c.commVal) : Math.round(N(b.kiraya) * N(c.commVal)) / 100);
  let pend = 0, open = 0, todayN = 0, noEnd = 0;
  for (const p of all) {
    if (p.kind === 'phera') {
      const B = p.bilties || [], kir = B.reduce((t, b) => t + N(b.kiraya), 0), kh = (p.kharche || []).reduce((t, k) => t + N(k.a), 0), cm = B.reduce((t, b) => t + comm(b), 0);
      pend += kir - kh - cm - (p.settled ? N(p.settled.amount) : B.filter(b => b.col).reduce((t, b) => t + N(b.kiraya), 0));
      if (p.status !== 'closed') open++; if (p.date === day) { todayN++; if (!Number(p.endR)) noEnd++; }
    } else if (p.kind === 'driver') pend += p.dir === 'in' ? -N(p.amount) : p.sal ? 0 : N(p.amount);
    else if (p.kind === 'kharch' && p.driver) pend -= N(p.amount);   // v1.3: driver ne apni jeb se extra kharcha kiya
  }
  pend = Math.round(pend);
  if (pend < 1 && !open) { log('🚚 gaari: hisaab saaf — notification nahi'); return; }
  const body = [pend >= 1 ? `💰 Driver se Rs ${pend.toLocaleString('en-PK')} lena (baqaya)` : '', open ? `🟢 ${open} phera khula` : '', todayN ? `aaj ${todayN} phera${noEnd ? `, ${noEnd} ki aakhri reading baqi` : ''}` : ''].filter(Boolean).join(' · ');
  const tk = await base.collection('pushTokens').get();
  const tokens = tk.docs.map(d => d.data()).filter(x => x.token && (x.role === 'owner' || x.role === 'malik')).map(x => x.token);
  if (!tokens.length) { log('🚚 gaari: malik ka koi push token nahi (app mein notification ON karein)'); return; }
  const { getMessaging } = require('firebase-admin/messaging');
  const r = await getMessaging().sendEachForMulticast({ tokens, data: { title: '🚚 Driver se hisaab lena hai', body, tag: 'gaari-' + day, link: 'https://samiullah-878.github.io/Noor-traders-/' }, webpush: { headers: { Urgency: 'high' } } });
  log(`🚚 gaari notification ${t}: ${r.successCount}/${tokens.length} phone — ${body}`);
}
let doneKeys = new Set(), lastNow = 0, busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try { await gaariNotify(); } catch (e) { log('gaari notification masla: ' + e.message); }
  try {
    const cd = await base.collection('blueAccess').doc('backupConfig').get();
    const c = cd.exists ? cd.data() : {};
    const now = new Date(), hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    let why = '';
    if (Number(c.now) && Number(c.now) > lastNow && Date.now() - Number(c.now) < 10 * 60000) { why = 'app se "Abhi backup lo"'; lastNow = Number(c.now); }
    else if (c.on !== false) {
      const times = Array.isArray(c.times) && c.times.length ? c.times : ['14:00', '22:00'];
      for (const t of times) { const k = dayOf(now) + ' ' + t; const due = new Date(now); due.setHours(...String(t).split(':').map(Number), 0, 0); if (hm >= t && !doneKeys.has(k) && Date.now() - due.getTime() < 6 * 3600 * 1000) { why = 'roz ' + t; doneKeys.add(k); break; } }   // 6 ghante tak (PC der se chalu ho to bhi)
    }
    if (!why) return;
    await makeBackup(why);
  } catch (e) {
    log('Backup masla: ' + e.message);
    try { await base.collection('blueAccess').doc('backupStatus').set({ at: Date.now(), ok: false, error: String(e.message).slice(0, 200), pc: os.hostname(), ver: VER }); } catch {}
    if (unauth(e)) process.exit(1);
  } finally { busy = false; if (doneKeys.size > 50) doneKeys = new Set([...doneKeys].slice(-20)); }
}

if (process.argv.includes('--now')) {
  makeBackup('--now test').then(s => { console.log(s); process.exit(0); }).catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
} else {
  const lock = net.createServer();
  lock.once('error', () => { console.log('auto-backup pehle se chal raha hai.'); process.exit(3); });
  lock.listen(LOCK_PORT, '127.0.0.1', () => {
    log(`☁️ AUTO-BACKUP v${VER} chal raha hai — Drive folder: ${driveFolder() || 'NAHI MILA (Google Drive for Desktop install/login karein)'}`);
    setInterval(tick, 60000); tick();
  });
}
