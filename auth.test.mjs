import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthController, normalizePhone, parseLogin, OWNER_EMAILS } from '../auth-controller.js';

const FIRST = '03000000001', SECOND = '03000000002';
const fault = code => Object.assign(new Error(code), { code });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(options = {}) {
  const auth = { currentUser: null };
  let listener = () => {}, sequence = 0;
  const sessions = new Map(), profiles = new Map([
    [FIRST, { name: 'First employee', phone: FIRST, active: true }],
    [SECOND, { name: 'Second employee', phone: SECOND, active: true }]
  ]);
  const owners = new Map([[options.ownerEmail || OWNER_EMAILS[0], 'initial-password']]);
  const events = [], errors = [], calls = [];
  let view = null;
  const notify = user => { auth.currentUser = user; listener(user); };
  const sdk = {
    onAuthStateChanged(_auth, callback) { listener = callback; queueMicrotask(() => listener(auth.currentUser)); return () => { listener = () => {}; }; },
    async signInWithEmailAndPassword(_auth, email, password) {
      calls.push(['owner-login', email]);
      if (owners.get(email) !== password) throw fault('auth/invalid-credential');
      if (options.signInDelay) await options.signInDelay.promise;
      const user = { uid: 'owner-uid', email, isAnonymous: false };
      notify(user); return { user };
    },
    async signInAnonymously() {
      calls.push(['staff-login']);
      if (options.authError) throw fault(options.authError);
      const user = { uid: `anonymous-${++sequence}`, isAnonymous: true };
      notify(user); return { user };
    },
    async signOut() { calls.push(['logout']); notify(null); },
    EmailAuthProvider: { credential(email, password) { return { email, password }; } },
    async reauthenticateWithCredential(user, credential) {
      calls.push(['reauthenticate']);
      if (owners.get(user.email) !== credential.password) throw fault('auth/invalid-credential');
    },
    async updatePassword(user, password) { calls.push(['change-password']); owners.set(user.email, password); }
  };
  const controller = createAuthController({
    auth, sdk,
    accounts: {
      async createSession(uid, phone) {
        if (options.sessionDelay) await options.sessionDelay.promise;
        if (options.sessionError) throw fault(options.sessionError);
        sessions.set(uid, { phone });
      },
      async getSession(uid) { calls.push(['read-session', uid]); if(options.sessionReadError)throw fault(options.sessionReadError); return sessions.get(uid); },
      async getAccount(phone) { return profiles.get(phone); }
    },
    onReset() { view = null; events.push('hidden'); },
    onSession(session) { view = session; events.push(`${session.role}:${session.phone || session.user.uid}`); },
    onError(error) { errors.push(error.code); }
  });
  return { auth, controller, profiles, sessions, events, errors, calls, notify, owners, get view() { return view; } };
}

test('the same admin username resolves separately for the selected owner and staff roles', () => {
  assert.equal(parseLogin({ role: 'owner', username: ' Admin ', password: '1234' }).role, 'owner');
  assert.deepEqual(parseLogin({ role: 'staff', username: 'admin', password: FIRST }), { role: 'staff', phone: FIRST });
});
test('mobile passwords preserve the leading zero and support Pakistani international and Urdu formats', () => {
  for (const value of [FIRST, '+92 300 0000001', '00923000000001', '3000000001', '۰۳۰۰۰۰۰۰۰۰۱']) {
    assert.equal(normalizePhone(value), FIRST);
  }
  assert.equal(normalizePhone(`wrong${FIRST}`), '');
  assert.throws(() => parseLogin({ role: 'staff', username: 'admin', password: '1234' }));
  assert.throws(() => parseLogin({ role: 'staff', username: SECOND, password: FIRST }));
});
test('owner login opens only the owner panel', async () => {
  const f = fixture();
  await f.controller.login({ role: 'owner', username: 'admin', password: 'initial-password' });
  assert.equal(f.view.role, 'owner');
  assert.equal(f.calls.some(call => call[0] === 'staff-login'), false);
});
test('legacy owner credentials still work through the admin alias', async () => {
  const f = fixture({ ownerEmail: OWNER_EMAILS[1] });
  await f.controller.login({ role: 'owner', username: 'admin', password: 'initial-password' });
  assert.equal(f.view.user.email, OWNER_EMAILS[1]);
});
test('a wrong owner password never falls back to anonymous staff access', async () => {
  const f = fixture();
  await assert.rejects(f.controller.login({ role: 'owner', username: 'admin', password: FIRST }), { code: 'auth/invalid-credential' });
  assert.equal(f.view, null);
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.calls.some(call => call[0] === 'staff-login'), false);
});
test('anonymous auth event arriving before a slow session write does not sign the employee out', async () => {
  const sessionDelay = deferred(), f = fixture({ sessionDelay });
  const login = f.controller.login({ role: 'staff', username: 'admin', password: FIRST });
  await tick();
  assert.equal(f.view, null);
  assert.ok(f.auth.currentUser?.isAnonymous);
  assert.equal(f.calls.filter(call => call[0] === 'logout').length, 0);
  sessionDelay.resolve(); await login;
  assert.equal(f.view.phone, FIRST);
  assert.equal(f.events.filter(event => event.startsWith('staff:')).length, 1);
  assert.equal(f.events.some(event => event.startsWith('owner:')), false);
});
test('two staff members on the same browser receive different sessions and the correct profiles', async () => {
  const f = fixture();
  await f.controller.login({ role: 'staff', username: 'admin', password: FIRST });
  const firstUid = f.view.user.uid;
  await f.controller.logout();
  await f.controller.login({ role: 'staff', username: 'admin', password: SECOND });
  assert.notEqual(f.view.user.uid, firstUid);
  assert.equal(f.view.account.name, 'Second employee');
  assert.equal(f.sessions.get(f.view.user.uid).phone, SECOND);
});
test('restoring a session uses the phone bound to the Firebase UID', async () => {
  const f = fixture(); await tick();
  f.sessions.set('restored-uid', { phone: SECOND });
  f.notify({ uid: 'restored-uid', isAnonymous: true }); await tick();
  assert.equal(f.view.phone, SECOND);
});
test('an unfinished anonymous session fails closed instead of showing any panel', async () => {
  const f = fixture(); await tick();
  f.notify({ uid: 'unfinished-uid', isAnonymous: true }); await tick();
  assert.equal(f.view, null); assert.equal(f.auth.currentUser, null);
  assert.ok(f.errors.includes('login/staff-session'));
});
test('temporary offline restore preserves the staff identity and resumes when connectivity returns', async () => {
  const options = { sessionReadError: 'unavailable' }, f = fixture(options); await tick();
  f.sessions.set('offline-staff', { phone: FIRST });
  f.notify({ uid: 'offline-staff', isAnonymous: true }); await tick();
  assert.equal(f.view, null);
  assert.equal(f.auth.currentUser.uid, 'offline-staff');
  options.sessionReadError = null;
  await f.controller.resume();
  assert.equal(f.view.phone, FIRST);
  assert.equal(f.auth.currentUser.uid, 'offline-staff');
});
test('an unrelated Firebase email account cannot become owner', async () => {
  const f = fixture(); await tick();
  f.notify({ uid: 'unrelated', email: 'other@example.test', isAnonymous: false }); await tick();
  assert.equal(f.view, null); assert.equal(f.auth.currentUser, null);
  assert.ok(f.errors.includes('login/owner-required'));
});
test('missing, inactive and login-disabled staff accounts cannot sign in', async () => {
  for (const profile of [null, { active: false }, { loginEnabled: false }]) {
    const f = fixture();
    if (profile) f.profiles.set(FIRST, profile); else f.profiles.delete(FIRST);
    await assert.rejects(f.controller.login({ role: 'staff', username: 'admin', password: FIRST }), { code: 'login/staff-disabled' });
    assert.equal(f.view, null); assert.equal(f.auth.currentUser, null);
  }
});
test('provider and Firestore failures leave both protected panels closed', async () => {
  for (const options of [{ authError: 'auth/operation-not-allowed' }, { sessionError: 'permission-denied' }]) {
    const f = fixture(options);
    await assert.rejects(f.controller.login({ role: 'staff', username: 'admin', password: FIRST }));
    assert.equal(f.view, null); assert.equal(f.auth.currentUser, null);
  }
});
test('Logout while a staff session is being saved cancels its late completion', async () => {
  const sessionDelay = deferred(), f = fixture({ sessionDelay });
  const login = f.controller.login({ role: 'staff', username: 'admin', password: FIRST });
  const rejected = assert.rejects(login, { code: 'login/cancelled' });
  await tick(); await f.controller.logout(); sessionDelay.resolve(); await rejected;
  assert.equal(f.view, null); assert.equal(f.auth.currentUser, null);
});
test('Logout before a slow owner sign-in finishes does not reopen the owner panel', async () => {
  const signInDelay = deferred(), f = fixture({ signInDelay });
  const login = f.controller.login({ role: 'owner', username: 'admin', password: 'initial-password' });
  const rejected = assert.rejects(login, { code: 'login/cancelled' });
  await tick(); await f.controller.logout(); signInDelay.resolve(); await rejected;
  assert.equal(f.view, null); assert.equal(f.auth.currentUser, null);
});
test('concurrent submit is rejected without creating two staff sessions', async () => {
  const sessionDelay = deferred(), f = fixture({ sessionDelay });
  const login = f.controller.login({ role: 'staff', username: 'admin', password: FIRST });
  await assert.rejects(f.controller.login({ role: 'staff', username: 'admin', password: SECOND }), { code: 'login/busy' });
  sessionDelay.resolve(); await login;
  assert.equal(f.sessions.size, 1); assert.equal(f.view.phone, FIRST);
});
test('owner password change verifies the old password and the new password works after logout', async () => {
  const f = fixture();
  await f.controller.login({ role: 'owner', username: 'admin', password: 'initial-password' });
  await assert.rejects(f.controller.changePassword('incorrect', 'changed-password'), { code: 'auth/invalid-credential' });
  assert.equal(f.calls.some(call => call[0] === 'change-password'), false);
  await assert.rejects(f.controller.changePassword('initial-password', '1234'), { code: 'auth/weak-password' });
  await f.controller.changePassword('initial-password', 'changed-password');
  await f.controller.logout();
  await assert.rejects(f.controller.login({ role: 'owner', username: 'admin', password: 'initial-password' }));
  await f.controller.login({ role: 'owner', username: 'admin', password: 'changed-password' });
  assert.equal(f.view.role, 'owner');
});
test('staff cannot change the owner password', async () => {
  const f = fixture();
  await f.controller.login({ role: 'staff', username: 'admin', password: FIRST });
  await assert.rejects(f.controller.changePassword('initial-password', 'changed-password'), { code: 'login/owner-required' });
  assert.equal(f.calls.some(call => call[0] === 'change-password'), false);
});
