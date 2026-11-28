# 📋 Clipboard (malik 28 Nov 2026: "apna clipboard banana hai jo upar tile mein aaye, wahan se ek click mein copy paste" + "main copy karun wo khud
#   copy ho jaye" + "Shizuku ki already permission hai" + OK)
#   Do macro:
#   (1) '📋 Clipboard yaad' — ClipboardChangeTrigger: jo bhi copy ho wo global cpL mein (aakhri 25, nayi upar, dohri nahi). Bank app saamne = nahi
#       (bank.notBank), sirf 4-8 hindse (OTP / PIN) = nahi, 1500 harf se lamba = nahi. Koi toast / popup nahi.
#   (2) '📋 Clipboard' — Quick Settings tile 4 (ya home shortcut): list (📌 pakke pehle, phir naye) -> tap = copy (ClipboardManager) -> paste malik khud.
#       Neeche: ➕ likh kar save (pakka) · 📌 Pakka / wapas · 🗑 Ek hatao · 🧹 Sab saaf (pakke rehte hain).
#       Khud-copy ko Android 10+ par READ_LOGS chahiye — tile dabane par, agar ijazat na ho, Shizuku se
#       `pm grant com.arlosoft.macrodroid android.permission.READ_LOGS` (ShellScriptAction useShizuku). Na mile = popup mein saaf line; ➕ phir bhi chalta.
#   cpL ki shakal: har line 'p|<base64>' (pakka) ya 'n|<base64>' (aam) — base64 is liye ke likhai mein nayi line / | ho sakta hai. SIRF phone mein
#     (md/ PUBLIC; Remote ki report mein string ki sirf lambai jati hai). Hindse report ke liye: cpN (kitni dafa pakra) · cpR (aakhri nateeja:
#     1 jura · 3 pehle se pakka · 5 lamba · 6 OTP jaisa · 0 khali · 9 ghalti) · cpG (1 = READ_LOGS mili).
#   Popup ke dauran sbAsk / shAsk = abhi + 100 (raat-band / sehat lock MacroDroid ki khirki Home na karein), baad mein purani qeemat (wasite.py jaisa).
#   AI nahi. Phone par azmaya nahi (ClipboardChangeTrigger OxygenOS par, Shizuku wala grant, restart ke baad log ki ijazat).
import json, os, re
from cb import iff, END, ELSE, expr, lvar, var, NOW, strne
from wasite import streq, toast, tile, sv, java
from bank import notBank
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3 = 112233445569001, 112233445569002, 112233445569003
MAXU, MAXP, MAXLEN = 25, 20, 1500
PKG = "com.arlosoft.macrodroid"

# cpL parhna -> P (pakke), U (aam); dono mein base64. Dikhane ki tarteeb: pehle P, phir U.
LOAD = [
 '  String L = magicText.evaluateString("{" + "v=cpL}"); if (L == null) L = "";',
 '  String[] la = L.split("\\n");',
 '  java.util.ArrayList P = new java.util.ArrayList(); java.util.ArrayList U = new java.util.ArrayList();',
 '  for (int i = 0; i < la.length; i++) {',
 '    String z = la[i].trim(); if (z.length() < 3) continue;',
 '    if (z.startsWith("p|")) P.add(z.substring(2)); else if (z.startsWith("n|")) U.add(z.substring(2));',
 '  }']
STORE = [
 '  StringBuilder o = new StringBuilder();',
 '  for (int i = 0; i < P.size(); i++) { if (o.length() > 0) o.append("\\n"); o.append("p|").append((String) P.get(i)); }',
 '  for (int i = 0; i < U.size(); i++) { if (o.length() > 0) o.append("\\n"); o.append("n|").append((String) U.get(i)); }',
 '  variableSetter.setString("cpL", o.toString(), 2);']
BUMP = '  try { int n = 0; try { n = Integer.parseInt(magicText.evaluateString("{" + "v=cpN}").trim()); } catch (Throwable e1) { n = 0; } variableSetter.setInt("cpN", n + 1); } catch (Throwable e2) { }'

# (1) pakarna. lv ct = {clipboard} (SetVariable se — Java mein seedha magic text nahi).
CAP = '\n'.join(['try {',
 '  String s = magicText.evaluateString("{" + "lv=ct}"); if (s == null) s = "";',
 '  String t = s.trim();',
 '  if (t.length() == 0) return "0";',
 '  if (s.length() > %d) return "5";' % MAXLEN,
 '  if (t.matches("[0-9]+") && t.length() >= 4 && t.length() <= 8) return "6";',
 ] + LOAD + [
 '  String b = android.util.Base64.encodeToString(t.getBytes("UTF-8"), 2);',
 '  if (P.contains(b)) return "3";',
 '  U.remove(b); U.add(0, b);',
 '  while (U.size() > %d) U.remove(U.size() - 1);' % MAXU,
 ] + STORE + [BUMP,
 '  return "1";',
 '} catch (Throwable e) { return "9"; }'])

# READ_LOGS mili? "1" / "0"
CHK = '\n'.join(['try {',
 '  int r = appContext.checkSelfPermission("android.permission.READ_LOGS");',
 '  variableSetter.setInt("cpG", r == 0 ? 1 : 0);',
 '  return r == 0 ? "1" : "0";',
 '} catch (Throwable e) { return "0"; }'])

# list -> SelectionDialog ka JSON. lv md: c = copy wali list (+ neeche ke button) · p / d = sirf cheezein + Wapas.
LST = '\n'.join(['try {',
 '  String md = magicText.evaluateString("{" + "lv=md}"); if (md == null) md = "c"; md = md.trim();',
 ] + LOAD + [
 '  String LB = String.valueOf((char) 123), RB = String.valueOf((char) 125), Q = String.valueOf((char) 34);',
 '  StringBuilder sb = new StringBuilder(LB); int n = 0;',
 '  for (int k = 0; k < P.size() + U.size() && n < 45; k++) {',
 '    boolean pin = k < P.size();',
 '    String b = pin ? (String) P.get(k) : (String) U.get(k - P.size());',
 '    String s = "";',
 '    try { s = new String(android.util.Base64.decode(b, 2), "UTF-8"); } catch (Throwable e3) { s = "?"; }',
 '    StringBuilder c = new StringBuilder();',
 '    for (int i = 0; i < s.length() && c.length() < 70; i++) {',
 '      char ch = s.charAt(i);',
 '      if (ch < 32) c.append(" "); else if (ch == 34) c.append("\'"); else if (ch == 92) c.append("/"); else c.append(ch);',
 '    }',
 '    if (s.length() > 70) c.append("…");',
 '    n++;',
 '    sb.append(Q + "c" + (n < 10 ? "0" : "") + n + Q + ":" + Q + (pin ? "📌 " : "") + c.toString() + Q + ",");',
 '  }',
 '  if (md.equals("c")) {',
 '    sb.append(Q + "y1" + Q + ":" + Q + "➕ Nayi cheez likh kar save" + Q + ",");',
 '    if (n > 0) {',
 '      sb.append(Q + "y2" + Q + ":" + Q + "📌 Pakka karo / pakke se hatao" + Q + ",");',
 '      sb.append(Q + "y3" + Q + ":" + Q + "🗑 Ek cheez hatao" + Q + ",");',
 '      sb.append(Q + "y4" + Q + ":" + Q + "🧹 Sab saaf (📌 pakke rehenge)" + Q + ",");',
 '    }',
 '  }',
 '  sb.append(Q + "z" + Q + ":" + Q + (md.equals("c") ? "✕ Band" : "↩ Wapas") + Q).append(RB);',
 '  return sb.toString();',
 '} catch (Throwable e) { return ""; }'])

# chuni cheez (lv rk = c01…) par kaam. md c = copy ("k") · p = pakka badlo ("p" / "u" / "f" bhar gaya) · d = hatao ("d"). "x" = kuch nahi.
ACT = '\n'.join(['try {',
 '  String md = magicText.evaluateString("{" + "lv=md}"); if (md == null) md = "c"; md = md.trim();',
 '  String k = magicText.evaluateString("{" + "lv=rk}"); if (k == null) k = ""; k = k.trim();',
 '  if (!k.matches("c[0-9][0-9]")) return "x";',
 '  int want = Integer.parseInt(k.substring(1)) - 1;',
 ] + LOAD + [
 '  if (want < 0 || want >= P.size() + U.size()) return "x";',
 '  boolean pin = want < P.size();',
 '  String b = pin ? (String) P.get(want) : (String) U.get(want - P.size());',
 '  if (md.equals("c")) {',
 '    String s = new String(android.util.Base64.decode(b, 2), "UTF-8");',
 '    android.content.ClipboardManager cm = (android.content.ClipboardManager) appContext.getSystemService("clipboard");',
 '    cm.setPrimaryClip(android.content.ClipData.newPlainText("nt", s));',
 '    if (!pin) { U.remove(b); U.add(0, b); }',
 ] + STORE + [
 '    return "k";',
 '  }',
 '  if (md.equals("p")) {',
 '    String r = "p";',
 '    if (pin) { P.remove(b); U.add(0, b); r = "u"; }',
 '    else { if (P.size() >= %d) return "f"; U.remove(b); P.add(b); }' % MAXP,
 ] + STORE + [
 '    return r;',
 '  }',
 '  if (md.equals("d")) {',
 '    P.remove(b); U.remove(b);',
 ] + STORE + [
 '    return "d";',
 '  }',
 '  return "x";',
 '} catch (Throwable e) { return "x"; }'])

# ➕ likha (lv rn) -> pakka. "" khali · "f" bhar gaya · "ok"
ADD = '\n'.join(['try {',
 '  String s = magicText.evaluateString("{" + "lv=rn}"); if (s == null) s = "";',
 '  String t = s.trim();',
 '  if (t.length() == 0) return "";',
 '  if (t.length() > %d) t = t.substring(0, %d);' % (MAXLEN, MAXLEN),
 ] + LOAD + [
 '  String b = android.util.Base64.encodeToString(t.getBytes("UTF-8"), 2);',
 '  if (P.contains(b)) return "ok";',
 '  if (P.size() >= %d) return "f";' % MAXP,
 '  U.remove(b); P.add(0, b);',
 ] + STORE + [
 '  return "ok";',
 '} catch (Throwable e) { return ""; }'])

# 🧹 aam sab saaf (pakke rehte hain)
CLR = '\n'.join(['try {',
 ] + LOAD + [
 '  U.clear();',
 ] + STORE + [
 '  return "ok";',
 '} catch (Throwable e) { return ""; }'])

for _j in (CAP, CHK, LST, ACT, ADD, CLR):
    _bad = [m.start() for m in re.finditer(r'\{(?![\s"])', _j)]
    assert not _bad, ('magic text jaisa {', [_j[i:i + 24] for i in _bad])

INK = -15658735
def dlg(dic, msg): return {"m_classType": "SelectionDialogAction", "m_SIGUID": 0, "option": 1, "dictionaryVarName": dic, "message": msg,
                           "htmlFormat": True, "textColor": INK, "bgColor": -1, "buttonStyle": 3,
                           "saveKeyVariable": {"variableName": "rk"}, "preventBackButtonClose": False, "continueMacroOnBackPress": True,
                           "showDictionaryKeys": False, "hasDefault": False}
def parse(src, dic): return {"m_classType": "JsonParseAction", "m_SIGUID": 0, "stringVarName": src, "dictionaryVarName": dic, "parseColors": False}
GRANT = {"m_classType": "ShellScriptAction", "m_SIGUID": 0, "m_script": "pm grant " + PKG + " android.permission.READ_LOGS",
         "m_nonRoot": True, "useShizuku": True, "useHelper": False, "blockNextAction": True, "timeoutSeconds": 10}
PAUSE1 = {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 1, "m_useAlarm": False}
HEAD = "<b>📋 Clipboard</b><br><small>Tap = copy ho jayega, phir jahan chahein paste karein</small>"

tile_acts = [
    expr("oA", "{v=sbAsk}", True), expr("oS", "{v=shAsk}", True),
    expr("sbAsk", NOW + "+100"), expr("shAsk", NOW + "+100"),
    sv("rk", ""), sv("a1", ""), sv("md", "c"), sv("rr", ""), sv("hm", HEAD),
    java(CHK, "g0"),
    iff([strne("g0", "1", True)]),
      GRANT, PAUSE1,
      java(CHK, "g1"),
      iff([streq("g1", "1", True)]),
        sv("hm", HEAD + "<br><br>✅ Khud-copy ki ijazat mil gayi. Ek dafa MacroDroid band kar ke dobara kholein (ya phone restart) — phir jo copy karenge yahan aayega."),
      ELSE,
        sv("hm", HEAD + "<br><br>⚠️ Khud-copy ki ijazat nahi mili — Shizuku chalu karein (us mein MacroDroid Allow), phir yeh tile dobara dabayein. ➕ se haath wala save chalta hai."),
      END,
    END,
    java(LST, "rj"),
    iff([strne("rj", "", True)]),
      parse("rj", "ra"),
      dlg("ra", "{lv=hm}"),
    END,
    sv("a1", "{lv=rk}"),
    iff([streq("a1", "y2", True)]), sv("md", "p"), sv("hm", "<b>📌 Kis ko pakka karna hai?</b><br><small>📌 wali par tap = pakke se hat jayegi</small>"), END,
    iff([streq("a1", "y3", True)]), sv("md", "d"), sv("hm", "<b>🗑 Kaun si hatani hai?</b>"), END,
    iff([strne("md", "c", True)]),
      sv("rk", ""),
      java(LST, "rj"),
      iff([strne("rj", "", True)]),
        parse("rj", "rb"),
        dlg("rb", "{lv=hm}"),
      END,
    END,
    iff([streq("a1", "y1", True)]),
      sv("rn", ""),
      {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "rn", "m_type": 2, "isLocalVar": True}, "m_userPrompt": True,
       "m_userPromptTitle": "📋 Nayi cheez", "m_userPromptMessage": "Likhein ya paste karein. Yeh 📌 pakki rahegi (pata, number, aam jawab…).",
       "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": False, "m_userPromptEmptyAtStart": True},
      java(ADD, "rr"),
      iff([streq("rr", "ok", True)]), toast("📌 Save ho gaya"), END,
      iff([streq("rr", "f", True)]), toast("⚠️ %d pakki ho gayin — pehle koi hatayein" % MAXP), END,
    END,
    iff([streq("a1", "y4", True)]),
      java(CLR, "rr"),
      toast("🧹 Saaf — 📌 pakke rehne diye"),
    END,
    iff([strne("a1", "y1", True), strne("a1", "y4", True), strne("a1", "z", True), strne("a1", "", True)]),
      java(ACT, "rr"),
      iff([streq("rr", "k", True)]), toast("✅ Copy ho gaya — ab paste karein"), END,
      iff([streq("rr", "p", True)]), toast("📌 Pakka ho gaya"), END,
      iff([streq("rr", "u", True)]), toast("Pakke se hat gaya"), END,
      iff([streq("rr", "d", True)]), toast("🗑 Hat gaya"), END,
      iff([streq("rr", "f", True)]), toast("⚠️ %d pakki ho gayin — pehle koi hatayein" % MAXP), END,
    END,
    expr("sbAsk", "{lv=oA}"), expr("shAsk", "{lv=oS}"),
]
DIC = lambda n: {"m_name": n, "m_type": 4, "isLocalVar": True, "m_stringValue": ""}
GV = [var("cpL", 2), var("cpN"), var("cpR"), var("cpG"), var("sbAsk"), var("shAsk")]
CT = {"macroExportVersion": 1, "macro": {
    "m_name": "📋 Clipboard",
    "m_description": "Notification patti ka tile 4 (ya home shortcut): copy ki hui cheezon ki list — tap = copy, phir paste. ➕ likh kar save · 📌 pakka · 🗑 hatao · 🧹 saaf. Pehli dafa Shizuku se khud-copy ki ijazat leta hai. Sab sirf phone mein. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("oA"), lvar("oS"), lvar("rk", 2), lvar("a1", 2), lvar("md", 2), lvar("rr", 2), lvar("hm", 2), lvar("g0", 2), lvar("g1", 2),
                       lvar("rj", 2), lvar("rn", 2), DIC("ra"), DIC("rb")],
    "m_triggerList": [tile(T1, 3, "📋 Clipboard", "Copy / paste"), {"m_classType": "ShortcutTrigger", "m_SIGUID": T2}],
    "m_actionList": tile_acts},
    "globalVariables": GV, "userIcons": None}

cap_acts = [
    sv("ct", "{clipboard}"),
    java(CAP, "cr"),
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "cpR", "m_type": 1, "isLocalVar": False}, "m_intExpression": True, "m_expression": "{lv=cr}"},
]
CC = {"macroExportVersion": 1, "macro": {
    "m_name": "📋 Clipboard yaad",
    "m_description": "Jo bhi copy karein wo khud 📋 Clipboard tile ki list mein (aakhri %d). Bank app saamne ho / sirf 4-8 hindse (OTP) / bohat lamba = nahi. Koi paigham nahi. Sab sirf phone mein. AI nahi." % MAXU,
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("ct", 2), lvar("cr", 2)],
    "m_triggerList": [{"m_classType": "ClipboardChangeTrigger", "m_SIGUID": T3, "m_text": "", "enableRegex": False, "isConfigured": False, "ignoreCase": True}],
    "m_actionList": cap_acts,
    "m_constraintList": [notBank()]},
    "globalVariables": GV, "userIcons": None}

if __name__ == '__main__':
    json.dump(CT, open(os.path.join(D, 'clip.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(CC, open(os.path.join(D, 'clipcap.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('clip ok', len(tile_acts), len(cap_acts))
