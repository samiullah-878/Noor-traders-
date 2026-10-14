// =====================================================================================================
//  item-report.js  v1.1 (2026-10-14: Firestore list-ke-andar-list nahi leta — items ab JSON string 'j' mein, hissa ~600 KB tak) · v1.0 (2026-10-14) — 📊 ITEM SALE REPORT ka data (app: "📊 Item report", sirf malik)
//  Malik: "poore month ka actual data — 1–10, 10–20, 20–30, poora mahina, week wise; har item kaun si bik rahi, kin dino / hafton
//         mein zyada, un par nafa kitna — chart, click par aage data".
//  sales-stats.js (har ghante) ke aakhir mein chalta hai: run({ pool, sql, db }). SQL mein KUCH NAHI likhta — sirf SELECT.
//  Arsa: 3 calendar mahine (do pichhle + ye mahina, aaj tak). Noor Traders / our factory / stock farq ke bill bahar, cancel (3) bahar.
//  Wholesale: party ka naam blueAccess/reportConfig.wsNames (default "whole sale") — us ka hissa alag (app chip: saath / baghair).
//  Nafa: har item ka ABHI ka khareed rate fi piece (raat-report jaisa perPiece / pieceCost) × ginti — purane din ka andaza.
//  Firestore posStats/irep-meta {at, from, to, days[], n, chunks, ver} · posStats/irep-<k> {j: JSON string of [{i, n, c, pk, d:[[dayIdx, q, rs, wq?, wrs?]]}]}
//    (v1.1: wholesale 0 ho to wq/wrs nahi likhte — chhota). Har hissa ~600 KB tak (Firestore doc hadd 1 MB).
//    q = ginti (pieces), rs = Rs (Qty × Rate), wq / wrs = us mein se wholesale. c = fi piece khareed (Rs). Bilkul chhota (har ghante).
// =====================================================================================================
const MAXB = 600000;   // v1.1: ek doc mein itne bytes tak
const SKIP_RX = /noor\s*trader|our\s*factory|stock\s*['"]?\s*f[ae]?r?a?q/i;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100, r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const p2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function perPiece(v, pack, sale) {
  v = Number(v) || 0; pack = Number(pack) || 0; sale = Number(sale) || 0;
  if (!v || pack <= 1) return v; if (!sale) return v / pack;
  const a = v / pack; return Math.abs(Math.log(a / sale)) < Math.abs(Math.log(v / sale)) ? a : v;
}
function pieceCost(cost, pack, rate) {
  cost = Number(cost) || 0; pack = Number(pack) || 0; rate = Number(rate) || 0;
  if (!cost || pack <= 1 || !rate) return cost;
  const gap = v => Math.abs(Math.log(v / rate)), whole = cost * pack;
  return gap(whole) < gap(cost) ? whole : cost;
}

async function run({ pool, sql, db, log = console.log, now = new Date() }) {
  const t0 = Date.now();
  const col = db.collection('businesses').doc('noor-traders').collection('posStats');
  let wsNames = ['whole sale'];
  try { const c = await db.collection('businesses').doc('noor-traders').collection('blueAccess').doc('reportConfig').get(); const w = c.exists && c.data().wsNames; if (Array.isArray(w) && w.length) wsNames = w; } catch {}
  const isWs = name => { const p = norm(name); return !!p && (/whole\s*sale/.test(p) || wsNames.some(n => norm(n) && p.includes(norm(n)))); };
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1), to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = []; for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) days.push(dayOf(d));
  const di = new Map(days.map((d, i) => [d, i]));
  // 1) is arse ki parties — andar wali bahar, wholesale ka nishan
  const parties = (await pool.request().input('a', sql.DateTime, from).query(`SELECT DISTINCT s.PartyID, pt.PartyName FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID WHERE s.SaleDate >= @a`)).recordset;
  const skipIds = [], wsIds = [];
  for (const p of parties) { const id = Number(p.PartyID); if (!Number.isFinite(id)) continue; if (SKIP_RX.test(String(p.PartyName || ''))) skipIds.push(id); else if (isWs(p.PartyName)) wsIds.push(id); }
  const inList = ids => ids.length ? ids.map(n => Math.trunc(n)).join(',') : '-1';
  // 2) item × din × (wholesale?) — ginti aur Rs
  const rows = (await pool.request().input('a', sql.DateTime, from).input('b', sql.DateTime, to).query(`
    SELECT d.ItemID, CONVERT(char(10), s.SaleDate, 23) AS dy, CASE WHEN s.PartyID IN (${inList(wsIds)}) THEN 1 ELSE 0 END AS ws,
           SUM(d.Qty) AS q, SUM(CAST(d.Qty AS FLOAT) * CAST(d.Rate AS FLOAT)) AS rs
    FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(s.PartyID, -2) NOT IN (${inList(skipIds)})
    GROUP BY d.ItemID, CONVERT(char(10), s.SaleDate, 23), CASE WHEN s.PartyID IN (${inList(wsIds)}) THEN 1 ELSE 0 END`)).recordset;
  // 3) items ka naam + fi piece khareed
  const ids = [...new Set(rows.map(r => Number(r.ItemID)).filter(Number.isFinite))];
  const info = new Map();
  for (let k = 0; k < ids.length; k += 800) {
    const part = ids.slice(k, k + 800);
    const rs = (await pool.request().query(`SELECT i.ItemID, i.ItemName, ISNULL(i.PackQty,0) AS Pack, ISNULL(NULLIF(r.PurchaseRate,0), i.PurchaseRate) AS PR, ISNULL(NULLIF(r.SaleRate,0), i.SaleRate) AS SR
      FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = 1 WHERE i.ItemID IN (${part.join(',')})`)).recordset;
    for (const x of rs) info.set(Number(x.ItemID), { n: String(x.ItemName || '').trim().slice(0, 70), pk: Number(x.Pack) || 0, c: r2(pieceCost(perPiece(x.PR, x.Pack, x.SR), x.Pack, x.SR)) });
  }
  const M = new Map();
  for (const r of rows) {
    const id = Number(r.ItemID), d = di.get(String(r.dy).trim()); if (d == null || !Number.isFinite(id)) continue;
    if (!M.has(id)) { const f = info.get(id) || { n: 'Item ' + id, pk: 0, c: 0 }; M.set(id, { i: id, n: f.n, c: f.c, pk: f.pk, m: new Map() }); }
    const e = M.get(id), x = e.m.get(d) || [d, 0, 0, 0, 0], q = Number(r.q) || 0, rs = Number(r.rs) || 0;
    x[1] += q; x[2] += rs; if (Number(r.ws) === 1) { x[3] += q; x[4] += rs; }
    e.m.set(d, x);
  }
  const all = [...M.values()].map(e => ({ i: e.i, n: e.n, c: e.c, pk: e.pk, d: [...e.m.values()].sort((a, b) => a[0] - b[0]).map(x => x[3] || x[4] ? [x[0], r3(x[1]), Math.round(x[2]), r3(x[3]), Math.round(x[4])] : [x[0], r3(x[1]), Math.round(x[2])]) }))
    .filter(e => e.d.some(x => x[1] || x[2]))
    .sort((a, b) => b.d.reduce((s, x) => s + x[2], 0) - a.d.reduce((s, x) => s + x[2], 0));
  const chunks = []; let cur = [], size = 2;
  for (const e of all) { const n = Buffer.byteLength(JSON.stringify(e)) + 1; if (cur.length && size + n > MAXB) { chunks.push(cur); cur = []; size = 2; } cur.push(e); size += n; }
  if (cur.length) chunks.push(cur);
  const b = db.batch();
  chunks.forEach((items, k) => b.set(col.doc('irep-' + k), { j: JSON.stringify(items), n: items.length, at: Date.now() }));
  b.set(col.doc('irep-meta'), { at: Date.now(), from: days[0], to: days[days.length - 1], days, n: all.length, chunks: chunks.length, ws: wsNames.slice(0, 10), ver: '1.1', bytes: chunks.reduce((s, c) => s + Buffer.byteLength(JSON.stringify(c)), 0) });
  await b.commit();
  try { const old = await col.get(); for (const d of old.docs) { const m = /^irep-(\d+)$/.exec(d.id); if (m && Number(m[1]) >= chunks.length) await d.ref.delete(); } } catch {}
  log(new Date().toLocaleString('en-PK') + ' — 📊 item report: ' + all.length + ' items, ' + days.length + ' din, ' + chunks.length + ' hisse, ' + Math.round((Date.now() - t0) / 1000) + 's');
  return { n: all.length, days: days.length };
}
module.exports = { run, perPiece, pieceCost };
