// =========================================================
//  wa-parchi.js  v2.2 (2026-11-05) — 📲 WHATSAPP PARCHI → PACKING LIST (BILL BAAQI)
//  v2.5: 🖨 malik: "mera bhi same Mubeen wala kar do" — malik ke APNE WhatsApp par bhi: gahak ki tasveer + caption "print" (ijazat list wale = purana
//        order + A4) aur malik ka REPLY "print" kisi bhi 1:1 chat ki tasveer par → A4 + patti (mainExtra, wahi helpers). Group / status nahi.
//  v2.4: 🖨 malik: "Mubeen ko kisi number se parchi aaye — (1) gahak tasveer ke SAATH print likhe ya (2) hum REPLY mein print likhein to wohi parchi
//        print, saath us ka number / naam / contact card · group se nahi · parchi khud forward na karni pare" (5 safhe ki hadd abhi NAHI — malik) →
//        print phone ki har 1:1 chat: gahak ki tasveer + caption "print" = A4 · Mubeen (ya prFrom) ka REPLY "print" kisi tasveer par = wohi tasveer (purani
//        bhi — reuploadRequest). Gahak ka alag likha "print" = kuch nahi. A4 ke upar `hd` patti: Tel number · WhatsApp naam · chat mein likhe number ·
//        contact card (chatInfo — sirf 30 min yaad, save kuch nahi). Bina print tasveer download bhi nahi. Group / status kabhi nahi.
//  v2.3: 🖨 malik: "main apna logout kar doon, sirf Mubeen ka WhatsApp kaam kare — main Mubeen ko parchi bhejun + Print likhun to print" (Parchi Sale
//        order malik ke number par hi rahe = B, unlink ke baad band) → print phone par AANE wale paigham bhi, SIRF waParchi.prFrom numbers (default malik
//        0345-0412515) se: tasveer + "print" (caption / alag) → A4 (CX3, wahi selfPrint). Malik ka apna link bhi chalta ho aur Mubeen prTo mein ho to CX3
//        chup (dohra print nahi). Malik ne ⛔ Unlink kiya (L.out) = PC restart par khud QR nahi banata.
//  v2.2: 🖨 malik: "jab Mubeen apni khud ki chat mein bhi print bheje to wo bhi auto print ho" → DOOSRA linked device (sirf PRINT): Mubeen ka apna
//        WhatsApp (QR app ⚙️ "📲 Print wala phone" → blueAccess/waLink2 · hukum waCmd2 · chaabi wa-auth-print\). Us number ke SIRF apne bheje (fromMe)
//        paigham + SIRF us ki apni chat (Message yourself) → wahi selfPrint (tasveer + "print" caption ya alag) → A4. Aane wale paigham / doosri chats
//        KABHI nahi chhoota (order / AI bhi nahi), kabhi message nahi bhejta. Shuru mein sirf tab judta hai jab pehle QR scan ho chuka ho.
//  v2.1: 🖨 malik ne album forward kar ke ALAG paigham "Print" likha (caption nahi) — chhapa nahi tha → ab alag likha "print" (≤ 25 harf) = usi chat ki pichhli
//        10 min ki tasveerein (jo abhi nahi chhapi) A4; pehle "print" phir tasveer (2 min) bhi. Har nateeja waLink.pr (app ⚙️ "aakhri print") — khamosh nahi.
//        LID chat = lidMapping dono taraf. Ijazat wale number par bhi yehi (likhi "print" se order nahi banta).
//  v2.0: 🖨 malik: "jab main Mubeen ke number par parchi bhejun jis ke saath PRINT likha ho to A4 (HP LaserJet) se print · print ke baghair nahi · saman
//        wali ho ya koi bhi · auto, kisi ko kuch na karna pare" (PC malik ke APNE WhatsApp 0345-0412515 par juda) → malik ke apne bheje (fromMe) paigham:
//        sirf tasveer + caption "print" (printReq: print / پرنٹ, "print 2" = copy) + chat = waParchi.prTo (default Mubeen 0346-2901193) ya apni chat →
//        `a4Send` wahi tasveer a4Img + a4Jobs {k 'wa', to 'a4'} → a4-print.js HP par (AI / header NAHI). Apne baqi paigham kabhi nahi chhoote. 30 min purana
//        = nahi chhapta (PC band tha). Ijazat wale numbers ki parchi par bhi "print" = A4 (caption se "print" hata kar gahak naam) — BILL BAAQI A4 ab
//        khud NAHI (waParchi.a4m: 'print' default · 'all' har parchi · 'off'; a4c copy). PDF abhi nahi (sirf tasveer / screenshot).
//  v1.9: 🔎 malik: "app ki parchi ka auto print = poori parchi ka zoom · Tibet cream ke tukde jaisa HAR item · AI ghalat parhta hai — ghalti bilkul
//        nahi · auto print bhi aisa hi" → thermal = parchi ki ASAL likhai, har line alag zoom (zoomSlip / linePlan — AI NAHI): kaghaz ka saya
//        flatten, tirchha seedha (skewOf), mura copy-safha chhapi lakeeron se seedha (dewarp — sirf upar/neeche khiskao), lakeerein / laal hashiya /
//        kinara line pehchanne se bahar (ruleClean / textInk), line ke beech ka lamba khali faasla sukera (item + tadad paas), 512 chaurai zoom,
//        beech nuqta lakeer. Syahi kabhi nahi kat-ti (khana tabhi kate jab na likhai ki syahi ho na asal syahi lakeer se zyada). Do ALAG list
//        (lines barabar nahi) = daayan pehle. Samajh na aaye = purana poori parchi zoom. APP parchi = tasveer aate hi thermal (AI ke saath saath,
//        zoomNow); WhatsApp tasveer = AI "order hai" kahe tab (ya AI na parh sake tab bhi) zoom. Dobara print + ⋮ 🖼 chip bhi yehi. Likhi WhatsApp
//        list (tasveer nahi) = pehle jaisi. A4 + app ke bill items (AI) pehle jaise. Setting blueAccess/waParchi.zm (app ⋮ ⚙️: 🔎 zoom / 🤖 AI list).
//  v1.8: ✅ malik: "bill mein woh items jo parchi par hain hi nahi (white chana → shawer, maida → pista, mash → masoor) · tadad na likhi ho to poocho" →
//        PAKKA JAANCH (AI NAHI): bill mein khud sirf tab jab parchi ka HAR asal lafz item ke naam mein ho (awaz / spelling / ek jaisa lafz,
//        SOFT lafz jaise tea / masala chhor sakte) + SIZE na takraye (parchi 10 litre ↔ 900ml, 2 kilo ↔ 800g, pao ↔ 475gm = ❓ "size alag";
//        3 kilo ↔ 3kg = wahi). Kai milte hon to: packet / size bilkul wahi (garam masala pao = 0.250 sub-barcode) → khula (kilo) → size nahi → guna.
//        Na pakka = wohi item ❓ mein "andaza" (j: z 'w' lafz | 's' size). AI se naya khana qn (tadad likhi?) → j nq:1 → app tadad poochti +
//        thermal par ">> TADAD ?". dhoond.mjs = dukan/dhoond.js v2.182.0 (words / canon export + rang: white = safed).
//  v1.7: 🖼 malik: "puri parchi ka har item jaise likha print ho · AI ke baghair alag chip (⋮) · zoom ho kar aaye" → app prImg → poori parchi ki tasveer
//        thermal par (zoomPlan: khali kinare kaat, beech mein column ka faasla ho to do hisse — daayan pehle; 512 chaurai, 640 line ke tukde). AI NAHI.
//  v1.6: 🧠 malik: "jin ka naam nahi milta alag khane mein — hum yaad karwa dein · pattern bhi · agli dafa yaad hua naam aur parchi ka lafz ikattha chhape" →
//        app 📒 Naam seekho → blueAccess/waLearn {m:{key:{r gahak ka lafz, id, n, at}}} · yahan lkey(raw) BILKUL wahi = pakka item (s 0.97, j line y:1),
//        AI ko 150 yaad lafz (glossOf, raw kabhi nahi badalta) · thermal: gahak ke lafz ke neeche ">>  yaad: <item>" + yaad line par shak ka tukda nahi (sirf ؟).
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

const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47820, VER = '2.5';
const TH_PRINTER = 'TM-T88IV', W = 42, FALLBACK_MODEL = 'gemini-3.8-flash';   // v1.1: 2.5-flash Google ne band kiya — asal chunao list se (pickModels)
const MODS = path.join(DIR, 'wa-mods'), AUTH_DIR = path.join(DIR, 'wa-auth'), AUTH2_DIR = path.join(DIR, 'wa-auth-print'), SEEN_FILE = path.join(DIR, 'wa-seen.json'), NPM_FILE = path.join(DIR, 'wa-npm.json');
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
 "lines": [{"raw": "the line exactly as written, same script", "item": "...", "qty": 1, "qn": true, "unit": "...", "col": 1, "box": [ymin, xmin, ymax, xmax], "sure": 0.9}]}
Rules:
- raw: copy EXACTLY what the customer wrote on that row of that pair — the item words, then its quantity words — in the same script, spelling and digits. NEVER correct, translate, shorten or replace a word, and never put a brand you know in place of the written one. If a word cannot be read, write ؟ in its place.
- col: which column pair the line is in — 1 = the rightmost pair, 2 = the next pair to its left, and so on (1 if the list has only one column).
- item: the best plain, searchable product name in simple English or Roman Urdu. Keep brand, size and variant if written. Examples: "Lipton tea", "Pampers XXL", "Ponds lotion", "Aata", "Cheeni", "Surf Excel 1kg", "Dalda ghee", "Shan biryani masala". Never translate a brand name.
- qty: the number written for that item (Urdu digits too). Words: آدھا = 0.5, پاؤ = 0.25 (kg), ڈیڑھ = 1.5, ڈھائی = 2.5. If no quantity is written use 1.
- qn: true if ANY quantity is written for that item — a number, or a quantity / unit word such as کلو, پاؤ, آدھا, درجن, عدد, پیکٹ, ڈبہ, بوتل, kg, dozen, packet ("میدہ کلو" = 1 kg written = true). false if ONLY the item name is written with no number and no unit word (then qty 1 and qn false).
- unit: as written, normalised to one of kg, g, litre, ml, pcs, packet, pack, dozen, bag, bottle, box, carton, tin, roll, bar, sachet, jar, pouch. Translate: کلو = kg, گرام = g, لیٹر = litre, پاؤ = kg (with qty 0.25), عدد / دانے = pcs, تھیلا / تھیلے / بوری = bag, ڈبہ / ڈبے = box, بوتل = bottle, پیکٹ = packet, درجن = dozen, پیٹی / کارٹن = carton. Use "" if no unit is written.
- box: bounding box of that whole line on the image — from the item text to its quantity in the same pair — normalised to 0-1000 as [ymin, xmin, ymax, xmax].
- sure: your confidence from 0 to 1 that the item, its qty AND their pairing / order are all correct. Use a value below 0.6 when the handwriting is unclear or you are not sure which quantity belongs to the item. Give 0.9 or more ONLY when every letter of the line is clearly readable and it is a word you are sure of.
- isOrder: false (with empty lines) if the image is not a shopping / order list at all (selfie, payment screenshot, random photo, chat screenshot without a list).`;
const PROMPT_TXT = `Below is a customer's ORDER LIST for a grocery / general store in Pakistan (Noor Traders), typed in a WhatsApp message — Urdu, Roman Urdu, English or mixed.
Read every item in order. Do not invent items. Ignore greetings, prices and totals.
Return ONLY this JSON:
{"isOrder": true, "name": "customer name if written, else empty", "phone": "customer phone if written, else empty",
 "lines": [{"raw": "that item exactly as written", "item": "plain searchable name in simple English or Roman Urdu (keep brand / size), e.g. Lipton tea, Pampers XXL, Aata, Cheeni", "qty": 1, "qn": true, "unit": "kg|g|litre|ml|pcs|packet|pack|dozen|bag|bottle|box|carton|tin|roll|bar|sachet|jar|pouch or empty", "box": null, "sure": 0.9}]}
Translate units: کلو = kg, گرام = g, پاؤ = 0.25 kg, آدھا = 0.5, عدد = pcs, تھیلا / تھیلے = bag, ڈبہ = box, بوتل = bottle, پیکٹ = packet, درجن = dozen. qty 1 if not written.
qn: true if any quantity (number or unit word like kilo, pao, dozen, packet) is written for the item, false if only the item name is written.
isOrder false (with empty lines) if the message is not an order list (greeting, question, "ok", a name only).

Message:
`;
// v1.8: parchi ki line mein tadad ka nishan (hindsa, ½, aadha / pao, unit lafz) — ho to AI ke "qn false" ko na mano
const hasQty = r => { const t = UDIG(r); if (/[\d½¼¾]/.test(t)) return true; return t.toLowerCase().split(/[\s,.\-\/()]+/).some(w => w && (WORDNUM[w] != null || UNIT_OF.has(w))); };
function normLine(l) {
  if (typeof l === 'string') l = l.trim() ? { raw: l, item: l } : null;
  if (!l || typeof l !== 'object') return null;
  const raw = String(l.raw ?? l.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), item = String(l.item ?? l.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!raw && !item) return null;
  let sure = Number(l.sure ?? l.confidence); if (!isFinite(sure)) sure = 0.7; if (sure > 1 && sure <= 100) sure /= 100; sure = Math.max(0, Math.min(1, Math.round(sure * 100) / 100));
  const col = Math.max(0, Math.min(9, Math.round(Number(l.col ?? l.column) || 0)));   // v1.4: kaun si jori (1 = daayein)
  const qn = l.qn ?? l.qty_written, nq = (qn === false || qn === 'false' || qn === 0) && !hasQty(raw);   // v1.8: tadad likhi hi nahi (AI kahe + parchi mein koi hindsa / unit lafz nahi)
  return { raw: raw || item, item: item || raw, qty: numOf(l.qty ?? l.quantity), unit: normUnit(l.unit), box: validBox(l.box ?? l.box_2d ?? l.bbox), sure, ...(col ? { col } : {}), ...(nq ? { nq: 1 } : {}) };
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
async function geminiRead({ key, model, b64, mime, text, gloss = '', fetchFn = globalThis.fetch, ms = 45000, waitMs = 1500 }) {
  if (!key) throw Object.assign(Error('AI key nahi (app → Settings → 🤖 AI)'), { code: 'nokey' });
  const call = async (mdl, think) => {
    const parts = b64 ? [{ inline_data: { mime_type: mime || 'image/jpeg', data: b64 } }, { text: PROMPT_IMG + gloss }] : [{ text: (gloss ? PROMPT_TXT.replace(/\nMessage:\n$/, gloss + '\nMessage:\n') : PROMPT_TXT) + String(text || '').slice(0, 4000) }];   // v1.6: 🧠 yaad ke lafz
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
// v1.6: 🧠 AI ko is dukan ke yaad karwaye lafz (naye pehle, 150 tak) — raw kabhi nahi badalta, sirf "item" behtar
function glossOf(learn) {
  const L = Object.values(learn || {}).filter(v => v && v.r && v.n).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).slice(0, 150);
  if (!L.length) return '';
  return '\nKNOWN WORDS at this shop (the owner taught these from earlier lists). When a line\'s item words are the same as or look like one of these, set "item" to that product name and give "sure" 0.9 or more. Still copy "raw" exactly as written.\n'
    + L.map(v => `- "${(lkey(v.r) || String(v.r)).replace(/["\n]/g, ' ').slice(0, 40)}" = ${String(v.n).replace(/["\n]/g, ' ').slice(0, 60)}`).join('\n') + '\n';
}
// v1.6: 🧠 parchi ke lafz ki pehchan (malik ne app 📒 Naam seekho se jo yaad karwaya) — tadad / unit / harakat / harf ke roop hata kar EK shakal
function lkey(s) {
  const t = String(s || '').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u06EA-\u06ED]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ةهۀ]/g, 'ہ').replace(/ؤ/g, 'و')
    .replace(/[\d۰-۹٠-٩]+(?:[.,\/][\d۰-۹٠-٩]+)?/g, ' ').replace(/[^\p{L}\s]/gu, ' ');
  return t.split(/\s+/).filter(w => w && !DROP.has(w) && !isNumTok(w)).join(' ').trim().slice(0, 80);
}
const title = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());   // web-dukan.js jaisa
// items (posStock b1) + aliases {id: 'naam | naam'} + urdu {id: 'اردو'} + hidden {id: true} → dhoondne ki list
function buildIndex(items, { alias = {}, urdu = {}, hidden = {}, learn = {} } = {}) {
  const L = [], AL = [], byId = new Map(), LR = new Map();
  for (const it of items || []) {
    if (!it || it.id == null || !it.name) continue; const id = String(it.id); if (hidden[id] || byId.has(id)) continue;
    const al = String(alias[id] || '').trim(), ur = String(urdu[id] || '').trim();
    const o = { id, it, t: [String(it.name), ur, al.replace(/[|;,\n]+/g, ' ')].filter(Boolean).join(' ') };
    L.push(o); byId.set(id, o);
    if (al) for (const a of al.split(/[|;,\n]+/)) if (a.trim()) AL.push({ id, k: 'al:' + id + ':' + a.trim().toLowerCase(), t: a.trim() });
  }
  for (const v of Object.values(learn || {})) { const k = lkey(v && v.r), id = String((v && v.id) || ''); if (k && id && byId.has(id)) LR.set(k, id); }   // v1.6: 🧠 yaad (band item nahi)
  return { L, AL, byId, LR };
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
// v1.8: ✅ PAKKA JAANCH (malik: "white chana → shawer · maida → pista · mash → masoor bill mein aa gaye") — AI NAHI.
//   smartFind (website / app ka dhoondo) ADHOORA lafz bhi pakarta hai (mash → MASoor, "andar kahin"). Parchi par lafz poore hote hain, is liye
//   bill mein khud sirf tab jab parchi ka HAR asal lafz item ke naam mein ho (spelling / awaz / ek jaisa lafz — white = safed) aur SIZE na takraye
//   (parchi 10 litre ↔ item 900ml = alag). Warna wohi item ❓ mein "🤖 andaza" (z: 'w' lafz · 's' size) — malik / larka ek tap.
const UR_RE = /[\u0600-\u06FF]/;
const STOPW = new Set(['ka', 'ki', 'ke', 'ko', 'aur', 'or', 'and', 'de', 'dein', 'dena', 'chahiye', 'chahie', 'bhi', 'sath', 'saath', 'ya', 'se', 'کا', 'کی', 'کے', 'کو', 'اور', 'بھی', 'یا', 'دیں', 'دینا', 'چاہیے', 'سے']);
const SOFT = new Set([...GENERIC, 'fresh', 'new', 'naya', 'achha', 'acha', 'achi', 'achhi', 'best', 'original', 'asli', 'special', 'desi', 'khula', 'loose', 'number', 'no', 'pure', 'saaf', 'saf']);   // yeh lafz na milein to bhi chalega (kam az kam ek asal lafz mile)
const KG_N = /\b(kg|kgs|kilo|kilogram|ltr|litre|liter|l)\b/i;
const levD = (a, b) => { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n; let pr = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cu = [i]; for (let j = 1; j <= n; j++) cu[j] = Math.min(pr[j] + 1, cu[j - 1] + 1, pr[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); pr = cu; } return pr[n]; };
// parchi ke asal lafz (tadad / unit / ka-ki-ke / wala hata kar) → [{w roman, ur Urdu se?, soft}]
function coreWords(q, D) {
  const out = [];
  for (const t of String(q || '').split(/[\s,.\-\/()+&:;]+/)) {
    if (!t) continue; const lt = t.toLowerCase(); if (isNumTok(t) || DROP.has(lt) || STOPW.has(lt) || WORDNUM[lt] != null) continue;
    for (const w of D.words(t)) if (w.length >= 2 && !/^\d/.test(w) && !UNIT_OF.has(w) && !DROP.has(w) && !STOPW.has(w)) out.push({ w, ur: UR_RE.test(t), soft: SOFT.has(w) });
  }
  return out;
}
function itemWords(o, D) { if (!o._w) { o._w = D.words(o.t); o._j = o._w.join(''); } return o._w; }
function wordHit(x, o, D) {
  const a = x.w, ka = D.k2(a), ca = D.canon(a), sa = D.sk(a), iw = itemWords(o, D);
  for (const w of iw) {
    if (w === a) return true;
    const kw = D.k2(w); if (kw === ka || D.canon(w) === ca) return true;   // awaz / ek jaisa lafz (daal = dal · white = safed)
    if (a.length >= 3 && w.startsWith(a) && a.length >= 0.7 * w.length) return true;   // pamper ~ pampers
    if (w.length >= 3 && a.startsWith(w) && w.length >= 0.7 * a.length) return true;
    const sw = D.sk(w);   // spelling farq: consonant wahi + thora vowel farq (Urdu mein zer / zabar likhe nahi jate — 3+ consonant par sirf consonant)
    if (sa.length >= 2 && sw === sa && (x.ur ? sa.length >= 3 || levD(ka, kw) <= 1 : levD(ka, kw) <= (ka.length <= 4 ? 1 : 2))) return true;
  }
  return a.length >= 5 && o._j.includes(a);   // kalimirch = kali mirch
}
// poora lafz-milan: har asal lafz mile (SOFT chhor sakte hain) + kam az kam ek asal (SOFT nahi) lafz
function covers(q, o, D) {
  const cw = coreWords(q, D); if (!cw.length) return false;
  let hard = 0;
  for (const x of cw) { const h = wordHit(x, o, D); if (!h && !x.soft) return false; if (h && !x.soft) hard++; }
  return hard > 0 || cw.every(x => wordHit(x, o, D));
}
// 📏 size: "3kg" / "900ml" / "1 kg" / "250 گرام" → {d: 'w' wazan (gram) | 'v' (ml), a}
const SZ_RE = /(\d+(?:\.\d+)?)\s*(kgs?|kilo(?:gram)?s?|grams?|gms?|gr|g|ml|ltrs?|lit(?:re|er)s?|l|کلو|گرام|لیٹر|لٹر|ملی)(?![a-z])/gi;
const SZ_M = u => { u = u.toLowerCase(); return /^(kg|kgs|kilo|کلو)/.test(u) ? ['w', 1000] : /^(g|gm|gr|gram|گرام)/.test(u) ? ['w', 1] : /^(ml|ملی)/.test(u) ? ['v', 1] : ['v', 1000]; };
function sizesIn(text) { const out = []; const s = UDIG(text); let m; SZ_RE.lastIndex = 0; while ((m = SZ_RE.exec(s))) { const [d, k] = SZ_M(m[2]), a = Number(m[1]) * k; if (a > 0) out.push({ d, a }); } return out; }
function parchiSize(l) {   // kul (qty × unit) ya fi-piece (naam mein likha size, tadad = ginti)
  const q = Number(l.qty) || 0, u = String(l.unit || '');
  if (q > 0 && (u === 'kg' || u === 'g' || u === 'litre' || u === 'ml')) return { d: u === 'kg' || u === 'g' ? 'w' : 'v', a: q * (u === 'kg' || u === 'litre' ? 1000 : 1), per: false };
  const z = sizesIn(l.item)[0] || sizesIn(l.raw)[0]; return z ? { ...z, per: true } : null;
}
const loose = it => KG_N.test(String(it.uName || '')) || (Array.isArray(it.bq) && it.bq.some(b => Number(b && b.q) > 0 && Number(b.q) < 1));   // kilo se bikne wala (khula / packet sub-barcode)
// size ka darja: 0 = bilkul wahi (packet / naam ka size) · 1 = khula (kilo) · 2 = size ka pata nahi · 3 = guna (2 kg = 2 × 1kg) · -1 = TAKRAO
function sizeTier(l, it) {
  const ps = parchiSize(l); if (!ps) return 2;
  if (loose(it)) { const kg = ps.a / 1000; return !ps.per && Array.isArray(it.bq) && it.bq.some(b => Math.abs((Number(b && b.q) || 0) - kg) < 0.0005) ? 0 : 1; }
  const is = sizesIn(it.name)[0]; if (!is || is.d !== ps.d) return 2;
  const r = ps.a / is.a, n = Math.round(r);
  if (Math.abs(r - 1) < 0.03) return 0;
  return !ps.per && n >= 2 && n <= 50 && Math.abs(r - n) < 0.03 ? 3 : -1;
}
// hits mein se pakka: lafz pure + size theek — sab se behtar size darja pehle, phir best()
function pickPakka(l, hits, q, k2, D) {
  let bt = 9, ok = [];
  for (const o of hits) {
    if (!(covers(l.item, o, D) || covers(l.raw, o, D))) continue;
    const t = sizeTier(l, o.it); if (t < 0) continue;
    if (t < bt) { bt = t; ok = [o]; } else if (t === bt) ok.push(o);
  }
  return ok.length ? best(ok, q, k2) : null;
}
function matchOne(l, X, find, k2, D) {
  const qs = [...new Set([l.item, l.raw].map(q => String(q || '').trim()).filter(Boolean))];
  const tf = o => o.t, iL = o => 'it:' + o.id, iA = o => o.k;
  if (X.LR && X.LR.size) { const id = X.LR.get(lkey(l.raw)); const o = id && X.byId.get(id); if (o) return { o, s: 0.97, how: 'yaad' }; }   // v1.6: 🧠 malik ka yaad karwaya lafz — pakka
  const strict = !!(D && D.words && D.canon && D.sk);   // v1.8 (purana dhoond.mjs = purana tareeqa)
  let guess = null;
  const take = (hits, q, s, how) => {
    if (!hits.length) return null;
    if (!strict) return { o: best(hits, q, k2), s, how };
    const o = pickPakka(l, hits, q, k2, D); if (o) return { o, s, how };
    if (!guess) { const g = best(hits, q, k2); guess = { o: g, s: 0.45, how: how + ' (andaza)', z: sizeTier(l, g.it) < 0 ? 's' : 'w' }; }
    return null;
  };
  if (X.AL.length) for (const q of qs) { const r = find(X.AL, q, tf, iA, 5); if (r.hits.length) { const o = X.byId.get(r.hits[0].id); if (o) { if (!strict || sizeTier(l, o.it) >= 0) return { o, s: 0.95, how: 'alias' }; if (!guess) guess = { o, s: 0.45, how: 'alias (andaza)', z: 's' }; } } }   // purchase ke naam = malik ke jore (size takraye to andaza)
  const first = [];
  for (let i = 0; i < qs.length; i++) { const r = find(X.L, qs[i], tf, iL, 40); first.push(r); const m = take(r.hits, qs[i], i ? 0.8 : 0.9, 'naam'); if (m) return m; }
  for (const q of qs) {   // tadad / unit hata kar, phir ek lafz kam
    const toks = q.split(/[\s,.\-\/()+&]+/).filter(Boolean), core = toks.filter(t => !isNumTok(t) && !DROP.has(t.toLowerCase()));
    if (!core.length) continue;
    if (core.length < toks.length) { const r = find(X.L, core.join(' '), tf, iL, 40); const m = take(r.hits, core.join(' '), 0.75, 'bina tadad'); if (m) return m; }
    if (core.length >= 2) for (let k = core.length - 1; k >= 0; k--) { const sub = core.filter((_, i) => i !== k); const r = find(X.L, sub.join(' '), tf, iL, 40); const m = take(r.hits, sub.join(' '), sub.length >= 2 || GENERIC.has(core[k].toLowerCase()) ? 0.6 : 0.45, 'ek lafz kam'); if (m) return m; }
  }
  if (guess) return guess;
  for (const r of first) if (r.near.length) return { o: r.near[0], s: 0.4, how: 'shayad' };
  return { o: null, s: 0, how: '' };
}
function rackOf(id, R) {
  const k = R && R.ic && R.ic[id]; if (!k) return '';
  return String((R.cn && R.cn[k]) || '').trim() || (k === '@khula' ? 'Khula maal' : title(k));
}
// lines (AI) → j (order doc ki JSON lines): { r raw, it AI naam, q, u, id, n POS naam, b box, s 0..1, rk? }
function matchLines(lines, X, find, k2, racks, D) {
  return (lines || []).map(l => {
    const m = X && X.L && X.L.length && find && k2 ? matchOne(l, X, find, k2, D) : { o: null, s: 0 };
    const o = m.o, y = m.how === 'yaad', s = Math.round(Math.min(m.s, y ? Math.max(Number(l.sure) || 0, 0.7) : Number(l.sure) || 0) * 100) / 100, rk = o ? rackOf(o.id, racks) : '';   // v1.6: 🧠 yaad = item pakka (AI ka kam yaqeen sirf tadad ka)
    return { r: l.raw, it: l.item, q: l.qty, u: l.unit, id: o ? o.id : '', n: o ? String(o.it.name) : '', b: l.box || null, s, w: Number(l.sure) || 0, ...(l.col ? { c: l.col } : {}), ...(rk ? { rk } : {}), ...(y ? { y: 1 } : {}), ...(o && m.z ? { z: m.z } : {}), ...(l.nq ? { nq: 1 } : {}) };   // v1.8: z = andaza kyun (w lafz · s size) · nq = tadad likhi nahi (app poochti hai)   // v1.4: w = AI ka apna yaqeen (parhna + jori)
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
function writtenLines(P) { return [...(P.clear || []), ...(P.unc || [])].sort((a, b) => (a.i ?? 0) - (b.i ?? 0)).map(l => ({ t: rawOf(l), b: l.b || null, d: l.y ? /؟|\?/.test(String(l.r || '')) : doubtOf(l), c: Number(l.c) || 0, i: l.i ?? 0, y: l.y && l.n ? String(l.n) : '', nq: l.nq ? 1 : 0 })).filter(x => x.t); }   // v1.6: 🧠 yaad = shak ka tukda nahi (sirf ؟), yaad wala naam saath
// opt.rows = PowerShell ne har line ki tasveer bana di (CRM 'L<k>') · opt.crops = Set(k) jin ka likhai tukda bana (CRM 'c<k>')
function writtenText(o, P, opt = {}) {
  const L = writtenLines(P), out = headLines(o, { rp: opt.rp, n: L.length }), crops = opt.crops || new Set();
  out.push(L0 + hr());
  L.forEach((x, k) => {
    if (k && x.c && L[k - 1].c && x.c !== L[k - 1].c) out.push(C1 + '. . . . . . . . . . . . . . . . . . . .');   // agli jori
    if (opt.rows) out.push(CRM + 'L' + k);
    else if (hasUr(x.t)) out.push(UR.line('[ ]  ' + x.t, 34));   // Urdu: shuru (daayein) mein [ ]
    else out.push(...wrap(ascii(x.t), W - 4).map((s, j) => L0 + B1 + (j ? '    ' : '[ ] ') + s + B0));
    if (x.y) out.push(...wrap('yaad: ' + (ascii(x.y) || '?'), W - 6).map((t, j) => L0 + (j ? '      ' : '  >>  ') + t));   // v1.6: 🧠 gahak ke lafz ke saath yaad hua item (malik)
    if (x.nq) out.push(L0 + B1 + '  >>  TADAD ?' + B0 + ' gahak se poochein');   // v1.8: malik — tadad na likhi ho to poocho
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

// ---------- 🖼 v1.7: PARCHI JAISI (bina AI) — poori parchi ki tasveer thermal par, ZOOM (malik: "parchi ka har item jaise likha · AI ke baghair alag chip · zoom ho kar aaye") ----------
// 1) kinare ka khali kaghaz kaat (sirf likhai wala hissa) 2) beech mein khali patti (do jori / do column) ho to do hisse — DAAYAN pehle (Urdu)
// 3) har hissa 512 chaurai, ~640 line ke tukdon mein (printer ki hadd). Boxes 0–1000 (cropRaster raw). AI NAHI.
function zoomPlan(img) {
  if (!img || !img.width || !img.height) return [];
  const Wd = img.width, Hd = img.height, D = img.data, st = Math.max(1, Math.floor(Math.max(Wd, Hd) / 500)), w = Math.floor(Wd / st), h = Math.floor(Hd / st);
  const lum = new Float32Array(w * h); const hist = new Array(256).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y * st) * Wd + x * st) * 4, v = 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]; lum[y * w + x] = v; hist[Math.max(0, Math.min(255, v | 0))]++; }
  let acc = 0, paper = 200; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= w * h * 0.7) { paper = i; break; } }
  const dark = v => v < paper * 0.62;
  const colD = new Float32Array(w), rowD = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dark(lum[y * w + x])) { colD[x]++; rowD[y]++; }
  const edge = (arr, n, lim) => { let a = 0, b = n - 1; while (a < b && arr[a] <= lim) a++; while (b > a && arr[b] <= lim) b--; return [a, b]; };
  let [x0, x1] = edge(colD, w, h * 0.004), [y0, y1] = edge(rowD, h, w * 0.004);
  if (x1 - x0 < w * 0.15 || y1 - y0 < h * 0.1) { x0 = 0; x1 = w - 1; y0 = 0; y1 = h - 1; }   // kuch samajh na aaye = poori tasveer
  const px = Math.round((x1 - x0) * 0.03) + 2, py = Math.round((y1 - y0) * 0.02) + 2;
  x0 = Math.max(0, x0 - px); x1 = Math.min(w - 1, x1 + px); y0 = Math.max(0, y0 - py); y1 = Math.min(h - 1, y1 + py);
  // beech ki khali patti (column ka faasla) — 30%–70% mein sab se lambi khali chaurai (≥ 2.5%)
  const cw = x1 - x0, lim = (y1 - y0) * 0.006; let best = null, run = 0;
  for (let x = Math.round(x0 + cw * 0.3); x <= Math.round(x0 + cw * 0.7); x++) { let c = 0; for (let y = y0; y <= y1; y++) if (dark(lum[y * w + x])) c++; if (c <= lim) { run++; if (!best || run > best.n) best = { n: run, x: x - Math.floor(run / 2) }; } else run = 0; }
  const parts = best && best.n >= Math.max(2, cw * 0.025) ? [[best.x, x1], [x0, best.x]] : [[x0, x1]];   // daayan pehle
  const out = [];
  for (const [a, b] of parts) {
    const pw = b - a, ph = y1 - y0, outH = ph * 512 / Math.max(1, pw), n = Math.max(1, Math.ceil(outH / 640));
    for (let k = 0; k < n; k++) {
      const ya = y0 + ph * k / n, yb = y0 + ph * (k + 1) / n;
      out.push({ part: parts.length > 1 ? (a === parts[0][0] ? 1 : 2) : 0, box: [ya / h * 1000, a / w * 1000, yb / h * 1000, b / w * 1000].map(v => Math.round(Math.max(0, Math.min(1000, v)))) });
    }
  }
  return out;
}
function imageSlipText(o, plan, opt = {}) {
  const out = headLines(o, { rp: opt.rp });
  out.push(C1 + GS + 'B\x01' + ' PARCHI JAISI LIKHI - BINA AI ' + GS + 'B\x00');
  if (UR.isOn()) out.push(UR.line('پرچی جیسی لکھی — بغیر AI', 36, 1));
  let lastPart = -1;
  plan.forEach((p, k) => {
    if (p.part !== lastPart && p.part) out.push(L0 + hr(), C1 + B1 + (p.part === 1 ? '>> DAAYAN HISSA <<' : '>> BAAYAN HISSA <<') + B0);
    lastPart = p.part; out.push(CRM + 'z' + k);
  });
  out.push(L0 + hr(), '', CUT);
  return out.join('\r\n');
}

// ---------- 🔎 v1.9: LINE ZOOM (bina AI) — malik: "Tibet cream ke tukde jaisa har item zoom · AI ghalat parhta hai · ghalti bilkul nahi" ----------
// Tasveer → seedhi (tirchhi lakeerein theek) → har likhi LINE alag (syahi ki qataron se; chhapi lakeerein / laal hashiya nahi gine)
// → line ke beech ka lamba khali faasla sukera (item + tadad paas paas, bara zoom) → 512 chaurai tak zoom → ek ke neeche ek, beech patli lakeer.
// Syahi KABHI nahi chhootti: chhota nishan (nuqta / "1") paas wali line ke saath; lambi line (do line juri) beech ki khali qatar par kat-ti hai.
// Do alag list (daayein / baayein, lines barabar nahi) = daayan list pehle. Kuch samajh na aaye = null → purana zoomPlan. AI NAHI.
function grayOf(img, maxSide) {   // RGBA → { w, h, g } (average se chhota, roshni 0–255)
  const s = Math.max(1, Math.max(img.width, img.height) / maxSide), w = Math.max(1, Math.round(img.width / s)), h = Math.max(1, Math.round(img.height / s));
  const g = new Float32Array(w * h), D = img.data, W0 = img.width, H0 = img.height;
  for (let y = 0; y < h; y++) {
    const ya = Math.min(H0 - 1, Math.floor(y * s)), yb = Math.max(ya + 1, Math.min(H0, Math.floor((y + 1) * s)));
    for (let x = 0; x < w; x++) {
      const xa = Math.min(W0 - 1, Math.floor(x * s)), xb = Math.max(xa + 1, Math.min(W0, Math.floor((x + 1) * s))); let t = 0, n = 0;
      for (let yy = ya; yy < yb; yy++) { let i = (yy * W0 + xa) * 4; for (let xx = xa; xx < xb; xx++, i += 4) { t += 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]; n++; } }
      g[y * w + x] = n ? t / n : 255;
    }
  }
  return { w, h, g };
}
function inkOf(G) {   // syahi = apne aas paas (r) se kafi gehri — saya / mez / roshni ka farq syahi nahi
  const { w, h, g } = G, r = Math.max(5, Math.round(Math.max(w, h) / 45)), W1 = w + 1, I = new Float64Array(W1 * (h + 1)), ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1);
      const m = (I[yb * W1 + xb] - I[ya * W1 + xb] - I[yb * W1 + xa] + I[ya * W1 + xa]) / ((yb - ya) * (xb - xa)), v = g[y * w + x];
      if (v < m * 0.8 && m - v > 16) ink[y * w + x] = 1;
    }
  }
  return ink;
}
function skewOf(G, ink) {   // −6°…+6° — jis zaviye par qataron ki syahi sab se ikatthi (chhapi lakeerein / likhai) wohi
  const { w, h } = G, pts = []; let k = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink[y * w + x] && (k++ % 3 === 0)) pts.push(x, y);
  if (pts.length < 200) return 0;
  const score = a => { const t = Math.tan(a * Math.PI / 180), off = Math.ceil(w * 0.11) + 2, H = new Float64Array(h + 2 * off); for (let i = 0; i < pts.length; i += 2) { const r = Math.round(pts[i + 1] - (pts[i] - w / 2) * t) + off; if (r >= 0 && r < H.length) H[r]++; } let s = 0; for (const v of H) s += v * v; return s; };
  let best = 0, bs = score(0);
  for (let a = -6; a <= 6.001; a += 0.5) { const s = score(a); if (s > bs * 1.0001) { bs = s; best = a; } }
  for (let a = best - 0.4; a <= best + 0.401; a += 0.1) { const s = score(a); if (s > bs * 1.0001) { bs = s; best = a; } }
  return Math.abs(best) < 0.15 ? 0 : Math.round(best * 10) / 10;
}
function rotGray(G, deg, fill) {   // seedha karo (bilinear) — kone khali = kaghaz
  if (!deg) return G;
  const { w, h, g } = G, t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), cx = w / 2, cy = h / 2, o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, sx = cx + dx * c - dy * s, sy = cy + dx * s + dy * c, x0 = Math.floor(sx), y0 = Math.floor(sy);
    if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) { o[y * w + x] = fill; continue; }
    const fx = sx - x0, fy = sy - y0, i = y0 * w + x0;
    o[y * w + x] = (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }
  return { w, h, g: o };
}
function dropRules(ink, w, h) {   // chhapi lakeerein (lambi seedhi) + laal hashiya / kaghaz ka kinara (lamba khara) — sirf line pehchanne ke liye
  const o = ink.slice(), LH = Math.max(40, Math.round(w * 0.2)), LV = Math.max(40, Math.round(h * 0.12));
  for (let y = 0; y < h; y++) { let a = -1, gap = 0; for (let x = 0; x <= w; x++) { const on = x < w && ink[y * w + x]; if (on) { if (a < 0) a = x; gap = 0; } else if (a >= 0 && (++gap > 3 || x === w)) { const b = x - gap; if (b - a + 1 >= LH) for (let xx = a; xx <= b; xx++) o[y * w + xx] = 0; a = -1; gap = 0; } } }
  for (let x = 0; x < w; x++) { let a = -1, gap = 0; for (let y = 0; y <= h; y++) { const on = y < h && ink[y * w + x]; if (on) { if (a < 0) a = y; gap = 0; } else if (a >= 0 && (++gap > 3 || y === h)) { const b = y - gap; if (b - a + 1 >= LV) for (let yy = a; yy <= b; yy++) o[yy * w + x] = 0; a = -1; gap = 0; } } }
  return o;
}
function median(a) { if (!a.length) return 0; const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; }
function flatten(G) {   // saya / roshni ka farq hatao: har hissa apne kaghaz (90% roshan) se — kaghaz safed, syahi gehri, mez / saya bhi safed
  const { w, h, g } = G, B = Math.max(12, Math.round(Math.max(w, h) / 70)), bw = Math.ceil(w / B), bh = Math.ceil(h / B), M = new Float32Array(bw * bh), Md = new Float32Array(bw * bh), hist = new Uint32Array(256);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    hist.fill(0); let n = 0; const ya = by * B, yb = Math.min(h, ya + B), xa = bx * B, xb = Math.min(w, xa + B);
    for (let y = ya; y < yb; y += 2) for (let x = xa; x < xb; x += 2) { hist[Math.max(0, Math.min(255, g[y * w + x] | 0))]++; n++; }
    let acc = 0, v = 255, md = -1; for (let i = 0; i < 256; i++) { acc += hist[i]; if (md < 0 && acc >= n * 0.5) md = i; if (acc >= n * 0.9) { v = i; break; } }
    M[by * bw + bx] = v; Md[by * bw + bx] = md < 0 ? v : md;
  }
  const S = new Float32Array(M.length);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = by + dy, xx = bx + dx; if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) { s += M[yy * bw + xx]; n++; } } S[by * bw + bx] = Math.max(s / n, M[by * bw + bx]); }
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(bh - 1, (y + 0.5) / B - 0.5)), y0 = Math.floor(fy), y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(bw - 1, (x + 0.5) / B - 0.5)), x0 = Math.floor(fx), x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
      const bg = (S[y0 * bw + x0] * (1 - tx) + S[y0 * bw + x1] * tx) * (1 - ty) + (S[y1 * bw + x0] * (1 - tx) + S[y1 * bw + x1] * tx) * ty;
      o[y * w + x] = Math.min(255, g[y * w + x] / Math.max(24, bg) * 255);
    }
  }
  return { w, h, g: o, M, Md, B, bw, bh };
}
// chhapi lakeerein — seedhi ho ya kaghaz mur kar gol / tirchhi (malik ki asal parchi: copy ke safhe ki lakeerein jhuki hui) — aur khari lakeerein
// (laal hashiya, kaghaz ka kinara). Patli (≤ T) lambi lakeer = lakeer; us ki seedh mein (aage peeche bhi) patli syahi bhi nikalo. Sirf line PEHCHANNE ke liye.
function ruleClean(ink, w, h) {
  const T = Math.max(3, Math.round(Math.max(w, h) / 400)), o = ink.slice(), vk = new Uint8Array(w * h), rules = [];
  for (const horiz of [true, false]) {
    const N = horiz ? w : h, M = horiz ? h : w, at = horiz ? (a, b) => b * w + a : (a, b) => a * w + b;
    const thin = new Uint8Array(w * h);
    for (let a = 0; a < N; a++) { let s = -1; for (let b = 0; b <= M; b++) { const on = b < M && o[at(a, b)]; if (on && s < 0) s = b; else if (!on && s >= 0) { if (b - s <= T) for (let k = s; k < b; k++) thin[at(a, k)] = 1; s = -1; } } }
    const seen = new Uint8Array(w * h), st = [], kill = [], dashes = [];
    for (let p0 = 0; p0 < w * h; p0++) {
      if (!thin[p0] || seen[p0]) continue;
      const px = []; seen[p0] = 1; st.push(p0); let a0 = N, a1 = -1, b0 = M, b1 = -1;
      while (st.length) {
        const p = st.pop(), x = p % w, y = (p - x) / w, a = horiz ? x : y, b = horiz ? y : x; px.push(p);
        if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; const q = yy * w + xx; if (thin[q] && !seen[q]) { seen[q] = 1; st.push(q); } } }
      }
      const span = a1 - a0 + 1;
      if (span >= Math.max(8, 2 * T) && span < N * 0.15 && b1 - b0 <= 2 * T + span * 0.25 && px.length <= span * T * 1.6) {   // chhota patla tukda — toti hui lakeer ka hissa ho sakta
        let sa = 0, sb = 0, saa = 0, sab = 0; for (const p of px) { const x = p % w, y = (p - x) / w, aa = horiz ? x : y, bb = horiz ? y : x; sa += aa; sb += bb; saa += aa * aa; sab += aa * bb; }
        const n = px.length, den = n * saa - sa * sa, m = den ? (n * sab - sa * sb) / den : 0, c = (sb - m * sa) / n; dashes.push({ a0, a1, m, c, px });
      }
      if (span < N * 0.15 || b1 - b0 > Math.max(6 * T, span * 0.22) || px.length > span * T * 1.6) continue;   // lambi + patli (jhuki / gol bhi — 12° tak)
      const sum = new Float64Array(span), cnt = new Float64Array(span);
      for (const p of px) { const x = p % w, y = (p - x) / w, a = horiz ? x : y, b = horiz ? y : x; sum[a - a0] += b; cnt[a - a0]++; }
      const cy = new Float64Array(span); let last = -1;
      for (let i = 0; i < span; i++) if (cnt[i]) { cy[i] = sum[i] / cnt[i]; if (last >= 0) for (let j = last + 1; j < i; j++) cy[j] = cy[last] + (cy[i] - cy[last]) * (j - last) / (i - last); last = i; }
      const K = Math.max(2, Math.min(40, Math.floor(span / 3))), sl = (cy[K] - cy[0]) / K, sr = (cy[span - 1] - cy[span - 1 - K]) / K, ext = Math.round(N * 0.3);
      kill.push(...px); if (!horiz) for (const q of px) vk[q] = 1;
      if (horiz) { const cl = v => Math.max(-0.2, Math.min(0.2, v)), L0 = cl(sl), R0 = cl(sr); rules.push({ cover: span, f: a => a < a0 ? cy[0] + L0 * (a - a0) : a > a1 ? cy[span - 1] + R0 * (a - a1) : cy[a - a0] }); }
      for (let a = Math.max(0, a0 - ext); a <= Math.min(N - 1, a1 + ext); a++) {
        const c = a < a0 ? cy[0] + sl * (a - a0) : a > a1 ? cy[span - 1] + sr * (a - a1) : cy[a - a0], bc = Math.round(c);
        for (let b = Math.max(0, bc - T - 1); b <= Math.min(M - 1, bc + T + 1); b++) { const q = at(a, b); if (thin[q]) kill.push(q); }
      }
    }
    // toti hui (dash) lakeer: ek seedh mein patle tukde jor kar — kul lambai ≥ 20% aur 40%+ bhari = lakeer
    dashes.sort((p, q) => p.a0 - q.a0);
    const nx = new Int32Array(dashes.length).fill(-1), pv = new Int32Array(dashes.length).fill(-1), gmax = N * 0.1;
    for (let i = 0; i < dashes.length; i++) {
      const d = dashes[i]; let bj = -1, bg = Infinity;
      for (let j = i + 1; j < dashes.length; j++) {
        const e = dashes[j], gap = e.a0 - d.a1; if (gap > gmax) break; if (gap < -3 || pv[j] >= 0) continue;
        if (Math.abs(d.m - e.m) > 0.12 || Math.abs(d.m * e.a0 + d.c - (e.m * e.a0 + e.c)) > T + 1 + 0.03 * Math.max(0, gap)) continue;
        if (gap < bg) { bg = gap; bj = j; }
      }
      if (bj >= 0) { nx[i] = bj; pv[bj] = i; }
    }
    for (let i = 0; i < dashes.length; i++) {
      if (pv[i] >= 0) continue; const ch = []; for (let k = i; k >= 0; k = nx[k]) ch.push(dashes[k]);
      if (ch.length < 2) continue;
      const ext0 = ch[0].a0, ext1 = ch[ch.length - 1].a1, cov = ch.reduce((s, d) => s + d.a1 - d.a0 + 1, 0);
      if (ext1 - ext0 < N * 0.2 || cov < (ext1 - ext0) * 0.4) continue;
      for (const d of ch) kill.push(...d.px);
      if (horiz) { const f0 = ch[0], f1 = ch[ch.length - 1]; rules.push({ cover: cov, f: a => a < ext0 ? f0.m * a + f0.c : a > ext1 ? f1.m * a + f1.c : pred(a) }); }
      const pred = a => { let d = ch[0]; for (const e of ch) { if (e.a0 <= a) d = e; } const nd = ch[ch.indexOf(d) + 1]; if (nd && a > d.a1) { const t = (a - d.a1) / Math.max(1, nd.a0 - d.a1); return (d.m * d.a1 + d.c) * (1 - t) + (nd.m * nd.a0 + nd.c) * t; } return d.m * a + d.c; };
      for (let a = Math.max(0, ext0 - Math.round(N * 0.15)); a <= Math.min(N - 1, ext1 + Math.round(N * 0.15)); a++) {
        const bc = Math.round(pred(a)); for (let b = Math.max(0, bc - T - 1); b <= Math.min(M - 1, bc + T + 1); b++) { const q = at(a, b); if (thin[q]) kill.push(q); }
      }
    }
    for (const q of kill) o[q] = 0;
  }
  return { ink: o, vk, T, rules };
}
function textInk(ink, w, h, near, T) {   // sirf likhai jaisi syahi: bohat lambe / bohat oonche tukde (kaghaz ka kinara, saya, lakeer ka bacha) line pehchanne mein nahi
  const lab = new Int32Array(w * h), C = [], st = [];
  for (let s = 0; s < w * h; s++) {
    if (!ink[s] || lab[s]) continue;
    const id = C.length + 1, c = { a: 0, x0: w, x1: 0, y0: h, y1: 0 }; lab[s] = id; st.push(s);
    while (st.length) {
      const p = st.pop(), x = p % w, y = (p - x) / w; c.a++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; const q = yy * w + xx; if (ink[q] && !lab[q]) { lab[q] = id; st.push(q); } } }
    }
    C.push(c);
  }
  const Hm = median(C.filter(c => c.a >= 8 && c.y1 - c.y0 >= 2).map(c => c.y1 - c.y0 + 1)) || 10;
  const keep = new Uint8Array(C.length + 1);
  const nb = near ? new Uint32Array(C.length + 1) : null; if (near) for (let i = 0; i < lab.length; i++) if (lab[i] && near[i]) nb[lab[i]]++;
  const th = (T || 3) * 2 + 1;
  C.forEach((c, i) => { const ch = c.y1 - c.y0 + 1, cw = c.x1 - c.x0 + 1; keep[i + 1] = c.a >= 3 && ch <= Hm * 5 && !(cw > Hm * 12 && ch < Hm * 1.6) && !(cw > w * 0.6)
    && !(ch <= th && cw >= ch * 4)   // patli lambi patti (lakeer ka bacha / kinare ka tukda) — line pehchanne mein nahi
    && !(nb && nb[i + 1] >= c.a * 0.6) ? 1 : 0; });   // kaghaz ke kinare (saya) par
  const big = new Uint8Array(C.length + 1); C.forEach((c, i) => { if (c.y1 - c.y0 + 1 > Hm * 5 || c.x1 - c.x0 + 1 > w * 0.6) big[i + 1] = 1; });
  const o = new Uint8Array(w * h), bg = new Uint8Array(w * h); for (let i = 0; i < o.length; i++) if (lab[i]) { if (keep[lab[i]]) o[i] = 1; else if (big[lab[i]]) bg[i] = 1; }
  return { ink: o, Hm, big: bg };   // big = kinara / saya / dhabba (likhai nahi)
}
// ek list (x0..x1 ke andar) ki lines → [{ y0, y1, ink }]
function rowLines(ink, w, x0, x1, ya, yb) {
  const cw = x1 - x0 + 1, P = new Float32Array(yb - ya + 1), on = Math.max(2, cw * 0.004);
  for (let y = ya; y <= yb; y++) { let c = 0; for (let x = x0; x <= x1; x++) c += ink[y * w + x]; P[y - ya] = c; }
  let segs = []; let a = -1, gap = 0;
  for (let i = 0; i <= P.length; i++) { const v = i < P.length && P[i] >= on; if (v) { if (a < 0) a = i; gap = 0; } else if (a >= 0 && (++gap > 1 || i === P.length)) { segs.push([a, i - gap]); a = -1; gap = 0; } }
  const sum = (p, q) => { let s = 0; for (let i = p; i <= q; i++) s += P[i]; return s; };
  let Hm = median(segs.map(s => s[1] - s[0] + 1).filter(n => n >= 4)) || 12;
  // lambi (do line juri) = beech ki sab se khali qatar par kaato
  const split = s => { const n = s[1] - s[0] + 1; if (n <= Hm * 1.7) return [s]; const m = Math.round(Hm * 0.55); let bi = -1, bv = Infinity; for (let i = s[0] + m; i <= s[1] - m; i++) { const v = (P[i - 1] + P[i] * 2 + P[i + 1]) / 4; if (v < bv) { bv = v; bi = i; } } if (bi < 0 || bv > (sum(s[0], s[1]) / n) * 0.35) return [s]; return [...split([s[0], bi]), ...split([bi + 1, s[1]])]; };
  segs = segs.flatMap(split);
  Hm = median(segs.map(s => s[1] - s[0] + 1).filter(n => n >= 4)) || Hm;
  let L = segs.map(s => ({ y0: s[0] + ya, y1: s[1] + ya, ink: sum(s[0], s[1]) }));
  const Im = median(L.map(l => l.ink)) || 1;
  // chhota nishan (nuqta / dum / "1" / kat-ti dum) — paas wali line mein milao (kabhi phenko nahi)
  for (let k = 0; k < 40; k++) {
    if (L.length < 2) break;
    let wi = -1, wv = Infinity; L.forEach((l, i) => { const hh = l.y1 - l.y0 + 1; const gp = Math.min(i ? l.y0 - L[i - 1].y1 : Infinity, i < L.length - 1 ? L[i + 1].y0 - l.y1 : Infinity); if (hh < Hm * 0.4 || l.ink < Im * 0.12 || (hh < Hm * 0.7 && gp <= Hm * 0.3)) { const v = l.ink; if (v < wv) { wv = v; wi = i; } } });
    if (wi < 0) break;
    const l = L[wi], up = L[wi - 1], dn = L[wi + 1], du = up ? l.y0 - up.y1 : Infinity, dd = dn ? dn.y0 - l.y1 : Infinity, t = du <= dd ? up : dn;
    t.y0 = Math.min(t.y0, l.y0); t.y1 = Math.max(t.y1, l.y1); t.ink += l.ink; L.splice(wi, 1);
  }
  return { L, Hm };
}
// 📐 mura hua kaghaz: chhapi lakeerein (copy ka safha) seedhi karo — har khana (x) sirf upar / neeche khiskta hai, likhai ka koi hissa nahi kat-ta
// → { yOf(x, Y) } ya null (lakeerein kam / ulti seedhi = waisa hi chhoro)
function dewarp(rules, w, h, Hm) {
  let R = rules.filter(r => r.cover >= w * 0.3).map(r => { const y = new Float32Array(w); for (let x = 0; x < w; x++) y[x] = r.f(x); return { cover: r.cover, y, c: y[w >> 1] }; });
  if (R.length < 2) return null;
  R.sort((p, q) => p.c - q.c);
  const mean = (p, q) => { let s = 0; for (let x = 0; x < w; x += 4) s += Math.abs(p.y[x] - q.y[x]); return s / Math.ceil(w / 4); };
  for (let k = 1; k < R.length;) { if (mean(R[k - 1], R[k]) < Hm * 0.5) R.splice(R[k - 1].cover >= R[k].cover ? k : k - 1, 1); else k++; }   // ek hi lakeer do dafa
  for (let guard = 0; guard < 50 && R.length >= 2; guard++) {   // kahin aapas mein kat-ti hon to kamzor wali nikalo
    let bad = -1; for (let k = 1; k < R.length && bad < 0; k++) { let mn = Infinity; for (let x = 0; x < w; x += 2) mn = Math.min(mn, R[k].y[x] - R[k - 1].y[x]); if (mn < Hm * 0.4) bad = R[k].cover < R[k - 1].cover ? k : k - 1; }
    if (bad < 0) break; R.splice(bad, 1);
  }
  if (R.length < 2) return null;
  for (const r of R) { let mx = 0; for (let x = 0; x < w; x++) mx = Math.max(mx, Math.abs(r.y[x] - r.c)); if (mx > h * 0.12) return null; }   // itna mura = ghalat lakeer — chhoro
  let dev = 0; for (const r of R) for (let x = 0; x < w; x += 4) dev = Math.max(dev, Math.abs(r.y[x] - r.c)); if (dev < Math.max(2, Hm * 0.12)) return null;   // pehle hi seedha
  const Y = R.map(r => r.c);
  return {
    yOf: (x, yy) => {
      if (yy <= Y[0]) return yy + R[0].y[x] - Y[0];
      if (yy >= Y[Y.length - 1]) return yy + R[R.length - 1].y[x] - Y[Y.length - 1];
      let k = 0; while (k < Y.length - 2 && yy > Y[k + 1]) k++;
      const t = (yy - Y[k]) / (Y[k + 1] - Y[k]); return R[k].y[x] + t * (R[k + 1].y[x] - R[k].y[x]);
    }, n: R.length
  };
}
function warpGray(G, D, fill) { const { w, h, g } = G, o = new Float32Array(w * h); for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const sy = D.yOf(x, y), y0 = Math.floor(sy), t = sy - y0; o[y * w + x] = y0 < 0 || y0 >= h - 1 ? fill : g[y0 * w + x] * (1 - t) + g[(y0 + 1) * w + x] * t; } return { w, h, g: o }; }
function warpMask(m, w, h, D) { const o = new Uint8Array(w * h); for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const sy = Math.round(D.yOf(x, y)); o[y * w + x] = sy < 0 || sy >= h ? 1 : m[sy * w + x]; } return o; }
// → { lines: [{ y0, y1, segs: [[xa, xb], …] }], Hm, deg } ya null
function linePlan(G0) {
  if (!G0 || G0.w < 60 || G0.h < 60) return null;
  const F = flatten(G0), ink0 = inkOf(F), deg = skewOf(F, ink0);   // chhapi lakeerein bhi (zaviya unhi se saaf)
  let G = rotGray(F, deg, 255); const { w, h } = G;
  // kaghaz ke bahar (mez / deewar / gehra saya — apna 90% roshan bhi kaghaz ka 40% se kam) = bg · gehra hissa (median 55% se kam) = dk
  const Mv = [...F.M].sort((p, q) => p - q), Pp = Mv[Math.floor(Mv.length * 0.9)] || 255, Dv = [...F.Md].sort((p, q) => p - q), Pd = Dv[Math.floor(Dv.length * 0.9)] || 255;
  const t = deg * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t), cx = w / 2, cy = h / 2;
  let bg = new Uint8Array(w * h), dk = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x - cx, dy = y - cy, sx = cx + dx * cs - dy * sn, sy = cy + dx * sn + dy * cs, bx = Math.floor(sx / F.B), by = Math.floor(sy / F.B), i = y * w + x; if (bx < 0 || by < 0 || bx >= F.bw || by >= F.bh) { bg[i] = 1; dk[i] = 1; continue; } const bi = by * F.bw + bx; if (F.M[bi] < Pp * 0.4) bg[i] = 1; if (F.Md[bi] < Pd * 0.55) dk[i] = 1; }
  const nearOf = () => {   // kaghaz ke kinare ke paas (bg se B tak)
    const r = F.B, W1 = w + 1, I = new Int32Array(W1 * (h + 1)), o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += bg[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
    for (let y = 0; y < h; y++) { const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1); for (let x = 0; x < w; x++) { const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1); if (I[yb * W1 + xb] - I[ya * W1 + xb] - I[yb * W1 + xa] + I[ya * W1 + xa] > 0) o[y * w + x] = 1; } }
    return o;
  };
  let near = nearOf();
  const stage = () => { const inkA = inkOf(G); for (let i = 0; i < inkA.length; i++) if (bg[i]) inkA[i] = 0; const RC = ruleClean(inkA, w, h), TI = textInk(RC.ink, w, h, near, RC.T); return { inkA, RC, TI }; };
  let S = stage(), warped = 0;
  const D = dewarp(S.RC.rules, w, h, S.TI.Hm);
  if (D) { G = warpGray(G, D, 255); bg = warpMask(bg, w, h, D); dk = warpMask(dk, w, h, D); near = nearOf(); S = stage(); warped = D.n; }
  const RC = S.RC, TI = S.TI, ink = TI.ink, T = RC.T, raw = S.inkA;
  for (let i = 0; i < raw.length; i++) if (RC.vk[i] || TI.big[i] || ((dk[i] || near[i]) && !ink[i])) raw[i] = 0;   // gehre hisse (ungli / saya) ki be-likhai syahi bhi nahi   // asal syahi (chhapi lakeerein samait, khari lakeer / dhabba ke baghair) — kaatne se pehle jaanch
  const colC = new Float32Array(w), rowC = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink[y * w + x]) { colC[x]++; rowC[y]++; }
  const edge = (arr, n, lim) => { let a = 0, b = n - 1; while (a < b && arr[a] <= lim) a++; while (b > a && arr[b] <= lim) b--; return [a, b]; };
  const [x0, x1] = edge(colC, w, Math.max(1, h * 0.002)), [y0, y1] = edge(rowC, h, Math.max(1, w * 0.002));
  if (x1 - x0 < w * 0.08 || y1 - y0 < h * 0.04) return null;
  // do alag list? beech (30–70%) mein khali patti + dono taraf ki lines barabar NAHI
  const cw = x1 - x0, lim = (y1 - y0) * 0.004; let best = null, run = 0;
  for (let x = Math.round(x0 + cw * 0.3); x <= Math.round(x0 + cw * 0.7); x++) { if (colC[x] <= lim) { run++; if (!best || run > best.n) best = { n: run, x: x - Math.floor(run / 2) }; } else run = 0; }
  let lists = [[x0, x1]];
  if (best && best.n >= Math.max(3, cw * 0.04)) {
    const R = rowLines(ink, w, best.x, x1, y0, y1), Lf = rowLines(ink, w, x0, best.x, y0, y1);
    const hit = (a, B, m) => a.L.filter(l => { const c = (l.y0 + l.y1) / 2; return B.L.some(b => c >= b.y0 - m && c <= b.y1 + m); }).length / Math.max(1, a.L.length);
    const m = Math.max(R.Hm, Lf.Hm) * 0.3;
    if (R.L.length >= 2 && Lf.L.length >= 2 && Math.min(hit(R, Lf, m), hit(Lf, R, m)) < 0.6) lists = [[best.x, x1], [x0, best.x]];   // daayan pehle
  }
  const out = []; let Hall = [];
  for (const [a, b] of lists) {
    const R = rowLines(ink, w, a, b, y0, y1), Hm = R.Hm; Hall.push(Hm);
    // shuru / aakhir ki "line" jo tasveer ke kinare ko chhoo rahi ho aur jis ki syahi zyada tar gehre hisse (mez / ungli / saya) mein = kachra
    // shuru / aakhir ki "line" jis ki syahi zyada tar gehre hisse (mez / ungli / kapra / saya) mein — ya tasveer ke kinare ko chhoo kar sirf kone mein = kachra
    const junk = (l, edgeOk) => { let n = 0, d = 0, e = 0; for (let y = l.y0; y <= l.y1; y++) for (let x = a; x <= b; x++) if (ink[y * w + x]) { n++; if (dk[y * w + x]) d++; if (x < w * 0.15 || x > w * 0.85) e++; } return n > 0 && (d / n >= 0.6 || (edgeOk && e / n >= 0.9)); };
    const L = R.L.slice();
    while (L.length > 1 && junk(L[0], L[0].y0 <= y0 + 2 && y0 <= 3)) L.shift();
    while (L.length > 1 && junk(L[L.length - 1], L[L.length - 1].y1 >= y1 - 2 && y1 >= h - 4)) L.pop();
    for (const l of L) {
      const py = Math.max(2, Math.round(Hm * 0.18)), ya = Math.max(0, l.y0 - py), yb = Math.min(h - 1, l.y1 + py);
      // khali khana = likhai ki syahi nahi AUR asal syahi bhi sirf lakeer jitni (≤ 3T) — likhai wala khana KABHI nahi kat-ta
      const n = b - a + 1, blank = new Uint8Array(n);
      for (let x = a; x <= b; x++) { let d = 0, r = 0; for (let y = ya; y <= yb; y++) { const i = y * w + x; d += ink[i]; r += raw[i]; } blank[x - a] = d === 0 && r <= 3 * T ? 1 : 0; }
      let ca = 0, cb = n - 1; while (ca < n && blank[ca]) ca++; while (cb > ca && blank[cb]) cb--; if (ca >= n) continue;
      const hh = l.y1 - l.y0 + 1, gapMax = Math.max(14, Math.round(Math.max(hh, Hm) * 1.1)), keep = Math.max(8, Math.round(Math.max(hh, Hm) * 0.45));
      const segs = []; let sa = ca, z = 0;
      for (let i = ca; i <= cb + 1; i++) { const empty = i <= cb && blank[i]; if (empty) z++; else { if (z > gapMax) { segs.push([sa, i - z - 1]); sa = i; } z = 0; } }
      segs.push([sa, cb]);
      const px = Math.max(3, Math.round(Hm * 0.3)), segsX = segs.map(([p, q], k) => [Math.max(0, a + p - (k === 0 ? px : keep >> 1)), Math.min(w - 1, a + q + (k === segs.length - 1 ? px : keep >> 1))]);
      out.push({ y0: ya, y1: yb, segs: segsX, list: lists.length > 1 ? (a === lists[0][0] ? 1 : 2) : 0 });
    }
  }
  const Hm = median(Hall) || 12;
  if (!out.length || out.some(l => l.y1 - l.y0 > Hm * 6 + 20)) return null;   // samajh nahi aaya — purana zoom
  return { G, lines: out, Hm, deg, warped, raw, det: ink };
}
// ek line → 1-bit qataron ka Buffer (64 byte = 512 dot fi qatar, beech mein) · photo-print jaisa (contrast, sharp, Atkinson)
function lineBits(G, l, opt = {}) {
  const { w, g } = G, gapW = Math.max(8, Math.round((l.y1 - l.y0) * 0.35)), parts = l.segs, sh = l.y1 - l.y0 + 1;
  const sw = parts.reduce((s, [a, b]) => s + (b - a + 1), 0) + gapW * (parts.length - 1);
  const xmap = new Int32Array(sw); let p = 0;   // strip ka x → asal x (−1 = khali faasla)
  parts.forEach(([a, b], k) => { if (k) for (let i = 0; i < gapW; i++) xmap[p++] = -1; for (let x = a; x <= b; x++) xmap[p++] = x; });
  const maxH = opt.maxH || 120, sc = Math.min(512 / sw, maxH / sh, opt.up || 2.5), Wd = Math.max(8, Math.min(512, Math.round(sw * sc))), H = Math.max(4, Math.round(sh * sc));
  const v = new Float32Array(Wd * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(sh - 1, (y + 0.5) / sc - 0.5), yA = Math.max(0, Math.floor(fy)), yB = Math.min(sh - 1, yA + 1), ty = Math.max(0, fy - yA);
    for (let x = 0; x < Wd; x++) {
      if (sc >= 1) {   // bara karna = bilinear
        const fx = Math.min(sw - 1, (x + 0.5) / sc - 0.5), xA = Math.max(0, Math.floor(fx)), xB = Math.min(sw - 1, xA + 1), tx = Math.max(0, fx - xA);
        const q = (xx, yy) => xmap[xx] < 0 ? 255 : g[(l.y0 + yy) * w + xmap[xx]];
        v[y * Wd + x] = (q(xA, yA) * (1 - tx) + q(xB, yA) * tx) * (1 - ty) + (q(xA, yB) * (1 - tx) + q(xB, yB) * tx) * ty;
      } else {   // chhota karna = average
        const xa = Math.floor(x / sc), xb = Math.max(xa + 1, Math.min(sw, Math.floor((x + 1) / sc))), ya = Math.floor(y / sc), yb = Math.max(ya + 1, Math.min(sh, Math.floor((y + 1) / sc))); let t = 0, n = 0;
        for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) { t += xmap[xx] < 0 ? 255 : g[(l.y0 + yy) * w + xmap[xx]]; n++; }
        v[y * Wd + x] = n ? t / n : 255;
      }
    }
  }
  const hist = new Array(256).fill(0); for (const x of v) hist[Math.max(0, Math.min(255, x | 0))]++;
  let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > v.length * 0.015) { lo = i; break; } } acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > v.length * 0.35) { hi = i; break; } }
  hi = Math.min(hi, 222); lo = Math.min(lo, 140);
  if (opt.raw) {   // halki syahi (kamzor qalam / saya) bhi gehri: is line ki asal syahi ka 30% gehra hissa = poora kala
    const vs = []; for (let y = l.y0; y <= l.y1; y++) for (const [a, b] of parts) for (let x = a; x <= b; x++) if (opt.raw[y * w + x]) vs.push(g[y * w + x]);
    if (vs.length >= 20) { vs.sort((p, q) => p - q); lo = Math.max(lo, Math.min(vs[Math.floor(vs.length * 0.3)], hi - 60)); }
  }   // kaghaz flatten se safed — halki chhapi lakeer bhi safed ke qareeb, syahi gehri
  const span = Math.max(30, hi - lo);
  for (let i = 0; i < v.length; i++) { const t = Math.max(0, Math.min(1, (v[i] - lo) / span)); v[i] = 255 * Math.pow(t, 1.3); }
  if (Wd > 2 && H > 2) {
    const b = new Float32Array(v.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= Wd) continue; s += v[yy * Wd + xx]; n++; } } b[y * Wd + x] = s / n; }
    for (let i = 0; i < v.length; i++) v[i] = Math.max(0, Math.min(255, v[i] + 0.8 * (v[i] - b[i])));
  }
  const out = Buffer.alloc(64 * H), off = (512 - Wd) >> 1, add = (x, y, e) => { if (x >= 0 && x < Wd && y < H) v[y * Wd + x] += e; };
  for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
    const i = y * Wd + x, old = v[i], nv = old < 128 ? 0 : 255, e = (old - nv) / 8;
    if (nv === 0) { const X = x + off; out[y * 64 + (X >> 3)] |= 0x80 >> (X & 7); }
    add(x + 1, y, e); add(x + 2, y, e); add(x - 1, y + 1, e); add(x, y + 1, e); add(x + 1, y + 1, e); add(x, y + 2, e);
  }
  return { H, out };
}
// plan → thermal rasters { z0, z1 … } (GS v 0, har ek ≤ 640 qatar, sirf line ke beech kat-ta) + chabiyan
function lineRasters(P, opt = {}) {
  const SEP = (() => { const b = Buffer.alloc(64 * 7); for (let x = 8; x < 504; x++) if ((x % 6) < 3) b[3 * 64 + (x >> 3)] |= 0x80 >> (x & 7); return b; })();   // patli nuqta lakeer (tick ke liye jagah)
  const LIST = n => { const b = Buffer.alloc(64 * 4); for (let x = 0; x < 512; x++) { b[64 + (x >> 3)] |= 0x80 >> (x & 7); b[2 * 64 + (x >> 3)] |= 0x80 >> (x & 7); } return b; };
  const chunks = [], keys = []; let cur = [], rows = 0;
  const push = () => { if (!rows) return; const H = rows, k = 'z' + chunks.length, hdr = Buffer.from([0x1b, 0x61, 0x00, 0x1d, 0x76, 0x30, 0x00, 64, 0, H & 255, H >> 8]); chunks.push(Buffer.concat([hdr, ...cur]).toString('latin1')); keys.push(k); cur = []; rows = 0; };
  const add = b => { const n = b.length / 64; if (rows && rows + n > 640) push(); cur.push(b); rows += n; };
  let lastList = P.lines.length ? P.lines[0].list : 0;
  P.lines.forEach((l, k) => {
    if (k && l.list !== lastList) { add(LIST()); lastList = l.list; }
    const r = lineBits(P.G, l, { raw: P.raw, maxH: Math.round((opt.maxH || 100) * Math.min(2.6, Math.max(1, (l.y1 - l.y0) / (P.Hm * 1.4)))) });
    add(r.out); if (k < P.lines.length - 1) add(SEP);
  });
  push();
  const rasters = {}; keys.forEach((k, i) => { rasters[k] = chunks[i]; });
  return { rasters, keys };
}
function lineSlipText(o, keys, n, opt = {}) {
  const out = headLines(o, { rp: opt.rp, n: null });
  out.push(C1 + GS + 'B\x01' + ' PARCHI JAISI LIKHI - BINA AI ' + GS + 'B\x00');
  if (UR.isOn()) out.push(UR.line('پرچی جیسی لکھی — ہر لائن الگ، بغیر AI', 34, 1));
  out.push(C1 + n + ' lines' + (opt.two ? '  -  pehle DAAYAN list, phir BAAYAN' : ''));
  out.push(L0 + hr());
  keys.forEach(k => out.push(CRM + k));
  out.push(L0 + hr(), '', CUT);
  return out.join('\r\n');
}
// img (decodeJpeg) → { text, rasters, n, mode 'line'|'zoom' } ya null — line zoom; na bane to purana poori parchi zoom
function zoomSlip(o, img, opt = {}) {
  if (!img) return null;
  let P = null; try { P = linePlan(grayOf(img, 1600)); } catch { P = null; }
  if (P && P.lines.length) {
    const { rasters, keys } = lineRasters(P, opt);
    if (keys.length) return { text: lineSlipText(o, keys, P.lines.length, { rp: opt.rp, two: P.lines.some(l => l.list) }), rasters, n: P.lines.length, mode: 'line', deg: P.deg };
  }
  const plan = zoomPlan(img), rasters = {};
  plan.forEach((p, k) => { try { const r = cropRaster(img, p.box, { raw: true, w: 512, h: 700, gamma: 1.2 }); if (r) rasters['z' + k] = r; } catch {} });
  if (!Object.keys(rasters).length) return null;
  return { text: imageSlipText(o, plan, { rp: opt.rp }), rasters, n: plan.length, mode: 'zoom' };
}

// ---------- 🖨 v2.0: caption mein "print" → A4 (malik: "print likha ho to A4 se print · print ke baghair nahi · saman wali ho ya koi bhi") ----------
// "print" / "Print" / "PRINT" / "پرنٹ" (printer / printing nahi) · "print 2" / "2 print" / "print x2" = copies (1–5). → 0 = print nahi
const PR_RE = /(^|[^a-z])print([^a-z]|$)|پرنٹ/i;
function printReq(cap) {
  const t = UDIG(String(cap || '')).toLowerCase(); if (!PR_RE.test(t)) return 0;
  const m = t.match(/(?:print|پرنٹ)\s*x?\s*(\d)(?!\d)|(?:^|[^\d])(\d)\s*x?\s*(?:print|پرنٹ)/);   // copy ka hindsa akela ho (phone number ka aakhri hindsa nahi)
  return m ? Math.max(1, Math.min(5, Number(m[1] || m[2]) || 1)) : -1;   // -1 = print, copies setting wali
}
const stripPrint = cap => UDIG(String(cap || '')).replace(/(^|[^a-z\d])(\d\s*x?\s*)?(print|پرنٹ)(\s*x?\s*\d(?!\d))?(?=[^a-z]|$)/gi, '$1 ').replace(/\s+/g, ' ').trim();

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
module.exports = { printReq, stripPrint, zoomPlan, imageSlipText, grayOf, flatten, textInk, ruleClean, inkOf, skewOf, rotGray, dropRules, rowLines, linePlan, lineBits, lineRasters, lineSlipText, zoomSlip, lkey, glossOf, normPh, isMob, phPretty, parseCaption, vcardInfo, numOf, normUnit, qtyStr, validBox, normLine, parseGemini, localTextLines, geminiRead, buildIndex, matchOne, matchLines, isUnclear, sortForPrint, rackOf, packingText, failText, writtenText, writtenLines, bmpRaster, toJob, stripEsc, decodeJpeg, padBox, cropRaster, a4Spec, dayOf, PROMPT_IMG, PROMPT_TXT, CRM, W };

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
  try { const s = await LINK.get(); if (s.exists) { const d = s.data() || {}; L.cmd = Number(d.cmd) || 0; L.me = String(d.me || ''); L.out = Number(d.out) || 0; } } catch (e) { log('⚠️ waLink: ' + e.message); }
  let lw = Promise.resolve(), lastLinkW = 0;
  const setLink = p => { Object.assign(L, p || {}); L.at = Date.now(); L.host = os.hostname(); L.ver = VER; const snap = { ...L }; lastLinkW = Date.now(); lw = lw.then(() => LINK.set(snap)).catch(e => log('⚠️ waLink likha nahi: ' + e.message)); return lw; };

  // ---------- ⚙️ settings + data (live) ----------
  let S = { on: true, allow: [], th: true, a4: true, thp: '', zm: true, a4m: 'print', a4c: 1, prTo: ['03462901193'], prFrom: ['03450412515'] }, sReady; const settingsReady = new Promise(r => { sReady = r; });
  BA.doc('waParchi').onSnapshot(s => {
    const d = (s.exists && s.data()) || {};
    S = { on: d.on !== false, allow: [...new Set((Array.isArray(d.allow) ? d.allow : []).map(normPh).filter(Boolean))], th: d.th !== false, a4: d.a4 !== false, thp: String(d.thp || '').trim(), zm: d.zm !== false,
      a4m: ['print', 'all', 'off'].includes(d.a4m) ? d.a4m : 'print', a4c: Math.max(1, Math.min(3, Number(d.a4c) || 1)),   // v2.0: A4 sirf "print" likhne par (default) · har parchi · band
      prTo: Array.isArray(d.prTo) ? [...new Set(d.prTo.map(normPh).filter(Boolean))] : ['03462901193'],
      prFrom: Array.isArray(d.prFrom) ? [...new Set(d.prFrom.map(normPh).filter(Boolean))] : ['03450412515'] };   // v2.3: print phone par in numbers se AAYI tasveer + print = A4   // v2.0: apne number se in chats mein "print" = A4 (default Mubeen)   // v1.9: zm = thermal par parchi ki asal likhai (line zoom, bina AI) — default ON
    sReady();
  }, e => { authErr(e); sReady(); });
  setTimeout(() => sReady(), 20000);
  let AI = { key: '', model: '' };
  BA.doc('aiConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; AI = { key: String(d.key || ''), model: String(d.model || '') }; }, authErr);
  let ALIAS = {}, URDU = {}, HIDDEN = {}, RACKS = { order: [], ic: {}, cn: {} }, LEARN = {}, GLOSS = '', dataVer = 0;
  BA.doc('itemAliases').onSnapshot(s => { ALIAS = (s.exists && (s.data() || {}).map) || {}; dataVer++; }, authErr);
  BA.doc('waLearn').onSnapshot(s => { LEARN = (s.exists && (s.data() || {}).m) || {}; GLOSS = glossOf(LEARN); dataVer++; }, authErr);   // v1.6: 🧠 📒 Naam seekho (app, malik)
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
  const index = async () => { const c = await catalog(), k = c.at + ':' + dataVer; if (!IX || ixKey !== k) { IX = buildIndex(c.items, { alias: ALIAS, urdu: URDU, hidden: HIDDEN, learn: LEARN }); ixKey = k; } return IX; };

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
  // v2.0: 🖨 caption "print" → wahi tasveer A4 par (a4Img + a4Jobs → a4-print.js HP LaserJet) — AI / header NAHI, jaisi bheji waisi. o = order (status pr.a4) ya null
  let a4Chain = Promise.resolve();
  function a4Send(jpg, n, meta, o) {
    const p = a4Chain.then(async () => {
      if (!jpg || !fitsUrl(jpg, A4_MAX)) throw Error('tasveer A4 ke liye bohat bari');
      const now = Date.now(), aid = 'wp' + now.toString(36) + Math.random().toString(36).slice(2, 6), th = await thumbOf(jpg).catch(() => '');
      const b = db.batch();
      b.set(A4I.doc(aid), { img: dataUrl(jpg), by: 'wa-parchi', at: now });
      b.set(A4J.doc(aid), { k: 'wa', to: 'a4', ph: '', t: String(meta.t || 'WhatsApp print').slice(0, 60), ...(meta.hd ? { hd: String(meta.hd).replace(/[|"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) } : {}), th: th && th.length < 40000 ? th : '', by: 'wa-parchi', byName: 'WhatsApp', at: now, status: 'new', copies: Math.max(1, Math.min(5, n || 1)), src: o ? o.id : 'self' });
      await b.commit();
      log(`🖨 A4 ${n || 1} copy → ${meta.t || ''} (${aid})`);
      if (o) { await upd(o.id, { 'pr.a4': 'sent', 'pr.a4j': [aid] }); watchA4(o.id, [aid]); }
      return aid;
    });
    a4Chain = p.catch(e => { log('🖨 A4 ✕ ' + ((e && e.message) || e)); if (o) { const e0 = errs.get(o.id) || { te: '', ae: '' }; e0.ae = String((e && e.message) || e).slice(0, 140); errs.set(o.id, e0); upd(o.id, { 'pr.a4': 'failed', perr: perrOf(o.id) }).catch(() => {}); } });
    return p;
  }
  // v1.9: 🔎 thermal = parchi ki ASAL likhai, har line alag zoom (zoomSlip — AI nahi). Na bane = throw (purana raasta / ghalti likho).
  async function zoomThermal(o, jpg, opt = {}) {
    const img = jpg ? decodeJpeg(jpg) : null; if (!img) throw Error('tasveer nahi khuli');
    const t0 = Date.now(), Z = zoomSlip(o, img, { rp: opt.rp }); if (!Z) throw Error('tasveer thermal ke liye nahi bani');
    let text = Z.text; try { text = await UR.fillNotes(text, 1); } catch { text = UR.strip(text); }
    const e = await getParchi().sendJobs([toJob(text, Z.rasters)], S.thp || TH_PRINTER); if (e) throw e;
    log(`🔎 #${shortNo(o.id)} parchi jaisi (${Z.mode === 'line' ? Z.n + ' lines alag' + (Z.deg ? ' · seedhi ' + Z.deg + '°' : '') : 'poori zoom'}) · ${Date.now() - t0} ms`);
    return Z;
  }
  async function zoomNow(o, jpg) {   // v1.9: app ki parchi — AI ka intezar NAHI, tasveer aate hi thermal (pr.th ka haal saath)
    const e0 = errs.get(o.id) || { te: '', ae: '' }; errs.set(o.id, e0); trim(errs);
    await upd(o.id, { 'pr.th': 'printing', 'pr.zm': 1, perr: '' });
    try { await zoomThermal(o, jpg); e0.te = ''; await upd(o.id, { 'pr.th': 'done', 'pr.at': Date.now(), perr: perrOf(o.id) }); return 'done'; }
    catch (e) { e0.te = String((e && e.message) || e).slice(0, 140); await upd(o.id, { 'pr.th': 'failed', perr: perrOf(o.id) }); log(`🔎 #${shortNo(o.id)} thermal ✕ ${e0.te}`); return 'failed'; }
  }
  // thermal aur A4 alag alag — ek ruke to doosra nahi (CLAUDE.md bug safai 4). Print KABHI khud dobara nahi.
  // opt.noTh = thermal pehle hi (zoomNow) — sirf A4 · tasveer ho + S.zm = thermal par likhai ka zoom, warna AI wali list (likhi WhatsApp list)
  async function printOrder(o, j, jpg, opt = {}) {
    const P = opt.fail ? { clear: [], unc: [] } : sortForPrint(j, RACKS), wantT = S.th !== false && !opt.noTh, wantA = !!opt.a4, zm = S.zm && !!jpg;   // v2.0: A4 ab caption "print" se (a4Send) — BILL BAAQI A4 khud nahi
    if (!wantT && !wantA && opt.noTh) return;
    const img = !zm && !opt.fail && jpg && P.unc.some(l => l.b) ? decodeJpeg(jpg) : null;
    const prevE = errs.get(o.id) || {}, e0 = { te: opt.noTh ? (prevE.te || '') : '', ae: '' }; errs.set(o.id, e0); trim(errs);
    if (wantA) { const stopOld = a4Watch.get(o.id); if (stopOld) stopOld(); }   // dobara print — purane A4 ki khabar nahi
    await upd(o.id, { ...(opt.noTh ? {} : { 'pr.th': wantT ? 'printing' : 'off', ...(wantT && zm ? { 'pr.zm': 1 } : {}) }), ...(wantA ? { 'pr.a4': 'printing' } : {}), perr: perrOf(o.id) });
    const t0 = Date.now();
    const [rt, ra] = await Promise.all([
      wantT ? (zm ? zoomThermal(o, jpg, { rp: opt.rp }) : printThermal(o, P, img, { ...opt, jpg })).then(() => 'done', e => { e0.te = String((e && e.message) || e).slice(0, 140); return 'failed'; }) : 'off',
      wantA ? printA4(o, P, { ...opt, jpg }).then(aids => ({ st: 'sent', aids }), e => { e0.ae = String((e && e.message) || e).slice(0, 140); return { st: 'failed' }; }) : { st: 'off' }
    ]);
    const n = Number(o.pr && o.pr.n) || 0;
    if (o.pr) o.pr.n = n + 1;
    await upd(o.id, { ...(opt.noTh ? {} : { 'pr.th': rt }), ...(wantA ? { 'pr.a4': ra.st } : {}), 'pr.at': Date.now(), 'pr.n': n + 1, ...(ra.aids ? { 'pr.a4j': ra.aids } : {}), perr: perrOf(o.id) });
    if (ra.aids) watchA4(o.id, ra.aids);   // 'sent' likhne ke BAAD (warna tez A4 ka 'done' pehle likha jata aur 'sent' us ko mita deta)
    log(`🧾 #${shortNo(o.id)} thermal ${opt.noTh ? '(pehle hi)' : rt + (zm && wantT ? ' (zoom)' : '')}${e0.te ? ' (' + e0.te + ')' : ''} · A4 ${ra.st}${e0.ae ? ' (' + e0.ae + ')' : ''} · ${Date.now() - t0} ms`);
  }

  // ---------- 🔄 ek order ka poora kaam (queue — ek waqt ek) ----------
  const live = new Map();   // id → order (jab tak queue mein — contact card naam / number yahin jore)
  async function readOrder(o, g) {   // → { res } ya throw
    if (g && g.gem) return (await geminiRead({ key: AI.key, model: AI.model, b64: g.gem.toString('base64'), mime: g.gm, gloss: GLOSS, ms: 75000 })).res;   // v1.4: sochne ka waqt
    const txt = String(o.txt || '').trim(); if (!txt) throw Error('na tasveer na likhai');
    try { return (await geminiRead({ key: AI.key, model: AI.model, text: txt, gloss: GLOSS })).res; }
    catch (e) { log(`🤖 likhi list AI se nahi parhi (${String(e.message).slice(0, 80)}) — bina AI`); return localTextLines(txt); }
  }
  async function processOrder(o, buf, mime, g0, prev, a4n) {
    live.set(o.id, o); const t0 = Date.now();
    try {
      const g = g0 || (buf ? await prepImage(buf, mime) : null);
      if (a4n && g && g.jpg) a4Send(g.jpg, a4n > 0 ? a4n : S.a4c, { t: 'WA ' + (o.src === 'app' ? 'App parchi' : phPretty(o.from)) + ' #' + shortNo(o.id) }, o).catch(() => {});   // v2.0: "print" wali — AI ka intezar nahi
      else if (a4n) upd(o.id, { 'pr.a4': 'failed', perr: 'A4: tasveer nahi bani' }).catch(() => {});
      // v1.9: APP ki parchi (larke ne khud photo li — order hi hai) = thermal FORAN, AI ke saath saath (AI sirf app ke bill items ke liye)
      const zNow = o.src === 'app' && S.th !== false && S.zm && g && g.jpg ? zoomNow(o, g.jpg).catch(e => { log('🔎 ' + (e && e.message)); return 'failed'; }) : null;
      if (g && g.jpg && !o.th) { const th = await thumbOf(g.jpg); if (th) { o.th = th; await upd(o.id, { th }); } }
      let R;
      try { R = await readOrder(o, g); }
      catch (e) {
        const why = String(e.message || e).slice(0, 160);
        await upd(o.id, { st: 'fail', err: why, n: 0, u: 0 });
        log(`✕ #${shortNo(o.id)} AI nahi parh saka: ${why}`);
        if (zNow) await zNow;
        if (g && g.jpg) await printOrder(o, [], g.jpg, { fail: why, noTh: !!zNow });   // tasveer hi chhaap do — larke dekh kar nikal lein (thermal = likhai ka zoom)
        return;
      }
      if (!R.isOrder) {
        if (zNow) await zNow;
        await upd(o.id, { st: 'skip', err: a4n ? 'Order ki parchi nahi — sirf A4 print' : 'Yeh order ki parchi nahi lagti', n: 0, u: 0, ...(zNow ? {} : { 'pr.th': 'off' }) });
        log(`⏭ #${shortNo(o.id)} order nahi (${o.txt ? 'likhai' : 'tasveer'})`);
        if (o.src === 'wa') { const r = recent.get(o.from); if (r && r.id === o.id) { if (prev) recent.set(o.from, prev); else recent.delete(o.from); } }   // yeh "order" nahi tha — pichhla order hi taza
        if (o.txt && !g && prev) await nameToRecent(o, prev);
        return;
      }
      if (!o.ph && R.phone) o.ph = R.phone;
      if (!o.nm && R.name) o.nm = R.name;
      let X = null, Dh = null; try { [X, Dh] = await Promise.all([index(), dh()]); } catch (e) { log('⚠️ milan: ' + e.message); }
      const j = matchLines(R.lines, X, Dh ? Dh.smartFind : null, Dh ? Dh.k2 : null, RACKS, Dh), u = j.filter(isUnclear).length;
      o.j = JSON.stringify(j); o.st = 'ok';
      await upd(o.id, { st: 'ok', err: '', j: o.j, n: j.length, u, ph: o.ph || '', nm: o.nm || '', ...(zNow ? {} : { 'pr.th': S.th !== false ? 'wait' : 'off' }) });
      log(`✅ #${shortNo(o.id)} ${j.length} items (❓ ${u}) · ${o.nm || '-'} ${o.ph || ''} · ${Date.now() - t0} ms`);
      if (zNow) await zNow;   // thermal pehle hi (ya chal raha) — A4 us ke baad (pr.th ka haal na mite)
      await printOrder(o, j, g && g.jpg, { noTh: !!zNow });
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
  async function imgPrint(id, rq) {   // v1.7: 🖼 parchi jaisi (bina AI) — app ka ⋮ chip (prImg) · v1.9: har line alag zoom (zoomThermal)
    const s = await ORD.doc(id).get(); if (!s.exists) return; const o = { id, ...s.data() };
    await upd(id, { 'pr.im': rq });
    let jpg = null; try { const im = await IMG.doc(id).get(); const u = im.exists ? String(im.data().img || '') : '', m = u.match(/^data:image\/jpe?g;base64,(.+)$/i); if (m) jpg = Buffer.from(m[1], 'base64'); } catch {}
    if (!jpg) { await upd(id, { perr: '🖼 Parchi jaisi print nahi — is parchi ki tasveer nahi (likhi hui WhatsApp parchi?)' }); return; }
    try { await zoomThermal(o, jpg, { rp: Number(o.pr && o.pr.n) || 0 }); }
    catch (e) { await upd(id, { perr: '🖼 Parchi jaisi print: ' + String(e.message || e).slice(0, 120) }); throw e; }
  }
  const Q = [], inQ = new Set(); let qBusy = false;
  const runJob = ZINDA.guard(async job => {
    if (job.kind === 'new') await processOrder(job.o, job.buf, job.mime, job.g, job.prev, job.a4n);
    else if (job.kind === 're') await reprint(job.id, job.rq);
    else if (job.kind === 'img') await imgPrint(job.id, job.rq);   // v1.7
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
  async function createWa({ from, cap, txt, buf, mime, wid, mt, fail, a4n }) {
    const id = newId('w'), now = Date.now(), c = parseCaption(cap);
    const pc = pend.get(from); if (pc && now - pc.at < LINK_WIN) { if (!c.ph && pc.ph) c.ph = pc.ph; if (!c.nm && pc.nm) c.nm = pc.nm; pend.delete(from); }
    const o = { id, src: 'wa', at: now, day: dayOf(now), from, ph: c.ph, nm: c.nm, cap: String(cap || '').slice(0, 300), th: '', txt: String(txt || '').slice(0, 4000), st: fail ? 'fail' : 'read', j: '', n: 0, u: 0,
      pr: { th: fail ? 'off' : 'wait', a4: !fail && a4n ? 'printing' : 'off', at: 0, n: 0 }, perr: '', err: fail ? String(fail).slice(0, 160) : '', upAt: now, wid: String(wid || ''), mt: Number(mt) || 0 };
    let g = null;
    if (buf) { try { g = await prepImage(buf, mime); } catch (e) { log('⚠️ tasveer: ' + e.message); } }
    const b = db.batch(); b.set(ORD.doc(id), o); if (g && g.full) b.set(IMG.doc(id), { img: g.full, at: now }); await b.commit();
    const prev = recent.get(from);
    if (!fail) recent.set(from, { id, at: now, ph: o.ph, nm: o.nm });
    log(`📥 #${shortNo(id)} ${buf ? 'tasveer' : fail ? 'ghalti' : 'likhi list'} — ${phPretty(from)}${o.nm ? ' · ' + o.nm : ''}${o.ph ? ' · ' + o.ph : ''}${buf && !(g && g.full) ? ' (tasveer bari — poori save nahi)' : ''}${fail ? ' — ' + fail : ''}`);
    if (!fail) enqueue({ kind: 'new', o, buf, mime, g, prev, a4n });
    return o;
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
        const a4First = S.a4m === 'all' && !d.pcAt && (d.src || 'app') === 'app';   // v2.0: 'Har parchi' = sirf nayi app parchi (Dobara parho par dobara A4 nahi)
        tx.update(ref, { st: 'read', err: '', pcAt: Date.now(), upAt: Date.now(), 'pr.th': 'wait', ...(a4First ? { 'pr.a4': 'printing' } : !d.pcAt ? { 'pr.a4': 'off' } : {}) });
        return { id, ...d };
      });
      if (!o) return;
      o.src = o.src || 'app'; o.from = o.from || 'app'; o.at = Number(o.at) || Date.now(); o.day = o.day || dayOf(o.at); o.pr = o.pr || {};
      if (!o.ph || !o.nm) { const c = parseCaption(o.cap); if (!o.ph) o.ph = c.ph; if (!o.nm && !o.txt) o.nm = c.nm; }
      let buf = null; try { const im = await IMG.doc(id).get(); const u = im.exists ? String(im.data().img || '') : '', m = u.match(/^data:image\/[a-z]+;base64,(.+)$/i); if (m) buf = Buffer.from(m[1], 'base64'); } catch {}
      if (!buf && !String(o.txt || '').trim()) { await upd(id, { st: 'fail', err: 'tasveer / likhai nahi mili' }); return; }
      log(`📥 #${shortNo(id)} app se (${o.byName || o.by || '-'})`);
      enqueue({ kind: 'new', o, buf, mime: 'image/jpeg', a4n: S.a4m === 'all' && buf && !o.pcAt && (o.src || 'app') === 'app' ? S.a4c : 0 });
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
  ORD.orderBy('prImg', 'desc').limit(20).onSnapshot(s => {   // v1.7: 🖼 parchi jaisi (bina AI)
    for (const d of s.docs) {
      const x = d.data() || {}, rq = Number(x.prImg) || 0, done = Number(x.pr && x.pr.im) || 0, key = 'img:' + d.id + ':' + rq;
      if (!rq || rq === done || rqBusy.has(key)) continue; rqBusy.add(key);
      const age = Date.now() - (d.updateTime ? d.updateTime.toMillis() : 0);
      if (age > OLD_RQ) { upd(d.id, { 'pr.im': rq, perr: '🖼 darkhwast purani (30 min+) — phir dabayein' }); continue; }
      enqueue({ kind: 'img', id: d.id, rq });
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
    setLink({ st: 'off', qr: '', me: '', out: c === 'logout' ? Date.now() : 0, err: c === 'logout' ? '' : 'Naya QR ban raha hai…' });   // v2.3: out = malik ne khud alag kiya
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
  async function chatPh(m, s) {   // v2.0: apne bheje paigham ki CHAT kis number ki (Mubeen / apni "Message yourself")
    const k = m.key || {};
    for (const j of [k.remoteJidAlt, k.remoteJid]) if (j && /@s\.whatsapp\.net$/.test(j)) return normPh(j);
    for (const j of [k.remoteJid, k.remoteJidAlt]) if (j && /@lid$/.test(j)) { try { const pn = await s.signalRepository.lidMapping.getPNForLID(j); if (pn) return normPh(pn); } catch {} }
    return '';
  }
  // v2.0 / v2.1: 🖨 malik APNE number se (PC isi number par juda) Mubeen ki chat (ya apni chat) mein tasveer bheje + "print" — tasveer ke caption mein YA
  // alag likha paigham "Print" (v2.1, malik 5 Nov: album forward kar ke neeche "Print" likha tha — chhapa nahi). Baqi apne paigham kabhi nahi chhoote.
  const selfImgs = new Map(), selfPend = new Map(), inImgs = new Map(), inPend = new Map(), WIN = 10 * 60000, PEND = 2 * 60000;
  const prNote = t => { log('🖨 ' + t); try { setLink({ pr: { at: Date.now(), t: String(t).slice(0, 140) } }); } catch {} };   // app ⚙️ mein "aakhri print" (khamosh nahi)
  const pnJid = pn => '92' + String(pn).slice(1) + '@s.whatsapp.net', bare = j => String(j || '').split('@')[0].split(':')[0];
  async function okChat(m, s) {   // → { ok, to, me }
    const jid = m.key.remoteJid || '', me = normPh(L.me || ''), to = await chatPh(m, s);
    if (to) return { ok: to === me || S.prTo.includes(to), to, me };
    if (/@lid$/.test(jid) && s.user && s.user.lid && bare(s.user.lid) === bare(jid)) return { ok: true, to: me, me };   // v2.2: apni chat (LID)
    if (/@lid$/.test(jid)) for (const pn of [me, ...S.prTo].filter(Boolean)) { try { const lid = await s.signalRepository.lidMapping.getLIDForPN(pnJid(pn)); if (lid && bare(lid) === bare(jid)) return { ok: true, to: pn, me }; } catch {} }
    return { ok: false, to: '', me };
  }
  const CX1 = { k: 'a', ok: (m, s) => okChat(m, s), note: t => prNote(t), who: (to, me) => to === me ? 'apni chat' : phPretty(to), tag: 'Apna print' };
  async function printSelf(list, n, to, me, cx = CX1) {
    let ok = 0, pdf = 0, bad = '';
    for (const x of list) {
      if (x.pdf) { pdf++; continue; }
      if (Number(x.im.fileLength) > 15 * 1024 * 1024) { bad = 'tasveer 15 MB se bari'; continue; }
      try {
        const buf = await within(B.downloadMediaMessage(x.m, 'buffer', {}), 60000, 'tasveer download'), g = await prepImage(buf, String(x.im.mimetype || 'image/jpeg'));
        await a4Send(g && g.jpg, n > 0 ? n : S.a4c, { t: cx.tag + ' → ' + cx.who(to, me) + (stripPrint(x.cap) ? ' · ' + stripPrint(x.cap) : '') }, null); ok++;
      } catch (e) { bad = String((e && e.message) || e).slice(0, 80); }
    }
    cx.note(`${ok ? '✅ ' + ok + ' tasveer A4 ko gayi' + ((n > 0 ? n : S.a4c) > 1 ? ' (' + (n > 0 ? n : S.a4c) + ' copy)' : '') : '✕ kuch nahi chhapa'}${pdf ? ' · PDF ' + pdf + ' abhi nahi chhapti' : ''}${bad ? ' · ' + bad : ''} — ${cx.who(to, me)}`);
  }
  async function selfPrint(m, s, cx = CX1) {
    const jid = m.key.remoteJid || '', wid = m.key.id || '', jk = cx.k + ':' + jid;
    if (!jid || !wid || seenSet.has(wid) || B.isJidGroup(jid) || B.isJidBroadcast(jid) || B.isJidNewsletter(jid)) return;
    const c = B.normalizeMessageContent(m.message) || {}, dm = c.documentMessage || null;
    const im = c.imageMessage || (dm && /^image\//i.test(String(dm.mimetype || '')) ? dm : null), pdf = dm && /pdf/i.test(String(dm.mimetype || '')) ? dm : null;
    const txt = String(c.conversation || (c.extendedTextMessage && c.extendedTextMessage.text) || '').trim();
    const cap = (im || pdf || {}).caption || '', cn = printReq(cap), tn = !im && !pdf && txt && txt.length <= 25 ? printReq(txt) : 0;
    if (!im && !pdf && !tn) return;   // aam baat-cheet — kabhi nahi
    const ts = tsOf(m) || Date.now();
    if (Date.now() - ts > OLD_RQ) { if (cn || tn) markSeen(wid); return; }   // purana (PC band tha) = khud nahi chhapta
    await settingsReady;
    const C2 = await cx.ok(m, s);
    if (!C2.ok) { if ((cn || tn) && !cx.quiet) { markSeen(wid); cx.note(`"print" ${C2.to ? phPretty(C2.to) : 'is'} chat ka nahi chhapta (app ⚙️ "Apne number se" list mein nahi)`); } return; }   // v2.2: doosra phone = doosri chats bilkul chup
    if (!S.on || S.a4m === 'off') { if (cn || tn) { markSeen(wid); cx.note('"print" aaya magar A4 / WhatsApp parchi BAND hai (app ⚙️)'); } return; }
    markSeen(wid);
    if (im || pdf) {
      const pend = selfPend.get(jk), n = cn || (pend && ts <= pend.until ? pend.n : 0);
      if (n) { await printSelf([{ m, im, pdf, cap }], n, C2.to, C2.me, cx); return; }
      const keep = (selfImgs.get(jk) || []).filter(x => ts - x.ts < WIN); keep.push({ m, im, pdf, cap, ts }); selfImgs.set(jk, keep.slice(-12));   // "print" baad mein aaye to
      return;
    }
    const list = (selfImgs.get(jk) || []).filter(x => ts - x.ts < WIN); selfImgs.delete(jk);
    if (!list.length) { selfPend.set(jk, { n: tn, until: ts + PEND }); cx.note('"print" mila — 2 min ke andar tasveer bhejein to chhap jayegi'); return; }
    await printSelf(list, tn, C2.to, C2.me, cx);
  }
  // aane wali (ijazat wale number) parchi par alag likha "print" — us ki pichhli 10 min ki tasveerein A4
  async function printIncoming(from, n, ts) {
    const list = (inImgs.get(from) || []).filter(x => ts - x.ts < WIN); inImgs.delete(from);
    if (!list.length) { inPend.set(from, { n, until: ts + PEND }); prNote(`"print" mila (${phPretty(from)}) — 2 min mein tasveer aaye to chhapegi`); return; }
    let ok = 0;
    for (const x of list) {
      try { const im = await IMG.doc(x.id).get(), u = im.exists ? String(im.data().img || '') : '', mm = u.match(/^data:image\/jpe?g;base64,(.+)$/i); if (!mm) continue; await a4Send(Buffer.from(mm[1], 'base64'), n > 0 ? n : S.a4c, { t: 'WA ' + phPretty(from) + ' #' + shortNo(x.id) }, { id: x.id }); ok++; } catch {}
    }
    prNote(`${ok ? '✅ ' + ok + ' tasveer A4 ko gayi' : '✕ tasveer nahi mili'} — ${phPretty(from)}`);
  }
  async function handleMsg(m, s) {
    if (!m || !m.key || !m.message) return;
    if (await mainExtra(m, s)) return;   // v2.5: malik ka reply-print + gahak tasveer+print (Mubeen jaisa)
    if (m.key.fromMe) { await selfPrint(m, s); return; }
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
      const tn = t.length <= 25 && S.a4m !== 'off' ? printReq(t) : 0;   // v2.1: alag likha "print" = pichhli tasveerein A4 (order nahi banta)
      if (tn) { markSeen(wid); if (!ts || Date.now() - ts <= OLD_RQ) await printIncoming(from, tn, ts || Date.now()); return; }
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
    const pq = printReq(im.caption), pend = inPend.get(from), pq2 = pq || (pend && (ts || Date.now()) <= pend.until ? pend.n : 0);
    const a4n = S.a4m === 'all' ? (pq2 || -1) : S.a4m === 'print' ? pq2 : 0;   // v2.0: "print" likha = A4 (caption se "print" hata kar gahak ka naam)
    const o = await createWa({ from, cap: pq ? stripPrint(im.caption) : im.caption || '', txt: '', buf, mime: String(im.mimetype || 'image/jpeg'), wid, mt: ts, a4n: ts && Date.now() - ts > OLD_RQ ? 0 : a4n });
    if (o && !a4n) { const t0 = ts || Date.now(), keep = (inImgs.get(from) || []).filter(x => t0 - x.ts < WIN); keep.push({ id: o.id, ts: t0 }); inImgs.set(from, keep.slice(-12)); }   // v2.1: "print" baad mein aaye to
  }

  // ---------- 🖨 v2.2: PRINT WALA DOOSRA PHONE (Mubeen ki APNI chat) — alag linked device, sirf apne bheje + apni chat ----------
  const LINK2 = BA.doc('waLink2');
  let L2 = { st: 'off', qr: '', code: '', me: '', err: '', cmd: 0 }, lw2 = Promise.resolve(), lastLinkW2 = 0;
  try { const x = await LINK2.get(); if (x.exists) { const d = x.data() || {}; L2.cmd = Number(d.cmd) || 0; L2.me = String(d.me || ''); if (d.pr) L2.pr = d.pr; } } catch (e) { log('⚠️ waLink2: ' + e.message); }
  const setLink2 = p => { Object.assign(L2, p || {}); L2.at = Date.now(); L2.host = os.hostname(); L2.ver = VER; const snap = { ...L2 }; lastLinkW2 = Date.now(); lw2 = lw2.then(() => LINK2.set(snap)).catch(e => log('⚠️ waLink2 likha nahi: ' + e.message)); return lw2; };
  let sock2 = null, gen2 = 0, retry2 = 0, retryT2 = null, pair2 = '', pairAsked2 = false;   // pair2 = '92…' — QR ki jagah 8 harf ka code (malik ghar, Mubeen dukan par)
  const has2 = () => fs.existsSync(path.join(AUTH2_DIR, 'creds.json'));
  const wipe2 = () => { try { fs.rmSync(AUTH2_DIR, { recursive: true, force: true }); } catch (e) { log('⚠️ wa-auth-print nahi mita: ' + e.message); } };
  const end2 = () => { gen2++; clearTimeout(retryT2); const x = sock2; sock2 = null; try { x && x.end(undefined); } catch {} };
  const me2Of = s => normPh((s && s.user && s.user.id) || '') || normPh(L2.me || '');
  const CX2 = { k: 'b', quiet: true, tag: 'Print',
    note: t => { log('🖨² ' + t); try { setLink2({ pr: { at: Date.now(), t: String(t).slice(0, 140) } }); } catch {} },
    who: (to, me) => phPretty(me) + ' (apni chat)',
    ok: async (m, s) => {   // SIRF apni chat (Message yourself) — doosri har chat = nahi
      const jid = m.key.remoteJid || '', me = me2Of(s), to = await chatPh(m, s);
      if (to) return { ok: !!me && to === me, to, me };
      if (/@lid$/.test(jid)) {
        if (s.user && s.user.lid && bare(s.user.lid) === bare(jid)) return { ok: true, to: me, me };
        if (me) { try { const lid = await s.signalRepository.lidMapping.getLIDForPN(pnJid(me)); if (lid && bare(lid) === bare(jid)) return { ok: true, to: me, me }; } catch {} }
      }
      return { ok: false, to: '', me };
    } };
  const CX3 = { k: 'c', quiet: true, tag: 'Print',   // v2.3: print phone par AANE wale — sirf waParchi.prFrom (malik) ke, kisi aur ke kabhi nahi
    note: t => CX2.note(t), who: (to, me) => phPretty(to) + ' se → ' + (me ? phPretty(me) : 'print phone'),
    ok: async (m, s) => {
      const me = me2Of(s), jid = m.key.remoteJid || ''; let from = await senderPh(m, s);
      if (!from && /@lid$/.test(jid)) for (const pn of S.prFrom) { try { const lid = await s.signalRepository.lidMapping.getLIDForPN(pnJid(pn)); if (lid && bare(lid) === bare(jid)) { from = pn; break; } } catch {} }
      if (!from || !S.prFrom.includes(from)) return { ok: false, to: from, me };
      if (L.st === 'open' && normPh(L.me || '') === from && me && S.prTo.includes(me)) return { ok: false, to: from, me };   // malik ka apna link bhi chal raha — wohi chhapta hai (dohra nahi)
      return { ok: true, to: from, me };
    } };
  // v2.4: 🖨 GAHAK KI CHAT — sirf (1) tasveer ke SAATH "print" (caption) ya (2) REPLY "print". chatInfo = header ke liye 30 min yaad (dono WhatsApp — malik + Mubeen).
  const chatInfo = new Map();
  const phonesIn = t => [...new Set((UDIG(String(t || '')).match(/(?:\+?\s*92|0)\s*3\d{2}[\s-]*\d{3}[\s-]*\d{4}/g) || []).map(normPh).filter(isMob))];
  const ciOf = jid => {
    let c = chatInfo.get(jid); if (!c || Date.now() - c.at > 30 * 60000) { chatInfo.delete(jid); c = { nm: '', nums: [], card: null, at: 0 }; chatInfo.set(jid, c); }
    c.at = Date.now(); while (chatInfo.size > 300) chatInfo.delete(chatInfo.keys().next().value); return c;
  };
  function hdOf(pn, jid, cap) {   // A4 ke upar ki patti: Tel · naam · caption · card · likhe number
    const c = chatInfo.get(jid) || {}, parts = [], ct = stripPrint(cap).replace(/\s+/g, ' ').trim().slice(0, 50);
    if (pn) parts.push('Tel ' + phPretty(pn)); if (c.nm) parts.push(c.nm); if (ct) parts.push(ct);
    const have = new Set([pn, ...phonesIn(ct)]);
    if (c.card) { if (c.card.nm) parts.push('Card: ' + c.card.nm); if (c.card.ph && !have.has(c.card.ph)) { parts.push(phPretty(c.card.ph)); have.add(c.card.ph); } }
    for (const x of c.nums || []) if (!have.has(x)) { parts.push(phPretty(x)); have.add(x); }
    return parts.join(' · ').slice(0, 140);
  }
  const badJid = jid => !jid || B.isJidGroup(jid) || B.isJidBroadcast(jid) || B.isJidNewsletter(jid) || /^status@/.test(jid);   // group / status KABHI nahi
  const imgOf = c => c.imageMessage || (c.documentMessage && /^image\//i.test(String(c.documentMessage.mimetype || '')) ? c.documentMessage : null);
  function noteChat(m, c, jid, fromMe) {   // naam / likhe number / contact card — sirf memory
    const ci = ciOf(jid), txt = String(c.conversation || (c.extendedTextMessage && c.extendedTextMessage.text) || '');
    if (!fromMe && m.pushName) ci.nm = String(m.pushName).replace(/[|"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    const cards = c.contactMessage ? [c.contactMessage] : ((c.contactsArrayMessage && c.contactsArrayMessage.contacts) || []);
    if (cards.length) { const inf = vcardInfo(cards[0].vcard, cards[0].displayName); if (inf.ph || inf.nm) ci.card = inf; }
    if (txt) for (const x of phonesIn(txt)) if (!ci.nums.includes(x)) { ci.nums.push(x); if (ci.nums.length > 4) ci.nums.shift(); }
  }
  function replyOf(c) {   // REPLY "print" kisi tasveer par → { ctx, qim, rn }
    const ctx = (c.extendedTextMessage && c.extendedTextMessage.contextInfo) || null, txt = String((c.extendedTextMessage && c.extendedTextMessage.text) || c.conversation || '').trim();
    if (!ctx || !ctx.quotedMessage || !txt || txt.length > 25) return null;
    const q = B.normalizeMessageContent(ctx.quotedMessage) || ctx.quotedMessage, qim = q && imgOf(q), rn = qim ? printReq(txt) : 0;
    return rn ? { ctx, qim, rn } : null;
  }
  function quotedMsg(jid, ctx, s) {
    const part = String(ctx.participant || ''), qFromMe = !part || [bare(s.user && s.user.id), bare(s.user && s.user.lid)].includes(bare(part));
    return { key: { remoteJid: jid, id: String(ctx.stanzaId || ''), fromMe: qFromMe, ...(part ? { participant: part } : {}) }, message: ctx.quotedMessage };
  }
  async function printOne(msg, im, n, pn, jid, cap, why, s, note) {
    if (Number(im.fileLength) > 15 * 1024 * 1024) { note('✕ tasveer 15 MB se bari — nahi chhapi'); return; }
    const hd = hdOf(pn, jid, cap), cp = n > 0 ? n : S.a4c;
    try {
      const buf = await within(B.downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: s && s.updateMediaMessage }), 60000, 'tasveer download');
      const g = await prepImage(buf, String(im.mimetype || 'image/jpeg'));
      await a4Send(g && g.jpg, cp, { t: (why === 'reply' ? 'Reply print' : 'Gahak print') + ' · ' + (pn ? phPretty(pn) : 'WhatsApp'), hd }, null);
      note(`✅ Parchi A4 ko gayi${cp > 1 ? ' (' + cp + ' copy)' : ''} — ${hd || 'WhatsApp'} · ${why === 'reply' ? 'reply' : 'gahak ne print likha'}`);
    } catch (e) { note('✕ parchi nahi chhapi: ' + String((e && e.message) || e).slice(0, 90)); }
  }
  async function ready(m, wid, note) {   // dohra nahi · 30 min purana nahi · band nahi → true = chhapo
    if (seenSet.has(wid)) return false; markSeen(wid);
    const ts = tsOf(m) || Date.now(); if (Date.now() - ts > OLD_RQ) return false;
    await settingsReady; if (!S.on || S.a4m === 'off') { note('"print" aaya magar A4 / WhatsApp parchi BAND hai (app ⚙️)'); return false; }
    return true;
  }
  // v2.5: 🖨 MALIK KA APNA WhatsApp — Mubeen jaisa (malik: "mera bhi same Mubeen wala"): malik ka REPLY "print" kisi bhi 1:1 chat ki tasveer par +
  // gahak (ijazat list ke ilawa) ki tasveer + caption "print" → A4 + patti. true = sambhal liya (purana raasta nahi).
  async function mainExtra(m, s) {
    const jid = m.key.remoteJid || '', wid = m.key.id || '';
    if (badJid(jid) || !wid) return false;
    const c = B.normalizeMessageContent(m.message) || {}, fromMe = !!m.key.fromMe;
    noteChat(m, c, jid, fromMe);
    if (fromMe) {
      const R = replyOf(c); if (!R) return false;   // aam apna paigham = purana selfPrint
      if (!(await ready(m, wid, prNote))) return true;
      const me = normPh(L.me || ''), p0 = await chatPh(m, s), pn = p0 && p0 !== me && !S.prTo.includes(p0) ? p0 : '';
      await printOne(quotedMsg(jid, R.ctx, s), R.qim, R.rn, pn, jid, R.qim.caption || '', 'reply', s, prNote);
      return true;
    }
    const im = imgOf(c), n = im ? printReq(im.caption || '') : 0; if (!n) return false;
    await settingsReady;
    const from = await senderPh(m, s);
    if (from && S.allow.includes(from)) return false;   // ijazat wale = purana (order + A4)
    if (!(await ready(m, wid, prNote))) return true;
    await printOne(m, im, n, (await chatPh(m, s)) || from, jid, im.caption || '', 'gahak', s, prNote);
    return true;
  }
  async function p2Msg(m, s) {
    const jid = m.key.remoteJid || '', wid = m.key.id || '';
    if (badJid(jid) || !wid) return;
    const c = B.normalizeMessageContent(m.message) || {}, fromMe = !!m.key.fromMe;
    noteChat(m, c, jid, fromMe);
    let from = '', isMalik = false, malikOk = false;
    if (!fromMe) { const r = await CX3.ok(m, s); from = r.to || ''; isMalik = !!from && S.prFrom.includes(from); malikOk = isMalik && r.ok; }   // malikOk false = malik ka apna link chhapta hai (dohra nahi)
    // (2) REPLY "print" — Mubeen ya malik (prFrom); gahak ka reply-print nahi
    const R = replyOf(c), mainOn = L.st === 'open' && !!from && normPh(L.me || '') === from;   // v2.5: malik ka apna link chale to malik ka reply-print WOHI chhapta hai (dohra nahi)
    if (R && (fromMe || (isMalik && !mainOn))) {
      if (!(await ready(m, wid, CX2.note))) return;
      const me = me2Of(s), pn = (await chatPh(m, s)) || from, pnC = pn && pn !== me ? pn : '';
      await printOne(quotedMsg(jid, R.ctx, s), R.qim, R.rn, pnC, jid, R.qim.caption || '', 'reply', s, CX2.note);
      return;
    }
    if (fromMe) { await selfPrint(m, s, CX2); return; }   // Mubeen ki apni chat (purana)
    if (isMalik) { await selfPrint(m, s, CX3); return; }   // malik → Mubeen (purana: caption / alag print)
    // (1) gahak: tasveer ke SAATH "print" — warna kuch nahi (download bhi nahi)
    const im = imgOf(c), n = im ? printReq(im.caption || '') : 0; if (!n) return;
    if (!(await ready(m, wid, CX2.note))) return;
    await printOne(m, im, n, (await chatPh(m, s)) || from, jid, im.caption || '', 'gahak', s, CX2.note);
  }
  async function connect2(why) {
    end2(); const my = gen2;
    fs.mkdirSync(AUTH2_DIR, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(AUTH2_DIR);
    if (!version) { try { const v = await within(B.fetchLatestBaileysVersion(), 10000, 'WA version'); if (v && Array.isArray(v.version)) version = v.version; } catch {} }
    if (my !== gen2) return;
    log(`🖨 print wala phone jor raha hai (${why || 'shuru'})${state.creds.registered ? '' : ' — QR banega'}`);
    const s = makeWASocket({ auth: state, logger, browser: B.Browsers.windows('Chrome'), markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: j => !!(B.isJidGroup(j) || B.isJidBroadcast(j) || B.isJidNewsletter(j)), generateHighQualityLinkPreview: false, connectTimeoutMs: 30000, getMessage: async () => undefined, ...(version ? { version } : {}) });
    sock2 = s;
    s.ev.on('creds.update', saveCreds);
    s.ev.on('connection.update', u => { if (my === gen2) onConn2(u, s, state).catch(e => log('⚠️ link2: ' + e.message)); });
    s.ev.on('messages.upsert', ev => { if (my !== gen2) return; for (const m of (ev && ev.messages) || []) if (m && m.key && m.message) msgQ = msgQ.then(() => p2Msg(m, s)).catch(e => log('⚠️ print phone: ' + (e && e.message))); });   // v2.4: p2Msg = apni chat · malik · gahak (caption) · reply
  }
  async function onConn2(u, s, state) {
    if (u.qr && pair2) {   // 🔢 code se jorna — QR nahi dikhana
      if (!pairAsked2) { pairAsked2 = true; try { const code = String(await within(s.requestPairingCode(pair2), 20000, 'pairing code') || '').toUpperCase(); setLink2({ st: 'code', qr: '', code: code.length === 8 ? code.slice(0, 4) + '-' + code.slice(4) : code, codeFor: '0' + pair2.slice(2), err: '' }); log('🔢 print phone ka code bana — ' + phPretty('0' + pair2.slice(2))); } catch (e) { pair2 = ''; setLink2({ st: 'error', qr: '', code: '', err: 'Code nahi bana: ' + String(e.message).slice(0, 80) + ' — QR se jorein' }); } }
    } else if (u.qr) { setLink2({ st: 'qr', qr: u.qr, code: '', err: '' }); log('🔳 print phone ka naya QR — app ⚙️ mein'); }
    if (u.connection === 'open') { retry2 = 0; pair2 = ''; L2.code = ''; const me = normPh((s.user && s.user.id) || ''); setLink2({ st: 'open', qr: '', me, err: '' }); log(`🟢 print wala phone jur gaya — ${phPretty(me)}`); }
    if (u.connection !== 'close') return;
    const code = Number(u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode) || 0, R = B.DisconnectReason;
    end2();
    if (code === R.loggedOut) { log('🔴 print phone ka link hat gaya (logout)'); wipe2(); setLink2({ st: 'off', qr: '', me: '', err: 'Link hat gaya — dobara jorna ho to 🔗 Jorein' }); return; }   // khud naya QR nahi (bina zaroorat)
    if (code === R.restartRequired) { connect2('jorne ke baad').catch(e => log('⚠️ ' + e.message)); return; }
    if (!state.creds.registered) { const wasCode = !!pair2; pair2 = ''; setLink2({ st: 'off', qr: '', code: '', err: (wasCode ? 'Code' : 'QR') + ' ka waqt khatam — dobara dabayein' }); return; }
    if (code === R.connectionReplaced) { setLink2({ st: 'error', qr: '', err: 'Yahi link kisi aur jagah bhi chal raha hai — 10 min baad dobara' }); retryT2 = setTimeout(() => connect2('replaced').catch(() => {}), 10 * 60000); return; }
    const wait = [2, 5, 10, 30, 60, 120, 300][Math.min(retry2++, 6)];
    setLink2({ st: 'closed', qr: '', err: `Rabta toota (${code || '?'}) — ${wait} sec mein dobara` }); log(`🟠 print phone rabta toota (${code || '?'}) — ${wait} sec`);
    retryT2 = setTimeout(() => connect2('dobara').catch(e => log('⚠️ ' + e.message)), wait * 1000);
  }
  async function doCmd2(c, ph) {
    log('🔗 app ka hukum (print phone): ' + c);
    if (c === 'link' && sock2 && L2.st === 'open') { setLink2({}); return; }
    if (c === 'code') {   // 🔢 naya link 8 harf ke code se (WhatsApp → Linked devices → "Link with phone number instead")
      if (!/^03\d{9}$/.test(ph || '')) { setLink2({ st: 'error', err: 'Number ghalat — 03xx-xxxxxxx' }); return; }
      if (sock2 && L2.st === 'open') { try { await within(sock2.logout(), 15000, 'logout'); } catch {} }
      end2(); wipe2(); pair2 = '92' + ph.slice(1); pairAsked2 = false;
      setLink2({ st: 'off', qr: '', code: '', me: '', err: 'Code ban raha hai…' });
      await connect2('app: code'); return;
    }
    pair2 = ''; pairAsked2 = false;
    if (c !== 'link' || !has2()) { if (sock2 && L2.st === 'open' && c !== 'link') { try { await within(sock2.logout(), 15000, 'logout'); } catch {} } end2(); if (c !== 'link') wipe2(); }
    setLink2({ st: 'off', qr: '', me: c === 'link' ? L2.me : '', err: c === 'logout' ? '' : 'Jor raha hai / naya QR…' });
    if (c === 'logout') return;
    await connect2('app: ' + c);
  }
  BA.doc('waCmd2').onSnapshot(x => {
    if (!x.exists) return; const d = x.data() || {}, at = Number(d.at) || 0, c = String(d.do || '');
    if (!at || at === L2.cmd || !/^(relink|logout|link|code)$/.test(c)) return;
    const age = Date.now() - (x.updateTime ? x.updateTime.toMillis() : at);
    L2.cmd = at; setLink2({});
    if (age > 10 * 60000) return;
    doCmd2(c, normPh(d.ph || '')).catch(e => { log('⚠️ hukum2: ' + e.message); setLink2({ st: 'error', err: String(e.message).slice(0, 140) }); });
  }, authErr);
  setInterval(() => { if ((has2() || L2.st !== 'off') && Date.now() - lastLinkW2 > 5 * 60000) setLink2({}); }, 60000);
  if (has2()) connect2('shuru').catch(e => log('⚠️ print phone: ' + e.message)); else setLink2({ st: 'off', qr: '', err: '' });

  // ---------- 🔗 app ke hukum (relink / logout) — ek dafa, sirf taza (server waqt) ----------
  BA.doc('waCmd').onSnapshot(s => {
    if (!s.exists) return; const d = s.data() || {}, at = Number(d.at) || 0, c = String(d.do || '');
    if (!at || at === L.cmd || !/^(relink|logout|link)$/.test(c)) return;
    const age = Date.now() - (s.updateTime ? s.updateTime.toMillis() : at);
    L.cmd = at;
    if (age > 10 * 60000) { setLink({}); return; }
    setLink({});
    if (c === 'link') L.out = 0;
    (c === 'link' && !(sock && L.st === 'open') ? connect('app: jorein') : c === 'link' ? Promise.resolve() : doCmd(c)).catch(e => { log('⚠️ hukum: ' + e.message); setLink({ st: 'error', err: String(e.message).slice(0, 140) }); });
  }, authErr);

  setInterval(() => { if (Date.now() - lastLinkW > 5 * 60000) setLink({}); }, 60000);   // app ko pata rahe PC zinda
  if (L.out && !fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) { setLink({ st: 'off', qr: '', me: '', err: '' }); log('⏸ malik ka WhatsApp PC se alag hai (Unlink) — jorna ho to app ⚙️ 🔄 Naya QR'); }   // v2.3
  else await connect('shuru');
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
