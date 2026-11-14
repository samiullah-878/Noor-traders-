# 📶 Hotspot = saver band (malik 14 Nov 2026: "hotspot on ho to battery saver wala macro off ho jaye — is ko auto kar do").
#   Wajah: 'NT Battery Saver (WhatsApp, Chrome, Bank, Call, Claude)' apps khulne par battery saver lagata hai -> phone har dafa
#   "hotspot band karein, battery zyada chalegi" poochta hai (hotspot dukan ke kaam ka — kabhi band nahi).
#   Hotspot ON  = us macro ko band + battery saver hata do.   Hotspot OFF = macro wapas chalu.
#   Macro chalu hote hi / boot par bhi haal dekh kar wahi. Hotspot ko hum kabhi nahi chhote. Koi paigham / toast nahi. AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
NAME = "NT Battery Saver (WhatsApp, Chrome, Bank, Call, Claude)"
def sw(state): return {"m_classType": "DisableMacroAction", "m_SIGUID": 0, "m_state": state, "getByName": True, "m_macroName": NAME}
HSBS = {"macroExportVersion": 1, "macro": {
    "m_name": "📶 Hotspot = saver band",
    "m_description": "Hotspot ON ho to 'NT Battery Saver' macro khud band + battery saver hata; hotspot OFF = macro wapas chalu. Koi paigham nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [],
    "m_triggerList": [{"m_classType": "HotspotTrigger", "m_SIGUID": 112233445567201, "m_hotspotEnabled": True},
                      {"m_classType": "HotspotTrigger", "m_SIGUID": 112233445567202, "m_hotspotEnabled": False},
                      {"m_classType": "MacroEnabledTrigger", "m_SIGUID": 112233445567203},
                      {"m_classType": "BootTrigger", "m_SIGUID": 112233445567204}],
    "m_actionList": [{"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 2, "m_useAlarm": False},
                     {"m_classType": "IfConditionAction", "m_SIGUID": 0,
                      "m_constraintList": [{"m_classType": "WifiHotSpotConstraint", "m_SIGUID": 0, "m_enabled": True}]},
                     sw(1),
                     {"m_classType": "BatterySaverAction", "m_SIGUID": 0, "m_option": 1},
                     {"m_classType": "ElseAction", "m_SIGUID": 0},
                     sw(0),
                     {"m_classType": "EndIfAction", "m_SIGUID": 0}],
    "m_constraintList": []},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(HSBS, open(os.path.join(D, 'hsbs.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('hsbs ok')
