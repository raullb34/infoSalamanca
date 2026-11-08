"""Genera public/data/relieve.json para el mapa 3D (RelieveMap.vue).

Lee los límites de public/Limites_salamanca.svg y la altitud, población y superficie de las fichas de
Wikipedia (municipios_md). Simplifica los polígonos (Douglas-Peucker) para que el JSON pese poco.
Basado en prototipos/salamanca-en-relieve/build_data.py, con una mejora: los enclaves cuyo id no es un
código INE (p. ej. "agallas2") se asignan a su municipio, para que al tocarlos se abra la ficha correcta.

Uso (desde frontend/):  python -I scripts/build-relieve-data.py
"""
import glob
import json
import math
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, '..', 'public', 'Limites_salamanca.svg')
MD_DIR = os.path.join(HERE, '..', '..', 'backend', 'src', 'SaLLMantino', 'ragger', 'script', 'municipios_md')
INE_JSON = os.path.join(HERE, '..', '..', 'backend', 'src', 'helpers', 'ine-codigopostal.json')
OUT = os.path.join(HERE, '..', 'public', 'data', 'relieve.json')

# Erratas en las etiquetas del SVG
ALIAS = {'la zarza de pumadera': 'la zarza de pumareda'}

TOKEN = re.compile(r'[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?')


def parse(d):
    """Path SVG (solo M/L/H/V/Z, absolutos o relativos) → lista de anillos [(x, y), ...]."""
    t = TOKEN.findall(d)
    i, cmd, x, y = 0, None, 0.0, 0.0
    rings, cur = [], []
    while i < len(t):
        if re.match('[a-zA-Z]', t[i]):
            cmd = t[i]
            i += 1
        if cmd in 'zZ':
            if cur:
                rings.append(cur)
                cur = []
            if not cur and rings:
                x, y = rings[-1][0]
            continue
        if cmd in 'mM':
            nx, ny = float(t[i]), float(t[i + 1])
            i += 2
            if cmd == 'm' and (rings or cur):
                x, y = x + nx, y + ny
            else:
                x, y = nx, ny
            if cur:
                rings.append(cur)
            cur = [(x, y)]
            cmd = 'l' if cmd == 'm' else 'L'
            continue
        if cmd == 'l':
            x += float(t[i]); y += float(t[i + 1]); i += 2
        elif cmd == 'L':
            x = float(t[i]); y = float(t[i + 1]); i += 2
        elif cmd == 'h':
            x += float(t[i]); i += 1
        elif cmd == 'H':
            x = float(t[i]); i += 1
        elif cmd == 'v':
            y += float(t[i]); i += 1
        elif cmd == 'V':
            y = float(t[i]); i += 1
        else:
            raise ValueError(f'Comando SVG no soportado: {cmd}')
        cur.append((x, y))
    if cur:
        rings.append(cur)
    return rings


def simplify(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    imax, dmax = 0, 0.0
    for k in range(1, len(pts) - 1):
        p = pts[k]
        if length > 1e-9:
            d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length
        else:
            d = math.hypot(p[0] - a[0], p[1] - a[1])
        if d > dmax:
            imax, dmax = k, d
    if dmax > eps:
        return simplify(pts[:imax + 1], eps)[:-1] + simplify(pts[imax:], eps)
    return [a, b]


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'^(la|el|los|las)\s+|,\s*(la|el|los|las)$', '', s.strip())
    return re.sub(r'[^a-z0-9]', '', s)


def main():
    # Fichas de Wikipedia: datos por código INE y por nombre normalizado
    by_ine, by_name = {}, {}
    for f in glob.glob(os.path.join(MD_DIR, '*.md')):
        txt = open(f, encoding='utf-8').read(12000)  # cod_municipio puede ir tras una ficha larga
        name = re.search(r'^# (.+)$', txt, re.M)
        if not name:
            continue

        def num(label):
            m = re.search(r'\*\*' + label + r':\*\*\s*([\d.,]+)', txt)
            if not m:
                return None
            v = m.group(1).replace(',', '.') if label == 'Superficie' else m.group(1).replace('.', '').replace(',', '.')
            try:
                return float(v)
            except ValueError:
                return None

        rec = {'name': name.group(1).strip(), 'alt': num('Altitud'), 'pop': num('Población'), 'km2': num('Superficie')}
        cod = re.search(r'cod_municipio\s*=\s*(\d+)', txt)
        if cod:
            by_ine['37' + cod.group(1).zfill(3)] = rec
        by_name.setdefault(norm(rec['name']), rec)

    # Nombre → INE de referencia (corrige fichas de Wikipedia con el código mal)
    ine_by_name = {}
    for row in json.load(open(INE_JSON, encoding='utf-8')):
        ine_by_name.setdefault(norm(row['Municipio']), str(row['CodMunicipio']))
    for ine, rec in list(by_ine.items()):
        rec['ine'] = ine_by_name.get(norm(rec['name']), ine)

    src = open(SVG, encoding='utf-8').read()
    munis = {}
    for attrs in re.findall(r'<path\s([^>]*)/?>', src, re.S):
        d = re.search(r'\bd="([^"]*)"', attrs).group(1)
        pid = (re.search(r'\bid="([^"]*)"', attrs) or [None, ''])[1]
        label = (re.search(r'inkscape:label="#?([^"]*)"', attrs) or [None, ''])[1]
        if re.match(r'37\d{3}', pid):
            ine = pid[:5]
        else:
            # Enclave: buscar su municipio por la etiqueta ("agallas2" → Agallas)
            slug = re.sub(r'\d+$', '', label or pid).replace('-', ' ').replace('_', ' ')
            slug = ALIAS.get(slug, slug)
            rec = by_name.get(norm(slug))
            ine = rec['ine'] if rec and rec.get('ine') else ine_by_name.get(norm(slug))
        if not ine:
            # Pedanía o trozo sin municipio conocido: se dibuja en gris, sin ficha, para no dejar huecos
            ine = 'x:' + pid
        rings = []
        for ring in parse(d):
            s = simplify(ring, 0.35)
            if len(s) >= 4:
                rings.append([round(v, 1) for p in s for v in p])
        m = munis.setdefault(ine, {'id': ine, 'rings': []})
        m['rings'] += rings

    missing = 0
    for ine, m in munis.items():
        if ine.startswith('x:'):
            m.update(id=None, name=None, alt=None, pop=None, km2=None)
            continue
        info = by_ine.get(ine) or next((r for r in by_ine.values() if r.get('ine') == ine), None)
        if info:
            m.update(name=info['name'], alt=info['alt'], pop=info['pop'], km2=info['km2'])
        else:
            missing += 1
            m.update(name=ine, alt=None, pop=None, km2=None)

    out = sorted(munis.values(), key=lambda m: m['id'] or 'z')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f"relieve.json: {len(out)} municipios, {missing} sin datos, "
          f"{sum(1 for m in out if m['alt'])} con altitud, {sum(1 for m in out if not m['id'])} piezas sin municipio, "
          f"{os.path.getsize(OUT) // 1024} KB")


if __name__ == '__main__':
    main()
