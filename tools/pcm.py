# v2.248.0: 🖥 PC = MOBILE jaisi screen (malik 13 Nov: 'PC ki sab screens mobile jaisi — chips ⋮ mein, neeli list bhi ☰ mein').
#   html.pcm (index.html, PC >=1100px) par: (1) style.css ke MOBILE media blocks ki copy pcm.css mein (selector ke aage html.pcm),
#   (2) PC media blocks (min-width:1100px) par html:not(.pcm) — style.css / themes.css mein ek dafa (dobara chalao = kuch nahi badalta).
#   style.css ke mobile block (max-width:1099…) badlo to yeh script dobara chalao:  python3 tools/pcm.py
import re, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = ('.pp-posr', '.pp-posh')          # POS Purchase (PC) — is ko mat chhero
def match(s, i):                          # s[i] == '{' -> index of matching '}'
    d = 0; n = len(s)
    while i < n:
        c = s[i]
        if c == '/' and s[i:i+2] == '/*': i = s.index('*/', i) + 2; continue
        if c in '"\'':
            j = i + 1
            while s[j] != c: j += 2 if s[j] == '\\' else 1
            i = j + 1; continue
        if c == '{': d += 1
        elif c == '}':
            d -= 1
            if d == 0: return i
        i += 1
    raise ValueError('brace')
def split_sel(p):
    out, d, cur = [], 0, ''
    for c in p:
        if c in '([': d += 1
        elif c in ')]': d -= 1
        if c == ',' and d == 0: out.append(cur); cur = ''
        else: cur += c
    out.append(cur); return out
def pref(sel, ins):
    s = sel.strip()
    if not s or '.pcm' in s: return sel
    if re.match(r'html(?![\w-])', s): return 'html' + ins + s[4:]
    if s.startswith(':root'): return 'html' + ins + s[5:]
    return 'html' + ins + ' ' + s
def rules(body, ins):
    out, i, n = '', 0, len(body)
    while i < n:
        j = body.find('{', i)
        if j < 0: out += body[i:]; break
        k = match(body, j); pre = body[i:j]; inner = body[j+1:k]; ps = pre.strip()
        cm = ''
        while ps.startswith('/*'): e = ps.index('*/') + 2; cm += ps[:e]; ps = ps[e:].strip()
        if ps.startswith('@'):
            out += cm + ps + '{' + (rules(inner, ins) if re.match(r'@(supports|media|container|layer)', ps) else inner) + '}'
        else:
            out += cm + ','.join(pref(x, ins) for x in split_sel(ps)) + '{' + inner + '}'
        i = k + 1
    return out
def blocks(css):
    for m in re.finditer(r'@media\s*\(\s*(max-width:\s*1099(?:\.98)?px|min-width:\s*1100px)\s*\)\s*\{', css):
        k = match(css, m.end() - 1); yield m, k
def run():
    mob = []
    for f in ('style.css', 'themes.css'):
        p = os.path.join(R, f); css = open(p, encoding='utf-8').read(); out = ''; last = 0
        for m, k in blocks(css):
            if m.start() < last: continue
            body = css[m.end():k]
            if m.group(1).startswith('max'):
                mob.append(rules(body, '.pcm'))
            elif not any(x in body for x in KEEP):
                out += css[last:m.end()] + rules(body, ':not(.pcm)') + '}'; last = k + 1
        out += css[last:]
        if out != css: open(p, 'w', encoding='utf-8').write(out)
    open(os.path.join(R, 'pcm.css'), 'w', encoding='utf-8').write('/* KHUD BANI FILE — haath se mat badlo: python3 tools/pcm.py (style.css ke mobile blocks ki copy, PC par html.pcm ke liye) */\n@media (min-width:1100px){\n' + '\n'.join(mob) + '\n}\n')
    print('mobile blocks', len(mob), 'pcm.css', os.path.getsize(os.path.join(R, 'pcm.css')))
if __name__ == '__main__': run()
