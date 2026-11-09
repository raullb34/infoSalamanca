"""Genera con la API de imágenes de OpenAI los iconos de la línea del tiempo (data/historiaProvincia.js).

Mismo nombre que en HistoryIcons.vue, mismo estilo para todos y paleta de la línea del tiempo.
Salida: public/assets/history-icons/<nombre>.png (256 px, fondo transparente).
Necesita OPENAI_API_KEY en el entorno. Uso (desde frontend/):
    python -I scripts/gen-history-icons.py            # genera los que falten
    python -I scripts/gen-history-icons.py castro     # regenera solo esos
"""
import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "history-icons"
OUT.mkdir(parents=True, exist_ok=True)
KEY = os.environ.get("OPENAI_API_KEY") or os.popen(
    "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('OPENAI_API_KEY','User')\"").read().strip()
MODELS = ["gpt-image-1.5", "gpt-image-1"]

STYLE = ("Flat illustrated icon for a history timeline, single centered subject, three-quarter view, "
         "bold clean shapes with a thick dark-brown outline (#5a3b1e), limited warm palette: golden sandstone #e2b15b, "
         "pale cream #fbeccb, terracotta #c46b3a, plus small touches of muted blue only for water or sky details. "
         "Subtle stone texture like the golden Villamayor sandstone of Salamanca. Elegant and dignified like a museum "
         "infographic, not childish or cartoonish: no faces, no smiles, no eyes on objects. Consistent with a set. "
         "No text, no letters, no numbers, no frame, no clouds, no sky, no background scene, no ground shadow. "
         "Transparent background.")

ICONS = {
    "castro": "an ancient Vettonian 'verraco': a rough, archaic carved granite statue of a boar standing on a stone base, "
              "with a round Iron Age stone hut with a conical thatched roof behind it",
    "espada": "an ancient Carthaginian sword crossed with a round bronze shield",
    "puente": "the Roman bridge of Salamanca: a long stone bridge with several round arches over a small river",
    "castillo": "a sturdy medieval Castilian castle keep with battlements and a small flag",
    "muralla": "a stretch of medieval city walls with a fortified gate and two towers, as in Ciudad Rodrigo",
    "libro": "an open medieval manuscript book with illuminated pages and a ribbon bookmark, symbol of an ancient university",
    "corona": "a ducal coronet with strawberry leaves and pearls, resting on a small cushion",
    "pluma": "a goose-feather quill pen dipped in a small inkwell, next to a rolled parchment",
    "catedral": "a Gothic and plateresque cathedral bell tower with a dome on top",
    "vela": "a single lit wax candle on a simple brass candlestick, with a soft warm flame, spiritual and serene",
    "plaza": "a Baroque square facade: arcaded ground floor with round arches, balconies above and a central clock pediment",
    "canon": "a Napoleonic-era field cannon on a wooden carriage with a small stack of cannonballs",
    "casa": "a traditional mountain village house with half-timbered upper floor, wooden balcony and tiled roof",
    "presa": "a tall concrete arch dam in a deep granite river canyon with water flowing below",
    "estrella": "a golden star medal with a ribbon, above a tiny silhouette of historic towers, symbol of world heritage",
    "mascaras": "a pair of theatre masks, comedy and tragedy, with a festive ribbon",
}


def generate(name):
    prompt = f"{ICONS[name]}. {STYLE}"
    last = None
    for model in MODELS:
        body = {"model": model, "prompt": prompt, "size": "1024x1024", "n": 1,
                "background": "transparent", "output_format": "png", "quality": "medium"}
        req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
        try:
            data = json.load(urllib.request.urlopen(req, timeout=300))
            raw = base64.b64decode(data["data"][0]["b64_json"])
            img = Image.open(io.BytesIO(raw)).convert("RGBA")
            img = img.crop(img.getbbox() or (0, 0, img.width, img.height))
            canvas = Image.new("RGBA", (max(img.size),) * 2, (0, 0, 0, 0))
            canvas.paste(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2))
            canvas.resize((256, 256), Image.LANCZOS).save(OUT / f"{name}.png", optimize=True)
            return f"✓ {name} ({model})"
        except urllib.error.HTTPError as e:
            last = f"{e.code} {e.read()[:200]!r}"
        except Exception as e:  # noqa: BLE001
            last = repr(e)
    return f"✗ {name}: {last}"


if not KEY:
    sys.exit("Falta OPENAI_API_KEY")
names = sys.argv[1:] or [n for n in ICONS if not (OUT / f"{n}.png").exists()]
with ThreadPoolExecutor(4) as ex:
    for line in ex.map(generate, names):
        print(line, flush=True)
