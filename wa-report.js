// 📊 REPORTS MERE NUMBER PAR (v2.239.0) — malik 11 Nov: "kuch reports apne number par chahiye: daily sale ka poora hisaab · larka-wise · profit (dukan ka) ·
//   waqt hum khud tay kar sakein, default 6 pm · click kar ke bhej bhi sakein · ye sab WhatsApp parchi wali screen par".
//   Bhejta shop PC hai (raat-report v1.5 → waOut → dukan ka WhatsApp Business number). App sirf setting (blueAccess/reportConfig) + "Abhi bhejo" (reportNow) + haal (blueAccess/reportWa).
//   Sirf malik. AI nahi. Naya rule nahi.
let C = null, cfg = null, wa = null, stops = [], askAt = 0, tmr = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? 'abhi' : s < 3600 ? Math.round(s / 60) + ' min pehle' : s < 86400 ? Math.round(s / 3600) + ' ghante pehle' : Math.round(s / 86400) + ' din pehle'; };
const t12 = v => { const [h, m] = String(v || '18:00').split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const root = () => document.querySelector('#dialogBody [data-rw-root]');
const TIMES = ['17:00', '18:00', '19:00', '20:00', '20:45'];
function unlisten() { for (const f of stops) { try { f?.(); } catch {} } stops = []; clearTimeout(tmr); }
function html() {
  if (cfg === null) return '<p class="gr-empty">⏳ Setting aa rahi hai…</p>';
  const c = cfg || {}, tm = c.reportTime || '18:00', on = c.reportOn !== false && c.waOn !== false;
  const tg = (k, ic, t, s) => `<button type="button" class="rw-tg${c[k] !== false ? ' is-in' : ''}" data-rw-tg="${k}"><b>${c[k] !== false ? '☑' : '☐'} ${ic} ${t}</b><small>${s}</small></button>`;
  const pcAl = Number(c.alive) || 0, pcOk = pcAl && Date.now() - pcAl < 12 * 60000;
  let st = '';
  if (askAt && !(wa && Number(wa.at) > askAt)) st = Date.now() - askAt > 90000 ? '<p class="rw-st bad">✕ Shop PC ka jawab nahi aaya — PC band hai ya internet nahi. PC on ho to dobara dabayein.</p>' : '<p class="rw-st wait">⏳ Shop PC report bana raha hai… (1 min tak)</p>';
  else if (wa && wa.at) st = `<p class="rw-st ok">✅ Aakhri dafa: ${Number(wa.n) || 0} report WhatsApp par bheji — ${esc(ago(Number(wa.at)))}${wa.n ? '' : ' (koi report ON nahi thi / WhatsApp OFF)'}</p>`;
  return `<p class="rw-pc ${pcOk ? 'ok' : 'bad'}">${pcOk ? '🟢 Shop PC zinda' : '🔴 Shop PC chup' + (pcAl ? ' — ' + esc(ago(pcAl)) : '')} · bhejne wala: dukan ka WhatsApp Business number</p>
    <button type="button" class="rw-tg rw-main${on ? ' is-in' : ''}" data-rw-on="1"><b>${on ? '🟢 Roz khud bhejo: ON' : '⚪ Roz khud bhejo: BAND'}</b><small>${on ? 'har roz ' + esc(t12(tm)) + ' par' : 'sirf "Abhi bhejo" se'}</small></button>
    <p class="rw-h">Kaun si reports</p>
    ${tg('waD', '📒', 'Daily Sale ka hisaab', 'sale · wasooli · akhrajat · closing · farq')}${tg('waL', '👦', 'Larka-wise', 'har larke ki sale + bill')}${tg('waP', '💰', 'Profit (dukan)', 'sale · nafa · % · top 5 items')}
    <p class="rw-h">Waqt</p>
    <div class="rw-tm">${TIMES.map(t => `<button type="button" data-rw-tm="${t}" class="${t === tm ? 'is-in' : ''}">${t12(t)}</button>`).join('')}<input type="time" id="rwTime" value="${esc(tm)}" aria-label="Apna waqt"></div>
    <small class="rw-note">Report us waqt TAK ka hisaab hoti hai. Poore din ka chahiye to raat ko "Abhi bhejo" dabayein ya waqt 8:45 pm rakhein (PC 9 baje band hota hai).</small>
    <button type="button" class="rw-go" data-rw-go="1">📤 Abhi bhejo</button>${st}`;
}
function paint() { const r = root(); if (!r) return; const a = document.activeElement; if (a && a.id === 'rwTime') return; r.innerHTML = html(); }
async function save(patch) { try { cfg = { ...(cfg || {}), ...patch }; paint(); await C.cloud.setReportConfig(patch); } catch (e) { C.notice('Save nahi hua: ' + (e?.message || e)); } }
export function rwSetup(c) {
  C = c;
  document.addEventListener('click', e => {
    const r = root(); if (!r || !r.contains(e.target)) return; const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.rwTg) { save({ [t.dataset.rwTg]: (cfg || {})[t.dataset.rwTg] === false }); return; }
    if (t.dataset.rwOn) { const on = (cfg || {}).reportOn !== false && (cfg || {}).waOn !== false; save({ reportOn: !on, waOn: true }); return; }
    if (t.dataset.rwTm) { save({ reportTime: t.dataset.rwTm }); return; }
    if (t.dataset.rwGo) { askAt = Date.now(); paint(); clearTimeout(tmr); tmr = setTimeout(paint, 92000); C.cloud.setReportConfig({ reportNow: 1, waOn: true }).catch(er => { askAt = 0; paint(); C.notice('Nahi gaya: ' + (er?.message || er)); }); return; }
  });
  document.addEventListener('change', e => { if (e.target?.id === 'rwTime' && /^\d\d:\d\d$/.test(e.target.value)) { const v = e.target.value; e.target.blur(); save({ reportTime: v }); } });
}
export function rwOpen() {
  if (!C?.owner()) { C?.notice('Sirf malik'); return; }
  unlisten(); cfg = null; wa = null; askAt = 0;
  C.modal('📊 Reports mere number par', `<div class="rw" data-rw-root="1">${html()}</div>`, true);
  const cl = C.cloud;
  try { stops.push(cl.listenReportConfig(d => { if (!root()) return; cfg = d || {}; paint(); })); } catch {}
  try { stops.push(cl.listenReportWa(d => { if (!root()) return; wa = d || {}; paint(); })); } catch {}
  try { document.getElementById('dialog')?.addEventListener('close', unlisten, { once: true }); } catch {}
}
