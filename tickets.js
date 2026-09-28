// tickets.js — "Bina bataye gaya" ka ticket banana. Malik, manager aur senior yahi sheet istemal karte hain.
import { esc, pkTime24 } from './core.js';
import { openSheet, nameHtml, busy, toast, timeField, icon } from './ui.js';

/** people: [{ phone, name, note? }] — jin par ticket ban sakta hai. onCreate({ phone, from, back, note }) */
export function openTicketSheet({ people, onCreate, preset = '' }) {
  const sheet = openSheet({
    id: 'ticket-new', title: 'Bina bataye gaya — ticket',
    render: () => `<form class="form" data-ticket-form>
      <label>Kaun gaya?<select name="phone" required><option value="">Chunein</option>${people.map(p => `<option value="${esc(p.phone)}" ${preset === p.phone ? 'selected' : ''}>${esc(p.name || p.phone)}</option>`).join('')}</select></label>
      ${timeField('from', pkTime24(), { label: 'Kab gaya', now: true })}
      ${timeField('back', '', { label: 'Wapas kab aaya', optional: true, now: true })}
      <p class="hint">Abhi wapas nahi aaya to "Wapas kab aaya" khali chhor dein — baad mein "Wapas aa gaya" dabayein.</p>
      <label>Note <small>(ikhtiyari)</small><input name="note" maxlength="300" placeholder="Maslan: dukaan khuli chhor kar gaya"></label>
      <p class="hint">Faisla (maaf / warning / katauti) sirf malik karega.</p>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">${icon('alert', 18)} Ticket banayein</button></div></form>`
  });
  sheet.el.addEventListener('submit', async e => {
    const form = e.target.closest('[data-ticket-form]'); if (!form) return;
    e.preventDefault(); e.stopPropagation();
    const v = { phone: form.elements.phone.value, from: form.elements.from.value, back: form.elements.back.value, note: form.elements.note.value };
    await busy(form.querySelector('button:not([type=button])'), async () => { await onCreate(v); sheet.close(); toast('Ticket ban gaya — malik faisla karega', 'ok'); });
  }, true);
  void nameHtml;
  return sheet;
}
