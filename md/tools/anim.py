# ⚡ Animation tez (malik 14 Nov 2026: "system ki animation sahi nahi, un ko tez karna hai" -> 0.5x chuna).
#   Global window_animation_scale / transition_animation_scale / animator_duration_scale = 0.5 (Developer options wali teen settings).
#   🏦 Bank mode Developer options band karta hai -> phone inhein wapas 1 kar sakta hai: setting badalte hi + har 5 min + boot / chalu hote hi
#   Java dekhta hai, 0.5 na ho to wapas 0.5. Koi paigham / toast nahi. Nayi ijazat nahi (Bank mode / Ghari auto pehle se Settings.Global likhte hain). AI nahi.
#   Raftar badalni ho = SCALE.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
SCALE = "0.5"
FIX = "\n".join([
    'import android.provider.Settings;',
    'String r = "0";',
    'try {',
    '  cr = appContext.getContentResolver();',
    '  String[] ks = new String[] {"window_animation_scale", "transition_animation_scale", "animator_duration_scale"};',
    '  for (int i = 0; i < ks.length; i++) {',
    '    v = Settings.Global.getString(cr, ks[i]);',
    '    if (v == null || !v.equals("%s")) { Settings.Global.putString(cr, ks[i], "%s"); r = "1"; }' % (SCALE, SCALE),
    '  }',
    '} catch (Throwable t) {',
    '  r = "0";',
    '}',
    'return r;',
])
AN = {"macroExportVersion": 1, "macro": {
    "m_name": "⚡ Animation tez",
    "m_description": "Phone ki animations 0.5x (tez). Bank mode / koi aur inhein wapas 1x kare to khud dobara 0.5x. Koi paigham nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "fx", "m_type": 2, "m_stringValue": "0", "isLocalVar": True}],
    "m_triggerList": [
        {"m_classType": "SystemSettingTrigger", "m_SIGUID": 112233445567301, "systemEnabled": False, "globalEnabled": True, "secureEnabled": False,
         "regexEnabled": True, "settingPattern": ".*(animation|duration)_scale"},
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": 112233445567302, "m_seconds": 300, "m_useAlarm": False},
        {"m_classType": "MacroEnabledTrigger", "m_SIGUID": 112233445567303},
        {"m_classType": "BootTrigger", "m_SIGUID": 112233445567304}],
    "m_actionList": [{"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": FIX, "blockNextAction": True,
                      "responseVariableName": "fx", "runInBackgroundThread": True}],
    "m_constraintList": []},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(AN, open(os.path.join(D, 'anim.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('anim ok')
