"""Reduce el peso de los PNG de banderas y escudos (public/assets/flags y shields).

Ancho máximo de 400 px y paleta de 256 colores con transparencia. Las banderas y los escudos
son de colores planos, así que la pérdida no se nota y el archivo baja mucho.
Solo toca los PNG nuevos o modificados respecto a git, para no recomprimir lo ya revisado.

Uso (desde frontend/):  python -I scripts/optimize-emblems.py
"""
import subprocess
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"


def changed_pngs():
    out = subprocess.run(
        ["git", "status", "--porcelain", "-z", "--untracked-files=all", "--", "flags", "shields"],
        cwd=ASSETS, capture_output=True, encoding="utf-8", check=True).stdout
    for entry in out.split("\0"):
        if entry and entry[3:].lower().endswith(".png"):
            # git devuelve la ruta relativa a la raíz del repo
            yield ASSETS.parents[2] / entry[3:]


before = after = 0
for path in changed_pngs():
    size0 = path.stat().st_size
    img = Image.open(path).convert("RGBA")
    if img.width > 400:
        img = img.resize((400, round(img.height * 400 / img.width)), Image.LANCZOS)
    pal = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    pal.save(path, optimize=True)
    before += size0
    after += path.stat().st_size

print(f"PNG optimizados: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")
