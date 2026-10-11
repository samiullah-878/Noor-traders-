// =========================================================
//  bank-parchi.js  v1.0 (2026-10-12) — 💰 PAISE AAYE ki parchi (Server PC, TM-T88IV)
//  Malik: "jaise hi koi paisa aya usi time computer se print bi nikl aiya".
//  📩 HBL Inbox (Firestore bankSms) mein naya SMS / email aate hi -> parchi: raqam (bara), kis se, bank, via, waqt, TXN.
//  Sirf PARHTA hai (kuch nahi likhta, sirf printConfig.bankLast). Wahi TXN do dafa nahi chhapta (bank-print.json).
//  Script band thi to wapas aa kar sirf pichhle 30 min wale chhapta hai (purane ka dher nahi).
//  Setting: blueAccess/printConfig.bankAuto (default ON) · bankOut (paise GAYE bhi chhapo, default BAND). App: 🏦 HBL screen -> 🖨 Parchi.
//  transfer-sync.js chalata hai (printer ki wahi qataar).
// =========================================================
const fs = require('fs');
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

function parseBank(text, src = 'sms', subj = '') {
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

const bankKeyOf = r => r.txn ? 'T' + r.txn.toUpperCase() : `A${r.dir}${r.amt}${r.day}${r.time}${String(r.name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12)}`;
const ascii = s => String(s ?? '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
const rs = p => 'Rs ' + Math.round(p / 100).toLocaleString('en-US');
function slipText(r, head, W = 42) {
  const ESC = '\x1b', GS = '\x1d', out = head(r.dir === 'in' ? 'PAISE AAYE - HBL' : 'PAISE GAYE - HBL');
  const row = (l, v) => { v = ascii(v); if (!v) return; const s = (l + ': ').padEnd(8) + v; for (let i = 0; i < s.length; i += W) out.push(s.slice(i, i + W)); };
  out.push(ESC + 'a' + '\x01' + ESC + '!' + '\x38' + (r.dir === 'in' ? '+ ' : '- ') + rs(r.amt) + ESC + '!' + '\x00' + ESC + 'a' + '\x00', '');
  row(r.dir === 'in' ? 'Kis se' : 'Kis ko', r.name); row('Bank', r.bank); row('Via', r.via);
  const [y, mo, d] = String(r.day || '').split('-'); row('Waqt', r.day ? `${d}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(mo) - 1]}-${y}${r.time ? ' ' + r.time : ''}` : '');
  row('TXN', r.txn); row('Zariya', r.src === 'email' ? 'HBL email' : 'HBL SMS');
  out.push('-'.repeat(W), r.kind === 'cash' ? 'Branch mein cash jama hua' : 'App: HBL screen par [ ] tick karein', '(khata mein tab lagega)', '', '', '', GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}
function createBankWatcher({ biz, log, sendRaw, head, stateFile, cfgRef, now = () => Date.now(), freshMs = 30 * 60000 }) {
  let seen = {}; try { seen = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch {}
  const save = () => { const ks = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 400); seen = Object.fromEntries(ks); try { fs.writeFileSync(stateFile, JSON.stringify(seen)); } catch {} };
  let cfg = { bankAuto: true, bankOut: false }, stopA = null, stopB = null;
  async function handle(doc) {
    const d = doc.data ? doc.data() : doc; if (!d || !d.text || doc.id === '_alias') return 'skip';
    const created = doc.createTime && doc.createTime.toMillis ? doc.createTime.toMillis() : Number(d.at) || now();
    if (now() - created > freshMs) return 'purana';
    const r = parseBank(d.text, d.src, d.subj); if (!r.ok) return 'samajh-nahi';
    // asal len-den ka waqt (email: d.at · SMS: din + waqt) — 'dobara' se aaye purane len-den nahi chhapte
    const tx = Number(d.at) || (r.day ? new Date(`${r.day}T${r.time || '12:00'}:00+05:00`).getTime() : 0);
    if (tx && now() - tx > 3 * 3600000) return 'purana';
    const k = bankKeyOf(r); if (seen[k] || seen['D' + doc.id]) return 'chhap-chuka';
    seen[k] = now(); seen['D' + doc.id] = now(); save();
    if (!cfg.bankAuto) return 'band';
    if (r.dir === 'out' && !cfg.bankOut) return 'gaye-band';
    await sendRaw(slipText(r, head), 'HBL ' + rs(r.amt));
    log(`💰 HBL parchi: ${r.dir === 'in' ? 'aaye' : 'gaye'} ${rs(r.amt)} — ${ascii(r.name)}`);
    try { cfgRef && await cfgRef.set({ bankLast: now() }, { merge: true }); } catch {}
    return 'chhapa';
  }
  function start(onFail) {
    if (cfgRef && cfgRef.onSnapshot) stopA = cfgRef.onSnapshot(s => { const x = s.exists ? (s.data() || {}) : {}; cfg = { bankAuto: x.bankAuto !== false, bankOut: x.bankOut === true }; }, () => {});
    stopB = biz.collection('bankSms').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type === 'added') handle(c.doc).catch(e => log('HBL parchi masla: ' + e.message)); }); }, e => onFail && onFail(e));
    log('💰 HBL parchi chalu — naya SMS / email aate hi parchi (setting: printConfig.bankAuto)');
  }
  return { start, stop: () => { stopA && stopA(); stopB && stopB(); }, handle, _cfg: c => { cfg = { ...cfg, ...c }; } };
}
module.exports = { createBankWatcher, parseBank, slipText, bankKeyOf };
