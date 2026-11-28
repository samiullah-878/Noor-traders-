// shot-diary.js v1.0 (app v2.397.0, 27 Nov 2026) — 📸 SCREENSHOT DIARY
// Malik 27 Nov: "is tarah ka screenshot auto upload ho jaye · in ki detail bhi likh dijiye meri apps mein" + chuna "2" (har screenshot, AI khud chhaante)
//   + "Blue Khata wala nahi · bank wala nahi · Chrome wala nahi · video ka link / video kis ki hai · recipe ho to recipe · bachon ka cardboard ho to wo likh de".
// Phone (md/tools/shot.py '📸 Screenshot diary', MacroDroid) har nayi screenshot (Blue Khata / bank / Chrome chhor kar) chhoti kar ke Firestore
//   shotIn/<id> {k, im, at, pk, fn, st 'new'} mein (chaabi = blueAccess/awazKey, rules 2.114) -> yeh app (sirf malik: ☰ 📸 Screenshot diary khule, ya app khulne
//   ke 25 s baad peeche) 🤖 Gemini se detail -> shotNote/<id> {at, t, j JSON, th chhoti tasveer, hid, pk}; shotIn.st 'ok' (asal tasveer wahin — 🖼 par khulti).
// 🔒 Bank / Blue Khata / Chrome ka package aaye ya AI kahe 'private' = tasveer KHUD mit (kuch save nahi). 'skip' (kaam ki baat nahi) = ♻️ Chhupi (wapas la sakte).
// Video ka asal link screenshot mein nahi hota — likha ho to 🔗; warna video kis ki (@naam) + us ka profile / 🔎 dhoondo link.
// Recipe = cheezein + tareeqa; bachon ka craft / cardboard = saman + qadam ('🤖 andaza' jab tasveer mein poora na ho).
// AI: haan — sirf detail nikalne mein (malik ki Gemini key, A.aiImage). Phone par AI nahi.
import { smartFind } from './dukan/dhoond.js?v=2.401.0';

let A = null, S = null, NOTES = null, RUN = null, ST = '', BAD = new Set();
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const withT = (p, ms, why) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Error(why)), ms))]);
const msg = e => String(e?.message || e || '').slice(0, 140);
const dlg = () => $('sdDlg');
const KINDS = [['jagah', '📍', 'Jagah / dukan'], ['video', '🎬', 'Video'], ['recipe', '🍲', 'Recipe'], ['bachon', '🧒', 'Bachon ka'], ['cheez', '📦', 'Cheez'], ['rabta', '📇', 'Rabta'], ['khabar', '📰', 'Khabar']];
const KI = Object.fromEntries(KINDS.map(k => [k[0], k]));
const icOf = t => (KI[t] || ['', '📌'])[1];
// 🔒 phone ka package — yeh kabhi save nahi (phone ka macro bhi inhein nahi bhejta; yeh doosri hifazat)
const PRIV = ['org.chromium.webapk', 'com.android.chrome', 'com.chrome.', 'com.google.android.apps.chrome', 'com.hbl.', 'com.ofss.digx', 'com.alhabib', 'com.base.bankalfalah', 'com.techlogix.mobilinkcustomer', 'pk.com.telenor.phoenix', 'com.ubl.', 'com.meezan', 'com.mcb', 'com.bankislami', 'com.askari', 'com.nbp', 'com.bop', 'com.scb.', 'com.faysal', 'pk.com.hbl'];
const privPk = pk => { const p = String(pk || '').toLowerCase(); return !!p && PRIV.some(x => p.startsWith(x)); };

export const PROMPT = `Yeh ek phone ka screenshot hai. Is mein jo KAAM KI baat hai woh nikaalo taake malik baad mein dhoond sake.
Sirf JSON do (koi aur likhai nahi):
{"t":"jagah|video|recipe|bachon|cheez|rabta|khabar|skip|private",
"nm":"naam — dukan / jagah / cheez / video ka unwan (chhota)",
"kaam":"kya hai — 2 se 8 lafz",
"sum":"2-3 jumle: kya dikh raha hai, kaam ki baat kya hai",
"pata":"poora pata jaisa likha", "shehar":"", "ph":["phone number jaise likhe"], "web":["website / link jo likha ho"],
"app":"kis app ka screenshot (TikTok / Instagram / Facebook / YouTube / WhatsApp / Daraz ... ya khali)",
"by":"video / post kis ki hai — account ka @naam ya channel ka naam",
"tags":["#hashtag"], "daam":"rate / qeemat agar likhi ho",
"rec":{"ing":["cheez + miqdar"],"st":["qadam"],"az":0},
"kr":{"mat":["saman"],"st":["qadam"],"az":0}}
Qaide:
- Sab Roman Urdu (Latin harf) mein — Urdu / Hindi harf KABHI nahi. Naam / pata / number jaise likhe waise (Urdu likha ho to Roman mein).
- Jo nazar na aaye woh khali chhoro — andaza nahi. ph mein sirf asal number jo likha ho.
- t: "jagah" = dukan / spa / hotel / restaurant / koi service ka ishtehar ya pata · "video" = video / reel (bina pata) · "recipe" = khana pakane ka tareeqa ·
  "bachon" = bachon ka khel / craft / cardboard / khilona / padhai · "cheez" = koi product / saman · "rabta" = kisi ka number / card · "khabar" = khabar / maloomat.
- rec sirf t "recipe" par: cheezein + tareeqa jo tasveer mein likha / dikha ho; poora na ho to aam tareeqa likh do aur "az":1.
- kr sirf t "bachon" par (cardboard / craft / khilona banana): saman + qadam; poora na ho to "az":1.
- "private" = bank app / paison ka hisaab / OTP / password / khata app (Blue Khata) / Chrome browser — is par baqi sab khali.
- "skip" = kuch kaam ka nahi (khali screen, game, settings, aam chat).`;

// ---------- 🤖 AI ka jawab ----------
const arr = (v, n, m) => (Array.isArray(v) ? v : (v ? [v] : [])).map(x => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, n).map(x => x.slice(0, m));
const str = (v, m) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, m);
export function parseAi(raw) {
  let t = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw Error('AI ka jawab samajh nahi aaya');
  const o = JSON.parse(t.slice(a, b + 1));
  const kind = String(o.t || '').toLowerCase().trim();
  const out = { t: ['private', 'skip', ...KINDS.map(k => k[0])].includes(kind) ? kind : (o.nm || o.sum ? 'cheez' : 'skip'),
    nm: str(o.nm, 90), kaam: str(o.kaam, 90), sum: str(o.sum, 500), pata: str(o.pata, 200), shehar: str(o.shehar, 50),
    ph: arr(o.ph, 4, 30).filter(x => (x.replace(/\D/g, '').length >= 7)), web: arr(o.web, 4, 200), app: str(o.app, 30), by: str(o.by, 60),
    tags: arr(o.tags, 8, 40), daam: str(o.daam, 60) };
  if (out.t === 'recipe' && o.rec) out.rec = { ing: arr(o.rec.ing, 30, 120), st: arr(o.rec.st, 30, 300), az: o.rec.az ? 1 : 0 };
  if (out.t === 'bachon' && o.kr) out.kr = { mat: arr(o.kr.mat, 30, 120), st: arr(o.kr.st, 30, 300), az: o.kr.az ? 1 : 0 };
  if (/[؀-ۿऀ-ॿ]/.test(JSON.stringify(out))) out.ur = 1;   // Urdu / Hindi harf aa gaye (AI ne qaida toda) — sirf nishan, dikhate hain
  return out;
}
export function waOf(ph) {   // 0300 1234567 -> 923001234567 · +966… waise hi
  let d = String(ph || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('03')) return '92' + d.slice(1);
  if (d.length === 10 && d.startsWith('3')) return '92' + d;
  return d.length >= 10 ? d : '';
}
export function byLink(by, app) {   // video / post kis ki — us ka profile
  const b = String(by || '').trim(), h = b.replace(/^@/, '').replace(/\s+/g, ''), a = String(app || '').toLowerCase();
  if (!b) return '';
  if (/^@?[A-Za-z0-9._]{2,40}$/.test(b)) {
    if (a.includes('tiktok')) return 'https://www.tiktok.com/@' + h;
    if (a.includes('insta')) return 'https://www.instagram.com/' + h;
    if (a.includes('youtube')) return 'https://www.youtube.com/@' + h;
  }
  if (a.includes('youtube')) return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(b);
  if (a.includes('facebook')) return 'https://www.facebook.com/search/top?q=' + encodeURIComponent(b);
  return 'https://www.google.com/search?q=' + encodeURIComponent(b + ' ' + (app || ''));
}
function vidSearch(o) {
  const q = [o.by, o.nm].filter(Boolean).join(' ').trim(); if (!q) return '';
  const a = String(o.app || '').toLowerCase();
  if (a.includes('tiktok')) return 'https://www.tiktok.com/search?q=' + encodeURIComponent(q);
  if (a.includes('insta')) return 'https://www.instagram.com/explore/search/keyword/?q=' + encodeURIComponent(q);
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}
const webUrl = w => (/^https?:\/\//i.test(w) ? w : (/^[\w-]+(\.[\w-]+)+/.test(w) ? 'https://' + w : ''));

// ---------- 🖼 chhoti tasveer (list ke liye) ----------
function thumb(b64) {
  return new Promise(ok => {
    const im = new Image();
    im.onload = () => { try { const w = 140, h = Math.min(Math.round(im.height * w / im.width), 420); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, Math.round(im.height * w / im.width)); ok(c.toDataURL('image/jpeg', 0.6).split(',')[1] || ''); } catch { ok(''); } };
    im.onerror = () => ok(''); im.src = 'data:image/jpeg;base64,' + b64;
  });
}

// ---------- ⏳ nayi screenshots parho ----------
async function one(it) {
  const c = A.cloud;
  if (!it.b64) { await c.delShotIn(it.id); return 'khali'; }
  if (privPk(it.pk)) { await c.delShotIn(it.id); return 'private'; }   // phone ne galti se bheji — AI se pehle hi mit
  if (!A.aiImage) throw Error('AI tayyar nahi');
  const raw = await withT(A.aiImage(it.b64, PROMPT), 70000, 'AI ne 70 sec mein jawab nahi diya');
  const o = parseAi(raw);
  if (o.t === 'private') { await c.delShotIn(it.id); if (NOTES) NOTES = NOTES.filter(n => n.id !== it.id); return 'private'; }
  const th = await thumb(it.b64);
  const note = { at: it.at || Date.now(), t: o.t, j: JSON.stringify(o), hid: o.t === 'skip' ? 1 : 0, pk: it.pk || '', th };
  await c.saveShotNote(it.id, note);
  try { await c.setShotSt(it.id, 'ok'); } catch {}
  if (NOTES) { NOTES = NOTES.filter(n => n.id !== it.id); NOTES.unshift({ id: it.id, ...note, o }); }
  return o.t;
}
async function runPending(max) {
  if (RUN) return RUN;
  RUN = (async () => {
    let n = 0, ok = 0, priv = 0, fail = 0, last = '';
    try {
      for (let round = 0; round < 8 && n < max; round++) {
        let L; try { L = await withT(A.cloud.listShotNew(4), 20000, 'net'); } catch (e) { last = 'Firestore: ' + msg(e); break; }
        L = (L || []).filter(x => !BAD.has(x.id)); if (!L.length) break;
        for (const it of L) {
          if (n >= max) break; n++;
          ST = `⏳ ${n} · 🤖 nayi screenshot ki detail ban rahi…`; stPaint();
          try { const r = await one(it); if (r === 'private' || r === 'khali') priv++; else ok++; listPaint(); }
          catch (e) { fail++; BAD.add(it.id); last = msg(e); }
        }
      }
    } finally {
      ST = fail ? `✕ ${fail} screenshot ki detail nahi bani — ${last}` + (ok ? ` · ✅ ${ok} ban gayin` : '')
        : (ok || priv ? `✅ ${ok} nayi screenshot${priv ? ` · 🔒 ${priv} bank / khata wali khud mita di` : ''}` : (last ? '✕ ' + last : ''));
      stPaint(); RUN = null;
    }
    return { ok, priv, fail };
  })();
  return RUN;
}

// ---------- 📲 phone ko link + chaabi (wahi ntU / ntK jo ✍️ Likho / qoul istemal karte hain) ----------
async function phoneLink(force) {
  const say = m => { if (force) A.notice?.(m); };
  try {
    const c = A.cloud; let k = String((await c.getAwazKey?.()) || '');
    if (k.length < 16 && c.setAwazKey) { const a = new Uint8Array(18); crypto.getRandomValues(a); k = Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 32); await c.setAwazKey(k); }
    if (k.length < 16) { say('✕ Chaabi nahi bani'); return; }
    const C = (await c.getFxCfg?.()) || {}, m = String(C.wh || '').trim().match(/^(https:\/\/trigger\.macrodroid\.com\/[A-Za-z0-9_-]{6,})\//);
    if (!m) { say('✕ Phone ka webhook link nahi mila — Gaari → ⚙️ Falcon setup mein MacroDroid ka link lagayein'); return; }
    const sig = new Date().toISOString().slice(0, 10) + '|' + k.slice(0, 5) + '|' + m[1].slice(-5);
    if (!force) { try { if (localStorage.getItem('sam-sd-ntk') === sig) return; } catch {} }
    const u = `https://firestore.googleapis.com/v1/projects/${A.projectId}/databases/(default)/documents/businesses/noor-traders/awazNotes?key=${A.apiKey}`;
    await withT(fetch(m[1] + '/nt_shot?ntU=' + encodeURIComponent(u) + '&ntK=' + encodeURIComponent(k) + '&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' }), 12000, 'net');
    try { localStorage.setItem('sam-sd-ntk', sig); } catch {}
    say('📲 Phone ko link bhej diya — ab screenshot lein, thori der mein yahan aayegi');
  } catch (e) { say('✕ Phone ko nahi gaya: ' + msg(e)); }
}

// ---------- 👀 peeche (app khulne par) ----------
export async function bg(ctx) {
  if (!A) A = ctx || {}; else if (ctx) Object.assign(A, ctx);
  if (!A.cloud?.listShotNew) return;
  phoneLink(false);
  try { await runPending(6); } catch {}
}

// ---------- 🖥 screen ----------
const CSS = `
dialog.sd-dlg{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;border:0;padding:0;background:#f4f7fc;color:#1b2b4b;overflow:hidden}
dialog.sd-dlg[open]{display:flex;flex-direction:column}
@media (min-width:900px){dialog.sd-dlg{inset:3% 24%;border-radius:20px;box-shadow:0 24px 60px rgba(10,20,50,.35)}}
dialog.sd-dlg::backdrop{background:rgba(8,16,40,.5)}
.sd-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(135deg,#243f77,#1d3160);color:#fff;flex:none}
.sd-hd>div{flex:1 1 auto;min-width:0}.sd-hd b{font-size:17px}.sd-hd small{display:block;font-size:12.5px;opacity:.85;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html body dialog.sd-dlg button{font-family:inherit}
html body dialog.sd-dlg .sd-x{flex:none;width:36px;min-height:36px!important;padding:0!important;border-radius:999px!important;border:1px solid #ffffff55!important;background:#ffffff1f!important;color:#fff!important;font-size:16px}
html body dialog.sd-dlg .sd-x.sd-bk{font-size:24px;line-height:1;padding-bottom:3px!important}html body dialog.sd-dlg .sd-x:focus:not(:focus-visible){outline:none}
.sd-hb{display:flex;gap:6px;flex:none}
.sd-scroll{flex:1 1 auto;overflow-y:auto;padding:10px;display:grid;grid-template-columns:minmax(0,1fr);gap:7px;align-content:start}
html body dialog.sd-dlg .sd-in{width:100%;min-height:40px!important;border-radius:999px!important;border:1.5px solid #c9d4e8!important;padding:4px 14px!important;font-size:16px!important;background:#fff!important;color:#1b2b4b!important;box-sizing:border-box}
html body dialog.sd-dlg .sd-chip{flex:none;min-height:34px!important;padding:3px 12px!important;border-radius:999px!important;border:1px solid #c9d4e8!important;background:linear-gradient(180deg,#fff,#eef3fb)!important;color:#1d3160!important;font-size:13.5px!important;font-weight:700;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px}
html body dialog.sd-dlg .sd-chip.is-in{background:linear-gradient(135deg,#2a4a8c,#1d3160)!important;color:#fff!important;border-color:#1d3160!important}
html body dialog.sd-dlg .sd-chip.red{color:#8f231b!important;border-color:#f1c2bb!important;background:linear-gradient(180deg,#fff,#fff3f1)!important}
html body dialog.sd-dlg .sd-chip.grn{color:#0d6b3c!important;border-color:#b5e2c7!important;background:linear-gradient(180deg,#fff,#eefaf2)!important}
.sd-menu{border:1px solid #c9d4e8;border-radius:16px;background:linear-gradient(180deg,#fff,#f3f6fc);padding:10px 12px;display:grid;gap:8px}
.sd-mt{font-weight:800;font-size:14.5px;color:#1d3160}.sd-mv{display:flex;flex-wrap:wrap;gap:6px}
.sd-note{font-size:12.5px;color:#5b6885;line-height:1.4}
.sd-st{border-radius:12px;padding:7px 11px;font-size:13.5px;font-weight:700;background:#eef4ff;border:1.5px solid #c9d8f5}
.sd-st.bad{background:#fff3f1;border-color:#f1c2bb;color:#8f231b}
.sd-pat{font-size:12.5px;color:#5b6885;font-weight:700;padding:0 4px}
.sd-c{display:grid;grid-template-columns:44px minmax(0,1fr);gap:9px;align-items:center;background:#fff;border:1.5px solid #dfe6f2;border-radius:14px;padding:6px 9px 6px 6px;cursor:pointer}
.sd-c.is-in{border-color:#2f55a0;box-shadow:0 0 0 3px #2f55a022}
.sd-th{width:44px;height:58px;object-fit:cover;object-position:top;border-radius:9px;background:#e8eefb;display:block}
.sd-th.e{display:grid;place-items:center;font-size:20px}
.sd-m{min-width:0}
.sd-l1{display:flex;align-items:center;gap:6px;min-width:0}.sd-l1 b{flex:1;min-width:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-l1 small{flex:none;font-size:11.5px;color:#7a869f;font-weight:700}
.sd-l2{font-size:13px;color:#4a5a7a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.sd-x2{grid-column:1/-1;display:grid;gap:7px;padding:4px 2px 2px;cursor:default}
.sd-sum{font-size:15px;line-height:1.45}
.sd-kv{font-size:14px;line-height:1.4}.sd-kv b{color:#243f77}
.sd-row{display:flex;flex-wrap:wrap;gap:6px}
.sd-h{font-weight:800;font-size:14.5px;color:#1d3160;margin-top:2px}
.sd-ol{margin:0;padding-left:22px;display:grid;gap:4px;font-size:15px;line-height:1.45}
.sd-az{font-size:12.5px;color:#8a5a00;background:#fff8e6;border:1px solid #f0d49a;border-radius:999px;padding:2px 9px;justify-self:start}
.sd-tags{font-size:12.5px;color:#2f55a0}
.sd-big{position:fixed;inset:0;background:#0b1224f2;display:flex;align-items:center;justify-content:center;z-index:5}
.sd-big img{max-width:100%;max-height:100%;object-fit:contain}
html body dialog.sd-dlg .sd-big .sd-x{position:absolute;top:10px;right:10px}
.sd-empty{font-size:14px;color:#5b6885;line-height:1.5;background:#fff;border:1.5px dashed #c9d4e8;border-radius:14px;padding:12px}
`;
const fmtD = at => { if (!at) return ''; const d = new Date(at), t = new Date(), y = new Date(Date.now() - 864e5); const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === t.toDateString()) return hm; if (d.toDateString() === y.toDateString()) return 'Kal ' + hm; return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' }); };
const oOf = n => { if (!n.o) { try { n.o = JSON.parse(n.j || '{}') || {}; } catch { n.o = {}; } } return n.o; };
const txtOf = n => { const o = oOf(n); return [o.nm, o.kaam, o.sum, o.pata, o.shehar, (o.ph || []).join(' '), o.app, o.by, (o.tags || []).join(' '), o.daam, (o.rec?.ing || []).join(' '), (o.kr?.mat || []).join(' ')].join(' '); };
function rows() {
  let L = (NOTES || []).filter(n => S.f === 'hid' ? n.hid : !n.hid);
  if (S.f !== 'all' && S.f !== 'hid') L = L.filter(n => n.t === S.f);
  const q = String(S.q || '').trim();
  if (q) { const r = smartFind(L, q, txtOf, n => 'sd' + n.id); L = r.hits.length ? r.hits : r.near; }
  return L;
}
function cardHTML(n) {
  const o = oOf(n), open = S.open === n.id, ph = o.ph || [];
  const l2 = [o.kaam, o.shehar, ph.length ? '📞 ' + ph[0] : '', o.by && o.t === 'video' ? '👤 ' + o.by : '', o.app].filter(Boolean).join(' · ');
  return `<div class="sd-c${open ? ' is-in' : ''}" data-sd-c="${esc(n.id)}">${n.th ? `<img class="sd-th" src="data:image/jpeg;base64,${n.th}" alt="">` : `<div class="sd-th e">${icOf(n.t)}</div>`}
    <div class="sd-m"><div class="sd-l1"><span>${icOf(n.t)}</span><b>${esc(o.nm || o.kaam || 'Screenshot')}</b><small>${esc(fmtD(n.at))}</small></div><div class="sd-l2">${esc(l2 || o.sum || '')}</div></div>
    ${open ? openHTML(n, o) : ''}</div>`;
}
function openHTML(n, o) {
  const ph = o.ph || [], wa = ph.map(waOf).find(Boolean), mapQ = [o.pata || (o.t === 'jagah' ? o.nm : ''), o.shehar].filter(Boolean).join(' ').trim();
  const chips = [];
  ph.slice(0, 3).forEach(p => chips.push(`<a class="sd-chip grn" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">📞 ${esc(p)}</a>`));
  if (wa) chips.push(`<a class="sd-chip grn" href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
  if (mapQ) chips.push(`<a class="sd-chip" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQ)}" target="_blank" rel="noopener">🗺 Map</a>`);
  (o.web || []).map(webUrl).filter(Boolean).slice(0, 3).forEach(u => chips.push(`<a class="sd-chip" href="${esc(u)}" target="_blank" rel="noopener">🔗 ${esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28))}</a>`));
  const bl = byLink(o.by, o.app); if (bl) chips.push(`<a class="sd-chip" href="${esc(bl)}" target="_blank" rel="noopener">👤 ${esc(o.by.slice(0, 24))}</a>`);
  const vs = (o.t === 'video' || o.by) ? vidSearch(o) : ''; if (vs) chips.push(`<a class="sd-chip" href="${esc(vs)}" target="_blank" rel="noopener">🔎 Video dhoondo</a>`);
  chips.push(`<button type="button" class="sd-chip" data-sd-cp="${esc(n.id)}">📋 Copy</button>`);
  const list = (h, L) => L && L.length ? `<div class="sd-h">${h}</div><ol class="sd-ol">${L.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
  return `<div class="sd-x2">
    ${o.sum ? `<div class="sd-sum">${esc(o.sum)}</div>` : ''}
    ${o.pata || o.shehar ? `<div class="sd-kv"><b>📍 Pata:</b> ${esc([o.pata, o.shehar].filter(Boolean).join(', '))}</div>` : ''}
    ${o.by ? `<div class="sd-kv"><b>👤 Kis ki:</b> ${esc(o.by)}${o.app ? ' · ' + esc(o.app) : ''}</div>` : (o.app ? `<div class="sd-kv"><b>📱 App:</b> ${esc(o.app)}</div>` : '')}
    ${o.daam ? `<div class="sd-kv"><b>💰 Rate:</b> ${esc(o.daam)}</div>` : ''}
    ${o.rec ? list('🍲 Cheezein', o.rec.ing) + list('👩‍🍳 Tareeqa', o.rec.st) + (o.rec.az ? '<span class="sd-az">🤖 Tasveer mein poora nahi tha — baqi AI ka andaza</span>' : '') : ''}
    ${o.kr ? list('✂️ Saman', o.kr.mat) + list('🧒 Kaise banayein', o.kr.st) + (o.kr.az ? '<span class="sd-az">🤖 Tasveer mein poora nahi tha — baqi AI ka andaza</span>' : '') : ''}
    ${(o.tags || []).length ? `<div class="sd-tags">${esc(o.tags.join(' '))}</div>` : ''}
    ${o.t === 'video' && !(o.web || []).length ? '<div class="sd-note">Video ka asal link screenshot mein nahi hota — upar 👤 se us ka account, 🔎 se video dhoondein.</div>' : ''}
    <div class="sd-row">${chips.join('')}</div>
    <div class="sd-row"><button type="button" class="sd-chip" data-sd-big="${esc(n.id)}">🖼 Poori tasveer</button><button type="button" class="sd-chip" data-sd-hid="${esc(n.id)}">${n.hid ? '↩ Wapas list mein' : '🙈 Chhupao'}</button><button type="button" class="sd-chip red" data-sd-del="${esc(n.id)}">🗑 Hatao</button></div>
  </div>`;
}
function menuHTML() {
  const L = NOTES || [], cnt = k => L.filter(n => !n.hid && n.t === k).length, hid = L.filter(n => n.hid).length;
  const f = (k, t) => `<button type="button" class="sd-chip${S.f === k ? ' is-in' : ''}" data-sd-f="${k}">${t}</button>`;
  return `<div class="sd-menu"><div class="sd-mt">📂 Dikhao</div><div class="sd-mv">${f('all', 'Sab (' + L.filter(n => !n.hid).length + ')')}${KINDS.filter(k => cnt(k[0])).map(k => f(k[0], k[1] + ' ' + k[2] + ' (' + cnt(k[0]) + ')')).join('')}${hid ? f('hid', '♻️ Chhupi (' + hid + ')') : ''}</div>
    <div class="sd-mt">🧰 Kaam</div><div class="sd-mv"><button type="button" class="sd-chip" data-sd="run">🔄 Nayi abhi dekho</button><button type="button" class="sd-chip" data-sd="link">📲 Phone ko link bhejo</button><button type="button" class="sd-chip" data-sd="pdf">📄 PDF</button></div>
    <div class="sd-note">Phone par jo bhi screenshot lein, khud yahan aati hai — Blue Khata, bank aur Chrome wali kabhi nahi. 🤖 AI (Gemini) sirf detail likhta hai; kaam ki na ho to ♻️ Chhupi mein, bank / khata jaisi lage to khud mita deta hai.</div></div>`;
}
const fLab = () => S.f === 'all' ? 'Sab' : S.f === 'hid' ? '♻️ Chhupi' : (KI[S.f] ? KI[S.f][1] + ' ' + KI[S.f][2] : S.f);
function stPaint() {
  const e = $('sdSt'); if (!e || !S) return;
  e.innerHTML = ST ? `<div class="sd-st${ST.startsWith('✕') ? ' bad' : ''}">${esc(ST)}</div>` : '';
  const sub = $('sdSub'); if (sub) sub.textContent = NOTES ? `${NOTES.filter(n => !n.hid).length} screenshot · 🤖 AI se detail` : 'Load ho raha…';
}
function listPaint() {
  const e = $('sdList'); if (!e || !S) return;
  if (!NOTES) { e.innerHTML = '<div class="sd-note">⏳ Load ho raha…</div>'; return; }
  const L = rows();
  e.innerHTML = `<div class="sd-pat">${esc(fLab())} · ${L.length}${S.q ? ' mile' : ''} · ⋮ se badlein</div>` + (L.length ? L.slice(0, 300).map(cardHTML).join('')
    : `<div class="sd-empty">${NOTES.length ? 'Is mein kuch nahi.' : '📸 Abhi koi screenshot nahi aayi.<br>Phone par kisi bhi app (TikTok, Instagram, YouTube, WhatsApp…) mein screenshot lein — thori der mein yahan detail ke saath aa jayegi. Blue Khata, bank aur Chrome ki screenshot nahi aati.'}</div>`);
  stPaint();
}
function paint() {
  const d = dlg(); if (!d || !S) return;
  const q = $('sdQ'), qf = !!q && document.activeElement === q; if (q) S.q = q.value;
  d.innerHTML = `<div class="sd-hd"><button type="button" class="sd-x sd-bk" data-sd="back" aria-label="Wapas">‹</button><div><b>📸 Screenshot diary</b><small id="sdSub"></small></div><span class="sd-hb"><button type="button" class="sd-x" data-sd="menu" aria-label="Mazeed">⋮</button><button type="button" class="sd-x" data-sd="x" aria-label="Band">✕</button></span></div>
    <div class="sd-scroll">${S.menu ? menuHTML() : ''}<input class="sd-in" id="sdQ" type="search" placeholder="🔍 Dhoondo — naam, shehar, number, recipe…" value="${esc(S.q || '')}"><div id="sdSt"></div><div id="sdList" style="display:grid;gap:7px"></div></div>
    ${S.big ? `<div class="sd-big" data-sd="bigx"><img src="${S.big}" alt=""><button type="button" class="sd-x" data-sd="bigx" aria-label="Band">✕</button></div>` : ''}`;
  listPaint();
  if (qf) { const q2 = $('sdQ'); if (q2) { try { q2.focus({ preventScroll: true }); q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
}
async function load(fromCache) {
  try {
    const L = (await A.cloud.listShotNotes(fromCache)) || [];
    if (fromCache && !L.length) return;   // phone mein yaad nahi — server ka intezar (khali 'koi nahi' ki jhalak nahi)
    const keep = new Map((NOTES || []).map(n => [n.id, n]));
    NOTES = L.map(n => Object.assign(keep.get(n.id) || {}, n, { o: null }));
  } catch (e) { if (!fromCache && !NOTES) { NOTES = []; ST = '✕ List nahi khuli: ' + msg(e); } }
  if (S) listPaint();
}
function stepBack() {
  if (!S) return false;
  if (S.big) { S.big = ''; paint(); return true; }
  if (S.menu) { S.menu = false; paint(); return true; }
  if (S.open) { S.open = ''; listPaint(); return true; }
  return false;
}
function close() { const d = dlg(); S = null; if (d) { try { d.close(); } catch {} d.remove(); } }
function pdf() {
  const L = rows(); if (!L.length) { A.notice?.('Is mein kuch nahi'); return; }
  const tr = L.map(n => { const o = oOf(n); const extra = [o.rec ? 'Cheezein: ' + (o.rec.ing || []).join(', ') + ' — Tareeqa: ' + (o.rec.st || []).join(' / ') : '', o.kr ? 'Saman: ' + (o.kr.mat || []).join(', ') + ' — Qadam: ' + (o.kr.st || []).join(' / ') : ''].filter(Boolean).join('<br>');
    return `<tr><td>${esc(fmtD(n.at))}</td><td><b>${esc(icOf(n.t) + ' ' + (o.nm || o.kaam || ''))}</b><br>${esc(o.sum || '')}${extra ? '<br>' + esc(extra).replace(/&lt;br&gt;/g, '<br>') : ''}</td><td>${esc([o.pata, o.shehar].filter(Boolean).join(', '))}</td><td>${esc((o.ph || []).join(', '))}</td><td>${esc([o.by, o.app].filter(Boolean).join(' · '))}</td></tr>`; }).join('');
  A.pdf?.(`<h2>📸 Screenshot diary — ${esc(fLab())}</h2><table><thead><tr><th>Waqt</th><th>Kya hai</th><th>Pata</th><th>Phone</th><th>Kis ki / App</th></tr></thead><tbody>${tr}</tbody></table>`, 'Screenshot diary');
}
async function onClick(e) {
  const d = dlg(); if (!d || !S) return;
  const t = e.target.closest?.('[data-sd],[data-sd-f],[data-sd-c],[data-sd-big],[data-sd-hid],[data-sd-del],[data-sd-cp],a');
  if (!t || !d.contains(t)) { if (S.menu && !e.target.closest('.sd-menu,.sd-in')) { S.menu = false; paint(); } return; }
  if (t.tagName === 'A') return;   // 📞 / 💬 / 🗺 / 🔗 — seedha
  const k = t.dataset;
  if (k.sd === 'x') { close(); return; }
  if (k.sd === 'back') { if (!stepBack()) close(); return; }
  if (k.sd === 'bigx') { S.big = ''; paint(); return; }
  if (k.sd === 'menu') { S.menu = !S.menu; paint(); return; }
  if (k.sd === 'run') { S.menu = false; paint(); BAD.clear(); runPending(30).then(() => load(false)); return; }
  if (k.sd === 'link') { S.menu = false; paint(); phoneLink(true); return; }
  if (k.sd === 'pdf') { S.menu = false; paint(); pdf(); return; }
  if (k.sdF) { S.f = k.sdF; S.menu = false; S.open = ''; paint(); return; }
  const n = (NOTES || []).find(x => x.id === (k.sdBig || k.sdHid || k.sdDel || k.sdCp || k.sdC)); if (!n) return;
  if (k.sdBig) {
    t.textContent = '⏳ Tasveer…';
    try { const b = await withT(A.cloud.getShotImg(n.id), 20000, 'net'); if (!b) { A.notice?.('Asal tasveer nahi mili (shayad mita di)'); t.textContent = '🖼 Poori tasveer'; return; } if (S) { S.big = 'data:image/jpeg;base64,' + b; paint(); } }
    catch (er) { A.notice?.('✕ Tasveer nahi khuli: ' + msg(er)); t.textContent = '🖼 Poori tasveer'; }
    return;
  }
  if (k.sdHid) { const h = n.hid ? 0 : 1; n.hid = h; S.open = ''; listPaint(); try { await A.cloud.setShotHid(n.id, h); } catch (er) { n.hid = h ? 0 : 1; listPaint(); A.notice?.('✕ Nahi hua: ' + msg(er)); } return; }
  if (k.sdDel) {
    if (!confirm('Yeh screenshot app se hata dein? (phone ki gallery mein rahegi)')) return;
    NOTES = NOTES.filter(x => x.id !== n.id); S.open = ''; listPaint();
    try { await A.cloud.delShotNote(n.id); } catch (er) { A.notice?.('✕ Nahi hati: ' + msg(er)); }
    try { await A.cloud.delShotIn(n.id); } catch {}
    return;
  }
  if (k.sdCp) {
    const o = oOf(n), tx = [o.nm, o.kaam, o.sum, o.pata && '📍 ' + [o.pata, o.shehar].filter(Boolean).join(', '), (o.ph || []).length && '📞 ' + o.ph.join(', '), o.by && '👤 ' + o.by + (o.app ? ' (' + o.app + ')' : ''), o.daam && '💰 ' + o.daam,
      o.rec && ('Cheezein:\n' + (o.rec.ing || []).map(x => '- ' + x).join('\n') + '\nTareeqa:\n' + (o.rec.st || []).map((x, i) => (i + 1) + '. ' + x).join('\n')),
      o.kr && ('Saman:\n' + (o.kr.mat || []).map(x => '- ' + x).join('\n') + '\nQadam:\n' + (o.kr.st || []).map((x, i) => (i + 1) + '. ' + x).join('\n'))].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(tx); A.notice?.('📋 Copy ho gaya'); } catch { A.notice?.('Copy nahi hua'); }
    return;
  }
  if (k.sdC) { if (e.target.closest('.sd-x2')) return; S.open = S.open === n.id ? '' : n.id; listPaint(); }
}
export function open(ctx) {
  A = Object.assign(A || {}, ctx || {});
  if (!$('sdCss')) { const s = document.createElement('style'); s.id = 'sdCss'; s.textContent = CSS; document.head.appendChild(s); }
  let d = dlg(); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'sdDlg'; d.className = 'sd-dlg'; document.body.appendChild(d);
  S = { f: 'all', q: '', open: '', menu: false, big: '' };
  d.addEventListener('click', onClick);
  d.addEventListener('input', ev => { if (ev.target?.id === 'sdQ' && S) { S.q = ev.target.value; S.open = ''; listPaint(); } });
  d.addEventListener('cancel', ev => { if (!ev.cancelable || !S) return; ev.preventDefault(); if (!stepBack()) close(); });   // phone back / Esc = ek qadam
  d.addEventListener('close', () => { if (S && stepBack()) { try { d.showModal(); } catch { d.setAttribute('open', ''); } return; } S = null; d.remove(); });
  paint();
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  load(true).then(() => load(false)).then(() => runPending(30)).then(r => { if (r && (r.ok || r.priv)) load(false); });
  phoneLink(false);
}
export const _t = { parseAi, waOf, byLink, privPk };
