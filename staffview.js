// staffview.js — staff ka apna panel. Sirf apni hazri, apni salary, apni request.
import {
  APP_VERSION, STATUS_LABEL, DAY_SHORT, SHOP, esc, money, hm, fmtTime, pkDate, pkMinutes, addMonths, weekday, monthLabel, dateLabel, shortDate,
  monthSummary, openRecord, workMinutes, parseTime, checkoutDue, shiftMinutes, dayOuts, outMinutes, OUT_REASONS, OUT_MINUTES, reasonUr, minutesUr, dayColor, durText, hasArabic, breakGroup, ticketMinutes, ticketText
} from './core.js';
import { openTicketSheet } from './tickets.js';
import { openBreakSheet, breakStatusHtml } from './breaks.js';
import { icon, avatar, nameHtml, toast, busy, takeSelfie, getGps, deliverPdf, errorText, timeField, IN_TICKETS, OUT_TICKETS, openSheet, refreshSheets } from './ui.js';
// v215: PDF ka code sirf tab load hota hai jab larka PDF banaye
const pdfMod = () => import('./pdf.js');

export function createStaffView({ data, rerender, logout, checkUpdate, install }) {
  const S = data.state;
  const TAB_KEY = 'nt-hazri-staff-tab';
  const savedTab = (() => { try { const t = localStorage.getItem(TAB_KEY); return ['hazri', 'salary', 'request'].includes(t) ? t : 'hazri'; } catch { return 'hazri'; } })();
  const ui = { tab: savedTab, month: pkDate().slice(0, 7), step: '', reqKind: 'leave' };
  const me = () => S.account || { phone: S.phone, name: '' };
  const schedule = () => data.scheduleFor(S.phone);
  const closedToday = () => !openRecord(S.myAttendance) && !S.myAttendance.some(a => a.date === pkDate()) && (S.config.closedDays || []).some(d => d.date === pkDate());
  const summary = month => monthSummary({ account: me(), attendance: S.myAttendance, requests: S.requests, schedule: schedule(), month, today: pkDate(), nowMin: pkMinutes() });

  const dutyMin = () => shiftMinutes(schedule()) || Math.round(data.salaryFor(me()).dutyHours * 60);
  const dutyTags = () => { const sch = schedule(); return `<div class="tags center"><span class="tag">${icon('clock', 14)} Duty ${fmtTime(sch.shiftStart)}${sch.shiftEnd ? ' – ' + fmtTime(sch.shiftEnd) : ''}</span><span class="tag">${hm(dutyMin()).replace(' 00m', '')} roz</span></div>`; };
  const syncLine = row => row?.pending ? `<p class="sync-line is-wait">${icon('clock', 16)} Hazri abhi phone mein hai — internet milte hi malik tak pohanch jayegi. App band na karein.</p>` : row ? `<p class="sync-line">${icon('check', 16)} Malik tak pohanch gayi</p>` : '';
  function actionCard() {
    const today = pkDate(), rows = S.myAttendance, todayRow = rows.find(a => a.date === today), open = openRecord(rows), sch = schedule();
    const radius = Number(S.config.radius || SHOP.radius);
    if (S.errors?.myAttendance) return `<section class="punch"><p class="error-line">${icon('alert', 18)} <span>Aap ki hazri server se nahi aayi (${esc(S.errors.myAttendance)}). Internet check karein, phir Logout kar ke dobara login karein.</span></p></section>`;
    if (closedToday()) return `<section class="punch is-done"><p class="punch-state">${esc(dateLabel(today))}</p><p class="punch-big">Aaj dukaan band hai</p><p class="punch-sub">Aaj hazri nahi lagani.</p></section>`;
    if (!S.loaded.has('myAttendance')) return `<section class="punch"><p class="loading-line">Aap ki hazri aa rahi hai…</p></section>`;
    if (open) {
      const inMin = parseTime(open.checkIn), nowAbs = pkMinutes() + (open.date !== today ? 1440 : 0);
      const mins = open.checkInTs ? Math.max(0, Math.round((Date.now() - open.checkInTs) / 60000)) : (inMin != null ? Math.max(0, nowAbs - inMin) : 0);
      const left = dutyMin() - mins;
      return `<section class="punch is-in"><p class="punch-state">${icon('check', 18)} Aap kaam par hain</p>
        <p class="punch-big">${fmtTime(open.checkIn)} <small>se${open.date !== today ? ' (' + esc(shortDate(open.date)) + ')' : ''}</small></p>
        <div class="progress" role="img" aria-label="Duty ka hissa"><i style="width:${Math.min(100, Math.round(mins / Math.max(1, dutyMin()) * 100))}%"></i></div>
        <p class="punch-sub"><b>${hm(mins)}</b> ho gaye &nbsp;|&nbsp; ${left > 0 ? `<b>${hm(left)}</b> baqi` : `<b class="txt-ok">Duty poori${left < 0 ? ', ' + hm(-left) + ' overtime' : ''}</b>`}${sch.shiftEnd ? ' &nbsp;|&nbsp; Chutti ' + fmtTime(sch.shiftEnd) : ''}</p>
        ${syncLine(open)}
        <button type="button" class="btn btn-out btn-xl" data-action="check-out">${icon('out', 22)} Check-Out karein</button>
        <p class="punch-step" id="punchStep">${esc(ui.step)}</p></section>`;
    }
    if (todayRow?.checkIn) {
      return `<section class="punch is-done"><p class="punch-state">${icon('check', 18)} Aaj ki hazri mukammal</p>
        <p class="punch-big">${fmtTime(todayRow.checkIn)} <small>se</small> ${fmtTime(todayRow.checkOut)}</p>
        <p class="punch-sub">${workMinutes(todayRow) != null ? hm(workMinutes(todayRow)) + ' kaam kiya' + (workMinutes(todayRow) > dutyMin() ? ` (${hm(workMinutes(todayRow) - dutyMin())} overtime)` : '') : ''}</p>${syncLine(todayRow)}</section>`;
    }
    const start = parseTime(sch.shiftStart), lateBy = start != null ? pkMinutes() - start - Number(sch.grace ?? 10) : 0;
    return `<section class="punch"><p class="punch-state">${esc(dateLabel(today))}</p>
      <p class="punch-big">Duty ${fmtTime(sch.shiftStart)}</p>${dutyTags()}
      <p class="punch-sub ${lateBy > 0 ? 'txt-late' : ''}">${lateBy > 0 ? `Waqt guzar chuka hai — abhi Check-In karein` : 'Dukaan pohanch kar Check-In karein'}</p>
      <button type="button" class="btn btn-in btn-xl" data-action="check-in">${icon('camera', 22)} Check-In karein</button>
      <p class="punch-step" id="punchStep">${esc(ui.step) || `Selfie aur location lagegi. Dukaan se ${radius}m ke andar hona zaroori hai.`}</p></section>`;
  }
  function monthBlock() {
    const month = ui.month, sum = summary(month), today = pkDate();
    const missed = S.myAttendance.filter(a => a.date < today && checkoutDue(a, schedule()) && a !== openRecord(S.myAttendance));
    return `${missed.length ? `<button type="button" class="att-card tone-bad" data-action="fix-missed" data-date="${missed[0].date}">${icon('alert', 22)}<span><b>${esc(shortDate(missed[0].date))} ka Check-Out reh gaya</b><small>Yahan daba kar malik ko sahi waqt ki request bhejein</small></span></button>` : ''}
      <div class="toolbar"><h2 class="section-label">Meri hazri</h2><button type="button" class="btn btn-ink btn-sm" data-action="my-pdf">${icon('pdf', 18)} PDF</button></div>
      <div class="datebar"><button type="button" class="icon-btn" data-action="month-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button><span class="date-static">${esc(monthLabel(month))}</span><button type="button" class="icon-btn" data-action="month-step" data-arg="1" aria-label="Agla mahina" ${month >= today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div>
      <div class="counts"><div class="st-present"><b>${sum.count.present + sum.count.late}</b><small>Hazir</small></div><div class="st-late"><b>${sum.count.late}</b><small>Late</small></div><div class="st-absent"><b>${sum.count.absent}</b><small>Ghair hazir</small></div><div class="st-leave"><b>${sum.count.leave + sum.count.off}</b><small>Chutti</small></div><div><b>${hm(sum.totalMin)}</b><small>Ghante</small></div></div>
      <section class="panel"><ol class="days">${sum.days.filter(d => d.status !== 'na' && d.status !== 'waiting').reverse().map(d => `<li class="s-${d.status}"><div>
        <span class="d-date"><b>${+d.date.slice(8)}</b><small>${DAY_SHORT[weekday(d.date)]}</small></span>
        <span class="d-time">${d.a.checkIn ? `${fmtTime(d.a.checkIn)} <span class="arrow">to</span> ${d.a.checkOut ? fmtTime(d.a.checkOut) : '<b class="txt-bad">baqi</b>'}` : '<span class="muted">—</span>'}${d.minutes != null ? `<small>${hm(d.minutes)}</small>` : ''}</span>
        <span class="stamp st-${d.status}">${d.status === 'late' ? 'Late ' + d.late + 'm' : STATUS_LABEL[d.status]}</span></div></li>`).join('') || '<li class="muted pad">Is mahine abhi koi record nahi.</li>'}</ol></section>`;
  }
  const clock = ms => ms ? fmtTime(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))) : '—';
  /** Bahar jane ki parchi: button / intezar / Gate Pass. Sirf jab duty par ho. */
  function outCard() {
    const today = pkDate(), open = openRecord(S.myAttendance);
    if (!open || open.date !== today) return '';
    const od = dayOuts(S.outs, S.phone, today), last = [...S.outs].filter(o => o.date === today && o.phone === S.phone && o.kind !== 'break').sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0))[0];
    const bk = dayOuts(S.outs, S.phone, today, Date.now(), 'break');
    if (bk.open) return gatePass(bk.open, false);
    if (od.open) return gatePass(od.open, false);
    if (od.pending) return `<section class="out-wait">${icon('clock', 22)}<div><b>Parchi malik ke paas hai</b><small><span class="ur" dir="rtl">${esc(reasonUr(od.pending.reason))} · ${esc(minutesUr(od.pending.minutes))}</span> · ${clock(od.pending.requestedAt)} ko bheji. Malik ya manager "Haan" karein to yahan Gate Pass khul jayega.</small></div><button type="button" class="btn btn-ghost btn-sm" data-action="out-cancel" data-id="${esc(od.pending.id)}">Cancel</button></section>`;
    return `${last?.status === 'rejected' ? `<p class="notice tone-bad">${icon('alert', 18)} <span>Malik ne ${esc(last.reason)} ki parchi mana kar di${last.ownerNote ? ': ' + esc(last.ownerNote) : ''}.</span></p>` : ''}
      <button type="button" class="btn btn-ghost btn-lg out-btn" data-action="out-new">${icon('out', 20)} Bahar jana hai? Parchi banayein</button>
      ${od.done.length ? `<p class="hint center">Aaj bahar: ${od.done.map(o => `${clock(o.outAt)}–${clock(o.returnAt)}`).join(', ')} (${durText(od.total)})</p>` : ''}`;
  }
  function gatePass(o, big) {
    const m = outMinutes(o, Date.now()) || 0, over = m > Number(o.minutes || 0), back = Number(o.outAt) + Number(o.minutes || 0) * 60000;
    return `<section class="gate${big ? ' big' : ''}" style="--day:${dayColor(pkDate())}">
      <div class="gate-top"><span>${o.kind === 'break' ? 'KHANA BREAK · <span class="ur" dir="rtl">کھانے کا وقفہ</span>' : 'GATE PASS · <span class="ur" dir="rtl">گیٹ پاس</span>'}</span><span>${esc(dateLabel(pkDate()))}</span></div>
      <div class="gate-body">${avatar(me(), 'lg')}<div><b class="gate-name">${nameHtml(me().name)}</b><small>${esc(me().role || 'Staff')} · ${esc(me().phone || S.phone)}</small></div></div>
      <div class="gate-grid"><div><small class="ur" dir="rtl">وجہ</small><b class="ur" dir="rtl">${esc(reasonUr(o.reason))}</b>${o.note ? `<small dir="auto">${esc(o.note)}</small>` : ''}</div><div><small class="ur" dir="rtl">گیا</small><b>${clock(o.outAt)}</b></div><div><small class="ur" dir="rtl">واپسی</small><b class="${over ? 'txt-bad' : ''}">${clock(back)}</b></div></div>
      <p class="gate-ok">${icon('check', 18)} <span class="ur" dir="rtl">${o.approvedByName && o.approvedByName !== 'Malik' ? esc(o.approvedByName) + ' (منیجر) نے منظور کیا' : 'مالک نے منظور کیا'}</span></p>
      <p class="gate-clock" data-live-clock aria-live="off">${clock(Date.now())}</p>
      <p class="gate-stripe" aria-hidden="true"></p>
      <p class="gate-sub ${over ? 'txt-bad' : ''}">${m < 1 ? 'Abhi abhi gaya' : durText(m) + ' se bahar'}${over ? ' — waqt guzar gaya, jaldi wapas aayein' : ''}</p>
      ${big ? '' : `<div class="btn-row"><button type="button" class="btn btn-ghost" data-action="gate-big" data-id="${esc(o.id)}">Guard ko dikhayein</button><button type="button" class="btn btn-in btn-lg" data-action="out-return" data-id="${esc(o.id)}">${icon('check', 18)} Wapas aa gaya</button></div>`}
    </section>`;
  }
  function outSheet() {
    let reason = '', minutes = 0;
    const sheet = openSheet({ id: 'out-new', title: '<span class="ur" dir="rtl">باہر جانے کی پرچی</span>', render: () => `<form class="form ur-form" data-form="out" dir="rtl" lang="ur">
      <fieldset><legend>باہر کیوں جانا ہے؟</legend><div class="choice">${OUT_REASONS.map(r => `<button type="button" class="chip ur-chip" data-out-reason="${esc(r.key)}" aria-pressed="${reason === r.key}">${esc(r.ur)}</button>`).join('')}</div>
        <input type="hidden" name="reason" value="${esc(reason)}"></fieldset>
      <fieldset><legend>کتنی دیر لگے گی؟</legend><div class="choice">${OUT_MINUTES.map(n => `<button type="button" class="chip ur-chip" data-out-min="${n}" aria-pressed="${minutes === n}">${esc(minutesUr(n))}</button>`).join('')}</div>
        <input type="hidden" name="minutes" value="${minutes || ''}"></fieldset>
      <label>تفصیل <small>(اگر چاہیں)</small><input name="note" maxlength="300" dir="auto" placeholder="مثلاً: رحمان ٹریڈرز سے مال"></label>
      <p class="hint">پرچی مالک یا منیجر کو جائے گی۔ وہ "ہاں" کریں تو گیٹ پاس کھلے گا — وہی گارڈ کو دکھانا ہے۔</p>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">مالک کو بھیجیں</button></div></form>` });
    sheet.el.addEventListener('click', e => {
      const r = e.target.closest('[data-out-reason]'), m = e.target.closest('[data-out-min]');
      if (!r && !m) return; e.preventDefault();
      if (r) reason = r.dataset.outReason; if (m) minutes = Number(m.dataset.outMin);
      const form = sheet.el.querySelector('form'), note = form.elements.note.value;
      sheet.refresh(true); sheet.el.querySelector('form').elements.note.value = note;
    });
    return sheet;
  }
  /** Senior / manager: bina bataye gaya ka ticket. */
  function ticketCard() {
    if (!data.isTicketer()) return '';
    if (S.errors?.teamTickets) return `<p class="error-line">${icon('alert', 18)} <span>Tickets nahi aaye (${esc(S.errors.teamTickets)}). Malik ko naye Firebase rules (v209) publish karne hain.</span></p>`;
    const list = (S.teamTickets || []).sort((a, b) => (b.from || 0) - (a.from || 0));
    return `<section class="panel pad mgr"><h2 class="section-label">${icon('alert', 18)} Bina bataye gaya — ticket</h2>
      <button type="button" class="btn btn-out" data-action="ticket-new">${icon('alert', 18)} Ticket banayein</button>
      ${list.map(t => `<div class="mgr-out"><span><b>${nameHtml(t.name || t.phone)}</b> · ${esc(ticketText({ ...t, decision: '' }))}${t.status === 'open' ? ` · <span class="txt-bad">${esc(durText(ticketMinutes(t, Date.now()) || 0))} se bahar</span>` : ''}${t.status === 'decided' ? ' · malik ne faisla kar diya' : ''}</span>
        ${t.status === 'open' ? `<button type="button" class="btn btn-ghost btn-sm" data-action="ticket-return" data-id="${esc(t.id)}">Wapas aa gaya</button>` : ''}</div>`).join('') || '<p class="hint">Aaj koi ticket nahi. Faisla (maaf / warning / katauti) sirf malik karta hai.</p>'}
    </section>`;
  }
  /** Manager: aaj ki doosron ki parchiyan. */
  function managerCard() {
    if (!data.isManager()) return '';
    const list = S.teamOuts || [], pending = list.filter(o => o.status === 'pending'), out = list.filter(o => o.status === 'approved' && o.kind !== 'break');
    const breaks = [...list, ...S.outs.filter(o => o.date === pkDate())].filter(o => o.kind === 'break' && o.status === 'approved');
    if (S.errors?.teamOuts) return `<p class="error-line">${icon('alert', 18)} <span>Manager ki parchiyan nahi aayin (${esc(S.errors.teamOuts)}). Malik ko naye Firebase rules (v206) publish karne hain.</span></p>`;
    return `<section class="panel pad mgr"><h2 class="section-label">${icon('people', 18)} Manager — bahar jane ki parchiyan</h2>
      <button type="button" class="btn btn-primary" data-action="break-start">${icon('clock', 18)} Khana break shuru karein</button>
      ${breakStatusHtml(breaks)}
      ${pending.map(o => `<div class="out-card"><div class="out-text"><b>${nameHtml(o.name || o.phone)} bahar jana chahta hai</b><small>${esc(o.reason)}${o.note ? ' — ' + nameHtml(o.note) : ''} · ${o.minutes} min · ${clock(o.requestedAt)}</small></div>
        <div class="out-btns"><button type="button" class="btn btn-primary btn-sm" data-action="mgr-review" data-id="${esc(o.id)}" data-arg="yes">Haan</button><button type="button" class="btn btn-ghost btn-sm" data-action="mgr-review" data-id="${esc(o.id)}" data-arg="no">Nahi</button></div></div>`).join('')}
      ${out.map(o => { const m = outMinutes(o, Date.now()) || 0, over = m > Number(o.minutes || 0); return `<div class="mgr-out"><span><b>${nameHtml(o.name || o.phone)}</b> abhi bahar · <span class="${over ? 'txt-bad' : ''}">${hm(m)}</span> · ${esc(o.reason)}${o.approvedByName ? ' · ' + esc(o.approvedByName) + ' ne manzoor ki' : ''}</span><button type="button" class="btn btn-ghost btn-sm" data-action="mgr-return" data-id="${esc(o.id)}">Wapas aa gaya</button></div>`; }).join('')}
      ${!pending.length && !out.length && !breaks.length ? '<p class="hint">Abhi koi parchi nahi. Nayi parchi aaye to yahan Haan / Nahi ke button aayenge.</p>' : ''}
    </section>`;
  }
  /** Malik ki hidayat: Urdu ho to poora paragraph daen se baen (English alfaaz beech mein theek rehte hain). */
  function instructionHtml(text) {
    const rtl = hasArabic(text), lines = String(text).split(/\n+/).map(l => l.trim()).filter(Boolean);
    return `<div class="notice${rtl ? ' is-rtl' : ''}">${icon('note', 18)}<div ${rtl ? 'dir="rtl" lang="ur" class="ur"' : ''}>${lines.map(l => `<p dir="${rtl ? 'rtl' : 'auto'}">${esc(l)}</p>`).join('')}</div></div>`;
  }
  /** Home screen par install ka banner (sirf browser mein; app ban chuki ho to nahi). */
  function installCard() {
    if (!install || install.standalone || install.dismissed) return '';
    return `<section class="install-card">${icon('down', 22)}<div><b>App ko home screen par lagayein</b><small>Phir icon daba kar seedha aap ka safha khulega — na link, na number.</small></div>
      <div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-action="install">${install.canPrompt ? 'Install karein' : 'Kaise lagayein?'}</button><button type="button" class="btn btn-ghost btn-sm" data-action="install-later">Baad mein</button></div></section>`;
  }
  function hazriTab() {
    return `${installCard()}${managerCard()}${ticketCard()}${actionCard()}${outCard()}${S.config.instruction ? instructionHtml(S.config.instruction) : ''}${monthBlock()}`;
  }
  function salaryTab() {
    const month = ui.month, c = data.calcFor(me(), month), today = pkDate();
    const line = (label, value, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${value}</td></tr>`;
    return `<div class="toolbar"><h1 class="page-title">Meri salary</h1><span class="stamp ${c.frozen ? 'st-present' : 'st-waiting'}">${c.frozen ? 'Final' : 'Andaza'}</span></div>
      <div class="datebar"><button type="button" class="icon-btn" data-action="month-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button><span class="date-static">${esc(monthLabel(month))}</span><button type="button" class="icon-btn" data-action="month-step" data-arg="1" aria-label="Agla mahina" ${month >= today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div>
      <section class="panel pad"><table class="calc"><tbody>
        ${line('Mahana salary', money(c.monthlySalary))}
        ${c.mode === 'days' ? line(`Ghair hazir <small>${c.absentDays} din</small>`, '− ' + money(c.absentCut), c.absentCut ? 'txt-bad' : '') : line(`Aam ghante <small>${hm(c.normalMin)}</small>`, money(c.normalSalary))}
        ${line(`Overtime <small>${hm(c.otMin)}</small>`, '+ ' + money(c.overtimeAmount))}
        ${c.pointsAmount ? line(`Points <small>${c.points}</small>`, '+ ' + money(c.pointsAmount)) : ''}
        ${c.mealSalary ? line('Khana', '+ ' + money(c.mealSalary)) : ''}
        ${c.bonus ? line('Bonus', '+ ' + money(c.bonus)) : ''}
        ${c.advance ? line('Advance (kat gaya)', '− ' + money(c.advance), 'txt-bad') : ''}
        ${c.loanCut ? line(`Qarz ki qist <small>${(c.loans || []).filter(l => l.cut).map(l => 'baqi ' + money(l.remainingAfter)).join(', ')}</small>`, '− ' + money(c.loanCut), 'txt-bad') : ''}
        ${c.lateFine ? line(`Late jurmana <small>${c.lateCount} dafa late</small>`, '− ' + money(c.lateFine), 'txt-bad') : ''}
        ${(c.ticketLines || []).map(t => line(esc(t.text.replace(/ — Rs [\d,]+$/, '')), '− ' + money(t.amount), 'txt-bad')).join('')}
        ${(c.leaveLines || []).map(l => line(esc(l.text), '− ' + money(l.amount), 'txt-bad')).join('')}
        ${c.leavePay ? line('Chutti ki salary (paisa nahi katega)', '+ ' + money(c.leavePay)) : ''}
        ${line('Kul banti salary', money(c.final), 'is-total')}
        ${line('Mil chuki', money(c.paid))}
        ${line('Baqi', money(c.balance), 'is-balance')}
      </tbody></table>
      ${c.frozen ? '' : '<p class="hint">Ye andaza hai. Mahine ke aakhir mein malik final karte hain, tab raqam pakki hoti hai.</p>'}
      <h3 class="sub">Advance, bonus aur payments</h3>
      <ul class="ledger">${[...(c.extras || []).map(x => ({ ...x, label: x.kind === 'advance' ? 'Advance' : 'Bonus' })), ...(c.payments || []).map(x => ({ ...x, label: 'Salary mili' }))].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(x => `<li><span><b>${x.label}</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}</span></li>`).join('') || '<li class="muted">Is mahine koi entry nahi.</li>'}</ul></section>`;
  }
  function requestTab() {
    const kind = ui.reqKind, today = pkDate();
    const list = S.requests.filter(r => r.phone === S.phone && r.kind !== 'suggestion').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30);
    return `<div class="toolbar"><h1 class="page-title">Request</h1></div>
      <section class="panel pad"><form class="form" data-form="request">
        <div class="switch full" role="tablist"><button type="button" role="tab" aria-selected="${kind === 'leave'}" data-action="req-kind" data-arg="leave">Chutti chahiye</button><button type="button" role="tab" aria-selected="${kind === 'correction'}" data-action="req-kind" data-arg="correction">Hazri ghalat hai</button></div>
        <input type="hidden" name="kind" value="${kind}">
        ${kind === 'leave'
          ? `<div class="choice"><button type="button" class="chip" data-action="req-half" data-arg="" aria-pressed="${!ui.reqHalf}">Poora din</button><button type="button" class="chip" data-action="req-half" data-arg="am" aria-pressed="${ui.reqHalf === 'am'}">Aadha din — subah</button><button type="button" class="chip" data-action="req-half" data-arg="pm" aria-pressed="${ui.reqHalf === 'pm'}">Aadha din — shaam</button></div>
             <input type="hidden" name="half" value="${esc(ui.reqHalf || '')}">
             ${ui.reqHalf ? `<label>Kis din<input name="date" type="date" value="${esc(ui.reqDate || today)}" required></label><p class="hint">${ui.reqHalf === 'am' ? 'Subah ki chutti: us din aap aadhi duty ke baad aayenge, late nahi ginega.' : 'Shaam ki chutti: us din aap aadhi duty ke baad ja sakte hain.'}</p>`
               : `<div class="two"><label>Kab se<input name="date" type="date" value="${esc(ui.reqDate || today)}" required></label><label>Kab tak<input name="to" type="date" value="${esc(ui.reqDate || today)}" required></label></div>`}`
          : `<label>Kis din ki hazri<input name="date" type="date" value="${esc(ui.reqDate || today)}" max="${today}" required></label>${timeField('checkIn', '', { label: 'Sahi aane ka waqt', tickets: IN_TICKETS, optional: true, guess: 'in' })}${timeField('checkOut', '', { label: 'Sahi jane ka waqt', tickets: OUT_TICKETS, optional: true, guess: 'out' })}<p class="hint">Jo waqt theek hai use khali chhor dein.</p>`}
        <label>Wajah<textarea name="reason" rows="3" maxlength="1000" required placeholder="${kind === 'leave' ? 'Chutti kyun chahiye' : 'Maslan: Check-Out karna bhool gaya'}"></textarea></label>
        <div class="btn-row"><button class="btn btn-primary btn-lg">Malik ko bhejein</button></div></form></section>
      <h2 class="section-label">Meri requests</h2>
      <section class="panel"><ul class="reqs">${list.map(r => `<li class="req"><p><b>${r.kind === 'leave' ? (r.half ? 'Aadhi chutti' : 'Chutti') : 'Hazri durust'}</b> <span class="stamp ${r.status === 'pending' ? 'st-late' : r.status === 'approved' ? 'st-present' : 'st-absent'}">${r.status === 'pending' ? 'Jawab ka intezar' : r.status === 'approved' ? 'Manzoor' : 'Na-manzoor'}</span></p>
        <p>${esc(shortDate(r.date))}${r.to && r.to !== r.date ? ' – ' + esc(shortDate(r.to)) : ''}${r.half ? (r.half === 'am' ? ' (subah)' : ' (shaam)') : ''}${r.kind === 'leave' && r.status === 'approved' && typeof r.paid === 'boolean' ? ` &nbsp;|&nbsp; <b class="${r.paid ? 'txt-ok' : 'txt-bad'}">${r.paid ? 'Paisa nahi katega' : 'Paisa katega'}</b>` : ''}${r.kind === 'correction' ? ` &nbsp;|&nbsp; ${fmtTime(r.checkIn)} to ${fmtTime(r.checkOut)}` : ''}</p><p class="muted">${nameHtml(r.reason || '')}</p>${r.ownerNote ? `<p class="muted">Malik: ${esc(r.ownerNote)}</p>` : ''}</li>`).join('') || '<li class="muted pad">Abhi koi request nahi bheji.</li>'}</ul></section>`;
  }

  const setStep = text => { ui.step = text; const el = document.getElementById('punchStep'); if (el) el.textContent = text; };
  const actions = {
    tab(el) { ui.tab = el.dataset.arg; try { localStorage.setItem(TAB_KEY, ui.tab); } catch { /* ignore */ } rerender(); window.scrollTo?.(0, 0); },
    'month-step'(el) { const m = addMonths(ui.month, +el.dataset.arg); if (m <= pkDate().slice(0, 7)) ui.month = m; rerender(); },
    'req-kind'(el) { ui.reqKind = el.dataset.arg; rerender(); },
    'req-half'(el) { ui.reqHalf = el.dataset.arg; rerender(); },
    'fix-missed'(el) { ui.tab = 'request'; ui.reqKind = 'correction'; ui.reqDate = el.dataset.date; rerender(); window.scrollTo?.(0, 0); },
    async 'check-in'(el) {
      await busy(el, async () => {
        try {
          setStep('1/3  Selfie lein…');
          const selfie = await takeSelfie();
          setStep('2/3  Location dekh rahe hain… (15 second tak lag sakte hain)');
          const gps = await getGps();
          setStep(`3/3  Dukaan se ${Math.round(gps.distance)}m. Hazri lag rahi hai…`);
          const result = await data.checkIn({ selfie, gps });
          setStep('');
          toast(result.queued ? 'Internet kamzor hai — hazri phone mein mehfooz hai, signal aate hi khud chali jayegi.' : 'Check-In ho gaya', 'ok');
        } catch (error) {
          setStep(error.code === 'app/cancelled' ? '' : errorText(error));
          if (error.code !== 'app/cancelled') throw error;
        }
      });
      rerender();
    },
    async 'check-out'(el) {
      const open = openRecord(S.myAttendance);
      if (!open) { toast('Check-In ka record nahi mila. Page dobara kholein.', 'bad'); return; }
      if (!confirm('Check-Out karein? Is ke baad aaj dobara Check-In nahi hoga.')) return;
      await busy(el, async () => {
        setStep('Location dekh rahe hain…');
        let gps = null; try { gps = await getGps(); } catch { /* check-out location ke baghair bhi ho jata hai */ }
        setStep('Check-Out lag raha hai…');
        const result = await data.checkOut(open, gps);
        setStep('');
        toast(result.queued ? 'Internet kamzor hai — Check-Out phone mein mehfooz hai, signal aate hi chala jayega.' : 'Check-Out ho gaya', 'ok');
      });
      rerender();
    },
    'ticket-new'() {
      const roster = (S.config.roster || []).filter(r => r.phone !== S.phone && (data.isManager() || !r.mgr));
      if (!roster.length) { toast('Staff ki list abhi nahi aayi. Malik aik dafa apni app khol lein.', 'bad'); return; }
      ui.ticketSheet?.close(); ui.ticketSheet = openTicketSheet({ people: roster.map(r => ({ phone: r.phone, name: r.name })), onCreate: v => data.createTicket(v) });
    },
    async 'ticket-return'(el) { const t = (S.teamTickets || []).find(x => x.id === el.dataset.id); if (!t) return; await busy(el, () => data.returnTicket(t), 'Wapsi lag gayi'); rerender(); },
    'break-start'() {
      const today = pkDate(), roster = S.config.roster || [], att = S.teamAttendance || [], all = [...(S.teamOuts || []), ...S.outs.filter(o => o.date === today)];
      const people = roster.map(r => { const a = r.phone === S.phone ? S.myAttendance.find(x => x.date === today) : att.find(x => x.phone === r.phone);
        return { phone: r.phone, name: r.name, group: Number(r.group) === 2 ? 2 : 1, onDuty: !!(a?.checkIn && !a.checkOut), busy: all.some(o => o.phone === r.phone && o.status === 'approved') }; });
      if (!people.length) { toast('Staff ki list abhi nahi aayi. Malik aik dafa apni app khol lein, phir dobara koshish karein.', 'bad'); return; }
      ui.breakSheet?.close(); ui.breakSheet = openBreakSheet({ people, onStart: (phones, m) => data.startBreak(phones, m) });
    },
    async 'break-end-one'(el) { const o = [...(S.teamOuts || []), ...S.outs].find(x => x.id === el.dataset.id); if (!o || !confirm(`${o.name || ''} ki wapsi abhi laga dein?`)) return; await busy(el, () => data.endBreaks([o]), 'Wapsi lag gayi'); rerender(); },
    async 'break-end-all'(el) {
      const list = [...(S.teamOuts || []), ...S.outs.filter(o => o.date === pkDate())].filter(o => o.kind === 'break' && o.status === 'approved');
      if (!list.length || !confirm(`${list.length} larkon ki wapsi abhi laga dein?`)) return;
      await busy(el, () => data.endBreaks(list), 'Sab ki wapsi lag gayi'); rerender();
    },
    async 'mgr-review'(el) { const yes = el.dataset.arg === 'yes'; await busy(el, () => data.reviewOut(el.dataset.id, yes), yes ? 'Manzoor kar di' : 'Mana kar di'); rerender(); },
    async 'mgr-return'(el) { const o = (S.teamOuts || []).find(x => x.id === el.dataset.id); if (!o || !confirm('Is larke ki wapsi abhi ke waqt par laga dein?')) return; await busy(el, () => data.returnOut(o), 'Wapsi lag gayi'); rerender(); },
    async install() {
      if (install?.canPrompt) { const ok = await install.prompt(); if (ok) toast('App lag rahi hai…', 'ok'); rerender(); return; }
      openSheet({ id: 'install-help', title: 'Home screen par app kaise lagayein', render: () => `<ol class="steps">
        <li>Chrome mein upar daen taraf <b>⋮</b> (teen nuqte) dabayein.</li>
        <li><b>"Add to Home screen"</b> ya <b>"Install app"</b> dabayein.</li>
        <li><b>Add / Install</b> dabayein. Home screen par <b>NT Hazri</b> ka icon aa jayega.</li>
        <li>Aage se hamesha usi icon se kholein — login yaad rehta hai.</li></ol>
        <p class="hint">iPhone: Safari mein neeche <b>Share</b> › <b>"Add to Home Screen"</b>.</p>` });
    },
    'install-later'() { install?.later(); rerender(); },
    'out-new'() { ui.outSheet?.close(); ui.outSheet = outSheet(); },
    async 'out-cancel'(el) { if (!confirm('Parchi cancel karein?')) return; await busy(el, () => data.cancelOut(el.dataset.id), 'Parchi cancel ho gayi'); rerender(); },
    'gate-big'(el) { const o = S.outs.find(x => x.id === el.dataset.id); if (!o) return; const sh = openSheet({ id: 'gate', title: 'Gate Pass', wide: true, render: () => { const cur = S.outs.find(x => x.id === o.id); return cur?.status === 'approved' ? gatePass(cur, true) : '<p class="empty-line">Ye Gate Pass ab band ho chuka hai.</p>'; } }); ui.gateSheet = sh; },
    async 'out-return'(el) {
      const o = S.outs.find(x => x.id === el.dataset.id); if (!o) return;
      await busy(el, async () => {
        let gps = null; try { gps = await getGps(); } catch { /* location na mile to bhi wapsi lag jaye */ }
        if (gps && gps.distance > Number(S.config.radius || SHOP.radius) && !confirm(`Aap abhi dukaan se ${Math.round(gps.distance)}m door hain. Phir bhi "Wapas aa gaya" lagayein? Malik ko ye faasla nazar aayega.`)) return;
        await data.returnOut(o, gps);
        ui.gateSheet?.close();
      }, 'Wapsi lag gayi. Khush aamdeed!');
      rerender();
    },
    async 'my-pdf'(el) {
      await busy(el, async () => {
        const { loadPdfLib, browserTextImages, staffMonthPdf } = await pdfMod();
        const lib = await loadPdfLib(), month = ui.month;
        deliverPdf(await staffMonthPdf(lib, { account: me(), month, summary: summary(month), calc: data.calcFor(me(), month), schedule: schedule(), textImages: browserTextImages }));
      });
    },
    update(el) { busy(el, () => checkUpdate(true)); },
    logout() { if (confirm('Logout karein?\n\nLogout ke baad dobara number likhna padega. Aam tor par logout ki zaroorat nahi.')) logout(); }
  };
  const forms = {
    async out(form, v, button) {
      await busy(button, async () => { await data.requestOut(v); ui.outSheet?.close(); }, 'Parchi malik ko chali gayi');
      rerender();
    },
    async request(form, v, button) {
      await busy(button, async () => { await data.sendRequest(v); ui.reqDate = ''; ui.reqHalf = ''; form.reset(); }, 'Request malik ko chali gayi');
      rerender();
    }
  };

  function render() {
    const tabs = [['hazri', 'Hazri', 'clock'], ['salary', 'Salary', 'wallet'], ['request', 'Request', 'note']];
    const pend = S.requests.filter(r => r.phone === S.phone && r.status === 'pending' && r.kind !== 'suggestion').length;
    return `<header class="top"><div class="top-in">
        <div class="brand">${avatar(me())}<span><b>${nameHtml(me().name || 'Staff')}</b><small>${esc(me().role || 'Noor Traders')}</small></span></div>
        <nav class="tabs" aria-label="Hisse">${tabs.map(([k, label, ic]) => `<button type="button" data-action="tab" data-arg="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${icon(ic, 22)}<span>${label}</span>${k === 'request' && pend ? `<em class="badge">${pend}</em>` : ''}</button>`).join('')}</nav>
      </div></header>
      <main class="view view-staff">${ui.tab === 'hazri' ? hazriTab() : ui.tab === 'salary' ? salaryTab() : requestTab()}
        <p class="foot"><button type="button" class="link" data-action="update">Update check karein</button> &nbsp; ${APP_VERSION}${S.bootMs ? ` · ${(S.bootMs / 1000).toFixed(1)}s mein khuli` : ''} &nbsp; · &nbsp; <button type="button" class="link muted-link" data-action="logout">Logout</button></p></main>`;
  }
  return { render, actions, forms, changes: {}, inputs: {}, ui, onData() { refreshSheets(); } };
}
