// =====================================================================================================
//  sale-farq-check.js  v1.0 (2026-10-15) — 🔎 POS ki sale vs app (Daily Sale) ka FARQ — sirf PARHTA hai (POS / Firebase mein kuch nahi likhta)
//  Malik: "POS ki sale mein 3000 ka farq hai jo app par hai aur jo wahan report mein hai — aik dafa ye dekho".
//  App (pos-sales-dekho.js saleSum) = cash bill poora + wholesale bill poora + udhaar bill ka sirf mila cash (CashReceived / CRV);
//  cancel (DocStatusID 3) aur "stock fraq" party bahar. POS ki report = shayad poore bill (udhaar bhi) aur Sale Return minus.
//  Ye script us din ke saare hisse alag dikhata hai + (agar POS report ki raqam di) batata hai farq kis hisse se bana.
//  Saath mein dbo.SaleReturn / SaleReturnDetail ke khane (columns) bhi — wapsi ko reports mein ghatane ke liye.
//  Chalana:  node sale-farq-check.js                -> aaj
//            node sale-farq-check.js kal            -> kal
//            node sale-farq-check.js 2026-10-15 125430   -> us din, aur POS report wali raqam (farq dhoondne ke liye)
//  SQL password kabhi print nahi hota.
// =====================================================================================================
const path = require('path');
const sql = require('mssql');
const cfg = require('./sql-config.js');
cfg.options = { ...(cfg.options || {}), useUTC: false };
const p2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const rs = n => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US');
const isFarqName = n => /stock\s*['"]?\s*f[ae]?r?a?q/i.test(String(n || ''));
const isWsName = n => /whole\s*sale/i.test(String(n || ''));
const isInside = n => /noor\s*trader|our\s*factory/i.test(String(n || ''));

const a1 = String(process.argv[2] || '').trim().toLowerCase();
const now = new Date();
let day = dayOf(now);
if (a1 === 'kal') { const d = new Date(now); d.setDate(d.getDate() - 1); day = dayOf(d); }
else if (/^\d{4}-\d{2}-\d{2}$/.test(a1)) day = a1;
const posReport = Number(String(process.argv[3] || '').replace(/[^\d.\-]/g, '')) || 0;
const d0 = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)), d1 = new Date(d0); d1.setDate(d1.getDate() + 1);

(async () => {
  const pool = await new sql.ConnectionPool(cfg).connect();
  const rows = (await pool.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT s.SaleID, s.SaleNo, s.TotalSale, s.CashReceived, s.IsCreditSale, s.DocStatusID, pt.PartyName
    FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID WHERE s.SaleDate >= @a AND s.SaleDate < @b`)).recordset;
  const crv = new Map();
  try {
    const r = (await pool.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
      SELECT v.DocumentNo AS SaleID, SUM(CAST(d.Debit AS FLOAT)) AS Cash FROM dbo.Voucher v JOIN dbo.VoucherDetail d ON d.VoucherID = v.VoucherID
      JOIN dbo.Sale s ON s.SaleID = v.DocumentNo AND s.PartyID = v.PartyID
      WHERE v.VoucherType = 'CRV' AND ISNULL(v.DocumentNo, 0) > 0 AND ISNULL(v.VoucherStatusID, 1) <> 3 AND d.Debit > 0
        AND s.SaleDate >= @a AND s.SaleDate < @b AND s.IsCreditSale = 1 GROUP BY v.DocumentNo`)).recordset;
    for (const x of r) crv.set(Number(x.SaleID), Number(x.Cash) || 0);
  } catch (e) { console.log('(CRV nahi parhe: ' + e.message + ')'); }

  const H = { all: 0, n: 0, cx: 0, cxRs: 0, fq: 0, fqRs: 0, inside: 0, insideRs: 0, cashB: 0, cashRs: 0, ws: 0, wsRs: 0, cr: 0, crRs: 0, crPaid: 0, app: 0 };
  const crList = [];
  for (const r of rows) {
    const t = Number(r.TotalSale) || 0;
    if (Number(r.DocStatusID) === 3) { H.cx++; H.cxRs += t; continue; }
    H.all += t; H.n++;
    if (isInside(r.PartyName)) { H.inside++; H.insideRs += t; }
    if (isFarqName(r.PartyName)) { H.fq++; H.fqRs += t; continue; }
    const c = Number(r.CashReceived) || 0, v = Number(crv.get(Number(r.SaleID))) || 0;
    if (isWsName(r.PartyName)) { H.ws++; H.wsRs += t; H.app += t; continue; }
    if (r.IsCreditSale) { const paid = Math.max(0, Math.min(Math.max(c, v), t)); H.cr++; H.crRs += t; H.crPaid += paid; H.app += paid; if (t - paid > 0.5) crList.push([String(r.SaleNo || r.SaleID).trim(), String(r.PartyName || '').trim(), t, paid]); continue; }
    H.cashB++; H.cashRs += t; H.app += t;
  }
  // ↩ Sale Return
  let ret = { n: 0, rs: 0, fqRs: 0, ok: false, cols: [], dcols: [], list: [] };
  try {
    const cols = (await pool.request().query(`SELECT TABLE_NAME AS T, COLUMN_NAME AS C FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('SaleReturn','SaleReturnDetail') ORDER BY TABLE_NAME, ORDINAL_POSITION`)).recordset;
    ret.cols = cols.filter(x => x.T === 'SaleReturn').map(x => x.C); ret.dcols = cols.filter(x => x.T === 'SaleReturnDetail').map(x => x.C);
    const r = (await pool.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
      SELECT r.SaleReturnID, r.SaleReturnNo, r.SaleID, CAST(r.TotalSaleReturn AS FLOAT) AS T, r.DocStatusID, pt.PartyName
      FROM dbo.SaleReturn r LEFT JOIN dbo.Party pt ON pt.PartyID = r.PartyID WHERE r.SaleReturnDate >= @a AND r.SaleReturnDate < @b`)).recordset;
    for (const x of r) { if (Number(x.DocStatusID) === 3) continue; const t = Number(x.T) || 0; if (isFarqName(x.PartyName)) { ret.fqRs += t; continue; } ret.n++; ret.rs += t; ret.list.push([String(x.SaleReturnNo || x.SaleReturnID).trim(), String(x.PartyName || '').trim(), t, Number(x.SaleID) || 0]); }
    ret.ok = true;
  } catch (e) { console.log('(Sale Return nahi parhe: ' + e.message + ')'); }
  // app ki likhi raqam (Firestore possale-<din>)
  let appFs = null;
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app'); const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require(path.join(__dirname, 'firebase-key.json'))) });
    const d = await getFirestore().collection('businesses').doc('noor-traders').collection('blueKhata').doc('possale-' + day).get();
    if (d.exists) appFs = (Number(d.data().amount) || 0) / 100;
  } catch {}

  const L = (a, b) => console.log('  ' + String(a).padEnd(40, ' ') + b);
  console.log(`\n================  ${day} — POS SALE vs APP  ================`);
  L('POS bill (cancel ke baghair):', `${H.n} bill · ${rs(H.all)}`);
  L('  - cash bill:', `${H.cashB} · ${rs(H.cashRs)}`);
  L('  - wholesale bill (app mein POORA):', `${H.ws} · ${rs(H.wsRs)}`);
  L('  - udhaar bill:', `${H.cr} · ${rs(H.crRs)}  (cash mila ${rs(H.crPaid)})`);
  L('  - "stock fraq" bill (app mein NAHI):', `${H.fq} · ${rs(H.fqRs)}`);
  L('  - (andar: noor traders / our factory):', `${H.inside} · ${rs(H.insideRs)}  (dono mein gine)`);
  L('Cancel bill (dono mein NAHI):', `${H.cx} · ${rs(H.cxRs)}`);
  L('↩ Sale Return (stock fraq ke ilawa):', ret.ok ? `${ret.n} · ${rs(ret.rs)}${ret.fqRs ? '  (+ stock fraq wapsi ' + rs(ret.fqRs) + ')' : ''}` : 'nahi parhi');
  console.log('  ----------------------------------------------------------------');
  L('APP ki raqam (hisaab se):', rs(H.app));
  if (appFs != null) L('APP mein likhi hui (Daily Sale):', rs(appFs) + (Math.abs(appFs - H.app) > 1 ? '  <- abhi update nahi hui (1-5 min)' : ''));
  const udBaqi = H.crRs - H.crPaid;
  const parts = [['udhaar bill ka baqi (cash nahi mila)', udBaqi], ['"stock fraq" bill', H.fqRs], ['Sale Return (minus)', -ret.rs]];
  console.log('\n  POS ke mumkin hisaab:');
  L('  Total (sab bill)', rs(H.all) + '   farq app se: ' + rs(H.all - H.app));
  L('  Total − Return', rs(H.all - ret.rs) + '   farq app se: ' + rs(H.all - ret.rs - H.app));
  L('  Total − stock fraq', rs(H.all - H.fqRs) + '   farq app se: ' + rs(H.all - H.fqRs - H.app));
  L('  Total − stock fraq − Return', rs(H.all - H.fqRs - ret.rs) + '   farq app se: ' + rs(H.all - H.fqRs - ret.rs - H.app));
  if (posReport) {
    const want = posReport - H.app; console.log(`\n  POS report ki raqam ${rs(posReport)} — app se farq ${rs(want)}. Kis hisse se bana:`);
    const hits = [];
    for (let m = 1; m < 8; m++) { const pick = parts.filter((_, i) => m & (1 << i)); const s = pick.reduce((x, y) => x + y[1], 0); if (Math.abs(s - want) <= 5) hits.push(pick.map(x => x[0]).join(' + ') + ' = ' + rs(s)); }
    if (hits.length) hits.forEach(h => console.log('   ✓ ' + h)); else console.log('   ✗ koi seedha jor nahi mila — neeche ki list ki tasveer bhejein');
  }
  if (crList.length) { console.log('\n  Udhaar bill jin ka poora cash nahi mila:'); crList.slice(0, 25).forEach(([n, p, t, c]) => L('   #' + n + ' ' + p.slice(0, 24), `${rs(t)}  (mila ${rs(c)}, baqi ${rs(t - c)})`)); }
  if (ret.list.length) { console.log('\n  Sale Return:'); ret.list.slice(0, 25).forEach(([n, p, t, s]) => L('   #' + n + ' ' + p.slice(0, 24), `${rs(t)}${s ? '  (bill ' + s + ')' : ''}`)); }
  console.log('\n  SaleReturn khane: ' + (ret.cols.join(', ') || '—'));
  console.log('  SaleReturnDetail khane: ' + (ret.dcols.join(', ') || '—'));
  console.log('\nIs screen ki tasveer bhejein (POS ki us din ki Sale report ki tasveer bhi). Kuch likha / badla NAHI gaya.');
  await pool.close(); process.exit(0);
})().catch(e => { console.log('Masla: ' + e.message); process.exit(1); });
