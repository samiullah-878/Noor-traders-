// v217: pakki tasdeeq — Check-Out / Wapsi phone mein yaad, server se jaanch, na mile to wahi PURANA waqt dobara.
import test from 'node:test'; import assert from 'node:assert/strict';
import { fakeSdk, memoryStorage, B } from './test-fake-sdk.mjs';
import { createData } from './data.js';
import { pkDate, pkTime24 } from './core.js';

const today = pkDate(), phone = '03001112223', id = `${today}_${phone}`, BOX = 'nt-hazri-outbox-v217';
const wait = ms => new Promise(r => setTimeout(r, ms));
function setup(records, storage) {
  const fake = fakeSdk({ records }), events = [];
  const data = createData({ sdk: fake.sdk, firebaseConfig: {}, storage, onProblem: (name, e) => events.push([name, e]) });
  return { fake, data, events };
}
const base = () => new Map([
  [B + 'staffConfig/main', { shiftStart: '09:00', shiftEnd: '19:00', radius: 200 }],
  [B + `staffAccounts/${phone}`, { name: 'Sonu', phone }],
  [B + `staffAttendance/${id}`, { id, date: today, phone, checkIn: '09:05', checkInTs: Date.now() - 3 * 3600000 }]
]);
async function started(data) { data.startStaff(phone); for (let i = 0; i < 50 && !data.state.loaded.has('myAttendance'); i++) await wait(5); await wait(10); }

test('Check-Out server tak na gaya (app band) -> dobara kholne par wahi purana waqt khud chala jata hai', async () => {
  const records = base(), storage = memoryStorage();
  const a = setup(records, storage); await started(a.data);
  a.fake.fail.hangPath = 'staffAttendance/';
  const row = a.data.state.myAttendance.find(r => r.id === id);
  const res = await a.data.checkOut(row, null);
  assert.equal(res.queued, true, 'dheema: phone mein');
  assert.equal(a.data.state.sync['checkout:' + id].phase, 'waiting');
  const box = JSON.parse(storage.getItem(BOX)); assert.equal(box.length, 1); const original = box[0].fields.checkOut;
  assert.ok(!records.get(B + `staffAttendance/${id}`).checkOut, 'server par abhi nahi');
  a.data.stop();
  // app dobara khuli, internet theek
  const b = setup(records, storage); await started(b.data);
  const sent = await b.data.drainOutbox(); await wait(10);
  assert.equal(sent, 1, 'aik dafa dobara bheja');
  assert.equal(records.get(B + `staffAttendance/${id}`).checkOut, original, 'wahi asal waqt, dobara bhejne ka waqt nahi');
  assert.ok(records.get(B + `staffAttendance/${id}`).outServerAt?.seconds, 'server ka waqt');
  assert.equal(storage.getItem(BOX), null, 'qataar khali');
  assert.ok(b.events.some(([n, e]) => n === 'confirmed' && e.kind === 'checkout' && e.fresh === false), 'purani likhai: sirf chhota paigham');
  b.data.stop();
});

test('malik ne pehle hi band kar diya ho to dobara nahi bhejte — seedha kamyab', async () => {
  const records = base(), storage = memoryStorage();
  storage.setItem(BOX, JSON.stringify([{ key: 'checkout:' + id, kind: 'checkout', coll: 'staffAttendance', id, phone, fields: { phone, checkOut: '19:40' }, at: Date.now() - 60000 }]));
  records.set(B + `staffAttendance/${id}`, { ...records.get(B + `staffAttendance/${id}`), checkOut: '19:00' });
  const a = setup(records, storage); await started(a.data);
  assert.equal(await a.data.drainOutbox(), 0);
  assert.equal(records.get(B + `staffAttendance/${id}`).checkOut, '19:00', 'malik wala waqt nahi badla');
  assert.equal(storage.getItem(BOX), null); a.data.stop();
});

test('server ne mana kiya -> fail + wajah; "Dobara bhejein" se kamyab; record hi na ho to "missing"', async () => {
  const records = base(), storage = memoryStorage();
  const a = setup(records, storage); await started(a.data);
  a.fake.fail.denyPath = 'staffAttendance/';
  const row = a.data.state.myAttendance.find(r => r.id === id);
  await assert.rejects(a.data.checkOut(row, null), e => e.code === 'permission-denied');
  await wait(10);
  assert.equal(a.data.state.sync['checkout:' + id].phase, 'fail'); assert.equal(a.data.state.punchError.kind, 'checkout');
  assert.equal(JSON.parse(storage.getItem(BOX))[0].lastError, 'permission-denied');
  a.fake.fail.denyPath = null;
  await a.data.retrySync('checkout:' + id); await wait(10);
  assert.ok(records.get(B + `staffAttendance/${id}`).checkOut); assert.equal(a.data.state.sync['checkout:' + id].phase, 'ok');
  assert.equal(a.data.state.punchError, null); assert.equal(storage.getItem(BOX), null);
  // record server par hai hi nahi (Check-In pohancha hi nahi tha)
  a.fake.fail.denyPath = 'staffAttendance/';
  const ghost = { id: `${today}_${phone}x`, date: today, checkIn: '09:00' };
  await assert.rejects(a.data.checkOut(ghost, null)); await wait(10);
  assert.equal(a.data.state.sync['checkout:' + ghost.id].phase, 'fail'); assert.equal(a.data.state.punchError.code, 'missing');
  a.data.stop();
});

test('Wapas aa gaya: pakki tasdeeq, na pohanche to dobara', async () => {
  const records = base(), storage = memoryStorage();
  records.set(B + 'staffOuts/o1', { phone, name: 'Sonu', date: today, reason: 'Bank', note: '', minutes: 20, status: 'approved', outAt: Date.now() - 600000, requestedAt: Date.now() - 700000, by: 'x' });
  const a = setup(records, storage); await started(a.data);
  a.fake.fail.hangPath = 'staffOuts/';
  const o = a.data.state.outs.find(x => x.id === 'o1');
  const res = await a.data.returnOut(o, null); assert.equal(res.queued, true);
  assert.equal(records.get(B + 'staffOuts/o1').status, 'approved', 'server par abhi bahar');
  a.data.stop();
  const b = setup(records, storage); await started(b.data);
  assert.equal(await b.data.drainOutbox(), 1); await wait(10);
  assert.equal(records.get(B + 'staffOuts/o1').status, 'returned'); assert.ok(records.get(B + 'staffOuts/o1').returnServerAt?.seconds);
  assert.equal(storage.getItem(BOX), null); b.data.stop();
});

test('Check-In ki tasdeeq: kamyabi par "confirmed" (fresh) event', async () => {
  const records = base(), storage = memoryStorage();
  records.delete(B + `staffAttendance/${id}`);
  const a = setup(records, storage); await started(a.data);
  const r = await a.data.checkIn({ selfie: 'data:image/jpeg;base64,AAAA', gps: { lat: 32.7979, lng: 73.9569, accuracy: 8, distance: 10 } }); await wait(10);
  assert.equal(r.queued, false);
  assert.ok(a.events.some(([n, e]) => n === 'confirmed' && e.kind === 'checkin' && e.fresh === true));
  assert.equal(a.data.state.sync['checkin:' + id].phase, 'ok'); assert.equal(storage.getItem(BOX), null);
  a.data.stop();
});

// ---------- v218: jaanch ka record (staffDiag) ----------
import { readFileSync } from 'node:fs';
import { APP_VERSION } from './core.js';
const rulesKeys = (() => { const r = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'); const m = r.slice(r.indexOf('staffDiag/{phone}')).match(/hasOnly\(\[([^\]]+)\]\)/); return m[1].split(',').map(x => x.trim().replace(/'/g, '')); })();
test('v218: staff app khulte hi apna record likhti hai (sirf rules wali keys), fail aur theek hona bhi', async () => {
  const records = base(), storage = memoryStorage();
  const a = setup(records, storage); await started(a.data); await wait(20);
  const d = records.get(B + `staffDiag/${phone}`);
  assert.ok(d, 'record bana'); assert.equal(d.v, APP_VERSION); assert.equal(d.phone, phone); assert.equal(d.name, 'Sonu'); assert.ok(d.serverAt?.seconds, 'server ka waqt');
  assert.ok(['home', 'browser'].includes(d.app)); assert.equal(d.pending, 0);
  for (const k of Object.keys(d)) assert.ok(rulesKeys.includes(k), 'rules mein nahi: ' + k);
  assert.equal(a.data.diagPing(), false, 'aam record 30 minute mein aik dafa');
  a.fake.fail.denyPath = 'staffAttendance/';
  const row = a.data.state.myAttendance.find(r => r.id === id);
  await assert.rejects(a.data.checkOut(row, null)); await wait(20);
  const f = records.get(B + `staffDiag/${phone}`);
  assert.equal(f.failKind, 'checkout'); assert.equal(f.failCode, 'permission-denied'); assert.equal(f.failDate, today); assert.equal(f.failId, id);
  a.fake.fail.denyPath = null;
  await a.data.retrySync('checkout:' + id); await wait(20);
  assert.ok(records.get(B + `staffDiag/${phone}`).fixedAt >= f.failAt, 'theek hone ka waqt');
  for (const k of Object.keys(records.get(B + `staffDiag/${phone}`))) assert.ok(rulesKeys.includes(k), 'rules mein nahi: ' + k);
  a.data.stop();
});
test('v218: der se pohanchi likhai ka record (kitne minute phone mein ruki)', async () => {
  const records = base(), storage = memoryStorage();
  storage.setItem(BOX, JSON.stringify([{ key: 'checkout:' + id, kind: 'checkout', coll: 'staffAttendance', id, phone, fields: { phone, checkOut: '19:40', checkOutTs: Date.now() - 42 * 60000 }, at: Date.now() - 42 * 60000 }]));
  const a = setup(records, storage); await started(a.data);
  assert.equal(await a.data.drainOutbox(), 1); await wait(20);
  const d = records.get(B + `staffDiag/${phone}`);
  assert.equal(d.lateKind, 'checkout'); assert.ok(d.lateMin >= 41 && d.lateMin <= 43, 'minute: ' + d.lateMin);
  assert.equal(records.get(B + `staffAttendance/${id}`).checkOut, '19:40');
  a.data.stop();
});

// ---------- v219: token safai — aik phone = aik token ----------
test('v219: naya token save hote hi isi phone ke purane hat jate hain, doosre phone ke nahi', async () => {
  const records = base(), storage = memoryStorage();
  const legacyUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML';
  records.set(B + 'pushTokens/a', { token: 'TOK-A', role: 'owner', phone: '', device: legacyUA, at: 1 });
  records.set(B + 'pushTokens/b', { token: 'TOK-B', role: 'owner', phone: '', device: legacyUA, at: 2 });
  records.set(B + 'pushTokens/m', { token: 'TOK-M', role: 'manager', phone: '03005550000', device: legacyUA, at: 3 });
  records.set(B + 'pushTokens/o', { token: 'TOK-O', role: 'owner', phone: '', device: 'd:otherphone1 · Android 12', at: 4 });
  const a = setup(records, storage); a.data.state.role = 'owner';
  assert.equal(await a.data.savePushToken('TOKEN-NEW-1', legacyUA), 2, 'isi phone ke 2 purane');
  const keys = () => [...records.keys()].filter(k => k.includes('pushTokens/')).map(k => records.get(k).token).sort();
  assert.deepEqual(keys(), ['TOK-M', 'TOK-O', 'TOKEN-NEW-1'], 'manager aur doosre phone ka token baqi');
  const mine = [...records.values()].find(v => v.token === 'TOKEN-NEW-1');
  assert.match(mine.device, /^d:\w+ · /, 'phone ki apni pehchan');
  assert.equal(await a.data.savePushToken('TOKEN-NEW-2', legacyUA), 1, 'agla naya token: pichla hata');
  assert.deepEqual(keys(), ['TOK-M', 'TOK-O', 'TOKEN-NEW-2']);
});

// ---------- v221: bahar se Check-Out — sirf rules wali keys, malik manzoor kare to waqt + location hazri mein ----------
const reqKeys = (() => { const r = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'); const m = r.slice(r.indexOf('staffRequests/{requestId}')).match(/hasOnly\(\[([^\]]+)\]\)/); return m[1].split(',').map(x => x.trim().replace(/'/g, '')); })();
test('v221: bahar se Check-Out request -> malik manzoor -> Check-Out + location record mein', async () => {
  const records = base(), storage = memoryStorage();
  // asal waqt ke hisab se: 3 ghante pehle aaya, 1 ghanta pehle nikla (raat ke 1-2 baje test chale tab bhi sahi)
  const tIn = new Date(Date.now() - 3 * 3600000), tOut = new Date(Date.now() - 3600000), inDate = pkDate(tIn), rid = `${inDate}_${phone}`;
  records.set(B + `staffAttendance/${rid}`, { id: rid, date: inDate, phone, checkIn: pkTime24(tIn), checkInTs: tIn.getTime() });
  const a = setup(records, storage); a.fake.auth.currentUser = { uid: 'anon-1' }; await started(a.data);
  const row = a.data.state.myAttendance.find(r => r.id === rid);
  await assert.rejects(a.data.requestOutsideCheckout({ row, time: '', reason: 'x' }), /waqt chunein/);
  await assert.rejects(a.data.requestOutsideCheckout({ row, time: pkTime24(new Date(tIn.getTime() - 5 * 60000)), reason: 'x' }), /pehle hai|16 ghante/);
  const outT = pkTime24(tOut);
  const r = await a.data.requestOutsideCheckout({ row, time: outT, reason: 'Chutti ke baad Check-Out bhool gaya', note: 'ghar pohanch gaya', gps: { lat: 32.8301234567, lng: 73.99, accuracy: 14.4, distance: 4321.7 } });
  assert.equal(r.queued, false); await wait(10);
  const [rk, rv] = [...records].find(([k, v]) => k.includes('staffRequests/') && v.via === 'outside');
  for (const k of Object.keys(rv)) assert.ok(reqKeys.includes(k), 'rules mein nahi: ' + k);
  assert.equal(rv.distance, 4322); assert.equal(rv.lat, 32.830123); assert.match(rv.reason, /bhool gaya — ghar pohanch gaya/);
  a.data.stop();
  // malik manzoor kare
  const o = setup(records, storage); o.fake.auth.currentUser = { uid: 'owner-uid', email: 'hp6235@gmail.com', isAnonymous: false }; o.data.startOwner(); await wait(30);
  await o.data.reviewRequest(rk.split('/').pop(), 'approved'); await wait(10);
  const att = records.get(B + `staffAttendance/${rid}`);
  assert.equal(att.checkOut, outT); assert.equal(att.checkOutVia, 'outside'); assert.equal(att.checkOutDistance, 4322); assert.equal(records.get(rk).status, 'approved');
  o.data.stop();
});
test('v221: location na mile to bhi request (wajah ke sath)', async () => {
  const records = base(), storage = memoryStorage();
  const tIn = new Date(Date.now() - 3 * 3600000), inDate = pkDate(tIn), rid = `${inDate}_${phone}`;
  records.set(B + `staffAttendance/${rid}`, { id: rid, date: inDate, phone, checkIn: pkTime24(tIn), checkInTs: tIn.getTime() });
  const a = setup(records, storage); a.fake.auth.currentUser = { uid: 'anon-1' }; await started(a.data);
  const row = a.data.state.myAttendance.find(r => r.id === rid);
  await a.data.requestOutsideCheckout({ row, time: pkTime24(new Date(Date.now() - 3600000)), reason: 'Doosri wajah', gpsError: 'Location ki ijazat band hai. Browser ki settings mein is site ke liye Location "Allow" karein.' }); await wait(10);
  const [, rv] = [...records].find(([k, v]) => k.includes('staffRequests/') && v.via === 'outside');
  assert.equal(rv.lat, undefined); assert.ok(rv.gpsError.length <= 60); a.data.stop();
});
