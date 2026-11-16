# 🌙 Raat 12-11 band (malik 17 Nov 01:22: purana '⛔ Subah 11 tak' band, "naya micro bana lo")
#   Raat 12:00 se subah 10:59 tak SIRF yeh apps band (Home + 3 s patti): Settings, Play Store, MacroDroid, Claude,
#   Facebook / Messenger / Lite, Instagram / Threads, TikTok, Snapchat, X, YouTube, Netflix, Prime Video, games.
#   HIFAZAT: koi variable / OR / LogicConstraint nahi — sirf PACKAGE LIST (trigger + ActiveApplicationConstraint).
#   List se bahar ki app kabhi band nahi ho sakti (WhatsApp, bank, call, Chrome… sab khuli). AI nahi.
import json, os
D = os.path.dirname(os.path.abspath(__file__))
APPS = [
    ("com.android.settings", "Settings"), ("com.android.vending", "Play Store"), ("com.arlosoft.macrodroid", "MacroDroid"),
    ("com.anthropic.claude", "Claude"),
    ("com.facebook.katana", "Facebook"), ("com.facebook.lite", "Facebook Lite"), ("com.facebook.orca", "Messenger"), ("com.facebook.mlite", "Messenger Lite"),
    ("com.instagram.android", "Instagram"), ("com.instagram.lite", "Instagram Lite"), ("com.instagram.barcelona", "Threads"),
    ("com.zhiliaoapp.musically", "TikTok"), ("com.ss.android.ugc.trill", "TikTok"), ("com.zhiliaoapp.musically.go", "TikTok Lite"),
    ("com.snapchat.android", "Snapchat"), ("com.twitter.android", "X"),
    ("com.google.android.youtube", "YouTube"), ("com.google.android.apps.youtube.music", "YouTube Music"),
    ("com.netflix.mediaclient", "Netflix"), ("com.amazon.avod.thirdpartyclient", "Prime Video"),
    ("com.dts.freefireth", "Free Fire"), ("com.dts.freefiremax", "Free Fire MAX"), ("com.tencent.ig", "PUBG Mobile"),
    ("com.pubg.imobile", "BGMI"), ("com.roblox.client", "Roblox"), ("com.supercell.clashofclans", "Clash of Clans"),
    ("com.king.candycrushsaga", "Candy Crush"), ("com.miniclip.eightballpool", "8 Ball Pool"), ("com.ludo.king", "Ludo King"),
    ("com.kiloo.subwaysurf", "Subway Surfers"), ("com.mojang.minecraftpe", "Minecraft"),
]
PK = [p for p, _ in APPS]; NM = [n for _, n in APPS]
T1, T2 = 112233445566691, 112233445566692
FG = {"m_classType": "ActiveApplicationConstraint", "m_SIGUID": 0, "m_active": True, "m_foreground": True,
      "m_packageNameList": PK, "m_applicationNameList": NM, "usePackageNameOption": 0, "mechanismOption": 0}
def ft(text): return {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 0, "identifier": "ntrb", "textToDisplay": text,
    "bgColor": -15788246, "textColor": -1, "alpha": 92, "updateLocation": False, "xPosition": 0.5, "yPosition": 0.04, "padding": 8, "textSize": 16,
    "corners": 14, "alignment": 0, "moveOption": 0, "variableWidth": True, "widthPercentage": 90, "showOverStatusBar": False, "enableShadow": True}
a = [
    {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 1, "m_useAlarm": False},
    {"m_classType": "IfConditionAction", "m_SIGUID": 0, "m_constraintList": [FG]},
      {"m_classType": "LaunchHomeScreenAction", "m_SIGUID": 0, "useAccessibilityService": True},
      ft("⛔ Subah 11 baje khulega"),
      {"m_classType": "PauseAction", "m_SIGUID": 0, "m_delayInSeconds": 3, "m_useAlarm": False},
      {"m_classType": "FloatingTextAction", "m_SIGUID": 0, "option": 1, "identifier": "ntrb"},
    {"m_classType": "EndIfAction", "m_SIGUID": 0},
]
RB = {"macroExportVersion": 1, "macro": {
    "m_name": "🌙 Raat 12-11 band",
    "m_description": "Raat 12 se subah 11 tak SIRF list wali apps band (Settings, Play Store, MacroDroid, Claude, social media, YouTube, Netflix, Prime, games). Baqi sab khuli. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [],
    "m_triggerList": [
        {"m_classType": "RegularIntervalTrigger", "m_SIGUID": T1, "m_seconds": 30, "m_useAlarm": False},
        {"m_classType": "ApplicationLaunchedTrigger", "m_SIGUID": T2, "m_launched": True, "isAllApps": False,
         "m_packageNameList": PK, "m_applicationNameList": NM}],
    "m_actionList": a,
    "m_constraintList": [{"m_classType": "TimeOfDayConstraint", "m_SIGUID": 0, "m_startHour": 0, "m_startMinute": 0, "m_endHour": 10, "m_endMinute": 59}]},
    "globalVariables": [], "userIcons": None}
if __name__ == '__main__':
    json.dump(RB, open(os.path.join(D, 'raatband.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print('raatband ok', len(PK))
