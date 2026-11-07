// =========================================================
//  wa-out.js  v1.0 (2026-11-07) — 📲 GAHAK KO WHATSAPP PARCHI (naya number, background se)
//  Malik (7 Nov 2026): "WhatsApp wala karna hai — wo ek NAYA number hai, Noor Traders ka business account; itne zyada client bhi nahi aate".
//
//  Dukan ka ALAG WhatsApp Business number (0329-… · malik ne chuna) PC par linked device (Baileys — wahi package wa-mods\ se jo
//  wa-parchi.js lagati hai; yeh script khud install NAHI karti). Asal dukan number (parchi parhne wala) is se alag rehta hai — ban ka
//  khatra asal number par nahi.
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
const { pathToFileURL } = require('url');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47842, VER = '1.0';
const MODS = path.join(DIR, 'wa-mods'), AUTH_DIR = path.join(DIR, 'wa-auth-out'), PKG = '@whiskeysockets/baileys';
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const within = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Error(`${what} ${Math.round(ms / 1000)} sec mein nahi hua`)), ms); })]).finally(() => clearTimeout(t)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dayOf = t => new Date(Number(t) + 5 * 3600000).toISOString().slice(0, 10);   // Pakistan din
function normPh(x) {
  let s = String(x ?? '').trim(); if (!s) return '';
  if (s.includes('@')) s = s.split('@')[0].split(':')[0];
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return d;
}
const isMob = p => /^03\d{9}$/.test(String(p || ''));
const phPretty = p => isMob(p) ? p.slice(0, 4) + '-' + p.slice(4) : String(p || '');
const jidOf = p => '92' + String(p).slice(1) + '@s.whatsapp.net';
const DEF = { on: true, lim: 150, gap: 8 };
function cfgOf(d) { d = d || {}; return { on: d.on !== false, lim: Math.max(10, Math.min(500, Number(d.lim) || DEF.lim)), gap: Math.max(3, Math.min(60, Number(d.gap) || DEF.gap)) }; }
module.exports = { normPh, isMob, jidOf, cfgOf };
if (require.main === module) {
  const lock = net.createServer();
  lock.once('error', () => { console.log('wa-out pehle se chal raha hai.'); process.exit(3); });
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
      shouldIgnoreJid: () => true, generateHighQualityLinkPreview: false, connectTimeoutMs: 30000, getMessage: async () => undefined, ...(version ? { version } : {}) });   // aane wale paigham kabhi nahi
    sock = s;
    s.ev.on('creds.update', saveCreds);
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
  const pend = new Map(); let busy = false, lastSent = 0;
  Q.where('st', '==', 'new').onSnapshot(s => { for (const ch of s.docChanges()) { if (ch.type === 'removed') pend.delete(ch.doc.id); else pend.set(ch.doc.id, ch.doc.data() || {}); } kick(); }, e => log('⚠️ waOut: ' + e.message));
  function kick() { if (!busy) work().catch(e => { busy = false; log('⚠️ bhejna: ' + e.message); }); }
  async function work() {
    busy = true;
    try {
      while (pend.size) {
        const [id, d] = [...pend.entries()].sort((a, b) => (Number(a[1].at) || 0) - (Number(b[1].at) || 0))[0];
        const done = async (st, why, extra) => { pend.delete(id); try { await Q.doc(id).set({ st, why: String(why || '').slice(0, 140), sentAt: Date.now(), ...(d.im ? { im: FieldValue.delete(), hadIm: 1 } : {}), ...(d.au ? { au: FieldValue.delete(), hadAu: 1 } : {}), ...(extra || {}) }, { merge: true }); } catch (e) { log('⚠️ waOut ' + id + ': ' + e.message); } };
        const day = dayOf(Date.now()); if (L.day !== day) { L.day = day; L.n = 0; }
        const to = normPh(d.to), nm = String(d.nm || '').slice(0, 40), txt = String(d.txt || '').trim();
        if (!cfg.on) { await done('skip', 'band hai (setting)'); continue; }
        if (Number(d.at) && Date.now() - Number(d.at) > 6 * 3600000) { await done('skip', 'purana (6 ghante+)'); continue; }
        if (!isMob(to) || (!txt && !d.au)) { await done('err', !isMob(to) ? 'mobile number ghalat' : 'paigham khali'); continue; }
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
          const r = await within(sock.sendMessage(jid, im && im.length ? { image: im, caption: txt, mimetype: 'image/jpeg' } : au && au.length ? { audio: au, mimetype: 'audio/mpeg', ptt: false } : { text: txt }), 60000, 'bhejna');
          lastSent = Date.now(); L.n++;
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

  setInterval(() => { if ((has() || L.st !== 'off') && Date.now() - lastW > 5 * 60000) setLink({}); }, 60000);   // app ko pata rahe PC zinda
  setInterval(kick, 30000);
  if (has()) await connect('shuru'); else setLink({ st: 'off', qr: '', err: '' });
}
