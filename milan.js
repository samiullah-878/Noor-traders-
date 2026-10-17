// milan.js — v2.103.12: 🤖 SUPPLIER KA KHATA MILAO (malik: "pc wala khata ek supplier ka account hai — khata mein AI daalo jo ek PDF mein
//   entries ke saath farq wali entries bataye" · "kuch entries milti julti hoti hain, kuch paise ka farq" · "multiple photos ka option").
// AI SIRF PARHTA hai (supplier ke ledger ki photo / PDF -> lines). Milan aur hisaab yahi code karta hai. Kuch khud nahi badalta.
// Natija: ✅ mili (Rs 1 se kam = paise ka farq, mili hi) · ⚠️ raqam mein farq · 🔴 sirf unke khate mein · 🔵 sirf hamare · 🧮 balance.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let S = { ai: null, rows: () => [], party: () => null, modal: null, close: () => {}, notice: () => {}, pdf: null, shrink: null, balanceAt: null };
export function milanSetup(o) { S = { ...S, ...o }; }
const MAXF = 10, PAISE = 100;   // Rs 1 tak = paise ka farq (mili)
const rs = p => 'Rs ' + (Math.round(Number(p) || 0) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const p2 = n => String(n).padStart(2, '0');
const dnum = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; };
const short = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${+m[3]}/${+m[2]}` : (d || ''); };
let st = null;   // { pid, files: [{f, url, kind}], busy, msg, res, show }

export const MILAN_PROMPT = `Ye ek PARTY / SUPPLIER ka LEDGER (khata) hai — un ke computer software ki screen ki photo, ya PDF. Pakistan (Rs).
Tasveerein / pages TARTEEB se hain (page 1, 2, 3 …). Har page ki har entry line parho — sirf jo likha hai, andaza nahi.
JSON do: {"account":"jis ka khata (Account Head)","pages":[{"rows":[{"date":"YYYY-MM-DD","type":"CR / CP / SALES / BUY …","no":"voucher / bill no","desc":"tafseel","debit":0,"credit":0,"balance":0,"side":"DR ya CR"}]}],"closing":{"balance":0,"side":"DR ya CR"}}
Qaide: tareekh dd/mm/yyyy hoti hai (13/09/2026 = 2026-09-13). Raqam bina comma, number (1,455,000.00 = 1455000). Debit / Credit apne
khane (column) se — jis khane mein raqam ho wahi; khali = 0. "Grand Total" / jama wali line rows mein NAHI. Opening / B/F line ho to
type "OPENING". closing = aakhri line ka balance aur DR / CR. Ek hi line do pages par kat kar aaye to dono pages par wese hi likho.`;

export function milanOpen(pid) {
  if (!S.ai) { S.notice('AI tayyar nahi — app update karein'); return; }
  st = { pid, files: [], busy: false, msg: '', res: null, show: false };
  S.modal('🤖 Khata milao — ' + (S.party(pid)?.name || ''), '<div class="ml-root" id="mlRoot"></div>'); paint();
}
function paint() {
  const el = $('mlRoot'); if (!el || !st) return; const p = S.party(st.pid);
  if (st.res) { el.innerHTML = resultHTML(st.res, p); return; }
  el.innerHTML = `<p class="ml-say"><b>${esc(p?.name || '')}</b> ke apne khate (un ke computer ka ledger) ki <b>photo</b> ya <b>PDF</b> dein — app hamare khate se mila kar sirf <b>farq wali entries</b> batayegi.</p>
    <div class="ml-pick"><label class="ml-btn"><input type="file" accept="image/*" capture="environment" data-ml-cam hidden><span>📷</span>Camera${st.files.length ? ' — ➕ aur photo' : ''}</label>
      <label class="ml-btn"><input type="file" accept="image/*,application/pdf" multiple data-ml-gal hidden><span>🖼</span>Gallery / PDF<small>kai tick karein</small></label></div>
    ${st.files.length ? `<div class="ml-thumbs">${st.files.map((x, i) => `<div class="ml-th">${x.kind === 'pdf' ? `<span class="ml-pdf">📄<small>${esc(x.f.name.slice(0, 18))}</small></span>` : `<img src="${x.url}" alt="">`}<b>${i + 1}</b><button type="button" data-ml-del="${i}" aria-label="Hatao">✕</button></div>`).join('')}</div>` : '<p class="ml-hint">Supplier ke khate ke saare pages — ek ek photo lein ya gallery se ek saath chunein (10 tak).</p>'}
    ${st.msg ? `<p class="ml-msg${st.err ? ' bad' : ''}">${esc(st.msg)}</p>` : ''}
    <button type="button" class="ml-go" data-ml-go${st.files.length && !st.busy ? '' : ' disabled'}>${st.busy ? '⏳ AI parh raha hai…' : `🤖 Milao${st.files.length ? ' (' + st.files.length + ' page)' : ''}`}</button>
    <p class="ml-ai">🤖 AI sirf photo / PDF <b>parhta</b> hai — milan aur hisaab app khud karti hai. Hamara khata nahi badalta.</p>`;
}
function addFiles(list) {
  for (const f of list || []) { if (st.files.length >= MAXF) { S.notice('10 page tak'); break; }
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''); if (!pdf && !String(f.type || '').startsWith('image/')) continue;
    st.files.push({ f, kind: pdf ? 'pdf' : 'img', url: pdf ? '' : URL.createObjectURL(f) }); }
  st.msg = ''; st.err = false; paint();
}
const b64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { const u = String(r.result || ''); ok(u.slice(u.indexOf(',') + 1)); }; r.onerror = () => no(Error('File nahi parhi')); r.readAsDataURL(f); });
function parseJSON(t) { let s = String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim(); try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} } return null; }
const num = v => { const n = Number(String(v ?? '').replace(/[, ]/g, '')); return Number.isFinite(n) ? n : 0; };
const fixDate = d => { d = String(d || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(d); if (!m) return ''; const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${p2(m[2])}-${p2(m[1])}`; };
// AI ke pages -> unki lines (page ke kinare par dohri line ek)
export function theirRows(J) {
  const out = []; let prev = [];
  for (const pg of (J?.pages || (J?.rows ? [{ rows: J.rows }] : []))) {
    const rows = (pg?.rows || []).map(r => ({ date: fixDate(r.date), type: String(r.type || '').trim().slice(0, 12), no: String(r.no ?? '').trim().slice(0, 20), desc: String(r.desc || '').trim().slice(0, 80), dr: Math.round(num(r.debit) * 100), cr: Math.round(num(r.credit) * 100), bal: r.balance == null ? null : Math.round(num(r.balance) * 100), side: /cr/i.test(r.side || '') ? 'CR' : /dr/i.test(r.side || '') ? 'DR' : '' }))
      .filter(r => r.date && (r.dr || r.cr) && !/opening|b\/f|balance b/i.test(r.type + ' ' + r.desc));
    const key = r => [r.date, r.no, r.dr, r.cr].join('|'); let skip = 0;
    for (let k = Math.min(3, prev.length, rows.length); k > 0; k--) { if (prev.slice(-k).map(key).join('#') === rows.slice(0, k).map(key).join('#')) { skip = k; break; } }
    out.push(...rows.slice(skip)); prev = rows;
  }
  return out;
}
// 🔎 milan — ours: [{id, date, label, amt}] (amt paise: + = humne diye, − = humne liye) · theirs: [{date, dr, cr …}]
export function milanMatch(theirs, ours) {
  const run = flip => {   // flip false: unka DEBIT = hamara "liye" (unki sale / humne dena) · unka CREDIT = hamara "diye"
    const T = theirs.map((r, i) => ({ ...r, i, amt: r.dr ? (flip ? r.dr : -r.dr) : (flip ? -r.cr : r.cr), m: null }));
    const O = ours.map(o => ({ ...o, m: null })), ok = [], diff = [];
    const pass = (fit, rank) => { for (const t of T) { if (t.m) continue; let best = null, bs = Infinity;
      for (const o of O) { if (o.m || Math.sign(o.amt) !== Math.sign(t.amt)) continue; const dd = Math.abs(dnum(o.date) - dnum(t.date)), df = Math.abs(Math.abs(o.amt) - Math.abs(t.amt)); if (!fit(dd, df, Math.abs(t.amt))) continue; const sc = rank(dd, df); if (sc < bs) { bs = sc; best = o; } }
      if (best) { t.m = best; best.m = t; } } };
    pass((dd, df) => dd <= 5 && df < PAISE, (dd, df) => dd * 1e6 + df);                       // ✅ wahi raqam (paise tak)
    const n1 = T.filter(t => t.m).length;
    pass((dd, df, a) => dd <= 3 && df <= Math.max(200000, a * 0.02), (dd, df) => df + dd * 1e5);   // ⚠️ milti julti (2% / Rs 2,000 tak)
    for (const t of T) { if (!t.m) continue; const df = Math.abs(t.amt) - Math.abs(t.m.amt); (Math.abs(df) < PAISE ? ok : diff).push({ t, o: t.m, df }); }
    return { flip, n1, ok, diff, onlyT: T.filter(t => !t.m), onlyO: O.filter(o => !o.m), T };
  };
  const a = run(false), b = run(true); return b.n1 > a.n1 ? b : a;
}
async function go() {
  if (!st || st.busy || !st.files.length) return; st.busy = true; st.msg = 'AI parh raha hai… (20-60 second)'; st.err = false; paint();
  try {
    const parts = [];
    for (const x of st.files) parts.push(x.kind === 'pdf' ? { mime: 'application/pdf', data: await b64(x.f) } : await S.shrink(x.f, 2200, 0.88));
    const J = parseJSON(await S.ai(parts, MILAN_PROMPT)); const theirs = theirRows(J);
    if (!theirs.length) throw Error('AI ko khate ki koi line nazar nahi aayi — photo seedhi aur saaf le kar dobara koshish karein.');
    const ds = theirs.map(r => r.date).sort(), from = ds[0], to = ds[ds.length - 1], f0 = dnum(from), t0 = dnum(to);
    const ours = S.rows(st.pid).filter(o => { const d = dnum(o.date); return d >= f0 - 5 && d <= t0 + 5 && o.amt; });
    const M = milanMatch(theirs, ours);
    const upto = [to, ...M.ok.map(x => x.o.date), ...M.diff.map(x => x.o.date)].sort().pop();   // hamari mili hui aakhri tareekh tak (wo ±5 din baad bhi likhte hain)
    M.onlyO = M.onlyO.filter(o => o.date >= from && o.date <= upto);   // hamari baqi sirf unke arse ki
    const last = [...theirs].reverse().find(r => r.bal != null), cl = J?.closing && num(J.closing.balance) ? { bal: Math.round(num(J.closing.balance) * 100), side: /cr/i.test(J.closing.side || '') ? 'CR' : 'DR' } : last ? { bal: last.bal, side: last.side || 'DR' } : null;
    // unka balance hamari zuban mein (+ = hum ne lene, − = hum ne dene): flip false -> unka DR = hum ne dene
    const theirB = cl ? (cl.side === 'DR' ? -1 : 1) * Math.abs(cl.bal) * (M.flip ? -1 : 1) : null, ourB = S.balanceAt ? S.balanceAt(st.pid, upto) : null;
    st.res = { M, theirs, from, to, upto, theirB, ourB, account: String(J?.account || '').slice(0, 60), files: st.files.length }; st.busy = false; st.msg = ''; paint();
  } catch (e) { st.busy = false; st.err = true; st.msg = '⚠️ ' + (e?.message || e); paint(); }
}
const side = a => a > 0 ? 'Hum ne lene' : a < 0 ? 'Hum ne dene' : 'Barabar';
function sums(R) { const { M } = R, paise = M.ok.reduce((t, x) => t + x.df, 0), dSum = M.diff.reduce((t, x) => t + (Math.abs(x.o.amt) - Math.abs(x.t.amt)) * Math.sign(x.o.amt), 0);
  const tSum = M.onlyT.reduce((t, x) => t + x.amt, 0), oSum = M.onlyO.reduce((t, x) => t + x.amt, 0); return { paise, dSum, tSum, oSum, expl: oSum - tSum + dSum }; }
function resultHTML(R, p) {
  const { M } = R, s = sums(R), farq = R.theirB != null && R.ourB != null ? R.ourB - R.theirB : null;
  const tRow = t => `<div class="ml-r"><span><b>${esc(short(t.date))} · ${esc(t.type || '')} ${esc(t.no || '')}</b><small>${esc(t.desc || '')}</small></span><span class="ml-n">${rs(Math.abs(t.amt))}<small>${t.amt > 0 ? 'hamare diye jaisa' : 'hamare liye jaisa'}</small></span></div>`;
  const oRow = o => `<div class="ml-r"><span><b>${esc(short(o.date))} · ${esc(o.label || '')}</b><small>${esc(o.note || '')}</small></span><span class="ml-n">${rs(Math.abs(o.amt))}<small>${o.amt > 0 ? 'humne diye' : 'humne liye'}</small></span></div>`;
  return `<div class="ml-sum"><div><b>${M.ok.length}</b><small>✅ mili</small></div><div class="w"><b>${M.diff.length}</b><small>⚠️ farq</small></div><div class="r"><b>${M.onlyT.length}</b><small>🔴 sirf unke</small></div><div class="b"><b>${M.onlyO.length}</b><small>🔵 sirf hamare</small></div></div>
    <p class="ml-sub">${esc(short(R.from))} se ${esc(short(R.to))} ${esc(R.to.slice(0, 4))} · AI ne ${R.theirs.length} lines parhi (${R.files} page)${R.account ? ' · ' + esc(R.account) : ''} · <button type="button" class="ml-link" data-ml-show>${st.show ? '▴ chhupao' : '👁 AI ne kya parha'}</button></p>
    ${st.show ? `<div class="ml-list ml-read">${R.theirs.map(t => `<div class="ml-r"><span><b>${esc(short(t.date))} · ${esc(t.type)} ${esc(t.no)}</b><small>${esc(t.desc)}</small></span><span class="ml-n">${t.dr ? 'Dr ' + rs(t.dr) : 'Cr ' + rs(t.cr)}${t.bal != null ? `<small>bal ${rs(t.bal)} ${esc(t.side)}</small>` : ''}</span></div>`).join('')}</div>` : ''}
    ${R.theirB != null && R.ourB != null ? `<div class="ml-bal${Math.abs(farq) < PAISE ? ' same' : ''}"><div><small>Unka balance</small><b>${rs(Math.abs(R.theirB))}</b><small>${side(R.theirB)}</small></div><div><small>Hamara (${esc(short(R.upto || R.to))} tak)</small><b>${rs(Math.abs(R.ourB))}</b><small>${side(R.ourB)}</small></div><div><small>Farq</small><b>${Math.abs(farq) < PAISE ? '✓ barabar' : rs(Math.abs(farq))}</b><small>${Math.abs(farq) < PAISE ? '' : 'wajah neeche ki entries mein'}</small></div></div>` : ''}
    ${M.diff.length ? `<h4 class="ml-h w">⚠️ Raqam mein farq (${M.diff.length})</h4><div class="ml-list">${M.diff.map(x => `<div class="ml-r w ml-rw"><span><b>${esc(short(x.t.date))} · ${esc(x.t.type)} ${esc(x.t.no)}</b><small>hamara: ${esc(short(x.o.date))} · ${esc(x.o.label)}</small></span><div class="ml-3"><div><small>Unka</small><b>${rs(Math.abs(x.t.amt))}</b></div><div><small>Hamara</small><b>${rs(Math.abs(x.o.amt))}</b></div><div class="f"><small>Farq · ${x.df > 0 ? 'unka zyada' : 'hamara zyada'}</small><b>${rs(Math.abs(x.df))}</b></div></div></div>`).join('')}</div>` : ''}
    ${M.onlyT.length ? `<h4 class="ml-h r">🔴 Sirf unke khate mein (${M.onlyT.length}) — hamare mein nahi</h4><div class="ml-list">${M.onlyT.map(tRow).join('')}</div>` : ''}
    ${M.onlyO.length ? `<h4 class="ml-h b">🔵 Sirf hamare khate mein (${M.onlyO.length}) — unke mein nahi</h4><div class="ml-list">${M.onlyO.map(oRow).join('')}</div>` : ''}
    ${!M.diff.length && !M.onlyT.length && !M.onlyO.length ? '<p class="ml-ok">✅ Saari entries mil gayi — koi farq nahi.</p>' : ''}
    ${M.ok.length ? `<p class="ml-note">✅ ${M.ok.length} entries mil gayi${Math.abs(s.paise) >= 1 ? ` · paise ka farq kul ${rs(Math.abs(s.paise))} (mili hi gina)` : ''}.</p>` : ''}
    <div class="ml-acts"><button type="button" class="ml-go" data-ml-pdf>📄 PDF · WhatsApp</button><button type="button" class="ml-btn2" data-ml-again>🔄 Nayi photos</button></div>
    <p class="ml-ai">🤖 AI ne sirf photo parhi — milan app ka. Ghalat lage to "👁 AI ne kya parha" dekhein. Hamara khata nahi badla.</p>`;
}
function pdfHTML(R, p) {
  const { M } = R, s = sums(R), farq = R.theirB != null && R.ourB != null ? R.ourB - R.theirB : null;
  const tb = (h, rows) => rows.length ? `<table class="iv-tbl"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '';
  return `<h1>NOOR TRADERS</h1><h2>🤖 Khata milan — ${esc(p?.name || '')}</h2><p>${esc(short(R.from))} se ${esc(short(R.to))} ${esc(R.to.slice(0, 4))} · ${esc(new Date().toLocaleString('en-PK'))}</p>
    <p><b>✅ Mili: ${M.ok.length}</b> · ⚠️ Raqam farq: ${M.diff.length} · 🔴 Sirf unke: ${M.onlyT.length} · 🔵 Sirf hamare: ${M.onlyO.length}${Math.abs(s.paise) >= 1 ? ` · paise ka farq ${rs(Math.abs(s.paise))}` : ''}</p>
    ${farq != null ? `<p>Unka balance <b>${rs(Math.abs(R.theirB))} (${side(R.theirB)})</b> · Hamara <b>${rs(Math.abs(R.ourB))} (${side(R.ourB)})</b> · Farq <b>${Math.abs(farq) < PAISE ? 'barabar' : rs(Math.abs(farq))}</b></p>` : ''}
    ${M.diff.length ? '<h3>⚠️ Raqam mein farq</h3>' + tb(['Tareekh', 'Unki entry', 'Unki raqam', 'Hamari raqam', 'Farq'], M.diff.map(x => `<tr><td>${esc(short(x.t.date))}</td><td>${esc(x.t.type)} ${esc(x.t.no)} ${esc(x.t.desc)}</td><td>${rs(Math.abs(x.t.amt))}</td><td>${rs(Math.abs(x.o.amt))}</td><td>${rs(Math.abs(x.df))}</td></tr>`)) : ''}
    ${M.onlyT.length ? '<h3>🔴 Sirf unke khate mein (hamare mein nahi)</h3>' + tb(['Tareekh', 'Type / No', 'Tafseel', 'Raqam'], M.onlyT.map(t => `<tr><td>${esc(short(t.date))}</td><td>${esc(t.type)} ${esc(t.no)}</td><td>${esc(t.desc)}</td><td>${rs(Math.abs(t.amt))}</td></tr>`)) : ''}
    ${M.onlyO.length ? '<h3>🔵 Sirf hamare khate mein (unke mein nahi)</h3>' + tb(['Tareekh', 'Entry', 'Note', 'Raqam'], M.onlyO.map(o => `<tr><td>${esc(short(o.date))}</td><td>${esc(o.label)}</td><td>${esc(o.note || '')}</td><td>${rs(Math.abs(o.amt))}</td></tr>`)) : ''}
    ${!M.diff.length && !M.onlyT.length && !M.onlyO.length ? '<p>✅ Saari entries mil gayi — koi farq nahi.</p>' : ''}
    <p><small>Unke ledger ki photo / PDF AI ne parhi; milan Blue Khata ne kiya (Rs 1 se kam = paise ka farq, mili gina; tareekh ±5 din).</small></p>`;
}
document.addEventListener('change', e => { const t = e.target; if (!st || !t.closest?.('#mlRoot')) return; if (t.matches('[data-ml-cam],[data-ml-gal]')) { addFiles([...(t.files || [])]); t.value = ''; } });
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-milan],[data-ml-del],[data-ml-go],[data-ml-pdf],[data-ml-again],[data-ml-show]'); if (!t) return; const d = t.dataset;
  if (d.milan) { milanOpen(d.milan); return; } if (!st) return;
  if (d.mlDel != null) { const x = st.files.splice(Number(d.mlDel), 1)[0]; if (x?.url) URL.revokeObjectURL(x.url); paint(); return; }
  if (d.mlGo != null) { go(); return; }
  if (d.mlShow != null) { st.show = !st.show; paint(); return; }
  if (d.mlAgain != null) { st.res = null; st.files.forEach(x => x.url && URL.revokeObjectURL(x.url)); st.files = []; paint(); return; }
  if (d.mlPdf != null && st.res && S.pdf) { S.pdf(pdfHTML(st.res, S.party(st.pid)), 'Khata milan ' + (S.party(st.pid)?.name || '')); }
});
export const _mlTest = { theirRows, milanMatch, parseJSON, fixDate, sums, pdfHTML, resultHTML, set st(v) { st = v; }, get st() { return st; } };
