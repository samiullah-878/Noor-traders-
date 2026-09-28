# ntcam_test.py — PC ke camera program ki jaanch (bina asal camera / Firebase ke).  Chalana:  python ntcam_test.py
import os, sys, json, base64, tempfile, types, unittest
from unittest import mock
os.environ['NTCAM_HOME'] = tempfile.mkdtemp()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ntcam


class T(unittest.TestCase):
    def test_pc_code(self):
        self.assertEqual(ntcam.parse_code(' K7M2QX-9fa4tpze3h '), ('cam-k7m2qx@nttraders.local', '9fa4tpze3h'))
        self.assertIsNone(ntcam.parse_code('abc'))
        self.assertIsNone(ntcam.parse_code('k7m2qx9fa4tpze3h'))

    def test_firestore_values(self):
        v = {'a': 1, 'b': 'x', 'c': True, 'd': None, 'e': 1.5, 'f': [1, 'y'], 'g': {'h': 2}}
        self.assertEqual({k: ntcam.dec(ntcam.enc(x)) for k, x in v.items()}, v)
        self.assertEqual(ntcam.enc(5), {'integerValue': '5'})

    def test_rtsp_and_mask(self):
        u = ntcam.rtsp_urls('dahua', '192.168.0.9', 'admin', 'p@ss:w/rd#1', 2)
        self.assertEqual(u[0], 'rtsp://admin:p%40ss%3Aw%2Frd%231@192.168.0.9:554/cam/realmonitor?channel=2&subtype=0')
        self.assertTrue(ntcam.rtsp_urls('hik', '1.2.3.4', 'a', 'b')[0].endswith('/Streaming/Channels/101'))
        self.assertNotIn('p%40ss', ntcam.mask(u[0])); self.assertIn('****@192.168.0.9', ntcam.mask(u[0]))

    def test_jpeg(self):
        import numpy as np
        f = (np.random.rand(1440, 2560, 3) * 255).astype('uint8')
        b64, w, h = ntcam.jpeg_b64(f)
        self.assertEqual((w, h), (640, 360)); self.assertLess(len(b64), 400000, 'rules ki had (400 KB) se kam')
        self.assertTrue(base64.b64decode(b64)[:2] == b'\xff\xd8', 'asli jpeg')

    def test_newer(self):
        self.assertTrue(ntcam.newer('1.10', '1.9')); self.assertFalse(ntcam.newer('1.0', '1.0')); self.assertTrue(ntcam.newer('2.0', '1.0'))

    def test_patch_sirf_apni_fields(self):
        calls = []
        class R:
            def __init__(s, code=200, j=None): s.status_code, s._j, s.text = code, j or {}, ''
            def json(s): return s._j
        fake = types.SimpleNamespace(
            post=lambda url, **k: R(200, {'idToken': 'T', 'refreshToken': 'R', 'localId': 'U', 'expiresIn': '3600'}),
            patch=lambda url, headers=None, params=None, json=None, timeout=None: calls.append((url, params, json)) or R(),
            get=lambda *a, **k: R(404))
        with mock.patch.dict(sys.modules, {'requests': fake}):
            f = ntcam.Fire('K', 'nt-traders', 'cam-x@nttraders.local', 'p')
            f.patch('businesses/noor-traders/cameras/abc-ch1', {'status': 'online', 'lastFrameAt': 5})
            self.assertIsNone(f.get('businesses/noor-traders/cameras/none'))
        url, params, body = calls[0]
        self.assertTrue(url.endswith('/documents/businesses/noor-traders/cameras/abc-ch1'))
        self.assertEqual(sorted(p[1] for p in params), ['lastFrameAt', 'status'], 'updateMask — malik ka naam/kaam nahi badalta')
        self.assertEqual(body['fields']['lastFrameAt'], {'integerValue': '5'})

    def test_agent_keys_rules_mein(self):
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        block = rules[rules.index('match /businesses/noor-traders/cameras/{camId}'):]
        block = block[:block.index('}\n')]
        for k in ntcam.AGENT_KEYS:
            self.assertIn("'" + k + "'", block, 'rules mein nahi: ' + k)


class Nigrani(unittest.TestCase):
    """v1.1 galla nigrani — harkat, tukre, AI faisla, ginti (bina camera / Claude ke)."""
    def test_zone_px(self):
        self.assertEqual(ntcam.zone_px({'x': .25, 'y': .5, 'w': .5, 'h': .25}, 800, 400), (200, 200, 600, 300))
        x0, y0, x1, y1 = ntcam.zone_px({'x': .25, 'y': .5, 'w': .5, 'h': .25}, 800, 400, 0.5)
        self.assertEqual((x0, y0, x1, y1), (0, 150, 800, 350), 'AI ke liye aas paas bhi, tasveer se bahar nahi')
        self.assertEqual(ntcam.zone_px(None, 10, 10), (0, 0, 0, 0))

    def test_motion(self):
        import numpy as np
        m = ntcam.Motion('mid')
        still = np.full((120, 200, 3), 90, 'uint8')
        self.assertFalse(m.feed(still)[0])
        for _ in range(5):
            self.assertFalse(m.feed(still)[0], 'khamoshi par harkat nahi')
        moved = still.copy(); moved[20:100, 40:160] = 230          # haath aaya
        self.assertFalse(m.feed(moved)[0], 'aik sample par nahi (shor)')
        self.assertTrue(m.feed(moved)[0], 'do lagatar = harkat')

    def test_pick_and_verdict(self):
        self.assertEqual(ntcam.pick(list(range(10)), 6), [0, 2, 4, 5, 7, 9])
        self.assertEqual(ntcam.parse_verdict('ok {"verdict": "shak", "why": "Note jeb mein"} bas'), ('shak', 'Note jeb mein'))
        self.assertEqual(ntcam.parse_verdict('{"verdict":"Normal","why":"baqaya diya"}')[0], 'normal')
        self.assertEqual(ntcam.parse_verdict('samajh nahi aaya')[0], 'saaf_nahi')
        self.assertEqual(ntcam.pk_date(0), '1970-01-01')

    def _galla(self):
        import numpy as np
        writes = []
        class F:
            def get(s, path): return None
            def patch(s, path, data): writes.append((path, data)); return True
        g = ntcam.Galla(F())
        w = types.SimpleNamespace(cid='aa11-ch1', name='Galla', cap_day=2)
        frames = [(np.random.rand(200, 300, 3) * 255).astype('uint8') for _ in range(6)]
        return g, w, frames, writes

    def test_galla_flow(self):
        g, w, frames, writes = self._galla()
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_judge', lambda key, crops: ('shak', 'Note jeb ki taraf', 900)):
            g.handle(w, 1000.0, frames)                 # jaanch
            g.handle(w, 1010.0, frames)                 # 20 s ke andar: sirf ginti
            g.handle(w, 1031.0, frames)                 # doosri jaanch
            g.handle(w, 1060.0, frames)                 # had (2) poori: ginti + unchecked
        st = g.stats[('aa11-ch1', ntcam.pk_date(1000.0))]
        self.assertEqual((st['touches'], st['checks'], st['shak'], st['unchecked']), (4, 2, 2, 1))
        ev = [d for p, d in writes if '/cameraEvents/' in p]; fr = [d for p, d in writes if '/cameraFrames/' in p]
        self.assertEqual(len(ev), 2); self.assertEqual(len(fr), 2)
        self.assertEqual(ev[0]['verdict'], 'shak'); self.assertEqual(len(fr[0]['frames']), 6)
        self.assertLess(len(ev[0]['thumb']), 80000, 'rules ki had'); self.assertLess(sum(len(x) for x in fr[0]['frames']), 900000, 'Firestore 1 MB')
        order = [p.split('/')[2] for p, d in writes]
        self.assertEqual(order[:2], ['cameraFrames', 'cameraEvents'], 'pehle tasveerein, phir event (event par khabar jati hai)')
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        blk = rules[rules.index('cameraEvents/{eventId}'):]; blk = blk[:blk.index('\n    }')]
        for k in ev[0]: self.assertIn("'" + k + "'", blk, 'rules mein nahi: ' + k)
        g.flush()
        sw = [d for p, d in writes if '/cameraStats/' in p][0]
        self.assertEqual(sorted(sw), sorted(['cam', 'date', 'touches', 'checks', 'shak', 'unchecked', 'at']))

    def test_ai_error_pause(self):
        g, w, frames, writes = self._galla()
        def boom(key, crops): raise RuntimeError('credit nahi')
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_judge', boom):
            g.handle(w, 2000.0, frames)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual(ev['verdict'], 'error'); self.assertIn('credit', ev['why'])
        self.assertGreater(g.pause_until, time_now() - 1)

    def test_watch_wanted(self):
        c = {'role': 'galla', 'zone': {'w': .3}, 'enabled': True}
        self.assertTrue(ntcam.watch_wanted(c, {'url': 'x'}))
        self.assertFalse(ntcam.watch_wanted({**c, 'zone': None}, {'url': 'x'}), 'dabba nahi')
        self.assertFalse(ntcam.watch_wanted({**c, 'role': 'view'}, {'url': 'x'}))
        self.assertFalse(ntcam.watch_wanted({**c, 'enabled': False}, {'url': 'x'}))
        self.assertFalse(ntcam.watch_wanted(c, None), 'password nahi')


def time_now():
    import time
    return time.time()


if __name__ == '__main__':
    unittest.main(verbosity=1)
