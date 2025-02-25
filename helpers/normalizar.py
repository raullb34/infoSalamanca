import json
from unidecode import unidecode
from bs4 import BeautifulSoup

# 1. Cargar el JSON con los datos de los municipios
with open("codigos.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Crear un diccionario para mapear nombres normalizados a códigos postales
municipios = {}
for entry in data["results"]:
    nombre = entry["municipio"].lower()  # Convertir a minúsculas
    nombre = unidecode(nombre)           # Eliminar tildes y caracteres especiales
    nombre = nombre.replace(" ", "_")    # Reemplazar espacios con _
    cod_ine = str(entry["cod_ine"])      # Usar cod_ine como código postal
    municipios[nombre] = cod_ine

# Mostrar la lista de municipios y sus códigos
print("Lista de municipios y códigos:")
for nombre, codigo in municipios.items():
    print(f"{nombre}: {codigo}")

# 2. Cargar el archivo SVG
with open("Limites_salamanca.Svg", "r", encoding="utf-8") as f:
    svg_content = f.read()

# Parsear el SVG con BeautifulSoup
soup = BeautifulSoup(svg_content, "xml")

# 3. Buscar todos los elementos con id en formato #nombre_del_pueblo
cambios_realizados = []
for element in soup.find_all(attrs={"id": True}):
    old_id = element["id"]
    #print (old_id)   
        # Buscar coincidencia en el diccionario
    if old_id in municipios:
        new_id = municipios[old_id]
        element["id"] = new_id
        cambios_realizados.append((old_id, new_id))

# 4. Mostrar un resumen de los cambios realizados
print("\nResumen de cambios realizados:")
for old_id, new_id in cambios_realizados:
    print(f"ID original: {old_id} -> Nuevo ID: {new_id}")

# 5. Guardar el SVG modificado en un nuevo archivo
with open("mapa_actualizado.svg", "w", encoding="utf-8") as f:
    f.write(str(soup))

print("\nEl archivo SVG ha sido actualizado y guardado como 'mapa_actualizado.svg'.")