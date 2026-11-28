# 📞 Khaas contacts (malik 20 Nov 2026: "kuch contacts ki call par volume itna ho jaye · contacts main khud chunoon ga · 20 percent"
#   → phir: "main call karun to bhi kam · WhatsApp par bhi · aur in numbers ki silent mein bhi call aaye volume full" — wahi 20% wale contacts).
#   KV '📞 Khaas log · SIM call · ghanti poori' (purane v59 macro ka WAHI GUID): chune contact ki call AAYE = phone silent / vibrate / DND ho tab bhi ghanti 100%;
#      call khatam / miss = pehle wala volume + pehle wala mode (silent / vibrate / DND) wapas.
#   KB '📞 Khaas log · SIM call · baat dheemi' (naya): chune contact se baat shuru (aane wali YA apni, CallActive) = call ki awaaz (VoiceCall) 20%; khatam = pehle wali.
#      WhatsApp: 'Ongoing … call' notification ka title (contact ka naam) malik phone par trigger mein likhta hai (NAAM1|NAAM2 ki jagah, | se alag).
#   CONTACTS / NAAM KHALI: naam / number md/ (PUBLIC) mein KABHI nahi — malik phone par khud chunta / likhta hai.
#   ⚠️ pkg.py ONCE: har pkg update Overwrite by ID karta hai — yeh macros sirf apne version (v60) mein, warna malik ke chune contacts mit jayenge.
#   Asal phone par nahi azmaya: silent mein beech ghanti chalu ho jaye, {vol_ring}/{vol_call} % hon, WhatsApp ki awaaz VoiceCall par ho. AI nahi.
import json, os
from cb import trig, iff, END, ELSE, lt, gt, lvar
D = os.path.dirname(os.path.abspath(__file__))
T1 = 112233445566801                       # KV: IncomingCall
B1, B2, B3 = 112233445566811, 112233445566812, 112233445566813   # KB: CallActive · WhatsApp ongoing · boot
W = [112233445566802, 112233445566803, 112233445566814, 112233445566815]   # wait ke andar ke triggers (fix() inhein nahi chhoota)
WA = ["com.whatsapp", "com.whatsapp.w4b"]; WAN = ["WhatsApp", "WA Business"]
def lv(n): return {"m_name": n, "m_type": 1, "isLocalVar": True}
def si(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv(n), "m_newIntValue": v}
def se(n, e): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv(n), "m_intExpression": True, "m_expression": e}
def vol(i, v): a = [False] * 8; a[i] = True; b = [0] * 8; b[i] = v; return {"m_classType": "SetVolumeAction", "m_SIGUID": 0, "m_streamIndexArray": a, "m_streamVolumeArray": b, "m_volume": -1}
def volv(i, n): x = vol(i, 0); x["m_variables"] = [None] * 8; x["m_variables"][i] = lv(n); return x
RING, CALL = 3, 5                           # [Alarm, Music, Notification, Ringer, System, VoiceCall, BluetoothVoice, Accessibility]
def vmode(o): return {"m_classType": "VolumeConstraint", "m_SIGUID": 0, "m_option": o}
def dnd(i): return {"m_classType": "PriorityModeConstraint", "m_SIGUID": 0, "m_selectedIndex": i, "m_inMode": True}
def setdnd(o): return {"m_classType": "SetPriorityMode", "m_SIGUID": 0, "m_option": o}
def eq(n, v): return [gt(n, v - 1, True), lt(n, v + 1, True)]
def wait(trs, sec): return {"m_classType": "WaitUntilTriggerAction", "m_SIGUID": 0, "triggersToWaitFor": trs, "timeoutSeconds": sec, "timeoutEnabled": True, "continueOnTimeout": True}
def callAny(cls, s): return {"m_classType": cls, "m_SIGUID": s, "m_option": 3}

# ---------- KV: ghanti full (silent mein bhi) ----------
kv = [si("md", 0), si("dn", 0),
      iff([vmode(1)]), si("md", 1), END,
      iff([vmode(2)]), si("md", 2), END,
      iff([dnd(1)]), si("dn", 1), END,
      iff([dnd(2)]), si("dn", 2), END,
      iff([dnd(3)]), si("dn", 3), END,
      iff([gt("dn", 0, True)]), setdnd(0), END,
      se("oldr", "{vol_ring}"),
      {"m_classType": "SetVibrateAction", "m_SIGUID": 0, "m_optionInt": 1},
      vol(RING, 100),
      wait([callAny("CallEndedTrigger", W[0]), callAny("CallMissedTrigger", W[1])], 600),
      volv(RING, "oldr"),
      iff(eq("md", 1)), {"m_classType": "SetVibrateAction", "m_SIGUID": 0, "m_optionInt": 0}, END,
      iff([gt("md", 1, True)]), {"m_classType": "SilentModeVibrateOffAction", "m_SIGUID": 0, "option": 0, "mechanism": 0}, END,
      iff(eq("dn", 1)), setdnd(1), END,
      iff(eq("dn", 2)), setdnd(2), END,
      iff([gt("dn", 2, True)]), setdnd(3), END]
KV = {"macroExportVersion": 1, "macro": {
    "m_name": "📞 Khaas log · SIM call · ghanti poori",
    "m_description": "Chune hue contacts ki call aaye to phone silent / vibrate / DND par ho tab bhi ghanti 100%; call khatam ya miss hote hi pehle wala volume aur mode wapas. Contacts: 'Incoming call' trigger par tap kar ke khud chunein (abhi khali — koi call nahi chhedi jati).",
    "m_GUID": 0, "m_enabled": True, "m_completed": True, "aiGenerated": 0, "m_category": "Claude",
    "m_triggerList": [{"m_classType": "IncomingCallTrigger", "m_SIGUID": T1, "m_option": 0, "m_incomingCallFromList": []}],
    "m_actionList": kv, "m_constraintList": [],
    "localVariables": [lvar("oldr"), lvar("md"), lvar("dn")]},
    "globalVariables": [], "userIcons": None}

# ---------- KB: baat ki awaaz 20% (SIM + WhatsApp) ----------
waOn = {"m_classType": "NotificationTrigger", "m_SIGUID": B2, "m_option": 0, "m_packageNameList": WA, "m_applicationNameList": WAN, "m_excludeApps": False,
        "separateTitleAndMessage": True, "matchOptionTitle": 2, "titleContent": "NAAM1|NAAM2", "matchOptionMessage": 2, "messageContent": "ongoing",
        "enableRegex": True, "ignoreCase": True, "m_ignoreOngoing": False, "m_supressMultiples": True, "m_soundOption": 0}
waOff = {"m_classType": "NotificationTrigger", "m_SIGUID": W[3], "m_option": 1, "m_packageNameList": WA, "m_applicationNameList": WAN, "m_excludeApps": False,
         "separateTitleAndMessage": True, "matchOptionTitle": 0, "matchOptionMessage": 2, "messageContent": "ongoing",
         "enableRegex": False, "ignoreCase": True, "m_ignoreOngoing": False, "m_supressMultiples": False, "m_soundOption": 0}
kb = [iff([trig(B3, "Boot")]), si("on", 0),
      ELSE,
      iff([lt("on", 1, True)]), si("on", 1),
      se("oldc", "{vol_call}"),
      vol(CALL, 20),
      iff([trig(B1, "Call active")]), wait([callAny("CallEndedTrigger", W[2])], 14400),
      ELSE, wait([waOff], 14400), END,
      volv(CALL, "oldc"), si("on", 0),
      END,
      END]
KB = {"macroExportVersion": 1, "macro": {
    "m_name": "📞 Khaas log · SIM call · baat dheemi",
    "m_description": "Chune hue contacts se baat shuru hote hi (call aap ki ho ya un ki) call ki awaaz 20%; call khatam = pehle wali awaaz. Contacts: 'Call active' trigger par tap kar ke chunein. WhatsApp: 'Notification' trigger ke Title mein NAAM1|NAAM2 ki jagah contacts ke naam likhein (WhatsApp mein jaise save hain, | se alag).",
    "m_GUID": 0, "m_enabled": True, "m_completed": True, "aiGenerated": 0, "m_category": "Claude",
    "m_triggerList": [{"m_classType": "CallActiveTrigger", "m_SIGUID": B1, "m_option": 0, "m_contactList": []}, waOn,
                      {"m_classType": "BootTrigger", "m_SIGUID": B3}],
    "m_actionList": kb, "m_constraintList": [],
    "localVariables": [lvar("oldc"), lvar("on")]},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(KV, open(os.path.join(D, 'khaasvol.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(KB, open(os.path.join(D, 'khaasbaat.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('khaas ok', len(kv), len(kb))
