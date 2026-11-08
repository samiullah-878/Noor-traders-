import json, copy, random, re, sys
import os
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'falcon-macro.js')   # NOTE: v4 wali falcon-macro.js par EK dafa (v5 par dobara mat chalao)
src = open(SRC, encoding='utf-8').read()
i = src.index('export const FALCON_MACRO = ')
hdr, body = src[:i], src[i+len('export const FALCON_MACRO = '):].rstrip().rstrip(';')
X = json.loads(body); M = X['macro']; A = M['m_actionList']
used = set(re.findall(r'"m_SIGUID":\s*(-?\d+)', body))
def sid():
    while True:
        v = -random.randint(10**14, 2**52)
        if str(v) not in used: used.add(str(v)); return v
def fresh(o):
    o = copy.deepcopy(o)
    def walk(x):
        if isinstance(x, dict):
            if 'm_SIGUID' in x and x['m_SIGUID'] != 0: x['m_SIGUID'] = sid()
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(o); return o
# ---- templates (asal export ke) ----
T = {k: A[v] for k, v in dict(setStr=119, setBool=121, check=123, loop=122, ifTrue=124, ifFalse=129, brk=9, endif=10, endloop=24,
     pause=127, back=120, tap=130, read=117, json=118, toast=163, scroll=153, tm1=157, tm2=158, tm3=159, http=160, ifkod=162, els=164, endif2=166).items()}
assert T['check']['textToCheck'] == 'Today' and T['back']['m_classType'] == 'PressBackAction' and T['http']['m_classType'] == 'HttpRequestAction'
VT = {0: 'ok', 1: 'kod', 2: 'fa'}
def var(name, t):
    v = None
    for lv in M['localVariables']:
        if lv['m_name'] == VT[t]: v = copy.deepcopy(lv)
    v['m_name'] = name; v['m_type'] = t; v['m_stringValue'] = ''; v['m_intValue'] = 0; v['m_booleanValue'] = False
    for k in ('supportsInput', 'supportsOutput'): v[k] = False
    return v
def setv(name, t, s='', intexpr=None, inc=False, b=False, c=''):
    a = fresh(T['setStr']); a['m_variable'] = var(name, t); a['m_comment'] = c
    a['m_newStringValue'] = s if t == 2 else ''; a['m_newBooleanValue'] = b; a['m_newIntValue'] = 0
    a['m_intExpression'] = intexpr is not None
    if intexpr is not None: a['m_expression'] = intexpr
    a['m_intValueIncrement'] = inc
    return a
def check(text, v='ok'):
    a = fresh(T['check']); a['textToCheck'] = text; a['booleanVariableName'] = v; return a
def loop(n, c): a = fresh(T['loop']); a['m_fixedOptionCount'] = n; a['m_comment'] = c; return a
def pause(ms): a = fresh(T['pause']); a['m_delayInMilliSeconds'] = ms; return a
def toast(msg): a = fresh(T['toast']); a['m_messageText'] = msg; return a
def ifBool(v, val, c=''):
    a = fresh(T['ifTrue'] if val else T['ifFalse']); a['m_comment'] = c
    for k in a['m_constraintList']: k['m_variable']['m_name'] = v
    return a
def ifCons(cons, c='', orc=False):
    a = fresh(T['ifTrue']); a['m_comment'] = c; a['m_constraintList'] = cons; a['m_isOrCondition'] = orc; return a
def vcons(name, t, **kw):
    k = fresh(T['ifkod']['m_constraintList'][0]); k['m_variable'] = var(name, t); k['dictionaryType'] = -1
    k.update({'m_intValue': 0, 'm_intGreaterThan': False, 'm_intLessThan': False, 'm_intNotEqual': False, 'm_intCompareVariable': False, 'm_stringValue': '', 'm_stringEqual': True, 'm_stringComparisonType': 0})
    k.update(kw); return k
def trig_cons(sig, name):
    return {'m_classType': 'TriggerThatInvokedConstraint', 'm_SIGUID': sid(), 'm_comment': '', 'm_constraintList': [], 'm_isDisabled': False, 'm_isOrCondition': False, 'disableLogging': False, 'm_siGuidThatInvoked': sig, 'm_triggerName': name, 'm_not': False}
def simple(cls, c=''):
    return {'m_classType': cls, 'm_SIGUID': sid(), 'm_comment': c, 'm_constraintList': [], 'm_isDisabled': False, 'm_isOrCondition': False, 'disableLogging': False}
BRK = lambda: fresh(T['brk']); ENDIF = lambda: fresh(T['endif']); ENDLOOP = lambda: fresh(T['endloop']); ELSE = lambda: fresh(T['els'])
TERM = lambda c='': simple('TerminateRunningAction', c)
# ---- naye local variables ----
for n, t in (('sa', 2), ('at', 1), ('lw', 1), ('sc', 1), ('rs', 1)):
    if not any(v['m_name'] == n for v in M['localVariables']): M['localVariables'].append(var(n, t))
# ---- naye triggers ----
PKG = 'com.nxd.falconi'
def sct(text, sig, c):
    return {'disableLogging': False, 'm_SIGUID': sig, 'm_classType': 'ScreenContentTrigger', 'm_comment': c, 'm_constraintList': [], 'm_isDisabled': False, 'm_isOrCondition': False,
            'textToMatch': text, 'ignoreCase': True, 'enableRegex': False, 'isOffScreen': False, 'packageNameList': [PKG], 'appNameList': ['Falcon-i'], 'matchOption': 0, 'includeOverlays': False}
S_DET, S_LIST, S_CLOSE = sid(), sid(), sid()
M['m_triggerList'] += [
    sct('Trip Detail', S_DET, '👆 Saathi: malik ne trip kholi → Detail parho'),
    sct('Total Distance', S_LIST, '👆 Saathi: trips ki list nazar aayi → parho'),
    {'disableLogging': False, 'm_SIGUID': S_CLOSE, 'm_classType': 'ApplicationLaunchedTrigger', 'm_comment': '👆 Saathi: Falcon-i band → jama trips Blue Khata ko', 'm_constraintList': [], 'm_isDisabled': False, 'm_isOrCondition': False,
     'm_launched': False, 'm_packageNameList': [PKG], 'm_applicationNameList': ['Falcon-i'], 'usePackageNameOption': 0, 'isAllApps': False, 'excludeMode': False}]
# auto chal raha ho (at = shuru ka waqt, 150 s ke andar) to saathi chup
autoOn = lambda: ifCons([vcons('at', 1, m_intGreaterThan=True, m_expression='{system_time}-150')], 'Auto macro abhi chal raha hai → saathi chup')
def sendBlock(prefix_set, ok_extra, okmsg, badmsg):
    out = [prefix_set, fresh(T['tm1']), fresh(T['tm2']), fresh(T['tm3']), fresh(T['http'])]
    out += [fresh(T['ifkod'])] + ok_extra + [toast(okmsg), ELSE(), toast(badmsg), ENDIF()]
    return out
SAATHI = [
    ifCons([trig_cons(S_DET, 'Screen: Trip Detail')], '👆 SAATHI — Trip Detail khuli (malik ne tap kiya)'),
      autoOn(), TERM(), ENDIF(),
      pause(450), fresh(T['read']), fresh(T['json']),
      setv('sa', 2, '{lv=sa}~~DET~~{lv=ds}', c='Detail jama (phone mein, Falcon band hone par jayegi)'),
      toast('📍 Trip parh li — agli kholein (Blue Khata)'), TERM(),
    ENDIF(),
    ifCons([trig_cons(S_LIST, 'Screen: Total Distance')], '👆 SAATHI — trips ki list'),
      autoOn(), TERM(), ENDIF(),
      pause(700),
      (lambda a: (a.update({'variableName': 'fx', 'm_comment': 'List parho'}), a)[1])(fresh(T['read'])),
      (lambda a: (a.update({'dictionaryVarName': 'fx', 'stringVarName': 'fs'}), a)[1])(fresh(T['json'])),
      setv('sa', 2, '{lv=sa}~~{lv=fs}', c='List jama'), TERM(),
    ENDIF(),
    ifCons([trig_cons(S_CLOSE, 'Falcon-i band')], '👆 SAATHI — Falcon-i band: jama sab Blue Khata ko'),
      autoOn(), TERM(), ENDIF(),
      ifCons([vcons('sa', 2, m_stringValue='', m_stringEqual=True)], 'Kuch jama nahi'), TERM(), ENDIF(),
      *sendBlock(setv('fa', 2, 'SAATHI~~{lv=sa}'), [setv('sa', 2, '', c='Bhej diya — khali')],
                 '✅ Saathi: Falcon trips Blue Khata ko chale gaye', '⚠️ Saathi: trips NAHI gaye (internet?) — Falcon-i dobara khol kar band karein'),
      TERM(),
    ENDIF(),
]
# ---- auto: list load ka intezar ("Downloading Trips Today…" — us par bhi 'Today' likha hota hai) ----
def waitList(c):
    return [setv('lw', 1, intexpr='0'), loop(80, c),
              check('Downloading', 'ok'), ifBool('ok', False),
                check('Total Distance', 'ok'), ifBool('ok', True), BRK(), ENDIF(),
              ENDIF(),
              setv('lw', 1, inc=True), pause(500),
            ENDLOOP()]
BACK = [fresh(T['back']), setv('ok', 0, b=False),
        loop(20, 'Trip Detail band hui? (max 6 s)'), check('Trip Detail', 'ok'), ifBool('ok', False), BRK(), ENDIF(), pause(300), ENDLOOP(),
        ifBool('ok', True, 'Ab bhi Trip Detail (naqsha) → Falcon ka ←'),
          fresh(T['tap']), setv('ok', 0, b=False),
          loop(20, 'Band hui?'), check('Trip Detail', 'ok'), ifBool('ok', False), BRK(), ENDIF(), pause(300), ENDLOOP(),
        ENDIF(),
        ifBool('ok', True, 'Phir bhi → back'), fresh(T['back']), pause(800), ENDIF(),
        *waitList('List dobara load ho — Downloading ghayab + Total Distance (max 40 s)'),
        setv('rs', 1, intexpr='0'),
        loop(12, 'Pehle jitna scroll (list upar se shuru hoti hai)'),
          ifCons([vcons('rs', 1, m_intLessThan=True, m_intCompareVariable=True, m_otherValueToCompare=var('sc', 1))]),
            fresh(T['scroll']), pause(700), setv('rs', 1, inc=True),
          ELSE(), BRK(), ENDIF(),
        ENDLOOP()]
# A[120..143] = purana wapas wala hissa (back → 'Today' 2.1 s → ← → back)
assert A[120]['m_classType'] == 'PressBackAction' and A[141]['m_classType'] == 'PressBackAction' and A[143]['m_classType'] == 'EndIfAction' and A[144]['m_classType'] == 'ElseAction'
assert A[153]['m_classType'] == 'UIInteractionAction' and A[155]['m_classType'] == 'EndLoopAction' and A[92]['m_classType'] == 'PauseAction'
assert A[93]['m_variable']['m_name'] == 'prev' and A[161]['m_classType'] == 'LaunchHomeScreenAction'
A2 = (A[:1] + [setv('at', 1, intexpr='{system_time}', c='Auto shuru (saathi chup rahe)'), setv('sc', 1, intexpr='0'), setv('lw', 1, intexpr='0')] + A[1:92]
      + waitList('Pehli list load ho (max 40 s)') + A[92:120] + BACK + A[144:154] + [setv('sc', 1, inc=True, c='Kitna scroll hua')] + A[154:160]
      + [A[160]] + A[161:] + [setv('at', 1, intexpr='0', c='Auto khatam')])
# payload: FX3 + list load ka waqt (LT = 0.5 s ke qadam)
h = A2[A2.index(A[160])]
h['requestConfig']['contentBodyText'] = h['requestConfig']['contentBodyText'].replace('FX2|', 'FX3|').replace('|{lv=fa}"', '|{lv=fa}~~LT~~{lv=lw}"')
assert 'FX3|' in h['requestConfig']['contentBodyText'] and '~~LT~~' in h['requestConfig']['contentBodyText']
M['m_actionList'] = SAATHI + A2
M['m_name'] = 'NT Falcon km → Blue Khata v5 (auto + saathi)'
M['m_description'] = ("Raat 9 baje ke baad unlock / Blue Khata ka 📲 = AUTO: Falcon-i → Trips → Today → har trip ka Detail; wapas aa kar list ke 'Downloading' khatam hone ka intezar (40 s tak) aur pehle jitna scroll. "
                      "👆 SAATHI: aap khud Falcon-i mein trips kholein — har Trip Detail khud parhi jati hai; Falcon-i band karte hi sab Blue Khata ko. AI nahi.")
# saathi copies of http ka body bhi FX3 (LT nahi)
for a in SAATHI:
    if a.get('m_classType') == 'HttpRequestAction':
        a['requestConfig']['contentBodyText'] = a['requestConfig']['contentBodyText'].replace('FX2|', 'FX3|'); a['m_comment'] = 'Saathi: Blue Khata ko bhejo (khufia chaabi)'
out = json.dumps(X, ensure_ascii=False, separators=(',', ':'))
json.loads(out)
hdr2 = hdr.replace("// App (gaari.js ⚙️ Falcon setup)", "// v2.206.0 (v5, malik 8 Nov: 'Downloading Trips Today par atak jata · hum khud trips kholein, macro parhta jaye'): fxb/build_v5.py (v4 se) —\n//   👆 SAATHI: ScreenContent 'Trip Detail' / 'Total Distance' (Falcon-i) = parho → local `sa` jama; Falcon-i band (ApplicationLaunched closed) = 'SAATHI~~…' bhejo, 200 par sa khali. Auto chal raha ho (`at` 150 s) = saathi chup.\n//   AUTO: back ke baad 'Trip Detail' band hone ka intezar → ← → back; phir `waitList` ('Downloading' ghayab + 'Total Distance', max 40 s — 'Today' tab par bhi likha hota hai) + pehle jitna scroll (`sc`/`rs`). FX3 + '~~LT~~<lw>' (list load × 0.5 s).\n// App (gaari.js ⚙️ Falcon setup)", 1)
open(SRC, 'w', encoding='utf-8').write(hdr2 + 'export const FALCON_MACRO = ' + out + ';\n')
print('actions', len(M['m_actionList']), 'triggers', len(M['m_triggerList']), 'locals', len(M['localVariables']))
