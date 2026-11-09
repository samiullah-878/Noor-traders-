// naya-server.js — 🖥 NAYA SERVER JODO (v2.216.0, 2026-11-09) — SIRF malik, Settings se
// Malik: "Firestore mein aisi file rakhni chahiye — jab bhi download kar ke new server par lagayein to sab kuch wahan bhi chal jaye".
// PC pc-vault.js purane server ka taale wala backup pcVault/main likhta hai (sirf malik parh sakta). Naye PC par server-setup.ps1 →
// server-join.js 6 hindse ka code + apni ECDH public chaabi pcJoin/<uid> mein. Yahan: code → wohi PC chuno → backup SIRF us PC ki
// chaabi se band (ECDH P-256 → AES-GCM, code = AAD) → {box, iv, apub, st 'ok'} → PC khol kar st 'done'. Format = pc/server-join.js HUBAHU.
// AI NAHI.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const m = Math.round((Date.now() - Number(t)) / 60000); return !t ? '—' : m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 2880 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; };
const b64 = u8 => { let s = ''; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(String(s || '')), c => c.charCodeAt(0));
const CMD = 'irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/server-setup.ps1 | iex';
let cloud = null, notice = () => {}, unsub = null;

// --- crypto: pc/server-join.js ke openBox ka ulta (HUBAHU format) ---
export async function sealFor(pubB64, text, code) {
  const s = crypto.subtle;
  const mine = await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const pcPub = await s.importKey('raw', unb64(pubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const key = await s.deriveKey({ name: 'ECDH', public: pcPub }, mine.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const box = await s.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(String(code)) }, key, new TextEncoder().encode(text));
  return { box: b64(box), iv: b64(iv), apub: b64(await s.exportKey('raw', mine.publicKey)) };
}

function dlg() {
  let d = $('nsDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'nsDlg'; d.className = 'ns-dlg'; document.body.append(d); d.addEventListener('close', () => { try { unsub && unsub(); } catch {} unsub = null; }); }
  return d;
}
window.ntNsClose = () => { const d = $('nsDlg'); if (!d?.open) return false; d.close(); return true; };

export async function openNayaServer(o) {
  cloud = o.cloud; notice = o.notice || notice;
  const d = dlg(); d.innerHTML = '<div class="ns-body">⏳</div>'; if (!d.open) d.showModal();
  let vault = null, pcs = null;
  try { [vault, pcs] = await Promise.all([cloud.getPcVaultMeta(), cloud.getPcStatusOnce()]); } catch (e) { vault = { err: e?.message || String(e) }; }
  const vOk = vault && vault.at && vault.j;
  const oldFresh = pcs && pcs.at && Date.now() - Number(pcs.at) < 10 * 60000;
  d.innerHTML = `<div class="ns-head"><b>🖥 Naya server jodo</b><button type="button" class="ns-x" data-ns-x="1">×</button></div>
    <div class="ns-body">
      <div class="ns-card ${vOk ? 'ok' : 'bad'}">${vOk ? `💾 Purane server ka backup: <b>${esc(vault.host || '?')}</b> · ${ago(vault.at)}<br><small>${esc((vault.names || []).join(' · '))}</small>` : `✕ Backup abhi nahi bana${vault?.err ? ' (' + esc(vault.err) + ')' : ''} — purana server on ho to 3-5 min mein pehla backup (PC pc-vault)`}</div>
      <div class="ns-card ${oldFresh ? 'warn' : ''}">🖥 Purana server: <b>${esc(pcs?.host || '?')}</b> · aakhri saans ${ago(pcs?.at)}${oldFresh ? '<br><b>⚠ Abhi CHAL raha hai — naye ko chaabi dene se pehle is ko band karein, warna POS mein bill DO DAFA.</b>' : ''}</div>
      <ol class="ns-steps"><li>Naye PC par <b>PowerShell (Run as administrator)</b> mein ye EK line chalayein:<div class="ns-cmd"><code>${esc(CMD)}</code><button type="button" data-ns-copy="1">📋 Copy</button></div></li>
        <li>Wahan <b>6 hindse ka code</b> aayega — yahan likhein:</li></ol>
      <div class="ns-row"><input id="nsCode" inputmode="numeric" maxlength="7" placeholder="123 456" autocomplete="off"><button type="button" class="ns-go" data-ns-find="1">🔎 Dhoondo</button></div>
      <div id="nsList"></div>
    </div>`;
  d.onclick = ev => onClick(ev, vault, oldFresh);
}

async function onClick(ev, vault, oldFresh) {
  const d = $('nsDlg'), t = ev.target;
  if (t.closest('[data-ns-x]')) { d.close(); return; }
  if (t.closest('[data-ns-copy]')) { try { await navigator.clipboard.writeText(CMD); notice('📋 Copy ho gaya'); } catch { const c = d.querySelector('.ns-cmd code'); const r = document.createRange(); r.selectNodeContents(c); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } return; }
  const L = $('nsList');
  if (t.closest('[data-ns-find]')) {
    const code = String($('nsCode').value || '').replace(/\D/g, '');
    if (code.length !== 6) { L.innerHTML = '<p class="ns-err">6 hindse likhein</p>'; return; }
    L.innerHTML = '⏳';
    let rows = [];
    try { rows = (await cloud.findPcJoin(code)).filter(r => r.st === 'new' && Date.now() - Number(r.at) < 25 * 60000); } catch (e) { L.innerHTML = `<p class="ns-err">✕ ${esc(e?.message || e)}</p>`; return; }
    if (!rows.length) { L.innerHTML = '<p class="ns-err">Is code ka koi naya PC nahi mila — naye PC ki screen par code dobara dekhein (20 min tak chalta hai)</p>'; return; }
    L.innerHTML = rows.map(r => `<div class="ns-pc" data-id="${esc(r.id)}"><span>🖥 <b>${esc(r.host)}</b><small>${ago(r.at)}</small></span><button type="button" class="ns-go" data-ns-give="${esc(r.id)}" data-code="${code}" data-pub="${esc(r.pub)}">✅ Is PC ko do</button></div>`).join('');
    return;
  }
  const g = t.closest('[data-ns-give]'); if (!g) return;
  if (!(vault && vault.j)) { notice('Purane server ka backup abhi nahi hai'); return; }
  if (oldFresh && !g.dataset.sure) { g.dataset.sure = '1'; g.textContent = '⚠ Purana band kar diya — haan, do'; g.classList.add('warn'); return; }
  g.disabled = true; g.textContent = '⏳ band kar ke bhej raha…';
  try {
    const sealed = await sealFor(g.dataset.pub, vault.j, g.dataset.code);
    await cloud.sealPcJoin(g.dataset.nsGive, sealed);
    g.textContent = '⏳ Naya PC khol raha…';
    try { unsub && unsub(); } catch {}
    unsub = cloud.watchPcJoin(g.dataset.nsGive, r => {
      if (!r) return;
      if (r.st === 'done') { g.textContent = '✅ Naye PC ne chaabi le li'; g.classList.add('ok'); $('nsList').insertAdjacentHTML('beforeend', '<p class="ns-ok">✅ Ab naye PC par KHATA-DOCTOR khud chal raha hai — 5-10 min mein Settings → PC scripts mein nazar aayega. WhatsApp ke QR dobara jorne honge.</p>'); }
      else if (r.st === 'err') { g.textContent = '✕ Naye PC par taala nahi khula'; g.classList.add('bad'); g.disabled = false; }
    });
  } catch (e) { g.disabled = false; g.textContent = '✅ Is PC ko do'; notice('Nahi bheja: ' + (e?.message || e)); }
}
