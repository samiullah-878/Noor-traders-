# 📸 Screenshot diary (md pkg v90, malik 27 Nov 2026: "is tarah ka screenshot auto upload ho jaye · in ki detail bhi likh dijiye meri apps mein"
#   + chuna "2" (har screenshot jaye, AI khud chhaante) + "Blue Khata wala nahi · bank wala nahi · Chrome wala nahi")
#   Phone ki har NAYI screenshot (DCIM/Screenshots ya Pictures/Screenshots) -> Java: kis app mein li (file ke naam ka package, warna UsageStats) ->
#   Blue Khata (webapk) / Chrome / bank apps = KABHI nahi bhejni (scX ginti) -> baqi: 720 px JPEG (~150 KB) -> body file -> HttpRequest POST
#   Firestore shotIn/<id> {k, im, at, pk, fn, st 'new'} (rules 2.114). Blue Khata app (malik) 🤖 detail banati hai (📸 Screenshot diary screen).
#   Net na ho / link na ho = phone mein line (scQ, 25 tak) — har 15 min + agli screenshot + app ka webhook nt_shot par khud dobara.
#   Chaabi + link REPO MEIN NAHI: wahi ntU / ntK (awazNotes ka link + blueAccess/awazKey) jo ✍️ Likho / qoul / sehat tick istemal karte hain —
#   app ka webhook nt_shot bhi saath bhejta hai. Koi popup / toast nahi. AI phone par NAHI.
#   Ginti (phone ki report mein): scN nayi line mein · scS chali gayin · scX Blue Khata / bank / Chrome wali chhori · scC aakhri jawab ka code.
import json, os, re
from cb import iff, END, strne, var, lvar, setv
from remind import java, LOOP, ENDLOOP, BREAK
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3, T4 = 112233445568011, 112233445568012, 112233445568013, 112233445568014
DIRS = ["/storage/emulated/0/DCIM/Screenshots", "/storage/emulated/0/Pictures/Screenshots"]
BODY = "/storage/emulated/0/MacroDroid/nt-shot.json"
# Blue Khata (installed app = WebAPK) + Chrome + bank / wallet apps — inhein kabhi nahi (malik). Bank list = bank.py (Bank mode) + aam Pakistani bank.
NO = ["org.chromium.webapk", "com.android.chrome", "com.chrome.", "com.google.android.apps.chrome",
      "com.hbl.", "com.ofss.digx", "com.alhabib", "com.base.bankalfalah", "com.techlogix.mobilinkcustomer", "pk.com.telenor.phoenix",
      "com.ubl.", "com.meezan", "com.mcb", "com.bankislami", "com.askari", "com.nbp", "com.bop", "com.faysal", "pk.com.hbl"]
IGN = ["com.android.systemui", "android", "com.oplus.screenshot", "com.coloros.screenshot", "com.oneplus.screenshot", "com.oplus.gesture", "com.arlosoft.macrodroid"]
def jarr(L): return 'new String[] { ' + ', '.join('"' + x + '"' for x in L) + ' }'

COMMON = [
 'String ev(String k) { try { String v = magicText.evaluateString("{" + k + "}"); return v == null ? "" : v.trim(); } catch (Throwable e) { return ""; } }',
 'String Q = "" + (char) 34;',
 'String esc(String s) { StringBuilder b = new StringBuilder(); if (s == null) return ""; for (int i = 0; i < s.length(); i++) { char ch = s.charAt(i);',
 '  if (ch == 92) b.append((char) 92).append((char) 92); else if (ch == 34) b.append((char) 92).append((char) 34); else if (ch < 32) b.append(" "); else b.append(ch); } return b.toString(); }',
 'org.json.JSONArray arrOf(String n) { try { String s = ev("v=" + n); if (s.startsWith("[")) return new org.json.JSONArray(s); } catch (Throwable e) { } return new org.json.JSONArray(); }',
 'void save(org.json.JSONArray q, org.json.JSONArray dn) { while (q.length() > 25) q.remove(0); while (dn.length() > 150) dn.remove(0);',
 '  variableSetter.setString("scQ", q.length() == 0 ? "" : q.toString(), 2); variableSetter.setString("scD", dn.toString(), 2); }',
 'int num(String n) { try { return Integer.parseInt(ev("v=" + n)); } catch (Throwable e) { return 0; } }',
]

# ---------- PREP: nayi screenshots line mein + pehli ki body file tayyar -> URL (khali = kuch nahi) ----------
PREP = '\n'.join(['import android.app.usage.UsageStatsManager;', 'import android.app.usage.UsageEvents;', 'import android.graphics.Bitmap;', 'import android.graphics.BitmapFactory;'] + COMMON + [
 'String[] DIRS = ' + jarr(DIRS) + ';',
 'String[] NO = ' + jarr(NO) + ';',
 'String[] IGN = ' + jarr(IGN) + ';',
 'boolean no(String p) { if (p == null) return false; for (int i = 0; i < NO.length; i++) if (p.startsWith(NO[i])) return true; return false; }',
 'boolean ign(String p) { for (int i = 0; i < IGN.length; i++) if (p.equals(IGN[i])) return true; return false; }',
 'String fgAt(long t) {',
 '  try {',
 '    UsageStatsManager um = (UsageStatsManager) appContext.getSystemService("usagestats");',
 '    UsageEvents ue = um.queryEvents(t - 6L * 3600000L, t + 2500L);',
 '    UsageEvents.Event e = new UsageEvents.Event(); String last = "";',
 '    while (ue != null && ue.hasNextEvent()) { ue.getNextEvent(e); if (e.getEventType() == 1) { String p = e.getPackageName(); if (p != null && !ign(p)) last = p; } }',
 '    return last;',
 '  } catch (Throwable x) { return ""; }',
 '}',
 'String pkName(String n) {   // ColorOS / OxygenOS: Screenshot_..._com.zhiliaoapp.musically.jpg',
 '  int d = n.lastIndexOf(46); String b = d > 0 ? n.substring(0, d) : n; int u = b.lastIndexOf(95); if (u < 0) return "";',
 '  String p = b.substring(u + 1); return (p.indexOf(46) > 0 && p.length() < 100 && p.matches("[a-zA-Z][a-zA-Z0-9_.]+")) ? p : "";',
 '}',
 'boolean seen(org.json.JSONArray q, org.json.JSONArray dn, String p) {',
 '  for (int i = 0; i < dn.length(); i++) if (p.equals(dn.optString(i))) return true;',
 '  for (int i = 0; i < q.length(); i++) { org.json.JSONObject o = q.optJSONObject(i); if (o != null && p.equals(o.optString("p"))) return true; }',
 '  return false;',
 '}',
 'try {',
 '  long now = System.currentTimeMillis();',
 '  org.json.JSONArray q = arrOf("scQ"), dn = arrOf("scD");',
 '  java.util.ArrayList L = new java.util.ArrayList();',
 '  for (int di = 0; di < DIRS.length; di++) {',
 '    java.io.File[] fs = new java.io.File(DIRS[di]).listFiles(); if (fs == null) continue;',
 '    for (int i = 0; i < fs.length; i++) {',
 '      java.io.File f = fs[i]; String nm = f.getName(), lo = nm.toLowerCase();',
 '      if (!f.isFile() || nm.startsWith(".")) continue;',
 '      if (!(lo.endsWith(".jpg") || lo.endsWith(".jpeg") || lo.endsWith(".png") || lo.endsWith(".webp"))) continue;',
 '      if (f.lastModified() < now - 2400000L || f.length() < 3000) continue;',
 '      if (seen(q, dn, f.getAbsolutePath())) continue;',
 '      L.add(f);',
 '    }',
 '  }',
 '  for (int i = 0; i < L.size(); i++) for (int j = i + 1; j < L.size(); j++) { java.io.File a = (java.io.File) L.get(i), b = (java.io.File) L.get(j); if (b.lastModified() < a.lastModified()) { L.set(i, b); L.set(j, a); } }',
 '  int nn = 0, nx = 0;',
 '  for (int i = 0; i < L.size(); i++) {',
 '    java.io.File f = (java.io.File) L.get(i); long m = f.lastModified();',
 '    if (System.currentTimeMillis() - m < 1500L) { try { Thread.sleep(1600L); } catch (Throwable e) { } }',
 '    String pk = pkName(f.getName()); if (pk.length() == 0 && now - m < 180000L) pk = fgAt(m);',
 '    if (no(pk)) { dn.put(f.getAbsolutePath()); nx++; continue; }',
 '    org.json.JSONObject o = new org.json.JSONObject(); o.put("p", f.getAbsolutePath()); o.put("k", pk); o.put("m", m); o.put("n", 0); q.put(o); nn++;',
 '  }',
 '  if (nn > 0) variableSetter.setInt("scN", num("scN") + nn);',
 '  if (nx > 0) variableSetter.setInt("scX", num("scX") + nx);',
 '  String U = ev("v=ntU"), K = ev("v=ntK");',
 '  if (U.indexOf("/awazNotes?") < 0 || K.length() < 16) { save(q, dn); return ""; }',
 '  while (q.length() > 0) {',
 '    org.json.JSONObject it = q.optJSONObject(0); if (it == null) { q.remove(0); continue; }',
 '    String path = it.optString("p"); java.io.File f = new java.io.File(path);',
 '    if (!f.isFile()) { q.remove(0); dn.put(path); continue; }',
 '    BitmapFactory.Options o1 = new BitmapFactory.Options(); o1.inJustDecodeBounds = true; BitmapFactory.decodeFile(path, o1);',
 '    int w = o1.outWidth, h = o1.outHeight;',
 '    if (w <= 0 || h <= 0) { q.remove(0); dn.put(path); continue; }',
 '    int ss = 1; while (w / (ss * 2) >= 720) ss = ss * 2;',
 '    BitmapFactory.Options o2 = new BitmapFactory.Options(); o2.inSampleSize = ss;',
 '    Bitmap bm = BitmapFactory.decodeFile(path, o2); if (bm == null) { q.remove(0); dn.put(path); continue; }',
 '    int tw = bm.getWidth(), th = bm.getHeight();',
 '    if (tw > 720) { th = (int) Math.round(th * 720.0 / tw); tw = 720; }',
 '    if (th > 2800) { tw = (int) Math.round(tw * 2800.0 / th); th = 2800; }',
 '    Bitmap sb = (tw == bm.getWidth() && th == bm.getHeight()) ? bm : Bitmap.createScaledBitmap(bm, tw, th, true);',
 '    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();',
 '    sb.compress(Bitmap.CompressFormat.JPEG, 68, bo);',
 '    if (bo.size() > 520000) { bo.reset(); sb.compress(Bitmap.CompressFormat.JPEG, 50, bo); }',
 '    if (bo.size() > 650000) { Bitmap s2 = Bitmap.createScaledBitmap(sb, tw * 3 / 4, th * 3 / 4, true); bo.reset(); s2.compress(Bitmap.CompressFormat.JPEG, 50, bo); }',
 '    if (bo.size() > 850000) { q.remove(0); dn.put(path); continue; }',
 '    String b64 = android.util.Base64.encodeToString(bo.toByteArray(), 2);',
 '    String nm = f.getName(), id = nm.replaceAll("[^A-Za-z0-9_-]", "_");',
 '    if (id.length() > 100) id = id.substring(id.length() - 100);',
 '    if (id.length() < 4) id = "s_" + id + "_" + f.lastModified();',
 '    String pk = it.optString("k"); if (pk.length() > 120) pk = pk.substring(0, 120);',
 '    if (nm.length() > 150) nm = nm.substring(nm.length() - 150);',
 '    String body = "{" + Q + "fields" + Q + ":{" + Q + "k" + Q + ":{" + Q + "stringValue" + Q + ":" + Q + esc(K) + Q + "},"',
 '      + Q + "im" + Q + ":{" + Q + "bytesValue" + Q + ":" + Q + b64 + Q + "},"',
 '      + Q + "at" + Q + ":{" + Q + "integerValue" + Q + ":" + Q + f.lastModified() + Q + "},"',
 '      + Q + "pk" + Q + ":{" + Q + "stringValue" + Q + ":" + Q + esc(pk) + Q + "},"',
 '      + Q + "fn" + Q + ":{" + Q + "stringValue" + Q + ":" + Q + esc(nm) + Q + "},"',
 '      + Q + "st" + Q + ":{" + Q + "stringValue" + Q + ":" + Q + "new" + Q + "}}}";',
 '    new java.io.File("' + BODY.rsplit('/', 1)[0] + '").mkdirs();',
 '    java.io.FileOutputStream fo = new java.io.FileOutputStream("' + BODY + '"); fo.write(body.getBytes("UTF-8")); fo.close();',
 '    variableSetter.setString("scF", path, 2);',
 '    save(q, dn);',
 '    return U.replace("/awazNotes?", "/shotIn?documentId=" + id + "&");',
 '  }',
 '  save(q, dn); return "";',
 '} catch (Throwable e) { return ""; }'])

# ---------- DONE: jawab dekh kar line se hatao / rakho ----------
DONE = '\n'.join(COMMON + [
 'int post(String U, byte[] body) {',
 '  try {',
 '    java.net.HttpURLConnection h = (java.net.HttpURLConnection) new java.net.URL(U).openConnection();',
 '    h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(30000); h.setUseCaches(false);',
 '    h.setRequestProperty("Content-Type", "application/json; charset=utf-8");',
 '    java.io.OutputStream o = h.getOutputStream(); o.write(body); o.close();',
 '    int c = h.getResponseCode(); h.disconnect(); return c;',
 '  } catch (Throwable e) { return -1; }',
 '}',
 'try {',
 '  int rc = 0; try { rc = Integer.parseInt(ev("lv=rc")); } catch (Throwable e) { rc = 0; }',
 '  String path = ev("v=scF"), U = ev("lv=scU");',
 '  java.io.File bf = new java.io.File("' + BODY + '");',
 '  if (rc <= 0 && U.length() > 20 && bf.isFile()) {   // HttpRequest nahi chala — Java se wahi body',
 '    java.io.FileInputStream fi = new java.io.FileInputStream(bf); java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();',
 '    byte[] buf = new byte[16384]; int r; while ((r = fi.read(buf)) > 0) bo.write(buf, 0, r); fi.close();',
 '    rc = post(U, bo.toByteArray());',
 '  }',
 '  variableSetter.setInt("scC", rc);',
 '  org.json.JSONArray q = arrOf("scQ"), dn = arrOf("scD");',
 '  int ix = -1; for (int i = 0; i < q.length(); i++) { org.json.JSONObject o = q.optJSONObject(i); if (o != null && path.equals(o.optString("p"))) { ix = i; break; } }',
 '  if ((rc >= 200 && rc < 300) || rc == 409) {',
 '    if (ix >= 0) q.remove(ix); dn.put(path); save(q, dn); variableSetter.setInt("scS", num("scS") + 1);',
 '    try { bf.delete(); } catch (Throwable e) { }',
 '    return "ok";',
 '  }',
 '  if (ix >= 0) { org.json.JSONObject o = q.optJSONObject(ix); int n = o.optInt("n") + 1; o.put("n", n);',
 '    if (n >= 4 || (rc >= 400 && rc < 500 && n >= 2)) { q.remove(ix); dn.put(path); } }',
 '  save(q, dn);',
 '  return "rook";',
 '} catch (Throwable e) { return "rook"; }'])

for nm_, src in (('PREP', PREP), ('DONE', DONE)):
    assert not re.search(r'\{(?![\s"])', src), nm_ + ': magic text'

HTTP = {"m_classType": "HttpRequestAction", "m_SIGUID": 0, "requestConfig": {
    "requestType": 1, "urlToOpen": "{lv=scU}", "requestTimeOutSeconds": 30, "maxTotalDurationSeconds": 90, "contentType": "application/json",
    "contentBodySource": 1, "useStaticContentBodyFile": False, "useAllFilesAccess": True, "allFilesAccessPath": BODY,
    "blockNextAction": True, "followRedirects": True, "headerParams": [], "queryParams": [],
    "saveResponseType": 0, "saveReturnCodeToVariable": True, "returnCodeVariableName": "rc"}}
def lstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
def streqL(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
acts = [
    LOOP,
      lstr("scU", ""), java(PREP, "scU", True),
      iff([streqL("scU", "")]), BREAK, END,
      setv("rc", 1, True, m_newIntValue=0),
      HTTP,
      java(DONE, "scP", True),
      iff([streqL("scP", "rook")]), BREAK, END,
    ENDLOOP,
]
def ftrig(s, path): return {"m_classType": "FileChangedTrigger", "m_SIGUID": s, "folderPath": path, "fileFilter": "*",
                            "watchForCreated": True, "watchForDeleted": False, "watchForModified": True, "useStaticFolder": True}
SHOT = {"macroExportVersion": 1, "macro": {
    "m_name": "📸 Screenshot diary",
    "m_description": "Har nayi screenshot (Blue Khata / bank / Chrome wali KABHI nahi) chhoti kar ke Blue Khata ki 📸 Screenshot diary mein — wahan 🤖 AI naam, pata, phone, video kis ki, recipe likhta hai. Net na ho = phone mein line, baad mein khud. Chaabi app webhook (nt_shot) se. Koi popup nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("scU", 2), lvar("scP", 2), lvar("rc", 1)],
    "m_triggerList": [
        ftrig(T1, DIRS[0]), ftrig(T2, DIRS[1]),
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T3, "m_seconds": 900, "m_useAlarm": False},
        {"m_classType": "WebHookTrigger", "m_SIGUID": T4, "identifier": "nt_shot", "variableWhiteListEnabled": True, "variableWhiteList": ["ntU", "ntK"]}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [var("scQ", 2), var("scD", 2), var("scF", 2), var("scN"), var("scS"), var("scX"), var("scC"), var("ntU", 2), var("ntK", 2)],
    "userIcons": None}
if __name__ == '__main__':
    json.dump(SHOT, open(os.path.join(D, 'shot.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('shot ok', len(acts), len(PREP), len(DONE))
