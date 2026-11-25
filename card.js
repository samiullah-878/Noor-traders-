// card.js v1.1 (app v2.382.0, 25 Nov 2026) — 💳 CARD (khate ka ⋮)
// v1.1 (malik 25 Nov: "dosra card jaise 4917 ka khata alehda banao — baqi khaton jaisa apna khata, khata ka naam card ka number · Alflah ka khata
//   alag hai, wo account hai, ya card — credit wala"): card = APNA ALAG KHATA (party.card 1 + ccd, Supplier qism, POS mein bhi — switch default ON).
//   ccNew = Naya account ka 💳 Card chip + khate ka ⋮ "Naya card khata". Kisi aam / bank khate par laga card (purana tareeqa) = ccSet mein patti
//   "Alag card khata banao" -> ccNew {from} -> naya khata + purane khate se ccd hata (entries wahi). ccSet ab sirf card wale khate ki setting.
// Malik: "khata ki setting mein credit card · three dot ke andar chips · card number last 4 digit · us ka bill ki date auto reminder ·
//   wo card ka paisa kis ko diya (payment transfer) · total card ki limit, jitna use karein utna minus" + "hum logon ka card bhi lete hain —
//   gahak ne saman liya, us ka card Waleed Bhai ki machine par lagaya, Waleed ka dena minus, baqi payment us bande ko cash" + "galle ke liye
//   tick ka checkbox" + "baqi chips jaisa hi".
// Data: party.ccd {l4 (SIRF aakhri 4 hindse — poora number kabhi nahi), lim (paisa), dd (bill ki aakhri tareekh 1-31), rem 1|0, nx (jis bill ke reminder ban chuke)}.
// Card se payment = WAHI commitAccountTransfer (card / gahak ka khata -> machine wale ka khata) + gahak ko cash wapas = 'payment' entry (galla tick);
//   counter gahak (khata nahi) = machine wale ke khate mein 'payment' (galla tick). Reminder = WAHI notes (phone push), pakki ID, ek dafa (nag 0). AI NAHI.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rsOf = v => { const n = Math.round(parseFloat(String(v ?? '').replace(/[, ]/g, '')) * 100); return Number.isFinite(n) && n > 0 ? n : 0; };
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dShow = d => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(d || '')); return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1] : ''; };
const dPlus = (d, n) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); };
const daysTo = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);
// agli bill tareekh (aaj ya aage) — 31 wala mahina chhota ho to us mahine ka aakhri din
export function nextDue(today, dd) {
  dd = Math.max(1, Math.min(31, Math.round(Number(dd) || 0))); const [y, m] = String(today).split('-').map(Number);
  const mk = (y, m) => y + '-' + pad(m) + '-' + pad(Math.min(dd, new Date(y, m, 0).getDate()));
  let D = mk(y, m); if (D < today) D = m === 12 ? mk(y + 1, 1) : mk(y, m + 1);
  return D;
}
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------- 💳 apne card ka khata: upar ki patli patti (2 line) ----------
export function ccHeroHTML(p, b, H, extra = '') {
  const c = p.ccd || {}, lim = Number(c.lim) || 0, used = Math.max(0, -b), left = lim - used, pct = lim ? Math.min(100, Math.round(used / lim * 100)) : 0;
  const tone = !lim ? '' : left < 0 ? 'bad' : pct >= 85 ? 'warn' : 'ok', t = H.today(), D = c.dd ? nextDue(t, c.dd) : '', dl = D ? daysTo(t, D) : null;
  return `<div class="cch ${tone}"><div class="cch1"><span class="cch-ic">💳</span><b class="cch-n">${esc(p.name)}</b>${c.l4 ? `<em class="cch-l4">••${esc(c.l4)}</em>` : ''}<strong class="cch-u" title="istemal (card ka dena)">${H.money(used)}</strong></div>
  ${lim ? `<i class="cch-bar"><u style="width:${pct}%"></u></i>` : ''}
  <div class="cch2">${lim ? `<span title="${pct}% istemal">Limit <b>${H.money(lim)}</b></span><span class="${left < 0 ? 'bad' : 'ok'}">${left < 0 ? 'Limit se zyada' : 'Baqi'} <b>${H.money(Math.abs(left))}</b></span>` : '<span>Limit nahi likhi · ⋮ → 💳 Card ki setting</span>'}${b > 0 ? `<span class="ok">Zyada jama <b>${H.money(b)}</b></span>` : ''}${D ? `<span class="cch-d${dl <= 3 ? ' due' : ''}">🔔 Bill ${esc(dShow(D))} · ${dl === 0 ? 'AAJ' : dl + ' din'}</span>` : ''}</div>${extra}</div>`;
}

// ---------- 🔔 bill ka reminder (phone par) — 3 din pehle + bill ke din, 10 baje, ek dafa ----------
const tBusy = new Set();
const nidOf = (pid, D, s) => ('cc-' + String(pid).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) + '-' + D.replace(/-/g, '') + s).slice(0, 80);
export async function ccTick(C, onlyId = '') {
  if (!C.owner() || !C.loaded() || !C.noteSave) return 0;
  const t = C.today(); let n = 0;
  for (const p of C.parties()) {
    if (onlyId && p.id !== onlyId) continue;
    const c = p.ccd; if (!c || !c.dd || c.rem === 0) continue;
    const D = nextDue(t, c.dd); if (c.nx === D || tBusy.has(p.id + D)) continue;
    tBusy.add(p.id + D);
    const tag = '💳 ' + p.name + (c.l4 ? ' ••••' + c.l4 : ''), pre = dPlus(D, -3);
    if (pre >= t) { try { await C.noteSave({ id: nidOf(p.id, D, 'a'), text: `${tag} — bill ki aakhri tareekh ${dShow(D)} (3 din baqi). Khata khol kar istemal dekh lein aur payment ka intezam karein.`, day: pre, time: '10:00', partyId: p.id, nag: 0 }); } catch (e) { console.warn('cc reminder', e); } }
    try { await C.noteSave({ id: nidOf(p.id, D, 'b'), text: `${tag} — AAJ bill ki aakhri tareekh (${dShow(D)}). Payment kar dein.`, day: D, time: '10:00', partyId: p.id, nag: 0 }); } catch (e) { console.warn('cc reminder', e); }
    try { const cur = C.party(p.id); if (cur?.ccd) { await C.save({ ...cur, ccd: { ...cur.ccd, nx: D } }, cur, true); n++; } } catch (e) { tBusy.delete(p.id + D); console.warn('cc nx', e); }
  }
  return n;
}
let booted = false;
export function ccBoot(C) {   // malik ki app: data aate hi + har 3 ghante (app khuli rahe to agle mahine ka reminder bhi khud)
  if (booted || !C.owner()) return; booted = true;
  let tries = 0; const go = () => { if (!C.owner()) return; if (!C.loaded()) { if (++tries < 20) setTimeout(go, 6000); return; } ccTick(C).catch(() => {}); };
  go(); setInterval(() => { tries = 0; go(); }, 3 * 3600e3);
}

// ---------- 💳 Card ki setting (sirf malik, sirf card wale khate par): aakhri 4 hindse · limit · bill ki tareekh · reminder ----------
export function ccSet(C, pid) {
  const p = C.party(pid); if (!p || !C.owner()) return;
  if (!p.ccd) return ccNew(C, {});   // v1.1: aam khate par card nahi lagta — naya card khata
  const c = p.ccd || {}, b = C.balance(p);
  C.modal('💳 Card ki setting — ' + p.name, `<form class="cc-f" id="ccSetF">
  ${p.card ? '' : `<div class="cc-mv"><span>⚠ Yeh card abhi <b>${esc(p.name)}</b> (aam / bank khata) par laga hai — is liye us khate par limit aur bill dikh raha hai. Card ka <b>apna alag khata</b> banayein; is khate ki entries wahi rahein gi.</span><button type="button" class="cc-save" data-ccmv="1">💳 Alag card khata banao</button></div>`}
  <p class="cc-tip">🔒 <b>Poora card number kabhi nahi</b> — sirf aakhri 4 hindse. Card se payment = ⋮ → 💳 Card se payment (limit khud kam).</p>
  <div class="cc-row2"><label>Aakhri 4 hindse<input name="l4" inputmode="numeric" autocomplete="off" value="${esc(c.l4 || '')}" placeholder="4917"></label>
  <label>Bill ki aakhri tareekh<input name="dd" type="number" inputmode="numeric" min="1" max="31" value="${esc(c.dd || '')}" placeholder="har mahine 1-31"></label></div>
  <label>Card ki poori limit (Rs)<input name="lim" type="number" inputmode="numeric" min="0" step="1" value="${c.lim ? Math.round(c.lim / 100) : ''}" placeholder="jaise 1500000"></label>
  <label class="cc-tick"><input type="checkbox" name="rem"${c.rem === 0 ? '' : ' checked'}><span>🔔 Bill ka reminder phone par — <b>3 din pehle</b> aur <b>bill ke din</b> (10 baje)</span></label>
  <div class="cc-pv" id="ccSetPv"></div><p class="cc-err" id="ccSetErr" hidden></p>
  <button type="submit" class="cc-save">✓ Save</button>${p.ccd ? '<button type="button" class="cc-off" data-ccoff="1">🗑 Card ki setting hatao (khata aur entries wahi rahein gi)</button>' : ''}
 </form>`);
  const f = document.getElementById('ccSetF'); if (!f) return;
  const pv = () => { const lim = rsOf(f.elements.lim.value), used = Math.max(0, -b), dd = Number(f.elements.dd.value) || 0;
    const el = document.getElementById('ccSetPv'); if (el) el.innerHTML = `Abhi istemal <b class="bad">${C.money(used)}</b>${lim ? ` · baqi limit <b class="${lim - used < 0 ? 'bad' : 'ok'}">${C.money(lim - used)}</b>` : ''}${dd >= 1 && dd <= 31 ? ` · agla bill <b>${esc(dShow(nextDue(C.today(), dd)))}</b>` : ''}`; };
  f.elements.l4.addEventListener('input', () => { const d = f.elements.l4.value.replace(/\D/g, ''); if (d.length > 4) { f.elements.l4.value = d.slice(-4); C.notice('🔒 Sirf aakhri 4 hindse rakhe — poora number save nahi hota'); } else if (d !== f.elements.l4.value) f.elements.l4.value = d; });
  f.addEventListener('input', pv); pv();
  f.querySelector('[data-ccmv]')?.addEventListener('click', () => ccNew(C, { from: pid }));
  f.querySelector('[data-ccoff]')?.addEventListener('click', async () => {
    if (!confirm(`"${p.name}" se card ki setting (limit / tareekh / reminder) hata dein?\nKhata aur entries wahi rahein gi.`)) return;
    try { const cur = C.party(pid); await C.save({ ...cur, ccd: null }, cur, true); C.close(); C.notice('💳 Card ki setting hat gayi'); C.render(); } catch (e) { C.notice('⚠️ ' + (e?.message || e)); }
  });
  f.onsubmit = async e => {
    e.preventDefault(); const er = document.getElementById('ccSetErr'), btn = f.querySelector('.cc-save');
    const l4 = f.elements.l4.value.replace(/\D/g, '').slice(-4), dd = Math.round(Number(f.elements.dd.value) || 0), lim = rsOf(f.elements.lim.value), rem = f.elements.rem.checked ? 1 : 0;
    const bad = m => { er.textContent = '✕ ' + m; er.hidden = false; };
    if (l4.length !== 4) return bad('Card ke aakhri 4 hindse likhein');
    if (!(dd >= 1 && dd <= 31)) return bad('Bill ki tareekh 1 se 31 tak likhein');
    if (!lim) return bad('Card ki limit likhein');
    btn.disabled = true; btn.textContent = '⏳ Save ho raha hai…'; er.hidden = true;
    try {
      const cur = C.party(pid); const old = cur.ccd || {};
      await C.save({ ...cur, ccd: { l4, lim, dd, rem, nx: old.dd === dd && old.rem !== 0 ? (old.nx || '') : '' } }, cur, true);
      C.close(); C.render(); C.notice('✅ 💳 Card ••••' + l4 + ' save — limit ' + C.money(lim) + (rem ? ' · bill ka reminder lag raha hai' : ''));
      if (rem) setTimeout(() => ccTick(C, pid).catch(() => {}), 600);
    } catch (e2) { btn.disabled = false; btn.textContent = '✓ Save'; bad(e2?.message || String(e2)); }
  };
}

// ---------- 💳 Naya card khata (sirf malik): apna alag khata, naam = bank + card ke aakhri 4 hindse ----------
const BANKS = ['Alfalah', 'HBL', 'Meezan', 'MCB', 'UBL', 'Bank Al Habib'];
const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function bankGuess(name) {
  const s = String(name || '').toLowerCase();
  return /alf|bafl/.test(s) ? 'Alfalah' : /\bhbl\b|habib bank/.test(s) ? 'HBL' : /meezan/.test(s) ? 'Meezan' : /\bmcb\b/.test(s) ? 'MCB' : /\bubl\b/.test(s) ? 'UBL' : /al habib/.test(s) ? 'Bank Al Habib' : '';
}
export const cardName = (bank, l4) => (String(bank || '').trim().replace(/\s+/g, ' ') + ' Card ' + String(l4 || '')).trim();
export function ccNew(C, opt = {}) {
  if (!C.owner()) return;
  const src = opt.from ? C.party(opt.from) : null, sc = src?.ccd || {};
  const S = { touched: false };
  C.modal('💳 Naya card khata', `<form class="cc-f" id="ccNewF">
  <p class="cc-tip">💳 Credit card ka <b>apna alag khata</b> — baqi khaton jaisa (entries · transfer · PDF · print). 🔒 Poora card number kabhi nahi, sirf aakhri 4 hindse.</p>
  <div class="cc-blk"><small class="cc-h">🏦 Kis bank ka card?</small><div class="cc-opts" id="ccBk">${BANKS.map(b => `<button type="button" class="cc-c" data-ccbk="${esc(b)}">${esc(b)}</button>`).join('')}</div>
  <input name="bank" maxlength="30" autocomplete="off" placeholder="ya bank ka naam likhein (ikhtiyari)" value="${esc(src ? bankGuess(src.name) : '')}"></div>
  <div class="cc-row2"><label>Aakhri 4 hindse<input name="l4" inputmode="numeric" autocomplete="off" value="${esc(sc.l4 || '')}" placeholder="4917"></label>
  <label>Bill ki aakhri tareekh<input name="dd" type="number" inputmode="numeric" min="1" max="31" value="${esc(sc.dd || '')}" placeholder="har mahine 1-31"></label></div>
  <div class="cc-row2"><label>Card ki poori limit (Rs)<input name="lim" type="number" inputmode="numeric" min="0" step="1" value="${sc.lim ? Math.round(sc.lim / 100) : ''}" placeholder="jaise 1500000"></label>
  <label>Abhi kitna istemal (Rs)<input name="used" type="number" inputmode="decimal" min="0" step="1" placeholder="0 = naya card"></label></div>
  <label>Khate ka naam <small>(khud banta hai — badal bhi sakte hain)</small><input name="nm" maxlength="80" autocomplete="off"></label>
  <label class="cc-tick"><input type="checkbox" name="rem"${sc.rem === 0 ? '' : ' checked'}><span>🔔 Bill ka reminder phone par — <b>3 din pehle</b> aur <b>bill ke din</b> (10 baje)</span></label>
  <label class="cc-tick"><input type="checkbox" name="pos" checked><span>🖥 <b>POS mein bhi</b> banayein <small>— card se supplier / machine wale ko di payment POS mein bhi jaye</small></span></label>
  <div class="cc-pv" id="ccNewPv"></div><p class="cc-err" id="ccNewErr" hidden></p>
  <button type="submit" class="cc-save">✓ Card khata banao</button>
 </form>`);
  const f = document.getElementById('ccNewF'); if (!f) return;
  const E = f.elements, l4Of = () => E.l4.value.replace(/\D/g, '').slice(-4);
  const mvOf = l4 => src || (l4.length === 4 ? C.parties().find(x => x.ccd && !x.card && x.ccd.l4 === l4) : null) || null;
  const dupOf = l4 => l4.length === 4 ? C.parties().find(x => x.card && x.ccd?.l4 === l4) || null : null;
  const chips = () => f.querySelectorAll('[data-ccbk]').forEach(b => b.classList.toggle('is-in', nk(b.dataset.ccbk) === nk(E.bank.value)));
  const autoNm = () => { if (!S.touched) E.nm.value = cardName(E.bank.value, l4Of()); };
  const pv = () => {
    const el = document.getElementById('ccNewPv'); if (!el) return;
    const l4 = l4Of(), lim = rsOf(E.lim.value), used = rsOf(E.used.value), dd = Number(E.dd.value) || 0, nm = String(E.nm.value || '').trim(), mv = mvOf(l4), dup = dupOf(l4), L = [];
    L.push(`💳 Naya khata <b>${esc(nm || 'Card ____')}</b> · Supplier qism · ${E.pos.checked ? 'POS mein bhi' : 'sirf app mein'}`);
    if (lim) L.push(`Limit <b>${C.money(lim)}</b> · istemal <b class="bad">${C.money(used)}</b> · baqi <b class="${lim - used < 0 ? 'bad' : 'ok'}">${C.money(lim - used)}</b>`);
    if (dd >= 1 && dd <= 31) L.push(`🔔 Agla bill <b>${esc(dShow(nextDue(C.today(), dd)))}</b>${E.rem.checked ? ' · reminder lagega' : ''}`);
    if (dup) L.push(`<b class="bad">⚠ ••${esc(l4)} ka card khata pehle se hai: ${esc(dup.name)}</b>`);
    else if (mv) L.push(`↪ Card ••${esc(mv.ccd?.l4 || l4)} <b>${esc(mv.name)}</b> se hat jayega — us khate ki entries aur baqaya wahi rahein ge`);
    el.innerHTML = '<small class="cc-h">Yeh banega:</small>' + L.map(x => `<div>${x}</div>`).join('');
  };
  f.addEventListener('click', e => { const b = e.target.closest('[data-ccbk]'); if (!b) return; E.bank.value = nk(E.bank.value) === nk(b.dataset.ccbk) ? '' : b.dataset.ccbk; chips(); autoNm(); pv(); });
  E.l4.addEventListener('input', () => { const d = E.l4.value.replace(/\D/g, ''); if (d.length > 4) { E.l4.value = d.slice(-4); C.notice('🔒 Sirf aakhri 4 hindse rakhe — poora number save nahi hota'); } else if (d !== E.l4.value) E.l4.value = d; });
  E.nm.addEventListener('input', () => { S.touched = !!String(E.nm.value || '').trim(); });
  f.addEventListener('input', e => { if (e.target.name === 'bank' || e.target.name === 'l4') { chips(); autoNm(); } pv(); });
  f.addEventListener('change', pv);
  chips(); autoNm(); pv();
  setTimeout(() => { try { (E.l4.value ? E.lim : E.l4).focus(); } catch {} }, 60);
  f.onsubmit = async e => {
    e.preventDefault(); const er = document.getElementById('ccNewErr'), btn = f.querySelector('.cc-save');
    const bad = m => { er.textContent = '✕ ' + m; er.hidden = false; };
    const l4 = l4Of(), dd = Math.round(Number(E.dd.value) || 0), lim = rsOf(E.lim.value), used = rsOf(E.used.value), rem = E.rem.checked ? 1 : 0, pos = !!E.pos.checked;
    const name = String(E.nm.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (l4.length !== 4) return bad('Card ke aakhri 4 hindse likhein');
    if (!(dd >= 1 && dd <= 31)) return bad('Bill ki tareekh 1 se 31 tak likhein');
    if (!lim) return bad('Card ki limit likhein');
    if (!name) return bad('Khate ka naam likhein');
    const dup = dupOf(l4); if (dup) return bad('••' + l4 + ' ka card khata pehle se hai: ' + dup.name);
    const same = [...C.parties(), ...(C.band ? C.band() : [])].find(x => nk(x.name) === nk(name));
    if (same) return bad('"' + same.name + '" naam ka khata pehle se hai' + (same.active === false ? ' (band)' : '') + ' — naam badlein');
    const mv = mvOf(l4), oc = mv?.ccd || {};
    btn.disabled = true; btn.textContent = '⏳ Ban raha hai…'; er.hidden = true;
    try {
      const id = crypto.randomUUID();
      await C.save({ id, type: 'party', name, phone: '', category: 'Supplier', dasti: false, card: 1, posSync: pos, opening: used ? -used : 0, asOf: C.today(),
        ccd: { l4, lim, dd, rem, nx: mv && oc.dd === dd && oc.rem !== 0 ? (oc.nx || '') : '' } });
      let mvMsg = '';
      if (mv) { try { const cur = C.party(mv.id); if (cur?.ccd) { await C.save({ ...cur, ccd: null }, cur, true); mvMsg = ' · "' + cur.name + '" se card hat gaya'; } } catch (e3) { mvMsg = ' · ⚠ "' + mv.name + '" se card nahi hata — us khate mein ⋮ → 💳 Card ki setting → 🗑'; } }
      C.close(); C.notice('✅ 💳 "' + name + '" khata ban gaya' + (pos ? ' — POS mein bhi (1–2 min)' : '') + mvMsg);
      setTimeout(() => { try { C.open ? C.open(id) : C.render(); } catch {} }, 250);
      if (rem) setTimeout(() => ccTick(C, id).catch(() => {}), 1500);
    } catch (e2) { btn.disabled = false; btn.textContent = '✓ Card khata banao'; bad(e2?.message || String(e2)); }
  };
}

// ---------- 🏧 Card se payment: gahak ka / apna card kisi ki machine par ----------
export function ccPay(C, pid) {
  const p = C.party(pid); if (!p) return;
  const lastMc = lsGet('sam-cc-mc', ''), S = { card: null, mc: null, q: { card: '', mc: '' }, open: { card: false, mc: false } };
  const okMc = id => !!id && !!C.party(id) && !C.party(id).ccd;
  if (p.ccd) { S.card = { id: p.id }; if (okMc(lastMc) && lastMc !== p.id) S.mc = lastMc; }
  else if (p.id === lastMc || p.category === 'Supplier') { S.mc = p.id; }
  else { S.card = { id: p.id }; if (okMc(lastMc) && lastMc !== p.id) S.mc = lastMc; }
  C.modal('💳 Card se payment', `<form class="cc-f" id="ccPayF">
  <div class="cc-blk"><small class="cc-h">💳 Card kis ka?</small><div id="ccPkCard"></div></div>
  <button type="button" class="cc-swap" data-ccswap="1" title="Ulta karein">⇅ Ulta</button>
  <div class="cc-blk"><small class="cc-h">🏧 Machine kis ki? <i>us ke khate se paisa minus</i></small><div id="ccPkMc"></div></div>
  <div class="cc-row2"><label>Card par kata (Rs)<input name="amt" type="number" inputmode="decimal" min="0" step="1" placeholder="jaise 50000"></label>
  <label id="ccCashL">Gahak ko cash wapas (Rs)<input name="cash" type="number" inputmode="decimal" min="0" step="1" placeholder="0 = nahi"></label></div>
  <label class="cc-tick" id="ccGallaL"><input type="checkbox" name="galla" checked><span>💰 <b>Galle (Daily Sale)</b> mein shamil <small id="ccGallaH"></small></span></label>
  <div class="cc-row2"><label>Tareekh<input name="date" type="date" value="${esc(C.today())}"${C.owner() ? '' : ' readonly'}></label><label>Note<input name="note" maxlength="200" autocomplete="off" placeholder="ikhtiyari"></label></div>
  <div class="cc-pv" id="ccPayPv"></div><p class="cc-err" id="ccPayErr" hidden></p>
  <button type="submit" class="cc-save">✓ Save</button>
 </form>`);
  const f = document.getElementById('ccPayF'); if (!f) return;
  const P = id => C.party(id), nm = x => x ? esc(x.name) : '';
  const isOwnCard = () => !!(S.card && S.card.id && P(S.card.id)?.ccd);
  const optHTML = side => {
    const other = side === 'card' ? S.mc : (S.card && S.card.id), q = S.q[side];
    let l = C.rank(q, 10, side === 'card' ? null : (x => x.category === 'Supplier')).filter(x => x.id !== other && !x.kharcha && !(side === 'mc' && x.ccd));
    if (side === 'card' && !q) { const own = C.parties().filter(x => x.ccd && x.id !== other && x.active !== false); l = [...own, ...l.filter(x => !x.ccd)]; }
    if (side === 'mc' && !q && okMc(lastMc) && lastMc !== other) l = [P(lastMc), ...l.filter(x => x.id !== lastMc)];
    const chips = l.slice(0, 9).map(x => `<button type="button" class="cc-c" data-ccpk="${side}|${esc(x.id)}">${x.ccd ? '💳' : x.category === 'Supplier' ? '🏭' : '👤'} ${nm(x)}${x.ccd?.l4 ? ' <i>••••' + esc(x.ccd.l4) + '</i>' : ''}</button>`).join('');
    return (side === 'card' ? '<button type="button" class="cc-c ctr" data-ccpk="card|@counter">🛒 Counter gahak <i>(khata nahi)</i></button>' : '') + (chips || '<small class="cc-no">Nahi mila — naam likhein</small>');
  };
  const pick = side => {
    const box = document.getElementById(side === 'card' ? 'ccPkCard' : 'ccPkMc'); if (!box) return;
    const sel = side === 'card' ? S.card : (S.mc ? { id: S.mc } : null);
    if (sel && !S.open[side]) {
      const x = sel.counter ? null : P(sel.id);
      box.innerHTML = sel.counter ? `<div class="cc-sel"><b>🛒 Counter</b><input name="cnm" maxlength="60" autocomplete="off" placeholder="gahak ka naam (ikhtiyari)" value="${esc(sel.nm || '')}"><button type="button" class="cc-mini" data-ccchg="card">✏️</button></div>`
        : `<div class="cc-sel"><b>${x?.ccd ? '💳' : side === 'mc' ? '🏧' : '👤'} ${nm(x)}</b>${x?.ccd?.l4 ? '<i>••••' + esc(x.ccd.l4) + '</i>' : ''}<small>${x ? esc(C.money(Math.abs(C.balance(x)))) + (C.balance(x) > 0 ? ' lene' : C.balance(x) < 0 ? ' dene' : ' · barabar') : ''}</small><button type="button" class="cc-mini" data-ccchg="${side}">✏️</button></div>`;
      return;
    }
    box.innerHTML = `<input type="search" class="cc-q" data-ccq="${side}" autocomplete="off" placeholder="🔍 ${side === 'card' ? 'gahak / card ka khata…' : 'machine wale ka khata…'}" value="${esc(S.q[side])}"><div class="cc-opts" id="ccOpt-${side}">${optHTML(side)}</div>`;
  };
  const vis = () => {
    const own = isOwnCard(), ctr = !!S.card?.counter, cash = rsOf(f.elements.cash.value);
    document.getElementById('ccCashL').hidden = own;
    const gl = document.getElementById('ccGallaL'), showG = !own && (ctr || cash > 0); gl.hidden = !showG;
    const h = document.getElementById('ccGallaH'); if (h) h.textContent = ctr ? '— card ka paisa galle mein nahi aaya (Akhrajat mein lagega)' : '— cash wapas galle se gaya';
  };
  const preview = () => {
    vis(); const el = document.getElementById('ccPayPv'); if (!el) return;
    const Y = rsOf(f.elements.amt.value), Cb = isOwnCard() || !(S.card) ? 0 : rsOf(f.elements.cash.value), g = !document.getElementById('ccGallaL').hidden && f.elements.galla.checked;
    const mc = S.mc ? P(S.mc) : null, cd = S.card && !S.card.counter ? P(S.card.id) : null;
    if (!S.card || !mc || !Y) { el.innerHTML = '<small>Card wala, machine wala aur raqam chunein — phir yahan dikhega kya banega</small>'; return; }
    const L = [], bal = x => C.balance(x), lab = n => C.money(Math.abs(n)) + (n > 0 ? ' lene' : n < 0 ? ' dene' : ' · barabar');
    L.push(`🏧 <b>${nm(mc)}</b>: dena <b class="ok">${C.money(Y)}</b> kam → ${esc(lab(bal(mc) + Y))}${S.card.counter ? (g ? ' · <em>Daily Akhrajat mein</em>' : ' · <em>Daily mein nahi</em>') : ''}`);
    if (cd?.ccd) { const lim = Number(cd.ccd.lim) || 0, used = Math.max(0, -(bal(cd) - Y)); L.push(`💳 <b>${nm(cd)}</b>: istemal <b class="bad">+${C.money(Y)}</b> → ${C.money(used)}${lim ? ` · baqi limit <b class="${lim - used < 0 ? 'bad' : 'ok'}">${C.money(lim - used)}</b>` : ''}`); }
    else if (cd) L.push(`👤 <b>${nm(cd)}</b>: wasooli <b class="ok">${C.money(Y)}</b> → ${esc(lab(bal(cd) - Y + Cb))}`);
    if (Cb > 0) L.push(S.card.counter ? `🛒 Gahak ko 💵 <b>${C.money(Cb)}</b> cash wapas <small>(sirf note — galle ka hisaab upar wali entry se)</small>` : `💵 <b>${nm(cd)}</b> ko cash wapas <b>${C.money(Cb)}</b>${g ? ' · <em>Daily Akhrajat mein</em>' : ' · <em>Daily mein nahi</em>'}`);
    if (Cb > Y) L.push('<b class="bad">⚠ Cash wapas card ki raqam se zyada hai</b>');
    el.innerHTML = '<small class="cc-h">Yeh banega:</small>' + L.map(x => `<div>${x}</div>`).join('');
  };
  const paint = () => { pick('card'); pick('mc'); preview(); };
  f.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ccpk) { const [side, id] = b.dataset.ccpk.split('|'); if (side === 'card') S.card = id === '@counter' ? { counter: true, nm: '' } : { id }; else S.mc = id; S.open[side] = false; S.q[side] = ''; paint(); if (side === 'card' && !S.mc) { S.open.mc = true; pick('mc'); } return; }
    if (b.dataset.ccchg) { const s = b.dataset.ccchg; S.open[s] = true; pick(s); preview(); setTimeout(() => document.querySelector(`[data-ccq="${s}"]`)?.focus(), 30); return; }
    if (b.dataset.ccswap) { if (S.card?.counter) { C.notice('Counter gahak ko machine wala nahi bana sakte'); return; } const a = S.card?.id || null, m = S.mc; S.card = m ? { id: m } : null; S.mc = a && okMc(a) ? a : null; S.open = { card: false, mc: false }; paint(); return; }
  });
  f.addEventListener('input', e => {
    const q = e.target.closest('[data-ccq]'); if (q) { const s = q.dataset.ccq; S.q[s] = q.value; const o = document.getElementById('ccOpt-' + s); if (o) o.innerHTML = optHTML(s); return; }
    if (e.target.name === 'cnm' && S.card?.counter) S.card.nm = e.target.value;
    preview();
  });
  f.addEventListener('change', preview);
  paint();
  setTimeout(() => { if (S.card && S.mc) f.elements.amt.focus(); }, 60);
  f.onsubmit = async e => {
    e.preventDefault(); const er = document.getElementById('ccPayErr'), btn = f.querySelector('.cc-save');
    const bad = m => { er.textContent = '✕ ' + m; er.hidden = false; };
    const Y = rsOf(f.elements.amt.value), own = isOwnCard(), Cb = own ? 0 : rsOf(f.elements.cash.value), date = f.elements.date.value || C.today(), nt = String(f.elements.note.value || '').trim().slice(0, 200);
    const g = !document.getElementById('ccGallaL').hidden && f.elements.galla.checked, mc = S.mc ? P(S.mc) : null;
    if (!S.card) return bad('💳 Card kis ka — chunein');
    if (!mc) return bad('🏧 Machine kis ki — chunein');
    if (!Y) return bad('Card par kitna kata — raqam likhein');
    if (S.card.id && S.card.id === mc.id) return bad('Card wala aur machine wala ek hi khata nahi ho sakta');
    if (Cb > Y && !confirm('Cash wapas (' + C.money(Cb) + ') card ki raqam (' + C.money(Y) + ') se zyada hai — phir bhi?')) return;
    btn.disabled = true; btn.textContent = '⏳ Save ho raha hai…'; er.hidden = true;
    try {
      if (S.card.counter) {
        const gn = String(S.card.nm || '').trim().slice(0, 60);
        await C.save({ type: 'entry', kind: 'payment', partyId: mc.id, amount: Y, date, note: `💳 Card se — ${gn || 'counter gahak'} ka card ${mc.name} ki machine par${Cb ? ' · gahak ko cash wapas ' + C.money(Cb) : ''}${nt ? ' · ' + nt : ''}`, dailyIncluded: g, posPending: false }, undefined, 'noask');
      } else {
        const cd = P(S.card.id); if (!cd) throw Error('Card wala khata nahi mila');
        const ok = await C.transfer({ id: crypto.randomUUID(), rev: 0, fromPartyId: cd.id, toPartyId: mc.id, amount: Y, date, note: `💳 Card${cd.ccd?.l4 ? ' ••••' + cd.ccd.l4 : ''} — ${cd.ccd ? 'apna card' : cd.name + ' ka card'} ${mc.name} ki machine par${nt ? ' · ' + nt : ''}`, posPending: false, posVoucher: '' });
        if (!ok) throw Error('Transfer save nahi hua — dobara koshish karein');
        if (Cb > 0) await C.save({ type: 'entry', kind: 'payment', partyId: cd.id, amount: Cb, date, note: `💵 Card ka baqi cash wapas (card ${C.money(Y)} · ${mc.name} ki machine)${nt ? ' · ' + nt : ''}`, dailyIncluded: g, posPending: false }, undefined, 'noask');
        if (!cd.ccd) { const rc = lsGet('sam-cc-rc', []).filter(x => x !== cd.id); rc.unshift(cd.id); lsSet('sam-cc-rc', rc.slice(0, 8)); }
      }
      lsSet('sam-cc-mc', mc.id);
      C.close(); C.render(); C.notice('✅ 💳 Card se payment save — ' + mc.name + ' ka dena ' + C.money(Y) + ' kam' + (Cb ? ' · cash wapas ' + C.money(Cb) : ''));
    } catch (e2) { btn.disabled = false; btn.textContent = '✓ Save'; bad(e2?.message || String(e2)); C.notice('❌ ' + (e2?.message || e2)); }
  };
}
export const _t = { nextDue, dPlus, dShow, nidOf, rsOf, bankGuess, cardName };
