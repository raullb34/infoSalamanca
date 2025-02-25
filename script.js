document.addEventListener("DOMContentLoaded", function () {
    const svgObject = document.getElementById("mapa-salamanca");

    svgObject.addEventListener("load", function () {
        const svgDoc = svgObject.contentDocument || svgObject.getSVGDocument();

        if (!svgDoc) {
            console.error("No se pudo cargar el contenido del SVG.");
            return;
        }

        const pueblos = svgDoc.querySelectorAll("path");
        const tooltip = document.getElementById("tooltip");

        if (pueblos.length === 0) {
            console.error("No se encontraron elementos <path> en el SVG.");
            return;
        }

        pueblos.forEach(pueblo => {
            pueblo.style.fill = "#cccccc"; // Color base
            const label = pueblo.getAttribute("inkscape:label") || "Pueblo desconocido";

            pueblo.addEventListener("mouseover", function (event) {
                this.style.fill = "orange";
                tooltip.style.display = "block";
                tooltip.innerText = formatPuebloName(label);
                tooltip.style.left = event.pageX + "px";
                tooltip.style.top = (event.pageY - 30) + "px";
            });

            pueblo.addEventListener("mouseout", function () {
                this.style.fill = "#cccccc";
                tooltip.style.display = "none";
            });

            pueblo.addEventListener("click", function () {
                const townId = pueblo.id;
                openSidebar(formatPuebloName(label), townId, pueblo);
                fetchTownInfo(townId);
                fetchTownEvents(townId);
                fetchTownPoi(townId);
            });
        });
    });
});

// Función para dar formato al nombre del pueblo
function formatPuebloName(name) {
    return name.replace(/#/g, "").replace(/_/g, " ").replace(/__/g, "ñ").replace(/\b\w/g, c => c.toUpperCase());
}

function openSidebar(townName, townId, puebloElement) {
    document.getElementById("town-name").textContent = townName;
    document.getElementById("info-content").innerHTML = `<p>Cargando información...</p>`;
    document.getElementById("events-list").innerHTML = `<p>Cargando eventos...</p>`;

    // Obtener el bounding box del path original para calcular el viewBox
    const bbox = puebloElement.getBBox();
    
    // Crear un nuevo SVG y agregar el path clonado
    const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    newSvg.setAttribute("width", "100%");
    newSvg.setAttribute("height", "100%");
    newSvg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);

    // Clonar el path y modificarlo
    const clonedPath = puebloElement.cloneNode(true);
    clonedPath.removeAttribute("id"); // Evitar conflictos de ID duplicado
    clonedPath.style.fill = "#ff6600"; // Color destacado
    clonedPath.style.stroke = "#000"; // Borde visible
    clonedPath.style.strokeWidth = "1px";

    // Limpiar y añadir la forma al contenedor
    const shapeContainer = document.getElementById("town-shape");
    shapeContainer.innerHTML = ""; // Limpiar antes de añadir una nueva
    newSvg.appendChild(clonedPath);
    shapeContainer.appendChild(newSvg);

    document.getElementById("sidebar").classList.add("open");
}


// Cierra el menú lateral
document.getElementById("close-btn").addEventListener("click", function () {
    document.getElementById("sidebar").classList.remove("open");
});

// 🔹 FUNCION PARA HACER LA PETICIÓN A LA API
async function fetchTownInfo(townId) {
    try {
        const response = await fetch(`https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-municipios-de-castilla-y-leon/records?order_by=municipio&limit=10&refine=provincia%3A%22SALAMANCA%22&refine=cod_provincia%3A%2237%22&refine=cod_ine%3A%22${townId}%22`);
        if (!response.ok) {
            throw new Error("No se pudo obtener la información.");
        }
        const data = await response.json();
        
        // Mostrar la información en el menú lateral
        document.getElementById("info-content").innerHTML = `
            <p><strong>Latitud:</strong> ${data.results[0].latitud}</p>
            <p><strong>Longitud:</strong> ${data.results[0].longitud}</p>
            <p><strong>Mancomunidad:</strong> ${data.results[0].mancomunidades}</p>
            <p><strong>Población:</strong> ${data.results[0].poblacion} habitantes</p>
        `;
    } catch (error) {
        document.getElementById("info-content").innerHTML = `<p>Error al cargar los datos.</p>`;
        console.error("Error en la petición:", error);
    }
}


const RUTA_JSON = "./helpers/ine-codigopostal.json";

// 1️⃣ Cargar el JSON dinámicamente
async function cargarCodigosPostales() {
    try {
        const response = await fetch(RUTA_JSON);
        if (!response.ok) throw new Error("Error al cargar el archivo JSON");
        const municipiosJSON = await response.json();

        // 2️⃣ Crear un mapa { CodMunicipio: [CodigoPostal1, CodigoPostal2] }
        const mapaCodigosPostales = {};
        municipiosJSON.forEach(({ CodMunicipio, CodigoPostal }) => {
            if (!mapaCodigosPostales[CodMunicipio]) {
                mapaCodigosPostales[CodMunicipio] = [];
            }
            mapaCodigosPostales[CodMunicipio].push(CodigoPostal);
        });

        return mapaCodigosPostales;
    } catch (error) {
        console.error("Error cargando los códigos postales:", error);
        return null;
    }
}


// 1️⃣ Cargar el JSON dinámicamente
async function cargarCodigoINE(codigoPostal) {
    try {
        const response = await fetch(RUTA_JSON);
        if (!response.ok) throw new Error("Error al cargar el archivo JSON");
        
        // Cargamos el JSON del archivo
        const municipiosJSON = await response.json();
        
        // Buscar el municipio en el arreglo que tenga el mismo Código Postal
        const municipio = municipiosJSON.find(item => item.CodigoPostal === codigoPostal);
        
        // Si se encuentra, devolver el CodMunicipio, de lo contrario, devolver un mensaje de error
        if (municipio) {
            return municipio.CodMunicipio;
        } else {
            return 'Código Postal no encontrado';
        }
    } catch (error) {
        console.error("Error cargando los códigos postales:", error);
        return null;
    }
}


async function fetchTownEvents(townId) {
    const mapaCodigosPostales = await cargarCodigosPostales();
    if (!mapaCodigosPostales) return;

    if (!mapaCodigosPostales[townId]) {
        console.error(`No se encontró código postal para el municipio INE ${townId}`);
        return;
    }

    const codigosPostales = mapaCodigosPostales[townId];

    try {
        // 1️⃣ Crear un array de promesas para todas las solicitudes
        const promesas = codigosPostales.map(async (codigoPostal) => {
            const response = await fetch(`https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records?limit=20&refine=nombre_provincia%3A%22Salamanca%22&refine=cp%3A%22${codigoPostal}%22`);
            
            if (!response.ok) {
                throw new Error("No se pudo obtener la información.");
            }
            
            const data = await response.json();
            console.log(`${codigoPostal}:`, data.results);
            return data.results;
        });

        // 2️⃣ Esperar a que todas las promesas se resuelvan
        const resultados = await Promise.all(promesas);

        // 3️⃣ Concatenar todos los resultados en un solo array
        const allEvents = resultados.flat();

        console.log(allEvents);
        showEvents(allEvents);
    } catch (error) {
        document.getElementById("events-list").innerHTML = `<p>Error al cargar los datos.</p>`;
        console.error("Error en la petición:", error);
    }
}



async function fetchTownPoi(townId) {
    const mapaCodigosPostales = await cargarCodigosPostales();
    if (!mapaCodigosPostales) return;

    if (!mapaCodigosPostales[townId]) {
        console.error(`No se encontró código postal para el municipio INE ${townId}`);
        return;
    }

    const codigosPostales = mapaCodigosPostales[townId];

    try {
        // 1️⃣ Crear un array de promesas para todas las solicitudes
        const promesas = codigosPostales.map(async (codigoPostal) => {
            const response = await fetch(`https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/relacion-monumentos/records?refine=poblacion_provincia%3ASalamanca&refine=codigopostal%3A${codigoPostal}`);
            
            if (!response.ok) {
                throw new Error("No se pudo obtener la información.");
            }
            
            const data = await response.json();
            console.log(`${codigoPostal}:`, data.results);
            return data.results;
        });

        // 2️⃣ Esperar a que todas las promesas se resuelvan
        const resultados = await Promise.all(promesas);

        // 3️⃣ Concatenar todos los resultados en un solo array
        const allPoi = resultados.flat();

        console.log(allPoi);
        showPoi(allPoi);
    } catch (error) {
        document.getElementById("poi-list").innerHTML = `<p>Error al cargar los datos.</p>`;
        console.error("Error en la petición:", error);
    }
}


function showPoi(pois) {
    const poiContainer = document.getElementById("poi-list");
    poiContainer.innerHTML = ""; // Limpiar contenido previo

    if (pois.length === 0) {
        poiContainer.innerHTML = `<p>No se encontraron puntos de interés.</p>`;
        return;
    }

    pois.forEach(poi => {
        const poiElement = document.createElement("div");
        poiElement.classList.add("poi-item");

        const title = document.createElement("h3");
        title.textContent = poi.nombre;

        const description = document.createElement("p");
        description.innerHTML = poi.descripcion || "Sin descripción disponible.";

        const action = document.createElement("button");
        action.innerText = 'Añadir a la ruta';

        const info = document.createElement("p");
        info.innerHTML = `
            <strong>Tipo:</strong> ${poi.tipomonumento || "Desconocido"} <br>
            <strong>Ubicación:</strong> ${poi.calle || "No disponible"} <br>
            <strong>Época:</strong> ${(poi.periodohistorico || []).join(", ")}
        `;

        poiElement.appendChild(title);
        poiElement.appendChild(description);
        poiElement.appendChild(info);
        poiElement.appendChild(action);

        poiContainer.appendChild(poiElement);
    });
}


async function showEvents(eventos) {

    const eventosPorCategoria = agruparEventosPorCategoria(eventos);
    mostrarCategorias(eventosPorCategoria);
}


function agruparEventosPorCategoria(eventos) {
    return eventos.reduce((acc, evento) => {
        const categoria = evento.categoria || "Sin categoría";
        if (!acc[categoria]) {
            acc[categoria] = [];
        }
        acc[categoria].push(evento);
        return acc;
    }, {});
}



function mostrarCategorias(eventosPorCategoria) {
    const eventosContainer = document.getElementById("events-list");
    eventosContainer.innerHTML = ""; // Limpiar contenido anterior

    // Crear un contenedor para los círculos
    const categoriasContainer = document.createElement("div");
    categoriasContainer.classList.add("categorias-container");

    // Recorrer las categorías y crear un círculo para cada una
    Object.entries(eventosPorCategoria).forEach(([categoria, eventos]) => {
        const categoriaElemento = document.createElement("div");
        categoriaElemento.classList.add("categoria-circle");

        // Crear logo (puedes usar un icono o imagen según la categoría)
        const logo = document.createElement("img");
        logo.src = obtenerLogoPorCategoria(categoria); // Función para obtener el logo
        logo.alt = categoria;
        logo.classList.add("categoria-logo");

        // Crear número de eventos
        const numeroEventos = document.createElement("span");
        numeroEventos.textContent = eventos.length;
        numeroEventos.classList.add("categoria-numero");

        // Agregar logo y número al círculo
        categoriaElemento.appendChild(logo);
        categoriaElemento.appendChild(numeroEventos);

        // Agregar evento de clic para mostrar los eventos de la categoría
        categoriaElemento.addEventListener("click", () => mostrarEventosDeCategoria(eventos));

        // Agregar círculo al contenedor de categorías
        categoriasContainer.appendChild(categoriaElemento);
    });

    // Agregar el contenedor de categorías al DOM
    eventosContainer.appendChild(categoriasContainer);
}

function mostrarEventosDeCategoria(eventos) {
    const dialog = document.getElementById("eventos-dialog");
    const dialogContent = document.getElementById("eventos-dialog-content");
    dialogContent.innerHTML = ""; // Limpiar contenido anterior

    eventos.forEach(evento => {
        const eventoElemento = document.createElement("div");
        eventoElemento.classList.add("event");

        const titulo = document.createElement("h3");
        titulo.textContent = evento.titulo;

        const imagen = document.createElement("img");
        if (evento.imagen_evento) {
            imagen.src = evento.imagen_evento;
            imagen.alt = evento.titulo;
            imagen.classList.add("event-imagen");
        }

        const descripcion = document.createElement("p");
        descripcion.innerHTML = evento.descripcion;

        const info = document.createElement("p");
        info.innerHTML = `
            <strong>Fecha:</strong> ${evento.fecha_inicio} <br>
            <strong>Hora:</strong> ${evento.hora_inicio || "Por determinar"} <br>
            <strong>Lugar:</strong> ${evento.lugar_celebracion} <br>
            <strong>Dirección:</strong> ${evento.calle}, ${evento.cp} <br>
            <a href="${evento.enlace_contenido}" target="_blank">Más información</a>
        `;

        eventoElemento.appendChild(titulo);
        if (evento.imagen_evento) eventoElemento.appendChild(imagen);
        eventoElemento.appendChild(descripcion);
        eventoElemento.appendChild(info);

        dialogContent.appendChild(eventoElemento);
    });

    // Mostrar el diálogo
    dialog.showModal();

    // Cerrar el diálogo al hacer clic en el botón
    const cerrarDialog = document.getElementById("cerrar-dialog");
    cerrarDialog.addEventListener("click", () => dialog.close());
}


function obtenerLogoPorCategoria(categoria) {
    // Aquí puedes definir un mapeo de categorías a logos

    const logos = {
        "Espectáculos": "./icons/drama.png",
        "Conferencias y Cursos": "./icons/conferencia.png",
        "Conciertos": "./icons/concierto.png",
        "Libros y Lectura": "./icons/libro.png",
        "Exposiciones": "./icons/museo.png",
        "Ferias y Fiestas": "./icons/feria.png",
        "Otros": "./icons/evento.png",
        // Agrega más categorías y logos según sea necesario
    };
    return logos[categoria] || "icons/drama.png"; // Logo por defecto
}


// Obtenemos el contenedor con id "legend"
const legend = document.getElementById('legend');

// Añadimos un event listener al contenedor para detectar cambios en los checkboxes
legend.addEventListener('change', function(event) {
    // Verificamos que el objetivo del evento sea un checkbox
    if (event.target.type === 'checkbox') {
        // Imprimimos el estado del checkbox que ha cambiado
        const checkbox = event.target;
        if (checkbox.checked) {
            colourOnFilter(checkbox.id)
            console.log(`El checkbox con id "${checkbox.id}" está marcado`);
        } else {
            cleanFilter(checkbox.id)
            console.log(`El checkbox con id "${checkbox.id}" está desmarcado`);
        }
    }
});

async function colourOnFilter(id) {
    try {
        let url = '';
        switch (id) {
            case 'tierra-sabor':
                url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/empresas-acogidas-a-la-marca-tierra-de-sabor/records?refine=provincia%3ASALAMANCA';
                break;
            case 'teatro':
                url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-teatro/records?refine=nombre_provincia%3A%22Salamanca%22';
                break;
            case 'musica':
                url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-musica/records?refine=nombre_provincia%3A%22Salamanca%22';
                break;
            case 'exposicion':
                url = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/exposiciones/records?refine=nombre_provincia%3A%22Salamanca%22';
                break;
            // Agrega más casos según sea necesario
            default:
                console.error(`No se encontró una URL para el id ${id}`);
                return;
        }

        const limit = 20;
        let offset = 0;
        let total_count = 0;
        let allResults = [];

        do {
            const paginatedUrl = `${url}&limit=${limit}&offset=${offset}`;
            const response = await fetch(paginatedUrl);
            if (!response.ok) {
                throw new Error("No se pudo obtener la información.");
            }

            const data = await response.json();
            total_count = data.total_count;
            allResults = allResults.concat(data.results);
            offset += limit;
        } while (offset < total_count);

        console.log(allResults);

        // Cargar el archivo JSON con los códigos postales y los códigos INE
        const codigosPostalesResponse = await fetch('./helpers/ine-codigopostal.json');
        const codigosPostalesData = await codigosPostalesResponse.json();

        // Crear un mapa de códigos postales a códigos INE
        const mapaCodigosPostales = new Map();
        codigosPostalesData.forEach(item => {
            mapaCodigosPostales.set(item.CodigoPostal, item.CodMunicipio);
        });

        // Pintar los elementos SVG en función de los datos devueltos
        pintarElementosSVG(allResults, id, mapaCodigosPostales);

    } catch (error) {
        document.getElementById("events-list").innerHTML = `<p>Error al cargar los datos.</p>`;
        console.error("Error en la petición:", error);
    }
}

function cleanFilter(id) {
    // Limpiar globos de texto anteriores
    const balloonsContainer = document.getElementById('balloons-container');
    balloonsContainer.innerHTML = '';

    // Obtener el documento SVG
    const svgObject = document.getElementById("mapa-salamanca");
    const svgDoc = svgObject.contentDocument || svgObject.getSVGDocument();
    if (!svgDoc) {
        console.error("No se pudo cargar el contenido del SVG.");
        return;
    }

    // Restablecer el color de los elementos SVG
    const elementos = svgDoc.querySelectorAll("path");
    elementos.forEach(elemento => {
        if (elemento.style.fill === "yellow") {
            elemento.style.fill = "#cccccc"; // Color base
        }
    });
}


function pintarElementosSVG(data, id, mapaCodigosPostales) {
    const svgObject = document.getElementById("mapa-salamanca");
    const svgDoc = svgObject.contentDocument || svgObject.getSVGDocument();
    if (!svgDoc) {
        console.error("No se pudo cargar el contenido del SVG.");
        return;
    }

    // Limpiar globos de texto anteriores
    const balloonsContainer = document.getElementById('balloons-container');
    balloonsContainer.innerHTML = '';

    data.forEach(item => {
        const codigoPostal = item.c_p;
        const codINE = mapaCodigosPostales.get(parseInt(codigoPostal));
        if (codINE) {
            const elemento = svgDoc.getElementById(codINE);
            if (elemento) {
                switch (id) {
                    case 'tierra-sabor':
                        elemento.style.fill = "yellow"; // Color para Tierra de Sabor
                        // Crear y mostrar el globo de texto
                        crearGloboDeTexto(elemento, item.nombre_comercial);
                        break;
                    case 'teatro':
                        elemento.style.fill = "red"; // Color para Teatro
                        break;
                    case 'musica':
                        elemento.style.fill = "blue"; // Color para Música
                        break;
                    case 'exposicion':
                        elemento.style.fill = "green"; // Color para Exposiciones
                        break;
                    // Agrega más casos según sea necesario
                    default:
                        elemento.style.fill = "#cccccc"; // Color por defecto
                }
            }
        }
    });
}

function crearGloboDeTexto(elemento, texto) {
    const balloonsContainer = document.getElementById('balloons-container');
    const rect = elemento.getBoundingClientRect();
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    balloon.style.left = `${rect.left + window.scrollX}px`;
    balloon.style.top = `${rect.top + window.scrollY - 40}px`; // Ajustar la posición vertical
    balloon.innerHTML = texto;
    balloonsContainer.appendChild(balloon);
}





