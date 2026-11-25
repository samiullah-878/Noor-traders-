# 📇 Naya number save (malik 25 Nov 2026: "jo number 0319… wala hai, auto save karne ka tile aa jaye ya upar notification aa jaye" + "calls par bhi"; plan OK)
#   WhatsApp ka paigham / call kisi UNSAVED number se (notification ka title sirf number, jaise "+92 319 8682104" / "(2 messages)") YA SIM call
#   (khatam / missed) kisi aise number se jo contacts mein nahi -> EK notification "Naya number: 0319 8682104" -> tap = phone ki 'Naya contact'
#   screen number bhar kar (ACTION_INSERT) -> malik naam likh kar Save. Bina naam ke khud save NAHI (spam contacts mein na bhare).
#   Ek number = ek hi dafa (global cnSeen ",923…,", aakhri ~3000 harf; numbers SIRF phone mein — md/ PUBLIC). Saved number (PhoneLookup) = kuch nahi.
#   Notification Java khud banata hai (har number ki apni PendingIntent — MacroDroid ki NotificationAction ka configured action number yaad nahi rakhta).
#   Groups / naam wale title par kuch nahi. Sirf aam WhatsApp (com.whatsapp). Toast / awaaz baar baar nahi. AI nahi. Phone par azmaya nahi.
import json, os
from cb import iff, END, ELSE, lvar, var, trig
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3 = 112233445567701, 112233445567702, 112233445567703

# Java: number pakka karo -> dekha / saved / notification. Regex aur array mein { } nahi (scriptText magic text hai).
CNJ = '\n'.join([
 'try {',
 '  String n = magicText.evaluateString("{" + "lv=cn}"); if (n == null) n = ""; n = n.trim();',
 '  String src = magicText.evaluateString("{" + "lv=cs}"); if (src == null) src = "";',
 '  if (n.length() == 0) return "khali";',
 '  if (src.equals("w")) {',
 '    n = n.replaceAll("[(][0-9]+[^)]*[)]$", "").trim();',
 '    if (!n.matches("[+][0-9 ()-]+")) return "naam";',
 '  }',
 '  String d = n.replaceAll("[^0-9]", "");',
 '  if (n.startsWith("00")) d = d.substring(2);',
 '  else if (!n.startsWith("+") && d.startsWith("0")) d = "92" + d.substring(1);',
 '  else if (!n.startsWith("+") && d.length() == 10 && d.startsWith("3")) d = "92" + d;',
 '  if (d.length() < 10 || d.length() > 15) return "chhota";',
 '  String seen = magicText.evaluateString("{" + "v=cnSeen}"); if (seen == null) seen = "";',
 '  if (seen.indexOf("," + d + ",") >= 0) return "dekha";',
 '  String plus = "+" + d;',
 '  try {',
 '    String[] cols = new String[1]; cols[0] = "_id";',
 '    android.net.Uri u = android.net.Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(plus));',
 '    android.database.Cursor c = appContext.getContentResolver().query(u, cols, null, null, null);',
 '    if (c != null) { boolean has = c.getCount() > 0; c.close(); if (has) return "saved"; }',
 '  } catch (Throwable e1) { }',
 '  android.app.NotificationManager nm = (android.app.NotificationManager) appContext.getSystemService("notification");',
 '  String ch = "nt_cnsave";',
 '  if (android.os.Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new android.app.NotificationChannel(ch, "Naya number save", 3));',
 '  android.content.Intent it = new android.content.Intent("android.intent.action.INSERT");',
 '  it.setType("vnd.android.cursor.dir/raw_contact");',
 '  it.putExtra("phone", plus);',
 '  it.putExtra("finishActivityOnSaveCompleted", true);',
 '  it.addFlags(268435456);',
 '  int id = 7300 + Math.abs(d.hashCode() % 100000);',
 '  android.app.PendingIntent pi = android.app.PendingIntent.getActivity(appContext, id, it, 67108864 | 134217728);',
 '  String show = (d.startsWith("92") && d.length() == 12) ? ("0" + d.substring(2, 5) + " " + d.substring(5)) : plus;',
 '  android.app.Notification.Builder b = new android.app.Notification.Builder(appContext, ch);',
 '  b.setSmallIcon(android.R.drawable.ic_input_add);',
 '  b.setContentTitle("Naya number: " + show);',
 '  b.setContentText((src.equals("w") ? "WhatsApp" : "Call") + " - dabayein, naam likh kar Save karein");',
 '  b.setContentIntent(pi); b.setAutoCancel(true); b.setOnlyAlertOnce(true);',
 '  nm.notify(id, b.build());',
 '  if (seen.length() == 0) seen = ",";',
 '  String s2 = seen + d + ",";',
 '  if (s2.length() > 3600) s2 = s2.substring(s2.indexOf(",", s2.length() - 3000));',
 '  variableSetter.setString("cnSeen", s2, 2);',
 '  return "ok";',
 '} catch (Throwable e) { return "err " + e; }'])

def sv(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
acts = [
    iff([trig(T1, "WhatsApp")]), sv("cn", "{not_title}"), sv("cs", "w"),
    ELSE, sv("cn", "{call_number}"), sv("cs", "c"),
    END,
    {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": CNJ, "blockNextAction": True, "responseVariableName": "res", "runInBackgroundThread": False},
]
CN = {"macroExportVersion": 1, "macro": {
    "m_name": "📇 Naya number save",
    "m_description": "WhatsApp ya call par unsaved number aaye to ek notification: dabao = 'Naya contact' screen number ke saath, naam likh kar Save. Har number ki sirf ek dafa. Saved number par kuch nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("cn", 2), lvar("cs", 2), lvar("res", 2)],
    "m_triggerList": [
        {"m_classType": "NotificationTrigger", "m_SIGUID": T1, "m_option": 0, "m_packageNameList": ["com.whatsapp"], "m_applicationNameList": ["WhatsApp"],
         "m_excludeApps": False, "separateTitleAndMessage": True, "matchOptionTitle": 0, "matchOptionMessage": 0, "m_ignoreOngoing": False, "m_supressMultiples": True},
        {"m_classType": "CallEndedTrigger", "m_SIGUID": T2, "m_option": 3},
        {"m_classType": "CallMissedTrigger", "m_SIGUID": T3, "m_option": 3}],
    "m_actionList": acts},
    "globalVariables": [var("cnSeen", 2)], "userIcons": None}

if __name__ == '__main__':
    json.dump(CN, open(os.path.join(D, 'cnsave.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('cnsave ok', len(acts))
