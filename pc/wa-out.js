// =========================================================
//  wa-out.js  v1.0 (2026-11-07) — 📲 GAHAK KO WHATSAPP PARCHI (naya number, background se)
//  Malik (7 Nov 2026): "WhatsApp wala karna hai — wo ek NAYA number hai, Noor Traders ka business account; itne zyada client bhi nahi aate".
//
//  Dukan ka ALAG WhatsApp Business number (0329-… · malik ne chuna) PC par linked device (Baileys — wahi package wa-mods\ se jo
//  wa-parchi.js lagati hai; yeh script khud install NAHI karti). Asal dukan number (parchi parhne wala) is se alag rehta hai — ban ka
//  khatra asal number par nahi.
//  v1.1 (8 Nov): heartbeat juda na ho tab bhi (app ko zinda / band ka pata), hukum ka log.
//  v1.4 (9 Nov): job mein `rq` = pehle bheje job ka id → yeh paigham USI ke REPLY (quote) mein (malik: "poori list Mubeen ki photo ke reply mein").
//        Bheja hua paigham yaad (sentM, 200) — restart ke baad asal doc ka `wid` se quote; asal bheja hi na gaya = bina quote.
//  v1.5 (9 Nov): 🚚 DELIVERY (malik: "location bhejein to faasla naapo, aana-jana km · 30 km = 1 litre = Rs 400 → Rs 700 · pehle hum OK karenge · phir location
//        delivery boy ko"). Aane wale paigham mein SIRF location (locationMessage / liveLocationMessage) — aur sirf us gahak ki jise 24 ghante mein bill
//        gaya (wa-out-cust.json); baqi har paigham chhor (na parhna, na save). Dukan → gahak sarak ka faasla (OSRM muft, na mile = seedhi lakeer × 1.3 andaza),
//        aana-jana × petrol ÷ km fi litre × (1 + nafa%) → 50 ke qareeb (blueAccess/deliveryCfg) → deliveryReq/<id> + malik ko WhatsApp. Malik app mein ✅ OK
//        {st ok, fin} → gahak ko charges + delivery boy ko location (waOut `loc`) + Mubeen ko khabar. AI NAHI.
//  Kaam: pos-khata-sync.js har NAYI khata entry (jis gahak ke khate par 📲 tick + mobile) par waOut/<entryId> {st:'new'} likhti hai →
//  yeh script text paigham bhejti hai (har paigham ke beech GAP sec, din mein LIM se zyada nahi), st 'sent' / 'err' / 'skip' + wajah.
//  Aane wale paigham KABHI nahi parhti (sirf bhejna). Group / broadcast kabhi nahi. Number WhatsApp par na ho = skip (koshish nahi).
//  App: blueAccess/waLinkOut (haalat, QR / code, aaj ki ginti) · waCmdOut (hukum: code / link / relink / logout) · waOutCfg {on, lim, gap}
//       · waOutLog {L:[aakhri 60]} — sab yeh script likhti hai (waOutCfg malik). Lock 47842. Log: wa-out-log.txt
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
// v1.2 (8 Nov): .alive heartbeat (zinda.js) — doctor latki hui wa-out ko dobara chalaye (pehle .alive nahi tha: atka node 'zinda' dikhta, naya bat lock (3) par band, app mein 'PC chup')
const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
const { pathToFileURL } = require('url');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47842, VER = '1.6';
const MODS = path.join(DIR, 'wa-mods'), AUTH_DIR = path.join(DIR, 'wa-auth-out'), PKG = '@whiskeysockets/baileys';
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ${Math.round(ms / 1000)} sec mein nahi hua`)), ms); })]).finally(() => clearTimeout(t)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dayOf = t => new Date(Number(t) + 5 * 3600000).toISOString().slice(0, 10);   // Pakistan din
function normPh(x) {
  let s = String(x ?? '').trim(); if (!s) return '';
  if (s.includes('@')) s = s.split('@')[0].split(':')[0];
  let d = s.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);   // v1.6: 0092… / 00966… → country code se
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return d;
}
const isMob = p => /^03\d{9}$/.test(String(p || ''));
const isIntl = p => /^[1-9]\d{9,12}$/.test(String(p || '')) && !/^92/.test(String(p || ''));   // bahar ka number country code ke saath (Saudi 9665…, UAE 9715…) — malik 10 Nov: gahak 966553042418 ko paigham nahi gaya
const okPh = p => isMob(p) || isIntl(p);
const phPretty = p => isMob(p) ? p.slice(0, 4) + '-' + p.slice(4) : isIntl(p) ? '+' + p : String(p || '');
const jidOf = p => (isMob(p) ? '92' + String(p).slice(1) : String(p)) + '@s.whatsapp.net';
const DEF = { on: true, lim: 150, gap: 8 };
function cfgOf(d) { d = d || {}; return { on: d.on !== false, lim: Math.max(10, Math.min(500, Number(d.lim) || DEF.lim)), gap: Math.max(3, Math.min(60, Number(d.gap) || DEF.gap)) }; }
// v1.5: 🚚 delivery ka hisaab (malik ki misal: aana-jana 30 km, 1 litre = 30 km, petrol 400, nafa 75% → Rs 700)
const DLV_DEF = { on: true, pet: 400, kml: 30, naf: 75, min: 100, max: 80, gol: 50 };
function dlvCfgOf(d) {
  d = d || {}; const n = (k, lo, hi) => { const v = Number(d[k]); return Number.isFinite(v) && v >= lo && v <= hi ? v : DLV_DEF[k]; };
  const la = Number(d.shop && d.shop.lat), lo = Number(d.shop && d.shop.lng);
  return { on: d.on !== false, shop: Number.isFinite(la) && Number.isFinite(lo) && la && lo ? { lat: la, lng: lo } : null, pet: n('pet', 1, 5000), kml: n('kml', 1, 200), naf: n('naf', 0, 500), min: n('min', 0, 100000), max: n('max', 1, 2000), gol: n('gol', 1, 1000), boy: normPh(d.boy || '') };
}
function hav(a, b) { const r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); }
function dlvCalc(c, km) {
  const rt = Math.round(km * 2 * 10) / 10, cost = Math.round(rt / c.kml * c.pet), raw = cost * (1 + c.naf / 100);
  return { rt, cost, chg: Math.max(c.min, Math.ceil(raw / c.gol - 1e-9) * c.gol), far: rt > c.max };
}
module.exports = { normPh, isMob, jidOf, cfgOf, dlvCfgOf, dlvCalc, hav };
if (require.main === module) {
  const lock = net.createServer();
  lock.once('error', () => { console.log(`[${new Date().toLocaleTimeString()}] wa-out pehle se chal raha hai (lock 47842) — purana atka ho to doctor .alive dekh kar dobara chalata hai.`); process.exit(3); });
  lock.listen(LOCK_PORT, '127.0.0.1', () => main().catch(e => { log('❌ ' + (e.stack || e.message || e)); setTimeout(() => process.exit(1), 5000); }));
}

async function main() {
  log(`wa-out v${VER} shuru — gahak ko WhatsApp parchi (naya number)`);
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
  const db = getFirestore(), biz = db.collection('businesses').doc(BUSINESS_ID), BA = biz.collection('blueAccess'), Q = biz.collection('waOut');
  const LINK = BA.doc('waLinkOut');
  let L = { st: 'off', qr: '', code: '', me: '', err: '', cmd: 0, day: '', n: 0 }, lw = Promise.resolve(), lastW = 0;
  try { const x = await LINK.get(); if (x.exists) { const d = x.data() || {}; L.cmd = Number(d.cmd) || 0; L.me = String(d.me || ''); L.day = String(d.day || ''); L.n = Number(d.n) || 0; } } catch (e) { log('⚠️ waLinkOut: ' + e.message); }
  const setLink = p => { Object.assign(L, p || {}); L.at = Date.now(); L.host = os.hostname(); L.ver = VER; const snap = { ...L }; lastW = Date.now(); lw = lw.then(() => LINK.set(snap)).catch(e => log('⚠️ waLinkOut likha nahi: ' + e.message)); };
  let cfg = cfgOf(null);
  BA.doc('waOutCfg').onSnapshot(s => { cfg = cfgOf(s.exists ? s.data() : null); log(`⚙️ ${cfg.on ? 'chalu' : 'BAND'} · hadd ${cfg.lim}/din · faasla ${cfg.gap} s`); }, e => log('⚠️ waOutCfg: ' + e.message));

  // ---------- Baileys (wa-mods — wa-parchi.js install karti hai) ----------
  let B;
  try { B = await import(pathToFileURL(require.resolve(PKG, { paths: [MODS] })).href); }
  catch (e) { log('⏳ WhatsApp package (wa-mods) abhi nahi — wa-parchi.js lagati hai; 30 s baad dobara'); setLink({ st: 'off', err: 'PC par WhatsApp package abhi nahi (wa-parchi pehle chale)' }); setTimeout(() => process.exit(0), 5000); return; }
  const makeWASocket = B.default || B.makeWASocket;
  let pino = null; try { pino = require(require.resolve('pino', { paths: [MODS] })); } catch {}
  const quiet = { level: 'silent', trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return quiet; } };
  const logger = pino ? pino({ level: 'silent' }) : quiet;
  let version = null, sock = null, gen = 0, retry = 0, retryT = null, pair = '', pairAsked = false;
  const has = () => fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
  const wipe = () => { try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) { log('⚠️ wa-auth-out nahi mita: ' + e.message); } };
  const end = () => { gen++; clearTimeout(retryT); const x = sock; sock = null; try { x && x.end(undefined); } catch {} };
  async function connect(why) {
    end(); const my = gen;
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(AUTH_DIR);
    if (!version) { try { const v = await within(B.fetchLatestBaileysVersion(), 10000, 'WA version'); if (v && Array.isArray(v.version)) version = v.version; } catch {} }
    if (my !== gen) return;
    log(`📲 bhejne wala number jor raha hai (${why || 'shuru'})${state.creds.registered ? '' : ' — QR / code banega'}`);
    const s = makeWASocket({ auth: state, logger, browser: B.Browsers.windows('Chrome'), markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: j => !/@(s\.whatsapp\.net|lid)$/.test(String(j || '')), generateHighQualityLinkPreview: false, connectTimeoutMs: 30000, getMessage: async () => undefined, ...(version ? { version } : {}) });   // v1.5: group / status / channel kabhi nahi; 1:1 mein sirf location (onMsgs)
    sock = s;
    s.ev.on('creds.update', saveCreds);
    s.ev.on('messages.upsert', u => { if (my === gen && u && u.type === 'notify') onMsgs(u.messages, s).catch(e => log('⚠️ location: ' + e.message)); });
    s.ev.on('connection.update', u => { if (my === gen) onConn(u, s, state).catch(e => log('⚠️ link: ' + e.message)); });
  }
  async function onConn(u, s, state) {
    if (u.qr && pair) {
      if (!pairAsked) { pairAsked = true; try { const code = String(await within(s.requestPairingCode(pair), 20000, 'pairing code') || '').toUpperCase(); setLink({ st: 'code', qr: '', code: code.length === 8 ? code.slice(0, 4) + '-' + code.slice(4) : code, codeFor: '0' + pair.slice(2), err: '' }); log('🔢 pairing code app mein'); } catch (e) { setLink({ st: 'error', err: 'Code nahi bana: ' + String(e.message).slice(0, 100) }); } }
    } else if (u.qr) { setLink({ st: 'qr', qr: u.qr, code: '', err: '' }); log('🔳 naya QR — app ⚙️ mein'); }
    if (u.connection === 'open') { retry = 0; pair = ''; L.code = ''; const me = normPh((s.user && s.user.id) || ''); setLink({ st: 'open', qr: '', me, err: '' }); log(`🟢 bhejne wala number jur gaya — ${phPretty(me)}`); kick(); }
    if (u.connection !== 'close') return;
    const code = Number(u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode) || 0, R = B.DisconnectReason;
    end();
    if (code === R.loggedOut) { log('🔴 link hat gaya (logout)'); wipe(); setLink({ st: 'off', qr: '', me: '', err: 'Link hat gaya — dobara jorna ho to 🔢 Code / 🔳 QR' }); return; }
    if (code === R.restartRequired) { connect('jorne ke baad').catch(e => log('⚠️ ' + e.message)); return; }
    if (!state.creds.registered) { const wasCode = !!pair; pair = ''; setLink({ st: 'off', qr: '', code: '', err: (wasCode ? 'Code' : 'QR') + ' ka waqt khatam — dobara dabayein' }); return; }
    if (code === R.connectionReplaced) { setLink({ st: 'error', qr: '', err: 'Yahi link kisi aur jagah bhi chal raha hai — 10 min baad dobara' }); retryT = setTimeout(() => connect('replaced').catch(() => {}), 10 * 60000); return; }
    const wait = [2, 5, 10, 30, 60, 120, 300][Math.min(retry++, 6)];
    setLink({ st: 'closed', qr: '', err: `Rabta toota (${code || '?'}) — ${wait} sec mein dobara` }); log(`🟠 rabta toota (${code || '?'}) — ${wait} sec`);
    retryT = setTimeout(() => connect('dobara').catch(e => log('⚠️ ' + e.message)), wait * 1000);
  }
  async function doCmd(c, ph) {
    log('🔗 app ka hukum: ' + c);
    if (c === 'link' && sock && L.st === 'open') { setLink({}); return; }
    if (c === 'code') {
      if (!isMob(ph || '')) { setLink({ st: 'error', err: 'Number ghalat — 03xx-xxxxxxx' }); return; }
      if (sock && L.st === 'open') { try { await within(sock.logout(), 15000, 'logout'); } catch {} }
      end(); wipe(); pair = '92' + ph.slice(1); pairAsked = false;
      setLink({ st: 'off', qr: '', code: '', me: '', err: 'Code ban raha hai…' });
      await connect('app: code'); return;
    }
    pair = ''; pairAsked = false;
    if (c !== 'link' || !has()) { if (sock && L.st === 'open' && c !== 'link') { try { await within(sock.logout(), 15000, 'logout'); } catch {} } end(); if (c !== 'link') wipe(); }
    setLink({ st: 'off', qr: '', me: c === 'link' ? L.me : '', err: c === 'logout' ? '' : 'Jor raha hai / naya QR…' });
    if (c === 'logout') return;
    await connect('app: ' + c);
  }
  BA.doc('waCmdOut').onSnapshot(x => {
    if (!x.exists) return; const d = x.data() || {}, at = Number(d.at) || 0, c = String(d.do || '');
    log(`📨 waCmdOut: ${c} at=${at} (pehle ${L.cmd})`);
    if (!at || at === L.cmd || !/^(relink|logout|link|code)$/.test(c)) return;
    const age = Date.now() - (x.updateTime ? x.updateTime.toMillis() : at);
    L.cmd = at; setLink({});
    if (age > 10 * 60000) return;
    doCmd(c, normPh(d.ph || '')).catch(e => { log('⚠️ hukum: ' + e.message); setLink({ st: 'error', err: String(e.message).slice(0, 140) }); });
  }, e => log('⚠️ waCmdOut: ' + e.message));

  // ---------- 📤 bhejna — queue (waOut st 'new'), ek waqt ek, beech mein GAP ----------
  const LOGD = BA.doc('waOutLog');
  let logL = null, lgw = Promise.resolve();
  async function addLog(row) {
    if (!logL) { try { const s = await LOGD.get(); logL = (s.exists && Array.isArray(s.data().L)) ? s.data().L : []; } catch { logL = []; } }
    logL = logL.concat([row]).slice(-60);
    const snap = logL.slice(); lgw = lgw.then(() => LOGD.set({ L: snap, at: Date.now() })).catch(e => log('⚠️ waOutLog: ' + e.message));
  }
  const pend = new Map(); let busy = false, busyAt = 0, lastSent = 0;
  // ---------- v1.5: 🚚 DELIVERY ----------
  const CUST_F = path.join(DIR, 'wa-out-cust.json'), DQ = biz.collection('deliveryReq');
  let CU = {}; try { CU = JSON.parse(fs.readFileSync(CUST_F, 'utf8')) || {}; } catch {}
  const custSave = () => { const lim = Date.now() - 26 * 3600000; for (const k of Object.keys(CU)) if (!(Number(CU[k].at) > lim)) delete CU[k]; try { fs.writeFileSync(CUST_F, JSON.stringify(CU)); } catch {} };
  let dcfg = dlvCfgOf(null), WP = { mk: '03450412515', mb: '03462901193' };
  BA.doc('deliveryCfg').onSnapshot(s => { dcfg = dlvCfgOf(s.exists ? s.data() : null); log(`🚚 delivery ${dcfg.on ? 'chalu' : 'BAND'} · dukan ${dcfg.shop ? 'set' : 'NAHI set'} · petrol ${dcfg.pet} · ${dcfg.kml} km/litre · nafa ${dcfg.naf}% · boy ${dcfg.boy ? phPretty(dcfg.boy) : '—'}`); }, e => log('⚠️ deliveryCfg: ' + e.message));
  BA.doc('waParchi').onSnapshot(s => { const d = (s.exists && s.data()) || {}; const f = Array.isArray(d.prFrom) ? d.prFrom.map(normPh).filter(isMob) : [], t = Array.isArray(d.prTo) ? d.prTo.map(normPh).filter(isMob) : []; WP = { mk: f[0] || '03450412515', mb: t[0] || '03462901193' }; }, e => log('⚠️ waParchi: ' + e.message));
  const bareJ = j => String(j || '').split('@')[0].split(':')[0];
  async function fromNum(m, s) {
    const k = m.key || {};
    for (const j of [k.remoteJidAlt, k.senderPn, k.remoteJid]) if (j && /@s\.whatsapp\.net$/.test(j)) return normPh(j);
    const lid = [k.remoteJid, k.remoteJidAlt].find(j => j && /@lid$/.test(j)); if (!lid) return '';
    try { const pn = await s.signalRepository.lidMapping.getPNForLID(lid); if (pn) return normPh(pn); } catch {}
    for (const pn of Object.keys(CU)) { try { const l2 = await s.signalRepository.lidMapping.getLIDForPN(jidOf(pn)); if (l2 && bareJ(l2) === bareJ(lid)) return pn; } catch {} }
    return '';
  }
  async function onMsgs(ms, s) {
    for (const m of ms || []) {
      try {
        if (!m || !m.key || m.key.fromMe || !m.message) continue;
        let c = m.message; c = (c.ephemeralMessage && c.ephemeralMessage.message) || (c.viewOnceMessage && c.viewOnceMessage.message) || c;
        const lo = c.locationMessage || c.liveLocationMessage; if (!lo) continue;   // SIRF location — baqi har paigham chhoro
        const lat = Number(lo.degreesLatitude), lng = Number(lo.degreesLongitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) continue;
        const num = await fromNum(m, s), cu = num ? CU[num] : null;
        if (!cu || Date.now() - Number(cu.at) > 24 * 3600000) { log(`📍 location aayi — ${num ? phPretty(num) : 'anjaan number'} ko 24 ghante mein bill nahi gaya, chhor di`); continue; }
        if (!dcfg.on) { log('📍 delivery BAND (setting) — location chhor di'); continue; }
        await dlvNew(num, cu, lat, lng, String(lo.name || lo.address || '').slice(0, 120), !!c.liveLocationMessage);
      } catch (e) { log('⚠️ location: ' + e.message); }
    }
  }
  async function roadKm(a, b) {   // OSRM (OpenStreetMap, muft) — na mile = seedhi lakeer × 1.3 (andaza)
    try {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 12000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: ac.signal, headers: { 'User-Agent': 'NoorTraders-BlueKhata/1.0' } }).finally(() => clearTimeout(tm));
      const j = await r.json(), mt = Number(j && j.routes && j.routes[0] && j.routes[0].distance);
      if (r.ok && mt > 0) return { km: Math.round(mt / 100) / 10, how: 'road' };
    } catch (e) { log('🗺 raasta nahi mila (andaza lagaya): ' + e.message); }
    return { km: Math.round(hav(a, b) * 1.3 * 10) / 10, how: 'line' };
  }
  const qPut = (id, x) => Q.doc(id).create({ st: 'new', at: Date.now(), eid: id, ...x }).catch(e => { if (!/already exists/i.test(String(e.message))) log('⚠️ waOut ' + id + ': ' + e.message); });
  async function dlvNew(num, cu, lat, lng, place, live) {
    const id = 'dl-' + String(cu.eid || num).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60), ref = DQ.doc(id);
    const old = await ref.get(), od = old.exists ? old.data() : null;
    if (od && od.st !== 'new') { log(`📍 ${phPretty(num)}: delivery pehle hi ${od.st} — nayi location chhor di`); return; }
    if (od && Math.abs(Number(od.lat) - lat) < 0.0005 && Math.abs(Number(od.lng) - lng) < 0.0005) return;   // wohi jagah (live location baar baar)
    if (od && live && Date.now() - (Number(od.upd) || 0) < 10 * 60000) return;   // live location: 10 min mein ek dafa se zyada nahi
    const sh = dcfg.shop; let km = null, how = '', cl = null;
    if (sh) { const r = await roadKm(sh, { lat, lng }); km = r.km; how = r.how; cl = dlvCalc(dcfg, km); }
    const now = Date.now();
    await ref.set({ to: num, nm: cu.nm || '', bn: cu.bn || '', eid: cu.eid || '', lat, lng, place, live: live ? 1 : 0, km, how, rt: cl ? cl.rt : null, cost: cl ? cl.cost : null, chg: cl ? cl.chg : null, far: cl && cl.far ? 1 : 0,
      pet: dcfg.pet, kml: dcfg.kml, naf: dcfg.naf, st: 'new', at: od ? Number(od.at) || now : now, upd: now });
    log(`🚚 delivery darkhwast ${phPretty(num)} ${cu.nm || ''}: ${cl ? km + ' km (' + how + ') · aana-jana ' + cl.rt + ' · kharcha ' + cl.cost + ' → Rs ' + cl.chg : 'dukan ki jagah set nahi'}`);
    const map = `https://maps.google.com/?q=${lat},${lng}`;
    if (!od || !live) await qPut('dn-' + id + '-' + now, { to: WP.mk, nm: 'Malik', kind: 'dlv', txt: `🚚 *Delivery ki darkhwast*${od ? ' (nayi location)' : ''}\n${cu.nm ? cu.nm + ' · ' : ''}${phPretty(num)}${cu.bn ? ' · Bill #' + cu.bn : ''}\n`
      + (cl ? `Faasla ${km} km${how === 'line' ? ' (andaza)' : ''} · aana-jana ${cl.rt} km\nPetrol Rs ${cl.cost} → *Charges Rs ${cl.chg}*${cl.far ? '\n⚠ Zyada door' : ''}\n` : '⚠ Dukan ki jagah app mein set nahi — faasla nahi naapa\n') + `📍 ${map}\nApp ☰ 🚚 Delivery mein ✅ OK karein` });
    if (!od) await qPut('da-' + id, { to: num, nm: cu.nm || '', kind: 'dlva', txt: '*NOOR TRADERS*\n📍 Aap ki location mil gayi — delivery charges thori der mein batate hain 🙏' });
  }
  const dDone = new Set();
  async function dlvOk(snap) {
    const d = snap.data() || {}, id = snap.id; if (d.sent || dDone.has(id)) return; dDone.add(id);
    if (Date.now() - (Number(d.okAt) || 0) > 6 * 3600000) return;   // purana OK — dobara nahi
    const fin = Math.max(0, Math.round(Number(d.fin) || 0)), rs = 'Rs ' + fin.toLocaleString('en-US'), map = `https://maps.google.com/?q=${d.lat},${d.lng}`, boy = isMob(dcfg.boy) ? dcfg.boy : '';
    const jobs = [];
    if (okPh(d.to)) jobs.push(['dc-' + id, { to: d.to, nm: d.nm || '', kind: 'dlvc', txt: `*NOOR TRADERS* 🚚\nAap ki delivery${d.km != null ? ' (faasla ' + d.km + ' km)' : ''}\nDelivery charges: *${rs}*\nSaman jaldi aap tak pohanch jayega. Bohat shukria 🙏` }]);
    if (boy) {
      jobs.push(['db-' + id, { to: boy, nm: 'Delivery boy', kind: 'dlvb', loc: { lat: Number(d.lat), lng: Number(d.lng), name: `${d.nm || 'Gahak'} · ${rs}`, adr: `${phPretty(d.to)}${d.bn ? ' · Bill #' + d.bn : ''}` } }]);
      jobs.push(['dt-' + id, { to: boy, nm: 'Delivery boy', kind: 'dlvb', txt: `🚚 *Delivery*\n${d.nm ? d.nm + ' · ' : ''}${phPretty(d.to)}${d.bn ? '\nBill #' + d.bn : ''}\nCharges: ${rs} (gahak se lena)${d.km != null ? '\nFaasla ' + d.km + ' km' : ''}\n📍 ${map}` }]);
    }
    if (isMob(WP.mb)) jobs.push(['dm-' + id, { to: WP.mb, nm: 'Mubeen', kind: 'dlvm', txt: `🚚 Delivery OK: ${d.nm || phPretty(d.to)}${d.bn ? ' · Bill #' + d.bn : ''} · ${rs}${boy ? ' · location delivery boy ko chali gayi' : ''}` }]);
    const now = Date.now();
    for (let k = 0; k < jobs.length; k++) { const [jid, x] = jobs[k]; await Q.doc(jid).create({ st: 'new', at: now + k, eid: jid, ...x }).catch(e => { if (!/already exists/i.test(String(e.message))) log('⚠️ waOut ' + jid + ': ' + e.message); }); }
    await snap.ref.set({ sent: now, boyOk: boy ? 1 : 0 }, { merge: true });
    log(`🚚 delivery OK ${phPretty(d.to)} · ${rs} → gahak${boy ? ' + delivery boy' : ' (delivery boy ka number nahi)'}`);
  }
  DQ.where('st', '==', 'ok').onSnapshot(s => { s.docChanges().forEach(ch => { if (ch.type !== 'removed') dlvOk(ch.doc).catch(e => log('⚠️ delivery OK: ' + e.message)); }); }, e => log('⚠️ deliveryReq: ' + e.message));
  const sentM = new Map();   // v1.4: jobId → bheja hua WAMessage (rq wale reply ke liye)
  Q.where('st', '==', 'new').onSnapshot(s => { for (const ch of s.docChanges()) { if (ch.type === 'removed') pend.delete(ch.doc.id); else pend.set(ch.doc.id, ch.doc.data() || {}); } kick(); }, e => log('⚠️ waOut: ' + e.message));
  function kick() { if (!busy) work().catch(e => { busy = false; log('⚠️ bhejna: ' + e.message); }); }
  async function work() {
    busy = true; busyAt = Date.now();
    try {
      while (pend.size) {
        busyAt = Date.now();   // v1.3: har job par taza — lambi queue 'atki' na lage
        const [id, d] = [...pend.entries()].sort((a, b) => (Number(a[1].at) || 0) - (Number(b[1].at) || 0))[0];
        const done = async (st, why, extra) => { pend.delete(id); try { await Q.doc(id).set({ st, why: String(why || '').slice(0, 140), sentAt: Date.now(), ...(d.im ? { im: FieldValue.delete(), hadIm: 1 } : {}), ...(d.au ? { au: FieldValue.delete(), hadAu: 1 } : {}), ...(extra || {}) }, { merge: true }); } catch (e) { log('⚠️ waOut ' + id + ': ' + e.message); } };
        const day = dayOf(Date.now()); if (L.day !== day) { L.day = day; L.n = 0; }
        const to = normPh(d.to), nm = String(d.nm || '').slice(0, 40), txt = String(d.txt || '').trim();
        if (!cfg.on) { await done('skip', 'band hai (setting)'); continue; }
        if (Number(d.at) && Date.now() - Number(d.at) > 6 * 3600000) { await done('skip', 'purana (6 ghante+)'); continue; }
        if (!okPh(to) || (!txt && !d.au && !d.loc)) { await done('err', !okPh(to) ? 'mobile number ghalat' : 'paigham khali'); continue; }
        if (L.n >= cfg.lim) { log(`⏸ aaj ki hadd ${cfg.lim} poori — baqi kal`); setLink({ err: `Aaj ki hadd ${cfg.lim} poori — baqi kal` }); break; }   // queue mein rahe (st new)
        if (!sock || L.st !== 'open') { break; }   // jur jaye to kick()
        const gap = cfg.gap * 1000 - (Date.now() - lastSent); if (gap > 0) await sleep(gap);
        if (!sock || L.st !== 'open') break;
        try {
          const chk = await within(sock.onWhatsApp(jidOf(to)), 15000, 'number check');
          const okNo = Array.isArray(chk) && chk[0] && chk[0].exists;
          if (!okNo) { await done('skip', 'yeh number WhatsApp par nahi'); await addLog({ at: Date.now(), to, nm, code: String(d.code || ''), st: 'skip', why: 'WhatsApp par nahi' }); continue; }
          const jid = (chk[0] && chk[0].jid) || jidOf(to);
          const im = d.im && (Buffer.isBuffer(d.im) ? d.im : d.im.toUint8Array ? Buffer.from(d.im.toUint8Array()) : null);   // v1.0: bill ki tasveer (Bytes) ho to tasveer + caption
          const au = d.au && (Buffer.isBuffer(d.au) ? d.au : d.au.toUint8Array ? Buffer.from(d.au.toUint8Array()) : null);   // 🔊 awaz (mp3) — Urdu TTS
          let quoted = null;
          if (d.rq) {   // v1.4: reply mein — pehle yaad se, warna asal doc ka wid
            quoted = sentM.get(String(d.rq)) || null;
            if (!quoted) { try { const ps0 = await within(Q.doc(String(d.rq)).get(), 10000, 'reply ka asal'); const pd = ps0.exists ? ps0.data() : null; if (pd && pd.st === 'sent' && pd.wid) quoted = { key: { remoteJid: jid, fromMe: true, id: String(pd.wid) }, message: { conversation: String(pd.txt || '').slice(0, 300) } }; } catch {} }
          }
          const lc = d.loc && Number.isFinite(Number(d.loc.lat)) && Number.isFinite(Number(d.loc.lng)) ? { location: { degreesLatitude: Number(d.loc.lat), degreesLongitude: Number(d.loc.lng), name: String(d.loc.name || '').slice(0, 80), address: String(d.loc.adr || '').slice(0, 120) } } : null;   // v1.5: delivery boy ko location
          const r = await within(sock.sendMessage(jid, lc || (im && im.length ? { image: im, caption: txt, mimetype: 'image/jpeg' } : au && au.length ? { audio: au, mimetype: 'audio/mpeg', ptt: false } : { text: txt }), quoted ? { quoted } : {}), 60000, 'bhejna');
          lastSent = Date.now(); L.n++;
          if (r && r.key) { sentM.set(id, r); if (sentM.size > 200) sentM.delete(sentM.keys().next().value); }
          if (d.kind === 'bill') { CU[to] = { at: Date.now(), nm, bn: String(d.bn || ''), eid: id }; custSave(); }   // v1.5: is gahak ki location 24 ghante tak
          await done('sent', '', { wid: String((r && r.key && r.key.id) || '') });
          await addLog({ at: Date.now(), to, nm, code: String(d.code || ''), st: 'sent' });
          setLink({ n: L.n, day, last: { at: Date.now(), to: phPretty(to), nm }, err: '' });
          log(`📤 ${phPretty(to)} ${nm} · ${String(d.code || d.kind || '')}${im ? ' 🖼' : au ? ' 🔊' : ''} (aaj ${L.n}/${cfg.lim})`);
        } catch (e) {
          const why = String(e.message || e).slice(0, 120); log(`✕ ${phPretty(to)}: ${why}`);
          const tries = (Number(d.tries) || 0) + 1;
          if (tries < 3 && /nahi hua|timed? ?out|closed|socket/i.test(why)) { pend.set(id, { ...d, tries }); try { await Q.doc(id).set({ tries }, { merge: true }); } catch {} await sleep(20000); }   // 2 dafa dobara
          else { await done('err', why, { tries }); await addLog({ at: Date.now(), to, nm, code: String(d.code || ''), st: 'err', why }); }
        }
      }
    } finally { busy = false; }
  }

  setInterval(() => { if (Date.now() - lastW > 5 * 60000) setLink({}); }, 60000);   // app ko pata rahe PC zinda — v1.1: juda na ho tab bhi (warna app mein '54 min pehle' aur pata nahi chal raha / band)
  setInterval(kick, 30000);
  // v1.3 (8 Nov — 10:57 ke baad kuch nahi gaya, heartbeat theek, app mein "juda"): (1) 📡 har 30 s Firestore se 'new' jobs khud bhi parho (onSnapshot chup ho jaye to bhi
  //   queue bhare) · (2) ⏱ bhejne wala 4 min se atka (busy) = dobara shuru (bat loop / doctor) — khamosh atakna kabhi nahi.
  setInterval(async () => {
    if (busy && Date.now() - busyAt > 4 * 60000) { log('⚠️ bhejne wala 4 min se atka hua — dobara shuru'); setLink({ err: 'bhejne wala atka tha — dobara shuru' }); setTimeout(() => process.exit(2), 1500); return; }
    try { const s = await within(Q.where('st', '==', 'new').limit(50).get(), 20000, 'queue parhna'); let add = 0; s.forEach(d => { if (!pend.has(d.id)) { pend.set(d.id, d.data() || {}); add++; } }); if (add) { log(`📡 queue se ${add} naya job (poll)`); kick(); } }
    catch (e) { log('⚠️ queue poll: ' + e.message); }
  }, 30000);
  if (has()) await connect('shuru'); else setLink({ st: 'off', qr: '', err: '' });
}
