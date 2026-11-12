# ⛔ Subah 11 tak (malik 12 Nov 2026: "11:00 am tak sab apps band kar do — banking, WhatsApp, calls, [Macro]Droid chalta rahe · aur Chrome bhi (Chrome khula rakhna hai) · 10 minute ke liye [zaroori raasta]")
#   Raat 12:00 se subah 10:59 tak har app band (Home + 3 s patti) SIWAE: phone / calls / contacts · WhatsApp (+ Business) · banking · MacroDroid · Chrome (+ Blue Khata jaisi webapk) ·
#   SMS (bank OTP) · ghari / alarm · Settings · system (launcher, keyboard, permission, systemui). 🚨 Zaroori: din mein 1 dafa 10 minute (sbEmDay) — us dauran sab khula.
#   Do trigger: har app khulne par + har 1 minute (jo app pehle se khuli ho). Call ke dauran kuch nahi. AI nahi. Phone par yahan test nahi ho sakta.
import json, os
from cb import setv, expr, sstr, lt, gt, strne, boolc, trig, SCR, tod, iff, END, ELSE, HOME, pause, var, lvar, NOW
from bank import PK as BANKS
D = os.path.dirname(os.path.abspath(__file__))
EMG = 600
T1, T2 = 112233445566681, 112233445566682
# poora naam (",pkg," ki shakal mein dhoonda jata hai)
ALLOW = ['android', 'com.android.chrome', 'com.arlosoft.macrodroid', 'com.whatsapp', 'com.whatsapp.w4b', 'com.google.android.gms', 'com.android.intentresolver',
         'com.android.phone', 'com.android.settings'] + list(BANKS)
# naam ka hissa (phone company ke hisaab se package badalta hai — OnePlus / Oppo / Google)
PARTS = ['webapk', 'chrome', 'whatsapp', 'macrodroid', 'bank', 'dialer', 'incall', 'telecom', 'contacts', 'messaging', 'mms', 'clock', 'settings',
         'launcher', 'inputmethod', 'systemui', 'permission', 'packageinstaller']
ALLOWS = ',' + ','.join(ALLOW) + ','
def has(a, b, yes=True): return {'m_classType': 'CompareValueConstraint', 'm_SIGUID': 0, 'type': 2, 'value1': a, 'value2': b, 'comparisonType': 4 if yes else 5, 'ignoreCase': True}
NO_CALL = {'m_classType': 'InCallConstraint', 'm_SIGUID': 0, 'm_inCall': False}
NOT_LAUNCHER = {'m_classType': 'LauncherIsInForegroundConstraint', 'm_SIGUID': 0, 'm_inForeground': False}
def ft(text): return {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 0, "identifier": "ntsb", "textToDisplay": text,
    "bgColor": -15788246, "textColor": -1, "alpha": 92, "updateLocation": False, "xPosition": 0.5, "yPosition": 0.04, "padding": 8, "textSize": 16,
    "corners": 14, "alignment": 0, "moveOption": 0, "variableWidth": True, "widthPercentage": 90, "showOverStatusBar": False, "enableShadow": True}
FTHIDE = {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 1, "identifier": "ntsb"}
PATTI = [HOME, ft("⛔ Subah 11 baje khulega"), pause(3), FTHIDE]
BLOCKED = [strne("pk", "", True), NOT_LAUNCHER, NO_CALL, has(ALLOWS, ",{lv=pk},", False)] + [has("{lv=pk}", p, False) for p in PARTS]
a = [
    expr("emL", "{v=sbEm}-" + NOW, True),
    iff([tod(0, 0, 10, 59), SCR, lt("emL", 1, True)]),
      iff([trig(T2, "App khuli")]), sstr("pk", "{app_package}", True), ELSE, sstr("pk", "{fg_app_package}", True), END,
      iff(BLOCKED),
        expr("askAge", NOW + "-{v=sbAsk}", True),
        iff([trig(T2, "App khuli"), strne("sbEmDay", "{dayofmonth}"), gt("askAge", 30, True)]),
          expr("sbAsk", NOW),
          iff([boolc("never", True)]),
          {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "⛔ Subah 11 baje tak band",
           "text": "Zaroori kaam hai?<br>Aaj sirf <b>1 dafa 10 minute</b> mil sakte hain.", "positiveText": "🚨 10 min zaroori", "negativeText": "Theek hai",
           "cancelAfterTimeout": True, "timeoutSeconds": 15, "htmlFormat": True, "useCustomColors": True, "textColor": -1, "bgColor": -15788246},
            expr("sbEm", NOW + "+%d" % EMG), sstr("sbEmDay", "{dayofmonth}"),
          ELSE,
            *PATTI,
          END,
        ELSE,
          *PATTI,
        END,
      END,
    END,
]
SB = {"macroExportVersion": 1, "macro": {
    "m_name": "⛔ Subah 11 tak",
    "m_description": "Raat 12 se subah 11 tak sab apps band — siwae phone / calls, WhatsApp, banking, MacroDroid, Chrome, SMS, ghari, Settings. "
                     "Band = Home + 3 s patti. 🚨 Zaroori: din mein 1 dafa 10 minute. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [lvar("emL"), lvar("askAge"), lvar("pk", 2), lvar("never", 0)],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "isAllApps": True, "m_packageNameList": [], "m_applicationNameList": []}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("sbEm"), var("sbAsk"), var("sbEmDay", 2)],
    "userIcons": None}
if __name__ == '__main__':
    json.dump(SB, open(os.path.join(D, 'subah.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('subah ok', len(a), len(json.dumps(SB)))
