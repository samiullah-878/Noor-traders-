// awaz-gas.js — v2.183.0: 🎙 MERI BAATEIN ka Google Apps Script (malik ke apne Google account / Drive mein chalta hai — PC nahi).
// App (awaz.js ⚙️ Setup) isay chaabi + Firestore URL (+ Gemini key, agar app mein save ho) bhar kar copy karti hai.
// Is file mein backtick / dollar-brace KABHI mat likho (String.raw) — Apps Script ka code seedha string hai.
const GAS = String.raw`// NT AWAZ — Meri baatein v1.0 (Blue Khata v2.270.2) · Google Apps Script — aap ke apne Google account mein, Google ke server par.
// Kaam: Drive ke folder "NT Awaz" (MacroDroid ki recording) + "NT Calls" (OnePlus ki call recording) mein NAYI awaz →
//   📍 jagah ka naam (Sheet ka "Jagahein" tab → warna Google Maps) → file ka naya naam "Jagah - 5 Nov 10-20" →
//   🤖 Gemini sun kar Roman Urdu notes → Sheet "Meri Baatein" (🎧 recording + 📍 map link) + Blue Khata app (🎙 Meri baatein).
// Recording kabhi NAHI mitti — phone aur Drive dono par rehti hai. AI sirf Gemini (notes).
// Chalana: function list mein "setup" chunein → ▶ Run → Allow. Bas. (dobara chalana bhi theek — kuch dohra nahi hota)
var BK_KEY = '__BK_KEY__';
var BK_URL = '__BK_URL__';
var GEMINI_KEY = '__GEMINI_KEY__';          // khali ho to: Project Settings → Script properties → GEMINI_KEY
var FOLDERS = [['NT Awaz', 'mic'], ['NT Calls', 'call']];
var SHEET_NAME = 'Meri Baatein';
var TZ = 'Asia/Karachi';
var VER = '1.0';
var P = PropertiesService.getScriptProperties();
var HEAD = ['Din', 'Waqt', 'Jagah', 'Kis se', 'Unwan', 'Khulasa', 'Wade · paise · maal', 'Kaam', 'Recording', 'Map', 'Qisam', 'id'];

function setup() {
  FOLDERS.forEach(function (f) { folderOf(f[0]); });
  var ss = book();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['kaam', 'raat'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('kaam').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('raat').timeBased().atHour(23).nearMinute(30).everyDays(1).inTimezone(TZ).create();
  console.log('✅ Tayyar. Sheet: ' + ss.getUrl());
  kaam();
}

function folderOf(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function book() {
  var id = P.getProperty('SHEET'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(SHEET_NAME); P.setProperty('SHEET', ss.getId()); }
  var b = ss.getSheetByName('Baatein');
  if (!b) {
    b = ss.getSheets()[0]; b.setName('Baatein');
    b.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#223b6d').setFontColor('#ffffff');
    b.setFrozenRows(1); b.setColumnWidths(1, 4, 110); b.setColumnWidth(5, 220); b.setColumnWidth(6, 380); b.setColumnWidths(7, 2, 260); b.hideColumns(12);
  }
  if (!ss.getSheetByName('Jagahein')) {
    var j = ss.insertSheet('Jagahein');
    j.getRange(1, 1, 1, 3).setValues([['Naam (jaise Dukan, Ghar, Bega home)', 'Location: Google Maps mein jagah par ungli rakhein → upar ke number (32.12345, 73.12345) copy → yahan paste', 'Ghera (meter)']]).setFontWeight('bold').setWrap(true);
    j.setColumnWidth(1, 220); j.setColumnWidth(2, 420); j.setColumnWidth(3, 110); j.setFrozenRows(1);
  }
  if (!ss.getSheetByName('Khulasa')) {
    var k = ss.insertSheet('Khulasa');
    k.getRange(1, 1, 1, 3).setValues([['Din', 'Din ka khulasa', 'Kaam']]).setFontWeight('bold');
    k.setColumnWidth(1, 110); k.setColumnWidth(2, 520); k.setColumnWidth(3, 360); k.setFrozenRows(1);
  }
  return ss;
}

// ---------- har 10 min: nayi awaz ----------
function kaam() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(2000)) return;
  try {
    var ss = book(), sh = ss.getSheetByName('Baatein'), t0 = Date.now();
    var last = sh.getLastRow(), done = {};
    if (last > 1) sh.getRange(2, 12, last - 1, 1).getValues().forEach(function (r) { if (r[0]) done[String(r[0])] = 1; });
    var list = [];
    FOLDERS.forEach(function (f) {
      var it = folderOf(f[0]).getFiles();
      while (it.hasNext()) {
        var file = it.next(), id = file.getId();
        if (done[id] || !isAudio(file.getName())) continue;
        if (Date.now() - file.getLastUpdated().getTime() < 90000) continue;   // abhi aa rahi hai
        if (Number(P.getProperty('f_' + id) || 0) >= 3) continue;             // 3 dafa nahi chali — chhor do (log mein)
        list.push({ file: file, kind: f[1], t: file.getDateCreated().getTime() });
      }
    });
    list.sort(function (a, b) { return a.t - b.t; });
    for (var i = 0; i < list.length; i++) {
      if (Date.now() - t0 > 270000) break;   // Google ki 6 min hadd — baqi agli dafa
      var x = list[i];
      try { ek(ss, sh, x.file, x.kind); P.deleteProperty('f_' + x.file.getId()); }
      catch (e) {
        var n = Number(P.getProperty('f_' + x.file.getId()) || 0) + 1; P.setProperty('f_' + x.file.getId(), String(n));
        console.log('✕ ' + x.file.getName() + ': ' + (e && e.message || e));
        if (/limit|quota|429|RESOURCE_EXHAUSTED/i.test(String(e && e.message || e))) break;   // Gemini ki hadd — baad mein
      }
    }
  } finally { lock.releaseLock(); }
}
function isAudio(n) { return /\.(aac|m4a|mp3|wav|ogg|opus|flac|amr|3gp|3gpp|mp4)$/i.test(n); }

function ek(ss, sh, file, kind) {
  var name = file.getName(), m = meta(name, kind, file.getDateCreated());
  var place = kind === 'mic' ? jagah(ss, m.lat, m.lng) : '';
  var when = Utilities.formatDate(m.at, TZ, 'd MMM HH-mm'), ext = (name.match(/\.[a-z0-9]+$/i) || [''])[0];
  var nn = kind === 'call' ? ('Call - ' + (m.who || 'number') + ' - ' + when) : ((place || 'Bahar') + ' - ' + when);
  nn = nn.replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110) + ext;
  if (name !== nn && !/^NT_/.test(nn)) { try { file.setName(nn); } catch (e) { console.log('naam nahi badla: ' + e); } }
  var ai = suno(file.getBlob(), mimeOf(name), kind, m, place);
  var day = Utilities.formatDate(m.at, TZ, 'yyyy-MM-dd'), tm = Utilities.formatDate(m.at, TZ, 'HH:mm');
  var map = m.lat ? 'https://maps.google.com/?q=' + m.lat + ',' + m.lng : '';
  var wd = [].concat(ai.wade || [], ai.paise || [], ai.maal || []).map(String).filter(String).join('\n');
  var who = kind === 'call' ? (m.who || '') : [].concat(ai.log || []).map(String).join(', ');
  var kaamL = [].concat(ai.kaam || []).map(String).filter(String);
  sh.insertRowAfter(1);
  sh.getRange(2, 1, 1, HEAD.length).setValues([[day, tm, place || (kind === 'call' ? 'Call' : ''), who, ai.khamosh ? '(khamosh / sirf shor)' : (ai.unwan || ''), ai.khulasa || '', wd,
    kaamL.map(function (k) { return '☐ ' + k; }).join('\n'), '=HYPERLINK("' + file.getUrl() + '","▶ Suno")', map ? '=HYPERLINK("' + map + '","📍 Map")' : '', kind === 'call' ? 'Call' : 'Awaz', file.getId()]]).setWrap(true).setVerticalAlignment('top');
  if (ai.khamosh) sh.getRange(2, 1, 1, HEAD.length).setFontColor('#9aa3b2');
  bk(file.getId(), { at: m.at.getTime(), day: day, tm: tm, pl: place, lat: m.lat, lng: m.lng, src: kind, who: who, tt: ai.unwan || '', sum: ai.khulasa || '', wd: wd, ks: kaamL, au: file.getUrl(), mp: map, kh: !!ai.khamosh, fn: nn });
}

// file ke naam se waqt / jagah / kis se — MacroDroid: NT_2026-11-5_10-20_32.12345,73.12345.aac
function meta(name, kind, created) {
  var a = name.match(/NT_(\d{4})-(\d{1,2})-(\d{1,2})_(\d{1,2})-(\d{1,2})(?:_(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+))?/);
  if (a) {
    var d = new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4] - 5, +a[5]));   // Pakistan +5
    return { at: d, lat: a[6] ? Number(a[6]) : 0, lng: a[7] ? Number(a[7]) : 0, who: '' };
  }
  var b = name.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_ ]?(\d{2})[-_.:]?(\d{2})(?:[-_.:]?(\d{2}))?/);
  if (!b) { b = name.match(/(?:^|\D)(2\d)(0[1-9]|1[0-2])([0-3]\d)([0-2]\d)([0-5]\d)([0-5]\d)?(?=\D|$)/); if (b) b = [b[0], '20' + b[1], b[2], b[3], b[4], b[5], b[6]]; }   // 261105101530 (yyMMddHHmmss)
  var at = b ? new Date(Date.UTC(+b[1], +b[2] - 1, +b[3], +b[4] - 5, +b[5], +(b[6] || 0))) : created;
  if (!(at instanceof Date) || isNaN(at.getTime())) at = created;
  var who = name.replace(/\.[a-z0-9]+$/i, '').replace(b ? b[0] : /$^/, ' ').replace(/call\s*recording|recording|call|record/ig, ' ').replace(/[@_()[\]{}-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { at: at, lat: 0, lng: 0, who: who.slice(0, 60) };
}
function mimeOf(n) { var e = (n.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase(); return { aac: 'audio/aac', mp3: 'audio/mp3', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', mp4: 'video/mp4', '3gp': 'video/3gpp', '3gpp': 'video/3gpp', amr: 'audio/amr' }[e] || 'audio/aac'; }

// ---------- 📍 jagah ka naam ----------
function jagah(ss, lat, lng) {
  if (!lat || !lng) return '';
  var rows = (ss.getSheetByName('Jagahein').getDataRange().getValues() || []).slice(1), best = null;
  rows.forEach(function (r) {
    var nm = String(r[0] || '').trim(), c = coords(String(r[1] || '')), rad = Number(r[2]) || 150;
    if (!nm || !c) return;
    var d = dist(lat, lng, c[0], c[1]);
    if (d <= rad && (!best || d < best.d)) best = { nm: nm, d: d };
  });
  if (best) return best.nm;
  var ck = 'g_' + lat.toFixed(3) + ',' + lng.toFixed(3), cache = CacheService.getScriptCache(), hit = cache.get(ck) || P.getProperty(ck);
  if (hit) return hit;
  var nm = '';
  try {
    var res = Maps.newGeocoder().setLanguage('en').reverseGeocode(lat, lng), r0 = res && res.results && res.results[0];
    if (r0) {
      var pick = function (ts) { for (var i = 0; i < ts.length; i++) { var c = (r0.address_components || []).filter(function (x) { return x.types.indexOf(ts[i]) >= 0; })[0]; if (c) return c.long_name; } return ''; };
      var small = pick(['point_of_interest', 'establishment', 'premise', 'neighborhood', 'sublocality_level_2', 'sublocality_level_1', 'sublocality', 'route']);
      var city = pick(['locality', 'administrative_area_level_3', 'administrative_area_level_2']);
      nm = [small, city].filter(function (x, i, a) { return x && a.indexOf(x) === i && !/^[A-Z0-9+]{4,}\+/.test(x); }).join(', ');
    }
  } catch (e) { console.log('Maps: ' + e); }
  nm = nm || (lat.toFixed(4) + ', ' + lng.toFixed(4));
  cache.put(ck, nm, 21600); try { P.setProperty(ck, nm); } catch (e) {}
  return nm;
}
function coords(s) {
  var m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
function dist(a, b, c, d) { var R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * R; }

// ---------- 🤖 Gemini ----------
function gkey() { var k = GEMINI_KEY || P.getProperty('GEMINI_KEY') || ''; if (!k || /^__/.test(k)) throw Error('Gemini key nahi — Script properties mein GEMINI_KEY daalein'); return k; }
function model(fresh) {
  var c = P.getProperty('MODEL'), at = Number(P.getProperty('MODEL_AT') || 0);
  if (c && !fresh && Date.now() - at < 7 * 864e5) return c;
  var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + gkey(), { muteHttpExceptions: true });
  var L = (JSON.parse(r.getContentText()).models || []).filter(function (m) {
    var n = String(m.name || ''); return /gemini/.test(n) && /flash/.test(n) && !/image|tts|live|embed|audio-dialog|native-audio/.test(n) && (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
  }).map(function (m) { var n = m.name.replace(/^models\//, ''), v = Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]); return { n: n, s: v * 10 - (/lite/.test(n) ? 3 : 0) - (/preview|exp/.test(n) ? 5 : 0) }; });
  L.sort(function (a, b) { return b.s - a.s; });
  if (!L.length) throw Error('Gemini model nahi mila');
  P.setProperty('MODEL', L[0].n); P.setProperty('MODEL_AT', String(Date.now()));
  return L[0].n;
}
function ask(parts, tries) {
  var mdl = model(tries === 9);
  var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + mdl + ':generateContent?key=' + gkey(), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }) });
  var code = r.getResponseCode(), txt = r.getContentText();
  if (code === 404 && tries !== 9) return ask(parts, 9);   // model band ho gaya — Google ki list se naya
  if (code === 429) throw Error('Gemini limit (429) — baad mein');
  if (code !== 200) throw Error('Gemini ' + code + ': ' + txt.slice(0, 200));
  var j = JSON.parse(txt), out = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');
  try { return JSON.parse(out.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) { return { khulasa: out.slice(0, 1500) }; }
}
function suno(blob, mime, kind, m, place) {
  var when = Utilities.formatDate(m.at, TZ, 'd MMM yyyy, h:mm a');
  var prompt = 'Ye Pakistan ke ek dukandar (Samiullah, Noor Traders — kiryana / wholesale) ke phone ki RECORDING hai' + (kind === 'call' ? ' — PHONE CALL' + (m.who ? ' (' + m.who + ')' : '') : '') + '. Waqt: ' + when + (place ? ', jagah: ' + place : '') + '.\n'
    + 'Baatein Urdu, Punjabi ya English mein ho sakti hain. Sirf jo SAAF sunai de us se likho — apni taraf se kuch mat banao, naam / raqam andaze se mat likho.\n'
    + 'SIRF ye JSON do. Sab likhai ROMAN URDU mein (Latin harf) — Urdu ya Hindi script KABHI nahi:\n'
    + '{"khamosh": false, "unwan": "8 lafz tak", "khulasa": "2-6 chhoti lines — kya baat hui", "log": ["jin se baat hui — naam / rishta / dukan"], "wade": ["kis ne kya wada kiya, kab tak"], "paise": ["raqam + kis cheez ki / kis ko"], "maal": ["item + tadad / rate"], "kaam": ["malik ke karne wale kaam — chhota hukum"]}\n'
    + 'Agar sirf khamoshi, shor, gaana, TV ya be-maani awaz ho (koi kaam ki baat nahi) to sirf: {"khamosh": true}';
  var bytes = blob.getBytes(), part;
  if (bytes.length > 14 * 1024 * 1024) part = { file_data: { mime_type: mime, file_uri: upload(bytes, mime) } };
  else part = { inline_data: { mime_type: mime, data: Utilities.base64Encode(bytes) } };
  try { return ask([part, { text: prompt }]); }
  catch (e) {
    if (/400/.test(String(e.message)) && mime === 'audio/mp4') { if (part.inline_data) part.inline_data.mime_type = 'video/mp4'; else part.file_data.mime_type = 'video/mp4'; return ask([part, { text: prompt }]); }
    throw e;
  }
}
function upload(bytes, mime) {   // bari file (lambi call) — Gemini Files API
  var s = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + gkey(), { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': mime },
    payload: JSON.stringify({ file: { display_name: 'nt-awaz' } }) });
  var h = s.getAllHeaders(), url = h['x-goog-upload-url'] || h['X-Goog-Upload-URL'] || h['X-Goog-Upload-Url'];
  if (!url) throw Error('upload shuru nahi hua: ' + s.getContentText().slice(0, 150));
  var u = UrlFetchApp.fetch(url, { method: 'post', contentType: mime, payload: bytes, muteHttpExceptions: true, headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' } });
  var f = (JSON.parse(u.getContentText()) || {}).file || {};
  for (var i = 0; i < 20 && f.state === 'PROCESSING'; i++) { Utilities.sleep(3000); f = JSON.parse(UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/' + f.name + '?key=' + gkey()).getContentText()); }
  if (!f.uri) throw Error('upload nahi hua');
  return f.uri;
}

// ---------- 📲 Blue Khata app (🎙 Meri baatein) — khufia chaabi se sirf NAYA note ----------
function bk(id, o) {
  if (!BK_KEY || /^__/.test(BK_KEY)) return;
  var f = { k: { stringValue: BK_KEY }, v: { stringValue: VER } };
  Object.keys(o).forEach(function (k) {
    var v = o[k];
    if (Array.isArray(v)) f[k] = { arrayValue: { values: v.slice(0, 20).map(function (s) { return { stringValue: String(s).slice(0, 300) }; }) } };
    else if (typeof v === 'boolean') f[k] = { booleanValue: v };
    else if (typeof v === 'number') f[k] = k === 'at' ? { integerValue: String(Math.round(v)) } : { doubleValue: v };
    else f[k] = { stringValue: String(v == null ? '' : v).slice(0, k === 'sum' ? 3900 : 1500) };
  });
  var r = UrlFetchApp.fetch(BK_URL + '&documentId=' + encodeURIComponent(String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)), { method: 'post', contentType: 'application/json', payload: JSON.stringify({ fields: f }), muteHttpExceptions: true });
  var c = r.getResponseCode();
  if (c !== 200 && c !== 409) console.log('Blue Khata mein nahi gaya (' + c + '): ' + r.getContentText().slice(0, 200));
}

// ---------- 🌙 raat: din ka khulasa ----------
function raat() {
  var ss = book(), sh = ss.getSheetByName('Baatein'), today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), last = sh.getLastRow();
  if (last < 2) return;
  var rows = sh.getRange(2, 1, Math.min(last - 1, 400), 8).getDisplayValues().filter(function (r) { return r[0] === today && r[4] && r[4].indexOf('(khamosh') !== 0; });
  if (!rows.length) return;
  var txt = rows.reverse().map(function (r) { return r[1] + ' · ' + (r[2] || '-') + ' · ' + (r[3] || '') + ' — ' + r[4] + ': ' + r[5] + (r[6] ? ' | ' + r[6] : '') + (r[7] ? ' | ' + r[7] : ''); }).join('\n').slice(0, 30000);
  var ai = ask([{ text: 'Neeche aaj ki recordings ke notes hain (dukandar Samiullah, Noor Traders). Din ka KHULASA do — Roman Urdu (Latin harf) mein, Urdu / Hindi script nahi. SIRF JSON: {"khulasa": "5-10 lines — aaj kya kya hua, kis se kya tay hua", "kaam": ["kal / aage karne wale kaam"]}\n\n' + txt }]);
  var ks = [].concat(ai.kaam || []).map(String);
  ss.getSheetByName('Khulasa').insertRowAfter(1);
  ss.getSheetByName('Khulasa').getRange(2, 1, 1, 3).setValues([[today, ai.khulasa || '', ks.map(function (k) { return '☐ ' + k; }).join('\n')]]).setWrap(true).setVerticalAlignment('top');
  bk('day-' + today + '-' + Date.now(), { at: Date.now(), day: today, tm: Utilities.formatDate(new Date(), TZ, 'HH:mm'), pl: '', lat: 0, lng: 0, src: 'day', who: '', tt: 'Din ka khulasa', sum: ai.khulasa || '', wd: '', ks: ks, au: '', mp: '', kh: false, fn: '' });
}
`;
export const gasCode = ({ key, url, gem }) => GAS.replace('__BK_KEY__', String(key || '')).replace('__BK_URL__', String(url || '')).replace('__GEMINI_KEY__', String(gem || '').replace(/[^A-Za-z0-9_-]/g, ''));
export const GAS_VER = '1.0';
