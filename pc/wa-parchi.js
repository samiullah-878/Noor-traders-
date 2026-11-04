// =========================================================
//  wa-parchi.js  v1.5 (2026-11-04) — 📲 WHATSAPP PARCHI → PACKING LIST (BILL BAAQI)
//  v1.5: malik (v1.4 thermal: 18 mein 17 theek, "کوئیش" ghalat magar tukda nahi) → shak ki hadd 0.75 → 0.9 (zara kam yaqeen = likhai ka tukda) +
//        AI ko: 0.9+ sirf jab har harf saaf ho.
//  v1.4: malik (thermal dekh kar): "same as it parchi chahiye · tarteeb dhyan se · jis ki tarteeb aage peeche lage us ka woh hissa bhi saath print" →
//        AI hidayat: JORI-WAR (cheez + usi line ki tadad, daayein jori pehle), raw = HOOBAHOO (naam kabhi na badle, na parha = ؟), col = kaun si jori;
//        tasveer parhte waqt AI thora soche (thinking low — pehle minimal). Thermal: har line ☐ + lafz, jori badle to ┄ lakeer, AI ko shak (sure < 0.75 / ؟)
//        = usi line ki likhai ka tukda neeche (cropRaster). Line ki unchai PowerShell batata hai (OK path H:…) — BMP line-war kat kar.
//  v1.3: 🧾 THERMAL = PARCHI JAISI LIKHI (malik: "poori tasveer ki bajaye wohi lafz thermal par · shuru mein tick ka box · simple") — har line
//        gahak ke apne lafz (AI ka 'raw', usi tarteeb), Urdu = Urdu font + daayein ☐, English = baayein ☐ (wa-a4.ps1 -Mode thlist, PowerShell na chale
//        to saada text). Tasveer / ❓ tukde thermal par NAHI (A4 par pehle jaisi). AI na parh sake = chhota paigham, lambi tasveer nahi. AI wahi ek dafa.
//  v1.2: 🗑 app ne parchi hata di (st 'x:<pehle>' — app v2.179.1) to AI ka jawab / print ka haal baad mein aaye tab bhi parchi CHHUPI rahe ('x:ok') — wapas list mein nahi aati.
//  v1.1: Google ne gemini-2.5-flash band kiya ("no longer available to new users") — pehla model na chale to Google ki LIST se
//        behtareen chalta flash model khud (app ke pickModel jaisa), rush par usi ko ek dafa aur; jo chala woh yaad. Shuru mein
//        pichhle 3 ghante ki "AI 404 / model" wali fail parchiyan EK dafa khud dobara parhi jati hain (rr:1).
//  Malik: "gahak apni likhi hui parchi (Urdu + English) ki photo meri WhatsApp par bhejta hai — main dukan ke number par forward
//          karun (caption mein gahak ka number / naam) · PC khud parhe, POS items se milaye, app mein order bane, aur FORAN
//          thermal + A4 par packing parchi nikle taake larke bill banne se pehle maal nikalna shuru kar dein."
//
//  Server PC dukan ke WhatsApp number par "linked device" (Baileys, QR app mein — blueAccess/waLink). PC KABHI koi WhatsApp
//  paigham NAHI bhejta (na jawab, na blue tick / read receipt, na "online") — ban ka khatra kam.
//  Har nayi parchi (photo ya likhi list) jo blueAccess/waParchi.allow wale number se aaye:
//    ① parchiOrders/<w…> + parchiImg/<w…> (poori tasveer) — app mein foran
//    ② Gemini (blueAccess/aiConfig) parchi parhta hai → lines (raw · item · qty · unit · box · sure)        ← 🤖 AI SIRF YAHAN
//    ③ dukan ke POS items (posStock b1) se milan — dhoond.mjs smartFind (AI NAHI) + itemAliases + urduNames
//    ④ 🧾 TM-T88IV par packing parchi (rack-war, ☐ har item, ❓ samajh nahi aaya = likhai ki tasveer) + 🖨 A4 (a4-print.js ko job)
//  App ke bane order (parchiOrders st 'new', src 'app') bhi isi raaste. Dobara print = order par prReq (naya number).
//  Dobara parhna = app order ka st 'new' kar de. POS / khata mein KUCH nahi likhti.
//  Baileys apne folder wa-mods\ mein (C:\khata-sync\node_modules ko kabhi nahi chhuti — npm wahan baqi packages hata deta).
//  Lock 47820. Chalana: wa-parchi-auto.bat (doctor). Log: wa-parchi-log.txt
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { execFile, exec } = require('child_process');
const { pathToFileURL } = require('url');
const UR = require('./urdu-names.js');

const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47820, VER = '1.5';
const TH_PRINTER = 'TM-T88IV', W = 42, FALLBACK_MODEL = 'gemini-3.8-flash';   // v1.1: 2.5-flash Google ne band kiya — asal chunao list se (pickModels)
const MODS = path.join(DIR, 'wa-mods'), AUTH_DIR = path.join(DIR, 'wa-auth'), SEEN_FILE = path.join(DIR, 'wa-seen.json'), NPM_FILE = path.join(DIR, 'wa-npm.json');
const TMP = path.join(DIR, 'wa-tmp'), PS1 = path.join(DIR, 'wa-a4.ps1');
const PKG = '@whiskeysockets/baileys', PKG_VER = '7.0.0-rc14';
const DAY = 864e5, MAX_AGE = DAY, LINK_WIN = 2 * 60000, IMG_MAX = 900000, TH_MAX = 40000, A4_MAX = 950000, OLD_RQ = 30 * 60000;
const ESC = '\x1b', GS = '\x1d', CUT = GS + 'V\x42\x00', CRM = '\u0001CR\u0001', C1 = ESC + 'a\x01', L0 = ESC + 'a\x00', B1 = ESC + 'E\x01', B0 = ESC + 'E\x00';
const FONT_UR = 'Jameel Noori Nastaleeq,Urdu Typesetting,Segoe UI,Tahoma,Arial';
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ${Math.round(ms / 1000)} sec mein nahi hua`)), ms); })]).finally(() => clearTimeout(t)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// =========================================================
//  CHHOTE KAAM (test ho sakte hain — module.exports)
// =========================================================
const UDIG = s => String(s ?? '').replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660));
const ascii = s => String(s ?? '').replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
const hasUr = s => /[\u0600-\u06FF]/.test(String(s || ''));
const pad = (s, w) => String(s ?? '').slice(0, Math.max(0, w)).padEnd(Math.max(0, w));
const line = (l, r) => { l = String(l); r = String(r); return pad(l, Math.max(0, W - r.length - 1)) + ' ' + r; };
const hr = () => '-'.repeat(W);
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const dayOf = t => new Date(Number(t) + 5 * 3600000).toISOString().slice(0, 10);   // Pakistan din (UTC+5)
const tstr = t => new Date(Number(t) || Date.now()).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' }).toLowerCase();
const dstr = t => new Date(Number(t) || Date.now()).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
const shortNo = id => String(id || '').slice(-4).toUpperCase();
function wrap(s, w) { const out = []; let cur = ''; for (const word of String(s || '').split(' ').filter(Boolean)) { if (!cur) cur = word; else if (cur.length + 1 + word.length <= w) cur += ' ' + word; else { out.push(cur); cur = word; } while (cur.length > w) { out.push(cur.slice(0, w)); cur = cur.slice(w); } } if (cur) out.push(cur); return out; }

// ---------- 📞 number ----------
// JID '923001234567:12@s.whatsapp.net' / '+92 300 1234567' / '0300-1234567' / '3001234567' → '03001234567' (Pakistan mobile) · baqi = sirf hindse
function normPh(x) {
  let s = UDIG(x).trim(); if (!s) return '';
  if (s.includes('@')) s = s.split('@')[0].split(':')[0];
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return d;
}
const isMob = p => /^03\d{9}$/.test(String(p || ''));
const phPretty = p => isMob(p) ? p.slice(0, 4) + '-' + p.slice(4) : String(p || '');
// caption: "Ahmed bhai 0300-1234567" → { ph: '03001234567', nm: 'Ahmed bhai' } · mobile 030x–035x hi (Rs 35000 jaisa number nahi)
const PH_RE = /(?<!\d)(?:(?:\+|00)?92[\s.\-()]{0,2}|0)?3[0-5](?:[\s.\-()]{0,2}\d){8}(?!\d)/;
const NM_DROP = /(^|\s)(?:ph(?:one)?|mob(?:ile)?|cell|contact|whats ?app|wa|no|num(?:ber)?|nmbr|naam|name|cust(?:omer)?|گاہک|نام|نمبر|فون|موبائل)\s*(?:[:.#-]+|(?=\s|$))/gi;
function parseCaption(cap) {
  let t = UDIG(cap).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim(), ph = '';
  const m = t.match(PH_RE); if (m) { const p = normPh(m[0]); if (isMob(p)) { ph = p; t = t.replace(m[0], ' '); } }
  const nm = t.replace(NM_DROP, ' ').replace(/[:;,|#*_~=+<>\[\]{}()"]+/g, ' ').replace(/\s[-–—.]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-–—.]+|[\s\-–—.]+$/g, '').trim().slice(0, 60);
  return { ph, nm };
}
// contact card (vcard) → { ph, nm }
function vcardInfo(vc, dn) {
  const v = String(vc || ''); let ph = '';
  const w = v.match(/waid=(\d{8,15})/i); if (w) ph = normPh(w[1]);
  if (!isMob(ph)) for (const m of v.matchAll(/^(?:item\d+\.)?TEL[^:\n]*:([^\n\r]+)/gim)) { const p = normPh(m[1]); if (isMob(p)) { ph = p; break; } }
  let nm = String(dn || '').trim(); if (!nm) { const f = v.match(/^FN[^:\n]*:(.+)$/im); if (f) nm = f[1].trim(); }
  return { ph: isMob(ph) ? ph : '', nm: nm.replace(/\s+/g, ' ').slice(0, 60) };
}

// ---------- 📏 tadad / unit ----------
const UNITS = { kg: 'kg kgs kilo kilos kilogram kilograms کلو کلوگرام', g: 'g gm gms gram grams gr گرام', litre: 'l ltr ltrs liter liters litre litres لیٹر', ml: 'ml ملی',
  pcs: 'pc pcs piece pieces nos adad dana daney dane عدد دانے دانہ پیس', packet: 'packet packets pkt pkts پیکٹ', pack: 'pack packs', dozen: 'dozen dz dzn darjan درجن',
  bag: 'bag bags thaila thaile thela thele bori bora تھیلا تھیلے تھیلی بوری بورا', bottle: 'bottle bottles btl botal بوتل', box: 'box boxes dabba dabbe dibba ڈبہ ڈبے ڈبی',
  carton: 'carton cartons ctn peti پیٹی کارٹن', tin: 'tin tins ٹین', roll: 'roll rolls رول', bar: 'bar bars tikki ٹکی', sachet: 'sachet sachets', jar: 'jar jars', pouch: 'pouch pouches' };
const UNIT_OF = new Map(); for (const [k, v] of Object.entries(UNITS)) { UNIT_OF.set(k, k); for (const w of v.split(' ')) UNIT_OF.set(w.toLowerCase(), k); }
const normUnit = u => { const s = String(u || '').trim().toLowerCase().replace(/\.$/, ''); if (!s) return ''; return UNIT_OF.get(s) || s.replace(/[^a-z\u0600-\u06FF ]/g, '').trim().slice(0, 12); };
const UNIT_SHORT = { kg: 'kg', g: 'g', litre: 'ltr', ml: 'ml', pcs: 'pcs', packet: 'pkt', pack: 'pack', dozen: 'dzn', bag: 'bag', bottle: 'btl', box: 'box', carton: 'ctn', tin: 'tin', roll: 'roll', bar: 'bar', sachet: 'sachet', jar: 'jar', pouch: 'pouch' };
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const WORDNUM = { aadha: 0.5, adha: 0.5, 'آدھا': 0.5, 'آدھی': 0.5, pao: 0.25, pau: 0.25, paao: 0.25, 'پاؤ': 0.25, 'پاو': 0.25, derh: 1.5, dedh: 1.5, 'ڈیڑھ': 1.5, dhai: 2.5, dhaai: 2.5, 'ڈھائی': 2.5, ek: 1, aik: 1, 'ایک': 1, do: 2, 'دو': 2, teen: 3, 'تین': 3, char: 4, chaar: 4, 'چار': 4, panch: 5, paanch: 5, 'پانچ': 5, darjan: 12 };
function numOf(v, def = 1) {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? r3(v) : def;
  let s = UDIG(v).trim().toLowerCase(); if (!s) return def;
  if (WORDNUM[s] != null) return WORDNUM[s];
  const mf = s.match(/^(\d+)?\s*([½¼¾])/); if (mf) return r3((Number(mf[1]) || 0) + FRAC[mf[2]]);
  const fr = s.match(/^(\d+)\s*\/\s*(\d+)$/); if (fr && Number(fr[2])) return r3(Number(fr[1]) / Number(fr[2]));
  const m = s.match(/\d+(?:\.\d+)?/); const n = m ? Number(m[0]) : NaN; return n > 0 ? r3(n) : def;
}
function qtyStr(q, u) {
  const v = Number(q) > 0 ? Number(q) : 1, U = UNIT_SHORT[u] || ascii(u).slice(0, 6);
  if (u === 'kg' && v < 1) return String(r3(v * 1000)) + 'g';
  return String(r3(v)) + (U ? ' ' + U : '');
}
function validBox(b) {
  if (!Array.isArray(b) || b.length !== 4) return null;
  let a = b.map(Number); if (a.some(x => !isFinite(x))) return null;
  if (Math.max(...a) <= 1.0001) a = a.map(x => x * 1000);   // 0–1 diya to 0–1000
  a = a.map(x => Math.max(0, Math.min(1000, Math.round(x))));
  const [y0, x0, y1, x1] = a; if (y1 - y0 < 3 || x1 - x0 < 3) return null;
  return a;
}

// ---------- 🤖 Gemini ----------
const PROMPT_IMG = `You are reading a customer's ORDER LIST (parchi) for a grocery / general store in Pakistan (Noor Traders).
It may be handwritten in Urdu (Nastaliq), Roman Urdu, English or a mix. Urdu lists are often written as COLUMN PAIRS: an item column with its quantity column just to its LEFT, on the same row.
A page may have TWO OR MORE such pairs side by side (for example: qty | items | qty | items). Pair every item ONLY with the quantity written beside it inside its OWN pair on the SAME row — never with a quantity from another pair or another row.
Order: read the RIGHTMOST pair from top to bottom first, then the next pair to its left from top to bottom, and so on. Look carefully at the row lines of the paper so every item gets its own quantity.
Read EVERY item line and keep this order. Do not skip lines, do not invent items, do not merge two items into one, do not split one item into two.
Ignore the shop name, dates, serial numbers, ticks / cuts, and any prices, amounts or totals (never treat a price as a quantity).
Return ONLY this JSON:
{"isOrder": true, "name": "customer name if written on the list, else empty", "phone": "customer phone if written on the list, else empty",
 "lines": [{"raw": "the line exactly as written, same script", "item": "...", "qty": 1, "unit": "...", "col": 1, "box": [ymin, xmin, ymax, xmax], "sure": 0.9}]}
Rules:
- raw: copy EXACTLY what the customer wrote on that row of that pair — the item words, then its quantity words — in the same script, spelling and digits. NEVER correct, translate, shorten or replace a word, and never put a brand you know in place of the written one. If a word cannot be read, write ؟ in its place.
- col: which column pair the line is in — 1 = the rightmost pair, 2 = the next pair to its left, and so on (1 if the list has only one column).
- item: the best plain, searchable product name in simple English or Roman Urdu. Keep brand, size and variant if written. Examples: "Lipton tea", "Pampers XXL", "Ponds lotion", "Aata", "Cheeni", "Surf Excel 1kg", "Dalda ghee", "Shan biryani masala". Never translate a brand name.
- qty: the number written for that item (Urdu digits too). Words: آدھا = 0.5, پاؤ = 0.25 (kg), ڈیڑھ = 1.5, ڈھائی = 2.5. If no quantity is written use 1.
- unit: as written, normalised to one of kg, g, litre, ml, pcs, packet, pack, dozen, bag, bottle, box, carton, tin, roll, bar, sachet, jar, pouch. Translate: کلو = kg, گرام = g, لیٹر = litre, پاؤ = kg (with qty 0.25), عدد / دانے = pcs, تھیلا / تھیلے / بوری = bag, ڈبہ / ڈبے = box, بوتل = bottle, پیکٹ = packet, درجن = dozen, پیٹی / کارٹن = carton. Use "" if no unit is written.
- box: bounding box of that whole line on the image — from the item text to its quantity in the same pair — normalised to 0-1000 as [ymin, xmin, ymax, xmax].
- sure: your confidence from 0 to 1 that the item, its qty AND their pairing / order are all correct. Use a value below 0.6 when the handwriting is unclear or you are not sure which quantity belongs to the item. Give 0.9 or more ONLY when every letter of the line is clearly readable and it is a word you are sure of.
- isOrder: false (with empty lines) if the image is not a shopping / order list at all (selfie, payment screenshot, random photo, chat screenshot without a list).`;
const PROMPT_TXT = `Below is a customer's ORDER LIST for a grocery / general store in Pakistan (Noor Traders), typed in a WhatsApp message — Urdu, Roman Urdu, English or mixed.
Read every item in order. Do not invent items. Ignore greetings, prices and totals.
Return ONLY this JSON:
{"isOrder": true, "name": "customer name if written, else empty", "phone": "customer phone if written, else empty",
 "lines": [{"raw": "that item exactly as written", "item": "plain searchable name in simple English or Roman Urdu (keep brand / size), e.g. Lipton tea, Pampers XXL, Aata, Cheeni", "qty": 1, "unit": "kg|g|litre|ml|pcs|packet|pack|dozen|bag|bottle|box|carton|tin|roll|bar|sachet|jar|pouch or empty", "box": null, "sure": 0.9}]}
Translate units: کلو = kg, گرام = g, پاؤ = 0.25 kg, آدھا = 0.5, عدد = pcs, تھیلا / تھیلے = bag, ڈبہ = box, بوتل = bottle, پیکٹ = packet, درجن = dozen. qty 1 if not written.
isOrder false (with empty lines) if the message is not an order list (greeting, question, "ok", a name only).

Message:
`;
function normLine(l) {
  if (typeof l === 'string') l = l.trim() ? { raw: l, item: l } : null;
  if (!l || typeof l !== 'object') return null;
  const raw = String(l.raw ?? l.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), item = String(l.item ?? l.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!raw && !item) return null;
  let sure = Number(l.sure ?? l.confidence); if (!isFinite(sure)) sure = 0.7; if (sure > 1 && sure <= 100) sure /= 100; sure = Math.max(0, Math.min(1, Math.round(sure * 100) / 100));
  const col = Math.max(0, Math.min(9, Math.round(Number(l.col ?? l.column) || 0)));   // v1.4: kaun si jori (1 = daayein)
  return { raw: raw || item, item: item || raw, qty: numOf(l.qty ?? l.quantity), unit: normUnit(l.unit), box: validBox(l.box ?? l.box_2d ?? l.bbox), sure, ...(col ? { col } : {}) };
}
function parseGemini(out) {
  const s = String(out || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let o = null; try { o = JSON.parse(s); } catch { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) { try { o = JSON.parse(s.slice(a, b + 1)); } catch {} } }
  if (Array.isArray(o)) o = { isOrder: true, lines: o };
  if (!o || typeof o !== 'object') throw Error('AI ka jawab samajh nahi aaya');
  const arr = Array.isArray(o.lines) ? o.lines : Array.isArray(o.items) ? o.items : [];
  const lines = arr.map(normLine).filter(Boolean).slice(0, 150);
  const p = normPh(o.phone);
  return { isOrder: o.isOrder !== false && lines.length > 0, name: String(o.name || '').replace(/\s+/g, ' ').trim().slice(0, 60), phone: isMob(p) ? p : '', lines };
}
// AI na ho / na chale (sirf LIKHI list): har line / comma = ek item — "aata 2 thaile" → Aata · 2 · bag
function localTextLines(text) {
  const lines = [];
  for (const raw0 of String(text || '').split(/\r?\n|[,،;]+/)) {
    const raw = raw0.replace(/^\s*(?:[-*•]+|\d{1,2}[.)])\s*/, '').replace(/\s+/g, ' ').trim(); if (!raw || !/[a-z\u0600-\u06FF]/i.test(raw)) continue;   // "1." / "2)" / "-" = list ka nishan, tadad nahi
    if (/^(ok|okay|g|ji|jee|han|haan|hello|hi|salam|assalam o alaikum|aoa|thanks|thank you|shukriya|plz|please|jaldi|order|list|السلام علیکم|شکریہ|جی)$/i.test(raw)) continue;
    const toks = UDIG(raw).split(' '); let qty = null, unit = '';
    const keep = toks.filter(t => { const lt = t.toLowerCase();
      if (qty == null && (/^\d+(?:\.\d+)?$|^\d+\/\d+$|^[½¼¾]$/.test(lt) || WORDNUM[lt] != null && !/^(do|ek)$/.test(lt))) { qty = numOf(lt); return false; }
      const m = lt.match(/^(\d+(?:\.\d+)?)([a-z]+)$/); if (m && UNIT_OF.has(m[2])) { if (qty == null) qty = numOf(m[1]); if (!unit) unit = UNIT_OF.get(m[2]); return false; }
      if (!unit && UNIT_OF.has(lt) && lt.length > 1) { unit = UNIT_OF.get(lt); return false; }
      return true; });
    const item = keep.join(' ').trim() || raw;
    lines.push({ raw: raw.slice(0, 120), item: item.slice(0, 80), qty: qty || 1, unit, box: null, sure: 0.6 });
  }
  return { isOrder: lines.length > 0, name: '', phone: '', lines: lines.slice(0, 150) };
}
// key KABHI log / Firestore mein nahi
// v1.1: Google ki model list (6 ghante yaad) → behtareen "flash" (app ke ai-tally pickModel jaisa: seedha gemini-N-flash pehle, naya pehle)
const MODEL_CACHE = { at: 0, list: [] }, DEAD = new Set(); let GOOD = '';
const mver = n => Number((String(n).match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
function pickModels(names) {
  const ok = names.filter(n => /flash/.test(n) && !/(lite|tts|image|live|audio|embedding|preview|exp)/.test(n));
  const plain = ok.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort((a, b) => mver(b) - mver(a));
  return [...plain, ...ok.filter(n => !plain.includes(n)).sort((a, b) => mver(b) - mver(a))];
}
async function listModels(key, fetchFn) {
  if (MODEL_CACHE.list.length && Date.now() - MODEL_CACHE.at < 6 * 3600000) return MODEL_CACHE.list;
  const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error('model list ' + r.status);
  const names = ((j && j.models) || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''));
  MODEL_CACHE.at = Date.now(); MODEL_CACHE.list = pickModels(names);
  return MODEL_CACHE.list;
}
const isGone = e => Number(e && e.code) === 404 || /no longer available|not found|is not supported for generateContent/i.test(String(e && e.message));
async function geminiRead({ key, model, b64, mime, text, fetchFn = globalThis.fetch, ms = 45000, waitMs = 1500 }) {
  if (!key) throw Object.assign(Error('AI key nahi (app → Settings → 🤖 AI)'), { code: 'nokey' });
  const call = async (mdl, think) => {
    const parts = b64 ? [{ inline_data: { mime_type: mime || 'image/jpeg', data: b64 } }, { text: PROMPT_IMG }] : [{ text: PROMPT_TXT + String(text || '').slice(0, 4000) }];
    const gc = { temperature: 0, responseMimeType: 'application/json' };
    if (think) gc.thinkingConfig = b64 ? (/gemini-3/i.test(mdl) ? { thinkingLevel: 'low' } : { thinkingBudget: 1024 }) : (/gemini-3/i.test(mdl) ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 });   // v1.4: tasveer = thora soche (jori / tarteeb)
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mdl) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: gc }), signal: ac.signal });
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
      if (!r.ok) throw Object.assign(Error('AI ' + r.status + ': ' + String((j && j.error && j.error.message) || txt).slice(0, 140)), { code: r.status });
      const c = j && j.candidates && j.candidates[0], out = ((c && c.content && c.content.parts) || []).filter(p => !p.thought).map(p => p.text || '').join('');
      if (!out) throw Error('AI ka jawab khali (' + ((c && c.finishReason) || (j && j.promptFeedback && j.promptFeedback.blockReason) || '?') + ')');
      return out;
    } catch (e) { if (e && e.name === 'AbortError') throw Error('AI ' + Math.round(ms / 1000) + ' sec mein jawab nahi'); throw e; } finally { clearTimeout(t); }
  };
  const one = async mdl => { let out; try { out = await call(mdl, true); } catch (e) { if (e.code !== 400 || isGone(e)) throw e; out = await call(mdl, false); } return parseGemini(out); };   // 400 = model thinkingConfig nahi leta
  const m0 = String(model || '').replace(/^models\//, '').trim();
  const tried = new Set(), errs = [], T0 = Date.now();
  const attempt = async (mdl, again) => {
    tried.add(mdl);
    try { const res = await one(mdl); GOOD = mdl; return { res, model: mdl }; }
    catch (e) {
      if (isGone(e)) DEAD.add(mdl);
      if (again && [429, 500, 502, 503, 504].includes(Number(e.code)) && Date.now() - T0 < 60000) { await new Promise(r => setTimeout(r, waitMs)); return attempt(mdl, false); }   // rush = usi model ko ek dafa aur (der wala jawab nahi = seedha agla model)
      errs.push(mdl + ': ' + String(e.message || e).slice(0, 90));
      if (Number(e.code) === 401 || Number(e.code) === 403) throw Object.assign(Error('AI key ghalat / band (' + e.code + ') — app → Settings → 🤖 AI key'), { code: e.code });
      return null;
    }
  };
  const first = [m0, GOOD].filter(n => n && !DEAD.has(n));
  for (const mdl of first) { if (tried.has(mdl)) continue; const r = await attempt(mdl, true); if (r) return r; }
  let alts = [];
  try { alts = await listModels(key, fetchFn); } catch (e) { errs.push('list: ' + String(e.message).slice(0, 60)); }
  if (!alts.length) alts = [FALLBACK_MODEL];
  let n = 0;
  for (const mdl of alts) {
    if (tried.has(mdl) || DEAD.has(mdl)) continue; if (n++ >= 2 || Date.now() - T0 > 110000) break;
    log(`🤖 ${first[0] || 'model'} nahi chala — ${mdl} se dobara`);
    const r = await attempt(mdl, true); if (r) return r;
  }
  throw Error(errs.length ? errs.slice(-2).join(' · ') : 'AI model nahi mila');
}

// ---------- 🔍 POS item se milan (dhoond.mjs smartFind — AI NAHI) ----------
const DROP = new Set([...UNIT_OF.keys(), 'x', 'aadha', 'adha', 'pao', 'pau', 'paao', 'derh', 'dedh', 'dhai', 'آدھا', 'پاؤ', 'ڈیڑھ', 'ڈھائی', 'wala', 'wali', 'wale', 'والا', 'والی', 'والے']);
const GENERIC = new Set(['tea', 'chai', 'patti', 'oil', 'tel', 'ghee', 'soap', 'sabun', 'shampoo', 'lotion', 'cream', 'powder', 'masala', 'biscuit', 'biscuits', 'juice', 'drink', 'paste', 'toothpaste', 'brush', 'detergent', 'packet', 'pack', 'bottle', 'dabba', 'box', 'small', 'large', 'big', 'chhota', 'bara', 'wala']);   // yeh lafz hata kar sirf brand mile = phir bhi pakka (Lipton tea → LIPTON YELLOW LABEL)
const isNumTok = t => /^[\d۰-۹٠-٩.,\/½¼¾]+$/.test(t) || /^\d+(?:\.\d+)?[a-z]{1,3}$/i.test(t);
const title = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());   // web-dukan.js jaisa
// items (posStock b1) + aliases {id: 'naam | naam'} + urdu {id: 'اردو'} + hidden {id: true} → dhoondne ki list
function buildIndex(items, { alias = {}, urdu = {}, hidden = {} } = {}) {
  const L = [], AL = [], byId = new Map();
  for (const it of items || []) {
    if (!it || it.id == null || !it.name) continue; const id = String(it.id); if (hidden[id] || byId.has(id)) continue;
    const al = String(alias[id] || '').trim(), ur = String(urdu[id] || '').trim();
    const o = { id, it, t: [String(it.name), ur, al.replace(/[|;,\n]+/g, ' ')].filter(Boolean).join(' ') };
    L.push(o); byId.set(id, o);
    if (al) for (const a of al.split(/[|;,\n]+/)) if (a.trim()) AL.push({ id, k: 'al:' + id + ':' + a.trim().toLowerCase(), t: a.trim() });
  }
  return { L, AL, byId };
}
function best(hits, q, k2) {   // smartFind ki tarteeb + naam ka zyada hissa mile + stock ho
  const top = hits.slice(0, 12); if (top.length < 2) return top[0];
  const qk = String(q).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1).map(k2);
  let bo = top[0], bs = -1;
  top.forEach((o, i) => {
    const ws = String(o.it.name).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !/^\d/.test(w));
    const cov = ws.length && qk.length ? ws.filter(w => { const a = k2(w); return qk.some(x => a.startsWith(x) || x.startsWith(a)); }).length / ws.length : 0;
    const sc = (1 - i / top.length) + 0.6 * cov + (Number(o.it.stock) > 0 ? 0.3 : 0);
    if (sc > bs) { bs = sc; bo = o; }
  });
  return bo;
}
function matchOne(l, X, find, k2) {
  const qs = [...new Set([l.item, l.raw].map(q => String(q || '').trim()).filter(Boolean))];
  const tf = o => o.t, iL = o => 'it:' + o.id, iA = o => o.k;
  if (X.AL.length) for (const q of qs) { const r = find(X.AL, q, tf, iA, 5); if (r.hits.length) { const o = X.byId.get(r.hits[0].id); if (o) return { o, s: 0.95, how: 'alias' }; } }
  const first = [];
  for (let i = 0; i < qs.length; i++) { const r = find(X.L, qs[i], tf, iL, 40); first.push(r); if (r.hits.length) return { o: best(r.hits, qs[i], k2), s: i ? 0.8 : 0.9, how: 'naam' }; }
  for (const q of qs) {   // tadad / unit hata kar, phir ek lafz kam
    const toks = q.split(/[\s,.\-\/()+&]+/).filter(Boolean), core = toks.filter(t => !isNumTok(t) && !DROP.has(t.toLowerCase()));
    if (!core.length) continue;
    if (core.length < toks.length) { const r = find(X.L, core.join(' '), tf, iL, 40); if (r.hits.length) return { o: best(r.hits, core.join(' '), k2), s: 0.75, how: 'bina tadad' }; }
    if (core.length >= 2) for (let k = core.length - 1; k >= 0; k--) { const sub = core.filter((_, i) => i !== k); const r = find(X.L, sub.join(' '), tf, iL, 40); if (r.hits.length) return { o: best(r.hits, sub.join(' '), k2), s: sub.length >= 2 || GENERIC.has(core[k].toLowerCase()) ? 0.6 : 0.45, how: 'ek lafz kam' }; }
  }
  for (const r of first) if (r.near.length) return { o: r.near[0], s: 0.4, how: 'shayad' };
  return { o: null, s: 0, how: '' };
}
function rackOf(id, R) {
  const k = R && R.ic && R.ic[id]; if (!k) return '';
  return String((R.cn && R.cn[k]) || '').trim() || (k === '@khula' ? 'Khula maal' : title(k));
}
// lines (AI) → j (order doc ki JSON lines): { r raw, it AI naam, q, u, id, n POS naam, b box, s 0..1, rk? }
function matchLines(lines, X, find, k2, racks) {
  return (lines || []).map(l => {
    const m = X && X.L && X.L.length && find && k2 ? matchOne(l, X, find, k2) : { o: null, s: 0 };
    const o = m.o, s = Math.round(Math.min(m.s, Number(l.sure) || 0) * 100) / 100, rk = o ? rackOf(o.id, racks) : '';
    return { r: l.raw, it: l.item, q: l.qty, u: l.unit, id: o ? o.id : '', n: o ? String(o.it.name) : '', b: l.box || null, s, w: Number(l.sure) || 0, ...(l.col ? { c: l.col } : {}), ...(rk ? { rk } : {}) };   // v1.4: w = AI ka apna yaqeen (parhna + jori)
  });
}
const isUnclear = l => !l.id || !(Number(l.s) >= 0.5);
// print ki tarteeb: rack (webDukan/racks.order) → baqi → ❓ aakhir mein. App ki j apni asal tarteeb mein rehti hai.
function sortForPrint(j, R) {
  const ord = (R && Array.isArray(R.order)) ? R.order : [];
  const pos = l => { const k = R && R.ic && R.ic[l.id]; if (!k) return 1e7; const i = ord.indexOf(k); return i < 0 ? (k === '@khula' ? -1 : 1e6) : i; };
  const a = (j || []).map((l, i) => { const rk = R && R.ic ? rackOf(l.id, R) : String(l.rk || ''); const o = { ...l, i }; if (rk) o.rk = rk; else delete o.rk; return o; });   // rack ka naam abhi wala (dobara print par bhi)
  const clear = a.filter(l => !isUnclear(l)).sort((x, y) => (pos(x) - pos(y)) || String(x.rk || '').localeCompare(String(y.rk || '')) || (x.i - y.i));
  return { clear, unc: a.filter(isUnclear) };
}

// ---------- 🧾 thermal parchi (42 harf, Font A) ----------
//   (ESC a sirf line ke SHURU mein chalta hai — is liye har baayein line L0 se shuru, beech mein kabhi nahi)
function itemLines(l, box = '[ ] ') {   // qty naam ke AAGE usi line par (CLAUDE.md) — lamba naam agli line par
  const q = qtyStr(l.q, l.u), nm = ascii(l.n || l.it || l.r) || '?', room = W - box.length - q.length - 1;
  if (nm.length <= room) return [L0 + B1 + box + pad(nm, room) + ' ' + q + B0];
  let cut = nm.lastIndexOf(' ', room); if (cut < room * 0.5) cut = room;
  return [L0 + B1 + box + pad(nm.slice(0, cut).trim(), room) + ' ' + q + B0, ...wrap(nm.slice(cut).trim(), W - 4).map(s => L0 + '    ' + s)];
}
function headLines(o, opt = {}) {
  const out = [ESC + '@' + C1 + ESC + '!\x30' + 'NOOR TRADERS' + ESC + '!\x00'];   // ESC @ alag line par nahi (khali line = kaghaz)
  const dl = UR.dateLine ? UR.dateLine(o.day || dayOf(o.at || Date.now()), 56) : ''; if (dl) out.push(dl);
  out.push(C1 + GS + 'B\x01' + GS + '!\x11' + (opt.fail ? ' PARCHI - AI NAHI ' : ' PACKING-BILL BAAQI ') + GS + '!\x00' + GS + 'B\x00');
  if (UR.isOn()) out.push(UR.line('پیکنگ پرچی — بل باقی', 40, 1));
  if (opt.rp) out.push(C1 + ESC + '!\x08' + 'DOBARA PRINT (' + opt.rp + ')' + ESC + '!\x00');
  const nm = String(o.nm || '').trim();
  if (nm && hasUr(nm)) out.push(UR.line('گاہک: ' + nm, 40, 2));
  else if (nm) { out.push(L0 + B1 + 'Gahak: ' + ascii(nm).slice(0, W - 7) + B0); const u = UR.note ? UR.note(nm, 40, 'گاہک') : ''; if (u) out.push(u); }
  out.push(L0 + (o.ph ? GS + '!\x01' + B1 + 'Ph: ' + phPretty(o.ph) + B0 + GS + '!\x00' : 'Gahak ka number nahi'));
  out.push(L0 + line('Order #' + shortNo(o.id), dstr(o.at) + ' ' + tstr(o.at)));
  const src = o.src === 'app' || o.from === 'app' ? 'App' + (o.byName ? ': ' + ascii(o.byName).slice(0, 20) : '') : 'WhatsApp: ' + phPretty(o.from);
  out.push(L0 + line(src, opt.n != null ? opt.n + ' items' : ''));
  return out;
}
// P = sortForPrint(...) · opt { rp, crop: l => boolean } — ❓ wali line ki tasveer ke liye CRM nishan (raster baad mein)
function packingText(o, P, opt = {}) {
  const out = headLines(o, { rp: opt.rp, n: P.clear.length + P.unc.length });
  out.push(L0 + hr());
  const anyRk = P.clear.some(l => l.rk); let cur = null;
  for (const l of P.clear) {
    if (anyRk && String(l.rk || '') !== cur) { cur = String(l.rk || ''); out.push(C1 + '-- ' + (cur ? ascii(cur).slice(0, W - 6) : 'Baqi') + ' --'); }
    out.push(...itemLines(l));
    const ur = UR.get(l.id); if (ur) out.push(UR.line(ur, 30));
  }
  if (P.unc.length) {
    out.push(L0 + hr(), L0 + B1 + '?? SAMAJH NAHI AAYA - jaisa likha:' + B0);
    if (UR.isOn()) out.push(UR.line('سمجھ نہیں آیا — جیسا لکھا ہے', 30, 1));
    for (const l of P.unc) {
      out.push(...itemLines({ ...l, n: l.it || l.r }));
      const raw = String(l.r || '').trim();
      if (raw && hasUr(raw)) out.push(UR.line(raw, 34));
      else if (raw && ascii(raw).toLowerCase() !== ascii(l.it).toLowerCase()) out.push(...wrap('Likha: ' + ascii(raw), W - 4).map(s => L0 + '    ' + s));
      if (l.id && l.n) out.push(...wrap('Shayad: ' + ascii(l.n), W - 4).map(s => L0 + '    ' + s));
      if (opt.crop && opt.crop(l)) out.push(CRM + 'c' + l.i);
    }
  }
  out.push(L0 + hr(), L0 + line('Kul: ' + (P.clear.length + P.unc.length) + ' items', P.unc.length ? '??: ' + P.unc.length : 'Sab mil gaye'), '', CUT);
  return out.join('\r\n');
}
// AI na parh saka — parchi ki apni tasveer chhapo (larke tasveer dekh kar maal nikalein)
function failText(o, why, opt = {}) {
  const out = headLines(o, { rp: opt.rp, fail: true });
  out.push(L0 + hr(), L0 + B1 + 'AI NAHI PARH SAKA' + B0, ...wrap(ascii(why) || '-', W).map(s => L0 + s), L0 + (opt.photo ? 'Tasveer dekh kar maal nikalein:' : 'Parchi ki tasveer app / A4 mein dekhein.'));   // v1.3: thermal par lambi tasveer nahi
  if (opt.photo) out.push(CRM + 'photo');
  out.push('', CUT);
  return out.join('\r\n');
}
// v1.3: 🧾 parchi JAISI LIKHI — har line gahak ke apne lafz, shuru mein ☐ (tick). opt.raster = PowerShell wali tasveer (CRM 'L'); na ho to saada text.
const rawOf = l => String(l.r || '').replace(/\s+/g, ' ').trim() || [l.it || l.n || '', qtyStr(l.q, l.u)].filter(Boolean).join(' ').trim();
// v1.4: shak = AI ka apna yaqeen (w, purane order par s) 0.75 se kam ya lafz mein ؟ — us line ki likhai ka tukda bhi chhapo
const DOUBT = 0.9;   // v1.5: malik OK — 0.75 par ghalat lafz bina tukde nikal gaya
const doubtOf = l => /؟|\?/.test(String(l.r || '')) || (Number(l.w ?? l.s) || 0) < DOUBT;
function writtenLines(P) { return [...(P.clear || []), ...(P.unc || [])].sort((a, b) => (a.i ?? 0) - (b.i ?? 0)).map(l => ({ t: rawOf(l), b: l.b || null, d: doubtOf(l), c: Number(l.c) || 0, i: l.i ?? 0 })).filter(x => x.t); }
// opt.rows = PowerShell ne har line ki tasveer bana di (CRM 'L<k>') · opt.crops = Set(k) jin ka likhai tukda bana (CRM 'c<k>')
function writtenText(o, P, opt = {}) {
  const L = writtenLines(P), out = headLines(o, { rp: opt.rp, n: L.length }), crops = opt.crops || new Set();
  out.push(L0 + hr());
  L.forEach((x, k) => {
    if (k && x.c && L[k - 1].c && x.c !== L[k - 1].c) out.push(C1 + '. . . . . . . . . . . . . . . . . . . .');   // agli jori
    if (opt.rows) out.push(CRM + 'L' + k);
    else if (hasUr(x.t)) out.push(UR.line('[ ]  ' + x.t, 34));   // Urdu: shuru (daayein) mein [ ]
    else out.push(...wrap(ascii(x.t), W - 4).map((s, j) => L0 + B1 + (j ? '    ' : '[ ] ') + s + B0));
    if (crops.has(k)) out.push(CRM + 'c' + k);   // shak — likhai ka tukda
  });
  out.push(L0 + hr(), L0 + line('Kul: ' + L.length + ' lines', crops.size ? 'Tukde: ' + crops.size : ''), '', CUT);
  return out.join('\r\n');
}
// text (UR nishan + CRM nishan) → nt-parchi job { s: [...] } — Urdu = tasveer (nt-parchi worker), CRM = raster seedha
function toJob(text, rasters = {}) {
  const s = [], ls = String(text || '').split('\r\n'); let chunk = [];
  const flush = more => { if (chunk.length) { s.push(...UR.toJob(chunk.join('\r\n') + (more ? '\r\n' : ''), { font: FONT_UR, dots: 512 }).s); chunk = []; } };
  for (const l of ls) {
    if (l.startsWith(CRM)) { const r = rasters[l.slice(CRM.length)]; if (r) { flush(true); s.push({ r: Buffer.from(r, 'latin1').toString('base64') }); } continue; }
    chunk.push(l);
  }
  flush(false);
  return { s };
}
const stripEsc = t => String(t).split('\r\n').map(l => l.startsWith(UR.MARK) ? '[UR] ' + l.slice(UR.MARK.length).split('\u0001')[0] : l.startsWith(UR.NOTE) ? '[UR-NOTE] ' + l.slice(UR.NOTE.length).split('\u0001')[0] : l.startsWith(CRM) ? '[TASVEER ' + l.slice(CRM.length) + ']' : l.replace(/\x1b[@]|\x1b[aE!]./g, '').replace(/\x1d[B!]./g, '').replace(/\x1dV\x42\x00/g, '<<KAATO>>')).join('\n');

// v1.3: wa-a4.ps1 -Mode thlist ki BMP (24 / 32 bit) → ESC/POS 1-bit raster (GS v 0, 800 line ke tukde) latin1 · '' = nahi bani
function bmpRaster(buf, maxW = 512, ya = 0, yb = Infinity) {   // v1.4: ya..yb = sirf yeh lines (line-war)
  if (!buf || buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4D) return '';
  const off = buf.readUInt32LE(10), w = buf.readInt32LE(18), h0 = buf.readInt32LE(22), bpp = buf.readUInt16LE(28), comp = buf.readUInt32LE(30);
  const h = Math.abs(h0), up = h0 > 0;
  if (!(w > 0 && h > 0) || (bpp !== 24 && bpp !== 32) || (comp !== 0 && comp !== 3)) return '';
  const stride = Math.floor((bpp * w + 31) / 32) * 4, bp = bpp / 8, W2 = Math.min(w, maxW), bw = Math.ceil(W2 / 8);
  if (off + stride * h > buf.length) return '';
  const parts = [], Y0 = Math.max(0, Math.floor(ya)), Y1 = Math.min(h, yb === Infinity ? h : Math.floor(yb)); if (Y1 <= Y0) return '';
  for (let y0 = Y0; y0 < Y1; y0 += 800) {
    const hh = Math.min(800, Y1 - y0), o = Buffer.alloc(11 + bw * hh);
    Buffer.from([0x1b, 0x61, 0x00, 0x1d, 0x76, 0x30, 0x00, bw & 255, bw >> 8, hh & 255, hh >> 8]).copy(o, 0);
    for (let y = 0; y < hh; y++) {
      const row = off + (up ? h - 1 - (y0 + y) : y0 + y) * stride;
      for (let xb = 0; xb < bw; xb++) { let v = 0; for (let k = 0; k < 8; k++) { const x = xb * 8 + k; if (x < W2) { const q = row + x * bp; if (buf[q] + buf[q + 1] + buf[q + 2] < 384) v |= 0x80 >> k; } } o[11 + y * bw + xb] = v; }
    }
    parts.push(o);
  }
  return Buffer.concat(parts).toString('latin1');
}
// ---------- ✂️ likhai ki tasveer (thermal raster, GS v 0) ----------
function decodeJpeg(buf) { try { const img = require('./jpeg-decode.js')(buf, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 512 }); return img && img.width && img.height ? img : null; } catch { return null; } }
function padBox(b) {   // ~15% upar / neeche (Nastaliq ke sar / dum), thora daayein / baayein
  const [y0, x0, y1, x1] = b, h = y1 - y0, w = x1 - x0, py = Math.max(0.15 * h, 12), px = Math.max(0.04 * w, 12);
  return [Math.max(0, y0 - py), Math.max(0, x0 - px), Math.min(1000, y1 + py), Math.min(1000, x1 + px)].map(Math.round);
}
// img = decodeJpeg() · box [ymin,xmin,ymax,xmax] 0–1000 · → latin1 ESC/POS raster ('' = nahi bana). photo-print v2 jaisa (asal average, contrast, sharp, Atkinson)
function cropRaster(img, box, opt = {}) {
  if (!img || !img.width || !img.height || !box) return '';
  const maxW = Math.min(512, opt.w || 512), maxH = opt.h || 140, [y0, x0, y1, x1] = opt.raw ? box : padBox(box);
  const sx = Math.floor(x0 / 1000 * img.width), sy = Math.floor(y0 / 1000 * img.height);
  const sw = Math.min(img.width - sx, Math.ceil(x1 / 1000 * img.width) - sx), sh = Math.min(img.height - sy, Math.ceil(y1 / 1000 * img.height) - sy);
  if (sw < 4 || sh < 4) return '';
  const r8 = v => Math.max(8, Math.floor(v / 8) * 8);
  let Wd = r8(Math.min(maxW, sw * 2)), H = Math.max(1, Math.round(sh * Wd / sw));   // chhota tukda 2 guna tak bara
  if (H > maxH) { H = maxH; Wd = r8(Math.min(maxW, sw * H / sh)); }
  const g = new Float32Array(Wd * H), D = img.data;
  for (let y = 0; y < H; y++) {
    const ya = sy + Math.floor(y * sh / H), yb = Math.max(ya + 1, sy + Math.floor((y + 1) * sh / H));
    for (let x = 0; x < Wd; x++) {
      const xa = sx + Math.floor(x * sw / Wd), xb = Math.max(xa + 1, sx + Math.floor((x + 1) * sw / Wd)); let s = 0, n = 0;
      for (let yy = ya; yy < yb; yy++) { let i = (yy * img.width + xa) * 4; for (let xx = xa; xx < xb; xx++, i += 4) { s += 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]; n++; } }
      g[y * Wd + x] = n ? s / n : 255;
    }
  }
  const hist = new Array(256).fill(0); for (const v of g) hist[Math.max(0, Math.min(255, v | 0))]++;
  let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > g.length * 0.02) { lo = i; break; } } acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > g.length * 0.03) { hi = i; break; } }
  const span = Math.max(24, hi - lo), gam = opt.gamma || 1.25;   // likhai = kaghaz par qalam — thora gehra
  for (let i = 0; i < g.length; i++) { const v = Math.max(0, Math.min(1, (g[i] - lo) / span)); g[i] = 255 * Math.pow(v, gam); }
  const amt = opt.sharp == null ? 0.9 : Number(opt.sharp) || 0;
  if (amt > 0 && Wd > 2 && H > 2) {
    const b = new Float32Array(g.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= Wd) continue; s += g[yy * Wd + xx]; n++; } } b[y * Wd + x] = s / n; }
    for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, g[i] + amt * (g[i] - b[i])));
  }
  const bw = Wd / 8, out = Buffer.alloc(bw * H), add = (x, y, e) => { if (x >= 0 && x < Wd && y < H) g[y * Wd + x] += e; };
  for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
    const i = y * Wd + x, old = g[i], nv = old < 128 ? 0 : 255, e = (old - nv) / 8;
    if (nv === 0) out[y * bw + (x >> 3)] |= 0x80 >> (x & 7);
    add(x + 1, y, e); add(x + 2, y, e); add(x - 1, y + 1, e); add(x, y + 1, e); add(x + 1, y + 1, e); add(x, y + 2, e);
  }
  const hdr = Buffer.from([0x1b, 0x61, 0x01, 0x1d, 0x76, 0x30, 0x00, bw & 255, bw >> 8, H & 255, H >> 8]);
  return Buffer.concat([hdr, out, Buffer.from([0x0a, 0x1b, 0x61, 0x00])]).toString('latin1');
}

// ---------- 🖨 A4 page ka naqsha (wa-a4.ps1 ke liye JSON) ----------
function a4Spec(o, P, opt = {}) {
  const ur = UR.isOn(), rows = [], unc = []; let k = 0, cur = null; const anyRk = P.clear.some(l => l.rk);
  for (const l of P.clear) {
    if (anyRk && String(l.rk || '') !== cur) { cur = String(l.rk || ''); rows.push({ g: cur || 'Baqi' }); }
    rows.push({ k: ++k, nm: String(l.n || l.it || '').slice(0, 90), ur: ur ? UR.get(l.id) : '', q: qtyStr(l.q, l.u) });
  }
  for (const l of P.unc) unc.push({ k: ++k, raw: String(l.r || '').slice(0, 120), rtl: hasUr(l.r), it: 'AI: ' + String(l.it || '-').slice(0, 60) + '  ·  ' + qtyStr(l.q, l.u), g: l.id && l.n ? 'Shayad: ' + String(l.n).slice(0, 70) : '', box: l.b ? padBox(l.b) : null });
  const src = o.src === 'app' || o.from === 'app' ? 'App' + (o.byName ? ': ' + String(o.byName).slice(0, 30) : '') : 'WhatsApp: ' + phPretty(o.from);
  return { W: opt.W || 1654, H: opt.H || 2339, q: opt.q || 82, title: 'NOOR TRADERS', sub: opt.fail ? 'PACKING  -  BILL BAAQI  (AI nahi parh saka - tasveer dekhein)' : 'PACKING LIST  -  BILL BAAQI',
    urT: ur ? 'پیکنگ پرچی — بل باقی' : '', urD: ur && UR.dateUr ? UR.dateUr(o.day || dayOf(o.at)).t : '', when: dstr(o.at) + '  ' + tstr(o.at), no: shortNo(o.id),
    cust: String(o.nm || '').slice(0, 60), ph: o.ph ? phPretty(o.ph) : 'Gahak ka number nahi', from: src, rp: opt.rp ? 'DOBARA PRINT (' + opt.rp + ')' : '', fail: opt.fail ? String(opt.fail).slice(0, 160) : '',
    rows, unc, img: opt.img || '', foot: 'Kul ' + (P.clear.length + P.unc.length) + ' items' + (P.unc.length ? '   ·   ? samajh nahi aaye: ' + P.unc.length : '') + '   ·   Order #' + shortNo(o.id),
    fonts: { la: 'Segoe UI', ur: FONT_UR } };
}

// =========================================================
//  ASAL SCRIPT (PC)
// =========================================================
if (require.main === module) main();
module.exports = { normPh, isMob, phPretty, parseCaption, vcardInfo, numOf, normUnit, qtyStr, validBox, normLine, parseGemini, localTextLines, geminiRead, buildIndex, matchOne, matchLines, isUnclear, sortForPrint, rackOf, packingText, failText, writtenText, writtenLines, bmpRaster, toJob, stripEsc, decodeJpeg, padBox, cropRaster, a4Spec, dayOf, PROMPT_IMG, PROMPT_TXT, CRM, W };

function main() {
  const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(DIR, 'wa-parchi.alive'), w = () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000); return { guard: fn => fn }; } })();
  process.on('unhandledRejection', e => log('⚠️ (andar ki ghalti) ' + String((e && e.message) || e).slice(0, 200)));   // Baileys ki koi bhool poori script na giraye
  const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
  lock.on('error', () => { console.log('wa-parchi pehle se chal raha hai — yeh copy band.'); process.exit(3); });
  lock.on('listening', () => start(ZINDA).catch(e => { log('✕ shuru nahi hua: ' + (e && e.message)); setTimeout(() => process.exit(1), 2000); }));
}

async function start(ZINDA) {
  log(`wa-parchi v${VER} shuru — 📲 WhatsApp parchi → packing list (thermal + A4)`);
  try { fs.mkdirSync(TMP, { recursive: true }); } catch {}
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
  const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), BA = biz.collection('blueAccess');
  const ORD = biz.collection('parchiOrders'), IMG = biz.collection('parchiImg'), A4J = biz.collection('a4Jobs'), A4I = biz.collection('a4Img');
  const LINK = BA.doc('waLink');
  const authErr = e => { log('⚠️ listener: ' + e.message); if (e.code === 16 || /UNAUTHENTICATED/.test(String(e.message))) process.exit(1); };
  UR.watch(db, BUSINESS_ID, m => log(m));
  let PARCHI = null; const getParchi = () => PARCHI || (PARCHI = require('./nt-parchi.js').make({ dir: DIR, width: W, dots: 512 }));
  let PH = null; try { PH = require('./photo-print.js'); } catch {}

  // ---------- 🔗 link ki haalat (app) — har likhai POORA doc, ek waqt ek (CLAUDE.md bug safai 1) ----------
  let L = { st: 'off', qr: '', me: '', err: '', cmd: 0 };
  try { const s = await LINK.get(); if (s.exists) { const d = s.data() || {}; L.cmd = Number(d.cmd) || 0; L.me = String(d.me || ''); } } catch (e) { log('⚠️ waLink: ' + e.message); }
  let lw = Promise.resolve(), lastLinkW = 0;
  const setLink = p => { Object.assign(L, p || {}); L.at = Date.now(); L.host = os.hostname(); L.ver = VER; const snap = { ...L }; lastLinkW = Date.now(); lw = lw.then(() => LINK.set(snap)).catch(e => log('⚠️ waLink likha nahi: ' + e.message)); return lw; };

  // ---------- ⚙️ settings + data (live) ----------
  let S = { on: true, allow: [], th: true, a4: true, thp: '' }, sReady; const settingsReady = new Promise(r => { sReady = r; });
  BA.doc('waParchi').onSnapshot(s => {
    const d = (s.exists && s.data()) || {};
    S = { on: d.on !== false, allow: [...new Set((Array.isArray(d.allow) ? d.allow : []).map(normPh).filter(Boolean))], th: d.th !== false, a4: d.a4 !== false, thp: String(d.thp || '').trim() };
    sReady();
  }, e => { authErr(e); sReady(); });
  setTimeout(() => sReady(), 20000);
  let AI = { key: '', model: '' };
  BA.doc('aiConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; AI = { key: String(d.key || ''), model: String(d.model || '') }; }, authErr);
  let ALIAS = {}, URDU = {}, HIDDEN = {}, RACKS = { order: [], ic: {}, cn: {} }, dataVer = 0;
  BA.doc('itemAliases').onSnapshot(s => { ALIAS = (s.exists && (s.data() || {}).map) || {}; dataVer++; }, authErr);
  BA.doc('urduNames').onSnapshot(s => { URDU = (s.exists && (s.data() || {}).map) || {}; dataVer++; }, authErr);
  biz.collection('stockCount').doc('_hidden').onSnapshot(s => { HIDDEN = (s.exists && (s.data() || {}).items) || {}; dataVer++; }, authErr);
  biz.collection('webDukan').doc('racks').onSnapshot(s => { const d = (s.exists && s.data()) || {}; RACKS = { order: Array.isArray(d.order) ? d.order : [], ic: d.ic || {}, cn: d.cn || {} }; }, authErr);

  // ---------- 📦 dukan ke items (posStock b1) — 30 min ka cache ----------
  let CAT = { at: 0, items: [] }, catP = null, IX = null, ixKey = '';
  const catalog = async () => {
    if (CAT.items.length && Date.now() - CAT.at < 30 * 60000) return CAT;
    if (!catP) catP = (async () => {
      try {
        const s = await biz.collection('posStock').where('branch', '==', 1).get(), items = [];
        for (const d of s.docs) { const x = d.data() || {}; if (x.meta || !Array.isArray(x.items)) continue; for (const it of x.items) if (it && it.id != null && it.name) items.push(it); }
        CAT = { at: Date.now(), items }; log(`📦 dukan ke ${items.length} items aa gaye`);
      } catch (e) { log('⚠️ items nahi mile: ' + e.message); } finally { catP = null; }
      return CAT;
    })();
    return catP;
  };
  let D = null; const dh = async () => D || (D = await import(pathToFileURL(path.join(DIR, 'dhoond.mjs')).href));
  const index = async () => { const c = await catalog(), k = c.at + ':' + dataVer; if (!IX || ixKey !== k) { IX = buildIndex(c.items, { alias: ALIAS, urdu: URDU, hidden: HIDDEN }); ixKey = k; } return IX; };

  // ---------- 🖼 tasveer (sharp ho to — Baileys ke saath aata hai; na ho to PowerShell) ----------
  let SHARP; const sharp = () => { if (SHARP === undefined) { try { SHARP = require(require.resolve('sharp', { paths: [MODS, DIR] })); } catch { SHARP = null; } } return SHARP; };
  const isJpeg = b => b && b.length > 3 && b[0] === 0xFF && b[1] === 0xD8;
  const dataUrl = b => 'data:image/jpeg;base64,' + b.toString('base64');
  const fitsUrl = (b, max) => b && Math.ceil(b.length / 3) * 4 + 23 <= max;
  const ps = (args, ms = 60000) => new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PS1, ...args.map(String)], { timeout: ms, windowsHide: true, maxBuffer: 4 << 20 },
    (e, out, er) => res({ ok: !e, out: String(out || '').trim(), err: String(String(er || '').trim() || (e && e.message) || '').trim().split(/\r?\n/)[0] })));
  async function prepImage(buf, mime) {   // → { jpg (crop / A4), gem + gm (AI ko), full (parchiImg data URL ya '') }
    let jpg = isJpeg(buf) ? buf : null; const S2 = sharp();
    if (S2 && (!jpg || !fitsUrl(jpg, IMG_MAX))) {
      for (const [w, q] of [[2000, 80], [1600, 75], [1280, 70]]) { try { const b = await S2(buf).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q }).toBuffer(); jpg = b; if (fitsUrl(b, IMG_MAX)) break; } catch (e) { log('⚠️ tasveer chhoti nahi hui: ' + e.message); break; } }
    }
    return { jpg, gem: jpg || buf, gm: jpg ? 'image/jpeg' : (mime || 'image/jpeg'), full: jpg && fitsUrl(jpg, IMG_MAX) ? dataUrl(jpg) : '' };
  }
  async function thumbOf(jpg) {
    if (!jpg) return '';
    const S2 = sharp();
    if (S2) { for (const [w, q] of [[360, 60], [300, 50], [220, 45]]) { try { const b = await S2(jpg).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q }).toBuffer(); if (fitsUrl(b, TH_MAX)) return dataUrl(b); } catch { break; } } return ''; }
    if (process.platform !== 'win32' || !fs.existsSync(PS1)) return '';
    const fi = path.join(TMP, 'th-in-' + Date.now() + '.jpg'), fo = fi.replace('th-in-', 'th-out-');
    try { fs.writeFileSync(fi, jpg); for (const [m, q] of [[360, 60], [260, 50]]) { const r = await ps(['-Mode', 'thumb', '-In', fi, '-Out', fo, '-Max', m, '-Q', q], 30000); if (r.out.includes('OK') && fs.existsSync(fo)) { const b = fs.readFileSync(fo); if (fitsUrl(b, TH_MAX)) return dataUrl(b); } } } catch {}
    finally { for (const f of [fi, fo]) { try { fs.unlinkSync(f); } catch {} } }
    return '';
  }

  // ---------- 🧾 thermal + 🖨 A4 ----------
  const errs = new Map();   // id → { te, ae } (perr dono ka)
  const trim = (m, n = 500) => { while (m.size > n) m.delete(m.keys().next().value); };
  const perrOf = id => { const e = errs.get(id) || {}; return [e.te ? 'Thermal: ' + e.te : '', e.ae ? 'A4: ' + e.ae : ''].filter(Boolean).join(' · ').slice(0, 300); };
  // v1.2: app ne parchi hata di (st 'x:…') ho to naya haal bhi chhupa hi likho ('x:ok') — hatai hui parchi wapas list mein na aaye
  const upd = (id, p) => db.runTransaction(async tx => {
    const ref = ORD.doc(id), s = await tx.get(ref), now = s.exists ? String((s.data() || {}).st || '') : '', q = { ...p, upAt: Date.now() };
    if (typeof q.st === 'string' && /^x:/.test(now) && !/^x:/.test(q.st)) q.st = 'x:' + q.st;
    tx.update(ref, q);
  }).catch(e => log(`⚠️ ${id} likha nahi: ${e.message}`));
  async function writtenRaster(L) {   // v1.4: wa-a4.ps1 -Mode thlist → { k: raster latin1 } har line alag · {} = saada text chalega
    if (!L.length || process.platform !== 'win32' || !fs.existsSync(PS1)) return {};
    const spec = path.join(TMP, 'thl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.json'), outF = spec.replace(/\.json$/, '.bmp');
    try {
      fs.writeFileSync(spec, JSON.stringify({ lines: L.map(x => ({ t: x.t })), fonts: { la: 'Arial', ur: FONT_UR }, pxU: 36, pxL: 28 }), 'utf8');
      const r = await ps(['-Mode', 'thlist', '-Spec', spec, '-Out', outF], 40000);
      const hs = ((r.out.match(/H:([\d,]+)/) || [])[1] || '').split(',').map(Number).filter(n => n > 0);
      if (r.out.includes('OK') && fs.existsSync(outF) && hs.length === L.length) {
        const buf = fs.readFileSync(outF), m = {}; let y = 0;
        for (let k = 0; k < hs.length; k++) { const x = bmpRaster(buf, 512, y, y + hs[k]); y += hs[k]; if (!x) return {}; m[k] = x; }
        return m;
      }
      log('🧾 jaisi-likhi tasveer nahi bani (' + (r.err || r.out || '?').slice(0, 80) + ') — saada text');
    } catch (e) { log('🧾 jaisi-likhi: ' + e.message); }
    finally { for (const f of [spec, outF]) { try { fs.unlinkSync(f); } catch {} } }
    return {};
  }
  async function printThermal(o, P, img, opt) {
    let text, rasters = {};
    if (opt.fail) text = failText(o, opt.fail, { rp: opt.rp, photo: false });   // v1.3: thermal par lambi tasveer nahi (A4 / app mein hai)
    else {   // v1.3: parchi jaisi likhi + ☐ · v1.4: shak wali line ke neeche likhai ka tukda
      const L = writtenLines(P), rows = await writtenRaster(L), crops = new Set();
      for (const k in rows) rasters['L' + k] = rows[k];
      L.forEach((x, k) => { if (x.d && img && x.b) { try { const c = cropRaster(img, x.b, { h: 170 }); if (c) { rasters['c' + k] = c; crops.add(k); } } catch {} } });
      text = writtenText(o, P, { rp: opt.rp, rows: Object.keys(rows).length === L.length, crops });
    }
    try { text = await UR.fillNotes(text, 4000); } catch { text = UR.strip(text); }
    const e = await getParchi().sendJobs([toJob(text, rasters)], S.thp || TH_PRINTER);
    if (e) throw e;
  }
  const a4Watch = new Map();
  function watchA4(id, aids) {
    if (!aids.length || a4Watch.has(id)) return;
    const st = {}, un = []; let end = null;
    const stop = () => { un.forEach(u => { try { u(); } catch {} }); clearTimeout(end); a4Watch.delete(id); };
    end = setTimeout(stop, 40 * 60000);
    a4Watch.set(id, stop);
    for (const aid of aids) un.push(A4J.doc(aid).onSnapshot(s => {
      const d = (s.exists && s.data()) || {}; st[aid] = s.exists ? String(d.status || '') : 'gone';
      const all = aids.map(a => st[a]), bad = aids.find(a => /^(failed|old|hold|gone)$/.test(st[a] || ''));
      if (bad) { const d2 = st[bad] === 'hold' ? 'ghante ki hadd — app ki A4 screen mein ✓' : st[bad] === 'gone' ? 'A4 job mit gaya' : String(d.err || st[bad]).slice(0, 140); const e = errs.get(id) || {}; e.ae = d2; errs.set(id, e); upd(id, { 'pr.a4': 'failed', perr: perrOf(id) }); stop(); log(`🖨 ✕ A4 ${id}: ${d2}`); }
      else if (all.every(x => x === 'done')) { const e = errs.get(id) || {}; e.ae = ''; errs.set(id, e); upd(id, { 'pr.a4': 'done', perr: perrOf(id) }); stop(); log(`🖨 ✅ A4 ${id} chhap gaya`); }
    }, () => {}));
  }
  async function printA4(o, P, opt) {
    if (process.platform !== 'win32') throw Error('A4 sirf Windows PC par');
    if (!fs.existsSync(PS1)) throw Error('wa-a4.ps1 nahi mili');
    const base = path.join(TMP, o.id + '-' + Date.now()), specF = base + '.json', imgF = opt.jpg ? base + '-parchi.jpg' : '';
    if (imgF) fs.writeFileSync(imgF, opt.jpg);
    const files = [specF, imgF].filter(Boolean);
    try {
      let pages = [];
      for (const [Wd, Hd, q] of [[1654, 2339, 82], [1654, 2339, 65], [1240, 1754, 60]]) {
        fs.writeFileSync(specF, JSON.stringify(a4Spec(o, P, { W: Wd, H: Hd, q, rp: opt.rp, fail: opt.fail, img: imgF })), 'utf8');
        const r = await ps(['-Mode', 'page', '-Spec', specF, '-Out', base + '-a4'], 90000);
        const outs = r.out.split(/\r?\n/).filter(x => x.startsWith('OK ')).map(x => x.slice(3).trim()).filter(f => fs.existsSync(f));
        outs.forEach(f => files.push(f));
        if (!outs.length) throw Error((r.out.replace(/^ERR:?/, '') || r.err || 'A4 page nahi bana').slice(0, 160));
        pages = outs.map(f => fs.readFileSync(f));
        if (pages.every(b => fitsUrl(b, A4_MAX))) break;
        pages = [];
      }
      if (!pages.length) throw Error('A4 page bohat bara (1 MB+)');
      const aids = pages.map((_, k) => o.id + (opt.rp ? '-r' + opt.rp : '') + (pages.length > 1 ? '-p' + (k + 1) : ''));
      const b = db.batch(), now = Date.now(), t = ('WA parchi ' + (o.nm || phPretty(o.ph) || '#' + shortNo(o.id))).slice(0, 60);
      pages.forEach((buf, k) => {
        b.set(A4I.doc(aids[k]), { img: dataUrl(buf), by: 'wa-parchi', at: now });
        b.set(A4J.doc(aids[k]), { k: 'wa', to: 'a4', ph: shortNo(o.id), t: pages.length > 1 ? (t + ' ' + (k + 1) + '/' + pages.length).slice(0, 60) : t, th: '', by: 'wa-parchi', byName: 'WhatsApp', at: now, status: 'new', copies: 1, src: o.id });
      });
      await b.commit();
      return aids;
    } finally { for (const f of files) { try { fs.unlinkSync(f); } catch {} } }
  }
  // thermal aur A4 alag alag — ek ruke to doosra nahi (CLAUDE.md bug safai 4). Print KABHI khud dobara nahi.
  async function printOrder(o, j, jpg, opt = {}) {
    const P = opt.fail ? { clear: [], unc: [] } : sortForPrint(j, RACKS), wantT = S.th !== false, wantA = S.a4 !== false;
    const img = !opt.fail && jpg && P.unc.some(l => l.b) ? decodeJpeg(jpg) : null;
    const e0 = { te: '', ae: '' }; errs.delete(o.id); errs.set(o.id, e0); trim(errs);
    const stopOld = a4Watch.get(o.id); if (stopOld) stopOld();   // dobara print — purane A4 ki khabar nahi
    await upd(o.id, { 'pr.th': wantT ? 'printing' : 'off', 'pr.a4': wantA ? 'printing' : 'off', perr: '' });
    const t0 = Date.now();
    const [rt, ra] = await Promise.all([
      wantT ? printThermal(o, P, img, { ...opt, jpg }).then(() => 'done', e => { e0.te = String((e && e.message) || e).slice(0, 140); return 'failed'; }) : 'off',
      wantA ? printA4(o, P, { ...opt, jpg }).then(aids => ({ st: 'sent', aids }), e => { e0.ae = String((e && e.message) || e).slice(0, 140); return { st: 'failed' }; }) : { st: 'off' }
    ]);
    const n = Number(o.pr && o.pr.n) || 0;
    if (o.pr) o.pr.n = n + 1;
    await upd(o.id, { 'pr.th': rt, 'pr.a4': ra.st, 'pr.at': Date.now(), 'pr.n': n + 1, ...(ra.aids ? { 'pr.a4j': ra.aids } : {}), perr: perrOf(o.id) });
    if (ra.aids) watchA4(o.id, ra.aids);   // 'sent' likhne ke BAAD (warna tez A4 ka 'done' pehle likha jata aur 'sent' us ko mita deta)
    log(`🧾 #${shortNo(o.id)} thermal ${rt}${e0.te ? ' (' + e0.te + ')' : ''} · A4 ${ra.st}${e0.ae ? ' (' + e0.ae + ')' : ''} · ${Date.now() - t0} ms`);
  }

  // ---------- 🔄 ek order ka poora kaam (queue — ek waqt ek) ----------
  const live = new Map();   // id → order (jab tak queue mein — contact card naam / number yahin jore)
  async function readOrder(o, g) {   // → { res } ya throw
    if (g && g.gem) return (await geminiRead({ key: AI.key, model: AI.model, b64: g.gem.toString('base64'), mime: g.gm, ms: 75000 })).res;   // v1.4: sochne ka waqt
    const txt = String(o.txt || '').trim(); if (!txt) throw Error('na tasveer na likhai');
    try { return (await geminiRead({ key: AI.key, model: AI.model, text: txt })).res; }
    catch (e) { log(`🤖 likhi list AI se nahi parhi (${String(e.message).slice(0, 80)}) — bina AI`); return localTextLines(txt); }
  }
  async function processOrder(o, buf, mime, g0, prev) {
    live.set(o.id, o); const t0 = Date.now();
    try {
      const g = g0 || (buf ? await prepImage(buf, mime) : null);
      if (g && g.jpg && !o.th) { const th = await thumbOf(g.jpg); if (th) { o.th = th; await upd(o.id, { th }); } }
      let R;
      try { R = await readOrder(o, g); }
      catch (e) {
        const why = String(e.message || e).slice(0, 160);
        await upd(o.id, { st: 'fail', err: why, n: 0, u: 0 });
        log(`✕ #${shortNo(o.id)} AI nahi parh saka: ${why}`);
        if (g && g.jpg) await printOrder(o, [], g.jpg, { fail: why });   // tasveer hi chhaap do — larke dekh kar nikal lein
        return;
      }
      if (!R.isOrder) {
        await upd(o.id, { st: 'skip', err: 'Yeh order ki parchi nahi lagti', n: 0, u: 0, 'pr.th': 'off', 'pr.a4': 'off' });
        log(`⏭ #${shortNo(o.id)} order nahi (${o.txt ? 'likhai' : 'tasveer'})`);
        if (o.src === 'wa') { const r = recent.get(o.from); if (r && r.id === o.id) { if (prev) recent.set(o.from, prev); else recent.delete(o.from); } }   // yeh "order" nahi tha — pichhla order hi taza
        if (o.txt && !g && prev) await nameToRecent(o, prev);
        return;
      }
      if (!o.ph && R.phone) o.ph = R.phone;
      if (!o.nm && R.name) o.nm = R.name;
      let X = null, Dh = null; try { [X, Dh] = await Promise.all([index(), dh()]); } catch (e) { log('⚠️ milan: ' + e.message); }
      const j = matchLines(R.lines, X, Dh ? Dh.smartFind : null, Dh ? Dh.k2 : null, RACKS), u = j.filter(isUnclear).length;
      o.j = JSON.stringify(j); o.st = 'ok';
      await upd(o.id, { st: 'ok', err: '', j: o.j, n: j.length, u, ph: o.ph || '', nm: o.nm || '', 'pr.th': S.th !== false ? 'wait' : 'off', 'pr.a4': S.a4 !== false ? 'wait' : 'off' });
      log(`✅ #${shortNo(o.id)} ${j.length} items (❓ ${u}) · ${o.nm || '-'} ${o.ph || ''} · ${Date.now() - t0} ms`);
      await printOrder(o, j, g && g.jpg);
    } finally { live.delete(o.id); }
  }
  async function reprint(id, rq) {
    const s = await ORD.doc(id).get(); if (!s.exists) return; const o = { id, ...s.data() };
    await upd(id, { 'pr.rq': rq });
    let jpg = null; try { const im = await IMG.doc(id).get(); const u = im.exists ? String(im.data().img || '') : '', m = u.match(/^data:image\/jpe?g;base64,(.+)$/i); if (m) jpg = Buffer.from(m[1], 'base64'); } catch {}
    const rp = Number(o.pr && o.pr.n) || 1;   // pehli dafa ke baad "DOBARA PRINT (1)"
    if (o.st === 'ok') { let j = []; try { j = JSON.parse(o.j || '[]'); } catch {} log(`🔁 #${shortNo(id)} dobara print`); await printOrder(o, Array.isArray(j) ? j : [], jpg, { rp }); }
    else if (o.st === 'fail' && jpg) { log(`🔁 #${shortNo(id)} dobara print (tasveer)`); await printOrder(o, [], jpg, { rp, fail: o.err || 'AI nahi parh saka' }); }
    else await upd(id, { perr: 'Dobara print nahi — order abhi tayyar nahi (' + (o.st || '?') + ')' });
  }
  const Q = [], inQ = new Set(); let qBusy = false;
  const runJob = ZINDA.guard(async job => {
    if (job.kind === 'new') await processOrder(job.o, job.buf, job.mime, job.g, job.prev);
    else if (job.kind === 're') await reprint(job.id, job.rq);
  }, 8 * 60000, 'parchi');
  const jobId = job => job.kind + ':' + (job.kind === 'new' ? job.o.id : job.id);   // naya parhna aur dobara print alag
  const enqueue = job => { if (job.kind === 'new' && inQ.has(jobId(job))) return; inQ.add(jobId(job)); Q.push(job); pump(); };
  async function pump() { if (qBusy) return; qBusy = true; try { while (Q.length) { const j = Q.shift(); try { await runJob(j); } catch (e) { log('⚠️ kaam: ' + (e && e.message)); } finally { if (!Q.some(x => jobId(x) === jobId(j))) inQ.delete(jobId(j)); } } } finally { qBusy = false; } }

  // ---------- 📇 naam / number baad mein (contact card / sirf number wali likhai) ----------
  const recent = new Map(), pend = new Map();   // from → { id, at, ph, nm } (aakhri WA order) · from → { ph, nm, at } (order se pehle aaya card)
  async function attachTo(r, info, how) {
    const o = live.get(r.id), p = {};
    if (info.ph && !r.ph) { p.ph = info.ph; r.ph = info.ph; }
    if (info.nm && !r.nm) { p.nm = String(info.nm).slice(0, 60); r.nm = p.nm; }
    if (!Object.keys(p).length) return false;
    if (o) Object.assign(o, p);   // abhi chhapa nahi — parchi par bhi aa jayega
    await upd(r.id, p); log(`📇 #${shortNo(r.id)} ${how}: ${p.nm || ''} ${p.ph || ''}`); return true;
  }
  async function attach(from, info, how) {
    const r = recent.get(from); if (!r || Date.now() - r.at > LINK_WIN + 60000) { pend.set(from, { ...info, at: Date.now() }); trim(pend, 50); return false; }
    return attachTo(r, info, how);
  }
  async function nameToRecent(o, prev) {   // "Ahmed bhai" jaisi likhai jo order nahi — pichhle order ka naam
    const t = String(o.txt || '').trim(); if (t.length > 40 || /\n/.test(t) || Date.now() - prev.at > LINK_WIN + 60000) return;
    if (await attachTo(prev, { nm: t }, 'naam')) await upd(o.id, { err: 'Naam pichhle order #' + shortNo(prev.id) + ' mein laga' });
  }

  // ---------- 🆕 naya order (WhatsApp) ----------
  let lastBase = '', idN = 0;
  const newId = p => { let id = p + Date.now().toString(36); if (id === lastBase) id += (++idN).toString(36); else { lastBase = id; idN = 0; } return id; };
  async function createWa({ from, cap, txt, buf, mime, wid, mt, fail }) {
    const id = newId('w'), now = Date.now(), c = parseCaption(cap);
    const pc = pend.get(from); if (pc && now - pc.at < LINK_WIN) { if (!c.ph && pc.ph) c.ph = pc.ph; if (!c.nm && pc.nm) c.nm = pc.nm; pend.delete(from); }
    const o = { id, src: 'wa', at: now, day: dayOf(now), from, ph: c.ph, nm: c.nm, cap: String(cap || '').slice(0, 300), th: '', txt: String(txt || '').slice(0, 4000), st: fail ? 'fail' : 'read', j: '', n: 0, u: 0,
      pr: { th: fail ? 'off' : 'wait', a4: fail ? 'off' : 'wait', at: 0, n: 0 }, perr: '', err: fail ? String(fail).slice(0, 160) : '', upAt: now, wid: String(wid || ''), mt: Number(mt) || 0 };
    let g = null;
    if (buf) { try { g = await prepImage(buf, mime); } catch (e) { log('⚠️ tasveer: ' + e.message); } }
    const b = db.batch(); b.set(ORD.doc(id), o); if (g && g.full) b.set(IMG.doc(id), { img: g.full, at: now }); await b.commit();
    const prev = recent.get(from);
    if (!fail) recent.set(from, { id, at: now, ph: o.ph, nm: o.nm });
    log(`📥 #${shortNo(id)} ${buf ? 'tasveer' : fail ? 'ghalti' : 'likhi list'} — ${phPretty(from)}${o.nm ? ' · ' + o.nm : ''}${o.ph ? ' · ' + o.ph : ''}${buf && !(g && g.full) ? ' (tasveer bari — poori save nahi)' : ''}${fail ? ' — ' + fail : ''}`);
    if (!fail) enqueue({ kind: 'new', o, buf, mime, g, prev });
  }

  // ---------- 📱 app ke order (st 'new') + dobara parhna ----------
  const claiming = new Set();
  async function claimNew(id) {
    if (claiming.has(id)) return; claiming.add(id);
    try {
      const ref = ORD.doc(id);
      const o = await db.runTransaction(async tx => {
        const s = await tx.get(ref); if (!s.exists) return null; const d = s.data() || {}; if (d.st !== 'new') return null;
        const t0 = s.updateTime ? s.updateTime.toMillis() : Number(d.at) || 0;   // server ka waqt
        if (Date.now() - t0 > MAX_AGE) { tx.update(ref, { st: 'fail', err: '24 ghante se purana — dobara bhejein', upAt: Date.now() }); return null; }
        tx.update(ref, { st: 'read', err: '', pcAt: Date.now(), upAt: Date.now(), 'pr.th': 'wait', 'pr.a4': 'wait' });
        return { id, ...d };
      });
      if (!o) return;
      o.src = o.src || 'app'; o.from = o.from || 'app'; o.at = Number(o.at) || Date.now(); o.day = o.day || dayOf(o.at); o.pr = o.pr || {};
      if (!o.ph || !o.nm) { const c = parseCaption(o.cap); if (!o.ph) o.ph = c.ph; if (!o.nm && !o.txt) o.nm = c.nm; }
      let buf = null; try { const im = await IMG.doc(id).get(); const u = im.exists ? String(im.data().img || '') : '', m = u.match(/^data:image\/[a-z]+;base64,(.+)$/i); if (m) buf = Buffer.from(m[1], 'base64'); } catch {}
      if (!buf && !String(o.txt || '').trim()) { await upd(id, { st: 'fail', err: 'tasveer / likhai nahi mili' }); return; }
      log(`📥 #${shortNo(id)} app se (${o.byName || o.by || '-'})`);
      enqueue({ kind: 'new', o, buf, mime: 'image/jpeg' });
    } catch (e) { log('⚠️ app order ' + id + ': ' + e.message); }
    finally { claiming.delete(id); }
  }
  ORD.where('st', '==', 'new').onSnapshot(s => { for (const d of s.docs) claimNew(d.id); }, authErr);
  // v1.1: model ki ghalti (AI 404 / Google ne model band kiya) se fail hui pichhle 3 ghante ki parchiyan EK dafa khud dobara (rr:1 = dobara nahi)
  setTimeout(async () => {
    try {
      const s = await ORD.where('st', '==', 'fail').limit(60).get();
      for (const d of s.docs) {
        const x = d.data() || {};
        if (x.rr || Date.now() - (Number(x.at) || 0) > 3 * 3600000 || !/AI 404|no longer available|not found/i.test(String(x.err || ''))) continue;
        await d.ref.update({ st: 'new', err: '', rr: 1, upAt: Date.now() });
        log(`🔁 #${shortNo(d.id)} model ki ghalti se ruki thi — dobara parh raha`);
      }
    } catch (e) { log('⚠️ dobara parhna: ' + e.message); }
  }, 20000);
  const rqBusy = new Set();
  ORD.orderBy('prReq', 'desc').limit(30).onSnapshot(s => {
    for (const d of s.docs) {
      const x = d.data() || {}, rq = Number(x.prReq) || 0, done = Number(x.pr && x.pr.rq) || 0, key = d.id + ':' + rq;
      if (!rq || rq === done || rqBusy.has(key)) continue; rqBusy.add(key);
      const age = Date.now() - (d.updateTime ? d.updateTime.toMillis() : 0);
      if (age > OLD_RQ) { upd(d.id, { 'pr.rq': rq, perr: 'Dobara print ki darkhwast purani (30 min+) — phir dabayein' }); continue; }
      enqueue({ kind: 're', id: d.id, rq });
    }
  }, authErr);
  // shuru: beech mein ruke order — AI baqi = dobara parho · print beech mein = 'failed' (KHUD dobara print nahi)
  setTimeout(async () => {
    try {
      const s = await ORD.where('at', '>=', Date.now() - MAX_AGE).get(); let n = 0;
      for (const d of s.docs) {
        const o = { id: d.id, ...d.data() }; if (live.has(o.id) || claiming.has(o.id) || inQ.has('new:' + o.id)) continue; const pr = o.pr || {};
        if (o.st === 'read' && !o.j) {
          let buf = null; try { const im = await IMG.doc(o.id).get(); const u = im.exists ? String(im.data().img || '') : '', m = u.match(/^data:image\/[a-z]+;base64,(.+)$/i); if (m) buf = Buffer.from(m[1], 'base64'); } catch {}
          if (buf || String(o.txt || '').trim()) { enqueue({ kind: 'new', o, buf, mime: 'image/jpeg' }); n++; } else await upd(o.id, { st: 'fail', err: 'tasveer save nahi thi — dobara bhejein' });
        } else if (/^(wait|printing)$/.test(pr.th || '') || /^(wait|printing)$/.test(pr.a4 || '')) {
          const p = { perr: 'PC beech mein band hua — 🖨 Dobara print dabayein' }; if (/^(wait|printing)$/.test(pr.th || '')) p['pr.th'] = 'failed'; if (/^(wait|printing)$/.test(pr.a4 || '')) p['pr.a4'] = 'failed';
          await upd(o.id, p); n++;
        } else if (pr.a4 === 'sent' && Array.isArray(pr.a4j)) watchA4(o.id, pr.a4j);
      }
      if (n) log(`↻ ${n} adhoore order sambhale`);
    } catch (e) { log('⚠️ purane order: ' + e.message); }
  }, 8000);

  // ---------- 📲 WhatsApp (Baileys) ----------
  const B = await loadBaileys(setLink, () => !qBusy && !Q.length);
  if (!B) return;   // install / ghalti — loadBaileys khud sambhalta hai
  const makeWASocket = B.default || B.makeWASocket;
  let pino = null; try { pino = require(require.resolve('pino', { paths: [MODS] })); } catch {}
  const quiet = { level: 'silent', trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return quiet; } };
  const logger = pino ? pino({ level: 'silent' }) : quiet;
  const seen = (() => { try { return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')).ids || []; } catch { return []; } })(), seenSet = new Set(seen);
  let seenT = null; const markSeen = id => { if (!id || seenSet.has(id)) return; seen.push(id); seenSet.add(id); while (seen.length > 500) seenSet.delete(seen.shift()); clearTimeout(seenT); seenT = setTimeout(() => { try { fs.writeFileSync(SEEN_FILE, JSON.stringify({ ids: seen })); } catch {} }, 500); };
  const told = new Map(); const tellOnce = (k, m) => { if (Date.now() - (told.get(k) || 0) < 3600000) return; told.set(k, Date.now()); log(m); };
  let sock = null, gen = 0, retry = 0, retryT = null, version = null;
  const wipeAuth = () => { try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) { log('⚠️ wa-auth nahi mita: ' + e.message); } };
  const endSock = () => { gen++; clearTimeout(retryT); const s = sock; sock = null; try { s && s.end(undefined); } catch {} };
  async function connect(why) {
    endSock(); const my = gen;
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(AUTH_DIR);
    if (!version) { try { const v = await within(B.fetchLatestBaileysVersion(), 10000, 'WA version'); if (v && Array.isArray(v.version)) version = v.version; } catch {} }
    if (my !== gen) return;
    log(`📲 WhatsApp se jor raha hai (${why || 'shuru'})${state.creds.registered ? '' : ' — QR banega'}`);
    const s = makeWASocket({ auth: state, logger, browser: B.Browsers.windows('Chrome'), markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: j => !!(B.isJidGroup(j) || B.isJidBroadcast(j) || B.isJidNewsletter(j)), generateHighQualityLinkPreview: false, connectTimeoutMs: 30000, getMessage: async () => undefined, ...(version ? { version } : {}) });
    sock = s;
    s.ev.on('creds.update', saveCreds);
    s.ev.on('connection.update', u => { if (my === gen) onConn(u, s, state).catch(e => log('⚠️ link: ' + e.message)); });
    s.ev.on('messages.upsert', ev => { if (my === gen) for (const m of (ev && ev.messages) || []) intake(m, s); });
  }
  async function onConn(u, s, state) {
    if (u.qr) { setLink({ st: 'qr', qr: u.qr, err: '' }); log('🔳 naya QR — app mein dukan ke phone se scan karein'); }
    if (u.connection === 'open') { retry = 0; const me = normPh((s.user && s.user.id) || ''); setLink({ st: 'open', qr: '', me, err: '' }); log(`🟢 WhatsApp jur gaya — ${phPretty(me)}`); }
    if (u.connection !== 'close') return;
    const code = Number(u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode) || 0, R = B.DisconnectReason;
    endSock();
    if (code === R.loggedOut) { log('🔴 WhatsApp se link hat gaya (logout) — naya QR'); wipeAuth(); setLink({ st: 'closed', qr: '', me: '', err: 'Link hat gaya — naya QR scan karein' }); retryT = setTimeout(() => connect('logout ke baad').catch(e => log('⚠️ ' + e.message)), 3000); return; }
    if (code === R.restartRequired) { connect('jorne ke baad').catch(e => log('⚠️ ' + e.message)); return; }
    if (!state.creds.registered) { setLink({ st: 'off', qr: '', err: 'QR ka waqt khatam — app mein 🔗 Jorein dabayein' }); log('⏸ QR scan nahi hua — app ke 🔗 ka intezar'); return; }
    if (code === R.connectionReplaced) { setLink({ st: 'error', qr: '', err: 'Yahi link kisi aur jagah bhi chal raha hai — 10 min baad dobara' }); retryT = setTimeout(() => connect('replaced').catch(() => {}), 10 * 60000); return; }
    const wait = [2, 5, 10, 30, 60, 120, 300][Math.min(retry++, 6)];
    setLink({ st: 'closed', qr: '', err: `Rabta toota (${code || '?'}) — ${wait} sec mein dobara` }); log(`🟠 WhatsApp rabta toota (${code || '?'}) — ${wait} sec`);
    retryT = setTimeout(() => connect('dobara').catch(e => log('⚠️ ' + e.message)), wait * 1000);
  }
  async function doCmd(c) {
    log('🔗 app ka hukum: ' + c);
    if (sock) { try { await within(sock.logout(), 15000, 'logout'); } catch {} }
    endSock(); wipeAuth();
    setLink({ st: 'off', qr: '', me: '', err: c === 'logout' ? '' : 'Naya QR ban raha hai…' });
    if (c === 'logout') return;
    await connect('app: naya link');
  }
  // ---------- 📨 paigham ----------
  let msgQ = Promise.resolve();
  const intake = (m, s) => { msgQ = msgQ.then(() => handleMsg(m, s)).catch(e => log('⚠️ paigham: ' + (e && e.message))); };
  const tsOf = m => { const t = m.messageTimestamp; const n = Number(t && typeof t === 'object' ? (t.toNumber ? t.toNumber() : t.low) : t); return n > 0 ? n * 1000 : 0; };
  async function senderPh(m, s) {
    const k = m.key || {};
    for (const j of [k.remoteJidAlt, k.senderPn, k.participantPn, k.remoteJid]) if (j && /@s\.whatsapp\.net$/.test(j)) return normPh(j);
    if (/@lid$/.test(k.remoteJid || '')) { try { const pn = await s.signalRepository.lidMapping.getPNForLID(k.remoteJid); if (pn) return normPh(pn); } catch {} }
    return '';
  }
  async function handleMsg(m, s) {
    if (!m || !m.key || !m.message || m.key.fromMe) return;
    const jid = m.key.remoteJid || '', wid = m.key.id || '';
    if (!jid || B.isJidGroup(jid) || B.isJidBroadcast(jid) || B.isJidNewsletter(jid)) return;
    if (!wid || seenSet.has(wid)) return;
    const c = B.normalizeMessageContent(m.message) || {};
    const doc = c.documentMessage && /^image\//i.test(String(c.documentMessage.mimetype || '')) ? c.documentMessage : null;
    const kind = c.imageMessage || doc ? 'img' : (c.conversation || (c.extendedTextMessage && c.extendedTextMessage.text)) ? 'text' : (c.contactMessage || c.contactsArrayMessage) ? 'contact' : '';
    if (!kind) return;   // reaction / protocol / awaz / video — kuch nahi
    const ts = tsOf(m); if (ts && Date.now() - ts > MAX_AGE) { markSeen(wid); return; }
    await settingsReady;
    const from = await senderPh(m, s);
    if (!from) { markSeen(wid); tellOnce('lid:' + jid, `⚠️ ${jid}: number pata nahi chala (LID) — chhor diya`); return; }
    if (!S.on) { markSeen(wid); tellOnce('off', '⏸ WA parchi BAND hai (app setting) — paigham chhor diye'); return; }
    if (!S.allow.length) { markSeen(wid); tellOnce('noallow', '⚠️ ijazat wale number ki list khali (blueAccess/waParchi.allow) — kuch nahi parha'); return; }
    if (!S.allow.includes(from)) { markSeen(wid); tellOnce('na:' + from, `🚫 ${phPretty(from)} ijazat ki list mein nahi — chhor diya`); return; }
    if (kind === 'contact') {
      const cs = c.contactMessage ? [c.contactMessage] : ((c.contactsArrayMessage && c.contactsArrayMessage.contacts) || []);
      const info = cs.length ? vcardInfo(cs[0].vcard, cs[0].displayName) : null;
      markSeen(wid); if (info && (info.ph || info.nm)) await attach(from, info, 'contact card');
      return;
    }
    if (kind === 'text') {
      const t = String(c.conversation || c.extendedTextMessage.text || '').trim();
      if (t.length < 2 || !/[a-z0-9\u0600-\u06FF]/i.test(t)) { markSeen(wid); return; }
      const pc = parseCaption(t), r = recent.get(from);
      if (pc.ph && r && !r.ph && Date.now() - r.at < LINK_WIN && pc.nm.length <= 40 && !/\d/.test(pc.nm) && !/\n/.test(t)) { markSeen(wid); await attach(from, pc, 'number'); return; }
      markSeen(wid);
      await createWa({ from, cap: '', txt: t, wid, mt: ts });
      return;
    }
    const im = c.imageMessage || doc;
    if (Number(im.fileLength) > 15 * 1024 * 1024) { markSeen(wid); log('⚠️ tasveer 15 MB se bari — chhor di'); return; }
    let buf;
    try { buf = await within(B.downloadMediaMessage(m, 'buffer', {}), 60000, 'tasveer download'); }
    catch (e) { markSeen(wid); log(`⚠️ tasveer nahi utri (${phPretty(from)}): ${String(e.message).slice(0, 100)}`); await createWa({ from, cap: im.caption || '', wid, mt: ts, fail: 'WhatsApp se tasveer nahi utri — dobara forward karein' }); return; }   // app mein nazar aaye
    markSeen(wid);
    await createWa({ from, cap: im.caption || '', txt: '', buf, mime: String(im.mimetype || 'image/jpeg'), wid, mt: ts });
  }

  // ---------- 🔗 app ke hukum (relink / logout) — ek dafa, sirf taza (server waqt) ----------
  BA.doc('waCmd').onSnapshot(s => {
    if (!s.exists) return; const d = s.data() || {}, at = Number(d.at) || 0, c = String(d.do || '');
    if (!at || at === L.cmd || !/^(relink|logout|link)$/.test(c)) return;
    const age = Date.now() - (s.updateTime ? s.updateTime.toMillis() : at);
    L.cmd = at;
    if (age > 10 * 60000) { setLink({}); return; }
    setLink({});
    (c === 'link' && !(sock && L.st === 'open') ? connect('app: jorein') : c === 'link' ? Promise.resolve() : doCmd(c)).catch(e => { log('⚠️ hukum: ' + e.message); setLink({ st: 'error', err: String(e.message).slice(0, 140) }); });
  }, authErr);

  setInterval(() => { if (Date.now() - lastLinkW > 5 * 60000) setLink({}); }, 60000);   // app ko pata rahe PC zinda
  await connect('shuru');
}

// ---------- 📦 Baileys — apne folder wa-mods\ mein (C:\khata-sync\node_modules ko kabhi nahi chhuta) ----------
async function loadBaileys(setLink, idle) {
  try { const p = require.resolve(PKG, { paths: [MODS] }); return await import(pathToFileURL(p).href); }
  catch (e) {
    let last = 0; try { last = Number(JSON.parse(fs.readFileSync(NPM_FILE, 'utf8')).at) || 0; } catch {}
    if (Date.now() - last < 30 * 60000) {   // abhi install hua tha phir bhi nahi chala — baar baar install nahi
      log('✕ WhatsApp package nahi chala: ' + String(e.message).slice(0, 160) + ' — 30 min baad dobara');
      setLink({ st: 'error', qr: '', err: 'WhatsApp package nahi chala — PC log dekhein (wa-parchi-log.txt)' });
      setTimeout(() => process.exit(0), 30 * 60000); return null;
    }
    try { fs.writeFileSync(NPM_FILE, JSON.stringify({ at: Date.now() })); fs.mkdirSync(MODS, { recursive: true }); const pj = path.join(MODS, 'package.json'); if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify({ name: 'wa-mods', private: true, description: 'wa-parchi.js ke packages (Baileys) — alag folder' }, null, 2)); } catch {}
    log('📦 WhatsApp package (Baileys) install ho raha hai — pehli dafa 2-5 min…');
    setLink({ st: 'off', qr: '', err: 'PC par WhatsApp package install ho raha hai (pehli dafa 2-5 min)' });
    exec(`npm install ${PKG}@${PKG_VER} pino --no-audit --no-fund --loglevel=error`, { cwd: MODS, windowsHide: true, timeout: 10 * 60000, maxBuffer: 8 << 20 }, async er => {
      if (er) log('✕ npm install: ' + String(er.message).split(/\r?\n/)[0].slice(0, 160));
      else log('📦 Baileys aa gaya — dobara shuru');
      for (let i = 0; i < 60 && !idle(); i++) await sleep(5000);   // chalta order pehle khatam
      process.exit(0);
    });
    return null;
  }
}
