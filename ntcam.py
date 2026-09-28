# ntcam.py — Noor Traders Hazri: dukaan ke CAMERAS (shop PC par chalta hai). Hissa A.
# v1.1 (Hissa B): GALLA NIGRANI — 'galla' kaam wale camera ki video lagatar, malik ke mark kiye dabbe mein harkat par
# 6 tasveerein (1.5 s pehle + 1.5 s baad), Claude se Normal / Shak, cameraEvents + cameraFrames + cameraStats. Password par ****.
# Kaam: network par camera dhoondna, password se jodna (password SIRF is PC mein), har 5 minute (ya malik ke kehne par) tasveer
# lena aur hazri app (Settings > Cameras) ko bhejna, online/offline batana. Hissa B mein isi mein galla nigrani judegi.
#   setup  = jodna / naya camera (desktop icon "NT Camera jodein")      run = peeche chalna (PC on hote hi, Startup)
#   test   = sirf jaanch (kuch nahi badalta)
# Firebase: apna alag login (PC code) — rules isay sirf cameras / cameraShots / cameraPC/status likhne dete hain.
VERSION = '1.1'

import base64, collections, getpass, ipaddress, json, os, queue, re, socket, subprocess, sys, threading, time, traceback, urllib.parse
from concurrent.futures import ThreadPoolExecutor

HOME = os.environ.get('NTCAM_HOME') or (r'C:\NTCam' if os.name == 'nt' else os.path.join(os.path.expanduser('~'), 'ntcam'))
SECRETS = os.path.join(HOME, 'secrets.json')
LOGF = os.path.join(HOME, 'ntcam.log')
BASEF = os.path.join(HOME, 'base.txt')
DEFAULT_BASE = 'https://samiullah-878.github.io/nt-traders-/'
BIZ = 'businesses/noor-traders'
MODEL = 'claude-haiku-4-5-20251001'
SHOT_EVERY = 300          # har 5 minute aik tasveer (app ke liye)
LIST_EVERY = 20           # cameras ki list / "nayi tasveer" ki farmaish har 20 second
STATUS_EVERY = 120        # PC zinda hai — har 2 minute
UPDATE_EVERY = 6 * 3600   # naya program (GitHub se) har 6 ghante
LOCK_PORT = 47391
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


def secrets():
    s = load_json(SECRETS, {})
    s.setdefault('cams', {})
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
                      headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    if r.status_code == 401:
        raise RuntimeError('API key ghalat hai')
    if r.status_code == 400 and 'credit' in r.text.lower():
        raise RuntimeError('API mein credit nahi — console mein credit daalein')
    if r.status_code != 200:
        raise RuntimeError(f'AI {r.status_code}: {r.text[:160]}')
    return ' '.join(b.get('text', '') for b in r.json().get('content', []) if b.get('type') == 'text').strip()[:300]


def check_key(key):
    """Chhota sa sawaal (taqreeban muft) — key aur credit theek hain ya nahi."""
    import requests
    try:
        r = requests.post('https://api.anthropic.com/v1/messages', timeout=40,
                          headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                          json={'model': MODEL, 'max_tokens': 5, 'messages': [{'role': 'user', 'content': 'ok'}]})
    except Exception as e:
        return False, f'Claude tak internet nahi pohancha: {e}'
    if r.status_code == 200:
        return True, 'Claude key chal rahi hai (AI tayyar).'
    if r.status_code == 401:
        return False, 'Claude key ghalat hai — nayi key daalein.'
    if 'credit' in r.text.lower():
        return False, 'Claude mein credit nahi — console mein credit daalein.'
    return False, f'Claude ne jawab nahi diya ({r.status_code}).'


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
                      headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                      json={'model': MODEL, 'max_tokens': 200, 'messages': [{'role': 'user', 'content': content}]})
    if r.status_code != 200:
        raise RuntimeError('credit nahi' if 'credit' in r.text.lower() else ('key ghalat' if r.status_code == 401 else f'AI {r.status_code}'))
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


def put_status(fire, cams=0, online=0, found=None, error=''):
    data = {'at': now_ms(), 'v': VERSION, 'host': socket.gethostname()[:40], 'cams': cams, 'online': online, 'error': str(error)[:200],
            'python': sys.version.split()[0]}
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
        self.motion, self.ring, self.pending = Motion(), collections.deque(maxlen=10), None
        self.latest, self.latest_at, self.fps, self.last_motion, self.last_trigger, self.stream = None, 0, 0.0, 0, 0, 'main'
        self.apply(cam)

    def apply(self, cam):
        self.name = str(cam.get('name') or self.cid)[:40]
        self.zone = cam.get('zone') or {}
        self.sens = cam.get('sens') or 'mid'
        self.cap_day = int(cam.get('aiCap') or 300)
        self.motion.set(self.sens)

    def stop(self):
        self.alive = False

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
                    if self.pending and now >= self.pending['until']:
                        frames = pick([c for t, c in self.ring if t >= self.pending['from']])
                        try:
                            self.jobs.put_nowait((self, self.pending['at'], frames))
                        except queue.Full:
                            pass
                        self.pending = None
                    if moved:
                        self.last_motion = now
                        if now - self.last_trigger > 3 and not self.pending:
                            self.last_trigger = now
                            self.pending = {'at': now, 'from': now - 1.6, 'until': now + 1.6}
            finally:
                cap.release()


class Galla(threading.Thread):
    """Harkat ki qataar: ginti (cameraStats), waqfa (COOLDOWN) aur roz ki had ke andar Claude se jaanch, phir
    cameraFrames (6 tasveer) + cameraEvents (chhoti thumb + faisla). Event bante hi Cloud Function 'shak' par malik ko khabar."""
    def __init__(self, fire):
        super().__init__(daemon=True)
        self.fire, self.q, self.stats, self.dirty = fire, queue.Queue(maxsize=20), {}, set()
        self.last_ai, self.pause_until, self.lock = {}, 0, threading.Lock()

    def stat(self, cid, date):
        k = (cid, date)
        if k not in self.stats:
            try:
                old = self.fire.get(f'{BIZ}/cameraStats/{cid}_{date}') or {}
            except Exception:
                old = {}
            self.stats[k] = {'cam': cid, 'date': date, 'touches': int(old.get('touches') or 0), 'checks': int(old.get('checks') or 0),
                             'shak': int(old.get('shak') or 0), 'unchecked': int(old.get('unchecked') or 0)}
        return self.stats[k]

    def run(self):
        while True:
            w, at, frames = self.q.get()
            try:
                self.handle(w, at, frames)
            except Exception as e:
                log('nigrani ghalti:', e, traceback.format_exc()[-300:])

    def handle(self, w, at, frames):
        date = pk_date(at)
        with self.lock:
            st = self.stat(w.cid, date)
            st['touches'] += 1
            self.dirty.add((w.cid, date))
        if not frames or at - self.last_ai.get(w.cid, 0) < COOLDOWN:
            return
        key = secrets().get('claudeKey')
        if not key or st['checks'] >= w.cap_day or time.time() < self.pause_until:
            with self.lock:
                st['unchecked'] += 1
            return
        self.last_ai[w.cid] = at
        crops = [jpeg_b64(c, width=512, quality=70)[0] for c in frames]
        try:
            v, why, ms = ai_judge(key, crops)
            with self.lock:
                st['checks'] += 1
                st['shak'] += 1 if v == 'shak' else 0
        except Exception as e:
            v, why, ms = 'error', f'AI nahi chala: {e}'[:280], 0
            self.pause_until = time.time() + AI_PAUSE
        eid, t = f'{w.cid}-{int(at * 1000)}', int(at * 1000)
        self.fire.patch(f'{BIZ}/cameraFrames/{eid}', {'frames': crops, 'at': t, 'cam': w.cid})
        self.fire.patch(f'{BIZ}/cameraEvents/{eid}', {'cam': w.cid, 'camName': w.name, 'at': t, 'date': date, 'verdict': v, 'why': why,
                                                      'thumb': jpeg_b64(frames[len(frames) // 2], width=320, quality=60)[0], 'n': len(crops),
                                                      'ms': ms, 'model': MODEL, 'agent': VERSION})
        log('nigrani', w.cid, v, why)

    def flush(self):
        with self.lock:
            keys, self.dirty = list(self.dirty), set()
            rows = [dict(self.stats[k]) for k in keys]
        for row in rows:
            row['at'] = now_ms()
            self.fire.patch(f"{BIZ}/cameraStats/{row['cam']}_{row['date']}", row)
        # purane din yaad se hatao
        today = pk_date()
        for k in [k for k in self.stats if k[1] < today and k not in self.dirty]:
            self.stats.pop(k, None)


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
        k = secret_input('API key (baad mein dena ho to sirf Enter): ').strip()
        if k.startswith('sk-ant-'):
            sec['claudeKey'] = k
            save_json(SECRETS, sec)
            say('  [OK] API key is PC mein mehfooz.')
        elif k.startswith('apikey_'):
            say('  [!!] Ye key ki ID hai, asal key nahi. Console > API keys > "Create Key" par jo lambi sk-ant-api03-... aik dafa dikhti hai, wo copy karein.')
        elif k:
            say('  [!!] Ye Claude ki key nahi lagti (sk-ant- se shuru hoti hai). Baad mein dobara chalayein.')
    if sec.get('claudeKey'):
        ok, msg = check_key(sec['claudeKey'])
        say(('  [OK] ' if ok else '  [!!] ') + msg)
        if not ok and 'ghalat' in msg:
            sec.pop('claudeKey', None)
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


def run():
    lock = take_lock()
    if not lock:
        log('pehle se chal raha hai — band')
        return
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
    cams, shot_at, asked, state, watchers = {}, {}, {}, {}, {}
    galla = Galla(fire)
    galla.start()
    last_list = last_status = 0
    last_update = time.time() - UPDATE_EVERY + 120   # shuru ke 2 minute baad pehli jaanch
    last_scan = 0
    while True:
        try:
            t = time.time()
            if t - last_list > LIST_EVERY:
                cams = dict(fire.list('cameras'))
                last_list = t
                sec = secrets()                # setup ne naya camera joda ho
                # v1.1: galla nigrani — kaam 'galla' + dabba mark + chalu = video lagatar
                for cid, c in cams.items():
                    s = sec['cams'].get(cid)
                    if watch_wanted(c, s):
                        if cid not in watchers or not watchers[cid].is_alive():
                            watchers[cid] = Watch(cid, s['url'], c, galla.q)
                            watchers[cid].start()
                            log('nigrani shuru', cid)
                        else:
                            watchers[cid].apply(c)
                for cid in [k for k in watchers if not watch_wanted(cams.get(k, {}), sec['cams'].get(k))]:
                    watchers.pop(cid).stop()
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
                put_status(fire, cams=len(cams), online=online)
                for cid, wt in watchers.items():
                    fire.patch(f'{BIZ}/cameras/{cid}', {'watch': 'on' if wt.latest_at and t - wt.latest_at < 30 else 'down', 'fps': round(wt.fps, 1),
                                                         'stream': wt.stream, 'lastMotionAt': int(wt.last_motion * 1000), 'seenAt': now_ms()})
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
