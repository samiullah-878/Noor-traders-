// report.js — v2.99.22: 🌙 RAAT KI REPORT (malik) + ⚙️ report / alert setting + push ke link (?report=din / ?alert=1)
// Data: PC raat-report.js -> blueAccess/report-<din> (har raat) aur blueAccess/stockAlert (har subah). Setting: blueAccess/reportConfig.
// Yahan AI nahi — sab PC ka seedha hisaab (POS SQL + khata).
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round(Number(n) || 0));
const pad2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => dayOf(new Date());
const shift = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return dayOf(d); };
const dLabel = day => { const d = new Date(day + 'T12:00:00'); return `${['Itwar', 'Pir', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'][d.getDay()]} ${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`; };
const clock = t => t ? new Date(t).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : '';
const ago = t => { const m = Math.round((Date.now() - Number(t || 0)) / 60000); return !t ? '—' : m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; };
const DEF = { reportOn: true, reportTime: '22:30', alertOn: true, alertTime: '09:00', alertRed: 3, alertYellow: 7, wsNames: ['whole sale'], wsSmall: 3 };

let cloud = null, notice = () => {}, isOwner = () => false, route = () => {}, pdfOf = null;
let day = '', rep = undefined, repStop = null, cfg = { ...DEF }, cfgStop = null, waitNow = 0;
export function reportSetup(o) { cloud = o.cloud; notice = o.notice || notice; isOwner = o.owner || isOwner; route = o.route || route; pdfOf = o.pdf || pdfOf; }
function cfgWatch() { if (cfgStop || !cloud?.listenReportConfig) return; cfgStop = cloud.listenReportConfig(c => { if (c) cfg = { ...DEF, ...c }; paintIf(); paintSet(); }); }
const open = () => !!document.querySelector('#dialog[open] .rp-root');
function paintIf() { if (open()) $('dialogBody').innerHTML = html(); }

// ---------- 🌙 report ----------
export function openReport(d) {
  if (!isOwner()) { notice('Report sirf malik dekh sakta hai'); return; }
  cfgWatch(); day = /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : today(); watch();
  const dl = $('dialog'); dl.classList.remove('search-dialog'); dl.classList.add('full-dialog');
  $('dialogTitle').textContent = '🌙 Raat ki report';
  $('dialogBody').innerHTML = html();
  if (!dl.open) dl.showModal();
}
function watch() { try { repStop?.(); } catch {} rep = undefined; repStop = cloud?.listenReport ? cloud.listenReport(day, r => { rep = r === undefined ? { _err: 1 } : r === null ? { _none: 1 } : r; paintIf(); }) : null; }
const money = v => 'Rs ' + num(v);
const card = (ic, title, body, cls = '') => `<section class="rp-card ${cls}"><h4>${ic} ${title}</h4>${body}</section>`;
const row = (a, b, cls = '') => `<div class="rp-row ${cls}"><span>${a}</span><b>${b}</b></div>`;
function html() {
  const nav = `<div class="rp-nav"><button type="button" data-rp-day="-1">‹</button><b>${esc(dLabel(day))}${day === today() ? ' <em>aaj</em>' : day === shift(today(), -1) ? ' <em>kal</em>' : ''}</b><button type="button" data-rp-day="1"${day >= today() ? ' disabled' : ''}>›</button><input type="date" data-rp-date="1" value="${day}" max="${today()}"></div>`;
  const pcLine = cfg.alive ? `<small class="rp-pc ${Date.now() - cfg.alive < 12 * 60000 ? 'ok' : 'bad'}">🖥 Server PC: ${Date.now() - cfg.alive < 12 * 60000 ? '✓ chal raha hai' : '⚠️ khamosh'} · ${esc(ago(cfg.alive))}</small>` : '<small class="rp-pc bad">🖥 Server PC ka script abhi update nahi hua (3 min mein khud)</small>';
  const acts = `<div class="rp-acts"><button type="button" class="primary" data-rp-pdf="1"${rep && !rep._err ? '' : ' disabled'}>📄 PDF · WhatsApp</button><button type="button" data-rp-now="1">🔄 ${rep && !rep._err && !rep._none && rep.day ? 'Dobara banao' : 'Abhi banao'}</button><button type="button" data-rp-set="1">⚙️ Setting</button></div>`;
  if (!rep) return `<div class="rp-root">${nav}<p class="rp-wait">⏳ Report parh rahe hain…</p>${acts}${pcLine}</div>`;
  if (rep._err) return `<div class="rp-root">${nav}<p class="warning">Report nahi parh sake (internet?)</p>${acts}${pcLine}</div>`;
  if (rep._none || !rep.day) return `<div class="rp-root">${nav}<div class="rp-empty">📭 Is din ki report nahi bani.<small>Report har raat ${esc(cfg.reportTime)} baje khud banti hai. Abhi chahiye to "🔄 Abhi banao" dabayein — Server PC ek minute mein bana dega.${waitNow && Date.now() - waitNow < 180000 ? '<br>⏳ PC ko keh diya — intezar…' : ''}</small></div>${acts}${pcLine}</div>`;
  const r = rep, S = r.sale || {}, k = r.khata, ws = r.ws || {}, P = r.purchase || {}, st = r.stock || {}, T = r.transfer, G = r.ginti, A = r.alert;
  const hero = `<div class="rp-hero"><small>🧾 Kul sale (POS)</small><b>${money(S.total)}</b><span>📈 Andaza nafa <b>${money(S.profit)}</b> (${S.profitPct || 0}%)</span>
    <div class="rp-chips"><i>💵 Cash ${money(S.cash)}</i><i>📒 Udhaar ${money(S.credit)}</i><i>${num(S.n)} bill</i>${S.cancelN ? `<i class="bad">⊘ ${S.cancelN} cancel</i>` : ''}${S.returnN ? `<i>↩ ${S.returnN} wapsi ${money(S.returnRs)}</i>` : ''}</div></div>`;
  const dhyan = (r.flags || []).length ? card('⚠️', 'DHYAN', `<ul class="rp-flags">${r.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`, 'warn') : card('✅', 'Sab theek', '<p class="rp-ok">Aaj koi khaas masla nahi pakra gaya.</p>', 'good');
  const loss = r.lossN ? card('🔻', `Ghaate wale bill (${r.lossN}) · ${money(r.lossRs)}`, (r.loss || []).map(b => `<div class="rp-bill"><div><b>#${esc(b.no)}</b> ${esc(clock(b.at))} · ${esc(b.pc)}${b.by ? ' · ' + esc(b.by) : ''}${b.party ? ' · ' + esc(b.party) : ''}</div><span class="bad">−${money(b.rs)}</span><small>${(b.items || []).map(x => `${esc(x.n)}: ${num(x.q)} × ${num(x.rate)} (khareed ${num(x.cost)})`).join(' · ')}</small></div>`).join(''), 'bad') : '';
  const wsC = ws.n ? card('🏷', `Wholesale bills (${ws.n}) · ${money(ws.total)}`, row('Retail ke muqable farq', money(ws.farq), ws.farq > 0 ? 'bad' : '') + row(`⚠️ Shak wale (zyada lines ${ws.small || cfg.wsSmall} pcs se kam)`, `${ws.shakN} · ${money(ws.shakFarq)}`, ws.shakN ? 'bad' : '') + (ws.counterN ? row('🔁 Counter par wholesale rate', ws.counterN, 'bad') : '')
    + (ws.bills || []).filter(b => b.shak || b.counter).slice(0, 12).map(b => `<div class="rp-bill"><div><b>#${esc(b.no)}</b> ${esc(clock(b.at))} · ${esc(b.pc)}${b.by ? ' · ' + esc(b.by) : ''} · ${esc(b.party)}</div><span>${money(b.total)}</span><small>${b.shak ? `⚠️ ${b.small}/${b.lines} line chhoti` : ''}${b.counter ? ' 🔁 counter W rate' : ''}${b.farq ? ` · farq ${money(b.farq)}` : ''}</small></div>`).join('')
    + '<p class="rp-tip">Poori list: Sale → 🧾 Bills → "🏷 Wholesale" chip</p>') : '';
  const khC = k ? card('💰', 'Khata (app)', row('Sale (khata)', money(k.sale / 100)) + row('Wasooli', money(k.collection / 100)) + row('Udhaar diya (saman)', money(k.credit / 100)) + row('Akhrajat', money(k.expense / 100)) + row('Party payments', money(k.payment / 100))
    + (k.closed ? row('Cash ka farq', (k.difference > 0 ? '−' : k.difference < 0 ? '+' : '') + money(Math.abs(k.difference) / 100), Math.abs(k.difference) >= 100 ? 'bad' : 'good') : row('Closing cash', 'abhi nahi gini', 'bad'))) : '';
  const puC = card('🧾', `Purchase (${P.n || 0} bill) · ${money(P.total)}`, (P.mehnga || []).length ? `<p class="rp-sub">📈 Mehngay aaye (${P.mehngaN}):</p>` + P.mehnga.map(x => row(esc(x.n), `${num(x.prev)} → <span class="bad">${num(x.now)}</span>`)).join('') : '<p class="rp-ok">Koi item mehnga nahi aaya.</p>');
  const dv = st.prev != null ? st.value - st.prev : null;
  const stC = card('💼', 'Stock ki maaliyat', `<div class="rp-big">${money(st.value)}${dv != null ? ` <small class="${dv < 0 ? 'bad' : 'good'}">${dv < 0 ? '▼' : '▲'} kal se ${money(Math.abs(dv))}</small>` : ''}</div>` + Object.entries(st.per || {}).map(([g, v]) => row(esc(g), money(v))).join('') + (st.negN ? `<p class="rp-tip">⚠️ ${num(st.negN)} items ka stock minus (jor mein nahi)</p>` : ''));
  const trC = T ? card('🧾', `Transfer note (${T.n})`, (T.pendingN ? `<p class="rp-sub bad">⏳ ${T.pendingN} check nahi hue:</p>` + T.pending.map(x => row(`TN ${esc(x.no)} · ${esc(x.from)} → ${esc(x.to)}`, esc(clock(x.at)))).join('') : '<p class="rp-ok">✓ Sab check ho gaye</p>') + (T.farqN ? `<p class="rp-sub bad">⚠️ Farq (${T.farqN}):</p>` + T.farq.map(x => row(`TN ${esc(x.no)} · ${esc(x.by)}`, esc(x.note))).join('') : '')) : '';
  const giC = G ? card('📋', 'Stock ginti', row('Aaj gine', num(G.n)) + row('Farq wale', `${num(G.farqN)} · ${money(G.farqRs)}`, G.farqN ? 'bad' : 'good')) : '';
  const alC = A ? card('⏰', 'Khatam hone wala maal', (A.top || []).length ? A.top.map(x => row(esc(x.n), x.left <= 0 ? 'khatam' : x.left + ' din', 'bad')).join('') + `<p class="rp-tip">${num(A.redN)} laal (${A.red} din) · ${num(A.yellowN)} peela</p><button type="button" class="rp-go" data-rp-po="1">🛒 Order screen kholo</button>` : '<p class="rp-ok">✓ Koi maal jald khatam nahi ho raha</p>') : '';
  return `<div class="rp-root">${nav}${hero}${dhyan}${loss}${wsC}${khC}${puC}${stC}${trC}${giC}${alC}<p class="rp-foot">Bani: ${esc(new Date(r.at).toLocaleString('en-PK'))} · Server PC</p>${acts}${pcLine}</div>`;
}
function pdfHTML() {
  const r = rep; if (!r || !r.day) return '';
  const tbl = (rows) => `<table class="iv-tbl"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td class="iv-n">${b}</td></tr>`).join('')}</tbody></table>`;
  const S = r.sale || {}, k = r.khata, ws = r.ws || {}, st = r.stock || {};
  return `<h1>NOOR TRADERS</h1><h2>🌙 Raat ki report — ${esc(dLabel(r.day))} ${esc(r.day)}</h2>`
    + tbl([['Kul sale', money(S.total)], ['Cash / Udhaar', `${money(S.cash)} / ${money(S.credit)}`], ['Bill (cancel)', `${num(S.n)} (${num(S.cancelN)})`], ['Andaza nafa', `${money(S.profit)} (${S.profitPct || 0}%)`]])
    + ((r.flags || []).length ? `<h3>⚠️ DHYAN</h3><ul>${r.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '')
    + (r.lossN ? `<h3>🔻 Ghaate wale bill</h3>` + tbl((r.loss || []).map(b => [`#${esc(b.no)} ${esc(clock(b.at))} · ${esc(b.pc)} ${esc(b.by || '')}`, '−' + money(b.rs)])) : '')
    + (ws.n ? `<h3>🏷 Wholesale (${ws.n})</h3>` + tbl([['Kul', money(ws.total)], ['Retail se farq', money(ws.farq)], ['Shak wale', `${ws.shakN} · ${money(ws.shakFarq)}`], ['Counter par W rate', num(ws.counterN)]]) : '')
    + (k ? `<h3>💰 Khata</h3>` + tbl([['Wasooli', money(k.collection / 100)], ['Udhaar diya', money(k.credit / 100)], ['Akhrajat', money(k.expense / 100)], ['Cash farq', k.closed ? money(k.difference / 100) : 'gini nahi']]) : '')
    + `<h3>💼 Stock ki maaliyat: ${money(st.value)}</h3>` + tbl(Object.entries(st.per || {}).map(([g, v]) => [esc(g), money(v)]));
}
document.addEventListener('click', e => {
  if (e.target.closest?.('#rpOpenBtn')) { openReport(); return; }
  if (!open() && !document.querySelector('#dialog[open] .rs-root')) return;
  const t = e.target.closest?.('[data-rp-day],[data-rp-now],[data-rp-set],[data-rp-pdf],[data-rp-po],[data-rs-on],[data-rs-rt],[data-rs-at],[data-rs-red],[data-rs-small],[data-rs-wsdel],[data-rs-wsadd],[data-rs-back],[data-rs-alertnow]'); if (!t) return;
  const d = t.dataset;
  if (d.rpDay) { const n = shift(day, Number(d.rpDay)); if (n > today()) return; day = n; watch(); paintIf(); return; }
  if (d.rpNow != null) { waitNow = Date.now(); cloud.setReportConfig({ reportNow: 1, reportDay: day }).then(() => notice('🖥 Server PC ko keh diya — 1 minute mein report')).catch(er => notice('Nahi hua: ' + (er?.message || er))); paintIf(); return; }
  if (d.rpPdf != null) { const h = pdfHTML(); if (h && pdfOf) pdfOf(h, 'Raat ki report ' + day); return; }
  if (d.rpPo != null) { try { $('dialog').close(); } catch {} route('notes'); setTimeout(() => $('ntPo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); return; }
  if (d.rpSet != null) { openSettings(); return; }
  // ---- setting ----
  const save = patch => cloud.setReportConfig(patch).then(() => notice('✓ Save')).catch(er => notice('Nahi hua: ' + (er?.message || er)));
  if (d.rsBack != null) { const keep = rep; openReport(day); if (keep && keep.day === day) { rep = keep; paintIf(); } return; }
  if (d.rsOn) { const [k, v] = d.rsOn.split(':'); cfg[k] = v === '1'; paintSet(); save({ [k]: v === '1' }); return; }
  if (d.rsRt) { let v = d.rsRt; if (v === 'apna') { v = prompt('Report ka waqt (24 ghante, jaise 22:45):', cfg.reportTime) || ''; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { if (v) notice('Waqt aise likhein: 22:45'); return; } } cfg.reportTime = v; paintSet(); save({ reportTime: v }); return; }
  if (d.rsAt) { let v = d.rsAt; if (v === 'apna') { v = prompt('Alert ka waqt (jaise 08:30):', cfg.alertTime) || ''; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { if (v) notice('Waqt aise likhein: 08:30'); return; } } cfg.alertTime = v; paintSet(); save({ alertTime: v }); return; }
  if (d.rsRed) { const [a, b] = d.rsRed.split('/').map(Number); cfg.alertRed = a; cfg.alertYellow = b; paintSet(); save({ alertRed: a, alertYellow: b }); return; }
  if (d.rsSmall) { cfg.wsSmall = Number(d.rsSmall); paintSet(); save({ wsSmall: cfg.wsSmall }); return; }
  if (d.rsWsdel) { const l = (cfg.wsNames || []).filter(x => x !== d.rsWsdel); if (!l.length) { notice('Kam se kam ek naam rakhein'); return; } cfg.wsNames = l; paintSet(); save({ wsNames: l }); return; }
  if (d.rsWsadd != null) { const v = (prompt('Wholesale customer / account ka naam (POS mein jaisa likha hai):') || '').trim(); if (!v) return; const l = [...new Set([...(cfg.wsNames || []), v])]; cfg.wsNames = l; paintSet(); save({ wsNames: l }); return; }
  if (d.rsAlertnow != null) { cloud.setReportConfig({ alertNow: 1 }).then(() => notice('🖥 Server PC ko keh diya — 1 minute mein ⏰ khabar')).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; }
});
document.addEventListener('change', e => { if (!e.target.matches?.('[data-rp-date]')) return; const v = e.target.value; if (!v || v > today()) return; day = v; watch(); paintIf(); });

// ---------- ⚙️ setting ----------
function setHTML() {
  const C = (on, attr, v, lab) => `<button type="button" class="${on ? 'on' : ''}" data-${attr}="${esc(v)}">${lab}</button>`;
  const rt = ['21:00', '22:00', '22:30', '23:00'], at = ['08:00', '09:00', '10:00'], rd = [[2, 5], [3, 7], [5, 10]];
  return `<div class="rs-root">
    <button type="button" class="rs-back" data-rs-back="1">← Report</button>
    <div class="rs-card"><h4>🌙 Raat ki report</h4><div class="mchips">${C(cfg.reportOn !== false, 'rs-on', 'reportOn:1', '🟢 ON')}${C(cfg.reportOn === false, 'rs-on', 'reportOn:0', '⚪ Band')}</div>
      <small>Kis waqt (dukan band hone ke baad)</small><div class="mchips">${rt.map(v => C(cfg.reportTime === v, 'rs-rt', v, v.replace(/^(\d+):/, (m, h) => (h % 12 || 12) + ':') + (Number(v.slice(0, 2)) < 12 ? ' AM' : ' PM'))).join('')}${C(!rt.includes(cfg.reportTime), 'rs-rt', 'apna', '✏️ ' + (!rt.includes(cfg.reportTime) ? esc(cfg.reportTime) : 'Apna'))}</div></div>
    <div class="rs-card"><h4>⏰ Maal khatam hone ki khabar</h4><div class="mchips">${C(cfg.alertOn !== false, 'rs-on', 'alertOn:1', '🟢 ON')}${C(cfg.alertOn === false, 'rs-on', 'alertOn:0', '⚪ Band')}</div>
      <small>Subah kis waqt</small><div class="mchips">${at.map(v => C(cfg.alertTime === v, 'rs-at', v, (Number(v.slice(0, 2)) % 12 || 12) + v.slice(2) + ' AM')).join('')}${C(!at.includes(cfg.alertTime), 'rs-at', 'apna', '✏️ ' + (!at.includes(cfg.alertTime) ? esc(cfg.alertTime) : 'Apna'))}</div>
      <small>Laal / peela — kitne din mein khatam</small><div class="mchips">${rd.map(([a, b]) => C(Number(cfg.alertRed) === a && Number(cfg.alertYellow) === b, 'rs-red', a + '/' + b, `🔴 ${a} · 🟡 ${b} din`)).join('')}</div>
      <button type="button" class="rs-now" data-rs-alertnow="1">⏰ Abhi check karo</button></div>
    <div class="rs-card"><h4>🏷 Wholesale ki nigrani</h4><small>In naamon wale POS bill wholesale gine jayenge</small>
      <div class="mchips rs-ws">${(cfg.wsNames || []).map(n => `<button type="button" data-rs-wsdel="${esc(n)}">${esc(n)} ✕</button>`).join('')}<button type="button" class="rs-add" data-rs-wsadd="1">➕ Naam</button></div>
      <small>⚠️ Shak = aadhi ya zyada lines is se kam pcs ki ho (jaise 1-2 piece)</small><div class="mchips">${[3, 6].map(n => C(Number(cfg.wsSmall) === n, 'rs-small', n, n + ' pcs se kam')).join('')}</div></div>
    <p class="rs-foot">Notification sirf malik ke phone par (app mein notification ON ho). Report Server PC banata hai — yahan AI nahi.</p></div>`;
}
function openSettings() { cfgWatch(); $('dialogTitle').textContent = '⚙️ Report aur khabar'; $('dialogBody').innerHTML = setHTML(); }
function paintSet() { if (document.querySelector('#dialog[open] .rs-root')) $('dialogBody').innerHTML = setHTML(); }

// ---------- push ka link ----------
export function reportDeepLink() {
  let u; try { u = new URL(location.href); } catch { return; }
  const r = u.searchParams.get('report'), a = u.searchParams.get('alert');
  if (!r && !a) return;
  u.searchParams.delete('report'); u.searchParams.delete('alert');
  try { history.replaceState(history.state, '', u.pathname + (u.search ? u.search : '') + u.hash); } catch {}
  if (!isOwner()) return;
  if (r) openReport(r);
  else { route('notes'); setTimeout(() => $('ntPo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600); }
}
export const _reportTest = { html, setHTML, pdfHTML, set: (r, d) => { rep = r; day = d; } };
