// ============================================================
//  auto-backup.js  v1.5 (2026-10-12: 🚚 transfer note 10 min mein check na ho = notification) · v1.0 (2026-10-05) — ☁️ AUTO BACKUP: din mein 2 dafa (app ki Settings se waqt) poora khata JSON mein,
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

const VER = '1.4';   // v1.4 (2026-10-11): 🔁 notes.nag — baar baar yaad (15/30/60 min) jab tak ✓ na ho · v1.3 (2026-10-07): driver ki jeb se EXTRA kharcha (kind 'kharch', driver:true) khate se − (app v2.97.1) · v1.2 (2026-10-07): driver ka KHATA (app v2.96.1 jaisa) — phera + (kiraya − kharche − commission), liya −, advance + · v1.1: 🚚 gaari — roz sham malik ko notification "driver se hisaab lena hai"
const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47832;
const DIR = __dirname;
const KEEP = 60;
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: false }); } catch (e) { const f = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'), w = () => { try { require('fs').writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();   // 2026-10-11: 💓 sachi dhadkan (zinda.js) — purani 30-sec khud-likhne wali hatayi
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
// ---- v1.4: 🔁 BAAR BAAR YAAD (notes.nag 15/30/60 min) — waqt guzarne ke baad har nag minute, jab tak ✓ na ho. Subah 7 – raat 11.
// Notes ko LISTENER se rakhta hai (har minute poori list nahi parhta — reads kam). Pehli khabar Cloud Function deti hai (waqt par);
// yeh us ke nag minute baad se dohrata hai. Kis ko: malik + jis ne note likha. tag 'nag-<id>' = phone par purani ki jagah nayi.
const NAG_FILE = path.join(DIR, 'nag-state.json');
let nagNotes = new Map(), nagSent = {}, nagStop = null;
try { nagSent = JSON.parse(fs.readFileSync(NAG_FILE, 'utf8')) || {}; } catch {}
function nagWatch() {
  if (nagStop) return;
  nagStop = base.collection('notes').where('done', '==', false).onSnapshot(s => {
    s.docChanges().forEach(c => { if (c.type === 'removed') nagNotes.delete(c.doc.id); else nagNotes.set(c.doc.id, { ...c.doc.data(), id: c.doc.id }); });
  }, e => { log('🔁 notes listener masla: ' + e.message); nagStop = null; if (unauth(e)) process.exit(1); });
}
function nagDue(n, now = new Date()) {
  const g = Number(n.nag); if (![15, 30, 60].includes(g) || n.done || n.deleted || !/^\d{4}-\d{2}-\d{2}$/.test(n.remindDay || '')) return null;
  const at = new Date(n.remindDay + 'T' + (/^\d{2}:\d{2}$/.test(n.remindTime || '') ? n.remindTime : '09:00') + ':00').getTime();
  const t = now.getTime(), h = now.getHours();
  if (!(at > 0) || t < at + g * 60000 || t - at > 3 * 86400000 || h < 7 || h >= 23) return null;   // pehli khabar waqt par Cloud Function ki; 3 din baad chup
  const last = Number(nagSent[n.id]) || 0;
  return t - last >= g * 60000 - 20000 ? { g, mins: Math.round((t - at) / 60000) } : null;
}
async function nagNotify() {
  nagWatch();
  const now = new Date(), due = [...nagNotes.values()].map(n => ({ n, d: nagDue(n, now) })).filter(x => x.d);
  if (!due.length) return;
  const tk = (await base.collection('pushTokens').get()).docs.map(d => d.data()).filter(x => x.token);
  const { getMessaging } = require('firebase-admin/messaging');
  for (const { n, d } of due.slice(0, 10)) {
    const tokens = [...new Set(tk.filter(x => x.role === 'owner' || x.role === 'malik' || (n.by && x.uid === n.by)).map(x => x.token))];
    nagSent[n.id] = Date.now();
    if (!tokens.length) { log(`🔁 "${String(n.text || '').slice(0, 30)}": koi push token nahi`); continue; }
    const late = d.mins >= 60 ? Math.floor(d.mins / 60) + ' ghante' : d.mins + ' min';
    const body = (String(n.text || n.partyName || 'Note').slice(0, 140)) + `\n⏰ ${late} se baqi · 🔁 har ${d.g === 60 ? '1 ghanta' : d.g + ' min'} — ✓ karein to band`;
    try {
      const r = await getMessaging().sendEachForMulticast({ tokens, data: { title: '🔁 Yaad dihani — abhi tak nahi hua', body, tag: 'nag-' + n.id, link: 'https://samiullah-878.github.io/Noor-traders-/#note=' + n.id }, webpush: { headers: { Urgency: 'high' } } });
      log(`🔁 nag "${String(n.text || '').slice(0, 30)}" (${late} se): ${r.successCount}/${tokens.length} phone`);
    } catch (e) { log('🔁 nag bhejna masla: ' + e.message); }
  }
  for (const k of Object.keys(nagSent)) if (Date.now() - nagSent[k] > 4 * 86400000) delete nagSent[k];
  try { fs.writeFileSync(NAG_FILE, JSON.stringify(nagSent)); } catch {}
}
// ---- v1.5 (2026-10-12): 🚚 TRANSFER NOTE CHECK NAHI HUA — 10 min baad notification, phir har 30 min (3 ghante tak), subah 7 – raat 11 ----
// Malik: "10 minute se oper koi bi transfer check agr na ho to usi time notification … click karian to apps open ho jaya direct".
// Note: posTransfers (POS ke) + transferJobs done (app ke, abhi POS list mein nahi). Check: transferChecks/<key> (key = posTransfers id ya 'T'+transferId).
// Kis ko: malik + mulazim jin ka scope stock / full. Tap = app '#tc=<key>' (Transfer check khulta hai, wahi note khula).
const TR_FILE = path.join(DIR, 'tr-check-state.json'), TR_FIRST = 10 * 60000, TR_EVERY = 30 * 60000, TR_MAX = 3 * 3600000;
let trNames = {}, trNamesAt = 0, trPos = new Map(), trJobs = new Map(), trChecks = new Set(), trSent = {}, trStops = null;
try { trSent = JSON.parse(fs.readFileSync(TR_FILE, 'utf8')) || {}; } catch {}
const trIssued = t => Number(t.createdOn) || Number(t.at) || 0;
function trWatch() {
  if (trStops) return;
  const since = Date.now() - 2 * 86400000, fail = name => e => { log(`🚚 ${name} listener masla: ` + e.message); trStops = null; if (unauth(e)) process.exit(1); };
  trStops = [
    base.collection('posTransfers').where('createdOn', '>=', since).onSnapshot(s => s.docChanges().forEach(c => { if (c.type === 'removed') trPos.delete(c.doc.id); else trPos.set(c.doc.id, { ...c.doc.data(), id: c.doc.id }); }), fail('posTransfers')),
    base.collection('transferJobs').where('doneAt', '>=', since).onSnapshot(s => s.docChanges().forEach(c => { if (c.type === 'removed') trJobs.delete(c.doc.id); else trJobs.set(c.doc.id, c.doc.data()); }), fail('transferJobs')),
    base.collection('transferChecks').where('issuedAt', '>=', since).onSnapshot(s => s.docChanges().forEach(c => { if (c.type === 'removed') trChecks.delete(c.doc.id); else trChecks.add(c.doc.id); }), fail('transferChecks'))
  ];
}
function trList() {
  const L = [...trPos.values()], ids = new Set(L.map(t => String(t.transferId)));
  for (const j of trJobs.values()) { if (j.op === 'delete' || j.status !== 'done' || !j.transferId || ids.has(String(j.transferId))) continue;
    L.push({ id: 'T' + j.transferId, transferId: j.transferId, transferNo: String(j.transferNo || ''), from: j.from, to: j.to, createdOn: Number(j.doneAt) || Number(j.at) || 0, lines: j.lines || [] }); }
  return L;
}
function trDue(t, now = Date.now(), hour = new Date().getHours()) {
  const key = String(t.id || ('T' + t.transferId)), age = now - trIssued(t);
  if (trChecks.has(key) || !(trIssued(t) > 0) || age < TR_FIRST || age > TR_MAX || hour < 7 || hour >= 23) return null;
  const last = Number(trSent[key]) || 0;
  return !last || now - last >= TR_EVERY - 20000 ? { key, mins: Math.round(age / 60000) } : null;
}
async function trNotify() {
  trWatch();
  const due = trList().map(t => ({ t, d: trDue(t) })).filter(x => x.d);
  if (!due.length) return;
  const tk = (await base.collection('pushTokens').get()).docs.map(d => d.data()).filter(x => x.token && (x.role === 'owner' || x.role === 'malik' || ['stock', 'full'].includes(x.scope)));
  const tokens = [...new Set(tk.map(x => x.token))];
  if (Date.now() - trNamesAt > 6 * 3600000) { trNamesAt = Date.now(); try { for (const d of (await base.collection('posStock').select('branch', 'name').get()).docs) { const x = d.data(); if (x && x.branch != null && x.name) trNames[x.branch] = x.name; } } catch {} }
  const names = trNames;
  const bn = b => names[b] || (Number(b) === 1 ? 'Noor Traders' : 'Godam ' + b);
  const { getMessaging } = require('firebase-admin/messaging');
  for (const { t, d } of due.slice(0, 10)) {
    trSent[d.key] = Date.now();
    if (!tokens.length) { log('🚚 transfer check: koi push token nahi'); continue; }
    const late = d.mins >= 60 ? Math.floor(d.mins / 60) + ' ghante ' + (d.mins % 60) + ' min' : d.mins + ' min';
    const n = Array.isArray(t.lines) ? t.lines.length : 0;
    const title = `🚚 ${t.transferNo ? 'TN ' + t.transferNo : 'Transfer note'} abhi tak check nahi hua`;
    const body = `⏳ ${late} · ${bn(t.from)} → ${bn(t.to)}${n ? ' · ' + n + ' items' : ''}\nTap karein — scan / ✓ karein`;
    try {
      const r = await getMessaging().sendEachForMulticast({ tokens, data: { title, body, tag: 'tc-' + d.key, link: 'https://samiullah-878.github.io/Noor-traders-/#tc=' + encodeURIComponent(d.key) }, webpush: { headers: { Urgency: 'high' } } });
      log(`🚚 transfer check yaad (${t.transferNo || d.key}, ${late}): ${r.successCount}/${tokens.length} phone`);
    } catch (e) { log('🚚 transfer notification masla: ' + e.message); }
  }
  for (const k of Object.keys(trSent)) if (Date.now() - trSent[k] > 2 * 86400000) delete trSent[k];
  try { fs.writeFileSync(TR_FILE, JSON.stringify(trSent)); } catch {}
}
let doneKeys = new Set(), lastNow = 0, busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try { await gaariNotify(); } catch (e) { log('gaari notification masla: ' + e.message); }
  try { await nagNotify(); } catch (e) { log('🔁 nag masla: ' + e.message); }
  try { await trNotify(); } catch (e) { log('🚚 transfer check masla: ' + e.message); }
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

module.exports._t = { trDue, trList, trNotify, trSet: (p, j, c) => { trPos = p; trJobs = j; trChecks = c; trStops = []; }, trSent: () => trSent, nagDue, nagNotify, nagNotes: () => nagNotes, nagSent: () => nagSent };
if (process.env.NT_TEST) {} else if (process.argv.includes('--now')) {
  makeBackup('--now test').then(s => { console.log(s); process.exit(0); }).catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
} else {
  const lock = net.createServer();
  lock.once('error', () => { console.log('auto-backup pehle se chal raha hai.'); process.exit(3); });
  lock.listen(LOCK_PORT, '127.0.0.1', () => {
    log(`☁️ AUTO-BACKUP v${VER} chal raha hai — Drive folder: ${driveFolder() || 'NAHI MILA (Google Drive for Desktop install/login karein)'}`);
    setInterval(ZINDA.guard(tick, 25 * 60000, 'backup tick'), 60000); tick();   // 2026-10-11: chowkidar
  });
}
