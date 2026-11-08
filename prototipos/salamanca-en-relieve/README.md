# Prototipo "Salamanca en relieve"

Mapa 3D (Three.js r128 + GSAP ScrollTrigger) con los 362 municipios extruidos según su altitud real.
Incluye un recorrido con scroll (Vilvestre → Ciudad Rodrigo → La Alberca → Guijuelo → Salamanca),
banderas ondeando con un shader y un modo "Población" que deja ver la despoblación.

- `salamanca-en-relieve.html`: página final autocontenida (se abre directamente en el navegador).
- `template.html`: código fuente, con `__MUNIS__` y `__FLAGS__` como huecos para los datos.
- `build_data.py`: lee `frontend/dist/Limites_salamanca.svg` y las fichas de `municipios_md`.
  Simplifica los polígonos (Douglas-Peucker) y añade altitud, población y superficie. Genera `munis.json`.
- `assemble.py`: mete `munis.json` y las banderas en base64 dentro de la plantilla.

Regenerar (desde la raíz del repo):

    python -I prototipos/salamanca-en-relieve/build_data.py frontend/dist/Limites_salamanca.svg backend/src/SaLLMantino/ragger/script/municipios_md prototipos/salamanca-en-relieve/munis.json
    python -I prototipos/salamanca-en-relieve/assemble.py prototipos/salamanca-en-relieve frontend/dist/assets/flags prototipos/salamanca-en-relieve/salamanca-en-relieve.html

Pasarlo a la web Vue: usar TresJS (o three directamente) en un componente `RelieveMap.vue`,
con GSAP para el scroll y Lenis para el scroll suave. Cargarlo de forma diferida. Si el móvil no tiene WebGL
o el usuario prefiere menos movimiento, mostrar el mapa 2D actual.
