// Optional integration gate: run with a local Firestore emulator only.
// npm install --no-save @firebase/rules-unit-testing@3.0.4 firebase@10.14.1
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8087 node --test tests/firestore.rules.mjs
import { test, before, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, getDoc, getDocs, updateDoc, query, where } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Local Firestore emulator is required; never run against production.');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const base = 'businesses/noor-traders';
const phone = '03000000001', other = '03000000002', disabled = '03000000003';
let env, owner, staff, outsider;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-noor-login', firestore: {
    host, port: Number(port), rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
  }});
  owner = env.authenticatedContext('owner-uid', { email: 'admin@nt-traders.firebaseapp.com', firebase: { sign_in_provider: 'password' } }).firestore();
  staff = env.authenticatedContext('staff-uid', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  outsider = env.authenticatedContext('unrelated-email', { email: 'unrelated@example.test', firebase: { sign_in_provider: 'password' } }).firestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const number of [phone, other, disabled]) await setDoc(doc(db, `${base}/staffAccounts/${number}`), { phone: number, name: 'Test employee', active: true, loginEnabled: number !== disabled });
    await setDoc(doc(db, `${base}/settings/main`), { categories: ['Test category'] });
    await setDoc(doc(db, `${base}/staffConfig/main`), { radius: 200 });
    await setDoc(doc(db, `${base}/staffAttendance/first`), { phone, date: '2026-09-08', checkIn: '09:00' });
    await setDoc(doc(db, `${base}/staffAttendance/second`), { phone: other, date: '2026-09-08', checkIn: '09:01' });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('provisioned owner can read business data and manage staff', async () => {
  await assertSucceeds(getDoc(doc(owner, `${base}/settings/main`)));
  await assertSucceeds(updateDoc(doc(owner, `${base}/staffAccounts/${phone}`), { role: 'Cashier' }));
});
test('unrelated email account and unauthenticated client cannot read business data', async () => {
  await assertFails(getDoc(doc(outsider, `${base}/settings/main`)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `${base}/settings/main`)));
});
test('legacy owner identity retains access', async () => {
  const legacy = env.authenticatedContext('legacy-owner', { email: 'owner@nttraders.local', firebase: { sign_in_provider: 'password' } }).firestore();
  await assertSucceeds(getDoc(doc(legacy, `${base}/settings/main`)));
});
test('staff must establish its own UID-bound session before reading a profile', async () => {
  await assertFails(getDoc(doc(staff, `${base}/staffAccounts/${phone}`)));
  await assertFails(setDoc(doc(staff, `${base}/staffSessions/someone-else`), { phone, createdAt: 1 }));
  await assertSucceeds(setDoc(doc(staff, `${base}/staffSessions/staff-uid`), { phone, createdAt: 1 }));
  await assertSucceeds(getDoc(doc(staff, `${base}/staffAccounts/${phone}`)));
});
test('staff can read attendance policy and its own attendance query', async () => {
  await assertSucceeds(getDoc(doc(staff, `${base}/staffConfig/main`)));
  await assertSucceeds(getDocs(query(collection(staff, `${base}/staffAttendance`), where('phone', '==', phone))));
});
test('staff cannot read business accounts, other staff profiles, or other attendance', async () => {
  await assertFails(getDoc(doc(staff, `${base}/settings/main`)));
  await assertFails(getDoc(doc(staff, `${base}/staffAccounts/${other}`)));
  await assertFails(getDocs(collection(staff, `${base}/staffAccounts`)));
  await assertFails(getDoc(doc(staff, `${base}/staffAttendance/second`)));
});
test('staff cannot change role, policy, or rebind a session to another employee', async () => {
  await assertFails(updateDoc(doc(staff, `${base}/staffAccounts/${phone}`), { role: 'owner' }));
  await assertFails(updateDoc(doc(staff, `${base}/staffConfig/main`), { radius: 9999 }));
  await assertFails(updateDoc(doc(staff, `${base}/staffSessions/staff-uid`), { phone: other }));
});
test('staff can update its own checkout but cannot write another employee attendance', async () => {
  await assertSucceeds(updateDoc(doc(staff, `${base}/staffAttendance/first`), { checkOut: '18:00' }));
  await assertFails(updateDoc(doc(staff, `${base}/staffAttendance/second`), { checkOut: '18:00' }));
  await assertFails(setDoc(doc(staff, `${base}/staffAttendance/forged`), { phone: other, date: '2026-09-08' }));
});
test('disabled staff, malformed phones and extra session fields are rejected', async () => {
  for (const [uid, data] of [
    ['disabled-staff', { phone: disabled, createdAt: 1 }],
    ['bad-phone', { phone: 3000000001, createdAt: 1 }],
    ['extra-role', { phone, createdAt: 1, role: 'owner' }]
  ]) {
    const db = env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(setDoc(doc(db, `${base}/staffSessions/${uid}`), data));
  }
});
test('disabling an already signed-in employee immediately blocks attendance access', async () => {
  await assertSucceeds(updateDoc(doc(owner, `${base}/staffAccounts/${phone}`), { loginEnabled: false }));
  await assertFails(getDoc(doc(staff, `${base}/staffAttendance/first`)));
  await assertFails(updateDoc(doc(staff, `${base}/staffAttendance/first`), { checkOut: '19:00' }));
});
