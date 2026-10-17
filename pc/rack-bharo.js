// =========================================================
//  rack-bharo.js  v1.0 (2026-10-18) — 🧺 RACK BHARO: dukan (branch 1) ka maal jitna bika, utna godam se poore carton mein wapas
//  Malik: "rack par carton hi lagay to faida — open stock godam se nahi aata. Noor Traders ka pichhla data dekh kar: jab jab transfer
//          note bana, us ke baad jitna bika — jaise hi ek carton jitna bik jaye to Transfer notes screen par aa jaye, ek click mein print"
//          · "data har 1-2 minute".
//  Har item: AAKHRI transfer (godam -> dukan, 180 din) ka waqt + kis godam se + pichhle 5 transfer ki miqdaar (sirf pieces wale item ka
//  "ek dafa kitna aata hai"). Us waqt ke baad DUKAN se bika (SaleDetail.GBranchID, warna Sale.BranchID = 1; cancel nahi).
//  Firestore posStats/rack { at, h, j: JSON [{i, n, pk, g, gs, ss, w, s, m}] } — sirf jin ki bikri > 0 aur godam mein stock > 0.
//  App (Transfer screen 🧺) qaida lagati hai: carton wala = pk pcs bike; pieces wala = m (median); malik ka ✏️ stockConfig.rack.
//  SQL mein KUCH NAHI likhta — sirf SELECT. Badla na ho to Firestore mein nahi likhta (10 min mein ek dafa 'at').
// =========================================================
const sql = require('mssql');
const crypto = require('crypto');
const SQL_CONFIG = { ...require('./sql-config.js') };
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
const SHOP = 1, DAYS = 180;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const med = a => { const s = a.filter(x => x > 0).sort((x, y) => x - y); if (!s.length) return 0; const k = s.length >> 1; return s.length % 2 ? s[k] : r3((s[k - 1] + s[k]) / 2); };
const sqlDt = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

async function read(p, now = new Date()) {
  const since = new Date(now); since.setDate(since.getDate() - DAYS);
  const tr = (await p.request().input('a', sql.DateTime, since).query(`
    SELECT d.ItemID, t.FromBranchID AS F, ISNULL(t.CreatedOn, t.TransferDate) AS W, d.Qty
    FROM dbo.StockTransferDetail d JOIN dbo.StockTransfer t ON t.TransferID = d.TransferID
    WHERE t.ToBranchID = ${SHOP} AND t.FromBranchID <> ${SHOP} AND t.TransferDate >= @a AND d.Qty > 0
    ORDER BY ISNULL(t.CreatedOn, t.TransferDate) DESC, t.TransferID DESC`)).recordset;
  const last = new Map();   // ItemID -> {g, w, qs[]}
  for (const r of tr) { const id = Number(r.ItemID); if (!Number.isFinite(id)) continue; const w = new Date(r.W);
    const o = last.get(id); if (!o) last.set(id, { g: Number(r.F), w, qs: [Number(r.Qty) || 0] }); else if (o.qs.length < 5) o.qs.push(Number(r.Qty) || 0); }
  if (!last.size) return [];
  const ids = [...last.keys()], sold = new Map();
  for (let k = 0; k < ids.length; k += 800) {   // har item apne aakhri transfer ke baad se
    const vals = ids.slice(k, k + 800).map(id => `(${Math.trunc(id)}, '${sqlDt(last.get(id).w)}')`).join(',');
    const rs = (await p.request().query(`
      SELECT v.ItemID, SUM(d.Qty) AS q FROM (VALUES ${vals}) v(ItemID, W)
      JOIN dbo.SaleDetail d ON d.ItemID = v.ItemID JOIN dbo.Sale s ON s.SaleID = d.SaleID
      WHERE s.SaleDate >= CAST(v.W AS DATETIME) AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) = ${SHOP}
      GROUP BY v.ItemID`)).recordset;
    for (const r of rs) sold.set(Number(r.ItemID), Number(r.q) || 0);
  }
  const want = ids.filter(id => (sold.get(id) || 0) > 0); if (!want.length) return [];
  const out = [];
  for (let k = 0; k < want.length; k += 800) {
    const part = want.slice(k, k + 800);
    const rs = (await p.request().query(`SELECT i.ItemID, i.ItemName, ISNULL(i.PackQty, 0) AS Pack, r.BranchID, ISNULL(r.CurrStock, 0) AS St
      FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID WHERE i.ItemID IN (${part.join(',')})`)).recordset;
    const by = new Map(); for (const r of rs) { const id = Number(r.ItemID); if (!by.has(id)) by.set(id, { n: String(r.ItemName || '').trim().slice(0, 70), pk: Number(r.Pack) || 0, st: {} }); if (r.BranchID != null) by.get(id).st[Number(r.BranchID)] = Number(r.St) || 0; }
    for (const id of part) { const L = last.get(id), I = by.get(id); if (!I) continue; const gs = I.st[L.g] || 0; if (!(gs > 0)) continue;
      out.push({ i: id, n: I.n, pk: I.pk, g: L.g, gs: r3(gs), ss: r3(I.st[SHOP] || 0), w: L.w.getTime(), s: r3(sold.get(id)), m: med(L.qs) }); }
  }
  return out.sort((a, b) => a.n.localeCompare(b.n));
}
module.exports = { read, med };

if (require.main === module) (async () => {
  let pool; const t0 = Date.now();
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
    pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    const rows = await read(pool); await pool.close(); pool = null;
    const ref = getFirestore().collection('businesses').doc('noor-traders').collection('posStats').doc('rack');
    const j = JSON.stringify(rows), h = crypto.createHash('sha1').update(j).digest('hex');
    let old = null; try { const o = await ref.get(); old = o.exists ? o.data() : null; } catch {}
    if (old && old.h === h && Date.now() - (Number(old.at) || 0) < 10 * 60000) { console.log(new Date().toLocaleString('en-PK') + ' — 🧺 wahi (' + rows.length + ')'); process.exit(0); }
    await ref.set({ at: Date.now(), h, n: rows.length, j });
    console.log(new Date().toLocaleString('en-PK') + ' — 🧺 rack: ' + rows.length + ' items (bike + godam mein), ' + Math.round((Date.now() - t0) / 1000) + 's');
    process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
