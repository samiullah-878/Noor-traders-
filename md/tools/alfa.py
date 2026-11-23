# 🏦 Alfa notification (malik 19 Nov 2026: "aisa pop aaye to add kar do · SMS aaye to double na ho jaye")
#   Alfa app (com.base.bankalfalah) ki "BAF A/C" wali notification (PKR … received / sent … Tx ID FT…) WAHI Firestore bankSms mein jaati hai
#   jahan 'Alflah sms' macro SMS bhejta hai (src 'notif', from 'Alfa'). PC bank-parchi v2.8 khud khate mein lagata hai; wahi Tx ID / waqt
#   wala SMS baad mein aaye = jurwan (ek hi entry). OTP / password / PIN wali notification KABHI nahi jaati.
#   Net na ho = text phone mein line (bkQ, 20 tak) — har 5 min (sirf jab line mein kuch ho) + agli notification par khud chala jata hai.
#   Chaabi + link REPO MEIN NAHI: app (malik, din mein 1 dafa, khamosh) webhook `nt_bank` se globals bkU (Firestore link) + bkK (bankKey).
#   Koi paigham / toast nahi. AI nahi.
#   v64 (21 Nov, malik: 'SMS wala lagta hai, pop wala nahi'): notification ki likhai pehle LOCAL variables (bkT / bkX — SetVariable mein magic text trigger ke saath
#   pakka chalta hai) mein, Java wahan se parhta hai; pehle Java seedha {notification} maangta tha (JavaAction mein trigger ka magic text azmaya hua nahi tha).
import json, os
from cb import trig, iff, END, ELSE, var, lvar, gv, inc, expr, gt, lt, strne
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3 = 112233445566781, 112233445566782, 112233445566783

J = '\n'.join([
 'String ev(String k) { try { String v = magicText.evaluateString("{" + k + "}"); return v == null ? "" : v; } catch (Throwable e) { return ""; } }',
 'String esc(String s) { StringBuilder b = new StringBuilder(); if (s == null) return ""; for (int i = 0; i < s.length(); i++) { char ch = s.charAt(i);',
 '  if (ch == 92) b.append((char) 92).append((char) 92); else if (ch == 34) b.append((char) 92).append((char) 34); else if (ch == 10) b.append((char) 92).append("n"); else if (ch < 32) b.append(" "); else b.append(ch); } return b.toString(); }',
 'String Q = "" + (char) 34;',
 'String f(String k, String v) { return Q + k + Q + ":{" + Q + "stringValue" + Q + ":" + Q + esc(v) + Q + "}"; }',
 'boolean post(String U, String body) {',
 '  try {',
 '    java.net.HttpURLConnection h = (java.net.HttpURLConnection) new java.net.URL(U).openConnection();',
 '    h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(12000); h.setReadTimeout(12000); h.setUseCaches(false);',
 '    h.setRequestProperty("Content-Type", "application/json; charset=utf-8");',
 '    java.io.OutputStream o = h.getOutputStream(); o.write(body.getBytes("UTF-8")); o.close();',
 '    int c = h.getResponseCode(); h.disconnect(); return c >= 200 && c < 300;',
 '  } catch (Throwable e) { return false; }',
 '}',
 'void keep(org.json.JSONArray a) { while (a.length() > 20) a.remove(0); variableSetter.setString("bkQ", a.length() == 0 ? "" : a.toString(), 2); }',
 'try {',
 '  String U = ev("v=bkU").trim(), K = ev("v=bkK").trim(), md = ev("lv=bkM").trim();',
 '  org.json.JSONArray q = new org.json.JSONArray();',
 '  try { String s0 = ev("v=bkQ").trim(); if (s0.startsWith("[")) q = new org.json.JSONArray(s0); } catch (Throwable e) { }',
 '  if (md.equals("n")) {',
 '    String tt = ev("lv=bkT").trim(), tx = ev("lv=bkX").trim();',
 '    if (tx.length() == 0 || tx.startsWith("{")) tx = ev("notification").trim();',
 '    if (tt.length() == 0 || tt.startsWith("{")) tt = ev("not_title").trim();',
 '    if (tt.startsWith("{")) tt = "";',
 '    String low = (tt + " " + tx).toLowerCase();',
 '    if (low.indexOf("otp") >= 0 || low.indexOf("one time") >= 0 || low.indexOf("password") >= 0 || low.indexOf(" pin") >= 0 || low.indexOf("pin:") >= 0 || low.indexOf("code is") >= 0) return "otp — nahi bheja";',
 '    if (tx.toUpperCase().indexOf("BAF") < 0 || tx.toUpperCase().indexOf("PKR") < 0) return "len-den nahi";',
 '    String text = (tt.length() > 0 ? tt + " — " : "") + tx;',
 '    if (text.length() > 2900) text = text.substring(0, 2900);',
 '    for (int i = 0; i < q.length(); i++) if (text.equals(q.optString(i))) return "pehle se line mein";',
 '    q.put(text);',
 '  }',
 '  if (q.length() == 0) return "khali";',
 '  if (U.length() < 20 || K.length() < 16) { keep(q); return "link nahi — line mein " + q.length(); }',
 '  org.json.JSONArray left = new org.json.JSONArray(); int ok = 0;',
 '  for (int i = 0; i < q.length(); i++) {',
 '    String t = q.optString(i);',
 '    if (left.length() == 0 && post(U, "{" + Q + "fields" + Q + ":{" + f("k", K) + "," + f("src", "notif") + "," + f("from", "Alfa") + "," + f("text", t) + "}}")) { ok++; continue; }',
 '    left.put(t);',
 '  }',
 '  keep(left);',
 '  return "bheja " + ok + (left.length() > 0 ? " · baqi " + left.length() : "");',
 '} catch (Throwable e) { return "masla " + e; }'])

def lsstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
def has(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 2, True), "m_stringValue": v, "m_stringComparisonType": 1, "checkCase": False}
def no(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 2, True), "m_stringValue": v, "m_stringComparisonType": 2, "checkCase": False}
# v70 (23 Nov, malik: 'Alfalah wala nahi chal raha' — Rs 100 Raast 13:43, Bank screen mein aaya hi nahi): macro HBL wale popup macro (jo chalta hai) jaisa SAADA —
#   popup -> seedha HttpRequest (URL {v=bkU}, chaabi {v=bkK}). Trigger ab Alfa ka HAR popup (likhai ki shart macro ke andar: BAF + PKR, OTP / PIN / password nahi).
#   Java ab sirf bachao: seedha bhejna 2xx na de (net nahi / likhai mein ajeeb harf) -> wohi purani line (bkQ) + 5 min wali dobara koshish.
#   Ginti (phone ki report mein nazar aati hai): bkN = len-den wala popup dekha · bkS = seedha chala gaya · bkC = aakhri jawab ka code.
HTTP = {"m_classType": "HttpRequestAction", "m_SIGUID": 0, "requestConfig": {"requestType": 1, "urlToOpen": "{v=bkU}", "requestTimeOutSeconds": 12, "contentType": "application/json",
    "contentBodySource": 0, "contentBodyText": '{"fields":{"k":{"stringValue":"{v=bkK}"},"src":{"stringValue":"notif"},"from":{"stringValue":"Alfa"},"text":{"stringValue":"{lv=bkT} - {lv=bkX}"}}}',
    "blockNextAction": True, "followRedirects": True, "headerParams": [], "queryParams": [],
    "saveResponseType": 0, "saveReturnCodeToVariable": True, "returnCodeVariableName": "rc", "useStaticContentBodyFile": True}}
JAVA = {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": J, "blockNextAction": True, "responseVariableName": "bkR", "runInBackgroundThread": True}
RC0 = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "rc", "m_type": 1, "isLocalVar": True}, "m_newIntValue": 0}
a = [
    lsstr("bkT", "{not_title}"), lsstr("bkX", "{notification}"), RC0,
    iff([has("bkX", "BAF"), has("bkX", "PKR"), no("bkX", "OTP"), no("bkX", "passw"), no("bkX", "one time"), no("bkX", " PIN"), no("bkX", "code is"), no("bkT", "OTP")]),
      inc("bkN"),
      iff([trig(T1, "Alfa notification")]),
        HTTP, expr("bkC", "{lv=rc}"),
        iff([gt("rc", 199, True), lt("rc", 300, True)]), inc("bkS"),
        ELSE, lsstr("bkM", "n"), JAVA, END,
      END,
    ELSE,
      lsstr("bkM", "q"),
      iff([strne("bkQ", "")]), JAVA, END,
    END,
]
AL = {"macroExportVersion": 1, "macro": {
    "m_name": "🏦 Alfa notification",
    "m_description": "Alfa app ki 'BAF A/C' paise aaye / gaye wali notification Blue Khata ke HBL Inbox (bankSms) mein — PC khud khate mein lagata hai, wahi Tx ID wala SMS jurwan (double nahi). OTP / PIN kabhi nahi. Net na ho = phone mein line, baad mein khud. Chaabi app webhook (nt_bank) se.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("bkM", 2), lvar("bkR", 2), lvar("bkT", 2), lvar("bkX", 2), lvar("rc", 1)],
    "m_triggerList": [
        {"m_classType": "NotificationTrigger", "m_SIGUID": T1, "m_option": 0, "m_packageNameList": ["com.base.bankalfalah"], "m_applicationNameList": ["Alfa"],
         "m_excludeApps": False, "separateTitleAndMessage": False, "matchOptionTitle": 0, "matchOptionMessage": 0,
         "m_ignoreOngoing": False, "m_supressMultiples": True},
        {"m_classType": "WebHookTrigger", "m_SIGUID": T2, "identifier": "nt_bank", "variableWhiteListEnabled": True, "variableWhiteList": ["bkU", "bkK"]},
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T3, "m_seconds": 300, "m_useAlarm": False,
         "m_constraintList": [{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 112233445566784, "m_variable": {"m_name": "bkQ", "m_type": 2, "isLocalVar": False},
                               "m_stringValue": "", "m_stringComparisonType": 0, "m_stringEqual": False}]}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("bkU", 2), var("bkK", 2), var("bkQ", 2), var("bkN"), var("bkS"), var("bkC")], "userIcons": None}
if __name__ == '__main__':
    json.dump(AL, open(os.path.join(D, 'alfa.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('alfa ok', len(a))
