// qtr.js — v2.114.0 (23 Oct 2026): ⇄ JALDI TRANSFER — har stock screen se EK item ka transfer note, "transfer ke baad" har jagah ka stock saath.
//   Malik (parchi: "G1 10 · G2 — · G3 0 · Noor 0 → Transfer Godam 1 → Noor → After transfer stock: Noor 10 · Godam 1 0"; "zero wale godam ka naam
//   na aaye · jab bhi transfer — direct ho jaye · password laga do · ijazat ki zaroorat nahi, sab par default — jahan jahan stock screen hai").
//   Se = sirf jahan stock hai · Ko = baqi sab · tadad ctn + pcs ("Sab") · neeche "Transfer ke baad" (sirf jin ko stock dikhta hai).
//   WAHI transferJobs → PC transfer-sync (POS mein TN + parchi, pehle jaisa; godam mein stock kam = mana, dukan se nahi — trSave wala qaida).
//   Mulazim = 🔒 ⛔ Band wala password: jaanch Firebase RULES 2.70 karte hain (app ko password maloom hi nahi), job se foran mita diya jata hai.
//   Malik = password nahi. Ginti ka 🔁 jagah badli (o.recount) = TN ban jaye to dono jagah ki ginti WAHI tadad par dobara save → farq 0
//   (fraq bill nahi — dohra theek nahi). AI NAHI.
const $ = id => document.getElementById(id);
let A = null, S = null, busy = false;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const E = s => A.esc(String(s ?? ''));
const ic = b => Number(b) === 1 ? '🏪' : '🏬';
// 6 ctn 9 · 9 pcs · 10 pcs · 0
export function qtrFmt(n, r, num = A?.num || (x => String(x))) {
  const pk = Number(r?.pack) || 0, a = Math.abs(Number(n) || 0), sg = Number(n) < -0.0005 ? '−' : '';
  if (pk <= 1) return a < 0.0005 ? '0' : sg + num(r3(a)) + ' ' + (r?.uName || 'pcs');
  const c = Math.floor(a / pk + 1e-9), p = r3(a - c * pk);
  return (sg + [c ? `${num(c)} ${r.cName || 'ctn'}` : '', p ? `${num(p)}${c ? '' : ' ' + (r.uName || 'pcs')}` : ''].filter(Boolean).join(' ')) || '0';
}
// har jagah (POS mein item na ho = r null — "Ko" phir bhi ban sakta)
const all = () => A.branches().map(b => ({ b: Number(b), r: A.item(b, S.id) })).filter(x => !(x.r && A.hidden(x.r)));
const stk = b => Number(A.item(b, S.id)?.stock) || 0;
const base = () => A.item(S.from, S.id) || all().find(x => x.r)?.r || null;
const qtyOf = () => { const r = base(), pk = Number(r?.pack) || 0; return r3((pk > 1 ? (Number(S.ctn) || 0) * pk : 0) + (Number(S.pcs) || 0) + (pk > 1 ? 0 : Number(S.ctn) || 0)); };
const split = (q, r) => { const pk = Number(r?.pack) || 0; if (pk <= 1) return { ctn: '', pcs: q > 0 ? String(r3(q)) : '' }; const c = Math.floor(q / pk + 1e-9), p = r3(q - c * pk); return { ctn: c ? String(c) : '', pcs: p ? String(p) : '' }; };
export const qtrOpenNow = () => !!$('qtrDlg')?.open;
export function qtrClose() { const d = $('qtrDlg'); if (!d?.open) return false; try { d.close(); } catch {} if (S) S.pw = ''; return true; }
window.ntQtrClose = qtrClose;   // app.js popstate: phone ka back = pehle yeh khirki
// o: { id, from, to, qty (pcs), recount: true (ginti ka jagah badli), why }
export function qtrOpen(api, o) {
  A = api; if (!A.canTr()) { A.notice('⇄ Transfer — ijazat nahi (malik se kahein)'); return; }
  S = { id: String(o.id), ctn: '', pcs: '', note: '', recount: !!o.recount, why: o.why || '' };
  const L = all(), has = L.filter(x => x.r && (Number(x.r.stock) || 0) > 0.0005), see = A.see();
  if (!L.some(x => x.r)) { A.notice('Item nahi mila'); return; }
  S.from = Number(o.from) || 0;
  const okFrom = b => L.some(x => x.b === b && x.r) && (!see || stk(b) > 0.0005 || o.recount);
  if (!okFrom(S.from)) S.from = (has.find(x => x.b === Number(A.here())) || [...has].sort((a, b) => stk(b.b) - stk(a.b))[0] || L.find(x => x.r)).b;
  const dk = L.find(x => x.b === 1), g1 = L.find(x => x.b !== 1 && /godam\s*-?\s*1\b/i.test(A.branchName(x.b))) || L.find(x => x.b !== 1);
  S.to = Number(o.to) || 0; if (!L.some(x => x.b === S.to) || S.to === S.from) S.to = (S.from !== 1 ? dk : g1)?.b || (L.find(x => x.b !== S.from) || {}).b || 0;
  if (o.qty > 0) Object.assign(S, split(r3(o.qty), base()));
  let d = $('qtrDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'qtrDlg'; d.className = 'qtr-dlg'; document.body.append(d); d.addEventListener('close', () => { busy = false; if (S) S.pw = ''; }); }
  paint(); try { if (!d.open) d.showModal(); } catch { d.setAttribute('open', ''); }
  setTimeout(() => { try { d.querySelector(S.ctn || S.pcs ? '[data-qtr-go]' : '[data-qtr-q]')?.focus({ preventScroll: true }); } catch {} }, 60);
}
function afterHTML() {
  if (!A.see()) return '';
  const q = qtyOf(), r0 = base(), rows = all().filter(x => x.b === S.from || x.b === S.to || (x.r && Math.abs(Number(x.r.stock) || 0) > 0.0005));
  return `<div class="qtr-after"><small class="qtr-lb">Transfer ke baad</small>${rows.map(x => { const r = x.r || r0, s = Number(x.r?.stock) || 0, n = x.b === S.from ? r3(s - q) : x.b === S.to ? r3(s + q) : s, ch = (x.b === S.from || x.b === S.to) && q > 0;
    return `<div class="qtr-ar${ch ? ' ch' : ''}${x.b === S.to && q > 0 ? ' up' : x.b === S.from && q > 0 ? ' dn' : ''}${n < -0.0005 ? ' neg' : ''}"><span class="qtr-an">${ic(x.b)} ${E(A.branchName(x.b))}</span><span class="qtr-av">${ch ? `<s>${E(x.r ? qtrFmt(s, r) : '—')}</s><i>→</i>` : ''}<b>${E(qtrFmt(n, r))}</b></span></div>`; }).join('')}</div>`;
}
function paint() {
  const d = $('qtrDlg'); if (!d || !S) return;
  const L = all(), see = A.see(), r = base(), pk = Number(r?.pack) || 0, own = A.isOwner();
  const fromL = L.filter(x => x.r && (!see || (Number(x.r.stock) || 0) > 0.0005 || x.b === S.from)), toL = L.filter(x => x.b !== S.from);
  const chip = (x, k, on) => `<button type="button" class="qtr-c${on ? ' is-in' : ''}" data-qtr-${k}="${x.b}"><i>${ic(x.b)}</i><b>${E(A.branchName(x.b))}</b>${see ? `<small>${E(x.r ? qtrFmt(x.r.stock, x.r) : '—')}</small>` : ''}</button>`;
  const fs = stk(S.from);
  d.innerHTML = `<div class="qtr-hd"><b>⇄ Transfer${S.recount ? ' <em>⚖️ ginti ka farq</em>' : ''}</b><button type="button" class="qtr-x" data-qtr-x="1" aria-label="Band">✕</button></div>
  <div class="qtr-it"><b>${E(r?.name || '')}</b>${pk > 1 ? `<small>1 ${E(r.cName || 'ctn')} = ${A.num(pk)} ${E(r.uName || 'pcs')}</small>` : ''}</div>
  ${S.why ? `<p class="qtr-why">${E(S.why)}</p>` : ''}
  <div class="qtr-sec"><small class="qtr-lb">Se — kahan se</small><div class="qtr-cs">${fromL.map(x => chip(x, 'f', x.b === S.from)).join('') || '<em class="qtr-none">Kahin stock nahi</em>'}</div></div>
  <div class="qtr-sec"><small class="qtr-lb">Ko — kahan</small><div class="qtr-cs">${toL.map(x => chip(x, 't', x.b === S.to)).join('')}</div></div>
  <div class="qtr-sec"><small class="qtr-lb">Tadad</small><div class="qtr-q">${pk > 1 ? `<label><input type="number" inputmode="decimal" step="any" min="0" data-qtr-q="ctn" value="${E(S.ctn)}" placeholder="0"><span>${E(r.cName || 'Ctn')}</span></label>` : ''}<label><input type="number" inputmode="decimal" step="any" min="0" data-qtr-q="pcs" value="${E(S.pcs)}" placeholder="0"><span>${E(r?.uName || 'Pcs')}</span></label>${see && fs > 0.0005 ? `<button type="button" class="qtr-all" data-qtr-all="1">Sab · ${E(qtrFmt(fs, r))}</button>` : ''}</div></div>
  <div id="qtrAfter">${afterHTML()}</div>
  ${own ? '' : `<label class="qtr-pw"><span>🔒 Password <small>⛔ Band wala — malik se</small></span><input type="password" id="qtrPw" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="••••" value="${E(S.pw || '')}"></label>`}
  <input class="qtr-note" id="qtrNote" maxlength="100" placeholder="Note (ikhtiyari)" value="${E(S.note)}">
  <button type="button" class="qtr-go" data-qtr-go="1">⇄ Transfer note banao</button>
  <p class="qtr-msg" id="qtrMsg" aria-live="polite"></p>`;
}
const msg = (t, k = '') => { const m = $('qtrMsg'); if (m) { m.textContent = t; m.className = 'qtr-msg' + (k ? ' ' + k : ''); } };
const goBtn = on => { const b = $('qtrDlg')?.querySelector('[data-qtr-go]'); if (b) b.disabled = !on; };
document.addEventListener('click', e => {
  const t = e.target.closest?.('#qtrDlg [data-qtr-x],#qtrDlg [data-qtr-f],#qtrDlg [data-qtr-t],#qtrDlg [data-qtr-all],#qtrDlg [data-qtr-go]'); if (!t || !S) return;
  const d = t.dataset;
  if (d.qtrX) { qtrClose(); return; }
  if (busy) return;
  const keep = () => { S.note = $('qtrNote')?.value ?? S.note; if ($('qtrPw')) S.pw = $('qtrPw').value; };   // chip badla = khirki dobara bani — likha hua (note / password) wahi
  if (d.qtrF) { keep(); S.from = Number(d.qtrF); if (S.to === S.from) S.to = (all().find(x => x.b !== S.from) || {}).b || 0; paint(); return; }
  if (d.qtrT) { keep(); S.to = Number(d.qtrT); paint(); return; }
  if (d.qtrAll) { keep(); Object.assign(S, split(stk(S.from), base())); paint(); return; }
  if (d.qtrGo) { keep(); go(); }
});
document.addEventListener('input', e => { const i = e.target.closest?.('#qtrDlg [data-qtr-q]'); if (!i || !S) return; S[i.dataset.qtrQ] = i.value; const a = $('qtrAfter'); if (a) a.innerHTML = afterHTML(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('#qtrDlg input') && S && !busy) { e.preventDefault(); S.note = $('qtrNote')?.value ?? S.note; if ($('qtrPw')) S.pw = $('qtrPw').value; go(); } });
async function go() {
  const r = A.item(S.from, S.id); if (!r) { msg('⚠️ "Se" wali jagah par yeh item nahi', 'bad'); return; }
  if (!S.to || S.from === S.to) { msg('⚠️ "Se" aur "Ko" alag jagah chunein', 'bad'); return; }
  const q = qtyOf(), pk = Number(r.pack) || 0; if (!(q > 0)) { msg('⚠️ Tadad likhein', 'bad'); $('qtrDlg')?.querySelector('[data-qtr-q]')?.focus(); return; }
  if (S.from !== 1 && stk(S.from) < q - 0.0005) { msg(`⛔ ${A.branchName(S.from)} mein stock kam${A.see() ? ' — POS ' + qtrFmt(stk(S.from), r) : ''}`, 'bad'); return; }
  const own = A.isOwner(), pw = own ? '' : String($('qtrPw')?.value || '').trim();
  if (!own && !pw) { msg('🔒 Password likhein (⛔ Band wala — malik se poochein)', 'bad'); $('qtrPw')?.focus(); return; }
  const fN = A.branchName(S.from), tN = A.branchName(S.to);
  if (!confirm(`⇄ ${r.name}\n${qtrFmt(q, r)} · ${fN} → ${tN}${S.recount ? '\n\n⚖️ Ginti ka farq — maal pehle se wahan hai; note sirf hisaab ke liye.' : ''}\n\nPOS mein transfer note banayein?`)) return;
  const c = pk > 1 ? Math.floor(q / pk + 1e-9) : 0, p = r3(q - c * (pk > 1 ? pk : 0));
  const line = { itemId: String(r.id), name: r.name, qty: q, ctn: c, pcs: p, pack: pk, cName: r.cName || 'Ctn', uName: r.uName || 'Pcs' };
  const note = ((S.recount ? '⚖️ Ginti farq - maal pehle se wahan (sirf hisaab)' : '⇄ Stock se')   /* parchi ascii: '—' ki jagah '-' */ + (S.note.trim() ? ' · ' + S.note.trim() : '')).slice(0, 150);
  busy = true; goBtn(false); msg('🖥 PC ko ja raha hai…', 'wait');
  let jid;
  try { jid = await A.cloud.requestTransfer({ op: 'create', copies: A.copies(), from: S.from, to: S.to, lines: [line], note, byName: A.who(), ...(pw ? { pw } : {}) }); }
  catch (er) { busy = false; goBtn(true); const m = String(er?.code || '') + ' ' + String(er?.message || er); msg(pw && /permission|denied|insufficient/i.test(m) ? '❌ Password ghalat — ⛔ Band wala password malik se poochein' : '⚠️ ' + (er?.message || er), 'bad'); return; }
  const job = { id: S.id, from: S.from, to: S.to, q, name: r.name, recount: S.recount, fN, tN, item: r };
  msg('✓ Bhej diya — PC transfer note bana raha hai (ho jane par upar batayega)', 'ok');
  track(jid, job);
  setTimeout(() => { if (qtrOpenNow() && S && busy) { busy = false; qtrClose(); } }, 1600);
}
// PC ka jawab — khirki band ho tab bhi (10 min): ✓ TN no · ginti wala = dono jagah dobara save (farq 0)
function track(jid, job) {
  let stop = null, done = false;
  const end = async (ok, t) => { if (done) return; done = true; try { stop && stop(); } catch {}
    if (!ok) { A.notice(`⚠️ Transfer nahi bana (${job.name}): ${t}`); return; }
    let rc = '';
    if (job.recount) { let n = 0; for (const b of [job.from, job.to]) { try { if (await A.recount(b, job.id, '⇄ TN ' + (t || '') + ' ke baad')) n++; } catch (er) { console.warn('qtr recount', er); } } rc = n ? ' · ginti taza (farq 0)' : ''; }
    A.notice(`✓ Transfer note ${t} — ${job.name}: ${qtrFmt(job.q, job.item)} ${job.fN} → ${job.tN}${rc}`);
    try { A.after?.(); } catch {} };
  stop = A.cloud.watchTransfer(jid, j => { if (!j) return; if (j.status === 'done') end(true, j.transferNo || ''); else if (j.status === 'failed') end(false, j.error || 'masla'); });
  setTimeout(() => end(false, 'PC se 10 min mein jawab nahi aaya — PC on hai? (hukum mehfooz hai)'), 10 * 60000);
}
export const _qtrTest = { qtrFmt, split: (q, r) => split(q, r) };
