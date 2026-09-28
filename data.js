// data.js — Firebase se baat sirf yahan hoti hai. sdk bahar se aata hai (boot.js asal SDK deta hai, test naqli).
import {
  APP_VERSION, BUSINESS_ID, DEFAULT_CONFIG, SHOP, normalizePhone, normalizeAttendance, pkDate, pkTime24, pkMinutes, parseTime, to24,
  monthRange, addMonths, addDays, resolveSchedule, lateMinutes, scoreForLate, salaryCalc, salarySnapshot, isMonth, isDate, shiftMinutes, salaryConfig, workMinutes, fmtTime, rosterOf, ticketMinutes, ticketSuggest, pkTimeMs
} from './core.js';
import { isOwnerUser } from './auth.js';
import { sendNotify, appLink } from './notify.js';

const clean = value => JSON.parse(JSON.stringify(value ?? null));
const timeout = (promise, ms) => { let t; return Promise.race([promise, new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'app/slow-network' })), ms); })]).finally(() => clearTimeout(t)); };

export function createData({ sdk, firebaseConfig, onChange = () => {}, onProblem = () => {}, notifyFetch, storage = null }) {
  const app = sdk.initializeApp(firebaseConfig);
  let auth;
  try {
    auth = sdk.initializeAuth
      ? sdk.initializeAuth(app, { persistence: [sdk.indexedDBLocalPersistence, sdk.browserLocalPersistence, sdk.inMemoryPersistence].filter(Boolean) })
      : sdk.getAuth(app);
  } catch { auth = sdk.getAuth(app); }
  let fs;
  try {
    // Phone mein local copy: kamzor internet par bhi screen khulti hai aur hazri qataar mein mehfooz rehti hai.
    fs = sdk.initializeFirestore && sdk.persistentLocalCache
      ? sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({ tabManager: sdk.persistentMultipleTabManager?.() }) })
      : sdk.getFirestore(app);
  } catch { fs = sdk.getFirestore(app); }

  const col = name => sdk.collection(fs, 'businesses', BUSINESS_ID, name);
  const ref = (name, id) => sdk.doc(fs, 'businesses', BUSINESS_ID, name, id);

  const state = fresh();
  function fresh() {
    return {
      role: null, phone: '', loaded: new Set(), config: { ...DEFAULT_CONFIG },
      staff: [], months: new Map(), requests: [], schedules: new Map(), payroll: [],
      account: null, myAttendance: [], punchError: null, sync: {}, diag: [], cameras: [], camPC: null, camCfg: null, camShots: new Map(), camStats: [], camEvents: [], camDayStats: [], camDay: '', outs: [], teamOuts: [], teamAttendance: [], tickets: [], myTickets: [], teamTickets: [], errors: {}, lastSync: {}, pendingWrites: 0
    };
  }
  let unsubs = [], monthSubs = new Map(), epoch = 0, legacyChecked = false, shotsSub = null, eventSubs = [];
  const changed = () => onChange(state);
  const problem = (name, error) => { state.errors[name] = error?.code || error?.message || 'error'; changed(); onProblem(name, error); };
  const live = (query, name, handler, options) => {
    const token = epoch;
    const next = snap => { if (token !== epoch) return; handler(snap); state.loaded.add(name); delete state.errors[name]; if (!snap.metadata?.fromCache) state.lastSync[name] = Date.now(); changed(); };
    const fail = error => { if (token === epoch) problem(name, error); };
    unsubs.push(options ? sdk.onSnapshot(query, options, next, fail) : sdk.onSnapshot(query, next, fail));
  };
  function stop() {
    epoch++;
    for (const u of unsubs) try { u(); } catch { /* ignore */ }
    for (const u of monthSubs.values()) try { u(); } catch { /* ignore */ }
    unsubs = []; monthSubs = new Map(); legacyChecked = false;
    clearTimeout(drainTimer); drainTimer = null;
    try { shotsSub?.(); } catch { /* ignore */ } shotsSub = null;
    for (const u of eventSubs) { try { u(); } catch { /* ignore */ } } eventSubs = [];
    Object.assign(state, fresh());
  }
  const readConfig = snap => {
    if (!snap.exists()) return;
    const d = clean(snap.data());
    state.config = { ...DEFAULT_CONFIG, ...d, scores: { ...DEFAULT_CONFIG.scores, ...(d.scores || {}) } };
  };
  const readList = snap => { const out = []; snap.forEach(d => out.push({ id: d.id, ...clean(d.data()) })); return out; };
  const toAccount = (id, d) => ({ ...d, id, phone: normalizePhone(d.phone || id) || id, name: d.name || id });

  /* ---------- owner ---------- */
  /** Malik ka panel. v211: manager bhi yahi panel chalata hai (role 'manager'), sath apni hazri bhi. */
  function startOwner(opt = {}) {
    stop(); state.role = opt.role === 'manager' ? 'manager' : 'owner';
    if (state.role === 'manager') {
      state.phone = opt.phone; state.account = opt.account ? toAccount(opt.phone, opt.account) : null; scheduleDrain(6000);
      const mine = name => sdk.query(col(name), sdk.where('phone', '==', opt.phone));
      live(mine('staffAttendance'), 'myAttendance', snap => {
        const rows = []; snap.forEach(d => rows.push({ ...normalizeAttendance(clean(d.data()), d.id), pending: !!d.metadata?.hasPendingWrites }));
        state.myAttendance = rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      }, { includeMetadataChanges: true });
    }
    live(ref('staffConfig', 'main'), 'config', snap => { readConfig(snap); queueMicrotask(syncRoster); });
    // v220: dukaan ke cameras — SIRF malik (manager ke liye rules bhi band)
    if (state.role === 'owner') {
      live(col('cameras'), 'cameras', snap => { state.cameras = readList(snap).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); });
      live(ref('cameraPC', 'status'), 'camPC', snap => { state.camPC = snap.exists() ? clean(snap.data()) : null; });
      live(ref('cameraPC', 'config'), 'camCfg', snap => { state.camCfg = snap.exists() ? clean(snap.data()) : null; });
      // v222: aaj ki galla ginti (chhote docs) — Tawajju card ke liye
      live(sdk.query(col('cameraStats'), sdk.where('date', '==', pkDate())), 'camStats', snap => { state.camStats = readList(snap); });
    }
    // v218: har larke ke phone ka record (version, aakhri dafa, kya server tak nahi gaya)
    live(col('staffDiag'), 'diag', snap => { state.diag = readList(snap).map(d => ({ ...d, phone: normalizePhone(d.phone || d.id) || d.id })); });
    live(col('staffAccounts'), 'staff', snap => {
      state.staff = readList(snap).map(d => toAccount(d.id, d)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (state.role === 'manager') { const me = state.staff.find(x => x.phone === state.phone); if (me) { state.account = me; queueMicrotask(() => diagPing()); } }
      if (state.role === 'owner' && !state.staff.length && !legacyChecked) { legacyChecked = true; void importLegacyStaff(); }
      queueMicrotask(syncRoster);
    });
    live(col('staffRequests'), 'requests', snap => { state.requests = readList(snap).map(r => ({ ...r, phone: normalizePhone(r.phone) || r.phone })); });
    live(col('staffSchedules'), 'schedules', snap => { state.schedules = new Map(readList(snap).map(s => [s.id, s])); });
    live(col('staffPayroll'), 'payroll', snap => { state.payroll = readList(snap); });
    // Bina bataye gaya ke tickets: pichle 45 din
    live(sdk.query(col('staffTickets'), sdk.where('date', '>=', addDays(pkDate(), -45))), 'tickets', snap => {
      const before = new Set(state.tickets.map(t => t.id)), first = !state.loaded.has('tickets');
      state.tickets = readList(snap).map(t => ({ ...t, phone: normalizePhone(t.phone) || t.phone }));
      const fresh = state.tickets.filter(t => !before.has(t.id) && t.by !== auth.currentUser?.uid);
      if (fresh.length && !first) onProblem('new-ticket', { fresh });
    });
    // Bahar jane ki parchiyan: pichle 45 din
    live(sdk.query(col('staffOuts'), sdk.where('date', '>=', addDays(pkDate(), -45))), 'outs', snap => {
      const before = new Set(state.outs.filter(o => o.status === 'pending').map(o => o.id));
      state.outs = readList(snap).map(o => ({ ...o, phone: normalizePhone(o.phone) || o.phone }));
      const fresh = state.outs.filter(o => o.status === 'pending' && !before.has(o.id));
      if (fresh.length && state.loaded.has('outs')) onProblem('new-out', { fresh });
    });
    const month = pkDate().slice(0, 7);
    watchMonth(month); watchMonth(addMonths(month, -1));
  }
  /** Manager ko doosron ke naam aur bari chahiye (wo staffAccounts nahi parh sakta) -> staffConfig/main.roster. */
  let rosterBusy = false;
  function syncRoster() {
    if (!full() || !state.loaded.has('staff') || !state.loaded.has('config') || rosterBusy) return;
    const next = rosterOf(state.staff);
    if (JSON.stringify(next) === JSON.stringify(state.config.roster || [])) return;
    rosterBusy = true;
    sdk.setDoc(ref('staffConfig', 'main'), { roster: next }, { merge: true }).catch(e => onProblem('roster', e)).finally(() => { rosterBusy = false; });
  }
  /** Purani app sirf "staff" collection mein likhti thi. Agar naye accounts khali hon to wahan se utha lo. */
  async function importLegacyStaff() {
    try {
      const snap = await sdk.getDocs(col('staff'));
      for (const d of readList(snap)) {
        const phone = normalizePhone(d.phone || d.id); if (!phone) continue;
        await sdk.setDoc(ref('staffAccounts', phone), clean({ name: d.name || '', role: d.role || 'Staff', address: d.address || '', phone, photo: d.photo || '', active: d.active !== false, loginEnabled: d.loginEnabled !== false, salary: d.salary || null, salaryExtras: d.salaryExtras || [], updatedAt: Date.now() }), { merge: true });
      }
    } catch (error) { onProblem('legacy-staff', error); }
  }
  /** Poori history nahi, sirf zaroorat ka mahina load hota hai (selfie wale record bhari hote hain). */
  function watchMonth(month) {
    if (!isMonth(month) || !full()) return;
    if (monthSubs.has(month)) return;
    if (monthSubs.size >= 6) { // purana mahina chhor do
      const current = pkDate().slice(0, 7), keep = new Set([current, addMonths(current, -1), month]);
      const oldest = [...monthSubs.keys()].find(m => !keep.has(m));
      if (oldest) { try { monthSubs.get(oldest)(); } catch { /* ignore */ } monthSubs.delete(oldest); state.months.delete(oldest); }
    }
    const { from, to } = monthRange(month), token = epoch;
    const q = sdk.query(col('staffAttendance'), sdk.where('date', '>=', from), sdk.where('date', '<=', to));
    monthSubs.set(month, sdk.onSnapshot(q, snap => {
      if (token !== epoch) return;
      const rows = []; snap.forEach(d => rows.push(normalizeAttendance(clean(d.data()), d.id)));
      state.months.set(month, rows); state.loaded.add('att:' + month); delete state.errors['att:' + month];
      if (!snap.metadata?.fromCache) state.lastSync['att:' + month] = Date.now();
      changed();
    }, error => { if (token === epoch) problem('att:' + month, error); }));
  }
  function attendanceBetween(from, to) {
    const out = [];
    for (const rows of state.months.values()) for (const a of rows) if (a.date >= from && a.date <= to) out.push(a);
    return out;
  }
  const allAttendance = () => state.role === 'staff' ? state.myAttendance : [...state.months.values()].flat();
  const monthLoaded = month => state.role === 'staff' ? state.loaded.has('myAttendance') : state.loaded.has('att:' + month);

  /* ---------- staff ---------- */
  /** Manager (malik ne ijazat di ho): aaj ki sab larkon ki parchiyan dekh kar Haan / Nahi. */
  let teamSub = null;
  function managerWatch() {
    const on = state.role === 'staff' && state.account?.canApproveOuts === true;
    if (on && !teamSub) {
      const token = epoch;
      const handler = snap => {
        if (token !== epoch) return;
        const before = new Set(state.teamOuts.filter(o => o.status === 'pending').map(o => o.id));
        state.teamOuts = readList(snap).filter(o => o.phone !== state.phone);
        const fresh = state.teamOuts.filter(o => o.status === 'pending' && !before.has(o.id));
        const first = !state.loaded.has('teamOuts'); state.loaded.add('teamOuts'); delete state.errors.teamOuts; changed();
        if (fresh.length && !first) onProblem('new-out', { fresh });
      };
      teamSub = sdk.onSnapshot(sdk.query(col('staffOuts'), sdk.where('date', '==', pkDate())), handler, error => { if (token === epoch) { teamSub = null; problem('teamOuts', error); } });
      // Khane ke break ke liye: aaj kaun duty par hai (sirf waqt; selfie alag collection mein hai)
      const attSub = sdk.onSnapshot(sdk.query(col('staffAttendance'), sdk.where('date', '==', pkDate())), snap => {
        if (token !== epoch) return; const rows = []; snap.forEach(d => rows.push(normalizeAttendance(clean(d.data()), d.id)));
        state.teamAttendance = rows; state.loaded.add('teamAttendance'); delete state.errors.teamAttendance; changed();
      }, error => { if (token === epoch) problem('teamAttendance', error); });
      unsubs.push(() => { try { teamSub?.(); } catch { /* ignore */ } teamSub = null; try { attSub(); } catch { /* ignore */ } });
    } else if (!on && teamSub) { try { teamSub(); } catch { /* ignore */ } teamSub = null; state.teamOuts = []; state.teamAttendance = []; changed(); }
  }
  const isManager = () => state.role === 'staff' && state.account?.canApproveOuts === true;
  /** Ticket bana sakta hai: manager ya senior (malik ne switch on kiya ho). */
  const isTicketer = () => state.role === 'staff' && (state.account?.canApproveOuts === true || state.account?.canTicket === true);
  let ticketSub = null;
  function ticketWatch() {
    const on = isTicketer();
    if (on && !ticketSub) {
      const token = epoch;
      ticketSub = sdk.onSnapshot(sdk.query(col('staffTickets'), sdk.where('date', '==', pkDate())), snap => {
        if (token !== epoch) return; state.teamTickets = readList(snap).filter(t => t.phone !== state.phone); state.loaded.add('teamTickets'); delete state.errors.teamTickets; changed();
      }, error => { if (token === epoch) { ticketSub = null; problem('teamTickets', error); } });
      unsubs.push(() => { try { ticketSub?.(); } catch { /* ignore */ } ticketSub = null; });
    } else if (!on && ticketSub) { try { ticketSub(); } catch { /* ignore */ } ticketSub = null; state.teamTickets = []; changed(); }
  }
  function startStaff(phone, cachedAccount) {
    stop(); state.role = 'staff'; state.phone = phone; scheduleDrain(6000);
    state.account = cachedAccount ? toAccount(phone, cachedAccount) : null;
    queueMicrotask(managerWatch); queueMicrotask(ticketWatch);
    live(ref('staffConfig', 'main'), 'config', readConfig);
    live(ref('staffAccounts', phone), 'account', snap => { if (snap.exists()) { state.account = toAccount(phone, clean(snap.data())); managerWatch(); ticketWatch(); queueMicrotask(() => diagPing()); } });
    const mine = name => sdk.query(col(name), sdk.where('phone', '==', phone));
    // includeMetadataChanges: pata chalta hai ke hazri server par pohanch gayi ya abhi phone mein ruki hai.
    live(mine('staffAttendance'), 'myAttendance', snap => {
      const rows = []; snap.forEach(d => rows.push({ ...normalizeAttendance(clean(d.data()), d.id), pending: !!d.metadata?.hasPendingWrites }));
      state.myAttendance = rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, { includeMetadataChanges: true });
    live(mine('staffRequests'), 'requests', snap => { state.requests = readList(snap); });
    live(mine('staffSchedules'), 'schedules', snap => { state.schedules = new Map(readList(snap).map(s => [s.id, s])); });
    live(mine('staffPayroll'), 'payroll', snap => { state.payroll = readList(snap); });
    live(mine('staffOuts'), 'outs', snap => { const out = []; snap.forEach(d => out.push({ id: d.id, ...clean(d.data()), pending: !!d.metadata?.hasPendingWrites })); state.outs = out; }, { includeMetadataChanges: true });
    live(mine('staffTickets'), 'myTickets', snap => { state.myTickets = readList(snap); });
  }

  /* ---------- helpers ---------- */
  /* ---------- tez save ----------
     Pehle har save par server ka jawab (transaction) ka intezar hota tha — kamzor net par 3-10 second.
     Ab: parhna phone mein mojood data se, likhna aik writeBatch mein, aur screen foran badal jati hai.
     Server tak pohanchne ka intezar peeche hota hai (state.pendingWrites); ghalti aaye to toast.
     Salary FINAL aur PAYMENT ab bhi runTransaction se hain (paison mein double entry ka khatra nahi lena). */
  async function localGet(r) {
    const parts = String(r.path || '').split('/'), name = parts[2], id = parts[3];
    const hit = v => ({ exists: () => v != null, data: () => clean(v) });
    if (name === 'staffAccounts' && state.loaded.has('staff')) return hit(state.staff.find(s => s.phone === id || s.id === id) || null);
    if (name === 'staffRequests' && state.loaded.has('requests')) return hit(state.requests.find(x => x.id === id) || null);
    if (name === 'staffConfig' && id === 'main' && state.loaded.has('config')) return hit(state.config);
    if (name === 'staffAttendance') { const m = id.slice(0, 7); if (state.loaded.has('att:' + m)) return hit((state.months.get(m) || []).find(a => a.id === id) || null); }
    if (sdk.getDocFromCache) { try { return await sdk.getDocFromCache(r); } catch { /* cache mein nahi */ } }
    return sdk.getDoc(r);
  }
  async function fast(fn) {
    const batch = sdk.writeBatch(fs); let n = 0;
    const tx = { get: localGet, set: (r, d, o) => { n++; o ? batch.set(r, d, o) : batch.set(r, d); }, delete: r => { n++; batch.delete(r); } };
    const result = await fn(tx);
    if (!n) return result;
    const token = epoch, p = batch.commit();
    state.pendingWrites = (state.pendingWrites || 0) + 1; changed();
    p.catch(error => { if (token === epoch) problem('save', error); })
      .finally(() => { if (token === epoch) { state.pendingWrites = Math.max(0, state.pendingWrites - 1); changed(); } });
    // Foran ghalti (jaise ijazat nahi) 0.4 s mein aa jaye to dikha do; warna aage chalo — data phone mein mehfooz hai.
    let t; await Promise.race([p, new Promise(resolve => { t = setTimeout(resolve, 400); })]).finally(() => clearTimeout(t));
    return result;
  }
  const me = () => String(state.account?.name || state.phone || '');
  const ping = (kind, msg) => { void sendNotify(state.config, kind, { click: appLink(), ...msg }, notifyFetch || globalThis.fetch); };
  const shortDateSafe = d => { try { const [, m, dd] = d.split('-').map(Number); return `${dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]}`; } catch { return d; } };
  /** Panel wala: malik ya manager. */
  function full() { return state.role === 'owner' || state.role === 'manager'; }
  const actor = () => state.role === 'owner' ? 'Malik' : String(state.account?.name || 'Manager').slice(0, 80);
  function guardOwner() {
    if (state.role === 'owner' && isOwnerUser(auth.currentUser)) return;
    if (state.role === 'manager' && state.account?.canApproveOuts === true) return;
    throw new Error('Malik ya manager ka login zaroori hai.');
  }
  /** Hazri lagana / badalna / hatana sirf malik. */
  function guardHazri() { if (state.role !== 'owner' || !isOwnerUser(auth.currentUser)) throw new Error('Hazri sirf malik laga ya badal sakta hai.'); }
  const notSelf = (phone, what) => { if (state.role === 'manager' && phone === state.phone) throw new Error(`Apni ${what} ka faisla khud nahi kar sakte — malik karega.`); };
  function audit(tx, type, target, before, after, reason) {
    tx.set(sdk.doc(col('staffAudit')), { type, target, before: JSON.stringify(before ?? null), after: JSON.stringify(after ?? null), reason: reason || '', by: auth.currentUser.uid, byName: actor(), at: Date.now() });
  }
  const scheduleFor = phone => resolveSchedule(state.config, state.schedules.get(phone));
  const payrollFor = (phone, month) => state.payroll.find(p => p.id === `${month}_${phone}`) || null;
  function calcFor(account, month) {
    const { from, to } = monthRange(month);
    const recs = state.role === 'staff' ? state.myAttendance.filter(a => a.date >= from && a.date <= to) : attendanceBetween(from, to);
    return salaryCalc({ account, month, attendance: recs, payroll: payrollFor(account.phone, month), config: state.config, schedule: scheduleFor(account.phone), requests: state.requests.filter(r => r.phone === account.phone), outs: state.outs.filter(o => o.phone === account.phone), tickets: (state.role === 'staff' ? state.myTickets : state.tickets).filter(t => t.phone === account.phone) });
  }
  const salaryFor = account => salaryConfig(account, state.config, scheduleFor(account.phone));
  /** Purani app salary settings/main mein bhi rakhti thi; dono jagah barabar rakhte hain. Fail ho to koi masla nahi. */
  async function mirrorSalaryToSettings(phone, salary, extras) {
    if (!sdk.updateDoc) return;
    try { await sdk.updateDoc(ref('settings', 'main'), { [`salaryConfig.${phone}`]: clean(salary || {}), [`salaryExtras.${phone}`]: clean(extras || []) }); } catch { /* purana doc nahi hai */ }
  }

  /* ---------- owner: staff ---------- */
  async function saveStaff(input, originalPhone = '') {
    guardOwner();
    const phone = normalizePhone(input.phone);
    if (!phone) throw new Error('Mobile number 11 hindson ka likhein, jaise 03001234567.');
    if (!String(input.name || '').trim()) throw new Error('Naam likhein.');
    const old = originalPhone ? state.staff.find(s => s.phone === originalPhone) : null;
    if (originalPhone && originalPhone !== phone) throw new Error('Number badalna ho to naya staff banayein aur purana band kar dein (hazri purane number par hi rehti hai).');
    if (!old && state.staff.some(s => s.phone === phone)) throw new Error('Is number ka staff pehle se mojood hai.');
    const salary = {
      ...(old?.salary || {}), useDefault: input.useDefaultSalary !== false,
      monthlySalary: Number(input.monthlySalary || 0), dutyHours: Number(input.dutyHours || 10), workingDays: Number(input.workingDays || 30),
      overtimeRate: Number(input.overtimeRate || 0), pointRate: Number(input.pointRate ?? old?.salary?.pointRate ?? 0),
      mealMode: ['daily', 'monthly', 'none'].includes(input.mealMode) ? input.mealMode : 'none', mealRate: Math.max(0, Number(input.mealRate || 0)), mealInSalary: !!input.mealInSalary
    };
    const account = clean({
      name: String(input.name).trim(), role: String(input.role || 'Staff').trim() || 'Staff', address: String(input.address || '').trim(), phone,
      photo: input.photo ?? old?.photo ?? '', active: input.active !== false, loginEnabled: input.loginEnabled !== false, canApproveOuts: input.canApproveOuts === true, canTicket: input.canTicket === true, breakGroup: Number(input.breakGroup) === 2 ? 2 : 1,
      joinDate: isDate(input.joinDate) ? input.joinDate : (old?.joinDate || (old ? '' : pkDate())),
      salary, salaryExtras: old?.salaryExtras || [], updatedAt: Date.now()
    });
    const schedule = clean({
      phone, useDefaultShift: input.useDefaultShift !== false, shiftStart: input.shiftStart || state.config.shiftStart || '09:15', shiftEnd: input.shiftEnd || '',
      grace: Math.max(0, Number(input.grace ?? state.config.grace ?? 10)), weeklyOff: input.weeklyOff === '' || input.weeklyOff == null ? [] : [Number(input.weeklyOff)]
    });
    await fast(async tx => {
      // PIN ka option malik ne mana kiya — purana khali/likha PIN field bhi mita do
      tx.set(ref('staffAccounts', phone), old && 'pin' in old && sdk.deleteField ? { ...account, pin: sdk.deleteField() } : account, { merge: true });
      tx.set(ref('staff', phone), { ...account, id: phone }, { merge: true }); // purani hisab app ke liye
      tx.set(ref('staffSchedules', phone), schedule, { merge: true });
      if (JSON.stringify(old?.salary || null) !== JSON.stringify(salary)) audit(tx, 'salary settings', phone, old?.salary || null, salary, old ? 'Malik ne salary settings badli' : 'Naya staff');
    });
    void mirrorSalaryToSettings(phone, salary, account.salaryExtras);
    return phone;
  }
  async function deleteStaff(phone) {
    guardOwner();
    await fast(async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      tx.delete(r); tx.delete(ref('staff', phone)); tx.delete(ref('staffSchedules', phone));
      audit(tx, 'staff delete', phone, snap.exists() ? { name: snap.data().name } : null, null, 'Malik ne staff delete kiya');
    });
  }
  /** Sirf wohi hissa badalta hai jo form mein tha (duty, salary ya Check-In) — baqi waisa hi rehta hai. */
  async function saveConfig(patch) {
    guardOwner();
    const num = (v, d) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? d : n; };
    const has = k => Object.prototype.hasOwnProperty.call(patch, k);
    const next = {};
    if (has('shiftStart')) next.shiftStart = to24(patch.shiftStart) || '09:15';
    if (has('shiftEnd')) next.shiftEnd = to24(patch.shiftEnd) || '';
    const start = next.shiftStart ?? state.config.shiftStart, end = next.shiftEnd ?? state.config.shiftEnd;
    if ((has('shiftStart') || has('shiftEnd')) && start && end && to24(start) === to24(end)) throw new Error('Duty shuru aur khatam ka waqt alag ho.');
    if (has('grace')) next.grace = Math.max(0, num(patch.grace, 10));
    if (has('radius')) next.radius = Math.max(20, num(patch.radius, SHOP.radius));
    if (has('instruction')) next.instruction = String(patch.instruction || '');
    if (has('notify')) next.notify = clean(patch.notify || { on: false });
    if (has('push')) next.push = clean(patch.push || {});
    if (has('appUrl')) next.appUrl = String(patch.appUrl || '');
    const salaryKeys = ['defSalary', 'defDays', 'defOt', 'salaryMode', 'leavePaid', 'lateEvery', 'lateFineDays', 'outDeduct', 'breakDeduct'];
    if (salaryKeys.some(has)) {
      const old = { ...DEFAULT_CONFIG.salaryDefault, ...(state.config.salaryDefault || {}) }, d = { ...old };
      if (has('defSalary')) d.monthlySalary = Math.max(0, num(patch.defSalary, 0));
      if (has('defDays')) d.workingDays = Math.min(31, Math.max(1, num(patch.defDays, 30)));
      if (has('defOt')) d.overtimeRate = Math.max(0, num(patch.defOt, 0));
      if (has('salaryMode')) d.mode = patch.salaryMode === 'days' ? 'days' : 'hours';
      if (has('leavePaid')) d.leavePaid = patch.leavePaid !== false;
      if (has('lateEvery')) d.lateEvery = Math.max(0, Math.floor(num(patch.lateEvery, 0)));
      if (has('lateFineDays')) d.lateFineDays = Math.max(0, num(patch.lateFineDays, 0.5));
      if (has('outDeduct')) d.outDeduct = patch.outDeduct === true;
      if (has('breakDeduct')) d.breakDeduct = patch.breakDeduct === true;
      next.salaryDefault = d;
    }
    if (!Object.keys(next).length) return;
    await fast(async tx => {
      tx.set(ref('staffConfig', 'main'), clean(next), { merge: true });
      const before = {}; for (const k of Object.keys(next)) before[k] = state.config[k] ?? null;
      audit(tx, 'settings', 'main', before, next, 'Malik ne settings badli');
    });
  }

  /** Sab staff par default duty (waqt + riayat). Hafta-war chutti har aik ki apni rehti hai. */
  async function applyDefaultShiftAll() {
    guardOwner();
    await fast(async tx => {
      for (const s of state.staff) tx.set(ref('staffSchedules', s.phone), { phone: s.phone, useDefaultShift: true }, { merge: true });
      audit(tx, 'default shift sab par', 'all', null, { count: state.staff.length }, 'Malik ne sab par default duty lagayi');
    });
  }
  /** Sab staff par default salary. Un ki apni likhi raqam mehfooz rehti hai (wapas "apni salary" karne par wohi aa jati hai). */
  async function applyDefaultSalaryAll() {
    guardOwner();
    await fast(async tx => {
      for (const s of state.staff) {
        const salary = clean({ ...(s.salary || {}), useDefault: true });
        tx.set(ref('staffAccounts', s.phone), { salary, updatedAt: Date.now() }, { merge: true });
        tx.set(ref('staff', s.phone), { salary }, { merge: true });
      }
      audit(tx, 'default salary sab par', 'all', null, { count: state.staff.length }, 'Malik ne sab par default salary lagayi');
    });
  }
  /** Dukaan band (Eid / chutti): us din koi ghair hazir nahi ginta. Dobara dabane se hat jata hai. */
  async function toggleClosed(date, reason = '') {
    guardHazri();
    guardOwner();
    if (!isDate(date)) throw new Error('Tareekh durust nahi.');
    await fast(async tx => {
      const r = ref('staffConfig', 'main'), snap = await tx.get(r);
      const list = (snap.exists() && Array.isArray(snap.data().closedDays) ? snap.data().closedDays : []).filter(d => d && d.date);
      const on = list.some(d => d.date === date);
      const next = on ? list.filter(d => d.date !== date) : [...list, { date, reason: String(reason || 'Dukaan band') }].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
      tx.set(r, { closedDays: next }, { merge: true });
      audit(tx, on ? 'dukaan band hataya' : 'dukaan band', date, null, { date, reason }, reason || '');
    });
  }
  /** Aik tap: hazir lagao. Aane ka waqt = duty shuru; pichle din ke liye jane ka waqt = duty khatam. */
  async function quickPresent(phone, date, at = '') {
    const sch = scheduleFor(phone);
    const inT = to24(at) || to24(sch.shiftStart) || '09:15';
    const outT = date < pkDate() ? (to24(sch.shiftEnd) || endFrom(inT, phone)) : '';
    await saveAttendance({ phone, date, checkIn: inT, checkOut: outT, note: 'Malik ne lagayi' });
  }
  const endFrom = (inT, phone) => { const acc = state.staff.find(s => s.phone === phone) || {}; const m = (parseTime(inT) + Math.round(salaryFor(acc).dutyHours * 60)) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  /** Bhoola hua Check-Out: duty khatam ke waqt par band. */
  async function closeCheckouts(rows) {
    guardHazri();
    guardOwner();
    let n = 0; const failed = [];
    for (const a of rows) {
      const sch = scheduleFor(a.phone), inT = to24(a.checkIn); if (!inT || a.checkOut) continue;
      const outT = to24(sch.shiftEnd) || endFrom(inT, a.phone);
      try { await saveAttendance({ phone: a.phone, date: a.date, checkIn: inT, checkOut: outT, note: 'Check-Out bhool gaya — duty ke waqt par band', finalScore: a.finalScore ?? '' }); n++; }
      catch { failed.push(state.staff.find(s => s.phone === a.phone)?.name || a.phone); } // aik ghalat ho to baqi na rukein
    }
    return { done: n, failed };
  }

  /* ---------- owner: attendance ---------- */
  async function saveAttendance({ phone, date, checkIn, checkOut, note, finalScore }) {
    guardHazri();
    guardOwner();
    if (!isDate(date)) throw new Error('Tareekh durust nahi.');
    if (date > pkDate()) throw new Error('Aane wali tareekh ki hazri nahi lag sakti.');
    const inT = to24(checkIn), outT = to24(checkOut);
    if (!inT) throw new Error('Aane ka waqt likhein.');
    if (checkOut && !outT) throw new Error('Jane ka waqt durust nahi.');
    if (outT && workMinutes({ checkIn: inT, checkOut: outT }) == null) throw new Error(`Jane ka waqt (${fmtTime(outT)}) aane ke waqt (${fmtTime(inT)}) se pehle hai ya 16 ghante se zyada farq hai. AM / PM check karein.`);
    const account = state.staff.find(s => s.phone === phone) || { phone, name: phone };
    const schedule = scheduleFor(phone), id = `${date}_${phone}`;
    const late = lateMinutes({ checkIn: inT }, schedule);
    const autoScore = scoreForLate(Math.max(0, late - Number(schedule.grace ?? 10) + 10), state.config.scores);
    await fast(async tx => {
      const r = ref('staffAttendance', id), snap = await tx.get(r), before = snap.exists() ? snap.data() : null;
      const patch = clean({
        id, date, phone, name: account.name || '', checkIn: inT, checkOut: outT, minutesLate: late, autoScore,
        finalScore: finalScore === '' || finalScore == null ? (before?.finalScore != null && before.checkIn === inT ? before.finalScore : autoScore) : Math.max(0, Math.min(10, Number(finalScore))),
        shiftStart: schedule.shiftStart || '', ownerNote: String(note || ''), editedAt: Date.now(), editedBy: auth.currentUser.uid
      });
      // v216: khali "jane ka waqt" se pehle se laga Check-Out (larke ka) kabhi na mitao
      if (!outT) delete patch.checkOut;
      if (!before) { patch.checkInTs = null; patch.manual = true; }
      if (before && to24(before.checkIn) !== inT) patch.checkInTs = null;
      if (before && outT && to24(before.checkOut) !== outT) patch.checkOutTs = null;
      tx.set(r, patch, { merge: true });
      const light = before ? { checkIn: before.checkIn || '', checkOut: before.checkOut || '', finalScore: before.finalScore ?? null } : null;
      audit(tx, 'attendance', id, light, { checkIn: inT, checkOut: outT, finalScore: patch.finalScore }, note || 'Malik ne hazri durust ki');
    });
  }
  async function deleteAttendance(id, reason) {
    guardHazri();
    guardOwner();
    await fast(async tx => {
      const r = ref('staffAttendance', id), snap = await tx.get(r);
      if (!snap.exists()) return;
      const b = snap.data(); tx.delete(r);
      audit(tx, 'attendance delete', id, { checkIn: b.checkIn || '', checkOut: b.checkOut || '' }, null, reason || 'Malik ne hazri hatayi');
    });
  }
  /** Malik khud chutti laga de (staff ki request ke baghair). */
  async function markLeave({ phone, date, to, reason, half = '', paid }) {
    guardOwner();
    if (!isDate(date) || !isDate(to || date) || (to || date) < date) throw new Error('Chutti ki tareekh durust likhein.');
    half = ['am', 'pm'].includes(half) ? half : '';
    if (half) to = date; // aadhi chutti sirf aik din
    const paidFlag = typeof paid === 'boolean' ? paid : paid === 'yes' ? true : paid === 'no' ? false : salaryFor({}).leavePaid;
    const id = sdk.doc(col('staffRequests')).id;
    await fast(async tx => tx.set(ref('staffRequests', id), clean({ phone, kind: 'leave', date, to: to || date, half, paid: paidFlag, checkIn: '', checkOut: '', reason: String(reason || 'Malik ne chutti lagayi'), status: 'approved', createdAt: Date.now(), by: auth.currentUser.uid, ownerNote: 'Malik ne lagayi', reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid })));
  }
  async function cancelLeave(id) { guardOwner(); await fast(async tx => tx.set(ref('staffRequests', id), { status: 'rejected', ownerNote: 'Chutti cancel', reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid }, { merge: true })); }
  async function reviewRequest(id, status, note = '', paid) {
    guardOwner();
    await fast(async tx => {
      const rr = ref('staffRequests', id), snap = await tx.get(rr);
      if (!snap.exists() || snap.data().status !== 'pending') throw new Error('Ye request pehle hi dekhi ja chuki hai.');
      const r = snap.data(), phone = normalizePhone(r.phone) || r.phone;
      notSelf(phone, 'request');
      const patch = { status, ownerNote: note, reviewedAt: Date.now(), reviewedBy: auth.currentUser.uid };
      if (r.kind === 'leave' && status === 'approved') patch.paid = typeof paid === 'boolean' ? paid : salaryFor({}).leavePaid;
      if (r.kind === 'correction' && status === 'approved') {
        const ar = ref('staffAttendance', `${r.date}_${phone}`), old = await tx.get(ar);
        const p = { ownerNote: note || 'Correction manzoor', editedAt: Date.now(), editedBy: auth.currentUser.uid };
        if (r.checkIn) { p.checkIn = to24(r.checkIn) || r.checkIn; p.checkInTs = null; p.minutesLate = lateMinutes({ checkIn: p.checkIn }, scheduleFor(phone)); }
        if (r.checkOut) { p.checkOut = to24(r.checkOut) || r.checkOut; p.checkOutTs = null; }
        // v221: dukaan se bahar ka Check-Out — kahan se hua, record mein bhi
        if (r.via === 'outside' && r.checkOut) Object.assign(p, { checkOutVia: 'outside', checkOutLat: r.lat ?? null, checkOutLng: r.lng ?? null, checkOutDistance: r.distance ?? null, checkOutAccuracy: r.accuracy ?? null });
        if (!old.exists()) {
          if (!r.checkIn) throw new Error('Us din ki hazri nahi hai aur request mein aane ka waqt bhi nahi. "Hazri durust karein" se khud lagayein.');
          Object.assign(p, { id: ar.id, date: r.date, phone, name: state.staff.find(s => s.phone === phone)?.name || '', manual: true });
        }
        tx.set(ar, clean(p), { merge: true });
        audit(tx, 'attendance', ar.id, old.exists() ? { checkIn: old.data().checkIn || '', checkOut: old.data().checkOut || '' } : null, { checkIn: p.checkIn, checkOut: p.checkOut }, note || 'Correction manzoor');
      }
      tx.set(rr, patch, { merge: true });
      audit(tx, 'request', id, { status: r.status }, patch, note);
    });
  }

  /* ---------- owner: salary ---------- */
  async function addExtra(phone, { month, kind, amount, note, date, perMonth }) {
    guardOwner();
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('Raqam durust likhein.');
    if (kind === 'loan' && !(Number(perMonth) > 0)) throw new Error('Har mahine kitni qist kategi, wo likhein.');
    if (!isMonth(month)) throw new Error('Mahina chunein.');
    if (payrollFor(phone, month)?.state === 'final') throw new Error('Ye mahina final ho chuka hai. Pehle "Dobara kholein" karein.');
    const item = { id: 'sx' + Date.now() + Math.random().toString(36).slice(2, 6), month, kind: ['advance', 'loan'].includes(kind) ? kind : 'bonus', amount, ...(kind === 'loan' ? { perMonth: Math.min(amount, Number(perMonth)) } : {}), note: String(note || ''), date: isDate(date) ? date : pkDate(), by: 'Malik', at: Date.now() };
    let extras;
    await fast(async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      if (!snap.exists()) throw new Error('Staff nahi mila.');
      extras = [...(Array.isArray(snap.data().salaryExtras) ? snap.data().salaryExtras : []), item];
      tx.set(r, { salaryExtras: clean(extras), updatedAt: Date.now() }, { merge: true });
      audit(tx, 'salary adjustment', phone, null, item, item.note);
    });
    void mirrorSalaryToSettings(phone, state.staff.find(s => s.phone === phone)?.salary, extras);
  }
  async function removeExtra(phone, extraId) {
    guardOwner();
    let extras;
    await fast(async tx => {
      const r = ref('staffAccounts', phone), snap = await tx.get(r);
      if (!snap.exists()) throw new Error('Staff nahi mila.');
      const list = Array.isArray(snap.data().salaryExtras) ? snap.data().salaryExtras : [], item = list.find(x => String(x.id) === String(extraId));
      if (!item) return;
      if (payrollFor(phone, item.month)?.state === 'final') throw new Error('Ye mahina final ho chuka hai. Pehle "Dobara kholein" karein.');
      extras = list.filter(x => String(x.id) !== String(extraId));
      tx.set(r, { salaryExtras: clean(extras), updatedAt: Date.now() }, { merge: true });
      audit(tx, 'salary adjustment delete', phone, item, null, 'Malik ne entry hatayi');
    });
    if (extras) void mirrorSalaryToSettings(phone, state.staff.find(s => s.phone === phone)?.salary, extras);
  }
  async function toggleFinal(phone, month, note) {
    guardOwner();
    const account = state.staff.find(s => s.phone === phone); if (!account) throw new Error('Staff nahi mila.');
    if (!monthLoaded(month)) throw new Error('Is mahine ki hazri abhi load ho rahi hai. Thori der baad dobara dabayein.');
    const known = payrollFor(phone, month), calc = calcFor(account, month);
    if (known?.state !== 'final' && calc.openDays) throw new Error(`${calc.openDays} din ka Check-Out baqi hai. Pehle wo durust karein, phir final karein.`);
    const { from, to } = monthRange(month), recs = attendanceBetween(from, to).filter(a => a.phone === phone);
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffPayroll', `${month}_${phone}`), snap = await tx.get(r), current = snap.exists() ? snap.data() : null;
      if ((current?.state || 'draft') !== (known?.state || 'draft')) throw new Error('Salary abhi abhi badli hai. Dobara dekh kar final karein.');
      const reopening = current?.state === 'final';
      const patch = { phone, month, state: reopening ? 'draft' : 'final', snapshot: reopening ? current.snapshot : salarySnapshot(calc, recs), paid: current?.paid || 0, payments: current?.payments || [], updatedAt: Date.now() };
      tx.set(r, clean(patch));
      audit(tx, reopening ? 'salary reopen' : 'salary final', r.id, current ? { state: current.state, final: current.snapshot?.final } : null, { state: patch.state, final: patch.snapshot?.final }, note || '');
    });
  }
  async function addPayment(phone, month, { amount, date, note }) {
    guardOwner();
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('Raqam durust likhein.');
    if (!isDate(date)) throw new Error('Tareekh durust likhein.');
    await sdk.runTransaction(fs, async tx => {
      const r = ref('staffPayroll', `${month}_${phone}`), snap = await tx.get(r);
      if (!snap.exists() || snap.data().state !== 'final') throw new Error('Pehle is mahine ki salary final karein, phir payment likhein.');
      const old = snap.data(), paid = (old.paid || 0) + amount;
      if (paid > Number(old.snapshot?.final || 0) + 0.5) throw new Error('Ye raqam baqi salary se zyada hai.');
      const patch = { paid, payments: [...(old.payments || []), { amount, date, note: String(note || ''), by: auth.currentUser.uid, at: Date.now() }] };
      tx.set(r, patch, { merge: true });
      audit(tx, 'salary payment', r.id, { paid: old.paid || 0 }, { paid }, note || '');
    });
  }

  /* ---------- selfie: daba kar hi load ---------- */
  const selfieCache = new Map();
  async function getSelfie(a) {
    if (!a) return '';
    if (a.selfie) return a.selfie;
    if (!a.hasSelfie || !a.id) return '';
    if (selfieCache.has(a.id)) return selfieCache.get(a.id);
    const snap = await sdk.getDoc(ref('staffSelfies', a.id));
    const url = snap.exists() ? String(snap.data().selfie || '') : '';
    selfieCache.set(a.id, url);
    return url;
  }
  /** Aik din ki saari selfies (Aaj ki selfies wala safha). */
  async function selfiesFor(date) {
    guardOwner();
    const out = new Map();
    for (const a of attendanceBetween(date, date)) if (a.selfie) out.set(a.id, a.selfie);
    const snap = await sdk.getDocs(sdk.query(col('staffSelfies'), sdk.where('date', '==', date)));
    snap.forEach(d => { const v = d.data(); if (v?.selfie) { out.set(d.id, v.selfie); selfieCache.set(d.id, v.selfie); } });
    return out;
  }
  /** Tabdeeli ki history: malik ki aakhri tabdeeliyan (staffAudit). */
  async function auditLog(max = 150) {
    guardOwner();
    const q = sdk.orderBy && sdk.limit ? sdk.query(col('staffAudit'), sdk.orderBy('at', 'desc'), sdk.limit(max)) : col('staffAudit');
    const snap = await sdk.getDocs(q), rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...clean(d.data()) }));
    return rows.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, max);
  }
  /** Purane records ki selfies alag karo (aik dafa). Malik ki list is ke baad bohat halki. */
  async function migrateSelfies(onProgress = () => {}) {
    guardHazri();
    guardOwner();
    if (!sdk.deleteField) throw new Error('Is browser mein ye kaam nahi ho sakta.');
    let moved = 0;
    const month = pkDate().slice(0, 7);
    for (let i = 0; i < 12; i++) {
      const m = addMonths(month, -i), { from, to } = monthRange(m);
      const snap = await sdk.getDocs(sdk.query(col('staffAttendance'), sdk.where('date', '>=', from), sdk.where('date', '<=', to)));
      const rows = []; snap.forEach(d => { const v = d.data(); if (v.selfie) rows.push({ id: d.id, v }); });
      for (let k = 0; k < rows.length; k += 100) {
        const batch = sdk.writeBatch(fs);
        for (const { id, v } of rows.slice(k, k + 100)) {
          batch.set(ref('staffSelfies', id), { phone: normalizePhone(v.phone) || String(v.phone || ''), date: v.date || id.slice(0, 10), selfie: v.selfie, at: v.checkInTs || Date.now() });
          batch.update(ref('staffAttendance', id), { selfie: sdk.deleteField(), hasSelfie: true });
        }
        await batch.commit();
        moved += Math.min(100, rows.length - k);
        onProgress(moved, m);
      }
    }
    return moved;
  }

  /* ---------- bahar jane ki parchi ---------- */
  const rulesHint = error => error?.code === 'permission-denied'
    ? Object.assign(new Error('Parchi nahi ja saki: malik ko Firebase rules update karne hain (Settings › Update ke links › Firebase rules).'), { code: 'permission-denied' })
    : error;
  async function quick(write) {
    write.catch(e => problem('save', rulesHint(e)));
    let t; try { await Promise.race([write, new Promise(r => { t = setTimeout(r, 600); })]); } catch (e) { throw rulesHint(e); } finally { clearTimeout(t); }
  }
  /** Staff: bahar jane ki ijazat mangna. */
  async function requestOut({ reason, note = '', minutes }) {
    if (state.role !== 'staff' && state.role !== 'manager') throw new Error('Staff login zaroori hai.');
    const today = pkDate(), open = state.myAttendance.find(a => a.date === today && a.checkIn && !a.checkOut);
    if (!open) throw new Error('Pehle Check-In karein. Parchi sirf duty ke dauran banti hai.');
    const mine = state.outs.filter(o => o.date === today && o.phone === state.phone);
    if (mine.some(o => o.status === 'pending')) throw new Error('Aap ki aik parchi pehle se malik ke paas hai.');
    if (mine.some(o => o.status === 'approved')) throw new Error('Aap pehle se bahar hain. Wapas aa kar "Wapas aa gaya" dabayein.');
    const m = Math.round(Number(minutes));
    if (!reason) throw new Error('Wajah chunein.');
    if (!(m >= 1 && m <= 600)) throw new Error('Kitni der lagegi, wo chunein.');
    const id = sdk.doc(col('staffOuts')).id;
    // Ye keys firestore.rules mein ginti ki hui hain.
    await quick(sdk.setDoc(ref('staffOuts', id), { phone: state.phone, name: String(state.account?.name || '').slice(0, 80), date: today, reason: String(reason).slice(0, 40), note: String(note || '').slice(0, 300), minutes: m, status: 'pending', requestedAt: Date.now(), serverAt: sdk.serverTimestamp ? sdk.serverTimestamp() : Date.now(), by: auth.currentUser.uid }));
    ping('out', { title: `${me()} bahar jana chahta hai`, message: `${reason} · ${m} min${note ? ' · ' + note : ''} — app khol kar Haan / Nahi karein`, priority: 4, tags: ['door'] });
  }
  async function cancelOut(id) {
    if (state.role !== 'staff' && state.role !== 'manager') throw new Error('Staff login zaroori hai.');
    await quick(sdk.setDoc(ref('staffOuts', id), { status: 'cancelled' }, { merge: true }));
  }
  /** Staff: wapas aa gaya (GPS ke sath). Owner bhi laga sakta hai (larka bhool jaye). */
  async function returnOut(o, gps = null, wait = true) {
    if (!o?.id) throw new Error('Parchi nahi mili.');
    if (isManager() && o.phone !== state.phone) {
      await quick(sdk.setDoc(ref('staffOuts', o.id), { status: 'returned', returnAt: Date.now(), returnBy: 'manager', returnByName: String(state.account?.name || 'Manager').slice(0, 80), returnServerAt: sdk.serverTimestamp ? sdk.serverTimestamp() : Date.now() }, { merge: true }));
      return;
    }
    if (full() && !(state.role === 'manager' && o.phone === state.phone)) {
      guardOwner();
      await fast(async tx => { tx.set(ref('staffOuts', o.id), { status: 'returned', returnAt: Date.now(), returnBy: state.role === 'owner' ? 'malik' : 'manager', returnByName: actor() }, { merge: true }); audit(tx, 'bahar wapsi', o.id, { status: o.status }, { status: 'returned' }, 'Malik ne wapsi lagayi'); });
      return;
    }
    // v217: larke ki apni wapsi — pakki tasdeeq (server ka jawab), phone mein yaad, na pohanche to khud dobara.
    const fields = clean({ status: 'returned', returnAt: Date.now(), returnLat: gps?.lat ?? null, returnLng: gps?.lng ?? null, returnDistance: gps?.distance ?? null, returnAccuracy: gps?.accuracy ?? null });
    const entry = { key: 'return:' + o.id, kind: 'return', coll: 'staffOuts', id: o.id, phone: state.phone, fields, at: Date.now(), outKind: o.kind === 'break' ? 'break' : 'out' };
    const write = tracked(entry, sdk.setDoc(ref('staffOuts', o.id), { ...fields, returnServerAt: stamp() }, { merge: true }));
    return wait ? settle(write) : { queued: true, write };
  }
  /** Malik: Haan / Nahi. Haan par Gate Pass khulta hai aur bahar ka waqt shuru. */
  async function reviewOut(id, approve, note = '') {
    const now = Date.now(), stamp = sdk.serverTimestamp ? sdk.serverTimestamp() : now;
    if (isManager()) {
      const o = state.teamOuts.find(x => x.id === id);
      if (!o || o.status !== 'pending') throw new Error('Ye parchi pehle hi dekhi ja chuki hai ya cancel ho gayi.');
      if (o.phone === state.phone) throw new Error('Apni parchi khud manzoor nahi kar sakte.');
      const byName = String(state.account?.name || 'Manager').slice(0, 80);
      await quick(sdk.setDoc(ref('staffOuts', id), approve
        ? { status: 'approved', approvedAt: now, outAt: now, approvedBy: auth.currentUser.uid, approvedByName: byName, approvedServerAt: stamp }
        : { status: 'rejected', rejectedAt: now, approvedBy: auth.currentUser.uid, approvedByName: byName, approvedServerAt: stamp }, { merge: true }));
      return;
    }
    guardOwner();
    const o = state.outs.find(x => x.id === id);
    if (!o || o.status !== 'pending') throw new Error('Ye parchi pehle hi dekhi ja chuki hai ya cancel ho gayi.');
    notSelf(o.phone, 'parchi');
    await fast(async tx => {
      tx.set(ref('staffOuts', id), approve ? { status: 'approved', approvedAt: now, outAt: now, approvedBy: auth.currentUser.uid, approvedByName: actor(), ownerNote: note } : { status: 'rejected', rejectedAt: now, approvedBy: auth.currentUser.uid, approvedByName: actor(), ownerNote: note }, { merge: true });
      audit(tx, approve ? 'bahar manzoor' : 'bahar na-manzoor', `${o.date}_${o.phone}`, { status: 'pending' }, { status: approve ? 'approved' : 'rejected', reason: o.reason, minutes: o.minutes }, o.reason);
    });
  }

  /* ---------- notification ka token (is phone ke liye) ---------- */
  /** v219: har phone ki apni pehchan (localStorage) — Android ke Chrome sab phones ko aik jaisa "Android 10; K" batata hai. */
  const DEVICE_KEY = 'nt-hazri-device-id';
  function deviceId() {
    try { let id = storage?.getItem(DEVICE_KEY) || ''; if (!/^\w{6,16}$/.test(id)) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); storage?.setItem(DEVICE_KEY, id); } return id; }
    catch { return ''; }
  }
  async function savePushToken(token, label = '') {
    if (!token) return 0;
    const role = state.role === 'owner' ? 'owner' : state.role === 'manager' ? 'manager' : 'staff', phone = state.phone || '', did = deviceId();
    const device = (did ? `d:${did} · ` : '') + deviceText();
    await sdk.setDoc(ref('pushTokens', token.slice(-40)), clean({ token, role, phone, name: state.account?.name || (role === 'owner' ? 'Malik' : ''), device: device.slice(0, 80), at: Date.now() }), { merge: true });
    // v219: token safai — isi phone ke purane token hatao (pehle aik phone ke 3-3 token bante the aur list lambi hoti thi).
    // Pehchan: wahi device id; ya purana (v218 tak ka) record jis ka role/phone aur browser ka likha hua naam (label) bilkul wahi ho.
    try {
      const legacy = String(label || '').slice(0, 60), snap = await sdk.getDocs(col('pushTokens')), old = [];
      snap.forEach(d => {
        const t = d.data() || {}; if (!t.token || t.token === token) return;
        const dev = String(t.device || '');
        if ((did && dev.startsWith(`d:${did} `)) || (!dev.startsWith('d:') && legacy && dev === legacy && t.role === role && (t.phone || '') === phone)) old.push(d.id);
      });
      await Promise.all(old.map(id => sdk.deleteDoc(ref('pushTokens', id)).catch(() => {})));
      return old.length;
    } catch { return 0; }
  }
  /** Test: apne hi token par khabar mangwana (Cloud Function testAt dekh kar bhejti hai). */
  async function pushTestPing(token) {
    if (!token) throw new Error('Token nahi mila.');
    await sdk.setDoc(ref('pushTokens', token.slice(-40)), { testAt: Date.now() }, { merge: true });
  }
  async function removePushToken(token) { if (token) await sdk.deleteDoc(ref('pushTokens', token.slice(-40))).catch(() => {}); }
  async function pushDevices() { const snap = await sdk.getDocs(col('pushTokens')); const out = []; snap.forEach(d => out.push({ id: d.id, ...clean(d.data()) })); return out.sort((a, b) => (b.at || 0) - (a.at || 0)); }

  /* ---------- bina bataye gaya: ticket ---------- */
  /** Malik, manager ya senior banata hai. Koi apne aap par nahi; senior manager par nahi. */
  async function createTicket({ phone, from, back = '', note = '' }) {
    phone = normalizePhone(phone);
    if (!phone) throw new Error('Larka chunein.');
    const owner = full();
    if (!owner && !isTicketer()) throw new Error('Sirf malik, manager ya senior ticket bana sakta hai.');
    if (phone === state.phone && state.role !== 'owner') throw new Error('Apne upar ticket nahi bana sakte.');
    if (!owner && !isManager() && (state.config.roster || []).find(r => r.phone === phone)?.mgr) throw new Error('Senior, manager par ticket nahi bana sakta. Malik ko batayein.');
    const today = pkDate(), fromMs = pkTimeMs(today, from), backMs = back ? pkTimeMs(today, back) : null;
    if (!fromMs) throw new Error('Kab gaya, wo waqt chunein.');
    if (fromMs > Date.now() + 60000) throw new Error('Jane ka waqt abhi se aage nahi ho sakta.');
    if (backMs != null && backMs <= fromMs) throw new Error('Wapsi ka waqt jane ke baad ka ho.');
    if (backMs != null && backMs > Date.now() + 60000) throw new Error('Wapsi ka waqt abhi se aage nahi ho sakta.');
    const names = new Map(owner ? state.staff.map(s => [s.phone, s.name]) : (state.config.roster || []).map(r => [r.phone, r.name]));
    const byName = owner ? actor() : String(state.account?.name || 'Staff').slice(0, 80);
    const data = { phone, name: String(names.get(phone) || '').slice(0, 80), date: today, from: fromMs, note: String(note || '').slice(0, 300), status: backMs ? 'returned' : 'open',
      by: auth.currentUser.uid, byName, createdAt: Date.now(), serverAt: sdk.serverTimestamp ? sdk.serverTimestamp() : Date.now(), ...(backMs ? { returnAt: backMs } : {}) };
    const r = sdk.doc(col('staffTickets'));
    if (owner) { guardOwner(); await fast(async tx => { tx.set(r, data); audit(tx, 'ticket', `${today}_${phone}`, null, { from: fromMs, returnAt: backMs }, note || 'Bina bataye gaya'); }); }
    else await quick(sdk.setDoc(r, data));
    if (state.role !== 'owner') ping('ticket', { title: `Ticket: ${data.name || phone} bina bataye gaya`, message: `${fmtTime(from)} se${back ? ' ' + fmtTime(back) + ' tak' : ' (abhi bahar)'} · ticket: ${byName}${note ? ' · ' + note : ''} — faisla app mein`, priority: 4, tags: ['warning'] });
    return r.id;
  }
  async function returnTicket(t) {
    if (!t?.id || t.status !== 'open') throw new Error('Ye ticket pehle hi band hai.');
    const now = Date.now();
    if (full()) { guardOwner(); await fast(async tx => tx.set(ref('staffTickets', t.id), { status: 'returned', returnAt: now, returnBy: actor() }, { merge: true })); return; }
    if (!isTicketer()) throw new Error('Sirf malik, manager ya senior wapsi laga sakta hai.');
    await quick(sdk.setDoc(ref('staffTickets', t.id), { status: 'returned', returnAt: now, returnBy: String(state.account?.name || 'Staff').slice(0, 80), returnServerAt: sdk.serverTimestamp ? sdk.serverTimestamp() : now }, { merge: true }));
  }
  /** Mashwara: is larke ki salary ke hisab se katauti (qareebi 5 rupay). */
  function ticketSuggestFor(t, now = Date.now()) {
    const account = state.staff.find(s => s.phone === t.phone); if (!account) return 0;
    const c = calcFor(account, t.date.slice(0, 7));
    return ticketSuggest(c.hourly, ticketMinutes(t, now) || 0);
  }
  /** Faisla sirf malik: maaf / warning / katauti. */
  async function decideTicket(id, decision, amount = 0, note = '') {
    guardOwner();
    const t = state.tickets.find(x => x.id === id);
    if (!t) throw new Error('Ticket nahi mila.');
    if (!['maaf', 'warning', 'katauti'].includes(decision)) throw new Error('Faisla chunein.');
    notSelf(t.phone, 'ticket');
    const amt = decision === 'katauti' ? Math.round(Number(amount)) : 0;
    if (decision === 'katauti' && !(amt > 0)) throw new Error('Katauti ki raqam likhein.');
    if (decision === 'katauti' && payrollFor(t.phone, t.date.slice(0, 7))?.state === 'final') throw new Error('Is mahine ki salary final ho chuki hai. Pehle Salary mein "Dobara kholein" karein.');
    const patch = { status: 'decided', decision, amount: amt, decidedAt: Date.now(), decidedBy: auth.currentUser.uid, ownerNote: String(note || ''), ...(t.returnAt ? {} : { returnAt: Date.now(), returnBy: 'Malik' }) };
    await fast(async tx => { tx.set(ref('staffTickets', id), patch, { merge: true }); audit(tx, 'ticket faisla', `${t.date}_${t.phone}`, { status: t.status }, { decision, amount: amt }, note); });
  }

  /* ---------- khane ka waqfa: malik ya manager kai larkon ka aik sath ---------- */
  async function startBreak(phones = [], minutes = 30) {
    const m = Math.round(Number(minutes));
    if (!(m >= 1 && m <= 180)) throw new Error('Break ka waqt 1 se 180 minute tak chunein.');
    const list = [...new Set(phones.map(normalizePhone).filter(Boolean))];
    if (!list.length) throw new Error('Kam az kam aik larka chunein.');
    const owner = full();
    if (!owner && !isManager()) throw new Error('Sirf malik ya manager break shuru kar sakta hai.');
    if (owner) guardOwner();
    const now = Date.now(), today = pkDate(), batch = 'b' + now.toString(36), stamp = sdk.serverTimestamp ? sdk.serverTimestamp() : now;
    const byName = owner ? actor() : String(state.account?.name || 'Manager').slice(0, 80);
    const names = new Map((owner ? state.staff.map(s => [s.phone, s.name]) : (state.config.roster || []).map(r => [r.phone, r.name])));
    const doc = phone => ({ phone, name: String(names.get(phone) || '').slice(0, 80), date: today, reason: 'Khana', note: '', minutes: m, status: 'approved', kind: 'break', batch,
      requestedAt: now, serverAt: stamp, by: auth.currentUser.uid, outAt: now, approvedAt: now, approvedBy: auth.currentUser.uid, approvedByName: byName, approvedServerAt: stamp });
    if (owner) {
      await fast(async tx => { for (const phone of list) tx.set(sdk.doc(col('staffOuts')), doc(phone)); audit(tx, 'khana break', batch, null, { count: list.length, minutes: m }, byName); });
    } else {
      const b = sdk.writeBatch(fs); for (const phone of list) b.set(sdk.doc(col('staffOuts')), doc(phone));
      await quick(b.commit());
    }
    return list.length;
  }
  async function endBreaks(items = []) {
    const open = items.filter(o => o?.id && o.status === 'approved'); if (!open.length) return 0;
    const now = Date.now();
    if (full()) {
      guardOwner();
      await fast(async tx => { for (const o of open) tx.set(ref('staffOuts', o.id), { status: 'returned', returnAt: now, returnBy: state.role === 'owner' ? 'malik' : 'manager', returnByName: actor() }, { merge: true }); });
    } else {
      if (!isManager()) throw new Error('Sirf malik ya manager sab ki wapsi laga sakta hai.');
      const b = sdk.writeBatch(fs), stamp = sdk.serverTimestamp ? sdk.serverTimestamp() : now, byName = String(state.account?.name || 'Manager').slice(0, 80);
      for (const o of open) b.set(ref('staffOuts', o.id), o.phone === state.phone
        ? { status: 'returned', returnAt: now, returnServerAt: stamp }
        : { status: 'returned', returnAt: now, returnBy: 'manager', returnByName: byName, returnServerAt: stamp }, { merge: true });
      await quick(b.commit());
    }
    return open.length;
  }

  /* ---------- staff: check-in / out / request ---------- */
  async function checkIn({ selfie, gps }) {
    if (state.role !== 'staff' && state.role !== 'manager') throw new Error('Staff login zaroori hai.');
    const phone = state.phone, schedule = scheduleFor(phone), date = pkDate(), id = `${date}_${phone}`;
    const radius = Number(state.config.radius || SHOP.radius);
    if (!selfie) throw new Error('Pehle selfie lein.');
    if (!gps) throw new Error('Location nahi mili.');
    if (gps.distance > radius) throw Object.assign(new Error(`Aap dukaan se ${Math.round(gps.distance)}m door hain. Had ${radius}m hai.`), { code: 'app/too-far' });
    const start = parseTime(schedule.shiftStart) ?? 540;
    const minutesLate = Math.max(0, pkMinutes() - start);
    const autoScore = scoreForLate(Math.max(0, minutesLate - Number(schedule.grace ?? 10) + 10), state.config.scores);
    // Selfie alag doc mein (staffSelfies) taake malik ki list halki rahe. serverAt = server ka asal waqt.
    const entry = { key: 'checkin:' + id, kind: 'checkin', coll: 'staffAttendance', id, phone, at: Date.now() };
    const write = tracked(entry, sdk.setDoc(ref('staffAttendance', id), {
      ...clean({
        id, date, phone, name: state.account?.name || '', address: state.account?.address || '',
        checkIn: pkTime24(), checkInTs: Date.now(), checkInLat: gps.lat, checkInLng: gps.lng, checkInAccuracy: gps.accuracy, checkInDistance: gps.distance,
        hasSelfie: true, shopLat: SHOP.lat, shopLng: SHOP.lng, shopRadius: radius, minutesLate, autoScore, finalScore: autoScore, shiftStart: schedule.shiftStart || '09:15'
      }),
      serverAt: stamp()
    }, { merge: true }));
    sdk.setDoc(ref('staffSelfies', id), { phone, date, selfie, at: Date.now() }).catch(error => {
      // Purane rules (v204 se pehle) staffSelfies nahi mante: selfie hazri ke record mein hi rakh do
      if (error?.code === 'permission-denied') write.then(() => sdk.setDoc(ref('staffAttendance', id), { selfie, hasSelfie: false }, { merge: true })).catch(e => onProblem('queued-write', e));
      else onProblem('queued-write', error);
    });
    // Late aaya -> malik/manager ko khabar (aadhi chutti subah wali ho to nahi)
    const lvToday = state.requests.find(r => r.phone === phone && r.kind === 'leave' && r.status === 'approved' && r.date <= date && (r.to || r.date) >= date);
    if (!lvToday && minutesLate > Number(schedule.grace ?? 10)) ping('late', { title: `${me()} late aaya`, message: `${fmtTime(pkTime24())} par Check-In — ${minutesLate} min late (duty ${fmtTime(schedule.shiftStart)})`, tags: ['alarm_clock'] });
    return settle(write);
  }
  async function checkOut(row, gps) {
    if (state.role !== 'staff' && state.role !== 'manager') throw new Error('Staff login zaroori hai.');
    if (!row?.checkIn || row.checkOut) throw new Error('Check-In ka record nahi mila.');
    // v216: sirf APNI khuli parchi/break band ho (manager ke paas sab ki parchiyan hoti hain)
    const openOut = state.outs.find(o => o.phone === state.phone && o.date === row.date && o.status === 'approved');
    if (openOut) { try { await returnOut(openOut, gps, false); } catch { /* parchi ki wapsi baad mein */ } }
    const id = row.id || `${row.date}_${state.phone}`;
    // v217: waqt aik dafa yahin likha jata hai — dobara bhejna pade to bhi yahi (asal) waqt jata hai.
    const fields = clean({ phone: state.phone, checkOut: pkTime24(), checkOutTs: Date.now(), checkOutLat: gps?.lat ?? null, checkOutLng: gps?.lng ?? null, checkOutAccuracy: gps?.accuracy ?? null, checkOutDistance: gps?.distance ?? null });
    const entry = { key: 'checkout:' + id, kind: 'checkout', coll: 'staffAttendance', id, phone: state.phone, fields, at: Date.now() };
    const write = tracked(entry, sdk.setDoc(ref('staffAttendance', id), { ...fields, outServerAt: stamp() }, { merge: true }));
    return settle(write);
  }
  /* ---------- v217: PAKKI TASDEEQ (Check-In / Check-Out / Wapsi) ----------
     Pehle: 0.6-2.5 second baad "ho gaya" — chahe server ne qubool na kiya ho. Ab:
     - har likhai ka nateeja state.sync[key] = { kind, phase: sending|waiting|ok|fail, code, at }
     - Check-Out / Wapsi phone mein (localStorage OUTBOX_KEY) yaad rehti hai jab tak server confirm na kare;
       app band kar ke kholein, internet wapas aaye ya har 30 second — server se dekh kar (getDocFromServer)
       na mile to wahi PURANA waqt dobara bhejti hai. Check-In (selfie) dobara nahi bhejti, sirf jaanch.
     - mana ho to pehle server par dekhti hai: pehle hi lag chuka (doosri koshish / malik ne band kiya) = kamyab.
     - kamyabi par onProblem('confirmed', { kind, id, fresh }) -> app.js -> staffview celebration. */
  const OUTBOX_KEY = 'nt-hazri-outbox-v217';
  const stamp = () => (sdk.serverTimestamp ? sdk.serverTimestamp() : Date.now());
  const readBox = () => { try { const v = JSON.parse(storage?.getItem(OUTBOX_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const writeBox = list => { try { if (list.length) storage?.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-12))); else storage?.removeItem(OUTBOX_KEY); } catch { /* jagah na ho */ } };
  const boxPut = e => writeBox([...readBox().filter(x => x.key !== e.key), e]);
  const boxDrop = key => writeBox(readBox().filter(x => x.key !== key));
  const punchKind = kind => (kind === 'checkin' || kind === 'checkout');
  function setSync(key, patch) { state.sync = { ...state.sync, [key]: { ...(state.sync[key] || {}), ...patch, at: Date.now() } }; changed(); }
  /** Server par asal halat: 'yes' (lag chuka) | 'no' | 'missing' (record hi nahi) | 'unknown' (internet). */
  async function onServer(e) {
    try {
      const get = sdk.getDocFromServer || sdk.getDoc;
      const snap = await timeout(get(ref(e.coll, e.id)), 8000);
      if (!snap.exists()) return 'missing';
      const d = snap.data() || {};
      if (e.kind === 'checkout') return d.checkOut ? 'yes' : 'no';
      if (e.kind === 'checkin') return d.checkIn ? 'yes' : 'no';
      return ['returned', 'cancelled', 'rejected'].includes(d.status) ? 'yes' : 'no';
    } catch { return 'unknown'; }
  }
  function confirmed(e, fresh) {
    const had = readBox().find(x => x.key === e.key), lateMin = Math.round((Date.now() - (e.at || Date.now())) / 60000);
    boxDrop(e.key);
    // v218: der se pohanchi ya pehle fail hui thi -> malik ke "Phones ki jaanch" mein nazar aaye
    if (!fresh && lateMin >= 2) diagPing({ lateKind: e.kind, lateMin, lateAt: Date.now(), fixedAt: Date.now() }, true);
    else if (had?.lastError) diagPing({ fixedAt: Date.now() }, true);
    if (punchKind(e.kind) && state.punchError?.kind === e.kind) state.punchError = null;
    setSync(e.key, { kind: e.kind, phase: 'ok', code: '' });
    onProblem('confirmed', { kind: e.kind, id: e.id, fresh, at: e.at, outKind: e.outKind || '' });
  }
  function failed(e, code) {
    const box = readBox().find(x => x.key === e.key);
    if (box) boxPut({ ...box, lastError: code, tries: (box.tries || 0) + 1 });
    if (punchKind(e.kind)) state.punchError = { kind: e.kind, code, at: Date.now() };
    setSync(e.key, { kind: e.kind, phase: 'fail', code });
    diagPing({ failKind: e.kind, failCode: String(code).slice(0, 40), failAt: Date.now(), failId: String(e.id || '').slice(0, 80), failDate: pkDate() }, true);
    scheduleDrain(30000);
  }
  /** Likhai ko track karo. write = setDoc ka promise (Firestore isay tab poora karta hai jab SERVER qubool kar le). */
  function tracked(e, write, fresh = null) {
    if (e.kind !== 'checkin') boxPut(e); else boxPut({ ...e, fields: undefined });
    setSync(e.key, { kind: e.kind, phase: 'sending', code: '' });
    const slow = setTimeout(() => { if (state.sync[e.key]?.phase === 'sending') { setSync(e.key, { phase: 'waiting' }); scheduleDrain(30000); } }, 2500);
    write.then(() => { clearTimeout(slow); confirmed(e, fresh ?? (Date.now() - e.at < 120000)); }, async error => {
      clearTimeout(slow);
      const code = error?.code || 'error', seen = await onServer(e);
      if (seen === 'yes') { confirmed(e, false); return; }
      failed(e, seen === 'missing' && e.kind !== 'checkin' ? 'missing' : code);
    });
    return write;
  }
  let drainTimer = null, draining = false;
  function scheduleDrain(ms) {
    clearTimeout(drainTimer);
    drainTimer = setTimeout(() => { drainTimer = null; void drainOutbox(); }, ms);
  }
  /** Phone mein ruki hui likhai: server par dekho, na mile to dobara bhejo (wahi purana waqt). */
  async function drainOutbox() {
    if (draining || !['staff', 'manager'].includes(state.role) || !state.phone) return 0;
    if (!state.loaded.has('myAttendance')) { scheduleDrain(4000); return 0; }
    const list = readBox().filter(e => e.phone === state.phone);
    if (!list.length) return 0;
    draining = true; let sent = 0;
    try {
      for (const e of list) {
        if (Date.now() - e.at > 36 * 3600000) { boxDrop(e.key); continue; }       // bohat purani — chhor do
        if (state.sync[e.key]?.phase === 'sending') continue;                       // abhi isi dafa ja rahi hai
        const local = e.coll === 'staffOuts' ? state.outs.find(o => o.id === e.id) : state.myAttendance.find(a => a.id === e.id);
        const seen = await onServer(e);
        if (seen === 'yes') { confirmed(e, false); continue; }
        if (seen === 'unknown') { setSync(e.key, { kind: e.kind, phase: 'waiting' }); continue; }
        if (e.kind === 'checkin') {                                                 // selfie dobara nahi bhejte — sirf batao
          if (local?.pending) { setSync(e.key, { kind: e.kind, phase: 'waiting' }); continue; }
          boxDrop(e.key); state.punchError = { kind: 'checkin', code: 'lost', at: Date.now() }; setSync(e.key, { kind: e.kind, phase: 'fail', code: 'lost' });
          diagPing({ failKind: 'checkin', failCode: 'lost', failAt: Date.now(), failId: String(e.id || '').slice(0, 80), failDate: pkDate() }, true); continue;
        }
        if (local?.pending) { setSync(e.key, { kind: e.kind, phase: 'waiting' }); continue; } // Firebase khud bhej raha hai
        if (seen === 'missing') { failed(e, 'missing'); continue; }
        resend(e); sent++;
      }
    } finally { draining = false; }
    if (readBox().some(e => e.phone === state.phone)) scheduleDrain(30000);
    return sent;
  }
  /** fresh=false: khud (app kholne par) dobara gayi — sirf chhota paigham; true: larke ne "Dobara bhejein" dabaya — poori animation. */
  function resend(e, fresh = false) {
    const extra = e.kind === 'checkout' ? { outServerAt: stamp() } : { returnServerAt: stamp() };
    return tracked(e, sdk.setDoc(ref(e.coll, e.id), { ...e.fields, ...extra }, { merge: true }), fresh);
  }
  /** "Dobara bhejein" button. */
  async function retrySync(key) {
    const e = readBox().find(x => x.key === key && x.phone === state.phone);
    if (!e) { await drainOutbox(); return; }
    if (e.kind === 'checkin') { await drainOutbox(); return; }
    const seen = await onServer(e);
    if (seen === 'yes') { confirmed(e, true); return; }
    if (seen === 'missing') { failed(e, 'missing'); return; }
    return settle(resend(e, true));
  }
  /** "Theek hai": paigham band. Check-Out/Wapsi phir bhi baqi ho to button wapas aa jata hai, larka dobara daba sakta hai. */
  function dismissSync(key) {
    const s = state.sync[key]; boxDrop(key);
    if (s && punchKind(s.kind) && state.punchError?.kind === s.kind) state.punchError = null;
    const next = { ...state.sync }; delete next[key]; state.sync = next; changed();
  }
  const pendingSync = () => readBox().filter(e => e.phone === state.phone);

  /* ---------- v218: JAANCH KA RECORD (staffDiag/{phone}) ----------
     Har larke ka phone apna aik doc likhta hai: app version, home screen app ya browser, phone, aakhri dafa kab khuli, kitni
     likhai phone mein ruki hai, aakhri FAIL (kya, kyun, kab) aur der se pohanchi likhai. Malik "Tawajju chahiye" / "Phones ki jaanch"
     mein dekhta hai — andaze ki jagah asal wajah. Keys firestore.rules (staffDiag) mein ginti ki hui hain. Best-effort: rules na
     hon ya net na ho to chup (Firebase qataar mein rakhta hai). Aam record 30 minute mein aik dafa; fail/fix foran. */
  const DIAG_KEY = 'nt-hazri-diag-v218';
  const DIAG_KEYS = ['phone', 'name', 'v', 'at', 'serverAt', 'device', 'app', 'pending', 'failKind', 'failCode', 'failAt', 'failId', 'failDate', 'fixedAt', 'lateKind', 'lateMin', 'lateAt'];
  function deviceText() {
    const ua = String(globalThis.navigator?.userAgent || '');
    const os = (ua.match(/Android [\d.]+(?:; [^;)]+)?/) || ua.match(/iPhone OS [\d_]+|iPad|Windows NT [\d.]+|Mac OS X [\d_]+/) || [''])[0].replace(/_/g, '.');
    const br = (ua.match(/(?:Chrome|CriOS|Firefox|SamsungBrowser|Version)\/(\d+)/) || [])[0] || '';
    return (os + (br ? ' · ' + br : '')).slice(0, 80) || 'Nama\'loom';
  }
  function appMode() {
    try { return (globalThis.matchMedia?.('(display-mode: standalone)')?.matches || globalThis.navigator?.standalone) ? 'home' : 'browser'; } catch { return 'browser'; }
  }
  function diagPing(extra = {}, force = false) {
    if (!['staff', 'manager'].includes(state.role) || !state.phone || !sdk.setDoc) return false;
    let last = {}; try { last = JSON.parse(storage?.getItem(DIAG_KEY) || '{}') || {}; } catch { last = {}; }
    const now = Date.now(), pending = pendingSync().length;
    if (!force && last.phone === state.phone && last.v === APP_VERSION && last.pending === pending && now - (last.at || 0) < 30 * 60000) return false;
    const rec = { phone: state.phone, name: String(state.account?.name || '').slice(0, 80), v: APP_VERSION, at: now, device: deviceText(), app: appMode(), pending, ...extra, serverAt: stamp() };
    for (const k of Object.keys(rec)) if (!DIAG_KEYS.includes(k)) delete rec[k];
    try { storage?.setItem(DIAG_KEY, JSON.stringify({ phone: state.phone, v: APP_VERSION, pending, at: now })); } catch { /* ignore */ }
    Promise.resolve().then(() => sdk.setDoc(ref('staffDiag', state.phone), rec, { merge: true })).catch(() => { /* rules v218 publish nahi / net nahi — chup */ });
    return true;
  }
  /** Server ka jawab 2.5 second mein na aaye to hazri phone mein qataar mein rehti hai aur signal aate hi chali jati hai. */
  async function settle(write) {
    try { await timeout(write, 2500); return { queued: false }; }
    catch (error) { if (error.code === 'app/slow-network') { write.catch(e => onProblem('queued-write', e)); return { queued: true }; } throw error; }
  }
  /** v221: dukaan se BAHAR (ya location na mile) — seedha Check-Out nahi; malik ko request (kind correction, via outside).
      Malik "Manzoor" kare to reviewRequest wahi waqt + location hazri mein lagata hai. Keys firestore.rules mein ginti ki hain. */
  async function requestOutsideCheckout({ row, time, reason, note = '', gps = null, gpsError = '' }) {
    if (state.role !== 'staff' && state.role !== 'manager') throw new Error('Staff login zaroori hai.');
    if (!row?.checkIn || row.checkOut) throw new Error('Check-In ka record nahi mila.');
    const outT = to24(time); if (!outT) throw new Error('Dukaan se kab nikle, wo waqt chunein.');
    if (workMinutes({ checkIn: row.checkIn, checkOut: outT }) == null) throw new Error(`Nikalne ka waqt (${fmtTime(outT)}) aane ke waqt (${fmtTime(row.checkIn)}) se pehle hai ya 16 ghante se zyada. AM / PM check karein.`);
    if (row.date === pkDate() && (parseTime(outT) ?? 0) > pkMinutes() + 2 && (parseTime(outT) ?? 0) > (parseTime(row.checkIn) ?? 0)) throw new Error('Aane wala waqt nahi chun sakte.');
    const why = String(reason || '').trim(); if (!why) throw new Error('Wajah chunein.');
    if (state.requests.some(r => r.phone === state.phone && r.kind === 'correction' && r.via === 'outside' && r.date === row.date && r.status === 'pending')) throw new Error('Is din ki bahar se Check-Out request pehle se malik ke paas hai.');
    const id = sdk.doc(col('staffRequests')).id;
    const where = gps && Number.isFinite(gps.lat) ? { lat: Math.round(gps.lat * 1e6) / 1e6, lng: Math.round(gps.lng * 1e6) / 1e6, distance: Math.round(gps.distance), accuracy: Math.round(gps.accuracy || 0) } : { gpsError: String(gpsError || 'Location nahi mili').slice(0, 60) };
    const write = sdk.setDoc(ref('staffRequests', id), { phone: state.phone, kind: 'correction', via: 'outside', date: row.date, to: row.date, half: '', checkIn: '', checkOut: outT,
      reason: (why + (String(note || '').trim() ? ' — ' + String(note).trim() : '')).slice(0, 1000), status: 'pending', createdAt: Date.now(), by: auth.currentUser.uid, ...where });
    write.catch(e => problem('save', e));
    ping('leave', { title: `${me()}: dukaan se bahar Check-Out`, message: `${fmtTime(outT)} · ${where.distance != null ? (where.distance >= 1000 ? (where.distance / 1000).toFixed(1) + ' km' : where.distance + ' m') + ' door' : 'location nahi'} · ${why}`, tags: ['house'] });
    return settle(write);
  }
  async function sendRequest({ kind, date, to, checkIn, checkOut, reason, half = '' }) {
    if (state.role !== 'staff' && state.role !== 'manager') throw new Error('Staff login zaroori hai.');
    if (!['leave', 'correction'].includes(kind)) throw new Error('Request ki qisam chunein.');
    if (!isDate(date)) throw new Error('Tareekh chunein.');
    half = kind === 'leave' && ['am', 'pm'].includes(half) ? half : '';
    const end = kind === 'correction' || half ? date : (isDate(to) ? to : date);
    if (end < date) throw new Error('Aakhri tareekh pehli se pehle nahi ho sakti.');
    if (kind === 'correction' && !checkIn && !checkOut) throw new Error('Sahi waqt likhein.');
    if (!String(reason || '').trim()) throw new Error('Wajah likhein.');
    const id = sdk.doc(col('staffRequests')).id;
    // Ye keys firestore.rules mein ginti ki hui hain — koi aur key mat barhana.
    const write = sdk.setDoc(ref('staffRequests', id), { phone: state.phone, kind, date, to: end, half, checkIn: checkIn || '', checkOut: checkOut || '', reason: String(reason).trim().slice(0, 1000), status: 'pending', createdAt: Date.now(), by: auth.currentUser.uid });
    write.catch(e => problem('save', e));
    let t; await Promise.race([write, new Promise(r => { t = setTimeout(r, 400); })]).finally(() => clearTimeout(t));
    ping('leave', { title: kind === 'leave' ? `${me()} ne chutti mangi` : `${me()}: hazri durust karne ki request`, message: `${shortDateSafe(date)}${end !== date ? ' – ' + shortDateSafe(end) : ''}${half ? (half === 'am' ? ' (aadha din subah)' : ' (aadha din shaam)') : ''} · ${String(reason).trim().slice(0, 120)}`, tags: ['memo'] });
  }

  /* ---------- v220: CAMERAS (Hissa A) — PC ka login, naam / kaam, nayi tasveer ----------
     Camera ka password aur Claude ki key SIRF shop PC mein (ntcam.py). Yahan sirf naam, kaam, on/off aur tasveerein. */
  const CAM_ROLES = ['galla', 'counter', 'view'];
  const ownerOnly = () => { if (state.role !== 'owner') throw new Error('Cameras sirf malik ke liye hain.'); };
  /** Tasveerein bhaari hoti hain — sirf jab Cameras ka safha khula ho tab suno. */
  function watchShots(on) {
    try { shotsSub?.(); } catch { /* ignore */ } shotsSub = null;
    if (!on || state.role !== 'owner') return;
    const token = epoch;
    shotsSub = sdk.onSnapshot(col('cameraShots'), snap => { if (token !== epoch) return; const m = new Map(); snap.forEach(d => m.set(d.id, clean(d.data()))); state.camShots = m; changed(); }, error => { if (token === epoch) problem('camShots', error); });
  }
  /** PC ka apna login banao (doosri Firebase app se — malik ka login nahi hilta). Code = "<id>-<password>", sirf aik dafa dikhta hai. */
  async function createCameraPC() {
    ownerOnly();
    const A = 'abcdefghjkmnpqrstuvwxyz23456789', pick = n => Array.from(globalThis.crypto.getRandomValues(new Uint32Array(n)), x => A[x % A.length]).join('');
    const id = pick(6), secret = pick(10), email = `cam-${id}@nttraders.local`;
    const app2 = sdk.initializeApp(firebaseConfig, 'ntcam-' + Date.now());
    let auth2, uid = '';
    try { auth2 = sdk.initializeAuth && sdk.inMemoryPersistence ? sdk.initializeAuth(app2, { persistence: sdk.inMemoryPersistence }) : sdk.getAuth(app2); } catch { auth2 = sdk.getAuth(app2); }
    try { uid = (await sdk.createUserWithEmailAndPassword(auth2, email, secret)).user.uid; }
    catch (error) {
      if (error?.code === 'auth/operation-not-allowed') throw new Error('Firebase mein "Email/Password" login band hai — Authentication > Sign-in method mein ON karein.');
      if (error?.code === 'auth/network-request-failed') throw new Error('Internet kamzor hai. Dobara koshish karein.');
      throw error;
    } finally { try { await sdk.deleteApp?.(app2); } catch { /* ignore */ } }
    await fast(async tx => { tx.set(ref('cameraPC', 'config'), { uid, email, at: Date.now(), by: actor() }); audit(tx, 'camera pc', 'config', null, { email }, 'Naya camera PC code'); });
    return `${id}-${secret}`;
  }
  async function saveCamera(id, { name, role, enabled, aiCap, sens }) {
    ownerOnly();
    const n = String(name || '').trim().slice(0, 40);
    if (!n) throw new Error('Camera ka naam likhein.');
    const cap = Math.round(Number(aiCap));
    await quick(sdk.setDoc(ref('cameras', id), { name: n, role: CAM_ROLES.includes(role) ? role : 'view', enabled: enabled !== false,
      aiCap: Number.isFinite(cap) && cap > 0 ? Math.min(2000, cap) : 300, sens: CAM_SENS.includes(sens) ? sens : 'mid' }, { merge: true }));
  }
  /* ---------- v222: GALLA NIGRANI (malik) ---------- */
  const CAM_SENS = ['low', 'mid', 'high'];
  /** Aik din ke galla events (chhoti thumb ke sath) + us din ki ginti. Sirf jab Nigrani tab khula ho. */
  function watchEvents(date) {
    for (const u of eventSubs) { try { u(); } catch { /* ignore */ } } eventSubs = [];
    state.camDay = date || '';
    if (!date || state.role !== 'owner') { state.camEvents = []; state.camDayStats = []; return; }
    const token = epoch;
    eventSubs.push(sdk.onSnapshot(sdk.query(col('cameraEvents'), sdk.where('date', '==', date)), snap => {
      if (token !== epoch || state.camDay !== date) return;
      state.camEvents = readList(snap).sort((a, b) => (b.at || 0) - (a.at || 0)); state.loaded.add('camEvents'); changed();
    }, error => { if (token === epoch) problem('camEvents', error); }));
    eventSubs.push(sdk.onSnapshot(sdk.query(col('cameraStats'), sdk.where('date', '==', date)), snap => {
      if (token !== epoch || state.camDay !== date) return;
      state.camDayStats = readList(snap); changed();
    }, error => { if (token === epoch) problem('camDayStats', error); }));
  }
  async function loadFrames(id) { ownerOnly(); const snap = await sdk.getDoc(ref('cameraFrames', id)); return snap.exists() ? (snap.data().frames || []) : []; }
  async function reviewEvent(id, status, note = '') {
    ownerOnly();
    if (!['ok', 'confirmed', ''].includes(status)) throw new Error('Ghalat faisla');
    await quick(sdk.setDoc(ref('cameraEvents', id), { reviewed: status, reviewedAt: Date.now(), reviewNote: String(note || '').slice(0, 200) }, { merge: true }));
  }
  async function saveZone(id, zone) {
    ownerOnly();
    const r = v => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 1000) / 1000;
    const z = zone ? { x: r(zone.x), y: r(zone.y), w: r(zone.w), h: r(zone.h) } : null;
    if (z && (z.w < 0.04 || z.h < 0.04)) throw new Error('Dabba bohat chhota hai — galla ke gird thora bara banayein.');
    await quick(sdk.setDoc(ref('cameras', id), { zone: z }, { merge: true }));
  }
  /** 30 din se purane events + tasveerein + ginti mitao (malik ki app khulne par, thore thore). */
  async function cleanupCam(days = 30) {
    if (state.role !== 'owner') return 0;
    const cutoff = addDays(pkDate(), -days - 1); let n = 0;
    for (const coll of ['cameraEvents', 'cameraStats']) {
      const snap = await sdk.getDocs(sdk.query(col(coll), sdk.where('date', '<=', cutoff), ...(sdk.limit ? [sdk.limit(40)] : [])));
      const ids = []; snap.forEach(d => ids.push(d.id));
      for (const id of ids) {
        await sdk.deleteDoc(ref(coll, id)).catch(() => {});
        if (coll === 'cameraEvents') await sdk.deleteDoc(ref('cameraFrames', id)).catch(() => {});
        n++;
      }
    }
    return n;
  }
  async function requestShot(id) { ownerOnly(); await quick(sdk.setDoc(ref('cameras', id), { snapReq: Date.now() }, { merge: true })); }
  async function deleteCamera(id) { ownerOnly(); await quick(sdk.deleteDoc(ref('cameras', id))); try { await sdk.deleteDoc(ref('cameraShots', id)); } catch { /* ignore */ } }

  return {
    app, full, actor, auth, state, watchShots, createCameraPC, saveCamera, requestShot, deleteCamera,
    watchEvents, loadFrames, reviewEvent, saveZone, cleanupCam, projectId: firebaseConfig?.projectId || 'nt-traders', stop, startOwner, startStaff, watchMonth, attendanceBetween, allAttendance, monthLoaded, scheduleFor, payrollFor, calcFor, salaryFor,
    requestOut, cancelOut, returnOut, reviewOut, isManager, isTicketer, startBreak, endBreaks, createTicket, returnTicket, decideTicket, ticketSuggestFor,
    savePushToken, removePushToken, pushDevices, pushTestPing,
    applyDefaultShiftAll, applyDefaultSalaryAll, toggleClosed, quickPresent, closeCheckouts, getSelfie, migrateSelfies, selfiesFor, auditLog,
    accounts: {
      async getSession(uid) { const s = await sdk.getDoc(ref('staffSessions', uid)); return s.exists() ? s.data() : null; },
      async getAccount(phone) { const s = await sdk.getDoc(ref('staffAccounts', phone)); return s.exists() ? { ...s.data(), phone } : null; },
      async createSession(uid, phone) { await sdk.setDoc(ref('staffSessions', uid), { phone, createdAt: Date.now() }); }
    },
    saveStaff, deleteStaff, saveConfig, saveAttendance, deleteAttendance, markLeave, cancelLeave, reviewRequest,
    addExtra, removeExtra, toggleFinal, addPayment, checkIn, checkOut, sendRequest, requestOutsideCheckout,
    retrySync, dismissSync, drainOutbox, pendingSync, diagPing
  };
}
