import json, os
D = os.path.dirname(os.path.abspath(__file__))

APPS = [
    ("com.hbl.android.hblmobilebanking", "HBL Mobile"),
    ("com.ofss.digx.mobile.obdx.bahl", "AL Habib Mobile"),
    ("com.alhabib.digitalapp", "AL Habib Digital"),
    ("com.base.bankalfalah", "Alfa"),
    ("com.techlogix.mobilinkcustomer", "JazzCash"),
    ("pk.com.telenor.phoenix", "easypaisa"),
    ("com.ubl.ubldigital", "UBL Digital"),
]
PK = [a for a, _ in APPS]
NM = [b for _, b in APPS]
T1, T2, T3 = 112233445566771, 112233445566772, 112233445566773

def gv(name, t):
    return {"m_name": name, "m_type": t, "isLocalVar": False}

def setv(name, t, **kw):
    a = {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": gv(name, t)}
    a.update(kw)
    return a

def expr(name, e):
    return setv(name, 1, m_intExpression=True, m_expression=e)

def boolc(name, val):
    return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(name, 0), "m_booleanValue": val}

def stale():  # koi doosra chakkar zinda nahi (12 sec se dil ki dharkan nahi)
    return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv("bkAge", 1),
            "m_intGreaterThan": True, "m_intValue": 11}

def trig(sig, name):
    return {"m_classType": "TriggerThatInvokedConstraint", "m_SIGUID": 0, "m_siGuidThatInvoked": sig, "m_triggerName": name, "m_not": False}

def notBank():
    return {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": False, "m_foreground": True,
            "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0, "mechanismOption": 2}

def screenOff():
    return {"m_classType": "ScreenOnOffConstraint", "m_SIGUID": 0, "a": True, "m_screenOn": False}

def iff(cons, orc=False, cls="IfConditionAction"):
    a = {"m_classType": cls, "m_SIGUID": 0, "m_constraintList": cons}
    if orc:
        a["m_isOrCondition"] = True
    return a

END = {"m_classType": "EndIfAction", "m_SIGUID": 0}

def pause(s, alarm=True):
    return {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": s, "m_useAlarm": alarm}

def java(code, resp):
    return {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": code, "blockNextAction": True, "responseVariableName": resp}

def toast(msg):
    return {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": msg, "m_duration": 2, "m_position": 0,
            "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True}

SAVE = "\n".join([
    'import android.provider.Settings;',
    'cr = appContext.getContentResolver();',
    'a = Settings.Secure.getString(cr, "enabled_accessibility_services");',
    'b = Settings.Secure.getString(cr, "accessibility_enabled");',
    'c = Settings.Global.getString(cr, "development_settings_enabled");',
    'd = Settings.Global.getString(cr, "adb_enabled");',
    'e = Settings.Global.getString(cr, "adb_wifi_enabled");',
    'if (a == null) a = "";',
    'if (b == null) b = "";',
    'if (c == null) c = "";',
    'if (d == null) d = "";',
    'if (e == null) e = "";',
    'return a + ";" + b + ";" + c + ";" + d + ";" + e;',
])
OFF = "\n".join([
    'import android.provider.Settings;',
    'cr = appContext.getContentResolver();',
    'Settings.Secure.putString(cr, "enabled_accessibility_services", "");',
    'Settings.Secure.putString(cr, "accessibility_enabled", "0");',
    'Settings.Global.putString(cr, "adb_wifi_enabled", "0");',
    'Settings.Global.putString(cr, "adb_enabled", "0");',
    'Settings.Global.putString(cr, "development_settings_enabled", "0");',
    'return "off";',
])
RESTORE = "\n".join([
    'import android.provider.Settings;',
    'cr = appContext.getContentResolver();',
    'p = "{v=bkSave}".split(";", -1);',
    'if (p.length < 5) return "nahi";',
    'Settings.Global.putString(cr, "development_settings_enabled", p[2].length() > 0 ? p[2] : "1");',
    'if (p[3].length() > 0) Settings.Global.putString(cr, "adb_enabled", p[3]);',
    'if (p[4].length() > 0) Settings.Global.putString(cr, "adb_wifi_enabled", p[4]);',
    'String md = "com.arlosoft.macrodroid/com.arlosoft.macrodroid.MacroDroidAccessibilityService:com.arlosoft.macrodroid/com.arlosoft.macrodroid.action.services.UIInteractionAccessibilityService";',
    'String acc = p[0];',
    'if (acc.indexOf("com.arlosoft.macrodroid/") < 0) acc = acc.length() > 0 ? acc + ":" + md : md;',
    'Settings.Secure.putString(cr, "enabled_accessibility_services", acc);',
    'Settings.Secure.putString(cr, "accessibility_enabled", "1");',
    'return "on";',
])

acts = [
    expr("bkAge", "{system_time}-{v=bkBeat}"),
    iff([trig(T1, "Bank app khuli")]),
      iff([boolc("bankOn", False), stale()], orc=True),
        iff([boolc("bankOn", False)]),
          java(SAVE, "bkSave"),
        END,
        setv("bankOn", 0, m_newBooleanValue=True),
        expr("bkBeat", "{system_time}"),
        java(OFF, "bkRes"),
        toast("🏦 Bank mode — Accessibility + Developer options OFF"),
        {"m_classType": "LoopAction", "m_SIGUID": 0, "m_option": 4, "timedDurationValue": 60, "timedTimeUnit": 1},
          expr("bkBeat", "{system_time}"),
          pause(3, False),
          iff([notBank(), screenOff()], orc=True),
            expr("bkBeat", "{system_time}+40"),
            pause(30),
            iff([notBank(), screenOff()], orc=True),
              {"m_classType": "BreakFromLoopAction", "m_SIGUID": 0},
            END,
          END,
        {"m_classType": "EndLoopAction", "m_SIGUID": 0},
        java(RESTORE, "bkRes"),
        setv("bankOn", 0, m_newBooleanValue=False),
        toast("✅ Bank band — Accessibility + Developer options wapas ON"),
      END,
    {"m_classType": "ElseAction", "m_SIGUID": 0},
      iff([boolc("bankOn", True), stale()]),
        pause(15),
        java(RESTORE, "bkRes"),
        setv("bankOn", 0, m_newBooleanValue=False),
        toast("✅ Bank mode reh gaya tha — sab wapas ON"),
      END,
    END,
]

def var(name, t, **kw):
    v = {"m_name": name, "m_type": t, "isLocalVar": False, "m_booleanValue": False, "m_intValue": 0, "m_stringValue": ""}
    v.update(kw)
    return v

out = {
    "macroExportVersion": 1,
    "macro": {
        "m_name": "🏦 Bank mode 3",
        "m_description": "Bank app (HBL, AL Habib, Alfa, JazzCash, easypaisa) khule = saari Accessibility + Developer options + USB debugging OFF (pehle ki haalat yaad). Bank app se hate / screen band 30 sec = sab wapas pehle jaisa. Phone restart par bhi wapas. Wapas lagate waqt MacroDroid ki dono services HAMESHA ON (yaad khali ho tab bhi).",
        "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
        "m_triggerList": [
            {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T1, "m_launched": True,
             "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0},
            {"m_classType": "BootTrigger", "m_SIGUID": T2},
            {"m_classType": "MacroDroidInitialisedTrigger", "m_SIGUID": T3},
        ],
        "m_actionList": acts,
        "m_constraintList": [],
    },
    "globalVariables": [var("bankOn", 0), var("bkSave", 2), var("bkRes", 2), var("bkBeat", 1), var("bkAge", 1)],
    "userIcons": None,
    "aiFeedback": "WRITE_SECURE_SETTINGS (ADB hack) zaroori; Usage Access bhi.",
}
s = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(D, "bank.json"), "w").write(s)
print(len(s))
