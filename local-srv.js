// local-srv.js (v2.114.4) — 📡 Local server jaanch: internet na ho to dukaan ke WiFi par laptop (pc/nt-local.js) se baat.
// Update 1: sirf jaanch — laptop mila? POS database jura? Chrome ijazat de raha hai? (POS mein kuch nahi likhta)
const KEY = 'nt-local-ip', PORT = 47900, DEF = '192.168.1.108';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getIp = () => { try { return localStorage.getItem(KEY) || DEF } catch { return DEF } };
const setIp = v => { try { localStorage.setItem(KEY, v) } catch {} };

export async function localPing(ip = getIp(), ms = 6000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms), t0 = performance.now();
  try {
    const u = `http://${ip}:${PORT}/ping?t=${Date.now()}`;
    // Chrome (Local network access): 'local' batana zaroori; ghalat jagah (jaise loopback) par fail ho to bina is ke dobara
    const r = await fetch(u, { cache: 'no-store', signal: ctl.signal, targetAddressSpace: 'local' }).catch(e => { if (e?.name === 'AbortError') throw e; return fetch(u, { cache: 'no-store', signal: ctl.signal }) });
    const j = await r.json();
    return { ok: !!j.ok, ms: Math.round(performance.now() - t0), j };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t0), err: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) };
  } finally { clearTimeout(t) }
}

const line = (ok, t) => `<div class="ls-line ${ok === true ? 'ls-ok' : ok === false ? 'ls-bad' : ''}">${ok === true ? '✅' : ok === false ? '❌' : '⏳'} ${t}</div>`;

export function localSrvOpen(modal) {
  modal('📡 Local server jaanch', `<div class="set-wrap" data-ls-root="1">
<p class="set-sub">Internet na ho to app dukaan ke WiFi par <b>laptop</b> se kaam chalayegi. Pehle yahan jaanch karein — router ka net cable nikal kar bhi.</p>
<label class="ls-ip">Laptop ka IP<input id="lsIp" inputmode="decimal" value="${esc(getIp())}"></label>
<div class="account-tools"><button type="button" id="lsGo">📡 Abhi jaanch</button><a class="ls-open" id="lsOpen" target="_blank" rel="noopener">🌐 Seedha kholo</a></div>
<div id="lsOut" role="status"></div>
<p class="set-sub ls-foot">Internet: <b>${navigator.onLine ? 'chal raha hai' : 'NAHI hai'}</b> · Ye jaanch AI ke baghair hai.</p></div>`);
  const out = document.getElementById('lsOut'), ipIn = document.getElementById('lsIp'), open = document.getElementById('lsOpen');
  const syncOpen = () => { open.href = `http://${ipIn.value.trim()}:${PORT}/` };
  syncOpen(); ipIn.oninput = syncOpen;
  const go = async () => {
    const ip = ipIn.value.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { out.innerHTML = line(false, 'IP theek likhein (jaise 192.168.1.108)'); return }
    setIp(ip); out.innerHTML = line(null, 'Laptop dhoond rahe hain…');
    const r = await localPing(ip);
    if (!document.querySelector('[data-ls-root]')) return;
    if (!r.ok) {
      out.innerHTML = line(false, `Laptop se jawab nahi aaya (${esc(r.err)})`) + `<div class="ls-help"><b>Ye dekhein:</b><br>1) Laptop on hai aur "NT Local Server" setup ho chuka hai?<br>2) Ye phone dukaan ke usi WiFi par hai?<br>3) <b>🌐 Seedha kholo</b> dabayein — wahan "✅ NT Local Server chal raha hai" aaye magar yahan ❌ ho to Chrome rok raha hai: Chrome → ⋮ → Settings → Site settings → <b>Local network access</b> → is app ko <b>Allow</b>. Chrome "dukaan ke network ke devices" ki ijazat maange to <b>Allow</b> dabayein.</div>`;
      return;
    }
    const j = r.j, s = j.sql || {};
    out.innerHTML = line(true, `Laptop mil gaya: <b>${esc(j.host)}</b> · v${esc(j.ver)} · ${r.ms} ms`) +
      (s.ok ? line(true, `POS database jura hua · ${esc(s.items)} items · ${esc(s.ms)} ms`) : line(false, `POS database nahi juda: ${esc(s.err || '?')}`)) +
      `<p class="set-sub">${s.ok ? '🎉 Ye tareeqa is phone par chal raha hai. Router ka net cable nikal kar dobara jaanch karein.' : 'Laptop mil gaya magar server PC ka database nahi — server PC on hai? Malik ko screenshot bhejein.'}</p>`;
  };
  document.getElementById('lsGo').onclick = go;
  go();
}
