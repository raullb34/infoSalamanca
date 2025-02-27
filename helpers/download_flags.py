import requests
from bs4 import BeautifulSoup
import os
from urllib.parse import urljoin, unquote
import unicodedata
import re
import json

def normalize_string(s):
    """Normaliza una cadena y mueve los artículos al final"""
    # Decodificar URL encoding
    s = unquote(s)
    
    # Quitar 'Bandera_de_' y la extensión
    s = re.sub(r'Bandera_de_|\.svg$|\.png$', '', s)
    
    # Reemplazar guiones bajos por espacios
    s = s.replace('_', ' ')
    
    # Buscar artículos al principio
    article_match = re.match(r'^(El|La|Los|Las)\s+(.+)$', s, re.IGNORECASE)
    
    if article_match:
        article = article_match.group(1)
        name = article_match.group(2)
        # Mover el artículo al final
        s = f"{name}, {article}"
    
    return s

def download_flags():
    # URL de la página con las banderas
    url = "https://es.m.wikipedia.org/wiki/Wikiproyecto:Ilustraci%C3%B3n/Taller_de_Her%C3%A1ldica_y_Vexilolog%C3%ADa/Realizaciones/Atlas_de_banderas_municipales_de_Salamanca"
    
    # Crear directorio para las banderas si no existe
    flags_dir = "flags"
    if not os.path.exists(flags_dir):
        os.makedirs(flags_dir)

    # Obtener el contenido de la página
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Encontrar todas las imágenes de banderas
    flag_containers = soup.find_all('span', {'typeof': 'mw:File'})
    
    # Cargar el archivo JSON con los códigos INE
    with open('helpers/ine-codigopostal.json', 'r', encoding='utf-8') as f:
        municipios = json.load(f)

    # Descargar cada bandera
    for container in flag_containers:
        try:
            # Encontrar la imagen dentro del contenedor
            img = container.find('img')
            if img and 'src' in img.attrs:
                # Obtener la URL completa de la imagen
                img_url = urljoin('https:', img['src'])
                
                # Obtener el nombre del municipio de la URL
                raw_filename = img_url.split('/')[-1]
                # Quitar '100px-' y cortar por el primer punto o paréntesis
                town_name = re.search(r'100px-(?:Bandera_de_|Bandera_)?(.+?)[\.\(\s]', raw_filename)
                if town_name:
                    town_name = town_name.group(1)
                    # Reemplazar guiones bajos por espacios
                    town_name = town_name.replace('_', ' ')
                    
                    # Buscar artículos al principio y moverlos al final
                    article_match = re.match(r'^(El|La|Los|Las)\s+(.+)$', town_name, re.IGNORECASE)
                    if article_match:
                        article = article_match.group(1).lower()
                        name = article_match.group(2)
                        town_name = f"{name}, {article}"
                    
                    # Buscar el código INE (ignorando mayúsculas/minúsculas)
                    ine_code = next((str(m['CodMunicipio']) for m in municipios 
                                   if 'CodMunicipio' in m and 'Municipio' in m 
                                   and m['Municipio'].lower() == town_name.lower()), '')
                    
                    # Construir el nombre del archivo
                    if ine_code:
                        filename = f"{ine_code}_{town_name.lower()}_bandera"
                    else:
                        filename = f"{town_name.lower()}_bandera"
                        print(f"No se encontró código INE para: {town_name}")
                else:
                    filename = normalize_string(raw_filename)
                
                # Descargar la imagen
                img_response = requests.get(img_url)
                
                # Guardar la imagen
                with open(os.path.join(flags_dir, filename + '.png'), 'wb') as f:
                    f.write(img_response.content)
                
                print(f"Descargada bandera: {filename}.png")
        
        except Exception as e:
            print(f"Error descargando {img_url if 'img_url' in locals() else 'unknown'}: {str(e)}")

if __name__ == "__main__":
    download_flags()