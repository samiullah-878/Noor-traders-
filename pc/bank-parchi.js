// =========================================================
//  bank-parchi.js  v2.5 (2026-10-20: chhoti parchi par Urdu sar-khi + bari Urdu tareekh) · v2.4 (2026-10-14: ✉️ Alfalah EMAIL bhi parhna (ibanking: naam · email.notification: account + charges) + wahi Ref / TXN do docs mein = EK, doosra post nahi) · v2.3 (2026-10-14: 🏦 BANK ALFALAH SMS (8287) parhna — aaye / 💳 card / fee / statement; Alfalah NT (@pcin) mein aaye
//                     paise khud; apne naam (Noor Traders / Samiullah) se aaye = khud nahi, app EK transfer banati hai) · v2.2 (2026-10-13: 🔔 HBL Mobile app ki NOTIFICATION (src 'notif') bhi parhta hai + notification / SMS / email jurwan = ek) · v2.1 (2026-10-12) — 🏦 sirf apne HBL account ke (A/C ke aakhri 4 number app mein yaad) · v2.0 (2026-10-12) — 🤖 aaye paise khud HBL khate mein (neeche) · v1.0 — 💰 PAISE AAYE ki parchi (Server PC, TM-T88IV)
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
// v2.99.75: Raast / IBFT mein naam ke saath bank ka BIC code ("Noor Traders HABBPKKARTG") — pehle 4 harf = bank
const BIC = { HABB: 'HBL', UNIL: 'UBL', BPUN: 'Bank of Punjab', MEZN: 'Meezan', ALFH: 'Bank Alfalah', MUCB: 'MCB', ABPA: 'Allied', NBPA: 'NBP', MPBL: 'Habib Metro', FAYS: 'Faysal', SCBL: 'Standard Chartered', BKIP: 'BankIslami', DUIB: 'Dubai Islamic', JSBL: 'JS Bank', SONE: 'Soneri', BAHL: 'Habib Metro', SMBC: 'Summit', TMFB: 'Easypaisa', MMBL: 'JazzCash', NAYA: 'NayaPay', SADA: 'SadaPay', KHYB: 'Bank of Khyber', SNDB: 'Sindh Bank', ASCM: 'Askari', AKBL: 'Askari' };
function splitName(raw) {
  const w = String(raw || '').replace(/\s+/g, ' ').trim().split(' ');
  let bank = '';
  if (w.length > 1 && /^[A-Z]{4}PK[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(w[w.length - 1])) { const c = w.pop(); bank = BIC[c.slice(0, 4)] || c.slice(0, 4); return { name: w.join(' ').trim(), bank }; }   // v2.99.75: BIC
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
  // ---- v2.99.74 🔔 HBL Mobile app ki LIVE NOTIFICATION (MacroDroid: "{not_title} — {notification}") — email / SMS se pehle ----
  //  "Transaction Alert: Fund Transfer — PKR 10,000 sent to HASEEB CORPORAT HBL from your HBL A/C *6303 on 13-Oct-2026 23:21 via HBL Mobile,Tx ID 1300557247. UAN: …"
  if (src === 'notif' || /^\s*Transaction Alert/i.test(t)) {
    out.src = 'notif'; out.amt = amtOf(t);
    out.txn = (t.match(/\bT(?:x|XN|rx)\s*(?:ID|No\.?|#)\s*[:\-]?\s*([A-Z0-9]{4,})/i) || t.match(/Transaction\s*(?:ID|No\.?|#)\s*[:\-]?\s*([A-Z0-9]{4,})/i) || [])[1] || '';
    out.acct = (t.match(/A\/C\s*(?:No\.?\s*)?\*?\s*([0-9*]{4,})/i) || [])[1] || '';
    const vv = t.match(/via\s+(.+?)(?=\s*[,.]\s*(?:T(?:x|XN|rx)\b|UAN|Transaction)|\s+(?:on|from|to)\b|$)/i); out.via = vv ? vv[1].trim().slice(0, 40) : '';
    if (/bill\s*payment/i.test(t)) {
      const co = (t.match(/(?:paid\s+(?:to|for)|payment\s+(?:to|of|for))\s+(.+?)(?=\s+(?:bill|from|on|via|against|for\s+consumer|consumer)\b|[,.]|$)/i) || [])[1] || '';
      out.consumer = (t.match(/Consumer\s*(?:ID|No\.?|Number|#)?\s*[:\-]?\s*([A-Z0-9-]{4,})/i) || [])[1] || '';
      out.name = (co.trim() || 'Utility') + ' bill'; out.kind = 'bill'; out.dir = 'out'; out.via = 'Bill Payment';
    } else if (/\b(?:sent|transferred|paid)\s+to\b|\bdebited\b/i.test(t)) {
      out.dir = 'out';
      const m = t.match(/(?:sent|transferred|paid)\s+to\s+(.+?)(?=\s+(?:from\s+your|from\s+A\/C|on|via)\b|[,.]\s|$)/i);
      if (m) { const s = splitName(m[1]); out.name = s.name; out.bank = s.bank; }
      if (/ATM|withdraw/i.test(t)) { out.kind = 'cash'; out.name = out.name || 'ATM se nikala'; }
    } else if (/\breceived\b|\bcredited\b|\bdeposit/i.test(t)) {
      out.dir = 'in';
      if (/cash\s*deposit/i.test(t)) { out.kind = 'cash'; out.via = 'Cash Deposit'; out.name = 'Cash jama (branch)'; }
      else { const m = t.match(/(?:received\s+from|credited\s+(?:by|from)|from)\s+(.+?)(?=\s+(?:in|into|to)\s+your\b|\s+(?:on|via)\b|[,.]\s|$)/i); if (m) { const s = splitName(m[1]); out.name = s.name; out.bank = s.bank; } }
    }
    out.ok = out.amt > 0 && !!out.dir && (out.kind !== 'party' || !!out.name);
    return out;
  }
  // ---- v2.99.76 ✉️ BANK ALFALAH EMAIL — do qism, dono mein wahi Ref (FT…) = ek len-den (app jorti hai: naam ek se, account / charges doosri se) ----
  //  ibanking@ (hp6235):  "Dear SAMI ULLAH PKR 1,000.00 sent to NOOR TRADERS -RAAST ID **03**-***2515 on 14-Oct-2026 00:21 Ref FT2628701MRXNP2Y via RAAST"
  //  email.notification@ (googel6235): "Transaction Successful Wednesday, September 30, 2026 | 8:42 AM Ref# FT2627309F8SXZ54 | Account Title SAMI ULLAH |
  //     Account/IBAN *****5826 | … Transaction Type Debit | Tax/Charges PKR 268/- | … Amount | PKR 2,500.00/-"   (naam NAHI hota)
  {
    const tt = t.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim(), n2 = s => Math.round(Number(String(s || '0').replace(/,/g, '')) * 100);
    let m = tt.match(/Dear\s+(.+?)\s+PKR\.?\s*([\d,]+(?:\.\d+)?)\s+(sent|transferred|paid|received)\s+(to|from)\s+(.+?)\s+on\s+(\d{1,2}-[A-Za-z]{3}-\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i);
    if (m && (/^\s*ALFA/i.test(subj) || /\bRef\s*#?\s*[:\-]?\s*FT[A-Z0-9]{6,}/i.test(tt))) {
      const inn = /received/i.test(m[3]), raw = m[5].replace(/\s*-\s*(?:RAAST\s*ID|A\/C|IBAN|Account)\b.*$/i, '').trim(), s = splitName(raw);
      Object.assign(out, whenOf(m[6] + (m[7] ? ' ' + m[7] + ':' + m[8] : '')));
      Object.assign(out, { bankAc: 'alfalah', src: 'email', dir: inn ? 'in' : 'out', amt: n2(m[2]), name: s.name, bank: s.bank, holder: m[1].trim().slice(0, 60), acct: '',
        txn: (tt.match(/\bRef\s*#?\s*[:\-]?\s*([A-Z0-9]{6,})/i) || [])[1] || '', via: ((tt.match(/\bvia\s+([A-Za-z]+)/i) || [])[1] || (/RAAST/i.test(m[5]) ? 'Raast' : '')).replace(/^RAAST$/i, 'Raast') });
      out.ok = out.amt > 0 && !!out.name; return out;
    }
    if (/Transaction\s+Successful/i.test(tt) && /Account\s*\/\s*IBAN/i.test(tt) && (/Alfalah/i.test(subj) || /8287|021111225111|Orbits/i.test(tt))) {
      const MN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
      const dm = tt.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})(?:\s*(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
      if (dm) { let h = Number(dm[4] || 0); if (dm[6]) { if (/PM/i.test(dm[6]) && h < 12) h += 12; if (/AM/i.test(dm[6]) && h === 12) h = 0; }
        out.day = `${dm[3]}-${p2(MN[dm[1].toLowerCase()])}-${p2(dm[2])}`; out.time = dm[4] ? `${p2(h)}:${dm[5]}` : ''; }
      const typ = ((tt.match(/Transaction\s+Type\s+(.+?)\s+(?:Tax\s*\/\s*Charges|Orbits|Available|Amount)\b/i) || [])[1] || '').trim();
      Object.assign(out, { bankAc: 'alfalah', src: 'email', dir: /credit|received|deposit/i.test(typ) ? 'in' : 'out', name: '', noName: true, via: typ.slice(0, 30),
        txn: (tt.match(/\bRef\s*#?\s*[:\-]?\s*([A-Z0-9]{6,})/i) || [])[1] || '', acct: ((tt.match(/Account\s*\/\s*IBAN\s*[*\s]*([0-9][0-9\-]{2,})/i) || [])[1] || '').replace(/\D/g, '').slice(-4),
        holder: ((tt.match(/Account\s+Title\s+(.+?)\s+Account\s*\/\s*IBAN/i) || [])[1] || '').trim().slice(0, 60),
        fee: n2((tt.match(/Tax\s*\/\s*Charges\s*(?:PKR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i) || [])[1]), amt: n2((tt.match(/\bAmount\s*(?:PKR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i) || [])[1]) });
      out.ok = out.amt > 0; return out;
    }
  }
  // ---- v2.99.75 🏦 BANK ALFALAH (SMS 8287) — paise aaye (BAF A/C *0294 / *5826) · 💳 card istemal (Avl Limit) · fee kati · 📄 statement ----
  //  "PKR 1000 received from Noor Traders HABBPKKARTG in your BAF A/C *0294 via your Raast ID on 14-10-26 at 00:20 Tx ID FT262870YT65C2VK"
  //  "Your Bank Alfalah card (54917) used for PKR 6,000.00 on 13/10/2026 at 11:19 at JINN-BEGA P/S KHARIAN PK. Avl Limit: 4,429.70"
  //  "SMS Alerts Monthly Fee PKR 250.00 & Tax 40.00 Debited from A/C: 5797-5***5826 on 12-Oct-2026"
  //  "Your Bank Alfalah Card Stmt.Summary. Amt Due: 1,453,960.50 Min Pmt: 21,285.00 Due Date: 26/10/2026."
  if (src !== 'email' && src !== 'notif' && /BAF\s*A\/C|Bank\s*Alfalah|021111225111|Stmt\.?\s*Summary|Avl\s*Limit/i.test(t)) {
    out.bankAc = 'alfalah';
    const n2 = s => Math.round(Number(String(s || '0').replace(/,/g, '')) * 100);
    let m = t.match(/Stmt\.?\s*Summary\.?\s*Amt\s*Due:?\s*([\d,]+(?:\.\d+)?)\s*Min\s*Pmt:?\s*([\d,]+(?:\.\d+)?)\s*Due\s*Date:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (m) { Object.assign(out, { kind: 'stmt', dir: 'out', amt: n2(m[1]), minPmt: n2(m[2]), due: `${m[5]}-${p2(m[4])}-${p2(m[3])}`, dueDay: Number(m[3]), name: 'Card statement', day: '', time: '', ok: n2(m[1]) > 0 }); return out; }
    m = t.match(/card\s*\((\d{3,6})\)\s*used\s+for\s+PKR\s*([\d,]+(?:\.\d+)?)\s+on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2}))?\s+at\s+(.+?)\.\s*Avl\s*Limit:?\s*([\d,]+(?:\.\d+)?)/i);
    if (m) {
      const merch = m[8].replace(/\s+/g, ' ').replace(/(\s+[A-Z]{2}){1,2}$/, '').trim();
      Object.assign(out, { kind: 'card', dir: 'out', card: m[1].slice(-4), amt: n2(m[2]), day: `${m[5]}-${p2(m[4])}-${p2(m[3])}`, time: m[6] ? `${p2(m[6])}:${m[7]}` : '', name: merch, merchant: merch, avl: n2(m[9]), via: 'Card', ok: n2(m[2]) > 0 });
      return out;
    }
    m = t.match(/(.{0,40}?)(?:Fee|Charges?)\s+PKR\s*([\d,]+(?:\.\d+)?)(?:\s*&\s*Tax\s*([\d,]+(?:\.\d+)?))?\s*Debited\s+from\s+A\/C:?\s*([0-9*\-]{4,})(?:\s+on\s+(\d{1,2}-[A-Za-z]{3}-\d{4}))?/i);
    if (m) {
      const what = (m[1] || '').replace(/^\s*Dear Customer,?\s*/i, '').trim();
      Object.assign(out, { kind: 'fee', dir: 'out', amt: n2(m[2]) + n2(m[3]), acct: m[4].replace(/\D/g, '').slice(-4), name: 'Bank fee' + (what ? ': ' + what.slice(0, 30) : ''), merchant: 'BANK FEE', via: 'Bank charges', ok: n2(m[2]) > 0 });
      if (m[5]) Object.assign(out, whenOf(m[5]));
      return out;
    }
    const tx = (t.match(/Tx\s*ID\s*[:\-]?\s*([A-Z0-9]{4,})/i) || [])[1] || '';
    const dd = t.match(/on\s+(\d{1,2})-(\d{1,2})-(\d{2,4})(?:\s+at\s+(\d{1,2}):(\d{2}))?/i);
    if (dd) { const y = dd[3].length === 2 ? '20' + dd[3] : dd[3]; out.day = `${y}-${p2(dd[2])}-${p2(dd[1])}`; out.time = dd[4] ? `${p2(dd[4])}:${dd[5]}` : ''; }
    out.txn = tx; out.amt = amtOf(t);
    out.acct = (t.match(/A\/C:?\s*\*?\s*([0-9*\-]{3,})/i) || [])[1] || ''; out.acct = out.acct.replace(/\D/g, '').slice(-4);
    const vv = t.match(/via\s+(?:your\s+)?(Raast(?:\s+ID)?|IBFT|[A-Za-z][A-Za-z ]{1,20}?)(?=\s+on\b|$)/i); if (vv) out.via = vv[1].replace(/\s+ID$/i, '');
    m = t.match(/received\s+from\s+(.+?)\s+in\s+your\s+BAF/i);
    if (m) { const s = splitName(m[1]); Object.assign(out, { dir: 'in', name: s.name, bank: s.bank, ok: out.amt > 0 }); return out; }
    m = t.match(/(?:sent|transferred|paid)\s+to\s+(.+?)\s+(?:from\s+your\s+BAF|from\s+A\/C)/i);
    if (m) { const s = splitName(m[1]); Object.assign(out, { dir: 'out', name: s.name, bank: s.bank, ok: out.amt > 0 }); return out; }
    if (/credited/i.test(t)) { Object.assign(out, { dir: 'in', name: (t.match(/from\s+(.+?)(?:\s+(?:on|via)\b|[.,]|$)/i) || [])[1] || 'Alfalah mein aaye', ok: out.amt > 0 }); return out; }
    if (/debited/i.test(t)) { Object.assign(out, { dir: 'out', name: 'Alfalah se gaye', ok: out.amt > 0 }); return out; }
    return out;
  }
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
  const ESC = '\x1b', GS = '\x1d', out = head(r.dir === 'in' ? 'PAISE AAYE - HBL' : 'PAISE GAYE - HBL', r.dir === 'in' ? 'پیسے آئے — ایچ بی ایل' : 'پیسے گئے — ایچ بی ایل', r.day || Date.now());   // v2.5 (2026-10-20): Urdu sar-khi + tareekh (transfer-sync head)
  const row = (l, v) => { v = ascii(v); if (!v) return; const s = (l + ': ').padEnd(8) + v; for (let i = 0; i < s.length; i += W) out.push(s.slice(i, i + W)); };
  out.push(ESC + 'a' + '\x01' + ESC + '!' + '\x38' + (r.dir === 'in' ? '+ ' : '- ') + rs(r.amt) + ESC + '!' + '\x00' + ESC + 'a' + '\x00', '');
  row(r.dir === 'in' ? 'Kis se' : 'Kis ko', r.name); row('Bank', r.bank); row('Via', r.via);
  const [y, mo, d] = String(r.day || '').split('-'); row('Waqt', r.day ? `${d}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(mo) - 1]}-${y}${r.time ? ' ' + r.time : ''}` : '');
  row('TXN', r.txn); row('Zariya', r.src === 'email' ? 'HBL email' : r.src === 'notif' ? 'HBL notification' : 'HBL SMS');
  out.push('-'.repeat(W), r.kind === 'cash' ? 'Branch mein cash jama hua' : 'App: HBL screen par [ ] tick karein', '(khata mein tab lagega)', '', GS + 'V' + '\x42' + '\x00');
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
const noteOf = r => (`${r.bankAc === 'alfalah' ? 'Alfalah' : 'HBL'} aaye · ${r.name}${r.bank ? ' (' + r.bank + ')' : ''}${r.via ? ' · ' + r.via : ''}${r.txn ? ' · TXN ' + r.txn : ''}`).slice(0, 900);
function createBankWatcher({ biz, log, sendRaw, head, stateFile, cfgRef, now = () => Date.now(), freshMs = 30 * 60000 }) {
  let seen = {}; try { seen = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch {}
  const save = () => { const ks = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 400); seen = Object.fromEntries(ks); try { fs.writeFileSync(stateFile, JSON.stringify(seen)); } catch {} };
  let cfg = { bankAuto: true, bankOut: false, bankPost: true, bankSlip: false }, stopA = null, stopB = null, hblId = '', amap = {};
  let hq = Promise.resolve();   // v2.2
  const khata = () => biz.collection('blueKhata');
  async function post(doc, d, r) {
    if (!cfg.bankPost || r.dir !== 'in' || d.st || r.kind === 'stmt') return '';
    if (!r.day || r.day !== pktDay(now())) return '';   // purani tareekh: app mein malik se poochho
    // v2.1: SMS / email mein account number ho (maslan loan wala) aur app ne us number ko HBL Noor Traders ka nahi maana = khud nahi — app poochegi
    // v2.3: Alfalah bhi — account ka khata app mein chuna ho aur malik ne PC ko ijazat di ho (@pcin:<4 number>, Alfalah NT 0294 = haan)
    const k = acctK(r.acct) || (r.bankAc === 'alfalah' ? ({ SAMIULLAH: '5826', NOORTRADERS: '0294' })[String(r.holder || '').toUpperCase().replace(/[^A-Z]/g, '')] || '' : ''); let tgt = hblId;   // v2.4: Alfalah email "Dear X" = account (app jaisa)
    if (k) { const a = amap['@a:' + k]; if (!a || (a !== hblId && amap['@pcin:' + k] !== '1')) return ''; tgt = a; }
    else if (r.bankAc === 'alfalah') return '';
    if (!tgt) return '';
    if (/noor\s*traders|sami\s*ullah|samiullah/i.test(r.name)) return '';   // v2.3: apna paisa (HBL <-> Alfalah) — app dono taraf jor kar EK transfer banati hai
    const id = 'bk' + doc.id + 'a', ref = khata().doc(id);
    const ex = await ref.get(); if (ex.exists && !ex.data().deleted) return 'pehle-se';
    const t = now();
    await ref.set({ id, type: 'entry', kind: 'payment', partyId: tgt, amount: r.amt, date: r.day, note: noteOf(r), dailyIncluded: true, posPending: false, bankSms: doc.id,
      by: 'pc-bank', updatedBy: 'pc-bank', createdAt: t, updatedAt: t, rev: 1 });
    await biz.collection('bankSms').doc(doc.id).set({ st: 'done', by: 'pc-bank', byName: 'Server PC', doneAt: t, partyId: tgt, entryId: id, kind: 'party' }, { merge: true });
    log(`🤖 HBL khud laga: ${rs(r.amt)} — ${ascii(r.name)} -> HBL (Akhrajat)`);
    return 'laga';
  }
  async function handle(doc) {
    const d = doc.data ? doc.data() : doc; if (!d || !d.text || doc.id === '_alias') return 'skip';
    const r = parseBank(d.text, d.src, d.subj); if (!r.ok) return 'samajh-nahi';
    // v2.2: 🔔 notification + usi len-den ka SMS / email = jurwan (aaye/gaye + raqam + 30 min, zariya alag) — doosra na post, na parchi
    const zc = r.day && r.time ? Math.round(Date.parse(r.day + 'T' + r.time + ':00+05:00') / 60000) : 0, cls = d.src === 'notif' ? 'n' : 's', pre = 'Z' + (r.bankAc === 'alfalah' ? 'A' : '') + r.dir + r.amt + '|';
    const twin = zc ? Object.keys(seen).find(k => { if (!k.startsWith(pre)) return false; const [, m, c, id] = k.split('|'); return c !== cls && id !== doc.id && !seen['P' + id] && Math.abs(Number(m) - zc) <= 30; }) : '';   // P = pehle hi jor ban chuka
    if (zc && !seen[pre + zc + '|' + cls + '|' + doc.id]) { seen[pre + zc + '|' + cls + '|' + doc.id] = now(); save(); }
    if (twin) {
      const tid = twin.split('|')[3]; seen['P' + tid] = now(); seen['P' + doc.id] = now(); save();
      try { const tw = await biz.collection('bankSms').doc(tid).get(), x = tw.exists ? tw.data() : null;
        if (x && x.st === 'done' && !d.st) await biz.collection('bankSms').doc(doc.id).set({ st: 'done', by: 'pc-bank', byName: 'Server PC', doneAt: now(), partyId: x.partyId || '', entryId: '', kind: 'dup', dupOf: tid }, { merge: true });
      } catch (e) { log('HBL jurwan masla: ' + e.message); }
      return 'jurwan';
    }
    // v2.4: wahi Ref / TXN do alag docs mein (Alfalah: SMS 8287 + do emails) = ek len-den — pehla lag chuka ho to yeh 'dup', na post na parchi
    if (r.txn) {
      const rk = 'R' + String(r.txn).toUpperCase() + '|';
      if (!seen[rk + doc.id]) { seen[rk + doc.id] = now(); save(); }
      for (const k of Object.keys(seen)) {
        if (!k.startsWith(rk) || k === rk + doc.id) continue;
        const tid = k.slice(rk.length); let x = null;
        try { const tw = await biz.collection('bankSms').doc(tid).get(); x = tw.exists ? tw.data() : null; } catch {}
        if (x && x.st === 'done') {
          try { if (!d.st) await biz.collection('bankSms').doc(doc.id).set({ st: 'done', by: 'pc-bank', byName: 'Server PC', doneAt: now(), partyId: x.partyId || '', entryId: '', kind: 'dup', dupOf: tid }, { merge: true }); } catch (e) { log('HBL Ref jor masla: ' + e.message); }
          return 'jurwan';
        }
      }
    }
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
      s.docChanges().forEach(c => { if (c.type === 'added' && c.doc.id !== '_alias') { const dc = c.doc; hq = hq.then(() => handle(dc)).catch(e => log('HBL masla: ' + e.message)); } });   // v2.2: ek ke baad ek (jurwan ki daud na ho)
    }, e => onFail && onFail(e));
    log('🤖 HBL chalu — aaj ke AAYE paise khud HBL Noor Traders mein (printConfig.bankPost), parchi pos-khata-sync se');
  }
  return { start, stop: () => { stopA && stopA(); stopB && stopB(); }, handle, _cfg: c => { cfg = { ...cfg, ...c }; }, _hbl: id => { hblId = id; }, _amap: m => { amap = m || {}; } };
}
module.exports = { createBankWatcher, parseBank, slipText, bankKeyOf };
