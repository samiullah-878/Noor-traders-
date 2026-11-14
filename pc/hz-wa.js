'use strict';
// hz-wa.js v1.0 (14 Nov 2026) — 🚶 LARKON KI BAHAR JANE KI REQUEST WHATSAPP SE (Business number)
// Malik: "sab larkon ka code bana do (1 Abdurehman…) · larka Business number par code likhe -> reply mein bahar jane ki wajoohat -> number chune ·
//         roz ki pehli 2 request khud manzoor, hamein sirf khabar · teesri se mujhe aur Mubeen ko request, hum OK karein · kisi bhi phone se ·
//         jitni bhi request hain WhatsApp par aayein · sab larkon ke code mere aur Mubeen ke number par bhej do".
// Kaise: aaj ka hazri khulasa pc/hazri-day.json (raat-report hzPull likhta hai; rows p = phone, b = bahar, q = intezar wali request, rq = doosri requests)
//   · code blueAccess/hzCodes {m: {phone: n}, nm: {phone: naam}, next} — ek dafa laga number KABHI nahi badalta
//   · likhna = hazri app ka Cloud Function `bluein` (chaabi blueAccess/hazriKey) — PC hazri ke Firebase ko seedha kabhi nahi chhoota
//   · jawab: usi chat mein seedha (socket) · malik + Mubeen ko waOut se (to: number). Manzoori = us paigham par reply 1 (haan) / 2 (nahi) — waOut doc `hq`.
// wa-out.js sirf bulata hai (handle / own / tick). AI nahi.
const fs = require('fs'), path = require('path');
const VER = '1.0';
const URL_IN = 'https://asia-south1-nt-traders.cloudfunctions.net/bluein';
const REASONS = [['Khana', 30], ['Namaz', 20], ['Bank', 45], ['Ghar', 60], ['Dukan ka kaam', 60], ['Aur', 30]];
const FREE = 2;
const pad2 = n => String(n).padStart(2, '0');
const dayOf = t => `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
const t12 = t => `${((t.getHours() + 11) % 12) + 1}:${pad2(t.getMinutes())} ${t.getHours() < 12 ? 'am' : 'pm'}`;
const dur = m => m >= 60 ? `${Math.floor(m / 60)} gh ${m % 60} min` : `${m} min`;
const nth = n => n === 1 ? 'pehli' : n === 2 ? 'doosri' : n === 3 ? 'teesri' : n + 'vi';
const YES = /^\s*(1|ha+n|han|ok|yes|ji)\s*$/i, NO = /^\s*(2|nahi|nai|no)\s*$/i, CODE = /^\s*(\d{1,3})\s*$/, LIST = /^\s*(codes?|code\s*list|larko+n?\s*ke\s*code)\s*$/i;

function makeHz({ biz, log, put, dir, who, norm, now }) {
  const BA = biz.collection('blueAccess'), Q = biz.collection('waOut');
  const file = path.join(dir, 'hazri-day.json'), seenFile = path.join(dir, 'hz-seen.json');
  const clock = () => (now ? now() : new Date());
  let day = null, dayAt = 0, codes = null, codesAt = 0, key = '', keyAt = 0, appr = null, apprAt = 0, seen = null;
  const pend = new Map(), outNow = new Set();
  const today = () => dayOf(clock());
  const hz = () => { if (Date.now() - dayAt > 4000) { dayAt = Date.now(); try { day = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { day = null; } } return day && day.d === today() && Array.isArray(day.rows) ? day : null; };
  const rowOf = phone => { const h = hz(); return h ? h.rows.find(r => String(r.p || '') === phone) || null : null; };
  async function codesGet(force) {
    if (!force && codes && Date.now() - codesAt < 60000) return codes;
    try { const sn = await BA.doc('hzCodes').get(), d = sn.exists ? sn.data() || {} : {}; codes = { m: d.m && typeof d.m === 'object' ? d.m : {}, nm: d.nm && typeof d.nm === 'object' ? d.nm : {}, next: Number(d.next) || 1 }; codesAt = Date.now(); }
    catch (e) { log('hz codes: ' + e.message); if (!codes) codes = { m: {}, nm: {}, next: 1 }; }
    return codes;
  }
  // naye larke ko agla number (naam ki tarteeb se pehli dafa) · naam badle to sirf naam taza. true = koi naya code laga
  async function codesSync() {
    const h = hz(); if (!h) return false;
    const c = await codesGet(), fresh = h.rows.filter(r => r.p && !c.m[r.p]).sort((a, b) => String(a.n).localeCompare(String(b.n)));
    const ren = h.rows.filter(r => r.p && c.m[r.p] && c.nm[r.p] !== r.n);
    if (!fresh.length && !ren.length) return false;
    const m = {}, nm = {}; let next = c.next;
    for (const r of fresh) { m[r.p] = next++; nm[r.p] = String(r.n || r.p); }
    for (const r of ren) nm[r.p] = String(r.n || r.p);
    try { await BA.doc('hzCodes').set({ m, nm, next, at: Date.now() }, { merge: true }); Object.assign(c.m, m); Object.assign(c.nm, nm); c.next = next; } catch (e) { log('hz codes likhna: ' + e.message); return false; }
    return fresh.length > 0;
  }
  const byCode = (c, n) => { const p = Object.keys(c.m).find(k => Number(c.m[k]) === n); return p ? { phone: p, code: n, name: String(c.nm[p] || p) } : null; };
  const listText = c => { const L = Object.keys(c.m).map(p => [Number(c.m[p]), String(c.nm[p] || p)]).sort((a, b) => a[0] - b[0]); return '👥 *Larkon ke code* (bahar jana ho to Business number par sirf apna code likhein):\n\n' + L.map(x => `${x[0]}  ${x[1]}`).join('\n') + '\n\nWapas aa kar wohi code dobara likhein.'; };
  async function approvers() {
    if (appr && Date.now() - apprAt < 60000) return appr;
    let mk = '', mb = ''; try { const w = await BA.doc('waParchi').get(), d = w.exists ? w.data() || {} : {}; mk = String((Array.isArray(d.prFrom) && d.prFrom[0]) || ''); mb = String((Array.isArray(d.prTo) && d.prTo[0]) || ''); } catch {}
    mk = norm(mk || '03450412515'); mb = norm(mb);
    appr = [{ p: mk, n: 'Malik' }].concat(mb && mb !== mk ? [{ p: mb, n: 'Mubeen' }] : []); apprAt = Date.now(); return appr;
  }
  async function call(body) {
    if (!key || Date.now() - keyAt > 5 * 60000) { try { const sn = await BA.doc('hazriKey').get(); key = String((sn.exists && (sn.data() || {}).k) || ''); keyAt = Date.now(); } catch (e) { log('hz chaabi: ' + e.message); } }
    if (!key) return { ok: false, err: 'nokey' };
    try {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 12000);
      const r = await fetch(URL_IN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, k: key }), signal: ac.signal }).finally(() => clearTimeout(tm));
      let j = null; try { j = await r.json(); } catch {}
      if (j && typeof j === 'object') return j;
      return { ok: false, err: 'http ' + r.status };
    } catch (e) { return { ok: false, err: 'net ' + String(e.message || e).slice(0, 60) }; }
  }
  const errText = e => e === 'nokey' ? 'Hazri app abhi juri nahi (Blue Khata → Reports → "Hazri app jorein").' : e === 'key' ? 'Hazri app ki chaabi nahi mili — Blue Khata → Reports → "Hazri app dobara jorein".' : e === 'staff' ? 'Yeh larka hazri app mein chalu nahi.' : 'Hazri app se rabta nahi hua (' + e + '). Thori der baad dobara likhein.';
  const tell = async (id, txt, extra, skip) => { for (const a of await approvers()) if (a.p !== skip) await put(`${id}-${a.p.slice(-4)}`, { to: a.p, nm: a.n, kind: 'rem', txt, ...(extra || {}) }); };

  // wajah chuni -> hazri app ko bhejo
  async function goOut(st, ri, ctx) {
    const [reason, minutes] = REASONS[ri], r = await call({ a: 'out', phone: st.phone, reason, minutes, free: FREE, by: ctx.by });
    const tag = `${st.code} ${st.name}`, wid = String(ctx.wid || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
    if (!r.ok) {
      if (r.err === 'out') { outNow.add(st.phone); return ctx.reply(`ℹ️ ${tag} pehle se BAHAR likha hai. Wapas aa gaye ho to dobara ${st.code} likhein.`); }
      if (r.err === 'pending') return ctx.reply(`⏳ ${tag} ki pehli request ka jawab abhi nahi aaya — intezar karein.`);
      log('hz out: ' + r.err); return ctx.reply('⚠️ ' + errText(r.err));
    }
    if (r.st === 'approved') {
      outNow.add(st.phone);
      await ctx.reply(`✅ ${tag}: ijazat hai — ${reason}.\nWapas aa kar ${st.code} likhein.`);
      return tell(`hzo-${wid}`, `🚶 ${tag} bahar gaya — ${reason} · ${t12(clock())}\n(aaj ki ${nth(Number(r.n) || 1)} — khud manzoor)`, null, ctx.from);
    }
    await ctx.reply(`⏳ ${tag}: aaj ki ${FREE} muft request ho chuki hain. Malik / Mubeen se ijazat maangi hai — jawab yahin aayega.`);
    return tell(`hzq-${r.id}`, `❓ ${tag} bahar jana chahta hai — ${reason}\n(aaj ki ${nth(Number(r.n) || FREE + 1)})\n\nIS paigham par reply karein:\n1 = haan\n2 = nahi`, { hq: String(r.id), hj: String(ctx.jid || ''), hc: st.code, hn: st.name, hr: reason });
  }
  async function goBack(st, ctx) {
    const r = await call({ a: 'back', phone: st.phone, by: ctx.by }), tag = `${st.code} ${st.name}`, wid = String(ctx.wid || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
    outNow.delete(st.phone);
    if (!r.ok) { if (r.err === 'notout') return null; log('hz back: ' + r.err); await ctx.reply('⚠️ ' + errText(r.err)); return true; }
    await ctx.reply(`✅ ${tag} wapas — ${dur(Number(r.mins) || 0)} bahar raha${r.reason ? ' (' + r.reason + ')' : ''}.`);
    await tell(`hzb-${wid}`, `↩️ ${tag} wapas aa gaya — ${dur(Number(r.mins) || 0)} bahar raha${r.reason ? ' (' + r.reason + ')' : ''} · ${t12(clock())}`, null, ctx.from);
    return true;
  }
  // malik / Mubeen ka jawab (request wale paigham par reply 1 / 2). true = yeh hamara tha
  async function decide(ctx) {
    const yes = YES.test(ctx.text), no = NO.test(ctx.text); if ((!yes && !no) || !ctx.quoted) return false;
    let job = null; try { const q = await Q.where('wid', '==', String(ctx.quoted)).limit(1).get(); if (!q.empty) job = q.docs[0].data() || {}; } catch (e) { log('hz jawab: ' + e.message); }
    if (!job || !job.hq) return false;
    const ap = await approvers(), me = ctx.fromMe ? ap[0] : ap.find(a => a.p === ctx.from);
    if (!me) return false;
    const tag = `${job.hc || ''} ${job.hn || ''}`.trim(), r = await call({ a: yes ? 'ok' : 'no', id: job.hq, by: me.n }), wid = String(ctx.wid || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
    const back = txt => ctx.fromMe ? put(`hzr-${wid}`, { to: me.p, nm: me.n, kind: 'rem', txt }) : ctx.reply(txt);
    if (!r.ok) { await back(r.err === 'done' ? `ℹ️ ${tag}: is ka jawab pehle ho chuka — ${r.st === 'approved' || r.st === 'returned' ? 'IJAZAT' : r.st === 'rejected' ? 'MANA' : r.st}${r.by ? ' (' + r.by + ')' : ''}.` : r.err === 'gone' ? `✕ ${tag}: yeh request ab nahi mili.` : '⚠️ ' + errText(r.err)); return true; }
    const okd = r.st === 'approved';
    await back(okd ? `✅ ${tag} ko ijazat de di${job.hr ? ' (' + job.hr + ')' : ''}.` : `🚫 ${tag} ko mana kar diya.`);
    for (const a of ap) if (a.p !== me.p) await put(`hzd-${wid}-${a.p.slice(-4)}`, { to: a.p, nm: a.n, kind: 'rem', txt: okd ? `ℹ️ ${me.n} ne ${tag} ko bahar jane ki ijazat de di${job.hr ? ' (' + job.hr + ')' : ''}.` : `ℹ️ ${me.n} ne ${tag} ko mana kar diya.` });
    if (job.hj && ctx.sendJid) { try { await ctx.sendJid(String(job.hj), okd ? `✅ ${tag}: ${me.n} ne ijazat de di — ja sakte ho.\nWapas aa kar ${job.hc} likhein.` : `🚫 ${tag}: ${me.n} ne ijazat nahi di.`); } catch (e) { log('hz larke ko jawab: ' + e.message); } }
    if (okd) { const c = await codesGet(), st = byCode(c, Number(job.hc)); if (st) outNow.add(st.phone); }
    return true;
  }
  // aane wala paigham. ctx: { text, jid, from (number ya ''), quoted, wid, khBusy (kharcha menu chal raha), reply(txt), sendJid(jid, txt) }. true = hamara tha
  async function handle(ctx) {
    const text = String(ctx.text || ''); if (!text || text.length > 30) return false;
    ctx.by = (ctx.from && who && who(ctx.from)) || '';
    if (ctx.quoted) return decide(ctx);
    const c = await codesGet();
    if (LIST.test(text)) { const ap = await approvers(); if (!ap.some(a => a.p === ctx.from)) return false; if (!Object.keys(c.m).length) { await ctx.reply('⚠️ Abhi koi code nahi bana — hazri app juri nahi ya aaj ka data nahi aaya.'); return true; } await ctx.reply(listText(c)); return true; }
    const m = text.match(CODE); if (!m) return false;
    const n = Number(m[1]), key2 = String(ctx.jid || ctx.from), p = pend.get(key2);
    if (p && Date.now() - p.at < 10 * 60000) {
      pend.delete(key2);
      if (n === 0) { await ctx.reply('👍 Chhor diya.'); return true; }
      if (n < 1 || n > REASONS.length) { pend.set(key2, p); await ctx.reply(`✕ 1 se ${REASONS.length} tak number bhejein (0 = chhoro).`); return true; }
      if (!ctx.by) ctx.by = p.name;
      await goOut(p, n - 1, ctx); return true;
    }
    if (ctx.khBusy) return false;                       // kharcha / payment ka menu chal raha hai — us ka number us ka
    const st = byCode(c, n); if (!st) return false;     // yeh kisi larke ka code nahi — hamara paigham nahi
    if (!ctx.by) ctx.by = st.name;
    const row = rowOf(st.phone);
    if (!hz()) { await ctx.reply('⚠️ Aaj ka hazri data abhi nahi aaya — thori der baad dobara likhein.'); return true; }
    if (outNow.has(st.phone) || (row && (row.b || []).some(b => Number(b[2]) < 0))) { const r = await goBack(st, ctx); if (r) return true; }
    if (row && row.q) { await ctx.reply(`⏳ ${st.code} ${st.name} ki request ka jawab abhi nahi aaya — intezar karein.`); return true; }
    pend.set(key2, { ...st, at: Date.now() }); if (pend.size > 60) pend.delete(pend.keys().next().value);
    await ctx.reply(`🚶 *${st.code} ${st.name}* — bahar jane ki wajah?\n\n` + REASONS.map((r, i) => `${i + 1}  ${r[0]}`).join('\n') + '\n\nNumber bhejein (0 = chhoro)');
    return true;
  }
  // har 30 s: naye code -> malik + Mubeen ko list · hazri APP se aayi nayi requests ki khabar (ek dafa)
  async function tick() {
    const h = hz(); if (!h) return;
    if (await codesSync()) await tell(`hzc-${(await codesGet()).next}`, listText(await codesGet()));
    if (!seen) { try { seen = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch { seen = null; } }
    if (!seen || seen.d !== h.d) seen = { d: h.d, ids: [] };
    const c = await codesGet(); let ch = false;
    for (const r of h.rows) if (r.q && r.q[0] && !Number(r.q[2]) && !seen.ids.includes(r.q[0])) {
      seen.ids.push(r.q[0]); ch = true; const code = c.m[r.p] || '';
      await tell(`hzq-${r.q[0]}`, `❓ ${code} ${r.n} bahar jana chahta hai (hazri app se) — ${r.q[1] || ''}\n\nIS paigham par reply karein:\n1 = haan\n2 = nahi`, { hq: String(r.q[0]), hc: code, hn: r.n, hr: r.q[1] || '' });
    }
    for (const x of (Array.isArray(h.rq) ? h.rq : [])) if (x && x[0] && !seen.ids.includes(x[0])) {
      seen.ids.push(x[0]); ch = true;
      await tell(`hzn-${x[0]}`, `📝 Nayi request — ${x[1] || ''}\n${x[2] || ''}${x[3] ? '\nWajah: ' + x[3] : ''}\n\nJawab hazri app mein dein.`);
    }
    if (ch) { if (seen.ids.length > 400) seen.ids = seen.ids.slice(-300); try { fs.writeFileSync(seenFile, JSON.stringify(seen)); } catch {} }
  }
  return { handle, tick, ver: VER, _: { codesSync, listText, codesGet } };
}
module.exports = makeHz; module.exports.REASONS = REASONS; module.exports.CODE = CODE;
