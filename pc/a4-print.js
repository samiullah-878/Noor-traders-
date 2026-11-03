// =========================================================
//  a4-print.js  v1.1 (2026-11-03 raat: malik — "ALEHDA screen · sirf us screen ki tasveer · phone number tasveer par · THERMAL par bhi option":
//                 job.to 'th' = TM-T88IV parchi (NOOR TRADERS + tasveer (photo-print) + number BARA + waqt) · 'a4' = pehle jaisa (number app tasveer ki neeche patti mein likhti hai))
//              · v1.0 (2026-11-03) — 🖨 APP KI TASVEER → HP (WiFi) printer par A4
//  Malik: "printer apps ke saath connect karna hai — hum apps mein kisi saman ki pic add karein to us ka auto print nikle"
//         · printer = WiFi HP · "jo picture upload karein" (sab tasveerein).
//
//  App (kisi bhi phone / PC) tasveer lagate hi: a4Img/<id> {img JPEG data-URL} + a4Jobs/<id> {k qism, t naam, th chhoti, status 'new', copies}
//  Ye script (server PC):
//    • printer khud dhoondti hai — (1) WiFi par IPP (port 631) wale printer (apne /24 jaal mein + malik ka likha IP), (2) Windows mein lage printer.
//      Malik app mein chunta hai (blueAccess/a4.pr); na chuna ho to HP wala khud.
//    • har naya job: IPP par seedha JPEG (A4 · fit) — printer JPEG na le to PDF (A4 safha, hum banate hain) — wo bhi na le to
//      Windows mein printer khud jorti hai (Add-Printer -IppURL) aur Windows (System.Drawing) se chhapti hai. Windows printer chuna ho to seedha Windows.
//    • 2 tasveer ek page (cfg.up 2): PDF / Windows raaste par do job ek safhe par (15 sec doosri ka intezar).
//    • haalat (kaghaz khatam / ink kam / band) + printers ki list → blueAccess/a4Pc (app mein chips).
//    • 30 min purana job = 'old' (khud nahi chhapta — malik 🖨 Dobara) · ghante mein cfg.max (40) se zyada = 'hold' (malik ✓) · 7 din purane job + tasveer mita.
//  AI NAHI. POS / khata mein KUCH nahi likhti. Lock 47839. Chalana: a4-print-auto.bat (doctor). Log: a4-print-log.txt
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const https = require('https');
const path = require('path');
const { execFile } = require('child_process');
const DIR = __dirname, BUSINESS_ID = 'noor-traders', LOCK_PORT = 47839, VER = '1.1';
const TH_PRINTER = 'TM-T88IV';   // dukan ka thermal (pos-khata-sync wala naam)
const OLD_MS = 30 * 60000, KEEP_MS = 7 * 864e5, SCAN_EVERY = 10 * 60000, ST_EVERY = 60000, BEAT = 5 * 60000;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);

// ---------- IPP (printer ki zubaan) ----------
const VT = { integer: 0x21, boolean: 0x22, enum: 0x23, text: 0x41, name: 0x42, keyword: 0x44, uri: 0x45, charset: 0x47, lang: 0x48, mime: 0x49 };
function ippEncode(op, reqId, groups, data) {
  const parts = [Buffer.from([2, 0, (op >> 8) & 255, op & 255, (reqId >>> 24) & 255, (reqId >> 16) & 255, (reqId >> 8) & 255, reqId & 255])];
  for (const [tag, attrs] of groups) {
    parts.push(Buffer.from([tag]));
    for (const [vt, name, vals] of attrs) (Array.isArray(vals) ? vals : [vals]).forEach((v, i) => {
      const nm = Buffer.from(i ? '' : name, 'utf8');
      let vb; if (vt === VT.integer || vt === VT.enum) { vb = Buffer.alloc(4); vb.writeInt32BE(Number(v) || 0); } else if (vt === VT.boolean) vb = Buffer.from([v ? 1 : 0]); else vb = Buffer.from(String(v), 'utf8');
      const h = Buffer.alloc(3); h[0] = vt; h.writeUInt16BE(nm.length, 1); const l = Buffer.alloc(2); l.writeUInt16BE(vb.length);
      parts.push(h, nm, l, vb);
    });
  }
  parts.push(Buffer.from([0x03])); if (data) parts.push(data);
  return Buffer.concat(parts);
}
function ippDecode(buf) {
  if (!buf || buf.length < 8) throw Error('IPP jawab khali');
  const r = { status: buf.readUInt16BE(2), id: buf.readUInt32BE(4), attrs: {} };
  let i = 8, last = null, depth = 0;
  while (i < buf.length) {
    const tag = buf[i++]; if (tag === 0x03) break;
    if (tag < 0x10) { last = null; continue; }   // nayi group
    if (i + 2 > buf.length) break; const nl = buf.readUInt16BE(i); i += 2; const name = buf.toString('utf8', i, i + nl); i += nl;
    if (i + 2 > buf.length) break; const vl = buf.readUInt16BE(i); i += 2; const v = buf.subarray(i, i + vl); i += vl;
    if (tag === 0x37) { if (depth > 0) depth--; continue; }   // collection khatam
    if (depth > 0) { if (tag === 0x34) depth++; continue; }   // collection ke andar — chhor do
    let val;
    if (tag === 0x34) { depth = 1; val = '{}'; }
    else if ((tag === 0x21 || tag === 0x23) && vl === 4) val = v.readInt32BE(0);
    else if (tag === 0x22) val = !!v[0];
    else if (tag === 0x33 && vl === 8) val = [v.readInt32BE(0), v.readInt32BE(4)];
    else if (tag >= 0x10 && tag < 0x20) val = null;
    else if (tag === 0x31 || tag === 0x32) val = '';
    else val = v.toString('utf8');
    if (nl) { last = name; r.attrs[name] = [val]; } else if (last) r.attrs[last].push(val);
  }
  return r;
}
function ippPost(p, body, ms = 25000) {
  return new Promise((res, rej) => {
    const mod = p.tls ? https : http;
    const rq = mod.request({ host: p.ip, port: p.port || 631, path: p.path || '/ipp/print', method: 'POST', timeout: ms, rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/ipp', 'Content-Length': body.length } }, rs => {
      const ch = []; rs.on('data', c => ch.push(c)); rs.on('end', () => {
        if (rs.statusCode === 426 && !p.tls) { ippPost({ ...p, tls: true }, body, ms).then(x => { p.tls = true; res(x); }, rej); return; }   // printer TLS maange
        if (rs.statusCode !== 200) { rej(Error('HTTP ' + rs.statusCode)); return; }
        try { res(ippDecode(Buffer.concat(ch))); } catch (e) { rej(e); }
      });
    });
    rq.on('timeout', () => rq.destroy(Error('printer jawab nahi de raha (timeout)')));
    rq.on('error', rej);
    rq.end(body);
  });
}
const uriOf = p => `${p.tls ? 'ipps' : 'ipp'}://${p.ip}:${p.port || 631}${p.path || '/ipp/print'}`;
const opAttrs = p => [[VT.charset, 'attributes-charset', 'utf-8'], [VT.lang, 'attributes-natural-language', 'en'], [VT.uri, 'printer-uri', uriOf(p)], [VT.name, 'requesting-user-name', 'Blue Khata']];
const WANT = ['printer-make-and-model', 'printer-name', 'printer-info', 'printer-uuid', 'printer-state', 'printer-state-reasons', 'printer-is-accepting-jobs', 'document-format-supported',
  'media-supported', 'media-ready', 'print-scaling-supported', 'copies-supported', 'marker-names', 'marker-levels', 'marker-colors', 'marker-types'];
let reqN = 1;
async function ippAttrs(p, ms) {
  const r = await ippPost(p, ippEncode(0x000B, reqN++, [[0x01, [...opAttrs(p), [VT.keyword, 'requested-attributes', WANT]]]]), ms);
  if (r.status >= 0x0100) throw Error('IPP status 0x' + r.status.toString(16));
  return r.attrs;
}
// fmt: 'image/jpeg' | 'application/pdf'
async function ippPrint(p, data, fmt, o = {}) {
  const A = p.a || {}, job = [];
  const cp = Math.max(1, Math.min(5, Number(o.copies) || 1));
  if (cp > 1) job.push([VT.integer, 'copies', cp]);
  const media = (A['media-supported'] || []).find(m => /iso_a4_210x297mm/i.test(String(m)));
  if (media) job.push([VT.keyword, 'media', media]);
  const sc = A['print-scaling-supported'] || [];
  if (sc.includes('fit')) job.push([VT.keyword, 'print-scaling', 'fit']); else if (sc.includes('auto-fit')) job.push([VT.keyword, 'print-scaling', 'auto-fit']);
  const groups = [[0x01, [...opAttrs(p), [VT.name, 'job-name', String(o.name || 'Blue Khata').slice(0, 60)], [VT.mime, 'document-format', fmt]]]];
  if (job.length) groups.push([0x02, job]);
  const r = await ippPost(p, ippEncode(0x0002, reqN++, groups, data), 120000);
  if (r.status >= 0x0100) { const e = Error(ippErr(r.status)); e.ipp = r.status; throw e; }
  return r;
}
const ippErr = s => s === 0x040A ? 'printer yeh shakal (format) nahi leta' : s === 0x0507 ? 'printer abhi kaam nahi le raha (ruka / band)' : s === 0x0505 ? 'printer ki memory bhari' : s === 0x0506 ? 'printer ruka hua' : 'printer ne mana kiya (0x' + s.toString(16) + ')';

// ---------- JPEG naap + A4 PDF (printer JPEG na le to) ----------
function jpegSize(b) {
  let i = 2; if (!b || b[0] !== 0xFF || b[1] !== 0xD8) return null;
  while (i + 9 < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1]; if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), c: b[i + 9] };
    i += 2 + len;
  }
  return null;
}
// imgs: [Buffer jpeg] · up 2 = ek safhe par do (upar / neeche) · tasveer ghoom kar badi jagah le (90°)
function pdfOf(imgs, up = 1) {
  const W = 595.28, H = 841.89, M = 18, G = 12, f = n => (Math.round(n * 100) / 100).toString();
  const per = up === 2 ? 2 : 1, pages = [];
  for (let i = 0; i < imgs.length; i += per) pages.push(imgs.slice(i, i + per));
  const objs = [], add = s => { objs.push(s); return objs.length; };
  const cat = add(null), pagesId = add(null), kids = [];
  for (const pg of pages) {
    const areas = pg.length === 2 || per === 2 ? [[M, H / 2 + G / 2, W - 2 * M, H / 2 - M - G / 2], [M, M, W - 2 * M, H / 2 - M - G / 2]] : [[M, M, W - 2 * M, H - 2 * M]];
    let cs = '', xo = '';
    pg.forEach((b, j) => {
      const sz = jpegSize(b) || { w: 1000, h: 1000, c: 3 };
      const im = add({ img: b, w: sz.w, h: sz.h, c: sz.c === 1 ? '/DeviceGray' : sz.c === 4 ? '/DeviceCMYK' : '/DeviceRGB' });
      const [ax, ay, aw, ah] = areas[j], rot = (aw > ah) !== (sz.w > sz.h) && Math.abs(sz.w - sz.h) > 8;
      if (!rot) { const k = Math.min(aw / sz.w, ah / sz.h), dw = sz.w * k, dh = sz.h * k; cs += `q ${f(dw)} 0 0 ${f(dh)} ${f(ax + (aw - dw) / 2)} ${f(ay + (ah - dh) / 2)} cm /I${j} Do Q\n`; }
      else { const k = Math.min(aw / sz.h, ah / sz.w), dw = sz.h * k, dh = sz.w * k, x0 = ax + (aw - dw) / 2, y0 = ay + (ah - dh) / 2; cs += `q 0 ${f(dh)} ${f(-dw)} 0 ${f(x0 + dw)} ${f(y0)} cm /I${j} Do Q\n`; }
      xo += `/I${j} ${im} 0 R `;
    });
    const content = add({ stream: Buffer.from(cs, 'latin1') });
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /XObject << ${xo}>> >> /Contents ${content} 0 R >>`));
  }
  objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const out = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')], offs = []; let pos = out[0].length;
  objs.forEach((o, i) => {
    let b;
    if (o && o.img) b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${o.w} /Height ${o.h} /ColorSpace ${o.c} /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.img.length} >>\nstream\n`, 'latin1'), o.img, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    else if (o && o.stream) b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.stream.length} >>\nstream\n`, 'latin1'), o.stream, Buffer.from('endstream\nendobj\n', 'latin1')]);
    else b = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
    offs.push(pos); out.push(b); pos += b.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  out.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(out);
}

// ---------- printer ki haalat (Roman Urdu) ----------
function stateOf(A) {
  if (!A) return { k: 'bad', t: '✕ Printer jawab nahi de raha (band / WiFi se bahar?)' };
  const s = Number((A['printer-state'] || [])[0]) || 3, R = (A['printer-state-reasons'] || []).map(String).filter(r => r && r !== 'none');
  const has = re => R.some(r => re.test(r)), ink = [];
  const nm = A['marker-names'] || [], lv = A['marker-levels'] || [], co = A['marker-colors'] || [];
  for (let i = 0; i < Math.min(nm.length, lv.length, 8); i++) ink.push({ n: String(nm[i] || '').slice(0, 40), l: Number(lv[i]), c: String(co[i] || '').slice(0, 20) });
  let k = 'ok', t = '✅ Tayyar';
  if (has(/media-empty|media-needed/)) { k = 'bad'; t = '⚠️ Kaghaz khatam — tray mein A4 daalein'; }
  else if (has(/media-jam/)) { k = 'bad'; t = '⚠️ Kaghaz phans gaya'; }
  else if (has(/door-open|cover-open/)) { k = 'bad'; t = '⚠️ Printer ka dhakkan khula'; }
  else if (has(/marker-supply-empty|toner-empty/)) { k = 'bad'; t = '⚠️ Ink / toner khatam'; }
  else if (has(/offline|shutdown|stopped-partly/) || s === 5) { k = 'bad'; t = '✕ Printer ruka / band'; }
  else if (has(/marker-supply-low|toner-low|ink-low/) || ink.some(x => x.l >= 0 && x.l <= 10)) { k = 'warn'; t = '🟡 Ink kam — jaldi badlein'; }
  else if (s === 4) { k = 'ok'; t = '🖨 Chhap raha hai'; }
  return { k, t, ink };
}

// ---------- WiFi par printer dhoondna ----------
function lanHosts(extra = []) {
  const subs = new Set(), mine = new Set();
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
    if (a.family !== 'IPv4' && a.family !== 4) continue; if (a.internal) continue;
    if (!/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a.address)) continue;
    mine.add(a.address); subs.add(a.address.split('.').slice(0, 3).join('.'));
  }
  const out = []; for (const x of extra) if (/^\d{1,3}(\.\d{1,3}){3}$/.test(String(x).trim())) out.push(String(x).trim());
  for (const s of subs) for (let i = 1; i < 255; i++) { const h = s + '.' + i; if (!mine.has(h) && !out.includes(h)) out.push(h); }
  return out;
}
function probe(host, port, ms) {
  return new Promise(res => { const s = net.connect({ host, port }); let done = false; const end = ok => { if (done) return; done = true; try { s.destroy(); } catch {} res(ok); };
    s.setTimeout(ms, () => end(false)); s.on('connect', () => end(true)); s.on('error', () => end(false)); });
}
async function poolMap(arr, n, fn) { const out = new Array(arr.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (i < arr.length) { const j = i++; out[j] = await fn(arr[j]); } })); return out; }
const PATHS = ['/ipp/print', '/ipp/printer', '/ipp', '/'];
async function describeIpp(ip, port = 631) {
  for (const pth of PATHS) {
    const p = { ip, port, path: pth };
    try { const A = await ippAttrs(p, 6000); const name = String((A['printer-make-and-model'] || A['printer-info'] || A['printer-name'] || ['Printer'])[0] || 'Printer').trim();
      const uuid = String((A['printer-uuid'] || [''])[0] || '').replace(/^urn:uuid:/i, '');
      return { id: 'ipp:' + (uuid || ip), how: 'ipp', name: name.slice(0, 60), ip, port, path: pth, tls: !!p.tls, a: A, fmt: (A['document-format-supported'] || []).map(String) };
    } catch (e) { if (/ECONNREFUSED|EHOSTUNREACH|ETIMEDOUT/i.test(String(e.code || e.message))) break; }
  }
  return null;
}
async function scanIpp(extra) {
  const hosts = lanHosts(extra), t0 = Date.now();
  const open = (await poolMap(hosts, 96, async h => (await probe(h, 631, 450)) ? h : null)).filter(Boolean);
  const found = (await poolMap(open, 6, h => describeIpp(h))).filter(Boolean);
  log(`🔎 WiFi par ${hosts.length} jagah dekhi · 631 khula ${open.length} · printer ${found.length} (${Date.now() - t0} ms)`);
  return found;
}

// ---------- Windows (PowerShell) ----------
const PS_LIST = `$ErrorActionPreference = 'SilentlyContinue'
$ports = @{}
foreach ($x in @(Get-PrinterPort)) { $ports[[string]$x.Name] = [string]$x.PrinterHostAddress }
$out = @()
foreach ($x in @(Get-Printer)) { $out += [pscustomobject]@{ n = [string]$x.Name; d = [string]$x.DriverName; port = [string]$x.PortName; ip = [string]$ports[[string]$x.PortName]; st = [string]$x.PrinterStatus } }
ConvertTo-Json -Compress -InputObject @($out)
`;
const PS_PRINT = `param([string]$Printer, [string]$Files, [int]$Copies = 1, [int]$Up = 1)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$imgs = New-Object System.Collections.ArrayList
foreach ($f in ($Files -split '\\|')) {
  if (-not $f) { continue }
  $im = [System.Drawing.Image]::FromFile($f)
  try {
    $o = [int]$im.GetPropertyItem(274).Value[0]
    if ($o -eq 3) { $im.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
    elseif ($o -eq 6) { $im.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
    elseif ($o -eq 8) { $im.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
  } catch {}
  [void]$imgs.Add($im)
}
if ($imgs.Count -eq 0) { Write-Output 'ERR:tasveer nahi mili'; exit 2 }
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $Printer
if (-not $pd.PrinterSettings.IsValid) { Write-Output 'ERR:Windows mein yeh printer nahi mila'; exit 3 }
foreach ($ps in $pd.PrinterSettings.PaperSizes) { if ($ps.Kind -eq [System.Drawing.Printing.PaperKind]::A4) { $pd.DefaultPageSettings.PaperSize = $ps; break } }
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(20, 20, 20, 20)
if ($Copies -gt 1) { $pd.PrinterSettings.Copies = [int16]$Copies }
$pd.DocumentName = 'Blue Khata A4'
$pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$script:i = 0
function Put($g, $im, $a) {
  $use = $im
  if ((($a.Width -gt $a.Height) -ne ($im.Width -gt $im.Height)) -and [math]::Abs($im.Width - $im.Height) -gt 8) { $use = $im.Clone(); $use.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
  $k = [math]::Min($a.Width / $use.Width, $a.Height / $use.Height)
  $w = [int]($use.Width * $k); $h = [int]($use.Height * $k)
  $g.DrawImage($use, [int]($a.X + ($a.Width - $w) / 2), [int]($a.Y + ($a.Height - $h) / 2), $w, $h)
}
$pd.add_QueryPageSettings({ param($s, $e)
  if ($Up -ne 2 -and $script:i -lt $imgs.Count) { $e.PageSettings.Landscape = ($imgs[$script:i].Width -gt $imgs[$script:i].Height + 8) } })
$pd.add_PrintPage({ param($s, $e)
  $g = $e.Graphics
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $b = $e.MarginBounds
  if ($Up -eq 2) {
    $h = [int](($b.Height - 12) / 2)
    $top = New-Object System.Drawing.Rectangle($b.X, $b.Y, $b.Width, $h)
    $bot = New-Object System.Drawing.Rectangle($b.X, ($b.Y + $h + 12), $b.Width, $h)
    foreach ($a in @($top, $bot)) { if ($script:i -lt $imgs.Count) { Put $g $imgs[$script:i] $a; $script:i++ } }
  } else { Put $g $imgs[$script:i] $b; $script:i++ }
  $e.HasMorePages = ($script:i -lt $imgs.Count)
})
try { $pd.Print(); Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message); exit 4 } finally { foreach ($im in $imgs) { $im.Dispose() } }
`;
const PS_ADD = `param([string]$Name, [string]$Url)
try { Add-Printer -Name $Name -IppURL $Url -ErrorAction Stop; Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`;
const PS_TEST = `param([string]$Out, [string]$Line)
Add-Type -AssemblyName System.Drawing
$W = 1654; $H = 2339
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$bmp.SetResolution(200, 200)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$navy = [System.Drawing.Color]::FromArgb(34, 59, 109)
$g.DrawRectangle((New-Object System.Drawing.Pen($navy, 6)), 40, 40, ($W - 80), ($H - 80))
$cp = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 5)
foreach ($c in @(@(60, 60, 1, 1), @(($W - 60), 60, -1, 1), @(60, ($H - 60), 1, -1), @(($W - 60), ($H - 60), -1, -1))) { $g.DrawLine($cp, $c[0], $c[1], ($c[0] + 90 * $c[2]), $c[1]); $g.DrawLine($cp, $c[0], $c[1], $c[0], ($c[1] + 90 * $c[3])) }
$f1 = New-Object System.Drawing.Font('Segoe UI', 64, [System.Drawing.FontStyle]::Bold)
$f2 = New-Object System.Drawing.Font('Segoe UI', 28)
$br = New-Object System.Drawing.SolidBrush($navy)
$g.DrawString('Noor Traders', $f1, $br, 130, 170)
$g.DrawString('Blue Khata - A4 printer test page', $f2, $br, 136, 300)
$g.DrawString($Line, $f2, [System.Drawing.Brushes]::Black, 136, 360)
$g.DrawLine((New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 4)), 136, 560, 923, 560)
$g.DrawString('Yeh lakeer scale se 100 mm honi chahiye', $f2, [System.Drawing.Brushes]::Black, 136, 580)
$cols = @([System.Drawing.Color]::FromArgb(0, 174, 239), [System.Drawing.Color]::FromArgb(236, 0, 140), [System.Drawing.Color]::FromArgb(255, 221, 0), [System.Drawing.Color]::Black)
for ($i = 0; $i -lt 4; $i++) { $g.FillRectangle((New-Object System.Drawing.SolidBrush($cols[$i])), (136 + $i * 260), 760, 220, 220) }
$g.DrawString('Chaaron kone ke nishan poore nazar aayein = A4 theek', $f2, [System.Drawing.Brushes]::Black, 136, 1040)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Jpeg)
Write-Output 'OK'
`;
function psFile(name, body) { const f = path.join(DIR, name); try { const want = '﻿' + body; if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== want) fs.writeFileSync(f, want, 'utf8'); } catch {} return f; }
function ps(name, body, args = [], ms = 60000) {
  return new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psFile(name, body), ...args.map(String)], { timeout: ms, windowsHide: true, maxBuffer: 4 << 20 },
    (e, out, er) => res({ ok: !e, out: String(out || '').trim(), err: String(String(er || '').trim() || (e && e.message) || '').trim() })));
}
const SKIP_WIN = /microsoft print to pdf|xps|onenote|fax|send to|adobe pdf|foxit|cutepdf|anydesk|tm-t\d|tm-t88|epson tm|pos-?\d|thermal|receipt|xprinter|tsc |tsc_|zebra|godex|label|barcode|bixolon|rongta|sewoo/i;
async function winList() {
  if (process.platform !== 'win32') return [];
  const r = await ps('a4-list.ps1', PS_LIST, [], 30000); if (!r.ok || !r.out) return [];
  let L = []; try { L = JSON.parse(r.out.slice(r.out.indexOf('['))); } catch { return []; } if (!Array.isArray(L)) L = [L];
  return L.filter(x => x && x.n && !SKIP_WIN.test(x.n + ' ' + x.d)).map(x => ({ id: 'win:' + x.n, how: 'win', name: String(x.n).slice(0, 60), drv: String(x.d || '').slice(0, 60), ip: /^\d{1,3}(\.\d{1,3}){3}$/.test(x.ip || '') ? x.ip : (String(x.port || '').match(/(\d{1,3}(?:\.\d{1,3}){3})/) || [])[1] || '', wst: String(x.st || '') }));
}
async function winPrint(name, files, o = {}) {
  const r = await ps('a4-gdi.ps1', PS_PRINT, [name, files.join('|'), Math.max(1, Math.min(5, Number(o.copies) || 1)), o.up === 2 ? 2 : 1], 180000);
  if (r.out.startsWith('OK')) return true;
  throw Error((r.out.replace(/^ERR:/, '') || r.err || 'Windows print nahi hua').slice(0, 160));
}
async function winAdd(p) {
  const name = ('Blue Khata A4 - ' + (p.name || p.ip)).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60);
  const r = await ps('a4-add.ps1', PS_ADD, [name, `http://${p.ip}:${p.port || 631}${p.path || '/ipp/print'}`], 120000);
  if (r.out.startsWith('OK') || /already exists|pehle se/i.test(r.out)) { log(`➕ Windows mein printer jora: ${name}`); return name; }
  throw Error('Windows mein printer nahi jura: ' + (r.out.replace(/^ERR:/, '') || r.err).slice(0, 120));
}
async function testJpg() {
  const f = path.join(DIR, 'a4tmp', 'a4-test.jpg'); fs.mkdirSync(path.dirname(f), { recursive: true });
  const r = await ps('a4-test.ps1', PS_TEST, [f, new Date().toLocaleString('en-PK') + ' - ' + os.hostname()], 60000);
  if (!r.out.startsWith('OK') || !fs.existsSync(f)) throw Error('Test page nahi bana: ' + (r.out || r.err).slice(0, 100));
  return fs.readFileSync(f);
}

// ---------- 🧾 THERMAL parchi (TM-T88IV) — tasveer + number ----------
const RAW_PS = String.raw`param([string]$Printer, [string]$Bin)
$ErrorActionPreference='Stop'
$bytes=[System.IO.File]::ReadAllBytes($Bin)
$dll=Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'RawCached.dll'
if(!(Test-Path $dll)){ Add-Type -TypeDefinition @"
using System;using System.IO;using System.Runtime.InteropServices;
public class RawCached{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DI{[MarshalAs(UnmanagedType.LPWStr)]public string n;[MarshalAs(UnmanagedType.LPWStr)]public string o;[MarshalAs(UnmanagedType.LPWStr)]public string t;}
 [DllImport("winspool.Drv",EntryPoint="OpenPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string p,out IntPtr h,IntPtr d);
 [DllImport("winspool.Drv",EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartDocPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h,int l,ref DI di);
 [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
 public static void Send(string printer,byte[] data,string doc){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))throw new Exception("printer nahi mila: "+printer);
  DI di=new DI();di.n=doc;di.t="RAW";StartDocPrinter(h,1,ref di);StartPagePrinter(h);
  IntPtr p=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,p,data.Length);int w;WritePrinter(h,p,data.Length,out w);
  Marshal.FreeCoTaskMem(p);EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h);}
}
"@ -OutputAssembly $dll }
Add-Type -Path $dll
[RawCached]::Send($Printer,$bytes,'A4 screen photo')
Write-Output 'OK'
`;
const phClean = v => String(v || '').replace(/[^0-9+\-() ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
// parchi: NOOR TRADERS · tasveer (photo-print, poori chaurai, 8 cm tak, kaat-na nahi) · number BARA (2x) · waqt · kaato
function thermalBytes(jpg, ph, copies = 1) {
  let PH = null; try { PH = require('./photo-print.js'); } catch {}
  const ESC = '\x1b', GS = '\x1d', p = phClean(ph), t = new Date();
  const photo = PH && PH.photoRaster ? PH.photoRaster('data:image/jpeg;base64,' + jpg.toString('base64'), 512, 640, { crop: 0 }) : '';
  if (!photo) throw Error('tasveer thermal ke liye nahi bani');
  let one = ESC + '@' + ESC + 'a\x01' + ESC + 'E\x01' + 'NOOR TRADERS' + ESC + 'E\x00' + '\r\n' + photo + ESC + 'a\x01';
  if (p) one += GS + '!\x11' + ESC + 'E\x01' + p + ESC + 'E\x00' + GS + '!\x00' + '\r\n';
  one += t.toLocaleDateString('en-GB') + ' ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '\r\n\r\n' + GS + 'V\x42\x00';
  return Buffer.from(one.repeat(Math.max(1, Math.min(3, Number(copies) || 1))), 'latin1');
}
async function thermalPrint(jpg, ph, copies) {
  if (process.platform !== 'win32') throw Error('thermal sirf Windows PC par');
  const bin = path.join(DIR, 'a4tmp', 'th-' + Date.now() + '.bin'); fs.mkdirSync(path.dirname(bin), { recursive: true });
  fs.writeFileSync(bin, thermalBytes(jpg, ph, copies));
  try {
    const r = await ps('a4-raw.ps1', RAW_PS, ['-Printer', TH_PRINTER, '-Bin', bin], 45000);
    if (!r.out.includes('OK')) throw Error(('Thermal: ' + (r.err || r.out || 'print nahi hua').split(/\r?\n/)[0]).slice(0, 160));
  } finally { try { fs.unlinkSync(bin); } catch {} }
}

// ---------- kaun sa printer ----------
// cfg.pr = app mein chuna (id) · na ho = HP wala WiFi (IPP) → HP Windows → akela IPP
function pick(cfg, L) {
  if (cfg && cfg.pr) { const x = L.find(p => p.id === cfg.pr) || (cfg.prIp && L.find(p => p.ip === cfg.prIp && p.how === 'ipp')); if (x) return x; }
  const hp = p => /\bhp\b|hewlett|laserjet|deskjet|officejet|smart tank|ink tank|envy/i.test(p.name + ' ' + (p.drv || ''));
  const ipp = L.filter(p => p.how === 'ipp');
  return ipp.find(hp) || L.find(p => p.how === 'win' && hp(p)) || (ipp.length === 1 ? ipp[0] : null);
}
const pubOf = p => ({ id: p.id, how: p.how, name: p.name, ip: p.ip || '', ...(p.how === 'ipp' ? { fmt: (p.fmt || []).filter(f => /jpeg|pdf|urf|pwg|pclm/i.test(f)).slice(0, 6).join(' '), win: p.win || '' } : { drv: p.drv || '', wst: p.wst || '' }) });

if (require.main === module) main();
module.exports = { thermalBytes, phClean, ippEncode, ippDecode, ippAttrs, ippPrint, describeIpp, jpegSize, pdfOf, stateOf, lanHosts, pick, pubOf, VT, PS_PRINT, PS_LIST, PS_ADD, PS_TEST };

function main() {
  const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(DIR, 'a4-print.alive'), w = () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000); return { guard: fn => fn }; } })();
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
  const db = getFirestore(), B = db.collection('businesses').doc(BUSINESS_ID);
  const JOBS = B.collection('a4Jobs'), IMGS = B.collection('a4Img'), CFG = B.collection('blueAccess').doc('a4'), PCD = B.collection('blueAccess').doc('a4Pc');
  const TMP = path.join(DIR, 'a4tmp'); try { fs.mkdirSync(TMP, { recursive: true }); } catch {}
  let cfg = {}, list = [], lastScan = 0, scanning = null, cur = null, st = null, stAt = 0, queue = [], busy = false, recent = [], lastPub = '', lastBeat = 0, err = '', lastTest = 0, lastScanReq = 0;
  const cap = () => Math.max(5, Math.min(500, Number(cfg.max) || 40));
  const over = () => { const h = Date.now() - 3600000; recent = recent.filter(t => t > h); return recent.length >= cap(); };

  async function publish(force) {
    const doc = { host: os.hostname(), ver: VER, list: list.map(pubOf).slice(0, 20), use: cur ? pubOf(cur) : null, st: st || null, err: err || '', scanAt: lastScan, testAt: lastTest };
    const h = JSON.stringify(doc);
    if (!force && h === lastPub && Date.now() - lastBeat < BEAT) return;
    lastPub = h; lastBeat = Date.now();
    await PCD.set({ ...doc, at: Date.now() }).catch(e => log('⚠️ a4Pc: ' + e.message));
  }
  async function scan(why) {
    if (scanning) return scanning;
    scanning = (async () => {
      try {
        const extra = String(cfg.ip || '').split(/[\s,]+/).filter(Boolean);
        const [ipp, win] = await Promise.all([scanIpp(extra).catch(e => { log('⚠️ WiFi dhoondna: ' + e.message); return []; }), winList().catch(() => [])]);
        for (const p of ipp) { const w = win.find(x => x.ip && x.ip === p.ip) || win.find(x => /^Blue Khata A4/i.test(x.name) && x.name.includes(p.name.slice(0, 20))); if (w) p.win = w.name; }
        const old = cur; list = [...ipp, ...win]; lastScan = Date.now();
        cur = pick(cfg, list) || (old && cfg.pr === old.id ? old : null);   // chuna hua kuch der na mile to purana hi (IP wahi)
        err = cur ? '' : list.length ? 'Printer chunein (app ⋮ → 🖨 Printer)' : 'WiFi par koi printer nahi mila — printer ON ho aur isi WiFi / router par';
        log(`🖨 ${why || 'dhoonda'}: ${list.length} printer · istemal: ${cur ? cur.name + (cur.ip ? ' (' + cur.ip + ')' : '') : '—'}`);
        await status();
        await publish(true);
      } finally { scanning = null; }
    })();
    return scanning;
  }
  async function status() {
    if (!cur) { st = null; return; }
    if (cur.how === 'ipp') { try { cur.a = await ippAttrs(cur, 8000); cur.fmt = (cur.a['document-format-supported'] || cur.fmt || []).map(String); st = stateOf(cur.a); } catch { st = stateOf(null); } }
    else { const w = (await winList().catch(() => [])).find(x => x.name === cur.name); st = !w ? { k: 'bad', t: '✕ Windows mein printer nahi mila' } : /offline|error|paperout|paper/i.test(w.wst) ? { k: 'bad', t: '⚠️ ' + w.wst } : { k: 'ok', t: '✅ Tayyar (Windows)' }; }
    stAt = Date.now();
  }
  const imgOf = async id => { const s = await IMGS.doc(id).get(); const u = s.exists ? String(s.data().img || '') : ''; const m = u.match(/^data:image\/jpe?g;base64,(.+)$/i); if (!m) throw Error('tasveer nahi mili'); return Buffer.from(m[1], 'base64'); };
  async function claim(id) {
    const ref = JOBS.doc(id);
    return db.runTransaction(async tx => {
      const s = await tx.get(ref); if (!s.exists) return null; const d = s.data(); if (d.status !== 'new') return null;
      const t0 = s.updateTime ? s.updateTime.toMillis() : Number(d.at) || 0;   // server ka waqt (dobara = naya waqt)
      if (Date.now() - t0 > OLD_MS) { tx.update(ref, { status: 'old', err: '30 min se purani — 🖨 Dobara dabao', pcAt: Date.now() }); return null; }
      if (!d.ok && over()) { tx.update(ref, { status: 'hold', err: `Ek ghante mein ${cap()} se zyada — malik ✓ kare`, pcAt: Date.now() }); return null; }
      tx.update(ref, { status: 'printing', pcAt: Date.now() });
      return { id, ...d };
    });
  }
  async function printSet(jobs, testBuf) {
    const bufs = [];
    for (const j of jobs) bufs.push(testBuf || await imgOf(j.id));
    const copies = Math.max(1, Math.min(5, Number(jobs[0].copies) || Number(cfg.copies) || 1)), up = jobs.length === 2 ? 2 : 1, name = jobs.map(j => j.t || 'Tasveer').join(' + ').slice(0, 60);
    const files = bufs.map((b, i) => { const f = path.join(TMP, (jobs[i].id || 'test') + '.jpg'); fs.writeFileSync(f, b); return f; });
    try {
      if (cur.how === 'win') { await winPrint(cur.name, files, { copies, up }); return 'win'; }
      const F = cur.fmt || [], jpeg = F.includes('image/jpeg'), pdf = F.includes('application/pdf');
      if (up === 2 && pdf) { await ippPrint(cur, pdfOf(bufs, 2), 'application/pdf', { copies, name }); return 'ipp-pdf'; }
      if (up === 2 && cur.win) { await winPrint(cur.win, files, { copies, up }); return 'win'; }
      if (up === 1 && jpeg) { try { await ippPrint(cur, bufs[0], 'image/jpeg', { copies, name }); return 'ipp'; } catch (e) { if (e.ipp !== 0x040A) throw e; } }
      if (pdf) { try { await ippPrint(cur, pdfOf(bufs, up), 'application/pdf', { copies, name }); return 'ipp-pdf'; } catch (e) { if (e.ipp !== 0x040A) throw e; } }
      if (process.platform !== 'win32') throw Error('printer JPEG / PDF nahi leta');
      if (!cur.win) cur.win = await winAdd(cur);   // printer JPEG / PDF nahi leta → Windows ka driver (ek dafa)
      await winPrint(cur.win, files, { copies, up }); return 'win';
    } finally { for (const f of files) { try { fs.unlinkSync(f); } catch {} } }
  }
  async function work() {
    if (busy) return; busy = true;
    try {
      while (queue.length) {
        const pk = await JOBS.doc(queue[0]).get().catch(() => null), to = pk && pk.exists ? String(pk.data().to || 'a4') : 'a4';
        if (to === 'th') {   // 🧾 thermal — HP ki zaroorat nahi
          const j = await claim(queue.shift()).catch(e => { log('⚠️ claim: ' + e.message); return null; }); if (!j) continue;
          try { const b = await imgOf(j.id); await thermalPrint(b, j.ph, j.copies); recent.push(Date.now());
            await JOBS.doc(j.id).update({ status: 'done', doneAt: Date.now(), pr: TH_PRINTER, how: 'thermal', err: '' }).catch(() => {}); log(`🧾 ✅ ${j.t || j.id} → ${TH_PRINTER}`); }
          catch (e) { const m = String(e.message || e).slice(0, 160); await JOBS.doc(j.id).update({ status: 'failed', err: m, pcAt: Date.now() }).catch(() => {}); log(`🧾 ✕ ${j.t || j.id}: ${m}`); }
          continue;
        }
        if (!cur) { await scan('job aaya'); if (!cur) { log('⏳ ' + queue.length + ' tasveer — printer nahi mila, 2 min baad dobara'); break; } }
        const first = await claim(queue.shift()).catch(e => { log('⚠️ claim: ' + e.message); return null; }); if (!first) continue;
        const jobs = [first];
        if (Number(cfg.up) === 2) {
          const twoOk = cur.how === 'win' || cur.win || (cur.fmt || []).includes('application/pdf');
          if (twoOk) { const t = Date.now(); while (!queue.length && Date.now() - t < 15000) await new Promise(r => setTimeout(r, 500));
            if (queue.length) { const p2 = await JOBS.doc(queue[0]).get().catch(() => null); if (p2 && p2.exists && String(p2.data().to || 'a4') !== 'th') { const s2 = await claim(queue.shift()).catch(() => null); if (s2) jobs.push(s2); } } }
        }
        const t0 = Date.now();
        try {
          const how = await printSet(jobs);
          for (const j of jobs) { recent.push(Date.now()); await JOBS.doc(j.id).update({ status: 'done', doneAt: Date.now(), pr: cur.name.slice(0, 60), how, err: '' }).catch(() => {}); }
          log(`✅ ${jobs.map(j => j.t || j.id).join(' + ')} → ${cur.name} (${how}, ${Date.now() - t0} ms)`);
          if (err) { err = ''; await publish(true); }
        } catch (e) {
          const m = String(e.message || e).slice(0, 160);
          for (const j of jobs) await JOBS.doc(j.id).update({ status: 'failed', err: m, pcAt: Date.now() }).catch(() => {});
          log(`✕ ${jobs.map(j => j.t || j.id).join(' + ')}: ${m}`);
          err = m; await status().catch(() => {}); await publish(true);
          if (/ECONN|EHOST|timeout|jawab/i.test(m)) cur = null;   // printer ghaib — agli dafa dobara dhoondo
        }
      }
    } finally { busy = false; }
  }
  async function testPage() {
    if (!cur) await scan('test page');
    if (!cur) { err = 'Test page: printer nahi mila'; await publish(true); return; }
    try { const b = await testJpg(); const how = await printSet([{ id: 'test', t: 'Test page' }], b); err = ''; log('🧪 Test page → ' + cur.name + ' (' + how + ')'); }
    catch (e) { err = 'Test page: ' + String(e.message || e).slice(0, 140); log('✕ ' + err); }
    await status().catch(() => {}); await publish(true);
  }
  async function cleanup() {
    const old = Date.now() - KEEP_MS;
    try {
      const s = await JOBS.where('at', '<', old).limit(200).get();
      if (s.empty) return; const b = db.batch();
      for (const d of s.docs) { b.delete(d.ref); b.delete(IMGS.doc(d.id)); }
      await b.commit(); log(`🧹 ${s.size} purane A4 job (7 din+) mita diye`);
    } catch (e) { log('⚠️ safai: ' + e.message); }
  }

  const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
  lock.on('error', () => { console.log('a4-print pehle se chal raha hai — yeh copy band.'); process.exit(3); });
  lock.on('listening', async () => {
    log(`a4-print v${VER} shuru — 🖨 app ki tasveer → A4 printer`);
    CFG.onSnapshot(s => {
      const prev = cfg; cfg = s.exists ? s.data() || {} : {};
      if (prev.pr !== cfg.pr || prev.ip !== cfg.ip) { cur = pick(cfg, list) || null; if (!cur || prev.ip !== cfg.ip) scan('setting badli').catch(() => {}); else status().then(() => publish(true)).catch(() => {}); }
      const sr = Number(cfg.scanAt) || 0; if (sr > lastScanReq) { lastScanReq = sr; if (Date.now() - sr < 10 * 60000) scan('malik ne kaha').catch(() => {}); }
      const tr = Number(cfg.testAt) || 0; if (tr > lastTest) { lastTest = tr; if (Date.now() - tr < 10 * 60000) testPage().catch(() => {}); }
    }, e => log('⚠️ a4 setting: ' + e.message));
    await new Promise(r => setTimeout(r, 1500));
    lastTest = Math.max(lastTest, Number(cfg.testAt) || 0); lastScanReq = Math.max(lastScanReq, Number(cfg.scanAt) || 0);
    await scan('shuru').catch(e => log('⚠️ ' + e.message));
    JOBS.where('status', '==', 'new').onSnapshot(s => {
      for (const d of s.docs) if (!queue.includes(d.id)) queue.push(d.id);
      work().catch(e => log('⚠️ ' + e.message));
    }, e => { log('⚠️ a4Jobs: ' + e.message); if (e.code === 16 || /UNAUTHENTICATED/.test(String(e.message))) process.exit(1); });
    const tick = async () => {
      if (Date.now() - lastScan > (cur ? SCAN_EVERY * 3 : SCAN_EVERY) || (queue.length && !cur && Date.now() - lastScan > 120000)) await scan('waqt').catch(() => {});
      else if (cur && Date.now() - stAt > ST_EVERY) await status().catch(() => {});
      await publish(false);
      if (queue.length && !busy) work().catch(() => {});
    };
    setInterval(ZINDA.guard(tick, 10 * 60000, 'a4 tick'), 20000);
    setInterval(() => cleanup().catch(() => {}), 6 * 3600000); setTimeout(() => cleanup().catch(() => {}), 60000);
  });
}
