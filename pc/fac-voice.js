// fac-voice.js  v1.0 (2026-11-19, app v2.327.0) — 🎬 FACTORY VIDEO KI URDU AWAAZ (wa-parchi ke andar chalta hai, wohi msedge-tts)
//   Malik: "factory ki all items ka video · upar bolne wala bhi · yeh sab tum khud handle karo".
//   App (malik) factory/vq_<k>_… doc likhti hai {k: n naam | r rate | i shuru | o aakhir, id, nm, rs, tl, vo m|f, sig, st 'new'} —
//   PC Urdu jumla bana kar Microsoft Edge ki muft awaaz (ur-PK Asad / Uzma) se mp3 → wahi doc {st 'ok', b Bytes, ur, sz, sig}.
//   Awaaz pehle se ban kar rakhi rehti hai (tasveer lagte hi app maangti hai) — raat ko PC band ho tab bhi video awaaz ke saath.
//   Rules: factory/* pehle se (malik likhe, PC admin) — naya rule nahi. AI NAHI (jumla seedha qaide se, naam urdu-names / roman2ur).
'use strict';
const VOICES = { m: 'ur-PK-AsadNeural', f: 'ur-PK-UzmaNeural' };
const titleUr = (t, UR) => { const s = String(t || '').trim(); if (!s || /adrees\s*soap\s*factory/i.test(s)) return 'ادریس سوپ فیکٹری'; try { return UR.roman2ur(s.toLowerCase().slice(0, 60)) || 'ادریس سوپ فیکٹری'; } catch { return 'ادریس سوپ فیکٹری'; } };
function nameUr(d, UR) {
  let u = ''; try { u = UR.get(d.id); } catch {}
  if (!u) { try { const t = String(d.nm || '').toLowerCase().replace(/(\d)\s*ml\b/g, '$1 mili liter').replace(/(\d)\s*(?:gm|grm|gram|g)\b/g, '$1 gram').replace(/(\d)\s*kg\b/g, '$1 kilo').replace(/(\d)\s*(?:ltr|litre|liter|l)\b/g, '$1 liter').replace(/\s+/g, ' ').trim(); u = UR.roman2ur(t.slice(0, 80)); } catch {} }   // bolne mein ml = ملی لیٹر
  return String(u || '').replace(/[\u0001\r\n]+/g, ' ').trim();
}
function sentence(d, UR) {   // -> Urdu jumla jo bola jayega (app isi ko video par bhi likhti hai)
  const k = String(d.k || '');
  if (k === 'i') return `السلام علیکم! ${titleUr(d.tl, UR)} کے آئٹمز اور ریٹ دیکھیے۔`;
  if (k === 'o') return 'آرڈر کے لیے ابھی رابطہ کریں۔ شکریہ!';
  if (k === 'r') { const n = Math.round(Number(d.rs) || 0); return n > 0 ? `صرف ${n} روپے` : ''; }
  if (k === 'n') return nameUr(d, UR);
  return '';
}
function start({ biz, tts, UR, log = () => {}, within }) {
  if (!biz || typeof tts !== 'function') return;
  const COL = biz.collection('factory'); let busy = false, busyAt = 0; const q = new Map();
  const one = async snap => {
    const d = snap.data() || {}; if (d.st !== 'new') return;
    const ur = sentence(d, UR), voice = VOICES[d.vo] || VOICES.m;
    if (!ur) { await snap.ref.set({ st: 'err', err: 'jumla khali (naam / rate nahi)', doneAt: Date.now() }, { merge: true }); return; }
    try {
      const b = await (within ? within(tts(ur, voice), 70000, 'awaaz') : tts(ur, voice));
      const now = (await snap.ref.get()).data() || {}; if (now.sig !== d.sig) return;   // beech mein malik ne naya maanga — purani na likho
      await snap.ref.set({ st: 'ok', b, ur, sz: b.length, voice, doneAt: Date.now() }, { merge: true });
      log(`🎬 awaaz bani: ${snap.id} (${Math.round(b.length / 1000)} KB)`);
    } catch (e) {
      const m = String((e && e.message) || e).slice(0, 120); log('✕ factory awaaz ' + snap.id + ': ' + m);
      await snap.ref.set({ st: 'err', err: m, doneAt: Date.now() }, { merge: true }).catch(() => {});
    }
  };
  const run = async () => {
    if (busy) { if (Date.now() - busyAt > 5 * 60000) { log('⚠️ factory awaaz 5 min se atki — dobara'); busy = false; } else return; }
    busy = true;
    try { while (q.size) { const [id, s] = q.entries().next().value; q.delete(id); busyAt = Date.now(); await one(s); } }
    catch (e) { log('✕ factory awaaz: ' + ((e && e.message) || e)); }
    finally { busy = false; }
  };
  const take = docs => { let n = 0; for (const s of docs) { const d = s.data() || {}; if (d.st === 'new' && /^vq_/.test(s.id)) { q.set(s.id, s); n++; } } if (n) run(); };
  const QRY = COL.where('st', '==', 'new');
  try { QRY.onSnapshot(sn => take(sn.docs), e => log('⚠️ factory awaaz listener: ' + e.message)); } catch (e) { log('✕ factory awaaz listener: ' + e.message); }
  setInterval(() => { QRY.limit(40).get().then(sn => take(sn.docs)).catch(() => {}); }, 60000);   // listener chup ho jaye tab bhi (CLAUDE.md: onSnapshot + poll)
  log('🎬 factory video ki awaaz tayyar (factory/vq_*)');
}
module.exports = { start, sentence, VOICES, _titleUr: titleUr };
