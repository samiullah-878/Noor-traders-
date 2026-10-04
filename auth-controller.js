// Authentication decisions are independent of the login screen and job titles.
// Keep the owner list in sync with isOwner() in firestore.rules.
export const OWNER_EMAILS = Object.freeze(['googel6235@gmail.com','hp6235@gmail.com']);

export function normalizePhone(value) {
  let phone = String(value ?? '').trim()
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660));
  // Reject letters instead of silently accepting a password with extra text.
  if (!/^[+\d\s()-]+$/.test(phone)) return '';
  phone = phone.replace(/\D/g, '');
  if (phone.startsWith('0092')) phone = '0' + phone.slice(4);
  else if (phone.startsWith('92') && phone.length === 12) phone = '0' + phone.slice(2);
  if (phone.length === 10 && phone.startsWith('3')) phone = '0' + phone;
  return /^03\d{9}$/.test(phone) ? phone : '';
}

export function isOwnerUser(user) {
  return !!user && !user.isAnonymous &&
    OWNER_EMAILS.includes(String(user.email || '').toLowerCase());
}

function failure(code) {
  return Object.assign(new Error(code), { code });
}

export function parseLogin({ role, username, password, ownerEmail, scope = 'full' }) {
  const name = String(username || '').trim().toLowerCase();
  if (!password) throw failure('login/password-required');
  if (role === 'owner') {
    if (name !== 'admin' && !OWNER_EMAILS.includes(name)) throw failure('login/owner-username');
    if(ownerEmail&&!OWNER_EMAILS.includes(ownerEmail))throw failure('login/owner-username');
    return { role, emails: [ownerEmail || (name === 'admin' ? OWNER_EMAILS[0] : name)], password };
  }
  if (role !== 'staff') throw failure('login/role-required');
  if(name !== 'admin') throw failure('login/staff-credentials');
  if(!['full','purchase','stock','sale','galla','nazar'].includes(scope))throw failure('login/scope-required');
  return {role,password,scope,phone:normalizePhone(password)};
}

// SDK and account reads are injected so real authentication ordering can be
// regression-tested without touching production users or attendance records.
export function createAuthController({ auth, sdk, accounts, onReset, onSession, onError }) {
  let epoch = 0;
  let pending = false;
  let activeUid = null;
  const check = (ticket, user) => {
    if (ticket !== epoch || auth.currentUser?.uid !== user.uid) throw failure('login/cancelled');
  };
  function reset() {
    activeUid = null;
    optimistic = null;
    onReset();
  }
  // v2.81: ⚡ FORAN KHULNA — pichhla tasdeeq shuda session (isi UID ka) phone par yaad; boot par foran onSession, server ki jaanch
  // (getSession + getAccount) peeche. Jaanch fail = reset + signOut (pehle jaisa). Internet band = yaad wala session chalta rahe.
  // Server rules phir bhi har read/write jaanchte hain — ye sirf screen jaldi dikhane ke liye hai.
  const CK = 'sam-sess-v1';
  const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };
  let optimistic = null;
  const readCache = uid => { try { const c = JSON.parse(ls()?.getItem(CK) || 'null'); return c && c.uid === uid && Date.now() - (Number(c.at) || 0) < 30 * 864e5 ? c : null; } catch { return null; } };
  const writeCache = s => { try { const a = s.account ? Object.fromEntries(Object.entries(s.account).filter(([k]) => !/hash|salt|pass|pw|secret|key|cred/i.test(k))) : undefined; ls()?.setItem(CK, JSON.stringify({ uid: s.user.uid, role: s.role, scope: s.scope, phone: s.phone, account: a, at: Date.now() })); } catch {} };
  const clearCache = () => { try { ls()?.removeItem(CK); } catch {} };
  function emit(s) {
    writeCache(s);
    const o = optimistic; optimistic = null;
    if (o && o.user?.uid === s.user.uid && o.role === s.role && (o.scope || '') === (s.scope || '')) { Object.assign(o, s, { optimistic: false }); return; }   // wahi session — dobara listeners nahi
    if (o) { activeUid = null; onReset(); }
    onSession(s);
  }
  async function activate(user, ticket, expectedRole, expectedScope) {
    check(ticket, user);
    if (user.isAnonymous) {
      if (expectedRole === 'owner') throw failure('login/owner-required');
      // The UID-bound server record is authoritative. Never restore a phone
      // from localStorage left behind by another staff member on this browser.
      const session = await accounts.getSession(user.uid);
      check(ticket, user);
      const phone = session?.credentialId || normalizePhone(session?.phone);
      if (!phone) throw failure('login/staff-session');
      const account = await accounts.getAccount(phone);
      check(ticket, user);
      if (!account || account.active === false || account.loginEnabled === false) {
        throw failure('login/staff-disabled');
      }
      const scope=account.scope||'full';
      if(!['full','purchase','stock','sale','galla','nazar'].includes(scope)||(expectedScope&&scope!==expectedScope))throw failure('login/scope-required');
      emit({ role: 'staff', scope, user, phone, account });
    } else {
      if (expectedRole === 'staff' || !isOwnerUser(user)) throw failure('login/owner-required');
      emit({ role: 'owner', user });
    }
    activeUid = user.uid;
  }
  async function restore(user) {
    // Firebase emits an anonymous-user event BEFORE the staff session is saved.
    // Only the explicit login operation may activate that in-progress session.
    if (pending || (user && user.uid === activeUid)) return;
    const ticket = ++epoch;
    reset();
    if (!user) return;
    const c = readCache(user.uid);
    if (c && (c.role === 'owner' ? !user.isAnonymous : user.isAnonymous)) {
      optimistic = { role: c.role, scope: c.scope, phone: c.phone, account: c.account, user, optimistic: true };
      activeUid = user.uid;
      try { onSession(optimistic); } catch {}
    }
    try {
      await activate(user, ticket);
    } catch (error) {
      if (ticket !== epoch) return;
      const off = ['unavailable', 'auth/network-request-failed'].includes(error.code);
      if (off && optimistic) { optimistic = null; return; }   // internet band — yaad wala session chalne do
      clearCache();
      reset();
      const offline = ['unavailable', 'auth/network-request-failed'].includes(error.code);
      if (!offline && auth.currentUser?.uid === user.uid) await sdk.signOut(auth);
      onError(error, user.isAnonymous ? 'staff' : 'owner');
    }
  }
  const unsubscribe = sdk.onAuthStateChanged(auth, user => {
    void restore(user).catch(error => onError(error, 'owner'));
  });

  return {
    resume() { activeUid = null; return restore(auth.currentUser); },
    async login(input) {
      if (pending) throw failure('login/busy');
      const request = parseLogin(input);
      pending = true;
      const ticket = ++epoch;
      let attemptUser = null;
      reset();
      try {
        // A new staff login must never reuse a previous user's anonymous UID.
        if (auth.currentUser) await sdk.signOut(auth);
        if (ticket !== epoch) throw failure('login/cancelled');
        let credential;
        if (request.role === 'owner') {
          for (const email of request.emails) {
            try {
              credential = await sdk.signInWithEmailAndPassword(auth, email, request.password);
              attemptUser = credential.user;
              break;
            } catch (error) {
              if (ticket !== epoch) throw failure('login/cancelled');
              if (!['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code) ||
                  email === request.emails.at(-1)) throw error;
            }
          }
        } else {
          credential = await sdk.signInAnonymously(auth);
          attemptUser = credential.user;
          check(ticket, credential.user);
          if(accounts.createPasswordSession) await accounts.createPasswordSession(credential.user.uid,request.password,request.phone,request.scope);
          else await accounts.createSession(credential.user.uid, request.phone);
        }
        check(ticket, credential.user);
        await activate(credential.user, ticket, request.role, request.scope);
      } catch (error) {
        if (ticket === epoch) {
          reset();
          if (auth.currentUser) await sdk.signOut(auth);
        } else if (attemptUser && auth.currentUser?.uid === attemptUser.uid) {
          // A sign-in promise may finish after Logout. Do not leave it signed in.
          await sdk.signOut(auth);
        }
        throw error;
      } finally {
        pending = false;
      }
    },
    // v2.37: pichhla login ZINDA ho (Firebase ne phone par yaad rakha) to dobara sign-in / hashing / session likhe baghair
    // andar. activate() server ka session + account wahi jaanchta hai jo login karta hai — password badla / band = fail.
    async resume(role, scope) {
      if (pending) throw failure('login/busy');
      const u = auth.currentUser;
      if (!u) throw failure('login/no-user');
      pending = true;
      const ticket = ++epoch;
      reset();
      try { await activate(u, ticket, role, role === 'staff' ? (scope || '') : ''); return true; }
      finally { pending = false; }
    },
    async logout() {
      clearCache();
      ++epoch;
      reset();
      await sdk.signOut(auth);
    },
    async changePassword(currentPassword, newPassword) {
      const user = auth.currentUser;
      if (!isOwnerUser(user)) throw failure('login/owner-required');
      if (!currentPassword) throw failure('login/password-required');
      if (newPassword.length < 6) throw failure('auth/weak-password');
      const ticket = epoch;
      const credential = sdk.EmailAuthProvider.credential(user.email, currentPassword);
      await sdk.reauthenticateWithCredential(user, credential);
      check(ticket, user);
      await sdk.updatePassword(user, newPassword);
      check(ticket, user);
    },
    dispose() { ++epoch; unsubscribe(); reset(); }
  };
}

export function loginErrorMessage(error, role = 'owner') {
  switch (error.code) {
    case 'login/scope-required': return 'Full App / Sirf Purchase / Sirf Stock / Sirf Sale durust select karein aur us ka password likhein.';
    case 'login/staff-config-read': return 'S1: Mulazim login settings par ijazat nahi. Nayi firestore.rules note-traders-khata-7ccc1 project mein publish karein.';
    case 'login/staff-session-create': return 'S2: Password match nahi hua ya session rule publish nahi hui. Malik Settings mein Password check karein.';
    case 'login/staff-session-read': return 'S3: Mulazim session parhne ki ijazat nahi. Nayi firestore.rules publish karein.';
    case 'login/staff-account-read': return 'S4: Mulazim account ki ijazat nahi ya password badal chuka hai. Dobara login karein.';
    case 'login/staff-not-configured': return 'S0: Malik pehle Settings mein Mulazim password Save karein.';
    case 'login/owner-username': return 'مالک کے لیے یوزر نیم admin درج کریں۔';
    case 'login/staff-credentials': return 'یوزر نیم admin اور مالک کا مقرر کردہ پاس ورڈ درج کریں۔';
    case 'login/password-required': return 'پاس ورڈ درج کریں۔';
    case 'login/staff-disabled': return 'اسٹاف اکاؤنٹ موجود نہیں یا مالک نے اس کا لاگ اِن بند کیا ہے۔';
    case 'login/staff-session': return 'پچھلا اسٹاف سیشن مکمل نہیں۔ دوبارہ لاگ اِن کریں۔';
    case 'login/owner-required': return 'اس اکاؤنٹ کو مالک کے پینل کی اجازت نہیں ہے۔';
    case 'login/busy': return 'لاگ اِن کی جانچ ہو رہی ہے، ایک لمحہ انتظار کریں۔';
    case 'login/cancelled': return 'اکاؤنٹ تبدیل ہو گیا ہے۔ دوبارہ لاگ اِن کریں۔';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'مالک کا پاس ورڈ درست نہیں، یا مالک کا اکاؤنٹ ابھی ترتیب نہیں دیا گیا۔';
    case 'auth/operation-not-allowed': return role === 'staff'
      ? 'اسٹاف لاگ اِن کی سروس بند ہے۔ Firebase میں Anonymous sign-in فعال کرنا ضروری ہے۔'
      : 'مالک کی لاگ اِن سروس بند ہے۔ Firebase میں Email/Password sign-in فعال کرنا ضروری ہے۔';
    case 'auth/user-disabled': return 'یہ اکاؤنٹ بند ہے۔ مالک سے رابطہ کریں۔';
    case 'auth/too-many-requests': return 'کوششیں زیادہ ہو گئی ہیں۔ کچھ دیر بعد دوبارہ کوشش کریں۔';
    case 'auth/network-request-failed':
    case 'unavailable': return 'انٹرنیٹ کنکشن چیک کرکے دوبارہ کوشش کریں۔';
    case 'permission-denied': return 'اکاؤنٹ یا اس کی اجازت کی تصدیق نہیں ہوئی۔ مالک سے اکاؤنٹ کی حالت اور نئی Firestore Rules چیک کروائیں۔';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'نیا پاس ورڈ کم از کم 6 حروف کا ہو اور اکاؤنٹ کی پاس ورڈ شرائط پوری کرے۔';
    case 'auth/requires-recent-login': return 'دوبارہ لاگ اِن کرکے پاس ورڈ تبدیل کریں۔';
    default: return 'لاگ اِن مکمل نہیں ہوا۔ انٹرنیٹ اور اکاؤنٹ کی ترتیب چیک کریں۔';
  }
}
