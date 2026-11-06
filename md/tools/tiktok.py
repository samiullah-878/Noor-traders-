# 📵 TikTok reels ka waqt — sirf "For You" (reels) screen ginti; 30 min ke baad reels par aate hi Profile tab par bhej do
import json, os
D = os.path.dirname(os.path.abspath(__file__))
PK = ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"]; NM = ["TikTok", "TikTok Lite"]
T_TICK, T_FEED = 112233445566771, 112233445566772
def gv(n, t, local=False): return {"m_name": n, "m_type": t, "isLocalVar": local}
def setv(n, t, local=False, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, t, local)}; a.update(kw); return a
def inc(n): return setv(n, 1, m_intValueIncrement=True)
def sint(n, v): return setv(n, 1, m_newIntValue=v)
def sstr(n, v): return setv(n, 2, m_newStringValue=v)
def boolc(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, local), "m_booleanValue": v}
def strne(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 2), "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": False}
def gte(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intLessThan": True, "m_intValue": v, "m_intNotEqual": False}
def trig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": False}
TT = {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": True, "m_foreground": True, "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0, "mechanismOption": 2}
SCR = {"m_classType": "ScreenOnOffConstraint", "m_SIGUID": 0, "m_screenOn": True}
def iff(c, orc=False):
    a = {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": c}
    if orc: a["m_isOrCondition"] = True
    return a
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
def toast(m): return {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": m, "m_duration": 1, "m_position": 1, "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True}
CHECK = {"m_classType": "CheckTextOnScreenAction", "m_SIGUID": 0, "textToCheck": "For You", "booleanVariableName": "feed", "matchOption": 0, "ignoreCase": True, "ignoreHiddenText": True, "forceScreenRefresh": True}
PROFILE = {"action": 0, "uiInteractionConfiguration": {"blocking": True, "checkOverlays": False, "clickOption": 1, "longClick": False, "skipCount": "0", "textContent": "Profile", "textMatchOption": 1, "useRegex": False, "viewId": "", "xyPercentages": True, "xyPoint": {"x": 0, "y": 0}, "type": "Click"}, "m_SIGUID": 0, "m_classType": "UIInteractionAction"}
# limit hone par: "jo nahi hona" = reels band → Profile tab par click; na mile to Back
BLOCK = [
    sint("tkOver", 1),
    toast("📵 Reels band — aaj {v=tkMin} min ho gaye (limit {v=tkLim}) · Profile / Saved khule hain"),
    PROFILE,
]
acts = [
    iff([strne("tkDay", "{dayofmonth}")]), sint("tkMin", 0), sstr("tkDay", "{dayofmonth}"), END,
    iff([trig(T_TICK, "Har 1 minute"), SCR, TT]),
      CHECK,
      iff([boolc("feed", True, True)]),
        inc("tkMin"),
      END,
    END,
    # reels screen par (ya minute ki ginti ke baad) limit poori → Profile par
    setv("tkLeft", 1, m_intExpression=True, m_expression="{v=tkLim}-{v=tkMin}"),
    iff([trig(T_FEED, "For You dikha"), boolc("feed", True, True)], orc=True),
      iff([{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv("tkLeft", 1), "m_intLessThan": True, "m_intValue": 1}]),
        *BLOCK,
      END,
    END,
]
out = {"macroExportVersion": 1, "macro": {
    "m_name": "📵 TikTok reels",
    "m_description": "Sirf TikTok ki reels (For You) screen ka waqt ginta hai (har 1 min). tkLim (30) minute poore → reels par aate hi Profile tab par bhej deta (Profile / Saved / Drafts / Inbox khule). Raat 12 reset. Paani popup mein 'Aaj TikTok N min'.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [{"m_name": "feed", "m_type": 0, "m_booleanValue": False, "isLocalVar": True}],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T_TICK, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ScreenContentTrigger", "m_SIGUID": T_FEED, "textToMatch": "For You", "ignoreCase": True, "enableRegex": False,
         "packageNameList": PK, "appNameList": NM, "matchOption": 0}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [
        {"m_name": "tkMin", "m_type": 1, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False},
        {"m_name": "tkLim", "m_type": 1, "isLocalVar": False, "m_intValue": 30, "m_stringValue": "", "m_booleanValue": False},
        {"m_name": "tkOver", "m_type": 1, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False},
        {"m_name": "tkLeft", "m_type": 1, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False},
        {"m_name": "tkDay", "m_type": 2, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False}],
    "userIcons": None, "aiFeedback": "Accessibility zaroori."}
json.dump(out, open(os.path.join(D, "tiktok.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok")
