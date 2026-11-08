// wa-out.js — v2.196.0: 📲 GAHAK KO WHATSAPP PARCHI (naya number) — malik 7 Nov 2026: "WhatsApp wala karna hai, wo ek naya number hai,
// Noor Traders ka business account". PC `wa-out.js` (dukan ka ALAG WhatsApp Business number, linked device) har nayi khata entry par
// gahak ko text parchi bhejta hai — sirf un khaton par jahan malik ne "📲 WhatsApp parchi" ON kiya ho (party.wa) + mobile number ho.
// Yahan: Settings ki khirki — number jorna (🔢 code / 🔳 QR), chalu / band, roz ki hadd, faasla, aaj ki ginti, aakhri 60 bheje hue.
// Data: blueAccess/waLinkOut (PC likhe) · waCmdOut (app → PC) · waOutCfg (malik) · waOutLog (PC). AI nahi.
let C = null, wl = null, wlErr = '', wlStop = null, cf = null, cfStop = null, lg = null, lgStop = null, pt = null, ptStop = null, qrLast = '', st = { cmd: '', cfg: '' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const perm = e => /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || ''));
const tms = v => typeof v === 'number' ? v : v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : Number(v) || 0;
const ago = ms => { if (!ms) return ''; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' ghante' : Math.floor(m / 1440) + ' din'; };
const phNorm = v => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('0092')) d = d.slice(2); if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2); if (d.length === 10 && d.startsWith('3')) d = '0' + d; return /^03\d{9}$/.test(d) ? d : ''; };
const withT = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(Error('Server ne jawab nahi diya')), ms))]);
const alive = () => !!document.querySelector('#dialogBody [data-wo-root]');
const stTxt = s => s === 'w' ? '⏳' : s === 'ok' ? '✅' : s === 'bad' ? '❌' : '';
const tmFmt = t => new Date(t).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });

export function woSetup(c) {
  C = c;
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.matches?.('#dialogBody [data-wo-ph]')) { e.preventDefault(); cmd('code'); } });
}
function unlisten() { for (const f of [wlStop, cfStop, lgStop, ptStop]) { try { f?.(); } catch {} } wlStop = cfStop = lgStop = ptStop = null; qrLast = ''; }
export function woOpen() {
  if (!C?.owner()) { C?.notice('Sirf malik'); return; }
  qrLast = '';
  C.modal('📲 Gahak ko WhatsApp parchi', `<div class="wps-set" data-wo-root="1"><div data-wo-link="1">${linkHTML()}</div><div data-wo-cfg="1">${cfgHTML()}</div><div data-wo-call="1">${callHTML()}</div><div data-wo-pt="1">${ptHTML()}</div><div data-wo-log="1">${logHTML()}</div></div>`, true);
  if (!wlStop && C.cloud?.listenWaLinkOut) wlStop = C.cloud.listenWaLinkOut((d, e) => { if (!alive()) return; if (e) wlErr = perm(e) ? 'rules' : 'net'; else { wl = d || {}; wlErr = ''; } paint('link'); });
  if (!cfStop && C.cloud?.listenWaOutCfg) cfStop = C.cloud.listenWaOutCfg((d, e) => { if (!alive()) return; if (!e) { cf = d; paint('cfg'); } });
  if (!ptStop && C.cloud?.listenParchiTrack) ptStop = C.cloud.listenParchiTrack((d, e) => { if (!alive()) return; if (!e) { pt = d; paint('pt'); } });
  if (!lgStop && C.cloud?.listenWaOutLog) lgStop = C.cloud.listenWaOutLog((d, e) => { if (!alive()) return; if (!e) { lg = d; paint('log'); } });
  try { $('dialog')?.addEventListener('close', unlisten, { once: true }); } catch {}
  qrPaint();
}
const cfgNow = () => ({ on: cf?.on !== false, lim: Math.max(10, Math.min(500, Number(cf?.lim) || 150)), gap: Math.max(3, Math.min(60, Number(cf?.gap) || 8)), stMin: Math.max(1, Math.min(60, Number(cf?.stMin) || 5)), vMin: Math.max(1, Math.min(60, Number(cf?.vMin) || 6)), cMin: Math.max(1, Math.min(90, Number(cf?.cMin) || 8)), mMin: Math.max(1, Math.min(120, Number(cf?.mMin) || 12)), hook: String(cf?.hook || ''), callTo: String(cf?.callTo || '') });
const MACRO_LINK = 'https://macrodroidlink.com/m/cwLDavCZf6CN';   // 📞 NT Call Mubeen (HBL phone) — 14 Nov 2026 tak; baad mein naya link maangein
let ck = '';   // 📞 chaabi (callKey) — sirf is khirki mein
function linkHTML() {
  const hd = '<h4>📱 Bhejne wala number (dukan ka WhatsApp Business — alag number)</h4>';
  if (wlErr === 'rules') return `<div class="wps-sec">${hd}<p class="wps-err">🔐 Ijazat nahi (rules).</p></div>`;
  const L = wl || {}, at = tms(L.at), s = String(L.st || ''), quiet = !!at && Date.now() - at > 6 * 60000;
  const [cl, t, sub] = !at ? ['w', '🖥 PC ne abhi jawab nahi diya', 'PC ki nayi script (wa-out.js) 3–5 min mein khud lagti hai — PC ON hai?']
    : s === 'open' ? ['ok', '🟢 Juda hai' + (L.me ? ' · 📱 ' + esc(L.me) : ''), 'Har nayi khata entry (jin khaton par 📲 ON hai) par gahak ko parchi khud jati hai — phone jeb mein ho, screen band ho, phir bhi.']
    : s === 'qr' ? ['warn', '🟡 QR scan karein', 'Naye number wale phone mein WhatsApp Business kholein → ⋮ → Linked devices → Link a device → neeche wala QR.']
    : s === 'code' ? ['warn', '🔢 Yeh code phone mein likhein', 'WhatsApp Business → ⋮ → Linked devices → Link a device → "Link with phone number instead" → yeh 8 harf.']
    : s === 'closed' ? ['bad', '🔴 Rabta toota', String(L.err || '')]
    : s === 'error' ? ['bad', '⚠️ Ghalti', String(L.err || '')]
    : ['w', '⚪ Abhi juda nahi', L.err ? String(L.err) : 'Naya number ek dafa jorein — phir sab khud.'];
  const pcl = at ? `🖥 ${esc(L.host || 'PC')}${L.ver ? ' · v' + esc(L.ver) : ''} · ${ago(at) === 'abhi' ? 'abhi' : ago(at) + ' pehle'}${quiet ? ' · <b class="wps-err">⚠️ PC par wa-out chup — Settings → 🖥️ PC scripts dekhein</b>' : ''}` : '';   // v2.203.1: band / juda na ho tab bhi chup dikhao (PC v1.1 har 5 min heartbeat)
  const cnt = at ? `<small class="wps-mut">📤 Aaj bheje: <b>${Number(L.n) || 0}</b> / ${cfgNow().lim}${L.last?.at ? ` · aakhri: ${esc(L.last.nm || '')} ${esc(L.last.to || '')} (${ago(tms(L.last.at)) === 'abhi' ? 'abhi' : ago(tms(L.last.at)) + ' pehle'})` : ''}</small>` : '';
  const qr = s === 'qr' && L.qr ? `<div class="wps-qr" data-wo-qr="1">⏳ QR ban raha…</div>${at && Date.now() - at > 60000 ? '<p class="wps-err">⚠️ QR purana ho sakta hai — 🔄 Naya QR dabayein</p>' : ''}` : '';
  const code = s === 'code' && L.code ? `<div class="wps-pcode">${esc(L.code)}</div>${L.codeFor ? `<small class="wps-mut">📱 ${esc(L.codeFor)} ke liye · 2–3 min mein likhein, warna 🔄 Naya code</small>` : ''}` : '';
  const phIn = s === 'open' ? '' : `<div class="wps-nadd"><input type="tel" inputmode="tel" data-wo-ph="1" maxlength="20" placeholder="Naya number: 0329-xxxxxxx" value="${esc(L.codeFor || L.me || '')}" autocomplete="off" enterkeyhint="done"></div>`;
  const btn = s === 'open' ? '<button type="button" class="wps-tc bad" data-wo-cmd="logout">⛔ Unlink</button>'
    : s === 'qr' ? '<button type="button" class="wps-tc" data-wo-cmd="relink">🔄 Naya QR</button><button type="button" class="wps-tc bad" data-wo-cmd="logout">✕ Rehne dein</button>'
    : s === 'code' ? '<button type="button" class="wps-tc" data-wo-cmd="code">🔄 Naya code</button><button type="button" class="wps-tc bad" data-wo-cmd="logout">✕ Rehne dein</button>'
    : '<button type="button" class="wps-tc pri" data-wo-cmd="code">🔢 Code se jorein</button><button type="button" class="wps-tc" data-wo-cmd="link">🔳 QR se</button>';
  return `<div class="wps-sec">${hd}<div class="wps-lk ${cl}"><b>${t}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${pcl ? `<small class="wps-mut">${pcl}</small>` : ''}${cnt}</div>${qr}${code}${s === 'code' ? '' : phIn}<div class="wps-row">${btn}<i class="wps-wst">${stTxt(st.cmd)}</i></div>
    <small class="wps-mut">⚠️ Yeh Meta ka official raasta nahi — is liye dukan ka ASAL number nahi, alag number. Thora thora bhejta hai (faasla + roz ki hadd) taake number mehfooz rahe.</small></div>`;
}
function cfgHTML() {
  const c = cfgNow(), seg = (k, v, t) => `<button type="button" class="wps-tc${c[k] === v ? ' is-in' : ''}" data-wo-set="${k}:${v}">${t}</button>`;
  return `<div class="wps-sec"><h4>⚙️ Kaam</h4><div class="wps-row"><button type="button" class="wps-tc${c.on ? ' is-in' : ''}" data-wo-set="on:${c.on ? 0 : 1}">${c.on ? '✅ Chalu' : '⛔ Band'}</button><i class="wps-wst">${stTxt(st.cfg)}</i></div>
    <div class="wps-row"><span class="wps-mut">Roz ki hadd</span>${seg('lim', 50, '50')}${seg('lim', 100, '100')}${seg('lim', 150, '150')}${seg('lim', 300, '300')}</div>
    <div class="wps-row"><span class="wps-mut">Faasla</span>${seg('gap', 5, '5 s')}${seg('gap', 8, '8 s')}${seg('gap', 15, '15 s')}${seg('gap', 30, '30 s')}</div>
    <div class="wps-row"><span class="wps-mut">⏰ "start" nahi → likha paigham</span>${seg('stMin', 3, '3 min')}${seg('stMin', 5, '5 min')}${seg('stMin', 10, '10 min')}${seg('stMin', 15, '15 min')}</div>
    <div class="wps-row"><span class="wps-mut">🔊 computer ki awaz</span>${seg('vMin', 4, '4 min')}${seg('vMin', 6, '6 min')}${seg('vMin', 8, '8 min')}${seg('vMin', 12, '12 min')}</div>
    <div class="wps-row"><span class="wps-mut">📞 SIM call (HBL phone)</span>${seg('cMin', 5, '5 min')}${seg('cMin', 8, '8 min')}${seg('cMin', 10, '10 min')}${seg('cMin', 15, '15 min')}</div>
    <div class="wps-row"><span class="wps-mut">👑 aap ko khabar</span>${seg('mMin', 10, '10 min')}${seg('mMin', 12, '12 min')}${seg('mMin', 15, '15 min')}${seg('mMin', 20, '20 min')}</div>
    <small class="wps-mut">📲 Kis gahak ko: us ke khate ke ⋮ → "📲 WhatsApp parchi ON" (mobile number khate mein ho). Bank / kharcha khate par nahi. Paigham: naam · tareekh · raqam · sabqa / ab baqaya · tafseel · voucher no.</small></div>`;
}
function callHTML() {   // 📞 HBL phone ka MacroDroid — webhook Device ID + chaabi (callKey) + Mubeen ka number
  const c = cfgNow(), ok = !!c.hook;
  return `<div class="wps-sec"><h4>📞 SIM call — HBL wala phone (MacroDroid)</h4>
    <div class="wps-lk ${ok ? 'ok' : 'warn'}"><b>${ok ? '✅ Phone juda (Device ID laga hai)' : '⚪ Abhi Device ID nahi'}</b><small>PC phone ko jagata hai → phone Mubeen ko call → utha le to speaker par Urdu mein bole → 28 s nahi uthai = kaat de → haal yahan list mein.</small></div>
    <div class="wps-nadd"><input type="text" data-wo-hook="1" maxlength="80" placeholder="MacroDroid Device ID (Webhook wala)" value="${esc(c.hook)}" autocomplete="off"><button type="button" class="wps-tc pri" data-wo-hooksave="1">💾</button></div>
    <div class="wps-nadd"><input type="tel" inputmode="tel" data-wo-callto="1" maxlength="20" placeholder="Mubeen ka number (khali = print wala)" value="${esc(c.callTo)}" autocomplete="off"><button type="button" class="wps-tc pri" data-wo-callsave="1">💾</button></div>
    <div class="wps-row"><button type="button" class="wps-tc" data-wo-ckey="1">🔑 Chaabi ${ck ? 'dekhein / copy' : 'banao'}</button>${ck ? `<button type="button" class="wps-tc" data-wo-ckcopy="1">📋 Copy</button><button type="button" class="wps-tc bad" data-wo-cknew="1">↻ Nayi</button>` : ''}<a class="wps-tc" href="${MACRO_LINK}" target="_blank" rel="noopener">📥 Macro link</a></div>
    ${ck ? `<div class="wps-pcode" style="font-size:13px;word-break:break-all">${esc(ck)}</div>` : ''}
    <small class="wps-mut">Ek dafa: HBL phone par "📥 Macro link" kholein → MacroDroid mein save → macro ke variable <b>chaabi</b> mein yeh 🔑 chaabi likhein → Phone ki ijazat dein. Device ID: MacroDroid → macro ka Webhook trigger kholein (URL mein <b>trigger.macrodroid.com/XXXX/nt-call</b> — XXXX = Device ID) → upar likhein.</small></div>`;
}
function ptHTML() {   // 📋 Mubeen ki parchiyan (PC wa-parchi v2.6 blueAccess/parchiTrack)
  const L = Array.isArray(pt?.L) ? pt.L : [], at = tms(pt?.at);
  const mn = (a, b) => Math.max(0, Math.round((b - a) / 60000));
  const row = x => {
    const f = tms(x.fwdAt), who = (x.nm ? esc(x.nm) + ' ' : '') + (x.from ? esc(x.from.replace(/^(\d{4})(\d+)$/, '$1-$2')) : '<i class="wo-q">gahak ka number?</i>');
    const stc = x.st === 'done' ? (x.sent ? 'ok' : 'warn') : x.st === 'start' ? 'run' : x.rem ? 'bad' : 'w';
    const cs = x.callSt === 'ans' ? ` · 📞 call uthai (${x.callSec || '?'} s)` : x.callSt === 'noans' ? ` · 📞 nahi uthai${x.calls > 1 ? ' ×2' : ''}` : x.callSt === 'dial' || x.callSt === 'ring' ? ' · 📞 call ja rahi…' : x.callSt === 'off' ? ' · 📞 (phone set nahi)' : x.callSt === 'err' ? ' · 📞 ✕' : '';
    const vs = x.voc ? ' · 🔊 awaz' : '';
    const stt = x.st === 'done' ? (x.sent ? `✅ Bill gahak ko gaya${x.nb > 1 ? ' (' + x.nb + ')' : ''} · ${mn(f, tms(x.doneAt))} min` : '🧾 Bill bana · ' + (x.err || 'gahak ko nahi gaya')) : x.st === 'start' ? `▶️ Shuru · ${mn(f, tms(x.startAt))} min baad` : x.rem ? `⏰ Shuru nahi · yaad-dihani${vs}${cs}` : `⏳ Mubeen ke paas · ${mn(f, Date.now())} min`;
    return `<div class="wo-r pt-${stc}"><i>${x.k === 'txt' ? '📝' : '🧾'}</i><span><b>${who}${x.k === 'txt' && x.tx ? ' · <small>' + esc(x.tx.slice(0, 30)) + '…</small>' : ''}</b><small>${stt}${x.err && x.st !== 'done' ? ' · ' + esc(x.err) : ''}</small></span><em>${esc(tmFmt(f))}</em></div>`;
  };
  return `<div class="wps-sec"><h4>📋 Mubeen ki parchiyan (${L.length})</h4><small class="wps-mut">Aap gahak ki parchi Mubeen ko forward karein → Mubeen usi parchi par reply "start" (${cfgNow().stMin} min mein, warna yaad-dihani) → bill tayyar = usi parchi par reply mein bill ki tasveer → gahak ko khud.${at ? ' · 🖥 ' + (ago(at) === 'abhi' ? 'abhi' : ago(at) + ' pehle') : ''}</small>
    ${L.length ? `<div class="wo-log">${L.map(row).join('')}</div>` : '<small class="wps-mut">Abhi koi parchi nahi (PC wa-parchi v2.6 chahiye).</small>'}</div>`;
}
function logHTML() {
  const L = Array.isArray(lg?.L) ? lg.L.slice().reverse() : [];
  const ic = s => s === 'sent' ? '✅' : s === 'skip' ? '⏭' : '❌';
  return `<div class="wps-sec"><h4>🕘 Aakhri bheje hue (${L.length})</h4>${L.length ? `<div class="wo-log">${L.slice(0, 60).map(x => `<div class="wo-r"><i>${ic(x.st)}</i><span><b>${esc(x.nm || x.to || '')}</b><small>${esc(x.to || '')}${x.code ? ' · ' + esc(x.code) : ''}${x.why ? ' · ' + esc(x.why) : ''}</small></span><em>${esc(tmFmt(tms(x.at)))}</em></div>`).join('')}</div>` : '<small class="wps-mut">Abhi kuch nahi gaya.</small>'}</div>`;
}
function paint(which) {
  const b = document.querySelector(`#dialogBody [data-wo-${which}]`); if (!b) return;
  if (which === 'link') { const i = b.querySelector('[data-wo-ph]'); const v = i ? i.value : null, f = !!i && document.activeElement === i; b.innerHTML = linkHTML(); qrLast = ''; qrPaint(); const n = b.querySelector('[data-wo-ph]'); if (n && v != null) { n.value = v; if (f) n.focus(); } }
  else if (which === 'cfg') { b.innerHTML = cfgHTML(); paint('pt'); paint('call'); }
  else if (which === 'call') { const i1 = b.querySelector('[data-wo-hook]'), i2 = b.querySelector('[data-wo-callto]'), f = document.activeElement; if ((i1 && f === i1) || (i2 && f === i2)) return; b.innerHTML = callHTML(); }
  else if (which === 'pt') b.innerHTML = ptHTML();
  else b.innerHTML = logHTML();
}
let qrLib = null;
function qrLoad() {
  return qrLib || (qrLib = new Promise((ok, no) => {
    if (window.qrcode) { ok(window.qrcode); return; }
    const s = document.createElement('script'); s.src = new URL('./vendor/qrcode.js?v=1.4.4', import.meta.url).href;
    s.onload = () => window.qrcode ? ok(window.qrcode) : no(Error('QR library nahi mili')); s.onerror = () => no(Error('QR library load nahi hui')); document.head.appendChild(s);
  }).catch(e => { qrLib = null; throw e; }));
}
async function qrPaint() {
  const q = String(wl?.qr || ''); if (!q || wl?.st !== 'qr' || q === qrLast || !document.querySelector('#dialogBody [data-wo-qr]')) return;
  try { const qrcode = await qrLoad(), x = qrcode(0, 'M'); x.addData(q); x.make(); const el = document.querySelector('#dialogBody [data-wo-qr]'); if (!el) return; el.innerHTML = x.createSvgTag({ cellSize: 6, margin: 4, scalable: true }); qrLast = q; }
  catch (e) { const el = document.querySelector('#dialogBody [data-wo-qr]'); if (el) el.textContent = '✕ ' + (e?.message || e); }
}
async function cmd(c) {
  if (!C.owner() || !C.cloud?.sendWaCmdOut) return;
  let ph = '';
  if (c === 'code') { const inp = document.querySelector('#dialogBody [data-wo-ph]'); ph = phNorm(inp ? inp.value : (wl?.codeFor || '')); if (!ph) { C.notice('Naya number likhein: 0329-xxxxxxx'); inp?.focus(); return; } }
  if (c === 'relink' && wl?.st === 'open' && !confirm('Number abhi juda hai — naya QR banane se purana link toot jayega. Theek?')) return;
  if (c === 'logout' && wl?.st === 'open' && !confirm('Bhejne wala number PC se ALAG (unlink) karein? Phir gahakon ko parchi nahi jayegi.')) return;
  st.cmd = 'w'; paint('link');
  try { await withT(C.cloud.sendWaCmdOut(c, ph), 12000); st.cmd = 'ok'; C.notice(c === 'logout' ? '⛔ PC ko kaha — number alag' : c === 'code' ? '🔢 PC ko kaha — code 10–30 sec mein' : '🔗 PC ko kaha — QR 10–30 sec mein'); }
  catch (e) { st.cmd = 'bad'; C.notice('✕ ' + (perm(e) ? 'Ijazat nahi' : e?.message || e)); }
  paint('link'); setTimeout(() => { if (st.cmd !== 'w') { st.cmd = ''; paint('link'); } }, 5000);
}
async function setCfg(k, v) {
  const c = cfgNow(); c[k] = k === 'on' ? v === '1' : (k === 'hook' || k === 'callTo') ? String(v) : Number(v); cf = { ...(cf || {}), ...c }; st.cfg = 'w'; paint('cfg');
  try { await withT(C.cloud.saveWaOutCfg(c), 12000); st.cfg = 'ok'; } catch (e) { st.cfg = 'bad'; C.notice('✕ ' + (perm(e) ? 'Ijazat nahi' : e?.message || e)); }
  paint('cfg'); setTimeout(() => { if (st.cfg !== 'w') { st.cfg = ''; paint('cfg'); } }, 4000);
}
async function ckShow(fresh) {   // 🔑 callKey — app banati hai (chat mein kabhi nahi)
  try {
    if (!fresh && !ck) ck = await C.cloud.getCallKey();
    if (fresh || !ck) { const a = new Uint8Array(16); crypto.getRandomValues(a); const k = [...a].map(x => x.toString(16).padStart(2, '0')).join(''); await C.cloud.setCallKey(k); ck = k; C.notice('🔑 Chaabi ban gayi — HBL phone ke macro mein likhein'); }
    paint('call');
  } catch (e) { C.notice('✕ ' + (perm(e) ? 'Ijazat nahi' : e?.message || e)); }
}
function onClick(e) {
  const b = e.target.closest?.('#dialogBody [data-wo-root] button'); if (!b) return;
  if (b.dataset.woCmd) { e.preventDefault(); cmd(b.dataset.woCmd); return; }
  if (b.dataset.woSet) { e.preventDefault(); const [k, v] = b.dataset.woSet.split(':'); setCfg(k, v); return; }
  if (b.dataset.woHooksave) { e.preventDefault(); const i = document.querySelector('#dialogBody [data-wo-hook]'); setCfg('hook', String(i?.value || '').trim()); return; }
  if (b.dataset.woCallsave) { e.preventDefault(); const i = document.querySelector('#dialogBody [data-wo-callto]'); const v = String(i?.value || '').trim(); if (v && !phNorm(v)) { C.notice('Number aisa: 0300-1234567'); return; } setCfg('callTo', phNorm(v) || ''); return; }
  if (b.dataset.woCkey) { e.preventDefault(); ckShow(false); return; }
  if (b.dataset.woCknew) { e.preventDefault(); if (!confirm('Nayi chaabi? HBL phone ke macro mein dobara likhni hogi.')) return; ckShow(true); return; }
  if (b.dataset.woCkcopy) { e.preventDefault(); try { navigator.clipboard.writeText(ck).then(() => C.notice('📋 Chaabi copy ho gayi')); } catch { C.notice('Copy nahi hui — likh lein'); } }
}
