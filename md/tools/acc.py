# 🛠 MacroDroid accessibility khud ON (Falcon "Screen Content - Accessibility Required") — bank app khuli ho to NAHI
import json, os
D = os.path.dirname(os.path.abspath(__file__))
SVC = ["com.arlosoft.macrodroid/com.arlosoft.macrodroid.MacroDroidAccessibilityService",
       "com.arlosoft.macrodroid/com.arlosoft.macrodroid.action.services.UIInteractionAccessibilityService"]
NMS = ["MacroDroid", "MacroDroid UI Interaction"]
BANK = ["com.hbl.android.hblmobilebanking", "com.ofss.digx.mobile.obdx.bahl", "com.alhabib.digitalapp",
        "com.base.bankalfalah", "com.techlogix.mobilinkcustomer", "pk.com.telenor.phoenix"]
BNM = ["HBL Mobile", "AL Habib Mobile", "AL Habib Digital", "Alfa", "JazzCash", "easypaisa"]
def off(i): return {"m_classType": "AccessibilityServiceStateConstraint", "m_SIGUID": 0, "option": 1, "idList": [SVC[i]], "nameList": [NMS[i]]}
notBank = {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": False, "m_foreground": True,
           "m_packageNameList": BANK, "m_applicationNameList": BNM, "usePackageNameOption": 0, "mechanismOption": 2}
out = {"macroExportVersion": 1, "macro": {
    "m_name": "🛠 Accessibility khud ON",
    "m_description": "Unlock / Falcon khulne par MacroDroid ki dono accessibility services (Screen Content + UI Interaction) band hon to khud ON. Bank app saamne ho to nahi (Bank mode ke liye).",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "m_triggerList": [
        {"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": 112233445566771},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": 112233445566772, "m_launched": True,
         "m_packageNameList": ["com.nxd.falconi"], "m_applicationNameList": ["Falcon-i"], "usePackageNameOption": 0}],
    "m_actionList": [
        {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": [off(0), off(1)], "m_isOrCondition": True},
          {"m_classType": "AccessibilityServiceAction", "m_SIGUID": 0, "option": 0, "idList": SVC, "nameList": NMS},
          {"m_classType": "ToastAction", "m_SIGUID": 0, "m_messageText": "🛠 MacroDroid accessibility ON", "m_duration": 2,
           "m_position": 0, "m_backgroundColor": -14606047, "m_textColor": -1, "useTextOnly": True, "cancelPrevious": True},
        {"m_classType": "EndIfAction", "m_SIGUID": 0}],
    "m_constraintList": [notBank]},
    "globalVariables": [], "userIcons": None, "aiFeedback": "WRITE_SECURE_SETTINGS zaroori."}
json.dump(out, open(os.path.join(D, "acc.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok")
