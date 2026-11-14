# 🎙 Recording (malik 14 Nov 2026: "recording wala abhi chahiye jo har time recording kare · jab mera dil kare band karun, jab dil kare on ·
#   lock ke upar jo popup aata hai (Falsafa) usi ke andar neeche recording ka sawal · jaise dukan par hoon / sona hai to band · Drive (googel6235) mein upload")
#   Yeh macro: har 10 minute pichhla tukda band (file save) + naya shuru — jab tak global recOff = 0. Call ke dauran naya tukda nahi.
#   On / off: 🧠 Falsafa ke popup ka button (qaide.py — recOff 0 / 1 + foran stop / start). recOff naya global = 0 = recording CHALU (malik ne 'abhi chahiye' kaha).
#   Files: /storage/emulated/0/NT Awaz/NT_<saal>-<mahina>-<din>_<ghanta>-<minute> (AAC, 32 kbps ~ 2.4 MB / 10 min). Kabhi khud nahi mit-ti.
#   Drive: MacroDroid khud Drive par upload NAHI kar sakta — phone ka folder "NT Awaz" FolderSync se Drive mein (4 Nov wala setup; malik ko bataya).
#   Phone par test nahi. AI nahi.
import json, os
from cb import lt, iff, END, pause, var
D = os.path.dirname(os.path.abspath(__file__))
DIR = "/storage/emulated/0/NT Awaz"
T1 = 112233445567201
NO_CALL = {'m_classType': 'InCallConstraint', 'm_SIGUID': 0, 'm_inCall': False}
MKDIR = {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": 'try { new java.io.File("%s").mkdirs(); } catch (Throwable t) {}\nreturn "ok";' % DIR,
         "blockNextAction": True, "responseVariableName": "mk", "runInBackgroundThread": True}
def rec(secs): return {"m_classType": "RecordMicrophoneAction", "m_SIGUID": 0, "m_secondsToRecordFor": secs, "m_recordingFormat": 2, "source": 0,
                       "audioBitRate": 32000, "audioSamplingRate": 44100, "useAllFilesAccess": True, "allFilesPath": DIR,
                       "customFilename": "NT_{year}-{month_digit}-{dayofmonth}_{hour}-{minute}"}
START, STOP = rec(-1), rec(-2)
# pehle band (file save), phir naya — do recording kabhi ek saath nahi
def restart(): return [MKDIR, STOP, pause(2), iff([NO_CALL]), START, END]
a = [STOP, pause(2), iff([lt("recOff", 1), NO_CALL]), MKDIR, START, END]
RC = {"macroExportVersion": 1, "macro": {
    "m_name": "🎙 Recording",
    "m_description": "Har 10 minute naya tukda (folder NT Awaz) jab tak recording CHALU ho. Band / shuru = Falsafa ke popup ka button. Call ke dauran nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1,
    "localVariables": [{"m_name": "mk", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}],
    "m_triggerList": [{"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 600, "m_useAlarm": False}],
    "m_actionList": a, "m_constraintList": []},
    "globalVariables": [var("recOff")],
    "userIcons": None, "aiFeedback": "Microphone + All files access ki ijazat."}
if __name__ == '__main__':
    json.dump(RC, open(os.path.join(D, 'rec.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('rec ok', len(a))
