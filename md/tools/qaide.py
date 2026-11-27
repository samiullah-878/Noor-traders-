# 🧠 6 Qaide (malik 6 Nov 2026): unlock par random qaida (Urdu) — theme Paani popup jaisi; Paani / Khana ka popup aana ho to NAHI
import json, os, copy
D = os.path.dirname(os.path.abspath(__file__))
from v3 import gv, setv, expr, sstr, iff, END, ELSE, strne, var, UNLOCK
RULES = [["🪞", "Apne aap se", "Aaj jo kaam tum ne khud kiya, kal wo kaun karega?"], ["🏛", "Seneca", "Hum haqeeqat se kam, apne khayalon se zyada dukh uthate hain."], ["🪞", "Apne aap se", "Dukan tumhare baghair ek din chale to kya tootega? Wahi tumhara agla kaam hai."], ["🪞", "Apne aap se", "Masroof hona aur aage barhna do alag cheezein hain. Aaj tum kaun se the?"], ["🏛", "Seneca", "Zindagi chhoti nahi hai, hum us ka bara hissa zaya kar dete hain."], ["🪞", "Apne aap se", "Jis par tumhe bharosa nahi, us ko tum ne sikhaya kya hai?"], ["🪞", "Apne aap se", "Jo cheez napi nahi jati, wo sudharti nahi."], ["👑", "Marcus Aurelius", "Tumhara bas apne zehan par hai, bahar ke waqiyat par nahi. Yeh samajh lo, taqat mil jayegi."], ["🪞", "Apne aap se", "Aankhein ek hi jori hain. Dukan doosri ban sakti hai."], ["🪞", "Apne aap se", "Bachon ko tumhara paisa yaad nahi rahega, tumhara waqt yaad rahega."], ["👑", "Marcus Aurelius", "Jo rukawat raaste mein hai, wohi raasta ban jati hai."], ["🪞", "Apne aap se", "Aaj ka sab se zaroori kaam kaun sa tha, aur tum ne us ki jagah kya kiya?"], ["🪞", "Apne aap se", "Tum system bana rahe ho, ya system ke mulazim ban gaye ho?"], ["⛓", "Epictetus", "Insaan ko cheezein pareshan nahi kartin, un ke bare mein us ki raaye pareshan karti hai."], ["🪞", "Apne aap se", "Agar yeh phone abhi band ho jaye, to kya waqai kuch bigrega?"], ["🪞", "Apne aap se", "Jo faisla tum taal rahe ho, wo bhi ek faisla hai."], ["🌙", "Rumi", "Kal main hoshyar tha, duniya badalna chahta tha. Aaj danishmand hoon, khud ko badal raha hoon."], ["🪞", "Apne aap se", "Das saal baad ka Samiullah aaj ke kis kaam par shukria kahega?"], ["🪞", "Apne aap se", "Ghussa us par aata hai jo humare bas mein nahi. Kya yeh tumhare bas mein hai?"], ["⚡", "Nietzsche", "Jis ke paas jeene ka 'kyun' ho, wo har 'kaise' seh leta hai."], ["🪞", "Apne aap se", "Paisa wapas aa jata hai, waqt nahi. Aaj ka waqt kis par kharch hua?"], ["🪞", "Apne aap se", "Tum jis cheez se bhaag rahe ho, wo aksar wahi hoti hai jo tumhe karni hai."], ["🕯", "Pascal", "Insaan ki saari museebatein is se hain ke wo ek kamre mein akela chup nahi baith sakta."], ["🪞", "Apne aap se", "Sasta mulazim sab se mehnga parta hai. Tum kis par bachat kar rahe ho?"], ["🪞", "Apne aap se", "Agar aaj ka din dobara mile, to kaun sa ek ghanta badlo ge?"], ["🧭", "Kierkegaard", "Zindagi peeche dekh kar samajh aati hai, magar jeeni aage dekh kar parti hai."], ["🪞", "Apne aap se", "Tum kis ki tareef ke liye itni mehnat kar rahe ho?"], ["🪞", "Apne aap se", "Agar paisa masla na hota, to kal subah kya karte?"], ["🌲", "Thoreau", "Kisi cheez ki asal qeemat zindagi ka wo hissa hai jo tum us ke badle dete ho."], ["🪞", "Apne aap se", "Jo kaam tum sirf aadat se kar rahe ho, us ka faida ab bhi hai?"], ["🪞", "Apne aap se", "Aaj kis ne tum se kuch seekha?"], ["🎋", "Confucius", "Kitna aahista chal rahe ho yeh aham nahi, jab tak rukte nahi."], ["🪞", "Apne aap se", "Tumhara sab se achha mulazim kal chhor de, to kya tayyari hai?"], ["🪞", "Apne aap se", "Gahak tumhari dukan par kyun aata hai: rate, bharosa, ya aadat?"], ["☯", "Lao Tzu", "Jo doosron ko jaanta hai aqalmand hai; jo khud ko jaanta hai roshan hai."], ["🪞", "Apne aap se", "Tum ne aakhri dafa 'mujhe nahi pata' kab kaha?"], ["🪞", "Apne aap se", "Jis baat par aaj ghussa aaya, ek saal baad yaad bhi rahegi?"], ["🏛", "Suqraat", "Jis zindagi ko parkha na jaye, wo jeene ke laiq nahi."], ["🪞", "Apne aap se", "Tum mehnat zyada kar rahe ho, ya sahi cheez par kar rahe ho?"], ["🪞", "Apne aap se", "Aaj ghar walon ne tumhara chehra dekha, ya sirf phone ki roshni?"], ["🏛", "Seneca", "Jo har jagah hai, wo kahin nahi hai."], ["🪞", "Apne aap se", "Jo cheez tum control nahi kar sakte, us par aaj kitna waqt gaya?"], ["🪞", "Apne aap se", "Ek cheez jo aaj chhor do to zindagi halki ho jaye, wo kya hai?"], ["🏛", "Seneca", "Jab tak hum taalte rehte hain, zindagi guzar jati hai."], ["🪞", "Apne aap se", "Tum mulazim ko ghalti par daant-te ho, ya tareeqa sikhate ho?"], ["🪞", "Apne aap se", "Karobar bara karna hai ya behtar? Dono ek cheez nahi."], ["🏛", "Seneca", "Qismat wahan milti hai jahan tayyari aur mauqa ikathe hon."], ["🪞", "Apne aap se", "Jism ne aaj kya maanga tha jo tum ne nahi diya?"], ["🪞", "Apne aap se", "Agar tumhara beta tumhe sara din dekhe, to kya seekhega?"], ["👑", "Marcus Aurelius", "Behtareen badla yeh hai ke tum us jaise na bano."], ["🪞", "Apne aap se", "Tum jo jaante ho wo likha hua hai, ya sirf tumhare sar mein hai?"], ["🪞", "Apne aap se", "Sab kuch khud karna taqat nahi, kamzori hai. Aaj kya saunpa?"], ["👑", "Marcus Aurelius", "Jo cheez chhatte ke liye achhi nahi, wo makkhi ke liye bhi achhi nahi."], ["🪞", "Apne aap se", "Aaj shukr kis cheez ka kiya?"], ["🪞", "Apne aap se", "Agla bara faisla dar se kar rahe ho, ya soch se?"], ["⛓", "Epictetus", "Pehle khud se kaho tum kya banna chahte ho, phir wo karo jo karna hai."], ["🪞", "Apne aap se", "Jo dost sach bolta hai, us se aakhri dafa kab mile?"], ["🪞", "Apne aap se", "Nayi cheez banani hai, ya purani ko theek chalana hai?"], ["⛓", "Epictetus", "Ameer wo nahi jis ke paas zyada hai, wo hai jis ki zarooratein kam hain."], ["🪞", "Apne aap se", "Tumhari dukan mein sab se zyada waqt kahan zaya hota hai?"], ["🪞", "Apne aap se", "Aaram bhi kaam ka hissa hai. Aaj us ka hissa diya?"], ["📜", "Arastu", "Ghussa karna aasan hai. Sahi shakhs par, sahi hadd tak, sahi waqt par ghussa karna mushkil hai."], ["🪞", "Apne aap se", "Jis cheez ko tum 'baad mein' keh rahe ho, us ka 'baad' kab hai?"], ["🪞", "Apne aap se", "Log tumhare saath kaam karna chahte hain, ya majboor hain?"], ["🌊", "Heraclitus", "Koi aadmi ek hi darya mein do dafa nahi utarta. Darya bhi badal chuka hota hai aur aadmi bhi."], ["🪞", "Apne aap se", "Nuqsan se mehnga hai nuqsan se na seekhna. Pichhla sabaq kya tha?"], ["🪞", "Apne aap se", "Aaj tum ne suna zyada, ya bola zyada?"], ["📜", "Aflatoon", "Sab se bari fatah apne aap par fatah hai."], ["🪞", "Apne aap se", "Jo aadat tumhe sab se zyada rokti hai, us ka naam lo."], ["🪞", "Apne aap se", "Aaj ki kamai mein se kitna sukoon kamaya?"], ["☯", "Lao Tzu", "Hazaar meel ka safar ek qadam se shuru hota hai."], ["🪞", "Apne aap se", "Jis kaam se dil ghabrata hai, aksar wahi sab se zaroori hota hai. Wo kaun sa hai?"], ["🪞", "Apne aap se", "Tum apne waqt ke malik ho, ya phone ke?"], ["☯", "Lao Tzu", "Jo jaanta hai ke us ke paas kaafi hai, wohi ameer hai."], ["🪞", "Apne aap se", "Ek saal pehle ka masla yaad hai? Aaj wala bhi aise hi guzar jayega."], ["🪞", "Apne aap se", "Chhoti chori maaf karna bari chori ki dawat hai. Tumhara usool kya hai?"], ["🎋", "Confucius", "Jo ghalti kar ke use theek nahi karta, wo doosri ghalti kar raha hai."], ["🪞", "Apne aap se", "Seekhna band, barhna band. Is hafte kya naya seekha?"], ["🪞", "Apne aap se", "Zindagi mehdood hai, yeh yaad ho to chhoti baatein chhoti lagti hain. Aaj kaun si baat bari lag rahi thi?"], ["⚡", "Nietzsche", "Jo cheez mujhe maar nahi deti, mujhe mazboot kar deti hai."], ["🪞", "Apne aap se", "Udhaar dena aasan hai, wapas lena hunar hai. Aaj kis ka khata sota raha?"], ["🪞", "Apne aap se", "Bharosa de kar dekho: log aksar utne hi bare ho jate hain jitna tum unhein samjho."], ["🔭", "Schopenhauer", "Har shakhs apni nazar ki hadd ko duniya ki hadd samajh leta hai."], ["🌙", "Rumi", "Zakhm wo jagah hai jahan se roshni andar aati hai."], ["🌙", "Rumi", "Jo tum dhoond rahe ho, wo bhi tumhe dhoond raha hai."], ["🪶", "Tolstoy", "Har koi duniya badalne ka sochta hai, khud ko badalne ka koi nahi."], ["📊", "Peter Drucker", "Jo kaam hona hi nahi chahiye, use bohat achhe tareeqe se karne se zyada bekaar kuch nahi."], ["💼", "Warren Buffett", "Kamyab aur bohat kamyab logon mein farq yeh hai ke bohat kamyab log taqreeban har cheez ko 'nahi' kehte hain."], ["💼", "Charlie Munger", "Ulta socho: yeh pata ho ke main kahan girunga, to wahan jaun hi na."], ["⚙", "Benjamin Franklin", "Tayyari mein nakaami, nakaami ki tayyari hai."], ["🌳", "Kahawat", "Darakht lagane ka behtareen waqt bees saal pehle tha. Doosra behtareen waqt aaj hai."], ["🌳", "Kahawat", "Sabr talkh hai, magar us ka phal meetha hai."]]   # v29: 2-2 din ki patti (6 baatein), Java se — falsafi + apne aap se sawal (Roman Urdu)
T_UNL = 112233445566771
T_SCR = 112233445566772   # v85: screen ON (phone abhi lock nahi hua tha = unlock ka event hi nahi aata)
# v73 (23 Nov raat — GHALTI): 💧 Paani + ☕ Coffee macro band hue (v72) to pnDue kabhi aage nahi barhta -> 'Paani 2 min mein aane wala' wali shart hamesha jhooti -> Falsafa + recording (Sona hai?) ka popup
#   bhi band ho gaya (malik: 'tum ne wo recording wala pop bhi band kar diya hai'). Paani / Coffee macro dobara CHALU karo to yahan True karo (popup ek doosre par na chadhein).
PAANI_ON = False
def lint(n): return {"m_name": n, "m_type": 1, "isLocalVar": True, "m_intValue": 0}
def lexpr(n, e): return setv(n, 1, True, m_intExpression=True, m_expression=e)
def lgt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intGreaterThan": True, "m_intValue": v}
def llt(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intLessThan": True, "m_intValue": v}
def leq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1, True), "m_intValue": v}
def lbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0, True), "m_booleanValue": v}
def gbool(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 0), "m_booleanValue": v}
RAND = setv("qi", 1, True, m_intRandom=True, m_intRandomMin=1, m_intRandomMax=len(RULES))
PER = 6     # ek patti = 6 baatein, har 2 din nayi patti (malik 10 Nov: "do din ke baad nayi baatein aani chahiye")
def _j(x): return '"' + x.replace('\\', '').replace('"', "'") + '"'
JV = "\n".join(['try {', '  String[] q = new String[] {'] +
     ['    ' + _j("<big>%s</big><br><br>— %s %s" % (t3, ic, nm)) + (',' if k < len(RULES) - 1 else '') for k, (ic, nm, t3) in enumerate(RULES)] +
     ['  };', '  int n = q.length;', '  int per = %d;' % PER, '  int nb = (n + per - 1) / per;',
      '  long d2 = ((System.currentTimeMillis() + 18000000L) / 86400000L) / 2L;', '  int b = (int) (d2 % nb);', '  int from = b * per;',
      '  int i = (from + (int) (Math.random() * per)) % n;', '  return q[i];',
      '} catch (Throwable t) {', '  return "Aaj ka sab se zaroori kaam kaun sa hai?";', '}'])
# v86 (27 Nov, malik: "qoul ko Urdu mein kar do · qoul ki list mein jo video samjhao — wahan se qoul banao" + chuna "Urdu harf" + "sirf video wale"):
#   purane 92 (RULES / JV) BAND — OLD_ON False. Ab qoul = global qoV (🧠 Qoul laao macro Blue Khata ki 🎓 Video samjhao se laata hai: 'urdu‖video§…', naye pehle),
#   baari baari (qoI; naya list aaye to 0 = naye pehle). List khali = qoul nahi (popup mein sirf reminder / sehat / Sona hai). Jawab ke aakhir mein <br><br>.
OLD_ON = False
QOJ = '\n'.join(['try {',
    '  String t = magicText.evaluateString("{" + "v=qoV}"); if (t == null) t = "";',
    '  String[] a = t.split("§"); java.util.ArrayList L = new java.util.ArrayList();',
    '  for (int i = 0; i < a.length; i++) if (a[i].trim().length() > 0) L.add(a[i].trim());',
    '  int n = L.size(); if (n == 0) return "";',
    '  int i = 0; try { i = Integer.parseInt(magicText.evaluateString("{" + "v=qoI}").trim()); } catch (Throwable e1) { i = 0; }',
    '  if (i < 0) i = 0; i = i % n;',
    '  variableSetter.setInt("qoI", i + 1);',
    '  String[] p = ((String) L.get(i)).split("‖");',
    '  String u = p[0].trim(), tt = p.length > 1 ? p[1].trim() : "";',
    '  if (u.length() == 0) return "";',
    '  return "<big>" + u + "</big><br><br><small>— 🎓 " + tt + "</small><br><br>";',
    '} catch (Throwable e) { return ""; }'])
JAVA = {"m_classType": "JavaAction", "m_SIGUID": 0, "scriptText": JV if OLD_ON else QOJ, "blockNextAction": True, "responseVariableName": "qs", "runInBackgroundThread": True}
HEAD = [
    lexpr("pLeft", "{v=pnDue}-{system_time}"),       # Paani aane mein kitne sec (manfi = abhi aayega)
    lexpr("pShow", "{v=pnShowEnd}-{system_time}"),   # > 0 = Paani popup screen par
    lexpr("kShow", "{v=kpShowEnd}-{system_time}"),   # > 0 = Khana popup screen par
]
GATE = [
    iff([lgt("pLeft", 120), llt("pShow", 1), llt("kShow", 1), gbool("kpPend", False)] if PAANI_ON else [lbool("never", False)]),
      JAVA,
]
# v44: lafz "recording" popup par NAHI (malik: "recording ki jagah kuch aur likha aaye jaise Sona hai ya nahi") — chal rahi ho = "Sona hai?" (Sona hai = band) · band ho = "Jaag gaye?" (Jaag gaya = shuru)
# v43 (14 Nov, malik: "isi popup ke andar falsafa aaye aur neeche recording ka sawal — jab dil kare band, jab dil kare on"): popup ka daayan button = recording band / shuru
import rec as REC
from cb import lt as glt, sint
def dlg(state, pos, neg): return {"m_classType": "ElseIfConfirmedThenAction", "m_SIGUID": 0, "title": "🧠 Soch",
     # v86: qs khud <br><br> ke saath khatam hota hai (khali qoul = sirf sawal)
     # v88 GHALTI theek: v87 mein yeh comment line ke BEECH mein tha — positiveText / negativeText comment ban gaye (button ke lafz gayab)
     "text": "{lv=qs}" + state, "positiveText": pos, "negativeText": neg,
     "cancelAfterTimeout": True, "timeoutSeconds": 15, "htmlFormat": True, "useCustomColors": True, "textColor": -15658735, "bgColor": -1}
GATE += [
    iff([glt("recOff", 1)]),
      iff([lbool("never", True)]),
      dlg("😴 <b>Sona hai?</b>", "😴 Sona hai", "Nahi"),
        sint("recOff", 1), REC.STOP,
      END,
    ELSE,
      iff([lbool("never", True)]),
      dlg("☀️ <b>Jaag gaye?</b>", "☀️ Jaag gaya", "Nahi"),
        sint("recOff", 0), *REC.restart(),
      END,
    END,
    END,
]

# v81 (26 Nov, malik: 'tile reminder wala aur doosra — do click karni parti hain · Baad mein wali click khatam · Nahi dabaya to ye bhi hat jaye ·
#   alehda nahi, ikattha — falsafa neeche, ye upar' + 'us ki peeli likhai ho' + OK): reminder baqi hon (rmT) to EK SelectionDialog (remind.py ka maal):
#   upar ☐ reminder (tap = ✓ hata, baqi ke saath dobara), neeche 🧠 falsafa (tap = band), 😴 Sona hai / ☀️ Jaag gaya (recording, phir band), ✕ Nahi.
#   15 s = Nahi (defaultKey w). HIFAZAT: dialog 14+ s khula raha = timeout samjho, KUCH na karo (default ghalat button chune tab bhi reminder na mite).
#   Reminder na hon = purana safed popup (GATE) waise hi. 📝 Reminder macro ka apna unlock trigger HATA (warna do popup).
import remind as RM
from cb import gt as cgt, lt as clt, expr as cexpr, pause as cpause, NOW, strne as cstrne, trig
from wasite import streq
def BR(k, v): return [iff([streq(k, v, True)]), RM.BREAK, END]

# v84 (26 Nov, malik: 'lock screen par jo notification aa raha hai us mein Paani pee lo — neeli line · check box lage to counting Blue Khata app mein ·
#   har dafa wo majood ho · nuts / fruit / coffee time par aaye, dabane par ghayab' + OK): ISI popup mein upar NEELI likhai (message, htmlFormat)
#   + ☐ button (SelectionDialog ke sab button ek rang ke hote hain — is liye 🔵). Sirf SK_FROM–SK_TO (subah 9 – raat 9). Koi app band NAHI.
#   💧 Paani (s1) = har popup mein · tap = +1 bottle (skP), popup band. ☕ s2 / 🍎 s3 / 🥜 s4 = apne waqt ke baad · tap = us din ghayab (skX 'c' / 'f' / 'n'),
#   popup dobara (baqi ke saath, reminder jaisa). Din badla = khud 0 (skD). Har tick = din ka POORA haal (skB) -> Blue Khata sehatTick/<din> (PATCH,
#   wahi chaabi + link jo 🌙 Raat ke sawal ka ✍️ Likho istemal karta hai: ntU / ntK — md/ mein KABHI nahi). Net na ho = skQ 1, har unlock ke aakhir mein dobara.
#   Purane 💧 Paani / ☕ Coffee macro + 📸 Sehat lock band hi hain (malik). AI nahi. Phone par azmaya nahi.
SK_FROM, SK_TO = 9 * 60, 21 * 60      # 9:00 – 20:59 (malik 20 Nov: 'raat 9 ke baad paani ki zaroorat nahi')
SK_GOAL = 6                           # bottle / din (malik ka hadaf, sehat.py GOAL)
CN_AGE = 3 * 86400000                 # v87: 📇 naya number 3 din tak popup mein (phir khud hat)
# v89 (27 Nov raat, malik ne chuna: 'Isi 💬 tile ke popup mein'): naye number ab unlock popup mein NAHI — 💬 WhatsApp tile (wasite.py) mein.
#   CN_POP True = wapas unlock popup mein bhi (malik ke kehne par hi).
CN_POP = False
SK_ITEMS = (("s2", "c", 14 * 60, "☕ Coffee pee lo", "🔵 ☐ Coffee pee li"),
            ("s3", "f", 14 * 60 + 30, "🍎 Fruit kha lo", "🔵 ☐ Fruit kha liya"),
            ("s4", "n", 16 * 60, "🥜 Nuts kha lo", "🔵 ☐ Nuts kha liye"))   # waqt sehat.py ITEMS jaisa
BLUE = "#1565C0"
_SKH = ['  java.util.Calendar c = java.util.Calendar.getInstance();',
        '  String dy = new java.text.SimpleDateFormat("yyyy-MM-dd").format(c.getTime());',
        '  int mi = c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE);',
        '  String od = magicText.evaluateString("{" + "v=skD}"); if (od == null) od = "";',
        '  String x = magicText.evaluateString("{" + "v=skX}"); if (x == null) x = "";',
        '  int p = 0; try { p = Integer.parseInt(magicText.evaluateString("{" + "v=skP}").trim()); } catch (Throwable e1) { p = 0; }',
        '  if (!od.trim().equals(dy)) { p = 0; x = ""; }',
        '  String Q = String.valueOf((char) 34);']
CN_NUMS = [
    '  try {',
    '    String L = magicText.evaluateString("{" + "v=cnList}"); if (L == null) L = "";',
    '    String[] la = L.split("\\n"); long now = System.currentTimeMillis();',
    '    java.util.ArrayList kp = new java.util.ArrayList();',
    '    for (int i = 0; i < la.length; i++) {',
    '      String z = la[i].trim(); if (z.length() == 0) continue;',
    '      String[] f = z.split("[|]"); if (f.length < 4) continue;',
    '      long ms = 0; try { ms = Long.parseLong(f[3].trim()); } catch (Throwable e2) { ms = 0; }',
    '      if (now - ms > %dL) continue;' % CN_AGE,
    '      boolean sv = false;',
    '      try {',
    '        String[] cols = new String[1]; cols[0] = "_id";',
    '        android.net.Uri u = android.net.Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(f[0]));',
    '        android.database.Cursor cu = appContext.getContentResolver().query(u, cols, null, null, null);',
    '        if (cu != null) { sv = cu.getCount() > 0; cu.close(); }',
    '      } catch (Throwable e3) { }',
    '      if (sv) continue;',
    '      kp.add(z);',
    '    }',
    '    StringBuilder lk = new StringBuilder();',
    '    for (int i = 0; i < kp.size(); i++) { if (i > 0) lk.append("\\n"); lk.append((String) kp.get(i)); }',
    '    if (!lk.toString().equals(L.trim())) variableSetter.setString("cnList", lk.toString(), 2);',
    '    for (int i = kp.size() - 1; i >= 0; i--) {',     # naya pehle
    '      String[] f = ((String) kp.get(i)).split("[|]");',
    '      String dg = f[0].replaceAll("[^0-9]", ""); if (dg.length() < 8) continue;',
    '      nj.append(Q + "rz" + dg + Q + ":" + Q + "📇 " + f[1].replace(Q, "") + " · " + (f[2].trim().equals("w") ? "WhatsApp" : "Call") + " — Save karein" + Q + ",");',
    '      cn++;',
    '    }',
    '  } catch (Throwable e4) { }',
]
# SKL: aaj ke sehat button (JSON ka tukda, har ek ke baad ',') -> lv sj · popup ka message -> global skM
SKL = '\n'.join(['try {'] + _SKH + [
    '  String t = magicText.evaluateString("{" + "v=rmT}"); if (t == null) t = "";',
    '  String[] a = t.split("\\n"); int n = 0;',
    '  for (int i = 0; i < a.length; i++) if (a[i].trim().length() > 0) n++;',
    '  StringBuilder sj = new StringBuilder(), msg = new StringBuilder(), nj = new StringBuilder();',
    # v87: 📇 naye number (cnsave.py ka cnList "+92…|0319 …|w|ms") — save ho gaye (PhoneLookup) / 3 din purane hatao, baqi reminder ke neeche (keys rz<hindse>)
    '  int cn = 0;'] + (CN_NUMS if CN_POP else []) + [
    '  if (mi >= %d && mi < %d) {' % (SK_FROM, SK_TO),
    '    msg.append("<font color=\'%s\'><b>💧 Paani pee lo — aaj " + p + "/%d" + (p >= %d ? " ✅" : "") + "</b></font><br>");' % (BLUE, SK_GOAL, SK_GOAL),
    '    sj.append(Q + "s1" + Q + ":" + Q + "🔵 ☐ Paani pee li  (+1 bottle)" + Q + ",");'] +
    sum([['    if (mi >= %d && x.indexOf("%s") < 0) {' % (at, ch),
          '      msg.append("<font color=\'%s\'><b>%s</b></font><br>");' % (BLUE, ln),
          '      sj.append(Q + "%s" + Q + ":" + Q + "%s" + Q + ",");' % (k, bt),
          '    }'] for k, ch, at, ln, bt in SK_ITEMS], []) + [
    '  }',
    '  if (n > 0) msg.append("<b>📝 Aap ke reminder</b> <small><font color=\'#555555\'>· jo ho gaya us par tap ✓</font></small>");',
    '  if (cn > 0) msg.append((n > 0 ? "<br>" : "") + "<b>📇 Naya number</b> <small><font color=\'#555555\'>· tap = naam likh kar Save</font></small>");',
    '  if (n == 0 && cn == 0 && sj.length() > 0) msg.append("<small><font color=\'#555555\'>☐ par tap = gin liya (Blue Khata mein)</font></small>");',
    '  variableSetter.setString("skM", msg.toString());',
    '  return nj.toString() + sj.toString();',   # v87: naye number pehle (reminder r01… ke baad, sehat s1… se pehle)
    '} catch (Throwable e) { return ""; }'])
# NEEDJ: mila hua popup chahiye? (reminder ya sehat line) — "1" / ""
NEEDJ = '\n'.join(['try {',
    '  String t = magicText.evaluateString("{" + "v=rmT}"); if (t == null) t = "";',
    '  String sj = magicText.evaluateString("{" + "lv=sj}"); if (sj == null) sj = "";',
    '  return (t.trim().length() > 0 || sj.trim().length() > 0) ? "1" : "";',
    '} catch (Throwable e) { return ""; }'])
# SKT: chuna button s1…s4 = gin lo + Blue Khata ka body. Jawab: "p" paani (popup band) · "x" coffee / fruit / nuts (popup dobara) · "" = sehat ka button nahi
SKT = '\n'.join(['try {',
    '  String k = magicText.evaluateString("{" + "lv=rk}"); if (k == null) k = "";',
    '  if (!k.matches("s[1-4]")) return "";'] + _SKH + [
    '  if (k.equals("s1")) p = p + 1;'] +
    ['  else if (k.equals("%s") && x.indexOf("%s") < 0) x = x + "%s";' % (k, ch, ch) for k, ch, _a, _l, _b in SK_ITEMS] + [
    '  variableSetter.setString("skD", dy); variableSetter.setInt("skP", p); variableSetter.setString("skX", x);',
    '  String u = magicText.evaluateString("{" + "v=ntU}"); if (u == null) u = "";',
    '  String kk = magicText.evaluateString("{" + "v=ntK}"); if (kk == null) kk = "";',
    '  kk = kk.trim();',
    '  if (u.indexOf("/awazNotes?") > 0 && kk.length() > 0 && kk.indexOf(Q) < 0) {',
    '    String LB = String.valueOf((char) 123), RB = String.valueOf((char) 125);',
    '    String b = LB + Q + "fields" + Q + ":" + LB'
    ' + Q + "k" + Q + ":" + LB + Q + "stringValue" + Q + ":" + Q + kk + Q + RB + ","'
    ' + Q + "d" + Q + ":" + LB + Q + "stringValue" + Q + ":" + Q + dy + Q + RB + ","'
    ' + Q + "p" + Q + ":" + LB + Q + "integerValue" + Q + ":" + Q + p + Q + RB + ","'
    ' + Q + "c" + Q + ":" + LB + Q + "integerValue" + Q + ":" + Q + (x.indexOf("c") >= 0 ? 1 : 0) + Q + RB + ","'
    ' + Q + "f" + Q + ":" + LB + Q + "integerValue" + Q + ":" + Q + (x.indexOf("f") >= 0 ? 1 : 0) + Q + RB + ","'
    ' + Q + "n" + Q + ":" + LB + Q + "integerValue" + Q + ":" + Q + (x.indexOf("n") >= 0 ? 1 : 0) + Q + RB + ","'
    ' + Q + "at" + Q + ":" + LB + Q + "integerValue" + Q + ":" + Q + System.currentTimeMillis() + Q + RB'
    ' + RB + RB;',
    '    variableSetter.setString("skU", u.replace("/awazNotes?", "/sehatTick/" + dy + "?"));',
    '    variableSetter.setString("skB", b); variableSetter.setInt("skQ", 1);',
    '  }',
    '  return k.equals("s1") ? "p" : "x";',
    '} catch (Throwable e) { return ""; }'])
# v87 (27 Nov raat, malik: "save wala nahi chal raha" -> "notification aata hi nahi" -> "Nahi, wo tile (popup) mein aa jaye jaise reminder wala aa raha hai,
#   same waise"): CNO = chuna 📇 number (rk = rz<hindse>) -> phone ki 'Naya contact' screen number bhar kar (ACTION_INSERT) + cnList se hata.
#   Jawab "ok" = popup band (contact screen saamne) · "" = number ka button nahi · "x" = screen nahi khuli (number list mein rehta hai).
CNO = '\n'.join(['try {',
    '  String k = magicText.evaluateString("{" + "lv=rk}"); if (k == null) k = "";',
    '  if (!k.matches("rz[0-9]+")) return "";',
    '  String plus = "+" + k.substring(2);',
    '  android.content.Intent it = new android.content.Intent("android.intent.action.INSERT");',
    '  it.setType("vnd.android.cursor.dir/raw_contact");',
    '  it.putExtra("phone", plus);',
    '  it.putExtra("finishActivityOnSaveCompleted", true);',
    '  it.addFlags(268435456);',
    '  appContext.startActivity(it);',
    '  String L = magicText.evaluateString("{" + "v=cnList}"); if (L == null) L = "";',
    '  String[] la = L.split("\\n"); StringBuilder lk = new StringBuilder();',
    '  for (int i = 0; i < la.length; i++) { String z = la[i].trim(); if (z.length() == 0 || z.startsWith(plus + "|")) continue; if (lk.length() > 0) lk.append("\\n"); lk.append(z); }',
    '  variableSetter.setString("cnList", lk.toString(), 2);',
    '  try { int t = 0; try { t = Integer.parseInt(magicText.evaluateString("{" + "v=cnTp}").trim()); } catch (Throwable e1) { t = 0; } variableSetter.setInt("cnTp", t + 1); } catch (Throwable e2) { }',
    '  return "ok";',
    '} catch (Throwable e) { return "x"; }'])
import re as _re
for _j in (SKL, NEEDJ, SKT, QOJ, CNO):
    assert not _re.search(r'\{(?![\s"])', _j), ('magic text jaisa {', _j)
def gieq(n, v): return {"m_classType": "MacroDroidVariableConstraint", "m_SIGUID": 0, "m_variable": gv(n, 1), "m_intValue": v}
SEND = [iff([gieq("skQ", 1), cstrne("skU", ""), cstrne("skB", "")]),
    {"m_classType": "SetVariableAction", "m_SIGUID": 0, "m_variable": {"m_name": "hc", "m_type": 1, "isLocalVar": True}, "m_newIntValue": 0},
    {"m_classType": "HttpRequestAction", "m_SIGUID": 0, "requestConfig": {"requestType": 4, "urlToOpen": "{v=skU}", "requestTimeOutSeconds": 8, "contentType": "application/json",
     "contentBodySource": 0, "contentBodyText": "{v=skB}", "blockNextAction": True, "followRedirects": True, "headerParams": [], "queryParams": [],
     "saveResponseType": 0, "saveReturnCodeToVariable": True, "returnCodeVariableName": "hc", "useStaticContentBodyFile": True}},
    iff([cgt("hc", 199, True), clt("hc", 300, True)]), sint("skQ", 0), END,
    END]
COMBO = [
    JAVA,
    cpause(1),
      *RM.SAVE,
      RM.LOOP,
        *RM.OPEN,
        RM.sstr("rk", ""),
        RM.java(SKL, "sj"),                            # v84: aaj ke sehat button + neela message (har chakkar taza — tick ke baad ginti badli)
        RM.java(RM.BUILD, "rj"),
        *BR("rj", ""),
        {"m_classType": "JsonParseAction", "m_SIGUID": 0, "stringVarName": "rj", "dictionaryVarName": "ra", "parseColors": False},
        cexpr("dt", NOW, True),
        RM.DIALOG,
        cexpr("dd", NOW + "-{lv=dt}", True),
        iff([cgt("dd", 13, True)]), RM.BREAK, END,  # timeout (15 s) = Nahi — kuch mat karo
        *BR("rk", ""), *BR("rk", "x"), *BR("rk", "v"), *BR("rk", "w"),   # v85: x = qoul, v = ✅ OK (w purana Nahi)
        iff([streq("rk", "u", True)]),
          iff([glt("recOff", 1)]),
            sint("recOff", 1), REC.STOP,
          ELSE,
            sint("recOff", 0), *REC.restart(),
          END,
          RM.BREAK,
        END,
        *([RM.java(CNO, "cq"),                          # v87: 📇 naya number = 'Naya contact' screen + list se hata, popup band
           iff([cstrne("cq", "", True)]), RM.BREAK, END] if CN_POP else []),
        RM.java(SKT, "sk"),                           # v84: s1…s4 = gin lo (sk p / x), baqi = ""
        *BR("sk", "p"),                                # 💧 paani = +1 aur popup band (agle unlock par phir)
        iff([cstrne("sk", "x", True)]),                # ☕ / 🍎 / 🥜 = popup dobara (baqi ke saath) — reminder ka DEL nahi
          RM.java(RM.DEL, "rc"),
          *BR("rc", "0"), *BR("rc", "x"),
        END,
      RM.ENDLOOP,
      *RM.RESTORE,
]
# v84: mila hua popup jab reminder YA sehat line ho (pehle sirf reminder) · aakhir mein Blue Khata ko baqi tick (skQ) — popup ke baad, intezar nahi
# v85 (27 Nov, malik: 'har lock screen ke upar nahi aa raha — ek dafa aata hai, agli dafa nahi, phir lock kar ke kholein to aata hai'):
#   (1) phone screen band hone ke foran baad lock nahi hota (lock ki der) — tab kholne par 'unlock' ka event hi nahi aata. Ab screen ON par bhi
#       chalta hai, magar sirf jab phone LOCK NAHI (lock ho to asal unlock ka intezar — wohi trigger aayega). (2) Purana 20 s ka tala popup
#       BAND hone ke 20 s baad tak rokta tha — ab sirf tab rokta hai jab popup abhi khula ho (rmAt popup ke baad 0).
LOCKED = {"m_classType": "DeviceLockedConstraint", "m_SIGUID": 0, "m_locked": True}
acts = [lexpr("go", "1"),
        iff([trig(T_SCR, "Screen on"), LOCKED]), lexpr("go", "0"), END,
        cexpr("ag", NOW + "-{v=rmAt}", True),
        iff([lgt("go", 0), cgt("ag", 20, True)]),
          cexpr("rmAt", NOW),
          *HEAD, RM.sstr("sj", ""), RM.java(SKL, "sj"), RM.java(NEEDJ, "nd"),
          iff([streq("nd", "1", True)]), *COMBO, ELSE, *GATE, END,
          cexpr("rmAt", "0"),
          *SEND,
        END]
out = {"macroExportVersion": 1, "macro": {
    "m_name": "🧠 Falsafa",
    "m_description": "Unlock par 🎓 Video samjhao se bana ek qoul (Urdu, baari baari — 🧠 Qoul laao macro laata hai; purane 92 band) + 😴 Sona hai. Subah 9 – raat 9 (ya 📝 reminder baqi hon) EK popup: upar neeli likhai 💧 Paani aaj N/6 (+ ☕ 2 baje · 🍎 2:30 · 🥜 4 baje), ☐ tap = gin liya -> Blue Khata 📊 Sehat hisaab; phir reminder (tap = ✓), Sona hai / Jaag gaya, ✅ OK, qoul. Har unlock (aur lock na hua ho to screen ON) par. Koi app band nahi. AI nahi.",
    "m_enabled": True, "m_completed": True, "m_GUID": 0, "aiGenerated": 1, "m_category": "Claude",
    "localVariables": [lint("pLeft"), lint("pShow"), lint("kShow"), lint("qi"), {"m_name": "qs", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "never", "m_type": 0, "isLocalVar": True, "m_booleanValue": False}, {"m_name": "mk", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       lint("ag"), lint("oA"), lint("oS"), lint("dt"), lint("dd"), {"m_name": "rj", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "rk", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "rc", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "ra", "m_type": 4, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "sj", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, {"m_name": "nd", "m_type": 2, "isLocalVar": True, "m_stringValue": ""},
                       {"m_name": "sk", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}, lint("hc"), lint("go"),
                       {"m_name": "cq", "m_type": 2, "isLocalVar": True, "m_stringValue": ""}],
    "m_triggerList": [{"m_classType": "DeviceUnlockedTrigger", "m_SIGUID": T_UNL}, {"m_classType": "ScreenOnOffTrigger", "m_SIGUID": T_SCR, "m_screenOn": True}],
    "m_actionList": acts, "m_constraintList": []},
    "globalVariables": [var("pnDue", 1), var("pnShowEnd", 1), var("kpShowEnd", 1), var("kpPend", 0), var("qdOff", 2), var("qdT", 2), var("qdM", 2), var("qdA", 2), var("recOff", 1), var("rmT", 2), var("rmAt", 1), var("sbAsk", 1), var("shAsk", 1),
                        var("skP", 1), var("skD", 2), var("skX", 2), var("skQ", 1), var("skB", 2), var("skU", 2), var("skM", 2), var("ntU", 2), var("ntK", 2), var("qoV", 2), var("qoI", 1), var("cnList", 2), var("cnTp", 1)] + REC.GV,
    "userIcons": None, "aiFeedback": "Display over other apps ijazat."}
json.dump(out, open(os.path.join(D, "qaide.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(acts))
