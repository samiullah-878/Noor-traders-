# 📞 Call diary (malik 25 Nov 2026: "Save Incoming Call Detail As Text File jaisa bana do · data Google Drive mein pada ho · kitne minute baat hui ·
#   contact saved ho to naam, warna number" + "WhatsApp calls bhi" + OK)
#   Har call ki EK line -> phone ka "NT Awaz/Calls/Calls <saal-mahina>.csv" (mahine ki alag file). FolderSync NT Awaz (andar ke folder samet) Drive le jata hai —
#   naya setup nahi; Drive mein Google Sheets se khulti hai. awaz-gas.js sirf awaaz ki files leta hai (isAudio) — csv ko nahi chhoota.
#   Khane: Tareekh · Waqt · Qism · Naam ya Number · Der · Number.
#   SIM: CallEnded / CallMissed -> 3 / 6 s ruk kar phone ki CallLog (number, cached naam, asal der, qism) — cdL (aakhri likhi call ka waqt) se dohra nahi,
#        beech mein chhooti calls bhi (10 tak); naam na ho to PhoneLookup; WhatsApp wali CallLog line chhodo (us ki apni line notification se).
#   WhatsApp: 'Incoming … call' notification = cdWI (aane wali ka waqt) · 'Ongoing … call' aaye = shuru (cdWS / cdWN / cdWU / cdWD) · wohi notification
#        hate = khatam -> der = andaza (2-3 s upar neeche) · 'Missed … call' = WA Missed. Shuru se 2 min pehle Incoming dikha = WA Aayi, warna WA Gayi.
#   Koi popup / toast / notification nahi. Numbers / naam SIRF phone ki file mein (md/ PUBLIC). AI nahi. Phone par azmaya nahi.
import json, os
from cb import iff, END, ELSE, lvar, var, trig, pause
D = os.path.dirname(os.path.abspath(__file__))
T1, T2, T3, T4 = 112233445567901, 112233445567902, 112233445567903, 112233445567904
DIR = "/storage/emulated/0/NT Awaz/Calls"

# BeanShell. Har '{' ke baad khali jagah / nayi line (scriptText magic text hai); regex / array mein { } nahi.
CLJ = r'''try {
  String m = magicText.evaluateString("{" + "lv=cm}"); if (m == null) m = "";
  long now = System.currentTimeMillis();
  java.util.ArrayList L = new java.util.ArrayList();
  String res = "skip";
  if (m.equals("s")) {
    String last = magicText.evaluateString("{" + "v=cdL}"); if (last == null) last = "";
    long lastD = 0; try { lastD = Long.parseLong(last.trim()); } catch (Throwable e0) { }
    long top = lastD;
    try {
      String[] cols = new String[6]; cols[0] = "number"; cols[1] = "name"; cols[2] = "duration"; cols[3] = "type"; cols[4] = "date"; cols[5] = "subscription_component_name";
      android.database.Cursor c = appContext.getContentResolver().query(android.provider.CallLog.Calls.CONTENT_URI, cols, null, null, "date DESC");
      int rows = 0;
      if (c != null) {
        while (c.moveToNext() && rows < 10) {
          long dt = c.getLong(4);
          if (dt <= lastD) break;
          if (lastD == 0 && (rows > 0 || now - dt > 600000)) break;
          if (now - dt > 172800000) break;
          rows++;
          if (dt > top) top = dt;
          String comp = c.getString(5); if (comp == null) comp = "";
          if (comp.toLowerCase().indexOf("whatsapp") >= 0) continue;
          String num = c.getString(0); if (num == null) num = ""; num = num.trim();
          String nm = c.getString(1); if (nm == null) nm = ""; nm = nm.trim();
          long du = c.getLong(2); int ty = c.getInt(3);
          if (nm.length() == 0 && num.length() > 0) {
            try {
              String[] pc = new String[1]; pc[0] = "display_name";
              android.net.Uri u = android.net.Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(num));
              android.database.Cursor p = appContext.getContentResolver().query(u, pc, null, null, null);
              if (p != null) { if (p.moveToFirst()) nm = p.getString(0); p.close(); }
              if (nm == null) nm = "";
            } catch (Throwable e1) { }
          }
          String d = num.replaceAll("[^0-9]", "");
          String show = num;
          if (d.startsWith("92") && d.length() == 12) show = "0" + d.substring(2, 5) + " " + d.substring(5);
          else if (d.startsWith("03") && d.length() == 11) show = d.substring(0, 4) + " " + d.substring(4);
          if (show.length() == 0) show = "Chhupa number";
          String q = "Call";
          if (ty == 1) q = "Aayi"; else if (ty == 2) q = du > 0 ? "Gayi" : "Gayi (utha nahi)"; else if (ty == 3) q = "Missed"; else if (ty == 5) q = "Kaati"; else if (ty == 6) q = "Block";
          String der = du <= 0 ? "-" : (du < 60 ? du + " sec" : (du / 60) + " min " + (du % 60) + " sec");
          String[] r1 = new String[5]; r1[0] = "" + dt; r1[1] = q; r1[2] = nm.length() > 0 ? nm : show; r1[3] = der; r1[4] = show;
          L.add(r1);
        }
        c.close();
      }
    } catch (Throwable eq) {
      String cn = magicText.evaluateString("{" + "lv=cn}"); if (cn == null) cn = "";
      String[] r2 = new String[5]; r2[0] = "" + now; r2[1] = "Call"; r2[2] = cn.length() > 0 ? cn : "?"; r2[3] = "? (call log nahi khula)"; r2[4] = cn;
      L.add(r2);
      res = "nolog " + eq;
    }
    if (top > lastD) variableSetter.setString("cdL", "" + top, 2);
  } else {
    String ws = magicText.evaluateString("{" + "v=cdWS}"); if (ws == null) ws = "";
    long st = 0; try { st = Long.parseLong(ws.trim()); } catch (Throwable e2) { }
    String wn = magicText.evaluateString("{" + "v=cdWN}"); if (wn == null) wn = "";
    String wu = magicText.evaluateString("{" + "v=cdWU}"); if (wu == null) wu = "";
    String wd = magicText.evaluateString("{" + "v=cdWD}"); if (wd == null) wd = "";
    if (m.equals("r")) {
      if (st <= 0) return "koi call nahi";
      long du2 = (now - st) / 1000;
      String der2 = du2 < 60 ? du2 + " sec" : (du2 / 60) + " min " + (du2 % 60) + " sec";
      String[] r3 = new String[5]; r3[0] = "" + st; r3[1] = wd; r3[2] = wn; r3[3] = der2; r3[4] = wu;
      L.add(r3);
      variableSetter.setString("cdWS", "0", 2);
    } else {
      String t = magicText.evaluateString("{" + "lv=wt}"); if (t == null) t = ""; t = t.trim();
      String x = magicText.evaluateString("{" + "lv=wx}"); if (x == null) x = "";
      String xl = x.toLowerCase().replace('\n', ' ').trim();
      if (t.length() == 0) return "khali";
      t = t.replaceAll("[(][0-9]+[^)]*[)]$", "").trim();
      String who = t, num = "";
      if (t.matches("[+][0-9 ()-]+")) {
        String wd2 = t.replaceAll("[^0-9]", "");
        num = (wd2.startsWith("92") && wd2.length() == 12) ? ("0" + wd2.substring(2, 5) + " " + wd2.substring(5)) : t;
        who = num;
      }
      boolean vid = xl.indexOf("video") >= 0;
      boolean isCall = xl.indexOf("call") >= 0 && xl.length() < 80;
      if (isCall && xl.startsWith("incoming")) {
        variableSetter.setString("cdWI", "" + now, 2);
        return "incoming";
      } else if (isCall && xl.startsWith("ongoing")) {
        if (st > 0 && now - st < 14400000 && wn.equals(who)) return "wahi call";
        if (st > 0 && now - st < 14400000) {
          String[] r4 = new String[5]; r4[0] = "" + st; r4[1] = wd; r4[2] = wn; r4[3] = "? (khatam ka waqt nahi mila)"; r4[4] = wu;
          L.add(r4);
        }
        String wi = magicText.evaluateString("{" + "v=cdWI}"); if (wi == null) wi = "";
        long iat = 0; try { iat = Long.parseLong(wi.trim()); } catch (Throwable e3) { }
        String wdir = (iat > 0 && now - iat < 120000) ? "WA Aayi" : "WA Gayi";
        if (vid) wdir = wdir + " (video)";
        variableSetter.setString("cdWS", "" + now, 2);
        variableSetter.setString("cdWN", who, 2);
        variableSetter.setString("cdWU", num, 2);
        variableSetter.setString("cdWD", wdir, 2);
        res = "shuru";
      } else if (isCall && xl.matches("([0-9]+ )?missed .*")) {
        String[] r5 = new String[5]; r5[0] = "" + now; r5[1] = vid ? "WA Missed (video)" : "WA Missed"; r5[2] = who; r5[3] = "-"; r5[4] = num;
        L.add(r5);
      } else return "aam paigham";
    }
  }
  if (L.size() == 0) return res;
  java.io.File dir = new java.io.File("__DIR__"); dir.mkdirs();
  java.text.SimpleDateFormat fm = new java.text.SimpleDateFormat("yyyy-MM");
  java.text.SimpleDateFormat fd = new java.text.SimpleDateFormat("dd-MM-yyyy");
  java.text.SimpleDateFormat ft = new java.text.SimpleDateFormat("hh:mm a", java.util.Locale.ENGLISH);
  for (int i = L.size() - 1; i >= 0; i--) {
    String[] r = (String[]) L.get(i);
    java.util.Date dd = new java.util.Date(Long.parseLong(r[0]));
    java.io.File f = new java.io.File(dir, "Calls " + fm.format(dd) + ".csv");
    boolean nu = !f.exists();
    java.io.Writer w = new java.io.OutputStreamWriter(new java.io.FileOutputStream(f, true), "UTF-8");
    if (nu) w.write(String.valueOf((char) 65279) + "Tareekh,Waqt,Qism,Naam ya Number,Der,Number\r\n");
    String[] v = new String[6]; v[0] = fd.format(dd); v[1] = ft.format(dd); v[2] = r[1]; v[3] = r[2]; v[4] = r[3]; v[5] = r[4];
    StringBuilder sb = new StringBuilder();
    for (int j = 0; j < 6; j++) {
      if (j > 0) sb.append(",");
      String s = v[j] == null ? "" : v[j];
      sb.append("\"").append(s.replace("\"", "\"\"")).append("\"");
    }
    sb.append("\r\n");
    w.write(sb.toString()); w.close();
  }
  return "likha " + L.size() + " " + res;
} catch (Throwable e) { return "err " + e; }'''.replace('__DIR__', DIR)

import re
_bad = [mm.start() for mm in re.finditer(r'\{(?![\s"])', CLJ)]
assert not _bad, ('magic text jaisa {', [CLJ[i:i + 20] for i in _bad])

def sv(n, v): return {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": n, "m_type": 2, "isLocalVar": True}, "m_newStringValue": v}
WA, WAN = ["com.whatsapp", "com.whatsapp.w4b"], ["WhatsApp", "WA Business"]
acts = [
    iff([trig(T3, "WhatsApp call")]), sv("cm", "w"), sv("wt", "{not_title}"), sv("wx", "{notification}"),
    ELSE,
    iff([trig(T4, "WhatsApp call khatam")]), sv("cm", "r"),
    ELSE,
    sv("cm", "s"), sv("cn", "{call_number}"),
    iff([trig(T2, "Missed")]), pause(6), ELSE, pause(3), END,   # missed par dono trigger aa sakte hain — alag waqt, cdL se dohra nahi
    END,
    END,
    {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": CLJ, "blockNextAction": True, "responseVariableName": "res", "runInBackgroundThread": True},
]
CL = {"macroExportVersion": 1, "macro": {
    "m_name": "📞 Call diary",
    "m_description": "Har call (SIM + WhatsApp: aayi / gayi / missed) ki ek line phone ke 'NT Awaz/Calls' folder ki mahine wali file mein — tareekh, waqt, naam (saved ho) warna number, kitni der baat hui. FolderSync se Drive mein. Koi popup nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lvar("cm", 2), lvar("wt", 2), lvar("wx", 2), lvar("cn", 2), lvar("res", 2)],
    "m_triggerList": [
        {"m_classType": "CallEndedTrigger", "m_SIGUID": T1, "m_option": 3},
        {"m_classType": "CallMissedTrigger", "m_SIGUID": T2, "m_option": 3},
        {"m_classType": "NotificationTrigger", "m_SIGUID": T3, "m_option": 0, "m_packageNameList": WA, "m_applicationNameList": WAN, "m_excludeApps": False,
         "separateTitleAndMessage": True, "matchOptionTitle": 0, "matchOptionMessage": 2, "messageContent": "incoming|ongoing|missed",
         "enableRegex": True, "ignoreCase": True, "m_ignoreOngoing": False, "m_supressMultiples": True, "m_soundOption": 0},
        {"m_classType": "NotificationTrigger", "m_SIGUID": T4, "m_option": 1, "m_packageNameList": WA, "m_applicationNameList": WAN, "m_excludeApps": False,
         "separateTitleAndMessage": True, "matchOptionTitle": 0, "matchOptionMessage": 2, "messageContent": "ongoing",
         "enableRegex": False, "ignoreCase": True, "m_ignoreOngoing": False, "m_supressMultiples": False, "m_soundOption": 0}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [var(n, 2) for n in ("cdL", "cdWS", "cdWN", "cdWU", "cdWD", "cdWI")], "userIcons": None,
    "aiFeedback": "Call log + All files access ki ijazat."}

if __name__ == '__main__':
    json.dump(CL, open(os.path.join(D, 'calls.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('calls ok', len(acts))
