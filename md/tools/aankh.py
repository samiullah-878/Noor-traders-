# 👁 Aankh ka aram (malik 25 Nov 2026: 6 mashwaron mein se "only 1" — 10 Nov ko nazar ke liye brightness wala maanga tha, bana nahi tha)
#   Shaam 7 se subah 7 tak: Eye Comfort / Night Light (Secure night_display_activated = 1) + dark theme + brightness AUTO.
#   Subah 7 ke baad: sab WAHI jo raat se pehle tha (pehle ki haalat globals akNd0 / akBm0 / akUi0 mein yaad) — 'normal' = malik ki apni setting.
#   Sirf BADLAAV ke waqt chalta hai (akOn 0 -> 1 / 1 -> 0): raat ko malik khud kuch band kare to har 5 min zabardasti dobara NAHI.
#   Dark theme sirf tab jab phone pehle LIGHT (getNightMode 1) par tha — auto / schedule (0 / 3) ya pehle se dark (2) ko nahi chherta.
#   akNd = likhne ke baad night_display_activated ki qeemat (export mein nazar aata — 1 = setting lagi; -2 = parh nahi saka).
#   OnePlus (ColorOS) ka Eye Comfort shayad AOSP Night Light wali setting na sune — tab sirf dark + auto brightness; malik se poochho screen peeli hui?
#   Koi paigham / toast nahi. Nayi ijazat nahi (Ghari / Animation pehle se Settings likhte hain). AI nahi. Waqt badalna = NIGHT_FROM / NIGHT_TO.
import json, os
from cb import iff, END, lvar, var
D = os.path.dirname(os.path.abspath(__file__))
NIGHT_FROM, NIGHT_TO = 19, 7
AKJ = '\n'.join([
 'import android.provider.Settings;',
 'int gi(String k, int d) {',
 '  try { String s = magicText.evaluateString("{" + "v=" + k + "}"); return Integer.parseInt(s.trim()); } catch (Throwable e) { return d; }',
 '}',
 'try {',
 '  cr = appContext.getContentResolver();',
 '  int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);',
 '  boolean night = h >= %d || h < %d;' % (NIGHT_FROM, NIGHT_TO),
 '  int on = gi("akOn", 0);',
 '  if (night && on != 1) {',
 '    int nd = 0; try { nd = Settings.Secure.getInt(cr, "night_display_activated", 0); } catch (Throwable e1) { }',
 '    int bm = 1; try { bm = Settings.System.getInt(cr, "screen_brightness_mode", 1); } catch (Throwable e2) { }',
 '    int ui = 1; try { ui = ((android.app.UiModeManager) appContext.getSystemService("uimode")).getNightMode(); } catch (Throwable e3) { }',
 '    variableSetter.setInt("akNd0", nd); variableSetter.setInt("akBm0", bm); variableSetter.setInt("akUi0", ui);',
 '    try { Settings.Secure.putInt(cr, "night_display_activated", 1); } catch (Throwable e4) { }',
 '    try { Settings.System.putInt(cr, "screen_brightness_mode", 1); } catch (Throwable e5) { }',
 '    int rb = -2; try { rb = Settings.Secure.getInt(cr, "night_display_activated", -1); } catch (Throwable e6) { }',
 '    variableSetter.setInt("akNd", rb);',
 '    variableSetter.setInt("akOn", 1);',
 '    return ui == 1 ? "n" : "x";',
 '  }',
 '  if (!night && on == 1) {',
 '    int nd = gi("akNd0", 0); int bm = gi("akBm0", 1); int ui = gi("akUi0", 1);',
 '    try { Settings.Secure.putInt(cr, "night_display_activated", nd); } catch (Throwable e7) { }',
 '    try { Settings.System.putInt(cr, "screen_brightness_mode", bm); } catch (Throwable e8) { }',
 '    variableSetter.setInt("akOn", 0);',
 '    return ui == 1 ? "d" : "x";',
 '  }',
 '  return "x";',
 '} catch (Throwable e) { return "err"; }'])

def streq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True},
                         "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
def dark(o): return {"m_classType": "DarkThemeAction", "m_SIGUID": 0, "option": o}
acts = [
    {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": AKJ, "blockNextAction": True, "responseVariableName": "ak", "runInBackgroundThread": True},
    iff([streq("ak", "n")]), dark(0), END,
    iff([streq("ak", "d")]), dark(1), END,
]
AK = {"macroExportVersion": 1, "macro": {
    "m_name": "👁 Aankh ka aram",
    "m_description": "Shaam 7 se subah 7 tak: peeli roshni (Eye Comfort / Night Light) + dark theme + brightness auto. Subah sab wapas pehle jaisa. Raat ko khud band karein to dobara zabardasti nahi. Koi paigham nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("ak", 2)],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": 112233445567801, "m_seconds": 300, "m_useAlarm": False},
        {"m_classType": "ScreenOnOffTrigger", "m_SIGUID": 112233445567802, "m_screenOn": True},
        {"m_classType": "BootTrigger", "m_SIGUID": 112233445567803},
        {"m_classType": "MacroEnabledTrigger", "m_SIGUID": 112233445567804}],
    "m_actionList": acts},
    "globalVariables": [var("akOn"), var("akNd0"), var("akBm0"), var("akUi0"), var("akNd")], "userIcons": None}

if __name__ == '__main__':
    json.dump(AK, open(os.path.join(D, 'aankh.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('aankh ok', len(acts))
