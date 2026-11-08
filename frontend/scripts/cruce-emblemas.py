"""Cruza los municipios a los que les falta bandera o escudo con los boletines oficiales.

Entradas (en docs/):
  emblemas-pendientes.csv  lo genera fetch-emblems.mjs
  emblemas-bocyl.csv       lo genera bocyl-emblems.py
  emblemas-boe.csv         lo genera boe-emblems.py

Salidas (en docs/):
  emblemas-oficial-sin-imagen.csv  tienen símbolo aprobado en un boletín, pero no tenemos la imagen.
                                   El boletín suele traer la descripción heráldica, así que se puede
                                   pedir al ayuntamiento o dibujar a partir del texto.
  emblemas-sin-oficial.csv         ningún boletín recoge su aprobación: buscar en la web y redes del
                                   ayuntamiento, carteles de fiestas, Diputación, o confirmar que no lo tiene.

Uso (desde frontend/):  python -I scripts/cruce-emblemas.py
"""
import csv
from collections import Counter
from pathlib import Path

DOCS = Path(__file__).resolve().parents[2] / "docs"


def read(name):
    with open(DOCS / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


official = {}  # (ine, "bandera"/"escudo") -> lista de "BOE 1965: url"
for source, rows in (("BOE", read("emblemas-boe.csv")), ("BOCyL", read("emblemas-bocyl.csv"))):
    for r in rows:
        if r["estado"] == "denegada":
            continue
        for kind in ("bandera", "escudo"):
            if kind in r["tipo"] or "símbolos" in r["tipo"]:
                official.setdefault((r["ine"], kind), []).append(f'{source} {r["fecha"]}: {r["pdf"] or r["html"]}')

with_official, without = [], []
for p in read("emblemas-pendientes.csv"):
    for kind in ("bandera", "escudo"):
        if p[kind] != "falta":
            continue
        refs = official.get((p["ine"], kind), [])
        base = {"ine": p["ine"], "municipio": p["municipio"], "falta": kind}
        if refs:
            with_official.append({**base, "boletines": " | ".join(refs),
                                  "que_hacer": "pedir la imagen al ayuntamiento o dibujarla con la descripción del boletín"})
        else:
            wiki_no = kind == "bandera" and p["la_ficha_de_wikipedia_dice"] == "bandera = no"
            without.append({**base,
                            "wikipedia": "dice que no tiene" if wiki_no else "",
                            "busqueda": f'"{p["municipio"]}" Salamanca {kind} ayuntamiento',
                            "donde_buscar": "web y Facebook del ayuntamiento; carteles y programas de fiestas; "
                                            "Diputación de Salamanca; BOP de Salamanca",
                            "resultado": "", "fuente_encontrada": ""})

fields_a = ["ine", "municipio", "falta", "boletines", "que_hacer"]
fields_b = ["ine", "municipio", "falta", "wikipedia", "busqueda", "donde_buscar", "resultado", "fuente_encontrada"]
for name, rows, fields in (("emblemas-oficial-sin-imagen.csv", with_official, fields_a),
                           ("emblemas-sin-oficial.csv", without, fields_b)):
    with open(DOCS / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

print(f"Con símbolo oficial pero sin imagen: {len(with_official)}  {dict(Counter(r['falta'] for r in with_official))}")
print(f"Sin símbolo oficial en BOE ni BOCyL: {len(without)}  {dict(Counter(r['falta'] for r in without))}")
print(f"  de ellos, Wikipedia confirma 'sin bandera': {sum(1 for r in without if r['wikipedia'])}")
both = Counter(r["ine"] for r in without)
print(f"  municipios sin bandera NI escudo oficial: {sum(1 for v in both.values() if v == 2)}")
