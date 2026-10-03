import re, colorsys
SRC='/home/claude/work/Noor-traders--main/style.css'
s=open(SRC,encoding='utf-8').read()
s=re.sub(r'/\*.*?\*/','',s,flags=re.S)
# --- block parser (top-level + @media) ---
def blocks(txt):
    i=0;n=len(txt);out=[]
    while i<n:
        j=txt.find('{',i)
        if j<0:break
        head=txt[i:j].strip();depth=1;k=j+1
        while k<n and depth:
            if txt[k]=='{':depth+=1
            elif txt[k]=='}':depth-=1
            k+=1
        out.append((head,txt[j+1:k-1]));i=k
    return out
NAMED={'white':'#ffffff','black':'#000000'}
HEX=re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b')
RGB=re.compile(r'rgba?\(([^)]*)\)')
def parse(c):
    c=c.lower()
    if c in NAMED: c=NAMED[c]
    if c.startswith('#'):
        h=c[1:]
        if len(h) in(3,4): h=''.join(x*2 for x in h)
        r,g,b=(int(h[i:i+2],16)/255 for i in(0,2,4)); a=int(h[6:8],16)/255 if len(h)==8 else 1
        return r,g,b,a
    m=RGB.match(c)
    if m:
        p=[x.strip() for x in m.group(1).replace('/',',').split(',')]
        try:
            r,g,b=(float(x.rstrip('%'))/(100 if x.endswith('%') else 255) for x in p[:3]); a=float(p[3]) if len(p)>3 else 1
            return r,g,b,a
        except: return None
    return None
def out(h,l,s_,a):
    r,g,b=colorsys.hls_to_rgb(h,max(0,min(1,l)),max(0,min(1,s_)))
    return f'rgba({round(r*255)},{round(g*255)},{round(b*255)},{round(a,3)})'
def bg(c):
    p=parse(c)
    if not p: return c
    r,g,b,a=p; h,l,s_=colorsys.rgb_to_hls(r,g,b); ch=max(r,g,b)-min(r,g,b)
    if a<0.35: return out(h,.75,s_,a*0.9)                      # halki shadow/tint
    if l>=0.80: return out(h,.60,min(1,s_+.1),.18) if ch>0.05 else f'rgba(255,255,255,{.06 if l>.96 else .09})'
    if l<=0.32: return out(h,min(.26,l+.06),min(1,s_+.05),a) if ch>0.12 else out(h,.12,s_,a)
    return out(h,min(.58,l+.04),min(1,s_+.12),a)              # accent buttons: chamakdar
def fg(c):
    p=parse(c)
    if not p: return c
    r,g,b,a=p; h,l,s_=colorsys.rgb_to_hls(r,g,b); ch=max(r,g,b)-min(r,g,b)
    if l>=0.80: return c
    if ch>=0.22 and l<0.62: return out(h,.70,min(1,s_+.15),a)  # laal / hara / neela text -> neon
    if l<0.25: return out(h,.93,min(.35,s_),a)
    if l<0.45: return out(h,.86,min(.35,s_),a)
    return out(h,.72,min(.35,s_),a)
def bd(c):
    p=parse(c)
    if not p: return c
    r,g,b,a=p; h,l,s_=colorsys.rgb_to_hls(r,g,b); ch=max(r,g,b)-min(r,g,b)
    if l>=0.70: return out(h,.62,s_,.38) if ch>0.08 else 'rgba(255,255,255,.14)'
    if l<=0.3: return 'rgba(255,255,255,.18)' if ch<0.12 else out(h,.55,s_,.6)
    return out(h,.62,min(1,s_+.1),.6)
COL=re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b',re.I)
def mapv(v,fn): return COL.sub(lambda m: fn(m.group(0)), v)
PROPS={'background':bg,'background-color':bg,'background-image':bg,'color':fg,'fill':fg,'stroke':fg,'caret-color':fg,
       'border':bd,'border-color':bd,'border-top':bd,'border-bottom':bd,'border-left':bd,'border-right':bd,
       'border-top-color':bd,'border-bottom-color':bd,'border-left-color':bd,'border-right-color':bd,'outline':bd,'outline-color':bd}
def pref(sel):
    res=[]
    for x in sel.split(','):
        x=x.strip()
        if not x or x.startswith(':root') or x.startswith('@'): continue
        if x.startswith('html'): x='html.glass'+x[4:]
        else: x='html.glass '+x
        res.append(x)
    return ','.join(res)
def conv(txt):
    o=[]
    for head,body in blocks(txt):
        if head.startswith('@media'):
            if 'print' in head: continue
            inner=conv(body)
            if inner: o.append(head+'{'+inner+'}')
            continue
        if head.startswith('@'): continue
        decs=[]
        for d in body.split(';'):
            if ':' not in d: continue
            p,v=d.split(':',1); p=p.strip().lower(); v=v.replace('!important','').strip()
            if p in PROPS and COL.search(v):
                nv=mapv(v,PROPS[p])
                if nv!=v: decs.append(f'{p}:{nv}!important')
        if decs:
            sel=pref(head)
            if sel: o.append(sel+'{'+';'.join(decs)+'}')
    return ''.join(o)
gen=conv(s)
HAND='''
/* ===== v2.49 GLASS (Look B) — haath se: bunyad, header, buttons, inputs ===== */
html.glass{color-scheme:dark;background:#081127}
html.glass body{background:radial-gradient(120% 70% at 0% 0%,#1C3A7A 0%,#0C1A3E 45%,#081127 100%) fixed!important;color:#E8EEFF!important;font-family:Sora,Poppins,'Segoe UI',system-ui,sans-serif!important}
html.glass main{background:transparent!important;box-shadow:none!important}
html.glass header{background:linear-gradient(160deg,rgba(40,80,170,.55),rgba(10,22,52,.65))!important;border-bottom:1px solid rgba(111,216,255,.25)!important;box-shadow:0 10px 40px rgba(0,0,0,.35)!important;backdrop-filter:blur(10px)}
html.glass dialog{background:linear-gradient(160deg,#13275A,#0B1736)!important;color:#E8EEFF!important;border:1px solid rgba(111,216,255,.22)!important;box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 30px rgba(79,209,255,.12)!important}
html.glass dialog::backdrop{background:rgba(3,8,20,.7)}
html.glass button{background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.04))!important;color:#E8EEFF!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)!important;transition:box-shadow .15s,transform .05s}
html.glass button:active{transform:scale(.98)}
html.glass button:disabled{opacity:.5}
html.glass input,html.glass select,html.glass textarea{background:rgba(255,255,255,.06)!important;color:#F2F5FF!important;border:1px solid rgba(255,255,255,.18)!important}
html.glass input::placeholder,html.glass textarea::placeholder{color:#8FA0C8!important}
html.glass input:focus,html.glass select:focus,html.glass textarea:focus{outline:none!important;border-color:#6FD8FF!important;box-shadow:0 0 0 3px rgba(79,209,255,.22),0 0 18px rgba(79,209,255,.25)!important}
html.glass select option{background:#0E1D45;color:#E8EEFF}
/* kaam ke bare button — neon */
html.glass.glass.glass .got,html.glass.glass.glass footer .got,html.glass.glass.glass #actions .got{background:linear-gradient(135deg,rgba(46,230,176,.38),rgba(46,230,176,.10))!important;border-color:rgba(92,255,200,.65)!important;color:#fff!important;box-shadow:0 0 18px rgba(46,230,176,.35),inset 0 1px 0 rgba(255,255,255,.3)!important}
html.glass.glass.glass .give,html.glass.glass.glass footer .give,html.glass.glass.glass .danger,html.glass.glass.glass #actions .due-button{background:linear-gradient(135deg,rgba(255,92,122,.38),rgba(255,92,122,.10))!important;border-color:rgba(255,122,138,.7)!important;color:#fff!important;box-shadow:0 0 18px rgba(255,92,122,.35),inset 0 1px 0 rgba(255,255,255,.3)!important}
html.glass.glass.glass .saman,html.glass.glass.glass .primary,html.glass.glass.glass button.primary,html.glass.glass.glass .hbl-btn{background:linear-gradient(135deg,rgba(94,231,255,.32),rgba(123,108,255,.18))!important;border-color:rgba(111,216,255,.7)!important;color:#fff!important;box-shadow:0 0 18px rgba(79,209,255,.35),inset 0 1px 0 rgba(255,255,255,.3)!important}
/* chuna hua chip / tab */
html.glass.glass.glass.glass .on,html.glass.glass.glass.glass button.on,html.glass.glass.glass.glass .active,html.glass.glass.glass.glass [aria-selected="true"]{background:linear-gradient(135deg,#5EE7FF,#7B6CFF)!important;color:#081127!important;border-color:transparent!important;box-shadow:0 0 16px rgba(94,231,255,.4)!important}
/* baqaya ke rang */
html.glass.glass .red{color:#FF7A8A!important}html.glass.glass .green{color:#5CFFC8!important}
html.glass strong.red,html.glass strong.green{text-shadow:0 0 18px currentColor}
/* tasveerein, rasid preview, PDF — asli (safed) */
html.glass img,html.glass video,html.glass canvas{filter:none!important}
html.glass .pdf-sheet,html.glass .report-document,html.glass #printArea,html.glass .receipt-preview{background:#fff!important;color:#10192b!important}
html.glass .pdf-sheet *,html.glass .report-document *,html.glass #printArea *{color:inherit}
html.glass ::-webkit-scrollbar{width:8px;height:8px}html.glass ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:8px}
'''
open('/home/claude/work/Noor-traders--main/theme-glass.css','w',encoding='utf-8').write('/* Blue Khata v2.49 — Look B (Glass). Khud bana: style.css ke rang dark-glass mein (generator). PRINT par lagu nahi. */\n'+gen+HAND)
print('rules', gen.count('{'), 'bytes', len(gen)+len(HAND))
