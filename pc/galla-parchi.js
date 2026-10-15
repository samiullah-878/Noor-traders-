// =====================================================================================================
//  galla-parchi.js  v1.0 (2026-10-15) — 💰 GALLA KI ADAIGI PARCHI (sirf URDU, bare lafz, EK hi dafa)
//  Malik: "galla par cash payment tab de ga jab Zeeshan / Mubeen / Sonu / Malik ne check kar liya ho — us ke baad payment dene ka
//          ek print nikle, dobara na nikle; us print par koi bhi English na ho, only Urdu; lafz bare bare".
//  Sirf NAQAD supplier (purchase "💵 Galla se abhi cash" -> gallaCalls needCheck). pos-khata-sync.js isay chalata hai (server TM-T88IV).
//  Hindse bhi Urdu (۲۵,۲۰۰), raqam lafzon mein (پچیس ہزار دو سو روپے), tareekh / waqt Urdu.
// =====================================================================================================
const UD = '۰۱۲۳۴۵۶۷۸۹';
const urDigits = s => String(s).replace(/[0-9]/g, d => UD[+d]);
const urNum = n => urDigits(Math.round(Number(n) || 0).toLocaleString('en-US'));   // 25200 -> ۲۵,۲۰۰
const W99 = ['', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس', 'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس',
  'بیس', 'اکیس', 'بائیس', 'تئیس', 'چوبیس', 'پچیس', 'چھبیس', 'ستائیس', 'اٹھائیس', 'انتیس', 'تیس', 'اکتیس', 'بتیس', 'تینتیس', 'چونتیس', 'پینتیس', 'چھتیس', 'سینتیس', 'اڑتیس', 'انتالیس',
  'چالیس', 'اکتالیس', 'بیالیس', 'تینتالیس', 'چوالیس', 'پینتالیس', 'چھیالیس', 'سینتالیس', 'اڑتالیس', 'انچاس', 'پچاس', 'اکیاون', 'باون', 'ترپن', 'چون', 'پچپن', 'چھپن', 'ستاون', 'اٹھاون', 'انسٹھ',
  'ساٹھ', 'اکسٹھ', 'باسٹھ', 'تریسٹھ', 'چونسٹھ', 'پینسٹھ', 'چھیاسٹھ', 'سڑسٹھ', 'اڑسٹھ', 'انہتر', 'ستر', 'اکہتر', 'بہتر', 'تہتر', 'چوہتر', 'پچھتر', 'چھہتر', 'ستتر', 'اٹھہتر', 'اناسی',
  'اسی', 'اکیاسی', 'بیاسی', 'تراسی', 'چوراسی', 'پچاسی', 'چھیاسی', 'ستاسی', 'اٹھاسی', 'نواسی', 'نوے', 'اکیانوے', 'بانوے', 'ترانوے', 'چورانوے', 'پچانوے', 'چھیانوے', 'ستانوے', 'اٹھانوے', 'ننانوے'];
function urWords(n) {   // 25200 -> "پچیس ہزار دو سو"
  n = Math.floor(Math.abs(Number(n) || 0)); if (!n) return 'صفر';
  const p = [], cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const hz = Math.floor(n / 1000); n %= 1000; const sau = Math.floor(n / 100); n %= 100;
  if (cr) p.push(urWords(cr) + ' کروڑ'); if (lk) p.push(W99[lk] + ' لاکھ'); if (hz) p.push(W99[hz] + ' ہزار'); if (sau) p.push(W99[sau] + ' سو'); if (n) p.push(W99[n]);
  return p.join(' ');
}
const MON = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
function urWhen(t) {
  const d = new Date(Number(t) || Date.now()), h = d.getHours(), m = d.getMinutes();
  const part = h < 5 ? 'رات' : h < 12 ? 'صبح' : h < 16 ? 'دوپہر' : h < 19 ? 'شام' : 'رات';
  return `${urDigits(d.getDate())} ${MON[d.getMonth()]} ${urDigits(d.getFullYear())} · ${part} ${urDigits((h % 12) || 12)}:${urDigits(String(m).padStart(2, '0'))}`;
}
const fit = (s, big, mid, small) => { const n = String(s).length; return n <= 12 ? big : n <= 20 ? mid : small; };
// Seg = nt-parchi make().Seg · c = gallaCalls doc · partyUr / checkUr = Urdu naam
function slipJob(Seg, ESC, c, partyUr, checkUr) {
  const rs = Math.round((Number(c.amount) || 0) / 100), s = Seg();
  s.raw(ESC + '@' + ESC + 'a\x01');
  s.img('ادائیگی پرچی', 40, true, 1);
  s.raw('\r\n');
  s.img(partyUr, fit(partyUr, 72, 58, 44), true, 1);
  s.raw('\r\n');
  s.img(`${urNum(rs)} روپے`, 84, true, 1);
  s.img(`${urWords(rs)} روپے`, fit(urWords(rs), 38, 32, 28), false, 1);
  s.raw('\r\n');
  s.img(`چیک کیا: ${checkUr}`, 48, true, 1);
  const bill = /bill\s*#\s*([0-9]{1,12})\b/i.exec(String(c.note || ''));
  s.img(bill ? `نقد خریداری · بل نمبر ${urDigits(bill[1])}` : 'نقد خریداری', 30, false, 1);
  s.img(urWhen(c.checkAt || Date.now()), 30, false, 1);
  s.raw('\r\n');
  s.img('یہ پرچی صرف ایک بار نکلتی ہے', 26, false, 1);
  return s.end();
}
const hasLatin = t => /[A-Za-z]/.test(String(t || ''));
module.exports = { slipJob, urWords, urNum, urDigits, urWhen, hasLatin };
