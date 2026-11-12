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
mp, vp = fix(paani, OLD_PAANI_BREAK, '💧 Paani')
mk, vk = fix(khana, h64('claude|khana'), '🍽 Khana-peena')
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
vars_, seen = [], set()
# 🏦 Bank mode (chat link, phone par) ke globals — link import banata nahi (7 Nov: "Variable does not exist (bkSave)")
def _gv(n, t, **kw):
    v = {"m_name": n, "m_type": t, "isLocalVar": False, "m_booleanValue": False, "m_intValue": 0, "m_stringValue": ""}; v.update(kw); return v
vb = [_gv("bankOn", 0), _gv("bkSave", 2), _gv("bkRes", 2), _gv("bkBeat", 1), _gv("bkAge", 1)]
for v in vp + vk + vt + vq + vf + vb + vcb + vsb:
    if v['m_name'] not in seen: seen.add(v['m_name']); vars_.append(v)
ver = sys.argv[1]
pkg = {"v": ver,
       "note": "🔎 Bari likhai ab sirf Claude mein (WhatsApp mein aam likhai).",
       "macros": [mp, mk, ma, mr, mt, mq, mf, ms, mb, mh, mst, mbg, mcb, mhs, mrt, msb],
       "patch": [{"nm": "Falcon km", "cls": "TimeOfDayConstraint", "set": {"m_startHour": 21, "m_startMinute": 0}},
                 {"nm": "Falcon km", "cls": "DeviceUnlockedTrigger", "set": {"m_isDisabled": True}}],   # v24 (10 Nov, malik: raat wala band, haath se theek)
       "vars": vars_,
       "off": ["⌨️ Keyboard haptics ON (Battery saver)"],
       "del": []}
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
for nm, m in (('p', mp), ('k', mk)):
    json.dump({"macroExportVersion": 1, "macro": m, "globalVariables": vars_, "userIcons": None},
              open(os.path.join(D, f'pkg_{nm}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('pkg', len(s), [m['m_name'] for m in pkg['macros']])
