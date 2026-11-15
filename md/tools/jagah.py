# 📍 Jagah-war recording (malik 15 Nov 2026: 'yahan par location nahi hai (sirf number) · har location ki alehda recording ho, andar folder ho')
#   JNAME (rec.py har tukde se pehle): taza location -> yaad jagahon (global jgList "Naam|lat|lon;…", SIRF phone mein — md/ PUBLIC, pata / coordinates yahan KABHI nahi)
#   mein 250 m ke andar wali -> globals jgNm (folder + file ka naam) · jgXY ('' ya '_lat_lon' anjaan jagah par). Na mile = 'Doosri jagah'.
#   Anjaan jagah par 2 tukde lagataar (20 min) = jgAsk 1 -> yeh macro unlock par EK sawal '📍 Yeh kaun si jagah hai?' (din mein 1 dafa; naam '0' = yeh jagah kabhi na poochho).
#   Popup par 'recording' ka lafz NAHI (malik ka qaida). Toast nahi. Phone par test nahi (variableSetter pehli dafa istemal) — na chale to file purani tarah root mein. AI nahi.
import json, os
from cb import iff, END, ELSE, sint, sstr, gt, var
D = os.path.dirname(os.path.abspath(__file__))
DIR = "/storage/emulated/0/NT Awaz"
T1 = 112233445567301
HELP = '\n'.join([
 'String BAR = "" + (char) 124; String SEM = "" + (char) 59;',
 'double dist(double a, double b, double c, double d) { double dy = (a - c) * 111320.0; double dx = (b - d) * 111320.0 * Math.cos(Math.toRadians(a)); return Math.sqrt(dx * dx + dy * dy); }',
 'String[] cut(String s, String sep) { java.util.ArrayList L = new java.util.ArrayList(); int i = 0; while (true) { int j = s.indexOf(sep, i); if (j < 0) { L.add(s.substring(i)); break; } L.add(s.substring(i, j)); i = j + 1; } String[] r = new String[L.size()]; for (int k = 0; k < r.length; k++) r[k] = (String) L.get(k); return r; }',
 'String ev(String k) { try { String v = magicText.evaluateString("{" + k + "}"); return v == null ? "" : v.trim(); } catch (Throwable e) { return ""; } }'])
JN = HELP + '\n' + '\n'.join([
 'try {',
 '  String L = ev("v=jgList"), sa = ev("last_loc_lat"), so = ev("last_loc_long"), last = ev("v=jgLast"), no = ev("v=jgNo"), day = ev("dayofmonth");',
 '  String nm = "Doosri jagah", xy = ""; double la = 0, lo = 0; boolean ok = false, known = false;',
 '  try { la = Double.parseDouble(sa); lo = Double.parseDouble(so); ok = Math.abs(la) > 0.01 || Math.abs(lo) > 0.01; } catch (Throwable e) { ok = false; }',
 '  if (ok) { xy = "_" + sa + "_" + so; double best = 250; String[] P = cut(L, SEM);',
 '    for (int i = 0; i < P.length; i++) { String[] f = cut(P[i], BAR); if (f.length < 3) continue;',
 '      try { double d = dist(la, lo, Double.parseDouble(f[1]), Double.parseDouble(f[2])); if (d < best) { best = d; known = true; if (f[0].equals("-")) { nm = "Doosri jagah"; xy = "_" + sa + "_" + so; } else { nm = f[0]; xy = ""; } } } catch (Throwable e) { } } }',
 '  try { new java.io.File("' + DIR + '/" + nm).mkdirs(); } catch (Throwable e) { }',
 '  variableSetter.setString("jgNm", nm); variableSetter.setString("jgXY", xy);',
 '  if (ok && !known) { int c = 1; String[] q = cut(last, BAR);',
 '    try { if (q.length >= 3 && dist(la, lo, Double.parseDouble(q[0]), Double.parseDouble(q[1])) < 250) c = Integer.parseInt(q[2]) + 1; } catch (Throwable e) { c = 1; }',
 '    if (c == 1 || q.length < 3) variableSetter.setString("jgLast", sa + BAR + so + BAR + c); else variableSetter.setString("jgLast", q[0] + BAR + q[1] + BAR + c);',
 '    if (c >= 2 && !no.equals(day)) variableSetter.setInt("jgAsk", 1);',
 '  } else if (known) { variableSetter.setString("jgLast", ""); variableSetter.setInt("jgAsk", 0); }',
 '} catch (Throwable t) { }',
 'return "ok";'])
JA = HELP + '\n' + '\n'.join([
 'try {',
 '  String L = ev("v=jgList"), last = ev("v=jgLast"), n = ev("lv=nm"); String[] q = cut(last, BAR); if (q.length < 2 || n.length() == 0) return "no";',
 '  StringBuilder b = new StringBuilder(); for (int i = 0; i < n.length() && b.length() < 30; i++) { char ch = n.charAt(i); if (Character.isLetterOrDigit(ch) || ch == 32 || ch == 45 || ch == 95) b.append(ch); }',
 '  String nm = b.toString().trim(); if (nm.length() == 0) return "no"; if (nm.equals("0")) nm = "-";',
 '  Double.parseDouble(q[0]); Double.parseDouble(q[1]);',
 '  variableSetter.setString("jgList", (L.length() > 0 ? L + SEM : "") + nm + BAR + q[0] + BAR + q[1]);',
 '  variableSetter.setString("jgLast", "");',
 '  return "ok";',
 '} catch (Throwable t) { return "no"; }'])
def java(src, rv="mk"): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": src, "blockNextAction": True, "responseVariableName": rv, "runInBackgroundThread": True}
JNAME = java(JN)
GV = [var("jgList", 2), var("jgNm", 2), var("jgXY", 2), var("jgLast", 2), var("jgNo", 2), var("jgAsk")]
NEVER = {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": {"m_name": "never", "m_type": 0, "isLocalVar": True}, "m_booleanValue": True}
lv = lambda n, t: {"m_name": n, "m_type": t, "isLocalVar": True}
LNE = {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": lv("nm", 2), "m_stringValue": "", "m_stringComparisonType": 0, "m_stringEqual": False}
acts = [
    sint("jgAsk", 0), sstr("jgNo", "{dayofmonth}"),
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv("nm", 2), "m_newStringValue": ""},
    iff([NEVER]),
    {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "📍 Yeh kaun si jagah hai?",
     "text": "Aap yahan kuch der se hain. Is jagah ka <b>naam</b> rakh dein (jaise Dukan, Ghar, Godam 1) — aage yahan ki cheezein isi naam ke folder mein jayengi.",
     "positiveText": "✍️ Naam likho", "negativeText": "Baad mein", "cancelAfterTimeout": True, "timeoutSeconds": 60, "htmlFormat": True, "useCustomColors": True, "textColor": -15658735, "bgColor": -1},
      {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": lv("nm", 2), "m_userPrompt": True, "m_userPromptTitle": "📍 Is jagah ka naam",
       "m_userPromptMessage": "Jaise: Dukan · Ghar · Godam 1. (0 likhein = yeh jagah dobara na poochho.)", "m_userPromptShowCancel": True, "m_userPromptStopAfterCancel": False, "m_userPromptEmptyAtStart": True},
      iff([LNE]), java(JA), END,
    END,
]
JG = {"macroExportVersion": 1, "macro": {
    "m_name": "📍 Jagah ka naam",
    "m_description": "Nayi jagah par 20 minute ke baad unlock par ek sawal: is jagah ka naam (Dukan / Ghar…). Naam sirf phone mein rehta hai. Din mein 1 dafa; 0 = yeh jagah kabhi na poochho. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "nm", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "mk", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "never", "m_type": 0, "isLocalVar": True, "m_booleanValue": False}],
    "m_triggerList": [{"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": T1}],
    "m_actionList": acts, "m_constraintList": [gt("jgAsk", 0)]},
    "globalVariables": GV, "userIcons": None, "aiFeedback": "Display over other apps ijazat."}
if __name__ == '__main__':
    json.dump(JG, open(os.path.join(D, 'jagah.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('jagah ok', len(acts))
