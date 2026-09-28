// ui.js — chhote UI auzaar jo malik aur staff dono screens istemal karti hain.
import { esc, SHOP, haversine, hasArabic, parseTime, fmtTime, pkTime24 } from './core.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  out: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h11v4"/><path d="M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2z"/><circle cx="16" cy="14" r="1.2"/>',
  people: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.4A5 5 0 0 1 20.5 19"/>',
  alert: '<path d="M12 4 3 19h18z"/><path d="M12 10v4M12 17h.01"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  note: '<path d="M6 4h12v16l-3-2-3 2-3-2-3 2z"/><path d="M9 9h6M9 13h6"/>', share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  down: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>', phone: '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>'
};
export function icon(name, size = 20) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
}
/** Urdu lipi wala matn apne font aur dir ke sath. */
export function nameHtml(text) {
  const t = String(text ?? '');
  return hasArabic(t) ? `<span class="ur" dir="rtl" lang="ur">${esc(t)}</span>` : esc(t);
}
export function avatar(account, size = '') {
  const name = String(account?.name || '?').trim();
  const initials = hasArabic(name) ? name.slice(0, 1) : name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  return account?.photo
    ? `<span class="avatar ${size}"><img src="${esc(account.photo)}" alt="" loading="lazy"></span>`
    : `<span class="avatar ${size}" aria-hidden="true">${esc(initials || '?')}</span>`;
}

/* ---------- toast ---------- */
let toastTimer;
export function toast(message, kind = '') {
  const el = $('#toast'); if (!el) return;
  el.textContent = message; el.className = 'toast show ' + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'bad' ? 6000 : 3200);
}
export function errorText(error) {
  if (!error) return 'Kuch ghalat ho gaya. Dobara koshish karein.';
  if (error.code === 'permission-denied') return 'Ijazat nahi mili. Login dobara karein; phir bhi na ho to Firestore rules check karein.';
  if (['unavailable', 'deadline-exceeded', 'app/slow-network'].includes(error.code)) return 'Internet kamzor hai. Signal check kar ke dobara koshish karein.';
  return error.message || 'Kuch ghalat ho gaya. Dobara koshish karein.';
}
/** Button ko masroof dikhata hai, ghalti ho to saaf paigham. */
export async function busy(button, fn, doneMessage = '') {
  const label = button?.innerHTML;
  if (button) { if (button.disabled) return; button.disabled = true; button.classList.add('is-busy'); }
  try { const result = await fn(); if (doneMessage) toast(doneMessage, 'ok'); return result; }
  catch (error) { console.error(error); toast(errorText(error), 'bad'); return undefined; }
  finally { if (button?.isConnected) { button.disabled = false; button.classList.remove('is-busy'); button.innerHTML = label; } }
}

/* ---------- v217: kamyabi ki animation (Check-In / Check-Out / Wapsi) ----------
   Sirf tab chalti hai jab SERVER ne qubool kar liya ho. #app ke bahar body par lagti hai — app ki screen har
   data par dobara banti hai, is liye animation beech mein nahi tootti. Tone: ok (hazir) | late | out (chutti) | back (wapsi). */
let fxTimer = 0;
const reduceMotion = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; } };
export function celebrate({ tone = 'ok', stamp = '', title = '', sub = '', count = null, chip = '', vibrate = [28, 70, 40], stay = 4600 } = {}) {
  const body = document.body; if (!body) return null;
  document.querySelector('.fx')?.remove(); clearTimeout(fxTimer);
  const el = document.createElement('div');
  el.className = 'fx fx-' + tone; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `<div class="fx-card">
      <svg class="fx-mark" viewBox="0 0 72 72" aria-hidden="true"><circle class="fx-ring" cx="36" cy="36" r="31"/><path class="fx-tick" d="M22 37.5l9.5 9.5L51 27"/></svg>
      <p class="fx-title"><bdi>${esc(title)}</bdi></p>
      ${count ? `<p class="fx-count">${esc(count.fmt(reduceMotion() ? count.to : 0))}</p>` : ''}
      ${stamp ? `<span class="fx-stamp" aria-hidden="true">${esc(stamp)}</span>` : ''}
      ${sub ? `<p class="fx-sub">${esc(sub)}</p>` : ''}
      ${chip ? `<p class="fx-chip">${esc(chip)}</p>` : ''}
      <button type="button" class="btn btn-ghost fx-ok">Theek hai</button>
    </div>`;
  let gone = false;
  const close = () => { if (gone) return; gone = true; clearTimeout(fxTimer); el.classList.add('is-out'); setTimeout(() => el.remove(), 280); };
  el.addEventListener('click', close);
  el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  body.appendChild(el);
  try { el.querySelector('.fx-ok')?.focus({ preventScroll: true }); } catch { /* ignore */ }
  try { navigator.vibrate?.(vibrate); } catch { /* ignore */ }
  // ghante 0 se gin kar poore (1.1 second), check ka nishan banne ke baad
  const out = el.querySelector('.fx-count');
  if (out && !reduceMotion() && count.to > 0) {
    const raf = window.requestAnimationFrame || (f => setTimeout(() => f(Date.now()), 16));
    const t0 = Date.now() + 480, dur = 1100;
    const tickFn = () => {
      if (gone) return;
      const k = Math.min(1, Math.max(0, (Date.now() - t0) / dur)), eased = 1 - Math.pow(1 - k, 3);
      out.textContent = count.fmt(Math.round(count.to * eased));
      if (k < 1) raf(tickFn);
    };
    raf(tickFn);
  }
  fxTimer = setTimeout(close, stay);
  return el;
}

/* ---------- v220: tasveer poori screen par (tap / Escape / "Band karein" se band) ---------- */
export function viewImage(src, title = '') {
  document.querySelector('.viewer')?.remove();
  const el = document.createElement('div');
  el.className = 'viewer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title || 'Tasveer');
  el.innerHTML = `<img src="${esc(src)}" alt="${esc(title)}"><div class="viewer-bar"><b>${esc(title)}</b><button type="button" class="btn btn-ghost btn-sm">Band karein</button></div>`;
  const close = () => el.remove();
  el.addEventListener('click', close); el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.body.appendChild(el);
  try { el.querySelector('button')?.focus({ preventScroll: true }); } catch { /* ignore */ }
  return el;
}

/* ---------- sheets (neeche se uthne wala panel) ---------- */
const stack = [];
export function openSheet({ title = '', render, wide = false, onClose, id = '' }) {
  const host = $('#sheetHost');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap'; wrap.dataset.sheet = id;
  wrap.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
    <section class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet-head"><h2></h2><button type="button" class="icon-btn" data-sheet-close aria-label="Band karein">${icon('close')}</button></header>
      <div class="sheet-body"></div>
    </section>`;
  const api = {
    id, el: wrap, body: $('.sheet-body', wrap),
    setTitle(t) { $('h2', wrap).innerHTML = t; },
    refresh(force = false) {
      if (!render) return;
      const active = document.activeElement;
      if (!force && active && wrap.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      const scroll = api.body.scrollTop; api.body.innerHTML = render(api); api.body.scrollTop = scroll;
    },
    close() {
      const i = stack.indexOf(api); if (i < 0) return;
      stack.splice(i, 1); wrap.remove(); onClose?.();
      if (!stack.length) document.body.classList.remove('sheet-open');
    }
  };
  api.setTitle(title);
  wrap.addEventListener('click', e => { if (e.target.closest('[data-sheet-close]')) api.close(); });
  host.append(wrap); stack.push(api); document.body.classList.add('sheet-open');
  api.refresh(true);
  requestAnimationFrame(() => wrap.classList.add('in'));
  return api;
}
export function refreshSheets() { for (const s of [...stack]) s.refresh(); }
export function closeSheets() { for (const s of [...stack]) s.close(); }
export function topSheet() { return stack[stack.length - 1] || null; }
if (typeof document !== 'undefined') document.addEventListener('keydown', e => { if (e.key === 'Escape') topSheet()?.close(); });

export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

/* ---------- tasveer ---------- */
export function fileToDataUrl(file, max = 420, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Tasveer parhi nahi ja saki.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Tasveer khul nahi saki.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
/** Live camera se selfie (gallery se purani tasveer nahi lag sakti). Camera na khule to phone ka camera app khulta hai. */
export function takeSelfie() {
  return new Promise((resolve, reject) => {
    let stream = null, done = false;
    const finish = (value, error) => { if (done) return; done = true; try { stream?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ } sheet.close(); error ? reject(error) : resolve(value); };
    const sheet = openSheet({
      title: 'Selfie lein', id: 'selfie',
      render: () => `<div class="cam"><video id="camVideo" playsinline autoplay muted></video><p class="hint" id="camHint">Camera khul raha hai…</p>
        <div class="btn-row"><button type="button" class="btn btn-primary btn-lg" id="camShot" disabled>${icon('camera')} Tasveer lein</button></div>
        <input id="camFile" type="file" accept="image/*" capture="user" hidden></div>`,
      onClose: () => finish(null, Object.assign(new Error('Selfie nahi li gayi.'), { code: 'app/cancelled' }))
    });
    const video = $('#camVideo', sheet.el), shot = $('#camShot', sheet.el), hint = $('#camHint', sheet.el), file = $('#camFile', sheet.el);
    file.onchange = async () => { const f = file.files?.[0]; if (!f) return; try { finish(await fileToDataUrl(f, 320, 0.62)); } catch (e) { finish(null, e); } };
    const fallback = () => { hint.textContent = 'Camera seedha nahi khula. Neeche button se phone ka camera kholein.'; video.hidden = true; shot.disabled = false; shot.innerHTML = icon('camera') + ' Camera kholein'; shot.onclick = () => file.click(); };
    shot.onclick = () => {
      const size = Math.min(video.videoWidth, video.videoHeight) || 320, scale = Math.min(1, 320 / size), c = document.createElement('canvas');
      c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      finish(c.toDataURL('image/jpeg', 0.62)); // chhoti selfie = malik ki list jaldi
    };
    if (!navigator.mediaDevices?.getUserMedia) { fallback(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false }).then(s => {
      if (done) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; video.srcObject = s; hint.textContent = 'Chehra saaf nazar aaye, phir button dabayein.';
      video.onloadedmetadata = () => { shot.disabled = false; };
    }).catch(fallback);
  });
}

/* ---------- GPS ---------- */
function position(options) { return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options)); }
export async function getGps() {
  if (!navigator.geolocation) throw new Error('Is phone/browser mein location ki sahulat nahi.');
  let p;
  try { p = await position({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }
  catch (error) {
    if (error.code === 1) throw new Error('Location ki ijazat band hai. Browser ki settings mein is site ke liye Location "Allow" karein.');
    try { p = await position({ enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }); }
    catch { throw new Error('Location nahi mili. Phone ka GPS/Location on karein, khuli jagah aa kar dobara dabayein.'); }
  }
  const { latitude: lat, longitude: lng, accuracy } = p.coords;
  return { lat, lng, accuracy, distance: haversine(lat, lng, SHOP.lat, SHOP.lng) };
}

/* ---------- PDF dena (aik ya kai files) ---------- */
export function deliverPdf(input) {
  const list = (Array.isArray(input) ? input : [input]).map(({ doc, blob: given, filename }) => {
    const blob = given || doc.output('blob'), type = blob.type || 'application/pdf';
    return { filename, blob, url: URL.createObjectURL(blob), file: typeof File !== 'undefined' ? new File([blob], filename, { type }) : null };
  });
  const files = list.map(x => x.file).filter(Boolean);
  const canShare = files.length === list.length && !!navigator.canShare?.({ files });
  const many = list.length > 1;
  const sheet = openSheet({
    title: many ? `${list.length} PDF tayyar hain` : /\.xlsx$/.test(list[0].filename) ? 'Excel file tayyar hai' : 'PDF tayyar hai', id: 'pdf',
    render: () => `${canShare ? `<button type="button" class="btn btn-primary btn-lg" id="pdfShare">${icon('share')} ${many ? 'Sab WhatsApp / Share' : 'WhatsApp / Share'}</button>` : ''}
      ${many ? '<p class="hint">WhatsApp mein har larke ki slip alag file ban kar jati hai. Aik aik bhejni ho to neeche wali list se download karein.</p>' : ''}
      <ul class="pdf-list">${list.map(x => `<li><span class="pdf-name">${icon('pdf')} <span>${esc(x.filename)}</span></span>
        <span class="btn-row"><a class="btn ${canShare || many ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${x.url}" download="${esc(x.filename)}">${icon('down', 16)} Download</a><a class="btn btn-ghost btn-sm" href="${x.url}" target="_blank" rel="noopener">Kholein</a></span></li>`).join('')}</ul>`,
    onClose: () => setTimeout(() => list.forEach(x => URL.revokeObjectURL(x.url)), 60000)
  });
  const share = $('#pdfShare', sheet.el);
  if (share) share.onclick = () => navigator.share({ files, title: many ? 'Salary slips' : list[0].filename }).catch(() => { /* user ne band kiya */ });
  return sheet;
}

/* ---------- aasan time picker: Ghanta + Minute + AM/PM + tickets ---------- */
export const IN_TICKETS = ['09:00', '09:15', '09:30', '10:00'];
export const OUT_TICKETS = ['19:00', '19:30', '20:00', '20:30', '21:00'];
const p2 = n => String(n).padStart(2, '0');
function tpParts(v) {
  const m = parseTime(v); if (m == null) return null;
  const h = Math.floor(m / 60), mi = m % 60;
  return { h12: (h % 12) || 12, mi, pm: h >= 12 };
}
/**
 * Waqt chunne ka field. Asal value chhupe input mein "HH:MM" (24 ghante) jati hai, taake form aur Firebase wahi rahen.
 * opts: { label, tickets:[HH:MM], optional:true (khali chhor sakte hain), now:true ("Abhi" ticket) }
 */
export function timeField(name, value, opts = {}) {
  const t = tpParts(value), tickets = [...new Set((opts.tickets || []).filter(Boolean))];
  const hours = Array.from({ length: 12 }, (_, i) => i + 1), mins = Array.from({ length: 60 }, (_, i) => i);
  return `<div class="tp" data-tp data-optional="${opts.optional ? '1' : ''}" data-guess="${opts.guess || ''}">
    ${opts.label ? `<span class="tp-label">${opts.label}</span>` : ''}
    <input type="hidden" name="${esc(name)}" value="${t ? esc(pad24(value)) : ''}">
    <div class="tp-show" aria-live="polite">${t ? esc(fmtTime(value)).toUpperCase() : (opts.optional ? 'Abhi khali' : 'Waqt chunein')}</div>
    <div class="tp-row">
      <select data-tp-h aria-label="Ghanta"><option value="">Ghanta</option>${hours.map(h => `<option value="${h}" ${t?.h12 === h ? 'selected' : ''}>${h}</option>`).join('')}</select>
      <span class="tp-colon">:</span>
      <select data-tp-m aria-label="Minute">${mins.map(m => `<option value="${m}" ${(t ? t.mi : 0) === m ? 'selected' : ''}>${p2(m)}</option>`).join('')}</select>
      <span class="tp-ap" role="group" aria-label="AM ya PM"><button type="button" data-tp-ap="am" aria-pressed="${t ? !t.pm : 'false'}">AM</button><button type="button" data-tp-ap="pm" aria-pressed="${t ? t.pm : 'false'}">PM</button></span>
    </div>
    <div class="tp-tickets">${opts.now ? '<button type="button" data-tp-set="now">Abhi</button>' : ''}${tickets.map(v => `<button type="button" data-tp-set="${v}" aria-pressed="${t && pad24(value) === v}">${esc(fmtTime(v))}</button>`).join('')}${opts.optional ? '<button type="button" data-tp-set="" class="tp-clear">Khali</button>' : ''}</div>
  </div>`;
}
function pad24(v) { const m = parseTime(v); return m == null ? '' : p2(Math.floor(m / 60)) + ':' + p2(m % 60); }
function tpApply(box, value) {
  const hidden = box.querySelector('input[type=hidden]'), show = box.querySelector('.tp-show');
  hidden.value = value;
  const t = tpParts(value);
  box.querySelector('[data-tp-h]').value = t ? String(t.h12) : '';
  box.querySelector('[data-tp-m]').value = String(t ? t.mi : 0);
  for (const b of box.querySelectorAll('[data-tp-ap]')) b.setAttribute('aria-pressed', String(!!t && (b.dataset.tpAp === 'pm') === t.pm));
  for (const b of box.querySelectorAll('[data-tp-set]')) b.setAttribute('aria-pressed', String(!!value && b.dataset.tpSet === value));
  show.textContent = t ? fmtTime(value).toUpperCase() : (box.dataset.optional ? 'Abhi khali' : 'Waqt chunein');
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}
function tpRead(box, forcePm) {
  const h = Number(box.querySelector('[data-tp-h]').value), m = Number(box.querySelector('[data-tp-m]').value || 0);
  if (!h) return '';
  const pressed = box.querySelector('[data-tp-ap][aria-pressed=true]');
  // AM/PM na chuna ho to andaza: jane ka waqt = PM; aane ka waqt = 6-11 AM, 12-5 PM
  const guess = box.dataset.guess, auto = guess === 'out' ? true : guess === 'in' ? (h === 12 || h <= 5) : ((h >= 1 && h <= 7) || h === 12);
  const pm = forcePm ?? (pressed ? pressed.dataset.tpAp === 'pm' : auto);
  const h24 = (h % 12) + (pm ? 12 : 0);
  return p2(h24) + ':' + p2(m);
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-tp] [data-tp-ap], [data-tp] [data-tp-set]'); if (!b) return;
    const box = b.closest('[data-tp]'); e.preventDefault();
    if (b.dataset.tpAp) { if (!box.querySelector('[data-tp-h]').value) box.querySelector('[data-tp-h]').value = b.dataset.tpAp === 'pm' ? '7' : '9'; tpApply(box, tpRead(box, b.dataset.tpAp === 'pm')); }
    else tpApply(box, b.dataset.tpSet === 'now' ? pkTime24() : b.dataset.tpSet);
  });
  document.addEventListener('change', e => {
    const sel = e.target.closest?.('[data-tp] select'); if (!sel) return;
    const box = sel.closest('[data-tp]'); tpApply(box, tpRead(box));
  });
}

/* ---------- Gate Pass ki chalti ghari (har second) ---------- */
if (typeof document !== 'undefined' && typeof setInterval !== 'undefined') {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h12' });
  setInterval(() => { const els = document.querySelectorAll('[data-live-clock]'); if (!els.length) return; const t = fmt.format(new Date()).toUpperCase(); for (const el of els) el.textContent = t; }, 1000);
}
