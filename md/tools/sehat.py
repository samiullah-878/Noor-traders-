# 📸 Sehat lock (malik 19 Nov 2026: "fruit / nuts / coffee / paani na piyun to mobile access na kar paun — pehle 10 min, phir 30, phir 1 ghanta ·
#   cheez ki picture do, AI khud dekhe · LIVE camera, gallery nahi · paani har 40 min · coffee 2:00 · fruit 2:30 · nuts 4:00 · khana khatam ·
#   10 min mein photo warna block · awaaz nahi, sirf chhoti si bell · lock mein bhi photo do to khul jaye")
#
#   Teen macro:
#   1) 💧 Paani        — purana paani3.json (popup, qoul, screen time) hi; ab har 40 min (2400 s), sirf 11:00–23:59, popup par "📸 Photo do".
#   2) ☕ Coffee·Fruit·Nuts — purane '🍽 Khana-peena' ki jagah (WAHI GUID): 2:00 coffee · 2:30 fruit · 4:00 nuts. Khana + 5:30 hata. Bolna NAHI.
#   3) 📸 Sehat lock   — popup dikhte hi 10 min ka waqt (shDue). Photo nahi = SIRF raat wali list ki apps (raatband.PK: Settings, Play Store,
#      MacroDroid, Claude, social, YouTube, Netflix, games) band: 10 min → 30 min → 1 ghanta (phir har dafa 1 ghanta). WhatsApp, call, bank,
#      Chrome, camera, Blue Khata hamesha khuli (list ke bahar kuch band ho hi nahi sakta — raatband wala qaida, koi OR / LogicConstraint nahi).
#   Photo: popup / lock ka "📸 Photo do" = Blue Khata #sehat=<kind>.<shN> (sehat.js): sirf live camera → 🤖 Gemini (app ki AI) → sahi = app webhook
#   `nt_sehat?shOk=<shN>` → yahan shOk == shN = sab saaf (lock bhi foran khatam, ginti shuru se). `nt_sehat?shZ=1` = 🚨 10 min zaroori (din mein 1).
#   Bell = MacroDroid ki aam notification (chhoti si awaaz). Webhook link repo mein NAHI (app Falcon wale fxCfg.wh se banati hai).
import json, os, copy
from cb import expr, lt, gt, strne, trig, iff, END, ELSE, HOME, var, lvar, NOW, tod, pause, sstr, sint, inc
from raatband import PK, NM, FG
D = os.path.dirname(os.path.abspath(__file__))
APP = "https://samiullah-878.github.io/Noor-traders-/#sehat="
WIN = (11, 0, 23, 59)          # photo / lock ka waqt — raat 12 se 11 tak raatband pehle se band karta hai
GAP_PAANI = 2400               # 40 min
PHOTO_SEC = 600                # popup ke baad 10 min
LOCKS = (600, 1800, 3600)      # 10 → 30 → 60 min


def streq(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": local}, "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
def never(): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "never", "m_type": 0, "isLocalVar": True}, "m_booleanValue": True}
def rnd(n): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 1, "isLocalVar": False}, "m_intRandom": True, "m_intRandomMin": 100000, "m_intRandomMax": 999999}
def bell(title, text, silent=False):
    return {"m_classType": "NotificationAction", "m_SIGUID": 0, "m_notificationSubject": title, "m_notificationText": text, "m_overwriteExisting": True,
            "notificationIdString": "ntsh", "m_priority": 0 if silent else 1, "m_notificationChannelType": 1 if silent else 0}
def toast(t): return {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": t, "m_duration": 2, "m_position": 1, "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True}
def ft(text): return {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 0, "identifier": "ntsh", "textToDisplay": text,
    "bgColor": -15788246, "textColor": -1, "alpha": 92, "updateLocation": False, "xPosition": 0.5, "yPosition": 0.04, "padding": 8, "textSize": 16,
    "corners": 14, "alignment": 0, "moveOption": 0, "variableWidth": True, "widthPercentage": 90, "showOverStatusBar": False, "enableShadow": True}
FTHIDE = {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 1, "identifier": "ntsh"}
def patti(t): return [ft(t), pause(3), FTHIDE]
OPEN = {"m_classType": "OpenWebPageAction", "m_SIGUID": 0, "m_urlToOpen": APP + "{v=shK}.{v=shN}", "m_httpGet": False, "m_disableUrlEncode": True}
def dlg(title, text, yes, no, sec=120):
    return {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": title, "text": text, "positiveText": yes, "negativeText": no,
            "cancelAfterTimeout": True, "timeoutSeconds": sec, "htmlFormat": True, "useCustomColors": True, "textColor": -1, "bgColor": -15788246}

# reminder ka popup dikhte hi: 10 min ka waqt (pehle se chal raha ho to WAHI — naya reminder waqt nahi barhata), kis cheez ki photo, bell.
#   shAsk = abhi + 110: lock wala macro reminder ke popup (MacroDroid ki khirki) ko 130 s tak Home se nahi hatata.
def pending(kind, label):
    return [
        iff([lt("shDue", 1)]), expr("shDue", NOW + "+" + str(PHOTO_SEC)), rnd("shN"), END,
        sstr("shK", kind), expr("shAsk", NOW + "+110"),
        bell("📸 " + label + " — 10 min mein photo do", "Photo na di to phone ki apps band (10 → 30 → 60 min). Popup ka 📸 dabayein."),
    ]

# ---------------------------------------------------------------- 1) 💧 Paani (purana macro badla)
PA = json.load(open(os.path.join(D, 'paani3.json')))
_a = PA['macro']['m_actionList']
for x in _a:
    if x.get('m_expression') == '{system_time}+2100': x['m_expression'] = '{system_time}+' + str(GAP_PAANI)
_due = _a[11]; assert _due['m_classType'] == 'IfConditionAction' and _due['m_constraintList'][0]['m_variable']['m_name'] == 'pnLeft'
_due['m_constraintList'].append(tod(*WIN))                       # raat 12 – 11 yaad nahi (photo / lock ka waqt bhi yahi)
_d = next(i for i, x in enumerate(_a) if x.get('m_classType') == 'ElseIfConfirmedThenAction'); assert _a[_d - 1]['m_classType'] == 'IfConditionAction'
_dl = _a[_d]; _dl['positiveText'] = '📸 Photo do'; _dl['negativeText'] = '⏰ Baad mein'
_dl['text'] = _dl['text'].replace('{v=qoul}<br><br>', '{v=qoul}<br><br>📸 <b>10 min mein paani ke glass ki photo</b> — warna apps band.<br>')
_e = next(i for i in range(_d, len(_a)) if _a[i]['m_classType'] == 'ElseAction'); _end = next(i for i in range(_e, len(_a)) if _a[i]['m_classType'] == 'EndIfAction')
assert _a[_d + 1].get('m_intValueIncrement') and _a[_d + 1]['m_variable']['m_name'] == 'pnCount'
_yes = [OPEN, expr("pnDue", NOW + "+" + str(GAP_PAANI)), {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "pnSnz", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False}]
_no = [expr("pnDue", NOW + "+" + str(GAP_PAANI)), {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "pnSnz", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False},
       toast("⏳ 10 min mein photo — warna apps band")]
_a[_d - 1:_end] = pending("paani", "💧 Paani") + [_a[_d - 1], _dl] + _yes + [_a[_e]] + _no   # pnCount ab sirf sahi photo par (lock macro, webhook)
PA['macro']['m_description'] = "💧 Har 40 min paani (11 am – 12 raat). Popup ka 📸 = Blue Khata ka live camera + AI. 10 min mein photo nahi = 📸 Sehat lock. Glass ki ginti sirf sahi photo par."
PA['globalVariables'] += [var("shDue"), var("shN"), var("shK", 2), var("shAsk")]

# ---------------------------------------------------------------- 2) ☕ Coffee · 🍎 Fruit · 🥜 Nuts
K1, K2, K3, K4, K5 = 112233445566751, 112233445566752, 112233445566753, 112233445566754, 112233445566755
ITEMS = ((K1, 14, 0, "coffee", "☕ Coffee ka waqt", "Coffee pee lo — cup ki photo do."),
         (K2, 14, 30, "fruit", "🍎 Fruit ka waqt", "Fruit kha lo — fruit ki photo do."),
         (K3, 16, 0, "nuts", "🥜 Nuts ka waqt", "Badaam, akhrot, nuts kha lo — photo do."))
SHOWOK = [v for v in _due['m_constraintList'] if v['m_classType'] in ('ScreenOnOffConstraint', 'DeviceLockedConstraint', 'InCallConstraint', 'NotificationPresentConstraint')]
assert len(SHOWOK) == 4
ka = []
for k, h, mi, kind, t, msg in ITEMS:
    ka += [iff([trig(k, f"{h % 12 or 12}:{mi:02d} PM")]), sstr("kpK", kind), sstr("kpT", t), sstr("kpM", msg),
           {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "kpPend", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": True},
           expr("kpSetAt", NOW), END]
ka += [
    expr("kpAge", NOW + "-{v=kpSetAt}"),
    iff([{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "kpPend", "m_type": 0, "isLocalVar": False}, "m_booleanValue": True}, gt("kpAge", 10800)]),
      {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "kpPend", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False},   # 3 ghante purani yaad = chhor do
    END,
    iff([{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "kpPend", "m_type": 0, "isLocalVar": False}, "m_booleanValue": True}, strne("kpK", ""), tod(*WIN)] + copy.deepcopy(SHOWOK)),
      {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "kpPend", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False},
      *[x for x in pending("{v=kpK}", "{v=kpT}")],
      iff([never()]), dlg("{v=kpT}", "{v=kpM}<br><br>📸 <b>10 min mein photo</b> — warna apps band (10 → 30 → 60 min).", "📸 Photo do", "⏰ Baad mein"),
        OPEN,
      ELSE, toast("⏳ 10 min mein photo — warna apps band"), END,
    END,
]
KH = {"macroExportVersion": 1, "macro": {
    "m_name": "☕ Coffee · Fruit · Nuts",
    "m_description": "2:00 coffee · 2:30 fruit · 4:00 nuts — bell + popup '📸 Photo do' (Blue Khata live camera + AI). 10 min mein photo nahi = 📸 Sehat lock. Khana / 5:30 hata. Bolta nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("never", 0)],
    "m_triggerList": [{"m_classType": "TimerTrigger", "m_SIGUID": k, "m_hour": h, "m_minute": mi, "m_daysOfWeek": [True] * 7, "m_useAlarm": True} for k, h, mi, *_ in ITEMS]
                     + [{"m_classType": "RegularIntervalTrigger", "m_SIGUID": K4, "m_seconds": 60, "m_useAlarm": True},
                        {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": K5}],
    "m_actionList": ka, "m_constraintList": []},
    "globalVariables": [var("kpK", 2), var("kpT", 2), var("kpM", 2), var("kpPend", 0), var("kpSetAt"), var("kpAge"), var("shDue"), var("shN"), var("shK", 2), var("shAsk")],
    "userIcons": None}

# ---------------------------------------------------------------- 3) 📸 Sehat lock
T1, T2, T3 = 112233445566761, 112233445566762, 112233445566763
WH = {"m_classType": "WebHookTrigger", "m_SIGUID": T3, "identifier": "nt_sehat", "variableWhiteListEnabled": True, "variableWhiteList": ["shOk", "shZ"]}
OKDONE = [sint("shDue", 0), sint("shLock", 0), sint("shLv", 0), sint("shN", 0), FTHIDE,
          iff([streq("shK", "paani")]), inc("pnCount"), END,
          bell("✅ Shabash! Photo ho gayi", "Phone khula hai. Agli yaad par phir photo.", silent=True),
          *patti("✅ Shabash! Photo sahi — phone khul gaya")]
LOCKNOW = [
    iff([lt("shLv", 1)]), expr("shLock", NOW + "+" + str(LOCKS[0])), END,
    iff([gt("shLv", 0), lt("shLv", 2)]), expr("shLock", NOW + "+" + str(LOCKS[1])), END,
    iff([gt("shLv", 1)]), expr("shLock", NOW + "+" + str(LOCKS[2])), END,
    expr("shDue", "{v=shLock}+" + str(PHOTO_SEC)),                 # lock ke baad phir 10 min ka mauqa — phir bhi nahi = agla (lamba) lock
    iff([lt("shLv", 2)]), inc("shLv"), END,
    expr("lMin", "({v=shLock}-" + NOW + ")/60", True),
    bell("⛔ Apps band — {lv=lMin} min", "Photo nahi di. 📸 Photo do to abhi khul jayega (Blue Khata)."),
    *patti("⛔ Apps {lv=lMin} min band — 📸 photo do to khulega"),
]
ASK = [   # band app khuli: popup — "📸 Photo do" (camera + 🚨 zaroori wahi Blue Khata mein). Timeout / Theek hai = kuch nahi.
    expr("shAsk", NOW),
    iff([never()]), dlg("⛔ Sehat lock — {lv=lMin} min baqi", "{v=shK} ki photo nahi di.<br>📸 <b>Photo do</b> = abhi khul jayega.<br>🚨 Zaroori kaam ho to Blue Khata mein 10 min ka button.", "📸 Photo do", "Theek hai", 15),
      OPEN,
    ELSE, END,
]
la = [
    iff([trig(T3, "Webhook")]),
      iff([streq("shZ", "1")]), sstr("shZ", ""),
        iff([strne("shEmDay", "{dayofmonth}")]), expr("shEm", NOW + "+600"), sstr("shEmDay", "{dayofmonth}"), *patti("🚨 10 min sab khula — aaj ka zaroori"),
        ELSE, *patti("🚨 Aaj ka zaroori pehle ho chuka"), END,
      END,
      iff([gt("shN", 0), streq("shOk", "{v=shN}")]), sstr("shOk", ""), *OKDONE, END,
    ELSE,
      iff([tod(*WIN)]),
        expr("dAge", NOW + "-{v=shDue}", True),
        iff([gt("shDue", 0), gt("dAge", 10800, True)]), sint("shDue", 0), sint("shLock", 0), sint("shLv", 0), sint("shN", 0), END,   # raat / purani yaad = saaf
        expr("dAge", NOW + "-{v=shDue}", True), expr("lLeft", "{v=shLock}-" + NOW, True),
        iff([gt("shDue", 0), gt("dAge", -1, True), lt("lLeft", 1, True)]), *LOCKNOW, END,
        expr("lLeft", "{v=shLock}-" + NOW, True), expr("emL", "{v=shEm}-" + NOW, True),
        iff([gt("lLeft", 0, True), lt("emL", 1, True)]),
          pause(1),
          iff([FG]),
            expr("askAge", NOW + "-{v=shAsk}", True),
            iff([gt("askAge", 20, True)]),
              HOME, expr("lMin", "({v=shLock}-" + NOW + ")/60", True),
              iff([trig(T2, "App khuli")]), *ASK, ELSE, *patti("⛔ Apps band — 📸 photo do to khulega"), END,
            END,
          END,
        END,
      END,
    END,
]
SL = {"macroExportVersion": 1, "macro": {
    "m_name": "📸 Sehat lock",
    "m_description": "Paani / coffee / fruit / nuts ki photo 10 min mein nahi = SIRF raat wali list ki apps band 10 → 30 → 60 min (WhatsApp, call, bank, Chrome, Blue Khata khuli). Blue Khata mein sahi photo (AI) = foran khul jata hai. 🚨 din mein 1 dafa 10 min. 11 am – 12 raat.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("dAge"), lvar("lLeft"), lvar("emL"), lvar("askAge"), lvar("lMin"), lvar("never", 0)],
    "m_triggerList": [{"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 30, "m_useAlarm": False},
                      {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "isAllApps": False, "m_packageNameList": PK, "m_applicationNameList": NM},
                      WH],
    "m_actionList": la, "m_constraintList": []},
    "globalVariables": [var("shDue"), var("shN"), var("shK", 2), var("shAsk"), var("shLock"), var("shLv"), var("shOk", 2), var("shZ", 2), var("shEm"), var("shEmDay", 2), var("pnCount")],
    "userIcons": None}

if __name__ == '__main__':
    for nm, o in (('sehat_paani', PA), ('sehat_khana', KH), ('sehat_lock', SL)):
        json.dump(o, open(os.path.join(D, nm + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('sehat ok', len(PK))
