// ============================================================
//  auto-backup.js  v2.1 (2026-10-24: 📲 malik ki ijazat — mulazim ki darkhwast malik ke phone par push, malik ka faisla mulazim ke phone par) · v2.0 (2026-10-22: 📋 roz ki ginti — _round roz · _postQ line · larkon ko 12 / 4 baje yaad · malik ko 8 baje khulasa) · v1.9 (2026-10-22: 📷 factory items ki HD tasveer PC + Google Drive "Factory Photos" mein · factory nuskhe (factory/cfg) + batch bhi backup mein) · v1.6 (2026-10-12: cancel note par notification nahi, edit = nayi check) · v1.5 (🚚 transfer note 10 min mein check na ho = notification) · v1.0 (2026-10-05) — ☁️ AUTO BACKUP: din mein 2 dafa (app ki Settings se waqt) poora khata JSON mein,
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

const VER = '2.1';   // v2.1 (2026-10-24): 📲 MALIK KI IJAZAT (app v2.115.0) — approvals status 'new' = malik ko push, faisla (done / no / fail) = mulazim ko push. POS / SQL nahi.
// pichla:    // v2.0 (2026-10-22): 📋 ROZ KI GINTI — (1) _auto on = _round roz khud aaj (post-farq ginti ka us waqt ka stock likhe) (2) stockCount/_postQ (malik ka "✅ Sab theek karo") ek ek kar ke _post (post-farq wahi bill + parchi) (3) 12 / 4 baje baqi larkon ko push (4) 8 baje malik ko khulasa · v1.9 (2026-10-22): 📷 factory tasveerein (factory/phIdx + ph_<id>_<v>_<i>) -> backups\Factory Photos + Drive "Blue Khata Backup\Factory Photos" (sirf nayi / badli; hatai = file bhi hate) · extra backup mein factory/cfg (nuskhe) + factoryBatches · v1.8 (2026-10-17): 🔁 din wala har reminder KHUD har 1 ghanta (nag na likha = 60, 0 = band), 3 din ki hadd khatam (jab tak ✓ na ho), 4+ ek saath = ek khulasa notification · v1.7: v1.7 (2026-10-17): 🔔 MULAZIM ka reminder MALIK ke phone par bhi — waqt aate hi pehli khabar (malik + likhne wala), sirf mulazim ke likhe notes · v1.4 (2026-10-11): 🔁 notes.nag — baar baar yaad (15/30/60 min) jab tak ✓ na ho · v1.3 (2026-10-07): driver ki jeb se EXTRA kharcha (kind 'kharch', driver:true) khate se − (app v2.97.1) · v1.2 (2026-10-07): driver ka KHATA (app v2.96.1 jaisa) — phera + (kiraya − kharche − commission), liya −, advance + · v1.1: 🚚 gaari — roz sham malik ko notification "driver se hisaab lena hai"
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
  try { const fc = await base.collection('factory').doc('cfg').get(); extra.factoryCfg = fc.exists ? fc.data() : null; } catch (e) { extra.factoryCfg = { error: e.message }; }   // v1.9: 🏭 nuskhe (tasveer wale docs nahi — wo neeche alag)
  try { extra.factoryBatches = await readAll('factoryBatches'); } catch (e) { extra.factoryBatches = { error: e.message }; }
  const f2 = `Noor-Traders-extra-${st}.json.gz`;
  fs.writeFileSync(path.join(out, f2), zlib.gzipSync(Buffer.from(JSON.stringify({ exportedAt: now.toISOString(), ...extra }))));
  prune(out);
  const size = fs.statSync(path.join(out, f1)).size;
  const drive = driveFolder(); let copied = '';
  if (drive) { try { fs.copyFileSync(path.join(out, f1), path.join(drive, f1)); fs.copyFileSync(path.join(out, f2), path.join(drive, f2)); prune(drive); copied = drive; } catch (e) { log('Drive folder mein copy nahi hua: ' + e.message); } }
  let ph = null; try { ph = await mirrorFacPhotos(drive); if (ph.n || ph.del) log(`📷 Factory tasveer: ${ph.n} nayi / badli · ${ph.del} hatai · kul ${ph.total}${drive ? ' (Drive bhi)' : ''}`); } catch (e) { log('📷 Factory tasveer copy masla: ' + e.message); }
  const status = { at: Date.now(), ok: true, file: f1, size, count: records.length, drive: copied, pc: os.hostname(), ms: Date.now() - t0, why, ver: VER, ...(ph ? { photos: ph.total } : {}) };
  await base.collection('blueAccess').doc('backupStatus').set(status);
  log(`✅ Backup: ${f1} (${Math.round(size / 1024)} KB, ${records.length} records) ${copied ? '-> ' + copied : '(Drive folder NAHI mila)'} · ${Date.now() - t0} ms`);
  return status;
}

// ---- v1.9: 📷 FACTORY TASVEER — PC (backups\Factory Photos) + Google Drive (Blue Khata Backup\Factory Photos) — sirf nayi / badli ----
const PH_STATE = path.join(DIR, 'backups', 'fac-photos.json');
const phSafe = s => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'item';
async function mirrorFacPhotos(drive) {
  const d = await base.collection('factory').doc('phIdx').get(), items = (d.exists ? d.data()?.items : null) || {};
  let st = {}; try { st = JSON.parse(fs.readFileSync(PH_STATE, 'utf8')) || {}; } catch {}
  const outs = [path.join(DIR, 'backups', 'Factory Photos'), ...(drive ? [path.join(drive, 'Factory Photos')] : [])];
  for (const o of outs) fs.mkdirSync(o, { recursive: true });
  let n = 0, del = 0;
  for (const [id, m] of Object.entries(items)) {
    if (!m || !m.v) continue; const file = `${phSafe(m.nm)} [${String(id).replace(/[^\w-]/g, '_')}].jpg`;
    if (st[id] && st[id].v === m.v && st[id].file === file && outs.every(o => fs.existsSync(path.join(o, file)))) continue;
    const parts = [];
    for (let i = 0; i < (Number(m.n) || 1); i++) { const sn = await base.collection('factory').doc(`ph_${String(id).replace(/\//g, '_')}_${m.v}_${i}`).get(); const b = sn.exists ? sn.data().b : null; if (!b) throw Error('tasveer ka hissa nahi mila: ' + id); parts.push(Buffer.from(b)); }
    const buf = Buffer.concat(parts);
    for (const o of outs) { if (st[id] && st[id].file && st[id].file !== file) { try { fs.unlinkSync(path.join(o, st[id].file)); } catch {} } fs.writeFileSync(path.join(o, file), buf); }
    st[id] = { v: m.v, file }; n++;
  }
  for (const id of Object.keys(st)) if (!items[id] || !items[id].v) { for (const o of outs) { try { fs.unlinkSync(path.join(o, st[id].file)); } catch {} } delete st[id]; del++; }
  fs.writeFileSync(PH_STATE, JSON.stringify(st));
  return { n, del, total: Object.keys(st).length };
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
  const r = await getMessaging().sendEachForMulticast({ tokens, data: { title: '🚚 Driver se hisaab lena hai', body, tag: 'gaari-' + day, link: 'https://samiullah-878.github.io/Noor-traders-/#v=gaari' }, webpush: { headers: { Urgency: 'high' } } });
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
  if (n.done || n.deleted || !/^\d{4}-\d{2}-\d{2}$/.test(n.remindDay || '')) return null;
  if (n.nag != null && n.nag !== '' && Number(n.nag) === 0) return null;   // v1.8: 🔕 band
  const g = [15, 30, 60].includes(Number(n.nag)) ? Number(n.nag) : 60;      // v1.8: na likha = khud har 1 ghanta
  const at = new Date(n.remindDay + 'T' + (/^\d{2}:\d{2}$/.test(n.remindTime || '') ? n.remindTime : '09:00') + ':00').getTime();
  const t = now.getTime(), h = now.getHours();
  if (!(at > 0) || t < at + g * 60000 || h < 7 || h >= 23) return null;   // pehli khabar waqt par (Cloud Function / firstDue); v1.8: jab tak ✓ na ho
  const last = Number(nagSent[n.id]) || 0;
  return t - last >= g * 60000 - 20000 ? { g, mins: Math.round((t - at) / 60000) } : null;
}
// ---- v1.7: 🔔 MULAZIM KA REMINDER MALIK KO BHI (malik: "mulazim ka reminder malik ke phone par bhi aane chahiye") ----
// Waqt (remindDay + remindTime, warna 09:00) aate hi EK dafa: malik ke sab phone + likhne wala. Sirf mulazim ke likhe notes —
// malik ke apne notes Cloud Function pehle se deta hai. 2 ghante se purana = chup (PC band tha). tag 'nag-<id>' = ek hi khabar badalti hai.
const isBoss = x => x.role === 'owner' || x.role === 'malik';
function firstDue(n, tk, now = new Date()) {
  if (n.done || n.deleted || !/^\d{4}-\d{2}-\d{2}$/.test(n.remindDay || '') || nagSent['f' + n.id]) return false;
  if (String(n.byName || '').trim().toLowerCase() === 'malik' || (n.by && tk.some(x => isBoss(x) && x.uid === n.by))) return false;
  const at = new Date(n.remindDay + 'T' + (/^\d{2}:\d{2}$/.test(n.remindTime || '') ? n.remindTime : '09:00') + ':00').getTime();
  const t = now.getTime(), h = now.getHours();
  return at > 0 && t >= at && t - at < 2 * 3600000 && h >= 7 && h < 23;
}
async function nagNotify() {
  nagWatch();
  const now = new Date(), due = [...nagNotes.values()].map(n => ({ n, d: nagDue(n, now) })).filter(x => x.d);
  const maybe = [...nagNotes.values()].filter(n => !n.done && !n.deleted && /^\d{4}-\d{2}-\d{2}$/.test(n.remindDay || '') && !nagSent['f' + n.id]);
  if (!due.length && !maybe.length) return;
  const tk = (await base.collection('pushTokens').get()).docs.map(d => d.data()).filter(x => x.token);
  const { getMessaging } = require('firebase-admin/messaging');
  for (const n of maybe.filter(n => firstDue(n, tk, now)).slice(0, 10)) {
    nagSent['f' + n.id] = Date.now();
    const tokens = [...new Set(tk.filter(x => isBoss(x) || (n.by && x.uid === n.by)).map(x => x.token))];
    if (!tokens.length) { log(`🔔 "${String(n.text || '').slice(0, 30)}": malik ka push token nahi`); continue; }
    const who = String(n.byName || 'Mulazim').slice(0, 30), tm = /^\d{2}:\d{2}$/.test(n.remindTime || '') ? n.remindTime : '';
    const body = (String(n.text || n.partyName || 'Note').slice(0, 140)) + `\n👤 ${who} ka reminder${tm ? ' · ⏰ ' + tm : ''}`;
    try {
      const r = await getMessaging().sendEachForMulticast({ tokens, data: { title: '🔔 Yaad dihani — ' + who, body, tag: 'nag-' + n.id, link: 'https://samiullah-878.github.io/Noor-traders-/#note=' + n.id }, webpush: { headers: { Urgency: 'high' } } });
      log(`🔔 ${who} ka reminder "${String(n.text || '').slice(0, 30)}": ${r.successCount}/${tokens.length} phone`);
    } catch (e) { log('🔔 reminder bhejna masla: ' + e.message); }
  }
  // v1.8: har phone ki apni list — 4+ baqi = EK khulasa notification (dher nahi), warna har note alag (tag 'nag-<id>' = purani ki jagah nayi)
  const per = new Map();   // token -> [{n, d}]
  for (const x of due) { nagSent[x.n.id] = Date.now();
    const tokens = [...new Set(tk.filter(y => isBoss(y) || (x.n.by && y.uid === x.n.by)).map(y => y.token))];
    if (!tokens.length) { log(`🔁 "${String(x.n.text || '').slice(0, 30)}": koi push token nahi`); continue; }
    for (const t of tokens) { if (!per.has(t)) per.set(t, []); per.get(t).push(x); } }
  const late = m => m >= 1440 ? Math.floor(m / 1440) + ' din' : m >= 60 ? Math.floor(m / 60) + ' ghante' : m + ' min';
  const groups = new Map();   // key -> {tokens, msg}
  for (const [t, L] of per) {
    if (L.length >= 4) { const key = 'S|' + L.map(x => x.n.id).sort().join(','); if (!groups.has(key)) groups.set(key, { tokens: [], L, sum: true }); groups.get(key).tokens.push(t); }
    else for (const x of L) { const key = 'N|' + x.n.id; if (!groups.has(key)) groups.set(key, { tokens: [], L: [x], sum: false }); groups.get(key).tokens.push(t); } }
  for (const g of groups.values()) {
    let data;
    if (g.sum) { const L = g.L.slice().sort((a, b) => b.d.mins - a.d.mins);
      data = { title: `🔁 ${L.length} kaam abhi baqi`, body: L.slice(0, 6).map(x => '• ' + String(x.n.text || x.n.partyName || 'Note').replace(/\s+/g, ' ').slice(0, 40) + ' (' + late(x.d.mins) + ')').join('\n') + (L.length > 6 ? `\n+ ${L.length - 6} aur` : '') + '\n✓ karein to band', tag: 'nag-sum', link: 'https://samiullah-878.github.io/Noor-traders-/#note=' + L[0].n.id }; }   // Reminder screen khulti hai
    else { const { n, d } = g.L[0];
      data = { title: '🔁 Yaad dihani — abhi tak nahi hua', body: (String(n.text || n.partyName || 'Note').slice(0, 140)) + `\n⏰ ${late(d.mins)} se baqi · 🔁 har ${d.g === 60 ? '1 ghanta' : d.g + ' min'} — ✓ karein to band`, tag: 'nag-' + n.id, link: 'https://samiullah-878.github.io/Noor-traders-/#note=' + n.id }; }
    try {
      const r = await getMessaging().sendEachForMulticast({ tokens: g.tokens, data, webpush: { headers: { Urgency: 'high' } } });
      log(`🔁 ${g.sum ? 'khulasa ' + g.L.length + ' kaam' : 'nag "' + String(g.L[0].n.text || '').slice(0, 30) + '"'}: ${r.successCount}/${g.tokens.length} phone`);
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
function trList() {   // v1.6: cancel (POS mein mita / app se delete) shamil nahi
  const dels = new Set([...trJobs.values()].filter(j => j.op === 'delete' && j.status === 'done' && j.transferId).map(j => String(j.transferId)));
  const L = [...trPos.values()].filter(t => !t.cancelled && !dels.has(String(t.transferId))), ids = new Set([...trPos.values()].map(t => String(t.transferId)));
  for (const j of trJobs.values()) { if (j.op === 'delete' || j.status !== 'done' || !j.transferId || ids.has(String(j.transferId)) || dels.has(String(j.transferId))) continue;
    L.push({ id: 'T' + j.transferId, transferId: j.transferId, transferNo: String(j.transferNo || ''), from: j.from, to: j.to, createdOn: Number(j.doneAt) || Number(j.at) || 0, lines: j.lines || [] }); }
  return L;
}
function trDue(t, now = Date.now(), hour = new Date().getHours()) {
  const ed = Number(t.editCount) > 0, key = String(t.id || ('T' + t.transferId)) + (ed ? 'E' + Number(t.editCount) : ''), age = now - (ed && Number(t.editedAt) ? Number(t.editedAt) : trIssued(t));   // v1.6: edit = nayi check
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
    const title = Number(t.editCount) > 0 ? `✏️ ${t.transferNo ? 'TN ' + t.transferNo : 'Transfer note'} EDIT hua — maal dobara mila kar lo` : `🚚 ${t.transferNo ? 'TN ' + t.transferNo : 'Transfer note'} abhi tak check nahi hua`;
    const body = `⏳ ${late} · ${bn(t.from)} → ${bn(t.to)}${n ? ' · ' + n + ' items' : ''}\nTap karein — scan / ✓ karein`;
    try {
      const r = await getMessaging().sendEachForMulticast({ tokens, data: { title, body, tag: 'tc-' + d.key, link: 'https://samiullah-878.github.io/Noor-traders-/#tc=' + encodeURIComponent(d.key) }, webpush: { headers: { Urgency: 'high' } } });
      log(`🚚 transfer check yaad (${t.transferNo || d.key}, ${late}): ${r.successCount}/${tokens.length} phone`);
    } catch (e) { log('🚚 transfer notification masla: ' + e.message); }
  }
  for (const k of Object.keys(trSent)) if (Date.now() - trSent[k] > 2 * 86400000) delete trSent[k];
  try { fs.writeFileSync(TR_FILE, JSON.stringify(trSent)); } catch {}
}
// ---- v2.0: 📋 ROZ KI GINTI (app v2.109.0) — POS / SQL mein kuch nahi likhta ----
const ROZ_LOC = [['nt', /noor/i, 'Noor Traders', 'stock.rozdukan'], ['g1', /godam\s*-?\s*1\b/i, 'Godam 1', 'stock.rozg1'], ['g2', /godam\s*-?\s*2\b/i, 'Godam 2', 'stock.rozg2'], ['g3', /godam\s*-?\s*3\b/i, 'Godam 3', 'stock.rozg3']];
const ROZ_FILE = path.join(DIR, 'roz-sent.json');
let rozSent = (() => { try { return JSON.parse(fs.readFileSync(ROZ_FILE, 'utf8')) || {}; } catch { return {}; } })();
const countCol = base.collection('stockCount');
// _auto · _round · _postQ · _post = LISTENER (har minute get() = roz ~4,000 reads — post-farq v10 wala sabaq). Jawab aate hi agli line foran.
const rozD = {}, rozU = {}; let rozQBusy = false, rozQT = 0;
const rozHas = id => Object.prototype.hasOwnProperty.call(rozD, id);
function rozWatch() {
  for (const id of ['_auto', '_round', '_postQ', '_post']) { if (rozU[id]) continue;
    rozU[id] = countCol.doc(id).onSnapshot(d => { rozD[id] = d.exists ? d.data() : null;
      if (id === '_postQ' || id === '_post') { clearTimeout(rozQT); rozQT = setTimeout(() => rozQueue().catch(e => log('📋 theek line masla: ' + e.message)), 1500); } },
      e => { log(`📋 roz sun masla (${id}): ${e.message}`); rozU[id] = null; delete rozD[id]; }); }
}
async function rozRound(day) {   // "session = din" ON = _round hamesha aaj (malik app na khole tab bhi)
  if (!rozHas('_auto') || !rozHas('_round') || rozD._auto?.on !== true || rozD._round?.round === day) return;
  const r = { round: day, at: Date.now(), by: 'pc' }; await countCol.doc('_round').set(r); rozD._round = r; log('📋 Ginti ka din: ' + day);
}
async function rozQueue() {   // malik ka "✅ Sab theek karo" — ek waqt mein ek _post (post-farq wahi bill + parchi), jawab line mein, phir agli
  if (rozQBusy || !rozHas('_postQ') || !rozHas('_post')) return; rozQBusy = true;
  try {
    const q = rozD._postQ; if (!q) return;
    const jobs = (Array.isArray(q.jobs) ? q.jobs : []).map(j => ({ ...j })), save = async () => { const nq = { ...q, jobs }; await countCol.doc('_postQ').set(nq); rozD._postQ = nq; };
    let i = jobs.findIndex(j => !j.st || j.st === 'sent'); if (i < 0) return;
    if (Date.now() - (Number(q.at) || 0) > 6 * 3600e3) { for (const j of jobs) if (!j.st || j.st === 'sent') { j.st = 'failed'; j.error = 'der ho gayi — dobara dabayein'; } await save(); log('📋 Theek line 6 ghante purani — band'); return; }
    const P = rozD._post, age = Date.now() - (Number(P?.at) || 0);
    if (P && (P.status === 'posting' ? age < 60 * 60000 : ['pending', 'approved', 'preview'].includes(P.status) && age < 20 * 60000)) return;   // PC abhi bill bana raha
    if (jobs[i].st === 'sent') {
      const j = jobs[i], mine = P && Number(P.at) === Number(j.at) && Number(P.branch) === Number(j.branch);
      if (mine && ['done', 'nothing', 'failed'].includes(P.status)) { j.st = P.status; if (P.saleNo) j.saleNo = String(P.saleNo); if (P.returnNo) j.returnNo = String(P.returnNo); if (P.error) j.error = String(P.error).slice(0, 160); if (P.total != null) j.total = Number(P.total) || 0; }
      else { j.st = 'failed'; j.error = mine ? 'PC ne waqt par bill nahi banaya (post-farq band?)' : 'PC ka jawab nahi mila'; }
      log(`📋 Theek line ${i + 1}/${jobs.length}: ${j.st}${j.saleNo ? ' Sale ' + j.saleNo : ''}${j.returnNo ? ' Return ' + j.returnNo : ''}${j.error ? ' · ' + j.error : ''}`);
      i = jobs.findIndex(x => !x.st); if (i < 0) { await save(); return; }
    }
    const j = jobs[i], at = Date.now(); j.at = at; j.st = 'sent';
    const post = { round: String(j.round), branch: Number(j.branch), status: 'approved', direct: true, kind: j.kind === 'zyada' ? 'zyada' : 'kam', items: (j.items || []).map(String), at, approvedAt: at, by: 'pc-line' };
    await countCol.doc('_post').set(post); rozD._post = post; await save();
    log(`📋 Theek line ${i + 1}/${jobs.length} bheji: branch ${j.branch} ${j.kind} (${post.items.length} items)`);
  } finally { rozQBusy = false; }
}
async function rozState(day) {   // har jagah: branch, doc (aaj), gine (aaj)
  const cfg = (await base.collection('blueAccess').doc('stockConfig').get()).data()?.roz || {}; if (cfg.on !== true) return null;
  const metas = (await base.collection('posStock').where('meta', '==', true).get()).docs.map(d => ({ b: Number(d.data().branch ?? String(d.id).match(/^b(\d+)-/)?.[1]), name: String(d.data().name || '') }));
  const find = rx => metas.find(m => rx.test(m.name))?.b;
  const gina = new Set((await countCol.where('round', '==', day).get()).docs.filter(d => !d.data().del).map(d => d.id));
  const out = [];
  for (const [k, rx, t, cap] of ROZ_LOC) { if ((cfg.locs || {})[k] === false) continue; const b = k === 'nt' ? (find(rx) ?? (metas.some(m => m.b === 1) ? 1 : undefined)) : find(rx); if (b == null) continue;
    const dd = await countCol.doc('roz-' + k).get(), d = dd.exists && dd.data().day === day ? dd.data() : { by: {}, taken: {} };
    out.push({ k, b, t, cap, d, n: Number(cfg.n) || 20, done: id => gina.has(`c-${b}-${id}`) }); }
  return out;
}
async function rozNotify(now, day) {
  const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, slot = ['12:00', '16:00', '20:00'].filter(t => hm >= t).pop(); if (!slot) return;
  const key = day + ' ' + slot; if (rozSent[key]) return; const due = new Date(now); due.setHours(...slot.split(':').map(Number), 0, 0); if (now.getTime() - due.getTime() > 2 * 3600e3) { rozSent[key] = 1; return; }
  const L = await rozState(day); rozSent[key] = Date.now(); try { fs.writeFileSync(ROZ_FILE, JSON.stringify(Object.fromEntries(Object.entries(rozSent).filter(([k]) => k >= dayOf(new Date(Date.now() - 3 * 864e5)))))); } catch {}
  if (!L || !L.length) return;
  const tk = (await base.collection('pushTokens').get()).docs.map(d => d.data()).filter(x => x.token), { getMessaging } = require('firebase-admin/messaging');
  const send = async (tokens, title, body, tag) => { tokens = [...new Set(tokens)]; if (!tokens.length) return 0; try { const r = await getMessaging().sendEachForMulticast({ tokens, data: { title, body, tag, link: 'https://samiullah-878.github.io/Noor-traders-/#v=stock' }, webpush: { headers: { Urgency: 'high' } } }); return r.successCount; } catch (e) { log('📋 push masla: ' + e.message); return 0; } };
  if (slot === '20:00') {   // malik ko khulasa
    const lines = L.map(x => { const ids = Object.keys(x.d.taken || {}), dn = ids.filter(x.done).length, boys = Object.keys(x.d.by || {}).length; return ids.length ? `${x.t}: ${dn}/${ids.length}${boys ? ' (' + boys + ' larke)' : ''}${dn >= ids.length ? ' ✓' : ''}` : `${x.t}: aaj shuru nahi`; });
    const n = await send(tk.filter(isBoss).map(x => x.token), '📋 Aaj ki ginti', lines.join(' · ') + '\nFarq: app → Stock → 📋 Roz ki ginti', 'roz-' + day); log(`📋 Malik ko ginti khulasa: ${n} phone`); return;
  }
  const staff = (await base.collection('blueStaff').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false && Array.isArray(s.allow));
  const norm = v => String(v || '').trim().toLowerCase();
  let sent = 0;
  for (const s of staff) { const mine = L.filter(x => s.allow.includes(x.cap)); if (!mine.length) continue;
    const parts = mine.map(x => { const ids = (x.d.by?.[s.id]?.ids || []).map(String), dn = ids.filter(x.done).length; return { x, all: ids.length, dn }; });
    const left = parts.filter(p => !p.all || p.dn < p.all); if (!left.length) continue;
    const body = left.map(p => p.all ? `${p.x.t}: ${p.dn}/${p.all} — ${p.all - p.dn} baqi` : `${p.x.t}: shuru karein (${p.x.n} items)`).join('\n');
    sent += await send(tk.filter(t => norm(t.name) === norm(s.name) && !isBoss(t)).map(t => t.token), '📋 Aaj ki ginti baqi', body, 'roz-' + day + '-' + s.id); }
  log(`📋 ${slot} ginti yaad: ${sent} phone`);
}
async function rozTick() {
  const now = new Date(), day = dayOf(now);
  rozWatch();
  try { await rozRound(day); } catch (e) { log('📋 ginti din masla: ' + e.message); }
  try { await rozQueue(); } catch (e) { log('📋 theek line masla: ' + e.message); }
  try { await rozNotify(now, day); } catch (e) { log('📋 ginti yaad masla: ' + e.message); }
}

// ---- v2.1: 📲 MALIK KI IJAZAT (app v2.115.0) — POS / SQL mein kuch nahi. Listener (har minute get() nahi) ----
const IJ_FILE = path.join(DIR, 'ij-sent.json');
let ijSent = (() => { try { return JSON.parse(fs.readFileSync(IJ_FILE, 'utf8')) || {}; } catch { return {}; } })();
const ijNew = new Map(), ijDone = new Map(); let ijU1 = null, ijU2 = null; const IJ_T0 = Date.now() - 6 * 3600e3;
function ijWatch() {
  const col = base.collection('approvals');
  if (!ijU1) ijU1 = col.where('status', '==', 'new').onSnapshot(s => { ijNew.clear(); for (const d of s.docs) ijNew.set(d.id, { ...d.data(), id: d.id }); }, e => { log('📲 ijazat sun masla: ' + e.message); ijU1 = null; });
  if (!ijU2) ijU2 = col.where('decidedAt', '>', IJ_T0).onSnapshot(s => { for (const d of s.docs) ijDone.set(d.id, { ...d.data(), id: d.id }); }, e => { log('📲 ijazat faisla sun masla: ' + e.message); ijU2 = null; });
}
async function ijNotify() {
  ijWatch();
  const now = Date.now();
  const fresh = [...ijNew.values()].filter(a => a.status === 'new' && !ijSent['n' + a.id] && now - (Number(a.at) || 0) < 24 * 3600e3);
  const dec = [...ijDone.values()].filter(a => ['done', 'no', 'fail'].includes(a.status) && !ijSent['d' + a.id] && now - (Number(a.decidedAt) || 0) < 2 * 3600e3);
  if (!fresh.length && !dec.length) return;
  const tk = (await base.collection('pushTokens').get()).docs.map(d => d.data()).filter(x => x.token), { getMessaging } = require('firebase-admin/messaging');
  const L = 'https://samiullah-878.github.io/Noor-traders-/', norm = v => String(v || '').trim().toLowerCase();
  const send = async (tokens, title, body, tag, link) => { tokens = [...new Set(tokens)]; if (!tokens.length) return 0; const r = await getMessaging().sendEachForMulticast({ tokens, data: { title, body, tag, link }, webpush: { headers: { Urgency: 'high' } } }); return r.successCount; };
  for (const a of fresh.slice(0, 10)) { ijSent['n' + a.id] = now;
    try { const n = await send(tk.filter(isBoss).map(x => x.token), '📲 Ijazat chahiye — ' + String(a.byName || 'Mulazim').slice(0, 30), String(a.title || '').slice(0, 160) + (a.reason ? '\n💬 ' + String(a.reason).slice(0, 120) : '') + '\nTap — ✓ Manzoor / ✕ Nahi', 'ij-' + a.id, L + '#ij=' + a.id); log(`📲 ijazat "${String(a.title || '').slice(0, 40)}" (${a.byName || '?'}): malik ${n} phone`); }
    catch (e) { log('📲 ijazat push masla: ' + e.message); } }
  for (const a of dec.slice(0, 10)) { ijSent['d' + a.id] = now;
    try { const tokens = tk.filter(x => !isBoss(x) && ((a.by && x.uid === a.by) || (a.byName && norm(x.name) === norm(a.byName)))).map(x => x.token);
      const n = await send(tokens, a.status === 'done' ? '✅ Malik ne ijazat de di' : a.status === 'no' ? '❌ Malik ne mana kar diya' : '⚠️ Ijazat — kaam nahi hua', String(a.title || '').slice(0, 160) + (a.err ? '\n' + String(a.err).slice(0, 100) : ''), 'ijd-' + a.id, L);
      log(`📲 faisla ${a.status} "${String(a.title || '').slice(0, 40)}": mulazim ${n} phone`); }
    catch (e) { log('📲 faisla push masla: ' + e.message); } }
  for (const k of Object.keys(ijSent)) if (now - ijSent[k] > 3 * 864e5) delete ijSent[k];
  try { fs.writeFileSync(IJ_FILE, JSON.stringify(ijSent)); } catch {}
}

let doneKeys = new Set(), lastNow = 0, busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try { await rozTick(); } catch (e) { log('📋 roz masla: ' + e.message); }
  try { await gaariNotify(); } catch (e) { log('gaari notification masla: ' + e.message); }
  try { await nagNotify(); } catch (e) { log('🔁 nag masla: ' + e.message); }
  try { await trNotify(); } catch (e) { log('🚚 transfer check masla: ' + e.message); }
  try { await ijNotify(); } catch (e) { log('📲 ijazat masla: ' + e.message); }
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

module.exports._t = { ijNotify, ijWatch, ijNew, ijDone, ijSentSet: v => { ijSent = v; }, mirrorFacPhotos, phSafe, rozRound, rozQueue, rozNotify, rozState, rozTick, rozWatch, rozD, rozSentSet: v => { rozSent = v; }, trDue, trList, trNotify, trSet: (p, j, c) => { trPos = p; trJobs = j; trChecks = c; trStops = []; }, trSent: () => trSent, nagDue, firstDue, nagNotify, nagNotes: () => nagNotes, nagSent: () => nagSent };
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
