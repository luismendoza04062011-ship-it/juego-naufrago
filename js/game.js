// =====================================================================
//  game.js → Motor principal de NÁUFRAGO
//  Canvas 2D a 60 FPS (requestAnimationFrame + delta time), personaje,
//  zonas, inventario, supervivencia, HUD y flujo entre pantallas.
// =====================================================================

const ANCHO = 1280, ALTO = 720;
const $ = (id) => document.getElementById(id);
const FUENTE_EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

const escenario = $('stage');
const lienzo = $('lienzo');
const ctx = lienzo.getContext('2d');

// Clima REAL del colegio (API Open-Meteo)
const CLIMA = { ok: false, temp: 0, lluvia: false, radiacion: 0, esDia: true, codigo: 0 };
// Teclas que se mantienen presionadas
const teclas = { izq: false, der: false, espacio: false };

// Estado de la partida
const J = { estado: 'menu', t: 0, ultimaActividad: performance.now() };

// Fondos de las zonas
const IMG = {};
ZONAS.forEach(z => { IMG[z.id] = new Image(); IMG[z.id].src = z.fondo; });

// ------------------------------------------------------------- PANTALLAS
let pantallaActual = 'pantalla-menu';
function mostrarPantalla(id) {
  pantallaActual = id;
  document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p.id === id));
}

// Escala el escenario de 1280×720 para llenar la ventana sin deformarlo
function ajustarEscenario() {
  const marco = $('marco');
  const k = Math.min(marco.clientWidth / ANCHO, marco.clientHeight / ALTO);
  escenario.style.transform = `translate(-50%, -50%) scale(${k})`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  lienzo.width = Math.round(ANCHO * k * dpr);
  lienzo.height = Math.round(ALTO * k * dpr);
}
addEventListener('resize', ajustarEscenario);
document.addEventListener('fullscreenchange', ajustarEscenario);
ajustarEscenario();

function alternarPantallaCompleta() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  } catch (e) { /* navegador sin pantalla completa */ }
}

// ---------------------------------------------------------- UTILIDADES
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
function formatoTiempo(s) {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
const formatoPuntos = (n) => Math.round(n).toLocaleString('es-CO');
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// BRISA habla: muestra el texto en el HUD y (opcional) lo lee en voz alta
function hudBrisa(texto) {
  $('hud-brisa-texto').textContent = texto;
  const panel = $('hud-brisa');
  panel.classList.remove('nuevo');
  void panel.offsetWidth;
  panel.classList.add('nuevo');
}
function decir(texto, conVoz = true) {
  hudBrisa(texto);
  if (conVoz) Sensores.hablar(texto);
}

function marcarActividad() { J.ultimaActividad = performance.now(); }

// ================================================================ PARTIDA
function nuevaPartida() {
  Object.assign(J, {
    zonaIdx: 0, tiempo: 0, puntos: 0, bono: 0, hidr: 100, energia: 100,
    inventario: {}, descubiertos: new Set(), retos: { agua: false, fuego: false, baliza: false },
    flotantes: [], particulas: [], lluvia: [], motas: [], fundido: null, cercano: null,
    avisoHidr: false, avisoEnerg: false, ultimoAvisoSalida: 0, guardado: false, miRecord: null,
    causa: null, gano: false, pasoT: 0, crepT: 0
  });
  J.jugador = { x: 70, dir: 1, fase: 0, mov: false };
  J.brisa = { x: 20, y: 440 };
  cargarZona(0);
  pintarInventario();
}

function cargarZona(i) {
  J.zonaIdx = i;
  const z = ZONAS[i];
  J.objetos = z.objetos.map(o => ({ ...o, recogido: false, fase: Math.random() * 6 }));
  J.estaciones = (z.estaciones || []).map(e => ({ ...e }));
  J.jugador.x = 70;
  J.brisa.x = 20;
  J.brisa.y = z.suelo - 200;
  J.particulas = [];
  J.lluvia = [];
  if (CLIMA.lluvia && z.lluvia) for (let k = 0; k < 160; k++) J.lluvia.push({ x: Math.random() * ANCHO, y: Math.random() * ALTO, v: 700 + Math.random() * 400 });
  J.motas = [];
  if (z.motas) for (let k = 0; k < 45; k++) J.motas.push({ x: Math.random() * ANCHO, y: Math.random() * ALTO * 0.8, f: Math.random() * 6 });
  pintarMision();
}

function anunciarZona() {
  const z = ZONAS[J.zonaIdx];
  let texto = z.intro;
  if (J.zonaIdx === 0 && CLIMA.ok && CLIMA.lluvia) texto += ` Dato real: ahora mismo está lloviendo en ${CONFIG.colegio.ciudad}, así que en la isla también.`;
  decir(texto);
}

function comenzarMision() {
  Sonido.contexto();
  nuevaPartida();
  mostrarPantalla('pantalla-juego');
  J.estado = 'juego';
  marcarActividad();
  anunciarZona();
}

function irAlMenu() {
  Sensores.callar();
  if (Cinematica.activa) { Cinematica.alTerminar = null; Cinematica.fin(); }
  ['ov-tarjeta', 'ov-mini', 'ov-pausa', 'ov-ayuda'].forEach(id => $(id).classList.remove('visible'));
  if (Tarjeta.visor) Tarjeta.visor.detener();
  clearInterval(Tarjeta.karaoke);
  Minijuego.tipo = null;
  J.estado = 'menu';
  mostrarPantalla('pantalla-menu');
}

// ------------------------------------------------------------ ACCIONES
function buscarCercano() {
  const x = J.jugador.x;
  let mejor = null, dmin = Infinity;
  J.objetos.forEach(o => {
    const d = Math.abs(o.x - x);
    if (!o.recogido && d < 72 && d < dmin) { dmin = d; mejor = { tipo: 'objeto', ref: o }; }
  });
  J.estaciones.forEach(e => {
    const d = Math.abs(e.x - x);
    if (d < 95 && d < dmin) { dmin = d; mejor = { tipo: 'estacion', ref: e }; }
  });
  return mejor;
}

function interactuar() {
  if (J.fundido) return;
  const c = J.cercano;
  if (!c) { decir('No hay nada cerca. Acércate a un objeto que brille.', false); Sonido.error(); return; }
  if (c.tipo === 'objeto') recoger(c.ref);
  else usarEstacion(c.ref);
}

function recoger(o) {
  const def = OBJETOS[o.id];
  o.recogido = true;
  J.inventario[o.id] = (J.inventario[o.id] || 0) + 1;
  pintarInventario();
  if (!J.descubiertos.has(o.id)) {
    J.descubiertos.add(o.id);
    pintarMision();
    sumarPuntos(100, o.x, ZONAS[J.zonaIdx].suelo - 120, 'DESCUBRIMIENTO');
    Tarjeta.abrir(o.id, true);
  } else {
    Sonido.recoger();
    flotante(`+1 ${def.emoji}`, o.x, ZONAS[J.zonaIdx].suelo - 120, '#c3f5ff');
    decir(`Guardaste otro ${def.corto.toLowerCase()} en el inventario.`, false);
  }
}

function usarConsumible(id) {
  if (J.estado !== 'juego') return;
  const def = OBJETOS[id];
  if (!(J.inventario[id] > 0)) {
    Sonido.error();
    decir(id === 'coco' ? 'No tienes cocos. Hay uno en la playa y otro en el campamento.' : 'No tienes guayabas. Hay una en la selva.', false);
    return;
  }
  J.inventario[id]--;
  const c = def.consumible;
  if (c.hidr) J.hidr = Math.min(100, J.hidr + c.hidr);
  if (c.energia) J.energia = Math.min(100, J.energia + c.energia);
  Sonido.logro();
  flotante(c.hidr ? `+${c.hidr} 💧` : `+${c.energia} ⚡`, J.jugador.x, ZONAS[J.zonaIdx].suelo - 200, c.hidr ? '#00e5ff' : '#e5c384');
  pintarInventario();
  decir(c.hidr ? 'Hidratación recuperada. El potasio del coco ayuda a tus células a retener el agua.' : 'Energía recuperada. Los azúcares de la fruta les dan combustible a tus células.');
}

function usarEstacion(e) {
  if (J.retos[e.tipo]) {
    decir(e.tipo === 'agua' ? 'El destilador ya está funcionando con la luz del Sol.' : 'El fuego ya está prendido y nos da calor.', false);
    return;
  }
  const faltan = e.requiere.filter(id => !(J.inventario[id] > 0));
  if (faltan.length) {
    Sonido.error();
    decir(`${e.para} todavía necesitamos ${listaNatural(faltan.map(id => OBJETOS[id].art))}. Búscalos en la isla.`);
    return;
  }
  Sensores.callar();
  J.estado = 'minijuego';
  Minijuego.iniciar(e.tipo, () => completarReto(e));
}

function consumir(id) { if (J.inventario[id] > 0) J.inventario[id]--; }

function completarReto(e) {
  J.retos[e.tipo] = true;
  const y = ZONAS[J.zonaIdx].suelo - 160;
  if (e.tipo === 'baliza') {
    sumarPuntos(500, e.x, y, 'S.O.S.');
    victoria();
    return;
  }
  J.estado = 'juego';
  if (e.tipo === 'agua') {
    consumir('aguamar');
    J.hidr = Math.min(100, J.hidr + 50);
    sumarPuntos(300, e.x, y, 'RETO SUPERADO');
    decir(J.retos.fuego ? '¡Reto superado! Ya tenemos agua y fuego, así que podemos subir a la cumbre. Camina hacia la derecha.' : '¡Reto superado! Ya tenemos agua potable. Ahora prendamos el fuego en el anillo de piedras.');
  }
  if (e.tipo === 'fuego') {
    consumir('madera'); consumir('yesca');
    J.energia = Math.min(100, J.energia + 40);
    sumarPuntos(300, e.x, y, 'RETO SUPERADO');
    decir(J.retos.agua ? '¡Reto superado! Ya tenemos agua y fuego, así que podemos subir a la cumbre. Camina hacia la derecha.' : '¡Reto superado! Ya tenemos fuego. Ahora falta conseguir agua potable en el destilador solar.');
  }
  pintarInventario();
  pintarMision();
}

function sumarPuntos(n, x, y, etiqueta) {
  J.puntos += n;
  flotante(`+${n} ${etiqueta}`, x, y, '#e5c384');
  Sonido.puntos();
  const el = $('hud-puntos');
  el.classList.remove('pulso'); void el.offsetWidth; el.classList.add('pulso');
}

function flotante(texto, x, y, color) { J.flotantes.push({ texto, x, y, vida: 1.8, color }); }

// Une una lista en español: ["a", "b", "c"] → "a, b y c"
function listaNatural(items) {
  return items.length < 2 ? (items[0] || '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

// Lo que falta en la zona actual para poder avanzar
function faltantesZona() {
  const z = ZONAS[J.zonaIdx];
  const objetos = z.objetos.filter(o => !OPCIONALES.includes(o.id) && !J.descubiertos.has(o.id)).map(o => OBJETOS[o.id].art);
  const retos = (z.estaciones || []).filter(e => !J.retos[e.tipo]).map(e => e.pendiente);
  return { objetos, retos, total: objetos.length + retos.length };
}

function intentarSalir() {
  const p = J.jugador;
  if (J.zonaIdx >= ZONAS.length - 1) { p.x = ANCHO - 34; return; }
  const faltan = faltantesZona();
  if (!faltan.total) {
    J.fundido = { a: 0, dir: 1, alMedio: () => { cargarZona(J.zonaIdx + 1); anunciarZona(); } };
    return;
  }
  p.x = ANCHO - 34;
  if (performance.now() - J.ultimoAvisoSalida > 4500) {
    J.ultimoAvisoSalida = performance.now();
    Sonido.error();
    decir(faltan.objetos.length
      ? `Antes de seguir, busca ${listaNatural(faltan.objetos)}.`
      : `Antes de seguir, nos falta ${listaNatural(faltan.retos)}.`);
  }
}

function derrota(causa) {
  J.estado = 'fin';
  J.causa = causa;
  J.gano = false;
  Sensores.callar();
  Sonido.derrota();
  setTimeout(() => { J.estado = 'cine'; Cinematica.reproducir(ESCENAS_DERROTA[causa], mostrarFinal); }, 900);
}

function victoria() {
  J.estado = 'cine';
  J.gano = true;
  J.bono = Math.max(0, Math.round((480 - J.tiempo) * 5)) + Math.round(J.hidr + J.energia);
  J.puntos += J.bono;
  Sonido.victoria();
  Cinematica.reproducir(ESCENAS_VICTORIA, mostrarFinal);
}

function pausar() {
  if (J.estado !== 'juego' && J.estado !== 'minijuego') return;
  J.estadoPrevio = J.estado;
  J.estado = 'pausa';
  Sensores.callar();
  $('ov-pausa').classList.add('visible');
}
function reanudar() {
  $('ov-pausa').classList.remove('visible');
  J.estado = J.estadoPrevio || 'juego';
}

// ======================================================== ESCÁNER ATÓMICO
const Tarjeta = {
  id: null, visor: null, elementos: [], idxAtomo: -1, abiertaEn: 0, karaoke: null,

  abrir(id, nuevo) {
    const o = OBJETOS[id];
    const mol = MOLECULAS[o.molecula];
    this.id = id;
    this.abiertaEn = performance.now();
    J.estado = 'tarjeta';
    $('tarjeta-emoji').textContent = o.emoji;
    $('tarjeta-nombre').textContent = o.nombre;
    $('tarjeta-formula').textContent = o.formula;
    $('tarjeta-uso').textContent = 'USO: ' + o.uso;
    $('tarjeta-pts').style.display = nuevo ? '' : 'none';
    $('tarjeta-nota').textContent = mol.nota || '';
    // leyenda de elementos: cada uno abre su modelo de Bohr
    this.elementos = [...new Set(mol.atomos.map(a => a[0]))];
    const leyenda = $('tarjeta-leyenda');
    leyenda.innerHTML = '';
    this.elementos.forEach(s => {
      const el = ELEMENTOS[s];
      const b = document.createElement('button');
      b.dataset.simbolo = s;
      b.innerHTML = `<i style="background:${el.color}"></i>${s} · ${el.nombre} · ${el.protones} p⁺`;
      b.addEventListener('click', () => this.verAtomo(s));
      leyenda.append(b);
    });
    if (!this.visor) this.visor = new VisorMolecular($('tarjeta-mol'));
    this.visor.mostrarMolecula(mol);
    this.idxAtomo = -1;
    $('ov-tarjeta').classList.add('visible');
    Sonido.escaneo();
    const prefijo = nuevo && J.descubiertos.size === 1 ? 'Iniciando escaneo atómico. Todo lo que existe está formado por átomos. ' : '';
    this.leer(prefijo + o.texto);
  },

  // Lee el texto en voz alta y va iluminando las palabras (efecto karaoke)
  leer(texto) {
    const p = $('tarjeta-texto');
    p.innerHTML = '';
    const palabras = [];
    let i = 0;
    texto.split(/(\s+)/).forEach(trozo => {
      if (/^\s+$/.test(trozo) || !trozo) p.append(trozo);
      else {
        const sp = document.createElement('span');
        sp.textContent = trozo;
        p.append(sp);
        palabras.push({ sp, ini: i });
      }
      i += trozo.length;
    });
    const marcar = (ci) => palabras.forEach(w => w.sp.classList.toggle('leida', w.ini <= ci));
    clearInterval(this.karaoke);
    if (!Sensores.tts.soportado) { marcar(texto.length); return; }
    // Las palabras se iluminan solo cuando la voz realmente empieza a sonar
    let porLimite = false;
    let t0 = null, base = 0;
    const pedido = performance.now();
    Sensores.hablar(texto, {
      alEmpezar: (inicio) => { t0 = performance.now(); base = inicio; },
      alPalabra: (ci) => { porLimite = true; marcar(ci); },
      alTerminar: () => { clearInterval(this.karaoke); marcar(texto.length); }
    });
    this.karaoke = setInterval(() => {
      if (t0 !== null && !porLimite) marcar(base + (performance.now() - t0) / 1000 * 15);
      // si la voz no logra arrancar, se muestra el texto completo para leerlo
      if (t0 === null && performance.now() - pedido > 6000) { clearInterval(this.karaoke); marcar(texto.length); }
    }, 120);
  },

  cerrar() {
    if (J.estado !== 'tarjeta' || performance.now() - this.abiertaEn < 450) return;
    clearInterval(this.karaoke);
    Sensores.callar();
    if (this.visor) this.visor.detener();
    $('ov-tarjeta').classList.remove('visible');
    J.estado = 'juego';
    Sonido.click();
    const o = OBJETOS[this.id];
    const art = o.art.charAt(0).toUpperCase() + o.art.slice(1);
    hudBrisa(`${art} quedó en tu inventario. ${faltantesZona().total ? 'Sigue explorando.' : 'Zona completa: camina hacia la derecha →'}`);
  },

  repetir() {
    if (J.estado !== 'tarjeta') return;
    this.verMolecula();
    this.leer(OBJETOS[this.id].texto);
  },

  verAtomo(simbolo) {
    const el = ELEMENTOS[simbolo];
    clearInterval(this.karaoke);
    $('tarjeta-texto').querySelectorAll('span').forEach(s => s.classList.add('leida'));
    this.visor.mostrarAtomo(simbolo);
    this.idxAtomo = this.elementos.indexOf(simbolo);
    $('tarjeta-leyenda').querySelectorAll('button').forEach(b => b.classList.toggle('activo', b.dataset.simbolo === simbolo));
    const capas = el.capas.length;
    const uno = el.protones === 1;
    Sensores.hablar(`El ${el.nombre.toLowerCase()} tiene ${el.protones} ${uno ? 'protón' : 'protones'} en su núcleo y ${el.protones} ${uno ? 'electrón' : 'electrones'} a su alrededor, repartidos en ${capas} ${capas === 1 ? 'capa' : 'capas'}.`);
  },

  siguienteAtomo() {
    if (J.estado !== 'tarjeta') return;
    this.idxAtomo = (this.idxAtomo + 1) % this.elementos.length;
    this.verAtomo(this.elementos[this.idxAtomo]);
  },

  verMolecula() {
    if (J.estado !== 'tarjeta') return;
    this.idxAtomo = -1;
    $('tarjeta-leyenda').querySelectorAll('button').forEach(b => b.classList.remove('activo'));
    this.visor.mostrarMolecula(MOLECULAS[OBJETOS[this.id].molecula]);
  }
};

// =============================================================== HUD
const cacheHUD = {};
function ponerTexto(id, txt) { if (cacheHUD[id] !== txt) { cacheHUD[id] = txt; $(id).textContent = txt; } }
function ponerAncho(id, pct) {
  const v = Math.round(limitar(pct, 0, 100));
  if (cacheHUD[id] !== v) { cacheHUD[id] = v; $(id).style.width = v + '%'; $(id).classList.toggle('bajo', v < 30); }
}

function actualizarHUD() {
  ponerAncho('hud-hidr', J.hidr);
  ponerTexto('hud-hidr-num', Math.ceil(Math.max(0, J.hidr)) + '%');
  ponerAncho('hud-energ', J.energia);
  ponerTexto('hud-energ-num', Math.ceil(Math.max(0, J.energia)) + '%');
  ponerTexto('hud-zona', `ZONA ${J.zonaIdx + 1}/${ZONAS.length} · ${ZONAS[J.zonaIdx].nombre}`);
  ponerTexto('hud-tiempo', '⏱ ' + formatoTiempo(J.tiempo));
  ponerTexto('hud-puntos', '★ ' + formatoPuntos(J.puntos));
  $('hud-mic-nivel').style.width = Math.round(Sensores.intensidad() * 100) + '%';
  $('hud-mic').classList.toggle('apagado', !Sensores.mic.activo);
  ponerTexto('hud-mic-texto', Sensores.mic.activo ? 'mic' : 'mic apagado');
  $('hud-voz').classList.toggle('apagado', !Sensores.voz.activa);
  let voz = 'voz apagada';
  if (Sensores.voz.activa) {
    const reciente = performance.now() - Sensores.voz.ultimoEn < 2500;
    voz = reciente ? `oí: «${Sensores.voz.ultimo.slice(0, 22)}»` : 'escuchando…';
  }
  ponerTexto('hud-voz-texto', voz);
  $('tarjeta-onda').classList.toggle('activa', Sensores.tts.hablando);
}

function pintarMision() {
  const z = ZONAS[J.zonaIdx];
  $('hud-mision-texto').textContent = z.mision;
  const ul = $('hud-mision-lista');
  ul.innerHTML = '';
  z.objetos.filter((o, i, lista) => lista.findIndex(x => x.id === o.id) === i).forEach(o => {
    const li = document.createElement('li');
    const ok = J.descubiertos.has(o.id);
    const opcional = OPCIONALES.includes(o.id);
    li.textContent = `${ok ? '✓' : opcional ? '☆' : '○'} ${OBJETOS[o.id].emoji} ${ok ? OBJETOS[o.id].corto : '???'}`;
    li.className = ok ? 'ok' : '';
    ul.append(li);
  });
  (z.estaciones || []).forEach(e => {
    const li = document.createElement('li');
    li.className = 'ancho' + (J.retos[e.tipo] ? ' ok' : '');
    li.textContent = `${J.retos[e.tipo] ? '✓' : '○'} ${e.icono} ${e.nombre}`;
    ul.append(li);
  });
}

function pintarInventario() {
  const inv = $('hud-inv');
  inv.innerHTML = '';
  const ids = Object.keys(OBJETOS).filter(id => J.inventario && J.inventario[id] > 0);
  if (!ids.length) { inv.innerHTML = '<span class="vacio">Vacío: recoge objetos con E</span>'; return; }
  ids.forEach(id => {
    const o = OBJETOS[id];
    const slot = document.createElement('div');
    slot.className = 'slot' + (o.consumible ? ' consumible' : '');
    slot.title = o.nombre;
    slot.innerHTML = `${o.emoji}<b>${J.inventario[id]}</b>${id === 'coco' ? '<kbd>1</kbd>' : id === 'fruta' ? '<kbd>2</kbd>' : ''}`;
    if (o.consumible) slot.addEventListener('click', () => usarConsumible(id));
    inv.append(slot);
  });
}

// ======================================================== CICLO DEL JUEGO
function actualizarJuego(dt) {
  const z = ZONAS[J.zonaIdx];
  const p = J.jugador;
  J.tiempo += dt;

  // transición entre zonas (fundido a negro)
  if (J.fundido) {
    const f = J.fundido;
    f.a += f.dir * dt * 2.4;
    if (f.dir === 1 && f.a >= 1) { f.a = 1; f.dir = -1; f.alMedio(); }
    if (f.dir === -1 && f.a <= 0) J.fundido = null;
  } else {
    // movimiento
    const dir = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
    p.mov = dir !== 0;
    if (dir) p.dir = dir;
    p.x += dir * CONFIG.velocidadAlek * dt;
    if (p.x < 40) p.x = 40;
    if (p.x > ANCHO - 30) intentarSalir();
  }
  const faseAntes = p.fase;
  p.fase += dt * (p.mov ? 10 : 2);
  if (p.mov && Math.floor(faseAntes / Math.PI) !== Math.floor(p.fase / Math.PI)) Sonido.paso();

  // supervivencia: las barras bajan con el tiempo
  J.hidr -= 100 / CONFIG.segundosHidratacion * dt;
  J.energia -= 100 / CONFIG.segundosEnergia * dt;
  if (J.hidr < 30 && !J.avisoHidr) {
    J.avisoHidr = true; Sonido.alerta();
    decir(J.inventario.coco > 0 ? 'Alerta: tu hidratación está baja. Presiona la tecla 1 para hidratarte con el coco.' : 'Alerta: tu hidratación está baja. Necesitamos agua pronto.');
  }
  if (J.hidr > 40) J.avisoHidr = false;
  if (J.energia < 30 && !J.avisoEnerg) {
    J.avisoEnerg = true; Sonido.alerta();
    decir(J.inventario.fruta > 0 ? 'Alerta: tu energía está baja. Presiona la tecla 2 para recuperarla con la fruta.' : 'Alerta: tu energía está baja. Busca algo de alimento o una fuente de calor.');
  }
  if (J.energia > 40) J.avisoEnerg = false;
  if (J.hidr <= 0) { J.hidr = 0; derrota('hidratacion'); return; }
  if (J.energia <= 0) { J.energia = 0; derrota('energia'); return; }

  // BRISA sigue a Alek flotando detrás de su hombro
  const objetivoX = p.x - p.dir * 58;
  const objetivoY = z.suelo - 205 + Math.sin(J.t * 2.2) * 7;
  J.brisa.x += (objetivoX - J.brisa.x) * Math.min(1, dt * 3);
  J.brisa.y += (objetivoY - J.brisa.y) * Math.min(1, dt * 3);

  J.cercano = J.fundido ? null : buscarCercano();

  // partículas: fuego del campamento, lluvia, motas
  if (z.id === 'campamento' && J.retos.fuego) {
    if (Math.random() < dt * 40) J.particulas.push({ x: 1192 + (Math.random() - 0.5) * 40, y: 500, vx: (Math.random() - 0.5) * 16, vy: -60 - Math.random() * 60, r: 5 + Math.random() * 7, vida: 0.8, vidaMax: 0.8, fuego: true });
    J.crepT -= dt;
    if (J.crepT <= 0) { Sonido.crepitar(); J.crepT = 0.15 + Math.random() * 0.4; }
  }
  J.particulas = J.particulas.filter(q => { q.vida -= dt; q.x += q.vx * dt; q.y += q.vy * dt; return q.vida > 0; });
  J.lluvia.forEach(d => { d.y += d.v * dt; d.x -= d.v * 0.15 * dt; if (d.y > ALTO) { d.y = -20; d.x = Math.random() * (ANCHO + 100); } });
  J.flotantes = J.flotantes.filter(f => { f.vida -= dt; f.y -= 40 * dt; return f.vida > 0; });
}

// ============================================================== DIBUJO
function dibujarMundo() {
  const c = ctx;
  c.setTransform(lienzo.width / ANCHO, 0, 0, lienzo.height / ALTO, 0, 0);
  const z = ZONAS[J.zonaIdx];
  const t = J.t;

  // fondo (ilustración de Google Stitch)
  const img = IMG[z.id];
  if (img.complete && img.naturalWidth) c.drawImage(img, 0, 0, ANCHO, ALTO);
  else {
    const g = c.createLinearGradient(0, 0, 0, ALTO);
    g.addColorStop(0, '#1d5f8a'); g.addColorStop(1, '#c9a66b');
    c.fillStyle = g; c.fillRect(0, 0, ANCHO, ALTO);
  }
  if (CLIMA.lluvia && z.lluvia) { c.fillStyle = 'rgba(20,35,50,0.28)'; c.fillRect(0, 0, ANCHO, ALTO); }
  // sombras para que el HUD se lea bien
  let g = c.createLinearGradient(0, 0, 0, 170);
  g.addColorStop(0, 'rgba(5,8,10,0.55)'); g.addColorStop(1, 'rgba(5,8,10,0)');
  c.fillStyle = g; c.fillRect(0, 0, ANCHO, 170);
  g = c.createLinearGradient(0, ALTO - 240, 0, ALTO);
  g.addColorStop(0, 'rgba(5,8,10,0)'); g.addColorStop(1, 'rgba(5,8,10,0.55)');
  c.fillStyle = g; c.fillRect(0, ALTO - 240, ANCHO, 240);

  // motas de luz (selva)
  J.motas.forEach(m => {
    const x = m.x + Math.sin(t * 0.5 + m.f) * 20, y = m.y + Math.cos(t * 0.4 + m.f) * 14;
    c.fillStyle = `rgba(255,250,200,${0.25 + 0.25 * Math.sin(t * 2 + m.f)})`;
    c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill();
  });

  // viento en la cumbre
  if (z.viento) {
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const x = ((t * 420 + k * 260) % (ANCHO + 300)) - 150, y = 200 + k * 55 + Math.sin(t + k) * 10;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 60, y - 8, x + 120, y); c.stroke();
    }
  }

  // fogata encendida en el campamento
  if (z.id === 'campamento' && J.retos.fuego) {
    const r = 120 + Math.sin(t * 9) * 8;
    const luz = c.createRadialGradient(1192, 505, 10, 1192, 505, r);
    luz.addColorStop(0, 'rgba(255,170,60,0.55)'); luz.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = luz; c.beginPath(); c.arc(1192, 505, r, 0, Math.PI * 2); c.fill();
  }
  J.particulas.forEach(q => {
    const a = q.vida / q.vidaMax;
    c.fillStyle = q.fuego ? `rgba(255,${120 + 100 * a | 0},40,${0.85 * a})` : `rgba(255,255,255,${a})`;
    c.beginPath(); c.arc(q.x, q.y, q.r * (0.5 + a * 0.5), 0, Math.PI * 2); c.fill();
  });

  J.estaciones.forEach(e => dibujarEstacion(c, e, z, t));
  J.objetos.forEach(o => { if (!o.recogido) dibujarObjeto(c, o, z, t); });

  const p = J.jugador;
  dibujarAlek(c, p.x, z.suelo, p.dir, p.fase, p.mov, t);
  dibujarDron(c, J.brisa.x, J.brisa.y, 1, t, p.dir);

  // lluvia real (si en el colegio está lloviendo)
  if (J.lluvia.length) {
    c.strokeStyle = 'rgba(200,225,255,0.45)'; c.lineWidth = 1.2;
    c.beginPath();
    J.lluvia.forEach(d => { c.moveTo(d.x, d.y); c.lineTo(d.x - 4, d.y + 16); });
    c.stroke();
  }

  // indicador de salida
  if (J.zonaIdx < ZONAS.length - 1 && !faltantesZona().total) {
    const x = ANCHO - 70 + Math.sin(t * 5) * 8, y = z.suelo - 70;
    c.fillStyle = 'rgba(0,229,255,0.9)';
    c.font = '700 15px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('CONTINÚA', x, y - 26);
    c.font = '700 40px "Space Grotesk", sans-serif';
    c.fillText('→', x, y + 8);
  }

  // etiqueta del objeto o estación cercana
  if (J.cercano && J.estado === 'juego') {
    const ref = J.cercano.ref;
    if (J.cercano.tipo === 'objeto') {
      const conocido = J.descubiertos.has(ref.id);
      etiqueta(c, ref.x, z.suelo - 150, conocido ? OBJETOS[ref.id].nombre : 'OBJETO SIN IDENTIFICAR', '[E] RECOGER · o di «recoger»', '#00e5ff');
    } else if (J.retos[ref.tipo]) {
      etiqueta(c, ref.x, ref.marcaY - 70, ref.nombre, '✓ RETO SUPERADO', '#6fdc8c');
    } else {
      const req = ref.requiere.map(id => `${OBJETOS[id].emoji}${J.inventario[id] > 0 ? '✓' : '✗'}`).join('  ');
      etiqueta(c, ref.x, ref.marcaY - 70, ref.nombre, `${req}   [E] USAR`, '#e5c384');
    }
  }

  // textos flotantes (+puntos)
  J.flotantes.forEach(f => {
    c.globalAlpha = Math.min(1, f.vida);
    c.font = '700 22px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.strokeText(f.texto, f.x, f.y);
    c.fillStyle = f.color;
    c.fillText(f.texto, f.x, f.y);
    c.globalAlpha = 1;
  });

  if (J.fundido) { c.fillStyle = `rgba(0,0,0,${J.fundido.a})`; c.fillRect(0, 0, ANCHO, ALTO); }
}

function dibujarObjeto(c, o, z, t) {
  const base = z.suelo - 6;
  const pulso = 0.5 + 0.5 * Math.sin(t * 3 + o.fase);
  const brillo = c.createRadialGradient(o.x, base, 2, o.x, base, 46);
  brillo.addColorStop(0, `rgba(0,229,255,${0.35 + 0.25 * pulso})`); brillo.addColorStop(1, 'rgba(0,229,255,0)');
  c.fillStyle = brillo;
  c.beginPath(); c.ellipse(o.x, base, 46, 14, 0, 0, Math.PI * 2); c.fill();
  const y = base - 40 + Math.sin(t * 2 + o.fase) * 6;
  c.save();
  c.font = `46px ${FUENTE_EMOJI}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = 'rgba(0,229,255,0.95)';
  c.shadowBlur = 14 + 10 * pulso;
  c.fillText(OBJETOS[o.id].emoji, o.x, y);
  c.restore();
  // destello
  const d = (t * 1.3 + o.fase) % 3;
  if (d < 0.4) {
    c.strokeStyle = `rgba(255,255,255,${1 - d / 0.4})`; c.lineWidth = 2;
    const sx = o.x + 20, sy = y - 22, s = 4 + d * 20;
    c.beginPath(); c.moveTo(sx - s, sy); c.lineTo(sx + s, sy); c.moveTo(sx, sy - s); c.lineTo(sx, sy + s); c.stroke();
  }
}

function dibujarEstacion(c, e, z, t) {
  const hecho = J.retos[e.tipo];
  const y = e.marcaY + Math.sin(t * 2) * 5;
  c.setLineDash([4, 6]);
  c.strokeStyle = hecho ? 'rgba(111,220,140,0.5)' : 'rgba(229,195,132,0.5)';
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(e.x, y + 26); c.lineTo(e.x, z.suelo - 10); c.stroke();
  c.setLineDash([]);
  c.save();
  c.translate(e.x, y);
  c.rotate(Math.PI / 4);
  c.fillStyle = 'rgba(12,17,20,0.85)';
  c.strokeStyle = hecho ? '#6fdc8c' : '#e5c384';
  c.lineWidth = 2;
  c.fillRect(-22, -22, 44, 44); c.strokeRect(-22, -22, 44, 44);
  c.restore();
  c.font = `24px ${FUENTE_EMOJI}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(hecho ? '✅' : e.icono, e.x, y + 1);
}

function etiqueta(c, x, y, titulo, sub, color) {
  c.font = '700 17px "Space Grotesk", sans-serif';
  const w1 = c.measureText(titulo).width;
  c.font = `600 13px "JetBrains Mono", ${FUENTE_EMOJI}`;
  const w2 = c.measureText(sub).width;
  const w = Math.max(w1, w2) + 30, h = 54;
  const bx = limitar(x - w / 2, 10, ANCHO - w - 10), by = y - h;
  c.fillStyle = 'rgba(12,17,20,0.88)';
  rr(c, bx, by, w, h, 4); c.fill();
  c.strokeStyle = color; c.lineWidth = 1.5; c.stroke();
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.font = '700 17px "Space Grotesk", sans-serif';
  c.fillText(titulo, bx + 15, by + 23);
  c.fillStyle = color;
  c.font = `600 13px "JetBrains Mono", ${FUENTE_EMOJI}`;
  c.fillText(sub, bx + 15, by + 43);
}

// Alek dibujado con formas de Canvas (sin imágenes), con ciclo de caminata
function dibujarAlek(c, x, y, dir, fase, mov, t) {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,0.38)';
  c.beginPath(); c.ellipse(0, 0, 34, 8, 0, 0, Math.PI * 2); c.fill();
  c.scale(dir * 1.2, 1.2);
  const s = mov ? Math.sin(fase) : 0;
  const rebote = mov ? Math.abs(Math.cos(fase)) * 3 : Math.sin(t * 2) * 1;
  c.translate(0, -rebote);
  c.lineWidth = 2;
  c.strokeStyle = '#15100c';
  c.lineJoin = 'round';

  const pierna = (ang, pantalon, bota) => {
    c.save(); c.translate(0, -68); c.rotate(ang);
    c.fillStyle = pantalon; rr(c, -8, 0, 16, 54, 6); c.fill(); c.stroke();
    c.fillStyle = bota; rr(c, -9, 48, 24, 14, 4); c.fill(); c.stroke();
    c.restore();
  };
  const brazo = (ang, manga, reloj) => {
    c.save(); c.translate(0, -116); c.rotate(ang);
    c.fillStyle = manga; rr(c, -6, 0, 12, 36, 6); c.fill(); c.stroke();
    c.fillStyle = '#c68e64'; c.beginPath(); c.arc(0, 40, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
    if (reloj) {
      c.fillStyle = '#0d1114'; c.fillRect(-6, 28, 12, 7);
      c.shadowColor = '#00e5ff'; c.shadowBlur = 12;
      c.fillStyle = '#00e5ff'; c.fillRect(-4, 30, 8, 3);
      c.shadowBlur = 0;
    }
    c.restore();
  };

  pierna(-s * 0.55, '#6c6446', '#3a2a1d');
  brazo(s * 0.6, '#2c3338', false);
  c.fillStyle = '#6b4a2e'; rr(c, -29, -120, 15, 42, 5); c.fill(); c.stroke();          // mochila
  c.fillStyle = '#3a4147'; rr(c, -15, -124, 30, 62, 8); c.fill(); c.stroke();          // camisa
  c.fillStyle = '#55603a'; rr(c, -16, -120, 32, 46, 6); c.fill(); c.stroke();          // chaleco
  c.fillStyle = '#465030';
  [[-12, -104], [3, -104], [-12, -90], [3, -90]].forEach(([a, b]) => c.fillRect(a, b, 10, 9)); // bolsillos
  c.strokeStyle = '#4a3420'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-14, -120); c.lineTo(6, -78); c.stroke();                  // correa
  c.lineWidth = 2; c.strokeStyle = '#15100c';
  c.fillStyle = '#2b2016'; c.fillRect(-15, -68, 30, 6);                                // cinturón
  pierna(s * 0.55, '#857a57', '#4a3424');
  c.fillStyle = '#b97f57'; c.fillRect(-4, -131, 9, 9);                                 // cuello
  c.fillStyle = '#c68e64'; c.beginPath(); c.arc(2, -142, 13, 0, Math.PI * 2); c.fill(); c.stroke(); // cabeza
  c.beginPath(); c.moveTo(14, -145); c.lineTo(18, -139); c.lineTo(13, -138); c.fill(); // nariz
  c.fillStyle = '#111'; c.beginPath(); c.arc(9, -144, 1.8, 0, Math.PI * 2); c.fill();  // ojo
  c.strokeStyle = '#21160e'; c.beginPath(); c.moveTo(6, -149); c.lineTo(12, -149); c.stroke(); // ceja
  c.fillStyle = '#b97f57'; c.beginPath(); c.arc(-3, -141, 3.5, 0, Math.PI * 2); c.fill(); // oreja
  c.fillStyle = '#21160e';                                                              // pelo despeinado
  c.beginPath(); c.arc(1, -145, 14, Math.PI * 0.95, Math.PI * 1.95); c.fill();
  c.beginPath();
  c.moveTo(-13, -146); c.lineTo(-19, -152); c.lineTo(-11, -153); c.lineTo(-12, -161); c.lineTo(-3, -157);
  c.lineTo(0, -164); c.lineTo(5, -157); c.lineTo(13, -161); c.lineTo(12, -152); c.lineTo(17, -148); c.lineTo(9, -151); c.lineTo(-8, -150);
  c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-12, -147); c.lineTo(-14, -134); c.lineTo(-6, -138); c.closePath(); c.fill();
  c.strokeStyle = '#15100c';
  brazo(-s * 0.6, '#3a4147', true);
  c.restore();
}

// BRISA: dron esférico flotante con ojo cian y anillo giratorio
function dibujarDron(c, x, y, escala, t, dir) {
  c.save();
  c.translate(x, y);
  c.scale(escala, escala);
  const halo = c.createRadialGradient(0, 0, 4, 0, 0, 34);
  halo.addColorStop(0, 'rgba(0,229,255,0.35)'); halo.addColorStop(1, 'rgba(0,229,255,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill();
  const giro = Math.sin(t * 3) * 0.15;
  c.strokeStyle = 'rgba(0,229,255,0.85)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 3, 23, 6, giro, Math.PI, Math.PI * 2); c.stroke();          // anillo (atrás)
  c.fillStyle = '#9aa7ad';
  c.beginPath(); c.moveTo(-10, 8); c.lineTo(-16, 16); c.lineTo(-6, 11); c.fill();
  c.beginPath(); c.moveTo(10, 8); c.lineTo(16, 16); c.lineTo(6, 11); c.fill();
  const cuerpo = c.createRadialGradient(-4, -5, 2, 0, 0, 14);
  cuerpo.addColorStop(0, '#ffffff'); cuerpo.addColorStop(0.7, '#cfd8dc'); cuerpo.addColorStop(1, '#6f7c83');
  c.fillStyle = cuerpo; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#263238'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, 13, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
  c.shadowColor = '#00e5ff'; c.shadowBlur = 14;
  c.fillStyle = '#00e5ff'; c.beginPath(); c.arc(dir * 5, -1, 4.6, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(dir * 5 + 1.4, -2.4, 1.3, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(0,229,255,0.85)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 3, 23, 6, giro, 0, Math.PI); c.stroke();                   // anillo (adelante)
  c.restore();
}

// ============================================================ PANTALLA FINAL
function mostrarFinal() {
  J.estado = 'final';
  marcarActividad();
  mostrarPantalla('pantalla-final');
  const pf = $('pantalla-final');
  pf.classList.toggle('gano', J.gano);
  pf.classList.toggle('perdio', !J.gano);
  const fondo = $('final-fondo');
  fondo.style.backgroundImage = `url(${J.gano ? 'assets/img/cine_rescate.jpg' : 'assets/img/menu.jpg'})`;
  fondo.style.filter = J.gano ? '' : 'grayscale(.7) sepia(.4) hue-rotate(-25deg) brightness(.6)';
  $('final-eyebrow').textContent = J.gano ? 'Estado de la operación: éxito total' : 'Estado de la operación: señal vital perdida';
  $('final-titulo').textContent = J.gano ? '¡RESCATADO! Sobreviviste con ciencia' : (J.causa === 'hidratacion' ? 'DESHIDRATACIÓN SEVERA' : 'ENERGÍA AGOTADA');
  $('final-sub').textContent = J.gano ? 'El buque Orión recibió tu señal de auxilio y Alek vuelve a casa.' : 'Alek no alcanzó a pedir rescate. ¡Inténtalo otra vez!';
  $('final-puntos').textContent = formatoPuntos(J.puntos);
  $('final-bono').textContent = J.gano && J.bono ? `(incluye ${formatoPuntos(J.bono)} de bono por rapidez y salud)` : '';
  $('final-tiempo').textContent = formatoTiempo(J.tiempo);
  $('final-objetos').textContent = `${J.descubiertos.size}/${Object.keys(OBJETOS).length}`;
  const retos = Object.values(J.retos).filter(Boolean).length;
  $('final-retos').textContent = `${retos}/3`;
  $('final-insignias').innerHTML = INSIGNIAS.map(i => `<div class="insignia ${J.retos[i.reto] ? 'ok' : ''}"><span class="ico">${i.icono}</span><b>${i.nombre}</b><span>${i.frase}</span></div>`).join('');
  const dato = J.gano ? DATOS_FINALES.victoria : DATOS_FINALES[J.causa];
  $('final-dato').textContent = dato;
  $('input-nombre').value = '';
  $('input-nombre').disabled = false;
  $('btn-guardar-record').disabled = false;
  $('record-estado').textContent = '¡Escribe tu nombre y entra al Salón de la Fama!';
  pintarRankings(Ranking.top, Ranking.nube);
  setTimeout(() => { if (J.estado === 'final') Sensores.hablar(dato); }, 600);
}

function pintarRankings(top, nube) {
  [$('ranking-menu'), $('ranking-final')].forEach(ol => {
    ol.innerHTML = '';
    if (!top.length) { ol.innerHTML = '<li class="li-vacio">Aún no hay récords. ¡Sé el primero!</li>'; return; }
    top.slice(0, 5).forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="pos"></span><span class="nom"></span><span class="pts"></span>';
      li.querySelector('.pos').textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      li.querySelector('.nom').textContent = (r.nombre || 'Anónimo') + (r.gano ? ' 📡' : '');
      li.querySelector('.pts').textContent = formatoPuntos(r.puntaje || 0);
      if (J.miRecord && r.nombre === J.miRecord.nombre && r.puntaje === J.miRecord.puntaje) li.classList.add('mio');
      ol.append(li);
    });
  });
  const txt = nube === null ? 'Conectando con la nube…' : nube ? 'Top 5 de la feria · EN VIVO ☁️' : 'Récords de este computador (sin conexión a la nube)';
  $('ranking-estado-menu').textContent = txt;
  $('ranking-estado-final').textContent = txt;
}

$('form-record').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (J.guardado) return;
  J.guardado = true;
  $('btn-guardar-record').disabled = true;
  $('input-nombre').disabled = true;
  $('record-estado').textContent = 'Guardando…';
  const registro = {
    nombre: Ranking.limpiarNombre($('input-nombre').value.toUpperCase()),
    puntaje: Math.round(J.puntos),
    tiempo: Math.round(J.tiempo),
    objetos: J.descubiertos.size,
    retos: Object.values(J.retos).filter(Boolean).length,
    gano: J.gano
  };
  J.miRecord = { nombre: registro.nombre, puntaje: registro.puntaje };
  const donde = await Ranking.guardar(registro);
  $('record-estado').textContent = donde === 'nube' ? '¡Récord guardado en la nube! ☁️' : 'Récord guardado en este computador.';
  Sonido.logro();
  pintarRankings(Ranking.top, Ranking.nube);
});

// ================================================================ CLIMA
function iconoClima() {
  const k = CLIMA.codigo;
  if (CLIMA.lluvia) return k >= 95 ? '⛈️' : '🌧️';
  if (k === 0) return CLIMA.esDia ? '☀️' : '🌙';
  if (k <= 3) return '⛅';
  if (k === 45 || k === 48) return '🌫️';
  return '☁️';
}

async function cargarClima() {
  try {
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 7000);
    const { lat, lon } = CONFIG.colegio;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,rain,cloud_cover,weather_code,shortwave_radiation,is_day&timezone=auto`;
    const resp = await fetch(url, { signal: control.signal });
    clearTimeout(espera);
    const d = (await resp.json()).current;
    const lluviaCodigos = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
    Object.assign(CLIMA, {
      ok: true,
      temp: d.temperature_2m,
      radiacion: d.shortwave_radiation || 0,
      esDia: d.is_day === 1,
      codigo: d.weather_code,
      lluvia: (d.precipitation || 0) > 0 || (d.rain || 0) > 0 || lluviaCodigos.includes(d.weather_code)
    });
  } catch (e) {
    CLIMA.ok = false;
  }
  const ciudad = CONFIG.colegio.ciudad;
  const texto = CLIMA.ok
    ? `${iconoClima()} ${ciudad} ahora: ${CLIMA.temp.toFixed(1).replace('.', ',')} °C · ☀ ${Math.round(CLIMA.radiacion)} W/m²${CLIMA.lluvia ? ' · lloviendo' : ''}`
    : '☁️ Clima real sin conexión';
  $('chip-clima-menu').textContent = CLIMA.ok ? `Clima REAL · ${texto}` : texto;
  $('hud-clima').textContent = texto;
}

// ============================================================== ENTRADAS
function manejarTecla(k) {
  marcarActividad();
  if (k === 'f') { alternarPantallaCompleta(); return; }
  switch (J.estado) {
    case 'juego':
      if (k === 'e' || k === 'enter') interactuar();
      else if (k === '1') usarConsumible('coco');
      else if (k === '2') usarConsumible('fruta');
      else if (k === 'escape' || k === 'p') pausar();
      break;
    case 'tarjeta':
      if (k === 'e' || k === 'enter' || k === 'escape') Tarjeta.cerrar();
      else if (k === 'r') Tarjeta.repetir();
      else if (k === 'a') Tarjeta.siguienteAtomo();
      else if (k === 'm') Tarjeta.verMolecula();
      break;
    case 'minijuego':
      if (k === 'escape' || k === 'p') pausar();
      else Minijuego.tecla(k);
      break;
    case 'pausa':
      if (k === 'escape' || k === 'p') reanudar();
      break;
    case 'cine':
      if (k === 'enter' || k === 'escape' || k === ' ' || k === 'e') Cinematica.saltar();
      break;
    case 'final':
      if (k === 'r') reiniciarDesdeFinal();
      break;
    case 'menu':
      if ($('ov-ayuda').classList.contains('visible') && (k === 'escape' || k === 'enter')) $('ov-ayuda').classList.remove('visible');
      break;
  }
}

addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT') return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') teclas.izq = true;
  if (k === 'arrowright' || k === 'd') teclas.der = true;
  if (k === ' ') teclas.espacio = true;
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) ev.preventDefault();
  if (ev.repeat) return;
  // 'a' mueve a la izquierda en el juego, pero en la tarjeta muestra los átomos
  if (k === 'a' && J.estado !== 'tarjeta') return;
  manejarTecla(k === 'arrowleft' || k === 'arrowright' ? '' : k);
});
addEventListener('keyup', (ev) => {
  const k = ev.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') teclas.izq = false;
  if (k === 'arrowright' || k === 'd') teclas.der = false;
  if (k === ' ') teclas.espacio = false;
});
addEventListener('blur', () => { teclas.izq = teclas.der = teclas.espacio = false; });
addEventListener('pointerdown', marcarActividad);

// Controles táctiles (celular / tablet)
document.querySelectorAll('#tactil [data-mantener]').forEach(b => {
  const t = b.dataset.mantener;
  const on = (ev) => { ev.preventDefault(); teclas[t] = true; marcarActividad(); };
  const off = () => { teclas[t] = false; };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => b.addEventListener(n, off));
});
document.querySelectorAll('#tactil [data-tecla]').forEach(b => {
  b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); manejarTecla(b.dataset.tecla); });
});

// Clics en el lienzo de los retos (circuito)
$('mini-lienzo').addEventListener('pointerdown', (ev) => {
  const r = ev.currentTarget.getBoundingClientRect();
  Minijuego.clic((ev.clientX - r.left) / r.width * Minijuego.W, (ev.clientY - r.top) / r.height * Minijuego.H);
});

// Comandos de voz → acciones del juego
Sensores.alComando = (cmd) => {
  marcarActividad();
  if (J.estado === 'sensores') {
    const nombres = { accion: 'recoger / usar', cerrar: 'listo', repetir: '¿qué es?', beber: 'beber', comer: 'comer', chispa: 'chispa', auxilio: 'auxilio', pausa: 'pausa' };
    $('sens-voz-estado').textContent = `Te entendí: «${nombres[cmd] || cmd}» ✓`;
    Sonido.puntos();
  } else if (J.estado === 'juego') {
    if (cmd === 'accion') interactuar();
    else if (cmd === 'beber') usarConsumible('coco');
    else if (cmd === 'comer') usarConsumible('fruta');
    else if (cmd === 'pausa') pausar();
  } else if (J.estado === 'tarjeta') {
    if (cmd === 'cerrar' || cmd === 'accion') Tarjeta.cerrar();
    else if (cmd === 'repetir') Tarjeta.repetir();
  } else if (J.estado === 'minijuego') {
    Minijuego.comando(cmd);
  }
};

// ------------------------------------------------------------- BOTONES
$('btn-jugar').addEventListener('click', () => {
  Sonido.contexto();
  Sensores.prepararVoces();
  J.estado = 'cine';
  Cinematica.reproducir(ESCENAS_INTRO, irASensores);
});
$('btn-saltar').addEventListener('click', () => Cinematica.saltar());
$('btn-como').addEventListener('click', () => $('ov-ayuda').classList.add('visible'));
$('btn-cerrar-ayuda').addEventListener('click', () => $('ov-ayuda').classList.remove('visible'));
$('btn-pantalla').addEventListener('click', alternarPantallaCompleta);

function irASensores() {
  J.estado = 'sensores';
  mostrarPantalla('pantalla-sensores');
  if (!Sensores.voz.soportado) $('sens-voz-estado').textContent = 'No disponible en este navegador (usa Google Chrome).';
  $('sens-tts-estado').textContent = Sensores.tts.voz ? `Voz: ${Sensores.tts.voz.name}` : (Sensores.tts.soportado ? 'Voz del sistema' : 'Sin voz en este navegador');
}

$('btn-mic').addEventListener('click', async () => {
  $('sens-mic-estado').textContent = 'Pidiendo permiso…';
  const ok = await Sensores.activarMicrofono();
  if (!ok) { $('sens-mic-estado').textContent = Sensores.mic.error; return; }
  $('sens-mic-estado').textContent = 'Calibrando: guarda silencio 2 segundos…';
  await Sensores.calibrar();
  $('sens-mic-estado').textContent = 'Activo ✓ · Sopla al micrófono para probarlo';
  $('btn-mic').textContent = 'MICRÓFONO ACTIVO ✓';
  $('btn-mic').disabled = true;
});
$('btn-calibrar').addEventListener('click', async () => {
  if (!Sensores.mic.activo) { $('sens-mic-estado').textContent = 'Primero activa el micrófono.'; return; }
  $('sens-mic-estado').textContent = 'Silencio, por favor…';
  await Sensores.calibrar();
  $('sens-mic-estado').textContent = 'Calibrado ✓';
});
$('btn-voz').addEventListener('click', () => {
  const ok = Sensores.iniciarVoz();
  $('sens-voz-estado').textContent = ok ? 'Escuchando ✓ · Prueba diciendo «recoger»' : Sensores.voz.error;
  if (ok) { $('btn-voz').textContent = 'VOZ ACTIVA ✓'; $('btn-voz').disabled = true; }
});
$('btn-probar-voz').addEventListener('click', () => {
  Sensores.prepararVoces();
  Sensores.hablar('Hola, soy Brisa. Voy a escanear cada objeto que encuentres y te diré de qué átomos está hecho.');
  $('sens-tts-estado').textContent = Sensores.tts.voz ? `Voz: ${Sensores.tts.voz.name}` : 'Voz del sistema';
});
$('btn-comenzar').addEventListener('click', comenzarMision);

$('btn-guardar-obj').addEventListener('click', () => Tarjeta.cerrar());
$('btn-continuar').addEventListener('click', reanudar);
$('btn-ayuda-pausa').addEventListener('click', () => $('ov-ayuda').classList.add('visible'));
$('btn-reiniciar').addEventListener('click', () => {
  $('ov-pausa').classList.remove('visible');
  $('ov-mini').classList.remove('visible');
  Minijuego.tipo = null;
  comenzarMision();
});
$('btn-menu-pausa').addEventListener('click', irAlMenu);
$('btn-menu-final').addEventListener('click', irAlMenu);
$('btn-reintentar').addEventListener('click', reiniciarDesdeFinal);

function reiniciarDesdeFinal() {
  if (J.estado !== 'final') return;
  comenzarMision();
}

// ============================================================ BUCLE PRINCIPAL
const avatar = $('brisa-avatar').getContext('2d');
let ultimoT = performance.now();

function bucle(ahora) {
  const dt = Math.min(0.05, (ahora - ultimoT) / 1000);
  ultimoT = ahora;
  J.t += dt;
  Sensores.actualizar(dt);

  if (J.estado === 'juego') actualizarJuego(dt);
  else if (J.estado === 'tarjeta') J.tiempo += dt;
  else if (J.estado === 'minijuego') { J.tiempo += dt; Minijuego.actualizar(dt); }

  if (pantallaActual === 'pantalla-juego' && J.jugador) {
    dibujarMundo();
    actualizarHUD();
  }
  if (pantallaActual === 'pantalla-sensores') {
    const v = Sensores.intensidad();
    $('sens-mic-barra').style.width = Math.round(v * 100) + '%';
    if (Sensores.voz.activa) $('sens-voz-oido').textContent = Sensores.voz.ultimo || '—';
    avatar.setTransform(1, 0, 0, 1, 0, 0);
    avatar.clearRect(0, 0, 240, 160);
    dibujarDron(avatar, 120, 80 + Math.sin(J.t * 2) * 6, 2.6, J.t, Math.sin(J.t * 0.7) > 0 ? 1 : -1);
  }
  requestAnimationFrame(bucle);
}

// Si nadie juega por un rato, el juego vuelve solo al menú (modo stand)
setInterval(() => {
  const inactivo = performance.now() - J.ultimaActividad;
  if (J.estado === 'final' && inactivo > 60000) irAlMenu();
  if (['juego', 'tarjeta', 'minijuego', 'pausa'].includes(J.estado) && inactivo > 150000) irAlMenu();
}, 1000);

// ============================================================== ARRANQUE
Ranking.alCambiar(pintarRankings);
Ranking.iniciar();
cargarClima();
setInterval(cargarClima, 10 * 60 * 1000);
Sensores.prepararVoces();
requestAnimationFrame(bucle);
