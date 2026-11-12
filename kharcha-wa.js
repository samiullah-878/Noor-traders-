// v2.242.0 (malik 12 Nov: "jo numbers save hain un par list bhejni hai · mera aur Mubeen ka chip"): list ke neeche chips (👤 Mujhe · Mubeen · har jora number · 📤 Sab ko) — blueAccess/khWaSend -> PC wa-out v1.9 Business number se bhejta hai, nateeja khWaSent (⏳ ✅ ✕ ⚠️ 60 s).
// 🔢 KHARCHA WHATSAPP SE (v2.241.0) — malik 12 Nov: "har kharcha account ko number 001 002 … (auto) · WhatsApp se connect — '001 Imran ne paisa liya 4900' likhein to
//   Daily Sale + kharcha account mein lag jaye · sirf akhrajat · mazeed number add kar sakein (Sonu, Bilal Ali) · meri / Mubeen ki chat ya business WhatsApp · hadd nahi".
//   App: numbers deta hai (blueAccess/khNum, cloud.khNumAssign TRANSACTION — number kabhi nahi badalta) + bhejne walon ki list (blueAccess/khWa). Entry PC banata hai (pc/kh-wa.js).
//   Sirf malik. AI nahi. Naya rule nahi (blueAccess = malik).
let C = null, num = null, cfg = null, stops = [], wp = null, snd = null, sent = null, sndT = 0;   // v2.242.0: snd = {id, at, ps:[number]} bheja · sent = PC ka jawab (blueAccess/khWaSent)
const MK = '03450412515', MB = '03462901193';
const toList = () => { const f = Array.isArray(wp?.prFrom) && wp.prFrom[0], t = Array.isArray(wp?.prTo) && wp.prTo[0], L = [{ n: '👤 Mujhe', p: normPh(f || MK) }, { n: 'Mubeen', p: normPh(t || MB) }]; for (const a of (Array.isArray(cfg?.allow) ? cfg.allow : [])) if (a?.p && !L.some(x => x.p === a.p)) L.push({ n: a.n || a.p, p: a.p }); return L; };
const stOf = p => { if (!snd || !snd.ps.includes(p)) return ''; const r = sent && String(sent.id) === snd.id ? (sent.r || {})[p] : null; if (r) return r.st === 'sent' ? '✅' : '✕'; return Date.now() - snd.at > 60000 ? '⚠️' : '⏳'; };
const whyOf = () => { if (!snd) return ''; const bad = snd.ps.map(p => ({ p, r: sent && String(sent.id) === snd.id ? (sent.r || {})[p] : null })); const e = bad.find(x => x.r && x.r.st !== 'sent'); if (e) return '✕ ' + ph(e.p) + ': ' + (e.r.why || 'nahi gaya'); if (bad.some(x => !x.r) && Date.now() - snd.at > 60000) return '⚠️ PC se jawab nahi aaya — dukan ka PC on hai? Business WhatsApp juda hai? (⋮ → 🩺 Parchi ka safar)'; return ''; };
const toHTML = () => { const T = toList(), w = whyOf(); return `<div class="kw-to" data-kw-tobox="1"><small>📲 Business number se bhejo:</small>${T.map(a => `<button type="button" data-kw-to="${esc(a.p)}">${stOf(a.p) ? stOf(a.p) + ' ' : ''}${esc(a.n)}</button>`).join('')}<button type="button" class="kw-all" data-kw-to="all">📤 Sab ko</button>${w ? `<p class="kw-err">${esc(w)}</p>` : ''}</div>`; };
function toPaint() { const b = root()?.querySelector('[data-kw-tobox]'); if (b) b.outerHTML = toHTML(); }
async function sendTo(k) { const T = toList(), to = k === 'all' ? T : T.filter(a => a.p === k); if (!to.length) return; if (!list().some(x => x.n)) { C.notice('Abhi koi number nahi laga'); return; } if (k === 'all' && !confirm(`List ${to.length} number par bhejein?`)) return; if (snd && Date.now() - snd.at < 8000) { C.notice('Thora ruk kar'); return; } snd = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), ps: to.map(a => a.p) }; toPaint(); clearTimeout(sndT); sndT = setTimeout(toPaint, 61000); try { await C.cloud.khWaSend(snd.id, listTxt(), to.map(a => ({ n: a.n.replace('👤 ', '') === 'Mujhe' ? 'Malik' : a.n, p: a.p }))); } catch (e) { C.notice('Nahi gaya: ' + (e?.message || e)); snd = null; toPaint(); } }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad3 = n => String(n).padStart(3, '0');
const ph = p => String(p || '').replace(/^(\d{4})(\d+)$/, '$1-$2');
const normPh = x => { let d = String(x || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2); else if (d.length === 10 && d.startsWith('3')) d = '0' + d; return d; };
const root = () => document.querySelector('#dialogBody [data-kw-root]');
function unlisten() { for (const f of stops) { try { f?.(); } catch {} } stops = []; }
const list = () => { const m = (num && num.m) || {}; return C.parties().map(p => ({ id: p.id, name: p.name, n: Number(m[p.id]) || 0 })).sort((a, b) => (a.n || 1e9) - (b.n || 1e9) || String(a.name).localeCompare(String(b.name))); };
const listTxt = () => '🔢 Kharcha khate (Noor Traders)\n' + list().filter(x => x.n).map(x => pad3(x.n) + '  ' + x.name).join('\n') + '\n\nLikhne ka tareeqa:\n001 Imran ne paisa liya 4900';
function html() {
  if (num === null || cfg === null) return '<p class="gr-empty">⏳ Aa raha hai…</p>';
  const on = cfg.on !== false, L = list(), A = Array.isArray(cfg.allow) ? cfg.allow : [];
  return `<button type="button" class="rw-tg rw-main${on ? ' is-in' : ''}" data-kw-on="1"><b>${on ? '🟢 WhatsApp se kharcha: ON' : '⚪ WhatsApp se kharcha: BAND'}</b><small>sirf Akhrajat · Daily Sale + kharcha khate mein</small></button>
    <p class="kw-how">✍️ Aise likhein: <b>001 Imran ne paisa liya 4900</b><br>number · likhai · <b>raqam aakhir mein</b>. Jawab ✅ / ✕ WhatsApp par aata hai. Ghalat ho to jawab par reply mein <b>cancel</b>.</p>
    <p class="rw-h">💵 Payment li / di / transfer <small>(sab parties · bank nahi)</small></p>
    <p class="kw-how"><b>1 Imran 5000</b> = payment LI · <b>2 Imran 5000</b> = payment DI · <b>3 Imran 5000 Aslam</b> = transfer (Imran se Aslam ko)<br>Jawab mein app ke naam 1-2-3 aate hain — <b>number bhejein</b> to hi lagta hai (transfer: do number, jaise 1 2). Aakhir mein <b>no</b> = Daily Sale mein nahi. Ghalat = ✅ par reply <b>cancel</b>.</p>
    <p class="rw-h">Kahan likhein</p>
    <p class="kw-how">• Aap / Mubeen: apni chat (Message yourself) mein<br>• Sab (Sonu, Bilal…): dukan ke WhatsApp Business number par, ya aap / Mubeen ke number par</p>
    <p class="rw-h">Kaun bhej sakta hai <small>(aap + Mubeen hamesha)</small></p>
    <div class="kw-al">${A.map((a, i) => `<span class="kw-a"><b>${esc(a.n || '—')}</b> ${esc(ph(a.p))}<button type="button" data-kw-del="${i}" aria-label="Hatao">✕</button></span>`).join('') || '<small class="rw-note">Abhi koi aur nahi</small>'}</div>
    <div class="kw-add"><input id="kwNm" placeholder="Naam (Sonu)" autocomplete="off"><input id="kwPh" type="tel" inputmode="tel" placeholder="03xx-xxxxxxx" autocomplete="off"><button type="button" data-kw-add="1">＋ Jorein</button></div>
    <p class="rw-h">Kharcha khaton ke number <small>(${L.filter(x => x.n).length})</small></p>
    <div class="kw-btns"><button type="button" data-kw-copy="1">📋 List copy</button><button type="button" data-kw-share="1">📤 WhatsApp par bhejo</button></div>
    ${toHTML()}
    <div class="kw-list">${L.map(x => `<p><b>${x.n ? pad3(x.n) : '⏳'}</b><span>${esc(x.name)}</span></p>`).join('') || '<p class="gr-empty">Koi kharcha khata nahi — Akhrajat mein "🧾 Kharcha khata banao" se banayein.</p>'}</div>`;
}
function paint() { const r = root(); if (!r) return; const a = document.activeElement; if (a && (a.id === 'kwNm' || a.id === 'kwPh')) return; r.innerHTML = html(); }
async function assign() { const m = (num && num.m) || {}, miss = C.parties().filter(p => !m[p.id]).sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)).map(p => p.id); if (!miss.length) return; try { await C.cloud.khNumAssign(miss); } catch (e) { C.notice('Number nahi lage: ' + (e?.message || e)); } }
async function saveCfg(patch) { try { cfg = { ...(cfg || {}), ...patch }; const r = root(); if (r) r.innerHTML = html(); await C.cloud.setKhWa({ on: cfg.on !== false, allow: cfg.allow || [] }); } catch (e) { C.notice('Save nahi hua: ' + (e?.message || e)); } }
export function kwSetup(c) {
  C = c;
  document.addEventListener('click', e => {
    const r = root(); if (!r || !r.contains(e.target)) return; const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.kwOn) { saveCfg({ on: cfg.on === false }); return; }
    if (t.dataset.kwDel) { const A = [...(cfg.allow || [])], a = A[Number(t.dataset.kwDel)]; if (a && confirm(`${a.n || a.p} ko list se hatayein?`)) { A.splice(Number(t.dataset.kwDel), 1); saveCfg({ allow: A }); } return; }
    if (t.dataset.kwAdd) { const n = (document.getElementById('kwNm')?.value || '').trim().slice(0, 30), p = normPh(document.getElementById('kwPh')?.value);
      if (!n) { C.notice('Naam likhein'); return; } if (!/^03\d{9}$/.test(p)) { C.notice('Number poora likhein (03xx-xxxxxxx)'); return; }
      const A = [...(cfg.allow || [])]; if (A.some(a => a.p === p)) { C.notice('Yeh number pehle se list mein hai'); return; } if (A.length >= 30) { C.notice('30 se zyada nahi'); return; }
      A.push({ n, p }); saveCfg({ allow: A }); return; }
    if (t.dataset.kwTo) { sendTo(t.dataset.kwTo); return; }
    if (t.dataset.kwCopy) { navigator.clipboard?.writeText(listTxt()).then(() => C.notice('📋 List copy ho gayi'), () => C.notice('Copy nahi hui')); return; }
    if (t.dataset.kwShare) { window.open('https://wa.me/?text=' + encodeURIComponent(listTxt()), '_blank'); return; }
  });
}
export function kwOpen() {
  if (!C?.owner()) { C?.notice('Sirf malik'); return; }
  unlisten(); num = null; cfg = null;
  C.modal('🔢 Kharcha WhatsApp se', `<div class="rw kw" data-kw-root="1">${html()}</div>`, true);
  const cl = C.cloud; let first = true;
  try { stops.push(cl.listenKhNum(d => { if (!root()) return; num = d || {}; paint(); if (first) { first = false; assign(); } })); } catch {}
  try { stops.push(cl.listenKhWa(d => { if (!root()) return; cfg = d || {}; paint(); })); } catch {}
  try { stops.push(cl.listenKhWaSent(d => { if (!root()) return; sent = d || {}; toPaint(); })); } catch {}
  try { stops.push(cl.listenWaParchi(d => { if (!root()) return; wp = d || {}; toPaint(); })); } catch {}
  try { document.getElementById('dialog')?.addEventListener('close', unlisten, { once: true }); } catch {}
}
