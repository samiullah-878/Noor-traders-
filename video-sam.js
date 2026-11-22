// video-sam.js v1.1 (app v2.354.0, 23 Nov 2026) — 🎓 VIDEO SAMJHAO
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
const LS = 'sam-vs-list', STEP = 900, KEEP = 12, MAXAUTO = 8;
const FALLBACK = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash'];
const TTS_FALL = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const VOICE = { A: 'Kore', B: 'Charon' };          // A = zanana, B = mardana (Gemini ki bani banai awazein)
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
const fmt = s => { s = Math.max(0, Math.round(Number(s) || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x; };
const tsOf = v => { if (typeof v === 'number') return v; const s = String(v ?? ''); return s.includes(':') ? secOf(s) : (Number(s.replace(/[^0-9.]/g, '')) || 0); };
const linesOf = p => (p.d && p.d.length ? p.d : (p.r ? [['A', p.r, p.u || '']] : []));
function parseOut(text, a, b) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i >= 0 && j > i) t = t.slice(i, j + 1);
  const o = JSON.parse(t), L = Array.isArray(o.p) ? o.p : [];
  const parts = L.map(x => {
    let d = (Array.isArray(x.d) ? x.d : []).filter(y => Array.isArray(y) && String(y[1] || '').trim()).map(y => [String(y[0]).toUpperCase() === 'B' ? 'B' : 'A', String(y[1]).trim(), String(y[2] || '').trim()]);
    if (!d.length && String(x.r || '').trim()) d = [['A', String(x.r).trim(), String(x.u || '').trim()]];
    return { s: Math.min(Math.max(tsOf(x.s), a), b), e: Math.min(Math.max(tsOf(x.e), a), b), d, w: (Array.isArray(x.w) ? x.w : []).filter(y => Array.isArray(y) && y[0] && y[1]).slice(0, 5).map(y => [String(y[0]), String(y[1])]) };
  }).filter(x => x.d.length);
  const sp = Array.isArray(o.sp) ? o.sp.slice(0, 2).map(x => String(x || '').trim().slice(0, 24)) : [];
  return { title: String(o.title || '').trim().slice(0, 120), sp, end: Number(o.end) ? 1 : 0, parts };
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
export const _t = { vidOf, secOf, fmt, parseOut, wavBytes, ttsText, linesOf };

const load = () => { try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
function store(v) {
  try {
    const o = load(); o[v.id] = { id: v.id, t: v.t || '', sp: v.sp || [], parts: v.parts, next: v.next, end: v.end ? 1 : 0, at: Date.now() };
    const ids = Object.keys(o).sort((x, y) => (o[y].at || 0) - (o[x].at || 0));
    for (const k of ids.slice(KEEP)) { delete o[k]; idbDropVid(k); }
    localStorage.setItem(LS, JSON.stringify(o));
  } catch {}
}
const drop = id => { try { const o = load(); delete o[id]; localStorage.setItem(LS, JSON.stringify(o)); } catch {} idbDropVid(id); };

// ---------- audio ki yaad (IndexedDB 'nt-vs') ----------
let DBP = null;
const idb = () => DBP || (DBP = new Promise(res => { try { const r = indexedDB.open('nt-vs', 1); r.onupgradeneeded = () => r.result.createObjectStore('a'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } }));
const aKey = (id, p) => id + ':' + Math.round(p.s) + ':' + linesOf(p).length;
const idbGet = async k => { const db = await idb(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('a').objectStore('a').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch { res(null); } }); };
const idbPut = async (k, v) => { const db = await idb(); if (!db) return; try { db.transaction('a', 'readwrite').objectStore('a').put(v, k); } catch {} };
async function idbDropVid(id) { const db = await idb(); if (!db) return; try { const st = db.transaction('a', 'readwrite').objectStore('a'), q = st.openKeyCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; if (String(c.key).startsWith(id + ':')) st.delete(c.key); c.continue(); }; } catch {} }

const PROMPT = (a, b) => [
  'Aap ek sabar wale ustaad hain. Sunne wala Pakistani hai: Urdu samajhta hai, Hindi / Sanskrit ke mushkil lafz NAHI samajhta, aur sirf Roman (Latin) harf parh sakta hai.',
  `Is YouTube video ka SIRF ${fmt(a)} se ${fmt(b)} tak ka hissa (second ${a} se ${b}) sunein.`,
  'Is hisse ko 1 se 2 minute ke tukron mein baantein, tarteeb se, aur har tukre ki guftagu likhein.',
  'Sirf yeh JSON dein (koi aur likhai nahi):',
  '{"title": "video ka naam", "sp": ["Raj", "Doctor"], "end": 0, "p": [{"s": 3224, "e": 3320, "d": [["A", "roman line", "urdu line"], ["B", "roman line", "urdu line"]], "w": [["lafz", "matlab"]]}]}',
  '- sp = do asal bolne walon ke chhote naam Roman mein: pehla A = mezban (sawal poochhne wala), doosra B = mehman. Ek hi banda bole to sirf A.',
  '- s, e = tukre ke shuru aur khatam ke SECOND (video ke shuru se, hindse).',
  '- d = us tukre ki guftagu tarteeb se, 2 se 6 lines: har line = ["A" ya "B", Roman Urdu, wohi line Urdu harfon (Arabic script) mein]. Har line 1 se 3 jumle.',
  '- Har bolne wale ki baat usi ke andaz mein, MUKHTASAR — lafz-ba-lafz transcript NAHI. Jo video mein nahi kaha gaya wo apni taraf se MAT jorein.',
  '- Hindi / Sanskrit lafz ki jagah aam Urdu lafz (samasya = masla, karan = wajah, prashn = sawal). Aam English lafz rehne dein. Roman line mein Devanagari ya Urdu harf KABHI nahi.',
  '- w = us tukre ke zyada se zyada 3 mushkil lafz Roman mein aur un ka aasaan Urdu matlab Roman mein. Na hon to [].',
  '- Ishtihar / sponsor ka hissa ek line mein.',
  `- Agar video ${fmt(b)} se pehle khatam ho jaye to "end": 1. Agar ${fmt(a)} par video pehle hi khatam ho chuki ho to "p": [] aur "end": 1.`
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
  const cfg = await A.aiCfg(); if (!cfg || !cfg.key) throw Error('AI key nahi lagi — Settings → AI key.');
  const models = [cfg.model, ...FALLBACK].filter((m, i, L) => m && L.indexOf(m) === i);
  const body = lv => ({
    contents: [{ role: 'user', parts: [{ file_data: { file_uri: 'https://www.youtube.com/watch?v=' + id }, ...(lv < 2 ? { video_metadata: { start_offset: a + 's', end_offset: b + 's' } } : {}) }, { text: PROMPT(a, b) }] }],
    generationConfig: { temperature: 0.2, ...(lv < 3 ? { responseMimeType: 'application/json' } : {}), ...(lv < 1 ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {}) }
  });
  let last = null;
  for (let mi = 0; mi < models.length; mi++) {
    for (let lv = 0; lv < 4; lv++) {
      const r = await post(models[mi], body(lv), cfg.key, 240000);
      if (!r.ok) {
        last = Error(r.msg);
        if (r.status === -1) throw Error('AI ne 4 minute mein jawab nahi diya — internet dekhein, phir dobara.');
        if (r.status === 429) throw Error('Google ki hadd poori ho gayi — kuch der baad dobara koshish karein.');
        if (r.status === 403 && /permission|private|not\s*(?:public|available)/i.test(r.msg)) throw Error('Yeh video AI nahi dekh sakta (private / pabandi wali). Sirf public video chalti hai.');
        if (r.status === 404 || /not found|no longer available|not supported for/i.test(r.msg)) break;
        if (r.status === 400) continue;
        if (r.status >= 500 || r.status === 0) break;
        throw last;
      }
      const text = (r.j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!text) { last = Error('AI ne khali jawab diya' + (r.j.promptFeedback?.blockReason ? ' (' + r.j.promptFeedback.blockReason + ')' : '')); continue; }
      try { return parseOut(text, a, b); } catch { last = Error('AI ka jawab parha nahi gaya — dobara koshish karein.'); }
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
async function tts(p) {
  const cfg = await A.aiCfg(); if (!cfg?.key) throw Object.assign(Error('AI key nahi'), { off: 1 });
  const both = linesOf(p).some(l => l[0] === 'B');
  const vc = k => ({ prebuiltVoiceConfig: { voiceName: VOICE[k] } });
  const body = {
    contents: [{ parts: [{ text: 'TTS the following ' + (both ? 'podcast conversation between ' + SPK.A + ' and ' + SPK.B : 'text') + ' in Urdu (Pakistan), natural calm pace. Do not read the speaker names aloud.\n' + ttsText(p) }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: both ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [{ speaker: SPK.A, voiceConfig: vc('A') }, { speaker: SPK.B, voiceConfig: vc('B') }] } } : { voiceConfig: vc('A') } }
  };
  if (!both) body.contents[0].parts[0].text = 'Say in Urdu (Pakistan), natural calm pace:\n' + linesOf(p).map(l => l[2] || l[1]).join('\n');
  const models = S.ttsM || (S.ttsM = await ttsModels(cfg.key));
  let last = null;
  for (const m of models.slice(0, 4)) {
    const r = await post(m, body, cfg.key, 180000);
    if (r.ok) {
      const part = (r.j.candidates?.[0]?.content?.parts || []).find(x => x.inlineData?.data || x.inline_data?.data), d = part?.inlineData || part?.inline_data;
      if (d?.data) { if (S.ttsM[0] !== m) S.ttsM = [m, ...S.ttsM.filter(x => x !== m)]; return audioBlob(d.data, d.mimeType || d.mime_type); }
      last = Error('awaz khali aayi'); continue;
    }
    last = Error(r.msg);
    if (r.status === 429) throw Object.assign(Error('Google ki awaz ki hadd poori ho gayi'), { off: 1 });
    if (r.status === 401 || r.status === 403) throw Object.assign(last, { off: 1 });
  }
  throw Object.assign(last || Error('awaz nahi bani'), { all: 1 });
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
async function pump() {
  if (!S || S.pumping || !S.v) return;
  S.pumping = true;
  try {
    for (;;) {
      if (!S || !S.v) break;
      const v = S.v, n = v.parts.length, from = Math.max(0, S.cur);
      let i = -1;
      for (let k = 0; k < n; k++) { const x = (from + k) % n; if (!S.aud[x]) { i = x; break; } }
      if (i < 0) break;
      const p = v.parts[i], key = aKey(v.id, p);
      S.aud[i] = { st: 'w' }; badge(i);
      let blob = await idbGet(key);
      if (!blob && !S.ttsOff) {
        try { blob = await tts(p); idbPut(key, blob); S.ttsFail = 0; }
        catch (e) {
          if (!S || S.v !== v) break;
          S.ttsFail = (S.ttsFail || 0) + 1;
          if (e?.off || S.ttsFail >= 3) { S.ttsOff = String(e?.message || e); A.notice?.('🔊 Gemini ki awaz nahi bani (' + S.ttsOff.slice(0, 90) + ') — phone ki awaz chalegi (sirf screen khuli ho to).'); }
        }
      }
      if (!S || S.v !== v) break;
      S.aud[i] = blob ? { st: 'ok', url: URL.createObjectURL(blob) } : { st: 'x' };
      badge(i);
      if (S.wait === i) { S.wait = -1; playPart(i); }
    }
  } finally { if (S) { S.pumping = false; if (S.v && S.v.parts.some((_, i) => !S.aud[i])) setTimeout(pump, 0); } }
}

// ---------- chalana ----------
const TTSP = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;
const RATES = [[0.85, 'Aahista'], [1, 'Aam'], [1.25, 'Tez']];
const urVoice = () => { const t = TTSP(); if (!t) return null; const L = t.getVoices() || []; return L.find(v => /^ur/i.test(v.lang)) || null; };
function phoneTalk(i) {
  const t = TTSP(), p = S.v.parts[i]; if (!t || !p) { next(); return; }
  try { t.cancel(); } catch {}
  const tok = S.tok = (S.tok || 0) + 1, L = linesOf(p), vc = urVoice(); let k = 0;
  const step = () => {
    if (!S || S.tok !== tok) return;
    if (k >= L.length) { next(); return; }
    const l = L[k++], u = new SpeechSynthesisUtterance(l[2] || l[1]); u.lang = l[2] ? 'ur-PK' : 'en-IN'; if (vc && l[2]) u.voice = vc;
    u.rate = RATES[S.rate][0]; u.pitch = l[0] === 'B' ? 0.75 : 1.2;
    u.onend = step; u.onerror = ev => { if (ev?.error === 'interrupted' || ev?.error === 'canceled') return; step(); };
    t.speak(u);
  };
  step();
}
function quiet() { if (!S) return; S.tok = (S.tok || 0) + 1; try { TTSP()?.cancel(); } catch {} try { AU?.pause(); } catch {} }
function stopPlay() { if (!S) return; quiet(); const c = S.cur; S.cur = -1; S.wait = -1; S.paused = false; S.all = false; if (c >= 0) badge(c); paintBar(); try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'; } catch {} }
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
  if (a?.st === 'ok') { AU.src = a.url; AU.playbackRate = RATES[S.rate][0]; AU.play().catch(() => { S.paused = true; badge(i); paintBar(); }); meta(i); }
  else if (a?.st === 'x') phoneTalk(i);
  else { S.wait = i; pump(); }
  badge(i); paintBar();
  $('vsDlg')?.querySelector(`[data-vs-part="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function next() {
  if (!S || !S.v || S.cur < 0) return;
  if (!S.all) { stopPlay(); return; }
  const i = S.cur + 1;
  if (i < S.v.parts.length) { playPart(i); return; }
  if (S.busy) { const c = S.cur; S.cur = -1; badge(c); S.waitNew = true; paintBar(); return; }
  stopPlay();
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
  AU.addEventListener('ended', () => next());
  AU.addEventListener('error', () => { if (!S || S.cur < 0 || !AU.src) return; const i = S.cur; S.aud[i] = { st: 'x' }; badge(i); phoneTalk(i); });
  try {
    const ms = navigator.mediaSession; if (!ms) return;
    ms.setActionHandler('play', () => { if (S?.paused) toggle(); });
    ms.setActionHandler('pause', () => { if (S && !S.paused) toggle(); });
    ms.setActionHandler('nexttrack', () => { if (S?.v && S.cur + 1 < S.v.parts.length) { S.all = true; playPart(S.cur + 1); } });
    ms.setActionHandler('previoustrack', () => { if (S?.v && S.cur > 0) { S.all = true; playPart(S.cur - 1); } });
  } catch {}
}
function freeAud() { if (!S) return; for (const k of Object.keys(S.aud)) { const u = S.aud[k]?.url; if (u) try { URL.revokeObjectURL(u); } catch {} } S.aud = {}; }

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
.vs-w{display:flex;flex-wrap:wrap;gap:5px}
.vs-w span{font-size:13.5px;background:#fff8e6;border:1px solid #f0d49a;border-radius:999px;padding:2px 9px}
.vs-w span b{font-weight:800}
.vs-old{display:grid;gap:6px}
.vs-oc{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #dfe6f2;border-radius:12px;padding:8px 10px;min-width:0}
.vs-oc>div{flex:1;min-width:0;cursor:pointer}.vs-oc b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vs-oc small{font-size:12.5px;color:#5b6885}
.vs-bar{flex:none;display:flex;gap:6px;padding:8px 10px;background:#fff;border-top:1px solid #dfe6f2;overflow-x:auto}
.vs-bar .vs-go{flex:1 0 auto}
`;
const dlg = () => $('vsDlg');
const nameOf = (v, k) => (v.sp && v.sp[k === 'B' ? 1 : 0]) || (k === 'B' ? 'Mehman' : 'Mezban');
function oldHTML() {
  const o = load(), ids = Object.keys(o).sort((x, y) => (o[y].at || 0) - (o[x].at || 0));
  if (!ids.length) return '';
  return `<div class="vs-note"><b>Pehle samjhi hui videos</b> (sirf is phone par)</div><div class="vs-old">${ids.map(k => `<div class="vs-oc"><div data-vs-old="${esc(k)}"><b>${esc(o[k].t || 'Video ' + k)}</b><small>${(o[k].parts || []).length} hisse · ${fmt(o[k].next || 0)} tak${o[k].end ? ' · poori' : ''}</small></div><button type="button" class="vs-chip" data-vs-del="${esc(k)}" aria-label="Hatao">🗑</button></div>`).join('')}</div>`;
}
function partsHTML(v) {
  return v.parts.map((p, i) => `<div class="vs-p" data-vs-part="${i}"><div class="vs-ph"><a class="vs-tm" href="https://youtu.be/${esc(v.id)}?t=${Math.round(p.s)}" target="_blank" rel="noopener">${fmt(p.s)} – ${fmt(p.e)}</a><span class="vs-ab"></span><button type="button" class="vs-say" data-vs-say="${i}" aria-label="Sunao">▶</button></div>${linesOf(p).map(l => `<div class="vs-l ${l[0] === 'B' ? 'b' : 'a'}"><b>${esc(nameOf(v, l[0]))}:</b>${esc(l[1])}</div>`).join('')}${(p.w || []).length ? `<div class="vs-w">${p.w.map(w => `<span><b>${esc(w[0])}</b> = ${esc(w[1])}</span>`).join('')}</div>` : ''}</div>`).join('');
}
function paint() {
  const d = dlg(); if (!d || !S) return;
  const v = S.v, y = d.querySelector('.vs-scroll')?.scrollTop || 0;
  const form = `<div class="vs-form"><div class="vs-row"><input class="vs-in" id="vsUrl" type="url" inputmode="url" placeholder="YouTube ka link" value="${esc(S.url || '')}"><button type="button" class="vs-chip" data-vs="paste">📋 Paste</button></div>
    <div class="vs-row"><input class="vs-in t" id="vsFrom" type="text" inputmode="numeric" placeholder="0:00" value="${esc(S.from || '')}"><button type="button" class="vs-go" data-vs="go"${S.busy ? ' disabled' : ''}>🎬 Samjhao</button></div>
    ${v ? '' : '<div class="vs-note">"Kahan se" = waqt, jaise <b>53:44</b>. Khali = shuru se. Pehle 15 minute aate hi sunna shuru karein — agle hisse peeche khud load hote hain. 🤖 AI (Gemini: likhai + awaz) — kabhi ghalat bhi samajh sakta hai.</div>'}</div>`;
  const st = S.busy ? `<div class="vs-st" id="vsSt">⏳ ${esc(S.msg || 'AI video sun raha hai…')}${v && v.parts.length ? '' : '<div class="vs-note">1-3 minute lag sakte hain.</div>'}</div>` : (S.err ? `<div class="vs-st bad">✕ ${esc(S.err)}</div>` : '');
  const body = v ? `<div class="vs-ttl">${esc(v.t || 'Video')}</div>${partsHTML(v)}${!v.parts.length && !S.busy ? '<div class="vs-note">Is hisse mein kuch nahi mila.</div>' : ''}${st}${v.end ? '<div class="vs-note">✅ Video yahan khatam.</div>' : ''}${!S.busy ? '<div class="vs-row"><button type="button" class="vs-chip" data-vs="list">‹ Doosri video</button></div>' : ''}` : st + oldHTML();
  d.innerHTML = `<div class="vs-hd"><div><b>🎓 Video samjhao</b><small>YouTube ki video — aasaan Roman Urdu mein + 🔊 awaz</small></div><button type="button" class="vs-x" data-vs="x" aria-label="Band">✕</button></div>
    <div class="vs-scroll">${form}${body}</div><div class="vs-bar" id="vsBar"></div>`;
  const sc = d.querySelector('.vs-scroll'); if (sc) sc.scrollTop = y;
  if (v) v.parts.forEach((_, i) => badge(i));
  paintBar();
}
function paintBar() {
  const b = $('vsBar'); if (!b || !S) return; const v = S.v;
  if (!v || !v.parts.length) { b.style.display = 'none'; return; }
  b.style.display = '';
  const on = S.cur >= 0 || S.waitNew;
  b.innerHTML = `<button type="button" class="vs-go" data-vs="all">${on ? (S.paused ? '▶ Chalao' : (S.wait >= 0 || S.waitNew ? '⏳ Awaz ban rahi' : '⏸ Roko')) : '▶ Sab sunao'}</button><button type="button" class="vs-chip" data-vs="rate">🐢 ${RATES[S.rate][1]}</button>${S.busy ? '<button type="button" class="vs-chip" data-vs="halt">⏹ Load roko</button>' : (v.end ? '' : '<button type="button" class="vs-chip" data-vs="more">➡ Aage 15 min</button>')}<button type="button" class="vs-chip" data-vs="share">📤 Reader</button>`;
}
function append(first) {
  const d = dlg(); if (!d || !S?.v) return;
  if (!d.querySelector('[data-vs-part]')) { paint(); return; }
  const w = document.createElement('div'); w.innerHTML = partsHTML(S.v);
  const all = [...w.children].slice(first), last = [...d.querySelectorAll('[data-vs-part]')].pop();
  let at = last; for (const el of all) { at.after(el); at = el; }
  for (let i = first; i < S.v.parts.length; i++) badge(i);
}
async function run(id, a, n = 0) {
  if (!S || S.busy) return;
  if (!S.v || S.v.id !== id) { stopPlay(); freeAud(); const o = load()[id]; S.v = o && a === (o.next || 0) ? { id, t: o.t, sp: o.sp || [], parts: o.parts || [], next: o.next || 0, end: o.end } : { id, t: o?.t || '', sp: o?.sp || [], parts: [], next: a, end: 0 }; }
  const v = S.v, b = a + STEP; S.busy = true; S.halt = false; S.err = ''; S.msg = 'AI video sun raha hai… (' + fmt(a) + ' – ' + fmt(b) + ')'; paint();
  try {
    const out = await ask(id, a, b);
    if (!S || S.v !== v) return;
    if (out.title && !v.t) v.t = out.title;
    if (out.sp.length && !(v.sp && v.sp.length)) v.sp = out.sp;
    const first = v.parts.length;
    v.parts.push(...out.parts); v.end = out.end || (!out.parts.length ? 1 : 0); v.next = out.end && out.parts.length ? Math.max(a, ...out.parts.map(p => p.e)) : b;
    store(v); S.busy = false;
    const more = !v.end && !S.halt && n + 1 < MAXAUTO;
    if (first === 0 || !more) paint(); else { append(first); }
    pump();
    if (S.waitNew && out.parts.length) { S.waitNew = false; S.all = true; playPart(first); }
    else if (S.waitNew && !more) { S.waitNew = false; paintBar(); }
    if (more) run(id, v.next, n + 1); else paint();
  } catch (e) { if (S && S.v === v) { S.busy = false; S.waitNew = false; S.err = String(e?.message || e); paint(); pump(); } }
}
async function share() {
  const v = S?.v; if (!v) return;
  const text = (v.t || 'Video') + '\n\n' + v.parts.map(p => linesOf(p).map(l => l[2] || l[1]).join('\n')).join('\n\n');
  try { if (navigator.share) { await navigator.share({ title: v.t || 'Video', text }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); A.notice?.('📋 Likhai copy ho gayi — parhne wali app mein paste karein'); } catch { A.notice?.('Share / copy nahi ho saka'); }
}
async function onClick(e) {
  const d = dlg(); if (!d || !S) return;
  const t = e.target.closest?.('[data-vs],[data-vs-say],[data-vs-old],[data-vs-del]'); if (!t || !d.contains(t)) return;
  const k = t.dataset;
  if (k.vsSay != null) { const i = Number(k.vsSay); if (S.cur === i) toggle(); else { S.all = true; playPart(i); } return; }
  if (k.vsOld) { const o = load()[k.vsOld]; if (!o || S.busy) return; stopPlay(); freeAud(); S.v = { id: o.id, t: o.t, sp: o.sp || [], parts: o.parts || [], next: o.next || 0, end: o.end }; S.url = 'https://youtu.be/' + o.id; S.from = fmt(o.next || 0); S.err = ''; paint(); pump(); return; }
  if (k.vsDel) { if (confirm('Yeh samjhi hui video (aur us ki awaz) list se hata dein?')) { drop(k.vsDel); paint(); } return; }
  const keep = () => { S.url = $('vsUrl')?.value || ''; S.from = $('vsFrom')?.value || ''; };
  if (k.vs === 'x') { close(); return; }
  if (k.vs === 'paste') { try { const x = await navigator.clipboard.readText(); if (x) { keep(); S.url = x.trim(); paint(); } } catch { A.notice?.('Paste ki ijazat nahi mili — link khane mein khud paste karein'); } return; }
  if (k.vs === 'list') { keep(); stopPlay(); freeAud(); S.v = null; S.err = ''; paint(); return; }
  if (k.vs === 'rate') { S.rate = (S.rate + 1) % RATES.length; try { localStorage.setItem('sam-vs-rate', String(S.rate)); } catch {} if (AU) AU.playbackRate = RATES[S.rate][0]; paintBar(); return; }
  if (k.vs === 'all') { if (S.waitNew) { S.waitNew = false; paintBar(); } else if (S.cur >= 0) toggle(); else { S.all = true; playPart(0); } return; }
  if (k.vs === 'halt') { S.halt = true; t.disabled = true; t.textContent = '⏹ Ruk raha…'; return; }
  if (k.vs === 'more') { if (S.v && !S.v.end) run(S.v.id, S.v.next); return; }
  if (k.vs === 'share') { share(); return; }
  if (k.vs === 'go') {
    keep(); const id = vidOf(S.url); if (!id) { S.err = 'YouTube ka sahi link daalein (Share → Copy link).'; paint(); return; }
    const a = secOf(S.from); if (S.v && S.v.id === id && a !== S.v.next) { stopPlay(); freeAud(); S.v = { id, t: S.v.t, sp: S.v.sp, parts: [], next: a, end: 0 }; }
    run(id, a);
  }
}
function shut() { if (!S) return; stopPlay(); freeAud(); try { if (AU) { AU.removeAttribute('src'); AU.load(); } } catch {} S = null; }
function close() { const d = dlg(); shut(); if (d) { try { d.close(); } catch {} d.remove(); } if (window.ntVsClose) window.ntVsClose = null; }
export function open(ctx) {
  A = ctx || {};
  if (!$('vsCss')) { const s = document.createElement('style'); s.id = 'vsCss'; s.textContent = CSS; document.head.appendChild(s); }
  let d = dlg(); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'vsDlg'; d.className = 'vs-dlg'; document.body.appendChild(d);
  let rate = 1; try { const r = Number(localStorage.getItem('sam-vs-rate')); if (r >= 0 && r < RATES.length) rate = r; } catch {}
  S = { url: '', from: '', v: null, busy: false, halt: false, err: '', msg: '', cur: -1, wait: -1, waitNew: false, all: false, paused: false, rate, tok: 0, aud: {}, pumping: false, ttsOff: '', ttsFail: 0, ttsM: null };
  audioSetup();
  d.addEventListener('click', onClick);
  d.addEventListener('close', () => { shut(); d.remove(); });
  try { TTSP()?.getVoices(); } catch {}
  paint();
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntVsClose = () => { close(); return true; };
}
