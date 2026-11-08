"""Dibuja banderas municipales a partir de su descripción oficial (BOE/BOCyL) y del escudo que ya tenemos.

Solo para banderas de diseño simple (colores lisos, franjas, diagonales) con el escudo al centro:
lo que dice el boletín se traduce literalmente a geometría, sin interpretar. Las que admiten
varias lecturas (p. ej. "dos piras apoyadas en el asta") se dejan sin dibujar.

Escribe public/assets/flags/<ine>_<nombre>_bandera.png y su crédito en emblems-credits.json.
Uso (desde frontend/):  python -I scripts/draw-flags.py
"""
import datetime
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows no es UTF-8
ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
W = 600  # ancho de salida

# Colores habituales en vexilología municipal española
C = {"rojo": "#C8102E", "blanco": "#FFFFFF", "verde": "#007A33", "azul": "#0033A0",
     "celeste": "#6CACE4", "amarillo": "#FCD116"}

FLAGS = [
    {"ine": "37014", "nombre": "aldeadávila de la ribera", "escudo": "37014_aldeadavila_de_la_ribera_shield.png",
     "ratio": 2 / 3, "fondo": ("diagonal", "verde", "azul"), "escudo_alto": 1 / 2,
     "boletin": "https://bocyl.jcyl.es/boletines/2025/09/22/pdf/BOCYL-D-22092025-42.pdf",
     "texto": "Paño rectangular cuya longitud es una vez y media su altura, dividido por una diagonal del ángulo inferior del asta "
              "al superior del vuelo; mitad del asta verde y la otra azul; en el centro, el escudo municipal de 1/2 de la altura."},
    {"ine": "37134", "nombre": "fresno alhándiga", "escudo": "37134_fresno alhándiga_shield.png",
     "ratio": 2 / 3, "fondo": ("cuartelada", "rojo", "blanco"), "escudo_alto": 1 / 2,
     "boletin": "https://bocyl.jcyl.es/boletines/2023/02/09/pdf/BOCYL-D-09022023-29.pdf",
     "texto": "Bandera rectangular, de proporción 2:3, cuartelada de rojo y blanco. Al centro, el escudo municipal en sus colores."},
    {"ine": "37203", "nombre": "monterrubio de la sierra", "escudo": "37203_monterrubio de la sierra_shield.png",
     "ratio": 2 / 3, "fondo": ("franjas", [("amarillo", 1 / 8), ("verde", 1 / 8), ("blanco", 1 / 2), ("verde", 1 / 8), ("amarillo", 1 / 8)]),
     "escudo_alto": 1 / 2,
     "boletin": "https://bocyl.jcyl.es/boletines/2026/09/02/pdf/BOCYL-D-02092026-170-10.pdf",
     "texto": "Bandera rectangular 2:3 de cinco franjas horizontales (1/8, 1/8, 1/2, 1/8, 1/8): amarillo dorado, verde, blanco, verde "
              "y amarillo dorado. Al centro, el escudo municipal en sus colores."},
    {"ine": "37280", "nombre": "sanchón de la ribera", "escudo": "37280_sanchón de la ribera_shield.png",
     "ratio": 2 / 3, "fondo": ("liso", "azul"), "escudo_alto": 1 / 2,
     "boletin": "https://bocyl.jcyl.es/boletines/2026/05/12/pdf/BOCYL-D-12052026-88-31.pdf",
     "texto": "Bandera rectangular, de proporciones 2:3, de color azul. Al centro, el escudo municipal en sus colores."},
    {"ine": "37377", "nombre": "yecla de yeltes", "escudo": "37377_yecla_de_yeltes_shield.png",
     "ratio": 2 / 3, "fondo": ("liso", "celeste"), "escudo_alto": 1 / 2,
     "boletin": "https://bocyl.jcyl.es/boletines/2006/04/10/pdf/BOCYL-D-10042006-34.pdf",
     "texto": "Bandera rectangular de proporciones 2:3, azul celeste cargada del Escudo Heráldico de Yecla de Yeltes."},
]

credits = json.loads((ASSETS / "emblems-credits.json").read_text(encoding="utf-8"))

for f in FLAGS:
    h = round(W * f["ratio"])
    img = Image.new("RGBA", (W, h), C["blanco"])
    d = ImageDraw.Draw(img)
    kind = f["fondo"][0]
    if kind == "liso":
        d.rectangle([0, 0, W, h], fill=C[f["fondo"][1]])
    elif kind == "diagonal":  # del ángulo inferior del asta al superior del vuelo
        d.polygon([(0, 0), (W, 0), (0, h)], fill=C[f["fondo"][1]])   # mitad del asta
        d.polygon([(W, 0), (W, h), (0, h)], fill=C[f["fondo"][2]])   # mitad del vuelo
    elif kind == "cuartelada":  # 1.º y 4.º del primer color, 2.º y 3.º del segundo
        a, b = C[f["fondo"][1]], C[f["fondo"][2]]
        d.rectangle([0, 0, W // 2, h // 2], fill=a); d.rectangle([W // 2, 0, W, h // 2], fill=b)
        d.rectangle([0, h // 2, W // 2, h], fill=b); d.rectangle([W // 2, h // 2, W, h], fill=a)
    elif kind == "franjas":
        y = 0.0
        for color, frac in f["fondo"][1]:
            d.rectangle([0, round(y), W, round(y + frac * h)], fill=C[color]); y += frac * h

    shield = Image.open(ASSETS / "shields" / f["escudo"]).convert("RGBA")
    sh = round(h * f["escudo_alto"])
    sw = round(shield.width * sh / shield.height)
    shield = shield.resize((sw, sh), Image.LANCZOS)
    img.alpha_composite(shield, ((W - sw) // 2, (h - sh) // 2))

    name = f'{f["ine"]}_{f["nombre"]}_bandera.png'
    img.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(ASSETS / "flags" / name, optimize=True)

    esc = credits.get(f["ine"], {}).get("escudo", {})
    credits.setdefault(f["ine"], {})["bandera"] = {
        "archivo": name,
        "commons": f["boletin"],
        "licencia": esc.get("licencia") or "sin licencia indicada",
        "autor": f'infoSalamanca, según la descripción oficial; escudo: {esc.get("autor", "desconocido")}',
        "fuente": "dibujada a partir de la descripción del boletín oficial",
        "descripcion_oficial": f["texto"],
        "oficial": "sí (boletín citado)",
        "fecha": datetime.date.today().isoformat(),
    }
    print("✓", name)

(ASSETS / "emblems-credits.json").write_text(json.dumps(credits, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
