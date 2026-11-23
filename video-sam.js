// video-sam.js v1.6 (app v2.368.0, 23 Nov 2026) — 🎓 VIDEO SAMJHAO
// v1.6 (malik 23 Nov: 'naya link paste karein to time bhi khud us hisaab se aaye · purana save hi rahe apps mein'): link likhte / paste karte hi
//   waqt khud (`urlAuto`): link mein ?t= ho to wohi, pehle samjhi video = khud khul jaye + khana khali (= jahan tak bani wahan se aage), nayi = 0:00.
//   Pehle 🎬 dabane par waqt alag ho to purani bani guftagu MIT jati thi (S.v.parts = []) — ab kabhi nahi: naya hissa purane mein JURTA hai (`mergeIn`).
//   Phone ki jagah bhar jaye to sab se purani video hatti hai, chup-chaap poori save fail nahi (`store`). KEEP 25. ⋮ mein 📚 Purani videos.
// v1.5 (malik 23 Nov: 'sab bana do' — 9 kaam): ▶ wahin se shuru (sam-vs-pos / sam-vs-last) · 😴 so jaun to band (15 / 30 / 60) · ⭐ pasand ki line (line par tap,
//   sam-vs-star) · 📖 lafzon ki copy (sam-vs-words, search) · 📄 PDF (A.pdf — kholo + bhejo) · YouTube → Share → Blue Khata (A.share, manifest share_target) ·
//   📌 Khulasa (video khatam hote hi khud + 🔊) · ✅ Mere kaam ki baatein (☐) · ❓ Sawal poochho (jawab usi video se). 🤖 AI sirf khulasa / kaam / sawal mein (likhai se, video dobara nahi).
//   Sab yaad sirf is phone par. Naye kaam ⋮ ke andar (saamne nayi qatar nahi).
// v1.4 (malik: 'Gemini ki awaz ki hadd poori' — poori video ke har chhote hisse ki awaz pehle se ban rahi thi · 'ek hi dafa poora page ban jaye'): awaz 15 min ke page ki EK
//   (groupsOf), sirf chalta + agla page, hadd par 65 s ruk kar dobara (band nahi), ek waqt ek darkhwast.
// v1.3 (malik: 'yeh bhi video 15 minute ki hi hai, is se aage ki nahi'): AI 15 min ke tukre ke khatam hone ko 'video khatam' keh deta tha -> ab 'end' sirf tab
//   maana jata hai jab tukra khali ho YA aakhri line tukre ke khatam se 90 s pehle ruke; purani ruki video par chip '▶ Video aage bhi hai'.
//   🔊 Gemini awaz (malik: 'pehle sahi thi, ab ek hi hai'): do bolne wale pehchane jane ke baad do-awaz wali darkhwast 400 deti thi ('speech_metadata.speaker for each
//   text part') -> ab har line alag part + speechMetadata.speaker (Gemini 3.x), na chale to purani shakal, phir bhi na chale to har bolne wale ki baat ek-awaz wale
//   raaste se bana kar PCM jor dete hain. ⋮ → 🔊 Awaz chuno (sawal wala / jawab wala, 2 larki + 2 larka, dabao = chun li + namoona) — 'sam-vs-voice'.
// v1.2 (malik 23 Nov, screenshot: har line 'Raj:' + English jumle + ek hi awaz · 'baar baar agla click na karna pare — auto banta rahe' · 'jis line par hon wo peeli'):
//   bolne wala ab NAAM se (sp mein se) -> A / B · English / Hindi jumle ka TARJUMA Roman Urdu (English zyada / Urdu harf = ek dafa dobara maango) ·
//   poori video khud load (MAXAUTO 40, ghalti par 3 dafa khud dobara) · chalti line peeli (.is-on — audio ke waqt se andaza, phone awaz mein pakki) ·
//   awaz 2 line mein banti hai, 70 s hadd · audio ki yaad ki key mein likhai ka hash (purani English audio dobara na chale).
// Malik: "YouTube ki videos mein bohat se alfaz Hindi mein hain, samajh nahi aati · har 2-3 minute explain · audio mein aa jaye".
// v1.1 (malik 23 Nov: "pehla 15 minute ka part aaye, main sunna start kar dun, baqi parts background mein load hote rahein · podcast jaisa — Raj aurat ki
//   awaz, doctor mard ki · background mein nahi chalti, is ka hal · Gemini ki awaz hi chalegi · aur wo doosri app reader wali"):
//   ① guftagu ki shakal (d = [[A|B, Roman, Urdu harf]] — A mezban = zanana awaz, B mehman = mardana), har 1-2 minute ka hissa, un ke andaz mein MUKHTASAR
//      (lafz-ba-lafz transcript nahi), Hindi lafz ki jagah Urdu. ② agle 15-15 minute khud load (MAXAUTO tukre, ⏹ se roko).
//   ③ awaz = Gemini TTS (do bani banai awazein — kisi asal insaan ki awaz ki naqal NAHI) -> WAV -> <audio> + Media Session = screen band / doosri app mein
//      bhi chalti hai; audio is phone ki IndexedDB 'nt-vs' mein (dobara paisa na lage). Gemini awaz na bane = phone ki apni awaz (sirf screen khuli ho to).
//   ④ 📤 Reader = Urdu likhai kisi parhne wali app ko (navigator.share).
// Link Gemini ko SEEDHA (file_data.file_uri) — video download / upload KAHIN nahi. Sirf public video. Firestore / PC / rules: kuch nahi. AI: HAAN (Gemini).
const API = 'https://generativelanguage.googleapis.com/v1beta';
const LS = 'sam-vs-list', STEP = 900, KEEP = 25, MAXAUTO = 40;
const FALLBACK = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash'];
const TTS_FALL = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
// v1.3: awaz malik chunta hai (⋮ → 🔊 Awaz) — Gemini ki bani banai awazein, kisi asal insaan ki naqal nahi. Yaad 'sam-vs-voice' (is phone par).
const VOICES = [['Kore', '👩 Larki 1'], ['Aoede', '👩 Larki 2'], ['Charon', '👨 Larka 1'], ['Puck', '👨 Larka 2']], VDEF = { A: 'Kore', B: 'Charon' };
const voGet = () => { let o = {}; try { o = JSON.parse(localStorage.getItem('sam-vs-voice') || '{}') || {}; } catch {} const ok = x => VOICES.some(v => v[0] === x); return { A: ok(o.A) ? o.A : VDEF.A, B: ok(o.B) ? o.B : VDEF.B }; };
const voKey = () => { const v = voGet(); return v.A === VDEF.A && v.B === VDEF.B ? '' : '|' + v.A + v.B; };
const SPK = { A: 'Mezban', B: 'Mehman' };
let A = null, S = null, AU = null;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vidOf = u => { const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
// '53:44' -> 3224 · '1:02:03' -> 3723 · '53' -> 53 minute · khali -> 0
const secOf = t => {
  const s = String(t || '').trim().replace(/[^0-9:]/g, ''); if (!s) return 0;
  const a = s.split(':').filter(x => x !== '').map(Number); if (a.some(x => !Number.isFinite(x))) return 0;
  if (a.length === 1) return a[0] * 60;
  if (a.length === 2) return a[0] * 60 + a[1];
  return a[0] * 3600 + a[1] * 60 + a[2];
};
const tOf = u => { const m = String(u || '').match(/[?&#](?:t|start|time_continue)=([0-9hms]+)/i); if (!m) return null; const x = m[1].toLowerCase(); if (/^\d+s?$/.test(x)) return parseInt(x, 10); const h = /(\d+)h/.exec(x), mi = /(\d+)m/.exec(x), se = /(\d+)s/.exec(x); const t = (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0) + (se ? +se[1] : 0); return t || null; };
const fmt = s => { s = Math.max(0, Math.round(Number(s) || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x; };
const tsOf = v => { if (typeof v === 'number') return v; const s = String(v ?? ''); return s.includes(':') ? secOf(s) : (Number(s.replace(/[^0-9.]/g, '')) || 0); };
const linesOf = p => (p.d && p.d.length ? p.d : (p.r ? [['A', p.r, p.u || '']] : []));
const NONLAT = /[\u0600-\u06FF\u0750-\u077F\u0900-\u097F]/;
const ENW = new Set('you that this of and are it they have has what when because from with your for was not but there which their would can will about just like our them'.split(' '));
// AI ka jawab kharab? '' = theek · warna wajah (ek dafa dobara maangte hain)
function badOut(parts, sp) {
  const L = parts.flatMap(p => p.d); if (L.length < 4) return '';
  const words = L.map(l => l[1]).join(' ').toLowerCase().split(/[^a-z']+/).filter(Boolean);
  if (words.length > 20 && words.filter(w => ENW.has(w)).length / words.length > 0.14) return 'en';
  if (L.some(l => NONLAT.test(l[1]))) return 'script';
  if (sp.length > 1 && L.length >= 8 && (L.every(l => l[0] === 'A') || L.every(l => l[0] === 'B'))) return 'one';
  return '';
}
function parseOut(text, a, b) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i >= 0 && j > i) t = t.slice(i, j + 1);
  const o = JSON.parse(t), L = Array.isArray(o.p) ? o.p : [];
  const sp = Array.isArray(o.sp) ? o.sp.slice(0, 2).map(x => String(x || '').trim().slice(0, 24)).filter(Boolean) : [];
  const nk = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const who = k => { const n = nk(k); if (n === 'a' || n === 'b') return n.toUpperCase(); const a0 = nk(sp[0]), b0 = nk(sp[1]); if (b0 && (n === b0 || n.includes(b0) || b0.includes(n) && n.length > 2)) return 'B'; if (a0 && (n === a0 || n.includes(a0) || a0.includes(n) && n.length > 2)) return 'A'; return /mehman|guest|doctor|dr/.test(n) ? 'B' : 'A'; };
  const parts = L.map(x => {
    let d = (Array.isArray(x.d) ? x.d : []).filter(y => Array.isArray(y) && String(y[1] || '').trim()).map(y => [who(y[0]), String(y[1]).trim(), String(y[2] || '').trim()]);
    if (!d.length && String(x.r || '').trim()) d = [['A', String(x.r).trim(), String(x.u || '').trim()]];
    return { s: Math.min(Math.max(tsOf(x.s), a), b), e: Math.min(Math.max(tsOf(x.e), a), b), d, w: (Array.isArray(x.w) ? x.w : []).filter(y => Array.isArray(y) && y[0] && y[1] && !NONLAT.test(String(y[0]) + String(y[1]))).slice(0, 4).map(y => [String(y[0]), String(y[1])]) };
  }).filter(x => x.d.length);
  return { title: String(o.title || '').trim().slice(0, 120), sp, end: Number(o.end) ? 1 : 0, parts, bad: badOut(parts, sp) };
}
// Gemini ki awaz: PCM (audio/L16;rate=24000) -> WAV; wav / mp3 / ogg ho to waisi hi
function wavBytes(pcm, rate) {
  const n = pcm.length, b = new Uint8Array(44 + n), v = new DataView(b.buffer), W = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  W(0, 'RIFF'); v.setUint32(4, 36 + n, true); W(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); W(36, 'data'); v.setUint32(40, n, true); b.set(pcm, 44);
  return b;
}
function audioBlob(b64, mime) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const m = String(mime || '').toLowerCase();
  if (/wav|mpeg|mp3|ogg|opus/.test(m)) return new Blob([u], { type: m.split(';')[0] });
  const rate = Number((/rate=(\d+)/.exec(m) || [])[1]) || 24000;
  return new Blob([wavBytes(u, rate)], { type: 'audio/wav' });
}
const ttsText = p => linesOf(p).map(l => SPK[l[0]] + ': ' + (l[2] || l[1])).join('\n');
export const _t = { tOf: (...a) => tOf(...a), mergeIn: (...a) => mergeIn(...a), posIdx: (...a) => posIdx(...a), sumOf: (...a) => sumOf(...a), actOf: (...a) => actOf(...a), romOnly: (...a) => romOnly(...a), pdfHTML: (...a) => pdfHTML(...a), txOf: (...a) => txOf(...a), groupsOf: (...a) => groupsOf(...a), wOf: (...a) => wOf(...a), bOf: (...a) => bOf(...a), vidOf, secOf, fmt, parseOut, wavBytes, ttsText, linesOf, badOut, lineAt, pcmOf: (...a) => pcmOf(...a), ttsBody: (...a) => ttsBody(...a), voGet };

const load = () => { try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
function store(v) {
  try {
    const o = load(); o[v.id] = { id: v.id, t: v.t || '', sp: v.sp || [], parts: v.parts, next: v.next, end: v.end ? 1 : 0, sum: v.sum || null, act: v.act || null, qa: v.qa || null, at: Date.now() };
    try { localStorage.setItem('sam-vs-last', v.id); } catch {}
    const ids = Object.keys(o).sort((x, y) => (o[y].at || 0) - (o[x].at || 0));
    for (const k of ids.slice(KEEP)) { delete o[k]; idbDropVid(k); }
    for (let left = ids.slice(0, KEEP).filter(k => k !== v.id); ;) {
      try { localStorage.setItem(LS, JSON.stringify(o)); break; }
      catch (er) { const k = left.pop(); if (!k) { if (!store.warned) { store.warned = 1; A.notice?.('⚠ Phone ki jagah bhar gayi — yeh video save nahi hui'); } break; } delete o[k]; idbDropVid(k); }
    }
  } catch {}
}
const drop = id => { try { const o = load(); delete o[id]; localStorage.setItem(LS, JSON.stringify(o)); } catch {} idbDropVid(id); posDrop(id); };
const savedV = o => ({ id: o.id, t: o.t, sp: o.sp || [], parts: o.parts || [], next: o.next || 0, end: o.end, sum: o.sum || null, act: o.act || null, qa: o.qa || null });

// ---------- v1.5: chhoti yaad (sirf is phone par) ----------
const jget = (k, d) => { try { const o = JSON.parse(localStorage.getItem(k) || 'null'); return o && typeof o === 'object' ? o : d; } catch { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
// ▶ wahin se: {id: [hisse ka shuru second, line, kab]}
const posGet = id => jget('sam-vs-pos', {})[id] || null;
function posSet(id, sec, k) { const o = jget('sam-vs-pos', {}); o[id] = [Math.round(sec), k, Date.now()]; const ids = Object.keys(o); if (ids.length > 30) for (const x of ids.sort((a, b) => (o[a][2] || 0) - (o[b][2] || 0)).slice(0, ids.length - 30)) delete o[x]; jset('sam-vs-pos', o); }
function posDrop(id) { const o = jget('sam-vs-pos', {}); if (o[id]) { delete o[id]; jset('sam-vs-pos', o); } }
const posIdx = v => { const q = v && posGet(v.id); if (!q) return 0; const i = v.parts.findIndex(x => Math.round(x.s) === q[0]); return i > 0 ? i : 0; };
// ⭐ pasand ki lines: [{k, id, t, s, n, r, at}] (300 tak)
const starAll = () => { const a = jget('sam-vs-star', []); return Array.isArray(a) ? a : []; };
const starKey = (id, sec, r) => id + ':' + Math.round(sec) + ':' + hsh(String(r));
function starToggle(v, p, l) {
  const k = starKey(v.id, p.s, l[1]); let a = starAll(); const had = a.some(x => x.k === k);
  if (had) a = a.filter(x => x.k !== k); else { a.push({ k, id: v.id, t: String(v.t || '').slice(0, 80), s: Math.round(p.s), n: nameOf(v, l[0]), r: l[1], at: Date.now() }); if (a.length > 300) a = a.slice(a.length - 300); }
  jset('sam-vs-star', a); return !had;
}
// 📖 lafz: {chhote harf: [lafz, matlab, kab]} (1500 tak) — video hatane par bhi rehte hain
function wordsAdd(parts) {
  const o = jget('sam-vs-words', {}); let ch = false;
  for (const q of parts || []) for (const w of q.w || []) { const k = String(w[0] || '').toLowerCase().trim(); if (!k || !w[1] || o[k]) continue; o[k] = [String(w[0]).trim(), String(w[1]).trim(), Date.now()]; ch = true; }
  if (!ch) return; const ks = Object.keys(o); if (ks.length > 1500) for (const x of ks.sort((a, b) => (o[a][2] || 0) - (o[b][2] || 0)).slice(0, ks.length - 1500)) delete o[x];
  jset('sam-vs-words', o);
}
const wordsN = () => Object.keys(jget('sam-vs-words', {})).length;

// ---------- audio ki yaad (IndexedDB 'nt-vs') ----------
let DBP = null;
const idb = () => DBP || (DBP = new Promise(res => { try { const r = indexedDB.open('nt-vs', 1); r.onupgradeneeded = () => r.result.createObjectStore('a'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } }));
const hsh = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return h.toString(36); };
const aKey = (id, p) => id + ':' + Math.round(p.s) + ':' + hsh(ttsText(p) + voKey());
const idbGet = async k => { const db = await idb(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('a').objectStore('a').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch { res(null); } }); };
const idbPut = async (k, v) => { const db = await idb(); if (!db) return; try { db.transaction('a', 'readwrite').objectStore('a').put(v, k); } catch {} };
async function idbDropVid(id) { const db = await idb(); if (!db) return; try { const st = db.transaction('a', 'readwrite').objectStore('a'), q = st.openKeyCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; if (String(c.key).startsWith(id + ':')) st.delete(c.key); c.continue(); }; } catch {} }

const STRICT = { en: 'PICHHLA JAWAB GHALAT THA: lines English mein thin. Har line ka TARJUMA Roman Urdu mein karein — English jumla waise ka waisa KABHI nahi.', script: 'PICHHLA JAWAB GHALAT THA: Roman line mein Urdu / Hindi harf the. Roman line sirf Latin (a-z) harfon mein.', one: 'PICHHLA JAWAB GHALAT THA: har line ek hi bolne wale ke naam thi. Awaz se pehchanein — sawal poochhne wala aur jawab dene wala alag log hain, har line par sahi naam.' };
const PROMPT = (a, b, why) => [
  'Aap ek sabar wale ustaad aur mutarjim hain. Sunne wala Pakistani hai: Urdu samajhta hai, English aur Hindi / Sanskrit ke mushkil lafz NAHI samajhta, aur sirf Roman (Latin) harf parh sakta hai.',
  `Is YouTube video ka SIRF ${fmt(a)} se ${fmt(b)} tak ka hissa (second ${a} se ${b}) sunein. Video English, Hindi ya mili-juli zaban mein ho sakti hai.`,
  'Is hisse ko 1 se 2 minute ke tukron mein baantein, tarteeb se, aur har tukre ki guftagu Roman Urdu mein likhein.',
  'Sirf yeh JSON dein (koi aur likhai nahi):',
  '{"title": "video ka naam", "sp": ["Raj", "Dr Amen"], "end": 0, "p": [{"s": 3224, "e": 3320, "d": [["Raj", "Bachon ka dimagh kis ghalti se kharab hota hai?", "بچوں کا دماغ کس غلطی سے خراب ہوتا ہے؟"], ["Dr Amen", "Sab se bari ghalti ghalat khana hai.", "سب سے بڑی غلطی غلط کھانا ہے۔"]], "w": [["frontal lobe", "dimagh ka agla hissa"]]}]}',
  '- sp = do asal bolne walon ke chhote naam Roman mein: pehla = mezban (sawal poochhne wala), doosra = mehman (jawab / tafseel dene wala). Ek hi banda bole to sirf ek naam.',
  '- s, e = tukre ke shuru aur khatam ke SECOND (video ke shuru se, hindse).',
  '- d = us tukre ki guftagu tarteeb se, 3 se 6 lines: har line = [bolne wale ka naam (sp mein se), Roman Urdu, wohi line Urdu harfon (Arabic script) mein]. Har line 1 se 3 jumle.',
  '- AWAZ se pehchanein kaun bol raha hai. Jawab / tafseel dene wale ki line par mehman ka naam likhein, sawal wali line par mezban ka. Sab lines ek hi naam se tabhi jab waqai sirf wohi bola ho.',
  '- Har line ka TARJUMA aasaan Roman Urdu mein: English ya Hindi jumla waise ka waisa KABHI nahi. Sirf rozmarra ke English lafz (brain, doctor, phone, sugar) reh sakte hain. Hindi / Sanskrit lafz ki jagah aam Urdu lafz (samasya = masla, karan = wajah, prashn = sawal).',
  '- Har bolne wale ki baat usi ke andaz mein, MUKHTASAR — lafz-ba-lafz transcript NAHI. Jo video mein nahi kaha gaya wo apni taraf se MAT jorein.',
  '- Roman line aur w mein Devanagari ya Urdu harf KABHI nahi (sirf a-z). Urdu harf sirf teesre khane mein.',
  '- w = us tukre ke zyada se zyada 3 mushkil lafz (English / Hindi) aur un ka aasaan matlab, dono Roman mein. Na hon to [].',
  '- Ishtihar / sponsor ka hissa ek line mein.',
  `- "end": 1 SIRF tab jab POORI video (us ki asal lambai) ${fmt(b)} se pehle khatam ho jaye. Aap ko sirf yeh hissa diya gaya hai — hisse ka khatam hona video ka khatam hona NAHI; video aage chalti ho to "end": 0. Agar ${fmt(a)} par video pehle hi khatam ho chuki ho to "p": [] aur "end": 1.`,
  ...(why && STRICT[why] ? [STRICT[why]] : [])
].join('\n');

async function post(model, body, key, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(API + '/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j, msg: String(j?.error?.message || ('HTTP ' + r.status)) };
  } catch (e) { return { ok: false, status: e?.name === 'AbortError' ? -1 : 0, j: {}, msg: e?.name === 'AbortError' ? 'waqt khatam' : String(e?.message || e) }; }
  finally { clearTimeout(tm); }
}
async function ask(id, a, b) {
  const cfg = await A.aiCfg(); if (!cfg || !cfg.key) throw Object.assign(Error('AI key nahi lagi — Settings → AI key.'), { stop: 1 });
  const models = [cfg.model, ...FALLBACK].filter((m, i, L) => m && L.indexOf(m) === i);
  const body = lv => ({
    contents: [{ role: 'user', parts: [{ file_data: { file_uri: 'https://www.youtube.com/watch?v=' + id }, ...(lv < 2 ? { video_metadata: { start_offset: a + 's', end_offset: b + 's' } } : {}) }, { text: PROMPT(a, b, why) }] }],
    generationConfig: { temperature: 0.2, ...(lv < 3 ? { responseMimeType: 'application/json' } : {}), ...(lv < 1 ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {}) }
  });
  let last = null, why = '', again = 0;
  for (let mi = 0; mi < models.length; mi++) {
    for (let lv = 0; lv < 4; lv++) {
      const r = await post(models[mi], body(lv), cfg.key, 240000);
      if (!r.ok) {
        last = Error(r.msg);
        if (r.status === -1) throw Error('AI ne 4 minute mein jawab nahi diya — internet dekhein, phir dobara.');
        if (r.status === 429) throw Object.assign(Error('Google ki hadd poori ho gayi — kuch der baad dobara koshish karein.'), { stop: 1 });
        if (r.status === 403 && /permission|private|not\s*(?:public|available)/i.test(r.msg)) throw Object.assign(Error('Yeh video AI nahi dekh sakta (private / pabandi wali). Sirf public video chalti hai.'), { stop: 1 });
        if (r.status === 404 || /not found|no longer available|not supported for/i.test(r.msg)) break;
        if (r.status === 400) continue;
        if (r.status >= 500 || r.status === 0) break;
        throw last;
      }
      const text = (r.j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!text) { last = Error('AI ne khali jawab diya' + (r.j.promptFeedback?.blockReason ? ' (' + r.j.promptFeedback.blockReason + ')' : '')); continue; }
      let out = null; try { out = parseOut(text, a, b); } catch { last = Error('AI ka jawab parha nahi gaya — dobara koshish karein.'); }
      if (out && out.bad && again < 1) { again++; why = out.bad; lv--; continue; }
      if (out) return out;
    }
  }
  throw last || Error('AI se jawab nahi mila');
}

// ---------- 🔊 Gemini ki awaz ----------
async function ttsModels(key) {
  try { const c = JSON.parse(localStorage.getItem('sam-vs-tts') || 'null'); if (c && Date.now() - c.at < 864e5 && c.m?.length) return c.m; } catch {}
  let m = [];
  try {
    const r = await fetch(API + '/models?pageSize=1000', { headers: { 'x-goog-api-key': key } }), j = await r.json();
    m = (j.models || []).filter(x => /tts/i.test(x.name) && (x.supportedGenerationMethods || []).includes('generateContent')).map(x => String(x.name).replace(/^models\//, ''));
    const ver = n => Number((/gemini-(\d+(?:\.\d+)?)/.exec(n) || [])[1]) || 0;
    m.sort((x, y) => (/flash/.test(y) - /flash/.test(x)) || (ver(y) - ver(x)));
  } catch {}
  m = [...m, ...TTS_FALL].filter((x, i, L) => L.indexOf(x) === i);
  try { localStorage.setItem('sam-vs-tts', JSON.stringify({ at: Date.now(), m })); } catch {}
  return m;
}
// v1.3: Gemini ke jawab ki audio -> kachi PCM (jorne ke liye). wav = header kaat kar; mp3 / ogg jor nahi sakte = null.
function pcmOf(b64, mime) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const m = String(mime || '').toLowerCase(), riff = u.length > 44 && u[0] === 82 && u[1] === 73 && u[2] === 70 && u[3] === 70;
  if (riff) {
    const v = new DataView(u.buffer); let o = 12, rate = 24000;
    while (o + 8 <= u.length) {
      const id = String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]), n = v.getUint32(o + 4, true);
      if (id === 'fmt ') rate = v.getUint32(o + 12, true) || rate;
      if (id === 'data') return { pcm: u.subarray(o + 8, Math.min(u.length, o + 8 + n)), rate };
      o += 8 + n + (n & 1);
    }
    return null;
  }
  if (/mpeg|mp3|ogg|opus/.test(m)) return null;
  return { pcm: u, rate: Number((/rate=(\d+)/.exec(m) || [])[1]) || 24000 };
}
const ttsData = r => { const part = (r.j.candidates?.[0]?.content?.parts || []).find(x => x.inlineData?.data || x.inline_data?.data); return part?.inlineData || part?.inline_data || null; };
const ttsFmtGet = () => { try { return JSON.parse(localStorage.getItem('sam-vs-ttsf') || '{}') || {}; } catch { return {}; } };
const ttsFmtSet = (m, f) => { try { const o = ttsFmtGet(); o[m] = f; localStorage.setItem('sam-vs-ttsf', JSON.stringify(o)); } catch {} };
// do awazon wali darkhwast ki 3 shaklein: 'n' = har line alag part + speechMetadata (Gemini 3.x ka naya tareeqa) · 'm' = wohi bina style · 'o' = purana (ek likhai, 'Naam: line')
function ttsBody(L, f, vo) {
  const vc = k => ({ prebuiltVoiceConfig: { voiceName: vo[k] } });
  const cfg = { responseModalities: ['AUDIO'], speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [{ speaker: SPK.A, voiceConfig: vc('A') }, { speaker: SPK.B, voiceConfig: vc('B') }] } } };
  if (f === 'o') return { contents: [{ parts: [{ text: 'TTS the following podcast conversation between ' + SPK.A + ' and ' + SPK.B + ' in Urdu (Pakistan), natural calm pace. Do not read the speaker names aloud.\n' + L.map(l => SPK[l[0]] + ': ' + (l[2] || l[1])).join('\n') }] }], generationConfig: cfg };
  return { contents: [{ role: 'user', parts: L.map(l => ({ text: l[2] || l[1], speechMetadata: { speaker: SPK[l[0]], ...(f === 'n' ? { style: 'natural, calm, Urdu (Pakistan)' } : {}) } })) }], generationConfig: cfg };
}
const ttsOneBody = (text, voice) => ({ contents: [{ parts: [{ text: 'Say in Urdu (Pakistan), natural calm pace:\n' + text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } });
async function ttsOne(text, voice, models, key) {
  let last = null;
  for (const m of models.slice(0, 2)) {
    const r = await post(m, ttsOneBody(text, voice), key, 240000);
    if (r.ok) { const d = ttsData(r); if (d?.data) return d; last = Error('awaz khali aayi'); continue; }
    last = Error(r.msg);
    if (r.status === 429) throw Object.assign(Error('Google ki awaz ki hadd poori ho gayi'), { q: 1 });
    if (r.status === 401 || r.status === 403) throw Object.assign(last, { off: 1 });
  }
  throw Object.assign(last || Error('awaz nahi bani'), { all: 1 });
}
async function tts(p) {
  const cfg = await A.aiCfg(); if (!cfg?.key) throw Object.assign(Error('AI key nahi'), { off: 1 });
  const L = linesOf(p), vo = voGet(), both = L.some(l => l[0] === 'B') && L.some(l => l[0] === 'A');
  const models = S.ttsM || (S.ttsM = await ttsModels(cfg.key));
  if (!both) { const d = await ttsOne(L.map(l => l[2] || l[1]).join('\n'), vo[L[0]?.[0] === 'B' ? 'B' : 'A'], models, cfg.key); return audioBlob(d.data, d.mimeType || d.mime_type); }
  let last = null;
  if (!S.ttsNoMulti) {
    const known = ttsFmtGet();
    for (const m of models.slice(0, 2)) {
      const order = [known[m], 'n', 'm', 'o'].filter((x, i, a) => x && a.indexOf(x) === i);
      for (const f of order) {
        const r = await post(m, ttsBody(L, f, vo), cfg.key, 240000);
        if (r.ok) { const d = ttsData(r); if (d?.data) { ttsFmtSet(m, f); if (S && S.ttsM[0] !== m) S.ttsM = [m, ...S.ttsM.filter(x => x !== m)]; return audioBlob(d.data, d.mimeType || d.mime_type); } last = Error('awaz khali aayi'); continue; }
        last = Error(r.msg);
        if (r.status === 429) throw Object.assign(Error('Google ki awaz ki hadd poori ho gayi'), { q: 1 });
        if (r.status === 401 || r.status === 403) throw Object.assign(last, { off: 1 });
        if (r.status !== 400) break;
      }
    }
    if (S) S.ttsNoMulti = String(last?.message || 'do awazon wali darkhwast nahi chali');
  }
  // aakhri raasta: har bolne wale ki baat ALAG (ek-awaz wala raasta, jo chalta hai) -> PCM jor kar ek WAV
  const runs = []; for (const l of L) { const t = l[2] || l[1], z = runs[runs.length - 1]; if (z && z.k === l[0]) z.t += '\n' + t; else runs.push({ k: l[0], t }); }
  const bits = []; let rate = 0;
  for (const z of runs) {
    const d = await ttsOne(z.t, vo[z.k], models, cfg.key), x = pcmOf(d.data, d.mimeType || d.mime_type);
    if (!x) throw Object.assign(Error('awaz ke tukre jor nahi sake'), { all: 1 });
    if (rate && x.rate !== rate) throw Object.assign(Error('awaz ke tukron ki raftar alag'), { all: 1 });
    rate = x.rate; bits.push(x.pcm, new Uint8Array(Math.round(rate * 0.35) * 2));
  }
  const n = bits.reduce((a, b) => a + b.length, 0), all = new Uint8Array(n); let o = 0; for (const b of bits) { all.set(b, o); o += b.length; }
  return new Blob([wavBytes(all, rate || 24000)], { type: 'audio/wav' });
}
// 🔊 namoona: chuni awaz ka chhota jumla (yaad mein, ek dafa)
const SAMP = {};
async function sample(voice) {
  try {
    if (!SAMP[voice]) { const cfg = await A.aiCfg(); if (!cfg?.key) return; const models = S.ttsM || (S.ttsM = await ttsModels(cfg.key)); const d = await ttsOne('السلام علیکم۔ میں اس آواز میں آپ کو ویڈیو سمجھاؤں گی۔'.replace('گی', /Larka/.test((VOICES.find(v => v[0] === voice) || [])[1] || '') ? 'گا' : 'گی'), voice, models, cfg.key); SAMP[voice] = URL.createObjectURL(audioBlob(d.data, d.mimeType || d.mime_type)); }
    if (!S || S.cur >= 0) return;
    const a = S.smp || (S.smp = new Audio()); S.smpSum = 0; a.onended = null; a.src = SAMP[voice]; await a.play();
  } catch (e) { A.notice?.('🔊 Namoona nahi bana (' + String(e?.message || e).slice(0, 80) + ')'); }
}
const audOf = i => (S && S.aud[i]) || null;
function badge(i) {
  const el = $('vsDlg')?.querySelector(`[data-vs-part="${i}"]`); if (!el || !S) return;
  const a = audOf(i), on = S.cur === i, b = el.querySelector('[data-vs-say]'), tg = el.querySelector('.vs-ab');
  el.classList.toggle('is-in', on);
  if (b) b.textContent = on ? (S.wait === i ? '⏳' : (S.paused ? '▶' : '⏸')) : '▶';
  if (tg) tg.textContent = !a ? '' : a.st === 'ok' ? '🔊' : a.st === 'w' ? '⏳' : '📱';
  if (tg) tg.title = !a ? '' : a.st === 'ok' ? 'Gemini ki awaz tayyar' : a.st === 'w' ? 'awaz ban rahi hai' : 'phone ki awaz';
}
// v1.4 (malik 23 Nov: 'ek hi dafa, hisson ki bajaye poora page ban jaye'): awaz ab har chhote hisse ki alag NAHI — AI ke ek jawab (15 min ka page) ki EK awaz
//   (1 ghante ki video = ~50 ki jagah ~5 darkhwastein — Google ki hadd dheere kharch). Har hissa usi awaz ka ek tukda (f0–f1, likhai ki lambai se andaza).
//   Sirf chalte page + agle 1 page ki awaz banti hai. Bohat lamba page / Google na de = khud aadha (S.cap). Hadd (429) = 65 s ruk kar dobara, 3 dafa = phone ki awaz.
const CAP = 3600, AHEAD = 1;
const bOf = p => (p.b != null ? p.b : Math.floor((Number(p.s) || 0) / STEP) * STEP);
const wOf = p => linesOf(p).reduce((n, l) => n + String(l[2] || l[1]).length + 12, 0);
function groupsOf(v, capOf) {
  const G = []; let cur = null, b0 = null, n = 0;
  v.parts.forEach((q, i) => { const b = bOf(q), w = wOf(q), cap = (capOf && capOf[b]) || CAP;
    if (!cur || b !== b0 || (n + w > cap && cur.length)) { cur = []; G.push(cur); b0 = b; n = 0; }
    cur.push(i); n += w; });
  return G;
}
const gKey = (v, g) => v.id + ':g' + Math.round(v.parts[g[0]].s) + ':' + g.length + ':' + hsh(g.map(i => ttsText(v.parts[i])).join('\n') + voKey());
function ttsStop(msg) { if (!S) return; S.ttsOff = msg; A.notice?.('🔊 Gemini ki awaz nahi bani (' + msg.slice(0, 90) + ') — phone ki awaz chalegi (sirf screen khuli ho to).'); }
function pump() { if (!S || !S.v) return; while ((S.pumps || 0) < 1) { S.pumps = (S.pumps || 0) + 1; pumpOne().finally(() => { if (S) S.pumps = Math.max(0, (S.pumps || 1) - 1); }); } }
async function pumpOne() {
  for (;;) {
    if (!S || !S.v) return;
    const v = S.v, G = groupsOf(v, S.cap), from = Math.max(0, S.wait >= 0 ? S.wait : S.cur), g0 = Math.max(0, G.findIndex(x => x.includes(from)));
    let g = null;
    for (let k = g0; k < G.length && k <= g0 + AHEAD; k++) if (G[k].some(i => !S.aud[i])) { g = G[k]; break; }
    if (!g) return;
    for (const i of g) { S.aud[i] = { st: 'w' }; badge(i); }
    const key = gKey(v, g); let blob = await idbGet(key), hold = false;
    if (!blob && S && !S.ttsOff) {
      if ((S.ttsHold || 0) > Date.now()) hold = true;
      else {
        try { blob = await tts({ d: g.flatMap(i => linesOf(v.parts[i])) }); idbPut(key, blob); if (S) { S.ttsFail = 0; S.tts429 = 0; } }
        catch (e) {
          if (!S || S.v !== v) return;
          if (e?.q) {
            S.tts429 = (S.tts429 || 0) + 1;
            if (S.tts429 >= 3) ttsStop('Google ki awaz ki aaj ki hadd poori ho gayi');
            else { hold = true; S.ttsHold = Date.now() + 65000; A.notice?.('🔊 Google ki awaz ki hadd — 1 minute baad khud dobara (tab tak phone ki awaz)'); clearTimeout(S.holdT);
              S.holdT = setTimeout(() => { if (!S || S.v !== v) return; for (const k of Object.keys(S.aud)) if (S.aud[k]?.h && Number(k) !== S.cur) delete S.aud[k]; pump(); }, 66000); }
          } else if (e?.off) ttsStop(String(e?.message || e));
          else {
            S.ttsFail = (S.ttsFail || 0) + 1;
            if (S.ttsFail >= 4) ttsStop(String(e?.message || e));
            else if (g.length > 1) { const b = bOf(v.parts[g[0]]), c = (S.cap && S.cap[b]) || CAP; S.cap = S.cap || {}; S.cap[b] = Math.max(400, Math.round(Math.min(c, g.reduce((n, i) => n + wOf(v.parts[i]), 0)) / 2)); for (const i of g) delete S.aud[i]; continue; }
          }
        }
      }
    }
    if (!S || S.v !== v) return;
    if (blob) { const url = URL.createObjectURL(blob), W = g.map(i => wOf(v.parts[i])), tot = W.reduce((x, y) => x + y, 0) || 1; let acc = 0;
      g.forEach((i, k) => { const f0 = acc / tot; acc += W[k]; S.aud[i] = { st: 'ok', url, f0, f1: k === g.length - 1 ? 1 : acc / tot }; badge(i); }); }
    else for (const i of g) { S.aud[i] = { st: 'x', h: hold ? 1 : 0 }; badge(i); }
    if (S.wait >= 0 && g.includes(S.wait)) { const w = S.wait; S.wait = -1; playPart(w); }
  }
}

// ---------- chalana ----------
const TTSP = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;
const RATES = [[0.85, 'Aahista'], [1, 'Aam'], [1.25, 'Tez']];
const urVoice = () => { const t = TTSP(); if (!t) return null; const L = t.getVoices() || []; return L.find(v => /^ur/i.test(v.lang)) || null; };
// audio ke waqt se andaza: kaun si line chal rahi hai (har line ka hissa = us ki likhai ki lambai + thora waqfa)
function lineAt(L, frac) {
  const w = L.map(l => String(l[2] || l[1]).length + 12), tot = w.reduce((x, y) => x + y, 0) || 1; let acc = 0;
  for (let k = 0; k < w.length; k++) { acc += w[k]; if (frac < acc / tot) return k; }
  return Math.max(0, w.length - 1);
}
function markLine(i, k) {
  if (!S) return; const key = i < 0 ? '' : i + ':' + k; if (S.ln === key) return; S.ln = key;
  const d = $('vsDlg'); if (!d) return;
  d.querySelectorAll('.vs-l.is-on').forEach(el => el.classList.remove('is-on'));
  if (!key) return;
  try { const q = S.v?.parts[i]; if (q && S.cur === i) posSet(S.v.id, q.s, k); } catch {}
  const el = d.querySelector(`[data-vs-ln="${key}"]`); if (el) { el.classList.add('is-on'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function phoneTalk(i) {
  const t = TTSP(), p = S.v.parts[i]; if (!t || !p) { next(); return; }
  try { t.cancel(); } catch {}
  const tok = S.tok = (S.tok || 0) + 1, L = linesOf(p), vc = urVoice(); let k = 0;
  const step = () => {
    if (!S || S.tok !== tok) return;
    if (sleepDue()) return;
    if (k >= L.length) { next(); return; }
    markLine(i, k); const l = L[k++], u = new SpeechSynthesisUtterance(l[2] || l[1]); u.lang = l[2] ? 'ur-PK' : 'en-IN'; if (vc && l[2]) u.voice = vc;
    u.rate = RATES[S.rate][0]; u.pitch = l[0] === 'B' ? 0.75 : 1.2;
    u.onend = step; u.onerror = ev => { if (ev?.error === 'interrupted' || ev?.error === 'canceled') return; step(); };
    t.speak(u);
  };
  step();
}
function quiet() { if (!S) return; S.tok = (S.tok || 0) + 1; try { TTSP()?.cancel(); } catch {} try { AU?.pause(); } catch {} try { S.smp?.pause(); } catch {} }
function stopPlay() { if (!S) return; quiet(); markLine(-1, 0); const c = S.cur; S.cur = -1; S.wait = -1; S.paused = false; S.all = false; if (c >= 0) badge(c); paintBar(); try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'; } catch {} }
function meta(i) {
  try {
    if (!('mediaSession' in navigator) || !S?.v) return; const p = S.v.parts[i];
    navigator.mediaSession.metadata = new MediaMetadata({ title: fmt(p.s) + ' – ' + fmt(p.e) + ' · ' + (S.v.t || 'Video'), artist: 'Video samjhao · Blue Khata' });
    navigator.mediaSession.playbackState = 'playing';
  } catch {}
}
function playPart(i) {
  if (!S || !S.v) return; const p = S.v.parts[i]; if (!p) { stopPlay(); return; }
  quiet(); const old = S.cur; S.cur = i; S.paused = false; S.wait = -1; if (old >= 0 && old !== i) badge(old);
  const a = audOf(i);
  if (a?.st === 'ok') { markLine(i, 0); const f0 = a.f0 || 0;
    if (S.srcUrl !== a.url) { S.seek = f0 > 0 ? f0 : null; AU.src = a.url; S.srcUrl = a.url; }
    else { S.seek = f0; try { AU.currentTime = AU.duration > 0 ? f0 * AU.duration : 0; } catch { S.seek = null; } }
    AU.playbackRate = RATES[S.rate][0]; AU.play().catch(() => { S.paused = true; badge(i); paintBar(); }); meta(i); pump(); }
  else if (a?.st === 'x') phoneTalk(i);
  else { S.wait = i; pump(); }
  badge(i); paintBar();
  if (!S.ln) $('vsDlg')?.querySelector(`[data-vs-part="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function next() {
  if (!S || !S.v || S.cur < 0) return;
  if (!S.all) { stopPlay(); return; }
  const i = S.cur + 1;
  if (i < S.v.parts.length) { playPart(i); return; }
  if (S.busy || S.retry) { const c = S.cur; S.cur = -1; markLine(-1, 0); badge(c); S.waitNew = true; paintBar(); return; }
  posDrop(S.v.id); stopPlay();
}
function toggle() {
  if (!S || S.cur < 0) return; const a = audOf(S.cur);
  if (a?.st === 'ok') { if (AU.paused) { AU.play().catch(() => {}); S.paused = false; } else { AU.pause(); S.paused = true; } }
  else if (a?.st === 'x') { const t = TTSP(); if (S.paused) { t?.resume(); S.paused = false; } else { t?.pause(); S.paused = true; } }
  badge(S.cur); paintBar();
  try { if (navigator.mediaSession) navigator.mediaSession.playbackState = S.paused ? 'paused' : 'playing'; } catch {}
}
function audioSetup() {
  AU = new Audio(); AU.preload = 'auto';
  AU.addEventListener('ended', () => { if (S && S.cur >= 0) { const u = audOf(S.cur)?.url; while (u && audOf(S.cur + 1)?.url === u) { const o = S.cur; S.cur = o + 1; badge(o); } } next(); });
  AU.addEventListener('loadedmetadata', () => { if (!S) return; if (S.seek != null && S.seek > 0 && AU.duration > 0) { try { AU.currentTime = S.seek * AU.duration; } catch { S.seek = null; } } else S.seek = null; });
  AU.addEventListener('seeked', () => { if (S) S.seek = null; });
  AU.addEventListener('timeupdate', () => { if (sleepDue()) return; if (!S || !S.v || S.cur < 0 || !(AU.duration > 0) || S.seek != null) return; const a = audOf(S.cur); if (a?.st !== 'ok') return;
    const fr = AU.currentTime / AU.duration, f0 = a.f0 || 0, f1 = a.f1 == null ? 1 : a.f1;
    if (fr >= f1 && f1 < 1 && audOf(S.cur + 1)?.url === a.url) { if (!S.all) { stopPlay(); return; } const o = S.cur; S.cur = o + 1; badge(o); badge(S.cur); meta(S.cur); markLine(S.cur, 0); pump(); return; }
    markLine(S.cur, lineAt(linesOf(S.v.parts[S.cur]), Math.min(0.999, Math.max(0, (fr - f0) / Math.max(1e-6, f1 - f0))))); });
  AU.addEventListener('error', () => { if (!S || S.cur < 0 || !AU.src) return; const i = S.cur, u = audOf(i)?.url; for (const k of Object.keys(S.aud)) if (u && S.aud[k]?.url === u) { S.aud[k] = { st: 'x' }; badge(Number(k)); } S.aud[i] = { st: 'x' }; S.srcUrl = ''; S.seek = null; badge(i); phoneTalk(i); });
  try {
    const ms = navigator.mediaSession; if (!ms) return;
    ms.setActionHandler('play', () => { if (S?.paused) toggle(); });
    ms.setActionHandler('pause', () => { if (S && !S.paused) toggle(); });
    ms.setActionHandler('nexttrack', () => { if (S?.v && S.cur + 1 < S.v.parts.length) { S.all = true; playPart(S.cur + 1); } });
    ms.setActionHandler('previoustrack', () => { if (S?.v && S.cur > 0) { S.all = true; playPart(S.cur - 1); } });
  } catch {}
}
function freeAud() { if (!S) return; for (const k of Object.keys(S.aud)) { const u = S.aud[k]?.url; if (u) try { URL.revokeObjectURL(u); } catch {} } S.aud = {}; S.srcUrl = ''; S.seek = null; }

// ---------- UI ----------
const CSS = `
dialog.vs-dlg{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;border:0;padding:0;background:#f4f7fc;color:#1b2b4b;overflow:hidden}
dialog.vs-dlg[open]{display:flex;flex-direction:column}
@media (min-width:900px){dialog.vs-dlg{inset:3% 24%;border-radius:20px;box-shadow:0 24px 60px rgba(10,20,50,.35)}}
dialog.vs-dlg::backdrop{background:rgba(8,16,40,.5)}
.vs-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:linear-gradient(135deg,#243f77,#1d3160);color:#fff;flex:none}
.vs-hd b{font-size:17px}.vs-hd small{display:block;font-size:12.5px;opacity:.85;font-weight:600}
html body dialog.vs-dlg button{font-family:inherit}
html body dialog.vs-dlg .vs-x{width:36px;min-height:36px!important;padding:0!important;border-radius:999px!important;border:1px solid #ffffff55!important;background:#ffffff1f!important;color:#fff!important;font-size:16px}
.vs-scroll{flex:1 1 auto;overflow-y:auto;padding:10px;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;align-content:start}
.vs-form{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;background:#fff;border:1px solid #dfe6f2;border-radius:14px;padding:9px}
.vs-row{display:flex;gap:6px;min-width:0}
html body dialog.vs-dlg .vs-in{flex:1;min-width:0;min-height:40px!important;border-radius:999px!important;border:1.5px solid #c9d4e8!important;padding:4px 14px!important;font-size:16px!important;background:#fff!important;color:#1b2b4b!important}
html body dialog.vs-dlg .vs-in.t{flex:0 0 108px;text-align:center;font-weight:800}
html body dialog.vs-dlg .vs-chip{flex:none;min-height:38px!important;padding:4px 13px!important;border-radius:999px!important;border:1px solid #c9d4e8!important;background:linear-gradient(180deg,#fff,#eef3fb)!important;color:#1d3160!important;font-size:14px!important;font-weight:800;white-space:nowrap}
html body dialog.vs-dlg .vs-go{flex:1;min-height:40px!important;border-radius:999px!important;border:1px solid #2b4a8a!important;background:linear-gradient(135deg,#2f55a0,#1d3160)!important;color:#fff!important;font-size:15px!important;font-weight:800;white-space:nowrap}
html body dialog.vs-dlg button:disabled{opacity:.55}
.vs-note{font-size:13px;color:#5b6885;line-height:1.4}
.vs-hb{display:flex;gap:6px;flex:none}
.vs-menu{border:1px solid #c9d4e8;border-radius:16px;background:linear-gradient(180deg,#fff,#f3f6fc);padding:10px 12px;margin-bottom:10px;display:grid;gap:8px}
.vs-mt{font-weight:800;font-size:15px;color:#1d3160}.vs-mt small{font-weight:600;color:#5b6885;font-size:12.5px;margin-left:6px}
.vs-mr{display:grid;gap:5px}.vs-mr b{font-size:14px;color:#243f77}.vs-mv{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
html body dialog.vs-dlg .vs-menu .vs-chip{min-height:34px!important;padding:3px 11px!important;font-size:13.5px!important}
html body dialog.vs-dlg .vs-menu .vs-chip.is-in{background:linear-gradient(135deg,#2a4a8c,#1d3160)!important;color:#fff!important;border-color:#1d3160!important}
.vs-st{border-radius:12px;padding:8px 11px;font-size:14px;font-weight:700;background:#eef4ff;border:1.5px solid #c9d8f5}
.vs-st.bad{background:#fff3f1;border-color:#f1c2bb;color:#8f231b}
.vs-ttl{font-size:15.5px;font-weight:800;line-height:1.3}
.vs-p{background:#fff;border:1.5px solid #dfe6f2;border-radius:14px;padding:9px 11px;display:grid;gap:6px}
.vs-p.is-in{border-color:#2f55a0;box-shadow:0 0 0 3px #2f55a022;background:#f6f9ff}
.vs-ph{display:flex;align-items:center;gap:8px}
.vs-tm{font-size:13.5px;font-weight:800;color:#1d3160;background:#e8eefb;border-radius:999px;padding:3px 10px;text-decoration:none;white-space:nowrap}
.vs-ab{margin-left:auto;font-size:14px}
html body dialog.vs-dlg .vs-say{width:40px;min-height:36px!important;padding:0!important;border-radius:999px!important;border:1px solid #2b4a8a!important;background:linear-gradient(135deg,#2f55a0,#1d3160)!important;color:#fff!important;font-size:15px}
.vs-l{font-size:16.5px;line-height:1.5;padding-left:9px;border-left:3px solid #c2477f}
.vs-l.b{border-left-color:#2f55a0}
.vs-l b{font-size:14px;color:#c2477f;margin-right:5px}.vs-l.b b{color:#2f55a0}
.vs-l{border-radius:0 8px 8px 0;transition:background .2s}
.vs-l.is-on{background:#ffe98a;box-shadow:0 0 0 3px #ffe98a}
.vs-w{display:flex;flex-wrap:wrap;gap:5px}
.vs-w span{font-size:13.5px;background:#fff8e6;border:1px solid #f0d49a;border-radius:999px;padding:2px 9px}
.vs-w span b{font-weight:800}
.vs-old{display:grid;gap:6px}
.vs-oc{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #dfe6f2;border-radius:12px;padding:8px 10px;min-width:0}
.vs-oc>div{flex:1;min-width:0;cursor:pointer}.vs-oc b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vs-oc small{font-size:12.5px;color:#5b6885}
.vs-bar{flex:none;display:flex;gap:6px;padding:8px 10px;background:#fff;border-top:1px solid #dfe6f2;overflow-x:auto}
.vs-bar .vs-go{flex:1 0 auto}
.vs-l{cursor:pointer}.vs-l.st::after{content:' ⭐';font-size:13px}
.vs-card{background:#fff;border:1.5px solid #dfe6f2;border-radius:14px;padding:9px 11px;display:grid;grid-template-columns:minmax(0,1fr);gap:7px}
.vs-ch{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15.5px;color:#1d3160}.vs-ch small{font-weight:600;color:#5b6885;font-size:12.5px}.vs-ch .vs-chip{margin-left:auto}
.vs-ol{margin:0;padding-left:22px;display:grid;gap:5px;font-size:16px;line-height:1.45}
.vs-ck{display:flex;gap:9px;align-items:flex-start;font-size:16px;line-height:1.4}.vs-ck input{width:22px;height:22px;flex:none;margin-top:2px}.vs-ck input:checked+span{text-decoration:line-through;color:#7a869f}
.vs-q{font-size:15.5px;line-height:1.45;border-left:3px solid #f0d49a;padding-left:9px}.vs-q b{display:block;color:#243f77}
.vs-wl{display:grid;gap:5px}.vs-wl>div{display:flex;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid #dfe6f2;border-radius:10px;padding:6px 10px;font-size:15px}.vs-wl b{color:#8a5a00}
.vs-mv.w{flex-wrap:wrap;overflow:visible}
.vs-sm{flex:1;min-width:0;font-size:12.5px;color:#5b6885;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
const dlg = () => $('vsDlg');
const nameOf = (v, k) => (v.sp && v.sp[k === 'B' ? 1 : 0]) || (k === 'B' ? 'Mehman' : 'Mezban');
function oldHTML() {
  const o = load(), ids = Object.keys(o).sort((x, y) => (o[y].at || 0) - (o[x].at || 0));
  if (!ids.length) return '';
  return `<div class="vs-note"><b>Pehle samjhi hui videos</b> (sirf is phone par)</div><div class="vs-old">${ids.map(k => `<div class="vs-oc"><div data-vs-old="${esc(k)}"><b>${esc(o[k].t || 'Video ' + k)}</b><small>${(o[k].parts || []).length} hisse · ${fmt(o[k].next || 0)} tak${o[k].end ? ' · poori' : ''}</small></div><button type="button" class="vs-chip" data-vs-del="${esc(k)}" aria-label="Hatao">🗑</button></div>`).join('')}</div>`;
}
function partsHTML(v) {
  const SK = new Set(starAll().map(x => x.k));
  return v.parts.map((p, i) => `<div class="vs-p" data-vs-part="${i}"><div class="vs-ph"><a class="vs-tm" href="https://youtu.be/${esc(v.id)}?t=${Math.round(p.s)}" target="_blank" rel="noopener">${fmt(p.s)} – ${fmt(p.e)}</a><span class="vs-ab"></span><button type="button" class="vs-say" data-vs-say="${i}" aria-label="Sunao">▶</button></div>${linesOf(p).map((l, k) => `<div class="vs-l ${l[0] === 'B' ? 'b' : 'a'}${SK.has(starKey(v.id, p.s, l[1])) ? ' st' : ''}" data-vs-ln="${i}:${k}"><b>${esc(nameOf(v, l[0]))}:</b>${esc(l[1])}</div>`).join('')}${(p.w || []).length ? `<div class="vs-w">${p.w.map(w => `<span><b>${esc(w[0])}</b> = ${esc(w[1])}</span>`).join('')}</div>` : ''}</div>`).join('');
}
function paint() {
  const d = dlg(); if (!d || !S) return;
  const v = S.v, y = d.querySelector('.vs-scroll')?.scrollTop || 0;
  const qi = $('vsQ'), qf = !!qi && document.activeElement === qi; if (qi) S.q = qi.value;
  const form = `<div class="vs-form"><div class="vs-row"><input class="vs-in" id="vsUrl" type="url" inputmode="url" placeholder="YouTube ka link" value="${esc(S.url || '')}"><button type="button" class="vs-chip" data-vs="paste">📋 Paste</button></div>
    <div class="vs-row"><input class="vs-in t" id="vsFrom" type="text" inputmode="numeric" placeholder="${v && !v.end && v.parts.length ? fmt(v.next) : '0:00'}" value="${esc(S.from || '')}"><button type="button" class="vs-go" id="vsGo" data-vs="go"${S.busy ? ' disabled' : ''}>${v && v.parts.length && !v.end && !String(S.from || '').trim() ? '🎬 Aage samjhao' : '🎬 Samjhao'}</button></div>
    ${v ? '' : '<div class="vs-note">"Kahan se" = waqt, jaise <b>53:44</b>. Khali = shuru se. Pehle 15 minute aate hi sunna shuru karein — poori video ke agle hisse peeche khud aate rehte hain, chalti line peeli hoti hai. 🤖 AI (Gemini: likhai + awaz) — kabhi ghalat bhi samajh sakta hai.</div>'}</div>`;
  const st = S.busy ? `<div class="vs-st" id="vsSt">⏳ ${esc(S.msg || 'AI video sun raha hai…')}${v && v.parts.length ? '' : '<div class="vs-note">1-3 minute lag sakte hain.</div>'}</div>` : (S.err ? `<div class="vs-st bad">✕ ${esc(S.err)}</div>` : '');
  const body = v ? `<div class="vs-ttl">${esc(v.t || 'Video')}</div>${partsHTML(v)}${!v.parts.length && !S.busy ? '<div class="vs-note">Is hisse mein kuch nahi mila.</div>' : ''}${st}${v.end ? '<div class="vs-note">✅ Video yahan khatam.</div>' + (!S.busy && v.parts.length ? '<div class="vs-row"><button type="button" class="vs-chip" data-vs="force">▶ Video aage bhi hai — aage samjhao</button></div>' : '') : ''}${extraHTML(v)}${!S.busy ? '<div class="vs-row"><button type="button" class="vs-chip" data-vs="list">‹ Doosri video</button></div>' : ''}` : st + oldHTML();
  d.innerHTML = `<div class="vs-hd"><div><b>🎓 Video samjhao</b><small>YouTube ki video — aasaan Roman Urdu mein + 🔊 awaz</small></div><span class="vs-hb"><button type="button" class="vs-x" data-vs="menu" aria-label="Mazeed">⋮</button><button type="button" class="vs-x" data-vs="x" aria-label="Band">✕</button></span></div>
    <div class="vs-scroll">${S.menu ? menuHTML() : ''}${S.view ? viewHTML() : form + body}</div><div class="vs-bar" id="vsBar"></div>`;
  const sc = d.querySelector('.vs-scroll'); if (sc) sc.scrollTop = y;
  if (qf) { const q2 = $('vsQ'); if (q2) { try { q2.focus({ preventScroll: true }); q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
  if (v) v.parts.forEach((_, i) => badge(i));
  if (S.ln) { const k = S.ln; S.ln = ''; const [a, b] = k.split(':').map(Number); const el = d.querySelector(`[data-vs-ln="${k}"]`); if (el) { el.classList.add('is-on'); S.ln = k; } }
  paintBar();
}
function menuHTML() {
  const vo = voGet(), sp = S.v?.sp || [], row = (k, nm) => `<div class="vs-mr"><b>${esc(nm)}</b><div class="vs-mv">${VOICES.map(v => `<button type="button" class="vs-chip${vo[k] === v[0] ? ' is-in' : ''}" data-vs-vo="${k}:${v[0]}">${S.smpW === k + v[0] ? '⏳ ' : (vo[k] === v[0] ? '✓ ' : '')}${v[1]}</button>`).join('')}</div></div>`;
  const v = S.v, has = !!(v && v.parts.length), left = S.sleepAt ? Math.max(1, Math.ceil((S.sleepAt - Date.now()) / 60000)) : 0, tb = (k, t, dis) => `<button type="button" class="vs-chip" data-vs="${k}"${dis ? ' disabled' : ''}>${t}</button>`;
  const tools = `<div class="vs-menu"><div class="vs-mt">🧰 Kaam</div><div class="vs-mv w">${tb('list', '📚 Purani videos (' + Object.keys(load()).length + ')') + tb('star', '⭐ Pasand ki lines (' + starAll().length + ')')}${tb('words', '📖 Lafz (' + wordsN() + ')')}${has ? tb('sum', S.sumBusy ? '⏳ Khulasa…' : '📌 Khulasa', S.sumBusy) + tb('act', S.actBusy ? '⏳ Kaam ki baatein…' : '✅ Mere kaam ki baatein', S.actBusy) + tb('qgo', '❓ Sawal poochho') + tb('pdf', '📄 PDF') : ''}</div>
    <div class="vs-mr"><b>😴 So jaun to awaz band${left ? ' — ' + left + ' min baqi' : ''}</b><div class="vs-mv">${[15, 30, 60].map(m => `<button type="button" class="vs-chip" data-vs-sl="${m}">${m} min</button>`).join('')}<button type="button" class="vs-chip${left ? '' : ' is-in'}" data-vs-sl="0">Band</button></div></div>
    <div class="vs-note">🤖 AI sirf Khulasa, Kaam ki baatein aur Sawal mein. Pasand, lafz aur "kahan chhora" sirf is phone par rehte hain.</div></div>`;
  return tools + `<div class="vs-menu"><div class="vs-mt">🔊 Awaz chuno <small>dabao = chun li + namoona</small></div>${row('A', sp[0] || 'Sawal wala')}${row('B', sp[1] || 'Jawab wala')}<div class="vs-note">Gemini ki bani banai awazein (kisi asal insaan ki nahi). Awaz badalne par is video ki awaz dobara banti hai.${S.ttsOff ? '<br>⚠️ Gemini ki awaz abhi nahi ban rahi: ' + esc(S.ttsOff.slice(0, 110)) : ''}</div></div>`;
}
function paintBar() {
  const b = $('vsBar'); if (!b || !S) return; const v = S.v;
  if (!v || !v.parts.length) { b.style.display = 'none'; return; }
  b.style.display = '';
  const on = S.cur >= 0 || S.waitNew;
  b.innerHTML = `<button type="button" class="vs-go" data-vs="all">${on ? (S.paused ? '▶ Chalao' : (S.wait >= 0 || S.waitNew ? '⏳ Awaz ban rahi' : '⏸ Roko')) : (posIdx(v) > 0 ? '▶ Wahin se (' + fmt(v.parts[posIdx(v)].s) + ')' : '▶ Sab sunao')}</button><button type="button" class="vs-chip" data-vs="rate">🐢 ${RATES[S.rate][1]}</button>${S.busy ? '<button type="button" class="vs-chip" data-vs="halt">⏹ Load roko</button>' : (v.end ? '' : '<button type="button" class="vs-chip" data-vs="more">➡ Aage 15 min</button>')}<button type="button" class="vs-chip" data-vs="share">📤 Reader</button>`;
}
function append(first) {
  const d = dlg(); if (!d || !S?.v) return;
  if (!d.querySelector('[data-vs-part]')) { paint(); return; }
  const w = document.createElement('div'); w.innerHTML = partsHTML(S.v);
  const all = [...w.children].slice(first), last = [...d.querySelectorAll('[data-vs-part]')].pop();
  let at = last; for (const el of all) { at.after(el); at = el; }
  for (let i = first; i < S.v.parts.length; i++) badge(i);
}
async function run(id, a, n = 0, tryN = 0) {
  if (!S || S.busy) return;
  clearTimeout(S.retry); S.retry = 0;
  if (!S.v || S.v.id !== id) { stopPlay(); freeAud(); const o = load()[id]; S.v = o ? Object.assign(savedV(o), { next: a, end: 0 }) : { id, t: '', sp: [], parts: [], next: a, end: 0 }; }
  const v = S.v, b = a + STEP; S.busy = true; S.halt = false; S.err = ''; S.msg = 'AI video sun raha hai… (' + fmt(a) + ' – ' + fmt(b) + ')'; paint();
  try {
    const out = await ask(id, a, b);
    if (!S || S.v !== v) return;
    if (out.title && !v.t) v.t = out.title;
    if (out.sp.length && !(v.sp && v.sp.length)) v.sp = out.sp;
    const tail = !v.parts.length || v.parts[v.parts.length - 1].s < a;
    const lastE = out.parts.length ? Math.max(a, ...out.parts.map(p => p.e)) : a, fin = !out.parts.length || (out.end && lastE < b - 90) ? 1 : 0;
    for (const q of out.parts) q.b = a;
    const first = mergeIn(v, out.parts, a, b); wordsAdd(out.parts); v.end = fin; v.next = fin && out.parts.length ? lastE : b;
    if (!tail) { stopPlay(); freeAud(); }
    store(v); S.busy = false;
    const more = !v.end && !S.halt && n + 1 < MAXAUTO;
    if (first === 0 || !more || !tail) paint(); else { append(first); }
    pump();
    if (S.waitNew && out.parts.length) { S.waitNew = false; S.all = true; playPart(first); }
    else if (S.waitNew && !more) { S.waitNew = false; paintBar(); }
    if (S.queue) { const q = S.queue; S.queue = null; S.halt = false; goVid(q.id, q.a); return; }
    if (more) run(id, v.next, n + 1); else { paint(); if (v.end && !v.sum && v.parts.length >= 3) sumMake(v, true); }
  } catch (e) {
    if (!S || S.v !== v) return;
    S.busy = false;
    if (!e?.stop && !S.halt && tryN < 3 && v.parts.length) { S.err = 'Agla hissa nahi aaya (' + String(e?.message || e).slice(0, 80) + ') — khud dobara koshish ' + (tryN + 1) + '/3…'; paint(); pump(); S.retry = setTimeout(() => { if (S && S.v === v) { S.retry = 0; run(id, a, n, tryN + 1); } }, 5000); return; }
    S.waitNew = false; S.err = String(e?.message || e); paint(); pump();
    if (S.queue) { const q = S.queue; S.queue = null; S.halt = false; S.err = ''; goVid(q.id, q.a); }
  }
}
// ---------- v1.5: khulasa / kaam ki baatein / sawal (🤖 likhai se — video dobara nahi bheji jati) ----------
async function askText(prompt, json) {
  const cfg = await A.aiCfg(); if (!cfg || !cfg.key) throw Error('AI key nahi lagi — Settings → AI key.');
  const models = [cfg.model, ...FALLBACK].filter((m, i, L) => m && L.indexOf(m) === i); let last = null;
  for (const m of models) {
    const r = await post(m, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: 'application/json' } : {}) } }, cfg.key, 120000);
    if (r.ok) { const t = (r.j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('').trim(); if (t) return t; last = Error('AI ne khali jawab diya'); continue; }
    last = Error(r.status === -1 ? 'AI ne waqt par jawab nahi diya' : r.status === 429 ? 'Google ki hadd poori — kuch der baad dobara' : r.msg);
    if (r.status === 429 || r.status === -1 || r.status === 401 || r.status === 403) break;
  }
  throw last || Error('AI se jawab nahi mila');
}
const jparse = t => { t = String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim(); const i = t.indexOf('{'), j = t.lastIndexOf('}'); return JSON.parse(i >= 0 && j > i ? t.slice(i, j + 1) : t); };
const txOf = v => v.parts.map(p => '[' + fmt(p.s) + '] ' + linesOf(p).map(l => nameOf(v, l[0]) + ': ' + l[1]).join(' ')).join('\n').slice(0, 150000);
const WHO = 'Sunne wala Pakistani dukandar hai: Urdu samajhta hai, sirf Roman (Latin a-z) harf parh sakta hai, English / Hindi ke mushkil lafz nahi samajhta.';
const romOnly = t => String(t || '').replace(/[؀-ۿݐ-ݿऀ-ॿ]+/g, ' ').replace(/[*#`]/g, '').replace(/[ \t]+/g, ' ').trim();
function sumOf(o) { return (Array.isArray(o.k) ? o.k : []).filter(x => Array.isArray(x) && String(x[0] || '').trim() && !NONLAT.test(String(x[0]))).slice(0, 10).map(x => [String(x[0]).trim(), String(x[1] || '').trim()]); }
function actOf(o) { return (Array.isArray(o.a) ? o.a : []).map(x => romOnly(Array.isArray(x) ? x[0] : x)).filter(Boolean).slice(0, 8).map(x => [x, 0]); }
async function sumMake(v, auto) {
  if (!S || S.sumBusy || !v || !v.parts.length) return; S.sumBusy = true; if (S.v === v) paint();
  try {
    const L = sumOf(jparse(await askText([WHO, 'Neeche ek video ki guftagu (Roman Urdu) hai. Is ka KHULASA dein: 5 se 10 sab se zaroori baatein, har baat 1-2 aasaan jumle. Sirf wohi jo video mein kaha gaya — apni taraf se kuch na jorein.', 'Sirf yeh JSON dein: {"k": [["baat Roman Urdu mein", "wohi baat Urdu harfon mein"]]}', 'Roman line mein Urdu / Devanagari harf KABHI nahi (sirf a-z).', '', txOf(v)].join('\n'), true)));
    if (!L.length) throw Error('khulasa khali aaya');
    v.sum = L; store(v); if (!auto) A.notice?.('📌 Khulasa ban gaya — neeche dekhein');
  } catch (e) { A.notice?.('✕ Khulasa nahi bana (' + String(e?.message || e).slice(0, 90) + ')' + (auto ? ' — ⋮ → 📌 Khulasa se dobara' : '')); }
  finally { if (S) { S.sumBusy = false; if (S.v === v) paint(); } }
}
async function actMake(v) {
  if (!S || S.actBusy || !v || !v.parts.length) return; S.actBusy = true; paint();
  try {
    const L = actOf(jparse(await askText([WHO, 'Neeche ek video ki guftagu (Roman Urdu) hai. Is se 5 se 8 AMALI kaam nikaalein jo sunne wala kal se apni zindagi, sehat, ghar / bachon ya apni dukan (kiryana, kai mulazim) mein kar sakta hai.', 'Har kaam ek chhota saaf jumla (hukum ki tarah), aasaan Roman Urdu mein. Sirf wohi jo video ki baat se nikalta ho — video mein kaam ki baat kam ho to kam dein.', 'Sirf yeh JSON dein: {"a": ["kaam 1", "kaam 2"]}', 'Urdu / Devanagari harf KABHI nahi (sirf a-z).', '', txOf(v)].join('\n'), true)));
    if (!L.length) throw Error('koi kaam ki baat nahi mili');
    v.act = L; store(v); A.notice?.('✅ Kaam ki baatein ban gayin — neeche dekhein');
  } catch (e) { A.notice?.('✕ Kaam ki baatein nahi banin (' + String(e?.message || e).slice(0, 90) + ')'); }
  finally { if (S) { S.actBusy = false; if (S.v === v) paint(); } }
}
async function qaAsk(v, q) {
  if (!S || S.qBusy || !v || !v.parts.length) return; q = String(q || '').trim().slice(0, 300); if (!q) { A.notice?.('Pehle sawal likhein'); return; }
  S.qBusy = true; S.q = q; paint();
  try {
    const a = romOnly(await askText([WHO, 'Neeche ek video ki guftagu (Roman Urdu) hai. Sawal ka jawab SIRF isi guftagu se dein: aasaan Roman Urdu, 2 se 5 jumle, aur bataein video mein kis waqt (jaise 12:30) yeh baat hui.', 'Agar video mein is ka jawab nahi hai to sirf itna likhein: Video mein yeh baat nahi hui. Apni taraf se kuch na jorein. Urdu / Devanagari harf nahi (sirf a-z). Koi JSON / sar-khi nahi — sirf jawab.', '', 'SAWAL: ' + q, '', 'GUFTAGU:', txOf(v)].join('\n'), false)).slice(0, 1200);
    if (!a) throw Error('jawab khali aaya');
    v.qa = [...(v.qa || []), [q, a]].slice(-10); store(v); if (S) { S.q = ''; const el = $('vsQ'); if (el) el.value = ''; }
  } catch (e) { A.notice?.('✕ Jawab nahi mila (' + String(e?.message || e).slice(0, 90) + ')'); }
  finally { if (S) { S.qBusy = false; if (S.v === v) { paint(); $('vsQa')?.scrollIntoView({ block: 'end' }); } } }
}
// 📌 khulasa ki awaz: Gemini (ek awaz, yaad mein) — na bane to phone ki awaz
async function sumSay(btn) {
  const v = S?.v; if (!v?.sum?.length) return;
  if (S.smp && !S.smp.paused && S.smpSum) { S.smp.pause(); btn.textContent = '🔊 Sunao'; return; }
  stopPlay(); const text = v.sum.map(x => x[1] || x[0]).join('\n'), key = v.id + ':sum:' + hsh(text + voKey()); btn.textContent = '⏳';
  try {
    let blob = await idbGet(key);
    if (!blob) { const cfg = await A.aiCfg(); if (!cfg?.key) throw Error('AI key nahi'); const models = S.ttsM || (S.ttsM = await ttsModels(cfg.key)); const d = await ttsOne(text, voGet().A, models, cfg.key); blob = audioBlob(d.data, d.mimeType || d.mime_type); idbPut(key, blob); }
    if (!S || S.v !== v) return;
    const a = S.smp || (S.smp = new Audio()); if (S.smpUrl) { try { URL.revokeObjectURL(S.smpUrl); } catch {} } S.smpUrl = URL.createObjectURL(blob); S.smpSum = 1;
    a.src = S.smpUrl; a.playbackRate = RATES[S.rate][0]; a.onended = () => { const b = dlg()?.querySelector('[data-vs="sumsay"]'); if (b) b.textContent = '🔊 Sunao'; }; await a.play();
    const b = dlg()?.querySelector('[data-vs="sumsay"]'); if (b) b.textContent = '⏸ Roko';
  } catch {
    const b = dlg()?.querySelector('[data-vs="sumsay"]'); if (b) b.textContent = '🔊 Sunao';
    const t = TTSP(); if (!t) { A.notice?.('🔊 Awaz nahi bani'); return; }
    try { t.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ur-PK'; const vc = urVoice(); if (vc) u.voice = vc; u.rate = RATES[S.rate][0]; t.speak(u); } catch {}
  }
}
function extraHTML(v) {
  if (!v || !v.parts.length) return '';
  const sum = v.sum && v.sum.length ? `<div class="vs-card" id="vsSum"><div class="vs-ch">📌 Khulasa <button type="button" class="vs-chip" data-vs="sumsay">🔊 Sunao</button></div><ol class="vs-ol">${v.sum.map(x => `<li>${esc(x[0])}</li>`).join('')}</ol></div>` : (S.sumBusy ? '<div class="vs-st">⏳ Khulasa ban raha hai…</div>' : '');
  const act = v.act && v.act.length ? `<div class="vs-card" id="vsAct"><div class="vs-ch">✅ Mere kaam ki baatein <small id="vsActN">✓ ${v.act.filter(x => x[1]).length}/${v.act.length}</small></div>${v.act.map((x, i) => `<label class="vs-ck"><input type="checkbox" data-vs-act="${i}"${x[1] ? ' checked' : ''}><span>${esc(x[0])}</span></label>`).join('')}</div>` : (S.actBusy ? '<div class="vs-st">⏳ Kaam ki baatein ban rahi hain…</div>' : '');
  const qa = `<div class="vs-card" id="vsQa"><div class="vs-ch">❓ Sawal poochho <small>jawab isi video se · 🤖 AI</small></div>${(v.qa || []).map(x => `<div class="vs-q"><b>${esc(x[0])}</b><div>${esc(x[1])}</div></div>`).join('')}<div class="vs-row"><input class="vs-in" id="vsQ" type="text" enterkeyhint="send" placeholder="Sawal likhein…" value="${esc(S.q || '')}"><button type="button" class="vs-chip" data-vs="ask"${S.qBusy ? ' disabled' : ''}>${S.qBusy ? '⏳' : 'Poochho'}</button></div></div>`;
  return sum + act + qa;
}
function wordsHTML() {
  const q = String(S.wq || '').toLowerCase().trim(), W = Object.values(jget('sam-vs-words', {})).filter(Array.isArray).sort((a, b) => (b[2] || 0) - (a[2] || 0)).filter(x => !q || (x[0] + ' ' + x[1]).toLowerCase().includes(q));
  return W.length ? `<div class="vs-wl">${W.slice(0, 400).map(x => `<div><b>${esc(x[0])}</b><span>= ${esc(x[1])}</span></div>`).join('')}</div>` : `<div class="vs-note">${q ? 'Is naam ka lafz nahi mila.' : 'Abhi koi lafz jama nahi hua — video samjhane par mushkil lafz khud yahan aate hain.'}</div>`;
}
function viewHTML() {
  const back = '<div class="vs-row"><button type="button" class="vs-chip" data-vs="vback">‹ Wapas</button></div>';
  if (S.view === 'words') return back + `<div class="vs-ttl">📖 Lafzon ki copy (${wordsN()})</div><div class="vs-row"><input class="vs-in" id="vsWq" data-vs-wq="1" type="search" placeholder="🔍 Lafz dhoondein" value="${esc(S.wq || '')}"></div><div id="vsWl">${wordsHTML()}</div>`;
  const L = starAll().slice().reverse();
  return back + `<div class="vs-ttl">⭐ Pasand ki lines (${L.length})</div>` + (L.length ? L.map(x => `<div class="vs-p"><div class="vs-ph"><a class="vs-tm" href="https://youtu.be/${esc(x.id)}?t=${Number(x.s) || 0}" target="_blank" rel="noopener">${fmt(x.s)}</a><small class="vs-sm">${esc(x.t || '')}</small><button type="button" class="vs-chip" data-vs-unstar="${esc(x.k)}" aria-label="Hatao">✕</button></div><div class="vs-l"><b>${esc(x.n || '')}:</b>${esc(x.r)}</div></div>`).join('') : '<div class="vs-note">Abhi koi line pasand nahi ki. Video ki kisi bhi line par tap karein = ⭐.</div>');
}
function pdfHTML(v) {
  const E = x => esc(String(x ?? '').replace(/[^\x20-\x7e -ÿ]/g, ' ').replace(/\s+/g, ' ').trim());
  let o = `<h1>${E(v.t) || 'Video'}</h1>`;
  if (v.sum?.length) o += `<h2>Khulasa</h2><table><tbody>${v.sum.map((x, i) => `<tr><td>${i + 1}</td><td>${E(x[0])}</td></tr>`).join('')}</tbody></table>`;
  if (v.act?.length) o += `<h2>Mere kaam ki baatein</h2><table><tbody>${v.act.map((x, i) => `<tr><td>${i + 1}</td><td>${E(x[0])}</td></tr>`).join('')}</tbody></table>`;
  o += `<h2>Guftagu (${fmt(v.parts[0].s)} - ${fmt(v.parts[v.parts.length - 1].e)})</h2><table><thead><tr><th>Waqt</th><th>Kaun</th><th>Baat</th></tr></thead><tbody>${v.parts.flatMap(p => linesOf(p).map((l, k) => `<tr><td>${k ? '' : fmt(p.s)}</td><td>${E(nameOf(v, l[0]))}</td><td>${E(l[1])}</td></tr>`)).join('')}</tbody></table>`;
  return o;
}
// 😴 so jaun to band
function sleepSet(min) { if (!S) return; clearTimeout(S.sleepT); S.sleepAt = min ? Date.now() + min * 60000 : 0; if (min) S.sleepT = setTimeout(sleepDue, min * 60000 + 800); A.notice?.(min ? '😴 ' + min + ' minute baad awaz khud band ho jayegi' : '😴 Timer band'); }
function sleepDue() {
  if (!S || !S.sleepAt || Date.now() < S.sleepAt) return false;
  S.sleepAt = 0; clearTimeout(S.sleepT); try { S.smp?.pause(); } catch {}
  if (S.cur >= 0 || S.waitNew) { S.waitNew = false; stopPlay(); }
  A.notice?.('😴 Timer poora — awaz band. Dobara kholein to wahin se chalegi.'); if (S.menu) paint();
  return true;
}
// v1.6: naya hissa purane mein jorna — usi waqt ke purane hisse hata kar, waqt ki tarteeb se. Pehle naye hisse ka number wapas.
function mergeIn(v, add, a, b) {
  if (!add.length) return v.parts.length;
  const lo = Math.min(...add.map(p => p.s)), hi = Math.max(...add.map(p => p.e));
  v.parts = v.parts.filter(p => !(p.s >= lo && p.s < hi)).concat(add).sort((x, y) => x.s - y.s);
  return add.length ? v.parts.indexOf(add[0]) : v.parts.length;
}
// v1.6: link likha / paste hua = waqt khud. Pehle samjhi video = khud khul jaye (AI nahi), nayi = khana 0:00 (ya link ka ?t=).
function urlAuto(u) {
  if (!S) return; const id = vidOf(u); if (!id) return;
  const t = tOf(u), key = id + '|' + t; if (S.uk === key) return; S.uk = key;
  const from = t != null ? fmt(t) : '';
  if (S.v && S.v.id === id) { S.url = u; S.from = from; const f = $('vsFrom'); if (f) f.value = from; return; }
  if (S.busy) { S.url = u; S.from = from; const f = $('vsFrom'); if (f) f.value = from; A.notice?.('⏳ Pehli video ka hissa aa raha hai — 🎬 dabayein, us ke baad yeh shuru hogi'); return; }
  if (load()[id]) { openSaved(id); S.url = u; S.from = from; paint(); A.notice?.('📚 Yeh video pehle samjhi hui hai — wahin se khul gayi'); return; }
  stopPlay(); freeAud(); S.v = null; S.view = ''; S.err = ''; S.url = u; S.from = from; paint();
  const f = $('vsFrom'); if (f && !from) f.placeholder = '0:00';
}
// v1.6: 🎬 — khali waqt = jahan tak bani wahan se aage (nayi = shuru se); bani hui jagah ka waqt = wohi hissa khule (AI nahi); purana kabhi nahi mitta
function goVid(id, a) {
  if (!S) return;
  if (S.busy) {
    if (S.v && S.v.id === id) { A.notice?.('⏳ Isi video ka hissa aa raha hai'); return; }
    S.queue = { id, a }; S.halt = true; S.msg = 'Pehli video ka hissa poora ho raha hai — phir nayi khud shuru…'; const st = $('vsSt'); if (st && st.firstChild) st.firstChild.textContent = '⏳ ' + S.msg; A.notice?.('⏳ Pehli video ka hissa poora hote hi nayi khud shuru'); return;
  }
  const o = S.v && S.v.id === id ? S.v : load()[id];
  if (o && (!S.v || S.v.id !== id)) openSaved(id);
  const v = S.v && S.v.id === id ? S.v : null;
  if (a == null) {
    if (!v) { run(id, 0); return; }
    if (v.end && v.parts.length) { A.notice?.('✅ Yeh video poori samjhi hui hai — waqt likh kar koi aur hissa'); return; }
    run(id, v.next || 0); return;
  }
  if (v) { const i = v.parts.findIndex(p => a >= p.s && a < p.e); if (i >= 0) { dlg()?.querySelector(`[data-vs-part="${i}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); A.notice?.('📚 Yeh hissa pehle se bana hai'); return; } }
  run(id, a);
}
function openSaved(id) {
  const o = load()[id]; if (!o || !S || S.busy) return false;
  stopPlay(); freeAud(); S.v = savedV(o); S.view = ''; S.url = 'https://youtu.be/' + o.id; S.from = ''; S.err = '';
  try { localStorage.setItem('sam-vs-last', o.id); } catch {}
  wordsAdd(S.v.parts); paint(); pump();
  const i = posIdx(S.v); if (i > 0) setTimeout(() => dlg()?.querySelector(`[data-vs-part="${i}"]`)?.scrollIntoView({ block: 'center' }), 80);
  return true;
}
function onInput(e) { const t = e.target; if (!S || !t?.dataset) return; if (t.id === 'vsUrl') { urlAuto(t.value.trim()); return; } if (t.id === 'vsFrom') { const g = $('vsGo'); if (g && S.v && S.v.parts.length && !S.v.end) g.textContent = t.value.trim() ? '🎬 Samjhao' : '🎬 Aage samjhao'; return; } if (t.dataset.vsWq) { S.wq = t.value; const b = $('vsWl'); if (b) b.innerHTML = wordsHTML(); } }
function onChange(e) {
  const t = e.target; if (!S || !t?.dataset || t.dataset.vsAct == null) return; const v = S.v, i = Number(t.dataset.vsAct); if (!v?.act?.[i]) return;
  v.act[i][1] = t.checked ? 1 : 0; store(v); const n = $('vsActN'); if (n) n.textContent = '✓ ' + v.act.filter(x => x[1]).length + '/' + v.act.length;
}
function onKey(e) { if (e.key === 'Enter' && e.target?.id === 'vsQ' && S?.v) { e.preventDefault(); qaAsk(S.v, e.target.value); } }
async function share() {
  const v = S?.v; if (!v) return;
  const text = (v.t || 'Video') + '\n\n' + v.parts.map(p => linesOf(p).map(l => l[2] || l[1]).join('\n')).join('\n\n');
  try { if (navigator.share) { await navigator.share({ title: v.t || 'Video', text }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); A.notice?.('📋 Likhai copy ho gayi — parhne wali app mein paste karein'); } catch { A.notice?.('Share / copy nahi ho saka'); }
}
async function onClick(e) {
  const d = dlg(); if (!d || !S) return;
  const t = e.target.closest?.('[data-vs],[data-vs-say],[data-vs-old],[data-vs-del],[data-vs-vo],[data-vs-sl],[data-vs-unstar],[data-vs-ln]'); if (!t || !d.contains(t)) return;
  const k = t.dataset;
  const keep = () => { S.url = $('vsUrl')?.value || ''; S.from = $('vsFrom')?.value || ''; };
  if (k.vsSay != null) { const i = Number(k.vsSay); if (S.cur === i) toggle(); else { S.all = true; playPart(i); } return; }
  if (k.vsOld) { openSaved(k.vsOld); return; }
  if (k.vsSl != null) { keep(); sleepSet(Number(k.vsSl) || 0); paint(); return; }
  if (k.vsUnstar) { jset('sam-vs-star', starAll().filter(x => x.k !== k.vsUnstar)); paint(); return; }
  if (k.vsLn != null && !k.vs) { const [i, j] = k.vsLn.split(':').map(Number), q = S.v?.parts[i], l = q && linesOf(q)[j]; if (!l) return; const on = starToggle(S.v, q, l); t.classList.toggle('st', on); A.notice?.(on ? '⭐ Pasand mein rakh li' : 'Pasand se hata di'); return; }
  if (k.vs === 'star' || k.vs === 'words') { keep(); S.view = k.vs; S.menu = false; S.wq = ''; paint(); d.querySelector('.vs-scroll')?.scrollTo?.({ top: 0 }); return; }
  if (k.vs === 'vback') { S.view = ''; paint(); return; }
  if (k.vs === 'sum') { keep(); S.menu = false; if (S.v?.sum?.length && !confirm('Khulasa pehle se bana hai. Dobara banayein?')) { paint(); $('vsSum')?.scrollIntoView({ block: 'center' }); return; } sumMake(S.v, false); return; }
  if (k.vs === 'act') { keep(); S.menu = false; if (S.v?.act?.length && !confirm('Kaam ki baatein pehle se bani hain. Dobara banayein? (tick mit jayenge)')) { paint(); $('vsAct')?.scrollIntoView({ block: 'center' }); return; } actMake(S.v); return; }
  if (k.vs === 'qgo') { keep(); S.menu = false; S.view = ''; paint(); const el = $('vsQ'); if (el) { el.scrollIntoView({ block: 'center' }); try { el.focus(); } catch {} } return; }
  if (k.vs === 'ask') { qaAsk(S.v, $('vsQ')?.value || ''); return; }
  if (k.vs === 'sumsay') { sumSay(t); return; }
  if (k.vs === 'pdf') { const v = S.v; if (!v || !v.parts.length) return; if (!A.pdf) { A.notice?.('PDF yahan nahi ban sakti'); return; } const html = pdfHTML(v), ttl = 'Video samjhao — ' + String(v.t || 'Video').replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); close(); A.pdf(html, ttl); return; }
  if (k.vsDel) { if (confirm('Yeh samjhi hui video (aur us ki awaz) list se hata dein?')) { drop(k.vsDel); paint(); } return; }
  if (k.vs === 'menu') { keep(); S.menu = !S.menu; paint(); if (S.menu) d.querySelector('.vs-scroll')?.scrollTo?.({ top: 0 }); return; }
  if (k.vsVo) {
    const [w, name] = k.vsVo.split(':'); if (!VOICES.some(v => v[0] === name) || (w !== 'A' && w !== 'B')) return;
    const vo = voGet(), ch = vo[w] !== name; keep();
    if (ch) { vo[w] = name; try { localStorage.setItem('sam-vs-voice', JSON.stringify(vo)); } catch {} stopPlay(); freeAud(); S.ttsOff = ''; S.ttsFail = 0; }
    S.smpW = w + name; paint(); if (ch) pump();
    sample(name).finally(() => { if (S && S.smpW === w + name) { S.smpW = ''; const sc = d.querySelector('.vs-scroll'), y = sc?.scrollTop || 0; if (S.menu) { S.url = $('vsUrl')?.value || S.url; S.from = $('vsFrom')?.value || S.from; paint(); const s2 = d.querySelector('.vs-scroll'); if (s2) s2.scrollTop = y; } } });
    return;
  }
  if (k.vs === 'x') { close(); return; }
  if (k.vs === 'paste') { try { const x = await navigator.clipboard.readText(); if (x) { keep(); S.url = x.trim(); paint(); urlAuto(S.url); } } catch { A.notice?.('Paste ki ijazat nahi mili — link khane mein khud paste karein'); } return; }
  if (k.vs === 'list') { keep(); if (S.busy) { A.notice?.('⏳ Abhi hissa aa raha hai — thori der baad'); return; } S.menu = false; stopPlay(); freeAud(); S.v = null; S.url = ''; S.from = ''; S.view = ''; S.err = ''; try { localStorage.removeItem('sam-vs-last'); } catch {} paint(); return; }
  if (k.vs === 'rate') { S.rate = (S.rate + 1) % RATES.length; try { localStorage.setItem('sam-vs-rate', String(S.rate)); } catch {} if (AU) AU.playbackRate = RATES[S.rate][0]; paintBar(); return; }
  if (k.vs === 'all') { if (S.waitNew) { S.waitNew = false; paintBar(); } else if (S.cur >= 0) toggle(); else { S.all = true; playPart(posIdx(S.v)); } return; }
  if (k.vs === 'halt') { S.halt = true; clearTimeout(S.retry); S.retry = 0; t.disabled = true; t.textContent = '⏹ Ruk raha…'; return; }
  if (k.vs === 'force') { if (S.v && !S.busy) { S.v.end = 0; S.err = ''; run(S.v.id, S.v.next || 0); } return; }
  if (k.vs === 'more') { if (S.v && !S.v.end) run(S.v.id, S.v.next); return; }
  if (k.vs === 'share') { share(); return; }
  if (k.vs === 'go') {
    keep(); const id = vidOf(S.url); if (!id) { S.err = 'YouTube ka sahi link daalein (Share → Copy link).'; paint(); return; }
    goVid(id, String(S.from || '').trim() ? secOf(S.from) : null);
  }
}
function shut() { if (!S) return; clearTimeout(S.retry); clearTimeout(S.holdT); clearTimeout(S.sleepT); if (S.smpUrl) { try { URL.revokeObjectURL(S.smpUrl); } catch {} } stopPlay(); freeAud(); try { S.smp?.pause(); } catch {} try { if (AU) { AU.removeAttribute('src'); AU.load(); } } catch {} S = null; }
function close() { const d = dlg(); shut(); if (d) { try { d.close(); } catch {} d.remove(); } if (window.ntVsClose) window.ntVsClose = null; }
export function open(ctx) {
  A = ctx || {};
  if (!$('vsCss')) { const s = document.createElement('style'); s.id = 'vsCss'; s.textContent = CSS; document.head.appendChild(s); }
  let d = dlg(); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'vsDlg'; d.className = 'vs-dlg'; document.body.appendChild(d);
  let rate = 1; try { const r = Number(localStorage.getItem('sam-vs-rate')); if (r >= 0 && r < RATES.length) rate = r; } catch {}
  S = { url: '', from: '', v: null, busy: false, halt: false, err: '', msg: '', cur: -1, wait: -1, waitNew: false, all: false, paused: false, rate, tok: 0, aud: {}, pumps: 0, ln: '', retry: 0, ttsOff: '', ttsFail: 0, ttsM: null, ttsNoMulti: '', menu: false, smpW: '', smp: null, cap: {}, ttsHold: 0, tts429: 0, holdT: 0, seek: null, srcUrl: '', view: '', q: '', wq: '', qBusy: false, sumBusy: false, actBusy: false, sleepAt: 0, sleepT: 0, smpUrl: '', smpSum: 0 };
  audioSetup();
  d.addEventListener('click', onClick); d.addEventListener('input', onInput); d.addEventListener('change', onChange); d.addEventListener('keydown', onKey);
  d.addEventListener('close', () => { shut(); d.remove(); });
  try { TTSP()?.getVoices(); } catch {}
  paint();
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntVsClose = () => { close(); return true; };
  // v1.5: YouTube se Share aaya = wohi video (pehle samjhi ho to wahin se, warna shuru se khud) · warna pichhli khuli video wahin se
  const sh = vidOf(A.share || '');
  if (sh) { if (!openSaved(sh)) { const t0 = tOf(A.share) || 0; S.url = 'https://youtu.be/' + sh; S.from = t0 ? fmt(t0) : ''; paint(); run(sh, t0); } }
  else { let last = ''; try { last = localStorage.getItem('sam-vs-last') || ''; } catch {} if (last) openSaved(last); }
}
