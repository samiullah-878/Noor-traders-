# 🔎 Bari likhai (malik 10 Nov 2026: "macro banao — WhatsApp aur Claude ke liye lafz barha do, baqi waise hi"; nazar kamzor).
#   WhatsApp / WhatsApp Business / Claude saamne aaye = phone ka font scale BIG% ; in se bahar = pehle wala (`was`, khulte waqt parha).
#   Koi paigham / toast nahi. AI nahi. Size badalna = BIG (50–250).
import json, os
from full import fvar
D = os.path.dirname(os.path.abspath(__file__))
BIG = 130
PK = ["com.whatsapp", "com.whatsapp.w4b", "com.anthropic.claude"]; NM = ["WhatsApp", "WhatsApp Business", "Claude"]
T_ON, T_OFF = 112233445566881, 112233445566882
READ = "\n".join([
 'try {',
 '  float f = android.provider.Settings.System.getFloat(appContext.getContentResolver(), "font_scale", 1.0f);',
 '  return "" + Math.round(f * 100.0f);',
 '} catch (Throwable t) {',
 '  return "0";',
 '}',
])
def gv(n, t): return {"m_name": n, "m_type": t, "isLocalVar": True}
def setv(n, t, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, t)}; a.update(kw); return a
def lt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intLessThan": True, "m_intValue": v}
def gt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intGreaterThan": True, "m_intValue": v}
def trig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": False}
def iff(c): return {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": c}
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
ELSE = {"m_classType": "ElseAction", "m_SIGUID": 0}
NOTFG = {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": False, "m_foreground": True,
         "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0, "mechanismOption": 2}
def java(code, resp): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": code, "blockNextAction": True,
                              "responseVariableName": resp, "runInBackgroundThread": True}
acts = [
    iff([trig(T_ON, "App khuli")]),
      setv("cur", 2, m_newStringValue="0"), java(READ, "cur"),
      setv("c", 1, m_newIntValue=0), setv("c", 1, m_intExpression=True, m_expression="{lv=cur}"),
      iff([gt("c", 49), lt("c", BIG - 5)]), setv("was", 1, m_intExpression=True, m_expression="{lv=c}"), END,   # asal size yaad (bara ho chuka ho to nahi)
      iff([lt("was", 50)]), setv("was", 1, m_newIntValue=100), END,
      {"m_classType": "FontScaleAction", "m_SIGUID": 0, "scalePercent": BIG},
    ELSE,
      iff([NOTFG]),
        iff([lt("was", 50)]), setv("was", 1, m_newIntValue=100), END,
        {"m_classType": "FontScaleAction", "m_SIGUID": 0, "scalePercent": 100, "variable": fvar("was", 1, True, i=100)},
      END,
    END,
]
def trg(sig, on): return {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": sig, "m_launched": on,
                          "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0}
BG = {"macroExportVersion": 1, "macro": {
    "m_name": "🔎 Bari likhai",
    "m_description": "WhatsApp / Claude khule = likhai %d%% (bari). In se bahar = pehle jaisi. Baqi apps wahi. Koi paigham nahi. AI nahi." % BIG,
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "cur", "m_type": 2, "m_stringValue": "0", "isLocalVar": True}, {"m_name": "c", "m_type": 1, "m_intValue": 0, "isLocalVar": True},
                       {"m_name": "was", "m_type": 1, "m_intValue": 100, "isLocalVar": True}],
    "m_triggerList": [trg(T_ON, True), trg(T_OFF, False)],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(BG, open(os.path.join(D, 'big.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('big ok')
