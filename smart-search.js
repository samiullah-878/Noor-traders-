// smart-search.js — v2.18 (pehle v1.75): items ki SMART search (sale, camera, stock, transfer sab jagah yehi)
// - Roman Urdu spelling ke farq (ee/i, oo/u, aa/a, z/j, w/v, ph/f, c/k, double letters) khud barabar
// - lafz kisi bhi tarteeb mein, har lafz ka shuru ya hissa, chhoti ghalti (1 harf) bhi chal jati hai
// - barcode ka hissa (aakhri 4-5 hindse) · doosre naam (alias) · tarteeb: naam-shuru pehle, phir zyada bikne wale
// Stock (minus/zero) ka tarteeb par KOI asar nahi (malik ki hidayat).
const HITS_KEY = 'sam-item-hits-v1';
let hits = null;
function loadHits() { if (hits) return hits; try { hits = JSON.parse(localStorage.getItem(HITS_KEY) || '{}') || {}; } catch { hits = {}; } return hits; }
export function noteHit(id) {   // item bill mein gaya — is device par ginti (30 din), ranking ke liye
  const h = loadHits(); const k = String(id); const now = Date.now();
  h[k] = { n: ((h[k]?.n) || 0) + 1, t: now };
  for (const key of Object.keys(h)) if (now - (h[key]?.t || 0) > 30 * 86400000) delete h[key];
  try { localStorage.setItem(HITS_KEY, JSON.stringify(h)); } catch {}
}
export function topItems(items, n = 10) {
  const h = loadHits();
  return items.filter(r => h[String(r.id)]).sort((a, b) => (h[String(b.id)].n - h[String(a.id)].n) || (h[String(b.id)].t - h[String(a.id)].t)).slice(0, n);
}
let aliases = {};   // itemId -> 'naam1, naam2'
export function setAliases(a) { aliases = a && typeof a === 'object' ? a : {}; idx = new WeakMap(); }
export function aliasOf(id) { return String(aliases[String(id)] || ''); }

export function fold(s) {
  s = String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
  return s.replace(/ph/g, 'f').replace(/ch/g, 'C').replace(/sh/g, 'S').replace(/kh/g, 'K').replace(/gh/g, 'G').replace(/th/g, 'T')
    .replace(/c/g, 'k').replace(/q/g, 'k').replace(/z/g, 'j').replace(/w/g, 'v').replace(/x/g, 'ks')
    .replace(/ee|ii|ea/g, 'i').replace(/oo|uu/g, 'u').replace(/aa/g, 'a').replace(/y$/g, 'i').replace(/y(?=\s|$)/g, 'i')
    .replace(/(.)\1+/g, '$1');   // double letters -> ek
}
const isCodeTok = t => /^\d{3,}$/.test(t);
function ed1(a, b) {   // edit distance <= 1?
  if (a === b) return true;
  const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
  return d + (la - i) + (lb - j) <= 1;
}
let idx = new WeakMap();
function entry(r) {
  const nameF = fold(r.name), words = nameF.split(' ').filter(Boolean);
  const aliasF = fold(aliases[String(r.id)] || ''), awords = aliasF.split(' ').filter(Boolean);
  const codes = [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
  return { nameF, words: words.concat(awords), aliasF, codes, raw: String(r.name || '').toLowerCase() };
}
function scoreItem(e, toks, qF) {   // v2.18: ab { sc, fz } — fz = sirf andaze (ghalti wali) match
  let score = 0, fuzzy = false;
  for (const t of toks) {
    let best = 0, bf = false;
    if (isCodeTok(t)) { for (const c of e.codes) { if (c === t) { best = 6; break; } if (c.endsWith(t) || c.includes(t)) best = Math.max(best, 3); } }
    if (!best) {
      for (const w of e.words) {
        if (w === t) { best = 5; bf = false; break; }
        if (w.startsWith(t)) { if (4 > best) { best = 4; bf = false; } continue; }
        if (w.includes(t)) { if (2 > best) { best = 2; bf = false; } continue; }
        if (t.length >= 4 && Math.abs(w.length - t.length) <= 1 && ed1(w, t)) { if (1.5 > best) { best = 1.5; bf = true; } }
        else if (t.length >= 5 && w.length >= t.length && ed1(w.slice(0, t.length), t)) { if (1.2 > best) { best = 1.2; bf = true; } }
      }
      if (!best && e.codes.some(c => c.includes(t))) best = 2;
    }
    if (!best) return { sc: 0, fz: false };
    if (bf) fuzzy = true;
    score += best;
  }
  if (e.nameF.startsWith(qF)) score += 10; else if (e.nameF.includes(qF)) score += 3; else if (e.aliasF && e.aliasF.startsWith(qF)) score += 8;
  return { sc: score, fz: fuzzy };
}
export function smartSearch(items, q, limit = 25, opts = null) {
  // v2.18: opts.keep(r) -> false to woh item bilkul nahi aayega | opts.bonus(r) -> extra number (upar lane ke liye)
  //        aur: agar 3 ya zyada "pakke" match mil jayein to andaze (ghalti wale) match BILKUL nahi dikhte
  //        (isi wajah se "mayo" par "mop" jaisi cheez ab nahi aati)
  const qF = fold(q); if (!qF) return [];
  const toks = qF.split(' ').filter(Boolean);
  const h = loadHits();
  const keep = opts && typeof opts.keep === 'function' ? opts.keep : null;
  const bonus = opts && typeof opts.bonus === 'function' ? opts.bonus : null;
  const pakka = [], andaza = [];
  for (const r of items) {
    if (keep && !keep(r)) continue;
    let e = idx.get(r); if (!e) { e = entry(r); idx.set(r, e); }
    const { sc, fz } = scoreItem(e, toks, qF);
    if (!(sc > 0)) continue;
    const row = { r, sc: sc + (bonus ? (Number(bonus(r)) || 0) : 0), hit: h[String(r.id)]?.n || 0 };
    (fz ? andaza : pakka).push(row);
  }
  const cmp = (a, b) => (b.sc - a.sc) || (b.hit - a.hit) || String(a.r.name || '').localeCompare(String(b.r.name || ''));
  pakka.sort(cmp); andaza.sort(cmp);
  const out = pakka.length >= 3 ? pakka : pakka.concat(andaza);
  return out.slice(0, limit).map(x => x.r);
}
// v2.18: jo harf match hue unhein <mark> mein — naam khud escape ho kar aata hai (HTML mehfooz)
const SH_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const shEsc = s => String(s ?? '').replace(/[&<>"']/g, c => SH_ESC[c]);
export function hlName(text, q) {
  const raw = String(text ?? '');
  const toks = [...new Set(String(q || '').toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter(t => t.length >= 2))];
  if (!raw) return '';
  if (!toks.length) return shEsc(raw);
  const low = raw.toLowerCase(), mark = new Array(raw.length).fill(false);
  for (const t of toks) { let from = 0, i; while ((i = low.indexOf(t, from)) !== -1) { for (let k = i; k < i + t.length; k++) mark[k] = true; from = i + t.length; } }
  let out = '', on = false;
  for (let i = 0; i < raw.length; i++) {
    if (mark[i] && !on) { out += '<mark>'; on = true; }
    else if (!mark[i] && on) { out += '</mark>'; on = false; }
    out += shEsc(raw[i]);
  }
  return out + (on ? '</mark>' : '');
}
// 🎤 awaz se (Android Chrome) — mile to cb(text)
export function voiceSearch(cb, lang = 'ur-PK') {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  const r = new SR(); r.lang = lang; r.interimResults = false; r.maxAlternatives = 3;
  r.onresult = ev => { const t = ev.results?.[0]?.[0]?.transcript; if (t) cb(String(t)); };
  r.onerror = ev => { if (ev.error === 'language-not-supported' && lang !== 'en-IN') voiceSearch(cb, 'en-IN'); };
  try { r.start(); } catch { return false; }
  return true;
}

// ================= v1.87: PARTY / ACCOUNT smart search =================
// Items wali hi samajh (fold: ee/i, q/k, z/j, w/v, double harf; lafz kisi bhi tarteeb; 1 harf ki ghalti),
// + mobile ke hindse (aakhri 3+ hindse bhi). Ranking app.js ka "istemal" (entries + is phone par chunna).
const PHITS_KEY = 'sam-party-hits-v1';
let phits = null;
function loadPHits() { if (phits) return phits; try { phits = JSON.parse(localStorage.getItem(PHITS_KEY) || '{}') || {}; } catch { phits = {}; } return phits; }
export function notePartyPick(id) {   // party chuni / kholi — is device par ginti (60 din)
  if (!id) return;
  const h = loadPHits(), k = String(id), now = Date.now();
  h[k] = { n: ((h[k]?.n) || 0) + 1, t: now };
  for (const key of Object.keys(h)) if (now - (h[key]?.t || 0) > 60 * 86400000) delete h[key];
  try { localStorage.setItem(PHITS_KEY, JSON.stringify(h)); } catch {}
}
export function partyPicks(id) { const h = loadPHits()[String(id)]; return h ? h.n : 0; }
let pidx = new WeakMap();
function pentry(p) {
  const nameF = fold(p.name || p.label || p.account || '');
  const digits = String(p.phone || '').replace(/\D/g, '');
  return { nameF, words: nameF.split(' ').filter(Boolean), aliasF: '', codes: digits ? [digits, digits.replace(/^92/, '0')] : [], raw: String(p.name || p.label || '').toLowerCase() };
}
export function partyScore(p, q) {
  const qF = fold(q); if (!qF || !p) return 0;
  let e = pidx.get(p); if (!e) { e = pentry(p); pidx.set(p, e); }
  return scoreItem(e, qF.split(' ').filter(Boolean), qF).sc;   // v2.18: scoreItem ab object deta hai
}
