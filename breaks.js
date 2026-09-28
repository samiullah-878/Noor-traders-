// breaks.js — khane ka waqfa (roti break). Malik aur manager dono yahi sheet istemal karte hain.
// Waqt har roz badalta hai, is liye har dafa break shuru karte waqt minute chune jate hain.
import { esc, fmtTime, pkTime24, parseTime, BREAK_MINUTES } from './core.js';
import { openSheet, icon, nameHtml, busy, toast } from './ui.js';

const addMin = (hhmm, m) => { const t = (parseTime(hhmm) + m) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

/**
 * people: [{ phone, name, group (1|2), onDuty, busy (pehle se bahar/break) }]
 * onStart(phones, minutes) -> Promise
 */
export function openBreakSheet({ people, onStart, defaultMinutes = 30 }) {
  let minutes = defaultMinutes, group = people.some(p => p.group === 1 && p.onDuty && !p.busy) ? 1 : 2, custom = '';
  const picked = new Set();
  const preset = () => { picked.clear(); for (const p of people) if (p.group === group && p.onDuty && !p.busy) picked.add(p.phone); };
  preset();
  const sheet = openSheet({
    id: 'break', wide: true, title: 'Khane ka waqfa',
    render: () => {
      const back = addMin(pkTime24(), minutes);
      const row = p => `<li><label class="check pick${p.onDuty && !p.busy ? '' : ' is-off'}"><input type="checkbox" data-break-pick="${esc(p.phone)}" ${picked.has(p.phone) ? 'checked' : ''} ${p.onDuty && !p.busy ? '' : 'disabled'}>
        <span><b>${nameHtml(p.name || p.phone)}</b><small>${p.group === 2 ? 'Doosri bari' : 'Pehli bari'}${!p.onDuty ? ' · duty par nahi' : p.busy ? ' · pehle se bahar / break par' : ''}</small></span></label></li>`;
      return `<div class="switch full" role="tablist"><button type="button" role="tab" aria-selected="${group === 1}" data-break-group="1">Pehli bari</button><button type="button" role="tab" aria-selected="${group === 2}" data-break-group="2">Doosri bari</button></div>
        <h3 class="sub">Kitni der ka break?</h3>
        <div class="choice">${BREAK_MINUTES.map(n => `<button type="button" class="chip" data-break-min="${n}" aria-pressed="${minutes === n && !custom}">${n} min</button>`).join('')}
          <label class="inline-min">Apna<input type="number" inputmode="numeric" min="1" max="180" value="${esc(custom)}" data-break-custom placeholder="min"></label></div>
        <p class="break-back">${icon('clock', 18)} Abhi ${fmtTime(pkTime24())} se <b>${minutes} min</b> — <b>${fmtTime(back)}</b> tak wapas</p>
        <h3 class="sub">Kaun jayega? <small>(${picked.size} chune)</small></h3>
        <ul class="pick-list">${people.map(row).join('') || '<li class="muted">Koi staff nahi.</li>'}</ul>
        <p class="hint">Jo larke dukaan sambhalenge un ka nishan hata dein. Un ka break baad mein "Doosri bari" se shuru karein.</p>
        <div class="btn-row sticky"><button type="button" class="btn btn-primary btn-lg" data-break-go ${picked.size ? '' : 'disabled'}>${icon('check', 18)} ${picked.size} ka break shuru karein</button></div>`;
    }
  });
  sheet.el.addEventListener('click', async e => {
    const g = e.target.closest('[data-break-group]'), m = e.target.closest('[data-break-min]'), go = e.target.closest('[data-break-go]');
    if (g) { group = Number(g.dataset.breakGroup); preset(); sheet.refresh(true); }
    else if (m) { minutes = Number(m.dataset.breakMin); custom = ''; sheet.refresh(true); }
    else if (go) {
      await busy(go, async () => { const n = await onStart([...picked], minutes); sheet.close(); toast(`${n} larkon ka ${minutes} min ka break shuru`, 'ok'); });
    }
  });
  sheet.el.addEventListener('change', e => {
    const c = e.target.closest('[data-break-pick]'), cu = e.target.closest('[data-break-custom]');
    if (c) { c.checked ? picked.add(c.dataset.breakPick) : picked.delete(c.dataset.breakPick); sheet.refresh(true); }
    if (cu) { const n = Math.round(Number(cu.value)); if (n >= 1 && n <= 180) { minutes = n; custom = String(n); sheet.refresh(true); } }
  });
  return sheet;
}

/** Abhi break par kaun hai — card (malik aur manager). v211: har naam ke aage waqt; naam dabane se sirf us ki wapsi. */
const pkClock = ms => { if (!ms) return '—'; const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Number(ms))); return fmtTime(t); };
export function breakStatusHtml(open, now = Date.now(), nameOf = o => o.name || o.phone) {
  if (!open.length) return '';
  const left = o => Math.round((Number(o.outAt) + Number(o.minutes) * 60000 - now) / 60000);
  return `<section class="break-card"><div class="break-head">${icon('clock', 20)}<b>${open.length} khane ke break par</b>
      <button type="button" class="btn btn-ghost btn-sm" data-action="break-end-all">Sab wapas aa gaye</button></div>
    <p class="hint">Jo wapas aa jaye us ke naam par dabayein.</p>
    <ul>${open.sort((a, b) => (a.outAt || 0) - (b.outAt || 0)).map(o => { const l = left(o), back = Number(o.outAt) + Number(o.minutes) * 60000;
      return `<li><button type="button" class="b-row" data-action="break-end-one" data-id="${esc(o.id)}"><span><b>${nameHtml(nameOf(o))}</b><small>${pkClock(o.outAt)} gaya · ${pkClock(back)} tak</small></span>
        <span class="${l < 0 ? 'txt-bad' : ''}">${l < 0 ? `${-l} min zyada` : `${l} min baqi`}</span><span class="b-back">Wapas ✓</span></button></li>`; }).join('')}</ul></section>`;
}
