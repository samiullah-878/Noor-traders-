// gate-wa.js — v2.265.0: 🚪 GATE PASS WHATSAPP PAR (malik 13 Nov 2026: "gate pass ka system bhi WhatsApp par bhej do · item name, bill number · 1 de diya · 2 nahi diya ·
//   WhatsApp parchi mein gate pass ke liye numbers — sirf unhi par, kisi aur par nahi · sab godam ke gate pass unhi numbers par").
//   App: sirf setting (blueAccess/gpWa {on, nums:[{n,p}], since}) — sirf malik. Bhejna + jawab parhna PC wa-out.js (dukan ka Business number). AI nahi. Naya rule nahi (blueAccess = malik).
let C = null, cfg = null, stops = [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ph = p => String(p || '').replace(/^(\d{4})(\d+)$/, '$1-$2');
const normPh = x => { let d = String(x || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2); else if (d.length === 10 && d.startsWith('3')) d = '0' + d; return d; };
const root = () => document.querySelector('#dialogBody [data-gw-root]');
function unlisten() { for (const f of stops) { try { f?.(); } catch {} } stops = []; }
function html() {
  if (cfg === null) return '<p class="gr-empty">⏳ Aa raha hai…</p>';
  const on = cfg.on === true, A = Array.isArray(cfg.nums) ? cfg.nums : [];
  return `<button type="button" class="rw-tg rw-main${on ? ' is-in' : ''}" data-gw-on="1"><b>${on ? '🟢 Gate pass WhatsApp par: ON' : '⚪ Gate pass WhatsApp par: BAND'}</b><small>bill POST hote hi · sab godam · sirf neeche wale numbers</small></button>
    ${on && !A.length ? '<p class="kw-how" style="color:#b42318"><b>⚠️ Abhi koi number nahi — neeche number jorein, warna kisi ko nahi jayega.</b></p>' : ''}
    <p class="rw-h">Kin numbers par jaye <small>(sirf yehi — kisi aur ko nahi)</small></p>
    <div class="kw-al">${A.map((a, i) => `<span class="kw-a"><b>${esc(a.n || '—')}</b> ${esc(ph(a.p))}<button type="button" data-gw-del="${i}" aria-label="Hatao">✕</button></span>`).join('') || '<small class="rw-note">Abhi koi number nahi</small>'}</div>
    <div class="kw-add"><input id="gwNm" placeholder="Naam (Zeeshan)" autocomplete="off"><input id="gwPh" type="tel" inputmode="tel" placeholder="03xx-xxxxxxx" autocomplete="off"><button type="button" data-gw-add="1">＋ Jorein</button></div>
    <p class="rw-h">Kaise chalta hai</p>
    <p class="kw-how">① Bill POS mein <b>post</b> hota hai → dukan ke Business number se paigham: <b>gate pass # · gahak · har godam ki items + tadad</b><br>② Larka <b>usi paigham par reply</b> mein likhe: <b>1</b> = de diya · <b>2</b> = nahi diya<br>③ <b>1</b> = Gate pass screen par sab items ✓ (us ke naam se) · <b>2</b> = laal nishan + aap ko WhatsApp par khabar<br>④ Bill cancel / un-post ho jaye = "⛔ maal mat dein" ka paigham</p>
    <p class="kw-how">App ki 🚪 Gate pass screen pehle jaisi chalti hai — dono jagah se tick ho sakta hai. Sirf ON karne ke BAAD post hone wale bill jate hain.</p>`;
}
function paint() { const r = root(); if (!r) return; const a = document.activeElement; if (a && (a.id === 'gwNm' || a.id === 'gwPh')) return; r.innerHTML = html(); }
async function saveCfg(patch) { try { cfg = { ...(cfg || {}), ...patch }; const r = root(); if (r) r.innerHTML = html(); await C.cloud.setGpWa({ on: cfg.on === true, nums: cfg.nums || [] }); } catch (e) { C.notice('Save nahi hua: ' + (e?.message || e)); } }
export function gwSetup(c) {
  C = c;
  document.addEventListener('click', e => {
    const r = root(); if (!r || !r.contains(e.target)) return; const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.gwOn) { saveCfg({ on: cfg.on !== true }); return; }
    if (t.dataset.gwDel) { const A = [...(cfg.nums || [])], a = A[Number(t.dataset.gwDel)]; if (a && confirm(`${a.n || a.p} ko list se hatayein?`)) { A.splice(Number(t.dataset.gwDel), 1); saveCfg({ nums: A }); } return; }
    if (t.dataset.gwAdd) { const n = (document.getElementById('gwNm')?.value || '').trim().slice(0, 30), p = normPh(document.getElementById('gwPh')?.value);
      if (!n) { C.notice('Naam likhein'); return; } if (!/^03\d{9}$/.test(p)) { C.notice('Number poora likhein (03xx-xxxxxxx)'); return; }
      const A = [...(cfg.nums || [])]; if (A.some(a => a.p === p)) { C.notice('Yeh number pehle se list mein hai'); return; } if (A.length >= 10) { C.notice('10 se zyada nahi'); return; }
      A.push({ n, p }); saveCfg({ nums: A }); return; }
  });
}
export function gwOpen() {
  if (!C?.owner()) { C?.notice('Sirf malik'); return; }
  unlisten(); cfg = null;
  C.modal('🚪 Gate pass WhatsApp par', `<div class="rw kw" data-gw-root="1">${html()}</div>`, true);
  try { stops.push(C.cloud.listenGpWa(d => { if (!root()) return; cfg = d || {}; paint(); })); } catch {}
  try { document.getElementById('dialog')?.addEventListener('close', unlisten, { once: true }); } catch {}
}
