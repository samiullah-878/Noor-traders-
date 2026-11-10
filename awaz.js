// awaz.js — v2.183.0: 🎙 MERI BAATEIN (sirf malik). Malik: "har baat record ho, AI sun kar notes likhe · Drive mein · Sheets mein recording bhi ·
//   recording ka naam jagah ke naam ke saath (Bega home) · recording phone ke folder mein pari rahe · Blue Khata mein kaam tagra kare".
// Raasta: MacroDroid (bahar, charging / gaana / call / dukan Wi-Fi nahi) → phone folder "NT Awaz" → FolderSync → Drive → malik ka
//   Google Apps Script (awaz-gas.js: jagah ka naam, file ka naya naam, Gemini notes, Sheet "Meri Baatein") → yahan awazNotes (khufia chaabi).
// App mein AI NAHI — sirf dikhana, ☐ kaam tick, dhoondo, PDF. Apni <dialog> (web-dukan jaisi), chips ⋮ ke andar (keyboard qaida).
import { smartFind } from './dukan/dhoond.js?v=2.224.0';

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch {} return null; };
const VIEWS = { aaj: ['Aaj', 1], kal: ['Kal', 2], d7: ['7 din', 7], d30: ['30 din', 30] };
let A = null, un = null, notes = null, err = '', view = LS('sam-aw-view') || 'aaj', q = '', onlyKaam = LS('sam-aw-kaam') === '1', showKh = false, mode = 'list', open = '', menu = false, key = null, busyKey = false;
if (!VIEWS[view]) view = 'aaj';

const pk = d => { const z = new Date(d + 5 * 3600e3); return z.toISOString().slice(0, 10); };   // Pakistan din
const today = () => pk(Date.now());
const dayLab = d => d === today() ? 'Aaj' : d === pk(Date.now() - 864e5) ? 'Kal' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const since = () => { const n = VIEWS[view][1]; const d = new Date(today() + 'T00:00:00+05:00').getTime(); return d - (n - 1) * 864e5 - 1; };
const kaamOf = n => (Array.isArray(n.ks) ? n.ks : []).map((t, i) => ({ t: String(t), i, ok: !!(n.dn && n.dn[i]) }));
const textOf = n => [n.tt, n.sum, n.wd, n.who, n.pl, ...(n.ks || [])].join(' ');

export function awOpen(ctx) {
  A = ctx; mode = 'list'; open = ''; menu = false; q = '';
  let d = $('awDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'awDlg'; d.className = 'aw';
    d.innerHTML = `<div class="aw-in"><header class="aw-h"><button type="button" class="aw-x" data-aw="back" aria-label="Wapas">‹</button><b id="awT">🎙 Meri baatein</b><button type="button" class="aw-x" data-aw="menu" aria-label="Aur">⋮</button></header><div class="aw-menu" id="awMenu" hidden></div><div class="aw-b" id="awB"></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', onClick);
    d.addEventListener('input', e => { if (e.target.id === 'awQ') { q = e.target.value; listPaint(); } });
    d.addEventListener('cancel', e => { e.preventDefault(); back(); });
  }
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  window.ntAwClose = () => { back(); return true; };
  watch(); paint();
}
function close() { try { un?.(); } catch {} un = null; const d = $('awDlg'); try { d?.close(); } catch {} window.ntAwClose = null; }
function back() { if (menu) { menu = false; paint(); return; } if (mode !== 'list') { mode = 'list'; paint(); return; } close(); }
function watch() {
  try { un?.(); } catch {} notes = null; err = '';
  un = A.cloud.listenAwaz(since(), (L, e) => { if (e) { err = String(e?.code || e?.message || e); notes = []; } else notes = (L || []).filter(n => !n.hid); paint(); });
}

// ---------- 🖼 screen ----------
function paint() {
  const m = $('awMenu'), b = $('awB'); if (!b) return;
  $('awT').textContent = mode === 'setup' ? '⚙️ Setup — Meri baatein' : '🎙 Meri baatein';
  m.hidden = !menu; if (menu) m.innerHTML = menuHTML();
  if (mode === 'setup') { b.innerHTML = setupHTML(); if (key === null) loadKey(); return; }
  b.innerHTML = `<div class="aw-top"><input id="awQ" type="search" placeholder="🔍 Naam, jagah, cheeni, paise…" value="${esc(q)}" autocomplete="off" enterkeyhint="search"><span class="aw-pill" id="awPill"></span></div><div id="awL"></div>`;
  listPaint();
}
function rows() {
  let L = (notes || []).filter(n => n.src !== 'day' && (showKh || !n.kh));
  if (onlyKaam) L = L.filter(n => kaamOf(n).some(k => !k.ok));
  if (q.trim()) { const hit = new Set(smartFind(L, q, textOf, n => 'aw:' + n.id, 500).hits); L = L.filter(n => hit.has(n)); }
  return L.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
}
function listPaint() {
  const box = $('awL'), pill = $('awPill'); if (!box) return;
  if (notes === null) { box.innerHTML = '<p class="aw-empty">⏳ Notes aa rahe hain…</p>'; return; }
  const L = rows(), days = notes.filter(n => n.src === 'day').sort((a, b) => b.at - a.at), open_ = L.reduce((s, n) => s + kaamOf(n).filter(k => !k.ok).length, 0);
  if (pill) pill.textContent = `${VIEWS[view][0]} · ${L.length} baatein${open_ ? ' · ☐ ' + open_ : ''} · ⋮`;
  if (err) { box.innerHTML = `<p class="aw-empty">✕ Notes nahi aaye (${esc(err)}) — rules 2.90 PC laga raha ho to 5 min baad dobara kholein.</p>`; return; }
  if (!notes.length) { box.innerHTML = `<div class="aw-empty"><b>Abhi koi baat nahi</b><p>${VIEWS[view][0]} ki koi recording nahi aayi. Pehli dafa? ⋮ → ⚙️ Setup.</p><button type="button" class="aw-c" data-aw="setup">⚙️ Setup kholo</button></div>`; return; }
  const seen = new Set(), out = [];
  for (const n of L) {
    if (!seen.has(n.day)) {
      seen.add(n.day);
      const ds = days.find(x => x.day === n.day);
      out.push(`<h4 class="aw-day">${esc(dayLab(n.day))}</h4>` + (ds && !q ? dayHTML(ds) : ''));
    }
    out.push(cardHTML(n));
  }
  box.innerHTML = out.join('') || `<p class="aw-empty">${q ? 'Is lafz se koi baat nahi mili' : onlyKaam ? '✓ Koi kaam baqi nahi' : 'Sirf khamosh tukde — ⋮ → 🔇 dikhao'}</p>`;
}
function dayHTML(d) {
  return `<div class="aw-sum"><b>🌙 Din ka khulasa</b><p>${esc(d.sum).replace(/\n/g, '<br>')}</p>${kaamHTML(d)}</div>`;
}
function kaamHTML(n) {
  const K = kaamOf(n); if (!K.length) return '';
  return `<div class="aw-ks">${K.map(k => `<button type="button" class="aw-k${k.ok ? ' is-in' : ''}" data-aw-k="${esc(n.id)}|${k.i}">${k.ok ? '✓' : '☐'} ${esc(k.t)}</button>`).join('')}</div>`;
}
function cardHTML(n) {
  const isOpen = open === n.id, call = n.src === 'call';
  const top = `${call ? '📞' : '🎙'} ${esc(n.tm || '')}${n.pl ? ' · 📍 ' + esc(n.pl) : ''}${n.who && !call ? '' : n.who ? ' · ' + esc(n.who) : ''}`;
  const btns = `${n.au ? `<a class="aw-c" href="${esc(n.au)}" target="_blank" rel="noopener">▶ Suno</a>` : ''}${n.mp ? `<a class="aw-c" href="${esc(n.mp)}" target="_blank" rel="noopener">📍 Map</a>` : ''}<button type="button" class="aw-c" data-aw-hide="${esc(n.id)}">🙈 Chhupao</button>`;
  if (n.kh) return `<div class="aw-card kh" data-aw-o="${esc(n.id)}"><div class="aw-l1">🔇 ${top} · khamosh</div>${isOpen ? `<div class="aw-bt">${btns}</div>` : ''}</div>`;
  return `<div class="aw-card${isOpen ? ' is-in' : ''}" data-aw-o="${esc(n.id)}"><div class="aw-l1">${top}</div><b class="aw-tt">${esc(n.tt || '(bina unwan)')}</b>`
    + `<p class="aw-s">${esc(n.sum || '').replace(/\n/g, '<br>')}</p>`
    + (isOpen && n.wd ? `<p class="aw-wd">${esc(n.wd).replace(/\n/g, '<br>')}</p>` : '')
    + (!call && n.who && isOpen ? `<p class="aw-wd">👥 ${esc(n.who)}</p>` : '')
    + kaamHTML(n) + (isOpen ? `<div class="aw-bt">${btns}</div>` : '') + '</div>';
}
function menuHTML() {
  const B = (on, at, lab) => `<button type="button" class="aw-c${on ? ' is-in' : ''}" ${at}>${lab}</button>`;
  return `<div class="aw-mg"><small>📅 Din</small><div class="aw-row">${Object.entries(VIEWS).map(([k, v]) => B(view === k, `data-aw-v="${k}"`, v[0])).join('')}</div></div>`
    + `<div class="aw-mg"><small>👁 Dikhao</small><div class="aw-row">${B(onlyKaam, 'data-aw="kaam"', '☐ Sirf baqi kaam')}${B(showKh, 'data-aw="kh"', '🔇 Khamosh bhi')}</div></div>`
    + `<div class="aw-mg"><small>🧾 Aur</small><div class="aw-row">${B(false, 'data-aw="pdf"', '📄 PDF (kholo + bhejo)')}${B(false, 'data-aw="setup"', '⚙️ Setup')}</div></div>`;
}

// ---------- ⚙️ setup (ek dafa) ----------
async function loadKey() { if (!A.cloud.getAwazKey) { key = ''; return; } try { key = (await A.cloud.getAwazKey()) || ''; } catch { key = ''; } if (mode === 'setup') paint(); }
const restUrl = () => `https://firestore.googleapis.com/v1/projects/${A.projectId}/databases/(default)/documents/businesses/noor-traders/awazNotes?key=${A.apiKey}`;
function setupHTML() {
  if (key === null) return '<p class="aw-empty">⏳ …</p>';
  const k1 = key ? '<p class="aw-ok">✅ Khufia chaabi tayyar</p>' : `<button type="button" class="aw-c pri" data-aw="mkkey"${busyKey ? ' disabled' : ''}>${busyKey ? '⏳' : '🔑'} Chaabi banao</button>`;
  return `<div class="aw-set">
    <p class="aw-note">Recording phone + Drive par rehti hai, kabhi nahi mit-ti. AI (Gemini) sirf aap ke Google account ke script mein sunta hai — app mein AI nahi.</p>
    <h4>① Chaabi</h4>${k1}
    <h4>② MacroDroid (recording)</h4><ol>
      <li>Chat mein bheji 2 files <b>NT_Awaz_Recording</b> + <b>NT_Awaz_Rok</b> → MacroDroid → Export/Import → Import.</li>
      <li>"NT Awaz - recording" kholein → <b>Record microphone</b> action → folder <b>NT Awaz</b> banayein / chunein.</li>
      <li>Shart <b>Wi-Fi</b> → "DUKAN WIFI KA NAAM" hata kar dukan ka Wi-Fi chunein (dono macro mein).</li>
      <li>Location: MacroDroid ko location ki ijazat "Allow all the time".</li></ol>
    <h4>③ FolderSync (phone → Drive)</h4><ol>
      <li>Play Store se <b>FolderSync</b> → Accounts ➕ → Google Drive (apni Gmail).</li>
      <li>Folderpair 1: phone <b>NT Awaz</b> ⇄ Drive <b>NT Awaz</b> · <b>Two-way</b> · har 15 min · sirf Wi-Fi (naam badle to phone par bhi badle).</li>
      <li>Folderpair 2: phone ka <b>call recording</b> folder → Drive <b>NT Calls</b> · To remote.</li></ol>
    <h4>④ Google Apps Script (notes)</h4><ol>
      <li>Browser: <b>script.google.com</b> (wahi Gmail) → New project.</li>
      <li>Sab mita kar <button type="button" class="aw-c" data-aw="gas"${key ? '' : ' disabled'}>📋 Script copy</button> paste → 💾 Save.</li>
      <li>Upar function <b>setup</b> → ▶ Run → Allow. Drive mein Sheet <b>"Meri Baatein"</b> ban jayegi.</li>
      ${A.aiKey?.() ? '' : '<li>Gemini key: Project Settings → Script properties → <b>GEMINI_KEY</b> (app Settings ki AI key wali).</li>'}</ol>
    <h4>⑤ Jagahein (naam)</h4><p class="aw-note">Sheet ke tab <b>Jagahein</b> mein: naam (Ghar, Dukan, Bega home) + location (Google Maps par ungli rakhein → upar ke number copy). Baqi jagah ka naam Google Maps khud deta hai.</p>
    <button type="button" class="aw-c" data-aw="list">‹ Wapas baatein</button></div>`;
}
async function copyGas() {
  try {
    const m = await import('./awaz-gas.js?v=2.224.0');
    const t = m.gasCode({ key, url: restUrl(), gem: A.aiKey?.() || '' });
    try { await navigator.clipboard.writeText(t); A.notice?.('📋 Script copy ho gaya — script.google.com par paste karein'); } catch { prompt('Copy karein:', t); }
  } catch (e) { A.notice?.('✕ ' + (e?.message || e)); }
}
async function mkKey() {
  if (busyKey) return; busyKey = true; paint();
  const a = new Uint8Array(18); crypto.getRandomValues(a); const k = Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
  try { await A.cloud.setAwazKey(k); key = k; A.notice?.('🔑 Chaabi ban gayi'); } catch (e) { A.notice?.('✕ ' + (e?.message || e)); }
  busyKey = false; paint();
}

// ---------- 📄 PDF ----------
function pdf() {
  const L = rows(); if (!L.length) { A.notice?.('Koi baat nahi'); return; }
  const tr = L.map(n => `<tr><td>${esc(dayLab(n.day))} ${esc(n.tm || '')}</td><td>${esc(n.pl || (n.src === 'call' ? 'Call' : ''))}</td><td><b>${esc(n.tt || '')}</b><br>${esc(n.sum || '').replace(/\n/g, '<br>')}${n.wd ? '<br><i>' + esc(n.wd).replace(/\n/g, '<br>') + '</i>' : ''}</td><td>${kaamOf(n).map(k => (k.ok ? '✓ ' : '☐ ') + esc(k.t)).join('<br>')}</td></tr>`).join('');
  A.pdf?.(`<h2>🎙 Meri baatein — ${esc(VIEWS[view][0])}</h2><table><thead><tr><th>Waqt</th><th>Jagah</th><th>Baat</th><th>Kaam</th></tr></thead><tbody>${tr}</tbody></table>`, 'Meri baatein ' + VIEWS[view][0]);
}

// ---------- 👆 clicks ----------
function onClick(e) {
  const t = e.target.closest('button,[data-aw-o],a'); if (!t) { if (menu && !e.target.closest('#awMenu')) { menu = false; paint(); } return; }
  if (t.tagName === 'A') return;   // ▶ Suno / 📍 Map — seedha Drive / Maps
  const d = t.dataset;
  if (d.awK) { const [id, i] = d.awK.split('|'), n = (notes || []).find(x => x.id === id); if (!n) return;
    const dn = { ...(n.dn || {}) }; if (dn[i]) delete dn[i]; else dn[i] = true; n.dn = dn; listPaint();   // pehle UI
    A.cloud.awazPatch(id, { dn }).catch(er => A.notice?.('✕ Tick save nahi hua: ' + (er?.message || er))); return; }
  if (d.awHide) { const id = d.awHide; notes = (notes || []).filter(x => x.id !== id); listPaint(); A.cloud.awazPatch(id, { hid: true }).catch(er => A.notice?.('✕ ' + (er?.message || er))); return; }
  if (d.awV) { view = d.awV; LS('sam-aw-view', view); menu = false; watch(); paint(); return; }
  if (d.awO !== undefined && !e.target.closest('button')) { open = open === d.awO ? '' : d.awO; listPaint(); return; }
  switch (d.aw) {
    case 'back': back(); return;
    case 'menu': menu = !menu; paint(); return;
    case 'kaam': onlyKaam = !onlyKaam; LS('sam-aw-kaam', onlyKaam ? '1' : '0'); paint(); return;
    case 'kh': showKh = !showKh; paint(); return;
    case 'pdf': menu = false; paint(); pdf(); return;
    case 'setup': menu = false; mode = 'setup'; paint(); return;
    case 'list': mode = 'list'; paint(); return;
    case 'mkkey': mkKey(); return;
    case 'gas': copyGas(); return;
  }
}
export const _awTest = { state: () => ({ notes, view, q, onlyKaam, showKh, mode, open, key }) };
