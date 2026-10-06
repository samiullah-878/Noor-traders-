// =========================================================
//  pos-sales-dekho.js  v1.4 (2026-10-06: 🔔 POS mein item judte hi (scan ya code) us PC ko beep — posBeep/<PC host>, har 0.4 sec) · v1.3 (2026-10-06: ⚡ har 2 sec + app ka bill bante / edit hote hi foran) · v1.2 (2026-10-06: ps = DocStatusID (1 un-posted / 2 posted), pc + by (SystemNotes se), items posSaleLines/<SaleID>, _sync har 30 sec) · v1.1 (2026-10-03: har 10 sec, pehle chhota sawal) · v1  (2026-10-03) — POS par bane AAJ ke SALE BILLS app mein (sirf SELECT, POS mein kuch nahi badalta)
//  Har 1 minute dbo.Sale (aaj) parhta hai -> Firestore posSales/<YYYY-MM-DD> (ek doc, sirf badle to likhta hai).
//  App: scanner screen ke baayein "Aaj ke bills" mein chips — ✓ cash/poora · ✗ udhaar · ⊘ cancel (DocStatusID 3).
//  App se bani sale (Description = "BK-APP <id>") ko app:<id> nishan — app wali chip se jod deta hai (do dafa na dikhe).
//  Chalana: node pos-sales-dekho.js (pos-sales-auto.bat loop mein). Log: pos-sales-log.txt · Lock 47824.
// =========================================================
const fs = require('fs');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const EVERY = 2 * 1000;             // v1.3: 2 sec (sirf ginti; Firestore par likhna sirf badlaav par) · v1.1: 10 sec — pehle sirf ginti/aakhri bill dekhta hai, badle to poori list
const FULL_EVERY = 5 * 60 * 1000;    // phir bhi har 5 min poori list (koi badlaav na chhoote)
let lastKey = '', lastFull = 0;
const LOCK_PORT = 47824;
const cfgLocal = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'local-config.json'), 'utf8')) || {}; } catch { return {}; } };
const DIR = __dirname;
// HEARTBEAT (doctor v2.3+): har 30 sec
{ const _hb = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); const _w = () => { try { fs.writeFileSync(_hb, String(Date.now())); } catch {} }; _w(); setInterval(_w, 30000).unref(); }
const log = (...a) => { const line = `[${new Date().toLocaleTimeString()}] ` + a.join(' '); console.log(line); try { fs.appendFileSync(path.join(DIR, 'pos-sales-log.txt'), line + '\r\n'); } catch {} };
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('posSales');
const linesCol = db.collection('businesses').doc(BUSINESS_ID).collection('posSaleLines');   // v1.2: har bill ke items (edit / un-posted print)
// v1.2: PC ka naam (SystemNotes "at PC:DESKTOP-xxx") -> dukaan ka naam. local-config.json "pcNames": {"DESKTOP-xxx": "Naam"} se badlein.
const PC_DEFAULT = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-KEIME1D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
const pcNames = () => { try { return { ...PC_DEFAULT, ...(JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')).pcNames || {}) }; } catch { return PC_DEFAULT; } };
const lineHash = new Map();
let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const dayOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let lastHash = '';

// v1.2: aaj ke har bill ke items -> posSaleLines/<SaleID> {day, no, at, lines:[{i,n,q,r,g}]} — sirf badle hue likhe
async function syncLines(p, d0, d1, day) {
  const rs = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT d.SaleID, s.SaleNo, d.ItemID, i.ItemName, d.Qty, d.Rate, d.GBranchID
    FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID JOIN dbo.Items i ON i.ItemID = d.ItemID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b ORDER BY d.SaleID, d.SaleDetailID`)).recordset;
  const by = new Map();
  for (const r of rs) { if (!by.has(r.SaleID)) by.set(r.SaleID, { no: String(r.SaleNo || '').trim(), lines: [] });
    by.get(r.SaleID).lines.push({ i: r.ItemID, n: String(r.ItemName || '').trim().slice(0, 60), q: Math.round((Number(r.Qty) || 0) * 1000) / 1000, r: r2(r.Rate), g: Number(r.GBranchID) || 0 }); }
  let batch = db.batch(), n = 0, w = 0;
  for (const [id, v] of by) {
    const h = JSON.stringify(v.lines.slice(0, 150)); if (lineHash.get(id) === h) continue;
    batch.set(linesCol.doc(String(id)), { day, no: v.no, at: Date.now(), lines: v.lines.slice(0, 150) }); lineHash.set(id, h); n++; w++;
    if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  if (w) log(`Items: ${w} bills ke items app mein`);
  if (lineHash.size > 3000) lineHash.clear();
}
async function once() {
  const p = await getPool();
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const k = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT COUNT(*) AS C, MAX(SaleID) AS M, SUM(CASE WHEN DocStatusID = 3 THEN 1 ELSE 0 END) AS X, SUM(DocStatusID) AS S, SUM(CAST(TotalSale AS FLOAT)) AS T, SUM(CAST(CashReceived AS FLOAT)) AS R, MAX(UpdatedOn) AS U
    FROM dbo.Sale WHERE SaleDate >= @a AND SaleDate < @b`)).recordset[0] || {};
  const key = `${dayOf(d0)}|${k.C}|${k.M}|${k.X}|${k.S}|${Math.round(k.T || 0)}|${Math.round(k.R || 0)}|${k.U ? new Date(k.U).getTime() : 0}`;   // v1.2: post hona / edit bhi
  if (key === lastKey && Date.now() - lastFull < FULL_EVERY) return;   // kuch nahi badla
  lastKey = key; lastFull = Date.now();
  const rows = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT s.SaleID, s.SaleNo, s.SaleDate, s.TotalSale, s.CashReceived, s.IsCreditSale, s.DocStatusID, s.Description, s.SystemNotes, pt.PartyName,
           (SELECT COUNT(*) FROM dbo.SaleDetail d WHERE d.SaleID = s.SaleID) AS N
    FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b ORDER BY s.SaleID DESC`)).recordset;
  const names = pcNames();
  const bills = rows.slice(0, 600).map(r => {
    const desc = String(r.Description || ''), m = desc.match(/BK-APP[ :]([A-Za-z0-9_-]+)/);
    const sn = String(r.SystemNotes || ''), host = (sn.match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || '', by = (sn.match(/By:\s*([^\r\n]+?)\s+On:/i) || [])[1] || '';
    return { id: r.SaleID, no: String(r.SaleNo || '').trim(), t: r2(r.TotalSale), c: r2(r.CashReceived), cr: r.IsCreditSale ? 1 : 0,
      x: Number(r.DocStatusID) === 3 ? 1 : 0, p: String(r.PartyName || '').slice(0, 60), n: Number(r.N) || 0,
      tm: r.SaleDate ? new Date(r.SaleDate).getTime() : 0, app: m ? m[1] : '',
      ps: Number(r.DocStatusID) || 0, pc: String(names[host] || host.replace(/^DESKTOP-/i, '') || '').slice(0, 30), by: /blue khata/i.test(by) ? '' : String(by).trim().slice(0, 20) };
  });
  const day = dayOf(d0), hash = day + JSON.stringify(bills);
  await syncLines(p, d0, d1, day).catch(e => log('Items masla: ' + e.message));
  if (hash === lastHash) return;
  await col.doc(day).set({ day, at: Date.now(), bills });
  lastHash = hash;
  log(`Aaj ke ${bills.length} POS bills app mein (cancel ${bills.filter(b => b.x).length}, udhaar ${bills.filter(b => b.cr && !b.x).length})`);
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('pos-sales-dekho pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log('pos-sales-dekho v1.4 chal raha hai — har 2 second (sirf badlaav par likhta hai)…');
  let running = false, again = false;
  const tick = async () => { if (running) { again = true; return; } running = true;
    try { await once(); } catch (e) { log('Masla: ' + e.message); if (e.code === 16 || /UNAUTHENTICATED/.test(String(e.message))) process.exit(1); }
    finally { running = false; if (again) { again = false; setTimeout(tick, 50); } } };
  await tick();
  setInterval(tick, EVERY);
  // v1.3: app ka bill POS mein bana (done) / edit hua -> foran dekho (2 sec ka intezar bhi nahi)
  const kick = () => setTimeout(() => { lastKey = ''; tick(); }, 150);
  const base = db.collection('businesses').doc(BUSINESS_ID), seen = new Map();
  const watch = (name, field) => base.collection(name).where(field, '>', Date.now() - 6 * 3600000).onSnapshot(sn => {
    sn.docChanges().forEach(c => { const d = c.doc.data() || {}, st = d.status, prev = seen.get(c.doc.id); seen.set(c.doc.id, st); if (prev !== undefined && st === 'done' && prev !== 'done') kick(); });
    if (seen.size > 5000) seen.clear();
  }, e => log('Foran-dekho listener: ' + e.message));
  watch('appSales', 'createdAt'); watch('saleEdits', 'at');
  // v1.4: 🔔 POS BEEP — nayi SaleDetail line (save se pehle bhi POS likhta hai) -> us PC (SystemNotes "at PC:") ke posBeep doc par waqt.
  // NT-PRINT (us PC par) dekh kar beep karta hai. App ke bill (BK-APP) aur bari kheep (> 30 line = save/import) par nahi.
  if (cfgLocal().posBeep !== false) {
    const beepCol = db.collection('businesses').doc(BUSINESS_ID).collection('posBeep');
    let lastLine = 0, bRun = false;
    const beepTick = async () => { if (bRun) return; bRun = true;
      try {
        if (!lastLine) { lastLine = Number((await p0.request().query('SELECT MAX(SaleDetailID) AS m FROM dbo.SaleDetail')).recordset[0].m) || 0; return; }
        const r = (await p0.request().input('l', sql.Int, lastLine).query(`SELECT TOP 200 d.SaleDetailID AS D, CAST(s.SystemNotes AS NVARCHAR(400)) AS SN,
          CAST(s.Description AS NVARCHAR(200)) AS DS, i.ItemName AS N FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
          LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.SaleDetailID > @l ORDER BY d.SaleDetailID`)).recordset;
        if (!r.length) return;
        lastLine = Math.max(lastLine, ...r.map(x => Number(x.D) || 0));
        if (r.length > 30) return;
        const by = new Map();
        for (const x of r) { if (/BK-APP/i.test(String(x.DS || ''))) continue;
          const host = ((String(x.SN || '').match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || 'UNKNOWN').toUpperCase();
          const o = by.get(host) || { n: 0, item: '' }; o.n++; o.item = String(x.N || '').trim().slice(0, 40); by.set(host, o); }
        for (const [k, o] of by) beepCol.doc(k).set({ at: Date.now(), n: o.n, item: o.item }).catch(() => {});
      } catch (e) { log('POS beep: ' + e.message); }
      finally { bRun = false; } };
    const p0 = await getPool();
    setInterval(beepTick, 400);
    log('🔔 POS beep chalu — har nayi line par us PC ko awaz');
  }
  const beat = () => col.doc('_sync').set({ at: Date.now() }).catch(() => {});   // v1.2: app mein "PC sync X sec pehle"
  beat(); setInterval(beat, 30000);
});
