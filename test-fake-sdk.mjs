// Test ke liye naqli Firebase. Rules ka emulator nahi — sirf app ke raaste parakhne ke liye.
export function fakeSdk({ records = new Map(), initialUser = null, ownerPassword = 'malik-ka-password' } = {}) {
  const auth = { currentUser: initialUser }, listeners = new Set(), authListeners = new Set();
  let n = 0, chain = Promise.resolve(); const fail = { next: null, signIn: [] };
  const join = (parent, parts) => [parent?.path || '', ...parts].filter(Boolean).join('/');
  const doc = (parent, ...parts) => { const path = join(parent, parts.length ? parts : ['auto' + (++n)]); return { path, kind: 'doc', id: path.split('/').at(-1) }; };
  const test = (v, f) => f.op === '==' ? v[f.field] === f.value : f.op === '>=' ? v[f.field] >= f.value : f.op === '<=' ? v[f.field] <= f.value : true;
  function snapshot(ref) {
    const data = records.get(ref.path);
    return {
      id: ref.path.split('/').at(-1), ref, metadata: { fromCache: false }, exists: () => data !== undefined, data: () => structuredClone(data),
      forEach(fn) { for (const [k, v] of records) if (k.startsWith(ref.path + '/') && !k.slice(ref.path.length + 1).includes('/') && (ref.filters || []).every(f => test(v, f))) fn({ id: k.split('/').at(-1), metadata: { hasPendingWrites: false }, data: () => structuredClone(v) }); }
    };
  }
  function emit(paths) { for (const entry of listeners) if (paths.some(p => p === entry.ref.path || (p.startsWith(entry.ref.path + '/') && !p.slice(entry.ref.path.length + 1).includes('/')))) queueMicrotask(() => { if (listeners.has(entry)) entry.callback(snapshot(entry.ref)); }); }
  function setUser(u) { auth.currentUser = u; for (const f of authListeners) queueMicrotask(() => f(u)); }
  const SERVER = { __fake: 'serverTimestamp' }, DELETE = { __fake: 'deleteField' };
  function resolve(d, base = {}) { // sentinels -> asal qeemat (merge ke sath)
    const out = { ...base };
    for (const [k, v] of Object.entries(d || {})) { if (v === DELETE) delete out[k]; else if (v === SERVER) out[k] = { seconds: Math.floor(sdk.now() / 1000), nanoseconds: 0 }; else out[k] = structuredClone(v); }
    return out;
  }
  function apply(writes) {
    if (fail.next) { const e = fail.next; fail.next = null; throw e; }
    const changed = [];
    for (const [type, r, d, o] of writes) {
      changed.push(r.path);
      if (type === 'delete') records.delete(r.path);
      else if (type === 'update') { const cur = structuredClone(records.get(r.path)); if (!cur) throw Object.assign(new Error('not-found'), { code: 'not-found' }); for (const [k, v] of Object.entries(d)) { const parts = k.split('.'); let t = cur; while (parts.length > 1) { const key = parts.shift(); t = t[key] ??= {}; } if (v === DELETE) delete t[parts[0]]; else if (v === SERVER) t[parts[0]] = { seconds: Math.floor(sdk.now() / 1000), nanoseconds: 0 }; else t[parts[0]] = v; } records.set(r.path, cur); }
      else records.set(r.path, resolve(d, o?.merge ? (records.get(r.path) || {}) : {}));
    }
    emit(changed);
  }
  const sdk = {
    initializeApp: () => ({}), getFirestore: () => ({}), getAuth: () => auth,
    collection: (parent, ...parts) => ({ path: join(parent, parts), kind: 'collection' }), doc,
    query: (ref, ...filters) => ({ ...ref, filters }), where: (field, op, value) => ({ field, op, value }),
    getDoc: async ref => snapshot(ref), getDocFromServer: async ref => { if (fail.offline) throw Object.assign(new Error('offline'), { code: 'unavailable' }); return snapshot(ref); }, getDocs: async ref => snapshot(ref),
    async setDoc(ref, data, options) { if (fail.denyPath && String(ref.path).includes(fail.denyPath)) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); if (fail.dropPath && String(ref.path).includes(fail.dropPath)) { sdk.dropped.push(ref.path); return; } if (fail.hangPath && String(ref.path).includes(fail.hangPath)) { sdk.dropped.push(ref.path); return new Promise(() => {}); } apply([['set', ref, data, options]]); }, async updateDoc(ref, data) { apply([['update', ref, data]]); }, async deleteDoc(ref) { apply([['delete', ref]]); },
    onSnapshot(ref, ...args) { const callback = args.find(a => typeof a === 'function'); const entry = { ref, callback }; listeners.add(entry); queueMicrotask(() => { if (listeners.has(entry)) callback(snapshot(ref)); }); return () => listeners.delete(entry); },
    writeBatch() { const writes = []; return { set: (r, d, o) => writes.push(['set', r, d, o]), update: (r, d) => writes.push(['update', r, d]), delete: r => writes.push(['delete', r]), commit: async () => { await null; apply(writes); } }; },
    runTransaction(_fs, fn) { const result = chain.then(async () => { const writes = []; const ret = await fn({ get: async r => snapshot(r), set: (r, d, o) => writes.push(['set', r, d, o]), delete: r => writes.push(['delete', r]) }); apply(writes); return ret; }); chain = result.catch(() => {}); return result; },
    onAuthStateChanged(_a, callback) { authListeners.add(callback); queueMicrotask(() => callback(auth.currentUser)); return () => authListeners.delete(callback); },
    signOut: async () => setUser(null),
    createUserWithEmailAndPassword: async (_a, email) => { sdk.created.push(email); return { user: { uid: 'cam-uid-' + (++n), email } }; }, deleteApp: async () => {},
    signInAnonymously: async () => { if (fail.signIn.length) throw fail.signIn.shift(); const u = { uid: 'anon-' + (++n), isAnonymous: true }; setUser(u); return { user: u }; },
    signInWithEmailAndPassword: async (_a, email, password) => { sdk.attempts.push(email); if (fail.signIn.length) throw fail.signIn.shift(); if (password !== ownerPassword || email !== 'hp6235@gmail.com') throw Object.assign(new Error('wrong'), { code: 'auth/invalid-credential' }); const u = { uid: 'owner-uid', email, isAnonymous: false }; setUser(u); return { user: u }; },
    attempts: [], dropped: [], created: [], now: () => Date.now(), serverTimestamp: () => SERVER, deleteField: () => DELETE, EmailAuthProvider: { credential: () => ({}) }, reauthenticateWithCredential: async () => {}, updatePassword: async () => {}
  };
  return { sdk, auth, records, setUser, fail, listeners };
}
export function memoryStorage() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }; }
export const B = 'businesses/noor-traders/';
