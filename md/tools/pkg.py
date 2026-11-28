# Claude Remote: md/pkg.json banata hai (fixed GUID + har item ka apna SIGUID)
import json, os, hashlib, copy, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from full import to_full
D = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(D)  # md/

def h64(s):
    v = int.from_bytes(hashlib.sha256(s.encode()).digest()[:8], 'big', signed=True)
    return v if v != 0 else 1

def fix(export, guid, name):
    export = to_full(copy.deepcopy(export))
    m = copy.deepcopy(export['macro'])
    m['m_GUID'] = guid; m['aiGenerated'] = 0; m['m_name'] = name
    m.setdefault('m_category', 'Claude')
    m['m_category'] = 'Claude'
    ph = {}   # purane placeholder SIGUID -> naya
    for i, t in enumerate(m['m_triggerList']):
        new = h64(f'{name}|T|{i}'); ph[t['m_SIGUID']] = new; t['m_SIGUID'] = new
    n = [0]
    def walk(o):
        if isinstance(o, dict):
            if 'm_classType' in o and o is not None:
                if o.get('m_classType') == 'TriggerThatInvokedConstraint':
                    o['m_siGuidThatInvoked'] = ph.get(o['m_siGuidThatInvoked'], o['m_siGuidThatInvoked'])
                if not o['m_classType'].endswith('Trigger'):
                    n[0] += 1; o['m_SIGUID'] = h64(f'{name}|X|{n[0]}')
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(m['m_actionList']); walk(m.get('m_constraintList', []))
    return m, export.get('globalVariables', [])

paani = json.load(open(os.path.join(D, 'paani3.json')))
khana = json.load(open(os.path.join(D, 'khana2.json')))
acc = json.load(open(os.path.join(D, 'acc.json')))
tk = json.load(open(os.path.join(D, 'tiktok.json')))
wl = json.load(open(os.path.join(D, 'waleed.json')))
qd = json.load(open(os.path.join(D, 'qaide.json')))
fy = json.load(open(os.path.join(D, 'fbyt.json')))
sv = json.load(open(os.path.join(D, 'saved.json')))
bk = json.load(open(os.path.join(D, 'bank.json')))
hp = json.load(open(os.path.join(D, 'haptic.json')))   # v23: ⌨️ haptics (chat link wala '⌨️ Keyboard haptics ON (Battery saver)' off — malik: 'notification nahi, auto off')
import remote as RM
rem = json.loads(json.dumps(RM.REMOTE))
OLD_PAANI_BREAK = -6917313488054668512          # purane "💧 Paani break" ka GUID — usi jagah naya aa jayega
import brk as BRM
# v41 (14 Nov): paani ke popup ke foran baad "10 minute ka break?" — dialog ke EndIf ke baad jorna
# v48 (16 Nov, malik: '10 minute wala band karna tha'): break ka sawal HATA — BRM.ask() mat jodo jab tak malik na kahe
# v56 (19 Nov): 📸 Sehat lock — paani har 40 min + popup '📸 Photo do' (sehat.PA = paani3 badla), khana ki jagah ☕ Coffee · Fruit · Nuts (WAHI GUID), naya lock macro
import sehat as SH
paani = SH.PA
mp, vp = fix(paani, OLD_PAANI_BREAK, '💧 Paani')
mk, vk = fix(SH.KH, h64('claude|khana'), '☕ Coffee · Fruit · Nuts')
msl, vsl = fix(SH.SL, h64('claude|sehatlock'), '📸 Sehat lock')
ma, va = fix(acc, h64('claude|acc'), '🛠 Accessibility khud ON')
mr, vr = fix(rem, h64('claude|remote5'), '🤖 Claude Remote 5')
mt, vt = fix(tk, h64('claude|tiktok'), '📵 TikTok reels')
mw, vw = fix(wl, h64('claude|waleed'), '🔊 Waleed Bhai')   # ek din ka tha (6 Nov) — ab pkg mein nahi, off mein
mq, vq = fix(qd, h64('claude|qaide'), '🧠 Falsafa')
mf, vf = fix(fy, h64('claude|fbyt'), '📘▶️ Facebook · YouTube')
ms, vs = fix(sv, h64('claude|saved'), '🔖 TikTok Saved')
mb, vbk = fix(bk, h64('claude|bank3'), '🏦 Bank mode 3')
mh, vh = fix(hp, h64('claude|haptic'), '⌨️ Haptics ON')
import st as STM
mst, vst = fix(json.loads(json.dumps(STM.ST)), h64('claude|screentime'), '📱 Screen time')   # v25 (10 Nov): Paani popup ke screen time ka andaza
import big as BGM
mbg, vbg = fix(json.loads(json.dumps(BGM.BG)), h64('claude|barilikhai'), '🔎 Bari likhai')   # v26 (10 Nov): WhatsApp + Claude mein likhai bari
import cb as CBM
mcb, vcb = fix(json.loads(json.dumps(CBM.CB)), h64('claude|claudebreak'), '⏸ Claude break')   # v27 (10 Nov): Claude app ki hadein
import hs as HSM
mhs, vhs = fix(json.loads(json.dumps(HSM.HS)), h64('claude|hotspotpopup'), '📶 Hotspot popup band')   # v30 (11 Nov)
import raat as RTM
mrt, vrt = fix(json.loads(json.dumps(RTM.RT)), h64('claude|raatkesawal'), '🌙 Raat ke sawal')   # v31 (11 Nov): raat 8:30 / 9:15 ke popup — koi app band nahi
import subah as SBM
msb, vsb = fix(json.loads(json.dumps(SBM.SB)), h64('claude|subah11'), '⛔ Subah 11 tak')   # v32 (12 Nov): raat 12 se subah 11 tak sab apps band
import ghari as GHM
mgh, vgh = fix(json.loads(json.dumps(GHM.GH)), h64('claude|ghariauto'), '⏰ Ghari auto')   # v37 (14 Nov): ghari hamesha auto — time badal kar hadein na khulein
import hsbs as HBM
mhb, vhb = fix(json.loads(json.dumps(HBM.HSBS)), h64('claude|hotspotsaver'), '📶 Hotspot = saver band')   # v38 (14 Nov): hotspot ON = NT Battery Saver macro band, OFF = wapas
import anim as ANM
man, van = fix(json.loads(json.dumps(ANM.AN)), h64('claude|animtez'), '⚡ Animation tez')   # v39 (14 Nov): animations 0.5x
mbr, vbr = fix(json.loads(json.dumps(BRM.BR)), h64('claude|break10'), '🧘 10 min break')   # v41 (14 Nov): paani popup par Haan = 10 min sab apps band (subah wali list)
import rec as RCM
mrc, vrc = fix(json.loads(json.dumps(RCM.RC)), h64('claude|recording'), '🎙 Recording')   # v43 (14 Nov): har 10 min ka tukda jab tak recOff = 0; band / shuru Falsafa ke popup se
import jagah as JGM
mjg, vjg = fix(json.loads(json.dumps(JGM.JG)), h64('claude|jagah'), '📍 Jagah ka naam')   # v47 (15 Nov): nayi jagah ka naam ek dafa -> recording us naam ke folder mein
import raatband as RBM
mrb, vrb = fix(json.loads(json.dumps(RBM.RB)), h64('claude|raatband'), '🌙 Raat 12-11 band')   # v53 (17 Nov): purana ⛔ Subah 11 tak band, yeh naya — sirf package list, koi OR / variable nahi
import nabz as NBM
mnb, vnb = fix(json.loads(json.dumps(NBM.NB)), h64('claude|nabz'), '🚨 Dukan nigrani')   # v55 (17 Nov): dukan ka system ruke to awaaz + screen par patti (PC pcBeat/<chaabi>, chaabi app se webhook)
import alfa as ALM
mal, val = fix(json.loads(json.dumps(ALM.AL)), h64('claude|alfa'), '🏦 Alfa notification')   # v57 (19 Nov): Alfa app ki BAF A/C notification -> bankSms (chaabi app se webhook nt_bank)
import khaasvol as KVM
mkv, vkv = fix(json.loads(json.dumps(KVM.KV)), h64('claude|khaasvol'), '📞 Khaas: ghanti full'); mkv['m_name'] = '📞 Khaas log · SIM call · ghanti poori'   # v59 ringer 20% tha · v60 (20 Nov, malik): wahi GUID = silent mein bhi ghanti full
mkb, vkb = fix(json.loads(json.dumps(KVM.KB)), h64('claude|khaasbaat'), '📞 Khaas: baat 20%'); mkb['m_name'] = '📞 Khaas log · SIM call · baat dheemi'   # v60: baat ki awaaz 20% (SIM in/out + WhatsApp)
import wasite as WSM
mwa, vwa = fix(json.loads(json.dumps(WSM.WA)), h64('claude|wa'), '💬 WhatsApp bina save')   # v89: pehle naye unsaved number ki list (📇 Save karo / 💬 WhatsApp), phir khana   # v76 (25 Nov, malik ka OK): tile 1 -> number likho / paste -> WhatsApp chat (bina save)
mws, vws = fix(json.loads(json.dumps(WSM.SITE)), h64('claude|site'), '🌐 Koi bhi site')   # v76: tile 2 -> Firefox Focus (na ho to google.com)
import cnsave as CNM
mcn, vcn = fix(json.loads(json.dumps(CNM.CN)), h64('claude|cnsave'), '📇 Naya number save')   # v89: list 💬 tile mein (unlock popup mein nahi)   # v88: notification / patti NAHI — naya number cnList mein, 🧠 Falsafa ke unlock popup mein reminder ke neeche (malik: 'reminder wala jaise')   # v77 (25 Nov, malik ka OK): WhatsApp / call par unsaved number -> notification -> 'Naya contact' screen   # v83 (26 Nov raat, malik: 'nahi chal raha'): WhatsApp ke chhupe harf saaf, channel HIGH (upar popup), w4b, ginti cnW / cnC / cnOk / cnR
import aankh as AKM
mak, vak = fix(json.loads(json.dumps(AKM.AK)), h64('claude|aankh'), '👁 Aankh ka aram')   # v78 (25 Nov, malik: 'only 1'): shaam 7 - subah 7 peeli roshni + dark + auto brightness, subah wapas pehle jaisa
import calls as CLM
mcl, vcl = fix(json.loads(json.dumps(CLM.CL)), h64('claude|calldiary'), '📞 Call diary')   # v79 (26 Nov, malik ka OK): har SIM + WhatsApp call ki line 'NT Awaz/Calls/Calls <mahina>.csv' mein (FolderSync -> Drive)
import remind as RMM
mrm, vrm = fix(json.loads(json.dumps(RMM.RM)), h64('claude|remind'), '📝 Reminder')   # v81: unlock trigger hata — Falsafa (mq) ka EK popup dikhata hai   # v80 (26 Nov, malik ka OK): tile 3 se likho, har unlock par peeli likhai, tap = ✓ hata
import khaaswa as KWM
mkw, vkw = fix(json.loads(json.dumps(KWM.KW)), h64('claude|khaaswa'), '📞 Khaas: WhatsApp ghanti'); mkw['m_name'] = '📞 Khaas log · WhatsApp call · ghanti poori'   # v85 (27 Nov, malik ka OK): KV ke chune contacts ki WhatsApp call = silent mein bhi ghanti (naam phone par KV se, md/ mein nahi)
mkw2, vkw2 = fix(json.loads(json.dumps(KWM.KW2)), h64('claude|khaaswa20'), '📞 Khaas: WhatsApp 20%'); mkw2['m_name'] = '📞 Khaas log · WhatsApp call · baat dheemi'   # v85: wahi contacts se WhatsApp baat = awaaz 20% (KB ka WhatsApp hissa NAAM1|NAAM2 par ruka tha)
# ⚠️ ONCE: har pkg update Overwrite by ID karta hai — yeh macro SIRF v59 mein, warna malik ke chune contacts mit jayenge. Agle version mein kabhi mat daalo.
import qoul as QLM
mql, vql = fix(json.loads(json.dumps(QLM.QL)), h64('claude|qoul'), '🧠 Qoul laao')   # v87 (27 Nov, malik: qoul Urdu mein + Video samjhao se): Firestore qoulPh/<chaabi> -> qoV (har 30 min + webhook nt_qoul)
import shot as SHM
msh, vsh = fix(json.loads(json.dumps(SHM.SHOT)), h64('claude|shot'), '📸 Screenshot diary')   # v90 (27 Nov, malik: 'screenshot auto upload + detail meri apps mein' + chuna 2 · Blue Khata / bank / Chrome nahi): nayi screenshot -> Firestore shotIn (chaabi ntK, webhook nt_shot)
import clip as CPM
mcp, vcp = fix(json.loads(json.dumps(CPM.CT)), h64('claude|clip'), '📋 Clipboard')   # v93 (28 Nov, malik ka OK): tile 4 — copy ki hui cheezon ki list, tap = copy; ➕ / 📌 / 🗑; Shizuku se READ_LOGS
mcc, vcc = fix(json.loads(json.dumps(CPM.CC)), h64('claude|clipcap'), '📋 Clipboard yaad')   # v93: jo copy ho wo khud list mein (bank app / OTP / lamba nahi)
ONCE = {'60': [mkv, mkb]}   # v59 = [mkv] (purana ringer 20%)
vars_, seen = [], set()
# 🏦 Bank mode (chat link, phone par) ke globals — link import banata nahi (7 Nov: "Variable does not exist (bkSave)")
def _gv(n, t, **kw):
    v = {"m_name": n, "m_type": t, "isLocalVar": False, "m_booleanValue": False, "m_intValue": 0, "m_stringValue": ""}; v.update(kw); return v
vb = [_gv("bankOn", 0), _gv("bkSave", 2), _gv("bkRes", 2), _gv("bkBeat", 1), _gv("bkAge", 1)]
for v in vp + vk + vt + vq + vf + vb + vcb + vsb + vbr + vrt + vrc + vjg + vnb + vsl + val + vwa + vws + vcn + vak + vcl + vrm + vkw + vkw2 + vql + vsh + vcp + vcc:
    if v['m_name'] not in seen: seen.add(v['m_name']); vars_.append(v)
ver = sys.argv[1]
pkg = {"v": ver,
       "note": "📋 Clipboard: naya tile 4 — jo copy karein wo khud list mein, tap = copy, phir paste. ➕ likh kar save · 📌 pakka · 🗑 hatao. Pehli dafa tile dabane par Shizuku se ijazat.",
       "macros": [ma, mr, mt, mq, mf, ms, mb, mh, mbg, mcb, mhs, mrt, mrb, mgh, mhb, man, mrc, mjg, mnb, mal, mwa, mws, mcn, mak, mcl, mrm, mkw, mkw2, mql, msh, mcp, mcc] + ONCE.get(ver, []),   # v93: mcp / mcc 📋 Clipboard   # v90: msh 📸 Screenshot diary   # v87: mql 🧠 Qoul laao   # v85: mkw / mkw2 WhatsApp khaas contacts   # v80: mrm 📝 Reminder   # v79: mcl 📞 Call diary   # v77: mcn 📇 Naya number save   # v76 (25 Nov): mwa 💬 WhatsApp bina save + mws 🌐 Koi bhi site (naye)   # v75 (25 Nov): mst (📱 Screen time) RUKA — malik ka OK (Paani band, har 1 min faltu)   # v71 (23 Nov raat): msl RUKA — malik: 'wo paani wala droid band kar do abhi'   # v69 (22 Nov raat): msl wapas CHALU (8 baje hisaab) — malik: 'us ko on kar do'   # v68 (22 Nov): msl RUKA — malik: 'wo off kar do paani coffee wala'   # v63 (21 Nov raat): msl wapas CHALU — malik: 'paani wala on kar do'   # v62 (21 Nov): msl (📸 Sehat lock) RUKA — malik: 'abhi pause kar do, shop par nahi hoon' (dobara chalu = msl wapas yahan + off se hatao)   # v56: msl = 📸 Sehat lock   # v36: mq (🧠 Falsafa) wapas — v35 mein ghalti se band hua tha
       "patch": [{"nm": "Falcon km", "cls": "TimeOfDayConstraint", "set": {"m_startHour": 21, "m_startMinute": 0}},
                 # v65 (21 Nov): Remote 5 ka patch HATA — patch phone ki PURANI copy ko dobara package mein daal deta tha (wahi ID) = Remote ka naya code kabhi na lagta; 60 s ab remote.py mein
                 {"nm": "Falcon km", "cls": "DeviceUnlockedTrigger", "set": {"m_isDisabled": True}}],   # v24 (10 Nov, malik: raat wala band, haath se theek)
       "ren": [{"nm": "Khaas: ghanti full", "to": "📞 Khaas log · SIM call · ghanti poori"}, {"nm": "Khaas: baat 20%", "to": "📞 Khaas log · SIM call · baat dheemi"}],   # v91 (28 Nov, malik: 'names mein confusion — kaam ke mutabiq likh do'): phone ki copy ka SIRF naam badlo (chune contacts wahi) — Remote ka naya ren v91 se lagta hai, asar v92 par
       "vars": vars_,
       "off": ["📸 Sehat lock", "💧 Paani", "☕ Coffee · Fruit · Nuts", "📱 Screen time", "Pani aur Fruit Reminder"],   # v75 (25 Nov, malik ka OK): Screen time + Pani aur Fruit Reminder band; Mobiel locked phone par hai hi nahi, Keyboard haptics ab DELETE   # v72 (23 Nov raat): Paani + Coffee ki yaad bhi RUKI (malik: wo bhi band); 10 min break / Subah 11 tak list se nikle (pkg mein nahi, phone par pehle se band - 5 ki hadd)   # v71: Sehat lock ruka (malik)   # v69: Sehat lock chalu (off se hata)   # v68: Sehat lock ruka (malik)   # v63: Sehat lock wapas chalu (off se hata)   # v62: Sehat lock malik ke kehne par ruka   # v53: malik ne kaha purana band   # v50 (17 Nov): malik ka apna "Mobiel locked" band (OK diya) — har app / Recents band karta tha   # v48: break malik ne band karwaya
       "del": ["⌨️ Keyboard haptics ON (Battery saver)", "Pani 15 min baad dobara"]}   # v75 (25 Nov, malik ka OK): dono purane / bekar — asal delete (Replace all)
os.makedirs(REPO, exist_ok=True)
s = json.dumps(pkg, ensure_ascii=False, separators=(',', ':'))
# chaabi ki jaanch — Remote ke Java (sanitize regex) ke lafz nikaal kar
chk = s
for m in pkg['macros']:
    for a in m.get('m_actionList', []):
        if a.get('m_classType') == 'JavaAction': chk = chk.replace(json.dumps(a['scriptText'], ensure_ascii=False)[1:-1], '')
for bad in ('AIza', 'firebase', 'gaariKey', 'bankKey', 'awazKey', 'password'):
    assert bad not in chk, bad
import re
assert not re.search(r'(?=[A-Za-z0-9_-]*[0-9])[A-Za-z0-9_-]{30,}', chk), 'lambi chaabi jaisi string'
open(os.path.join(REPO, 'pkg.json'), 'w').write(s)
open(os.path.join(REPO, 'ver.txt'), 'w').write(ver + '\n')
# validator ke liye har macro alag .macro shakal mein bhi
for nm, m in (('p', mp), ('k', mk), ('s', msl), ('a', mal), ('v', mkv), ('b', mkb), ('r', mrb), ('w', mwa), ('i', mws), ('n', mcn), ('e', mak), ('c', mcl), ('d', mrm), ('q', mq), ('x', mcb), ('g', mkw), ('h', mkw2), ('o', mql), ('z', msh), ('y', mcp), ('u', mcc)):
    json.dump({"macroExportVersion": 1, "macro": m, "globalVariables": vars_, "userIcons": None},
              open(os.path.join(D, f'pkg_{nm}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('pkg', len(s), [m['m_name'] for m in pkg['macros']])
