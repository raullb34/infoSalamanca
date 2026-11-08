"""Genera miniaturas ligeras de banderas y escudos para la ficha del municipio.

Algunos escudos SVG pesan hasta 3 MB y tardan en descargarse y dibujarse, aunque en la ficha
se ven a 80 px. Este script crea public/assets/emblems-thumbs/<ine>-<bandera|escudo>.webp
(máximo 480x320 px). build-emblems-manifest.mjs las añade a emblems.json como "thumb".
El archivo original se mantiene y es el que se acredita (autor y licencia no cambian).

- PNG/JPG: se reducen con Pillow.
- SVG: se dibujan con el Chrome de Playwright (pip install playwright).

Solo regenera las miniaturas que faltan o cuyo original es más reciente.

Uso (desde frontend/):
    node scripts/build-emblems-manifest.mjs
    python -I scripts/build-emblem-thumbs.py
    node scripts/build-emblems-manifest.mjs     # para que recoja las miniaturas
"""
import base64
import io
import json
import sys
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public"
OUT = ROOT / "assets" / "emblems-thumbs"
MAX_W, MAX_H = 480, 320
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def todo():
    manifest = json.loads((ROOT / "assets" / "emblems.json").read_text(encoding="utf-8"))
    for ine, entry in manifest.items():
        for kind in ("bandera", "escudo"):
            url = (entry.get(kind) or {}).get("url", "")
            if not url.startswith("/"):
                continue  # enlazada a Commons: no hay fichero local
            src = ROOT / urllib.parse.unquote(url).lstrip("/")
            dst = OUT / f"{ine}-{kind}.webp"
            if src.exists() and (not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime):
                yield src, dst


def save(img, dst):
    img = img.convert("RGBA")
    img.thumbnail((MAX_W, MAX_H), Image.LANCZOS)
    img.save(dst, "WEBP", quality=88, method=6)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = list(todo())
    svgs = [(s, d) for s, d in jobs if s.suffix.lower() == ".svg"]
    rasters = [(s, d) for s, d in jobs if s.suffix.lower() != ".svg"]

    for src, dst in rasters:
        save(Image.open(src), dst)

    if svgs:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(executable_path=CHROME)
            except Exception:
                browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1000, "height": 800}, device_scale_factor=1)
            failed = []
            for src, dst in svgs:
                # El SVG va incrustado como data: (una página en blanco no puede cargar file://).
                # Se dibuja al doble y luego se reduce, para que los bordes salgan finos.
                data = base64.b64encode(src.read_bytes()).decode("ascii")
                page.set_content(
                    f'<html><body style="margin:0;background:transparent">'
                    f'<img id="i" src="data:image/svg+xml;base64,{data}" style="display:block;height:{MAX_H * 2}px;width:auto;max-width:{MAX_W * 2}px;object-fit:contain">'
                    f"</body></html>"
                )
                page.wait_for_function("document.getElementById('i').complete")
                if not page.evaluate("document.getElementById('i').naturalWidth"):
                    failed.append(src.name)  # SVG que el navegador no sabe dibujar: no guardar basura
                    continue
                png = page.locator("#i").screenshot(omit_background=True)
                save(Image.open(io.BytesIO(png)), dst)
            if failed:
                print(f"SVG que no se pudieron dibujar ({len(failed)}): {', '.join(failed)}")
            browser.close()

    total = sum(f.stat().st_size for f in OUT.glob("*.webp"))
    print(f"Miniaturas nuevas: {len(jobs)} ({len(svgs)} SVG, {len(rasters)} PNG/JPG). "
          f"Total en emblems-thumbs: {len(list(OUT.glob('*.webp')))} archivos, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
