// soye.js — v2.99.32 (2026-10-11): 😴 SOYE HUE KHATE — jin khaton mein X din se koi entry nahi (Due Accounts screen ka doosra chip)
// Malik: "jitna bi khata hain customer ke un sb mein mja aik cheez chahie jin khata main peechla kafi dino se koi entry nahi hoi".
// Seedha hisaab (AI nahi): har khate ki AAKHRI entry ki tareekh -> aaj se kitne din. Baqaya sab se zyada upar. 0 baqaya shuru mein chhupa.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
let H = {}, days = 30, cat = 'Customer', showZero = false;
try { const s = JSON.parse(localStorage.getItem('sam-soye') || '{}'); if ([15, 30, 60, 90].includes(s.days)) days = s.days; if (['Customer', 'Supplier', 'Sab'].includes(s.cat)) cat = s.cat; } catch {}
const keep = () => { try { localStorage.setItem('sam-soye', JSON.stringify({ days, cat })); } catch {} };
export function soyeSetup(o) { H = o || {}; }

const dayMs = 86400000, toD = s => new Date(String(s).slice(0, 10) + 'T12:00:00').getTime();
const waNum = v => { let d = String(v || '').replace(/\D/g, ''); if (d.length === 11 && d.startsWith('0')) d = '92' + d.slice(1); else if (d.length === 10 && d.startsWith('3')) d = '92' + d; return d; };

// sab khate -> {p, last (entry), din, bal}; `o.days` se zyada din wale, category, 0 baqaya chahiye ya nahi
export function soyeRows(o = {}) {
  const D = Number(o.days) || days, C = o.cat || cat, zero = o.zero ?? showZero, today = H.today ? H.today() : new Date().toISOString().slice(0, 10);
  const es = (H.entries ? H.entries() : []).filter(e => e && !e.deleted && e.partyId);
  const lastBy = new Map(); for (const e of es) { const l = lastBy.get(e.partyId); if (!l || String(e.date) > String(l.date)) lastBy.set(e.partyId, e); }
  const out = [];
  for (const p of (H.parties ? H.parties() : [])) {
    if (!p || p.deleted || p.active === false || p.bank) continue;
    if (C !== 'Sab' && (p.category || 'Customer') !== C) continue;
    const last = lastBy.get(p.id) || null, made = Number(p.createdAt) > 0 ? new Date(Number(p.createdAt)).toISOString().slice(0, 10) : '', ref = last ? last.date : (p.date || p.createdDate || made);   // entry na ho to khata banne ka din
    const din = ref ? Math.floor((toD(today) - toD(ref)) / dayMs) : 9999;
    if (din < D) continue;
    const bal = H.balance ? H.balance(p, es) : 0;
    if (!zero && Math.abs(bal) < 100) continue;   // Re 1 se kam (paise) = 0
    out.push({ p, last, din, bal });
  }
  return out.sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal) || b.din - a.din);
}
const dinTxt = d => d >= 9999 ? 'kabhi entry nahi' : d >= 365 ? Math.floor(d / 365) + ' saal ' + Math.floor((d % 365) / 30) + ' mahine' : d >= 60 ? Math.floor(d / 30) + ' mahine' : d + ' din';
const msg = r => `Assalam o alaikum ${r.p.name},\nNoor Traders ki taraf se yaad dihani: aap ke khate mein ${H.money ? H.money(Math.abs(r.bal)) : Math.abs(r.bal) / 100} ${r.bal >= 0 ? 'baqaya (aap ki taraf)' : 'hamari taraf'} hai.${r.last ? `\nAakhri len-den: ${r.last.date}.` : ''}\nShukriya.`;

export function soyeRender() {
  const rows = soyeRows(), all = soyeRows({ zero: true }), m = H.money || (v => v), lena = rows.reduce((n, r) => n + Math.max(0, r.bal), 0), dena = rows.reduce((n, r) => n + Math.max(0, -r.bal), 0);
  $('summary').innerHTML = `<div class="soye-sum"><small>😴 ${cat === 'Sab' ? 'Sab khate' : cat} · ${days} din se koi entry nahi</small><strong>${rows.length} khate</strong><small>Lena <b class="red">${m(lena)}</b>${dena ? ` · Dena <b class="green">${m(dena)}</b>` : ''}${all.length > rows.length && !showZero ? ` · ${all.length - rows.length} saaf (0 baqaya) chhupe` : ''}</small></div>`;
  const chip = (attr, v, cur, lab) => `<button type="button" class="rc${cur === v ? ' on' : ''}" data-${attr}="${v}">${lab}</button>`;
  $('list').innerHTML = `${H.modeChips ? H.modeChips('soye') : ''}<div class="soye-ctl"><div class="mchips"><small>Kitne din se:</small>${[15, 30, 60, 90].map(d => chip('soye-days', d, days, d + ' din')).join('')}</div>
    <div class="mchips"><small>Kaun:</small>${['Customer', 'Supplier', 'Sab'].map(c => chip('soye-cat', c, cat, c === 'Customer' ? '👤 Customer' : c === 'Supplier' ? '🚚 Supplier' : 'Sab')).join('')}<button type="button" class="rc${showZero ? ' on' : ''}" data-soye-zero="1">${showZero ? '✓ ' : ''}0 baqaya bhi</button></div></div>
    <div class="soye-list">${rows.map((r, i) => { const ph = String(r.p.phone || '').trim(), wa = waNum(ph); return `<article class="soye-card${r.din >= 90 ? ' old' : ''}">
      <button type="button" class="soye-top" data-party="${esc(r.p.id)}"><span class="soye-n"><b>${esc(r.p.name)}</b><small>${ph ? esc(ph) + ' · ' : ''}${esc(r.p.category || 'Customer')}</small></span><span class="soye-b"><b class="${r.bal >= 0 ? 'red' : 'green'}">${m(Math.abs(r.bal))}</b><small>${r.bal >= 0 ? 'Lene hain' : 'Dene hain'}</small></span></button>
      <div class="soye-meta"><span class="soye-din">😴 ${esc(dinTxt(r.din))}</span>${r.last ? `<span>Aakhri: ${esc(r.last.date)} · ${esc(H.label ? H.label(r.last) : r.last.kind)} ${m(r.last.amount || 0)}</span>` : '<span>Koi entry nahi — sirf opening</span>'}</div>
      <div class="soye-acts">${ph ? `<a class="soye-btn" href="tel:${esc(wa.startsWith('92') ? '+' + wa : ph)}">📞 Call</a>` : ''}${wa.length >= 11 ? `<a class="soye-btn wa" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg(r))}">💬 WhatsApp</a>` : ''}<button type="button" class="soye-btn" data-party="${esc(r.p.id)}">📒 Khata</button>${H.canRemind && H.canRemind() ? `<button type="button" class="soye-btn" data-reminder="${esc(r.p.id)}">⏰ Due date</button>` : ''}</div></article>`; }).join('') || `<div class="nt-empty">🎉<b>Koi soya khata nahi</b><small>${days} din mein sab ${cat === 'Sab' ? 'khaton' : cat.toLowerCase() + 's'} mein entry hui hai</small></div>`}</div>`;
  $('actions').innerHTML = `<button type="button" data-soye-pdf="1"${rows.length ? '' : ' disabled'}>📄 PDF · bhejo</button>`;
}
function pdfHTML() {
  const rows = soyeRows(), m = H.money || (v => v);
  return `<h1>NOOR TRADERS</h1><h2>😴 Soye khate — ${days} din se koi entry nahi (${cat === 'Sab' ? 'sab' : cat}) · ${esc(H.today ? H.today() : '')}</h2>
    <table class="iv-tbl"><thead><tr><th>#</th><th>Khata</th><th>Phone</th><th>Aakhri entry</th><th>Kitni dair</th><th>Baqaya</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.p.name)}</td><td>${esc(r.p.phone || '')}</td><td>${r.last ? esc(r.last.date) : '—'}</td><td>${esc(dinTxt(r.din))}</td><td class="iv-n">${m(Math.abs(r.bal))} ${r.bal >= 0 ? 'lena' : 'dena'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="5"><b>Kul ${rows.length} khate · lena</b></td><td class="iv-n"><b>${m(rows.reduce((n, r) => n + Math.max(0, r.bal), 0))}</b></td></tr></tfoot></table>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-soye-days],[data-soye-cat],[data-soye-zero],[data-soye-pdf]'); if (!t || !$('list')) return;
  const d = t.dataset;
  if (d.soyePdf) { H.pdf && H.pdf(pdfHTML(), 'Soye-khate-' + days + '-din'); return; }
  if (d.soyeDays) days = Number(d.soyeDays); else if (d.soyeCat) cat = d.soyeCat; else if (d.soyeZero) showZero = !showZero;
  keep(); soyeRender();
});
// 🤖 agent ke liye
export function soyeAgent({ days: D = 30, category = 'Customer', with_zero = false, limit = 25 } = {}) {
  const C = ['Customer', 'Supplier', 'Sab'].includes(category) ? category : 'Customer', rows = soyeRows({ days: Math.max(1, Number(D) || 30), cat: C, zero: !!with_zero });
  return { din_se: Number(D) || 30, kaun: C, kul: rows.length, kul_lena_rs: Math.round(rows.reduce((n, r) => n + Math.max(0, r.bal), 0)) / 100,
    khate: rows.slice(0, Math.min(50, Number(limit) || 25)).map(r => ({ account_id: r.p.id, naam: r.p.name, phone: r.p.phone || '', aakhri_entry: r.last ? r.last.date : '', din: r.din >= 9999 ? null : r.din, baqaya_rs: Math.round(Math.abs(r.bal)) / 100, side: r.bal >= 0 ? 'lene' : 'dene' })) };
}
export const _soyeTest = { soyeRows, dinTxt, msg, pdfHTML, set: o => { if (o.days) days = o.days; if (o.cat) cat = o.cat; if ('zero' in o) showZero = o.zero; } };
