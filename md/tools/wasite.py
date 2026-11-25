# 💬 WhatsApp bina save + 🌐 Koi bhi site (malik 25 Nov 2026: "Whtsapp pr SMS bajhna without number saving · koi bi site kholna" — template wale chal nahi rahe; plan OK)
#   💬: Quick Settings tile 1 (ya home shortcut) -> popup mein number (likho / paste) -> WhatsApp mein usi number ki chat khulti hai, paigham wahin likh kar Send malik khud.
#       Number ki shakal Java khud theek karta hai: 0300-1234567 / 3001234567 / +92 300… / 0092… / +92 0300… -> 923001234567; bahar ka (+966…) waise hi.
#       Pehle aam WhatsApp (com.whatsapp), na ho to Business (com.whatsapp.w4b), dono na hon to wa.me browser mein.
#       🌙 Raat 12-11 band + 📸 Sehat lock MacroDroid ki khirki ko Home kar dete hain (askAge > 20) — popup ke dauran sbAsk / shAsk = abhi + 40
#       (60 s chhoot), popup ke baad PURANI qeemat wapas (cancel par bhi — StopAfterCancel false), taake chhoot sirf popup tak rahe.
#   🌐: Quick Settings tile 2 (ya home shortcut) -> Firefox Focus (org.mozilla.focus — band karte hi history khud saaf) khulta hai, upar site / search likho.
#       Focus na ho to google.com aam browser mein. Koi MacroDroid popup nahi (raat-band se takrao nahi).
#   Koi chaabi / number repo mein nahi (md/ PUBLIC). Toast sirf ghalat number par. AI nahi. Phone par azmaya nahi.
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

def inst(pk): return {"m_classType": "ApplicationInstalledConstraint", "m_SIGUID": 0, "packageName": pk}
def wa_open(pk): return {"m_classType": "SendIntentAction", "m_SIGUID": 0, "m_target": "Activity", "m_action": "android.intent.action.VIEW",
                         "m_data": "https://api.whatsapp.com/send?phone={lv=wn}", "m_packageName": pk, "m_flags": 268435456}
def tile(sig, i, label, sub): return {"m_classType": "QuickSettingsTileTrigger", "m_SIGUID": sig, "m_tileOption": i, "quickTileLabel": label,
                                      "quickTileSubtitle": sub, "quickTileIsToggle": False, "quickTileIsCollapseOnPress": True}
PAUSE2 = {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 2, "m_useAlarm": False}

wa_acts = [
    expr("oA", "{v=sbAsk}", True), expr("oS", "{v=shAsk}", True),      # purani qeemat yaad
    expr("sbAsk", NOW + "+40"), expr("shAsk", NOW + "+40"),            # popup ke 60 s: raat-band / sehat lock Home na karein
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "num", "m_type": 2, "isLocalVar": True}, "m_newStringValue": ""},
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "num", "m_type": 2, "isLocalVar": True}, "m_userPrompt": True,
     "m_userPromptTitle": "💬 WhatsApp — bina save", "m_userPromptMessage": "Number likhein ya paste karein (0300… ya +92…). OK = WhatsApp mein chat khulegi.",
     "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": False, "m_userPromptEmptyAtStart": True},
    {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": WAJ, "blockNextAction": True, "responseVariableName": "wn", "runInBackgroundThread": False},
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
    expr("sbAsk", "{lv=oA}"), expr("shAsk", "{lv=oS}"),               # chhoot khatam (cancel par bhi)
]
WA = {"macroExportVersion": 1, "macro": {
    "m_name": "💬 WhatsApp bina save",
    "m_description": "Notification patti ka tile 1 (ya home shortcut): number likho / paste karo -> WhatsApp mein us number ki chat khul jati hai, number save kiye baghair. Paigham wahin likh kar Send aap khud. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("num", 2), lvar("wn", 2), lvar("oA"), lvar("oS")],
    "m_triggerList": [tile(T1, 0, "💬 WhatsApp", "Bina save"), {"m_classType": "ShortcutTrigger", "m_SIGUID": T2}],
    "m_actionList": wa_acts},
    "globalVariables": [var("sbAsk"), var("shAsk")], "userIcons": None}

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
