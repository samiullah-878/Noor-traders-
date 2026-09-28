// auth.js — login ka poora faisla yahan hota hai. Screen se alag hai taake test ho sake.
// Owner list firestore.rules ke isOwner() se milti rehni chahiye.
import { normalizePhone } from './core.js';

export const OWNER_EMAILS = Object.freeze([
  'admin@nt-traders.firebaseapp.com',
  'hp6235@gmail.com',
  'owner@nttraders.local'
]);
const CACHE_KEY = 'nt-hazri-session-v200';
const OWNER_EMAIL_KEY = 'nt-hazri-owner-email';
const WRONG_PASSWORD = ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found', 'auth/wrong-password'];
const TRANSIENT = ['unavailable', 'deadline-exceeded', 'aborted', 'internal', 'auth/network-request-failed', 'auth/internal-error', 'auth/timeout'];

export function isOwnerUser(user) {
  return !!user && !user.isAnonymous && OWNER_EMAILS.includes(String(user.email || '').toLowerCase());
}
function failure(code) { return Object.assign(new Error(code), { code }); }
export function isTransient(error) { return TRANSIENT.includes(error?.code); }

export function parseLogin({ role, username, password }) {
  if (role === 'owner') {
    const name = String(username || '').trim().toLowerCase();
    if (!password) throw failure('login/password-required');
    if (name && name !== 'admin' && !OWNER_EMAILS.includes(name)) throw failure('login/owner-username');
    return { role, emails: !name || name === 'admin' ? [...OWNER_EMAILS] : [name], password };
  }
  if (role !== 'staff') throw failure('login/role-required');
  // Staff sirf apna mobile number likhta hai. Purani app ki tarah "admin" + number bhi chalta hai.
  const phone = normalizePhone(password) || normalizePhone(username);
  if (!phone) throw failure('login/staff-phone');
  return { role, phone };
}

export function loginErrorMessage(error) {
  switch (error?.code) {
    case 'login/owner-username': return 'Malik ke liye username "admin" likhein ya khali chhor dein.';
    case 'login/staff-phone': return 'Apna poora mobile number likhein, jaise 03001234567.';
    case 'login/password-required': return 'Password likhein.';
    case 'login/staff-disabled': return 'Ye number register nahi, ya malik ne login band kiya hua hai. Malik se kahein ke Staff list mein number check karein.';
    case 'login/staff-session': return 'Login adhoora reh gaya. Dobara "Login" dabayein.';
    case 'login/owner-required': return 'Is account ko malik wala panel dekhne ki ijazat nahi.';
    case 'login/busy': return 'Login check ho raha hai, thora intezar karein.';
    case 'login/cancelled': return 'Login rok diya gaya. Dobara koshish karein.';
    case 'permission-denied': return 'Ye number register nahi, ya login band hai. Malik se number check karwayein.';
    case 'auth/too-many-requests': return 'Bohat zyada ghalat koshishein ho gayin. 10-15 minute baad dobara try karein.';
    case 'auth/operation-not-allowed': return 'Firebase mein Anonymous login band hai. Firebase Console > Authentication > Sign-in method mein "Anonymous" on karein.';
    case 'auth/user-disabled': return 'Ye account Firebase mein band kiya gaya hai.';
    default:
      if (WRONG_PASSWORD.includes(error?.code)) return 'Password ghalat hai.';
      if (isTransient(error)) return 'Internet kamzor hai. Signal check kar ke dobara "Login" dabayein.';
      return 'Login nahi ho saka' + (error?.code ? ' (' + error.code + ')' : '') + '. Dobara koshish karein.';
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Kamzor internet par khud 3 dafa koshish karta hai. Ghalat password jaisi ghalti par foran rukta hai. */
export async function withRetry(fn, { tries = 3, delay = 700, wait = sleep } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (error) { last = error; if (!isTransient(error) || i === tries - 1) throw error; await wait(delay * (i + 1)); }
  }
  throw last;
}

function safeStorage(storage) {
  return {
    get(key) { try { return storage?.getItem(key) ?? null; } catch { return null; } },
    set(key, value) { try { storage?.setItem(key, value); } catch { /* private mode */ } },
    del(key) { try { storage?.removeItem(key); } catch { /* private mode */ } }
  };
}

/**
 * sdk / accounts / storage bahar se aate hain taake asal users ko chhue baghair test ho sake.
 * accounts = { getSession(uid), createSession(uid, phone), getAccount(phone) }
 */
export function createAuthController({ auth, sdk, accounts, storage, onReset, onSession, onError, wait }) {
  const store = safeStorage(storage);
  const retry = fn => withRetry(fn, { wait });
  let epoch = 0, pending = false, activeUid = null;

  const check = (ticket, user) => { if (ticket !== epoch || auth.currentUser?.uid !== user.uid) throw failure('login/cancelled'); };
  const readCache = uid => { try { const c = JSON.parse(store.get(CACHE_KEY) || 'null'); return c && c.uid === uid ? c : null; } catch { return null; } };
  const writeCache = (uid, phone, account) => {
    // Tasveer cache mein nahi jati (localStorage chhota hota hai).
    const { photo, salaryExtras, ...light } = account || {};
    store.set(CACHE_KEY, JSON.stringify({ uid, phone, account: light }));
  };
  function reset() { activeUid = null; onReset(); }

  async function verifyStaff(user) {
    const session = await retry(() => accounts.getSession(user.uid));
    const phone = normalizePhone(session?.phone);
    if (!phone) throw failure('login/staff-session');
    const account = await retry(() => accounts.getAccount(phone));
    if (!account || account.active === false || account.loginEnabled === false) throw failure('login/staff-disabled');
    return { phone, account };
  }

  async function activate(user, ticket, expectedRole, { allowCache = false } = {}) {
    check(ticket, user);
    if (!user.isAnonymous) {
      if (expectedRole === 'staff' || !isOwnerUser(user)) throw failure('login/owner-required');
      activeUid = user.uid;
      onSession({ role: 'owner', user });
      return;
    }
    if (expectedRole === 'owner') throw failure('login/owner-required');
    const cached = allowCache ? readCache(user.uid) : null;
    if (cached) {
      // App dobara kholne par foran andar. Server se tasdeeq peeche chalti rehti hai.
      // Data phir bhi mehfooz hai: Firestore rules isi UID ke server wale session se phone lete hain.
      activeUid = user.uid;
      onSession({ role: 'staff', user, phone: cached.phone, account: { ...cached.account, phone: cached.phone }, fromCache: true });
      verifyStaff(user).then(({ phone, account }) => {
        if (ticket !== epoch) return;
        writeCache(user.uid, phone, account);
        if (phone !== cached.phone) onSession({ role: 'staff', user, phone, account });
      }).catch(async error => {
        if (ticket !== epoch || isTransient(error)) return; // offline: cache par chalte raho
        store.del(CACHE_KEY); reset();
        try { if (auth.currentUser?.uid === user.uid) await sdk.signOut(auth); } catch { /* ignore */ }
        onError(error, 'staff');
      });
      return;
    }
    const { phone, account } = await verifyStaff(user);
    check(ticket, user);
    writeCache(user.uid, phone, account);
    activeUid = user.uid;
    onSession({ role: 'staff', user, phone, account });
  }

  async function restore(user) {
    // Anonymous sign-in ka event session likhne se PEHLE aata hai; us waqt sirf login() hi aage barhta hai.
    if (pending || (user && user.uid === activeUid)) return;
    const ticket = ++epoch;
    if (!user) { reset(); return; }
    try {
      await activate(user, ticket, undefined, { allowCache: true });
    } catch (error) {
      if (ticket !== epoch) return;
      reset();
      if (!isTransient(error) && auth.currentUser?.uid === user.uid) { try { await sdk.signOut(auth); } catch { /* ignore */ } }
      onError(error, user.isAnonymous ? 'staff' : 'owner');
    }
  }
  const unsubscribe = sdk.onAuthStateChanged(auth, user => { void restore(user).catch(error => onError(error, 'owner')); });

  async function ownerSignIn(request, ticket) {
    // Jo email pichli dafa chali thi wohi pehle. Is se har login par 3 ghalat koshishein nahi hoti
    // (wohi Firebase ka "too many requests" block lagwati thin).
    const remembered = store.get(OWNER_EMAIL_KEY);
    const emails = [...request.emails].sort((a, b) => (b === remembered) - (a === remembered));
    let lastError;
    for (const email of emails) {
      try {
        const credential = await retry(() => sdk.signInWithEmailAndPassword(auth, email, request.password));
        store.set(OWNER_EMAIL_KEY, email);
        return credential;
      } catch (error) {
        if (ticket !== epoch) throw failure('login/cancelled');
        lastError = error;
        if (!WRONG_PASSWORD.includes(error.code)) throw error;
      }
    }
    throw lastError;
  }

  return {
    resume() { return restore(auth.currentUser); },
    async login(input) {
      if (pending) throw failure('login/busy');
      const request = parseLogin(input);
      pending = true;
      const ticket = ++epoch;
      let attemptUser = null;
      try {
        let credential;
        if (request.role === 'owner') {
          if (auth.currentUser) await sdk.signOut(auth);
          credential = await ownerSignIn(request, ticket);
          attemptUser = credential.user;
        } else {
          // Naya staff login hamesha nayi anonymous UID par: purane larke ka session kabhi dobara istemal nahi hota.
          if (auth.currentUser) await sdk.signOut(auth);
          if (ticket !== epoch) throw failure('login/cancelled');
          credential = await retry(() => sdk.signInAnonymously(auth));
          attemptUser = credential.user;
          check(ticket, credential.user);
          await retry(() => accounts.createSession(credential.user.uid, request.phone));
        }
        check(ticket, credential.user);
        await activate(credential.user, ticket, request.role);
      } catch (error) {
        if (ticket === epoch) {
          reset();
          try { if (auth.currentUser) await sdk.signOut(auth); } catch { /* ignore */ }
        } else if (attemptUser && auth.currentUser?.uid === attemptUser.uid) {
          try { await sdk.signOut(auth); } catch { /* ignore */ }
        }
        throw error;
      } finally { pending = false; }
    },
    async logout() {
      ++epoch; pending = false;
      store.del(CACHE_KEY);
      reset();
      if (auth.currentUser) await sdk.signOut(auth);
    },
    async changeOwnerPassword(currentPassword, nextPassword) {
      const user = auth.currentUser;
      if (!isOwnerUser(user)) throw failure('login/owner-required');
      if (!currentPassword) throw failure('login/password-required');
      if (String(nextPassword || '').length < 6) throw Object.assign(new Error('Naya password kam az kam 6 harf ka ho.'), { code: 'login/weak-password' });
      await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email, currentPassword));
      await sdk.updatePassword(user, nextPassword);
    },
    dispose() { unsubscribe?.(); }
  };
}
