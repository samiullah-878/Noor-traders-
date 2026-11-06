import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from full import to_full
D = os.path.dirname(os.path.abspath(__file__))
DIR = "/storage/emulated/0/MacroDroid/Claude"
BASE = "https://samiullah-878.github.io/Noor-traders-/md/"

CHECK = "\n".join([
 'import java.io.*;',
 'import java.net.*;',
 'try {',
 '  new File("' + DIR + '").mkdirs();',
 '  HttpURLConnection c = (HttpURLConnection) new URL("' + BASE + 'ver.txt?t=" + System.currentTimeMillis()).openConnection();',
 '  c.setConnectTimeout(15000);',
 '  c.setReadTimeout(15000);',
 '  c.setUseCaches(false);',
 '  BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));',
 '  String v = r.readLine();',
 '  r.close();',
 '  if (v == null) return "err";',
 '  v = v.trim();',
 '  if (v.length() == 0 || v.length() > 20 || v.indexOf("<") >= 0) return "err";',
 '  File hf = new File("' + DIR + '/have.txt");',
 '  if (hf.exists()) {',
 '    BufferedReader h = new BufferedReader(new InputStreamReader(new FileInputStream(hf), "UTF-8"));',
 '    String have = h.readLine();',
 '    h.close();',
 '    if (have != null && have.trim().equals(v)) return "same";',
 '  }',
 '  return v;',
 '} catch (Exception e) {',
 '  return "err";',
 '}',
])

BUILD = "\n".join([
 'import java.io.*;',
 'import java.net.*;',
 'import org.json.*;',
 'String rd(InputStream in) {',
 '  BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));',
 '  StringBuilder sb = new StringBuilder();',
 '  String line;',
 '  while ((line = r.readLine()) != null) sb.append(line).append("\\n");',
 '  r.close();',
 '  return sb.toString();',
 '}',
 'try {',
 '  HttpURLConnection c = (HttpURLConnection) new URL("' + BASE + 'pkg.json?t=" + System.currentTimeMillis()).openConnection();',
 '  c.setConnectTimeout(15000);',
 '  c.setReadTimeout(30000);',
 '  c.setUseCaches(false);',
 '  JSONObject pk = new JSONObject(rd(c.getInputStream()));',
 '  File newest = null;',
 '  long now = System.currentTimeMillis();',
 '  String[] ds = new String[] { "' + DIR + '", "/storage/emulated/0/MacroDroid", "/storage/emulated/0" };',
 '  for (int d = 0; d < ds.length; d++) {',
 '    File[] fs = new File(ds[d]).listFiles();',
 '    if (fs == null) continue;',
 '    for (int i = 0; i < fs.length; i++) {',
 '      File f = fs[i];',
 '      String n = f.getName();',
 '      if (f.isFile() && n.endsWith(".mdr") && !n.equals("claude.mdr") && now - f.lastModified() < 300000 && (newest == null || f.lastModified() > newest.lastModified())) newest = f;',
 '    }',
 '  }',
 '  if (newest == null) return "err|Backup file nahi mili - MacroDroid ko All files access do";',
 '  JSONObject ex = new JSONObject(rd(new FileInputStream(newest)));',
 '  String mk = null;',
 '  String vk = null;',
 '  java.util.Iterator it = ex.keys();',
 '  while (it.hasNext()) {',
 '    String k = (String) it.next();',
 '    JSONArray a = ex.optJSONArray(k);',
 '    if (a == null || a.length() == 0) continue;',
 '    JSONObject o = a.optJSONObject(0);',
 '    if (o == null) continue;',
 '    if (o.has("m_triggerList") && !o.optBoolean("isActionBlock", false) && mk == null) mk = k;',
 '    if (o.has("m_name") && o.has("m_type") && !o.has("m_triggerList") && vk == null) vk = k;',
 '  }',
 '  if (mk == null) mk = ex.has("macroList") ? "macroList" : "macroList";',
 '  if (vk == null) vk = ex.has("globalVariables") ? "globalVariables" : "variables";',
 '  ex.put(mk, pk.getJSONArray("macros"));',
 '  JSONArray cur = ex.optJSONArray(vk);',
 '  java.util.HashSet have = new java.util.HashSet();',
 '  if (cur != null) for (int i = 0; i < cur.length(); i++) have.add(cur.getJSONObject(i).optString("m_name"));',
 '  JSONArray add = new JSONArray();',
 '  JSONArray pv = pk.optJSONArray("vars");',
 '  if (pv != null) for (int i = 0; i < pv.length(); i++) if (!have.contains(pv.getJSONObject(i).optString("m_name"))) add.put(pv.getJSONObject(i));',
 '  ex.put(vk, add);',
 '  FileOutputStream o2 = new FileOutputStream("' + DIR + '/claude.mdr");',
 '  o2.write(ex.toString().getBytes("UTF-8"));',
 '  o2.close();',
 '  JSONArray off = pk.optJSONArray("off");',
 '  for (int i = 1; i <= 5; i++) {',
 '    String nm = (off != null && off.length() >= i) ? off.getString(i - 1) : "";',
 '    try { variableSetter.setString("crOff" + i, nm, 1); } catch (Exception e2) { }',
 '  }',
 '  FileOutputStream o3 = new FileOutputStream("' + DIR + '/have.txt");',
 '  o3.write(pk.optString("v").getBytes("UTF-8"));',
 '  o3.close();',
 '  return "ok|" + pk.optString("note");',
 '} catch (Exception e) {',
 '  return "err|" + e;',
 '}',
])

def gv(n, t): return {"m_name": n, "m_type": t, "isLocalVar": True}
def sstr(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(n, 2), "m_newStringValue": v}
def sc(n, v, typ=0, eq=True): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 2),
                                      "m_stringValue": v, "m_stringComparisonType": typ, "m_stringEqual": eq}
def iff(c): return {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": c}
END = {"m_classType": "EndIfAction", "m_SIGUID": 0}
ELSE = {"m_classType": "ElseAction", "m_SIGUID": 0}
def java(code, resp): return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": code, "blockNextAction": True,
                              "responseVariableName": resp, "runInBackgroundThread": True}
def note(title, text, nid): return {"m_classType": "NotificationAction", "m_SIGUID": 0, "m_notificationSubject": title,
                                    "m_notificationText": text, "m_overwriteExisting": True, "notificatonId": nid,
                                    "notificationIdString": str(nid), "m_priority": 1, "autoExpand": True}
def off(i): return {"m_classType": "DisableMacroAction", "m_SIGUID": 0, "m_state": 1, "getByName": True, "m_macroName": "{lv=crOff%d}" % i,
                    "m_constraintList": [sc("crOff%d" % i, "", eq=False)]}

acts = [
    sstr("crVer", "err"),
    java(CHECK, "crVer"),
    iff([sc("crVer", "err", eq=False), sc("crVer", "", eq=False), sc("crVer", "same", eq=False)]),
      {"m_classType": "ExportMacrosAction", "m_SIGUID": 0, "option": 0, "m_fileName": "nt-backup",
       "useAllFilesAccess": True, "allFilesPath": DIR},
      sstr("crRes", "err|chala nahi"),
      java(BUILD, "crRes"),
      iff([sc("crRes", "ok|", typ=1)]),
        {"m_classType": "ImportMacrosAction", "m_SIGUID": 0, "importMode": 1, "fileName": "claude",
         "useAllFilesAccess": True, "allFilesPath": DIR},
        off(1), off(2), off(3), off(4), off(5),
        note("🤖 Claude ne macro badle (v{lv=crVer})", "{lv=crRes}", 7790),
      ELSE,
        note("🤖 Claude Remote — masla", "{lv=crRes}", 7791),
      END,
    END,
]
out = {"macroExportVersion": 1, "macro": {
    "m_name": "🤖 Claude Remote 3",
    "m_description": "Har 5 min GitHub (Noor-traders-/md) dekhta hai. Naya version ho to pehle backup, phir Claude ke macros khud import (purane usi ID par badal jate hain) aur purane naam wale band. Chaabi / password kabhi nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": 112233445566771, "m_seconds": 300, "m_useAlarm": False},
        {"m_classType": "MacroEnabledTrigger", "m_SIGUID": 112233445566772}],
    "localVariables": [{"m_name": n, "m_type": 2, "isLocalVar": True, "m_stringValue": ""} for n in
                       ("crVer", "crRes", "crOff1", "crOff2", "crOff3", "crOff4", "crOff5")],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [],
    "userIcons": None, "aiFeedback": "All files access zaroori."}
out = to_full(out)
s = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(D, "remote.json"), "w").write(s)
print(len(s))
