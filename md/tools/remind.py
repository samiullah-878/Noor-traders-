# 📝 Reminder (malik 26 Nov 2026: "upar ki taraf ek lagao · Reminder likhein · jo reminder ho wo yellow fonts ke saath har unlock karne par nazar aaye ·
#   tick karein to khatam ho jaye" + OK)
#   Quick Settings tile 3 "📝 Reminder" (ya home shortcut) -> popup mein likho -> global rmT (har reminder alag line) mein jama.
#   Har unlock (DeviceUnlockedTrigger) par, agar rmT khali nahi: SelectionDialog — har reminder ek PEELI line (☐ …), aakhir mein "⏭ Baad mein".
#     Reminder par tap = ✓ ho gaya -> rmT se hata -> baqi wale dobara dikhte hain (loop, 15 tak). Baad mein / back = band, agle unlock par phir.
#   Dialog ka data: Java rmT -> JSON object {"r01": "☐ …", …, "z": "⏭ Baad mein"} (keys zero-padded = tarteeb pakki) -> JsonParseAction
#     (bacha.macro wala azmaya raasta) -> local dictionary ra -> SelectionDialogAction option 1, chuna key -> rk.
#   🌙 Raat 12-11 band + 📸 Sehat lock MacroDroid ki khirki Home kar dete hain (askAge > 20) — popup ke dauran sbAsk / shAsk = abhi + 100,
#     popup ke baad PURANI qeemat wapas (wasite.py jaisa). Dohra unlock 20 s mein = ek hi dafa (rmAt).
#   Reminder ki likhai SIRF phone mein (md/ PUBLIC). Blue Khata ki Reminder screen / WhatsApp reminder se alag. AI nahi. Phone par azmaya nahi.
import json, os, re
from cb import iff, END, ELSE, expr, lvar, var, NOW, strne, trig, gt, pause
from wasite import streq, toast, tile
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3 = 112233445568001, 112233445568002, 112233445568003

def argb(h): v = int('FF' + h, 16); return v - (1 << 32)
YEL, BG = argb('FFD600'), argb('1C1C1E')

# Java: naya reminder jorna. "" = kuch nahi likha · "full" = 40 se zyada.
ADD = '\n'.join([
 'try {',
 '  String s = magicText.evaluateString("{" + "lv=rn}"); if (s == null) s = "";',
 '  s = s.replace("\\r", " ").replace("\\n", " ").trim();',
 '  if (s.length() == 0) return "";',
 '  String t = magicText.evaluateString("{" + "v=rmT}"); if (t == null) t = "";',
 '  String[] a = t.split("\\n");',
 '  int n = 0; for (int i = 0; i < a.length; i++) if (a[i].trim().length() > 0) n++;',
 '  if (n >= 40) return "full";',
 '  t = t.trim(); t = t.length() == 0 ? s : t + "\\n" + s;',
 '  variableSetter.setString("rmT", t, 2);',
 '  return "ok";',
 '} catch (Throwable e) { return "err " + e; }'])

# Java: dialog ke liye JSON object. "" = koi reminder nahi. Braces char se (scriptText magic text hai).
BUILD = '\n'.join([
 'try {',
 '  String t = magicText.evaluateString("{" + "v=rmT}"); if (t == null) t = "";',
 '  String[] a = t.split("\\n");',
 '  String LB = String.valueOf((char) 123), RB = String.valueOf((char) 125), Q = String.valueOf((char) 34), BS = String.valueOf((char) 92);',
 '  StringBuilder sb = new StringBuilder(LB);',
 '  int n = 0;',
 '  for (int i = 0; i < a.length; i++) {',
 '    String s = a[i].trim();',
 '    if (s.length() == 0) continue;',
 '    n++;',
 '    s = s.replace(BS, BS + BS).replace(Q, BS + Q);',
 '    String k = "r" + (n < 10 ? "0" : "") + n;',
 '    sb.append(Q).append(k).append(Q).append(":").append(Q).append("☐ ").append(s).append(Q).append(",");',
 '  }',
 '  if (n == 0) return "";',
 '  sb.append(Q).append("z").append(Q).append(":").append(Q).append("⏭ Baad mein").append(Q).append(RB);',
 '  return sb.toString();',
 '} catch (Throwable e) { return ""; }'])

# Java: chuna reminder (rk = r01…) hatao. Jawab = kitne baqi ("0" = sab ho gaye).
DEL = '\n'.join([
 'try {',
 '  String k = magicText.evaluateString("{" + "lv=rk}"); if (k == null) k = "";',
 '  if (!k.matches("r[0-9]+")) return "x";',
 '  int want = Integer.parseInt(k.substring(1));',
 '  String t = magicText.evaluateString("{" + "v=rmT}"); if (t == null) t = "";',
 '  String[] a = t.split("\\n");',
 '  StringBuilder sb = new StringBuilder();',
 '  int n = 0, left = 0;',
 '  for (int i = 0; i < a.length; i++) {',
 '    String s = a[i].trim();',
 '    if (s.length() == 0) continue;',
 '    n++;',
 '    if (n == want) continue;',
 '    if (sb.length() > 0) sb.append("\\n");',
 '    sb.append(s); left++;',
 '  }',
 '  variableSetter.setString("rmT", sb.toString(), 2);',
 '  return "" + left;',
 '} catch (Throwable e) { return "x"; }'])

for _j in (ADD, BUILD, DEL):
    _bad = [m.start() for m in re.finditer(r'\{(?![\s"])', _j)]
    assert not _bad, ('magic text jaisa {', [_j[i:i + 20] for i in _bad])

def java(src, res, bg=False): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": src, "blockNextAction": True, "responseVariableName": res, "runInBackgroundThread": bg}
def sstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
LOOP = {"m_classType": "LoopAction", "m_SIGUID": 0, "m_option": 0, "m_fixedOptionCount": 15}
ENDLOOP = {"m_classType": "EndLoopAction", "m_SIGUID": 0}
BREAK = {"m_classType": "BreakFromLoopAction", "m_SIGUID": 0}
SAVE = [expr("oA", "{v=sbAsk}", True), expr("oS", "{v=shAsk}", True)]            # purani qeemat yaad
OPEN = [expr("sbAsk", NOW + "+100"), expr("shAsk", NOW + "+100")]                 # popup ke dauran raat-band / sehat lock Home na karein
RESTORE = [expr("sbAsk", "{lv=oA}"), expr("shAsk", "{lv=oS}")]                    # chhoot khatam
DIALOG = {"m_classType": "SelectionDialogAction", "m_SIGUID": 0, "option": 1, "dictionaryVarName": "ra",
          "message": "<font color='#FFD600'><b>📝 Aap ke reminder</b></font><br><small>Jo ho gaya us par tap karein ✓</small>",
          "htmlFormat": True, "textColor": YEL, "bgColor": BG, "buttonStyle": 3, "titleAlignment": 0,
          "saveKeyVariable": {"variableName": "rk"}, "preventBackButtonClose": False, "continueMacroOnBackPress": True,
          "showDictionaryKeys": False, "hasDefault": False}

acts = [
    iff([trig(T3, "Unlock")]),
      iff([strne("rmT", "")]),
        expr("ag", NOW + "-{v=rmAt}", True),
        iff([gt("ag", 20, True)]),
          expr("rmAt", NOW),
          pause(1),
          *SAVE,
          LOOP,
            *OPEN,
            sstr("rk", ""),
            java(BUILD, "rj"),
            iff([streq("rj", "", True)]), BREAK, END,
            {"m_classType": "JsonParseAction", "m_SIGUID": 0, "stringVarName": "rj", "dictionaryVarName": "ra", "parseColors": False},
            DIALOG,
            iff([streq("rk", "", True)]), BREAK, END,
            iff([streq("rk", "z", True)]), BREAK, END,
            java(DEL, "rc"),
            iff([streq("rc", "0", True)]), BREAK, END,
            iff([streq("rc", "x", True)]), BREAK, END,
          ENDLOOP,
          *RESTORE,
        END,
      END,
    ELSE,
      *SAVE, *OPEN,
      sstr("rn", ""),
      {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "rn", "m_type": 2, "isLocalVar": True}, "m_userPrompt": True,
       "m_userPromptTitle": "📝 Reminder", "m_userPromptMessage": "Reminder likhein. Har unlock par peeli likhai mein dikhega; ho jaye to tap karein ✓",
       "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": False, "m_userPromptEmptyAtStart": True},
      java(ADD, "rr"),
      *RESTORE,
      iff([streq("rr", "ok", True)]), toast("✅ Reminder save — unlock par dikhega"), END,
      iff([streq("rr", "full", True)]), toast("⚠️ 40 reminder ho gaye — pehle purane ✓ karein"), END,
    END,
]
RM = {"macroExportVersion": 1, "macro": {
    "m_name": "📝 Reminder",
    "m_description": "Notification patti ka tile 3 (ya home shortcut): reminder likho. Har unlock par baqi reminder peeli likhai mein; jo ho gaya us par tap = ✓ hat jata hai, '⏭ Baad mein' = agle unlock par phir. Koi reminder na ho to kuch nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("rn", 2), lvar("rr", 2), lvar("rj", 2), lvar("rk", 2), lvar("rc", 2), lvar("ra", 4), lvar("ag"), lvar("oA"), lvar("oS")],
    "m_triggerList": [tile(T1, 2, "📝 Reminder", "Likhein"), {"m_classType": "ShortcutTrigger", "m_SIGUID": T2},
                      {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": T3}],
    "m_actionList": acts},
    "globalVariables": [var("rmT", 2), var("rmAt"), var("sbAsk"), var("shAsk")], "userIcons": None}

if __name__ == '__main__':
    json.dump(RM, open(os.path.join(D, 'remind.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('remind ok', len(acts))
