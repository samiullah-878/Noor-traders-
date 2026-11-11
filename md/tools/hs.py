# 📶 Hotspot popup band (malik 11 Nov 2026: screenshot — phone ka apna "Turning off personal hotspot can extend battery life · Turn off" popup
#   app ke upar aa jata hai (hotspot par 5 device, dukan ka kaam). "power saving ka hotspot off karne wala khatam karo").
#   Popup dikhe = Back (popup hat jata hai, hotspot CHALU rehta hai). Hotspot ko hum kabhi band nahi karte. Koi paigham nahi. AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
HS = {"macroExportVersion": 1, "macro": {
    "m_name": "📶 Hotspot popup band",
    "m_description": "Phone ka 'Turning off personal hotspot can extend battery life' popup aate hi khud hata deta hai (Back) — hotspot chalu rehta hai. Koi paigham nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [],
    "m_triggerList": [{"m_classType": "ScreenContentTrigger", "m_SIGUID": 112233445566551, "textToMatch": "personal hotspot can extend battery",
                       "ignoreCase": True, "enableRegex": False, "matchOption": 0, "includeOverlays": True, "packageNameList": [], "appNameList": []}],
    "m_actionList": [{"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 1, "m_useAlarm": False},
                     {"m_classType": "PressBackAction", "m_SIGUID": 0}],
    "m_constraintList": []},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(HS, open(os.path.join(D, 'hs.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('hs ok')
