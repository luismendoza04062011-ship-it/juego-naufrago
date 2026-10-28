// =====================================================================
//  personajes.js → Alek, BRISA y el helicóptero de rescate.
//  Todo se dibuja con formas de Canvas (sin imágenes). Alek tiene un
//  "esqueleto" con articulaciones (cadera, rodillas, hombros y codos),
//  así que puede caminar, agacharse, celebrar o colgar de un cable.
// =====================================================================

const ESCALA_ALEK = 0.9;   // tamaño de Alek en los niveles (mide unos 160 px)
const PIEL = { base: '#c98f63', sombra: '#a46c47', luz: '#e3ad80' };
const COLOR_ALEK = {
  contorno: '#1b130d',
  pelo: '#24170f', peloLuz: '#5b3e29',
  camisa: '#3f4b56', camisaSombra: '#29323a', puno: '#5a6772',
  chaleco: '#62743f', chalecoSombra: '#45532d', chalecoLuz: '#7e9254',
  pantalon: '#95875c', pantalonSombra: '#6c6142', pantalonLejos: '#615840', pantalonLejosSombra: '#4a4330',
  bota: '#503624', botaLejos: '#3b2a1c', suela: '#21150c', cordon: '#cdb98d',
  mochila: '#80593a', mochilaSombra: '#5b3e24', manta: '#2d7476', mantaLinea: '#e5c384',
  cinturon: '#2a1e14', hebilla: '#cfb67c'
};

function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Rectángulo redondeado con sombreado (luz desde el frente)
function capsula(c, x, y, w, h, claro, oscuro) {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, oscuro);
  g.addColorStop(0.6, claro);
  g.addColorStop(1, claro);
  c.fillStyle = g;
  rrect(c, x, y, w, h, Math.min(w, h) / 2);
  c.fill();
  c.stroke();
}

const suave = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

// ------------------------------------------------------------------ POSES
// Ángulos en radianes. Para piernas y brazos: 0 = colgando hacia abajo,
// negativo = hacia adelante, positivo = hacia atrás.
// Índice 0 = extremidad lejana (atrás), índice 1 = la cercana (adelante).
function calcularPose(a) {
  const t = a.t;
  const P = {
    agache: 0, inclinacion: 0.03, cabeza: 0,
    rebote: Math.sin(t * 2) * 0.8, // respiración
    piernas: [{ muslo: 0.05, rodilla: 0.08 }, { muslo: -0.05, rodilla: 0.06 }],
    brazos: [{ hombro: 0.14 + Math.sin(t * 2) * 0.03, codo: -0.2 }, { hombro: 0.02 - Math.sin(t * 2) * 0.03, codo: -0.28 }],
    parpadeo: (t % 4.3) < 0.13
  };

  if (a.mov) {
    const f = a.fase;
    [f + Math.PI, f].forEach((ph, i) => {
      P.piernas[i].muslo = -0.52 * Math.sin(ph);
      P.piernas[i].rodilla = 0.08 + 0.95 * Math.pow(Math.max(0, Math.cos(ph)), 1.4);
    });
    P.brazos[1].hombro = 0.48 * Math.sin(f);
    P.brazos[0].hombro = -0.48 * Math.sin(f);
    P.brazos.forEach(b => { b.codo = -0.2 - 0.6 * Math.max(0, -b.hombro); });
    P.rebote = 2.2 * Math.cos(2 * f);
    P.inclinacion = 0.08;
  }

  if (a.aire) {
    // en el aire: piernas recogidas al subir y estiradas al caer
    const subiendo = a.vy < 0;
    P.piernas[1] = { muslo: -0.8, rodilla: subiendo ? 1.15 : 0.5 };
    P.piernas[0] = { muslo: 0.35, rodilla: subiendo ? 0.95 : 0.4 };
    P.brazos[1] = { hombro: subiendo ? -2.2 : -1.3, codo: -0.4 };
    P.brazos[0] = { hombro: subiendo ? 0.7 : -0.7, codo: -0.5 };
    P.rebote = 0;
    P.inclinacion = 0.05;
  }

  if (a.cansado) { P.inclinacion += 0.16; P.cabeza = 0.2; }

  const k = a.poseT || 0;
  if (a.pose === 'recoger') {
    // se agacha (0–0.35), toma el objeto, se levanta (0.55–0.85) y lo muestra
    const bajar = k < 0.35 ? suave(k / 0.35) : k < 0.55 ? 1 : 1 - suave((k - 0.55) / 0.3);
    const subir = k < 0.55 ? 0 : suave((k - 0.55) / 0.3);
    P.agache = 24 * bajar;
    P.inclinacion = 0.03 + 0.52 * bajar;
    P.piernas[1] = { muslo: -1.0 * bajar - 0.03, rodilla: 1.75 * bajar + 0.06 };
    P.piernas[0] = { muslo: -0.55 * bajar + 0.05, rodilla: 1.5 * bajar + 0.08 };
    P.brazos[1] = { hombro: -0.9 * bajar - 2.5 * subir, codo: -0.15 - 0.25 * subir };
    P.brazos[0] = { hombro: 0.12 + 0.3 * bajar, codo: -0.3 };
    P.cabeza = 0.28 * bajar - 0.2 * subir;
    P.rebote = 0;
  } else if (a.pose === 'celebrar') {
    P.brazos[0] = { hombro: -2.75 + Math.sin(t * 11) * 0.22, codo: -0.25 };
    P.brazos[1] = { hombro: -2.85 + Math.sin(t * 11 + 1) * 0.22, codo: -0.25 };
    P.rebote = Math.abs(Math.sin(t * 7)) * 7;
    P.cabeza = -0.15;
    P.inclinacion = 0;
  } else if (a.pose === 'saludo') {
    P.brazos[1] = { hombro: -2.7 + Math.sin(t * 9) * 0.35, codo: -0.5 };
    P.cabeza = -0.25;
    P.inclinacion = -0.02;
  } else if (a.pose === 'colgado') {
    P.brazos[0] = { hombro: -3.05, codo: 0 };
    P.brazos[1] = { hombro: -3.0, codo: 0 };
    P.piernas[0] = { muslo: 0.12 * Math.sin(t * 3), rodilla: 0.35 };
    P.piernas[1] = { muslo: -0.18 * Math.sin(t * 3 + 1), rodilla: 0.25 };
    P.cabeza = -0.3;
    P.inclinacion = 0;
    P.rebote = 0;
  }
  return P;
}

// ------------------------------------------------------------------ ALEK
// a = { dir, fase, mov, t, pose, poseT, cansado, item, elevado }
function dibujarAlek(c, x, y, a) {
  const P = calcularPose(a);
  const ESCALA = a.escala || ESCALA_ALEK;
  c.save();
  c.translate(x, y);
  if (!a.elevado) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(0, 0, 34 + P.agache * 0.5, 8, 0, 0, Math.PI * 2); c.fill();
  }
  c.scale(a.dir * ESCALA, ESCALA);
  c.translate(0, -P.rebote + P.agache);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = 1.6;
  c.strokeStyle = COLOR_ALEK.contorno;

  // la parte de arriba gira (se inclina) alrededor de la cadera
  const arriba = (dibujo) => { c.save(); c.translate(0, -80); c.rotate(P.inclinacion); dibujo(); c.restore(); };

  arriba(() => brazoAlek(c, P.brazos[0], false, a, P));
  piernaAlek(c, P.piernas[0], false);
  piernaAlek(c, P.piernas[1], true);
  arriba(() => {
    mochilaAlek(c);
    torsoAlek(c);
    cabezaAlek(c, P);
    brazoAlek(c, P.brazos[1], true, a, P);
  });
  c.restore();
}

function piernaAlek(c, pl, cerca) {
  const C = COLOR_ALEK;
  const claro = cerca ? C.pantalon : C.pantalonLejos;
  const oscuro = cerca ? C.pantalonSombra : C.pantalonLejosSombra;
  c.save();
  c.translate(cerca ? 2 : -3, -80);
  c.rotate(pl.muslo);
  capsula(c, -8.5, -6, 17, 47, claro, oscuro);                       // muslo
  if (cerca) {                                                       // bolsillo cargo
    c.fillStyle = oscuro;
    rrect(c, -1, 13, 9, 14, 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-1, 17); c.lineTo(8, 17); c.stroke();
  }
  c.translate(0, 38);
  c.rotate(pl.rodilla);
  capsula(c, -7.5, -5, 15, 42, claro, oscuro);                       // pantorrilla
  c.translate(0, 34);
  c.rotate(-(pl.muslo + pl.rodilla) * 0.9);                          // el pie queda casi plano
  c.fillStyle = cerca ? C.bota : C.botaLejos;
  c.beginPath();
  c.moveTo(-8, -7); c.lineTo(6, -7);
  c.quadraticCurveTo(10, -1, 18, 1);
  c.quadraticCurveTo(21.5, 3, 20.5, 7);
  c.lineTo(-9, 7);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = C.suela;
  c.fillRect(-9.5, 6.5, 30.5, 3.5);
  if (cerca) {
    c.strokeStyle = C.cordon; c.lineWidth = 1;
    [[2, -5, 6, -3], [4, -2.5, 8, -0.5]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
    c.strokeStyle = C.contorno; c.lineWidth = 1.6;
  }
  c.restore();
}

function mochilaAlek(c) {
  const C = COLOR_ALEK;
  const g = c.createLinearGradient(-32, 0, -12, 0);
  g.addColorStop(0, C.mochilaSombra); g.addColorStop(1, C.mochila);
  c.fillStyle = g;
  rrect(c, -31, -54, 19, 44, 6); c.fill(); c.stroke();
  c.fillStyle = C.mochilaSombra;
  rrect(c, -31, -54, 19, 14, 5); c.fill(); c.stroke();               // tapa
  c.fillStyle = C.hebilla; c.fillRect(-23, -42, 4, 4);
  c.fillStyle = C.manta;                                             // manta enrollada
  rrect(c, -35, -64, 26, 11, 5.5); c.fill(); c.stroke();
  c.strokeStyle = C.mantaLinea; c.lineWidth = 1.4;
  [-28, -17].forEach(px => { c.beginPath(); c.moveTo(px, -63); c.lineTo(px, -54); c.stroke(); });
  c.strokeStyle = C.contorno; c.lineWidth = 1.6;
}

function torsoAlek(c) {
  const C = COLOR_ALEK;
  // cuello
  c.fillStyle = PIEL.sombra;
  rrect(c, -1.5, -66, 9, 12, 3); c.fill(); c.stroke();
  // camisa
  let g = c.createLinearGradient(-15, 0, 17, 0);
  g.addColorStop(0, C.camisaSombra); g.addColorStop(0.65, C.camisa); g.addColorStop(1, C.camisa);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-13, 2); c.lineTo(-15, -50);
  c.quadraticCurveTo(-14, -58, -4, -59); c.lineTo(8, -59);
  c.quadraticCurveTo(16, -57, 16, -48);
  c.quadraticCurveTo(18, -30, 13, 2);
  c.closePath(); c.fill(); c.stroke();
  // chaleco con cuello en V
  g = c.createLinearGradient(-15, 0, 17, 0);
  g.addColorStop(0, C.chalecoSombra); g.addColorStop(0.6, C.chaleco); g.addColorStop(1, C.chalecoLuz);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-14, -9); c.lineTo(-15, -50);
  c.quadraticCurveTo(-13, -57, -5, -57); c.lineTo(-1, -57);
  c.lineTo(4, -41); c.lineTo(9, -57);
  c.quadraticCurveTo(16, -55, 16, -46);
  c.quadraticCurveTo(17.5, -28, 14, -9);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(4, -41); c.lineTo(5, -10); c.stroke();     // cremallera
  c.fillStyle = C.chalecoSombra;                                     // bolsillos
  [[6.5, -37, 8, 9], [-11, -37, 8, 9], [6, -24, 9, 10]].forEach(([px, py, w, h]) => {
    rrect(c, px, py, w, h, 1.5); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(px, py + 3); c.lineTo(px + w, py + 3); c.stroke();
  });
  // correa de la mochila cruzando el pecho
  c.strokeStyle = C.mochilaSombra; c.lineWidth = 3.4;
  c.beginPath(); c.moveTo(-12, -57); c.quadraticCurveTo(-2, -47, 6, -30); c.stroke();
  c.strokeStyle = C.contorno; c.lineWidth = 1.6;
  // cinturón con hebilla
  c.fillStyle = C.cinturon; c.fillRect(-14, -5, 28.5, 7); c.strokeRect(-14, -5, 28.5, 7);
  c.fillStyle = C.hebilla; c.fillRect(7, -5, 6, 7); c.strokeRect(7, -5, 6, 7);
}

function cabezaAlek(c, P) {
  const C = COLOR_ALEK;
  c.save();
  c.translate(4, -73);
  c.rotate(P.cabeza);
  // cara y cráneo (perfil mirando a la derecha)
  const g = c.createRadialGradient(7, -5, 2, 2, 0, 19);
  g.addColorStop(0, PIEL.luz); g.addColorStop(0.55, PIEL.base); g.addColorStop(1, PIEL.sombra);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-12, 6);
  c.quadraticCurveTo(-16, -10, -4, -15);
  c.quadraticCurveTo(8, -18, 12, -8);
  c.quadraticCurveTo(13, -4, 13.5, -3);
  c.lineTo(17.5, 2.5);
  c.lineTo(13.5, 4.5);
  c.quadraticCurveTo(14.5, 7, 13.5, 8.5);
  c.quadraticCurveTo(13.5, 12.5, 9, 13.5);
  c.quadraticCurveTo(2, 14.5, -3, 10);
  c.closePath(); c.fill(); c.stroke();
  // barba de unos días (es náufrago)
  c.fillStyle = 'rgba(45,28,18,0.2)';
  c.beginPath(); c.moveTo(1, 9); c.quadraticCurveTo(6, 14, 12, 12.5); c.lineTo(13.5, 8.5); c.quadraticCurveTo(8, 9, 3, 5); c.closePath(); c.fill();
  // pelo despeinado
  c.fillStyle = C.pelo;
  c.beginPath();
  c.moveTo(12.5, -7);
  c.lineTo(15.5, -10); c.lineTo(10, -11.5);
  c.lineTo(11, -18); c.lineTo(5, -15);
  c.lineTo(3, -22); c.lineTo(-2, -16.5);
  c.lineTo(-8, -21); c.lineTo(-9.5, -14.5);
  c.lineTo(-17, -15); c.lineTo(-14, -8);
  c.lineTo(-19.5, -4.5); c.lineTo(-14, -1);
  c.lineTo(-16.5, 5); c.lineTo(-11, 4);
  c.lineTo(-9, 9);
  c.quadraticCurveTo(-6, -2, -1, -6);
  c.quadraticCurveTo(4, -10, 12.5, -7);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = C.peloLuz; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-9, -12); c.quadraticCurveTo(-3, -16, 4, -15); c.stroke();
  c.beginPath(); c.moveTo(-12, -5); c.quadraticCurveTo(-8, -9, -3, -9); c.stroke();
  c.strokeStyle = C.contorno; c.lineWidth = 1.6;
  // oreja
  c.fillStyle = PIEL.sombra;
  c.beginPath(); c.ellipse(-2, 1.5, 3.4, 4.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(-1.6, 1.5, 1.6, -1.2, 1.2); c.stroke();
  // ojo (parpadea de vez en cuando)
  if (P.parpadeo) {
    c.beginPath(); c.moveTo(6.5, -3); c.lineTo(11, -2.6); c.stroke();
  } else {
    c.fillStyle = '#f4efe6';
    c.beginPath(); c.ellipse(8.6, -3, 2.9, 2.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b1a10';
    c.beginPath(); c.arc(9.7, -3, 1.55, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(10.2, -3.6, 0.55, 0, Math.PI * 2); c.fill();
  }
  // ceja y boca
  c.strokeStyle = C.pelo; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(5.5, -7.4); c.lineTo(12, -6.8); c.stroke();
  c.strokeStyle = '#7a4330'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(11.2, 9.2); c.lineTo(13.4, 8.7); c.stroke();
  c.strokeStyle = C.contorno; c.lineWidth = 1.6;
  c.restore();
}

function brazoAlek(c, b, cerca, a, P) {
  const C = COLOR_ALEK;
  c.save();
  c.translate(cerca ? 3 : -1, -54);
  c.rotate(b.hombro);
  capsula(c, -6.5, -5, 13, 33, cerca ? C.camisa : C.camisaSombra, C.camisaSombra);   // brazo (manga)
  c.fillStyle = cerca ? C.puno : C.camisaSombra;
  rrect(c, -7, 20, 14, 7, 3); c.fill(); c.stroke();                                 // manga arremangada
  c.translate(0, 27);
  c.rotate(b.codo);
  capsula(c, -5, -3, 10, 29, cerca ? PIEL.base : PIEL.sombra, PIEL.sombra);         // antebrazo
  if (cerca) {                                                                       // reloj holográfico
    c.fillStyle = '#0d1114';
    rrect(c, -6, 15, 12, 7, 2); c.fill(); c.stroke();
    c.shadowColor = '#00e5ff'; c.shadowBlur = 12;
    c.fillStyle = '#00e5ff'; c.fillRect(-3.5, 16.8, 7, 3.2);
    c.shadowBlur = 0;
  }
  c.translate(0, 27);
  c.fillStyle = cerca ? PIEL.base : PIEL.sombra;                                     // mano
  c.beginPath(); c.arc(0, 0, 5.6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.arc(3.6, -2.6, 2.2, 0, Math.PI * 2); c.fill(); c.stroke();
  // objeto en la mano (siempre derecho y sin reflejarse)
  if (cerca && a.item) {
    c.rotate(-(P.inclinacion + b.hombro + b.codo));
    c.scale(a.dir, 1);
    c.font = `30px ${'"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,229,255,0.95)'; c.shadowBlur = 16;
    c.fillText(a.item, 0, -16);
    c.shadowBlur = 0;
  }
  c.restore();
}

// ------------------------------------------------------------------ BRISA
// Dron esférico flotante con ojo cian y anillo giratorio
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

// ------------------------------------------------------------ HELICÓPTERO
// Mira hacia la izquierda. El cable del rescate sale del punto (16, -24).
function dibujarHelicoptero(c, x, y, t, inclinacion) {
  c.save();
  c.translate(x, y);
  c.rotate(inclinacion);
  c.lineJoin = 'round';
  c.strokeStyle = '#1d2327';
  c.lineWidth = 2;
  // cola y aleta
  c.fillStyle = '#e9edf0';
  c.beginPath(); c.moveTo(40, -26); c.lineTo(176, -17); c.lineTo(179, -6); c.lineTo(40, 2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8572a';
  c.beginPath(); c.moveTo(164, -16); c.lineTo(184, -50); c.lineTo(197, -48); c.lineTo(183, -8); c.closePath(); c.fill(); c.stroke();
  // rotor de cola
  c.fillStyle = 'rgba(210,215,220,0.35)';
  c.beginPath(); c.arc(190, -30, 16, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(30,35,40,0.8)'; c.lineWidth = 2.5;
  const ac = t * 45;
  c.beginPath(); c.moveTo(190 - Math.cos(ac) * 16, -30 - Math.sin(ac) * 16); c.lineTo(190 + Math.cos(ac) * 16, -30 + Math.sin(ac) * 16); c.stroke();
  c.strokeStyle = '#1d2327'; c.lineWidth = 2;
  // fuselaje blanco con franja naranja
  const g = c.createLinearGradient(0, -44, 0, 30);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bfc8ce');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-112, 6);
  c.quadraticCurveTo(-118, -18, -88, -36);
  c.lineTo(20, -43);
  c.quadraticCurveTo(54, -41, 60, -18);
  c.lineTo(58, 14);
  c.quadraticCurveTo(10, 31, -70, 27);
  c.quadraticCurveTo(-104, 25, -112, 6);
  c.closePath();
  c.fill();
  c.save(); c.clip();
  c.fillStyle = '#e8572a'; c.fillRect(-125, 5, 200, 11);
  c.restore();
  c.stroke();
  // cabina de vidrio
  const v = c.createLinearGradient(-110, -30, -60, 0);
  v.addColorStop(0, '#9ff3ff'); v.addColorStop(1, '#1f6f86');
  c.fillStyle = v;
  c.beginPath(); c.moveTo(-108, 2); c.quadraticCurveTo(-110, -17, -86, -30); c.lineTo(-58, -33); c.lineTo(-58, 2); c.closePath(); c.fill(); c.stroke();
  // puerta abierta
  c.fillStyle = '#172026';
  rrect(c, -36, -33, 42, 35, 3); c.fill(); c.stroke();
  // texto
  c.fillStyle = '#ffffff'; c.font = '700 9px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('RESCATE', 32, 10.5);
  // grúa del cable
  c.strokeStyle = '#4a545a'; c.lineWidth = 3.5;
  c.beginPath(); c.moveTo(4, -31); c.lineTo(16, -31); c.lineTo(16, -24); c.stroke();
  // patines
  c.strokeStyle = '#3a4147'; c.lineWidth = 3;
  [[-70, 26], [30, 24]].forEach(([px, py]) => { c.beginPath(); c.moveTo(px, py); c.lineTo(px, 38); c.stroke(); });
  c.beginPath(); c.moveTo(-98, 34); c.quadraticCurveTo(-96, 39, -88, 39); c.lineTo(52, 39); c.stroke();
  // mástil y rotor principal
  c.fillStyle = '#3a4147'; c.fillRect(-10, -53, 14, 11);
  c.fillStyle = 'rgba(30,35,40,0.22)';
  c.beginPath(); c.ellipse(-3, -55, 155, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(25,30,34,0.75)'; c.lineWidth = 3;
  const ar = t * 38;
  [0, Math.PI / 2].forEach(d => {
    const L = Math.cos(ar + d) * 155;
    c.beginPath(); c.moveTo(-3 - L, -55); c.lineTo(-3 + L, -55); c.stroke();
  });
  // luces de navegación
  const parpadeo = (t % 1) < 0.5;
  c.fillStyle = parpadeo ? '#ff3b3b' : '#5a1010'; c.beginPath(); c.arc(178, -11, 3, 0, Math.PI * 2); c.fill();
  c.fillStyle = parpadeo ? '#5a1010' : '#ff3b3b'; c.beginPath(); c.arc(-4, 22, 2.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(-92, 20, 4, 0, Math.PI * 2); c.fill();     // reflector
  c.restore();
}
