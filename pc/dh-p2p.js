// ============================================================
//  dh-p2p.js  v1.1 (2026-11-28 raat, malik ki screenshot '403 [channel]' sahi password par): camera ka namak (randsalt) 3 dafa maango; na mile = saaf 'namak nahi mila' (password ka ilzam nahi) + line mein login ka haal {namak · server ka jawab}.
//  v1.0 (2026-11-28) — 🛰 Dahua camera SERIAL NUMBER se (P2P surang) — AZMAISH
//  Malik: 'doosri factory ka camera — IP ke baghair, DMSS jaisa · serial number se'.
//  Kaam: camera ka serial number + username / password -> Dahua ke P2P raaste (Easy4ip cloud + PTCP, UDP) se
//        PC par 127.0.0.1:<port> ek TCP darwaza -> us par camera ka RTSP (554) milta hai. bill-clip / live-cam
//        is ko '🌐 Seedha camera' ki tarah (ip 127.0.0.1, port 15000 + ch) istemal karte hain.
//  Yeh module hai (service nahi): bill-clip.js is ko require kar ke chalata hai — sync(list, log) / state(ch).
//  Protocol sarkari nahi (Dahua ne likh kar nahi diya) — logon ki khuli jaanch (GitHub 'dh-p2p' ka README) par bana,
//  code apna. Dahua tareeqa badle to ruk sakta hai: tab state().why mein wajah, recording ka alarm malik ko.
//  Hifazat: password / poora serial kabhi log mein nahi; har ghalti pakri jati hai (bill-clip kabhi na gire);
//  Dahua ke server par bojh nahi — nakaam = 30 s, phir dugna, 10 min tak.
//  AI nahi.
// ============================================================
'use strict';
const dgram = require('dgram'), net = require('net'), dns = require('dns'), crypto = require('crypto');

const MAIN = 'www.easy4ipcloud.com:8800';
const CL_USER = 'cba1b29e32cb17aa46b8ff9e73c7f40b', CL_KEY = '996103384cdf19179e19243e959bbf8b';   // Dahua ke apne client ki pehchan (har client mein ek)
const IV = Buffer.from('2z52*lk9o6HRyJrf'), INFO_KEY = Buffer.from('kRjmsUB&ezmdGLL67H#$ojw@XflcaIaf'), INFO_IV = Buffer.from('MydvJw*Iw1w&i^kk');
const PORT_OF = ch => 15000 + Number(ch);
const SN_RE = /^[A-Za-z0-9]{8,24}$/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mask = sn => '…' + String(sn).slice(-4);
const u32 = n => n >>> 0;
const inv = b => Buffer.from(b.map(x => 0xFF - x));
const addrBytes = a => { const [ip, port] = String(a).split(':'); const b = Buffer.alloc(6); b.writeUInt16BE(Number(port) || 0, 0); ip.split('.').forEach((x, i) => { b[2 + i] = Number(x) & 255; }); return b; };
const tag = (xml, name) => { const m = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>').exec(String(xml || '')); return m ? m[1].trim() : ''; };

// ---------- UDP: ek socket, manzil badalti rehti hai ----------
class Udp {
  constructor() { this.s = dgram.createSocket('udp4'); this.q = []; this.w = null; this.host = ''; this.port = 0; this.on = null; this.dead = false;
    this.s.on('error', () => {}); this.s.on('message', m => { if (this.on) { try { this.on(m); } catch {} return; } if (this.w) { const w = this.w; this.w = null; w(m); } else if (this.q.length < 200) this.q.push(m); }); }
  bind() { return new Promise((res, rej) => { this.s.once('error', rej); this.s.bind(0, () => { this.lport = this.s.address().port; res(this); }); }); }
  async to(addr) { const i = String(addr).lastIndexOf(':'), h = String(addr).slice(0, i), p = Number(String(addr).slice(i + 1)); if (!h || !p) throw new Error('pata ghalat: ' + addr);
    this.host = /^\d+(\.\d+){3}$/.test(h) ? h : (await dns.promises.lookup(h, { family: 4 })).address; this.port = p; }
  send(b) { if (this.dead) return; try { this.s.send(b, this.port, this.host, () => {}); } catch {} }
  recv(ms) { if (this.q.length) return Promise.resolve(this.q.shift()); return new Promise((res, rej) => { const t = setTimeout(() => { this.w = null; rej(new Error('TIMEOUT')); }, ms || 8000); this.w = m => { clearTimeout(t); res(m); }; }); }
  close() { this.dead = true; this.on = null; try { this.s.close(); } catch {} }
}

// ---------- Dahua ka HTTP jaisa sawal (UDP par, WSSE) ----------
function dhReq(st, u, path, body) {
  st.cseq++;
  const nonce = crypto.randomInt(2 ** 31), cur = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const dig = crypto.createHash('sha1').update(`${nonce}${cur}DHP2P:${CL_USER}:${CL_KEY}`).digest('base64');
  let r = `${body ? 'DHPOST' : 'DHGET'} ${path} HTTP/1.1\r\nCSeq: ${st.cseq}\r\nAuthorization: WSSE profile="UsernameToken"\r\nX-WSSE: UsernameToken Username="${CL_USER}", PasswordDigest="${dig}", Nonce="${nonce}", Created="${cur}"\r\n`;
  if (body) r += `Content-Type: \r\nContent-Length: ${Buffer.byteLength(body)}\r\n`;
  u.send(Buffer.from(r + '\r\n' + (body || '')));
}
async function dhRead(u, ms, allowErr) {
  for (let i = 0; i < 6; i++) {
    const t = (await u.recv(ms)).toString('utf8'); if (!/^HTTP\//.test(t)) continue;   // PTCP / STUN ka bhatka tukda = chhoro
    const k = t.indexOf('\r\n\r\n'), head = k < 0 ? t : t.slice(0, k), m = /^\S+\s+(\d+)\s*(.*)/.exec(head) || [];
    const r = { code: Number(m[1]) || 0, status: String(m[2] || '').trim(), xml: k < 0 ? '' : t.slice(k + 4) };
    if (!allowErr && r.code >= 400) { const e = new Error('DH ' + r.code + ' ' + r.status); e.code = r.code; throw e; }
    return r;
  }
  throw new Error('TIMEOUT');
}
const ask = async (st, u, path, body, ms) => { dhReq(st, u, path, body); return dhRead(u, ms || 8000); };

// ---------- camera ke password wali tasdeeq (naye camera maangte hain) ----------
const keyOf = (user, pw, salt) => Buffer.from(crypto.createHash('md5').update(`${user}:Login to ${salt}:${pw}`).digest('hex').toUpperCase());
const dkOf = (key, nonce) => crypto.pbkdf2Sync(key, Buffer.from(String(nonce)), 20000, 32, 'sha256');
const encA = (key, nonce, s) => { const c = crypto.createCipheriv('aes-256-ofb', dkOf(key, nonce), IV); return Buffer.concat([c.update(Buffer.from(s)), c.final()]).toString('base64'); };
const decA = (key, nonce, b64) => { const c = crypto.createCipheriv('aes-256-ofb', dkOf(key, nonce), IV); return Buffer.concat([c.update(Buffer.from(b64, 'base64')), c.final()]).toString('utf8'); };
function authXml(user, key, nonce, salt, payload) {
  const cur = Math.floor(Date.now() / 1000), a = crypto.createHmac('sha256', key).update(`${nonce}${cur}${payload || ''}`).digest('base64');
  return `<CreateDate>${cur}</CreateDate><DevAuth>${a}</DevAuth><Nonce>${nonce}</Nonce>${salt ? `<RandSalt>${salt}</RandSalt>` : ''}<UserName>${user}</UserName>`;
}
function infoOf(b64) { if (!b64) return {}; try { const c = crypto.createDecipheriv('aes-256-ofb', INFO_KEY, INFO_IV); return JSON.parse(Buffer.concat([c.update(Buffer.from(b64, 'base64')), c.final()]).toString('utf8')) || {}; } catch { return {}; } }

// ---------- PTCP (UDP ke upar TCP jaisi line) ----------
const B_SYN = Buffer.from([0, 3, 1, 0]), B_HB = Buffer.from([0x13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), B_EMPTY = Buffer.alloc(0);
class Sess {
  constructor() { this.sent = 0; this.recv = 0; this.count = 0; this.id = 0; this.rmid = 0; }
  pack(body) {
    const syn = body.length === 4 && body.equals(B_SYN), h = Buffer.alloc(24); h.write('PTCP', 0, 'latin1');
    h.writeUInt32BE(u32(this.sent), 4); h.writeUInt32BE(u32(this.recv), 8); h.writeUInt32BE(syn ? 0x0002FFFF : u32(0x0000FFFF - this.count), 12); h.writeUInt32BE(u32(this.id), 16); h.writeUInt32BE(u32(this.rmid), 20);
    this.sent = u32(this.sent + body.length); this.id = u32(this.id + 1); if (!syn && body.length) this.count = u32(this.count + 1);
    return Buffer.concat([h, body]);
  }
  take(m) { if (!m || m.length < 24 || m.toString('latin1', 0, 4) !== 'PTCP') return null; const body = m.subarray(24); this.recv = u32(this.recv + body.length); this.rmid = m.readUInt32BE(16); return body; }
}
async function ptRead(u, s, ms) { const end = Date.now() + (ms || 8000); for (;;) { const left = end - Date.now(); if (left <= 0) throw new Error('TIMEOUT'); const b = s.take(await u.recv(left)); if (b) return b; } }
async function ptReadFull(u, s, ms) { const end = Date.now() + (ms || 8000); for (;;) { const b = await ptRead(u, s, Math.max(1, end - Date.now())); if (b.length) return b; } }
const cmd = (t, extra) => Buffer.concat([Buffer.from([t, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), extra || B_EMPTY]);
const payload = (realm, data) => { const h = Buffer.alloc(12); h.writeUInt32BE(u32(0x10000000 | data.length), 0); h.writeUInt32BE(u32(realm), 4); return Buffer.concat([h, data]); };
const bindB = (realm, port) => { const b = Buffer.alloc(20); b[0] = 0x11; b.writeUInt32BE(u32(realm), 4); b.writeUInt32BE(port, 12); b[16] = 127; b[19] = 1; return b; };
const statusB = (realm, s) => { const b = Buffer.alloc(12); b[0] = 0x12; b.writeUInt32BE(u32(realm), 4); return Buffer.concat([b, Buffer.from(s)]); };

// ---------- haath milana: cloud se camera ka pata, phir camera se seedhi line (na bane = relay) ----------
async function handshake(t) {
  const st = { cseq: 0 }, socks = [];
  const mk = async addr => { const u = await new Udp().bind(); socks.push(u); if (addr) await u.to(addr); return u; };
  const fail = (why, e) => { const x = e instanceof Error ? e : new Error(String(e || why)); x.why = why; return x; };
  try {
    const A = await mk(MAIN);
    t.step = 'cloud';
    await ask(st, A, '/probe/p2psrv').catch(e => { throw fail('Dahua ke server tak rasta nahi (internet / UDP 8800 band?)', e); });
    const on = await (async () => { dhReq(st, A, '/online/p2psrv/' + t.sn); return dhRead(A, 8000, true); })();
    if (on.code >= 400) throw fail(on.code === 404 ? 'Yeh serial number Dahua ke server par nahi mila — number dobara dekhein / camera online hai?' : 'Dahua server: ' + on.code + ' ' + on.status);
    const p2psrv = tag(on.xml, 'US'); if (!p2psrv) throw fail('Camera Dahua ke server par online nahi (P2P band / internet nahi)');
    // camera ka namak (password ki tasdeeq ke liye)
    let salt = '', sdg = '';
    for (let k = 0; k < 3 && !salt; k++) {   // v1.1: namak ke baghair sahi password bhi 403 deta hai — 3 dafa maango, haal yaad rakho
      let P = null;
      try {
        P = await mk(p2psrv); await ask(st, P, '/probe/device/' + t.sn, '', 5000); dhReq(st, P, '/info/device/' + t.sn); const r = await dhRead(P, 5000, true);
        if (r.code < 300) { const inf = infoOf(tag(r.xml, 'Info')); salt = String(inf.randsalt || ''); sdg = salt ? 'namak mila' : 'namak NAHI (info: ' + (Object.keys(inf).join(',').slice(0, 40) || 'khali') + ')'; }
        else sdg = 'namak NAHI (server ' + r.code + ')';
      } catch (e) { if (/DH 4/.test(e.message)) throw fail('Camera is waqt online nahi (Dahua server: ' + e.message.slice(3) + ')'); sdg = 'namak NAHI (' + String(e.message).slice(0, 20) + ')'; }
      finally { try { P && P.close(); } catch {} }
    }
    const relay = tag((await ask(st, A, '/online/relay')).xml, 'Address'); if (!relay) throw fail('Dahua ka relay server nahi mila');
    const B = await mk(MAIN);
    t.step = 'channel';
    const aid = crypto.randomBytes(8), ident = [...aid].map(b => b.toString(16)).join(' ');
    let laddr = '127.0.0.1:' + B.lport, ipx = `<IpEncrpt>true</IpEncrpt><LocalAddr>${laddr}</LocalAddr>`, auth = '', key = null, nonce = 0;
    if (t.auth) { key = keyOf(t.u, t.pw, salt); nonce = crypto.randomInt(2 ** 31); laddr = encA(key, nonce, laddr); ipx = `<IpEncrptV2>true</IpEncrptV2><LocalAddr>${laddr}</LocalAddr>`; auth = authXml(t.u, key, nonce, salt, laddr); }
    dhReq(st, B, `/device/${t.sn}/p2p-channel`, `<body>${auth}<Identify>${ident}</Identify>${ipx}<version>5.0.0</version></body>`);
    await A.to(relay); const ag = await ask(st, A, '/relay/agent'); const token = tag(ag.xml, 'Token'), agent = tag(ag.xml, 'Agent'); if (!token || !agent) throw fail('Dahua relay ka jawab adhoora');
    await A.to(agent); await ask(st, A, '/relay/start/' + token, '<body><Client>:0</Client></body>');
    let res = await dhRead(B, 12000, true).catch(e => { throw fail('Camera ne jawab nahi diya (camera offline / net kamzor)', e); });
    if (res.code < 200) res = await dhRead(B, 12000, true).catch(e => { throw fail('Camera ne jawab nahi diya (camera offline / net kamzor)', e); });
    if (res.code >= 400) {
      if (res.code === 403 && !t.auth) { t.auth = true; const e = fail('camera password maangta hai — dobara'); e.again = 1; throw e; }
      if (res.code === 403 || res.code === 401) {
        const dg = ' {' + sdg + ' · ' + res.code + ' ' + String(res.status || '').replace(/[^\w .-]/g, '').slice(0, 24) + '}';
        if (!salt) throw fail('Camera ka namak Dahua server se nahi mila — login nahi bana (password ka masla nahi)' + dg);
        const e = fail('Camera ne login nahi mana — username / password dekhein' + dg); e.bad = 1; throw e;
      }
      throw fail('Camera: ' + res.code + ' ' + res.status);
    }
    let dLocal = tag(res.xml, 'LocalAddr'); const dPub = tag(res.xml, 'PubAddr'), rNonce = tag(res.xml, 'Nonce');
    if (t.auth && rNonce) { try { dLocal = decA(key, rNonce, dLocal); } catch {} }
    if (!/^\d+(\.\d+){3}:\d+$/.test(dPub)) throw fail('Camera ka bahar wala pata nahi mila');
    if (!/^\d+(\.\d+){3}:\d+$/.test(dLocal)) dLocal = dPub;
    await A.to(MAIN);
    dhReq(st, A, `/device/${t.sn}/relay-channel`, `<body>${t.auth ? authXml(t.u, key, rNonce || nonce, salt) : ''}<agentAddr>${agent}</agentAddr></body>`);
    await A.to(agent); await dhRead(A, 10000, true).catch(e => { throw fail('Dahua relay se jawab nahi', e); });
    const sA = new Sess();
    A.send(sA.pack(B_SYN)); await ptRead(A, sA, 8000).catch(e => { throw fail('Relay line nahi bani', e); });
    if (t.relay) { t.step = 'relay'; socks.splice(socks.indexOf(A), 1); socks.forEach(u => u.close()); return { u: A, s: sA, mode: 'relay' }; }
    A.send(sA.pack(cmd(0x17))); const sg = await ptReadFull(A, sA, 8000).catch(e => { throw fail('Relay se nishan nahi mila', e); }); const sign = sg.subarray(12); A.send(sA.pack(B_EMPTY));
    // seedhi line (UDP hole punch)
    t.step = 'punch';
    await B.to(dPub);
    const cookie = crypto.randomBytes(4), trans = crypto.randomBytes(12), naid = inv(aid), tail = Buffer.from([0xff, 0xfb, 0xff, 0xf7, 0xff, 0xfe]);
    B.q.length = 0;
    const p1 = Buffer.concat([Buffer.from([0xff, 0xfe, 0xff, 0xe7]), cookie, trans, Buffer.from([0x7f, 0xd5, 0xff, 0xf7]), naid, tail, inv(addrBytes(dPub))]);
    let got = null;
    for (let i = 0; i < 3 && !got; i++) { B.send(p1); got = await B.recv(1700).catch(() => null); if (got && got.length < 20) got = null; }
    if (!got) { t.relay = true; const e = fail('Seedhi line nahi bani — relay se koshish'); e.again = 1; throw e; }
    const rtrans = got.subarray(8, 20);
    B.send(Buffer.concat([Buffer.from([0xfe, 0xfe, 0xff, 0xe7]), cookie, rtrans, Buffer.from([0x7f, 0xd6, 0xff, 0xf7]), naid, tail, inv(addrBytes(dLocal))]));
    if (t.auth) { await B.recv(2500).catch(() => null); const p3 = Buffer.concat([Buffer.from([0xfe, 0xfe, 0xff, 0xf3]), cookie, rtrans, Buffer.from([0x7f, 0xd6, 0xff, 0xf7]), naid, tail, Buffer.from([0xa8, 0x13, 0x3f, 0x57, 0xfe, 0x37])]); for (let i = 0; i < 5; i++) B.send(p3); }
    for (const end = Date.now() + 3000; Date.now() < end;) { if (!(await B.recv(500).catch(() => null))) break; }   // bache hue tukre nikaal do
    t.step = 'ptcp';
    const sB = new Sess();
    B.send(sB.pack(B_SYN)); await ptRead(B, sB, 6000).catch(e => { t.relay = true; const x = fail('Camera se line nahi bani — relay se koshish', e); x.again = 1; throw x; });
    B.send(sB.pack(cmd(0x19, sign))); const r1 = await ptReadFull(B, sB, 8000).catch(e => { throw fail('Camera ne line ki tasdeeq nahi ki', e); });
    if (r1[0] !== 0x1a) throw fail('Camera ka jawab ajeeb (0x' + r1[0].toString(16) + ')');
    B.send(sB.pack(cmd(0x1b))); await ptRead(B, sB, 3000).catch(() => null);
    socks.splice(socks.indexOf(B), 1); socks.forEach(u => u.close());
    return { u: B, s: sB, mode: 'seedha' };
  } catch (e) { socks.forEach(u => u.close()); throw e; }
}

// ---------- ek camera ki surang ----------
class Tunnel {
  constructor(c, log) { this.ch = c.ch; this.sn = c.sn; this.u = c.u; this.pw = c.pw; this.port = PORT_OF(c.ch); this.log = log || (() => {}); this.sig = sigOf(c);
    this.st = 'try'; this.why = 'jor raha hai…'; this.at = Date.now(); this.auth = false; this.relay = false; this.stop = false; this.link = null; this.conns = new Map(); this.back = 30000; this.mode = ''; this.step = '';
    this.srv = net.createServer(sock => this.onConn(sock)); this.srv.on('error', e => { this.set('err', 'PC ka port ' + this.port + ' nahi khula: ' + e.code); });
    try { this.srv.listen(this.port, '127.0.0.1'); } catch {}
    this.loop().catch(() => {}); }
  set(st, why) { if (this.st !== st || this.why !== why) { this.st = st; this.why = why; this.at = Date.now(); this.log(`🛰 ch ${this.ch} (${mask(this.sn)}): ${st === 'ok' ? '✅' : st === 'err' ? '✕' : '⏳'} ${why}`); } }
  async loop() {
    while (!this.stop) {
      let quick = false;
      try {
        this.set('try', 'camera dhoond raha hai…');
        const L = await handshake(this); if (this.stop) { L.u.close(); break; }
        this.mode = L.mode; this.set('ok', 'jura hua (' + L.mode + ')'); const t0 = Date.now();
        await this.run(L); if (Date.now() - t0 > 120000) this.back = 30000;
        if (!this.stop) this.set('try', 'line toot gayi — dobara jor raha hai');
      } catch (e) {
        if (e && e.again && !this._again) { this._again = 1; quick = true; }
        else { this._again = 0; this.set('err', String((e && e.why) || (e && e.message) || e).slice(0, 150) + (this.step ? ' [' + this.step + ']' : '')); if (e && e.bad) this.back = 600000; }
      }
      if (this.stop) break;
      if (quick) { await sleep(1500); continue; }
      this._again = 0;
      await sleep(this.back); this.back = Math.min(600000, this.back * 2);
    }
  }
  run(L) {
    return new Promise(done => {
      const { u, s } = L; this.link = L; let last = Date.now(), over = false;
      const end = () => { if (over) return; over = true; clearInterval(hb); this.link = null; for (const c of this.conns.values()) { try { c.sock.destroy(); } catch {} } this.conns.clear(); u.close(); done(); };
      this.endLink = end;
      const hb = setInterval(() => { if (this.stop || Date.now() - last > 30000) return end(); u.send(s.pack(B_HB)); }, 5000);
      u.on = m => {
        const b = s.take(m); if (!b) return; last = Date.now(); if (!b.length) return;
        u.send(s.pack(B_EMPTY));
        const ty = b[0];
        if (ty === 0x10 && b.length >= 12) { const c = this.conns.get(b.readUInt32BE(4)); if (c) { try { c.sock.write(b.subarray(12)); } catch {} } }
        else if (ty === 0x12 && b.length >= 16) { const realm = b.readUInt32BE(4), c = this.conns.get(realm), w = b.toString('latin1', 12, 16); if (!c) return; if (w === 'CONN') { c.ready = true; clearTimeout(c.t); try { c.sock.resume(); } catch {} } else if (w === 'DISC') { this.conns.delete(realm); try { c.sock.destroy(); } catch {} } }
      };
    });
  }
  onConn(sock) {
    sock.on('error', () => {});
    const L = this.link; if (!L || this.st !== 'ok' || this.conns.size >= 8) { try { sock.destroy(); } catch {} return; }
    const realm = crypto.randomBytes(4).readUInt32BE(0), c = { sock, ready: false, t: null }; this.conns.set(realm, c);
    sock.pause(); sock.setNoDelay(true);
    const bye = () => { if (this.conns.get(realm) !== c) return; this.conns.delete(realm); clearTimeout(c.t); if (this.link === L) L.u.send(L.s.pack(statusB(realm, 'DISC'))); try { sock.destroy(); } catch {} };
    c.t = setTimeout(bye, 10000);
    sock.on('data', d => { if (this.link !== L) return bye(); for (let i = 0; i < d.length; i += 1200) L.u.send(L.s.pack(payload(realm, d.subarray(i, i + 1200)))); });
    sock.on('close', bye);
    L.u.send(L.s.pack(bindB(realm, 554)));
  }
  kill() { this.stop = true; try { this.srv.close(); } catch {} if (this.endLink) { try { this.endLink(); } catch {} } }
}

const sigOf = c => [c.ch, c.sn, c.u, c.pw].join('|');
const T = new Map();
// list: [{ch, sn, u, pw}] — badla ho to hi dobara; hata = band
function sync(list, log) {
  try {
    const want = new Map(); for (const c of (Array.isArray(list) ? list : []).slice(0, 4)) if (c && SN_RE.test(String(c.sn || '')) && Number(c.ch) > 0) want.set(Number(c.ch), { ch: Number(c.ch), sn: String(c.sn).toUpperCase(), u: String(c.u || 'admin'), pw: String(c.pw || '') });
    for (const [ch, t] of T) { const w = want.get(ch); if (!w || sigOf(w) !== t.sig) { t.kill(); T.delete(ch); } }
    for (const [ch, w] of want) if (!T.has(ch)) T.set(ch, new Tunnel(w, log));
  } catch (e) { try { log && log('⚠️ 🛰 p2p: ' + e.message); } catch {} }
}
const state = ch => { const t = T.get(Number(ch)); return t ? { st: t.st, why: t.why, at: t.at, mode: t.mode } : null; };
module.exports = { sync, state, PORT_OF, SN_RE, _t: { Sess, payload, bindB, statusB, keyOf, encA, decA, authXml, addrBytes, inv, tag, Tunnel, handshake, Udp } };
