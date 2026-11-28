# 📞 Khaas contacts — WhatsApp call (malik 27 Nov 2026: "jo contacts chose kiya hai, agar WhatsApp par call aaye to bhi bell aaye" + OK;
#   teesra bhi OK: "baat 20%" ka WhatsApp hissa kabhi chala hi nahi — us mein NAAM1|NAAM2 likha reh gaya tha).
#   LIST: naam / number md/ (PUBLIC) mein KABHI nahi. Naam phone par '📞 Khaas log · SIM call · ghanti poori' (KV) ke 'Incoming call' trigger mein malik ke
#     chune contacts se aate hain: yeh macro din mein ek dafa (+ chalu hote hi + boot) ExportMacros 'nt-kw' -> Java -> global khWa = "|naam|naam|"
#     (chhote harf), export ALAG folder DIR/kw mein (Remote ki backup na samjhi jaye). Export na mile = Remote ka 'nt-now.mdr'. Malik KV mein contact jore / hataye = agle din (ya agle pkg update par) khud.
#   KW '📞 Khaas log · WhatsApp call · ghanti poori': WhatsApp 'Incoming … call' notification + title (contact ka naam) list mein = KV jaisa: DND band, ghanti 100%,
#     ringer normal; phone pehle silent / vibrate / DND ho to WhatsApp khud nahi bajata — is liye Java phone ki apni ringtone bajata hai
#     (khRg 1 tak, 60 s hadd). Call utha li ('ongoing') / kat gayi ('missed') / notification hata = ghanti band + pehla volume / mode / DND wapas.
#   KW2 '📞 Khaas log · WhatsApp call · baat dheemi': WhatsApp 'Ongoing … call' + title list mein = call ki awaaz 20%, khatam = pehli. (KB ka apna WhatsApp trigger
#     NAAM1|NAAM2 par hi rehta hai — kabhi nahi chalta, koi takrao nahi. KB / KV ONCE macros hain — inhein chhoona nahi.)
#   Dono macro har pkg update ke saath dobara ja sakte hain (in mein malik ka chuna data NAHI — list phone par banti hai). AI nahi.
#   Asal phone par nahi azmaya: WhatsApp ke call notification ki likhai ('Incoming voice call'), ringtone ka bajna, VoiceCall stream.
import json, os, re
from cb import trig, iff, END, ELSE, lt, gt, lvar, var
from khaasvol import si, se, vol, volv, vmode, dnd, setdnd, eq, wait, RING, CALL, WA, WAN
D = os.path.dirname(os.path.abspath(__file__))
DIR = "/storage/emulated/0/MacroDroid/Claude"          # remote.py wala folder (All files access pehle se)
K1, K2, K3, K4 = 112233445569001, 112233445569002, 112233445569003, 112233445569004
KW_W = [112233445569011, 112233445569012, 112233445569013]
B1, B2, BW = 112233445569021, 112233445569022, 112233445569023

def java(src, res, block=True): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": src, "blockNextAction": block, "responseVariableName": res, "runInBackgroundThread": True}
def lstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
def gint(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 1, "isLocalVar": False}, "m_newIntValue": v}
def streq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
def notif(s, opt, text):
    return {"m_classType": "NotificationTrigger", "m_SIGUID": s, "m_option": opt, "m_packageNameList": WA, "m_applicationNameList": WAN, "m_excludeApps": False,
            "separateTitleAndMessage": True, "matchOptionTitle": 0, "matchOptionMessage": 2, "messageContent": text,
            "enableRegex": False, "ignoreCase": True, "m_ignoreOngoing": False, "m_supressMultiples": opt == 0, "m_soundOption": 0}

# Java: KV ke chune contacts ke naam -> khWa. Jawab = ginti / 'nahi' / 'err …'.
NAMES = '\n'.join([
 'try {',
 '  java.io.File d = new java.io.File("' + DIR + '");',
 '  java.io.File f = new java.io.File(d, "kw/nt-kw.mdr");',
 '  java.io.File g = new java.io.File(d, "nt-now.mdr");',
 '  if (!f.exists() || (g.exists() && g.lastModified() > f.lastModified())) f = g;',
 '  if (!f.exists()) return "nahi";',
 '  java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(f), "UTF-8"));',
 '  StringBuilder sb = new StringBuilder(); String ln;',
 '  while ((ln = r.readLine()) != null) sb.append(ln).append("\\n");',
 '  r.close();',
 '  org.json.JSONObject ex = new org.json.JSONObject(sb.toString());',
 '  java.util.Iterator it = ex.keys();',
 '  StringBuilder out = new StringBuilder("|"); int n = 0;',
 '  while (it.hasNext()) {',
 '    org.json.JSONArray a = ex.optJSONArray((String) it.next());',
 '    if (a == null) continue;',
 '    for (int i = 0; i < a.length(); i++) {',
 '      org.json.JSONObject m = a.optJSONObject(i);',
 '      if (m == null || !m.has("m_triggerList")) continue;',
 '      String mn0 = m.optString("m_name", ""); if (mn0.indexOf("Khaas: ghanti") < 0 && !(mn0.indexOf("SIM call") >= 0 && mn0.indexOf("ghanti") >= 0)) continue;',
 '      org.json.JSONArray ts = m.optJSONArray("m_triggerList");',
 '      for (int j = 0; ts != null && j < ts.length(); j++) {',
 '        org.json.JSONObject t = ts.optJSONObject(j);',
 '        if (t == null) continue;',
 '        org.json.JSONArray cs = t.optJSONArray("m_incomingCallFromList");',
 '        for (int k = 0; cs != null && k < cs.length(); k++) {',
 '          org.json.JSONObject c = cs.optJSONObject(k);',
 '          String nm = c == null ? "" : c.optString("m_name", "").trim().toLowerCase();',
 '          if (nm.length() == 0 || out.indexOf("|" + nm + "|") >= 0) continue;',
 '          out.append(nm).append("|"); n++;',
 '        }',
 '      }',
 '    }',
 '  }',
 '  variableSetter.setString("khWa", n > 0 ? out.toString() : "", 2);',
 '  variableSetter.setInt("khWn", n);',
 '  return "" + n;',
 '} catch (Throwable e) { return "err " + e; }'])

# Java: notification ka title list mein hai? kind = "incoming" / "ongoing". Jawab "1" / "" / "nolist".
def HIT(kind): return '\n'.join([
 'try {',
 '  String t = magicText.evaluateString("{" + "lv=wt}"); if (t == null) t = "";',
 '  String x = magicText.evaluateString("{" + "lv=wx}"); if (x == null) x = "";',
 '  StringBuilder c = new StringBuilder();',
 '  for (int i = 0; i < t.length(); i++) {',
 '    char ch = t.charAt(i);',
 '    if (Character.getType(ch) == Character.FORMAT) continue;',     # WhatsApp ke chhupe harf (U+202A…U+202C) — cnsave.py jaisa
 '    c.append(ch == (char) 160 ? (char) 32 : ch);',
 '  }',
 '  t = c.toString().replaceAll("[(][0-9]+[^)]*[)]$", "").trim().toLowerCase();',
 '  x = x.toLowerCase().replace((char) 10, (char) 32).trim();',
 '  if (!(x.indexOf("%s") >= 0 && x.indexOf("call") >= 0 && x.length() < 80)) return "";' % kind,
 '  String L = magicText.evaluateString("{" + "v=khWa}"); if (L == null) L = "";',
 '  if (L.trim().length() < 3) return "nolist";',
 '  return (t.length() > 0 && L.indexOf("|" + t + "|") >= 0) ? "1" : "";',
 '} catch (Throwable e) { return ""; }'])

# Java: phone ki apni ringtone — khRg 1 rahe tab tak (60 s hadd). Silent / vibrate / DND mein WhatsApp khud nahi bajata.
RINGJ = '\n'.join([
 'try {',
 '  android.net.Uri u = android.media.RingtoneManager.getActualDefaultRingtoneUri(appContext, android.media.RingtoneManager.TYPE_RINGTONE);',
 '  if (u == null) u = android.provider.Settings.System.DEFAULT_RINGTONE_URI;',
 '  android.media.Ringtone r = android.media.RingtoneManager.getRingtone(appContext, u);',
 '  if (r == null) return "no ringtone";',
 '  r.setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)'
 '.setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());',
 '  if (android.os.Build.VERSION.SDK_INT >= 28) r.setLooping(true);',
 '  r.play();',
 '  long t0 = System.currentTimeMillis();',
 '  while (System.currentTimeMillis() - t0 < 60000) {',
 '    String g = magicText.evaluateString("{" + "v=khRg}");',
 '    if (g == null || !g.trim().equals("1")) break;',
 '    if (!r.isPlaying()) r.play();',
 '    Thread.sleep(300);',
 '  }',
 '  r.stop();',
 '  return "ok";',
 '} catch (Throwable e) { return "err " + e; }'])

for _j in (NAMES, HIT('incoming'), HIT('ongoing'), RINGJ):
    _bad = [m.start() for m in re.finditer(r'\{(?![\s"])', _j)]
    assert not _bad, ('magic text jaisa {', [_j[i:i + 20] for i in _bad])

# export ALAG folder 'kw' mein — Remote ka BUILD DIR ki sab se nayi .mdr ko phone ki backup samajhta hai (subfolder nahi dekhta)
MKDIR = 'try { new java.io.File("' + DIR + '/kw").mkdirs(); return "ok"; } catch (Throwable e) { return "err"; }'
EXPORT = {"m_classType": "ExportMacrosAction", "m_SIGUID": 0, "option": 0, "m_fileName": "nt-kw", "useAllFilesAccess": True, "allFilesPath": DIR + "/kw"}
REFRESH = [java(MKDIR, "kn"), EXPORT, java(NAMES, "kn")]

# ---------- KW: WhatsApp call par ghanti ----------
kw = [
  iff([trig(K1, "WhatsApp call")]),
    lstr("wt", "{not_title}"), lstr("wx", "{notification}"),        # trigger ka magic text pehle local mein (qaida)
    lstr("hit", ""), java(HIT('incoming'), "hit"),
    iff([streq("hit", "nolist")]), java(NAMES, "kn"), java(HIT('incoming'), "hit"), END,
    iff([streq("hit", "1"), lt("rg", 1, True)]),
      si("rg", 1), si("md", 0), si("dn", 0),
      iff([vmode(1)]), si("md", 1), END,
      iff([vmode(2)]), si("md", 2), END,
      iff([dnd(1)]), si("dn", 1), END,
      iff([dnd(2)]), si("dn", 2), END,
      iff([dnd(3)]), si("dn", 3), END,
      iff([gt("dn", 0, True)]), setdnd(0), END,
      se("oldr", "{vol_ring}"),
      {"m_classType": "SetVibrateAction", "m_SIGUID": 0, "m_optionInt": 1},
      vol(RING, 100),
      se("pl", "{lv=md}+{lv=dn}"),                                   # pehle silent / vibrate / DND = WhatsApp khud nahi bajega
      iff([gt("pl", 0, True)]), gint("khRg", 1), java(RINGJ, "rr", block=False), END,
      wait([notif(KW_W[0], 1, "incoming"), notif(KW_W[1], 0, "ongoing"), notif(KW_W[2], 0, "missed")], 70),
      gint("khRg", 0),
      volv(RING, "oldr"),
      iff(eq("md", 1)), {"m_classType": "SetVibrateAction", "m_SIGUID": 0, "m_optionInt": 0}, END,
      iff([gt("md", 1, True)]), {"m_classType": "SilentModeVibrateOffAction", "m_SIGUID": 0, "option": 0, "mechanism": 0}, END,
      iff(eq("dn", 1)), setdnd(1), END,
      iff(eq("dn", 2)), setdnd(2), END,
      iff([gt("dn", 2, True)]), setdnd(3), END,
      si("rg", 0),
    END,
  ELSE,
    si("rg", 0), gint("khRg", 0),                                    # chalu hote hi / boot / roz subah = list taza
    *REFRESH,
  END]
KW = {"macroExportVersion": 1, "macro": {
    "m_name": "📞 Khaas log · WhatsApp call · ghanti poori",
    "m_description": "'📞 Khaas log · SIM call · ghanti poori' mein chune contacts ki WhatsApp call aaye to phone silent / vibrate / DND par ho tab bhi ghanti 100% (phone ki ringtone); call uthate / kat-te hi pehle wali haalat. Naam khud KV se aate hain (roz subah taza). AI nahi.",
    "m_GUID": 0, "m_enabled": True, "m_completed": True, "aiGenerated": 0, "m_category": "Claude",
    "m_triggerList": [notif(K1, 0, "incoming"), {"m_classType": "MacroEnabledTrigger", "m_SIGUID": K2},
                      {"m_classType": "BootTrigger", "m_SIGUID": K3},
                      {"m_classType": "TimerTrigger", "m_SIGUID": K4, "m_hour": 9, "m_minute": 7, "m_second": 0, "m_daysOfWeek": [True] * 7, "m_useAlarm": False}],
    "m_actionList": kw, "m_constraintList": [],
    "localVariables": [lvar("wt", 2), lvar("wx", 2), lvar("hit", 2), lvar("kn", 2), lvar("rr", 2), lvar("rg"), lvar("md"), lvar("dn"), lvar("oldr"), lvar("pl")]},
    "globalVariables": [var("khWa", 2), var("khWn"), var("khRg")], "userIcons": None,
    "aiFeedback": "All files access (Remote wali) + DND ki ijazat."}

# ---------- KW2: WhatsApp baat 20% ----------
kw2 = [
  iff([trig(B2, "Boot")]), si("on", 0),
  ELSE,
    lstr("wt", "{not_title}"), lstr("wx", "{notification}"),
    lstr("hit", ""), java(HIT('ongoing'), "hit"),
    iff([streq("hit", "1"), lt("on", 1, True)]), si("on", 1),
      se("oldc", "{vol_call}"),
      vol(CALL, 20),
      wait([notif(BW, 1, "ongoing")], 14400),
      volv(CALL, "oldc"), si("on", 0),
    END,
  END]
KW2 = {"macroExportVersion": 1, "macro": {
    "m_name": "📞 Khaas log · WhatsApp call · baat dheemi",
    "m_description": "'📞 Khaas log · SIM call · ghanti poori' wale contacts se WhatsApp par baat shuru (Ongoing call) = call ki awaaz 20%; khatam = pehli awaaz. Naam list '📞 Khaas log · WhatsApp call · ghanti poori' banata hai. AI nahi.",
    "m_GUID": 0, "m_enabled": True, "m_completed": True, "aiGenerated": 0, "m_category": "Claude",
    "m_triggerList": [notif(B1, 0, "ongoing"), {"m_classType": "BootTrigger", "m_SIGUID": B2}],
    "m_actionList": kw2, "m_constraintList": [],
    "localVariables": [lvar("wt", 2), lvar("wx", 2), lvar("hit", 2), lvar("on"), lvar("oldc")]},
    "globalVariables": [var("khWa", 2)], "userIcons": None}

if __name__ == '__main__':
    json.dump(KW, open(os.path.join(D, 'khaaswa.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(KW2, open(os.path.join(D, 'khaaswa20.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('khaaswa ok', len(kw), len(kw2))
