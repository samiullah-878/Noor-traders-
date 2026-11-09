// delivery.js — 🚚 DELIVERY (v2.217.0, 2026-11-09) — gahak ki WhatsApp location → faasla → charges → malik ✅ OK → gahak + delivery boy
// Malik: "agar delivery chahiye to current location bhej dein · PC aana-jana km naape · 30 km = 1 litre = Rs 400 → gahak ko Rs 700 ·
//         pehle hum OK karenge · phir location delivery boy ko auto".
// PC wa-out v1.5 location parhta hai (sirf bill wale gahak ki, 24 ghante) → deliveryReq/<id> {to, nm, bn, lat, lng, km, rt, cost, chg, st 'new'}.
// Yahan malik / Full (CAP app.dlv) charges dekh kar ✅ OK {st 'ok', fin} → PC gahak ko charges + delivery boy ko location + Mubeen ko khabar.
// ⚙️ (sirf malik) = blueAccess/deliveryCfg {on, shop{lat,lng}, pet, kml, naf, min, max, gol, boy}. dlvCalc = PC wa-out ka HUBAHU (ek badlo to doosra).
// AI NAHI.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = n => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US');
const ph = p => /^03\d{9}$/.test(String(p || '')) ? p.slice(0, 4) + '-' + p.slice(4) : String(p || '');
const tm = t => { if (!t) return ''; const d = new Date(Number(t)); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
const DEF = { on: true, pet: 400, kml: 30, naf: 75, min: 100, max: 80, gol: 50 };
export function dlvCalc(c, km) {
  const rt = Math.round(km * 2 * 10) / 10, cost = Math.round(rt / c.kml * c.pet), raw = cost * (1 + c.naf / 100);
  return { rt, cost, chg: Math.max(c.min, Math.ceil(raw / c.gol - 1e-9) * c.gol), far: rt > c.max };
}
function cfgOf(d) {
  d = d || {}; const n = (k, lo, hi) => { const v = Number(d[k]); return Number.isFinite(v) && v >= lo && v <= hi ? v : DEF[k]; };
  const la = Number(d.shop && d.shop.lat), lo = Number(d.shop && d.shop.lng);
  return { on: d.on !== false, shop: Number.isFinite(la) && Number.isFinite(lo) && la && lo ? { lat: la, lng: lo } : null, pet: n('pet', 1, 5000), kml: n('kml', 1, 200), naf: n('naf', 0, 500), min: n('min', 0, 100000), max: n('max', 1, 2000), gol: n('gol', 1, 1000), boy: String(d.boy || '') };
}
export function parseLatLng(t) {   // "32.61, 73.95" · Google Maps link (@lat,lng / q=lat,lng / !3dlat!4dlng)
  const s = String(t || '');
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null; const lat = Number(m[1]), lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng) ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 } : null;
}

let cloud = null, notice = () => {}, isOwner = false, unsub = null, rows = [], view = 'list', cfg = cfgOf(null), cfgRaw = {}, busy = new Set();
function dlg() {
  let d = $('dlvDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'dlvDlg'; d.className = 'dlv-dlg'; document.body.append(d);
    d.addEventListener('close', () => { try { unsub && unsub(); } catch {} unsub = null; });
    d.addEventListener('click', onClick); d.addEventListener('input', onInput);
  }
  return d;
}
window.ntDlvClose = () => { const d = $('dlvDlg'); if (!d?.open) return false; if (view === 'cfg') { view = 'list'; paint(); return true; } d.close(); return true; };

export async function openDelivery(o) {
  cloud = o.cloud; notice = o.notice || notice; isOwner = !!o.owner; view = o.tab === 'cfg' && isOwner ? 'cfg' : 'list';
  const d = dlg(); if (!d.open) d.showModal();
  d.innerHTML = '<div class="dlv-body"><p class="dlv-muted">⏳</p></div>';
  try { cfgRaw = await cloud.getDlvCfg(); cfg = cfgOf(cfgRaw); } catch (e) { cfgRaw = {}; cfg = cfgOf(null); }
  try { unsub && unsub(); } catch {}
  unsub = cloud.listenDelivery(Date.now() - 3 * 86400000, (r, err) => { if (err) { rows = []; paint(err.message || String(err)); return; } rows = r || []; if (view === 'list') paint(); });
  paint();
}

function head() {
  return `<div class="dlv-head"><b>${view === 'cfg' ? '⚙️ Delivery setting' : '🚚 Delivery'}</b><span class="dlv-hx">${view === 'cfg' ? '<button type="button" class="dlv-chip" data-dlv-back="1">‹ List</button>' : isOwner ? '<button type="button" class="dlv-chip" data-dlv-cfg="1">⚙️ Setting</button>' : ''}<button type="button" class="dlv-x" data-dlv-x="1">×</button></span></div>`;
}
function paint(err) {
  const d = $('dlvDlg'); if (!d) return;
  if (view === 'cfg') { d.innerHTML = head() + cfgHTML(); preview(); return; }
  const L = rows.slice().sort((a, b) => ((a.st === 'new') !== (b.st === 'new') ? (a.st === 'new' ? -1 : 1) : (Number(b.upd || b.at) || 0) - (Number(a.upd || a.at) || 0)));
  const warn = !cfg.on ? '<p class="dlv-warn">⏸ Delivery BAND hai — gahak ko line nahi jati, location nahi parhi jati.' + (isOwner ? ' ⚙️ Setting se ON karein.' : '') + '</p>'
    : !cfg.shop ? '<p class="dlv-warn">📍 Dukan ki jagah set nahi — jab tak set na ho, bill ke paigham mein delivery ki line nahi jati.' + (isOwner ? ' ⚙️ Setting → "📍 Yahan dukan hai".' : '') + '</p>' : '';
  const nNew = L.filter(r => r.st === 'new').length;
  d.innerHTML = head() + `<div class="dlv-body">${warn}${err ? `<p class="dlv-warn">✕ ${esc(err)}</p>` : ''}<p class="dlv-muted">${nNew ? `⏳ ${nNew} naye — charges dekh kar ✅ OK karein` : 'Aakhri 3 din'} · petrol ${rs(cfg.pet)} · ${cfg.kml} km/litre · nafa ${cfg.naf}%</p>
    ${L.length ? L.map(cardHTML).join('') : '<p class="dlv-empty">Abhi koi darkhwast nahi. Gahak bill ke baad WhatsApp par location bheje to yahan aayegi.</p>'}</div>`;
}
function cardHTML(r) {
  const id = esc(r.id), map = `https://maps.google.com/?q=${Number(r.lat)},${Number(r.lng)}`;
  const st = r.st === 'new' ? (busy.has(r.id) ? '<span class="dlv-st w">⏳ bhej raha…</span>' : '<span class="dlv-st n">⏳ Naya</span>')
    : r.st === 'ok' ? (r.sent ? `<span class="dlv-st ok">✅ Bheja${r.boyOk ? ' · boy' : ''}</span>` : '<span class="dlv-st w">⏳ PC bhej raha</span>') : '<span class="dlv-st x">✕ Nahi</span>';
  const km = r.km == null ? '<span class="dlv-bad">⚠ Dukan ki jagah set nahi thi — faasla nahi naapa</span>'
    : `📏 ${r.km} km${r.how === 'line' ? ' <small>(andaza)</small>' : ''} · aana-jana ${r.rt} km · ⛽ ${rs(r.cost)}${r.far ? ' · <span class="dlv-bad">⚠ zyada door</span>' : ''}`;
  const act = r.st === 'new' && !busy.has(r.id)
    ? `<div class="dlv-act"><label class="dlv-in">Rs <input type="number" inputmode="numeric" min="0" step="50" data-dlv-fin="${id}" value="${Number(r.chg) || ''}" placeholder="charges"></label><button type="button" class="dlv-chip go" data-dlv-ok="${id}">✅ OK · bhejo</button><button type="button" class="dlv-chip no" data-dlv-no="${id}">✕</button><a class="dlv-chip" href="${map}" target="_blank" rel="noopener">🗺</a></div>`
    : `<div class="dlv-act"><span class="dlv-fin">${r.st === 'x' ? 'Delivery nahi' : 'Charges ' + rs(r.fin)}</span><a class="dlv-chip" href="${map}" target="_blank" rel="noopener">🗺 Map</a></div>`;
  return `<div class="dlv-card ${r.st === 'new' ? 'is-new' : ''}"><div class="dlv-l1"><b>${esc(r.nm || 'Gahak')}</b> <span>${esc(ph(r.to))}</span>${st}</div>
    <div class="dlv-l2">${r.bn ? 'Bill #' + esc(r.bn) + ' · ' : ''}🕒 ${esc(tm(r.upd || r.at))}${r.place ? ' · ' + esc(r.place) : ''}${r.live ? ' · 🔴 live' : ''}</div>
    <div class="dlv-l3">${km}</div>${act}</div>`;
}
function cfgHTML() {
  const c = cfg, f = (k, lbl, v, st) => `<label class="dlv-f"><span>${lbl}</span><input type="number" inputmode="decimal" data-dlv-k="${k}" value="${esc(v)}" step="${st || 1}"></label>`;
  return `<div class="dlv-body">
    <div class="dlv-row"><button type="button" class="dlv-chip ${c.on ? 'go' : ''}" data-dlv-on="1">${c.on ? '🟢 Delivery ON' : '⏸ Delivery BAND'}</button></div>
    <div class="dlv-sec"><b>📍 Dukan ki jagah</b><p class="dlv-muted" id="dlvShopTx">${c.shop ? `${c.shop.lat}, ${c.shop.lng} · <a href="https://maps.google.com/?q=${c.shop.lat},${c.shop.lng}" target="_blank" rel="noopener">🗺 dekhein</a>` : 'Abhi set nahi'}</p>
      <div class="dlv-row"><button type="button" class="dlv-chip go" data-dlv-here="1">📍 Yahan dukan hai</button><input id="dlvShopIn" placeholder="ya Google Maps link / 32.61, 73.95" autocomplete="off"></div>
      <p class="dlv-muted">Dukan ke andar khare ho kar dabayein (phone ki GPS), ya Google Maps se dukan ka link chipka dein.</p></div>
    <div class="dlv-sec"><b>⛽ Hisaab</b><div class="dlv-grid">${f('pet', 'Petrol Rs / litre', c.pet)}${f('kml', '1 litre mein km', c.kml)}${f('naf', 'Nafa %', c.naf)}${f('gol', 'Gol (qareeb)', c.gol, 10)}${f('min', 'Kam se kam Rs', c.min, 50)}${f('max', 'Zyada se zyada aana-jana km', c.max)}</div>
      <p class="dlv-prev" id="dlvPrev"></p></div>
    <div class="dlv-sec"><b>🛵 Delivery boy ka WhatsApp</b><input id="dlvBoy" inputmode="tel" placeholder="03xx-xxxxxxx" value="${esc(ph(c.boy))}" autocomplete="off"><p class="dlv-muted">✅ OK par isi number par gahak ki location + naam, number, charges jate hain.</p></div>
    <div class="dlv-row"><button type="button" class="dlv-chip go big" data-dlv-save="1">💾 Save</button><span id="dlvSaveSt" class="dlv-muted"></span></div>
    <p class="dlv-muted">AI nahi. Faasla sarak ke raaste se (OpenStreetMap, muft); na mile to seedhi lakeer × 1.3 (andaza likha aata hai).</p></div>`;
}
function readForm() {
  const d = $('dlvDlg'), o = { ...cfgRaw }; if (!d) return o;
  d.querySelectorAll('[data-dlv-k]').forEach(i => { const v = Number(i.value); if (Number.isFinite(v)) o[i.dataset.dlvK] = v; });
  const b = String($('dlvBoy')?.value || '').replace(/\D/g, ''); o.boy = b.startsWith('92') && b.length === 12 ? '0' + b.slice(2) : b;
  o.on = cfg.on; if (cfg.shop) o.shop = cfg.shop;
  return o;
}
function preview() {
  const e = $('dlvPrev'); if (!e) return; const c = cfgOf(readForm()), x = dlvCalc(c, 15);
  e.innerHTML = `Misal: 15 km door → aana-jana ${x.rt} km → petrol ${rs(x.cost)} → <b>charges ${rs(x.chg)}</b>`;
}
function onInput(ev) { if (ev.target.closest('[data-dlv-k]')) preview(); }
async function onClick(ev) {
  const t = ev.target, d = $('dlvDlg');
  if (t === d) return;
  if (t.closest('[data-dlv-x]')) { d.close(); return; }
  if (t.closest('[data-dlv-cfg]')) { view = 'cfg'; paint(); return; }
  if (t.closest('[data-dlv-back]')) { view = 'list'; paint(); return; }
  if (t.closest('[data-dlv-on]')) { cfg.on = !cfg.on; cfgRaw.on = cfg.on; const b = t.closest('[data-dlv-on]'); b.textContent = cfg.on ? '🟢 Delivery ON' : '⏸ Delivery BAND'; b.classList.toggle('go', cfg.on); return; }
  if (t.closest('[data-dlv-here]')) {
    const tx = $('dlvShopTx'); if (!navigator.geolocation) { tx.textContent = '✕ Is phone par GPS nahi — link chipka dein'; return; }
    tx.textContent = '⏳ GPS dekh raha… (ijazat dein)';
    navigator.geolocation.getCurrentPosition(p => { cfg.shop = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }; tx.innerHTML = `✅ ${cfg.shop.lat}, ${cfg.shop.lng} (±${Math.round(p.coords.accuracy)} m) — 💾 Save dabayein`; },
      e => { tx.textContent = '✕ GPS nahi mila (' + (e.message || e.code) + ') — link chipka dein'; }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    return;
  }
  if (t.closest('[data-dlv-save]')) {
    const st = $('dlvSaveSt'), inS = String($('dlvShopIn')?.value || '').trim();
    if (inS) { const p = parseLatLng(inS); if (!p) { st.textContent = '✕ Link / jagah samajh nahi aayi — "32.61, 73.95" jaisa likhein'; return; } cfg.shop = p; }
    const o = readForm(); if (o.boy && !/^03\d{9}$/.test(o.boy)) { st.textContent = '✕ Delivery boy ka number ghalat (03xx-xxxxxxx)'; return; }
    st.textContent = '⏳';
    try { await cloud.saveDlvCfg(o); cfgRaw = o; cfg = cfgOf(o); st.textContent = '✅ Save — PC 1 min mein naya hisaab lagayega'; const tx = $('dlvShopTx'); if (tx && cfg.shop) tx.innerHTML = `${cfg.shop.lat}, ${cfg.shop.lng} · <a href="https://maps.google.com/?q=${cfg.shop.lat},${cfg.shop.lng}" target="_blank" rel="noopener">🗺 dekhein</a>`; if ($('dlvShopIn')) $('dlvShopIn').value = ''; }
    catch (e) { st.textContent = '✕ ' + (e?.message || e); }
    return;
  }
  const ok = t.closest('[data-dlv-ok]'), no = t.closest('[data-dlv-no]');
  if (ok || no) {
    const id = (ok || no).dataset[ok ? 'dlvOk' : 'dlvNo'], r = rows.find(x => x.id === id); if (!r || busy.has(id)) return;
    const inp = d.querySelector(`[data-dlv-fin="${CSS.escape(id)}"]`), fin = Math.round(Number(inp?.value) || 0);
    if (ok && fin <= 0) { notice('Charges likhein'); inp?.focus(); return; }
    if (no && !(no.dataset.sure)) { no.dataset.sure = '1'; no.textContent = '✕ Pakka nahi?'; return; }
    busy.add(id); paint();
    try { await cloud.dlvDecide(id, ok ? 'ok' : 'x', ok ? fin : 0); notice(ok ? `✅ OK — gahak ko ${rs(fin)} + delivery boy ko location ja rahi` : 'Delivery nahi'); }
    catch (e) { notice('✕ ' + (e?.message || e)); }
    finally { busy.delete(id); paint(); }
  }
}
