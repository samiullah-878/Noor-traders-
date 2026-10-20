// =========================================================
//  rack-bharo.js  v1.7 (2026-10-20: 🏬 WHOLESALE ki sale 'bika' mein NAHI — malik: 'is mein wholesale ki sale add na karo' (wholesale maal rack se nahi jata). Party naam blueAccess/reportConfig.wsNames + 'whole sale' — item-report jaisa; lane (sold) aur packet (sold[z]) dono) · v1.6 (2026-10-19: 🧾 stock fraq / ginti farq ke sale bill 'bika' mein nahi gine) · v1.5 (2026-10-18: 📤 NIKLA = aakhri aamad ke baad dukan se bika (s) + WAPAS godam gaya (o: transfer dukan -> godam) − seedha dukan
//                  par purchase (p) — malik ka asal qaida: 'maal aane par rack bhara, jitna nikla 1 carton ho to lao'. Row: o, p. lo ab sirf
//                  candidate (dukan stock < 1 carton) — app malik ki hadd chip (rackLo) se faisla) · v1.4 (2026-10-18: 🟠 lo = rack KAM: dukan par bikta (180 din) aur dukan stock 1 carton se kam -> row bhejo
//                  (Clear shampoo 400ml: 12 pcs dukan se WAPAS Godam 1 gaye, phir 10 bike = 2 bache, list mein nahi aaya tha) · godam: aakhri
//                  transfer wale godam mein 0 ho to jis godam mein sab se zyada maal) · v1.3 (2026-10-18: ⚠️ z = carton pcs 0 wale items (POS 'Divide by zero' bill rok deta hai) — jo 30 din mein bike ya dukan mein stock; sirf parhna) · v1.2 (2026-10-18: 📦 PACKET-WAR (Godam 2) — malik ke chune items (stockConfig.rackPk {id: JSON {g, at, p: {q: {n, a}}}}):
//                  dukan ki har sale LINE ki miqdaar = kaun sa packet (0.250 = 250 gm, 0.050 = ilaichi) — shuru = max(at, aakhri transfer) -> pj) · v1.1 (2026-10-18: fc = hamesha poore carton aaya? (warna pcs wala — masale) · k = 🔴 rack khali: dukan stock <= 0, godam mein maal,
//                  aur 180 din mein DUKAN par kabhi bika (godam wala ata / maida kabhi nahi)) · v1.0 (2026-10-18) — 🧺 RACK BHARO: dukan (branch 1) ka maal jitna bika, utna godam se poore carton mein wapas
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
// v1.6: ginti farq ke bill (party "stock fraq" / Description "Stock ginti farq") asal bikri nahi
const NOFQ = "AND ISNULL(CAST(s.Description AS NVARCHAR(200)), '') NOT LIKE 'Stock ginti farq%' AND ISNULL(s.PartyID, -2) NOT IN (SELECT PartyID FROM dbo.Party WHERE LOWER(PartyName) LIKE '%stock%fraq%' OR LOWER(PartyName) LIKE '%stock%farq%')";
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
// v1.7: wholesale parties ki sale rack ke 'bika' mein nahi — reportConfig.wsNames (+ 'whole sale'); SQL fragment (main() mein set)
let NOWS = "AND ISNULL(s.PartyID, -2) NOT IN (SELECT PartyID FROM dbo.Party WHERE LOWER(PartyName) LIKE '%whole%sale%')";
function setWs(names) { const esc = x => String(x || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); const L = ['whole sale', ...(Array.isArray(names) ? names.flat(3) : [])].map(esc).filter(x => x.length >= 3);
  NOWS = "AND ISNULL(s.PartyID, -2) NOT IN (SELECT PartyID FROM dbo.Party WHERE " + [...new Set(L)].map(n => `LOWER(PartyName) LIKE '%${n.replace(/ /g, '%')}%'`).join(' OR ') + ")"; }
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
  const ids = [...last.keys()], sold = new Map(), outQ = new Map(), purQ = new Map();
  for (let k = 0; k < ids.length; k += 800) {   // har item apne aakhri transfer ke baad se
    const vals = ids.slice(k, k + 800).map(id => `(${Math.trunc(id)}, '${sqlDt(last.get(id).w)}')`).join(',');
    const rs = (await p.request().query(`
      SELECT v.ItemID, SUM(d.Qty) AS q FROM (VALUES ${vals}) v(ItemID, W)
      JOIN dbo.SaleDetail d ON d.ItemID = v.ItemID JOIN dbo.Sale s ON s.SaleID = d.SaleID
      WHERE s.SaleDate >= CAST(v.W AS DATETIME) AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) = ${SHOP} ${NOFQ} ${NOWS}
      GROUP BY v.ItemID`)).recordset;
    for (const r of rs) sold.set(Number(r.ItemID), Number(r.q) || 0);
    // v1.5: 📤 wapas godam (dukan -> kahin aur) + 🛒 seedha dukan par purchase — aakhri aamad ke baad
    const ro = (await p.request().query(`
      SELECT v.ItemID, SUM(d.Qty) AS q FROM (VALUES ${vals}) v(ItemID, W)
      JOIN dbo.StockTransferDetail d ON d.ItemID = v.ItemID JOIN dbo.StockTransfer t ON t.TransferID = d.TransferID
      WHERE ISNULL(t.CreatedOn, t.TransferDate) > CAST(v.W AS DATETIME) AND t.FromBranchID = ${SHOP} AND t.ToBranchID <> ${SHOP} AND d.Qty > 0
      GROUP BY v.ItemID`)).recordset;
    for (const r of ro) outQ.set(Number(r.ItemID), Number(r.q) || 0);
    const rp = (await p.request().query(`
      SELECT v.ItemID, SUM(d.Qty + ISNULL(d.Bonus, 0)) AS q FROM (VALUES ${vals}) v(ItemID, W)
      JOIN dbo.PurchaseDetail d ON d.ItemID = v.ItemID JOIN dbo.Purchase pu ON pu.PurchaseID = d.PurchaseID
      WHERE pu.PurchaseDate >= CAST(v.W AS DATETIME) AND ISNULL(pu.DocStatusID, 0) <> 3 AND ISNULL(NULLIF(d.GBranchID, 0), pu.BranchID) = ${SHOP}
      GROUP BY v.ItemID`)).recordset;
    for (const r of rp) purQ.set(Number(r.ItemID), Number(r.q) || 0);
  }
  // v1.1: 🔴 rack khali — 180 din mein dukan par bike items (ata / maida jaisa sirf godam wala maal yahan nahi aata)
  const ever = new Set((await p.request().input('a', sql.DateTime, since).query(`SELECT DISTINCT d.ItemID FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
    WHERE s.SaleDate >= @a AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) = ${SHOP} ${NOFQ}`)).recordset.map(r => Number(r.ItemID)).filter(Number.isFinite));
  const want = [...new Set([...ids.filter(id => (sold.get(id) || 0) > 0), ...ever])]; if (!want.length) return [];
  const out = [];
  for (let k = 0; k < want.length; k += 800) {
    const part = want.slice(k, k + 800);
    const rs = (await p.request().query(`SELECT i.ItemID, i.ItemName, ISNULL(i.PackQty, 0) AS Pack, r.BranchID, ISNULL(r.CurrStock, 0) AS St
      FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID WHERE i.ItemID IN (${part.join(',')})`)).recordset;
    const by = new Map(); for (const r of rs) { const id = Number(r.ItemID); if (!by.has(id)) by.set(id, { n: String(r.ItemName || '').trim().slice(0, 70), pk: Number(r.Pack) || 0, st: {} }); if (r.BranchID != null) by.get(id).st[Number(r.BranchID)] = Number(r.St) || 0; }
    for (const id of part) { const L = last.get(id), I = by.get(id); if (!I) continue; const ss = I.st[SHOP] || 0, o0 = outQ.get(id) || 0, p0 = purQ.get(id) || 0, s0 = sold.get(id) || 0, nik = s0 + o0 - p0, khali = ever.has(id) && ss <= 0, lo = !khali && ever.has(id) && I.pk > 1 && ss < I.pk;
      if (!(nik > 0) && !khali && !lo) continue;
      const best = Number(Object.entries(I.st).filter(([b, v]) => Number(b) !== SHOP && v > 0).sort((a, b) => b[1] - a[1])[0]?.[0]) || 0;
      const g = L && (I.st[L.g] || 0) > 0 ? L.g : best, gs = I.st[g] || 0; if (!g || !(gs > 0)) continue;
      const fc = !L || !(I.pk > 1) ? 1 : (L.qs.every(q => Math.abs(q / I.pk - Math.round(q / I.pk)) < 1e-6) ? 1 : 0);
      out.push({ i: id, n: I.n, pk: I.pk, g, gs: r3(gs), ss: r3(ss), w: L ? L.w.getTime() : 0, s: r3(s0), m: L ? med(L.qs) : 0, fc, ...(o0 ? { o: r3(o0) } : {}), ...(p0 ? { p: r3(p0) } : {}), ...(khali ? { k: 1 } : {}), ...(lo ? { lo: 1 } : {}) }); }
  }
  return out.sort((a, b) => a.n.localeCompare(b.n));
}
// v1.2: 📦 packet-war — line ki miqdaar se packet: barabar = 1 · poora guna (bara packet pehle) = utne · warna khula
function packOf(qty, sizes) {
  const q = Math.abs(Number(qty) || 0); if (!(q > 0)) return null;
  for (const z of sizes) if (Math.abs(q - z) < 1e-6) return { z, n: 1 };
  for (const z of sizes) { const k = q / z; if (k >= 1 && Math.abs(k - Math.round(k)) < 1e-6) return { z, n: Math.round(k) }; }
  return null;
}
async function readPk(p, cfg, now = new Date()) {
  const items = Object.entries(cfg || {}).map(([id, v]) => { try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && o.p ? { id: Number(id), g: Number(o.g) || 2, at: Number(o.at) || 0, sizes: Object.keys(o.p).map(Number).filter(z => z > 0).sort((a, b) => b - a) } : null; } catch { return null; } })
    .filter(x => x && Number.isInteger(x.id) && x.sizes.length).slice(0, 300);
  if (!items.length) return [];
  const ids = items.map(x => x.id), since = new Date(now); since.setDate(since.getDate() - 60);
  const lt = new Map((await p.request().input('a', sql.DateTime, since).query(`SELECT d.ItemID, MAX(ISNULL(t.CreatedOn, t.TransferDate)) AS W FROM dbo.StockTransferDetail d JOIN dbo.StockTransfer t ON t.TransferID = d.TransferID
    WHERE t.ToBranchID = ${SHOP} AND t.FromBranchID <> ${SHOP} AND t.TransferDate >= @a AND d.Qty > 0 AND d.ItemID IN (${ids.join(',')}) GROUP BY d.ItemID`)).recordset.map(r => [Number(r.ItemID), new Date(r.W).getTime()]));
  for (const x of items) x.from = Math.max(x.at || 0, lt.get(x.id) || 0, since.getTime());
  const minT = new Date(Math.min(...items.map(x => x.from)));
  const lines = (await p.request().input('a', sql.DateTime, minT).query(`SELECT d.ItemID, d.Qty, s.SaleDate FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
    WHERE s.SaleDate >= @a AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) = ${SHOP} ${NOFQ} ${NOWS} AND d.ItemID IN (${ids.join(',')})`)).recordset;
  const st = new Map((await p.request().query(`SELECT r.ItemID, r.BranchID, ISNULL(r.CurrStock, 0) AS St, i.ItemName FROM dbo.ItemBranchRate r JOIN dbo.Items i ON i.ItemID = r.ItemID WHERE r.ItemID IN (${ids.join(',')})`)).recordset
    .reduce((m, r) => { const k = Number(r.ItemID); if (!m.has(k)) m.set(k, { n: String(r.ItemName || '').trim().slice(0, 70), st: {} }); m.get(k).st[Number(r.BranchID)] = Number(r.St) || 0; return m; }, new Map()).entries());
  const by = new Map(items.map(x => [x.id, { ...x, sold: {}, kh: 0 }]));
  for (const l of lines) { const x = by.get(Number(l.ItemID)); if (!x || new Date(l.SaleDate).getTime() < x.from) continue; const q = Number(l.Qty) || 0, m = packOf(q, x.sizes), sg = q < 0 ? -1 : 1;
    if (m) x.sold[m.z] = r3((x.sold[m.z] || 0) + sg * m.n); else x.kh = r3(x.kh + q); }
  return [...by.values()].map(x => { const S = st.get(x.id) || { n: 'Item ' + x.id, st: {} }; return { i: x.id, n: S.n, g: x.g, gs: r3(S.st[x.g] || 0), ss: r3(S.st[SHOP] || 0), from: x.from, sold: x.sold, kh: x.kh }; });
}
// v1.3: ⚠️ PackQty 0/NULL wale items — POS counter sale "Divide by zero error" (rate ÷ carton pcs). Sirf wo jo 30 din mein bike ya dukan mein stock > 0.
async function readZero(p, now = new Date()) {
  const since = new Date(now); since.setDate(since.getDate() - 30);
  const rs = (await p.request().input('a', sql.DateTime, since).query(`SELECT TOP 200 i.ItemID, i.ItemName, ISNULL(r.CurrStock, 0) AS St,
      (SELECT ISNULL(SUM(d.Qty), 0) FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID WHERE d.ItemID = i.ItemID AND s.SaleDate >= @a AND ISNULL(s.DocStatusID, 0) <> 3) AS Sold
    FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = ${SHOP}
    WHERE ISNULL(i.PackQty, 0) <= 0 AND (ISNULL(r.CurrStock, 0) > 0 OR EXISTS (SELECT 1 FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID WHERE d.ItemID = i.ItemID AND s.SaleDate >= @a))
    ORDER BY Sold DESC, i.ItemName`)).recordset;
  return rs.map(r => ({ i: Number(r.ItemID), n: String(r.ItemName || '').trim().slice(0, 70), ss: r3(Number(r.St) || 0), s: r3(Number(r.Sold) || 0) }));
}
module.exports = { read, readPk, readZero, packOf, med };

if (require.main === module) (async () => {
  let pool; const t0 = Date.now();
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
    pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    try { const c = await getFirestore().collection('businesses').doc('noor-traders').collection('blueAccess').doc('reportConfig').get(); setWs(c.exists ? c.data().wsNames : null); } catch {}   // v1.7
    const rows = await read(pool);
    let pk = []; try { const c = await getFirestore().collection('businesses').doc('noor-traders').collection('blueAccess').doc('stockConfig').get(); pk = await readPk(pool, c.exists ? c.data().rackPk : null); } catch (e) { console.log('📦 packet-war masla: ' + (e?.message || e)); }
    let z = []; try { z = await readZero(pool); } catch (e) { console.log('⚠️ pcs-0 masla: ' + (e?.message || e)); }
    await pool.close(); pool = null;
    const ref = getFirestore().collection('businesses').doc('noor-traders').collection('posStats').doc('rack');
    const j = JSON.stringify(rows), pj = JSON.stringify(pk), zj = JSON.stringify(z), h = crypto.createHash('sha1').update(j + pj + zj).digest('hex');
    let old = null; try { const o = await ref.get(); old = o.exists ? o.data() : null; } catch {}
    if (old && old.h === h && Date.now() - (Number(old.at) || 0) < 10 * 60000) { console.log(new Date().toLocaleString('en-PK') + ' — 🧺 wahi (' + rows.length + ')'); process.exit(0); }
    await ref.set({ at: Date.now(), h, n: rows.length, j, pj, z: zj });
    console.log(new Date().toLocaleString('en-PK') + ' — 🧺 rack: ' + rows.length + ' items (bike + godam mein)' + (z.length ? ', ⚠️ pcs-0: ' + z.length : '') + ', ' + Math.round((Date.now() - t0) / 1000) + 's');
    process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
