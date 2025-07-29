import requests

# Lista de IDs extraídos del fichero
file_ids = []



# URL base del endpoint DELETE (ajústala si es diferente)
BASE_URL = "http://localhost:7860/api/v2/files"

# Token de autorización (sustituye por el tuyo)
BEARER_TOKEN = ""

# Headers para la autenticación
headers = {
    "Authorization": f"Bearer {BEARER_TOKEN}"
}

url = f"{BASE_URL}"
response = requests.get(url, headers=headers)
response.raise_for_status()

data = response.json()

# Suponiendo que el JSON es una lista de objetos con campo 'id'
file_ids = [item["id"] for item in data if "id" in item]

# Eliminar cada fichero por ID
for file_id in file_ids:
    url = f"{BASE_URL}/{file_id}"
    response = requests.delete(url, headers=headers)

    if response.status_code == 200:
        print(f"✅ Eliminado correctamente: {file_id}")
    else:
        print(f"❌ Error al eliminar {file_id}: {response.status_code} - {response.text}")
