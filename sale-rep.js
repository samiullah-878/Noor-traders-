// sale-rep.js v1.0 (app v2.345.0) — 🧾 SALE KI POORI REPORT (Daily Sale ke "➕ Sale+Wasooli+Kal" chip par tap)
// malik (21 Nov 2026): "is ki poori report banao — itna bill, itna cancel, itna return, minus · poori screen · sale wale chip par click ·
//   poora bill with return aur without return — phir pata chale sahi kya hai"
// Data WAHI: posSales/<din> {bills[], sum} (PC pos-sales-dekho — nayi SQL nahi, PC ki koi file nahi badli). SIRF DIKHANA — Daily Sale ka hisaab is se nahi badalta.
// sum ki raqam RUPAY mein (sum.amt PAISA); Daily ki raqam PAISA. AI NAHI.
let C = null, DAY = '', DOC = undefined, stop = null;
const E = s => C.esc(String(s ?? ''));
const R = x => C.money(Math.round((Number(x) || 0) * 100));          // rupay -> 'Rs …'
const J = x => { try { const v = typeof x === 'string' ? JSON.parse(x) : x; return Array.isArray(v) ? v : []; } catch { return []; } };
const isFarq = n => /stock\s*['"]?\s*f[ae]?r?a?q/i.test(String(n || ''));   // PC pos-sales-dekho jaisa
const isWs = n => /whole\s*sale/i.test(String(n || ''));
const tm = t => t ? new Date(Number(t)).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : '';
const q3 = x => String(Math.round(Math.abs(Number(x) || 0) * 1000) / 1000);
const dayTxt = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

export function srSetup(ctx) { C = ctx; if (!srSetup.on) { srSetup.on = true; document.addEventListener('click', onClick); } }
export function srOpen(day) {
  DAY = String(day || C.today());
  let d = dlg(); if (!d) { d = document.createElement('dialog'); d.id = 'srDlg'; d.className = 'sr-dlg'; document.body.appendChild(d); d.addEventListener('close', () => { try { stop?.(); } catch {} stop = null; }); }
  DOC = undefined; try { stop?.(); } catch {}
  stop = C.cloud.listenPosDay(DAY, x => { DOC = x; paint(); });
  paint(); if (!d.open) d.showModal();
}
const dlg = () => document.getElementById('srDlg');

// ---- hisaab (sab RUPAY) ----
function calc() {
  const s = (DOC && DOC.sum) || null, bills = Array.isArray(DOC?.bills) ? DOC.bills : [];
  if (!s || s.g == null) return null;
  const live = bills.filter(b => !b.x && !isFarq(b.p)), cx = bills.filter(b => b.x), fq = bills.filter(b => !b.x && isFarq(b.p));
  const cashB = live.filter(b => !b.cr), udhB = live.filter(b => b.cr), wsB = live.filter(b => isWs(b.p));
  const rtd = J(s.rtd), mn = J(s.mn);
  const rtCash = rtd.filter(r => !(r.cr && !isWs(r.p))), rtUdh = rtd.filter(r => r.cr && !isWs(r.p));
  const rtUdhRs = rtUdh.reduce((n, r) => n + (Number(r.t) || 0), 0);
  const mnRs = mn.reduce((n, a) => n + Math.abs(Number(a[2]) || 0) * (Number(a[3]) || 0), 0);
  const g = Number(s.g) || 0, un = Number(s.un) || 0, rt = Number(s.rtRs) || 0;
  const noRet = g - un, withRet = g - un - rt;          // galle ki sale: wapsi ke baghair / ke saath
  const D = C.daily(DAY) || {}, p = x => (Number(x) || 0) / 100;   // Daily (paisa -> rupay)
  const dIn = p(D.sale) + p(D.collection) + p(D.opening), dOut = p(D.expense) + p(D.payment) + p(D.change);
  const autoOn = (Number(D.posAuto) || 0) > 0;   // Daily mein auto sale lagi hai (wapsi minus ke saath)
  return { s, bills, live, cx, fq, cashB, udhB, wsB, rtd, mn, rtCash, rtUdh, rtUdhRs, mnRs, g, un, rt, noRet, withRet, dIn, dOut, hona: dIn - dOut, honaNo: dIn - dOut + (autoOn ? rt : 0), autoOn,
    capped: bills.length >= 600, has: bills.length > 0 };
}
// wapsi ke badle ka bill — SIRF andaza (PC yeh rishta nahi jaanta)
function badla(r, k) {
  if (r.sid) return `🔗 bill #${E(r.sno || r.sid)} se juri${r.st ? ' (' + R(r.st) + ')' : ''}${r.sday && r.sday !== DAY ? ' · ' + E(r.sday) : ''}`;
  const nm = String(r.p || '').trim().toLowerCase();
  if (!k.has) return 'badle ka bill: pata nahi';
  if (nm && !/counter|cash|walk/i.test(nm)) { const l = k.live.filter(b => String(b.p || '').trim().toLowerCase() === nm); if (l.length) return `≈ andaza: isi gahak ke aaj ${l.length} bill (${R(l.reduce((n, b) => n + (Number(b.t) || 0), 0))})`; return '⚠ isi gahak ka aaj koi bill nahi'; }
  const near = k.live.filter(b => Math.abs((Number(b.t) || 0) - (Number(r.t) || 0)) <= Math.max(50, (Number(r.t) || 0) * 0.15));
  return near.length ? `≈ andaza: lag bhag isi raqam ke ${near.length} bill aaj bane` : 'badle ka bill: pata nahi (counter gahak)';
}

// ---- screen ----
const ln = (a, b, c) => `<div class="sr-ln ${c || ''}"><span>${a}</span><b>${b}</b></div>`;
const sec = (key, ic, title, right, body, open) => `<details class="sr-sec" data-sr-sec="${key}"${open ? ' open' : ''}><summary><span>${ic} ${title}</span><b>${right}</b><i>▾</i></summary><div class="sr-body">${body}</div></details>`;
const billRow = b => `<div class="sr-row${b.x ? ' x' : ''}"><span><b>#${E(b.no || b.id)}</b> ${E(b.p || '')}${b.cr ? ' <u>udhaar</u>' : ''}</span><small>${E(tm(b.tm))}${b.pc ? ' · 🖥 ' + E(b.pc) : ''}${b.by ? ' · ' + E(b.by) : ''}${b.n ? ' · ' + b.n + ' item' : ''}</small><em>${R(b.t)}</em></div>`;
const more = (l, n) => l.length > n ? `<small class="sr-more">… aur ${l.length - n} (PDF mein sab)</small>` : '';
function html() {
  const head = `<div class="sr-hd"><div><b>🧾 Sale ki report</b><small>${E(dayTxt(DAY))}${DAY === C.today() ? ' · Aaj' : ''}</small></div><span class="sr-hb"><button type="button" data-sr-pdf="1" title="PDF">📄 PDF</button><button type="button" data-sr-print="1" title="Dukan printer">🖨</button><button type="button" class="cl" data-sr-close="1" aria-label="Band">✕</button></span></div>`;
  if (DOC === undefined) return head + '<p class="sr-none">⏳ POS ka hisaab aa raha hai…</p>';
  if (DOC === null) return head + '<p class="sr-none">❌ POS ka data nahi parh sake (ijazat / internet).</p>';
  const k = calc();
  if (!k) return head + '<p class="sr-none">🖥 Is din ka POS hisaab nahi mila — shop PC us din chal raha tha? (aaj ka ho to 3–5 min intezar)</p>';
  const s = k.s, cnt = (l, n) => k.has ? l.length : n;
  const top = `<div class="sr-two"><div class="sr-card a"><small>↩ Return MINUS kar ke</small><b>${R(k.withRet)}</b><i>galle ki sale (app yehi leti hai)</i></div><div class="sr-card b"><small>Return ke BAGHAIR</small><b>${R(k.noRet)}</b><i>agar wapsi par paisa nahi gaya</i></div></div>
   <div class="sr-gal"><div class="sr-gh">⚖️ Galle mein hona chahiye <small>(Sale + Wasooli + Kal ka change − Kharcha − Aaj ka change)</small></div>
    ${ln('↩ Return minus kar ke', sgn(k.hona), k.hona < -1 ? 'bad' : 'ok')}${k.autoOn ? ln('Return ke baghair', sgn(k.honaNo), k.honaNo < -1 ? 'bad' : 'ok') : ''}
    <small>${k.hona < -1 ? '⚠ Minus = hisaab mein aaya paisa kam likha hai (galle se zyada nikalna mumkin nahi): ya koi wasooli / sale nahi likhi, ya kuch wapsi par asal mein paisa wapas nahi gaya.' : 'Yeh raqam galle mein Aaj ke change ke ILAWA honi chahiye (jo aap ne nikali / ghar le gaye).'}${k.autoOn ? '' : ' · Auto sale band hai — Daily mein haath ki sale lagi hai, is liye doosri line nahi.'}</small></div>`;
  const kul = ln('💵 Cash bills · ' + cnt(k.cashB, '—'), R(s.gc)) + ln('📒 Udhaar bills · ' + cnt(k.udhB, '—'), R(s.gu)) + (s.ws ? ln('📦 is mein Wholesale · ' + s.ws, R(s.wsRs), 'sub') : '') + ln('Kul (POS Sale report)', R(k.g), 'tot')
    + ln('− Udhaar jo cash nahi mila', '− ' + R(k.un)) + ln('= Wapsi se pehle', R(k.noRet), 'tot') + ln('− Sale Return (cash wapsi) · ' + (s.rt || 0), '− ' + R(k.rt)) + ln('= Galle ki sale', R(k.withRet), 'tot')
    + (k.has ? `<details class="sr-in"><summary>Sab bill dekhein (${k.live.length})</summary>${k.live.slice(0, 80).map(billRow).join('')}${more(k.live, 80)}</details>` : '');
  const cxB = k.has ? (k.cx.length ? k.cx.slice(0, 80).map(billRow).join('') + more(k.cx, 80) : '<p class="sr-none">Koi cancel bill nahi.</p>') : '<p class="sr-none">Is din ki bill list nahi mili (sirf ginti).</p>';
  const rtB = k.rtd.length ? `<small class="sr-note">Cash wapsi ${k.rtCash.length} (${R(k.rt)}) galle se MINUS · udhaar party ki ${k.rtUdh.length} (${R(k.rtUdhRs)}) minus NAHI (cash nahi gaya)${s.rtL != null ? ' · bill se juri ' + (s.rtL || 0) + ' · alag ' + (s.rtA || 0) : ''}</small>` + k.rtd.map(r => `<div class="sr-ret"><div class="sr-row"><span><b>↩ #${E(r.no)}</b> ${E(r.p || '')}${r.cr && !isWs(r.p) ? ' <u>udhaar — minus nahi</u>' : ''}</span><small>${E(badla(r, k))}</small><em>${R(r.t)}</em></div>${(r.it || []).map(a => `<div class="sr-it"><span>${E(a[0])}</span><b>${q3(a[1])} × ${R(a[2])}</b></div>`).join('')}${r.itn > (r.it || []).length ? `<small class="sr-more">… aur ${r.itn - r.it.length} item</small>` : ''}</div>`).join('') : `<p class="sr-none">${s.rok === false ? 'Wapsi ka data PC se nahi aaya.' : 'Koi wapsi nahi.'}</p>`;
  const byNo = new Map(); for (const a of k.mn) { const n = String(a[0]); if (!byNo.has(n)) byNo.set(n, []); byNo.get(n).push(a); }
  const mnB = k.mn.length ? `<small class="sr-note">Yeh minus bill ke TOTAL mein pehle se shamil hai (bill utna kam bana) — dobara minus nahi hota.</small>` + [...byNo].map(([no, l]) => `<div class="sr-ret"><div class="sr-row"><span><b>🧾 Bill #${E(no)}</b></span><small>${l.length} minus line</small><em>− ${R(l.reduce((n, a) => n + Math.abs(a[2]) * a[3], 0))}</em></div>${l.map(a => `<div class="sr-it"><span>${E(a[1])}</span><b>− ${q3(a[2])} × ${R(a[3])}</b></div>`).join('')}</div>`).join('') : `<p class="sr-none">${s.mn == null ? 'Minus items ki list PC se nahi aayi.' : 'Kisi bill mein minus item nahi.'}</p>`;
  return head + `<div class="sr-scroll">${top}
   ${sec('kul', '🧾', 'Kul bill · ' + (s.n || 0), R(k.g), kul, true)}
   ${sec('cx', '⛔', 'Cancel · ' + (s.cx || 0), R(s.cxRs), '<small class="sr-note">Cancel bill kisi hisaab mein shamil nahi.</small>' + cxB)}
   ${sec('rt', '↩', 'Return · ' + k.rtd.length, R(k.rt + k.rtUdhRs), rtB)}
   ${sec('mn', '➖', 'Bill ke andar minus · ' + k.mn.length, '− ' + R(k.mnRs), mnB)}
   ${s.fq ? sec('fq', '⚖️', 'Stock fraq ke bill · ' + s.fq, R(s.fqRs), '<small class="sr-note">Ginti ke farq wale bill — sale mein shamil nahi.</small>' + (k.has ? k.fq.slice(0, 60).map(billRow).join('') : '')) : ''}
   <p class="sr-ft">Sirf dikhane ke liye — Daily Sale ka hisaab is se nahi badalta. ${k.capped ? 'Bill list aakhri 600 bill tak hai (raqam poori). ' : ''}"≈ andaza" = app ka andaza, pakka nahi.</p></div>`;
}
const sgn = x => (x < -0.5 ? '− ' : '') + R(Math.abs(x));
function paint() { const d = dlg(); if (!d) return; const open = [...d.querySelectorAll('details[open][data-sr-sec]')].map(x => x.dataset.srSec), had = !!d.querySelector('.sr-scroll'), y = d.querySelector('.sr-scroll')?.scrollTop || 0; d.innerHTML = html(); if (had) { d.querySelectorAll('details[data-sr-sec]').forEach(x => { x.open = open.includes(x.dataset.srSec); }); const sc = d.querySelector('.sr-scroll'); if (sc) sc.scrollTop = y; } }

// ---- PDF (har table content ka SEEDHA bacha) + thermal ----
function pdfHTML(k) {
  const s = k.s, tr = (a, b) => `<tr><td>${a}</td><td style="text-align:right">${b}</td></tr>`, h = t => `<h2>${t}</h2>`;
  const bt = l => `<table><thead><tr><th>Bill</th><th>Gahak</th><th>Waqt</th><th>Counter</th><th style="text-align:right">Raqam</th></tr></thead><tbody>${l.map(b => `<tr><td>#${E(b.no || b.id)}</td><td>${E(b.p || '')}${b.cr ? ' (udhaar)' : ''}</td><td>${E(tm(b.tm))}</td><td>${E(b.pc || '')}</td><td style="text-align:right">${R(b.t)}</td></tr>`).join('')}</tbody></table>`;
  let o = `<h1>Sale ki report — ${E(dayTxt(DAY))}</h1>` + h('Khulasa') + `<table><tbody>${tr('Cash bills (' + (k.has ? k.cashB.length : '-') + ')', R(s.gc))}${tr('Udhaar bills (' + (k.has ? k.udhB.length : '-') + ')', R(s.gu))}${tr('<b>Kul bill ' + (s.n || 0) + ' (POS Sale report)</b>', '<b>' + R(k.g) + '</b>')}${tr('- Udhaar jo cash nahi mila', '- ' + R(k.un))}${tr('<b>Return ke BAGHAIR</b>', '<b>' + R(k.noRet) + '</b>')}${tr('- Sale Return, cash wapsi (' + (s.rt || 0) + ')', '- ' + R(k.rt))}${tr('<b>Return MINUS kar ke (galle ki sale)</b>', '<b>' + R(k.withRet) + '</b>')}${tr('Cancel bill (' + (s.cx || 0) + ') - shamil nahi', R(s.cxRs))}${tr('Udhaar party ki wapsi (' + k.rtUdh.length + ') - minus nahi', R(k.rtUdhRs))}${tr('Bill ke andar minus lines (' + k.mn.length + ') - bill mein pehle se', '- ' + R(k.mnRs))}${s.fq ? tr('Stock fraq ke bill (' + s.fq + ') - shamil nahi', R(s.fqRs)) : ''}${tr('Galle mein hona (return minus kar ke)', sgn(k.hona))}${k.autoOn ? tr('Galle mein hona (return ke baghair)', sgn(k.honaNo)) : ''}</tbody></table>`;
  if (k.rtd.length) o += h('Return (' + k.rtd.length + ')') + `<table><thead><tr><th>Wapsi</th><th>Gahak</th><th>Items</th><th>Badle ka bill</th><th style="text-align:right">Raqam</th></tr></thead><tbody>${k.rtd.map(r => `<tr><td>#${E(r.no)}</td><td>${E(r.p || '')}${r.cr && !isWs(r.p) ? ' (udhaar)' : ''}</td><td>${(r.it || []).map(a => E(a[0]) + ' ' + q3(a[1])).join(', ')}</td><td>${E(badla(r, k).replace(/[^\x20-\x7e]/g, '').trim())}</td><td style="text-align:right">${R(r.t)}</td></tr>`).join('')}</tbody></table>`;
  if (k.mn.length) o += h('Bill ke andar minus (' + k.mn.length + ')') + `<table><thead><tr><th>Bill</th><th>Item</th><th>Tadad</th><th style="text-align:right">Raqam</th></tr></thead><tbody>${k.mn.map(a => `<tr><td>#${E(a[0])}</td><td>${E(a[1])}</td><td>- ${q3(a[2])}</td><td style="text-align:right">- ${R(Math.abs(a[2]) * a[3])}</td></tr>`).join('')}</tbody></table>`;
  if (k.cx.length) o += h('Cancel bill (' + k.cx.length + ')') + bt(k.cx);
  if (k.live.length) o += h('Sab bill (' + k.live.length + ')') + bt(k.live);
  return o;
}
function slipText(k) {
  const s = k.s, n = x => 'Rs ' + Math.round(Number(x) || 0).toLocaleString('en-US'), L = (a, b) => a + ': ' + b;
  return ['*SALE REPORT ' + DAY + '*', '', L('Cash bills', n(s.gc)), L('Udhaar bills', n(s.gu)), '*' + L('Kul bill ' + (s.n || 0), n(k.g)) + '*', L('- Udhaar baqi', n(k.un)), '*' + L('Return ke BAGHAIR', n(k.noRet)) + '*', L('- Return cash ' + (s.rt || 0), n(k.rt)), '*' + L('Return MINUS (galla)', n(k.withRet)) + '*', '',
    L('Cancel ' + (s.cx || 0) + ' (shamil nahi)', n(s.cxRs)), L('Udhaar wapsi ' + k.rtUdh.length, n(k.rtUdhRs)), L('Bill mein minus ' + k.mn.length, n(k.mnRs)), '', L('Galle mein hona', (k.hona < 0 ? '- ' : '') + n(Math.abs(k.hona))), ...(k.autoOn ? [L('  return ke baghair', (k.honaNo < 0 ? '- ' : '') + n(Math.abs(k.honaNo)))] : []),
    ...(k.rtd.length ? ['', '*RETURN*', ...k.rtd.map(r => '#' + r.no + ' ' + String(r.p || '').slice(0, 16) + ' ' + n(r.t))] : [])].join('\n');
}
async function onClick(e) {
  const t = e.target.closest?.('[data-sr-open],[data-sr-close],[data-sr-pdf],[data-sr-print]'); if (!t || !C) return;
  const d = t.dataset;
  if (d.srOpen) { srOpen(C.day()); return; }
  if (d.srClose) { dlg()?.close(); return; }
  const k = DOC ? calc() : null; if (!k) { C.notice('Report abhi tayyar nahi'); return; }
  if (d.srPdf) { dlg()?.close(); C.pdf(pdfHTML(k), 'Sale report ' + DAY); return; }
  if (d.srPrint) {
    if (!confirm('Dukan ke thermal printer par Sale report chhapein?')) return;
    t.disabled = true; t.textContent = '⏳';
    try {
      const id = await C.cloud.requestKhataPrint({ j: JSON.stringify({ k: 'txt', t: 'SALE REPORT', x: slipText(k) }), name: 'Sale report ' + DAY, byName: C.name() });
      let done = false; const un = C.cloud.watchKhataPrint?.(id, x => { const st = x?.status; if (!st || st === 'new' || done) return; done = true; try { un?.(); } catch {} t.textContent = st === 'done' ? '✅' : '✕'; C.notice(st === 'done' ? '🖨 Report chhap gayi' : '✕ Nahi chhapi: ' + (x.err || st)); setTimeout(() => { t.disabled = false; t.textContent = '🖨'; }, 2500); });
      setTimeout(() => { if (done) return; done = true; try { un?.(); } catch {} t.disabled = false; t.textContent = '⚠️'; C.notice('⚠️ 45 s mein PC ka jawab nahi aaya — shop PC chal raha hai?'); }, 45000);
    } catch (er) { t.disabled = false; t.textContent = '🖨'; C.notice('❌ Print nahi gaya: ' + (er?.message || er)); }
  }
}
