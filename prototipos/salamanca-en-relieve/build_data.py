import re, json, sys, os, glob, math
svg_path, md_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(svg_path, encoding='utf-8').read()
paths = re.findall(r'<path\s([^>]*)/?>', src, re.S)
tok = re.compile(r'[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?')
def parse(d):
    t = tok.findall(d); i=0; cmd=None; x=y=0; rings=[]; cur=[]
    while i < len(t):
        if re.match('[a-zA-Z]', t[i]): cmd=t[i]; i+=1
        if cmd in 'zZ':
            if cur: rings.append(cur); cur=[]
            if cur==[] and rings: x,y = rings[-1][0]
            continue
        if cmd in 'mM':
            nx,ny=float(t[i]),float(t[i+1]); i+=2
            if cmd=='m' and not (rings or cur) : x,y=nx,ny
            elif cmd=='m': x,y=x+nx,y+ny
            else: x,y=nx,ny
            if cur: rings.append(cur)
            cur=[(x,y)]; cmd = 'l' if cmd=='m' else 'L'; continue
        if cmd=='l': x+=float(t[i]); y+=float(t[i+1]); i+=2
        elif cmd=='L': x=float(t[i]); y=float(t[i+1]); i+=2
        elif cmd=='h': x+=float(t[i]); i+=1
        elif cmd=='H': x=float(t[i]); i+=1
        elif cmd=='v': y+=float(t[i]); i+=1
        elif cmd=='V': y=float(t[i]); i+=1
        else: raise Exception(cmd)
        cur.append((x,y))
    if cur: rings.append(cur)
    return rings
def dp(pts, eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy) or 1e-9
    imax,dmax=0,0
    for k in range(1,len(pts)-1):
        p=pts[k]; d=abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L if L>1e-9 else math.hypot(p[0]-a[0],p[1]-a[1])
        if d>dmax: imax,dmax=k,d
    if dmax>eps: return dp(pts[:imax+1],eps)[:-1]+dp(pts[imax:],eps)
    return [a,b]
def norm(s):
    import unicodedata
    s=unicodedata.normalize('NFD',s.lower()); s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'[^a-z0-9]','',s)
mds={}
for f in glob.glob(os.path.join(md_dir,'*.md')):
    txt=open(f,encoding='utf-8').read(3000)
    name=re.search(r'^# (.+)$',txt,re.M); 
    if not name: continue
    def num(lbl):
        m=re.search(r'\*\*'+lbl+r':\*\*\s*([\d.,]+)',txt)
        if not m: return None
        v=m.group(1).replace('.','').replace(',','.') if lbl!='Superficie' else m.group(1).replace(',','.')
        try: return float(v)
        except: return None
    cod=re.search(r'cod_municipio\s*=\s*(\d+)',txt)
    rec={'name':name.group(1).strip(),'alt':num('Altitud'),'pop':num('Población'),'km2':num('Superficie')}
    if cod: mds['37'+cod.group(1).zfill(3)]=rec
    mds.setdefault(norm(name.group(1)),rec)
munis={}
for attrs in paths:
    d=re.search(r'\bd="([^"]*)"',attrs).group(1)
    pid=re.search(r'\bid="([^"]*)"',attrs); lab=re.search(r'inkscape:label="#?([^"]*)"',attrs)
    pid=pid.group(1) if pid else ''; lab=lab.group(1) if lab else ''
    code=pid[:5] if re.match(r'37\d{3}',pid) else pid
    rings=[]
    for r in parse(d):
        s=dp(r,0.35)
        if len(s)>=4: rings.append([round(v,1) for p in s for v in p])
    m=munis.setdefault(code,{'id':code,'slug':lab,'rings':[]}); m['rings']+=rings
miss=0
for code,m in munis.items():
    info=mds.get(code) or mds.get(norm(m['slug'].replace('-',' ')))
    if info: m.update(name=info['name'],alt=info['alt'],pop=info['pop'],km2=info['km2'])
    else: miss+=1; m.update(name=m['slug'].replace('-',' ').title(),alt=None,pop=None,km2=None)
lst=list(munis.values())
json.dump(lst,open(out,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(len(lst),'munis', 'sin datos:',miss, 'alt ok:',sum(1 for m in lst if m['alt']), 'bytes',os.path.getsize(out))
