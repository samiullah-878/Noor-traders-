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
//  Number: blueAccess/khNum {m: {partyId: n}} — malik ki app deti hai. AI NAHI. SQL nahi (POS ko yeh file kabhi nahi chhooti).
// =========================================================
const VER = '1.2';   // v1.1: who() bahar (Business inbox ki ijazat isi list se)
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
const looks = t => { t = String(t || ''); return /^\s*\d{3}(?!\d)/.test(t) || CANCEL_RE.test(t) || PICK_RE.test(t) || (P2_RE.test(t) && !/print/i.test(t)); };
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
  async function say(to, id, txt, ke) { try { await Q.doc(id).create({ st: 'new', at: Date.now(), to, nm: who(to) || 'Kharcha', kind: 'rem', eid: id, txt, ...(ke ? { ke } : {}) }); } catch (e) { if (!/already exists/i.test(String(e.message || e))) log('kh-wa jawab: ' + e.message); } }
  const clean = w => String(w || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  // v1.2: parties (sirf pehle 1/2/3 hukum par sunna shuru) + smart naam talaash
  let PT = null, ptReady = null, DH = null;
  const parties = () => ptReady || (ptReady = new Promise(res => { PT = new Map(); let first = true; const done = () => { if (first) { first = false; res(); } };
    try { KH.where('type', '==', 'party').onSnapshot(sn => { sn.docChanges().forEach(ch => { if (ch.type === 'removed') PT.delete(ch.doc.id); else PT.set(ch.doc.id, { ...(ch.doc.data() || {}), id: ch.doc.id }); }); done(); }, e => { log('kh-wa parties: ' + e.message); ptReady = null; done(); }); } catch (e) { log('kh-wa parties: ' + e.message); ptReady = null; done(); }
    setTimeout(done, 20000); }));
  const okParty = p => p && !p.deleted && p.type === 'party' && !p.bank && p.active !== false && String(p.name || '').trim();
  async function find(q) {
    await parties(); if (!DH) DH = await import(require('url').pathToFileURL(require('path').join(__dirname, 'dhoond.mjs')).href);
    const L = [...PT.values()].filter(okParty), r = DH.smartFind(L, q, p => String(p.name || ''), p => p.id, 40), out = [];
    for (const p of [...r.hits, ...r.near]) { if (!out.includes(p)) out.push(p); if (out.length >= 5) break; }
    return out;
  }
  const PEND = BA.doc('khPend'), KN = { 1: 'Payment LI (wasooli)', 2: 'Payment DI', 3: 'Transfer' };
  const listTxt = L => L.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  async function ask(ph, name, w, p) {
    if (!p.amt) { await say(ph, 'kx-' + w, `✕ Raqam samajh nahi aayi. Aise likhein:\n1 Imran 5000 (payment li)\n2 Imran 5000 (payment di)\n3 Imran 5000 Aslam (transfer)`); return true; }
    if (!p.a || (p.k === 3 && !p.b)) { await say(ph, 'kx-' + w, p.k === 3 ? '✕ Transfer: dono naam likhein — 3 Imran 5000 Aslam' : '✕ Naam likhein — ' + p.k + ' Imran 5000'); return true; }
    const A = await find(p.a), B = p.k === 3 ? await find(p.b) : [];
    if (!A.length || (p.k === 3 && !B.length)) { await say(ph, 'kx-' + w, `✕ "${!A.length ? p.a : p.b}" naam ka koi khata nahi mila. Naam ka koi aur hissa likh kar dobara bhejein.`); return true; }
    await PEND.set({ [ph]: { k: p.k, amt: p.amt, daily: !!p.daily, note: String(p.note || '').slice(0, 200), a: A.map(x => x.id), b: B.map(x => x.id), w, at: Date.now(), by: name } }, { merge: true });
    const head = `${KN[p.k]} · ${rsT(p.amt)}` + (p.k === 3 ? '' : ` · Daily Sale: ${p.daily ? 'HAAN' : 'NAHI'}`);
    await say(ph, 'kq-' + w, p.k === 3 ? `${head}\n\nKIS SE (pehla):\n${listTxt(A)}\n\nKIS KO (doosra):\n${listTxt(B)}\n\nDo number bhejein, jaise: 1 1\n(10 min mein · ghalat ho to 0)` : `${head}\n\n${listTxt(A)}\n\nNumber bhejein (10 min mein · ghalat ho to 0)`);
    return true;
  }
  async function pick(ph, name, w, text) {
    const m = PICK_RE.exec(text); if (!m) return false;
    const sn = await PEND.get(), d = (sn.exists && (sn.data() || {})[ph]) || null; if (!d || Date.now() - Number(d.at) > 10 * 60000) return false;
    const FV = require('firebase-admin/firestore').FieldValue, drop = () => PEND.update({ [ph]: FV.delete() }).catch(() => {});
    const n1 = Number(m[1]), n2 = m[2] == null ? 0 : Number(m[2]);
    if (n1 === 0) { await drop(); await say(ph, 'kx-' + w, '↩ Theek hai — kuch nahi lagaya.'); return true; }
    await parties();
    const A = PT.get((d.a || [])[n1 - 1]), B = d.k === 3 ? PT.get((d.b || [])[n2 - 1]) : null;
    if (d.k === 3 && !n2) { await say(ph, 'kx-' + w, '✕ Transfer ke liye DO number bhejein, jaise: 1 2'); return true; }
    if (!okParty(A) || (d.k === 3 && !okParty(B))) { await say(ph, 'kx-' + w, '✕ Yeh number list mein nahi. List wala number bhejein.'); return true; }
    if (d.k === 3 && A.id === B.id) { await say(ph, 'kx-' + w, '✕ Dono khate ek hi hain — do alag number bhejein.'); return true; }
    const t = Date.now(), amount = Math.round(Number(d.amt) * 100), ow = clean(d.w), tag = '📲 WhatsApp ' + name, wa = { wa: ow, waFrom: ph, by: 'pc-wa', byName: name, updatedBy: 'pc-wa', createdAt: t, updatedAt: t, rev: 1 };
    await drop();
    try {
      if (d.k === 3) {
        const tid = 'wk' + ow, ids = ['transfer-' + tid + '-out', 'transfer-' + tid + '-in'], b = KH.firestore.batch();
        ids.forEach((id, i) => b.create(KH.doc(id), { id, type: 'entry', transferId: tid, transferRole: i ? 'in' : 'out', fromPartyId: A.id, toPartyId: B.id, fromName: A.name, toName: B.name, partyId: i ? B.id : A.id, kind: i ? 'payment' : 'collection', dailyIncluded: false, amount, date: today(), note: tag, posPending: false, posVoucher: '', ...wa }));
        await b.commit();
        log(`⇄ transfer WhatsApp: ${A.name} -> ${B.name} ${rsT(d.amt)} — ${name}`);
        await say(ph, 'kw-' + w, `✅ Transfer ${rsT(d.amt)}\n${A.name} → ${B.name}\n↩ Ghalat ho to is paigham par reply mein "cancel" likhein.`, ids[0]);
      } else {
        const id = 'wk' + ow, note = ((d.note ? d.note + ' · ' : '') + tag).slice(0, 300);
        await KH.doc(id).create({ id, type: 'entry', kind: d.k === 1 ? 'collection' : 'payment', partyId: A.id, amount, date: today(), note, dailyIncluded: d.daily !== false, posPending: false, ...wa });
        log(`🔢 ${d.k === 1 ? 'payment li' : 'payment di'} WhatsApp: ${A.name} ${rsT(d.amt)} — ${name}`);
        await say(ph, 'kw-' + w, `✅ ${d.k === 1 ? 'Payment LI' : 'Payment DI'} · ${A.name} · ${rsT(d.amt)}\nDaily Sale: ${d.daily !== false ? 'HAAN' : 'NAHI'}${d.note ? '\n' + d.note : ''}\n↩ Ghalat ho to is paigham par reply mein "cancel" likhein.`, id);
      }
    } catch (e) { if (/already exists/i.test(String(e.message || e))) return true; throw e; }
    return true;
  }
  // { text, from (number), wid, ts (ms), quoted (jis paigham ka reply), quiet (true = anjaan number par chup) } → true = yeh kharcha ka hukum tha (aage koi aur na chhere)
  async function apply({ text, from, wid, ts, quoted, quiet }) {
    const ph = normPh(from), name = who(ph); if (!ph || !name || cfg.on === false) return false;
    const w = clean(wid); if (!w) return false;
    if (CANCEL_RE.test(text)) {
      const q = clean(quoted); if (!q) return false;
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
    if (PICK_RE.test(text)) return await pick(ph, name, w, text);
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
    const id = 'wk' + w, t = Date.now(), amount = Math.round(p.amt * 100), note = ((p.note ? p.note + ' · ' : '') + '📲 WhatsApp ' + name).slice(0, 300);
    try { await KH.doc(id).create({ id, type: 'entry', kind: 'payment', partyId: pid, amount, date: today(), note, dailyIncluded: true, posPending: false, wa: w, waFrom: ph, by: 'pc-wa', byName: name, updatedBy: 'pc-wa', createdAt: t, updatedAt: t, rev: 1 }); }
    catch (e) { if (/already exists/i.test(String(e.message || e))) return true; throw e; }
    log(`🔢 kharcha WhatsApp: ${p.code} ${party.name} ${rsT(p.amt)} — ${name}`);
    await say(ph, 'kw-' + w, `✅ ${p.code} ${party.name} · ${rsT(p.amt)} Akhrajat mein lag gaya${p.note ? '\n' + p.note : ''}\n↩ Ghalat ho to is paigham par reply mein "cancel" likhein.`, id);
    return true;
  }
  return { apply, looks, who: ph => who(normPh(ph)), ver: VER };
}
module.exports = make; module.exports.parse = parse; module.exports.parse2 = parse2; module.exports.looks = looks; module.exports.normPh = normPh;
