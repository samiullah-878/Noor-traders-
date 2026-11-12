// =========================================================
//  kh-wa.js  v1.0 (2026-11-12) — 🔢 KHARCHA WHATSAPP SE (wa-parchi.js + wa-out.js dono isay istemal karte hain)
//  Malik (12 Nov 2026): "har kharcha account ko number do 001 002 … · WhatsApp se connect · main ya Mubeen apni chat mein likhein
//    '001 Imran ne paisa liya -4900' to Daily Sale mein lag jaye aur kharcha account mein bhi · sirf akhrajat (wasooli nahi) ·
//    mazeed number bhi add kar sakein (Sonu, Bilal Ali) · meri / Mubeen ki chat mein ya business WhatsApp par — sab chale · hadd nahi".
//  Kaam: paigham "<3 hindse> <likhai> <raqam>" → blueKhata entry {kind payment, partyId = us number ka KHARCHA khata, dailyIncluded true}
//    (aage pos-khata-sync khud POS voucher + parchi banata hai — jaisa app ki entry par) → jawab waOut se (dukan ka Business number).
//  Hifazat: sirf ijazat wale number (blueAccess/khWa.allow + malik / Mubeen = waParchi prFrom / prTo) · sirf jo paigham 3 hindson se shuru ho
//    (baqi paigham na parhe, na log) · ek paigham = ek pakki entry id (dobara nahi lagta) · 10 min se purana nahi lagta · "cancel" reply = wapas.
//  Number: blueAccess/khNum {m: {partyId: n}} — malik ki app deti hai. AI NAHI. SQL nahi (POS ko yeh file kabhi nahi chhooti).
// =========================================================
const VER = '1.0';
const pad3 = n => String(n).padStart(3, '0');
const rsT = v => 'Rs ' + Math.round(Number(v) || 0).toLocaleString('en-PK');
function normPh(x) {
  let d = String(x || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2); else if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return d;
}
const CANCEL_RE = /^\s*(cancel|wapas|hatao|hata do)\s*[.!]*\s*$/i;
const looks = t => /^\s*\d{3}(?!\d)/.test(String(t || '')) || CANCEL_RE.test(String(t || ''));
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
      if (e.deleted) { await say(ph, 'kc-' + w, '↩ Yeh kharcha pehle hi wapas ho chuka hai.'); return true; }
      if (e.waFrom !== ph && !isMalik(ph)) { await say(ph, 'kc-' + w, '✕ Yeh kharcha ' + (e.byName || 'kisi aur') + ' ne lagaya tha — wohi ya malik wapas kar sakta hai.'); return true; }
      const t = Date.now(); await ref.set({ deleted: true, updatedAt: t, updatedBy: 'pc-wa', rev: (Number(e.rev) || 1) + 1 }, { merge: true });
      log(`↩ kharcha wapas: ${e.id} ${rsT(e.amount / 100)} (${name})`);
      await say(ph, 'kc-' + w, `↩ Wapas ho gaya: ${rsT(e.amount / 100)}${e.note ? ' — ' + String(e.note).slice(0, 80) : ''}`); return true;
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
  return { apply, looks, ver: VER };
}
module.exports = make; module.exports.parse = parse; module.exports.looks = looks; module.exports.normPh = normPh;
