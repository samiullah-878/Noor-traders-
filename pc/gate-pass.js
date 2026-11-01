// =========================================================
//  gate-pass.js  v1.1 (2026-11-01: 🔵 UN-POSTED bhi — malik: "Bills jaisa: laal = posted (tick), neela = un-posted (baad mein laal)" · ps 1/2 ·
//                 scan ke dauran nayi line bhi (SaleDetail ginti/jor jaanch mein)) · v1.0 (2026-11-01) — 🚪 GATE PASS KA RECORD (POS ke POSTED bill → app, ~1 second)
//  Malik: "jitne bhi gate pass nikal rahe hain un ka record app mein · har customer alag · jo bill POST ho jaye usi ka gate pass
//          1–1½ second mein pohnche · upar gate pass number aur customer, neeche tadad — wahan Zeeshan ya Sonu tick kar de".
//
//  Gate pass = bill ki wo line jis ka godam (SaleDetail.GBranchID) bill ki branch (Sale.BranchID) se ALAG ho (dukan ka bill, maal godam se).
//  Har counter ka bill (naya PC bhi) POS ke isi SQL database mein aata hai — kisi counter par kuch lagana nahi.
//  Ye script (server PC) har 0.4 sec ek sasti jaanch (aaj + kal ke bills (un-posted + posted): ginti / jor / status / UpdatedOn + lines ki ginti / jor) — badle to:
//    • un-posted (ps 1 = 🔵 app mein tick band) + posted (ps 2 = 🔴 tick) bills ki godam lines parhti → businesses/noor-traders/gatePass/<SaleID>
//        {no (bill no = gate pass no), day, tm, pt (post ka waqt), br (bill branch), p (customer), pc, by,
//         l: [{k: 'ItemID_godam', i, n, q (pcs), pk (carton pcs), g}], gs: [godam], gn: {id: naam}, off: 0, at}
//      (sirf badle docs; merge — larkon ke tick `g` KABHI nahi chhuti)
//    • posted se un-post = ps 1 (wapas neela, tick wese hi) · cancel / delete / godam line hat gayi = off: 1 (app: ❌ — tick wese hi)
//  Tick (app): gatePass/<id>.g.<k> = {n: kis ne, t: waqt, q: us waqt tadad} — rules 2.81 (sirf `g`).
//  AI NAHI. POS mein KUCH nahi likhti (sirf parhti). "stock fraq" bill nahi. Minus line (wapsi) nahi.
//  Chalana: gate-pass-auto.bat (doctor). Log: gate-pass-log.txt · Lock 47838.
// =========================================================
const fs = require('fs');
const net = require('net');
const path = require('path');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47838;
const EVERY = 400, FULL_EVERY = 2 * 60000, NAMES_EVERY = 10 * 60000;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const p2 = n => String(n).padStart(2, '0');
const dayOf = d => { d = d instanceof Date ? d : new Date(d); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const isFarqName = n => /stock\s*['"]?\s*f[ae]?r?a?q/i.test(String(n || ''));   // pos-sales-dekho jaisa — ginti ka farq bill gate pass nahi
const PC_DEFAULT = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-KEIME1D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
const pcNames = () => { try { return { ...PC_DEFAULT, ...(JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')).pcNames || {}) }; } catch { return PC_DEFAULT; } };

// ---------- SQL qataren → har bill ka gate pass doc ----------
// rows: SaleID, SaleNo, SaleDate, BranchID, PartyName, SN (SystemNotes), ItemID, ItemName, PackQty, Qty, G (line ka godam)
function build(rows, names = {}, pcs = PC_DEFAULT) {
  const out = new Map();
  for (const r of rows) {
    const id = Number(r.SaleID) || 0, br = Number(r.BranchID) || 0, g = Number(r.G) || 0, q = Number(r.Qty) || 0;
    if (!id || !g || g === br || q <= 0 || isFarqName(r.PartyName)) continue;
    let d = out.get(id);
    if (!d) {
      const sn = String(r.SN || ''), host = (sn.match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || '', by = (sn.match(/By:\s*([^\r\n]+?)\s+On:/i) || [])[1] || '';
      const tm = r.SaleDate ? new Date(r.SaleDate).getTime() : 0;
      d = { no: String(r.SaleNo || '').trim().slice(0, 30), day: tm ? dayOf(tm) : dayOf(new Date()), tm, br, ps: Number(r.DocStatusID) === 2 ? 2 : 1, p: String(r.PartyName || '').trim().slice(0, 60),
        pc: String(pcs[host] || host.replace(/^DESKTOP-/i, '') || '').slice(0, 30), by: /blue khata/i.test(by) ? '' : String(by).trim().slice(0, 30), L: new Map() };
      out.set(id, d);
    }
    const k = (Number(r.ItemID) || 0) + '_' + g, x = d.L.get(k) || { k, i: Number(r.ItemID) || 0, n: String(r.ItemName || '').trim().slice(0, 80), q: 0, pk: Math.max(0, Number(r.PackQty) || 0), g };
    x.q = r3(x.q + q); d.L.set(k, x);   // ek item ki do lines (ctn + pcs) = ek qatar
  }
  for (const d of out.values()) {
    d.l = [...d.L.values()].sort((a, b) => a.g - b.g || a.n.localeCompare(b.n)).slice(0, 200); delete d.L;
    d.gs = [...new Set(d.l.map(x => x.g))].sort((a, b) => a - b);
    d.gn = {}; for (const b of [d.br, ...d.gs]) d.gn[String(b)] = String(names[b] || (b === 1 ? 'NOOR TRADERS' : 'Godam ' + b)).slice(0, 40);
  }
  return out;
}
const hashOf = d => JSON.stringify([d.no, d.day, d.br, Number(d.ps) === 1 ? 1 : 2, d.p, d.pc, d.by, (d.l || []).map(x => [x.k, x.i, x.n, x.q, x.pk, x.g]), Object.entries(d.gn || {}).sort()]);   // Firestore map ki tarteeb badal deta hai — is liye qatar

if (require.main === module) main();
module.exports = { build, hashOf, dayOf, isFarqName, ptOf };
// post ka waqt: pehli dafa posted dekha = abhi · posted hi raha = purana · un-posted = 0
function ptOf(old, ps, now) { return ps !== 2 ? 0 : old && old.ps === 2 && old.pt ? old.pt : now; }

function main() {
  const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = path.join(DIR, 'gate-pass.alive'), w = () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();
  const sql = require('mssql');
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const SQL_CONFIG = require('./sql-config.js');
  SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
  if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
  const db = getFirestore(), GP = db.collection('businesses').doc(BUSINESS_ID).collection('gatePass');
  let pool = null;
  const getPool = async () => { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; };
  let names = {}, namesAt = 0;
  async function loadNames(p) {
    if (Date.now() - namesAt < NAMES_EVERY && Object.keys(names).length) return;
    try { const m = {}; (await p.request().query('SELECT BranchID, BranchName FROM dbo.Branch')).recordset.forEach(x => { m[Number(x.BranchID)] = String(x.BranchName || '').trim(); }); names = m; } catch (e) { log('Branch naam: ' + e.message); }
    namesAt = Date.now();
  }
  const known = new Map();   // SaleID -> {h, pt, off} (aaj + kal)
  let lastKey = '', lastFull = 0, winDay = '';
  async function boot() {   // pehle se likhe docs (post ka waqt + off) — dobara shuru par sab dobara na likhe
    const y = new Date(); y.setDate(y.getDate() - 1);
    const sn = await GP.where('day', '>=', dayOf(y)).get();
    sn.forEach(d => { const x = d.data() || {}; known.set(Number(d.id), { h: x.off ? '' : hashOf(x), pt: Number(x.pt) || 0, ps: Number(x.ps) === 1 ? 1 : 2, off: x.off ? 1 : 0, day: String(x.day || '') }); });
    log(`🚪 gate-pass v1.1 shuru — pehle se ${known.size} gate pass (aaj + kal) · har ${EVERY / 1000} sec POS ke bills (🔵 un-posted + 🔴 posted) dekhta hai`);
  }
  async function once() {
    const p = await getPool();
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - 1);   // aaj + kal (raat 12 ke paas bana bill subah post ho)
    if (winDay !== dayOf(d0)) { winDay = dayOf(d0); for (const [id, v] of known) if ((v.day || '') && v.day < winDay) known.delete(id); lastKey = ''; }
    const k = (await p.request().input('a', sql.DateTime, d0).query(`SELECT k.C, k.S, k.U, dd.DC, dd.DM, dd.DQ, dd.DG FROM
      (SELECT COUNT(*) AS C, SUM(CAST(SaleID AS BIGINT) * DocStatusID) AS S, MAX(UpdatedOn) AS U FROM dbo.Sale WHERE SaleDate >= @a AND DocStatusID IN (1, 2)) k
      CROSS JOIN (SELECT COUNT(*) AS DC, MAX(d.SaleDetailID) AS DM, SUM(CAST(d.Qty AS FLOAT)) AS DQ, SUM(CAST(ISNULL(d.GBranchID, 0) AS BIGINT)) AS DG
        FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID WHERE s.SaleDate >= @a AND s.DocStatusID IN (1, 2)) dd`)).recordset[0] || {};   // v1.1: scan ki nayi line bhi
    const key = `${winDay}|${k.C}|${k.S}|${k.U ? new Date(k.U).getTime() : 0}|${k.DC}|${k.DM}|${Math.round((Number(k.DQ) || 0) * 1000)}|${k.DG}`;
    if (key === lastKey && Date.now() - lastFull < FULL_EVERY) return;
    const t0 = Date.now();
    await loadNames(p);
    const rows = (await p.request().input('a', sql.DateTime, d0).query(`
      SELECT s.SaleID, s.SaleNo, s.SaleDate, s.BranchID, s.DocStatusID, pt.PartyName, CAST(s.SystemNotes AS NVARCHAR(400)) AS SN,
             d.ItemID, i.ItemName, i.PackQty, d.Qty, ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) AS G
      FROM dbo.Sale s JOIN dbo.SaleDetail d ON d.SaleID = s.SaleID JOIN dbo.Items i ON i.ItemID = d.ItemID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
      WHERE s.SaleDate >= @a AND s.DocStatusID IN (1, 2) AND ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) <> s.BranchID
      ORDER BY s.SaleID, d.SaleDetailID`)).recordset;
    const qm = Date.now() - t0, now = Date.now(), B = build(rows, names, pcNames());
    let batch = db.batch(), n = 0, nw = 0, noff = 0;
    const put = async (id, data) => { batch.set(GP.doc(String(id)), data, { merge: true }); if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; } };
    for (const [id, d] of B) {
      const old = known.get(id), h = hashOf(d);
      if (old && old.h === h && !old.off) continue;
      const pt = ptOf(old, d.ps, now);   // pehli dafa posted dekha = post ka waqt
      await put(id, { ...d, pt, off: 0, at: now }); known.set(id, { h, pt, ps: d.ps, off: 0, day: d.day }); nw++;
    }
    for (const [id, v] of known) if (!B.has(id) && !v.off) { await put(id, { off: 1, at: now }); v.off = 1; v.h = ''; noff++; }   // cancel / delete / godam line hati
    if (n) await batch.commit();
    lastKey = key; lastFull = Date.now();
    if (nw || noff) log(`🚪 ${nw ? nw + ' gate pass app mein' : ''}${nw && noff ? ' · ' : ''}${noff ? noff + ' ❌ (cancel / delete)' : ''} · parha ${qm} ms · kul ${Date.now() - t0} ms`);
  }
  const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
  lock.on('error', () => { console.log('gate-pass pehle se chal raha hai — yeh copy band.'); process.exit(3); });
  lock.on('listening', async () => {
    try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
    try { await boot(); } catch (e) { log('Pehle ke gate pass: ' + e.message); }
    let running = false;
    const tick = async () => { if (running) return; running = true;
      try { await once(); } catch (e) { log('⚠️ ' + (e.message || e)); try { pool?.close(); } catch {} pool = null; if (e.code === 16 || /UNAUTHENTICATED/.test(String(e.message))) process.exit(1); }
      finally { running = false; } };
    await tick();
    setInterval(ZINDA.guard(tick, 5 * 60000, 'gate pass tick'), EVERY);
  });
}
