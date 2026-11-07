# 🧠 6 Qaide (malik 6 Nov 2026): unlock par random qaida (Urdu) — theme Paani popup jaisi; Paani / Khana ka popup aana ho to NAHI
import json, os, copy
D = os.path.dirname(os.path.abspath(__file__))
from v3 import gv, setv, expr, sstr, iff, END, ELSE, strne, var, UNLOCK
RULES = [
    ("🪞", "اپنی تصویر بدلو", "انسان وہی کرتا ہے جو وہ اپنے بارے میں سوچتا ہے۔ اندر کی تصویر ٹھیک کرو — کام خود بدلے گا۔"),
    ("🎯", "صاف نشانہ دو", "دماغ آٹو پائلٹ ہے: نشانہ صاف ہو تو راستہ خود ڈھونڈتا ہے۔ غلطی = صرف رخ ٹھیک کرنا، رکنا نہیں۔"),
    ("🎬", "اندر کا تھیٹر — روز 30 منٹ", "آنکھیں بند کر کے اپنے آپ کو کام ٹھیک کرتے ہوئے صاف صاف دیکھو۔ دماغ سوچے ہوئے کو بھی تجربہ مانتا ہے۔"),
    ("🩹", "پرانے زخم صاف کرو", "معاف کرو — دوسروں کو بھی، اپنے آپ کو بھی۔ پرانی ناکامی تمہاری پہچان نہیں۔"),
    ("😊", "خوشی ایک عادت ہے", "حالات کا انتظار مت کرو — آج، ابھی خوش رہنے کی مشق کرو۔"),
    ("🧘", "پہلے سکون، پھر فیصلہ", "گھبراہٹ میں آٹو پائلٹ خراب چلتا ہے۔ سانس لو، ریلیکس کرو، پھر فیصلہ۔"),
]
T_UNL = 112233445566771
def lint(n): return {"m_name": n, "m_type": 1, "isLocalVar": True, "m_intValue": 0}
def lexpr(n, e): return setv(n, 1, True, m_intExpression=True, m_expression=e)
def lgt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intGreaterThan": True, "m_intValue": v}
def llt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intLessThan": True, "m_intValue": v}
def leq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intValue": v}
def lbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, True), "m_booleanValue": v}
def gbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0), "m_booleanValue": v}
RAND = setv("qi", 1, True, m_intRandom=True, m_intRandomMin=1, m_intRandomMax=6)
acts = [
    lexpr("pLeft", "{v=pnDue}-{system_time}"),       # Paani aane mein kitne sec (manfi = abhi aayega)
    lexpr("pShow", "{v=pnShowEnd}-{system_time}"),   # > 0 = Paani popup screen par
    lexpr("kShow", "{v=kpShowEnd}-{system_time}"),   # > 0 = Khana popup screen par
    iff([lgt("pLeft", 120), llt("pShow", 1), llt("kShow", 1), gbool("kpPend", False), strne("qdOff", "{dayofmonth}")]),
      RAND,
]
for i, (ic, t, s) in enumerate(RULES, 1):
    acts += [iff([leq("qi", i)], cls="IfConditionAction" if i == 1 else "ElseIfConditionAction"),
             sstr("qdT", "%s قاعدہ %d/6 · %s" % (ic, i, t)), sstr("qdM", s)]
acts += [END,
    iff([lbool("never", True)]),
    {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "{v=qdT}",
     "text": "<div dir=\"rtl\">{v=qdM}<br><br>— سائیکو سائبرنیٹکس</div>", "positiveText": "✅ OK", "negativeText": "🔕 Aaj nahi",
     "cancelAfterTimeout": True, "timeoutSeconds": 60, "htmlFormat": True, "useCustomColors": True, "textColor": -1, "bgColor": -15788246},
    ELSE,
      sstr("qdOff", "{dayofmonth}"),
    END,
    END,
]
out = {"macroExportVersion": 1, "macro": {
    "m_name": "🧠 6 Qaide",
    "m_description": "Unlock par Psycho-Cybernetics ka ek qaida (random, Urdu) — Paani popup jaisa dabba. Paani 2 min mein aane wala ho / Paani ya Khana popup screen par ho to nahi. 🔕 Aaj nahi = aaj phir nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lint("pLeft"), lint("pShow"), lint("kShow"), lint("qi"),
                       {"m_name": "never", "m_type": 0, "isLocalVar": True, "m_booleanValue": False}],
    "m_triggerList": [{"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": T_UNL}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [var("pnDue", 1), var("pnShowEnd", 1), var("kpShowEnd", 1), var("kpPend", 0), var("qdOff", 2), var("qdT", 2), var("qdM", 2)],
    "userIcons": None, "aiFeedback": "Display over other apps ijazat."}
json.dump(out, open(os.path.join(D, "qaide.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(acts))
