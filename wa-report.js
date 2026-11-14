// 📊 REPORTS MERE NUMBER PAR (v2.239.0) — malik 11 Nov: "kuch reports apne number par chahiye: daily sale ka poora hisaab · larka-wise · profit (dukan ka) ·
//   waqt hum khud tay kar sakein, default 6 pm · click kar ke bhej bhi sakein · ye sab WhatsApp parchi wali screen par".
//   Bhejta shop PC hai (raat-report v1.5 → waOut → dukan ka WhatsApp Business number). App sirf setting (blueAccess/reportConfig) + "Abhi bhejo" (reportNow) + haal (blueAccess/reportWa).
//   Sirf malik. AI nahi. Naya rule nahi.
// 👥 HAZRI (v2.279.0, malik 14 Nov: "NT hazri wali app ko is app ke saath connect karo, larkon ki report WhatsApp par — subah 10, shaam 6, aur jab maangein"):
//   Hazri app ALAG Firebase hai -> "🔗 Hazri app jorein" chaabi (blueAccess/hazriKey) bana kar hazri app ka link (#bk=) kholta hai -> hazri ka server
//   aaj ka khulasa hazriIn mein bhejta hai -> PC raat-report v1.7 WhatsApp par (waH · hzTime · hzNow). Haal blueAccess/hazriWa. AI nahi.
let C = null, cfg = null, wa = null, hz = null, hk = '', stops = [], askAt = 0, hzAsk = 0, tmr = null;
const HZ_URL = 'https://samiullah-878.github.io/nt-traders-/', HZ_TIMES = ['09:30', '10:00', '10:30', '11:00'];
const newKey = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
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
  const hzT = c.hzTime || '10:00', hzAt = Number(hz && hz.at) || 0, hzOn = !!hzAt, hzFresh = hzOn && Date.now() - hzAt < 45 * 60000;
  const hzSt = hz === null ? '' : hzOn ? `<p class="rw-st ${hzFresh ? 'ok' : 'wait'}">${hzFresh ? '🟢' : '🟡'} Hazri app ka data: ${esc(ago(hzAt))} · ${Number(hz.n) || 0} larke${hzFresh ? '' : ' — purana hai (PC band tha ya hazri app ka server chup)'}</p>` : '<p class="rw-st wait">⚪ Hazri app abhi juri nahi — neeche "🔗 Hazri app jorein" dabayein (ek dafa).</p>';
  const hzSt2 = hzAsk ? (hz && Number(hz.sent) > hzAsk ? '<p class="rw-st ok">✅ Hazri ki report WhatsApp par bhej di</p>' : Date.now() - hzAsk > 90000 ? '<p class="rw-st bad">✕ Shop PC ka jawab nahi aaya — PC band hai ya internet nahi.</p>' : '<p class="rw-st wait">⏳ Shop PC hazri bhej raha hai… (1 min tak)</p>') : '';
  let st = '';
  if (askAt && !(wa && Number(wa.at) > askAt)) st = Date.now() - askAt > 90000 ? '<p class="rw-st bad">✕ Shop PC ka jawab nahi aaya — PC band hai ya internet nahi. PC on ho to dobara dabayein.</p>' : '<p class="rw-st wait">⏳ Shop PC report bana raha hai… (1 min tak)</p>';
  else if (wa && wa.at) st = `<p class="rw-st ok">✅ Aakhri dafa: ${Number(wa.n) || 0} report WhatsApp par bheji — ${esc(ago(Number(wa.at)))}${wa.n ? '' : ' (koi report ON nahi thi / WhatsApp OFF)'}</p>`;
  return `<p class="rw-pc ${pcOk ? 'ok' : 'bad'}">${pcOk ? '🟢 Shop PC zinda' : '🔴 Shop PC chup' + (pcAl ? ' — ' + esc(ago(pcAl)) : '')} · bhejne wala: dukan ka WhatsApp Business number</p>
    <button type="button" class="rw-tg rw-main${on ? ' is-in' : ''}" data-rw-on="1"><b>${on ? '🟢 Roz khud bhejo: ON' : '⚪ Roz khud bhejo: BAND'}</b><small>${on ? 'har roz ' + esc(t12(tm)) + ' par' : 'sirf "Abhi bhejo" se'}</small></button>
    <p class="rw-h">Kaun si reports</p>
    ${tg('waD', '📒', 'Daily Sale ka hisaab', 'sale · wasooli · akhrajat · closing · farq')}${tg('waL', '👦', 'Larka-wise', 'har larke ki sale + bill')}${tg('waP', '💰', 'Profit (dukan)', 'sale · nafa · % · top 5 items')}${tg('waH', '👥', 'Hazri (larke)', 'aaye · late · nahi aaye · bahar · check-out')}
    <p class="rw-h">Waqt</p>
    <div class="rw-tm">${TIMES.map(t => `<button type="button" data-rw-tm="${t}" class="${t === tm ? 'is-in' : ''}">${t12(t)}</button>`).join('')}<input type="time" id="rwTime" value="${esc(tm)}" aria-label="Apna waqt"></div>
    <small class="rw-note">Report us waqt TAK ka hisaab hoti hai. Poore din ka chahiye to raat ko "Abhi bhejo" dabayein ya waqt 8:45 pm rakhein (PC 9 baje band hota hai).</small>
    <button type="button" class="rw-go" data-rw-go="1">📤 Abhi bhejo</button>${st}
    <p class="rw-h">👥 Hazri — subah ki report</p>
    <div class="rw-tm">${HZ_TIMES.map(t => `<button type="button" data-rw-hzt="${t}" class="${t === hzT ? 'is-in' : ''}">${t12(t)}</button>`).join('')}<input type="time" id="rwHz" value="${esc(hzT)}" aria-label="Hazri ka waqt"></div>
    <small class="rw-note">Subah: kaun aaya / late / nahi aaya. Shaam ki poori hazri upar wale waqt par baqi reports ke saath. WhatsApp par "hazri" likhein to usi waqt.</small>
    ${hzSt}
    <div class="rw-tm"><button type="button" class="is-in" data-rw-hz="1">📤 Hazri abhi bhejo</button><button type="button" data-rw-join="1">🔗 Hazri app ${hzOn ? 'dobara jorein' : 'jorein'}</button></div>${hzSt2}`;
}
function paint() { const r = root(); if (!r) return; const a = document.activeElement; if (a && (a.id === 'rwTime' || a.id === 'rwHz')) return; r.innerHTML = html(); }
async function save(patch) { try { cfg = { ...(cfg || {}), ...patch }; paint(); await C.cloud.setReportConfig(patch); } catch (e) { C.notice('Save nahi hua: ' + (e?.message || e)); } }
export function rwSetup(c) {
  C = c;
  document.addEventListener('click', e => {
    const r = root(); if (!r || !r.contains(e.target)) return; const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.rwTg) { save({ [t.dataset.rwTg]: (cfg || {})[t.dataset.rwTg] === false }); return; }
    if (t.dataset.rwOn) { const on = (cfg || {}).reportOn !== false && (cfg || {}).waOn !== false; save({ reportOn: !on, waOn: true }); return; }
    if (t.dataset.rwTm) { save({ reportTime: t.dataset.rwTm }); return; }
    if (t.dataset.rwHzt) { save({ hzTime: t.dataset.rwHzt }); return; }
    if (t.dataset.rwHz) { hzAsk = Date.now(); paint(); clearTimeout(tmr); tmr = setTimeout(paint, 92000); C.cloud.setReportConfig({ hzNow: 1, waOn: true }).catch(er => { hzAsk = 0; paint(); C.notice('Nahi gaya: ' + (er?.message || er)); }); return; }
    if (t.dataset.rwJoin) {
      const k = hk || newKey(), fresh = !hk; hk = k;
      try { const a = document.createElement('a'); a.href = HZ_URL + '#bk=' + k; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); } catch {}
      if (fresh) C.cloud.setHazriKey(k).catch(er => { hk = ''; C.notice('Chaabi save nahi hui: ' + (er?.message || er)); });
      C.notice('Hazri app khul rahi hai — malik login ho to "✅ Blue Khata se jur gaya" aayega. 1-2 minute baad yahan 🟢 dikhega.'); return;
    }
    if (t.dataset.rwGo) { askAt = Date.now(); paint(); clearTimeout(tmr); tmr = setTimeout(paint, 92000); C.cloud.setReportConfig({ reportNow: 1, waOn: true }).catch(er => { askAt = 0; paint(); C.notice('Nahi gaya: ' + (er?.message || er)); }); return; }
  });
  document.addEventListener('change', e => { if (e.target?.id === 'rwTime' && /^\d\d:\d\d$/.test(e.target.value)) { const v = e.target.value; e.target.blur(); save({ reportTime: v }); } });
  document.addEventListener('change', e => { if (e.target?.id === 'rwHz' && /^\d\d:\d\d$/.test(e.target.value)) { const v = e.target.value; e.target.blur(); save({ hzTime: v }); } });
}
export function rwOpen() {
  if (!C?.owner()) { C?.notice('Sirf malik'); return; }
  unlisten(); cfg = null; wa = null; hz = null; hk = ''; askAt = 0; hzAsk = 0;
  C.modal('📊 Reports mere number par', `<div class="rw" data-rw-root="1">${html()}</div>`, true);
  const cl = C.cloud;
  try { stops.push(cl.listenReportConfig(d => { if (!root()) return; cfg = d || {}; paint(); })); } catch {}
  try { stops.push(cl.listenReportWa(d => { if (!root()) return; wa = d || {}; paint(); })); } catch {}
  try { stops.push(cl.listenHazriWa(d => { if (!root()) return; hz = d || {}; paint(); })); } catch {}
  try { cl.getHazriKey().then(k => { hk = k || ''; }).catch(() => {}); } catch {}
  try { document.getElementById('dialog')?.addEventListener('close', unlisten, { once: true }); } catch {}
}
