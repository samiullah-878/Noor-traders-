# 📱 AMI KA PHONE — MacroDroid macro (malik 9 Nov 2026: "Ami ka phone alag — TikTok 2 ghante · Facebook 40 min · YouTube 1 ghanta ·
#   Shorts band · koi game nahi · Play Store band · Settings khuli · uninstall na ho · apps ke saath link").
# python3 bacha/build_ami.py → bacha/ami.macro (PUBLIC — chaabi nahi; code phone par pehli dafa). Data / qaide wahi bachaCfg + bachaUse
#   (doc kind 'ami'): tkL fbL ytL (roz ki hadd) · tkX fbX ytX + xU (aaj ka zyada, epoch tak) · papa · block (",pkg,").
# Bachon wale macro (build_macro.py) se farq: koi kul hadd nahi, sirf 3 apps ka time; Settings khuli magar us mein MacroDroid ka safha
#   (Force stop / Uninstall / Use MacroDroid) = Back; awaaz normal (pitch 1.0). Package mein "game" = band (Android category nahi deta).
import json, os, build_macro as B
D = os.path.dirname(os.path.abspath(__file__))
TK = ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go', 'com.ss.android.ugc.aweme']
FB = ['com.facebook.katana', 'com.facebook.lite']
YT = ['com.google.android.youtube']
GAMES = ['com.dts.freefireth', 'com.dts.freefiremax', 'com.tencent.ig', 'com.pubg.imobile', 'com.pubg.krmobile', 'com.roblox.client',
         'com.mojang.minecraftpe', 'com.king.candycrushsaga', 'com.king.candycrushsodasaga', 'com.kiloo.subwaysurf', 'com.ludo.king',
         'com.miniclip.eightballpool', 'com.miniclip.carrom', 'com.supercell.clashofclans', 'com.supercell.clashroyale', 'com.supercell.brawlstars',
         'com.activision.callofduty.shooter', 'com.imangi.templerun2', 'com.outfit7.mytalkingtom2', 'com.outfit7.mytalkingangelafree',
         'com.fingersoft.hillclimb', 'com.nianticlabs.pokemongo', 'com.innersloth.spacemafia', 'com.playrix.township', 'com.playrix.homescapes',
         'com.playrix.gardenscapes', 'com.ea.gp.fifamobile', 'com.gameloft.android.ANMP.GloftA9HM']
STORES = ['com.android.vending', 'com.sec.android.app.samsungapps', 'com.xiaomi.mipicks', 'com.heytap.market', 'com.bbk.appstore', 'com.huawei.appmarket']
INSTALL = ['com.google.android.packageinstaller', 'com.android.packageinstaller', 'com.miui.packageinstaller', 'com.samsung.android.packageinstaller']
MD = ['com.arlosoft.macrodroid']  # MacroDroid app khud band (papa mode / pehle 30 min ke ilawa) — warna macro band kar sakte
BLOCK = GAMES + STORES + INSTALL + MD
SETTINGS = ['com.android.settings', 'com.miui.securitycenter', 'com.samsung.android.lool', 'com.coloros.safecenter']
LIM = {'tk': 120, 'fb': 40, 'yt': 60}
NAME = {'tk': 'TikTok', 'fb': 'Facebook', 'yt': 'YouTube'}
SAY = {'tk': 'टिकटॉक', 'fb': 'फ़ेसबुक', 'yt': 'यूट्यूब'}
PK = {'tk': TK, 'fb': FB, 'yt': YT}

T_MIN, T_APP, T_SHORTS, T_UNI, T_START, T_MDS = B.T_MIN, B.T_APP, B.T_SHORTS, B.T_UNI, B.T_START, 112233445566776
B.TN[T_MDS] = 'Settings mein MacroDroid'
lv, setS, setI, expr, inc, iff, elif_, ELSE, END, trig, ieq, igt, ilt, seq, has, same, OR = (B.lv, B.setS, B.setI, B.expr, B.inc, B.iff, B.elif_,
    B.ELSE, B.END, B.trig, B.ieq, B.igt, B.ilt, B.seq, B.has, B.same, B.OR)
SCR_ON, NO_CALL, LAUNCHER, NOT_LAUNCHER, HOME, BACK, STOP_RUN, TODAY, F = (B.SCR_ON, B.NO_CALL, B.LAUNCHER, B.NOT_LAUNCHER, B.HOME, B.BACK,
    B.STOP_RUN, B.TODAY, B.F)
def say(t): return {'m_classType': 'SpeakTextAction', 'm_SIGUID': 0, 'm_textToSay': t, 'm_pitch': 1.0, 'm_speed': 1.0, 'm_locale': 'hi_IN'}
def pop(t, bg=-1293727): return B.pop(t, bg)
def logE(c, pk=''): return B.logE(c, pk)
def lst(L): return ',' + ','.join(L) + ','

A = []
A += [iff(trig(T_START)),
      {'m_classType': 'SetVariableAction', 'm_SIGUID': 0, 'm_variable': lv('code', 2), 'm_userPrompt': True,
       'm_userPromptTitle': '📱 Code', 'm_userPromptMessage': 'Blue Khata → 👶 Bachon ke phone → Ami ka phone ka code yahan likhein', 'm_userPromptShowCancel': True,
       'm_userPromptStopAfterCancel': True, 'm_userPromptEmptyAtStart': True},
      setI('m5', 9), setI('n', 0), expr('p0', '{system_time}+1800'), END]  # code likhne ke baad 30 min khula (ijazatein do; fetch ghalat ho to bhi code dobara)
A += [iff(seq('code', '')), STOP_RUN, END]
A += [iff(same('{lv=day}', TODAY, False)), setS('day', TODAY), setI('tk', 0), setI('fb', 0), setI('yt', 0), logE('D'), END]
# aaj ki hadd (+ papa ka diya zyada, xU = kab tak) aur bacha hua
A += [expr('au', '{lv=xU}-{system_time}'),
      iff(igt('au', 0)), expr('tkC', '{lv=tkL}+{lv=tkX}'), expr('fbC', '{lv=fbL}+{lv=fbX}'), expr('ytC', '{lv=ytL}+{lv=ytX}'),
      ELSE, expr('tkC', '{lv=tkL}'), expr('fbC', '{lv=fbL}'), expr('ytC', '{lv=ytL}'), END,
      expr('pm', '{lv=papa}-{system_time}'), iff(ilt('pm', 1)), expr('pm', '{lv=p0}-{system_time}'), END,
      expr('tkR', '{lv=tkC}-{lv=tk}'), expr('fbR', '{lv=fbC}-{lv=fb}'), expr('ytR', '{lv=ytC}-{lv=yt}')]
# har minute: teen apps ki ginti (10 min baqi = ek dafa awaaz)
def count(k, first):
    return [(iff if first else elif_)(has(lst(PK[k]), ',{fg_app_package},')), inc(k), expr(k + 'R', '{lv=' + k + 'C}-{lv=' + k + '}'),
            iff(ieq(k + 'R', 10), ilt('pm', 1)), say(SAY[k] + ' के दस मिनट बाक़ी हैं।'), pop('⏳ ' + NAME[k] + ' ke 10 minute baqi', -14527489), END,
            iff(ieq(k + 'R', 0)), logE('X', k), END]
A += [iff(trig(T_MIN)), inc('n'), inc('m5'),
      iff(SCR_ON, NO_CALL, same('{fg_app_package}', '', False)),
        *count('tk', True), *count('fb', False), *count('yt', False), END,
        setS('log', '{lv=log}{hour}:{minute}~{fg_app_package},'),
      END, END]
# har 5 min qaide (Blue Khata se)
def lim(k): return [expr(k + 'L', F(k + 'L')), iff(ilt(k + 'L', 1)), setI(k + 'L', LIM[k]), END, expr(k + 'X', F(k + 'X'))]
A += [iff(OR(trig(T_START), igt('m5', 4))), setI('m5', 0), B.http_get(),
      iff(ieq('rc', 200)),
        {'m_classType': 'JsonParseAction', 'm_SIGUID': 0, 'stringVarName': 'resp', 'dictionaryVarName': 'r', 'parseColors': False},
        *lim('tk'), *lim('fb'), *lim('yt'), expr('xU', F('xU')), expr('papa', F('papa')), setS('block', F('block')),
        iff(trig(T_START)), say('जुड़ गया। शुक्रिया।'), pop('✅ Jur gaya — Blue Khata se qaide aa gaye', -15108810), END,
      ELSE,
        iff(trig(T_START)), pop('⚠️ Code ghalat hai ya internet nahi — macro dobara band / chalu kar ke code likhein', -5636096), END,
      END, END]
# har 10 min data
POST_BODY = ('{"fields":{"k":{"stringValue":"{lv=code}"},"d":{"stringValue":"{lv=day}"},'
             '"p":{"stringValue":"v1|t={system_time}|tk={lv=tk}|fb={lv=fb}|yt={lv=yt}|tc={lv=tkC}|fc={lv=fbC}|yc={lv=ytC}|b={battery_int}|{lv=log}"}}}')
post = B.http_post(); post['requestConfig']['contentBodyText'] = POST_BODY
A += [iff(trig(T_MIN), igt('n', 9)),
      iff(seq('log', '', False)), post, iff(ieq('rc2', 200)), setS('log', ''), setI('n', 0), END,
      ELSE, setI('n', 0), END, END]
# rok: app khulte hi + har minute
def over(k): return [elif_(has(lst(PK[k]), ',{lv=pk},'), ilt(k + 'R', 1)), HOME, say(SAY[k] + ' का आज का टाइम पूरा हो गया।'), pop('⏰ ' + NAME[k] + ' ka aaj ka time poora')]
A += [iff(trig(T_APP)), setS('pk', '{app_package}'), ELSE, setS('pk', '{fg_app_package}'), END,
      iff(OR(trig(T_APP), trig(T_MIN)), SCR_ON, ilt('pm', 1), seq('pk', '', False), NOT_LAUNCHER),
        iff(OR(has('{lv=block}', ',{lv=pk},'), has('{lv=pk}', 'game'))), HOME, say('यह ऐप बंद है।'), pop('⛔ Ye app / game band hai'),
          iff(trig(T_APP)), logE('B', '{lv=pk}'), END,
        *over('tk'), *over('fb'), *over('yt'),
        END,
      END]
A += [iff(trig(T_SHORTS), ilt('pm', 1)), BACK, HOME, say('शॉर्ट्स बंद हैं।'), pop('⛔ Shorts band hain'), logE('S'), END]
A += [iff(trig(T_UNI), ilt('pm', 1)), BACK, HOME, say('इजाज़त के बग़ैर ऐप नहीं हट सकती।'), pop('⛔ Ijazat ke baghair app nahi hat sakti'), logE('U', '{fg_app_package}'), END]
# Settings khuli — magar MacroDroid ka safha (Force stop / Uninstall / Use MacroDroid) nahi
A += [iff(trig(T_MDS), ilt('pm', 1)),
      {'m_classType': 'CheckTextOnScreenAction', 'm_SIGUID': 0, 'textToCheck': '.*(force stop|uninstall|use macrodroid|disable|turn off|band karo).*',
       'booleanVariableName': 'hit', 'enableRegex': True, 'matchOption': 1, 'ignoreCase': True, 'ignoreHiddenText': True, 'forceScreenRefresh': True},
      iff({'m_classType': 'MacroDroidVariableConstraint', 'm_SIGUID': 0, 'm_variable': lv('hit', 0), 'm_booleanValue': True}),
        BACK, HOME, say('यह सेटिंग बंद है।'), pop('⛔ Ye setting band hai'), logE('M'), END,
      END]

TRIG = [
    {'m_classType': 'RegularIntervalTrigger', 'm_SIGUID': T_MIN, 'm_seconds': 60, 'm_useAlarm': False},
    {'m_classType': 'ApplicationLaunchedTrigger', 'm_SIGUID': T_APP, 'm_launched': True, 'isAllApps': True, 'm_packageNameList': [], 'm_applicationNameList': []},
    dict(B.TRIG[2]), dict(B.TRIG[3]),
    {'m_classType': 'MacroEnabledTrigger', 'm_SIGUID': T_START},
    {'m_classType': 'ScreenContentTrigger', 'm_SIGUID': T_MDS, 'textToMatch': 'MacroDroid', 'enableRegex': False, 'ignoreCase': True, 'matchOption': 0,
     'packageNameList': SETTINGS, 'appNameList': ['Settings'] * len(SETTINGS)},
]
v = B.var
LV = [v('code', 2), v('day', 2), v('tk', 1), v('fb', 1), v('yt', 1), v('tkL', 1, LIM['tk']), v('fbL', 1, LIM['fb']), v('ytL', 1, LIM['yt']),
      v('tkX', 1), v('fbX', 1), v('ytX', 1), v('xU', 1), v('au', 1), v('tkC', 1, LIM['tk']), v('fbC', 1, LIM['fb']), v('ytC', 1, LIM['yt']),
      v('tkR', 1, LIM['tk']), v('fbR', 1, LIM['fb']), v('ytR', 1, LIM['yt']), v('papa', 1), v('p0', 1), v('pm', 1), v('block', 2, lst(BLOCK)),
      v('log', 2), v('n', 1), v('m5', 1), v('rc', 1), v('rc2', 1), v('resp', 2), v('r', 4), v('pk', 2), {'m_name': 'hit', 'm_type': 0, 'isLocalVar': True, 'm_booleanValue': False}]
MACRO = {'macroExportVersion': 1, 'macro': {
    'm_name': '📱 Ami ka phone (Blue Khata)', 'm_description': 'TikTok / Facebook / YouTube ka roz ka time (Blue Khata se), Shorts / games / Play Store band, uninstall ki rok, data Blue Khata mein.',
    'm_enabled': True, 'm_completed': True, 'm_GUID': 0, 'aiGenerated': 1, 'm_category': 'Blue Khata', 'm_excludeLog': True,
    'localVariables': LV, 'm_triggerList': TRIG, 'm_actionList': A, 'm_constraintList': []},
    'globalVariables': [], 'userIcons': None}
if __name__ == '__main__':
    out = json.dumps(MACRO, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(D, 'ami.macro'), 'w', encoding='utf-8').write(out)
    print(len(out), 'bytes,', len(A), 'actions')
