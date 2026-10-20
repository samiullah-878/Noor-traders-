// =========================================================
//  proc-fill.js  v1.0 (2026-10-20) — POS (Cognitive) UPDATE ke baad procedures mein NAYE params aa gaye (19 Oct: usp_Items_InsertUpdate
//  '@IsAdvanceTaxable' → "expects parameter … which was not supplied", naya item nahi banta; band / sale / transfer bhi phans sakte hain).
//  Ye module mssql ke Request.execute ko lapet leta hai: har procedure call se pehle sys.parameters dekh kar jo param script ne NAHI diya
//  wo khud deta hai — number/bit = 0, text = '', date = NULL (POS form ke default jaise). Ek dafa dekh kar yaad (cache). Output params
//  nahi chhedta. Agar sys.parameters na parh sake to khamoshi se purana raasta (koi naya error nahi).
//  Istemal: const sql = require('mssql'); require('./proc-fill.js').patch(sql, log);   — har POS-likhne wali script mein ek line.
//  ⚠️ Qaida (CLAUDE.md §4): jin values se POS taqseem karta hai (PackQty) wo scripts khud deti hain — ye sirf NAYE / anjaan params bharta hai.
// =========================================================
const cache = new Map();
function typeOf(sql, r) {
  const t = String(r.t).toLowerCase(), len = Number(r.len);
  if (t === 'int') return sql.Int; if (t === 'bigint') return sql.BigInt; if (t === 'smallint') return sql.SmallInt; if (t === 'tinyint') return sql.TinyInt;
  if (t === 'bit') return sql.Bit; if (t === 'float') return sql.Float; if (t === 'real') return sql.Real; if (t === 'money') return sql.Money; if (t === 'smallmoney') return sql.SmallMoney;
  if (t === 'decimal' || t === 'numeric') return sql.Decimal(r.pr || 18, r.sc || 4);
  if (t === 'datetime') return sql.DateTime; if (t === 'smalldatetime') return sql.SmallDateTime; if (t === 'date') return sql.Date; if (t === 'datetime2') return sql.DateTime2;
  if (t === 'varchar') return sql.VarChar(len < 0 ? sql.MAX : len); if (t === 'char') return sql.Char(len);
  if (t === 'nvarchar') return sql.NVarChar(len < 0 ? sql.MAX : len / 2); if (t === 'nchar') return sql.NChar(len / 2);
  if (t === 'text') return sql.Text; if (t === 'ntext') return sql.NText; return null;
}
async function params(sql, parent, key) {
  if (cache.has(key)) return cache.get(key);
  const rows = (await new sql.Request(parent).input('n', sql.NVarChar(300), 'dbo.' + key).query(`
    SELECT REPLACE(name,'@','') AS n, TYPE_NAME(user_type_id) AS t, max_length AS len, precision AS pr, scale AS sc, is_output AS o
    FROM sys.parameters WHERE object_id = OBJECT_ID(@n) ORDER BY parameter_id`)).recordset;
  if (rows.length) cache.set(key, rows);
  return rows;
}
let patched = false;
function patch(sql, log) {
  if (patched || !sql?.Request?.prototype) return; patched = true;
  const orig = sql.Request.prototype.execute;
  sql.Request.prototype.execute = async function (name, ...rest) {
    try {
      const key = String(name || '').replace(/^\[?dbo\]?\./i, '').replace(/[\[\]]/g, '');
      if (/^usp_/i.test(key) && this.parent) {
        const P = await params(sql, this.parent, key);
        const have = new Set(Object.keys(this.parameters || {}).map(k => k.toLowerCase())), extra = [];
        for (const r of P) { if (r.o || have.has(String(r.n).toLowerCase())) continue; const ty = typeOf(sql, r); if (!ty) continue;
          const t = String(r.t).toLowerCase(), v = /char|text/.test(t) ? '' : /date/.test(t) ? null : 0; this.input(r.n, ty, v); extra.push(r.n); }
        if (extra.length && typeof log === 'function') log(`  (${key}: POS ke naye params khud bhare: ${extra.join(', ')})`);
      }
    } catch (e) { try { typeof log === 'function' && log('proc-fill: ' + (e?.message || e)); } catch {} }
    return orig.call(this, name, ...rest);
  };
}
module.exports = { patch, typeOf };
