# ⏸ Claude ki hadein — v86 (malik 27 Nov 2026): SIRF raat 12 se subah 10:59 tak band. Shaam 6–7 (v85), 20 min / 5 min break, 🦒 gardan, "1 minute baqi" = HATA.
#   Sirf phone ki Claude APP (com.anthropic.claude). Band = Home + 3 s ki chhoti patti (toast / baar baar paigham nahi).
#   🚨 Zaroori: band haalat mein app kholne par ek sawal — din mein 1 dafa 5 minute (clEmDay). AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
PK = ["com.anthropic.claude"]; NM = ["Claude"]
EMG = 300                             # 5 min zaroori
T1, T2 = 112233445566661, 112233445566662
def gv(n, t, local=False): return {"m_name": n, "m_type": t, "isLocalVar": local}
def setv(n, t, local=False, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, t, local)}; a.update(kw); return a
def inc(n): return setv(n, 1, m_intValueIncrement=True)
def sint(n, v): return setv(n, 1, m_newIntValue=v)
def expr(n, e, local=False): return setv(n, 1, local, m_intExpression=True, m_expression=e)
def sstr(n, v, local=False): return setv(n, 2, local, m_newStringValue=v)
def lt(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, local), "m_intLessThan": True, "m_intValue": v}
def gt(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, local), "m_intGreaterThan": True, "m_intValue": v}
def strne(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 2, local), "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": False}
def boolc(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, True), "m_booleanValue": v}
def trig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": False}
def fg(on=True): return {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": on, "m_foreground": True, "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0, "mechanismOption": 2}
SCR = {"m_classType": "ScreenOnOffConstraint", "m_SIGUID": 0, "m_screenOn": True}
SCROFF = {"m_classType": "ScreenOnOffConstraint", "m_SIGUID": 0, "m_screenOn": False}
def anyof(*c): return {"m_classType": "LogicConstraint", "m_SIGUID": 0, "m_isOrCondition": True, "m_constraintList": list(c)}
def tod(h1, m1, h2, m2): return {"m_classType": "TimeOfDayConstraint", "m_SIGUID": 0, "m_startHour": h1, "m_startMinute": m1, "m_endHour": h2, "m_endMinute": m2}
def iff(c): return {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": c}
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
ELSE = {"m_classType": "ElseAction", "m_SIGUID": 0}
HOME = {"m_classType": "LaunchHomeScreenAction", "m_SIGUID": 0, "useAccessibilityService": True}
def pause(s): return {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": s, "m_useAlarm": False}
def ft(text): return {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 0, "identifier": "ntcl", "textToDisplay": text,
    "bgColor": -15788246, "textColor": -1, "alpha": 92, "updateLocation": False, "xPosition": 0.5, "yPosition": 0.04, "padding": 8, "textSize": 16,
    "corners": 14, "alignment": 0, "moveOption": 0, "variableWidth": True, "widthPercentage": 90, "showOverStatusBar": False, "enableShadow": True}
FTHIDE = {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 1, "identifier": "ntcl"}
def patti(text): return [HOME, ft(text), pause(3), FTHIDE]
NOW = "{system_time}"
a = [
    expr("emL", "{v=clEm}-" + NOW, True),
    # v86 (27 Nov, malik: "sirf raat 12 se subah 11 tak hi rahe, baqi us mein kuch nahi chahiye"): 20 min istemal / 5 min break, "1 minute baqi" patti, 🦒 gardan HATA — wapas mat lao jab tak malik na kahe
    iff([SCR, fg(), lt("emL", 1, True), tod(0, 0, 10, 59)]),
      sstr("why", "⏸ Claude subah 11 baje khulegi", True),
      expr("askAge", NOW + "-{v=clAsk}", True),
      iff([trig(T2, "Claude khuli"), strne("clEmDay", "{dayofmonth}"), gt("askAge", 30, True)]),
        expr("clAsk", NOW),
        iff([boolc("never", True)]),
        {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "{lv=why}",
         "text": "Zaroori kaam hai?<br>Aaj sirf <b>1 dafa 5 minute</b> mil sakte hain.", "positiveText": "🚨 5 min zaroori", "negativeText": "Theek hai",
         "cancelAfterTimeout": True, "timeoutSeconds": 15, "htmlFormat": True, "useCustomColors": True, "textColor": -1, "bgColor": -15788246},
          expr("clEm", NOW + "+%d" % EMG), sstr("clEmDay", "{dayofmonth}"),
        ELSE,
          *patti("{lv=why}"),
        END,
      ELSE,
        *patti("{lv=why}"),
      END,
    END,
]
def var(n, t=1): return {"m_name": n, "m_type": t, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False}
def lvar(n, t=1): return {"m_name": n, "m_type": t, "isLocalVar": True, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False}
CB = {"macroExportVersion": 1, "macro": {
    "m_name": "⏸ Claude break",
    "m_description": "Claude app: SIRF raat 12 se subah 11 band (baqi waqt koi had / break / gardan ki yaad nahi). "
                     "Band = Home + 3 s patti. 🚨 Zaroori: din mein 1 dafa 5 minute. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [lvar("emL"), lvar("askAge"), lvar("why", 2), lvar("never", 0)],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("clEm"), var("clAsk"), var("clEmDay", 2)],
    "userIcons": None}
if __name__ == '__main__':
    json.dump(CB, open(os.path.join(D, 'cb.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('cb ok', len(a))
