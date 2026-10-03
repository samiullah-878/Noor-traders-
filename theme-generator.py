import re, colorsys, json
SRC='style.css'   # repo ki jad se chalao: python3 tools/theme-generator.py
s=re.sub(r'/\*.*?\*/','',open(SRC,encoding='utf-8').read(),flags=re.S)
def blocks(txt):
    i=0;n=len(txt);out=[]
    while i<n:
        j=txt.find('{',i)
        if j<0:break
        head=txt[i:j].strip();depth=1;k=j+1
        while k<n and depth:
            depth+= (txt[k]=='{') - (txt[k]=='}'); k+=1
        out.append((head,txt[j+1:k-1]));i=k
    return out
NAMED={'white':'#ffffff','black':'#000000'}
RGB=re.compile(r'rgba?\(([^)]*)\)')
def parse(c):
    c=c.lower(); c=NAMED.get(c,c)
    if c.startswith('#'):
        h=c[1:]
        if len(h) in(3,4): h=''.join(x*2 for x in h)
        if len(h) not in (6,8): return None
        r,g,b=(int(h[i:i+2],16)/255 for i in(0,2,4)); a=int(h[6:8],16)/255 if len(h)==8 else 1
        return r,g,b,a
    m=RGB.match(c)
    if m:
        p=[x.strip() for x in m.group(1).replace('/',',').split(',')]
        try:
            r,g,b=(float(x.rstrip('%'))/(100 if x.endswith('%') else 255) for x in p[:3]); return r,g,b,(float(p[3]) if len(p)>3 else 1)
        except: return None
def rgba(h,l,s_,a):
    r,g,b=colorsys.hls_to_rgb(h,max(0,min(1,l)),max(0,min(1,s_))); return f'rgba({round(r*255)},{round(g*255)},{round(b*255)},{round(a,3)})'
def info(c):
    p=parse(c)
    if not p: return None
    r,g,b,a=p; h,l,s_=colorsys.rgb_to_hls(r,g,b); return h,l,s_,a,max(r,g,b)-min(r,g,b)
# ---------- DARK mapping (vars se) ----------
def dbg(c):
    i=info(c)
    if not i: return c
    h,l,s_,a,ch=i
    if a<0.35: return rgba(h,.75,s_,a*.9)
    if l>=0.80: return rgba(h,.60,min(1,s_+.1),.18) if ch>0.05 else ('var(--glass)' if l>.96 else 'var(--glass2)')
    if l<=0.32: return ('var(--deep)' if 0.53<=h<=0.70 else rgba(h,.40,min(1,s_+.1),a)) if ch>0.12 else 'var(--deep2)'   # hara/laal button rang na khoye
    return rgba(h,min(.58,l+.04),min(1,s_+.12),a)
def dfg(c):
    i=info(c)
    if not i: return c
    h,l,s_,a,ch=i
    if l>=0.80: return c
    if ch>=0.22 and l<0.62:
        if 0.53<=h<=0.70: return 'var(--accent-ink)'          # neela text -> theme ka accent
        return rgba(h,.70,min(1,s_+.15),a)
    return 'var(--ink)' if l<0.45 else 'var(--ink2)'
def dbd(c):
    i=info(c)
    if not i: return c
    h,l,s_,a,ch=i
    if l>=0.70: return rgba(h,.62,s_,.38) if ch>0.08 else 'var(--line)'
    if l<=0.3: return 'var(--line)' if ch<0.12 else 'var(--edge)'
    return rgba(h,.62,min(1,s_+.1),.6)
# ---------- LIGHT mapping ----------
def lbg(c):
    i=info(c)
    if not i: return c
    h,l,s_,a,ch=i
    if a<0.35: return c
    if l>=0.80: return c if ch>0.05 else ('var(--surf)' if l>.96 else 'var(--surf2)')
    if l<=0.32 and ch>0.12 and 0.53<=h<=0.70: return 'var(--pri)'
    return c
def lfg(c):
    i=info(c)
    if not i: return c
    h,l,s_,a,ch=i
    if l>=0.80: return c
    if ch>=0.22 and l<0.62: return 'var(--accent-ink)' if 0.53<=h<=0.70 else c
    return 'var(--ink)' if l<0.45 else 'var(--ink2)'
def lbd(c):
    i=info(c)
    if not i: return c
    h,l,s_,a,ch=i
    return 'var(--line)' if (l>=0.70 and ch<=0.08) else c
COL=re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b',re.I)
BGP=('background','background-color','background-image'); FGP=('color','fill','stroke','caret-color')
BDP=('border','border-color','border-top','border-bottom','border-left','border-right','border-top-color','border-bottom-color','border-left-color','border-right-color','outline','outline-color')
def conv(txt,pfx,fb,ff,fd):
    o=[]
    for head,body in blocks(txt):
        if head.startswith('@media'):
            if 'print' in head: continue
            inner=conv(body,pfx,fb,ff,fd)
            if inner: o.append(head+'{'+inner+'}')
            continue
        if head.startswith('@'): continue
        decs=[]
        for d in body.split(';'):
            if ':' not in d: continue
            p,v=d.split(':',1); p=p.strip().lower(); v=v.replace('!important','').strip()
            fn=fb if p in BGP else ff if p in FGP else fd if p in BDP else None
            if fn and COL.search(v):
                nv=COL.sub(lambda m: fn(m.group(0)), v)
                if nv!=v or p in BGP: decs.append(f'{p}:{nv}!important')   # v2.52.1: rang wale button ka asal bg bhi (generic button rule se na dabe)
        if decs:
            sels=[]
            for x in head.split(','):
                x=x.strip()
                if not x or x.startswith(':root'): continue
                sels.append(pfx+x[4:] if x.startswith('html') else pfx+' '+x)
            if sels: o.append(','.join(sels)+'{'+';'.join(decs)+'}')
    return ''.join(o)
DK=conv(s,'html.dk',dbg,dfg,dbd); LT=conv(s,'html.lt',lbg,lfg,lbd)
THEMES={
 'glass':dict(mode='dk',name='Glass (B)',font="Sora",bg='radial-gradient(120% 70% at 0% 0%,#1C3A7A 0%,#0C1A3E 45%,#081127 100%)',hd='linear-gradient(160deg,rgba(40,80,170,.55),rgba(10,22,52,.65))',dlg='linear-gradient(160deg,#13275A,#0B1736)',ink='#E8EEFF',ink2='#9FB0DC',acc='#8FD8FF',good='#2EE6B0',bad='#FF5C7A',p1='#5EE7FF',p2='#7B6CFF',ontx='#081127',red='#FF7A8A',green='#5CFFC8',edge='rgba(111,216,255,.28)',deep='#16305F',meta='#081127'),
 'gold':dict(mode='dk',name='Midnight Gold',font="Plus Jakarta Sans",bg='radial-gradient(120% 70% at 100% 0%,#2A2418 0%,#141210 50%,#0B0A09 100%)',hd='linear-gradient(160deg,#211D16,#100F0D)',dlg='linear-gradient(160deg,#1E1B15,#100F0D)',ink='#F3EBDD',ink2='#B9AC94',acc='#E9C46A',good='#5FD39A',bad='#F07A6E',p1='#F1D27A',p2='#B8892E',ontx='#1A1408',red='#FF9A8C',green='#86E3B4',edge='rgba(233,196,106,.32)',deep='#2A2418',meta='#0B0A09'),
 'emerald':dict(mode='dk',name='Emerald Night',font="Outfit",bg='radial-gradient(120% 70% at 0% 0%,#0F3D33 0%,#0A2621 50%,#06120F 100%)',hd='linear-gradient(160deg,rgba(20,90,74,.6),rgba(6,22,18,.7))',dlg='linear-gradient(160deg,#0F2E28,#081815)',ink='#E6FFF6',ink2='#9CC9BA',acc='#6EE7B7',good='#34D399',bad='#FB7185',p1='#6EE7B7',p2='#0EA5A4',ontx='#04241C',red='#FDA4AF',green='#6EE7B7',edge='rgba(110,231,183,.28)',deep='#123B33',meta='#06120F'),
 'cyber':dict(mode='dk',name='Cyber Neon',font="Sora",bg='radial-gradient(110% 70% at 100% 0%,#3B0E5C 0%,#170A2E 45%,#07040F 100%)',hd='linear-gradient(160deg,rgba(120,30,170,.5),rgba(10,5,25,.7))',dlg='linear-gradient(160deg,#1E0F38,#0B0618)',ink='#F5EDFF',ink2='#B8A6DA',acc='#FF7AF5',good='#00F5D4',bad='#FF3D71',p1='#FF3DF2',p2='#7B2CFF',ontx='#0B0618',red='#FF6B98',green='#4DFFE0',edge='rgba(255,61,242,.32)',deep='#2A1350',meta='#07040F'),
 'paper':dict(mode='lt',name='Soft Paper',font="Poppins",bg='#F3EDE2',surf='#FBF8F2',surf2='#EFE7D9',ink='#3B3127',ink2='#7A6B58',line='#E2D6C2',acc='#6A4E3A',hd='linear-gradient(140deg,#6B5340,#3E2F24)',pri='#6A4E3A',good='#4F7D3A',bad='#B5483B',ontx='#FFFFFF',red='#B5483B',green='#4F7D3A',meta='#3E2F24'),
 'ocean':dict(mode='lt',name='Ocean Light',font="Plus Jakarta Sans",bg='#EDF2FA',surf='#FFFFFF',surf2='#F3F6FC',ink='#0F1E3A',ink2='#5B6B88',line='#DCE4F1',acc='#2563EB',hd='linear-gradient(135deg,#1E40AF,#2563EB 60%,#3B82F6)',pri='#2563EB',good='#15803D',bad='#C0262D',ontx='#FFFFFF',red='#C0262D',green='#15803D',meta='#1E40AF'),
 'royal':dict(mode='lt',name='Royal Navy',font="Plus Jakarta Sans",bg='#F4F6FB',surf='#FFFFFF',surf2='#F7F8FC',ink='#0E1A33',ink2='#5C6A85',line='#E2E7F1',acc='#1B3A7A',hd='linear-gradient(135deg,#0E1F45 0%,#1B3A7A 70%,#24489A 100%)',pri='#1B3A7A',good='#0F7A4C',bad='#B42332',ontx='#FFFFFF',red='#B42332',green='#0F7A4C',meta='#0E1F45'),
 'teal':dict(mode='lt',name='Navy + Teal',font="Outfit",bg='#F2F6F7',surf='#FFFFFF',surf2='#F5F8F9',ink='#0F1E2E',ink2='#5A6B7C',line='#DCE6EA',acc='#0D7F78',hd='linear-gradient(135deg,#102A43,#163D5C)',pri='#0D7F78',good='#0D7F78',bad='#C2413A',ontx='#FFFFFF',red='#C2413A',green='#0D7F78',meta='#102A43'),
 'graphite':dict(mode='lt',name='Graphite',font="Plus Jakarta Sans",bg='#F3F4F6',surf='#FFFFFF',surf2='#F8F9FA',ink='#111827',ink2='#6B7280',line='#E5E7EB',acc='#4F46E5',hd='linear-gradient(135deg,#111827,#1F2937)',pri='#4F46E5',good='#059669',bad='#DC2626',ontx='#FFFFFF',red='#DC2626',green='#059669',meta='#111827'),
 'frost':dict(mode='lt',name='Navy Frost',font="Poppins",bg='linear-gradient(180deg,#E9EEF8,#F5F7FB 40%)',surf='#FFFFFF',surf2='#F6F8FC',ink='#13213F',ink2='#5D6B88',line='#DFE5F0',acc='#2B4A86',hd='linear-gradient(150deg,#223B6D 0%,#2E5194 55%,#3D66B5 100%)',pri='#2B4A86',good='#178156',bad='#BA3038',ontx='#FFFFFF',red='#BA3038',green='#178156',meta='#223B6D'),

}
def themeCSS(k,t):
    sel=f'html.t-{k}'
    if t['mode']=='dk':
        v=f"{sel}{{--bg:{t['bg']};--hd:{t['hd']};--dlg:{t['dlg']};--ink:{t['ink']};--ink2:{t['ink2']};--accent-ink:{t['acc']};--good:{t['good']};--bad:{t['bad']};--p1:{t['p1']};--p2:{t['p2']};--ontx:{t['ontx']};--red:{t['red']};--green:{t['green']};--edge:{t['edge']};--deep:{t['deep']};--deep2:rgba(0,0,0,.35);--glass:rgba(255,255,255,.06);--glass2:rgba(255,255,255,.09);--line:rgba(255,255,255,.14);--font:'{t['font']}'}}"
    else:
        v=f"{sel}{{--bg:{t['bg']};--surf:{t['surf']};--surf2:{t['surf2']};--ink:{t['ink']};--ink2:{t['ink2']};--line:{t['line']};--accent-ink:{t['acc']};--hd:{t['hd']};--pri:{t['pri']};--good:{t['good']};--bad:{t['bad']};--ontx:{t['ontx']};--red:{t['red']};--green:{t['green']};--font:'{t['font']}'}}"
    return v
X3='html.dk.dk.dk'; L3='html.lt.lt.lt'
SHARED_DK=f'''
html.dk{{color-scheme:dark}}
html.dk body{{background:var(--bg) fixed!important;color:var(--ink)!important;font-family:var(--font),Poppins,'Segoe UI',system-ui,sans-serif!important}}
html.dk main{{background:transparent!important;box-shadow:none!important}}
html.dk header{{background:var(--hd)!important;border-bottom:1px solid var(--edge)!important;box-shadow:0 10px 40px rgba(0,0,0,.35)!important}}
html.dk dialog{{background:var(--dlg)!important;color:var(--ink)!important;border:1px solid var(--edge)!important;box-shadow:0 30px 90px rgba(0,0,0,.6)!important}}
html.dk dialog::backdrop{{background:rgba(0,0,0,.65)}}
html.dk button{{background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.04))!important;color:var(--ink)!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16)!important}}
html.dk button:active{{transform:scale(.98)}}
html.dk input,html.dk select,html.dk textarea{{background:rgba(255,255,255,.06)!important;color:var(--ink)!important;border:1px solid rgba(255,255,255,.18)!important}}
html.dk input::placeholder,html.dk textarea::placeholder{{color:var(--ink2)!important;opacity:.8}}
html.dk input:focus,html.dk select:focus,html.dk textarea:focus{{outline:none!important;border-color:var(--p1)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--p1) 22%,transparent),0 0 18px color-mix(in srgb,var(--p1) 25%,transparent)!important}}
html.dk select option{{background:#111;color:#eee}}
{X3} .got,{X3} footer .got,{X3} #actions .got,{X3} .scan-done{{background:linear-gradient(135deg,color-mix(in srgb,var(--good) 40%,transparent),color-mix(in srgb,var(--good) 10%,transparent))!important;border-color:color-mix(in srgb,var(--good) 70%,transparent)!important;color:#fff!important;box-shadow:0 0 18px color-mix(in srgb,var(--good) 35%,transparent),inset 0 1px 0 rgba(255,255,255,.3)!important}}
{X3} .give,{X3} footer .give,{X3} .danger,{X3} #actions .due-button,{X3} .scan-close{{background:linear-gradient(135deg,color-mix(in srgb,var(--bad) 40%,transparent),color-mix(in srgb,var(--bad) 10%,transparent))!important;border-color:color-mix(in srgb,var(--bad) 70%,transparent)!important;color:#fff!important;box-shadow:0 0 18px color-mix(in srgb,var(--bad) 35%,transparent),inset 0 1px 0 rgba(255,255,255,.3)!important}}
{X3} .saman,{X3} .primary,{X3} button.primary,{X3} .hbl-btn{{background:linear-gradient(135deg,color-mix(in srgb,var(--p1) 34%,transparent),color-mix(in srgb,var(--p2) 18%,transparent))!important;border-color:color-mix(in srgb,var(--p1) 70%,transparent)!important;color:#fff!important;box-shadow:0 0 18px color-mix(in srgb,var(--p1) 32%,transparent),inset 0 1px 0 rgba(255,255,255,.3)!important}}
html.dk.dk.dk.dk .on,html.dk.dk.dk.dk button.on,html.dk.dk.dk.dk .active,html.dk.dk.dk.dk [aria-selected="true"]{{background:linear-gradient(135deg,var(--p1),var(--p2))!important;color:var(--ontx)!important;border-color:transparent!important;box-shadow:0 0 16px color-mix(in srgb,var(--p1) 40%,transparent)!important}}
html.dk.dk .red{{color:var(--red)!important}}html.dk.dk .green{{color:var(--green)!important}}
html.dk strong.red,html.dk strong.green{{text-shadow:0 0 18px currentColor}}
'''
SHARED_LT=f'''
html.lt body{{background:var(--bg)!important;color:var(--ink)!important;font-family:var(--font),Poppins,'Segoe UI',system-ui,sans-serif!important}}
html.lt main{{background:var(--bg)!important;box-shadow:none!important}}
html.lt header{{background:var(--hd)!important;color:#fff!important}}
html.lt dialog{{background:var(--surf)!important;color:var(--ink)!important;border:1px solid var(--line)!important}}
html.lt button{{background:var(--surf)!important;color:var(--ink)!important;border:1px solid var(--line)!important;box-shadow:0 1px 2px rgba(0,0,0,.05)!important}}
html.lt header button{{background:rgba(255,255,255,.14)!important;color:#fff!important;border-color:rgba(255,255,255,.25)!important}}
html.lt header .summary button:not(.selected):not(.on),html.lt header .stock-head button:not(.selected):not(.on){{background:var(--surf2)!important;color:var(--ink)!important;border:1px solid var(--line)!important}}
html.lt input,html.lt select,html.lt textarea{{background:var(--surf)!important;color:var(--ink)!important;border:1px solid var(--line)!important}}
html.lt input:focus,html.lt select:focus,html.lt textarea:focus{{outline:none!important;border-color:var(--pri)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--pri) 18%,transparent)!important}}
{L3} .got,{L3} footer .got,{L3} #actions .got,{L3} .scan-done{{background:var(--good)!important;color:#fff!important;border-color:var(--good)!important;box-shadow:0 6px 16px color-mix(in srgb,var(--good) 30%,transparent)!important}}
{L3} .give,{L3} footer .give,{L3} #actions .due-button,{L3} .scan-close{{background:var(--bad)!important;color:#fff!important;border-color:var(--bad)!important;box-shadow:0 6px 16px color-mix(in srgb,var(--bad) 30%,transparent)!important}}
{L3} .danger{{background:color-mix(in srgb,var(--bad) 10%,var(--surf))!important;color:var(--bad)!important;border-color:color-mix(in srgb,var(--bad) 35%,transparent)!important}}
{L3} .saman,{L3} .primary,{L3} button.primary,{L3} .hbl-btn{{background:var(--pri)!important;color:#fff!important;border-color:var(--pri)!important;box-shadow:0 6px 16px color-mix(in srgb,var(--pri) 30%,transparent)!important}}
html.lt.lt.lt.lt .on,html.lt.lt.lt.lt button.on,html.lt.lt.lt.lt .active,html.lt.lt.lt.lt [aria-selected="true"]{{background:var(--pri)!important;color:var(--ontx)!important;border-color:var(--pri)!important}}
html.lt.lt.lt.lt header .on,html.lt.lt.lt.lt header button.on{{background:#fff!important;color:var(--pri)!important}}
html.lt.lt .red{{color:var(--red)!important}}html.lt.lt .green{{color:var(--green)!important}}
'''
PREM='''
html.lt header{border-radius:0 0 26px 26px!important;box-shadow:0 14px 34px rgba(14,31,69,.22)!important}
html.lt header .summary>div,html.lt main .summary>div{background:var(--surf)!important;border:1px solid rgba(255,255,255,.6)!important;box-shadow:0 10px 26px rgba(14,31,69,.14)!important}
html.lt button{border-radius:14px!important;font-weight:700}
html.lt .ledger-item,html.lt .sale-copies,html.lt .card,html.lt .set-card{box-shadow:0 4px 14px rgba(14,31,69,.06)!important}
html.t-frost header .summary>div{background:rgba(255,255,255,.9)!important;backdrop-filter:blur(8px)}
html.t-royal header{border-bottom:2px solid #C9A646!important}
html.t-royal header .summary>div{border-top:3px solid #C9A646!important}
'''
KEEP='''
html.dk .pdf-sheet,html.dk .report-document,html.dk #printArea,html.lt .pdf-sheet,html.lt #printArea{background:#fff!important;color:#10192b!important}
'''
css='/* Blue Khata v2.50 — LOOKS (tools/theme-generator.py se bana). html.dk = dark, html.lt = light, html.t-<naam> = rang. Print par lagu nahi. */\n'+''.join(themeCSS(k,t) for k,t in THEMES.items())+DK+SHARED_DK+LT+SHARED_LT+PREM+KEEP
open('themes.css','w',encoding='utf-8').write(css)
pass
print('themes.css', len(css)//1024, 'KB')
