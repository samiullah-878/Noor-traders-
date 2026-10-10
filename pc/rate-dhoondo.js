// =========================================================
//  rate-dhoondo.js  v1 (2026-10-10) — EK ITEM ke RATE kahan kya hain? SIRF PARHTA HAI, kuch nahi badalta.
//  Chalana (rate-check.ps1 khud chalata hai):  node rate-dhoondo.js NAILS     (naam ka hissa ya barcode)
//  1) POS item master (dbo.Items)            — SaleRate / SaleRate2 / SaleRate3 / SaleRateSize / PurchaseRate / PackQty
//  2) POS har branch (dbo.ItemBranchRate)     — wohi rate har godam ke (NOOR TRADERS = branch 1) + stock
//  3) POS aakhri 3 purchase (dbo.PurchaseDetail) ka rate
//  4) App ko POS se kya mila (Firestore posStock, sync-stock likhta hai) + kab
//  5) App ki yaad (blueAccess/itemRates — app se pichhli purchase ke rate)
//  Malik: "purchase card par 'pehle' wala rate ghalat batata hai". SQL password / chaabi kabhi nahi chhapta.
// =========================================================
const path = require('path');
const fs = require('fs');
const DIR = __dirname;
const Q = String(process.argv.slice(2).join(' ') || '').trim();
if (!Q) { console.log('Item ka naam ya barcode do: node rate-dhoondo.js NAILS'); process.exit(1); }
const say = (...a) => console.log(...a);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const f = n => (n == null || n === '' ? '-' : String(r2(n)));
const t = ms => { const d = new Date(Number(ms) || 0); return !Number(ms) || isNaN(d) ? '-' : d.toLocaleString('en-GB', { hour12: true }); };
const found = [];

async function pos() {
  let sql, cfg;
  try { sql = require('mssql'); cfg = require('./sql-config.js'); } catch (e) { say('  POS: mssql / sql-config nahi mila — ' + e.message); return; }
  cfg.options = { ...(cfg.options || {}), useUTC: false };
  let p;
  try { p = await new sql.ConnectionPool(cfg).connect(); } catch (e) { say('  POS se rabta nahi: ' + e.message); return; }
  try {
    const items = (await p.request().input('q', sql.VarChar(120), '%' + Q + '%').input('c', sql.VarChar(60), Q).query(
      `SELECT TOP 5 ItemID, ItemName, LTRIM(RTRIM(ItemCode)) AS Code, PackQty, SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate
       FROM dbo.Items WHERE LTRIM(RTRIM(ItemCode)) = @c OR ItemName LIKE @q ORDER BY CASE WHEN LTRIM(RTRIM(ItemCode)) = @c THEN 0 ELSE 1 END, LEN(ItemName)`)).recordset;
    if (!items.length) { say('  POS mein "' + Q + '" naam / barcode ka koi item nahi mila.'); return; }
    const bn = {}; try { (await p.request().query('SELECT BranchID, BranchName FROM dbo.Branch')).recordset.forEach(x => { bn[x.BranchID] = String(x.BranchName || '').trim(); }); } catch {}
    for (const it of items) {
      found.push(it);
      say('');
      say(`■ ${String(it.ItemName).trim()}  (ID ${it.ItemID} · barcode ${it.Code || '-'} · 1 ctn = ${f(it.PackQty)})`);
      say(`  1) POS ITEM MASTER : R ctn÷pack (SaleRate) ${f(it.SaleRate)} · R piece (SaleRate2) ${f(it.SaleRate2)} · W (SaleRate3) ${f(it.SaleRate3)} · W piece (SaleRateSize) ${f(it.SaleRateSize)} · Khareed ${f(it.PurchaseRate)}`);
      const br = (await p.request().input('i', sql.Int, it.ItemID).query(
        'SELECT BranchID, SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate, CurrStock FROM dbo.ItemBranchRate WHERE ItemID = @i ORDER BY BranchID')).recordset;
      for (const b of br) say(`  2) POS ${(bn[b.BranchID] || 'Branch ' + b.BranchID).padEnd(14)}: R ${f(b.SaleRate)} · R piece ${f(b.SaleRate2)} · W ${f(b.SaleRate3)} · W piece ${f(b.SaleRateSize)} · Khareed ${f(b.PurchaseRate)} · stock ${f(b.CurrStock)}`);
      const b1 = br.find(b => b.BranchID === 1);
      if (b1) {
        const d = (a, b) => Number(a) > 0 && Number(b) > 0 && Math.abs(Number(a) - Number(b)) > 0.004;
        if (d(it.SaleRate, b1.SaleRate) || d(it.SaleRate2, b1.SaleRate2) || d(it.SaleRate3, b1.SaleRate3) || d(it.PurchaseRate, b1.PurchaseRate))
          say('     ⚠️ POS ke ANDAR do jagah alag rate: item master vs NOOR TRADERS (branch 1). App branch 1 wala leti hai.');
      }
      try {
        const pu = (await p.request().input('i', sql.Int, it.ItemID).query(
          `SELECT TOP 3 d.Rate, d.Qty, h.PurchaseNo, h.PurchaseDate FROM dbo.PurchaseDetail d LEFT JOIN dbo.Purchase h ON h.PurchaseID = d.PurchaseID
           WHERE d.ItemID = @i ORDER BY d.PurchaseDetailID DESC`)).recordset;
        for (const x of pu) say(`  3) POS purchase ${String(x.PurchaseNo || '').trim() || '-'} · ${x.PurchaseDate ? new Date(x.PurchaseDate).toLocaleDateString('en-GB') : '-'} · rate ${f(x.Rate)} · qty ${f(x.Qty)}`);
        if (!pu.length) say('  3) POS mein is item ki koi purchase nahi');
      } catch (e) { say('  3) purchase nahi parh saka: ' + e.message); }
    }
  } catch (e) { say('  POS sawal mein masla: ' + e.message); }
  finally { try { await p.close(); } catch {} }
}

async function app() {
  const KEY = path.join(DIR, 'firebase-key.json');
  if (!fs.existsSync(KEY)) { say('  (is PC par firebase-key nahi — app wali jaanch chhor di)'); return; }
  if (!found.length) return;
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require(KEY)) });
    const biz = getFirestore().collection('businesses').doc('noor-traders');
    const snap = await biz.collection('posStock').where('branch', '==', 1).get();
    let meta = null; const byId = new Map();
    snap.forEach(d => { const x = d.data(); if (x.meta) meta = x; else for (const it of x.items || []) byId.set(String(it.id), it); });
    let mem = {}; try { const m = await biz.collection('blueAccess').doc('itemRates').get(); mem = (m.exists && m.data().map) || {}; } catch {}
    say('');
    say(`  App ko POS se aakhri tabdeeli: ${t(meta?.syncedAt)} (sync-stock kuch badle to likhta hai, warna ghante mein ek dafa)`);
    for (const it of found) {
      const a = byId.get(String(it.ItemID)), m = mem[String(it.ItemID)];
      say(`■ ${String(it.ItemName).trim()}`);
      say(a ? `  4) APP (POS se)    : R ${f(a.rate)} · R piece ${f(a.rate2 ?? a.rate)} · W ${f(a.wrate)} · W piece ${f(a.ws ?? a.wrate)} · Khareed ${f(a.prate)} · pack ${f(a.pack)}`
            : '  4) APP (POS se)    : NOOR TRADERS ki list mein yeh item nahi (stock 0 / band?)');
      say(m ? `  5) APP KI YAAD      : Khareed ${f(m.c)} · W piece ${f(m.w)} · W ctn ${f(m.wc)} · R piece ${f(m.r)} · R ctn ${f(m.rc)} · kab ${t(m.t)}`
            : '  5) APP KI YAAD      : koi nahi (app se is ki purchase nahi hui)');
    }
  } catch (e) { say('  App (Firestore) parhne mein masla: ' + e.message); }
}

(async () => {
  say('POS (SQL Server):'); await pos();
  say(''); say('App (Firestore):'); await app();
  say(''); say('Matlab: purchase card ka "pehle" ab (v2.99.16 se) 2) NOOR TRADERS wala hona chahiye = 4) APP (POS se).');
  process.exit(0);
})();
