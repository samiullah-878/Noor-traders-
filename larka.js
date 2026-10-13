// larka.js — v2.99.69: 👦 LARKA SALE REPORT (sirf malik) — PC ki larka-report (larka-report.html) ab app mein
// Data: PC ki larka-stats.js har 5 minute POS se nikaal kar posStats/larka (din-wise total, shuru se) aur posStats/larka-bills
//       (bills ki list: larka 90 din, POS user 3 din) likhti hai — dono mein j = JSON ki string. Screen khuli ho to khud taza hoti hai.
//   sum:   { larka: { men:[{id,name}], days:[[din,id,bills,total]], bina:[[din,bills,total]] }, user: { men, days } }
//   bills: { larka: { from, days, bills:[[billNo,din,waqt,id,total,udhaar,customer]] }, user: {...} }
// Larka (SP Man) = POS Sale screen par chuna hua larka · POS user = jis login se bill bana. Cancel bills nahi ginay jate.
// Screen: Larka / POS user · naam · tareekh (se / tak) + Aaj / Kal / hafta / mahina chips · kul · Din / Hafta / Mahina-wise · bills.
// PDF: app ka openReportPreview (poori screen + WhatsApp / share). App kuch LIKHTI nahi — sirf parhti hai.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK').format(Math.round(Number(n) || 0));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Itwaar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'];
const p2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const toDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return dayOf(d); };
const weekStart = s => addDays(s, -((toDate(s).getDay() + 6) % 7));   // hafta Peer se Itwaar
const monthStart = s => s.slice(0, 8) + '01';
const short = s => `${+s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]}`;
const nice = s => `${short(s)} ${s.slice(0, 4)}`;
const span = (a, b) => a === b ? nice(a) : `${a.slice(0, 4) === b.slice(0, 4) ? short(a) : nice(a)} – ${nice(b)}`;
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

const MODES = {
  larka: { label: '👦 Larka (SP Man)', word: 'Larka', all: 'Sab larke' },
  user: { label: '🖥 POS user', word: 'POS user', all: 'Sab users',
    note: 'POS user = jis login se bill bana. Administrator mein Blue Khata app se bane bills bhi shamil hain. "stock fraq" ke bills is ginti mein nahi.' } };
const VIEWS = [['din', 'Din-wise'], ['hafta', 'Hafta-wise'], ['mahina', 'Mahina-wise']];
const KEY = { din: d => d, hafta: weekStart, mahina: d => d.slice(0, 7) };
const LABEL = {
  din: k => `${nice(k)} · ${DAYS[toDate(k).getDay()]}`,
  hafta: k => span(k, addDays(k, 6)),
  mahina: k => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` };
const MAX_ROWS = 120, MAX_BILLS = 300, STALE = 20 * 60000;

let cloud = null, notice = () => {}, pdfOf = null;
let data = { sum: null, bills: null, at: 0 }, stop = null, tick = null, loaded = false, err = '';
const st = { by: 'larka', man: 'all', from: '', to: '', view: 'din', bills: false };

export function larkaSetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; pdfOf = o.pdf || pdfOf; }
export function larkaStop() { if (stop) { try { stop(); } catch {} stop = null; } clearInterval(tick); tick = null; }
function watch() {
  if (!stop) {
    loaded = false; err = '';
    stop = cloud?.listenLarka ? cloud.listenLarka(x => { data = x || data; err = x?.err || ''; loaded = true; paint(); }) : null;
    if (!stop) { loaded = true; err = 'app purani hai'; }
  }
  if (!tick) tick = setInterval(() => { if ($('lkRoot')) paintAge(); else larkaStop(); }, 30000);
}

const today = () => dayOf(new Date());
const S = () => {
  const s = data.sum?.[st.by] || {}, b = data.bills?.[st.by] || {};
  return { ...MODES[st.by], men: Array.isArray(s.men) ? s.men : [], days: Array.isArray(s.days) ? s.days : [], bina: Array.isArray(s.bina) ? s.bina : [],
    bills: Array.isArray(b.bills) ? b.bills : [], billsFrom: isDay(b.from) ? b.from : '', billDays: Number(b.days) || 0 };
};
const bounds = s => { const t = today(); return [s.days.reduce((a, r) => (r[0] < a ? r[0] : a), t), s.days.reduce((a, r) => (r[0] > a ? r[0] : a), t)]; };
const quick = s => { const t = today(), [first, last] = bounds(s); return [
  ['Aaj', t, t], ['Kal', addDays(t, -1), addDays(t, -1)],
  ['Is hafte', weekStart(t), t], ['Pichhla hafta', addDays(weekStart(t), -7), addDays(weekStart(t), -1)],
  ['Is mahine', monthStart(t), t], ['Pichhla mahina', monthStart(addDays(monthStart(t), -1)), addDays(monthStart(t), -1)],
  ['Shuru se', first, last]]; };
function firstRange(s) {   // is mahine sale ho to yeh mahina, warna shuru se
  const t = today(), [first, last] = bounds(s), now = s.days.some(r => r[0] >= monthStart(t));
  st.from = now ? monthStart(t) : first; st.to = now ? t : last;
}

const put = (map, id, n, t) => { const o = map.get(id) || { n: 0, t: 0 }; o.n += n; o.t += t; map.set(id, o); };
const sum = map => { const o = { n: 0, t: 0 }; for (const v of map.values()) { o.n += v.n; o.t += v.t; } return o; };
function build() {
  const s = S();
  if (!isDay(st.from) || !isDay(st.to)) firstRange(s);
  if (st.from > st.to) [st.from, st.to] = [st.to, st.from];
  if (st.man !== 'all' && !s.men.some(m => String(m.id) === st.man)) st.man = 'all';
  const men = st.man === 'all' ? s.men : s.men.filter(m => String(m.id) === st.man);
  const ids = new Set(men.map(m => m.id)), nameOf = new Map(s.men.map(m => [m.id, m.name]));
  const rows = s.days.filter(r => r[0] >= st.from && r[0] <= st.to && ids.has(r[1]));
  const per = new Map(); for (const r of rows) put(per, r[1], r[2], r[3]);
  const all = sum(per);
  const sold = men.filter(m => per.get(m.id)?.n).sort((a, b) => per.get(b.id).t - per.get(a.id).t), idle = men.filter(m => !per.get(m.id)?.n);
  const by = new Map();
  for (const r of rows) { const k = KEY[st.view](r[0]); if (!by.has(k)) by.set(k, new Map()); put(by.get(k), r[1], r[2], r[3]); }
  const keys = [...by.keys()].sort().reverse();
  const bina = { n: 0, t: 0 };
  if (st.man === 'all') for (const r of s.bina) if (r[0] >= st.from && r[0] <= st.to) { bina.n += r[1]; bina.t += r[2]; }
  const bills = s.bills.filter(b => b[1] >= st.from && b[1] <= st.to && ids.has(b[3]));
  return { s, men, sold, idle, nameOf, per, all, by, keys, bina, bills, who: st.man === 'all' ? s.all : (nameOf.get(men[0]?.id) || '') };
}

const ageText = () => {
  if (!data.at) return ['', false];
  const m = Math.max(0, Math.round((Date.now() - data.at) / 60000)), old = Date.now() - data.at > STALE;
  const when = new Date(data.at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) + (dayOf(new Date(data.at)) === today() ? '' : ' · ' + nice(dayOf(new Date(data.at))));
  return [old ? `⚠ PC se ${m >= 120 ? Math.round(m / 60) + ' ghante' : m + ' min'} se naya data nahi aaya (aakhri: ${when}) — PC / internet check karein`
    : `🔄 PC se update: ${when}${m ? ' · ' + m + ' min pehle' : ' · abhi'} — har 5 minute khud taza`, old];
};
function paintAge() { const el = $('lkAge'); if (!el) return; const [t, old] = ageText(); el.textContent = t; el.classList.toggle('warn', old); }

const chips = (list, attr, on) => `<div class="mchips">${list.map(([k, l]) => `<button type="button" class="rc${on(k) ? ' on' : ''}" ${attr}="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
function paint() {
  const root = $('lkRoot'); if (!root) return;
  if (!loaded) { root.innerHTML = '<div class="nt-empty">⏳<b>Report aa rahi hai…</b></div>'; return; }
  if (!data.sum) {
    root.innerHTML = `<div class="nt-empty">👦<b>${err ? 'Report nahi khuli' : 'PC se abhi data nahi aaya'}</b><small>${err ? esc(err === 'permission-denied' ? 'Is login ko ijazat nahi (sirf malik)' : err)
      : 'Dukan ke PC par larka-stats (KHATA-DOCTOR) chalni chahiye — 5 minute mein khud aa jayega'}</small></div>`;
    return;
  }
  const r = build(), s = r.s, [age, old] = ageText(), q = quick(s);
  const line = (m, o) => `<div class="lk-line"><span>${esc(m.name)}</span><small>${num(o.n)} bill</small><b>Rs ${num(o.t)}</b></div>`;
  const shown = r.keys.slice(0, MAX_ROWS), list = r.bills.slice(0, MAX_BILLS);
  root.innerHTML = `<div class="bc-head">
    ${chips(Object.entries(MODES).map(([k, m]) => [k, m.label]), 'data-lk-by', k => k === st.by)}
    <div class="lk-filter">
      <label>${esc(s.word)}<select data-lk-man><option value="all">${esc(s.all)}</option>${s.men.map(m => `<option value="${esc(m.id)}"${String(m.id) === st.man ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label>Tareekh se<input type="date" data-lk-from value="${esc(st.from)}"></label>
      <label>Tareekh tak<input type="date" data-lk-to value="${esc(st.to)}"></label>
    </div>
    ${chips(q.map((x, i) => [i, x[0]]), 'data-lk-q', i => q[i][1] === st.from && q[i][2] === st.to)}
    <div class="bc-kpis lk-kpis"><div><b>Rs ${num(r.all.t)}</b><small>total sale</small></div><div><b>${num(r.all.n)}</b><small>bills</small></div><div><b>${r.all.n ? num(r.all.t / r.all.n) : '–'}</b><small>fi bill</small></div></div>
    <p class="lk-age${old ? ' warn' : ''}" id="lkAge">${esc(age)}</p></div>
  <div class="bc-day"><div class="bc-dayhead"><b>${esc(r.who)}</b><span>${esc(span(st.from, st.to))}</span></div>
    ${r.sold.map(m => { const o = r.per.get(m.id), pc = r.all.t > 0 ? Math.max(0, Math.round(o.t / r.all.t * 100)) : 0;
      return `<div class="bc-item lk-man"><div class="lk-row"><b>${esc(m.name)}</b><small>${num(o.n)} bill${r.men.length > 1 ? ' · hissa ' + pc + '%' : ''}</small><b class="bc-cnt">Rs ${num(o.t)}</b></div>${r.men.length > 1 ? `<i class="lk-bar"><u style="width:${Math.min(100, pc)}%"></u></i>` : ''}</div>`; }).join('')
      || '<div class="nt-empty">🧾<b>In tareekhon mein koi bill nahi</b><small>Upar se tareekh ya naam badal kar dekhein</small></div>'}
    ${r.sold.length && r.idle.length ? `<p class="lk-idle">Koi bill nahi: ${esc(r.idle.map(m => m.name).join(', '))}</p>` : ''}
    ${r.bina.n ? `<p class="lk-note">${num(r.bina.n)} bills (Rs ${num(r.bina.t)}) larke ke naam ke baghair bane hain — yeh upar ki ginti mein shamil nahi.</p>` : ''}
    ${s.note ? `<p class="lk-note">${esc(s.note)}</p>` : ''}</div>
  ${r.keys.length ? `<div class="lk-sec"><b>Tafseel</b>${chips(VIEWS, 'data-lk-v', k => k === st.view)}</div>
    ${shown.map(k => { const m = r.by.get(k), t = sum(m);
      return `<div class="bc-day"><div class="bc-dayhead"><b>${esc(LABEL[st.view](k))}</b><span>${num(t.n)} bill · Rs ${num(t.t)}</span></div>${r.men.length > 1 ? `<div class="bc-item lk-lines">${r.men.filter(x => m.get(x.id)?.n).sort((a, b) => m.get(b.id).t - m.get(a.id).t).map(x => line(x, m.get(x.id))).join('')}</div>` : ''}</div>`; }).join('')}
    ${r.keys.length > shown.length ? `<p class="lk-idle">Pehle ${MAX_ROWS} dikhaye gaye hain — tareekh chhoti karein ya Hafta / Mahina-wise dekhein.</p>` : ''}` : ''}
  <div class="lk-sec"><b>Bills (${num(r.bills.length)})</b><button type="button" class="rc${st.bills ? ' on' : ''}" data-lk-bills="1">${st.bills ? 'Chhupayein' : '🧾 Dikhayein'}</button></div>
  ${s.billsFrom && st.from < s.billsFrom ? `<p class="lk-idle">Bills ki list sirf ${esc(nice(s.billsFrom))} se hai (pichhle ${num(s.billDays)} din). Upar ke total poore hain.</p>` : ''}
  ${!st.bills ? '' : !data.bills ? '<p class="lk-idle">Bills ki list aa rahi hai…</p>' : !list.length ? '<p class="lk-idle">In tareekhon mein list mein koi bill nahi.</p>'
    : `${r.bills.length > list.length ? `<p class="lk-idle">Pehle ${MAX_BILLS} bills dikhaye gaye hain — tareekh ya ${esc(s.word.toLowerCase())} chun kar chhota karein.</p>` : ''}
      <div class="bc-item lk-lines">${list.map(b => `<div class="lk-bill"><b>${esc(b[0])}</b><span>${esc(r.nameOf.get(b[3]) || '')}</span><b>Rs ${num(b[4])}</b><small>${esc(short(b[1]))} ${esc(b[2])} · ${esc(b[6])}${b[5] ? ' · <em>udhaar</em>' : ''}</small></div>`).join('')}</div>`}`;
}

function pdfHTML() {
  const r = build(), s = r.s, multi = r.men.length > 1;
  return `<h1>NOOR TRADERS</h1><h2>👦 Larka sale report — ${esc(s.label.replace(/^\S+\s/, ''))} · ${esc(r.who)}</h2>
    <p>${esc(span(st.from, st.to))} · ${num(r.all.n)} bills · Rs ${num(r.all.t)} · ${esc(new Date().toLocaleString('en-PK'))}</p>
    <table class="iv-tbl"><thead><tr><th>${esc(s.word)}</th><th>Bills</th><th>Total sale</th><th>Hissa</th></tr></thead><tbody>
      ${r.sold.map(m => { const o = r.per.get(m.id); return `<tr><td class="iv-item"><b>${esc(m.name)}</b></td><td class="iv-n">${num(o.n)}</td><td class="iv-n"><b>${num(o.t)}</b></td><td class="iv-n">${r.all.t > 0 ? Math.round(o.t / r.all.t * 100) + '%' : ''}</td></tr>`; }).join('')}
      ${multi ? `<tr><td class="iv-item"><b>Kul</b></td><td class="iv-n"><b>${num(r.all.n)}</b></td><td class="iv-n"><b>${num(r.all.t)}</b></td><td></td></tr>` : ''}</tbody></table>
    ${r.bina.n ? `<p>${num(r.bina.n)} bills (Rs ${num(r.bina.t)}) larke ke naam ke baghair bane — upar shamil nahi.</p>` : ''}
    <h3>${esc(VIEWS.find(v => v[0] === st.view)[1])}</h3>
    <table class="iv-tbl"><thead><tr><th></th>${multi ? `<th>${esc(s.word)}</th>` : ''}<th>Bills</th><th>Total sale</th></tr></thead><tbody>
      ${r.keys.slice(0, MAX_ROWS).map(k => { const m = r.by.get(k), t = sum(m), lab = esc(LABEL[st.view](k));
        return !multi ? `<tr><td class="iv-item">${lab}</td><td class="iv-n">${num(t.n)}</td><td class="iv-n"><b>${num(t.t)}</b></td></tr>`
          : r.men.filter(x => m.get(x.id)?.n).map((x, i) => `<tr><td class="iv-item">${i ? '' : '<b>' + lab + '</b>'}</td><td>${esc(x.name)}</td><td class="iv-n">${num(m.get(x.id).n)}</td><td class="iv-n">${num(m.get(x.id).t)}</td></tr>`).join('')
            + `<tr><td></td><td class="iv-n"><small>kul</small></td><td class="iv-n"><b>${num(t.n)}</b></td><td class="iv-n"><b>${num(t.t)}</b></td></tr>`; }).join('')}</tbody></table>`;
}

export function renderLarka() {
  watch();
  $('summary').innerHTML = '<div class="bc-root" id="lkRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-lk-pdf="1">📄 PDF · WhatsApp</button>';
  paint();
}

document.addEventListener('click', e => {
  if (e.target.closest?.('[data-lk-pdf]')) { if (!data.sum) { notice('Report abhi nahi aayi'); return; } const r = build(); if (!r.all.n) { notice('In tareekhon mein koi bill nahi'); return; } if (pdfOf) pdfOf(pdfHTML(), `Larka sale ${st.from} se ${st.to}`); return; }
  if (!$('lkRoot')) return;
  const t = e.target.closest?.('[data-lk-by],[data-lk-q],[data-lk-v],[data-lk-bills]'); if (!t) return;
  const d = t.dataset;
  if (d.lkBy && MODES[d.lkBy]) { if (st.by !== d.lkBy) { st.by = d.lkBy; st.man = 'all'; } }
  else if (d.lkQ != null) { const q = quick(S())[+d.lkQ]; if (q) { st.from = q[1]; st.to = q[2]; } }
  else if (d.lkV && KEY[d.lkV]) st.view = d.lkV;
  else if (d.lkBills) st.bills = !st.bills;
  paint();
});
document.addEventListener('change', e => {
  const t = e.target; if (!t?.matches || !$('lkRoot')) return;
  if (t.matches('[data-lk-man]')) st.man = t.value || 'all';
  else if (t.matches('[data-lk-from]')) { if (isDay(t.value)) st.from = t.value; }
  else if (t.matches('[data-lk-to]')) { if (isDay(t.value)) st.to = t.value; }
  else return;
  paint();
});
