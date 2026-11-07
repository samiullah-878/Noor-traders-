# 📵 App limits (malik 7 Nov 2026): TikTok reels 25 min (Saved/Profile 2 ghante) · Facebook 25 min · YouTube 2 ghante.
# Reset raat 12 NAHI — limit jis waqt poori ho, agle din USI waqt (24 ghante) dobara khulti hai (xxLock = epoch).
# + 🔖 TikTok Saved: home-screen shortcut → TikTok seedha Profile → Saved par (reels shuru hi na hon).
import json, os
D = os.path.dirname(os.path.abspath(__file__))
TK = ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"]; TKN = ["TikTok", "TikTok Lite"]
FB = ["com.facebook.katana", "com.facebook.lite"]; FBN = ["Facebook", "Facebook Lite"]
YT = ["com.google.android.youtube"]; YTN = ["YouTube"]
DAY = 86400
def gv(n, t, local=False): return {"m_name": n, "m_type": t, "isLocalVar": local}
def setv(n, t, local=False, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, t, local)}; a.update(kw); return a
def inc(n): return setv(n, 1, m_intValueIncrement=True)
def sint(n, v): return setv(n, 1, m_newIntValue=v)
def expr(n, e, local=False): return setv(n, 1, local, m_intExpression=True, m_expression=e)
def boolc(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, local), "m_booleanValue": v}
def lt(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, local), "m_intLessThan": True, "m_intValue": v}
def gt(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, local), "m_intGreaterThan": True, "m_intValue": v}
def trig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": False}
def fg(pk, nm): return {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": True, "m_foreground": True, "m_packageNameList": pk, "m_applicationNameList": nm, "usePackageNameOption": 0, "mechanismOption": 2}
SCR = {"m_classType": "ScreenOnOffConstraint", "m_SIGUID": 0, "m_screenOn": True}
def iff(c, orc=False):
    a = {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": c}
    if orc: a["m_isOrCondition"] = True
    return a
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
ELSE = {"m_classType": "ElseAction", "m_SIGUID": 0}
HOME = {"m_classType": "LaunchHomeScreenAction", "m_SIGUID": 0, "useAccessibilityService": True}
def pause(s): return {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": s, "m_useAlarm": False}
def toast(m): return {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": m, "m_duration": 1, "m_position": 1, "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True}
def click(text, opt=1): return {"action": 0, "uiInteractionConfiguration": {"blocking": True, "checkOverlays": False, "clickOption": 1, "longClick": False, "skipCount": "0", "textContent": text, "textMatchOption": opt, "useRegex": False, "viewId": "", "xyPercentages": True, "xyPoint": {"x": 0, "y": 0}, "type": "Click"}, "m_SIGUID": 0, "m_classType": "UIInteractionAction"}
def var(n, t=1, **kw):
    v = {"m_name": n, "m_type": t, "isLocalVar": False, "m_intValue": 0, "m_stringValue": "", "m_booleanValue": False}; v.update(kw); return v
def lvar(n, t=1): return {"m_name": n, "m_type": t, "isLocalVar": True, "m_intValue": 0, "m_booleanValue": False}

# --- ek app ka hisaab: p = prefix (fb/yt), lim = minute ---
def unlock(p):      # lock ka waqt guzar gaya = lock khatam + minute 0
    return [expr(p + "Rem", "{v=%sLock}-{system_time}" % p, True),
            iff([gt(p + "Lock", 0), lt(p + "Rem", 1, True)]), sint(p + "Lock", 0), sint(p + "Min", 0), END]
def count(p, pk, nm, tick):
    return [iff([trig(tick, "Har 1 minute"), SCR, fg(pk, nm)]), inc(p + "Min"), END]
def lock(p, lim):
    return [iff([gt(p + "Min", lim - 1), lt(p + "Lock", 1)]), expr(p + "Lock", "{system_time}+%d" % DAY), END]
def hrs(p): return expr(p + "Hrs", "({v=%sLock}-{system_time}+1800)/3600" % p)

# ================= 📘▶️ Facebook · YouTube =================
T1, T2 = 112233445566771, 112233445566772
fy = []
fy += unlock("fb") + unlock("yt")
fy += count("fb", FB, FBN, T1) + count("yt", YT, YTN, T1)
fy += lock("fb", 25) + lock("yt", 120)
fy += [iff([gt("fbLock", 0), fg(FB, FBN)]), hrs("fb"), HOME, toast("📘 Facebook ke 25 min ho gaye — {v=fbHrs} ghante baad (kal isi waqt)"), END]
fy += [iff([gt("ytLock", 0), fg(YT, YTN)]), hrs("yt"), HOME, toast("▶️ YouTube ke 2 ghante ho gaye — {v=ytHrs} ghante baad (kal isi waqt)"), END]
fbyt = {"macroExportVersion": 1, "macro": {
    "m_name": "📘▶️ Facebook · YouTube",
    "m_description": "Facebook 25 min / YouTube 2 ghante (screen on + app saamne, har 1 min). Poore hone par Home + paigham; agle din USI waqt dobara (24 ghante ka lock). Raat 12 reset nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("fbRem"), lvar("ytRem")],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "m_packageNameList": FB + YT, "m_applicationNameList": FBN + YTN, "usePackageNameOption": 0}],
    "m_actionList": fy, "m_constraintList": []},
    "globalVariables": [var("fbMin"), var("fbLock"), var("fbHrs"), var("ytMin"), var("ytLock"), var("ytHrs")],
    "userIcons": None, "aiFeedback": "Usage access zaroori."}

# ================= 📵 TikTok reels (v2) =================
T_TICK, T_FEED = 112233445566771, 112233445566772
CHECK = {"m_classType": "CheckTextOnScreenAction", "m_SIGUID": 0, "textToCheck": "For You", "booleanVariableName": "feed", "matchOption": 0, "ignoreCase": True, "ignoreHiddenText": True, "forceScreenRefresh": True}
tk = []
tk += unlock("tk") + unlock("ta")          # tk = reels (25 min) · ta = poora TikTok (2 ghante)
tk += [iff([trig(T_TICK, "Har 1 minute"), SCR, fg(TK, TKN)]),
         inc("taMin"),
         CHECK,
         iff([boolc("feed", True, True)]), inc("tkMin"), END,
       END]
tk += lock("tk", 25) + lock("ta", 120)
tk += [setv("tkLeft", 1, m_intExpression=True, m_expression="25-{v=tkMin}")]
tk += [iff([gt("taLock", 0), fg(TK, TKN)]),
         hrs("ta"), HOME, toast("📵 TikTok ke 2 ghante ho gaye — {v=taHrs} ghante baad (kal isi waqt)"),
       ELSE,
         iff([trig(T_FEED, "For You dikha"), boolc("feed", True, True)], orc=True),
           iff([gt("tkLock", 0)]),
             sint("tkOver", 1), hrs("tk"),
             toast("📵 Reels ke 25 min ho gaye — {v=tkHrs} ghante baad · Profile / Saved khule hain"),
             click("Profile"),
           END,
         END,
       END]
tiktok = {"macroExportVersion": 1, "macro": {
    "m_name": "📵 TikTok reels",
    "m_description": "Reels (For You screen) 25 min → reels par aate hi Profile par (Saved / Profile / Inbox khule). Poora TikTok 2 ghante → Home. Dono ka lock 24 ghante (agle din usi waqt). Following feed bhi reels mein ginti hai (upar For You likha hota hai).",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [{"m_name": "feed", "m_type": 0, "m_booleanValue": False, "isLocalVar": True}, lvar("tkRem"), lvar("taRem")],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T_TICK, "m_seconds": 60, "m_useAlarm": False},
        {"m_classType": "ScreenContentTrigger", "m_SIGUID": T_FEED, "textToMatch": "For You", "ignoreCase": True, "enableRegex": False, "packageNameList": TK, "appNameList": TKN, "matchOption": 0}],
    "m_actionList": tk, "m_constraintList": []},
    "globalVariables": [var("tkMin"), var("tkLock"), var("tkHrs"), var("tkOver"), var("tkLeft"), var("taMin"), var("taLock"), var("taHrs")],
    "userIcons": None, "aiFeedback": "Accessibility zaroori."}

# ================= 🔖 TikTok Saved (shortcut) =================
sv = [{"m_classType": "LaunchActivityAction", "m_SIGUID": 0, "option": 1, "m_packageToLaunch": TK[0], "m_applicationName": "TikTok", "m_startNew": False, "m_excludeFromRecents": False},
      pause(4), click("Profile"), pause(3), click("Favorites", 0), toast("🔖 Saved")]
saved = {"macroExportVersion": 1, "macro": {
    "m_name": "🔖 TikTok Saved",
    "m_description": "Home screen ka shortcut (MacroDroid Shortcut widget → yeh macro): TikTok kholo → Profile → Saved tab. Reels shuru hi nahi hote.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "m_triggerList": [{"m_classType": "ShortcutTrigger", "m_SIGUID": 112233445566771}],
    "m_actionList": sv, "m_constraintList": []},
    "globalVariables": [], "userIcons": None, "aiFeedback": "Accessibility (UI Interaction) zaroori."}

for nm, o in [("fbyt.json", fbyt), ("tiktok.json", tiktok), ("saved.json", saved)]:
    json.dump(o, open(os.path.join(D, nm), "w"), ensure_ascii=False, separators=(",", ":"))
    print(nm, len(o["macro"]["m_actionList"]))
