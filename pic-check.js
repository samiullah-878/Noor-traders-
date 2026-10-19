// pic-check.js — v2.103.43 (2026-10-19): 📷 TASVEER DHUNDLI? — malik: "photo blur ho jati hai, AI wale khane par dekhna hai".
//   blurScore(file) -> { score, blur } : tasveer ko ~700px par utaar kar grey, Laplacian ka variance (tez kinare = zyada). score < 250 = dhundli
//   (bill / label ki likhai ke liye). Bina AI — sirf hisaab, phone par 100–300 ms. Galti ho to blur = false (kabhi na roke).
export async function blurScore(file, opt = {}) {
  const limit = Number(opt.limit) || 250;   // asal photo (700px par): saaf bill ~1300–1700, 2px dhundla ~235, 3px ~35
  try {
    const url = URL.createObjectURL(file); const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const W0 = img.naturalWidth, H0 = img.naturalHeight, k = Math.min(1, 700 / Math.max(W0, H0, 1)), W = Math.max(8, Math.round(W0 * k)), H = Math.max(8, Math.round(H0 * k));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
    try { URL.revokeObjectURL(url); } catch {}
    const d = cx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
    for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    // beech ka 80% (kinare / haath / mez chhor do)
    const x0 = Math.round(W * 0.1), x1 = Math.round(W * 0.9), y0 = Math.round(H * 0.1), y1 = Math.round(H * 0.9); let s = 0, s2 = 0, n = 0;
    for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) { const i = y * W + x, v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W]; s += v; s2 += v * v; n++; }
    const mean = s / n, score = Math.round(s2 / n - mean * mean);
    return { score, blur: score < limit, W: W0, H: H0 };
  } catch { return { score: -1, blur: false }; }
}
export const blurText = r => r?.blur ? `⚠️ Dhundli (${r.score}) — dobara lein: bill par tap kar ke focus, haath na hile` : r?.score >= 0 ? `✓ Saaf (${r.score})` : '';
