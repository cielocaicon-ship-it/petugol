'use strict';

/* =====================================================================
   PetuGol · script.js
   Futbolito arcade 6 contra 6 al estilo de los juegos de fútbol clásicos
   de consola: cancha vista un poco inclinada, cámara que sigue el balón,
   jugadores de pie y arcos con red en 3D. Todo se dibuja con código en
   un <canvas>, con gráficos lisos (no pixelados).

   Índice
    1. Configuración: cancha, reglas, niveles, formación y poderes
    2. Elementos de la página y preferencias del sistema
    3. Colores (se leen de las variables de style.css)
    4. Nada se guarda en el navegador (se borran datos de versiones viejas)
    5. Sonidos hechos con código (Web Audio, sin archivos)
    6. Estado del partido: equipos, jugadores y balones
    7. Vista: perspectiva inclinada y cámara que sigue el balón
    8. Fondo pre-dibujado del estadio (se pinta UNA sola vez)
    9. Afición: la ola, saltos y destellos de cámaras
   10. Poderes
   11. Partículas (serpentinas, chispas, polvo)
   12. Balón: física, posesión, robos, atajadas, salidas y goles
   13. Jugadores: movimiento, patadas, barridas e IA
   14. Reglas: saque, gol, saques de banda/esquina/meta, reloj y final
   15. Dibujo de cada cuadro (ordenado por profundidad)
   16. Marcador, palcos, carteles, avisos y anuncios
   17. Controles: teclado y joystick táctil
   18. Pantallas, menú y diálogos
   19. Bucle principal e inicio
   20. Online: salas, partidos y mini torneos (con PeerJS)
   ===================================================================== */


/* =====================================================================
   1. CONFIGURACIÓN
   ===================================================================== */

// Medidas en "unidades de juego" (no en píxeles).
// x va a lo largo: 0 es la línea de TU arco y 900 la del arco rival.
// y va a lo ancho: de una banda (0) a la otra (520).
// z es la altura (para el balón por el aire, los arcos y los jugadores de pie).
const CANCHA = Object.freeze({
  largo: 900,
  ancho: 520,
  margenFondo: 46,      // pista detrás de cada arco
  margenBanda: 74,      // pista y graderías a los lados
  anchoArco: 170,
  fondoArco: 26,
  altoArco: 56,
  radioPalo: 4.5,
  anchoAreaGrande: 330,
  fondoAreaGrande: 130,
  anchoAreaChica: 190,
  fondoAreaChica: 46,
  puntoPenal: 95,
  radioCirculo: 70
});

const LARGO = CANCHA.largo;
const ANCHO = CANCHA.ancho;
const MITAD = ANCHO / 2;   // centro de los arcos, a lo ancho
const VUELTA = Math.PI * 2;

// Reglas y medidas del juego
const JUEGO = Object.freeze({
  duracion: 180,             // Normal (contra Petunia): 3:00, con medio tiempo a 1:30
  duracionOnline: 240,       // Online: 4:00, con medio tiempo a los 2:00
  muerteSubita: 45,          // segundos de muerte súbita si hay empate
  segundosMedioTiempo: 2.6,  // pausa con el cartel "Medio tiempo" antes del saque
  radioJugador: 14,          // todos los jugadores miden lo mismo
  radioBalon: 7,
  radioBalonMini: 4.5,
  velocidadJugador: 175,
  velocidadConBalon: 158,
  velocidadPortero: 150,
  patadaTuya: 510,           // fuerza de tus patadas contra la máquina (la de ella depende del nivel)
  friccionBalon: 0.8,        // cuánto frena el balón en el césped
  gravedad: 420,             // para el balón que va por el aire
  rapidezDesvio: 480,        // un balón más rápido que esto rebota en los jugadores de campo
  segundosSaque: 1.4,
  segundosParada: 0.9,       // pausa antes de un saque de banda, de esquina o de meta
  segundosCelebracion: 2.8,
  segundosTrabado: 9,        // si el balón no se mueve en 9 s, sale uno nuevo
  barrida: { duracion: 0.28, velocidad: 330, pausa: 1 },
  entreEsferas: [7, 12]      // segundos entre poderes
});

// Niveles: los jugadores siempre miden lo mismo. Cambia la fuerza de la
// patada de la máquina, su velocidad, su puntería y qué tanto se distrae.
const NIVELES = Object.freeze({
  // Fácil: Petunia es más lenta, duda más y falla más tiros
  facil: {
    nombre: 'fácil',
    patada: 450,
    ia: {
      velocidad: 0.8,       // 1 = igual de rápida que tú
      reaccion: 0.32,       // cada cuánto decide (segundos)
      desvioTiro: 56,       // qué tanto se le desvía la puntería
      rangoTiro: 220,       // desde qué distancia remata
      distraccion: 0.06,    // probabilidad por segundo de que un jugador se distraiga
      barrida: 0.22,        // ganas de barrerse
      pase: 0.45            // ganas de pasar cuando la presionan
    },
    portero: { velocidad: 0.78, distraccion: 0.22, ataje: 430 }
  },
  // Difícil: juega parejo contigo (no es imbatible: se le puede ganar)
  dificil: {
    nombre: 'difícil',
    patada: 495,
    ia: { velocidad: 0.88, reaccion: 0.22, desvioTiro: 38, rangoTiro: 250, distraccion: 0.035, barrida: 0.38, pase: 0.62 },
    portero: { velocidad: 0.9, distraccion: 0.16, ataje: 480 }
  }
});

// Así juegan tus compañeros automáticos (y ambos equipos en 2 jugadores)
const IA_AMIGA = Object.freeze({
  patada: 510,
  ia: { velocidad: 0.92, reaccion: 0.2, desvioTiro: 30, rangoTiro: 270, distraccion: 0, barrida: 0.35, pase: 0.6 },
  portero: { velocidad: 0.95, distraccion: 0.12, ataje: 520 }
});

// Formación 1-2-1-2 (6 por equipo) del equipo que ataca hacia la derecha
// (el otro es su espejo): portero, 2 defensas, 1 volante y 2 delanteros
const FORMACION = Object.freeze([
  { rol: 'portero', x: 22, y: MITAD },
  { rol: 'defensa', x: 170, y: MITAD - 118 },
  { rol: 'defensa', x: 170, y: MITAD + 118 },
  { rol: 'medio', x: 285, y: MITAD },
  { rol: 'delantero', x: 390, y: MITAD - 112 },
  { rol: 'delantero', x: 390, y: MITAD + 112 }
]);
const EN_CANCHA = FORMACION.length; // jugadores de cada equipo en la cancha

// Cámara: cuántas unidades de cancha se ven a lo ancho y a lo alto de la pantalla,
// y cuánto se "aplasta" el piso para verlo inclinado (1 = visto desde arriba)
const CAMARA = Object.freeze({
  horizontal: { ancho: 720, alto: 430, inclinacion: 0.72 },
  vertical: { ancho: 400, alto: 700, inclinacion: 0.8 },
  tactil: { ancho: 620, alto: 370, inclinacion: 0.72 },   // celular acostado: más cerca, muñecos más grandes
  maximo: 2           // píxeles por unidad como máximo (en pantallas muy grandes)
});

// Poderes: nombre, duración (segundos), color (variable de CSS) e ícono (trazo SVG de 24×24)
const PODERES = Object.freeze({
  mini: {
    nombre: 'Balón mini', duracion: 8, color: 'poder-mini',
    efecto: 'el balón se encoge',
    icono: { d: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4', relleno: false }
  },
  turbo: {
    nombre: 'Turbo', duracion: 7, color: 'poder-turbo',
    efecto: 'corren más y patean más fuerte',
    icono: { d: 'M13 2L4 14h7l-1 8 9-12h-7z', relleno: true }
  },
  multi: {
    nombre: 'Multibalón', duracion: 8, color: 'poder-multi',
    efecto: 'salen 2 balones extra',
    icono: { d: 'M4 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0', relleno: true }
  },
  gigante: {
    nombre: 'Jugadores gigantes', duracion: 8, color: 'poder-gigante',
    efecto: 'sus jugadores crecen',
    icono: { d: 'M12 3v18M12 3l-4 4M12 3l4 4M12 21l-4-4M12 21l4-4M6 12h12', relleno: false }
  },
  escudo: {
    nombre: 'Escudo', duracion: 14, color: 'poder-escudo',
    efecto: 'su arco queda protegido una vez',
    icono: { d: 'M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z', relleno: true }
  },
  hielo: {
    nombre: 'Hielo', duracion: 1.8, color: 'poder-hielo',
    efecto: 'el equipo rival queda congelado',
    icono: { d: 'M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 3.5l3 2 3-2M9 20.5l3-2 3 2', relleno: false }
  },
  zigzag: {
    nombre: 'Zigzag', duracion: 7, color: 'poder-zigzag',
    efecto: 'sus tiros van culebreando',
    icono: { d: 'M2 12l4-6 4 12 4-12 4 12 4-6', relleno: false }
  }
});

const ICONO_ALERTA = { d: 'M12 3l10 18H2zM12 10v5M12 18v.01', relleno: false };
const ICONO_BALON = { d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z', relleno: false };
const ICONO_SILBATO = { d: 'M3 10h11a5 5 0 1 1-5 5V12M17 7l3-3M14 6V3M19 10h3', relleno: false };
const ICONO_CAMBIO = { d: 'M4 9h13l-3-3M20 15H7l3 3', relleno: false };

// Textos de las jugadas a balón parado (como el "THROW IN" de los juegos clásicos)
const JUGADAS = Object.freeze({
  banda: 'Saque de banda',
  esquina: 'Tiro de esquina',
  meta: 'Saque de meta',
  libre: 'Tiro libre',
  penal: '¡Penal!'
});

// Botones de acción, como en los juegos de fútbol del celular.
// Son los mismos en el teclado y en la pantalla táctil; su nombre cambia
// si tu equipo tiene el balón (ataque) o no (defensa).
// Como en Dream League Soccer: solo tres botones. Correr es automático.
const ACCIONES = Object.freeze(['pase', 'centro', 'tiro']);
const ETIQUETAS = Object.freeze({
  ataque: { pase: 'Pase', centro: 'Centro', tiro: 'Tiro' },
  defensa: { pase: 'Cambiar', centro: 'Presión', tiro: 'Barrida' }
});
// Selecciones para elegir. Sus colores están en style.css (:root), por ejemplo
// --col-camiseta. "patron": camiseta lisa, con rayas (Argentina) o con banda (Perú).
const EQUIPOS = Object.freeze([
  { codigo: 'COL', nombre: 'Colombia', patron: 'liso' },
  { codigo: 'BRA', nombre: 'Brasil', patron: 'liso' },
  { codigo: 'ARG', nombre: 'Argentina', patron: 'rayas' },
  { codigo: 'MEX', nombre: 'México', patron: 'liso' },
  { codigo: 'URU', nombre: 'Uruguay', patron: 'liso' },
  { codigo: 'PER', nombre: 'Perú', patron: 'banda' },
  { codigo: 'CHI', nombre: 'Chile', patron: 'liso' },
  { codigo: 'ECU', nombre: 'Ecuador', patron: 'liso' },
  { codigo: 'ESP', nombre: 'España', patron: 'liso' },
  { codigo: 'FRA', nombre: 'Francia', patron: 'liso' },
  { codigo: 'ALE', nombre: 'Alemania', patron: 'liso' },
  { codigo: 'ITA', nombre: 'Italia', patron: 'liso' },
  { codigo: 'POR', nombre: 'Portugal', patron: 'liso' },
  { codigo: 'HOL', nombre: 'Holanda', patron: 'liso' },
  { codigo: 'ING', nombre: 'Inglaterra', patron: 'liso' },
  { codigo: 'JAP', nombre: 'Japón', patron: 'liso' }
]);
// Plantel de cada selección con jugadores de verdad (sus nombres y el número que
// suelen usar en la selección). Los 6 primeros son los titulares, en el orden
// de la formación (portero, 2 defensas, volante y 2 delanteros); los otros 3
// son los suplentes. "estrella" marca a la figura: su jugador más famoso.
const PLANTELES = Object.freeze({
  COL: [['Vargas', 12], ['D. Sánchez', 23], ['Mina', 13], ['James', 10], ['Luis Díaz', 7, 'estrella'], ['Córdoba', 24],
    ['Arias', 11], ['Durán', 9], ['Muñoz', 21]],
  BRA: [['Alisson', 1], ['Marquinhos', 4], ['Militão', 3], ['Casemiro', 5], ['Vini Jr.', 7, 'estrella'], ['Rodrygo', 10],
    ['Raphinha', 11], ['Endrick', 9], ['Bruno G.', 8]],
  ARG: [['Dibu', 23], ['Cuti Romero', 13], ['Otamendi', 19], ['De Paul', 7], ['Messi', 10, 'estrella'], ['Lautaro', 22],
    ['Julián', 9], ['Enzo', 24], ['Mac Allister', 20]],
  MEX: [['Ochoa', 13], ['Montes', 3], ['J. Vásquez', 5], ['Edson', 4], ['Raúl Jiménez', 9, 'estrella'], ['S. Giménez', 11],
    ['Chucky Lozano', 22], ['Chávez', 24], ['Vega', 10]],
  URU: [['Rochet', 1], ['R. Araujo', 4], ['Giménez', 2], ['Valverde', 15, 'estrella'], ['Darwin', 9], ['De Arrascaeta', 10],
    ['Bentancur', 6], ['Ugarte', 5], ['Pellistri', 11]],
  PER: [['Gallese', 1], ['Zambrano', 5], ['Advíncula', 17], ['Tapia', 13], ['Guerrero', 9, 'estrella'], ['Lapadula', 11],
    ['Cueva', 10], ['Carrillo', 18], ['Flores', 20]],
  CHI: [['Bravo', 1], ['Medel', 17], ['Maripán', 3], ['Vidal', 8], ['Alexis', 10, 'estrella'], ['Vargas', 11],
    ['Aránguiz', 20], ['Brereton', 22], ['Isla', 4]],
  ECU: [['Galíndez', 1], ['Hincapié', 3], ['Pacho', 6], ['Caicedo', 23, 'estrella'], ['Enner Valencia', 13], ['Kendry Páez', 10],
    ['Estupiñán', 7], ['Plata', 19], ['Franco', 21]],
  ESP: [['Unai Simón', 23], ['Laporte', 14], ['Carvajal', 2], ['Rodri', 16], ['Lamine', 19, 'estrella'], ['Morata', 7],
    ['Pedri', 20], ['Nico Williams', 17], ['Olmo', 10]],
  FRA: [['Maignan', 16], ['Saliba', 17], ['Theo', 22], ['Tchouaméni', 8], ['Mbappé', 10, 'estrella'], ['Dembélé', 11],
    ['Camavinga', 6], ['Kanté', 13], ['Thuram', 15]],
  ALE: [['Ter Stegen', 1], ['Rüdiger', 2], ['Tah', 4], ['Kimmich', 6], ['Musiala', 10, 'estrella'], ['Havertz', 7],
    ['Wirtz', 17], ['Sané', 19], ['Füllkrug', 9]],
  ITA: [['Donnarumma', 1], ['Bastoni', 23], ['Di Lorenzo', 2], ['Barella', 18, 'estrella'], ['Chiesa', 14], ['Retegui', 19],
    ['Tonali', 8], ['Raspadori', 10], ['Calafiori', 5]],
  POR: [['Diogo Costa', 22], ['Rúben Dias', 4], ['Cancelo', 20], ['Bruno Fernandes', 8], ['Cristiano', 7, 'estrella'], ['Leão', 17],
    ['Bernardo', 10], ['Vitinha', 23], ['João Félix', 11]],
  HOL: [['Verbruggen', 1], ['Van Dijk', 4, 'estrella'], ['De Ligt', 3], ['De Jong', 21], ['Gakpo', 11], ['Depay', 10],
    ['Xavi Simons', 7], ['Dumfries', 22], ['Reijnders', 14]],
  ING: [['Pickford', 1], ['Stones', 5], ['Walker', 2], ['Bellingham', 10], ['Kane', 9, 'estrella'], ['Saka', 7],
    ['Foden', 11], ['Rice', 4], ['Palmer', 24]],
  JAP: [['Suzuki', 23], ['Itakura', 4], ['Tomiyasu', 16], ['Endo', 6], ['Kubo', 20, 'estrella'], ['Mitoma', 7],
    ['Minamino', 8], ['Doan', 10], ['Ueda', 9]]
});

// Nombre completo de cada figura (sale en el inicio, debajo de su camiseta)
const ESTRELLAS = Object.freeze({
  COL: 'Luis Díaz', BRA: 'Vinícius Jr.', ARG: 'Lionel Messi', MEX: 'Raúl Jiménez',
  URU: 'Federico Valverde', PER: 'Paolo Guerrero', CHI: 'Alexis Sánchez', ECU: 'Moisés Caicedo',
  ESP: 'Lamine Yamal', FRA: 'Kylian Mbappé', ALE: 'Jamal Musiala', ITA: 'Nicolò Barella',
  POR: 'Cristiano Ronaldo', HOL: 'Virgil van Dijk', ING: 'Harry Kane', JAP: 'Takefusa Kubo'
});
// La figura es un poquito mejor: corre más, patea más fuerte, tiene mejor
// puntería y se cansa menos
const ESTRELLA = Object.freeze({ velocidad: 1.06, patada: 1.08, punteria: 0.6, cansancio: 0.85 });
const SUPLENTES = 3; // y 3 cambios por partido

// Cansancio (energía de 0 a 1). Correr gasta; caminar o quedarse quieto
// recupera un poquito. Con menos de la mitad de energía el jugador va más
// lento y patea más suave. En el medio tiempo todos recuperan algo.
const CANSANCIO = Object.freeze({
  base: 0.0026,          // lo que gasta por segundo aunque trote despacio
  carrera: 0.0092,       // lo que gasta por segundo corriendo a toda velocidad (crece con el cuadrado)
  barrida: 0.03,         // cada barrida
  recupera: 0.004,       // lo que recupera por segundo casi quieto
  medioTiempo: 0.15,     // lo que recupera en el medio tiempo
  cansado: 0.3,          // por debajo de esto se ve sudando y se avisa
  cambioMaquina: 0.33    // Petunia cambia a los que bajen de esto
});

// Faltas: una barrida que le pega al rival (y no al balón) es falta.
// Desde atrás es más grave. Dos amarillas son roja. Un equipo puede quedar
// con hasta 2 expulsados (con más, la tarjeta se queda en amarilla).
const FALTAS = Object.freeze({
  desdeAtras: { amarilla: 0.32, roja: 0.05 },
  deFrente: { amarilla: 0.1, roja: 0.01 },
  maximoExpulsados: 2,
  pausa: 1.4,            // segundos de balón muerto después de la falta
  pausaTarjeta: 2.4      // si hubo tarjeta (para alcanzar a verla)
});

const CARGA_MAXIMA = 0.9;   // segundos sosteniendo "Tiro" para patear con toda la fuerza
const ALTURA_MANOS = 44;    // altura del balón cuando se saca de banda con las manos


/* =====================================================================
   2. ELEMENTOS DE LA PÁGINA Y PREFERENCIAS DEL SISTEMA
   ===================================================================== */
const $ = (id) => document.getElementById(id);

const el = {
  pantallaInicio: $('pantallaInicio'),
  pantallaJuego: $('pantallaJuego'),
  form: $('formInicio'),
  usuario: $('usuario'),
  usuarioError: $('usuarioError'),
  equipo1: $('equipo1'),
  equipo2: $('equipo2'),
  vistaEquipo1: $('vistaEquipo1'),
  vistaEquipo2: $('vistaEquipo2'),
  etiquetaEquipo1: $('etiquetaEquipo1'),
  etiquetaEquipo2: $('etiquetaEquipo2'),
  notaEquipo1: $('notaEquipo1'),
  notaEquipo2: $('notaEquipo2'),
  camisetaLocal: $('camisetaLocal'),
  camisetaVisitante: $('camisetaVisitante'),
  recordRacha: $('recordRacha'),
  recordGoles: $('recordGoles'),
  marcador: $('marcador'),
  nombreLocal: $('nombreLocal'),
  nombreVisitante: $('nombreVisitante'),
  siglaLocal: $('siglaLocal'),
  siglaVisitante: $('siglaVisitante'),
  seleccionLocal: $('seleccionLocal'),
  seleccionVisitante: $('seleccionVisitante'),
  golesLocal: $('golesLocal'),
  golesVisitante: $('golesVisitante'),
  palcoLocal: $('palcoLocal'),
  palcoVisitante: $('palcoVisitante'),
  poderesLocal: $('poderesLocal'),
  poderesVisitante: $('poderesVisitante'),
  reloj: $('reloj'),
  infoCentro: $('infoCentro'),
  botonMenu: $('botonMenu'),
  botonSonido: $('botonSonido'),
  estadio: $('estadio'),
  lienzo: $('lienzo'),
  cartel: $('cartel'),
  aviso: $('aviso'),
  consejo: $('consejo'),
  girar: $('girar'),
  repeticion: $('repeticion'),
  repeticionSaltar: $('repeticionSaltar'),
  mando: $('mando'),
  botonesJ1: $('botonesJ1'),
  anuncios: $('anuncios'),
  dialogoPausa: $('dialogoPausa'),
  dialogoAyuda: $('dialogoAyuda'),
  dialogoFinal: $('dialogoFinal'),
  textoPausa: $('textoPausa'),
  tituloPausa: $('tituloPausa'),
  girarNota: $('girarNota'),
  botonContinuar: $('botonContinuar'),
  botonReiniciar: $('botonReiniciar'),
  botonSalir: $('botonSalir'),
  figuraFinal: $('figuraFinal'),
  imgFestejo: $('imgFestejo'),
  imgBurla: $('imgBurla'),
  tituloFinal: $('tituloFinal'),
  marcadorFinal: $('marcadorFinal'),
  textoFinal: $('textoFinal'),
  logrosFinal: $('logrosFinal'),
  botonRevancha: $('botonRevancha'),
  botonInicioFinal: $('botonInicioFinal'),
  dialogoAtuendo: $('dialogoAtuendo'),
  botonAtuendo: $('botonAtuendo'),
  muneco1: $('muneco1'),
  muneco2: $('muneco2'),
  atuendoTitulo1: $('atuendoTitulo1'),
  atuendoTitulo2: $('atuendoTitulo2'),
  notaAtuendo: $('notaAtuendo'),
  // Estadísticas de la pantalla final
  tablaNombres: [$('tablaNombre0'), $('tablaNombre1')],
  tablaPosesion: [$('tablaPosesion0'), $('tablaPosesion1')],
  tablaTiros: [$('tablaTiros0'), $('tablaTiros1')],
  tablaFaltas: [$('tablaFaltas0'), $('tablaFaltas1')],
  tablaTarjetas: [$('tablaTarjetas0'), $('tablaTarjetas1')],
  botonOtroRival: $('botonOtroRival'),
  figuraEquipo1: $('figuraEquipo1'),
  figuraEquipo2: $('figuraEquipo2'),
  // Cambios de jugadores
  botonCambios: $('botonCambios'),
  dialogoCambios: $('dialogoCambios'),
  textoCambios: $('textoCambios'),
  formCambios: $('formCambios'),
  listaSale: $('listaSale'),
  listaEntra: $('listaEntra'),
  avisoCambios: $('avisoCambios'),
  botonHacerCambio: $('botonHacerCambio'),
  // Mini torneo en Normal
  pantallaTorneo: $('pantallaTorneo'),
  estadoTorneo: $('estadoTorneo'),
  tituloProximo: $('tituloProximo'),
  dueloTorneo: $('dueloTorneo'),
  resultadoTorneo: $('resultadoTorneo'),
  imagenTorneo: $('imagenTorneo'),
  textoResultadoTorneo: $('textoResultadoTorneo'),
  botonJugarTorneo: $('botonJugarTorneo'),
  botonSalirTorneo: $('botonSalirTorneo'),
  cuadroNormal: $('cuadroNormal'),
  medallaTorneo: $('medallaTorneo'),
  textoMedallaTorneo: $('textoMedallaTorneo'),
  medallaFinal: $('medallaFinal'),
  textoMedallaFinal: $('textoMedallaFinal'),
  // Inicio: normal u online
  campoModo: $('campoModo'),
  campoDuelo: $('campoDuelo'),
  tituloDuelo: $('tituloDuelo'),
  campoNivel: $('campoNivel'),
  campoCodigo: $('campoCodigo'),
  codigoSala: $('codigoSala'),
  codigoError: $('codigoError'),
  botonComenzar: $('botonComenzar'),
  botonCrearSala: $('botonCrearSala'),
  botonUnirse: $('botonUnirse'),
  // Sala online
  pantallaSala: $('pantallaSala'),
  codigoVisible: $('codigoVisible'),
  estadoSala: $('estadoSala'),
  bloqueCompartir: $('bloqueCompartir'),
  botonCopiar: $('botonCopiar'),
  cuentaJugadores: $('cuentaJugadores'),
  listaJugadores: $('listaJugadores'),
  panelOrganizar: $('panelOrganizar'),
  campoAmistoso: $('campoAmistoso'),
  amistosoLocal: $('amistosoLocal'),
  amistosoVisita: $('amistosoVisita'),
  ayudaOrganizar: $('ayudaOrganizar'),
  errorOrganizar: $('errorOrganizar'),
  botonEmpezarSala: $('botonEmpezarSala'),
  esperaAnfitrion: $('esperaAnfitrion'),
  panelCompetencia: $('panelCompetencia'),
  tituloCompetencia: $('tituloCompetencia'),
  cuadroTorneo: $('cuadroTorneo'),
  campeonSala: $('campeonSala'),
  campeonImagen: document.querySelector('.sala__campeon-imagen'),
  textoCampeon: $('textoCampeon'),
  botonSalirSala: $('botonSalirSala'),
  dialogoTeToca: $('dialogoTeToca'),
  textoTeToca: $('textoTeToca'),
  cuentaTeToca: $('cuentaTeToca'),
  botonEntrar: $('botonEntrar'),
  esperaRed: $('esperaRed'),
  botonAbandonar: $('botonAbandonar'),
  avisoOnline: $('avisoOnline'),
  ayudaCompartir: $('ayudaCompartir'),
  equipoSala: $('equipoSala')
};

// Pincel del juego. Es "let" para poder dibujar un momento en otro lienzo
// (el muñeco de muestra del atuendo) con las mismas funciones.
let ctx = el.lienzo.getContext('2d');

function dibujarEn(otro, pintar) {
  const anterior = ctx;
  ctx = otro;
  try {
    pintar();
  } finally {
    ctx = anterior;
  }
}

// Lienzo invisible donde se pinta el estadio completo una sola vez
const fondo = document.createElement('canvas');
const ctxFondo = fondo.getContext('2d');

// ¿Pantalla táctil? (celular o tableta): menos partículas, menos píxeles y sin brillos
const esTactil = window.matchMedia('(pointer: coarse)').matches;
const LIMITE_PARTICULAS = esTactil ? 110 : 240;

// "Reducir movimiento": sin ola, sin serpentinas, sin destellos y sin saltos
const consultaMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
let menosMovimiento = consultaMovimiento.matches;
const alCambiarMovimiento = (evento) => { menosMovimiento = evento.matches; };
if (consultaMovimiento.addEventListener) {
  consultaMovimiento.addEventListener('change', alCambiarMovimiento);
} else if (consultaMovimiento.addListener) {
  consultaMovimiento.addListener(alCambiarMovimiento);
}


/* =====================================================================
   3. COLORES
   Todos los colores viven en :root (style.css). Aquí se copian para el canvas.
   ===================================================================== */
const COLOR = {};
const KITS = {};
let FUENTE_TITULO = 'sans-serif';

function leerColores() {
  const estilos = getComputedStyle(document.documentElement);
  const nombres = [
    'noche', 'tinta', 'sombra', 'reflector', 'reflector-apagado', 'alerta',
    'local', 'visitante', 'guantes', 'botines', 'ojos',
    'arquero-1', 'arquero-2', 'arquero-3', 'arquero-4', 'arquero-5', 'arquero-6',
    'cesped-claro', 'cesped-oscuro', 'pista', 'pista-borde', 'cal', 'red', 'red-capa', 'poste-borde',
    'graderia', 'graderia-escalon', 'escalera', 'valla', 'valla-texto', 'torre', 'bombillo',
    'piel-1', 'piel-2', 'piel-3', 'pelo', 'balon', 'balon-parche', 'destello',
    'poder-mini', 'poder-turbo', 'poder-multi', 'poder-gigante', 'poder-escudo', 'poder-hielo', 'poder-zigzag', 'hielo-capa',
    'botin-negro', 'botin-blanco', 'botin-dorado', 'botin-fucsia', 'botin-celeste',
    'balon-brillo', 'balon-brillo-apagado', 'balon-sombra', 'sombra-cuerpo', 'letrero-borde',
    'estrella', 'sudor', 'energia-alta', 'energia-media', 'energia-baja', 'tarjeta-amarilla', 'tarjeta-roja'
  ];
  for (const nombre of nombres) {
    COLOR[nombre] = estilos.getPropertyValue('--' + nombre).trim() || '#ffffff';
  }
  // Camisetas de cada selección (por ejemplo --col-camiseta, --col-visita...)
  for (const equipo of EQUIPOS) {
    const leer = (parte) => estilos.getPropertyValue(`--${equipo.codigo.toLowerCase()}-${parte}`).trim() || '#ffffff';
    KITS[equipo.codigo] = {
      camiseta: leer('camiseta'),
      detalle: leer('detalle'),
      pantaloneta: leer('pantaloneta'),
      medias: leer('medias'),
      visita: leer('visita'),
      visitaDetalle: leer('visita-detalle'),
      acento: leer('acento')
    };
  }
  FUENTE_TITULO = estilos.getPropertyValue('--fuente-titulo').trim() || 'sans-serif';
  COLOR.polvo = mezclar(COLOR['cesped-claro'], COLOR.cal, 0.5); // polvito del césped
}


// ---- Mezclar y comparar colores (para bordes, sillas y uniformes que no choquen) ----
function aRgb(color) {
  const hex = color.replace('#', '');
  const largo = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = parseInt(largo, 16);
  if (largo.length !== 6 || Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mezclar(a, b, cuanto) {
  const x = aRgb(a);
  const y = aRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * cuanto));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Contraste entre dos colores (como lo mide la WCAG: 1 = nada, 21 = negro sobre blanco)
function contraste(a, b) {
  const luz = (color) => {
    const [r, g, bl] = aRgb(color).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function distanciaColor(a, b) {
  const x = aRgb(a);
  const y = aRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

function buscarEquipo(codigo) {
  return EQUIPOS.find((e) => e.codigo === codigo) || EQUIPOS[0];
}

// Uniformes del partido. Si las dos camisetas se parecen, el rival usa la de
// visitante. Cada portero recibe un color que no se confunda con nadie.
// Colores de botines que se pueden elegir (el color sale de las variables --botin-*)
const BOTINES = Object.freeze({ negro: 'negros', blanco: 'blancos', dorado: 'dorados', fucsia: 'fucsia', celeste: 'celestes' });

// atuendo: { camiseta: ['titular'|'alterna', ...], botines: ['negro', ...] } (opcional)
function armarKits(codigo0, codigo1, atuendo = null) {
  const uniforme = (codigo, visita) => {
    const equipo = buscarEquipo(codigo);
    const k = KITS[equipo.codigo];
    return {
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      patron: equipo.patron,
      visita,
      camiseta: visita ? k.visita : k.camiseta,
      detalle: visita ? k.visitaDetalle : k.detalle,
      acento: k.acento,
      pantaloneta: k.pantaloneta,
      medias: visita ? k.visita : k.medias
    };
  };
  // El color que más se ve de lejos (con rayas, la mezcla de los dos)
  const tono = (u) => (u.patron === 'rayas' ? mezclar(u.camiseta, u.detalle, 0.5) : u.camiseta);
  // Se prueba en orden: primero lo que cada uno eligió; si se parecen, el rival
  // cambia; luego tú; luego los dos. Gana la primera pareja que se distinga bien
  // (si ninguna, la que más se distinga).
  const p0 = Boolean(atuendo && atuendo.camiseta[0] === 'alterna');
  const p1 = Boolean(atuendo && atuendo.camiseta[1] === 'alterna');
  const parejas = [[p0, p1], [p0, !p1], [!p0, p1], [!p0, !p1]].map(([v0, v1]) => {
    const a = uniforme(codigo0, v0);
    const b = uniforme(codigo1, v1);
    return { a, b, diferencia: distanciaColor(tono(a), tono(b)) };
  });
  const elegida = parejas.find((p) => p.diferencia >= 110) ||
    parejas.reduce((mejor, p) => (p.diferencia > mejor.diferencia ? p : mejor));
  const local = elegida.a;
  const visitante = elegida.b;
  local.cambiada = local.visita !== p0;       // se le cambió la camiseta para que no se parezcan
  visitante.cambiada = visitante.visita !== p1;
  [local, visitante].forEach((u, lado) => {
    const botin = atuendo ? atuendo.botines[lado] : 'negro';
    u.botinNombre = BOTINES[botin] ? botin : 'negro';
    u.botines = COLOR['botin-' + u.botinNombre] || COLOR.botines;
  });

  const usados = [tono(local), tono(visitante)];
  const opciones = [1, 2, 3, 4, 5, 6].map((n) => COLOR['arquero-' + n]);
  // El portero lleva el color que más se aleje de todo lo que ya hay en la cancha
  const separacion = (c) => Math.min(...usados.map((otro) => distanciaColor(c, otro)));
  for (const u of [local, visitante]) {
    u.arquero = opciones.reduce((mejor, c) => (separacion(c) > separacion(mejor) ? c : mejor));
    usados.push(u.arquero);
    u.borde = mezclar(u.camiseta, COLOR.noche, 0.5);
    // Número de la espalda: del color del detalle si se lee bien (en camisetas lisas);
    // si no, blanco u oscuro, el que más se note
    const fondoNumero = u.patron === 'rayas' ? mezclar(u.camiseta, u.detalle, 0.5) : u.camiseta;
    u.numero = contraste(u.detalle, fondoNumero) >= 2.5 && u.patron === 'liso'
      ? u.detalle
      : (contraste(COLOR.cal, fondoNumero) >= contraste(COLOR.noche, fondoNumero) ? COLOR.cal : COLOR.noche);
    u.silla = mezclar(u.camiseta, COLOR.noche, 0.62);
    u.arqueroBorde = mezclar(u.arquero, COLOR.noche, 0.5);
    u.arqueroPantaloneta = mezclar(u.arquero, COLOR.noche, 0.35);
  }
  return [local, visitante];
}


/* =====================================================================
   4. NADA SE GUARDA EN EL NAVEGADOR
   El juego no guarda el nombre ni ningún otro dato (récords, sonido,
   selecciones): todo vive solo mientras la página está abierta y se
   borra al cerrarla o recargarla. Si una versión anterior de PetuGol
   dejó datos guardados en este navegador, se borran al empezar.
   ===================================================================== */
function borrarDatosViejos() {
  try {
    const viejas = [];
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave && clave.startsWith('petugol.')) viejas.push(clave);
    }
    viejas.forEach((clave) => localStorage.removeItem(clave));
  } catch (error) {
    // Sin acceso al almacenamiento (modo privado, sin permiso): no hay nada que borrar
  }
}

// Récords de esta visita: { racha: { valor, nombre }, goles: { valor, nombre, nivel } }
const records = { racha: null, goles: null };

function mostrarRecords() {
  el.recordRacha.textContent = records.racha
    ? `${records.racha.valor} ${records.racha.valor === 1 ? 'toque' : 'toques'} · ${records.racha.nombre}`
    : 'Sin récord aún';
  if (records.goles) {
    const nivel = NIVELES[records.goles.nivel] ? ` (${NIVELES[records.goles.nivel].nombre})` : '';
    el.recordGoles.textContent = `${records.goles.valor} ${records.goles.valor === 1 ? 'gol' : 'goles'} · ${records.goles.nombre}${nivel}`;
  } else {
    el.recordGoles.textContent = 'Sin récord aún';
  }
}


/* =====================================================================
   5. SONIDOS HECHOS CON CÓDIGO
   Todo se fabrica con osciladores y ruido. En celular el audio se
   "desbloquea" al tocar Comenzar y se reanuda si el sistema lo suspende.
   ===================================================================== */
const Sonido = {
  ctx: null,
  salida: null,
  ruidoBlanco: null,
  activo: true,
  volumen: 0.6,

  // Se llama dentro del toque en "Comenzar" (gesto de la persona)
  desbloquear() {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    if (!this.ctx) {
      try {
        this.ctx = new Contexto();
      } catch (error) {
        this.ctx = null;
        return;
      }
      // Volumen general → compresor (evita que los sonidos juntos saturen) → parlantes
      this.salida = this.ctx.createGain();
      this.salida.gain.value = this.activo ? this.volumen : 0;
      const compresor = this.ctx.createDynamicsCompressor();
      this.salida.connect(compresor);
      compresor.connect(this.ctx.destination);
      // Un segundo de ruido blanco para aplausos, barridas, silbatos...
      const muestras = this.ctx.sampleRate;
      this.ruidoBlanco = this.ctx.createBuffer(1, muestras, this.ctx.sampleRate);
      const datos = this.ruidoBlanco.getChannelData(0);
      for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;
    }
    this.reanudar();
    // Truco para iPhone: un sonido vacío durante el toque desbloquea el audio
    try {
      const vacio = this.ctx.createBufferSource();
      vacio.buffer = this.ctx.createBuffer(1, 1, 22050);
      vacio.connect(this.ctx.destination);
      vacio.start(0);
    } catch (error) {
      // Se intentará otra vez con el siguiente toque
    }
  },

  // Si el celular suspendió el audio (llamada, bloqueo, otra app), se reanuda
  reanudar() {
    if (this.ctx && this.ctx.state !== 'running') {
      const promesa = this.ctx.resume();
      if (promesa && promesa.catch) promesa.catch(() => {});
    }
  },

  listo() {
    return this.activo && this.ctx !== null;
  },

  cambiar(activo) {
    this.activo = activo;
    if (this.salida) this.salida.gain.setTargetAtTime(activo ? this.volumen : 0, this.ctx.currentTime, 0.03);
  },

  tono(frecuencia, duracion, { tipo = 'square', volumen = 0.15, final = null, retraso = 0, ataque = 0.006 } = {}) {
    if (!this.listo()) return;
    const t = this.ctx.currentTime + retraso;
    const oscilador = this.ctx.createOscillator();
    const ganancia = this.ctx.createGain();
    oscilador.type = tipo;
    oscilador.frequency.setValueAtTime(frecuencia, t);
    if (final) oscilador.frequency.exponentialRampToValueAtTime(final, t + duracion);
    ganancia.gain.setValueAtTime(0.0001, t);
    ganancia.gain.exponentialRampToValueAtTime(volumen, t + Math.min(ataque, duracion * 0.5));
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    oscilador.connect(ganancia);
    ganancia.connect(this.salida);
    oscilador.start(t);
    oscilador.stop(t + duracion + 0.05);
  },

  ruido(duracion, { filtro = 'bandpass', frecuencia = 1200, final = null, q = 1, volumen = 0.2, retraso = 0, ataque = 0.004 } = {}) {
    if (!this.listo()) return;
    const t = this.ctx.currentTime + retraso;
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = this.ruidoBlanco;
    const filtroNodo = this.ctx.createBiquadFilter();
    filtroNodo.type = filtro;
    filtroNodo.frequency.setValueAtTime(frecuencia, t);
    if (final) filtroNodo.frequency.exponentialRampToValueAtTime(final, t + duracion);
    filtroNodo.Q.value = q;
    const ganancia = this.ctx.createGain();
    ganancia.gain.setValueAtTime(0.0001, t);
    ganancia.gain.exponentialRampToValueAtTime(volumen, t + Math.min(ataque, duracion * 0.6));
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    fuente.connect(filtroNodo);
    filtroNodo.connect(ganancia);
    ganancia.connect(this.salida);
    fuente.start(t, Math.random() * 0.4);
    fuente.stop(t + duracion + 0.05);
  },

  // ---- Efectos del juego ----
  patada(fuerte = true) {
    this.tono(fuerte ? 170 : 220, fuerte ? 0.12 : 0.08, { tipo: 'sine', volumen: fuerte ? 0.5 : 0.3, final: 60 });
    this.ruido(0.05, { frecuencia: 2200, volumen: fuerte ? 0.12 : 0.06 });
  },
  toque() {
    this.tono(420, 0.05, { tipo: 'triangle', volumen: 0.12, final: 300 });
  },
  // Saque de banda con las manos: un "fuuu" suave
  lanzamiento() {
    this.ruido(0.22, { frecuencia: 700, final: 1800, q: 0.8, volumen: 0.09 });
  },
  // Cambiar de jugador: un "bip" corto
  cambio() {
    this.tono(760, 0.05, { tipo: 'triangle', volumen: 0.1 });
    this.tono(1020, 0.05, { tipo: 'triangle', volumen: 0.08, retraso: 0.05 });
  },
  robo() {
    this.tono(300, 0.08, { tipo: 'square', volumen: 0.07, final: 520 });
  },
  barrida() {
    this.ruido(0.25, { frecuencia: 900, final: 300, q: 0.6, volumen: 0.14 });
  },
  atajada() {
    this.tono(110, 0.14, { tipo: 'sine', volumen: 0.45, final: 70 });
    this.ruido(0.08, { filtro: 'lowpass', frecuencia: 1200, volumen: 0.12 });
  },
  rebote() {
    this.tono(300, 0.06, { tipo: 'triangle', volumen: 0.12, final: 220 });
  },
  pique() {
    this.tono(140, 0.05, { tipo: 'sine', volumen: 0.18, final: 90 });
  },
  palo() {
    this.tono(880, 0.35, { tipo: 'square', volumen: 0.06 });
    this.tono(1320, 0.3, { tipo: 'sine', volumen: 0.1 });
  },
  silbato(veces = 1) {
    for (let i = 0; i < veces; i++) {
      const retraso = i * 0.32;
      const largo = (veces > 1 && i === veces - 1) ? 0.55 : 0.22;
      this.tono(2650, largo, { tipo: 'sine', volumen: 0.11, retraso });
      this.tono(2712, largo, { tipo: 'sine', volumen: 0.08, retraso });
      this.ruido(largo, { frecuencia: 2700, q: 8, volumen: 0.05, retraso });
    }
  },
  silbatoCorto() {
    this.tono(2900, 0.16, { tipo: 'sine', volumen: 0.1 });
    this.tono(2960, 0.16, { tipo: 'sine', volumen: 0.07 });
  },
  pitido() {
    this.tono(980, 0.09, { tipo: 'square', volumen: 0.06 });
  },
  aplausos(segundos = 1.8) {
    const palmas = Math.round(36 * segundos);
    for (let i = 0; i < palmas; i++) {
      this.ruido(0.03 + Math.random() * 0.03, {
        frecuencia: 900 + Math.random() * 1800,
        q: 0.8,
        volumen: 0.04 + Math.random() * 0.07,
        retraso: Math.random() * segundos
      });
    }
    this.ruido(segundos, { filtro: 'lowpass', frecuencia: 700, final: 1000, volumen: 0.07, ataque: 0.2 });
  },
  fiesta() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tono(f, 0.14, { tipo: 'square', volumen: 0.09, retraso: i * 0.09 });
    });
    [1046.5, 1318.5, 1568].forEach((f) => {
      this.tono(f, 0.5, { tipo: 'triangle', volumen: 0.07, retraso: 0.38 });
    });
  },
  suspenso() {
    [392, 370, 349.2, 329.6].forEach((f, i) => this.tono(f, 0.3, { tipo: 'sawtooth', volumen: 0.06, retraso: i * 0.25 }));
    this.tono(110, 1.2, { tipo: 'sine', volumen: 0.2, retraso: 1 });
  },
  // Risa: sílabas "ja" con un filtro que imita la vocal "a"
  risa(silabas, { base = 600, volumen = 0.16, retraso = 0 } = {}) {
    if (!this.listo()) return;
    for (let i = 0; i < silabas; i++) {
      const t = this.ctx.currentTime + retraso + i * 0.14;
      const altura = base * (1 - i * 0.035) * (0.95 + Math.random() * 0.1);
      const oscilador = this.ctx.createOscillator();
      oscilador.type = 'sawtooth';
      oscilador.frequency.setValueAtTime(altura * 1.15, t);
      oscilador.frequency.exponentialRampToValueAtTime(altura * 0.82, t + 0.1);
      const vocal = this.ctx.createBiquadFilter();
      vocal.type = 'bandpass';
      vocal.frequency.value = 1150;
      vocal.Q.value = 2.2;
      const ganancia = this.ctx.createGain();
      ganancia.gain.setValueAtTime(0.0001, t);
      ganancia.gain.exponentialRampToValueAtTime(volumen, t + 0.012);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      oscilador.connect(vocal);
      vocal.connect(ganancia);
      ganancia.connect(this.salida);
      oscilador.start(t);
      oscilador.stop(t + 0.14);
      this.ruido(0.03, { filtro: 'highpass', frecuencia: 3000, volumen: 0.04, retraso: retraso + i * 0.14 }); // la "j"
    }
  },
  risita() {
    this.risa(4, { base: 640, retraso: 0.45 });
  },
  carcajada() {
    this.risa(9, { base: 600, volumen: 0.18 });
    this.tono(800, 0.5, { tipo: 'sawtooth', volumen: 0.05, final: 1500, retraso: 1.3 }); // remate: "¡jiii!"
  },
  poder(tipo) {
    switch (tipo) {
      case 'mini':
        this.tono(1400, 0.28, { tipo: 'sine', volumen: 0.18, final: 300 });
        break;
      case 'turbo':
        this.tono(180, 0.32, { tipo: 'sawtooth', volumen: 0.09, final: 1300 });
        this.ruido(0.3, { frecuencia: 600, final: 4000, volumen: 0.1 });
        break;
      case 'multi':
        [660, 880, 1100].forEach((f, i) => this.tono(f, 0.09, { tipo: 'square', volumen: 0.09, retraso: i * 0.07 }));
        break;
      case 'gigante':
        this.tono(140, 0.4, { tipo: 'square', volumen: 0.08, final: 620 });
        this.tono(70, 0.4, { tipo: 'sine', volumen: 0.2, final: 310 });
        break;
      case 'escudo':
        this.tono(880, 0.45, { tipo: 'triangle', volumen: 0.11 });
        this.tono(1320, 0.45, { tipo: 'triangle', volumen: 0.07, retraso: 0.05 });
        this.tono(1760, 0.35, { tipo: 'sine', volumen: 0.05, retraso: 0.1 });
        break;
      case 'hielo':
        this.ruido(0.35, { filtro: 'highpass', frecuencia: 5000, volumen: 0.13 });
        this.tono(2400, 0.3, { tipo: 'sine', volumen: 0.07, final: 1800 });
        [3000, 3600, 4200].forEach((f, i) => this.tono(f, 0.05, { tipo: 'sine', volumen: 0.05, retraso: 0.08 + i * 0.06 }));
        break;
      case 'zigzag':
        [600, 900, 600, 900, 600].forEach((f, i) => this.tono(f, 0.06, { tipo: 'square', volumen: 0.07, retraso: i * 0.06 }));
        break;
      default:
        break;
    }
  },
  escudoRoto() {
    this.ruido(0.25, { frecuencia: 2500, volumen: 0.18 });
    this.tono(400, 0.3, { tipo: 'square', volumen: 0.09, final: 90 });
  },
  ola() {
    this.ruido(1.8, { filtro: 'lowpass', frecuencia: 500, final: 1100, volumen: 0.08, ataque: 0.7 });
  },
  trabado() {
    this.tono(500, 0.15, { tipo: 'square', volumen: 0.07 });
    this.tono(350, 0.25, { tipo: 'square', volumen: 0.07, retraso: 0.15 });
    this.silbato(1);
  }
};


/* =====================================================================
   6. ESTADO DEL PARTIDO
   Equipo 0 = tú (tu arco en x = 0, atacas hacia la derecha).
   Equipo 1 = Petunia o el jugador 2 (su arco en x = 900).
   ===================================================================== */
function crearJugador(equipo, indice) {
  const plan = FORMACION[indice];
  const x = equipo === 0 ? plan.x : LARGO - plan.x;
  return {
    equipo,
    indice,
    rol: plan.rol,
    baseX: x,
    baseY: plan.y,
    x,
    y: plan.y,
    vx: 0,
    vy: 0,
    mira: equipo === 0 ? 0 : Math.PI,  // hacia dónde mira (ángulo en la cancha)
    controlado: false,                  // lo maneja una persona en este momento
    tarea: 'formacion',
    barrida: 0,                         // segundos que le quedan a la barrida
    pausaBarrida: 0,                    // tiempo para poder barrerse otra vez
    aturdido: 0,                        // después de que le roban el balón
    distraido: 0,                       // la máquina "se distrae" a ratos
    sostener: 0,                        // el portero sostiene el balón un momento
    paso: Math.random() * VUELTA,       // para animar las piernas
    polvo: 0,                           // cada cuánto levanta polvo al correr
    miraVista: equipo === 0 ? 0 : Math.PI, // hacia dónde se ve girado el cuerpo (gira suave)
    patada: 0,                          // segundos que le quedan a la animación de patada
    lanza: 0,                           // lanzando con las manos (saque de banda, portero)
    estirada: 0,                        // el portero se lanza hacia un lado
    ladoEstirada: 1,
    semilla: Math.random() * VUELTA,    // para que no respiren ni salten todos igual
    persona: null,                      // quién juega en este puesto (ver crearPlantel)
    fuera: false,                       // expulsado: el puesto queda vacío
    cerebro: { reloj: Math.random() * 0.3, firma: '', ladoError: 1, distraidoTiro: false, dudando: false, estiro: '' }
  };
}

// ---- Plantel: titulares, suplentes y la figura de la selección ----
// Cada "persona" tiene su número, su energía y sus tarjetas. Los 5 puestos de
// la cancha (portero, 2 defensas, 2 delanteros) apuntan a la persona que está
// jugando ahí; con un cambio, el puesto pasa a otra persona.
// Todo sale de la selección (sin azar): así los dos aparatos de un partido
// online arman el mismo plantel.
function crearPlantel(codigo) {
  const lista = PLANTELES[codigo] || PLANTELES.COL;
  const semilla = codigo.charCodeAt(0) + codigo.charCodeAt(1) * 3 + codigo.charCodeAt(2) * 7;
  return lista.map(([nombre, dorsal, marca], n) => ({
    n,                                    // posición en el plantel
    dorsal,
    nombre,
    estrella: marca === 'estrella',
    piel: 1 + ((semilla + dorsal * 5) % 3), // tono de piel (variables --piel-1, 2 y 3)
    puesto: n < EN_CANCHA ? n : -1,      // puesto en la cancha (-1 = en el banco)
    energia: 1,
    amarillas: 0,
    expulsado: false,
    salio: false                          // ya lo cambiaron: no puede volver a entrar
  }));
}

// Pone a cada titular en su puesto
function asignarPlantel(equipo, codigo) {
  equipo.plantel = crearPlantel(codigo);
  equipo.jugadores.forEach((j, puesto) => {
    j.persona = equipo.plantel[puesto];
    j.fuera = false;
  });
}

// "de Messi" o "del 9"
function deQuien(j) {
  const p = j && j.persona;
  if (!p) return '';
  return p.nombre ? `de ${p.nombre}` : `del ${p.dorsal}`;
}

function dorsalDe(j) {
  return j.persona ? j.persona.dorsal : j.indice + 1;
}

function esEstrella(j) {
  return Boolean(j.persona && j.persona.estrella);
}

// Los que están en la cancha (los expulsados ya no cuentan)
function enJuego() {
  return todosLosJugadores().filter((j) => !j.fuera);
}

function deEquipo(numero) {
  return estado.equipos[numero].jugadores.filter((j) => !j.fuera);
}

// Energía → qué tan rápido corre (con más de la mitad de energía, normal)
function ritmo(j) {
  const e = j.persona ? j.persona.energia : 1;
  const cansancio = e >= 0.5 ? 1 : 0.8 + 0.4 * e;
  return cansancio * (esEstrella(j) ? ESTRELLA.velocidad : 1);
}

// Energía → qué tan fuerte patea
function potenciaDe(j) {
  const e = j.persona ? j.persona.energia : 1;
  const cansancio = e >= 0.4 ? 1 : 0.88 + 0.3 * e;
  return cansancio * (esEstrella(j) ? ESTRELLA.patada : 1);
}

function crearEquipo(numero) {
  return {
    numero,
    humano: false,       // true = lo maneja una persona
    jugadores: FORMACION.map((plan, indice) => crearJugador(numero, indice)),
    plantel: [],
    cambios: SUPLENTES,  // cambios que le quedan
    cambioPendiente: null, // en online: { puesto, entra } se hace en la próxima pausa del juego
    avisados: new Set(), // jugadores cansados que ya se avisaron (para no repetir)
    controlado: null,
    cambioControl: 0,
    bloqueoCambio: 0,    // después de usar "Cambiar", se respeta tu elección un momento
    entrada: { x: 0, y: 0 },
    // Qué teclas o dedos tienen presionada cada acción (puede ser más de uno)
    fuentes: { pase: new Set(), centro: new Set(), tiro: new Set() },
    pedidos: [],         // acciones presionadas o soltadas que faltan por hacer
    carga: null,         // segundos cargando el tiro (null = no está cargando)
    arranque: 0,         // segundos corriendo en la misma dirección (para acelerar solo)
    direccion: null,     // hacia dónde se movía en el cuadro anterior
    presion: false,      // "Presión": un compañero también va por el balón
    modoBotones: ''      // 'ataque' o 'defensa' (para no tocar la página en cada cuadro)
  };
}

function crearBalon(x, y, extra = false) {
  return {
    id: estado.siguienteId++,
    x,
    y,
    z: 0,                 // altura (el balón puede ir por el aire)
    vx: 0,
    vy: 0,
    vz: 0,
    dueno: null,          // jugador que lo lleva pegado al pie
    extra,                // true = balón del Multibalón
    vida: extra ? PODERES.multi.duracion : Infinity,
    pateador: null,
    equipoPateo: null,
    receptor: null,       // a quién va un pase
    sinRecoger: 0,        // quien patea no lo puede volver a tomar enseguida
    protegido: 0,         // tiempo en que no se lo pueden robar
    version: 0,           // cambia en cada patada o rebote (los porteros lo usan)
    giro: 0,
    enRed: false,
    rastro: [],
    fase: Math.random() * VUELTA
  };
}

const estado = {
  pantalla: 'inicio',   // 'inicio' o 'juego'
  fase: 'saque',        // 'saque', 'juego', 'parada', 'gol' o 'final'
  pausado: false,
  girando: false,            // el celular está de pie: se espera que lo acuesten
  modo: 'maquina',      // 'maquina' (contra Petunia, en este aparato) u 'online'
  nivel: 'facil',
  nombres: ['Tú', 'Petunia'],
  codigos: ['COL', 'BRA'],   // selecciones elegidas
  kits: [],                  // uniformes del partido (ver armarKits)
  goles: [0, 0],
  equipos: [],
  balones: [],
  esferas: [],
  particulas: [],
  letreros: [],              // textos de jugada que flotan sobre la cancha (¡Al palo!, ¡Atajadón!)
  ondas: [],                 // anillos en el piso cuando un tiro sale muy fuerte
  red: null,                 // la red del arco se mueve cuando entra el gol
  lenta: 0,                  // segundos de cámara lenta (cuando entra el gol)
  destellos: [],
  efectos: { mini: 0, turbo: 0, zigzag: 0, multi: 0, gigante: 0, hielo: 0 },
  duenos: { mini: 0, turbo: 0, zigzag: 0, multi: 0, gigante: 0, hielo: 0 },
  escudo: [0, 0],
  escala: [1, 1],       // tamaño de los jugadores de cada equipo (Jugadores gigantes)
  marcas: {},
  contadorMarcas: 0,
  ultimoEquipo: null,   // equipo que tocó el balón de último
  jugada: null,         // saque de banda, de esquina o de meta pendiente
  espera: null,         // jugador que espera con el balón para sacar de banda o de esquina
  historial: [],        // últimos segundos del partido (para la repetición del gol)
  repeticion: null,     // cuadros de la repetición que se está viendo
  racha: 0,
  mejorRacha: 0,
  recordRachaNuevo: false,
  tiempo: JUEGO.duracion,
  duracion: JUEGO.duracion,  // lo que dura este partido (3:00 en Normal, 4:00 en Online)
  muerteSubita: false,
  sinEmpate: false,     // en el torneo online la muerte súbita sigue hasta que alguien anote
  medioTiempo: false,   // ¿ya se jugó el primer tiempo?
  canchaCambiada: false, // en el segundo tiempo los equipos cambian de lado
  saqueInicial: 0,      // quién sacó al empezar (en el segundo tiempo saca el otro)
  // Estadísticas para la pantalla final: segundos con el balón, tiros, faltas y tarjetas
  estadisticas: { posesion: [0, 0], tiros: [0, 0], faltas: [0, 0], amarillas: [0, 0], rojas: [0, 0] },
  miLado: 0,            // equipo que maneja esta pantalla (en online, el visitante maneja el 1)
  ultimoSegundo: null,
  reloj: 0,
  relojFase: 0,
  relojEsfera: 0,
  relojOla: 0,
  relojDestello: 0,
  ancla: { x: 0, y: 0, tiempo: 0 },
  ola: null,
  celebracion: null,
  sacaEquipo: 0,
  siguienteId: 1
};
estado.equipos = [crearEquipo(0), crearEquipo(1)];
asignarPlantel(estado.equipos[0], estado.codigos[0]);
asignarPlantel(estado.equipos[1], estado.codigos[1]);

// Pequeñas herramientas matemáticas
const azar = (min, max) => min + Math.random() * (max - min);
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Lleva un ángulo al rango -π..π
function anguloCorto(angulo) {
  let a = angulo % VUELTA;
  if (a > Math.PI) a -= VUELTA;
  if (a < -Math.PI) a += VUELTA;
  return a;
}

// "Dobla" un valor entre dos paredes, como el balón rebotando en las bandas
function plegar(valor, min, max) {
  const rango = max - min;
  if (rango <= 0) return min;
  let x = (valor - min) % (2 * rango);
  if (x < 0) x += 2 * rango;
  return min + (x <= rango ? x : 2 * rango - x);
}

// Distancia de un punto a un segmento (para saber si un pase tiene la línea libre)
function distanciaASegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy || 1;
  const t = limitar(((px - ax) * dx + (py - ay) * dy) / largo2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function todosLosJugadores() {
  return estado.equipos[0].jugadores.concat(estado.equipos[1].jugadores);
}

function balonPrincipal() {
  return estado.balones.find((b) => !b.extra) || estado.balones[0];
}

function radioDe(jugador) {
  return JUEGO.radioJugador * estado.escala[jugador.equipo];
}

function radioBalon() {
  return estado.efectos.mini > 0 ? JUEGO.radioBalonMini : JUEGO.radioBalon;
}

function parametros(equipo) {
  return estado.modo === 'maquina' && equipo === 1 ? NIVELES[estado.nivel] : IA_AMIGA;
}

// Equipo que se maneja desde ESTA pantalla: contra Petunia el tuyo (el 0) y en
// online el tuyo (el otro lo maneja la otra persona desde su propio aparato)
function ladosPropios() {
  return [estado.miLado];
}

// Los botones en pantalla (un solo grupo, abajo a la derecha) manejan tu equipo.
// Estas dos funciones pasan de grupo a equipo y al revés.
function ladoDelGrupo() {
  return estado.miLado;
}

function grupoDelLado(lado) {
  return lado === estado.miLado ? 0 : -1;
}

// Hacia dónde ataca cada equipo y dónde está el arco rival
function sentidoDe(equipo) {
  return equipo === 0 ? 1 : -1;
}

function arcoRival(equipo) {
  return { x: equipo === 0 ? LARGO : 0, y: MITAD };
}

function turboDe(equipo) {
  return estado.efectos.turbo > 0 && estado.duenos.turbo === equipo;
}

// La patada se vuelve más fuerte después de cada gol
function fuerzaPatada(equipo) {
  const base = estado.modo === 'maquina' && equipo === 0 ? JUEGO.patadaTuya : parametros(equipo).patada;
  const porGoles = 1 + 0.05 * (estado.goles[0] + estado.goles[1]);
  return Math.min(base * porGoles * (turboDe(equipo) ? 1.35 : 1), 880);
}

// Un punto al azar en la zona del medio (lejos de los arcos, para que sea justo)
function puntoCentral() {
  return { x: azar(250, LARGO - 250), y: azar(70, ANCHO - 70) };
}

// Las camisetas dibujadas en la página (selector y palcos) toman los colores
// de su selección desde style.css: aquí solo se dice cuál es
function pintarCamiseta(svg, kit) {
  svg.dataset.kit = kit.codigo;
  svg.dataset.patron = kit.patron;
  if (kit.visita) svg.dataset.visita = 'si';
  else delete svg.dataset.visita;
}


/* =====================================================================
   7. VISTA: PERSPECTIVA INCLINADA Y CÁMARA
   La cancha se ve un poco inclinada: el piso se "aplasta" en la
   dirección de la profundidad y lo que tiene altura (jugadores, arcos,
   el balón por el aire) se dibuja de pie, hacia arriba en la pantalla.
   - Horizontal: tu arco a la izquierda, la gradería del fondo arriba.
   - Vertical (celular de pie): tu arco abajo y el de Petunia arriba.
   La cámara muestra solo una parte de la cancha y sigue al balón.
   Internamente se usan dos ejes de pantalla: "u" (a lo ancho de la
   pantalla) y "v" (profundidad, hacia arriba de la pantalla).
   ===================================================================== */
const vista = {
  s: 1,              // píxeles por unidad de cancha
  k: 0.72,           // aplastamiento del piso (inclinación)
  vertical: false,
  giro: false,       // cancha dada vuelta (180°): en online, el visitante ve su arco a la izquierda
  dpr: 1,
  ancho: 0,
  alto: 0,
  camU: 0,           // centro de la cámara
  camV: 0,
  oU: 0,             // esquina de arriba a la izquierda de lo que se ve
  oV: 0,
  uMin: 0, uMax: 0, vMin: 0, vMax: 0,   // tamaño del mundo
  libreArriba: 0,    // lo que tapa el marcador flotante arriba (px CSS)
  temblor: 0,        // segundos que le quedan al temblor de la cámara
  fuerzaTemblor: 0,  // cuánto tiembla (px CSS)
  duracionTemblor: 1,
  listo: false
};

// Cancha (x, y) → ejes de pantalla (u, v).
// Con "giro" la cancha se ve desde la otra tribuna (dada vuelta 180°): así, en
// online, cada quien ve a su equipo atacando hacia la derecha.
function aUV(x, y) {
  if (vista.giro) return vista.vertical ? { u: ANCHO - y, v: x } : { u: LARGO - x, v: ANCHO - y };
  return vista.vertical ? { u: y, v: LARGO - x } : { u: x, v: y };
}

// Punto de la cancha (con altura z) → píxeles del canvas
function proyectar(x, y, z = 0) {
  const { u, v } = aUV(x, y);
  return {
    px: (u - vista.oU) * vista.s,
    py: (v - vista.oV) * vista.s * vista.k - z * vista.s
  };
}

// Transformación del canvas para dibujar cosas planas sobre el piso
// (líneas, sombras, afición) directamente en unidades de cancha
function transformSuelo(c, origenU, origenV) {
  const s = vista.s;
  const k = vista.k;
  if (vista.giro) {
    // La misma cuenta que aUV, con la cancha dada vuelta
    if (!vista.vertical) c.setTransform(-s, 0, 0, -s * k, (LARGO - origenU) * s, (ANCHO - origenV) * s * k);
    else c.setTransform(0, s * k, -s, 0, (ANCHO - origenU) * s, -origenV * s * k);
  } else if (!vista.vertical) {
    c.setTransform(s, 0, 0, s * k, -origenU * s, -origenV * s * k);
  } else {
    c.setTransform(0, -s * k, s, 0, -origenU * s, (LARGO - origenV) * s * k);
  }
}

// Una dirección de pantalla (derecha/abajo) convertida a dirección de cancha
function direccionACancha(sx, sy) {
  const d = vista.vertical ? { x: -sy, y: sx } : { x: sx, y: sy };
  return vista.giro ? { x: -d.x, y: -d.y } : d;
}

function medirCancha() {
  const caja = el.estadio.getBoundingClientRect();
  if (caja.width < 2 || caja.height < 2) return false;

  // Densidad de píxeles: más nitidez en computador, menos trabajo en celular
  // (con 1.5 un celular lento se mantiene en 60 cuadros por segundo)
  // En monitores gigantes se limita a unos 8 millones de píxeles (como una pantalla 4K)
  const dprMaximo = Math.sqrt(8.3e6 / (caja.width * caja.height));
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, esTactil ? 1.5 : 2, dprMaximo));
  const ancho = Math.round(caja.width * dpr);
  const alto = Math.round(caja.height * dpr);
  el.lienzo.width = ancho;
  el.lienzo.height = alto;

  const vertical = caja.height > caja.width;
  const plan = vertical ? CAMARA.vertical : (esTactil ? CAMARA.tactil : CAMARA.horizontal);
  // Escala: lo que quepa de la zona pedida, sin pasar del máximo
  const sCss = Math.min(caja.width / plan.ancho, caja.height / (plan.alto * plan.inclinacion), CAMARA.maximo);

  vista.vertical = vertical;
  el.estadio.classList.toggle('estadio--vertical', vertical);
  // En el celular acostado el marcador flota encima de la cancha: cuánto tapa (px CSS)
  const marcador = el.marcador.getBoundingClientRect();
  vista.libreArriba = marcador.bottom > caja.top ? Math.ceil(marcador.bottom - caja.top) : 0;
  vista.k = plan.inclinacion;
  vista.s = sCss * dpr;
  vista.dpr = dpr;
  vista.ancho = ancho;
  vista.alto = alto;

  // Tamaño del mundo (cancha + pista + graderías) en los ejes de pantalla
  const mf = CANCHA.margenFondo;
  const mb = CANCHA.margenBanda;
  if (!vertical) {
    vista.uMin = -mf; vista.uMax = LARGO + mf;
    vista.vMin = -mb - 20; vista.vMax = ANCHO + mb;
  } else {
    vista.uMin = -mb; vista.uMax = ANCHO + mb;
    vista.vMin = -mf - 30; vista.vMax = LARGO + mf;
  }
  vista.listo = true;

  pintarFondo();
  const balon = balonPrincipal();
  centrarCamara(balon ? balon.x : LARGO / 2, balon ? balon.y : MITAD, true);
  return true;
}

// Mueve la cámara hacia un punto (sin salirse del estadio)
function centrarCamara(x, y, deUna = false, dt = 0) {
  const { u, v } = aUV(x, y);
  const anchoVisible = vista.ancho / vista.s;
  const altoVisible = vista.alto / (vista.s * vista.k);
  const limitarEje = (valor, min, max, visible) =>
    (max - min <= visible ? (min + max) / 2 : limitar(valor, min + visible / 2, max - visible / 2));
  // Si el marcador flota arriba, el balón se centra en lo que queda libre debajo
  const corrimiento = (vista.libreArriba * vista.dpr) / 2 / (vista.s * vista.k);
  const objetivoU = limitarEje(u, vista.uMin, vista.uMax, anchoVisible);
  const objetivoV = limitarEje(v - corrimiento, vista.vMin, vista.vMax, altoVisible);
  if (deUna) {
    vista.camU = objetivoU;
    vista.camV = objetivoV;
  } else {
    const suave = Math.min(1, dt * 4);
    vista.camU += (objetivoU - vista.camU) * suave;
    vista.camV += (objetivoV - vista.camV) * suave;
  }
  // La esquina de lo que se ve cae justo en un píxel entero del fondo:
  // así copiar el fondo es un "copiar y pegar" rápido, sin mezclar píxeles
  const s = vista.s;
  const sk = vista.s * vista.k;
  vista.oU = vista.uMin + Math.round((vista.camU - anchoVisible / 2 - vista.uMin) * s) / s;
  vista.oV = vista.vMin + Math.round((vista.camV - altoVisible / 2 - vista.vMin) * sk) / sk;
}

// La cámara sigue al balón (un poquito adelantada hacia donde va).
// En tiros fuertes, palos y goles tiembla un poquito (en píxeles enteros).
function actualizarCamara(dt) {
  if (!vista.listo) return;
  const balon = balonPrincipal();
  if (!balon) return;
  centrarCamara(balon.x + balon.vx * 0.25, balon.y + balon.vy * 0.25, false, dt);
  if (vista.temblor > 0) {
    vista.temblor = Math.max(0, vista.temblor - dt);
    const fuerza = vista.fuerzaTemblor * vista.dpr * (vista.temblor / vista.duracionTemblor);
    vista.oU += Math.round(azar(-fuerza, fuerza)) / vista.s;
    vista.oV += Math.round(azar(-fuerza, fuerza)) / (vista.s * vista.k);
  }
}

function temblar(fuerza, duracion) {
  eco('temblar', fuerza, duracion);
  if (menosMovimiento) return;
  // Si ya está temblando más fuerte, se deja ese
  const actual = vista.temblor > 0 ? vista.fuerzaTemblor * (vista.temblor / vista.duracionTemblor) : 0;
  if (actual > fuerza) return;
  vista.fuerzaTemblor = fuerza;
  vista.temblor = duracion;
  vista.duracionTemblor = duracion;
}

// ---- Letreros de jugada: un texto que salta y sube sobre la cancha ----
function letrero(texto, x, y, color, tamano = 15) {
  eco('letrero', texto, Math.round(x), Math.round(y), color, tamano);
  estado.letreros = estado.letreros.filter((l) => l.texto !== texto);
  estado.letreros.push({ texto, x, y, color, tamano, t: 0, duracion: 1.3 });
  if (estado.letreros.length > 3) estado.letreros.shift();
}

function actualizarLetreros(dt) {
  for (const l of estado.letreros) l.t += dt;
  estado.letreros = estado.letreros.filter((l) => l.t < l.duracion);
  for (const o of estado.ondas) o.t += dt;
  estado.ondas = estado.ondas.filter((o) => o.t < 0.35);
  if (estado.red) {
    estado.red.t += dt;
    if (estado.red.t > 1.4) estado.red = null;
  }
}

function dibujarLetreros() {
  if (!estado.letreros.length) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of estado.letreros) {
    const a = l.t / l.duracion;
    const subida = menosMovimiento ? 0 : a * 22;
    const { px, py } = proyectar(l.x, l.y, 46 + subida);
    // Entra creciendo con un saltico y al final se desvanece
    const escala = menosMovimiento ? 1 : (a < 0.12 ? 0.5 + (a / 0.12) * 0.7 : a < 0.22 ? 1.2 - ((a - 0.12) / 0.1) * 0.2 : 1);
    ctx.globalAlpha = a > 0.75 ? (1 - a) / 0.25 : 1;
    const tam = Math.round(l.tamano * vista.s * escala);
    ctx.font = `${tam}px ${FUENTE_TITULO}`;
    // Que no se salga de la pantalla (por ejemplo, un palo pegado al borde)
    const mitad = ctx.measureText(l.texto).width / 2 + 8 * vista.dpr;
    const x = limitar(px, mitad, el.lienzo.width - mitad);
    const y = limitar(py, tam + vista.libreArriba * vista.dpr, el.lienzo.height - tam);
    ctx.lineWidth = Math.max(2, tam * 0.22);
    ctx.strokeStyle = COLOR['letrero-borde'];
    ctx.strokeText(l.texto, x, y);
    ctx.fillStyle = l.color;
    ctx.fillText(l.texto, x, y);
  }
  ctx.globalAlpha = 1;
}

// Anillo en el piso cuando el balón sale disparado (en unidades de cancha)
function dibujarOndas() {
  for (const o of estado.ondas) {
    const a = o.t / 0.35;
    ctx.globalAlpha = (1 - a) * 0.7;
    ctx.strokeStyle = COLOR.cal;
    ctx.lineWidth = 3 * (1 - a) + 0.5;
    circulo(o.x, o.y, 8 + a * 34);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}


/* =====================================================================
   8. FONDO PRE-DIBUJADO DEL ESTADIO
   Todo el piso del estadio (pista, graderías con sillas por equipo,
   vallas, reflectores, césped, líneas) se pinta UNA sola vez en un
   lienzo grande. En cada cuadro solo se copia el pedazo que ve la cámara.
   ===================================================================== */
function pintarFondo() {
  fondo.width = Math.ceil((vista.uMax - vista.uMin) * vista.s);
  fondo.height = Math.ceil((vista.vMax - vista.vMin) * vista.s * vista.k);
  const f = ctxFondo;
  const mf = CANCHA.margenFondo;
  const mb = CANCHA.margenBanda;

  f.setTransform(1, 0, 0, 1, 0, 0);
  f.fillStyle = COLOR.noche;
  f.fillRect(0, 0, fondo.width, fondo.height);

  transformSuelo(f, vista.uMin, vista.vMin);

  // Pista color ladrillo alrededor de la cancha (como en los juegos clásicos)
  f.fillStyle = COLOR.pista;
  f.fillRect(-mf, -GRADA.valla, LARGO + 2 * mf, ANCHO + 2 * GRADA.valla);
  f.strokeStyle = COLOR['pista-borde'];
  f.lineWidth = 2;
  f.strokeRect(-mf, -GRADA.valla, LARGO + 2 * mf, ANCHO + 2 * GRADA.valla);

  // Graderías: escalones (3 filas) con sillas del color de cada equipo y escaleras
  for (const lado of [-1, 1]) {
    for (let fila = 0; fila < GRADA.filas; fila++) {
      const y = filaDeGrada(lado, fila);
      f.fillStyle = fila % 2 === 0 ? COLOR.graderia : COLOR['graderia-escalon'];
      f.fillRect(-mf, y, LARGO + 2 * mf, GRADA.fila);
      for (let x = -mf + 8; x < LARGO + mf - 8; x += 18) {
        if (esPasillo(x)) continue; // pasillo con escaleras
        f.fillStyle = estado.kits[x < LARGO / 2 ? 0 : 1].silla;
        f.fillRect(x - 6, y + 2.5, 12, GRADA.fila - 5);
      }
    }
    f.fillStyle = COLOR.escalera;
    const desde = filaDeGrada(lado, 0);
    for (let x = -mf + 81 - 7; x < LARGO + mf; x += 162) {
      for (let paso = 0; paso < GRADA.fila * GRADA.filas; paso += 5) f.fillRect(x - 3, desde + paso, 20, 2.5);
    }
  }

  // Afición sentada (se pinta una sola vez; los que se paran se dibujan encima)
  pintarHinchas(f, aficion, null);

  // Vallas publicitarias entre la pista y la gradería (y detrás de los arcos)
  f.fillStyle = COLOR.valla;
  f.fillRect(-mf, -GRADA.valla, LARGO + 2 * mf, 6);
  f.fillRect(-mf, ANCHO + GRADA.valla - 6, LARGO + 2 * mf, 6);
  f.fillRect(-mf, -GRADA.valla, 6, ANCHO + 2 * GRADA.valla);
  f.fillRect(LARGO + mf - 6, -GRADA.valla, 6, ANCHO + 2 * GRADA.valla);
  f.fillStyle = COLOR['valla-texto'];
  f.font = `4.6px ${FUENTE_TITULO}`;
  f.textAlign = 'center';
  f.textBaseline = 'middle';
  const frases = ['PETUGOL', '¡VAMOS!', 'PETUNIA', 'GOLAZO'];
  // Con la cancha dada vuelta, cada texto se gira para que no quede de cabeza
  const textoValla = (texto, x, y) => {
    if (!vista.giro) {
      f.fillText(texto, x, y);
      return;
    }
    f.save();
    f.translate(x, y);
    f.rotate(Math.PI);
    f.fillText(texto, 0, 0);
    f.restore();
  };
  for (let x = 40, i = 0; x < LARGO; x += 110, i++) {
    textoValla(frases[i % frases.length], x, -GRADA.valla + 3);
    textoValla(frases[(i + 2) % frases.length], x + 55, ANCHO + GRADA.valla - 3);
  }

  // Césped verde brillante con franjas suaves
  f.fillStyle = COLOR['cesped-oscuro'];
  f.fillRect(-14, -12, LARGO + 28, ANCHO + 24);
  f.fillStyle = COLOR['cesped-claro'];
  const franja = LARGO / 12;
  for (let i = 0; i < 12; i += 2) f.fillRect(i * franja, -12, franja, ANCHO + 24);
  // Franjas cruzadas muy suaves: el césped queda en cuadros, como en los estadios
  f.globalAlpha = 0.05;
  f.fillStyle = COLOR.cal;
  const banda = ANCHO / 8;
  for (let i = 1; i < 8; i += 2) f.fillRect(-14, i * banda, LARGO + 28, banda);
  // Textura: briznas de pasto claras y oscuras regadas (siempre las mismas, con una semilla fija)
  let semilla = 20261021;
  const azarFijo = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };
  for (let i = 0; i < 3600; i++) {
    f.globalAlpha = 0.05 + azarFijo() * 0.05;
    f.fillStyle = i % 2 ? COLOR.cal : COLOR.noche;
    f.fillRect(azarFijo() * LARGO, azarFijo() * ANCHO, 1.2 + azarFijo() * 1.4, 0.6);
  }
  f.globalAlpha = 1;

  // Luz de los reflectores sobre el césped (se pinta una sola vez, no cuesta en cada cuadro)
  for (const [x, y] of [[-20, -30], [LARGO + 20, -30], [-20, ANCHO + 30], [LARGO + 20, ANCHO + 30]]) {
    const luz = f.createRadialGradient(x, y, 0, x, y, 520);
    luz.addColorStop(0, COLOR.reflector);
    luz.addColorStop(1, COLOR['reflector-apagado']);
    f.fillStyle = luz;
    f.fillRect(-14, -12, LARGO + 28, ANCHO + 24);
  }

  // Líneas de cal
  f.strokeStyle = COLOR.cal;
  f.fillStyle = COLOR.cal;
  f.lineWidth = 3;
  f.lineJoin = 'round';
  f.strokeRect(0, 0, LARGO, ANCHO);
  linea(f, LARGO / 2, 0, LARGO / 2, ANCHO);
  f.beginPath();
  f.arc(LARGO / 2, MITAD, CANCHA.radioCirculo, 0, VUELTA);
  f.stroke();
  punto(f, LARGO / 2, MITAD, 3.5);

  for (const lado of [0, 1]) {
    const x0 = lado === 0 ? 0 : LARGO;
    const s = lado === 0 ? 1 : -1; // hacia el centro de la cancha
    f.strokeRect(Math.min(x0, x0 + s * CANCHA.fondoAreaGrande), MITAD - CANCHA.anchoAreaGrande / 2, CANCHA.fondoAreaGrande, CANCHA.anchoAreaGrande);
    f.strokeRect(Math.min(x0, x0 + s * CANCHA.fondoAreaChica), MITAD - CANCHA.anchoAreaChica / 2, CANCHA.fondoAreaChica, CANCHA.anchoAreaChica);
    const penal = x0 + s * CANCHA.puntoPenal;
    punto(f, penal, MITAD, 3);
    // Media luna
    const abertura = Math.acos((CANCHA.fondoAreaGrande - CANCHA.puntoPenal) / CANCHA.radioCirculo);
    f.beginPath();
    if (lado === 0) f.arc(penal, MITAD, CANCHA.radioCirculo, -abertura, abertura);
    else f.arc(penal, MITAD, CANCHA.radioCirculo, Math.PI - abertura, Math.PI + abertura);
    f.stroke();
  }

  // Arcos de los tiros de esquina
  for (const [x, y, desde] of [[0, 0, 0], [LARGO, 0, Math.PI / 2], [LARGO, ANCHO, Math.PI], [0, ANCHO, -Math.PI / 2]]) {
    f.beginPath();
    f.arc(x, y, 12, desde, desde + Math.PI / 2);
    f.stroke();
  }

  // Torres de reflectores en las cuatro esquinas del estadio
  for (const [x, y] of [[-mf + 14, -mb + 12], [LARGO + mf - 14, -mb + 12], [-mf + 14, ANCHO + mb - 12], [LARGO + mf - 14, ANCHO + mb - 12]]) {
    f.fillStyle = COLOR.torre;
    f.fillRect(x - 13, y - 9, 26, 18);
    f.fillStyle = COLOR.bombillo;
    for (let i = -1; i <= 1; i++) {
      for (let k = -1; k <= 1; k += 2) punto(f, x + i * 8, y + k * 4, 2.6);
    }
  }
}

// Medidas de las graderías: 3 filas de 15 unidades, valla a 29 unidades de la línea
const GRADA = Object.freeze({ filas: 3, fila: 15, valla: 29 });

// Dónde empieza cada fila de la gradería (lado -1 = arriba, 1 = abajo)
function filaDeGrada(lado, fila) {
  return lado < 0 ? -CANCHA.margenBanda + fila * GRADA.fila : ANCHO + GRADA.valla + fila * GRADA.fila;
}

// Cada 162 unidades hay un pasillo con escaleras
function esPasillo(x) {
  return Math.abs(((x + CANCHA.margenFondo) % 162) - 81) > 73;
}

function linea(c, x1, y1, x2, y2) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function punto(c, x, y, r, color) {
  if (color) c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, VUELTA);
  c.fill();
}

// Copia al canvas solo el pedazo del estadio que ve la cámara
function copiarFondo() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sx = Math.round((vista.oU - vista.uMin) * vista.s);
  const sy = Math.round((vista.oV - vista.vMin) * vista.s * vista.k);
  // Recorta a lo que existe en el lienzo del fondo (algunos navegadores no aceptan salirse)
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(fondo.width, sx + vista.ancho);
  const y1 = Math.min(fondo.height, sy + vista.alto);
  // Si el estadio no alcanza a llenar la pantalla, lo que sobra es cielo de noche
  if (x0 - sx > 0 || y0 - sy > 0 || x1 - sx < vista.ancho || y1 - sy < vista.alto) {
    ctx.fillStyle = COLOR.noche;
    ctx.fillRect(0, 0, vista.ancho, vista.alto);
  }
  if (x1 <= x0 || y1 <= y0) return;
  // Píxel por píxel, sin suavizar: es la copia más rápida
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fondo, x0, y0, x1 - x0, y1 - y0, x0 - sx, y0 - sy, x1 - x0, y1 - y0);
  ctx.imageSmoothingEnabled = true;
}


/* =====================================================================
   9. AFICIÓN
   Cada hincha ocupa una silla de su equipo. Se dibujan todos juntos por
   color (pocas instrucciones al canvas = el celular no se traba).
   Hacen "la ola", saltan cuando anota su equipo y hay destellos de cámaras.
   ===================================================================== */
const aficion = [];

function crearAficion() {
  aficion.length = 0;
  const mf = CANCHA.margenFondo;
  const ocupacion = esTactil ? 0.62 : 0.78; // qué tan llenas están las graderías
  for (const lado of [-1, 1]) {
    for (let fila = 0; fila < GRADA.filas; fila++) {
      const y = filaDeGrada(lado, fila) + GRADA.fila / 2;
      for (let x = -mf + 8; x < LARGO + mf - 8; x += 18) {
        if (esPasillo(x)) continue;               // pasillo
        if (Math.random() > ocupacion) continue;  // silla vacía
        aficion.push({
          x,
          y,
          mira: lado < 0 ? 1 : -1,           // hacia dónde queda la cancha
          equipo: x < LARGO / 2 ? 0 : 1,     // cada mitad apoya a un equipo
          tono: Math.random() < 0.5 ? 0 : 1,
          piel: Math.floor(Math.random() * 3),
          fase: Math.random() * VUELTA
        });
      }
    }
  }
}

function actualizarAficion(dt) {
  if (menosMovimiento) {
    estado.ola = null;
    estado.destellos.length = 0;
    return;
  }
  if (estado.ola) {
    estado.ola.x += estado.ola.sentido * 380 * dt;
    if (estado.ola.x < -200 || estado.ola.x > LARGO + 200) {
      estado.ola = null;
      estado.relojOla = azar(16, 26);
    }
  } else if (estado.fase === 'juego' && !esVisitaOnline()) {
    estado.relojOla -= dt;
    if (estado.relojOla <= 0) iniciarOla();
  }
  // Destellos de cámaras (muy pocos a la vez)
  estado.relojDestello -= dt;
  if (estado.relojDestello <= 0 && aficion.length) {
    estado.relojDestello = esTactil ? azar(0.4, 0.9) : azar(0.15, 0.45);
    const hincha = elegir(aficion);
    estado.destellos.push({ x: hincha.x, y: hincha.y, vida: 0.22 });
  }
  for (const d of estado.destellos) d.vida -= dt;
  estado.destellos = estado.destellos.filter((d) => d.vida > 0);
}

function iniciarOla(sentido = Math.random() < 0.5 ? 1 : -1) {
  eco('ola', sentido);
  if (menosMovimiento || estado.ola) return;
  estado.ola = { x: sentido > 0 ? -150 : LARGO + 150, sentido };
  Sonido.ola();
}

// Qué tan de pie está un hincha: 0 = sentado, 1 = de pie con los brazos arriba
function alturaHincha(h, t, celebra) {
  if (menosMovimiento) return celebra === h.equipo ? 0.8 : 0; // celebran sin saltar
  let parado = 0;
  if (estado.ola) {
    const d = (h.x - estado.ola.x) / 55;
    parado = Math.exp(-d * d);
  }
  if (celebra === h.equipo) parado = Math.max(parado, 0.55 + 0.45 * Math.abs(Math.sin(t * 9 + h.fase)));
  return parado;
}

// Los hinchas sentados ya están pintados en el fondo. En cada cuadro solo se
// dibujan los que se paran (la ola o el gol de su equipo) y que la cámara ve.
// Se dibuja sobre el piso (con la transformación de suelo ya aplicada).
function dibujarAficion(t) {
  const celebra = estado.celebracion ? estado.celebracion.equipo : null;
  const margen = 20;
  const u0 = vista.oU - margen;
  const u1 = vista.oU + vista.ancho / vista.s + margen;
  const v0 = vista.oV - margen;
  const v1 = vista.oV + vista.alto / (vista.s * vista.k) + margen;
  const lista = [];
  const alturas = [];
  if (estado.ola || celebra !== null) {
    for (const h of aficion) {
      const parado = alturaHincha(h, t, celebra);
      if (parado < 0.12) continue;
      const u = vista.vertical ? h.y : h.x;
      const v = vista.vertical ? LARGO - h.x : h.y;
      if (u < u0 || u > u1 || v < v0 || v > v1) continue;
      lista.push(h);
      alturas.push(parado);
    }
  }
  if (lista.length) pintarHinchas(ctx, lista, alturas);

  // Destellos de cámaras: una estrellita blanca que dura un instante
  if (estado.destellos.length) {
    const estrellas = new Path2D();
    for (const d of estado.destellos) {
      const tam = 7 * (d.vida / 0.22);
      estrellas.moveTo(d.x - tam, d.y);
      estrellas.lineTo(d.x + tam, d.y);
      estrellas.moveTo(d.x, d.y - tam);
      estrellas.lineTo(d.x, d.y + tam);
    }
    ctx.strokeStyle = COLOR.destello;
    ctx.lineWidth = 2;
    ctx.stroke(estrellas);
  }
}

// Pinta un grupo de hinchas en el lienzo "c", todos juntos por color
// (pocas instrucciones al canvas = el celular no se traba)
function pintarHinchas(c, lista, alturas) {
  const cuerpos = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const cabezas = [new Path2D(), new Path2D(), new Path2D()];
  const brazos = [new Path2D(), new Path2D()];

  lista.forEach((h, i) => {
    const parado = alturas ? alturas[i] : 0;
    const r = 5 * (1 + parado * 0.35);
    const y = h.y + h.mira * parado * 3;
    const cuerpo = cuerpos[h.equipo * 2 + h.tono];
    cuerpo.moveTo(h.x + r, y);
    cuerpo.arc(h.x, y, r, 0, VUELTA);

    const rc = 3.3 * (1 + parado * 0.3);
    const cabeza = cabezas[h.piel];
    cabeza.moveTo(h.x + rc, y + h.mira * 1.5);
    cabeza.arc(h.x, y + h.mira * 1.5, rc, 0, VUELTA);

    if (parado > 0.45) {
      const brazo = brazos[h.equipo];
      const alto = h.mira * (4 + parado * 5);
      brazo.moveTo(h.x - r * 0.7, y);
      brazo.lineTo(h.x - r * 1.35, y + alto);
      brazo.moveTo(h.x + r * 0.7, y);
      brazo.lineTo(h.x + r * 1.35, y + alto);
    }
  });

  const [k0, k1] = estado.kits;
  const coloresCuerpo = [k0.camiseta, k0.detalle, k1.camiseta, k1.detalle];
  cuerpos.forEach((camino, i) => {
    c.fillStyle = coloresCuerpo[i];
    c.fill(camino);
  });
  const coloresPiel = [COLOR['piel-1'], COLOR['piel-2'], COLOR['piel-3']];
  cabezas.forEach((camino, i) => {
    c.fillStyle = coloresPiel[i];
    c.fill(camino);
  });
  c.lineCap = 'round';
  c.lineWidth = 2.2;
  c.strokeStyle = k0.camiseta;
  c.stroke(brazos[0]);
  c.strokeStyle = k1.camiseta;
  c.stroke(brazos[1]);
}


/* =====================================================================
   10. PODERES
   Aparecen como esferas flotando en el medio de la cancha. Cuando el
   balón pasa por encima, el poder es para el equipo que lo tocó de último.
   ===================================================================== */
const RUTAS_ICONO = {};

function rutaIcono(icono) {
  if (!RUTAS_ICONO[icono.d]) RUTAS_ICONO[icono.d] = new Path2D(icono.d);
  return RUTAS_ICONO[icono.d];
}

function crearIcono(icono) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'icono');
  const trazo = document.createElementNS(ns, 'path');
  trazo.setAttribute('d', icono.d);
  trazo.setAttribute('class', icono.relleno ? 'icono__relleno' : 'icono__trazo');
  svg.append(trazo);
  return svg;
}

function programarEsferas(dt) {
  estado.relojEsfera -= dt;
  if (estado.relojEsfera <= 0) {
    estado.relojEsfera = azar(...JUEGO.entreEsferas);
    if (estado.esferas.length < 2) crearEsfera();
  }
  for (const esfera of estado.esferas) {
    esfera.vida -= dt;
    esfera.aparicion = Math.min(1, esfera.aparicion + dt * 3);
  }
  estado.esferas = estado.esferas.filter((esfera) => esfera.vida > 0);
}

function crearEsfera() {
  let tipos = Object.keys(PODERES);
  if (estado.balones.length > 1) tipos = tipos.filter((tipo) => tipo !== 'multi');
  const tipo = elegir(tipos);
  let lugar = puntoCentral();
  for (let intento = 0; intento < 6; intento++) {
    if (estado.balones.every((b) => distancia(b, lugar) > 70)) break;
    lugar = puntoCentral();
  }
  estado.esferas.push({ tipo, x: lugar.x, y: lugar.y, vida: 11, aparicion: 0 });
}

function tomarEsferas(balon) {
  if (balon.extra || estado.fase !== 'juego') return;
  const radio = radioBalon();
  for (let i = estado.esferas.length - 1; i >= 0; i--) {
    const esfera = estado.esferas[i];
    if (Math.hypot(balon.x - esfera.x, balon.y - esfera.y) < radio + 16) {
      estado.esferas.splice(i, 1);
      // Es del equipo que tocó el balón de último
      const equipo = estado.ultimoEquipo !== null ? estado.ultimoEquipo : (balon.vx > 0 ? 0 : 1);
      activarPoder(esfera.tipo, equipo, balon);
    }
  }
}

function activarPoder(tipo, equipo, balon) {
  const poder = PODERES[tipo];
  const nombre = estado.nombres[equipo];
  estado.marcas[equipo + ':' + tipo] = ++estado.contadorMarcas;
  eco('marca', equipo + ':' + tipo, estado.marcas[equipo + ':' + tipo]);

  switch (tipo) {
    case 'escudo':
      estado.escudo[equipo] = poder.duracion;
      break;
    case 'hielo':
      estado.efectos.hielo = poder.duracion;
      estado.duenos.hielo = equipo;
      for (const j of deEquipo(1 - equipo)) chispas(j.x, j.y, COLOR['poder-hielo'], 4, 120, 20);
      break;
    case 'multi': {
      estado.efectos.multi = poder.duracion;
      estado.duenos.multi = equipo;
      const base = equipo === 0 ? 0 : Math.PI;
      for (const giro of [-0.55, 0.55]) {
        const extra = crearBalon(balon.x, balon.y, true);
        extra.vx = Math.cos(base + giro) * 380;
        extra.vy = Math.sin(base + giro) * 380;
        extra.vz = 60;
        extra.equipoPateo = equipo;
        extra.sinRecoger = 0.3;
        estado.balones.push(extra);
      }
      break;
    }
    default:
      estado.efectos[tipo] = poder.duracion;
      estado.duenos[tipo] = equipo;
      break;
  }

  chispas(balon.x, balon.y, COLOR[poder.color], 12, 180, 8);
  Sonido.poder(tipo);
  mostrarAviso(`¡${poder.nombre} para ${nombre}!`, tipo, poder.icono);
  anunciar(`${poder.nombre} para ${nombre}: ${poder.efecto}.`);
}

function actualizarEfectos(dt) {
  for (const tipo of Object.keys(estado.efectos)) {
    estado.efectos[tipo] = Math.max(0, estado.efectos[tipo] - dt);
  }
  estado.escudo[0] = Math.max(0, estado.escudo[0] - dt);
  estado.escudo[1] = Math.max(0, estado.escudo[1] - dt);

  // Jugadores gigantes: crecen y vuelven a su tamaño poco a poco
  for (const equipo of [0, 1]) {
    const deseado = estado.efectos.gigante > 0 && estado.duenos.gigante === equipo ? 1.4 : 1;
    estado.escala[equipo] += (deseado - estado.escala[equipo]) * Math.min(1, dt * 6);
  }

  // Los balones extra del Multibalón desaparecen con un "puf"
  const quedan = [];
  for (const balon of estado.balones) {
    if (balon.extra) balon.vida -= dt;
    if (balon.extra && balon.vida <= 0) chispas(balon.x, balon.y, COLOR['poder-multi'], 10, 120, 6);
    else quedan.push(balon);
  }
  estado.balones = quedan;
}

function equipoCongelado(equipo) {
  return estado.efectos.hielo > 0 && estado.duenos.hielo !== equipo;
}


/* =====================================================================
   11. PARTÍCULAS
   Cada partícula tiene posición en la cancha y altura (z). Hay un límite
   (menor en celular) para que nunca se trabe.
   ===================================================================== */
function agregarParticula(p) {
  if (estado.particulas.length >= LIMITE_PARTICULAS) return;
  estado.particulas.push(p);
}

function chispas(x, y, color, cantidad, fuerza, altura = 6) {
  eco('chispas', Math.round(x), Math.round(y), color, cantidad, fuerza, altura);
  if (menosMovimiento) return;
  for (let i = 0; i < cantidad; i++) {
    const angulo = Math.random() * VUELTA;
    const rapidez = azar(fuerza * 0.3, fuerza);
    const vida = azar(0.3, 0.6);
    agregarParticula({
      x, y, z: altura, vx: Math.cos(angulo) * rapidez, vy: Math.sin(angulo) * rapidez, vz: azar(20, 120),
      vida, total: vida, color, forma: 'punto', tam: azar(1.5, 3), angulo: 0, giro: 0
    });
  }
}

// Serpentinas que caen desde la tribuna del equipo que hizo el gol
function serpentinas(equipo) {
  eco('serpentinas', equipo);
  if (menosMovimiento) return;
  const kit = estado.kits[equipo];
  const colores = [kit.camiseta, kit.detalle, kit.pantaloneta, COLOR.cal];
  const cantidad = esTactil ? 50 : 110;
  // Caen cerca de donde está la cámara, para que se vean
  const balon = balonPrincipal();
  const cx = balon ? balon.x : LARGO / 2;
  const cy = balon ? balon.y : MITAD;
  for (let i = 0; i < cantidad; i++) {
    const vida = azar(1.6, 2.6);
    agregarParticula({
      x: cx + azar(-260, 260), y: cy + azar(-200, 200), z: azar(60, 140),
      vx: azar(-40, 40), vy: azar(-40, 40), vz: -azar(25, 55),
      vida, total: vida, color: elegir(colores), forma: 'cinta',
      tam: azar(4, 7), angulo: Math.random() * VUELTA, giro: azar(-9, 9)
    });
  }
}

function actualizarParticulas(dt) {
  const lista = estado.particulas;
  for (let i = lista.length - 1; i >= 0; i--) {
    const p = lista[i];
    p.vida -= dt;
    if (p.vida <= 0) {
      lista[i] = lista[lista.length - 1];
      lista.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.forma === 'punto') p.vz -= JUEGO.gravedad * 0.6 * dt;
    p.z = Math.max(0, p.z + p.vz * dt);
    p.vx *= 1 - dt * 1.6;
    p.vy *= 1 - dt * 1.6;
    p.angulo += p.giro * dt;
  }
}

function dibujarParticulas() {
  if (estado.particulas.length === 0) return;
  const s = vista.s;
  const grupos = new Map();
  for (const p of estado.particulas) {
    if (!grupos.has(p.color)) grupos.set(p.color, []);
    grupos.get(p.color).push(p);
  }
  ctx.lineCap = 'round';
  for (const [color, lista] of grupos) {
    const puntos = new Path2D();
    const cintas = new Path2D();
    for (const p of lista) {
      const { px, py } = proyectar(p.x, p.y, p.z);
      if (p.forma === 'cinta') {
        const largo = p.tam * s * (0.4 + 0.6 * Math.abs(Math.cos(p.angulo * 1.7)));
        cintas.moveTo(px - Math.cos(p.angulo) * largo, py - Math.sin(p.angulo) * largo);
        cintas.lineTo(px + Math.cos(p.angulo) * largo, py + Math.sin(p.angulo) * largo);
      } else {
        const r = p.tam * s * (p.vida / p.total);
        puntos.moveTo(px + r, py);
        puntos.arc(px, py, r, 0, VUELTA);
      }
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4 * s;
    ctx.fill(puntos);
    ctx.stroke(cintas);
  }
}


/* =====================================================================
   12. BALÓN
   Si alguien lo tiene, va pegado a su pie. Si está suelto, rueda con
   fricción y puede ir por el aire (altura z). Rebota en los palos,
   lo toma quien lo toque y, si sale de la cancha, hay saque.
   ===================================================================== */

// Alguien toca el balón: sirve para la racha y para saber de quién es el poder
function registrarToque(equipo) {
  estado.ultimoEquipo = equipo;
  if (equipo === 1) {
    estado.racha = 0;
  } else if (estado.modo === 'maquina') {
    estado.racha++;
    estado.mejorRacha = Math.max(estado.mejorRacha, estado.racha);
    if (!records.racha || estado.racha > records.racha.valor) {
      records.racha = { valor: estado.racha, nombre: estado.nombres[0] };
      estado.recordRachaNuevo = true;
    }
    if (estado.racha === 10) iniciarOla();
  }
  actualizarInfo();
}

function tomarPosesion(jugador, balon) {
  balon.dueno = jugador;
  balon.vx = 0;
  balon.vy = 0;
  balon.vz = 0;
  balon.z = 0;
  balon.receptor = null;
  balon.rastro.length = 0;
  balon.protegido = jugador.rol === 'portero' ? 99 : 0.45;
  balon.version++;
  if (jugador.rol === 'portero') {
    jugador.sostener = 0.75;
    jugador.mira = jugador.equipo === 0 ? 0 : Math.PI; // mira hacia la cancha, nunca a su arco
    Sonido.atajada();
  } else {
    Sonido.toque();
  }
  registrarToque(jugador.equipo);
}

function soltarBalon(balon) {
  if (balon.dueno) balon.dueno.sostener = 0;
  balon.dueno = null;
}

// Patear: el balón sale hacia (x, y) con cierta rapidez.
// tipo: 'tiro' (se levanta un poco), 'pase' (casi por el piso) o 'centro' (por el aire).
// alto: rapidez hacia arriba (si no se da, depende del tipo).
// manos: saque de banda (sale desde arriba de la cabeza, sin patada).
function patear(jugador, balon, x, y, rapidez, { tipo = 'tiro', receptor = null, alto = null, manos = false } = {}) {
  const angulo = Math.atan2(y - jugador.y, x - jugador.x);
  soltarBalon(balon);
  jugador.mira = angulo;
  jugador.miraVista = angulo;
  if (manos) jugador.lanza = DURACION_LANZA;
  else jugador.patada = DURACION_PATADA;
  const salida = radioDe(jugador) + radioBalon() + 2;
  balon.x = jugador.x + Math.cos(angulo) * salida;
  balon.y = jugador.y + Math.sin(angulo) * salida;
  balon.vx = Math.cos(angulo) * rapidez;
  balon.vy = Math.sin(angulo) * rapidez;
  balon.z = manos ? ALTURA_MANOS : Math.min(balon.z, 20);
  balon.vz = alto !== null ? alto : (tipo === 'tiro' ? 110 : 45);
  balon.pateador = jugador;
  balon.desdeX = jugador.x;   // de dónde salió (para saber si fue un golazo de lejos)
  balon.desdeY = jugador.y;
  balon.equipoPateo = jugador.equipo;
  balon.receptor = receptor;
  if (tipo === 'tiro' && rapidez > 430 && !manos) {
    chispas(balon.x, balon.y, COLOR.cal, 7, 150, 6);
    eco('onda', Math.round(balon.x), Math.round(balon.y));
    if (!menosMovimiento) estado.ondas.push({ x: balon.x, y: balon.y, t: 0 });
    temblar(rapidez > 560 ? 3 : 2, 0.16);
  }
  balon.sinRecoger = 0.22;
  balon.rastro.length = 0;
  balon.version++;
  estado.ultimoEquipo = jugador.equipo;
  if (manos) {
    Sonido.lanzamiento();
  } else {
    Sonido.patada(tipo !== 'pase');
    chispas(balon.x, balon.y, tipo === 'tiro' ? COLOR.destello : COLOR.cal, tipo === 'tiro' ? 9 : 4, 160, 4);
  }
}

// Pase por el aire (centro o pase largo): calcula la fuerza para que el
// balón caiga cerca del punto (x, y)
function levantar(jugador, balon, x, y, receptor = null, manos = false) {
  const salida = radioDe(jugador) + radioBalon() + 2;
  const d = Math.max(30, Math.hypot(x - jugador.x, y - jugador.y) - salida);
  const z0 = manos ? ALTURA_MANOS : 0;
  const alto = manos ? limitar(100 + d * 0.15, 110, 190) : limitar(170 + d * 0.16, 180, 270);
  const g = JUEGO.gravedad;
  const vuelo = (alto + Math.sqrt(alto * alto + 2 * g * z0)) / g;  // segundos en el aire
  const aire = JUEGO.friccionBalon * 0.3;                          // por el aire frena poquito
  const rapidez = (d * aire) / (1 - Math.exp(-aire * vuelo));
  patear(jugador, balon, x, y, Math.min(rapidez, 700), { tipo: 'centro', receptor, alto, manos });
}

// Dónde va a caer un balón que va por el aire (o hacia dónde rueda)
function puntoDeCaida(b) {
  if (b.z < 2 && b.vz <= 0) return { x: b.x + b.vx * 0.2, y: b.y + b.vy * 0.2 };
  const g = JUEGO.gravedad;
  const t = (b.vz + Math.sqrt(b.vz * b.vz + 2 * g * b.z)) / g;
  const aire = JUEGO.friccionBalon * 0.3;
  const avance = (1 - Math.exp(-aire * t)) / aire;
  return { x: limitar(b.x + b.vx * avance, 0, LARGO), y: limitar(b.y + b.vy * avance, 0, ANCHO) };
}

function moverBalon(b, dt) {
  b.sinRecoger = Math.max(0, b.sinRecoger - dt);
  b.protegido = Math.max(0, b.protegido - dt);
  if (b.enRed) {
    frenarEnRed(b, dt);
    return;
  }
  if (b.dueno) moverBalonConDueno(b, dt);
  else moverBalonSuelto(b, dt);
}

function moverBalonConDueno(b, dt) {
  const j = b.dueno;
  const radio = radioBalon();
  const separacion = radioDe(j) + radio + 1.5;
  b.x = j.x + Math.cos(j.mira) * separacion;
  b.y = j.y + Math.sin(j.mira) * separacion;
  b.z = 0;
  b.giro += (Math.hypot(j.vx, j.vy) * dt) / radio;

  // No se sale por las bandas; por el fondo solo entra si está frente al arco
  // (y el portero con el balón en las manos nunca lo mete en su propio arco)
  b.y = limitar(b.y, radio, ANCHO - radio);
  const enBoca = Math.abs(b.y - MITAD) < CANCHA.anchoArco / 2;
  if (!enBoca || j.rol === 'portero') b.x = limitar(b.x, radio, LARGO - radio);

  // ¿Entró caminando al arco?
  if (enBoca && (b.x < -radio || b.x > LARGO + radio)) {
    const enMiArco = b.x < 0;
    const defensor = enMiArco ? 0 : 1;
    if (estado.escudo[defensor] > 0) {
      soltarBalon(b);
      b.x = enMiArco ? radio + 2 : LARGO - radio - 2;
      b.vx = enMiArco ? 260 : -260;
      usarEscudo(defensor, b);
    } else {
      soltarBalon(b);
      b.pateador = j; // el gol (o autogol) es de quien lo llevaba
      marcarGol(enMiArco ? 1 : 0, b);
    }
    return;
  }

  // ¿Un rival lo tocó? Se lo roba (el portero con el balón en la mano no se toca).
  // Se cuenta un poquito de margen (el pie estirado): así nadie puede esconder
  // el balón contra una línea sin que se lo puedan quitar.
  if (b.protegido <= 0 && j.rol !== 'portero') {
    for (const rival of deEquipo(1 - j.equipo)) {
      if (!puedeTocar(rival)) continue;
      if (Math.hypot(rival.x - b.x, rival.y - b.y) < radioDe(rival) + radio + 4) {
        j.aturdido = 0.35;
        tomarPosesion(rival, b);
        Sonido.robo();
        return;
      }
    }
  }
  tomarEsferas(b);
}

function puedeTocar(jugador) {
  return jugador.aturdido <= 0 && !equipoCongelado(jugador.equipo);
}

function moverBalonSuelto(b, dt) {
  const radio = radioBalon();

  // Altura: sube, cae y pica en el césped
  if (b.z > 0 || b.vz > 0) {
    b.vz -= JUEGO.gravedad * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -60) {
        b.vz = -b.vz * 0.35;
        Sonido.pique();
      } else {
        b.vz = 0;
      }
    }
  }

  // Zigzag: los tiros del equipo con el poder culebrean hacia el arco rival
  if (estado.efectos.zigzag > 0 && b.equipoPateo === estado.duenos.zigzag) {
    const haciaRival = estado.duenos.zigzag === 0 ? b.vx > 60 : b.vx < -60;
    if (haciaRival) {
      b.fase += dt * 10;
      b.y += Math.cos(b.fase) * 170 * dt;
    }
  }

  const rapidez = Math.hypot(b.vx, b.vy);
  const pasos = Math.min(16, Math.max(1, Math.ceil((rapidez * dt) / 4)));
  const h = dt / pasos;
  for (let i = 0; i < pasos; i++) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    chocarPalos(b, radio);
    if (chocarFondos(b, radio)) return;   // gol o salida por el fondo
    if (chocarBandas(b, radio)) return;   // salida por la banda
    if (tocarJugadores(b, radio)) return; // alguien lo tomó
  }

  // Fricción del césped (por el aire frena menos)
  const freno = Math.exp(-JUEGO.friccionBalon * (b.z > 2 ? 0.3 : 1) * dt);
  b.vx *= freno;
  b.vy *= freno;
  if (Math.hypot(b.vx, b.vy) < 4) {
    b.vx = 0;
    b.vy = 0;
  }
  b.giro += (rapidez * dt) / radio;

  // Estela del balón rápido
  if (rapidez > 360 && !menosMovimiento) {
    b.rastro.push({ x: b.x, y: b.y, z: b.z });
    if (b.rastro.length > 8) b.rastro.shift();
  } else if (b.rastro.length) {
    b.rastro.shift();
  }
  tomarEsferas(b);
}

// Un jugador toca el balón suelto: lo controla, lo ataja o lo desvía
function tocarJugadores(b, radio) {
  if (b.z > 52) return false; // va por encima de todos
  const rapidez = Math.hypot(b.vx, b.vy);
  for (const j of enJuego()) {
    if (!puedeTocar(j)) continue;
    // Los de campo alcanzan hasta la cabeza; el portero, con los brazos estirados
    if (b.z > (j.rol === 'portero' ? 52 : 32)) continue;
    if (b.sinRecoger > 0 && j === b.pateador) continue;
    const r = radioDe(j) + radio;
    const dx = b.x - j.x;
    const dy = b.y - j.y;
    if (dx * dx + dy * dy > r * r) continue;

    if (b.extra) {
      // Los balones extra no se controlan: salen disparados hacia el arco rival
      const rival = arcoRival(j.equipo);
      const angulo = Math.atan2(rival.y - j.y, rival.x - j.x) + azar(-0.35, 0.35);
      b.vx = Math.cos(angulo) * 360;
      b.vy = Math.sin(angulo) * 360;
      b.vz = 60;
      b.x = j.x + Math.cos(angulo) * (r + 1);
      b.y = j.y + Math.sin(angulo) * (r + 1);
      b.equipoPateo = j.equipo;
      b.pateador = j;
      b.sinRecoger = 0.2;
      Sonido.patada(false);
      continue;
    }

    if (j.rol === 'portero') {
      const color = j.equipo === 0 ? COLOR.local : COLOR.visitante;
      if (rapidez > parametros(j.equipo).portero.ataje) {
        rebotarEn(b, j, r, 0.45);
        Sonido.atajada();
        chispas(b.x, b.y, COLOR.guantes, 8, 140, 18);
        registrarToque(j.equipo);
        letrero('¡ATAJADÓN!', j.x, j.y, color);
        temblar(3, 0.2);
        return false;
      }
      if (rapidez > 330 && b.equipoPateo !== j.equipo) letrero('¡ATAJADA!', j.x, j.y, color);
      tomarPosesion(j, b);
      return true;
    }

    // Un tiro muy fuerte de un rival rebota en el jugador (como un bloqueo)
    if (rapidez > JUEGO.rapidezDesvio && b.equipoPateo !== j.equipo) {
      rebotarEn(b, j, r, 0.45);
      Sonido.rebote();
      registrarToque(j.equipo);
      return false;
    }
    tomarPosesion(j, b);
    return true;
  }
  return false;
}

// Rebote del balón en un jugador (normal desde el centro del jugador)
function rebotarEn(b, j, r, amortiguar) {
  const d = Math.hypot(b.x - j.x, b.y - j.y) || 1;
  const nx = (b.x - j.x) / d;
  const ny = (b.y - j.y) / d;
  b.x = j.x + nx * (r + 0.5);
  b.y = j.y + ny * (r + 0.5);
  const producto = b.vx * nx + b.vy * ny;
  if (producto < 0) {
    b.vx -= 2 * producto * nx;
    b.vy -= 2 * producto * ny;
  }
  const giro = azar(-0.4, 0.4);
  const vx = b.vx * Math.cos(giro) - b.vy * Math.sin(giro);
  const vy = b.vx * Math.sin(giro) + b.vy * Math.cos(giro);
  b.vx = vx * amortiguar;
  b.vy = vy * amortiguar;
  b.vz = Math.max(b.vz, 70);
  b.pateador = j;
  b.equipoPateo = j.equipo;
  b.sinRecoger = 0.15;
  b.receptor = null;
  b.version++;
}

// Bandas: los balones extra rebotan; el principal, si sale, es saque de banda
function chocarBandas(b, radio) {
  const afueraArriba = b.y < -radio;
  const afueraAbajo = b.y > ANCHO + radio;
  if (!b.extra) {
    if ((afueraArriba || afueraAbajo) && estado.fase === 'juego') {
      balonAfuera(b, 'banda');
      return true;
    }
    return false;
  }
  if (b.y < radio && b.vy < 0) {
    b.y = radio;
    b.vy = -b.vy * 0.8;
    Sonido.rebote();
  } else if (b.y > ANCHO - radio && b.vy > 0) {
    b.y = ANCHO - radio;
    b.vy = -b.vy * 0.8;
    Sonido.rebote();
  }
  return false;
}

function chocarPalos(b, radio) {
  if (b.z > CANCHA.altoArco) return; // pasa por encima
  for (const x of [0, LARGO]) {
    for (const y of [MITAD - CANCHA.anchoArco / 2, MITAD + CANCHA.anchoArco / 2]) {
      if (chocarCirculo(b, x, y, CANCHA.radioPalo + radio, 0.75)) {
        Sonido.palo();
        chispas(x, y, COLOR.cal, 6, 120, 20);
        if (!b.extra && estado.fase === 'juego') {
          letrero('¡AL PALO!', x, y, COLOR.cal);
          temblar(4, 0.25);
        }
      }
    }
  }
}

// Revisa las dos líneas de fondo. Devuelve true si hubo gol o salida.
function chocarFondos(b, radio) {
  const mitadBoca = CANCHA.anchoArco / 2;
  // Por encima del travesaño no es gol: es como si saliera por el fondo
  const enBoca = Math.abs(b.y - MITAD) < mitadBoca && b.z < CANCHA.altoArco;
  for (const lado of [0, 1]) {
    const pasoLinea = lado === 0 ? b.x < radio : b.x > LARGO - radio;
    if (!pasoLinea) continue;
    const entrando = lado === 0 ? b.vx < 0 : b.vx > 0;
    if (enBoca) {
      if (estado.escudo[lado] > 0 && entrando) {
        b.x = lado === 0 ? radio + 1 : LARGO - radio - 1;
        b.vx = -b.vx * 0.7;
        usarEscudo(lado, b);
        return false;
      }
      if (lado === 0 ? b.x < -radio : b.x > LARGO + radio) {
        marcarGol(1 - lado, b);
        return true;
      }
      b.y = limitar(b.y, MITAD - mitadBoca + radio * 0.5, MITAD + mitadBoca - radio * 0.5);
    } else if (b.extra) {
      if (entrando) {
        b.x = lado === 0 ? radio : LARGO - radio;
        b.vx = -b.vx * 0.8;
        Sonido.rebote();
      }
    } else if ((lado === 0 ? b.x < -radio : b.x > LARGO + radio) && estado.fase === 'juego') {
      balonAfuera(b, 'fondo', lado);
      return true;
    }
  }
  return false;
}

// Choque contra un círculo (los palos). Devuelve true si rebotó.
function chocarCirculo(b, cx, cy, distanciaMinima, rebote = 1) {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= distanciaMinima * distanciaMinima || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  b.x = cx + nx * distanciaMinima;
  b.y = cy + ny * distanciaMinima;
  const producto = b.vx * nx + b.vy * ny;
  if (producto < 0) {
    b.vx = (b.vx - 2 * producto * nx) * rebote;
    b.vy = (b.vy - 2 * producto * ny) * rebote;
    b.version++;
    return true;
  }
  return false;
}

function frenarEnRed(b, dt) {
  const radio = radioBalon();
  const freno = Math.pow(0.03, dt);
  b.vx *= freno;
  b.vy *= freno;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vz -= JUEGO.gravedad * dt;
  b.z = Math.max(0, b.z + b.vz * dt);
  if (b.z === 0) b.vz = 0;
  const mitadBoca = CANCHA.anchoArco / 2;
  b.y = limitar(b.y, MITAD - mitadBoca + radio, MITAD + mitadBoca - radio);
  if (b.x < LARGO / 2) b.x = limitar(b.x, -CANCHA.fondoArco + radio, -radio);
  else b.x = limitar(b.x, LARGO + radio, LARGO + CANCHA.fondoArco - radio);
}

function usarEscudo(lado, balon) {
  estado.escudo[lado] = 0;
  balon.version++;
  chispas(balon.x, balon.y, COLOR['poder-escudo'], 16, 200, 12);
  Sonido.escudoRoto();
  mostrarAviso(`¡El escudo de ${estado.nombres[lado]} salvó un gol!`, 'escudo', PODERES.escudo.icono);
  anunciar(`El escudo de ${estado.nombres[lado]} salvó un gol.`);
}


/* =====================================================================
   13. JUGADORES
   ===================================================================== */

// Elige al jugador que maneja cada persona: el de campo más cercano al balón.
// Si tu equipo tiene el balón, manejas al que lo lleva.
function elegirControlados(dt) {
  const balon = balonPrincipal();
  for (const equipo of estado.equipos) {
    for (const j of equipo.jugadores) j.controlado = false;
    if (!equipo.humano || !balon) {
      equipo.controlado = null;
      continue;
    }
    equipo.cambioControl = Math.max(0, equipo.cambioControl - dt);
    equipo.bloqueoCambio = Math.max(0, equipo.bloqueoCambio - dt);
    const deCampo = equipo.jugadores.filter((j) => j.rol !== 'portero' && !j.fuera);
    let elegido = equipo.controlado;
    // Si el balón va por el aire, cuenta dónde va a caer
    const objetivo = balon.dueno ? balon : puntoDeCaida(balon);

    if (balon.dueno && balon.dueno.equipo === equipo.numero && balon.dueno.rol !== 'portero') {
      elegido = balon.dueno;
    } else if (!balon.dueno && balon.receptor && balon.receptor.equipo === equipo.numero) {
      elegido = balon.receptor; // un pase va hacia él: lo manejas tú
    } else if (equipo.bloqueoCambio > 0 && elegido && elegido.rol !== 'portero' && !elegido.fuera) {
      // Acabas de usar "Cambiar": se respeta tu elección un momento
    } else {
      let cercano = deCampo[0];
      for (const j of deCampo) if (distancia(j, objetivo) < distancia(cercano, objetivo)) cercano = j;
      // Un pequeño margen evita que el anillo salte de un jugador a otro sin parar
      if (!elegido || elegido.rol === 'portero' || elegido.fuera ||
          (cercano !== elegido && equipo.cambioControl <= 0 && distancia(cercano, objetivo) + 30 < distancia(elegido, objetivo))) {
        elegido = cercano;
      }
    }
    if (elegido !== equipo.controlado) equipo.cambioControl = 0.3;
    equipo.controlado = elegido;
    elegido.controlado = true;
  }
}

// ---- Animación de los muñecos (no cambia el juego, solo cómo se ven) ----
const DURACION_PATADA = 0.32;
const DURACION_LANZA = 0.3;
const DURACION_ESTIRADA = 0.6;

function animarJugadores(dt) {
  const balon = balonPrincipal();
  const enRepeticion = estado.fase === 'repeticion';
  for (const j of todosLosJugadores()) {
    if (!enRepeticion) {
      j.patada = Math.max(0, j.patada - dt);
      j.lanza = Math.max(0, j.lanza - dt);
      j.estirada = Math.max(0, j.estirada - dt);
    }
    // El cuerpo gira poco a poco hacia donde mira. Quieto y sin el balón, mira el balón.
    let objetivo = j.mira;
    const velocidad = Math.hypot(j.vx, j.vy);
    const sacando = estado.espera && estado.espera.jugador === j;
    if (velocidad < 30 && balon && balon.dueno !== j && !sacando && j.patada <= 0) {
      objetivo = Math.atan2(balon.y - j.y, balon.x - j.x);
    }
    const giro = (velocidad > 120 ? 15 : 9) * dt;
    j.miraVista += limitar(anguloCorto(objetivo - j.miraVista), -giro, giro);
  }
}

function moverJugador(j, deseoX, deseoY, rapidez, dt) {
  const k = Math.min(1, dt * 10);
  j.vx += (deseoX * rapidez - j.vx) * k;
  j.vy += (deseoY * rapidez - j.vy) * k;
  j.x += j.vx * dt;
  j.y += j.vy * dt;
  const velocidad = Math.hypot(j.vx, j.vy);
  if (velocidad > 25 && !j.controlado) j.mira = Math.atan2(j.vy, j.vx);
  j.paso += velocidad * dt * 0.13; // unas 3 o 4 zancadas por segundo a toda carrera
  // Corriendo muy rápido levanta un poquito de polvo del césped
  if (velocidad > 190 && !menosMovimiento) {
    j.polvo -= dt;
    if (j.polvo <= 0) {
      j.polvo = 0.09;
      agregarParticula({
        x: j.x - j.vx * 0.04, y: j.y - j.vy * 0.04, z: 1,
        vx: -j.vx * 0.15 + azar(-15, 15), vy: -j.vy * 0.15 + azar(-15, 15), vz: azar(15, 40),
        vida: 0.35, total: 0.35, color: COLOR.polvo, forma: 'punto', tam: azar(1.6, 2.6), angulo: 0, giro: 0
      });
    }
  }
}

// Mantiene a cada jugador en su zona: los de campo dentro de las líneas,
// el portero dentro de su área grande
function limitarJugador(j) {
  const r = radioDe(j);
  if (j.rol === 'portero') {
    const desde = j.equipo === 0 ? r : LARGO - CANCHA.fondoAreaGrande;
    const hasta = j.equipo === 0 ? CANCHA.fondoAreaGrande : LARGO - r;
    j.x = limitar(j.x, desde, hasta);
    j.y = limitar(j.y, MITAD - CANCHA.anchoAreaGrande / 2, MITAD + CANCHA.anchoAreaGrande / 2);
  } else {
    j.x = limitar(j.x, r, LARGO - r);
    j.y = limitar(j.y, r, ANCHO - r);
  }
}

// Los jugadores no se montan unos encima de otros
function separarJugadores() {
  const todos = enJuego();
  for (let i = 0; i < todos.length; i++) {
    for (let k = i + 1; k < todos.length; k++) {
      const a = todos[i];
      const b = todos[k];
      const minimo = radioDe(a) + radioDe(b);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= minimo || d === 0) continue;
      const empuje = (minimo - d) / 2;
      a.x -= (dx / d) * empuje;
      a.y -= (dy / d) * empuje;
      b.x += (dx / d) * empuje;
      b.y += (dy / d) * empuje;
    }
  }
  for (const j of todos) limitarJugador(j);
}

function iniciarBarrida(j) {
  if (j.barrida > 0 || j.pausaBarrida > 0) return;
  if (j.persona) j.persona.energia = Math.max(0, j.persona.energia - CANSANCIO.barrida);
  j.barrida = JUEGO.barrida.duracion;
  j.pausaBarrida = JUEGO.barrida.pausa;
  Sonido.barrida();
  if (!menosMovimiento) {
    for (let i = 0; i < 5; i++) {
      agregarParticula({ x: j.x, y: j.y, z: 2, vx: azar(-40, 40), vy: azar(-40, 40), vz: azar(20, 60), vida: 0.4, total: 0.4, color: COLOR['cesped-claro'], forma: 'punto', tam: 2.5, angulo: 0, giro: 0 });
    }
  }
}

// Durante la barrida se desliza en línea recta; si toca el balón, se lo queda
function avanzarBarrida(j, dt) {
  j.barrida -= dt;
  const rapidez = JUEGO.barrida.velocidad * (turboDe(j.equipo) ? 1.15 : 1);
  j.vx = Math.cos(j.mira) * rapidez;
  j.vy = Math.sin(j.mira) * rapidez;
  j.x += j.vx * dt;
  j.y += j.vy * dt;
  if (estado.fase !== 'juego') return; // con el balón muerto (saque, gol) no se roba nada
  for (const balon of estado.balones) {
    if (balon.extra || balon.enRed || balon.z > 20) continue;
    if (balon.dueno && (balon.dueno.equipo === j.equipo || balon.dueno.rol === 'portero')) continue;
    if (Math.hypot(balon.x - j.x, balon.y - j.y) < radioDe(j) + radioBalon() + 5) {
      if (balon.dueno) {
        balon.dueno.aturdido = 0.6;
        letrero('¡QUITE!', j.x, j.y, j.equipo === 0 ? COLOR.local : COLOR.visitante);
        temblar(2, 0.12);
      }
      tomarPosesion(j, balon);
      Sonido.robo();
      j.barrida = 0;
      return; // se quedó con el balón: barrida limpia
    }
  }
  // Si en vez del balón le pega al rival, es falta
  for (const rival of deEquipo(1 - j.equipo)) {
    if (Math.hypot(rival.x - j.x, rival.y - j.y) < radioDe(j) + radioDe(rival) - 3) {
      cometerFalta(j, rival);
      return;
    }
  }
}

// ---- Faltas y tarjetas ----
// La barrida le pegó a un rival: el árbitro pita. Si fue dentro del área de
// quien la hizo, es penal; si no, tiro libre donde fue la falta. A veces sale
// tarjeta (más si fue desde atrás). Dos amarillas o una roja = expulsado.
function cometerFalta(infractor, victima) {
  if (estado.fase !== 'juego') return;
  const equipo = infractor.equipo;
  const sufre = victima.equipo;
  estado.estadisticas.faltas[equipo]++;
  infractor.barrida = 0;
  infractor.vx = 0;
  infractor.vy = 0;
  victima.aturdido = 0.6;

  // ¿Desde atrás? La barrida va en la misma dirección hacia donde mira el rival
  const desdeAtras = Math.cos(anguloCorto(infractor.mira - victima.miraVista)) > 0.45;
  const arcoPropio = equipo === 0 ? 0 : LARGO;
  const enArea = Math.abs(victima.x - arcoPropio) < CANCHA.fondoAreaGrande &&
    Math.abs(victima.y - MITAD) < CANCHA.anchoAreaGrande / 2;

  // Tarjeta
  const persona = infractor.persona;
  const probabilidad = desdeAtras ? FALTAS.desdeAtras : FALTAS.deFrente;
  const azarTarjeta = Math.random();
  const puedeRoja = estado.estadisticas.rojas[equipo] < FALTAS.maximoExpulsados;
  let tarjeta = null;
  if (azarTarjeta < probabilidad.roja && puedeRoja) tarjeta = 'roja';
  else if (azarTarjeta < probabilidad.roja + probabilidad.amarilla) tarjeta = 'amarilla';
  let segunda = false;
  if (tarjeta === 'amarilla' && persona) {
    persona.amarillas++;
    estado.estadisticas.amarillas[equipo]++;
    if (persona.amarillas >= 2 && puedeRoja) {
      tarjeta = 'roja';
      segunda = true;
    }
  }

  // El balón queda muerto donde fue la falta (o en el punto penal)
  for (const b of estado.balones) {
    soltarBalon(b);
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    b.z = 0;
    b.receptor = null;
    b.rastro.length = 0;
  }
  const balon = balonPrincipal();
  const sentido = sentidoDe(sufre);
  const jugada = enArea
    ? { tipo: 'penal', equipo: sufre, x: arcoPropio - sentido * CANCHA.puntoPenal, y: MITAD }
    : { tipo: 'libre', equipo: sufre, x: limitar(victima.x, 24, LARGO - 24), y: limitar(victima.y, 24, ANCHO - 24) };
  jugada.pausa = tarjeta ? FALTAS.pausaTarjeta : FALTAS.pausa;
  if (balon) {
    balon.x = jugada.x;
    balon.y = jugada.y;
  }
  estado.jugada = jugada;
  estado.espera = null;
  estado.fase = 'parada';
  estado.relojFase = 0;

  const color = equipo === 0 ? COLOR.local : COLOR.visitante;
  const codigo = estado.kits[equipo].codigo;
  Sonido.silbato(enArea ? 2 : 1);
  letrero(enArea ? '¡PENAL!' : '¡FALTA!', victima.x, victima.y, color, enArea ? 19 : 15);
  temblar(2, 0.15);
  const de = deQuien(infractor);                    // "del 9" o "de Messi"
  const quien = persona && persona.nombre ? persona.nombre : `El ${persona ? persona.dorsal : ''}`;
  const texto = `${JUGADAS[jugada.tipo]} para ${estado.nombres[sufre]}`;
  mostrarAviso(`Falta ${de} (${codigo}) · ${texto}`, 'jugada', ICONO_SILBATO);

  if (tarjeta === 'roja') {
    estado.estadisticas.rojas[equipo]++;
    mostrarCartel(segunda ? '¡Doble amarilla!' : '¡Tarjeta roja!', 'roja', `${quien} · ${codigo} · ¡a la ducha!`);
    anunciar(`Falta ${de} de ${codigo}. ${segunda ? 'Segunda amarilla: ' : ''}tarjeta roja, sale expulsado. ${texto}.`);
    expulsar(infractor);
  } else if (tarjeta === 'amarilla') {
    mostrarCartel('Tarjeta amarilla', 'amarilla', `${quien} · ${codigo}`);
    anunciar(`Falta ${de} de ${codigo}: tarjeta amarilla. ${texto}.`);
  } else {
    anunciar(`Falta ${de} de ${codigo}. ${texto}.`);
  }
  alDetenerseElJuego();
}

// Roja: el jugador se va de la cancha y su puesto queda vacío
function expulsar(j) {
  if (j.persona) j.persona.expulsado = true;
  j.fuera = true;
  j.controlado = false;
  j.barrida = 0;
  for (const b of estado.balones) if (b.dueno === j) soltarBalon(b);
  const equipo = estado.equipos[j.equipo];
  if (equipo.controlado === j) equipo.controlado = null;
  // Se va por la banda (fuera de la cancha, donde no estorba)
  j.x = LARGO / 2;
  j.y = -CANCHA.margenBanda;
  j.vx = 0;
  j.vy = 0;
  if (equipo.cambioPendiente && equipo.cambioPendiente.puesto === j.indice) equipo.cambioPendiente = null;
}

// Busca a un compañero hacia donde mira el jugador (para el pase).
// "cono": qué tan abierto busca, en radianes a cada lado (0.55 ≈ 30°)
function companeroEnLaMira(j, cono = 0.55) {
  let mejor = null;
  let mejorPuntaje = Infinity;
  for (const c of deEquipo(j.equipo)) {
    if (c === j || c.rol === 'portero') continue;
    const dx = c.x - j.x;
    const dy = c.y - j.y;
    const d = Math.hypot(dx, dy);
    if (d < 40 || d > 440) continue;
    const diferencia = Math.abs(anguloCorto(Math.atan2(dy, dx) - j.mira));
    if (diferencia > cono) continue;
    const puntaje = diferencia * 300 + d * 0.3;
    if (puntaje < mejorPuntaje) {
      mejor = c;
      mejorPuntaje = puntaje;
    }
  }
  return mejor;
}

function miraAlArco(j) {
  const arco = arcoRival(j.equipo);
  const diferencia = Math.abs(anguloCorto(Math.atan2(arco.y - j.y, arco.x - j.x) - j.mira));
  return { mirando: diferencia < 1.2, distancia: Math.hypot(arco.x - j.x, arco.y - j.y) };
}

// Remate: apunta a la esquina lejos del portero. "ayuda" mezcla hacia dónde
// miras con esa esquina (0 = sin ayuda, 1 = puntería perfecta). "desvio" añade error.
// "potencia" multiplica la fuerza (el tiro cargado llega hasta 1.15).
function rematar(j, balon, ayuda, desvio, potencia = 1) {
  const objetivo = objetivoDeRemate(j, ayuda);
  estado.estadisticas.tiros[j.equipo]++;
  const rapidez = Math.min(fuerzaPatada(j.equipo) * potencia * potenciaDe(j), 900);
  patear(j, balon, objetivo.x + sentidoDe(j.equipo) * 12, objetivo.y + azar(-desvio, desvio), rapidez, { tipo: 'tiro', alto: 110 * potencia });
}

// Punto del arco rival adonde va el remate (sin contar el error): mezcla hacia
// dónde miras con la esquina lejos del portero. También lo usa la línea de mira.
function objetivoDeRemate(j, ayuda) {
  const arco = arcoRival(j.equipo);
  const portero = estado.equipos[1 - j.equipo].jugadores[0];
  const mitadBoca = CANCHA.anchoArco / 2;
  const esquina = portero.y < MITAD ? MITAD + mitadBoca - 16 : MITAD - mitadBoca + 16;
  const distanciaX = arco.x - j.x;
  const rayo = Math.abs(Math.cos(j.mira)) > 0.1 ? j.y + Math.tan(j.mira) * distanciaX : MITAD;
  const hacia = limitar(rayo, MITAD - mitadBoca + 8, MITAD + mitadBoca - 8);
  return { x: arco.x, y: hacia * (1 - ayuda) + esquina * ayuda };
}

function pasar(j, balon, companero, manos = false) {
  // Se apunta un poquito adelante de donde va el compañero
  const destinoX = companero.x + companero.vx * 0.35;
  const destinoY = companero.y + companero.vy * 0.35;
  const d = Math.hypot(destinoX - j.x, destinoY - j.y);
  const rapidez = limitar(170 + d * 1.15, 260, 520) * (fuerzaPatada(j.equipo) / 510) * Math.min(1, potenciaDe(j));
  patear(j, balon, destinoX, destinoY, Math.min(rapidez, manos ? 420 : 620), { tipo: 'pase', receptor: companero, manos });
}

// Hacia dónde va un centro o un pase largo.
// Cerca del área rival: al punto penal (o al compañero que esté por ahí).
// Lejos: al compañero que esté hacia donde miras, el más lejano que alcance.
function destinoDeCentro(j, alcance = 560) {
  const arco = arcoRival(j.equipo);
  const sentido = sentidoDe(j.equipo);
  const companeros = deEquipo(j.equipo).filter((c) => c !== j && c.rol !== 'portero');
  if (Math.hypot(arco.x - j.x, arco.y - j.y) < 340) {
    const penal = { x: arco.x - sentido * (CANCHA.puntoPenal + 10), y: MITAD };
    let mejor = null;
    let dMejor = 150;
    for (const c of companeros) {
      const d = distancia(c, penal);
      if (d < dMejor) {
        mejor = c;
        dMejor = d;
      }
    }
    if (mejor) return { x: mejor.x + mejor.vx * 0.5, y: mejor.y + mejor.vy * 0.5, receptor: mejor };
    return { x: penal.x, y: penal.y, receptor: null };
  }
  let mejor = null;
  let mejorPuntaje = -Infinity;
  for (const c of companeros) {
    const dx = c.x - j.x;
    const dy = c.y - j.y;
    const d = Math.hypot(dx, dy);
    if (d < 110 || d > alcance) continue;
    const diferencia = Math.abs(anguloCorto(Math.atan2(dy, dx) - j.mira));
    if (diferencia > 0.8) continue;
    const puntaje = d - diferencia * 200;
    if (puntaje > mejorPuntaje) {
      mejor = c;
      mejorPuntaje = puntaje;
    }
  }
  if (mejor) return { x: mejor.x + mejor.vx * 0.8, y: mejor.y + mejor.vy * 0.8, receptor: mejor };
  const largo = Math.min(260, alcance);
  return {
    x: limitar(j.x + Math.cos(j.mira) * largo, 20, LARGO - 20),
    y: limitar(j.y + Math.sin(j.mira) * largo, 20, ANCHO - 20),
    receptor: null
  };
}

// ---- Las acciones de los botones (las usa la persona) ----

// Tiro: mientras más lo cargas, más fuerte (y un poco menos preciso)
function dispararHumano(j, balon, carga) {
  const potencia = 0.85 + 0.3 * Math.min(1, carga / CARGA_MAXIMA);
  const desvio = (6 + (potencia - 0.85) * 60) * (esEstrella(j) ? ESTRELLA.punteria : 1);
  if (miraAlArco(j).mirando) {
    rematar(j, balon, 0.6, desvio, potencia);
  } else {
    // Mirando hacia otro lado: despeje fuerte hacia donde miras
    const rapidez = fuerzaPatada(j.equipo) * 0.85 * potencia * potenciaDe(j);
    patear(j, balon, j.x + Math.cos(j.mira) * 100, j.y + Math.sin(j.mira) * 100, rapidez, { tipo: 'tiro', alto: 90 * potencia });
  }
}

// Pase por el piso al compañero hacia donde miras; si no hay nadie, al espacio
function paseHumano(j, balon) {
  const companero = companeroEnLaMira(j, 0.6) || companeroEnLaMira(j, 1.3);
  if (companero) pasar(j, balon, companero);
  else patear(j, balon, j.x + Math.cos(j.mira) * 150, j.y + Math.sin(j.mira) * 150, 360, { tipo: 'pase' });
}

// Remate de primera: si el balón está suelto y muy cerca (aunque venga por el aire)
function rematarDePrimera(j) {
  const alcance = radioDe(j) + radioBalon() + 16;
  const balon = estado.balones.find((b) => !b.extra && !b.dueno && !b.enRed && b.z < 50 &&
    Math.hypot(b.x - j.x, b.y - j.y) < alcance);
  if (!balon) return false;
  const arco = arcoRival(j.equipo);
  j.mira = Math.atan2(arco.y - j.y, arco.x - j.x);
  registrarToque(j.equipo);
  rematar(j, balon, 0.5, 12, 1);
  return true;
}

// Barrida: si no estás moviendo el joystick, se tira hacia el balón
function barridaHumana(j, equipo, balon) {
  const e = equipo.entrada;
  if (Math.hypot(e.x, e.y) < 0.2 && distancia(j, balon) < 110) j.mira = Math.atan2(balon.y - j.y, balon.x - j.x);
  iniciarBarrida(j);
}

// Cambiar: pasas a manejar al compañero más cercano al balón
function cambiarJugador(equipo) {
  const balon = balonPrincipal();
  if (!balon) return;
  const objetivo = balon.dueno ? balon : puntoDeCaida(balon);
  const candidatos = equipo.jugadores.filter((j) => j.rol !== 'portero' && !j.fuera && j !== equipo.controlado);
  if (!candidatos.length) return;
  candidatos.sort((a, b) => distancia(a, objetivo) - distancia(b, objetivo));
  if (equipo.controlado) equipo.controlado.controlado = false;
  equipo.controlado = candidatos[0];
  candidatos[0].controlado = true;
  equipo.bloqueoCambio = 1.5;
  equipo.cambioControl = 0.3;
  Sonido.cambio();
}

// Hace lo que la persona pidió con los botones (o las teclas) desde el cuadro anterior
function procesarAcciones(equipo, dt) {
  const pedidos = equipo.pedidos.splice(0);
  if (!equipo.humano) return;
  const balon = balonPrincipal();
  const enJuego = estado.fase === 'juego' && !equipoCongelado(equipo.numero);
  for (const pedido of pedidos) {
    const j = equipo.controlado;
    if (pedido === 'tiro:arriba') {
      // Se suelta "Tiro": sale el remate con la fuerza cargada
      if (enJuego && j && balon && equipo.carga !== null && balon.dueno === j) dispararHumano(j, balon, equipo.carga);
      equipo.carga = null;
      continue;
    }
    if (!enJuego || !j || !balon) continue;
    const espera = estado.espera && estado.espera.jugador === j ? estado.espera : null;
    const conBalon = balon.dueno === j;
    switch (pedido) {
      case 'pase:abajo':
        if (espera && espera.tipo === 'penal') patearBalonParado(j, balon);
        else if (espera) sacar(j, balon, 'pase');
        else if (conBalon) paseHumano(j, balon);
        else if (!balon.dueno || balon.dueno.equipo !== equipo.numero) cambiarJugador(equipo);
        break;
      case 'centro:abajo':
        if (espera && espera.tipo === 'penal') {
          patearBalonParado(j, balon);
        } else if (espera) {
          sacar(j, balon, 'centro');
        } else if (conBalon) {
          const destino = destinoDeCentro(j);
          levantar(j, balon, destino.x, destino.y, destino.receptor);
        }
        break;
      case 'tiro:abajo':
        if (espera && (espera.tipo === 'penal' || espera.tipo === 'libre')) patearBalonParado(j, balon);
        else if (espera) sacar(j, balon, 'centro');
        else if (conBalon) equipo.carga = 0;            // empieza a cargar
        else if (!rematarDePrimera(j)) barridaHumana(j, equipo, balon);
        break;
      default:
        break;
    }
  }
  // Cargando el tiro: con la fuerza máxima sale solo
  if (equipo.carga !== null) {
    const j = equipo.controlado;
    if (!enJuego || !j || !balon || balon.dueno !== j) {
      equipo.carga = null;
    } else {
      equipo.carga += dt;
      if (equipo.carga >= CARGA_MAXIMA) {
        dispararHumano(j, balon, equipo.carga);
        equipo.carga = null;
      }
    }
  }
  // "Presión" vale mientras se sostiene y el balón lo tiene el rival (o está suelto)
  equipo.presion = equipo.fuentes.centro.size > 0 && !(balon && balon.dueno && balon.dueno.equipo === equipo.numero);
}

// ---- Jugador que maneja una persona ----
// Correr es automático (como en Dream League Soccer): si sigues en la misma
// dirección un momento, el jugador acelera solo. Con el balón acelera menos.
function moverHumano(j, equipo, dt) {
  const entrada = equipo.entrada;
  const fuerza = Math.min(1, Math.hypot(entrada.x, entrada.y));
  if (fuerza > 0.6) {
    const angulo = Math.atan2(entrada.y, entrada.x);
    const recto = equipo.direccion !== null && Math.abs(anguloCorto(angulo - equipo.direccion)) < 0.6;
    equipo.arranque = recto ? equipo.arranque + dt : 0;
    equipo.direccion = angulo;
  } else {
    equipo.arranque = 0;
    equipo.direccion = null;
  }
  if (fuerza > 0.2) j.mira = Math.atan2(entrada.y, entrada.x);
  const tieneBalon = estado.balones.some((b) => b.dueno === j);
  const acelera = limitar((equipo.arranque - 0.35) / 0.5, 0, 1);
  const sprint = 1 + acelera * (tieneBalon ? 0.1 : 0.25);
  const rapidez = (tieneBalon ? JUEGO.velocidadConBalon : JUEGO.velocidadJugador) * (turboDe(j.equipo) ? 1.2 : 1) * sprint * ritmo(j);
  const largo = Math.hypot(entrada.x, entrada.y) || 1;
  moverJugador(j, (entrada.x / largo) * fuerza, (entrada.y / largo) * fuerza, rapidez, dt);
}

// ---- Inteligencia de los jugadores automáticos ----

// Cada equipo decide quién persigue el balón y quién cubre
function asignarTareas() {
  const balon = balonPrincipal();
  for (const equipo of estado.equipos) {
    for (const j of equipo.jugadores) j.tarea = 'formacion';
    if (!balon) continue;
    const tiene = balon.dueno && balon.dueno.equipo === equipo.numero;
    if (tiene) continue;
    const libres = equipo.jugadores
      .filter((j) => j.rol !== 'portero' && !j.controlado && !j.fuera)
      .sort((a, b) => distancia(a, balon) - distancia(b, balon));
    // Con una persona en el equipo, ella persigue y los automáticos cubren;
    // con "Presión", el compañero más cercano también va por el balón
    const ayudaPresion = equipo.humano && equipo.presion;
    if ((!equipo.humano || ayudaPresion) && libres[0]) libres[0].tarea = 'perseguir';
    const cubre = equipo.humano && !ayudaPresion ? libres[0] : libres[1];
    if (cubre) cubre.tarea = 'cubrir';
  }
}

function puntoDeFormacion(j, balon, tiene) {
  const sentido = sentidoDe(j.equipo);
  const oscilacion = Math.sin(estado.reloj * 0.8 + j.indice * 1.7) * 8;
  let x = j.baseX + (balon.x - LARGO / 2) * 0.5 + sentido * (tiene ? 60 : -25);
  let y = j.baseY + (balon.y - MITAD) * 0.3 + oscilacion;
  x = limitar(x, 40, LARGO - 40);
  y = limitar(y, 30, ANCHO - 30);
  return { x, y };
}

function irHacia(j, x, y, rapidez, dt) {
  const dx = x - j.x;
  const dy = y - j.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) {
    moverJugador(j, 0, 0, rapidez, dt);
    return;
  }
  const llegada = Math.min(1, d / 30); // frena al llegar
  moverJugador(j, (dx / d) * llegada, (dy / d) * llegada, rapidez, dt);
}

function pensarJugador(j, dt) {
  const p = parametros(j.equipo);
  const balon = balonPrincipal();
  const rapidez = JUEGO.velocidadJugador * p.ia.velocidad * (turboDe(j.equipo) ? 1.2 : 1) * ritmo(j);

  // La máquina a veces se distrae: se queda quieta un momento
  if (j.distraido > 0) {
    moverJugador(j, 0, 0, rapidez, dt);
    return;
  }
  if (p.ia.distraccion > 0 && estado.fase === 'juego' && Math.random() < p.ia.distraccion * dt && !(balon && balon.dueno === j)) {
    j.distraido = 0.9;
    return;
  }
  if (!balon) return;

  // Con el balón
  if (balon.dueno === j) {
    pensarConBalon(j, balon, p, dt);
    return;
  }

  const tiene = balon.dueno && balon.dueno.equipo === j.equipo;
  if (!balon.dueno && balon.receptor === j) {
    // Va a recibir un pase: sale al encuentro del balón (o a donde va a caer)
    const caida = puntoDeCaida(balon);
    irHacia(j, caida.x, caida.y, rapidez, dt);
  } else if (j.tarea === 'perseguir') {
    irHacia(j, balon.x + balon.vx * 0.15, balon.y + balon.vy * 0.15, rapidez, dt);
    // Barrida si el rival lleva el balón muy cerca (desde atrás casi nunca: sería falta)
    const desdeAtras = balon.dueno &&
      Math.cos(anguloCorto(Math.atan2(balon.y - j.y, balon.x - j.x) - balon.dueno.miraVista)) > 0.45;
    if (balon.dueno && balon.dueno.equipo !== j.equipo && balon.dueno.rol !== 'portero' &&
        distancia(j, balon) < 42 && Math.random() < p.ia.barrida * dt * 3 * (desdeAtras ? 0.25 : 1)) {
      j.mira = Math.atan2(balon.y - j.y, balon.x - j.x);
      iniciarBarrida(j);
    }
  } else if (j.tarea === 'cubrir') {
    const propio = { x: j.equipo === 0 ? 0 : LARGO, y: MITAD };
    irHacia(j, propio.x + (balon.x - propio.x) * 0.55, propio.y + (balon.y - propio.y) * 0.55, rapidez, dt);
  } else {
    const punto = puntoDeFormacion(j, balon, tiene);
    irHacia(j, punto.x, punto.y, rapidez * 0.85, dt);
  }
}

function pensarConBalon(j, balon, p, dt) {
  const arco = arcoRival(j.equipo);
  const rapidez = JUEGO.velocidadConBalon * p.ia.velocidad * (turboDe(j.equipo) ? 1.2 : 1) * ritmo(j);
  let dx = arco.x - j.x;
  let dy = arco.y - j.y;
  const dArco = Math.hypot(dx, dy);
  dx /= dArco;
  dy /= dArco;

  // Esquiva al rival más cercano que tenga adelante
  let cercano = null;
  let dCercano = Infinity;
  for (const r of deEquipo(1 - j.equipo)) {
    const d = distancia(r, j);
    if (d < dCercano) {
      cercano = r;
      dCercano = d;
    }
  }
  if (cercano && dCercano < 85) {
    const adelante = (cercano.x - j.x) * dx + (cercano.y - j.y) * dy;
    if (adelante > 0) {
      // Se abre hacia el lado contrario de donde está el rival
      const lado = ((cercano.x - j.x) * -dy + (cercano.y - j.y) * dx) > 0 ? -1 : 1;
      const perpendicularX = -dy * lado;
      const perpendicularY = dx * lado;
      dx += perpendicularX * 1.1;
      dy += perpendicularY * 1.1;
    }
  }
  // Lejos de las bandas
  if (j.y < 50) dy += 0.6;
  if (j.y > ANCHO - 50) dy -= 0.6;
  const largo = Math.hypot(dx, dy) || 1;
  moverJugador(j, dx / largo, dy / largo, rapidez, dt);
  j.mira = Math.atan2(j.vy, j.vx);

  // Decide cada cierto tiempo (el nivel define qué tan rápido)
  const c = j.cerebro;
  c.reloj -= dt;
  if (c.reloj > 0) return;
  c.reloj = p.ia.reaccion * azar(0.8, 1.2);

  // Desde la banda y cerca del área rival, a veces manda un centro por el aire
  if (dArco < 330 && Math.abs(j.y - MITAD) > 150 && Math.random() < 0.4) {
    const destino = destinoDeCentro(j);
    if (destino.receptor) {
      levantar(j, balon, destino.x, destino.y, destino.receptor);
      return;
    }
  }
  if (dArco < p.ia.rangoTiro) {
    j.mira = Math.atan2(arco.y - j.y, arco.x - j.x);
    rematar(j, balon, 1, p.ia.desvioTiro * (esEstrella(j) ? ESTRELLA.punteria : 1));
    return;
  }
  const presionada = dCercano < 55;
  if ((presionada && Math.random() < p.ia.pase) || Math.random() < 0.25 * p.ia.reaccion) {
    const companero = mejorCompanero(j);
    if (companero) {
      pasar(j, balon, companero);
    } else if (presionada) {
      // Sin línea de pase por el piso: pase largo por encima de los rivales
      const destino = destinoDeCentro(j);
      if (destino.receptor) levantar(j, balon, destino.x, destino.y, destino.receptor);
    }
  }
}

// El compañero más libre y más adelantado, con la línea de pase despejada
function mejorCompanero(j) {
  const sentido = sentidoDe(j.equipo);
  let mejor = null;
  let mejorPuntaje = -Infinity;
  for (const c of deEquipo(j.equipo)) {
    if (c === j || c.rol === 'portero') continue;
    const d = distancia(c, j);
    if (d < 50 || d > 460) continue;
    let libre = Infinity;
    let lineaLibre = true;
    for (const r of deEquipo(1 - j.equipo)) {
      libre = Math.min(libre, distancia(r, c));
      if (distanciaASegmento(r.x, r.y, j.x, j.y, c.x, c.y) < 22) lineaLibre = false;
    }
    if (!lineaLibre) continue;
    const puntaje = (c.x - j.x) * sentido * 0.6 + Math.min(libre, 120);
    if (puntaje > mejorPuntaje) {
      mejor = c;
      mejorPuntaje = puntaje;
    }
  }
  return mejor;
}

// ---- Porteros (siempre automáticos) ----
function pensarPortero(j, dt) {
  const p = parametros(j.equipo).portero;
  const c = j.cerebro;
  const sentido = sentidoDe(j.equipo);
  const lineaX = j.equipo === 0 ? 0 : LARGO;
  const mitadBoca = CANCHA.anchoArco / 2;
  const rapidez = JUEGO.velocidadPortero * p.velocidad;
  const balon = balonPrincipal();

  // Con el balón en las manos: espera un momento y lo entrega a un compañero
  const enManos = estado.balones.find((b) => b.dueno === j);
  if (enManos) {
    moverJugador(j, 0, 0, rapidez, dt);
    j.mira = sentido > 0 ? 0 : Math.PI;
    j.sostener -= dt;
    if (j.sostener <= 0) {
      const companero = mejorCompanero(j) || elegir(deEquipo(j.equipo).filter((c) => c.rol !== 'portero'));
      enManos.protegido = 0;
      pasar(j, enManos, companero);
    }
    return;
  }

  let objetivoX = lineaX + sentido * 22;
  let objetivoY = MITAD;
  c.dudando = false;
  // El balón más peligroso: el que viene hacia su arco
  let peligro = null;
  for (const b of estado.balones) {
    if (b.dueno || b.enRed) continue;
    const viene = sentido > 0 ? b.vx < -40 : b.vx > 40;
    if (viene && (!peligro || Math.abs(b.x - j.x) < Math.abs(peligro.x - j.x))) peligro = b;
  }
  if (peligro) {
    const t = Math.abs((j.x - peligro.x) / peligro.vx);
    const llegada = plegar(peligro.y + peligro.vy * t, 0, ANCHO);
    const firma = peligro.id + ':' + peligro.version;
    if (firma !== c.firma) {
      c.firma = firma;
      const aPuerta = Math.abs(llegada - MITAD) < mitadBoca + 10;
      c.distraidoTiro = aPuerta && Math.random() < p.distraccion; // casi nunca... pero a veces
      c.ladoError = Math.random() < 0.5 ? -1 : 1;
    }
    objetivoY = c.distraidoTiro ? llegada + c.ladoError * 48 : llegada;
    c.dudando = c.distraidoTiro;
    // Si el tiro va a puerta y lejos de él, se lanza (es solo la animación)
    const lejos = objetivoY - j.y;
    if (c.estiro !== firma && t < 0.42 && Math.abs(lejos) > 24 && Math.abs(llegada - MITAD) < mitadBoca + 14) {
      c.estiro = firma;
      j.estirada = DURACION_ESTIRADA;
      j.ladoEstirada = lejos > 0 ? 1 : -1;
    }
  } else if (balon) {
    objetivoY = MITAD + (balon.y - MITAD) * 0.5;
    // Sale a buscar un balón suelto que esté dentro de su área
    const dentro = Math.abs(balon.x - lineaX) < CANCHA.fondoAreaGrande && Math.abs(balon.y - MITAD) < CANCHA.anchoAreaGrande / 2;
    if (!balon.dueno && dentro && distancia(balon, j) < 120) {
      objetivoX = balon.x;
      objetivoY = balon.y;
    }
  }
  if (objetivoX === lineaX + sentido * 22) objetivoY = limitar(objetivoY, MITAD - mitadBoca - 12, MITAD + mitadBoca + 12);
  irHacia(j, objetivoX, objetivoY, rapidez, dt);
}

function actualizarJugadores(dt) {
  elegirControlados(dt);
  for (const equipo of estado.equipos) procesarAcciones(equipo, dt);
  asignarTareas();
  // En un penal todos esperan quietos (fuera del área) hasta que patean
  // (se guarda quién patea: cuando patea, estado.espera se vuelve null en medio del recorrido)
  const pateador = estado.espera && estado.espera.tipo === 'penal' ? estado.espera.jugador : null;
  for (const equipo of estado.equipos) {
    const congelado = equipoCongelado(equipo.numero);
    for (const j of equipo.jugadores) {
      if (j.fuera) continue; // expulsado: ya no juega
      j.aturdido = Math.max(0, j.aturdido - dt);
      j.pausaBarrida = Math.max(0, j.pausaBarrida - dt);
      j.distraido = Math.max(0, j.distraido - dt);
      if (congelado || estado.fase === 'saque' || (pateador && estado.espera && pateador !== j && j.rol !== 'portero')) {
        j.vx = 0;
        j.vy = 0;
        continue;
      }
      if (estado.espera && estado.espera.jugador === j) esperarSaque(j, equipo, dt);
      else if (j.barrida > 0) avanzarBarrida(j, dt);
      else if (j.rol === 'portero') pensarPortero(j, dt);
      else if (j.controlado) moverHumano(j, equipo, dt);
      else pensarJugador(j, dt);
      if (estado.fase === 'juego') cansar(j, dt);
    }
  }
  separarJugadores();
  if (estado.espera) apartarRivales();
}

// ---- Cansancio ----
// Correr rápido gasta mucha energía; trotar, poca; casi quieto se recupera.
// El portero casi no corre: no se cansa.
function cansar(j, dt) {
  const p = j.persona;
  if (!p || j.rol === 'portero') return;
  const f = Math.hypot(j.vx, j.vy) / JUEGO.velocidadJugador;
  if (f < 0.2) {
    p.energia = Math.min(1, p.energia + CANSANCIO.recupera * dt);
    return;
  }
  const gasto = (CANSANCIO.base + CANSANCIO.carrera * f * f) * (p.estrella ? ESTRELLA.cansancio : 1);
  p.energia = Math.max(0, p.energia - gasto * dt);
}

// ---- Saque de banda y tiro de esquina: el jugador espera con el balón ----

// La persona apunta con el joystick o las teclas (solo hacia adentro de la
// cancha) y saca con Pase o Centro. La máquina saca sola en un momento.
function esperarSaque(j, equipo, dt) {
  const espera = estado.espera;
  const balon = balonPrincipal();
  j.vx = 0;
  j.vy = 0;
  if (!balon || balon.dueno !== j || estado.fase !== 'juego') {
    estado.espera = null;
    return;
  }
  espera.tiempo += dt;
  balon.protegido = 99; // nadie se lo puede quitar mientras espera
  if (j.controlado && equipo.humano) {
    const e = equipo.entrada;
    // Hacia dónde se puede apuntar: en la banda y la esquina, hacia adentro;
    // en el tiro libre, casi a cualquier lado; en el penal, hacia el arco
    const minimo = espera.tipo === 'penal' ? 0.55 : (espera.tipo === 'libre' ? -0.3 : 0.15);
    if (Math.hypot(e.x, e.y) > 0.3) {
      const angulo = Math.atan2(e.y, e.x);
      if (Math.cos(angulo) * espera.nx + Math.sin(angulo) * espera.ny > minimo) j.mira = angulo;
    }
    // Si se demora mucho, saca solo (el penal lo patea)
    if (espera.tiempo > 6) {
      if (espera.tipo === 'penal') patearBalonParado(j, balon);
      else sacar(j, balon, 'pase');
    }
  } else if (espera.tiempo > espera.limite) {
    sacarMaquina(j, balon);
  }
}

// Saca de banda (con las manos) o de esquina: "pase" corto o "centro" por el aire
function sacar(j, balon, como) {
  const espera = estado.espera;
  const manos = Boolean(espera && espera.tipo === 'banda');
  estado.espera = null;
  balon.protegido = 0;
  if (como === 'centro') {
    const destino = destinoDeCentro(j, manos ? 320 : 600);
    levantar(j, balon, destino.x, destino.y, destino.receptor, manos);
    return;
  }
  const companero = companeroEnLaMira(j, 0.6) || companeroEnLaMira(j, 1.3);
  if (companero) pasar(j, balon, companero, manos);
  else patear(j, balon, j.x + Math.cos(j.mira) * 140, j.y + Math.sin(j.mira) * 140, 340, { tipo: 'pase', manos });
}

// Tiro libre o penal de la persona: remate al arco hacia donde apunta
function patearBalonParado(j, balon) {
  estado.espera = null;
  balon.protegido = 0;
  dispararHumano(j, balon, CARGA_MAXIMA * 0.55);
}

function sacarMaquina(j, balon) {
  const espera = estado.espera;
  const arco = arcoRival(j.equipo);
  const sentido = sentidoDe(j.equipo);
  // Penal (o tiro libre cerca del arco): remata a la esquina lejos del portero
  if (espera.tipo === 'penal' || (espera.tipo === 'libre' && espera.cerca && Math.random() < 0.7)) {
    estado.espera = null;
    balon.protegido = 0;
    j.mira = Math.atan2(arco.y - j.y, arco.x - j.x);
    const desvio = parametros(j.equipo).ia.desvioTiro * (esEstrella(j) ? ESTRELLA.punteria : 1);
    rematar(j, balon, 1, espera.tipo === 'penal' ? desvio * 0.9 : desvio * 1.2);
    return;
  }
  if (espera.tipo === 'esquina' && Math.random() < 0.7) {
    j.mira = Math.atan2(MITAD - j.y, arco.x - sentido * CANCHA.puntoPenal - j.x);
    sacar(j, balon, 'centro');
    return;
  }
  const companero = mejorCompanero(j);
  if (companero && distancia(companero, j) < 320) {
    j.mira = Math.atan2(companero.y - j.y, companero.x - j.x);
    sacar(j, balon, 'pase');
  } else {
    // Nadie cerca: lanzamiento largo hacia adelante
    j.mira = Math.atan2(espera.ny * 0.8, sentido * 0.6);
    sacar(j, balon, 'centro');
  }
}

// Mientras alguien espera para sacar, los rivales se quedan a distancia
function apartarRivales() {
  const balon = balonPrincipal();
  if (!balon) return;
  for (const rival of deEquipo(1 - estado.espera.jugador.equipo)) {
    const d = Math.hypot(rival.x - balon.x, rival.y - balon.y);
    if (d < 60 && d > 0) {
      rival.x = balon.x + ((rival.x - balon.x) / d) * 60;
      rival.y = balon.y + ((rival.y - balon.y) / d) * 60;
      limitarJugador(rival);
    }
  }
}


/* =====================================================================
   14. REGLAS: SAQUE, GOL, SAQUES DE BANDA/ESQUINA/META, RELOJ Y FINAL
   ===================================================================== */
function nuevaPartida() {
  estado.goles = [0, 0];
  estado.equipos = [crearEquipo(0), crearEquipo(1)];
  estado.equipos[0].humano = true;
  estado.equipos[1].humano = estado.modo !== 'maquina';
  asignarPlantel(estado.equipos[0], estado.codigos[0]);
  asignarPlantel(estado.equipos[1], estado.codigos[1]);
  estado.canchaCambiada = false;
  aplicarGiro();
  estado.balones = [];
  estado.esferas = [];
  estado.particulas = [];
  estado.destellos = [];
  estado.letreros = [];
  estado.ondas = [];
  estado.red = null;
  estado.lenta = 0;
  colaAvisos.length = 0;
  limpiarEfectos();
  estado.marcas = {};
  estado.ultimoEquipo = null;
  estado.jugada = null;
  estado.espera = null;
  estado.historial = [];
  estado.repeticion = null;
  el.repeticion.hidden = true;
  el.pantallaJuego.classList.remove('juego--repeticion');
  ocultarConsejo();
  ultimoConsejo = -99;
  estado.racha = 0;
  estado.mejorRacha = 0;
  estado.recordRachaNuevo = false;
  estado.duracion = estado.modo === 'online' ? JUEGO.duracionOnline : JUEGO.duracion;
  estado.tiempo = estado.duracion;
  estado.muerteSubita = false;
  estado.medioTiempo = false;
  estado.estadisticas = { posesion: [0, 0], tiros: [0, 0], faltas: [0, 0], amarillas: [0, 0], rojas: [0, 0] };
  estado.ultimoSegundo = null;
  estado.reloj = 0;
  estado.relojEsfera = azar(...JUEGO.entreEsferas);
  estado.relojOla = azar(10, 18);
  estado.ola = null;
  estado.celebracion = null;
  estado.pausado = false;
  soltarControles();
  ocultarPalcos();
  actualizarMarcador();
  actualizarReloj();
  actualizarFichas();
  estado.saqueInicial = Math.random() < 0.5 ? 0 : 1;
  prepararSaque(estado.saqueInicial);
  if (vista.listo) centrarCamara(LARGO / 2, MITAD, true);
  mostrarCartel('¡Comienza!', 'inicio');
}

// A los 2:00 se acaba el primer tiempo: silbato, cartel, los equipos cambian
// de cancha y saca el equipo que no sacó al principio. Todos recuperan un poco
// de energía. El reloj sigue desde 2:00 (como en la TV).
function empezarSegundoTiempo() {
  estado.medioTiempo = true;
  limpiarEfectos();
  estado.esferas = [];
  ocultarConsejo();
  for (const equipo of estado.equipos) {
    for (const p of equipo.plantel) p.energia = Math.min(1, p.energia + CANSANCIO.medioTiempo);
  }
  const saca = 1 - estado.saqueInicial;
  Sonido.silbato(2);
  Sonido.aplausos(1.4);
  estado.canchaCambiada = true;
  aplicarGiro();
  eco('cancha', 1);
  mostrarCartel('Medio tiempo', 'medio', `Cambio de cancha · Saca ${estado.nombres[saca]}`);
  anunciar(`Medio tiempo. ${estado.nombres[0]} ${estado.goles[0]}, ${estado.nombres[1]} ${estado.goles[1]}. ` +
    `Los equipos cambian de cancha. En el segundo tiempo saca ${estado.nombres[saca]}.`);
  prepararSaque(saca);
  estado.relojFase = JUEGO.segundosSaque - JUEGO.segundosMedioTiempo; // la pausa dura un poco más
}

// Cancha dada vuelta: en el segundo tiempo los equipos cambian de lado, y en
// online el visitante ve la cancha desde la otra tribuna. Así cada quien
// empieza atacando hacia la derecha y después del medio tiempo, hacia la izquierda.
function aplicarGiro() {
  const giro = (estado.miLado === 1) !== estado.canchaCambiada;
  if (vista.giro === giro) return;
  vista.giro = giro;
  if (vista.listo) {
    pintarFondo();
    const balon = balonPrincipal();
    centrarCamara(balon ? balon.x : LARGO / 2, balon ? balon.y : MITAD, true);
  }
  if (estado.pantalla === 'juego') describirCancha();
}

function limpiarEfectos() {
  estado.efectos = { mini: 0, turbo: 0, zigzag: 0, multi: 0, gigante: 0, hielo: 0 };
  estado.duenos = { mini: 0, turbo: 0, zigzag: 0, multi: 0, gigante: 0, hielo: 0 };
  estado.escudo = [0, 0];
  estado.escala = [1, 1];
}

// Todos a su lugar; el equipo que saca tiene el balón en el centro
function prepararSaque(equipoSaca) {
  estado.fase = 'saque';
  estado.relojFase = 0;
  estado.sacaEquipo = equipoSaca;
  estado.ultimoEquipo = null;
  estado.jugada = null;
  estado.espera = null;
  estado.historial = [];
  for (const equipo of estado.equipos) {
    const sentido = sentidoDe(equipo.numero);
    for (const j of equipo.jugadores) {
      if (j.fuera) continue; // los expulsados se quedan afuera
      j.x = j.baseX;
      j.y = j.baseY;
      if (j.rol === 'delantero') j.x = LARGO / 2 - sentido * (equipo.numero === equipoSaca ? 60 : 95);
      j.vx = 0;
      j.vy = 0;
      j.mira = equipo.numero === 0 ? 0 : Math.PI;
      j.miraVista = j.mira;
      j.patada = 0;
      j.lanza = 0;
      j.estirada = 0;
      j.barrida = 0;
      j.aturdido = 0;
      j.distraido = 0;
      j.sostener = 0;
    }
  }
  // Saca un delantero (si los expulsaron a los dos, otro de campo)
  const deCampo = deEquipo(equipoSaca).filter((j) => j.rol !== 'portero');
  const sacador = deCampo.find((j) => j.rol === 'delantero') || deCampo[0] || estado.equipos[equipoSaca].jugadores[0];
  const sentido = sentidoDe(equipoSaca);
  sacador.x = LARGO / 2 - sentido * (JUEGO.radioJugador + JUEGO.radioBalon + 1.5);
  sacador.y = MITAD;
  const balon = crearBalon(LARGO / 2, MITAD);
  estado.balones = [balon];
  balon.dueno = sacador;
  balon.protegido = JUEGO.segundosSaque + 0.4;
  estado.ancla = { x: balon.x, y: balon.y, tiempo: 0 };
  alDetenerseElJuego();
}

// ---- Cambios de jugadores ----
function nombrePersona(p) {
  return p.nombre || `el ${p.dorsal}`;
}

function enBanco(equipo) {
  return equipo.plantel.filter((p) => p.puesto === -1 && !p.salio && !p.expulsado);
}

function puedeCambiar(equipo, puesto, n) {
  const j = equipo.jugadores[puesto];
  const entra = equipo.plantel[n];
  return Boolean(equipo.cambios > 0 && j && !j.fuera && j.rol !== 'portero' &&
    entra && entra.puesto === -1 && !entra.salio && !entra.expulsado);
}

// Sale quien está en ese puesto y entra la persona n del plantel
function hacerCambio(equipo, puesto, n) {
  if (!puedeCambiar(equipo, puesto, n)) return false;
  const j = equipo.jugadores[puesto];
  const sale = j.persona;
  const entra = equipo.plantel[n];
  sale.puesto = -1;
  sale.salio = true;
  entra.puesto = puesto;
  j.persona = entra;
  j.aturdido = 0;
  j.barrida = 0;
  equipo.cambios--;
  const codigo = estado.kits[equipo.numero].codigo;
  const color = equipo.numero === 0 ? COLOR.local : COLOR.visitante;
  Sonido.cambio();
  letrero('CAMBIO', j.x, j.y, color, 13);
  mostrarAviso(`Cambio en ${codigo}: entra ${nombrePersona(entra)}, sale ${nombrePersona(sale)}`, 'cambio', ICONO_CAMBIO, true);
  anunciar(`Cambio en ${estado.nombres[equipo.numero]}: entra ${nombrePersona(entra)} y sale ${nombrePersona(sale)}. ` +
    `${equipo.cambios === 1 ? 'Le queda 1 cambio' : `Le quedan ${equipo.cambios} cambios`}.`);
  return true;
}

// Cuando el balón se detiene (saque, falta, gol, medio tiempo) se hacen los
// cambios pedidos y Petunia cambia a sus jugadores más cansados
function alDetenerseElJuego() {
  if (esVisitaOnline()) return; // los cambios los hace el aparato que lleva el partido
  for (const equipo of estado.equipos) {
    if (equipo.cambioPendiente) {
      const c = equipo.cambioPendiente;
      equipo.cambioPendiente = null;
      hacerCambio(equipo, c.puesto, c.entra);
    } else if (!equipo.humano) {
      cambiosDeLaMaquina(equipo);
    }
  }
}

function cambiosDeLaMaquina(equipo) {
  if (equipo.cambios <= 0) return;
  const cansado = equipo.jugadores
    .filter((j) => !j.fuera && j.rol !== 'portero' && j.persona.energia < CANSANCIO.cambioMaquina)
    .sort((a, b) => a.persona.energia - b.persona.energia)[0];
  if (!cansado) return;
  const entra = enBanco(equipo).sort((a, b) => b.energia - a.energia)[0];
  if (entra && entra.energia > cansado.persona.energia + 0.3) hacerCambio(equipo, cansado.indice, entra.n);
}

// La persona pide un cambio desde el menú. Contra Petunia el partido está en
// pausa: se hace de una vez. En online se hace en la próxima pausa del juego.
function pedirCambio(puesto, n) {
  const equipo = estado.equipos[estado.miLado];
  if (!puedeCambiar(equipo, puesto, n)) return false;
  if (estado.modo !== 'online') return hacerCambio(equipo, puesto, n);
  equipo.cambioPendiente = { puesto, entra: n };
  if (esVisitaOnline()) enviarAlRival({ t: 'cambio', puesto, entra: n });
  return true;
}

// Si un jugador tuyo está muy cansado, se avisa una vez (si te quedan cambios)
function revisarCansancio() {
  for (const lado of ladosPropios()) {
    const equipo = estado.equipos[lado];
    if (!equipo || !equipo.humano || equipo.cambios <= 0 || equipo.cambioPendiente) continue;
    for (const j of deEquipo(lado)) {
      const p = j.persona;
      if (j.rol === 'portero' || !p || p.energia >= CANSANCIO.cansado || equipo.avisados.has(p.n)) continue;
      equipo.avisados.add(p.n);
      const quien = nombrePersona(p);
      const texto = `${quien.charAt(0).toUpperCase()}${quien.slice(1)} está muy cansado: haz un cambio en Menú`;
      sinEco(() => {
        mostrarAviso(texto, 'alerta', ICONO_CAMBIO);
        anunciar(`${texto}, Cambios.`);
      });
      return;
    }
  }
}

// El balón salió de la cancha: saque de banda, tiro de esquina o saque de meta
function balonAfuera(balon, por, lado = 0) {
  const ultimo = estado.ultimoEquipo !== null ? estado.ultimoEquipo : (balon.equipoPateo !== null ? balon.equipoPateo : 0);
  let jugada;
  if (por === 'banda') {
    jugada = { tipo: 'banda', equipo: 1 - ultimo, x: limitar(balon.x, 30, LARGO - 30), y: balon.y < MITAD ? 0 : ANCHO };
  } else if (ultimo === lado) {
    // La sacó el que defiende ese arco: tiro de esquina para el rival
    jugada = { tipo: 'esquina', equipo: 1 - lado, x: lado === 0 ? 0 : LARGO, y: balon.y < MITAD ? 0 : ANCHO };
  } else {
    // La sacó el que ataca: saque de meta para el portero
    jugada = { tipo: 'meta', equipo: lado, x: lado === 0 ? CANCHA.fondoAreaChica : LARGO - CANCHA.fondoAreaChica, y: MITAD };
  }
  estado.jugada = jugada;
  estado.espera = null;
  estado.fase = 'parada';
  estado.relojFase = 0;
  // El balón se pone de una vez en el lugar del saque (la cámara va hacia allá)
  const radio = radioBalon();
  balon.x = limitar(jugada.x, radio + 2, LARGO - radio - 2);
  balon.y = limitar(jugada.y, radio + 2, ANCHO - radio - 2);
  balon.vx = 0;
  balon.vy = 0;
  balon.vz = 0;
  balon.z = 0;
  balon.receptor = null;
  balon.rastro.length = 0;
  Sonido.silbatoCorto();
  const texto = JUGADAS[jugada.tipo];
  mostrarAviso(`${texto} · ${estado.nombres[jugada.equipo]}`, 'jugada', ICONO_SILBATO);
  anunciar(`${texto} para ${estado.nombres[jugada.equipo]}.`);
  alDetenerseElJuego(); // después del aviso del saque, para que el del cambio salga en cola
}

// Pasada la pausa, el jugador más cercano (o el portero) saca
function reanudarJugada() {
  const jugada = estado.jugada;
  const balon = balonPrincipal();
  estado.jugada = null;
  estado.fase = 'juego';
  estado.relojFase = 0;
  if (!jugada || !balon) return;
  const radio = radioBalon();
  const equipo = estado.equipos[jugada.equipo];

  // Lugar del balón, justo dentro de la cancha
  const bx = limitar(jugada.x, radio + 2, LARGO - radio - 2);
  const by = limitar(jugada.y, radio + 2, ANCHO - radio - 2);
  if (jugada.tipo === 'penal' || jugada.tipo === 'libre') {
    prepararBalonParado(jugada, balon, bx, by);
    return;
  }
  let sacador;
  if (jugada.tipo === 'meta') {
    sacador = equipo.jugadores[0];
  } else {
    sacador = deEquipo(jugada.equipo)
      .filter((j) => j.rol !== 'portero')
      .reduce((a, b) => (Math.hypot(a.x - bx, a.y - by) < Math.hypot(b.x - bx, b.y - by) ? a : b));
  }
  // Mira hacia adentro de la cancha: en la banda, un poquito hacia el arco rival;
  // en la esquina, hacia el área; en el saque de meta, hacia el centro
  const sentido = sentidoDe(jugada.equipo);
  let haciaAdentro;
  if (jugada.tipo === 'banda') {
    haciaAdentro = Math.atan2(jugada.y === 0 ? 1 : -1, sentido * 0.6);
  } else if (jugada.tipo === 'esquina') {
    const arco = arcoRival(jugada.equipo);
    haciaAdentro = Math.atan2(MITAD - by, arco.x - sentido * CANCHA.puntoPenal - bx);
  } else {
    haciaAdentro = Math.atan2(MITAD - by, LARGO / 2 - bx);
  }
  const separacion = radioDe(sacador) + radio + 1.5;
  sacador.x = bx - Math.cos(haciaAdentro) * separacion;
  sacador.y = by - Math.sin(haciaAdentro) * separacion;
  sacador.vx = 0;
  sacador.vy = 0;
  sacador.barrida = 0;
  sacador.mira = haciaAdentro;
  balon.x = bx;
  balon.y = by;
  tomarPosesion(sacador, balon);
  balon.protegido = 1; // el rival no puede quitarlo enseguida
  // En la banda y en la esquina el jugador espera para apuntar y sacar
  // (el saque de meta lo hace el portero a su manera)
  if (jugada.tipo !== 'meta') {
    let nx = 0;
    let ny = jugada.y === 0 ? 1 : -1;
    if (jugada.tipo === 'esquina') {
      const largo = Math.hypot(LARGO / 2 - bx, MITAD - by) || 1;
      nx = (LARGO / 2 - bx) / largo;
      ny = (MITAD - by) / largo;
    }
    estado.espera = { jugador: sacador, tipo: jugada.tipo, tiempo: 0, limite: azar(0.6, 1.1), nx, ny };
    balon.protegido = 99;
  }
  // Los rivales se apartan del balón
  for (const rival of deEquipo(1 - jugada.equipo)) {
    const d = Math.hypot(rival.x - bx, rival.y - by);
    if (d < 70 && d > 0) {
      rival.x = bx + ((rival.x - bx) / d) * 70;
      rival.y = by + ((rival.y - by) / d) * 70;
      limitarJugador(rival);
    }
  }
  estado.ancla = { x: bx, y: by, tiempo: 0 };
}

// Tiro libre o penal. Patea la figura si está cerca (o en el penal), si no,
// el más cercano. En el penal todos salen del área y solo quedan el que
// patea y el portero. La persona apunta con el joystick y patea con Tiro.
function prepararBalonParado(jugada, balon, bx, by) {
  const equipo = estado.equipos[jugada.equipo];
  const deCampo = deEquipo(jugada.equipo).filter((j) => j.rol !== 'portero');
  if (!deCampo.length) return;
  const arco = arcoRival(jugada.equipo);
  const sentido = sentidoDe(jugada.equipo);
  const cerca = Math.hypot(arco.x - bx, arco.y - by) < 340;
  const figura = deCampo.find((j) => esEstrella(j));
  let sacador = deCampo.reduce((a, b) => (Math.hypot(a.x - bx, a.y - by) < Math.hypot(b.x - bx, b.y - by) ? a : b));
  if (figura && (jugada.tipo === 'penal' || cerca)) sacador = figura;

  if (jugada.tipo === 'penal') {
    // Todos fuera del área (en una fila, a lo ancho) y los porteros en su lugar
    const linea = arco.x - sentido * (CANCHA.fondoAreaGrande + 26);
    let fila = 0;
    for (const j of enJuego()) {
      j.vx = 0;
      j.vy = 0;
      j.barrida = 0;
      if (j === sacador) continue;
      if (j.rol === 'portero') {
        const propio = j.equipo === 0 ? 0 : LARGO;
        j.x = propio + (j.equipo === 0 ? 22 : -22);
        j.y = MITAD;
        continue;
      }
      j.x = linea - sentido * ((fila % 2) * 30);
      j.y = MITAD + (fila % 2 === 0 ? -1 : 1) * (40 + Math.floor(fila / 2) * 46);
      fila++;
      limitarJugador(j);
    }
  }

  const haciaArco = Math.atan2(arco.y - by, arco.x - bx);
  const separacion = radioDe(sacador) + radioBalon() + 1.5;
  sacador.x = bx - Math.cos(haciaArco) * separacion;
  sacador.y = by - Math.sin(haciaArco) * separacion;
  sacador.vx = 0;
  sacador.vy = 0;
  sacador.barrida = 0;
  sacador.mira = haciaArco;
  balon.x = bx;
  balon.y = by;
  tomarPosesion(sacador, balon);
  balon.protegido = 99;
  if (equipo.humano && sacador.rol !== 'portero') {
    // La persona maneja al que patea
    for (const j of equipo.jugadores) j.controlado = false;
    equipo.controlado = sacador;
    sacador.controlado = true;
    equipo.bloqueoCambio = 2;
  }
  estado.espera = {
    jugador: sacador, tipo: jugada.tipo, tiempo: 0, limite: azar(0.9, 1.5),
    nx: Math.cos(haciaArco), ny: Math.sin(haciaArco), cerca
  };
  if (jugada.tipo === 'libre') {
    // La barrera: los rivales a 70 del balón
    for (const rival of deEquipo(1 - jugada.equipo)) {
      const d = Math.hypot(rival.x - bx, rival.y - by);
      if (d < 70 && d > 0) {
        rival.x = bx + ((rival.x - bx) / d) * 70;
        rival.y = by + ((rival.y - by) / d) * 70;
        limitarJugador(rival);
      }
    }
  }
  estado.ancla = { x: bx, y: by, tiempo: 0 };
}

function marcarGol(equipo, balon) {
  if (estado.fase !== 'juego') return;
  estado.goles[equipo]++;
  estado.fase = 'gol';
  estado.espera = null;
  estado.relojFase = 0;
  balon.enRed = true;
  balon.dueno = null;

  // Fuera los balones extra, los poderes y los efectos: cada saque empieza limpio
  for (const otro of estado.balones) {
    if (otro !== balon) chispas(otro.x, otro.y, COLOR['poder-multi'], 8, 100, 6);
  }
  estado.balones = [balon];
  estado.esferas = [];
  limpiarEfectos();
  ocultarConsejo();

  // Como en la TV: cámara lenta un momento, la cámara tiembla y la red se mueve
  estado.lenta = 0.7;
  temblar(6, 0.45);
  estado.red = { lado: equipo === 0 ? 1 : 0, y: balon.y, z: Math.min(balon.z, CANCHA.altoArco * 0.8), t: 0 };
  eco('red', estado.red.lado, Math.round(estado.red.y), Math.round(estado.red.z));
  const arcoX = equipo === 0 ? LARGO : 0;
  if (balon.pateador && balon.pateador.equipo === equipo && balon.desdeX !== undefined &&
      Math.hypot(arcoX - balon.desdeX, MITAD - balon.desdeY) > 320) {
    letrero('¡GOLAZO!', arcoX - (equipo === 0 ? 70 : -70), MITAD, equipo === 0 ? COLOR.local : COLOR.visitante, 21);
  }

  const burla = estado.modo === 'maquina' && equipo === 1;
  estado.celebracion = { equipo, tipo: burla ? 'burla' : 'festejo', tiempo: 0, duracion: JUEGO.segundosCelebracion };
  if (burla) estado.racha = 0;

  Sonido.fiesta();
  Sonido.aplausos(1.8);
  if (burla) Sonido.risita();
  serpentinas(equipo);
  actualizarMarcador(equipo);
  mostrarPalco(equipo, burla ? 'burla' : 'festejo');
  const autor = textoDelAutor(balon.pateador, equipo);
  mostrarCartel('¡GOOOL!', equipo === 0 ? 'gol-local' : 'gol-visitante', autor);

  const [n0, n1] = estado.nombres;
  const quien = autor ? ` ${autor}.` : '';
  anunciar(`¡Gol de ${estado.nombres[equipo]}!${quien} ${n0} ${estado.goles[0]}, ${n1} ${estado.goles[1]}.`);
  estado.sacaEquipo = 1 - equipo; // saca el que recibió el gol
}

// "Anota el 9 · COL" o "Autogol del 4 · BRA" según quién tocó el balón de último
function textoDelAutor(jugador, equipoQueAnoto) {
  if (!jugador || !jugador.persona) return '';
  const p = jugador.persona;
  const codigo = estado.kits[jugador.equipo].codigo;
  if (jugador.equipo === equipoQueAnoto) return p.nombre ? `Anota ${p.nombre} (${p.dorsal}) · ${codigo}` : `Anota el ${p.dorsal} · ${codigo}`;
  return p.nombre ? `Autogol de ${p.nombre} · ${codigo}` : `Autogol del ${p.dorsal} · ${codigo}`;
}

// Se acabó el tiempo normal o la muerte súbita
function finDelTiempo() {
  const [g0, g1] = estado.goles;
  // En el torneo online tiene que haber un ganador: si la muerte súbita
  // termina empatada, empieza otra
  if (g0 !== g1 || (estado.muerteSubita && !estado.sinEmpate)) {
    terminarPartida();
    return;
  }
  const otraVez = estado.muerteSubita;
  // Empate: muerte súbita de 45 segundos
  estado.muerteSubita = true;
  estado.tiempo = JUEGO.muerteSubita;
  estado.ultimoSegundo = null;
  limpiarEfectos();
  estado.esferas = [];
  Sonido.silbato(2);
  Sonido.suspenso();
  mostrarCartel(otraVez ? '¡Otra muerte súbita!' : 'Muerte súbita', 'muerte');
  anunciar(otraVez
    ? 'Sigue el empate. Otra muerte súbita de 45 segundos: en el torneo tiene que haber ganador.'
    : '¡Empate! Muerte súbita de 45 segundos: el primer gol gana.');
  actualizarReloj();
  prepararSaque(Math.random() < 0.5 ? 0 : 1);
}

function balonTrabado() {
  for (const b of estado.balones) {
    if (Number.isFinite(b.x) && Number.isFinite(b.y)) chispas(b.x, b.y, COLOR.alerta, 10, 120, 6);
  }
  Sonido.trabado();
  mostrarAviso('¡Balón trabado! Sale uno nuevo', 'alerta', ICONO_ALERTA);
  anunciar('El balón se quedó trabado. Sale un balón nuevo desde el centro.');
  prepararSaque(Math.random() < 0.5 ? 0 : 1);
}

// ¿Algún balón quedó en un lugar imposible? (seguro extra para que nada se trabe)
function balonPerdido() {
  return estado.balones.some((b) =>
    !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy) || !Number.isFinite(b.z) ||
    b.x < -80 || b.x > LARGO + 80 || b.y < -60 || b.y > ANCHO + 60
  );
}

// Si el balón principal casi no se mueve durante 9 segundos, está trabado
function revisarTrabado(dt) {
  const balon = balonPrincipal();
  if (!balon) return true;
  const a = estado.ancla;
  if (Math.hypot(balon.x - a.x, balon.y - a.y) > 30) {
    estado.ancla = { x: balon.x, y: balon.y, tiempo: 0 };
    return false;
  }
  a.tiempo += dt;
  return a.tiempo > JUEGO.segundosTrabado;
}

function terminarPartida() {
  estado.fase = 'final';
  const [g0, g1] = estado.goles;
  const [n0, n1] = estado.nombres;
  const empate = g0 === g1;
  const ganador = empate ? null : (g0 > g1 ? 0 : 1);
  const contraMaquina = estado.modo === 'maquina';
  const burla = contraMaquina && ganador === 1;
  if (ganador !== null) estado.celebracion = { equipo: ganador, tipo: burla ? 'burla' : 'festejo', tiempo: 0, duracion: 99 };
  ocultarPalcos();

  // Récords y logros
  const logros = [];
  if (contraMaquina) {
    logros.push({ texto: `Mejor racha de tu equipo en este partido: ${estado.mejorRacha} ${estado.mejorRacha === 1 ? 'toque seguido' : 'toques seguidos'}.` });
    if (estado.recordRachaNuevo) logros.push({ texto: '¡Nuevo récord de racha!', nuevo: true });
    if (g0 > 0 && (!records.goles || g0 > records.goles.valor)) {
      records.goles = { valor: g0, nombre: n0, nivel: estado.nivel };
      logros.push({ texto: '¡Nuevo récord de goles contra Petunia!', nuevo: true });
    }
  }
  mostrarRecords();

  // En online, la otra persona y quien organiza la sala se enteran del resultado
  if (estado.modo === 'online') {
    terminarPartidoOnline(null);
    return;
  }

  // Mini torneo: se anota el resultado (y se juegan los otros partidos de la ronda)
  const enTorneo = Boolean(torneo && !torneo.terminado);
  const avance = enTorneo ? anotarEnTorneo(ganador === 0) : '';

  // Textos de la ventana final
  if (empate) {
    el.tituloFinal.textContent = '¡Empate!';
    el.textoFinal.textContent = 'Ni en la muerte súbita hubo gol. ¿Otro partido para desempatar?';
  } else if (burla) {
    el.tituloFinal.textContent = '¡Petunia gana!';
    el.textoFinal.textContent = enTorneo
      ? `Petunia te eliminó del torneo, ${n0}. ${avance}`
      : `Petunia se ríe de ti, ${n0}. ¿Le pides la revancha?`;
  } else {
    el.tituloFinal.textContent = `¡Ganaste, ${n0}!`;
    el.textoFinal.textContent = enTorneo ? avance : 'Le ganaste a Petunia. ¿Otro partido?';
  }
  el.marcadorFinal.textContent = `${n0} (${estado.kits[0].codigo}) ${g0} – ${g1} (${estado.kits[1].codigo}) ${n1}`;
  mostrarLogros(logros);
  mostrarEstadisticas([0, 1]);
  el.imgFestejo.hidden = burla || empate;
  el.imgBurla.hidden = !burla;
  el.figuraFinal.hidden = empate;
  el.figuraFinal.parentElement.classList.toggle('final--sin-imagen', empate);
  el.dialogoFinal.classList.toggle('dialogo--burla', burla);
  mostrarMedalla(el.medallaFinal, el.textoMedallaFinal, enTorneo && torneo.terminado ? torneo.medalla : null);
  el.botonRevancha.hidden = enTorneo;
  el.botonOtroRival.hidden = enTorneo;
  el.botonInicioFinal.textContent = enTorneo ? 'Ver el torneo' : 'Volver al inicio';

  // Sonidos: carcajada si gana Petunia, fiesta si gana una persona
  Sonido.silbato(3);
  if (burla) {
    Sonido.carcajada();
  } else if (!empate) {
    Sonido.fiesta();
    Sonido.aplausos(2.6);
  }

  anunciar(`${el.tituloFinal.textContent} Resultado final: ${n0} ${g0}, ${n1} ${g1}.`);
  cerrarPartido();
  abrirDialogo(el.dialogoFinal);
}

// El partido ya terminó: se suelta la pantalla y se detiene el bucle
function cerrarPartido() {
  soltarPantalla();
  dibujar();
  detenerBucle();
}

function mostrarLogros(logros) {
  el.logrosFinal.replaceChildren(...logros.map((logro) => {
    const item = document.createElement('li');
    item.textContent = logro.texto;
    if (logro.nuevo) item.className = 'final__logro--nuevo';
    return item;
  }));
}

// Tabla de la pantalla final: posesión, tiros, faltas y tarjetas de cada equipo.
// "orden" dice qué equipo va a la izquierda (en online, el tuyo).
function mostrarEstadisticas(orden) {
  const { posesion, tiros } = estado.estadisticas;
  const faltas = estado.estadisticas.faltas || [0, 0];
  const amarillas = estado.estadisticas.amarillas || [0, 0];
  const rojas = estado.estadisticas.rojas || [0, 0];
  const porcentaje = porcentajesPosesion(posesion);
  const tarjetas = (a, r) => {
    if (!a && !r) return 'Ninguna';
    const partes = [];
    if (a) partes.push(`${a} ${a === 1 ? 'amarilla' : 'amarillas'}`);
    if (r) partes.push(`${r} ${r === 1 ? 'roja' : 'rojas'}`);
    return partes.join(' · ');
  };
  orden.forEach((equipo, columna) => {
    el.tablaNombres[columna].textContent = `${estado.nombres[equipo]} (${estado.kits[equipo].codigo})`;
    el.tablaPosesion[columna].textContent = `${porcentaje[equipo]} %`;
    el.tablaTiros[columna].textContent = String(tiros[equipo]);
    el.tablaFaltas[columna].textContent = String(faltas[equipo]);
    el.tablaTarjetas[columna].textContent = tarjetas(amarillas[equipo], rojas[equipo]);
  });
}

// Un paso de la simulación (dt = segundos desde el cuadro anterior)
function actualizar(dt) {
  estado.reloj += dt;
  estado.relojFase += dt;

  actualizarAficion(dt);
  actualizarParticulas(dt);
  if (estado.fase !== 'repeticion') actualizarJugadores(dt);
  animarJugadores(dt);
  actualizarLetreros(dt);

  if (estado.celebracion && estado.fase !== 'final') {
    estado.celebracion.tiempo += dt;
    if (estado.celebracion.tiempo > estado.celebracion.duracion) estado.celebracion = null;
  }

  switch (estado.fase) {
    case 'saque':
      for (const balon of estado.balones) moverBalon(balon, dt);
      if (estado.relojFase >= JUEGO.segundosSaque) {
        estado.fase = 'juego';
        estado.relojFase = 0;
        Sonido.silbato(1);
      }
      break;

    case 'juego': {
      actualizarEfectos(dt);
      programarEsferas(dt);
      // Copia de la lista: un gol o una salida pueden cambiarla en medio del recorrido
      for (const balon of estado.balones.slice()) {
        moverBalon(balon, dt);
        if (estado.fase !== 'juego') break;
      }
      if (estado.fase !== 'juego') break;
      if (balonPerdido() || revisarTrabado(dt)) {
        balonTrabado();
        break;
      }
      grabarCuadro();
      revisarConsejos();
      revisarCansancio();
      contarPosesion(dt);
      // Reloj del partido
      estado.tiempo = Math.max(0, estado.tiempo - dt);
      actualizarReloj();
      if (estado.tiempo <= 0) finDelTiempo();
      else if (!estado.muerteSubita && !estado.medioTiempo && estado.tiempo <= estado.duracion / 2) empezarSegundoTiempo();
      break;
    }

    case 'parada':
      // Balón muerto un momento (todos los balones quietos) y luego se saca
      if (estado.relojFase >= ((estado.jugada && estado.jugada.pausa) || JUEGO.segundosParada)) reanudarJugada();
      break;

    case 'gol':
      for (const balon of estado.balones) moverBalon(balon, dt);
      if (estado.relojFase >= JUEGO.segundosCelebracion) {
        // Como en la TV: la repetición del gol (si hay suficientes cuadros grabados)
        if (!menosMovimiento && estado.historial.length > 40) empezarRepeticion();
        else despuesDelGol();
      }
      break;

    case 'repeticion': {
      // Se ve el gol otra vez, más despacio (55 % de la velocidad)
      const cuadros = estado.repeticion;
      const indice = Math.floor(estado.relojFase * 60 * 0.55);
      if (!cuadros || indice >= cuadros.length) terminarRepeticion();
      else aplicarCuadro(cuadros[indice]);
      break;
    }

    default:
      break;
  }

  actualizarFichas();
}


// Posesión: cuenta para el equipo que lleva el balón; si va suelto (un pase, un
// tiro), para el que lo tocó de último
function contarPosesion(dt) {
  const balon = balonPrincipal();
  const equipo = balon && balon.dueno ? balon.dueno.equipo : estado.ultimoEquipo;
  if (equipo === 0 || equipo === 1) estado.estadisticas.posesion[equipo] += dt;
}

// Porcentaje de posesión de cada equipo (suman 100)
function porcentajesPosesion(posesion) {
  const total = posesion[0] + posesion[1];
  if (total <= 0) return [50, 50];
  const p0 = Math.round((posesion[0] / total) * 100);
  return [p0, 100 - p0];
}

// Después del gol (y de la repetición): sigue el partido o se termina
function despuesDelGol() {
  const [g0, g1] = estado.goles;
  // El partido solo se acaba con el tiempo (o con el gol de la muerte súbita)
  if (estado.muerteSubita) terminarPartida();
  else prepararSaque(estado.sacaEquipo);
}

// ---- Repetición del gol ----
// Durante el juego se guardan los últimos 2.5 segundos: dónde está cada
// jugador y el balón. Después del gol se vuelven a mostrar en cámara lenta.
const CUADROS_REPETICION = 150;
const DATOS_JUGADOR = 10;

function grabarCuadro() {
  const jugadores = todosLosJugadores();
  const b = balonPrincipal();
  if (!b) return;
  const cuadro = new Float32Array(jugadores.length * DATOS_JUGADOR + 8);
  jugadores.forEach((j, i) => {
    cuadro.set([j.x, j.y, j.vx, j.vy, j.mira, j.paso, j.barrida > 0 ? 1 : 0, j.patada, j.estirada * j.ladoEstirada, j.lanza], i * DATOS_JUGADOR);
  });
  const dueno = b.dueno ? b.dueno.equipo * EN_CANCHA + b.dueno.indice : -1;
  cuadro.set([b.x, b.y, b.z, b.vx, b.vy, b.giro, dueno, b.dueno && b.dueno.sostener > 0 ? 1 : 0], jugadores.length * DATOS_JUGADOR);
  estado.historial.push(cuadro);
  if (estado.historial.length > CUADROS_REPETICION) estado.historial.shift();
}

function aplicarCuadro(cuadro) {
  const jugadores = todosLosJugadores();
  jugadores.forEach((j, i) => {
    const k = i * DATOS_JUGADOR;
    j.x = cuadro[k];
    j.y = cuadro[k + 1];
    j.vx = cuadro[k + 2];
    j.vy = cuadro[k + 3];
    j.mira = cuadro[k + 4];
    j.paso = cuadro[k + 5];
    j.barrida = cuadro[k + 6] ? 0.1 : 0;
    j.patada = cuadro[k + 7];
    j.estirada = Math.abs(cuadro[k + 8]);
    j.ladoEstirada = cuadro[k + 8] < 0 ? -1 : 1;
    j.lanza = cuadro[k + 9];
  });
  const b = balonPrincipal();
  if (!b) return;
  const k = jugadores.length * DATOS_JUGADOR;
  b.x = cuadro[k];
  b.y = cuadro[k + 1];
  b.z = cuadro[k + 2];
  b.vx = cuadro[k + 3];
  b.vy = cuadro[k + 4];
  b.giro = cuadro[k + 5];
  const dueno = cuadro[k + 6];
  b.dueno = dueno >= 0 ? estado.equipos[Math.floor(dueno / EN_CANCHA)].jugadores[dueno % EN_CANCHA] : null;
  if (b.dueno) b.dueno.sostener = cuadro[k + 7] ? 0.5 : 0;
  b.enRed = false;
  b.rastro.length = 0;
}

function empezarRepeticion() {
  estado.repeticion = estado.historial.slice();
  estado.historial = [];
  estado.fase = 'repeticion';
  estado.relojFase = 0;
  estado.espera = null;
  estado.balones = [balonPrincipal()];
  mostrarRepeticion(true);
  anunciar('Repetición del gol.');
}

// Letrero "Repetición" y botones escondidos, como en la tele
function mostrarRepeticion(activa) {
  if (activa) {
    el.repeticionSaltar.textContent = mandoTactil ? '· toca para saltar' : '· pulsa una tecla para saltar';
    el.repeticion.setAttribute('aria-hidden', 'true');
    el.repeticion.hidden = false;
    el.pantallaJuego.classList.add('juego--repeticion'); // se esconden los botones
    el.cartel.hidden = true;
  } else {
    el.repeticion.hidden = true;
    el.pantallaJuego.classList.remove('juego--repeticion');
  }
}

function terminarRepeticion() {
  estado.repeticion = null;
  mostrarRepeticion(false);
  despuesDelGol();
}

// Cualquier tecla o toque salta la repetición (en online, el visitante se lo
// pide al aparato que lleva el partido)
function saltarRepeticion() {
  if (estado.fase !== 'repeticion') return;
  if (esVisitaOnline()) enviarAlRival({ t: 'saltar' });
  else terminarRepeticion();
}


/* =====================================================================
   15. DIBUJO DE CADA CUADRO
   1) Se copia el pedazo de estadio que ve la cámara.
   2) Encima del piso: afición, sombras y anillo del jugador que manejas.
   3) Todo lo que tiene altura (jugadores, arcos, banderines, balón,
      esferas de poder) se ordena por profundidad: lo de más atrás se dibuja
      primero, así lo de adelante lo tapa (como en la vida real).
   4) Lo que va encima de todo: partículas, burbujas y joysticks.
   ===================================================================== */
function dibujar() {
  if (!vista.listo) return;
  const t = estado.reloj;

  copiarFondo();

  // Cosas planas sobre el piso, con la transformación de suelo
  transformSuelo(ctx, vista.oU, vista.oV);
  dibujarAficion(t);
  dibujarEscudos(t);
  for (const j of enJuego()) dibujarSombraJugador(j);
  for (const b of estado.balones) dibujarSombraBalon(b);
  const enRepeticion = estado.fase === 'repeticion';
  if (!enRepeticion) {
    for (const j of enJuego()) if (j.controlado) dibujarAnillo(j, t);
    dibujarCaida(t);
    dibujarFlechaSaque(t);
    dibujarMira();
  }
  dibujarOndas();

  // Cosas de pie, ordenadas por profundidad
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const lista = [];
  const agregar = (x, y, pintar) => lista.push({ clave: proyectar(x, y).py, pintar });
  for (const j of enJuego()) agregar(j.x, j.y, () => dibujarJugador(j, t));
  for (const b of estado.balones) {
    const p = posicionVisualBalon(b);
    agregar(p.x, p.y + 0.5, () => dibujarBalon(b, t));
  }
  for (const e of estado.esferas) agregar(e.x, e.y, () => dibujarEsfera(e, t));
  for (const lado of [0, 1]) agregar(lado === 0 ? 0 : LARGO, MITAD, () => dibujarArco(lado));
  for (const [x, y] of [[0, 0], [0, ANCHO], [LARGO, 0], [LARGO, ANCHO]]) agregar(x, y, () => dibujarBanderin(x, y, t));
  lista.sort((a, b) => a.clave - b.clave);
  for (const cosa of lista) cosa.pintar();

  // Encima de todo
  dibujarParticulas();
  dibujarBurbujas(t);
  if (!enRepeticion) dibujarLetreros();
  if (enRepeticion) {
    dibujarFranjasCine();
  } else {
    dibujarRadar();
    dibujarJoysticks();
  }
  ctx.globalAlpha = 1;
}

// ---- Radar (mini cancha) como en Dream League Soccer ----
// Muestra a todos los jugadores como puntitos del color de su camiseta,
// el balón en blanco y un recuadro con lo que está viendo la cámara.
function cajaDelRadar() {
  const dpr = vista.dpr;
  const ancho = vista.ancho / dpr;   // tamaño de la pantalla en píxeles CSS
  const alto = vista.alto / dpr;
  let w;
  let h;
  let x;
  let y;
  if (!vista.vertical) {
    w = Math.min(190, ancho * (esTactil ? 0.16 : 0.18));
    h = w * ANCHO / LARGO;
    x = (ancho - w) / 2;
    y = alto - h - 10;
  } else {
    w = Math.min(88, ancho * 0.23);
    h = w * LARGO / ANCHO;
    // Arriba a la derecha, debajo de los avisos
    x = ancho - w - 8;
    y = 52;
  }
  return { x: x * dpr, y: y * dpr, w: w * dpr, h: h * dpr };
}

function dibujarRadar() {
  if (!estado.equipos.length || !estado.kits.length) return;
  const caja = cajaDelRadar();
  const dpr = vista.dpr;
  const tamU = vista.vertical ? ANCHO : LARGO;
  const tamV = vista.vertical ? LARGO : ANCHO;
  const enRadar = (x, y) => {
    const { u, v } = aUV(x, y);
    return { rx: caja.x + (u / tamU) * caja.w, ry: caja.y + (v / tamV) * caja.h };
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Fondo y líneas de la cancha
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = COLOR.noche;
  ctx.fillRect(caja.x - 3 * dpr, caja.y - 3 * dpr, caja.w + 6 * dpr, caja.h + 6 * dpr);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = COLOR.cal;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.strokeRect(caja.x, caja.y, caja.w, caja.h);
  ctx.beginPath();
  const medio1 = enRadar(LARGO / 2, 0);
  const medio2 = enRadar(LARGO / 2, ANCHO);
  ctx.moveTo(medio1.rx, medio1.ry);
  ctx.lineTo(medio2.rx, medio2.ry);
  ctx.stroke();
  // Áreas grandes
  for (const lado of [0, 1]) {
    const x0 = lado === 0 ? 0 : LARGO;
    const x1 = lado === 0 ? CANCHA.fondoAreaGrande : LARGO - CANCHA.fondoAreaGrande;
    const a = enRadar(x0, MITAD - CANCHA.anchoAreaGrande / 2);
    const b = enRadar(x1, MITAD + CANCHA.anchoAreaGrande / 2);
    ctx.strokeRect(Math.min(a.rx, b.rx), Math.min(a.ry, b.ry), Math.abs(b.rx - a.rx), Math.abs(b.ry - a.ry));
  }

  // Recuadro de lo que ve la cámara
  const u0 = limitar(vista.oU, 0, tamU);
  const u1 = limitar(vista.oU + vista.ancho / vista.s, 0, tamU);
  const v0 = limitar(vista.oV, 0, tamV);
  const v1 = limitar(vista.oV + vista.alto / (vista.s * vista.k), 0, tamV);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = COLOR.tinta;
  ctx.strokeRect(caja.x + (u0 / tamU) * caja.w, caja.y + (v0 / tamV) * caja.h,
    ((u1 - u0) / tamU) * caja.w, ((v1 - v0) / tamV) * caja.h);

  // Jugadores: puntito de su camiseta (el portero con el color de arquero)
  ctx.globalAlpha = 1;
  const radio = 2.6 * dpr;
  for (const j of enJuego()) {
    const kit = estado.kits[j.equipo];
    const { rx, ry } = enRadar(j.x, j.y);
    circulo(rx, ry, j.controlado ? radio * 1.35 : radio);
    ctx.fillStyle = j.rol === 'portero' ? kit.arquero : kit.camiseta;
    ctx.fill();
    ctx.lineWidth = j.controlado ? 1.6 * dpr : dpr;
    ctx.strokeStyle = j.controlado ? (j.equipo === 0 ? COLOR.local : COLOR.visitante) : COLOR.noche;
    ctx.stroke();
  }
  // Balón: puntito blanco encima de todo
  for (const b of estado.balones) {
    const { rx, ry } = enRadar(limitar(b.x, 0, LARGO), limitar(b.y, 0, ANCHO));
    circulo(rx, ry, b.extra ? 1.4 * dpr : 2 * dpr);
    ctx.fillStyle = COLOR.balon;
    ctx.fill();
    ctx.lineWidth = dpr;
    ctx.strokeStyle = COLOR.noche;
    ctx.stroke();
  }
}

// Franjas negras arriba y abajo durante la repetición, como en la tele
function dibujarFranjasCine() {
  const alto = Math.round(el.lienzo.height * 0.07);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = COLOR.noche;
  ctx.fillRect(0, 0, el.lienzo.width, alto);
  ctx.fillRect(0, el.lienzo.height - alto, el.lienzo.width, alto);
  ctx.globalAlpha = 1;
}

// Los muñecos se dibujan un poco más grandes que su "círculo" de choque
// para que se vean como los jugadores de pie de los juegos clásicos
const TALLA = 1.2;

function circulo(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, VUELTA);
}

// Dónde se DIBUJA el balón: pegadito al pie de quien lo lleva,
// o en las manos del portero cuando lo tiene agarrado
function posicionVisualBalon(b) {
  const j = b.dueno;
  if (!j) return { x: b.x, y: b.y, z: b.z };
  const escala = estado.escala[j.equipo] * TALLA;
  // Saque de banda: el balón va en las manos, encima de la cabeza
  if (estado.espera && estado.espera.jugador === j && estado.espera.tipo === 'banda') {
    return { x: j.x, y: j.y, z: 36 * escala };
  }
  if (j.rol === 'portero' && j.sostener > 0) {
    return { x: j.x + Math.cos(j.mira) * 5, y: j.y + Math.sin(j.mira) * 5, z: 18 * escala };
  }
  const rapidez = Math.hypot(j.vx, j.vy);
  const toque = menosMovimiento ? 0 : (0.5 - 0.5 * Math.cos(j.paso)) * 4.5 * escala * Math.min(1, rapidez / 150);
  const d = radioBalon() + 5 * escala + toque;
  return { x: j.x + Math.cos(j.mira) * d, y: j.y + Math.sin(j.mira) * d, z: 0 };
}

function elipse(x, y, rx, ry, rotacion = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotacion, 0, VUELTA);
}

// ---- Sombras y anillos (en el piso) ----
function dibujarSombraJugador(j) {
  const r = radioDe(j) * 0.7;
  elipse(j.x + 2, j.y + 2, r, r);
  ctx.fillStyle = COLOR.sombra;
  ctx.fill();
}

function dibujarSombraBalon(b) {
  const p = posicionVisualBalon(b);
  const r = radioBalon() * Math.max(0.5, 1 - p.z / 120);
  elipse(p.x + p.z * 0.15, p.y + p.z * 0.15, r, r);
  ctx.fillStyle = COLOR.sombra;
  ctx.fill();
}

// Anillo del jugador que maneja una persona (como el cursor de los juegos clásicos)
function dibujarAnillo(j, t) {
  const r = radioDe(j) + 5 + (menosMovimiento ? 0 : Math.sin(t * 7) * 1.5);
  ctx.strokeStyle = j.equipo === 0 ? COLOR.local : COLOR.visitante;
  ctx.lineWidth = 2.5;
  circulo(j.x, j.y, r);
  ctx.stroke();
}

// Círculo en el piso donde va a caer un balón que va por el aire (centros y pases largos)
function dibujarCaida(t) {
  const b = balonPrincipal();
  if (!b || b.dueno || b.enRed || b.z < 8) return;
  const p = puntoDeCaida(b);
  const pulso = menosMovimiento ? 0 : Math.sin(t * 10) * 1.5;
  ctx.strokeStyle = b.equipoPateo === 1 ? COLOR.visitante : COLOR.local;
  ctx.lineWidth = 2;
  circulo(p.x, p.y, 10 + pulso);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - 5, p.y - 5);
  ctx.lineTo(p.x + 5, p.y + 5);
  ctx.moveTo(p.x + 5, p.y - 5);
  ctx.lineTo(p.x - 5, p.y + 5);
  ctx.stroke();
}

// Línea de mira: cuando llevas el balón, una línea corta en el piso muestra
// hacia dónde saldría el tiro (si miras al arco va hacia el punto del arco
// adonde apunta; si no, hacia donde miras). Crece mientras cargas el tiro.
// Un circulito marca al compañero que recibiría el pase.
function dibujarMira() {
  if (estado.fase !== 'juego') return;
  const balon = balonPrincipal();
  if (!balon || !balon.dueno) return;
  const j = balon.dueno;
  const equipo = estado.equipos[j.equipo];
  if (!equipo.humano || !j.controlado || (estado.espera && estado.espera.jugador === j)) return;
  if (!ladosPropios().includes(j.equipo)) return; // en online, cada quien ve solo su línea

  const desde = posicionVisualBalon(balon);
  let angulo = j.mira;
  if (miraAlArco(j).mirando) {
    const objetivo = objetivoDeRemate(j, 0.6);
    angulo = Math.atan2(objetivo.y - desde.y, objetivo.x - desde.x);
  }
  const carga = equipo.carga !== null ? Math.min(1, equipo.carga / CARGA_MAXIMA) : 0;
  const largo = 75 + carga * 70;
  const cx = Math.cos(angulo);
  const cy = Math.sin(angulo);
  const x1 = desde.x + cx * (radioBalon() + 4);
  const y1 = desde.y + cy * (radioBalon() + 4);
  const x2 = desde.x + cx * largo;
  const y2 = desde.y + cy * largo;
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = carga > 0.7 ? COLOR.alerta : COLOR.cal;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2 + cx * 9, y2 + cy * 9);
  ctx.lineTo(x2 - cy * 5.5, y2 + cx * 5.5);
  ctx.lineTo(x2 + cy * 5.5, y2 - cx * 5.5);
  ctx.closePath();
  ctx.fill();

  // Compañero que recibiría el pase
  const companero = companeroEnLaMira(j, 0.6) || companeroEnLaMira(j, 1.3);
  if (companero) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = COLOR.cal;
    ctx.lineWidth = 1.6;
    circulo(companero.x, companero.y, radioDe(companero) + 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Flecha en el piso: hacia dónde va a sacar el que espera en la banda o la esquina
function dibujarFlechaSaque(t) {
  const espera = estado.espera;
  if (!espera) return;
  const j = espera.jugador;
  const cx = Math.cos(j.mira);
  const cy = Math.sin(j.mira);
  const desde = radioDe(j) + 10;
  const largo = 64 + (menosMovimiento ? 0 : Math.sin(t * 6) * 6);
  const x1 = j.x + cx * desde;
  const y1 = j.y + cy * desde;
  const x2 = j.x + cx * (desde + largo);
  const y2 = j.y + cy * (desde + largo);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = COLOR.cal;
  ctx.fillStyle = COLOR.cal;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2 + cx * 12, y2 + cy * 12);
  ctx.lineTo(x2 - cy * 8, y2 + cx * 8);
  ctx.lineTo(x2 + cy * 8, y2 - cx * 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function dibujarEscudos(t) {
  for (let lado = 0; lado < 2; lado++) {
    if (estado.escudo[lado] <= 0) continue;
    const x = lado === 0 ? 3 : LARGO - 3;
    ctx.globalAlpha = menosMovimiento ? 0.75 : 0.55 + 0.3 * Math.sin(t * 6);
    ctx.strokeStyle = COLOR['poder-escudo'];
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, MITAD - CANCHA.anchoArco / 2 - 6);
    ctx.lineTo(x, MITAD + CANCHA.anchoArco / 2 + 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Hacia dónde mira alguien en la pantalla (la cancha se gira cuando la pantalla es vertical).
// Devuelve un vector: sx hacia la derecha de la pantalla, sy hacia la cámara (abajo).
function direccionEnPantalla(angulo) {
  const g = vista.giro ? -1 : 1;
  const dx = Math.cos(angulo) * g;
  const dy = Math.sin(angulo) * g;
  return vista.vertical ? { sx: dy, sy: -dx } : { sx: dx, sy: dy };
}

// Mezcla lineal entre dos números
function entre(a, b, t) {
  return a + (b - a) * t;
}

// Cuánto se aplasta en la pantalla lo que va hacia la cámara o se aleja (profundidad)
const PROFUNDIDAD = 0.42;

// ---- Muñeco de pie (los jugadores) ----
// Se dibuja en "unidades": los pies en (0, 0) y la cabeza arriba (y negativa).
// La mirada es continua: entre "de frente", "de lado" y "de espaldas" hay vistas
// de tres cuartos, así al girar el muñeco da la vuelta poco a poco y no salta.
// Al correr: zancada larga, rodillas dobladas, el pie de atrás sube (talón al
// trasero), el cuerpo se inclina hacia adelante, rebota y los brazos van al revés
// de las piernas. También sabe patear, barrerse, lanzarse (portero) y festejar.
function dibujarMuneco(px, py, op) {
  const u = vista.s * (op.escala || 1) * TALLA;
  const { sx, sy } = op.mirada;
  const perfil = Math.min(1, Math.abs(sx) * 1.15);   // 0 = de frente o espaldas, 1 = de lado
  const hacia = sy;                                   // + mira a la cámara, − de espaldas
  const voltear = sx < 0 ? -1 : 1;
  const quieto = menosMovimiento;
  const patada = quieto ? 0 : (op.patada || 0);      // 0..1: avance de la patada
  const barrida = Boolean(op.barrida);
  const festejo = !quieto && op.festeja;
  let corre = quieto ? 0 : (op.corriendo || 0);
  const extra = quieto ? 0 : (op.sprint || 0);
  if (patada > 0 || barrida) corre *= 0.25;
  const fase = op.paso || 0;
  const t = op.tiempo || 0;

  // Rebote al correr, respiración cuando está quieto y saltitos al festejar
  let bote = -Math.abs(Math.sin(fase)) * 2 * corre;
  if (!quieto && corre < 0.1) bote += Math.sin(t * 2.6 + (op.semilla || 0)) * 0.45;
  const salto = festejo ? Math.abs(Math.sin(t * 7.5 + (op.semilla || 0))) * (op.alturaSalto || 8) : 0;
  const cadera = -13 + bote;

  ctx.save();
  ctx.translate(px, py);

  // El portero se lanza: de lado en la pantalla se acuesta en el aire;
  // si se lanza hacia arriba o abajo de la pantalla, salta estirado
  if (op.estirada && !quieto) {
    const e = op.estirada;
    const pose = e.avance < 0.25 ? e.avance / 0.25 : e.avance > 0.75 ? (1 - e.avance) / 0.25 : 1;
    if (Math.abs(e.sx) > 0.5) {
      ctx.translate(e.sx * 5 * u * pose, -7 * u * pose);
      ctx.rotate(Math.sign(e.sx) * 1.25 * pose);
    } else {
      ctx.translate(0, -9 * u * pose);
    }
  }
  if (salto) ctx.translate(0, -salto * u);
  ctx.scale(u * (perfil > 0.05 ? voltear : 1), u);
  if (barrida) {
    // Barrida con los pies por delante: gira desde la cadera y el cuerpo se va hacia atrás
    ctx.translate(0, -4);
    ctx.rotate(-1.15 * Math.max(0.35, perfil));
    ctx.translate(0, 13);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---- Piernas ----
  const zancada = 8.2 * corre + 2.8 * extra;
  const piernas = [];
  for (const k of [0, 1]) {
    const ladoCuerpo = k ? 1 : -1;                  // pierna izquierda o derecha
    const angulo = fase + k * Math.PI;
    let avance = Math.sin(angulo);
    let alzada = Math.max(0, Math.cos(angulo)) * (3.6 + 5 * Math.max(0, -avance)) * corre;
    // Las caderas van a cada lado del cuerpo (perpendicular a la mirada)
    const caderaX = -ladoCuerpo * 2.6 * hacia;
    const fondo = ladoCuerpo * 2.6 * perfil * PROFUNDIDAD;  // una pierna un poco más atrás
    let adelante = avance * zancada + ladoCuerpo * -1.4 * (1 - corre) * perfil;
    const pateadora = ladoCuerpo === 1;

    if (patada > 0 && pateadora) {
      // Toma impulso hacia atrás, golpea adelante y la pierna sigue de largo
      if (patada < 0.3) {
        const q = patada / 0.3;
        adelante = -6 * q;
        alzada = 4.5 * q;
      } else if (patada < 0.55) {
        const q = (patada - 0.3) / 0.25;
        adelante = -6 + 17 * q;
        alzada = 4.5 - 1.5 * q;
      } else {
        const q = (patada - 0.55) / 0.45;
        adelante = 11 * (1 - q);
        alzada = 3 + Math.sin(q * Math.PI) * 4 - 3 * q;
      }
    } else if (patada > 0) {
      adelante = -1;  // la pierna de apoyo queda firme
      alzada = 0;
    }
    if (barrida) {
      adelante = pateadora ? 3 : -2;   // una pierna estirada y la otra recogida
      alzada = pateadora ? 0 : 3;
    }
    if (op.toque !== undefined && pateadora) {
      // Dominadas (vestuario): el pie sube a tocar el balón y vuelve a bajar
      adelante = PIE_DOMINADA.adelante + PIE_DOMINADA.extra * op.toque;
      alzada = PIE_DOMINADA.alzada * op.toque;
    }
    if (festejo && salto > 1) alzada = Math.max(alzada, 1.2 + ladoCuerpo * 0.4);   // en el aire, piernas casi estiradas

    const cad = { x: caderaX, y: cadera + fondo };
    const pie = {
      x: caderaX + adelante * perfil,
      y: fondo + adelante * hacia * PROFUNDIDAD - alzada
    };
    // Rodilla: de lado se dobla como bisagra hacia adelante; de frente sube
    const deLado = rodillaDeLado(cad, pie);
    const subida = Math.max(0, Math.cos(angulo)) * corre;
    const deFrente = { x: (cad.x + pie.x) / 2 + caderaX * 0.12, y: (cad.y + pie.y) / 2 - subida * 3.4 - alzada * 0.15 };
    const rodilla = { x: entre(deFrente.x, deLado.x, perfil), y: entre(deFrente.y, deLado.y, perfil) };
    piernas.push({ cad, rodilla, pie, orden: fondo + adelante * hacia * PROFUNDIDAD, lejos: ladoCuerpo < 0 });
  }
  piernas.sort((a, b) => a.orden - b.orden);
  for (const p of piernas) {
    dibujarPierna(op, p.cad, p.rodilla, p.pie, perfil, p.lejos && perfil > 0.3 ? 1 - 0.15 * perfil : 1);
  }

  // Pantaloneta (sube y baja con la cadera; de lado se ve más angosta)
  const anchoCuerpo = 1 - 0.18 * perfil;
  ctx.fillStyle = op.pantaloneta;
  ctx.fillRect(-5.5 * anchoCuerpo, cadera - 5, 11 * anchoCuerpo, 6);
  // Sombra: la luz viene de la izquierda de la pantalla, el lado derecho queda más oscuro
  const ladoSombra = perfil > 0.05 ? voltear : 1;   // en qué lado del dibujo queda la derecha de la pantalla
  ctx.fillStyle = COLOR['sombra-cuerpo'];
  ctx.fillRect(ladoSombra > 0 ? 5.5 * anchoCuerpo - 2.4 : -5.5 * anchoCuerpo, cadera - 5, 2.4, 6);

  // ---- Torso, brazos y cabeza ----
  ctx.save();
  // De frente se mece de lado a lado al correr; de lado se inclina hacia adelante
  ctx.translate(Math.sin(fase) * 0.6 * corre * (1 - perfil), bote);
  let inclinacion = (0.2 * corre + 0.12 * extra) * perfil;
  if (patada > 0.3 && patada < 0.8) inclinacion -= 0.14 * perfil; // se echa para atrás al pegarle
  ctx.translate(0, -13);
  ctx.rotate(inclinacion);
  ctx.translate(0, 13);

  // Pose de los brazos
  let brazos = 'correr';
  if (op.brazosArriba || festejo || op.estirada) brazos = 'arriba';
  else if (op.abraza) brazos = 'abraza';
  else if (op.toque !== undefined) brazos = 'equilibrio';
  else if (patada > 0 || barrida) brazos = 'abiertos';
  const datosBrazos = [0, 1].map((k) => brazoDelMuneco(k, brazos, fase, corre, perfil, hacia));
  // El brazo de atrás (de lado o de tres cuartos) queda detrás del cuerpo
  for (const b of datosBrazos) if (b.detras) dibujarBrazo(op, b.hombro, b.codo, b.mano, 0.85);

  // Camiseta
  const cara = hacia > 0.45 ? 'frente' : hacia < -0.45 ? 'espalda' : 'lado';
  ctx.save();
  ctx.scale(anchoCuerpo, 1);
  ctx.fillStyle = op.camiseta;
  ctx.strokeStyle = op.borde;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-6, -17);
  ctx.lineTo(-6, -26);
  ctx.quadraticCurveTo(-6, -29, -3, -29);
  ctx.lineTo(3, -29);
  ctx.quadraticCurveTo(6, -29, 6, -26);
  ctx.lineTo(6, -17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (op.detalle) {
    ctx.fillStyle = op.detalle;
    if (op.patron === 'rayas') {
      // Rayas verticales (como Argentina)
      ctx.fillRect(-3.8, -28.4, 2.3, 11.4);
      ctx.fillRect(1.5, -28.4, 2.3, 11.4);
    } else if (op.patron === 'banda') {
      // Banda cruzada de un hombro a la cadera (como Perú)
      ctx.beginPath();
      ctx.moveTo(-6, -25.5);
      ctx.lineTo(-3.2, -29);
      ctx.lineTo(6, -20);
      ctx.lineTo(6, -17);
      ctx.closePath();
      ctx.fill();
    }
    // Filetes de los costados (de lado se ve la costura del medio)
    if (op.acento) {
      ctx.fillStyle = op.acento;
      if (cara === 'lado') ctx.fillRect(-0.6, -26, 1.2, 8.6);
      else {
        ctx.fillRect(-6, -25.5, 1.1, 8.1);
        ctx.fillRect(4.9, -25.5, 1.1, 8.1);
      }
      ctx.fillStyle = op.detalle;
    }
    if (cara === 'frente') {
      // Escudo pequeño en el pecho (al lado del corazón)
      ctx.beginPath();
      ctx.moveTo(1.4, -26);
      ctx.lineTo(3.8, -26);
      ctx.lineTo(3.8, -24.6);
      ctx.quadraticCurveTo(3.8, -23.2, 2.6, -22.7);
      ctx.quadraticCurveTo(1.4, -23.2, 1.4, -24.6);
      ctx.closePath();
      ctx.fill();
    }
    if (cara === 'espalda' && op.numero) {
      // Número en la espalda (si el muñeco está volteado, el número se endereza)
      ctx.save();
      if (perfil > 0.05 && voltear < 0) ctx.scale(-1, 1);
      ctx.fillStyle = op.colorNumero || op.detalle;
      ctx.font = `7px ${FUENTE_TITULO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(op.numero), 0, -22.6);
      ctx.restore();
    } else if (cara !== 'espalda') {
      // Cuello en "V" (de lado se corre hacia adelante)
      const cx = perfil * 2;
      ctx.strokeStyle = op.detalle;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 2.6 * (1 - perfil * 0.5), -28.8);
      ctx.lineTo(cx, -26.8);
      ctx.lineTo(cx + 2.6 * (1 - perfil * 0.5), -28.8);
      ctx.stroke();
    }
  }
  // Sombra del lado derecho de la pantalla (le da volumen a la camiseta)
  ctx.save();
  ctx.scale(ladoSombra, 1);
  ctx.fillStyle = COLOR['sombra-cuerpo'];
  ctx.beginPath();
  ctx.moveTo(2.4, -17.6);
  ctx.lineTo(2.4, -28.5);
  ctx.lineTo(3, -28.5);
  ctx.quadraticCurveTo(5.4, -28.5, 5.4, -26);
  ctx.lineTo(5.4, -17.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // Brazos de adelante (y guantes del portero)
  for (const b of datosBrazos) if (!b.detras) dibujarBrazo(op, b.hombro, b.codo, b.mano, 1);

  dibujarCabeza(op, perfil, hacia);
  ctx.restore(); // fin del torso

  // Bloque de hielo si está congelado
  if (op.congelado) {
    ctx.fillStyle = COLOR['hielo-capa'];
    ctx.strokeStyle = COLOR.cal;
    ctx.lineWidth = 1;
    ctx.fillRect(-10, -44, 20, 45);
    ctx.strokeRect(-10, -44, 20, 45);
  }
  ctx.restore();
}

// Hombro, codo y mano de un brazo según la pose
//   correr: va y viene al revés de la pierna de su lado, con el codo doblado
//   arriba: los dos brazos arriba (saque de banda, festejo, portero lanzándose)
//   abiertos: separados para mantener el equilibrio (patada y barrida)
//   abraza: el portero sostiene el balón contra el pecho
function brazoDelMuneco(k, pose, fase, corre, perfil, hacia) {
  const ladoCuerpo = k ? 1 : -1;
  // Los hombros van a cada lado; en tres cuartos el brazo queda hacia el borde del cuerpo
  const abertura = Math.sign(hacia) * Math.sqrt(Math.abs(hacia));
  const hombro = { x: -ladoCuerpo * 5.6 * abertura * (1 - perfil * 0.25), y: -27 + ladoCuerpo * 1.2 * perfil * PROFUNDIDAD };
  // En vistas de lado o de tres cuartos, el brazo "lejano" va detrás del cuerpo
  const detras = perfil > 0.35 && ladoCuerpo < 0;
  const afuera = hombro.x >= 0 ? 1 : -1;  // hacia qué lado de la pantalla queda ese hombro
  if (pose === 'arriba') {
    // En "V": de frente hacia los lados; de lado, un brazo adelante y otro atrás
    const sx = afuera * (1 - perfil) * 2.6 + perfil * (ladoCuerpo > 0 ? 2.6 : -2);
    return { hombro, codo: { x: hombro.x + sx, y: -33 }, mano: { x: hombro.x + sx * 1.6, y: -39.5 }, detras };
  }
  if (pose === 'equilibrio') {
    // Un poquito separados del cuerpo y hacia abajo (para las dominadas)
    return {
      hombro,
      codo: { x: hombro.x + afuera * 1.6 * (1 - perfil) + (ladoCuerpo > 0 ? -1 : 1.2) * perfil, y: -22.8 },
      mano: { x: hombro.x + afuera * 3.4 * (1 - perfil) + (ladoCuerpo > 0 ? -1.6 : 2.4) * perfil, y: -19.2 },
      detras
    };
  }
  if (pose === 'abiertos') {
    const adelante = ladoCuerpo > 0 ? -1 : 1;
    return {
      hombro,
      codo: { x: hombro.x + afuera * 3 * (1 - perfil) + adelante * 3.5 * perfil, y: -26 },
      mano: { x: hombro.x + afuera * 5.5 * (1 - perfil) + adelante * 6.5 * perfil, y: -24.5 },
      detras
    };
  }
  if (pose === 'abraza') {
    return {
      hombro,
      codo: { x: hombro.x * 0.9 + perfil * 2.5, y: -22.5 },
      mano: { x: hombro.x * 0.35 + perfil * 5, y: -21.5 + hacia * 1.5 },
      detras
    };
  }
  // Correr: el ángulo del brazo va al revés de la pierna de su lado
  const angulo = -Math.sin(fase + k * Math.PI) * corre * 0.95;
  const dobla = 0.15 + 1.35 * corre;
  const codo = {
    x: hombro.x + Math.sin(angulo) * 5 * perfil + afuera * 1.6 * (1 - perfil),
    y: hombro.y + Math.cos(angulo) * 5 + Math.sin(angulo) * 5 * hacia * PROFUNDIDAD
  };
  const mano = {
    x: codo.x + Math.sin(angulo + dobla) * 4.2 * perfil - afuera * 1.8 * corre * (1 - perfil),
    y: codo.y + Math.cos(angulo + dobla) * 4.2 + Math.sin(angulo + dobla) * 4.2 * hacia * PROFUNDIDAD - corre * 1.5 * (1 - perfil)
  };
  return { hombro, codo, mano, detras };
}

// Cabeza con pelo y cara. El pelo tapa todo menos la cara: de frente la cara
// mira hacia abajo, de lado hacia adelante, y al darse la vuelta el pelo la va
// cubriendo hasta taparla (sin recortes, que en el celular son lentos)
function dibujarCabeza(op, perfil, hacia) {
  const cy = -34;
  circulo(0, cy, 6);
  ctx.fillStyle = op.piel;
  ctx.fill();
  const visible = limitar((hacia + 0.75) / 0.75, 0, 1);   // de espaldas: 0
  // La cara es un círculo corrido hacia donde mira; el pelo es la cabeza menos
  // ese círculo (una media luna con la frente redondita). Al darse la vuelta, el
  // círculo de la cara se va saliendo de la cabeza hasta que solo queda pelo.
  const R = 6.1;
  const fi = entre(0.5, 0.3, perfil) * Math.PI;            // hacia dónde queda la cara
  const rc = entre(5, 4.4, perfil);                         // tamaño de la cara
  const d = entre(2.4, 2.8, perfil) + (1 - visible) * 7.5;  // qué tan corrida está
  ctx.fillStyle = COLOR.pelo;
  ctx.beginPath();
  if (d >= R + rc - 0.2) {
    ctx.arc(0, cy, R, 0, VUELTA);
  } else {
    const alfa = Math.acos(limitar((R * R + d * d - rc * rc) / (2 * R * d), -1, 1));
    const beta = Math.acos(limitar((rc * rc + d * d - R * R) / (2 * rc * d), -1, 1));
    const cx = Math.cos(fi) * d;
    const cyCara = cy + Math.sin(fi) * d;
    ctx.arc(0, cy, R, fi + alfa, fi - alfa + VUELTA);
    ctx.arc(cx, cyCara, rc, fi + Math.PI + beta, fi + Math.PI - beta, true);
    ctx.closePath();
  }
  ctx.fill();
  if (visible > 0.6) {
    // Ojos: dos de frente, uno de lado, entre medio se van juntando
    const separacion = 2.2 * limitar(hacia * 1.5, 0, 1) * (1 - perfil * 0.5);
    const ojoX = perfil * 3.2;
    ctx.fillStyle = COLOR.ojos;
    if (separacion < 0.6) {
      circulo(ojoX, cy + 0.5, 0.9);
      ctx.fill();
    } else {
      circulo(ojoX - separacion, cy + 0.5, 0.9);
      ctx.fill();
      circulo(ojoX + separacion, cy + 0.5, 0.9);
      ctx.fill();
    }
  }
}

// Rodilla de una pierna vista de lado: se dobla hacia adelante, según qué tan
// cerca esté el pie de la cadera (como una bisagra)
function rodillaDeLado(cadera, pie) {
  const tramo = 6.6; // largo del muslo y de la canilla
  const dx = pie.x - cadera.x;
  const dy = pie.y - cadera.y;
  const d = Math.hypot(dx, dy) || 1;
  const dobla = d < 2 * tramo ? Math.sqrt(tramo * tramo - (d / 2) * (d / 2)) : 0;
  let nx = -dy / d;
  let ny = dx / d;
  if (nx < 0) { // hacia adelante
    nx = -nx;
    ny = -ny;
  }
  return { x: (cadera.x + pie.x) / 2 + nx * dobla, y: (cadera.y + pie.y) / 2 + ny * dobla };
}

// Pierna: muslo (piel), canilla con media y botín
function dibujarPierna(op, cadera, rodilla, pie, perfil, opaco) {
  ctx.globalAlpha = opaco;
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = op.piel;
  ctx.beginPath();
  ctx.moveTo(cadera.x, cadera.y);
  ctx.lineTo(rodilla.x, rodilla.y);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = op.medias;
  ctx.beginPath();
  ctx.moveTo(rodilla.x, rodilla.y);
  ctx.lineTo(pie.x, pie.y - 1.5);
  ctx.stroke();
  if (op.detalle) {
    // Franja de las medias, como en las medias de fútbol
    const fx = rodilla.x + (pie.x - rodilla.x) * 0.18;
    const fy = rodilla.y + (pie.y - 1.5 - rodilla.y) * 0.18;
    const gx = rodilla.x + (pie.x - rodilla.x) * 0.34;
    const gy = rodilla.y + (pie.y - 1.5 - rodilla.y) * 0.34;
    ctx.strokeStyle = op.detalle;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.lineCap = 'round';
  }
  // Botín: de lado es largo y apunta hacia adelante; de frente es corto
  ctx.fillStyle = op.botines || COLOR.botines;
  elipse(pie.x + 1.2 * perfil, pie.y - 1.2, 2.4 + 0.8 * perfil, 1.8);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Brazo: manga (camiseta) con su puño, antebrazo (piel) y mano o guante
function dibujarBrazo(op, hombro, codo, mano, opaco = 1) {
  ctx.globalAlpha = opaco;
  const puno = { x: hombro.x + (codo.x - hombro.x) * 0.72, y: hombro.y + (codo.y - hombro.y) * 0.72 };
  ctx.lineWidth = 3;
  ctx.strokeStyle = op.camiseta;
  ctx.beginPath();
  ctx.moveTo(hombro.x, hombro.y);
  ctx.lineTo(puno.x, puno.y);
  ctx.stroke();
  ctx.strokeStyle = op.detalle || op.camiseta;
  ctx.beginPath();
  ctx.moveTo(puno.x, puno.y);
  ctx.lineTo(codo.x, codo.y);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = op.piel;
  ctx.beginPath();
  ctx.moveTo(codo.x, codo.y);
  ctx.lineTo(mano.x, mano.y);
  ctx.stroke();
  ctx.fillStyle = op.guantes || op.piel;
  circulo(mano.x, mano.y, op.guantes ? 2.6 : 1.9);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function dibujarJugador(j, t) {
  const { px, py } = proyectar(j.x, j.y);
  const local = j.equipo === 0;
  const portero = j.rol === 'portero';
  const kit = estado.kits[j.equipo];
  const velocidad = Math.hypot(j.vx, j.vy);
  const enManos = portero && j.sostener > 0 && estado.balones.some((b) => b.dueno === j);
  const festeja = Boolean(estado.celebracion && estado.celebracion.equipo === j.equipo &&
    (estado.fase === 'gol' || estado.fase === 'final'));
  let estirada = null;
  if (j.estirada > 0) {
    const lado = direccionEnPantalla(j.ladoEstirada > 0 ? Math.PI / 2 : -Math.PI / 2);
    estirada = { avance: 1 - j.estirada / DURACION_ESTIRADA, sx: lado.sx };
  }
  dibujarMuneco(px, py, {
    escala: estado.escala[j.equipo],
    mirada: direccionEnPantalla(j.miraVista),
    paso: j.paso,
    tiempo: t,
    semilla: j.semilla,
    patada: j.patada > 0 ? 1 - j.patada / DURACION_PATADA : 0,
    estirada,
    festeja,
    abraza: enManos,
    corriendo: Math.min(1, velocidad / 120),
    sprint: limitar((velocidad - 160) / 70, 0, 1),
    camiseta: portero ? kit.arquero : kit.camiseta,
    borde: portero ? kit.arqueroBorde : kit.borde,
    detalle: portero ? kit.arqueroBorde : kit.detalle,
    acento: portero ? kit.arqueroBorde : kit.acento,
    patron: portero ? 'liso' : kit.patron,
    numero: dorsalDe(j),
    colorNumero: portero ? COLOR.cal : kit.numero,
    pantaloneta: portero ? kit.arqueroPantaloneta : kit.pantaloneta,
    medias: portero ? kit.arquero : kit.medias,
    piel: COLOR['piel-' + (j.persona ? j.persona.piel : 1 + ((j.indice + j.equipo * 2) % 3))],
    guantes: portero ? COLOR.guantes : null,
    botines: kit.botines,
    barrida: j.barrida > 0,
    brazosArriba: j.lanza > 0 || Boolean(estado.espera && estado.espera.jugador === j && estado.espera.tipo === 'banda'),
    congelado: equipoCongelado(j.equipo)
  });

  const u = vista.s * estado.escala[j.equipo] * TALLA;
  const p = j.persona;
  const enRepeticion = estado.fase === 'repeticion';
  // Gotitas de sudor: el jugador está muy cansado
  if (p && !portero && p.energia < CANSANCIO.cansado && !enRepeticion) dibujarSudor(px, py - 38 * u, u, t + j.semilla);
  // Estrellita dorada: la figura de la selección (encima de la cabeza)
  if (p && p.estrella && !j.controlado) dibujarEstrellita(px, py - 49 * u, 3.4 * u);

  // Plaquita con el número (o el nombre de la figura) sobre la cabeza del
  // jugador que manejas (como en los juegos de fútbol del celular), con su
  // flechita debajo, la barrita de energía y su tarjeta amarilla si tiene
  if (j.controlado && !enRepeticion) {
    const salto = menosMovimiento ? 0 : Math.sin(t * 6) * 1.2 * u;
    const base = py - 44 * u + salto;
    const texto = p && p.nombre ? p.nombre : String(dorsalDe(j));
    ctx.font = `${Math.round(6.4 * u)}px ${FUENTE_TITULO}`;
    const ancho = Math.max(12 * u, ctx.measureText(texto).width + 5 * u);
    const alto = 8 * u;
    const arriba = base - 3 * u - alto;
    ctx.fillStyle = local ? COLOR.local : COLOR.visitante;
    ctx.strokeStyle = COLOR.noche;
    ctx.lineWidth = Math.max(1, 0.8 * u);
    ctx.beginPath();
    ctx.moveTo(px - ancho / 2, arriba);
    ctx.lineTo(px + ancho / 2, arriba);
    ctx.lineTo(px + ancho / 2, arriba + alto);
    ctx.lineTo(px + 2.5 * u, arriba + alto);
    ctx.lineTo(px, base);
    ctx.lineTo(px - 2.5 * u, arriba + alto);
    ctx.lineTo(px - ancho / 2, arriba + alto);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLOR.noche;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, px, arriba + alto / 2 - 0.2 * u);
    if (p) {
      // Energía: una rayita en el borde de abajo de la plaquita (verde, amarilla o roja)
      const e = p.energia;
      ctx.fillStyle = COLOR.noche;
      ctx.fillRect(px - ancho / 2 + u, arriba + alto - 2.2 * u, ancho - 2 * u, 1.6 * u);
      ctx.fillStyle = e > 0.6 ? COLOR['energia-alta'] : (e > CANSANCIO.cansado ? COLOR['energia-media'] : COLOR['energia-baja']);
      ctx.fillRect(px - ancho / 2 + u, arriba + alto - 2.2 * u, (ancho - 2 * u) * e, 1.6 * u);
      if (p.estrella) dibujarEstrellita(px - ancho / 2 - 3 * u, arriba + alto / 2, 3 * u);
      if (p.amarillas > 0) {
        ctx.fillStyle = COLOR['tarjeta-amarilla'];
        ctx.fillRect(px + ancho / 2 + 1.2 * u, arriba + 0.6 * u, 3.4 * u, 4.8 * u);
        ctx.strokeStyle = COLOR.noche;
        ctx.lineWidth = Math.max(1, 0.5 * u);
        ctx.strokeRect(px + ancho / 2 + 1.2 * u, arriba + 0.6 * u, 3.4 * u, 4.8 * u);
      }
    }

    // Barra de fuerza mientras cargas el tiro (encima de la plaquita)
    const carga = estado.equipos[j.equipo].carga;
    if (carga !== null) {
      const ancho = 28 * u;
      const alto = 4.5 * u;
      const x0 = px - ancho / 2;
      const y0 = arriba - 8 * u;
      ctx.fillStyle = COLOR.noche;
      ctx.fillRect(x0 - u, y0 - u, ancho + 2 * u, alto + 2 * u);
      ctx.fillStyle = carga / CARGA_MAXIMA > 0.7 ? COLOR.alerta : COLOR.local;
      ctx.fillRect(x0, y0, ancho * Math.min(1, carga / CARGA_MAXIMA), alto);
    }
  }
}

// Estrella de 5 puntas (la figura de cada selección)
function dibujarEstrellita(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radio = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * radio, y + Math.sin(a) * radio);
    else ctx.lineTo(x + Math.cos(a) * radio, y + Math.sin(a) * radio);
  }
  ctx.closePath();
  ctx.fillStyle = COLOR.estrella;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.strokeStyle = COLOR.noche;
  ctx.stroke();
}

// Dos gotitas de sudor que caen al lado de la cabeza (jugador muy cansado)
function dibujarSudor(x, y, u, t) {
  ctx.fillStyle = COLOR.sudor;
  for (const lado of [-1, 1]) {
    const fase = menosMovimiento ? 0.3 : ((t * 1.3 + (lado > 0 ? 0.5 : 0)) % 1);
    const gx = x + lado * 6.5 * u;
    const gy = y + fase * 6 * u;
    const r = 1.3 * u;
    ctx.globalAlpha = 1 - fase * 0.7;
    ctx.beginPath();
    ctx.moveTo(gx, gy - r * 2.2);
    ctx.quadraticCurveTo(gx + r * 1.2, gy, gx, gy + r);
    ctx.quadraticCurveTo(gx - r * 1.2, gy, gx, gy - r * 2.2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- Balón (puede ir por el aire: se dibuja más arriba y su sombra queda en el piso) ----
function dibujarBalon(b, t) {
  const r = radioBalon() * vista.s;

  // Estela del balón rápido
  if (b.rastro.length) {
    ctx.fillStyle = turboDe(b.equipoPateo) ? COLOR['poder-turbo'] : COLOR.cal;
    b.rastro.forEach((punto, i) => {
      const { px, py } = proyectar(punto.x, punto.y, punto.z + radioBalon());
      ctx.globalAlpha = 0.06 + (i / b.rastro.length) * 0.3;
      circulo(px, py, r * (0.4 + (i / b.rastro.length) * 0.6));
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  const visual = posicionVisualBalon(b);
  const { px, py } = proyectar(visual.x, visual.y, visual.z + radioBalon());

  // Pulso del saque
  if (estado.fase === 'saque' && !b.extra) {
    const pulso = menosMovimiento ? 0.5 : (Math.sin(t * 10) + 1) / 2;
    elipse(px, py + r, r + (6 + pulso * 6) * vista.s, (r + (6 + pulso * 6) * vista.s) * vista.k);
    ctx.strokeStyle = COLOR.cal;
    ctx.globalAlpha = 0.35 + pulso * 0.4;
    ctx.lineWidth = 2 * vista.s;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Balón blanco con parches que giran, con luz y sombra (copiado de la tira ya dibujada)
  const hoja = hojaBalon(r);
  const periodo = VUELTA / 5;
  const cuadro = Math.floor((((b.giro % periodo) + periodo) % periodo) / periodo * CUADROS_BALON) % CUADROS_BALON;
  ctx.drawImage(hoja.lienzo, cuadro * hoja.lado, 0, hoja.lado, hoja.lado,
    px - hoja.lado / 2, py - hoja.lado / 2, hoja.lado, hoja.lado);

  // Anillo de color: balón extra o con zigzag
  const conZigzag = estado.efectos.zigzag > 0 && b.equipoPateo === estado.duenos.zigzag && !b.dueno;
  if (b.extra || conZigzag) {
    circulo(px, py, r + 3 * vista.s);
    ctx.strokeStyle = b.extra ? COLOR['poder-multi'] : COLOR['poder-zigzag'];
    ctx.lineWidth = 2 * vista.s;
    ctx.stroke();
  }
}

// ---- Arco en 3D: palos, travesaño y red ----
function dibujarArco(lado) {
  const x0 = lado === 0 ? 0 : LARGO;
  const afuera = lado === 0 ? -1 : 1;
  const xFondo = x0 + afuera * CANCHA.fondoArco;
  const y1 = MITAD - CANCHA.anchoArco / 2;
  const y2 = MITAD + CANCHA.anchoArco / 2;
  const h = CANCHA.altoArco;
  const P = (x, y, z) => proyectar(x, y, z);
  // Cuando entra el gol, el fondo de la red se infla donde pegó el balón y vibra
  const golpe = estado.red && estado.red.lado === lado && !menosMovimiento ? estado.red : null;
  const bolsa = (y, z) => {
    if (!golpe) return 0;
    const fuerza = 14 * (1 - golpe.t / 1.4) * (0.55 + 0.45 * Math.cos(golpe.t * 13));
    const dy = (y - golpe.y) / 42;
    const dz = (z - golpe.z) / 30;
    return fuerza * Math.exp(-dy * dy - dz * dz);
  };
  const F = (y, z) => P(xFondo + afuera * bolsa(y, z), y, z);  // punto del fondo de la red
  const camino = (puntos) => {
    ctx.beginPath();
    puntos.forEach((q, i) => (i === 0 ? ctx.moveTo(q.px, q.py) : ctx.lineTo(q.px, q.py)));
  };

  // Red: techo, fondo y costados (semitransparente)
  const frenteA = P(x0, y1, h);
  const frenteB = P(x0, y2, h);
  const atrasArribaA = P(xFondo, y1, h * 0.7);
  const atrasArribaB = P(xFondo, y2, h * 0.7);
  const atrasAbajoA = P(xFondo, y1, 0);
  const atrasAbajoB = P(xFondo, y2, 0);
  const pieA = P(x0, y1, 0);
  const pieB = P(x0, y2, 0);
  ctx.fillStyle = COLOR['red-capa'];
  for (const cara of [
    [frenteA, frenteB, atrasArribaB, atrasArribaA],
    [atrasArribaA, atrasArribaB, atrasAbajoB, atrasAbajoA],
    [pieA, frenteA, atrasArribaA, atrasAbajoA],
    [pieB, frenteB, atrasArribaB, atrasAbajoB]
  ]) {
    camino(cara);
    ctx.closePath();
    ctx.fill();
  }
  // Cuadritos de la red
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = Math.max(0.6, 0.5 * vista.s);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const y = y1 + (CANCHA.anchoArco * i) / 10;
    const a = P(x0, y, h);
    ctx.moveTo(a.px, a.py);
    for (const z of golpe ? [h * 0.7, h * 0.47, h * 0.23, 0] : [h * 0.7, 0]) {
      const q = F(y, z);
      ctx.lineTo(q.px, q.py);
    }
  }
  for (let i = 1; i <= 4; i++) {
    const z = (h * 0.7 * i) / 5;
    const pasos = golpe ? 10 : 1;
    for (let k = 0; k <= pasos; k++) {
      const q = F(y1 + ((y2 - y1) * k) / pasos, z);
      if (k === 0) ctx.moveTo(q.px, q.py);
      else ctx.lineTo(q.px, q.py);
    }
  }
  ctx.stroke();

  // Palos y travesaño (blancos con borde oscuro)
  const palos = [[pieA, frenteA], [pieB, frenteB], [frenteA, frenteB]];
  for (const [ancho, color] of [[4.2, COLOR['poste-borde']], [2.8, COLOR.cal]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = ancho * vista.s;
    ctx.lineCap = 'round';
    for (const [a, b] of palos) {
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    }
  }
}

// ---- Banderín de esquina ----
function dibujarBanderin(x, y, t) {
  const pie = proyectar(x, y, 0);
  const punta = proyectar(x, y, 24);
  ctx.strokeStyle = COLOR.cal;
  ctx.lineWidth = 1.4 * vista.s;
  ctx.beginPath();
  ctx.moveTo(pie.px, pie.py);
  ctx.lineTo(punta.px, punta.py);
  ctx.stroke();
  const ondea = menosMovimiento ? 0 : Math.sin(t * 5 + x) * 1.5;
  ctx.fillStyle = estado.kits[x === 0 ? 0 : 1].camiseta;
  ctx.beginPath();
  ctx.moveTo(punta.px, punta.py);
  ctx.lineTo(punta.px + (9 + ondea) * vista.s, punta.py + 3 * vista.s);
  ctx.lineTo(punta.px, punta.py + 6 * vista.s);
  ctx.closePath();
  ctx.fill();
}

// ---- Esfera de poder flotando (con su sombra en el piso) ----
function dibujarEsfera(esfera, t) {
  const poder = PODERES[esfera.tipo];
  const flota = menosMovimiento ? 0 : Math.sin(t * 3 + esfera.x) * 3;
  const s = vista.s;
  const piso = proyectar(esfera.x, esfera.y, 0);
  const { px, py } = proyectar(esfera.x, esfera.y, 22 + flota);
  const radio = 13 * s * esfera.aparicion;
  const parpadeo = esfera.vida < 2 && !menosMovimiento && Math.sin(t * 18) < 0 ? 0.35 : 1;

  ctx.globalAlpha = 0.25 * parpadeo;
  ctx.fillStyle = COLOR.sombra;
  elipse(piso.px, piso.py, radio, radio * vista.k * 0.6);
  ctx.fill();
  ctx.globalAlpha = 0.28 * parpadeo;
  ctx.fillStyle = COLOR[poder.color];
  circulo(px, py, radio * 1.5);
  ctx.fill();
  ctx.globalAlpha = parpadeo;
  circulo(px, py, radio);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * s);
  ctx.strokeStyle = COLOR.noche;
  ctx.stroke();

  const k = (radio * 1.2) / 24;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, px - 12 * k, py - 12 * k);
  ctx.fillStyle = COLOR.noche;
  ctx.strokeStyle = COLOR.noche;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (poder.icono.relleno) ctx.fill(rutaIcono(poder.icono));
  else ctx.stroke(rutaIcono(poder.icono));
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---- Burbuja de "¿?" cuando un jugador de la máquina se distrae ----
function dibujarBurbujas(t) {
  if (estado.fase !== 'juego') return;
  const s = vista.s;
  for (const j of enJuego()) {
    const dudando = j.distraido > 0 || (j.rol === 'portero' && j.cerebro.dudando);
    if (!dudando) continue;
    const { px, py } = proyectar(j.x, j.y, 50 * TALLA * estado.escala[j.equipo]);
    const r = Math.max(8, 8 * s);
    const sube = menosMovimiento ? 0 : Math.sin(t * 6) * 2 * s;
    const bx = px + r * 1.2;
    const by = py + sube;
    ctx.fillStyle = COLOR.cal;
    circulo(bx, by, r);
    ctx.fill();
    circulo(bx - r * 0.9, by + r * 1.1, r * 0.28);
    ctx.fill();
    ctx.fillStyle = COLOR.noche;
    ctx.font = `${Math.round(r * 1.25)}px ${FUENTE_TITULO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', bx, by + r * 0.05);
  }
}

// ---- Joystick (como en los juegos de fútbol del celular) ----
// En celular siempre se ve abajo a la izquierda. Si pones el dedo en otra
// parte de tu lado de la pantalla, el joystick aparece justo ahí.
const RADIO_JOYSTICK = 54; // en píxeles CSS

// Lugar de descanso del joystick de cada jugador (en píxeles CSS del canvas)
// Tu joystick va abajo a la izquierda
function baseDeJoystick() {
  const alto = vista.alto / vista.dpr;
  const margen = RADIO_JOYSTICK + 22;
  return { x: margen, y: alto - margen };
}

function dibujarJoysticks() {
  if (!mandoTactil) return;
  const dpr = vista.dpr;
  for (const lado of ladosPropios()) {
    if (!estado.equipos[lado] || !estado.equipos[lado].humano) continue;
    const palanca = palancas[lado];
    const base = palanca ? { x: palanca.baseX, y: palanca.baseY } : baseDeJoystick(lado);
    const color = lado === 0 ? COLOR.local : COLOR.visitante;
    const bx = base.x * dpr;
    const by = base.y * dpr;
    const radio = RADIO_JOYSTICK * dpr;
    ctx.globalAlpha = palanca ? 0.28 : 0.18;
    ctx.fillStyle = COLOR.noche;
    circulo(bx, by, radio);
    ctx.fill();
    ctx.globalAlpha = palanca ? 0.9 : 0.55;
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = color;
    ctx.stroke();
    let dx = 0;
    let dy = 0;
    if (palanca) {
      dx = palanca.x - palanca.baseX;
      dy = palanca.y - palanca.baseY;
      const d = Math.hypot(dx, dy);
      const k = d > RADIO_JOYSTICK ? RADIO_JOYSTICK / d : 1;
      dx *= k;
      dy *= k;
    }
    circulo(bx + dx * dpr, by + dy * dpr, radio * 0.42);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}


/* =====================================================================
   16. MARCADOR, PALCOS, CARTELES, AVISOS Y ANUNCIOS
   ===================================================================== */
function actualizarMarcador(equipoQueAnoto = null) {
  if (equipoQueAnoto !== null) eco('marcador', equipoQueAnoto);
  el.nombreLocal.textContent = estado.nombres[0];
  el.nombreVisitante.textContent = estado.nombres[1];
  const [k0, k1] = estado.kits;
  el.siglaLocal.textContent = k0.codigo;
  el.siglaVisitante.textContent = k1.codigo;
  el.seleccionLocal.textContent = `, ${k0.nombre}`;
  el.seleccionVisitante.textContent = `, ${k1.nombre}`;
  pintarCamiseta(el.camisetaLocal, k0);
  pintarCamiseta(el.camisetaVisitante, k1);
  el.golesLocal.textContent = estado.goles[0];
  el.golesVisitante.textContent = estado.goles[1];
  if (equipoQueAnoto !== null) {
    const numero = equipoQueAnoto === 0 ? el.golesLocal : el.golesVisitante;
    numero.classList.remove('equipo__goles--salta');
    void numero.offsetWidth; // reinicia la animación
    numero.classList.add('equipo__goles--salta');
  }
  actualizarInfo();
}

function actualizarInfo() {
  el.infoCentro.textContent = estado.modo === 'maquina' ? `Racha: ${estado.racha}` : 'Online';
}

// Palco: la imagen de festejo o de burla aparece arriba, del lado de quien
// anotó, dentro del marcador (así nunca tapa la cancha). Se ve completa.
const relojesPalco = [null, null];
function mostrarPalco(equipo, tipo) {
  eco('palco', equipo, tipo);
  const imagen = equipo === 0 ? el.palcoLocal : el.palcoVisitante;
  const fuente = tipo === 'burla' ? el.imgBurla : el.imgFestejo;
  imagen.src = fuente.src;
  imagen.hidden = false;
  const caja = imagen.parentElement;
  caja.classList.remove('palco--activo', 'palco--burla');
  void caja.offsetWidth; // reinicia la animación
  caja.classList.add('palco--activo');
  caja.classList.toggle('palco--burla', tipo === 'burla');
  clearTimeout(relojesPalco[equipo]);
  relojesPalco[equipo] = setTimeout(() => ocultarPalco(equipo), JUEGO.segundosCelebracion * 1000);
}

function ocultarPalco(equipo) {
  const imagen = equipo === 0 ? el.palcoLocal : el.palcoVisitante;
  imagen.hidden = true;
  imagen.parentElement.classList.remove('palco--activo', 'palco--burla');
}

function ocultarPalcos() {
  eco('sinPalcos');
  clearTimeout(relojesPalco[0]);
  clearTimeout(relojesPalco[1]);
  ocultarPalco(0);
  ocultarPalco(1);
}

// Reloj del marcador (solo cambia el texto cuando cambia el segundo)
function actualizarReloj() {
  const segundos = Math.ceil(estado.tiempo);
  if (segundos === estado.ultimoSegundo) return;
  estado.ultimoSegundo = segundos;
  const minutos = Math.floor(segundos / 60);
  const resto = String(segundos % 60).padStart(2, '0');
  el.reloj.textContent = estado.muerteSubita ? `MS ${minutos}:${resto}` : `${minutos}:${resto}`;
  el.reloj.classList.toggle('marcador__reloj--urgente', segundos <= 10 || estado.muerteSubita);
  if (estado.fase !== 'juego' || esVisitaOnline()) return;
  if (segundos <= 5 && segundos > 0) Sonido.pitido();
  if (!estado.muerteSubita && (segundos === 60 || segundos === 30 || segundos === 10)) {
    anunciar(segundos === 60 ? 'Queda un minuto.' : `Quedan ${segundos} segundos.`);
  }
}

// Fichas de poderes activos en el marcador (solo cambia lo que cambió)
function actualizarFichas() {
  const activos = [[], []];
  for (const tipo of ['mini', 'turbo', 'zigzag', 'multi', 'gigante', 'hielo']) {
    if (estado.efectos[tipo] > 0) activos[estado.duenos[tipo]].push(tipo);
  }
  for (const lado of [0, 1]) {
    if (estado.escudo[lado] > 0) activos[lado].push('escudo');
  }

  [el.poderesLocal, el.poderesVisitante].forEach((lista, lado) => {
    const claves = activos[lado].map((tipo) => `${tipo}:${estado.marcas[lado + ':' + tipo] || 0}`);
    for (const ficha of Array.from(lista.children)) {
      if (!claves.includes(ficha.dataset.clave)) ficha.remove();
    }
    activos[lado].forEach((tipo, i) => {
      if (lista.querySelector(`[data-clave="${claves[i]}"]`)) return;
      const ficha = document.createElement('li');
      ficha.className = `chip chip--${tipo}`;
      ficha.dataset.clave = claves[i];
      ficha.append(crearIcono(PODERES[tipo].icono));
      const nombre = document.createElement('span');
      nombre.className = 'solo-lector';
      nombre.textContent = PODERES[tipo].nombre;
      const barra = document.createElement('span');
      barra.className = 'chip__tiempo';
      ficha.append(nombre, barra);
      lista.append(ficha);
    });
  });
}

// Cartel grande en el centro: "¡Comienza!", "¡GOOOL!", "Muerte súbita"
let relojCartel = null;
function mostrarCartel(texto, clase, subtitulo = '') {
  eco('cartel', texto, clase, subtitulo);
  const cartel = el.cartel;
  cartel.className = `cartel cartel--${clase}`;
  cartel.textContent = texto;
  if (subtitulo) {
    // Línea pequeña debajo: quién hizo el gol
    const linea = document.createElement('span');
    linea.className = 'cartel__autor';
    linea.textContent = subtitulo;
    cartel.append(linea);
  }
  cartel.setAttribute('aria-hidden', 'true'); // los lectores de pantalla lo reciben por la zona de anuncios
  cartel.hidden = false;
  void cartel.offsetWidth; // reinicia la animación
  cartel.classList.add('cartel--visible');
  clearTimeout(relojCartel);
  relojCartel = setTimeout(() => { cartel.hidden = true; }, 1700);
}

// Con "enCola", si ya hay un aviso en pantalla, este sale cuando aquel se va
// (así un cambio de jugadores no tapa el aviso del saque o de la falta)
let relojAviso = null;
const colaAvisos = [];
function mostrarAviso(texto, clase, icono, enCola = false) {
  eco('aviso', texto, clase, icono || null, enCola);
  if (enCola && !el.aviso.hidden) {
    colaAvisos.push([texto, clase, icono]);
    return;
  }
  const aviso = el.aviso;
  aviso.className = `aviso aviso--${clase}`;
  aviso.replaceChildren();
  if (icono) aviso.append(crearIcono(icono));
  const span = document.createElement('span');
  span.textContent = texto;
  aviso.append(span);
  aviso.setAttribute('aria-hidden', 'true'); // los lectores de pantalla lo reciben por la zona de anuncios
  aviso.hidden = false;
  void aviso.offsetWidth;
  aviso.classList.add('aviso--visible');
  clearTimeout(relojAviso);
  relojAviso = setTimeout(() => {
    aviso.hidden = true;
    const siguiente = colaAvisos.shift();
    if (siguiente) sinEco(() => mostrarAviso(...siguiente)); // ya viajó por el eco cuando se pidió
  }, 2100);
}

// Zona "aria-live": lo que se escribe aquí lo leen los lectores de pantalla
let relojAnuncio = null;
function anunciar(texto) {
  eco('anunciar', texto);
  clearTimeout(relojAnuncio);
  el.anuncios.textContent = '';
  relojAnuncio = setTimeout(() => { el.anuncios.textContent = texto; }, 60);
}

// ---- Consejos de controles ----
// Mientras juegas aparece, pocas veces, qué botón sirve en ese momento:
// con el balón, cerca del arco, defendiendo o en un saque.
// Cada consejo sale máximo dos veces y nunca dos seguidos muy pronto.
const VECES_CONSEJO = 2;
const SEGUNDOS_ENTRE_CONSEJOS = 8;
const consejosVistos = { ataque: 0, remate: 0, defensa: 0, saque: 0, libre: 0, penal: 0 };
let ultimoConsejo = -99;
let relojConsejo = null;

// Las frases: las teclas van como { tecla: 'pase' } y los botones del celular como { boton: 'Pase' }
const CONSEJOS = Object.freeze({
  teclado: {
    ataque: ['Con el balón: ', { tecla: 'pase' }, ' pase · ', { tecla: 'centro' }, ' centro · mantén ', { tecla: 'tiro' }, ' para cargar el tiro'],
    remate: ['¡Cerca del arco! Mantén ', { tecla: 'tiro' }, ' y suelta para rematar'],
    defensa: ['Sin el balón: ', { tecla: 'tiro' }, ' barrida · ', { tecla: 'pase' }, ' cambiar de jugador · mantén ', { tecla: 'centro' }, ' para presionar'],
    saque: ['Saque: apunta y pulsa ', { tecla: 'pase' }, ' corto o ', { tecla: 'centro' }, ' largo'],
    libre: ['Tiro libre: apunta y pulsa ', { tecla: 'tiro' }, ' al arco o ', { tecla: 'pase' }, ' para pasarla'],
    penal: ['¡Penal! Apunta con las flechas y pulsa ', { tecla: 'tiro' }]
  },
  tactil: {
    ataque: ['Con el balón: ', { boton: 'Pase' }, ' · ', { boton: 'Centro' }, ' · mantén ', { boton: 'Tiro' }],
    remate: ['¡Cerca del arco! Mantén ', { boton: 'Tiro' }, ' y suelta'],
    defensa: ['Sin el balón: ', { boton: 'Barrida' }, ' lo quita · ', { boton: 'Cambiar' }, ' de jugador'],
    saque: ['Saque: apunta y toca ', { boton: 'Pase' }, ' corto o ', { boton: 'Centro' }, ' largo'],
    libre: ['Tiro libre: apunta y toca ', { boton: 'Tiro' }, ' al arco o ', { boton: 'Pase' }],
    penal: ['¡Penal! Apunta con el joystick y toca ', { boton: 'Tiro' }]
  }
});

// ¿Qué consejo le sirve ahora al jugador de este lado?
function situacionDe(lado) {
  const equipo = estado.equipos[lado];
  const j = equipo.controlado;
  const balon = balonPrincipal();
  if (!equipo.humano || !j || !balon || equipoCongelado(lado)) return null;
  if (estado.espera) {
    if (estado.espera.jugador !== j) return null;
    return estado.espera.tipo === 'libre' || estado.espera.tipo === 'penal' ? estado.espera.tipo : 'saque';
  }
  if (balon.dueno === j) return miraAlArco(j).distancia < 330 ? 'remate' : 'ataque';
  if (balon.dueno && balon.dueno.equipo !== lado && balon.dueno.rol !== 'portero') return 'defensa';
  return null;
}

function revisarConsejos() {
  if (estado.reloj < 3 || estado.reloj - ultimoConsejo < SEGUNDOS_ENTRE_CONSEJOS) return;
  for (const lado of ladosPropios()) {
    const tipo = situacionDe(lado);
    if (!tipo || consejosVistos[tipo] >= VECES_CONSEJO) continue;
    consejosVistos[tipo]++;
    ultimoConsejo = estado.reloj;
    mostrarConsejo(tipo, lado);
    return;
  }
}

function mostrarConsejo(tipo, lado) {
  const consejo = el.consejo;
  const partes = CONSEJOS[mandoTactil ? 'tactil' : 'teclado'][tipo];
  const teclas = LEYENDA;
  consejo.className = 'consejo';
  consejo.replaceChildren();
  let textoPlano = consejo.textContent;
  for (const parte of partes) {
    if (typeof parte === 'string') {
      consejo.append(parte);
      textoPlano += parte;
    } else if (parte.tecla) {
      const kbd = document.createElement('kbd');
      kbd.textContent = teclas[parte.tecla];
      consejo.append(kbd);
      textoPlano += teclas[parte.tecla];
    } else {
      const nombre = document.createElement('strong');
      nombre.textContent = parte.boton;
      consejo.append(nombre);
      textoPlano += parte.boton;
    }
  }
  consejo.setAttribute('aria-hidden', 'true'); // se lee por la zona de anuncios
  consejo.hidden = false;
  void consejo.offsetWidth; // reinicia la animación
  consejo.classList.add('consejo--visible');
  clearTimeout(relojConsejo);
  relojConsejo = setTimeout(ocultarConsejo, 4500);
  sinEco(() => anunciar(`Consejo. ${textoPlano}`)); // el consejo es solo para esta pantalla
}

function ocultarConsejo() {
  clearTimeout(relojConsejo);
  el.consejo.hidden = true;
}


/* =====================================================================
   17. CONTROLES
   Como en los juegos de fútbol del celular: un joystick para moverse y
   tres botones de acción, como en Dream League Soccer (Pase, Centro y Tiro).
   Sin el balón cambian: Cambiar, Presión y Barrida. Correr es automático.
   - Computador: todo con teclas. En pantalla se ven los botones con la
     tecla de cada uno (y se encienden al presionarla).
   - Celular: joystick a la izquierda y botones a la derecha.
   ===================================================================== */
// Teclas: flechas para moverte y, con la otra mano, Z pase, X centro y
// Espacio (la tecla más grande) para el tiro. Correr es automático.
// (S, A y D también sirven, para quien ya se acostumbró a ellas)
const TECLADO = Object.freeze({
  arriba: 'ArrowUp', abajo: 'ArrowDown', izquierda: 'ArrowLeft', derecha: 'ArrowRight',
  pase: ['KeyZ', 'KeyS'], centro: ['KeyX', 'KeyA'], tiro: ['Space', 'KeyD']
});

// Lo que muestra cada botón en el computador y los atajos que leen los lectores de pantalla
const LEYENDA = Object.freeze({ pase: 'Z', centro: 'X', tiro: 'Espacio' });
const ATAJO = Object.freeze({ pase: 'Z S', centro: 'X A', tiro: 'Space D' });

// Teclas de cada equipo (se les quita su efecto normal, como mover la página).
// En la posición 0 las del equipo 0 y en la 1 las del 1: tus teclas manejan tu
// equipo (en online, si eres el visitante, el equipo 1).
function teclasDelModo() {
  return estado.miLado === 1 ? [null, TECLADO] : [TECLADO];
}

function esTeclaDeJuego(codigo) {
  return teclasDelModo().some((t) => t &&
    ([t.arriba, t.abajo, t.izquierda, t.derecha].includes(codigo) || ACCIONES.some((a) => t[a].includes(codigo))));
}

const presionadas = new Set();
const palancas = [null, null];   // joystick activo de cada lado (en píxeles CSS del canvas)
const dedos = new Map();         // pointerId → lado
let mandoTactil = esTactil;      // ¿se muestran los controles para dedos?
const botonesMando = [{}];       // tus botones, por acción

// Une teclado y joystick en una sola dirección de cancha para cada equipo
function leerEntradas() {
  // Solo los equipos de esta pantalla: en online, el del rival llega por internet
  for (const lado of ladosPropios()) {
    const equipo = estado.equipos[lado];
    if (!equipo) continue;
    let sx = 0;
    let sy = 0;
    const t = teclasDelModo()[lado];
    if (t) {
      if (presionadas.has(t.derecha)) sx += 1;
      if (presionadas.has(t.izquierda)) sx -= 1;
      if (presionadas.has(t.abajo)) sy += 1;
      if (presionadas.has(t.arriba)) sy -= 1;
    }
    const palanca = palancas[lado];
    if (sx === 0 && sy === 0 && palanca) {
      const dx = palanca.x - palanca.baseX;
      const dy = palanca.y - palanca.baseY;
      const d = Math.hypot(dx, dy);
      if (d > RADIO_JOYSTICK * 0.15) {
        const fuerza = Math.min(1, d / RADIO_JOYSTICK);
        sx = (dx / d) * fuerza;
        sy = (dy / d) * fuerza;
      }
    }
    const largo = Math.hypot(sx, sy);
    if (largo > 1) {
      sx /= largo;
      sy /= largo;
    }
    const direccion = direccionACancha(sx, sy);
    equipo.entrada.x = direccion.x;
    equipo.entrada.y = direccion.y;
  }
}

// Una tecla o un dedo presiona una acción. "fuente" dice cuál (para saber
// cuándo se soltaron todas: puedes tener dos teclas para lo mismo).
function presionarAccion(lado, accion, fuente) {
  if (estado.pantalla !== 'juego' || estado.pausado) return;
  if (estado.fase === 'repeticion') {
    saltarRepeticion();
    return;
  }
  const equipo = estado.equipos[lado];
  if (!equipo || !equipo.humano) return;
  const fuentes = equipo.fuentes[accion];
  const antes = fuentes.size;
  fuentes.add(fuente);
  if (antes === 0) {
    // En online, si eres el visitante, el botón viaja hasta el aparato que lleva el partido
    if (esVisitaOnline()) enviarAlRival({ t: 'a', a: accion, d: 1 });
    else equipo.pedidos.push(accion + ':abajo');
    marcarBoton(lado, accion, true);
  }
}

function soltarAccion(lado, accion, fuente) {
  const equipo = estado.equipos[lado];
  if (!equipo) return;
  const fuentes = equipo.fuentes[accion];
  if (!fuentes.delete(fuente)) return;
  if (fuentes.size === 0) {
    if (esVisitaOnline()) enviarAlRival({ t: 'a', a: accion, d: 0 });
    else equipo.pedidos.push(accion + ':arriba');
    marcarBoton(lado, accion, false);
  }
}

// El botón en pantalla se "hunde" mientras está presionado (con dedo o tecla)
function marcarBoton(lado, accion, activo) {
  const grupo = botonesMando[grupoDelLado(lado)];
  const boton = grupo && grupo[accion];
  if (boton) boton.classList.toggle('boton-mando--activo', activo);
}

function hayDialogoAbierto() {
  return el.dialogoPausa.open || el.dialogoAyuda.open || el.dialogoFinal.open || el.dialogoTeToca.open || el.dialogoCambios.open;
}

function alPresionarTecla(evento) {
  if (estado.pantalla !== 'juego') return;
  const esMenu = evento.key === 'Escape' || evento.key === 'p' || evento.key === 'P';
  if (esMenu) {
    if (hayDialogoAbierto()) {
      // P también cierra la pausa (Esc ya lo hace el propio diálogo)
      if ((evento.key === 'p' || evento.key === 'P') && el.dialogoPausa.open && !el.dialogoAyuda.open) {
        evento.preventDefault();
        continuar();
      }
      return;
    }
    evento.preventDefault();
    abrirPausa();
    return;
  }
  if (estado.fase === 'repeticion' && !estado.pausado && !hayDialogoAbierto()) {
    evento.preventDefault();
    saltarRepeticion();
    return;
  }
  if (estado.pausado || hayDialogoAbierto() || !esTeclaDeJuego(evento.code)) return;
  // Si un botón de la pantalla tiene el foco, Enter y Espacio lo activan a él
  const enBoton = evento.target && evento.target.closest && evento.target.closest('.boton-mando');
  if (enBoton && ['Enter', 'NumpadEnter', 'Space'].includes(evento.code)) return;
  evento.preventDefault();
  presionadas.add(evento.code);
  if (evento.repeat) return;
  teclasDelModo().forEach((t, lado) => {
    if (!t) return;
    for (const accion of ACCIONES) {
      if (t[accion].includes(evento.code)) presionarAccion(lado, accion, evento.code);
    }
  });
}

function alSoltarTecla(evento) {
  presionadas.delete(evento.code);
  teclasDelModo().forEach((t, lado) => {
    if (!t) return;
    for (const accion of ACCIONES) {
      if (t[accion].includes(evento.code)) soltarAccion(lado, accion, evento.code);
    }
  });
}

function soltarControles() {
  presionadas.clear();
  dedos.clear();
  palancas[0] = null;
  palancas[1] = null;
  // En online solo se sueltan los controles de esta pantalla (el rival sigue jugando)
  const equipos = estado.modo === 'online' ? ladosPropios().map((lado) => estado.equipos[lado]) : estado.equipos;
  for (const equipo of equipos) {
    if (!equipo) continue;
    // Si eras el visitante y tenías un botón presionado, se avisa que se soltó
    if (esVisitaOnline()) {
      for (const accion of ACCIONES) if (equipo.fuentes[accion].size) enviarAlRival({ t: 'a', a: accion, d: 0 });
    }
    equipo.entrada.x = 0;
    equipo.entrada.y = 0;
    for (const accion of ACCIONES) equipo.fuentes[accion].clear();
    equipo.pedidos.length = 0;
    equipo.carga = null;
    equipo.presion = false;
    equipo.modoBotones = '';
  }
  for (const grupo of botonesMando) {
    for (const boton of Object.values(grupo)) boton.classList.remove('boton-mando--activo', 'boton-mando--cargando');
  }
}

function posicionCss(evento) {
  const caja = el.lienzo.getBoundingClientRect();
  return { x: evento.clientX - caja.left, y: evento.clientY - caja.top };
}


// Si alguien juega con los dedos, se muestran el joystick y los botones grandes
function activarMandoTactil() {
  if (mandoTactil) return;
  mandoTactil = true;
  el.mando.classList.add('mando--tactil');
  configurarMando();
}

// Al tocar la cancha aparece el joystick justo donde pusiste el dedo
function alTocar(evento) {
  Sonido.reanudar();
  if (evento.pointerType === 'touch') activarMandoTactil();
  if (estado.pantalla !== 'juego' || estado.pausado || !vista.listo) return;
  evento.preventDefault();
  if (estado.fase === 'repeticion') {
    saltarRepeticion();
    return;
  }
  if (el.lienzo.setPointerCapture) {
    try { el.lienzo.setPointerCapture(evento.pointerId); } catch (error) { /* sin captura: igual funciona */ }
  }
  const pos = posicionCss(evento);
  const lado = estado.miLado; // toda la pantalla es tuya
  if (!estado.equipos[lado].humano || palancas[lado]) return; // un solo dedo mueve a cada jugador
  dedos.set(evento.pointerId, lado);
  palancas[lado] = { id: evento.pointerId, baseX: pos.x, baseY: pos.y, x: pos.x, y: pos.y };
}

function alMoverPuntero(evento) {
  const lado = dedos.get(evento.pointerId);
  if (lado === undefined) return;
  const palanca = palancas[lado];
  if (!palanca || palanca.id !== evento.pointerId) return;
  evento.preventDefault();
  const pos = posicionCss(evento);
  palanca.x = pos.x;
  palanca.y = pos.y;
  const dx = pos.x - palanca.baseX;
  const dy = pos.y - palanca.baseY;
  const d = Math.hypot(dx, dy);
  // Si el dedo se aleja mucho, la base lo sigue
  if (d > RADIO_JOYSTICK * 1.4) {
    palanca.baseX = pos.x - (dx / d) * RADIO_JOYSTICK * 1.4;
    palanca.baseY = pos.y - (dy / d) * RADIO_JOYSTICK * 1.4;
  }
}

function alSoltarPuntero(evento) {
  const lado = dedos.get(evento.pointerId);
  dedos.delete(evento.pointerId);
  if (lado === undefined) return;
  const palanca = palancas[lado];
  if (palanca && palanca.id === evento.pointerId) palancas[lado] = null;
}

// ---- Botones en pantalla ----
function prepararMando() {
  document.querySelectorAll('.boton-mando').forEach((boton) => {
    // A qué equipo mueve se decide al tocar (en online puede ser el equipo 1)
    const grupo = 0;
    const lado = () => ladoDelGrupo();
    const accion = boton.dataset.accion;
    botonesMando[grupo][accion] = boton;
    boton.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      Sonido.reanudar();
      if (evento.pointerType === 'touch') activarMandoTactil();
      try { boton.setPointerCapture(evento.pointerId); } catch (error) { /* sin captura: igual funciona */ }
      presionarAccion(lado(), accion, 'dedo' + evento.pointerId);
    });
    const soltar = (evento) => soltarAccion(lado(), accion, 'dedo' + evento.pointerId);
    boton.addEventListener('pointerup', soltar);
    boton.addEventListener('pointercancel', soltar);
    boton.addEventListener('lostpointercapture', soltar);
    boton.addEventListener('contextmenu', (evento) => evento.preventDefault());
    // Con el teclado (Tab hasta el botón + Enter o Espacio): un toque corto
    boton.addEventListener('click', (evento) => {
      if (evento.detail !== 0) return; // los clics con dedo o ratón ya se atendieron arriba
      presionarAccion(lado(), accion, 'clic');
      setTimeout(() => soltarAccion(lado(), accion, 'clic'), 120);
    });
  });
}

// Al empezar: qué botones se ven y qué tecla muestra cada uno
function configurarMando() {
  el.mando.hidden = false;
  el.mando.classList.toggle('mando--tactil', mandoTactil);
  // En online, si eres el visitante, tus botones van con el color de tu equipo (fucsia)
  el.mando.classList.toggle('mando--visitante', estado.miLado === 1);
  for (const accion of ACCIONES) {
    const boton = botonesMando[0][accion];
    if (!boton) continue;
    boton.querySelector('.boton-mando__tecla').textContent = LEYENDA[accion];
    boton.setAttribute('aria-keyshortcuts', ATAJO[accion]);
  }
  for (const equipo of estado.equipos) equipo.modoBotones = '';
  actualizarMando();
}

// Cambia el nombre de los botones según si tu equipo tiene el balón
function actualizarMando() {
  const balon = balonPrincipal();
  estado.equipos.forEach((equipo, lado) => {
    const numero = grupoDelLado(lado);
    if (!equipo.humano || numero < 0) return;
    const ataca = Boolean(balon && ((balon.dueno && balon.dueno.equipo === lado) ||
      (!balon.dueno && estado.ultimoEquipo === lado)));
    const modo = ataca ? 'ataque' : 'defensa';
    const grupo = botonesMando[numero];
    if (modo !== equipo.modoBotones) {
      equipo.modoBotones = modo;
      for (const accion of ACCIONES) {
        if (grupo[accion]) grupo[accion].querySelector('.boton-mando__texto').textContent = ETIQUETAS[modo][accion];
      }
      el.botonesJ1.classList.toggle('mando__grupo--defensa', modo === 'defensa');
    }
    const cargando = equipo.carga !== null;
    if (grupo.tiro && grupo.tiro.classList.contains('boton-mando--cargando') !== cargando) {
      grupo.tiro.classList.toggle('boton-mando--cargando', cargando);
    }
  });
}


/* =====================================================================
   18. PANTALLAS, MENÚ Y DIÁLOGOS
   ===================================================================== */
function abrirDialogo(dialogo) {
  if (dialogo.open) return;
  if (typeof dialogo.showModal === 'function') dialogo.showModal();
  else dialogo.setAttribute('open', '');
}

function cerrarDialogo(dialogo) {
  if (!dialogo.open) return;
  if (typeof dialogo.close === 'function') dialogo.close();
  else dialogo.removeAttribute('open');
}

function textoDeControles() {
  return mandoTactil
    ? 'Joystick para moverte · botones para jugar'
    : 'Flechas para moverte · Z pase · X centro · Espacio tiro';
}

// Normal: un partido contra Petunia o un mini torneo
function comenzar() {
  const datos = new FormData(el.form);
  estado.nivel = datos.get('nivel') === 'dificil' ? 'dificil' : 'facil';
  estado.nombreUsuario = el.usuario.value.trim().slice(0, 14);
  const tuyo = buscarEquipo(datos.get('equipo1')).codigo;
  if (datos.get('tipo') === 'torneo') {
    empezarTorneo(tuyo);
    return;
  }
  torneo = null;
  jugarPartido(tuyo, buscarEquipo(datos.get('equipo2')).codigo, leerAtuendo());
}

// Arranca un partido contra Petunia (suelto o del torneo)
function jugarPartido(codigo0, codigo1, atuendo) {
  estado.modo = 'maquina';
  estado.miLado = 0;
  estado.sinEmpate = Boolean(torneo); // en el torneo siempre hay ganador
  el.pantallaJuego.classList.remove('juego--girado');
  estado.nombres = [estado.nombreUsuario, 'Petunia'];
  estado.codigos = [codigo0, codigo1];
  estado.kits = armarKits(codigo0, codigo1, atuendo);
  describirCancha();

  el.pantallaInicio.hidden = true;
  el.pantallaTorneo.hidden = true;
  el.pantallaJuego.hidden = false;
  document.documentElement.classList.add('jugando');
  estado.pantalla = 'juego';

  nuevaPartida();
  configurarMando();
  medirCancha();
  iniciarBucle();
  el.lienzo.focus({ preventScroll: true });
  mantenerPantallaEncendida();
  ponerAcostado();
  revisarOrientacion();

  mostrarAviso(textoDeControles(), 'ayuda', ICONO_BALON);
  const ronda = torneo ? `${nombreRonda(rondaDe(torneo).length)} del mini torneo: ` : '';
  anunciar(`${ronda}${estado.nombres[0]} con ${estado.kits[0].nombre} contra ${estado.nombres[1]} con ${estado.kits[1].nombre}, nivel ${NIVELES[estado.nivel].nombre}. Tres minutos, con medio tiempo y cambio de cancha; gana quien vaya ganando cuando se acabe el tiempo.`);
}

// "Otro rival": un partido nuevo contra otra selección al azar
function jugarOtroRival() {
  cerrarDialogo(el.dialogoFinal);
  const opciones = EQUIPOS.map((e) => e.codigo).filter((c) => !estado.codigos.includes(c));
  const rival = elegir(opciones);
  el.equipo2.value = rival; // el inicio también queda con ese rival
  actualizarSelector();
  const atuendo = leerAtuendo();
  jugarPartido(estado.codigos[0], rival, { camiseta: [atuendo.camiseta[0], 'titular'], botines: [atuendo.botines[0], 'negro'] });
}

// ---- Mini torneo en Normal ----
// Las 16 selecciones, por eliminación: octavos, cuartos, semifinal y final.
// Petunia maneja a cada rival tuyo; los otros partidos se juegan solos (con
// marcadores al azar). En el torneo no hay empates: la muerte súbita se repite.
let torneo = null;

function empezarTorneo(tuyo) {
  const otros = EQUIPOS.map((e) => e.codigo).filter((c) => c !== tuyo);
  for (let i = otros.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [otros[i], otros[k]] = [otros[k], otros[i]];
  }
  const lista = [tuyo].concat(otros); // las 16
  // Sorteo: cada quien en un lugar al azar del cuadro
  for (let i = lista.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[k]] = [lista[k], lista[i]];
  }
  const ronda = [];
  for (let i = 0; i < lista.length; i += 2) ronda.push(partidoDeTorneo(lista[i], lista[i + 1]));
  torneo = { tu: tuyo, rondas: [ronda], campeon: null, eliminado: false, terminado: false, medalla: null };
  mostrarPantallaTorneo();
}

function partidoDeTorneo(a, b) {
  return { a, b, goles: [0, 0], estado: 'espera', ganador: null, motivo: null, reloj: '' };
}

function partidoTuyo() {
  if (!torneo) return null;
  return rondaDe(torneo).find((p) => p.a === torneo.tu || p.b === torneo.tu) || null;
}

function jugarPartidoDelTorneo() {
  if (!torneo) return;
  if (torneo.terminado) {
    empezarTorneo(torneo.tu); // "Otro torneo"
    return;
  }
  const p = partidoTuyo();
  if (!p) return;
  p.estado = 'jugando';
  const rival = p.a === torneo.tu ? p.b : p.a;
  const atuendo = leerAtuendo();
  Sonido.desbloquear();
  jugarPartido(torneo.tu, rival, { camiseta: [atuendo.camiseta[0], 'titular'], botines: [atuendo.botines[0], 'negro'] });
}

// Un partido entre otras dos selecciones: marcador al azar (si empatan, uno
// gana en la muerte súbita)
function simularPartido(p) {
  p.goles = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
  if (p.goles[0] === p.goles[1]) p.goles[Math.random() < 0.5 ? 0 : 1]++;
  p.ganador = p.goles[0] > p.goles[1] ? p.a : p.b;
  p.estado = 'fin';
}

// Se anota tu partido, se juegan los demás de la ronda y se arma la siguiente.
// Devuelve una frase para la ventana final.
function anotarEnTorneo(ganaste) {
  const p = partidoTuyo();
  if (!p) return '';
  const tuyos = estado.goles[0];
  const suyos = estado.goles[1];
  p.goles = p.a === torneo.tu ? [tuyos, suyos] : [suyos, tuyos];
  p.ganador = ganaste ? torneo.tu : (p.a === torneo.tu ? p.b : p.a);
  p.estado = 'fin';
  const nombre = nombreRonda(rondaDe(torneo).length);
  for (const otro of rondaDe(torneo)) if (otro.estado !== 'fin') simularPartido(otro);
  if (!ganaste) {
    torneo.eliminado = nombre;
    if (nombre === 'Final') torneo.medalla = 'plata'; // subcampeón
    // El torneo sigue sin ti hasta que haya campeón
    while (rondaDe(torneo).length > 1) {
      siguienteRonda();
      for (const otro of rondaDe(torneo)) simularPartido(otro);
    }
    torneo.campeon = rondaDe(torneo)[0].ganador;
    torneo.terminado = true;
    return torneo.medalla === 'plata'
      ? 'Perdiste la final, pero te llevas la medalla de plata.'
      : `Ganó el torneo ${buscarEquipo(torneo.campeon).nombre}.`;
  }
  if (rondaDe(torneo).length === 1) {
    torneo.campeon = torneo.tu;
    torneo.terminado = true;
    torneo.medalla = 'oro';
    return `¡${buscarEquipo(torneo.tu).nombre} es campeón: Copa Petunia y medalla de oro!`;
  }
  siguienteRonda();
  const siguiente = nombreRonda(rondaDe(torneo).length);
  return siguiente === 'Cuartos de final' ? '¡Pasas a cuartos de final!' : `¡Pasas a la ${siguiente.toLowerCase()}!`;
}

function siguienteRonda() {
  const ganadores = rondaDe(torneo).map((p) => p.ganador);
  const nueva = [];
  for (let i = 0; i < ganadores.length; i += 2) nueva.push(partidoDeTorneo(ganadores[i], ganadores[i + 1]));
  torneo.rondas.push(nueva);
}

// Medalla de oro o de plata (o ninguna)
function mostrarMedalla(caja, texto, medalla) {
  caja.hidden = !medalla;
  if (!medalla) return;
  caja.dataset.medalla = medalla;
  texto.textContent = medalla === 'oro' ? '¡Medalla de oro!' : 'Medalla de plata';
}

function mostrarPantallaTorneo() {
  cerrarDialogo(el.dialogoFinal);
  el.pantallaInicio.hidden = true;
  el.pantallaJuego.hidden = true;
  el.pantallaTorneo.hidden = false;
  estado.pantalla = 'torneo';
  document.documentElement.classList.remove('jugando');
  const tu = buscarEquipo(torneo.tu).nombre;
  const etiqueta = (codigo) => `${buscarEquipo(codigo).nombre}${codigo === torneo.tu ? ' (tú)' : ''}`;
  llenarCuadro(el.cuadroNormal, torneo.rondas, { tipo: 'torneo', etiqueta, yo: torneo.tu });
  el.resultadoTorneo.hidden = !torneo.terminado;
  mostrarMedalla(el.medallaTorneo, el.textoMedallaTorneo, torneo.terminado ? torneo.medalla : null);
  if (torneo.terminado) {
    const campeon = torneo.campeon === torneo.tu;
    el.estadoTorneo.textContent = campeon ? '¡Campeón!' : (torneo.medalla === 'plata' ? '¡Subcampeón!' : `Eliminado en ${torneo.eliminado.toLowerCase()}`);
    el.tituloProximo.textContent = campeon ? '¡Ganaste la copa!' : 'Se acabó el torneo';
    el.dueloTorneo.textContent = campeon
      ? `${tu} le ganó a Petunia en todas las rondas y se lleva la Copa Petunia.`
      : `Petunia te eliminó en ${torneo.eliminado.toLowerCase()}. La copa se la llevó ${buscarEquipo(torneo.campeon).nombre}.`;
    // Imagen completa: festejo si ganaste, Petunia burlándose si no
    const fuente = campeon ? el.imgFestejo : el.imgBurla;
    el.imagenTorneo.src = fuente.src;
    el.imagenTorneo.alt = fuente.alt;
    el.resultadoTorneo.classList.toggle('torneo__resultado--burla', !campeon);
    el.textoResultadoTorneo.textContent = campeon ? `¡${tu} campeón!` : '¡JA, JA! Petunia se ríe';
    el.botonJugarTorneo.textContent = 'Otro torneo';
    anunciar(`${el.estadoTorneo.textContent}. ${el.dueloTorneo.textContent}`);
  } else {
    const p = partidoTuyo();
    const rival = p.a === torneo.tu ? p.b : p.a;
    const ronda = nombreRonda(rondaDe(torneo).length);
    el.estadoTorneo.textContent = ronda;
    el.tituloProximo.textContent = 'Tu próximo partido';
    el.dueloTorneo.textContent = `${ronda}: ${tu} contra ${buscarEquipo(rival).nombre} (Petunia).`;
    el.botonJugarTorneo.textContent = ronda.endsWith('de final') && ronda !== 'Final'
      ? `Jugar los ${ronda.split(' ')[0].toLowerCase()}` : `Jugar la ${ronda.toLowerCase()}`;
    anunciar(`Mini torneo. ${el.dueloTorneo.textContent}`);
  }
  el.botonJugarTorneo.focus({ preventScroll: true });
}

// Texto que lee el lector de pantalla para la cancha (dice qué selecciones juegan)
function describirCancha() {
  // Tu equipo ataca hacia la derecha en el primer tiempo y hacia la izquierda en el segundo
  const yo = estado.miLado;
  const otro = 1 - yo;
  el.lienzo.setAttribute('aria-label',
    `Cancha de fútbol vista un poco inclinada; la cámara sigue el balón. ${estado.nombres[yo]} juega con ${estado.kits[yo].nombre} ` +
    `y ataca hacia ${estado.canchaCambiada ? 'la izquierda' : 'la derecha'}, contra ${estado.nombres[otro]} con ${estado.kits[otro].nombre}.`);
}

function abrirPausa() {
  if (estado.pantalla !== 'juego' || estado.pausado || estado.fase === 'final') return;
  const online = estado.modo === 'online';
  const [n0, n1] = estado.nombres;
  // En online no hay pausa: el menú se abre, pero el partido sigue corriendo
  el.botonReiniciar.hidden = online || Boolean(torneo);
  el.botonSalir.hidden = online;
  el.botonSalir.textContent = torneo ? 'Salir del torneo' : 'Salir al inicio';
  el.botonAbandonar.hidden = !online;
  el.tituloPausa.textContent = online ? 'Menú' : 'Pausa';
  soltarControles();
  ocultarConsejo();
  if (online) {
    el.textoPausa.textContent = `Online · ${n0} ${estado.goles[0]} – ${estado.goles[1]} ${n1} · ${el.reloj.textContent}. ¡Ojo: el partido sigue corriendo!`;
  } else {
    estado.pausado = true;
    el.pantallaJuego.classList.add('juego--pausa');
    const modo = torneo ? `Mini torneo · ${nombreRonda(rondaDe(torneo).length)}` : 'Contra Petunia';
    el.textoPausa.textContent = `${modo} · Nivel ${NIVELES[estado.nivel].nombre} · ${n0} ${estado.goles[0]} – ${estado.goles[1]} ${n1} · ${el.reloj.textContent}`;
    dibujar();
  }
  abrirDialogo(el.dialogoPausa);
}

function continuar() {
  cerrarDialogo(el.dialogoAyuda);
  cerrarDialogo(el.dialogoCambios);
  cerrarDialogo(el.dialogoPausa);
  estado.pausado = false;
  el.pantallaJuego.classList.remove('juego--pausa');
  ultimoTiempo = null;
  Sonido.reanudar();
  iniciarBucle();
  el.lienzo.focus({ preventScroll: true });
}

function reiniciarPartida() {
  cerrarDialogo(el.dialogoAyuda);
  cerrarDialogo(el.dialogoPausa);
  cerrarDialogo(el.dialogoFinal);
  el.pantallaJuego.classList.remove('juego--pausa');
  nuevaPartida();
  ultimoTiempo = null;
  iniciarBucle();
  mantenerPantallaEncendida();
  el.lienzo.focus({ preventScroll: true });
  anunciar('Partido nuevo. Tres minutos, con medio tiempo y cambio de cancha; gana quien vaya ganando cuando se acabe el tiempo.');
}

function salirAlInicio() {
  torneo = null;
  cerrarDialogo(el.dialogoAyuda);
  cerrarDialogo(el.dialogoCambios);
  cerrarDialogo(el.dialogoPausa);
  cerrarDialogo(el.dialogoFinal);
  detenerBucle();
  soltarControles();
  soltarPantalla();
  ocultarPalcos();
  estado.pantalla = 'inicio';
  estado.pausado = false;
  estado.girando = false;
  el.girar.hidden = true;
  soltarAcostado();
  el.cartel.hidden = true;
  el.aviso.hidden = true;
  ocultarConsejo();
  estado.repeticion = null;
  el.repeticion.hidden = true;
  el.pantallaJuego.classList.remove('juego--pausa', 'juego--repeticion');
  el.pantallaJuego.hidden = true;
  el.pantallaTorneo.hidden = true;
  el.pantallaInicio.hidden = false;
  document.documentElement.classList.remove('jugando');
  mostrarRecords();
  el.form.querySelector('[type="submit"]').focus();
}

// Después de un partido del torneo: se sale de la cancha y se ve el cuadro
function terminarYVerTorneo() {
  const actual = torneo;
  salirAlInicio();
  torneo = actual;
  mostrarPantallaTorneo();
}

// ---- Ventana de cambios ----
// Dos listas con botones de opción: quién sale (los de campo que están
// jugando) y quién entra (los del banco). Cada uno con su energía.
function abrirCambios() {
  if (estado.pantalla !== 'juego' || estado.fase === 'final') return;
  llenarCambios();
  el.avisoCambios.textContent = '';
  abrirDialogo(el.dialogoCambios);
}

function filaDeCambio(nombre, valor, p, extra, desactivado) {
  const item = document.createElement('li');
  const etiqueta = document.createElement('label');
  etiqueta.className = 'cambio';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = nombre;
  radio.value = String(valor);
  radio.className = 'cambio__radio';
  radio.disabled = desactivado;
  const numero = document.createElement('span');
  numero.className = 'cambio__numero';
  numero.textContent = String(p.dorsal);
  const texto = document.createElement('span');
  texto.className = 'cambio__nombre';
  texto.textContent = p.estrella ? `${p.nombre} ★` : p.nombre;
  if (extra) {
    const nota = document.createElement('span');
    nota.className = 'cambio__nota';
    nota.textContent = extra;
    texto.append(nota);
  }
  // Barra de energía: <meter> se pinta verde, amarilla o roja según el valor
  const energia = Math.round(p.energia * 100);
  const medidor = document.createElement('meter');
  medidor.className = 'cambio__energia';
  medidor.min = 0;
  medidor.max = 100;
  medidor.low = Math.round(CANSANCIO.cansado * 100);
  medidor.high = 60;
  medidor.optimum = 100;
  medidor.value = energia;
  medidor.textContent = `${energia} %`;
  medidor.setAttribute('aria-label', `Energía ${energia} %`);
  // La caja se resalta cuando su botón de opción está marcado
  const caja = document.createElement('span');
  caja.className = 'cambio__caja';
  caja.append(numero, texto, medidor);
  if (p.amarillas > 0) {
    const tarjeta = document.createElement('span');
    tarjeta.className = 'cambio__tarjeta';
    tarjeta.textContent = 'Amarilla';
    caja.append(tarjeta);
  }
  etiqueta.append(radio, caja);
  item.append(etiqueta);
  return item;
}

function llenarCambios() {
  const equipo = estado.equipos[estado.miLado];
  const sale = equipo.jugadores.filter((j) => j.rol !== 'portero' && !j.fuera);
  const banco = equipo.plantel.filter((p) => p.puesto === -1 && !p.expulsado);
  el.listaSale.replaceChildren(...sale.map((j) =>
    filaDeCambio('sale', j.indice, j.persona, { defensa: 'Defensa', medio: 'Volante', delantero: 'Delantero' }[j.rol] || '', false)));
  el.listaEntra.replaceChildren(...banco.map((p) =>
    filaDeCambio('entra', p.n, p, p.salio ? 'Ya salió' : 'Suplente', p.salio)));
  const quedan = equipo.cambios;
  let texto = quedan === 0
    ? 'Ya hiciste los 3 cambios.'
    : `Te ${quedan === 1 ? 'queda 1 cambio' : `quedan ${quedan} cambios`}. Elige quién sale y quién entra.`;
  if (estado.modo === 'online') texto += ' El partido sigue: el cambio se hace en la próxima pausa del juego.';
  const pendiente = equipo.cambioPendiente;
  if (pendiente) {
    const entra = equipo.plantel[pendiente.entra];
    const sale2 = equipo.jugadores[pendiente.puesto].persona;
    texto += ` Pendiente: entra ${nombrePersona(entra)} por ${nombrePersona(sale2)}.`;
  }
  el.textoCambios.textContent = texto;
  el.botonHacerCambio.disabled = quedan === 0;
}

function confirmarCambio() {
  const elegido = (nombre) => {
    const radio = el.formCambios.querySelector(`input[name="${nombre}"]:checked`);
    return radio ? Number(radio.value) : null;
  };
  const puesto = elegido('sale');
  const entra = elegido('entra');
  if (puesto === null || entra === null) {
    el.avisoCambios.textContent = 'Elige quién sale y quién entra.';
    return;
  }
  if (!pedirCambio(puesto, entra)) {
    el.avisoCambios.textContent = 'Ese cambio no se puede hacer.';
    return;
  }
  if (estado.modo === 'online') {
    llenarCambios();
    el.avisoCambios.textContent = 'Listo: el cambio se hace en la próxima pausa del juego.';
    return;
  }
  cerrarDialogo(el.dialogoCambios);
  dibujar();
}

function mostrarErrorUsuario() {
  el.usuarioError.hidden = false;
  el.usuario.setAttribute('aria-invalid', 'true');
  el.usuario.focus();
}

function actualizarBotonSonido() {
  el.botonSonido.setAttribute('aria-pressed', String(Sonido.activo));
  el.botonSonido.title = Sonido.activo ? 'Silenciar' : 'Activar sonido';
}

// Mantener la pantalla del celular encendida mientras se juega (si el navegador lo permite)
let bloqueoPantalla = null;
async function mantenerPantallaEncendida() {
  try {
    if ('wakeLock' in navigator && !bloqueoPantalla && !document.hidden) {
      bloqueoPantalla = await navigator.wakeLock.request('screen');
      bloqueoPantalla.addEventListener('release', () => { bloqueoPantalla = null; });
    }
  } catch (error) {
    bloqueoPantalla = null;
  }
}

function soltarPantalla() {
  if (bloqueoPantalla) {
    bloqueoPantalla.release().catch(() => {});
    bloqueoPantalla = null;
  }
}

// ---- En el celular se juega siempre acostado ----
// Al empezar se intenta poner pantalla completa y dejar el celular acostado
// (Android lo permite; el iPhone y las páginas dentro de otra página no:
// ahí queda el aviso "Gira tu celular"). Si alguien lo pone de pie mientras
// juega, el partido espera quieto hasta que lo vuelva a acostar.
const consultaDePie = window.matchMedia('(orientation: portrait)');

async function ponerAcostado() {
  if (!esTactil) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (error) {
    // No se pudo: no pasa nada, el aviso pide girarlo
  }
  revisarOrientacion();
}

function soltarAcostado() {
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  } catch (error) {
    // Nada que soltar
  }
}

function revisarOrientacion() {
  const pedirGiro = esTactil && consultaDePie.matches && estado.pantalla === 'juego';
  if (pedirGiro === estado.girando) return;
  estado.girando = pedirGiro;
  el.girar.hidden = !pedirGiro;
  const online = estado.modo === 'online';
  el.girarNota.textContent = online
    ? 'PetuGol se juega con el celular acostado. ¡Apúrate: en online el partido sigue!'
    : 'PetuGol se juega con el celular acostado. El partido te espera.';
  if (pedirGiro) {
    soltarControles();
    ocultarConsejo();
    sinEco(() => anunciar(online
      ? 'Gira tu celular: PetuGol se juega acostado. En online el partido sigue.'
      : 'Gira tu celular: PetuGol se juega acostado. El partido te espera.'));
  } else {
    ultimoTiempo = null; // al volver no hay salto de tiempo
    sinEco(() => anunciar('¡Listo! Sigue el partido.'));
  }
}


/* =====================================================================
   19. BUCLE PRINCIPAL E INICIO
   ===================================================================== */
let idCuadro = null;
let ultimoTiempo = null;

function cuadro(ahora) {
  idCuadro = requestAnimationFrame(cuadro);
  if (ultimoTiempo === null) ultimoTiempo = ahora;
  // Máximo 1/30 de segundo por paso: si el celular se demora, el juego no "salta"
  let dt = Math.min((ahora - ultimoTiempo) / 1000, 1 / 30);
  ultimoTiempo = ahora;
  // Online, visitante: el partido lo calcula el otro aparato; aquí solo se dibuja
  if (esVisitaOnline()) {
    cuadroVisita(dt, ahora);
    return;
  }
  // En online el partido no se detiene nunca (la otra persona sigue jugando)
  const online = estado.modo === 'online';
  const quieto = estado.pausado || (estado.girando && !online);
  // Cámara lenta un momento cuando entra el gol (como en la TV)
  if (estado.lenta > 0 && !quieto) {
    estado.lenta -= dt;
    if (!menosMovimiento) dt *= 0.3;
  }
  if (quieto) return; // en pausa (o esperando que giren el celular) no se calcula
  if (online && !partidoEnMarcha()) {
    // Esperando a que la otra persona entre a la cancha
    actualizarCamara(dt);
    dibujar();
    return;
  }
  if (estado.fase !== 'final') {
    leerEntradas();
    actualizar(dt);
    actualizarMando();
  }
  actualizarCamara(dt);
  dibujar();
  if (online) enviarFoto(ahora);
}

function iniciarBucle() {
  if (idCuadro === null) {
    ultimoTiempo = null;
    idCuadro = requestAnimationFrame(cuadro);
  }
}

function detenerBucle() {
  if (idCuadro !== null) cancelAnimationFrame(idCuadro);
  idCuadro = null;
}

// Camisetas de muestra del selector (con la de visitante si los colores chocan)
// y el nombre de la segunda lista según el modo
function actualizarSelector() {
  const [k0, k1] = armarKits(el.equipo1.value, el.equipo2.value, leerAtuendo());
  kitsMuestra = [k0, k1];
  pintarCamiseta(el.vistaEquipo1, k0);
  pintarCamiseta(el.vistaEquipo2, k1);
  el.notaEquipo1.textContent = k0.visita ? 'Camiseta alterna' : '';
  el.notaEquipo2.textContent = k1.visita ? 'Camiseta alterna' : '';
  // La figura de cada selección
  const figura = (codigo) => {
    const p = (PLANTELES[codigo] || []).find((x) => x[2] === 'estrella');
    return p ? `★ Figura: ${ESTRELLAS[codigo]} (${p[1]})` : '';
  };
  el.figuraEquipo1.textContent = figura(k0.codigo);
  el.figuraEquipo2.textContent = figura(k1.codigo);
  const online = valorDonde() === 'online';
  const soloTuyo = online || valorTipo() === 'torneo';
  el.atuendoTitulo1.textContent = `Tu equipo: ${k0.nombre}`;
  el.atuendoTitulo2.textContent = `Petunia: ${k1.nombre}`;
  // En online (y en el torneo) el rival no se elige aquí: solo se ve tu atuendo
  el.dialogoAtuendo.classList.toggle('dialogo--solo-uno', soloTuyo);
  // Descripción de cada muñeco para los lectores de pantalla
  [el.muneco1, el.muneco2].forEach((lienzo, lado) => {
    const k = lado ? k1 : k0;
    lienzo.setAttribute('aria-label',
      `Muñeco de ${k.nombre} con camiseta ${k.visita ? 'alterna' : 'titular'} y botines ${BOTINES[k.botinNombre]}`);
  });
  // Si hubo que cambiar una camiseta para que no se confundan, se avisa
  const cambio = soloTuyo ? [] : [k0, k1].filter((k) => k.cambiada).map((k) => k.nombre);
  el.notaAtuendo.textContent = cambio.length
    ? `Las camisetas se parecían: ${cambio.join(' y ')} ${cambio.length > 1 ? 'usan' : 'usa'} la otra para que no se confundan.`
    : '';
}

// Lo que se eligió en la ventana de atuendo
function leerAtuendo() {
  const valor = (nombre, porDefecto) => {
    const elegido = el.dialogoAtuendo.querySelector(`input[name="${nombre}"]:checked`);
    return elegido ? elegido.value : porDefecto;
  };
  return {
    camiseta: [valor('camiseta1', 'titular'), valor('camiseta2', 'titular')],
    botines: [valor('botines1', 'negro'), valor('botines2', 'negro')]
  };
}

// ---- Muñecos de muestra del atuendo ----
// Cada muñeco sigue una pequeña rutina, como en la presentación de un juego:
//   1. entra corriendo con el balón en los pies y frena en el centro,
//   2. se acomoda mirando de tres cuartos y levanta el balón con el pie,
//   3. hace dominadas: el balón sube y baja y SIEMPRE cae en el pie,
//   4. lo deja en el piso, da la vuelta despacio para mostrar el número
//      de la espalda y vuelve a mirar al frente; luego repite desde el paso 2.
// Si cambias la camiseta o los botines de ese equipo, el muñeco da un saltico
// de alegría y sigue con las dominadas.
let kitsMuestra = null;
let idMuestra = null;
const muestras = [{ inicio: 0, festejo: null, balonDesde: null }, { inicio: 0, festejo: null, balonDesde: null }];

// Cómo se mueve el pie en las dominadas (unidades del muñeco)
const PIE_DOMINADA = Object.freeze({ adelante: 2.6, extra: 2.2, alzada: 5.5 });
const RADIO_BALON_MUESTRA = 3;
const MIRADA_FRENTE = 0.78; // ángulo de "tres cuartos de frente" (0 = de frente, π/2 = de lado)

// Tiempos de la rutina (segundos)
const RUTINA = Object.freeze({
  entra: 0.9,       // corre hasta el centro
  acomoda: 0.45,    // gira hacia el frente; el balón rueda hasta su pie
  levanta: 0.35,    // con un toque lo sube
  dominada: 0.78,   // lo que dura cada dominada
  dominadas: 5,
  baja: 0.55,       // el balón cae al piso y rebota
  vuelta: 2.4,      // da la vuelta (muestra la espalda) y vuelve
  festejo: 0.85
});
const INICIO_CICLO = RUTINA.entra + RUTINA.acomoda;   // de aquí se repite
const DURACION_CICLO = RUTINA.levanta + RUTINA.dominada * RUTINA.dominadas + RUTINA.baja + RUTINA.vuelta;

// Suavizados: arrancan y terminan despacio
const suave = (x) => x * x * (3 - 2 * x);
const frenar = (x) => 1 - (1 - x) * (1 - x) * (1 - x);

// Dónde queda el pie que toca el balón (el mismo cálculo que hace dibujarMuneco)
function pieDelMuneco(mirada, adelante, alzada) {
  const perfil = Math.min(1, Math.abs(mirada.sx) * 1.15);
  const hacia = mirada.sy;
  const voltear = perfil > 0.05 && mirada.sx < 0 ? -1 : 1;
  const x = -2.6 * hacia + adelante * perfil + 1.2 * perfil;          // con la punta del botín
  const y = 2.6 * perfil * PROFUNDIDAD + adelante * hacia * PROFUNDIDAD - alzada - 1.2;
  return { x: x * voltear, y };
}

function miradaConAngulo(angulo) {
  return { sx: Math.sin(angulo), sy: Math.cos(angulo) };
}

function abrirAtuendo() {
  actualizarSelector();
  abrirDialogo(el.dialogoAtuendo);
  // Lienzos nítidos según la pantalla (el tamaño visible lo pone el CSS)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const lienzo of [el.muneco1, el.muneco2]) {
    const caja = lienzo.getBoundingClientRect();
    lienzo.width = Math.max(80, Math.round(caja.width * dpr));
    lienzo.height = Math.max(100, Math.round(caja.height * dpr));
  }
  // Los dos muñecos salen corriendo, el segundo un poquito después
  const ahora = performance.now() / 1000;
  muestras[0].inicio = ahora;
  muestras[1].inicio = ahora + 0.3;
  muestras.forEach((m) => { m.festejo = null; });
  if (idMuestra === null) idMuestra = requestAnimationFrame(animarMuestra);
}

// Al cambiar la camiseta o los botines de un equipo, su muñeco festeja.
// Si el balón estaba en el aire, cae al piso desde donde iba (no salta de golpe).
function festejarMuestra(lado) {
  const m = muestras[lado];
  const ahora = performance.now() / 1000;
  m.balonDesde = m.festejo === null ? { ...poseDeMuestra(m, ahora).balon } : m.balonDesde;
  m.festejo = ahora;
}

function animarMuestra(ahora) {
  if (!el.dialogoAtuendo.open) {
    idMuestra = null;
    return;
  }
  const t = ahora / 1000;
  if (kitsMuestra) {
    dibujarMunecoMuestra(el.muneco1, kitsMuestra[0], t, 0);
    dibujarMunecoMuestra(el.muneco2, kitsMuestra[1], t, 1);
  }
  idMuestra = requestAnimationFrame(animarMuestra);
}

// Pose del muñeco y posición del balón en un momento de la rutina.
// Todo va en unidades del muñeco, con (0, 0) en el centro del piso.
function poseDeMuestra(m, t) {
  const contacto = pieDelMuneco(miradaConAngulo(MIRADA_FRENTE), PIE_DOMINADA.adelante + PIE_DOMINADA.extra, PIE_DOMINADA.alzada);
  const enPie = { x: contacto.x, y: contacto.y - RADIO_BALON_MUESTRA - 0.6 };   // balón justo encima del pie
  // Quieto en el piso queda a un lado de los pies, para que los botines se vean
  const enPiso = { x: contacto.x + 4.2, y: 0.8 - RADIO_BALON_MUESTRA };
  const pose = {
    x: 0, angulo: MIRADA_FRENTE, corre: 0, paso: 0, toque: 0, festeja: false,
    balon: { ...enPiso }, giroBalon: 0
  };

  // Festejo: salta con los brazos arriba; el balón cae al piso y rebota un poquito
  if (m.festejo !== null) {
    const r = t - m.festejo;
    if (r < RUTINA.festejo) {
      pose.festeja = true;
      const desde = m.balonDesde || enPiso;
      const a = Math.min(1, r / 0.4);
      pose.balon.x = desde.x + (enPiso.x - desde.x) * suave(a);
      pose.balon.y = a < 1
        ? desde.y + (enPiso.y - desde.y) * a * a
        : enPiso.y - Math.max(0, Math.sin(((r - 0.4) / 0.3) * Math.PI)) * 2;
      return pose;
    }
    m.festejo = null;
    m.inicio = t - INICIO_CICLO;   // sigue levantando el balón
  }

  let r = t - m.inicio;
  if (r < 0) {
    // Todavía no sale: está fuera del lienzo, a la izquierda
    pose.x = -40;
    pose.angulo = Math.PI / 2;
    pose.balon = { x: -34, y: enPiso.y };
    return pose;
  }
  if (r < RUTINA.entra) {
    // 1. Entra corriendo con el balón adelante, rodando
    const a = r / RUTINA.entra;
    pose.x = -40 * (1 - frenar(a));
    pose.angulo = Math.PI / 2;
    pose.corre = 1 - a * 0.7;
    pose.paso = r * 13;
    const toque = 0.5 - 0.5 * Math.cos(pose.paso);
    pose.balon = { x: pose.x + 7 + toque * 2.5, y: enPiso.y };
    pose.giroBalon = pose.balon.x * 0.4;
    return pose;
  }
  r -= RUTINA.entra;
  if (r < RUTINA.acomoda) {
    // 2. Se acomoda mirando de tres cuartos; el balón rueda hasta su pie
    const a = suave(r / RUTINA.acomoda);
    pose.angulo = Math.PI / 2 + (MIRADA_FRENTE - Math.PI / 2) * a;
    pose.corre = 0.25 * (1 - a);
    pose.paso = (RUTINA.entra + r) * 9;
    pose.balon = { x: 7 + (enPiso.x - 7) * a, y: enPiso.y };
    pose.giroBalon = pose.balon.x * 0.4;
    return pose;
  }
  r = (r - RUTINA.acomoda) % DURACION_CICLO;

  if (r < RUTINA.levanta) {
    // 3a. Con un toque sube el balón desde el piso hasta el pie
    const a = r / RUTINA.levanta;
    pose.toque = Math.sin(a * Math.PI / 2);
    pose.balon = { x: enPiso.x + (enPie.x - enPiso.x) * a, y: enPiso.y + (enPie.y - enPiso.y) * frenar(a) };
    pose.giroBalon = a * 3;
    return pose;
  }
  r -= RUTINA.levanta;
  const tiempoDominadas = RUTINA.dominada * RUTINA.dominadas;
  if (r < tiempoDominadas) {
    // 3b. Dominadas: el balón hace un arco y vuelve a caer justo en el pie.
    //     El pie baja mientras el balón está arriba y sube a recibirlo.
    const f = (r % RUTINA.dominada) / RUTINA.dominada;   // 0 = toca el pie
    const altura = 4 * 9 * f * (1 - f);                   // sube hasta la cintura, no tapa la camiseta
    const cerca = Math.min(f, 1 - f) / 0.28;              // qué tan cerca está del toque
    pose.toque = cerca < 1 ? suave(1 - cerca) : 0;
    pose.balon = { x: enPie.x, y: enPie.y - altura };
    pose.giroBalon = (r / RUTINA.dominada) * 2.2;
    return pose;
  }
  r -= tiempoDominadas;
  if (r < RUTINA.baja) {
    // 4a. Lo deja caer: baja al piso y da un rebotico
    const a = r / RUTINA.baja;
    const caida = Math.min(1, a / 0.55);
    let y = enPie.y + (enPiso.y - enPie.y) * caida * caida;
    if (a > 0.55) y = enPiso.y - Math.sin(((a - 0.55) / 0.45) * Math.PI) * 2.5;
    pose.toque = Math.max(0, 1 - a * 3);
    pose.balon = { x: enPie.x + (enPiso.x - enPie.x) * Math.min(1, a * 1.5), y };
    pose.giroBalon = a * 2;
    return pose;
  }
  r -= RUTINA.baja;
  // 4b. Da la vuelta: gira hasta quedar de espaldas, se queda un momento y vuelve,
  //     dando pasitos en el puesto
  const a = r / RUTINA.vuelta;
  let giro;
  if (a < 0.35) giro = suave(a / 0.35) * 0.5;
  else if (a < 0.65) giro = 0.5;
  else giro = 0.5 + suave((a - 0.65) / 0.35) * 0.5;
  pose.angulo = MIRADA_FRENTE + giro * VUELTA;
  const girando = a < 0.35 || a > 0.65;
  pose.corre = girando ? 0.22 : 0;
  pose.paso = girando ? r * 10 : 0;
  return pose;
}

function dibujarMunecoMuestra(lienzo, kit, t, lado) {
  const c = lienzo.getContext('2d');
  const w = lienzo.width;
  const h = lienzo.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  const unidad = h / 56;                         // píxeles por unidad del muñeco
  const pisoY = h * 0.9;
  const cx = w / 2;

  // Piso: un círculo de césped
  c.fillStyle = COLOR['cesped-claro'];
  c.beginPath();
  c.ellipse(cx, pisoY, w * 0.42, h * 0.075, 0, 0, VUELTA);
  c.fill();

  // Con "reducir movimiento" queda quieto, de tres cuartos y con el balón en el piso
  const pose = menosMovimiento
    ? { x: 0, angulo: MIRADA_FRENTE, corre: 0, paso: 0, toque: 0, festeja: false,
      balon: { x: pieDelMuneco(miradaConAngulo(MIRADA_FRENTE), PIE_DOMINADA.adelante + PIE_DOMINADA.extra, 0).x + 4.2, y: 0.8 - RADIO_BALON_MUESTRA }, giroBalon: 0 }
    : poseDeMuestra(muestras[lado], t);

  const x = cx + pose.x * unidad;
  // Sombras del muñeco y del balón (la del balón se achica cuando sube)
  c.fillStyle = COLOR.sombra;
  c.beginPath();
  c.ellipse(x, pisoY, 5.5 * unidad, 1.7 * unidad, 0, 0, VUELTA);
  c.fill();
  const alturaBalon = Math.max(0, (0.8 - RADIO_BALON_MUESTRA) - pose.balon.y);
  const sombra = Math.max(0.35, 1 - alturaBalon / 22);
  c.beginPath();
  c.ellipse(cx + pose.balon.x * unidad, pisoY + 0.9 * unidad, 3 * unidad * sombra, 1 * unidad * sombra, 0, 0, VUELTA);
  c.fill();

  const op = {
    escala: unidad / (vista.s * TALLA),
    mirada: miradaConAngulo(pose.angulo),
    paso: pose.paso,
    corriendo: pose.corre,
    tiempo: t,
    semilla: lado,
    festeja: pose.festeja,
    alturaSalto: 4.5,          // saltico más bajito para que no se salga del cuadro
    camiseta: kit.camiseta,
    borde: kit.borde,
    detalle: kit.detalle,
    acento: kit.acento,
    patron: kit.patron,
    numero: 10,
    colorNumero: kit.numero,
    pantaloneta: kit.pantaloneta,
    medias: kit.medias,
    piel: COLOR[lado ? 'piel-3' : 'piel-2'],
    botines: kit.botines
  };
  // En las dominadas manda el pie que toca el balón
  if (!pose.festeja && pose.corre === 0 && Math.abs(pose.angulo - MIRADA_FRENTE) < 0.01) op.toque = pose.toque;

  const bx = cx + pose.balon.x * unidad;
  const by = pisoY + pose.balon.y * unidad;
  const radio = RADIO_BALON_MUESTRA * unidad;
  dibujarEn(c, () => {
    dibujarMuneco(x, pisoY, op);
    pintarBalon(c, bx, by, radio, pose.giroBalon);
  });
}

// ---- Balón con luz y sombra ----
// Se pinta igual en el juego (desde una tira de dibujos ya hechos) y en el atuendo
function pintarBalon(c, x, y, r, giro) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, VUELTA);
  c.fillStyle = COLOR.balon;
  c.fill();
  c.clip();
  c.fillStyle = COLOR['balon-parche'];
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const angulo = giro + i * (VUELTA / 5);
    const qx = x + Math.cos(angulo) * r * 0.42;
    const qy = y + Math.sin(angulo) * r * 0.42;
    if (i === 0) c.moveTo(qx, qy);
    else c.lineTo(qx, qy);
  }
  c.closePath();
  c.fill();
  for (let i = 0; i < 5; i++) {
    const angulo = giro + Math.PI / 5 + i * (VUELTA / 5);
    c.beginPath();
    c.arc(x + Math.cos(angulo) * r * 0.95, y + Math.sin(angulo) * r * 0.95, r * 0.28, 0, VUELTA);
    c.fill();
  }
  // Luz de arriba a la izquierda y sombra abajo a la derecha (la luz no gira con el balón)
  const luz = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.05);
  luz.addColorStop(0, COLOR['balon-brillo']);
  luz.addColorStop(0.45, COLOR['balon-brillo-apagado']);
  luz.addColorStop(1, COLOR['balon-sombra']);
  c.fillStyle = luz;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
  c.beginPath();
  c.arc(x, y, r, 0, VUELTA);
  c.lineWidth = Math.max(1, r * 0.12);
  c.strokeStyle = COLOR['balon-parche'];
  c.stroke();
}

// Tira con el balón ya dibujado en 12 posiciones de giro (el dibujo se repite
// cada quinta parte de vuelta). En cada cuadro solo se copia uno: no cuesta nada.
const CUADROS_BALON = 12;
const hojasBalon = new Map();

function hojaBalon(r) {
  const clave = Math.round(r * 4);
  let hoja = hojasBalon.get(clave);
  if (!hoja) {
    const lado = Math.ceil(r * 2 + 4);
    const lienzo = document.createElement('canvas');
    lienzo.width = lado * CUADROS_BALON;
    lienzo.height = lado;
    const c = lienzo.getContext('2d');
    for (let i = 0; i < CUADROS_BALON; i++) {
      pintarBalon(c, i * lado + lado / 2, lado / 2, r, (i / CUADROS_BALON) * (VUELTA / 5));
    }
    hoja = { lado, lienzo };
    if (hojasBalon.size > 8) hojasBalon.clear();
    hojasBalon.set(clave, hoja);
  }
  return hoja;
}

// ¿Normal (en este aparato) u Online (salas)?
function valorDonde() {
  const elegido = el.form.querySelector('input[name="donde"]:checked');
  return elegido ? elegido.value : 'normal';
}

function valorTipo() {
  const elegido = el.form.querySelector('input[name="tipo"]:checked');
  return elegido ? elegido.value : 'partido';
}

// Muestra solo los campos que sirven: en online no hay tipo, rival ni nivel,
// pero sí el código de la sala y los botones Crear sala y Unirme. En el
// mini torneo no se elige rival (salen del sorteo).
function actualizarDonde() {
  const online = valorDonde() === 'online';
  const torneoNormal = !online && valorTipo() === 'torneo';
  el.campoModo.hidden = online;
  el.campoNivel.hidden = online;
  el.campoCodigo.hidden = !online;
  el.botonComenzar.hidden = online;
  el.botonComenzar.textContent = torneoNormal ? 'Empezar el torneo' : 'Comenzar';
  el.botonCrearSala.hidden = !online;
  el.botonUnirse.hidden = !online;
  el.campoDuelo.classList.toggle('duelo--solo', online || torneoNormal);
  el.tituloDuelo.textContent = online || torneoNormal ? 'Tu selección' : 'Selecciones';
  el.form.classList.toggle('formulario--online', online);
  if (!online) el.avisoOnline.hidden = true;
}

function mostrarErrorCodigo() {
  el.codigoError.hidden = false;
  el.codigoSala.setAttribute('aria-invalid', 'true');
  el.codigoSala.focus();
}

function prepararFormulario() {
  // Siempre empieza vacío y con las opciones de fábrica (no se recuerda nada)
  borrarDatosViejos();
  el.form.reset();
  el.usuario.value = '';
  el.codigoSala.value = '';

  // Listas de selecciones (salen de EQUIPOS) y la última elección
  for (const lista of [el.equipo1, el.equipo2, el.equipoSala]) {
    lista.replaceChildren(...EQUIPOS.map((equipo) => new Option(equipo.nombre, equipo.codigo)));
  }
  el.equipo1.value = 'COL';
  el.equipo2.value = 'BRA';

  // Si llegaste con el enlace de una sala (…?sala=ABCDE), ya queda listo para unirte
  let desdeEnlace = '';
  try {
    desdeEnlace = limpiarCodigo(new URLSearchParams(location.search).get('sala'));
  } catch (error) {
    desdeEnlace = '';
  }
  if (desdeEnlace.length === 5) {
    el.form.querySelector('input[name="donde"][value="online"]').checked = true;
    el.codigoSala.value = desdeEnlace;
  }
  actualizarDonde();
  actualizarSelector();

  el.form.addEventListener('change', (evento) => {
    if (evento.target.name === 'tipo' || evento.target.name === 'donde') actualizarDonde();
    actualizarSelector();
  });
  el.codigoSala.addEventListener('input', () => {
    const limpio = limpiarCodigo(el.codigoSala.value);
    if (limpio !== el.codigoSala.value) el.codigoSala.value = limpio;
    el.codigoError.hidden = true;
    el.codigoSala.removeAttribute('aria-invalid');
  });

  // Mensaje propio cuando falta el usuario (en vez de la burbuja del navegador)
  el.usuario.addEventListener('invalid', (evento) => {
    evento.preventDefault();
    mostrarErrorUsuario();
  });
  el.usuario.addEventListener('input', () => {
    if (el.usuario.validity.valid) {
      el.usuarioError.hidden = true;
      el.usuario.removeAttribute('aria-invalid');
    }
  });

  el.form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!el.usuario.value.trim()) {
      mostrarErrorUsuario();
      return;
    }
    Sonido.desbloquear(); // dentro del toque: así suena en celular
    if (valorDonde() !== 'online') {
      comenzar();
      return;
    }
    // Online: "Crear sala" o "Unirme". Con Enter (sin tocar un botón) se une
    // si escribiste un código y, si no, crea la sala.
    const codigo = limpiarCodigo(el.codigoSala.value);
    let accion = evento.submitter ? evento.submitter.value : '';
    if (accion !== 'crear' && accion !== 'unirse') accion = codigo ? 'unirse' : 'crear';
    if (accion === 'unirse') {
      if (codigo.length !== 5) {
        mostrarErrorCodigo();
        return;
      }
      entrarOnline(codigo);
    } else {
      entrarOnline(null);
    }
  });
}

function prepararEventos() {
  // Teclado
  window.addEventListener('keydown', alPresionarTecla);
  window.addEventListener('keyup', alSoltarTecla);
  window.addEventListener('blur', soltarControles);

  // Dedo, ratón y lápiz (joystick flotante)
  el.lienzo.addEventListener('pointerdown', alTocar);
  el.lienzo.addEventListener('pointermove', alMoverPuntero);
  el.lienzo.addEventListener('pointerup', alSoltarPuntero);
  el.lienzo.addEventListener('pointercancel', alSoltarPuntero);
  el.lienzo.addEventListener('contextmenu', (evento) => evento.preventDefault());

  // Cualquier toque o tecla reanuda el audio si el celular lo suspendió
  document.addEventListener('pointerdown', () => Sonido.reanudar(), { passive: true });
  document.addEventListener('keydown', () => Sonido.reanudar());

  // Botones del marcador
  el.botonMenu.addEventListener('click', abrirPausa);
  el.botonSonido.addEventListener('click', () => {
    if (!Sonido.ctx) Sonido.desbloquear();
    Sonido.cambiar(!Sonido.activo);
    actualizarBotonSonido();
  });

  // Menú de pausa
  el.botonContinuar.addEventListener('click', continuar);
  el.botonReiniciar.addEventListener('click', reiniciarPartida);
  el.botonSalir.addEventListener('click', salirAlInicio);
  el.dialogoPausa.addEventListener('cancel', (evento) => {
    evento.preventDefault(); // Esc = Continuar
    continuar();
  });

  // Atuendo: camiseta y botines con su muñeco de muestra
  el.botonAtuendo.addEventListener('click', abrirAtuendo);
  el.dialogoAtuendo.addEventListener('change', (evento) => {
    actualizarSelector();
    const nombre = evento.target.name || '';
    if (nombre.endsWith('1')) festejarMuestra(0);
    else if (nombre.endsWith('2')) festejarMuestra(1);
  });

  // Cómo jugar (se abre desde el inicio o desde la pausa)
  document.querySelectorAll('[data-abre]').forEach((boton) => {
    boton.addEventListener('click', () => abrirDialogo($(boton.dataset.abre)));
  });
  document.querySelectorAll('[data-cierra]').forEach((boton) => {
    boton.addEventListener('click', () => cerrarDialogo($(boton.dataset.cierra)));
  });

  // Pantalla final (en online, "Volver a la sala")
  const despuesDelFinal = () => {
    if (estado.modo === 'online') volverALaSala();
    else if (torneo) terminarYVerTorneo();
    else salirAlInicio();
  };
  el.botonRevancha.addEventListener('click', reiniciarPartida);
  el.botonOtroRival.addEventListener('click', jugarOtroRival);

  // Mini torneo en Normal
  el.botonJugarTorneo.addEventListener('click', jugarPartidoDelTorneo);
  el.botonSalirTorneo.addEventListener('click', salirAlInicio);

  // Cambios de jugadores (desde el menú)
  el.botonCambios.addEventListener('click', abrirCambios);
  el.formCambios.addEventListener('submit', (evento) => {
    evento.preventDefault();
    confirmarCambio();
  });
  el.formCambios.addEventListener('change', () => { el.avisoCambios.textContent = ''; });
  el.botonInicioFinal.addEventListener('click', despuesDelFinal);
  el.dialogoFinal.addEventListener('cancel', (evento) => {
    evento.preventDefault(); // Esc = volver al inicio (o a la sala)
    despuesDelFinal();
  });

  // Online: abandonar desde el menú
  el.botonAbandonar.addEventListener('click', () => {
    cerrarDialogo(el.dialogoPausa);
    terminarPartidoOnline('meVoy');
  });

  // Online: la sala
  el.botonSalirSala.addEventListener('click', () => salirDeSala(''));
  el.botonCopiar.addEventListener('click', compartirSala);
  el.botonEmpezarSala.addEventListener('click', empezarCompetencia);
  el.panelOrganizar.addEventListener('change', () => {
    el.errorOrganizar.hidden = true;
    actualizarOrganizar(red.sala, false);
  });
  el.equipoSala.addEventListener('change', () => {
    red.seleccion = buscarEquipo(el.equipoSala.value).codigo;
    alDueno({ t: 'equipo', codigo: red.seleccion });
  });

  // Online: ¡te toca! (entra con el botón, con Esc o sola al terminar la cuenta)
  el.botonEntrar.addEventListener('click', entrarAlPartido);
  el.dialogoTeToca.addEventListener('cancel', (evento) => {
    evento.preventDefault();
    entrarAlPartido();
  });

  // Si cierras la página estando en una sala, los demás se enteran enseguida
  window.addEventListener('pagehide', () => {
    if (!red.peer) return;
    const p = red.partido;
    if (p && !p.terminado) enviarAlRival({ t: 'abandono' });
    if (red.soyDueno) aTodos({ t: 'cerrada' });
    else if (red.conexionSala && red.conexionSala.open) enviarPor(red.conexionSala, { t: 'chao' });
  });

  // Si cambias de app o de pestaña, el partido se pausa solo
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (estado.pantalla === 'juego' && estado.fase !== 'final' && estado.modo !== 'online') abrirPausa();
    } else {
      Sonido.reanudar();
      if (estado.pantalla === 'juego' && estado.fase !== 'final') mantenerPantallaEncendida();
    }
  });

  // Al girar el celular o cambiar el tamaño de la ventana: se mide y se repinta el estadio
  const alCambiarTamano = () => {
    if (estado.pantalla === 'juego' && medirCancha()) dibujar();
  };
  if ('ResizeObserver' in window) new ResizeObserver(alCambiarTamano).observe(el.estadio);
  else window.addEventListener('resize', alCambiarTamano);
  // Celular de pie o acostado
  if (consultaDePie.addEventListener) consultaDePie.addEventListener('change', revisarOrientacion);
  else if (consultaDePie.addListener) consultaDePie.addListener(revisarOrientacion);

  // Cuando llega la fuente Bungee, se repinta el estadio (las vallas usan esa letra)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (estado.pantalla === 'juego' && vista.listo) {
        pintarFondo();
        dibujar();
      }
    });
  }
}

function iniciar() {
  leerColores();
  estado.kits = armarKits(estado.codigos[0], estado.codigos[1]);
  crearAficion();
  // Íconos de la ayuda, tomados de la misma lista de poderes
  document.querySelectorAll('[data-poder]').forEach((espacio) => {
    const poder = PODERES[espacio.dataset.poder];
    if (poder) espacio.append(crearIcono(poder.icono));
  });
  prepararFormulario();
  prepararEventos();
  prepararMando();
  mostrarRecords();
  actualizarBotonSonido();
}


/* =====================================================================
   20. ONLINE: SALAS, PARTIDOS Y MINI TORNEOS
   Cada persona juega desde su propio aparato. Para conectarlos se usa
   PeerJS (una biblioteca gratuita): los aparatos se encuentran con un
   servidor público de PeerJS y después se hablan directamente entre ellos
   (WebRTC). No hace falta crear cuentas ni tener un servidor propio, así
   que funciona igual cuando el juego se sube a GitHub Pages.

   - Quien crea la sala es el "dueño": recibe un código de 5 letras, lleva
     la lista de jugadores, arma el torneo y anota los resultados.
   - En cada partido, el aparato del equipo local "lleva" el partido: hace
     todos los cálculos y le manda a la otra persona, unas 30 veces por
     segundo, una "foto" de dónde está cada jugador y el balón. La otra
     persona (el visitante) manda sus botones y su joystick.
   - El visitante ve la cancha dada vuelta: así cada quien ve a su equipo
     atacando hacia la derecha.
   - Nada se guarda: al cerrar la página, la sala desaparece.
   ===================================================================== */
const VERSION_RED = 3;                 // si cambia la forma de los mensajes, se sube
const MAXIMO_SALA = 8;
const PREFIJO_SALA = 'petugol-sala-';
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O (se confunden con 1 y 0)
const FUENTES_PEERJS = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
];
const CADA_FOTO = 33;            // milisegundos entre fotos del partido (unas 30 por segundo)
const RETRASO_VISITA = 100;      // el visitante dibuja 0,1 s atrás: así siempre tiene dos fotos para mezclar
const SEGUNDOS_TE_TOCA = 8;      // cuenta regresiva antes de entrar a la cancha
const SILENCIO_MAXIMO = 15000;   // milisegundos sin noticias de alguien = se fue
const ESPERA_RIVAL = 35000;      // milisegundos para que la otra persona entre a la cancha
const PAUSA_ENTRE_RONDAS = 6000; // para ver el resultado antes de la siguiente ronda
const DATOS_FOTO = 11;           // números por jugador en cada foto
const TIPOS_EFECTO = Object.freeze(['mini', 'turbo', 'zigzag', 'multi', 'gigante', 'hielo']);
const TIPOS_PODER = Object.freeze(Object.keys(PODERES));

const red = {
  peer: null,
  miId: null,
  soyDueno: false,
  duenoId: null,
  codigo: '',
  nombre: '',
  seleccion: 'COL',
  atuendo: { camiseta: 'titular', botines: 'negro' },
  conexionSala: null,       // (invitados) la conexión con el dueño de la sala
  conexiones: new Map(),    // (dueño) id → conexión de cada invitado
  jugadores: [],            // (dueño) quiénes están en la sala
  competencia: null,        // (dueño) el torneo o el amistoso
  numeroCompetencia: 0,
  sala: null,               // lo último que se sabe de la sala (para dibujarla)
  partido: null,            // el partido que estás jugando
  directas: new Map(),      // conexiones directas que llegaron antes de saber del partido
  ultimoDueno: 0,           // (invitados) última noticia del dueño
  salaCerrada: false,
  saliendo: false,
  campeonVisto: null,
  relojes: { latido: null, cuenta: null, ronda: null, publicar: null }
};

// ---- Utilidades ----
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

function esVisitaOnline() {
  return estado.modo === 'online' && estado.miLado === 1 && red.partido !== null;
}

function partidoEnMarcha() {
  return Boolean(red.partido && red.partido.empezado && !red.partido.terminado);
}

function codigoNuevo() {
  let codigo = '';
  for (let i = 0; i < 5; i++) codigo += LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)];
  return codigo;
}

// El código de la sala: solo letras, en mayúscula, máximo 5
function limpiarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
}

function limpiarNombre(texto) {
  const nombre = String(texto || '').trim().slice(0, 14);
  return nombre || 'Jugador';
}

function limpiarAtuendo(atuendo) {
  const a = atuendo || {};
  return {
    camiseta: a.camiseta === 'alterna' ? 'alterna' : 'titular',
    botines: BOTINES[a.botines] ? a.botines : 'negro'
  };
}

function nombreSeleccion(codigo) {
  return buscarEquipo(codigo).nombre;
}

// Nombre de cada ronda según cuántos partidos tiene
function nombreRonda(partidos) {
  if (partidos === 1) return 'Final';
  if (partidos === 2) return 'Semifinal';
  if (partidos === 4) return 'Cuartos de final';
  return 'Octavos de final';
}

function textoDeError(error) {
  const tipo = error && error.type;
  if (tipo === 'browser-incompatible') return 'Este navegador no permite jugar online. Prueba con Chrome, Edge, Firefox o Safari actualizados.';
  if (tipo === 'tiempo') return 'La conexión se demoró demasiado. Revisa tu internet e intenta otra vez.';
  if (tipo === 'sin-peerjs') return 'No se pudo cargar la conexión online. Revisa tu internet (el modo Normal sí funciona sin internet).';
  return 'No se pudo conectar con el servicio de salas. Revisa tu internet e intenta otra vez.';
}

// ---- Eco: lo que pasa en el partido también pasa en la pantalla del visitante ----
// Los carteles, sonidos, chispas y temblores se anotan aquí y viajan con la
// siguiente foto. Solo hace eco el aparato que lleva el partido.
let ecoApagado = 0;

function eco(...evento) {
  if (ecoApagado > 0 || estado.modo !== 'online') return;
  const p = red.partido;
  if (!p || !p.soyLocal || !p.empezado || p.terminado) return;
  p.eventos.push(evento);
}

// Hace algo sin que se repita en la otra pantalla (por ejemplo, los consejos)
function sinEco(hacer) {
  ecoApagado++;
  try {
    return hacer();
  } finally {
    ecoApagado--;
  }
}

// Los sonidos del partido también suenan en el aparato de la otra persona.
// Si un sonido usa otro por dentro (el de balón trabado usa el silbato),
// solo viaja el de afuera.
for (const nombre of ['patada', 'toque', 'lanzamiento', 'cambio', 'robo', 'barrida', 'atajada', 'rebote', 'pique', 'palo',
  'silbato', 'silbatoCorto', 'pitido', 'aplausos', 'fiesta', 'suspenso', 'risita', 'carcajada', 'poder', 'escudoRoto',
  'ola', 'trabado']) {
  const original = Sonido[nombre];
  Sonido[nombre] = function (...datos) {
    eco('sonido', nombre, datos);
    return sinEco(() => original.apply(Sonido, datos));
  };
}

// El visitante repite lo que pasó en el aparato que lleva el partido
function aplicarEvento([tipo, ...d]) {
  switch (tipo) {
    case 'sonido':
      if (typeof Sonido[d[0]] === 'function') Sonido[d[0]](...(d[1] || []));
      break;
    case 'chispas': chispas(...d); break;
    case 'serpentinas': serpentinas(d[0]); break;
    case 'temblar': temblar(d[0], d[1]); break;
    case 'letrero': letrero(...d); break;
    case 'onda': if (!menosMovimiento) estado.ondas.push({ x: d[0], y: d[1], t: 0 }); break;
    case 'ola': iniciarOla(d[0]); break;
    case 'cartel': mostrarCartel(d[0], d[1], d[2]); break;
    case 'aviso': mostrarAviso(d[0], d[1], d[2] || undefined, Boolean(d[3])); break;
    case 'anunciar': anunciar(d[0]); break;
    case 'palco': mostrarPalco(d[0], d[1]); break;
    case 'sinPalcos': ocultarPalcos(); break;
    case 'marcador': actualizarMarcador(d[0]); break;
    case 'red': estado.red = { lado: d[0], y: d[1], z: d[2], t: 0 }; break;
    case 'marca': estado.marcas[d[0]] = d[1]; break;
    case 'cancha':
      estado.canchaCambiada = Boolean(d[0]);
      aplicarGiro();
      break;
    default: break;
  }
}

// ---- PeerJS: se carga solo cuando alguien elige Online ----
let promesaPeerJS = null;

function cargarPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (promesaPeerJS) return promesaPeerJS;
  promesaPeerJS = new Promise((resolver, rechazar) => {
    const probar = (i) => {
      if (i >= FUENTES_PEERJS.length) {
        promesaPeerJS = null;
        rechazar({ type: 'sin-peerjs' });
        return;
      }
      const script = document.createElement('script');
      script.src = FUENTES_PEERJS[i];
      script.async = true;
      script.onload = () => (window.Peer ? resolver() : probar(i + 1));
      script.onerror = () => {
        script.remove();
        probar(i + 1); // si un sitio falla, se prueba el otro
      };
      document.head.append(script);
    };
    probar(0);
  });
  return promesaPeerJS;
}

// Abre la conexión con el servidor de PeerJS. Con "id" se pide ese nombre
// (el de la sala); sin "id", PeerJS inventa uno.
function abrirPeer(id) {
  return new Promise((resolver, rechazar) => {
    if (!window.RTCPeerConnection) {
      rechazar({ type: 'browser-incompatible' });
      return;
    }
    // Para probar con un servidor PeerJS propio se puede definir antes
    // window.PETUGOL_SERVIDOR = { host, port, path, secure }. Si no, se usa el gratuito.
    const opciones = Object.assign({ debug: 0 }, window.PETUGOL_SERVIDOR || {});
    let peer;
    try {
      peer = id ? new window.Peer(id, opciones) : new window.Peer(opciones);
    } catch (error) {
      rechazar(error);
      return;
    }
    const reloj = setTimeout(() => fallo({ type: 'tiempo' }), 15000);
    function limpiar() {
      clearTimeout(reloj);
      peer.off('open', listo);
      peer.off('error', fallo);
    }
    function listo() {
      limpiar();
      resolver(peer);
    }
    function fallo(error) {
      limpiar();
      peer.destroy();
      rechazar(error);
    }
    peer.on('open', listo);
    peer.on('error', fallo);
  });
}

function prepararPeer(peer) {
  red.peer = peer;
  red.miId = peer.id;
  red.saliendo = false;
  red.salaCerrada = false;
  peer.on('connection', alLlegarConexion);
  // Si se cae la conexión con el servidor (pero no con los demás), se reconecta
  peer.on('disconnected', () => {
    if (!red.saliendo && red.peer === peer && !peer.destroyed) {
      try { peer.reconnect(); } catch (error) { /* se intentará con el siguiente latido */ }
    }
  });
  peer.on('error', () => { /* cada conexión maneja sus propios errores */ });
  clearInterval(red.relojes.latido);
  red.relojes.latido = setInterval(latir, 1000);
}

// ---- Entrar al modo online desde el inicio ----
function entrarOnline(codigo) {
  const atuendo = leerAtuendo();
  red.nombre = limpiarNombre(el.usuario.value);
  red.seleccion = buscarEquipo(el.equipo1.value).codigo;
  red.atuendo = limpiarAtuendo({ camiseta: atuendo.camiseta[0], botines: atuendo.botines[0] });
  el.avisoOnline.hidden = true;
  if (codigo) unirseASala(codigo);
  else crearSala();
}

async function crearSala() {
  mostrarPantallaSala();
  ponerEstadoSala('Creando la sala…');
  try {
    await cargarPeerJS();
  } catch (error) {
    falloOnline(textoDeError(error));
    return;
  }
  for (let intento = 0; intento < 4; intento++) {
    const codigo = codigoNuevo();
    try {
      const peer = await abrirPeer(PREFIJO_SALA + codigo);
      if (red.saliendo) {
        peer.destroy();
        return;
      }
      red.soyDueno = true;
      red.codigo = codigo;
      prepararPeer(peer);
      red.duenoId = peer.id;
      red.jugadores = [{ id: peer.id, nombre: red.nombre, codigo: red.seleccion, atuendo: red.atuendo, ultimo: Date.now() }];
      red.competencia = null;
      publicarSala();
      Sonido.silbatoCorto();
      anunciar(`Sala creada. El código es ${codigo.split('').join(' ')}.`);
      return;
    } catch (error) {
      if (red.saliendo) return;
      if (error && error.type === 'unavailable-id') continue; // ese código ya existe: se prueba otro
      falloOnline(textoDeError(error));
      return;
    }
  }
  falloOnline('No se pudo crear la sala. Intenta otra vez.');
}

async function unirseASala(codigo) {
  mostrarPantallaSala();
  red.codigo = codigo;
  el.codigoVisible.textContent = codigo;
  ponerEstadoSala(`Buscando la sala ${codigo}…`);
  try {
    await cargarPeerJS();
  } catch (error) {
    falloOnline(textoDeError(error));
    return;
  }
  let peer;
  try {
    peer = await abrirPeer(null);
  } catch (error) {
    if (!red.saliendo) falloOnline(textoDeError(error));
    return;
  }
  if (red.saliendo) {
    peer.destroy();
    return;
  }
  red.soyDueno = false;
  prepararPeer(peer);
  const conexion = peer.connect(PREFIJO_SALA + codigo, { metadata: { tipo: 'sala' }, serialization: 'json', reliable: true });
  red.conexionSala = conexion;
  red.ultimoDueno = Date.now();
  const noExiste = () => {
    if (!red.sala && red.conexionSala === conexion) falloOnline(`No encontramos la sala ${codigo}. Revisa el código (o pide uno nuevo).`);
  };
  const reloj = setTimeout(noExiste, 15000);
  // Si la sala no existe, PeerJS avisa con un error "peer-unavailable"
  peer.on('error', (error) => {
    if (error && error.type === 'peer-unavailable' && String(error.message || '').includes(PREFIJO_SALA + codigo)) {
      clearTimeout(reloj);
      noExiste();
    }
  });
  conexion.on('open', () => {
    conexion.send({ t: 'hola', v: VERSION_RED, nombre: red.nombre, codigo: red.seleccion, atuendo: red.atuendo });
  });
  conexion.on('data', (mensaje) => {
    clearTimeout(reloj);
    red.ultimoDueno = Date.now();
    recibirDeSala(mensaje);
  });
  conexion.on('close', () => {
    if (red.conexionSala === conexion) salaPerdida('Se cerró la sala (o se perdió la conexión con quien la creó).');
  });
  conexion.on('error', () => { /* el cierre se maneja arriba */ });
}

// ---- Conexiones que llegan: invitados (si eres el dueño) y partidos directos ----
function alLlegarConexion(conexion) {
  const datos = conexion.metadata || {};
  if (datos.tipo === 'sala' && red.soyDueno) {
    conexion.on('data', (mensaje) => recibirComoDueno(conexion.peer, mensaje, conexion));
    conexion.on('close', () => {
      if (red.conexiones.get(conexion.peer) === conexion) seFueInvitado(conexion.peer);
    });
    conexion.on('error', () => { /* el cierre se maneja arriba */ });
    return;
  }
  if (datos.tipo === 'partido') {
    // El visitante llama directo al local (más rápido que pasar por el dueño)
    conexion.on('open', () => {
      if (red.partido && red.partido.id === datos.partido) red.partido.directa = conexion;
      else red.directas.set(datos.partido, conexion);
    });
    conexion.on('data', recibirSobre);
    conexion.on('close', () => {
      if (red.partido && red.partido.directa === conexion) red.partido.directa = null;
      if (red.directas.get(datos.partido) === conexion) red.directas.delete(datos.partido);
    });
    conexion.on('error', () => { /* sin conexión directa se sigue por la sala */ });
    return;
  }
  conexion.close();
}

// ---- Envío de mensajes ----
// Al dueño de la sala (si eres tú mismo, se atiende aquí)
function alDueno(mensaje) {
  if (red.soyDueno) recibirComoDueno(red.miId, mensaje, null);
  else if (red.conexionSala && red.conexionSala.open) enviarPor(red.conexionSala, mensaje);
}

// Del dueño a un jugador (si es el mismo dueño, se atiende aquí)
function aJugador(id, mensaje) {
  if (id === red.miId) recibirDeSala(mensaje);
  else enviarPor(red.conexiones.get(id), mensaje);
}

function enviarPor(conexion, mensaje) {
  if (!conexion || !conexion.open) return;
  try {
    conexion.send(mensaje);
  } catch (error) {
    // Si la conexión se está cerrando, el mensaje se pierde: el latido lo notará
  }
}

function aTodos(mensaje) {
  for (const conexion of red.conexiones.values()) enviarPor(conexion, mensaje);
}

// A la otra persona del partido: directo si se pudo; si no, a través del dueño
function enviarAlRival(datos) {
  const p = red.partido;
  if (!p) return;
  const sobre = { t: 'p', partido: p.id, para: p.rivalId, d: datos };
  if (p.directa && p.directa.open) {
    enviarPor(p.directa, sobre);
    return;
  }
  if (red.soyDueno) aJugador(p.rivalId, sobre);
  else if (red.conexionSala && red.conexionSala.open) enviarPor(red.conexionSala, sobre); // el dueño lo reenvía
}

// ---- Latido: cada segundo se revisa que todos sigan ahí ----
function latir() {
  const ahora = Date.now();
  if (red.soyDueno) {
    aTodos({ t: 'latido' });
    for (const jugador of red.jugadores.slice()) {
      if (jugador.id !== red.miId && ahora - jugador.ultimo > SILENCIO_MAXIMO) seFueInvitado(jugador.id);
    }
  } else if (red.conexionSala && red.conexionSala.open) {
    enviarPor(red.conexionSala, { t: 'latido' });
    if (!red.salaCerrada && ahora - red.ultimoDueno > SILENCIO_MAXIMO) {
      salaPerdida('Se perdió la conexión con la sala.');
    }
  }
  const p = red.partido;
  if (p && !p.terminado) {
    enviarAlRival({ t: 'latido' });
    if (p.yoListo) {
      // Si la otra persona no entra a la cancha o deja de responder, ganas tú
      const sinNoticias = ahora - p.ultimoRival > SILENCIO_MAXIMO;
      const noLlego = !p.empezado && ahora > p.limiteEspera;
      if (sinNoticias || noLlego) terminarPartidoOnline('abandono');
    } else if (ahora - p.ultimoRival > ESPERA_RIVAL) {
      terminarPartidoOnline('abandono');
    }
  }
}

// ---- El dueño: atiende a los invitados ----
function recibirComoDueno(id, mensaje, conexion) {
  if (!mensaje || typeof mensaje !== 'object') return;
  const jugador = red.jugadores.find((j) => j.id === id);
  if (jugador) jugador.ultimo = Date.now();
  switch (mensaje.t) {
    case 'hola': {
      if (!conexion || jugador) return;
      if (mensaje.v !== VERSION_RED) {
        enviarPor(conexion, { t: 'rechazo', motivo: 'version' });
        setTimeout(() => conexion.close(), 600);
        return;
      }
      if (red.jugadores.length >= MAXIMO_SALA) {
        enviarPor(conexion, { t: 'rechazo', motivo: 'llena' });
        setTimeout(() => conexion.close(), 600);
        return;
      }
      red.conexiones.set(id, conexion);
      red.jugadores.push({
        id,
        nombre: limpiarNombre(mensaje.nombre),
        codigo: buscarEquipo(mensaje.codigo).codigo,
        atuendo: limpiarAtuendo(mensaje.atuendo),
        ultimo: Date.now()
      });
      Sonido.toque();
      publicarSala();
      break;
    }
    case 'equipo':
      if (jugador) {
        jugador.codigo = buscarEquipo(mensaje.codigo).codigo;
        if (red.competencia) red.competencia.equipos[id] = jugador.codigo;
        publicarSala();
      }
      break;
    case 'p':
      // Mensaje de partido: si es para el dueño, lo atiende; si no, lo reenvía
      if (mensaje.para === red.miId) recibirSobre(mensaje);
      else if (jugador) aJugador(mensaje.para, mensaje);
      break;
    case 'vivo':
      anotarVivo(mensaje);
      break;
    case 'resultado':
      registrarResultado(mensaje);
      break;
    case 'chao':
      seFueInvitado(id);
      break;
    default:
      break;
  }
}

function seFueInvitado(id) {
  const indice = red.jugadores.findIndex((j) => j.id === id);
  if (indice < 0 || id === red.miId) return;
  const [jugador] = red.jugadores.splice(indice, 1);
  const conexion = red.conexiones.get(id);
  red.conexiones.delete(id);
  if (conexion) conexion.close();
  // Si estaba jugando, su rival gana (se le avisa como si viniera del partido)
  const partido = partidoEnJuegoDe(id);
  if (partido) {
    const rival = partido.a === id ? partido.b : partido.a;
    aJugador(rival, { t: 'p', partido: partido.id, para: rival, d: { t: 'seFue' } });
    // Por si el rival tampoco contesta, el dueño cierra ese partido un poco después
    setTimeout(() => {
      if (partido.estado === 'jugando') {
        registrarResultado({ partido: partido.id, goles: partido.goles, ganador: rival, motivo: 'abandono' });
      }
    }, 8000);
  }
  anunciar(`${jugador.nombre} salió de la sala.`);
  publicarSala();
}

// Lo que todos ven de la sala (sin las conexiones)
function fotoDeSala() {
  return {
    t: 'sala',
    codigo: red.codigo,
    dueno: red.miId,
    jugadores: red.jugadores.map((j) => ({ id: j.id, nombre: j.nombre, codigo: j.codigo, jugando: Boolean(partidoEnJuegoDe(j.id)) })),
    competencia: red.competencia
  };
}

function publicarSala() {
  if (!red.soyDueno) return;
  clearTimeout(red.relojes.publicar);
  red.relojes.publicar = null;
  const sala = fotoDeSala();
  aTodos(sala);
  recibirDeSala(sala);
}

// Para los marcadores en vivo (que cambian seguido): se publica como mucho cada 0,8 s
function publicarSalaPronto() {
  if (red.relojes.publicar) return;
  red.relojes.publicar = setTimeout(publicarSala, 800);
}

// ---- El dueño arma el amistoso o el torneo ----
function jugadorPorId(id) {
  return red.jugadores.find((j) => j.id === id) || null;
}

function rondaActual() {
  const c = red.competencia;
  return c && c.rondas.length ? c.rondas[c.rondas.length - 1] : [];
}

function buscarPartido(id) {
  const c = red.competencia;
  if (!c) return null;
  for (const ronda of c.rondas) {
    const partido = ronda.find((p) => p.id === id);
    if (partido) return partido;
  }
  return null;
}

function partidoEnJuegoDe(id) {
  return rondaActual().find((p) => p.estado === 'jugando' && (p.a === id || p.b === id)) || null;
}

function empezarCompetencia() {
  const c = red.competencia;
  if (c && !c.terminado) return;
  const tipo = el.panelOrganizar.querySelector('input[name="tipoSala"]:checked').value;
  let participantes;
  if (tipo === 'amistoso') {
    const a = el.amistosoLocal.value;
    const b = el.amistosoVisita.value;
    if (!a || !b || a === b) {
      mostrarErrorOrganizar('Elige a dos personas distintas para el amistoso.');
      return;
    }
    participantes = [a, b];
  } else {
    participantes = red.jugadores.map((j) => j.id);
    if (participantes.length < 2) {
      mostrarErrorOrganizar('Para el torneo se necesitan al menos 2 personas en la sala.');
      return;
    }
    // Sorteo: se mezclan al azar
    for (let i = participantes.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [participantes[i], participantes[k]] = [participantes[k], participantes[i]];
    }
  }
  el.errorOrganizar.hidden = true;
  red.numeroCompetencia++;
  const nombres = {};
  const equipos = {};
  for (const j of red.jugadores) {
    nombres[j.id] = j.nombre;
    equipos[j.id] = j.codigo;
  }
  red.competencia = { tipo, numero: red.numeroCompetencia, rondas: [], campeon: null, terminado: false, nombres, equipos };
  // Primera ronda: los cupos que sobran (para llegar a 2, 4 u 8) son "pase directo"
  let cupos = 2;
  while (cupos < participantes.length) cupos *= 2;
  const lista = participantes.concat(new Array(cupos - participantes.length).fill(null));
  const ronda = [];
  for (let i = 0; i < cupos / 2; i++) ronda.push(crearPartidoDeSala(0, i, lista[i], lista[cupos - 1 - i]));
  red.competencia.rondas.push(ronda);
  iniciarRonda();
}

function crearPartidoDeSala(ronda, indice, a, b) {
  return { id: `${red.numeroCompetencia}-${ronda}-${indice}`, a, b, goles: [0, 0], estado: 'espera', ganador: null, motivo: null, reloj: '' };
}

function datosParaPartido(id) {
  const j = jugadorPorId(id);
  return { id, nombre: j.nombre, codigo: j.codigo, atuendo: j.atuendo };
}

function iniciarRonda() {
  const c = red.competencia;
  const ronda = rondaActual();
  const titulo = c.tipo === 'amistoso' ? 'Amistoso' : nombreRonda(ronda.length);
  for (const partido of ronda) {
    if (!partido.b) {
      partido.estado = 'pase';
      partido.ganador = partido.a;
      continue;
    }
    const presentes = [partido.a, partido.b].filter((id) => jugadorPorId(id));
    if (presentes.length < 2) {
      // Alguien ya no está en la sala: gana el que quedó
      partido.estado = 'fin';
      partido.motivo = 'abandono';
      partido.ganador = presentes[0] || partido.a;
      continue;
    }
    partido.estado = 'jugando';
    partido.reloj = '4:00';
    const mensaje = {
      t: 'partido',
      id: partido.id,
      titulo,
      sinEmpate: c.tipo === 'torneo',
      local: datosParaPartido(partido.a),
      visita: datosParaPartido(partido.b)
    };
    aJugador(partido.a, mensaje);
    aJugador(partido.b, mensaje);
  }
  publicarSala();
  revisarRonda();
}

function anotarVivo(mensaje) {
  const partido = buscarPartido(mensaje.partido);
  if (!partido || partido.estado !== 'jugando' || !Array.isArray(mensaje.goles)) return;
  partido.goles = [Number(mensaje.goles[0]) || 0, Number(mensaje.goles[1]) || 0];
  partido.reloj = String(mensaje.reloj || '').slice(0, 8);
  publicarSalaPronto();
}

function registrarResultado(mensaje) {
  const partido = buscarPartido(mensaje.partido);
  if (!partido || partido.estado !== 'jugando') return; // ya se anotó (el primero que avisa gana)
  const c = red.competencia;
  if (Array.isArray(mensaje.goles)) partido.goles = [Number(mensaje.goles[0]) || 0, Number(mensaje.goles[1]) || 0];
  partido.ganador = mensaje.ganador === partido.a || mensaje.ganador === partido.b ? mensaje.ganador : null;
  // En el torneo siempre hay ganador (por si acaso llega un empate)
  if (c.tipo === 'torneo' && !partido.ganador) partido.ganador = partido.goles[1] > partido.goles[0] ? partido.b : partido.a;
  partido.motivo = mensaje.motivo === 'abandono' || mensaje.motivo === 'meVoy' ? 'abandono' : null;
  partido.estado = 'fin';
  publicarSala();
  revisarRonda();
}

// ¿Terminó la ronda? Entonces sigue la próxima, o hay campeón
function revisarRonda() {
  const c = red.competencia;
  const ronda = rondaActual();
  if (!c || c.terminado || ronda.some((p) => p.estado === 'jugando')) return;
  if (c.tipo === 'amistoso') {
    c.terminado = true;
    publicarSala();
    return;
  }
  const ganadores = ronda.map((p) => p.ganador);
  if (ganadores.length === 1) {
    c.campeon = ganadores[0];
    c.terminado = true;
    publicarSala();
    return;
  }
  clearTimeout(red.relojes.ronda);
  red.relojes.ronda = setTimeout(() => {
    if (red.competencia !== c) return;
    const numero = c.rondas.length;
    const nueva = [];
    for (let i = 0; i < ganadores.length; i += 2) nueva.push(crearPartidoDeSala(numero, i / 2, ganadores[i], ganadores[i + 1]));
    c.rondas.push(nueva);
    iniciarRonda();
  }, PAUSA_ENTRE_RONDAS);
}

// ---- Todos: lo que llega de la sala ----
function recibirDeSala(mensaje) {
  if (!mensaje || typeof mensaje !== 'object') return;
  switch (mensaje.t) {
    case 'sala':
      red.sala = mensaje;
      red.duenoId = mensaje.dueno;
      dibujarSala();
      break;
    case 'partido':
      asignarPartido(mensaje);
      break;
    case 'p':
      recibirSobre(mensaje);
      break;
    case 'rechazo':
      falloOnline(mensaje.motivo === 'llena'
        ? 'Esa sala ya está llena (caben 8). Pide que creen otra.'
        : 'Esa sala usa otra versión de PetuGol. Recarguen la página los dos e intenten otra vez.');
      break;
    case 'cerrada':
      salaPerdida('Quien creó la sala la cerró.');
      break;
    default:
      break; // 'latido' y otros: solo sirven para saber que la sala sigue ahí
  }
}

// La sala se perdió: si estás jugando, el partido sigue; si no, vuelves al inicio
function salaPerdida(texto) {
  if (red.saliendo || red.salaCerrada) return;
  red.salaCerrada = true;
  red.textoSalaCerrada = texto;
  if (red.partido && !red.partido.terminado && estado.pantalla === 'juego') return;
  salirDeSala(texto);
}

// ---- Pantalla de la sala ----
function mostrarPantallaSala() {
  red.saliendo = false;
  red.sala = null;
  red.campeonVisto = null;
  red.claveOrganizar = '';
  red.textoSalaCerrada = '';
  estado.pantalla = 'sala';
  el.pantallaInicio.hidden = true;
  el.pantallaJuego.hidden = true;
  el.pantallaSala.hidden = false;
  el.codigoVisible.textContent = '·····';
  el.bloqueCompartir.hidden = true;
  el.listaJugadores.replaceChildren();
  el.cuentaJugadores.textContent = '';
  el.panelOrganizar.hidden = true;
  el.esperaAnfitrion.hidden = true;
  el.panelCompetencia.hidden = true;
  el.equipoSala.value = red.seleccion;
  el.botonSalirSala.focus();
}

function ponerEstadoSala(texto) {
  if (el.estadoSala.textContent !== texto) el.estadoSala.textContent = texto;
}

function dibujarSala() {
  const sala = red.sala;
  if (!sala) return;
  const c = sala.competencia;
  const yo = red.miId;
  const nombreDe = (id) => (c && c.nombres[id]) || (sala.jugadores.find((j) => j.id === id) || {}).nombre || 'Alguien';

  el.codigoVisible.textContent = sala.codigo;
  el.bloqueCompartir.hidden = false;
  el.cuentaJugadores.textContent = `${sala.jugadores.length} de ${MAXIMO_SALA}`;

  // Lista de jugadores, cada uno con la camiseta de su selección
  el.listaJugadores.replaceChildren(...sala.jugadores.map((j) => {
    const item = document.createElement('li');
    item.className = 'jugador';
    const camiseta = el.vistaEquipo1.cloneNode(true);
    camiseta.removeAttribute('id');
    camiseta.setAttribute('class', 'camiseta jugador__camiseta');
    pintarCamiseta(camiseta, { codigo: j.codigo, patron: buscarEquipo(j.codigo).patron, visita: false });
    const nombre = document.createElement('span');
    nombre.className = 'jugador__nombre';
    nombre.textContent = j.nombre;
    const seleccion = document.createElement('span');
    seleccion.className = 'jugador__seleccion';
    seleccion.textContent = nombreSeleccion(j.codigo);
    item.append(camiseta, nombre, seleccion);
    const etiqueta = (texto, clase) => {
      const marca = document.createElement('span');
      marca.className = `etiqueta etiqueta--${clase}`;
      marca.textContent = texto;
      item.append(marca);
    };
    if (j.id === sala.dueno) etiqueta('Anfitrión', 'dueno');
    if (j.id === yo) etiqueta('Tú', 'tu');
    if (j.jugando) etiqueta('Jugando', 'juega');
    return item;
  }));

  // Organizar: solo el dueño, cuando no hay nada en juego
  const libre = !c || c.terminado;
  el.panelOrganizar.hidden = !(red.soyDueno && libre);
  el.esperaAnfitrion.hidden = red.soyDueno || !libre;
  if (red.soyDueno && libre) actualizarOrganizar(sala, false);

  // Estado en una frase
  if (!c) {
    ponerEstadoSala(red.soyDueno
      ? (sala.jugadores.length < 2 ? 'Comparte el código y espera a tus amigos.' : `Ya son ${sala.jugadores.length}. Cuando estén todos, toca «¡Empezar!».`)
      : `Estás en la sala. Ya son ${sala.jugadores.length}.`);
  } else if (!c.terminado) {
    ponerEstadoSala(c.tipo === 'amistoso' ? 'Amistoso en juego.' : `Mini torneo en juego: ${nombreRonda(rondaDe(c).length)}.`);
  } else if (c.tipo === 'torneo') {
    ponerEstadoSala(`¡${nombreDe(c.campeon)} ganó el mini torneo!`);
  } else {
    ponerEstadoSala('Terminó el amistoso. ¿Otro?');
  }

  // Cuadro del torneo o el amistoso
  el.panelCompetencia.hidden = !c;
  if (c) dibujarCuadro(c, nombreDe);
}

function rondaDe(c) {
  return c.rondas[c.rondas.length - 1] || [];
}

function dibujarCuadro(c, nombreDe) {
  el.tituloCompetencia.textContent = c.tipo === 'amistoso' ? 'Amistoso' : 'Mini torneo';
  const yo = red.miId;
  const etiqueta = (id) => `${nombreDe(id)} · ${c.equipos[id] || ''}`;
  llenarCuadro(el.cuadroTorneo, c.rondas, { tipo: c.tipo, etiqueta, yo });
  dibujarCampeonSala(c, nombreDe, yo);
}

// El cuadro de un torneo (online o normal): cada ronda con sus partidos.
// "etiqueta" da el texto de cada participante y "yo" se resalta.
function llenarCuadro(contenedor, rondas, { tipo, etiqueta, yo }) {
  contenedor.replaceChildren(...rondas.map((ronda) => {
    const bloque = document.createElement('section');
    bloque.className = 'cuadro__ronda';
    const titulo = document.createElement('h4');
    titulo.className = 'cuadro__titulo';
    titulo.textContent = tipo === 'amistoso' ? 'Partido' : nombreRonda(ronda.length);
    const lista = document.createElement('ol');
    lista.className = 'cuadro__partidos';
    for (const partido of ronda) {
      const item = document.createElement('li');
      item.className = `partido partido--${partido.estado}`;
      const lado = (id, goles) => {
        const fila = document.createElement('span');
        fila.className = 'partido__fila';
        if (partido.ganador && partido.ganador === id && partido.estado !== 'jugando') fila.classList.add('partido__fila--gano');
        if (id === yo) fila.classList.add('partido__fila--tu');
        const nombre = document.createElement('span');
        nombre.className = 'partido__nombre';
        nombre.textContent = id ? etiqueta(id) : '—';
        const numero = document.createElement('span');
        numero.className = 'partido__goles';
        numero.textContent = partido.estado === 'jugando' || partido.estado === 'fin' ? String(goles) : '';
        fila.append(nombre, numero);
        return fila;
      };
      const nota = document.createElement('span');
      nota.className = 'partido__estado';
      nota.textContent = {
        espera: 'Por jugar',
        jugando: `En juego · ${partido.reloj || '4:00'}`,
        pase: 'Pasa directo',
        fin: partido.motivo === 'abandono' ? 'Final · por abandono' : 'Final'
      }[partido.estado] || '';
      item.append(lado(partido.a, partido.goles[0]));
      if (partido.b || partido.estado !== 'pase') item.append(lado(partido.b, partido.goles[1]));
      item.append(nota);
      lista.append(item);
    }
    bloque.append(titulo, lista);
    return bloque;
  }));
}

function dibujarCampeonSala(c, nombreDe, yo) {
  // Campeón, con la imagen de festejo (completa)
  const hayCampeon = Boolean(c.campeon);
  el.campeonSala.hidden = !hayCampeon;
  if (hayCampeon) {
    // La misma imagen de festejo de la pantalla final (ya cargada)
    if (el.campeonImagen.src !== el.imgFestejo.src) el.campeonImagen.src = el.imgFestejo.src;
    el.textoCampeon.textContent = c.campeon === yo ? '¡Ganaste el mini torneo!' : `¡${nombreDe(c.campeon)} gana el mini torneo!`;
    const clave = `${c.numero}:${c.campeon}`;
    if (red.campeonVisto !== clave) {
      red.campeonVisto = clave;
      if (estado.pantalla === 'sala') {
        Sonido.fiesta();
        Sonido.aplausos(2.4);
      }
    }
  }
}

// Las listas del amistoso y el texto de ayuda (se conserva lo elegido).
// Las listas solo se rehacen si cambió la gente de la sala (así no se cierran
// mientras alguien está eligiendo).
function actualizarOrganizar(sala, forzar) {
  if (!sala) return;
  const tipo = el.panelOrganizar.querySelector('input[name="tipoSala"]:checked').value;
  el.campoAmistoso.hidden = tipo !== 'amistoso';
  el.ayudaOrganizar.textContent = tipo === 'amistoso'
    ? 'Solo juegan los dos que elijas; los demás ven el marcador en vivo. Partido de 4 minutos.'
    : `Juegan todos (${sala.jugadores.length}), por eliminación, hasta que quede un campeón. Partidos de 4 minutos.`;
  el.botonEmpezarSala.disabled = sala.jugadores.length < 2;
  const clave = sala.jugadores.map((j) => `${j.id}:${j.nombre}:${j.codigo}`).join('|');
  if (!forzar && clave === red.claveOrganizar) return;
  red.claveOrganizar = clave;
  const llenar = (lista, preferido) => {
    const antes = lista.value;
    lista.replaceChildren(...sala.jugadores.map((j) => new Option(`${j.nombre} (${nombreSeleccion(j.codigo)})`, j.id)));
    const ids = sala.jugadores.map((j) => j.id);
    lista.value = ids.includes(antes) ? antes : (preferido && ids.includes(preferido) ? preferido : '');
  };
  llenar(el.amistosoLocal, sala.jugadores[0] && sala.jugadores[0].id);
  llenar(el.amistosoVisita, sala.jugadores[1] && sala.jugadores[1].id);
}

function mostrarErrorOrganizar(texto) {
  el.errorOrganizar.textContent = texto;
  el.errorOrganizar.hidden = false;
}

// Compartir el enlace de la sala (en el celular, con el menú de compartir)
function compartirSala() {
  const codigo = red.codigo;
  const web = location.protocol === 'http:' || location.protocol === 'https:';
  const enlace = web ? `${location.origin}${location.pathname}?sala=${codigo}` : '';
  const texto = `¡Juega PetuGol conmigo! Elige Online y únete a la sala ${codigo}.`;
  const avisar = (mensaje) => {
    el.botonCopiar.textContent = mensaje;
    setTimeout(() => { el.botonCopiar.textContent = 'Copiar enlace'; }, 2200);
  };
  if (esTactil && navigator.share) {
    navigator.share(enlace ? { title: 'PetuGol', text: texto, url: enlace } : { title: 'PetuGol', text: texto }).catch(() => {});
    return;
  }
  const copiar = enlace || codigo;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copiar)
      .then(() => avisar(enlace ? '¡Enlace copiado!' : '¡Código copiado!'))
      .catch(() => mostrarEnlace(copiar));
  } else {
    mostrarEnlace(copiar);
  }
}

function mostrarEnlace(texto) {
  el.ayudaCompartir.textContent = `Cópialo a mano: ${texto}`;
}

// ---- Salir de la sala ----
function salirDeSala(aviso = '') {
  const p = red.partido;
  if (p && !p.terminado) {
    // Salir en medio de un partido es abandonar: la otra persona gana
    enviarAlRival({ t: 'abandono' });
    const ids = [p.datos.local.id, p.datos.visita.id];
    alDueno({ t: 'resultado', partido: p.id, goles: estado.goles, ganador: ids[1 - estado.miLado], motivo: 'abandono' });
  }
  red.saliendo = true;
  if (red.soyDueno) aTodos({ t: 'cerrada' });
  else if (red.conexionSala && red.conexionSala.open) enviarPor(red.conexionSala, { t: 'chao' });
  const peer = red.peer;
  // Un momentico para que los mensajes de despedida alcancen a salir
  if (peer) setTimeout(() => peer.destroy(), 300);
  for (const reloj of [red.relojes.latido, red.relojes.cuenta]) clearInterval(reloj);
  for (const reloj of [red.relojes.ronda, red.relojes.publicar]) clearTimeout(reloj);
  red.relojes = { latido: null, cuenta: null, ronda: null, publicar: null };
  red.peer = null;
  red.miId = null;
  red.soyDueno = false;
  red.conexionSala = null;
  red.conexiones = new Map();
  red.jugadores = [];
  red.competencia = null;
  red.sala = null;
  red.partido = null;
  red.directas = new Map();

  cerrarDialogo(el.dialogoTeToca);
  cerrarDialogo(el.dialogoFinal);
  cerrarDialogo(el.dialogoPausa);
  if (estado.pantalla === 'juego') dejarLaCancha();
  estado.modo = 'maquina';
  estado.pantalla = 'inicio';
  el.pantallaSala.hidden = true;
  el.pantallaJuego.hidden = true;
  el.pantallaInicio.hidden = false;
  el.avisoOnline.textContent = aviso;
  el.avisoOnline.hidden = !aviso;
  mostrarRecords();
  (aviso ? el.botonCrearSala : el.usuario).focus();
}

function falloOnline(texto) {
  salirDeSala(texto);
}

// ---- Te toca un partido ----
function asignarPartido(m) {
  if (red.partido && !red.partido.terminado) return; // ya estás en uno
  if (!m.local || !m.visita) return;
  const soyLocal = m.local.id === red.miId;
  if (!soyLocal && m.visita.id !== red.miId) return;
  // Si estabas viendo el resultado del partido anterior, vuelves a la sala
  if (estado.pantalla === 'juego') volverALaSala();
  cerrarDialogo(el.dialogoAyuda);
  cerrarDialogo(el.dialogoAtuendo);
  const rival = soyLocal ? m.visita : m.local;
  red.partido = {
    id: m.id,
    soyLocal,
    rivalId: rival.id,
    rivalNombre: rival.nombre,
    datos: m,
    directa: red.directas.get(m.id) || null,
    empezado: false,
    terminado: false,
    yoListo: false,
    rivalListo: false,
    limiteEspera: 0,
    eventos: [],
    fotos: [],
    desfase: null,
    ultimaFoto: 0,
    ultimoEnvio: 0,
    ultimoRival: Date.now(),
    entrada: { x: 0, y: 0, ms: 0 },
    vivo: { goles: '', ms: 0 },
    faseVista: null
  };
  red.directas.delete(m.id);
  // El visitante intenta hablar directo con el local (si ninguno es el dueño de
  // la sala, porque con el dueño ya hay conexión directa)
  if (!soyLocal && !red.soyDueno && rival.id !== red.duenoId) intentarDirecta(red.partido);
  mostrarTeToca(m);
}

function intentarDirecta(p) {
  if (!red.peer) return;
  let conexion;
  try {
    conexion = red.peer.connect(p.rivalId, { metadata: { tipo: 'partido', partido: p.id }, serialization: 'json', reliable: true });
  } catch (error) {
    return; // se juega a través del dueño
  }
  conexion.on('open', () => {
    if (red.partido === p) p.directa = conexion;
    else conexion.close();
  });
  conexion.on('data', recibirSobre);
  conexion.on('close', () => {
    if (p.directa === conexion) p.directa = null;
  });
  conexion.on('error', () => { /* sin conexión directa se sigue por la sala */ });
}

function mostrarTeToca(m) {
  const lado = (j) => `${j.nombre} (${nombreSeleccion(j.codigo)})`;
  el.textoTeToca.textContent = `${m.titulo}: ${lado(m.local)} contra ${lado(m.visita)}. Partido de 4 minutos.`;
  let quedan = SEGUNDOS_TE_TOCA;
  el.cuentaTeToca.textContent = String(quedan);
  abrirDialogo(el.dialogoTeToca);
  Sonido.silbatoCorto();
  clearInterval(red.relojes.cuenta);
  red.relojes.cuenta = setInterval(() => {
    quedan--;
    el.cuentaTeToca.textContent = String(Math.max(0, quedan));
    if (quedan <= 0) entrarAlPartido();
  }, 1000);
}

// Entra a la cancha (con el botón o sola al terminar la cuenta)
function entrarAlPartido() {
  clearInterval(red.relojes.cuenta);
  cerrarDialogo(el.dialogoTeToca);
  const p = red.partido;
  if (!p || p.yoListo || p.terminado) return;
  Sonido.desbloquear();
  const m = p.datos;
  estado.modo = 'online';
  estado.miLado = p.soyLocal ? 0 : 1;
  estado.sinEmpate = Boolean(m.sinEmpate);
  estado.nombres = [m.local.nombre, m.visita.nombre];
  estado.codigos = [buscarEquipo(m.local.codigo).codigo, buscarEquipo(m.visita.codigo).codigo];
  // Los dos aparatos arman los uniformes con la misma cuenta: quedan iguales
  const atuendos = [limpiarAtuendo(m.local.atuendo), limpiarAtuendo(m.visita.atuendo)];
  estado.kits = armarKits(estado.codigos[0], estado.codigos[1], {
    camiseta: [atuendos[0].camiseta, atuendos[1].camiseta],
    botines: [atuendos[0].botines, atuendos[1].botines]
  });
  describirCancha();

  el.pantallaSala.hidden = true;
  el.pantallaJuego.hidden = false;
  el.pantallaJuego.classList.toggle('juego--girado', !p.soyLocal);
  document.documentElement.classList.add('jugando');
  estado.pantalla = 'juego';
  sinEco(() => nuevaPartida()); // todo en su lugar; el local la empieza de verdad cuando estén los dos
  el.cartel.hidden = true;
  configurarMando();
  medirCancha();
  iniciarBucle();
  el.lienzo.focus({ preventScroll: true });
  mantenerPantallaEncendida();
  ponerAcostado();
  revisarOrientacion();
  mostrarEsperaRed(`Esperando a ${p.rivalNombre}…`);

  p.yoListo = true;
  p.limiteEspera = Date.now() + ESPERA_RIVAL;
  enviarAlRival({ t: 'listo' });
  revisarArranque();
}

// El local empieza el partido cuando los dos están en la cancha
function revisarArranque() {
  const p = red.partido;
  if (!p || !p.soyLocal || p.empezado || !p.yoListo || !p.rivalListo) return;
  p.empezado = true;
  ocultarEsperaRed();
  nuevaPartida(); // ahora sí con eco: "¡Comienza!" sale en los dos aparatos
  enviarAlRival({ t: 'empieza' });
  sinEco(() => mostrarAviso(textoDeControles(), 'ayuda', ICONO_BALON));
  anunciar(`Comienza el partido: ${estado.nombres[0]} con ${estado.kits[0].nombre} contra ${estado.nombres[1]} con ${estado.kits[1].nombre}. Cuatro minutos, con medio tiempo.`);
}

function mostrarEsperaRed(texto) {
  if (el.esperaRed.textContent !== texto) el.esperaRed.textContent = texto;
  el.esperaRed.hidden = false;
}

function ocultarEsperaRed() {
  el.esperaRed.hidden = true;
}

// ---- Mensajes del partido ----
function recibirSobre(sobre) {
  const p = red.partido;
  if (!sobre || sobre.t !== 'p' || !p || sobre.partido !== p.id || !sobre.d) return;
  p.ultimoRival = Date.now();
  const d = sobre.d;
  switch (d.t) {
    // Lo que manda el visitante (lo atiende el local)
    case 'e':
      if (p.soyLocal && estado.equipos[1]) {
        estado.equipos[1].entrada.x = limitar(Number(d.x) || 0, -1, 1);
        estado.equipos[1].entrada.y = limitar(Number(d.y) || 0, -1, 1);
      }
      break;
    case 'a':
      if (p.soyLocal && p.empezado && ACCIONES.includes(d.a)) {
        if (d.d) presionarAccion(1, d.a, 'red');
        else soltarAccion(1, d.a, 'red');
      }
      break;
    case 'saltar':
      if (p.soyLocal && estado.fase === 'repeticion') terminarRepeticion();
      break;
    case 'cambio': {
      // El visitante pidió un cambio: se hace en la próxima pausa del juego
      const equipo = estado.equipos[1];
      const puesto = Number(d.puesto);
      const entra = Number(d.entra);
      if (p.soyLocal && equipo && puedeCambiar(equipo, puesto, entra)) equipo.cambioPendiente = { puesto, entra };
      break;
    }
    // Para los dos
    case 'listo':
      p.rivalListo = true;
      revisarArranque();
      break;
    case 'abandono':
    case 'seFue':
      if (!p.terminado) terminarPartidoOnline('abandono');
      break;
    // Lo que manda el local (lo atiende el visitante)
    case 'empieza':
      if (!p.soyLocal && !p.empezado) {
        p.empezado = true;
        ocultarEsperaRed();
        sinEco(() => mostrarAviso(textoDeControles(), 'ayuda', ICONO_BALON));
      }
      break;
    case 'f':
      if (!p.soyLocal && !p.terminado) recibirFoto(d);
      break;
    case 'fin':
      if (!p.soyLocal && !p.terminado) finDesdeElLocal(d);
      break;
    default:
      break; // 'latido'
  }
}

// ---- Fotos del partido (el local las toma; el visitante las dibuja) ----
function fotoDelPartido(ahora) {
  const jugadores = [];
  for (const j of todosLosJugadores()) {
    const marcas = (j.controlado ? 1 : 0) | (j.sostener > 0 ? 2 : 0) |
      (j.distraido > 0 || (j.rol === 'portero' && j.cerebro.dudando) ? 4 : 0);
    jugadores.push(r1(j.x), r1(j.y), r1(j.vx), r1(j.vy), r2(j.mira), r2(j.paso), j.barrida > 0 ? 1 : 0,
      r2(j.patada), r2(j.estirada * j.ladoEstirada), r2(j.lanza), marcas);
  }
  const todos = todosLosJugadores();
  const espera = estado.espera;
  return {
    t: 'f',
    ms: Math.round(ahora),
    fa: estado.fase,
    ti: r1(estado.tiempo),
    g: estado.goles.slice(),
    mu: estado.muerteSubita ? 1 : 0,
    ue: estado.ultimoEquipo === null ? -1 : estado.ultimoEquipo,
    j: jugadores,
    b: estado.balones.map((b) => [b.id, r1(b.x), r1(b.y), r1(b.z), r1(b.vx), r1(b.vy), r1(b.vz), r2(b.giro),
      b.dueno ? b.dueno.equipo * EN_CANCHA + b.dueno.indice : -1, b.extra ? 1 : 0, b.enRed ? 1 : 0,
      b.equipoPateo === null || b.equipoPateo === undefined ? -1 : b.equipoPateo]),
    e: estado.esferas.map((s) => [TIPOS_PODER.indexOf(s.tipo), r1(s.x), r1(s.y), r1(s.vida), r2(s.aparicion)]),
    ef: TIPOS_EFECTO.map((tipo) => r1(estado.efectos[tipo])),
    du: TIPOS_EFECTO.map((tipo) => estado.duenos[tipo]),
    es: estado.escudo.map(r1),
    ec: estado.escala.map(r2),
    ca: estado.equipos.map((e) => (e.carga === null ? -1 : r2(e.carga))),
    sp: espera ? [todos.indexOf(espera.jugador), espera.tipo, r2(espera.nx), r2(espera.ny)] : 0,
    ce: estado.celebracion ? [estado.celebracion.equipo, estado.celebracion.tipo === 'burla' ? 1 : 0] : 0,
    cc: estado.canchaCambiada ? 1 : 0,
    // Plantel de cada equipo: [puesto, energía (0 a 100), tarjetas y estado]
    pl: estado.equipos.map((e) => e.plantel.map((q) =>
      [q.puesto, Math.round(q.energia * 100), q.amarillas + (q.expulsado ? 4 : 0) + (q.salio ? 8 : 0)])),
    cb: estado.equipos.map((e) => e.cambios),
    pe: estado.equipos.map((e) => (e.cambioPendiente ? [e.cambioPendiente.puesto, e.cambioPendiente.entra] : 0))
  };
}

function enviarFoto(ahora) {
  const p = red.partido;
  if (!p || !p.soyLocal || !p.empezado || p.terminado) return;
  if (ahora - p.ultimoEnvio < CADA_FOTO) return;
  p.ultimoEnvio = ahora;
  const foto = fotoDelPartido(ahora);
  foto.ev = p.eventos.splice(0);
  enviarAlRival(foto);
  // Marcador en vivo para la sala: cuando cambia el marcador o cada 3 segundos
  const goles = estado.goles.join('-');
  if (goles !== p.vivo.goles || ahora - p.vivo.ms > 3000) {
    p.vivo.goles = goles;
    p.vivo.ms = ahora;
    alDueno({ t: 'vivo', partido: p.id, goles: estado.goles.slice(), reloj: el.reloj.textContent });
  }
}

function recibirFoto(foto) {
  const p = red.partido;
  const llegada = performance.now();
  // "desfase": diferencia entre el reloj del local y el de aquí (más lo que tarda
  // en llegar). Se queda con la menor, que es la de las fotos que llegaron rápido.
  const desfase = llegada - foto.ms;
  p.desfase = p.desfase === null ? desfase : Math.min(desfase, p.desfase + 1);
  p.fotos.push(foto);
  if (p.fotos.length > 40) p.fotos.shift();
  p.ultimaFoto = llegada;
  if (!p.empezado) {
    p.empezado = true;
    ocultarEsperaRed();
  }
}

// Un cuadro en la pantalla del visitante: manda sus controles y dibuja lo que llegó
function cuadroVisita(dt, ahora) {
  const p = red.partido;
  estado.reloj += dt;
  if (!p.terminado) {
    if (!estado.pausado) leerEntradas();
    enviarEntrada(ahora);
    aplicarFotos(ahora);
  }
  // Lo que solo se ve: afición, partículas, giro de los muñecos, letreros, red
  actualizarAficion(dt);
  actualizarParticulas(dt);
  animarJugadores(dt);
  actualizarLetreros(dt);
  actualizarReloj();
  actualizarFichas();
  actualizarMando();
  actualizarCamara(dt);
  dibujar();
  if (estado.fase === 'juego' && !p.terminado) {
    revisarConsejos();
    revisarCansancio();
  }
  // Si dejan de llegar fotos (el otro aparato se trabó o cambió de app), se avisa
  if (p.empezado && !p.terminado) {
    if (ahora - p.ultimaFoto > 1500) mostrarEsperaRed(`Esperando a ${p.rivalNombre}…`);
    else if (!el.esperaRed.hidden) ocultarEsperaRed();
  }
}

// El joystick del visitante viaja cuando cambia (y cada 0,25 s, que sirve de latido)
function enviarEntrada(ahora) {
  const p = red.partido;
  const e = estado.equipos[1] ? estado.equipos[1].entrada : null;
  if (!e) return;
  const antes = p.entrada;
  if (Math.abs(e.x - antes.x) > 0.04 || Math.abs(e.y - antes.y) > 0.04 || ahora - antes.ms > 250) {
    antes.x = e.x;
    antes.y = e.y;
    antes.ms = ahora;
    enviarAlRival({ t: 'e', x: r2(e.x), y: r2(e.y) });
  }
}

// Busca las dos fotos alrededor del momento que se va a dibujar y las mezcla
function aplicarFotos(ahora) {
  const p = red.partido;
  const fotos = p.fotos;
  if (!fotos.length) return;
  const objetivo = ahora - p.desfase - RETRASO_VISITA; // en el reloj del local
  // Primero, los eventos de las fotos que ya pasaron (carteles, sonidos...)
  for (const foto of fotos) {
    if (foto.ms > objetivo) break;
    if (!foto.hecha) {
      foto.hecha = true;
      for (const evento of foto.ev || []) aplicarEvento(evento);
    }
  }
  let i = 0;
  while (i < fotos.length - 1 && fotos[i + 1].ms <= objetivo) i++;
  const a = fotos[i];
  const b = fotos[i + 1] || a;
  const t = b === a ? 0 : limitar((objetivo - a.ms) / (b.ms - a.ms), 0, 1);
  fotos.splice(0, i); // las más viejas ya no sirven
  aplicarFoto(a, b, t);
}

function aplicarFoto(a, b, t) {
  const mezcla = (x, y) => x + (y - x) * t;
  const faseAntes = estado.fase;
  estado.fase = b.fa;
  estado.tiempo = b.ti;
  estado.goles = b.g.slice();
  estado.muerteSubita = Boolean(b.mu);
  estado.ultimoEquipo = b.ue < 0 ? null : b.ue;

  // Jugadores (si alguien "saltó", como al volver al saque, no se mezcla)
  const todos = todosLosJugadores();
  for (const equipo of estado.equipos) equipo.controlado = null;
  todos.forEach((j, i) => {
    const k = i * DATOS_FOTO;
    const A = a.j;
    const B = b.j;
    const salto = Math.hypot(B[k] - A[k], B[k + 1] - A[k + 1]) > 60;
    const m = (o) => (salto ? B[k + o] : mezcla(A[k + o], B[k + o]));
    j.x = m(0);
    j.y = m(1);
    j.vx = m(2);
    j.vy = m(3);
    j.mira = salto ? B[k + 4] : A[k + 4] + anguloCorto(B[k + 4] - A[k + 4]) * t;
    j.paso = m(5);
    j.barrida = B[k + 6] ? 0.1 : 0;
    j.patada = B[k + 7];
    j.estirada = Math.abs(B[k + 8]);
    j.ladoEstirada = B[k + 8] < 0 ? -1 : 1;
    j.lanza = B[k + 9];
    const marcas = B[k + 10];
    j.controlado = (marcas & 1) > 0;
    j.sostener = marcas & 2 ? 0.5 : 0;
    j.distraido = marcas & 4 ? 0.5 : 0;
    if (j.controlado) estado.equipos[j.equipo].controlado = j;
  });
  estado.equipos.forEach((equipo, lado) => {
    equipo.carga = b.ca[lado] < 0 ? null : b.ca[lado];
  });

  // Balones (cada uno con su número, para mezclar el mismo balón)
  const balones = [];
  for (const B of b.b) {
    const A = a.b.find((x) => x[0] === B[0]) || B;
    let balon = estado.balones.find((x) => x.id === B[0]);
    if (!balon) {
      balon = crearBalon(B[1], B[2], Boolean(B[9]));
      balon.id = B[0];
    }
    const salto = Math.hypot(B[1] - A[1], B[2] - A[2]) > 80;
    const m = (o) => (salto ? B[o] : mezcla(A[o], B[o]));
    balon.x = m(1);
    balon.y = m(2);
    balon.z = m(3);
    balon.vx = m(4);
    balon.vy = m(5);
    balon.vz = m(6);
    balon.giro = m(7);
    balon.dueno = B[8] >= 0 ? estado.equipos[Math.floor(B[8] / EN_CANCHA)].jugadores[B[8] % EN_CANCHA] : null;
    balon.extra = Boolean(B[9]);
    balon.enRed = Boolean(B[10]);
    balon.equipoPateo = B[11] < 0 ? null : B[11];
    // Estela del balón rápido
    if (!balon.dueno && Math.hypot(balon.vx, balon.vy) > 360 && !menosMovimiento) {
      balon.rastro.push({ x: balon.x, y: balon.y, z: balon.z });
      if (balon.rastro.length > 8) balon.rastro.shift();
    } else if (balon.rastro.length) {
      balon.rastro.shift();
    }
    balones.push(balon);
  }
  estado.balones = balones;

  estado.esferas = b.e.map(([tipo, x, y, vida, aparicion]) => ({ tipo: TIPOS_PODER[tipo] || 'turbo', x, y, vida, aparicion }));
  TIPOS_EFECTO.forEach((tipo, i) => {
    estado.efectos[tipo] = b.ef[i];
    estado.duenos[tipo] = b.du[i];
  });
  estado.escudo = b.es.slice();
  estado.escala = b.ec.slice();
  estado.espera = b.sp ? { jugador: todos[b.sp[0]], tipo: b.sp[1], nx: b.sp[2], ny: b.sp[3], tiempo: 0, limite: 0 } : null;
  aplicarPlantel(b);
  if (Boolean(b.cc) !== estado.canchaCambiada) {
    estado.canchaCambiada = Boolean(b.cc);
    aplicarGiro();
  }
  estado.celebracion = b.ce ? { equipo: b.ce[0], tipo: b.ce[1] ? 'burla' : 'festejo', tiempo: 0, duracion: 99 } : null;

  // La repetición: letrero y franjas, como en el aparato del local
  if (faseAntes !== estado.fase) {
    if (estado.fase === 'repeticion') mostrarRepeticion(true);
    else if (faseAntes === 'repeticion') mostrarRepeticion(false);
  }
}

// El visitante copia el plantel que llega en la foto: quién juega en cada
// puesto, su energía, sus tarjetas, los expulsados y los cambios
function aplicarPlantel(foto) {
  if (!Array.isArray(foto.pl)) return;
  estado.equipos.forEach((equipo, lado) => {
    const lista = foto.pl[lado];
    if (!Array.isArray(lista)) return;
    lista.forEach(([puesto, energia, marcas], n) => {
      const q = equipo.plantel[n];
      if (!q) return;
      q.puesto = puesto;
      q.energia = energia / 100;
      q.amarillas = marcas & 3;
      q.expulsado = (marcas & 4) > 0;
      q.salio = (marcas & 8) > 0;
    });
    for (const j of equipo.jugadores) {
      const q = equipo.plantel.find((x) => x.puesto === j.indice);
      if (q) j.persona = q;
      j.fuera = Boolean(j.persona && j.persona.expulsado);
    }
    if (Array.isArray(foto.cb)) equipo.cambios = foto.cb[lado];
    if (Array.isArray(foto.pe)) equipo.cambioPendiente = foto.pe[lado] ? { puesto: foto.pe[lado][0], entra: foto.pe[lado][1] } : null;
  });
}

// ---- Fin del partido online ----
// motivo: null = se acabó el tiempo o llegaron a 5 (lo decide el local),
// 'abandono' = la otra persona se fue (ganas), 'meVoy' = abandonaste (pierdes)
function terminarPartidoOnline(motivo) {
  const p = red.partido;
  if (!p || p.terminado) return;
  // La última foto, con los últimos eventos (el gol que definió, por ejemplo)
  if (p.soyLocal && p.empezado && motivo === null) {
    const foto = fotoDelPartido(performance.now());
    foto.ev = p.eventos.splice(0);
    enviarAlRival(foto);
  }
  p.terminado = true;
  estado.fase = 'final';
  const yo = estado.miLado;
  let ganadorLado;
  if (motivo === 'abandono') ganadorLado = yo;
  else if (motivo === 'meVoy') ganadorLado = 1 - yo;
  else if (estado.goles[0] === estado.goles[1]) ganadorLado = null;
  else ganadorLado = estado.goles[0] > estado.goles[1] ? 0 : 1;
  const resultado = { goles: estado.goles.slice(), ganadorLado, motivo, estadisticas: estado.estadisticas };

  if (motivo === 'meVoy') enviarAlRival({ t: 'abandono' });
  else if (p.soyLocal && motivo === null) enviarAlRival(Object.assign({ t: 'fin' }, resultado));
  // El resultado lo anota el dueño de la sala: lo cuenta el local o, si alguien
  // se fue, el que se quedó (si llegan dos avisos, vale el primero)
  if (p.soyLocal || motivo !== null) {
    const ids = [p.datos.local.id, p.datos.visita.id];
    alDueno({ t: 'resultado', partido: p.id, goles: resultado.goles, ganador: ganadorLado === null ? null : ids[ganadorLado], motivo });
  }
  // Si esta pantalla todavía no había entrado a la cancha (te sacaron en la cuenta regresiva)
  if (estado.pantalla !== 'juego') {
    clearInterval(red.relojes.cuenta);
    cerrarDialogo(el.dialogoTeToca);
    red.partido = null;
    if (red.salaCerrada) salirDeSala(red.textoSalaCerrada);
    return;
  }
  mostrarFinalOnline(resultado);
}

// El visitante recibe el final del partido
function finDesdeElLocal(d) {
  const p = red.partido;
  // Los eventos que faltaban por mostrar (el último gol, el silbato...)
  for (const foto of p.fotos) {
    if (!foto.hecha) {
      foto.hecha = true;
      for (const evento of foto.ev || []) aplicarEvento(evento);
    }
  }
  p.terminado = true;
  estado.fase = 'final';
  if (Array.isArray(d.goles)) estado.goles = d.goles.slice(0, 2);
  if (d.estadisticas) estado.estadisticas = d.estadisticas;
  actualizarMarcador();
  mostrarFinalOnline({ goles: estado.goles, ganadorLado: d.ganadorLado === 0 || d.ganadorLado === 1 ? d.ganadorLado : null, motivo: null });
}

function mostrarFinalOnline(r) {
  const yo = estado.miLado;
  const otro = 1 - yo;
  const [nYo, nOtro] = [estado.nombres[yo], estado.nombres[otro]];
  const gane = r.ganadorLado === yo;
  const empate = r.ganadorLado === null;
  if (!empate) estado.celebracion = { equipo: r.ganadorLado, tipo: 'festejo', tiempo: 0, duracion: 99 };
  sinEco(() => ocultarPalcos());
  ocultarEsperaRed();
  mostrarRepeticion(false);
  cerrarDialogo(el.dialogoPausa);
  cerrarDialogo(el.dialogoAyuda);
  soltarControles();

  const torneo = red.partido && red.partido.datos.sinEmpate;
  if (r.motivo === 'abandono') {
    el.tituloFinal.textContent = `¡Ganaste, ${nYo}!`;
    el.textoFinal.textContent = `${nOtro} se fue del partido (o se le cortó el internet).`;
  } else if (r.motivo === 'meVoy') {
    el.tituloFinal.textContent = 'Abandonaste';
    el.textoFinal.textContent = `${nOtro} gana el partido porque te saliste.`;
  } else if (empate) {
    el.tituloFinal.textContent = '¡Empate!';
    el.textoFinal.textContent = 'Nadie ganó este amistoso. ¡Pidan otro!';
  } else if (gane) {
    el.tituloFinal.textContent = `¡Ganaste, ${nYo}!`;
    el.textoFinal.textContent = torneo ? `Le ganaste a ${nOtro}. Espera en la sala el siguiente partido.` : `Le ganaste a ${nOtro}.`;
  } else {
    el.tituloFinal.textContent = `Gana ${nOtro}`;
    el.textoFinal.textContent = torneo ? '¡Quedaste por fuera del torneo, pero puedes verlo desde la sala!' : '¡La próxima es tuya!';
  }
  const g = estado.goles;
  el.marcadorFinal.textContent = `${nYo} (${estado.kits[yo].codigo}) ${g[yo]} – ${g[otro]} (${estado.kits[otro].codigo}) ${nOtro}`;
  mostrarLogros([]);
  mostrarEstadisticas([yo, otro]);
  el.imgFestejo.hidden = !gane;
  el.imgBurla.hidden = true;
  el.figuraFinal.hidden = !gane;
  el.figuraFinal.parentElement.classList.toggle('final--sin-imagen', !gane);
  el.dialogoFinal.classList.remove('dialogo--burla');
  el.botonRevancha.hidden = true;
  el.botonOtroRival.hidden = true;
  el.medallaFinal.hidden = true;
  el.botonInicioFinal.textContent = red.salaCerrada ? 'Volver al inicio' : 'Volver a la sala';
  sinEco(() => {
    Sonido.silbato(3);
    if (gane) {
      Sonido.fiesta();
      Sonido.aplausos(2.6);
    }
    anunciar(`${el.tituloFinal.textContent} Resultado final: ${nYo} ${g[yo]}, ${nOtro} ${g[otro]}.`);
  });
  cerrarPartido();
  abrirDialogo(el.dialogoFinal);
}

// Deja la pantalla de juego (sin decidir a dónde se va)
function dejarLaCancha() {
  detenerBucle();
  soltarControles();
  soltarPantalla();
  sinEco(() => ocultarPalcos());
  soltarAcostado();
  estado.pausado = false;
  estado.girando = false;
  estado.miLado = 0;
  vista.giro = false;
  el.girar.hidden = true;
  el.cartel.hidden = true;
  el.aviso.hidden = true;
  ocultarConsejo();
  ocultarEsperaRed();
  estado.repeticion = null;
  el.repeticion.hidden = true;
  el.pantallaJuego.classList.remove('juego--pausa', 'juego--repeticion', 'juego--girado');
  el.pantallaJuego.hidden = true;
  document.documentElement.classList.remove('jugando');
}

// Después del partido: de vuelta a la sala
function volverALaSala() {
  cerrarDialogo(el.dialogoFinal);
  cerrarDialogo(el.dialogoPausa);
  cerrarDialogo(el.dialogoAyuda);
  const p = red.partido;
  if (p && !p.terminado) terminarPartidoOnline('meVoy');
  if (p && p.directa) p.directa.close();
  red.partido = null;
  dejarLaCancha();
  if (red.salaCerrada) {
    salirDeSala(red.textoSalaCerrada || 'Se cerró la sala.');
    return;
  }
  estado.pantalla = 'sala';
  el.pantallaSala.hidden = false;
  dibujarSala();
  el.botonSalirSala.focus({ preventScroll: true });
}


iniciar();
