# 🔊 Waleed Bhai (malik 6 Nov 2026): har 10 min bole "Waleed bhai uth kar le lo … pudi" — raat 12 par khud band, phir kabhi nahi
import json, os, copy
D = os.path.dirname(os.path.abspath(__file__))
from v3 import trig, iff, END, ELSE, INCALL, WACALL, speak, toast
NAME = "🔊 Waleed Bhai"
T_TICK, T_MID = 112233445566771, 112233445566772
NIGHT = {"m_classType": "TimeOfDayConstraint", "m_SIGUID": 0, "m_startHour": 0, "m_startMinute": 0, "m_endHour": 0, "m_endMinute": 40}
OFF = {"m_classType": "DisableMacroAction", "m_SIGUID": 0, "m_state": 1, "getByName": True, "m_macroName": NAME}
acts = [
    iff([trig(T_MID, "Raat 12"), NIGHT], orc=True),
      toast("🔊 Waleed Bhai macro band — raat 12 ho gaye"),
      OFF,
    ELSE,
      speak("वलीद भाई, उठ कर ले लो … पुड़ी"),
      toast("🔊 Waleed bhai uth kar le lo … pudi", long=True),
    END,
]
out = {"macroExportVersion": 1, "macro": {
    "m_name": NAME,
    "m_description": "Har 10 minute bolta hai 'Waleed bhai uth kar le lo … pudi' (call ke dauran nahi). Raat 12:00 par khud BAND — dobara khud nahi chalta.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T_TICK, "m_seconds": 600, "m_useAlarm": True},
        {"m_classType": "TimerTrigger", "m_SIGUID": T_MID, "m_hour": 0, "m_minute": 0, "m_daysOfWeek": [True] * 7, "m_useAlarm": True}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [], "userIcons": None, "aiFeedback": "Ek din ka macro."}
json.dump(out, open(os.path.join(D, "waleed.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(acts))
