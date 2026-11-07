# 🧠 6 Qaide (malik 6 Nov 2026): unlock par random qaida (Urdu) — theme Paani popup jaisi; Paani / Khana ka popup aana ho to NAHI
import json, os, copy
D = os.path.dirname(os.path.abspath(__file__))
from v3 import gv, setv, expr, sstr, iff, END, ELSE, strne, var, UNLOCK
RULES = [["🏛", "ارسطو", "ہم وہی ہیں جو ہم بار بار کرتے ہیں۔ کمال کوئی کام نہیں، عادت ہے۔"], ["🏛", "سقراط", "جس زندگی کا جائزہ نہ لیا جائے وہ جینے کے لائق نہیں۔"], ["🏛", "افلاطون", "سب سے بڑی فتح اپنے آپ پر فتح ہے۔"], ["🛡", "مارکس اوریلیس", "تمہارے ذہن پر تمہاری حکومت ہے، باہر کے واقعات پر نہیں۔ یہ جان لو تو طاقت مل جائے گی۔"], ["🛡", "سینیکا", "ہم حقیقت سے زیادہ اپنے وہم میں دکھ اٹھاتے ہیں۔"], ["🛡", "ایپکٹیٹس", "لوگوں کو چیزیں نہیں ستاتیں، چیزوں کے بارے میں ان کی رائے ستاتی ہے۔"], ["🌙", "مولانا رومی", "کل میں ذہین تھا، دنیا بدلنا چاہتا تھا۔ آج میں دانا ہوں، خود کو بدل رہا ہوں۔"], ["🌙", "مولانا رومی", "زخم وہ جگہ ہے جہاں سے روشنی تم میں داخل ہوتی ہے۔"], ["🌙", "امام غزالی", "علم بغیر عمل کے دیوانگی ہے، اور عمل بغیر علم کے بے فائدہ۔"], ["🌙", "ابن سینا", "جو شک نہیں کرتا وہ تحقیق نہیں کرتا، جو تحقیق نہیں کرتا وہ کبھی نہیں دیکھتا۔"], ["🌙", "علامہ اقبال", "اپنے آپ کو اتنا بلند کرو کہ تقدیر لکھنے سے پہلے تم سے پوچھا جائے۔"], ["🌙", "علامہ اقبال", "خودی کو پہچانو — ہر مشکل کا راستہ تمہارے اندر سے نکلتا ہے۔"], ["☯", "لاؤ زو", "ہزار میل کا سفر ایک قدم سے شروع ہوتا ہے۔"], ["☯", "کنفیوشس", "فرق نہیں پڑتا تم کتنے آہستہ چلتے ہو، جب تک تم رکتے نہیں۔"], ["🎓", "کانٹ", "ایسے عمل کرو جیسے تمہارا ہر فیصلہ سب کے لیے قانون بن جائے۔"], ["🎓", "نطشے", "جس کے پاس جینے کا \"کیوں\" ہے وہ ہر \"کیسے\" سہہ سکتا ہے۔"], ["🏛", "ارسطو", "صبر کڑوا ہے، مگر اس کا پھل میٹھا ہے۔"], ["🛡", "مارکس اوریلیس", "اچھا انسان کیسا ہوتا ہے — اس پر بحث میں وقت ضائع مت کرو۔ بس وہ بن جاؤ۔"], ["🛡", "سینیکا", "خوش قسمتی وہ ہے جب تیاری موقع سے مل جائے۔"], ["🌙", "حضرت علیؓ", "لوگوں سے ایسے ملو کہ مر جاؤ تو روئیں اور زندہ رہو تو تمہاری خواہش کریں۔"]]
T_UNL = 112233445566771
def lint(n): return {"m_name": n, "m_type": 1, "isLocalVar": True, "m_intValue": 0}
def lexpr(n, e): return setv(n, 1, True, m_intExpression=True, m_expression=e)
def lgt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intGreaterThan": True, "m_intValue": v}
def llt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intLessThan": True, "m_intValue": v}
def leq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intValue": v}
def lbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, True), "m_booleanValue": v}
def gbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0), "m_booleanValue": v}
RAND = setv("qi", 1, True, m_intRandom=True, m_intRandomMin=1, m_intRandomMax=20)
acts = [
    lexpr("pLeft", "{v=pnDue}-{system_time}"),       # Paani aane mein kitne sec (manfi = abhi aayega)
    lexpr("pShow", "{v=pnShowEnd}-{system_time}"),   # > 0 = Paani popup screen par
    lexpr("kShow", "{v=kpShowEnd}-{system_time}"),   # > 0 = Khana popup screen par
    iff([lgt("pLeft", 120), llt("pShow", 1), llt("kShow", 1), gbool("kpPend", False), strne("qdOff", "{dayofmonth}")]),
      RAND,
]
for i, (ic, t, s) in enumerate(RULES, 1):   # t = falsafi ka naam, s = qoul
    acts += [iff([leq("qi", i)], cls="IfConditionAction" if i == 1 else "ElseIfConditionAction"),
             sstr("qdT", "%s فلسفہ · %s" % (ic, t)), sstr("qdM", s), sstr("qdA", t)]
acts += [END,
    iff([lbool("never", True)]),
    {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "{v=qdT}",
     "text": "<div dir=\"rtl\">{v=qdM}<br><br>— {v=qdA}</div>", "positiveText": "✅ OK", "negativeText": "✕",
     "cancelAfterTimeout": True, "timeoutSeconds": 12, "htmlFormat": True, "useCustomColors": True, "textColor": -1, "bgColor": -15788246},
    END,
    END,
]
out = {"macroExportVersion": 1, "macro": {
    "m_name": "🧠 Falsafa",
    "m_description": "Unlock par falasifa ka ek qoul (random, Urdu, 12 s baad khud band) — Paani popup jaisa dabba. Paani 2 min mein aane wala ho / Paani ya Khana popup screen par ho to nahi. 🔕 Aaj nahi = aaj phir nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lint("pLeft"), lint("pShow"), lint("kShow"), lint("qi"),
                       {"m_name": "never", "m_type": 0, "isLocalVar": True, "m_booleanValue": False}],
    "m_triggerList": [{"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": T_UNL}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [var("pnDue", 1), var("pnShowEnd", 1), var("kpShowEnd", 1), var("kpPend", 0), var("qdOff", 2), var("qdT", 2), var("qdM", 2), var("qdA", 2)],
    "userIcons": None, "aiFeedback": "Display over other apps ijazat."}
json.dump(out, open(os.path.join(D, "qaide.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(acts))
