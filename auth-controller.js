// Authentication decisions are independent of the login screen and job titles.
// Keep the owner list in sync with isOwner() in firestore.rules.
export const OWNER_EMAILS = Object.freeze([
  'admin@nt-traders.firebaseapp.com',
  'hp6235@gmail.com',
  'owner@nttraders.local'
]);

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

export function parseLogin({ role, username, password }) {
  const name = String(username || '').trim().toLowerCase();
  if (!password) throw failure('login/password-required');
  if (role === 'owner') {
    if (name !== 'admin' && !OWNER_EMAILS.includes(name)) throw failure('login/owner-username');
    return { role, emails: name === 'admin' ? OWNER_EMAILS : [name], password };
  }
  if (role !== 'staff') throw failure('login/role-required');
  const phone = normalizePhone(password);
  if (!phone || (name !== 'admin' && normalizePhone(name) !== phone)) {
    throw failure('login/staff-credentials');
  }
  return { role, phone };
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
    onReset();
  }
  async function activate(user, ticket, expectedRole) {
    check(ticket, user);
    if (user.isAnonymous) {
      if (expectedRole === 'owner') throw failure('login/owner-required');
      // The UID-bound server record is authoritative. Never restore a phone
      // from localStorage left behind by another staff member on this browser.
      const session = await accounts.getSession(user.uid);
      check(ticket, user);
      const phone = normalizePhone(session?.phone);
      if (!phone) throw failure('login/staff-session');
      const account = await accounts.getAccount(phone);
      check(ticket, user);
      if (!account || account.active === false || account.loginEnabled === false) {
        throw failure('login/staff-disabled');
      }
      onSession({ role: 'staff', user, phone, account });
    } else {
      if (expectedRole === 'staff' || !isOwnerUser(user)) throw failure('login/owner-required');
      onSession({ role: 'owner', user });
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
    try {
      await activate(user, ticket);
    } catch (error) {
      if (ticket !== epoch) return;
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
    resume() { return restore(auth.currentUser); },
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
          await accounts.createSession(credential.user.uid, request.phone);
        }
        check(ticket, credential.user);
        await activate(credential.user, ticket, request.role);
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
    async logout() {
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
    case 'login/owner-username': return 'مالک کے لیے یوزر نیم admin درج کریں۔';
    case 'login/staff-credentials': return 'اسٹاف کا یوزر نیم admin اور پاس ورڈ اس کا مکمل محفوظ شدہ موبائل نمبر ہے، مثلاً 03xxxxxxxxx۔';
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
