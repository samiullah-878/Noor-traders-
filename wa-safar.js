// 🩺 PARCHI KA SAFAR (v2.233.0) — malik: "screen mein poora system banao ta ke problem ko trace kiya ja sake · maine parchi bheji wo app mein nazar aaye ·
//   aage Mubeen ne kya kiya · auto reply nahi aaya to kaise dekhein kya issue aaya". EK screen: upar kaun zinda hai (PC ke 3 WhatsApp rabte + A4),
//   neeche har Printauto parchi ke qadam (mila · gahak · paigham · start · bill · yaad-dihani) aur PC ne har "print" paigham ka kya samjha (aakhri 40).
//   Data pehle se: blueAccess waLink / waLink2 / waLinkOut / a4Pc / parchiTrack (+ dl, PC wa-parchi v2.18) / waOutLog. Sirf malik. AI nahi. Naya rule nahi.
let C = null, D = {}, stops = [];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tms = v => !v ? 0 : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : v.seconds ? v.seconds * 1000 : Number(v) || 0;
const ago = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? 'abhi' : s < 3600 ? Math.round(s / 60) + ' min pehle' : s < 86400 ? Math.round(s / 3600) + ' ghante pehle' : Math.round(s / 86400) + ' din pehle'; };
const tm = t => { if (!t) return ''; const d = new Date(t); return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' }); };
const ph = p => String(p || '').replace(/^(\d{4})(\d+)$/, '$1-$2');
export function sfSetup(c) { C = c; document.addEventListener('click', e => { if (e.target.closest?.('[data-sf-ref]')) paint(); }); }
function unlisten() { for (const f of stops) { try { f?.(); } catch {} } stops = []; }
const alive = () => !!document.querySelector('#dialogBody [data-sf-root]');
export function sfOpen() {
  if (!C?.owner()) { C?.notice('Sirf malik'); return; }
  unlisten(); D = {};
  C.modal('🩺 Parchi ka safar', `<div class="sf" data-sf-root="1">${html()}</div>`, true);
  const cl = C.cloud, on = (fn, k) => { if (!cl?.[fn]) return; try { stops.push(cl[fn]((d, e) => { if (!alive()) return; D[k] = e ? { _err: 1 } : (d || {}); paint(); })); } catch {} };
  on('listenWaLink', 'w1'); on('listenWaLink2', 'w2'); on('listenWaLinkOut', 'wo'); on('listenA4Pc', 'a4'); on('listenParchiTrack', 'pt'); on('listenWaOutLog', 'lg');
  try { $('dialog')?.addEventListener('close', unlisten, { once: true }); } catch {}
}
function paint() { const r = document.querySelector('#dialogBody [data-sf-root]'); if (!r) return; const y = r.closest('dialog')?.scrollTop; r.innerHTML = html(); }
function chip(ic, nm, d, link) {
  if (d === undefined) return `<div class="sf-c w"><b>${ic} ${nm}</b><small>⏳ parh rahe…</small></div>`;
  if (d._err) return `<div class="sf-c bad"><b>${ic} ${nm}</b><small>🔐 ijazat nahi</small></div>`;
  const at = tms(d.at), old = !at || Date.now() - at > 8 * 60000, s = String(d.st || '');
  let cl = 'ok', t = '🟢 chal raha';
  if (!at) { cl = 'w'; t = '⚪ PC ne kabhi jawab nahi diya'; }
  else if (old) { cl = 'bad'; t = '🔴 PC chup — ' + ago(at); }
  else if (link) { if (s === 'open') t = '🟢 juda' + (d.me ? ' · ' + esc(ph(d.me)) : ''); else if (d.out) { cl = 'w'; t = '⚪ aap ne unlink kiya'; } else { cl = 'bad'; t = (s === 'qr' ? '🟡 QR scan baqi' : s === 'code' ? '🟡 code likhna baqi' : '🔴 juda NAHI') + (d.err ? ' · ' + esc(String(d.err).slice(0, 60)) : ''); } }
  else if (d.err) { cl = 'bad'; t = '🔴 ' + esc(String(d.err).slice(0, 70)); }
  return `<div class="sf-c ${cl}"><b>${ic} ${nm}</b><small>${t}${at && !old ? ' · ' + ago(at) : ''}</small></div>`;
}
function steps(x, LG) {
  const f = tms(x.fwdAt), mn = b => Math.max(0, Math.round((tms(b) - f) / 60000)), row = (c, i, t) => `<div class="sf-s ${c}"><i>${i}</i><span>${t}</span></div>`;
  const who = (x.nm ? esc(x.nm) + ' ' : '') + (x.from ? esc(ph(x.from)) : '');
  const mine = LG.filter(r => { const e = String(r.eid || r.id || ''); if (e) return e.includes(x.id) || e.includes(x.grp || '~'); const a = tms(r.at); return a >= f - 60000 && a <= f + 4 * 3600000 && (r.to === x.from || r.to === x.to); });
  const out = [];
  out.push(row('ok', '📥', `PC ko parchi mili · ${tm(f)} · ${x.k === 'txt' ? 'likhi hui' : 'tasveer'}${x.by ? ' · ' + esc(x.by) + ' ne bheji' : ''}`));
  out.push(who ? row('ok', '👤', 'Gahak: ' + who) : row('bad', '👤', 'Gahak ka number NAHI mila — is liye gahak ko koi paigham nahi jayega. Caption mein likhein: <b>Printauto 0300-1234567</b>'));
  if (mine.length) for (const r of mine) out.push(row(r.st === 'sent' ? 'ok' : r.st === 'skip' ? 'w' : 'bad', '📤', `${esc(r.nm || '')} ${esc(ph(r.to || ''))} — ${r.st === 'sent' ? 'paigham gaya ✅' : r.st === 'skip' ? 'chhor diya' : 'NAHI gaya ✕'}${r.why ? ' · ' + esc(r.why) : ''} · ${tm(tms(r.at))}`));
  else out.push(row('w', '📤', 'Is parchi ka koi paigham bheje hue mein nahi mila (📤 Naya number upar dekhein)'));
  out.push(x.startAt ? row('ok', '▶️', `Mubeen ne "start" likha · ${mn(x.startAt)} min baad`) : row(x.st === 'done' ? 'w' : x.rem ? 'bad' : 'w', '▶️', x.st === 'done' ? 'Start nahi likha (seedha bill)' : `Mubeen ne abhi "start" NAHI likha · ${mn(Date.now())} min ho gaye`));
  if (x.rem || x.voc || x.callSt) out.push(row('w', '🔔', `Yaad-dihani${x.rem ? ' ×' + x.rem : ''}${x.voc ? ' · 🔊 awaz' : ''}${x.callSt ? ' · 📞 ' + ({ ans: 'call uthai', noans: 'call nahi uthai', ring: 'call ja rahi', dial: 'call ja rahi', off: 'phone set nahi', err: 'call ✕' }[x.callSt] || esc(x.callSt)) : ''}${x.mal ? ' · malik ko bataya' : ''}`));
  out.push(x.st === 'done' ? (x.sent ? row('ok', '🧾', `Bill gahak ko gaya ✅${x.bn ? ' · #' + esc(x.bn) : ''} · ${mn(x.doneAt)} min`) : row('bad', '🧾', 'Bill bana magar gahak ko NAHI gaya · ' + esc(x.err || 'wajah nahi'))) : row('w', '🧾', 'Bill abhi nahi (Mubeen usi parchi par bill ki tasveer reply kare)'));
  if (x.err && x.st !== 'done') out.push(row('bad', '⚠️', esc(x.err)));
  return out.join('');
}
function html() {
  const pt = D.pt, L = Array.isArray(pt?.L) ? pt.L : [], LG = Array.isArray(D.lg?.L) ? D.lg.L : [];
  let dl = []; try { dl = JSON.parse(pt?.dl || '[]'); } catch {} if (!dl.length && pt?.dbg?.t) dl = [pt.dbg];
  dl = dl.slice().sort((a, b) => tms(b.at) - tms(a.at));
  const pr = [['Aap ka WhatsApp', D.w1?.pr], ['Mubeen ka WhatsApp', D.w2?.pr]].filter(x => x[1]?.t);
  const last = dl[0] ? tms(dl[0].at) : 0;
  const hint = !pt ? '' : !pt.at ? '<p class="sf-warn">⚠️ PC ne parchi ka haal abhi nahi bheja (PC update 3–5 min, ya PC band).</p>'
    : !last || Date.now() - last > 20 * 60000 ? '<p class="sf-warn">ℹ️ PC ko pichhle 20 min mein koi <b>Print / Print auto</b> paigham NAHI mila. Abhi bheja tha aur yahan nahi aaya = paigham PC tak pohancha hi nahi → upar jo rabta 🔴 / ⚪ hai wahi wajah hai (aap ka WhatsApp unlink ho to PC sirf Mubeen ke phone se sunta hai — Mubeen ka net / phone band = ek tick = PC ko bhi nahi milta).</p>' : '';
  return `<div class="sf-top">${chip('📱', 'Aap ka WhatsApp', D.w1, 1)}${chip('📱', 'Mubeen ka WhatsApp', D.w2, 1)}${chip('📤', 'Naya number (gahak ko)', D.wo, 1)}${chip('🖨', 'A4 printer PC', D.a4, 0)}</div>
  <button type="button" class="sf-ref" data-sf-ref="1">🔄 Taza</button>${hint}
  <h4>🩺 PC ne kya dekha (naya upar)</h4>
  ${dl.length ? `<div class="sf-dl">${dl.slice(0, 40).map(x => `<div><em>${tm(tms(x.at))}</em><span>${esc(x.t)}</span></div>`).join('')}</div>` : '<small class="sf-mut">Abhi kuch nahi.</small>'}
  ${pr.length ? `<h4>🖨 Aakhri print</h4><div class="sf-dl">${pr.map(([n, p]) => `<div><em>${tm(tms(p.at))}</em><span><b>${n}:</b> ${esc(p.t)}</span></div>`).join('')}</div>` : ''}
  <h4>📋 Printauto parchiyan (${L.length})</h4>
  ${L.length ? L.map(x => `<div class="sf-card"><div class="sf-h"><b>${(x.nm ? esc(x.nm) + ' ' : '') + (x.from ? esc(ph(x.from)) : 'gahak ?')}</b><em>${tm(tms(x.fwdAt))} · ${ago(tms(x.fwdAt))}</em></div>${steps(x, LG)}</div>`).join('') : '<small class="sf-mut">Abhi koi Printauto parchi list mein nahi.</small>'}
  <small class="sf-mut">Sirf <b>Print</b> = sirf A4 (list mein nahi). <b>Print auto</b> = A4 + gahak / Mubeen ko paigham + yaad-dihani. AI nahi.</small>`;
}
