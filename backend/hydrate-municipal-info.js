/**
 * Script para hidratar la base de datos con información de contacto y fiestas de los municipios de Salamanca
 * Datos extraídos del PDF sp01.pdf
 */

const mongoose = require('mongoose');
const MunicipalInfo = require('./src/models/municipalInfo');

// Datos de los municipios con correos y fiestas (extraídos del PDF sp01.pdf)
// Se parsean desde la tabla cruda pegada por el usuario (primeros 150 municipios)

const RAW_TABLE = `
1	Abusejo	37640	923 44 60 20	923 44 60 20	aytoabusejo@hotmail.es		20 de enero y 5 de mayo	https://abusejo.sedelectronica.es
2	Agallas	37510	923 49 03 01	923 49 03 01	agallasayuntamiento@hotmail.com	https://www.aytoagallas.es/	5 de agosto y 6 de agosto	https://agallas.sedelectronica.es
3	Ahigal de los Aceiteros	37248	923 51 24 01		ayuntamientodeahigal@yahoo.es		24 de junio y 18 de agosto	http://ahigaldelosaceiteros.sedelectronica.es/
4	Ahigal de Villarino	37173	923 51 00 01		ayuntamientoahigaldevillarino@hotmail.es		28 de agosto y 29 de agosto	https://ahigaldevillarino.sedelectronica.es
5	La Alameda de Gardón	37497	923 47 72 12	923 47 72 12	ayto_laalamedadegardon@yahoo.es		2 de mayo y 8 de agosto	https://alamedadegardon.sedelectronica.es
6	La Alamedilla	37554	923  48 99 02	923 48 99 02	alamedilla37@gmail.com	http://aytolaalamedilla.es/	25 de julio y 26 de julio	https://laalamedilla.sedelectronica.es/
7	Alaraz	37312	923 55 00 01		ayuntamientoalaraz@yahoo.es		28 de abril y 5 de agosto	https://alaraz.sedelectronica.es
8	Alba de Tormes	37800	923 30 00 24	923 30 00 15	secretario@villaalbadetormes.com	http://www.albadetormes.com	27 de agosto y 15 de octubre	https://albadetormes.sedelectronica.es
9	Alba de Yeltes	37478	923 48 45 01		aytoalbadeyeltes@gmail.com		2 de octubre y 3 de octubre	https://albadeyeltes.sedelectronica.es
10	La Alberca	37624	923 41 50 36	923 41 50 35	secretario@laalberca.com	http://www.laalberca.com	21 de abril y 18 de agosto	https://laalberca.sedelectronica.es
11	La Alberguería de Argañán	37555	923 48 93 71		aytoalbergueria@gmail.com		26 de julio y 27 de julio	https://albergueriadearganan.sedelectronica.es
12	Alconada	37329	923 56 40 30		aytoalconada@hotmail.es		30 de junio y 4 de diciembre	https://alconada.sedelectronica.es
13	Aldeacipreste	37718	923 41 48 48		secreaytoaldea@gmail.com		19 de marzo y 16 de agosto	https://aldeacipreste.sedelectronica.es
14	Aldeadávila de la Ribera	37250	923 50 50 05	923 50 59 26	ayuntamientoaldeadavila@gmail.com	http://www.aldeadavila.es	25 de agosto y 26 de agosto	https://aldeadaviladelaribera.sedelectronica.es
15	Aldea del Obispo	37488	923 48 83 02	923 48 83 02	ayto_aldeadelobispo@yahoo.es		20 de enero y 25 de julio 	http://aldeadelobispo.sedeelectronica.es
16	Aldealengua	37350	923 36 24 81	923 36 24 74	ayto.aldealengua@gmail.com	http://www.aldealengua.es	24 de junio y 8 de septiembre	https://aldealengua.sedelectronica.es
17	Aldeanueva de Figueroa	37429	923 36 33 80	923 36 33 80	ayunfigueroa@gmail.com		4 de marzo y 24 de noviembre	https://aldeanuevadefigueroa.sedelectronica.es
18	Aldeanueva de la Sierra	37621	923 17 23 50		aytoaldeanuevasierra@yahoo.es		9 de junio y 8 de agosto	https://aldeanuevadelasierra.sedelectronica.es
19	Aldearrodrigo	37110	923 31 41 72	923 31 41 72	aytoaldearrodrigo@gmail.com		8 de mayo y 9 de agosto	https://aldearrodrigo.sedelectronica.es.
20	Aldearrubia	37340	923 36 31 10	923 36 31 10	aytoaldearrubia@hotmail.com	http://www.aldearrubia.es	30 de mayo y 29 de septiembre	https://aldearrubia.sedelectronica.es
21	Aldeaseca de Alba	37870	923 30 04 69		aytoaldeasecadealba@gmail.com		3 de febrero y 28 de noviembre	https://aldeasecadealba.sedelectronica.es
22	Aldeaseca de la Frontera	37317	923 54 10 01		aytoaldeasecadelafrontera@gmail.com		15 de mayo y 14 de agosto	https://aldeasecadelafrontera.sedelectronica.es
23	Aldeatejada	37187	923 34 10 01	923 34 19 06	auxiliares@aldeatejada.es		19 de junio y 5 de diciembre	https://aldeatejada.sedeelectronica.es
24	Aldeavieja de Tormes	37779	923 15 05 16		aytoaldeaviejatormes@gmail.com		8 de septiembre y 9 de septiembre	https://aldeaviejadetormes.sedelectronica.es
25	Aldehuela de la Bóveda	37460	923 44 50 18	923 44 50 18	aytoaldehuelaboveda@gmail.com		6 de octubre y 7 de octubre	https://aldehueladelaboveda.sedelectronica.es
26	Aldehuela de Yeltes	37639	923 44 25 46	923 44 25 04	administra@aldehueladeyeltes.com		3 de mayo y 15 de septiembre	https://aldehueladeyeltes.sedelectronica.es
27	Almenara de Tormes	37115	923 32 11 16	600432972	ayuntamiento@almenaradetormes.es	http://www.almenaradetormes.es	3 de febrero y 19 de junio	https://almenaradetormes.sedelectronica.es
28	Almendra	37176	923 14 15 21	923 14 15 21	ayuntamientoalmendra@yahoo.es		15 de mayo y 29 de septiembre	https://almendra.sedelectronica.es
29	Anaya de Alba	37863	923 38 30 12		anayadealbaayuntamiento@gmail.com		15 de mayo y 15 de septiembre	https://anayadealba.sedelectronica.es
30	Añover de Tormes	37111	923 16 03 40		aytodeanoverdetormes@hotmail.es	https://www.anoverdetormes.com/	5 de mayo y 18 de agosto	https://anoverdetormes.sedelectronica.es
31	Arabayona de Mógica	37418	923 36 10 11	923 36 10 23	aytoarabayona@hotmail.es		3 de febrero y 27 de octubre	https://arabayonademogica.sedelectronica.es
32	Arapiles	37796	923 28 87 79	923 28 87 79	ayuntamientoarapiles@gmail.com		20 de enero y 12 de diciembre	https://arapiles.sedelectronica.es
33	Arcediano	37429	923 35 42 78		ayarcediano@hotmail.com		21 de julio y 29 de septiembre	https://arcediano.sedelectronica.es
34	El Arco	37110	923 32 14 04		aytoelarco@gmail.com		30 de mayo y 8 de agosto	https://elarco.sedelectronica.es.
35	Armenteros	37755	923 59 01 02		aytoarmenteros@gmail.com		6 de octubre y 7 de octubre	https://armenteros.sedelectronica.es
36	San Miguel del Robledo	37659	923 43 71 09	923 43 71 09	asanmiguelinfo@gmail.com		8 de mayo y 29 de octubre	https://sanmigueldelrobledo.sedelectronica.es
37	La Atalaya	37591	923 49 05 79		aytolaatalaya@hotmail.com		8 de mayo y 15 de mayo	http://laatalaya.sedelectronica.es
38	Babilafuente	37330	923 36 06 01		ayuntamientobabilafuente@yahoo.es 		3 de febrero y 28 de abril	https://babilafuente.sedelectronica.es
39	Bañobárez	37271	923 50 60 01	923 50 60 01	aytobanobarez@hotmail.es		11 de septiembre y 12 de septiembre	https://banobarez.sedelectronica.es
40	Barbadillo	37440	923 34 20 01		barbadilloayuntamiento@gmail.com		20 de junio y 14 de agosto	https://barbadillo.sedelectronica.es
41	Barbalos	37607	923 39 00 20		aytobarbalos@gmail.com		29 de mayo y 30 de mayo	https://barbalos.sedelectronica.es
42	Barceo	37217	923 504 253		aytobarceo@hotmail.com		15 de mayo y 25 de julio	https://barceo.sedelectronica.es
44	Barruecopardo	37255	923 50 70 02		aytobarruecopardo@gmail.com	http://www.barruecopardo.es	11 de septiembre y 12 de septiembre	https://barruecopardo.sedelectronica.es
45	La Bastida	37621	923 44 91 25		aytolabastida@yahoo.es		20 de enero y 19 de agosto	https://labastida.sedelectronica.es
46	Béjar	37700	923 40 01 15	923 41 08 68	dptosecretaria@aytobejar.com	http://www.aytobejar.com	5 de septiembre y 8 de septiembre	https://bejar.sedelectronica.es
47	Beleña	37789	923 38 10 98		ayuntbelena@hotmail.com		13 de junio y 14 de junio	https://belena.sedelectronica.es
49	Bermellar	37291	923 52 23 01	923 52 23 01	aytobermellar@hotmail.com		8 de febrero y 22 de julio	https://bermellar.sedelectronica.es
50	Berrocal de Huebra	37609	923 16 42 11	923 16 46 27	aytoberrocalhuebra@gmail.com		15 de mayo y 7 de junio	https://berrocaldehuebra.sedelectronica.es
51	Berrocal de Salvatierra	37795	923 58 13 29	923 58 13 29	aytoberrocalsalvatierra@gmail.com		2 de julio y 3 de julio	https://berrocaldesalvatierra.sedelectronica.es
52	Boada	37290	923 44 03 91	923 44 03 91	ayuntamientoboada@hotmail.es		7 de julio y 8 de julio	https://boada.sedelectronica.es
54	El Bodón	37520	923 48 60 01	923 48 60 01	ayuntamientoelbodon@gmail.com	http://www.elbodon.es	3 de mayo y 11 de agosto	https://elbodon.sedelectronica.es
55	Bogajo	37291	923 51 92 51	923 51 92 51	aytobogajo@telefonica.net		24 de junio y 25 de junio	https://bogajo.sedelectronica.es
56	La Bouza	37488	923 49 16 34		v_ciervo@yahoo.es		29 de mayo y 8 de agosto	https://labouza.sedelectronica.es
57	Bóveda del Río Almar	37316	923 56 00 18	923 56 00 18	ayto.bovedarioalmar@hotmail.com	http://www.bovedadelrioalmar.es	18 de julio y 22 de septiembre	https://bovedadelrioalmar.sedelectronica.es
58	Brincones	37217	923 51 10 12		aytobrincones@hotmail.com		3 de febrero y 22 de agosto	https://brincones.sedelectronica.es
59	Buenamadre	37209	923 45 00 03	923 45 00 03	ayuntamientobuenamadre@hotmail.com		28 de abril y 8 de mayo	https://buenamadre.sedelectronica.es
60	Buenavista	37789	923 16 80 54	923 16 89 99	ayuntamientobuenavistasalamanc@gmail.com	http://www.buenavista.es	28 de abril y 2 de julio	https://aytobuenavista.sedeelectronica.es
61	El Cabaco	37621	923 45 40 16		aytoelcabaco@yahoo.es		6 de junio y 25 de agosto	https://elcabaco.sedelectronica.es/info.1
62	Cabezabellosa de la Calzada	37490	923 36 18 10		aytocabeza@gmail.com		13 de junio y 14 de agosto	https://cabezabellosadelacalzada.sedelectronica.es
63	La Cabeza de Béjar	37773	923 15 17 33		cabezabejar@gmail.com		28 de abril y 18 de agosto	https://lacabezadebejar.sedelectronica.es
65	Cabeza del Caballo	37214	923 52 25 81	923 52 25 81	ayuntamientocabezadelcaballo@hotmail.es		16 de mayo y 6 de octubre	https://cabezadelcaballo.sedelectronica.es
67	Cabrerizos	37193	923 28 90 63	923 28 90 93	secretaria@ayto-cabrerizos.com	https://www.ayto-cabrerizos.com/	22 de enero y 23 de junio	https://sedeelectronica.ayto-cabrerizos.com/eAdmin/Sede.do
68	Cabrillas	37630	923 44 60 01	923 44 60 01	ayuntamientocabrillas@hotmail.com		17 de enero y 15 de mayo	https://cabrillas.sedeelectronica.es/info.1
69	Calvarrasa de Abajo	37181	923 30 60 24		ayuntamiento@calvarrasadeabajo.es	http://www.aytocalvarrasadeabajo.es/	19 de junio y 15 de septiembre	https://calvarrasadeabajo.sedeelectronica.es/info.0
70	Calvarrasa de Arriba	37191	923 30 83 82	923 10 87 26	aytocalvarrasa@yahoo.es		9 de junio y 10 de junio	https://calvarrasadearriba.sedelectronica.es/info.0
71	La Calzada de Béjar	37714	923 41 65 01		aytolacalzadadebejar@yahoo.es		1 de septiembre y 15 de septiembre	https://lacalzadadebejar.sedeelectronica.es
72	Calzada de Don Diego	37448	923 34 20 67		calzadd@yahoo.es		17 de enero y 24 de junio	https://calzadadedondiego.sedelectronica.es
73	Calzada de Valdunciel	37797	923 31 00 24	923 31 00 24	calzadadevaldunciel@gmail.com	http://www.calzadadevaldunciel.es	30 de mayo y 18 de agosto	https://calzadadevaldunciel.sedelectronica.es
74	Campillo de Azaba	37550	923 48 86 58	923 48 86 58	ayuntamientocampillodeazaba@hotmail.com		20 de3 febrero y 13 de junio	https://campillodeazaba.sedelectronica.es
77	El Campo de Peñaranda	37317	923 55 20 01		aytoelcampo@hotmail.com		23 de junio y 29 de diciembre	https://elcampodepenaranda.sedelectronica.es
78	Candelario	37710	923 41 30 11	923 41 32 80	ayuntamiento@candelario.es	http://www.candelario.es	31 de enero y 25 de julio	https://candelario.sedeelectronica.es
79	Canillas de Abajo	37448	923 16 00 26		ayuntamientocanillasdeabajo@gmail.com		22 de enero y 27 de junio	https://canillasdeabajo.sedeelectronica.es
80	Cantagallo	37716	923 40 20 85	923 40 20 85	 aytocantagallo@hotmail.es		9 de mayo y 15 de septiembre	https://cantagallo.sedelectronica.es
81	Cantalapiedra	37400	923 53 00 01 	923 53 00 01	ayuntamiento@aytocantalapiedra.es		9 de junio y 8 de septiembre	https://cantalapiedra.sedelectronica.es
82	Cantalpino	37405	923 53 20 01	923 53 21 51	ayuntamiento@cantalpino.e.movistar.es	http://www.cantalpino.org	15 de mayo y 14 de agosto	http://cantalpino.sedeelectronica.es
83	Cantaracillo	37319	923 54 16 72	923 54 16 72	ayuntamientodecantaracillo@hotmail.com		2 de mayo y 18 de agosto	https://cantaracillo.sedelectronica.es
85	Carbajosa de la Sagrada	37188	923 20 80 19	923 20 82 35	registro@carbajosadelasagrada.es	http://www.carbajosadelasagrada.es	16 de agosto y 8 de septiembre	https://carbajosadelasagrada.sedeelectronica.es
86	Carpio de Azaba	37497	923 46 18 01	923461801	aytocarpioazaba@hotmail.com 		15 de mayo y 16 de mayo	https://carpiodeazaba.sedelectronica.es
87	Carrascal de Barregas	37129	923 33 01 92	923 33 01 92	ayuntamiento@carrascaldebarregas.com	http://www.carrascaldebarregas.com/index.html	12 de junio y 8 de septiembre	https://carrascaldebarregas.sedelectronica.es
88	Carrascal del Obispo	37451	923 09 75 49		aytocarrascal2@gmail.com		21 de enero y 2 de julio	https://carrascaldelobispo.sedelectronica.es
89	Casafranca	37767	923 15 10 65	923 15 10 65	ayuntamientocasafranca@gmail.com		8 de agosto y 9 de agosto	https://casafranca.sedelectronica.es
90	Las Casas del Conde	37659	923 43 70 18		lascasas.ayto@yahoo.es		8 de agosto y 25 de noviembre	https://lascasasdelconde.sedelectronica.es
91	Casillas de Flores	37541	923 48 88 56	923 48 88 56	aytocasillasdeflores@hotmail.com		15 de enero y 2 de mayo	https://casillasdeflores.sedelectronica.es
92	Castellanos de Moriscos	37439	923 36 14 23	923 36 14 23	info@castellanosdemoriscos.es	http://www.castellanosdemoriscos.es	3 de febrero y 8 de septiembre	https://castellanosdemoriscos.sedelectronica.es
96	Castillejo de Martín Viejo	37592	923 49 00 15	923 49 00 15	aytocastillejomv@gmail.com	http://www.aytocastillejodemartinviejo.es	6 de mayo y 15 de septiembre	https://castillejodemartinviejo.sedelectronica.es
97	Castraz	37496	662 595 734		aytocastraz@gmail.com		24 de junio y 25 de junio	https://castraz.sedelectronica.es
98	Cepeda	37656	923 43 21 01	923 43 21 01	ayuntamientocepeda@yahoo.es		25 de abril y 24 de agosto	http://cepeda.sedelectronica.es
99	Cereceda de la Sierra	37621	923 16 43 00	923 16 43 00	aytocerecedasierra@yahoo.es		15 de enero y 25 de abril	https://cerecedadelasierra.sedelectronica.es
100	Cerezal de Peñahorcada	37253	923 50 70 13		ayuncerezal@gmail.com	http://www.cerezal.es	25 de abril y 2 de agosto	https://cerezaldepenahorcada.sedelectronica.es
101	Cerralbo	37291	923 52 40 78	923 52 40 78	aytocerralbo@hotmail.com		13 de junio y 2 de agosto	https://cerralbo.sedelectronica.es
102	El Cerro	37720	923 43 11 01	923 43 11 01	elcerroayuntamiento@gmail.com		17 de enero y 29 de agosto	https://elcerro.sedelectronica.es
103	Cespedosa de Tormes	37750	923 15 26 95	923 15 26 95	ayuntamientodecespedosa@hotmail.es		8 de septiembre y 9 de septiembre	https://cespedosadetormes.sedelectronica.es
104	Cilleros de la Bastida	37621	923 16 44 55		aytocillerosbastida@yahoo.es		23 de agosto y 13 de diciembre	https://cillerosdelabastida.sedelectronica.es
106	Cipérez	37216	923 51 80 52		aytociperez@reyconet.es		22 de agosto y 25 de agosto	https://ciperez.sedelectronica.es
107	Ciudad Rodrigo	37500	923 49 84 00	923 49 84 01	secretaria@aytociudadrodrigo.es	http://www.aytociudadrodrigo.es 	20 de enero y 8 de septiembre	https://ciudadrodrigo.sedeelectronica.es
108	Coca de Alba	37830	923 54 14 51		ayuntamientococadealba@gmail.com		7 de octubre y 27 de diciembre	https://cocadealba.sedelectronica.es
109	Colmenar de Montemayor	37711	923 69 03 23		aytocolmenardemontemayor@gmail.com		3 de febrero y 15 de septiembre	https://colmenardemontemayor.sedelectronica.es
110	Cordovilla	37337	923 36 07 84	923 36 07 84	aytocordovilla@terra.es		24 de julio y 25 de julio	https://cordovilla.sedelectronica.es
112	Cristóbal	37684	923 43 50 16		ayuntamiento@cristobal.es	https://www.aytocristobal.com/	15 de septiembre y 11 de noviembre	http://cristobal.sedelectronica.es/
113	El Cubo de Don Sancho	37281	923 44 31 37	923 44 31 37	ayto@cubodedonsancho.org	http://www.cubodedonsancho.org	19 de junio y 20 de junio	https://cubodedonsancho.sedelectronica.es
114	Chagarcía Medianero	37861	923 16 17 85		aytochagarcia@gmail.com		1 de agosto y 7 de octubre	https://chagarciamedianero.sedeelectronica.es
115	Dios le Guarde	37478	923 48 50 15		aytodiosleguarde@gmail.com		15 de septiembre y 16 de septiembre	https://diosleguarde.sedeelectronica.es
116	Doñinos de Ledesma	37130	923 57 00 11 - 652 92 06 89	923 57 00 11	mserranov@telefonica.net		3 de febrero y 24 de junio	https://doninosdeledesma.sedeelectronica.es
117	Doñinos de Salamanca	37120	923 33 00 01	923 33 09 14	ayuntamiento@ayto-doninos.com	http://www.ayto-doninos.com	25 de abril y 8 de agosto	https://doninosdesalamanca.sedeelectronica.es
118	Ejeme	37891	923 30 30 24		aytoejeme@yahoo.es		8 de agosto y 28 de agosto	https://ejeme.sedeelectronica.es
119	La Encina	37515	923 49 08 60	923 49 08 60	ayuntamientolaencina@gmail.com		19 de mayo y 18 de agosto	https://laencina.sedelectronica.es
120	Encina de San Silvestre	37114	923 14 04 57 - 652 92 06 89		mserranov@telefonica.net		29 de agosto y 1 de septiembre	https://encinadesansilvestre.sedelectronica.es 
121	Encinas de Abajo	37893	923 36 20 11	923 36 20 11	aytoencinas@telefonica.net	http://www.encinasdeabajo.es	22 de enero y 8 de agosto	https://encinasdeabajo.sedeelectronica.es
122	Encinas de Arriba	37892	923 37 12 83		ayuntencinasarriba@hotmail.com		23 de junio y 26 de diciembre	https://encinasdearriba.sedelectronica.es
123	Encinasola de los Comendadores	37256	923 52 32 02	923 52 32 02	aytoencinasola@reyconet.es		28 de agosto y 29 de agosto	https://encinasoladeloscomendadores.sedelectronica.es
124	Endrinal	37766	923 15 00 05		ayuntamientoendrinal@gmail.com		28 de abril y 24 de junio	https://endrinal.sedeelectronica.es
125	Escurial de la Sierra	37762	923 44 20 38	923 44 92 76	aytoescurialdelasierra@gmail.com		3 de mayo y 18 de julio	https://escurialdelasierra.sedeelectronica.es
126	Espadaña	37148	923 51 82 51		espadana@reyconet.es				https://espadana.sedeelectronica.es
127	Espeja	37497	923 48 38 37	923 48 38 37	aytoespeja@gmail.com	http://www.espeja.es	22 de septiembre y 23 de septiembre	https://espeja.sedelectronica.es
128	Espino de la Orbada	37419	923 36 04 01	923 36 04 11	espinoorbada@hotmail.es		13 de junio y 22 de agosto	https://espinodelaorbada.sedelectronica.es
129	Florida de Liébana	37129	923 33 23 10	923 33 23 10	aytoflorida@gmail.com		13 de junio y 22 de agosto	https://floridadeliebana.sedelectronica.es
130	Forfoleda	37797	923 32 16 21	923 32 16 21	aytoforfoleda@gmail.com	http://www.aytoforfoleda.es	10 de junio y 2 de julio	https://forfoleda.sedelectronica.es
131	Frades de la Sierra	37766	923 39 07 33		ayuntamientofrades@gmail.com		25 de julio y 26 de julio	https://fradesdelasierra.sedelectronica.es
132	La Fregeneda	37220	923 52 11 99	923 52 11 99	ayuntamiento@lafregeneda-ayto.es		3 de febrero y 25 de abril	https://lafregeneda.sedeelectronica.es
133	Fresnedoso	37775	923 41 36 20	923 41 36 20	ayuntamientodefresnedoso@gmail.com		15 de enero y 17 de enero	https://fresnedoso.sedeelectronica.es
134	Fresno Alhándiga	37789	923 38 12 37		aytofresnoalhandiga@gmail.com		2 de mayo y 14 de agosto	https://fresnoalhandiga.sedeelectronica.es/
135	La Fuente de San Esteban	37200	923 44 00 45	923 44 02 20	secretaria@lafuentedesanesteban.es	http://www.lafuentedesanesteban.es	19 de junio y 20 de junio	https://lafuentedesanesteban.sedeelectronica.es
136	Fuenteguinaldo	37540	923 49 71 00	923 49 71 40	secretariaguinaldo@gmail.com	https://www.aytofuenteguinaldo.es/	15 de mayo y 24 de junio	https://fuenteguinaldo.sedeelectronica.es
137	Fuenteliante	37291	923 50 60 21	923 50 60 21	j.s.guerra70@gmail.com		8 de septiembre y 9 de septiembre	https://fuenteliante.sedeelectronica.es
138	Fuenterroble de Salvatierra	37768	923 15 10 86	923 15 11 37	ayuntfuenterroble@gmail.com		21 de abril y 29 de septiembre	https://fuenterrobledesalvatierra.sedeelectronica.es
139	Fuentes de Béjar	37790	923 15 17 95		aytofuentesbejar@gmail.com		3 de febrero y 13 de junio	https://fuentesdebejar.sedeelectronica.es
140	Fuentes de Oñoro	37480	923 47 30 01	923 47 30 16	secretaria@fuentesdeonoro.es	http://www.fuentesdeonoro.es	25 de julio y 18 de agosto	https://fuentesdeonoro.sedeelectronica.es
141	Gajates	37874	923 38 30 15		gajatesayuntamiento@gmail.com 		15 de mayo y 6 de agosto	https://gajates.sedeelectronica.es
142	Galindo y Perahuy	37449	923 34 22 26	923 34 22 26	ayto@aytogalindoyperahuy.com	https://www.aytogalindoyperahuy.com/	3 de julio y 12 diciembre	https://galindoyperahuy.sedeelectronica.es
143	Galinduste	37785	923 39 15 56		aytogalinduste@gmail.com	http://www.galinduste.es	25 de julio y 29 de septiembre	https://galinduste.sedelectronica.es
144	Galisancho	37891	923 30 30 98		aytogalisancho@yahoo.es		30 de mayo y 15 de octubre	https://galisancho.sedeelectronica.es
145	Gallegos de Argañán	37497	923 47 70 01	923 47 70 01	aytogallegos@gmail.com	http://www.aytogallegos.com	24 de abril y 25 de abril	https://gallegosdearganan.sedeelectronica.es
146	Gallegos de Solmirón	37751	923 59 00 01	923 59 00 01	 gallegosdesol@gmail.com	http://gallegosdesolmiron.es/	8 de septiembre y 9 de septiembre	 https://gallegosdesolmiron.sedeelectronica.es/
147	Garcibuey	37658	923 43 71 36		ayuntamientodegarcibuey@hotmail.com		12 de septiembre y 1 de diciembre	https://garcibuey.sedeelectronica.es/
148	Garcihernández	37810	923 37 15 16		aytogarcihernandez@gmail.com		3 de febrero y 24 de junio	https://garcihernandez.sedelectronica.es
149	Garcirrey	37460	923 44 50 50		aytogarcirrey@gmail.com		13 de junio y 14 de junio	https://garcirrey.sedelectronica.es
150	Gejuelo del Barro	37114	923 16 60 51 - 652 92 06 89		mserranov@telefonica.net		22 de agosto y 25 de agosto	https://gejuelodelbarro.sedelectronica.es
151	Golpejas	37170	923 32 00 00 	923 31 30 42	ayuntamientodegolpejas@gmail.com		22 de agosto y 25 de agosto	https://golpejas.sedelectronica.es
152	Gomecello	37420	923 35 00 52	923 35 00 52	aytogomecello@gmail.com		22 de agosto y 25 de agosto	https://gomecello.sedelectronica.es
154	Guadramiro	37219	923 50 10 23		aytoguadramiro@reyconet.es		11 de julio y 14 de julio	https://guadramiro.sedelectronica.es
155	Guijo de Ávila	37774	923 58 08 71		aytoguijoavila@gmail.com		12 de junio y 13 de junio	https://guijodeavila.sedelectronica.es
156	Guijuelo	37770	923 58 07 86	923 58 07 87	secretaria.alcalde@guijuelo.es	http://www.guijuelo.es	28 de abril y 18 de agosto	https://guijuelo.sedelectronica.es
157	Herguijuela de Ciudad Rodrigo	37516	923 48 72 99	923 48 72 99	aytoherguicr@hotmail.com		3 de febrero y 5 de agosto	https://herguijueladeciudadrodrigo.sedelectronica.es
158	Herguijuela de la Sierra	37619	923 43 31 21		aytoherguijueladelasierra@hotmail.com		3 de febrero y 16 de julio	https://herguijueladelasierra.sedelectronica.es
159	Herguijuela del Campo	37759	923 16 12 72	923 16 12 72	ayuntamientos@aveguillas.es		1 de febrero y 20 de septiembre	https://herguijueladelcampo.sedelectronica.es
160	Hinojosa de Duero	37230	923 51 50 03	923 51 50 16	ayto.hinojosa@gmail.com		21 de abril y 24 de junio	https://hinojosadeduero.sedelectronica.es
161	Horcajo de Montemayor	37712	923 41 73 06	923 41 73 06	aytohorcajodemontemayor@gmail.com		15 de mayo y 30 de junio	https://horcajodemontemayor.sedelectronica.es
162	Horcajo Medianero	37860	923 16 21 72		aytohorcajomedianero@gmail.com	https://horcajomedianero.es/	15 de mayo y 11 de noviembre	https://horcajomedianero.sedelectronica.es
163	La Hoya	37716	923 41 11 11		concejodelahoya@hotmail.com		22 de agosto y 25 de agosto	https://lahoya.sedelectronica.es
164	Huerta	37336	923 36 20 92	923 36 20 92	info@ayuntamientohuerta.es	http://www.ayuntamientohuerta.es	4 de marzo y 25 de agosto	https://huerta.sedelectronica.es
165	Iruelos	37217	923 16 19 53		aytoiruelos@hotmail.es		16 de junio y 14 de agosto	https://iruelos.sedelectronica.es/
166	Ituero de Azaba	37551	923 47 10 10	923 47 10 10	ayuntamientoituero@hotmail.com		7 de agosto y 4 de diciembre	https://ituerodeazaba.sedelectronica.es
167	Juzbado	37115	923 32 13 36	600432972	juzbadoayuntamiento@gmail.com	http://www.juzbado.es 	19 de septiembre y 26 de septiembre	https://juzbado.sedelectronica.es
168	Lagunilla	37724	923 41 77 57	923 41 77 57	ayuntamientolagunilla@hotmail.com		13 de junio y 15 de septiembre	https://lagunilla.sedeelectronica.es
169	Larrodrigo	37865	923 38 32 91		aytolarrodrigo@gmail.com		3 de febrero y 30 de junio	https://larrodrigo.sedelectronica.es
170	Ledesma	37100	923 57 00 15	923 57 06 00	informacion@ayuntamientodeledesma.com	http://www.ayuntamientodeledesma.com	19 de junio y 23 de junio	https://ledesma.sedeelectronica.es
171	Ledrada	37730	923 59 10 01	923 40 86 03	aytoledrada@gmail.com	http://www.aytoledrada.com	13 de junio y 29 de agosto	https://ledrada.sedeelectronica.es
172	Linares de Riofrío	37760	923 41 60 66	923 41 63 74	secretaria@linaresderiofrio.es	http://www.linaresderiofrio,es	28 de abril y 14 de agosto	https://linaresderiofrio.sedeelectronica.es
173	Lumbrales	37240	923 51 20 02 	923 51 21 61	ayto.lumbrales@outlook.com	https://www.lumbrales.es/	15 de mayo y 25 de agosto	https://lumbrales.sedelectronica.es
174	Macotera	37310	923 55 50 03	923 55 50 61	secretaria@macotera.es	http://www.macotera.es	16 de agosto y 8 de septiembre	https://macotera.sedeelectronica.es
175	Machacón	37894	923 30 61 90	923 30 61 90	aytomachacon@gmail.com	https://www.aytomachacon.es/	15 de mayo y 19 de mayo	https://machacon.sedelectronica.es
176	Madroñal	37619	923 43 30 02	 923 43 30 02	ayuntamientomad@yahoo.es		25 de julio y 28 de julio	http://madronal.sedeelectronica.es
177	El Maíllo	37621	923 48 55 01	923 48 55 01	ayuntamientoelmaillo@gmail.com	http://www.elmaillo.es	6 de octubre y 7 de octubre	https://elmaillo.sedeelectronica.es/
178	Malpartida	37313	923 55 00 16	923 55 00 16	ayto.malpartida@hotmail.com		13 de junio y 29 de agosto	https://malpartida.sedelectronica.es
179	Mancera de Abajo	37315	923 56 00 01	923 56 00 01	ayto.manceradeabajo@hotmail.com	http://www.manceradeabajo.es	2 de julio y 3 de julio	https://manceradeabajo.sedelectronica.es
180	El Manzano	37171	923 57 71 71	923 57 71 71	elmanzanoayunta@gmail.com		7 de enero y 4 de octubre	https://elmanzano.sedelectronica.es
181	Martiago	37510	923 48 70 01		aytomartiago@gmail.com		13 de junio y 15 de septiembre	https://martiago.sedelectronica.es
182	Martinamor	37891	923 16 05 57		ayuntamientomartinamor@gmail.com		2 de febrero y 24 de agosto 	https://martinamor.sedelectronica.es
183	Martín de Yeltes	37494	923 44 03 20	923 44 03 20	ayuntamientomartindeyeltes@gmail.com		13 de junio y 11 de noviembre	https://martindeyeltes.sedelectronica.es
184	Masueco	37251	923 50 50 18	923 50 50 18	aytomasueco@gmail.com		3 de mayo y 20 de agosto	https://masueco.sedelectronica.es
185	Castellanos de Villiquera	37797	923  32 02 18	923 32 02 38	ayto.villiquerados@gmail.com	https://www.castellanosdevilliquera.es	31 de enero y 24 de junio	https://castellanosdevilliquera.sedelectronica.es
186	La Mata de Ledesma	37130	923 14 06 00		ayunlamata@gmail.com		8 de mayo y 18 de agosto	https://lamatadeledesma.sedelectronica.es
187	Matilla de los Caños del Río	37450	923 38 20 52	923 38 20 52	aytomatilla@hotmail.com	http://www.matilladeloscañosdelrio.es	3 de marzo y 25 de julio	https://matilladeloscanosdelrio.sedelectronica.es
188	La Maya	37780	923 08 89 07		aytolamaya@gmail.com		3 de febrero y 25 de julio	http://lamaya.sedelectronica.es/
189	Membribe de la Sierra	37766	923 38 00 21	923 38 00 21	ayuntamientos@aveguillas.es		14 de agosto y 18 de agosto	https://membribedelasierra.sedelectronica.es
190	Mieza	37254	923 52 34 87		aytodemieza@gmail.com	http://www.mieza.es	20 de enero y 8 de septiembre	https://mieza.sedelectronica.es
191	El Milano	37256	923 50 79 20	923 50 79 20	aytomilano@hotmail.es		13 de junio y 16 de junio	http://elmilano.sedelectronica.es
192	Miranda de Azán	37187	923 13 38 11	923 13 38 11	aytomirandadeazan@gmail.com	http://www.mirandadeazan.com	2 de junio y 10 de julio	https://mirandadeazan.sedelectronica.es
193	Miranda del Castañar	37660	923 43 20 01 		ayuntamientodemiranda@hotmail.com		8 de septiembre y 9 de septiembre	https://mirandadelcastanar.sedelectronica.es
194	Mogarraz	37610	923 41 81 09		ayuntamiento@mogarraz.es		5 de agosto y 6 de agosto	https://mogarraz.sedelectronica.es
195	Molinillo	37683	923 16 11 70		aytomolinillo@yahoo.es		3 de mayo y 25 de agosto	https://molinillo.sedelectronica.es
196	Monforte de la Sierra	37618	923 41 80 01		monforte.ayto@yahoo.es		9 de mayo y 15 de septiembre	https://monfortedelasierra.sedelectronica.es
197	Monleón	37765	923 15 00 72	923 15 00 72	ayuntamiento@monleon.eu		3 de febrero y 4 de julio	https://monleon.sedelectronica.es
198	Monleras	37171	923 57 50 01	923 57 50 01	monlerasayunta@gmail.com	http://www.monleras.es	23 de junio y 14 de agosto	https://monleras.sedelectronica.es
199	Monsagro	37532	923 48 95 03		alcaldia@monsagro.es		29 de enero y 15 de septiembre	https://monsagro.sedelectronica.es
200	Montejo	37795	923 38 10 09		aytomontejo@gmail.com		3 de febrero y 13 de junio	https://montejo.sedelectronica.es
201	Montemayor del Río	37727	923 43 11 51	923 43 11 51	ayuntamientomontemayordelrio@gmail.com		3 de febrero y 14 de septiembre	https://montemayordelrio.sedelectronica.es
202	Monterrubio de Armuña	37798	923 28 83 24	923 20 30 02	administrador@monterrubioarmuna.org	http://www.monterrubioarmuna.es	12 de junio y 8 de septiembre	http://monterrubiodearmuna.sedelectronica.es
203	Monterrubio de la Sierra	37781	923 34 41 76		aytomonterrubiodelasierrasa@gmail.com		24 de junio y 29 de septiembre	http://monterrubiodelasierra.sedelectronica.es
204	Morasverdes	37590	923 48 52 01		ayuntamientodemorasverdes@hotmail.com	https://morasverdes.net/	13 de junio y 25 de agosto	https://morasverdes.sedelectronica.es/
205	Morille	37183	923 34 40 16		aytomorille@morille.es	http://www.morille.es/	6 de agosto y 7 de agosto	https://morille.sedelectronica.es
206	Moríñigo	37337	923 36 06 50	923 36 06 50	aytomorinigo@terra.es		13 de junio y 4 de diciembre	https://morinigo.sedelectronica.es
207	Moriscos	37430	923 36 14 30		aytomoriscos@gmail.com		15 de mayo y 4 de agosto	https://moriscos.sedelectronica.es
208	Moronta	37258	923 16 42 66		aytomoronta@yahoo.com		22 de enero y 15 de mayo	https://moronta.sedeelectronica.es
209	Mozárbez	37796	923 30 82 55	923  30 82 55	ayto_mozarbez@yahoo.es	http://www.mozarbez.com	3 de febrero y 25 de julio	https://mozarbez.sedelectronica.es
211	Narros de Matalayegua	37609	923 39 00 09	923 39 00 09	aytonarrosmatalayegua@yahoo.es		19 de junio y 20 de junio	https://narrosdematalayegua.sedelectronica.es
212	Navacarros	37716	923 40 22 08		ayuntamientodenavacarros@hotmail.es		21 de julio y 22 de julio	https://navacarros.sedelectronica.es
213	Nava de Béjar	37776	923 59 11 10		aytonavabejar@gmail.com		5 de mayo y 4 de agosto	https://navadebejar.sedelectronica.es
214	Nava de Francia	37659	923 16 43 42		aytonavadefrancia@yahoo.es		3 de febrero y 18 de agosto	https://navadefrancia.sedelectronica.es
215	Nava de Sotrobal	37850	923 54 12 35	923 54 12 35	ayto@navadesotrobal.es		13 de junio y 29 de septiembre	https://navadesotrobal.sedelectronica.es
216	Navales	37882	923 30 01 83		aytonavales@yahoo.es	https://aytonavales.es/	8 de septiembre y 31 de diciembre	https://navales.sedeelectronica.es
217	Navalmoral de Béjar	37794	923 16 50 96		aytonavalmoraldebejar@hotmail.com		22 de agosto y 23 de agosto	https://navalmoraldebejar.sedelectronica.es
218	Navamorales	37749	923 15 23 28		aytonavamorales@hotmail.com		25 de abril y 14 de agosto	https://navamorales.sedelectronica.es
219	Navarredonda de la Rinconada	37607	923 45 06 95		navarredondadelarinconada@gmail.com		31 de mayo y 29 de noviembre	https://navarredondadelarinconada.sedelectronica.es
221	Navasfrías	37542	923 47 50 01	923 47 52 73	ayuntamientonavasfrias@hotmail.com		23 de junio y 24 de junio	https://navasfrias.sedeelectronica.es
222	Negrilla de Palencia	37426	923 35 44 99		ayuntamientonegrilladepalencia@gmail.com		15 de mayo y 23 de agosto	https://negrilladepalencia.sedelectronica.es
223	Olmedo de Camaces	37292	923 50 62 57	923 50 62 57	aytoolmedo@hotmail.es		21 de abril y 22 de abril	http://olmedodecamaces.sedeelectronica.es
224	La Orbada	37428	923 36 28 10	923 36 28 10	secretario@laorbada.es	http://www.laorbada.es	28 de abril y 9 de mayo	https://laorbada.sedelectronica.es
225	Pajares de la Laguna	37428	923 17 20 17		secretario@pajaresdelalaguna.es	http://www.pajaresdelalaguna.es	22 de agosto y 23 de agosto	https://pajaresdelalaguna.sedelectronica.es
226	Palacios del Arzobispo	37111	923 32 08 47	923 32 08 47	aytodepalaciosdelarzobispo@hotmail.com	https://www.palaciosdelarzobispo.com	23 de junio y 24 de junio	https://palaciosdelarzobispo.sedelectronica.es
228	Palaciosrubios	37406	638120933	923 53 32 75	aytopalaciosrubios@gmail.com	http://www.palaciosrubios.es	3 de febrero y 5 de agosto	https://palaciosrubios.sedelectronica.es
229	Palencia de Negrilla	37426	923 35 42 09		ayuntamientopalenciadenegrilla@gmail.com		2 de mayo y 5 de septiembre	https://palenciadenegrilla.sedelectronica.es
230	Parada de Arriba	37129	923 170934		aytoparada@gmail.com		2 de mayo y 29 de julio	https://paradadearriba.sedelectronica.es
231	Parada de Rubiales	37419	923 36 00  01		ayuntamientodeparada@hotmail.com		3 de febrero y 16 de junio	https://paradaderubiales.sedelectronica.es
232	Paradinas de San Juan	37318	923 56 20 02	923 56 22 58	aytoparadinasdesanjuan@hotmail.com		28 de abril y 30 de junio	https://paradinasdesanjuan.sedelectronica.es
233	Pastores	37510	923 49 08 08	923 49 08 08	ayuntamientopastores@gmail.com		18 de abril y 20 de octubre	https://pastores.sedelectronica.es
234	El Payo	37524	923 48 67 01	923 48 67 01	ayto.elpayo@hotmail.com		23 y 24 de junio 	https://elpayo.sedelectronica.es/
235	Pedraza de Alba	37882	923 38 31 10	923 38 31 10	aytopedraza@yahoo.es		24 de junio y 8 de septiembre	https://pedrazadealba.sedelectronica.es
236	Pedrosillo de Alba	37871	923 30 00 63		aytopedrosillodealba@gmail.com		30 de junio y 29 de agosto	https://pedrosillodealba.sedelectronica.es
237	Pedrosillo de los Aires	37788	923 39 06 03	923 39 06 03	aytopedrosilloaires@yahoo.com		19 de marzo y 19 de junio	https://pedrosillodelosaires.sedelectronica.es
238	Pedrosillo el Ralo	37427	923 35 43 75	923 35 43 75	ayto.pedrosilloelralo@gmail.com	http://www.pedrosilloelralo.es	18 de julio y 28 de noviembre	https://pedrosilloelralo.sedelectronica.es
239	El Pedroso de la Armuña	37410	923 36 02 01		aytopedroso@gmail.com		16 de julio y 27 de agosto	https://elpedrosodelaarmuna.sedelectronica.es
240	Pelabravo	37181	923 30 50 81 /50	923 37 40 15	ayuntamiento@pelabravo.es	http://www.pelabravo.es	24 de junio y 12 de diciembre	https://pelabravo.sedelectronica.es
241	Pelarrodríguez	37209	923 45 02 22	923 45 02 22	ayuntamientopelarrodriguez@hotmail.com		12 de septiembre y 15 de septiembre	https://pelarrodriguez.sedelectronica.es
242	Pelayos	37787	923 39 15 93		multiaventurapelayos@yahoo.es		15 de mayo y 1 de julio	https://pelayos.sedelectronica.es
243	La Peña	37214	923 57 72 22		aytolapena@yahoo.es		4 de julio y 5 de julio	https://lapena.sedelectronica.es
244	Peñacaballera	37727	923 41 41 56		secreaytopena@gmail.com		6 de agosto y 15 de septiembre	https://penacaballera.sedelectronica.es
245	Peñaparda	37523	923 48 63 31		ayuntamiento@penaparda.com	http://www.penaparda.com	20 de junio y 23 de junio	https://penaparda.sedelectronica.es
246	Peñaranda de Bracamonte	37300	923 54 00 01	923 54 15 01	secretario@bracamonte.es	http://www.bracamonte.org/	5 de marzo y 29 de septiembre	https://penarandadebracamonte.sedelectronica.es
247	Peñarandilla	37820	923 37 10 35		aytopenarandilla@gmail.com		15 de mayo y 23 de junio	https://penarandilla.sedelectronica.es
248	Peralejos de Abajo	37216	923 50 09 31	923 50 09 31	peralejosdeabajo@reyconet.es	http://peralejosdeabajo.sedeelectronica.es	3 de febrero y 24 de junio	https://peralejosdeabajo.sedelectronica.es
249	Peralejos de Arriba	37216	923 16 90 80		peralejosdearriba@reyconet.es			https://peralejosdearriba.sedelectronica.es
250	Pereña de la Ribera	37175	923 57 30 16	923 57 30 16	aytoperena@gmail.com		14 de mayo y 8 de septiembre	https://perenadelaribera.sedelectronica.es
251	Peromingo	37791	923 16 51 62		ayuntamientoperomingo@gmail.com		4 de agosto y 5 de agosto	https://peromingo.sedelectronica.es
252	Pinedas	37712	923 42 00 30	923 42 00 30	aytopinedas@gmail.com		13 de junio y 5 de agosto	https://pinedas.sedelectronica.es
253	El Pino de Tormes	37170	923 33 23 30		aytopino@gmail.com		8 de agosto y 9 de agosto	https://elpinodetormes.sedeelectronica.es
254	Pitiegua	37490	923 36 19 29		pitieguaayto@gmail.com	http://www.pitiegua.es	24 de enero y 26 de septiembre	https://pitiegua.sedelectronica.es
255	Pizarral	37795	923 58 08 91		ayuntamientopizarral@gmail.com	http://www.pizarral.es/	6 de octubre y 5 de diciembre	https://pizarral.sedelectronica.es
256	Poveda de las Cintas	37406	923 53 16 28		aytopoveda37@gmail.com		1 de agosto y 6 de octubre	https://povedadelascintas.sedelectronica.es
257	Pozos de Hinojo	37216	923 16 90 33		ayuntamientopozosdehinojo@hotmail.com		25 de abril y 3 de mayo	https://pozosdehinojo.sedelectronica.es
258	Puebla de Azaba	37553	923 47 10 17	923 47 10 17	ayuntamiento.puebla@hotmail.com	http://www.puebladeazaba.es	2 de mayo	https://puebladeazaba.sedelectronica.es
259	Puebla de San Medel	37791	923 15 07 38		aytopueblasanmedel@gmail.com		4 de julio y 29 de agosto	https://puebladesanmedel.sedelectronica.es
260	Puebla de Yeltes	37606	923 44 93 47	923 44 93 47	ayuntamientopueblayeltes@hotmail.com		15 de mayo y 1 de septiembre	https://puebladeyeltes.sedeelectronica.es
261	Puente del Congosto	37748	923 15 22 63		aytopuentedelcongosto@hotmail.com		14 de agosto y 18 de agosto	https://puentedelcongosto.sedelectronica.es
262	Puertas	37159	923 16 91 11		puertas@reyconet.es			https://puertas.sedelectronica.es
263	Puerto de Béjar	37720	923 41 40 98	923 41 40 98	aytopuertodebejar@hotmail.es		12 de septiembre y 15 de septiembre	https://puertodebejar.sedelectronica.es
264	Puerto Seguro	37488	923 49 14 13		v_ciervo@yahoo.es	http://aytopuertoseguro.es/	13 de junio y 20 de agosto	https://puertoseguro.sedeelectronica.es
265	Rágama	37318	923 56 20 15		aytoragama@gmail.com	www.ayuntamientoragama.es	4 de agosto y 6 de octubre	https://ayuntamientoragama.sedelectronica.es
266	La Redonda	37247	923 50 44 35		ayuntamientodelaredonda@yahoo.es		3 de mayo y 16 de agosto	http://laredonda.sedelectronica.es
267	Retortillo	37495	923 45 04 33		ayuntamientoretortillo@hotmail.com		3 de febrero y 26 de junio	https://retortillo.sedelectronica.es
268	La Rinconada de la Sierra	37607	923 45 07 19		rinconadadelasierra@gmail.com		3 de febrero y 25 de julio	https://larinconadadelasierra.sedelectronica.es
269	Robleda	37521	923 48 62 01		aytorobleda@gmail.com	http:www.robleda.es	24 de junio y 14 de agosto	https://robleda.sedelectronica.es
270	Robliza de Cojos	37130	923 38 20 06	923 38 20 06	aytorobliza@gmail.com		18 de enero y 8 de agosto	https://roblizadecojos.sedelectronica.es
271	Rollán	37447	923 31 30 42	923 31 30 42	secretariorollan@hotmail.es	http://www.ayuntamientoderollan.com/	20 de enero y 11 de agosto	https://rollan.sedelectronica.es
272	Saelices el Chico	37592	923 49 00 98		aytosaeliceselchico@gmail.com	http://www.saeliceselchico.es	2 de mayo y 11 de agosto	https://saeliceselchico.sedelectronica.es
273	La Sagrada	37465	923 16 44 84	923 16 44 84	aytolasagrada@gmail.com		15 de mayo y 30 de mayo	https://lasagrada.sedelectronica.es
274	Salamanca	37002	923 27 91 00	923 27 91 14	ayuntamiento@aytosalamanca.es	http://www.aytosalamanca.es	12 de junio y 8 de septiembre	https://www.aytosalamanca.gob.es
275	Saldeana	37259	923 52 30 01	923 52 30 01	aytosaldeana@gmail.com		25 de julio y 8 de septiembre	https://saldeana.sedelectronica.es
276	Salmoral	37314	923 56 00 63	923 56 00 63	ayto.salmoral@hotmail.es		14 de agosto y 15 de septiembre	https://salmoral.sedelectronica.es
277	Salvatierra de Tormes	37779	923 15 05 91	923 15 05 91	ayuntamiento@salvatierradetormes.es		5 de marzo y 2 de agosto	https://salvatierradetormes.sedelectronica.es
278	San Cristóbal de la Cuesta	37439	923 36 13 00		secretario@sancristobaldelacuesta.es	http://www.sancristobaldelacuesta.es	9 de junio y 1 de agosto	https://sancristobaldelacuesta.sedelectronica.es
279	Sancti-Spíritus	37470	923 48 40 17		secretaria@ayto-sanctispiritus.com	http://www.ayto-sanctispiritus.com	23 de junio y 24 de junio	https://sanctispiritus.sedelectronica.es
280	Sanchón de la Ribera	37217	923  51 12 93		aytosanchondelaribera@gmail.com			https://sanchondelaribera.sedelectronica.es
281	Sanchón de la Sagrada	37466	923 088815		aytosanchon@gmail.com		8 de mayo y 24 de septiembre	https://sanchondelasagrada.sedelectronica.es
282	Sanchotello	37794	923 59 11 51		ayuntasanchotello@hotmail.es	http://www.lasalina.es/sanchotello	14 de agosto y 16 de agosto	https://sanchotello.sedelectronica.es
283	Sando	37468	923 51 04 59	923 51 04 59	santamariadesando@gmail.com	http://www.sando.es	11 de julio y 14 de julio	https://sando.sedelectronica.es
284	San Esteban de la Sierra	37671	923 43 50 01	923 43 50 01	info@aytosanesteban.es	http://www.aytosanesteban.es	5 de febrero y 15 de septiembre	https://sanestebandelasierra.sedelectronica.es
285	San Felices de los Gallegos	37270	923 52 15 17	923 52 15 17	aytosanfelices@gmail.com	http://www.sanfelicesdelosgallegos.es 	2 de mayo y 12 de mayo	https://sanfelicesdelosgallegos.sedelectronica.es
286	San Martín del Castañar	37659	923 43 70 10	923 43 70 10	ayuntamientosanmartin@yahoo.es		22 de abril y 11 de noviembre	https://sanmartindelcastanar.sedelectronica.es
287	San Miguel de Valero	37763	923 41 55 22	923 41 55 22	ayuntamiento@sanmigueldevalero.es	http://www.sanmigueldevalero.es	29 de septiembre y 30 de septiembre	https://sanmigueldevalero.sedelectronica.es
288	San Morales	37340	923 36 30 77		aytosanmorales@hotmail.com	http://www.sanmorales.es/	23 y 24 de agosto 	https://sanmorales.sedelectronica.es
289	San Muñoz	37208	923 44 80 01	923 44 80 01	aytosanmunoz@gmail.com		4 de marzo y 24 de junio	https://sanmunoz.sedelectronica.es
290	San Pedro del Valle	37170	923 32 04 24		spedrovalle@inicia.es;secretaria@sanpedrodelvalle.es		30 de junio y 5 de septiembre	https://sanpedrodelvalle.sedelectronica.es
291	San Pedro de Rozados	37183	923 34 40 01	923 34 40 01	ayunsanpedro@hotmail.com	http://sanpedroderozados.es/	3 de febrero y 19 de junio	https://sanpedroderozados.sedelectronica.es
292	San Pelayo de Guareña	37110	923 32 13 15	600432972	ayuntamientosanpelayo@gmail.com		24 de junio y 27 de junio	https://sanpelayodeguarena.sedelectronica.es
293	Santa María de Sando	37468	923 51 05 05	923 51 04 59	santamariadesando@gmail.com	http://www.santamariadesando.es	22 de agosto y 25 de agosto	https://santamariadesando.sedelectronica.es
294	Santa Marta de Tormes	37900	923 20 00 05	923 20 01 01	jmpastor@santamartadetormes.org	http://www.santamartadetormes.es	3 de febrero y 29 de julio	http://santamartadetormes.sedelectronica.es/
296	Santiago de la Puebla	37311	923 56 43 89	923 56 43 89	aytosantiago@hotmail.com		24 de julio y 25 de julio	https://santiagodelapuebla.sedelectronica.es
297	Santibáñez de Béjar	37740	923 59 40 01	923 59 40 01	consistoriosb@hotmail.com	http://www.santibanezdebejar.es	6 de octubre y 7 de octubre	https://santibanezdebejar.sedelectronica.es
298	Santibáñez de la Sierra	37670	923 43 53 81		aytosantibanez@hotmail.com		3 de febrero y 28 de agosto	https://santibanezdelasierra.sedelectronica.es
299	Santiz	37110	923 32 09 34		aytodesantiz@hotmail.es	https://www.santizsalamanca.com	29 de septiembre y 30 de septiembre	https://santiz.sedelectronica.es
300	Los Santos	37768	923 59 20 01		ayuntamiento@lossantos.es	http://www.lossantos.es	28 de abril y 25 de agosto	https://lossantos.sedelectronica.es
301	Sardón de los Frailes	37172	923  57 50 78	923  57 50 78	ayto_sardon@yahoo.es	http://www.sardondelosfrailes.es	23 de agosto y 27 de septiembre	https://sardondelosfrailes.sedelectronica.es
302	Saucelle	37257	923 51 30 61	923 51 30 61	aysaucelle@yahoo.es		21 de abril y 11 de agosto	https://saucelle.sedeelectronica.es
303	El Sahúgo	37510	923 48 73 01		aytoelsahugo@gmail.com		7 de agosto y 24 de septiembre	https://elsahugo.sedelectronica.es
304	Sepulcro-Hilario	37638	923 44 60 69	923 44 60 69	ayuntamientosepulcrohilario@hotmail.com		3 de febrero y 19 de junio	https://sepulcrohilario.sedelectronica.es
305	Sequeros	37650	923 43 70 01	923 43 70 01	ayunt_sequeros@hotmail.com		2 de mayo y 14 de agosto	https://sequeros.sedelectronica.es
306	Serradilla del Arroyo	37531	923 48 90 01		alcalde@aytoserradilla.es		3 de febrero y 11 de agosto	https://serradilladelarroyo.sedelectronica.es
307	Serradilla del Llano	37530	923 48 90 35	923 48 90 35	ayuntaserradilla@hotmail.com		5 de agosto y 25 de noviembre	https://serradilladelllano.sedelectronica.es
309	La Sierpe	37759	923 16 10 11		ayuntamientos@aveguillas.es		21 de junio y 9 de agosto	https://lasierpe.sedeelectronica.es
310	Sieteiglesias de Tormes	37892	923 37 12 01		ayuntsieteiglesiastormes@hotmail.com		5 de mayo y 20 de junio 	https://sieteiglesiasdetormes.sedelectronica.es
311	Sobradillo	37246	923 52 20 41	923 52 20 41	ayuntamientodesobradillo@yahoo.es		24 de julio y 25 de julio	http://sobradillo.sedelectronica.es
312	Sorihuela	37777	923 41 35 38	923 41 35 38	ayuntamientosorihuelasalamanca@gmail.com		20 de enero y 15 de septiembre	https://sorihuela.sedelectronica.es
313	Sotoserrano	37657	923 42 21 29	923 42 21 29	ayuntamiento@sotoserrano.com	http://www.sotoserrano.com	1 de septiembre y 15 de septiembre	https://sotoserrano.sedelectronica.es
314	Tabera de Abajo	37130	923 44 51 07		ayuntamientodetaberadeabajo@hotmail.es		4 de diciembre y 5 diciembre	https://taberadeabajo.sedelectronica.es
315	La Tala	37752	923 15 03 11		aytolatala@gmail.com	http://www.latala.es/	13 de junio y 14 de junio	https://latala.sedelectronica.es/
316	Tamames	37600	923 44 99 05	923  44 90 01	secretaria@tamames.net		29 de septiembre y 30 de septiembre	https://tamames.sedeelectronica.es
317	Tarazona de Guareña	37409	923 53 11 37		aytotarazonasalamanca@gmail.com		13 de mayo y 29 de septiembre	https://tarazonadeguarena.sedeelectronica.es
318	Tardáguila	37429	923 35 40 65	923 35 40 65	aytotardaguila@hotmail.com		16 de abril y 1 de agosto	https://tardaguila.sedelectronica.es
319	El Tejado	37749	923 15 24 32		aytoeltejado@gmail.com	http://www.eltejado.es/	13 de junio y 22 de julio	https://eltejado.sedelectronica.es/
320	Tejeda y Segoyuela	37607	923 45 07 07		tejedaysegoyuela@gmail.com		3 de febrero y 13 de junio	https://tejedaysegoyuela.sedelectronica.es
321	Tenebrón	37589	923 48 58 01		ayuntamientodetenebron@hotmail.com		15 de mayo y 26 de agosto	https://tenebron.sedelectronica.es/
322	Terradillos	37882	923 37 30 86		secretaria@ayto-terradillos.com	http://www.ayto-terradillos.com	25 de enero y 4 de septiembre	https://terradillos.sedelectronica.es
323	Topas	37799	923 35 50 08	923 35 52 14	ayuntamientotopas@gmail.com		12 de junio y 13 de junio	https://topas.sedelectronica.es
324	Tordillos	37840	923 56 47 10		aytotordillos@gmail.com		13 de junio y 5 de agosto	https://tordillos.sedelectronica.es
325	El Tornadizo	37765	923 41 55 32	923 41 55 32	ayuntamiento@eltornadizo.es		20 de enero y 8 de septiembre	https://eltornadizo.sedelectronica.es
327	Torresmenudas	37110	923 32 15 39	923 32 15 39	ayto.torresmenudas@yahoo.es		28 de abril y 18 de noviembre	https://torresmenudas.sedelectronica.es
328	Trabanca	37173	923 14 14 48	923 14 14 48	ayuntamientotrabanca@gmail.com	www.trabanca.es	16 de julio y 12 de septiembre	https://trabanca.sedelectronica.es
329	Tremedal de Tormes	37148	923 16 90 50		aytotremedaldetormes@yahoo.es		16 de agosto y 20 de septiembre	https://tremedaldetormes.sedelectronica.es
330	Valdecarros	37881	923 38 30 24		aytovaldecarros@gmail.com		22 de enero y 18 de agosto	https://valdecarros.sedeelectronica.es
331	Valdefuentes de Sangusín	37680	923 41 38 18	923 09 91 26	ayuntavaldefuentes@hotmail.com		19 de septiembre y 22 de septiembre	https://valdefuentesdesangusin.sedeelectronica.es
332	Valdehijaderos	37713	923 41 65 64	923 41 65 64	aytovaldehijaderos@gmail.com		25 de abril y 29 de agosto	https://valdehijaderos.sedelectronica.es
333	Valdelacasa	37791	923 15 07 67		aytovaldelacasa37@gmail.com		15 de septiembre y 16 de septiembre	http://valdelacasa.sedelectronica.es
334	Valdelageve	37725	636 17 48 98		ayuntamientolagunilla@hotmail.com		20 de febrero y 13 de junio	https://valdelageve.sedeelectronica.es
335	Valdelosa	37799	923 31 42 40		aytovaldelosa@gmail.com	http://www.valdelosa.com/	14 de agosto y 18 de agosto	https://valdelosa.sedelectronica.es
336	Valdemierque	37891	923 16 34 35		ayuntamientovaldemierque@gmail.com		16 de agosto y 18 agosto	https://valdemierque.sedelectronica.es
337	Valderrodrigo	37256	923 51 06 08	923 51 06 08	aytovalderrodrigo@reyconet.es		3 de octubre y 6 de octubre	https://valderrodrigo.sedelectronica.es
338	Valdunciel	37798	923 31 01 62		ayto.valdunciel@gmail.com		8 de agosto y 11 de agosto	http://valdunciel.sedelectronica.es
339	Valero	37764	923 41 56 94		aytovalero@hotmail.es		28 de enero y 29 de enero	 http://valero.sedelectronica.es
340	Valsalabroso	37214	923 51 06 60		ayuntamientovalsalabroso@yahoo.es		20 de enero y 12 de mayo	https://valsalabroso.sedelectronica.es
341	Valverde de Valdelacasa	37791	923 16 50 70	923 16 50 70	aytovalverdedevaldelacasa@gmail.com		2 de mayo y 25 de julio	https://valverdedevaldelacasa.sedelectronica.es
342	Valverdón	37115	923 32 11 41	923 32 11 41	aytovalverdon@gmail.com	http://www.valverdon.es	16 de junio y 24 de junio	https://valverdon.sedelectronica.es
343	Vallejera de Riofrío	37717	923 40 44 04	923 40 44 04	concejodevallejera@hotmail.com		14 de agosto y 18 de agosto	https://vallejeraderiofrio.sedelectronica.es
344	Vecinos	37456	923 38 20 17	923 38 20 17	aytovecinos@hotmail.com	http://www.vecinos.es	20 de enero y 14 de junio	https://vecinos.sedelectronica.es
345	Vega de Tirados	37170	923 32 05 45		aytovegatirados@gmail.com		28 de abril y 29 de abril	https://vegadetirados.sedelectronica.es
346	Las Veguillas	37454	923 38 00 14	923 38 00 14	ayuntamientos@aveguillas.es		18 de junio y 6 de octubre	https://lasveguillas.sedelectronica.es
347	La Vellés	37427	923 35 40 01	923 35 40 01	secretaria@lavelles.es	http://www.lavelles.es	24 de junio y 29 de agosto	https://lavelles.sedelectronica.es/
348	Ventosa del Río Almar	37329	923 56 41 30	923 56 41 30	aytoventosadelrioalmar@hotmail.com		10 de junio y 29 de agosto	https://ventosadelrioalmar.sedelectronica.es
349	La Vídola	37214	923 51 07 19		ayuntolavidola@yahoo.es		1 de agosto y 2 de agosto	https://lavidola.sedelectronica.es
350	Vilvestre	37258	923 52 46 23	923 52 46 23	info@vilvestre.com	http://www.vilvestre.com	20 de enero y 8 de septiembre	http://vilvestre.sedelectronica.es
351	Villaflores	37406	923 53 41 14		aytovillaflores37@gmail.com		28 de agosto y 11 de noviembre	https://villaflores.sedelectronica.es
352	Villagonzalo de Tormes	37893	923 37 20 37		aytovillagonzalo@gmail.com		24 de agosto y 29 de septiembre 	https://villagonzalodetormes.sedelectronica.es
353	Villalba de los Llanos	37451	923 38 20 14	923 38 20 14	aytovillalba@gmail.com		27 de junio y 26 de septiembre	https://villalbadelosllanos.sedelectronica.es
354	Villamayor	37185	923 30 56 05	923 28 64 38	secretaria@villamayor.es	http://www.villamayor.es	3 de febrero y 2 de junio	https://villamayor.sedelectronica.es
355	Villanueva del Conde	37658	923 43 70 44	923 43 70 44	info@villanuevadelconde.com	https://www.villanuevadelconde.com/	19 de agosto y 20 de agosto	https://villanuevadelconde.sedelectronica.es
356	Villar de Argañán	37497	923 16 31 70		v_ciervo@yahoo.es		24 de junio y 29 de septiembre	https://villardearganan.sedelectronica.es
357	Villar de Ciervo	37488	923 48 81 11	923 48 81 11	v_ciervo@yahoo.es		28 de agosto y 29 de agosto	https://villardeciervo.sedelectronica.es
358	Villar de Gallimazo	37320	923 55 20 51	923 55 20 51	aytoelvillar@hotmail.es		9 de junio y 1 de agosto	https://villardegallimazo.sedelectronica.es
359	Villar de la Yegua	37488	923 48 49 88	923 48 49 88	ayto_villardelayegua@yahoo.es		24 de junio y 22 de agosto	http://villardelayegua.sedelectronica.es
360	Villar de Peralonso	37147	923 51 80 09		aytovillapera@hotmail.com		27 de junio y 30 de junio	https://villardeperalonso.sedelectronica.es
361	Villar de Samaniego	37217	923 51 14 27		aytovillardesamaniego@gmail.com		30 de abril y 18 de junio	https://villardesamaniego.sedelectronica.es
362	Villares de la Reina	37184	923 28 83 77	923 28 71 21	comunicacion@villaresdelareina.es	http://www.villaresdelareina.es	23 de junio y 31 de diciembre	https://villaresdelareina.sedelectronica.es
363	Villares de Yeltes	37267	923 51 94 30		aytovillaresdeyeltes@hotmail.com		8 de septiembre y 9 de septiembre	https://villaresdeyeltes.sedelectronica.es
364	Villarino de los Aires	37160	923 57 30 01	923 57 30 94	secretaria@villarinodelosaires.es	http://www.villarinodelosaires.es	14 de agosto y 18 de agosto	https://villarinodelosaires.sedelectronica.es
365	Villarmayor	37130	923 14 06 21	923 14 06 21	ayuntamientovillarmayor@gmail.com		22 de enero y 5 de agosto	https://villarmayor.sedelectronica.es
366	Villarmuerto	37217	923 51 15 00		aytovillarmuerto@gmail.com		11 de agosto y 18 de agosto	https://villarmuerto.sedelectronica.es
367	Villasbuenas	37256	923 50 73 25		aytovillasbuenas@reyconet.es		24 de junio y 18 de julio	https://villasbuenas.sedelectronica.es
368	Villasdardo	37468	923 51 05 05	923 51 04 59	santamariadesando@gmail.com		9 de junio y 13 de junio	https://villasdardo.sedelectronica.es
369	Villaseco de los Gamitos	37114	923 14 04 37 - 652 92 06 89		mserranov@telefonica.net		22 de enero y 1 de septiembre	https://villasecodelosgamitos.sedelectronica.es
370	Villaseco de los Reyes	37150	923 57 51 19		aytovillasecoreyes@gmail.com		8 y 9 de septiembre	http://villasecodelosreyes.sedelectronica.es
371	Villasrubias	37522	923 48 64 09	923 48 64 09	aytovillasrubias@yahoo.es		25 de agosto y 26 de agosto	https://villasrubias.sedelectronica.es
372	Villaverde de Guareña	37428	923 35 00 15		aytovillaverdeguarena@gmail.com		30 de mayo y 5 de septiembre	https://villaverdedeguarena.sedelectronica.es
373	Villavieja de Yeltes	37260	923 51 90 05	923 52 60 61	aytovillavieja@telefonica.net	http://www.villaviejadeyeltes.es	28 de febrero y 28 de agosto	https://villaviejadeyeltes.sedelectronica.es
374	Villoria	37339	923 35 60 14	923 35 66 08	aytovilloria@hotmail.com		28 de abril y 8 de septiembre	https://villoria.sedelectronica.es
375	Villoruela	37338	923 35 60 26		ayuntamiento@villoruela.net		29 de mayo y 16 de julio	https://villoruela.sedelectronica.es
376	Vitigudino	37210	923 50 00 12	923 50 00 56	ayuntamiento@vitigudino.es	http://www.vitigudino.org	19 de junio y 20 de junio	https://vitigudino.sedeelectronica.es
377	Yecla de Yeltes	37219	923 50 07 02		aytoyecladeyeltes@reyconet.es			https://yecladeyeltes.sedeelectronica.es
378	Zamarra	37591	923 49 06 01		ayuntaserradilla@hotmail.com		20 de enero y 2 de mayo	https://zamarra.sedeelectronica.es
379	Zamayón	37110	923 31 42 42		aytozamayon@gmail.com		13 de junio y 16 de junio	https://zamayon.sedelectronica.es
380	Zarapicos	37170	923 32 04 53		ayuntamientozarapicos@gmail.com		20 de mayo y 25 de julio 	https://zarapicos.sedelectronica.es
381	La Zarza de Pumareda	37253	923 13 52 70	923 50 70 08	aytolazarza@hotmail.com		21 de abril	http://lazarzadepumareda.sedelectronica.es
382	Zorita de la Frontera	37408	923 53 31 05		aytozoritadelafrontera@hotmail.com		29 de septiembre y 30 de septiembre	https://zoritadelafrontera.sedelectronica.es
`;

const ineCpMap = require('./src/helpers/ine-codigopostal.json');

function normalizeName(str = '') {
  const s = (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Reordenar artículos: "Alberca, La" -> "la alberca"
  const m = s.match(/^(.*?),\s*(la|el|los|las)$/);
  if (m) return `${m[2]} ${m[1]}`;
  return s;
}

const NAME_FIXES = {
  'fuenteliante': '37137'
};

function tokenSet(str) {
  return new Set((str || '').split(' ').filter(w => w && !['de','del','la','el','los','las','y','san','santa'].includes(w)));
}

function findCodINE(name, cp) {
  const target = normalizeName(name);
  if (NAME_FIXES[target]) return NAME_FIXES[target];

  // 1) Intento por nombre exacto en el mapping
  const byName = ineCpMap.filter(e => normalizeName(e.Municipio) === target && String(e.CodMunicipio).match(/^\d{5}$/));
  if (byName.length) return String(byName[0].CodMunicipio).padStart(5, '0');

  // 2) Intento por CP y nombre aproximado
  const byCp = ineCpMap.filter(e => String(e.CodigoPostal) === String(cp) && String(e.CodMunicipio).match(/^\d{5}$/));
  if (byCp.length === 1) return String(byCp[0].CodMunicipio).padStart(5, '0');
  if (byCp.length > 1) {
    const exact = byCp.find(e => normalizeName(e.Municipio) === target);
    if (exact) return String(exact.CodMunicipio).padStart(5, '0');
    // elegir el de mayor solape de tokens
    const tgt = tokenSet(target);
    let best = null;
    let bestScore = -1;
    for (const cand of byCp) {
      const candNorm = normalizeName(cand.Municipio);
      const cset = tokenSet(candNorm);
      let score = 0;
      for (const t of tgt) if (cset.has(t)) score++;
      if (score > bestScore) { best = cand; bestScore = score; }
    }
    if (best) return String(best.CodMunicipio).padStart(5, '0');
  }
  return null;
}

const MONTHS = {
  'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
  'julio': '07', 'agosto': '08', 'septiembre': '09', 'setiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
};

function parseFestivities(text = '') {
  const t = (text || '')
    .toLowerCase()
    .replace(/de\s*3\s*/g, 'de ') // corregir tipo "20 de3 febrero"
    .replace(/\s+/g, ' ')
    .trim();
  // Caso: "20 de enero y 5 de mayo"
  let m = t.match(/(\d{1,2})\s*de\s*(\w+)\s*y\s*(\d{1,2})\s*de\s*(\w+)/);
  if (m) {
    const d1 = String(m[1]).padStart(2,'0');
    const m1 = MONTHS[m[2]] || '01';
    const d2 = String(m[3]).padStart(2,'0');
    const m2 = MONTHS[m[4]] || m1;
    return { start_date: `${m1}-${d1}`, end_date: `${m2}-${d2}` };
  }
  // Caso: "23 y 24 de junio"
  m = t.match(/(\d{1,2})\s*y\s*(\d{1,2})\s*de\s*(\w+)/);
  if (m) {
    const d1 = String(m[1]).padStart(2,'0');
    const d2 = String(m[2]).padStart(2,'0');
    const mm = MONTHS[m[3]] || '01';
    return { start_date: `${mm}-${d1}`, end_date: `${mm}-${d2}` };
  }
  // Caso: "2 de mayo" (una sola fecha)
  m = t.match(/(\d{1,2})\s*de\s*(\w+)/);
  if (m) {
    const d = String(m[1]).padStart(2,'0');
    const mm = MONTHS[m[2]] || '01';
    return { start_date: `${mm}-${d}`, end_date: `${mm}-${d}` };
  }
  return { start_date: null, end_date: null };
}

function parseRows(raw) {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const items = [];
  const skipped = [];
  for (const line of lines) {
    // id, name, cp then arbitrary columns; email, two URLs usually at the end
    const m = line.match(/^\s*(\d+)\s+(.+?)\s+(\d{5})\s+(.*)$/);
    if (!m) { skipped.push(line); continue; }
    const [, id, name, cp, rest] = m;

    const emailMatch = rest.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const email = emailMatch ? emailMatch[0] : undefined;

    const urls = rest.match(/https?:\/\/\S+/gi) || [];
    const sede = urls[urls.length - 1];
    const website = urls.length > 1 ? urls[urls.length - 2] : urls[0];

    const dates = parseFestivities(line);

    const codIne = findCodINE(name, cp);
    if (!codIne) {
      console.warn(`⚠️  No se encontró cod_ine para "${name}" (CP ${cp}). Saltando.`);
      continue;
    }

    items.push({
      cod_ine: codIne,
      municipality_name: name,
      contact_info: {
        town_hall: {
          postal_code: String(cp),
          email: email || undefined,
          website: website || sede || undefined
        }
      },
      patron_festivals: [
        {
          name: 'Fiestas Patronales',
          celebration_dates: {
            start_date: dates.start_date,
            end_date: dates.end_date,
            approximate: false
          },
          description: ''
        }
      ]
    });
  }
  if (process.env.DRY_RUN === '1' && skipped.length) {
    console.log(`Líneas no reconocidas: ${skipped.length}`);
    console.log(skipped.slice(0, 5));
  }
  return items;
}

const municipiosData = parseRows(RAW_TABLE);
console.log(`📥 Municipios parseados: ${municipiosData.length}`);
if (municipiosData.length) {
  console.log('Ejemplo:', municipiosData[0]);
}

async function hydrateMunicipalInfo() {
  try {
    if (process.env.DRY_RUN === '1') {
      console.log('DRY_RUN=1: Mostrando una vista previa de los datos parseados, sin escribir en MongoDB.');
      console.log(`Total parseados: ${municipiosData.length}`);
      console.log(municipiosData.slice(0, 5));
      return;
    }
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/infosalamanca', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Conectado a MongoDB');

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const municipio of municipiosData) {
      try {
        const existing = await MunicipalInfo.findOne({ cod_ine: municipio.cod_ine });

        if (existing) {
          // Actualizar existente
          await MunicipalInfo.findOneAndUpdate(
            { cod_ine: municipio.cod_ine },
            {
              $set: {
                municipality_name: municipio.municipality_name,
                'contact_info.town_hall.email': municipio.contact_info?.town_hall?.email,
                patron_festivals: municipio.patron_festivals,
                updatedAt: new Date()
              }
            }
          );
          updated++;
          console.log(`✅ Actualizado: ${municipio.municipality_name} (${municipio.cod_ine})`);
        } else {
          // Crear nuevo
          await MunicipalInfo.create({
            cod_ine: municipio.cod_ine,
            municipality_name: municipio.municipality_name,
            contact_info: municipio.contact_info,
            patron_festivals: municipio.patron_festivals,
            public: true,
            verified: false
          });
          created++;
          console.log(`🆕 Creado: ${municipio.municipality_name} (${municipio.cod_ine})`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error procesando ${municipio.municipality_name}:`, error.message);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   - Creados: ${created}`);
    console.log(`   - Actualizados: ${updated}`);
    console.log(`   - Errores: ${errors}`);
    console.log(`   - Total procesados: ${municipiosData.length}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  hydrateMunicipalInfo();
}

module.exports = hydrateMunicipalInfo;
