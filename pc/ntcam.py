# ntcam.py — Noor Traders Hazri: dukaan ke CAMERAS (shop PC par chalta hai). Hissa A.
# v1.9: SASTA MODE — "galle se paisa bahar kis ko?" Har len-den par 6-8 CHHOTI tasveerein chhote AI ko (≈ Rs 0.3): nikla nahi -> na card
#       na kharcha; usi customer ko jis ka Cash Received voucher -> ✅ baqaya (halka card); warna 🔴 (kisi aur ko / jeb / bina voucher /
#       baqaya banta nahi tha / bada note) -> (doosri raaye on ho to) bara AI poori kahani -> pakka 🔴 = khabar + video. Roz ka BUDGET
#       rupay mein (cameras.budget, stats.cost), doosri raaye on/off (cameras.second), sirf bare baqaye par AI (cameras.minChange),
#       "Aaj ki 5 videos" (bila tarteeb, bina AI, cameraClips kind 'daily'). Doosre vouchers (Galla screen / kharch) se milaan NAHI.
# v1.8: LEN-DEN KI KAHANI — galla + COUNTER (zone2) ki har 0.5 s tasveer (tape, 6 min); len-den par ~20 chuni tasveerein waqt
#       ke sath -> AI kahani likhta hai (kis ne parchi / paisa diya, baqaya kis ko, kaun khara raha, galle se kis ko diya). PC
#       POS se milata hai: bina parchi paisa, parchi di paisa nahi, voucher ke waqt paisa kisi aur ko, baqaya banta hi nahi tha
#       (POS CashReceived = bill), aik bill par do dafa, chhote baqaye par bada note, N log / M parchi; aur parchi scan hui magar
#       galle par harkat hi nahi (nopay). Mushkil len-den (lal nishan / 2+ log / 2+ voucher / shak) bara AI dobara likhta hai.
# v1.7: AIK LEN-DEN = AIK JAANCH — galle ki harkatein 60 s ke andar dobara hon to aik hi card (3 min had); AI ko bataya ke larka
#       kursi par baith kar gode / haath / tokri / machine mein ginta hai (shak NAHI); chhota AI "shak" kahe to bara AI (Sonnet)
#       wahi tasveerein dobara dekhta hai — dono shak kahein tabhi shak (khabar + video). Roz ki had ab poore din chalti hai.
# v1.6: GALLA SIRF VOUCHER PAR — POS ke "Cash Received" voucher (bill ka cash galle par receive) se 1 min pehle se 1.5 min baad
#       tak galla khulna jaiz; bina voucher / refund / Galla screen "de diye" ke galla khula = 2 min baad 'missing' (khabar + clip).
#       Jeb mein note = shak (voucher ho tab bhi). PC khud dhoondta hai POS voucher mein bill kis khane mein hai (pos-voucher.json).
# v1.5: BILL SIRF APNE WAQT KA — bill (scan shuru -30 s .. post +45 s) ke bahar 'paisa nikla' ko sirf Galla screen / refund theek
#       keh sakta hai, warna 'Entry nahi'. AI andaza nahi, bill posting sanad.
# v1.4: VIDEO — galla camera ki halki recording PC ki disk par (2 din), 'shak' par khud 15-30 s clip app mein, malik ki farmaish par
#       3 minute tak ki mukammal clip (cameraClips / cameraClipParts). ffmpeg imageio-ffmpeg se (khud install).
# v1.3: BILL BADLA / CANCEL — bill ban ne ke baad cancel (status 3), raqam kam, ya items badle -> posAlerts + card + khabar.
# v1.2: GALLA MILAAN — har len-den POS ke sale bill / refund aur Blue Khata Galla screen ki "de diye" se milana (sirf parhna).
# v1.1 (Hissa B): GALLA NIGRANI — 'galla' kaam wale camera ki video lagatar, malik ke mark kiye dabbe mein harkat par
# 6 tasveerein (1.5 s pehle + 1.5 s baad), Claude se Normal / Shak, cameraEvents + cameraFrames + cameraStats. Password par ****.
# Kaam: network par camera dhoondna, password se jodna (password SIRF is PC mein), har 5 minute (ya malik ke kehne par) tasveer
# lena aur hazri app (Settings > Cameras) ko bhejna, online/offline batana. Hissa B mein isi mein galla nigrani judegi.
#   setup  = jodna / naya camera (desktop icon "NT Camera jodein")      run = peeche chalna (PC on hote hi, Startup)
#   test   = sirf jaanch (kuch nahi badalta)
# Firebase: apna alag login (PC code) — rules isay sirf cameras / cameraShots / cameraPC/status likhne dete hain.
VERSION = '1.9.1'

import base64, collections, getpass, ipaddress, json, os, queue, re, socket, subprocess, sys, threading, time, traceback, urllib.parse
from concurrent.futures import ThreadPoolExecutor

HOME = os.environ.get('NTCAM_HOME') or (r'C:\NTCam' if os.name == 'nt' else os.path.join(os.path.expanduser('~'), 'ntcam'))
SECRETS = os.path.join(HOME, 'secrets.json')
LOGF = os.path.join(HOME, 'ntcam.log')
BASEF = os.path.join(HOME, 'base.txt')
DEFAULT_BASE = 'https://samiullah-878.github.io/nt-traders-/'
BIZ = 'businesses/noor-traders'
MODEL = 'claude-haiku-4-5-20251001'
CONFIRM_MODELS = ('claude-sonnet-5-5', 'claude-sonnet-4-6')   # v1.7: shak ki doosri raaye (pehla na chale to doosra)
MERGE_GAP, MERGE_MAX = 60, 180       # v1.7: 60 s ke andar agli harkat = wahi len-den; aik len-den zyada se zyada 3 minute
TAPE_SEC, TAPE_W, TAPE_Q = 360, 416, 62   # v1.8: galla + counter ki 0.5 s tasveerein 6 minute (JPEG, ~14 MB)
STORY_N, STORY_PRE, STORY_POST = 20, 30, 10   # kahani: ~20 tasveerein, len-den se 30 s pehle se 10 s baad
NOPAY_WAIT = 150                     # parchi scan (Cash Received) ke 2.5 min baad dekho: galle par harkat hui ya nahi
CHEAP_N, CHEAP_W, CHEAP_Q = 8, 288, 60   # v1.9: sasta sawal — 8 tasveerein 288 px
FX_PKR = 280.0                       # v1.9: kharcha rupay mein dikhane ke liye (andaza)
PRICE = {'claude-haiku-4-5-20251001': (1.0, 5.0), 'claude-sonnet-5-5': (2.0, 10.0), 'claude-sonnet-4-6': (3.0, 15.0)}   # $/M tokens (in, out)
DAILY_VIDEOS = 5                     # v1.9: roz itni len-den ki video bila tarteeb (bina AI)
SHOT_EVERY = 300          # har 5 minute aik tasveer (app ke liye)
LIST_EVERY = 20           # cameras ki list / "nayi tasveer" ki farmaish har 20 second
STATUS_EVERY = 120        # PC zinda hai — har 2 minute
UPDATE_EVERY = 6 * 3600   # naya program (GitHub se) har 6 ghante
LOCK_PORT = 47391
HB_FILE = os.path.join(HOME, 'heartbeat.txt')      # v1.9.1: har 5 s "zinda hoon" — ntwatch.ps1 (har 5 min) 6 min purana dekhe to dobara shuru
CRASH_FILE = os.path.join(HOME, 'crash.log')       # v1.9.1: native crash (OpenCV / ffmpeg) ka nishan (faulthandler)
VCH_BEFORE, VCH_AFTER = 60, 90       # v1.6: Cash Received voucher ki window — 1 min pehle se 1.5 min baad tak galla khulna jaiz
OUT_PAD = 120                        # Galla screen "de diye" / POS refund: ±2 min
SALE_BEFORE, SALE_AFTER = 30, 120    # SIRF jab POS mein voucher ka khana na mile: bill (scan shuru .. post) ke waqt se
VCH_FILE = os.path.join(HOME, 'pos-voucher.json')
os.environ.setdefault('OPENCV_FFMPEG_CAPTURE_OPTIONS', 'rtsp_transport;tcp|timeout;7000000')  # WiFi par tcp zyada pakka


def now_ms():
    return int(time.time() * 1000)


def log(*parts):
    line = time.strftime('%Y-%m-%d %H:%M:%S ') + ' '.join(str(p) for p in parts)
    try:
        os.makedirs(HOME, exist_ok=True)
        if os.path.exists(LOGF) and os.path.getsize(LOGF) > 1_000_000:
            os.replace(LOGF, LOGF + '.old')
        with open(LOGF, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except OSError:
        pass


def say(text=''):
    """Console par (setup ke waqt). pythonw mein console nahi hota — sirf log."""
    try:
        print(text, flush=True)
    except Exception:
        pass
    log(text)


def load_json(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_json(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def clean_key(k):
    """v1.1.1: Claude key mein sirf harf, ginti, - aur _ hote hain. AnyDesk (mobile) se paste par chhupe harf (jaise Ctrl+V ka
    nishan) aa jate the — server 400 (khali wajah) deta tha. Baqi sab hata do."""
    return re.sub(r'[^A-Za-z0-9_\-]', '', str(k or ''))


def secrets():
    s = load_json(SECRETS, {})
    s.setdefault('cams', {})
    k = s.get('claudeKey')
    if k and clean_key(k) != k:              # purani save hui key mein chhupe harf — khud saaf
        s['claudeKey'] = clean_key(k)
        try:
            save_json(SECRETS, s)
            log('claude key saaf ki (chhupe harf hataye)')
        except OSError:
            pass
    return s


def base_url():
    try:
        with open(BASEF, encoding='utf-8') as f:
            b = f.read().strip()
            if b.startswith('http'):
                return b if b.endswith('/') else b + '/'
    except OSError:
        pass
    return DEFAULT_BASE


def mask(url):
    """Log / screen par password kabhi nahi."""
    return re.sub(r'(rtsp://[^:/@]+:)[^@]*@', r'\1****@', str(url))


def secret_input(prompt):
    """Password / key: likhte waqt **** nazar aaye (pehle kuch nazar nahi aata tha — log samajhte the likha hi nahi ja raha)."""
    if os.name == 'nt' and sys.stdin is not None and sys.stdin.isatty():
        import msvcrt
        print(prompt, end='', flush=True)
        buf = []
        while True:
            ch = msvcrt.getwch()
            if ch in ('\r', '\n'):
                print(flush=True)
                return ''.join(buf)
            if ch == '\x03':
                raise KeyboardInterrupt
            if ch in ('\x00', '\xe0'):
                msvcrt.getwch()
                continue
            if ch == '\x08':
                if buf:
                    buf.pop()
                    print('\b \b', end='', flush=True)
                continue
            buf.append(ch)
            print('*', end='', flush=True)
    return getpass.getpass(prompt)


# ---------------------------------------------------------------- PC code
CODE_RE = re.compile(r'^([a-z0-9]{6})-([a-z0-9]{8,16})$')


def parse_code(code):
    """App ka 'PC code' -> (email, password). Misal: k7m2qx-9fa4tpze3h"""
    c = re.sub(r'\s+', '', str(code or '')).lower()
    m = CODE_RE.match(c)
    if not m:
        return None
    return f'cam-{m.group(1)}@nttraders.local', m.group(2)


# ---------------------------------------------------------------- Firebase (REST, apne login ke sath — rules lagte hain)
def enc(v):
    if v is None:
        return {'nullValue': None}
    if isinstance(v, bool):
        return {'booleanValue': v}
    if isinstance(v, int):
        return {'integerValue': str(v)}
    if isinstance(v, float):
        return {'doubleValue': v}
    if isinstance(v, str):
        return {'stringValue': v}
    if isinstance(v, (list, tuple)):
        return {'arrayValue': {'values': [enc(x) for x in v]}}
    if isinstance(v, dict):
        return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
    return {'stringValue': str(v)}


def dec(v):
    if not isinstance(v, dict) or not v:
        return None
    k, x = next(iter(v.items()))
    if k == 'integerValue':
        return int(x)
    if k == 'doubleValue':
        return float(x)
    if k in ('stringValue', 'booleanValue', 'timestampValue', 'referenceValue'):
        return x
    if k == 'nullValue':
        return None
    if k == 'arrayValue':
        return [dec(i) for i in (x or {}).get('values', [])]
    if k == 'mapValue':
        return {a: dec(b) for a, b in (x or {}).get('fields', {}).items()}
    return x


def firebase_config(base):
    import requests
    txt = requests.get(base + 'firebase-config.js', params={'t': now_ms()}, timeout=20).text
    key = re.search(r'apiKey\s*:\s*["\']([^"\']+)', txt)
    pid = re.search(r'projectId\s*:\s*["\']([^"\']+)', txt)
    if not key or not pid:
        raise RuntimeError('firebase-config.js se apiKey / projectId nahi mila')
    return {'apiKey': key.group(1), 'projectId': pid.group(1)}


class AuthError(Exception):
    pass


class Fire:
    def __init__(self, api_key, project, email, password):
        self.key, self.project, self.email, self.password = api_key, project, email, password
        self.id_token, self.refresh, self.exp, self.uid = '', '', 0, ''
        self.root = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/'

    def login(self):
        import requests
        r = requests.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
                          params={'key': self.key}, json={'email': self.email, 'password': self.password, 'returnSecureToken': True}, timeout=20)
        j = r.json()
        if r.status_code != 200:
            msg = (j.get('error') or {}).get('message', 'error')
            raise AuthError(msg)
        self.id_token, self.refresh, self.uid = j['idToken'], j['refreshToken'], j['localId']
        self.exp = time.time() + int(j.get('expiresIn', 3600))

    def token(self):
        import requests
        if not self.id_token:
            self.login()
        elif time.time() > self.exp - 120:
            r = requests.post('https://securetoken.googleapis.com/v1/token', params={'key': self.key},
                              data={'grant_type': 'refresh_token', 'refresh_token': self.refresh}, timeout=20)
            if r.status_code != 200:
                self.login()
            else:
                j = r.json()
                self.id_token, self.refresh = j['id_token'], j['refresh_token']
                self.exp = time.time() + int(j.get('expires_in', 3600))
        return self.id_token

    def _h(self):
        return {'Authorization': 'Bearer ' + self.token()}

    def get(self, path):
        import requests
        r = requests.get(self.root + path, headers=self._h(), timeout=25)
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise RuntimeError(f'get {path}: {r.status_code} {r.text[:160]}')
        return {k: dec(v) for k, v in r.json().get('fields', {}).items()}

    def list(self, coll):
        import requests
        out, page = [], ''
        while True:
            params = {'pageSize': 100}
            if page:
                params['pageToken'] = page
            r = requests.get(self.root + f'{BIZ}/{coll}', headers=self._h(), params=params, timeout=25)
            if r.status_code != 200:
                raise RuntimeError(f'list {coll}: {r.status_code} {r.text[:160]}')
            j = r.json()
            for d in j.get('documents', []):
                out.append((d['name'].rsplit('/', 1)[-1], {k: dec(v) for k, v in d.get('fields', {}).items()}))
            page = j.get('nextPageToken', '')
            if not page:
                return out

    def query(self, coll, field, op, value, limit=50):
        """v1.2: aik shart wali talash (misal reviewed IN [...])."""
        import requests
        body = {'structuredQuery': {'from': [{'collectionId': coll}], 'where': {'fieldFilter': {'field': {'fieldPath': field}, 'op': op, 'value': enc(value)}},
                                    'limit': limit}}
        r = requests.post(self.root + f'{BIZ}:runQuery', headers=self._h(), json=body, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f'query {coll}: {r.status_code} {r.text[:160]}')
        return [{**{k: dec(v) for k, v in row['document'].get('fields', {}).items()}, 'id': row['document']['name'].rsplit('/', 1)[-1]} for row in r.json() if row.get('document')]

    def patch(self, path, data):
        """Sirf yahi fields likho (baqi — misal malik ka rakha naam — waise hi rahein). Doc na ho to ban jata hai."""
        import requests
        params = [('updateMask.fieldPaths', k) for k in data]
        r = requests.patch(self.root + path, headers=self._h(), params=params,
                           json={'fields': {k: enc(v) for k, v in data.items()}}, timeout=40)
        if r.status_code != 200:
            raise RuntimeError(f'patch {path}: {r.status_code} {r.text[:200]}')
        return True


def connect(sec, ask=False):
    """PC code se login. ask=True: ghalat / na ho to poocho (setup)."""
    cfg = firebase_config(base_url())
    while True:
        code = sec.get('pcCode', '')
        if not code and ask:
            code = input('\nPC code likhein (phone par: hazri app > Settings > Cameras): ').strip()
        cred = parse_code(code)
        if not cred:
            if not ask:
                raise AuthError('PC code nahi')
            say('  [!!] Code ki shakal ghalat hai. Misal: k7m2qx-9fa4tpze3h')
            sec.pop('pcCode', None)
            continue
        fire = Fire(cfg['apiKey'], cfg['projectId'], *cred)
        try:
            fire.login()
        except AuthError as e:
            if not ask:
                raise
            say(f'  [!!] Code nahi chala ({e}). App mein "Naya PC code banayein" daba kar naya code likhein.')
            sec.pop('pcCode', None)
            continue
        sec['pcCode'] = re.sub(r'\s+', '', code).lower()
        save_json(SECRETS, sec)
        return fire


# ---------------------------------------------------------------- network par camera dhoondna
def my_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '192.168.1.2'
    finally:
        s.close()


def port_open(ip, port, t=0.4):
    try:
        with socket.create_connection((ip, port), timeout=t):
            return True
    except OSError:
        return False


def mac_of(ip):
    try:
        if os.name == 'nt':
            out = subprocess.run(['arp', '-a', ip], capture_output=True, text=True, timeout=5, creationflags=0x08000000).stdout
        else:
            out = subprocess.run(['ip', 'neigh', 'show', ip], capture_output=True, text=True, timeout=5).stdout
        m = re.search(r'([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}', out)
        return m.group(0).replace(':', '').replace('-', '').lower() if m else ''
    except Exception:
        return ''


def guess_brand(ip):
    if port_open(ip, 37777):
        return 'dahua'
    if port_open(ip, 8000):
        return 'hik'
    try:
        import requests
        t = requests.get(f'http://{ip}/', timeout=1.5).text.lower()
        if 'dahua' in t or 'dh-' in t:
            return 'dahua'
        if 'hikvision' in t or 'doc/page/login' in t:
            return 'hik'
    except Exception:
        pass
    return 'other'


BRAND_TEXT = {'dahua': 'Dahua', 'hik': 'Hikvision', 'other': 'Camera'}


def scan(ip=None):
    """Isi network (x.x.x.1-254) par jahan RTSP (554) khula ho — wo camera / NVR hai."""
    ip = ip or my_ip()
    net = ipaddress.ip_network(ip + '/24', strict=False)
    hosts = [str(h) for h in net.hosts() if str(h) != ip]
    with ThreadPoolExecutor(96) as ex:
        hits = [h for h, ok in zip(hosts, ex.map(lambda h: port_open(h, 554), hosts)) if ok]
    found = []
    for h in sorted(hits, key=lambda x: int(x.rsplit('.', 1)[-1])):
        found.append({'ip': h, 'brand': guess_brand(h), 'mac': mac_of(h)})
    return found


# ---------------------------------------------------------------- video / tasveer
def rtsp_urls(brand, ip, user, pw, ch=1):
    u, p = urllib.parse.quote(user, safe=''), urllib.parse.quote(pw, safe='')
    dahua = f'rtsp://{u}:{p}@{ip}:554/cam/realmonitor?channel={ch}&subtype=0'
    hik = f'rtsp://{u}:{p}@{ip}:554/Streaming/Channels/{ch}01'
    return [hik, dahua] if brand == 'hik' else [dahua, hik]


def open_capture(url):
    import cv2
    try:
        return cv2.VideoCapture(url, cv2.CAP_FFMPEG, [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 8000])
    except TypeError:
        return cv2.VideoCapture(url, cv2.CAP_FFMPEG)


def grab(url, reads=10):
    """Aik saaf frame. Pehle 2-3 frame aksar kharab/grey hote hain — thore parh kar aakhri lo."""
    cap = open_capture(url)
    try:
        if not cap.isOpened():
            return None
        frame = None
        for i in range(reads):
            ok, f = cap.read()
            if ok and f is not None:
                frame = f
                if i >= 3:
                    break
        return frame
    finally:
        cap.release()


def jpeg_b64(frame, width=640, quality=62):
    import cv2
    h, w = frame.shape[:2]
    if w > width:
        frame = cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError('jpeg nahi bana')
    return base64.b64encode(buf.tobytes()).decode('ascii'), frame.shape[1], frame.shape[0]


# ---------------------------------------------------------------- Claude (AI) — sirf test Hissa A mein
def ai_describe(key, b64):
    import requests
    body = {'model': MODEL, 'max_tokens': 220, 'messages': [{'role': 'user', 'content': [
        {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b64}},
        {'type': 'text', 'text': 'Ye aik dukaan ke CCTV camera ki tasveer hai. Roman Urdu (English harf) mein sirf 1-2 chhoti lines mein '
                                 'batao ke kya nazar aa raha hai: kitne log, counter, aur galla/cash nazar aa raha hai ya nahi. '
                                 'Kisi insaan ki pehchan ya naam mat batao.'}]}]}
    r = requests.post('https://api.anthropic.com/v1/messages', json=body, timeout=60,
                      headers={'x-api-key': clean_key(key), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    if r.status_code != 200:
        raise RuntimeError(api_error(r))
    return ' '.join(b.get('text', '') for b in r.json().get('content', []) if b.get('type') == 'text').strip()[:300]


def api_error(r):
    """Claude ki ghalti Roman Urdu mein, asal wajah ke sath (v1.1.1 — pehle khali '400' aata tha)."""
    try:
        j = r.json()
        msg = str((j.get('error') or {}).get('message') or '')
    except ValueError:
        msg = (r.text or '').strip()
    low = msg.lower()
    if r.status_code == 401 or 'x-api-key' in low or 'authentication' in low:
        return 'Claude key ghalat hai — nayi key daalein.'
    if 'credit' in low or 'billing' in low:
        return 'Claude mein credit nahi — console mein credit daalein.'
    if not msg:
        return f'Claude ne request wapas ki ({r.status_code}) bina wajah — aam taur par key mein chhupa ghalat harf. Key dobara paste karein.'
    return f'Claude ({r.status_code}): {msg[:150]}'


def check_key(key):
    """Chhota sa sawaal (taqreeban muft) — key aur credit theek hain ya nahi. Wapas: (theek?, paigham, status code)."""
    import requests
    try:
        r = requests.post('https://api.anthropic.com/v1/messages', timeout=40,
                          headers={'x-api-key': clean_key(key), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                          json={'model': MODEL, 'max_tokens': 5, 'messages': [{'role': 'user', 'content': 'ok'}]})
    except Exception as e:
        return False, f'Claude tak internet nahi pohancha: {e}', 0
    if r.status_code == 200:
        return True, 'Claude key chal rahi hai (AI tayyar).', 200
    return False, api_error(r), r.status_code


GALLA_PROMPT = ('Ye {n} tasveerein aik dukaan ke GALLA (cash / paise rakhne ki jagah) ki CCTV se hain, waqt ki tarteeb mein '
                '(har do ke beech taqreeban aadha second). Dekho: kya kisi ne galla se paise (note) nikal kar apni JEB, qameez, '
                'shalwar, ya kisi chhupi jagah mein rakhe? Aam kaam NORMAL hai: customer ko baqaya dena, paise galla mein rakhna, '
                'note ginna, drawer kholna / band karna. Tasveer saaf na ho ya haath nazar na aayein to "saaf_nahi". '
                'Kisi insaan ki pehchan, naam ya chehre ki baat mat karo. Jawab SIRF JSON: '
                '{{"verdict": "normal" ya "shak" ya "saaf_nahi", "why": "Roman Urdu (English harf) mein aik chhoti line"}}')


def parse_verdict(text):
    m = re.search(r'\{.*\}', text or '', re.S)
    try:
        j = json.loads(m.group(0)) if m else {}
    except ValueError:
        j = {}
    v = str(j.get('verdict', '')).strip().lower().replace(' ', '_')
    v = {'suspicious': 'shak', 'unclear': 'saaf_nahi'}.get(v, v)
    if v not in ('normal', 'shak', 'saaf_nahi'):
        v = 'saaf_nahi'
    return v, str(j.get('why') or (text or '')[:200]).strip()[:280]


def ai_judge(key, crops_b64):
    import requests
    content = [{'type': 'text', 'text': GALLA_PROMPT.format(n=len(crops_b64))}]
    for i, b in enumerate(crops_b64, 1):
        content += [{'type': 'text', 'text': f'Tasveer {i}'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b}}]
    t0 = time.time()
    r = requests.post('https://api.anthropic.com/v1/messages', timeout=90,
                      headers={'x-api-key': clean_key(key), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                      json={'model': MODEL, 'max_tokens': 200, 'messages': [{'role': 'user', 'content': content}]})
    if r.status_code != 200:
        raise RuntimeError(api_error(r))
    txt = ' '.join(b.get('text', '') for b in r.json().get('content', []) if b.get('type') == 'text')
    v, why = parse_verdict(txt)
    return v, why, int((time.time() - t0) * 1000)


# ---------------------------------------------------------------- Firebase mein likhna
AGENT_KEYS = ('ip', 'mac', 'brand', 'status', 'lastFrameAt', 'lastShotAt', 'lastError', 'width', 'height', 'agent', 'aiTest', 'aiTestAt', 'seenAt',
              'watch', 'fps', 'stream', 'lastMotionAt')


def put_shot(fire, cid, frame):
    b64, w, h = jpeg_b64(frame)
    t = now_ms()
    fire.patch(f'{BIZ}/cameraShots/{cid}', {'jpg': b64, 'w': w, 'h': h, 'at': t, 'cam': cid})
    fire.patch(f'{BIZ}/cameras/{cid}', {'status': 'online', 'lastFrameAt': t, 'lastShotAt': t, 'lastError': '', 'width': w, 'height': h, 'agent': VERSION, 'seenAt': t})
    return b64


def put_status(fire, cams=0, online=0, found=None, error='', pos=None):
    data = {'at': now_ms(), 'v': VERSION, 'host': socket.gethostname()[:40], 'cams': cams, 'online': online, 'error': str(error)[:200],
            'python': sys.version.split()[0]}
    if pos is not None:
        data['pos'] = str(pos)[:160]
    if found is not None:
        data['found'] = [{'ip': d['ip'], 'brand': d['brand'], 'mac': d.get('mac', '')} for d in found][:20]
        data['foundAt'] = now_ms()
    fire.patch(f'{BIZ}/cameraPC/status', data)


# ---------------------------------------------------------------- v1.1 GALLA NIGRANI
COOLDOWN = 20            # do AI jaanchon ke beech kam se kam (second) — beech ki harkat sirf ginti mein
AI_PAUSE = 600           # AI ghalti (credit / key) par 10 minute ruko
SENS = {'low': (35, 0.06), 'mid': (28, 0.035), 'high': (22, 0.02)}   # (pixel farq, dabbe ka kitna hissa badla)


def pk_date(ts=None):
    return time.strftime('%Y-%m-%d', time.gmtime((ts if ts is not None else time.time()) + 5 * 3600))


def tape_box(zone, zone2, w, h):
    """v1.8: kahani ki tasveer ka dabba = galla (0.5 pad) + counter (0.15 pad) dono ko gherne wala; counter na ho to galla 0.8 pad."""
    if not (zone2 or {}).get('w'):
        return zone_px(zone, w, h, 0.8)
    a = zone_px(zone, w, h, 0.5)
    b = zone_px(zone2, w, h, 0.15)
    if a[2] <= a[0]:
        return b
    return min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])


def zone_px(zone, w, h, pad=0.0):
    """Malik ka dabba (0-1) -> pixel. pad: har taraf dabbe ke size ka itna hissa aur (AI ko haath / jeb bhi dikhe)."""
    try:
        x, y, zw, zh = (float(zone.get(k, 0)) for k in ('x', 'y', 'w', 'h'))
    except (TypeError, ValueError, AttributeError):
        return 0, 0, 0, 0
    x0, y0 = max(0, int((x - zw * pad) * w)), max(0, int((y - zh * pad) * h))
    x1, y1 = min(w, int((x + zw * (1 + pad)) * w)), min(h, int((y + zh * (1 + pad)) * h))
    return x0, y0, x1, y1


class Motion:
    """Dabbe mein harkat: chhoti grey tasveer ka peechay wali (dheere badalti) tasveer se farq. Do lagatar sample = harkat."""
    def __init__(self, sens='mid'):
        self.bg, self.hits = None, 0
        self.set(sens)

    def set(self, sens):
        self.t, self.r = SENS.get(sens, SENS['mid'])

    def feed(self, crop):
        import cv2
        g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        g = cv2.GaussianBlur(cv2.resize(g, (160, max(1, int(160 * g.shape[0] / max(1, g.shape[1]))))), (5, 5), 0)
        if self.bg is None or self.bg.shape != g.shape:
            self.bg = g.astype('float32')
            return False, 0.0
        ratio = float((cv2.absdiff(g, cv2.convertScaleAbs(self.bg)) > self.t).mean())
        cv2.accumulateWeighted(g, self.bg, 0.05 if ratio < self.r else 0.01)
        self.hits = self.hits + 1 if ratio > self.r else 0
        return self.hits >= 2, ratio


def pick(items, n=6):
    if len(items) <= n:
        return list(items)
    return [items[round(i * (len(items) - 1) / (n - 1))] for i in range(n)]


class Watch(threading.Thread):
    """Aik galla camera: video lagatar parho (taaza frame app ki tasveer ke liye bhi), dabbe mein harkat par 1.6 s pehle + 1.6 s
    baad ke tukre (2 fps) kaam ki qataar mein. Dheema PC (3 fps se kam) ho to khud halki (sub) video par."""
    def __init__(self, cid, url, cam, jobs):
        super().__init__(daemon=True)
        self.cid, self.url, self.jobs, self.alive = cid, url, jobs, True
        self.motion, self.ring, self.pending = Motion(), collections.deque(maxlen=90), None   # 0.5 s * 90 = 45 s
        self.tape, self.tape_prev = collections.deque(maxlen=TAPE_SEC * 2), None             # v1.8: (t, jpeg, counter harkat)
        self.latest, self.latest_at, self.fps, self.last_motion, self.last_trigger, self.stream = None, 0, 0.0, 0, 0, 'main'
        self.apply(cam)

    def apply(self, cam):
        self.name = str(cam.get('name') or self.cid)[:40]
        self.zone = cam.get('zone') or {}
        self.zone2 = cam.get('zone2') or {}            # v1.8: counter / len-den ka hissa (malik mark karta hai)
        self.sens = cam.get('sens') or 'mid'
        self.cap_day = int(cam.get('aiCap') or 300)
        self.budget = float(cam.get('budget') or 200)          # v1.9: roz ka AI kharcha (Rs)
        self.second = cam.get('second', True) is not False      # v1.9: 🔴 se pehle bara AI (doosri raaye)
        self.min_change = float(cam.get('minChange') or 0)     # v1.9: AI sirf jab POS ka baqaya is se zyada (0 = sab)
        self.motion.set(self.sens)

    def stop(self):
        self.alive = False

    def tape_add(self, now, f, w, h):
        """v1.8: galla + counter (dono dabbe mila kar) ki chhoti JPEG + counter mein harkat ka andaza (haath aage / peeche)."""
        import cv2
        X0, Y0, X1, Y1 = tape_box(self.zone, self.zone2, w, h)
        if X1 - X0 < 16 or Y1 - Y0 < 16:
            return
        crop = f[Y0:Y1, X0:X1]
        cm = 0.0
        if self.zone2.get('w'):
            a0, b0, a1, b1 = zone_px(self.zone2, w, h)
            if a1 - a0 >= 8 and b1 - b0 >= 8:
                g = cv2.resize(cv2.cvtColor(f[b0:b1, a0:a1], cv2.COLOR_BGR2GRAY), (32, 24), interpolation=cv2.INTER_AREA).astype('int16')
                if self.tape_prev is not None and self.tape_prev.shape == g.shape:
                    cm = float(abs(g - self.tape_prev).mean())
                self.tape_prev = g
        b64, _, _ = jpeg_b64(crop, width=TAPE_W, quality=TAPE_Q)
        self.tape.append((now, b64, cm))

    def key_frames(self, a, b, n=STORY_N, must=()):
        """v1.8: [a, b] mein se n tasveerein: har `must` waqt (voucher) ke qareeb wali, counter mein sab se zyada harkat wali
        (haath aage / peeche — parchi / paisa), baqi barabar faslay par. Wapas [(t, b64)] waqt ki tarteeb mein."""
        c = [x for x in list(self.tape) if a <= x[0] <= b]
        if len(c) <= n:
            return [(t, j) for t, j, _ in c]
        chosen = set()
        def near_ok(k, gap):
            return all(abs(c[k][0] - c[j][0]) >= gap for j in chosen)
        for m in must:
            k = min(range(len(c)), key=lambda j: abs(c[j][0] - m))
            chosen.add(k)
        for k in sorted(range(len(c)), key=lambda j: -c[j][2]):
            if len(chosen) >= n * 2 // 3 or c[k][2] <= 0.5:
                break
            if near_ok(k, 1.0):
                chosen.add(k)
        step = (len(c) - 1) / max(1, n - 1)
        for i in range(n):
            if len(chosen) >= n:
                break
            k = round(i * step)
            if k not in chosen and near_ok(k, 0.9):
                chosen.add(k)
        for k in range(len(c)):
            if len(chosen) >= n:
                break
            chosen.add(k)
        return [(c[k][0], c[k][1]) for k in sorted(chosen)[:n]]

    def tape_covers(self, a, b):
        return bool(self.tape) and self.tape[0][0] <= a and self.tape[-1][0] >= b

    def run(self):
        url, wait = self.url, 3
        while self.alive:
            cap = open_capture(url)
            if not cap.isOpened():
                log('nigrani: video nahi', self.cid)
                time.sleep(wait)
                wait = min(60, wait * 2)
                continue
            wait, n, t0, last_sample, last_ring = 3, 0, time.time(), 0, 0
            try:
                while self.alive:
                    ok, f = cap.read()
                    if not ok or f is None:
                        break
                    now = time.time()
                    n += 1
                    self.latest, self.latest_at = f, now
                    if now - t0 >= 10:
                        self.fps, n, t0 = n / (now - t0), 0, now
                        if self.fps < 3 and self.stream == 'main' and 'subtype=0' in url:
                            url, self.stream = url.replace('subtype=0', 'subtype=1'), 'sub'
                            log('nigrani: PC dheema — halki video', self.cid)
                            break
                    if not self.zone.get('w') or now - last_sample < 0.2:
                        continue
                    last_sample = now
                    h, w = f.shape[:2]
                    x0, y0, x1, y1 = zone_px(self.zone, w, h)
                    if x1 - x0 < 8 or y1 - y0 < 8:
                        continue
                    moved, _ = self.motion.feed(f[y0:y1, x0:x1])
                    if now - last_ring >= 0.5:
                        last_ring = now
                        X0, Y0, X1, Y1 = zone_px(self.zone, w, h, 0.5)
                        self.ring.append((now, f[Y0:Y1, X0:X1].copy()))
                        try:
                            self.tape_add(now, f, w, h)
                        except Exception as e:
                            log('tape:', e)
                    # v1.2: poora len-den — harkat se 4 s pehle se; harkat chalti rahe to 3 s aur, zyada se zyada 20 s
                    if moved:
                        self.last_motion = now
                        if self.pending:
                            self.pending['until'] = min(max(self.pending['until'], now + 3), self.pending['at'] + 20)
                        elif now - self.last_trigger > 3:
                            self.last_trigger = now
                            self.pending = {'at': now, 'from': now - 4, 'until': now + 5}
                    if self.pending and now >= self.pending['until']:
                        p = self.pending
                        frames = pick([c for t, c in self.ring if p['from'] <= t <= p['until']], 10)
                        try:
                            self.jobs.put_nowait((self, p['at'], p['from'], p['until'], frames))
                        except queue.Full:
                            pass
                        self.pending = None
            finally:
                cap.release()


# ---------------------------------------------------------------- v1.2 POS + Blue Khata (sirf parhna)
KHATA_DIR = os.environ.get('NTCAM_KHATA') or r'C:\khata-sync'
NO_WINDOW = 0x08000000 if os.name == 'nt' else 0


def need(mod, pkg):
    """Zaroori library na ho to khud install (PC par kuch type na karna pade)."""
    try:
        return __import__(mod)
    except ImportError:
        py = sys.executable.replace('pythonw.exe', 'python.exe')
        log('install:', pkg)
        subprocess.run([py, '-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '--no-warn-script-location', pkg],
                       timeout=900, creationflags=NO_WINDOW)
        return __import__(mod)


def pk_epoch(dt):
    """POS (SQL Server) ka waqt Pakistan ka sada waqt hai (timezone ke baghair) -> epoch second."""
    import calendar
    return calendar.timegm(dt.timetuple()) - 5 * 3600 + dt.microsecond / 1e6


def rs(n):
    return 'Rs ' + f'{round(float(n or 0)):,}'


def clock(ts):
    return time.strftime('%I:%M:%S %p', time.gmtime(ts + 5 * 3600)).lstrip('0').lower()


# ---------- v1.6: POS ka "Cash Received" VOUCHER — kahan likha hai, PC khud dhoondta hai ----------
VCH_TIME_COLS = ('CreatedOn', 'CreatedDate', 'CreatedAt', 'EntryDate', 'EntryTime', 'VoucherDate', 'TransDate', 'Date')
VCH_AMT_COLS = ('Amount', 'TotalAmount', 'Total', 'NetAmount', 'CashAmount', 'GrandTotal', 'Debit', 'Credit', 'Dr', 'Cr')
VCH_TYPE_COLS = ('VoucherType', 'VoucherTypeID', 'VType', 'Type', 'DocType', 'DocTypeID', 'VoucherTypeName')
VCH_NO_COLS = ('VoucherNo', 'VoucherNumber', 'DocNo', 'RefNo', 'No')
VCH_TXT_COLS = ('Description', 'Narration', 'Remarks', 'Note', 'Notes', 'Particulars', 'Detail')
LINK_HINT = re.compile(r'sale|ref|doc|inv|bill|source|link|against', re.I)
NOTES_RE = re.compile(r'Cash\s*Received\s*By\s*:?\s*(\S+)\s+On\s*:?\s*(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)', re.I)


def change_of(sale):
    """v1.8: POS ke mutabiq baqaya = customer ki di hui raqam (CashReceived) - bill. Raqam na likhi ho (= bill) to 0."""
    if not sale:
        return None
    c, a = float(sale.get('cash') or 0), float(sale.get('amount') or 0)
    return round(c - a, 2) if c > a + 1 else 0.0


def norm_no(v):
    """'00119023' / 'CRV-00119023' / 119023 -> '119023' (sirf hindse, aage ke sifar hata kar)."""
    return re.sub(r'\D', '', str(v if v is not None else '')).lstrip('0')


def notes_times(text):
    """Sale ke System Notes ("Cash Received By:waqar On:9/29/2026 12:33:48 PM at PC:..") se (user, epoch) ki list."""
    out = []
    for who, ts in NOTES_RE.findall(str(text or '')):
        import datetime
        for fmt in ('%m/%d/%Y %I:%M:%S %p', '%m/%d/%Y %I:%M %p'):
            try:
                out.append((who[:40], pk_epoch(datetime.datetime.strptime(ts.strip(), fmt))))
                break
            except ValueError:
                pass
    return out


def find_link(rows, sale_ids, sale_nos, sale_raw, skip=()):
    """Voucher (ya VoucherDetail) ki qataaron mein wo khana jis mein BILL likha hai. Wapas (col, mode, hits) ya None.
    mode 'id' = SaleID barabar (khane ke naam mein sale/ref/doc.. zaroori — warna VoucherID bhi SaleID se takra sakta hai),
    'no' = SaleNo barabar (matn ho to naam ki shart nahi: malik ke mutabiq voucher "usi number ka" banta hai),
    'text' = lambay matn ke andar SaleNo (\"against Sale # 00119023\")."""
    if not rows:
        return None
    best = None
    raw = [x for x in sale_raw if len(x) >= 5]
    for col in rows[0].keys():
        if col in skip or col.startswith('_'):
            continue
        hint = bool(LINK_HINT.search(col))
        hits = {'id': 0, 'no': 0, 'text': 0}
        for r in rows:
            v = r.get(col)
            if v is None or isinstance(v, (bytes, bytearray, bool)):
                continue
            if isinstance(v, (int, float)) or type(v).__name__ == 'Decimal':
                try:
                    iv = int(v)
                except (TypeError, ValueError, OverflowError):
                    continue
                if hint and iv in sale_ids:
                    hits['id'] += 1
                if hint and norm_no(iv) in sale_nos:
                    hits['no'] += 1
            elif isinstance(v, str):
                t = v.strip()
                if not t or len(t) > 400:
                    continue
                if len(t) <= 24 and norm_no(t) and norm_no(t) in sale_nos:
                    hits['no'] += 1
                elif len(t) > 6 and any(x in t for x in raw):
                    hits['text'] += 1
        for mode in ('no', 'id', 'text'):
            h = hits[mode]
            if h >= 3 and h * 10 >= len(rows) * 3 and (not best or h > best[2]):
                best = (col, mode, h)
    return best


def first_col(cols, names, kinds=None):
    for n in names:
        if n in cols and (not kinds or any(cols[n].startswith(k) for k in kinds)):
            return n
    return None


class Pos(threading.Thread):
    """Har 20 s: POS se naye sale bill + refund (SQL Server, khata-sync ki setting), aur Blue Khata ki Galla screen se
    "de diye" payments (firebase-key.json). Sirf PARHTA hai — POS / Blue Khata mein kuch nahi likhta. Aakhri 4 ghante yaad."""
    def __init__(self, fire=None):
        super().__init__(daemon=True)
        self.recs, self.lock = collections.deque(maxlen=3000), threading.Lock()
        self.last_sale = self.last_ret = 0
        self.seen = set()
        self.fire, self.galla, self.bills, self.alerts, self.users = fire, None, {}, {}, None
        self.sql_at = self.bk_at = 0
        self.sql_err = self.bk_err = ''
        self.bk_creds = None
        # v1.6: voucher — dhoond ka nateeja (mode voucher|salecol|notes|sale), bill ki nishani (SaleID / SaleNo -> sale rec)
        self.vch, self.vch_at, self.vch_err, self.last_vch = None, 0, '', 0
        self.sale_by_id, self.sale_by_no = {}, {}
        self.tender_seen = False                               # v1.8: kabhi CashReceived > bill dekha (baqaya POS se maloom)

    def ok_sql(self):
        return time.time() - self.sql_at < 120

    def ok_bk(self):
        return time.time() - self.bk_at < 180

    def status(self):
        a = 'POS ' + ('theek' if self.ok_sql() else ('nahi: ' + self.sql_err[:60] if self.sql_err else 'shuru ho raha'))
        b = 'Galla screen ' + ('theek' if self.ok_bk() else ('nahi: ' + self.bk_err[:60] if self.bk_err else 'shuru ho raha'))
        c = ('Baqaya: POS se ✅' if self.tender_seen else 'Baqaya: POS di hui raqam nahi likhta (sirf bill)') if self.recs else 'Baqaya: dekh raha'
        return a + ' · ' + self.vch_text() + ' · ' + c + ' · ' + b

    def vch_ok(self):
        """Voucher ka khana mil chuka hai -> galla sirf voucher par (warna bill ke waqt se, purana tareeqa)."""
        return bool(self.vch and self.vch.get('mode') in ('voucher', 'salecol', 'notes'))

    def vch_text(self):
        i = self.vch
        if not i:
            return 'Voucher: dhoond raha' + (' (' + self.vch_err[:50] + ')' if self.vch_err else '')
        if i.get('mode') not in ('voucher', 'salecol', 'notes'):
            return 'Voucher ka khana nahi mila — bill ke waqt se milaan' + (' (' + str(i.get('why') or '')[:50] + ')' if i.get('why') else '')
        today = pk_date()
        with self.lock:
            n = sum(1 for r in self.recs if r['kind'] == 'crv' and pk_date(r['at']) == today)
        where = {'voucher': f"{i.get('table', 'Voucher')}.{i.get('link')}", 'salecol': f"Sale.{i.get('link')}", 'notes': f"Sale.{i.get('link')} notes"}[i['mode']]
        return f'Voucher: mil rahe ({where}, aaj {n})'

    def near(self, a, b):
        with self.lock:
            return [r for r in self.recs if a <= r['at'] <= b]

    def add(self, r):
        k = (r['kind'], r.get('vid') or r['no'])      # v1.6: aik bill par do voucher (6 s baad) — VoucherID se alag
        if k in self.seen:
            return
        self.seen.add(k)
        with self.lock:
            self.recs.append(r)

    def run(self):
        while True:
            try:
                self.poll_sql()
                self.sql_at, self.sql_err = time.time(), ''
            except Exception as e:
                self.sql_err = str(e)
                log('pos:', e)
            try:
                self.poll_bk()
                self.bk_at, self.bk_err = time.time(), ''
            except Exception as e:
                self.bk_err = str(e)
                log('galla screen:', e)
            time.sleep(20)

    def poll_sql(self):
        cfg = (load_json(os.path.join(KHATA_DIR, 'local-config.json'), {}) or {}).get('sql') or {}
        if not cfg.get('server'):
            raise RuntimeError('khata-sync ki SQL setting nahi mili')
        pymssql = need('pymssql', 'pymssql')
        con = pymssql.connect(server=cfg['server'], user=cfg.get('user'), password=cfg.get('password'), database=cfg.get('database', 'POS'),
                              login_timeout=10, timeout=20, as_dict=True)
        try:
            cur = con.cursor()
            if not self.last_sale:
                cur.execute("SELECT ISNULL(MIN(SaleID), 0) - 1 AS a FROM dbo.Sale WHERE CreatedOn >= DATEADD(HOUR, -4, GETDATE())")
                self.last_sale = int(cur.fetchone()['a'] or 0)
                cur.execute("SELECT ISNULL(MIN(SaleReturnID), 0) - 1 AS a FROM dbo.SaleReturn WHERE CreatedOn >= DATEADD(HOUR, -4, GETDATE())")
                self.last_ret = int(cur.fetchone()['a'] or 0)
                if self.last_sale < 0:
                    cur.execute("SELECT ISNULL(MAX(SaleID), 0) AS a FROM dbo.Sale"); self.last_sale = int(cur.fetchone()['a'] or 0)
                if self.last_ret < 0:
                    cur.execute("SELECT ISNULL(MAX(SaleReturnID), 0) AS a FROM dbo.SaleReturn"); self.last_ret = int(cur.fetchone()['a'] or 0)
            cur.execute("SELECT TOP 300 s.SaleID, s.SaleNo, s.CreatedOn, s.BiltyDate, s.CashReceived, s.TotalSale, s.IsCreditSale, p.PartyName "
                        "FROM dbo.Sale s LEFT JOIN dbo.Party p ON p.PartyID = s.PartyID WHERE s.SaleID > %d AND s.DocStatusID <> 3 ORDER BY s.SaleID", (self.last_sale,))
            for r in cur.fetchall():
                self.last_sale = max(self.last_sale, int(r['SaleID']))
                if not r.get('CreatedOn'):
                    continue
                at = pk_epoch(r['CreatedOn'])
                start = pk_epoch(r['BiltyDate']) if r.get('BiltyDate') and abs(pk_epoch(r['BiltyDate']) - at) < 1800 else at
                rec = {'kind': 'sale', 'no': str(r['SaleNo'] or r['SaleID']).strip(), 'at': at, 'start': start, 'sid': int(r['SaleID']),
                       'amount': float(r.get('TotalSale') or 0), 'credit': bool(r.get('IsCreditSale')), 'party': str(r.get('PartyName') or '')[:60],
                       'cash': float(r.get('CashReceived') or 0)}
                if rec['cash'] > rec['amount'] + 1:
                    self.tender_seen = True                        # v1.8: POS customer ki di hui raqam likhta hai
                self.add(rec)
                self.sale_by_id[rec['sid']] = rec
                if norm_no(rec['no']):
                    self.sale_by_no[norm_no(rec['no'])] = rec
                if len(self.sale_by_id) > 3000:
                    for k in list(self.sale_by_id)[:1000]:
                        self.sale_by_id.pop(k, None)
                    self.sale_by_no = {norm_no(x['no']): x for x in self.sale_by_id.values()}
            # v1.3: pichle 4 ghante ke SAB bill (cancel wale bhi) — badla / cancel pakarne ke liye
            cur.execute("SELECT s.SaleID, s.SaleNo, s.CreatedOn, s.UpdatedOn, s.CreatedBy, s.UpdatedBy, s.TotalSale, s.DocStatusID, "
                        "(SELECT COUNT(*) FROM dbo.SaleDetail d WHERE d.SaleID = s.SaleID) AS n, "
                        "(SELECT CHECKSUM_AGG(CHECKSUM(d.ItemID, d.Qty, d.Rate)) FROM dbo.SaleDetail d WHERE d.SaleID = s.SaleID) AS h "
                        "FROM dbo.Sale s WHERE s.CreatedOn >= DATEADD(HOUR, -4, GETDATE()) OR s.UpdatedOn >= DATEADD(HOUR, -4, GETDATE())")
            rows = {int(r['SaleID']): r for r in cur.fetchall()}
            self.watch_bills(rows)
            cur.execute("SELECT TOP 100 SaleReturnID, SaleReturnNo, CreatedOn, TotalSaleReturn FROM dbo.SaleReturn "
                        "WHERE SaleReturnID > %d AND DocStatusID <> 3 ORDER BY SaleReturnID", (self.last_ret,))
            for r in cur.fetchall():
                self.last_ret = max(self.last_ret, int(r['SaleReturnID']))
                if r.get('CreatedOn'):
                    self.add({'kind': 'return', 'no': str(r['SaleReturnNo'] or r['SaleReturnID']).strip(), 'at': pk_epoch(r['CreatedOn']),
                              'amount': float(r.get('TotalSaleReturn') or 0), 'party': ''})
            # v1.6: Cash Received voucher (galle par paisa aane ka asal waqt)
            try:
                self.poll_vouchers(cur)
                self.vch_err = ''
            except Exception as e:
                self.vch_err = str(e)[:120]
                log('voucher:', e)
        finally:
            con.close()

    # ---------- v1.6: VOUCHER ----------
    def vch_discover(self, cur):
        """POS mein bill ka cash galle par receive hone ka waqt kahan likha hai — aik dafa khud dhoondo, phir pos-voucher.json mein yaad.
        Tarteeb: dbo.Voucher ka koi khana bill (SaleNo/SaleID) rakhta hai? -> VoucherDetail? -> Sale mein voucher ka khana? ->
        Sale ke System Notes mein "Cash Received By .. On .."? -> kuch nahi (mode 'sale' = bill ke waqt se, purana tareeqa)."""
        info = {'mode': 'sale', 'why': '', 'at': now_ms()}
        cols = lambda t: (cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = %s", (t,)),
                          {r['COLUMN_NAME']: str(r['DATA_TYPE']).lower() for r in cur.fetchall()})[1]
        vcols, scols = cols('Voucher'), cols('Sale')
        cur.execute("SELECT SaleID, SaleNo FROM dbo.Sale WHERE CreatedOn >= DATEADD(HOUR, -72, GETDATE())")
        srows = cur.fetchall()
        ids = {int(r['SaleID']) for r in srows}
        nos = {norm_no(r['SaleNo']) for r in srows if norm_no(r['SaleNo'])}
        raw = {str(r['SaleNo']).strip() for r in srows if r.get('SaleNo')}
        tcol = first_col(vcols, VCH_TIME_COLS, ('datetime', 'smalldatetime', 'date')) if 'VoucherID' in vcols else None
        vrows = []
        if tcol:
            cur.execute(f"SELECT TOP 300 * FROM dbo.Voucher WHERE [{tcol}] >= DATEADD(HOUR, -72, GETDATE()) ORDER BY VoucherID DESC")
            vrows = cur.fetchall()
            base = {'time': tcol, 'amount': first_col(vcols, VCH_AMT_COLS), 'type': first_col(vcols, VCH_TYPE_COLS),
                    'no': first_col(vcols, VCH_NO_COLS) or 'VoucherID', 'by': first_col(vcols, ('CreatedBy', 'UserID', 'EnteredBy')),
                    'txt': first_col(vcols, VCH_TXT_COLS), 'n': len(vrows)}
            link = find_link(vrows, ids, nos, raw, skip={'VoucherID', tcol})
            if link:
                info.update(base, mode='voucher', table='Voucher', link=link[0], link_mode=link[1], hits=link[2])
            else:
                try:
                    cur.execute(f"SELECT TOP 900 d.*, v.VoucherID AS _vid FROM dbo.VoucherDetail d JOIN dbo.Voucher v ON v.VoucherID = d.VoucherID "
                                f"WHERE v.[{tcol}] >= DATEADD(HOUR, -72, GETDATE()) ORDER BY v.VoucherID DESC")
                    drows = cur.fetchall()
                    link = find_link(drows, ids, nos, raw, skip={'VoucherID', 'VoucherDetailID', 'ID'})
                    if link:
                        info.update(base, mode='voucher', table='VoucherDetail', link=link[0], link_mode=link[1], hits=link[2])
                except Exception as e:
                    info['why'] = ('VoucherDetail: ' + str(e))[:80]
            if info['mode'] == 'sale' and vrows:
                vids = {int(r['VoucherID']) for r in vrows if r.get('VoucherID') is not None}
                for c in [c for c in scols if 'voucher' in c.lower() or c.lower() in ('crvid', 'receiptid', 'cashreceiptid')]:
                    try:
                        cur.execute(f"SELECT [{c}] AS v FROM dbo.Sale WHERE CreatedOn >= DATEADD(HOUR, -72, GETDATE()) AND [{c}] IS NOT NULL")
                        vals = [r['v'] for r in cur.fetchall()]
                        h = sum(1 for v in vals if isinstance(v, (int, float)) and int(v) in vids)
                        if h >= 3 and h * 10 >= max(1, len(vals)) * 3:
                            info.update(base, mode='salecol', table='Sale', link=c, link_mode='id', hits=h)
                            break
                    except Exception as e:
                        info['why'] = (c + ': ' + str(e))[:80]
        if info['mode'] == 'sale':
            txt = [c for c, t in scols.items() if t in ('nvarchar', 'varchar', 'ntext', 'text', 'nchar', 'char')]
            if txt:
                cur.execute("SELECT TOP 80 " + ', '.join(f'[{c}]' for c in txt) + " FROM dbo.Sale ORDER BY SaleID DESC")
                rows = cur.fetchall()
                for c in txt:
                    if any(NOTES_RE.search(str(r.get(c) or '')) for r in rows):
                        info.update(mode='notes', table='Sale', link=c, link_mode='text', hits=sum(1 for r in rows if NOTES_RE.search(str(r.get(c) or ''))))
                        break
            if info['mode'] == 'sale' and not info['why']:
                info['why'] = ('Voucher mein bill ka khana nahi' if vrows else ('aakhri 3 din mein koi voucher nahi' if tcol else 'dbo.Voucher / waqt ka khana nahi'))
        return info

    def vch_load(self, cur):
        i = self.vch
        if i and (now_ms() - int(i.get('at') or 0) < (7 if i.get('mode') != 'sale' else 0.25) * 86400000):
            return i
        i = load_json(VCH_FILE, None)
        if not (i and now_ms() - int(i.get('at') or 0) < (7 if i.get('mode') != 'sale' else 0.25) * 86400000):
            i = self.vch_discover(cur)
            save_json(VCH_FILE, i)
            log('voucher dhoond:', i.get('mode'), i.get('table'), i.get('link'), i.get('link_mode'), i.get('hits'), i.get('why'))
        self.vch, self.last_vch = i, 0
        return i

    def sale_of(self, i, r, col=None):
        """Voucher ki qataar se bill (sale rec) — link khane ke mutabiq."""
        v = r.get(col or i.get('link'))
        if v is None:
            return None
        if i.get('link_mode') == 'id':
            try:
                return self.sale_by_id.get(int(v))
            except (TypeError, ValueError):
                return None
        if i.get('link_mode') == 'no':
            return self.sale_by_no.get(norm_no(v))
        t = str(v)
        for no, rec in self.sale_by_no.items():
            if len(rec['no']) >= 5 and rec['no'] in t:
                return rec
        return None

    def vch_rec(self, i, r, sale, at, vno):
        """crv (bill ka cash galle par) ya voucher (koi aur POS voucher — kharch waghaira; galla khulna phir bhi jaiz)."""
        amt = r.get(i.get('amount')) if i.get('amount') else None
        try:
            amt = float(amt or 0)
        except (TypeError, ValueError):
            amt = 0.0
        vt = r.get(i.get('type')) if i.get('type') else None
        who = self.user_name(r.get(i.get('by'))) if i.get('by') and r.get(i.get('by')) not in (None, '') else ''
        vid = r.get('VoucherID')
        if sale:
            return {'kind': 'crv', 'no': str(vno)[:40], 'vid': vid, 'bill': sale['no'], 'at': at, 'amount': amt if amt > 0 else sale['amount'],
                    'party': sale.get('party', ''), 'who': who, 'billAt': sale['at'], 'change': change_of(sale)}
        txt = str(r.get(i.get('txt')) or '')[:60] if i.get('txt') else ''
        return {'kind': 'voucher', 'no': str(vno)[:40], 'vid': vid, 'at': at, 'amount': amt, 'party': txt or (str(vt)[:12] if vt not in (None, '') else ''), 'who': who}

    def poll_vouchers(self, cur):
        i = self.vch_load(cur)
        mode = i.get('mode')
        if mode == 'voucher':
            tcol = i['time']
            if not self.last_vch:
                cur.execute(f"SELECT ISNULL(MIN(VoucherID), 0) - 1 AS a FROM dbo.Voucher WHERE [{tcol}] >= DATEADD(HOUR, -4, GETDATE())")
                self.last_vch = int(cur.fetchone()['a'] or 0)
                if self.last_vch < 0:
                    cur.execute("SELECT ISNULL(MAX(VoucherID), 0) AS a FROM dbo.Voucher"); self.last_vch = int(cur.fetchone()['a'] or 0)
            cur.execute(f"SELECT TOP 500 * FROM dbo.Voucher WHERE VoucherID > %d ORDER BY VoucherID", (self.last_vch,))
            vrows = cur.fetchall()
            details = {}
            if i.get('table') == 'VoucherDetail' and vrows:
                vids = ','.join(str(int(r['VoucherID'])) for r in vrows)
                cur.execute(f"SELECT * FROM dbo.VoucherDetail WHERE VoucherID IN ({vids})")
                for d in cur.fetchall():
                    details.setdefault(int(d['VoucherID']), []).append(d)
            for r in vrows:
                vid = int(r['VoucherID'])
                self.last_vch = max(self.last_vch, vid)
                if not r.get(tcol):
                    continue
                at = pk_epoch(r[tcol])
                sale = None
                if i.get('table') == 'VoucherDetail':
                    sale = next((s for s in (self.sale_of(i, d) for d in details.get(vid, [])) if s), None)
                else:
                    sale = self.sale_of(i, r)
                self.add(self.vch_rec(i, r, sale, at, r.get(i.get('no')) or vid))
        elif mode == 'salecol':
            c, tcol = i['link'], i['time']
            if not self.last_vch:
                cur.execute(f"SELECT ISNULL(MIN(VoucherID), 0) - 1 AS a FROM dbo.Voucher WHERE [{tcol}] >= DATEADD(HOUR, -4, GETDATE())")
                self.last_vch = int(cur.fetchone()['a'] or 0)
            cur.execute(f"SELECT TOP 500 v.*, s.SaleID AS _sid FROM dbo.Voucher v JOIN dbo.Sale s ON s.[{c}] = v.VoucherID WHERE v.VoucherID > %d ORDER BY v.VoucherID", (self.last_vch,))
            for r in cur.fetchall():
                vid = int(r['VoucherID'])
                self.last_vch = max(self.last_vch, vid)
                if r.get(tcol):
                    self.add(self.vch_rec(i, r, self.sale_by_id.get(int(r['_sid'])), pk_epoch(r[tcol]), r.get(i.get('no')) or vid))
        elif mode == 'notes':
            c = i['link']
            cur.execute(f"SELECT TOP 400 SaleID, SaleNo, TotalSale, [{c}] AS t FROM dbo.Sale WHERE CreatedOn >= DATEADD(HOUR, -4, GETDATE()) "
                        f"OR UpdatedOn >= DATEADD(HOUR, -4, GETDATE())")
            for r in cur.fetchall():
                sale = self.sale_by_id.get(int(r['SaleID']))
                no = str(r.get('SaleNo') or r['SaleID']).strip()
                for k, (who, at) in enumerate(notes_times(r.get('t'))):
                    self.add({'kind': 'crv', 'no': f'{no}#{k + 1}', 'bill': no, 'at': at, 'amount': float(r.get('TotalSale') or 0),
                              'party': (sale or {}).get('party', ''), 'who': who, 'billAt': (sale or {}).get('at', at), 'change': change_of(sale)})

    def user_name(self, uid):
        """POS ka user naam (best-effort) — table na mile to 'user 8'."""
        if uid in (None, '', 0):
            return ''
        if self.users is None:
            self.users = {}
            try:
                cfg = (load_json(os.path.join(KHATA_DIR, 'local-config.json'), {}) or {}).get('sql') or {}
                pymssql = need('pymssql', 'pymssql')
                con = pymssql.connect(server=cfg['server'], user=cfg.get('user'), password=cfg.get('password'), database=cfg.get('database', 'POS'),
                                      login_timeout=10, timeout=20, as_dict=True)
                try:
                    cur = con.cursor()
                    cur.execute("SELECT TOP 1 TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('Users','UserMaster','tblUsers','AppUsers','Login','LoginUser')")
                    t = cur.fetchone()
                    if t:
                        cur.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = %s", (t['TABLE_NAME'],))
                        cols = [c['COLUMN_NAME'] for c in cur.fetchall()]
                        idc = next((c for c in cols if c.lower() in ('userid', 'id', 'loginid')), None)
                        nc = next((c for c in cols if c.lower() in ('username', 'name', 'loginname', 'fullname', 'displayname')), None)
                        if idc and nc:
                            cur.execute(f"SELECT [{idc}] AS i, [{nc}] AS n FROM dbo.[{t['TABLE_NAME']}]")
                            self.users = {int(r['i']): str(r['n'])[:40] for r in cur.fetchall() if r.get('i') is not None}
                finally:
                    con.close()
            except Exception as e:
                log('pos users:', e)
        return self.users.get(int(uid), f'user {uid}')

    def watch_bills(self, rows):
        """v1.3: bill ki agli haalat — CANCEL (DocStatusID 3), raqam KAM (edit), ya ITEMS badle (raqam wahi)."""
        now = time.time()
        for sid, r in rows.items():
            cur = {'no': str(r.get('SaleNo') or sid).strip(), 'total': float(r.get('TotalSale') or 0), 'status': int(r.get('DocStatusID') or 0),
                   'n': int(r.get('n') or 0), 'h': r.get('h'), 'at': pk_epoch(r['CreatedOn']) if r.get('CreatedOn') else now,
                   'by': r.get('UpdatedBy') or r.get('CreatedBy'), 'when': pk_epoch(r['UpdatedOn']) if r.get('UpdatedOn') else now}
            old = self.bills.get(sid)
            self.bills[sid] = cur
            if old is None or old['status'] == 3:
                continue
            kind = None
            if cur['status'] == 3:
                kind = 'cancel'
            elif cur['total'] < old['total'] - 0.5:
                kind = 'edit'
            elif cur['h'] != old['h'] or cur['n'] != old['n']:
                kind = 'items'
            if kind:
                self.alert(kind, sid, old, cur)
        for sid in [k for k in self.bills if now - self.bills[k]['at'] > 5 * 3600]:
            self.bills.pop(sid, None)
        # cancel / edit ke 10 min ke andar naya (sasta) bill = "iski jagah"
        for aid, a in list(self.alerts.items()):
            if a.get('replacedBy') or now - a['when'] > 900:
                continue
            for sid, b in self.bills.items():
                if b['status'] != 3 and b['no'] != a['no'] and a['when'] - 60 <= b['at'] <= a['when'] + 600 and b['total'] < a['before']:
                    a['replacedBy'] = {'no': b['no'], 'amount': b['total'], 'at': int(b['at'] * 1000)}
                    self.write_alert(aid, a)
                    break

    def alert(self, kind, sid, old, cur):
        aid = f"{cur['no']}-{int(cur['when'] * 1000)}"
        if aid in self.alerts:
            return
        a = {'kind': kind, 'no': cur['no'], 'before': old['total'], 'after': 0.0 if kind == 'cancel' else cur['total'], 'at': int(cur['at'] * 1000),
             'when': cur['when'], 'by': str(self.user_name(cur['by']))[:40], 'date': pk_date(cur['when']), 'eventId': ''}
        try:
            if self.galla:
                a['eventId'] = self.galla.by_bill.get(cur['no'], '')
        except Exception:
            pass
        self.alerts[aid] = a
        log('bill', kind, a['no'], a['before'], '->', a['after'])
        self.write_alert(aid, a)
        if self.galla:
            self.galla.bump('pos', a['date'], alerts=1)
        # camera ke card par bhi
        if a['eventId'] and self.fire:
            try:
                ev = self.fire.get(f"{BIZ}/cameraEvents/{a['eventId']}") or {}
                m = dict(ev.get('match') or {})
                m.update({'changed': kind, 'after': a['after'], 'alertId': aid})
                self.fire.patch(f"{BIZ}/cameraEvents/{a['eventId']}", {'match': m, 'matchAt': now_ms()})
            except Exception as e:
                log('card par bill badla nahi likha:', e)

    def write_alert(self, aid, a):
        if not self.fire:
            return
        doc = {k: v for k, v in a.items() if k != 'when'}
        doc['when'] = int(a['when'] * 1000)
        doc['amount'] = a['before']
        try:
            self.fire.patch(f'{BIZ}/posAlerts/{aid}', doc)
        except Exception as e:
            log('posAlerts nahi likha:', e)

    def poll_bk(self):
        import requests
        keyf = os.path.join(KHATA_DIR, 'firebase-key.json')
        if not os.path.exists(keyf):
            raise RuntimeError('Blue Khata ki firebase-key.json nahi mili')
        if self.bk_creds is None:
            need('google.auth', 'google-auth')
            from google.oauth2 import service_account
            self.bk_creds = service_account.Credentials.from_service_account_file(keyf, scopes=['https://www.googleapis.com/auth/datastore'])
            self.bk_pid = load_json(keyf, {}).get('project_id')
        from google.auth.transport.requests import Request
        if not self.bk_creds.valid:
            self.bk_creds.refresh(Request())
        since = int((time.time() - 4 * 3600) * 1000)
        body = {'structuredQuery': {'from': [{'collectionId': 'gallaCalls'}], 'where': {'fieldFilter': {
            'field': {'fieldPath': 'paidAt'}, 'op': 'GREATER_THAN_OR_EQUAL', 'value': {'integerValue': str(since)}}}}}
        r = requests.post(f'https://firestore.googleapis.com/v1/projects/{self.bk_pid}/databases/(default)/documents/businesses/noor-traders:runQuery',
                          headers={'Authorization': 'Bearer ' + self.bk_creds.token}, json=body, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f'Blue Khata {r.status_code}: {r.text[:120]}')
        for row in r.json():
            d = row.get('document')
            if not d:
                continue
            f = {k: dec(v) for k, v in d.get('fields', {}).items()}
            if f.get('status') != 'paid' or not f.get('paidAt'):
                continue
            self.add({'kind': 'pay', 'no': d['name'].rsplit('/', 1)[-1], 'at': float(f['paidAt']) / 1000, 'amount': float(f.get('amount') or 0) / 100,
                      'party': str(f.get('partyName') or '')[:60], 'who': str(f.get('paidName') or '')[:40]})


FLOWS = ('aaya', 'nikla', 'len_den', 'ginti', 'kuch_nahi')
FLOW_TEXT = {'aaya': 'paisa aaya', 'nikla': 'paisa nikla', 'len_den': 'paisa liya + baqaya diya', 'ginti': 'sirf ginti', 'kuch_nahi': 'paisa nahi hila'}


def context_text(recs):
    """AI ke liye us waqt ka record (Roman Urdu). v1.6: bill ke DONO waqt — counter par bana, galle par Cash Received voucher."""
    if not recs:
        return 'is waqt POS par koi bill, Cash Received voucher, refund ya Galla screen payment record NAHI hai'
    paid = {r.get('bill') for r in recs if r['kind'] == 'crv'}
    out = []
    for r in sorted(recs, key=lambda x: x['at'])[:8]:
        if r['kind'] == 'sale':
            out.append(f"Bill #{r['no']} {rs(r['amount'])} counter par bana {clock(r['at'])}" + (' (udhaar)' if r.get('credit') else '')
                       + ('' if r['no'] in paid or r.get('credit') else ' — galle par abhi Cash Received nahi'))
        elif r['kind'] == 'crv':
            ch = r.get('change')
            chx = (f' — POS: baqaya {rs(ch)} banta hai' if ch else (' — POS: di hui raqam = bill (baqaya 0)' if ch == 0 else ''))
            out.append(f"CASH RECEIVED voucher: Bill #{r.get('bill')} {rs(r['amount'])} galle par {clock(r['at'])} (galla khulna JAIZ){chx}")
        elif r['kind'] == 'voucher':
            out.append(f"POS voucher #{r['no']} {rs(r['amount'])} {clock(r['at'])}" + (f" ({r['party']})" if r.get('party') else '') + ' (galla khulna jaiz)')
        elif r['kind'] == 'return':
            out.append(f"POS refund #{r['no']} {rs(r['amount'])} {clock(r['at'])}")
        else:
            out.append(f"Galla screen: {r.get('party') or 'supplier'} ko {rs(r['amount'])} de diye {clock(r['at'])}")
    return '; '.join(out)


GALLA_PROMPT3 = ('Ye {n} tasveerein aik dukaan ke GALLA (cash ki daraz / dabba) ki CCTV se hain, waqt ki tarteeb mein (taqreeban {gap} '
                 'second ka farq). Dukaan ka tareeqa: customer parchi (bill) aur paisa deta hai -> larka paisa haath mein ya note ginne '
                 'wali machine mein ginta hai -> parchi scan hoti hai (POS mein "Cash Received") -> galle se baqaya deta hai -> paisa '
                 'galle mein rakhta hai. Ye poora silsila NORMAL hai; paisa haath / machine / counter par rehna shak NAHI. Larka kursi '
                 'par baitha hota hai: note GODE (lap) par rakh kar ginna, haath mein pakre rehna, paas ki tokri / dabbe mein rakhna — '
                 'upar se camera mein ye haath shalwar / qameez / gode ke PAAS dikhta hai, ye shak NAHI. '
                 'Us waqt ka record: {ctx}. Batao: (1) "flow" — "aaya" (kisi se paisa le kar galla mein rakha), '
                 '"nikla" (galla se nikal kar kisi ko diya), "len_den" (paisa liya AUR baqaya wapas diya), "ginti" (sirf gine / seedhe '
                 'kiye), "kuch_nahi" (paisa nahi hila). (2) "khula" — galle ki daraz / dabba khula ya haath us ke andar gaya to true, warna '
                 'false. (3) "verdict" — "shak" SIRF tab jab note saaf nazar aaye ke jeb ke ANDAR, qameez / shalwar ke ANDAR ya kisi '
                 'chhupi jagah mein gaya aur wahan se wapas nahi aaya; "paas le jana" shak nahi; '
                 'haath seene / jeb ke paas hona, qalam ya phone rakhna shak NAHI. Record mein bill / voucher hai aur paisa customer se '
                 'liya / baqaya diya to "normal". Galla bina record ke khula ya nahi — ye faisla program khud record se karega, tum sirf '
                 'jo dikhta hai wo batao. Saaf na dikhe to "saaf_nahi". Kisi insaan ki pehchan, naam ya chehre ki baat mat karo.{examples} '
                 'Jawab SIRF JSON: {{"flow": "...", "khula": true, "verdict": "...", "why": "Roman Urdu (English harf) mein aik chhoti line"}}')
GALLA_PROMPT2 = GALLA_PROMPT3   # purana naam (tests)


def parse_flow(text):
    v, why = parse_verdict(text)
    m = re.search(r'\{.*\}', text or '', re.S)
    try:
        j = json.loads(m.group(0)) if m else {}
    except ValueError:
        j = {}
    fl = str(j.get('flow', '')).strip().lower().replace(' ', '_').replace('-', '_')
    return (fl if fl in FLOWS else 'saaf_nahi'), v, why


def parse_khula(text):
    """v1.6: AI ne "khula" (galle ki daraz khuli / haath andar) bataya? True / False / None (nahi bataya)."""
    m = re.search(r'"khula"\s*:\s*(true|false|"?(haan|han|yes|nahi|no)"?)', text or '', re.I)
    if not m:
        return None
    return m.group(1).strip('"').lower() in ('true', 'haan', 'han', 'yes')


def ai_judge2(key, crops_b64, ctx, gap, examples=''):
    import requests
    content = [{'type': 'text', 'text': GALLA_PROMPT3.format(n=len(crops_b64), gap=gap, ctx=ctx, examples=examples)}]
    for i, b in enumerate(crops_b64, 1):
        content += [{'type': 'text', 'text': f'Tasveer {i}'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b}}]
    t0 = time.time()
    r = requests.post('https://api.anthropic.com/v1/messages', timeout=120,
                      headers={'x-api-key': clean_key(key), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                      json={'model': MODEL, 'max_tokens': 220, 'messages': [{'role': 'user', 'content': content}]})
    if r.status_code != 200:
        raise RuntimeError(api_error(r))
    txt = ' '.join(b.get('text', '') for b in r.json().get('content', []) if b.get('type') == 'text')
    fl, v, why = parse_flow(txt)
    return fl, v, why, int((time.time() - t0) * 1000), parse_khula(txt)


CONFIRM_PROMPT = ('Aik chhote AI ne in {n} CCTV tasveeron (dukaan ka GALLA, waqt ki tarteeb, ~{gap} s farq) par SHAK kaha: "{why}". '
                  'Tum doosri raaye do, bohat ehtiyat se. Dukaan ka tareeqa: larka kursi par baith kar customer ka paisa haath mein / GODE '
                  '(lap) par / note ginne ki machine mein ginta hai, galle se baqaya deta hai, paisa galle ya paas ki tokri mein rakhta hai — '
                  'upar se camera mein haath shalwar / qameez ke PAAS dikhna bilkul aam hai aur shak NAHI. Record: {ctx}. "shak" SIRF tab '
                  'jab kam az kam do tasveeron mein saaf dikhe ke note jeb ke ANDAR ya kapron ke ANDAR chala gaya (ya chhupaya gaya) aur '
                  'galle / tokri / customer tak wapas nahi gaya. Pakka na ho to "normal". Kisi insaan ki pehchan mat karo. Jawab SIRF JSON: '
                  '{{"verdict": "shak" ya "normal", "why": "Roman Urdu (English harf) mein aik chhoti line — kis tasveer mein kya dikha"}}')


def ai_confirm(key, crops_b64, ctx, gap, why):
    """v1.7: shak ki doosri raaye (bara model). Wapas (verdict 'shak'|'normal', why, ms, model). Model na chale to agla."""
    import requests
    content = [{'type': 'text', 'text': CONFIRM_PROMPT.format(n=len(crops_b64), gap=gap, ctx=ctx, why=str(why or '')[:200])}]
    for i, b in enumerate(crops_b64, 1):
        content += [{'type': 'text', 'text': f'Tasveer {i}'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b}}]
    last = ''
    for model in CONFIRM_MODELS:
        t0 = time.time()
        r = requests.post('https://api.anthropic.com/v1/messages', timeout=120,
                          headers={'x-api-key': clean_key(key), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                          json={'model': model, 'max_tokens': 220, 'messages': [{'role': 'user', 'content': content}]})
        if r.status_code in (400, 404) and 'model' in (r.text or '').lower():
            last = api_error(r)
            continue
        if r.status_code != 200:
            raise RuntimeError(api_error(r))
        txt = ' '.join(b.get('text', '') for b in r.json().get('content', []) if b.get('type') == 'text')
        v, w = parse_verdict(txt)
        return ('shak' if v == 'shak' else 'normal'), w, int((time.time() - t0) * 1000), model
    raise RuntimeError(last or 'doosra AI model nahi mila')


STORY_KYA = ('parchi_paisa', 'paisa', 'parchi', 'rakha', 'baqaya', 'diya', 'jeb', 'khara', 'gaya', 'ginti')
KAHANI_PROMPT = ('Ye {n} tasveerein aik dukaan ke GALLA (cash ki daraz / tokri) aur COUNTER (jahan customer haath aage karta hai) ki CCTV '
                 'se hain, waqt ki tarteeb mein; har tasveer ke sath us ka waqt likha hai. Dukaan ka tareeqa: customer parchi (safed chhota '
                 'kaghaz) aur paisa deta hai -> galle wala larka (aksar kursi par baitha) paisa haath / gode / note ginne ki machine mein ginta '
                 'hai -> parchi scan (POS "Cash Received") -> galle se baqaya USI customer ko -> paisa galle ya paas ki tokri mein. Ye NORMAL '
                 'hai; haath gode / shalwar / qameez ke PAAS dikhna shak NAHI. Us waqt ka POS record: {ctx}. Poori KAHANI likho — har ahem lamha '
                 'aik line: "i" = tasveer ka number; "kaun" = jagah aur kapron ka rang (jaise "daayen customer, neela kurta" ya "galle wala") — '
                 'naam ya chehre ki pehchan HARGIZ nahi; "kya" in mein se aik: parchi_paisa (customer ne parchi + paisa diya), paisa (customer ne '
                 'sirf paisa diya, parchi nahi), parchi (customer ne sirf parchi di, paisa NAHI diya), rakha (galle wale ne paisa galle / tokri '
                 'mein rakha), baqaya (galle se nikal kar paisa usi ko diya jis ne paisa diya tha), diya (galle se nikal kar paisa kisi AUR ko '
                 'diya — jis ne paisa nahi diya tha), jeb (note jeb / kapron ke ANDAR gaya), khara (koi aaya aur khara raha), gaya (chala gaya), '
                 'ginti (sirf gina); "kis" (baqaya / diya kis ko): "wahi" | "aur" | "mulazim"; "note": "bada" (1000 neela / 5000 peela-bhoora '
                 'jaisa bara note), "chhota" ya "?". Phir: "log" = kitne ALAG customers ne paisa diya; "flow" = aaya | nikla | len_den | ginti | '
                 'kuch_nahi; "khula" = galla khula / haath andar (true/false); "verdict" = "shak" SIRF jab note saaf jeb / kapron ke ANDAR gaya, '
                 'warna "normal", saaf na dikhe to "saaf_nahi"; "why" = Roman Urdu (English harf) mein aik chhoti line. Jo saaf na dikhe wo mat '
                 'gharo — us lamhe ko chhor do.{examples} Jawab SIRF JSON: {{"story": [{{"i": 3, "kaun": "...", "kya": "...", "kis": "", "note": ""}}], '
                 '"log": 1, "flow": "...", "khula": true, "verdict": "...", "why": "..."}}')


def claude_call(key, content, models, max_tokens=700):
    """Claude ko aik sawal; model na chale (400 / 404 + "model") to agla. Wapas (matn, ms, model)."""
    import requests
    last = ''
    for model in models:
        t0 = time.time()
        r = requests.post('https://api.anthropic.com/v1/messages', timeout=150,
                          headers={'x-api-key': clean_key(key), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                          json={'model': model, 'max_tokens': max_tokens, 'messages': [{'role': 'user', 'content': content}]})
        if r.status_code in (400, 404) and 'model' in (r.text or '').lower() and model != models[-1]:
            last = api_error(r)
            continue
        if r.status_code != 200:
            raise RuntimeError(api_error(r))
        j = r.json()
        txt = ' '.join(b.get('text', '') for b in j.get('content', []) if b.get('type') == 'text')
        u = j.get('usage') or {}
        COST['last'] = cost_rs(model, u.get('input_tokens') or 0, u.get('output_tokens') or 0)
        return txt, int((time.time() - t0) * 1000), model
    raise RuntimeError(last or 'model nahi mila')


COST = {'last': 0.0}


def cost_rs(model, tin, tout):
    """v1.9: aik jawab ka kharcha rupay mein (andaza — asal bill Claude Console par)."""
    pi, po = PRICE.get(model, (3.0, 15.0))
    return round((tin * pi + tout * po) / 1e6 * FX_PKR, 3)


def parse_story(text, n):
    """AI ki kahani (JSON) -> saaf dict. Ghalat / anjaan cheezein chhor di jati hain."""
    m = re.search(r'\{.*\}', text or '', re.S)
    try:
        j = json.loads(m.group(0)) if m else {}
    except ValueError:
        j = {}
    story = []
    for e in (j.get('story') or [])[:16]:
        if not isinstance(e, dict):
            continue
        kya = str(e.get('kya') or '').strip().lower()
        try:
            i = int(e.get('i'))
        except (TypeError, ValueError):
            continue
        if kya not in STORY_KYA or not 1 <= i <= n:
            continue
        kis = str(e.get('kis') or '').strip().lower()
        note = str(e.get('note') or '').strip().lower()
        story.append({'i': i, 'kaun': str(e.get('kaun') or '')[:40], 'kya': kya, 'kis': kis if kis in ('wahi', 'aur', 'mulazim') else '',
                      'note': note if note in ('bada', 'chhota') else ''})
    story.sort(key=lambda e: e['i'])
    fl = str(j.get('flow', '')).strip().lower().replace(' ', '_').replace('-', '_')
    v, why = parse_verdict(text)
    try:
        lg = max(0, min(9, int(j.get('log') or 0)))
    except (TypeError, ValueError):
        lg = 0
    return {'story': story, 'log': lg, 'flow': fl if fl in FLOWS else 'saaf_nahi', 'khula': parse_khula(text), 'verdict': v, 'why': why}


def ai_story(key, frames, ctx, examples='', models=(MODEL,)):
    """frames = [(t, b64)]. Wapas (parse_story dict, ms, model)."""
    content = [{'type': 'text', 'text': KAHANI_PROMPT.format(n=len(frames), ctx=ctx, examples=examples)}]
    for i, (t, b) in enumerate(frames, 1):
        content += [{'type': 'text', 'text': f'Tasveer {i} ({clock(t)})'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b}}]
    txt, ms, model = claude_call(key, content, models)
    return parse_story(txt, len(frames)), ms, model


CHEAP_PROMPT = ('Ye {n} tasveerein aik dukaan ke GALLA (khuli daraz / tokri) aur COUNTER ki CCTV se hain, waqt ki tarteeb mein '
                '(~{gap} s farq). Larka kursi par baith kar customer ka paisa haath / gode / machine mein ginta hai, galle mein rakhta hai, aur '
                'galle se BAQAYA usi customer ko deta hai jis ne parchi + paisa diya — ye normal hai. POS record: {ctx}. SIRF ye batao: '
                '(1) "nikla": kya galle / tokri se paisa nikal kar KISI KO DIYA gaya? true/false (sirf nikal kar haath mein rakhna ya ginna = '
                'false). (2) "kis": "wahi" = usi customer ko jis ne parchi/paisa diya, "aur" = kisi aur banda (jis ne paisa nahi diya), '
                '"jeb" = note jeb / kapron ke ANDAR gaya, "haath" = kisi ko nahi diya, "?" = saaf nahi. (3) "note": "bada" (1000 neela / '
                '5000 peela-bhoora) | "chhota" | "?". (4) "why": Roman Urdu (English harf) mein aik chhoti line. Naam / chehre ki pehchan '
                'nahi. Jawab SIRF JSON: {{"nikla": false, "kis": "", "note": "", "why": "..."}}')


def parse_cheap(text):
    m = re.search(r'\{.*\}', text or '', re.S)
    try:
        j = json.loads(m.group(0)) if m else {}
    except ValueError:
        j = {}
    kis = str(j.get('kis') or '').strip().lower()
    note = str(j.get('note') or '').strip().lower()
    nik = j.get('nikla')
    nik = (nik is True) or (isinstance(nik, str) and nik.strip().lower() in ('true', 'haan', 'han', 'yes'))
    return {'nikla': nik, 'kis': kis if kis in ('wahi', 'aur', 'jeb', 'haath', '?') else '?', 'note': note if note in ('bada', 'chhota') else '',
            'why': str(j.get('why') or '')[:200]}


def small_b64(b64, width=CHEAP_W, quality=CHEAP_Q):
    """tape ki JPEG (416 px) -> aur chhoti (288 px) — sasta sawal."""
    import cv2, numpy as np
    img = cv2.imdecode(np.frombuffer(base64.b64decode(b64), dtype='uint8'), cv2.IMREAD_COLOR)
    if img is None:
        return b64
    return jpeg_b64(img, width=width, quality=quality)[0]


def ai_cheap(key, frames, ctx, gap):
    """v1.9: sasta sawal (chhota AI). frames = [(t, b64 416px)]. Wapas (dict, ms, model)."""
    content = [{'type': 'text', 'text': CHEAP_PROMPT.format(n=len(frames), gap=gap, ctx=ctx)}]
    for i, (t, b) in enumerate(frames, 1):
        content += [{'type': 'text', 'text': f'Tasveer {i} ({clock(t)})'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': small_b64(b)}}]
    txt, ms, model = claude_call(key, content, (MODEL,), max_tokens=160)
    return parse_cheap(txt), ms, model


def judge_cheap(res, crvs, tender=False):
    """v1.9: chhote AI ke jawab ko Cash Received voucher se milao. Wapas (flags, why lines). Flags = 🔴 candidate.
    Sirf crv dekhte hain — doosre vouchers (Galla screen / kharch) NAHI (malik video se khud faisla karega)."""
    if not res.get('nikla'):
        return [], []
    kis, note = res.get('kis'), res.get('note')
    flags, why = [], []
    if kis == 'jeb':
        return ['jeb'], [FLAG_TEXT['jeb']]
    if kis == 'haath':
        return [], []
    if not crvs:
        return ['novoucher'], [FLAG_TEXT['novoucher']]
    if kis == 'aur':
        flags.append('aurko'); why.append(FLAG_TEXT['aurko'])
    elif kis == '?':
        flags.append('unsure'); why.append(FLAG_TEXT['unsure'])
    known = [r for r in crvs if r.get('change') is not None]
    if tender and known and len(known) == len(crvs):
        mx = max(r['change'] for r in crvs)
        if mx <= 0:
            flags.append('nochange'); why.append('Baqaya banta hi nahi tha (POS: di hui raqam = bill) — phir bhi galle se paisa diya')
        elif note == 'bada' and mx < 1000:
            flags.append('badanote'); why.append(f'Baqaya {rs(mx)} banta tha, galle se bada note nikla')
    return flags, why


FLAG_TEXT = {'jeb': 'Paisa jeb / kapron mein', 'noparchi': 'Bina parchi paisa liya', 'parchi': 'Parchi di, paisa nahi diya',
             'aurko': 'Voucher ke waqt paisa kisi aur ko', 'nochange': 'Baqaya banta hi nahi tha', 'double': 'Aik bill par do dafa paisa nikla',
             'badanote': 'Chhote baqaye par bada note', 'nopay': 'Parchi scan · paisa nazar nahi aaya',
             'novoucher': 'Bina voucher paisa nikla', 'unsure': 'Paisa diya — kis ko, saaf nahi'}


def judge_story(res, t0, t1, near, vouchers=True, tender=False):
    """v1.8: AI ki kahani ko POS se milao. Wapas (flags, wajah ki lines). Bill posting / voucher sanad; AI sirf 'kya dikha'."""
    st = res.get('story') or []
    crvs = [r for r in near if r['kind'] == 'crv' and in_bill(r, t0, t1)]
    okrecs = [r for r in near if r['kind'] in ('pay', 'return', 'voucher') and in_bill(r, t0, t1)]
    pays = [e for e in st if e['kya'] in ('parchi_paisa', 'paisa')]
    to_payer = [e for e in st if e['kya'] == 'baqaya' and e['kis'] in ('wahi', '')]
    to_other = [e for e in st if e['kya'] == 'diya' or (e['kya'] == 'baqaya' and e['kis'] in ('aur', 'mulazim'))]
    flags, why = [], []
    def add(f, w):
        if f not in flags:
            flags.append(f); why.append(w)
    if res.get('verdict') == 'shak' or any(e['kya'] == 'jeb' for e in st):
        add('jeb', FLAG_TEXT['jeb'])
    if vouchers and crvs:
        n_pay = max(len({e['kaun'] or str(e['i']) for e in pays}), int(res.get('log') or 0))
        if n_pay > len(crvs):
            add('noparchi', f'{n_pay} logon ne paisa diya, {len(crvs)} parchi scan — {n_pay - len(crvs)} bina parchi')
        np = [e for e in st if e['kya'] == 'parchi']
        if np:
            add('parchi', f"Parchi di, paisa nahi diya ({np[0]['kaun'] or 'customer'})")
        if to_other and not okrecs:
            add('aurko', f"Voucher ke waqt paisa kisi aur ko ({to_other[0]['kaun'] or 'banda'})")
        known = [r for r in crvs if r.get('change') is not None]
        if to_payer and tender and len(known) == len(crvs):
            n_ch = sum(1 for r in crvs if r['change'] > 0)
            if n_ch == 0:
                add('nochange', 'Baqaya banta hi nahi tha (POS: di hui raqam = bill) — phir bhi galle se paisa diya')
            elif len(to_payer) > n_ch:
                add('double', f'Aik bill par do dafa paisa nikla ({len(to_payer)} dafa, baqaya {n_ch} bill ka)')
            mx = max(r['change'] for r in crvs)
            if 0 < mx < 1000 and any(e['note'] == 'bada' for e in to_payer):
                add('badanote', f'Baqaya {rs(mx)} banta tha, galle se bada note nikla')
        elif to_payer and len(to_payer) > len(crvs):
            add('double', f'Aik bill par do dafa paisa nikla ({len(to_payer)} dafa, {len(crvs)} parchi)')
    return flags, why


def story_doc(res, frames):
    return [{'i': e['i'], 't': int(frames[e['i'] - 1][0] * 1000), 'kaun': e['kaun'], 'kya': e['kya'], 'kis': e['kis'], 'note': e['note']}
            for e in res.get('story') or [] if 1 <= e['i'] <= len(frames)][:16]


BILL_BEFORE, BILL_AFTER = SALE_BEFORE, SALE_AFTER   # purane naam


def window(r):
    """Kis record par galla khulna kab tak jaiz hai: [shuru, khatam] epoch s."""
    k = r['kind']
    if k in ('crv', 'voucher'):
        return r['at'] - VCH_BEFORE, r['at'] + VCH_AFTER
    if k in ('pay', 'return'):
        return r['at'] - OUT_PAD, r['at'] + OUT_PAD
    if k == 'sale':
        return r.get('start', r['at']) - SALE_BEFORE, r['at'] + SALE_AFTER
    return None


def in_bill(r, t0, t1):
    """Len-den [t0, t1] is record ki window se takraye?"""
    w = window(r)
    return bool(w) and t0 <= w[1] and t1 >= w[0]


def match(flow, t0, t1, recs, pos_ok=True, bk_ok=True, vouchers=True, khula=None):
    """v1.6: GALLA SIRF VOUCHER PAR. Wapas (state, rec): ok | wait (abhi koi voucher nahi — 2 min dekhte raho, phir 'missing' = bina
    voucher galla khula) | none (galla khula hi nahi / paisa nahi hila) | nopos (POS / Galla screen parh nahi sake — alarm NAHI).
    vouchers=True: Cash Received voucher / POS voucher / refund / Galla screen "de diye" hi jaiz; bill ka banna kafi nahi.
    vouchers=False (POS mein voucher ka khana na mile): bill ke waqt se (purana tareeqa, thora khula)."""
    if flow == 'kuch_nahi' or (khula is False and flow in ('ginti', 'saaf_nahi')):
        return 'none', None
    mid = (t0 + t1) / 2
    kinds = ('crv', 'voucher', 'pay', 'return') if vouchers else ('sale', 'pay', 'return')
    pri = {'pay': 0, 'return': 0, 'crv': 1, 'sale': 1, 'voucher': 2} if flow == 'nikla' else {'crv': 0, 'sale': 0, 'pay': 1, 'return': 1, 'voucher': 2}
    cands = [r for r in recs if r['kind'] in kinds and in_bill(r, t0, t1)]
    if cands:
        return 'ok', min(cands, key=lambda r: (pri.get(r['kind'], 3), abs(r['at'] - mid)))
    if not pos_ok or (flow == 'nikla' and not bk_ok):
        return 'nopos', None
    return 'wait', None


def match_doc(m):
    if not m:
        return {}
    d = {'kind': m['kind'], 'no': str(m['no'])[:40], 'amount': round(float(m.get('amount') or 0), 2), 'at': int(m['at'] * 1000),
         'party': str(m.get('party') or '')[:60], 'who': str(m.get('who') or '')[:40]}
    if m.get('bill'):
        d['bill'] = str(m['bill'])[:40]
    if m.get('billAt'):
        d['billAt'] = int(m['billAt'] * 1000)
    return d


def merge_items(hold, now, wait=45):
    """v1.7: aik camera ki qareeb qareeb harkatein (agli ka shuru pichli ke khatam se MERGE_GAP s ke andar) = aik len-den.
    item = (w, at, t0, t1, frames[, counted]). Len-den tab tayyar jab aakhri harkat ke baad MERGE_GAP (aur kam az kam `wait`)
    second koi nayi harkat na aaye, ya len-den MERGE_MAX s tak pohanch jaye. Wapas (tayyar [(w, at, t0, t1, 10 frames, counted)],
    baqi hold)."""
    chains = []
    for it in sorted(hold, key=lambda x: (x[0].cid, x[2])):
        c = chains[-1] if chains else None
        if c and c['cid'] == it[0].cid and it[2] - c['t1'] <= MERGE_GAP and it[3] - c['t0'] <= MERGE_MAX:
            c['items'].append(it); c['t1'] = max(c['t1'], it[3])
        else:
            chains.append({'cid': it[0].cid, 't0': it[2], 't1': it[3], 'items': [it]})
    ready, rest = [], []
    for c in chains:
        full = c['t1'] - c['t0'] >= MERGE_MAX - 5
        if now >= c['t1'] + (wait if full else max(wait, MERGE_GAP)):
            first = c['items'][0]
            frames = [f for it in c['items'] for f in (it[4] or [])]
            counted = all((it[5] if len(it) > 5 else False) for it in c['items'])
            ready.append((first[0], first[1], c['t0'], c['t1'], pick(frames, 10), counted))
        else:
            rest.extend(c['items'])
    return ready, rest


class Galla(threading.Thread):
    """Len-den ki qataar. POS / Galla screen ka record aa sake is liye len-den khatam hone ke 45 s baad kaam. Pehle record ke
    qareeb wale bill / payment, phir Claude ko 10 tasveerein + record + malik ke pichle faisle. Faisla + milaan: cameraEvents.
    Na mila = 'wait' (2 min tak har 2 s dobara) -> 'ok' ya 'missing' = BINA VOUCHER GALLA KHULA (function malik ko khabar deta
    hai, PC clip banata hai). v1.6: bill ka banna kafi nahi — Cash Received voucher / refund / Galla screen chahiye."""
    WAIT_AFTER = 45
    MISSING_AFTER = 120

    def __init__(self, fire, pos=None):
        super().__init__(daemon=True)
        self.fire, self.pos, self.q, self.stats, self.dirty = fire, pos, queue.Queue(maxsize=40), {}, set()
        self.last_ai, self.pause_until, self.lock = {}, 0, threading.Lock()
        self.hold, self.waiting, self.examples, self.ex_at = [], [], '', 0
        self.by_bill = {}                                      # v1.3: bill no -> camera event id
        self.clips = None                                      # v1.4: Clips thread (shak par clip)
        self.moves, self.watch_of, self.crv_seen, self.nopay_at = collections.deque(maxlen=4000), {}, set(), 0   # v1.8
        self.daily = {}                                        # v1.9: (cid, date) -> aaj kitni "daily" videos

    def stat(self, cid, date):
        k = (cid, date)
        if k not in self.stats:
            try:
                old = self.fire.get(f'{BIZ}/cameraStats/{cid}_{date}') or {}
            except Exception:
                old = {}
            self.stats[k] = {'cam': cid, 'date': date, **{n: int(old.get(n) or 0) for n in
                             ('touches', 'checks', 'shak', 'unchecked', 'moneyIn', 'moneyOut', 'matched', 'missing', 'alerts')},
                             'cost': round(float(old.get('cost') or 0), 3)}      # v1.9: aaj ka AI kharcha (Rs)
        return self.stats[k]

    def bump(self, cid, date, **kv):
        with self.lock:
            st = self.stat(cid, date)
            for k, v in kv.items():
                st[k] = round(st.get(k, 0) + v, 3) if k == 'cost' else st.get(k, 0) + v
            self.dirty.add((cid, date))
        return st

    def recs(self, a, b):
        return self.pos.near(a, b) if self.pos else []

    def pos_ok(self):
        return bool(self.pos and self.pos.ok_sql())

    def bk_ok(self):
        return bool(self.pos and self.pos.ok_bk())

    def run(self):
        while True:
            try:
                while True:
                    it = self.q.get_nowait()
                    self.bump(it[0].cid, pk_date(it[1]), touches=1)      # v1.7: har harkat ginti mein (card aik len-den ka)
                    self.moves.append((it[0].cid, it[2], it[3])); self.watch_of[it[0].cid] = it[0]   # v1.8
                    self.hold.append(it + (True,) if len(it) == 5 else it)
            except queue.Empty:
                pass
            ready, self.hold = merge_items(self.hold, time.time(), self.WAIT_AFTER)
            for item in ready:
                try:
                    self.handle(*item)
                except Exception as e:
                    log('nigrani ghalti:', e, traceback.format_exc()[-300:])
            try:
                self.recheck()
            except Exception as e:
                log('milaan ghalti:', e)
            try:
                self.nopay_check()
            except Exception as e:
                log('nopay ghalti:', e)
            time.sleep(2)

    def nopay_check(self, now=None):
        """v1.8: parchi scan hui (Cash Received) lekin us ki window mein galle par koi harkat hi nahi -> 'Parchi scan · paisa nazar
        nahi aaya' (shak + khabar + clip). Sirf jab camera us poore waqt chal raha tha (tape) — PC / camera band ho to kuch nahi."""
        now = now or time.time()
        if now - self.nopay_at < 10 or not self.pos or not self.watch_of:
            return
        self.nopay_at = now
        for r in self.recs(now - 900, now - NOPAY_WAIT):
            if r['kind'] != 'crv':
                continue
            k = (r.get('vid') or r['no'], r['at'])
            if k in self.crv_seen:
                continue
            self.crv_seen.add(k)
            a, b = r['at'] - VCH_BEFORE, r['at'] + VCH_AFTER
            watches = [w for w in self.watch_of.values() if getattr(w, 'tape_covers', lambda *x: False)(a, b)]
            if not watches or any(t0 <= b and t1 >= a for _, t0, t1 in list(self.moves)):
                continue
            w = watches[0]
            kf = w.key_frames(r['at'] - 20, r['at'] + 40, 8, [r['at']])
            if not kf:
                continue
            date = pk_date(r['at'])
            eid, t = f"{w.cid}-np-{int(r['at'] * 1000)}", int(r['at'] * 1000)
            why = f"{FLAG_TEXT['nopay']}: Bill #{r.get('bill')} {rs(r['amount'])} ki parchi {clock(r['at'])} par scan hui, lekin galle par koi harkat nahi — paisa liya hi nahi ya kahin aur gaya?"
            self.fire.patch(f'{BIZ}/cameraFrames/{eid}', {'frames': [b for _, b in kf], 'times': [int(x * 1000) for x, _ in kf], 'at': t, 'cam': w.cid})
            doc = {'cam': w.cid, 'camName': w.name, 'at': t, 'date': date, 'verdict': 'shak', 'why': why[:290], 'flow': 'kuch_nahi', 'matchState': 'ok',
                   'match': match_doc(r), 'start': int(a * 1000), 'end': int(b * 1000), 'thumb': kf[len(kf) // 2][1], 'n': len(kf), 'ms': 0,
                   'model': 'pos', 'agent': VERSION, 'flags': ['nopay'], 'story': []}
            self.fire.patch(f'{BIZ}/cameraEvents/{eid}', doc)
            self.bump(w.cid, date, shak=1)
            if self.clips:
                self.clips.shak(w.cid, eid, r['at'] - 20, r['at'] + 10, date)
            log('nopay', w.cid, r.get('bill'))
        if len(self.crv_seen) > 3000:
            self.crv_seen = set(list(self.crv_seen)[-1500:])

    def load_examples(self):
        """Malik ke pichle faisle (Theek hai / Shak pakka) — AI ko misaal ke taur par, taake wahi ghalti dobara na ho."""
        if time.time() - self.ex_at < 600:
            return self.examples
        self.ex_at = time.time()
        try:
            rows = self.fire.query('cameraEvents', 'reviewed', 'IN', ['ok', 'confirmed'], 40)
            rows = sorted(rows, key=lambda r: -(r.get('at') or 0))[:6]
            lines = [f"AI ne kaha \"{str(r.get('why') or '')[:90]}\" ({r.get('verdict')}) -> malik: {'THEEK HAI (shak nahi tha)' if r.get('reviewed') == 'ok' else 'SHAK PAKKA'}"
                     + (f" — {str(r.get('reviewNote'))[:80]}" if r.get('reviewNote') else '') for r in rows]
            self.examples = (' Malik ke pichle faisle (in se seekho): ' + ' | '.join(lines) + '.') if lines else ''
        except Exception as e:
            log('misaalein nahi:', e)
        return self.examples

    def handle(self, w, at, t0, t1, frames, counted=False):
        date = pk_date(at)
        st = self.bump(w.cid, date, touches=0 if counted else 1)
        if (not frames and not hasattr(w, 'key_frames')) or at - self.last_ai.get(w.cid, 0) < COOLDOWN:
            return
        key = secrets().get('claudeKey')
        if not key or st['checks'] >= w.cap_day or float(st.get('cost') or 0) >= getattr(w, 'budget', 1e9) or time.time() < self.pause_until:
            self.bump(w.cid, date, unchecked=1)
            return
        self.last_ai[w.cid] = at
        near = self.recs(t0 - 180, t1 + 180)
        if hasattr(w, 'key_frames'):                                  # v1.9: sasta sawal; 🔴 par kahani (v1.8)
            must = [r['at'] for r in near if r['kind'] == 'crv' and t0 - VCH_AFTER <= r['at'] <= t1 + VCH_BEFORE]
            kf = w.key_frames(t0 - 5, t1 + 8, CHEAP_N, must)
            if len(kf) >= 4:
                return self.handle_cheap(w, at, t0, t1, kf, near, date, key)
        if not frames:
            return
        crops = [jpeg_b64(c, width=512, quality=70)[0] for c in frames]
        gap = max(0.5, round((t1 - t0) / max(1, len(frames) - 1), 1))
        khula = None
        try:
            ctx = context_text(near)
            res = ai_judge2(key, crops, ctx, gap, self.load_examples())
            fl, v, why, ms = res[:4]
            khula = res[4] if len(res) > 4 else None
            model = MODEL
            if v == 'shak':                          # v1.7: doosri raaye — dono shak kahein tabhi shak
                try:
                    v2, why2, ms2, m2 = ai_confirm(key, crops, ctx, gap, why)
                    ms, model = ms + ms2, (MODEL + '+' + m2)[:60]
                    if v2 != 'shak':
                        v, why = 'normal', ('Doosre AI ne dekha: ' + (why2 or 'shak wali baat saaf nahi') + ' (pehle: ' + why + ')')[:290]
                    else:
                        why = (why2 or why)[:290]
                except Exception as e2:
                    log('doosri raaye nahi:', e2)          # na chale to pehla faisla (shak) hi rahe — chhupaya nahi jata
            self.bump(w.cid, date, checks=1, shak=1 if v == 'shak' else 0)
        except Exception as e:
            fl, v, why, ms, model = 'saaf_nahi', 'error', f'AI nahi chala: {e}'[:280], 0, MODEL
            self.pause_until = time.time() + AI_PAUSE
        state, m = match(fl, t0, t1, near, self.pos_ok(), self.bk_ok(), self.vouchers(), khula)
        if v == 'error' and state == 'wait':
            state = 'nopos'                      # AI hi na chala ho to "entry nahi" ka alarm nahi
        self.bump(w.cid, date, moneyIn=1 if fl in ('aaya', 'len_den') else 0, moneyOut=1 if fl == 'nikla' else 0, matched=1 if state == 'ok' else 0)
        eid, t = f'{w.cid}-{int(at * 1000)}', int(at * 1000)
        self.fire.patch(f'{BIZ}/cameraFrames/{eid}', {'frames': crops, 'at': t, 'cam': w.cid})
        doc = {'cam': w.cid, 'camName': w.name, 'at': t, 'date': date, 'verdict': v, 'why': why, 'flow': fl, 'matchState': state,
               'start': int(t0 * 1000), 'end': int(t1 * 1000),
               'thumb': jpeg_b64(frames[len(frames) // 2], width=320, quality=60)[0], 'n': len(crops), 'ms': ms, 'model': model, 'agent': VERSION}
        if m:
            doc['match'] = match_doc(m)
            if m['kind'] == 'sale':
                self.by_bill[str(m['no'])] = eid
                if len(self.by_bill) > 500:
                    self.by_bill = dict(list(self.by_bill.items())[-300:])
        self.fire.patch(f'{BIZ}/cameraEvents/{eid}', doc)
        if state == 'wait':
            self.waiting.append({'eid': eid, 'cid': w.cid, 'date': date, 'flow': fl, 't0': t0, 't1': t1, 'made': time.time(), 'khula': khula, 'v': v})
        if v == 'shak' and self.clips:
            self.clips.shak(w.cid, eid, t0, t1, date)
        log('nigrani', w.cid, fl, v, state, why)
        when = time.strftime('%I:%M %p', time.gmtime(at + 5 * 3600)).lstrip('0').lower()
        label = {'normal': 'Normal', 'shak': 'Shak', 'saaf_nahi': 'Saaf nahi'}.get(v, '')
        self.fire.patch(f'{BIZ}/cameras/{w.cid}', {'aiTest': (f'AI chal raha hai — aakhri jaanch {when} ({label})' if v != 'error' else why)[:200], 'aiTestAt': t})

    def tender(self):
        return bool(self.pos and getattr(self.pos, 'tender_seen', False))

    def daily_video(self, w, t0, t1, date):
        """v1.9: roz DAILY_VIDEOS len-den bila tarteeb — malik ke liye, bina AI (cameraClips kind 'daily')."""
        import random
        k = (w.cid, date)
        n = self.daily.get(k, 0)
        if n >= DAILY_VIDEOS or not self.clips or random.random() > DAILY_VIDEOS / 220.0:
            return False
        self.daily[k] = n + 1
        self.clips.q.put({'id': f'{w.cid}-d-{int(t0 * 1000)}', 'cam': w.cid, 'kind': 'daily', 'eventId': '', 'from': int((t0 - 5) * 1000),
                          'to': int(min(t1 + 10, t0 - 5 + SHAK_MAX) * 1000), 'date': date, 'title': f'Aaj ki video {n + 1}'})
        return True

    def handle_cheap(self, w, at, t0, t1, kf, near, date, key):
        """v1.9: 'galle se paisa bahar kis ko?' — 8 chhoti tasveerein. nikla nahi -> kuch nahi. ✅ baqaya -> halka card.
        🔴 candidate -> (second on) bara AI ki kahani -> pakka -> shak + clip + khabar."""
        crvs = [r for r in near if r['kind'] == 'crv' and in_bill(r, t0, t1)]
        tnd = self.tender()
        mc = getattr(w, 'min_change', 0) or 0
        self.daily_video(w, t0, t1, date)
        if mc > 0 and crvs and all(r.get('change') is not None and 0 < r['change'] < mc for r in crvs):
            self.bump(w.cid, date, moneyIn=1, matched=1)               # chhota baqaya — AI nahi (malik ki setting)
            return
        ctx = context_text(near)
        gap = max(0.5, round((kf[-1][0] - kf[0][0]) / max(1, len(kf) - 1), 1))
        try:
            res, ms, model = ai_cheap(key, kf, ctx, gap)
            self.bump(w.cid, date, checks=1, cost=COST['last'])
        except Exception as e:
            self.pause_until = time.time() + AI_PAUSE
            log('sasta sawal nahi chala:', e)
            self.bump(w.cid, date, unchecked=1)
            return
        if not res['nikla'] or res['kis'] == 'haath':
            self.bump(w.cid, date, moneyIn=1, matched=1 if crvs else 0)
            return
        flags, lines = judge_cheap(res, crvs, tnd)
        m = min(crvs, key=lambda r: abs(r['at'] - (t0 + t1) / 2)) if crvs else None
        story, why2 = [], ''
        if flags and getattr(w, 'second', True):
            try:
                must = [r['at'] for r in crvs]
                kf2 = w.key_frames(t0 - STORY_PRE, t1 + STORY_POST, STORY_N, must)
                r2, ms2, m2 = ai_story(key, kf2, ctx, self.load_examples(), CONFIRM_MODELS)
                self.bump(w.cid, date, cost=COST['last'])
                ms, model = ms + ms2, (model + '+' + m2)[:60]
                f2, l2 = judge_story(r2, t0, t1, near, True, tnd)
                outs = [e for e in r2.get('story') or [] if e['kya'] in ('baqaya', 'diya', 'jeb')]
                if not f2 and (not outs or all(e['kya'] == 'baqaya' for e in outs)) and crvs:
                    flags, lines, why2 = [], [], 'Doosre AI ne dekha: ' + (r2.get('why') or 'baqaya usi customer ko') + ' (pehle: ' + res['why'] + ')'
                else:
                    flags = list(dict.fromkeys(flags + f2)); lines = lines + [x for x in l2 if x not in lines]
                    story, why2 = story_doc(r2, kf2), r2.get('why') or ''
                    kf = kf2
            except Exception as e2:
                log('doosri raaye (kahani) nahi:', e2)
        v = 'shak' if flags else 'normal'
        why = ((' · '.join(lines) + ' — ' + (why2 or res['why'])) if flags else (why2 or ('Baqaya usi customer ko — ' + res['why'])))[:290]
        eid, t = f'{w.cid}-{int(at * 1000)}', int(at * 1000)
        self.bump(w.cid, date, moneyOut=1, matched=1 if m else 0, shak=1 if v == 'shak' else 0)
        self.fire.patch(f'{BIZ}/cameraFrames/{eid}', {'frames': [b for _, b in kf], 'times': [int(x * 1000) for x, _ in kf], 'at': t, 'cam': w.cid})
        doc = {'cam': w.cid, 'camName': w.name, 'at': t, 'date': date, 'verdict': v, 'why': why, 'flow': 'nikla', 'matchState': 'ok' if m else ('missing' if 'novoucher' in flags else 'none'),
               'start': int(t0 * 1000), 'end': int(t1 * 1000), 'thumb': kf[len(kf) // 2][1], 'n': len(kf), 'ms': ms, 'model': model,
               'agent': VERSION, 'story': story, 'flags': flags[:8]}
        if m:
            doc['match'] = match_doc(m)
            if m.get('bill'):
                self.by_bill[str(m['bill'])] = eid
        self.fire.patch(f'{BIZ}/cameraEvents/{eid}', doc)
        if v == 'shak' and self.clips:
            self.clips.shak(w.cid, eid, t0, t1, date)
        log('sasta', w.cid, res['nikla'], res['kis'], v, flags)
        when = time.strftime('%I:%M %p', time.gmtime(at + 5 * 3600)).lstrip('0').lower()
        self.fire.patch(f'{BIZ}/cameras/{w.cid}', {'aiTest': f"AI chal raha hai — aakhri {when} ({'Shak' if v == 'shak' else 'Baqaya'})"[:200], 'aiTestAt': t})

    def handle_story(self, w, at, t0, t1, kf, near, date, key):
        """v1.8: kahani -> POS se milaan -> lal nishan (flags). Mushkil len-den bara AI dobara likhta hai (aakhri wahi)."""
        ctx, ex, vch, tnd = context_text(near), self.load_examples(), self.vouchers(), self.tender()
        crvs = [r for r in near if r['kind'] == 'crv' and in_bill(r, t0, t1)]
        try:
            res, ms, model = ai_story(key, kf, ctx, ex, (MODEL,))
            flags, lines = judge_story(res, t0, t1, near, vch, tnd)
            if flags or res['verdict'] == 'shak' or res['log'] >= 2 or len(crvs) >= 2:
                try:
                    res2, ms2, m2 = ai_story(key, kf, ctx, ex, CONFIRM_MODELS)
                    res, ms, model = res2, ms + ms2, (MODEL + '+' + m2)[:60]
                    flags, lines = judge_story(res, t0, t1, near, vch, tnd)
                except Exception as e2:
                    log('bara AI (kahani) nahi:', e2)          # pehli kahani hi rahe — lal nishan chhupaye nahi jate
            v = 'shak' if flags else (res['verdict'] if res['verdict'] in ('normal', 'saaf_nahi') else 'normal')
            why = (' · '.join(lines) + ' — ' + res['why']) if flags else res['why']
            fl, khula = res['flow'], res['khula']
            self.bump(w.cid, date, checks=1, shak=1 if v == 'shak' else 0)
        except Exception as e:
            res, flags, v, why, fl, khula, ms, model = {'story': []}, [], 'error', f'AI nahi chala: {e}'[:280], 'saaf_nahi', None, 0, MODEL
            self.pause_until = time.time() + AI_PAUSE
        state, m = match(fl, t0, t1, near, self.pos_ok(), self.bk_ok(), vch, khula)
        if v == 'error' and state == 'wait':
            state = 'nopos'
        self.bump(w.cid, date, moneyIn=1 if fl in ('aaya', 'len_den') else 0, moneyOut=1 if fl == 'nikla' else 0, matched=1 if state == 'ok' else 0)
        eid, t = f'{w.cid}-{int(at * 1000)}', int(at * 1000)
        self.fire.patch(f'{BIZ}/cameraFrames/{eid}', {'frames': [b for _, b in kf], 'times': [int(x * 1000) for x, _ in kf], 'at': t, 'cam': w.cid})
        doc = {'cam': w.cid, 'camName': w.name, 'at': t, 'date': date, 'verdict': v, 'why': str(why)[:290], 'flow': fl, 'matchState': state,
               'start': int(t0 * 1000), 'end': int(t1 * 1000), 'thumb': kf[len(kf) // 2][1], 'n': len(kf), 'ms': ms, 'model': model,
               'agent': VERSION, 'story': story_doc(res, kf), 'flags': flags[:8]}
        if m:
            doc['match'] = match_doc(m)
            bill = m.get('bill') if m['kind'] == 'crv' else (m['no'] if m['kind'] == 'sale' else None)
            if bill:
                self.by_bill[str(bill)] = eid
                if len(self.by_bill) > 500:
                    self.by_bill = dict(list(self.by_bill.items())[-300:])
        self.fire.patch(f'{BIZ}/cameraEvents/{eid}', doc)
        if state == 'wait':
            self.waiting.append({'eid': eid, 'cid': w.cid, 'date': date, 'flow': fl, 't0': t0, 't1': t1, 'made': time.time(), 'khula': khula, 'v': v})
        if v == 'shak' and self.clips:
            self.clips.shak(w.cid, eid, t0, t1, date)
        log('kahani', w.cid, fl, v, state, flags, why)
        when = time.strftime('%I:%M %p', time.gmtime(at + 5 * 3600)).lstrip('0').lower()
        label = {'normal': 'Normal', 'shak': 'Shak', 'saaf_nahi': 'Saaf nahi'}.get(v, '')
        self.fire.patch(f'{BIZ}/cameras/{w.cid}', {'aiTest': (f'AI chal raha hai — aakhri kahani {when} ({label})' if v != 'error' else why)[:200], 'aiTestAt': t})

    def vouchers(self):
        """v1.6: POS mein voucher ka khana mil gaya -> galla sirf voucher par; warna bill ke waqt se (purana tareeqa)."""
        return bool(self.pos and getattr(self.pos, 'vch_ok', lambda: False)())

    def recheck(self):
        """'wait' wale: voucher / entry der se aaye to 'ok'; 2 minute baad bhi na aaye to 'missing' = bina voucher galla khula
        (function khabar deta hai) + clip."""
        keep = []
        for e in self.waiting:
            state, m = match(e['flow'], e['t0'], e['t1'], self.recs(e['t0'] - 180, e['t1'] + 400), self.pos_ok(), self.bk_ok(), self.vouchers(), e.get('khula'))
            if state == 'ok':
                self.fire.patch(f"{BIZ}/cameraEvents/{e['eid']}", {'matchState': 'ok', 'match': match_doc(m), 'matchAt': now_ms()})
                if m['kind'] == 'sale':
                    self.by_bill[str(m['no'])] = e['eid']
                self.bump(e['cid'], e['date'], matched=1)
            elif state == 'nopos':
                self.fire.patch(f"{BIZ}/cameraEvents/{e['eid']}", {'matchState': 'nopos', 'matchAt': now_ms()})
            elif time.time() - e['made'] > self.MISSING_AFTER:
                self.fire.patch(f"{BIZ}/cameraEvents/{e['eid']}", {'matchState': 'missing', 'matchAt': now_ms()})
                self.bump(e['cid'], e['date'], missing=1)
                if self.clips and e.get('v') != 'shak':          # v1.6: bina voucher galla khula -> clip bhi (shak par pehle ban chuki)
                    self.clips.shak(e['cid'], e['eid'], e['t0'], e['t1'], e['date'])
            else:
                keep.append(e)
        self.waiting = keep

    def flush(self):
        with self.lock:
            keys, self.dirty = list(self.dirty), set()
            rows = [dict(self.stats[k]) for k in keys]
        for row in rows:
            row['at'] = now_ms()
            self.fire.patch(f"{BIZ}/cameraStats/{row['cam']}_{row['date']}", row)
        today = pk_date()
        for k in [k for k in self.stats if k[1] < today and k not in self.dirty]:
            self.stats.pop(k, None)


# ---------------------------------------------------------------- v1.4 RECORDING + CLIPS
REC_DIR = os.path.join(HOME, 'rec')
REC_HOURS, REC_FPS, REC_W, SEG_SEC, MIN_FREE_GB = 48, 8, 640, 60, 5
CLIP_MAX, SHAK_PAD, PART_CHARS = 180, 5, 700_000
SHAK_BEFORE, SHAK_AFTER, SHAK_MAX = 10, 20, 40    # v1.6: shak / bina voucher par clip — 10 s pehle se 20 s baad tak (40 s had)


def ffmpeg_exe():
    """ffmpeg: NTCAM_FFMPEG env, ya C:\\NTCam\\ffmpeg.exe (haath se rakha ho), warna imageio-ffmpeg (khud install)."""
    if os.environ.get('NTCAM_FFMPEG'):
        return os.environ['NTCAM_FFMPEG']
    local = os.path.join(HOME, 'ffmpeg.exe')
    if os.path.exists(local):
        return local
    return need('imageio_ffmpeg', 'imageio-ffmpeg').get_ffmpeg_exe()


def free_gb(path):
    try:
        import shutil
        return shutil.disk_usage(path).free / 1e9
    except Exception:
        return 999


def seg_files(d):
    """[(start_epoch, path)] purane se naye."""
    out = []
    try:
        for n in os.listdir(d):
            if n.endswith('.ts') and n[:-3].isdigit():
                out.append((int(n[:-3]), os.path.join(d, n)))
    except OSError:
        pass
    return sorted(out)


def prune(d, hours=REC_HOURS, min_free=MIN_FREE_GB):
    """48 ghante se purani, aur disk 5 GB se kam ho to sab se purani — jab tak jagah na bane."""
    segs, cut = seg_files(d), time.time() - hours * 3600
    gone = []
    for st, pth in segs:
        if st < cut or free_gb(d) < min_free:
            try:
                os.remove(pth)
                gone.append(pth)
            except OSError:
                pass
        else:
            break
    return gone


def pick_segs(segs, t0, t1, seg=SEG_SEC):
    return [(st, p) for st, p in segs if st <= t1 and st + seg >= t0]


def clip_cmd(exe, segs, t0, t1, out):
    """Concat list + ffmpeg command (chhoti clip = dobara encode, saaf shuru; 640 px, 8 fps)."""
    lst = out + '.txt'
    with open(lst, 'w', encoding='utf-8') as f:
        for _, p in segs:
            f.write("file '" + p.replace("'", "'\\''") + "'\n")
    off = max(0.0, t0 - segs[0][0])
    return [exe, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-ss', f'{off:.2f}', '-t', f'{max(1.0, t1 - t0):.2f}',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '29', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out]


class Recorder(threading.Thread):
    """Watch ke taaza frame ko har 1/8 s ffmpeg ko do -> 60 s ke .ts tukre (naam = shuru ka epoch). Sirf disk par, 2 din."""
    def __init__(self, cid, watch):
        super().__init__(daemon=True)
        self.cid, self.watch, self.alive, self.dir = cid, watch, True, os.path.join(REC_DIR, cid)
        self.err, self.last_seg = '', 0
        os.makedirs(self.dir, exist_ok=True)

    def stop(self):
        self.alive = False

    def run(self):
        import cv2
        try:
            exe = ffmpeg_exe()
        except Exception as e:
            self.err = f'ffmpeg nahi: {e}'
            log('recording:', self.err)
            return
        while self.alive:
            f = self.watch.latest
            if f is None or time.time() - self.watch.latest_at > 10:
                time.sleep(1)
                continue
            h, w = f.shape[:2]
            W, H = REC_W, max(2, int(h * REC_W / w) // 2 * 2)
            start = int(time.time())
            path = os.path.join(self.dir, f'{start}.ts')
            cmd = [exe, '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(REC_FPS), '-i', '-',
                   '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', '-g', str(REC_FPS * 2), '-f', 'mpegts', path]
            try:
                p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=NO_WINDOW)
            except Exception as e:
                self.err = f'ffmpeg shuru nahi: {e}'
                log('recording:', self.err)
                time.sleep(30)
                continue
            self.last_seg, tick, n = start, start, 0
            try:
                while self.alive and time.time() - start < SEG_SEC:
                    tick += 1.0 / REC_FPS
                    d = tick - time.time()
                    if d > 0:
                        time.sleep(d)
                    fr = self.watch.latest
                    if fr is None:
                        continue
                    if fr.shape[1] != W or fr.shape[0] != H:
                        fr = cv2.resize(fr, (W, H), interpolation=cv2.INTER_AREA)
                    p.stdin.write(fr.tobytes())
                    n += 1
                self.err = ''
            except Exception as e:
                self.err = f'recording ruk gayi: {e}'
                log('recording:', self.err)
            finally:
                try:
                    p.stdin.close()
                    p.wait(timeout=15)
                except Exception:
                    p.kill()
            prune(self.dir)

    def clip(self, t0, t1, out):
        """Disk ki recording se [t0, t1] ki mp4. Wapas: path ya None."""
        t1 = min(t1, t0 + CLIP_MAX)
        segs = pick_segs(seg_files(self.dir), t0, t1)
        if not segs:
            return None
        cmd = clip_cmd(ffmpeg_exe(), segs, t0, t1, out)
        r = subprocess.run(cmd, capture_output=True, timeout=300, creationflags=NO_WINDOW)
        if r.returncode != 0 or not os.path.exists(out) or os.path.getsize(out) < 1000:
            log('clip nahi bani:', r.stderr[-200:])
            return None
        return out


def upload_clip(fire, clip_id, path, meta):
    """mp4 -> base64 tukre (700k harf) cameraClipParts/<id>_<i>, phir cameraClips/<id> status ok."""
    with open(path, 'rb') as f:
        b = base64.b64encode(f.read()).decode('ascii')
    parts = [b[i:i + PART_CHARS] for i in range(0, len(b), PART_CHARS)]
    for i, part in enumerate(parts):
        fire.patch(f'{BIZ}/cameraClipParts/{clip_id}_{i}', {'clip': clip_id, 'i': i, 'data': part})
    fire.patch(f'{BIZ}/cameraClips/{clip_id}', {**meta, 'status': 'ok', 'n': len(parts), 'size': os.path.getsize(path), 'at': now_ms(), 'error': ''})
    try:
        os.remove(path)
    except OSError:
        pass
    return len(parts)


class Clips(threading.Thread):
    """Shak par khud clip; malik ki farmaish (cameraClips status 'req') har 20 s dekh kar clip bana kar app mein."""
    def __init__(self, fire, recorders):
        super().__init__(daemon=True)
        self.fire, self.recorders, self.q = fire, recorders, queue.Queue()

    def shak(self, cid, eid, t0, t1, date):
        self.q.put({'id': eid, 'cam': cid, 'kind': 'shak', 'eventId': eid, 'from': int((t0 - SHAK_BEFORE) * 1000), 'to': int(min(t1 + SHAK_AFTER, t0 - SHAK_BEFORE + SHAK_MAX) * 1000), 'date': date})

    def run(self):
        last = 0
        while True:
            try:
                job = self.q.get(timeout=5)
                self.make(job)
            except queue.Empty:
                pass
            except Exception as e:
                log('clip ghalti:', e)
            if time.time() - last > 20:
                last = time.time()
                try:
                    for r in self.fire.query('cameraClips', 'status', 'EQUAL', 'req', 10):
                        self.make({'id': r['id'], 'cam': r.get('cam', ''), 'kind': 'req', 'eventId': r.get('eventId', ''), 'from': int(r.get('from') or 0),
                                   'to': int(r.get('to') or 0), 'date': r.get('date') or pk_date()})
                except Exception as e:
                    log('clip farmaish:', e)

    def make(self, job):
        cid, rec = job['cam'], self.recorders.get(job['cam'])
        base = {'cam': cid, 'kind': job['kind'], 'eventId': job.get('eventId', ''), 'from': job['from'], 'to': job['to'], 'date': job['date']}
        if not rec:
            self.fire.patch(f"{BIZ}/cameraClips/{job['id']}", {**base, 'status': 'error', 'error': 'Is camera ki recording nahi (galla nigrani band ya PC band tha)', 'at': now_ms()})
            return
        self.fire.patch(f"{BIZ}/cameraClips/{job['id']}", {**base, 'status': 'making', 'at': now_ms()})
        t0, t1 = job['from'] / 1000, job['to'] / 1000
        if t1 - t0 > CLIP_MAX:
            t1 = t0 + CLIP_MAX
        out = os.path.join(HOME, f"clip_{job['id']}.mp4")
        path = rec.clip(t0, t1, out)
        if not path:
            self.fire.patch(f"{BIZ}/cameraClips/{job['id']}", {**base, 'status': 'error', 'error': 'Us waqt ki recording PC par nahi mili (PC band tha ya 2 din se purani)', 'at': now_ms()})
            return
        n = upload_clip(self.fire, job['id'], path, base)
        log('clip', job['id'], n, 'parts')


def watch_wanted(c, s):
    return bool(s) and c.get('enabled') is not False and c.get('role') == 'galla' and bool((c.get('zone') or {}).get('w'))


# ---------------------------------------------------------------- setup (desktop icon "NT Camera jodein")
def setup():
    say('=' * 58)
    say(f'  NT CAMERA  v{VERSION}  —  dukaan ke camera jodein')
    say('=' * 58)
    sec = secrets()
    fire = connect(sec, ask=True)
    say('  [OK] Firebase se jud gaya.')
    if not sec.get('claudeKey'):
        say('\nClaude API key (sk-ant-...) — PC par Gmail/WhatsApp Web se copy kar ke yahan RIGHT-CLICK se paste karein.')
        k = clean_key(secret_input('API key (baad mein dena ho to sirf Enter): '))
        if k.startswith('sk-ant-'):
            sec['claudeKey'] = k
            save_json(SECRETS, sec)
            say('  [OK] API key is PC mein mehfooz.')
        elif k.startswith('apikey_'):
            say('  [!!] Ye key ki ID hai, asal key nahi. Console > API keys > "Create Key" par jo lambi sk-ant-api03-... aik dafa dikhti hai, wo copy karein.')
        elif k:
            say('  [!!] Ye Claude ki key nahi lagti (sk-ant- se shuru hoti hai). Baad mein dobara chalayein.')
    for _ in range(3):                                   # v1.1.1: na chale to wahin nayi key (3 dafa tak)
        if not sec.get('claudeKey'):
            break
        ok, msg, code = check_key(sec['claudeKey'])
        say(('  [OK] ' if ok else '  [!!] ') + msg)
        if ok or code not in (400, 401, 403):
            break
        if input('   Nayi key daalein? (h = haan, Enter = baad mein): ').strip().lower() not in ('h', 'haan', 'y', 'yes'):
            break
        k = clean_key(secret_input('   Claude API key (right-click se paste): '))
        if not k.startswith('sk-ant-'):
            say('  [!!] Ye Claude ki key nahi (sk-ant-api03-... honi chahiye). Console > API keys > Create Key.')
            break
        sec['claudeKey'] = k
        save_json(SECRETS, sec)
    say('\nNetwork par camera dhoond rahe hain... (10-20 second)')
    found = scan()
    try:
        existing = dict(fire.list('cameras'))
    except Exception as e:
        existing = {}
        say(f'  [!!] Cameras ki list nahi aayi ({e}). Firebase rules (Hissa A) publish kiye? Phir bhi aage chalte hain.')
    try:
        put_status(fire, cams=len(existing), found=found)
    except Exception as e:
        say(f'  [!!] PC ki halat Firebase par nahi gayi: {e}')
    if not found:
        say('  [!!] Koi camera nahi mila. Camera ON ho aur PC usi WiFi/router par ho. Privacy mode band ho.')
    added = 0
    for i, dev in enumerate(found, 1):
        same = [c for cid, c in existing.items() if (dev['mac'] and c.get('mac') == dev['mac']) or c.get('ip') == dev['ip']]
        say(f"\n{i}) {dev['ip']}  ·  {BRAND_TEXT.get(dev['brand'], 'Camera')}" + (f"  —  pehle se juda: {', '.join(c.get('name', '?') for c in same)}" if same else ''))
        if same and all(cid in sec['cams'] for cid, c in existing.items() if c in same):
            if input('   Dobara jodna hai? (h = haan, Enter = chhor dein): ').strip().lower() not in ('h', 'haan', 'y', 'yes'):
                continue
        name = input('   Is camera ka naam (misal: Galla, Counter) — chhorna ho to sirf Enter: ').strip()[:40]
        if not name:
            continue
        user = input('   Username [admin]: ').strip() or 'admin'
        pw = secret_input('   Camera ka password (DMSS app > Device Info > aankh wala nishan): ')
        n = input('   Is device par kitne camera? (aam camera = 1, NVR/DVR = jitne channel) [1]: ').strip() or '1'
        n = max(1, min(16, int(n))) if n.isdigit() else 1
        for ch in range(1, n + 1):
            cam_name = name if n == 1 else f'{name} {ch}'
            say(f'   "{cam_name}" — video le rahe hain...')
            url, frame = None, None
            for u in rtsp_urls(dev['brand'], dev['ip'], user, pw, ch):
                frame = grab(u)
                if frame is not None:
                    url = u
                    break
            if frame is None:
                say('   [!!] Video nahi mili. Password check karein; camera ON ho aur privacy mode band ho.')
                continue
            cid = (dev['mac'] or dev['ip'].replace('.', '-')) + f'-ch{ch}'
            sec['cams'][cid] = {'url': url, 'user': user, 'pw': pw, 'ip': dev['ip'], 'brand': dev['brand'], 'ch': ch, 'mac': dev['mac']}
            save_json(SECRETS, sec)
            try:
                if cid not in existing:
                    fire.patch(f'{BIZ}/cameras/{cid}', {'name': cam_name, 'ip': dev['ip'], 'mac': dev['mac'], 'brand': dev['brand'], 'channel': ch,
                                                         'role': 'view', 'enabled': True, 'createdAt': now_ms(), 'status': 'online', 'agent': VERSION})
                b64 = put_shot(fire, cid, frame)
                added += 1
                say(f'   [OK] "{cam_name}" jud gaya — tasveer app mein pohanch gayi.')
            except Exception as e:
                say(f'   [!!] Camera juda lekin app tak nahi pohancha: {e}')
                continue
            if sec.get('claudeKey'):
                try:
                    d = ai_describe(sec['claudeKey'], b64)
                    say(f'   [AI] {d}')
                    fire.patch(f'{BIZ}/cameras/{cid}', {'aiTest': d, 'aiTestAt': now_ms()})
                except Exception as e:
                    say(f'   [!!] AI test: {e}')
                    try:
                        fire.patch(f'{BIZ}/cameras/{cid}', {'aiTest': 'AI nahi chala: ' + str(e)[:120], 'aiTestAt': now_ms()})
                    except Exception:
                        pass
    say('\n' + '-' * 58)
    say(f'  {added} camera jode gaye. Ab program peeche chalta rahega — PC on hote hi khud shuru.')
    say('  Phone par: hazri app > Settings > Cameras')
    say('-' * 58)
    try:
        input('\nBand karne ke liye Enter dabayein...')
    except EOFError:
        pass


# ---------------------------------------------------------------- test (kuch nahi badalta)
def test():
    sec = secrets()
    say(f'NT Camera v{VERSION} · Python {sys.version.split()[0]} · {HOME}')
    try:
        import cv2
        say(f'  [OK] OpenCV {cv2.__version__}')
    except Exception as e:
        say(f'  [!!] OpenCV nahi: {e}')
    try:
        fire = connect(sec, ask=False)
        say(f'  [OK] Firebase login ({fire.email})')
        for cid, c in fire.list('cameras'):
            s = sec['cams'].get(cid)
            f = grab(s['url']) if s else None
            say(f"  {'[OK]' if f is not None else '[!!]'} {c.get('name', cid)} · {c.get('ip', '')} · " + ('video mil rahi hai' if f is not None else ('password is PC mein nahi' if not s else 'video nahi mili')))
    except Exception as e:
        say(f'  [!!] {e}')


# ---------------------------------------------------------------- run (peeche, PC on hote hi)
def take_lock():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    for _ in range(20):
        try:
            s.bind(('127.0.0.1', LOCK_PORT))
            return s
        except OSError:
            time.sleep(0.5)
    return None


def newer(a, b):
    t = lambda v: tuple(int(x) for x in re.findall(r'\d+', v or '0'))
    return t(a) > t(b)


def self_update(lock):
    """GitHub par naya ntcam.py ho to khud badlo aur dobara shuru — PC par kuch type na karna pade."""
    import requests
    src = requests.get(base_url() + 'ntcam.py', params={'t': now_ms()}, timeout=30).text
    m = re.search(r"^VERSION = '([^']+)'", src, re.M)
    if not m or not newer(m.group(1), VERSION):
        return False
    compile(src, 'ntcam.py', 'exec')           # toota hua file kabhi na lagao
    me = os.path.abspath(__file__)
    with open(me + '.new', 'w', encoding='utf-8') as f:
        f.write(src)
    os.replace(me + '.new', me)
    log(f'naya program {m.group(1)} — dobara shuru')
    lock.close()
    subprocess.Popen([sys.executable, me, 'run'], cwd=HOME, creationflags=0x08000000 if os.name == 'nt' else 0)
    sys.exit(0)


def heartbeat():
    try:
        with open(HB_FILE, 'w') as f:
            f.write(str(int(time.time())))
    except OSError:
        pass


def guard():
    """v1.9.1: chup-chaap band hone ke khilaf — native crash crash.log mein, thread ki ghalti ntcam.log mein."""
    try:
        import faulthandler
        fh = open(CRASH_FILE, 'a', buffering=1)
        fh.write(f'\n== {time.strftime("%Y-%m-%d %H:%M:%S")} shuru v{VERSION} pid {os.getpid()}\n')
        faulthandler.enable(fh, all_threads=True)
    except Exception as e:
        log('faulthandler nahi:', e)
    try:
        def hook(args):
            log('thread ghalti:', getattr(args.thread, 'name', '?'), args.exc_value, ''.join(traceback.format_tb(args.exc_traceback))[-400:])
        threading.excepthook = hook
    except Exception:
        pass


def run():
    lock = take_lock()
    if not lock:
        log('pehle se chal raha hai — band')
        return
    guard()
    heartbeat()
    log(f'shuru v{VERSION}')
    sec, fire, wait = secrets(), None, 5
    while fire is None:                         # PC on hua, net der se aaye — intezar
        try:
            fire = connect(sec, ask=False)
        except AuthError as e:
            log('login nahi:', e)
            time.sleep(300)
        except Exception as e:
            log('net nahi:', e)
            time.sleep(wait)
            wait = min(120, wait * 2)
    cams, shot_at, asked, state, watchers, recorders = {}, {}, {}, {}, {}, {}
    pos = Pos(fire)                                # v1.2: POS + Galla screen (sirf parhna); v1.3: bill badla / cancel
    galla = Galla(fire, pos)
    pos.galla = galla
    clips = Clips(fire, recorders)                 # v1.4
    galla.clips = clips
    pos.start()
    galla.start()
    clips.start()
    last_list = last_status = 0
    last_update = time.time() - UPDATE_EVERY + 120   # shuru ke 2 minute baad pehli jaanch
    last_scan = 0
    key_note = False                               # v1.1.2: shuru mein aik dafa AI ki halat cards par
    while True:
        heartbeat()
        try:
            t = time.time()
            if t - last_list > LIST_EVERY:
                cams = dict(fire.list('cameras'))
                last_list = t
                sec = secrets()                # setup ne naya camera joda ho
                if not key_note and cams:
                    key_note = True
                    if sec.get('claudeKey'):
                        ok, msg, _ = check_key(sec['claudeKey'])
                        note = 'AI tayyar — Claude key chal rahi hai' if ok else 'AI nahi chala: ' + msg
                    else:
                        note = 'AI nahi chala: PC mein Claude key nahi — "NT Camera jodein" chala kar daalein'
                    for cid in cams:
                        try:
                            fire.patch(f'{BIZ}/cameras/{cid}', {'aiTest': note[:200], 'aiTestAt': now_ms()})
                        except Exception as e:
                            log('ai note nahi:', e)
                # v1.1: galla nigrani — kaam 'galla' + dabba mark + chalu = video lagatar
                for cid, c in cams.items():
                    s = sec['cams'].get(cid)
                    if watch_wanted(c, s):
                        if cid not in watchers or not watchers[cid].is_alive():
                            watchers[cid] = Watch(cid, s['url'], c, galla.q)
                            watchers[cid].start()
                            log('nigrani shuru', cid)
                        if cid not in recorders or not recorders[cid].is_alive():
                            recorders[cid] = Recorder(cid, watchers[cid])
                            recorders[cid].start()
                            log('recording shuru', cid)
                        else:
                            watchers[cid].apply(c)
                for cid in [k for k in watchers if not watch_wanted(cams.get(k, {}), sec['cams'].get(k))]:
                    watchers.pop(cid).stop()
                    if cid in recorders:
                        recorders.pop(cid).stop()
                    fire.patch(f'{BIZ}/cameras/{cid}', {'watch': 'off', 'seenAt': now_ms()})
                    log('nigrani band', cid)
            online = 0
            for cid, c in cams.items():
                s = sec['cams'].get(cid)
                if c.get('enabled') is False:
                    if state.get(cid) != 'off':
                        fire.patch(f'{BIZ}/cameras/{cid}', {'status': 'off', 'seenAt': now_ms()})
                        state[cid] = 'off'
                    continue
                if not s:
                    if state.get(cid) != 'nopass':
                        fire.patch(f'{BIZ}/cameras/{cid}', {'status': 'offline', 'lastError': 'Is PC mein password nahi — PC par "NT Camera jodein" chalayein', 'seenAt': now_ms()})
                        state[cid] = 'nopass'
                    continue
                req = int(c.get('snapReq') or 0)
                due = t - shot_at.get(cid, 0) > SHOT_EVERY or (req > int(c.get('lastShotAt') or 0) and req > asked.get(cid, 0))
                if due:
                    asked[cid] = max(req, asked.get(cid, 0))
                    wt = watchers.get(cid)
                    frame = wt.latest.copy() if wt and wt.latest is not None and t - wt.latest_at < 10 else grab(s['url'])
                    shot_at[cid] = t
                    if frame is not None:
                        put_shot(fire, cid, frame)
                        state[cid] = 'online'
                    else:
                        if state.get(cid) != 'offline':
                            fire.patch(f'{BIZ}/cameras/{cid}', {'status': 'offline', 'lastError': 'Video nahi mili — camera band, WiFi se hata, ya privacy mode', 'seenAt': now_ms()})
                            state[cid] = 'offline'
                        if s.get('mac') and t - last_scan > 900:      # IP badal gayi ho (router ne nayi di)
                            last_scan = t
                            for d in scan():
                                if d['mac'] == s['mac'] and d['ip'] != s['ip']:
                                    s['url'] = s['url'].replace('@' + s['ip'] + ':', '@' + d['ip'] + ':')
                                    s['ip'] = d['ip']
                                    save_json(SECRETS, sec)
                                    fire.patch(f'{BIZ}/cameras/{cid}', {'ip': d['ip'], 'seenAt': now_ms()})
                                    log('nayi IP', cid, d['ip'])
                if state.get(cid) == 'online':
                    online += 1
            if t - last_status > STATUS_EVERY:
                put_status(fire, cams=len(cams), online=online, pos=pos.status())
                for cid, wt in watchers.items():
                    rc = recorders.get(cid)
                    fire.patch(f'{BIZ}/cameras/{cid}', {'watch': 'on' if wt.latest_at and t - wt.latest_at < 30 else 'down', 'fps': round(wt.fps, 1),
                                                         'stream': wt.stream, 'lastMotionAt': int(wt.last_motion * 1000), 'seenAt': now_ms(),
                                                         'rec': ('on' if rc and rc.is_alive() and t - rc.last_seg < 180 and not rc.err else (rc.err if rc and rc.err else 'off'))[:120],
                                                         'recFree': round(free_gb(HOME), 1)})
                galla.flush()
                last_status = t
            if t - last_update > UPDATE_EVERY:
                last_update = t
                try:
                    self_update(lock)
                except SystemExit:
                    raise
                except Exception as e:
                    log('update nahi:', e)
        except SystemExit:
            raise
        except Exception as e:
            log('ghalti:', e, traceback.format_exc()[-400:])
            time.sleep(15)
        heartbeat()
        time.sleep(5)


if __name__ == '__main__':
    os.makedirs(HOME, exist_ok=True)
    cmd = (sys.argv[1:] or ['setup'])[0]
    try:
        {'setup': setup, 'run': run, 'test': test}.get(cmd, setup)()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        log('band:', e, traceback.format_exc()[-600:])
        say(f'\n[!!] Ghalti: {e}\nNT Camera folder mein ntcam.log ka screenshot bhejein.')
        if cmd == 'setup':
            try:
                input('Enter dabayein...')
            except EOFError:
                pass
