# 💬 WhatsApp bina save + 🌐 Koi bhi site (malik 25 Nov 2026: "Whtsapp pr SMS bajhna without number saving · koi bi site kholna" — template wale chal nahi rahe; plan OK)
#   💬: Quick Settings tile 1 (ya home shortcut) -> popup mein number (likho / paste) -> WhatsApp mein usi number ki chat khulti hai, paigham wahin likh kar Send malik khud.
#       Number ki shakal Java khud theek karta hai: 0300-1234567 / 3001234567 / +92 300… / 0092… / +92 0300… -> 923001234567; bahar ka (+966…) waise hi.
#       Pehle aam WhatsApp (com.whatsapp), na ho to Business (com.whatsapp.w4b), dono na hon to wa.me browser mein.
#       🌙 Raat 12-11 band + 📸 Sehat lock MacroDroid ki khirki ko Home kar dete hain (askAge > 20) — popup ke dauran sbAsk / shAsk = abhi + 40
#       (60 s chhoot), popup ke baad PURANI qeemat wapas (cancel par bhi — StopAfterCancel false), taake chhoot sirf popup tak rahe.
#   🌐: Quick Settings tile 2 (ya home shortcut) -> Firefox Focus (org.mozilla.focus — band karte hi history khud saaf) khulta hai, upar site / search likho.
#       Focus na ho to google.com aam browser mein. Koi MacroDroid popup nahi (raat-band se takrao nahi).
#   Koi chaabi / number repo mein nahi (md/ PUBLIC). Toast sirf ghalat number par. AI nahi. Phone par azmaya nahi.
#   v89 (27 Nov raat, malik: 'Isi 💬 tile ke popup mein' — naye unsaved number kahan nazar aayein): 💬 tile dabao -> agar cnsave.py ki list (global cnList,
#     aakhri 5) mein naye number hon to PEHLE ek list: har number ki do lines '📇 Save karo · 0319 …' (tap = phone ki 'Naya contact' screen number bhar kar
#     + list se hata) aur '💬 WhatsApp · 0319 …' (tap = usi number ki WhatsApp chat), aakhir mein '✍️ Koi aur number likhein' (purana khana). List khali =
#     seedha purana khana. Save ho gaya (PhoneLookup) / 3 din purana = list se khud hat. Keys n<i><a|b><hindse> (alfabet = tarteeb), number key mein hi.
import json, os
from cb import iff, END, ELSE, expr, lvar, var, NOW, strne
D = os.path.dirname(os.path.abspath(__file__))
def streq(n, v, local=False): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": local}, "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
def toast(t): return {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": t, "m_duration": 2, "m_position": 1, "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True}
T1, T2, T3, T4 = 112233445567601, 112233445567602, 112233445567603, 112233445567604

# Java: popup ka likha -> sirf hindse (WhatsApp ki shakal). "" = kuch nahi likha / cancel · "x" = number samajh nahi aaya.
#   Regex mein { } nahi (scriptText magic text hai) — "{" + "lv=num}" ka tod bhi isi wajah se.
WAJ = '\n'.join([
 'try {',
 '  String s = magicText.evaluateString("{" + "lv=num}");',
 '  if (s == null) s = "";',
 '  s = s.trim();',
 '  if (s.length() == 0) return "";',
 '  java.util.regex.Matcher m = java.util.regex.Pattern.compile("([+]|00)?[0-9][0-9 ().-]*[0-9]").matcher(s);',
 '  String t = null;',
 '  while (m.find()) { String g = m.group(); if (g.replaceAll("[^0-9]", "").length() >= 10) { t = g; break; } }',
 '  if (t == null) return "x";',
 '  boolean intl = t.startsWith("+") || t.startsWith("00");',
 '  String d = t.replaceAll("[^0-9]", "");',
 '  if (t.startsWith("00")) d = d.substring(2);',
 '  if (!intl) {',
 '    if (d.startsWith("0")) d = "92" + d.substring(1);',
 '    else if (d.length() == 10 && d.startsWith("3")) d = "92" + d;',
 '  }',
 '  if (d.startsWith("920") && d.length() == 13) d = "92" + d.substring(3);',
 '  if (d.length() < 10 || d.length() > 15) return "x";',
 '  return d;',
 '} catch (Throwable e) { return "x"; }'])

# v89 Java: naye number ki list (prune: save ho gaye / 3 din) -> SelectionDialog ka JSON. "" = koi naya number nahi.
CN_AGE = 3 * 86400000
CNL = '\n'.join([
 'try {',
 '  String L = magicText.evaluateString("{" + "v=cnList}"); if (L == null) L = "";',
 '  String[] la = L.split("\\n"); long now = System.currentTimeMillis();',
 '  java.util.ArrayList kp = new java.util.ArrayList();',
 '  for (int i = 0; i < la.length; i++) {',
 '    String z = la[i].trim(); if (z.length() == 0) continue;',
 '    String[] f = z.split("[|]"); if (f.length < 4) continue;',
 '    long ms = 0; try { ms = Long.parseLong(f[3].trim()); } catch (Throwable e2) { ms = 0; }',
 '    if (now - ms > %dL) continue;' % CN_AGE,
 '    boolean sv = false;',
 '    try {',
 '      String[] cols = new String[1]; cols[0] = "_id";',
 '      android.net.Uri u = android.net.Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(f[0]));',
 '      android.database.Cursor cu = appContext.getContentResolver().query(u, cols, null, null, null);',
 '      if (cu != null) { sv = cu.getCount() > 0; cu.close(); }',
 '    } catch (Throwable e3) { }',
 '    if (sv) continue;',
 '    kp.add(z);',
 '  }',
 '  StringBuilder lk = new StringBuilder();',
 '  for (int i = 0; i < kp.size(); i++) { if (i > 0) lk.append("\\n"); lk.append((String) kp.get(i)); }',
 '  if (!lk.toString().equals(L.trim())) variableSetter.setString("cnList", lk.toString(), 2);',
 '  if (kp.size() == 0) return "";',
 '  String LB = String.valueOf((char) 123), RB = String.valueOf((char) 125), Q = String.valueOf((char) 34);',
 '  StringBuilder sb = new StringBuilder(LB); int n = 0;',
 '  for (int i = kp.size() - 1; i >= 0 && n < 9; i--) {',
 '    String[] f = ((String) kp.get(i)).split("[|]");',
 '    String dg = f[0].replaceAll("[^0-9]", ""); if (dg.length() < 8) continue;',
 '    String sh = f[1].replace(Q, "").trim(); String src = f[2].trim().equals("w") ? "WhatsApp" : "Call";',
 '    n++;',
 '    sb.append(Q + "n" + n + "a" + dg + Q + ":" + Q + "📇 Save karo · " + sh + "  (" + src + ")" + Q + ",");',
 '    sb.append(Q + "n" + n + "b" + dg + Q + ":" + Q + "💬 WhatsApp · " + sh + Q + ",");',
 '  }',
 '  if (n == 0) return "";',
 '  sb.append(Q + "z" + Q + ":" + Q + "✍️ Koi aur number likhein" + Q).append(RB);',
 '  return sb.toString();',
 '} catch (Throwable e) { return ""; }'])
# v89 Java: chuni line. "c" = kuch nahi / back · "z" = khana kholo · "s" = Naya contact screen khuli · hindse = WhatsApp usi number par.
CNP = '\n'.join([
 'try {',
 '  String k = magicText.evaluateString("{" + "lv=rk}"); if (k == null) k = ""; k = k.trim();',
 '  if (k.length() == 0) return "c";',
 '  if (k.equals("z")) return "z";',
 '  if (!k.matches("n[0-9][ab][0-9]+")) return "c";',
 '  String dg = k.substring(3);',
 '  if (k.substring(2, 3).equals("b")) return dg;',
 '  String plus = "+" + dg;',
 '  android.content.Intent it = new android.content.Intent("android.intent.action.INSERT");',
 '  it.setType("vnd.android.cursor.dir/raw_contact");',
 '  it.putExtra("phone", plus);',
 '  it.putExtra("finishActivityOnSaveCompleted", true);',
 '  it.addFlags(268435456);',
 '  appContext.startActivity(it);',
 '  String L = magicText.evaluateString("{" + "v=cnList}"); if (L == null) L = "";',
 '  String[] la = L.split("\\n"); StringBuilder lk = new StringBuilder();',
 '  for (int i = 0; i < la.length; i++) { String z = la[i].trim(); if (z.length() == 0 || z.startsWith(plus + "|")) continue; if (lk.length() > 0) lk.append("\\n"); lk.append(z); }',
 '  variableSetter.setString("cnList", lk.toString(), 2);',
 '  try { int t = 0; try { t = Integer.parseInt(magicText.evaluateString("{" + "v=cnTp}").trim()); } catch (Throwable e1) { t = 0; } variableSetter.setInt("cnTp", t + 1); } catch (Throwable e2) { }',
 '  return "s";',
 '} catch (Throwable e) { return "c"; }'])
import re as _re
for _j in (WAJ, CNL, CNP):
    assert not _re.search(r'\{(?![\s"])', _j), ('magic text jaisa {', _j)

def inst(pk): return {"m_classType": "ApplicationInstalledConstraint", "m_SIGUID": 0, "packageName": pk}
def wa_open(pk): return {"m_classType": "SendIntentAction", "m_SIGUID": 0, "m_target": "Activity", "m_action": "android.intent.action.VIEW",
                         "m_data": "https://api.whatsapp.com/send?phone={lv=wn}", "m_packageName": pk, "m_flags": 268435456}
def tile(sig, i, label, sub): return {"m_classType": "QuickSettingsTileTrigger", "m_SIGUID": sig, "m_tileOption": i, "quickTileLabel": label,
                                      "quickTileSubtitle": sub, "quickTileIsToggle": False, "quickTileIsCollapseOnPress": True}
PAUSE2 = {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 2, "m_useAlarm": False}

def sv(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
def java(src, res): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": src, "blockNextAction": True, "responseVariableName": res, "runInBackgroundThread": False}
INK = -15658735
PICK = {"m_classType": "SelectionDialogAction", "m_SIGUID": 0, "option": 1, "dictionaryVarName": "ra",
        "message": "<b>📇 Naye number</b> (call / WhatsApp — save nahi)<br><small>Save karo = naam likh kar Save · WhatsApp = chat khulegi</small>",
        "htmlFormat": True, "textColor": INK, "bgColor": -1, "buttonStyle": 3,
        "saveKeyVariable": {"variableName": "rk"}, "preventBackButtonClose": False, "continueMacroOnBackPress": True,
        "showDictionaryKeys": False, "hasDefault": False}
wa_acts = [
    expr("oA", "{v=sbAsk}", True), expr("oS", "{v=shAsk}", True),      # purani qeemat yaad
    expr("sbAsk", NOW + "+100"), expr("shAsk", NOW + "+100"),          # v89: list + khana dono popup ke dauran raat-band / sehat lock Home na karein
    sv("num", ""), sv("wn", ""), sv("rk", ""), sv("pk", "z"),
    java(CNL, "rj"),                                                   # v89: naye number ki list (khali = seedha khana)
    iff([strne("rj", "", True)]),
      {"m_classType": "JsonParseAction", "m_SIGUID": 0, "stringVarName": "rj", "dictionaryVarName": "ra", "parseColors": False},
      PICK,
      java(CNP, "pk"),                                                 # c / z / s / hindse
    END,
    iff([streq("pk", "z", True)]),
      {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "num", "m_type": 2, "isLocalVar": True}, "m_userPrompt": True,
       "m_userPromptTitle": "💬 WhatsApp — bina save", "m_userPromptMessage": "Number likhein ya paste karein (0300… ya +92…). OK = WhatsApp mein chat khulegi.",
       "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": False, "m_userPromptEmptyAtStart": True},
      java(WAJ, "wn"),
    ELSE,
      iff([strne("pk", "c", True), strne("pk", "s", True)]), sv("wn", "{lv=pk}"), END,
    END,
    iff([streq("wn", "x", True)]),
      toast("❌ Number samajh nahi aaya — dobara 💬 dabayein"),
    ELSE,
      iff([strne("wn", "", True)]),
        iff([inst("com.whatsapp")]), wa_open("com.whatsapp"),
        ELSE,
          iff([inst("com.whatsapp.w4b")]), wa_open("com.whatsapp.w4b"),
          ELSE, {"m_classType": "OpenWebPageAction", "m_SIGUID": 0, "m_urlToOpen": "https://wa.me/{lv=wn}", "m_httpGet": False, "m_disableUrlEncode": True},
          END,
        END,
        PAUSE2,                                                          # WhatsApp saamne aa jaye, phir chhoot khatam
      END,
    END,
    iff([streq("pk", "s", True)]), PAUSE2, END,                       # v89: Naya contact screen saamne aa jaye
    expr("sbAsk", "{lv=oA}"), expr("shAsk", "{lv=oS}"),               # chhoot khatam (cancel par bhi)
]
WA = {"macroExportVersion": 1, "macro": {
    "m_name": "💬 WhatsApp bina save",
    "m_description": "Notification patti ka tile 1 (ya home shortcut): pehle naye unsaved number (call / WhatsApp) ki list — 📇 Save karo (Naya contact screen) ya 💬 WhatsApp; aakhir mein ✍️ koi aur number likhein / paste karein -> WhatsApp mein us number ki chat, number save kiye baghair. Paigham wahin likh kar Send aap khud. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("num", 2), lvar("wn", 2), lvar("oA"), lvar("oS"), lvar("rj", 2), lvar("rk", 2), lvar("pk", 2), {"m_name": "ra", "m_type": 4, "isLocalVar": True, "m_stringValue": ""}],
    "m_triggerList": [tile(T1, 0, "💬 WhatsApp", "Bina save"), {"m_classType": "ShortcutTrigger", "m_SIGUID": T2}],
    "m_actionList": wa_acts},
    "globalVariables": [var("sbAsk"), var("shAsk"), var("cnList", 2), var("cnTp")], "userIcons": None}

site_acts = [
    iff([inst("org.mozilla.focus")]),
      {"m_classType": "LaunchActivityAction", "m_SIGUID": 0, "option": 1, "m_packageToLaunch": "org.mozilla.focus", "m_applicationName": "Firefox Focus",
       "m_startNew": False, "m_excludeFromRecents": False},
    ELSE,
      {"m_classType": "OpenWebPageAction", "m_SIGUID": 0, "m_urlToOpen": "https://www.google.com", "m_httpGet": False, "m_disableUrlEncode": True},
    END,
]
SITE = {"macroExportVersion": 1, "macro": {
    "m_name": "🌐 Koi bhi site",
    "m_description": "Notification patti ka tile 2 (ya home shortcut): Firefox Focus khulta hai — upar koi bhi site ya search likho; Focus band = history khud saaf. Focus na ho to google.com. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [],
    "m_triggerList": [tile(T3, 1, "🌐 Site", "Koi bhi site"), {"m_classType": "ShortcutTrigger", "m_SIGUID": T4}],
    "m_actionList": site_acts},
    "globalVariables": [], "userIcons": None}

if __name__ == '__main__':
    json.dump(WA, open(os.path.join(D, 'wa.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(SITE, open(os.path.join(D, 'site.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('wasite ok', len(wa_acts), len(site_acts))
