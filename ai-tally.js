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

export async function readPages({ key, model, images }) {
  if (!key) throw Error('AI key nahi lagi — malik Settings mein "AI key" save kare.');
  if (!model) throw Error('Model ka naam khali hai — Settings > AI key > Test dabayein.');
  if (!images?.length) throw Error('Kam az kam 1 picture chunein');
  const parts = images.map(im => ({ inline_data: { mime_type: im.mime, data: im.data } }));
  parts.push({ text: TALLY_PROMPT });
  const out = await api('/models/' + encodeURIComponent(model) + ':generateContent', key, {
    method: 'POST',
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } })
  });
  const text = (out.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw Error('AI ne khali jawab diya' + (out.promptFeedback?.blockReason ? ' (' + out.promptFeedback.blockReason + ')' : '') + ' — tasveer dobara saaf le kar koshish karein.');
  return parseItems(text);
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
