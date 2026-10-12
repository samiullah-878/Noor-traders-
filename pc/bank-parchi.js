// =========================================================
//  bank-parchi.js  v2.1 (2026-10-12) — 🏦 sirf apne HBL account ke (A/C ke aakhri 4 number app mein yaad) · v2.0 (2026-10-12) — 🤖 aaye paise khud HBL khate mein (neeche) · v1.0 — 💰 PAISE AAYE ki parchi (Server PC, TM-T88IV)
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
const amtOf = s => { const m = String(s || '').match(/(?:PKR\.?|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i); return m ? Math.round(Number(m[1].replace(/,/g, '')) * 100) : 0; };
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
  out.acct = (t.match(/A\/C\s*([0-9*]{6,})/i) || t.match(/From\s+Account\s+(?:No|Number)\.?\s*(?:\/\s*IBAN)?\s*[:\-]?\s*(?:PK\d\d[A-Z]{4})?([0-9*]{6,})/i) || [])[1] || '';   // v2.99.59: email ka "From Account No. /IBAN" bhi
  const via = t.match(/via\s+(?:your\s+)?(Raast(?:\s+ID)?|IBFT|Cash Deposit|Cheque(?: Deposit)?|ATM|Mobile|Internet Banking|[A-Za-z][A-Za-z ]{1,25}?)(?=\s+(?:in|on|TXN|from|to)\b|[.,\n]|$)/i);
  if (via) out.via = via[1].replace(/\s+ID$/i, '').trim();
  // ---- v2.99.59 email: 🧾 BILL PAYMENT (HBL Mobile | Bill Payment) — Company GEPCO · Consumer ID · From Account No. /IBAN · Date-Time ----
  if (src === 'email' && !/Receiver Account Title/i.test(t) && (/Bill\s*Payment/i.test(subj) || (/\bCompany\b/i.test(t) && /Consumer\s*(?:ID|No|Number)/i.test(t)))) {
    out.amt = amtOf(lineVal(t, 'Amount') || t);
    const co = lineVal(t, 'Company').replace(/\s+(Consumer|From|Date|Transaction).*/i, '').trim();
    out.consumer = (lineVal(t, 'Consumer\\s*(?:ID|No\\.?|Number)').match(/[A-Z0-9-]{4,}/i) || [''])[0];
    out.name = (co || 'Utility') + ' bill'; out.bank = ''; out.via = 'Bill Payment'; out.kind = 'bill'; out.dir = 'out';
    const dt = lineVal(t, 'Date[-\\s]*(?:and\\s*)?Time'); if (dt) Object.assign(out, whenOf(dt));
    out.txn = (t.match(/Transaction\s*ID\.?\s*[:\-]?\s*([A-Z0-9]{4,})/i) || [])[1] || out.txn;
    out.ok = out.amt > 0;
    return out;
  }
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
// v2.0 (2026-10-12): 🤖 PAISE AAYE = Server PC KHUD khate mein — malik: "jo bhi raqam account mein aa rahi hai wo isi default account
//   HBL Noor Traders mein aaye … jaise hi payment update ho foran print niklin". Aaj ka AAYE SMS/email aate hi blueKhata mein entry:
//   id 'bk<docId>a', kind 'payment', partyId = HBL (bankSms/_alias m['@hbl']), dailyIncluded true (Daily: Akhrajat = galla ka paisa bank gaya).
//   Phir pos-khata-sync isay POS voucher banata hai aur HBL wali parchi (bara HBL, lafzon mein) foran chhapta hai — is liye yahan ki chhoti
//   "PAISE AAYE" parchi ab default BAND (printConfig.bankSlip = true ho to chhapti hai). Purani tareekh / gaye = app mein malik se poochho.
//   Setting printConfig.bankPost (default ON). App bhi yahi ID likhti hai — dono likhen to bhi ek hi entry.
const acctK = a => { const d = String(a || '').replace(/\D/g, ''); return d.length >= 4 ? d.slice(-4) : ''; };   // v2.1: account ke aakhri 4 number
const pktDay = ms => new Date(ms + 5 * 3600000).toISOString().slice(0, 10);
const noteOf = r => (`HBL aaye · ${r.name}${r.bank ? ' (' + r.bank + ')' : ''}${r.via ? ' · ' + r.via : ''}${r.txn ? ' · TXN ' + r.txn : ''}`).slice(0, 900);
function createBankWatcher({ biz, log, sendRaw, head, stateFile, cfgRef, now = () => Date.now(), freshMs = 30 * 60000 }) {
  let seen = {}; try { seen = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch {}
  const save = () => { const ks = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 400); seen = Object.fromEntries(ks); try { fs.writeFileSync(stateFile, JSON.stringify(seen)); } catch {} };
  let cfg = { bankAuto: true, bankOut: false, bankPost: true, bankSlip: false }, stopA = null, stopB = null, hblId = '', amap = {};
  const khata = () => biz.collection('blueKhata');
  async function post(doc, d, r) {
    if (!cfg.bankPost || !hblId || r.dir !== 'in' || d.st) return '';
    if (!r.day || r.day !== pktDay(now())) return '';   // purani tareekh: app mein malik se poochho
    // v2.1: SMS / email mein account number ho (maslan loan wala) aur app ne us number ko HBL Noor Traders ka nahi maana = khud nahi — app poochegi
    const k = acctK(r.acct); if (k && amap['@a:' + k] !== hblId) return '';
    const id = 'bk' + doc.id + 'a', ref = khata().doc(id);
    const ex = await ref.get(); if (ex.exists && !ex.data().deleted) return 'pehle-se';
    const t = now();
    await ref.set({ id, type: 'entry', kind: 'payment', partyId: hblId, amount: r.amt, date: r.day, note: noteOf(r), dailyIncluded: true, posPending: false, bankSms: doc.id,
      by: 'pc-bank', updatedBy: 'pc-bank', createdAt: t, updatedAt: t, rev: 1 });
    await biz.collection('bankSms').doc(doc.id).set({ st: 'done', by: 'pc-bank', byName: 'Server PC', doneAt: t, partyId: hblId, entryId: id, kind: 'party' }, { merge: true });
    log(`🤖 HBL khud laga: ${rs(r.amt)} — ${ascii(r.name)} -> HBL (Akhrajat)`);
    return 'laga';
  }
  async function handle(doc) {
    const d = doc.data ? doc.data() : doc; if (!d || !d.text || doc.id === '_alias') return 'skip';
    const r = parseBank(d.text, d.src, d.subj); if (!r.ok) return 'samajh-nahi';
    let posted = '';
    try { posted = await post(doc, d, r); } catch (e) { log('HBL khud nahi laga: ' + e.message); }   // aaj ka ho to PC band tha tab bhi (chalu hote hi)
    const created = doc.createTime && doc.createTime.toMillis ? doc.createTime.toMillis() : Number(d.at) || now();
    if (now() - created > freshMs) return posted || 'purana';
    // asal len-den ka waqt (email: d.at · SMS: din + waqt) — 'dobara' se aaye purane len-den nahi chhapte
    const tx = Number(d.at) || (r.day ? new Date(`${r.day}T${r.time || '12:00'}:00+05:00`).getTime() : 0);
    if (tx && now() - tx > 3 * 3600000) return posted || 'purana';
    const k = bankKeyOf(r); if (seen[k] || seen['D' + doc.id]) return posted || 'chhap-chuka';
    seen[k] = now(); seen['D' + doc.id] = now(); save();
    if (!cfg.bankAuto || !cfg.bankSlip) return posted || 'band';   // v2.0: asal parchi pos-khata-sync ki HBL parchi
    if (r.dir === 'out' && !cfg.bankOut) return posted || 'gaye-band';
    await sendRaw(slipText(r, head), 'HBL ' + rs(r.amt));
    log(`💰 HBL parchi: ${r.dir === 'in' ? 'aaye' : 'gaye'} ${rs(r.amt)} — ${ascii(r.name)}`);
    try { cfgRef && await cfgRef.set({ bankLast: now() }, { merge: true }); } catch {}
    return 'chhapa';
  }
  function start(onFail) {
    if (cfgRef && cfgRef.onSnapshot) stopA = cfgRef.onSnapshot(s => { const x = s.exists ? (s.data() || {}) : {}; cfg = { bankAuto: x.bankAuto !== false, bankOut: x.bankOut === true, bankPost: x.bankPost !== false, bankSlip: x.bankSlip === true }; }, () => {});
    stopB = biz.collection('bankSms').onSnapshot(s => {
      for (const c of s.docChanges()) if (c.doc.id === '_alias' && c.type !== 'removed') { amap = (c.doc.data() || {}).m || {}; hblId = String(amap['@hbl'] || ''); }
      s.docChanges().forEach(c => { if (c.type === 'added' && c.doc.id !== '_alias') handle(c.doc).catch(e => log('HBL masla: ' + e.message)); });
    }, e => onFail && onFail(e));
    log('🤖 HBL chalu — aaj ke AAYE paise khud HBL Noor Traders mein (printConfig.bankPost), parchi pos-khata-sync se');
  }
  return { start, stop: () => { stopA && stopA(); stopB && stopB(); }, handle, _cfg: c => { cfg = { ...cfg, ...c }; }, _hbl: id => { hblId = id; }, _amap: m => { amap = m || {}; } };
}
module.exports = { createBankWatcher, parseBank, slipText, bankKeyOf };
