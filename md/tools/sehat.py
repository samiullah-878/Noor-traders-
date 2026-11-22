# 📸 Sehat lock (malik 19 Nov 2026: "fruit / nuts / coffee / paani na piyun to mobile access na kar paun — pehle 10 min, phir 30, phir 1 ghanta ·
#   cheez ki picture do, AI khud dekhe · LIVE camera, gallery nahi · paani har 40 min · coffee 2:00 · fruit 2:30 · nuts 4:00 · khana khatam ·
#   10 min mein photo warna block · awaaz nahi, sirf chhoti si bell · lock mein bhi photo do to khul jaye")
#
#   Teen macro:
#   1) 💧 Paani        — purana paani3.json (popup, qoul, screen time) hi; ab har 40 min (2400 s), sirf 11:00–23:59, popup par "📸 Photo do".
#      v61 (20 Nov): paani sirf 9:00–20:59 (PWIN); lock / photo ka waqt 11:00–20:59 (raat 9 ke baad kuch nahi). 🌱 sabzi photo (app) = shOk c:sabzi -> clOk + clEm = sirf Claude 30 min.
#   2) ☕ Coffee·Fruit·Nuts — purane '🍽 Khana-peena' ki jagah (WAHI GUID): 2:00 coffee · 2:30 fruit · 4:00 nuts. Khana + 5:30 hata. Bolna NAHI.
#   3) 📸 Sehat lock   — popup dikhte hi 10 min ka waqt (shDue). Photo nahi = SIRF raat wali list ki apps (raatband.PK: Settings, Play Store,
#      MacroDroid, Claude, social, YouTube, Netflix, games) band: 10 min → 30 min → 1 ghanta (phir har dafa 1 ghanta). WhatsApp, call, bank,
#      Chrome, camera, Blue Khata hamesha khuli (list ke bahar kuch band ho hi nahi sakta — raatband wala qaida, koi OR / LogicConstraint nahi).
#   Photo: popup / lock ka "📸 Photo do" = Blue Khata #sehat=<kind>.<shN> (sehat.js): sirf live camera → 🤖 Gemini (app ki AI) → sahi = app webhook
#   `nt_sehat?shOk=<shN>` → yahan shOk == shN = sab saaf (lock bhi foran khatam, ginti shuru se). `nt_sehat?shZ=1` = 🚨 10 min zaroori (din mein 1).
#   Bell = MacroDroid ki aam notification (chhoti si awaaz). Webhook link repo mein NAHI (app Falcon wale fxCfg.wh se banati hai).
import json, os, copy
from cb import expr, lt, gt, strne, trig, iff, END, ELSE, HOME, var, lvar, NOW, tod, pause, sstr, sint, inc
from raatband import PK, NM, FG, clx
D = os.path.dirname(os.path.abspath(__file__))
APP = "https://samiullah-878.github.io/Noor-traders-/#sehat="
WIN = (11, 0, 20, 59)          # photo / lock ka waqt — raat 12 se 11 tak raatband pehle se band karta hai · v61: raat 9 ke baad kuch nahi
PWIN = (9, 0, 20, 59)          # v61 (20 Nov, malik: 'raat 9 ke baad subah 9 tak paani ka notification na de, na zaroorat'): paani ki yaad sirf 9 am – 9 pm
CL_SEC = 1800                  # v61 (malik: '30 minute tak'): 🌱 sabzi ki sahi photo = Claude 30 min (baqi apps pehle jaisi band)
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
# v57 (19 Nov, malik: "Chrome mein khulta hai, installed app mein nahi — do tab ka paigham aata hai"): pehle installed Blue Khata (Chrome ki WebAPK —
#   wohi link jo app khud kholti hai, package naam mein "webapk"), na mile tab hi purana OpenWebPage (Chrome). Jawab global shOp (app / web).
OPENJ = "\n".join([
 "try {",
 "  String u = \"" + APP + "\" + magicText.evaluateString(\"{\" + \"v=shK}\").trim() + \".\" + magicText.evaluateString(\"{\" + \"v=shN}\").trim();",
 "  android.content.Intent i = new android.content.Intent(\"android.intent.action.VIEW\", android.net.Uri.parse(u));",
 "  java.util.List l = appContext.getPackageManager().queryIntentActivities(i, 131072);",
 "  for (int j = 0; j < l.size(); j++) {",
 "    android.content.pm.ResolveInfo r = (android.content.pm.ResolveInfo) l.get(j);",
 "    String p = r.activityInfo.packageName;",
 "    if (p != null && p.indexOf(\"webapk\") >= 0) { i.setClassName(p, r.activityInfo.name); i.addFlags(268435456 | 536870912); appContext.startActivity(i); return \"app\"; }",
 "  }",
 "  return \"web\";",
 "} catch (Throwable t) { return \"web\"; }"])
OPEN = [{"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": OPENJ, "blockNextAction": True, "responseVariableName": "shOp", "runInBackgroundThread": False},
        {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": [{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "shOp", "m_type": 2, "isLocalVar": False}, "m_stringValue": "app", "m_stringComparisonType": 0, "m_stringEqual": False}]},
        {"m_classType": "OpenWebPageAction", "m_SIGUID": 0, "m_urlToOpen": APP + "{v=shK}.{v=shN}", "m_httpGet": False, "m_disableUrlEncode": True},
        END]
LOOP = lambda n: {"m_classType": "LoopAction", "m_SIGUID": 0, "m_option": 0, "m_fixedOptionCount": n}
ENDLOOP = {"m_classType": "EndLoopAction", "m_SIGUID": 0}
BREAK = {"m_classType": "BreakFromLoopAction", "m_SIGUID": 0}
def iffor(c): return {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_isOrCondition": True, "m_constraintList": c}   # IfCondition ka apna OR (LogicConstraint nahi — v52 ghalti)
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
_due['m_constraintList'].append(tod(*PWIN))                      # v61: sirf 9 am – 9 pm (raat 9 ke baad paani ki yaad / photo nahi)
_d = next(i for i, x in enumerate(_a) if x.get('m_classType') == 'ElseIfConfirmedThenAction'); assert _a[_d - 1]['m_classType'] == 'IfConditionAction'
_dl = _a[_d]; _dl['positiveText'] = '📸 Photo do'; _dl['negativeText'] = '⏰ Baad mein'
_dl['text'] = _dl['text'].replace('{v=qoul}<br><br>', '{v=qoul}<br><br>📸 <b>10 min mein paani ke glass ki photo</b> — warna apps band.<br>')
_e = next(i for i in range(_d, len(_a)) if _a[i]['m_classType'] == 'ElseAction'); _end = next(i for i in range(_e, len(_a)) if _a[i]['m_classType'] == 'EndIfAction')
assert _a[_d + 1].get('m_intValueIncrement') and _a[_d + 1]['m_variable']['m_name'] == 'pnCount'
_yes = [*OPEN, expr("pnDue", NOW + "+" + str(GAP_PAANI)), {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "pnSnz", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False}]
_no = [expr("pnDue", NOW + "+" + str(GAP_PAANI)), {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "pnSnz", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False},
       toast("⏳ 10 min mein photo — warna apps band")]
_a[_d - 1:_end] = pending("paani", "💧 Paani") + [_a[_d - 1], _dl] + _yes + [_a[_e]] + _no   # pnCount ab sirf sahi photo par (lock macro, webhook)
PA['macro']['m_description'] = "💧 Har 40 min paani (9 am – 9 pm). Popup ka 📸 = Blue Khata ka live camera + AI. 10 min mein photo nahi = 📸 Sehat lock. Glass ki ginti sirf sahi photo par."
PA['globalVariables'] += [var("shDue"), var("shN"), var("shK", 2), var("shAsk"), var("shOp", 2)]

# ---------------------------------------------------------------- 2) ☕ Coffee · 🍎 Fruit · 🥜 Nuts
K1, K2, K3, K4, K5 = 112233445566751, 112233445566752, 112233445566753, 112233445566754, 112233445566755
ITEMS = ((K1, 14, 0, "coffee", "☕ Coffee ka waqt", "Coffee pee lo — cup ki photo do."),
         (K2, 14, 30, "fruit", "🍎 Fruit ka waqt", "Fruit kha lo — fruit ki photo do."),
         (K3, 16, 0, "nuts", "🥜 Nuts ka waqt", "Badaam, akhrot, nuts kha lo — photo do."))
SHOWOK = [v for v in _due['m_constraintList'] if v['m_classType'] in ('ScreenOnOffConstraint', 'DeviceLockedConstraint', 'InCallConstraint', 'NotificationPresentConstraint')]
assert len(SHOWOK) == 4
# v58 (19 Nov, malik: 'app mein bhi screen — wahan bhi photo lag sake'): app ki 📸 Sehat photo screen se aaj pehle hi photo di = kd<kind> = aaj ka din
#   (Pakistan din = (system_time+18000)/86400) -> us din us cheez ka reminder nahi.
ka = [expr("dNum", "(" + NOW + "+18000)/86400", True)] + [expr("ag" + kd, "{lv=dNum}-{v=kd" + kd + "}", True) for kd in ("coffee", "fruit", "nuts")]
for k, h, mi, kind, t, msg in ITEMS:
    ka += [iff([trig(k, f"{h % 12 or 12}:{mi:02d} PM"), gt("ag" + kind, 0, True)]), sstr("kpK", kind), sstr("kpT", t), sstr("kpM", msg),
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
        *OPEN,
      ELSE, toast("⏳ 10 min mein photo — warna apps band"), END,
    END,
]
KH = {"macroExportVersion": 1, "macro": {
    "m_name": "☕ Coffee · Fruit · Nuts",
    "m_description": "2:00 coffee · 2:30 fruit · 4:00 nuts — bell + popup '📸 Photo do' (Blue Khata live camera + AI). 10 min mein photo nahi = 📸 Sehat lock. Khana / 5:30 hata. Bolta nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("never", 0), lvar("dNum"), lvar("agcoffee"), lvar("agfruit"), lvar("agnuts")],
    "m_triggerList": [{"m_classType": "TimerTrigger", "m_SIGUID": k, "m_hour": h, "m_minute": mi, "m_daysOfWeek": [True] * 7, "m_useAlarm": True} for k, h, mi, *_ in ITEMS]
                     + [{"m_classType": "RegularIntervalTrigger", "m_SIGUID": K4, "m_seconds": 60, "m_useAlarm": True},
                        {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": K5}],
    "m_actionList": ka, "m_constraintList": []},
    "globalVariables": [var("kpK", 2), var("kpT", 2), var("kpM", 2), var("kpPend", 0), var("kpSetAt"), var("kpAge"), var("shDue"), var("shN"), var("shK", 2), var("shAsk"), var("shOp", 2), var("kdcoffee"), var("kdfruit"), var("kdnuts")],
    "userIcons": None}

# ---------------------------------------------------------------- 3) 📸 Sehat lock
T1, T2, T3, T4 = 112233445566761, 112233445566762, 112233445566763, 112233445566764
WH = {"m_classType": "WebHookTrigger", "m_SIGUID": T3, "identifier": "nt_sehat", "variableWhiteListEnabled": True, "variableWhiteList": ["shOk", "shZ", "shT"]}
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
    sint("shLkA", 1),                                              # v57: lock lagte hi photo ka sawal (abhi ya agli dafa phone kholte hi)
    expr("lMin", "({v=shLock}-" + NOW + ")/60", True),
    bell("⛔ Apps band — {lv=lMin} min", "Photo nahi di. 📸 Photo do to abhi khul jayega (Blue Khata)."),
    *patti("⛔ Apps {lv=lMin} min band — 📸 photo do to khulega"),
]
ASK = [   # band app khuli: popup — "📸 Photo do" (camera + 🚨 zaroori wahi Blue Khata mein). Timeout / Theek hai = kuch nahi.
    expr("shAsk", NOW), sint("shLkA", 0),
    iff([never()]), dlg("⛔ Sehat lock — {lv=lMin} min baqi", "{v=shK} ki photo nahi di.<br>📸 <b>Photo do</b> = abhi khul jayega.<br>🚨 Zaroori kaam ho to Blue Khata mein 10 min ka button.", "📸 Photo do", "Theek hai", 15),
      *OPEN,
    ELSE, END,
    expr("shAsk", NOW + "-18"),   # v58: popup band hote hi sirf 2 s ki chhoot (MacroDroid ki khirki ke liye 20 s ka qaida popup KHULA rehne tak)
]
# v58 (malik: 'phone kholne par photo wala option nahi aata'): photo baqi (10 min, lock abhi nahi) — har dafa phone kholte hi yaad
ASKP = [
    expr("shAsk", NOW),
    iff([never()]), dlg("📸 {v=shK} ki photo baqi", "{lv=dMin} min mein photo do — warna apps band (10 → 30 → 60 min).", "📸 Photo do", "Baad mein", 15),
      *OPEN,
    ELSE, END,
    expr("shAsk", NOW + "-18"),
]
NOT_T4 = dict(trig(112233445566764, "Phone khula"), m_not=True)   # v67: yeh daur phone kholne se NAHI chala
SCRON = next(copy.deepcopy(v) for v in SHOWOK if v['m_classType'] == 'ScreenOnOffConstraint')
SCROFF = copy.deepcopy(SCRON); SCROFF['m_screenOn'] = not SCRON.get('m_screenOn', True)
KINDS = (("paani", "💧 Paani"), ("coffee", "☕ Coffee"), ("fruit", "🍎 Fruit"), ("nuts", "🥜 Nuts"))
# v58: app ki '📸 Sehat photo' screen (sehat.js mode app) — shOk = a:<kind>, shT = app ka waqt (sec), 3 min ke andar hi maana jata hai (purana link dobara nahi chalta)
APPOK = [expr("tAge", NOW + "-{v=shT}", True), expr("dNum", "(" + NOW + "+18000)/86400", True)]
for _k, _l in KINDS:
    APPOK += [iff([streq("shOk", "a:" + _k), lt("tAge", 181, True), gt("tAge", -181, True)]), sstr("shOk", ""), sint("shT", 0),
                iff([gt("shN", 0), streq("shK", _k)]), *OKDONE,
                ELSE,
                  *([inc("pnCount")] if _k == "paani" else []),
                  iff([gt("shN", 0)]), *patti("✅ " + _l + " gin li — {v=shK} ki photo abhi baqi"),
                  ELSE, *patti("✅ " + _l + (" gin liya — agli yaad 40 min baad" if _k == "paani" else " — aaj is ki yaad nahi aayegi")), END,
                END,
                *([expr("pnDue", NOW + "+" + str(GAP_PAANI)), {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "pnSnz", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False}] if _k == "paani"
                  else [expr("kd" + _k, "{lv=dNum}"), iff([streq("kpK", _k)]), {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "kpPend", "m_type": 0, "isLocalVar": False}, "m_newBooleanValue": False}, END]),
              END]
la = [
    iff([trig(T3, "Webhook")]),
      iff([streq("shZ", "1")]), sstr("shZ", ""),
        iff([strne("shEmDay", "{dayofmonth}")]), expr("shEm", NOW + "+600"), sstr("shEmDay", "{dayofmonth}"), *patti("🚨 10 min sab khula — aaj ka zaroori"),
        ELSE, *patti("🚨 Aaj ka zaroori pehle ho chuka"), END,
      END,
      iff([gt("shN", 0), streq("shOk", "{v=shN}")]), sstr("shOk", ""), *OKDONE, END,
      *APPOK,
      # v61 (malik: 'beej ki picture don to Claude open ho jaye — baqi apps band, 30 minute tak'): app ki 🌱 Sabzi photo sahi = shOk c:sabzi (shT 3 min)
      #   -> clOk (raatband + is lock mein sirf Claude ki chhoot) + clEm (⏸ Claude break ka apna 'zaroori' waqt — wahan kuch badla nahi)
      iff([streq("shOk", "c:sabzi"), lt("tAge", 181, True), gt("tAge", -181, True)]), sstr("shOk", ""), sint("shT", 0),
        expr("clOk", NOW + "+" + str(CL_SEC)), expr("clEm", NOW + "+" + str(CL_SEC)),
        *patti("🌱 Claude 30 minute khuli — baqi apps pehle jaisi"),
      END,
    ELSE,
      iff([tod(*WIN)]),
        expr("dAge", NOW + "-{v=shDue}", True),
        iff([gt("shDue", 0), gt("dAge", 10800, True)]), sint("shDue", 0), sint("shLock", 0), sint("shLv", 0), sint("shN", 0), END,   # raat / purani yaad = saaf
        expr("dAge", NOW + "-{v=shDue}", True), expr("lLeft", "{v=shLock}-" + NOW, True),
        iff([gt("shDue", 0), gt("dAge", -1, True), lt("lLeft", 1, True)]), *LOCKNOW, END,
        expr("lLeft", "{v=shLock}-" + NOW, True), expr("emL", "{v=shEm}-" + NOW, True),
        iff([gt("lLeft", 0, True), lt("emL", 1, True)]),
          pause(1),
          iff([FG]), *clx(),                                         # v61: 🌱 sabzi ke 30 min = Claude ki chhoot (clOk)
            expr("askAge", NOW + "-{v=shAsk}", True),
            iff([gt("askAge", 20, True), lt("cx", 1, True)]),
              HOME, expr("lMin", "({v=shLock}-" + NOW + ")/60", True),
              iff([trig(T2, "App khuli")]), *ASK, ELSE, *patti("⛔ Apps band — 📸 photo do to khulega"), END,
            END,
          END,
        END,
        # v67 (22 Nov, malik: 'phone unlock karne par paani ki photo do wala popup khatam kar do'): phone KHOLNE par photo ka koi popup nahi.
        #   Lock shuru hote hi (phone istemal mein ho) ek dafa popup wahi; phone band tha / unlock par lock laga = popup nahi (shLkA saaf) — bell + band app kholne par popup + app ka ☰ 📸 wahi.
        expr("askAge", NOW + "-{v=shAsk}", True),
        iff([gt("lLeft", 0, True), lt("emL", 1, True), gt("askAge", 20, True), gt("shLkA", 0), NOT_T4] + copy.deepcopy(SHOWOK)),
          expr("lMin", "({v=shLock}-" + NOW + ")/60", True), *ASK,
        END,
        sint("shLkA", 0),
        # v58 (malik: 'apps 1-2 minute khuli rehti hain · shorts bhi foran band nahi'): lock + screen on = har 2 s chowkidar (ek hi loop — shGd dil ki dhadkan);
        #   app khuli ka trigger chook jaye / 30 s ki jaanch phone late kare tab bhi 2 s mein Home. MacroDroid ki apni khirki (popup) ke 20 s nahi chherta (askAge).
        expr("gdAge", NOW + "-{v=shGd}", True),
        iff([gt("lLeft", 0, True), lt("emL", 1, True), gt("gdAge", 6, True), copy.deepcopy(SCRON)]),
          LOOP(1800),
            expr("shGd", NOW),
            expr("lLeft", "{v=shLock}-" + NOW, True), expr("emL", "{v=shEm}-" + NOW, True),
            iff([lt("lLeft", 1, True)]), BREAK, END,
            iff([gt("emL", 0, True)]), BREAK, END,
            iff([copy.deepcopy(SCROFF)]), BREAK, END,
            expr("askAge", NOW + "-{v=shAsk}", True), *clx(),
            iff([FG, gt("askAge", 20, True), lt("cx", 1, True)]),
              HOME, expr("lMin", "({v=shLock}-" + NOW + ")/60", True), *ASK,
            END,
            pause(2),
          ENDLOOP,
          sint("shGd", 0),
        END,
      END,
    END,
]
SL = {"macroExportVersion": 1, "macro": {
    "m_name": "📸 Sehat lock",
    "m_description": "Paani / coffee / fruit / nuts ki photo 10 min mein nahi = SIRF raat wali list ki apps band 10 → 30 → 60 min (WhatsApp, call, bank, Chrome, Blue Khata khuli). Blue Khata mein sahi photo (AI) = foran khul jata hai. 🚨 din mein 1 dafa 10 min. 11 am – 9 pm. 🌱 Sabzi ki sahi photo = sirf Claude 30 min.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("dAge"), lvar("lLeft"), lvar("emL"), lvar("askAge"), lvar("lMin"), lvar("never", 0), lvar("dMin"), lvar("gdAge"), lvar("tAge"), lvar("dNum"), lvar("okL"), lvar("cx")],
    "m_triggerList": [{"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 30, "m_useAlarm": False},
                      {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "isAllApps": False, "m_packageNameList": PK, "m_applicationNameList": NM},
                      WH, {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": T4}],
    "m_actionList": la, "m_constraintList": []},
    "globalVariables": [var("shDue"), var("shN"), var("shK", 2), var("shAsk"), var("shLock"), var("shLv"), var("shOk", 2), var("shZ", 2), var("shEm"), var("shEmDay", 2), var("pnCount"), var("shOp", 2), var("shLkA"), var("shT"), var("shGd"), var("pnDue"), var("pnSnz", 0), var("kpPend", 0), var("kpK", 2), var("kdcoffee"), var("kdfruit"), var("kdnuts"), var("clOk"), var("clEm")],
    "userIcons": None}

if __name__ == '__main__':
    for nm, o in (('sehat_paani', PA), ('sehat_khana', KH), ('sehat_lock', SL)):
        json.dump(o, open(os.path.join(D, nm + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('sehat ok', len(PK))
