// =========================================================
//  purchase-parchi.js  v1 (2026-10-10) — 🖨 PURCHASE BILL KI TAFSEELI PARCHI (transfer-sync.js isay chalata hai)
//  Malik: "jitne bhi purchase ke bill hain un ka print chahiye jaise hi larka add kare — pehle ka stock, abhi ka stock…"
//  1) POS mein NAYA purchase bill (POS se ya app se — purchase-post) aate hi khud TM-T88IV par parchi:
//     har item: tadad x rate = raqam · Stock pehle -> ab (us godam ka) · pichli khareed ka rate -> naya (+/-) ·
//     bechne ka rate + nafa % (kam / ghaata = "!!") · andaza kitne din ka maal (30 din ki bikri) · neeche Kul, NET,
//     DHYAN (mehngay / kam nafa), dastakhat.
//  2) Chhapa hua bill BADLA (items / tadad / rate / party) = dobara parchi "BADLA HUA BILL" + TABDEELI (kya badla).
//     Chhapa hua bill MITA / CANCEL = chhoti parchi "BILL MITA DIYA GAYA".
//  3) Bill aadha save na chhape: wohi nishan (stamp) 2 chakkar (~20 sec) tak na badle tab print.
//  4) Setting: Firestore blueAccess/printConfig { purchaseAuto (default ON), purchaseCopies 1-2, minNafa 3 } — app ka
//     malik Settings se. Haalat wapas: purchaseLast (aakhri 10 parchiyan) + purchaseAlive.
//  SQL mein KUCH NAHI likhta — sirf SELECT. Pehli dafa chalne par purane bill NAHI chhapta (sirf aage ke).
//  State: purchase-print.json (kaun sa bill kis nishan par chhapa).
// =========================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const W = 42;                          // TM-T88IV: 42 harf fi line
const ESC = '\x1b', GS = '\x1d';
const POLL_MS = 20000, KEEP_DAYS = 3, MAX_GONE = 3;
const pad = (s, w, right) => { s = String(s ?? '').slice(0, w); return right ? s.padStart(w) : s.padEnd(w); };
const line = (l, r) => { r = String(r); return pad(l, Math.max(0, W - r.length - 1)) + ' ' + r; };
const ascii = s => String(s ?? '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const money = v => { const x = r2(v); return x.toLocaleString('en-PK', { maximumFractionDigits: 2 }); };
const nf = v => r3(v).toLocaleString('en-PK', { maximumFractionDigits: 3 });
const pick = (row, names) => { for (const nm of names) for (const k of Object.keys(row || {})) if (k.toLowerCase() === nm.toLowerCase() && row[k] != null) return row[k]; return null; };
function stampOf(d) { const x = new Date(d); if (isNaN(x)) return ''; const h = x.getHours() % 12 || 12; return `${String(x.getDate()).padStart(2, '0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]}-${String(x.getFullYear()).slice(2)} ${h}:${String(x.getMinutes()).padStart(2, '0')}${x.getHours() < 12 ? 'am' : 'pm'}`; }

// pieces -> "12 ctn + 5 pcs" (pack > 1), warna "5 pcs"
function qtyStr(pcs, pack, cName, uName) {
  const q = r3(pcs), pk = Number(pack) || 0, c = ascii(cName || 'ctn').toLowerCase() || 'ctn', u = ascii(uName || 'pcs').toLowerCase() || 'pcs';
  if (pk > 1) { const neg = q < 0, a = Math.abs(q), ct = Math.floor(a / pk + 1e-9), p = r3(a - ct * pk); const s = (ct ? nf(ct) + ' ' + c : '') + (ct && p ? ' + ' : '') + (p || !ct ? nf(p) + ' ' + u : ''); return (neg ? '-' : '') + s; }
  return nf(q) + ' ' + u;
}
const unitRate = (ratePcs, pack) => (Number(pack) || 0) > 1 ? r2(ratePcs * pack) : r2(ratePcs);   // ctn ka rate (ya khule ka piece rate)
const unitName = (pack, cName, uName) => (Number(pack) || 0) > 1 ? (ascii(cName || 'ctn').toLowerCase() || 'ctn') : (ascii(uName || 'pcs').toLowerCase() || 'pcs');
const wrap = (s, w) => { const out = []; let cur = ''; for (const wd of ascii(s).split(' ')) { if ((cur + ' ' + wd).trim().length > w) { if (cur) out.push(cur); cur = wd.slice(0, w); } else cur = (cur + ' ' + wd).trim(); } if (cur) out.push(cur); return out.length ? out : ['']; };

// ---------- bill (SQL se) -> parchi ka text (pure — test ho sakta hai) ----------
function analyse(bill, minNafa) {
  const warn = { mehnga: [], sasta: [], kam: [], ghaata: [] };
  for (const l of bill.lines) {
    const pk = Number(l.pack) || 0, costU = unitRate(l.ratePcs, pk);
    l.unit = unitName(pk, l.cName, l.uName); l.costU = costU;
    l.prevU = l.prevRate > 0 ? unitRate(l.prevRate, pk) : 0;
    l.diff = l.prevU > 0 ? r2(costU - l.prevU) : 0;
    if (l.prevU > 0 && Math.abs(l.diff) >= 0.01) (l.diff > 0 ? warn.mehnga : warn.sasta).push(l);
    l.saleU = l.salePcs > 0 ? unitRate(l.salePcs, pk) : 0;
    l.nafa = l.saleU > 0 && costU > 0 ? Math.round((l.saleU - costU) / costU * 1000) / 10 : null;
    if (l.nafa != null && l.nafa < 0) warn.ghaata.push(l); else if (l.nafa != null && l.nafa < minNafa) warn.kam.push(l);
    l.days = l.s30 > 0 && l.totalStock > 0 ? Math.round(l.totalStock / (l.s30 / 30)) : null;
  }
  return warn;
}
function parchiText(bill, o = {}) {
  const minNafa = Number(o.minNafa) >= 0 ? Number(o.minNafa) : 3;
  const warn = analyse(bill, minNafa);
  const kind = o.kind || 'naya';
  const title = kind === 'badla' ? `BADLA HUA BILL (${o.n || 2})` : kind === 'dobara' ? 'PURCHASE BILL - DOBARA PRINT' : 'PURCHASE BILL (NAYA)';
  const out = [ESC + '@' + ESC + 'a' + '\x01' + ESC + '!' + '\x30' + (o.shop || 'NOOR TRADERS') + ESC + '!' + '\x00', ESC + '!' + '\x08' + title + ESC + '!' + '\x00' + ESC + 'a' + '\x00'];
  out.push(line('Bill: ' + ascii(bill.no), stampOf(bill.date)));
  for (const s of wrap('Supplier: ' + bill.party, W)) out.push(s);
  if (bill.invoice) out.push('Supplier bill #: ' + ascii(bill.invoice).slice(0, W - 17));
  if (bill.who) out.push(('Daala: ' + ascii(bill.who)).slice(0, W));
  const gods = [...new Set(bill.lines.map(l => ascii(l.godam)))], oneGodam = gods.length === 1;
  if (oneGodam && gods[0]) out.push(('Maal aaya: ' + gods[0]).slice(0, W));
  out.push('-'.repeat(W));
  if (kind === 'badla' && o.changes && o.changes.length) {
    out.push(ESC + '!' + '\x08' + 'TABDEELI (pichli parchi se):' + ESC + '!' + '\x00');
    for (const c of o.changes.slice(0, 15)) for (const s of wrap(c, W - 2)) out.push('  ' + s);
    out.push('-'.repeat(W));
  }
  let i = 0;
  for (const l of bill.lines) {
    i++;
    const gd = !oneGodam && l.godam ? '[' + ascii(l.godam).slice(0, 16) + ']' : '';
    const nm = `${i}) ${ascii(l.name)}`;
    if (nm.length + gd.length + 1 > W) { for (const x of wrap(nm, W)) out.push(ESC + '!' + '\x08' + x + ESC + '!' + '\x00'); if (gd) out.push('   Godam: ' + gd.slice(1, -1)); }
    else out.push(ESC + '!' + '\x08' + pad(nm, W - gd.length) + ESC + '!' + '\x00' + gd);
    const q = qtyStr(l.qtyPcs, l.pack, l.cName, l.uName);
    out.push(line(`   ${q} x ${money(l.costU)}`, '= ' + money(l.amount)));
    if (l.bonus > 0) out.push(`   Bonus: ${qtyStr(l.bonus, l.pack, l.cName, l.uName)}`);
    if (l.after != null) {
      const pe = l.before <= 0 ? (l.before < 0 ? qtyStr(l.before, l.pack, l.cName, l.uName) + ' (manfi)' : '0 (khatam)') : qtyStr(l.before, l.pack, l.cName, l.uName);
      const a = `   Stock: pehle ${pe}`, b = `-> ab ${qtyStr(l.after, l.pack, l.cName, l.uName)}`;
      if (a.length + 1 + b.length <= W) out.push(a + ' ' + b); else { out.push(a.slice(0, W)); out.push(('          ' + b).slice(0, W)); }
    }
    if (l.prevU > 0) out.push((`   Rate : pichla ${money(l.prevU)} -> naya ${money(l.costU)}` + (l.diff ? ` (${l.diff > 0 ? '+' : ''}${money(l.diff)})` : ' (wohi)')).slice(0, W));
    else out.push('   Rate : pehli dafa khareeda');
    if (l.saleU > 0) out.push((`   Bechna ${money(l.saleU)}/${l.unit}` + (l.nafa != null ? ` - nafa ${l.nafa}%` : '') + (l.nafa != null && l.nafa < 0 ? ' !! GHAATA' : l.nafa != null && l.nafa < minNafa ? ' !! KAM' : '')).slice(0, W));
    if (l.days != null) out.push(`   Andaza: ~${l.days > 365 ? '365+' : l.days} din ka maal`);
  }
  out.push('-'.repeat(W));
  let ctn = 0, loose = 0; for (const l of bill.lines) { const pk = Number(l.pack) || 0; if (pk > 1) { const c = Math.floor(l.qtyPcs / pk + 1e-9); ctn += c; loose += r3(l.qtyPcs - c * pk); } else loose += Number(l.qtyPcs) || 0; }
  out.push(`Kul: ${bill.lines.length} item - ${nf(ctn)} ctn${loose ? ' + ' + nf(loose) + ' pcs' : ''}`.slice(0, W));
  const gross = bill.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  if (bill.discount || bill.tax) out.push(line('Items ki raqam:', money(gross)));
  if (bill.discount) out.push(line('Discount:', '-' + money(bill.discount)));
  if (bill.tax) out.push(line('Tax:', '+' + money(bill.tax)));
  out.push(ESC + 'a' + '\x02' + ESC + '!' + '\x30' + ('NET Rs.' + money(bill.net)).slice(0, 21) + ESC + '!' + '\x00' + ESC + 'a' + '\x00');   // double = 21 harf
  const d = [];
  if (warn.mehnga.length) d.push(`${warn.mehnga.length} item mehnga hua: ` + warn.mehnga.slice(0, 3).map(l => ascii(l.name).split(' ').slice(0, 2).join(' ') + ' +' + money(l.diff)).join(', '));
  if (warn.ghaata.length) d.push(`${warn.ghaata.length} item GHAATE mein (bechna < khareed)`);
  if (warn.kam.length) d.push(`${warn.kam.length} item ka nafa ${minNafa}% se kam`);
  if (warn.sasta.length) d.push(`${warn.sasta.length} item sasta mila`);
  if (d.length) { out.push('-'.repeat(W), ESC + '!' + '\x08' + 'DHYAN:' + ESC + '!' + '\x00'); for (const x of d) for (const s of wrap(x, W - 2)) out.push('  ' + s); }
  out.push('-'.repeat(W), '', 'Maal gina:  ______________', '', 'Check kiya: ______________', '');
  out.push(`Print: ${stampOf(o.at || Date.now())} (${kind === 'dobara' ? 'dobara' : 'khud, auto'})`.slice(0, W));
  if (o.copy) out.push(`Copy ${o.copy}`);
  out.push('', '', '', GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}
function goneText(info, o = {}) {
  const out = [ESC + '@' + ESC + 'a' + '\x01' + ESC + '!' + '\x30' + (o.shop || 'NOOR TRADERS') + ESC + '!' + '\x00', ESC + '!' + '\x08' + (info.cancel ? 'PURCHASE BILL CANCEL HUA' : 'PURCHASE BILL MITA DIYA GAYA') + ESC + '!' + '\x00' + ESC + 'a' + '\x00', '-'.repeat(W)];
  out.push('Bill: ' + ascii(info.no), ...wrap('Supplier: ' + (info.party || ''), W), line('Raqam thi:', 'Rs.' + money(info.net)), `Items the: ${info.items || 0}`);
  out.push('-'.repeat(W), `Pata chala: ${stampOf(o.at || Date.now())}`, 'Yeh bill pehle chhap chuka tha.', '', '', '', GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}
// pichli parchi ke lines vs ab — kya badla (aasan zabaan)
function changesOf(oldL, bill) {
  const out = [], now = {};
  for (const l of bill.lines) { const k = l.itemId + '@' + (l.godamId || 0); now[k] = now[k] ? { ...now[k], q: now[k].q + l.qtyPcs } : { q: l.qtyPcs, r: l.ratePcs, n: l.name, pk: l.pack, c: l.cName, u: l.uName }; }
  const old = oldL || {};
  for (const [k, v] of Object.entries(now)) {
    const o = old[k];   // (_party / _net jaise khane yahan nahi aate — now mein sirf items)
    if (!o) { out.push(`+ ${ascii(v.n)}: ${qtyStr(v.q, v.pk, v.c, v.u)} (naya item)`); continue; }
    if (Math.abs(o.q - v.q) > 0.0005) out.push(`${ascii(v.n)}: ${qtyStr(o.q, v.pk, v.c, v.u)} -> ${qtyStr(v.q, v.pk, v.c, v.u)}`);
    if (Math.abs(o.r - v.r) > 0.00005) out.push(`${ascii(v.n)}: rate ${money(unitRate(o.r, v.pk))} -> ${money(unitRate(v.r, v.pk))}`);
  }
  for (const [k, o] of Object.entries(old)) if (!k.startsWith('_') && !now[k]) out.push(`- ${ascii(o.n)}: ${qtyStr(o.q, o.pk, o.c, o.u)} HATA DIYA`);
  if (oldL && oldL._party && oldL._party !== bill.party) out.push(`Supplier: ${ascii(oldL._party)} -> ${ascii(bill.party)}`);
  if (oldL && oldL._net != null && Math.abs(oldL._net - bill.net) >= 0.01) out.push(`NET: ${money(oldL._net)} -> ${money(bill.net)}`);
  return out;
}
function linesSnap(bill) {
  const s = { _party: bill.party, _net: bill.net };
  for (const l of bill.lines) { const k = l.itemId + '@' + (l.godamId || 0); s[k] = s[k] ? { ...s[k], q: r3(s[k].q + l.qtyPcs) } : { q: r3(l.qtyPcs), r: l.ratePcs, n: String(l.name).slice(0, 60), pk: l.pack, c: l.cName, u: l.uName }; }
  return s;
}

// ---------- SQL (sirf SELECT) ----------
let userTbl;   // undefined = abhi nahi dhoonda, null = nahi mila
async function userName(p, sql, id) {
  if (!(Number(id) > 0)) return '';
  try {
    if (userTbl === undefined) {
      const t = (await p.request().query(`SELECT TOP 1 c.TABLE_NAME AS T, n.COLUMN_NAME AS N FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.COLUMNS n ON n.TABLE_NAME = c.TABLE_NAME
        WHERE c.COLUMN_NAME = 'UserID' AND c.TABLE_NAME LIKE '%User%' AND (n.COLUMN_NAME LIKE '%UserName%' OR n.COLUMN_NAME LIKE '%FullName%' OR n.COLUMN_NAME = 'Name' OR n.COLUMN_NAME LIKE '%LoginName%')
        ORDER BY LEN(c.TABLE_NAME), CASE WHEN n.COLUMN_NAME LIKE '%FullName%' THEN 0 WHEN n.COLUMN_NAME LIKE '%UserName%' THEN 1 ELSE 2 END`)).recordset[0];
      userTbl = t ? { t: t.T, n: t.N } : null;
    }
    if (!userTbl) return '';
    const r = (await p.request().input('u', sql.Int, Number(id)).query(`SELECT TOP 1 [${userTbl.n}] AS N FROM dbo.[${userTbl.t}] WHERE UserID = @u`)).recordset[0];
    return ascii(r?.N || '');
  } catch { userTbl = null; return ''; }
}
const Q_HEAD = `SELECT p.*, pt.PartyName FROM dbo.Purchase p LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID WHERE p.PurchaseID = @id`;
const Q_LINES = `SELECT d.*, i.ItemName, i.PackQty AS ItemPackQty, i.PackQtyName, i.QtyName FROM dbo.PurchaseDetail d JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.PurchaseID = @id ORDER BY d.PurchaseDetailID`;
const Q_STOCK = `SELECT ISNULL((SELECT CurrStock FROM dbo.ItemBranchRate WHERE ItemID = @i AND BranchID = @b), 0) AS S,
  ISNULL((SELECT SUM(CurrStock) FROM dbo.ItemBranchRate WHERE ItemID = @i), 0) AS T,
  (SELECT TOP 1 ISNULL(NULLIF(r.SaleRate, 0), i.SaleRate) FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = 1 WHERE i.ItemID = @i) AS SR,
  (SELECT TOP 1 ISNULL(NULLIF(r.SaleRate2, 0), i.SaleRate2) FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = 1 WHERE i.ItemID = @i) AS SR2`;
const Q_PREV = `SELECT TOP 1 d.Rate, p.PurchaseDate FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID
  WHERE d.ItemID = @i AND d.PurchaseID < @id AND ISNULL(p.DocStatusID, 0) <> 3 ORDER BY d.PurchaseID DESC, d.PurchaseDetailID DESC`;
const Q_S30 = `SELECT ISNULL(SUM(d.Qty), 0) AS Q FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
  WHERE d.ItemID = @i AND s.SaleDate >= DATEADD(day, -30, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3
  AND ISNULL(pt.PartyName, '') NOT LIKE '%noor%trader%' AND ISNULL(pt.PartyName, '') NOT LIKE '%our factory%'`;

async function readBill(p, sql, id, names = {}, getWho) {
  const h = (await p.request().input('id', sql.Int, id).query(Q_HEAD)).recordset[0];
  if (!h) return null;
  const rows = (await p.request().input('id', sql.Int, id).query(Q_LINES)).recordset;
  const headBranch = Number(h.BranchID) || 1;
  const lines = [];
  const qtyAt = {};   // is bill ka item@godam ka kul (stock pehle = ab - yeh)
  for (const l of rows) {
    const pack = Number(l.ItemPackQty) || 0, qtyPcs = Number(pick(l, ['Qty', 'Quantity']) ?? 0), ratePcs = Number(pick(l, ['Rate', 'PreRate']) ?? 0);
    const bonus = Number(pick(l, ['Bonus', 'BonusQty']) ?? 0) || 0, amt = pick(l, ['Amount', 'NetAmount', 'TotalAmount', 'LineTotal']);
    const gid = Number(pick(l, ['GBranchID', 'BranchID'])) || headBranch;
    const lr = Number(pick(l, ['SaleRate'])) || 0, lr2 = Number(pick(l, ['SaleRate2'])) || 0;
    const L = { itemId: Number(l.ItemID), name: String(l.ItemName || '').trim(), pack, cName: String(l.PackQtyName || 'Ctn').trim(), uName: String(l.QtyName || 'Pcs').trim(),
      qtyPcs: r3(qtyPcs), ratePcs: Math.round(ratePcs * 10000) / 10000, bonus: r3(bonus), amount: r2(amt != null ? Number(amt) : qtyPcs * ratePcs),
      godamId: gid, godam: names[gid] || ('Branch ' + gid), _lr: lr, _lr2: lr2 };
    const k = L.itemId + '@' + gid; qtyAt[k] = (qtyAt[k] || 0) + qtyPcs + bonus;
    lines.push(L);
  }
  const live = Number(h.DocStatusID) !== 3;
  const seen = {};
  for (const L of lines) {
    try {
      const k = L.itemId + '@' + L.godamId;
      const st = (await p.request().input('i', sql.Int, L.itemId).input('b', sql.Int, L.godamId).query(Q_STOCK)).recordset[0] || {};
      if (!seen[k]) { L.after = r3(st.S); L.before = r3(Number(st.S) - (live ? qtyAt[k] : 0)); seen[k] = 1; }   // ek item do lines mein = stock sirf pehli line par
      L.totalStock = Number(st.T) || 0;
      // bechne ka rate (fi piece): bill ki line ka (POS purchase screen R.CTN ÷ pack), warna item ka maujooda
      L.salePcs = (L.pack > 1 ? (L._lr || Number(st.SR)) : (L._lr2 || L._lr || Number(st.SR2) || Number(st.SR))) || 0;
      const pr = (await p.request().input('i', sql.Int, L.itemId).input('id', sql.Int, id).query(Q_PREV)).recordset[0];
      L.prevRate = pr ? Number(pr.Rate) || 0 : 0;
      L.s30 = Number((await p.request().input('i', sql.Int, L.itemId).query(Q_S30)).recordset[0]?.Q) || 0;
    } catch (e) { L.err = e.message; }
    delete L._lr; delete L._lr2;
  }
  const tax = r2(h.TaxAmount), discount = r2(h.DiscountAmt);
  const bill = { id: Number(h.PurchaseID), no: String(h.PurchaseNo || '').trim() || ('#' + h.PurchaseID), date: h.PurchaseDate, party: String(h.PartyName || '').trim(),
    partyId: Number(h.PartyID) || 0, invoice: String(h.PartyInvoiceNo || '').trim(), status: Number(h.DocStatusID) || 1, tax, discount, lines,
    net: r2(lines.reduce((s, l) => s + l.amount, 0) + tax - discount), desc: String(h.Description || ''), createdBy: Number(h.CreatedBy) || 0, updatedBy: Number(h.UpdatedBy) || 0 };
  bill.who = getWho ? await getWho(bill) : '';
  return bill;
}
// bill ka nishan: party + har line (item, tadad, rate, godam) + discount/tax — badle to "badla hua"
function stampRows(partyId, rows, disc, tax) {
  const s = rows.map(r => [Number(r.ItemID), r3(r.Qty), Math.round((Number(r.Rate) || 0) * 10000) / 10000, Number(r.GBranchID) || 0].join('|')).sort().join(';');
  return crypto.createHash('sha1').update(partyId + '#' + s + '#' + r2(disc) + '#' + r2(tax)).digest('hex').slice(0, 16);
}

// ---------- watcher ----------
function createWatcher(o) {
  const { getPool, sql, log = () => {}, sendRaw, branchNames, cfgRef, stateFile, appWho } = o;
  let cfg = { purchaseAuto: true, purchaseCopies: 1, minNafa: 3 }, state = null, pending = {}, goneSeen = {}, retryAt = {}, last = [], busy = false, stopCfg = null;
  const load = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; } };
  const save = () => { try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) { log('purchase-print.json nahi likha: ' + e.message); } };
  const report = async (row) => {
    if (row) { last = [row, ...last].slice(0, 10); }
    if (!cfgRef) return;
    try { await cfgRef.set({ purchaseLast: last, purchaseAlive: Date.now() }, { merge: true }); } catch (e) { log('printConfig haalat nahi likhi: ' + e.message); }
  };
  if (cfgRef && cfgRef.onSnapshot) stopCfg = cfgRef.onSnapshot(s => { const d = s.exists ? (s.data() || {}) : {}; cfg = { purchaseAuto: d.purchaseAuto !== false, purchaseCopies: Math.min(2, Math.max(1, Number(d.purchaseCopies) || 1)), minNafa: Number(d.minNafa) >= 0 ? Number(d.minNafa) : 3 }; if (Array.isArray(d.purchaseLast) && !last.length) last = d.purchaseLast.slice(0, 10); }, e => log('printConfig listener: ' + e.message));
  const who = async (bill) => {
    const app = bill.desc.startsWith('BK-PUR ') ? bill.desc.slice(7).trim() : '';
    if (app) { let w = ''; try { w = appWho ? await appWho(app) : ''; } catch {} return 'App se' + (w ? ' (' + w + ')' : ''); }
    const p = await getPool(); const u = await userName(p, sql, bill.updatedBy || bill.createdBy);
    return 'POS' + (u ? ' (' + u + ')' : '');
  };
  async function printText(text, doc, copies) { let e = null; for (let i = 0; i < copies && !e; i++) e = await sendRaw(text, doc); return e; }
  async function printBill(id, kind, prev) {
    const p = await getPool(), names = branchNames ? await branchNames(p).catch(() => ({})) : {};
    const bill = await readBill(p, sql, id, names, who);
    if (!bill || !bill.lines.length) return null;
    const n = kind === 'badla' ? (prev?.n || 1) + 1 : 1;
    const text = parchiText(bill, { kind, n, changes: kind === 'badla' ? changesOf(prev?.lines, bill) : null, minNafa: cfg.minNafa });
    const err = await printText(text, 'Purchase ' + bill.no, cfg.purchaseCopies);
    if (err && retryAt[id]) { retryAt[id] = Date.now() + 120000; log(`Purchase print phir nahi hua (${bill.no}): ${err.message}`); return { bill, err }; }   // pehli ghalti hi app ko batao
    if (err) retryAt[id] = Date.now() + 120000; else delete retryAt[id];
    await report({ no: bill.no, party: bill.party.slice(0, 40), net: bill.net, items: bill.lines.length, kind, at: Date.now(), ok: !err, ...(err ? { err: String(err.message).slice(0, 120) } : {}) });
    if (err) { log(`Purchase print NAHI hua (${bill.no}): ${err.message}`); return { bill, err }; }
    log(`🖨 Purchase ${kind === 'badla' ? 'BADLA HUA' : 'naya'} chhapa: ${bill.no} · ${bill.party} · ${bill.lines.length} item · Rs ${money(bill.net)}`);
    return { bill, err: null };
  }
  async function poll() {
    if (busy) return; busy = true;
    try {
      const p = await getPool();
      if (!state) state = load();
      if (!state || !state.v) {   // pehli dafa: purane bill nahi chhapne
        const mx = Number((await p.request().query('SELECT ISNULL(MAX(PurchaseID), 0) AS M FROM dbo.Purchase')).recordset[0]?.M) || 0;
        state = { v: 1, floor: mx, done: {} }; save(); log(`Purchase auto-print shuru — bill #${mx} ke baad wale chhapenge`); await report(); return;
      }
      const cut = Date.now() - KEEP_DAYS * 864e5;
      for (const [k, v] of Object.entries(state.done)) if ((v.at || 0) < cut) delete state.done[k];
      const doneIds = Object.keys(state.done).map(Number);
      const from = Math.min(state.floor + 1, ...(doneIds.length ? doneIds : [Infinity]));
      const heads = (await p.request().input('f', sql.Int, from).query(`SELECT PurchaseID, PartyID, PurchaseNo, DocStatusID, PurchaseDate, ISNULL(DiscountAmt,0) AS D, ISNULL(TaxAmount,0) AS X FROM dbo.Purchase WHERE PurchaseID >= @f`)).recordset;
      const rows = heads.length ? (await p.request().input('f', sql.Int, from).query(`SELECT PurchaseID, ItemID, Qty, Rate, GBranchID FROM dbo.PurchaseDetail WHERE PurchaseID >= @f`)).recordset : [];
      const byId = new Map(heads.map(h => [Number(h.PurchaseID), { h, rows: [] }]));
      for (const r of rows) byId.get(Number(r.PurchaseID))?.rows.push(r);
      if (!cfg.purchaseAuto) {   // malik ne band kiya: kuch nahi chhapna — aur baad mein ON karne par purane bill bhi nahi
        if (byId.size) state.floor = Math.max(state.floor, ...byId.keys()); pending = {}; goneSeen = {}; save(); return;
      }
      const seenNow = {};
      for (const [id, { h, rows: rs }] of byId) {
        if (!rs.length) continue;   // abhi lines nahi aayin
        const cancel = Number(h.DocStatusID) === 3;
        const st = stampRows(Number(h.PartyID) || 0, rs, h.D, h.X), prev = state.done[id];
        seenNow[id] = 1;
        if (cancel) { if (prev && !prev.gone) await goneSlip(id, prev, true); continue; }
        if (id <= state.floor && !prev) continue;            // update se pehle ka bill
        if (prev && prev.stamp === st) { delete pending[id]; continue; }
        if (pending[id] !== st) { pending[id] = st; continue; }   // ek chakkar aur ruko (adhoora save na chhape)
        if (retryAt[id] && Date.now() < retryAt[id]) continue;    // printer masla: 2 min baad dobara
        delete pending[id];
        const r = await printBill(id, prev ? 'badla' : 'naya', prev);
        if (r && !r.err) { state.done[id] = { stamp: st, at: Date.now(), n: prev ? (prev.n || 1) + 1 : 1, no: r.bill.no, party: r.bill.party.slice(0, 40), net: r.bill.net, items: r.bill.lines.length, lines: linesSnap(r.bill) }; save(); }
        else if (r && r.err) { pending[id] = st; }   // printer masla: agle chakkar dobara
      }
      // chhapa hua bill POS se gayab (mita diya) — sirf jab query ne doosre bill dikhaye (khali jawab par kuch nahi)
      if (heads.length) {
        let n = 0;
        for (const id of doneIds) {
          if (seenNow[id] || state.done[id]?.gone || n >= MAX_GONE) continue;
          const chk = (await p.request().input('i', sql.Int, id).query('SELECT COUNT(*) AS C FROM dbo.Purchase WHERE PurchaseID = @i')).recordset[0];
          const lc = (await p.request().input('i', sql.Int, id).query('SELECT COUNT(*) AS C FROM dbo.PurchaseDetail WHERE PurchaseID = @i')).recordset[0];
          if (Number(chk?.C) === 0 || Number(lc?.C) === 0) {
            goneSeen[id] = (goneSeen[id] || 0) + 1;   // POS edit ke dauran lines pal bhar ke liye hat-ti hain — 2 chakkar tak gayab ho tab
            if (goneSeen[id] >= 2) { delete goneSeen[id]; await goneSlip(id, state.done[id], false); n++; }
          } else delete goneSeen[id];
        }
        for (const id of Object.keys(goneSeen)) if (seenNow[id]) delete goneSeen[id];
      }
      // floor = jahan tak sab bill nipat gaye (chhap gaye / cancel / 2 ghante se khali) — beech ka koi baqi ho to wahin ruko
      let f = state.floor;
      for (const id of [...byId.keys()].sort((a, b) => a - b)) {
        if (id <= f) continue;
        const x = byId.get(id), old = Date.now() - new Date(x.h.PurchaseDate).getTime() > 2 * 3600e3;
        if (state.done[id] || Number(x.h.DocStatusID) === 3 || (!x.rows.length && old)) f = id; else break;
      }
      state.floor = f;
      save();
    } catch (e) { log('Purchase auto-print masla: ' + e.message); }
    finally { busy = false; }
  }
  async function goneSlip(id, prev, cancel) {
    const err = await printText(goneText({ ...prev, cancel }, {}), 'Purchase gaya ' + (prev.no || id), 1);
    if (!err) { state.done[id] = { ...prev, gone: true, at: Date.now() }; save(); log(`🖨 Purchase ${cancel ? 'CANCEL' : 'MITA'}: ${prev.no || id}`); }
    await report({ no: prev.no || String(id), party: prev.party || '', net: prev.net || 0, items: prev.items || 0, kind: cancel ? 'cancel' : 'mita', at: Date.now(), ok: !err });
  }
  // app ka "Dobara print": wohi tafseeli parchi
  async function reprint(id, copies, send) {
    const p = await getPool(), names = branchNames ? await branchNames(p).catch(() => ({})) : {};
    const bill = await readBill(p, sql, id, names, who);
    if (!bill || !bill.lines.length) throw new Error('Purchase POS mein nahi mili');
    const txt = parchiText(bill, { kind: 'dobara', minNafa: cfg.minNafa }), nC = Math.min(3, Math.max(1, Number(copies) || 1)), sd = send || sendRaw;
    let err = null; for (let i = 0; i < nC && !err; i++) err = await sd(txt, 'Purchase ' + bill.no);   // transfer-sync ki queue ke andar se = seedha printer
    if (err) throw err;
    return bill;
  }
  let timer = null, alive = null;
  return {
    start() { timer = setInterval(poll, POLL_MS); alive = setInterval(() => report(), 5 * 60 * 1000); setTimeout(poll, 3000); },
    stop() { clearInterval(timer); clearInterval(alive); stopCfg?.(); },
    poll, reprint, get state() { return state; }, get cfg() { return cfg; },
  };
}

module.exports = { parchiText, goneText, changesOf, linesSnap, readBill, stampRows, createWatcher, qtyStr, W };
