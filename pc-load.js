// pc-load.js — 📊 PC KA BOJH (v2.373.0, 2026-11-24) — malik: 'script mein PC ka mukammal data usage, CPU aur RAM ka aaye · koi chart waghera ·
//   taake PC par se bojh kam kiya ja sake'. Sirf malik (Settings → 🖥️ PC scripts ka 🔥 dabba → '📊 Poora hisaab', aur 👀 Nigrani menu ka 🔥 card).
// Data: blueAccess/pcLoad (PC doctor v3.14 — har 5 min ek nuqta, 24 ghante) + pcCpu (abhi) + waLinkOut (wa-out v1.36: aaj ki WhatsApp videos).
// Screen: upar 2 patli lines (CPU / RAM / network) · chart 1 = CPU % + RAM % (ek hi % ka paimana) · chart 2 = network ↑ / ↓ har hisse mein ·
//   neeche 'Kaun kitna kha raha' (har kaam ka average CPU + RAM) + mashwara + seedha button. PC par khud kuch band NAHI hota. AI nahi.
// Network = PC ke asli adapter ka kul — download mein cameras ka LAN bhi (Windows har program ka internet alag nahi deta).
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tm = ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
// v2.376.0: doctor v3.15 pcLoad.nic = 'Wireless80211~144~naam,Ethernet~1000~naam' (jin par traffic hai)
const nicOf = s => String(s || '').split(',').map(x => { const [k, sp] = x.split('~'); return k ? { w: /wireless|wifi|802/i.test(k), sp: Number(sp) || 0 } : null; }).filter(Boolean).slice(0, 4);
const mb = kb => { kb = Number(kb) || 0; return kb >= 1048576 ? (Math.round(kb / 104857.6) / 10) + ' GB' : kb >= 1024 ? Math.round(kb / 1024) + ' MB' : Math.round(kb) + ' KB'; };
const dayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const C1 = '#2a78d6', C2 = '#eb6834';   // dataviz reference palette — slot 1 (blue) + slot 2 (orange), adjacent pair validated

let A = null, D = null, NOW = null, WL = null, offs = [], win = 360, ddOpen = false;
try { const w = Number(localStorage.getItem('sam-pcl-win')); if ([60, 360, 1440].includes(w)) win = w; } catch {}
const WINS = [[60, '1 ghanta'], [360, '6 ghante'], [1440, '24 ghante']];

// ---------- naam + mashwara (PC ke label se) ----------
const NAMES = [
  [/sab cameras/i, '📼 Sab cameras ki group recording'], [/camera recording/i, '🎞 Har camera ki recording'], [/live camera/i, '🔴 Live camera (video banana)'],
  [/bill ki clip/i, '🎬 Bill ki video banana'], [/^ffmpeg$/i, '🎥 ffmpeg (doosra video kaam)'], [/^bill-clip\.js/i, '🎬 Bill video (bill-clip)'],
  [/^live-cam\.js/i, '🔴 Live camera (live-cam)'], [/^wa-out\.js/i, '📲 WhatsApp Business (wa-out)'], [/^wa-parchi\.js/i, '📲 WhatsApp parchi (wa-parchi)'],
  [/^pos-sales-dekho\.js/i, '🧾 Bills dekhna (pos-sales-dekho)'], [/^pos-khata-sync\.js/i, '📒 Khata ↔ POS (pos-khata-sync)'], [/^transfer-sync\.js/i, '⇄ Transfer + bank (transfer-sync)'],
  [/^ginti-cam\.js/i, '📦 Loading ginti AI (ginti-cam)'], [/^doctor\.js/i, '🩺 Doctor (nigraan)'], [/^sync-stock\.js/i, '📦 Stock sync'], [/^gate-pass\.js/i, '🚪 Gate pass'],
  [/^sale-post\.js/i, '🧾 Sale bill post'], [/^nt-print\.js/i, '🖨 NT-PRINT'], [/^a4-print\.js/i, '🖨 A4 print'], [/^label-print\.js/i, '🏷 Label print'],
];
const nameOf = l => { for (const [re, n] of NAMES) if (re.test(l)) return n; return l; };
function tipOf(l) {
  if (/sab cameras/i.test(l)) return ['Sab cameras ek video mein — har camera decode hota hai, sab se bhaari kaam. Zaroorat na ho to BAND karein ya waqt chhota.', 'wg', '👥 Group videos'];
  if (/camera recording/i.test(l)) return ['Bill / gate pass ki video isi se banti hai — band nahi karni. Aam taur par halki (sirf copy).'];
  if (/live/i.test(l)) return ['Sirf jab koi Live dekh raha ho — app band karte hi 2-5 min mein khud band.'];
  if (/bill ki clip|bill-clip/i.test(l)) return ['Har bill ki video. 👥 Group videos ki din ki hadd kam karne se kam hota hai.', 'wg', '👥 Group videos'];
  if (/ginti/i.test(l)) return ['Camera AI — isi PC scripts screen par 🤖 switch se BAND kar sakte hain.', 'ai', '🤖 Camera AI switch'];
  if (/sql server/i.test(l)) return ['POS ka database — zaroori, band nahi hota.'];
  if (/defender|antivirus/i.test(l)) return ['Antivirus ka scan — thori der mein khud kam. Bar bar ho to scan ka waqt raat ko rakhein.'];
  if (/chrome|edge/i.test(l)) return ['Server PC par khule tabs / videos band karein.'];
  if (/wa-out|wa-parchi|whatsapp/i.test(l)) return ['WhatsApp — video / tasveer bhejte waqt barhta hai, aam baat.'];
  if (/powershell/i.test(l)) return ['Chhote kaam (printer / naap) — aam.'];
  if (/^baqi/i.test(l)) return ['Chhote program jo minute ke andar shuru ho kar khatam ho gaye.'];
  return null;
}

// ---------- data ----------
function points() {
  if (!D) return { P: [], N: [] };
  let N = [], P = []; try { N = JSON.parse(D.n || '[]'); P = JSON.parse(D.p || '[]'); } catch {}
  const lim = Math.round(Date.now() / 60000) - win;
  return { N, P: (Array.isArray(P) ? P : []).filter(x => Array.isArray(x) && x[0] >= lim) };
}
function progs(P, N) {
  const m = new Map();
  for (const x of P) for (const g of (Array.isArray(x[5]) ? x[5] : [])) { const k = String(N[g[0]] || '?'), p = (Number(g[1]) || 0) / 10, o = m.get(k) || { p: 0, mx: 0, mb: 0, n: 0 }; o.p += p; o.mx = Math.max(o.mx, p); o.mb = Math.max(o.mb, Number(g[2]) || 0); o.n++; m.set(k, o); }
  const cnt = P.length || 1;
  return [...m.entries()].map(([k, o]) => ({ k, avg: o.p / cnt, mx: o.mx, mb: o.mb })).sort((a, b) => b.avg - a.avg);
}

// ---------- chart 1: CPU % + RAM % ----------
const VW = 340, VH = 150, PL = 30, PR = 62, PT = 10, PB = 22;   // PR = daayein label (CPU 35%) ki jagah
function lineHTML(P) {
  if (P.length < 2) return `<p class="pcl-empty">${P.length ? '⏳ Abhi sirf ek nuqta — 5-10 min mein chart ban jayega' : '⏳ PC se hisaab abhi nahi aaya'}</p>`;
  const t0 = P[0][0], t1 = P[P.length - 1][0], span = Math.max(5, t1 - t0), X = t => PL + (t - t0) / span * (VW - PL - PR), Y = v => PT + (1 - Math.min(100, Math.max(0, v)) / 100) * (VH - PT - PB);
  const path = i => { let d = '', prev = null; for (const x of P) { const pen = prev === null || x[0] - prev > 12 ? 'M' : 'L'; d += `${pen}${X(x[0]).toFixed(1)},${Y(x[i]).toFixed(1)} `; prev = x[0]; } return d; };   // 12 min se zyada khali = PC band — lakeer tooti
  const last = P[P.length - 1], grid = [0, 50, 100].map(v => `<line x1="${PL}" x2="${VW - PR}" y1="${Y(v)}" y2="${Y(v)}" class="pcl-g"/><text x="${PL - 4}" y="${Y(v) + 3}" class="pcl-ax" text-anchor="end">${v}%</text>`).join('');
  const xt = [t0, t0 + span / 2, t1].map((t, i) => `<text x="${X(t)}" y="${VH - 6}" class="pcl-ax" text-anchor="${['start', 'middle', 'end'][i]}">${tm(t * 60000)}</text>`).join('');
  const lab = (i, c, n) => { const v = last[i]; return `<circle cx="${X(last[0])}" cy="${Y(v)}" r="3" fill="${c}" stroke="#fcfcfb" stroke-width="2"/><text x="${X(last[0]) + 6}" y="${Y(v) + 3}" class="pcl-dl">${n} ${v}%</text>`; };
  const yC = Y(last[1]), yR = Y(last[2]), sep = Math.abs(yC - yR) < 11;   // dono label takrayein to sirf CPU
  return `<div class="pcl-legend"><span><i style="background:${C1}"></i>CPU</span><span><i style="background:${C2}"></i>RAM</span><small>90% se upar = PC atakta hai</small></div>
    <div class="pcl-cw" data-pcl-line><svg viewBox="0 0 ${VW} ${VH}" class="pcl-svg" role="img" aria-label="CPU aur RAM ka chart">${grid}
      <line x1="${PL}" x2="${VW - PR}" y1="${Y(90)}" y2="${Y(90)}" class="pcl-g90"/>${xt}
      <path d="${path(2)}" fill="none" stroke="${C2}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${path(1)}" fill="none" stroke="${C1}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${lab(1, C1, 'CPU')}${sep ? '' : lab(2, C2, 'RAM')}<line class="pcl-cx" x1="0" x2="0" y1="${PT}" y2="${VH - PB}" visibility="hidden"/></svg><div class="pcl-tip" hidden></div></div>`;
}
// ---------- chart 2: network ↑ / ↓ ----------
function bars(P) {
  const bk = win <= 60 ? 5 : win <= 360 ? 30 : 60, m = new Map();
  for (const x of P) { if (!(x[3] >= 0)) continue; const b = Math.floor(x[0] / bk) * bk, o = m.get(b) || { up: 0, dn: 0 }; o.up += x[3]; o.dn += x[4]; m.set(b, o); }
  return { bk, L: [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, o]) => ({ t, ...o })) };
}
function barHTML(P) {
  const { bk, L } = bars(P); if (!L.length) return '<p class="pcl-empty">⏳ Network ka hisaab abhi nahi (PC update ke baad)</p>';
  const mx = Math.max(1, ...L.map(x => Math.max(x.up, x.dn))), n = L.length, cw = (VW - PL - 8) / n, bw = Math.max(2, Math.min(14, cw / 2 - 2)), Y = v => PT + (1 - v / mx) * (VH - PT - PB), H = v => (VH - PB) - Y(v);
  const rb = (x, y, w, h, c) => h <= 0 ? '' : `<path d="M${x},${VH - PB} V${y + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, w / 2)},-${Math.min(4, h)} H${x + w - Math.min(4, w / 2)} q${Math.min(4, w / 2)},0 ${Math.min(4, w / 2)},${Math.min(4, h)} V${VH - PB} Z" fill="${c}"/>`;
  const items = L.map((x, i) => { const cx = PL + i * cw + cw / 2; return `<g data-pcl-b="${i}">${rb(cx - bw - 1, Y(x.up), bw, H(x.up), C1)}${rb(cx + 1, Y(x.dn), bw, H(x.dn), C2)}<rect x="${PL + i * cw}" y="${PT}" width="${cw}" height="${VH - PT - PB}" fill="transparent"/></g>`; }).join('');
  const xt = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => `<text x="${PL + i * cw + cw / 2}" y="${VH - 6}" class="pcl-ax" text-anchor="middle">${tm(L[i].t * 60000)}</text>`).join('');
  bars.last = { bk, L };
  return `<div class="pcl-legend"><span><i style="background:${C1}"></i>↑ Upload (zyada tar internet)</span><span><i style="background:${C2}"></i>↓ Download (cameras ka LAN bhi)</span><small>har dandi = ${bk < 60 ? bk + ' min' : '1 ghanta'}</small></div>
    <div class="pcl-cw" data-pcl-bars><svg viewBox="0 0 ${VW} ${VH}" class="pcl-svg" role="img" aria-label="Network ka chart"><line x1="${PL}" x2="${VW - 8}" y1="${VH - PB}" y2="${VH - PB}" class="pcl-g"/><text x="${PL - 4}" y="${PT + 6}" class="pcl-ax" text-anchor="end">${mb(mx)}</text>${items}${xt}</svg><div class="pcl-tip" hidden></div></div>`;
}

// ---------- paint ----------
function paint() {
  const d = $('pclDlg'); if (!d?.open) return;
  const body = d.querySelector('.pcl-body'); if (!body) return;
  const { P, N } = points(), sy = body.scrollTop;
  const cpu = P.map(x => x[1]), ram = P.map(x => x[2]), avg = a => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0;
  const up = P.reduce((s, x) => s + (x[3] > 0 ? x[3] : 0), 0), dn = P.reduce((s, x) => s + (x[4] > 0 ? x[4] : 0), 0), hasNet = P.some(x => x[3] >= 0);   // v2.376.0: naap na ho = '0 KB' nahi, saaf likho
  const nic = nicOf(D && D.nic), wifi = nic.some(x => x.w), lan = nic.some(x => !x.w);
  const now = NOW && Date.now() - (Number(NOW.at) || 0) < 3 * 60000 ? NOW : null, old = D && Date.now() - (Number(D.at) || 0) > 15 * 60000;
  const wa = WL && WL.vday === dayKey() ? `📲 Aaj WhatsApp videos: ${Number(WL.vn) || 0} · ${mb(WL.vk)}` : '';
  const pr = progs(P, N), heavy = pr.filter(x => x.avg >= 15 || x.mx >= 50);
  body.innerHTML = `
    ${!D ? '<p class="pcl-warn">⏳ PC se pehla hisaab abhi nahi aaya — PC update (doctor v3.14) ke 5-10 min baad. PC band ho to PC chalne par.</p>' : old ? `<p class="pcl-warn">⚠ PC se ${Math.round((Date.now() - D.at) / 60000)} min se naya hisaab nahi — PC band / doctor ruka?</p>` : ''}
    <div class="pcl-pat"><b>🔥 CPU ${now ? 'abhi ' + now.cpu + '% · ' : ''}avg ${avg(cpu)}% · max ${cpu.length ? Math.max(...cpu) : 0}%</b>
      <span>💾 RAM avg ${avg(ram)}%${D?.ramGb ? ' / ' + D.ramGb + ' GB' : ''} · 📶 ${hasNet ? '↑ ' + mb(up) + ' · ↓ ' + mb(dn) : 'network ka naap abhi nahi (PC update ke 10 min baad)'}${wa ? ' · ' + wa : ''}</span>${nic.length ? `<span>${nic.map(x => (x.w ? '📶 Wi-Fi' : '🔌 LAN taar') + (x.sp > 0 ? ' ' + x.sp + ' Mbps' : '')).join(' · ')}</span>` : ''}</div>
    ${wifi && !lan ? '<p class="pcl-warn">📶 Server PC Wi-Fi se jura hai — cameras (NVR) ki video aur WhatsApp uploads ek hi Wi-Fi par. Rush mein Wi-Fi bhar jaye to camera / recording grey ho jati hai. Sab se pakka ilaaj: PC aur NVR ko LAN taar se jorein.</p>' : ''}
    ${avg(cpu) >= 70 && pr[0] ? `<p class="pcl-warn">⚠ Is waqt mein PC par bojh zyada — sab se bhaari: ${esc(nameOf(pr[0].k))} (${Math.round(pr[0].avg)}%)</p>` : ''}
    <h3 class="pcl-h">CPU aur RAM</h3>${lineHTML(P)}
    <h3 class="pcl-h">📶 Network</h3>${barHTML(P)}
    <h3 class="pcl-h">Kaun kitna kha raha <small>${heavy.length ? '⚠ ' + heavy.length + ' bhaari' : ''}</small></h3>
    <div class="pcl-list">${pr.slice(0, 12).map(x => { const t = tipOf(x.k), hv = x.avg >= 15 || x.mx >= 50;
      return `<div class="pcl-row${hv ? ' hv' : ''}"><div class="pcl-r1"><b>${esc(nameOf(x.k))}</b><span class="pcl-v">${Math.round(x.avg * 10) / 10}%</span></div>
        <div class="pcl-bar"><i style="width:${Math.max(1.5, Math.min(100, x.avg))}%"></i></div>
        <div class="pcl-r2">max ${Math.round(x.mx)}%${x.mb ? ' · RAM ' + (x.mb >= 1024 ? (Math.round(x.mb / 102.4) / 10) + ' GB' : x.mb + ' MB') : ''}${hv ? ' · <em>⚠ bhaari</em>' : ''}</div>
        ${t ? `<div class="pcl-r3">💡 ${esc(t[0])}${t[1] ? ` <button type="button" class="pcl-go" data-pcl-go="${t[1]}">${esc(t[2])}</button>` : ''}</div>` : ''}</div>`; }).join('') || '<p class="pcl-empty">Abhi koi program ka hisaab nahi</p>'}</div>
    <p class="pcl-note">% = poore PC ka hissa (sab core). Har 5 min ka average — chhoti der ki tezi chart mein kam dikhti hai. PC par yahan se kuch band nahi hota — faisla aap ka.</p>`;
  body.scrollTop = sy;
}
function head() {
  const w = WINS.find(x => x[0] === win) || WINS[1];
  return `<div class="pcl-head"><b>🔥 PC ka bojh</b><span class="pcl-wsel"><button type="button" class="pcl-chip" data-pcl-dd="1">🕒 ${w[1]} ▾</button>
    <span class="pcl-dd"${ddOpen ? '' : ' hidden'}>${WINS.map(([v, n]) => `<button type="button" data-pcl-w="${v}" class="${v === win ? 'is-in' : ''}">${v === win ? '✓ ' : ''}${n}</button>`).join('')}</span></span>
    <button type="button" class="pcl-x" data-pcl-x="1" aria-label="Band">×</button></div>`;
}
function tipAt(cw, e) {
  const svg = cw.querySelector('svg'), tip = cw.querySelector('.pcl-tip'); if (!svg || !tip) return;
  const r = svg.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, vx = fx * VW;
  if (cw.dataset.pclLine !== undefined) {
    const { P } = points(); if (P.length < 2) return;
    const t0 = P[0][0], t1 = P[P.length - 1][0], span = Math.max(5, t1 - t0), tt = t0 + (vx - PL) / (VW - PL - PR) * span;
    let b = P[0]; for (const x of P) if (Math.abs(x[0] - tt) < Math.abs(b[0] - tt)) b = x;
    const xl = PL + (b[0] - t0) / span * (VW - PL - PR), ln = svg.querySelector('.pcl-cx'); if (ln) { ln.setAttribute('x1', xl); ln.setAttribute('x2', xl); ln.setAttribute('visibility', 'visible'); }
    tip.innerHTML = `<b>${tm(b[0] * 60000)}</b> · <i style="background:${C1}"></i>CPU ${b[1]}% · <i style="background:${C2}"></i>RAM ${b[2]}%`;
  } else {
    const B = bars.last; if (!B || !B.L.length) return; const i = Math.max(0, Math.min(B.L.length - 1, Math.floor((vx - PL) / ((VW - PL - 8) / B.L.length)))), x = B.L[i];
    tip.innerHTML = `<b>${tm(x.t * 60000)} – ${tm((x.t + B.bk) * 60000)}</b> · <i style="background:${C1}"></i>↑ ${mb(x.up)} · <i style="background:${C2}"></i>↓ ${mb(x.dn)}`;
  }
  tip.hidden = false; tip.style.left = Math.max(0, Math.min(62, fx * 100 - 18)) + '%';   // % se — html zoom
}
function onClick(e) {
  const t = e.target, d = $('pclDlg');
  if (t.closest('[data-pcl-x]')) { d.close(); return; }
  if (t.closest('[data-pcl-dd]')) { ddOpen = !ddOpen; d.querySelector('.pcl-dd').hidden = !ddOpen; return; }
  const w = t.closest('[data-pcl-w]'); if (w) { win = Number(w.dataset.pclW) || 360; ddOpen = false; try { localStorage.setItem('sam-pcl-win', String(win)); } catch {} d.querySelector('.pcl-head').outerHTML = head(); paint(); return; }
  if (ddOpen && !t.closest('.pcl-wsel')) { ddOpen = false; const dd = d.querySelector('.pcl-dd'); if (dd) dd.hidden = true; }
  const go = t.closest('[data-pcl-go]'); if (go) {
    if (go.dataset.pclGo === 'wg') { if (typeof window.ntBtWg === 'function') { d.close(); window.ntBtWg(); } else A?.notice?.('👀 Nigrani screen → 👥 Group videos se'); return; }
    if (go.dataset.pclGo === 'ai') { d.close(); setTimeout(() => { const el = $('pcAi'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); else A?.notice?.('Settings → 🖥️ PC scripts → 🤖 Camera AI'); }, 150); return; }
  }
  const cw = t.closest('[data-pcl-line],[data-pcl-bars]'); if (cw) tipAt(cw, e);
}
window.ntPclClose = () => { const d = $('pclDlg'); if (!d?.open) return false; try { d.close(); } catch { d.removeAttribute('open'); } return true; };

export function openPcLoad(o) {
  A = o || A; if (!A?.cloud?.listenPcLoad) { A?.notice?.('App update karein'); return; }
  let d = $('pclDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'pclDlg'; d.className = 'pcl-dlg'; document.body.append(d);
    d.addEventListener('click', onClick);
    d.addEventListener('pointermove', e => { const cw = e.target.closest?.('[data-pcl-line],[data-pcl-bars]'); if (cw && e.pointerType === 'mouse') tipAt(cw, e); });
    d.addEventListener('close', () => { for (const f of offs) { try { f(); } catch {} } offs = []; });
  }
  ddOpen = false; d.innerHTML = head() + '<div class="pcl-body"><p class="pcl-empty">⏳</p></div>';
  if (!d.open) d.showModal();
  for (const f of offs) { try { f(); } catch {} } offs = [];
  offs.push(A.cloud.listenPcLoad(x => { D = x; paint(); }));
  if (A.cloud.listenPcCpu) offs.push(A.cloud.listenPcCpu(x => { NOW = x; paint(); }));
  if (A.cloud.listenWaLinkOut) offs.push(A.cloud.listenWaLinkOut(x => { WL = x || null; paint(); }));
  paint();
}
export const _t = { nameOf, tipOf, progs, bars };
