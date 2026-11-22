// video-sam.js v1.0 (app v2.353.0, 22 Nov 2026) — 🎬 VIDEO SAMJHAO
// Malik: "YouTube ki videos mein bohat se alfaz Hindi mein hain, samajh nahi aati · har 2-3 minute ke hisaab se explain karo · kal ko aur videos bhi hain ·
//   saath audio mein aa jaye". ☰ 🎬 Video samjhao (sirf malik): YouTube ka link + "kahan se" -> 🤖 Gemini (app ki AI key) ko link SEEDHA diya jata hai
//   (file_data.file_uri — video download / upload KAHIN nahi) -> 15-15 minute ke tukre, har 2-3 minute ka hissa aasaan Roman Urdu mein + mushkil lafz ka matlab
//   + Urdu harfon wali likhai sirf AWAZ ke liye (phone ki apni Text-to-Speech, kisi ki awaz ki naqal nahi). Samjhi hui videos sirf isi phone par (localStorage).
// AI: HAAN (Gemini). Sirf public video. Firestore / PC / rules: kuch nahi.
const API = 'https://generativelanguage.googleapis.com/v1beta';
const LS = 'sam-vs-list', STEP = 900, KEEP = 12;
const FALLBACK = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash'];
let A = null, S = null;
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
function parseOut(text, a, b) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i >= 0 && j > i) t = t.slice(i, j + 1);
  const o = JSON.parse(t), L = Array.isArray(o.p) ? o.p : [];
  const parts = L.map(x => ({ s: tsOf(x.s), e: tsOf(x.e), r: String(x.r || '').trim(), u: String(x.u || '').trim(), w: (Array.isArray(x.w) ? x.w : []).filter(y => Array.isArray(y) && y[0] && y[1]).slice(0, 5).map(y => [String(y[0]), String(y[1])]) }))
    .filter(x => x.r).map(x => ({ ...x, s: Math.min(Math.max(x.s, a), b), e: Math.min(Math.max(x.e, a), b) }));
  return { title: String(o.title || '').trim().slice(0, 120), end: Number(o.end) ? 1 : 0, parts };
}
export const _t = { vidOf, secOf, fmt, parseOut };

const load = () => { try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
function store(v) {
  try {
    const o = load(); o[v.id] = { id: v.id, t: v.t || '', parts: v.parts, next: v.next, end: v.end ? 1 : 0, at: Date.now() };
    const ids = Object.keys(o).sort((x, y) => (o[y].at || 0) - (o[x].at || 0));
    for (const k of ids.slice(KEEP)) delete o[k];
    localStorage.setItem(LS, JSON.stringify(o));
  } catch {}
}
const drop = id => { try { const o = load(); delete o[id]; localStorage.setItem(LS, JSON.stringify(o)); } catch {} };

const PROMPT = (a, b) => [
  'Aap ek sabar wale ustaad hain. Sunne wala Pakistani hai: Urdu samajhta hai, Hindi / Sanskrit ke mushkil lafz NAHI samajhta, aur sirf Roman (Latin) harf parh sakta hai.',
  `Is YouTube video ka SIRF ${fmt(a)} se ${fmt(b)} tak ka hissa (second ${a} se ${b}) sunein.`,
  'Is hisse ko 2 se 3 minute ke tukron mein baantein, tarteeb se. Har tukre mein bataein ke us mein kya kaha gaya.',
  'Sirf yeh JSON dein (koi aur likhai nahi):',
  '{"title": "video ka naam", "end": 0, "p": [{"s": 3224, "e": 3380, "r": "…", "u": "…", "w": [["lafz", "matlab"]]}]}',
  '- s, e = tukre ke shuru aur khatam ke SECOND (video ke shuru se, hindse).',
  '- r = aasaan Roman Urdu mein 3 se 6 jumle: bolne wale ne kya kaha, misaal bhi. Hindi / Sanskrit lafz ki jagah aam Urdu lafz (samasya = masla, karan = wajah). Devanagari ya Urdu harf r mein KABHI nahi.',
  '- u = wohi baat Urdu harfon (Arabic script) mein — yeh sirf awaz ke liye hai.',
  '- w = us tukre ke zyada se zyada 4 mushkil Hindi / English lafz Roman mein aur un ka aasaan Urdu matlab Roman mein. Na hon to [].',
  '- Jo video mein nahi kaha gaya wo apni taraf se MAT jorein. Ishtihar / sponsor ka hissa ek jumle mein.',
  `- Agar video ${fmt(b)} se pehle khatam ho jaye to "end": 1. Agar ${fmt(a)} par video pehle hi khatam ho chuki ho to "p": [] aur "end": 1.`
].join('\n');

async function ask(id, a, b, onStatus) {
  const cfg = await A.aiCfg(); if (!cfg || !cfg.key) throw Error('AI key nahi lagi — Settings → AI key.');
  const models = [cfg.model, ...FALLBACK].filter((m, i, L) => m && L.indexOf(m) === i);
  const body = lv => ({
    contents: [{ role: 'user', parts: [{ file_data: { file_uri: 'https://www.youtube.com/watch?v=' + id }, ...(lv < 2 ? { video_metadata: { start_offset: a + 's', end_offset: b + 's' } } : {}) }, { text: PROMPT(a, b) }] }],
    generationConfig: { temperature: 0.2, ...(lv < 3 ? { responseMimeType: 'application/json' } : {}), ...(lv < 1 ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {}) }
  });
  let last = null;
  for (let mi = 0; mi < models.length; mi++) {
    for (let lv = 0; lv < 4; lv++) {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 240000);
      try {
        onStatus?.('🤖 AI video sun raha hai… (' + fmt(a) + ' – ' + fmt(b) + ')' + (mi || lv ? ' · koshish ' + (mi * 4 + lv + 1) : ''));
        const r = await fetch(API + '/models/' + encodeURIComponent(models[mi]) + ':generateContent', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body(lv)) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = String(j?.error?.message || ('HTTP ' + r.status)); last = Error(msg); last.code = r.status;
          if (r.status === 429) throw Object.assign(Error('Google ki muft hadd poori ho gayi — kuch der (ya kal) baad dobara koshish karein.'), { stop: 1 });
          if (r.status === 403 && /permission|private|not\s*(?:public|available)/i.test(msg)) throw Object.assign(Error('Yeh video AI nahi dekh sakta (private / pabandi wali). Sirf public video chalti hai.'), { stop: 1 });
          if (r.status === 404 || /not found|no longer available|not supported for/i.test(msg)) break;
          if (r.status === 400) continue;
          if (r.status >= 500) break;
          throw Object.assign(last, { stop: 1 });
        }
        const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
        if (!text) { last = Error('AI ne khali jawab diya' + (j.promptFeedback?.blockReason ? ' (' + j.promptFeedback.blockReason + ')' : '')); continue; }
        try { return parseOut(text, a, b); } catch (e) { last = Error('AI ka jawab parha nahi gaya — dobara koshish karein.'); continue; }
      } catch (e) {
        if (e?.stop) throw e;
        last = e?.name === 'AbortError' ? Error('AI ne 4 minute mein jawab nahi diya — internet dekhein, phir dobara.') : e;
        if (e?.name === 'AbortError') throw last;
      } finally { clearTimeout(tm); }
    }
  }
  throw last || Error('AI se jawab nahi mila');
}

// ---------- 🔊 awaz (phone ki apni Text-to-Speech) ----------
const TTS = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;
const RATES = [[0.8, 'Aahista'], [1, 'Aam'], [1.25, 'Tez']];
const urVoice = () => { const t = TTS(); if (!t) return null; const L = t.getVoices() || []; return L.find(v => /^ur/i.test(v.lang)) || null; };
function stopTalk() { const t = TTS(); if (S) { S.play = -1; S.all = false; S.tok = (S.tok || 0) + 1; } try { t?.cancel(); } catch {} }
function talk(i, all) {
  const t = TTS(); if (!t || !S?.v) return;
  const p = S.v.parts[i]; if (!p) { stopTalk(); paintBar(); markPlay(); return; }
  try { t.cancel(); } catch {}
  const tok = S.tok = (S.tok || 0) + 1; S.play = i; S.all = !!all;
  const text = p.u || p.r, chunks = text.split(/(?<=[۔.!?؟])\s+/).map(x => x.trim()).filter(Boolean);
  const vc = urVoice(); let k = 0;
  const next = () => {
    if (!S || S.tok !== tok) return;
    if (k >= chunks.length) { if (S.all && i + 1 < S.v.parts.length) talk(i + 1, true); else { S.play = -1; S.all = false; paintBar(); markPlay(); } return; }
    const u = new SpeechSynthesisUtterance(chunks[k++]); u.lang = p.u ? 'ur-PK' : 'en-IN'; if (vc && p.u) u.voice = vc; u.rate = RATES[S.rate][0];
    u.onend = next; u.onerror = ev => { if (ev?.error === 'interrupted' || ev?.error === 'canceled') return; next(); };
    t.speak(u);
  };
  paintBar(); markPlay(); next();
  const el = $('vsDlg')?.querySelector(`[data-vs-part="${i}"]`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function markPlay() { $('vsDlg')?.querySelectorAll('[data-vs-part]').forEach(el => { const on = S && Number(el.dataset.vsPart) === S.play; el.classList.toggle('is-in', on); const b = el.querySelector('[data-vs-say]'); if (b) b.textContent = on ? '⏸' : '▶'; }); }

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
.vs-st{border-radius:12px;padding:9px 11px;font-size:14.5px;font-weight:700;background:#eef4ff;border:1.5px solid #c9d8f5}
.vs-st.bad{background:#fff3f1;border-color:#f1c2bb;color:#8f231b}
.vs-ttl{font-size:15.5px;font-weight:800;line-height:1.3}
.vs-p{background:#fff;border:1.5px solid #dfe6f2;border-radius:14px;padding:9px 11px;display:grid;gap:6px}
.vs-p.is-in{border-color:#2f55a0;box-shadow:0 0 0 3px #2f55a022;background:#f6f9ff}
.vs-ph{display:flex;align-items:center;gap:8px}
.vs-tm{font-size:13.5px;font-weight:800;color:#1d3160;background:#e8eefb;border-radius:999px;padding:3px 10px;text-decoration:none;white-space:nowrap}
html body dialog.vs-dlg .vs-say{margin-left:auto;width:40px;min-height:36px!important;padding:0!important;border-radius:999px!important;border:1px solid #2b4a8a!important;background:linear-gradient(135deg,#2f55a0,#1d3160)!important;color:#fff!important;font-size:15px}
.vs-r{font-size:16.5px;line-height:1.55}
.vs-w{display:flex;flex-wrap:wrap;gap:5px}
.vs-w span{font-size:13.5px;background:#fff8e6;border:1px solid #f0d49a;border-radius:999px;padding:2px 9px}
.vs-w span b{font-weight:800}
.vs-old{display:grid;gap:6px}
.vs-oc{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #dfe6f2;border-radius:12px;padding:8px 10px;min-width:0}
.vs-oc>div{flex:1;min-width:0;cursor:pointer}.vs-oc b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vs-oc small{font-size:12.5px;color:#5b6885}
.vs-bar{flex:none;display:flex;gap:6px;padding:8px 10px;background:#fff;border-top:1px solid #dfe6f2}
`;
const dlg = () => $('vsDlg');
function oldHTML() {
  const o = load(), ids = Object.keys(o).sort((x, y) => (o[y].at || 0) - (o[x].at || 0));
  if (!ids.length) return '';
  return `<div class="vs-note"><b>Pehle samjhi hui videos</b> (sirf is phone par)</div><div class="vs-old">${ids.map(k => `<div class="vs-oc"><div data-vs-old="${esc(k)}"><b>${esc(o[k].t || 'Video ' + k)}</b><small>${(o[k].parts || []).length} hisse · ${fmt(o[k].next || 0)} tak${o[k].end ? ' · poori' : ''}</small></div><button type="button" class="vs-chip" data-vs-del="${esc(k)}" aria-label="Hatao">🗑</button></div>`).join('')}</div>`;
}
function partsHTML(v) {
  return v.parts.map((p, i) => `<div class="vs-p" data-vs-part="${i}"><div class="vs-ph"><a class="vs-tm" href="https://youtu.be/${esc(v.id)}?t=${Math.round(p.s)}" target="_blank" rel="noopener">▶ ${fmt(p.s)} – ${fmt(p.e)}</a><button type="button" class="vs-say" data-vs-say="${i}" aria-label="Sunao">▶</button></div><div class="vs-r">${esc(p.r)}</div>${p.w.length ? `<div class="vs-w">${p.w.map(w => `<span><b>${esc(w[0])}</b> = ${esc(w[1])}</span>`).join('')}</div>` : ''}</div>`).join('');
}
function paint() {
  const d = dlg(); if (!d || !S) return;
  const v = S.v, y = d.querySelector('.vs-scroll')?.scrollTop || 0;
  const form = `<div class="vs-form"><div class="vs-row"><input class="vs-in" id="vsUrl" type="url" inputmode="url" placeholder="YouTube ka link" value="${esc(S.url || '')}"><button type="button" class="vs-chip" data-vs="paste">📋 Paste</button></div>
    <div class="vs-row"><input class="vs-in t" id="vsFrom" type="text" inputmode="numeric" placeholder="0:00" value="${esc(S.from || '')}"><button type="button" class="vs-go" data-vs="go"${S.busy ? ' disabled' : ''}>🎬 Samjhao</button></div>
    <div class="vs-note">"Kahan se" = waqt, jaise <b>53:44</b>. Khali = shuru se. Ek dafa mein 15 minute, har 2-3 minute ka hissa. 🤖 AI (Gemini) — kabhi ghalat bhi samajh sakta hai.</div></div>`;
  const st = S.busy ? `<div class="vs-st">⏳ ${esc(S.msg || 'AI video sun raha hai…')}<div class="vs-note">1-3 minute lag sakte hain. Khirki khuli rakhein.</div></div>` : (S.err ? `<div class="vs-st bad">✕ ${esc(S.err)}</div>` : '');
  const body = v ? `<div class="vs-ttl">${esc(v.t || 'Video')}</div>${partsHTML(v)}${!v.parts.length && !S.busy ? '<div class="vs-note">Is hisse mein kuch nahi mila.</div>' : ''}${v.end ? '<div class="vs-note">✅ Video yahan khatam.</div>' : ''}` : oldHTML();
  d.innerHTML = `<div class="vs-hd"><div><b>🎬 Video samjhao</b><small>YouTube ki video — aasaan Roman Urdu mein + 🔊 awaz</small></div><button type="button" class="vs-x" data-vs="x" aria-label="Band">✕</button></div>
    <div class="vs-scroll">${form}${st}${body}${v && !S.busy ? `<div class="vs-row"><button type="button" class="vs-chip" data-vs="list">‹ Doosri video</button></div>` : ''}</div><div class="vs-bar" id="vsBar"></div>`;
  const sc = d.querySelector('.vs-scroll'); if (sc) sc.scrollTop = y;
  paintBar(); markPlay();
}
function paintBar() {
  const b = $('vsBar'); if (!b || !S) return; const v = S.v;
  if (!v || !v.parts.length) { b.style.display = 'none'; return; }
  b.style.display = '';
  const playing = S.play >= 0;
  b.innerHTML = `<button type="button" class="vs-go" data-vs="all">${playing ? '⏸ Rok do' : '▶ Sab sunao'}</button><button type="button" class="vs-chip" data-vs="rate">🐢 ${RATES[S.rate][1]}</button>${v.end ? '' : `<button type="button" class="vs-chip" data-vs="more"${S.busy ? ' disabled' : ''}>➡ Aage 15 min</button>`}`;
}
async function run(id, a) {
  if (S.busy) return;
  stopTalk();
  if (!S.v || S.v.id !== id) { const o = load()[id]; S.v = o && a === (o.next || 0) ? { id, t: o.t, parts: o.parts || [], next: o.next || 0, end: o.end } : { id, t: '', parts: [], next: a, end: 0 }; }
  const b = a + STEP; S.busy = true; S.err = ''; S.msg = 'AI video sun raha hai… (' + fmt(a) + ' – ' + fmt(b) + ')'; paint();
  try {
    const out = await ask(id, a, b, m => { S.msg = m.replace(/^🤖\s*/, ''); const el = dlg()?.querySelector('.vs-st'); if (el && S.busy) el.firstChild.textContent = '⏳ ' + S.msg; });
    if (!S || !S.v || S.v.id !== id) return;
    if (out.title && !S.v.t) S.v.t = out.title;
    const first = S.v.parts.length;
    S.v.parts.push(...out.parts); S.v.end = out.end || (!out.parts.length ? 1 : 0); S.v.next = out.end ? Math.max(a, ...out.parts.map(p => p.e)) : b;
    store(S.v); S.busy = false; paint();
    dlg()?.querySelector(`[data-vs-part="${first}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (out.parts.length && !urVoice() && TTS() && !S.vWarn) { S.vWarn = 1; A.notice?.('🔊 Phone mein Urdu awaz nahi mili — Settings → Text-to-speech → Google → Urdu install karein (awaz phir bhi chal sakti hai).'); }
  } catch (e) { if (S) { S.busy = false; S.err = String(e?.message || e); paint(); } }
}
async function onClick(e) {
  const d = dlg(); if (!d || !S) return;
  const t = e.target.closest?.('[data-vs],[data-vs-say],[data-vs-old],[data-vs-del]'); if (!t || !d.contains(t)) return;
  const k = t.dataset;
  if (k.vsSay != null) { const i = Number(k.vsSay); if (S.play === i) { stopTalk(); paintBar(); markPlay(); } else talk(i, false); return; }
  if (k.vsOld) { const o = load()[k.vsOld]; if (!o) return; stopTalk(); S.v = { id: o.id, t: o.t, parts: o.parts || [], next: o.next || 0, end: o.end }; S.url = 'https://youtu.be/' + o.id; S.from = fmt(o.next || 0); S.err = ''; paint(); return; }
  if (k.vsDel) { if (confirm('Yeh samjhi hui video list se hata dein?')) { drop(k.vsDel); paint(); } return; }
  const keep = () => { S.url = $('vsUrl')?.value || ''; S.from = $('vsFrom')?.value || ''; };
  if (k.vs === 'x') { close(); return; }
  if (k.vs === 'paste') { try { const x = await navigator.clipboard.readText(); if (x) { keep(); S.url = x.trim(); paint(); } } catch { A.notice?.('Paste ki ijazat nahi mili — link khane mein khud paste karein'); } return; }
  if (k.vs === 'list') { keep(); stopTalk(); S.v = null; S.err = ''; paint(); return; }
  if (k.vs === 'rate') { S.rate = (S.rate + 1) % RATES.length; try { localStorage.setItem('sam-vs-rate', String(S.rate)); } catch {} paintBar(); if (S.play >= 0) talk(S.play, S.all); return; }
  if (k.vs === 'all') { if (S.play >= 0) { stopTalk(); paintBar(); markPlay(); } else talk(0, true); return; }
  if (k.vs === 'more') { if (S.v && !S.v.end) run(S.v.id, S.v.next); return; }
  if (k.vs === 'go') {
    keep(); const id = vidOf(S.url); if (!id) { S.err = 'YouTube ka sahi link daalein (Share → Copy link).'; paint(); return; }
    const a = secOf(S.from); if (S.v && S.v.id === id && a !== S.v.next) S.v = null;
    if (!S.v || S.v.id !== id) { const o = load()[id]; if (!(o && a === (o.next || 0))) S.v = { id, t: o?.t || '', parts: [], next: a, end: 0 }; }
    run(id, a);
  }
}
function close() { stopTalk(); const d = dlg(); if (d) { try { d.close(); } catch {} d.remove(); } S = null; if (window.ntVsClose) window.ntVsClose = null; }
export function open(ctx) {
  A = ctx || {};
  if (!$('vsCss')) { const s = document.createElement('style'); s.id = 'vsCss'; s.textContent = CSS; document.head.appendChild(s); }
  let d = dlg(); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'vsDlg'; d.className = 'vs-dlg'; document.body.appendChild(d);
  let rate = 1; try { const r = Number(localStorage.getItem('sam-vs-rate')); if (r >= 0 && r < RATES.length) rate = r; } catch {}
  S = { url: '', from: '', v: null, busy: false, err: '', msg: '', play: -1, all: false, rate, tok: 0 };
  d.addEventListener('click', onClick);
  d.addEventListener('close', () => { stopTalk(); d.remove(); S = null; });
  try { TTS()?.getVoices(); } catch {}
  paint();
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntVsClose = () => { close(); return true; };
}
