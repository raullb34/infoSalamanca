"""Corrige los id de public/Limites_salamanca.svg para que todos los municipios usen su código INE.

El mapa 2D busca cada municipio por id ("37317", o "37317_2" para un segundo trozo). 19 municipios
tenían como id su nombre ("tarazona_de_guare__a") y no se podían colorear, seleccionar ni situar en las
rutas del bibliobús; y el trozo de Beleña tenía el código de Bañobárez. Las pedanías sin municipio claro
(Porteros, Olleros...) se dejan como están.

Uso (desde frontend/):  python -I scripts/fix-svg-ids.py         muestra los cambios
                        python -I scripts/fix-svg-ids.py --write  los guarda
"""
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, '..', 'public', 'Limites_salamanca.svg')
INE_JSON = os.path.join(HERE, '..', '..', 'backend', 'src', 'helpers', 'ine-codigopostal.json')

# Erratas en las etiquetas del SVG → nombre oficial
ALIAS = {
    'la zarza de pumadera': 'La Zarza de Pumareda',
    'valdefuentes de san agustin': 'Valdefuentes de Sangusín',
}
# Códigos mal puestos: (id actual, etiqueta) → código correcto
WRONG_CODE = {('37039', 'beleña'): '37047'}


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    m = re.match(r'^(.*?)\s*,\s*(la|el|los|las)$', s)  # "Peña, La" → "la peña"
    if m:
        s = f'{m.group(2)} {m.group(1)}'
    return re.sub(r'[^a-z0-9]', '', s)


def main(write):
    code_of = {}
    for row in json.load(open(INE_JSON, encoding='utf-8')):
        n = norm(row['Municipio'])
        code_of.setdefault(n, str(row['CodMunicipio']))
        # También sin artículo: la etiqueta "casas_del_conde" es "Casas del Conde, Las"
        code_of.setdefault(re.sub(r'^(las|los|la|el)(?=[a-z])', '', n), str(row['CodMunicipio']))

    src = open(SVG, encoding='utf-8').read()
    tags = list(re.finditer(r'<path\b[^>]*>', src))
    used = {re.search(r'\bid="([^"]*)"', t.group(0)).group(1) for t in tags}

    def free_id(code):
        if code not in used:
            return code
        n = 2
        while f'{code}_{n}' in used:
            n += 1
        return f'{code}_{n}'

    changes = []
    for t in tags:
        tag = t.group(0)
        pid = re.search(r'\bid="([^"]*)"', tag).group(1)
        label = (re.search(r'inkscape:label="#?([^"]*)"', tag) or [None, ''])[1]
        new = None
        if (pid, label) in WRONG_CODE:
            new = free_id(WRONG_CODE[(pid, label)])
        elif not re.match(r'^37\d{3}(_\d+)?$', pid):
            # Nombre desde la etiqueta (o el id: "__" era una ñ), sin el número de trozo ("agallas2")
            name = label or pid.replace('__', 'ñ')
            name = re.sub(r'\d+$', '', name).replace('_', ' ').replace('-', ' ').strip()
            name = ALIAS.get(name, name)
            code = code_of.get(norm(name))
            if code:
                new = free_id(code)
        if new:
            used.discard(pid)
            used.add(new)
            changes.append((t.start(), t.end(), tag, re.sub(r'\bid="[^"]*"', f'id="{new}"', tag, count=1), pid, new, label))

    for *_, old_id, new_id, label in changes:
        print(f'{old_id:32} -> {new_id:9} ({label})'.encode('ascii', 'replace').decode())
    print(f'{len(changes)} id corregidos')
    if write and changes:
        out = src
        for start, end, tag, new_tag, *_ in reversed(changes):
            assert out[start:end] == tag
            out = out[:start] + new_tag + out[end:]
        open(SVG, 'w', encoding='utf-8', newline='').write(out)
        print('Guardado')


if __name__ == '__main__':
    main('--write' in sys.argv)
