// farq.js — v2.113.0 (23 Oct 2026): ⚖️ STOCK FARQ — EK SCREEN, har item ek line mein SAB jagah (dukan + har godam).
//   Malik: "jo bhi larka stock gine, agar stock kam ho to ek screen stock farq mein dukan ka piece phir saath godam ka piece, phir dono apni apni
//   jagah adjust kar ke wahi stock se bill banao, kam zyada wala apne khane mein aaye — is tarah hamare larkon ko khapna nahi parega".
//   Har item: jagah-war gina / POS / farq + ASAL farq (sab jagah ka jor). 🔁 Jagah badli (ek jagah kam, doosri zyada) = dobara ginne ki zaroorat
//   nahi — "bara farq, pehle dobara gino" sirf ASAL farq par lagta hai. Jo jagah abhi nahi gini, wahin likh kar gino (wahi ginti — us jagah ki,
//   history mein naam). ✓ Theek karo = WAHI "stock fraq" bill (PC post-farq: kam = Sale, zyada = Return, parchi PC khud) — har jagah ka POS stock
//   theek, paisa sirf asal farq ka. v2.114.0: 🔁 jagah badli par "⇄ Transfer se theek karo" bhi (malik: "jab bhi transfer — direct ho jaye") = qtr.js
//   TN (note par "sirf hisaab") + dono jagah ki ginti wahi tadad par dobara (farq 0 — bill nahi). Bill wala rasta bhi wahi.
//   Data pos-stock.js stockRozApi() se (sirf parhna + wahi kaam jo buttons karte hain). Bill sirf malik. CAP stock.farq. AI NAHI.
const $ = id => document.getElementById(id);
let A = null, st = { f: 'all' };
const D = 864e5, r2 = n => Math.round((Number(n) || 0) * 100) / 100, r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const BIG_RS = 2000;   // asal farq is se bara (ya 1 ctn+) aur aaj ek hi dafa gina = pehle dobara gino (ek larke ki ghalti par bill na bane)
const force = new Set();   // malik: "✓ Theek hai" (bara farq isi ginti par)
const rs = n => 'Rs ' + (n > 0 ? '+' : n < 0 ? '−' : '') + A.num(Math.abs(Math.round(n)));
const sg = n => (n > 0 ? '+' : n < 0 ? '−' : '') + A.num(Math.abs(n));
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const cp = (n, r) => { const pk = Number(r?.pack) || 0, a = Math.abs(Number(n) || 0); if (pk <= 1) return ''; const c = Math.floor(a / pk), p = r3(a - c * pk); return `${c} ${r.cName || 'ctn'}${p ? ' ' + A.num(p) : ''}`; };
// ---------- data: har item, har jagah ----------
function build() {
  const T = Date.now(), brs = A.branches(), out = new Map(), pendBy = new Map(brs.map(b => [b, A.pend(b)]));
  for (const [k, c] of A.counts()) {
    const m = /^c-(\d+)-(.+)$/.exec(k); if (!m || !c || c.del || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.round || '')) || (Number(c.at) || 0) < T - 7 * D) continue;
    const b = Number(m[1]), id = m[2], r = A.item(b, id); if (!r || A.hidden(r)) continue;
    const f0 = r3(A.counted(c) - Number(A.sys(c, r)));
    const q = Math.abs(f0) < 0.001 ? 0 : Number(A.posted(`_posted-${c.round}-${b}`)?.items?.[f0 < 0 ? id : 'R' + id]) || 0;
    const f = Math.abs(f0) < 0.001 || q >= Math.abs(f0) - 0.001 ? 0 : r3(f0 - (f0 < 0 ? -q : q));
    let o = out.get(id); if (!o) { o = { id, name: r.name, r, locs: new Map() }; out.set(id, o); }
    o.locs.set(b, { b, r, c, f, f0, part: q > 0 && f !== 0, billed: Math.abs(f0) >= 0.001 && f === 0, pend: !!pendBy.get(b)?.has(id) });
  }
  const L = [];
  for (const o of out.values()) {
    const got = [...o.locs.values()]; if (!got.some(x => Math.abs(x.f) > 0.001)) continue;   // sab bill ho chuke / barabar
    for (const b of brs) if (!o.locs.has(b)) { const r = A.item(b, o.id); if (r && !A.hidden(r)) o.locs.set(b, { b, r, c: null, f: 0, none: true, pend: !!pendBy.get(b)?.has(o.id) }); }
    const locs = [...o.locs.values()].sort((a, b) => a.b - b.b), fs = locs.map(x => x.f), pr = Number(o.r.prate) || 0, pk = Number(o.r.pack) || 0;
    const net = r3(fs.reduce((t, f) => t + f, 0)), rsN = r2(net * pr), hasK = fs.some(f => f < -0.001), hasZ = fs.some(f => f > 0.001);
    // v2.113.1: "ek hi dafa gina" sirf FARQ wali jagah ka dekho (pehle: kisi bhi jagah ki sab se zyada ginti — barabar wali godam 2 dafa = dukan ka Rs 3,000 kam bina dobara ginti bill). Din = us ginti ka apna din (roz.js jaisa).
    const pend = locs.some(x => x.pend), once = locs.some(x => x.c && Math.abs(x.f) > 0.001 && (x.c.history || []).filter(h => (Number(h?.at) || 0) >= dayStart(x.c.at)).length < 2);
    const big = (Math.abs(rsN) >= BIG_RS || (pk > 1 && Math.abs(net) >= pk)) && once && !force.has(o.id);
    const kind = pend ? 'pend' : big ? 'big' : hasK && hasZ ? 'jagah' : net < 0 ? 'kam' : net > 0 ? 'zyada' : 'jagah';
    const unc = locs.filter(x => x.none && Math.abs(Number(x.r.stock) || 0) > 0.001);
    L.push({ ...o, locs, net, rs: rsN, kind, hasK, hasZ, unc });
  }
  return L.sort((a, b) => Math.abs(b.rs) - Math.abs(a.rs) || String(a.name).localeCompare(String(b.name)));
}
const KINDS = [['jagah', '🔁 Jagah badli', 'ek jagah kam, doosri zyada — maal hila, note nahi bana · dobara ginne ki zaroorat nahi'], ['kam', '⬇️ Asal kami', 'sab jagah mila kar bhi kam'], ['zyada', '⬆️ Asal zyadti', 'sab jagah mila kar bhi zyada'], ['big', '🔁 Bara farq — pehle dobara gino', 'asal farq Rs 2,000+ ya 1 ctn+ aur aaj ek hi dafa gina'], ['pend', '⏳ Transfer raste mein', 'note ka maal abhi POS mein nahi / tick baqi — intezar, phir gino']];
const qBusy = () => { const q = A.postQ(); return !!(q && (q.jobs || []).some(j => !j.st || j.st === 'sent') && Date.now() - (Number(q.at) || 0) < 3 * 3600e3); };
const fixable = x => ['jagah', 'kam', 'zyada'].includes(x.kind);
function jobsOf(list) {
  const jobs = new Map();
  for (const x of list) for (const l of x.locs) { if (!l.c || Math.abs(l.f) < 0.001) continue; const kd = l.f < 0 ? 'kam' : 'zyada', k = l.c.round + '|' + l.b + '|' + kd; if (!jobs.has(k)) jobs.set(k, { round: l.c.round, branch: l.b, kind: kd, items: [] }); if (!jobs.get(k).items.includes(x.id)) jobs.get(k).items.push(x.id); }
  return [...jobs.values()];
}
// ---------- dikhana ----------
function card(x) {
  const E = A.esc, own = A.isOwner(), busy = qBusy(), canC = A.canCount();
  const loc = l => { const nm = E(A.branchName(l.b)), ic = l.b === 1 ? '🏪' : '🏬';
    if (l.none) return `<div class="fq-l none"><span class="fq-ln"><span class="fq-lt">${ic} <b>${nm}</b></span><small>POS ${A.num(l.r.stock)}${cp(l.r.stock, l.r) ? ' (' + E(cp(l.r.stock, l.r)) + ')' : ''} · abhi nahi gina</small></span>${canC ? `<span class="fq-in">${(Number(l.r.pack) || 0) > 1 ? `<input type="number" inputmode="decimal" step="any" min="0" placeholder="${E(l.r.cName || 'Ctn')}" data-fq-ctn="${l.b}|${E(x.id)}">` : ''}<input type="number" inputmode="decimal" step="any" min="0" placeholder="${E(l.r.uName || 'Pcs')}" data-fq-pcs="${l.b}|${E(x.id)}"><button type="button" data-fq-save="${l.b}|${E(x.id)}">✓ Gino</button></span>` : ''}</div>`;
    const g = A.counted(l.c), s = Number(A.sys(l.c, l.r));
    return `<div class="fq-l ${l.f < -0.001 ? 'k' : l.f > 0.001 ? 'z' : 'e'}"><span class="fq-ln"><span class="fq-lt">${ic} <b>${nm}</b></span><small>gina <b>${A.num(g)}</b>${cp(g, l.r) ? ' (' + E(cp(g, l.r)) + ')' : ''} · POS ${A.num(s)}${l.c.byName ? ' · 👤 ' + E(l.c.byName) : ''}${l.billed ? ' · ✓ bill ho chuka' : l.part ? ' · kuch bill ho chuka' : ''}${l.pend ? ' · ⏳ note raste mein' : ''}</small></span><b class="fq-f">${Math.abs(l.f) < 0.001 ? '✓ 0' : sg(l.f)}</b></div>`; };
  const k = x.kind, KN = KINDS.find(z => z[0] === k);
  const tip = k === 'jagah' ? `<p class="fq-tip jagah">🔁 <b>Jagah badli</b> — ${x.locs.filter(l => l.f < -0.001).map(l => E(A.branchName(l.b)) + ' ' + sg(l.f)).join(' · ')} → ${x.locs.filter(l => l.f > 0.001).map(l => E(A.branchName(l.b)) + ' ' + sg(l.f)).join(' · ')}. Maal wahi, jagah badli — dobara ginne ki zaroorat nahi.</p>`
    : k === 'big' ? `<p class="fq-tip big">🔁 Asal farq bara hai (${rs(x.rs)}) — pehle dobara gin lein${x.unc.length ? ', aur ' + x.unc.map(l => E(A.branchName(l.b))).join(' / ') + ' bhi gin lein (shayad maal wahan ho)' : ''}.</p>`
    : k === 'pend' ? `<p class="fq-tip pend">⏳ Transfer note ka maal abhi raste mein / POS mein nahi — note poora hone ke baad gino.</p>`
    : x.unc.length ? `<p class="fq-tip ask">📍 ${x.unc.map(l => '<b>' + E(A.branchName(l.b)) + '</b>').join(' / ')} abhi nahi gini — pehle wahan bhi gin lein, shayad maal wahan ho.</p>` : '';
  const plan = fixable(x) ? x.locs.filter(l => l.c && Math.abs(l.f) >= 0.001).map(l => `${E(A.branchName(l.b))} ${l.f < 0 ? 'kam ' + A.num(-l.f) + ' → Sale' : 'zyada ' + A.num(l.f) + ' → Return'}`).join(' · ') : '';
  const trB = k === 'jagah' && A.qtrCan?.() ? `<button type="button" class="fq-tr" data-fq-tr="${E(x.id)}">⇄ Transfer se theek karo</button>` : '';   // v2.114.0
  const btns = own ? (fixable(x) ? `<div class="fq-acts"><small>${plan}</small>${trB}<button type="button" class="fq-fix" data-fq-fix="${E(x.id)}"${busy ? ' disabled' : ''}>${trB ? '🧾 Bill se theek karo' : '✓ Theek karo'}</button></div>`
    : k === 'big' ? `<div class="fq-acts">${A.canWant() ? `<button type="button" class="fq-mini" data-fq-again="${E(x.id)}">📋 Dobara ginwao</button>` : ''}<button type="button" class="fq-mini alt" data-fq-force="${E(x.id)}">✓ Theek hai (isi ginti par)</button></div>` : '') : trB ? `<div class="fq-acts">${trB}</div>` : '';
  const shown = k === 'jagah' ? x.locs.filter(l => !l.none) : x.locs;   // jagah badli: jo nahi gini wo chhupi (shor kam)
  return `<article class="fq-c ${k}" data-fq-item="${E(x.id)}"><div class="fq-hd"><span class="fq-nm"><b>${E(x.name)}</b><small>${KN ? KN[1] : ''}</small></span><span class="fq-net ${x.net < -0.001 ? 'k' : x.net > 0.001 ? 'z' : 'e'}"><small>Asal farq</small><b>${Math.abs(x.net) < 0.001 ? '0' : sg(x.net)}</b><small>${x.rs ? rs(x.rs) : 'Rs 0'}</small></span></div>${shown.map(loc).join('')}${tip}${btns}</article>`;
}
function html() {
  const E = A.esc, own = A.isOwner(), L = build(), busy = qBusy(), q = A.postQ();
  if (!A.seeStock()) return '<p class="fq-say">🔒 Stock farq sirf malik / jin ko stock dikhta hai.</p>';
  const N = k => L.filter(x => x.kind === k).length, F = st.f === 'all' ? L : L.filter(x => x.kind === st.f), fix = L.filter(fixable), fixRs = fix.reduce((t, x) => t + x.rs, 0), net = L.reduce((t, x) => t + x.rs, 0);
  const seg = `<div class="fq-seg" data-mn-seg="fq.kind" data-mn-i="🔎" data-mn-t="Kaun se dikhao" data-mn-g="⚖️ Stock farq">${[['all', 'Sab ' + L.length], ...KINDS.filter(z => N(z[0])).map(z => [z[0], z[1].split(' — ')[0] + ' ' + N(z[0])])].map(([k, t]) => `<button type="button" class="${st.f === k ? 'is-in' : ''}" data-fq-f="${k}">${E(t)}</button>`).join('')}</div>`;
  const pat = `<button type="button" class="fq-pat" data-mn-sheet="1">🔎 ${E(st.f === 'all' ? 'Sab' : (KINDS.find(z => z[0] === st.f)?.[1] || ''))} · ${A.num(F.length)} items — ⋮ se badlein</button>`;
  const qLine = q ? `<div class="fq-q${busy ? ' busy' : ''}">${(q.jobs || []).map(j => `<span class="${j.st === 'done' ? 'ok' : j.st === 'failed' ? 'bad' : j.st === 'nothing' ? 'mut' : ''}">${j.st === 'done' ? '✓' : j.st === 'failed' ? '❌' : j.st === 'nothing' ? '—' : '⏳'} ${E(A.branchName(j.branch))} ${j.kind === 'kam' ? 'kam' : 'zyada'} (${A.num((j.items || []).length)})${j.saleNo ? ' #' + E(j.saleNo) : j.returnNo ? ' R#' + E(j.returnNo) : ''}${j.error ? ' · ' + E(String(j.error).slice(0, 60)) : ''}</span>`).join('')}${busy ? '<small>PC ek ek kar ke bill + parchi bana raha hai…</small>' : ''}</div>` : '';
  const grp = ([k, t, s]) => { const g = F.filter(x => x.kind === k); return g.length ? `<section class="fq-g ${k}"><div class="fq-gh"><b>${t}</b><small>${E(s)}</small><i>${A.num(g.length)}</i></div>${g.slice(0, 60).map(card).join('')}${g.length > 60 ? `<small class="fq-mut">+${A.num(g.length - 60)} aur</small>` : ''}</section>` : ''; };
  return `<div class="fq-hero"><div><small>Bill baqi · pichhle 7 din</small><b>${A.num(L.length)} items</b></div><div><small>Asal farq (sab jagah)</small><b class="${net < 0 ? 'k' : net > 0 ? 'z' : ''}">${rs(net)}</b></div><div><small>🔁 Jagah badli</small><b>${A.num(N('jagah'))}</b></div></div>
    ${L.length ? seg + pat : ''}${qLine}
    ${L.length ? KINDS.map(grp).join('') : '<div class="fq-empty">✅<b>Koi farq baqi nahi</b><small>Jo ginti hui sab barabar ya bill ho chuka.</small></div>'}
    ${own && fix.length ? `<button type="button" class="fq-big" data-fq-all="1"${busy ? ' disabled' : ''}>✅ Sab theek karo — ${A.num(fix.length)} items · ${rs(fixRs)}<small>"stock fraq" bill — kam = Sale · zyada = Return (har jagah apna) · PC parchi khud</small></button>` : ''}
    <p class="fq-foot">Jagah badli wale item dono jagah adjust hote hain — POS stock sahi, nuqsan sirf asal farq. ${own ? '' : 'Bill malik banata hai.'}</p>`;
}
function dlg() { const d = $('dialog'); if (!d) return; d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '⚖️ Stock farq — sab jagah'; $('dialogBody').innerHTML = `<div class="fq-root" id="fqRoot">${html()}</div>`; if (!d.open) d.showModal(); }
const paint = () => { const el = $('fqRoot'); if (el && A) { const y = $('dialogBody')?.scrollTop || 0; el.innerHTML = html(); try { $('dialogBody').scrollTop = y; } catch {} } };
let dirty = false;
export function farqOpen(api) { A = api; dlg(); }
export function farqLive(api) { if (api) A = api; if (!$('fqRoot') || !A) return; const ae = document.activeElement; if (ae && ae.closest?.('#fqRoot') && ae.matches('input')) { dirty = true; return; } paint(); }
document.addEventListener('focusout', e => { if (dirty && e.target?.closest?.('#fqRoot')) setTimeout(() => { if (dirty && !document.activeElement?.closest?.('#fqRoot input')) { dirty = false; paint(); } }, 300); });
async function fixList(list, label) {
  const J0 = jobsOf(list); if (!J0.length) { A.notice('Theek karne ko kuch nahi'); return; }
  const J = J0.slice(0, 40), cut = J0.length - J.length;   // v2.113.1: cloud 40 hisse tak (pehle 12 par baqi CHUPKE se gir jate) — zyada hon to saaf batao
  const tot = list.reduce((t, x) => t + x.rs, 0);
  if (!confirm(`✅ ${label} — "stock fraq" bill (${J.length} hisse)\n${J.map(j => `${A.branchName(j.branch)} · ${j.kind === 'kam' ? 'kam (Sale)' : 'zyada (Return)'} · ${j.items.length} items`).join('\n')}${cut ? `\n⚠️ ${cut} hisse abhi NAHI (ek dafa 40 tak) — yeh ho jayein to dobara "Sab theek karo"` : ''}\nAsal farq ${rs(tot)}\n\nPC bill + parchi banaye?`)) return;
  try { await A.cloud.requestFarqQueue(J); for (const x of list) force.delete(x.id); A.notice('✓ PC ko bhej diya — ek ek kar ke bill + parchi (1–3 min)'); setTimeout(paint, 300); }
  catch (e) { A.notice('Nahi bheja: ' + (e?.message || e)); }
}
document.addEventListener('click', async e => {
  const t = e.target.closest?.('[data-fq-f],[data-fq-fix],[data-fq-all],[data-fq-save],[data-fq-again],[data-fq-force],[data-fq-tr]'); if (!t || !A || !t.closest('#fqRoot')) return;
  if (t.dataset.fqTr) { const x = build().find(y => y.id === t.dataset.fqTr); if (!x) return; let k = null, z = null; for (const l of x.locs) { if (!l.c) continue; if (l.f < -0.001 && (!k || l.f < k.f)) k = l; if (l.f > 0.001 && (!z || l.f > z.f)) z = l; }   // v2.114.0: ⇄ jagah badli = TN (sab se bara kam → sab se bari zyadti)
    if (!k || !z) { A.notice('Jagah badli ka jora nahi mila'); return; } const q = r3(Math.min(-k.f, z.f)); A.qtr({ id: x.id, from: k.b, to: z.b, qty: q, recount: true, why: '🔁 Jagah badli — ' + A.branchName(k.b) + ' mein kam, ' + A.branchName(z.b) + ' mein zyada. Note banne ke baad dono jagah ki ginti khud taza (farq 0) — bill nahi.' }); return; }
  const d = t.dataset;
  try {
    if (d.fqF) { st.f = d.fqF; paint(); return; }
    if (d.fqSave) { const [b, id] = d.fqSave.split('|'), root = t.closest('.fq-l'), cI = root?.querySelector('[data-fq-ctn]'), pI = root?.querySelector('[data-fq-pcs]');
      const c = Number(cI?.value || 0) || 0, p = Number(pI?.value || 0) || 0; if (c < 0 || p < 0 || (!cI?.value && !pI?.value)) { A.notice('Ginti likhein (Ctn / Pcs)'); return; }
      t.disabled = true; try { const r = await A.save(Number(b), id, c, p); if (r) A.notice('✓ ' + A.branchName(Number(b)) + ': ginti save (' + A.num(r.total) + ')'); } finally { t.disabled = false; } return; }
    if (!A.isOwner()) return;
    if (d.fqFix) { const x = build().find(z => z.id === d.fqFix); if (x && fixable(x)) await fixList([x], x.name); return; }
    if (d.fqAll != null) { await fixList(build().filter(fixable), 'Sab theek'); return; }
    if (d.fqForce) { force.add(d.fqForce); A.notice('✓ Isi ginti par theek hoga — ab "✓ Theek karo"'); paint(); return; }
    if (d.fqAgain) { const x = build().find(z => z.id === d.fqAgain); const ks = x ? A.rozKeys(x.locs.filter(l => l.c && Math.abs(l.f) >= 0.001 || l.none).map(l => l.b)) : []; if (!ks.length) { A.notice('Roz ki ginti ki jagah nahi mili'); return; } for (const k of ks) await A.cloud.rozWant(k, [d.fqAgain], true); A.notice('📋 Agle larke ki list mein sab se upar — dobara ginti'); return; }
  } catch (er) { A.notice('Nahi hua: ' + (er?.message || er)); }
});
export const _fqTest = { build: api => { A = api; return build(); }, jobsOf };
