// app.js — app ka dhancha: login screen, malik/staff ka panel chalana, buttons ka aik hi jagah se intezam.
import { APP_VERSION, esc, normalizePhone } from './core.js';
import { createAuthController, loginErrorMessage } from './auth.js';
import { createData } from './data.js';
import { createStaffView } from './staffview.js';
// v215: malik ka panel (bara) sirf malik/manager ke liye load hota hai — larke ke phone par nahi.
const loadOwnerView = () => import('./owner.js').then(m => m.createOwnerView);
const loadManagerView = () => import('./manager.js').then(m => m.createManagerView);
import { $, icon, toast, formValues, closeSheets, refreshSheets, errorText } from './ui.js';

const ROLE_KEY = 'nt-hazri-last-role';
const FIELD = /^(INPUT|TEXTAREA|SELECT)$/;

const OWNER_IN_KEY = 'nt-hazri-owner-in';
const STAFF_CACHE_KEY = 'nt-hazri-session-v200';
// v215: pichli screen ki "tasveer" (HTML) — index.html usay app ke JS se bhi pehle dikha deta hai.
const SNAP_KEY = 'nt-hazri-snap-v1';

/**
 * sdk ya sdkPromise. Tez kholne ke liye boot.js Firebase ko peeche load karta hai (sdkPromise):
 * jo pehle se login nahi, us ko login screen FORAN nazar aati hai, Firebase aane tak intezar nahi.
 */
export function startApp({ sdk, sdkPromise, firebaseConfig, storage = safeLocalStorage(), win = window }) {
  const doc = win.document, root = $('#app', doc);
  let view = null, dirty = false, login = { role: storage?.getItem(ROLE_KEY) || 'staff', error: '', busy: false, showPass: false };
  let data = null, controller = null, sessionSeq = 0, snapTimer = null, firstPaint = true;
  const hint = () => { try { return !!(storage?.getItem(STAFF_CACHE_KEY) || storage?.getItem(OWNER_IN_KEY)); } catch { return false; } };
  // v207: malik ka bheja hua login link  ...#login=03001234567  -> number likhe baghair khud login
  const linkPhone = (() => { const m = String(win.location?.hash || '').match(/login=([+\d\s-]{10,16})/); return m ? normalizePhone(decodeURIComponent(m[1])) : ''; })();
  if (linkPhone) { try { win.history?.replaceState?.(null, '', win.location.pathname + win.location.search); } catch { /* ignore */ } login.role = 'staff'; }
  const cachedStaffPhone = () => { try { return JSON.parse(storage?.getItem(STAFF_CACHE_KEY) || 'null')?.phone || ''; } catch { return ''; } };
  const ownerIn = () => { try { return storage?.getItem(OWNER_IN_KEY) === '1'; } catch { return false; } };
  if (!hint() || (linkPhone && !ownerIn() && cachedStaffPhone() !== linkPhone)) showLogin();

  const ready = Promise.resolve(sdkPromise || sdk).then(realSdk => { build(realSdk); return true; }).then(ok => {
    if (ok && linkPhone) {
      if (ownerIn()) toast('Is phone par malik login hai. Staff ka link kholne ke liye pehle malik logout karein.', 'bad');
      else if (cachedStaffPhone() !== linkPhone) void doLogin({ role: 'staff', password: linkPhone }, linkPhone);
    }
    return ok;
  }).catch(error => {
    console.error(error); login.busy = false;
    login.error = 'App ka Firebase hissa load nahi hua. Internet check kar ke page dobara kholein.'; showLogin(); return false;
  });

  function build(sdk) {
  data = createData({
    sdk, firebaseConfig,
    onChange: () => { softRender(); view?.onData?.(); },
    onProblem: (name, error) => {
      console.warn('data', name, error);
      if (name === 'new-ticket') { toast('Naya "bina bataye gaya" ticket — Hazri tab mein faisla karein', 'bad'); try { win.navigator.vibrate?.([300, 100, 300]); } catch { /* ignore */ } return; }
      if (name === 'new-out') { // nayi parchi: malik ko foran khabar (app khuli ho to)
        const n = error?.fresh?.length || 1; toast(n > 1 ? `${n} nayi parchiyan — Haan / Nahi karein` : 'Nayi parchi: koi bahar jana chahta hai — Hazri tab dekhein', 'ok');
        try { win.navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
        try { const A = win.AudioContext || win.webkitAudioContext; if (A) { const c = new A(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25); } } catch { /* ignore */ }
        return;
      }
      if (name === 'save' || name === 'queued-write') toast('Entry server par save nahi hui (' + (error?.code || 'error') + '). Internet check kar ke dobara karein.', 'bad');
      else if (error?.code === 'permission-denied') toast('Kuch data ki ijazat nahi mili (' + name + '). Logout kar ke dobara login karein.', 'bad');
    }
  });
  controller = createAuthController({
    auth: data.auth, sdk, accounts: data.accounts, storage,
    onReset() { data.stop(); view = null; closeSheets(); login.busy = false; try { storage?.removeItem(OWNER_IN_KEY); storage?.removeItem(SNAP_KEY); } catch { /* ignore */ } showLogin(); },
    onSession(session) {
      clearTimeout(win.__bootTimer);
      login.error = ''; login.busy = false;
      try { storage?.setItem(ROLE_KEY, session.role); if (session.role === 'owner') storage?.setItem(OWNER_IN_KEY, '1'); } catch { /* ignore */ }
      const shared = { data, controller, rerender: render, logout: () => controller.logout().catch(e => toast(errorText(e), 'bad')), checkUpdate, install };
      const seq = ++sessionSeq;
      const show = make => { if (seq !== sessionSeq) return; view = make(shared); root.dataset.screen = session.role; render(); };
      const failView = error => { console.error(error); if (seq === sessionSeq) toast('App ka ek hissa load nahi hua. Internet check kar ke "Taza kholein" dabayein.', 'bad'); };
      if (session.role === 'owner') { data.startOwner(); loadOwnerView().then(show).catch(failView); }
      else if (session.account?.canApproveOuts === true) { data.startOwner({ role: 'manager', phone: session.phone, account: session.account }); loadManagerView().then(show).catch(failView); } // v211: manager = poora panel
      else { data.startStaff(session.phone, session.account); show(createStaffView); }
    },
    onError(error, role) { login.role = role || login.role; login.error = loginErrorMessage(error); login.busy = false; showLogin(); }
  });
  }

  /* ---------- login screen ---------- */
  function showLogin() {
    clearTimeout(win.__bootTimer);
    // Dobara banane par likha hua number/password na mite
    const kept = {}; for (const el of root.querySelectorAll('form[data-form=login] input')) if (el.name) kept[el.name] = el.value;
    const focused = doc.activeElement?.closest?.('form[data-form=login]') ? doc.activeElement.name : '';
    queueMicrotask(() => { for (const [k, v] of Object.entries(kept)) { const el = root.querySelector(`form[data-form=login] input[name="${k}"]`); if (el && !el.value) el.value = v; } if (focused) root.querySelector(`form[data-form=login] input[name="${focused}"]`)?.focus(); });
    root.dataset.screen = 'login';
    const staff = login.role === 'staff';
    root.innerHTML = `<main class="login">
      <div class="login-card">
        <div class="login-brand"><span class="brand-mark lg" aria-hidden="true">NT</span><h1>Noor Traders</h1><p>Hazri aur salary ka register</p></div>
        <div class="switch full" role="tablist" aria-label="Kaun login kar raha hai"><button type="button" role="tab" aria-selected="${staff}" data-action="login-role" data-arg="staff">Staff</button><button type="button" role="tab" aria-selected="${!staff}" data-action="login-role" data-arg="owner">Malik</button></div>
        <form class="form" data-form="login" novalidate>
          ${staff
            ? `<label>Apna mobile number<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="03001234567" maxlength="16" required ${login.busy ? 'disabled' : ''}></label>
               <p class="hint">Wohi number likhein jo malik ne Staff list mein likha hai. Password ki zaroorat nahi.</p>`
            : `<label>Password<span class="pass"><input name="password" type="${login.showPass ? 'text' : 'password'}" autocomplete="current-password" required ${login.busy ? 'disabled' : ''}><button type="button" class="link" data-action="login-show">${login.showPass ? 'Chhupayein' : 'Dikhayein'}</button></span></label>
               <details><summary>Email se login (ikhtiyari)</summary><label>Email<input name="username" type="email" autocomplete="username" placeholder="khali = admin" ${login.busy ? 'disabled' : ''}></label></details>`}
          <p class="login-error" role="alert" ${login.error ? '' : 'hidden'}>${esc(login.error)}</p>
          <button class="btn btn-primary btn-xl" ${login.busy ? 'disabled' : ''}>${login.busy ? 'Check ho raha hai…' : 'Login'}</button>
          ${login.busy ? '<p class="hint center">Kamzor internet par 10-20 second lag sakte hain. Button dobara na dabayein.</p>' : ''}
        </form>
      </div>
      <p class="foot">${APP_VERSION} &nbsp; <button type="button" class="link" data-action="app-update">Update check karein</button></p>
    </main>`;
  }
  async function submitLogin(form) {
    const v = formValues(form);
    await doLogin(login.role === 'staff' ? { role: 'staff', password: v.phone } : { role: 'owner', username: v.username, password: v.password }, v.phone || '');
  }
  async function doLogin(input, phoneDraft = '') {
    if (login.busy) return;
    login.busy = true; login.error = ''; login.phoneDraft = phoneDraft;
    showLogin();
    const phoneInput = $('input[name=phone]', root); if (phoneInput) phoneInput.value = login.phoneDraft;
    try {
      if (!(await ready)) throw Object.assign(new Error('sdk'), { code: 'auth/network-request-failed' });
      await controller.login(input);
    } catch (error) {
      login.busy = false; login.error = loginErrorMessage(error); showLogin();
      const again = $('input[name=phone]', root); if (again) again.value = login.phoneDraft;
    }
  }

  /* ---------- render ---------- */
  function render(options = {}) {
    if (!view) return;
    dirty = false;
    const scroll = win.scrollY;
    root.innerHTML = view.render();
    if (firstPaint) {
      firstPaint = false;
      try { doc.documentElement.classList.remove('is-snap'); } catch { /* ignore */ }
      const t0 = Number(win.__ntT0) || 0, now = win.performance?.now?.() || 0;
      if (data?.state && t0 && now > t0) data.state.bootMs = Math.round(now - t0);
    }
    clearTimeout(snapTimer);
    snapTimer = setTimeout(saveSnap, 900);
    if (options.keepFocus?.dataset?.input) { const el = $(`[data-input="${options.keepFocus.dataset.input}"]`, root); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* search type */ } } }
    if (scroll) win.scrollTo?.(0, scroll);
  }
  /** Screen ki tasveer phone mein rakho (agli dafa foran dikhane ke liye). Sheets / login is mein nahi. */
  function saveSnap() {
    try {
      if (!view || !['staff', 'owner', 'manager'].includes(root.dataset.screen)) return;
      const html = root.innerHTML;
      if (html.length > 300000) { storage?.removeItem(SNAP_KEY); return; }
      storage?.setItem(SNAP_KEY, JSON.stringify({ v: APP_VERSION, role: root.dataset.screen, html, at: Date.now() }));
    } catch { /* jagah na ho to chup */ }
  }
  /** Data badalne par screen taza hoti hai, lekin agar koi kuch likh raha ho to us ka likha hua nahi mit-ta. */
  function softRender() {
    if (!view) return;
    const active = doc.activeElement;
    if (active && FIELD.test(active.tagName) && root.contains(active)) { dirty = true; return; }
    render();
  }
  doc.addEventListener('focusout', () => { if (dirty) setTimeout(() => { if (dirty) softRender(); }, 150); });
  win.setInterval?.(() => { if (view && doc.visibilityState !== 'hidden') { softRender(); refreshSheets(); } }, 60000);
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && view) { softRender(); refreshSheets(); } });

  /* ---------- aik hi jagah se saare buttons / forms ---------- */
  const shellActions = {
    'login-role'(el) { login.role = el.dataset.arg; login.error = ''; showLogin(); },
    'login-show'() { const input = $('input[name=password]', root), value = input?.value || ''; login.showPass = !login.showPass; showLogin(); const next = $('input[name=password]', root); if (next) { next.value = value; next.focus(); } },
    'app-update'() { void checkUpdate(true); }
  };
  doc.addEventListener('click', event => {
    const el = event.target.closest?.('[data-action]'); if (!el || el.disabled) return;
    const fn = view?.actions[el.dataset.action] || shellActions[el.dataset.action];
    if (!fn) { if (!view && root.dataset.screen === 'snapshot') { event.preventDefault(); toast('Ek second — app taza ho rahi hai…', 'ok'); } return; }
    event.preventDefault();
    Promise.resolve().then(() => fn(el, event)).catch(error => { console.error(error); toast(errorText(error), 'bad'); });
  });
  doc.addEventListener('submit', event => {
    const form = event.target.closest?.('form[data-form]'); if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'login') { void submitLogin(form); return; }
    if (!form.checkValidity?.() && !form.noValidate) { form.reportValidity?.(); return; }
    const fn = view?.forms[form.dataset.form]; if (!fn) return;
    const button = event.submitter || $('button:not([type=button])', form);
    Promise.resolve().then(() => fn(form, formValues(form), button)).catch(error => { console.error(error); toast(errorText(error), 'bad'); });
  });
  doc.addEventListener('change', event => { const el = event.target.closest?.('[data-change]'); if (el) view?.changes?.[el.dataset.change]?.(el); });
  doc.addEventListener('input', event => { const el = event.target.closest?.('[data-input]'); if (el) view?.inputs?.[el.dataset.input]?.(el); });

  /* ---------- v207: home screen par install ---------- */
  let installEvent = null;
  win.addEventListener?.('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; if (view) softRender(); });
  win.addEventListener?.('appinstalled', () => { installEvent = null; try { storage?.setItem('nt-hazri-installed', '1'); } catch { /* ignore */ } toast('App home screen par lag gayi. Ab wahan se kholein.', 'ok'); if (view) softRender(); });
  const install = {
    get standalone() { try { return !!(win.matchMedia?.('(display-mode: standalone)')?.matches || win.navigator?.standalone); } catch { return false; } },
    get canPrompt() { return !!installEvent; },
    get dismissed() { try { return Number(storage?.getItem('nt-hazri-install-later') || 0) > Date.now(); } catch { return false; } },
    later() { try { storage?.setItem('nt-hazri-install-later', String(Date.now() + 3 * 86400000)); } catch { /* ignore */ } },
    async prompt() {
      if (!installEvent) return false;
      const e = installEvent; installEvent = null;
      try { await e.prompt(); const r = await e.userChoice; return r?.outcome === 'accepted'; } catch { return false; }
    }
  };

  /* ---------- update ---------- */
  const newer = (a, b) => (parseInt(String(a).replace(/\D/g, ''), 10) || 0) > (parseInt(String(b).replace(/\D/g, ''), 10) || 0);
  async function checkUpdate(manual = false) {
    try {
      const res = await win.fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('version');
      const latest = (await res.json()).version;
      if (!newer(latest, APP_VERSION)) { if (manual) toast('App bilkul taza hai (' + APP_VERSION + ')', 'ok'); return; }
      const guard = 'nt-hazri-updated-to';
      if (!manual && storage?.getItem(guard) === latest) return; // aik version ke liye sirf aik dafa khud reload
      try { storage?.setItem(guard, latest); } catch { /* ignore */ }
      toast('Nayi version ' + latest + ' aa rahi hai…');
      try { const keys = await win.caches?.keys?.() || []; await Promise.all(keys.map(k => win.caches.delete(k))); } catch { /* ignore */ }
      try { const regs = await win.navigator.serviceWorker?.getRegistrations?.() || []; await Promise.all(regs.map(r => r.update())); } catch { /* ignore */ }
      win.location.reload();
    } catch { if (manual) toast('Internet nahi mila. Thori der baad dobara dekhein.', 'bad'); }
  }
  if (win.navigator?.serviceWorker && /^https?:$/.test(win.location?.protocol || '')) {
    win.navigator.serviceWorker.register('./sw.js').catch(() => { /* app SW ke baghair bhi chalti hai */ });
  }
  win.setTimeout?.(() => checkUpdate(false), 1500);

  return { get data() { return data; }, get controller() { return controller; }, ready, render, get view() { return view; } };
}

function safeLocalStorage() { try { const s = window.localStorage; s.getItem('x'); return s; } catch { return null; } }
