# 🧘 10 minute break (malik 14 Nov 2026: "mujhe 10 minute ka break chahiye — paani wale popup par 'kya 10 minute break lena chahte ho' · yes kahun to start ·
#   phone, WhatsApp ke ilawa sab band, jaise pehle band hota hai · subah wali list ki tarah")
#   Paani popup ke foran baad sawal (pkg.py paani mein jorta hai): Haan = global brEnd = ab + 600 s.
#   Yeh macro: brEnd tak har app band (Home + 3 s patti "N min baqi") SIWAE subah wali list (subah.py ALLOW / PARTS — ek hi jagah). Waqt poora = "Break khatam" patti, brEnd 0.
#   Beech mein khatam karne ka raasta NAHI (malik ko bataya: 10 minute pakke). Call ke dauran kuch nahi. Koi app / macro band ya delete nahi hota. AI nahi.
import json, os
from cb import setv, expr, sstr, lt, gt, trig, SCR, iff, END, ELSE, HOME, pause, var, lvar, NOW
from subah import BLOCKED
D = os.path.dirname(os.path.abspath(__file__))
LEN = 600
T1, T2 = 112233445566981, 112233445566982
def ft(text): return {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 0, "identifier": "ntbr", "textToDisplay": text,
    "bgColor": -15788246, "textColor": -1, "alpha": 92, "updateLocation": False, "xPosition": 0.5, "yPosition": 0.04, "padding": 8, "textSize": 16,
    "corners": 14, "alignment": 0, "moveOption": 0, "variableWidth": True, "widthPercentage": 90, "showOverStatusBar": False, "enableShadow": True}
FTHIDE = {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 1, "identifier": "ntbr"}
a = [
    expr("brL", "{v=brEnd}-" + NOW, True),
    iff([gt("brL", 0, True), SCR]),
      iff([trig(T2, "App khuli")]), sstr("pk", "{app_package}", True), ELSE, sstr("pk", "{fg_app_package}", True), END,
      iff(BLOCKED),
        expr("brM", "({v=brEnd}-" + NOW + ")/60+1", True),
        HOME, ft("🧘 Break — {lv=brM} min baqi"), pause(3), FTHIDE,
      END,
    END,
    iff([lt("brL", 1, True), gt("brEnd", 0)]),
      expr("brEnd", "0"),
      iff([SCR]), ft("✅ Break khatam"), pause(3), FTHIDE, END,
    END,
]
BR = {"macroExportVersion": 1, "macro": {
    "m_name": "🧘 10 min break",
    "m_description": "Paani popup par 'Haan' = 10 minute sab apps band — siwae phone / calls, WhatsApp, banking, MacroDroid, Chrome, SMS, ghari, Settings (subah wali list). "
                     "Band = Home + 3 s patti. 10 minute baad khud khatam. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [lvar("brL"), lvar("brM"), lvar("pk", 2)],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "isAllApps": True, "m_packageNameList": [], "m_applicationNameList": []}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("brEnd")],
    "userIcons": None}
# Paani ke popup ke baad ka sawal (pkg.py isay paani ki action list mein jorta hai)
def ask():
    return [iff([{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "never", "m_type": 0, "isLocalVar": True}, "m_booleanValue": True}]),
            {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "🧘 10 minute ka break?",
             "text": "<big><b>Kya 10 minute ka break lena chahte ho?</b></big><br><br>Haan = 10 minute phone aur WhatsApp ke ilawa sab band.", "positiveText": "✅ Haan", "negativeText": "Nahi",
             "cancelAfterTimeout": True, "timeoutSeconds": 30, "htmlFormat": True, "useCustomColors": True, "textColor": -15658735, "bgColor": -1},
            expr("brEnd", NOW + "+%d" % LEN),
            END]
if __name__ == '__main__':
    json.dump(BR, open(os.path.join(D, 'brk.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('brk ok', len(a))
