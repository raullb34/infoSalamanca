import requests
import os
import re
import wikitextparser as wtp
from bs4 import BeautifulSoup

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
WIKI_API = 'https://es.wikipedia.org/w/api.php'

def normalize_name(name):
    name = name.strip().lower()
    name = re.sub(r',', '', name)
    name = name.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
    name = re.sub(r'\s+', '_', name)
    return name

def download_image(url, filename):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) infoSalamancaBot/1.0',
            'Accept': 'image/svg+xml,image/*;q=0.8,*/*;q=0.5'
        }
        with requests.get(url, timeout=20, headers=headers, stream=True) as r:
            if r.status_code == 200:
                with open(filename, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                print('Descargado:', filename)
                return True
            else:
                print('No se pudo descargar:', url, 'Status:', r.status_code)
                return False
    except Exception as e:
        print('Error descargando', url, e)
        return False

def get_real_image_url(img_name):
    commons_url = f'https://commons.wikimedia.org/wiki/File:{img_name}'
    r = requests.get(commons_url)
    if r.status_code != 200:
        print(f'No se pudo acceder a la página de Commons: {commons_url}')
        return None
    soup = BeautifulSoup(r.text, 'html.parser')
    link = soup.find('div', {'class': 'fullImageLink'}).find('a')
    print(link)
    if link and link.has_attr('href'):
        url = link['href']
        if url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('/'):
            url = 'https://commons.wikimedia.org' + url
        return url
    else:
        print(f'No se encontró enlace de imagen en {commons_url}')
        return None

def main():
    print('Fetching table from Wikipedia using MediaWiki API...')
    params = {
        'action': 'parse',
        'page': 'Anexo:Municipios_de_la_provincia_de_Salamanca',
        'format': 'json',
        'prop': 'wikitext'
    }
    res = requests.get(WIKI_API, params=params)
    data = res.json()
    wikitext = data['parse']['wikitext']['*']

    parsed = wtp.parse(wikitext)
    tables = parsed.tables
    found = 0
    exitosos = []
    fallidos = []
    for table in tables:
        rows = table.data()
        for row in rows[1:]:  # skip header
            if len(row) > 5:
                municipio = normalize_name(row[5])
                img_field = row[4]
                match = re.search(r'\[\[Archivo:(.*?)(\||\]\])', img_field)
                if match:
                    img_name = match.group(1).replace(' ', '_')
                    real_url = get_real_image_url(img_name)
                    ext = os.path.splitext(img_name)[1] or '.png'
                    filename = os.path.join(OUTPUT_DIR, f'{municipio}_shield{ext}')
                    if real_url:
                        print(f'Descargando {municipio}: {real_url} -> {filename}')
                        ok = download_image(real_url, filename)
                        if ok:
                            exitosos.append(municipio)
                        else:
                            fallidos.append(municipio)
                        found += 1
    print(f'Total shields found: {found}')
    print('\nSuccessfully downloaded:')
    for m in exitosos:
        print('-', m)
    print('\nFailed to download:')
    for m in fallidos:
        print('-', m)

if __name__ == '__main__':
    main()
