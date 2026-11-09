// =====================================================================================================
//  urdu-names.js  v1.8 (2026-11-09: 🚚 DELIVERY PATTI — malik: "POS bill ke upar delivery charges + delivery har gaon ke liye": printConfig.dlv (default ON) + dlvChg (khali = gaon ke hisaab se) → dlv() = 2 English + 2 bari Urdu lines, nt-print / sale-post ki sale rasid ke upar · bina AI) · v1.7 (2026-11-06: 🔤 ITEM ke Urdu naam KHUD — malik: "capri jumbo 3in1 ka Urdu nahi bana, larke ne nahi diya": fillItems = PC (transfer-sync) har 10 min jin items ka Urdu naam nahi un ka AI (Gemini) se, sirf NAYE (malik ka likha kabhi nahi badalta; map parhe baghair kabhi nahi likhta) · item(id, name) = parchi par Urdu naam, na ho to roman2ur bina AI (line kabhi gayab nahi) · gemAny: model band (404) ho to Google ki LIST se agla, pakka naam nahi) · v1.6 (2026-10-21: 🔤 Tafseel / Note / Wajah HAR parchi par Urdu — AI 4 s mein na aaye to roman2ur (lughat + harf-ba-harf, bina AI); AI pas-e-parda 20 s mein behtar likh kar yaad kare · note(text, px, lab) — 'تفصیل:' / 'نوٹ:' / 'وجہ:' Urdu label bara) · v1.5 (2026-10-20: 📅 dateUr / dateLine — Urdu tareekh (آج / کل کا بل / N دن پرانا) · 📝 note() + fillNotes() — Tafseel / Note / Wajah AI se Urdu, 4 s hadd, yaad (urdu-notes.json); printConfig.urduNote) · v1.4 (2026-10-16: line(ur, px, a) — a=1 beech mein, voucher ka bara Urdu naam) · v1.3 (2026-10-15: partyAny + fillParties force — 💰 galla parchi) · v1.2 (2026-10-14: fillParties — Server PC khud AI (Gemini, blueAccess/aiConfig) se baqi parties ke Urdu naam, har 10 min) · v1.1 (2026-10-14: + PARTY ke Urdu naam blueAccess/urduParties — voucher parchi) · v1.0 (2026-10-14) — 🔤 PARCHI PAR URDU NAAM (transfer note + gate pass)
//  Malik: "jitna bi gate pass or transfer notes print kar rahe hain un sb ko urdu bi sath ani chahie".
//  Naam wahi jo app mein (Stock → 🔤 Urdu naam / labels): Firestore blueAccess/urduNames {map: itemId -> Urdu} — LIVE (onSnapshot),
//  har print par Firestore nahi parhta (tez). Setting blueAccess/printConfig.urduSlip (default ON; app: 🖨 Print setting).
//  Text parchi mein Urdu line ek NISHAN ke saath: line(ur, px) -> toJob(text) us ko nt-parchi ki raster tasveer bana deta hai (daayein).
//  Jis item ka Urdu naam nahi = v1.7 se roman2ur (bina AI) Urdu — aur PC baad mein AI se asal naam bana kar yaad karta hai.
//  Istemal: transfer-sync.js (STOCK TRANSFER NOTE) · sale-post.js + nt-print.js (GATE PASS).
// =====================================================================================================
const MARK = '\u0001UR\u0001';
const NOTE = '\u0001UN\u0001';   // v1.5: Tafseel ki jagah — print se pehle fillNotes() isay Urdu tasveer (ya kuch nahi) bana deta hai
let map = {}, pmap = {}, on = true, started = false, noteOn = true, aiKey = '', aiModel = '', mapReady = false;   // v1.7: mapReady = urduNames parh liya (us se pehle item naam KABHI nahi likhte)

function watch(db, businessId, log = () => {}) {
  if (started || !db) return; started = true;
  const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
  try { ba.doc('urduNames').onSnapshot(s => { map = (s.exists && (s.data() || {}).map) || {}; mapReady = true; }, e => { mapReady = false; log('Urdu naam nahi mile: ' + e.message); }); } catch (e) { log('Urdu naam nahi mile: ' + e.message); }
  try { ba.doc('urduParties').onSnapshot(s => { pmap = (s.exists && (s.data() || {}).map) || {}; }, () => {}); } catch {}   // v1.1
  try { ba.doc('printConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; on = d.urduSlip !== false; noteOn = d.urduNote !== false; dlvCfg = { on: d.dlv !== false, chg: String(d.dlvChg == null ? '' : d.dlvChg).replace(/[\u0001\r\n]+/g, ' ').trim().slice(0, 40) }; }, () => {}); } catch {}   // v1.8: 🚚 dlv / dlvChg   // v1.5: urduNote
  try { ba.doc('aiConfig').onSnapshot(s => { const d = (s.exists && s.data()) || {}; aiKey = String(d.key || ''); aiModel = String(d.model || ''); }, () => {}); } catch {}   // v1.5: Tafseel Urdu ke liye
}
const get = id => (on && id != null ? String(map[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');
const party = id => (on && id ? String(pmap[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');   // v1.1
const isOn = () => on;
const partyAny = id => (id ? String(pmap[String(id)] || '').replace(/[\u0001\r\n]+/g, ' ').trim() : '');   // v1.3: galla parchi — urduSlip band ho tab bhi
const line = (ur, px = 32, a) => MARK + String(ur).replace(/[\u0001\r\n]+/g, ' ') + '\u0001' + (Number(px) || 32) + (a === 1 || a === 0 ? '\u0001' + a : '');   // v1.4: a = 1 beech mein (bara naam)
const has = t => String(t || '').includes(MARK);
const strip = t => String(t || '').split('\r\n').filter(l => !l.startsWith(MARK) && !l.startsWith(NOTE)).join('\r\n');   // tasveer na ban sake to bina Urdu (v1.5: NOTE bhi)

// ---------- v1.5 (2026-10-20): 📅 URDU TAREEKH — malik: "har parchi ke upar bara aaj / kal ka narration bhi Urdu mein" ----------
const UD = n => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const UMON = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const toDay = v => { if (v == null || v === '') return null; const d = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(v + 'T00:00:00') : new Date(v); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
function dateUr(date, now = new Date()) {   // -> { d: '۲۰ اکتوبر ۲۰۲۶', k: 'aaj'|'kal'|'old'|'aage', n, t: poori line }
  const d = toDay(date) || toDay(now), t0 = toDay(now), n = Math.round((t0 - d) / 864e5), ds = UD(d.getDate()) + ' ' + UMON[d.getMonth()] + ' ' + UD(d.getFullYear());
  if (n === 0) return { d: ds, k: 'aaj', n, t: 'آج — ' + ds };
  if (n === 1) return { d: ds, k: 'kal', n, t: 'کل کا بل — ' + ds };
  if (n > 1) return { d: ds, k: 'old', n, t: UD(n) + ' دن پرانا — ' + ds };
  return { d: ds, k: 'aage', n, t: 'آگے کی تاریخ — ' + ds };
}
const dateLine = (date, px = 56, now) => { if (!on) return ''; const u = dateUr(date, now); return line(u.t, u.k === 'aaj' ? px : Math.round(px * 0.86), 1); };   // khali = Urdu band · lambi line (kal / purana) thori chhoti

// ---------- v1.5: 📝 TAFSEEL / NOTE / WAJAH URDU MEIN (AI) — malik: "all prints ki narration Urdu mein bari bari" ----------
//   Parchi banate waqt note(text) sirf NISHAN rakhta hai; print se pehle `text = await fillNotes(text)`: AI (Gemini, wahi key/model jo app mein)
//   4 second hadd — na aaye to line hata do (parchi English Tafseel ke saath, kabhi na ruke). Bani Urdu urdu-notes.json mein yaad (dobara AI nahi).
//   Tarjuma NAHI — wahi lafz Urdu harfon mein (naam jaisa). Hindse / TXN / bill number waise hi.
const note = (text, px = 50, lab = '') => { const t = String(text || '').replace(/[\u0001\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); return t && /[a-z]/i.test(t) ? NOTE + t.slice(0, 160) + '\u0001' + (Number(px) || 50) + (lab ? '\u0001' + String(lab).replace(/[\u0001\r\n]+/g, ' ').slice(0, 20) : '') : ''; };   // v1.6: lab = Urdu label (تفصیل)
const fs = require('fs'), path = require('path'), NFILE = path.join(__dirname, 'urdu-notes.json');
let nmap = null; const nload = () => { if (nmap) return nmap; try { nmap = JSON.parse(fs.readFileSync(NFILE, 'utf8')) || {}; } catch { nmap = {}; } return nmap; };
const nkey = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim();
function nsave() { try { const k = Object.keys(nmap); if (k.length > 3000) for (const x of k.slice(0, k.length - 3000)) delete nmap[x]; fs.writeFileSync(NFILE, JSON.stringify(nmap)); } catch {} }
let noteWaitTill = 0;
// ---------- v1.6 (2026-10-21): 🔤 ROMAN → URDU BINA AI — malik: "Tafseel ka lafz Urdu mein bara, HAR print par" ----------
//   AI na ho / 4 s mein na aaye / ruka ho → aam alfaaz ki lughat, warna harf-ba-harf (chhota zer / zabar Urdu mein nahi likhte; aakhri
//   hissa ka 'a' lamba = ا — dukan → دکان, arman → ارمان). Hindse / nishan waise hi. Yeh yaad (urdu-notes.json) mein NAHI jata — AI ka hi.
const RDICT = { ka: 'کا', ki: 'کی', ke: 'کے', ko: 'کو', se: 'سے', ne: 'نے', mein: 'میں', main: 'میں', me: 'میں', aur: 'اور', or: 'اور', ya: 'یا', par: 'پر', pe: 'پے', tak: 'تک', bhi: 'بھی', hai: 'ہے', hain: 'ہیں', tha: 'تھا', nahi: 'نہیں', nai: 'نہیں', na: 'نہ',
  wala: 'والا', wali: 'والی', wale: 'والے', walal: 'والا', diya: 'دیا', diye: 'دیئے', di: 'دی', liya: 'لیا', liye: 'لیے', li: 'لی', gaya: 'گیا', gaye: 'گئے', aya: 'آیا', aaya: 'آیا', aaye: 'آئے', aye: 'آئے', de: 'دے', le: 'لے', do: 'دو', lo: 'لو', dena: 'دینا', lena: 'لینا', mila: 'ملا', mile: 'ملے',
  kharcha: 'خرچہ', kharche: 'خرچے', kharchay: 'خرچے', dukan: 'دکان', dukaan: 'دکان', godam: 'گودام', maal: 'مال', mal: 'مال', saman: 'سامان', samaan: 'سامان', chai: 'چائے', pani: 'پانی', paani: 'پانی', doodh: 'دودھ', dudh: 'دودھ', roti: 'روٹی', khana: 'کھانا', naan: 'نان', nan: 'نان', sabzi: 'سبزی', gosht: 'گوشت', murgi: 'مرغی', anday: 'انڈے', ande: 'انڈے', cheeni: 'چینی', chini: 'چینی', ghee: 'گھی', tail: 'تیل', oil: 'آئل', sabun: 'صابن', bijli: 'بجلی', bill: 'بل', kiraya: 'کرایہ', kiraaya: 'کرایہ', petrol: 'پیٹرول', diesel: 'ڈیزل', gari: 'گاڑی', gaari: 'گاڑی', gaadi: 'گاڑی', rickshaw: 'رکشہ', riksha: 'رکشہ', bike: 'بائیک', car: 'کار', loader: 'لوڈر', mazdoori: 'مزدوری', mazdori: 'مزدوری', majdoori: 'مزدوری', safai: 'صفائی', tankhwah: 'تنخواہ', tankha: 'تنخواہ', salary: 'سیلری', advance: 'ایڈوانس', cash: 'کیش', bank: 'بینک', hbl: 'ایچ بی ایل', jazzcash: 'جاز کیش', easypaisa: 'ایزی پیسہ', raast: 'راست', sale: 'سیل', purchase: 'پرچیز', wasooli: 'وصولی', wasoli: 'وصولی', wapas: 'واپس', wapis: 'واپس', udhar: 'ادھار', udhaar: 'ادھار', baqi: 'باقی', baaqi: 'باقی', paise: 'پیسے', paisay: 'پیسے', rupay: 'روپے', rupee: 'روپے', rs: 'روپے',
  larka: 'لڑکا', larke: 'لڑکے', larkay: 'لڑکے', sahib: 'صاحب', sahab: 'صاحب', bhai: 'بھائی', haji: 'حاجی', malik: 'مالک', chacha: 'چاچا', chachu: 'چاچو', ustad: 'استاد', mistri: 'مستری', driver: 'ڈرائیور', mobile: 'موبائل', load: 'لوڈ', card: 'کارڈ', repair: 'ریپیئر', paint: 'پینٹ', tala: 'تالا', chabi: 'چابی', shopper: 'شاپر', shoppers: 'شاپر', bag: 'بیگ', thaila: 'تھیلا', register: 'رجسٹر', printer: 'پرنٹر', roll: 'رول', tape: 'ٹیپ', gate: 'گیٹ', pass: 'پاس', transfer: 'ٹرانسفر', note: 'نوٹ', wajah: 'وجہ', ghalti: 'غلطی', galti: 'غلطی', kam: 'کم', zyada: 'زیادہ', ziada: 'زیادہ', poora: 'پورا', pura: 'پورا', aadha: 'آدھا', adha: 'آدھا', aaj: 'آج', aj: 'آج', kal: 'کل', subah: 'صبح', sham: 'شام', raat: 'رات', din: 'دن', hafta: 'ہفتہ', mahina: 'مہینہ', for: 'فار', of: 'آف', and: 'اینڈ', the: 'دی', default: 'ڈیفالٹ', akhrajat: 'اخراجات', karyana: 'کریانہ', store: 'اسٹور', traders: 'ٹریڈرز', trader: 'ٹریڈر', noor: 'نور', khata: 'کھاتہ', parchi: 'پرچی', counter: 'کاؤنٹر', factory: 'فیکٹری', packing: 'پیکنگ', packet: 'پیکٹ', carton: 'کارٹن', ctn: 'کارٹن', pcs: 'پیس', kg: 'کلو', kilo: 'کلو', gm: 'گرام', gram: 'گرام', liter: 'لیٹر', litre: 'لیٹر',
  muhammad: 'محمد', mohammad: 'محمد', muhammed: 'محمد', ahmad: 'احمد', ahmed: 'احمد', ali: 'علی', hassan: 'حسن', hasan: 'حسن', hussain: 'حسین', husain: 'حسین', haseeb: 'حسیب', saim: 'صائم', arman: 'ارمان', bilal: 'بلال', zeeshan: 'ذیشان', usman: 'عثمان', umar: 'عمر', umer: 'عمر', imran: 'عمران', waleed: 'ولید', asif: 'آصف', kashif: 'کاشف', adnan: 'عدنان', faisal: 'فیصل', abdullah: 'عبداللہ', abdul: 'عبد', rehman: 'رحمان', rahman: 'رحمان', samiullah: 'سمیع اللہ', sami: 'سمیع', zahid: 'زاہد', shahid: 'شاہد', khalid: 'خالد', tariq: 'طارق', nadeem: 'ندیم', naveed: 'نوید', javed: 'جاوید', jamil: 'جمیل', hamza: 'حمزہ', haider: 'حیدر', farhan: 'فرحان', rizwan: 'رضوان', irfan: 'عرفان', salman: 'سلمان', sajid: 'ساجد', majid: 'ماجد', raza: 'رضا', yasir: 'یاسر', qasim: 'قاسم', aslam: 'اسلم', akram: 'اکرم', azam: 'اعظم', anwar: 'انور', gillu: 'گلو', sonu: 'سونو', shan: 'شان', ashfaq: 'اشفاق', akhtar: 'اختر', iqbal: 'اقبال', rafiq: 'رفیق', shafiq: 'شفیق', zubair: 'زبیر', ijaz: 'اعجاز', ejaz: 'اعجاز', mushtaq: 'مشتاق', ishaq: 'اسحاق', ishfaq: 'اشفاق', kamran: 'کامران', nouman: 'نعمان', noman: 'نعمان', sohail: 'سہیل', faheem: 'فہیم', rafay: 'رافع', machine: 'مشین', tea: 'ٹی', bundle: 'بنڈل', cement: 'سیمنٹ', wire: 'وائر', light: 'لائٹ', bulb: 'بلب', fan: 'فین', water: 'واٹر', cooler: 'کولر', glass: 'گلاس', cup: 'کپ', plate: 'پلیٹ', box: 'باکس', dabba: 'ڈبہ', bori: 'بوری', katta: 'کٹا', kattay: 'کٹے', rassi: 'رسی', gas: 'گیس', cylinder: 'سلنڈر', labour: 'لیبر', labor: 'لیبر', delivery: 'ڈیلیوری', rent: 'رینٹ', fuel: 'فیول', service: 'سروس', tyre: 'ٹائر', tire: 'ٹائر', puncture: 'پنکچر', challan: 'چالان', chalan: 'چالان', dawai: 'دوائی', medicine: 'میڈیسن', doctor: 'ڈاکٹر', fridge: 'فریج', ac: 'اے سی', rack: 'ریک', bharo: 'بھرو', bhara: 'بھرا', patti: 'پٹی', gillo: 'گلو',
  dobara: 'دوبارہ', dubara: 'دوبارہ', dobarah: 'دوبارہ', glue: 'گلو', sweeper: 'سویپر', cleaner: 'کلینر', helper: 'ہیلپر', paper: 'پیپر', office: 'آفس',
  internet: 'انٹرنیٹ', wifi: 'وائی فائی', recharge: 'ریچارج', balance: 'بیلنس', stationery: 'سٹیشنری', stationary: 'سٹیشنری', pen: 'پین', copy: 'کاپی',
  photocopy: 'فوٹو کاپی', nashta: 'ناشتہ', lunch: 'لنچ', dinner: 'ڈنر', mithai: 'مٹھائی', bonus: 'بونس', chanda: 'چندہ', sadqa: 'صدقہ', sadka: 'صدقہ',
  khairat: 'خیرات', committee: 'کمیٹی', kameti: 'کمیٹی', electrician: 'الیکٹریشن', plumber: 'پلمبر', mazdoor: 'مزدور', parking: 'پارکنگ', dawa: 'دوا',
  hospital: 'ہسپتال', school: 'اسکول', fees: 'فیس', fee: 'فیس', naya: 'نیا', nayi: 'نئی', naye: 'نئے', purana: 'پرانا', purani: 'پرانی', band: 'بند',
  theek: 'ٹھیک', thik: 'ٹھیک', saaf: 'صاف', saf: 'صاف' };
const RCONS = [['kh', 'خ'], ['gh', 'غ'], ['sh', 'ش'], ['ch', 'چ'], ['zh', 'ژ'], ['th', 'تھ'], ['ph', 'پھ'], ['bh', 'بھ'], ['dh', 'دھ'], ['jh', 'جھ'], ['rh', 'رھ'], ['lh', 'لھ'], ['mh', 'مھ'], ['nh', 'نھ'], ['ck', 'ک']];
const RONE = { b: 'ب', p: 'پ', t: 'ت', d: 'د', r: 'ر', z: 'ز', s: 'س', f: 'ف', q: 'ق', k: 'ک', g: 'گ', l: 'ل', m: 'م', n: 'ن', w: 'و', v: 'و', h: 'ہ', y: 'ی', j: 'ج', c: 'ک', x: 'کس' };
const RV = c => c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u';
function romWord(w) {
  const lw = String(w).toLowerCase(); if (RDICT[lw]) return RDICT[lw];
  const s = lw.replace(/([b-df-hj-np-tv-z])\1+/g, '$1');   // ll → l (vowel ke jore aa / ee / oo waise hi)
  const lastSyl = j => { let k = j; while (k < s.length && RV(s[k])) k++; let c = 0; while (k < s.length && !RV(s[k])) { k++; c++; } return k >= s.length && c >= 1; };
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], r2 = s.slice(i, i + 2), endAt = n => i + n >= s.length;
    if (i === 0 && RV(c)) { const m = { aa: 'آ', ai: 'ای', au: 'او', ee: 'ای', ei: 'ای', oo: 'او', ou: 'او' }[r2]; if (m) { out += m; i += 2; continue; } out += c === 'e' ? 'ای' : c === 'o' ? 'او' : 'ا'; i++; continue; }
    if (RV(c)) {
      if (r2 === 'aa') { out += 'ا'; i += 2; continue; }
      if (r2 === 'ue' && endAt(2)) { out += 'و'; i += 2; continue; }   // blue → بلو
      if (r2 === 'ee' || r2 === 'ii') { out += 'ی'; i += 2; continue; }
      if (r2 === 'oo' || r2 === 'uu' || r2 === 'ou' || r2 === 'au') { out += 'و'; i += 2; continue; }
      if (r2 === 'ai') { out += endAt(2) ? 'ائی' : 'ی'; i += 2; continue; }
      if (r2 === 'ei' || r2 === 'ey') { out += endAt(2) ? 'ے' : 'ی'; i += 2; continue; }
      if (endAt(1)) { out += c === 'a' ? 'ا' : c === 'i' ? 'ی' : c === 'e' ? 'ے' : 'و'; i++; continue; }
      if (c === 'e') { out += s[i + 1] === 'h' ? '' : 'ی'; i++; continue; }   // pehle → پہلے
      if (c === 'o') { out += 'و'; i++; continue; }
      if ((c === 'a' || c === 'u') && lastSyl(i)) { out += c === 'a' ? 'ا' : 'و'; i++; continue; }   // dukan → دکان
      i++; continue;   // chhota zer / zabar / pesh
    }
    const m = RCONS.find(([k]) => s.startsWith(k, i)); if (m) { out += m[1]; i += m[0].length; continue; }
    out += RONE[c] || ''; i++;
  }
  return out || w;
}
// v1.6: chhota angrezi naam (TXN / POS / ATM — bare harf, lughat mein nahi) = harf harf Urdu mein (ٹی ایکس این)
const RABC = { a: 'اے', b: 'بی', c: 'سی', d: 'ڈی', e: 'ای', f: 'ایف', g: 'جی', h: 'ایچ', i: 'آئی', j: 'جے', k: 'کے', l: 'ایل', m: 'ایم', n: 'این', o: 'او', p: 'پی', q: 'کیو', r: 'آر', s: 'ایس', t: 'ٹی', u: 'یو', v: 'وی', w: 'ڈبلیو', x: 'ایکس', y: 'وائے', z: 'زیڈ' };
const romTok = w => { const lw = String(w).toLowerCase(); if (!RDICT[lw] && /^[A-Z]{2,5}$/.test(w) && (!/[AEIOU]/.test(w) || w.length <= 3)) return [...lw].map(c => RABC[c] || '').join(' '); return romWord(w); };
const roman2ur = t => String(t || '').replace(/[a-z]+/gi, w => romTok(w)).replace(/\s+/g, ' ').trim();
// v1.7: 🔤 parchi ka item naam — save hua Urdu naam, warna English naam ka bina AI Urdu (malik: "Urdu line kabhi gayab nahi")
const item = (id, name) => { if (!on) return ''; const u = get(id); if (u) return u; const t = String(name || '').replace(/[\u0001\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); return /[a-z]/i.test(t) ? roman2ur(t.slice(0, 80)) : ''; };
// v1.6: AI 4 s mein na aaye to pas-e-parda 20 s — bani Urdu yaad (agli parchi par AI wali)
const bgBusy = new Set();
function noteBg(t) { const k = nkey(t); if (bgBusy.has(k) || !aiKey || Date.now() < noteWaitTill || nload()[k]) return; bgBusy.add(k); aiUr(t, 20000).catch(() => {}).finally(() => bgBusy.delete(k)); }
async function noteUr(t, ms = 4000) {
  const m = nload(), k = nkey(t); if (m[k]) return m[k];
  if (!aiKey || Date.now() < noteWaitTill) return '';
  try { return await aiUr(t, ms); } catch (e) { if (/jawab nahi/.test(String(e?.message))) noteBg(t); else noteWaitTill = Date.now() + 10 * 60000; return ''; }   // key / hadd ki ghalti = 10 min AI nahi (print tez rahe)
}
async function aiUr(t, ms) {
  const m = nload(), k = nkey(t);
  const prompt = 'Pakistani dukaan ki parchi par yeh likhai (Roman Urdu / English / naam) URDU rasm-ul-khat mein likho — TARJUMA NAHI, wahi lafz Urdu harfon mein, ghalat spelling ko sahi lafz samjho (walal = wala). Hindse, raqam, bill / TXN number waise hi rehne do. Sirf JSON: {"ur":"..."}\n\n' + t;
  const out = await gem(aiKey, aiModel || 'gemini-2.5-flash', prompt, true, ms);
  const mm = String(out || '').match(/\{[\s\S]*\}/); let ur = ''; try { ur = String(JSON.parse(mm ? mm[0] : '{}').ur || '').trim(); } catch {}
  if (!/[\u0600-\u06FF]/.test(ur)) return '';
  ur = ur.replace(/[\u0001\r\n]+/g, ' ').slice(0, 200); m[k] = ur; nsave(); return ur;
}
async function fillNotes(text, ms = 4000) {
  const ls = String(text || '').split('\r\n'); if (!ls.some(l => l.startsWith(NOTE))) return text;
  const out = [];
  for (const l of ls) {
    if (!l.startsWith(NOTE)) { out.push(l); continue; }
    if (!on || !noteOn) continue;
    const [t, px, lab] = l.slice(NOTE.length).split('\u0001'), ur = (await noteUr(t, ms)) || roman2ur(t);   // v1.6: AI na aaye to bhi Urdu
    if (ur) out.push(line((lab ? lab + ': ' : '') + ur, Number(px) || 50, 1));
  }
  return out.join('\r\n');
}
// nt-parchi Seg wali parchiyan (nt-print / sale-post): seg.img se seedha
async function noteSeg(seg, text, px = 50, ms = 4000, lab = '') { if (!on || !noteOn) return; const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t || !/[a-z]/i.test(t)) return; const ur = (await noteUr(t.slice(0, 160), ms)) || roman2ur(t.slice(0, 160)); if (ur) seg.img((lab ? lab + ': ' : '') + ur, px, true, 1); }   // v1.6: bina AI bhi   // tasveer na ban sake to bina Urdu

// ESC/POS text ('\r\n' lines, latin1) -> nt-parchi job { s: [...] } — aam lines jaisi thi, Urdu lines tasveer (daayein, mota)
function toJob(text, { font = 'Jameel Noori Nastaleeq,Urdu Typesetting,Segoe UI,Tahoma,Arial', dots = 512 } = {}) {
  const s = [], ls = String(text || '').split('\r\n'); let buf = '';
  const flush = () => { if (buf) { s.push({ r: Buffer.from(buf, 'latin1').toString('base64') }); buf = ''; } };
  ls.forEach((l, i) => {
    if (l.startsWith(MARK)) { const [ur, px, al] = l.slice(MARK.length).split('\u0001'); flush(); s.push({ i: ur, f: font, px: Number(px) || 32, b: true, w: dots, a: al === '1' ? 1 : al === '0' ? 0 : 2 }); }
    else if (l.startsWith(NOTE)) { /* v1.5: fillNotes na chala ho to nishan chhapo mat */ }
    else buf += l + (i < ls.length - 1 ? '\r\n' : '');
  });
  flush();
  return { s };
}
// v1.2: 🤖 PARTY KE URDU NAAM KHUD (malik: "parties ka naam bhi Urdu mein likh diya karo") — jin ka naam nahi, 80 ek dafa, Gemini tez (bina soche).
//   Key wahi jo app mein (blueAccess/aiConfig). Print ke waqt AI NAHI chalta (naam pehle se bane) — parchi slow nahi. Ghalti par 1 ghanta ruko.
const https = require('https');
function gem(key, model, prompt, noThink = true, ms = 60000) {   // v1.5: ms hadd · Gemini 3 = thinkingLevel minimal
  const tc = noThink ? (/gemini-3/i.test(String(model)) ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 }) : null;
  const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', ...(tc ? { thinkingConfig: tc } : {}) } });
  return new Promise((res, rej) => {
    const rq = https.request({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: ms }, r => {
      let d = ''; r.setEncoding('utf8'); r.on('data', c => { d += c; }); r.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} if (r.statusCode !== 200) return rej(Object.assign(new Error('AI ' + r.statusCode + ': ' + String(j?.error?.message || d).slice(0, 160)), { code: r.statusCode })); res((j?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')); });
    });
    rq.on('timeout', () => rq.destroy(new Error('AI ' + Math.round(ms / 1000) + ' sec mein jawab nahi'))); rq.on('error', rej); rq.write(body); rq.end();
  });
}
let fillBusy = false, fillWaitTill = 0;
async function fillParties({ db, businessId, parties, log = () => {}, force = false }) {
  if (fillBusy || (!on && !force) || (Date.now() < fillWaitTill && !force) || !db) return 0;
  const todo = (parties || []).filter(p => p && p.id && String(p.name || '').trim() && !String(pmap[String(p.id)] || '').trim());
  if (!todo.length) return 0;
  fillBusy = true; let done = 0;
  try {
    const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
    const c = await ba.doc('aiConfig').get(), cfg = c.exists ? (c.data() || {}) : {};
    if (!cfg.key) { fillWaitTill = Date.now() + 3600000; return 0; }
    const model = String(cfg.model || 'gemini-2.5-flash');
    for (let i = 0; i < Math.min(todo.length, 240); i += 80) {
      const chunk = todo.slice(i, i + 80);
      const prompt = 'Tum Pakistani dukaan ke khaton (customers / suppliers / kharcha) ke naam Urdu rasm-ul-khat mein likhte ho. Har naam ko URDU script mein likho — TARJUMA NAHI, wahi naam Urdu harfon mein. Chhote lafz: cus / cust / customer = کسٹمر, traders = ٹریڈرز, store = سٹور, sb = صاحب, bhai = بھائی. Shehar: lalamusa = لالہ موسیٰ, kharian = کھاریاں, gujrat = گجرات, jhelum = جہلم. Bank: HBL = ایچ بی ایل, Alfalah = الفلاح. Hindse wahi rakho. Sirf JSON array do, aur kuch nahi: [{"id":"...","ur":"..."}]\n' + JSON.stringify(chunk.map(p => ({ id: String(p.id), en: String(p.name).slice(0, 80) })));
      let out; try { out = await gem(cfg.key, model, prompt, true); } catch (e) { if (e.code === 400) out = await gem(cfg.key, model, prompt, false); else throw e; }
      const m = String(out || '').match(/\[[\s\S]*\]/); if (!m) continue;
      let arr = []; try { arr = JSON.parse(m[0]); } catch { continue; }
      const patch = {}; for (const x of arr) if (x && x.id && x.ur && /[\u0600-\u06FF]/.test(x.ur) && chunk.some(p => String(p.id) === String(x.id))) patch[String(x.id)] = String(x.ur).trim().slice(0, 120);
      if (Object.keys(patch).length) { await ba.doc('urduParties').set({ map: patch, updatedAt: Date.now(), by: 'pc' }, { merge: true }); Object.assign(pmap, patch); done += Object.keys(patch).length; }
    }
    if (done) log('🔤 ' + done + ' party ke Urdu naam AI se bane (voucher parchi)');
  } catch (e) { fillWaitTill = Date.now() + 3600000; log('🔤 Party Urdu naam nahi bane: ' + e.message + ' — 1 ghante baad dobara'); }
  finally { fillBusy = false; }
  return done;
}
// ---------- v1.7 (2026-11-06): 🤖 ITEM KE URDU NAAM KHUD (malik ka OK) ----------
//   transfer-sync har 10 min POS ke chalu items deta hai → jin ka Urdu naam NAHI sirf un ka (60 ek dafa, 240 fi chakkar) — wahi prompt jo app ka
//   "🔤 Urdu naam → AI se baqi" (pos-stock.js urduMake). Likhne se pehle urduNames taza parho: jo naam is dauran malik / app ne likha woh KABHI nahi badalta.
//   Model: aiConfig.model → chala hua → band (404) ho to Google ki list se behtareen flash (pakka naam nahi — 2.5-flash 2 Nov band hua).
let GOODM = '', mList = { at: 0, l: [] };
const isGone = e => Number(e && e.code) === 404 || /no longer available|not found|not supported for generateContent/i.test(String(e && e.message));
function gemList(key) {
  if (mList.l.length && Date.now() - mList.at < 6 * 3600000) return Promise.resolve(mList.l);
  return new Promise((res, rej) => {
    const rq = https.request({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models?pageSize=200', method: 'GET', headers: { 'x-goog-api-key': key }, timeout: 20000 }, r => {
      let d = ''; r.setEncoding('utf8'); r.on('data', c => { d += c; }); r.on('end', () => {
        let j = null; try { j = JSON.parse(d); } catch {} if (r.statusCode !== 200) return rej(Object.assign(new Error('model list ' + r.statusCode), { code: r.statusCode }));
        const v = n => Number((String(n).match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
        const names = ((j && j.models) || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''));
        const ok = names.filter(n => /flash/.test(n) && !/(lite|tts|image|live|audio|embedding|preview|exp)/.test(n)), plain = ok.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort((a, b) => v(b) - v(a));
        mList = { at: Date.now(), l: [...plain, ...ok.filter(n => !plain.includes(n)).sort((a, b) => v(b) - v(a))] }; res(mList.l);
      });
    });
    rq.on('timeout', () => rq.destroy(new Error('model list ka jawab nahi'))); rq.on('error', rej); rq.end();
  });
}
async function gemAny(key, model, prompt) {
  const one = async m => { try { return await gem(key, m, prompt, true); } catch (e) { if (e.code === 400 && !isGone(e)) return gem(key, m, prompt, false); throw e; } };   // 400 = model thinkingConfig nahi leta
  const tried = []; let last = null;
  const go = async m => { tried.push(m); try { const o = await one(m); GOODM = m; return { o }; } catch (e) { last = e; if (!isGone(e)) throw e; return null; } };
  for (const m of [String(model || '').replace(/^models\//, '').trim(), GOODM]) { if (!m || tried.includes(m)) continue; const r = await go(m); if (r) return r.o; }
  for (const m of (await gemList(key)).filter(m => !tried.includes(m)).slice(0, 4)) { const r = await go(m); if (r) return r.o; }
  throw last || new Error('AI model nahi mila');
}
let itBusy = false, itWaitTill = 0;
async function fillItems({ db, businessId, items, log = () => {}, max = 240 }) {
  if (itBusy || !on || !mapReady || Date.now() < itWaitTill || !db) return 0;
  const seen = new Set();
  const todo = (items || []).filter(r => { const id = r && r.id != null ? String(r.id) : ''; if (!id || seen.has(id) || !/[a-z]/i.test(String(r.name || '')) || String(map[id] || '').trim()) return false; seen.add(id); return true; });
  if (!todo.length) return 0;
  itBusy = true; let done = 0;
  try {
    const ba = db.collection('businesses').doc(businessId).collection('blueAccess');
    const c = await ba.doc('aiConfig').get(), cfg = c.exists ? (c.data() || {}) : {};
    if (!cfg.key) { itWaitTill = Date.now() + 3600000; return 0; }
    for (let i = 0; i < Math.min(todo.length, max); i += 60) {
      const chunk = todo.slice(i, i + 60);
      const prompt = 'Tum ek Pakistani grocery (kiryana) ki dukaan ke items ke naam Urdu rasm-ul-khat mein likhte ho. Har English/Roman naam ko URDU script mein likho — tarjuma nahi, wahi naam Urdu harfon mein (brand ke naam jaise chhapte hain waise: Dettol = ڈیٹول, Surf = سرف, Colgate = کولگیٹ). Wazan/size (5kg, 160g, 1.5 ltr) hindson mein wahi rakho (jaise 5 کلو, 160 گرام, 1.5 لیٹر). Sirf JSON array do, aur kuch nahi: [{"id":"...","ur":"..."}]\n' + JSON.stringify(chunk.map(r => ({ id: String(r.id), en: String(r.name).trim().slice(0, 80) })));
      const out = await gemAny(cfg.key, String(cfg.model || aiModel || ''), prompt);
      const m = String(out || '').match(/\[[\s\S]*\]/); if (!m) continue;
      let arr = []; try { arr = JSON.parse(m[0]); } catch { continue; }
      const ids = new Set(chunk.map(r => String(r.id))), patch = {};
      for (const x of arr) if (x && x.id != null && ids.has(String(x.id)) && x.ur && /[\u0600-\u06FF]/.test(x.ur)) patch[String(x.id)] = String(x.ur).replace(/[\u0001\r\n]+/g, ' ').trim().slice(0, 120);
      const fresh = await ba.doc('urduNames').get(), fm = (fresh.exists && (fresh.data() || {}).map) || {};
      for (const k of Object.keys(patch)) if (String(fm[k] || '').trim()) delete patch[k];   // malik / app ne is dauran likh diya = wohi rahe
      if (Object.keys(patch).length) { await ba.doc('urduNames').set({ map: patch, updatedAt: Date.now(), by: 'pc' }, { merge: true }); Object.assign(map, patch); done += Object.keys(patch).length; }
    }
    if (done) log('🔤 ' + done + ' item ke Urdu naam AI se bane (transfer note / gate pass)' + (todo.length > max ? ' — baqi ' + (todo.length - max) + ' agle chakkar mein' : ''));
  } catch (e) { itWaitTill = Date.now() + 3600000; log('🔤 Item Urdu naam nahi bane: ' + String(e && e.message).slice(0, 160) + ' — 1 ghante baad dobara'); }
  finally { itBusy = false; }
  return done;
}
// ---------- v1.8 (2026-11-09): 🚚 DELIVERY PATTI — sale rasid ke upar (nt-print billJob + sale-post receiptFor), bina AI ----------
//   Malik: "POS bill ke upar delivery charges likhna hai + delivery available hai har gaon ke liye · Urdu lafz wazeh nazar aayein".
//   Setting blueAccess/printConfig: dlv (false = band, default ON) · dlvChg ('' = gaon ke hisaab se · "100" = Rs 100 · koi likhai).
let dlvCfg = { on: true, chg: '' };
const dlvNum = c => /^\d+(\.\d+)?$/.test(String(c).replace(/,/g, ''));
function dlv() {
  if (!dlvCfg.on) return null;
  const c = dlvCfg.chg, n = dlvNum(c) ? Number(String(c).replace(/,/g, '')) : null;
  const en2 = !c ? 'Charges: gaon ke hisaab se' : n != null ? 'Delivery charges: Rs ' + n.toLocaleString('en-PK') : 'Charges: ' + c;
  const ur2 = !c ? 'ڈیلیوری چارجز: گاؤں کے حساب سے' : n != null ? 'ڈیلیوری چارجز: ' + UD(n.toLocaleString('en-US')) + ' روپے' : 'ڈیلیوری چارجز: ' + (/[\u0600-\u06ff]/.test(c) ? c : (roman2ur(c) || c));
  return { en1: 'DELIVERY AVAILABLE - HAR GAON', en2, ur1: 'ہر گاؤں کے لیے ڈیلیوری دستیاب ہے', ur2, ur: on };   // ur = Urdu ON (printConfig.urduSlip)
}
module.exports = { fillParties, dlv, _dlv: c => { dlvCfg = { on: c?.on !== false, chg: String(c?.chg || '') }; }, fillItems, item, watch, get, party, partyAny, isOn, line, has, strip, toJob, MARK, NOTE, dateUr, dateLine, UD, note, noteUr, fillNotes, noteSeg, roman2ur, _set: (m, o = true, pm) => { map = m || {}; mapReady = true; on = o; if (pm) pmap = pm; }, _ai: (k, m, no = true) => { aiKey = k; aiModel = m; noteOn = no; nmap = {}; noteWaitTill = 0; } };
