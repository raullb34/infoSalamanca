import os
import re
import time
import requests
import wikitextparser as wtp
from bs4 import BeautifulSoup

BASE_API_URL = "https://es.wikipedia.org/w/api.php"
LISTA_URL = "https://es.wikipedia.org/wiki/Anexo:Municipios_de_la_provincia_de_Salamanca"
OUTPUT_DIR = "municipios_md"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def slugify(nombre):
    return re.sub(r'\W+', '_', nombre.strip())

def obtener_lista_municipios():
    r = requests.get(LISTA_URL, headers=HEADERS)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    tabla = soup.find("table", class_="wikitable")
    municipios = []

    for fila in tabla.find_all("tr")[1:]:
        celdas = fila.find_all("td")
        if len(celdas) < 7:
            continue
        enlace = celdas[0].find("a")
        if not enlace or not enlace.get("href", "").startswith("/wiki/"):
            continue

        nombre = enlace.text.strip()
        superficie = celdas[1].text.strip()
        poblacion = celdas[2].text.strip()
        altitud = celdas[6].text.strip()
        municipios.append({
            "nombre": nombre,
            "superficie": superficie,
            "poblacion": poblacion,
            "altitud": altitud
        })

    return municipios

def obtener_wikitexto(titulo):
    params = {
        "action": "query",
        "prop": "revisions",
        "titles": titulo,
        "rvslots": "main",
        "rvprop": "content",
        "format": "json",
        "formatversion": 2
    }
    response = requests.get(BASE_API_URL, params=params, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    try:
        return data['query']['pages'][0]['revisions'][0]['slots']['main']['content']
    except:
        return ""

def limpiar_wikitexto(wikitexto):
    parsed = wtp.parse(wikitexto)
    secciones = parsed.sections
    texto = []

    secciones_a_omitir = {
        "enlaces externos", "referencias", "véase también",
        "administración y política", "transportes", "núcleos de población",
        "demografía", "geografía humana"
    }

    for sec in secciones:
        titulo = sec.title
        titulo_limpio = titulo.replace('=', '').strip() if titulo else ''
        if titulo_limpio.lower() in secciones_a_omitir:
            continue
        if titulo:
            nivel = titulo.count('=') // 2
            texto.append(f"{'#' * (nivel + 2)} {titulo_limpio}")
        contenido = sec.string.strip().replace(titulo or '', '').strip()
        if contenido:
            texto.append(contenido)

    return "\n\n".join(texto)

def guardar_markdown(municipio, contenido):
    nombre_archivo = slugify(municipio["nombre"]) + ".md"
    ruta = os.path.join(OUTPUT_DIR, nombre_archivo)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(f"# {municipio['nombre']}\n\n")
        f.write(f"**Superficie:** {municipio['superficie']} km²  \n")
        f.write(f"**Población:** {municipio['poblacion']} hab.  \n")
        f.write(f"**Altitud:** {municipio['altitud']} msnm  \n\n")
        f.write(contenido or "Contenido no disponible.")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    municipios = obtener_lista_municipios()

    for m in municipios:
        print(f"Procesando: {m['nombre']}")
        texto_wiki = obtener_wikitexto(m["nombre"])
        contenido_limpio = limpiar_wikitexto(texto_wiki)
        guardar_markdown(m, contenido_limpio)
        time.sleep(0.5)

    print(f"\n✅ Generados {len(municipios)} archivos en '{OUTPUT_DIR}'.")

if __name__ == "__main__":
    main()
