# 📇 Naya number save (malik 25 Nov 2026: "jo number 0319… wala hai, auto save karne ka tile aa jaye ya upar notification aa jaye" + "calls par bhi"; plan OK)
#   WhatsApp ka paigham / call kisi UNSAVED number se (notification ka title sirf number, jaise "+92 319 8682104" / "(2 messages)") YA SIM call
#   (khatam / missed) kisi aise number se jo contacts mein nahi -> "Naya number: 0319 8682104" -> tap = phone ki 'Naya contact'
#   screen number bhar kar (ACTION_INSERT) -> malik naam likh kar Save. Bina naam ke khud save NAHI (spam contacts mein na bhare).
#   Ek number = ek hi dafa (global cnSeen ",923…,", aakhri ~3000 harf; numbers SIRF phone mein — md/ PUBLIC). Saved number (PhoneLookup) = kuch nahi.
#   Groups / naam wale title par kuch nahi. Toast / awaaz baar baar nahi. AI nahi.
# v83 (26 Nov raat): WhatsApp title ke chhupe harf saaf (saaf()), channel nt_cnsave2 importance 4, w4b, ginti cnW / cnC / cnOk / cnR.
# v87 (27 Nov raat, malik: "save wala abhi bhi nahi chal raha" -> "Notification aata hi nahi" -> "Nahi, wo tile (popup) mein aa jaye
#   jaise reminder wala aa raha hai, same waise"): report v86 = cnOk 20 (Java ne 20 dafa nm.notify chalaya) magar malik ko kuch nazar nahi
#   aaya = phone MacroDroid ka notification chhupa deta hai. Ab notification / patti NAHI — naya number global cnList mein
#   ("+92…|0319 8682104|w|ms", aakhri 5) aur 🧠 Falsafa ka unlock wala MILA popup (qaide.py SKL) reminder ke foran neeche
#   "📇 0319 8682104 · WhatsApp — Save karein" dikhata hai; tap = 'Naya contact' screen number bhar kar (qaide.py CNO) + list se hata.
#   Save ho gaya (PhoneLookup) ya 3 din purana = khud hat. cnSeen ek dafa phir khali (cnV 3) — pehle wale 20 dikhe hi nahi the.
#   Report ka naya hindsa: cnWo (WhatsApp se kitne naye number pakre). Phone par azmaya nahi.
# v89 (27 Nov raat, malik ne chuna: 'Isi 💬 tile ke popup mein'): list ab unlock popup mein NAHI — 💬 WhatsApp tile (wasite.py CNL / CNP) mein:
#   har number ki '📇 Save karo' + '💬 WhatsApp' line, aakhir mein '✍️ Koi aur number likhein'.
import json, os
from cb import iff, END, ELSE, lvar, var, trig
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3 = 112233445567701, 112233445567702, 112233445567703
KEEP = 5          # popup mein zyada se zyada itne naye number (purane aage se girte hain)

# Java: number pakka karo -> dekha / saved / cnList mein jor (popup ke liye). Regex aur array mein { } nahi (scriptText magic text hai).
CNJ = '\n'.join([
 'int gi(String k, int d) {',
 '  try { String s = magicText.evaluateString("{" + "v=" + k + "}"); return Integer.parseInt(s.trim()); } catch (Throwable e) { return d; }',
 '}',
 'void cnt(String k) { try { variableSetter.setInt(k, gi(k, 0) + 1); } catch (Throwable e) { } }',
 'String fin(int r, String s) { try { variableSetter.setInt("cnR", r); } catch (Throwable e) { } return s; }',
 'String saaf(String x) {',
 '  if (x == null) return "";',
 '  StringBuilder sb = new StringBuilder();',
 '  for (int i = 0; i < x.length(); i++) {',
 '    char ch = x.charAt(i);',
 '    int cp = (int) ch;',
 '    if (Character.getType(ch) == Character.FORMAT) continue;',
 '    if (cp == 160 || cp == 8199 || cp == 8239) { sb.append(" "); continue; }',
 '    sb.append(ch);',
 '  }',
 '  return sb.toString().trim();',
 '}',
 'try {',
 '  String src = magicText.evaluateString("{" + "lv=cs}"); if (src == null) src = "";',
 '  boolean wa = src.equals("w");',
 '  cnt(wa ? "cnW" : "cnC");',
 '  if (gi("cnV", 0) < 3) { variableSetter.setString("cnSeen", ",", 2); variableSetter.setInt("cnV", 3); }',
 '  String n = saaf(magicText.evaluateString("{" + "lv=cn}"));',
 '  if (n.length() == 0) return fin(5, "khali");',
 '  if (wa) {',
 '    n = n.replaceAll("[(][0-9]+[^)]*[)]$", "").trim();',
 '    if (!n.matches("[+]?[0-9 ()-]+")) return fin(2, "naam");',
 '  }',
 '  String d = n.replaceAll("[^0-9]", "");',
 '  if (n.startsWith("00")) d = d.substring(2);',
 '  else if (!n.startsWith("+") && d.startsWith("0")) d = "92" + d.substring(1);',
 '  else if (!n.startsWith("+") && d.length() == 10 && d.startsWith("3")) d = "92" + d;',
 '  if (d.length() < 10 || d.length() > 15) return fin(6, "chhota");',
 '  String seen = magicText.evaluateString("{" + "v=cnSeen}"); if (seen == null) seen = "";',
 '  if (seen.indexOf("," + d + ",") >= 0) return fin(3, "dekha");',
 '  String plus = "+" + d;',
 '  try {',
 '    String[] cols = new String[1]; cols[0] = "_id";',
 '    android.net.Uri u = android.net.Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(plus));',
 '    android.database.Cursor c = appContext.getContentResolver().query(u, cols, null, null, null);',
 '    if (c != null) { boolean has = c.getCount() > 0; c.close(); if (has) return fin(4, "saved"); }',
 '  } catch (Throwable e1) { }',
 '  String show = (d.startsWith("92") && d.length() == 12) ? ("0" + d.substring(2, 5) + " " + d.substring(5)) : plus;',
 '  String L = magicText.evaluateString("{" + "v=cnList}"); if (L == null) L = "";',
 '  String[] la = L.split("\\n");',
 '  java.util.ArrayList keep = new java.util.ArrayList();',
 '  for (int i = 0; i < la.length; i++) { String x = la[i].trim(); if (x.length() == 0 || x.startsWith(plus + "|")) continue; keep.add(x); }',
 '  keep.add(plus + "|" + show + "|" + (wa ? "w" : "c") + "|" + System.currentTimeMillis());',
 '  while (keep.size() > %d) keep.remove(0);' % KEEP,
 '  StringBuilder lb = new StringBuilder();',
 '  for (int i = 0; i < keep.size(); i++) { if (i > 0) lb.append("\\n"); lb.append((String) keep.get(i)); }',
 '  variableSetter.setString("cnList", lb.toString(), 2);',
 '  if (wa) cnt("cnWo");',
 '  if (seen.length() == 0) seen = ",";',
 '  String s2 = seen + d + ",";',
 '  if (s2.length() > 3600) s2 = s2.substring(s2.indexOf(",", s2.length() - 3000));',
 '  variableSetter.setString("cnSeen", s2, 2);',
 '  cnt("cnOk");',
 '  fin(1, "ok");',
 '  return "ok";',
 '} catch (Throwable e) { return fin(9, "err " + e); }'])

def sv(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
def leq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True},
                       "m_stringValue": v, "m_stringComparisonType": 0, "m_stringEqual": True}
def java(code): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": code, "blockNextAction": True, "responseVariableName": "res", "runInBackgroundThread": False}
acts = [
    sv("res", ""),
    iff([trig(T1, "WhatsApp")]), sv("cn", "{not_title}"), sv("cs", "w"),
    ELSE, sv("cn", "{call_number}"), sv("cs", "c"),
    END,
    java(CNJ),
]
CN = {"macroExportVersion": 1, "macro": {
    "m_name": "📇 Naya number save",
    "m_description": "WhatsApp ya call par unsaved number aaye to list mein (aakhri 5, 3 din) — 💬 WhatsApp tile dabao: '📇 Save karo · 0319 …' = 'Naya contact' screen number ke saath, naam likh kar Save · '💬 WhatsApp · 0319 …' = chat. Har number ki sirf ek dafa. Saved number par kuch nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("cn", 2), lvar("cs", 2), lvar("res", 2)],
    "m_triggerList": [
        {"m_classType": "NotificationTrigger", "m_SIGUID": T1, "m_option": 0, "m_packageNameList": ["com.whatsapp", "com.whatsapp.w4b"], "m_applicationNameList": ["WhatsApp", "WhatsApp Business"],
         "m_excludeApps": False, "separateTitleAndMessage": True, "matchOptionTitle": 0, "matchOptionMessage": 0, "m_ignoreOngoing": False, "m_supressMultiples": True},
        {"m_classType": "CallEndedTrigger", "m_SIGUID": T2, "m_option": 3},
        {"m_classType": "CallMissedTrigger", "m_SIGUID": T3, "m_option": 3}],
    "m_actionList": acts},
    "globalVariables": [var("cnSeen", 2), var("cnList", 2), var("cnW"), var("cnC"), var("cnOk"), var("cnR"), var("cnV"), var("cnWo")],
    "userIcons": None}

if __name__ == '__main__':
    json.dump(CN, open(os.path.join(D, 'cnsave.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('cnsave ok', len(acts))
