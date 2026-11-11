# 🌙 Raat ke sawal (malik 10–11 Nov 2026: "3-4-2 ... time mein khud lagao, wo mujhe pop dena start kar de 8 se le kar 10 ke darmiyan" · 11 Nov: "C" = koi app band NAHI, sirf popups).
#   20:30 roz  = 🌙 Raat ke 3 sawal (Itwar ko us ki jagah 🪞 Hafte ka aaina)
#   21:15 roz  = ☀️ Kal subah ka EK kaam
#   Roman Urdu, bari likhai, 2 min baad khud band. Koi app band nahi hoti, koi toast nahi. AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
H = lambda t, L: '<big><b>' + t + '</b></big><br><br>' + '<br><br>'.join(L)
RAAT = H('🌙 Raat ke 3 sawal', ['1. Aaj kaun sa kaam aisa kiya jo SIRF main kar sakta tha?', '2. Aaj kis kaam ne mera waqt khaya jo kisi aur ko dena chahiye tha?', '3. Aaj ghar walon ko main ne kya diya — waqt, ya sirf thakan?'])
HAFTA = H('🪞 Hafte ka aaina', ['1. Is hafte dukan mere baghair kitni chali?', '2. Kaun sa masla dobara aaya — us ki jar kya hai?', '3. Agle hafte kaun sa ek kaam CHHORNA hai?'])
SUBAH = H('☀️ Kal subah ka EK kaam', ['Kal ka sirf EK kaam chunein — jo ho jaye to din kamyab.', 'Usay abhi naam dein. Subah phone se pehle wohi.'])
q = lambda t: json.dumps(t, ensure_ascii=False)
JV = '\n'.join(['try {', '  java.util.Calendar c = java.util.Calendar.getInstance();', '  int h = c.get(java.util.Calendar.HOUR_OF_DAY);', '  int d = c.get(java.util.Calendar.DAY_OF_WEEK);',
                '  if (h >= 21) return ' + q(SUBAH) + ';', '  if (d == 1) return ' + q(HAFTA) + ';', '  return ' + q(RAAT) + ';', '} catch (Throwable t) {', '  return ' + q(RAAT) + ';', '}'])
tt = lambda sig, h, m: {"m_classType": "TimerTrigger", "m_SIGUID": sig, "m_hour": h, "m_minute": m, "m_daysOfWeek": [True] * 7, "m_useAlarm": True}
RT = {"macroExportVersion": 1, "macro": {
    "m_name": "🌙 Raat ke sawal",
    "m_description": "Raat 8:30 = Raat ke 3 sawal (Itwar: Hafte ka aaina) · 9:15 = Kal subah ka ek kaam. Sirf popup — koi app band nahi. 2 min baad khud band. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "rs", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "never", "m_type": 0, "isLocalVar": True, "m_booleanValue": False}],
    "m_triggerList": [tt(112233445566881, 20, 30), tt(112233445566882, 21, 15)],
    "m_actionList": [
        {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": JV, "blockNextAction": True, "responseVariableName": "rs", "runInBackgroundThread": True},
        {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": [{"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "never", "m_type": 0, "isLocalVar": True}, "m_booleanValue": True}]},
        {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "🌙 Raat ka waqfa", "text": "{lv=rs}", "positiveText": "✅ Soch liya", "negativeText": "✕",
         "cancelAfterTimeout": True, "timeoutSeconds": 120, "htmlFormat": True, "useCustomColors": True, "textColor": -15658735, "bgColor": -1},
        {"m_classType": "EndIfAction", "m_SIGUID": 0},
        {"m_classType": "EndIfAction", "m_SIGUID": 0}],
    "m_constraintList": []},
    "globalVariables": [], "userIcons": None, "aiFeedback": "Display over other apps ijazat."}
if __name__ == '__main__':
    json.dump(RT, open(os.path.join(D, 'raat.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('raat ok')
