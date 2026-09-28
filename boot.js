// boot.js — app ko jaldi kholta hai, aur na khule to wajah batata / khud theek karta hai (v211).
// Firebase SDK (bara) saath saath peeche load hota hai; service worker dusri dafa se sab phone se deta hai.
const V = '12.18.0', base = `https://www.gstatic.com/firebasejs/${V}/`;
// App ki zaroori files. Nayi file bane to yahan bhi likhein.
const FILES = ['app.js', 'core.js', 'auth.js', 'data.js', 'ui.js', 'owner.js', 'staffview.js', 'manager.js', 'pdf.js', 'breaks.js', 'tickets.js', 'notify.js', 'push.js', 'firebase-config.js', 'styles.css'];
const HEAL_KEY = 'nt-hazri-heal-at';

async function start() {
  const sdkPromise = Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')])
    .then(([app, auth, firestore]) => ({ ...app, ...auth, ...firestore }));
  let mod, cfg;
  try { [mod, cfg] = await Promise.all([import('./app.js'), import('./firebase-config.js')]); }
  catch (error) { return fail(error); }
  mod.startApp({ firebaseConfig: cfg.firebaseConfig, sdkPromise });
  try { sessionStorage.removeItem(HEAL_KEY); } catch { /* ignore */ }
}

async function fail(error) {
  console.error('boot', error);
  const msg = html => window.__ntBootMsg?.(html);
  if (navigator.onLine === false) { msg('Internet band hai. Internet on kar ke dobara kholein.<br><button type="button" onclick="location.reload()" class="btn btn-ghost" style="margin-top:12px">Dobara kholein</button>'); return; }
  msg('App ki files check ho rahi hain…');
  // Konsi file GitHub par nahi mili? (?nocache = service worker ki purani copy nahi, seedha internet)
  const missing = [];
  await Promise.all(FILES.map(f => fetch(`./${f}?nocache=${Date.now()}`, { cache: 'no-store' }).then(r => { if (r.status === 404) missing.push(f); }).catch(() => {})));
  if (missing.length) {
    msg(`<b>Ye file GitHub par nahi mili:</b><br>${missing.join(', ')}<br><small>Malik: ye file(s) GitHub par upload karein, phir app dobara kholein.</small><br><button type="button" onclick="window.__ntRepair()" class="btn btn-ghost" style="margin-top:12px">Dobara kholein</button>`);
    return;
  }
  // Files sab hain -> shayad phone mein purani copy atki hai: aik dafa khud saaf kar ke kholo
  let last = 0; try { last = Number(sessionStorage.getItem(HEAL_KEY) || 0); } catch { /* ignore */ }
  if (Date.now() - last > 120000) { try { sessionStorage.setItem(HEAL_KEY, String(Date.now())); } catch { /* ignore */ } msg('Purani copy saaf ho rahi hai…'); window.__ntRepair?.(); return; }
  msg(`App khul nahi saki.<br><small>${String(error?.message || error).replace(/[<>&]/g, '').slice(0, 160)}</small><br><button type="button" onclick="window.__ntRepair()" class="btn btn-ghost" style="margin-top:12px">Taza kholein</button>`);
}
start();
