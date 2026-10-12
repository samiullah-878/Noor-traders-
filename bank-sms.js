// bank-sms.js — v2.99.33 (2026-10-11): HBL ke SMS (paise AAYE) aur email (paise GAYE) parhna — seedhe qaide (regex), AI nahi.
// Malik ke asli namoone:
//  SMS  "PKR 15,700.00 received from USAMA USAM TMFB in your HBL A/C on 08/10/2026 16:38:44 via Raast TXN ID 3886751634051008."
//  SMS  "PKR 2,200.00 received from ZEESHAN AZEEM IBAN in your HBL A/C via your Raast ID on 08/10/2026 17:32:10 TXN ID SM08173159953..."
//  SMS  "Your HBL A/C 0257*****46303 has been credited with PKR 671,000.00 on 08/10/2026 via Cash Deposit in 0257 Branch."
//  EMAIL "HBL Mobile | Transfer to Other Bank": Amount PKR 72,500 · Receiver Account Title SALMAN SHEHZAD · Receiver Bank Name Meezan Bank Limited
//        · From Account Title Noor Traders · Date and Time 11-Oct-2026 16:10 · Channel via Raast · Transaction ID 1270380499
// Natija: { ok, dir:'in'|'out', amt (paise), name, bank, via, kind:'cash'|'party', day 'YYYY-MM-DD', time 'HH:MM', txn, acct }
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const BANK_TAIL = { IBAN: '', TMFB: 'Telenor Microfinance (Easypaisa)', EP: 'Easypaisa', EASYPAISA: 'Easypaisa', JAZZCASH: 'JazzCash', JC: 'JazzCash', MMBL: 'Mobilink (JazzCash)', HBL: 'HBL', UBL: 'UBL', MCB: 'MCB', ABL: 'Allied', BAFL: 'Bank Alfalah', MEEZAN: 'Meezan', NBP: 'NBP', SADAPAY: 'SadaPay', NAYAPAY: 'NayaPay', KONNECT: 'HBL Konnect', BOP: 'Bank of Punjab' };
const p2 = n => String(n).padStart(2, '0');
const amtOf = s => { const m = String(s || '').match(/(?:PKR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i); return m ? Math.round(Number(m[1].replace(/,/g, '')) * 100) : 0; };
function whenOf(t) {
  let m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/);   // 08/10/2026 16:38:44 (din/mahina/saal)
  if (m) return { day: `${m[3]}-${p2(m[2])}-${p2(m[1])}`, time: m[4] ? `${p2(m[4])}:${m[5]}` : '' };
  m = t.match(/(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{4})(?:[\s,]+(\d{1,2}):(\d{2}))?/);   // 11-Oct-2026 16:10
  if (m && MON[m[2].toLowerCase()]) return { day: `${m[3]}-${p2(MON[m[2].toLowerCase()])}-${p2(m[1])}`, time: m[4] ? `${p2(m[4])}:${m[5]}` : '' };
  return { day: '', time: '' };
}
// "USAMA USAM TMFB" -> naam "USAMA USAM", bank "Telenor Microfinance (Easypaisa)"
function splitName(raw) {
  const w = String(raw || '').replace(/\s+/g, ' ').trim().split(' ');
  let bank = '';
  if (w.length > 1) { const last = w[w.length - 1].toUpperCase().replace(/[^A-Z]/g, ''); if (last in BANK_TAIL) { bank = BANK_TAIL[last]; w.pop(); } }
  return { name: w.join(' ').trim(), bank };
}
const lineVal = (t, label) => { const m = t.match(new RegExp(label + '\\s*[:\\-]?\\s*([^\\n\\r]+)', 'i')); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };

export function parseBank(text, src = 'sms', subj = '') {
  const t = String(text || '').replace(/ /g, ' '), out = { ok: false, dir: '', amt: 0, name: '', bank: '', via: '', kind: 'party', day: '', time: '', txn: '', acct: '', src };
  if (!t.trim()) return out;
  Object.assign(out, whenOf(t));
  out.txn = (t.match(/(?:TXN|Transaction)\s*(?:ID|No\.?|#)?\s*[:\-]?\s*([A-Z0-9]{6,})/i) || [])[1] || '';
  out.acct = (t.match(/A\/C\s*([0-9*]{6,})/i) || [])[1] || '';
  const via = t.match(/via\s+(?:your\s+)?(Raast(?:\s+ID)?|IBFT|Cash Deposit|Cheque(?: Deposit)?|ATM|Mobile|Internet Banking|[A-Za-z][A-Za-z ]{1,25}?)(?=\s+(?:in|on|TXN|from|to)\b|[.,\n]|$)/i);
  if (via) out.via = via[1].replace(/\s+ID$/i, '').trim();
  // ---- email: paise GAYE (Transfer to Other Bank / funds transfer) ----
  if (src === 'email' || /Receiver Account Title|funds transfer was successful/i.test(t)) {
    out.amt = amtOf(lineVal(t, 'Amount') || t);
    const recv = lineVal(t, 'Receiver Account Title') || lineVal(t, 'Beneficiary (?:Name|Title)') || lineVal(t, 'To Account Title');
    out.name = recv.replace(/\s+(Receiver|From|Date|Channel|Transaction).*/i, '').trim();
    out.bank = lineVal(t, 'Receiver Bank Name').replace(/\s+(From|Date|Channel|Transaction).*/i, '').trim();
    const ch = lineVal(t, 'Channel'); if (ch) out.via = ch.replace(/^via\s+/i, '').replace(/\s+(Transaction|Date).*/i, '').trim();
    const dt = lineVal(t, 'Date and Time'); if (dt) Object.assign(out, whenOf(dt));
    const tx = lineVal(t, 'Transaction ID'); if (tx) out.txn = (tx.match(/[A-Z0-9]{4,}/i) || [''])[0];
    out.dir = /credited|received/i.test(subj) && !/transfer/i.test(subj) ? 'in' : 'out';
    out.ok = out.amt > 0 && !!out.name;
    return out;
  }
  out.amt = amtOf(t);
  // ---- SMS: paise AAYE ----
  let m = t.match(/received\s+from\s+(.+?)\s+in\s+your\s+HBL/i);
  if (m) { const s = splitName(m[1]); out.dir = 'in'; out.name = s.name; out.bank = s.bank; out.ok = out.amt > 0; return out; }
  if (/credited/i.test(t)) {
    out.dir = 'in';
    if (/cash\s*deposit/i.test(t)) { out.kind = 'cash'; out.via = 'Cash Deposit'; out.name = 'Cash jama (branch)'; }
    else { m = t.match(/from\s+(.+?)(?:\s+(?:on|via|in|TXN)\b|[.,]|$)/i); if (m) { const s = splitName(m[1]); out.name = s.name; out.bank = s.bank; } }
    out.ok = out.amt > 0; return out;
  }
  // ---- SMS: paise GAYE (agar HBL kabhi SMS bheje) ----
  if (/debited|sent\s+to|transferred\s+to|paid\s+to|withdraw/i.test(t)) {
    out.dir = 'out';
    m = t.match(/(?:to|sent to|transferred to|paid to)\s+(.+?)(?:\s+(?:on|via|from|TXN|A\/C)\b|[.,]|$)/i); if (m) { const s = splitName(m[1]); out.name = s.name; out.bank = s.bank; }
    if (/ATM|withdraw/i.test(t)) { out.kind = 'cash'; out.name = out.name || 'ATM se nikala'; }
    out.ok = out.amt > 0; return out;
  }
  return out;
}
// ek hi len-den do dafa na lage: TXN ID, warna raqam + din + waqt + naam
export const bankKeyOf = r => r.txn ? 'T' + r.txn.toUpperCase() : `A${r.dir}${r.amt}${r.day}${r.time}${String(r.name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12)}`;
// naam -> khata: pehle yaad (alias), phir naam milao
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, ' ').replace(/\s+/g, ' ').trim();
export function guessParty(name, parties, alias = {}) {
  const k = norm(name); if (!k) return null;
  if (alias[k]) { const p = parties.find(x => x.id === alias[k]); if (p) return { p, why: 'yaad' }; }
  const words = k.split(' ').filter(w => w.length > 2);
  let best = null, bs = 0;
  for (const p of parties) {
    const n = norm(p.name); if (!n) continue;
    let s = 0; if (n === k) s = 100; else { for (const w of words) if (n.split(' ').includes(w)) s += 30; else if (n.includes(w)) s += 15; if (words.length && words.every(w => n.includes(w))) s += 25; }
    // v2.99.53: naam ki spelling thori alag (SAMIH ULLAH ~ Sami Ullah, YOUNAS ~ Younis) — jode hue harf ka farq
    const a = k.replace(/ /g, ''), b = n.replace(/ /g, '');
    if (a.length >= 6 && b.length >= 6) {
      if (b.startsWith(a) || a.startsWith(b)) s = Math.max(s, 70);
      else if (lev(a, b) <= 2) s = Math.max(s, 60);
      else if (b.length > a.length && lev(a, b.slice(0, a.length)) <= 1) s = Math.max(s, 55);
    }
    if (s > bs) { bs = s; best = p; }
  }
  return bs >= 45 ? { p: best, why: bs >= 100 ? 'pura naam' : 'naam milta' } : null;
}
export const aliasKey = norm;
function lev(a, b) { if (Math.abs(a.length - b.length) > 2) return 9; let p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; }
