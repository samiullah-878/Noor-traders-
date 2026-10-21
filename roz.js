// roz.js — v2.109.0 (22 Oct 2026): 📋 ROZ KI GINTI — malik ka dashboard (jagah-war larkon ki progress · mahine ka % · aaj / 7 din ka farq ·
//   🔁 jagah ki ghalti / ⬇️ asal kami / ⬆️ asal zyadti / ⏳ transfer raste mein / 🔁 bara farq = pehle dobara gino · ✅ ek click theek) + larke ka jagah chunao.
//   Malik: "farq ho to app khud pehle dukan / doosre godam ka stock dekhe, bataye kahan kam kahan zyada, phir ek click mein parchi bahar aur stock adjust".
//   Theek = WAHI "stock fraq" bill (PC post-farq — kam = Sale, zyada = Return, parchi khud). Ek click = stockCount/_postQ (PC auto-backup ek ek kar ke _post).
//   Jagah ki ghalti (Dukan −12 · Godam 1 +12) bhi dono jagah fraq bill = POS stock dono jagah theek, Rs net 0 (transfer note nahi — parchi par "maal le jao" ka dhoka nahi).
//   Data pos-stock.js stockRozApi() se (sirf parhna + wahi kaam). AI NAHI.
const $ = id => document.getElementById(id);
let A = null, st = { tab: 'aaj' };
const D = 864e5, r2 = n => Math.round((Number(n) || 0) * 100) / 100, r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const rs = n => 'Rs ' + (n > 0 ? '+' : n < 0 ? '−' : '') + A.num(Math.abs(Math.round(n)));
const BIG_RS = 2000;   // is se bara farq (ya 1 ctn+) = pehle dobara gino (ek larke ki ghalti par bill na bane)
function dlg(title, html) { const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = title; $('dialogBody').innerHTML = `<div class="rz-root" id="rzRoot">${html}</div>`; if (!d.open) d.showModal(); }
const paint = () => { const el = $('rzRoot'); if (el && A) el.innerHTML = dashHTML(); };

// ---------- larka: kai jagah ki ijazat = chunao ----------
export function rozPick(api, go) {
  A = api; const L = A.locs().filter(x => A.isOwner() || A.can(x.cap));
  dlg('📋 Aaj ki ginti — jagah chunein', `<p class="rz-say">Jis jagah ka kaam aap ko diya gaya hai — har larke ko <b>alag items</b> milte hain.</p>
    <div class="rz-pick">${L.map(x => { const m = A.mine(x.k), done = m.filter(id => A.gina(x.b, id)).length;
      return `<button type="button" class="rz-pk${m.length && done >= m.length ? ' ok' : ''}" data-rz-go="${x.k}"><span class="ic">${x.ic}</span><span><b>${A.esc(x.name)}</b><small>${m.length ? (done >= m.length ? '✅ ' : '✓ ') + A.num(done) + ' / ' + A.num(m.length) + ' gine' : 'Abhi shuru nahi — ' + A.num(A.cfg().n) + ' items milenge'}</small></span><em>›</em></button>`; }).join('')}</div>`);
  const el = $('rzRoot'); if (el) el.onclick = e => { const b = e.target.closest('[data-rz-go]'); if (!b) return; try { $('dialog').close(); } catch {} go(b.dataset.rzGo); };
}

// ---------- malik ka dashboard ----------
export function rozDash(api) { A = api; dlg('📋 Roz ki ginti', dashHTML()); }
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
// jagah ki aaj ki progress + har larka
function locToday(L) {
  const d = A.doc(L.k), by = d?.by || {}, boys = Object.entries(by).map(([sid, m]) => { const ids = (m?.ids || []).map(String); return { sid, n: String(m?.n || ''), all: ids.length, done: ids.filter(id => A.gina(L.b, id)).length }; });
  const ids = Object.keys(d?.taken || {}); let gina = 0; for (const [k, c] of A.counts()) if (k.startsWith(`c-${L.b}-`) && c.round === A.day() && !c.del) gina++;
  return { boys, all: ids.length, done: ids.filter(id => A.gina(L.b, id)).length, gina };
}
function locCover(L) {   // mahine (30 din) mein kitne items gine
  const T = Date.now(), its = A.items(L.b).filter(r => !A.hidden(r)); let c30 = 0, c7 = 0, n = 0;
  for (const r of its) { const c = A.count(L.b, r.id), st = Number(r.stock) || 0; if (!c && st === 0) continue; n++; const at = Math.max(Number(c?.at) || 0, ...((c?.history || []).map(h => Number(h?.at) || 0)));
    if (at >= T - 30 * D) c30++; if (at >= T - 7 * D) c7++; }
  return { n, c30, c7, p30: n ? Math.round(c30 * 100 / n) : 0 };
}
function locHist(L) {   // pichhle 7 din har larka [naam, liye, gine]
  const h = A.rawDoc(L.k)?.hist || {}, days = Object.keys(h).sort().slice(-7), per = new Map();
  for (const day of days) for (const [sid, v] of Object.entries(h[day] || {})) { const o = per.get(sid) || { n: v?.[0] || sid, days: 0, full: 0, items: 0 }; o.days++; if (Number(v?.[1]) && Number(v?.[2]) >= Number(v?.[1])) o.full++; o.items += Number(v?.[2]) || 0; if (v?.[0]) o.n = v[0]; per.set(sid, o); }
  return [...per.values()];
}
// ⚖️ farq: aaj + pichhle 7 din ke bina bill (har jagah) — jagah ki ghalti / asal / transfer / dobara
function farqRows() {
  const T = Date.now(), out = [], Ls = A.locs(), by = new Map();
  for (const L of Ls) { const items = new Map(A.items(L.b).map(r => [String(r.id), r])), pend = A.pend(L.b);
    for (const [k, c] of A.counts()) { if (!k.startsWith(`c-${L.b}-`) || c.del || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.round || '')) || (Number(c.at) || 0) < T - 7 * D) continue;
      const id = k.slice(`c-${L.b}-`.length), r = items.get(id); if (!r) continue;
      const f = r3(A.counted(c) - Number(A.sys(c, r))); if (Math.abs(f) < 0.001) continue;
      const key = f < 0 ? id : 'R' + id, q = Number(A.posted(`_posted-${c.round}-${L.b}`)?.items?.[key]) || 0; if (q >= Math.abs(f) - 0.001) continue;   // bill ho chuka
      const hToday = (c.history || []).filter(h => (Number(h?.at) || 0) >= dayStart(c.at)).length, pk = Number(r.pack) || 0, val = f * (Number(r.prate) || 0);
      const x = { L, id, r, c, f: r3(f - (f < 0 ? -q : q)), rs: r2((f - (f < 0 ? -q : q)) * (Number(r.prate) || 0)), part: q > 0, pend: pend.has(id), big: (Math.abs(val) >= BIG_RS || (pk > 1 && Math.abs(f) >= pk)) && hToday < 2, round: c.round, pair: null };
      out.push(x); if (!by.has(id)) by.set(id, []); by.get(id).push(x); } }
  for (const L of by.values()) { if (L.length < 2) continue; for (const a of L) { const b = L.find(y => y !== a && Math.sign(y.f) === -Math.sign(a.f)); if (b) a.pair = b; } }   // ek jagah kam, doosri zyada = jagah ki ghalti
  return out;
}
const kindOf = x => x.pend ? 'pend' : x.big ? 'big' : x.pair ? 'jagah' : x.f < 0 ? 'kam' : 'zyada';
const KINDS = [['jagah', '🔁 Jagah ki ghalti', 'ek jagah kam, doosri zyada — maal hila, note nahi bana (Rs net qareeb 0)'], ['kam', '⬇️ Asal kami', 'kahin zyada nahi mila'], ['zyada', '⬆️ Asal zyadti', 'kahin kam nahi'], ['big', '🔁 Bara farq — pehle dobara gino', 'ek ginti par bill nahi (Rs ' + '2,000+ ya 1 ctn+)'], ['pend', '⏳ Transfer raste mein', 'note abhi POS / tick baqi — intezar, phir gino']];
function dashHTML() {
  const C = A.cfg(), E = A.esc, all = A.locs(true), Ls = A.locs(), own = A.isOwner();
  const mn = (k, i, t, s, a, on) => `<button type="button"${on ? ' class="is-in"' : ''} data-mn="${k}" data-mn-i="${i}" data-mn-t="${E(t)}" data-mn-s="${E(s)}" data-mn-g="📋 Roz ki ginti" ${a}>${i} ${E(t)}</button>`;
  const set = `<button type="button" class="rz-pat" data-mn-sheet="1">${C.on ? '✅ ON' : '⏸ Band'} · har larka ${A.num(C.n)} items · ${E(Ls.map(x => x.name).join(' · ') || '—')} — ⋮ se badlein</button>
    <div class="rz-mn">${mn('rz.on', C.on ? '⏸' : '✅', C.on ? 'Roz ki ginti band karo' : 'Roz ki ginti shuru karo', C.on ? 'list / chip band' : 'roz khud list', 'data-rz-on="' + (C.on ? '0' : '1') + '"')}
      ${[10, 20, 30].map(n => mn('rz.n' + n, '🔢', 'Har larka ' + n + ' items', 'ek dafa mein', `data-rz-n="${n}"`, C.n === n)).join('')}
      ${all.map(x => mn('rz.l' + x.k, x.ic, x.name + ': ' + (C.locs[x.k] !== false ? 'ON' : 'band'), 'is jagah ki roz ginti', `data-rz-loc="${x.k}"`, C.locs[x.k] !== false)).join('')}</div>`;
  if (!C.on) return `${set}<div class="rz-hero"><b>📋 Roz ki ginti</b><p>Har subah app khud har jagah (${E(all.map(x => x.name).join(' · '))}) ki list banati hai — har larke ko <b>apne alag ${A.num(C.n)} items</b>. Jitne larke, utni zyada ginti — hafte / mahine mein poori dukan + godam tally.</p>
    <ol><li>Neeche <b>✅ Shuru karo</b></li><li>Settings → Mulazim → larke par <b>📋 Roz ki ginti — jagah</b> tick</li><li>Larka <b>Stock</b> kholay → <b>📋 Aaj ki list</b> dabaye = us ki apni alag list</li></ol>
    <button type="button" class="rz-big" data-rz-on="1">✅ Roz ki ginti shuru karo</button></div>`;
  const lockW = A.locked?.() ? `<div class="rz-lock"><span>🔴 <b>Counting band hai</b> — larke ginti save nahi kar sakte</span><button type="button" data-rz-unlock="1">🟢 Counting ON</button></div>` : '';
  const F = farqRows(), q = A.postQ(), qBusy = q && (q.jobs || []).some(j => !j.st || j.st === 'sent') && Date.now() - (Number(q.at) || 0) < 3 * 3600e3;
  const fix = F.filter(x => ['jagah', 'kam', 'zyada'].includes(kindF(x))), fixRs = fix.reduce((t, x) => t + x.rs, 0);
  const locCard = L => { const t = locToday(L), cv = locCover(L), hs = locHist(L);
    return `<div class="rz-loc"><div class="rz-lh"><span class="ic">${L.ic}</span><b>${E(L.name)}</b><span class="rz-ln${t.all && t.done >= t.all ? ' ok' : ''}">${t.all ? (t.done >= t.all ? '✅ ' : '✓ ') + A.num(t.done) + ' / ' + A.num(t.all) : 'aaj shuru nahi'}</span></div>
      <div class="rz-boys">${t.boys.map(b => `<span class="rz-boy${b.all && b.done >= b.all ? ' ok' : ''}">👤 ${E(b.n || b.sid)} <b>${A.num(b.done)}/${A.num(b.all)}</b></span>`).join('') || '<small class="rz-mut">Abhi kisi larke ne list nahi li</small>'}</div>
      <div class="rz-cov"><div class="rz-bar"><i style="width:${cv.p30}%"></i></div><small>Is mahine: <b>${A.num(cv.c30)} / ${A.num(cv.n)}</b> items (${cv.p30}%) · 7 din: ${A.num(cv.c7)}${t.gina > t.done ? ' · aaj kul ' + A.num(t.gina) + ' gine' : ''}</small></div>
      ${hs.length ? `<small class="rz-mut">7 din: ${hs.map(h => `${E(h.n)} ${A.num(h.full)}/${A.num(h.days)} din poori`).join(' · ')}</small>` : ''}
      <button type="button" class="rz-mini" data-rz-self="${L.k}">📋 Main bhi ginoon</button></div>`; };
  const grp = ([k, t, s]) => { const g = F.filter(x => kindF(x) === k); if (!g.length) return '';
    return `<div class="rz-g ${k}"><div class="rz-gh"><b>${t}</b><small>${E(s)}</small><i>${A.num(g.length)}</i></div>${g.slice(0, 40).map(x => `<div class="rz-fr"><span class="rz-fn"><b>${E(x.r.name)}</b><small>${E(x.L.name)} · gina ${A.num(A.counted(x.c))} · POS ${A.num(A.sys(x.c, x.r))}${x.c.byName ? ' · ' + E(x.c.byName) : ''}${x.round !== A.day() ? ' · ' + E(x.round) : ''}${x.pair ? ` · <b class="g">${E(x.pair.L.name)} ${x.pair.f > 0 ? '+' : ''}${A.num(x.pair.f)}</b>` : ''}${x.part ? ' · kuch bill ho chuka' : ''}</small></span>
      <span class="rz-fq ${x.f < 0 ? 'r' : 'g'}"><b>${x.f > 0 ? '+' : ''}${A.num(x.f)}</b><small>${x.rs ? rs(x.rs) : ''}</small></span>${k === 'big' ? `<span class="rz-fbt"><button type="button" class="rz-mini" data-rz-again="${E(x.L.k)}|${E(x.id)}">📋 Dobara gino</button><button type="button" class="rz-mini alt" data-rz-force="${E(x.L.k)}|${E(x.id)}">✓ Theek hai</button></span>` : ''}</div>`).join('')}${g.length > 40 ? `<small class="rz-mut">+${A.num(g.length - 40)} aur</small>` : ''}</div>`; };
  const qLine = q ? `<div class="rz-q${qBusy ? ' busy' : ''}">${(q.jobs || []).map(j => `<span class="${j.st === 'done' ? 'ok' : j.st === 'failed' ? 'bad' : j.st === 'nothing' ? 'mut' : ''}">${j.st === 'done' ? '✓' : j.st === 'failed' ? '❌' : j.st === 'nothing' ? '—' : '⏳'} ${E(A.branchName(j.branch))} ${j.kind === 'kam' ? 'kam' : 'zyada'} (${A.num((j.items || []).length)})${j.saleNo ? ' #' + E(j.saleNo) : j.returnNo ? ' R#' + E(j.returnNo) : ''}${j.error ? ' · ' + E(String(j.error).slice(0, 60)) : ''}</span>`).join('')}${qBusy ? '<small>PC ek ek kar ke bill + parchi bana raha hai…</small>' : ''}</div>` : '';
  return `${set}${lockW}
    <div class="rz-locs">${Ls.map(locCard).join('') || '<p class="rz-say">Koi jagah ON nahi — ⋮ se jagah chunein.</p>'}</div>
    <div class="rz-farq"><div class="rz-fh"><b>⚖️ Farq — aaj + pichhle 7 din (bill baqi)</b><small>${A.num(F.length)} items</small></div>
      ${F.length ? KINDS.map(grp).join('') : '<p class="rz-say">✓ Koi farq baqi nahi.</p>'}
      ${qLine}
      ${fix.length ? `<button type="button" class="rz-big ok" data-rz-fix="1"${qBusy ? ' disabled' : ''}>✅ Sab theek karo — ${A.num(fix.length)} items · ${rs(fixRs)}<small>"stock fraq" bill (kam = Sale · zyada = Return) — PC parchi khud chhapega</small></button>` : ''}
      ${F.some(x => kindF(x) === 'big') ? '<small class="rz-mut">🔁 Bara farq: "📋 Dobara" = agle larke ki list mein sab se upar · "✓ Theek hai" = isi ginti par theek karo.</small>' : ''}</div>
    <p class="rz-tip">🔒 Larkon ko ijazat: <b>Settings → Mulazim</b> → "📋 Roz ki ginti — jagah". Larke ko stock / farq nazar nahi aata. PC 12 aur 4 baje baqi wale larkon ko yaad dilata hai.</p>`;
}
const force = new Set();   // malik: "✓ Theek hai" (bara farq isi ginti par)
const kindF = x => force.has(x.L.k + '|' + x.id) && x.big && !x.pend ? (x.pair ? 'jagah' : x.f < 0 ? 'kam' : 'zyada') : kindOf(x);
async function fixAll() {
  const F = farqRows().filter(x => ['jagah', 'kam', 'zyada'].includes(kindF(x))); if (!F.length) { A.notice('Theek karne ko kuch nahi'); return; }
  const jobs = new Map(); for (const x of F) { const k = x.round + '|' + x.L.b + '|' + (x.f < 0 ? 'kam' : 'zyada'); if (!jobs.has(k)) jobs.set(k, { round: x.round, branch: x.L.b, kind: x.f < 0 ? 'kam' : 'zyada', items: [] }); jobs.get(k).items.push(x.id); }
  const J = [...jobs.values()], tot = F.reduce((t, x) => t + x.rs, 0);
  if (!confirm(`✅ ${F.length} items theek — "stock fraq" bill (${J.length} hisse)\n${J.map(j => `${A.branchName(j.branch)} · ${j.kind === 'kam' ? 'kam (Sale)' : 'zyada (Return)'} · ${j.items.length} items`).join('\n')}\nKul ${rs(tot)}\n\nPC bill + parchi banaye?`)) return;
  try { await A.cloud.requestFarqQueue(J); force.clear(); A.notice('✓ PC ko bhej diya — ek ek kar ke bill + parchi (1–3 min)'); setTimeout(paint, 300); }
  catch (e) { A.notice('Nahi bheja: ' + (e?.message || e)); }
}
document.addEventListener('click', async e => {
  const t = e.target.closest?.('[data-rz-on],[data-rz-n],[data-rz-loc],[data-rz-self],[data-rz-fix],[data-rz-again],[data-rz-force],[data-rz-unlock]'); if (!t || !A || !t.closest('#rzRoot')) return;
  const d = t.dataset, C = A.cfg();
  if (!A.isOwner()) return;
  try {
    if (d.rzOn != null) { const on = d.rzOn === '1'; await A.cloud.setRozCfg({ ...C, on }); if (on && !A.autoOn() && A.cloud.setStockAuto) await A.cloud.setStockAuto(true);
      let lk = ''; if (on && A.locked?.() && A.cloud.setStockLock) { try { await A.cloud.setStockLock(false); lk = ' · 🟢 Counting ON'; } catch {} }
      A.notice(on ? '✅ Roz ki ginti shuru' + lk + ' — larkon ko Settings → Mulazim se ijazat dein' : '⏸ Roz ki ginti band'); setTimeout(paint, 400); return; }
    if (d.rzUnlock) { await A.cloud.setStockLock(false); A.notice('🟢 Counting ON — larke ginti kar sakte hain'); setTimeout(paint, 500); return; }
    if (d.rzN) { await A.cloud.setRozCfg({ ...C, n: Number(d.rzN) }); A.notice('🔢 Har larka ' + d.rzN + ' items'); setTimeout(paint, 400); return; }
    if (d.rzLoc) { await A.cloud.setRozCfg({ ...C, locs: { ...C.locs, [d.rzLoc]: C.locs[d.rzLoc] === false } }); setTimeout(paint, 400); return; }
    if (d.rzSelf) { try { $('dialog').close(); } catch {} A.enter(d.rzSelf); return; }
    if (d.rzFix != null) { await fixAll(); return; }
    if (d.rzAgain) { const [k, id] = d.rzAgain.split('|'); await A.cloud.rozWant(k, [id], true); A.notice('📋 Agle larke ki list mein sab se upar — dobara ginti'); setTimeout(paint, 300); return; }
    if (d.rzForce) { force.add(d.rzForce); A.notice('✓ Isi ginti par theek hoga — ab "✅ Sab theek karo"'); paint(); return; }
  } catch (er) { A.notice('Nahi hua: ' + (er?.message || er)); }
});
export const _rzTest = { farqRows: api => { A = api; return farqRows(); }, kindOf, locCover: (api, L) => { A = api; return locCover(L); } };
