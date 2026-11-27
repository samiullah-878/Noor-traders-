# 🧠 Qoul laao (md pkg v86, malik 27 Nov 2026: "qoul ko Urdu mein kar do · qoul ki list update karo · qoul ki list mein jo video samjhao — wahan se qoul banao"
#   + chuna: "Urdu harf" + "sirf video wale" — purane 92 qoul BAND)
#   Blue Khata ki 🎓 Video samjhao har video ka 📌 Khulasa bante hi 🤖 usi video ki baat se 2-3 qoul (Urdu harf) banati hai + ⭐ pasand ki line,
#   aur Firestore qoulPh/<chaabi> mein rakhti hai {t: 'urdu‖video§urdu‖video…', v: badlaav ka nishan}. Yeh macro har 30 min (aur app ka webhook
#   nt_qoul aate hi) woh doc GET karta hai -> global qoV (list) + qoW (nishan); naya list = qoI 0 (naye qoul ki baari pehle).
#   🧠 Falsafa popup (qaide.py) qoV mein se baari baari ek qoul dikhata hai. Link + chaabi REPO MEIN NAHI: wahi ntU / ntK jo ✍️ Likho + 💧 sehat tick
#   istemal karte hain (app ka webhook nt_qoul bhi saath bhejta hai). Net na ho / doc na ho = purana list waise hi. Koi popup / toast nahi. AI phone par NAHI.
import json, os
from cb import setv, sint, iff, END, gt, lt, strne, trig, var, lvar
from remind import java, sstr
D = os.path.dirname(os.path.abspath(__file__))
T1, T2 = 112233445567951, 112233445567952

JQ = '\n'.join(['try {',
    '  String u = magicText.evaluateString("{" + "v=ntU}"); if (u == null) u = "";',
    '  String k = magicText.evaluateString("{" + "v=ntK}"); if (k == null) k = "";',
    '  k = k.trim();',
    '  if (u.indexOf("/awazNotes?") > 0 && k.length() >= 24 && k.matches("[A-Za-z0-9]+")) return u.replace("/awazNotes?", "/qoulPh/" + k + "?");',
    '  return "";',
    '} catch (Throwable e) { return ""; }'])
import re as _re
assert not _re.search(r'\{(?![\s"])', JQ), JQ

GET = {"m_classType": "HttpRequestAction", "m_SIGUID": 0, "requestConfig": {
    "requestType": 0, "urlToOpen": "{lv=qu}", "requestTimeOutSeconds": 15, "blockNextAction": True, "followRedirects": True,
    "headerParams": [], "queryParams": [], "saveReturnCodeToVariable": True, "returnCodeVariableName": "hc",
    "saveResponseType": 1, "responseVariableName": "qr"}}
def gstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": False}, "m_newStringValue": v}
def F(k): return '{lv=qd[fields][' + k + '][stringValue]}'
acts = [
    java(JQ, "qu"),
    iff([strne("qu", "", True)]),
      setv("hc", 1, True, m_newIntValue=0),
      GET,
      iff([gt("hc", 199, True), lt("hc", 300, True)]),
        {"m_classType": "JsonParseAction", "m_SIGUID": 0, "stringVarName": "qr", "dictionaryVarName": "qd", "parseColors": False},
        sstr("qt", F("t")), sstr("qw", F("v")),
        iff([strne("qw", "", True), strne("qw", "{v=qoW}", True)]),
          gstr("qoV", "{lv=qt}"), gstr("qoW", "{lv=qw}"), sint("qoI", 0),
        END,
      END,
    END,
]
QL = {"macroExportVersion": 1, "macro": {
    "m_name": "🧠 Qoul laao",
    "m_description": "Blue Khata ki 🎓 Video samjhao ke bane qoul (Urdu) har 30 min / app ke ishare par le aata hai — 🧠 Falsafa popup inhi mein se baari baari ek dikhata hai. Koi popup nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("qu", 2), lvar("hc"), lvar("qr", 2), {"m_name": "qd", "m_type": 4, "isLocalVar": True, "m_stringValue": ""}, lvar("qt", 2), lvar("qw", 2)],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 1800, "m_useAlarm": False},
        {"m_classType": "WebHookTrigger", "m_SIGUID": T2, "identifier": "nt_qoul", "variableWhiteListEnabled": True, "variableWhiteList": ["ntU", "ntK"]}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [var("qoV", 2), var("qoW", 2), var("qoI", 1), var("ntU", 2), var("ntK", 2)],
    "userIcons": None}
if __name__ == '__main__':
    json.dump(QL, open(os.path.join(D, 'qoul.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('qoul ok', len(acts))
