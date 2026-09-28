// pdf.js — asal PDF file banti hai (print dialog nahi), is liye seedha WhatsApp par share ho sakti hai.
// jsPDF bahar se aata hai: browser mein loadPdfLib(), test mein Node wala build.
import {
  APP_VERSION, SHOP, STATUS_LABEL, STATUS_MARK, DAY_NAMES, dateLabel, monthLabel, shortDate, fmtTime, hm, money, hasArabic,
  weekday, monthDates, pkDate, pkTime24, countStatuses
} from './core.js';

const INK = [27, 42, 74], PAPER = [246, 248, 252], LINE = [208, 215, 228], MUTED = [96, 108, 130];
const TONE = { present: [24, 120, 78], late: [176, 108, 12], absent: [179, 38, 30], leave: [88, 80, 160], off: [96, 108, 130], closed: [96, 108, 130], half: [88, 80, 160], waiting: [96, 108, 130], loading: [160, 168, 184], na: [160, 168, 184] };
const TINT = { late: [253, 246, 230], absent: [253, 238, 236], leave: [241, 240, 252], off: [243, 245, 249], closed: [243, 245, 249], half: [241, 240, 252] };

let libPromise = null;
/** Browser: dono library files pehli PDF par hi load hoti hain, app ka kholna halka rehta hai. */
export function loadPdfLib(base = './') {
  if (libPromise) return libPromise;
  const add = src => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = base + src; s.onload = resolve; s.onerror = () => reject(new Error('PDF library load nahi hui. Internet check kar ke dobara dabayein.')); document.head.append(s); });
  libPromise = (async () => {
    if (!window.jspdf?.jsPDF) await add('jspdf.umd.min.js');
    if (!window.jspdf.jsPDF.API.autoTable) await add('jspdf.plugin.autotable.min.js');
    return { jsPDF: window.jspdf.jsPDF, autoTable: (doc, options) => doc.autoTable(options) };
  })().catch(error => { libPromise = null; throw error; });
  return libPromise;
}
/** Urdu lipi wale naam PDF ke font mein nahi bante, is liye unki chhoti tasveer bana kar khane mein lagti hai. */
export async function browserTextImages(strings, fontFamily = "'Noto Naskh Arabic', serif") {
  const out = new Map(), px = 44;
  try { await Promise.all([...strings].map(t => document.fonts?.load(`700 ${px}px ${fontFamily}`, t))); } catch { /* fallback font */ }
  for (const text of strings) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    ctx.font = `700 ${px}px ${fontFamily}`;
    const width = Math.ceil(ctx.measureText(text).width) + 12, height = Math.ceil(px * 1.9);
    canvas.width = width; canvas.height = height;
    ctx.font = `700 ${px}px ${fontFamily}`; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1b2a4a';
    ctx.fillText(text, width - 6, height / 2);
    out.set(text, { data: canvas.toDataURL('image/png'), ratio: width / height });
  }
  return out;
}

function createDoc(lib, { landscape = false } = {}) {
  const doc = new lib.jsPDF({ unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait', compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  return { doc, W, H, M: 12 };
}
const latin = text => hasArabic(text) ? '' : String(text ?? '');
function header(ctx, { title, subtitle, right, rightSmall, images }) {
  const { doc, W, M } = ctx;
  doc.setFillColor(...INK); doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(SHOP.name.toUpperCase(), M, 9, { charSpace: 0.6 });
  doc.setFontSize(17);
  if (hasArabic(title) && images?.get(title)) { const im = images.get(title), h = 9; drawWhiteImage(doc, im, M, 11.5, h); }
  else doc.text(latin(title) || 'Staff', M, 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(205, 214, 232); doc.text(latin(subtitle), M, 24.5);
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(String(right || ''), W - M, 17, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(205, 214, 232); doc.text(String(rightSmall || ''), W - M, 23.5, { align: 'right' });
  return 36;
}
function drawWhiteImage(doc, im, x, y, h) {
  doc.setFillColor(255); doc.roundedRect(x - 1, y - 0.5, h * im.ratio + 2, h + 1, 1, 1, 'F');
  doc.addImage(im.data, 'PNG', x, y, h * im.ratio, h);
}
function statBoxes(ctx, y, items) {
  const { doc, W, M } = ctx, gap = 3, w = (W - 2 * M - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const x = M + i * (w + gap);
    doc.setFillColor(...PAPER); doc.setDrawColor(...LINE); doc.roundedRect(x, y, w, 16, 1.5, 1.5, 'FD');
    doc.setFillColor(...(it.tone || INK)); doc.rect(x, y + 3, 1.2, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...(it.tone || INK)); doc.text(String(it.value), x + 4.5, y + 7.8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...MUTED); doc.text(String(it.label), x + 4.5, y + 12.8);
  });
  return y + 21;
}
function footers(ctx) {
  const { doc, W, H, M } = ctx, pages = doc.internal.getNumberOfPages();
  const stamp = `Noor Traders Hazri ${APP_VERSION}  |  Bani: ${shortDate(pkDate())} ${pkDate().slice(0, 4)}, ${fmtTime(pkTime24())}`;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setDrawColor(...LINE); doc.line(M, H - 10, W - M, H - 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(stamp, M, H - 6); doc.text(`Safha ${i} / ${pages}`, W - M, H - 6, { align: 'right' });
  }
}
function table(ctx, lib, options, images) {
  const { doc, M } = ctx;
  lib.autoTable(doc, {
    theme: 'grid', margin: { left: M, right: M, bottom: 14, top: 14 },
    styles: { font: 'helvetica', fontSize: 8.6, cellPadding: { top: 1.9, bottom: 1.9, left: 2, right: 2 }, lineColor: LINE, lineWidth: 0.15, textColor: [30, 38, 56], valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 8.2, lineColor: INK },
    alternateRowStyles: { fillColor: [250, 251, 254] },
    ...options,
    didParseCell(data) {
      const raw = data.cell.raw;
      const text = raw && typeof raw === 'object' ? raw.content : raw;
      if (data.section === 'body' && hasArabic(text) && images?.get(String(text))) { data.cell.urdu = String(text); data.cell.text = ['']; data.cell.styles.minCellHeight = 7.5; }
      options.didParseCell?.(data);
    },
    didDrawCell(data) {
      const im = data.cell.urdu && images?.get(data.cell.urdu);
      if (im) { const h = Math.min(5.6, data.cell.height - 1.2), w = Math.min(h * im.ratio, data.cell.width - 2); doc.addImage(im.data, 'PNG', data.cell.x + 1.5, data.cell.y + (data.cell.height - w / im.ratio) / 2, w, w / im.ratio); }
      options.didDrawCell?.(data);
    }
  });
  return doc.lastAutoTable.finalY;
}
const statusCell = status => ({ content: STATUS_LABEL[status] || '—', styles: { textColor: TONE[status] || MUTED, fontStyle: 'bold' } });
const collect = (...lists) => new Set(lists.flat().filter(t => hasArabic(t)).map(String));
async function imagesFor(strings, textImages) { return strings.size && textImages ? textImages(strings) : new Map(); }
function sectionTitle(ctx, y, text) {
  const { doc, M, H } = ctx;
  if (y > H - 40) { doc.addPage(); y = 16; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(text, M, y + 5);
  return y + 8;
}

/** 1) Aik din — sab larkon ki hazri aik safhe par. */
export async function dailyPdf(lib, { date, rows, textImages }) {
  const ctx = createDoc(lib), c = countStatuses(rows);
  const images = await imagesFor(collect(rows.map(r => r.account.name), rows.map(r => r.a.ownerNote)), textImages);
  let y = header(ctx, { title: 'Rozana Hazri', subtitle: 'Sab staff ki aik din ki hazri', right: dateLabel(date), rightSmall: `${rows.length} staff` });
  y = statBoxes(ctx, y, [
    { label: 'Kul staff', value: rows.length }, { label: 'Hazir (waqt par)', value: c.present, tone: TONE.present }, { label: 'Late', value: c.late, tone: TONE.late },
    { label: 'Ghair hazir', value: c.absent, tone: TONE.absent }, { label: 'Chutti / Off', value: c.leave + c.off, tone: TONE.leave }
  ]);
  const order = { late: 1, present: 0, waiting: 2, absent: 3, leave: 4, off: 5, closed: 5, loading: 6, na: 6 };
  const sorted = [...rows].sort((a, b) => (order[a.status] - order[b.status]) || (a.a.checkIn || '').localeCompare(b.a.checkIn || '') || String(a.account.name).localeCompare(String(b.account.name)));
  table(ctx, lib, {
    startY: y,
    head: [['#', 'Naam', 'Kaam', 'Aaya', 'Gaya', 'Ghante', 'Late', 'Status', 'Note']],
    body: sorted.map((r, i) => [i + 1, r.account.name || r.account.phone, latin(r.account.role) || '', fmtTime(r.a.checkIn), r.a.checkIn && !r.a.checkOut ? (r.due ? 'BAQI' : 'Jari') : fmtTime(r.a.checkOut), r.minutes != null ? hm(r.minutes) : '—', r.late > 0 && r.a.checkIn ? r.late + ' min' : '—', statusCell(r.status), r.a.ownerNote || (r.a.manual ? 'Malik ne lagayi' : '')]),
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 42, fontStyle: 'bold' }, 2: { cellWidth: 22 }, 3: { cellWidth: 18 }, 4: { cellWidth: 18 }, 5: { cellWidth: 18 }, 6: { cellWidth: 15 }, 7: { cellWidth: 24 } },
    didParseCell(data) { if (data.section === 'body') { const r = sorted[data.row.index]; if (TINT[r.status]) data.cell.styles.fillColor = TINT[r.status]; if (data.column.index === 4 && r.due) data.cell.styles.textColor = TONE.absent; } }
  }, images);
  footers(ctx);
  return { doc: ctx.doc, filename: `Hazri_${date}.pdf` };
}

/** 2) Aik staff ka poora mahina: hazri + salary ka hisab. */
export async function staffMonthPdf(lib, { account, month, summary, calc, schedule, textImages }) {
  const ctx = createDoc(lib), { days, count, totalMin } = summary;
  const images = await imagesFor(collect([account.name], days.map(d => d.a.ownerNote), (calc?.extras || []).map(x => x.note), (calc?.payments || []).map(x => x.note)), textImages);
  let y = header(ctx, { title: account.name || account.phone, subtitle: `${latin(account.role) || 'Staff'}  |  ${account.phone}  |  Duty ${fmtTime(schedule?.shiftStart)} - ${schedule?.shiftEnd ? fmtTime(schedule.shiftEnd) : '—'}`, right: monthLabel(month), rightSmall: 'Mahana hazri + salary', images });
  y = statBoxes(ctx, y, [
    { label: 'Hazir din', value: count.present + count.late, tone: TONE.present }, { label: 'Late', value: count.late, tone: TONE.late }, { label: 'Ghair hazir', value: count.absent, tone: TONE.absent },
    { label: 'Chutti / Off', value: count.leave + count.off, tone: TONE.leave }, { label: 'Kul ghante', value: hm(totalMin) }, { label: 'Overtime', value: hm(calc?.otMin || 0) }
  ]);
  const shown = days.filter(d => d.status !== 'na');
  y = table(ctx, lib, {
    startY: y,
    head: [['Tareekh', 'Din', 'Aaya', 'Gaya', 'Ghante', 'Late', 'Status', 'Note']],
    body: shown.map(d => [shortDate(d.date), DAY_NAMES[weekday(d.date)], fmtTime(d.a.checkIn), d.a.checkIn && !d.a.checkOut ? 'BAQI' : fmtTime(d.a.checkOut), d.minutes != null ? hm(d.minutes) : '—', d.late > 0 && d.a.checkIn ? d.late + ' min' : '—', statusCell(d.status), d.a.ownerNote || (d.a.manual ? 'Malik ne lagayi' : '')]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.25, bottom: 1.25, left: 2, right: 2 }, lineColor: LINE, lineWidth: 0.15, textColor: [30, 38, 56], valign: 'middle' },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 20 }, 5: { cellWidth: 17 }, 6: { cellWidth: 26 } },
    didParseCell(data) { if (data.section === 'body') { const d = shown[data.row.index]; if (TINT[d.status]) data.cell.styles.fillColor = TINT[d.status]; } }
  }, images);

  if (calc) {
    y = sectionTitle(ctx, y + 4, `Salary ka hisab — ${calc.frozen ? 'FINAL' : 'andaza (abhi final nahi)'}`);
    const line = (label, value, style) => [{ content: label, styles: style }, { content: value, styles: { halign: 'right', ...style } }];
    const rowsOut = [
      line('Mahana salary (tay shuda)', money(calc.monthlySalary)),
      ...(calc.mode === 'days'
        ? [line(`Ghair hazir: ${calc.absentDays} din  x  ${money(calc.perDay)}/din (kati)`, '- ' + money(calc.absentCut), calc.absentCut ? { textColor: TONE.absent } : {}), line('Hazri ke mutabiq salary', money(calc.normalSalary))]
        : [line(`Aam ghante: ${hm(calc.normalMin)}  x  ${money(calc.hourly)}/ghanta`, money(calc.normalSalary))]),
      line(`Overtime: ${hm(calc.otMin)}  x  ${money(calc.otRate)}/ghanta`, '+ ' + money(calc.overtimeAmount))
    ];
    if (calc.pointsAmount) rowsOut.push(line(`Points: ${calc.points}  x  ${money(calc.pointRate)}`, '+ ' + money(calc.pointsAmount)));
    if (calc.mealSalary) rowsOut.push(line(`Khana (${calc.mealMode === 'daily' ? calc.mealDays + ' din' : 'mahana'})`, '+ ' + money(calc.mealSalary)));
    if (calc.bonus) rowsOut.push(line('Bonus', '+ ' + money(calc.bonus)));
    if (calc.advance) rowsOut.push(line('Advance (kat gaya)', '- ' + money(calc.advance), { textColor: TONE.absent }));
    if (calc.loanCut) rowsOut.push(line('Qarz ki qist', '- ' + money(calc.loanCut), { textColor: TONE.absent }));
    if (calc.lateFine) rowsOut.push(line(`Late jurmana (${calc.lateCount} dafa late)`, '- ' + money(calc.lateFine), { textColor: TONE.absent }));
    for (const l of calc.leaveLines || []) rowsOut.push(line(l.text + ' (paisa katega)', '- ' + money(l.amount), { textColor: TONE.absent }));
    if (calc.leavePay) rowsOut.push(line(`Chutti ki salary (${calc.paidLeaveUnits} din, paisa nahi katega)`, '+ ' + money(calc.leavePay)));
    for (const t of calc.ticketLines || []) rowsOut.push(line(t.text.replace(/ — Rs [\d,]+$/, ''), '- ' + money(t.amount), { textColor: TONE.absent }));
    if (calc.outCut) rowsOut.push(line(`Bahar ka waqt (${calc.outCount} parchi, ${hm(calc.outMin)})`, '- ' + money(calc.outCut), { textColor: TONE.absent }));
    else if (calc.outMin) rowsOut.push(line(`Bahar ka waqt: ${calc.outCount} parchi, ${hm(calc.outMin)} (kati nahi)`, '—'));
    rowsOut.push(line('Kul banti salary', money(calc.final), { fontStyle: 'bold', fillColor: PAPER, textColor: INK }));
    rowsOut.push(line('Ada ho chuki', money(calc.paid)));
    rowsOut.push(line('BAQI', money(calc.balance), { fontStyle: 'bold', fillColor: INK, textColor: 255 }));
    y = table(ctx, lib, { startY: y, body: rowsOut, showHead: 'never', alternateRowStyles: {}, columnStyles: { 1: { cellWidth: 45 } }, pageBreak: 'avoid' }, images);
    const ledger = [...(calc.extras || []).map(x => [shortDate(x.date), x.kind === 'advance' ? 'Advance' : 'Bonus', money(x.amount), x.note || '']),
      ...(calc.loans || []).filter(l => l.cut).map(l => [shortDate(l.date || l.month + '-01'), 'Qarz qist', money(l.cut), `Kul ${money(l.amount)}, baqi ${money(l.remainingAfter)}`]),
      ...(calc.payments || []).map(x => [shortDate(x.date), 'Salary di', money(x.amount), x.note || ''])];
    if (ledger.length) {
      y = sectionTitle(ctx, y + 3, 'Advance, bonus aur payments');
      y = table(ctx, lib, { startY: y, head: [['Tareekh', 'Qisam', 'Raqam', 'Note']], body: ledger, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 28 }, 2: { cellWidth: 30, halign: 'right' } } }, images);
    }
  }
  const { doc, W, H, M } = ctx;
  y += 16;
  if (y > H - 20) { doc.addPage(); y = 40; }
  doc.setDrawColor(...MUTED); doc.line(M, y, M + 60, y); doc.line(W - M - 60, y, W - M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text('Malik ke dastakhat', M, y + 4); doc.text('Staff ke dastakhat', W - M - 60, y + 4);
  footers(ctx);
  return { doc, filename: `Hazri_${latin(account.name).replace(/[^A-Za-z0-9]+/g, '_') || account.phone}_${month}.pdf` };
}

/** 3) Mahine ka register: staff × din ka jaal, kaghaz wale register ki tarah. */
export async function registerPdf(lib, { month, grid, textImages }) {
  const ctx = createDoc(lib, { landscape: true }), dates = monthDates(month);
  const images = await imagesFor(collect(grid.map(g => g.account.name)), textImages);
  let y = header(ctx, { title: 'Mahine ka Register', subtitle: 'P = Hazir   L = Late   A = Ghair hazir   C = Chutti   O = Weekly off   B = Dukaan band   H = Aadhi chutti', right: monthLabel(month), rightSmall: `${grid.length} staff` });
  const dayW = (ctx.W - 2 * ctx.M - 44 - 4 * 9) / dates.length;
  const columnStyles = { 0: { cellWidth: 44, halign: 'left', fontStyle: 'bold' } };
  dates.forEach((_, i) => { columnStyles[i + 1] = { cellWidth: dayW }; });
  [1, 2, 3, 4].forEach(k => { columnStyles[dates.length + k] = { cellWidth: 9, fontStyle: 'bold' }; });
  table(ctx, lib, {
    startY: y,
    head: [['Naam', ...dates.map(d => String(+d.slice(8))), 'P', 'L', 'A', 'C']],
    body: grid.map(g => [g.account.name || g.account.phone, ...g.summary.days.map(d => STATUS_MARK[d.status] === '·' ? '' : STATUS_MARK[d.status]), g.summary.count.present + g.summary.count.late, g.summary.count.late, g.summary.count.absent, g.summary.count.leave]),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.7, halign: 'center', valign: 'middle', lineColor: LINE, lineWidth: 0.15, textColor: [30, 38, 56] },
    headStyles: { fillColor: INK, textColor: 255, fontSize: 6.5, halign: 'center', lineColor: INK },
    columnStyles,
    didParseCell(data) {
      if (data.section === 'head' && data.column.index >= 1 && data.column.index <= dates.length && weekday(dates[data.column.index - 1]) === 5) data.cell.styles.fillColor = [60, 78, 118];
      if (data.section !== 'body' || data.column.index < 1 || data.column.index > dates.length) return;
      const st = grid[data.row.index].summary.days[data.column.index - 1].status;
      data.cell.styles.textColor = TONE[st] || MUTED; data.cell.styles.fontStyle = 'bold'; if (TINT[st]) data.cell.styles.fillColor = TINT[st];
    }
  }, images);
  footers(ctx);
  return { doc: ctx.doc, filename: `Register_${month}.pdf` };
}

/** 4) Mahine ki salary sheet — sab staff. */
export async function salarySheetPdf(lib, { month, rows, textImages }) {
  const ctx = createDoc(lib, { landscape: true });
  const images = await imagesFor(collect(rows.map(r => r.account.name)), textImages);
  const total = k => rows.reduce((n, r) => n + Number(r.calc[k] || 0), 0);
  let y = header(ctx, { title: 'Salary Sheet', subtitle: 'Sab staff ki mahana salary', right: monthLabel(month), rightSmall: `${rows.length} staff` });
  y = statBoxes(ctx, y, [{ label: 'Kul banti salary', value: money(total('final')) }, { label: 'Katautiyan', value: money(rows.reduce((n, r) => n + Number(r.calc.deductions ?? r.calc.advance ?? 0), 0)), tone: TONE.late }, { label: 'Ada ho chuki', value: money(total('paid')), tone: TONE.present }, { label: 'Baqi', value: money(total('balance')), tone: TONE.absent }]);
  table(ctx, lib, {
    startY: y,
    head: [['#', 'Naam', 'Mahana', 'Din', 'Ghante', 'Hazri salary', 'Overtime', 'Bonus+', 'Katautiyan', 'Kul', 'Ada', 'Baqi', 'Halat']],
    body: rows.map((r, i) => [i + 1, r.account.name || r.account.phone, money(r.calc.monthlySalary), r.calc.daysWorked, hm((r.calc.normalMin || 0) + (r.calc.otMin || 0)), money(r.calc.normalSalary), money(r.calc.overtimeAmount), money((r.calc.bonus || 0) + (r.calc.pointsAmount || 0) + (r.calc.mealSalary || 0)), money(r.calc.deductions ?? r.calc.advance), money(r.calc.final), money(r.calc.paid), money(r.calc.balance), r.calc.frozen ? 'Final' : 'Andaza']),
    foot: [['', 'Kul', '', '', '', money(total('normalSalary')), money(total('overtimeAmount')), '', money(rows.reduce((n, r) => n + Number(r.calc.deductions ?? r.calc.advance ?? 0), 0)), money(total('final')), money(total('paid')), money(total('balance')), '']],
    footStyles: { fillColor: PAPER, textColor: INK, fontStyle: 'bold', halign: 'right' },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 44, fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'center', cellWidth: 11 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right', fontStyle: 'bold' }, 10: { halign: 'right' }, 11: { halign: 'right', fontStyle: 'bold' }, 12: { cellWidth: 16 } },
    didParseCell(data) { if (data.section === 'body' && data.column.index === 11 && rows[data.row.index].calc.balance > 0.5) data.cell.styles.textColor = TONE.absent; }
  }, images);
  footers(ctx);
  return { doc: ctx.doc, filename: `Salary_${month}.pdf` };
}
