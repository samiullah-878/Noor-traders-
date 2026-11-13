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
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47842, VER = '1.18';
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
  const pend = new Map(); let busy = false, busyAt = 0, lastSent = 0, lastFast = 0; const jidOk = new Map();
  const isFast = d => { try { return !!((KHW && KHW.who && KHW.who(normPh(d.to))) || (d && d.kind === 'gate')); } catch { return false; } };   // v1.15 (13 Nov, malik: 'WhatsApp ke jawab mein time lag raha hai'): apne (malik / Mubeen / jure) number = line mein aage, gahak wala faasla nahi
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
  // v1.7 (12 Nov): 🔢 KHARCHA WHATSAPP SE — ijazat wale number (kh-wa.js: malik / Mubeen / khWa.allow) ka paigham jo 3 hindson se shuru ho. Baqi har paigham pehle jaisa chhor diya jata hai (na parha, na log).
  let KHW = null; try { KHW = require('./kh-wa.js')({ biz, log }); if (KHW.startRem) KHW.startRem(); } catch (e) { log('⚠️ kh-wa.js nahi chala: ' + e.message); }   // v1.13: 🔔 roz ke reminder isi service se (ek hi jagah)
  // v1.18 (13 Nov, malik: "gate pass ka system bhi WhatsApp par · item name, bill number · 1 de diya · 2 nahi diya · sirf wohi numbers jo main joron · sab godam"):
  //   🚪 GATE PASS — gatePass/<SaleID> (gate-pass.js likhta hai) POSTED hote hi (ps 2, off nahi, post ON ke baad + 3 ghante ke andar) blueAccess/gpWa.nums ke har number ko
  //   waOut gp-<SaleID>-<number> (create = dohra kabhi nahi). Jawab SIRF usi paigham par REPLY mein '1' / '2', SIRF unhi numbers se: 1 = har baqi line g.<k> {n, q, t} (app ki tick jaisa) ·
  //   2 = nd {n, t} + malik ko khabar. Cancel / un-post = gpx- '⛔ maal mat dein'. Kisi aur number / kisi aur paigham ko yeh hissa nahi chhoota.
  const GP = biz.collection('gatePass'); let gpw = { on: false, since: 0, nums: [] }, gpMalik = '03450412515', gpStop = null, gpDay = '';
  const gpSent = new Set(), gpOffd = new Set();
  const gpPut = (id, x) => Q.doc(id).create({ st: 'new', at: Date.now(), eid: id, ...x }).catch(e => { if (!/already exists/i.test(String(e.message))) log('⚠️ waOut ' + id + ': ' + e.message); });
  const gpNo = d => String((d && d.no) || '').replace(/^0+/, '') || '?';
  const gpNum = n => String(Math.round((Number(n) || 0) * 1000) / 1000);
  const gpQty = (q, pk) => { q = Number(q) || 0; pk = Number(pk) || 0; if (pk > 1) { const c = Math.floor(q / pk + 1e-9), p = Math.round((q - c * pk) * 1000) / 1000; return c && p ? `${gpNum(c)} ctn + ${gpNum(p)} pcs` : c ? `${gpNum(c)} ctn` : `${gpNum(p)} pcs`; } return `${gpNum(q)} pcs`; };
  function gpText(d) {
    const L = Array.isArray(d.l) ? d.l : [], gn = d.gn || {}, by = new Map();
    for (const x of L) { const g = String(x.g == null ? '' : x.g); if (!by.has(g)) by.set(g, []); by.get(g).push(x); }
    let t = `🚪 *Gate pass #${gpNo(d)}*\n👤 ${String(d.p || 'Customer').slice(0, 60)}`;
    for (const [g, ls] of by) { t += `\n\n🏬 *${String(gn[g] || ('Godam ' + g)).slice(0, 40)}*`; for (const x of ls) t += `\n• ${String(x.n || '?').slice(0, 60)} — *${gpQty(x.q, x.pk)}*`; }
    return t + '\n\nIsi paigham par *reply* mein likhein:\n*1* = de diya\n*2* = nahi diya';
  }
  async function gpDoc(id, d) {
    try {
      if (!gpw.on || !gpw.nums.length || !d) return;
      if (d.off || Number(d.ps) !== 2) {   // cancel / un-post — sirf jis ka paigham ja chuka
        if (!gpSent.has(id) || gpOffd.has(id)) return; gpOffd.add(id);
        for (const a of gpw.nums) await gpPut(`gpx-${id}-${a.p}-${Number(d.at) || 0}`, { to: a.p, nm: a.n, kind: 'gate', txt: `⛔ *Gate pass #${gpNo(d)}* ${d.off ? 'CANCEL' : 'UN-POST'} ho gaya — maal MAT dein.\nDe chuke hain to malik ko batayein.`, rq: `gp-${id}-${a.p}` });
        log(`🚪 gate pass ${id} cancel / un-post ki khabar`); return;
      }
      gpOffd.delete(id);
      if (gpSent.has(id)) return;
      const pt = Number(d.pt) || 0; if (!pt || pt < gpw.since || Date.now() - pt > 3 * 3600000) return;
      if (!Array.isArray(d.l) || !d.l.length) return;
      gpSent.add(id); const txt = gpText(d);
      for (const a of gpw.nums) await gpPut(`gp-${id}-${a.p}`, { to: a.p, nm: a.n, kind: 'gate', gp: String(id), gpd: gpDay, txt });
      log(`🚪 gate pass #${gpNo(d)} -> ${gpw.nums.length} number`);
    } catch (e) { log('⚠️ gate pass ' + id + ': ' + e.message); }
  }
  async function gpWatch() {
    const day = dayOf(Date.now());
    if (!gpw.on || !gpw.nums.length) { if (gpStop) { try { gpStop(); } catch {} gpStop = null; gpDay = ''; } return; }
    if (gpStop && gpDay === day) return;
    if (gpStop) { try { gpStop(); } catch {} gpStop = null; }
    gpDay = day;
    try { const old = await Q.where('gpd', '==', day).get(); old.forEach(x => { const g = String((x.data() || {}).gp || ''); if (g) gpSent.add(g); }); } catch (e) { log('⚠️ gate pass purane: ' + e.message); }
    gpStop = GP.where('day', '==', day).onSnapshot(sn => { for (const ch of sn.docChanges()) if (ch.type !== 'removed') gpDoc(ch.doc.id, ch.doc.data() || {}); }, e => { log('⚠️ gatePass: ' + e.message); gpStop = null; gpDay = ''; });
  }
  BA.doc('gpWa').onSnapshot(sn => { const d = (sn.exists && sn.data()) || {}; gpw = { on: d.on === true, since: Number(d.since) || 0, nums: (Array.isArray(d.nums) ? d.nums : []).map(a => ({ n: String((a && a.n) || '').slice(0, 30), p: normPh(a && a.p) })).filter(a => isMob(a.p)).slice(0, 10) }; gpWatch().catch(e => log('⚠️ gpWatch: ' + e.message)); }, e => log('⚠️ gpWa: ' + e.message));
  BA.doc('waParchi').onSnapshot(sn => { const d = (sn.exists && sn.data()) || {}; if (Array.isArray(d.prFrom) && d.prFrom[0] && isMob(normPh(d.prFrom[0]))) gpMalik = normPh(d.prFrom[0]); }, () => {});
  setInterval(() => { gpWatch().catch(() => {}); }, 60000);   // din badle / listener gire = dobara
  async function gpReply(m, c, tx, s) {   // true = yeh gate pass ka jawab tha (aage kuch nahi)
    if (!gpw.nums.length || !/^\s*[12]\s*$/.test(tx)) return false;
    const ctx = c.extendedTextMessage && c.extendedTextMessage.contextInfo, st = String((ctx && ctx.stanzaId) || ''); if (!st) return false;
    const from = await fromNum(m, s), me = gpw.nums.find(a => a.p === from); if (!me) return false;
    let job = null; try { const q = await Q.where('wid', '==', st).limit(1).get(); if (!q.empty) job = q.docs[0].data() || {}; } catch (e) { log('⚠️ gate jawab: ' + e.message); }
    if (!job || job.kind !== 'gate' || !job.gp) return false;
    const id = String(job.gp), ref = GP.doc(id), sn = await ref.get(), d = sn.exists ? sn.data() || {} : null, rid = 'gpr-' + String(m.key.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40), say = txt => gpPut(rid, { to: from, nm: me.n, kind: 'gate', txt });
    if (!d) { await say('✕ Yeh gate pass ab nahi mila.'); return true; }
    if (d.off || Number(d.ps) !== 2) { await say(`⛔ Gate pass #${gpNo(d)} cancel / un-post hai — maal MAT dein.`); return true; }
    if (tx.trim() === '1') {
      const g = d.g || {}, up = {}; let n = 0;
      for (const x of (Array.isArray(d.l) ? d.l : [])) if (x && x.k && !g[x.k]) { up['g.' + x.k] = { n: me.n || from, q: Number(x.q) || 0, t: FieldValue.serverTimestamp() }; n++; }
      if (d.nd) up.nd = FieldValue.delete();
      if (Object.keys(up).length) await ref.update(up);
      await say(n ? `✅ Gate pass #${gpNo(d)} — DE DIYA likh diya (${n} item).` : `✅ Gate pass #${gpNo(d)} pehle se de diya likha hai.`);
      log(`🚪 #${gpNo(d)} de diya — ${me.n} (${n})`);
    } else {
      await ref.update({ nd: { n: me.n || from, t: Date.now() } });
      await say(`✕ Gate pass #${gpNo(d)} — NAHI DIYA likh diya. Malik ko khabar chali gayi.\nBaad mein de dein to isi gate pass par reply 1.`);
      if (isMob(gpMalik) && gpMalik !== from) await gpPut('gpn-' + rid.slice(4), { to: gpMalik, nm: 'Malik', kind: 'gate', txt: `✕ *Gate pass #${gpNo(d)}* NAHI diya — ${me.n}\n👤 ${String(d.p || 'Customer').slice(0, 60)} · ${(Array.isArray(d.l) ? d.l : []).length} item` });
      log(`🚪 #${gpNo(d)} NAHI diya — ${me.n}`);
    }
    return true;
  }
  // v1.8 (12 Nov, malik: "business number hi main — main ya Mubeen parchi isi par bhejein, wohi print kare, baqi cheezein bhi wohi handle kare · mera / Mubeen ka number juda ho ya na ho"):
  //   📥 INBOX — ijazat wale number (kh-wa who(): malik / Mubeen / khWa.allow) ki TASVEER ya chhota likha paigham (<= 60 harf) → waIn/<id> (+ _p<i> tasveer ke hisse) → wa-parchi.js usay parhta hai
  //   (Print / Print auto / start / bill — wohi purane qaide). Gahakon ke paigham ab bhi nahi parhe jate (sirf location). 30 min se purana nahi.
  const IN = biz.collection('waIn');
  async function inboxPut(m, c, img, tx, from, s) {
    const rid = String(m.key.id || ''), id = rid.replace(/[^A-Za-z0-9]/g, '').slice(0, 60); if (!id) return;
    const t0 = m.messageTimestamp, ts = Number(t0 && typeof t0 === 'object' ? (t0.toNumber ? t0.toNumber() : t0.low) : t0) * 1000 || Date.now(); if (Date.now() - ts > 30 * 60000) return;
    const ctx = (c.extendedTextMessage && c.extendedTextMessage.contextInfo) || (img && img.contextInfo) || null;
    const d = { st: 'new', at: ts, from, rid, nm: String(m.pushName || '').replace(/[|"]/g, ' ').slice(0, 40), tx: String(img ? img.caption || '' : tx).slice(0, 300), q: String((ctx && ctx.stanzaId) || ''), fw: !!(ctx && ctx.isForwarded), im: 0, n: 0 };
    if (!img && /^\s*a\.?i\.?\s*$/i.test(String(tx || '')) && ctx && ctx.stanzaId && ctx.quotedMessage) {
      let qm = ctx.quotedMessage; qm = (qm.ephemeralMessage && qm.ephemeralMessage.message) || (qm.viewOnceMessage && qm.viewOnceMessage.message) || qm;
      const qi = qm.imageMessage || (qm.documentMessage && /^image\//i.test(String(qm.documentMessage.mimetype || '')) ? qm.documentMessage : null);
      if (qi) {
        try {
          if (Number(qi.fileLength) > 12 * 1024 * 1024) throw Error('tasveer 12 MB se bari');
          const fake = { key: { remoteJid: m.key.remoteJid, id: String(ctx.stanzaId), fromMe: false, participant: ctx.participant || undefined }, message: qm };
          const buf = await within(B.downloadMediaMessage(fake, 'buffer', {}, { logger, reuploadRequest: s && s.updateMediaMessage }), 60000, 'purani tasveer download'), P = 800000, n = Math.ceil(buf.length / P);
          for (let i = 0; i < n; i++) await IN.doc(id + '_p' + i).set({ b: buf.subarray(i * P, (i + 1) * P) });
          d.im = 1; d.n = n; d.mt = String(qi.mimetype || 'image/jpeg'); d.sz = buf.length; d.qi = 1;
        } catch (e) { d.err = 'purani tasveer WhatsApp se nahi mili (' + String((e && e.message) || e).slice(0, 60) + ') — photo dobara bhej kar saath ai likhein'; }
      }
    }
    if (img) {
      if (Number(img.fileLength) > 12 * 1024 * 1024) d.err = 'tasveer 12 MB se bari';
      else { const buf = await within(B.downloadMediaMessage(m, 'buffer', {}, { logger, reuploadRequest: s && s.updateMediaMessage }), 60000, 'tasveer download'), P = 800000, n = Math.ceil(buf.length / P);
        for (let i = 0; i < n; i++) await IN.doc(id + '_p' + i).set({ b: buf.subarray(i * P, (i + 1) * P) });
        d.im = 1; d.n = n; d.mt = String(img.mimetype || 'image/jpeg'); d.sz = buf.length; }
    }
    try { await IN.doc(id).create(d); log(`📥 inbox: ${phPretty(from)} ${img ? '🖼' : '💬'}`); } catch (e) { if (!/already exists/i.test(String(e.message || e))) throw e; }
  }
  async function onMsgs(ms, s) {
    for (const m of ms || []) {
      try {
        if (!m || !m.key || m.key.fromMe || !m.message) continue;
        let c = m.message; c = (c.ephemeralMessage && c.ephemeralMessage.message) || (c.viewOnceMessage && c.viewOnceMessage.message) || c;
        const ktx = String(c.conversation || (c.extendedTextMessage && c.extendedTextMessage.text) || '').trim();
        if (ktx && ktx.length <= 3 && await gpReply(m, c, ktx, s)) continue;   // v1.18: 🚪 gate pass ka jawab (1 / 2) — sirf gate numbers, sirf gate paigham par reply
        if (KHW && ktx && ktx.length <= 300 && !/^\s*a\.?i\.?\s*$/i.test(ktx) && KHW.looks(ktx)) { const kn = await fromNum(m, s), kc = c.extendedTextMessage && c.extendedTextMessage.contextInfo, kt = Number(m.messageTimestamp && typeof m.messageTimestamp === 'object' ? (m.messageTimestamp.toNumber ? m.messageTimestamp.toNumber() : m.messageTimestamp.low) : m.messageTimestamp) * 1000 || 0;
          if (kn) await KHW.apply({ text: ktx, from: kn, wid: m.key.id || '', ts: kt, quoted: String((kc && kc.stanzaId) || ''), quiet: false }); continue; }
        if (KHW && KHW.looksName && ktx && !/^\s*a\.?i\.?\s*$/i.test(ktx) && KHW.looksName(ktx)) { const kn3 = await fromNum(m, s), kt3 = Number(m.messageTimestamp && typeof m.messageTimestamp === 'object' ? (m.messageTimestamp.toNumber ? m.messageTimestamp.toNumber() : m.messageTimestamp.low) : m.messageTimestamp) * 1000 || 0;
          if (kn3 && KHW.who(kn3) && await KHW.apply({ text: ktx, from: kn3, wid: m.key.id || '', ts: kt3, quoted: '', quiet: true, biz: true })) continue; }
        const kimg = c.imageMessage || (c.documentMessage && /^image\//i.test(String(c.documentMessage.mimetype || '')) ? c.documentMessage : null);
        if (KHW && KHW.who && (kimg || (ktx && ktx.length <= 60))) { const kn2 = await fromNum(m, s); if (kn2 && KHW.who(kn2)) { await inboxPut(m, c, kimg, ktx, kn2, s); continue; } }
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
  // v1.9 (12 Nov, malik: "jo numbers save hain un par list bhejni hai · mera aur Mubeen ka chip"): app blueAccess/khWaSend {id, at, txt, to:[{n,p}]} -> waOut kl-<id>-<number> (create = dohra kabhi nahi) -> nateeja blueAccess/khWaSent {id, r:{number:{st,why}}}
  BA.doc('khWaSend').onSnapshot(async s => {
    try {
      const d = (s.exists && s.data()) || {}, sid = String(d.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24), txt = String(d.txt || '').trim().slice(0, 3500);
      if (!sid || !txt || !Number(d.at) || Date.now() - Number(d.at) > 10 * 60000) return;
      const to = (Array.isArray(d.to) ? d.to : []).map(a => ({ n: String((a && a.n) || '').slice(0, 30), p: normPh(a && a.p) })).filter(a => isMob(a.p)).slice(0, 35);
      if (!to.length) return;
      const cur = await BA.doc('khWaSent').get(); if (cur.exists && String((cur.data() || {}).id) === sid) return;
      await BA.doc('khWaSent').set({ id: sid, at: Date.now(), r: {} });
      let n = 0; for (const a of to) { try { await Q.doc(`kl-${sid}-${a.p}`).create({ st: 'new', at: Date.now(), to: a.p, nm: a.n, kind: 'rem', eid: `kl-${sid}-${a.p}`, txt }); n++; } catch (e) { if (!/exists/i.test(e.message)) log('⚠️ kharcha list: ' + e.message); } }
      log(`🔢 kharcha list ${n} number ko`);
    } catch (e) { log('⚠️ khWaSend: ' + e.message); }
  }, e => log('⚠️ khWaSend: ' + e.message));
  Q.where('st', '==', 'new').onSnapshot(s => { for (const ch of s.docChanges()) { if (ch.type === 'removed') pend.delete(ch.doc.id); else pend.set(ch.doc.id, ch.doc.data() || {}); } kick(); }, e => log('⚠️ waOut: ' + e.message));
  function kick() { if (!busy) work().catch(e => { busy = false; log('⚠️ bhejna: ' + e.message); }); }
  async function work() {
    busy = true; busyAt = Date.now();
    try {
      loop: while (pend.size) {
        busyAt = Date.now();   // v1.3: har job par taza — lambi queue 'atki' na lage
        const [id, d] = [...pend.entries()].sort((a, b) => (isFast(b[1]) - isFast(a[1])) || ((Number(a[1].at) || 0) - (Number(b[1].at) || 0)))[0]; const fast = isFast(d);
        const done = async (st, why, extra) => { pend.delete(id); if (id.startsWith('kl-')) { try { await BA.doc('khWaSent').update({ ['r.' + normPh(d.to)]: { st, why: String(why || '').slice(0, 100), at: Date.now() } }); } catch (e) { log('⚠️ khWaSent: ' + e.message); } } try { await Q.doc(id).set({ st, why: String(why || '').slice(0, 140), sentAt: Date.now(), ...(d.im ? { im: FieldValue.delete(), hadIm: 1 } : {}), ...(d.au ? { au: FieldValue.delete(), hadAu: 1 } : {}), ...(d.doc ? { doc: FieldValue.delete(), hadDoc: 1 } : {}), ...(extra || {}) }, { merge: true }); } catch (e) { log('⚠️ waOut ' + id + ': ' + e.message); } };
        const day = dayOf(Date.now()); if (L.day !== day) { L.day = day; L.n = 0; }
        const to = normPh(d.to), nm = String(d.nm || '').slice(0, 40), txt = String(d.txt || '').trim();
        if (!cfg.on) { await done('skip', 'band hai (setting)'); continue; }
        if (Number(d.at) && Date.now() - Number(d.at) > 6 * 3600000) { await done('skip', 'purana (6 ghante+)'); continue; }
        if (!okPh(to) || (!txt && !d.au && !d.loc && !d.doc)) { await done('err', !okPh(to) ? 'mobile number ghalat' : 'paigham khali'); continue; }
        if (!fast && L.n >= cfg.lim) { log(`⏸ aaj ki hadd ${cfg.lim} poori — baqi kal`); setLink({ err: `Aaj ki hadd ${cfg.lim} poori — baqi kal` }); break; }   // queue mein rahe (st new)
        if (!sock || L.st !== 'open') { break; }   // jur jaye to kick()
        if (fast) { const g2 = 600 - (Date.now() - lastFast); if (g2 > 0) await sleep(g2); }
        else { while (cfg.gap * 1000 - (Date.now() - lastSent) > 0) { await sleep(300); busyAt = Date.now(); if ([...pend.values()].some(isFast)) continue loop; } }
        if (!sock || L.st !== 'open') break;
        try {
          const chk = fast && jidOk.has(to) ? [{ exists: true, jid: jidOk.get(to) }] : await within(sock.onWhatsApp(jidOf(to)), 15000, 'number check');
          const okNo = Array.isArray(chk) && chk[0] && chk[0].exists;
          if (!okNo) { await done('skip', 'yeh number WhatsApp par nahi'); await addLog({ at: Date.now(), to, nm, code: String(d.code || ''), st: 'skip', why: 'WhatsApp par nahi' }); continue; }
          const jid = (chk[0] && chk[0].jid) || jidOf(to);
          const im = d.im && (Buffer.isBuffer(d.im) ? d.im : d.im.toUint8Array ? Buffer.from(d.im.toUint8Array()) : null);   // v1.0: bill ki tasveer (Bytes) ho to tasveer + caption
          const au = d.au && (Buffer.isBuffer(d.au) ? d.au : d.au.toUint8Array ? Buffer.from(d.au.toUint8Array()) : null);   // 🔊 awaz (mp3) — Urdu TTS
          const dc = d.doc && (Buffer.isBuffer(d.doc) ? d.doc : d.doc.toUint8Array ? Buffer.from(d.doc.toUint8Array()) : null);
          let quoted = null;
          if (d.rq) {   // v1.4: reply mein — pehle yaad se, warna asal doc ka wid
            quoted = sentM.get(String(d.rq)) || null;
            if (!quoted) { try { const ps0 = await within(Q.doc(String(d.rq)).get(), 10000, 'reply ka asal'); const pd = ps0.exists ? ps0.data() : null; if (pd && pd.st === 'sent' && pd.wid) quoted = { key: { remoteJid: jid, fromMe: true, id: String(pd.wid) }, message: { conversation: String(pd.txt || '').slice(0, 300) } }; } catch {} }
          }
          const lc = d.loc && Number.isFinite(Number(d.loc.lat)) && Number.isFinite(Number(d.loc.lng)) ? { location: { degreesLatitude: Number(d.loc.lat), degreesLongitude: Number(d.loc.lng), name: String(d.loc.name || '').slice(0, 80), address: String(d.loc.adr || '').slice(0, 120) } } : null;   // v1.5: delivery boy ko location
          const r = await within(sock.sendMessage(jid, lc || (dc && dc.length ? { document: dc, mimetype: 'application/pdf', fileName: String(d.fn || 'Khata.pdf').slice(0, 60), caption: txt } : im && im.length ? { image: im, caption: txt, mimetype: 'image/jpeg' } : au && au.length ? { audio: au, mimetype: 'audio/mpeg', ptt: false } : { text: txt }), quoted ? { quoted } : {}), 60000, 'bhejna');
          if (fast) { lastFast = Date.now(); jidOk.set(to, jid); } else lastSent = Date.now();
          L.n++;
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
