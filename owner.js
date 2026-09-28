// owner.js — malik ka panel: Hazri, Salary, Staff.
import {
  APP_VERSION, STATUS_LABEL, STATUS_MARK, DAY_SHORT, SHOP, esc, money, hm, fmtTime, to24, pkDate, pkMinutes, pkTime24, addDays, addMonths, weekday,
  monthDates, monthLabel, dateLabel, parseTime, shortDate, weekRange, dayRows, countStatuses, monthSummary, smartSearch, salaryConfig, checkoutDue, isDate,
  shiftMinutes, usesDefaultSalary, weekSummary, isClosed, loanCuts, workMinutes, parseTime as C_parse, serverGap, STATUS_MARK as MARK, dayOuts, outMinutes, durText, breakGroup, ticketMinutes, ticketText
} from './core.js';
import { openTicketSheet } from './tickets.js';
import { NOTIFY_KINDS, newTopic, sendNotify, appLink } from './notify.js';
import { enablePush, disablePush, currentToken, pushPermission, pushSupported, refreshPush } from './push.js';
import { openBreakSheet, breakStatusHtml } from './breaks.js';
const clock = ms => ms ? fmtTime(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))) : '—';
const to24FromMin = m => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
import { icon, avatar, nameHtml, toast, busy, openSheet, refreshSheets, fileToDataUrl, deliverPdf, $, errorText, timeField, IN_TICKETS, OUT_TICKETS, viewImage } from './ui.js';
import { loadPdfLib, browserTextImages, dailyPdf, staffMonthPdf, registerPdf, salarySheetPdf } from './pdf.js';

const ORDER = { due: 0, late: 1, waiting: 2, absent: 3, loading: 3, present: 4, leave: 5, off: 6, closed: 6, na: 7 };
const FILTERS = [['all', 'Sab'], ['present', 'Hazir'], ['late', 'Late'], ['absent', 'Ghair hazir'], ['leave', 'Chutti/Off']];

export function createOwnerView({ data, controller, rerender, logout, checkUpdate, install, manager = false }) {
  const S = data.state;
  const ui = { openTickets: new Set(), tab: 'hazri', view: 'day', date: pkDate(), month: pkDate().slice(0, 7), filter: 'all', salaryMonth: pkDate().slice(0, 7), staffQuery: '', showInactive: false };
  const activeStaff = () => S.staff.filter(s => s.active !== false);
  const context = () => ({ requests: S.requests, schedules: S.schedules, config: S.config, today: pkDate(), nowMin: pkMinutes(), now: Date.now() });
  // Hazri abhi Firebase se nahi aayi to "Ghair hazir" nahi, "Load ho rahi" dikhao (pehle yehi ghalat-fehmi hoti thi).
  const rowsFor = date => {
    const rows = dayRows({ staff: activeStaff(), attendance: data.attendanceBetween(date, date), date, ...context() });
    if (data.monthLoaded(date.slice(0, 7))) return rows;
    return rows.map(r => ['absent', 'waiting'].includes(r.status) ? { ...r, status: 'loading' } : r);
  };
  const attError = month => S.errors?.['att:' + month];
  const dutyText = sch => { const m = shiftMinutes(sch); return sch.shiftEnd ? `${fmtTime(sch.shiftStart)} – ${fmtTime(sch.shiftEnd)}` : `${fmtTime(sch.shiftStart)} se`; void m; };
  const hoursText = (sch, account) => { const m = shiftMinutes(sch); return m ? hm(m).replace(' 00m', '') + ' duty' : Math.round(data.salaryFor(account).dutyHours) + 'h duty'; };
  const summaryFor = (account, month) => monthSummary({ account, attendance: data.attendanceBetween(month + '-01', month + '-31'), requests: S.requests, schedule: data.scheduleFor(account.phone), month, today: pkDate(), nowMin: pkMinutes() });
  const account = phone => S.staff.find(s => s.phone === phone);
  const pending = () => S.requests.filter(r => r.status === 'pending' && r.kind !== 'suggestion');
  const loadingNote = month => attError(month)
    ? `<p class="error-line">${icon('alert', 18)} <span>${esc(monthLabel(month))} ki hazri Firebase se nahi aayi (${esc(attError(month))}). Internet check karein, phir Logout kar ke dobara login karein. Masla rahe to "Staff › App ki jaanch" ka screenshot bhejein.</span></p>`
    : data.monthLoaded(month) ? '' : `<p class="loading-line">${esc(monthLabel(month))} ki hazri load ho rahi hai…</p>`;

  const resolveBase = () => data.scheduleFor('__default__');
  // Aane ka waqt PM aur jane ka AM = shayad ghalti se raat ki duty save ho gayi (purane ghari wale picker ki wajah se)
  const nightShift = c => { const a = C_parse(c.shiftStart), b = C_parse(c.shiftEnd); return a != null && b != null && a >= 12 * 60 && b < a; };
  /* ================= HAZRI ================= */
  function attention() {
    const today = pkDate(), items = [];
    const due = data.allAttendance().filter(a => checkoutDue(a, data.scheduleFor(a.phone)) && account(a.phone));
    if (due.length) items.push({ tone: 'bad', icon: 'clock', title: `${due.length} Check-Out baqi — daba kar band karein`, text: [...new Set(due.map(a => account(a.phone)?.name))].slice(0, 3).join(', '), action: 'close-due', arg: '' });
    const pend = pending();
    if (pend.length) items.push({ tone: 'late', icon: 'note', title: `${pend.length} request ka jawab dein`, text: pend.slice(0, 2).map(r => `${account(r.phone)?.name || r.phone}: ${r.kind === 'leave' ? 'chutti' : r.via === 'outside' ? 'bahar se Check-Out' + (r.distance != null ? ' (' + kmText(r.distance) + ')' : '') : 'correction'}`).join(', '), action: 'requests' });
    const week = weekRange(today), lateCount = new Map();
    for (let d = week.from; d <= today; d = addDays(d, 1)) for (const r of rowsFor(d)) if (r.status === 'late') lateCount.set(r.account.phone, (lateCount.get(r.account.phone) || 0) + 1);
    const repeat = [...lateCount].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
    if (repeat.length) items.push({ tone: 'late', icon: 'alert', title: 'Is hafte baar baar late', text: repeat.slice(0, 3).map(([p, n]) => `${account(p)?.name} (${n} dafa)`).join(', '), action: 'search-run', arg: 'late is hafte' });
    const prev = addMonths(today.slice(0, 7), -1);
    if (+today.slice(8) <= 10 && data.monthLoaded(prev)) {
      const open = activeStaff().filter(s => data.calcFor(s, prev).daysWorked > 0 && data.payrollFor(s.phone, prev)?.state !== 'final');
      if (open.length) items.push({ tone: 'ink', icon: 'wallet', title: `${monthLabel(prev)} ki salary final nahi`, text: `${open.length} staff baqi`, action: 'salary-month', arg: prev });
    }
    // v222: aaj galla par shak (PC ki ginti) — sab se upar
    if (!manager) { const shak = (S.camStats || []).reduce((a, x) => a + Number(x.shak || 0), 0); if (shak) items.unshift({ tone: 'bad', icon: 'camera', title: `Aaj ${shak} dafa galla par shak`, text: 'Nigrani mein photos dekh kar "Theek hai" ya "Shak pakka" karein', action: 'tab', arg: 'nigrani' }); }
    // v218: phones ki jaanch — kis ka Check-Out/Wapsi server tak nahi gaya, kis ke phone par purani app
    const ph = phoneHealth(), failed = ph.filter(x => x.fail), old = ph.filter(x => x.old);
    if (failed.length) items.unshift({ tone: 'bad', icon: 'phone', title: `${failed.length} phone se ${failed.length > 1 ? 'likhai' : failKindText(failed[0].fail.kind)} server tak nahi gayi`, text: failed.slice(0, 2).map(x => `${x.name}: ${failKindText(x.fail.kind)} ${x.fail.time} (${failWhy(x.fail.code)})`).join(', '), action: 'phones', arg: '' });
    if (old.length) items.push({ tone: 'late', icon: 'phone', title: `${old.length} phone par purani app`, text: old.slice(0, 3).map(x => `${x.name} (${x.v || 'purani'})`).join(', ') + ' — larke se kahein app band kar ke dobara kholein', action: 'phones', arg: '' });
    const undecided = S.tickets.filter(t => t.status !== 'decided');
    if (undecided.length) items.unshift({ tone: 'bad', icon: 'alert', title: `${undecided.length} "bina bataye gaya" ticket ka faisla baqi`, text: [...new Set(undecided.map(t => account(t.phone)?.name || t.name))].slice(0, 3).join(', '), action: 'tickets', arg: '' });
    if (nightShift(S.config)) items.unshift({ tone: 'bad', icon: 'alert', title: `Default duty ghalat lag rahi hai: ${dutyText(resolveBase())}`, text: 'Daba kar AM / PM theek karein', action: 'settings', arg: '' });
    if (!items.length) return '';
    return `<section class="attention" aria-label="Tawajju chahiye"><h2 class="section-label">Tawajju chahiye</h2><div class="attention-list">${items.map(i =>
      `<button type="button" class="att-card tone-${i.tone}" data-action="${i.action}" data-arg="${esc(i.arg || '')}">${icon(i.icon, 22)}<span><b>${esc(i.title)}</b><small>${esc(i.text || '')}</small></span></button>`).join('')}</div></section>`;
  }
  function strip(c, total) {
    const seg = (k, n) => n ? `<i class="seg s-${k}" style="flex:${n}" title="${STATUS_LABEL[k]}: ${n}"></i>` : '';
    return `<div class="strip" role="img" aria-label="Hazri ka khulasa">${total ? seg('present', c.present) + seg('late', c.late) + seg('waiting', c.waiting) + seg('absent', c.absent) + seg('leave', c.leave + c.off) : '<i class="seg s-na" style="flex:1"></i>'}</div>`;
  }
  /** Nayi parchiyan: Haan / Nahi yahin se. */
  function outCards() {
    const list = S.outs.filter(o => o.status === 'pending' && o.date === pkDate()).sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
    const openList = S.outs.filter(o => o.status === 'approved' && o.date === pkDate() && o.kind !== 'break');
    if (!list.length && !openList.length) return '';
    return `<section class="out-cards" aria-label="Bahar jane ki parchiyan">${list.map(o => { const s = account(o.phone) || { name: o.phone };
      return `<div class="out-card">${avatar(s)}<div class="out-text"><b>${nameHtml(s.name)} bahar jana chahta hai</b><small>${esc(o.reason)}${o.note ? ' — ' + nameHtml(o.note) : ''} · ${o.minutes} min · ${esc(clock(o.requestedAt))}</small></div>
        <div class="out-btns"><button type="button" class="btn btn-primary btn-sm" data-action="out-review" data-id="${esc(o.id)}" data-arg="yes">Haan</button><button type="button" class="btn btn-ghost btn-sm" data-action="out-review" data-id="${esc(o.id)}" data-arg="no">Nahi</button></div></div>`; }).join('')}
      ${openList.length ? `<div class="out-list"><div class="break-head">${icon('out', 20)}<b>${openList.length} abhi bahar hain</b><button type="button" class="btn btn-ghost btn-sm" data-action="outs" data-arg="${pkDate()}">Sab parchiyan</button></div>
        <p class="hint">Jo wapas aa jaye us ke naam par dabayein.</p>
        ${openList.map(o => { const m = outMinutes(o, Date.now()) || 0, over = m > Number(o.minutes || 0), back = Number(o.outAt) + Number(o.minutes || 0) * 60000;
          return `<button type="button" class="b-row" data-action="out-return" data-id="${esc(o.id)}"><span><b>${nameHtml(account(o.phone)?.name || o.name || o.phone)}</b><small>${esc(o.reason)} · ${clock(o.outAt)} gaya · ${clock(back)} tak</small></span><span class="${over ? 'txt-bad' : ''}">${over ? `${m - Number(o.minutes || 0)} min zyada` : `${Number(o.minutes || 0) - m} min baqi`}</span><span class="b-back">Wapas ✓</span></button>`; }).join('')}</div>` : ''}</section>`;
  }
  function personRow(r, date) {
    const { account: s, a, status, late, due, minutes, schedule: sch } = r;
    const stamp = status === 'late' ? `Late ${late}m` : STATUS_LABEL[status];
    const duty = shiftMinutes(sch) || Math.round(data.salaryFor(s).dutyHours * 60);
    const chips = [`<span class="tag">${icon('clock', 14)} ${esc(dutyText(sch))}</span>`, `<span class="tag">${esc(hoursText(sch, s))}</span>`];
    if (a.checkIn) {
      chips.push(`<span class="tag t-ok">Aaya ${fmtTime(a.checkIn)}</span>`);
      chips.push(a.checkOut ? `<span class="tag t-ok">Gaya ${fmtTime(a.checkOut)}</span>` : due ? '<span class="tag t-bad">Check-Out baqi</span>' : '<span class="tag">Kaam par</span>');
      if (minutes != null) chips.push(`<span class="tag t-ink">${hm(minutes)}${duty && minutes > duty ? ' (+' + hm(minutes - duty) + ' OT)' : ''}</span>`);
      if (a.manual) chips.push('<span class="tag">Malik ne lagayi</span>');
      // v221: Check-Out dukaan se bahar hua (request se manzoor, ya purana v221 se pehle ka)
      if (a.checkOut && (a.checkOutVia === 'outside' || Number(a.checkOutDistance) > Number(S.config.radius || SHOP.radius))) chips.push(`<span class="tag t-late">${icon('pin', 12)} Check-Out bahar se${a.checkOutDistance != null ? ' · ' + esc(kmText(a.checkOutDistance)) : ''}</span>`);
      const od = dayOuts(S.outs, s.phone, date);
      if (od.open) { const m = outMinutes(od.open, Date.now()) || 0, over = m > Number(od.open.minutes || 0); chips.push(`<button type="button" class="tag ${over ? 't-bad' : 't-late'}" data-action="outs" data-arg="${date}">Abhi bahar · ${durText(m)} se · ${esc(od.open.reason)}${over ? ' · waqt se zyada' : ''}</button>`); }
      if (od.pending) chips.push(`<button type="button" class="tag t-late" data-action="outs" data-arg="${date}">Bahar jana chahta hai · ${esc(od.pending.reason)}</button>`);
      if (od.done.length) chips.push(`<button type="button" class="tag" data-action="outs" data-arg="${date}">Bahar ${od.done.map(o => `${clock(o.outAt)}–${clock(o.returnAt)}`).join(', ')} (${durText(od.done.reduce((n, o) => n + (outMinutes(o) || 0), 0))})</button>`);
      const bd = dayOuts(S.outs, s.phone, date, Date.now(), 'break');
      if (bd.open) { const m = outMinutes(bd.open, Date.now()) || 0, over = m > Number(bd.open.minutes || 0); chips.push(`<span class="tag ${over ? 't-bad' : 't-late'}">Khana break · ${durText(m)} se${over ? ' · waqt se zyada' : ''}</span>`); }
      if (bd.done.length) chips.push(`<span class="tag">Khana ${bd.done.map(o => `${clock(o.outAt)}–${clock(o.returnAt)}`).join(', ')} (${durText(bd.done.reduce((n, o) => n + (outMinutes(o) || 0), 0))})</span>`);
      if (r.leave) chips.push(`<span class="tag ${paidDesc(r.leave) === 'paisa katega' ? 't-bad' : 't-ink'}">${r.leave.half ? 'Aadhi chutti (' + (r.leave.half === 'am' ? 'subah' : 'shaam') + ')' : 'Chutti'} · ${paidDesc(r.leave)}</span>`);
      for (const t of S.tickets.filter(x => x.phone === s.phone && x.date === date)) {
        const tm = ticketMinutes(t, Date.now()) || 0;
        const lab = t.status === 'open' ? `Bina bataye gaya · ${clock(t.from)} se · ${durText(tm)}` : t.status === 'decided'
          ? `Ticket: ${t.decision === 'katauti' ? 'Katauti ' + money(t.amount) : t.decision === 'warning' ? 'Warning' : 'Maaf'} (${clock(t.from)}–${clock(t.returnAt)})`
          : `Bina bataye ${clock(t.from)}–${clock(t.returnAt)} (${durText(tm)}) · faisla baqi`;
        chips.push(`<button type="button" class="tag ${t.status === 'decided' && t.decision !== 'katauti' ? 't-late' : 't-bad'}" data-action="tickets" data-arg="${date}">${esc(lab)}</button>`);
      }
      if (minutes != null && od.total) chips.push(`<span class="tag t-ink">Asal kaam ${hm(Math.max(0, minutes - od.total))}</span>`);
      const g = serverGap(a); if (g != null && Math.abs(g) >= 10) chips.push(`<span class="tag t-bad" title="Staff ke phone ka waqt aur server ka waqt alag">Server ${fmtTime(to24FromMin(parseTime(a.checkIn) + g))}</span>`);
    }
    // Tickets: aik tap se Aaya / Gaya ka waqt. Bhool jane wale larke ke liye.
    const key = s.phone + '|' + date, open = ui.openTickets.has(key);
    const tix = (kind, list, current) => `<div class="tix"><span class="tix-label">${kind === 'in' ? 'Aaya' : 'Gaya'}:</span>${[...new Set(list.filter(Boolean))].sort().map(v =>
      `<button type="button" class="tix-btn${current === v ? ' is-on' : ''}" data-action="tix" data-kind="${kind}" data-phone="${s.phone}" data-date="${date}" data-arg="${v}">${esc(fmtTime(v).replace(' am', '').replace(' pm', ''))}<small>${parseTime(v) >= 720 ? 'pm' : 'am'}</small></button>`).join('')}</div>`;
    const inList = [to24(sch.shiftStart), ...IN_TICKETS], outList = [...OUT_TICKETS, to24(sch.shiftEnd)];
    let quick = '';
    if (['absent', 'waiting', 'loading'].includes(status) && status !== 'loading') quick = tix('in', inList, '');
    else if (a.checkIn && !a.checkOut) quick = tix('out', outList, '') + (open ? tix('in', inList, to24(a.checkIn)) : `<button type="button" class="tix-more" data-action="tix-open" data-arg="${key}">Aaya badlein</button>`);
    else if (a.checkIn) quick = open ? tix('in', inList, to24(a.checkIn)) + tix('out', outList, to24(a.checkOut)) : `<button type="button" class="tix-more" data-action="tix-open" data-arg="${key}">Waqt badlein</button>`;
    return `<li class="row s-${status}${due ? ' is-due' : ''}">
      <div class="row-col">
        <button type="button" class="row-main" data-action="profile" data-phone="${s.phone}" data-date="${date}">
          ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')}</small></span>
          <span class="stamp st-${status}">${esc(stamp)}</span>
        </button>
        <div class="tags">${chips.join('')}</div>${quick ? `<div class="tix-wrap">${quick}</div>` : ''}
      </div>
      <button type="button" class="row-pdf" data-action="pdf-staff" data-phone="${s.phone}" data-month="${date.slice(0, 7)}" aria-label="${esc(s.name)} ki PDF">${icon('pdf', 18)}<span>PDF</span></button>
    </li>`;
  }
  function weekCard() {
    if (!data.monthLoaded(pkDate().slice(0, 7))) return '';
    const w = weekSummary({ staff: activeStaff(), attendance: data.allAttendance(), ...context() });
    if (!w.rows.length) return '';
    const days = Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86400000) + 1;
    const lateTop = [...w.rows].filter(r => r.late).sort((a, b) => b.late - a.late)[0];
    const full = w.rows.filter(r => r.present === days).length;
    const hours = w.rows.reduce((n, r) => n + r.minutes, 0);
    return `<details class="week"><summary><span><b>Is hafte</b> (${esc(shortDate(w.from))} – ${esc(shortDate(w.to))})</span>
        <span class="week-bits"><span>${full} ki poori hazri</span>${lateTop ? `<span class="txt-late">Sab se zyada late: ${nameHtml(lateTop.account.name)} (${lateTop.late})</span>` : ''}<span>${hm(hours)} kul kaam</span></span></summary>
      <table class="week-table"><thead><tr><th>Naam</th><th>Aaya</th><th>Late</th><th>Ghair</th><th>Ghante</th></tr></thead>
      <tbody>${[...w.rows].sort((a, b) => b.late - a.late || a.present - b.present).map(r => `<tr><td>${nameHtml(r.account.name)}</td><td>${r.present}/${days}</td><td class="${r.late ? 'txt-late' : ''}">${r.late}</td><td class="${r.absent ? 'txt-bad' : ''}">${r.absent}</td><td>${hm(r.minutes)}</td></tr>`).join('')}</tbody></table></details>`;
  }
  function dayView() {
    const date = ui.date, today = pkDate(), month = date.slice(0, 7);
    const rows = rowsFor(date), c = countStatuses(rows);
    const match = r => ui.filter === 'all' || r.status === ui.filter || (ui.filter === 'present' && r.status === 'half') || (ui.filter === 'leave' && ['off', 'closed'].includes(r.status)) || (ui.filter === 'absent' && ['waiting', 'loading'].includes(r.status));
    const shown = rows.filter(match).sort((a, b) => (ORDER[a.due ? 'due' : a.status] - ORDER[b.due ? 'due' : b.status]) || (a.a.checkIn || '').localeCompare(b.a.checkIn || '') || String(a.account.name).localeCompare(String(b.account.name)));
    const counts = { all: rows.length, present: c.present, late: c.late, absent: c.absent + c.waiting + c.loading, leave: c.leave + c.off };
    const closed = isClosed(resolveBase(), date), reason = (S.config.closedDays || []).find(d => d.date === date)?.reason;
    return `${date === today ? breakStatusHtml(S.outs.filter(o => o.kind === 'break' && o.status === 'approved' && o.date === today), Date.now(), o => account(o.phone)?.name || o.name || o.phone) + outCards() + attention() + weekCard() : ''}
      ${closed ? `<p class="closed-line">${icon('alert', 18)} <span><b>${esc(dateLabel(date))}: Dukaan band</b>${reason && reason !== 'Dukaan band' ? ' — ' + esc(reason) : ''}. Is din koi ghair hazir nahi ginta.</span></p>` : ''}
      <div class="day-tools">${date === today ? `<button type="button" class="btn btn-ghost btn-sm tone-bad-btn" data-action="ticket-new">${icon('alert', 16)} Bina bataye gaya</button>` : ''}${date === today ? `<button type="button" class="btn btn-primary btn-sm" data-action="break-start">${icon('clock', 16)} Khana break</button>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-closed" data-arg="${date}">${closed ? 'Dukaan band hatayein' : (date === today ? 'Aaj' : 'Is din') + ' dukaan band (Eid / chutti)'}</button>${c.absent + c.waiting && data.monthLoaded(month) ? `<button type="button" class="btn btn-ghost btn-sm" data-action="quick-present-all" data-arg="${date}">Sab ghair hazir ko hazir lagao</button>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-action="selfies-day" data-arg="${date}">${icon('camera', 16)} Selfies dekhein</button></div>
      <section class="panel">
        ${strip(c, rows.length)}
        <div class="chips" role="tablist" aria-label="Filter">${FILTERS.map(([k, label]) => `<button type="button" role="tab" class="chip c-${k}" aria-selected="${ui.filter === k}" data-action="filter" data-arg="${k}"><b>${counts[k]}</b> ${label}</button>`).join('')}</div>
        ${loadingNote(month)}
        ${S.loaded.has('staff') && !rows.length ? `<div class="empty"><p>Abhi koi staff nahi. Pehle "Staff" tab mein larke shamil karein.</p><button type="button" class="btn btn-primary" data-action="tab" data-arg="staff">Staff shamil karein</button></div>` : ''}
        <ol class="register">${shown.map(r => personRow(r, date)).join('')}</ol>
        ${rows.length && !shown.length ? '<p class="empty-line">Is filter mein koi nahi.</p>' : ''}
      </section>`;
  }
  function monthView() {
    const month = ui.month, dates = monthDates(month), today = pkDate();
    const grid = activeStaff().map(s => ({ account: s, summary: summaryFor(s, month) }));
    return `<section class="panel">
      ${loadingNote(month)}
      <p class="legend"><span class="mk st-present">P</span> Hazir <span class="mk st-late">L</span> Late <span class="mk st-absent">A</span> Ghair hazir <span class="mk st-leave">C</span> Chutti <span class="mk st-off">O</span> Off <span class="mk st-half">H</span> Aadhi chutti &nbsp;—&nbsp; khane par dabayein to hazri durust hoti hai</p>
      <div class="grid-scroll"><table class="grid"><thead><tr><th class="g-name">Naam</th>${dates.map(d => `<th class="${weekday(d) === 5 ? 'is-fri' : ''}${d === today ? ' is-today' : ''}"><small>${DAY_SHORT[weekday(d)].slice(0, 2)}</small>${+d.slice(8)}</th>`).join('')}<th>P</th><th>L</th><th>A</th></tr></thead>
      <tbody>${grid.map(g => `<tr><th class="g-name"><button type="button" data-action="profile" data-phone="${g.account.phone}" data-date="${month}-01">${nameHtml(g.account.name)}</button></th>${g.summary.days.map(d =>
        `<td class="st-${d.status}${d.date === today ? ' is-today' : ''}">${d.status === 'na' ? '' : `<button type="button" data-action="edit-att" data-phone="${g.account.phone}" data-date="${d.date}" aria-label="${shortDate(d.date)} ${STATUS_LABEL[d.status]}">${STATUS_MARK[d.status]}</button>`}</td>`).join('')}
        <td class="g-sum">${g.summary.count.present + g.summary.count.late}</td><td class="g-sum st-late">${g.summary.count.late}</td><td class="g-sum st-absent">${g.summary.count.absent}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }
  function hazriTab() {
    const day = ui.view === 'day', label = day ? dateLabel(ui.date) : monthLabel(ui.month);
    const atEnd = day ? ui.date >= pkDate() : ui.month >= pkDate().slice(0, 7);
    return `<div class="toolbar">
        <div class="switch" role="tablist"><button type="button" role="tab" aria-selected="${day}" data-action="view" data-arg="day">Din</button><button type="button" role="tab" aria-selected="${!day}" data-action="view" data-arg="month">Mahina</button></div>
        <span class="btn-row"><button type="button" class="btn btn-ink" data-action="${day ? 'pdf-day' : 'pdf-register'}">${icon('pdf', 18)} ${day ? 'Aaj ki hazri PDF' : 'Register PDF'}</button>${day ? '' : `<button type="button" class="btn btn-ink" data-action="excel" data-arg="${ui.month}">${icon('down', 18)} Excel</button>`}</span>
      </div>
      <div class="datebar">
        <button type="button" class="icon-btn" data-action="step" data-arg="-1" aria-label="Pichla">${icon('left')}</button>
        <label class="date-pick"><span>${esc(label)}</span><input type="${day ? 'date' : 'month'}" value="${day ? ui.date : ui.month}" max="${day ? pkDate() : pkDate().slice(0, 7)}" data-change="pick-date" aria-label="Tareekh chunein"></label>
        <button type="button" class="icon-btn" data-action="step" data-arg="1" aria-label="Agla" ${atEnd ? 'disabled' : ''}>${icon('right')}</button>
        ${atEnd ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-action="today">Aaj</button>'}
      </div>
      ${day ? dayView() : monthView()}`;
  }

  /* ================= SALARY ================= */
  function salaryRows(month) { return activeStaff().map(s => ({ account: s, calc: data.calcFor(s, month) })); }
  function salaryTab() {
    const month = ui.salaryMonth, rows = salaryRows(month), sum = k => rows.reduce((n, r) => n + Number(r.calc[k] || 0), 0);
    const def = S.config.salaryDefault || {}, onDefault = rows.filter(r => r.calc.useDefault).length;
    return `<div class="toolbar"><h1 class="page-title">Salary</h1><div class="btn-row"><button type="button" class="btn btn-ink" data-action="pdf-salary">${icon('pdf', 18)} Salary sheet</button><button type="button" class="btn btn-ink" data-action="excel" data-arg="${month}">${icon('down', 18)} Excel</button><button type="button" class="btn btn-ink" data-action="pdf-slips">${icon('share', 18)} Sab ki slips</button></div></div>
      <div class="datebar">
        <button type="button" class="icon-btn" data-action="sal-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button>
        <label class="date-pick"><span>${esc(monthLabel(month))}</span><input type="month" value="${month}" max="${pkDate().slice(0, 7)}" data-change="pick-salary-month" aria-label="Mahina chunein"></label>
        <button type="button" class="icon-btn" data-action="sal-step" data-arg="1" aria-label="Agla mahina" ${month >= pkDate().slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button>
      </div>
      <section class="totals"><div><small>Kul banti salary</small><b>${money(sum('final'))}</b></div><div><small>Ada ho chuki</small><b class="txt-ok">${money(sum('paid'))}</b></div><div><small>Baqi</small><b class="txt-bad">${money(sum('balance'))}</b></div></section>
      <button type="button" class="rule-card" data-action="settings" data-arg="salary">${icon('wallet', 20)}<span><b>Default salary: ${def.monthlySalary ? money(def.monthlySalary) : 'abhi likhi nahi'}</b><small>${onDefault}/${rows.length} staff default par &nbsp;|&nbsp; Hisab: ${def.mode === 'days' ? 'din ke mutabiq (ghair hazir din kat-ta hai)' : 'ghanton ke mutabiq'}${Number(def.lateEvery) ? ` &nbsp;|&nbsp; Har ${def.lateEvery} late par ${def.lateFineDays ?? 0.5} din kati` : ''}</small></span>${icon('right', 18)}</button>
      <section class="panel">${loadingNote(month)}
        <ol class="register">${rows.map(({ account: s, calc }) => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${s.phone}">
          ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${calc.useDefault ? 'Default' : 'Apni'} ${money(calc.monthlySalary)} &nbsp;|&nbsp; ${calc.daysWorked} din${calc.absentDays ? ' &nbsp;|&nbsp; ' + calc.absentDays + ' ghair hazir' : ''}${calc.deductions ? ' &nbsp;|&nbsp; Kati ' + money(calc.deductions) : ''}${calc.openDays ? ` &nbsp;|&nbsp; <b class="txt-bad">${calc.openDays} Check-Out baqi</b>` : ''}</small></span>
          <span class="amount"><b>${money(calc.final)}</b><small class="${calc.balance > 0.5 ? 'txt-bad' : 'txt-ok'}">${calc.frozen ? (calc.balance > 0.5 ? 'Baqi ' + money(calc.balance) : 'Poori ada') : 'Andaza'}</small></span>
        </button></li>`).join('')}</ol>
        ${rows.length ? '' : '<p class="empty-line">Abhi koi staff nahi.</p>'}
        ${rows.some(r => !r.calc.monthlySalary) ? '<p class="hint">Jin ki salary Rs 0 aa rahi hai: upar "Default salary" daba kar raqam likhein, ya staff ke naam par ja kar apni salary likhein.</p>' : ''}
      </section>
      <button type="button" class="rule-card" data-action="khata">${icon('book', 20)}<span><b>Advance / qarz ka khata</b><small>Kis ka kitna qarz baqi hai, har mahine kitni qist</small></span>${icon('right', 18)}</button>`;
  }
  function salarySheet(phone) {
    return openSheet({
      id: 'salary', wide: true, title: 'Salary',
      render(sheet) {
        const s = account(phone); if (!s) return '<p class="empty-line">Staff nahi mila.</p>';
        const month = ui.salaryMonth, c = data.calcFor(s, month);
        sheet.setTitle(`${nameHtml(s.name)} <small>${esc(monthLabel(month))}</small>`);
        const line = (label, value, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${value}</td></tr>`;
        return `${loadingNote(month)}
          <div class="pill-row"><span class="stamp ${c.frozen ? 'st-present' : 'st-waiting'}">${c.frozen ? 'Final' : 'Andaza (final nahi)'}</span>${c.openDays ? `<span class="stamp st-absent">${c.openDays} Check-Out baqi</span>` : ''}</div>
          <table class="calc"><tbody>
            ${line('Mahana salary (tay shuda)', money(c.monthlySalary))}
            ${c.mode === 'days'
              ? line(`Ghair hazir <small>${c.absentDays} din × ${money(c.perDay)}/din</small>`, '− ' + money(c.absentCut), c.absentCut ? 'txt-bad' : '') + line('Hazri ke mutabiq salary', money(c.normalSalary))
              : line(`Aam ghante <small>${hm(c.normalMin)} × ${money(c.hourly)}/ghanta</small>`, money(c.normalSalary))}
            ${line(`Overtime <small>${hm(c.otMin)} × ${money(c.otRate)}/ghanta</small>`, '+ ' + money(c.overtimeAmount))}
            ${c.pointsAmount ? line(`Points <small>${c.points} × ${money(c.pointRate)}</small>`, '+ ' + money(c.pointsAmount)) : ''}
            ${c.mealSalary ? line(`Khana <small>${c.mealMode === 'daily' ? c.mealDays + ' din' : 'mahana'}</small>`, '+ ' + money(c.mealSalary)) : ''}
            ${c.bonus ? line('Bonus', '+ ' + money(c.bonus)) : ''}
            ${c.advance ? line('Advance (kat gaya)', '− ' + money(c.advance), 'txt-bad') : ''}
            ${c.loanCut ? line(`Qarz ki qist <small>${(c.loans || []).filter(l => l.cut).map(l => 'baqi ' + money(l.remainingAfter)).join(', ')}</small>`, '− ' + money(c.loanCut), 'txt-bad') : ''}
            ${c.lateFine ? line(`Late jurmana <small>${c.lateCount} dafa late</small>`, '− ' + money(c.lateFine), 'txt-bad') : ''}
            ${c.outCut ? line(`Bahar ka waqt <small>${c.outCount} parchi · ${hm(c.outMin)}</small>`, '− ' + money(c.outCut), 'txt-bad') : c.outMin ? line(`Bahar ka waqt <small>${c.outCount} parchi · ${hm(c.outMin)} (kati band hai)</small>`, '—') : ''}
            ${(c.ticketLines || []).map(t => line(esc(t.text.replace(/ — Rs [\d,]+$/, '')), '− ' + money(t.amount), 'txt-bad')).join('')}
            ${(c.leaveLines || []).map(l => line(`${esc(l.text)} <small>paisa katega</small>`, '− ' + money(l.amount), 'txt-bad')).join('')}
            ${c.leavePay ? line(`Chutti ki salary <small>${c.paidLeaveUnits} din · paisa nahi katega</small>`, '+ ' + money(c.leavePay)) : ''}
            ${c.breakCut ? line(`Khane ka break <small>${c.breakCount} dafa · ${hm(c.breakMin)}</small>`, '− ' + money(c.breakCut), 'txt-bad') : ''}
            ${line('Kul banti salary', money(c.final), 'is-total')}
            ${line('Ada ho chuki', money(c.paid))}
            ${line('Baqi', money(c.balance), 'is-balance')}
          </tbody></table>
          ${c.mealTotal && !c.mealSalary ? `<p class="hint">Khana ${money(c.mealTotal)} alag diya jata hai (salary mein shamil nahi).</p>` : ''}
          <div class="btn-row">
            <button type="button" class="btn btn-ink" data-action="pdf-staff" data-phone="${phone}" data-month="${month}">${icon('pdf', 18)} PDF</button>
            <button type="button" class="btn ${c.frozen ? 'btn-ghost' : 'btn-primary'}" data-action="final" data-phone="${phone}">${c.frozen ? 'Dobara kholein' : 'Final karein'}</button>
            <button type="button" class="btn btn-ghost" data-action="staff-edit" data-phone="${phone}">Salary settings</button>
          </div>
          <h3 class="sub">Advance / bonus / qarz</h3>
          <ul class="ledger">${(c.loans || []).map(l => `<li><span><b>Qarz</b> <small>${esc(monthLabel(l.month))} se · kul ${money(l.amount)} · qist ${money(l.perMonth)} · baqi ${money(l.remainingAfter)}</small></span><span>${money(l.cut)}${c.frozen ? '' : ` <button type="button" class="link-bad" data-action="extra-del" data-phone="${phone}" data-id="${esc(l.id)}">Hatayein</button>`}</span></li>`).join('')}${(c.extras || []).map(x => `<li><span><b>${x.kind === 'advance' ? 'Advance' : 'Bonus'}</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}${c.frozen ? '' : ` <button type="button" class="link-bad" data-action="extra-del" data-phone="${phone}" data-id="${esc(x.id)}">Hatayein</button>`}</span></li>`).join('') || ((c.loans || []).length ? '' : '<li class="muted">Is mahine koi entry nahi.</li>')}</ul>
          ${c.frozen ? '' : `<form class="inline-form" data-form="extra" data-phone="${phone}">
            <select name="kind" aria-label="Qisam" data-change="extra-kind"><option value="advance">Advance (isi mahine kategi)</option><option value="loan">Qarz (qiston mein)</option><option value="bonus">Bonus</option></select>
            <input name="amount" type="number" inputmode="numeric" min="1" placeholder="Raqam" required aria-label="Raqam">
            <input name="perMonth" type="number" inputmode="numeric" min="1" placeholder="Har mahine qist (Rs)" aria-label="Har mahine qist" hidden>
            <input name="date" type="date" value="${pkDate()}" max="${pkDate()}" aria-label="Tareekh">
            <input name="note" placeholder="Note (ikhtiyari)" maxlength="120" aria-label="Note">
            <button class="btn btn-primary">Likh dein</button></form>`}
          <h3 class="sub">Salary ki adaigi</h3>
          <ul class="ledger">${(c.payments || []).map(x => `<li><span><b>Salary di</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}</span></li>`).join('') || '<li class="muted">Abhi koi payment nahi.</li>'}</ul>
          ${c.frozen ? (c.balance > 0.5 ? `<form class="inline-form" data-form="payment" data-phone="${phone}">
            <input name="amount" type="number" inputmode="numeric" min="1" max="${Math.ceil(c.balance)}" value="${Math.round(c.balance)}" required aria-label="Raqam">
            <input name="date" type="date" value="${pkDate()}" max="${pkDate()}" required aria-label="Tareekh">
            <input name="note" placeholder="Note (cash / bank)" maxlength="120" aria-label="Note">
            <button class="btn btn-primary">Payment likhein</button></form>` : '<p class="hint txt-ok">Is mahine ki poori salary ada ho chuki hai.</p>')
            : '<p class="hint">Payment likhne ke liye pehle mahina "Final karein".</p>'}`;
      }
    });
  }

  /* ================= STAFF ================= */
  function staffTab() {
    const q = ui.staffQuery.trim().toLowerCase();
    const list = S.staff.filter(s => (ui.showInactive || s.active !== false) && (!q || `${s.name} ${s.phone} ${s.role || ''}`.toLowerCase().includes(q)));
    const inactive = S.staff.filter(s => s.active === false).length, pend = pending().length;
    return `<div class="toolbar"><h1 class="page-title">Staff <small>${activeStaff().length}</small></h1><button type="button" class="btn btn-primary" data-action="staff-new">${icon('plus', 18)} Naya staff</button></div>
      <div class="search-inline">${icon('search', 18)}<input type="search" placeholder="Naam ya number" value="${esc(ui.staffQuery)}" data-input="staff-query" aria-label="Staff talash"></div>
      <section class="panel"><ol class="register">${list.map(s => `<li class="row${s.active === false ? ' is-off' : ''}" data-search="${esc(`${s.name} ${s.phone} ${s.role || ''}`.toLowerCase())}"><button type="button" class="row-main" data-action="staff-edit" data-phone="${s.phone}">
        ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')} &nbsp;|&nbsp; ${esc(s.phone)}</small><span class="tags inline"><span class="tag">${icon('clock', 14)} ${esc(dutyText(data.scheduleFor(s.phone)))}</span><span class="tag">${usesDefaultSalary(s) ? 'Default salary' : 'Apni salary ' + money(data.salaryFor(s).monthlySalary)}</span>${s.canApproveOuts ? '<span class="tag t-ink">Manager</span>' : ''}${s.canTicket ? '<span class="tag t-ink">Senior</span>' : ''}</span></span>
        <span class="stamp ${s.active === false ? 'st-off' : s.loginEnabled === false ? 'st-absent' : 'st-present'}">${s.active === false ? 'Band' : s.loginEnabled === false ? 'Login band' : 'Chalu'}</span></button></li>`).join('')}</ol>
        <p class="empty-line" id="staffEmpty" ${list.length ? 'hidden' : ''}>Koi staff nahi mila.</p>
        ${inactive ? `<button type="button" class="link" data-action="toggle-inactive">${ui.showInactive ? 'Band kiye hue chhupayein' : `Band kiye hue bhi dikhayein (${inactive})`}</button>` : ''}
      </section>
      <button type="button" class="rule-card" data-action="tab" data-arg="settings">${icon('clock', 20)}<span><b>Duty, salary aur baqi settings</b><small>Neeche "Settings" tab mein</small></span>${icon('right', 18)}</button>`;
  }
  function settingsTab() {
    const pend = pending().length, d = S.config.salaryDefault || {}, fixes = selfieFix();
    const tool = (action, ic, title, text = '', extra = '') => `<button type="button" class="tool${extra}" data-action="${action}">${icon(ic)}<span><b>${title}</b>${text ? `<small>${text}</small>` : ''}</span>${action === 'requests' && pend ? `<em class="badge">${pend}</em>` : icon('right', 18)}</button>`;
    return `<div class="toolbar"><h1 class="page-title">Settings</h1></div>
      <h2 class="section-label">Rozana ka kaam</h2>
      <section class="panel tools">
        ${tool('requests', 'note', 'Chutti / correction ki requests', pend ? pend + ' ka jawab baqi' : 'Koi nayi request nahi')}
        ${tool('notify', 'share', 'Notifications (app band ho tab bhi)', S.config.notify?.on ? 'Chalu — ntfy app mein aati hain' : 'Band — chalu karein')}
        ${tool('tickets', 'alert', 'Bina bataye gaya — tickets', (() => { const n = S.tickets.filter(t => t.status !== 'decided').length; return n ? n + ' ka faisla baqi' : 'Maaf / warning / katauti'; })())}
        ${tool('outs', 'out', 'Bahar jane ki parchiyan', (() => { const n = S.outs.filter(o => o.status === 'pending').length, b = S.outs.filter(o => o.status === 'approved').length; return n ? n + ' ka jawab baqi' : b ? b + ' abhi bahar' : 'Aaj ki parchiyan'; })())}
        ${tool('history', 'edit', 'Tabdeeli ki history', 'Kis ki hazri / salary kab aur kyun badli')}
        ${tool('khata', 'book', 'Advance / qarz ka khata', 'Kis ka kitna qarz baqi')}
      </section>
      <h2 class="section-label">Qawaid (sab staff par)</h2>
      <section class="panel tools">
        ${tool('cfg-duty', 'clock', 'Duty ka waqt', esc(dutyText(resolveBase())) + ' &nbsp;|&nbsp; riayat ' + Number(S.config.grace ?? 10) + ' min' + (nightShift(S.config) ? ' &nbsp;|&nbsp; <b class="txt-bad">ghalat lag raha hai</b>' : ''))}
        ${tool('cfg-salary', 'wallet', 'Salary ke qawaid', (d.monthlySalary ? 'Default ' + money(d.monthlySalary) : 'Default salary likhi nahi') + ' &nbsp;|&nbsp; ' + (d.mode === 'days' ? 'din ke mutabiq' : 'ghanton ke mutabiq'))}
        ${tool('cfg-checkin', 'pin', 'Check-In ki had aur hidayat', Number(S.config.radius || SHOP.radius) + 'm dukaan se' + (S.config.instruction ? ' &nbsp;|&nbsp; hidayat likhi hai' : ''))}
      </section>
      <h2 class="section-label">App</h2>
      <section class="panel tools">
        ${install && !install.standalone ? tool('install', 'down', 'App home screen par lagayein', 'Icon se seedha khule') : ''}
        ${tool('links', 'share', 'Update ke links', 'GitHub upload · Firebase rules')}
        ${tool('update', 'down', 'App update check karein', 'Abhi ' + APP_VERSION + (S.bootMs ? ` · ${(S.bootMs / 1000).toFixed(1)}s mein khuli` : ''))}
        ${fixes && !manager ? tool('migrate-selfies', 'camera', 'App ko halka karein (aik dafa)', 'Purani selfies alag karein — hazri list tez khulegi') : ''}
        ${manager ? '' : tool('cameras', 'camera', 'Cameras', camToolText())}
        ${tool('phones', 'phone', 'Phones ki jaanch', 'Kis phone par kaunsi app · kis ki hazri server tak nahi gayi')}
        ${tool('diag', 'alert', 'App ki jaanch', 'Hazri na dikhe to is ka screenshot bhejein')}
        ${manager ? '' : tool('password', 'edit', 'Malik ka password badlein')}
        ${tool('logout', 'out', 'Logout', '', ' tone-bad')}
      </section>`;
  }
  const appUrl = () => { const l = window.location; return (l.origin || '') + (l.pathname || '/').replace(/index\.html$/, ''); };
  const loginLink = phone => `${appUrl()}#login=${phone}`;
  function waLink(s) {
    const intl = '92' + String(s.phone).replace(/^0/, '');
    const text = `Assalam o Alaikum ${s.name || ''}\nNoor Traders hazri app ka aap ka link:\n${loginLink(s.phone)}\n\n1) Link dabayein — app khud login ho jayegi.\n2) Phir "Install karein" / Chrome ⋮ > "Add to Home screen" dabayein.\n3) Aage se home screen wale icon se hi kholein.`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }
  function staffForm(phone) {
    const s = phone ? account(phone) : null, cfg = salaryConfig(s || {}, S.config), own = phone ? S.schedules.get(phone) : null, sch = data.scheduleFor(phone || '');
    let photo = s?.photo || '';
    const sheet = openSheet({
      id: 'staff-form', wide: true, title: s ? 'Staff ki maloomat' : 'Naya staff',
      render: () => `<form class="form" data-form="staff" data-phone="${esc(phone || '')}" novalidate>
        <div class="photo-pick"><span id="photoPreview">${avatar({ name: s?.name || '?', photo }, 'lg')}</span><label class="btn btn-ghost btn-sm">Tasveer chunein<input type="file" accept="image/*" hidden data-change="staff-photo"></label></div>
        <label>Naam<input name="name" value="${esc(s?.name || '')}" required autocomplete="off"></label>
        <label>Mobile number ${s ? '<small>(badal nahi sakta — hazri isi par hai)</small>' : '<small>(yehi staff ka login hai)</small>'}<input name="phone" type="tel" inputmode="numeric" value="${esc(s?.phone || '')}" placeholder="03001234567" ${s ? 'readonly' : 'required'}></label>
        <div class="two"><label>Kaam<input name="role" value="${esc(s?.role || '')}" placeholder="Salesman / Helper"></label><label>Kaam shuru kiya<input name="joinDate" type="date" value="${esc(s?.joinDate || (s ? '' : pkDate()))}" max="${pkDate()}"></label></div>
        <label>Pata<input name="address" value="${esc(s?.address || '')}"></label>
        <fieldset><legend>Duty ka waqt</legend>
          <label class="check"><input type="checkbox" name="useDefaultShift" ${!own || own.useDefaultShift !== false ? 'checked' : ''} data-change="toggle-box" data-arg="ownShift" data-invert="1"> Default duty (${esc(dutyText(resolveBase()))})</label>
          <div id="ownShift" class="sub-box" ${!own || own.useDefaultShift !== false ? 'hidden' : ''}>
            ${timeField('shiftStart', to24(sch.shiftStart) || '09:15', { label: 'Duty shuru', tickets: IN_TICKETS, guess: 'in' })}
            ${timeField('shiftEnd', to24(sch.shiftEnd) || '19:00', { label: 'Duty khatam', tickets: OUT_TICKETS, guess: 'out' })}
            <label>Late ki riayat (minute)<input name="grace" type="number" inputmode="numeric" min="0" max="120" value="${Number(sch.grace ?? 10)}"></label>
          </div>
          <label>Hafta-war chutti<select name="weeklyOff"><option value="">Koi nahi</option>${['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'].map((d, i) => `<option value="${i}" ${(own?.weeklyOff || []).map(Number).includes(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        </fieldset>
        <fieldset><legend>Salary</legend>
          <label class="check"><input type="checkbox" name="useDefaultSalary" ${!s || usesDefaultSalary(s) ? 'checked' : ''} data-change="toggle-box" data-arg="ownSalary" data-invert="1"> Default salary (${S.config.salaryDefault?.monthlySalary ? money(S.config.salaryDefault.monthlySalary) : 'Settings mein likhein'})</label>
          <div id="ownSalary" class="sub-box" ${!s || usesDefaultSalary(s) ? 'hidden' : ''}>
            <label>Is staff ki mahana salary (Rs)<input name="monthlySalary" type="number" inputmode="numeric" min="0" value="${Number(s?.salary?.monthlySalary) || ''}" placeholder="30000"></label>
            <div class="two"><label>Roz ke ghante<input name="dutyHours" type="number" inputmode="decimal" min="1" max="16" step="0.5" value="${Number(s?.salary?.dutyHours) || 10}"></label><label>Mahine ke din<input name="workingDays" type="number" inputmode="numeric" min="1" max="31" value="${Number(s?.salary?.workingDays) || 30}"></label></div>
            <label>Overtime rate (Rs/ghanta) <small>khali = aam rate</small><input name="overtimeRate" type="number" inputmode="numeric" min="0" value="${Number(s?.salary?.overtimeRate) || ''}"></label>
          </div>
          <div class="two"><label>Khane ke paise<select name="mealMode"><option value="none" ${cfg.mealMode === 'none' ? 'selected' : ''}>Nahi</option><option value="daily" ${cfg.mealMode === 'daily' ? 'selected' : ''}>Rozana</option><option value="monthly" ${cfg.mealMode === 'monthly' ? 'selected' : ''}>Mahana</option></select></label><label>Raqam (Rs)<input name="mealRate" type="number" inputmode="numeric" min="0" value="${cfg.mealRate || ''}"></label></div>
          <label class="check"><input type="checkbox" name="mealInSalary" ${cfg.mealInSalary ? 'checked' : ''}> Khane ke paise salary mein jorein</label>
          <details><summary>Points ka rate (agar dete hain)</summary><label>1 point = Rs<input name="pointRate" type="number" inputmode="decimal" min="0" step="0.5" value="${Number(s?.salary?.pointRate) || ''}"></label><p class="hint">Waqt par aane ke points hazri ke sath khud bante hain. Rate 0 ho to salary par asar nahi.</p></details>
        </fieldset>
        <fieldset><legend>Ijazat</legend>
          <label>Khane ki bari<select name="breakGroup"><option value="1" ${breakGroup(s || {}) === 1 ? 'selected' : ''}>Pehli bari</option><option value="2" ${breakGroup(s || {}) === 2 ? 'selected' : ''}>Doosri bari (pehle walon ki jagah dukaan sambhale)</option></select></label>
          <label class="check"><input type="checkbox" name="canTicket" ${s?.canTicket ? 'checked' : ''}> Ye <b>senior</b> hai — "bina bataye gaya" ka ticket bana sakta hai (faisla sirf malik)</label>
          <label class="check"><input type="checkbox" name="canApproveOuts" ${s?.canApproveOuts ? 'checked' : ''}> Ye <b>manager</b> hai — doosron ki bahar jane ki parchi Haan / Nahi kar sakta hai (apni nahi)</label>
          <label class="check"><input type="checkbox" name="loginEnabled" ${s?.loginEnabled === false ? '' : 'checked'}> Staff apne number se login kar sakta hai</label>
          <label class="check"><input type="checkbox" name="active" ${s?.active === false ? '' : 'checked'}> Kaam par hai (hata dein to list se chhup jata hai, hazri mehfooz rehti hai)</label>
        </fieldset>
        ${s ? `<div class="link-box"><b>Login link</b><small>Larke ko WhatsApp par bhejein. Link dabate hi app khud login ho jayegi — number likhna nahi padega.</small>
          <div class="btn-row"><a class="btn btn-in btn-sm" href="${esc(waLink(s))}" target="_blank" rel="noopener">${icon('share', 16)} WhatsApp par bhejein</a><button type="button" class="btn btn-ghost btn-sm" data-action="copy-link" data-phone="${esc(s.phone)}">Link copy karein</button></div></div>` : ''}
        <div class="btn-row sticky"><button class="btn btn-primary btn-lg">${s ? 'Save karein' : 'Staff shamil karein'}</button>${s ? `<button type="button" class="btn btn-ghost" data-action="staff-delete" data-phone="${phone}">Delete</button>` : ''}</div>
      </form>`
    });
    sheet.getPhoto = () => photo; sheet.setPhoto = v => { photo = v; $('#photoPreview', sheet.el).innerHTML = avatar({ name: '?', photo }, 'lg'); };
    return sheet;
  }

  /* ================= SHEETS: profile, hazri edit, chutti, requests, settings ================= */
  function profileSheet(phone, date) {
    let month = (date || pkDate()).slice(0, 7);
    data.watchMonth(month);
    const sheet = openSheet({
      id: 'profile', wide: true, title: 'Staff',
      render(sh) {
        const s = account(phone); if (!s) return '<p class="empty-line">Staff nahi mila.</p>';
        const sum = summaryFor(s, month), sch = data.scheduleFor(phone), calc = data.calcFor(s, month), today = pkDate();
        sh.setTitle(nameHtml(s.name));
        const leaves = S.requests.filter(r => r.phone === phone && r.kind === 'leave' && r.status === 'approved' && r.to >= month + '-01' && r.date <= month + '-31');
        return `<div class="profile-head">${avatar(s, 'lg')}<div><p class="muted">${esc(s.role || 'Staff')} &nbsp;|&nbsp; Duty ${fmtTime(sch.shiftStart)}${sch.shiftEnd ? ' – ' + fmtTime(sch.shiftEnd) : ''}</p><a class="link" href="tel:${esc(s.phone)}">${icon('phone', 16)} ${esc(s.phone)}</a></div></div>
          <div class="datebar"><button type="button" class="icon-btn" data-action="profile-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button><span class="date-static">${esc(monthLabel(month))}</span><button type="button" class="icon-btn" data-action="profile-step" data-arg="1" aria-label="Agla mahina" ${month >= today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div>
          ${loadingNote(month)}
          <div class="counts"><div class="st-present"><b>${sum.count.present + sum.count.late}</b><small>Hazir</small></div><div class="st-late"><b>${sum.count.late}</b><small>Late</small></div><div class="st-absent"><b>${sum.count.absent}</b><small>Ghair hazir</small></div><div class="st-leave"><b>${sum.count.leave + sum.count.off}</b><small>Chutti</small></div><div><b>${hm(sum.totalMin)}</b><small>Ghante</small></div></div>
          <div class="btn-row">
            <button type="button" class="btn btn-ink" data-action="pdf-staff" data-phone="${phone}" data-month="${month}">${icon('pdf', 18)} PDF</button>
            <button type="button" class="btn btn-ghost" data-action="edit-att" data-phone="${phone}" data-date="${month === today.slice(0, 7) ? today : month + '-01'}">Hazri lagayein</button>
            <button type="button" class="btn btn-ghost" data-action="leave" data-phone="${phone}">Chutti dein</button>
            <button type="button" class="btn btn-ghost" data-action="salary" data-phone="${phone}" data-month="${month}">Salary ${money(calc.final)}</button>
          </div>
          ${leaves.length ? `<ul class="ledger">${leaves.map(r => `<li><span><b>${r.half ? 'Aadhi chutti' : 'Chutti'}</b> <small>${leaveDesc(r)} · ${paidDesc(r)} · ${esc(r.reason || '')}</small></span><button type="button" class="link-bad" data-action="leave-cancel" data-id="${esc(r.id)}">Cancel</button></li>`).join('')}</ul>` : ''}
          <ol class="days">${sum.days.filter(d => d.status !== 'na').reverse().map(d => `<li class="s-${d.status}"><button type="button" data-action="edit-att" data-phone="${phone}" data-date="${d.date}">
            <span class="d-date"><b>${+d.date.slice(8)}</b><small>${DAY_SHORT[weekday(d.date)]}</small></span>
            <span class="d-time">${d.a.checkIn ? `${fmtTime(d.a.checkIn)} <span class="arrow">to</span> ${d.a.checkOut ? fmtTime(d.a.checkOut) : '<b class="txt-bad">baqi</b>'}` : '<span class="muted">—</span>'}${d.minutes != null ? `<small>${hm(d.minutes)}</small>` : ''}</span>
            <span class="stamp st-${d.status}">${d.status === 'late' ? 'Late ' + d.late + 'm' : STATUS_LABEL[d.status]}</span></button></li>`).join('')}</ol>`;
      }
    });
    sheet.step = n => { const next = addMonths(month, n); if (next > pkDate().slice(0, 7)) return; month = next; data.watchMonth(month); sheet.refresh(true); };
    return sheet;
  }
  // Selfie sirf yahan (daba kar) load hoti hai — list halki rehti hai
  const selfies = new Map();
  function selfieImg(a) {
    const url = a.selfie || selfies.get(a.id);
    if (url) return `<img src="${esc(url)}" alt="Check-In ki selfie">`;
    if (url === '') return '<span class="selfie-wait">Selfie nahi mili</span>';
    queueMicrotask(() => data.getSelfie(a).then(u => { selfies.set(a.id, u || ''); const box = [...document.querySelectorAll('[data-selfie]')].find(el => el.dataset.selfie === a.id); if (box) box.firstElementChild.outerHTML = u ? `<img src="${esc(u)}" alt="Check-In ki selfie">` : '<span class="selfie-wait">Selfie nahi mili</span>'; }).catch(() => { /* internet */ }));
    return '<span class="selfie-wait">Selfie load ho rahi…</span>';
  }
  function gapNote(a) {
    const g = serverGap(a);
    return g != null && Math.abs(g) >= 10 ? `<br><b class="txt-bad">Server par ${fmtTime(to24FromMin(parseTime(a.checkIn) + g))} pohanchi (${Math.abs(g)} min farq) — phone ki ghari ya internet</b>` : '';
  }
  function attendanceSheet(phone, date) {
    data.watchMonth(date.slice(0, 7));
    return openSheet({
      id: 'att', title: 'Hazri durust karein',
      render(sh) {
        const s = account(phone) || { name: phone }, a = data.attendanceBetween(date, date).find(x => x.phone === phone) || {}, sch = data.scheduleFor(phone);
        sh.setTitle(`${nameHtml(s.name)} <small>${esc(dateLabel(date))}</small>`);
        return `<form class="form" data-form="att" data-phone="${phone}" data-id="${esc(a.id || '')}">
          ${manager ? `<p class="notice">${icon('alert', 18)} <span>Aap sirf dekh sakte hain. Hazri lagana ya badalna malik ka kaam hai.</span></p>` : ''}
          ${a.selfie || a.hasSelfie ? `<div class="proof" data-selfie="${esc(a.id)}">${selfieImg(a)}<p>${icon('pin', 16)} Dukaan se ${a.checkInDistance != null ? Math.round(a.checkInDistance) + 'm' : '—'}<br><small>Selfie Check-In ke waqt li gayi</small>${gapNote(a)}</p></div>` : gapNote(a) ? `<p class="hint">${gapNote(a)}</p>` : ''}
          <label>Tareekh<input name="date" type="date" value="${date}" max="${pkDate()}" required ${a.id ? 'readonly' : ''}></label>
          ${timeField('checkIn', to24(a.checkIn), { label: 'Aaya', tickets: [to24(sch.shiftStart), ...IN_TICKETS].sort(), now: date === pkDate(), guess: 'in' })}
          ${timeField('checkOut', to24(a.checkOut), { label: 'Gaya', tickets: [...OUT_TICKETS, to24(sch.shiftEnd)].sort(), optional: true, now: date === pkDate(), guess: 'out' })}
          <label>Note <small>(kyun badla)</small><input name="note" value="${esc(a.ownerNote || '')}" maxlength="200"></label>
          <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button>${a.id ? `<button type="button" class="btn btn-ghost" data-action="att-delete" data-id="${esc(a.id)}">Hazri hatayein</button>` : ''}</div>
        </form>`;
      }
    });
  }
  const HALF = { am: 'aadha din — subah', pm: 'aadha din — shaam' };
  const leaveDesc = r => `${esc(shortDate(r.date))}${r.to && r.to !== r.date ? ' – ' + esc(shortDate(r.to)) : ''}${r.half ? ' (' + HALF[r.half] + ')' : ''}`;
  const paidDesc = r => r.status !== 'approved' ? '' : (typeof r.paid === 'boolean' ? r.paid : (S.config.salaryDefault?.leavePaid !== false)) ? 'paisa nahi katega' : 'paisa katega';
  function leaveSheet(phone) {
    const defPaid = S.config.salaryDefault?.leavePaid !== false;
    return openSheet({ id: 'leave', title: 'Chutti dein', render: () => `<form class="form" data-form="leave" data-phone="${phone}">
      <fieldset><legend>Kitni chutti?</legend>
        <label class="check"><input type="radio" name="half" value="" checked data-change="leave-half"> Poora din (ya kai din)</label>
        <label class="check"><input type="radio" name="half" value="am" data-change="leave-half"> Aadha din — subah ki chutti (der se aayega)</label>
        <label class="check"><input type="radio" name="half" value="pm" data-change="leave-half"> Aadha din — shaam ki chutti (jaldi jayega)</label></fieldset>
      <div class="two"><label>Kab se<input name="date" type="date" value="${pkDate()}" required></label><label id="leaveTo">Kab tak<input name="to" type="date" value="${pkDate()}" required></label></div>
      <fieldset><legend>Salary</legend>
        <label class="check"><input type="radio" name="paid" value="yes" ${defPaid ? 'checked' : ''}> Paisa <b>nahi</b> katega</label>
        <label class="check"><input type="radio" name="paid" value="no" ${defPaid ? '' : 'checked'}> Paisa <b>katega</b></label></fieldset>
      <label>Wajah<input name="reason" maxlength="200" placeholder="Bimari / ghar ka kaam"></label>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Chutti laga dein</button></div></form>` });
  }
  function requestsSheet() {
    return openSheet({
      id: 'requests', wide: true, title: 'Requests',
      render() {
        const list = S.requests.filter(r => r.kind !== 'suggestion').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const card = r => `<li class="req"><p><b>${nameHtml(account(r.phone)?.name || r.phone)}</b> <span class="stamp ${r.status === 'pending' ? 'st-late' : r.status === 'approved' ? 'st-present' : 'st-absent'}">${r.status === 'pending' ? 'Jawab baqi' : r.status === 'approved' ? 'Manzoor' : 'Na-manzoor'}</span></p>
          <p>${r.kind === 'leave' ? `Chutti: ${leaveDesc(r)}${paidDesc(r) ? ' · <b>' + paidDesc(r) + '</b>' : ''}` : r.via === 'outside' ? `<b>Dukaan se bahar Check-Out</b>: ${esc(shortDate(r.date))} &nbsp;|&nbsp; Gaya ${fmtTime(r.checkOut)}` : `Hazri durust: ${esc(shortDate(r.date))} &nbsp;|&nbsp; Aaya ${fmtTime(r.checkIn)} &nbsp;|&nbsp; Gaya ${fmtTime(r.checkOut)}`}</p>
          ${r.via === 'outside' ? `<p class="co-where">${r.distance != null ? `<span class="tag t-late">${icon('pin', 14)} Dukaan se ${esc(kmText(r.distance))} door${r.accuracy ? ' (±' + esc(String(r.accuracy)) + ' m)' : ''}</span> <a class="link" href="https://www.google.com/maps?q=${encodeURIComponent(r.lat + ',' + r.lng)}" target="_blank" rel="noopener">Naqsha dekhein</a>` : `<span class="tag t-bad">${icon('pin', 14)} Location nahi mili${r.gpsError ? ': ' + esc(r.gpsError) : ''}</span>`}</p>${r.status === 'pending' ? `<p class="hint">Manzoor karne par Check-Out <b>${fmtTime(r.checkOut)}</b> lagega.</p>` : ''}` : ''}
          <p class="muted">${nameHtml(r.reason || '')}</p>${r.ownerNote ? `<p class="muted">Malik: ${esc(r.ownerNote)}</p>` : ''}
          ${r.status === 'pending' ? (r.kind === 'leave'
            ? `<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="approved" data-paid="yes">Manzoor — paisa nahi katega</button><button type="button" class="btn btn-ink btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="approved" data-paid="no">Manzoor — paisa katega</button><button type="button" class="btn btn-ghost btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="rejected">Na-manzoor</button></div>`
            : `<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="approved">Manzoor</button><button type="button" class="btn btn-ghost btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="rejected">Na-manzoor</button></div>`) : ''}</li>`;
        const open = list.filter(r => r.status === 'pending'), rest = list.filter(r => r.status !== 'pending').slice(0, 30);
        return `<ul class="reqs">${open.map(card).join('') || '<li class="muted">Koi nayi request nahi.</li>'}</ul>${rest.length ? `<details><summary>Purani requests (${rest.length})</summary><ul class="reqs">${rest.map(card).join('')}</ul></details>` : ''}`;
      }
    });
  }
  const selfieFix = () => data.allAttendance().some(a => a.selfie);
  function dutySheet() {
    return openSheet({ id: 'cfg-duty', wide: true, title: 'Duty ka waqt (sab par)', render: () => {
      const c = S.config, customShift = activeStaff().filter(s => S.schedules.get(s.phone)?.useDefaultShift === false).length, hrs = shiftMinutes(resolveBase());
      return `<form class="form" data-form="cfg">
        ${nightShift(c) ? `<p class="error-line">${icon('alert', 18)} <span>Abhi <b>${esc(dutyText(resolveBase()))}</b> save hai — ye raat ki duty lag rahi hai. Neeche ticket se sahi waqt chunein.</span></p>` : ''}
        ${timeField('shiftStart', to24(c.shiftStart) || '09:15', { label: 'Aane ka waqt', tickets: IN_TICKETS, guess: 'in' })}
        ${timeField('shiftEnd', to24(c.shiftEnd) || '19:00', { label: 'Jane ka waqt', tickets: OUT_TICKETS, guess: 'out' })}
        <p class="hint">${hrs ? 'Duty: <b>' + hm(hrs) + '</b> roz. Isi se default salary ke ghante bante hain.' : 'Jane ka waqt chunein taake roz ke ghante khud ban jayein.'}</p>
        <label>Late ki riayat (minute) <small>is ke baad Late</small><input name="grace" type="number" inputmode="numeric" min="0" max="120" value="${Number(c.grace ?? 10)}"></label>
        <p class="hint">${customShift ? `${customShift} staff ki apni alag duty hai.` : 'Sab staff default duty par hain.'}</p>
        ${customShift ? '<button type="button" class="btn btn-ghost btn-sm" data-action="apply-shift-all">Sab par default duty lagayein</button>' : ''}
        <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button></div></form>`;
    } });
  }
  function salaryRulesSheet() {
    return openSheet({ id: 'cfg-salary', wide: true, title: 'Salary ke qawaid (sab par)', render: () => {
      const d = { ...(S.config.salaryDefault || {}) }, n = activeStaff().length, customSalary = activeStaff().filter(s => !usesDefaultSalary(s)).length;
      return `<form class="form" data-form="cfg">
        <label>Default mahana salary (Rs)<input name="defSalary" type="number" inputmode="numeric" min="0" value="${Number(d.monthlySalary) || ''}" placeholder="25000"></label>
        <div class="two"><label>Mahine ke din<input name="defDays" type="number" inputmode="numeric" min="1" max="31" value="${Number(d.workingDays) || 30}"></label><label>Overtime (Rs/ghanta) <small>khali = aam rate</small><input name="defOt" type="number" inputmode="numeric" min="0" value="${Number(d.overtimeRate) || ''}"></label></div>
        <label>Hisab kaise ho
          <select name="salaryMode"><option value="days" ${d.mode === 'days' ? 'selected' : ''}>Din ke mutabiq — poori salary, har ghair hazir din kat-ta hai</option><option value="hours" ${d.mode !== 'days' ? 'selected' : ''}>Ghanton ke mutabiq — jitne ghante kaam, utni salary</option></select></label>
        <label class="check"><input type="checkbox" name="leavePaid" ${d.leavePaid !== false ? 'checked' : ''}> Manzoor chutti ki salary nahi kategi</label>
        <div class="two"><label>Har kitne late par jurmana <small>0 = band</small><input name="lateEvery" type="number" inputmode="numeric" min="0" max="31" value="${Number(d.lateEvery) || 0}"></label><label>Jurmana (din ki salary)<input name="lateFineDays" type="number" inputmode="decimal" min="0" max="5" step="0.25" value="${d.lateFineDays ?? 0.5}"></label></div>
        <label class="check"><input type="checkbox" name="outDeduct" ${d.outDeduct ? 'checked' : ''}> Bahar jane ki parchi ka waqt salary se katein <small>(har ghanta = aik ghante ki salary)</small></label>
        <label class="check"><input type="checkbox" name="breakDeduct" ${d.breakDeduct ? 'checked' : ''}> Khane ke break ka waqt bhi salary se katein <small>(aam tor par nahi katta)</small></label>
        <p class="hint">Misal: 3 aur 0.5 = har 3 dafa late par aadhe din ki salary kategi. Mode aur jurmana sab staff par lagte hain. Final ho chuke mahine nahi badalte.</p>
        <p class="hint">${customSalary ? `${customSalary} staff ki apni salary hai (default nahi).` : n ? 'Sab staff default salary par hain.' : ''}</p>
        ${customSalary ? '<button type="button" class="btn btn-ghost btn-sm" data-action="apply-salary-all">Sab par default salary lagayein</button>' : ''}
        <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button></div></form>`;
    } });
  }
  function checkinSheet() {
    return openSheet({ id: 'cfg-checkin', title: 'Check-In ki had aur hidayat', render: () => {
      const c = S.config;
      return `<form class="form" data-form="cfg">
        <label>Check-In dukaan se kitni door tak (meter)<input name="radius" type="number" inputmode="numeric" min="20" max="5000" value="${Number(c.radius || SHOP.radius)}" required></label>
        <p class="hint">Dukaan ke andar GPS kabhi 50-100m tak ghalat hota hai. 200m theek rehta hai.</p>
        <label>Staff ke liye hidayat <small>(un ki screen par nazar aati hai)</small><textarea name="instruction" rows="3" maxlength="500">${esc(c.instruction || '')}</textarea></label>
        <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button></div></form>`;
    } });
  }
  function khataSheet() {
    return openSheet({ id: 'khata', wide: true, title: 'Advance / qarz ka khata', render: () => {
      const month = pkDate().slice(0, 7);
      const rows = activeStaff().map(s => {
        const extras = Array.isArray(s.salaryExtras) ? s.salaryExtras : [];
        const loans = loanCuts(extras, month), owed = loans.reduce((n, l) => n + l.remainingBefore, 0);
        const advThis = extras.filter(x => x.kind === 'advance' && x.month === month).reduce((n, x) => n + Number(x.amount || 0), 0);
        const advYear = extras.filter(x => x.kind === 'advance' && String(x.month).slice(0, 4) === month.slice(0, 4)).reduce((n, x) => n + Number(x.amount || 0), 0);
        return { s, loans, owed, advThis, advYear };
      }).filter(r => r.owed || r.advYear).sort((a, b) => b.owed - a.owed || b.advYear - a.advYear);
      return rows.length ? `<p class="hint">Advance usi mahine ki salary se kat-ta hai. Qarz har mahine qist mein kat-ta hai. Naya advance ya qarz staff ki salary mein likhein.</p>
        <ol class="register">${rows.map(r => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${r.s.phone}" data-month="${month}">${avatar(r.s)}<span class="row-text"><b>${nameHtml(r.s.name)}</b><small>Is mahine advance ${money(r.advThis)} &nbsp;|&nbsp; Is saal ${money(r.advYear)}${r.loans.filter(l => l.remainingBefore).map(l => ` &nbsp;|&nbsp; Qarz qist ${money(l.perMonth)}`).join('')}</small></span><span class="amount"><b class="${r.owed ? 'txt-bad' : ''}">${money(r.owed)}</b><small>qarz baqi</small></span></button></li>`).join('')}</ol>`
        : '<p class="empty-line">Kisi ka koi advance ya qarz nahi.</p>';
    } });
  }
  /** GitHub ka pata website ke address se: <user>.github.io/<repo>/  ->  github.com/<user>/<repo> */
  function repoInfo() {
    const host = location.hostname || '', seg = (location.pathname || '/').split('/').filter(Boolean)[0] || '';
    if (/\.github\.io$/i.test(host)) { const user = host.split('.')[0]; return { user, repo: seg && !/\.html?$/.test(seg) ? seg : host }; }
    return null;
  }
  function linksSheet() {
    return openSheet({ id: 'links', title: 'Update ke links', render: () => {
      const r = repoInfo(), gh = r ? `https://github.com/${r.user}/${r.repo}` : '', fb = `https://console.firebase.google.com/project/${data.projectId}`;
      const link = (href, title, text) => `<a class="tool link-card" href="${esc(href)}" target="_blank" rel="noopener">${icon('share')}<span><b>${title}</b><small>${text}</small></span>${icon('right', 18)}</a>`;
      return `<p class="hint">Naya update: zip ki saari files <b>GitHub upload</b> par daal kar "Commit changes" dabayein. 1-2 minute baad app khud nayi version le legi.</p>
        <div class="panel tools">
          ${gh ? link(gh + '/upload/main', '1. GitHub — files upload karein', esc(r.user + '/' + r.repo) + ' · main') : '<p class="hint pad">GitHub ka pata nahi mila (app github.io par nahi khuli).</p>'}
          ${gh ? link(gh + '/actions', '2. GitHub — deploy check karein', 'Hara nishan = nayi version live') : ''}
          ${gh ? link(gh, 'GitHub — poora repo', 'Files dekhna / purani file delete karna') : ''}
          ${gh ? link(gh + '/blob/main/firestore.rules', 'firestore.rules file (GitHub)', 'Rules copy karne ke liye') : ''}
          ${link(fb + '/firestore/rules', '3. Firebase — Firestore rules', 'Rules paste kar ke "Publish"')}
          ${link(fb + '/authentication/providers', 'Firebase — login ki settings', 'Anonymous aur Email/Password dono ON')}
          ${link(fb + '/firestore/databases/-default-/data', 'Firebase — data dekhein', 'Hazri ke records')}
        </div>
        <p class="hint">Is update (${esc(APP_VERSION)}) mein Firebase rules badalne ki zaroorat nahi.</p>`;
    } });
  }
  function selfiesDaySheet(date) {
    let pics = null, error = '';
    const sheet = openSheet({ id: 'selfies', wide: true, title: 'Selfies', render: sh => {
      sh.setTitle(`Selfies <small>${esc(dateLabel(date))}</small>`);
      const rows = rowsFor(date).filter(r => r.a.checkIn);
      if (error) return `<p class="error-line">${icon('alert', 18)} <span>${esc(error)}</span></p>`;
      if (!rows.length) return '<p class="empty-line">Is din kisi ne Check-In nahi kiya.</p>';
      return `<p class="hint">Baen taraf staff ki profile tasveer, daen taraf Check-In ki selfie. Chehra na mile to hazri khol kar durust karein.</p>
        <ul class="selfie-grid">${rows.map(r => {
          const pic = pics?.get(r.a.id), gap = serverGap(r.a);
          return `<li><button type="button" data-action="edit-att" data-phone="${r.account.phone}" data-date="${date}">
            <span class="pair">${r.account.photo ? `<img src="${esc(r.account.photo)}" alt="">` : avatar(r.account, 'lg')}${pic ? `<img src="${esc(pic)}" alt="Selfie">` : `<span class="noselfie">${pics ? (r.a.manual ? 'Malik ne lagayi' : 'Selfie nahi') : 'Load…'}</span>`}</span>
            <b>${nameHtml(r.account.name)}</b><small>${fmtTime(r.a.checkIn)}${r.a.checkInDistance != null ? ' · ' + Math.round(r.a.checkInDistance) + 'm' : ''}${r.a.checkInAccuracy ? ' (±' + Math.round(r.a.checkInAccuracy) + 'm)' : ''}</small>
            ${gap != null && Math.abs(gap) >= 10 ? `<small class="txt-bad">Server ka waqt ${hm(Math.abs(gap))} ${gap > 0 ? 'baad' : 'pehle'}</small>` : ''}</button></li>`; }).join('')}</ul>`;
    } });
    data.selfiesFor(date).then(m => { pics = m; sheet.refresh(true); }).catch(e => { error = errorText(e); sheet.refresh(true); });
    return sheet;
  }
  const AUDIT_LABEL = { attendance: 'Hazri badli', 'attendance delete': 'Hazri hatayi', request: 'Request ka jawab', 'salary settings': 'Salary settings', 'salary adjustment': 'Advance / bonus / qarz', 'salary adjustment delete': 'Advance / bonus hataya', 'salary final': 'Salary final', 'salary reopen': 'Salary dobara kholi', 'salary payment': 'Salary di', settings: 'Settings', 'staff delete': 'Staff delete', 'dukaan band': 'Dukaan band', 'dukaan band hataya': 'Dukaan band hataya', 'default shift sab par': 'Sab par default duty', 'default salary sab par': 'Sab par default salary', ticket: 'Bina bataye gaya (ticket)', 'ticket faisla': 'Ticket ka faisla', 'khana break': 'Khana break', 'bahar manzoor': 'Parchi manzoor', 'bahar na-manzoor': 'Parchi na-manzoor', 'bahar wapsi': 'Parchi wapsi' };
  function historySheet() {
    let rows = null, error = '', who = '';
    const sheet = openSheet({ id: 'history', wide: true, title: 'Tabdeeli ki history', render: () => {
      if (error) return `<p class="error-line">${icon('alert', 18)} <span>${esc(error)}</span></p>`;
      if (!rows) return '<p class="loading-line">History aa rahi hai…</p>';
      const phoneOf = t => (String(t).match(/03\d{9}/) || [])[0] || '';
      const list = rows.filter(r => !who || phoneOf(r.target) === who);
      const parse = v => { try { return typeof v === 'string' ? JSON.parse(v || 'null') : v; } catch { return null; } };
      const brief = v => { if (!v || typeof v !== 'object') return ''; if ('checkIn' in v || 'checkOut' in v) return `${fmtTime(v.checkIn)} – ${fmtTime(v.checkOut)}`; if ('amount' in v) return `${v.kind === 'advance' ? 'Advance' : v.kind === 'loan' ? 'Qarz' : 'Bonus'} ${money(v.amount)}`; if ('paid' in v) return 'Ada ' + money(v.paid); if ('status' in v) return v.status === 'approved' ? 'Manzoor' : v.status === 'rejected' ? 'Na-manzoor' : String(v.status); if ('state' in v) return v.state === 'final' ? 'Final' + (v.final != null ? ' ' + money(v.final) : '') : 'Khula'; if ('monthlySalary' in v) return money(v.monthlySalary); return ''; };
      const when = at => { const d = new Date(Number(at) || 0); if (!d.getTime()) return ''; const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); return `${shortDate(pkDate(d))} ${fmtTime(t)}`; };
      return `<label class="inline-select">Staff<select data-change="history-who"><option value="">Sab</option>${activeStaff().map(s => `<option value="${s.phone}" ${who === s.phone ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <ul class="ledger history">${list.map(r => { const ph = phoneOf(r.target), day = (String(r.target).match(/^\d{4}-\d{2}-\d{2}/) || [])[0], b = brief(parse(r.before)), a = brief(parse(r.after));
          return `<li><span><b>${esc(AUDIT_LABEL[r.type] || r.type)}</b>${ph ? ' · ' + nameHtml(account(ph)?.name || ph) : ''}${day ? ' · ' + esc(shortDate(day)) : ''}<small>${b || a ? `${esc(b || '—')} → ${esc(a || '—')}` : ''}${r.reason ? ' · ' + esc(r.reason) : ''}</small></span><small class="muted">${esc(when(r.at))}</small></li>`; }).join('') || '<li class="muted">Koi tabdeeli nahi mili.</li>'}</ul>
        <p class="hint">Aakhri ${rows.length} tabdeeliyan.</p>`;
    } });
    sheet.setWho = v => { who = v; sheet.refresh(true); };
    data.auditLog(200).then(r => { rows = r; sheet.refresh(true); }).catch(e => { error = errorText(e); sheet.refresh(true); });
    return sheet;
  }
  /* ---------- Excel (sirf dabane par load) ---------- */
  let xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxPromise ||= new Promise((resolve, reject) => { const sc = document.createElement('script'); sc.src = './xlsx.mini.min.js'; sc.onload = () => resolve(window.XLSX); sc.onerror = () => { xlsxPromise = null; reject(new Error('Excel library load nahi hui. Internet check kar ke dobara dabayein.')); }; document.head.append(sc); });
    return xlsxPromise;
  }
  const DAY_FULL = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'];
  function excelWorkbook(X, month) {
    const dates = monthDates(month), staff = activeStaff(), wb = X.utils.book_new(), r0 = n => Math.round(Number(n) || 0), h2 = m => +((m || 0) / 60).toFixed(2);
    const reg = [['Naam', 'Number', ...dates.map(d => +d.slice(8)), 'Hazir', 'Late', 'Ghair hazir', 'Chutti/Off', 'Kul ghante']];
    const detail = [['Tareekh', 'Din', 'Naam', 'Number', 'Aaya', 'Gaya', 'Ghante', 'Bahar (min)', 'Khana (min)', 'Late (min)', 'Status', 'Note']];
    for (const s of staff) {
      const sum = summaryFor(s, month);
      reg.push([s.name, s.phone, ...sum.days.map(d => MARK[d.status] === '·' ? '' : MARK[d.status]), sum.count.present + sum.count.late, sum.count.late, sum.count.absent, sum.count.leave + sum.count.off, h2(sum.totalMin)]);
      for (const d of sum.days) if (d.status !== 'na') detail.push([d.date, DAY_FULL[weekday(d.date)], s.name, s.phone, d.a.checkIn ? fmtTime(d.a.checkIn) : '', d.a.checkOut ? fmtTime(d.a.checkOut) : '', d.minutes != null ? h2(d.minutes) : '', dayOuts(S.outs, s.phone, d.date).done.reduce((n, o) => n + (outMinutes(o) || 0), 0) || '', dayOuts(S.outs, s.phone, d.date, Date.now(), 'break').done.reduce((n, o) => n + (outMinutes(o) || 0), 0) || '', d.a.checkIn ? d.late : '', STATUS_LABEL[d.status], d.a.ownerNote || '']);
    }
    const sal = [['Naam', 'Number', 'Salary', 'Default?', 'Din kaam', 'Ghante', 'Ghair hazir din', 'Hazri salary', 'Overtime', 'Bonus+', 'Advance', 'Qarz qist', 'Late jurmana', 'Bahar (min)', 'Bahar kati', 'Ticket katauti', 'Kul', 'Ada', 'Baqi', 'Halat']];
    for (const s of staff) { const c = data.calcFor(s, month);
      sal.push([s.name, s.phone, r0(c.monthlySalary), c.useDefault ? 'Default' : 'Apni', c.daysWorked, h2((c.normalMin || 0) + (c.otMin || 0)), c.absentDays ?? '', r0(c.normalSalary), r0(c.overtimeAmount), r0((c.bonus || 0) + (c.pointsAmount || 0) + (c.mealSalary || 0)), r0(c.advance), r0(c.loanCut), r0(c.lateFine), c.outMin || 0, r0(c.outCut), r0(c.ticketCut), r0(c.final), r0(c.paid), r0(c.balance), c.frozen ? 'Final' : 'Andaza']); }
    const add = (rows, name, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
    add(reg, 'Register', [18, 13, ...dates.map(() => 3.5), 7, 6, 11, 10, 10]);
    add(detail, 'Hazri', [11, 9, 18, 13, 9, 9, 7, 10, 10, 9, 12, 24]);
    add(sal, 'Salary', [18, 13, 9, 9, 8, 8, 10, 11, 9, 9, 9, 9, 11, 10, 10, 12, 10, 10, 10, 8]);
    return wb;
  }
  function outsSheet(date) {
    return openSheet({ id: 'outs', wide: true, title: 'Bahar jane ki parchiyan', render: sh => {
      sh.setTitle(`Bahar jane ki parchiyan <small>${esc(dateLabel(date))}</small>`);
      const list = S.outs.filter(o => o.date === date && o.status !== 'cancelled').sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
      const t = clock;
      const label = { pending: ['st-late', 'Jawab baqi'], approved: ['st-absent', 'Abhi bahar'], returned: ['st-present', 'Wapas aa gaya'], rejected: ['st-off', 'Na-manzoor'] };
      return list.length ? `<ul class="reqs">${list.map(o => { const s = account(o.phone) || { name: o.phone }, m = outMinutes(o, Date.now()), over = m != null && m > Number(o.minutes || 0);
        return `<li class="req"><p><b>${nameHtml(s.name)}</b>${o.kind === 'break' ? ' <span class="tag">Khana break</span>' : ''} <span class="stamp ${label[o.status]?.[0] || 'st-off'}">${label[o.status]?.[1] || esc(o.status)}</span></p>
          <p>${esc(o.reason)}${o.note ? ' — ' + nameHtml(o.note) : ''} · ${o.minutes} min ka kaha</p>
          <p class="muted">Manga ${t(o.requestedAt)}${o.outAt ? ` · Gaya ${t(o.outAt)}` : ''}${o.returnAt ? ` · Wapas ${t(o.returnAt)}` : ''}${m != null ? ` · <b class="${over ? 'txt-bad' : ''}">${hm(m)}</b>${over ? ' (waqt se zyada)' : ''}` : ''}${o.returnDistance != null ? ` · wapsi par dukaan se ${Math.round(o.returnDistance)}m` : ''}${o.approvedByName ? ` · ${esc(o.approvedByName)} ne ${o.status === 'rejected' ? 'mana ki' : 'manzoor ki'}` : ''}${o.returnBy === 'malik' ? ' · wapsi malik ne lagayi' : o.returnBy === 'manager' ? ` · wapsi ${esc(o.returnByName || 'manager')} ne lagayi` : ''}</p>
          ${o.status === 'pending' ? `<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-action="out-review" data-id="${esc(o.id)}" data-arg="yes">Haan</button><button type="button" class="btn btn-ghost btn-sm" data-action="out-review" data-id="${esc(o.id)}" data-arg="no">Nahi</button></div>` : ''}
          ${o.status === 'approved' ? `<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="out-return" data-id="${esc(o.id)}">Wapas aa gaya (malik lagaye)</button></div>` : ''}</li>`; }).join('')}</ul>`
        : '<p class="empty-line">Is din koi parchi nahi.</p>';
    } });
  }
  function ticketsSheet(date = '') {
    let only = date;
    const sheet = openSheet({ id: 'tickets', wide: true, title: 'Bina bataye gaya — tickets', render: () => {
      const list = S.tickets.filter(t => !only || t.date === only).sort((a, b) => (a.status === 'decided') - (b.status === 'decided') || (b.from || 0) - (a.from || 0)).slice(0, 80);
      const decLab = { maaf: ['st-present', 'Maaf'], warning: ['st-late', 'Warning'], katauti: ['st-absent', 'Katauti'] };
      return `<div class="btn-row"><button type="button" class="chip" aria-pressed="${!!only}" data-action="tickets-filter" data-arg="${esc(date || pkDate())}">Sirf ${esc(shortDate(date || pkDate()))}</button><button type="button" class="chip" aria-pressed="${!only}" data-action="tickets-filter" data-arg="">Sab (45 din)</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="ticket-new">${icon('plus', 16)} Naya ticket</button></div>
        <ul class="reqs">${list.map(t => { const s = account(t.phone) || { name: t.name || t.phone }, m = ticketMinutes(t, Date.now()), sug = t.status === 'decided' ? 0 : data.ticketSuggestFor(t);
          return `<li class="req"><p><b>${nameHtml(s.name)}</b> ${t.status === 'decided' ? `<span class="stamp ${decLab[t.decision]?.[0] || 'st-off'}">${decLab[t.decision]?.[1] || ''}${t.decision === 'katauti' ? ' ' + money(t.amount) : ''}</span>` : t.status === 'open' ? '<span class="stamp st-absent">Abhi bahar</span>' : '<span class="stamp st-late">Faisla baqi</span>'}</p>
            <p>${esc(ticketText(t))}${m != null ? ` · <b>${esc(durText(m))}</b>` : ''}</p>
            <p class="muted">Ticket: ${esc(t.byName || '—')}${t.returnBy ? ' · wapsi: ' + esc(t.returnBy) : ''}${t.note ? ' · ' + nameHtml(t.note) : ''}</p>
            ${t.status === 'open' ? `<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="ticket-return" data-id="${esc(t.id)}">Wapas aa gaya</button></div>` : ''}
            ${t.status !== 'decided' ? `<div class="decide"><label>Katauti (Rs)<input type="number" inputmode="numeric" min="0" step="5" value="${sug}" data-ticket-amount="${esc(t.id)}"></label><small class="muted">Mashwara: ${money(sug)} = fi ghanta salary × ${esc(durText(m || 0))}${t.status === 'open' ? ' (ab tak)' : ''}</small>
              <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="ticket-decide" data-id="${esc(t.id)}" data-arg="maaf">Maaf</button><button type="button" class="btn btn-ghost btn-sm" data-action="ticket-decide" data-id="${esc(t.id)}" data-arg="warning">Warning</button><button type="button" class="btn btn-out btn-sm" data-action="ticket-decide" data-id="${esc(t.id)}" data-arg="katauti">Katauti</button></div></div>` : ''}</li>`; }).join('') || '<li class="muted">Koi ticket nahi.</li>'}</ul>`;
    } });
    sheet.setOnly = v => { only = v; sheet.refresh(true); };
    return sheet;
  }
  /** Firebase wala asal push: NT Hazri ke apne icon se, aur "abhi tak nahi aaya" jaisi khabrein bhi. */
  /** v213: Firebase notification ka saaf safha — halat, aik button, saaf paigham, aur jaanch. */
  function pushBox() {
    const p = S.config.push || {}, perm = pushPermission(), on = perm === 'granted' && !!ui.pushToken;
    const msg = ui.pushMsg ? `<p class="${ui.pushMsg.bad ? 'error-line' : 'ok-line'}">${icon(ui.pushMsg.bad ? 'alert' : 'check', 18)} <span>${esc(ui.pushMsg.text)}</span></p>` : '';
    const state = on ? ['ok', 'Is phone par: CHALU'] : perm === 'denied' ? ['bad', 'Is phone par: BAND (phone ne ijazat nahi di)'] : ['wait', 'Is phone par: BAND'];
    return `<section class="push-box">
      <p class="push-state s-${state[0]}">${icon(on ? 'check' : 'alert', 20)} <b>${state[1]}</b></p>
      ${msg}
      ${!p.vapidKey ? `<p class="hint">Pehle Firebase ki key lagayein: <b>Firebase console › Project settings › Cloud Messaging › Web Push certificates › Generate key pair</b>, phir wo key yahan paste karein.</p>
        <form class="form" data-form="vapid"><input name="vapidKey" placeholder="Web Push key (BJ… se shuru)" required><button class="btn btn-primary btn-lg">Key save karein</button></form>`
      : `<button type="button" class="btn ${on ? 'btn-ghost' : 'btn-primary'} btn-xl" data-action="push-on">${icon('down', 20)} ${on ? 'Dobara jodein (check karein)' : 'Is phone par notification chalu karein'}</button>
        ${on ? `<div class="btn-row"><button type="button" class="btn btn-primary" data-action="push-test">Test notification bhejein</button>
          <button type="button" class="btn btn-ghost" data-action="push-devices">Kin phones par chalu hai</button>
          <button type="button" class="btn btn-ghost" data-action="push-off">Is phone par band karein</button></div>` : `<div class="btn-row"><button type="button" class="btn btn-ghost" data-action="push-devices">Kin phones par chalu hai</button></div>`}
        ${perm === 'denied' ? `<p class="hint">Phone ne ijazat nahi di. Chrome mein app ka safha kholein › address ke baen wale nishan par dabayein › <b>Site settings › Notifications › Allow</b>. App home screen par lagi ho to: phone ki <b>Settings › Apps › NT Hazri › Notifications</b> on karein.</p>` : ''}
        <details class="push-more"><summary>Khud aane wali khabrein aur settings</summary>
          <label class="check"><input type="checkbox" data-change="push-auto" ${p.on === false ? '' : 'checked'}> Khud aane wali khabrein (nahi aaya, break ka waqt khatam, Check-Out baqi, salary final)</label>
          <div class="two"><label>"Nahi aaya" duty ke kitne minute baad<input type="number" min="5" max="180" value="${Number(p.absentAfter ?? 30)}" data-change="push-after" data-arg="absentAfter"></label>
            <label>"Check-Out baqi" kitne minute baad<input type="number" min="5" max="180" value="${Number(p.checkoutAfter ?? 30)}" data-change="push-after" data-arg="checkoutAfter"></label></div>
          <p class="hint">Key lagi hui hai. Badalni ho to <button type="button" class="link" data-action="push-key-clear">key hatayein</button>.</p>
        </details>
        <details class="push-more"><summary>Jaanch (masla ho to ye dekhein)</summary><table class="calc"><tbody>
          <tr><td>Firebase ki key</td><td>${p.vapidKey ? 'lagi hai' : 'nahi lagi'}</td></tr>
          <tr><td>Phone ki ijazat</td><td>${perm === 'granted' ? 'mil gayi' : perm === 'denied' ? 'nahi di' : 'abhi nahi maangi'}</td></tr>
          <tr><td>Is phone ka token</td><td>${ui.pushToken ? '…' + esc(String(ui.pushToken).slice(-8)) : 'nahi bana'}</td></tr>
          <tr><td>Firebase mein mehfooz</td><td>${ui.pushSaved == null ? '—' : ui.pushSaved ? 'haan' : 'nahi'}</td></tr>
          <tr><td>App</td><td>${install?.standalone ? 'home screen se khuli' : 'browser mein khuli'}</td></tr>
        </tbody></table><p class="hint">Khabar der se aaye to us phone par: <b>Settings › Apps › (Chrome ya NT Hazri) › Battery › Unrestricted</b>, aur usi app ki <b>Notifications</b> mein is channel ko <b>Urgent</b> kar dein. Test bhejne ke liye Firebase par functions aur rules ka naya version zaroori hai.</p></details>` }
    </section>`;
  }
  function notifySheet() {
    const sheet = openSheet({ id: 'notify', wide: true, title: 'Notifications — app band ho tab bhi', render: () => {
      const n = S.config.notify || {};
      return `${pushBox()}
        <details class="push-more"><summary>Doosra tareeqa: ntfy app (muft, alag icon se)</summary>
          ${!n.topic ? `<p class="hint">Ye muft ntfy app ke zariye chalta hai. Firebase wala chal jaye to is ki zaroorat nahi.</p>
            <button type="button" class="btn btn-ghost" data-action="notify-on">ntfy chalu karein</button>`
          : `<ol class="steps"><li>Play Store se <b>ntfy</b> install karein.</li>
            <li>ntfy mein <b>+</b> daba kar ye topic subscribe karein: <span class="topic-box"><code>${esc(n.topic)}</code> <button type="button" class="btn btn-ghost btn-sm" data-action="notify-copy">Copy</button></span></li>
            <li>Neeche test bhej kar dekh lein.</li></ol>
            <fieldset><legend>Kis cheez ki khabar aaye</legend>${NOTIFY_KINDS.map(([k, label]) => `<label class="check"><input type="checkbox" data-change="notify-kind" data-arg="${k}" ${n[k] === false ? '' : 'checked'}> ${label}</label>`).join('')}</fieldset>
            <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="notify-test">Test (ntfy)</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="notify-toggle">${n.on ? 'Band karein' : 'Chalu karein'}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="notify-new">Naya topic</button></div>`}
        </details>`;
    } });
    void data.pushDevices().then(list => { ui.pushSaved = ui.pushToken ? list.some(d => d.token === ui.pushToken) : null; sheet.refresh(true); }).catch(() => {});
    void currentToken({ app: data.app, vapidKey: S.config.push?.vapidKey }).then(t => { if (t && t !== ui.pushToken) { ui.pushToken = t; sheet.refresh(true); } });
    return sheet;
  }
  const kmText = d => (d == null || !Number.isFinite(Number(d)) ? '' : Number(d) >= 1000 ? (Number(d) / 1000).toFixed(1) + ' km' : Math.round(Number(d)) + ' m');
  /* ---------- v220: CAMERAS (Hissa A) — sirf malik ----------
     Camera parhne ka kaam shop PC karta hai (ntcam.py); yahan: PC jodna, naam / kaam / on-off, aakhri tasveer, online / offline. */
  const CAM_DEFAULT_BASE = 'https://samiullah-878.github.io/nt-traders-/';
  const CAM_ROLE_TEXT = { galla: 'Galla', counter: 'Counter', view: 'Sirf dekhna' };
  const camOnline = () => !!(S.camPC?.at && Date.now() - S.camPC.at < 6 * 60000);
  const camToolText = () => { const n = (S.cameras || []).length, on = (S.cameras || []).filter(c => c.status === 'online').length; return !S.camCfg ? 'PC jodein — dukaan ke camera app mein' : `${n} camera · ${on} online · PC ${camOnline() ? 'chalu' : 'band'}`; };
  function camCommand() {
    const loc = globalThis.location || globalThis.window?.location || {};
    const base = /^https?:/.test(loc.origin || '') ? loc.origin + String(loc.pathname || '/').replace(/[^/]*$/, '') : CAM_DEFAULT_BASE;
    return base === CAM_DEFAULT_BASE ? `irm ${CAM_DEFAULT_BASE}ntcam.txt|iex` : "$b='" + base + "';irm \"$" + "{b}ntcam.txt\"|iex";
  }
  function camerasSheet() {
    data.watchShots(true);
    return openSheet({ id: 'cameras', wide: true, title: 'Cameras', onClose: () => data.watchShots(false), render: () => {
      const pc = S.camPC, cfg = S.camCfg, cams = S.cameras || [], on = camOnline();
      const pcCard = `<section class="cam-pc ${on ? 'is-on' : cfg ? 'is-off' : ''}"><i class="cam-dot" aria-hidden="true"></i><div>
          <b>${!cfg ? 'Camera PC abhi juda nahi' : on ? 'Camera PC chal raha hai' : 'Camera PC band hai'}</b>
          <small>${pc?.at ? `Aakhri khabar ${esc(agoText(pc.at))} · NT Camera v${esc(pc.v || '?')} · ${Number(pc.cams || 0)} camera, ${Number(pc.online || 0)} online${pc.host ? ' · ' + esc(pc.host) : ''}` : cfg ? 'PC ne abhi tak koi khabar nahi bheji — PC par command chalayein.' : 'Neeche 4 qadam se PC jodein.'}</small></div></section>`;
      const cmd = camCommand();
      const connect = (!cfg || ui.camCode) ? `<section class="panel pad cam-steps"><h3 class="sub">PC jodein</h3><ol class="steps-list">
          <li><span>${ui.camCode ? `PC code (sirf abhi nazar aa raha hai — likh lein): <b class="cam-code">${esc(ui.camCode)}</b>` : `PC ka code banayein.`}</span>${ui.camCode ? '' : `<button type="button" class="btn btn-primary btn-sm" data-action="cam-code">Code banayein</button>`}</li>
          <li><span>AnyDesk se shop PC kholein → Start par right-click → <b>Windows PowerShell</b>.</span></li>
          <li><span>Ye aik command type kar ke Enter dabayein:</span><code class="cmd">${esc(cmd)}</code><button type="button" class="btn btn-ghost btn-sm" data-action="cam-copy">Copy</button></li>
          <li><span>PC poochega to PC code, camera ka password aur Claude API key <b>PC par hi</b> likhein — phone par nahi.</span></li></ol></section>` : '';
      const known = new Set(cams.map(c => c.ip));
      const extra = (pc?.found || []).filter(d => !known.has(d.ip));
      const foundHtml = extra.length ? `<p class="notice">${icon('camera', 18)} <span>PC ne network par ye bhi dekhe: ${extra.map(d => `<b>${esc(d.ip)}</b> (${esc({ dahua: 'Dahua', hik: 'Hikvision' }[d.brand] || 'camera')})`).join(', ')}. Jodne ke liye PC par desktop icon <b>"NT Camera jodein"</b> chalayein.</span></p>` : '';
      const card = c => {
        const shot = S.camShots?.get?.(c.id), src = shot?.jpg ? 'data:image/jpeg;base64,' + shot.jpg : '';
        const st = c.enabled === false ? 'off' : c.status === 'online' && on ? 'on' : 'down';
        const stText = { on: 'Online', down: 'Offline', off: 'Band' }[st];
        const editing = ui.camEdit === c.id;
        return `<article class="cam-card st-${st}">
          <button type="button" class="cam-shot" data-action="cam-photo" data-id="${esc(c.id)}" ${src ? '' : 'disabled'} aria-label="${esc(c.name || 'Camera')} ki tasveer poori screen par">
            ${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span class="cam-empty">${icon('camera', 28)}<small>Tasveer abhi nahi aayi</small></span>`}
            <span class="cam-status"><i></i>${stText}${shot?.at ? ' · ' + esc(agoText(shot.at)) : ''}</span></button>
          <div class="cam-body"><p class="cam-name"><b>${esc(c.name || c.id)}</b><span class="cam-role r-${esc(c.role || 'view')}">${esc(CAM_ROLE_TEXT[c.role] || 'Sirf dekhna')}</span></p>
            <small class="muted">${esc(c.ip || '')}${c.channel > 1 ? ' · channel ' + esc(String(c.channel)) : ''} · ${esc({ dahua: 'Dahua', hik: 'Hikvision' }[c.brand] || 'Camera')}</small>
            ${c.lastError && st !== 'on' ? `<small class="txt-bad">${esc(c.lastError)}</small>` : ''}
            ${c.aiTest ? `<small class="cam-ai">${icon('check', 14)} AI test: ${esc(c.aiTest)}</small>` : ''}
            ${editing ? `<form class="form cam-form" data-form="cam" data-id="${esc(c.id)}">
                <label>Naam<input name="name" value="${esc(c.name || '')}" maxlength="40" required></label>
                <div class="cam-roles" role="radiogroup" aria-label="Kaam">${Object.entries(CAM_ROLE_TEXT).map(([k, t]) => `<label class="cam-pick"><input type="radio" name="role" value="${k}" ${(c.role || 'view') === k ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
                <label class="check"><input type="checkbox" name="enabled" ${c.enabled === false ? '' : 'checked'}> Camera chalu (band = PC is ki tasveer nahi lega)</label>
                <label>Roz AI jaanch ki had (kharcha qaabu)<input type="number" name="aiCap" min="1" max="2000" value="${esc(String(c.aiCap || 300))}" inputmode="numeric"></label>
                <div class="cam-roles" role="radiogroup" aria-label="Harkat ki hissasiyat">${[['low', 'Kam'], ['mid', 'Aam'], ['high', 'Zyada']].map(([k, t]) => `<label class="cam-pick"><input type="radio" name="sens" value="${k}" ${(c.sens || 'mid') === k ? 'checked' : ''}><span>Harkat: ${t}</span></label>`).join('')}</div>
                <div class="btn-row"><button class="btn btn-primary">Save</button><button type="button" class="btn btn-ghost" data-action="cam-edit" data-id="">Rehne dein</button><button type="button" class="btn btn-ghost txt-bad" data-action="cam-del" data-id="${esc(c.id)}">Hatayein</button></div></form>`
              : `${c.role === 'galla' ? `<p class="cam-watch ${c.zone?.w ? '' : 'is-need'}">${c.zone?.w ? `${icon('check', 14)} Galla ka hissa mark hai${c.watch === 'on' && on ? ` · nigrani chalu${c.fps ? ' (' + esc(String(c.fps)) + ' fps' + (c.stream === 'sub' ? ', halki video' : '') + ')' : ''}` : ' · PC par nigrani shuru hone ka intezar'}` : `${icon('alert', 14)} Galla ka hissa abhi mark nahi — nigrani band`}</p>` : ''}
                <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="cam-snap" data-id="${esc(c.id)}" ${st === 'off' ? 'disabled' : ''}>${icon('camera', 16)} Abhi ki tasveer</button>${c.role === 'galla' ? `<button type="button" class="btn ${c.zone?.w ? 'btn-ghost' : 'btn-primary'} btn-sm" data-action="cam-zone" data-id="${esc(c.id)}">${icon('edit', 16)} Galla ka hissa</button>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-action="cam-edit" data-id="${esc(c.id)}">${icon('edit', 16)} Badlein</button></div>`}
          </div></article>`;
      };
      return `${pcCard}${connect}${foundHtml}
        ${cams.length ? `<div class="cam-grid">${cams.map(card).join('')}</div>` : cfg ? '<p class="empty-line">Abhi koi camera nahi juda. PC par command (ya desktop icon "NT Camera jodein") chalayein.</p>' : ''}
        ${cfg && !ui.camCode ? `<p class="hint">PC badal raha hai ya code kho gaya? <button type="button" class="link" data-action="cam-code">Naya PC code banayein</button> (purana PC band ho jayega).</p>` : ''}
        <p class="hint">Tasveer har 5 minute mein khud taza hoti hai jab PC chalu ho. Galla nigrani (harkat par AI) agle hisse mein judegi.</p>`;
    } });
  }
  /* ---------- v222: NIGRANI tab (sirf malik) — galla par har harkat, AI ka faisla, photos, duty par kaun tha ---------- */
  const VERDICT = { normal: ['Normal', 't-ok'], shak: ['Shak', 't-bad'], saaf_nahi: ['Saaf nahi', 't-off'], error: ['AI nahi chala', 't-late'] };
  const REVIEW = { ok: 'Aap ne: Theek hai', confirmed: 'Aap ne: Shak pakka' };
  const pkMinOf = ms => { const t = new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).split(':'); return Number(t[0]) * 60 + Number(t[1]); };
  /** Us waqt duty par kaun tha (hazri se) — bahar ki parchi / break par tha to sath likha. AI chehra nahi pehchanta, ye hazri batati hai. */
  function onDutyAt(date, ms) {
    const m = pkMinOf(ms);
    return data.attendanceBetween(date, date).filter(a => a.checkIn && (parseTime(a.checkIn) ?? 9999) <= m && (!a.checkOut || (parseTime(a.checkOut) ?? -1) >= m))
      .map(a => { const out = S.outs.find(o => o.phone === a.phone && o.date === date && ['approved', 'returned'].includes(o.status) && (o.outAt || o.approvedAt || 0) <= ms && (!o.returnAt || o.returnAt >= ms)); return { name: account(a.phone)?.name || a.phone, out: !!out }; });
  }
  function nigraniTab() {
    const today = pkDate(), day = ui.nigDay || today;
    if (S.camDay !== day) queueMicrotask(() => { if (ui.tab === 'nigrani') data.watchEvents(day); });
    const cams = S.cameras || [], galla = cams.filter(c => c.role === 'galla');
    const evs = S.camDay === day ? S.camEvents || [] : [];
    const stats = (S.camDay === day ? S.camDayStats : []) || [];
    const sum = k => stats.reduce((a, x) => a + Number(x[k] || 0), 0);
    const shakList = evs.filter(e => e.verdict === 'shak'), open = shakList.filter(e => !e.reviewed);
    const f = ui.nigFilter || 'all';
    const shown = evs.filter(e => f === 'all' ? true : f === 'open' ? e.verdict === 'shak' && !e.reviewed : e.verdict === f);
    const setup = !cams.length ? `<p class="notice">${icon('camera', 18)} <span>Abhi koi camera nahi juda. <b>Settings → Cameras</b> se PC aur camera jodein.</span></p>`
      : !galla.length ? `<p class="notice">${icon('camera', 18)} <span>Kisi camera ka kaam "Galla" nahi. <button type="button" class="link" data-action="cameras">Cameras</button> mein camera kholein → Badlein → kaam: <b>Galla</b>.</span></p>`
      : galla.filter(c => !c.zone?.w).map(c => `<p class="notice tone-late">${icon('alert', 18)} <span><b>${esc(c.name)}</b>: galla ka hissa mark nahi — nigrani band hai. <button type="button" class="btn btn-primary btn-sm" data-action="cam-zone" data-id="${esc(c.id)}">Abhi mark karein</button></span></p>`).join('');
    const camChips = galla.map(c => { const live = c.watch === 'on' && camOnline() && c.enabled !== false && c.zone?.w; return `<span class="nig-cam ${live ? 'is-on' : ''}"><i></i>${esc(c.name)} · ${live ? 'nigrani chalu' : 'nigrani band'}</span>`; }).join('');
    const card = e => { const [vt, vc] = VERDICT[e.verdict] || VERDICT.saaf_nahi; return `<button type="button" class="nig-ev v-${esc(e.verdict)} ${e.reviewed ? 'is-seen' : ''}" data-action="nig-open" data-id="${esc(e.id)}">
        ${e.thumb ? `<img src="data:image/jpeg;base64,${esc(e.thumb)}" alt="" loading="lazy">` : `<span class="nig-noimg">${icon('camera', 22)}</span>`}
        <span class="nig-ev-body"><span class="nig-ev-top"><b>${esc(clockOf(e.at))}</b><span class="tag ${vc}">${vt}</span>${e.reviewed ? `<span class="tag">${e.reviewed === 'ok' ? 'Theek' : 'Pakka shak'}</span>` : ''}</span>
          <small>${esc(e.why || '')}</small><small class="muted">${esc(e.camName || '')}</small></span></button>`; };
    return `<section class="nig-head"><div class="day-nav"><button type="button" class="icon-btn" data-action="nig-day" data-arg="-1" aria-label="Pichla din">${icon('left')}</button>
        <b>${day === today ? 'Aaj' : esc(shortDate(day))}</b><button type="button" class="icon-btn" data-action="nig-day" data-arg="1" ${day >= today ? 'disabled' : ''} aria-label="Agla din">${icon('right')}</button></div>
        ${camChips ? `<div class="nig-cams">${camChips}</div>` : ''}</section>
      ${setup}
      <section class="nig-sum">
        <div><b>${sum('touches')}</b><small>galla chhua</small></div>
        <div><b>${sum('checks')}</b><small>AI jaanch</small></div>
        <div class="${sum('shak') ? 'is-bad' : ''}"><b>${sum('shak')}</b><small>shak</small></div>
        <div><b>${shakList.length - open.length}/${shakList.length}</b><small>shak dekhe</small></div>
      </section>
      ${sum('unchecked') ? `<p class="hint">${sum('unchecked')} dafa AI jaanch nahi hui (roz ki had poori, AI ruka, ya key nahi) — sirf ginti hui.</p>` : ''}
      <div class="chips" role="tablist">${[['all', 'Sab', evs.length], ['open', 'Na dekhe shak', open.length], ['shak', 'Shak', shakList.length], ['normal', 'Normal', evs.filter(e => e.verdict === 'normal').length]].map(([k, t, n]) => `<button type="button" class="chip" role="tab" aria-selected="${f === k}" data-action="nig-filter" data-arg="${k}"><b>${n}</b> ${t}</button>`).join('')}</div>
      <div class="nig-list">${shown.map(card).join('') || `<p class="empty-line">${!S.loaded.has('camEvents') ? 'Aa raha hai…' : f === 'all' ? 'Is din galla par koi harkat record nahi hui.' : 'Is filter mein kuch nahi.'}</p>`}</div>
      <p class="hint">AI sirf "shak" batata hai — pakka faisla photos (aur DMSS ki recording) dekh kar karein. Photos 30 din baad khud mit jati hain.</p>`;
  }
  function eventSheet(id) {
    ui.nigIdx = 0;
    const sheet = openSheet({ id: 'nig-ev', wide: true, title: 'Galla ki harkat', render: () => {
      const e = (S.camEvents || []).find(x => x.id === id); if (!e) return '<p class="empty-line">Ye event ab nahi mila.</p>';
      const [vt, vc] = VERDICT[e.verdict] || VERDICT.saaf_nahi, frames = ui.nigFrames?.[id], i = Math.min(ui.nigIdx || 0, Math.max(0, (frames?.length || 1) - 1));
      const duty = onDutyAt(e.date, e.at);
      return `<div class="nig-photo">${frames?.length ? `<button type="button" class="nig-big" data-action="nig-full" data-id="${esc(id)}" aria-label="Poori screen"><img src="data:image/jpeg;base64,${esc(frames[i])}" alt="Tasveer ${i + 1}"></button>
            <div class="nig-strip">${frames.map((b, k) => `<button type="button" class="${k === i ? 'is-on' : ''}" data-action="nig-idx" data-arg="${k}" aria-label="Tasveer ${k + 1}"><img src="data:image/jpeg;base64,${esc(b)}" alt=""></button>`).join('')}</div>`
          : frames ? `<p class="empty-line">Tasveerein nahi mileen (shayad 30 din purani ho kar mit gayin).</p>` : `<p class="loading-line">Tasveerein aa rahi hain…</p>`}</div>
        <p class="nig-meta"><b>${esc(clockOf(e.at))}</b> · ${esc(shortDate(e.date))} · ${esc(e.camName || '')} <span class="tag ${vc}">${vt}</span></p>
        <p class="nig-why">${icon('check', 16)} AI: ${esc(e.why || '—')}</p>
        <p class="nig-duty"><b>Us waqt duty par:</b> ${duty.length ? duty.map(d => `${nameHtml(d.name)}${d.out ? ' <small class="txt-late">(bahar tha)</small>' : ''}`).join(', ') : '<span class="muted">hazri mein koi nahi</span>'}</p>
        ${e.reviewed ? `<p class="notice">${esc(REVIEW[e.reviewed] || '')}${e.reviewNote ? ' — ' + esc(e.reviewNote) : ''}</p>` : ''}
        <form class="form nig-review" data-form="nig-review" data-id="${esc(id)}"><label>Note (ikhtiyari)<input name="note" maxlength="200" value="${esc(e.reviewNote || '')}"></label>
          <div class="btn-row"><button class="btn btn-in" name="status" value="ok">${icon('check', 18)} Theek hai</button><button class="btn btn-out" name="status" value="confirmed">${icon('alert', 18)} Shak pakka</button></div></form>`;
    } });
    if (!ui.nigFrames?.[id]) data.loadFrames(id).then(fr => { ui.nigFrames = { ...(ui.nigFrames || {}), [id]: fr }; sheet.refresh(true); }).catch(error => { ui.nigFrames = { ...(ui.nigFrames || {}), [id]: [] }; sheet.refresh(true); toast(errorText(error), 'bad'); });
    return sheet;
  }
  /** Tasveer par ungli se dabba: galla (paise ki tokri / drawer). 0-1 mein save (camera ki resolution se azad). */
  function zoneSheet(camId) {
    const c = (S.cameras || []).find(x => x.id === camId); if (!c) return null;
    ui.zoneDraft = c.zone?.w ? { ...c.zone } : null; ui.zoneCam = camId;
    const shot = S.camShots?.get?.(camId);
    const sheet = openSheet({ id: 'cam-zone', wide: true, title: `Galla ka hissa · ${c.name}`, render: () => {
      const z = ui.zoneDraft, src = shot?.jpg ? 'data:image/jpeg;base64,' + shot.jpg : '';
      return `<p class="hint">Tasveer par ungli rakh kar <b>galla (paise ki tokri / drawer)</b> ke gird dabba khainchein. PC sirf is dabbe mein harkat dekhega; AI ko dabbe ke aas paas ka hissa bhi jata hai taake haath aur jeb nazar aayein.</p>
        <div class="zone-box">${src ? `<img src="${esc(src)}" alt="" draggable="false">` : '<p class="empty-line">Tasveer nahi — pehle Cameras mein "Abhi ki tasveer" dabayein.</p>'}<div class="zone-rect" ${z ? `style="left:${z.x * 100}%;top:${z.y * 100}%;width:${z.w * 100}%;height:${z.h * 100}%"` : 'hidden'}></div></div>
        <div class="btn-row"><button type="button" class="btn btn-primary" data-action="zone-save">${icon('check', 18)} Save</button><button type="button" class="btn btn-ghost" data-action="zone-clear">Saaf karein</button></div>`;
    } });
    const body = sheet.body; let start = null;
    const clamp = v => Math.min(1, Math.max(0, v));
    const rel = ev => { const box = body.querySelector('.zone-box'), r = box?.getBoundingClientRect?.(); if (!r || !r.width || !r.height) return null; return { x: clamp((ev.clientX - r.left) / r.width), y: clamp((ev.clientY - r.top) / r.height) }; };
    const draw = () => { const el = body.querySelector('.zone-rect'), z = ui.zoneDraft; if (!el) return; if (!z) { el.hidden = true; return; } el.hidden = false; Object.assign(el.style, { left: z.x * 100 + '%', top: z.y * 100 + '%', width: z.w * 100 + '%', height: z.h * 100 + '%' }); };
    body.addEventListener('pointerdown', ev => { if (!ev.target.closest?.('.zone-box img, .zone-box .zone-rect')) return; const p = rel(ev); if (!p) return; ev.preventDefault(); start = p; ui.zoneDraft = { x: p.x, y: p.y, w: 0, h: 0 }; draw(); try { ev.target.setPointerCapture?.(ev.pointerId); } catch { /* ignore */ } });
    body.addEventListener('pointermove', ev => { if (!start) return; const p = rel(ev); if (!p) return; ui.zoneDraft = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }; draw(); });
    body.addEventListener('pointerup', () => { start = null; });
    return sheet;
  }
  /* ---------- v218: Phones ki jaanch (staffDiag) ---------- */
  const verNum = v => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;
  const FAIL_KIND = { checkout: 'Check-Out', checkin: 'Check-In', return: 'Wapsi' };
  const failKindText = k => FAIL_KIND[k] || 'Likhai';
  function failWhy(code) {
    const c = String(code || '');
    if (c === 'permission-denied') return 'server ne ijazat nahi di — login / rules';
    if (['unavailable', 'deadline-exceeded', 'app/slow-network'].includes(c)) return 'internet';
    if (c === 'missing') return 'Check-In server par tha hi nahi';
    if (c === 'lost') return 'hazri phone se mit gayi';
    return c || 'maloom nahi';
  }
  const agoText = ms => { if (!ms) return '—'; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'abhi' : m < 60 ? `${m} min pehle` : m < 1440 ? `${Math.round(m / 60)} ghante pehle` : `${Math.round(m / 1440)} din pehle`; };
  const clockOf = ms => fmtTime(new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }));
  /** Har kaam wale staff ka phone: version, fail, der. Record na ho lekin aaj Check-In kiya ho = purani app (v218 se pehle wali record nahi likhti). */
  function phoneHealth() {
    const today = pkDate(), yday = addDays(today, -1), cur = verNum(APP_VERSION), byPhone = new Map((S.diag || []).map(d => [d.phone, d]));
    const inToday = new Set(data.attendanceBetween(today, today).filter(a => a.checkIn).map(a => a.phone));
    return activeStaff().map(acc => {
      const d = byPhone.get(acc.phone) || null, v = d?.v || '';
      const fail = d?.failAt && (d.failDate || '') >= yday && !(Number(d.fixedAt || 0) >= Number(d.failAt)) ? { kind: d.failKind, code: d.failCode, at: d.failAt, time: clockOf(d.failAt) } : null;
      const old = d ? verNum(v) < cur : inToday.has(acc.phone);
      const late = d?.lateAt && Date.now() - d.lateAt < 2 * 86400000 ? { kind: d.lateKind, min: d.lateMin, at: d.lateAt } : null;
      return { phone: acc.phone, name: acc.name || acc.phone, d, v, old, fail, late };
    });
  }
  function phonesSheet() {
    return openSheet({ id: 'phones', wide: true, title: 'Phones ki jaanch', render: () => {
      const list = phoneHealth().sort((a, b) => (b.fail ? 2 : 0) + (b.old ? 1 : 0) - ((a.fail ? 2 : 0) + (a.old ? 1 : 0)) || String(a.name).localeCompare(String(b.name)));
      const none = list.filter(x => !x.d).length;
      const chip = x => !x.d ? `<span class="ver-chip ${x.old ? 'is-old' : 'is-none'}">${x.old ? 'Purani app' : 'Record nahi'}</span>` : `<span class="ver-chip ${x.old ? 'is-old' : 'is-ok'}">${esc(x.v)}</span>`;
      return `<p class="hint">Har larke ka phone yahan batata hai ke us par kaunsi app hai aur kya server tak nahi gaya. Aap ki app: <b>${esc(APP_VERSION)}</b>.</p>
        ${none === list.length && list.length ? '<p class="notice tone-late">Kisi phone ka record nahi aaya. Firebase mein v218 wale rules Publish karein, phir larke apni app aik dafa kholein.</p>' : ''}
        <ul class="ledger phones">${list.map(x => `<li class="${x.fail ? 'is-bad' : ''}"><span><b>${nameHtml(x.name)}</b> ${chip(x)}
          <small>${x.d ? `${x.d.app === 'home' ? 'Home screen app' : 'Browser mein'} · ${esc(x.d.device || '')} · aakhri dafa ${esc(agoText(x.d.at))}${x.d.pending ? ` · <b class="txt-late">${x.d.pending} likhai phone mein ruki</b>` : ''}` : (x.old ? 'Aaj hazri lagayi lekin phone ne version nahi bataya — v218 se purani app' : 'Abhi tak app nahi kholi')}</small>
          ${x.fail ? `<small class="txt-bad">${esc(failKindText(x.fail.kind))} server par NAHI laga — ${esc(x.fail.time)} · wajah: ${esc(failWhy(x.fail.code))}</small>` : ''}
          ${x.late ? `<small class="txt-late">${esc(failKindText(x.late.kind))} ${esc(String(x.late.min))} min phone mein ruka raha, phir pohancha (${esc(agoText(x.late.at))})</small>` : ''}</span></li>`).join('') || '<li class="muted">Koi staff nahi.</li>'}</ul>
        <p class="hint">Purani app: larke se kahein app poori band kar ke dobara kholein, ya neeche "Update check karein" dabayein. "Internet" wali ghalti: larke ka net kamzor tha — app ab khud dobara bhejti hai. "Ijazat nahi di": larka Logout kar ke dobara login kare.</p>`;
    } });
  }
  function diagSheet() {
    return openSheet({ id: 'diag', wide: true, title: 'App ki jaanch', render: () => {
      const today = pkDate(), month = today.slice(0, 7), rowsToday = data.attendanceBetween(today, today);
      const known = new Set(S.staff.map(s => s.phone)), orphan = rowsToday.filter(a => !known.has(a.phone));
      let raw = ''; try { raw = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()); } catch { raw = '—'; }
      const sync = k => S.lastSync?.[k] ? fmtTime(new Date(S.lastSync[k]).toTimeString().slice(0, 5)) : 'abhi nahi';
      const line = (a, b, bad) => `<tr class="${bad ? 'txt-bad' : ''}"><td>${a}</td><td>${b}</td></tr>`;
      return `<p class="hint">Hazri na dikhe to is safhe ka screenshot bhejein.</p><table class="calc"><tbody>
        ${line('Version', esc(APP_VERSION))}
        ${line('App ki aaj ki tareekh', esc(today))}
        ${line('Phone ki tareekh (purana tareeqa)', esc(raw), raw !== today)}
        ${line('Internet', navigator.onLine === false ? 'Band' : 'Chalu', navigator.onLine === false)}
        ${line('Staff', S.staff.length + ' (' + activeStaff().length + ' kaam par)')}
        ${line(esc(monthLabel(month)) + ' ki hazri', data.monthLoaded(month) ? data.attendanceBetween(month + '-01', month + '-31').length + ' record' : 'load nahi hui', !data.monthLoaded(month))}
        ${line('Aaj ke record', rowsToday.length)}
        ${line('Aaj ke record jin ka staff list mein number nahi', orphan.length ? esc(orphan.map(a => a.phone + (a.name ? ' (' + a.name + ')' : '')).join(', ')) : '0', orphan.length)}
        ${line('Server se aakhri hazri', sync('att:' + month))}
        ${line('Ghaltiyan', Object.keys(S.errors || {}).length ? esc(Object.entries(S.errors).map(([k, v]) => k + ': ' + v).join(', ')) : 'Koi nahi', Object.keys(S.errors || {}).length)}
      </tbody></table>
      <h3 class="sub">Aaj ke record</h3>
      <ul class="ledger">${rowsToday.map(a => `<li><span><b>${nameHtml(account(a.phone)?.name || a.name || a.phone)}</b> <small>${esc(a.phone)} · id ${esc(a.id)}</small></span><span>${fmtTime(a.checkIn)} – ${fmtTime(a.checkOut)}</span></li>`).join('') || '<li class="muted">Aaj koi record server se nahi aaya.</li>'}</ul>`;
    } });
  }
  function passwordSheet() {
    return openSheet({ id: 'password', title: 'Password badlein', render: () => `<form class="form" data-form="password">
      <label>Mojooda password<input name="current" type="password" autocomplete="current-password" required></label>
      <label>Naya password <small>(kam az kam 6 harf)</small><input name="next" type="password" autocomplete="new-password" minlength="6" required></label>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Password badlein</button></div></form>` });
  }

  /* ================= SMART SEARCH ================= */
  function searchSheet(initial = '') {
    const sheet = openSheet({
      id: 'search', wide: true, title: 'Talash',
      render: () => `<div class="search-box">${icon('search')}<input id="smartInput" type="search" value="${esc(initial)}" placeholder="Naam, number ya sawal likhein…" autocomplete="off" data-input="smart" aria-label="Talash"></div>
        <div class="chips wrap">${['late is hafte', 'ghair hazir aaj', 'checkout baqi', 'salary baqi', 'advance is mahine', 'chutti is mahine', 'late pichle mahine'].map(t => `<button type="button" class="chip" data-action="search-run" data-arg="${t}">${t}</button>`).join('')}</div>
        <div id="smartResults"></div>`
    });
    sheet.refresh = () => renderResults(); // input ko dobara na banao, sirf nateeje
    const renderResults = () => {
      const input = $('#smartInput', sheet.el), box = $('#smartResults', sheet.el); if (!input || !box) return;
      const query = input.value;
      if (!query.trim()) { box.innerHTML = '<p class="hint">Misal: "ali", "0300", "late is hafte", "ghair hazir kal", "15 sep", "salary baqi".</p>'; return; }
      let res = smartSearch({ query, staff: activeStaff(), attendance: data.allAttendance(), payroll: S.payroll, ...context() });
      const p = res.parsed, months = new Set();
      if (p.from) for (let m = p.from.slice(0, 7); m <= p.to.slice(0, 7) && months.size < 4; m = addMonths(m, 1)) months.add(m);
      const waiting = [...months].filter(m => !data.monthLoaded(m)); waiting.forEach(m => data.watchMonth(m));
      const head = `<p class="result-head"><b>${res.mode === 'people' ? res.people.length + ' staff' : res.mode === 'money' ? res.money.length + ' staff' : res.rows.length + ' record'}</b> ${esc(res.summary)}</p>${waiting.length ? '<p class="loading-line">Purana mahina load ho raha hai…</p>' : ''}`;
      let body = '';
      if (res.mode === 'people') body = res.people.map(s => `<li class="row"><button type="button" class="row-main" data-action="profile" data-phone="${s.phone}">${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')} &nbsp;|&nbsp; ${esc(s.phone)}</small></span></button><button type="button" class="row-pdf" data-action="pdf-staff" data-phone="${s.phone}" data-month="${pkDate().slice(0, 7)}">${icon('pdf', 18)}<span>PDF</span></button></li>`).join('');
      else if (res.mode === 'money') body = res.money.map(({ account: s, calc }) => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${s.phone}" data-month="${calc.month}">${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(monthLabel(calc.month))}${calc.advance ? ' &nbsp;|&nbsp; Advance ' + money(calc.advance) : ''}</small></span><span class="amount"><b>${money(calc.balance)}</b><small>baqi</small></span></button></li>`).join('');
      else body = res.rows.map(r => `<li class="row s-${r.status}"><button type="button" class="row-main" data-action="${r.due ? 'edit-att' : 'profile'}" data-phone="${r.account.phone}" data-date="${r.date}">${avatar(r.account)}<span class="row-text"><b>${nameHtml(r.account.name)}</b><small>${esc(shortDate(r.date))}${r.a.checkIn ? ' &nbsp;|&nbsp; ' + fmtTime(r.a.checkIn) + ' to ' + (r.a.checkOut ? fmtTime(r.a.checkOut) : 'baqi') : ''}</small></span><span class="stamp st-${r.due ? 'absent' : r.status}">${r.due ? 'Check-Out baqi' : r.status === 'late' ? 'Late ' + r.late + 'm' : STATUS_LABEL[r.status]}</span></button></li>`).join('');
      box.innerHTML = head + (body ? `<ol class="register">${body}</ol>` : '<p class="empty-line">Kuch nahi mila. Alfaaz badal kar dekhein.</p>');
    };
    sheet.run = text => { const input = $('#smartInput', sheet.el); input.value = text; renderResults(); };
    renderResults();
    setTimeout(() => $('#smartInput', sheet.el)?.focus(), 60);
    return sheet;
  }

  /* ================= PDF ================= */
  async function makePdf(button, build) {
    await busy(button, async () => {
      const lib = await loadPdfLib();
      deliverPdf(await build(lib, browserTextImages));
    });
  }
  const needMonth = month => { data.watchMonth(month); if (!data.monthLoaded(month)) throw new Error(`${monthLabel(month)} ki hazri abhi load ho rahi hai. 2-3 second baad dobara dabayein.`); };

  /* ================= actions ================= */
  let sheets = {};
  const open = (key, make) => { sheets[key]?.close(); sheets[key] = make(); return sheets[key]; };
  const actions = {
    tab(el) {
      ui.tab = el.dataset.arg; if (ui.tab === 'salary') data.watchMonth(ui.salaryMonth);
      // v222: Nigrani ke events sirf jab tab khula ho (tasveerein bhaari); 30 din purane aik dafa saaf
      if (ui.tab === 'nigrani' && !manager) { data.watchEvents(ui.nigDay || pkDate()); if (!ui.camCleaned) { ui.camCleaned = true; data.cleanupCam().catch(() => {}); } }
      else if (S.camDay) data.watchEvents('');
      rerender(); window.scrollTo?.(0, 0);
    },
    view(el) { ui.view = el.dataset.arg; if (ui.view === 'month') { ui.month = ui.date.slice(0, 7); data.watchMonth(ui.month); } rerender(); },
    filter(el) { ui.filter = el.dataset.arg; rerender(); },
    step(el) {
      const n = +el.dataset.arg, today = pkDate();
      if (ui.view === 'day') { const d = addDays(ui.date, n); if (d <= today) ui.date = d; data.watchMonth(ui.date.slice(0, 7)); }
      else { const m = addMonths(ui.month, n); if (m <= today.slice(0, 7)) ui.month = m; data.watchMonth(ui.month); }
      rerender();
    },
    today() { ui.date = pkDate(); ui.month = ui.date.slice(0, 7); rerender(); },
    'sal-step'(el) { const m = addMonths(ui.salaryMonth, +el.dataset.arg); if (m <= pkDate().slice(0, 7)) ui.salaryMonth = m; data.watchMonth(ui.salaryMonth); rerender(); },
    'salary-month'(el) { ui.salaryMonth = el.dataset.arg; ui.tab = 'salary'; data.watchMonth(ui.salaryMonth); rerender(); },
    search() { open('search', () => searchSheet()); },
    'search-run'(el) { const s = sheets.search?.el.isConnected ? sheets.search : open('search', () => searchSheet(el.dataset.arg)); s.run(el.dataset.arg); },
    profile(el) { open('profile', () => profileSheet(el.dataset.phone, el.dataset.date)); },
    'profile-step'(el) { sheets.profile?.step(+el.dataset.arg); },
    'edit-att'(el) { open('att', () => attendanceSheet(el.dataset.phone, el.dataset.date)); },
    async 'att-delete'(el) { if (!confirm('Is din ki hazri hata dein?')) return; await busy(el, async () => { await data.deleteAttendance(el.dataset.id, 'Malik ne hazri hatayi'); sheets.att?.close(); }, 'Hazri hata di'); },
    leave(el) { open('leave', () => leaveSheet(el.dataset.phone)); },
    async 'leave-cancel'(el) { if (!confirm('Ye chutti cancel karein?')) return; await busy(el, () => data.cancelLeave(el.dataset.id), 'Chutti cancel ho gayi'); },
    requests() { open('requests', requestsSheet); },
    async req(el) { const paid = el.dataset.paid ? el.dataset.paid === 'yes' : undefined; await busy(el, () => data.reviewRequest(el.dataset.id, el.dataset.arg, '', paid), el.dataset.arg === 'approved' ? (paid === false ? 'Manzoor — paisa katega' : 'Manzoor ho gayi') : 'Na-manzoor kar di'); },
    settings(el) { const arg = el?.dataset.arg; actions[arg === 'salary' ? 'cfg-salary' : 'cfg-duty'](); },
    'cfg-duty'() { open('cfg', dutySheet); },
    'cfg-salary'() { open('cfg', salaryRulesSheet); },
    'cfg-checkin'() { open('cfg', checkinSheet); },
    async 'migrate-selfies'(el) {
      if (!confirm('Purane hazri records ki selfies alag jagah rakh di jayengi (aik dafa ka kaam, 1-2 minute). Selfies mitengi nahi, daba kar pehle ki tarah dikhengi. Shuru karein?')) return;
      await busy(el, async () => { const n = await data.migrateSelfies((done, m) => { const t = $('#toast'); if (t) { t.textContent = `${done} selfie alag ho gayin (${monthLabel(m)})…`; t.className = 'toast show'; } }); toast(n ? `${n} selfie alag ho gayin. App ab halki hai.` : 'Koi purani selfie nahi mili — app pehle se halki hai.', 'ok'); });
    },
    khata() { open('khata', khataSheet); },
    diag() { open('diag', diagSheet); },
    phones() { open('phones', phonesSheet); },
    cameras() { if (manager) return toast('Cameras sirf malik ke liye hain', 'bad'); open('cameras', camerasSheet); },
    async 'cam-code'(el) {
      if (S.camCfg && !confirm('Naya PC code banayein? Purana PC code band ho jayega — PC par dobara command chalani hogi.')) return;
      await busy(el, async () => { ui.camCode = await data.createCameraPC(); });
      sheets.cameras?.refresh(true);
    },
    async 'cam-copy'() { const t = camCommand(); try { await navigator.clipboard.writeText(t); toast('Command copy ho gayi', 'ok'); } catch { prompt('Ye command copy karein:', t); } },
    async 'cam-snap'(el) { await busy(el, () => data.requestShot(el.dataset.id), 'PC ko keh diya — 20-30 second mein nayi tasveer'); },
    'cam-edit'(el) { ui.camEdit = el.dataset.id || ''; sheets.cameras?.refresh(true); },
    async 'cam-del'(el) {
      const c = (S.cameras || []).find(x => x.id === el.dataset.id); if (!c || !confirm(`"${c.name}" camera hatayein? PC par dobara jodna pare ga.`)) return;
      await busy(el, () => data.deleteCamera(c.id), 'Camera hata diya'); ui.camEdit = ''; sheets.cameras?.refresh(true);
    },
    'cam-zone'(el) { open('cam-zone', () => zoneSheet(el.dataset.id)); },
    async 'zone-save'(el) { await busy(el, () => data.saveZone(ui.zoneCam, ui.zoneDraft), ui.zoneDraft ? 'Galla ka hissa save — PC 20-30 second mein nigrani shuru karega' : 'Dabba hata diya — nigrani band'); sheets['cam-zone']?.close(); },
    'zone-clear'() { ui.zoneDraft = null; sheets['cam-zone']?.refresh(true); },
    'nig-day'(el) { const d = addDays(ui.nigDay || pkDate(), Number(el.dataset.arg)); if (d > pkDate()) return; ui.nigDay = d; ui.nigFilter = 'all'; data.watchEvents(d); rerender(); },
    'nig-filter'(el) { ui.nigFilter = el.dataset.arg; rerender(); },
    'nig-open'(el) { open('nig-ev', () => eventSheet(el.dataset.id)); },
    'nig-idx'(el) { ui.nigIdx = Number(el.dataset.arg) || 0; sheets['nig-ev']?.refresh(true); },
    'nig-full'(el) { const fr = ui.nigFrames?.[el.dataset.id], e = (S.camEvents || []).find(x => x.id === el.dataset.id); if (fr?.length) viewImage('data:image/jpeg;base64,' + fr[Math.min(ui.nigIdx || 0, fr.length - 1)], `${e?.camName || 'Galla'} · ${e ? clockOf(e.at) : ''}`); },
    'cam-photo'(el) { const c = (S.cameras || []).find(x => x.id === el.dataset.id), shot = S.camShots?.get?.(el.dataset.id); if (shot?.jpg) viewImage('data:image/jpeg;base64,' + shot.jpg, `${c?.name || 'Camera'} · ${agoText(shot.at)}`); },
    links() { open('links', linksSheet); },
    'selfies-day'(el) { needMonth(el.dataset.arg.slice(0, 7)); open('selfies', () => selfiesDaySheet(el.dataset.arg)); },
    history() { open('history', historySheet); },
    notify() { open('notify', notifySheet); },
    async 'push-on'(el) {
      ui.pushMsg = null; refreshSheets();
      try {
        if (!(await pushSupported())) throw new Error('Is browser mein notification nahi chalti. App ko home screen par install kar ke wahan se kholein.');
        const token = await enablePush({ app: data.app, vapidKey: S.config.push?.vapidKey, onToken: t => data.savePushToken(t, navigator.userAgent.slice(0, 60)), onMessage: d => toast(`${d.title || ''} ${d.body || ''}`.trim(), 'ok') });
        ui.pushToken = token;
        await data.saveConfig({ appUrl: appLink() });
        const list = await data.pushDevices().catch(() => []);
        ui.pushSaved = list.some(d => d.token === token);
        ui.pushMsg = ui.pushSaved ? { text: 'Chalu ho gaya. Ab "Test notification bhejein" daba kar dekh lein.' } : { bad: true, text: 'Token to ban gaya lekin Firebase mein mehfooz nahi hua. Firestore rules ka naya version publish karein.' };
      } catch (error) { ui.pushMsg = { bad: true, text: errorText(error) }; }
      sheets.notify?.refresh(true); rerender();
    },
    async 'push-off'(el) {
      await busy(el, async () => { const t = ui.pushToken; if (t) { await data.removePushToken(t); await disablePush({ app: data.app }).catch(() => {}); } ui.pushToken = ''; ui.pushSaved = null; ui.pushMsg = { text: 'Is phone par notification band kar diya.' }; });
      sheets.notify?.refresh(true); rerender();
    },
    async 'push-test'(el) {
      await busy(el, async () => {
        if (!ui.pushToken) throw new Error('Pehle is phone par notification chalu karein.');
        await data.pushTestPing(ui.pushToken);
        ui.pushMsg = { text: 'Test bhej diya. 5-10 second mein phone par notification aana chahiye. Na aaye to Firebase par functions ka naya version upload karein.' };
      });
      sheets.notify?.refresh(true);
    },
    async 'push-key-clear'() { if (!confirm('Firebase ki key hata dein? Phir dobara lagani hogi.')) return; await data.saveConfig({ push: { ...(S.config.push || {}), vapidKey: '' } }).catch(e => toast(errorText(e), 'bad')); ui.pushMsg = null; sheets.notify?.refresh(true); },
    async 'push-devices'(el) {
      await busy(el, async () => {
        const list = await data.pushDevices();
        openSheet({ id: 'push-devices', title: 'Notification wale phones', render: () => list.length
          ? `<ul class="ledger">${list.map(d => `<li><span><b>${esc(d.name || d.phone || '—')}</b> <small>${d.role === 'owner' ? 'Malik' : d.role === 'manager' ? 'Manager' : 'Staff'}${d.device ? ' · ' + esc(String(d.device).replace(/^d:\w+ · /, '').slice(0, 40)) : ''}</small></span><small class="muted">${d.at ? esc(shortDate(pkDate(new Date(d.at)))) : ''}</small></li>`).join('')}</ul>`
          : '<p class="empty-line">Abhi kisi phone par chalu nahi. Har phone par "Is phone par notification chalu karein" dabana hota hai.</p>' });
      });
    },
    async 'notify-on'(el) { await busy(el, () => data.saveConfig({ notify: { topic: newTopic(), on: true, out: true, leave: true, late: true, ticket: true } }), 'Notifications chalu — ab ntfy app mein topic subscribe karein'); },
    async 'notify-new'(el) { if (!confirm('Naya topic banayein? Purana topic kaam karna band kar dega; ntfy app mein naya subscribe karna hoga.')) return; await busy(el, () => data.saveConfig({ notify: { ...(S.config.notify || {}), topic: newTopic(), on: true } }), 'Naya topic ban gaya'); },
    async 'notify-toggle'(el) { const n = S.config.notify || {}; await busy(el, () => data.saveConfig({ notify: { ...n, on: !n.on } }), n.on ? 'Notifications band' : 'Notifications chalu'); },
    async 'notify-copy'() { const t = S.config.notify?.topic || ''; try { await navigator.clipboard.writeText(t); toast('Topic copy ho gaya', 'ok'); } catch { prompt('Ye topic copy karein:', t); } },
    async 'notify-test'(el) { await busy(el, async () => { const ok = await sendNotify(S.config, 'test', { title: 'NT Hazri — test', message: 'Notification theek chal rahi hai.', click: appLink(), tags: ['white_check_mark'] }); if (!ok) throw new Error('Test nahi gaya. Internet check karein, ya notifications chalu karein.'); }, 'Test bhej diya — phone par dekhein'); },
    tickets(el) { open('tickets', () => ticketsSheet(el?.dataset.arg || '')); },
    'tickets-filter'(el) { sheets.tickets?.setOnly(el.dataset.arg); },
    'ticket-new'(el) {
      const today = pkDate(), att = data.attendanceBetween(today, today);
      const people = activeStaff().map(s => ({ phone: s.phone, name: s.name + (att.find(a => a.phone === s.phone && a.checkIn && !a.checkOut) ? '' : ' (duty par nahi)') }));
      open('ticketNew', () => openTicketSheet({ people, preset: el?.dataset.phone || '', onCreate: v => data.createTicket(v) }));
    },
    async 'ticket-return'(el) { const t = S.tickets.find(x => x.id === el.dataset.id); if (!t) return; await busy(el, () => data.returnTicket(t), 'Wapsi lag gayi'); },
    async 'ticket-decide'(el) {
      const id = el.dataset.id, d = el.dataset.arg, amt = el.closest('.req')?.querySelector(`[data-ticket-amount]`)?.value;
      if (d === 'katauti' && !confirm(`${money(amt)} ki katauti is mahine ki salary se kaat dein?`)) return;
      await busy(el, () => data.decideTicket(id, d, amt), d === 'katauti' ? 'Katauti lag gayi' : d === 'warning' ? 'Warning likh di' : 'Maaf kar diya');
    },
    'break-start'() {
      const today = pkDate(), att = data.attendanceBetween(today, today);
      const people = activeStaff().map(s => { const a = att.find(x => x.phone === s.phone); return { phone: s.phone, name: s.name, group: breakGroup(s), onDuty: !!(a?.checkIn && !a.checkOut), busy: !!dayOuts(S.outs, s.phone, today, Date.now(), 'all').open }; });
      open('break', () => openBreakSheet({ people, onStart: (phones, m) => data.startBreak(phones, m) }));
    },
    async 'break-end-one'(el) { const o = S.outs.find(x => x.id === el.dataset.id); if (!o || !confirm(`${account(o.phone)?.name || o.name || ''} ki wapsi abhi laga dein?`)) return; await busy(el, () => data.endBreaks([o]), 'Wapsi lag gayi'); },
    async 'break-end-all'(el) { const list = S.outs.filter(o => o.kind === 'break' && o.status === 'approved' && o.date === pkDate()); if (!list.length || !confirm(`${list.length} larkon ki wapsi abhi laga dein?`)) return; await busy(el, () => data.endBreaks(list), 'Sab ki wapsi lag gayi'); },
    async 'copy-link'(el) { const url = loginLink(el.dataset.phone); try { await navigator.clipboard.writeText(url); toast('Link copy ho gaya', 'ok'); } catch { prompt('Ye link copy karein:', url); } },
    async install() { if (install?.canPrompt) { await install.prompt(); rerender(); } else toast('Chrome ⋮ menu › "Add to Home screen" / "Install app" dabayein', 'ok'); },
    outs(el) { open('outsSheet', () => outsSheet(el?.dataset.arg || pkDate())); },
    async 'out-review'(el) { const yes = el.dataset.arg === 'yes'; await busy(el, () => data.reviewOut(el.dataset.id, yes), yes ? 'Manzoor — larke ke phone par Gate Pass khul gaya' : 'Mana kar diya'); },
    async 'out-return'(el) { const o = S.outs.find(x => x.id === el.dataset.id); if (!o || !confirm('Is larke ki wapsi abhi ke waqt par laga dein?')) return; await busy(el, () => data.returnOut(o), 'Wapsi lag gayi'); },
    async excel(el) {
      const month = el.dataset.arg || ui.month;
      await busy(el, async () => {
        needMonth(month);
        const X = await loadXlsx(), buf = X.write(excelWorkbook(X, month), { type: 'array', bookType: 'xlsx' });
        deliverPdf({ blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: `NoorTraders_Hazri_Salary_${month}.xlsx` });
      });
    },
    'tix-open'(el) { ui.openTickets.add(el.dataset.arg); rerender(); },
    async tix(el) {
      const { phone, date, kind, arg } = el.dataset, a = data.attendanceBetween(date, date).find(x => x.phone === phone);
      await busy(el, async () => {
        if (kind === 'in') {
          if (a?.checkIn) await data.saveAttendance({ phone, date, checkIn: arg, checkOut: a.checkOut, note: a.ownerNote || 'Malik ne waqt badla' });
          else await data.quickPresent(phone, date, arg);
        } else {
          if (!a?.checkIn) throw new Error('Pehle aane ka waqt lagayein.');
          await data.saveAttendance({ phone, date, checkIn: a.checkIn, checkOut: arg, note: a.ownerNote || 'Malik ne Check-Out lagaya', finalScore: a.finalScore ?? '' });
        }
      }, `${account(phone)?.name || ''}: ${kind === 'in' ? 'Aaya' : 'Gaya'} ${fmtTime(arg)}`);
    },
    async 'quick-present'(el) { await busy(el, () => data.quickPresent(el.dataset.phone, el.dataset.date), 'Hazir lag gayi'); },
    async 'quick-present-all'(el) {
      const date = el.dataset.arg, list = rowsFor(date).filter(r => ['absent', 'waiting'].includes(r.status));
      if (!list.length || !confirm(`${list.length} staff ko ${shortDate(date)} ki hazir laga dein?\n${list.map(r => r.account.name).join(', ')}\n\nAane ka waqt duty shuru wala lagega.`)) return;
      await busy(el, async () => { for (const r of list) await data.quickPresent(r.account.phone, date); }, `${list.length} ki hazir lag gayi`);
    },
    async 'close-due'(el) {
      const all = data.allAttendance().filter(a => checkoutDue(a, data.scheduleFor(a.phone)) && account(a.phone));
      const list = el.dataset.arg ? all.filter(a => a.id === el.dataset.arg) : all;
      if (!list.length) return;
      if (!confirm(`${list.length > 1 ? list.length + ' staff ka' : (account(list[0].phone)?.name || '') + ' ka'} Check-Out duty khatam ke waqt par band kar dein?\n${list.map(a => `${account(a.phone)?.name} (${shortDate(a.date)})`).join(', ')}`)) return;
      await busy(el, async () => {
        const r = await data.closeCheckouts(list);
        if (r.failed.length) toast(`${r.done} band ho gaye. In ka waqt khud durust karein: ${r.failed.join(', ')}`, 'bad'); else toast('Check-Out band ho gaya', 'ok');
      });
    },
    async 'toggle-closed'(el) {
      const date = el.dataset.arg, on = isClosed(resolveBase(), date);
      let reason = '';
      if (!on) { reason = prompt(`${dateLabel(date)} — dukaan kyun band thi? (Eid, jumma, chutti…)`, 'Dukaan band'); if (reason === null) return; }
      else if (!confirm('Is din ka "dukaan band" hata dein?')) return;
      await busy(el, () => data.toggleClosed(date, reason), on ? 'Dukaan band hata diya' : 'Is din sab ki chutti (dukaan band)');
    },
    async 'apply-shift-all'(el) { if (!confirm('Sab staff par default duty lagayein? Jin ki alag timing thi wo bhi default par aa jayenge.')) return; await busy(el, () => data.applyDefaultShiftAll(), 'Sab par default duty lag gayi'); },
    async 'apply-salary-all'(el) { if (!confirm('Sab staff par default salary lagayein?\nFinal ho chuke mahine nahi badlenge. Kisi ki apni salary baad mein bhi wapas lagayi ja sakti hai.')) return; await busy(el, () => data.applyDefaultSalaryAll(), 'Sab par default salary lag gayi'); },
    'pdf-slips'(el) {
      const month = ui.salaryMonth;
      return makePdf(el, async (lib, textImages) => {
        needMonth(month);
        const out = [];
        for (const s of activeStaff()) out.push(await staffMonthPdf(lib, { account: s, month, summary: summaryFor(s, month), calc: data.calcFor(s, month), schedule: data.scheduleFor(s.phone), textImages }));
        if (!out.length) throw new Error('Abhi koi staff nahi.');
        return out;
      });
    },
    password() { open('password', passwordSheet); },
    update(el) { busy(el, () => checkUpdate(true)); },
    logout() { if (confirm('Logout karein?')) logout(); },
    'staff-new'() { open('staffForm', () => staffForm('')); },
    'staff-edit'(el) { open('staffForm', () => staffForm(el.dataset.phone)); },
    async 'staff-delete'(el) {
      const s = account(el.dataset.phone);
      if (!confirm(`${s?.name || ''} ko hamesha ke liye delete karein?\n\nBehtar ye hai ke "Kaam par hai" ka nishan hata dein — is tarah hazri aur salary ka record mehfooz rehta hai.`)) return;
      await busy(el, async () => { await data.deleteStaff(el.dataset.phone); sheets.staffForm?.close(); }, 'Staff delete ho gaya');
    },
    'toggle-inactive'() { ui.showInactive = !ui.showInactive; rerender(); },
    salary(el) { if (el.dataset.month) { ui.salaryMonth = el.dataset.month; data.watchMonth(ui.salaryMonth); } open('salary', () => salarySheet(el.dataset.phone)); },
    async final(el) {
      const phone = el.dataset.phone, frozen = data.payrollFor(phone, ui.salaryMonth)?.state === 'final';
      if (!confirm(frozen ? 'Ye mahina dobara kholein? Hisab phir se hazri ke mutabiq chalega.' : `${monthLabel(ui.salaryMonth)} ki salary final karein? Is ke baad hisab jam jata hai aur payment likhi ja sakti hai.`)) return;
      await busy(el, async () => { needMonth(ui.salaryMonth); await data.toggleFinal(phone, ui.salaryMonth, frozen ? 'Malik ne dobara khola' : 'Malik ne final kiya'); }, frozen ? 'Mahina dobara khul gaya' : 'Salary final ho gayi');
    },
    async 'extra-del'(el) { if (!confirm('Ye entry hata dein?')) return; await busy(el, () => data.removeExtra(el.dataset.phone, el.dataset.id), 'Entry hata di'); },
    'pdf-day'(el) { return makePdf(el, (lib, textImages) => { needMonth(ui.date.slice(0, 7)); return dailyPdf(lib, { date: ui.date, rows: rowsFor(ui.date), textImages }); }); },
    'pdf-register'(el) { return makePdf(el, (lib, textImages) => { needMonth(ui.month); return registerPdf(lib, { month: ui.month, grid: activeStaff().map(s => ({ account: s, summary: summaryFor(s, ui.month) })), textImages }); }); },
    'pdf-salary'(el) { return makePdf(el, (lib, textImages) => { needMonth(ui.salaryMonth); return salarySheetPdf(lib, { month: ui.salaryMonth, rows: salaryRows(ui.salaryMonth), textImages }); }); },
    'pdf-staff'(el) {
      const phone = el.dataset.phone, month = el.dataset.month || pkDate().slice(0, 7);
      return makePdf(el, (lib, textImages) => { needMonth(month); const s = account(phone); return staffMonthPdf(lib, { account: s, month, summary: summaryFor(s, month), calc: data.calcFor(s, month), schedule: data.scheduleFor(phone), textImages }); });
    }
  };
  const forms = {
    async 'nig-review'(form, v, button) { // v222: malik ka faisla
      const status = button?.value || v.status;
      await busy(button, () => data.reviewEvent(form.dataset.id, status, v.note), status === 'confirmed' ? 'Shak pakka likh diya' : 'Theek hai likh diya');
      sheets['nig-ev']?.close();
    },
    async cam(form, v, button) { // v220: camera ka naam / kaam / on-off; v222: AI ki had + harkat ki hissasiyat
      await busy(button, () => data.saveCamera(form.dataset.id, { name: v.name, role: v.role, enabled: !!v.enabled, aiCap: v.aiCap, sens: v.sens }), 'Camera save ho gaya');
      ui.camEdit = ''; sheets.cameras?.refresh(true);
    },
    async vapid(form, v, button) { await busy(button, async () => { await data.saveConfig({ push: { ...(S.config.push || {}), vapidKey: String(v.vapidKey || '').trim().replace(/\s+/g, ''), on: true }, appUrl: appLink() }); ui.pushMsg = { text: 'Key lag gayi. Ab "Is phone par notification chalu karein" dabayein.' }; sheets.notify?.refresh(true); }, 'Key save ho gayi'); },
    async staff(form, v, button) {
      await busy(button, async () => { await data.saveStaff({ ...v, photo: sheets.staffForm?.getPhoto() }, form.dataset.phone); sheets.staffForm?.close(); }, 'Staff save ho gaya');
    },
    async att(form, v, button) {
      await busy(button, async () => { await data.saveAttendance({ phone: form.dataset.phone, date: v.date, checkIn: v.checkIn, checkOut: v.checkOut, note: v.note }); sheets.att?.close(); }, 'Hazri save ho gayi');
    },
    async leave(form, v, button) { await busy(button, async () => { await data.markLeave({ phone: form.dataset.phone, ...v }); sheets.leave?.close(); }, 'Chutti lag gayi'); },
    async cfg(form, v, button) { await busy(button, async () => { await data.saveConfig(v); sheets.cfg?.close(); }, 'Save ho gaya'); },
    async password(form, v, button) {
      await busy(button, async () => {
        try { await controller.changeOwnerPassword(v.current, v.next); } catch (e) { if (/wrong-password|invalid-credential/.test(e.code || '')) throw new Error('Mojooda password ghalat hai.'); throw e; }
        sheets.password?.close();
      }, 'Password badal gaya');
    },
    async extra(form, v, button) { await busy(button, async () => { await data.addExtra(form.dataset.phone, { ...v, month: ui.salaryMonth }); form.reset(); }, 'Likh diya'); },
    async payment(form, v, button) { await busy(button, () => data.addPayment(form.dataset.phone, ui.salaryMonth, v), 'Payment likh di'); }
  };
  const changes = {
    'pick-date'(el) { if (!el.value) return; if (ui.view === 'day') { if (isDate(el.value) && el.value <= pkDate()) ui.date = el.value; data.watchMonth(ui.date.slice(0, 7)); } else { ui.month = el.value; data.watchMonth(ui.month); } rerender(); },
    'pick-salary-month'(el) { if (!el.value) return; ui.salaryMonth = el.value; data.watchMonth(ui.salaryMonth); rerender(); },
    async 'staff-photo'(el) { const f = el.files?.[0]; if (!f) return; try { sheets.staffForm?.setPhoto(await fileToDataUrl(f, 360)); } catch (e) { toast(errorText(e), 'bad'); } },
    'leave-half'(el) { const f = el.closest('form'), half = f.querySelector('[name=half]:checked')?.value || ''; const to = f.querySelector('#leaveTo'); if (to) to.hidden = !!half; if (half) f.elements.to.value = f.elements.date.value; },
    async 'push-auto'(el) { await data.saveConfig({ push: { ...(S.config.push || {}), on: el.checked } }).catch(e => toast(errorText(e), 'bad')); },
    async 'push-after'(el) { const n = Math.max(5, Math.min(180, Number(el.value) || 30)); await data.saveConfig({ push: { ...(S.config.push || {}), [el.dataset.arg]: n } }).catch(e => toast(errorText(e), 'bad')); },
    async 'notify-kind'(el) { const n = { ...(S.config.notify || {}) }; n[el.dataset.arg] = el.checked; try { await data.saveConfig({ notify: n }); } catch (e) { toast(errorText(e), 'bad'); } },
    'history-who'(el) { sheets.history?.setWho(el.value); },
    'toggle-box'(el) { const box = $('#' + el.dataset.arg, el.closest('form')); if (box) box.hidden = el.dataset.invert ? el.checked : !el.checked; },
    'extra-kind'(el) { const per = el.form.elements.perMonth; if (per) { per.hidden = el.value !== 'loan'; per.required = el.value === 'loan'; } }
  };
  const inputs = {
    'staff-query'(el) { // list dobara banaye baghair chhanti, taake likhte waqt keyboard band na ho
      ui.staffQuery = el.value; const q = el.value.trim().toLowerCase(); let n = 0;
      for (const li of el.closest('.view').querySelectorAll('[data-search]')) { li.hidden = !!q && !li.dataset.search.includes(q); if (!li.hidden) n++; }
      const empty = $('#staffEmpty', el.closest('.view')); if (empty) empty.hidden = n > 0;
    },
    smart() { sheets.search?.refresh(); }
  };

  function render() {
    const pend = pending().length;
    const tabs = [['hazri', 'Hazri', 'book'], ['salary', 'Salary', 'wallet'], ['staff', 'Staff', 'people'], ...(manager ? [] : [['nigrani', 'Nigrani', 'camera']]), ['settings', 'Settings', 'clock']];
    return `<header class="top"><div class="top-in">
        <div class="brand"><span class="brand-mark" aria-hidden="true">NT</span><span><b>Noor Traders</b><small>${manager && !S.pendingWrites ? 'Manager panel · ' + nameHtml(S.account?.name || '') : ''}${S.pendingWrites ? `<span class="sync-pill">${icon('clock', 13)} ${S.pendingWrites} entry server par ja rahi</span>` : manager ? '' : 'Hazri register'}</small></span></div>
        <nav class="tabs" aria-label="Hisse">${tabs.map(([k, label, ic]) => `<button type="button" data-action="tab" data-arg="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${icon(ic, 22)}<span>${label}</span>${k === 'settings' && pend + S.outs.filter(o => o.status === 'pending').length ? `<em class="badge">${pend + S.outs.filter(o => o.status === 'pending').length}</em>` : ''}</button>`).join('')}</nav>
        <button type="button" class="search-btn" data-action="search">${icon('search', 18)}<span>Talash: naam, "late is hafte"…</span></button>
      </div></header>
      <main class="view view-${ui.tab}">${!S.loaded.has('staff') ? '<p class="loading-line">Data aa raha hai…</p>' : ''}${ui.tab === 'hazri' ? hazriTab() : ui.tab === 'salary' ? salaryTab() : ui.tab === 'staff' ? staffTab() : ui.tab === 'nigrani' && !manager ? nigraniTab() : settingsTab()}</main>`;
  }
  // v211: manager sab kar sakta hai, sirf hazri lagana / badalna / hatana nahi
  if (manager) {
    const blocked = () => toast('Hazri lagana ya badalna sirf malik ka kaam hai.', 'bad');
    for (const k of ['tix', 'tix-open', 'quick-present', 'quick-present-all', 'close-due', 'toggle-closed', 'att-delete', 'migrate-selfies', 'fill-time']) if (actions[k]) actions[k] = blocked;
    forms.att = blocked;
  }
  const renderAll = () => { const html = render(); return manager ? html.replace('<main class="view', '<main data-mgr="1" class="view') : html; };
  // v216: app khulte hi notification ka token chupke se taza (ijazat pehle se ho to) — har dafa button na dabana pade
  let pushChecked = false;
  function autoPush() {
    if (pushChecked || !S.loaded?.has?.('config') || !S.config.push?.vapidKey) return;
    pushChecked = true;
    void refreshPush({ app: data.app, vapidKey: S.config.push.vapidKey, onToken: t => data.savePushToken(t, (navigator.userAgent || '').slice(0, 60)), onMessage: d => toast(`${d.title || ''} ${d.body || ''}`.trim(), 'ok') })
      .then(t => { if (t) { ui.pushToken = t; ui.pushSaved = true; sheets.notify?.refresh(true); } });
  }
  return { render: renderAll, actions, forms, changes, inputs, ui, onData() { refreshSheets(); autoPush(); } };
}
