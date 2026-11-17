# Cartografía agrícola (SIGPAC) — piloto

En la ficha de un pueblo (panel derecho), el botón **🌾 Cartografía agrícola** abre una pantalla completa con los
recintos del SIGPAC sobre la ortofoto. Piloto: **Aldeaseca de la Frontera (37022)**. El botón solo sale en los pueblos
que están en `frontend/public/data/sigpac/index.json`.

## Qué tiene la pantalla (`frontend/src/components/CartografiaAgricola.vue`)

- Recintos coloreados por uso del SIGPAC sobre la **ortofoto PNOA** o el **mapa del IGN** (servicios WMTS del IGN).
- Resumen del pueblo: hectáreas por uso; al pasar por un uso se resalta en el mapa.
- **Recinto**: ficha con polígono, parcela y recinto, uso, superficie oficial y medida, perímetro, regadío, la parcela
  completa (se resaltan todos sus recintos), la referencia SIGPAC (para el visor oficial) y la catastral, con enlace
  a la Sede del Catastro.
- **Distancia** y **Superficie**: se ponen puntos en el mapa; doble clic o «Terminar» para acabar. Las medidas se
  quedan dibujadas hasta «Borrar». Esc cancela la medición en curso.
- **Sumar**: se tocan recintos y suma su superficie oficial.
- Buscador por polígono y parcela.

Las medidas se calculan sobre la esfera terrestre: en los recintos de Aldeaseca la superficie medida se separa de la
oficial menos de un 0,25 %.

## Datos (`backend/scripts/build-sigpac.js`)

```
cd backend && node scripts/build-sigpac.js 37022 [37xxx …]
```

Descarga el ZIP del municipio del SIGPAC del ITACyL (`http://ftp.itacyl.es/cartografia/05_SIGPAC/<año>_ETRS89/`,
el año más reciente), lee los Shapefile de recintos y parcelas y escribe `frontend/public/data/sigpac/<ine>.json`
(GeoJSON con polígono, parcela, recinto, uso, superficie, coeficiente de regadío y referencia catastral) y lo apunta
en `index.json`. Aldeaseca: 898 recintos, 700 KB (150 KB comprimido). Se renueva una vez al año, con la campaña.

Los ficheros del ITACyL van con el código de municipio del **Catastro**, que no siempre es el del INE (Ledesma: 37171
en el Catastro, 37170 en el INE). Para extenderlo a toda la provincia hará falta esa tabla de equivalencias.

## Licencias

- **SIGPAC del ITACyL**: "uso gratuito de los datos, pero queda prohibida su explotación comercial" (IGCYL-NC). Vale
  para la web, que es gratuita. Para un uso de pago (la API) hay que usar los recintos del **FEGA** (servicio ATOM,
  datos de alto valor, CC BY 4.0).
- Hay que citar a la **Dirección General del Catastro** con la fecha de la cartografía (el script la saca de los
  metadatos del ITACyL).
- **Ortofoto y mapa**: PNOA e IGN, CC BY 4.0.
- La pantalla lo dice todo al pie, y avisa de que es información orientativa: para la PAC vale el SIGPAC oficial.
