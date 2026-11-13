// =========================================================
//  kh-wa.js  v1.0 (2026-11-12) — 🔢 KHARCHA WHATSAPP SE (wa-parchi.js + wa-out.js dono isay istemal karte hain)
//  Malik (12 Nov 2026): "har kharcha account ko number do 001 002 … · WhatsApp se connect · main ya Mubeen apni chat mein likhein
//    '001 Imran ne paisa liya -4900' to Daily Sale mein lag jaye aur kharcha account mein bhi · sirf akhrajat (wasooli nahi) ·
//    mazeed number bhi add kar sakein (Sonu, Bilal Ali) · meri / Mubeen ki chat mein ya business WhatsApp par — sab chale · hadd nahi".
//  Kaam: paigham "<3 hindse> <likhai> <raqam>" → blueKhata entry {kind payment, partyId = us number ka KHARCHA khata, dailyIncluded true}
//    (aage pos-khata-sync khud POS voucher + parchi banata hai — jaisa app ki entry par) → jawab waOut se (dukan ka Business number).
//  Hifazat: sirf ijazat wale number (blueAccess/khWa.allow + malik / Mubeen = waParchi prFrom / prTo) · sirf jo paigham 3 hindson se shuru ho
//    (baqi paigham na parhe, na log) · ek paigham = ek pakki entry id (dobara nahi lagta) · 10 min se purana nahi lagta · "cancel" reply = wapas.
//  v1.2 (12 Nov, malik: 'payment li / di / transfer bhi WhatsApp se, sab parties · naam likhein, system app ke naam 1-2-3 bheje, hum number chunein ·
//    1 li · 2 di · 3 transfer (pehli se doosri) · li / di default Daily Sale mein, "no" = nahi · sirf parties (bank nahi) · jo numbers jure hain sab'):
//    '1 Imran chokar 5000' -> blueAccess/khPend[number] (10 min) + naam ki list -> jawab '1' (transfer '1 2') -> entry wk<msgid> / transfer-wk<msgid>-out|in.
//    Bina number ke jawab kuch nahi lagta. Naam ki talaash dhoond.mjs smartFind (AI nahi).
//  v1.3 (12 Nov shaam, malik: 'pehle customer ka naam likhein to naam ki suggestion aaye · 1-2-3 (kaam) select karne ke baad · PDF report + print + baqaya ·
//    cancel SIRF malik · "Reports" likhein to kal wali reports 1-2-3'): Business number ki chat mein sirf NAAM -> list (stg n) -> number -> baqaya + kaam ka menu (stg m)
//    -> '1 5000' li · '2 5000' di · '3 5000 Aslam' transfer (stg t: doosre naam ki list) · '4' PDF (waOut doc) · '5' thermal print (khataPrints -> pos-khata-sync).
//    'reports' (sirf malik) -> menu (stg r) -> reportConfig {reportNow, waOnly} -> raat-report v1.6. PDF / print = aakhri 30 din. Baqaya ka formula = app runningOf (skipsBal + cashPays).
//  Number: blueAccess/khNum {m: {partyId: n}} — malik ki app deti hai. AI NAHI. SQL nahi (POS ko yeh file kabhi nahi chhooti).
// =========================================================
const VER = '1.5';   // v1.5 (13 Nov): 🔔 WhatsApp reminder — 'reminder <likhai> / kal se' · 'all reminder show' · '3 off' · 'reminder off'; roz 11 baje, jab tak off na ho; har number ka apna (malik, Mubeen)
// v1.4:   // v1.4 (13 Nov, malik: 'WhatsApp wali entry ke print par narration mein party ka naam nahi aata'): note = '<khata naam> - <likhai> - WhatsApp <kis ne>' (parchi Tafseel, POS voucher, khata / Daily ki line — sab jagah naam)   // v1.1: who() bahar (Business inbox ki ijazat isi list se)
const pad3 = n => String(n).padStart(3, '0');
const rsT = v => 'Rs ' + Math.round(Number(v) || 0).toLocaleString('en-PK');
function normPh(x) {
  let d = String(x || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2); else if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return d;
}
const CANCEL_RE = /^\s*(cancel|wapas|hatao|hata do)\s*[.!]*\s*$/i;
const PICK_RE = /^\s*(\d{1,2})(?:[\s,\-]+(\d{1,2}))?\s*$/, P2_RE = /^\s*([123])(?!\d)[\s:.\-]+(\S.*)$/;
const REP_RE = /^\s*reports?\s*$/i, STG_RE = /^\s*([1-5])(?!\d)(?:[\s:.\-]+(.*))?$/;
const STOP = new Set('start,started,shuru,print,printauto,autoprint,auto,cancel,wapas,hatao,ok,okay,okey,yes,no,nahi,ji,jee,han,haan,hello,hi,hey,salam,slam,aoa,theek,thek,thik,thanks,thank,shukria,shukriya,done,test,acha,achha,bill,parchi,report,reports,kal,aaj,abhi,bhej,bhejo,kya,kia,hai,ha,g'.split(','));
// sirf naam jaisa chhota paigham (Business number ki chat): 1-4 lafz, hindsa nahi, aam lafz nahi
const looksName = t => { t = String(t || '').trim(); if (t.length < 3 || t.length > 40 || /[0-9?!@#:\/\\\n]/.test(t)) return false; const w = t.toLowerCase().split(/\s+/); return w.length <= 4 && !w.some(x => STOP.has(x.replace(/[^a-z]/g, ''))) && /[a-z\u0600-\u06ff]{3}/i.test(t); };
const REM_RE = /^\s*(all\s+)?(reminders?|remainders?)(?![a-z])/i, OFF_RE = /^\s*(\d{1,3})\s+off\s*[.!]*\s*$/i;
const looks = t => { t = String(t || ''); return /^\s*\d{3}(?!\d)/.test(t) || REM_RE.test(t) || OFF_RE.test(t) || CANCEL_RE.test(t) || PICK_RE.test(t) || REP_RE.test(t) || (P2_RE.test(t) && !/print/i.test(t)); };
// '1 Imran chokar 5000 [no]' · '3 Imran 5000 Aslam' -> { k, a, b, amt, daily, note }
function parse2(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim(); const m = P2_RE.exec(t); if (!m || /print/i.test(t)) return null;
  const k = Number(m[1]); let rest = m[2].trim(), daily = true;
  if (/(^|\s)(no|nahi|nhi)(\s|$)/i.test(rest)) { daily = false; rest = rest.replace(/(^|\s)(no|nahi|nhi)(?=\s|$)/ig, ' ').replace(/\s+/g, ' ').trim(); }
  const all = [...rest.matchAll(/(?:^|\s)(\d[\d,]*(?:\.\d+)?)(?=\s|$)/g)]; if (!all.length) return { k, a: rest, b: '', amt: 0, daily, note: '' };
  const hit = k === 3 ? all[0] : all[all.length - 1], amt = Number(hit[1].replace(/,/g, '')), i0 = hit.index, i1 = hit.index + hit[0].length;
  const cl = x => x.replace(/(^|\s)(rs\.?|rupay|rupees|rupaye)(?=\s|$)/ig, ' ').replace(/[>→\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const a = cl(rest.slice(0, i0)), tail = cl(rest.slice(i1));
  return { k, a, b: k === 3 ? tail : '', amt: Number.isFinite(amt) && amt > 0 ? amt : 0, daily: k === 3 ? false : daily, note: k === 3 ? '' : tail };
}
function parse(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(), m = /^(\d{3})(?!\d)[\s:.\-]*(.*)$/.exec(t); if (!m) return null;
  const rest = m[2], all = [...rest.matchAll(/\d[\d,]*(?:\.\d+)?/g)]; if (!all.length) return { code: m[1], amt: 0, note: rest.trim() };
  const last = all[all.length - 1], amt = Number(last[0].replace(/,/g, ''));
  let note = rest.slice(0, last.index) + ' ' + rest.slice(last.index + last[0].length);
  note = note.replace(/\s+/g, ' ').trim().replace(/(^|\s)(rs\.?|rupay|rupees|rupaye)\s*$/i, '').replace(/\s*[-−–+=:\/]+\s*$/, '').replace(/(^|\s)(rs\.?|rupay|rupees|rupaye)\s*$/i, '').trim();
  return { code: m[1], amt: Number.isFinite(amt) && amt > 0 ? amt : 0, note };
}
// saada text PDF (Courier, A4) — bahar ki library nahi. lines: [{t, b (mota), z (size)}]
function pdfMake(lines) {
  const esc = x => String(x == null ? '' : x).replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1');
  const pages = []; let cur = [], y = 806;
  for (const L of lines) { const z = L.z || 9, lead = z + 3; if (y - lead < 36) { pages.push(cur); cur = []; y = 806; } y -= lead; cur.push(`BT /${L.b ? 'F2' : 'F1'} ${z} Tf 28 ${y} Td (${esc(L.t)}) Tj ET`); }
  pages.push(cur);
  const objs = [], add = x => { objs.push(x); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'), kids = [];
  for (const p of pages) { const st = p.join('\n'), c = add(`<< /Length ${Buffer.byteLength(st)} >>\nstream\n${st}\nendstream`); kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`)); }
  objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((x, i) => { off.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${x}\nendobj\n`; });
  const xr = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
function make({ biz, log = () => {} }) {
  const BA = biz.collection('blueAccess'), KH = biz.collection('blueKhata'), Q = biz.collection('waOut');
  let cfg = { on: true, allow: [] }, num = {}, base = { prFrom: ['03450412515'], prTo: ['03462901193'] };
  const watch = (id, fn) => { try { BA.doc(id).onSnapshot(s => { try { fn(s.exists ? s.data() || {} : {}); } catch {} }, e => log('kh-wa ' + id + ': ' + e.message)); } catch (e) { log('kh-wa ' + id + ': ' + e.message); } };
  watch('khWa', d => { cfg = { on: d.on !== false, allow: Array.isArray(d.allow) ? d.allow.map(a => ({ n: String((a && a.n) || '').slice(0, 30), p: normPh(a && a.p) })).filter(a => a.p) : [] }; });
  watch('khNum', d => { num = (d && d.m) || {}; });
  watch('waParchi', d => { base = { prFrom: Array.isArray(d.prFrom) && d.prFrom.length ? d.prFrom.map(normPh) : base.prFrom, prTo: Array.isArray(d.prTo) && d.prTo.length ? d.prTo.map(normPh) : base.prTo }; });
  const who = ph => { const a = cfg.allow.find(x => x.p === ph); if (a) return a.n || ph; if (base.prFrom.includes(ph)) return 'Malik'; if (base.prTo.includes(ph)) return 'Mubeen'; return ''; };
  const isMalik = ph => base.prFrom.includes(ph);
  const today = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
  async function say(to, id, txt, ke, extra) { try { await Q.doc(id).create({ st: 'new', at: Date.now(), to, nm: who(to) || 'Kharcha', kind: 'rem', eid: id, txt, ...(ke ? { ke } : {}), ...(extra || {}) }); } catch (e) { if (!/already exists/i.test(String(e.message || e))) log('kh-wa jawab: ' + e.message); } }
  const clean = w => String(w || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  // v1.2: parties (sirf pehle 1/2/3 hukum par sunna shuru) + smart naam talaash
  let PT = null, ptReady = null, DH = null;
  const parties = () => ptReady || (ptReady = new Promise(res => { PT = new Map(); let first = true; const done = () => { if (first) { first = false; res(); } };
    try { KH.where('type', '==', 'party').onSnapshot(sn => { sn.docChanges().forEach(ch => { if (ch.type === 'removed') PT.delete(ch.doc.id); else PT.set(ch.doc.id, { ...(ch.doc.data() || {}), id: ch.doc.id }); }); done(); }, e => { log('kh-wa parties: ' + e.message); ptReady = null; done(); }); } catch (e) { log('kh-wa parties: ' + e.message); ptReady = null; done(); }
    setTimeout(done, 20000); }));
  const okParty = p => p && !p.deleted && p.type === 'party' && !p.bank && p.active !== false && String(p.name || '').trim();
  async function find(q, not, strict) {
    await parties(); if (!DH) DH = await import(require('url').pathToFileURL(require('path').join(__dirname, 'dhoond.mjs')).href);
    const L = [...PT.values()].filter(p => okParty(p) && p.id !== not), r = DH.smartFind(L, q, p => String(p.name || ''), p => p.id, 40), out = [];
    for (const p of [...r.hits, ...(strict ? [] : r.near)]) { if (!out.includes(p)) out.push(p); if (out.length >= 5) break; }
    return out;
  }
  const PEND = BA.doc('khPend'), KN = { 1: 'Payment LI (wasooli)', 2: 'Payment DI', 3: 'Transfer' };
  const listTxt = L => L.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  // ---- v1.3: baqaya / khata (app jaisa hisaab) ----
  const CASH_FROM = '2026-09-20', hasBill = e => (Array.isArray(e.posBillIds) && e.posBillIds.length > 0) || !!e.posBill;
  const cashPays = e => e.kind === 'purchaseCash' && String(e.date || '') >= CASH_FROM && hasBill(e);
  const skipsBal = e => e.purchase === true && e.kind === 'borrow' && !String(e.id || '').startsWith('pos-') && hasBill(e);
  const sgn = e => (['credit', 'payment'].includes(e.kind) || cashPays(e)) ? 1 : ['borrow', 'collection'].includes(e.kind) ? -1 : 0;
  async function entriesOf(pid) { const sn = await KH.where('partyId', '==', pid).get(); return sn.docs.map(x => ({ ...(x.data() || {}), id: x.id })).filter(e => e.type === 'entry' && !e.deleted && !skipsBal(e)); }
  const balOf = (p, E) => (Number(p.opening) || 0) + E.reduce((n, e) => n + sgn(e) * (Number(e.amount) || 0), 0);
  const balTxt = b => `${rsT(Math.abs(b) / 100)} ${b > 0 ? 'lene hain' : b < 0 ? 'dene hain' : '· barabar'}`;
  async function balLine(pid) { try { await parties(); const p = PT.get(pid); if (!p) return ''; return `\n${p.name} ka baqaya: ${balTxt(balOf(p, await entriesOf(pid)))}`; } catch (e) { log('kh-wa baqaya: ' + e.message); return ''; } }
  const TY = { purchaseCash: 'Cash purchase', sale: 'Daily sale', collection: 'Wasooli', payment: 'Party ko payment', expense: 'Akhrajat', credit: 'Udhar diya', borrow: 'Hum ne dena hai' };
  const asc = x => String(x == null ? '' : x).replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  const lbl = e => e.transferId ? (e.transferRole === 'out' ? 'Transfer -> ' + asc(e.toName) : 'Transfer <- ' + asc(e.fromName)) : (TY[e.kind] || '');
  const titles = p => p.category === 'Customer' ? ['Saman diya (Udhar)', 'Wasooli'] : p.category === 'Supplier' ? ['Payment di', 'Saman liya'] : ['Payment / Diye', 'Wasooli / Liye'];
  const DAYS = 30;
  // { n, pid, sub, op, b, lt, rt, L, R, tl, tr } — WAHI shakal jo app khataPrints ko deti hai (raqam PAISA)
  async function khataData(p) {
    const E = await entriesOf(p.id), from = new Date(Date.now() + 5 * 3600000 - DAYS * 86400000).toISOString().slice(0, 10), to = today();
    const W = E.filter(e => String(e.date || '') >= from).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    const row = e => [String(e.date || '').slice(8, 10) + '-' + String(e.date || '').slice(5, 7), Number(e.amount) || 0, e.transferId ? asc(lbl(e)) : asc(e.note) || asc(lbl(e))];
    const L = W.filter(e => ['payment', 'credit', 'expense', 'purchaseCash'].includes(e.kind)).map(row), R = W.filter(e => ['collection', 'borrow', 'sale'].includes(e.kind)).map(row), sum = a => a.reduce((n, r) => n + r[1], 0), [lt, rt] = titles(p);
    return { n: p.name, pid: p.id, sub: `Tareekh: ${from} se ${to}`, op: Number(p.opening) || 0, b: balOf(p, E), lt: lt.toUpperCase(), rt: rt.toUpperCase(), L, R, tl: sum(L), tr: sum(R) };
  }
  function khataPdf(J) {
    const n = v => ((Number(v) || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }), fit = (t, w) => { t = asc(t); return t.length > w ? t.slice(0, w) : t + ' '.repeat(w - t.length); }, CW = 48;
    const cell = r => Array.isArray(r) ? fit(r[0], 5) + ' ' + n(r[1]).padStart(12).slice(-12) + '  ' + fit(r[2], 28) : ' '.repeat(CW), side = v => v > 0 ? 'LENE HAIN' : v < 0 ? 'DENE HAIN' : 'BARABAR';
    const out = [{ t: 'NOOR TRADERS - KHATA', b: 1, z: 14 }, { t: asc(J.n) || '(naam Urdu mein)', b: 1, z: 13 }, { t: J.sub + '   (bana: ' + new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 16).replace('T', ' ') + ')' }, { t: '' },
      { t: `AB BAQAYA: Rs ${n(Math.abs(J.b))}  ${side(J.b)}`, b: 1, z: 12 }, { t: `Opening: Rs ${n(Math.abs(J.op))} ${side(J.op)}` }, { t: '' },
      { t: fit(J.lt, CW) + ' | ' + fit(J.rt, CW), b: 1 }, { t: '-'.repeat(CW) + '-+-' + '-'.repeat(CW) }];
    for (let i = 0; i < Math.max(J.L.length, J.R.length); i++) out.push({ t: cell(J.L[i]) + ' | ' + cell(J.R[i]) });
    out.push({ t: '-'.repeat(CW) + '-+-' + '-'.repeat(CW) }, { t: fit(`Kul Rs ${n(J.tl)} (${J.L.length})`, CW) + ' | ' + fit(`Kul Rs ${n(J.tr)} (${J.R.length})`, CW), b: 1 });
    return pdfMake(out);
  }
  async function mkPay(k, A, amt, daily, note0, ow, ph, name) {
    const t = Date.now(), id = 'wk' + ow, note = (A.name + ' - ' + (note0 ? note0 + ' - ' : '') + '📲 WhatsApp ' + name).slice(0, 300);
    await KH.doc(id).create({ id, type: 'entry', kind: k === 1 ? 'collection' : 'payment', partyId: A.id, amount: Math.round(Number(amt) * 100), date: today(), note, dailyIncluded: daily !== false, posPending: false, wa: ow, waFrom: ph, by: 'pc-wa', byName: name, updatedBy: 'pc-wa', createdAt: t, updatedAt: t, rev: 1 });
    log(`🔢 ${k === 1 ? 'payment li' : 'payment di'} WhatsApp: ${A.name} ${rsT(amt)} — ${name}`);
    return { id, txt: `✅ ${k === 1 ? 'Payment LI' : 'Payment DI'} · ${A.name} · ${rsT(amt)}\nDaily Sale: ${daily !== false ? 'HAAN' : 'NAHI'}${note0 ? '\n' + note0 : ''}${await balLine(A.id)}\n↩ Ghalat ho to malik is paigham par reply mein "cancel" likhe.` };
  }
  async function mkTransfer(A, B, amt, ow, ph, name) {
    const t = Date.now(), tid = 'wk' + ow, ids = ['transfer-' + tid + '-out', 'transfer-' + tid + '-in'], b = KH.firestore.batch();
    ids.forEach((id, i) => b.create(KH.doc(id), { id, type: 'entry', transferId: tid, transferRole: i ? 'in' : 'out', fromPartyId: A.id, toPartyId: B.id, fromName: A.name, toName: B.name, partyId: i ? B.id : A.id, kind: i ? 'payment' : 'collection', dailyIncluded: false, amount: Math.round(Number(amt) * 100), date: today(), note: (A.name + ' se ' + B.name + ' ko - 📲 WhatsApp ' + name).slice(0, 300), posPending: false, posVoucher: '', wa: ow, waFrom: ph, by: 'pc-wa', byName: name, updatedBy: 'pc-wa', createdAt: t, updatedAt: t, rev: 1 }));
    await b.commit(); log(`⇄ transfer WhatsApp: ${A.name} -> ${B.name} ${rsT(amt)} — ${name}`);
    return { id: ids[0], txt: `✅ Transfer ${rsT(amt)}\n${A.name} → ${B.name}${await balLine(A.id)}${await balLine(B.id)}\n↩ Ghalat ho to malik is paigham par reply mein "cancel" likhe.` };
  }
  const FVd = () => require('firebase-admin/firestore').FieldValue.delete();
  const pendSet = async (ph, d) => { const v = { ...d, at: Date.now() }; try { await PEND.update({ [ph]: v }); } catch (e) { await PEND.set({ [ph]: v }, { merge: true }); } }, pendDrop = ph => PEND.update({ [ph]: FVd() }).catch(() => {});
  async function pendGet(ph) { try { const sn = await PEND.get(), d = (sn.exists && (sn.data() || {})[ph]) || null; return d && Date.now() - Number(d.at) <= 10 * 60000 ? d : null; } catch (e) { log('kh-wa pend: ' + e.message); return null; } }
  const menuTxt = async p => `${p.name}${(await balLine(p.id)).replace(/^\n.* ka baqaya/, '\nBaqaya')}\n\n1 Payment li\n2 Payment di\n3 Transfer\n4 PDF (30 din)\n5 Print (30 din)\n\nAise bhejein:\n1 5000  ·  2 5000  ·  3 5000 Aslam  ·  4  ·  5\n(aakhir mein "no" = Daily Sale mein nahi · 0 = chhoro)`;
  // naam -> list (sirf Business number ki chat; naam na mile = chup)
  async function nameAsk(ph, name, w, text) {
    const L = await find(text, '', text.trim().split(/\s+/).length < 2); if (!L.length) return false;
    await pendSet(ph, { stg: 'n', a: L.map(x => x.id), w, by: name });
    await say(ph, 'kq-' + w, `${listTxt(L)}\n\nNaam ka number bhejein (0 = chhoro)`); return true;
  }
  // ---- v1.5: 🔔 REMINDER (malik 13 Nov: 'reminder bhi WhatsApp par · "Reminder Samiullah ne payment deni hai 7800 / kal se jab tak off na karo" · "all reminder show" · "3 off" · sirf mujhe · Mubeen ka apna reminder system apne number se')
  //   blueAccess/waRem-<number> {L:[{n, t, from, on, at}], next} — har number ki apni list; roz REM_HOUR baje EK paigham (waOut rm-<number>-<din>, create = dohra nahi). AI nahi.
  const REM_HOUR = 11, canRem = ph => base.prFrom.includes(ph) || base.prTo.includes(ph), RM = ph => BA.doc('waRem-' + ph);
  async function remGet(ph) { const sn = await RM(ph).get(), d = sn.exists ? sn.data() || {} : {}; return { L: Array.isArray(d.L) ? d.L : [], next: Number(d.next) || 1 }; }
  const remSave = (ph, R) => RM(ph).set({ L: R.L.slice(-200), next: R.next, at: Date.now() });
  const dayPlus = n => new Date(Date.now() + 5 * 3600000 + n * 86400000).toISOString().slice(0, 10), dShow = d => String(d).slice(8, 10) + '-' + String(d).slice(5, 7);
  const remList = L => L.map(r => `${r.n}. ${r.t}${r.from > today() ? ' (' + dShow(r.from) + ' se)' : ''}`).join('\n');
  async function remCmd(ph, name, w, text, ts) {
    if (!canRem(ph)) { await say(ph, 'kx-' + w, '✕ Reminder abhi sirf malik aur Mubeen ke liye hai.'); return true; }
    if (ts && Date.now() - ts > 10 * 60000) return true;
    const R = await remGet(ph), act = R.L.filter(r => r.on !== false), off = OFF_RE.exec(text);
    if (off) { const n = Number(off[1]), r = act.find(x => Number(x.n) === n); if (!r) { await say(ph, 'kx-' + w, `✕ Reminder ${n} nahi mila. List dekhein: all reminder show`); return true; }
      r.on = false; r.offAt = Date.now(); await remSave(ph, R); await say(ph, 'kw-' + w, `✅ Reminder ${n} band: ${r.t}`); return true; }
    const body = text.replace(/^\s*(all\s+)?(reminders?|remainders?)[\s:.\-]*/i, '').trim(), low = body.toLowerCase().replace(/[.\s]+/g, ' ').trim();
    if (!low || /^(show|list|dikhao|dikha do|sab|all|sab dikhao)$/.test(low)) { await say(ph, 'kw-' + w, act.length ? `🔔 Aap ke reminder (${act.length}):\n${remList(act)}\n\nBand: "${act[0].n} off" · sab band: "reminder off"` : '🔔 Koi reminder nahi laga.\nLagane ke liye: reminder Imran se paisa lena hai\nkal se'); return true; }
    if (/^(off|sab off|all off|band|sab band)$/.test(low)) { if (!act.length) { await say(ph, 'kx-' + w, '🔔 Koi reminder chalu nahi.'); return true; }
      await pendSet(ph, { stg: 'x', w, by: name }); await say(ph, 'kq-' + w, `Sab ${act.length} reminder band karun?\n${remList(act)}\n\n1 = haan · 0 = nahi`); return true; }
    let add = 0, lines = body.split(/\n+/).map(x => x.trim()).filter(Boolean);
    lines = lines.map(x => { if (/(^|\s)parson(\s+se)?(\s|$)/i.test(x) && /se|^parson$/i.test(x)) add = Math.max(add, 2); else if (/(^|\s)kal\s+se(\s|$)|^kal$/i.test(x)) add = Math.max(add, 1);
      return x.replace(/(^|\s)(kal|aaj|parson)\s+se(?=\s|$)/ig, ' ').replace(/^(kal|aaj|parson)$/i, '').replace(/jab\s*tak\b.*$/i, '').replace(/\.{2,}/g, ' ').split(/\s+/).filter(tk => normPh(tk) !== ph || !/\d{10}/.test(tk)).join(' ').trim(); }).filter(Boolean);
    const t = lines.join(' · ').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!t) { await say(ph, 'kx-' + w, '✕ Reminder ki likhai nahi mili. Aise likhein:\nreminder Imran se paisa lena hai 7800\nkal se'); return true; }
    if (act.length >= 50) { await say(ph, 'kx-' + w, '✕ 50 reminder chalu hain — pehle kuch band karein ("3 off").'); return true; }
    const n = R.next, from = dayPlus(add); R.L.push({ n, t, from, on: true, at: Date.now() }); R.next = n + 1; await remSave(ph, R);
    log(`🔔 reminder ${n} (${name}): ${t}`);
    await say(ph, 'kw-' + w, `✅ Reminder ${n} lag gaya\n${t}\n${add ? dShow(from) + ' se' : 'Aaj se'} roz subah ${REM_HOUR} baje — jab tak off na karein.\nBand: "${n} off" · List: "all reminder show"`); return true;
  }
  const remSent = {};
  async function remTick() {
    try { const h = new Date(Date.now() + 5 * 3600000).getUTCHours(); if (h < REM_HOUR || h >= 21 || cfg.on === false) return; const day = today();
      for (const ph of [...new Set([...base.prFrom, ...base.prTo])]) { if (!ph || remSent[ph] === day) continue;
        const R = await remGet(ph), due = R.L.filter(r => r.on !== false && String(r.from || '') <= day); remSent[ph] = day; if (!due.length) continue;
        await say(ph, 'rm-' + ph + '-' + day, `🔔 Aaj ke reminder (${dShow(day)}):\n${remList(due)}\n\nBand karne ke liye: "${due[0].n} off"`); log(`🔔 ${who(ph)}: ${due.length} reminder bheje`); }
    } catch (e) { log('🔔 reminder tick: ' + e.message); }
  }
  let remTimer = null; const startRem = () => { if (remTimer) return; remTimer = setInterval(remTick, 60000); if (remTimer.unref) remTimer.unref(); setTimeout(remTick, 20000); };
  async function stage(ph, name, w, text, d) {
    const pk = PICK_RE.exec(text), sm = STG_RE.exec(text);
    if (pk && Number(pk[1]) === 0 && pk[2] == null) { await pendDrop(ph); await say(ph, 'kx-' + w, '↩ Theek hai — chhor diya.'); return true; }
    await parties();
    if (d.stg === 'n') {
      if (!pk || pk[2] != null) return false;
      const p = PT.get((d.a || [])[Number(pk[1]) - 1]); if (!okParty(p)) { await say(ph, 'kx-' + w, '✕ Yeh number list mein nahi.'); return true; }
      await pendSet(ph, { stg: 'm', pid: p.id, w, by: name }); await say(ph, 'kq-' + w, await menuTxt(p)); return true;
    }
    if (d.stg === 't') {
      if (!pk || pk[2] != null) return false;
      const A = PT.get(d.pid), B = PT.get((d.b || [])[Number(pk[1]) - 1]); if (!okParty(A) || !okParty(B) || A.id === B.id) { await say(ph, 'kx-' + w, '✕ Yeh number list mein nahi.'); return true; }
      await pendDrop(ph); const r = await mkTransfer(A, B, d.amt, clean(d.w), ph, name); await say(ph, 'kw-' + w, r.txt, r.id); return true;
    }
    if (d.stg === 'x') {
      if (!pk || pk[2] != null) return false; if (Number(pk[1]) !== 1) { await say(ph, 'kx-' + w, '1 = haan (sab band) · 0 = nahi'); return true; }
      const R = await remGet(ph); let n = 0; for (const r of R.L) if (r.on !== false) { r.on = false; r.offAt = Date.now(); n++; }
      await remSave(ph, R); await pendDrop(ph); await say(ph, 'kw-' + w, `✅ ${n} reminder band ho gaye.`); return true;
    }
    if (d.stg === 'r') {
      if (!pk || pk[2] != null) return false; const k = { 1: 'd', 2: 'l', 3: 'p', 4: 'all' }[Number(pk[1])]; if (!k) { await say(ph, 'kx-' + w, '✕ 1, 2, 3 ya 4 bhejein.'); return true; }
      await pendDrop(ph); await BA.doc('reportConfig').set({ reportNow: Date.now(), waOnly: k }, { merge: true });
      await say(ph, 'kw-' + w, '⏳ Report ban rahi hai — 1-2 minute mein malik ke WhatsApp par aayegi.'); return true;
    }
    if (d.stg === 'm') {
      if (!sm) return false; const p = PT.get(d.pid); if (!okParty(p)) { await pendDrop(ph); await say(ph, 'kx-' + w, '✕ Yeh khata ab nahi mila.'); return true; }
      const k = Number(sm[1]); let rest = String(sm[2] || '').trim(), daily = true;
      if (k === 4 || k === 5) {
        const J = await khataData(p);
        if (k === 5) { const id = 'kpw' + w.slice(-20); await biz.collection('khataPrints').doc(id).set({ j: JSON.stringify(J), name: String(p.name).slice(0, 80), byName: ('WhatsApp ' + name).slice(0, 60), status: 'new', by: 'pc-wa', at: Date.now() }); await say(ph, 'kw-' + w, `🖨 ${p.name} ka khata (30 din · ${J.L.length + J.R.length} entries) dukan ke printer par bhej diya.`); return true; }
        const buf = khataPdf(J); if (buf.length > 900000) { await say(ph, 'kx-' + w, '✕ Khata bohat bara hai — PDF app se nikalein.'); return true; }
        await say(ph, 'kw-' + w, `📄 ${p.name} · 30 din · baqaya ${balTxt(J.b)}`, '', { doc: buf, fn: (asc(p.name).replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Khata').slice(0, 40) + '.pdf' }); return true;
      }
      if (/(^|\s)(no|nahi|nhi)(\s|$)/i.test(rest)) { daily = false; rest = rest.replace(/(^|\s)(no|nahi|nhi)(?=\s|$)/ig, ' ').replace(/\s+/g, ' ').trim(); }
      const nm = /(?:^|\s)(\d[\d,]*(?:\.\d+)?)(?=\s|$)/.exec(rest), amt = nm ? Number(nm[1].replace(/,/g, '')) : 0;
      if (!(amt > 0)) { await say(ph, 'kx-' + w, `✕ Raqam bhi likhein, jaise: ${k} 5000${k === 3 ? ' Aslam' : ''}`); return true; }
      const tail = (rest.slice(0, nm.index) + ' ' + rest.slice(nm.index + nm[0].length)).replace(/(^|\s)(rs\.?|rupay|rupees|rupaye)(?=\s|$)/ig, ' ').replace(/\s+/g, ' ').trim();
      if (k === 3) {
        if (!tail) { await say(ph, 'kx-' + w, '✕ Kis ko transfer? Aise: 3 5000 Aslam'); return true; }
        const B = await find(tail, p.id); if (!B.length) { await say(ph, 'kx-' + w, `✕ "${tail}" naam ka koi khata nahi mila. Dobara: 3 ${amt} <naam>`); return true; }
        await pendSet(ph, { stg: 't', pid: p.id, amt, b: B.map(x => x.id), w, by: name });
        await say(ph, 'kq-' + w, `Transfer ${rsT(amt)} · ${p.name} →\n\n${listTxt(B)}\n\nKis ko? Number bhejein (0 = chhoro)`); return true;
      }
      await pendDrop(ph); const r = await mkPay(k, p, amt, daily, tail.slice(0, 200), w, ph, name); await say(ph, 'kw-' + w, r.txt, r.id); return true;
    }
    return false;
  }
  async function ask(ph, name, w, p) {
    if (!p.amt) { await say(ph, 'kx-' + w, `✕ Raqam samajh nahi aayi. Aise likhein:\n1 Imran 5000 (payment li)\n2 Imran 5000 (payment di)\n3 Imran 5000 Aslam (transfer)`); return true; }
    if (!p.a || (p.k === 3 && !p.b)) { await say(ph, 'kx-' + w, p.k === 3 ? '✕ Transfer: dono naam likhein — 3 Imran 5000 Aslam' : '✕ Naam likhein — ' + p.k + ' Imran 5000'); return true; }
    const A = await find(p.a), B = p.k === 3 ? await find(p.b) : [];
    if (!A.length || (p.k === 3 && !B.length)) { await say(ph, 'kx-' + w, `✕ "${!A.length ? p.a : p.b}" naam ka koi khata nahi mila. Naam ka koi aur hissa likh kar dobara bhejein.`); return true; }
    await pendSet(ph, { k: p.k, amt: p.amt, daily: !!p.daily, note: String(p.note || '').slice(0, 200), a: A.map(x => x.id), b: B.map(x => x.id), w, by: name });
    const head = `${KN[p.k]} · ${rsT(p.amt)}` + (p.k === 3 ? '' : ` · Daily Sale: ${p.daily ? 'HAAN' : 'NAHI'}`);
    await say(ph, 'kq-' + w, p.k === 3 ? `${head}\n\nKIS SE (pehla):\n${listTxt(A)}\n\nKIS KO (doosra):\n${listTxt(B)}\n\nDo number bhejein, jaise: 1 1\n(10 min mein · ghalat ho to 0)` : `${head}\n\n${listTxt(A)}\n\nNumber bhejein (10 min mein · ghalat ho to 0)`);
    return true;
  }
  async function pick(ph, name, w, text, d) {
    const m = PICK_RE.exec(text); if (!m) return false;
    if (!d || d.stg) return false;
    const FV = require('firebase-admin/firestore').FieldValue, drop = () => PEND.update({ [ph]: FV.delete() }).catch(() => {});
    const n1 = Number(m[1]), n2 = m[2] == null ? 0 : Number(m[2]);
    if (n1 === 0) { await drop(); await say(ph, 'kx-' + w, '↩ Theek hai — kuch nahi lagaya.'); return true; }
    await parties();
    const A = PT.get((d.a || [])[n1 - 1]), B = d.k === 3 ? PT.get((d.b || [])[n2 - 1]) : null;
    if (d.k === 3 && !n2) { await say(ph, 'kx-' + w, '✕ Transfer ke liye DO number bhejein, jaise: 1 2'); return true; }
    if (!okParty(A) || (d.k === 3 && !okParty(B))) { await say(ph, 'kx-' + w, '✕ Yeh number list mein nahi. List wala number bhejein.'); return true; }
    if (d.k === 3 && A.id === B.id) { await say(ph, 'kx-' + w, '✕ Dono khate ek hi hain — do alag number bhejein.'); return true; }
    const ow = clean(d.w); await drop();
    try { const r = d.k === 3 ? await mkTransfer(A, B, d.amt, ow, ph, name) : await mkPay(d.k, A, d.amt, d.daily, String(d.note || ''), ow, ph, name); await say(ph, 'kw-' + w, r.txt, r.id); }
    catch (e) { if (/already exists/i.test(String(e.message || e))) return true; throw e; }
    return true;
  }
  // { text, from (number), wid, ts (ms), quoted (jis paigham ka reply), quiet (true = anjaan number par chup) } → true = yeh kharcha ka hukum tha (aage koi aur na chhere)
  async function apply({ text, from, wid, ts, quoted, quiet, biz: inBiz }) {
    const ph = normPh(from), name = who(ph); if (!ph || !name || cfg.on === false) return false;
    const w = clean(wid); if (!w) return false;
    if (REM_RE.test(text) || OFF_RE.test(text)) return await remCmd(ph, name, w, text, ts);
    if (CANCEL_RE.test(text)) {
      const q = clean(quoted); if (!q) return false;
      if (!isMalik(ph)) { await say(ph, 'kc-' + w, '✕ Cancel sirf malik kar sakta hai.'); return true; }
      let ref = KH.doc('wk' + q), sn = await ref.get();
      if (!sn.exists) { try { const o = await Q.where('wid', '==', String(quoted)).limit(1).get(); const ke = o.empty ? '' : String((o.docs[0].data() || {}).ke || ''); if (ke) { ref = KH.doc(ke); sn = await ref.get(); } } catch (e) { log('kh-wa cancel dhoond: ' + e.message); } }
      if (!sn.exists) return false;
      const e = sn.data() || {}; if (!e.wa) return false;
      if (e.deleted) { await say(ph, 'kc-' + w, '↩ Yeh entry pehle hi wapas ho chuki hai.'); return true; }
      if (e.waFrom !== ph && !isMalik(ph)) { await say(ph, 'kc-' + w, '✕ Yeh entry ' + (e.byName || 'kisi aur') + ' ne lagayi thi — wohi ya malik wapas kar sakta hai.'); return true; }
      const t = Date.now(), del = { deleted: true, updatedAt: t, updatedBy: 'pc-wa', rev: (Number(e.rev) || 1) + 1 };
      if (e.transferId) { const b = KH.firestore.batch(); ['out', 'in'].forEach(r => b.set(KH.doc('transfer-' + e.transferId + '-' + r), del, { merge: true })); await b.commit(); } else await ref.set(del, { merge: true });
      log(`↩ WhatsApp entry wapas: ${e.id} ${rsT(e.amount / 100)} (${name})`);
      await say(ph, 'kc-' + w, `↩ Wapas ho gaya: ${rsT(e.amount / 100)}${e.note ? ' — ' + String(e.note).slice(0, 80) : ''}`); return true;
    }
    const fresh = !ts || Date.now() - ts <= 10 * 60000;
    if (REP_RE.test(text)) { if (!fresh) return true; if (!isMalik(ph)) { await say(ph, 'kx-' + w, '✕ Reports sirf malik maang sakta hai.'); return true; }
      await pendSet(ph, { stg: 'r', w, by: name }); await say(ph, 'kq-' + w, '📊 Kaun si report?\n\n1 Daily Sale ka hisaab\n2 Larka-wise\n3 Dukan ka profit\n4 Teeno\n\nNumber bhejein (0 = chhoro)'); return true; }
    let pd = null;
    if (fresh && (PICK_RE.test(text) || STG_RE.test(text))) { pd = await pendGet(ph); if (pd && pd.stg && await stage(ph, name, w, text, pd)) return true; }
    if (PICK_RE.test(text)) return await pick(ph, name, w, text, pd);
    if (inBiz && looksName(text)) return fresh ? await nameAsk(ph, name, w, text) : false;
    const p2 = parse2(text);
    if (p2) {
      const age2 = ts ? Date.now() - ts : 0; if (age2 > 60 * 60000) return true;
      if (age2 > 10 * 60000) { await say(ph, 'kx-' + w, `✕ Yeh paigham ${Math.round(age2 / 60000)} min purana hai (PC band tha?) — nahi lagaya. Dobara bhej dein.`); return true; }
      return await ask(ph, name, w, p2);
    }
    const p = parse(text); if (!p) return false;
    const pid = Object.keys(num).find(k => pad3(num[k]) === p.code);
    if (!pid) { if (!quiet) await say(ph, 'kx-' + w, `✕ ${p.code} number ka koi kharcha khata nahi. (App: WhatsApp Parchi ⋮ → 🔢 Kharcha WhatsApp se — list dekhein)`); return !quiet; }
    const age = ts ? Date.now() - ts : 0;
    if (age > 60 * 60000) return true;   // bohat purana (history) — chup
    if (age > 10 * 60000) { await say(ph, 'kx-' + w, `✕ ${p.code}: yeh paigham ${Math.round(age / 60000)} min purana hai (PC band tha?) — nahi lagaya. Dobara bhej dein.`); return true; }
    if (!p.amt) { await say(ph, 'kx-' + w, `✕ ${p.code}: raqam samajh nahi aayi. Aise likhein: ${p.code} Imran ne paisa liya 4900`); return true; }
    const ps = await KH.doc(pid).get(), party = ps.exists ? ps.data() || {} : null;
    if (!party || party.deleted || party.type !== 'party' || !party.kharcha) { await say(ph, 'kx-' + w, `✕ ${p.code}: yeh kharcha khata nahi mila (hata diya gaya?).`); return true; }
    if (party.active === false) { await say(ph, 'kx-' + w, `✕ ${p.code} ${party.name}: yeh khata BAND hai.`); return true; }
    const id = 'wk' + w, t = Date.now(), amount = Math.round(p.amt * 100), note = (String(party.name || '') + ' - ' + (p.note ? p.note + ' - ' : '') + '📲 WhatsApp ' + name).slice(0, 300);
    try { await KH.doc(id).create({ id, type: 'entry', kind: 'payment', partyId: pid, amount, date: today(), note, dailyIncluded: true, posPending: false, wa: w, waFrom: ph, by: 'pc-wa', byName: name, updatedBy: 'pc-wa', createdAt: t, updatedAt: t, rev: 1 }); }
    catch (e) { if (/already exists/i.test(String(e.message || e))) return true; throw e; }
    log(`🔢 kharcha WhatsApp: ${p.code} ${party.name} ${rsT(p.amt)} — ${name}`);
    await say(ph, 'kw-' + w, `✅ ${p.code} ${party.name} · ${rsT(p.amt)} Akhrajat mein lag gaya${p.note ? '\n' + p.note : ''}\n↩ Ghalat ho to is paigham par reply mein "cancel" likhein.`, id);
    return true;
  }
  return { apply, looks, looksName, startRem, remTick, who: ph => who(normPh(ph)), ver: VER };
}
module.exports = make; module.exports.parse = parse; module.exports.parse2 = parse2; module.exports.looksName = looksName; module.exports.pdfMake = pdfMake; module.exports.looks = looks; module.exports.normPh = normPh;
