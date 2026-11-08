import json, base64, os, sys, re
S, flags_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
munis = json.load(open(os.path.join(S,'munis.json'),encoding='utf-8'))
for m in munis:
    m['name'] = (m.get('name') or '').replace('_',' ') if not m['id'].startswith('path') else ''
flags = {}
for f in os.listdir(flags_dir):
    code = f.split('_')[0]
    if re.fullmatch(r'37\d{3}', code) and f.endswith('.png'):
        flags[code] = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(flags_dir,f),'rb').read()).decode()
t = open(os.path.join(S,'template.html'),encoding='utf-8').read()
t = t.replace('__MUNIS__', json.dumps(munis,ensure_ascii=False,separators=(',',':'))).replace('__FLAGS__', json.dumps(flags,separators=(',',':')))
open(out,'w',encoding='utf-8').write(t)
print(len(flags),'flags', os.path.getsize(out),'bytes')
