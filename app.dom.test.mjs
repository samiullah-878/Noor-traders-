// Poori app naqli Firebase + happy-dom par: login se le kar salary final tak. Asal browser ka badal nahi, lekin runtime ghaltiyan pakarta hai.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { fakeSdk, memoryStorage, B } from './test-fake-sdk.mjs';

const win = new Window({ url: 'https://example.test/app/' });
Object.assign(globalThis, { window: win, document: win.document, File: win.File, requestAnimationFrame: fn => setTimeout(fn, 0) });
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true });
win.confirm = () => true; globalThis.confirm = win.confirm; win.prompt = (q, d) => d ?? 'Eid'; globalThis.prompt = win.prompt;
win.fetch = async () => ({ ok: true, json: async () => ({ version: 'v200' }) });
win.scrollTo = () => {};
win.document.body.innerHTML = '<div id="app" data-screen="boot"></div><div id="sheetHost"></div><div id="toast"></div>';
const { startApp } = await import('./app.js');
const C = await import('./core.js');

const today = C.pkDate(), month = today.slice(0, 7), yesterday = C.addDays(today, -1);
const records = new Map([
  [B + 'staffConfig/main', { shiftStart: '09:00', shiftEnd: '19:00', radius: 200 }],
  [B + 'staffAccounts/03001234567', { name: 'Ali Raza', phone: '03001234567', role: 'Salesman', salary: { monthlySalary: 30000, dutyHours: 10, workingDays: 30 } }],
  [B + 'staffAccounts/03007654321', { name: 'بلال احمد', phone: '03007654321', role: 'Helper', salary: { monthlySalary: 24000, dutyHours: 10, workingDays: 30 } }],
  [B + `staffAttendance/${today}_03001234567`, { date: today, phone: '03001234567', checkIn: '9:25 am', checkOut: '', autoScore: 6 }],
  [B + `staffRequests/r1`, { phone: '03007654321', kind: 'leave', date: today, to: today, checkIn: '', checkOut: '', reason: 'Bimar', status: 'pending', createdAt: 5, by: 'x' }]
]);
if (yesterday.slice(0, 7) === month) records.set(B + `staffAttendance/${yesterday}_03001234567`, { date: yesterday, phone: '03001234567', checkIn: '09:00', checkOut: '19:30', autoScore: 10 });
const fake = fakeSdk({ records }), storage = memoryStorage();
const app = startApp({ sdk: fake.sdk, firebaseConfig: {}, storage, win });
const doc = win.document, $ = s => doc.querySelector(s), $$ = s => [...doc.querySelectorAll(s)];
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 4)); };
const click = async sel => { const el = typeof sel === 'string' ? $(sel) : sel; assert.ok(el, 'nahi mila: ' + sel); el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); await settle(); };
const submit = async form => { form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await settle(10); };
const fill = (form, values) => { for (const [k, v] of Object.entries(values)) { const el = form.elements[k] || form.querySelector(`[name=${k}]`); assert.ok(el, 'field nahi: ' + k); if (el.type === 'checkbox') el.checked = v; else el.value = v; } };
const toastText = () => $('#toast').textContent;

test('login screen khulti hai, staff tab pehle', async () => {
  await settle();
  assert.equal($('#app').dataset.screen, 'login'); assert.ok($('input[name=phone]'));
});
test('ghalat number par saaf paigham', async () => {
  fill($('form[data-form=login]'), { phone: '123' }); await submit($('form[data-form=login]'));
  assert.match($('.login-error').textContent, /mobile number/);
});
test('malik login → Hazri tab, qataarein, tawajju', async () => {
  await click('[data-action=login-role][data-arg=owner]');
  fill($('form[data-form=login]'), { password: 'malik-ka-password' }); await submit($('form[data-form=login]'));
  assert.equal($('#app').dataset.screen, 'owner');
  assert.equal($$('.register .row').length, 2);
  assert.match($('.register').textContent, /Ali Raza/); assert.match($('.register').textContent, /Late 25m/);
  assert.ok($('.ur'), 'Urdu naam apne font class ke sath');
  assert.match($('.attention').textContent, /request/);
  assert.ok($$('.row-pdf').length === 2, 'har staff par PDF button');
  assert.match($('.register').textContent, /9:00 am – 7:00 pm/); assert.match($('.register').textContent, /10h duty/);
  assert.match($('.register').textContent, /Aaya 9:25 am/);
});
test('filter, din badalna, mahine ka jaal', async () => {
  await click('[data-action=filter][data-arg=late]'); assert.equal($$('.register .row').length, 1);
  await click('[data-action=filter][data-arg=all]');
  await click('[data-action=step][data-arg="-1"]'); assert.ok($('[data-action=today]'));
  await click('[data-action=today]');
  await click('[data-action=view][data-arg=month]'); assert.ok($('table.grid')); assert.equal($$('table.grid tbody tr').length, 2);
  await click('[data-action=view][data-arg=day]');
});
test('profile sheet → hazri durust → save', async () => {
  await click('.row-main[data-phone="03001234567"]'); assert.ok($('[data-sheet=profile]'));
  assert.match($('[data-sheet=profile]').textContent, /Hazir/);
  await click(`[data-sheet=profile] [data-action=edit-att][data-date="${today}"]`);
  const form = $('form[data-form=att]'); assert.equal(form.elements.checkIn.value, '09:25');
  fill(form, { checkOut: '19:45', note: 'Bhool gaya tha' }); await submit(form);
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '19:45'); assert.match(toastText(), /save/);
  assert.ok([...records.keys()].some(k => k.includes('staffAudit')));
  await click('[data-sheet=profile] [data-sheet-close]'); assert.equal($('[data-sheet=profile]'), null);
});
test('request manzoor → staff chutti par', async () => {
  await click('[data-action=requests]'); await click('[data-action=req][data-arg=approved]');
  assert.equal(records.get(B + 'staffRequests/r1').status, 'approved');
  await click('[data-sheet=requests] [data-sheet-close]');
  assert.match($('.register').textContent, /Chutti/);
});
test('smart talash', async () => {
  await click('[data-action=search]'); const input = $('#smartInput'); input.value = 'late aaj'; input.dispatchEvent(new win.Event('input', { bubbles: true })); await settle();
  assert.match($('#smartResults').textContent, /1 record/); assert.match($('#smartResults').textContent, /Ali Raza/);
  await click('[data-sheet=search] .chip[data-arg="salary baqi"]'); assert.match($('#smartResults').textContent, /staff/);
  input.value = 'بلال'; input.dispatchEvent(new win.Event('input', { bubbles: true })); await settle(); assert.match($('#smartResults').textContent, /1 staff/);
  await click('[data-sheet=search] [data-sheet-close]');
});
test('naya staff + settings', async () => {
  await click('[data-action=tab][data-arg=staff]'); await click('[data-action=staff-new]');
  const form = $('form[data-form=staff]'); fill(form, { name: 'Usman', phone: '0311-1112223', role: 'Helper', monthlySalary: '20000' }); await submit(form);
  const saved = records.get(B + 'staffAccounts/03111112223'); assert.equal(saved.name, 'Usman'); assert.equal(saved.salary.monthlySalary, 20000); assert.equal(saved.joinDate, today);
  assert.ok(records.get(B + 'staffSchedules/03111112223')); assert.ok(records.get(B + 'staff/03111112223'));
  assert.equal($('[data-sheet=staff-form]'), null);
  await click('[data-action=staff-new]'); fill($('form[data-form=staff]'), { name: 'Dobara', phone: '03111112223' }); await submit($('form[data-form=staff]'));
  assert.match(toastText(), /pehle se mojood/); await click('[data-sheet=staff-form] [data-sheet-close]');
  await click('[data-action=tab][data-arg=settings]');
  await click('[data-action=cfg-duty]'); fill($('form[data-form=cfg]'), { shiftStart: '10:00' }); await submit($('form[data-form=cfg]'));
  await click('[data-action=cfg-checkin]'); fill($('form[data-form=cfg]'), { radius: '150' }); await submit($('form[data-form=cfg]'));
  assert.equal(records.get(B + 'staffConfig/main').shiftStart, '10:00'); assert.equal(records.get(B + 'staffConfig/main').radius, 150);
});
test('salary: advance → final → payment', async () => {
  await click('[data-action=tab][data-arg=salary]'); assert.ok($('.totals'));
  await click('.row-main[data-action=salary][data-phone="03001234567"]');
  const extra = $('form[data-form=extra]'); fill(extra, { kind: 'advance', amount: '500', note: 'Kharcha' }); await submit(extra);
  assert.equal(records.get(B + 'staffAccounts/03001234567').salaryExtras.length, 1);
  assert.match($('[data-sheet=salary]').textContent, /Advance/);
  await click('[data-sheet=salary] [data-action=final]');
  const pay = records.get(B + `staffPayroll/${month}_03001234567`); assert.equal(pay.state, 'final'); assert.equal(pay.snapshot.advance, 500);
  const payment = $('form[data-form=payment]'); assert.ok(payment, 'final ke baad payment form'); fill(payment, { amount: '100' }); await submit(payment);
  assert.equal(records.get(B + `staffPayroll/${month}_03001234567`).paid, 100);
  assert.equal($('form[data-form=extra]'), null, 'final mahine mein advance band');
  await click('[data-sheet=salary] [data-sheet-close]');
});
test('v201: default duty + default salary settings', async () => {
  await click('[data-action=tab][data-arg=settings]'); await click('[data-action=cfg-duty]');
  fill($('form[data-form=cfg]'), { shiftStart: '09:00', shiftEnd: '18:00' }); await submit($('form[data-form=cfg]'));
  await click('[data-action=cfg-salary]');
  const f = $('form[data-form=cfg]');
  fill(f, { defSalary: '26000', defDays: '26', salaryMode: 'days', lateEvery: '3', lateFineDays: '0.5' }); await submit(f);
  const cfg = records.get(B + 'staffConfig/main');
  assert.equal(cfg.shiftEnd, '18:00'); assert.deepEqual([cfg.salaryDefault.monthlySalary, cfg.salaryDefault.workingDays, cfg.salaryDefault.mode, cfg.salaryDefault.lateEvery], [26000, 26, 'days', 3]);
  await app.data.saveConfig({ radius: 180 }); await settle(); // sirf aik hissa: salary ke qawaid na mitein (v204 bug fix)
  assert.equal(records.get(B + 'staffConfig/main').salaryDefault.monthlySalary, 26000); assert.equal(records.get(B + 'staffConfig/main').shiftEnd, '18:00');
  await click('[data-action=cfg-salary]'); assert.ok($('[data-action=apply-salary-all]'), 'purane staff apni salary par hain');
  await click('[data-action=apply-salary-all]');
  assert.equal(records.get(B + 'staffAccounts/03001234567').salary.useDefault, true);
  assert.equal(records.get(B + 'staffAccounts/03001234567').salary.monthlySalary, 30000, 'purani raqam mehfooz');
  await click('[data-sheet=cfg-salary] [data-sheet-close]');
  await click('[data-action=tab][data-arg=salary]'); assert.match($('.rule-card').textContent, /Rs 26,000/); assert.match($('.view').textContent, /Default Rs 26,000/);
});
test('v201: jaldi hazir, dukaan band, check-out band, qarz, slips, khata, jaanch', async () => {
  await click('[data-action=tab][data-arg=hazri]');
  const quick = $('[data-action=tix][data-kind=in][data-phone="03111112223"][data-arg="09:00"]'); assert.ok(quick, 'naye staff par Aaya ticket'); await click(quick);
  assert.equal(records.get(B + `staffAttendance/${today}_03111112223`).checkIn, '09:00');
  await click(`[data-action=toggle-closed][data-arg="${today}"]`);
  assert.equal(records.get(B + 'staffConfig/main').closedDays[0].date, today); assert.ok($('.closed-line'));
  await click(`[data-action=toggle-closed][data-arg="${today}"]`); assert.equal(records.get(B + 'staffConfig/main').closedDays.length, 0);
  records.set(B + `staffAttendance/2026-01-05_03001234567`, { date: '2026-01-05', phone: '03001234567', checkIn: '09:00', checkOut: '' });
  await app.data.closeCheckouts([{ id: '2026-01-05_03001234567', date: '2026-01-05', phone: '03001234567', checkIn: '09:00' }]);
  assert.equal(records.get(B + 'staffAttendance/2026-01-05_03001234567').checkOut, '18:00');
  await click('[data-action=tab][data-arg=salary]'); await click('.row-main[data-action=salary][data-phone="03007654321"]');
  const ex = $('form[data-form=extra]'); ex.elements.kind.value = 'loan'; ex.elements.kind.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(ex.elements.perMonth.hidden, false);
  fill(ex, { amount: '6000', perMonth: '2000' }); await submit(ex);
  const loan = records.get(B + 'staffAccounts/03007654321').salaryExtras.find(x => x.kind === 'loan'); assert.equal(loan.perMonth, 2000);
  assert.match($('[data-sheet=salary]').textContent, /Qarz ki qist/);
  await click('[data-sheet=salary] [data-sheet-close]');
  await click('[data-action=khata]'); assert.match($('[data-sheet=khata]').textContent, /Rs 6,000/); await click('[data-sheet=khata] [data-sheet-close]');
  await click('[data-action=tab][data-arg=settings]'); await click('[data-action=diag]');
  assert.match($('[data-sheet=diag]').textContent, new RegExp(today)); assert.match($('[data-sheet=diag]').textContent, /Aaj ke record/);
  await click('[data-sheet=diag] [data-sheet-close]');
});
test('v202: Aaya/Gaya tickets aur aasan time picker', async () => {
  await click('[data-action=tab][data-arg=hazri]');
  // Ali: aaya hai, gaya nahi -> Gaya tickets
  const row = () => $('.row-main[data-phone="03001234567"]').closest('.row');
  await click(row().querySelector('[data-action=tix-open]')); // Ali ka Gaya pehle se laga hai -> "Waqt badlein"
  const out = row().querySelector('[data-action=tix][data-kind=out][data-arg="20:30"]'); assert.ok(out, 'Gaya 8:30 ka ticket');
  await click(out); assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '20:30');
  await click(row().querySelector('[data-action=tix][data-kind=in][data-arg="09:15"]'));
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkIn, '09:15'); assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '20:30');
  // Naye staff (Usman) ki hazri hata kar Aaya ticket
  await app.data.deleteAttendance(`${today}_03111112223`); await settle();
  const inT = $('.row-main[data-phone="03111112223"]').closest('.row').querySelector('[data-action=tix][data-kind=in][data-arg="09:30"]'); assert.ok(inT, 'Aaya 9:30 ka ticket');
  await click(inT); assert.equal(records.get(B + `staffAttendance/${today}_03111112223`).checkIn, '09:30');
  // Time picker: 7 + PM = 19:xx, ticket, khali
  await click(`[data-action=edit-att][data-phone="03001234567"][data-date="${today}"]`.replace('edit-att', 'profile'));
  await click(`[data-sheet=profile] [data-action=edit-att][data-date="${today}"]`);
  const box = [...doc.querySelectorAll('form[data-form=att] [data-tp]')][1], hidden = box.querySelector('input[type=hidden]');
  box.querySelector('[data-tp-h]').value = '7'; box.querySelector('[data-tp-m]').value = '0'; // (happy-dom 'selected' theek nahi parhta, is liye minute khud)
  box.querySelector('[data-tp-h]').dispatchEvent(new win.Event('change', { bubbles: true }));
  await click(box.querySelector('[data-tp-ap="pm"]')); assert.equal(hidden.value, '19:00'); assert.match(box.querySelector('.tp-show').textContent, /7:00 PM/);
  await click(box.querySelector('[data-tp-ap="am"]')); assert.equal(hidden.value, '07:00');
  await submit($('form[data-form=att]')); assert.match(toastText(), /pehle hai/, 'Gaya aane se pehle nahi ho sakta');
  await click(box.querySelector('[data-tp-set="21:00"]')); assert.equal(hidden.value, '21:00');
  await click(box.querySelector('.tp-clear')); assert.equal(hidden.value, '');
  await click(box.querySelector('[data-tp-set="19:30"]')); await submit($('form[data-form=att]'));
  assert.equal(records.get(B + `staffAttendance/${today}_03001234567`).checkOut, '19:30');
  await click('[data-sheet=profile] [data-sheet-close]');
});
test('v202: raat ki duty ghalti se save ho to warning', async () => {
  await app.data.saveConfig({ shiftStart: '21:15', shiftEnd: '07:52', radius: 200 }); await settle();
  assert.match($('.attention').textContent, /ghalat lag rahi/);
  await click('.attention [data-action=settings]'); assert.match($('[data-sheet=cfg-duty]').textContent, /raat ki duty/);
  const f = $('form[data-form=cfg]'); await click(f.querySelector('[data-tp-set="09:15"]')); await click([...f.querySelectorAll('[data-tp]')][1].querySelector('[data-tp-set="19:00"]'));
  await submit(f); assert.deepEqual([records.get(B + 'staffConfig/main').shiftStart, records.get(B + 'staffConfig/main').shiftEnd], ['09:15', '19:00']);
  assert.equal($('.attention')?.textContent.includes('ghalat lag rahi') || false, false);
});
test('v204: Settings tab, selfie alag, server waqt, halka karna, check-out band', async () => {
  await click('[data-action=tab][data-arg=staff]'); assert.equal($('[data-action=diag]'), null, 'Staff tab mein sirf staff');
  await click('[data-action=tab][data-arg=settings]');
  for (const a of ['requests', 'khata', 'cfg-duty', 'cfg-salary', 'cfg-checkin', 'links', 'update', 'diag', 'password', 'logout']) assert.ok($(`.view [data-action="${a}"]`), a);
  // purani inline selfie + 40 min ka server farq
  await fake.sdk.setDoc({ path: B + `staffAttendance/${today}_03007654321` }, { id: `${today}_03007654321`, date: today, phone: '03007654321', checkIn: '09:10', checkOut: '', selfie: 'data:image/jpeg;base64,QUJD', serverAt: { seconds: Math.floor((Date.parse(today + 'T09:50:00+05:00')) / 1000), nanoseconds: 0 } }); await settle();
  assert.ok($('[data-action=migrate-selfies]'), 'halka karne ka button');
  await click('[data-action=tab][data-arg=hazri]');
  assert.match($('.row-main[data-phone="03007654321"]').closest('.row').textContent, /Server 9:50 am/);
  await click('[data-action=tab][data-arg=settings]'); await click('[data-action=migrate-selfies]'); await settle(10);
  const moved = records.get(B + `staffAttendance/${today}_03007654321`);
  assert.equal(moved.selfie, undefined); assert.equal(moved.hasSelfie, true); assert.equal(records.get(B + `staffSelfies/${today}_03007654321`).selfie, 'data:image/jpeg;base64,QUJD');
  await click('[data-action=tab][data-arg=hazri]'); await click('.row-main[data-phone="03007654321"]');
  await click(`[data-sheet=profile] [data-action=edit-att][data-date="${today}"]`); await settle(10);
  assert.ok($('[data-sheet=att] .proof img'), 'selfie daba kar load'); assert.match($('[data-sheet=att]').textContent, /40 min farq/);
  await click('[data-sheet=att] [data-sheet-close]'); await click('[data-sheet=profile] [data-sheet-close]');
  // aik ghalat ho to baqi Check-Out na rukein
  const r = await app.data.closeCheckouts([{ id: 'x', date: '2026-01-06', phone: '03001234567', checkIn: '22:30' }, { id: 'y', date: '2026-01-07', phone: '03001234567', checkIn: '09:00' }]);
  assert.equal(r.done, 1); assert.equal(r.failed.length, 1);
  // PIN ka option nahi hona chahiye (malik ne mana kiya); purana PIN field save par mit jaye
  records.set(B + 'staffAccounts/03111112223', { ...records.get(B + 'staffAccounts/03111112223'), pin: '' });
  await fake.sdk.setDoc({ path: B + 'staffAccounts/03111112223' }, { pin: '' }, { merge: true }); await settle();
  await click('[data-action=tab][data-arg=staff]'); await click('.row-main[data-phone="03111112223"]');
  assert.equal($('form[data-form=staff] [name=pin]'), null, 'staff form mein PIN nahi');
  await submit($('form[data-form=staff]'));
  assert.equal('pin' in records.get(B + 'staffAccounts/03111112223'), false, 'purana PIN field mit gaya');
});
test('v204: aaj ki selfies, history, Excel', async () => {
  const { createRequire } = await import('node:module'); const X = createRequire(import.meta.url)('./xlsx.mini.min.js'); if (X?.utils) win.XLSX = X; assert.ok(win.XLSX?.utils, 'xlsx');
  win.URL.createObjectURL = () => 'blob:x'; globalThis.URL.createObjectURL = win.URL.createObjectURL;
  records.set(B + `staffSelfies/${today}_03001234567`, { phone: '03001234567', date: today, selfie: 'data:image/jpeg;base64,AAAA', at: 1 });
  await click('[data-action=tab][data-arg=hazri]'); await click(`[data-action=selfies-day][data-arg="${today}"]`); await settle(10);
  assert.ok($('[data-sheet=selfies] img[alt=Selfie]'), 'selfie nazar aayi'); await click('[data-sheet=selfies] [data-sheet-close]');
  await click('[data-action=tab][data-arg=settings]'); await click('[data-action=history]'); await settle(10);
  assert.ok($('[data-sheet=history]'), 'history: ' + toastText());
  assert.match($('[data-sheet=history]').textContent, /Hazri badli/); await click('[data-sheet=history] [data-sheet-close]');
  await click('[data-action=tab][data-arg=salary]'); await click('[data-action=excel]'); await settle(10);
  assert.ok($('[data-sheet=pdf]'), 'Excel sheet nahi khula: ' + toastText());
  assert.match($('[data-sheet=pdf]').textContent, /NoorTraders_Hazri_Salary_.*\.xlsx/); await click('[data-sheet=pdf] [data-sheet-close]');
});
test('v205: malik ko parchi — Haan, abhi bahar, wapsi, salary mein alag', async () => {
  await click('[data-action=tab][data-arg=hazri]'); await click('[data-action=today]').catch?.(() => {});
  await fake.sdk.setDoc({ path: B + 'staffOuts/o1' }, { phone: '03001234567', date: today, reason: 'Bank', note: '', minutes: 15, status: 'pending', requestedAt: Date.now(), by: 'x' }); await settle(10);
  assert.ok($('.out-card'), 'Haan/Nahi card'); assert.match($('.out-card').textContent, /Bank/); assert.match(toastText(), /parchi/i);
  assert.match($('.tabs').textContent, /Settings/);
  await click('.out-card [data-action=out-review][data-arg=yes]');
  const o = records.get(B + 'staffOuts/o1'); assert.equal(o.status, 'approved'); assert.ok(o.outAt);
  assert.match($('.register').textContent, /Abhi bahar/);
  // 40 minute pehle gaya tha -> wapsi malik lagaye
  await fake.sdk.setDoc({ path: B + 'staffOuts/o1' }, { outAt: Date.now() - 40 * 60000 }, { merge: true }); await settle();
  await click('.out-list [data-action=outs]'); assert.match($('[data-sheet=outs]').textContent, /waqt se zyada/);
  await click('[data-sheet=outs] [data-action=out-return]');
  assert.equal(records.get(B + 'staffOuts/o1').status, 'returned'); await click('[data-sheet=outs] [data-sheet-close]');
  assert.match($('.register').textContent, /Bahar .*\(40 min\)/);
  // salary: kati band -> sirf nazar aaye; kati on -> kate
  // (Ali ka ye mahina upar final ho chuka hai, is liye seedha hisab se jaanch)
  const ali = app.data.state.staff.find(x => x.phone === '03001234567'), calc = () => C.salaryCalc({ account: ali, month: today.slice(0, 7), attendance: [], config: app.data.state.config, outs: app.data.state.outs });
  let c = calc(); assert.equal(c.outMin, 40); assert.equal(c.outCut, 0);
  await app.data.saveConfig({ outDeduct: true }); await settle();
  c = calc();
  assert.ok(c.outCut > 0, 'kati lagi'); await app.data.saveConfig({ outDeduct: false }); await settle();
  // naya: Nahi
  await fake.sdk.setDoc({ path: B + 'staffOuts/o2' }, { phone: '03001234567', date: today, reason: 'Khana', note: '', minutes: 10, status: 'pending', requestedAt: Date.now(), by: 'x' }); await settle(10);
  await click('.out-card [data-action=out-review][data-arg=no]'); assert.equal(records.get(B + 'staffOuts/o2').status, 'rejected');
});
test('v208: malik khana break — bari, waqt, sab wapas', async () => {
  await click('[data-action=tab][data-arg=hazri]');
  assert.ok(records.get(B + 'staffConfig/main').roster?.length >= 2, 'roster bana (manager ke liye naam)');
  await click('[data-action=break-start]'); assert.ok($('[data-sheet=break]'));
  await click('[data-sheet=break] [data-break-min="45"]'); assert.match($('[data-sheet=break]').textContent, /45 min/);
  const picks = [...doc.querySelectorAll('[data-sheet=break] [data-break-pick]:not([disabled])')];
  assert.ok(picks.length >= 1, 'duty wale chune ja sakte hain');
  await click('[data-sheet=break] [data-break-go]'); await settle(8);
  const br = [...records].filter(([k, v]) => k.includes('staffOuts/') && v.kind === 'break');
  assert.ok(br.length >= 1); assert.equal(br[0][1].minutes, 45); assert.equal(br[0][1].status, 'approved'); assert.equal(br[0][1].approvedByName, 'Malik');
  assert.match($('.view').textContent, /khane ke break par/); assert.match($('.register').textContent, /Khana break/);
  await click('[data-action=break-end-all]'); await settle(6);
  assert.ok(br.every(([k]) => records.get(k).status === 'returned'), 'sab wapas');
  assert.match($('.register').textContent, /Khana .*–/);
});
test('v209: malik ka ticket — banana, wapsi, katauti salary mein', async () => {
  await click('[data-action=tab][data-arg=hazri]');
  await click('[data-action=ticket-new]'); assert.ok($('[data-sheet=ticket-new]'));
  const f = $('[data-sheet=ticket-new] form');
  f.elements.phone.value = '03007654321';
  const ago = C.pkDate(new Date(Date.now() - 30 * 60000)) === today ? C.pkTime24(new Date(Date.now() - 30 * 60000)) : '00:00';
  f.elements.from.value = ago; f.elements.note.value = 'Dukaan khuli chhori';
  f.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await settle(10);
  const tk = [...records].find(([k, v]) => k.includes('staffTickets/') && v.phone === '03007654321');
  assert.ok(tk, 'ticket bana'); assert.equal(tk[1].status, 'open'); assert.equal(tk[1].byName, 'Malik');
  assert.match($('.register').textContent, /Bina bataye gaya/);
  assert.match($('.attention').textContent, /faisla baqi/);
  await click('.attention [data-action=tickets]'); assert.ok($('[data-sheet=tickets]'));
  await click('[data-sheet=tickets] [data-action=ticket-return]'); await settle(6);
  assert.equal(records.get(tk[0]).status, 'returned');
  const amt = $('[data-sheet=tickets] [data-ticket-amount]'); assert.ok(Number(amt.value) >= 0); amt.value = '150';
  await click('[data-sheet=tickets] [data-action=ticket-decide][data-arg=katauti]'); await settle(6);
  assert.equal(records.get(tk[0]).decision, 'katauti'); assert.equal(records.get(tk[0]).amount, 150);
  const bilal = app.data.state.staff.find(x => x.phone === '03007654321');
  const c = app.data.calcFor(bilal, today.slice(0, 7)); assert.equal(c.ticketCut, 150); assert.match(c.ticketLines[0].text, /Bina bataye gaya — .* — Rs 150/);
  await click('[data-sheet=tickets] [data-sheet-close]');
  // final mahine mein katauti nahi (Ali ka mahina final hai)
  const aliT = await app.data.createTicket({ phone: '03001234567', from: ago, back: C.pkTime24() }); await settle(6);
  await assert.rejects(app.data.decideTicket(aliT, 'katauti', 100), /final/);
  await app.data.decideTicket(aliT, 'warning'); await settle(4); assert.equal(records.get(B + 'staffTickets/' + aliT).decision, 'warning');
});
test('v210: chutti — aadha din, paisa katega / nahi', async () => {
  await fake.sdk.setDoc({ path: B + 'staffRequests/rq2' }, { phone: '03007654321', kind: 'leave', date: today, to: today, half: 'pm', checkIn: '', checkOut: '', reason: 'Doctor', status: 'pending', createdAt: Date.now(), by: 'x' }); await settle(8);
  await click('[data-action=tab][data-arg=settings]'); await click('[data-action=requests]');
  assert.match($('[data-sheet=requests]').textContent, /aadha din — shaam/);
  await click('[data-sheet=requests] [data-action=req][data-id=rq2][data-paid=no]'); await settle(6);
  assert.equal(records.get(B + 'staffRequests/rq2').status, 'approved'); assert.equal(records.get(B + 'staffRequests/rq2').paid, false);
  await click('[data-sheet=requests] [data-sheet-close]');
  await click('[data-action=tab][data-arg=hazri]');
  assert.match($('.register').textContent, /Aadhi chutti \(shaam\) · paisa katega/);
  // malik khud aadhi chutti de (subah, paisa nahi katega)
  await click('.row-main[data-phone="03001234567"]'); await click('[data-sheet=profile] [data-action=leave]');
  const lf = $('form[data-form=leave]'); lf.querySelector('[name=half][value=am]').checked = true; lf.querySelector('[name=paid][value=yes]').checked = true;
  await submit(lf);
  const lv = [...records].find(([k, v]) => k.includes('staffRequests/') && v.phone === '03001234567' && v.half === 'am');
  assert.ok(lv, 'aadhi chutti lagi'); assert.equal(lv[1].paid, true); assert.equal(lv[1].to, lv[1].date);
  await click('[data-sheet=profile] [data-sheet-close]');
});
test('logout → staff login → check-in / check-out', async () => {
  records.delete(B + `staffAttendance/${today}_03111112223`); // upar malik ne hazri lagayi thi
  await click('[data-action=tab][data-arg=staff]'); await click('.row-main[data-phone="03111112223"]');
  const wa = $('form[data-form=staff] a[href^="https://wa.me/92311"]'); assert.ok(wa, 'WhatsApp login link'); assert.match(decodeURIComponent(wa.getAttribute('href')), /#login=03111112223/);
  $('form[data-form=staff] [name=canApproveOuts]').checked = true; await submit($('form[data-form=staff]'));
  assert.equal(records.get(B + 'staffAccounts/03111112223').canApproveOuts, true, 'Usman manager'); assert.match($('.view').textContent, /Manager/);
  await new Promise(r => setTimeout(r, 1000)); assert.ok(storage.getItem('nt-hazri-snap-v1'), 'malik ki tasveer bani');
  await click('[data-action=tab][data-arg=settings]'); await click('[data-action=logout]'); await settle();
  assert.equal($('#app').dataset.screen, 'login');
  assert.equal(storage.getItem('nt-hazri-snap-v1'), null, 'logout par tasveer mit gayi');
  await click('[data-action=login-role][data-arg=staff]');
  assert.equal($('form[data-form=login] [name=pin]'), null, 'login par PIN nahi');
  fill($('form[data-form=login]'), { phone: '0311 1112223' }); await submit($('form[data-form=login]')); await settle(10);
  assert.ok([...records].some(([k, v]) => k.includes('staffSessions/') && v.phone === '03111112223' && !('pin' in v)), 'session sirf number se');
  assert.equal($('#app').dataset.screen, 'staff'); assert.match($('.brand').textContent, /Usman/);
  assert.ok($('.mode-bar'), 'manager: Meri hazri / Manager panel switch'); assert.match($('.view').textContent + $('.top').textContent, /Manager panel|Noor Traders/);
  await click('[data-action=mgr-mode][data-arg=me]');
  assert.ok($('[data-action=check-in]'), 'Check-In button'); assert.match($('.punch').textContent, /9h 45m roz/);
  // v215: screen ki tasveer phone mein (agli dafa foran dikhane ke liye)
  await new Promise(r => setTimeout(r, 1000));
  const snap = JSON.parse(storage.getItem('nt-hazri-snap-v1') || 'null');
  assert.ok(snap && snap.html.includes('check-in') && ['staff', 'manager'].includes(snap.role), 'tasveer mehfooz');
  const r = await app.data.checkIn({ selfie: 'data:image/jpeg;base64,AAAA', gps: { lat: 32.7979, lng: 73.9569, accuracy: 10, distance: 12 } }); assert.equal(r.queued, false); await settle();
  const att = records.get(B + `staffAttendance/${today}_03111112223`);
  assert.ok(att.checkIn); assert.equal(att.selfie, undefined, 'selfie record mein nahi'); assert.equal(att.hasSelfie, true); assert.ok(att.serverAt?.seconds, 'server ka waqt');
  assert.equal(records.get(B + `staffSelfies/${today}_03111112223`).selfie, 'data:image/jpeg;base64,AAAA');
  await assert.rejects(app.data.checkIn({ selfie: 'x', gps: { distance: 900 } }), /door/);
  assert.ok($('[data-action=check-out]'), 'ab Check-Out button'); assert.match($('.punch').textContent, /baqi/); assert.match($('.punch').textContent, /Malik tak pohanch gayi/);
  // ---- v205: bahar jane ki parchi ----
  Object.defineProperty(win.navigator, 'geolocation', { value: undefined, configurable: true });
  await click('[data-action=out-new]'); assert.ok($('[data-sheet=out-new]'));
  assert.match($('[data-sheet=out-new]').textContent, /واش روم — چھوٹی حاجت/); assert.match($('[data-sheet=out-new]').textContent, /3 منٹ/); assert.match($('[data-sheet=out-new]').textContent, /7 منٹ/);
  await click('[data-out-reason="Maal lene"]'); await click('[data-out-min="20"]');
  $('form[data-form=out]').elements.note.value = 'Rehman traders';
  await submit($('form[data-form=out]'));
  const outRec = [...records].find(([k, v]) => k.includes('staffOuts/') && v.phone === '03111112223' && !v.kind);
  assert.ok(outRec, 'parchi bani'); const [outKey, outVal] = outRec;
  assert.deepEqual(Object.keys(outVal).sort(), ['by', 'date', 'minutes', 'name', 'note', 'phone', 'reason', 'requestedAt', 'serverAt', 'status'].sort(), 'sirf rules wali keys'); assert.equal(outVal.name, 'Usman');
  assert.equal(outVal.status, 'pending'); assert.match($('.view').textContent, /Parchi malik ke paas hai/);
  await assert.rejects(app.data.requestOut({ reason: 'Khana', minutes: 10 }), /pehle se malik/);
  // malik ne Haan kiya (seedha record mein, jaise doosre phone se)
  await fake.sdk.setDoc({ path: outKey }, { status: 'approved', outAt: Date.now() - 25 * 60000, approvedAt: Date.now() }, { merge: true }); await settle();
  assert.ok($('.gate'), 'Gate Pass khula'); assert.match($('.gate').textContent, /مالک نے منظور کیا/); assert.match($('.gate').textContent, /مال لینے/);
  assert.ok($('.gate [data-live-clock]'), 'chalti ghari'); assert.match($('.gate').textContent, /waqt guzar gaya/);
  await click('[data-action=gate-big]'); assert.ok($('[data-sheet=gate] .gate.big')); await click('[data-sheet=gate] [data-sheet-close]');
  await click('.gate [data-action=out-return]'); await settle(10);
  const back = records.get(outKey); assert.equal(back.status, 'returned'); assert.ok(back.returnAt); assert.ok(back.returnServerAt?.seconds);
  assert.equal($('.gate'), null); assert.match($('.view').textContent, /Aaj bahar:/);
  // ---- v211: manager panel (Usman) — sab kar sakta hai, sirf hazri nahi ----
  await click('[data-action=mgr-mode][data-arg=panel]'); await settle(8);
  assert.ok($('.tabs [data-arg=salary]') && $('.tabs [data-arg=settings]'), 'malik jaisa panel');
  assert.match($('.brand').textContent, /Manager panel/);
  await fake.sdk.setDoc({ path: B + 'staffOuts/m1' }, { phone: '03001234567', name: 'Ali Raza', date: today, reason: 'Washroom (chhoti hajat)', note: '', minutes: 5, status: 'pending', requestedAt: Date.now(), by: 'x' }); await settle(10);
  assert.ok($('.out-card'), 'parchi card');
  await click('.out-card [data-action=out-review][data-arg=yes]'); await settle(6);
  const m1 = records.get(B + 'staffOuts/m1'); assert.equal(m1.status, 'approved'); assert.equal(m1.approvedByName, 'Usman');
  assert.ok($('.out-list .b-row'), 'har naam ke aage waqt'); assert.match($('.out-list').textContent, /gaya · .* tak/);
  await click('.out-list .b-row[data-action=out-return]'); await settle(6);
  assert.equal(records.get(B + 'staffOuts/m1').status, 'returned'); assert.equal(records.get(B + 'staffOuts/m1').returnByName, 'Usman');
  // hazri ke buttons band
  const tixBtn = $('[data-action=tix]'); if (tixBtn) { await click(tixBtn); assert.match(toastText(), /sirf malik/); }
  await assert.rejects(app.data.saveAttendance({ phone: '03001234567', date: today, checkIn: '09:00' }), /sirf malik/);
  await assert.rejects(app.data.toggleClosed(today), /sirf malik/);
  // apni parchi / ticket ka faisla khud nahi
  await assert.rejects(app.data.reviewOut(outKey.split('/').pop(), true), /pehle hi|khud nahi/);
  await assert.rejects(app.data.createTicket({ phone: '03111112223', from: C.pkTime24() }), /Apne upar/);
  // ticket banana aur faisla (manager ko ijazat hai)
  await click('[data-action=ticket-new]'); const tf = $('[data-sheet=ticket-new] form');
  tf.elements.phone.value = '03007654321'; tf.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await settle(10);
  const st = [...records].find(([k, v]) => k.includes('staffTickets/') && v.byName === 'Usman');
  assert.ok(st, 'manager ne ticket banaya');
  await app.data.returnTicket(app.data.state.tickets.find(t => t.id === st[0].split('/').pop())); await settle(6);
  await app.data.decideTicket(st[0].split('/').pop(), 'warning'); await settle(6); assert.equal(records.get(st[0]).decision, 'warning');
  assert.ok([...records].some(([k, v]) => k.includes('staffAudit/') && v.byName === 'Usman'), 'history mein manager ka naam');
  // khana break (panel se), har naam par wapsi
  records.set(B + `staffAttendance/${today}_03007654321`, { date: today, phone: '03007654321', checkIn: '09:20', checkOut: '' });
  await fake.sdk.setDoc({ path: B + `staffAttendance/${today}_03007654321` }, { checkIn: '09:20' }, { merge: true }); await settle();
  await click('[data-action=break-start]'); assert.ok($('[data-sheet=break]'), 'break sheet');
  const custom = $('[data-sheet=break] [data-break-custom]'); custom.value = '25'; custom.dispatchEvent(new win.Event('change', { bubbles: true })); await settle();
  for (const cb of doc.querySelectorAll('[data-sheet=break] [data-break-pick]')) { if (!cb.disabled && !cb.checked) { cb.checked = true; cb.dispatchEvent(new win.Event('change', { bubbles: true })); await settle(2); } }
  await click('[data-sheet=break] [data-break-go]'); await settle(8);
  const mb = [...records].filter(([k, v]) => k.includes('staffOuts/') && v.kind === 'break' && v.approvedByName === 'Usman');
  assert.ok(mb.length >= 1, 'manager ne break shuru kiya'); assert.equal(mb[0][1].minutes, 25);
  assert.ok($('.break-card .b-row'), 'break card mein har naam'); await click('.break-card .b-row[data-action=break-end-one]'); await settle(6);
  assert.equal(mb.filter(([k]) => records.get(k).status === 'returned').length, 1, 'sirf aik ki wapsi');
  if ($('[data-action=break-end-all]')) { await click('[data-action=break-end-all]'); await settle(8); }
  assert.ok(mb.every(([k]) => records.get(k).status === 'returned'), 'sab wapas');
  // salary badal sakta hai (bonus)
  await click('[data-action=tab][data-arg=salary]'); assert.ok($('.totals'), 'salary dikhti hai');
  await click('[data-action=mgr-mode][data-arg=me]');
  await click('[data-action=check-out]'); await settle(10);
  assert.ok(records.get(B + `staffAttendance/${today}_03111112223`).checkOut); assert.match($('.punch').textContent, /mukammal/);
});
test('staff: request bhejna (sirf rules wali keys), salary tab', async () => {
  await click('[data-action=tab][data-arg=request]');
  const form = $('form[data-form=request]'); fill(form, { reason: 'Shadi hai' }); await submit(form);
  const req = [...records].find(([k, v]) => k.includes('staffRequests/') && v.reason === 'Shadi hai')[1];
  assert.deepEqual(Object.keys(req).sort(), ['by', 'checkIn', 'checkOut', 'createdAt', 'date', 'half', 'kind', 'phone', 'reason', 'status', 'to']); assert.equal(req.half, '');
  await click('[data-action=tab][data-arg=salary]'); assert.match($('.calc').textContent, /Mahana salary/);
  await click('[data-action=tab][data-arg=hazri]'); assert.ok($('.days'));
});

test.after(async () => { app.data.stop(); await win.happyDOM.abort(); win.close(); });
