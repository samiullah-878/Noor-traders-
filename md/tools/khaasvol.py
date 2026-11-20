# 📞 Khaas contacts 20% (malik 20 Nov 2026: "kuch contacts ki call par volume itna ho jaye · contacts main khud chunoon ga · 20 percent")
#   Chune hue contacts ki call aaye = ringer 20%, call khatam / miss = pehle wala volume wapas (local oldv = {vol_ring}).
#   CONTACTS KHALI: malik phone par MacroDroid mein "Incoming call" trigger par tap kar ke khud chunta hai — naam / number md/ (PUBLIC) mein KABHI nahi.
#   ⚠️ pkg.py mein yeh SIRF EK DAFA (ONCE, v59) jata hai — har pkg update "Overwrite by ID" karta hai, dobara bheja to malik ke chune contacts mit jayenge.
#   AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
T1, W1, W2 = 112233445566801, 112233445566802, 112233445566803
STREAMS = [False, False, False, True, False, False, False, False]   # index 3 = Ringer
KV = {"macroExportVersion": 1, "macro": {
    "m_name": "📞 Khaas contacts 20%",
    "m_description": "Chune hue contacts ki call aaye to ringer volume 20%; call khatam ya miss hote hi pehle wala volume wapas. Contacts: 'Incoming call' trigger par tap kar ke khud chunein (abhi khali — koi call nahi chhedi jati).",
    "m_GUID": 0, "m_enabled": True, "m_completed": True, "aiGenerated": 0, "m_category": "Claude",
    "m_triggerList": [{"m_classType": "IncomingCallTrigger", "m_SIGUID": T1, "m_option": 0, "m_incomingCallFromList": []}],
    "m_actionList": [
        {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "oldv", "m_type": 1, "isLocalVar": True},
         "m_intExpression": True, "m_expression": "{vol_ring}"},
        {"m_classType": "SetVolumeAction", "m_SIGUID": 0, "m_streamIndexArray": STREAMS, "m_streamVolumeArray": [0, 0, 0, 20, 0, 0, 0, 0], "m_volume": -1},
        {"m_classType": "WaitUntilTriggerAction", "m_SIGUID": 0,
         "triggersToWaitFor": [{"m_classType": "CallEndedTrigger", "m_SIGUID": W1, "m_option": 3},
                               {"m_classType": "CallMissedTrigger", "m_SIGUID": W2, "m_option": 3}],
         "timeoutSeconds": 600, "timeoutEnabled": True, "continueOnTimeout": True},
        {"m_classType": "SetVolumeAction", "m_SIGUID": 0, "m_streamIndexArray": STREAMS, "m_streamVolumeArray": [0, 0, 0, 0, 0, 0, 0, 0], "m_volume": -1,
         "m_variables": [None, None, None, {"m_name": "oldv", "m_type": 1, "isLocalVar": True}, None, None, None, None]}],
    "m_constraintList": [],
    "localVariables": [{"m_name": "oldv", "m_type": 1, "m_intValue": 0, "isLocalVar": True}]},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(KV, open(os.path.join(D, 'khaasvol.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('khaasvol ok')
