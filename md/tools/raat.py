# 🌙 Raat ke sawal (malik 10–11 Nov 2026: "3-4-2 ... time mein khud lagao, wo mujhe pop dena start kar de 8 se le kar 10 ke darmiyan" · 11 Nov: "C" = koi app band NAHI, sirf popups).
#   20:30 roz  = 🌙 Raat ke 3 sawal (Itwar ko us ki jagah 🪞 Hafte ka aaina)
#   21:15 roz  = ☀️ Kal subah ka EK kaam
#   Roman Urdu, bari likhai, 2 min baad khud band. Koi app band nahi hoti, koi toast nahi. AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
H = lambda t, L: '<big><b>' + t + '</b></big><br><br>' + '<br><br>'.join(L)
RAAT = H('🌙 Raat ke 3 sawal', ['1. Aaj kaun sa kaam aisa kiya jo SIRF main kar sakta tha?', '2. Aaj kis kaam ne mera waqt khaya jo kisi aur ko dena chahiye tha?', '3. Aaj ghar walon ko main ne kya diya — waqt, ya sirf thakan?'])
HAFTA = H('🪞 Hafte ka aaina', ['1. Is hafte dukan mere baghair kitni chali?', '2. Kaun sa masla dobara aaya — us ki jar kya hai?', '3. Agle hafte kaun sa ek kaam CHHORNA hai?'])
SUBAH = H('☀️ Kal subah ka EK kaam', ['Kal ka sirf EK kaam chunein — jo ho jaye to din kamyab.', 'Usay abhi naam dein. Subah phone se pehle wohi.'])
q = lambda t: json.dumps(t, ensure_ascii=False)
JV = '\n'.join(['try {', '  java.util.Calendar c = java.util.Calendar.getInstance();', '  int h = c.get(java.util.Calendar.HOUR_OF_DAY);', '  int d = c.get(java.util.Calendar.DAY_OF_WEEK);',
                '  if (d == 1) return ' + q(HAFTA) + ';', '  return ' + q(RAAT) + ';', '} catch (Throwable t) {', '  return ' + q(RAAT) + ';', '}'])
from cb import sstr, strne, SCR, tod, iff, END, ELSE, var, lt, gt
# v46 (malik 15 Nov: "mujhe notes bhi do likhne ke liye — jab wo sawal poochta hai raat ko, notes mein likh bhi sakoon · subah 10:15 ka bhi laga do ·
#      us app mein jo recording wali screen hai us mein notes chale jayein — upar sawal, neeche us ka jawab jo main likhoon"):
#   teen waqt (10:15 subah · 20:30 · 21:15) popup -> "✍️ Likho" -> khana -> jawab Blue Khata ki 🎙 Meri baatein mein (awazNotes, fn 'likha': tt = sawal, sum = jawab).
#   Chaabi + link REPO MEIN NAHI: app (malik) webhook `nt_notes` se globals ntU (Firestore link) + ntK (chaabi) phone par rakhti hai. Net na ho = ntP1..3 mein jama, agli dafa (unlock) khud jata hai.
MORN = H('☀️ Aaj ke 3 zaroori kaam', ['Aaj ke 3 sab se zaroori kaam kya hain?', 'Jo sirf aap kar sakte hain wo pehle.'])
JT = '\n'.join(['try {', '  java.util.Calendar c = java.util.Calendar.getInstance();', '  if (c.get(java.util.Calendar.DAY_OF_WEEK) == 1) return "Hafte ka aaina";', '} catch (Throwable t) { }', 'return "Raat ke 3 sawal";'])
# jawab ko JSON ke liye mehfooz karo ({lv=…} script mein seedha nahi likhte — MacroDroid pehle hi badal deta hai aur quote se script toot-ti; "{" + "lv=…" se bachao)
JB = '\n'.join([
 'String esc(String s) { StringBuilder b = new StringBuilder(); if (s == null) return ""; for (int i = 0; i < s.length(); i++) { char ch = s.charAt(i);',
 '  if (ch == 92) b.append((char) 92).append((char) 92); else if (ch == 34) b.append((char) 92).append((char) 34); else if (ch == 10) b.append((char) 92).append("n"); else if (ch < 32) b.append(" "); else b.append(ch); } return b.toString(); }',
 'String Q = "" + (char) 34;',
 'String f(String k, String v) { return Q + k + Q + ":{" + Q + "stringValue" + Q + ":" + Q + esc(v) + Q + "}"; }',
 'try {',
 '  String a = magicText.evaluateString("{" + "lv=ans}"); String t = magicText.evaluateString("{" + "lv=qz}");',
 '  if (a == null) a = ""; a = a.trim(); if (a.length() > 3800) a = a.substring(0, 3800);',
 '  java.util.TimeZone z = java.util.TimeZone.getTimeZone("Asia/Karachi"); java.util.Date n = new java.util.Date();',
 '  java.text.SimpleDateFormat d1 = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US); d1.setTimeZone(z);',
 '  java.text.SimpleDateFormat d2 = new java.text.SimpleDateFormat("h:mm a", java.util.Locale.US); d2.setTimeZone(z);',
 '  return Q + "v" + Q + ":{" + Q + "integerValue" + Q + ":" + Q + "1" + Q + "}," + Q + "at" + Q + ":{" + Q + "integerValue" + Q + ":" + Q + n.getTime() + Q + "},"',
 '    + f("day", d1.format(n)) + "," + f("tm", d2.format(n)) + "," + f("src", "mic") + "," + f("fn", "likha") + "," + f("tt", t) + "," + f("sum", a) + ","',
 '    + Q + "ks" + Q + ":{" + Q + "arrayValue" + Q + ":{}}";',
 '} catch (Throwable e) { return ""; }'])
lv = lambda n, t: {"m_name": n, "m_type": t, "isLocalVar": True}
def lsstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv(n, 2), "m_newStringValue": v}
def lne(n): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": lv(n, 2), "m_stringValue": "", "m_stringComparisonType": 0, "m_stringEqual": False}
def gne(n): return strne(n, "")
def geq(n): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": False}, "m_stringValue": "", "m_stringComparisonType": 0, "m_stringEqual": True}
def post(rest): return {"m_classType": "HttpRequestAction", "m_SIGUID": 0, "requestConfig": {"requestType": 1, "urlToOpen": "{v=ntU}", "requestTimeOutSeconds": 8, "contentType": "application/json",
    "contentBodySource": 0, "contentBodyText": '{"fields":{"k":{"stringValue":"{v=ntK}"},' + rest + '}}', "blockNextAction": True, "followRedirects": True, "headerParams": [], "queryParams": [],
    "saveResponseType": 1, "responseVariableName": "rsp", "saveReturnCodeToVariable": True, "returnCodeVariableName": "rc", "useStaticContentBodyFile": True}}
OKRC = [gt("rc", 199, True), lt("rc", 300, True)]
def keep(i): return [iff([lne("body"), geq("ntP%d" % i)]), sstr("ntP%d" % i, "{lv=body}"), lsstr("body", ""), END]   # jama (khali khane mein), phir body khali = dobara jama nahi
WRITE = [lsstr("ans", ""),
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv("ans", 2), "m_userPrompt": True, "m_userPromptTitle": "✍️ {lv=qz}", "m_userPromptMessage": "Apna jawab likhein — app ki Meri baatein mein jayega.",
     "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": False, "m_userPromptEmptyAtStart": True},
    iff([lne("ans")]),
      {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": JB, "blockNextAction": True, "responseVariableName": "body", "runInBackgroundThread": True},
      iff([lne("body")]),
        {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv("rc", 1), "m_newIntValue": 0},
        iff([gne("ntU"), gne("ntK")]), post("{lv=body}"), END,
        iff(OKRC), lsstr("body", ""), END,
        *keep(1), *keep(2), *keep(3),
      END,
    END]
def retry(i): return [iff([gne("ntP%d" % i), gne("ntU"), gne("ntK")]),
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv("rc", 1), "m_newIntValue": 0},
    post("{v=ntP%d}" % i), iff(OKRC), sstr("ntP%d" % i, ""), END, END]
def dlg(text, title="🌙 Raat ka waqfa"): return [iff([{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "never", "m_type": 0, "isLocalVar": True}, "m_booleanValue": True}]),
    {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": title, "text": text, "positiveText": "✍️ Likho", "negativeText": "Baad mein",
     "cancelAfterTimeout": True, "timeoutSeconds": 120, "htmlFormat": True, "useCustomColors": True, "textColor": -15658735, "bgColor": -1},
    *WRITE,
    END]
tt = lambda sig, h, m: {"m_classType": "TimerTrigger", "m_SIGUID": sig, "m_hour": h, "m_minute": m, "m_daysOfWeek": [True] * 7, "m_useAlarm": True}
RT = {"macroExportVersion": 1, "macro": {
    "m_name": "🌙 Raat ke sawal",
    "m_description": "Subah 10:15 = aaj ke 3 kaam · raat 8:30 = Raat ke 3 sawal (Itwar: Hafte ka aaina) · 9:15 = Kal subah ka ek kaam. ✍️ Likho = jawab Blue Khata ki Meri baatein mein. Koi app band nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "rs", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "never", "m_type": 0, "isLocalVar": True, "m_booleanValue": False},
                       {"m_name": "ans", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "qz", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "body", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "rsp", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "rc", "m_type": 1, "isLocalVar": True, "m_intValue": 0}],
    # v41: phone lock ho to popup gum na ho — unlock par bhi dekhta hai. v46: subah 10:15 + webhook nt_notes (app se chaabi / link — sirf ntU, ntK badal sakta hai)
    "m_triggerList": [tt(112233445566881, 20, 30), tt(112233445566882, 21, 15), {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": 112233445566883},
                      tt(112233445566884, 10, 15),
                      {"m_classType": "WebHookTrigger", "m_SIGUID": 112233445566885, "identifier": "nt_notes", "variableWhiteListEnabled": True, "variableWhiteList": ["ntU", "ntK"]}],
    "m_actionList": [
        iff([tod(10, 15, 13, 59), SCR, strne("rqM", "{dayofmonth}")]),
          sstr("rqM", "{dayofmonth}"), lsstr("qz", "Aaj ke 3 zaroori kaam"),
          *dlg(MORN, "☀️ Subah"),
        END,
        iff([tod(20, 30, 23, 59), SCR, strne("rqA", "{dayofmonth}")]),
          sstr("rqA", "{dayofmonth}"),
          {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": JV, "blockNextAction": True, "responseVariableName": "rs", "runInBackgroundThread": True},
          {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": JT, "blockNextAction": True, "responseVariableName": "qz", "runInBackgroundThread": True},
          *dlg("{lv=rs}"),
        END,
        iff([tod(21, 15, 23, 59), SCR, strne("rqB", "{dayofmonth}")]),
          sstr("rqB", "{dayofmonth}"), lsstr("qz", "Kal subah ka EK kaam"),
          *dlg(SUBAH),
        END,
        *retry(1), *retry(2), *retry(3)],
    "m_constraintList": []},
    "globalVariables": [var("rqA", 2), var("rqB", 2), var("rqM", 2), var("ntU", 2), var("ntK", 2), var("ntP1", 2), var("ntP2", 2), var("ntP3", 2)], "userIcons": None, "aiFeedback": "Display over other apps ijazat."}
if __name__ == '__main__':
    json.dump(RT, open(os.path.join(D, 'raat.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('raat ok')
