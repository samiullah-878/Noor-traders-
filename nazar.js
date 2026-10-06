// nazar.js — 📺 COUNTER NAZAR (v2.83, 2026-10-05) · v2.95.7 (2026-10-07): 🔔 COUNTER AWAZ — har PC ki scan-awaz ki halat (printPCs.snd, NT-PRINT v1.14):
// chalu/band, aaj sahi/ghalat scan, POS error, ghalat jagah scan, tu-tu-tu, ghalat barcodes ki list (copy). Sirf parhna.
// Nigrani wale ke liye ek screen: har counter ka bara khana — bill bante waqt har scan ki line live (liveCarts/<counter>),
// halki "tik" awaz, ⛔ ROKO (counter par laal, save band), ✓ Theek hai, aakhri 5 bills. Mobile aur PC dono par.
// Data sale.js likhta hai (liveCartSet / liveSaved); yahan sirf parhna + stop likhna.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const tm = t => t ? new Date(Number(t)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '';
let un = null, carts = [], seen = new Map(), sound = true, ac = null, mounted = false;
let pcUn = null, pcs = [], pcTick = null, pcOpen = true;

const NAMES = { abdurehman: 'Abdurehman', bilal: 'Bilal bhai', mithu: 'Mithu', local: 'Yehi device' };
const COLORS = { abdurehman: '#1a73e8', bilal: '#e0a000', mithu: '#1e9e4a' };
const ORDER = ['abdurehman', 'mithu', 'bilal'];
const cname = c => NAMES[c] || (String(c).startsWith('pc:') ? '💻 ' + String(c).split(':')[1] : c);
const ccolor = c => COLORS[c] || '#6b4ec4';

export function nazarSetup(o) {
  cloud = o.cloud; notice = o.notice || notice; isOwner = o.owner || isOwner; byName = o.byName || byName; uidOf = o.uid || uidOf;
  try { sound = localStorage.getItem('sam-nazar-sound') !== '0'; pcOpen = localStorage.getItem('sam-nazar-pcs') !== '0'; } catch {}
}

function tik(kind) {
  if (!sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = kind === 'saved' ? 880 : kind === 'stop' ? 220 : 1320;
    g.gain.value = 0.08; o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (kind === 'stop' ? 0.5 : 0.12)); o.stop(ac.currentTime + (kind === 'stop' ? 0.5 : 0.13));
  } catch {}
}

export function renderNazar() {
  mounted = true;
  const sum = $('summary'); if (!sum) return;
  if ($('list')) $('list').innerHTML = '';
  if ($('actions')) $('actions').innerHTML = '';
  if ($('tabs')) $('tabs').hidden = true;
  if (!sum.querySelector('#nzRoot')) {
    sum.innerHTML = `<div id="nzRoot" class="nz-root">
      <div class="nz-top"><b>📺 Counter Nazar</b><span class="nz-chips"><button type="button" class="nz-sound${sound ? ' on' : ''}" data-nz-sound="1">${sound ? '🔔 Awaz on' : '🔕 Awaz off'}</button><small id="nzLive">● live</small></span></div>
      <div id="nzPcs" class="nzp-wrap" hidden></div>
      <div id="nzGrid" class="nz-grid"></div>
    </div>`;
    sum.querySelector('#nzRoot').addEventListener('click', onClick);
  }
  watch(); paint(); watchPcs(); paintPcs();
}

export function nazarStop() { if (!mounted) return; mounted = false; try { un?.(); } catch {} un = null; try { pcUn?.(); } catch {} pcUn = null; clearInterval(pcTick); pcTick = null; }

// ---------- v2.95.7: 🔔 COUNTER AWAZ (har PC ka NT-PRINT printPCs/<id>.snd likhta hai) ----------
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function watchPcs() {
  if (!pcUn && cloud?.listenPrintPCs) { try { pcUn = cloud.listenPrintPCs(list => { pcs = Array.isArray(list) ? list : []; paintPcs(); }); } catch {} }
  if (!pcTick) pcTick = setInterval(paintPcs, 30000);   // "band" halat waqt se badalti hai
}
function pcState(p) {
  const s = p.snd, now = Date.now();
  if (now - (Number(p.at) || 0) > 3 * 60000) return ['off', '⚫ PC band / NT-PRINT nahi chal raha'];
  if (!s) return ['old', `⚪ Purana NT-PRINT v${p.ver || '?'} — update chahiye`];
  if (!s.scanOn) return ['bad', '🔴 Scan awaz band'];
  if (s.posUi && !s.posAlive) return ['bad', '🔴 POS awaz system band'];
  if (s.posUi && s.posWin && !s.posOn) return ['warn', '🟠 POS patti nahi mili — aankh se'];
  if (s.posUi && !s.posWin) return ['idle', '🟢 Scan awaz chalu · POS Sale screen band'];
  return ['ok', '🟢 Awaz chalu'];
}
function paintPcs() {
  const box = $('nzPcs'); if (!box) return;
  const rank = { bad: 0, warn: 1, off: 2, old: 3, idle: 4, ok: 5 };   // masle wale PC upar
  const list = pcs.filter(p => p && (p.snd || p.ver) && Date.now() - (Number(p.at) || 0) < 24 * 3600000)   // 1 din se band (purana laptop waghera) na dikhao
    .sort((a, b) => rank[pcState(a)[0]] - rank[pcState(b)[0]] || String(a.name || a.id).localeCompare(String(b.name || b.id)));
  box.hidden = !list.length; if (!list.length) { box.innerHTML = ''; return; }
  const today = dayKey();
  const keepOpen = new Set([...box.querySelectorAll('details.nzp-d[open]')].map(d => d.dataset.k));   // khuli list re-paint par band na ho
  const dk = (p, k) => `${esc(p.id)}:${k}"${keepOpen.has(p.id + ':' + k) ? ' open' : ''}`;
  const cards = list.map(p => {
    const [st, label] = pcState(p);
    const s = p.snd && p.snd.day === today ? p.snd : null;
    const n = k => Number(s?.[k]) || 0;
    const chip = (cls, ic, v, t) => `<span class="nzp-c ${cls}${v ? '' : ' zero'}">${ic} <b>${v}</b> ${t}</span>`;
    const miss = Array.isArray(s?.miss) ? s.miss : [], errs = Array.isArray(s?.errs) ? s.errs : [], warns = Array.isArray(s?.warns) ? s.warns : [];
    return `<section class="nzp ${st}">
      <header><b>💻 ${esc(p.name || p.id)}</b><em>${esc(label)}</em></header>
      ${p.snd ? `<div class="nzp-chips">
        ${chip('ok', '✅', n('ok'), 'sahi scan')}${chip('bad', '❌', n('bad'), 'ghalat barcode')}${chip('err', '⚠️', n('err'), 'POS error')}
        ${chip('wrong', '🪟', n('wrong'), 'ghalat jagah')}${chip('warn', '📢', n('warn'), 'tu-tu-tu')}
        <span class="nzp-c t">⏱ ${s?.lastScan ? tm(s.lastScan) : 'aaj scan nahi'}</span>
      </div>` : ''}
      ${miss.length ? `<details class="nzp-d" data-k="${dk(p, 'miss')}><summary>❌ Ghalat barcodes (${miss.length}) — POS mein nahi</summary>${miss.map(m => `<div class="nzp-row"><code>${esc(m.c)}</code><span>×${esc(m.n)}</span><small>${tm(m.at)}</small><button type="button" data-nzp-copy="${esc(m.c)}">📋</button></div>`).join('')}</details>` : ''}
      ${errs.length ? `<details class="nzp-d" data-k="${dk(p, 'err')}><summary>⚠️ POS errors (${errs.length})</summary>${errs.map(e => `<div class="nzp-row"><span class="nzp-t">${esc(e.t)}</span><small>${tm(e.at)}</small></div>`).join('')}</details>` : ''}
      ${warns.length ? `<details class="nzp-d" data-k="${dk(p, 'warn')}><summary>📢 Tu-tu-tu kyun (${warns.length})</summary>${warns.map(w => `<div class="nzp-row"><span class="nzp-t">${esc(w.k)}</span><small>${tm(w.at)}</small></div>`).join('')}</details>` : ''}
    </section>`;
  }).join('');
  const bad = list.filter(p => ['off', 'bad', 'warn', 'old'].includes(pcState(p)[0])).length;
  box.innerHTML = `<details class="nzp-top"${pcOpen ? ' open' : ''}><summary><b>🔔 Counter Awaz</b><span class="nzp-sum ${bad ? 'bad' : 'ok'}">${bad ? `⚠ ${bad} PC dekhein` : `✓ ${list.length} PC theek`}</span></summary><div class="nzp-grid">${cards}</div></details>`;
}

function watch() {
  if (un || !cloud?.listenLiveCarts) return;
  un = cloud.listenLiveCarts((list, err) => {
    if (err) { const l = $('nzLive'); if (l) l.textContent = '⚠ ' + (err.message || 'rabta nahi'); return; }
    carts = list;
    for (const c of list) {
      const prev = seen.get(c.id) || { n: 0, status: '', stop: false, saleId: '' };
      if (c.status === 'open' && (c.n || 0) > prev.n) tik('line');
      if (c.status === 'saved' && c.saleId && c.saleId !== prev.saleId) tik('saved');
      if (!!c.stop && !prev.stop) tik('stop');
      seen.set(c.id, { n: c.n || 0, status: c.status, stop: !!c.stop, saleId: c.saleId || '' });
    }
    paint();
  });
}

function sortCarts() {
  const act = c => c.status === 'stopped' || c.stop ? 0 : c.status === 'open' ? 1 : c.status === 'saved' ? 2 : 3;
  return [...carts].filter(c => c.counter).sort((a, b) => act(a) - act(b) || (ORDER.indexOf(a.counter) + 99) - (ORDER.indexOf(b.counter) + 99) || String(a.counter).localeCompare(String(b.counter)));
}

function paint() {
  const g = $('nzGrid'); if (!g) return;
  const list = sortCarts();
  if (!list.length) { g.innerHTML = '<p class="stat-note nz-empty">Abhi koi counter app se bill nahi bana raha. Jaise hi koi scan hoga, yahan aa jayega.</p>'; return; }
  g.innerHTML = list.map(c => {
    const stopped = !!c.stop, open = c.status === 'open', saved = c.status === 'saved';
    const cls = stopped ? 'stop' : open ? 'open' : saved ? 'saved' : 'idle';
    const lines = Array.isArray(c.lines) ? c.lines : [];
    const stale = Date.now() - (Number(c.at) || 0) > 6 * 3600 * 1000;
    const head = stopped ? '⛔ ROKA HUA' : open ? '🛒 Bill ban raha hai' : saved ? '✓ Bill ban gaya' : stale ? '💤' : '— khali —';
    return `<section class="nz-box ${cls}" style="--c:${ccolor(c.counter)}" data-nz="${esc(c.id)}">
      <header><b>${esc(cname(c.counter))}</b><span>${esc(c.byName || '')}</span><em>${esc(head)}</em></header>
      ${stopped ? `<div class="nz-stopbar">⛔ Roka: ${esc(c.stop.name || '')} · ${tm(c.stop.at)}${c.stop.why ? ' · ' + esc(c.stop.why) : ''} <button type="button" class="nz-clear" data-nz-clear="${esc(c.counter)}">✓ Theek hai</button></div>` : ''}
      ${saved ? `<div class="nz-savedbar">✓ Bill · Token <b>${esc(c.token || '-')}</b> · ${esc(c.crates || 1)} crate · Rs ${num(c.total)}</div>` : ''}
      <ol class="nz-lines">${lines.slice().reverse().map((l, i) => `<li${i === 0 && open ? ' class="new"' : ''}><b>${esc(l.n)}</b><span>${esc(l.q)}</span></li>`).join('') || '<li class="none">—</li>'}</ol>
      <footer><span>${lines.length} cheezein · Rs ${num(c.total)}</span>${!stopped && (open || saved) ? `<button type="button" class="nz-roko" data-nz-stop="${esc(c.counter)}">⛔ ROKO</button>` : ''}</footer>
      ${Array.isArray(c.last) && c.last.length ? `<details class="nz-last"><summary>Aakhri ${c.last.length} bills</summary>${c.last.map(x => `<div>${tm(x.at)} · Token ${esc(x.token || '-')} · ${esc(x.n || 0)} items · Rs ${num(x.total)}${x.byName ? ' · ' + esc(x.byName) : ''}</div>`).join('')}</details>` : ''}
    </section>`;
  }).join('');
}

async function onClick(e) {
  const tp = e.target.closest('.nzp-top > summary');
  if (tp) { setTimeout(() => { pcOpen = !!tp.parentElement?.open; try { localStorage.setItem('sam-nazar-pcs', pcOpen ? '1' : '0'); } catch {} }, 0); return; }
  const cp = e.target.closest('[data-nzp-copy]');
  if (cp) { try { await navigator.clipboard.writeText(cp.dataset.nzpCopy); notice('📋 Barcode copy: ' + cp.dataset.nzpCopy); } catch { notice(cp.dataset.nzpCopy); } return; }
  const s = e.target.closest('[data-nz-sound]');
  if (s) { sound = !sound; try { localStorage.setItem('sam-nazar-sound', sound ? '1' : '0'); } catch {} s.textContent = sound ? '🔔 Awaz on' : '🔕 Awaz off'; s.classList.toggle('on', sound); if (sound) tik('line'); return; }
  const st = e.target.closest('[data-nz-stop]');
  if (st) {
    const c = st.dataset.nzStop;
    const why = prompt('Kyun roka? (ikhtiyari — jaise "extra carton")', '') ;
    if (why === null) return;
    st.disabled = true;
    try { await cloud.liveCartStop(c, { by: uidOf(), name: byName() || 'Nigrani', at: Date.now(), why: String(why || '').slice(0, 80) }); notice('⛔ ' + cname(c) + ' roka — counter par laal paigham gaya'); }
    catch (er) { notice('Nahi hua: ' + (er?.message || er)); st.disabled = false; }
    return;
  }
  const cl = e.target.closest('[data-nz-clear]');
  if (cl) {
    const c = cl.dataset.nzClear; cl.disabled = true;
    try { await cloud.liveCartStop(c, null); notice('✓ ' + cname(c) + ' clear'); }
    catch (er) { notice('Nahi hua: ' + (er?.message || er)); cl.disabled = false; }
  }
}
