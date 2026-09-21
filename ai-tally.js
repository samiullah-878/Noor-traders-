// Blue Khata v1.81 — sham ka milan: kaapi ki tasveer (AI sirf PARHTA hai) vs Daily Sale (milan yeh code karta hai).
// AI se hisaab nahi karwaya jata — sirf raqmein parhwai jati hain. Koi entry khud nahi badalti.

const API = 'https://generativelanguage.googleapis.com/v1beta';

export const TALLY_PROMPT = [
  'Yeh ek Pakistani dukaan ki haath se likhi hui rozana ki kaapi (roznamcha) ke page hain. Likhai Urdu / Roman Urdu mein hai, hindse English mein.',
  'Kaam: page par likhi hui HAR raqam nikaal kar do. Hisaab mat karo, jama mat karo, kuch apni taraf se mat banao.',
  'Qawaid:',
  '- amount = poore rupay, sirf hindse (comma / Rs ke baghair). Misal 13,330 -> 13330.',
  '- text = us raqam ke sath jo naam / lafz likha hai, jaisa parha jaye (na parha jaye to "").',
  '- Agar ek line mein kai raqmein "+" se juri hon (8500+13380+128000) to HAR raqam alag item.',
  '- Kati hui (cross ki hui) raqam ke liye struck=true. Tareekh, mobile number, memo number aur page number SHAMIL NA karo.',
  '- Jo hindsa saaf na ho us par unsure=true lagao, magar apna behtareen andaza zaroor do.',
  'Sirf yeh JSON do, aur kuch nahi: {"items":[{"amount":13330,"text":"hbl noor","struck":false,"unsure":false}]}'
].join('\n');

export async function shrinkForAI(file, maxPx = 1800, quality = 0.85) {
  if (!file || !String(file.type || '').startsWith('image/')) throw Error('Sirf picture choose karein');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const url = canvas.toDataURL('image/jpeg', quality);
  return { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

async function api(path, key, init = {}) {
  let res;
  try {
    res = await fetch(API + path, { ...init, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  } catch (e) { throw Error('Internet / Google tak rasai nahi hui: ' + (e.message || '')); }
  let body = null;
  try { body = await res.json(); } catch { /* khali jawab */ }
  if (!res.ok) {
    const msg = body?.error?.message || ('HTTP ' + res.status);
    if (res.status === 400 && /API key/i.test(msg)) throw Error('AI key ghalat hai — Settings mein dobara paste karein.');
    if (res.status === 403) throw Error('AI key par ijazat nahi (403): ' + msg);
    if (res.status === 404) throw Error('Yeh model nahi mila — Settings > AI key > "Test" dabayein taake sahi model chun liya jaye.');
    if (res.status === 429) throw Error('AI ki aaj ki muft hadd poori ho gayi (429). Thori der baad ya kal koshish karein.');
    throw Error('AI error: ' + msg);
  }
  return body || {};
}

// Google model ke naam badalta rehta hai — list se behtareen "flash" model khud chuno.
export async function pickModel(key) {
  const out = await api('/models?pageSize=200', key, { method: 'GET' });
  const names = (out.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => String(m.name || '').replace(/^models\//, ''));
  const ver = n => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const plain = names.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort((a, b) => ver(b) - ver(a));
  const loose = names.filter(n => /flash/.test(n) && !/(lite|tts|image|live|audio|embedding)/.test(n)).sort((a, b) => ver(b) - ver(a));
  return { best: plain[0] || loose[0] || names[0] || '', all: names };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const busyError = e => /overloaded|high demand|try again later|temporar|unavailable|503/i.test(String(e?.message || ''));

// v1.82: Google par rush (503) ho to khud 2 dafa ruk kar dobara koshish; phir bhi na chale to doosra flash model aazmao.
async function generate({ key, model, parts, onStatus }) {
  const call = m => api('/models/' + encodeURIComponent(m) + ':generateContent', key, {
    method: 'POST',
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } })
  });
  const delays = [2500, 6000];
  let lastErr = null;
  for (let i = 0; i <= delays.length; i++) {
    try { return await call(model); }
    catch (e) {
      lastErr = e;
      if (!busyError(e)) throw e;
      if (i < delays.length) { onStatus?.('Google par rush hai — ' + (i + 2) + '/3 koshish, thora sabar…'); await wait(delays[i]); }
    }
  }
  try {                                        // aakhri chara: doosra flash model
    const m = await pickModel(key);
    const alt = m.all.find(n => n !== model && /flash/.test(n) && !/(lite|tts|image|live|audio|embedding)/.test(n));
    if (alt) { onStatus?.('Doosra model aazma raha hoon: ' + alt); return await call(alt); }
  } catch { /* fallback bhi nakam */ }
  throw Error('Google ke server par abhi bohat rush hai. 2-5 minute baad dobara koshish karein. (' + (lastErr?.message || '') + ')');
}

function textOf(out) {
  const text = (out.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw Error('AI ne khali jawab diya' + (out.promptFeedback?.blockReason ? ' (' + out.promptFeedback.blockReason + ')' : '') + ' — tasveer dobara saaf le kar koshish karein.');
  return text;
}

export async function readPages({ key, model, images, onStatus }) {
  if (!key) throw Error('AI key nahi lagi — malik Settings mein "AI key" save kare.');
  if (!model) throw Error('Model ka naam khali hai — Settings > AI key > Test dabayein.');
  if (!images?.length) throw Error('Kam az kam 1 picture chunein');
  const parts = images.map(im => ({ inline_data: { mime_type: im.mime, data: im.data } }));
  parts.push({ text: TALLY_PROMPT });
  return parseItems(textOf(await generate({ key, model, parts, onStatus })));
}

// ---------- v1.82: PURCHASE BILL ki photo se form ----------
export const BILL_PROMPT = [
  'Yeh ek Pakistani supplier ke PURCHASE BILL / invoice ki tasveer hai (Urdu / Roman Urdu / English, hindse English).',
  'Kaam: bill se yeh cheezein nikaal do. Hisaab mat karo, jo likha hai wohi do.',
  '- supplier: bill dene wali dukaan / company ka naam (na mile to "").',
  '- date: bill ki tareekh YYYY-MM-DD (na mile ya samajh na aaye to "").',
  '- total: bill ka aakhri grand total, poore rupay, sirf hindse (na mile to 0).',
  '- lines: HAR item ki line: {"name": item ka naam BILKUL waisa jaisa likha hai (Urdu likha ho to Urdu hi), "roman": agar naam Urdu/Arabic rasm-ul-khat mein hai to wohi naam Roman Urdu (English harfon) mein — jaise "چینی" ka "cheeni" — warna "", "ctn": carton / peti / bora ki ginti (na mile to 0), "pcs": khule pieces / dozen se bahar ginti (na mile to 0), "rate": fi carton qeemat rupay agar ctn hai warna fi piece (na mile to 0), "total": us line ka total rupay (na mile to 0), "unsure": true agar hindsa saaf na ho}.',
  '- Agar bill par sirf ek ginti likhi hai aur pata nahi carton hai ya piece, to use "ctn" mein daal do. "5+3" ka matlab aksar 5 carton aur 3 pieces hota hai.',
  '- Tareekh, mobile number, address, "previous balance", tax number waghera ko LINES mein SHAMIL NA karo.',
  'Sirf yeh JSON do, aur kuch nahi: {"supplier":"","date":"","total":0,"lines":[{"name":"","roman":"","ctn":0,"pcs":0,"rate":0,"total":0,"unsure":false}]}'
].join('\n');

export function parseBill(text) {
  let raw = String(text || '').replace(/```json|```/g, '').trim();
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a >= 0 && b > a) raw = raw.slice(a, b + 1);
  let d; try { d = JSON.parse(raw); } catch { throw Error('AI ka jawab parha nahi gaya — dobara koshish karein.'); }
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  const lines = (Array.isArray(d.lines) ? d.lines : []).map(l => ({
    name: String(l?.name || '').slice(0, 120).trim(),
    roman: String(l?.roman || '').slice(0, 120).trim(),
    ctn: Math.max(0, num(l?.ctn)) || (Math.max(0, num(l?.qty)) || 0),   // purana "qty" bhi ctn ban jata hai
    pcs: Math.max(0, num(l?.pcs)),
    rate: Math.max(0, num(l?.rate)),
    total: Math.round(Math.max(0, num(l?.total))),
    unsure: l?.unsure === true
  })).filter(l => l.name || l.total > 0).slice(0, 100);
  for (const l of lines) { if (!l.ctn && !l.pcs) l.ctn = 1; if (!l.total && l.ctn && l.rate) l.total = Math.round(l.ctn * l.rate); }
  return { supplier: String(d.supplier || '').slice(0, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? d.date : '', total: Math.round(num(d.total)), lines };
}

export async function readPurchaseBill({ key, model, images, onStatus }) {
  if (!key) throw Error('AI key nahi lagi — malik Settings mein "AI key" save kare.');
  if (!model) throw Error('Model ka naam khali hai — Settings > AI key > Test dabayein.');
  if (!images?.length) throw Error('Bill ki kam az kam 1 picture chunein');
  const parts = images.map(im => ({ inline_data: { mime_type: im.mime, data: im.data } }));
  parts.push({ text: BILL_PROMPT });
  return parseBill(textOf(await generate({ key, model, parts, onStatus })));
}

export function parseItems(text) {
  let raw = String(text || '').replace(/```json|```/g, '').trim();
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a >= 0 && b > a) raw = raw.slice(a, b + 1);
  let data;
  try { data = JSON.parse(raw); } catch { throw Error('AI ka jawab parha nahi gaya — dobara koshish karein.'); }
  const list = Array.isArray(data) ? data : (data.items || []);
  return list.map(x => ({
    amount: Math.round(Number(String(x?.amount ?? '').replace(/[^\d.]/g, '')) || 0),
    text: String(x?.text || '').slice(0, 80),
    struck: x?.struck === true,
    unsure: x?.unsure === true
  })).filter(x => x.amount > 0 && x.amount < 1e11).slice(0, 300);
}

// ---------- MILAN (sirf code, AI nahi) ----------
function distance1(a, b) {               // ek hindse ka farq / ek hindsa zyada-kam / do hindse aage-peeche
  if (a === b) return false;
  if (a.length === b.length) {
    const diff = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  if (l.length - s.length !== 1) return false;
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}

// book: [{amount(rupay), text, struck}] · rows: [{id, cents, label, kind}] · totals: [{label, cents}]
export function matchTally(book, rows, totals = []) {
  const live = book.map((b, i) => ({ ...b, i })).filter(b => !b.struck && b.amount > 0);
  const left = rows.map(r => ({ ...r }));
  const matched = [], near = [], onlyBook = [], totalHits = [];
  for (const b of live) {                                   // 1) bilkul barabar
    const k = left.findIndex(r => r.cents === b.amount * 100);
    if (k >= 0) { matched.push({ book: b, row: left[k] }); left.splice(k, 1); } else onlyBook.push(b);
  }
  for (let n = onlyBook.length - 1; n >= 0; n--) {          // 2) kaapi mein likha hua total (entry nahi)
    const t = totals.find(t => t.cents > 0 && t.cents === onlyBook[n].amount * 100);
    if (t) { totalHits.push({ book: onlyBook[n], label: t.label }); onlyBook.splice(n, 1); }
  }
  for (let n = onlyBook.length - 1; n >= 0; n--) {          // 3) milti-julti raqam
    const b = onlyBook[n], bs = String(b.amount);
    if (bs.length < 3) continue;
    let best = -1, gap = Infinity;
    left.forEach((r, k) => {
      if (r.cents % 100) return;
      const rs = String(r.cents / 100);
      if (rs.length < 3 || !distance1(bs, rs)) return;
      const g = Math.abs(r.cents / 100 - b.amount);
      if (g < gap) { gap = g; best = k; }
    });
    if (best >= 0) { near.push({ book: b, row: left[best] }); left.splice(best, 1); onlyBook.splice(n, 1); }
  }
  const sum = list => list.reduce((s, x) => s + x, 0);
  return {
    matched, near: near.reverse(), onlyBook, onlyApp: left, totalHits: totalHits.reverse(),
    bookSum: sum(live.filter(b => !totalHits.some(t => t.book.i === b.i)).map(b => b.amount * 100)),
    appSum: sum(rows.map(r => r.cents))
  };
}
