"""Busca en el BOE (1960-hoy) los decretos que aprueban escudos y banderas de municipios de Salamanca.

Antes de 1983 no existía la Junta: los escudos se autorizaban por decreto del Gobierno, publicado
en el BOE ("...se autoriza al Ayuntamiento de X, de la provincia de Salamanca, para adoptar su
escudo heráldico municipal"). El buscador del BOE solo cubre desde 1960.

Salida: docs/emblemas-boe.csv (mismas columnas que emblemas-bocyl.csv)
Uso (desde frontend/):  python -I scripts/boe-emblems.py
"""
import csv
import html
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MD_DIR = ROOT / "backend/src/SaLLMantino/ragger/script/municipios_md"
UA = "Mozilla/5.0 (infoSalamanca; consulta de símbolos municipales)"
QUERIES = ["escudo Salamanca", "bandera Salamanca", "heráldico Salamanca", "símbolos Salamanca"]


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"^(la|el|los|las)\s+|,\s*(la|el|los|las)$", "", s.strip())
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def clean(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


towns = {}
for f in MD_DIR.glob("*.md"):
    t = f.read_text(encoding="utf-8")[:6000]
    cod, name = re.search(r"cod_municipio\s*=\s*(\d+)", t), re.search(r"^# (.+)$", t, re.M)
    if cod and name:
        towns["37" + cod.group(1).zfill(3)] = name.group(1).strip()
by_norm = {norm(n): ine for ine, n in towns.items()}


def _bare(s):
    return re.sub(r"^(la|el|los|las)\s+", "", s.strip().lower())


# El BOE devuelve a veces las letras con tilde como "�": en el patrón, cada letra con tilde
# (o ñ) del nombre acepta cualquier carácter.
town_patterns = [(ine, re.compile("".join(re.escape(c) if c.isascii() else "." for c in _bare(n))))
                 for ine, n in towns.items()]


ALIASES = {"arabayona": "Arabayona de Mógica", "nava de sotroval": "Nava de Sotrobal",
           "palacios rubios": "Palaciosrubios", "tarazona de guadena": "Tarazona de Guareña",
           "villamayor de armuna": "Villamayor"}


def town_from(name):
    alias = ALIASES.get(re.sub(r"[^a-z ]", "", norm(name).replace("�", "n")))
    if alias:
        return by_norm.get(norm(alias))
    if norm(name) in by_norm:
        return by_norm[norm(name)]
    cand = _bare(name)
    for ine, pat in town_patterns:
        if pat.fullmatch(cand):
            return ine
    return None


def search(text):
    params = [("campo[0]", "ORIS")] + [(f"dato[0][{k}]", k) for k in "12345T"] + [
        ("operador[0]", "and"), ("campo[1]", "TITULOS"), ("dato[1]", text), ("operador[1]", "and"),
        ("campo[2]", "DEM"), ("dato[2]", ""), ("operador[2]", "and"), ("campo[3]", "DOC"), ("dato[3]", ""),
        ("operador[3]", "and"), ("campo[4]", "NBOS"), ("dato[4]", ""), ("operador[4]", "and"),
        ("campo[5]", "NOF"), ("dato[5]", ""), ("operador[6]", "and"), ("campo[6]", "FPU"),
        ("dato[6][0]", ""), ("dato[6][1]", ""), ("page_hits", "500"), ("sort_field[0]", "FPU"),
        ("sort_order[0]", "asc"), ("sort_field[1]", "ORI"), ("sort_order[1]", "asc"),
        ("sort_field[2]", "REF"), ("sort_order[2]", "asc"), ("accion", "Buscar")]
    req = urllib.request.Request("https://www.boe.es/buscar/boe.php?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": UA})
    raw = urllib.request.urlopen(req, timeout=60).read()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


rows = {}
for q in QUERIES:
    h = search(q)
    total = re.search(r"Resultados \d+ a \d+ de (\d+)", h)
    print(f"  BOE «{q}»: {total.group(1) if total else 0} resultados")
    for li in re.findall(r'<li class="resultado-busqueda">(.*?)</li>\s*</ul>\s*</li>', h, re.S):
        ps = re.findall(r"<p[^>]*>(.*?)</p>", li, re.S)
        ref = re.search(r"id=(BOE-[A-Z]-\d{4}-\d+)", li)
        if len(ps) < 3 or not ref:
            continue
        title = clean(ps[2])
        low = norm(title)
        if "salamanca" not in low or not re.search(r"\b(escudo|bandera|heraldic|simbolo)", low):
            continue
        if re.search(r"entidad local menor|pedania", low):
            continue
        # "Ayuntamiento de X, de la provincia..." (decretos) o "escudo heráldico municipal de X." /
        # "bandera del municipio de X." (resoluciones de la Diputación, años 90)
        m = re.search(r"(?:Ayuntamiento|municipio|municipal|villa|localidad)\s+de\s+([^,(.]+?)(?:,| de la provincia| \(|\.|$)", title, re.I)
        ine = town_from(m.group(1)) if m else None
        if not ine:
            print(f"    ? sin municipio reconocido: {title[-150:]}")
            continue
        kinds = [k for k, w in (("escudo", r"escudo|heraldic"), ("bandera", r"bandera")) if re.search(w, low)]
        date = re.search(r"de (\d{2}/\d{2}/\d{4})", clean(ps[1]))
        estado = "denegada" if re.search(r"deneg|desestim", low) else "aprobada"
        rows[ref.group(1)] = {"ine": ine, "municipio": towns[ine], "tipo": "+".join(kinds), "estado": estado,
                              "fecha": date.group(1) if date else "", "organismo": clean(ps[0]), "titulo": title,
                              "pdf": f"https://www.boe.es/buscar/doc.php?id={ref.group(1)}", "html": ""}
    time.sleep(1)

out = sorted(rows.values(), key=lambda r: (r["ine"], r["fecha"][-4:]))
with open(ROOT / "docs" / "emblemas-boe.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["ine", "municipio", "tipo", "estado", "fecha", "organismo", "titulo", "pdf", "html"])
    w.writeheader()
    w.writerows(out)
print(f"Decretos de municipios de Salamanca en el BOE: {len(out)} ({len({r['ine'] for r in out})} municipios)")
