// =========================================================
//  entry-photo.js  v1.0 (2026-10-21) — 📷 PARTY ENTRY KI TASVEER parchi (TM-T88IV) par
//  Malik: "jab bhi kisi party ki amount add ki jaye wahan photo lagane ka option ho, wohi photo party chips ke andar aur PRINT par ho".
//  App v2.105.8: tasveer entryPhotos/<entryId>.photos (3 tak, JPEG data-URL), entry par pn.photos = ginti.
//  Yahan: har tasveer photo-print.js se kaala-safed, aadhe kaghaz ki chaurai (256 dots, lambai 320 tak), parchi ke neeche kaatne se pehle.
//  App pehle tasveer ka doc likhti hai phir entry (ek hi phone ki likhai tarteeb se jati hai) — phir bhi pn.photos > 0 aur doc na mile to
//  8 sec tak har 2 sec dobara dekho; na mile to parchi bina tasveer (parchi kabhi nahi rukti). POS / SQL mein KUCH NAHI.
// =========================================================
const IS_JPG = /^data:image\/jpe?g;base64,/i;
const CUT = '\x1dV\x42\x00';
const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = function entryPhoto({ biz, PH, log = () => {} } = {}) {
  async function photosOf(e, { waitMs = 8000, every = 2000 } = {}) {
    if (!e || !e.id) return [];
    let a = Array.isArray(e.photos) ? e.photos : [];
    const want = Number(e.pn && e.pn.photos) || 0;
    if (!a.length && want > 0 && biz) {
      const t0 = Date.now();
      for (;;) {
        try { const d = await biz.collection('entryPhotos').doc(String(e.id)).get(); a = d.exists && Array.isArray((d.data() || {}).photos) ? d.data().photos : []; } catch (er) { log('tasveer parh nahi saka: ' + (er.message || er)); }
        if (a.length || Date.now() - t0 >= waitMs) break;
        await wait(every);
      }
      if (!a.length) log(`📷 ${e.id}: tasveer ${Math.round(waitMs / 1000)} sec mein nahi aayi — parchi bina tasveer`);
    }
    return a.filter(x => IS_JPG.test(String(x))).slice(0, 3);
  }
  async function raster(e, opts) {
    if (!PH || !PH.photoRaster) return '';
    const out = [];
    for (const u of await photosOf(e, opts)) { const r = PH.photoRaster(u, 256, 320); if (r) out.push(r); }
    return out.join('\r\n\r\n');
  }
  // parchi ke text mein kaatne (GS V) se pehle "Tasveer:" + raster
  function addBeforeCut(txt, ras, label = 'Tasveer:') {
    if (!ras) return txt;
    const k = String(txt).lastIndexOf(CUT);
    return k >= 0 ? txt.slice(0, k) + label + '\r\n' + ras + '\r\n\r\n\r\n' + txt.slice(k) : txt + '\r\n' + label + '\r\n' + ras + '\r\n';
  }
  async function withPhoto(txt, e, opts) { try { return addBeforeCut(txt, await raster(e, opts)); } catch (er) { log('tasveer parchi par nahi lagi: ' + (er.message || er)); return txt; } }
  return { photosOf, raster, addBeforeCut, withPhoto };
};
