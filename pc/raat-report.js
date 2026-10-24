// =========================================================
//  v1.4 (2026-10-25): ⚖️ app v2.116.0 "sirf hisaab" transfer note (maal pehle se wahan) aur cancel note — "check nahi hue" ginti mein NAHI.
//  v1.3 (2026-10-21): ⏰ SUBAH KI "KHATAM HONE WALA MAAL" KHABAR BAND (malik: "ab is ki zaroorat nahi — app par awe load"; app v2.106.0 ne
//     Reminder screen se ⏰ / 🛒 order hata diye, mangwana = Rack bharo → 🛒 Mangwao). Na subah ka SQL hisaab, na push, na raat ki report mein
//     alert card. Sirf 🌙 raat ki report. (Test ke liye haath se: node raat-report.js --alert ab bhi chalta hai.)
//  raat-report.js  v1.0 (2026-10-11) — 🌙 RAAT KI REPORT + ⏰ MAAL KHATAM HONE SE PEHLE KHABAR (Server PC)
//  Malik: "dukan mere baghair chale" — har raat ek report aur har subah khatam hone wale maal ki khabar, phone par (FCM).
//  1) 🌙 Raat (default 22:30): aaj ka POS hisaab — sale (cash / udhaar / cancel / wapsi), andaza NAFA (POS COGS, warna
//     khareed rate se), GHAATE wale bill (khareed se kam par bika — kis PC / kis ne), 🏷 WHOLESALE bills (retail ke muqable
//     farq, ⚠️ shak = zyada lines CHHOTI tadad (< wsSmall pcs), counter par wholesale rate), purchase (mehngay items),
//     stock ki maaliyat (har godam, kal se farq), khata (udhaar diya / wasooli / akhrajat / cash farq — app ke daily() jaisa),
//     transfer note jo check nahi hue, stock ginti ka farq, aur ⏰ khatam hone wala maal.
//     -> blueAccess/report-<YYYY-MM-DD> (62 din) + push "🌙 Aaj ki report" (link ?report=<din>).
//  2) ⏰ Subah (default 09:00): har item ka kul stock (sab godam) ÷ roz ki bikri (30 / 90 din) = kitne din baqi.
//     <= alertRed din (3) laal, <= alertYellow (7) peela; mangwana = 3 hafte ka andaza (carton mein); pichla supplier +
//     POS mein us ka phone. Band (chhupaye) items aur "our factory" nahi. -> blueAccess/stockAlert + push (laal hon to).
//  Setting: blueAccess/reportConfig {reportOn, reportTime, alertOn, alertTime, alertRed, alertYellow, wsNames[], wsSmall,
//     reportNow, alertNow} — app Settings se (malik). SQL mein KUCH NAHI likhta — sirf SELECT. Yahan AI nahi.
//  Chalana: report-auto.bat (loop). Test: node raat-report.js --report [YYYY-MM-DD] | --alert   (bana kar Firestore mein + push)
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');

const VER = '1.4';   // v1.4 (2026-10-25): ⚖️ "sirf hisaab" / cancel transfer note "check nahi hue" mein nahi.
// v1.1 (2026-10-11): sachi dhadkan + chowkidar (11-Oct 3 ghante khamosh, report nahi bani) · report waqt guzre to usi din baad mein bhi · default 18:30
const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47833;
const DIR = __dirname;
const LINK = 'https://samiullah-878.github.io/Noor-traders-/';
const KEEP_DAYS = 62;
const PC_DEFAULT = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-KEIME1D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
const SKIP_RX = /noor\s*trader|our\s*factory|stock\s*['"]?\s*f[ae]?r?a?q/i;   // andar ka lena-dena (bikri / khareed nahi)
const DEF = { reportOn: true, reportTime: '18:30', alertOn: true, alertTime: '09:00', alertRed: 3, alertYellow: 7, wsNames: ['whole sale'], wsSmall: 3 };

const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const pad2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const prevDay = day => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 1); return dayOf(d); };
const rs = v => 'Rs ' + Math.round(Number(v) || 0).toLocaleString('en-PK');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// POS ka PurchaseRate kabhi carton ka, kabhi piece ka — jo bechne ke rate ke qareeb ho wohi piece ka (sync-stock jaisa)
function perPiece(v, pack, sale) {
  v = Number(v) || 0; pack = Number(pack) || 0; sale = Number(sale) || 0;
  if (!v || pack <= 1) return v; if (!sale) return v / pack;
  const a = v / pack; return Math.abs(Math.log(a / sale)) < Math.abs(Math.log(v / sale)) ? a : v;
}
// app ka fixCost (pos-stock pieceCost) — value card isi se banta hai, report bhi wahi dikhaye
function pieceCost(cost, pack, rate) {
  cost = Number(cost) || 0; pack = Number(pack) || 0; rate = Number(rate) || 0;
  if (!cost || pack <= 1 || !rate) return cost;
  const gap = v => Math.abs(Math.log(v / rate)), whole = cost * pack;
  return gap(whole) < gap(cost) ? whole : cost;
}
const isWs = (party, names) => { const p = norm(party); return !!p && (names || []).some(n => norm(n) && p.includes(norm(n))); };
const phone92 = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0092')) d = d.slice(2); if (d.startsWith('03') && d.length === 11) d = '92' + d.slice(1); else if (d.startsWith('3') && d.length === 10) d = '92' + d; return /^923\d{9}$/.test(d) ? d : ''; };
// app ke model.daily jaisa (cash ka farq)
function dailyOf(day, rows) {
  const entries = rows.filter(r => r.type === 'entry' && !r.deleted && r.date === day);
  const closes = rows.filter(r => r.type === 'closing' && !r.deleted);
  const prev = closes.find(c => c.date === prevDay(day)), close = closes.find(c => c.date === day) || {};
  const t = { sale: 0, collection: 0, expense: 0, payment: 0, credit: 0, borrow: 0 };
  for (const e of entries) {
    const a = Number(e.amount) || 0;
    if (e.kind === 'credit') t.credit += a; if (e.kind === 'borrow') t.borrow += a;
    if (['collection', 'payment', 'expense'].includes(e.kind) && e.dailyIncluded === false) continue;   // v1.3: kharcha bhi
    if (e.kind === 'purchaseCash') t.expense += a; else if (e.kind in { sale: 1, collection: 1, expense: 1, payment: 1 }) t[e.kind] += a;
  }
  const opening = prev?.change ?? close.opening ?? 0;
  return { ...t, opening, cash: close.cash ?? 0, change: close.change ?? 0, closed: close.change != null && close.cash != null,
    difference: t.sale + t.collection + opening - t.expense - t.payment - (close.change || 0) - (close.cash || 0) };   // paisa
}

function makeReporter({ getPool, sql, biz, log = () => {}, pcNames = () => PC_DEFAULT, send = null, now = () => new Date(), onBeat = null }) {
  const access = biz.collection('blueAccess');
  async function cfgGet() { try { const d = await access.doc('reportConfig').get(); return { ...DEF, ...(d.exists ? d.data() || {} : {}) }; } catch { return { ...DEF }; } }
  async function branchNames(p) { try { const r = (await p.request().query('SELECT BranchID, BranchName FROM dbo.Branch')).recordset; const m = {}; r.forEach(x => { m[x.BranchID] = String(x.BranchName || '').trim(); }); return m; } catch { return {}; } }
  async function pushOwner(title, body, tag, link) {
    if (send) return send({ title, body, tag, link });
    const tk = await biz.collection('pushTokens').get();
    const tokens = tk.docs.map(d => d.data()).filter(x => x.token && (x.role === 'owner' || x.role === 'malik')).map(x => x.token);
    if (!tokens.length) { log('push: malik ka koi token nahi (app mein notification ON karein)'); return { successCount: 0 }; }
    const { getMessaging } = require('firebase-admin/messaging');
    return getMessaging().sendEachForMulticast({ tokens, data: { title, body, tag, link }, webpush: { headers: { Urgency: 'high' } } });
  }

  // ---------- ⏰ maal khatam hone wala ----------
  async function buildAlert(cfg) {
    cfg = cfg || await cfgGet();
    const p = await getPool();
    const red = Math.max(1, Number(cfg.alertRed) || 3), yellow = Math.max(red, Number(cfg.alertYellow) || 7);
    const stock = (await p.request().query(`SELECT i.ItemID, i.ItemName, ISNULL(i.PackQty,0) AS Pack, i.PackQtyName, i.QtyName, SUM(ISNULL(r.CurrStock,0)) AS S
      FROM dbo.Items i JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID GROUP BY i.ItemID, i.ItemName, i.PackQty, i.PackQtyName, i.QtyName`)).recordset;
    const sales = (await p.request().query(`SELECT d.ItemID, SUM(CASE WHEN s.SaleDate >= DATEADD(day, -30, GETDATE()) THEN d.Qty ELSE 0 END) AS S30, SUM(d.Qty) AS S90
      FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
      WHERE s.SaleDate >= DATEADD(day, -90, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3
      AND ISNULL(pt.PartyName, '') NOT LIKE '%noor%trader%' AND ISNULL(pt.PartyName, '') NOT LIKE '%our factory%' AND ISNULL(pt.PartyName, '') NOT LIKE '%stock%f%q%'
      GROUP BY d.ItemID`)).recordset;
    const last = (await p.request().query(`SELECT x.ItemID, x.Qty, x.Rate, x.PurchaseDate, x.PartyName, x.Phone FROM (
      SELECT d.ItemID, d.Qty, d.Rate, p.PurchaseDate, pt.PartyName, pt.Phone1 AS Phone, ROW_NUMBER() OVER (PARTITION BY d.ItemID ORDER BY p.PurchaseDate DESC, p.PurchaseID DESC) AS rn
      FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID
      WHERE p.PurchaseDate >= DATEADD(day, -365, GETDATE()) AND ISNULL(p.DocStatusID, 0) <> 3 AND ISNULL(pt.PartyName, '') NOT LIKE '%noor%trader%') x WHERE x.rn = 1`)).recordset;
    let hidden = {}; try { const h = await biz.collection('stockCount').doc('_hidden').get(); hidden = (h.exists && h.data()?.items) || {}; } catch {}   // v1.2 (2026-10-11): chhupe items stockCount/_hidden mein hain (pehle ghalti se posStock dekhta tha)
    const sBy = new Map(sales.map(s => [Number(s.ItemID), s])), lBy = new Map(last.map(l => [Number(l.ItemID), l]));
    const items = [];
    for (const it of stock) {
      const id = Number(it.ItemID); if (hidden[String(id)]) continue;
      const s = sBy.get(id); if (!s || !(Number(s.S30) > 0)) continue;   // 30 din mein bika hi nahi = khabar nahi
      const daily = Math.max((Number(s.S30) || 0) / 30, (Number(s.S90) || 0) / 90 * 0.9); if (!(daily > 0)) continue;
      const have = Math.max(0, Number(it.S) || 0), left = have / daily; if (left > yellow) continue;
      const l = lBy.get(id), party = String(l?.PartyName || '').trim();
      if (/our\s*factory/i.test(party)) continue;
      const pk = Number(it.Pack) || 0, unitPk = pk > 1 ? pk : 1, needPcs = Math.max(daily * 21 - have, unitPk);
      items.push({ i: id, n: String(it.ItemName || '').trim().slice(0, 60), u: pk > 1 ? String(it.PackQtyName || 'Ctn').trim() : String(it.QtyName || 'Pcs').trim(), pk,
        have: r2(have / unitPk), daily: r2(daily / unitPk), left: Math.round(left * 10) / 10, need: Math.max(1, Math.ceil(needPcs / unitPk)), lvl: left <= red ? 'red' : 'yellow',
        party: party.slice(0, 60), phone: phone92(l?.Phone), lr: l ? r2((Number(l.Rate) || 0) * unitPk) : 0, lq: l ? r2((Number(l.Qty) || 0) / unitPk) : 0, ld: l?.PurchaseDate ? dayOf(new Date(l.PurchaseDate)) : '' });
    }
    items.sort((a, b) => a.left - b.left || a.n.localeCompare(b.n));
    const top = items.slice(0, 150);
    return { at: Date.now(), day: dayOf(now()), red, yellow, redN: items.filter(x => x.lvl === 'red').length, yellowN: items.filter(x => x.lvl === 'yellow').length, items: top };
  }

  // ---------- 🌙 raat ki report ----------
  async function buildReport(day, cfg, alert) {
    cfg = cfg || await cfgGet();
    const p = await getPool(), names = await branchNames(p);
    const d0 = new Date(day + 'T00:00:00'), d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const wsNames = Array.isArray(cfg.wsNames) && cfg.wsNames.length ? cfg.wsNames : DEF.wsNames, small = Math.max(1, Number(cfg.wsSmall) || 3);
    const pcN = pcNames();
    // --- sale ---
    const bills = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`SELECT s.SaleID, s.SaleNo, s.SaleDate, s.TotalSale, s.CashReceived, s.IsCreditSale, s.DocStatusID, s.COGS, s.Description, s.SystemNotes, pt.PartyName
      FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID WHERE s.SaleDate >= @a AND s.SaleDate < @b`)).recordset;
    const lines = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`SELECT d.SaleID, d.ItemID, d.Qty, d.Rate, i.ItemName, ISNULL(i.PackQty,0) AS Pack,
      ISNULL(NULLIF(r.SaleRate,0), i.SaleRate) AS SR, ISNULL(NULLIF(r.SaleRate2,0), i.SaleRate2) AS SR2, ISNULL(NULLIF(r.SaleRate3,0), i.SaleRate3) AS SR3, ISNULL(NULLIF(r.SaleRateSize,0), i.SaleRateSize) AS SRS,
      ISNULL(NULLIF(r.PurchaseRate,0), i.PurchaseRate) AS PR
      FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID JOIN dbo.Items i ON i.ItemID = d.ItemID LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = d.ItemID AND r.BranchID = 1
      WHERE s.SaleDate >= @a AND s.SaleDate < @b`)).recordset;
    const lBy = new Map(); for (const l of lines) { const k = Number(l.SaleID); if (!lBy.has(k)) lBy.set(k, []); lBy.get(k).push(l); }
    const sale = { n: 0, total: 0, cash: 0, credit: 0, creditN: 0, cancelN: 0, returnN: 0, returnRs: 0, profit: 0, cogsBills: 0 };
    const loss = [], wsBills = []; let lossRs = 0;
    for (const b of bills) {
      const party = String(b.PartyName || '').trim();
      if (Number(b.DocStatusID) === 3) { sale.cancelN++; continue; }
      if (SKIP_RX.test(party)) continue;
      const total = Number(b.TotalSale) || 0, L = lBy.get(Number(b.SaleID)) || [];
      if (total < 0) { sale.returnN++; sale.returnRs += -total; }
      sale.n++; sale.total += total;
      if (b.IsCreditSale) { sale.creditN++; sale.credit += total - (Number(b.CashReceived) || 0); sale.cash += Number(b.CashReceived) || 0; } else sale.cash += total;
      const sn = String(b.SystemNotes || ''), host = ((sn.match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || '').toUpperCase(), by = ((sn.match(/By:\s*([^\r\n]+?)\s+On:/i) || [])[1] || '').trim();
      const pc = String(pcN[host] || host.replace(/^DESKTOP-/i, '') || 'POS').slice(0, 24), who = /blue khata/i.test(by) ? 'App' : by.slice(0, 20);
      let lineCost = 0, bLoss = 0; const lossLines = [];
      let farq = 0, smallN = 0, wsRateN = 0;
      for (const l of L) {
        const q = Number(l.Qty) || 0, rate = Number(l.Rate) || 0, pk = Number(l.Pack) || 0, sr = Number(l.SR) || 0;
        const cost = pieceCost(perPiece(l.PR, pk, sr), pk, sr);
        lineCost += q * cost;
        if (q > 0 && cost > 0 && rate < cost * 0.999) { const ls = (cost - rate) * q; bLoss += ls; lossLines.push({ n: String(l.ItemName || '').trim().slice(0, 40), q: r3(q), rate: r2(rate), cost: r2(cost) }); }
        const full = pk > 1 && Math.abs(q / pk - Math.round(q / pk)) < 1e-6;
        const retail = full ? sr : (Number(l.SR2) || sr), wsr = full ? (Number(l.SR3) || Number(l.SRS) || 0) : (Number(l.SRS) || Number(l.SR3) || 0);
        if (q > 0 && retail > 0 && rate < retail * 0.995) farq += (retail - rate) * q;
        if (q > 0 && q < small) smallN++;
        if (q > 0 && wsr > 0 && rate <= wsr * 1.005 && rate < retail * 0.995) wsRateN++;
      }
      const cogs = Number(b.COGS) || 0;
      if (cogs > 0) { sale.profit += total - cogs; sale.cogsBills++; } else sale.profit += total - lineCost;
      if (bLoss >= 1) { lossRs += bLoss; loss.push({ no: String(b.SaleNo || '').trim(), at: b.SaleDate ? new Date(b.SaleDate).getTime() : 0, party: party.slice(0, 40), pc, by: who, rs: r2(bLoss), items: lossLines.slice(0, 5) }); }
      const named = isWs(party, wsNames), counter = !named && L.length > 0 && wsRateN >= Math.ceil(L.length / 2);
      if (named || counter) {
        const shak = L.length > 0 && smallN >= Math.ceil(L.length / 2);
        wsBills.push({ id: Number(b.SaleID), no: String(b.SaleNo || '').trim(), at: b.SaleDate ? new Date(b.SaleDate).getTime() : 0, party: party.slice(0, 40), pc, by: who, total: r2(total), farq: r2(farq), lines: L.length, small: smallN, shak, counter });
      }
    }
    for (const k of ['total', 'cash', 'credit', 'returnRs', 'profit']) sale[k] = r2(sale[k]);
    sale.profitPct = sale.total > 0 ? Math.round(sale.profit / sale.total * 1000) / 10 : 0;
    loss.sort((a, b) => b.rs - a.rs);
    wsBills.sort((a, b) => (b.shak - a.shak) || (b.farq - a.farq));
    const ws = { n: wsBills.length, total: r2(wsBills.reduce((s, x) => s + x.total, 0)), farq: r2(wsBills.reduce((s, x) => s + x.farq, 0)),
      shakN: wsBills.filter(x => x.shak).length, shakFarq: r2(wsBills.filter(x => x.shak).reduce((s, x) => s + x.farq, 0)), counterN: wsBills.filter(x => x.counter).length, small, bills: wsBills.slice(0, 40) };
    // --- purchase ---
    const pl = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`SELECT d.PurchaseID, d.ItemID, d.Qty, d.Rate, i.ItemName, ISNULL(i.PackQty,0) AS Pack,
      (SELECT TOP 1 d2.Rate FROM dbo.PurchaseDetail d2 JOIN dbo.Purchase p2 ON p2.PurchaseID = d2.PurchaseID WHERE d2.ItemID = d.ItemID AND d2.PurchaseID < d.PurchaseID AND ISNULL(p2.DocStatusID,0) <> 3 ORDER BY d2.PurchaseID DESC, d2.PurchaseDetailID DESC) AS Prev
      FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID JOIN dbo.Items i ON i.ItemID = d.ItemID LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID
      WHERE p.PurchaseDate >= @a AND p.PurchaseDate < @b AND ISNULL(p.DocStatusID,0) <> 3 AND ISNULL(pt.PartyName,'') NOT LIKE '%noor%trader%'`)).recordset;
    const purchase = { n: new Set(pl.map(x => x.PurchaseID)).size, total: r2(pl.reduce((s, x) => s + (Number(x.Qty) || 0) * (Number(x.Rate) || 0), 0)), mehnga: [] };
    for (const x of pl) { const pr = Number(x.Prev) || 0, nw = Number(x.Rate) || 0, u = Number(x.Pack) > 1 ? Number(x.Pack) : 1; if (pr > 0 && nw > pr * 1.0005) purchase.mehnga.push({ n: String(x.ItemName || '').trim().slice(0, 40), prev: r2(pr * u), now: r2(nw * u) }); }
    purchase.mehngaN = purchase.mehnga.length; purchase.mehnga = purchase.mehnga.slice(0, 10);
    // --- stock ki maaliyat ---
    const sv = (await p.request().query(`SELECT r.BranchID, r.CurrStock, r.PurchaseRate AS BC, i.PurchaseRate AS IPR, ISNULL(i.PackQty,0) AS Pack, ISNULL(NULLIF(r.SaleRate,0), i.SaleRate) AS SR
      FROM dbo.ItemBranchRate r JOIN dbo.Items i ON i.ItemID = r.ItemID WHERE r.CurrStock <> 0`)).recordset;
    const per = {}; let value = 0, negN = 0;
    for (const x of sv) { const q = Number(x.CurrStock) || 0; if (q < -0.0005) { negN++; continue; } if (q <= 0.0005) continue;
      const c0 = Number(x.BC) > 0 ? r2(x.BC) : r2(perPiece(x.IPR, x.Pack, x.SR)), c = pieceCost(c0, x.Pack, x.SR), v = q * c;
      const nm = names[x.BranchID] || ('Branch ' + x.BranchID); per[nm] = (per[nm] || 0) + v; value += v; }
    for (const k of Object.keys(per)) per[k] = Math.round(per[k]);
    let prevValue = null; try { const pr = await access.doc('report-' + prevDay(day)).get(); if (pr.exists) prevValue = Number(pr.data()?.stock?.value) || null; } catch {}
    const stock = { value: Math.round(value), per, prev: prevValue, negN };
    // --- khata (Firestore) ---
    let khata = null;
    try { const ks = await biz.collection('blueKhata').where('date', 'in', [day, prevDay(day)]).get(); const d = dailyOf(day, ks.docs.map(x => ({ ...x.data(), id: x.id })));
      khata = { sale: d.sale, collection: d.collection, expense: d.expense, payment: d.payment, credit: d.credit, borrow: d.borrow, opening: d.opening, cash: d.cash, closed: d.closed, difference: d.difference }; } catch (e) { log('khata nahi parha: ' + e.message); }
    // --- transfer notes ---
    let transfer = null;
    try {
      const ts = await biz.collection('posTransfers').where('at', '>=', d0.getTime() - 864e5).get(), ck = await biz.collection('transferChecks').where('issuedAt', '>=', d0.getTime() - 2 * 864e5).get();
      const done = new Set(ck.docs.map(x => x.id)), farq = ck.docs.map(x => x.data()).filter(x => x.status === 'farq' && (x.issuedAt || 0) >= d0.getTime() && (x.issuedAt || 0) < d1.getTime());
      const today = ts.docs.map(x => ({ ...x.data(), id: x.id })).filter(t => { const at = Number(t.createdOn) || Number(t.at) || 0; return at >= d0.getTime() && at < d1.getTime(); });
      const pend = today.filter(t => !done.has(t.id) && !t.cancelled && !/sirf\s*hisaa?b/i.test(String(t.note || '')));   // v1.4: "sirf hisaab" (stock theek / ginti farq — maal hila nahi) + cancel = check baqi NAHI
      transfer = { n: today.length, pendingN: pend.length, pending: pend.slice(0, 10).map(t => ({ no: String(t.transferNo || t.transferId), at: Number(t.createdOn) || Number(t.at) || 0, from: names[t.from] || String(t.from), to: names[t.to] || String(t.to) })),
        farqN: farq.length, farq: farq.slice(0, 5).map(x => ({ no: String(x.transferNo || ''), note: String(x.note || '').slice(0, 80), by: String(x.byName || '') })) };
    } catch (e) { log('transfer nahi parhe: ' + e.message); }
    // --- stock ginti ---
    let ginti = null;
    try {
      const sc = await biz.collection('stockCount').where('at', '>=', d0.getTime()).get();
      const rows = sc.docs.map(x => x.data()).filter(x => x && x.itemId != null && (x.at || 0) < d1.getTime());
      if (rows.length) {
        const ids = [...new Set(rows.map(x => Number(x.itemId)).filter(Number.isFinite))];
        const cost = new Map(); if (ids.length) (await p.request().query(`SELECT i.ItemID, ISNULL(NULLIF(r.PurchaseRate,0), i.PurchaseRate) AS PR, ISNULL(i.PackQty,0) AS Pack, ISNULL(NULLIF(r.SaleRate,0), i.SaleRate) AS SR FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = 1 WHERE i.ItemID IN (${ids.slice(0, 900).join(',')})`)).recordset.forEach(x => cost.set(Number(x.ItemID), pieceCost(perPiece(x.PR, x.Pack, x.SR), x.Pack, x.SR)));
        let fN = 0, fRs = 0; for (const x of rows) { const sys = x.sysPos != null && x.sysPosAt === x.at ? Number(x.sysPos) : Number(x.sys) || 0, g = (Number(x.total) || 0) - sys; if (Math.abs(g) > 0.001) { fN++; fRs += g * (cost.get(Number(x.itemId)) || 0); } }
        ginti = { n: rows.length, farqN: fN, farqRs: r2(fRs) };
      }
    } catch (e) { log('ginti nahi parhi: ' + e.message); }
    // --- DHYAN ---
    const flags = [];
    if (loss.length) flags.push(`${loss.length} bill khareed se kam par bike (ghaata ${rs(lossRs)})`);
    if (ws.shakN) flags.push(`${ws.shakN} wholesale bill shak wale (chhoti tadad) · farq ${rs(ws.shakFarq)}`);
    if (ws.counterN) flags.push(`${ws.counterN} bill counter par wholesale rate par`);
    if (khata && khata.closed && Math.abs(khata.difference) >= 100) flags.push(`Cash farq ${rs(khata.difference / 100)}`);
    if (khata && !khata.closed) flags.push('Closing cash abhi nahi gini');
    if (transfer && transfer.pendingN) flags.push(`${transfer.pendingN} transfer note check nahi hue`);
    if (transfer && transfer.farqN) flags.push(`${transfer.farqN} transfer note mein farq`);
    if (purchase.mehngaN) flags.push(`${purchase.mehngaN} item mehngay khareede`);
    if (ginti && ginti.farqN) flags.push(`Ginti mein ${ginti.farqN} item ka farq (${rs(ginti.farqRs)})`);
    if (alert && alert.redN) flags.push(`${alert.redN} item ${alert.red} din mein khatam`);
    return { day, at: Date.now(), ver: VER, sale, loss: loss.slice(0, 8), lossN: loss.length, lossRs: r2(lossRs), ws, purchase, stock, khata, transfer, ginti,
      alert: alert ? { red: alert.red, redN: alert.redN, yellowN: alert.yellowN, top: alert.items.filter(x => x.lvl === 'red').slice(0, 8).map(x => ({ n: x.n, left: x.left })) } : null, flags };
  }

  // ---------- chalana ----------
  const stFile = path.join(DIR, 'report-state.json');
  const readSt = () => { try { return JSON.parse(fs.readFileSync(stFile, 'utf8')) || {}; } catch { return {}; } };
  const saveSt = s => { try { fs.writeFileSync(stFile, JSON.stringify(s)); } catch {} };
  async function runAlert(cfg, why) {
    const a = await buildAlert(cfg);
    await access.doc('stockAlert').set(a);
    log(`⏰ alert (${why}): ${a.redN} laal · ${a.yellowN} peela`);
    if (a.redN) { const t = a.items.filter(x => x.lvl === 'red').slice(0, 4).map(x => `${x.n} (${x.left <= 0 ? 'khatam' : x.left + ' din'})`).join(', ');
      try { const r = await pushOwner(`⏰ ${a.redN} item jald khatam`, t + (a.redN > 4 ? ` +${a.redN - 4}` : '') + ' · tap = order', 'stock-alert', LINK + '?alert=1'); log(`push: ${r?.successCount ?? 0} phone`); } catch (e) { log('push masla: ' + e.message); } }
    return a;
  }
  async function runReport(day, cfg, why) {
    const r = await buildReport(day, cfg, null);   // v1.3: ⏰ khatam-maal ka hisaab band (report mein alert card nahi)
    await access.doc('report-' + day).set(r);
    try { const old = new Date(day + 'T12:00:00'); old.setDate(old.getDate() - KEEP_DAYS); await access.doc('report-' + dayOf(old)).delete(); } catch {}
    const body = `Sale ${rs(r.sale.total)} · Nafa ~${rs(r.sale.profit)}` + (r.flags.length ? ` · ⚠️ ${r.flags.length} baatein` : ' · ✓ sab theek');
    log(`🌙 report ${day} (${why}): ${body}`);
    try { const x = await pushOwner(`🌙 Aaj ki report (${new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`, body, 'report-' + day, LINK + '?report=' + day); log(`push: ${x?.successCount ?? 0} phone`); } catch (e) { log('push masla: ' + e.message); }
    return r;
  }
  let busy = false, lastAlive = 0;
  async function tick() {
    if (busy) return; busy = true;
    const dog = setTimeout(() => { log('CHOWKIDAR: kaam 6 min se atka — script band, bat dobara chalayegi'); process.exit(4); }, 6 * 60000); dog.unref?.();   // v1.1
    try {
      const cfg = await cfgGet(), st = readSt(), t = now(), hm = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`, day = dayOf(t);
      const due = (time, key, win = 3) => { const [h, m] = String(time || '').split(':').map(Number); if (!Number.isFinite(h)) return false; const d = new Date(t); d.setHours(h, m || 0, 0, 0); return hm >= `${pad2(h)}:${pad2(m || 0)}` && t.getTime() - d.getTime() < win * 3600e3 && st[key] !== day; };   // alert: 3 ghante; report (v1.1): usi din jab bhi chale (PC band / atka tha)
      // v1.3: ⏰ subah ki khatam-maal khabar (runAlert) BAND — malik ne kaha zaroorat nahi
      if (Number(cfg.reportNow) > (st.reportNow || 0)) { st.reportNow = Number(cfg.reportNow); saveSt(st); await runReport(String(cfg.reportDay || day), cfg, 'app se abhi'); }
      else if (cfg.reportOn !== false && due(cfg.reportTime, 'reportDay', 24)) { st.reportDay = day; saveSt(st); await runReport(day, cfg, 'raat'); }
      if (Date.now() - lastAlive > 5 * 60000) { lastAlive = Date.now(); try { await access.doc('reportConfig').set({ alive: Date.now(), ver: VER }, { merge: true }); } catch {} }   // app: "PC zinda"
      onBeat?.();   // v1.1: dhadkan SIRF tab jab chakkar poora hua
    } catch (e) { log('masla: ' + e.message); if (e?.code === 16 || /UNAUTHENTICATED/.test(String(e?.message))) process.exit(1); }
    finally { clearTimeout(dog); busy = false; }
  }
  return { buildAlert, buildReport, runAlert, runReport, tick, cfgGet };
}

module.exports = { makeReporter, dailyOf, perPiece, pieceCost, isWs, phone92, DEF };

if (require.main === module) {
  const hb = path.join(DIR, 'raat-report.alive'), beat = () => { try { fs.writeFileSync(hb, String(Date.now())); } catch {} }; beat();   // v1.1: har kamyab chakkar par (30 sec) — atke to doctor 3 min mein dobara
  const log = (...a) => { const line = `[${new Date().toLocaleTimeString()}] ` + a.join(' '); console.log(line); };
  const sql = require('mssql');
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const SQL_CONFIG = require('./sql-config.js'); SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
  if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
  const biz = getFirestore().collection('businesses').doc(BUSINESS_ID);
  let pool = null; const getPool = async () => { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool({ requestTimeout: 120000, connectionTimeout: 15000, ...SQL_CONFIG }).connect(); return pool; };
  const pcNames = () => { try { return { ...PC_DEFAULT, ...(JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')).pcNames || {}) }; } catch { return PC_DEFAULT; } };
  const R = makeReporter({ getPool, sql, biz, log, pcNames, onBeat: beat });
  const arg = process.argv;
  if (arg.includes('--report') || arg.includes('--alert')) {
    (async () => { const cfg = await R.cfgGet(); if (arg.includes('--alert')) await R.runAlert(cfg, 'test'); if (arg.includes('--report')) { const d = arg[arg.indexOf('--report') + 1]; await R.runReport(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : dayOf(new Date()), cfg, 'test'); } process.exit(0); })()
      .catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
  } else {
    const lock = net.createServer();
    lock.once('error', () => { console.log('raat-report pehle se chal raha hai.'); process.exit(3); });
    lock.listen(LOCK_PORT, '127.0.0.1', async () => {
      try { await getPool(); } catch (e) { log('SQL se nahi jura: ' + e.message); process.exit(1); }
      log(`raat-report v${VER} chal raha hai (${os.hostname()}) — 🌙 raat ki report (⏰ khatam-maal khabar band)`);
      setTimeout(R.tick, 5000); setInterval(R.tick, 30000);
    });
  }
}
