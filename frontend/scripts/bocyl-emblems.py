"""Busca en el BOCyL las aprobaciones de escudo y bandera de los municipios de Salamanca
y las cruza con docs/emblemas-pendientes.csv.

Busca por título ("bandera", "escudo", "símbolos") en tramos de fechas, porque el buscador
corta a 500 resultados. Se queda con las disposiciones que nombran a un municipio de Salamanca:
o el título dice "(Salamanca)", o el organismo es su ayuntamiento y el texto de la disposición
menciona Salamanca.

Salidas:
  docs/emblemas-bocyl.csv       una fila por disposición encontrada

Uso (desde frontend/):  python -I scripts/bocyl-emblems.py
"""
import csv
import html
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MD_DIR = ROOT / "backend/src/SaLLMantino/ragger/script/municipios_md"
DOCS = ROOT / "docs"
BASE = "https://bocyl.jcyl.es/"
UA = "Mozilla/5.0 (infoSalamanca; consulta de símbolos municipales)"
TERMS = ["bandera", "escudo", "símbolos"]
import datetime as dt
TODAY = dt.date.today()
# Un tramo por año. Si el servidor falla con un tramo, se parte en dos (ver search()).
WINDOWS = [(dt.date(y, 1, 1), min(dt.date(y, 12, 31), TODAY)) for y in range(1983, TODAY.year + 1)]
fmt = lambda d: d.strftime("%d/%m/%Y")

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
opener.addheaders = [("User-Agent", UA)]


def fetch(url, data=None):
    body = urllib.parse.urlencode(data).encode("latin-1") if data else None
    for i in range(4):
        try:
            with opener.open(url, body, timeout=60) as r:
                raw = r.read()
            # El BOCyL mezcla páginas en UTF-8 y en Windows-1252
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode("cp1252", errors="replace")
        except Exception:
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"Sin respuesta: {url}")


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"^(la|el|los|las)\s+|,\s*(la|el|los|las)$", "", s.strip())
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def clean(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


# ---------- municipios ----------
towns = {}
for f in MD_DIR.glob("*.md"):
    t = f.read_text(encoding="utf-8")[:6000]
    cod, name = re.search(r"cod_municipio\s*=\s*(\d+)", t), re.search(r"^# (.+)$", t, re.M)
    if cod and name:
        towns["37" + cod.group(1).zfill(3)] = name.group(1).strip()
by_norm = {norm(n): ine for ine, n in towns.items()}
# también "Alberca, La" -> "alberca" (norm ya quita el artículo) y variantes con guion
names_sorted = sorted(by_norm, key=len, reverse=True)


def find_town(text):
    """Devuelve el INE del municipio de Salamanca nombrado tras 'Ayuntamiento de' / 'Entidad Local Menor de'."""
    m = re.search(r"(?:ayuntamiento|municipio|villa|localidad)\s+de\s+([^(.,;]+)", text, re.I)
    # Si el texto dice "Ayuntamiento de X", solo vale X; si no, buscamos el nombre en todo el texto
    candidates = [m.group(1)] if m else [text]
    for c in candidates:
        n = norm(c)
        if n in by_norm:
            return by_norm[n]
        for key in names_sorted:  # el nombre más largo que aparezca como palabra completa
            if re.search(rf"\b{re.escape(key)}\b", n):
                return by_norm[key]
    return None


# ---------- búsqueda ----------
fetch(BASE + "busquedaCampos.do")
items = {}
failed = []


def query(term, d0, d1):
    for attempt in range(3):
        h = fetch(BASE + "busquedaCampos.do", {
            "titulo": term, "fechaPublicacionDesde": fmt(d0), "fechaPublicacionHasta": fmt(d1),
            "page": 0, "resultadosPorPagina": 500, "hiddenAccion": "Buscar", "boton": "Buscar"})
        if re.search(r"total de \d+ resultados", h) or "No se han encontrado" in h:
            return h
        time.sleep(2)
        fetch(BASE + "busquedaCampos.do")  # sesión nueva
    return None


def search(term, d0, d1):
    """Busca en [d0, d1]; si el servidor falla, parte el tramo en dos (hasta tramos de ~1 semana)."""
    h = query(term, d0, d1)
    if h is None:
        if (d1 - d0).days > 7:
            mid = d0 + (d1 - d0) / 2
            return search(term, d0, mid) + search(term, mid + dt.timedelta(days=1), d1)
        failed.append(f"{term} {fmt(d0)}-{fmt(d1)}")
        return []
    return [h]


for term in TERMS:
    n_term = 0
    for d0, d1 in WINDOWS:
      for h in search(term, d0, d1):
        total = re.search(r"total de (\d+) resultados", h)
        n_term += int(total.group(1)) if total else 0
        for li in re.findall(r'<li class="nobullet">(.*?)</li>\s*</ul>\s*</li>', h, re.S):
            date = re.search(r"publicaci\S{1,3}n:</dt>\s*<dd>([^<]+)", li)
            org = re.search(r"Organismo:</dt>\s*<dd[^>]*>([^<]+)", li)
            title = re.search(r"<p>(.*?)</p>", li, re.S)
            pdf = re.search(r"href='(https://bocyl[^']+\.pdf)'", li)
            doc = re.search(r"href='(html/[^']+\.do)'", li)
            if not title:
                continue
            key = pdf.group(1) if pdf else clean(title.group(1))
            items[key] = {"fecha": date.group(1).strip() if date else "", "organismo": clean(org.group(1)) if org else "",
                          "titulo": clean(title.group(1)), "pdf": pdf.group(1) if pdf else "",
                          "html": BASE + doc.group(1) if doc else ""}
        time.sleep(.7)
    print(f"  {term:9}: {n_term} resultados en el BOCyL (1983-{TODAY.year})")
print(f"Disposiciones distintas: {len(items)}")
if failed:
    print(f"  ! Tramos que el BOCyL no devolvió: {', '.join(failed)}")

# ---------- quedarse con Salamanca ----------
rows = []
for it in items.values():
    title, org = it["titulo"], it["organismo"]
    low = norm(title + " " + org)
    if not re.search(r"\b(bandera|escudo|simbolo|simbolos|heraldic)", low):
        continue
    # Los símbolos de entidades locales menores (pedanías) no son los del municipio
    if re.search(r"entidad local menor|junta vecinal|pedania", low):
        continue
    in_title = re.search(r"\(salamanca\)", title, re.I)
    ine = find_town(title) if in_title else None
    if not ine and org.upper().startswith(("AYUNTAMIENTO", "ENTIDAD LOCAL", "JUNTA VECINAL")):
        ine = find_town(org)
        # el nombre puede repetirse en otra provincia: comprobamos en el texto de la disposición
        if ine and it["html"]:
            try:
                txt = clean(fetch(it["html"]))
                if not re.search(r"Salamanca", txt):
                    ine = None
                time.sleep(.5)
            except RuntimeError:
                ine = None
    if not ine:
        continue
    kinds = [k for k, w in (("escudo", r"escudo|heraldic"), ("bandera", r"bandera"), ("símbolos", r"simbolo")) if re.search(w, low)]
    estado = "denegada" if re.search(r"deneg|no se aprueba|desestim", low) else \
             "en trámite" if re.search(r"informaci.n p.blica|exposici.n|inicio|incoaci", low) else "aprobada"
    rows.append({"ine": ine, "municipio": towns[ine], "tipo": "+".join(kinds), "estado": estado, **it})
rows.sort(key=lambda r: (r["ine"], r["fecha"][-4:] + r["fecha"][3:5] + r["fecha"][:2]))

DOCS.mkdir(exist_ok=True)
with open(DOCS / "emblemas-bocyl.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["ine", "municipio", "tipo", "estado", "fecha", "organismo", "titulo", "pdf", "html"])
    w.writeheader()
    w.writerows(rows)
print(f"Disposiciones de municipios de Salamanca: {len(rows)} ({len({r['ine'] for r in rows})} municipios)")

# El cruce con los pendientes (BOCyL + BOE) lo hace scripts/cruce-emblemas.py
