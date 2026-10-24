// qtr.js — v2.114.0 (23 Oct 2026): ⇄ JALDI TRANSFER — har stock screen se EK item ka transfer note, "transfer ke baad" har jagah ka stock saath.
//   Malik (parchi: "G1 10 · G2 — · G3 0 · Noor 0 → Transfer Godam 1 → Noor → After transfer stock: Noor 10 · Godam 1 0"; "zero wale godam ka naam
//   na aaye · jab bhi transfer — direct ho jaye · password laga do · ijazat ki zaroorat nahi, sab par default — jahan jahan stock screen hai").
//   Se = sirf jahan stock hai · Ko = baqi sab · tadad ctn + pcs ("Sab") · neeche "Transfer ke baad" (sirf jin ko stock dikhta hai).
//   WAHI transferJobs → PC transfer-sync (POS mein TN + parchi, pehle jaisa; godam mein stock kam = mana, dukan se nahi — trSave wala qaida).
//   Mulazim = 🔒 ⛔ Band wala password: jaanch Firebase RULES 2.70 karte hain (app ko password maloom hi nahi), job se foran mita diya jata hai.
//   Malik = password nahi. Ginti ka 🔁 jagah badli (o.recount) = TN ban jaye to dono jagah ki ginti WAHI tadad par dobara save → farq 0
//   (fraq bill nahi — dohra theek nahi). AI NAHI.
// v2.116.0 (25 Oct 2026): ⚖️ STOCK THEEK tab (malik: "transfer screen par ek hi time mein Noor Traders ka carton piece aur godam ka carton piece —
//   app bataye itna kam Noor mein, itna zyada godam mein — physical stock adjust, baqi sale farq, chhutti"; "larkon ki ginti waisi hi rahe").
//   Do jagah (🏪 dukan + chuni godam) ka ASAL stock (Ctn / Pcs, ya ☐ 0 khali) − POS (live) = farq → jagah badli wala hissa = TN (note "sirf hisaab":
//   Zeeshan ki tick / raste mein NAHI, register mein haan) + baqi = "stock fraq" bill (PC post-farq v18: stockCount/_adj-*, TN done hone ke BAAD).
//   GINTI KO HAATH NAHI (count doc / recount nahi). Mulazim: TN (⛔ password) + bill = 📲 malik se manzoori. CAP stock.theek.
//   Neeche 📜 is item ke transfer note: 3 din · chips Hafta / 2 hafte / Mahina (dabane par). AI NAHI.
const $ = id => document.getElementById(id);
let A = null, S = null, busy = false;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const E3 = 0.0005;
const E = s => A.esc(String(s ?? ''));
const ic = b => Number(b) === 1 ? '🏪' : '🏬';
export const QTR_HISAAB = 'Stock theek - maal pehle se wahan (sirf hisaab)';   // POS Description ascii (VarChar) — "sirf hisaab" = Zeeshan ki tick / raste mein nahi
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
const fixOk = () => !!(A?.canFix?.() && A.see());
// o: { id, from, to, qty (pcs), recount: true (ginti ka jagah badli), why, tab: 'fix' }
export function qtrOpen(api, o) {
  A = api; if (!A.canTr()) { A.notice('⇄ Transfer — ijazat nahi (malik se kahein)'); return; }
  S = { id: String(o.id), ctn: '', pcs: '', note: '', recount: !!o.recount, why: o.why || '', tab: 'tr', fa: { ctn: '', pcs: '', z: false }, fb: { ctn: '', pcs: '', z: false }, gb: 0, hd: 3 };
  const L = all(), has = L.filter(x => x.r && (Number(x.r.stock) || 0) > 0.0005), see = A.see();
  if (!L.some(x => x.r)) { A.notice('Item nahi mila'); return; }
  S.from = Number(o.from) || 0;
  const okFrom = b => L.some(x => x.b === b && x.r) && (!see || stk(b) > 0.0005 || o.recount);
  if (!okFrom(S.from)) S.from = (has.find(x => x.b === Number(A.here())) || [...has].sort((a, b) => stk(b.b) - stk(a.b))[0] || L.find(x => x.r)).b;
  const dk = L.find(x => x.b === 1), g1 = L.find(x => x.b !== 1 && /godam\s*-?\s*1\b/i.test(A.branchName(x.b))) || L.find(x => x.b !== 1);
  S.to = Number(o.to) || 0; if (!L.some(x => x.b === S.to) || S.to === S.from) S.to = (S.from !== 1 ? dk : g1)?.b || (L.find(x => x.b !== S.from) || {}).b || 0;
  if (o.qty > 0) Object.assign(S, split(r3(o.qty), base()));
  if (o.tab === 'fix' && fixOk() && !S.recount) S.tab = 'fix';
  S.gb = fixGodamDefault();
  let d = $('qtrDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'qtrDlg'; d.className = 'qtr-dlg'; document.body.append(d); d.addEventListener('close', () => { busy = false; if (S) S.pw = ''; }); }
  paint(); try { if (!d.open) d.showModal(); } catch { d.setAttribute('open', ''); }
  setTimeout(() => { try { d.querySelector(S.tab === 'fix' ? '[data-qtf-q]' : S.ctn || S.pcs ? '[data-qtr-go]' : '[data-qtr-q]')?.focus({ preventScroll: true }); } catch {} }, 60);
}
function afterHTML() {
  if (!A.see()) return '';
  const q = qtyOf(), r0 = base(), rows = all().filter(x => x.b === S.from || x.b === S.to || (x.r && Math.abs(Number(x.r.stock) || 0) > 0.0005));
  return `<div class="qtr-after"><small class="qtr-lb">Transfer ke baad</small>${rows.map(x => { const r = x.r || r0, s = Number(x.r?.stock) || 0, n = x.b === S.from ? r3(s - q) : x.b === S.to ? r3(s + q) : s, ch = (x.b === S.from || x.b === S.to) && q > 0;
    return `<div class="qtr-ar${ch ? ' ch' : ''}${x.b === S.to && q > 0 ? ' up' : x.b === S.from && q > 0 ? ' dn' : ''}${n < -0.0005 ? ' neg' : ''}"><span class="qtr-an">${ic(x.b)} ${E(A.branchName(x.b))}</span><span class="qtr-av">${ch ? `<s>${E(x.r ? qtrFmt(s, r) : '—')}</s><i>→</i>` : ''}<b>${E(qtrFmt(n, r))}</b></span></div>`; }).join('')}</div>`;
}
// ---------- ⚖️ STOCK THEEK ----------
const fixA = () => { const m = Number(A.main?.() ?? 1) || 1, L = all().filter(x => x.r); return (L.find(x => x.b === m) || L[0] || {}).b || m; };
function fixGodamDefault() {
  const a = fixA(), L = all().filter(x => x.r && x.b !== a); if (!L.length) return 0;
  const g1 = L.find(x => /godam\s*-?\s*1\b/i.test(A.branchName(x.b)));
  const big = [...L].sort((x, y) => Math.abs(Number(y.r.stock) || 0) - Math.abs(Number(x.r.stock) || 0))[0];
  return (Math.abs(Number(big?.r?.stock) || 0) > E3 ? big : g1 || L[0]).b;
}
const fFilled = f => !!(f.z || String(f.ctn).trim() !== '' || String(f.pcs).trim() !== '');
const fQty = (f, pk) => f.z ? 0 : r3((pk > 1 ? (Number(f.ctn) || 0) * pk : 0) + (Number(f.pcs) || 0) + (pk > 1 ? 0 : Number(f.ctn) || 0));
// asal − POS = farq · ek jagah kam + doosri zyada = TN (chhoti tadad, kam wali → zyada wali) · baqi = bill (kam = Sale, zyada = Return)
export function qtrPlan(pa, pb, from1 = 1) {
  const P = [pa, pb].map(x => ({ ...x, d: x.on ? r3(x.phys - x.pos) : 0, rem: null }));
  const [a, b] = P; let tn = null;
  if (a.on && b.on) {
    const src = a.d < -E3 && b.d > E3 ? a : b.d < -E3 && a.d > E3 ? b : null;
    if (src) {
      const dst = src === a ? b : a; let q = r3(Math.min(-src.d, dst.d));
      if (src.b !== from1 && src.pos < q) q = r3(Math.max(0, src.pos));   // godam se POS stock se zyada transfer nahi (transfer-sync mana karta)
      if (q > E3) { tn = { from: src.b, to: dst.b, q }; src.rem = r3(src.d + q); dst.rem = r3(dst.d - q); }
    }
  }
  for (const x of P) if (x.rem == null) x.rem = x.d;
  const bills = P.filter(x => x.on && Math.abs(x.rem) > E3).map(x => ({ b: x.b, kind: x.rem < 0 ? 'kam' : 'zyada', q: r3(Math.abs(x.rem)) }));
  return { P, tn, bills, any: P.some(x => x.on), both: a.on && b.on };
}
function planNow() {
  const r = base(), pk = Number(r?.pack) || 0, a = fixA(), b = S.gb;
  const one = (bb, f) => ({ b: bb, it: A.item(bb, S.id), pos: r3(Number(A.item(bb, S.id)?.stock) || 0), on: !!bb && fFilled(f), phys: fQty(f, pk) });
  return qtrPlan(one(a, S.fa), one(b, S.fb), Number(A.main?.() ?? 1) || 1);
}
const rsOf = (q, it, r) => Math.round(q * (Number(it?.prate) || Number(r?.prate) || 0));
function planHTML(p) {
  const r = base(), num = A.num, nm = b => A.branchName(b);
  if (!p.any) return '<p class="qtf-tip">Dono jagah ka <b>asal</b> stock likhein — jahan maal nahi wahan <b>☐ 0</b> tick.</p>';
  const rows = p.P.filter(x => x.on).map(x => `<div class="qtf-l"><span>${ic(x.b)} ${E(nm(x.b))}</span><span>POS ${E(qtrFmt(x.pos, r))} → asal <b>${E(qtrFmt(x.phys, r))}</b></span><b class="${x.d < -E3 ? 'kam' : x.d > E3 ? 'zy' : 'ok'}">${x.d < -E3 ? E(qtrFmt(-x.d, r)) + ' kam' : x.d > E3 ? E(qtrFmt(x.d, r)) + ' zyada' : '✓ barabar'}</b></div>`).join('');
  const own = A.isOwner();
  const acts = [p.tn ? `<div class="qtf-do tn">⇄ <b>${E(qtrFmt(p.tn.q, r))}</b> ${E(nm(p.tn.from))} → ${E(nm(p.tn.to))}<small>transfer note · sirf hisaab (maal pehle se wahan)</small></div>` : '',
    ...p.bills.map(x => { const it = p.P.find(y => y.b === x.b)?.it, rs = rsOf(x.q, it, r); return `<div class="qtf-do ${x.kind}">🧾 <b>${E(qtrFmt(x.q, r))} ${x.kind === 'kam' ? 'kam' : 'zyada'}</b> — ${E(nm(x.b))}<small>stock fraq ${x.kind === 'kam' ? 'Sale' : 'Return'}${rs ? ' · Rs ' + (x.kind === 'kam' ? '−' : '+') + num(rs) : ''}${own ? '' : ' · 📲 malik ki manzoori se'}</small></div>`; })].join('');
  return `<div class="qtf-plan">${rows}${acts ? `<div class="qtf-acts"><small class="qtr-lb">✓ Theek karo par</small>${acts}</div>` : (p.both || p.P.filter(x => x.on).every(x => Math.abs(x.d) <= E3) ? '<p class="qtf-ok">✓ Barabar — kuch theek nahi karna</p>' : '')}${!p.both && p.any ? '<p class="qtf-tip">Doosri jagah bhi likhein to transfer se theek hoga (warna sirf bill).</p>' : ''}</div>`;
}
// 📋 ginti ka farq abhi bill nahi hua (pos-stock qtrGinti) — sirf khabar
const gintiOf = b => { try { return b ? A.ginti?.(b, S.id) || null : null; } catch { return null; } };
function fixHTML() {
  const r = base(), pk = Number(r?.pack) || 0, own = A.isOwner(), a = fixA(), Gs = all().filter(x => x.r && x.b !== a);
  const place = (k, b, f) => { const it = A.item(b, S.id), g = gintiOf(b); return `<div class="qtf-row${f.z ? ' z' : ''}" data-qtf-row="${k}"><div class="qtf-h"><b>${ic(b)} ${E(A.branchName(b))}</b><small data-qtf-pos="${k}">POS ${E(qtrFmt(Number(it?.stock) || 0, r))}</small></div>${g ? `<p class="qtf-gw">📋 Larkon ki ginti mein yahan <b>${E(qtrFmt(Math.abs(g.f), r))} ${g.f < 0 ? 'kam' : 'zyada'}</b> ka farq abhi bill nahi hua — yahan bhi theek kiya to <b>dohra</b> bill ban sakta hai</p>` : ''}
    <div class="qtf-in">${pk > 1 ? `<label><input type="number" inputmode="decimal" step="any" min="0" data-qtf-q="${k}:ctn" value="${E(f.z ? '' : f.ctn)}" placeholder="0"${f.z ? ' disabled' : ''}><span>${E(r.cName || 'Ctn')}</span></label>` : ''}<label><input type="number" inputmode="decimal" step="any" min="0" data-qtf-q="${k}:pcs" value="${E(f.z ? '' : f.pcs)}" placeholder="0"${f.z ? ' disabled' : ''}><span>${E(r?.uName || 'Pcs')}</span></label>
    <label class="qtf-z"><input type="checkbox" data-qtf-z="${k}"${f.z ? ' checked' : ''}><span>0 · khali</span></label></div></div>`; };
  return `<div class="qtr-sec"><small class="qtr-lb">Asal stock likhein — larkon ki ginti nahi chhuti</small>${place('a', a, S.fa)}
    ${Gs.length > 1 ? `<div class="qtr-cs qtf-gs">${Gs.map(x => `<button type="button" class="qtr-c${x.b === S.gb ? ' is-in' : ''}" data-qtf-g="${x.b}"><i>${ic(x.b)}</i><b>${E(A.branchName(x.b))}</b><small>${E(qtrFmt(x.r.stock, x.r))}</small></button>`).join('')}</div>` : ''}
    ${S.gb ? place('b', S.gb, S.fb) : '<p class="qtf-tip">Is item ki koi godam POS mein nahi</p>'}</div>
  <div id="qtfPlan">${planHTML(planNow())}</div>
  ${own ? '' : `<label class="qtr-pw"><span>🔒 Password <small>transfer ke liye · ⛔ Band wala — malik se</small></span><input type="password" id="qtrPw" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="••••" value="${E(S.pw || '')}"></label>`}
  <button type="button" class="qtr-go qtf-go" data-qtf-go="1">✓ Theek karo</button>`;
}
// ---------- 📜 is item ke transfer note ----------
const HD = [[3, '3 din'], [7, 'Hafta'], [14, '2 hafte'], [30, 'Mahina']];
const dt = t => { const d = new Date(t); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
function histHTML() {
  if (!A.trHist) return '';
  const r = base(), L = A.trHist(S.id, S.hd) || [];
  return `<div class="qth" data-qth-root="1"><div class="qth-h"><b>📜 Is item ke transfer note</b><span class="qth-cs">${HD.map(([n, t]) => `<button type="button" class="qth-c${S.hd === n ? ' is-in' : ''}" data-qth="${n}">${t}</button>`).join('')}</span></div>
    ${L.length ? `<div class="qth-list">${L.map(x => `<div class="qth-r${x.cancelled ? ' x' : ''}${x.pend ? ' pend' : ''}"><span class="qth-d">${E(dt(x.at))}</span><span class="qth-m"><b>${x.pend ? '⏳ PC bana raha hai' : 'TN ' + E(x.no || '—')}</b> · ${ic(x.from)} ${E(A.branchName(x.from))} → ${ic(x.to)} ${E(A.branchName(x.to))}${x.hisaab ? ' <i class="qth-t">⚖️ sirf hisaab</i>' : ''}${x.cancelled ? ' <i class="qth-t x">❌ cancel</i>' : ''}${x.edited ? ' ✏️' : ''}${x.by ? ' · ' + E(x.by) : ''}</span><b class="qth-q">${E(qtrFmt(x.q, r))}</b></div>`).join('')}</div>`
      : `<p class="qth-none">Pichhle ${S.hd === 3 ? '3 din' : HD.find(h => h[0] === S.hd)?.[1].toLowerCase() || S.hd + ' din'} mein is item ka koi transfer note nahi</p>`}</div>`;
}
function tabsHTML() {
  if (!fixOk() || S.recount) return '';
  return `<div class="qtr-tabs" role="tablist"><button type="button" class="qtr-tab${S.tab === 'tr' ? ' is-in' : ''}" data-qtr-tab="tr">⇄ Transfer</button><button type="button" class="qtr-tab${S.tab === 'fix' ? ' is-in' : ''}" data-qtr-tab="fix">⚖️ Stock theek</button></div>`;
}
function paint() {
  const d = $('qtrDlg'); if (!d || !S) return;
  if (S.tab === 'fix' && (!fixOk() || S.recount)) S.tab = 'tr';
  const L = all(), see = A.see(), r = base(), pk = Number(r?.pack) || 0, own = A.isOwner();
  const fromL = L.filter(x => x.r && (!see || (Number(x.r.stock) || 0) > 0.0005 || x.b === S.from)), toL = L.filter(x => x.b !== S.from);
  const chip = (x, k, on) => `<button type="button" class="qtr-c${on ? ' is-in' : ''}" data-qtr-${k}="${x.b}"><i>${ic(x.b)}</i><b>${E(A.branchName(x.b))}</b>${see ? `<small>${E(x.r ? qtrFmt(x.r.stock, x.r) : '—')}</small>` : ''}</button>`;
  const head = `<div class="qtr-hd"><b>${S.tab === 'fix' ? '⚖️ Stock theek' : '⇄ Transfer'}${S.recount ? ' <em>⚖️ ginti ka farq</em>' : ''}</b><button type="button" class="qtr-x" data-qtr-x="1" aria-label="Band">✕</button></div>
  <div class="qtr-it"><b>${E(r?.name || '')}</b>${pk > 1 ? `<small>1 ${E(r.cName || 'ctn')} = ${A.num(pk)} ${E(r.uName || 'pcs')}</small>` : ''}</div>${tabsHTML()}`;
  const body = S.tab === 'fix' ? fixHTML() : `${S.why ? `<p class="qtr-why">${E(S.why)}</p>` : ''}
  <div class="qtr-sec"><small class="qtr-lb">Se — kahan se</small><div class="qtr-cs">${fromL.map(x => chip(x, 'f', x.b === S.from)).join('') || '<em class="qtr-none">Kahin stock nahi</em>'}</div></div>
  <div class="qtr-sec"><small class="qtr-lb">Ko — kahan</small><div class="qtr-cs">${toL.map(x => chip(x, 't', x.b === S.to)).join('')}</div></div>
  <div class="qtr-sec"><small class="qtr-lb">Tadad</small><div class="qtr-q">${pk > 1 ? `<label><input type="number" inputmode="decimal" step="any" min="0" data-qtr-q="ctn" value="${E(S.ctn)}" placeholder="0"><span>${E(r.cName || 'Ctn')}</span></label>` : ''}<label><input type="number" inputmode="decimal" step="any" min="0" data-qtr-q="pcs" value="${E(S.pcs)}" placeholder="0"><span>${E(r?.uName || 'Pcs')}</span></label>${see && stk(S.from) > 0.0005 ? `<button type="button" class="qtr-all" data-qtr-all="1">Sab · ${E(qtrFmt(stk(S.from), r))}</button>` : ''}</div></div>
  <div id="qtrAfter">${afterHTML()}</div>
  ${own ? '' : `<label class="qtr-pw"><span>🔒 Password <small>⛔ Band wala — malik se</small></span><input type="password" id="qtrPw" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="••••" value="${E(S.pw || '')}"></label>`}
  <input class="qtr-note" id="qtrNote" maxlength="100" placeholder="Note (ikhtiyari)" value="${E(S.note)}">
  <button type="button" class="qtr-go" data-qtr-go="1">⇄ Transfer note banao</button>`;
  d.innerHTML = head + body + `<p class="qtr-msg" id="qtrMsg" aria-live="polite"></p>` + histHTML();
}
// v2.116.0: POS ka stock badla (PC sync) — khuli khirki mein bhi taza; likhte waqt sirf numbers (focus / likha hua nahi toota)
export function qtrLive() {
  const d = $('qtrDlg'); if (!d?.open || !S || !A) return;
  const a = document.activeElement;
  if (a && d.contains(a) && a.matches?.('input')) {
    if (S.tab === 'fix') { const r = base(); for (const [k, b] of [['a', fixA()], ['b', S.gb]]) { const el = d.querySelector(`[data-qtf-pos="${k}"]`); if (el && b) el.textContent = 'POS ' + qtrFmt(stk(b), r); } const p = $('qtfPlan'); if (p) p.innerHTML = planHTML(planNow()); }
    else { const x = $('qtrAfter'); if (x) x.innerHTML = afterHTML(); }
    return;
  }
  const m = $('qtrMsg'), mt = m?.textContent || '', mc = m?.className || '';
  keep(); paint(); const m2 = $('qtrMsg'); if (m2 && mt) { m2.textContent = mt; m2.className = mc; }
}
const msg = (t, k = '') => { const m = $('qtrMsg'); if (m) { m.textContent = t; m.className = 'qtr-msg' + (k ? ' ' + k : ''); } };
const goBtn = on => { const b = $('qtrDlg')?.querySelector('[data-qtr-go],[data-qtf-go]'); if (b) b.disabled = !on; };
const keep = () => { if (!S) return; const n = $('qtrNote'); if (n) S.note = n.value; if ($('qtrPw')) S.pw = $('qtrPw').value; };   // chip badla = khirki dobara bani — likha hua (note / password) wahi
document.addEventListener('click', e => {
  const t = e.target.closest?.('#qtrDlg [data-qtr-x],#qtrDlg [data-qtr-f],#qtrDlg [data-qtr-t],#qtrDlg [data-qtr-all],#qtrDlg [data-qtr-go],#qtrDlg [data-qtr-tab],#qtrDlg [data-qtf-g],#qtrDlg [data-qtf-go],#qtrDlg [data-qth]'); if (!t || !S) return;
  const d = t.dataset;
  if (d.qtrX) { qtrClose(); return; }
  if (d.qth) { S.hd = Number(d.qth) || 3; const h = $('qtrDlg')?.querySelector('[data-qth-root]'); if (h) h.outerHTML = histHTML(); return; }   // 📜 sirf history dobara (likha hua wahi)
  if (busy) return;
  if (d.qtrTab) { keep(); S.tab = d.qtrTab === 'fix' && fixOk() ? 'fix' : 'tr'; paint(); setTimeout(() => { try { $('qtrDlg')?.querySelector(S.tab === 'fix' ? '[data-qtf-q]' : '[data-qtr-q]')?.focus({ preventScroll: true }); } catch {} }, 30); return; }
  if (d.qtfG) { keep(); S.gb = Number(d.qtfG); S.fb = { ctn: '', pcs: '', z: false }; paint(); return; }
  if (d.qtfGo) { keep(); fixGo(); return; }
  if (d.qtrF) { keep(); S.from = Number(d.qtrF); if (S.to === S.from) S.to = (all().find(x => x.b !== S.from) || {}).b || 0; paint(); return; }
  if (d.qtrT) { keep(); S.to = Number(d.qtrT); paint(); return; }
  if (d.qtrAll) { keep(); Object.assign(S, split(stk(S.from), base())); paint(); return; }
  if (d.qtrGo) { keep(); go(); }
});
document.addEventListener('change', e => {
  const z = e.target.closest?.('#qtrDlg [data-qtf-z]'); if (!z || !S || busy) return;
  const f = z.dataset.qtfZ === 'b' ? S.fb : S.fa; keep(); f.z = !!z.checked; if (f.z) { f.ctn = ''; f.pcs = ''; } paint();
  if (!f.z) setTimeout(() => { try { $('qtrDlg')?.querySelector(`[data-qtf-q="${z.dataset.qtfZ}:${base()?.pack > 1 ? 'ctn' : 'pcs'}"]`)?.focus({ preventScroll: true }); } catch {} }, 30);
});
document.addEventListener('input', e => {
  if (!S) return;
  const i = e.target.closest?.('#qtrDlg [data-qtr-q]'); if (i) { S[i.dataset.qtrQ] = i.value; const a = $('qtrAfter'); if (a) a.innerHTML = afterHTML(); return; }
  const q = e.target.closest?.('#qtrDlg [data-qtf-q]'); if (!q) return;
  const [k, u] = q.dataset.qtfQ.split(':'), f = k === 'b' ? S.fb : S.fa; f[u] = q.value; f.z = false;
  const p = $('qtfPlan'); if (p) p.innerHTML = planHTML(planNow());
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('#qtrDlg input') && S && !busy) { e.preventDefault(); keep(); if (S.tab === 'fix') fixGo(); else go(); } });
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
// ⚖️ ✓ Theek karo: TN (agar jagah badli) → bill (TN ke BAAD — PC post-farq afterTn dekhta hai). Ginti nahi chhuti.
async function fixGo() {
  const r = base(); if (!r) { msg('Item nahi mila', 'bad'); return; }
  const p = planNow(), nm = b => A.branchName(b);
  if (!p.any) { msg('⚠️ Asal stock likhein (ya ☐ 0 khali)', 'bad'); $('qtrDlg')?.querySelector('[data-qtf-q]')?.focus(); return; }
  if (!p.tn && !p.bills.length) { msg('✓ Barabar — kuch theek nahi karna', 'ok'); return; }
  const own = A.isOwner(), pw = own ? '' : String($('qtrPw')?.value || '').trim();
  if (p.tn && !own && !pw) { msg('🔒 Transfer ke liye password likhein (⛔ Band wala — malik se)', 'bad'); $('qtrPw')?.focus(); return; }
  if (p.bills.length && !own && !A.askCan?.()) { msg('⛔ Bill ke liye malik se manzoori ki ijazat nahi — malik se kahein', 'bad'); return; }
  const txt = [`⚖️ ${r.name}`, ...p.P.filter(x => x.on).map(x => `${nm(x.b)}: POS ${qtrFmt(x.pos, r)} → asal ${qtrFmt(x.phys, r)}`), '',
    ...(p.tn ? [`⇄ Transfer ${qtrFmt(p.tn.q, r)} ${nm(p.tn.from)} → ${nm(p.tn.to)} (sirf hisaab)`] : []),
    ...p.bills.map(x => `🧾 ${qtrFmt(x.q, r)} ${x.kind} — ${nm(x.b)} (stock fraq ${x.kind === 'kam' ? 'Sale' : 'Return'})${own ? '' : ' → malik ki manzoori'}`),
    ...p.P.filter(x => x.on && gintiOf(x.b)).map(x => `⚠️ ${nm(x.b)}: larkon ki ginti ka farq abhi bill nahi hua — dohra ho sakta hai`), '', 'Theek karein?'].join('\n');
  if (!confirm(txt)) return;
  busy = true; goBtn(false); msg('🖥 PC ko ja raha hai…', 'wait');
  const pk = Number(r.pack) || 0;
  let jid = '';
  if (p.tn) {
    const q = p.tn.q, c = pk > 1 ? Math.floor(q / pk + 1e-9) : 0, pc = r3(q - c * (pk > 1 ? pk : 0));
    const line = { itemId: String(r.id), name: r.name, qty: q, ctn: c, pcs: pc, pack: pk, cName: r.cName || 'Ctn', uName: r.uName || 'Pcs' };
    try { jid = await A.cloud.requestTransfer({ op: 'create', copies: A.copies(), from: p.tn.from, to: p.tn.to, lines: [line], note: QTR_HISAAB, byName: A.who(), ...(pw ? { pw } : {}) }); }
    catch (er) { busy = false; goBtn(true); const m = String(er?.code || '') + ' ' + String(er?.message || er); msg(pw && /permission|denied|insufficient/i.test(m) ? '❌ Password ghalat — kuch nahi bheja (bill bhi nahi)' : '⚠️ Transfer nahi gaya — bill bhi nahi bheja: ' + (er?.message || er), 'bad'); return; }
    track(jid, { id: S.id, from: p.tn.from, to: p.tn.to, q, name: r.name, recount: false, fN: nm(p.tn.from), tN: nm(p.tn.to), item: r });
  }
  let sent = 0;
  if (p.bills.length) {
    const jobs = p.bills.map(x => ({ branch: x.b, kind: x.kind, items: [{ id: String(r.id), name: String(r.name || ''), qty: x.q }], afterTn: jid || '', note: 'Stock theek' }));
    try {
      if (own) { for (const j of jobs) { const aid = await A.cloud.requestStockAdjust({ ...j, byName: A.who() }); watchAdj(aid, j, r); sent++; } }
      else {
        await A.ask({ kind: 'farq', title: `⚖️ Stock theek — ${r.name}`.slice(0, 300), rid: 'adj:' + r.id + ':' + Date.now().toString(36), reason: '',
          lines: [...p.P.filter(x => x.on).map(x => `${nm(x.b)}: POS ${qtrFmt(x.pos, r)} → asal ${qtrFmt(x.phys, r)}`), ...(p.tn ? [`⇄ TN ${qtrFmt(p.tn.q, r)} ${nm(p.tn.from)} → ${nm(p.tn.to)} (bheja — sirf hisaab)`] : []),
            ...p.bills.map(x => `🧾 ${qtrFmt(x.q, r)} ${x.kind} — ${nm(x.b)} · Rs ${x.kind === 'kam' ? '−' : '+'}${A.num(rsOf(x.q, p.P.find(y => y.b === x.b)?.it, r))}`)].slice(0, 12),
          jobs: JSON.stringify(jobs.map(j => ({ adj: 1, ...j }))) });
        sent = jobs.length;
      }
    } catch (er) { busy = false; goBtn(true); msg(`⚠️ Bill nahi gaya${p.tn ? ' (transfer chala gaya)' : ''}: ` + (er?.message || er), 'bad'); return; }
  }
  msg(`✓ Bhej diya — ${p.tn ? 'transfer note' : ''}${p.tn && sent ? ' + ' : ''}${sent ? (own ? 'bill' : 'bill malik ki manzoori ko') : ''} · PC bana kar batayega`, 'ok');
  S.fa = { ctn: '', pcs: '', z: false }; S.fb = { ctn: '', pcs: '', z: false };
  setTimeout(() => { if (qtrOpenNow() && S && busy) { busy = false; qtrClose(); } }, 1600);
}
function watchAdj(aid, j, r) {
  if (!aid || !A.cloud?.watchStockAdj) return;
  let stop = null, done = false; const end = t => { if (done) return; done = true; try { stop && stop(); } catch {} if (t) A.notice(t); try { A.after?.(); } catch {} };
  stop = A.cloud.watchStockAdj(aid, x => { if (!x) return; if (x.status === 'done') end(`✓ Stock theek bill ${[x.saleNo, x.returnNo].filter(Boolean).join(' / ')} — ${r.name} · ${A.branchName(j.branch)}`); else if (x.status === 'fail') end(`⚠️ Stock theek bill nahi bana (${r.name}): ${x.error || 'masla'}`); });
  setTimeout(() => end(''), 45 * 60000);
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
export const _qtrTest = { qtrFmt, split: (q, r) => split(q, r), qtrPlan };
