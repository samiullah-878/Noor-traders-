# ⏸ Claude ki hadein (malik 10 Nov 2026: "Claude zyada use hota hai, nazar kamzor — raat 12 se dopahar 12 band · shaam 6–7 band ·
#   har 20 minute ke baad 5 minute break · 5 minute zaroori wala rakh do")
#   Sirf phone ki Claude APP (com.anthropic.claude). Band = Home + 3 s ki chhoti patti (toast / baar baar paigham nahi).
#   🚨 Zaroori: band haalat mein app kholne par ek sawal — din mein 1 dafa 5 minute (clEmDay). AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
PK = ["com.anthropic.claude"]; NM = ["Claude"]
USE, BRK, EMG = 20, 300, 300          # 20 min istemal · 5 min break · 5 min zaroori
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
NECK = dict(ft("🦒 Gardan oonchi rakhein"), identifier="ntnk", yPosition=0.3, textSize=20)
NECKHIDE = {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 1, "identifier": "ntnk"}
def patti(text): return [HOME, ft(text), pause(3), FTHIDE]
NOW = "{system_time}"
a = [
    expr("emL", "{v=clEm}-" + NOW, True),
    expr("brL", "{v=clBrk}-" + NOW, True),
    # ginti: screen on + Claude saamne = 1 min; 5 min door / screen band = naya 20 min
    iff([trig(T1, "Har 1 minute"), SCR, fg()]), inc("clMin"), inc("clNk"), sint("clAway", 0), END,
    iff([trig(T1, "Har 1 minute"), anyof(fg(False), SCROFF)]), inc("clAway"), iff([gt("clAway", 4)]), sint("clMin", 0), END, END,
    iff([trig(T1, "Har 1 minute"), SCR, fg(), gt("clMin", USE - 2), lt("clMin", USE), lt("emL", 1, True)]),
      ft("⏸ 1 minute baqi — phir 5 minute break"), pause(4), FTHIDE,
    END,
    iff([gt("clMin", USE - 1), lt("brL", 1, True)]), expr("clBrk", NOW + "+%d" % BRK), sint("clMin", 0), setv("brL", 1, True, m_newIntValue=BRK), END,
    # band?
    iff([SCR, fg(), lt("emL", 1, True)]),
      sstr("why", "", True),
      iff([tod(0, 0, 10, 59)]), sstr("why", "⏸ Claude subah 11 baje khulegi", True), END,
      iff([tod(18, 0, 18, 59)]), sstr("why", "⏸ Shaam ka break — 7 baje khulegi", True), END,
      iff([gt("brL", 0, True)]), expr("bm", "({lv=brL}+59)/60", True), sstr("why", "⏸ 5 minute break — {lv=bm} min baqi", True), END,
      iff([strne("why", "", True)]),
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
    END,
    # 🦒 v34 (13 Nov, malik: 'Claude use karte hue gardan oonchi rakhein ka popup — 2 s, khud gayab, har 10 min'): sirf jab Claude khuli chal rahi ho
    iff([trig(T1, "Har 1 minute"), SCR, fg(), gt("clNk", 9)]), sint("clNk", 0),
      iff([lt("brL", 1, True), anyof(tod(11, 0, 17, 59), tod(19, 0, 23, 59), gt("emL", 0, True))]), NECK, pause(2), NECKHIDE, END,
    END,
]
def var(n, t=1): return {"m_name": n, "m_type": t, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False}
def lvar(n, t=1): return {"m_name": n, "m_type": t, "isLocalVar": True, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False}
CB = {"macroExportVersion": 1, "macro": {
    "m_name": "⏸ Claude break",
    "m_description": "Claude app: raat 12 se subah 11 band · shaam 6–7 band · 🦒 har 10 min gardan ki yaad (2 s) · har 20 min istemal ke baad 5 min break (5 min door = naya 20). "
                     "Band = Home + 3 s patti. 🚨 Zaroori: din mein 1 dafa 5 minute. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [lvar("emL"), lvar("brL"), lvar("bm"), lvar("askAge"), lvar("why", 2), lvar("never", 0)],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("clMin"), var("clAway"), var("clBrk"), var("clEm"), var("clAsk"), var("clEmDay", 2), var("clNk")],
    "userIcons": None}
if __name__ == '__main__':
    json.dump(CB, open(os.path.join(D, 'cb.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('cb ok', len(a))
