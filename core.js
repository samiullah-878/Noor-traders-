// core.js — Noor Traders Hazri + Salary
// Sirf hisab-kitab. Yahan na DOM hai na Firebase, is liye ye file Node mein test hoti hai.

export const APP_VERSION = 'v215';
export const TZ = 'Asia/Karachi';
export const BUSINESS_ID = 'noor-traders';
export const SHOP = { name: 'Noor Traders Gulyana', lat: 32.7979125, lng: 73.956984375, radius: 200 };
export const DEFAULT_CONFIG = {
  shiftStart: '09:15', shiftEnd: '19:00', radius: 200, grace: 10,
  instruction: '', closedDays: [],
  salaryDefault: { monthlySalary: 0, workingDays: 30, overtimeRate: 0, mode: 'hours', leavePaid: true, lateEvery: 0, lateFineDays: 0.5, outDeduct: false, breakDeduct: false },
  scores: { m10: 10, m20: 8, m30: 6, m45: 4, late: 2 }
};
export const STATUS_LABEL = {
  present: 'Hazir', late: 'Late', absent: 'Ghair hazir', leave: 'Chutti',
  off: 'Weekly off', closed: 'Dukaan band', half: 'Aadhi chutti', waiting: 'Abhi nahi aaya', loading: 'Load ho rahi…', na: '—'
};
export const STATUS_MARK = { present: 'P', late: 'L', absent: 'A', leave: 'C', off: 'O', closed: 'B', half: 'H', waiting: '·', loading: '…', na: '' };
export const DAY_NAMES = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'];
export const DAY_SHORT = ['Itw', 'Peer', 'Mng', 'Budh', 'Jum', 'Juma', 'Haf'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- text ---------- */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function money(n) {
  const v = Math.round(Number(n) || 0);
  return 'Rs ' + v.toLocaleString('en-PK');
}
export function hasArabic(text) { return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || '')); }

/* ---------- phone ---------- */
export function normalizePhone(value) {
  let phone = String(value ?? '').trim()
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660));
  if (!/^[+\d\s()-]+$/.test(phone)) return '';
  phone = phone.replace(/\D/g, '');
  if (phone.startsWith('0092')) phone = '0' + phone.slice(4);
  else if (phone.startsWith('92') && phone.length === 12) phone = '0' + phone.slice(2);
  if (phone.length === 10 && phone.startsWith('3')) phone = '0' + phone;
  return /^03\d{9}$/.test(phone) ? phone : '';
}

/* ---------- date / time (hamesha Pakistan ka waqt) ---------- */
const pad = n => String(n).padStart(2, '0');
/** Hamesha "YYYY-MM-DD". (Kuch Android phones 'en-CA' par "9/21/2026" dete hain — is liye hisse alag alag le kar jorte hain.) */
export function pkDate(d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = t => parts.find(x => x.type === t)?.value || '';
    const out = `${get('year')}-${get('month')}-${get('day')}`.replace(/[^\d-]/g, '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch { /* purana browser */ }
  const pk = new Date(d.getTime() + 5 * 3600000); // Pakistan UTC+5, koi daylight saving nahi
  return pk.toISOString().slice(0, 10);
}
export function pkMinutes(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const h = +(parts.find(x => x.type === 'hour')?.value || 0), m = +(parts.find(x => x.type === 'minute')?.value || 0);
  return (h % 24) * 60 + m;
}
export function pkTime24(d = new Date()) { const m = pkMinutes(d); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

/** "9:05 am", "09:05", "21:10", "9.05 PM" -> din ke minute. Ghalat ho to null. */
export function parseTime(value) {
  const m = String(value ?? '').trim().match(/(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([AaPp])?\.?\s*[Mm]?/);
  if (!m) return null;
  let h = Number(m[1]); const mi = Number(m[2]), ap = (m[3] || '').toUpperCase();
  if (!Number.isFinite(h) || !Number.isFinite(mi) || mi > 59) return null;
  if (ap === 'P' && h < 12) h += 12;
  if (ap === 'A' && h === 12) h = 0;
  if (h > 23) return null;
  return h * 60 + mi;
}
export function to24(value) { const m = parseTime(value); return m == null ? '' : pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
export function fmtTime(value) {
  const m = parseTime(value); if (m == null) return '—';
  const h = Math.floor(m / 60), mi = m % 60;
  return ((h % 12) || 12) + ':' + pad(mi) + (h < 12 ? ' am' : ' pm');
}
export function hm(min) {
  const m = Math.max(0, Math.round(min || 0));
  return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
}
export function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
export function isMonth(s) { return /^\d{4}-\d{2}$/.test(String(s || '')); }
export function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addMonths(month, n) {
  const d = new Date(month + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export function weekday(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(days)}`, days };
}
export function monthDates(month) {
  const { days } = monthRange(month);
  return Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`);
}
export function monthLabel(month) {
  if (!isMonth(month)) return String(month || '');
  const [y, m] = month.split('-').map(Number);
  return MONTH_NAMES[m - 1] + ' ' + y;
}
export function dateLabel(date) {
  if (!isDate(date)) return String(date || '');
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_NAMES[weekday(date)]}, ${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}
export function shortDate(date) {
  if (!isDate(date)) return String(date || '');
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}
/** Hafta Peer se shuru hota hai. */
export function weekRange(date) {
  const back = (weekday(date) + 6) % 7;
  const from = addDays(date, -back);
  return { from, to: addDays(from, 6) };
}

/* ---------- attendance ---------- */
export function normalizeAttendance(value, id = '') {
  const a = { ...(value || {}) };
  const docId = a.id || id || '';
  const idPhone = (String(docId).match(/^\d{4}-\d{2}-\d{2}_(.+)$/) || [])[1] || '';
  const idDate = (String(docId).match(/^(\d{4}-\d{2}-\d{2})_/) || [])[1] || '';
  return {
    ...a, id: docId,
    date: a.date || idDate,
    phone: normalizePhone(a.phone || idPhone) || String(a.phone || idPhone),
    checkIn: a.checkIn || a.checkInTime || '',
    checkOut: a.checkOut || a.checkOutTime || '',
    minutesLate: Number(a.minutesLate ?? a.lateMinutes ?? a.late ?? 0) || 0
  };
}
/** Kaam ke minute. Raat ki shift (aadhi raat paar) theek ginti hai. 16 ghante se zyada = ghalat record. */
export function workMinutes(rec) {
  if (!rec) return null;
  const i = parseTime(rec.checkIn), o = parseTime(rec.checkOut);
  if (i == null || o == null) return null;
  let d = o - i; if (d < 0) d += 1440;
  if (d <= 0 || d > 16 * 60) return null;
  return d;
}
export function hoursText(rec) {
  if (!rec?.checkIn) return '—';
  if (!rec.checkOut) return 'Jari hai';
  const d = workMinutes(rec); return d == null ? '—' : hm(d);
}
export function resolveSchedule(config = {}, own = null) {
  const base = { grace: 10, weeklyOff: [], ...DEFAULT_CONFIG, ...config };
  if (!own) return base;
  const merged = { ...base, ...own };
  if (own.useDefaultShift !== false) { merged.shiftStart = base.shiftStart; merged.shiftEnd = base.shiftEnd; merged.grace = base.grace; }
  merged.grace = Number(merged.grace ?? 10);
  merged.weeklyOff = Array.isArray(merged.weeklyOff) ? merged.weeklyOff.map(Number) : [];
  return merged;
}
/** Shift kitne minute ki hai (raat ki shift bhi). shiftEnd na ho to null. */
export function shiftMinutes(schedule = {}) {
  const a = parseTime(schedule.shiftStart), b = parseTime(schedule.shiftEnd);
  if (a == null || b == null) return null;
  const d = b > a ? b - a : b + 1440 - a;
  return d > 0 && d <= 20 * 60 ? d : null;
}
export function isClosed(schedule = {}, date) { return (schedule.closedDays || []).some(d => d?.date === date); }
export function lateMinutes(att, schedule = {}) {
  const actual = parseTime(att?.checkIn), start = parseTime(schedule.shiftStart);
  if (actual == null) return 0;
  if (start == null) return Math.max(0, Number(att.minutesLate || 0));
  return Math.max(0, actual - start);
}
export function scoreForLate(mins, scores = {}) {
  const s = { ...DEFAULT_CONFIG.scores, ...scores };
  if (mins <= 10) return +s.m10; if (mins <= 20) return +s.m20; if (mins <= 30) return +s.m30; if (mins <= 45) return +s.m45;
  return +s.late;
}
export function attendanceScore(a) { const n = Number(a?.finalScore ?? a?.autoScore); return Number.isFinite(n) ? n : null; }

/**
 * Aik staff, aik din ka status.
 * today/nowMin diye jayen to aaj shift se pehle "waiting" aata hai (pehle ye subah hi "absent" dikhata tha).
 */
/** Us din ki manzoor chutti (poori ya aadhi). half: '' | 'am' (subah ki chutti, der se aayega) | 'pm' (shaam ki, jaldi jayega) */
export function leaveFor(requests = [], phone, date) {
  const list = requests.filter(r => r.phone === phone && r.kind === 'leave' && r.status === 'approved' && r.date <= date && (r.to || r.date) >= date);
  return list.sort((a, b) => (b.reviewedAt || b.createdAt || 0) - (a.reviewedAt || a.createdAt || 0))[0] || null;
}
/** Aadhi chutti wale din ki duty: subah ki chutti = duty aadhe din se shuru; shaam ki = aadhe din par khatam. */
export function halfSchedule(schedule = {}, half = '') {
  if (!half) return schedule;
  const start = parseTime(schedule.shiftStart) ?? 540, dur = shiftMinutes(schedule) || 600, mid = (start + Math.round(dur / 2)) % 1440;
  const t = String(Math.floor(mid / 60)).padStart(2, '0') + ':' + String(mid % 60).padStart(2, '0');
  return half === 'am' ? { ...schedule, shiftStart: t } : { ...schedule, shiftEnd: t };
}
export function statusFor({ account = {}, attendance = {}, requests = [], date, schedule = {}, today = pkDate(), nowMin = pkMinutes() }) {
  const lv = leaveFor(requests, account.phone, date);
  if (attendance?.checkIn) {
    if (lv?.half) return 'half';
    return lateMinutes(attendance, schedule) > Number(schedule.grace ?? 10) ? 'late' : 'present';
  }
  if (date > today) return 'na';
  if (account.joinDate && date < account.joinDate) return 'na';
  if (isClosed(schedule, date)) return 'closed';
  const phone = account.phone;
  if (lv && !lv.half) return 'leave';
  void phone;
  if ((schedule.weeklyOff || []).includes(weekday(date))) return 'off';
  if (date === today) {
    const start = parseTime(halfSchedule(schedule, lv?.half === 'am' ? 'am' : '').shiftStart);
    if (start != null && nowMin <= start + Number(schedule.grace ?? 10)) return 'waiting';
  }
  return 'absent';
}
/** Check-in hai, check-out nahi, aur shift khatam ho chuki. */
export function checkoutDue(a = {}, schedule = {}, now = Date.now()) {
  if (!a.checkIn || a.checkOut || !isDate(a.date)) return false;
  const day = Date.parse(a.date + 'T00:00:00+05:00');
  const end = parseTime(schedule.shiftEnd);
  if (end == null) return now >= day + 86400000;
  const start = parseTime(schedule.shiftStart) ?? 540;
  return now >= day + (end + (end <= start ? 1440 : 0)) * 60000;
}
/** Staff ka khula record jis par Check-Out lagna hai (raat ki shift mein kal ka bhi ho sakta hai). */
export function openRecord(rows = [], now = Date.now()) {
  return rows
    .filter(a => a.checkIn && !a.checkOut && isDate(a.date))
    .filter(a => {
      const started = a.checkInTs || (Date.parse(a.date + 'T00:00:00+05:00') + (parseTime(a.checkIn) || 0) * 60000);
      return now - started >= 0 && now - started <= 16 * 3600000;
    })
    .sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0] || null;
}
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Aik din ke liye sab staff ki qataar. */
export function dayRows({ staff = [], attendance = [], requests = [], schedules = new Map(), config = {}, date, today = pkDate(), nowMin = pkMinutes(), now = Date.now() }) {
  const byPhone = new Map(attendance.filter(a => a.date === date).map(a => [a.phone, a]));
  return staff.map(account => {
    const schedule = resolveSchedule(config, schedules.get(account.phone));
    const a = byPhone.get(account.phone) || {};
    const status = statusFor({ account, attendance: a, requests, date, schedule, today, nowMin });
    const leave = leaveFor(requests, account.phone, date), sch = halfSchedule(schedule, leave?.half || '');
    return { account, a, schedule, leave, status, late: a.checkIn && status !== 'half' ? lateMinutes(a, sch) : 0, due: checkoutDue(a, sch, now), minutes: workMinutes(a) };
  });
}
export function countStatuses(rows) {
  const c = { present: 0, late: 0, absent: 0, leave: 0, off: 0, closed: 0, half: 0, waiting: 0, loading: 0, na: 0 };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  c.off += c.closed; // dukaan band bhi "off" mein ginti
  c.present += c.half; // aadhi chutti wala aaya tha -> hazir mein bhi
  return c;
}
/** Aik staff ka poora mahina. */
export function monthSummary({ account, attendance = [], requests = [], schedule = {}, month, today = pkDate(), nowMin = pkMinutes() }) {
  const byDate = new Map(attendance.filter(a => a.phone === account.phone).map(a => [a.date, a]));
  const days = monthDates(month).map(date => {
    const a = byDate.get(date) || {};
    const status = statusFor({ account, attendance: a, requests, date, schedule, today, nowMin });
    const leave = leaveFor(requests, account.phone, date);
    return { date, a, status, leave, late: a.checkIn && status !== 'half' ? lateMinutes(a, halfSchedule(schedule, leave?.half || '')) : 0, minutes: workMinutes(a) };
  });
  const count = countStatuses(days);
  const totalMin = days.reduce((n, d) => n + (d.minutes || 0), 0);
  const lateMin = days.filter(d => d.status === 'late').reduce((n, d) => n + d.late, 0);
  return { days, count, totalMin, lateMin, open: days.filter(d => d.a.checkIn && !d.a.checkOut && d.date < today).length };
}

/* ---------- salary ---------- */
export function mealConfig(salary = {}, account = {}) {
  const legacy = Number(account.mealAmount || account.khanaAmount || 0);
  const mode = ['daily', 'monthly', 'none'].includes(salary.mealMode) ? salary.mealMode : legacy > 0 ? (account.meal === 'monthly' ? 'monthly' : 'daily') : 'none';
  return { mealMode: mode, mealRate: Math.max(0, Number(salary.mealRate ?? legacy) || 0), mealInSalary: salary.mealInSalary === true };
}
/** Staff default salary par hai? Purane staff jin ki apni raqam likhi hai wo "apni salary" par rehte hain. */
export function usesDefaultSalary(account = {}) {
  const s = account.salary || {};
  return s.useDefault ?? !(Number(s.monthlySalary) > 0);
}
/**
 * Salary ki settings. config.salaryDefault = sab ki default salary aur qawaid (hisab ka tareeqa, late jurmana).
 * Default wale staff ke roz ke ghante us ki duty (shift) se khud bante hain.
 */
export function salaryConfig(account = {}, config = {}, schedule = null) {
  const d = account.salary || {}, def = { ...DEFAULT_CONFIG.salaryDefault, ...(config.salaryDefault || {}) };
  const useDefault = usesDefaultSalary(account), src = useDefault ? def : d;
  const shift = shiftMinutes(schedule || resolveSchedule(config));
  return {
    ...mealConfig(d, account), useDefault,
    monthlySalary: Number(src.monthlySalary || 0),
    dutyHours: useDefault ? (shift ? shift / 60 : Number(def.dutyHours || 10)) : Number(d.dutyHours || 10),
    workingDays: Number(src.workingDays || 30),
    overtimeRate: Number(src.overtimeRate || 0),
    pointRate: Number(d.pointRate || def.pointRate || 0),
    mode: def.mode === 'days' ? 'days' : 'hours',
    leavePaid: def.leavePaid !== false,
    outDeduct: def.outDeduct === true,
    breakDeduct: def.breakDeduct === true,
    lateEvery: Math.max(0, Math.floor(Number(def.lateEvery || 0))),
    lateFineDays: Math.max(0, Number(def.lateFineDays ?? 0.5))
  };
}
/** Qarz (qiston wala advance): is mahine kitni qist kategi aur kitna baqi rahega. */
export function loanCuts(extras = [], month) {
  const out = [];
  for (const x of extras.filter(e => e.kind === 'loan' && isMonth(e.month))) {
    const amount = Number(x.amount || 0), per = Math.max(1, Number(x.perMonth || amount));
    let remaining = amount, cut = 0;
    for (let m = x.month; m <= month && remaining > 0; m = addMonths(m, 1)) {
      cut = Math.min(per, remaining);
      if (m === month) break;
      remaining -= cut; cut = 0;
    }
    if (x.month > month) cut = 0;
    out.push({ ...x, cut, remainingBefore: remaining, remainingAfter: Math.max(0, remaining - cut) });
  }
  return out;
}
/**
 * Mahine ki salary. Formula purani app wala hi hai:
 * hourly = monthly / (dutyHours × workingDays); normal ghante × hourly + overtime + points + bonus + khana − advance.
 * Agar mahina "final" ho chuka hai to wahi jama hua hisab wapas aata hai (badalta nahi).
 */
export function salaryCalc({ account = {}, month, attendance = [], payroll = null, config = {}, schedule = null, requests = [], outs = [], tickets = [], today = pkDate(), nowMin = pkMinutes() }) {
  const paid = Number(payroll?.paid || 0), payments = payroll?.payments || [];
  if (payroll?.state === 'final' && payroll.snapshot) {
    const s = payroll.snapshot;
    return { ...s, frozen: true, paid, payments, balance: Number(s.final || 0) - paid };
  }
  const sch = schedule || resolveSchedule(config);
  const cfg = salaryConfig(account, config, sch), { from, to } = monthRange(month);
  const recs = attendance.filter(a => a.phone === account.phone && a.date >= from && a.date <= to);
  const dutyMin = Math.max(0, Math.round(cfg.dutyHours * 60));
  let normalMin = 0, otMin = 0, daysWorked = 0, attPoints = 0, openDays = 0;
  for (const a of recs) {
    const sc = attendanceScore(a); if (sc != null) attPoints += sc;
    const w = workMinutes(a);
    if (w == null) { if (a.checkIn && !a.checkOut) openDays++; continue; }
    daysWorked++;
    normalMin += dutyMin ? Math.min(w, dutyMin) : w;
    otMin += dutyMin ? Math.max(0, w - dutyMin) : 0;
  }
  const expectedHours = cfg.dutyHours * cfg.workingDays;
  const hourly = expectedHours > 0 ? cfg.monthlySalary / expectedHours : 0;
  const perDay = cfg.workingDays > 0 ? cfg.monthlySalary / cfg.workingDays : 0;
  const otRate = cfg.overtimeRate > 0 ? cfg.overtimeRate : hourly;
  // Din ke hisab se ginti (ghair hazir, chutti, late)
  const sum = monthSummary({ account, attendance: recs, requests, schedule: sch, month, today, nowMin });
  const beforeJoin = account.joinDate ? sum.days.filter(d => d.date < account.joinDate && d.date <= today).length : 0;
  // Chutti: har chutti par malik ne likha ke paisa katega ya nahi (paid); na likha ho to Settings wala qaida.
  let absentUnits = 0, paidLeaveUnits = 0; const leaveLines = [];
  for (const d of sum.days) {
    if (d.date > today) continue;
    const lv = d.leave, units = lv?.half ? 0.5 : 1, paid = lv ? (typeof lv.paid === 'boolean' ? lv.paid : cfg.leavePaid) : null;
    let leaveUnits = 0;
    if (d.status === 'absent') { if (lv?.half) { absentUnits += 0.5; leaveUnits = 0.5; } else absentUnits += 1; }
    else if (d.status === 'leave') leaveUnits = 1;
    else if (d.status === 'half') leaveUnits = 0.5;
    if (!leaveUnits) continue;
    void units;
    if (paid) paidLeaveUnits += leaveUnits;
    else leaveLines.push({ date: d.date, units: leaveUnits, half: lv?.half || '', amount: leaveUnits * perDay, text: `Chutti ${shortDate(d.date)}${leaveUnits < 1 ? ' (aadha din)' : ''}` });
  }
  const absentDays = absentUnits + beforeJoin;
  const lateCount = sum.count.late;
  let normalSalary, absentCut = 0;
  // din ke hisab mein bina-paise wali chutti kat-ti hai; ghanton ke hisab mein paise wali chutti ke ghante jurte hain
  const leaveCut = cfg.mode === 'days' ? leaveLines.reduce((n, l) => n + l.amount, 0) : 0;
  const leavePay = cfg.mode === 'days' ? 0 : paidLeaveUnits * dutyMin / 60 * hourly;
  if (cfg.mode === 'days') { absentCut = Math.min(cfg.monthlySalary, absentDays * perDay); normalSalary = cfg.monthlySalary - absentCut; }
  else normalSalary = (normalMin / 60) * hourly;
  const overtimeAmount = (otMin / 60) * otRate;
  const points = attPoints, pointsAmount = points * cfg.pointRate;
  const all = Array.isArray(account.salaryExtras) ? account.salaryExtras : [];
  const extras = all.filter(x => x.month === month && x.kind !== 'loan');
  const add = k => extras.filter(x => x.kind === k).reduce((n, x) => n + Number(x.amount || 0), 0);
  const bonus = add('bonus'), advance = add('advance');
  const loans = loanCuts(all, month).filter(l => l.cut > 0 || l.month === month);
  const loanCut = loans.reduce((n, l) => n + l.cut, 0);
  const lateFines = cfg.lateEvery ? Math.floor(lateCount / cfg.lateEvery) : 0;
  const lateFine = lateFines * cfg.lateFineDays * perDay;
  const mealDays = new Set(recs.filter(a => a.checkIn).map(a => a.date)).size;
  const mealTotal = cfg.mealMode === 'monthly' ? cfg.mealRate : cfg.mealMode === 'daily' ? cfg.mealRate * mealDays : 0;
  const mealSalary = cfg.mealInSalary ? mealTotal : 0;
  // Bahar jane ki parchi: sirf mukammal (wapas aa gaya) parchiyan ginti mein
  const mine = outs.filter(o => o.phone === account.phone && o.date >= from && o.date <= to && o.status === 'returned');
  const monthOuts = mine.filter(o => o.kind !== 'break'), monthBreaks = mine.filter(o => o.kind === 'break');
  const outMin = monthOuts.reduce((n, o) => n + (outMinutes(o) || 0), 0), outCount = monthOuts.length;
  const breakMin = monthBreaks.reduce((n, o) => n + (outMinutes(o) || 0), 0), breakCount = monthBreaks.length;
  const outCut = cfg.outDeduct ? (outMin / 60) * hourly : 0;
  const breakCut = cfg.breakDeduct ? (breakMin / 60) * hourly : 0;
  // Bina bataye gaya: sirf malik ke "Katauti" wale faisle
  const ticketLines = tickets.filter(t => t.phone === account.phone && t.date >= from && t.date <= to && t.status === 'decided' && t.decision === 'katauti' && Number(t.amount) > 0)
    .sort((a, b) => (a.from || 0) - (b.from || 0)).map(t => ({ id: t.id, date: t.date, amount: Number(t.amount), text: ticketText(t) }));
  const ticketCut = ticketLines.reduce((n, t) => n + t.amount, 0);
  const deductions = advance + loanCut + lateFine + outCut + breakCut + ticketCut + leaveCut;
  const final = normalSalary + leavePay + overtimeAmount + pointsAmount + bonus + mealSalary - deductions;
  return {
    phone: account.phone, month, periodLabel: monthLabel(month), from, to, ...cfg, expectedHours, hourly, perDay, otRate,
    daysWorked, openDays, normalMin, otMin, normalSalary, overtimeAmount, attPoints, taskPoints: 0, points, pointsAmount,
    absentDays, absentCut, lateCount, lateFines, lateFine, loans, loanCut, outMin, outCount, outCut, breakMin, breakCount, breakCut, ticketLines, ticketCut, leaveLines: cfg.mode === 'days' ? leaveLines : [], leaveCut, leavePay, paidLeaveUnits, deductions,
    extras, bonus, advance, mealDays, mealTotal, mealSalary, final, frozen: false, paid, payments, balance: final - paid
  };
}
/** Final karte waqt Firestore mein jane wala halka snapshot (selfie waghera ke baghair). */
export function salarySnapshot(calc, recs = []) {
  const { frozen, paid, payments, balance, ...rest } = calc;
  return JSON.parse(JSON.stringify({
    ...rest,
    recs: recs.map(({ phone, date, checkIn, checkOut, finalScore, autoScore }) => ({ phone, date, checkIn: checkIn || '', checkOut: checkOut || '', finalScore: finalScore ?? null, autoScore: autoScore ?? null }))
  }));
}

/* ---------- smart search ---------- */
const STATUS_WORDS = [
  ['checkoutDue', /\b(check\s?-?out|chekout|chutti nahi ki)\s*(baqi|baki|nahi|nhi|missing|pending|rehta)?\b|\bbaqi check\s?-?out\b/],
  ['absent', /\b(ghair|gair|gher|ghar)\s?-?\s?(hazir|hazri|haazir)\b|\babsent\b|\bnahi aaya\b|\bnhi aya\b|\bnahi aya\b|\bgayab\b|\bghaib\b/],
  ['late', /\blate\b|\blet\b|\bder se\b|\bdair se\b|\bdeir\b/],
  ['leave', /\bchutti\b|\bchhutti\b|\bchuti\b|\bleave\b|\bchuttian\b/],
  ['off', /\bweekly off\b|\boff day\b|\boff\b/],
  ['present', /\bhazir\b|\bhaazir\b|\bpresent\b|\baaya\b|\baya\b|\bwaqt par\b|\bon time\b/],
  ['salaryDue', /\b(salary|tankhwah|tankha|tankhah|pay)\s*(baqi|baki|due|pending|rehti)\b|\bbaqi salary\b/],
  ['advance', /\badvance\b|\badvans\b|\bpeshgi\b/]
];
const MONTH_WORDS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };

function cleanQuery(q) {
  return String(q || '').toLowerCase()
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
    .replace(/[,;|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/**
 * Likha hua sawal -> filter. Misalein: "late is hafte", "ghair hazir aaj", "ali pichle mahine",
 * "checkout baqi", "salary baqi", "0300", "15 sep", "12/9".
 */
export function parseQuery(query, today = pkDate()) {
  let q = ' ' + cleanQuery(query) + ' ';
  const out = { statuses: [], from: '', to: '', rangeLabel: '', text: '', salaryDue: false, advance: false, checkoutDue: false, empty: !q.trim() };
  const take = re => { const m = q.match(re); if (m) q = q.replace(m[0], ' '); return m; };

  for (const [key, re] of STATUS_WORDS) {
    if (take(re)) {
      if (key === 'salaryDue') out.salaryDue = true; else if (key === 'advance') out.advance = true;
      else if (key === 'checkoutDue') out.checkoutDue = true; else out.statuses.push(key);
    }
  }
  const month = today.slice(0, 7);
  const setRange = (from, to, label) => { if (!out.from) { out.from = from; out.to = to; out.rangeLabel = label; } };
  if (take(/\b(pichle|pichlay|pichla|guzishta|last|previous)\s+(mahine|mahina|month|maah)\b/)) { const m = addMonths(month, -1), r = monthRange(m); setRange(r.from, r.to, monthLabel(m)); }
  if (take(/\b(pichle|pichlay|pichla|guzishta|last|previous)\s+(hafte|hafta|week)\b/)) { const r = weekRange(addDays(today, -7)); setRange(r.from, r.to, 'Pichla hafta'); }
  if (take(/\b(is|iss|this|isi)?\s*(mahine|mahina|month|maah)\b/)) { const r = monthRange(month); setRange(r.from, r.to > today ? today : r.to, monthLabel(month)); }
  if (take(/\b(is|iss|this|isi)?\s*(hafte|hafta|week)\b/)) { const r = weekRange(today); setRange(r.from, r.to > today ? today : r.to, 'Is hafte'); }
  if (take(/\b(parson|parso)\b/)) { const d = addDays(today, -2); setRange(d, d, shortDate(d)); }
  if (take(/\b(kal|yesterday|guzishta roz)\b/)) { const d = addDays(today, -1); setRange(d, d, 'Kal'); }
  if (take(/\b(aaj|aj|today|abhi)\b/)) setRange(today, today, 'Aaj');

  let m;
  if ((m = take(/\b(\d{4})-(\d{2})-(\d{2})\b/))) { const d = `${m[1]}-${m[2]}-${m[3]}`; setRange(d, d, shortDate(d)); }
  if ((m = take(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/))) {
    const dd = +m[1], mm = +m[2]; let yy = m[3] ? +m[3] : +today.slice(0, 4); if (yy < 100) yy += 2000;
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) { const d = `${yy}-${pad(mm)}-${pad(dd)}`; setRange(d, d, shortDate(d)); }
  }
  const monthRe = new RegExp('\\b(?:(\\d{1,2})\\s+)?(' + Object.keys(MONTH_WORDS).sort((a, b) => b.length - a.length).join('|') + ')(?:\\s+(\\d{1,2}))?(?:\\s+(\\d{4}))?\\b');
  if ((m = take(monthRe))) {
    const mm = MONTH_WORDS[m[2]], dd = +(m[1] || m[3] || 0); let yy = m[4] ? +m[4] : +today.slice(0, 4);
    if (!m[4] && `${yy}-${pad(mm)}` > month) yy -= 1;
    if (dd) { const d = `${yy}-${pad(mm)}-${pad(dd)}`; setRange(d, d, shortDate(d)); }
    else { const mo = `${yy}-${pad(mm)}`, r = monthRange(mo); setRange(r.from, r.to > today ? today : r.to, monthLabel(mo)); }
  }
  q = q.replace(/\b(ko|ka|ki|ke|mein|me|main|se|tak|wale|walay|wala|larke|larka|staff|sab|kon|kaun|kis|ne|hai|hain|the|tha|dikhao|dikha|batao|list|hazri|attendance)\b/g, ' ');
  out.text = q.replace(/\s+/g, ' ').trim();
  return out;
}
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
/** Naam / number / role ka milaan. Thori spelling ghalti (1-2 harf) maaf hai: "ahmd" -> "Ahmad". */
export function matchStaff(account, text) {
  const t = squash(text); if (!t) return true;
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 3 && String(account.phone || '').includes(digits)) return true;
  const hay = squash(`${account.name || ''} ${account.role || ''} ${account.address || ''}`);
  const words = hay.split(' ').filter(Boolean);
  return t.split(' ').filter(Boolean).every(tok => {
    if (hay.includes(tok)) return true;
    if (tok.length < 3) return false;
    const allow = tok.length >= 6 ? 2 : 1;
    const bare = tok.replace(/[aeiou]/g, '');
    return words.some(w => editDistance(w.slice(0, tok.length + 1), tok) <= allow || (bare.length >= 2 && w.replace(/[aeiou]/g, '') === bare));
  });
}
/**
 * Poori smart search. Wapas: { people, rows, summary, range }.
 * people = staff list (naam/number ke hisab se), rows = (staff × din) jo status filter par poore utre.
 */
export function smartSearch({ query, staff = [], attendance = [], requests = [], schedules = new Map(), config = {}, payroll = [], today = pkDate(), nowMin = pkMinutes(), now = Date.now() }) {
  const p = parseQuery(query, today);
  const people = staff.filter(s => matchStaff(s, p.text));
  const wantsDays = p.statuses.length || p.checkoutDue || p.from;
  const rows = [];
  if (wantsDays) {
    let from = p.from, to = p.to;
    if (!from) { from = to = today; if (p.checkoutDue) { from = monthRange(addMonths(today.slice(0, 7), -1)).from; } }
    if (to > today) to = today;
    for (let d = to; d >= from; d = addDays(d, -1)) {
      for (const r of dayRows({ staff: people, attendance, requests, schedules, config, date: d, today, nowMin, now })) {
        if (p.checkoutDue && !r.due) continue;
        if (p.statuses.length && !p.statuses.includes(r.status)) continue;
        if (r.status === 'na') continue;
        rows.push({ ...r, date: d });
      }
      if (rows.length > 400) break;
    }
  }
  let money = [];
  if (p.salaryDue || p.advance) {
    const month = (p.from || today).slice(0, 7);
    money = people.map(account => ({ account, calc: salaryCalc({ account, month, attendance, config, requests, today, nowMin, schedule: resolveSchedule(config, schedules.get(account.phone)), payroll: payroll.find(x => x.id === `${month}_${account.phone}`) }) }))
      .filter(x => p.advance ? x.calc.advance > 0 : x.calc.balance > 0.5);
  }
  const bits = [];
  if (p.statuses.length) bits.push(p.statuses.map(s => STATUS_LABEL[s]).join(' / '));
  if (p.checkoutDue) bits.push('Check-out baqi');
  if (p.salaryDue) bits.push('Salary baqi'); if (p.advance) bits.push('Advance');
  if (p.rangeLabel) bits.push(p.rangeLabel); else if (wantsDays) bits.push('Aaj');
  if (p.text) bits.push('"' + p.text + '"');
  return { parsed: p, people, rows, money, mode: (p.salaryDue || p.advance) ? 'money' : wantsDays ? 'days' : 'people', summary: bits.join(' · ') };
}

/** Hafte ka khulasa: har staff kitne din aaya, kitni dafa late. */
export function weekSummary({ staff = [], attendance = [], requests = [], schedules = new Map(), config = {}, today = pkDate(), nowMin = pkMinutes() }) {
  const { from } = weekRange(today), out = [];
  for (const account of staff) {
    const schedule = resolveSchedule(config, schedules.get(account.phone));
    let present = 0, late = 0, absent = 0, minutes = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) {
      const a = attendance.find(x => x.phone === account.phone && x.date === d) || {};
      const st = statusFor({ account, attendance: a, requests, date: d, schedule, today, nowMin });
      if (st === 'present' || st === 'late' || st === 'half') present++; if (st === 'late') late++; if (st === 'absent') absent++;
      minutes += workMinutes(a) || 0;
    }
    out.push({ account, present, late, absent, minutes });
  }
  return { from, to: today, rows: out };
}

/** Firestore Timestamp / number -> milliseconds (ya null). */
export function tsMillis(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
  return null;
}
/**
 * Staff ne jo Check-In waqt likha (phone ki ghari) aur server par jo asal waqt aaya — dono mein kitne minute farq.
 * 10+ minute = ya to phone ki ghari ghalat, ya internet ke baghair lagi aur baad mein pohanchi. Malik ko chip dikhti hai.
 */
export function serverGap(a = {}) {
  const at = tsMillis(a.serverAt), claimed = parseTime(a.checkIn);
  if (at == null || claimed == null || !isDate(a.date)) return null;
  const gap = Math.round((at - Date.parse(a.date + 'T00:00:00+05:00')) / 60000) - claimed;
  return Math.abs(gap) > 2 * 1440 ? null : gap;
}


/* ---------- bahar jane ki parchi ---------- */
/** key = Roman (Firebase aur malik ki screen), ur = staff ki parchi aur Gate Pass par Urdu lipi. */
export const OUT_REASONS = [
  { key: 'Washroom (chhoti hajat)', ur: 'واش روم — چھوٹی حاجت' },
  { key: 'Washroom (bari hajat)', ur: 'واش روم — بڑی حاجت' },
  { key: 'Maal lene', ur: 'مال لینے' }, { key: 'Khana', ur: 'کھانا' }, { key: 'Namaz', ur: 'نماز' },
  { key: 'Bank', ur: 'بینک' }, { key: 'Ghar ka kaam', ur: 'گھر کا کام' }, { key: 'Delivery', ur: 'ڈیلیوری' }, { key: 'Aur', ur: 'کچھ اور' }
];
export const OUT_MINUTES = [3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120];
export function reasonUr(key) { return OUT_REASONS.find(r => r.key === key)?.ur || String(key || ''); }
/** "3 منٹ", "1 گھنٹہ", "ڈیڑھ گھنٹہ", "2 گھنٹے" */
export function minutesUr(n) {
  n = Number(n) || 0;
  if (n === 90) return 'ڈیڑھ گھنٹہ';
  if (n >= 60 && n % 60 === 0) return n === 60 ? '1 گھنٹہ' : (n / 60) + ' گھنٹے';
  return n + ' منٹ';
}
/** Parchi ke minute: wapas aaya to (wapsi − jana); abhi bahar hai to ab tak (now diya ho to). */
export function outMinutes(o = {}, now = null) {
  const start = Number(o.outAt) || null; if (!start) return null;
  const end = o.status === 'returned' ? Number(o.returnAt) : (o.status === 'approved' && now ? now : null);
  if (!end || end < start) return null;
  return Math.round((end - start) / 60000);
}
/** Aik staff, aik din ki parchiyan + kul bahar ka waqt. */
/** kind 'out' = bahar ki parchiyan, 'break' = khane ka waqfa, 'all' = dono. */
export function dayOuts(outs = [], phone, date, now = Date.now(), kind = 'out') {
  const list = outs.filter(o => o.phone === phone && o.date === date && ['pending', 'approved', 'returned', 'rejected'].includes(o.status)
      && (kind === 'all' || (kind === 'break' ? o.kind === 'break' : o.kind !== 'break')))
    .sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
  const done = list.filter(o => o.status === 'returned');
  const open = list.find(o => o.status === 'approved') || null, pending = list.find(o => o.status === 'pending') || null;
  const total = done.reduce((n, o) => n + (outMinutes(o) || 0), 0) + (open ? (outMinutes(open, now) || 0) : 0);
  return { list, done, open, pending, total, count: done.length + (open ? 1 : 0) };
}
/** Aaj ka rang — Gate Pass par, taake purana screenshot pehchana jaye. */
export function dayColor(date) {
  let h = 0; for (const c of String(date)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 42%)`;
}

/** Chhote waqt ke liye: "1 min se kam", "7 min", "1h 05m". */
export function durText(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 1) return '1 min se kam';
  if (m < 60) return m + ' min';
  return hm(m);
}

/* ---------- khane ka waqfa (break) ---------- */
export const BREAK_MINUTES = [10, 15, 20, 30, 40, 45, 60];
/** Staff ki bari: 1 = pehli, 2 = doosri (jo pehle walon ki jagah dukaan sambhalte hain). */
export function breakGroup(account = {}) { return Number(account.breakGroup) === 2 ? 2 : 1; }
/** Malik ke staff se sab ke liye halki list (naam + bari) — staffConfig/main.roster, taake manager ko naam nazar aayen. */
export function rosterOf(staff = []) {
  return staff.filter(s => s.active !== false).map(s => ({ phone: s.phone, name: String(s.name || '').slice(0, 80), group: breakGroup(s), ...(s.canApproveOuts ? { mgr: true } : {}) }))
    .sort((a, b) => a.phone.localeCompare(b.phone));
}

/* ---------- bina bataye gaya (ticket) ---------- */
export function round5(n) { return Math.max(0, Math.round((Number(n) || 0) / 5) * 5); }
const pkClock = ms => { const d = new Date(Number(ms)); const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d); const g = t => p.find(x => x.type === t)?.value || '00'; return `${g('hour')}:${g('minute')}`; };
export function ticketMinutes(t = {}, now = null) {
  const a = Number(t.from) || null; if (!a) return null;
  const b = Number(t.returnAt) || (t.status === 'open' && now ? now : null);
  if (!b || b < a) return null;
  return Math.round((b - a) / 60000);
}
/** "Bina bataye gaya — 22 Sep, 1:15 se 2:45 — Rs 125" (12-ghante, am/pm ke baghair, jaisa plan mein tha) */
export function ticketText(t = {}) {
  const h = ms => { const [H, M] = pkClock(ms).split(':').map(Number); return `${(H % 12) || 12}:${String(M).padStart(2, '0')}`; };
  const parts = [`Bina bataye gaya — ${shortDate(t.date)}, ${t.from ? h(t.from) : '—'} se ${t.returnAt ? h(t.returnAt) : '—'}`];
  if (t.decision === 'katauti' && Number(t.amount) > 0) parts.push(`Rs ${Math.round(Number(t.amount)).toLocaleString('en-PK')}`);
  return parts.join(' — ');
}
/** Katauti ka mashwara: (mahana ÷ din ÷ roz ke ghante) × jitni der gaya, qareebi 5 rupay. */
export function ticketSuggest(hourly, minutes) { return round5((Number(hourly) || 0) * (Number(minutes) || 0) / 60); }
/** "HH:MM" (aaj) -> milliseconds (Pakistan waqt). */
export function pkTimeMs(date, hhmm) { const m = parseTime(hhmm); if (m == null || !isDate(date)) return null; return Date.parse(`${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00+05:00`); }
