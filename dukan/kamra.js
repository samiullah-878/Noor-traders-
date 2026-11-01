// kamra.js — v2.166.0 (1 Nov 2026): 🏬 DUKAN KA KAMRA — "door se nazara" (website)
//   Malik: "puri site ek chhoti screen jaisi lagti hai — design aisa ho jaise shop mein rack laga ho, door se nazar aaye ·
//          daalon wala hissa ek deewar ke saath, doosri deewar ke saath baqi items ke racks · customer jis rack ke paas jaye, wo rack wese dikh jaye".
//   Kamra = CSS 3D gali: baayein deewar 🌾 khula maal (dabbe + tore) · daayein deewar baqi racks (asal photo) · chhat ki tube lights · aakhir mein 🧾 counter.
//   Ungli upar = aage chalo (asal scroll — tez, GPU: har frame sirf scene ka EK transform) · rack / board par tap = mud kar paas → wahi purana
//   qareeb wala rack view (dukan.js aisle, go(i)) · "🏬 Dukan" / phone back = wapas kamre mein usi rack ke saamne.
//   Perf: deewarein / chhat SVG (ek dafa) · door ke rack ki chhoti tasveer (400px) sirf paas aane par · peeche reh gaye rack chhupe · LITE phone = koi animation nahi.
//   AI NAHI. Data wahi (racks, rack photos, khula maal) — app mein kuch nahi badla.
const P0 = 620;
const rad = d => d * Math.PI / 180;
export function makeKamra(C) {
  // C: { S, LITE, RM, esc, gth, hueOf, rpGet(photo) -> Promise<url>, onEnter(i), onNear(rk|null), openCounter(), where(text), buzz, sfx }
  const $ = id => document.getElementById(id), esc = C.esc;
  let G = null, panels = [], t = 0, raf = 0, nearI = -1, scene, stage, scroll, floor, bg, nearBtn, hint, spacer, maxT = 0, enterT = 0, enterA = 0, busy = false;
  const RPT = new Map(), Q = []; let qRaf = 0, qBusy = false;
  function dom() {
    if ($('kamra')) return;
    const k = document.createElement('section'); k.className = 'kamra'; k.id = 'kamra'; k.setAttribute('aria-label', 'Dukan — door se nazara');
    k.innerHTML = '<div class="k-scroll" id="kScroll"><div class="k-stage" id="kStage"><svg class="k-bg" id="kBg" aria-hidden="true"></svg><div class="k-floor" id="kFloor" aria-hidden="true"></div><div class="k-scene" id="kScene"></div>'
      + '<button type="button" class="k-near" id="kNear" hidden></button><p class="k-hint" id="kHint" hidden>👆 Ungli <b>upar</b> karein — dukan mein aage chalein<br>Rack par dabayein — paas se dekhein</p></div><div class="k-spacer" id="kSpacer"></div></div>';
    $('aisleWrap').after(k);
    scroll = $('kScroll'); stage = $('kStage'); scene = $('kScene'); floor = $('kFloor'); bg = $('kBg'); nearBtn = $('kNear'); hint = $('kHint'); spacer = $('kSpacer');
    scroll.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    k.addEventListener('click', e => {
      const b = e.target.closest('[data-kbay]'); if (b) { C.sfx?.('step'); C.buzz?.(8); enterBay(Number(b.dataset.kbay)); return; }
      if (e.target.closest('[data-kctr]')) { C.openCounter(); return; }
      if (e.target.closest('#kNear') && nearI >= 0) { C.buzz?.(8); enterBay(nearI); }
    });
  }
  function geo() {
    const W = stage.clientWidth || innerWidth, H = stage.clientHeight || 600;
    const s = Math.max(0.72, Math.min(2.3, H / 720));
    return { W, H, s, P: P0 * s, CW: Math.max(560 * s, W * 1.02), cx: W / 2, cy: H * 0.4, fy: 215 * s, ty: -232 * s, RH: 385 * s, gap: 54 * s, z0: -150 * s };
  }
  const widthOf = b => b.photo ? Math.max(210 * G.s, Math.min(480 * G.s, G.RH * (b.photo.w / b.photo.h))) : b.kh ? 390 * G.s : 330 * G.s;
  // ---------- deewarein / chhat / farsh (SVG, ek dafa) ----------
  function paintBg() {
    const k = Z => G.P / (G.P - Z), pt = (X, Y, Z) => `${(G.cx + X * k(Z)).toFixed(1)},${(G.cy + Y * k(Z)).toFixed(1)}`;
    const hw = G.CW / 2, T = G.ty, B = G.fy, Zf = -6500 * G.s, Zn = G.P - G.P / 14, s = G.s;
    const poly = (pts, fill, extra = '') => `<polygon points="${pts.join(' ')}" fill="${fill}"${extra}/>`;
    const band = (X, y1, y2) => [pt(X, y1, Zf), pt(X, y2, Zf), pt(X, y2, Zn), pt(X, y1, Zn)];
    bg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
    bg.innerHTML = `<defs><linearGradient id="kgL" x1="0" x2="1"><stop offset="0" stop-color="#f6f1e6"/><stop offset="1" stop-color="#e2d9c6"/></linearGradient><linearGradient id="kgR" x1="1" x2="0"><stop offset="0" stop-color="#efe8da"/><stop offset="1" stop-color="#dcd2bd"/></linearGradient>`
      + `<linearGradient id="kgC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9ecf1"/></linearGradient><linearGradient id="kgF" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e3d5b8"/><stop offset="1" stop-color="#cdbb97"/></linearGradient>`
      + `<radialGradient id="kgV" cx="50%" cy="44%" r="38%"><stop offset="0" stop-color="#fff8dc" stop-opacity=".55"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient></defs>`
      + poly([pt(-hw, T, Zf), pt(hw, T, Zf), pt(hw, T, Zn), pt(-hw, T, Zn)], 'url(#kgC)')
      + poly([pt(-hw, B, Zf), pt(hw, B, Zf), pt(hw, B, Zn), pt(-hw, B, Zn)], 'url(#kgF)')
      + poly([pt(-hw, T, Zf), pt(-hw, B, Zf), pt(-hw, B, Zn), pt(-hw, T, Zn)], 'url(#kgL)')
      + poly([pt(hw, T, Zf), pt(hw, B, Zf), pt(hw, B, Zn), pt(hw, T, Zn)], 'url(#kgR)')
      + poly(band(-hw, T, T + 34 * s), '#1b2f5c') + poly(band(hw, T, T + 34 * s), '#1b2f5c')   // neeli patti (dukan ka rang)
      + poly(band(-hw, T + 34 * s, T + 40 * s), '#f2b632') + poly(band(hw, T + 34 * s, T + 40 * s), '#f2b632')
      + poly(band(-hw, B - 16 * s, B), '#b7a27a') + poly(band(hw, B - 16 * s, B), '#b7a27a')   // neeche ki patti
      + poly([pt(-hw, T, Zf), pt(hw, T, Zf), pt(hw, B, Zf), pt(-hw, B, Zf)], '#d9cfba')
      + `<rect x="0" y="0" width="${G.W}" height="${G.H}" fill="url(#kgV)"/>`;
  }
  // ---------- ek rack ka andar (door wali chhoti shakal) ----------
  function inner(p) {
    const b = p.b;
    if (b.photo) return '<span class="k-ph"><i class="k-wait">📸</i></span>';
    if (b.kh) return '<span class="k-kh"><span class="k-jars"></span><span class="k-sacks"></span></span>';
    const per = 6, sh = 4, L = b.items.slice(0, per * sh);
    let h = ''; for (let r = 0; r < sh; r++) h += `<span class="k-sh">${L.slice(r * per, (r + 1) * per).map(it => `<i style="--h:${C.hueOf(it)}"></i>`).join('')}</span>`;
    return `<span class="k-dr">${h}</span>`;
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
      if (!b.p) { const sw = 250 * s, sx = p.side * (hw - 150 * s);   // 🪧 latakta board — kamre ki taraf, door se parha jaye
        h += `<button type="button" class="k-sign${b.kh ? ' ks-kh' : ''}" data-kbay="${p.i}" data-ksg="${p.i}" style="width:${sw.toFixed(1)}px;margin-left:${(-sw / 2).toFixed(1)}px;font-size:${(19 * s).toFixed(1)}px;transform:translate3d(${sx.toFixed(1)}px,${(G.ty + 38 * s).toFixed(1)}px,${(p.zc + p.w * 0.42).toFixed(1)}px)"><small>Rack ${b.rk.no}${b.kh ? ' · 🌾' : b.photo ? ' · 📸' : ''}</small><b>${esc(b.rk.name)}</b></button>`; }
    }
    for (let z = G.z0 - 60 * s; z > G.zEnd; z -= 400 * s) h += `<i class="k-lt" style="width:${(26 * s).toFixed(1)}px;height:${(230 * s).toFixed(1)}px;margin:${(-115 * s).toFixed(1)}px 0 0 ${(-13 * s).toFixed(1)}px;transform:translate3d(0,${(G.ty + 1).toFixed(1)}px,${z.toFixed(1)}px) rotateX(-90deg)"></i>`;
    const cw = 470 * s, ch = 210 * s;   // 🧾 aakhir mein counter
    h += `<button type="button" class="k-ctr" data-kctr="1" style="width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px;margin:${(-ch / 2).toFixed(1)}px 0 0 ${(-cw / 2).toFixed(1)}px;font-size:${(22 * s).toFixed(1)}px;transform:translate3d(0,${(G.fy - ch / 2).toFixed(1)}px,${G.zEnd.toFixed(1)}px)" aria-label="Counter — parchi aur order"><b>🧾 Counter</b><small>parchi · WhatsApp order</small><span class="k-desk"></span><span class="k-crate"></span></button>`;
    scene.innerHTML = h;
    panels.forEach(p => { p.el = scene.querySelector(`.k-rk[data-kbay="${p.i}"]`); p.sg = scene.querySelector(`[data-ksg="${p.i}"]`); p.fill = false; p.hid = false; p.sh = false; });
    maxT = Math.max(0, -G.zEnd - 520 * s); spacer.style.height = Math.round(maxT) + 'px';
    const fl = 3200 * s; floor.style.cssText = `width:${G.CW.toFixed(1)}px;height:${fl.toFixed(1)}px;margin:${(-fl / 2).toFixed(1)}px 0 0 ${(-G.CW / 2).toFixed(1)}px;--tile:${(118 * s).toFixed(1)}px`;
    paintBg(); RPT.forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); RPT.clear(); Q.length = 0;
    nearI = -2; frame();
  }
  const floorTf = () => { const tile = 118 * G.s, fl = 3200 * G.s; return `translate3d(0,${G.fy.toFixed(1)}px,${(G.P * 0.78 - fl / 2 + (C.LITE ? 0 : t % tile)).toFixed(1)}px) rotateX(90deg)`; };
  const camTf = (a, z) => `translate3d(0,0,${G.P.toFixed(1)}px) rotateY(${a.toFixed(2)}deg) translate3d(0,0,${(-G.P).toFixed(1)}px) translate3d(0,0,${z.toFixed(1)}px)`;
  function frame() {
    raf = 0; if (!G) return; t = scroll.scrollTop;
    if (!busy) scene.style.transform = camTf(0, t);
    floor.style.transform = floorTf();
    let best = -1, bd = 1e9;
    for (const p of panels) {
      const zf = p.zc - p.w / 2 + t, zc = p.zc + t, hid = zf > G.P * 0.82;   // peeche reh gaya = chhupa (camera ke peeche 3D ka jhanjhat nahi)
      if (hid !== p.hid) { p.hid = hid; p.el.style.visibility = hid ? 'hidden' : ''; }
      if (p.sg) { const sh = zc > G.P * 0.55; if (sh !== p.sh) { p.sh = sh; p.sg.style.visibility = sh ? 'hidden' : ''; } }
      const d = Math.abs(zc + 330 * G.s); if (zc < -40 * G.s && d < bd) { bd = d; best = p.i; }
      if (!p.fill && !p.q && zc > -3600 * G.s) { p.q = true; Q.push(p); }
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
        fillKh(p);
      }
      if (Q.length && !qBusy) pump();
    });
  }
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
  return { build, enterBay, back, walkTo, showHint, step: d => scroll && scroll.scrollBy({ top: d * (G?.s || 1) * 260, behavior: C.LITE ? 'auto' : 'smooth' }), near: () => nearI, relayout: () => { if (G) build(); } };
}
