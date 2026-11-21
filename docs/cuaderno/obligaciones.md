# Matriz de obligaciones del cuaderno (versión 0.1 · 21/11/2026)

Tabla versionada de requisitos. **Ninguna norma se ha contrastado todavía con su texto consolidado vigente**: las
referencias salen del plan del encargo y por eso todas las reglas están **pendientes de revisión**. Hasta que una
regla pase a «verificada», la aplicación no afirma que esa obligación esté comprobada: como mucho la señala como
incidencia o dato pendiente.

Estados de una regla al aplicarla a un caso: **aplica** · **no aplica** · **faltan datos para decidir**.
Estado de cobertura: **sin implementar** · **parcial** (se recogen los datos, sin regla) · **implementada** (con prueba).

| Id | Requisito | Norma / artículo / anexo (a verificar) | Territorio | Vigencia | Campos | Plazo | Justificantes | Exportación | Prueba automatizada | Cobertura | Estado de la regla |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PERF-01 | Caracterizar la explotación: titular, superficies, cultivos, régimen hídrico, actividades | RD 1054/2022 (REA y CUE); Orden APA/204/2023, anexo II | España | A verificar | titular, identificadores, cultivos, régimen | — | — | CSV (parcial) | `recorrido.test.js` (alta de explotación y cultivos) | parcial | pendiente de revisión |
| PERF-02 | Precarga desde REACyL con permiso y conciliación de discrepancias | Formación pública CyL / instrucciones de CyL | Castilla y León | A verificar | identificadores REA, parcelas, cultivos | — | — | — | — | sin implementar (depende de acceso) | pendiente de revisión |
| FERT-01 | Registrar cada aporte de fertilizante (mineral, orgánico, fertirrigación): producto, composición, cantidad, unidad, método, superficie y fecha | RD 1051/2022 (nutrición sostenible) | España | A verificar | fecha, producto, composición, dosis/unidad, superficie, cultivo | — | Etiqueta / albarán | CSV | `fertilizacion.test.js`, `recorrido.test.js` | parcial (abonado; sin método de aplicación ni fertirrigación) | pendiente de revisión |
| FERT-02 | Registrar en el plazo máximo de un mes desde la operación (en los supuestos aplicables) | RD 1051/2022 (según el plan) | España | A verificar | fechaEfectiva, fechaRegistro | 1 mes | — | Bandeja | `recorrido.test.js` (incidencia FERT-02) | parcial (incidencia, no se decide si aplica) | pendiente de revisión |
| FERT-03 | Balance y plan de abonado cuando proceda | RD 1051/2022 | España | A verificar | necesidades del cultivo, aportes | — | Plan | — | — | sin implementar | pendiente de revisión |
| NITR-01 | Zonas vulnerables: capa oficial vigente con su fecha, intersección con la zona trabajada, periodos y límites | Decreto 5/2020 (CyL); Orden MAV/398/2022 y modificaciones (BOCYL) | Castilla y León | A verificar | geometría trabajada, capa ZV, fechas | — | — | — | — | sin implementar: sin capa, la comprobación queda pendiente | pendiente de revisión |
| FITO-01 | Registro de tratamientos en campo: problema, justificación, cultivo, superficie, fecha (y hora cuando proceda), producto autorizado y nº de registro, dosis/unidad, aplicador, equipo, asesoramiento, evaluación | RD 1311/2012; Reglamento de Ejecución (UE) 2023/564 y modificación de 2025 | UE / España | A verificar (formato electrónico) | — | — | Receta / asesoramiento | — | — | sin implementar | pendiente de revisión |
| FITO-02 | Semilla tratada, poscosecha e instalaciones con sus campos propios | RD 1311/2012; Reg. (UE) 2023/564 | UE / España | A verificar | lote, cantidad, instalación | — | — | — | — | sin implementar | pendiente de revisión |
| FITO-03 | Conservar registros y documentos un mínimo de tres años | RD 1311/2012 (según el plan) | España | A verificar | — | 3 años | — | — | — | sin implementar (no se borra nada; falta la política) | pendiente de revisión |
| FITO-04 | Papel admitido para el registro profesional agrario hasta el 31/12/2026; después, formato electrónico interoperable | RD 1311/2012 consolidado (según el plan) | España | Hasta 31/12/2026 | — | — | — | Formato SIEX | — | sin implementar | pendiente de revisión |
| PAC-01 | Prácticas y evidencias según compromisos reales de campaña (riego, pastoreo, siega, cubiertas, cosecha…) | Normativa PAC de la campaña | España / CyL | Por campaña | compromisos, evidencias | Según práctica | Fotos, justificantes | — | — | sin implementar | pendiente de revisión |
| EXP-01 | Expediente por explotación y campaña: registros, justificantes, informes, correcciones y validaciones; distinguir dato inválido, posible incumplimiento y pendiente | Plan del encargo | — | — | — | — | — | CSV (filas, versión, pendientes) | `recorrido.test.js` (CSV), `api.test.js` | parcial | — |
| SIEX-01 | Intercambio con la Administración: Documento Técnico SIEX vigente, catálogos y anexo de interfaz común, contrastados con las instrucciones de CyL (Cuecyl) | FEGA (SIEX); Junta de CyL (Cuecyl) | España / CyL | A verificar | — | — | — | Envío oficial | — | sin implementar (depende de acceso) | pendiente de revisión |

## Dependencias con la Junta (estado)

| Dependencia | Para qué | Estado | Qué hace falta |
|---|---|---|---|
| REACyL (datos registrales) | Precargar la explotación y conciliar | **Sin acceso** | Confirmar con la Junta la vía de acceso para el proyecto, la representación del titular y el entorno de pruebas |
| Cuecyl (cuaderno oficial de CyL) | Enviar el cuaderno, seguir el resultado, rectificar | **Sin acceso** | Alta, credenciales, entorno de pruebas, formatos y versión vigentes |
| Documento Técnico SIEX y catálogos (FEGA) | Formato y catálogos del intercambio | **Sin obtener** | Descargar la versión vigente y contrastarla con las instrucciones de CyL |
| Capa oficial de zonas vulnerables (CyL) | Comprobaciones de nitratos | **Sin importar** | Geometrías oficiales vigentes con su fecha |

Mientras no haya acceso, el envío a producción queda **desactivado** y el cuaderno se entrega en local con su
exportación. Nada pasa a «Aceptado por la Junta» sin una respuesta administrativa válida.
