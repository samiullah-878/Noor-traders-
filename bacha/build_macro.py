# 👶 BACHON KE PHONE — MacroDroid macro banane wala (malik 9 Nov 2026).
# python3 bacha/build_macro.py  → bacha/bacha.macro  (PUBLIC — is mein koi chaabi NAHI: har phone ka code pehli dafa phone par likha jata hai).
# Ek hi macro (MacroDroid free mein bhi chale), sirf LOCAL variables (link / file import global variable nahi banata).
# Qaide (Blue Khata → 👶 Bachon ke phone → ⚙️) Firestore bachaCfg/<code> se har 5 min; data har 10 min bachaUse mein.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
PROJ = 'note-traders-khata-7ccc1'
API = 'AIzaSyAex-DAr0PDQTZNYqA_K4aWadg6HLn_hLY'   # web API key — config.js mein pehle se public (chaabi nahi)
BASE = f'https://firestore.googleapis.com/v1/projects/{PROJ}/databases/(default)/documents/businesses/noor-traders'

# Pehle se qaide (app se badal sakte hain — bacha.js DEF_ALLOW / DEF_BLOCK ke saath EK jaisa rakho)
ALLOW = ['com.google.android.dialer', 'com.android.dialer', 'com.samsung.android.dialer', 'com.android.contacts', 'com.google.android.contacts',
         'com.samsung.android.app.contacts', 'com.android.phone', 'com.android.server.telecom', 'com.android.incallui', 'com.samsung.android.incallui',
         'com.android.systemui', 'com.whatsapp', 'com.whatsapp.w4b', 'com.google.android.apps.maps',
         'com.google.android.calendar', 'com.samsung.android.calendar', 'com.android.calendar',
         'com.google.android.deskclock', 'com.sec.android.app.clockpackage', 'com.android.deskclock', 'com.android.alarmclock', 'com.transsion.deskclock',
         'com.google.android.apps.messaging', 'com.samsung.android.messaging', 'com.android.mms',
         'com.google.android.apps.bard', 'com.openai.chatgpt', 'com.google.android.permissioncontroller', 'com.android.permissioncontroller']
BLOCK = ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go', 'com.ss.android.ugc.aweme',
         'com.facebook.katana', 'com.facebook.lite', 'com.facebook.orca', 'com.facebook.mlite', 'com.instagram.android', 'com.instagram.lite',
         'com.instagram.barcelona', 'com.snapchat.android', 'com.twitter.android', 'com.pinterest', 'com.reddit.frontpage', 'video.like',
         'com.kwai.video', 'com.kwai.bulldog', 'sg.bigo.live', 'com.imo.android.imoim', 'org.telegram.messenger', 'com.discord',
         'com.android.vending', 'com.sec.android.app.samsungapps', 'com.xiaomi.mipicks', 'com.heytap.market', 'com.bbk.appstore', 'com.huawei.appmarket',
         'com.android.settings', 'com.miui.securitycenter', 'com.arlosoft.macrodroid',
         'com.google.android.packageinstaller', 'com.android.packageinstaller', 'com.miui.packageinstaller', 'com.samsung.android.packageinstaller']
LIM = 80   # 1 ghanta 20 minute

T_MIN, T_APP, T_SHORTS, T_UNI, T_START = 112233445566771, 112233445566772, 112233445566773, 112233445566774, 112233445566775
TN = {T_MIN: 'Har minute', T_APP: 'App khuli', T_SHORTS: 'YouTube Shorts', T_UNI: 'Uninstall', T_START: 'Shuru (code)'}

def lv(n, t): return {'m_name': n, 'm_type': t, 'isLocalVar': True}
def setS(n, v): return {'m_classType': 'SetVariableAction', 'm_SIGUID': 0, 'm_variable': lv(n, 2), 'm_newStringValue': v}
def setI(n, v): return {'m_classType': 'SetVariableAction', 'm_SIGUID': 0, 'm_variable': lv(n, 1), 'm_newIntValue': v}
def expr(n, e): return {'m_classType': 'SetVariableAction', 'm_SIGUID': 0, 'm_variable': lv(n, 1), 'm_intExpression': True, 'm_expression': e}
def inc(n): return {'m_classType': 'SetVariableAction', 'm_SIGUID': 0, 'm_variable': lv(n, 1), 'm_intValueIncrement': True}
def iff(*c, orc=False):
    a = {'m_classType': 'IfConditionAction', 'm_SIGUID': 0, 'm_constraintList': list(c)}
    if orc: a['m_isOrCondition'] = True
    return a
def elif_(*c): return {'m_classType': 'ElseIfConditionAction', 'm_SIGUID': 0, 'm_constraintList': list(c)}
ELSE = {'m_classType': 'ElseAction', 'm_SIGUID': 0}
END = {'m_classType': 'EndIfAction', 'm_SIGUID': 0}
def trig(s, no=False): return {'m_classType': 'TriggerThatInvokedConstraint', 'm_SIGUID': 0, 'm_siGuidThatInvoked': s, 'm_triggerName': TN[s], 'm_not': no}
def ieq(n, v): return {'m_classType': 'MacroDroidVariableConstraint', 'm_SIGUID': 0, 'm_variable': lv(n, 1), 'm_intValue': v}
def igt(n, v): return {'m_classType': 'MacroDroidVariableConstraint', 'm_SIGUID': 0, 'm_variable': lv(n, 1), 'm_intGreaterThan': True, 'm_intValue': v}
def ilt(n, v): return {'m_classType': 'MacroDroidVariableConstraint', 'm_SIGUID': 0, 'm_variable': lv(n, 1), 'm_intLessThan': True, 'm_intValue': v}
def seq(n, v, eq=True): return {'m_classType': 'MacroDroidVariableConstraint', 'm_SIGUID': 0, 'm_variable': lv(n, 2), 'm_stringValue': v, 'm_stringComparisonType': 0, 'm_stringEqual': eq}
def has(a, b, yes=True): return {'m_classType': 'CompareValueConstraint', 'm_SIGUID': 0, 'type': 2, 'value1': a, 'value2': b, 'comparisonType': 4 if yes else 5, 'ignoreCase': True}
def same(a, b, yes=True): return {'m_classType': 'CompareValueConstraint', 'm_SIGUID': 0, 'type': 2, 'value1': a, 'value2': b, 'comparisonType': 0 if yes else 1, 'ignoreCase': True}
def OR(*c): return {'m_classType': 'LogicConstraint', 'm_SIGUID': 0, 'm_option': 1, 'm_childConstraints': list(c)}
SCR_ON = {'m_classType': 'ScreenOnOffConstraint', 'm_SIGUID': 0, 'm_screenOn': True}
NO_CALL = {'m_classType': 'InCallConstraint', 'm_SIGUID': 0, 'm_inCall': False}
LAUNCHER = {'m_classType': 'LauncherIsInForegroundConstraint', 'm_SIGUID': 0, 'm_inForeground': True}
NOT_LAUNCHER = {'m_classType': 'LauncherIsInForegroundConstraint', 'm_SIGUID': 0, 'm_inForeground': False}
HOME = {'m_classType': 'LaunchHomeScreenAction', 'm_SIGUID': 0, 'useAccessibilityService': True}
BACK = {'m_classType': 'PressBackAction', 'm_SIGUID': 0}
STOP_RUN = {'m_classType': 'TerminateRunningAction', 'm_SIGUID': 0}
def say(t): return {'m_classType': 'SpeakTextAction', 'm_SIGUID': 0, 'm_textToSay': t, 'm_pitch': 1.75, 'm_speed': 0.95, 'm_locale': 'hi_IN'}
def pop(t, bg=-1293727): return {'m_classType': 'FloatingTextAction', 'm_SIGUID': 0, 'option': 0, 'identifier': 'ntbacha', 'textToDisplay': t,
                                  'bgColor': bg, 'textColor': -1, 'alpha': 96, 'xPosition': 0.5, 'yPosition': 0.38, 'padding': 18, 'textSize': 22,
                                  'corners': 22, 'alignment': 0, 'autoHideAfterDelay': True, 'autoHideSeconds': 6, 'hideOnClick': True, 'moveOption': 2,
                                  'enableShadow': True, 'widthPercentage': 86}
def logE(code, pk=''): return setS('log', '{lv=log}!' + code + '~' + pk + '~{hour}:{minute},')
TODAY = '{year}-{month_digit}-{dayofmonth}'

def http_get():
    return {'m_classType': 'HttpRequestAction', 'm_SIGUID': 0, 'requestConfig': {
        'requestType': 0, 'urlToOpen': BASE + '/bachaCfg/{lv=code}?key=' + API, 'requestTimeOutSeconds': 20, 'blockNextAction': True,
        'saveReturnCodeToVariable': True, 'returnCodeVariableName': 'rc', 'saveResponseType': 1, 'responseVariableName': 'resp'}}
def http_post():
    body = ('{"fields":{"k":{"stringValue":"{lv=code}"},"d":{"stringValue":"{lv=day}"},'
            '"p":{"stringValue":"v1|t={system_time}|u={lv=used}|c={lv=cap}|b={battery_int}|{lv=log}"}}}')
    return {'m_classType': 'HttpRequestAction', 'm_SIGUID': 0, 'requestConfig': {
        'requestType': 1, 'urlToOpen': BASE + '/bachaUse?key=' + API, 'requestTimeOutSeconds': 25, 'contentType': 'application/json',
        'contentBodySource': 0, 'contentBodyText': body, 'blockNextAction': True, 'saveReturnCodeToVariable': True, 'returnCodeVariableName': 'rc2'}}
def F(k): return '{lv=r[fields][' + k + '][stringValue]}'

A = []
# ① Pehli dafa: papa ka code (Blue Khata → 👶 Bachon ke phone → ➕ Naya phone)
A += [iff(trig(T_START)),
      {'m_classType': 'SetVariableAction', 'm_SIGUID': 0, 'm_variable': lv('code', 2), 'm_userPrompt': True,
       'm_userPromptTitle': '👶 Papa ka code', 'm_userPromptMessage': 'Blue Khata → 👶 Bachon ke phone mein likha code yahan likhein', 'm_userPromptShowCancel': True,
       'm_userPromptStopAfterCancel': True, 'm_userPromptEmptyAtStart': True},
      setI('m5', 9), setI('n', 0), END]
# ② Code nahi = kuch nahi (setup ke dauran kuch band na ho)
A += [iff(seq('code', '')), STOP_RUN, END]
# ③ Naya din = time dobara
A += [iff(same('{lv=day}', TODAY, False)), setS('day', TODAY), setI('used', 0), logE('D'), END]
# ④ Aaj ka hisaab: cap = lim (+ papa ka diya zyada time, addU = kab tak — epoch, phone ki tareekh ki shakal par bharosa nahi)
A += [expr('au', '{lv=addU}-{system_time}'), iff(igt('au', 0)), expr('cap', '{lv=lim}+{lv=add}'), ELSE, expr('cap', '{lv=lim}'), END,
      expr('pm', '{lv=papa}-{system_time}'), expr('sm', '{lv=stop}-{system_time}'), expr('left', '{lv=cap}-{lv=used}')]
# ⑤ Har minute: ginti + qaide lao (5 min) + data bhejo (10 min)
A += [iff(trig(T_MIN)), inc('n'), inc('m5'),
      iff(SCR_ON, NO_CALL, same('{fg_app_package}', '', False)),
        iff(OR(has('{lv=allow}', ',{fg_app_package},'), LAUNCHER)), ELSE,
          inc('used'), expr('left', '{lv=cap}-{lv=used}'),
          iff(ieq('left', 10), ilt('pm', 1)), say('सिर्फ़ दस मिनट बाक़ी हैं।'), pop('⏳ Sirf 10 minute baqi hain', -14527489), END,
          iff(ieq('left', 0)), logE('X'), END,
        END,
        setS('log', '{lv=log}{hour}:{minute}~{fg_app_package},'),
      END, END]
A += [iff(OR(trig(T_START), igt('m5', 4))), setI('m5', 0), http_get(),
      iff(ieq('rc', 200)),
        {'m_classType': 'JsonParseAction', 'm_SIGUID': 0, 'stringVarName': 'resp', 'dictionaryVarName': 'r', 'parseColors': False},
        expr('lim', F('lim')), iff(ilt('lim', 1)), setI('lim', LIM), END, expr('add', F('add')), expr('addU', F('addU')), expr('papa', F('papa')), expr('stop', F('stop')),
        setS('allow', F('allow')), setS('block', F('block')),
        iff(trig(T_START)), say('जुड़ गया। शुक्रिया।'), pop('✅ Jur gaya — Blue Khata se qaide aa gaye', -15108810), END,
      ELSE,
        iff(trig(T_START)), pop('⚠️ Code ghalat hai ya internet nahi — macro dobara band / chalu kar ke code likhein', -5636096), END,
      END, END]
A += [iff(trig(T_MIN), igt('n', 9)),
      iff(seq('log', '', False)), http_post(), iff(ieq('rc2', 200)), setS('log', ''), setI('n', 0), END,
      ELSE, setI('n', 0), END, END]
# ⑥ Rok: kis app par (khulte hi = app ka naam, har minute = saamne wali app)
A += [iff(trig(T_APP)), setS('pk', '{app_package}'), ELSE, setS('pk', '{fg_app_package}'), END,
      iff(OR(trig(T_APP), trig(T_MIN)), SCR_ON, ilt('pm', 1), seq('pk', '', False), NOT_LAUNCHER),
        iff(has('{lv=block}', ',{lv=pk},')), HOME, say('यह ऐप बंद है। पापा से पूछो।'), pop('⛔ Ye app band hai — Papa se poochho'),
          iff(trig(T_APP)), logE('B', '{lv=pk}'), END,
        elif_(has('{lv=allow}', ',{lv=pk},', False), igt('sm', 0)), HOME, say('आज फ़ोन बंद है। पापा से पूछो।'), pop('⏸ Aaj phone band hai — Papa se poochho'),
        elif_(has('{lv=allow}', ',{lv=pk},', False), ilt('left', 1)), HOME, say('टाइम ख़त्म हो गया है। अब फ़ोन रख दो।'), pop('⏰ Time khatam ho gaya hai\nAb phone rakh do 🙂'),
        END,
      END]
# ⑦ YouTube Shorts = foran bahar
A += [iff(trig(T_SHORTS), ilt('pm', 1)), BACK, HOME, say('शॉर्ट्स बंद हैं।'), pop('⛔ Shorts band hain'), logE('S'), END]
# ⑧ Uninstall ki koshish (home screen par "Uninstall") = band
A += [iff(trig(T_UNI), ilt('pm', 1)), BACK, HOME, say('पापा की इजाज़त के बग़ैर ऐप नहीं हट सकती।'), pop('⛔ Papa ki ijazat ke baghair app nahi hat sakti'), logE('U', '{fg_app_package}'), END]

TRIG = [
    {'m_classType': 'RegularIntervalTrigger', 'm_SIGUID': T_MIN, 'm_seconds': 60, 'm_useAlarm': False},
    {'m_classType': 'ApplicationLaunchedTrigger', 'm_SIGUID': T_APP, 'm_launched': True, 'isAllApps': True, 'm_packageNameList': [], 'm_applicationNameList': []},
    {'m_classType': 'ScreenContentTrigger', 'm_SIGUID': T_SHORTS, 'textToMatch': '.*reel_(recycler|player_page_container|watch_player|player_overlay).*',
     'enableRegex': True, 'ignoreCase': True, 'matchOption': 1, 'packageNameList': ['com.google.android.youtube'], 'appNameList': ['YouTube']},
    {'m_classType': 'ScreenContentTrigger', 'm_SIGUID': T_UNI, 'textToMatch': '.*(uninstall|ان انسٹال).*', 'enableRegex': True, 'ignoreCase': True, 'matchOption': 0,
     'm_constraintList': [LAUNCHER]},
    {'m_classType': 'MacroEnabledTrigger', 'm_SIGUID': T_START},
]
def var(n, t, v=None):
    o = {'m_name': n, 'm_type': t, 'isLocalVar': True}
    if t == 1: o['m_intValue'] = v or 0
    if t == 2: o['m_stringValue'] = v or ''
    if t == 4: o['dictionary'] = {'entries': [], 'isArray': False}
    return o
LV = [var('code', 2), var('day', 2), var('used', 1), var('cap', 1, LIM), var('lim', 1, LIM), var('add', 1), var('addU', 1), var('au', 1), var('papa', 1), var('stop', 1),
      var('allow', 2, ',' + ','.join(ALLOW) + ','), var('block', 2, ',' + ','.join(BLOCK) + ','), var('log', 2), var('n', 1), var('m5', 1), var('rc', 1), var('rc2', 1),
      var('resp', 2), var('r', 4), var('pk', 2), var('pm', 1), var('sm', 1), var('left', 1, LIM)]
MACRO = {'macroExportVersion': 1, 'macro': {
    'm_name': '👶 Bachon ka phone (Blue Khata)', 'm_description': 'Roz ka time (Blue Khata se), band apps, YouTube Shorts / TikTok / Play Store / Settings / uninstall ki rok, patli awaaz, data Blue Khata mein.',
    'm_enabled': True, 'm_completed': True, 'm_GUID': 0, 'aiGenerated': 1, 'm_category': 'Blue Khata', 'm_excludeLog': True,
    'localVariables': LV, 'm_triggerList': TRIG, 'm_actionList': A, 'm_constraintList': []},
    'globalVariables': [], 'userIcons': None}
if __name__ == '__main__':
    out = json.dumps(MACRO, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(D, 'bacha.macro'), 'w', encoding='utf-8').write(out)
    print(len(out), 'bytes,', len(A), 'actions')
