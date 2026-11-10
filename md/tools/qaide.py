# 🧠 6 Qaide (malik 6 Nov 2026): unlock par random qaida (Urdu) — theme Paani popup jaisi; Paani / Khana ka popup aana ho to NAHI
import json, os, copy
D = os.path.dirname(os.path.abspath(__file__))
from v3 import gv, setv, expr, sstr, iff, END, ELSE, strne, var, UNLOCK
RULES = [["🏛", "Seneca", "Hum haqeeqat se kam, apne khayalon se zyada dukh uthate hain."], ["🏛", "Seneca", "Zindagi chhoti nahi hai, hum us ka bara hissa zaya kar dete hain."], ["👑", "Marcus Aurelius", "Tumhara bas apne zehan par hai, bahar ke waqiyat par nahi. Yeh samajh lo, taqat mil jayegi."], ["👑", "Marcus Aurelius", "Jo rukawat raaste mein hai, wohi raasta ban jati hai."], ["⛓", "Epictetus", "Insaan ko cheezein pareshan nahi kartin, un ke bare mein us ki raaye pareshan karti hai."], ["🌙", "Rumi", "Kal main hoshyar tha, duniya badalna chahta tha. Aaj danishmand hoon, khud ko badal raha hoon."], ["⚡", "Nietzsche", "Jis ke paas jeene ka 'kyun' ho, wo har 'kaise' seh leta hai."], ["🕯", "Pascal", "Insaan ki saari museebatein is se hain ke wo ek kamre mein akela chup nahi baith sakta."], ["🧭", "Kierkegaard", "Zindagi peeche dekh kar samajh aati hai, magar jeeni aage dekh kar parti hai."], ["🌲", "Thoreau", "Kisi cheez ki asal qeemat zindagi ka wo hissa hai jo tum us ke badle dete ho."], ["🎋", "Confucius", "Kitna aahista chal rahe ho yeh aham nahi, jab tak rukte nahi."], ["☯", "Lao Tzu", "Jo doosron ko jaanta hai aqalmand hai; jo khud ko jaanta hai roshan hai."], ["🏛", "Suqraat", "Jis zindagi ko parkha na jaye, wo jeene ke laiq nahi."], ["🪞", "Apne aap se", "Aaj jo kaam tum ne khud kiya, kal wo kaun karega?"], ["🪞", "Apne aap se", "Dukan tumhare baghair ek din chale to kya tootega? Wahi tumhara agla kaam hai."], ["🪞", "Apne aap se", "Masroof hona aur aage barhna do alag cheezein hain. Aaj tum kaun se the?"], ["🪞", "Apne aap se", "Jis par tumhe bharosa nahi, us ko tum ne sikhaya kya hai?"], ["🪞", "Apne aap se", "Jo cheez napi nahi jati, wo sudharti nahi."], ["🪞", "Apne aap se", "Aankhein ek hi jori hain. Dukan doosri ban sakti hai."], ["🪞", "Apne aap se", "Bachon ko tumhara paisa yaad nahi rahega, tumhara waqt yaad rahega."], ["🪞", "Apne aap se", "Aaj ka sab se zaroori kaam kaun sa tha, aur tum ne us ki jagah kya kiya?"], ["🪞", "Apne aap se", "Tum system bana rahe ho, ya system ke mulazim ban gaye ho?"], ["🪞", "Apne aap se", "Agar yeh phone abhi band ho jaye, to kya waqai kuch bigrega?"], ["🪞", "Apne aap se", "Jo faisla tum taal rahe ho, wo bhi ek faisla hai."], ["🪞", "Apne aap se", "Das saal baad ka Samiullah aaj ke kis kaam par shukria kahega?"], ["🪞", "Apne aap se", "Ghussa us par aata hai jo humare bas mein nahi. Kya yeh tumhare bas mein hai?"], ["🪞", "Apne aap se", "Paisa wapas aa jata hai, waqt nahi. Aaj ka waqt kis par kharch hua?"], ["🪞", "Apne aap se", "Tum jis cheez se bhaag rahe ho, wo aksar wahi hoti hai jo tumhe karni hai."], ["🪞", "Apne aap se", "Sasta mulazim sab se mehnga parta hai. Tum kis par bachat kar rahe ho?"], ["🪞", "Apne aap se", "Agar aaj ka din dobara mile, to kaun sa ek ghanta badlo ge?"]]   # v28 (10 Nov, malik: "gehra qoul jo sochne par majboor kare, meri personality jaisa") — Roman Urdu: falsafi + apne aap se sawal
T_UNL = 112233445566771
def lint(n): return {"m_name": n, "m_type": 1, "isLocalVar": True, "m_intValue": 0}
def lexpr(n, e): return setv(n, 1, True, m_intExpression=True, m_expression=e)
def lgt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intGreaterThan": True, "m_intValue": v}
def llt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intLessThan": True, "m_intValue": v}
def leq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intValue": v}
def lbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, True), "m_booleanValue": v}
def gbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0), "m_booleanValue": v}
RAND = setv("qi", 1, True, m_intRandom=True, m_intRandomMin=1, m_intRandomMax=len(RULES))
acts = [
    lexpr("pLeft", "{v=pnDue}-{system_time}"),       # Paani aane mein kitne sec (manfi = abhi aayega)
    lexpr("pShow", "{v=pnShowEnd}-{system_time}"),   # > 0 = Paani popup screen par
    lexpr("kShow", "{v=kpShowEnd}-{system_time}"),   # > 0 = Khana popup screen par
    iff([lgt("pLeft", 120), llt("pShow", 1), llt("kShow", 1), gbool("kpPend", False)]),
      RAND,
]
for i, (ic, t, s) in enumerate(RULES, 1):   # t = falsafi ka naam, s = qoul
    acts += [iff([leq("qi", i)], cls="IfConditionAction" if i == 1 else "ElseIfConditionAction"),
             sstr("qdT", "%s %s" % (ic, t)), sstr("qdM", s), sstr("qdA", t)]
acts += [END,
    iff([lbool("never", True)]),
    {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "{v=qdT}",
     "text": "<big>{v=qdM}</big>", "positiveText": "✅ OK", "negativeText": "✕",
     "cancelAfterTimeout": True, "timeoutSeconds": 10, "htmlFormat": True, "useCustomColors": True, "textColor": -15658735, "bgColor": -1},
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
