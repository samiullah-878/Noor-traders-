// kamra.js — v2.166.0 (1 Nov 2026): 🏬 DUKAN KA KAMRA — "door se nazara" (website)
//   Malik: "puri site ek chhoti screen jaisi lagti hai — design aisa ho jaise shop mein rack laga ho, door se nazar aaye ·
//          daalon wala hissa ek deewar ke saath, doosri deewar ke saath baqi items ke racks · customer jis rack ke paas jaye, wo rack wese dikh jaye".
//   Kamra = CSS 3D gali: baayein deewar 🌾 khula maal (dabbe + tore) · daayein deewar baqi racks (asal photo) · chhat ki tube lights · aakhir mein 🧾 counter.
//   Ungli upar = aage chalo (asal scroll — tez, GPU: har frame sirf scene ka EK transform) · rack / board par tap = mud kar paas → wahi purana
//   qareeb wala rack view (dukan.js aisle, go(i)) · "🏬 Dukan" / phone back = wapas kamre mein usi rack ke saamne.
//   Perf: deewarein / chhat SVG (ek dafa) · door ke rack ki chhoti tasveer (400px) sirf paas aane par · peeche reh gaye rack chhupe · LITE phone = koi animation nahi.
//   AI NAHI. Data wahi (racks, rack photos, khula maal) — app mein kuch nahi badla.
// v2.278.0 (13 Nov 2026): malik — "door se customer ko rack dikhe, click kare to paas aaye, baqi rack bhi nazar aayein" · "upar ceiling, lights, cameras · poora counter · wahan banda baitha ho":
//   door ke bane racks par ASAL items ki tasveerein (wohi unit naap — rackLayoutU) · chhat ki jaali + LED lights + 📹 camera · aakhri deewar (board, shelf, ghari) + 🧑‍💼 dukan wala + poora counter (EK plane) ·
//   farsh slate-neela · website khulte hi yehi nazara (dukan.js ROOM_DEFAULT '1'; kamzor phone / ?kamra=0 = seedha rack).
import { RK_K, RK_PK, rkImgU } from './khula.js?v=2.278.0';
const P0 = 620;
const rad = d => d * Math.PI / 180;
export function makeKamra(C) {
  // C: { S, LITE, RM, esc, gth, hueOf, rpGet(photo) -> Promise<url>, onEnter(i), onNear(rk|null), openCounter(), where(text), buzz, sfx }
  const $ = id => document.getElementById(id), esc = C.esc;
  let G = null, panels = [], t = 0, raf = 0, nearI = -1, scene, stage, scroll, floor, ceil, bg, nearBtn, hint, spacer, maxT = 0, enterT = 0, enterA = 0, busy = false, man = null, manHi = false;
  const RPT = new Map(), Q = []; let qRaf = 0, qBusy = false;
  function dom() {
    if ($('kamra')) return;
    const k = document.createElement('section'); k.className = 'kamra'; k.id = 'kamra'; k.setAttribute('aria-label', 'Dukan — door se nazara');
    k.innerHTML = '<div class="k-scroll" id="kScroll"><div class="k-stage" id="kStage"><svg class="k-bg" id="kBg" aria-hidden="true"></svg><div class="k-floor" id="kFloor" aria-hidden="true"></div><div class="k-ceil" id="kCeil" aria-hidden="true"></div><div class="k-scene" id="kScene"></div>'
      + '<button type="button" class="k-near" id="kNear" hidden></button><p class="k-hint" id="kHint" hidden>👆 Ungli <b>upar</b> karein — dukan mein aage chalein<br>Rack par dabayein — paas se dekhein</p></div><div class="k-spacer" id="kSpacer"></div></div>';
    $('aisleWrap').after(k);
    scroll = $('kScroll'); stage = $('kStage'); scene = $('kScene'); floor = $('kFloor'); ceil = $('kCeil'); bg = $('kBg'); nearBtn = $('kNear'); hint = $('kHint'); spacer = $('kSpacer');
    scroll.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    k.addEventListener('click', e => {
      const b = e.target.closest('[data-kbay]'); if (b) { C.sfx?.('step'); C.buzz?.(8); enterBay(Number(b.dataset.kbay)); return; }
      if (e.target.closest('[data-kctr]')) { C.openCounter(); return; }
      if (e.target.closest('#kNear') && nearI >= 0) { C.buzz?.(8); enterBay(nearI); }
    });
  }
  function geo() {
    const W = stage.clientWidth || innerWidth, H = stage.clientHeight || 600;
    const s = Math.max(0.72, Math.min(2.3, H / (W < H ? 640 : 720)));   // v2.278.0: phone (lamba) par nazara 12% bara — rack saaf dikhein
    return { W, H, s, P: P0 * s, CW: Math.max(560 * s, W * 1.02), cx: W / 2, cy: H * 0.44, fy: 215 * s, ty: -232 * s, RH: 385 * s, gap: 54 * s, z0: -330 * s };
  }
  const widthOf = b => b.photo ? Math.max(210 * G.s, Math.min(480 * G.s, G.RH * (b.photo.w / b.photo.h))) : b.kh ? 390 * G.s : b.shelves ? G.RH * 0.717 : 330 * G.s;
  // ---------- deewarein / chhat / farsh (SVG, ek dafa) ----------
  function paintBg() {
    const k = Z => G.P / (G.P - Z), pt = (X, Y, Z) => `${(G.cx + X * k(Z)).toFixed(1)},${(G.cy + Y * k(Z)).toFixed(1)}`;
    const hw = G.CW / 2, T = G.ty, B = G.fy, Zf = -6500 * G.s, Zn = G.P - G.P / 14, s = G.s;
    const poly = (pts, fill, extra = '') => `<polygon points="${pts.join(' ')}" fill="${fill}"${extra}/>`;
    const band = (X, y1, y2) => [pt(X, y1, Zf), pt(X, y2, Zf), pt(X, y2, Zn), pt(X, y1, Zn)];
    bg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
    bg.innerHTML = `<defs><linearGradient id="kgL" x1="0" x2="1"><stop offset="0" stop-color="#f6f1e6"/><stop offset="1" stop-color="#e2d9c6"/></linearGradient><linearGradient id="kgR" x1="1" x2="0"><stop offset="0" stop-color="#efe8da"/><stop offset="1" stop-color="#dcd2bd"/></linearGradient>`
      + `<linearGradient id="kgC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9ecf1"/></linearGradient><linearGradient id="kgF" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e8edf4"/><stop offset="1" stop-color="#bcc7d6"/></linearGradient>`
      + `<radialGradient id="kgV" cx="50%" cy="44%" r="38%"><stop offset="0" stop-color="#fff8dc" stop-opacity=".55"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient></defs>`
      + poly([pt(-hw, T, Zf), pt(hw, T, Zf), pt(hw, T, Zn), pt(-hw, T, Zn)], 'url(#kgC)')
      + poly([pt(-hw, B, Zf), pt(hw, B, Zf), pt(hw, B, Zn), pt(-hw, B, Zn)], 'url(#kgF)')
      + poly([pt(-hw, T, Zf), pt(-hw, B, Zf), pt(-hw, B, Zn), pt(-hw, T, Zn)], 'url(#kgL)')
      + poly([pt(hw, T, Zf), pt(hw, B, Zf), pt(hw, B, Zn), pt(hw, T, Zn)], 'url(#kgR)')
      + poly(band(-hw, T, T + 34 * s), '#1b2f5c') + poly(band(hw, T, T + 34 * s), '#1b2f5c')   // neeli patti (dukan ka rang)
      + poly(band(-hw, T + 34 * s, T + 40 * s), '#f2b632') + poly(band(hw, T + 34 * s, T + 40 * s), '#f2b632')
      + poly(band(-hw, B - 16 * s, B), '#8793a8') + poly(band(hw, B - 16 * s, B), '#8793a8')   // neeche ki patti
      + poly([pt(-hw, T, Zf), pt(hw, T, Zf), pt(hw, B, Zf), pt(-hw, B, Zf)], '#d9cfba')
      + `<rect x="0" y="0" width="${G.W}" height="${G.H}" fill="url(#kgV)"/>`;
  }
  // ---------- ek rack ka andar (door wali chhoti shakal) ----------
  function inner(p) {
    const b = p.b;
    if (b.photo) return '<span class="k-ph"><i class="k-wait">📸</i></span>';
    if (b.kh) return '<span class="k-kh"><span class="k-jars"></span><span class="k-sacks"></span></span>';
    if (b.shelves) {   // v2.278.0: asal items — wohi naap (unit) jo paas wale rack ka
      const rows = b.rowsN || b.shelves.length || 5, u = p.w * 0.9 / 100; let h = '';
      for (let r = 0; r < rows; r++) h += `<span class="k-s2">${(b.shelves[r] || []).map(x => `<i class="k-it" data-kid="${esc(x.it.id)}" style="--wu:${x.wu.toFixed(1)};--hu:${x.hu.toFixed(1)};--h:${C.hueOf(x.it)}${x.n > 1 ? `;background-size:${(100 / x.c).toFixed(2)}% ${(100 / x.r).toFixed(2)}%` : ''}"></i>`).join('')}</span>`;
      return `<span class="k-r2" style="--u:${u.toFixed(3)}px;--rows:${rows}">${h}</span>`;
    }
    const per = 6, sh = 4, L = b.items.slice(0, per * sh);
    let h = ''; for (let r = 0; r < sh; r++) h += `<span class="k-sh">${L.slice(r * per, (r + 1) * per).map(it => `<i style="--h:${C.hueOf(it)}"></i>`).join('')}</span>`;
    return `<span class="k-dr">${h}</span>`;
  }
  // ---------- v2.278.0 (malik 13 Nov: "upar ceiling, lights, cameras · poora counter · wahan koi banda baitha ho") ----------
  const f1 = n => Number(n).toFixed(1);
  const CAM = '<svg viewBox="0 0 60 44" aria-hidden="true"><ellipse cx="30" cy="5" rx="27" ry="5" fill="#eef1f5" stroke="#b9c1cc"/><path d="M8 7a22 22 0 0 0 44 0z" fill="#1d2430"/><path d="M13 9a17 17 0 0 0 34 0z" fill="#2c3545"/><circle cx="30" cy="17" r="7.5" fill="#0b0f16" stroke="#4a5568"/><circle cx="27.5" cy="14.5" r="2.2" fill="#6aa5ff"/><circle class="k-led" cx="43" cy="12" r="2.3" fill="#ff3b30"/></svg>';
  function endSVG(Wc, Hc, name) {   // aakhri deewar: neeli patti · board (dukan ka naam) · peeche ki shelf (sirf sajawat) · ghari · camera
    const cx = Wc / 2; let seed = 11; const rnd = () => (seed = (seed * 73 + 41) % 997) / 997;
    let h = `<svg viewBox="0 0 ${f1(Wc)} ${f1(Hc)}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="keW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f3ea"/><stop offset="1" stop-color="#e2dbcb"/></linearGradient><linearGradient id="keS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b4788"/><stop offset="1" stop-color="#162953"/></linearGradient></defs>`
      + `<rect width="${f1(Wc)}" height="${f1(Hc)}" fill="url(#keW)"/><rect width="${f1(Wc)}" height="34" fill="#1b2f5c"/><rect y="34" width="${f1(Wc)}" height="3" fill="#f2b632"/>`;
    for (let r = 0; r < 2; r++) { const yb = 178 + r * 64, x0 = 22, x1 = Wc - 22;
      for (let x = x0; x < x1 - 16;) { const w = 13 + rnd() * 15, hh = 24 + rnd() * 24, hue = Math.round(rnd() * 360);
        h += `<rect x="${f1(x)}" y="${f1(yb - hh)}" width="${f1(w)}" height="${f1(hh)}" rx="2" fill="hsl(${hue} 56% 58%)"/><rect x="${f1(x + 2)}" y="${f1(yb - hh * 0.64)}" width="${f1(w - 4)}" height="${f1(hh * 0.3)}" fill="rgba(255,255,255,.6)"/>`; x += w + 2 + rnd() * 3; }
      h += `<rect x="${x0 - 8}" y="${yb}" width="${f1(x1 - x0 + 16)}" height="6" rx="2" fill="#8b96a6"/><rect x="${x0 - 8}" y="${yb + 6}" width="${f1(x1 - x0 + 16)}" height="3" fill="rgba(0,0,0,.1)"/>`; }
    const bw = Math.max(200, Math.min(340, Wc - 190)), bx = cx - bw / 2, nm = String(name || 'Noor Traders').toUpperCase().slice(0, 26);
    h += `<path d="M${f1(cx - bw * 0.3)} 37v12M${f1(cx + bw * 0.3)} 37v12" stroke="#6f7886" stroke-width="3"/><rect x="${f1(bx)}" y="48" width="${f1(bw)}" height="64" rx="12" fill="url(#keS)" stroke="#f2b632" stroke-width="3"/>`
      + `<text x="${f1(cx)}" y="${f1(91)}" text-anchor="middle" font-family="'Baloo 2',Manrope,system-ui,sans-serif" font-weight="800" font-size="${f1(Math.min(34, bw / (nm.length * 0.66)))}" fill="#fff" letter-spacing="1.2">${esc(nm)}</text>`;
    const d = new Date(), kx = Math.min(Wc - 36, cx + bw / 2 + 46), ky = 82;   // ghari (kholte waqt ka waqt)
    h += `<circle cx="${f1(kx)}" cy="${ky}" r="23" fill="#fff" stroke="#1b2f5c" stroke-width="4"/><path d="M${f1(kx)} ${ky}v-11" stroke="#1b2f5c" stroke-width="4" stroke-linecap="round" transform="rotate(${f1((d.getHours() % 12 + d.getMinutes() / 60) * 30)} ${f1(kx)} ${ky})"/><path d="M${f1(kx)} ${ky}v-17" stroke="#1b2f5c" stroke-width="2.6" stroke-linecap="round" transform="rotate(${d.getMinutes() * 6} ${f1(kx)} ${ky})"/><circle cx="${f1(kx)}" cy="${ky}" r="2.6" fill="#f2b632"/>`;
    const qx = Math.max(30, cx - bw / 2 - 86);   // 📹 deewar wala camera — counter ki taraf
    h += `<g transform="translate(${f1(qx)} 62)"><path d="M4 -25v12l12 8" stroke="#aab2bd" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><g transform="rotate(16)"><rect x="8" y="-13" width="48" height="21" rx="7" fill="#f4f6f9" stroke="#b9c1cc" stroke-width="1.5"/><rect x="47" y="-11" width="13" height="17" rx="3.5" fill="#1d2430"/><circle cx="55" cy="-2.5" r="3.4" fill="#4c8dff"/><circle cx="16" cy="-2.5" r="2.7" fill="#ff3b30"/></g></g>`;
    return h + '</svg>';
  }
  // 🧑‍💼 dukan wala — bani hui shakal (asal banda nahi): topi, waistcoat, salaam wala haath
  const MAN = '<svg viewBox="0 0 200 240" aria-hidden="true"><rect x="50" y="118" width="100" height="122" rx="16" fill="#2b3340"/><path d="M22 240c0-52 20-84 78-84s78 32 78 84z" fill="#f3efe6"/><path d="M22 240c0-50 18-80 58-83l13 42v41z" fill="#1b2f5c"/><path d="M178 240c0-50-18-80-58-83l-13 42v41z" fill="#1b2f5c"/><circle cx="100" cy="206" r="3.2" fill="#c9ccd2"/><circle cx="100" cy="224" r="3.2" fill="#c9ccd2"/>'
    + '<rect x="86" y="124" width="28" height="40" rx="10" fill="#c98d5e"/><path d="M79 157l21 23 21-23" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="62" cy="98" r="8" fill="#c98d5e"/><circle cx="138" cy="98" r="8" fill="#c98d5e"/><ellipse cx="100" cy="94" rx="38" ry="42" fill="#d9a074"/>'
    + '<path d="M61 85c0-31 17-47 39-47s39 16 39 47z" fill="#1b2f5c"/><path d="M58 86h84" stroke="#163b8f" stroke-width="11" stroke-linecap="round"/><circle cx="100" cy="60" r="8.5" fill="#f2b632"/>'
    + '<circle cx="86" cy="101" r="4.6" fill="#2a1d14"/><circle cx="114" cy="101" r="4.6" fill="#2a1d14"/><path d="M85 113c5-3.6 10-3.6 15 0 5-3.6 10-3.6 15 0" fill="none" stroke="#3a2a20" stroke-width="5.5" stroke-linecap="round"/><path d="M88 122c7 6.5 17 6.5 24 0" fill="none" stroke="#7a3b22" stroke-width="4" stroke-linecap="round"/>'
    + '<g class="k-arm"><path d="M158 200c13-18 19-44 18-64" fill="none" stroke="#f3efe6" stroke-width="25" stroke-linecap="round"/><circle cx="176" cy="122" r="15.5" fill="#d9a074"/><path d="M167 111l-4-15M176 108v-17M185 111l4-15" stroke="#d9a074" stroke-width="7.5" stroke-linecap="round"/></g></svg>';
  function ctrSVG(Wd) {   // 🧾 poora counter: sheeshe ka dabba · tarazu · screen · (printer) · neeli tokri · neela jism + sunehri patti + takhti
    const cx = Wd / 2, T = 56;
    let h = `<svg viewBox="0 0 ${f1(Wd)} 206" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="kcT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfcfd"/><stop offset="1" stop-color="#bfc7d1"/></linearGradient><linearGradient id="kcB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27427e"/><stop offset="1" stop-color="#16284f"/></linearGradient></defs>`;
    const gx = 16, gw = 108;   // sheeshe ka dabba (meethi goliyan — sajawat)
    h += `<rect x="${gx}" y="14" width="${gw}" height="42" rx="5" fill="rgba(196,228,255,.42)" stroke="#9fb3c8" stroke-width="2"/><path d="M${gx + 6} 20l16 30" stroke="rgba(255,255,255,.8)" stroke-width="3" stroke-linecap="round"/>`;
    [[10, 340], [34, 20], [58, 130], [82, 48]].forEach(([dx, hue]) => { h += `<rect x="${gx + dx}" y="30" width="18" height="24" rx="4" fill="hsl(${hue} 62% 60%)"/><rect x="${gx + dx - 1}" y="26" width="20" height="6" rx="2" fill="#e9edf2" stroke="#b9c1cc" stroke-width=".8"/>`; });
    const sx = gx + gw + 12;   // tarazu
    h += `<rect x="${sx}" y="44" width="60" height="12" rx="3" fill="#d5dae1" stroke="#aeb6c2"/><rect x="${sx + 5}" y="38" width="50" height="6" rx="2" fill="#f6f8fa" stroke="#b9c1cc"/><rect x="${sx + 17}" y="46.5" width="26" height="7" rx="1.5" fill="#0f2418"/><path d="M${sx + 21} 50h18" stroke="#51e08a" stroke-width="2" stroke-dasharray="3 2"/>`;
    const kx = Wd - 16 - 76;   // neeli tokri (order)
    h += `<rect x="${f1(kx)}" y="24" width="76" height="32" rx="5" fill="#2766de"/>`; for (let i = 1; i < 8; i++) h += `<path d="M${f1(kx + i * 9.5)} 30v22" stroke="#163f9c" stroke-width="3" stroke-linecap="round"/>`;
    h += `<rect x="${f1(kx - 3)}" y="20" width="82" height="8" rx="4" fill="#3f82f5"/>`;
    const mx = kx - 12 - 62;   // screen (bill)
    h += `<rect x="${f1(mx + 25)}" y="42" width="12" height="12" fill="#6f7886"/><rect x="${f1(mx + 12)}" y="52" width="38" height="4" rx="2" fill="#6f7886"/><rect x="${f1(mx)}" y="2" width="62" height="42" rx="5" fill="#20262f"/><rect x="${f1(mx + 4)}" y="6" width="54" height="34" rx="2.5" fill="#eaf2ff"/><rect x="${f1(mx + 4)}" y="6" width="54" height="8" fill="#2766de"/>`;
    for (let i = 0; i < 4; i++) h += `<path d="M${f1(mx + 9)} ${19 + i * 5.2}h${i % 2 ? 30 : 38}" stroke="#7d8aa0" stroke-width="2" stroke-linecap="round"/>`;
    if (mx - (sx + 60) > 200) { const px = mx - 46;   // jagah ho to parchi ka printer
      h += `<path d="M${f1(px + 7)} 40v-17q0-4 4-4h12q4 0 4 4v17" fill="#fff" stroke="#cfd5dd"/><path d="M${f1(px + 11)} 25h12M${f1(px + 11)} 30h9M${f1(px + 11)} 35h12" stroke="#9aa3ae" stroke-width="1.6"/><rect x="${f1(px)}" y="38" width="34" height="18" rx="4" fill="#2b3340"/><circle cx="${f1(px + 27)}" cy="47" r="2" fill="#51e08a"/>`; }
    h += `<rect x="0" y="${T}" width="${f1(Wd)}" height="13" rx="4" fill="url(#kcT)"/><rect x="8" y="${T + 13}" width="${f1(Wd - 16)}" height="125" fill="url(#kcB)"/><rect x="8" y="${T + 13}" width="${f1(Wd - 16)}" height="7" fill="rgba(0,0,0,.22)"/><rect x="8" y="${T + 26}" width="${f1(Wd - 16)}" height="4" fill="#f2b632"/>`;
    for (let i = 1; i < 4; i++) h += `<path d="M${f1(8 + (Wd - 16) * i / 4)} ${T + 34}v100" stroke="rgba(255,255,255,.09)" stroke-width="2"/>`;
    h += `<rect x="${f1(cx - 122)}" y="${T + 46}" width="244" height="66" rx="13" fill="#fdfdfb" stroke="#f2b632" stroke-width="3"/><text x="${f1(cx)}" y="${T + 76}" text-anchor="middle" font-family="'Baloo 2',Manrope,system-ui,sans-serif" font-weight="800" font-size="26" fill="#1b2f5c">🧾 Counter</text><text x="${f1(cx)}" y="${T + 98}" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="700" font-size="14" fill="#46536c">parchi · WhatsApp order</text>`;
    return h + `<rect x="8" y="194" width="${f1(Wd - 16)}" height="12" fill="#0f1930"/></svg>`;
  }
  function build() {
    dom(); G = geo(); stage.style.perspective = G.P + 'px';
    const S = C.S, L = [], R = [];
    S.bays.forEach((b, i) => (b.kh ? L : R).push(i));
    panels = [];
    const lay = (ids, side) => { let z = G.z0; for (const i of ids) { const b = S.bays[i], w = widthOf(b); panels.push({ i, b, side, zc: z - w / 2, w }); z -= w + G.gap; } return z; };
    let zl = G.z0, zr = G.z0;
    if (L.length) { zl = lay(L, -1); zr = lay(R, 1); }   // malik: 🌾 ek deewar, baqi racks doosri
    else { zl = lay(R.filter((_, k) => k % 2), -1); zr = lay(R.filter((_, k) => !(k % 2)), 1); }   // khula maal na ho = dono deewar
    G.zEnd = Math.min(zl, zr) - 160 * G.s;
    const s = G.s, hw = G.CW / 2;
    let h = '';
    for (const p of panels) {
      const b = p.b, x = p.side * (hw - 3 * s - p.w * 0.155), y = G.fy - G.RH / 2;   // 72° = rack ka munh darwaze ki taraf (door se nazar aaye)
      h += `<button type="button" class="k-rk ${b.photo ? 'kp-ph' : b.kh ? 'kp-kh' : 'kp-dr'}" data-kbay="${p.i}" style="width:${p.w.toFixed(1)}px;height:${G.RH.toFixed(1)}px;margin:${(-G.RH / 2).toFixed(1)}px 0 0 ${(-p.w / 2).toFixed(1)}px;transform:translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${p.zc.toFixed(1)}px) rotateY(${p.side < 0 ? 72 : -72}deg)" aria-label="Rack ${b.rk.no}: ${esc(b.rk.name)}">${inner(p)}</button>`;
      if (!b.p) { const sw = 188 * s, sx = p.side * (hw - 104 * s);   // 🪧 latakta board — kamre ki taraf, door se parha jaye
        h += `<button type="button" class="k-sign${b.kh ? ' ks-kh' : ''}" data-kbay="${p.i}" data-ksg="${p.i}" style="width:${sw.toFixed(1)}px;margin-left:${(-sw / 2).toFixed(1)}px;font-size:${(15.5 * s).toFixed(1)}px;transform:translate3d(${sx.toFixed(1)}px,${(G.ty + 22 * s).toFixed(1)}px,${(p.zc + p.w * 0.42).toFixed(1)}px)"><small>Rack ${b.rk.no}${b.kh ? ' · 🌾' : b.photo ? ' · 📸' : ''}</small><b>${esc(b.rk.name)}</b></button>`; }
    }
    // 💡 chhat ki LED lights (do qatar) + 📹 gol camera (chhat se latke, baari baari dono taraf)
    const lw = 104 * s, lx = hw * 0.4;
    for (let z = G.z0 - 40 * s; z > G.zEnd - 60 * s; z -= 420 * s) for (const sd of [-1, 1]) h += `<i class="k-lt" style="width:${lw.toFixed(1)}px;height:${lw.toFixed(1)}px;margin:${(-lw / 2).toFixed(1)}px 0 0 ${(-lw / 2).toFixed(1)}px;transform:translate3d(${(sd * lx).toFixed(1)}px,${(G.ty + 1).toFixed(1)}px,${z.toFixed(1)}px) rotateX(-90deg)"></i>`;
    const qw = 50 * s, qh = qw * 44 / 60; let qn = 0;
    for (let z = G.z0 + 60 * s; z > G.zEnd + 200 * s && qn < 8; z -= 840 * s, qn++) h += `<i class="k-cam" style="width:${qw.toFixed(1)}px;height:${qh.toFixed(1)}px;margin:0 0 0 ${(-qw / 2).toFixed(1)}px;transform:translate3d(${((qn % 2 ? 1 : -1) * hw * 0.12).toFixed(1)}px,${G.ty.toFixed(1)}px,${z.toFixed(1)}px)">${CAM}</i>`;
    // aakhri deewar · dukan wala · poora counter (gali ke aakhir mein)
    const eh = G.fy - G.ty, ew = G.CW + 8 * s, cw = Math.min(G.CW * 0.86, 560 * s), ch = 206 * s, mw = 200 * s, mh = 240 * s;
    // teeno EK plane mein (alag plane = browser ki 3D tarteeb mein bande ka tukda counter ke upar aa jata hai) — andar DOM ki tarteeb: deewar, banda, counter
    h += `<div class="k-end" style="width:${ew.toFixed(1)}px;height:${eh.toFixed(1)}px;margin:${(-eh / 2).toFixed(1)}px 0 0 ${(-ew / 2).toFixed(1)}px;transform:translate3d(0,${((G.fy + G.ty) / 2).toFixed(1)}px,${(G.zEnd - 60 * s).toFixed(1)}px)">${endSVG(ew / s, eh / s, C.shop?.())}`
      + `<div class="k-man" style="left:${((ew - mw) / 2).toFixed(1)}px;top:${(eh - 118 * s - mh).toFixed(1)}px;width:${mw.toFixed(1)}px;height:${mh.toFixed(1)}px">${MAN}</div>`
      + `<button type="button" class="k-ctr" data-kctr="1" style="left:${((ew - cw) / 2).toFixed(1)}px;top:${(eh - ch).toFixed(1)}px;width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px" aria-label="Counter — parchi aur order">${ctrSVG(cw / s)}</button></div>`;
    scene.innerHTML = h; man = scene.querySelector('.k-man'); manHi = false;
    panels.forEach(p => { p.el = scene.querySelector(`.k-rk[data-kbay="${p.i}"]`); p.sg = scene.querySelector(`[data-ksg="${p.i}"]`); p.fill = false; p.hid = false; p.sh = false; });
    maxT = Math.max(0, -G.zEnd - 520 * s); spacer.style.height = Math.round(maxT) + 'px';
    const fl = 3200 * s; floor.style.cssText = `width:${G.CW.toFixed(1)}px;height:${fl.toFixed(1)}px;margin:${(-fl / 2).toFixed(1)}px 0 0 ${(-G.CW / 2).toFixed(1)}px;--tile:${(118 * s).toFixed(1)}px`;
    ceil.style.cssText = `width:${G.CW.toFixed(1)}px;height:${fl.toFixed(1)}px;margin:${(-fl / 2).toFixed(1)}px 0 0 ${(-G.CW / 2).toFixed(1)}px;--tile:${(118 * s).toFixed(1)}px`;
    paintBg(); RPT.forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); RPT.clear(); Q.length = 0;
    nearI = -2; frame();
  }
  const floorTf = () => { const tile = 118 * G.s, fl = 3200 * G.s; return `translate3d(0,${G.fy.toFixed(1)}px,${(G.P * 0.78 - fl / 2 + (C.LITE ? 0 : t % tile)).toFixed(1)}px) rotateX(90deg)`; };
  const ceilTf = () => { const tile = 118 * G.s, fl = 3200 * G.s; return `translate3d(0,${G.ty.toFixed(1)}px,${(G.P * 0.78 - fl / 2 + (C.LITE ? 0 : t % tile)).toFixed(1)}px) rotateX(-90deg)`; };
  const camTf = (a, z) => `translate3d(0,0,${G.P.toFixed(1)}px) rotateY(${a.toFixed(2)}deg) translate3d(0,0,${(-G.P).toFixed(1)}px) translate3d(0,0,${z.toFixed(1)}px)`;
  function frame() {
    raf = 0; if (!G) return; t = scroll.scrollTop;
    if (!busy) scene.style.transform = camTf(0, t);
    floor.style.transform = floorTf(); ceil.style.transform = ceilTf();
    if (man && !manHi && !C.LITE && !C.RM && t > maxT - 700 * G.s) { manHi = true; man.classList.add('hi'); }
    let best = -1, bd = 1e9;
    for (const p of panels) {
      const zf = p.zc - p.w / 2 + t, zc = p.zc + t, hid = zf > G.P * 0.82;   // peeche reh gaya = chhupa (camera ke peeche 3D ka jhanjhat nahi)
      if (hid !== p.hid) { p.hid = hid; p.el.style.visibility = hid ? 'hidden' : ''; }
      if (p.sg) { const sh = zc > G.P * 0.55; if (sh !== p.sh) { p.sh = sh; p.sg.style.visibility = sh ? 'hidden' : ''; } }
      const d = Math.abs(zc + 330 * G.s); if (zc < -40 * G.s && d < bd) { bd = d; best = p.i; }
      if (!p.fill && !p.q && zc > (p.b.shelves ? -2400 : -3600) * G.s) { p.q = true; Q.push(p); }   // bane rack ki tasveerein sirf qareeb ke ~7 rack (mobile data) — aage chalo to agle
    }
    if (best !== nearI) { nearI = best; paintNear(); C.onNear?.(best >= 0 ? C.S.bays[best].rk : null); }
    if (Q.length) { Q.sort((a, b) => b.zc - a.zc); pump(); }
  }
  function paintNear() {
    const b = nearI >= 0 ? C.S.bays[nearI] : null; nearBtn.hidden = !b;
    if (b) nearBtn.innerHTML = `<span>👀 ${b.kh ? '🌾' : '📍'} Rack ${b.rk.no}</span><b>${esc(b.rk.name)}</b><i>Paas jao ›</i>`;
  }
  // door ke rack: tasveer / daane sirf paas aane par (ek ek, phone na ruke)
  function pump() {
    if (qRaf) return;
    qRaf = requestAnimationFrame(async () => {
      qRaf = 0; const t0 = performance.now();
      while (Q.length && performance.now() - t0 < 8) {
        const p = Q.shift(); if (!p.el?.isConnected || p.fill) continue;
        if (p.b.photo) { if (qBusy) { Q.unshift(p); break; } qBusy = true; thumbRp(p).finally(() => { qBusy = false; if (Q.length) pump(); }); break; }
        if (p.b.shelves) fillDr(p); else fillKh(p);
      }
      if (Q.length && !qBusy) pump();
    });
  }
  function fillDr(p) {   // bana hua rack: jo tasveer aa chuki = foran, baqi mangwao (aate hi K.photo)
    p.fill = true; const need = [];
    p.el.querySelectorAll('.k-it').forEach(el => { const u = C.phUrl?.(el.dataset.kid); if (u) { el.style.backgroundImage = `url("${u}")`; el.classList.add('on'); } else need.push(el.dataset.kid); });
    if (need.length) C.phWant?.(need);
  }
  function photo(id, url) { if (!scene || !url) return; scene.querySelectorAll(`.k-it[data-kid="${CSS.escape(String(id))}"]`).forEach(el => { el.style.backgroundImage = `url("${url}")`; el.classList.add('on'); }); }
  function fillKh(p) {
    p.fill = true; const b = p.b;
    if (b.kh) {
      const J = p.el.querySelector('.k-jars'), K = p.el.querySelector('.k-sacks');
      if (J) J.innerHTML = b.kh.g.slice(0, 8).map(it => `<img src="${C.gth(it, 72)}" alt="">`).join('') || '';
      if (K) K.innerHTML = b.kh.s.slice(0, 4).map(it => `<img src="${C.gth(it, 96)}" alt="">`).join('');
      if (!b.kh.g.length) p.el.classList.add('nojar');
    }
  }
  async function thumbRp(p) {
    p.fill = true; const pid = p.b.photo.pid;
    try {
      let u = RPT.get(pid);
      if (!u) { const big = await C.rpGet(p.b.photo); if (!big) { p.fill = false; return; }
        const im = new Image(); im.src = big; await im.decode();
        const k = Math.min(1, (C.LITE ? 300 : 420) / (im.naturalWidth || 420)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        const bl = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.8)); if (!bl) { p.fill = false; return; } u = URL.createObjectURL(bl); RPT.set(pid, u); }
      document.querySelectorAll(`.k-rk[data-kbay="${p.i}"] .k-ph`).forEach(el => { el.style.backgroundImage = `url('${u}')`; el.classList.add('on'); el.querySelector('.k-wait')?.remove(); });
    } catch (e) { p.fill = false; console.warn('kamra photo', e); }
  }
  // ---------- rack ke paas jao (mud kar) → purana qareeb wala view ----------
  const standT = p => Math.max(0, Math.min(maxT + 600 * G.s, G.P - (G.CW / 2) / Math.tan(rad(62)) - p.zc));
  async function enterBay(i, fast) {
    if (busy) return; const p = panels.find(x => x.i === i);
    if (p && !fast && !C.LITE && !C.RM && scene.animate) {
      busy = true; enterT = standT(p); enterA = p.side < 0 ? -62 : 62; hint.hidden = true;
      try { await scene.animate([{ transform: camTf(0, t) }, { transform: camTf(enterA * 0.35, (t + enterT) / 2) }, { transform: camTf(enterA, enterT) }], { duration: 760, easing: 'cubic-bezier(.45,0,.25,1)' }).finished; } catch {}
      scene.style.transform = camTf(enterA, enterT); busy = false;
    } else { enterT = 0; enterA = 0; }
    C.onEnter(i);
  }
  // wapas kamre mein — usi rack ke saamne, mud kar peeche hato
  function back(i) {
    if (!G) return; const p = panels.find(x => x.i === i) || panels.find(x => x.b.rk === C.S.bays[i]?.rk);
    const tt = p ? Math.max(0, Math.min(maxT, -p.zc - 380 * G.s)) : t;
    scroll.scrollTop = tt; t = scroll.scrollTop;
    if (p && !C.LITE && !C.RM && scene.animate && enterA) {
      busy = true; const a0 = p.side < 0 ? -62 : 62, z0 = standT(p);
      scene.animate([{ transform: camTf(a0, z0) }, { transform: camTf(0, t) }], { duration: 620, easing: 'cubic-bezier(.3,0,.2,1)' }).finished.catch(() => {}).finally(() => { busy = false; frame(); });
      scene.style.transform = camTf(0, t);
    }
    enterA = 0; frame();
  }
  // chip / dukan wala → chal kar rack tak, phir paas
  let walkTok = 0;
  function walkTo(i) {
    if (!G) return C.onEnter(i); const p = panels.find(x => x.i === i); if (!p) return C.onEnter(i);
    const tok = ++walkTok, target = Math.max(0, Math.min(maxT, -p.zc - 380 * G.s)), d = Math.abs(target - scroll.scrollTop);
    if (d < 6 || C.LITE || C.RM) { scroll.scrollTop = target; frame(); enterBay(i, C.LITE || C.RM); return; }
    scroll.scrollTo({ top: target, behavior: 'smooth' }); const t0 = Date.now(), lim = Math.min(2600, 500 + d * 0.6);
    const tick = () => { if (tok !== walkTok) return; if (Math.abs(scroll.scrollTop - target) < 3 || Date.now() - t0 > lim) { scroll.scrollTop = target; frame(); enterBay(i); return; } setTimeout(tick, 60); };
    setTimeout(tick, 120);
  }
  function showHint() { try { if (sessionStorage.getItem('nt-dk-khint')) return; sessionStorage.setItem('nt-dk-khint', '1'); } catch {} hint.hidden = false; setTimeout(() => { hint.hidden = true; }, 5200); scroll.addEventListener('scroll', () => { hint.hidden = true; }, { once: true, passive: true }); }
  return { build, photo, enterBay, back, walkTo, showHint, step: d => scroll && scroll.scrollBy({ top: d * (G?.s || 1) * 260, behavior: C.LITE ? 'auto' : 'smooth' }), near: () => nearI, relayout: () => { if (G) build(); } };
}
