// =========================================================
//  barcode-dhoondo.js  v1 (2026-10-09) — EK BARCODE kahan hai? SIRF PARHTA HAI, kuch nahi badalta.
//  Chalana (barcode-check.ps1 khud chalata hai):  node barcode-dhoondo.js 8964001187073
//  1) POS (SQL): Items.ItemCode + har "barcode" khana (ItemSubCode waghera) — bilkul wohi, warna milta-julta (aage / peeche ek hindsa kam-zyada)
//  2) App (Firestore posStock): app ko yeh barcode kis item par dikhta hai (sync-stock 2 min mein bhejta hai)
//  3) App ke hukum: subcodeJobs ("➕ Naya barcode") + itemJobs ("✏️ Item" ka Barcode khana) — status aur galti ka paigham
//  SQL password / chaabi kabhi nahi chhapta.
// =========================================================
const path = require('path');
const fs = require('fs');
const DIR = __dirname;
const CODE = String(process.argv[2] || '').trim();
if (!CODE) { console.log('Barcode do: node barcode-dhoondo.js 8964001187073'); process.exit(1); }
const say = (...a) => console.log(...a);
const t = ms => { const d = new Date(Number(ms) || 0); return isNaN(d) ? '-' : d.toLocaleString('en-GB', { hour12: true }); };

async function pos() {
  let sql, cfg;
  try { sql = require('mssql'); cfg = require('./sql-config.js'); } catch (e) { say('  POS: mssql / sql-config nahi mila — ' + e.message); return; }
  let p;
  try { p = await new sql.ConnectionPool(cfg).connect(); } catch (e) { say('  POS se rabta nahi: ' + e.message); return; }
  try {
    const cols = (await p.request().query(`
      SELECT c.TABLE_SCHEMA AS S, c.TABLE_NAME AS T, c.COLUMN_NAME AS C
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME AND tb.TABLE_TYPE = 'BASE TABLE'
      JOIN INFORMATION_SCHEMA.COLUMNS k ON k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = 'ItemID'
      WHERE c.DATA_TYPE IN ('varchar','nvarchar','char','nchar')
        AND (c.COLUMN_NAME LIKE '%barcode%' OR (c.TABLE_NAME = 'Items' AND c.COLUMN_NAME = 'ItemCode'))`)).recordset;
    say('  Dekhe gaye khane: ' + (cols.map(x => x.T + '.' + x.C).join(', ') || 'koi nahi'));
    const q = s => '[' + String(s).replace(/]/g, ']]') + ']';
    const look = async (where, val) => {
      const out = [];
      for (const c of cols) {
        const col = q(c.C), tbl = q(c.S) + '.' + q(c.T);
        try {
          const r = await p.request().input('v', sql.VarChar(60), val).query(
            `SELECT TOP 10 x.ItemID, LTRIM(RTRIM(CAST(x.${col} AS varchar(100)))) AS B, i.ItemName
             FROM ${tbl} x LEFT JOIN dbo.Items i ON i.ItemID = x.ItemID
             WHERE LTRIM(RTRIM(CAST(x.${col} AS varchar(100)))) ${where}`);
          for (const z of r.recordset) out.push({ src: c.T + '.' + c.C, id: z.ItemID, b: z.B, name: String(z.ItemName || '').trim() });
        } catch (e) { say(`  (${c.T}.${c.C} nahi parha: ${e.message})`); }
      }
      return out;
    };
    let hits = await look('= @v', CODE);
    if (hits.length) {
      say('  ✅ POS MEIN MILA:');
      for (const h of hits) say(`     • ${h.name || '(naam nahi)'}  [ItemID ${h.id}]  — ${h.src === 'Items.ItemCode' ? 'ASAL CODE' : h.src.startsWith('ItemSubCode') ? 'SUB-BARCODE' : h.src}`);
      if (new Set(hits.map(h => h.id)).size > 1) say('  ⚠️ Yeh barcode EK SE ZYADA item par hai — scan par POS ghalat item utha sakta hai');
      const sub = hits.find(h => h.src.startsWith('ItemSubCode'));
      if (sub) {
        try {
          const r = (await p.request().input('v', sql.VarChar(60), CODE).query(
            `SELECT TOP 5 ItemSubCodeID AS I, SBItemQty AS Q, SBSaleRate AS R, IsShowOnLookup AS S FROM dbo.ItemSubCode WHERE LTRIM(RTRIM(SBBarCode)) = @v`)).recordset;
          for (const x of r) say(`       sub-barcode #${x.I}: tadad ${x.Q} · rate ${x.R} · Show ${x.S ? '✓' : '✗'}`);
        } catch {}
      }
    } else {
      say('  ❌ POS mein yeh barcode BILKUL is shakal mein NAHI hai.');
      const a = CODE.length > 8 ? CODE.slice(0, -1) : '', b = CODE.length > 8 ? CODE.slice(1) : '';
      const near = a ? [...await look('LIKE @v', '%' + a + '%'), ...await look('LIKE @v', '%' + b + '%')] : [];
      const seen = new Set(), uniq = near.filter(h => { const k = h.src + h.id + h.b; if (seen.has(k)) return false; seen.add(k); return true; });
      if (uniq.length) { say('  🔎 MILTA-JULTA (ek hindsa kam / zyada — scan ghalat likha gaya ho sakta hai):'); for (const h of uniq.slice(0, 10)) say(`     • "${h.b}"  ${h.name}  [ItemID ${h.id}]  (${h.src})`); }
      else say('  Milta-julta bhi nahi mila.');
    }
  } finally { try { await p.close(); } catch {} }
}

async function app() {
  const KEY = path.join(DIR, 'firebase-key.json');
  if (!fs.existsSync(KEY)) { say('  (is PC par firebase-key nahi — app wali jaanch chhor di)'); return; }
  let db;
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require(KEY)) });
    db = getFirestore();
  } catch (e) { say('  firebase-admin nahi chala: ' + e.message); return; }
  const B = db.collection('businesses').doc('noor-traders');
  try {
    const snap = await B.collection('posStock').get();
    const found = [];
    for (const d of snap.docs) {
      const x = d.data() || {};
      for (const it of (x.items || [])) {
        const all = [it.code, ...(it.bc || []), ...((it.bq || []).map(z => z && z.b)), ...((it.sb || []).map(z => z && z.b))].map(v => String(v || '').trim());
        if (all.includes(CODE)) found.push(`${it.name} [ItemID ${it.id}] · ${x.name || d.id}`);
      }
    }
    say(found.length ? '  ✅ APP mein is item par: ' + [...new Set(found)].join(' | ') : '  ❌ APP ki stock list mein abhi nahi (POS mein ho to 2 min mein aa jata hai; item ka stock 0 ho to app list mein hi nahi hota)');
  } catch (e) { say('  App stock nahi parha: ' + e.message); }
  try {
    const s = await B.collection('subcodeJobs').where('code', '==', CODE).get();
    const L = s.docs.map(d => d.data()).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 5);
    if (L.length) { say('  📝 "➕ Naya barcode" ke hukum:'); for (const j of L) say(`     • ${t(j.at)} · ${j.op} · item ${j.itemId} · ${j.status}${j.error ? ' — ' + j.error : ''}`); }
    else say('  "➕ Naya barcode" se is barcode ka koi hukum nahi aaya.');
  } catch (e) { say('  subcodeJobs nahi parhe: ' + e.message); }
  try {
    const s = await B.collection('itemJobs').where('at', '>', Date.now() - 14 * 86400000).get();
    const L = s.docs.map(d => d.data()).filter(j => String(j.code || '').trim() === CODE || (j.subs || []).some(z => String(z && z.b || '').trim() === CODE))
      .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 5);
    if (L.length) { say('  📝 "✏️ Item" (Barcode khana) ke hukum:'); for (const j of L) say(`     • ${t(j.at)} · ${j.op} · ${j.name || ''} [item ${j.itemId || 'naya'}] · ${j.status}${j.error ? ' — ' + j.error : ''}`); }
    else say('  "✏️ Item" se pichhle 14 din mein is barcode ka koi hukum nahi.');
  } catch (e) { say('  itemJobs nahi parhe: ' + e.message); }
}

(async () => {
  say(`\n===== BARCODE "${CODE}" =====`);
  say('--- POS ---'); await pos();
  say('--- APP ---'); await app();
  say('');
  process.exit(0);
})().catch(e => { say('Galti: ' + (e && e.message || e)); process.exit(1); });
