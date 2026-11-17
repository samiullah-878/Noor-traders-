# 🚨 Dukan nigrani (malik 17 Nov 2026: "dukan ka system ruke to phone bajega · deep socho · baqi notifications jaisa screen par pop")
#   Server PC (doctor -> pc/nabz.js) har 2 min Firestore pcBeat/<chaabi> mein dukan ka HAAL likhta hai. Yeh macro har 3 min (9:30 am - 9 pm,
#   Pakistan waqt) woh doc parhta hai (Java, HttpURLConnection + org.json) aur:
#     🔴 awaaz + screen ke upar patti (heads-up, WhatsApp jaisi): PC / internet 10 min se band (dukan ke waqt, aaj bill bane the),
#        thermal mein parchiyan phansi, WhatsApp Business toota, der se koi bill nahi — wohi masla 30 min baad dobara, zyada se zyada 3 dafa
#     🟡 khamosh patti (sirf notification bar): NT-PRINT / camera band, ijazat ka intezar, 11 baje tak PC on nahi — ek baat din mein ek dafa
#     ✅ / 🟢 masla khatam = wahi patti khamoshi se 'theek' se badal jati hai
#   Hazri app mein chhutti = kuch nahi. Chaabi + link REPO MEIN NAHI: app (malik, PC scripts -> 🚨 Phone alarm jorein) webhook `nt_nabz`
#   se global nbU (Firestore link) bhejti hai; nbT=1 = 🔔 test patti. Koi app band nahi, koi toast nahi. AI nahi.
import json, os
from cb import trig, iff, END, ELSE, var, lvar
D = os.path.dirname(os.path.abspath(__file__))
T1, T2 = 112233445566701, 112233445566702
APP = "https://samiullah-878.github.io/Noor-traders-/#nabz"

J1 = '\n'.join([
 'String ev(String k) { try { String v = magicText.evaluateString("{" + k + "}"); return v == null ? "" : v.trim(); } catch (Throwable e) { return ""; } }',
 'String cl(String s) { if (s == null) return ""; s = s.replace((char) 34, (char) 39).replace((char) 92, (char) 47).replace((char) 123, (char) 40).replace((char) 125, (char) 41).replace((char) 10, (char) 32).replace((char) 13, (char) 32); return s.length() > 300 ? s.substring(0, 300) : s; }',
 'String kk(String s) { return s == null ? "" : s.replace((char) 126, (char) 45); }',
 'String fs(org.json.JSONObject f, String k) { org.json.JSONObject o = f.optJSONObject(k); if (o == null) return ""; if (o.has("stringValue")) return o.optString("stringValue", ""); if (o.has("integerValue")) return o.optString("integerValue", ""); return ""; }',
 'void out(String c, String t, String m, String st) { variableSetter.setString("nbC", c, 1); variableSetter.setString("nbTt", cl(t), 1); variableSetter.setString("nbMs", cl(m), 1); variableSetter.setString("nbS", st, 2); }',
 'try {',
 '  String U = ev("v=nbU"), S = ev("v=nbS");',
 '  long now = System.currentTimeMillis();',
 '  java.util.TimeZone z = java.util.TimeZone.getTimeZone("Asia/Karachi");',
 '  java.util.Calendar c = java.util.Calendar.getInstance(z); c.setTimeInMillis(now);',
 '  int m = c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE);',
 '  java.text.SimpleDateFormat df = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US); df.setTimeZone(z);',
 '  java.text.SimpleDateFormat tf = new java.text.SimpleDateFormat("h:mm a", java.util.Locale.US); tf.setTimeZone(z);',
 '  String day = df.format(new java.util.Date(now));',
 '  String[] p = (S + "~~~~~").split("~", -1);',
 '  String rk = p[0], yk = p[3], yd = p[4]; int rn = 0; long rt = 0;',
 '  try { rn = Integer.parseInt(p[1]); } catch (Throwable e) { } try { rt = Long.parseLong(p[2]); } catch (Throwable e) { }',
 '  String keep = rk + "~" + rn + "~" + rt + "~" + yk + "~" + yd;',
 '  if (m < 570 || m >= 1260) { out("N", "", "", "~0~0~" + yk + "~" + yd); return "waqt nahi"; }',
 '  if (U.length() < 20) { out("N", "", "", keep); return "link nahi"; }',
 '  String body = null; int code = 0;',
 '  try {',
 '    java.net.HttpURLConnection h = (java.net.HttpURLConnection) new java.net.URL(U).openConnection();',
 '    h.setConnectTimeout(10000); h.setReadTimeout(10000); h.setUseCaches(false);',
 '    code = h.getResponseCode();',
 '    if (code == 200) { java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(h.getInputStream(), "UTF-8")); StringBuilder b = new StringBuilder(); String ln; while ((ln = r.readLine()) != null) b.append(ln).append(" "); r.close(); body = b.toString(); }',
 '    h.disconnect();',
 '  } catch (Throwable e) { out("N", "", "", keep); return "net nahi"; }',   # phone ka apna net na ho = PC ka ilzam nahi
 '  if (body == null) { out("N", "", "", keep); return "http " + code; }',
 '  org.json.JSONObject f = new org.json.JSONObject(body).optJSONObject("fields");',
 '  if (f == null) { out("N", "", "", keep); return "khali"; }',
 '  long at = 0; try { at = Long.parseLong(fs(f, "at")); } catch (Throwable e) { }',
 '  String d = fs(f, "d"), r = fs(f, "r"), rkey = kk(fs(f, "rk")), y = fs(f, "y"), ykey = kk(fs(f, "yk"));',
 '  boolean act = "1".equals(fs(f, "act")), hz = "1".equals(fs(f, "hz")) && day.equals(d);',
 '  long age = now - at; int am = (int) (age / 60000L); String last = at > 0 ? tf.format(new java.util.Date(at)) : "?";',
 '  if (at > 0 && age > 600000L) {',   # PC 10 min se chup
 '    r = ""; rkey = ""; y = ""; ykey = "";',
 '    if (day.equals(d) && act && m >= 600 && m < 1230) { rkey = "pc"; r = "🖥 Dukan ka PC / internet " + am + " min se band (aakhri khabar " + last + ") — PC on hai? bijli? internet?"; }',
 '    else if (day.equals(d)) { ykey = "pcq:" + day; y = "🖥 Dukan ka PC " + am + " min se chup (aakhri khabar " + last + ")"; }',
 '    else if (m >= 660) { ykey = "pcoff:" + day; y = "🖥 11 baj gaye — aaj dukan ka PC abhi tak on nahi hua / internet nahi"; }',
 '  }',
 '  if (hz) { r = ""; rkey = ""; y = ""; ykey = ""; }',
 '  String cd = "N", tt = "", ms = "", nrk = rk, nyk = yk, nyd = yd; int nrn = rn; long nrt = rt;',
 '  if (rkey.length() > 0) {',
 '    if (rkey.equals(rk)) { if (rn < 3 && now - rt >= 1800000L) { cd = "R"; nrn = rn + 1; nrt = now; } }',
 '    else { cd = "R"; nrk = rkey; nrn = 1; nrt = now; }',
 '    if (cd.equals("R")) { tt = "🚨 Dukan: zaroori" + (nrn > 1 ? " (" + nrn + "/3)" : ""); ms = r; }',
 '  } else if (rk.length() > 0) { cd = "O"; tt = "✅ Dukan ka system theek"; ms = "Pehle wala masla ab nahi raha."; nrk = ""; nrn = 0; nrt = 0; }',
 '  if (cd.equals("N")) {',
 '    if (ykey.length() > 0 && !(ykey.equals(yk) && day.equals(yd))) { cd = "Y"; tt = "🟡 Dukan: dekh lein"; ms = y; nyk = ykey; nyd = day; }',
 '    else if (ykey.length() == 0 && yk.length() > 0 && day.equals(yd)) { cd = "G"; tt = "🟢 Dukan: theek"; ms = "Pehle wali baat theek ho gayi."; nyk = ""; }',
 '  }',
 '  out(cd, tt, ms, nrk + "~" + nrn + "~" + nrt + "~" + nyk + "~" + nyd);',
 '  return cd;',
 '} catch (Throwable e) { try { variableSetter.setString("nbC", "N", 1); } catch (Throwable e2) { } return "masla " + e; }'])

def lv(n): return {"m_name": n, "m_type": 2, "isLocalVar": True}
def lsstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv(n), "m_newStringValue": v}
def gsstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": False}, "m_newStringValue": v}
def leq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": lv(n), "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
def geq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": False}, "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
OPEN = json.dumps({"m_classType": "OpenWebPageAction", "m_SIGUID": 112233445566709, "m_urlToOpen": APP}, separators=(',', ':'))
def note(title, text, nid, loud):
    a = {"m_classType": "NotificationAction", "m_SIGUID": 0, "m_notificationSubject": title, "m_notificationText": text,
         "m_overwriteExisting": True, "notificationIdString": nid, "autoExpand": True, "iconType": 0,
         "configuredActionJson": OPEN, "configuredActionClassType": "OpenWebPageAction", "configuredActionName": "Blue Khata kholo"}
    if loud: a.update({"m_priority": 2, "m_notificationChannelType": 0, "showAsOverlayOption": 2})   # 🔴 awaaz + screen ke upar patti
    else: a.update({"m_priority": 0, "m_notificationChannelType": 1, "showAsOverlayOption": 0})       # khamosh, sirf bar mein
    return a
WH = trig(T2, "Webhook nt_nabz")
a = [
    iff([WH, geq("nbT", "1")]),
      gsstr("nbT", ""),
      note("🔔 Test — Dukan nigrani", "Yeh sirf test hai. Asal masla hua to aise hi awaaz ke saath patti aayegi.", "nbr", True),
    ELSE,
      iff([WH]),
        note("✅ Dukan nigrani jur gaya", "Har 3 min dukan ka haal dekhega (9:30 am - 9 pm). Masla hua to awaaz ke saath patti aayegi.", "nbj", False),
      END,
    END,
    lsstr("nbC", ""),
    {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": J1, "blockNextAction": True, "responseVariableName": "nbR", "runInBackgroundThread": True},
    iff([leq("nbC", "R")]), note("{lv=nbTt}", "{lv=nbMs}", "nbr", True), END,
    iff([leq("nbC", "O")]), note("{lv=nbTt}", "{lv=nbMs}", "nbr", False), END,
    iff([leq("nbC", "Y")]), note("{lv=nbTt}", "{lv=nbMs}", "nby", False), END,
    iff([leq("nbC", "G")]), note("{lv=nbTt}", "{lv=nbMs}", "nby", False), END,
]
def lvs(n): return {"m_name": n, "m_type": 2, "isLocalVar": True, "m_stringValue": ""}
NB = {"macroExportVersion": 1, "macro": {
    "m_name": "🚨 Dukan nigrani",
    "m_description": "Har 3 min (9:30 am - 9 pm) dukan ke server PC ka haal dekhta hai. 🔴 PC / internet band, thermal phansa, WhatsApp toota, der se bill nahi = awaaz + screen par patti (30 min baad dobara, 3 dafa tak). 🟡 NT-PRINT / camera band, ijazat = khamosh patti. Chhutti = kuch nahi. Patti dabao = Blue Khata. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvs("nbC"), lvs("nbTt"), lvs("nbMs"), lvs("nbR")],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 180, "m_useAlarm": True,
         "m_constraintList": [{"m_classType": "TimeOfDayConstraint", "m_SIGUID": 112233445566703, "m_startHour": 9, "m_startMinute": 25, "m_endHour": 21, "m_endMinute": 5}]},
        {"m_classType": "WebHookTrigger", "m_SIGUID": T2, "identifier": "nt_nabz", "variableWhiteListEnabled": True, "variableWhiteList": ["nbU", "nbT"]}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("nbU", 2), var("nbT", 2), var("nbS", 2)], "userIcons": None,
    "aiFeedback": "Notification ki ijazat + MacroDroid ki battery optimization band honi chahiye."}
if __name__ == '__main__':
    json.dump(NB, open(os.path.join(D, 'nabz.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('nabz ok', len(a))
