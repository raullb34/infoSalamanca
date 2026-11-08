"""Genera public/data/comarcas.json: { "37001": "Campo de Salamanca", ... }

Sale del campo "comarca" de las fichas de Wikipedia (municipios_md). Se usa para ordenar y nombrar
listas por zona (por ejemplo, las rutas del bibliobús, cuyos números se repiten entre bibliobuses).

Uso (desde frontend/):  python -I scripts/build-comarcas.py
"""
import glob
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
MD_DIR = os.path.join(HERE, '..', '..', 'backend', 'src', 'SaLLMantino', 'ragger', 'script', 'municipios_md')
INE_JSON = os.path.join(HERE, '..', '..', 'backend', 'src', 'helpers', 'ine-codigopostal.json')
OUT = os.path.join(HERE, '..', 'public', 'data', 'comarcas.json')

# Variantes de escritura en Wikipedia → nombre único
ALIASES = {
    'S.ª de Francia-Quilamas': 'Sierra de Francia-Quilamas',
    'Sª de Francia-Quilamas': 'Sierra de Francia-Quilamas',
    'Vitigudino': 'Tierra de Vitigudino',
    'Comarca de Vitigudino': 'Tierra de Vitigudino',
    'Salvatierra (Guijuelo)': 'Salvatierra',
}


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))


def clean(value):
    v = re.sub(r'<ref[^>]*>.*?</ref>|<ref[^>]*/>', '', value)
    v = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', v)
    v = re.sub(r'\{\{[^}]*\}\}|<[^>]+>', '', v).strip()
    return ALIASES.get(v, v)


def main():
    ine_by_name = {}
    for row in json.load(open(INE_JSON, encoding='utf-8')):
        ine_by_name.setdefault(norm(row['Municipio']), str(row['CodMunicipio']))

    out = {}
    for f in sorted(glob.glob(os.path.join(MD_DIR, '*.md'))):
        txt = open(f, encoding='utf-8').read(15000)
        name = re.search(r'^# (.+)$', txt, re.M)
        cod = re.search(r'cod_municipio\s*=\s*(\d+)', txt)
        comarca = re.search(r'\|\s*comarca\s*=\s*([^\n]*)', txt)
        if not (name and cod and comarca and clean(comarca.group(1))):
            continue
        # Código INE de referencia por nombre (Wikipedia a veces lo trae mal)
        ine = ine_by_name.get(norm(name.group(1)), '37' + cod.group(1).zfill(3))
        out[ine] = clean(comarca.group(1))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dict(sorted(out.items())), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'comarcas.json: {len(out)} municipios, {len(set(out.values()))} comarcas')


if __name__ == '__main__':
    main()
