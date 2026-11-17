// =========================================================
//  nabz.js v1.0 (2026-11-17, app v2.319.0) — 🚨 DUKAN KI NABZ malik ke phone ke liye
//  Malik: "dukan ka system ruke to phone bajega · deep socho · baqi notifications jaisa screen par".
//  doctor.js (sirf SERVER PC par, BLOCKED nahi) is ko chalata hai. Har 60 s jaanch, har 2 min (ya kuch badla to foran) EK doc likhta hai:
//    businesses/noor-traders/pcBeat/<chaabi>  { v, d, at, act, hz, r, rk, y, yk }
//    chaabi = blueAccess/pcBeatKey.k (app Settings → PC scripts → '🚨 Phone alarm jorein'); doc id hi chaabi hai (rules: sirf get, list nahi).
//    Andar sirf HAAL ki likhai — paisa / khata / naam-e-gahak KABHI nahi.
//  Phone (MacroDroid '🚨 Dukan nigrani', md/tools/nabz.py) har 3 min parhta hai: doc 10 min purana (updateTime) = PC / internet band;
//    r = 🔴 awaaz wala alarm (rk = pehchan), y = 🟡 khamosh (yk). Waqt 9:30 – 21:00 (Pakistan); hazri app mein chhutti = kuch nahi.
//  🔴 thermal mein parchiyan phansi · WhatsApp Business toota (10 min) · dukan ke waqt 45 min se koi bill nahi (Jumma 12:30–14:45 = 90 min)
//  🟡 thermal print ruka (malik ka ▶ baqi) · counter NT-PRINT band · camera recording band · ijazat 30 min se intezar · 11 baje tak koi bill nahi
//  Sab async + hadd; kuch na mile = us hissay ki khabar nahi (andaze se alarm nahi). Firestore: ~6 parhai / 5 min. AI nahi.
// =========================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const VER = '1.0';
const DAYMS = 864e5, PK = 5 * 3600000;
const pkDay = t => new Date(t + PK).toISOString().slice(0, 10);
const pkMin = t => { const d = new Date(t + PK); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const pkDow = t => new Date(t + PK).getUTCDay();   // 5 = Jumma
const hhmm = t => { const d = new Date(t + PK); const h = d.getUTCHours(), m = d.getUTCMinutes(); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const withIn = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('hadd')), ms))]);

module.exports = function start(ctx) {   // ctx: { fb, log, dir, blocked(), thermal() → {off, q} }
  const log = (...a) => { try { ctx.log('🚨 nabz: ' + a.join(' ')); } catch {} };
  const S = { key: '', keyAt: 0, busy: false, sig: '', wAt: 0,
    pos: { at: 0, n: 0, d: '', chk: 0, ok: false }, wa: { st: '', badSince: 0, chk: 0, ok: false },
    nt: { down: [], chk: 0 }, cam: { bad: 0, chk: 0 }, ij: { n: 0, old: 0, chk: 0 } };
  const base = () => { const d = ctx.fb(); return d ? d.collection('businesses').doc('noor-traders') : null; };
  let FP = null; try { FP = require('firebase-admin/firestore').FieldPath; } catch {}

  async function key(b) {
    if (S.key && Date.now() - S.keyAt < 10 * 60000) return S.key;
    try { const s = await withIn(b.collection('blueAccess').doc('pcBeatKey').get(), 8000); const k = String((s.exists && s.data() && s.data().k) || '');
      S.key = /^[A-Za-z0-9_-]{24,64}$/.test(k) ? k : ''; S.keyAt = Date.now(); } catch (e) { if (!S.key) S.keyAt = Date.now() - 9 * 60000; }
    return S.key;
  }
  function hazriClosed(d) { try { const h = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'hazri-day.json'), 'utf8')); return !!(h && h.d === d && h.closed); } catch { return false; } }

  async function readAll(b, now, d) {
    // POS: aaj ka posSales doc — sirf 'at' (aakhri tabdeeli) + sum.n (bill ginti), poori list nahi
    if (now - S.pos.chk > 170000 && FP) { S.pos.chk = now;
      try { const q = await withIn(b.collection('posSales').where(FP.documentId(), '==', d).select('at', 'sum.n').get(), 10000);
        const x = q.empty ? null : q.docs[0]; S.pos = { ...S.pos, d, at: x ? Number(x.get('at')) || 0 : 0, n: x ? Number(x.get('sum.n')) || 0 : 0, ok: true };
      } catch (e) { S.pos.ok = false; } }
    // WhatsApp Business (wa-out)
    if (now - S.wa.chk > 110000) { S.wa.chk = now;
      try { const s = await withIn(b.collection('blueAccess').doc('waLinkOut').get(), 8000); const st = String((s.exists && s.data() && s.data().st) || '');
        S.wa.ok = s.exists; S.wa.st = st; if (st === 'open' || !s.exists) S.wa.badSince = 0; else if (!S.wa.badSince) S.wa.badSince = now;
      } catch (e) { S.wa.ok = false; } }
    // counters ka NT-PRINT (aaj chala tha, ab 10 min se chup)
    if (now - S.nt.chk > 290000) { S.nt.chk = now;
      try { const q = await withIn(b.collection('printPCs').get(), 10000); const down = [];
        for (const doc of q.docs) { const x = doc.data() || {}, at = Number(x.at) || 0; if (!at || pkDay(at) !== d) continue;
          if (now - at > 10 * 60000) down.push({ n: String(x.name || x.host || doc.id).replace(/^DESKTOP-/i, '').slice(0, 24), m: Math.round((now - at) / 60000) }); }
        S.nt.down = down.sort((a, c) => a.n.localeCompare(c.n));
      } catch (e) {} }
    // camera recording (bill-clip) — sirf jab camera ki setting ON ho
    if (now - S.cam.chk > 290000) { S.cam.chk = now;
      try { const s = await withIn(b.collection('blueAccess').doc('billClipPc').get(), 8000); const x = (s.exists && s.data()) || {};
        const fresh = now - (Number(x.at) || 0) < 15 * 60000, rec = x.rec && typeof x.rec === 'object' ? Object.values(x.rec) : [];
        S.cam.bad = x.on && fresh && (x.net || (rec.length && rec.some(r => r && !r.on))) ? 1 : 0;
      } catch (e) {} }
    // mulazim ki ijazat jo malik ke intezar mein
    if (now - S.ij.chk > 170000) { S.ij.chk = now;
      try { const q = await withIn(b.collection('approvals').where('status', '==', 'new').select('at').get(), 10000); let old = 0;
        for (const doc of q.docs) { const at = Number(doc.get('at')) || 0; if (at && (!old || at < old)) old = at; }
        S.ij = { ...S.ij, n: q.size, old };
      } catch (e) {} }
  }

  function judge(now, d) {
    const m = pkMin(now), win = m >= 570 && m < 1260, R = [], Y = [];
    const hz = hazriClosed(d) ? 1 : 0;
    const act = S.pos.ok && S.pos.d === d && S.pos.n > 0 && now - S.pos.at < 60 * 60000 ? 1 : 0;
    if (win && !hz) {
      let th = { off: false, q: 0 }; try { th = ctx.thermal() || th; } catch {}
      if (!th.off && th.q >= 5) R.push(['thq', `🖨 Thermal printer mein ${th.q} parchiyan phansi hain — parchi nahi chhap rahi`]);
      if (S.wa.ok && S.wa.badSince && now - S.wa.badSince >= 10 * 60000) R.push(['wa', `📲 WhatsApp Business ka rabta ${Math.round((now - S.wa.badSince) / 60000)} min se toota — gahak / Mubeen ko paigham nahi ja rahe`]);
      if (S.pos.ok && S.pos.d === d && S.pos.n > 0 && m >= 600 && m < 1230) {
        const jum = pkDow(now) === 5 && m >= 750 && m < 885, lim = (jum ? 90 : 45) * 60000;
        if (now - S.pos.at > lim) R.push(['nobill', `🧾 ${Math.round((now - S.pos.at) / 60000)} min se POS mein koi bill nahi (aakhri ${hhmm(S.pos.at)}) — bijli / POS / counter dekhein`]);
      }
      if (th.off) Y.push(['thoff', '🖨 Thermal print ruka hua — app ⚙️ PC scripts → 🖨 "▶ Thermal dobara chalu"']);
      if (S.nt.down.length) Y.push(['nt:' + S.nt.down.map(x => x.n).join(','), '🖥 NT-PRINT band: ' + S.nt.down.map(x => `${x.n} (${x.m} min)`).join(', ')]);
      if (S.cam.bad) Y.push(['cam', '🎥 Camera recording band — bill ki video nahi ban rahi']);
      if (S.ij.n && S.ij.old && now - S.ij.old >= 30 * 60000) Y.push(['ij', `📲 ${S.ij.n} ijazat aap ke intezar mein (sab se purani ${Math.round((now - S.ij.old) / 60000)} min)`]);
      if (S.pos.ok && S.pos.d === d && !(S.pos.n > 0) && m >= 660 && m < 1230) Y.push(['nob11:' + d, '🧾 11 baj gaye — aaj abhi tak koi POS bill nahi (dukan / POS band?)']);
    }
    return { v: 1, d, at: now, act, hz, r: R.length ? R[0][1] : '', rk: R.length ? R[0][0] : '', y: Y.map(x => x[1]).join(' · ').slice(0, 400), yk: Y.map(x => x[0]).sort().join('|').slice(0, 200), host: os.hostname().slice(0, 30), ver: VER };
  }

  async function tick() {
    if (S.busy) return; let blocked = false; try { blocked = !!ctx.blocked(); } catch {} if (blocked) return;
    S.busy = true;
    try {
      const b = base(); if (!b) return;
      const k = await key(b); if (!k) return;
      const now = Date.now(), d = pkDay(now);
      await readAll(b, now, d);
      const o = judge(now, d), sig = JSON.stringify([o.d, o.act, o.hz, o.r, o.rk, o.y, o.yk]);
      if (sig === S.sig && now - S.wAt < 115000) return;   // kuch nahi badla = har 2 min (phone updateTime se PC ki zindagi dekhta hai)
      await withIn(b.collection('pcBeat').doc(k).set(o), 10000);
      if (sig !== S.sig) log(`haal: ${o.r || '🔴 —'} | ${o.y || '🟡 —'}`);
      S.sig = sig; S.wAt = now;
    } catch (e) { log('⚠ ' + String(e && e.message || e).slice(0, 100)); } finally { S.busy = false; }
  }
  setTimeout(() => tick().catch(() => {}), 25000);
  setInterval(() => tick().catch(() => {}), 60000);
  log(`v${VER} shuru`);
  return { tick, judge, S };
};
module.exports.VER = VER;
module.exports._t = { pkDay, pkMin, hhmm };
