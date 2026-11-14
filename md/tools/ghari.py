# ⏰ Ghari auto (malik 14 Nov 2026: "mera mobile par time auto hona chahiye taake koi bhi time change kar ke apps na khol sake").
#   Wajah: ⛔ Subah 11 tak / ⏸ Claude break / TikTok hadein phone ki ghari par chalti hain aur Settings khuli hai — ghari aage kar ke sab khul jata tha.
#   1) "Set time automatically" (Global auto_time) + "time zone automatically" (auto_time_zone) HAMESHA 1:
#      setting badalte hi (SystemSettingTrigger) + har 1 min (hifazat) Java dekhta hai — 0 ho to wapas 1 (network se ghari khud theek) aur, agar abhi kisi ne band kiya tha, Home.
#   2) Settings ka "Date & time" safha khulte hi Back (activity ka naam DateTimeSettings · ya safhe par "24-hour" / "time automatically" / "zone automatically" likha ho — sirf Settings app mein).
#      Lafz OnePlus par na milein to bhi (1) kaafi hai — toggle band karte hi wapas ON + Home.
#   Koi paigham / toast NAHI (malik ko baar baar ka paigham pasand nahi). Nayi ijazat nahi (🏦 Bank mode pehle se Settings.Global likhta hai). AI nahi.
#   Yeh MacroDroid ko band karne se nahi rokta (alag kaam — malik ke kehne par).
import json, os
D = os.path.dirname(os.path.abspath(__file__))
T_SET, T_MIN, T_ACT, T_S1, T_S2, T_S3 = 112233445567101, 112233445567102, 112233445567103, 112233445567104, 112233445567105, 112233445567106
SETTINGS = ["com.android.settings"]; SNM = ["Settings"]
FIX = "\n".join([
    'import android.provider.Settings;',
    'String r = "0";',
    'try {',
    '  cr = appContext.getContentResolver();',
    '  a = Settings.Global.getString(cr, "auto_time");',
    '  z = Settings.Global.getString(cr, "auto_time_zone");',
    '  if (a == null || !a.equals("1")) { Settings.Global.putString(cr, "auto_time", "1"); r = "1"; }',
    '  if (z == null || !z.equals("1")) { Settings.Global.putString(cr, "auto_time_zone", "1"); r = "1"; }',
    '} catch (Throwable t) {',
    '  r = "0";',
    '}',
    'return r;',
])
def gv(n, t): return {"m_name": n, "m_type": t, "isLocalVar": True}
def setv(n, t, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, t)}; a.update(kw); return a
def gt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intGreaterThan": True, "m_intValue": v}
def trig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": False}
def anyof(*c): return {"m_classType": "LogicConstraint", "m_SIGUID": 0, "m_isOrCondition": True, "m_constraintList": list(c)}
def iff(c): return {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": c}
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
def java(code, resp): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": code, "blockNextAction": True,
                              "responseVariableName": resp, "runInBackgroundThread": True}
def scr(sig, txt): return {"m_classType": "ScreenContentTrigger", "m_SIGUID": sig, "textToMatch": txt, "ignoreCase": True, "enableRegex": False,
                           "matchOption": 0, "packageNameList": SETTINGS, "appNameList": SNM}
acts = [
    # 1) auto time + auto time zone wapas ON (har trigger par — sasta, sirf 2 setting parhna)
    setv("fx", 2, m_newStringValue="0"), java(FIX, "fx"),
    setv("n", 1, m_newIntValue=0), setv("n", 1, m_intExpression=True, m_expression="{lv=fx}"),
    # v40 (14 Nov, malik: "mobile baar baar back ho jata hai"): Date & time safhe par Back HATA — trigger-wali shart phone par har 1 min sach nikalti lagti thi.
    # kisi ne abhi auto band kiya tha (setting badli + humein theek karna para) = us safhe se bahar
    iff([trig(T_SET, "auto time badla"), gt("n", 0)]),
      {"m_classType": "LaunchHomeScreenAction", "m_SIGUID": 0, "useAccessibilityService": True},
    END,
]
GH = {"macroExportVersion": 1, "macro": {
    "m_name": "⏰ Ghari auto",
    "m_description": "Phone ki ghari hamesha AUTO (time + time zone). Koi band kare to foran wapas ON. Koi paigham nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "fx", "m_type": 2, "m_stringValue": "0", "isLocalVar": True}, {"m_name": "n", "m_type": 1, "m_intValue": 0, "isLocalVar": True}],
    "m_triggerList": [
        {"m_classType": "SystemSettingTrigger", "m_SIGUID": T_SET, "systemEnabled": False, "globalEnabled": True, "secureEnabled": False,
         "regexEnabled": True, "settingPattern": "auto_time.*"},
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T_MIN, "m_seconds": 60, "m_useAlarm": False}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(GH, open(os.path.join(D, 'ghari.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('ghari ok')
