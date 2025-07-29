import os
import json

# Paths
SHIELDS_DIR = os.path.dirname(os.path.abspath(__file__))
INE_JSON = os.path.abspath(os.path.join(SHIELDS_DIR, '../../../backend/src/helpers/ine-codigopostal.json'))

# Normaliza el nombre del municipio para el nombre de archivo
import re
def normalize_name(name):
    name = name.strip().lower()
    name = re.sub(r',', '', name)
    name = name.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
    name = re.sub(r'\s+', '_', name)
    return name

# Cargar INE mapping municipio normalizado -> cod_ine
with open(INE_JSON, encoding='utf-8') as f:
    ine_data = json.load(f)

municipio_to_ine = {}
for entry in ine_data:
    norm = normalize_name(entry['Municipio'])
    # Si hay duplicados, se queda el primero (puedes ajustar si quieres preferir otro)
    if norm not in municipio_to_ine:
        municipio_to_ine[norm] = str(entry['CodMunicipio'])

# Renombrar archivos
renombrados = []
no_encontrados = []
for fname in os.listdir(SHIELDS_DIR):
    if fname.endswith('_shield.svg'):
        # Si ya tiene el INE delante, saltar
        match = re.match(r'^(\d{5})_([ a-záéíóúñ]+)_shield\.svg$', fname, re.IGNORECASE)
        if match:
            continue
        # Obtener nombre base sin _shield.svg
        nombre_archivo = fname[:-11]
        # Si empieza por INE_, quitarlo para evitar doble INE
        nombre_archivo = re.sub(r'^\d{5}_', '', nombre_archivo)
        # Buscar el INE por el nombre del municipio (quitando guiones bajos y normalizando)
        nombre_sin_articulo = nombre_archivo.replace('_', ' ').strip().lower()
        nombre_normalizado = normalize_name(nombre_sin_articulo)
        ine = municipio_to_ine.get(nombre_normalizado)
        # Si no se encuentra, probar quitando el primer artículo (el, la, los, las)
        if not ine:
            palabras = nombre_sin_articulo.split()
            articulos = ['el', 'la', 'los', 'las']
            if palabras[0] in articulos and len(palabras) > 1:
                # Buscar sin el artículo
                nombre_sin_articulo2 = ' '.join(palabras[1:])
                nombre_normalizado2 = normalize_name(nombre_sin_articulo2)
                ine = municipio_to_ine.get(nombre_normalizado2)
                # Si sigue sin encontrarse, buscar con el artículo al final, separado por coma
                if not ine:
                    nombre_articulo_final = nombre_sin_articulo2 + ', ' + palabras[0]
                    nombre_normalizado3 = normalize_name(nombre_articulo_final)
                    ine = municipio_to_ine.get(nombre_normalizado3)
        if ine:
            nombre_limpio = nombre_archivo.replace('_', ' ').strip().lower()
            nuevo = f'{ine}_{nombre_limpio}_shield.svg'
            src = os.path.join(SHIELDS_DIR, fname)
            dst = os.path.join(SHIELDS_DIR, nuevo)
            if src != dst:
                if os.path.exists(dst):
                    os.remove(dst)
                os.rename(src, dst)
            renombrados.append(nuevo)
        else:
            # Si no se encuentra en INE, solo poner en minúscula el nombre del pueblo
            nombre_limpio = nombre_archivo.replace('_', ' ').strip().lower()
            nuevo = f'{nombre_limpio}_shield.svg'
            src = os.path.join(SHIELDS_DIR, fname)
            dst = os.path.join(SHIELDS_DIR, nuevo)
            if src != dst:
                if os.path.exists(dst):
                    os.remove(dst)
                os.rename(src, dst)
            renombrados.append(nuevo)

print('Renombrados:')
for f in renombrados:
    print('-', f)
print('\nNo encontrados en INE:')
for f in no_encontrados:
    print('-', f)
