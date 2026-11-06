import json, os, copy
D = os.path.dirname(os.path.abspath(__file__))
old = json.load(open(os.path.join(D, 'paani_old.json')))['macro']['m_actionList']
HTTP = copy.deepcopy(old[10]); assert HTTP['m_classType'] == 'HttpRequestAction'
HTTP['m_SIGUID'] = 0; HTTP['requestConfig']['requestTimeOutSeconds'] = 6
RANDQ = copy.deepcopy(old[9]); assert RANDQ['m_intRandom']; RANDQ['m_SIGUID'] = 0

def gv(n, t, local=False): return {"m_name": n, "m_type": t, "isLocalVar": local}
def setv(n, t, local=False, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, t, local)}; a.update(kw); return a
def expr(n, e): return setv(n, 1, m_intExpression=True, m_expression=e)
def sint(n, v): return setv(n, 1, m_newIntValue=v)
def sstr(n, v): return setv(n, 2, m_newStringValue=v)
def sbool(n, v, local=False): return setv(n, 0, local, m_newBooleanValue=v)
def inc(n): return setv(n, 1, m_intValueIncrement=True)
def boolc(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, local), "m_booleanValue": v}
def lt1(n): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intLessThan": True, "m_intValue": 1}
def gt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intGreaterThan": True, "m_intValue": v}
def eq0(n): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intValue": 0}
def strne(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 2), "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": False}
def notTrig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": True}
def trig(s, n): return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": s, "m_triggerName": n, "m_not": False}
INCALL = {"m_classType": "InCallConstraint", "m_SIGUID": 0, "m_inCall": False}
WACALL = {"m_classType": "NotificationPresentConstraint", "m_SIGUID": 0, "enableRegex": True, "ignoreCase": True, "ignoreOngoing": False,
          "m_applicationNameList": ["WhatsApp", "WhatsApp Business"], "m_packageNameList": ["com.whatsapp", "com.whatsapp.w4b"],
          "m_exactMatch": False, "m_excludes": False, "m_excludesApps": 0, "m_option": 1, "m_textContent": "(?i)(ongoing|incoming).*call"}
SCREEN = {"m_classType": "ScreenOnOffConstraint", "m_SIGUID": 0, "m_screenOn": True}
UNLOCK = {"m_classType": "DeviceLockedConstraint", "m_SIGUID": 0, "m_locked": False}
def iff(c, orc=False, cls="IfConditionAction"):
    a = {"m_classType": cls, "m_SIGUID": 0, "m_constraintList": c}
    if orc: a["m_isOrCondition"] = True
    return a
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
ELSE = {"m_classType": "ElseAction", "m_SIGUID": 0}
def pause(s, alarm=True): return {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": s, "m_useAlarm": alarm}
def toast(m, long=False): return {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": m, "m_duration": 1 if long else 2, "m_position": 1,
                                  "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True}
def speak(t): return {"m_classType": "SpeakTextAction", "m_SIGUID": 0, "m_textToSay": t, "m_locale": "hi", "m_speed": 0.95,
                      "m_pitch": 1.0, "m_waitToFinish": False, "m_constraintList": [copy.deepcopy(INCALL), copy.deepcopy(WACALL)]}
def ask(title, text, pos):
    # If(kabhi sach nahi) -> ElseIfConfirmedThen = dialog; ✅ = andar, ⏰/timeout = Else
    return iff([boolc("never", True, True)]), {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": title, "text": text,
            "positiveText": pos, "negativeText": "⏰ Abhi nahi", "cancelAfterTimeout": True, "timeoutSeconds": 120,
            "htmlFormat": True, "useCustomColors": True, "textColor": -1, "bgColor": -15788246}
def var(n, t, **kw):
    v = {"m_name": n, "m_type": t, "isLocalVar": False, "m_booleanValue": False, "m_intValue": 0, "m_stringValue": ""}; v.update(kw); return v
def showOK(): return [SCREEN, UNLOCK, copy.deepcopy(INCALL), copy.deepcopy(WACALL)]

# ======================= 💧 PAANI =======================
P_TICK, P_UNL = 112233445566771, 112233445566772
pa = [
    iff([eq0("pnDue")]), expr("pnDue", "{system_time}+2100"), END,     # pehli dafa: ab se 35 min
    iff([notTrig(P_TICK, "Har 1 minute"), notTrig(P_UNL, "Unlock")]),   # 🧪 Test / khud chalaya = abhi popup
      expr("pnDue", "{system_time}"), sint("pnShowEnd", 0), sbool("breakOn", False), toast("🧪 Test — paani ka popup abhi"),
    END,
    expr("pnLeft", "{v=pnDue}-{system_time}"),
    expr("pnShowLeft", "{v=pnShowEnd}-{system_time}"),
    iff([lt1("pnLeft"), lt1("pnShowLeft"), boolc("breakOn", False)] + showOK()),
      expr("pnShowEnd", "{system_time}+130"),
      sbool("doBreak", False, True),
      iff([trig(P_TICK, "Har 1 minute"), boolc("pnSnz", False)]), sbool("doBreak", True, True), END,
      iff([strne("pnDay", "{dayofmonth}")]), sint("pnCount", 0), sstr("pnDay", "{dayofmonth}"), END,
      RANDQ, HTTP,
      # awaz band (malik 6 Nov: "es ki awaz band kar do")
      *ask("💧 Paani pee lo bhai", "{v=qoul}<br><br>Aaj ab tak: <b>{v=pnCount} glass</b><br>📱 TikTok reels aaj: <b>{v=tkMin} min</b> (limit {v=tkLim})", "✅ Pee liya"),
        inc("pnCount"),
        expr("pnDue", "{system_time}+2100"),
        sbool("pnSnz", False),
        toast("✅ Shabash! Aaj {v=pnCount} glass"),
      ELSE,
        expr("pnDue", "{system_time}+600"),
        sbool("pnSnz", True),
        toast("⏰ 10 minute baad dobara yaad"),
      END,
      sint("pnShowEnd", 0),
      iff([boolc("doBreak", True, True), copy.deepcopy(INCALL)]),
        toast("⏳ 30 second mein screen band — 1 minute aankhon ka break", True),
        pause(30),
        sbool("breakOn", True),
        {"m_classType": "ScreenOnAction", "m_SIGUID": 0, "m_pieLockScreen": False, "m_screenOff": True, "m_screenOffNoLock": False, "m_screenOnAlternative": False},
        pause(60),
        sbool("breakOn", False),
        toast("✅ Break khatam"),
      END,
    END,
]
paani = {"macroExportVersion": 1, "macro": {
    "m_name": "💧 Paani yaad",
    "m_description": "Har 35 min paani ka popup (✅ Pee liya / ⏰ Abhi nahi = 10 min baad dobara). Phone locked ho to unlock karte hi. Call par nahi. Phone chal raha ho to 30 sec baad 1 min break. Aaj ke glass ginti.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "doBreak", "m_type": 0, "m_booleanValue": False, "isLocalVar": True}, {"m_name": "never", "m_type": 0, "m_booleanValue": False, "isLocalVar": True}],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": P_TICK, "m_seconds": 60, "m_useAlarm": True},
        {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": P_UNL}],
    "m_actionList": pa, "m_constraintList": []},
    "globalVariables": [var("pnDue", 1), var("pnLeft", 1), var("pnShowEnd", 1), var("pnShowLeft", 1), var("pnCount", 1),
                        var("pnDay", 2), var("pnSnz", 0), var("breakOn", 0), var("q", 1), var("qoul", 2), var("tkMin", 1), var("tkLim", 1, m_intValue=30)],
    "userIcons": None, "aiFeedback": "Paani har 35 min, unlock par pending popup."}

# ======================= 🍽 KHANA-PEENA =======================
SLOTS = [(14, 0, '2:00 PM', '☕ Coffee ka waqt', 'Ab coffee pee lo bhai.', 'कॉफ़ी का टाइम हो गया'),
         (14, 10, '2:10 PM', '☕🍎 Coffee + Fruit', 'Coffee ke saath fruit bhi kha lo.', 'कॉफ़ी के साथ फ्रूट खा लो'),
         (16, 0, '4:00 PM', '🥜 Nuts ka waqt', 'Badaam, akhrot, nuts waghera kha lo.', 'नट्स खाने का टाइम हो गया'),
         (17, 30, '5:30 PM', '🍽 Khane ka waqt', 'Khana kha lo bhai.', 'खाना खा लो भाई')]
K_TICK, K_UNL = 112233445566781, 112233445566782
trg, ka = [], []
for i, (h, mi, lab, t, msg, sp) in enumerate(SLOTS):
    sig = 112233445566771 + i
    trg.append({"m_classType": "TimerTrigger", "m_SIGUID": sig, "m_hour": h, "m_minute": mi, "m_daysOfWeek": [True] * 7, "m_useAlarm": True})
    ka += [iff([trig(sig, lab)], cls="IfConditionAction" if i == 0 else "ElseIfConditionAction"),
           sstr("kpT", t), sstr("kpM", msg), sstr("kpS", sp), sstr("kpAt", lab)]
ka.append(END)
ka += [
    iff([notTrig(112233445566771 + i, SLOTS[i][2]) for i in range(4)] + [notTrig(K_TICK, "Har 1 minute"), notTrig(K_UNL, "Unlock")]),
      sstr("kpT", "☕ Test — coffee ka waqt"), sstr("kpM", "Yeh sirf test hai. Button daba kar dekhein."), sstr("kpS", "कॉफ़ी का टाइम हो गया"),
      sstr("kpAt", "Test"), sbool("kpPend", True), expr("kpDue", "{system_time}"), expr("kpSetAt", "{system_time}"), sint("kpShowEnd", 0),
      toast("🧪 Test — popup abhi"),
    END,
]
ka += [
    iff([trig(112233445566771, '2:00 PM'), trig(112233445566772, '2:10 PM'), trig(112233445566773, '4:00 PM'), trig(112233445566774, '5:30 PM')], orc=True),
      sbool("kpPend", True), expr("kpDue", "{system_time}"), expr("kpSetAt", "{system_time}"),
    END,
    expr("kpLeft", "{v=kpDue}-{system_time}"),
    expr("kpAge", "{system_time}-{v=kpSetAt}"),
    expr("kpShowLeft", "{v=kpShowEnd}-{system_time}"),
    iff([boolc("kpPend", True), gt("kpAge", 10800)]), sbool("kpPend", False), END,     # 3 ghante purani = khatam
    iff([boolc("kpPend", True), lt1("kpLeft"), lt1("kpShowLeft")] + showOK()),
      expr("kpShowEnd", "{system_time}+130"),
      speak("{v=kpS}"),
      *ask("{v=kpT}", "{v=kpM}<br><br>🕒 {v=kpAt}", "✅ Ho gaya"),
        sbool("kpPend", False),
        toast("✅ Shabash!"),
      ELSE,
        expr("kpDue", "{system_time}+600"),
        toast("⏰ 10 minute baad dobara yaad"),
      END,
      sint("kpShowEnd", 0),
    END,
]
trg += [{"m_classType": "RegularIntervalTrigger", "m_SIGUID": K_TICK, "m_seconds": 60, "m_useAlarm": True},
        {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": K_UNL}]
khana = {"macroExportVersion": 1, "macro": {
    "m_name": "🍽 Khana-peena yaad",
    "m_description": "Roz 2:00 Coffee, 2:10 Coffee + Fruit, 4:00 Nuts, 5:30 Khana — popup (✅ Ho gaya / ⏰ Abhi nahi = 10 min baad). Locked ho to unlock karte hi. Call par nahi. 3 ghante baad purani yaad khatam.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "never", "m_type": 0, "m_booleanValue": False, "isLocalVar": True}],
    "m_triggerList": trg, "m_actionList": ka, "m_constraintList": []},
    "globalVariables": [var("kpT", 2), var("kpM", 2), var("kpS", 2), var("kpAt", 2), var("kpPend", 0), var("kpDue", 1),
                        var("kpSetAt", 1), var("kpLeft", 1), var("kpAge", 1), var("kpShowEnd", 1), var("kpShowLeft", 1)],
    "userIcons": None, "aiFeedback": "4 waqt + pending popup on unlock."}

for name, d in (("paani3", paani), ("khana2", khana)):
    s = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(D, name + ".json"), "w").write(s)
    acts = d['macro']['m_actionList']; dep = 0
    for a in acts:
        c = a['m_classType']
        if c == 'IfConditionAction': dep += 1
        if c == 'EndIfAction': dep -= 1
        assert dep >= 0
    print(name, len(s), 'depth', dep, 'actions', len(acts))
