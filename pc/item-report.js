// =====================================================================================================
//  item-report.js  v1.8 (2026-10-28: 🏭 supplier-wise — posStats/irep-sup: har supplier ke items + aakhri khareed rate, 365 din) · v1.7 (2026-10-20: koi array nahi, har doc alag, poori galti irep-err mein) · v1.5 (2026-10-19: 🧾 stock fraq / ginti farq bill nafa + bikri se BAHAR — party naam saaf karke + Description "Stock ginti farq") · v1.4 (2026-10-17: 💰 asal nafa — har sale bill TotalSale − COGS -> posStats/nafa-<mahina>-<k>, aaj ka irep-today.nb) · v1.3 (2026-10-17: ⚡ runToday — sirf AAJ ka data har 10 min posStats/irep-today (irep-today.js) · collect() alag) · v1.2 (2026-10-14: 💰 COMMISSION items (blueAccess/commission) — har din har Supply Man kitne packet -> posStats/irep-comm) · v1.1 (2026-10-14: Firestore list-ke-andar-list nahi leta — items ab JSON string 'j' mein, hissa ~600 KB tak) · v1.0 (2026-10-14) — 📊 ITEM SALE REPORT ka data (app: "📊 Item report", sirf malik)
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
// v1.6 (2026-10-19): FIX — 3 din se report fail: 'INVALID_ARGUMENT: Property array contains an array' (reportConfig.wsNames mein nested array → irep-meta.ws).
//   wsNames flat + String; meta commit fail ho to ws ke baghair dobara.
// v1.5 (2026-10-19): malik — "stock fraq ka data profit mein nahi aana chahiye". Ginti farq ke bill (post-farq: Description "Stock ginti farq <round>",
//   party "stock fraq") hamesha bahar — party naam kisi bhi likhai mein (stock-fraq / Stock Farq A/C) + Description se bhi.
const skipName = n => { const t = String(n || '').toLowerCase().replace(/[^a-z]/g, ''); return SKIP_RX.test(String(n || '')) || /stock.{0,12}f(a?r|r)a?q/.test(t) || /noortrader|ourfactory/.test(t); };
const NOFARQ = "AND ISNULL(CAST(s.Description AS NVARCHAR(200)), '') NOT LIKE 'Stock ginti farq%'";
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

// v1.3: hisaab alag (collect) — run() 3 mahine (har ghante) · runToday() sirf AAJ (irep-today.js har 10 min) -> posStats/irep-today
async function collect({ pool, sql, db, log, from, to }) {
  let wsNames = ['whole sale'];
  try { const c = await db.collection('businesses').doc('noor-traders').collection('blueAccess').doc('reportConfig').get(); const w = c.exists && c.data().wsNames; if (Array.isArray(w) && w.length) wsNames = w.flat(3).map(x => String(x ?? '').trim()).filter(Boolean); } catch {}   // v1.6: array ke andar array = Firestore INVALID_ARGUMENT
  const isWs = name => { const p = norm(name); return !!p && (/whole\s*sale/.test(p) || wsNames.some(n => norm(n) && p.includes(norm(n)))); };
  const days = []; for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) days.push(dayOf(d));
  const di = new Map(days.map((d, i) => [d, i]));
  // 1) is arse ki parties — andar wali bahar, wholesale ka nishan
  const parties = (await pool.request().input('a', sql.DateTime, from).query(`SELECT DISTINCT s.PartyID, pt.PartyName FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID WHERE s.SaleDate >= @a`)).recordset;
  const skipIds = [], wsIds = [];
  for (const p of parties) { const id = Number(p.PartyID); if (!Number.isFinite(id)) continue; if (skipName(p.PartyName)) skipIds.push(id); else if (isWs(p.PartyName)) wsIds.push(id); }
  const inList = ids => ids.length ? ids.map(n => Math.trunc(n)).join(',') : '-1';
  // 2) item × din × (wholesale?) — ginti aur Rs
  const rows = (await pool.request().input('a', sql.DateTime, from).input('b', sql.DateTime, to).query(`
    SELECT d.ItemID, CONVERT(char(10), s.SaleDate, 23) AS dy, CASE WHEN s.PartyID IN (${inList(wsIds)}) THEN 1 ELSE 0 END AS ws,
           SUM(d.Qty) AS q, SUM(CAST(d.Qty AS FLOAT) * CAST(d.Rate AS FLOAT)) AS rs
    FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(s.PartyID, -2) NOT IN (${inList(skipIds)}) ${NOFARQ}
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
  // v1.2: 💰 COMMISSION — malik ki tick ki hui items (Biryani 100g, Qorma 100g …): har din × Supply Man (Sale.SupplyManID, 0 = bina) × item = packet
  let comm = null;
  try {
    const cd = await db.collection('businesses').doc('noor-traders').collection('blueAccess').doc('commission').get();
    const cids = Object.keys((cd.exists && cd.data().items) || {}).map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 200);
    if (cids.length) {
      const men = (await pool.request().query('SELECT SupplyManID, SupplyManName FROM dbo.SupplyMan')).recordset.map(r => [Number(r.SupplyManID), String(r.SupplyManName || '').trim().slice(0, 40)]);
      const cr = (await pool.request().input('a', sql.DateTime, from).input('b', sql.DateTime, to).query(`
        SELECT d.ItemID, CONVERT(char(10), s.SaleDate, 23) AS dy, ISNULL(s.SupplyManID, 0) AS m, SUM(d.Qty) AS q
        FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
        WHERE s.SaleDate >= @a AND s.SaleDate < @b AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(s.PartyID, -2) NOT IN (${inList(skipIds)}) ${NOFARQ} AND d.ItemID IN (${cids.join(',')})
        GROUP BY d.ItemID, CONVERT(char(10), s.SaleDate, 23), ISNULL(s.SupplyManID, 0)`)).recordset;
      const rows = []; for (const r of cr) { const d = di.get(String(r.dy).trim()), q = r3(r.q); if (d != null && q) rows.push([d, Number(r.m) || 0, Number(r.ItemID), q]); }
      comm = { men, ids: cids, rows };
    }
  } catch (e) { log('💰 commission data nahi bana: ' + e.message); }
  return { all, comm, days, wsNames, skipIds, wsIds, info, inList };
}
// v1.4: 💰 ASAL NAFA — sale bills se (malik: "sale bills ke data ke hisaab se profit"). Har bill: Sale.TotalSale − Sale.COGS (POS ne bill ke
//   waqt ki laagat khud likhi). COGS 0 = lines × item ka abhi ka fi pcs khareed (andaza, est 1). Wapsi (total < 0) = laagat bhi minus.
//   Mahine ke hisab: { p: [party naam], b: [[din (1-31), 'HH:MM', billNo, pIdx, total, cost, ws, est]] } -> posStats/nafa-<YYYY-MM>-<k>
async function nafaCollect({ pool, sql, from, to, skipIds, wsIds, info, inList }) {
  const bills = (await pool.request().input('a', sql.DateTime, from).input('b', sql.DateTime, to).query(`
    SELECT s.SaleID, s.SaleNo, CONVERT(char(16), s.SaleDate, 120) AS W, CAST(s.TotalSale AS FLOAT) AS T, CAST(ISNULL(s.COGS, 0) AS FLOAT) AS C, s.PartyID, pt.PartyName
    FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(s.PartyID, -2) NOT IN (${inList(skipIds)}) ${NOFARQ}`)).recordset;
  const est = new Map();   // COGS nahi = lines se andaza
  if (bills.some(b => !(Math.abs(Number(b.C)) > 0))) {
    const L = (await pool.request().input('a', sql.DateTime, from).input('b', sql.DateTime, to).query(`
      SELECT d.SaleID, d.ItemID, SUM(d.Qty) AS q FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
      WHERE s.SaleDate >= @a AND s.SaleDate < @b AND ISNULL(s.DocStatusID, 0) <> 3 AND ISNULL(s.COGS, 0) = 0 AND ISNULL(s.PartyID, -2) NOT IN (${inList(skipIds)}) ${NOFARQ}
      GROUP BY d.SaleID, d.ItemID`)).recordset;
    for (const r of L) { const k = Number(r.SaleID); est.set(k, (est.get(k) || 0) + (Number(r.q) || 0) * (info.get(Number(r.ItemID))?.c || 0)); }
  }
  const ws = new Set(wsIds.map(Number)), M = new Map();
  for (const b of bills) {
    const w = String(b.W || ''), mon = w.slice(0, 7); if (!/^\d{4}-\d{2}$/.test(mon)) continue;
    if (!M.has(mon)) M.set(mon, { p: [], pi: new Map(), b: [] }); const o = M.get(mon);
    const pn = String(b.PartyName || '').trim().slice(0, 40) || 'Cash'; if (!o.pi.has(pn)) { o.pi.set(pn, o.p.length); o.p.push(pn); }
    const t = Number(b.T) || 0, c0 = Math.abs(Number(b.C) || 0), e = !(c0 > 0), cost = e ? (est.get(Number(b.SaleID)) || 0) : (t < 0 ? -c0 : c0);
    o.b.push([Number(w.slice(8, 10)), w.slice(11, 16), String(b.SaleNo || '').trim().slice(0, 16), o.pi.get(pn), Math.round(t), Math.round(cost), ws.has(Number(b.PartyID)) ? 1 : 0, e ? 1 : 0]);
  }
  for (const o of M.values()) { o.b.sort((x, y) => x[0] - y[0] || String(x[1]).localeCompare(String(y[1]))); delete o.pi; }
  return M;
}
// v1.8 (2026-10-28): 🏭 SUPPLIER-WISE (malik: "supplier wise sale data items ka chahiye, supplier search ho sake, PDF, nafa nahi") —
//   pichhle 365 din ki khareed (cancel 3 nahi; noor traders / our factory / stock fraq / godam stock jaisi andar ki parties nahi):
//   posStats/irep-sup {at, n, j: JSON {s: [[supplier naam, [[itemId, aakhri rate, 'YYYY-MM-DD', kitni dafa], ...]], ...]}} — app irep.js isi se.
async function supCollect({ pool, sql }) {
  const rows = (await pool.request().query(`SELECT x.PartyID, x.PartyName, x.ItemID, x.Rate, CONVERT(char(10), x.PurchaseDate, 23) AS D, x.n FROM (
      SELECT p.PartyID, pt.PartyName, d.ItemID, d.Rate, p.PurchaseDate,
        ROW_NUMBER() OVER (PARTITION BY p.PartyID, d.ItemID ORDER BY p.PurchaseDate DESC, p.PurchaseID DESC) AS rn,
        COUNT(*) OVER (PARTITION BY p.PartyID, d.ItemID) AS n
      FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID
      WHERE p.PurchaseDate >= DATEADD(day, -365, GETDATE()) AND ISNULL(p.DocStatusID, 0) <> 3 AND p.PartyID IS NOT NULL) x
    WHERE x.rn = 1`)).recordset;
  const by = new Map();
  for (const r of rows) {
    const nm = String(r.PartyName || '').trim(); if (!nm || skipName(nm) || /godam\s*stock|opening/i.test(nm)) continue;
    const k = Number(r.PartyID); if (!by.has(k)) by.set(k, [nm, []]);
    by.get(k)[1].push([Number(r.ItemID), r2(r.Rate), String(r.D || ''), Number(r.n) || 1]);
  }
  return [...by.values()].sort((a, b) => a[0].localeCompare(b[0]));
}
const nafaChunks = o => { const out = []; let cur = [], size = 0; for (const r of o.b) { const n = JSON.stringify(r).length + 1; if (cur.length && size + n > 700000) { out.push(cur); cur = []; size = 0; } cur.push(r); size += n; } out.push(cur); return out.map(b => JSON.stringify({ p: o.p, b })); };
async function run({ pool, sql, db, log = console.log, now = new Date() }) {
  const t0 = Date.now();
  const col = db.collection('businesses').doc('noor-traders').collection('posStats');
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1), to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const C = await collect({ pool, sql, db, log, from, to }), { all, comm, days, wsNames } = C;
  let NF = null; try { NF = await nafaCollect({ pool, sql, from, to, ...C }); } catch (e) { log('💰 bills ka nafa nahi bana: ' + e.message); }
  const chunks = []; let cur = [], size = 2;
  for (const e of all) { const n = Buffer.byteLength(JSON.stringify(e)) + 1; if (cur.length && size + n > MAXB) { chunks.push(cur); cur = []; size = 2; } cur.push(e); size += n; }
  if (cur.length) chunks.push(cur);
  // v1.7 (2026-10-20): FIX — phir 'INVALID_ARGUMENT: Property array contains an invalid nested entity' (4 din report ruki). Ab Firestore mein KOI array nahi
  //   (days / ws = JSON text: dj / wsj), har doc ALAG save (ek fail = baqi bach jayein) aur fail ki POORI wajah posStats/irep-err {at, doc, msg} mein (app dikhati hai).
  const nafa = {}; if (NF) for (const [mon, o] of NF) nafa[mon] = nafaChunks(o).length;
  const errs = [], put = async (id, data) => { try { await col.doc(id).set(data); } catch (e) { errs.push(id + ': ' + String(e?.message || e)); log('⚠️ ' + id + ' save nahi: ' + (e?.message || e)); } };
  if (comm) await put('irep-comm', { j: JSON.stringify(comm), at: Date.now() });
  try { const S = await supCollect({ pool, sql }); let j = JSON.stringify({ s: S }); while (Buffer.byteLength(j) > 900000 && S.length > 10) { S.length = Math.floor(S.length * 0.9); j = JSON.stringify({ s: S }); } await col.doc('irep-sup').set({ j, n: S.length, at: Date.now() }); } catch (e) { log('🏭 supplier-wise nahi bana: ' + (e?.message || e)); }   // v1.8
  for (let k = 0; k < chunks.length; k++) await put('irep-' + k, { j: JSON.stringify(chunks[k]), n: chunks[k].length, at: Date.now() });
  await put('irep-meta', { at: Date.now(), from: days[0], to: days[days.length - 1], dj: JSON.stringify(days.map(String)), n: all.length, chunks: chunks.length, wsj: JSON.stringify(wsNames.flat(3).map(String).slice(0, 10)), ver: '1.7', comm: !!comm, nj: JSON.stringify(NF ? nafa : {}), bytes: chunks.reduce((s, c) => s + Buffer.byteLength(JSON.stringify(c)), 0) });
  try { await col.doc('irep-err').set({ at: Date.now(), msg: errs.join(' | ').slice(0, 1500), n: errs.length }); } catch {}
  if (errs.length) throw new Error(errs[0].slice(0, 400));
  if (NF) { try { const nb = db.batch(); for (const [mon, o] of NF) nafaChunks(o).forEach((j, k) => nb.set(col.doc(`nafa-${mon}-${k}`), { j, at: Date.now() })); await nb.commit(); } catch (e) { log('💰 nafa save nahi hua (report ban gayi): ' + e.message); NF = null; } }
  try { const old = await col.get(); for (const d of old.docs) { const m = /^irep-(\d+)$/.exec(d.id), n = /^nafa-(\d{4}-\d{2})-(\d+)$/.exec(d.id); if ((m && Number(m[1]) >= chunks.length) || (n && NF && !(Number(n[2]) < (nafa[n[1]] || 0)))) await d.ref.delete(); } } catch {}
  log(new Date().toLocaleString('en-PK') + ' — 📊 item report: ' + all.length + ' items, ' + days.length + ' din, ' + chunks.length + ' hisse, ' + Math.round((Date.now() - t0) / 1000) + 's');
  return { n: all.length, days: days.length };
}
// v1.3: ⚡ AAJ KA DATA (malik: "aaj ka data nahi aa raha") — sirf aaj, chhota doc. App poore report mein aaj ki jagah yeh jorti hai
//   (jab yeh irep-meta se naya ho). posStats/irep-today { at, day, n, h, j: JSON [{i, n, c, pk, q, rs, wq?, wrs?}], cj: JSON {men, rows:[[m, item, q]]} | '' }
//   h = hash — badla na ho to dobara nahi likhta (sirf 'at' har 30 min, taake app ko pata ho PC zinda hai).
async function runToday({ pool, sql, db, log = console.log, now = new Date() }) {
  const t0 = Date.now(), ref = db.collection('businesses').doc('noor-traders').collection('posStats').doc('irep-today');
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()), to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const C = await collect({ pool, sql, db, log, from, to }), { all, comm, days } = C;
  let nb = ''; try { const NF = await nafaCollect({ pool, sql, from, to, ...C }), o = [...NF.values()][0]; if (o) nb = JSON.stringify(o); } catch (e) { log('💰 aaj ka nafa nahi bana: ' + e.message); }   // v1.4
  const items = all.map(e => { const x = e.d[0] || [0, 0, 0]; const o = { i: e.i, n: e.n, c: e.c, pk: e.pk, q: x[1], rs: x[2] }; if (x[3] || x[4]) { o.wq = x[3]; o.wrs = x[4]; } return o; });
  let j = JSON.stringify(items); while (Buffer.byteLength(j) > 850000 && items.length > 50) { items.length = Math.floor(items.length * 0.8); j = JSON.stringify(items); }
  const cj = comm ? JSON.stringify({ men: comm.men, rows: comm.rows.map(r => [r[1], r[2], r[3]]) }) : '';
  const h = require('crypto').createHash('sha1').update(days[0] + j + cj + nb).digest('hex');
  let old = null; try { const o = await ref.get(); old = o.exists ? o.data() : null; } catch {}
  if (old && old.h === h && Date.now() - (Number(old.at) || 0) < 30 * 60000) { log(new Date().toLocaleString('en-PK') + ' — ⚡ aaj: wahi (' + items.length + ' items)'); return { n: items.length, same: true }; }
  await ref.set({ at: Date.now(), day: days[0], n: items.length, h, j, cj, nb });
  log(new Date().toLocaleString('en-PK') + ' — ⚡ aaj ' + days[0] + ': ' + items.length + ' items, Rs ' + Math.round(items.reduce((s, x) => s + x.rs, 0)) + ', ' + Math.round((Date.now() - t0) / 1000) + 's');
  return { n: items.length };
}
// v1.5: 📅 KAL KA DATA — malik: "kal (18) ka data nahi aa raha". Bari report (har ghante) ruk jaye to bhi kal dikhe: posStats/irep-kal
//   (irep-today jaisa) — ghante mein ek dafa (ya din badle) dobara banta hai. App: bari report + kal + aaj.
async function runKal({ pool, sql, db, log = console.log, now = new Date() }) {
  const ref = db.collection('businesses').doc('noor-traders').collection('posStats').doc('irep-kal');
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dk = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  let old = null; try { const o = await ref.get(); old = o.exists ? o.data() : null; } catch {}
  if (old && old.day === dk && Date.now() - (Number(old.at) || 0) < 60 * 60000) return { same: true };
  const C = await collect({ pool, sql, db, log, from, to }), { all, comm } = C;
  let nb = ''; try { const NF = await nafaCollect({ pool, sql, from, to, ...C }), o = [...NF.values()][0]; if (o) nb = JSON.stringify(o); } catch {}
  const items = all.map(e => { const x = e.d[0] || [0, 0, 0]; const o = { i: e.i, n: e.n, c: e.c, pk: e.pk, q: x[1], rs: x[2] }; if (x[3] || x[4]) { o.wq = x[3]; o.wrs = x[4]; } return o; });
  let j = JSON.stringify(items); while (Buffer.byteLength(j) > 850000 && items.length > 50) { items.length = Math.floor(items.length * 0.8); j = JSON.stringify(items); }
  const cj = comm ? JSON.stringify({ men: comm.men, rows: comm.rows.map(r => [r[1], r[2], r[3]]) }) : '';
  await ref.set({ at: Date.now(), day: dk, n: items.length, j, cj, nb });
  log(new Date().toLocaleString('en-PK') + ' — 📅 kal ' + dk + ': ' + items.length + ' items');
  return { n: items.length };
}
module.exports = { run, runToday, runKal, collect, nafaCollect, perPiece, pieceCost };
