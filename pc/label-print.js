// =========================================================
//  label-print.js  v4.0 (2026-10-07: 🖨 LIVE + ✕ CANCEL — har hissa (8 qatar) bhejne se pehle labelJobs.cancelReq dekho; printer ki Windows
//                     line mein 1 se zyada ho to ruko (ginti 'sent' asal chhapai ke qareeb, cancel foran); cancel = line saaf (Remove-PrintJob),
//                     status 'cancelled'; line mein hi cancel = chhapega nahi) · v3.9 (2026-10-06: 🔤 urduMode 'ttf' — Urdu TASVEER nahi, TEXT: Windows ka TTF font (tahoma) ek dafa printer ke flash mein
//                     (DOWNLOAD F,"UR.TTF"), harf urdu-shape.js se jure hue (presentation forms) + visual order; CODEPAGE UTF-8.
//                     --test-urdu [font] = ek qatar test. Data: har label par ~30 byte (tasveer 300-1600 thi)) · v3.8 (2026-10-06: ⚠ PUTBMP par TSC ~30-36 label ke baad ruk jata tha -> wapas BITMAP magar Urdu tasveer sirf
//                     likhai jitni (kaat kar, 2-4 guna chhoti) + bara order 8-8 qatar (24 label) ke ALAG print jobs mein) · v3.7 (2026-10-06: ⚡ Urdu tasveer printer ko EK dafa (DOWNLOAD "UR.BMP"), har label par sirf PUTBMP — job 158-357 KB se
//                     ~10 KB; labels ruk ruk kar nahi nikalte / "Error - Printing" nahi. label-settings "urduMode": "bitmap" = purana) · v3.6 (2026-10-05: Urdu raster upar/neeche padding px*0.35 — Nastaleeq ka sar kat-ta tha; default font Tahoma 24) · v3.5 (2026-10-05: lamba naam 2 line (char 14 dot), Urdu 46 dot tak, barcode 24/20%) · v3.4 (2026-10-05: English naam ke neeche URDU naam — blueAccess/urduNames, PowerShell raster -> TSPL BITMAP; label-settings urdu/urduFont/urduPx/urduInvert)
//  v3.3 (2026-09-24: number har BARCODE ka apna — ek item ke sub-barcode alag alag 1 se; dobara chhapne par aage se)
//  v3.2 (number barcode ke code wali line par dayen — naam 2 line ho to bhi theek)
//  v3.1 (number font 2, rate ki line 4 dot upar — neeche kat rahi thi)
//  v3 (2026-09-24: har label par NUMBER — roz 1 se, har item ka apna; tolai ki ginti ke liye)
//  v2.1 (2026-09-20, 3 columns, label-settings.json, --calibrate) â€” Blue Khata app se BARCODE LABEL print (TSC TTP-244 Pro)
//  App (Stock tab -> item -> ðŸ·ï¸ Label) Firestore "labelJobs" mein hukum likhti hai; yeh script usay
//  TSC printer par TSPL mein seedha chhapti hai. SQL / POS mein KUCH nahi likhti.
//  Chalana:  node label-print.js            (label-auto.bat loop mein chalata hai)
//            node label-print.js --test     (ek test label: "TEST LABEL" / 1234567890128)
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ---------------- SETTINGS ----------------
// Label ka naap label-settings.json mein hai (isi folder mein) â€” wahan badlein, script ko haath na lagayein.
const BUSINESS_ID = 'noor-traders';
const { shape: urduShape } = require('./urdu-shape.js');   // v3.9
const DEFAULTS = {
  printer: 'TSC TTP-244 Pro',   // Devices and Printers wala naam
  cols: 3,                      // ek qatar mein kitne labels (roll par 3)
  w: 32, h: 25,                 // EK label ki chaurai / unchai (mm)
  colGap: 3, rowGap: 3,         // labels ke beech gap (mm): dayen-bayen / upar-neeche
  xOffset: 0, yOffset: 0,       // poori qatar ko khiskana (mm) â€” bayen kate to + karein
  showRate: true, speed: 4, density: 8,
  urdu: true,                   // v3.4: English naam ke neeche URDU naam (blueAccess/urduNames se), tasveer bana kar
  urduFont: 'Tahoma,Segoe UI,Arial,Jameel Noori Nastaleeq',   // v3.6: Naskh (Tahoma) chhote label par saaf; Nastaleeq upar se kat-ta tha
  urduPx: 24,                   // Urdu harf ki unchai (dots)
  urduBold: false,              // v3.9.2: Urdu HALKE harf (malik: 'haroof halka') — true = mote
  urduInvert: false,            // agar Urdu ki jagah kala block aaye to true kar dein
  urduMode: 'bitmap',           // v3.9.2 default bitmap (malik: tasveer wali shakl theek thi) · v3.8: 'bitmap' (kati hui chhoti tasveer har label par). 'putbmp-test' = DOWNLOAD/PUTBMP (TSC ~35 label baad rukta tha)
  urduTtf: 'C:\\Windows\\Fonts\\tahomabd.ttf',   // v3.9: urduMode 'ttf' ke liye font (bold Tahoma); 'arialbd.ttf' bhi chal sakta
  urduPt: 10,                   // v3.9.1: TTF Urdu ka size (POINT — TSC mein TTF ka size point mein, 26 = bohat bara tha)
  urduReverse: false,           // v3.9.1: false = printer khud RTL karta hai (test: ulta aaya tha)
  rowsPerJob: 8                 // v3.8: itni qataron (x cols label) ka EK print job — printer ka buffer na bhare
};
const LOCK_PORT = 47816;
// -----------------------------------------------------------------

const DIR = __dirname;
// 2026-10-01 HEARTBEAT: har 30 sec '<script>.alive' mein waqt — doctor 3 min purana dekhe to script ko latki samajh kar dobara chalata hai
{ const _hb = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'); const _w = () => { try { require('fs').writeFileSync(_hb, String(Date.now())); } catch {} }; _w(); setInterval(_w, 30000).unref(); }
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
// ---- v3.4: URDU raster (PowerShell/System.Drawing) -> TSPL BITMAP (1 bit, TSPL mein 0 = kala) ----
const PS_UR = path.join(DIR, 'urdu-raster.ps1');
const PS_UR_TXT = `param([string]$text,[string]$fonts,[single]$px,[int]$width,[string]$out,[int]$bold=1)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$inst=New-Object System.Drawing.Text.InstalledFontCollection
$fam='Arial'; foreach($n in $fonts.Split(',')){ $t=$n.Trim(); foreach($ff in $inst.Families){ if($ff.Name -ieq $t){ $fam=$ff.Name; break } }; if($fam -ne 'Arial'){ break } }
$st=[System.Drawing.FontStyle]::Regular; if($bold -eq 1){ $st=[System.Drawing.FontStyle]::Bold }
$f=New-Object System.Drawing.Font($fam,$px,$st,[System.Drawing.GraphicsUnit]::Pixel)
$sf=New-Object System.Drawing.StringFormat; $sf.Alignment=[System.Drawing.StringAlignment]::Near; $sf.FormatFlags=[System.Drawing.StringFormatFlags]::DirectionRightToLeft
$b0=New-Object System.Drawing.Bitmap 10,10; $g0=[System.Drawing.Graphics]::FromImage($b0); $sz=$g0.MeasureString($text,$f,$width,$sf); $pad=[int][Math]::Ceiling($px*0.35); $h=[int][Math]::Ceiling($sz.Height)+$pad*2; $g0.Dispose(); $b0.Dispose()
$bmp=New-Object System.Drawing.Bitmap $width,$h; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White)
$g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.DrawString($text,$f,[System.Drawing.Brushes]::Black,(New-Object System.Drawing.RectangleF 0,$pad,$width,$h),$sf); $g.Dispose()
$wb=[int][Math]::Ceiling($width/8); $out1=New-Object System.Collections.Generic.List[byte]
$out1.Add([byte]($wb -band 255)); $out1.Add([byte]($wb -shr 8)); $out1.Add([byte]($h -band 255)); $out1.Add([byte]($h -shr 8))
for($y=0;$y -lt $h;$y++){ for($xb=0;$xb -lt $wb;$xb++){ $v=0; for($k=0;$k -lt 8;$k++){ $x=$xb*8+$k; $white=$true; if($x -lt $width){ $c=$bmp.GetPixel($x,$y); if(($c.R+$c.G+$c.B) -lt 384){ $white=$false } }; if($white){ $v=$v -bor (0x80 -shr $k) } }; $out1.Add([byte]$v) } }
$bmp.Dispose(); [System.IO.File]::WriteAllBytes($out,$out1.ToArray())
`;
const urCache = new Map();
function urduRaster(text, S, widthDots) {
  const key = text + '|' + widthDots + '|' + S.urduPx + '|' + S.urduInvert + '|' + !!S.urduBold;
  if (urCache.has(key)) return urCache.get(key);
  try {
    if (!fs.existsSync(PS_UR) || fs.readFileSync(PS_UR, 'utf8') !== PS_UR_TXT) fs.writeFileSync(PS_UR, PS_UR_TXT);
    const out = path.join(DIR, 'urdu-raster.bin');
    require('child_process').execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_UR, '-text', text, '-fonts', S.urduFont, '-px', String(S.urduPx), '-width', String(widthDots), '-out', out, '-bold', S.urduBold ? '1' : '0'], { timeout: 20000, windowsHide: true });
    const b = fs.readFileSync(out);
    const wb = b[0] | (b[1] << 8), h = b[2] | (b[3] << 8);
    let data = b.subarray(4);
    if (S.urduInvert) data = Buffer.from(data.map(x => 255 - x));
    const r = { wb, h, data: data.toString('latin1') };
    // v3.8: KAAT — sirf likhai wala hissa (safed byte = 0xFF). x byte-wise, y line-wise. Invert par nahi.
    if (!S.urduInvert) { let x0 = wb, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let xb = 0; xb < wb; xb++) if (data[y * wb + xb] !== 0xFF) { if (xb < x0) x0 = xb; if (xb > x1) x1 = xb; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) { const cw = x1 - x0 + 1, out = Buffer.alloc(cw * (y1 - y0 + 1));
        for (let y = y0; y <= y1; y++) data.copy(out, (y - y0) * cw, y * wb + x0, y * wb + x1 + 1);
        r.crop = { xb: x0, y: y0, wb: cw, h: y1 - y0 + 1, data: out.toString('latin1') }; } }
    if (urCache.size > 2000) urCache.clear();
    urCache.set(key, r); return r;
  } catch (e) { log('Urdu raster nahi bana: ' + (e.message || e)); urCache.set(key, null); return null; }
}
let urduMap = {}, urduAt = 0;
async function urduNames() {
  if (Date.now() - urduAt < 5 * 60000) return urduMap;
  try { const d = await db.collection('businesses').doc(BUSINESS_ID).collection('blueAccess').doc('urduNames').get(); urduMap = (d.exists && d.data().map) || {}; } catch (e) { log('urduNames nahi mile: ' + e.message); }
  urduAt = Date.now(); return urduMap;
}
function settings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(path.join(DIR, 'label-settings.json'), 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const jobCol = db.collection('businesses').doc(BUSINESS_ID).collection('labelJobs');

const DOT = 8;   // TTP-244 Pro: 203 dpi = 8 dot fi mm
// ---------- v3: LABEL NUMBER (roz 1 se, har item ka apna) ----------
const NUM_FILE = path.join(DIR, 'label-numbers.json');
const MON = 'ABCDEFGHIJKL';
const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayCode = () => { const d = new Date(); return String(d.getDate() % 10) + MON[d.getMonth()]; };
function nextNums(itemId, copies) {
  let store = { day: '', items: {} };
  try { store = JSON.parse(fs.readFileSync(NUM_FILE, 'utf8')) || store; } catch {}
  const day = dayKey();
  if (store.day !== day) store = { day, items: {} };
  const key = String(itemId || 'x');
  const from = (Number(store.items[key]) || 0) + 1, to = from + copies - 1;
  store.items[key] = to;
  try { fs.writeFileSync(NUM_FILE, JSON.stringify(store)); } catch (e) { log('label-numbers.json nahi likhi: ' + e.message); }
  return { from, to, code: dayCode() };
}
const clean = (s, n) => String(s ?? '').replace(/[^\x20-\x7e]/g, ' ').replace(/["\\]/g, "'").replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => String(Math.round((Number(v) || 0) * 1000) / 1000);
const money = v => (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Ek label ka mawad â€” x0 = is column ka bayan kinara (dots)
// v3.7: 1-bit BMP (TSPL DOWNLOAD/PUTBMP) — raster ki bits: 1 = safed, 0 = kala -> palette[0] kala, palette[1] safed
function bmp1(r, uh) {
  const wpx = r.wb * 8, rowB = Math.ceil(r.wb / 4) * 4, size = 62 + rowB * uh, b = Buffer.alloc(size, 0);
  b.write('BM', 0, 'latin1'); b.writeUInt32LE(size, 2); b.writeUInt32LE(62, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(wpx, 18); b.writeInt32LE(uh, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(1, 28);
  b.writeUInt32LE(0, 30); b.writeUInt32LE(rowB * uh, 34); b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42); b.writeUInt32LE(2, 46); b.writeUInt32LE(2, 50);
  b.writeUInt32LE(0x00000000, 54); b.writeUInt32LE(0x00FFFFFF, 58);
  const src = Buffer.from(r.data, 'latin1');
  for (let y = 0; y < uh; y++) { const dst = 62 + (uh - 1 - y) * rowB; src.copy(b, dst, y * r.wb, y * r.wb + r.wb); for (let k = r.wb; k < rowB; k++) b[dst + k] = 0xFF; }
  return b.toString('latin1');
}
const urW = S => Math.floor((S.w * DOT - 2 * Math.round(1.5 * DOT)) / 8) * 8;
function labelCmds(S, j, x0, tag, ur) {
  const W = S.w * DOT, H = S.h * DOT, m = Math.round(1.5 * DOT), y0 = Math.round(S.yOffset * DOT);
  const ttf = S.urdu && ur && S.urduMode === 'ttf';   // v3.9
  const urR = (S.urdu && ur && !ttf) ? urduRaster(String(ur), S, urW(S)) : null;   // v3.4: Urdu bitmap
  const code = clean(j.code, 40), qty = Number(j.qty) || 1;
  const nameMax = Math.floor((W - 2 * m) / (Number(S.charW) || 14));   // v3.5: font "2" asal mein ~14 dot chaura (12 par naam dayen se kat-ta tha)
  const name = clean(j.name, 60) + (qty !== 1 ? ' - ' + num(qty) : '');
  let l1 = name, l2 = '';
  if (name.length > nameMax) { const cut = name.lastIndexOf(' ', nameMax); const at = cut > nameMax / 2 ? cut : nameMax; l1 = name.slice(0, at).trim(); l2 = name.slice(at).trim().slice(0, nameMax); }
  const digits = /^\d+$/.test(code);
  const modules = digits ? (1 + Math.floor(code.length / 2) + (code.length % 2 ? 2 : 0) + 1) * 11 + 13 : (code.length + 3) * 11 + 13;
  const narrow = modules * 2 <= W - 2 * m ? 2 : 1;
  const bw = modules * narrow, bx = x0 + Math.max(m, Math.round((W - bw) / 2));
  const bh = Math.round(H * ((urR || ttf) ? (l2 ? 0.20 : 0.24) : 0.34));   // v3.5: Urdu + 2 line naam ho to barcode thora chhota
  const out = [`TEXT ${x0 + m},${y0 + m},"2",0,1,1,"${l1}"`];
  let y = y0 + m + 22;
  if (l2) { out.push(`TEXT ${x0 + m},${y},"2",0,1,1,"${l2}"`); y += 22; }
  if (ttf) { const pt = Math.max(5, Math.min(30, Number(S.urduPt) || 10)), dots = Math.round(pt * 203 / 72);
    const t = Buffer.from(urduShape(String(ur), { reverse: S.urduReverse === true }).replace(/"/g, ''), 'utf8').toString('latin1');
    out.push(`TEXT ${x0 + m},${y},"UR.TTF",0,${pt},${pt},"${t}"`); y += dots + 6; }   // v3.9.1: point size   // v3.9: Urdu as TEXT (font printer mein)
  if (urR) { const uh = Math.min(urR.h, 56), c = urR.crop;
    if (S.urduMode === 'putbmp-test') out.push(`PUTBMP ${x0 + m},${y},"UR.BMP"`);
    else if (c && c.y < uh) { const ch = Math.min(c.h, uh - c.y); out.push(`BITMAP ${x0 + m + c.xb * 8},${y + c.y},${c.wb},${ch},0,${c.data.slice(0, c.wb * ch)}`); }   // v3.8: kati hui (chhoti)
    else if (!c) out.push(`BITMAP ${x0 + m},${y},${urR.wb},${uh},0,${urR.data.slice(0, urR.wb * uh)}`);
    y += uh + 2; }
  out.push(`BARCODE ${bx},${y + 4},"128",${bh},1,0,${narrow},${narrow},"${code}"`);
  // v3.2: number BARCODE KE CODE ("086") wali line par, DAYEN kone mein — naam do line le le tab bhi jagah rehti hai
  if (tag) { const tw = String(tag).length * 12;         // font "2" = 12 dot chaura
    out.push(`TEXT ${x0 + W - m - tw},${y + 4 + bh + 2},"2",0,1,1,"${tag}"`); }
  // rate ki line 4 dot upar (neeche kinare se kat rahi thi)
  if (S.showRate && Number(j.rate) > 0) out.push(`TEXT ${x0 + m},${y0 + H - m - 24},"2",0,1,1,"Rs ${money(j.rate)}"`);
  return out;
}
function rowHead(S) {
  const rowW = S.cols * S.w + (S.cols - 1) * S.colGap;
  return [`SIZE ${rowW} mm,${S.h} mm`, `GAP ${S.rowGap} mm,0 mm`, `SPEED ${S.speed}`, `DENSITY ${S.density}`, 'DIRECTION 1', `REFERENCE ${Math.round(S.xOffset * DOT)},0`, ...(S.urduMode === 'ttf' ? ['CODEPAGE UTF-8'] : [])];   // v3.9
}
// Ek hukum ke copies ko qataron mein baant kar TSPL (har qatar = ek PRINT)
// v3.8: ek hukum -> kai CHHOTE print jobs (har job rowsPerJob qataren), taake TSC ka buffer na bhare
function tspl(S, j, nums, ur) {
  const copies = Math.max(1, Math.min(200, Math.floor(Number(j.copies) || 1)));
  const per = Math.max(1, Math.min(50, Math.floor(Number(S.rowsPerJob) || 8)));
  const jobs = []; let out = null, rows = 0;
  const head = () => { const h = rowHead(S); if (S.urdu && ur && S.urduMode === 'putbmp-test') { const r = urduRaster(String(ur), S, urW(S)); if (r) { const bm = bmp1(r, Math.min(r.h, 56)); h.push(`DOWNLOAD "UR.BMP",${bm.length},${bm}`); } } return h; };
  for (let done = 0; done < copies; ) {
    if (!out) { out = head(); rows = 0; }
    out.push('CLS');
    for (let c = 0; c < S.cols && done < copies; c++, done++)
      out.push(...labelCmds(S, j, c * (S.w + S.colGap) * DOT, nums ? `${nums.code}-${nums.from + done}` : '', ur));
    out.push('PRINT 1,1'); rows++;
    if (rows >= per || done >= copies) { out.push(''); jobs.push(out.join('\r\n')); out = null; }
  }
  return jobs;
}
// Test: teeno labels par box + naap (alignment dekhne ke liye)
function tsplTest(S) {
  const out = rowHead(S); out.push('CLS');
  for (let c = 0; c < S.cols; c++) {
    const x0 = c * (S.w + S.colGap) * DOT, W = S.w * DOT, H = S.h * DOT, y0 = Math.round(S.yOffset * DOT);
    out.push(`BOX ${x0 + 2},${y0 + 2},${x0 + W - 2},${y0 + H - 2},2`);
    out.push(...labelCmds(S, { name: `TEST ${c + 1} ${S.w}x${S.h}`, code: '123456', qty: 1, rate: 100 }, x0, dayCode() + '-' + (c + 1)));
  }
  out.push('PRINT 1,1', '');
  return out.join('\r\n');
}

// v3.9: Urdu TTF font printer ke FLASH mein (ek dafa fi process; flash band hone par bhi rehta hai)
let ttfSent = false;
function fontJob(S) {
  const f = String(S.urduTtf || DEFAULTS.urduTtf); const b = fs.readFileSync(f);
  return 'KILL F,"UR.TTF"\r\n' + `DOWNLOAD F,"UR.TTF",${b.length},` + b.toString('latin1') + '\r\nEOP\r\n';
}
async function ensureFont(S) {
  if (S.urduMode !== 'ttf' || ttfSent) return null;
  let err = null; try { err = await sendRaw(fontJob(S), S.printer); } catch (e) { err = e; }
  if (err) { log('Urdu font printer mein nahi gaya: ' + err.message); return err; }
  ttfSent = true; log(`Urdu font printer mein daal diya (${path.basename(String(S.urduTtf || DEFAULTS.urduTtf))})`); return null;
}
function sendRaw(text, printerName) {
  const PRINTER_NAME = printerName;
  const file = path.join(DIR, 'label-print.bin');
  fs.writeFileSync(file, Buffer.from(text, 'latin1'));
  const ps = `
$ErrorActionPreference='Stop'
$name='${PRINTER_NAME.replace(/'/g, "''")}'
$bytes=[System.IO.File]::ReadAllBytes('${file.replace(/'/g, "''")}')
# 2026-10-02 TEZ PRINT: C# helper ek dafa RawCached.dll mein compile, phir har print par sirf load (pehle har dafa compile = 3-8 sec)
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
[RawCached]::Send($name,$bytes,'Label')
`;
  const psFile = path.join(DIR, 'label-raw.ps1');
  fs.writeFileSync(psFile, ps);
  return new Promise(res => {
    require('child_process').execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
      { timeout: 30000 }, (err, so, se) => { if (err) err.message = String(se || '').trim().split(/\r?\n/)[0] || err.message; res(err); });
  });
}

// v4.0: 🖨 LIVE + ✕ CANCEL — printer ki Windows line (spooler) dekhna / saaf karna
const psq = s => "'" + String(s || '').replace(/'/g, "''") + "'";
function psRun(cmd, ms = 20000) {
  return new Promise(res => require('child_process').execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { timeout: ms, windowsHide: true }, (e, so) => res(e ? null : String(so || '').trim())));
}
async function queueCount(printer) {   // abhi printer ki line mein kitne (chhape / retained wale nahi)
  const o = await psRun(`@(Get-PrintJob -PrinterName ${psq(printer)} -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -notmatch 'Printed|Deleted' }).Count`);
  const n = Number(o); return Number.isFinite(n) ? n : 0;
}
async function waitQueue(printer, max = 1, ms = 90000) {   // agla hissa tab bhejo jab line mein <= max ho — ginti asal chhapai jaisi, cancel foran
  const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await queueCount(printer) <= max) return; await new Promise(r => setTimeout(r, 2500)); }
}
async function purgeQueue(printer) { await psRun(`Get-PrintJob -PrinterName ${psq(printer)} -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue`); }

const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (e?.code === 16 || /UNAUTHENTICATED|invalid authentication credentials/i.test(String(e?.message))) { log('Firebase ka rabta toot gaya (UNAUTHENTICATED) — script 30 sec mein nayi chabi se dobara shuru hogi'); setTimeout(() => process.exit(1), 500); } }); };   // 2026-09-30: pehle bas likh kar aage chal padti thi, bill atak jate

async function handle(doc) {
  if (busy.has(doc.id)) return;
  busy.add(doc.id);
  try {
    const ref = jobCol.doc(doc.id);
    const j = await db.runTransaction(async t => {
      const cur = (await t.get(ref)).data();
      if (!cur || cur.status !== 'new') return null;
      if (cur.cancelReq) { t.update(ref, { status: 'cancelled', sent: 0, doneAt: Date.now() }); return { cancelledEarly: true, ...cur }; }   // v4.0: line mein hi cancel
      t.update(ref, { status: 'printing', pc: os.hostname(), pickedAt: Date.now(), sent: 0, total: Math.max(1, Math.min(200, Math.floor(Number(cur.copies) || 1))) });
      return cur;
    });
    if (!j) return;
    if (j.cancelledEarly) { log(`✕ Cancel (line mein): ${j.name} ${j.code}`); return; }
    // bohat purana hukum (2 ghante se zyada) na chhapo â€” PC band raha ho to subah dher na nikle
    if (Date.now() - (Number(j.at) || 0) > 2 * 3600 * 1000) {
      await ref.update({ status: 'skipped', error: 'purana hukum (2 ghante se zyada) â€” dobara bhejein', doneAt: Date.now() });
      log(`Chhora (purana): ${j.name} ${j.code}`); return;
    }
    const S = settings();
    const copies2 = Math.max(1, Math.min(200, Math.floor(Number(j.copies) || 1)));
    const nums = nextNums(j.code || j.itemId, copies2);            // v3.3: har BARCODE (sub-barcode) ka apna silsila — surf 1kg alag, 2kg alag
    const ur = S.urdu ? (await urduNames())[String(j.itemId)] || '' : '';   // v3.4: Urdu naam (ho to)
    let err = (S.urdu && ur) ? await ensureFont(S) : null;   // v3.9
    // v3.8: chhote jobs ek ke baad ek · v4.0: har hisse se pehle cancel dekho, line khali hone tak ruko (ginti = asal chhapai), ginti likho
    const parts = err ? [] : tspl(S, j, nums, ur), perPart = Math.max(1, Math.min(50, Math.floor(Number(S.rowsPerJob) || 8))) * Math.max(1, Number(S.cols) || 1);
    let sent = 0, cancelled = false;
    for (let k = 0; k < parts.length && !err; k++) {
      if (k > 0) { await waitQueue(S.printer, 1); try { if (((await ref.get()).data() || {}).cancelReq) { cancelled = true; break; } } catch {} }
      err = await sendRaw(parts[k], S.printer); if (err) break;
      sent = Math.min(copies2, (k + 1) * perPart);
      if (parts.length > 1) ref.update({ sent: Math.max(0, sent - perPart), total: copies2 }).catch(() => {});   // line mein abhi ek hissa — chhap chuke ≈ pichhle
    }
    if (cancelled) {
      await purgeQueue(S.printer);
      const done0 = Math.max(0, sent - perPart);
      await ref.update({ status: 'cancelled', sent: done0, total: copies2, doneAt: Date.now() });
      log(`✕ Cancel: ${j.name} — ~${done0} / ${copies2} chhapne ke baad, printer ki line saaf`); return;
    }
    if (err) { await ref.update({ status: 'failed', error: String(err.message).slice(0, 300), doneAt: Date.now() }); log(`Label NAHI chhapa: ${j.name} â€” ${err.message}`); }
    else { await ref.update({ status: 'done', sent: copies2, total: copies2, doneAt: Date.now(), error: FieldValue.delete(), numFrom: nums.from, numTo: nums.to, numCode: nums.code, day: dayKey() }); log(`Label chhapa: ${j.name}${Number(j.qty) !== 1 ? ' - ' + num(j.qty) : ''} x ${copies2} -> ${nums.code}-${nums.from}${copies2>1?' se '+nums.code+'-'+nums.to:''}`); }
  } finally { busy.delete(doc.id); }
}

if (process.argv.includes('--calibrate')) {   // v2.1: roll badalne ke baad printer khud label ka naap napta hai (gap sensor)
  const S = settings();
  const rowW = S.cols * S.w + (S.cols - 1) * S.colGap;
  sendRaw([`SIZE ${rowW} mm,${S.h} mm`, `GAP ${S.rowGap} mm,0 mm`, 'GAPDETECT', 'AUTODETECT', ''].join('\r\n'), S.printer)
    .then(e => { console.log(e ? 'Nahi hua: ' + e.message : 'Calibrate ka hukum bhej diya â€” printer 2-3 khali labels nikalega, yeh theek hai.'); process.exit(e ? 1 : 0); });
} else if (process.argv.includes('--test-urdu')) {   // v3.9: node label-print.js --test-urdu [C:\Windows\Fonts\arialbd.ttf]
  const S = { ...settings(), urdu: true, urduMode: 'ttf' }; const fa = process.argv[process.argv.indexOf('--test-urdu') + 1]; if (fa && !fa.startsWith('--')) S.urduTtf = fa;
  console.log('Font: ' + S.urduTtf + ' · ' + S.urduPt + ' pt');
  (async () => { const e1 = await ensureFont(S); if (e1) { console.log('Font NAHI gaya: ' + e1.message); process.exit(1); }
    const j = { name: 'nimko 0.700gm', code: '03265', qty: 1, rate: 370, copies: 3 };
    const A = tspl({ ...S, urduReverse: false }, j, { code: 'A', from: 1 }, 'نمکو 0.700 گرام')[0];
    const B = tspl({ ...S, urduReverse: true }, j, { code: 'B', from: 1 }, 'نمکو 0.700 گرام')[0];
    const e2 = await sendRaw(A, S.printer) || await sendRaw(B, S.printer);
    console.log(e2 ? 'Nahi hua: ' + e2.message : 'Do qatarein: A-1..3 aur B-1..3 — jis mein "نمکو 0.700 گرام" SAHI parha jaye wo batayein'); process.exit(e2 ? 1 : 0); })();
} else if (process.argv.includes('--test')) {
  const S = settings();
  console.log('Naap: ' + S.cols + ' columns x ' + S.w + 'x' + S.h + ' mm, gap ' + S.colGap + '/' + S.rowGap + ' mm, offset ' + S.xOffset + '/' + S.yOffset + ' mm');
  sendRaw(tsplTest(S), S.printer)
    .then(e => { console.log(e ? 'Nahi hua: ' + e.message : 'Test qatar (box wale labels) bhej di.'); process.exit(e ? 1 : 0); });
} else {
  const lock = net.createServer();
  lock.once('error', () => { console.log('label-print pehle se chal raha hai.'); process.exit(3); });
  lock.listen(LOCK_PORT, '127.0.0.1', () => {
    { const S = settings(); log(`label-print v4.0 chal raha hai — printer "${S.printer}", ${S.cols} x ${S.w}x${S.h} mm. Band: Ctrl+C`); }
    jobCol.where('status', '==', 'new').onSnapshot(s => {
      s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handle(c.doc)); });
    }, e => { log('Listener toot gaya: ' + e.message + ' â€” band, bat 30 second mein dobara chalayega'); process.exit(1); });
  });
}
