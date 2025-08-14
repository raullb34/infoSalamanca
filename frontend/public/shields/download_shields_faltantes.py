#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para descargar escudos heráldicos faltantes desde Wikipedia
"""

import requests
import os
import time
import re
from urllib.parse import urlparse, unquote
from bs4 import BeautifulSoup

# Lista de municipios que faltan (con escudo en Wikipedia)
municipios_faltantes = [
    "Alba de Yeltes",
    "Alba de Tormes", 
    "Aldeadávila de la Ribera",
    "Aldeanueva de Figueroa",
    "Aldeanueva de la Sierra",
    "Aldeatejada",
    "Aldehuela de la Bóveda",
    "Arapiles",
    "Armenteros",
    "Boada",
    "Buenamadre",
    "Buenavista",
    "El Cabaco",
    "Cabeza del Caballo",
    "Cabrerizos",
    "Calvarrasa de Abajo",
    "Calzada de Don Diego",
    "Candelario",
    "Cantalapiedra",
    "Cantalpino",
    "Carbajosa de la Sagrada",
    "Carrascal de Barregas",
    "Carrascal del Obispo",
    "Castellanos de Moriscos",
    "Castellanos de Villiquera",
    "Castillejo de Martín Viejo",
    "Cerezal de Peñahorcada",
    "El Cerro",
    "Cipérez",
    "Ciudad Rodrigo",
    "Doñinos de Salamanca",
    "La Encina",
    "Forfoleda",
    "La Fregeneda",
    "Fresno Alhándiga",
    "La Fuente de San Esteban",
    "Fuentes de Oñoro",
    "Gajates",
    "Galinduste",
    "Gallegos de Solmirón",
    "Garcirrey",
    "Guijuelo",
    "Herguijuela de la Sierra",
    "Juzbado",
    "Lagunilla",
    "Larrodrigo",
    "Ledesma",
    "El Maíllo",
    "Machacón",
    "Martín de Yeltes",
    "Matilla de los Caños del Río",
    "Montejo",
    "Mozárbez",
    "Nava de Francia",
    "Nava de Sotrobal",
    "Navales",
    "Olmedo de Camaces",
    "Palacios del Arzobispo",
    "Parada de Arriba",
    "Pedraza de Alba",
    "Pedrosillo de Alba",
    "Pedrosillo de los Aires",
    "Pedrosillo el Ralo",
    "El Pedroso de la Armuña",
    "Pelabravo",
    "Peñaranda de Bracamonte",
    "Peñarandilla",
    "El Pino de Tormes",
    "Pozos de Hinojo",
    "Puebla de Azaba",
    "Puebla de Yeltes",
    "Puente del Congosto",
    "Puerto de Béjar",
    "Retortillo",
    "Saelices el Chico",
    "La Sagrada",
    "El Sahugo",
    "San Cristóbal de la Cuesta",
    "San Morales",
    "San Muñoz",
    "San Pedro del Valle",
    "Sanchotello",
    "Santibáñez de Béjar",
    "Santibáñez de la Sierra",
    "Sardón de los Frailes",
    "Saucelle",
    "Serradilla del Arroyo",
    "Sieteiglesias de Tormes",
    "El Tejado",
    "Terradillos",
    "Topas",
    "Valdecarros",
    "Valdefuentes de Sangusín",
    "Valdelosa",
    "Valverdón",
    "Vecinos",
    "Vega de Tirados",
    "Las Veguillas",
    "La Vellés",
    "Villalba de los Llanos",
    "Villamayor de Armuña",
    "Villar de Argañán",
    "Villar de Peralonso",
    "Villar de la Yegua",
    "Villares de la Reina",
    "Villares de Yeltes",
    "Villarino de los Aires",
    "Villarmayor",
    "Villasbuenas",
    "Villagonzalo de Tormes",
    "Villoria",
    "Vitigudino",
    "Yecla de Yeltes",
    "Zamarra",
    "Zamayón",
    "Zarapicos",
    "Zorita de la Frontera"
]

# Mapeo de códigos INE (necesario para nombres de archivo)
codigos_ine = {
    "Alba de Yeltes": "37009",
    "Alba de Tormes": "37008",
    "Aldeadávila de la Ribera": "37014",
    "Aldeanueva de Figueroa": "37016",
    "Aldeanueva de la Sierra": "37017",
    "Aldeatejada": "37022",
    "Aldehuela de la Bóveda": "37023",
    "Arapiles": "37030",
    "Armenteros": "37033",
    "Boada": "37047",
    "Buenamadre": "37058",
    "Buenavista": "37059",
    "El Cabaco": "37050",
    "Cabeza del Caballo": "37051",
    "Cabrerizos": "37054",
    "Calvarrasa de Abajo": "37055",
    "Calzada de Don Diego": "37057",
    "Candelario": "37062",
    "Cantalapiedra": "37081",
    "Cantalpino": "37065",
    "Carbajosa de la Sagrada": "37067",
    "Carrascal de Barregas": "37069",
    "Carrascal del Obispo": "37070",
    "Castellanos de Moriscos": "37074",
    "Castellanos de Villiquera": "37075",
    "Castillejo de Martín Viejo": "37076",
    "Cerezal de Peñahorcada": "37080",
    "El Cerro": "37102",
    "Cipérez": "37084",
    "Ciudad Rodrigo": "37085",
    "Doñinos de Salamanca": "37096",
    "La Encina": "37099",
    "Forfoleda": "37157",
    "La Fregeneda": "37108",
    "Fresno Alhándiga": "37109",
    "La Fuente de San Esteban": "37110",
    "Fuentes de Oñoro": "37116",
    "Gajates": "37117",
    "Galinduste": "37118",
    "Gallegos de Solmirón": "37121",
    "Garcirrey": "37124",
    "Guijuelo": "37130",
    "Herguijuela de la Sierra": "37132",
    "Juzbado": "37140",
    "Lagunilla": "37141",
    "Larrodrigo": "37142",
    "Ledesma": "37143",
    "El Maíllo": "37156",
    "Machacón": "37148",
    "Martín de Yeltes": "37153",
    "Matilla de los Caños del Río": "37157",
    "Montejo": "37169",
    "Mozárbez": "37177",
    "Nava de Francia": "37180",
    "Nava de Sotrobal": "37181",
    "Navales": "37125",
    "Olmedo de Camaces": "37185",
    "Palacios del Arzobispo": "37226",
    "Parada de Arriba": "37190",
    "Pedraza de Alba": "37195",
    "Pedrosillo de Alba": "37196",
    "Pedrosillo de los Aires": "37197",
    "Pedrosillo el Ralo": "37198",
    "El Pedroso de la Armuña": "37199",
    "Pelabravo": "37200",
    "Peñaranda de Bracamonte": "37205",
    "Peñarandilla": "37206",
    "El Pino de Tormes": "37151",
    "Pozos de Hinojo": "37214",
    "Puebla de Azaba": "37215",
    "Puebla de Yeltes": "37217",
    "Puente del Congosto": "37218",
    "Puerto de Béjar": "37220",
    "Retortillo": "37225",
    "Saelices el Chico": "37276",
    "La Sagrada": "37231",
    "El Sahugo": "37232",
    "San Cristóbal de la Cuesta": "37237",
    "San Morales": "37243",
    "San Muñoz": "37244",
    "San Pedro del Valle": "37246",
    "Sanchotello": "37250",
    "Santibáñez de Béjar": "37255",
    "Santibáñez de la Sierra": "37256",
    "Sardón de los Frailes": "37259",
    "Saucelle": "37260",
    "Serradilla del Arroyo": "37263",
    "Sieteiglesias de Tormes": "37266",
    "El Tejado": "37275",
    "Terradillos": "37278",
    "Topas": "37279",
    "Valdecarros": "37287",
    "Valdefuentes de Sangusín": "37288",
    "Valdelosa": "37292",
    "Valverdón": "37301",
    "Vecinos": "37302",
    "Vega de Tirados": "37303",
    "Las Veguillas": "37320",
    "La Vellés": "37305",
    "Villalba de los Llanos": "37352",
    "Villamayor de Armuña": "37171",
    "Villar de Argañán": "37313",
    "Villar de Peralonso": "37317",
    "Villar de la Yegua": "37316",
    "Villares de la Reina": "37319",
    "Villares de Yeltes": "37320",
    "Villarino de los Aires": "37321",
    "Villarmayor": "37322",
    "Villasbuenas": "37324",
    "Villagonzalo de Tormes": "37310",
    "Villoria": "37331",
    "Vitigudino": "37333",
    "Yecla de Yeltes": "37332",
    "Zamarra": "37334",
    "Zamayón": "37335",
    "Zarapicos": "37381",
    "Zorita de la Frontera": "37336"
}

def limpiar_nombre_archivo(nombre):
    """Limpia el nombre para ser válido como nombre de archivo"""
    # Reemplazar caracteres problemáticos
    nombre = nombre.replace(" ", "_").replace(",", "").lower()
    nombre = re.sub(r'[áàäâ]', 'a', nombre)
    nombre = re.sub(r'[éèëê]', 'e', nombre)
    nombre = re.sub(r'[íìïî]', 'i', nombre)
    nombre = re.sub(r'[óòöô]', 'o', nombre)
    nombre = re.sub(r'[úùüû]', 'u', nombre)
    nombre = re.sub(r'[ñ]', 'n', nombre)
    nombre = re.sub(r'[^a-z0-9_]', '_', nombre)
    return nombre

def buscar_escudo_wikipedia(municipio):
    """Busca la imagen del escudo en Wikipedia"""
    try:
        # URL de la página del armorial
        url_armorial = "https://es.wikipedia.org/wiki/Anexo:Armorial_municipal_de_la_provincia_de_Salamanca"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url_armorial, headers=headers)
        if response.status_code != 200:
            print(f"❌ Error accediendo a Wikipedia para {municipio}")
            return None
            
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Buscar la fila que contiene el municipio
        municipio_clean = municipio.replace("El ", "").replace("La ", "").replace("Las ", "").replace("Los ", "")
        
        # Buscar en todas las celdas
        for cell in soup.find_all(['td', 'th']):
            if cell.get_text().strip() == municipio or municipio_clean in cell.get_text():
                # Buscar imagen en la misma fila
                row = cell.find_parent('tr')
                if row:
                    img = row.find('img')
                    if img and img.get('src'):
                        img_url = img['src']
                        if img_url.startswith('//'):
                            img_url = 'https:' + img_url
                        elif img_url.startswith('/'):
                            img_url = 'https://es.wikipedia.org' + img_url
                        
                        print(f"✅ Encontrada imagen para {municipio}: {img_url}")
                        return img_url
        
        # Buscar también por búsqueda directa en Wikipedia
        municipio_search = municipio.replace(" ", "_")
        url_municipio = f"https://es.wikipedia.org/wiki/{municipio_search}"
        
        response = requests.get(url_municipio, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Buscar imágenes que contengan "escudo" en el alt o título
            for img in soup.find_all('img'):
                alt_text = img.get('alt', '').lower()
                title_text = img.get('title', '').lower()
                src = img.get('src', '')
                
                if ('escudo' in alt_text or 'escudo' in title_text) and src:
                    if src.startswith('//'):
                        src = 'https:' + src
                    elif src.startswith('/'):
                        src = 'https://es.wikipedia.org' + src
                    
                    print(f"✅ Encontrada imagen directa para {municipio}: {src}")
                    return src
        
        print(f"⚠️  No se encontró escudo para {municipio}")
        return None
        
    except Exception as e:
        print(f"❌ Error buscando {municipio}: {str(e)}")
        return None

def descargar_imagen(url, filepath):
    """Descarga una imagen desde una URL y la convierte a PNG"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, stream=True)
        if response.status_code == 200:
            # Leer el contenido de la imagen
            image_content = response.content
            
            # Si es SVG, buscar una versión PNG más grande
            if url.lower().endswith('.svg') or 'svg' in response.headers.get('content-type', ''):
                print(f"⚠️  Imagen SVG detectada, buscando versión PNG...")
                
                # Intentar obtener URL de imagen más grande
                if 'thumb' in url:
                    # Reemplazar thumb por versión original
                    png_url = url.replace('/thumb/', '/').split('/')
                    if len(png_url) > 1:
                        # Quitar el último segmento que suele ser el tamaño
                        png_url = '/'.join(png_url[:-1])
                        png_url = png_url.replace('.svg', '.png')
                        
                        # Intentar descargar la versión PNG
                        try:
                            png_response = requests.get(png_url, headers=headers)
                            if png_response.status_code == 200:
                                with open(filepath, 'wb') as f:
                                    f.write(png_response.content)
                                print(f"✅ Descargada versión PNG alternativa")
                                return True
                        except:
                            pass
                
                # Si no se puede convertir, guardar como SVG pero cambiar extensión
                svg_path = filepath.replace('.png', '.svg')
                with open(svg_path, 'wb') as f:
                    f.write(image_content)
                print(f"⚠️  Guardado como SVG: {os.path.basename(svg_path)}")
                return True
            else:
                # Para otros formatos, guardar directamente como PNG
                with open(filepath, 'wb') as f:
                    f.write(image_content)
                return True
        else:
            print(f"❌ Error descargando imagen: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error descargando imagen: {str(e)}")
        return False

def main():
    """Función principal"""
    base_dir = "../assets/shields_faltantes"
    os.makedirs(base_dir, exist_ok=True)
    
    total = len(municipios_faltantes)
    descargados = 0
    errores = 0
    
    print(f"🚀 Iniciando descarga de {total} escudos faltantes...")
    print("=" * 60)
    
    for i, municipio in enumerate(municipios_faltantes, 1):
        print(f"\n[{i}/{total}] Procesando: {municipio}")
        
        # Buscar la imagen del escudo
        img_url = buscar_escudo_wikipedia(municipio)
        
        if img_url:
            # Obtener código INE
            codigo = codigos_ine.get(municipio, f"37{i:03d}")
            
            # Limpiar nombre para archivo
            nombre_limpio = limpiar_nombre_archivo(municipio)
            
            # Crear nombre de archivo (siempre PNG)
            filename = f"{codigo}_{nombre_limpio}_shield.png"
            filepath = os.path.join(base_dir, filename)
            
            # Descargar imagen
            if descargar_imagen(img_url, filepath):
                print(f"✅ Descargado: {filename}")
                descargados += 1
            else:
                print(f"❌ Error descargando: {municipio}")
                errores += 1
        else:
            print(f"⚠️  No se encontró imagen para: {municipio}")
            errores += 1
        
        # Pausa para no saturar el servidor
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print(f"📊 RESUMEN:")
    print(f"   Total municipios: {total}")
    print(f"   ✅ Descargados: {descargados}")
    print(f"   ❌ Errores: {errores}")
    print(f"   📁 Guardados en: {os.path.abspath(base_dir)}")
    
    if descargados > 0:
        print(f"\n🎉 ¡Descarga completada! Se descargaron {descargados} escudos.")
    else:
        print(f"\n⚠️  No se pudo descargar ningún escudo. Revisa la conexión a Internet.")

if __name__ == "__main__":
    main()
