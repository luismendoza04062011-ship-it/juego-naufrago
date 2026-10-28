// =====================================================================
//  NÁUFRAGO · La Ciencia de Sobrevivir
//  data.js → TODO el contenido científico y la configuración del juego.
//  Si quieres cambiar un texto de BRISA, un objeto o la dificultad,
//  este es el único archivo que hay que tocar.
// =====================================================================

const CONFIG = {
  // Ubicación del colegio para leer el clima REAL con la API de Open-Meteo.
  // (Bogotá por defecto; cambia lat/lon si el colegio está en otra ciudad)
  colegio: { ciudad: 'Bogotá', lat: 4.61, lon: -74.08 },

  // Dificultad: segundos que tarda cada barra en bajar de 100 a 0
  // (solo baja mientras Alek explora; se detiene en tarjetas y retos).
  segundosHidratacion: 120,
  segundosEnergia: 160,

  velocidadAlek: 270, // píxeles por segundo

  // Firebase (proyecto naufrago-juego)
  firebase: {
    apiKey: 'AIzaSyB_5DAa8Oiux2XMxUMgWNo9waTSyjSxcg4',
    authDomain: 'naufrago-juego.firebaseapp.com',
    projectId: 'naufrago-juego',
    storageBucket: 'naufrago-juego.firebasestorage.app',
    messagingSenderId: '667873125239',
    appId: '1:667873125239:web:935ac00bccb12976bab772'
  },
  coleccionRanking: 'records_feria',

  // Dirección pública del juego (la que abre el código QR)
  urlPublica: 'https://luismendoza04062011-ship-it.github.io/juego-naufrago/'
};

// ---------------------------------------------------------------------
//  TABLA PERIÓDICA (solo los elementos que aparecen en el juego)
//  capas = electrones por capa (modelo de Bohr) para el visor de átomos
// ---------------------------------------------------------------------
const ELEMENTOS = {
  H:  { nombre: 'Hidrógeno', protones: 1,  color: '#f4f6f8', r: 9,  capas: [1] },
  C:  { nombre: 'Carbono',   protones: 6,  color: '#5b6168', r: 13, capas: [2, 4] },
  N:  { nombre: 'Nitrógeno', protones: 7,  color: '#4a72ff', r: 12, capas: [2, 5] },
  O:  { nombre: 'Oxígeno',   protones: 8,  color: '#ff4040', r: 12, capas: [2, 6] },
  Na: { nombre: 'Sodio',     protones: 11, color: '#b06cf5', r: 16, capas: [2, 8, 1] },
  Si: { nombre: 'Silicio',   protones: 14, color: '#e8c39e', r: 15, capas: [2, 8, 4] },
  S:  { nombre: 'Azufre',    protones: 16, color: '#f2dc3c', r: 15, capas: [2, 8, 6] },
  Cl: { nombre: 'Cloro',     protones: 17, color: '#3edc5a', r: 15, capas: [2, 8, 7] },
  K:  { nombre: 'Potasio',   protones: 19, color: '#9a50e0', r: 17, capas: [2, 8, 8, 1] },
  Fe: { nombre: 'Hierro',    protones: 26, color: '#e06633', r: 14, capas: [2, 8, 14, 2] },
  Cu: { nombre: 'Cobre',     protones: 29, color: '#d68a4c', r: 14, capas: [2, 8, 18, 1] },
  Ga: { nombre: 'Galio',     protones: 31, color: '#c99393', r: 15, capas: [2, 8, 18, 3] },
  Pb: { nombre: 'Plomo',     protones: 82, color: '#8d939c', r: 17, capas: [2, 8, 18, 32, 18, 4] }
};

// ---------------------------------------------------------------------
//  MOLÉCULAS (modelos simplificados en 3D para el Escáner Atómico)
//  atomos: [símbolo, x, y, z, carga?]   enlaces: [i, j, orden]
// ---------------------------------------------------------------------
function centrarMolecula(mol) {
  const n = mol.atomos.length;
  const cx = mol.atomos.reduce((s, a) => s + a[1], 0) / n;
  const cy = mol.atomos.reduce((s, a) => s + a[2], 0) / n;
  const cz = mol.atomos.reduce((s, a) => s + a[3], 0) / n;
  mol.atomos = mol.atomos.map(a => [a[0], a[1] - cx, a[2] - cy, a[3] - cz, a[4]]);
  return mol;
}

// Agrega un átomo "hacia afuera" (alejándose del centro) desde otro átomo
function crecer(mol, simbolo, desde, distancia, dz = 0, orden = 1, desvio = 0) {
  const [, x, y, z] = mol.atomos[desde];
  const ang = Math.atan2(y, x) + desvio;
  mol.atomos.push([simbolo, x + Math.cos(ang) * distancia, y + Math.sin(ang) * distancia, z + dz]);
  const nuevo = mol.atomos.length - 1;
  mol.enlaces.push([desde, nuevo, orden]);
  return nuevo;
}

function agua(mol, x, y, z = 0) {
  const o = mol.atomos.push(['O', x, y, z]) - 1;
  mol.atomos.push(['H', x - 0.76, y + 0.59, z]);
  mol.atomos.push(['H', x + 0.76, y + 0.59, z]);
  mol.enlaces.push([o, o + 1, 1], [o, o + 2, 1]);
}

function redCristalina(patron, nx, ny, nz, paso, conEnlaces) {
  const mol = { atomos: [], enlaces: [] };
  const indice = {};
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    indice[`${i},${j},${k}`] = mol.atomos.push([patron(i, j, k), (i - (nx - 1) / 2) * paso, (j - (ny - 1) / 2) * paso, (k - (nz - 1) / 2) * paso]) - 1;
  }
  if (conEnlaces) {
    for (const clave in indice) {
      const [i, j, k] = clave.split(',').map(Number);
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(([a, b, c]) => {
        const vecino = indice[`${i + a},${j + b},${k + c}`];
        if (vecino !== undefined) mol.enlaces.push([indice[clave], vecino, 1]);
      });
    }
  }
  return mol;
}

const MOLECULAS = {
  // Unidad de glucosa (la celulosa repite miles de estas)
  celulosa: (() => {
    const m = { atomos: [], enlaces: [], nota: 'Una unidad de glucosa. La celulosa es una cadena de miles de ellas.' };
    ['O', 'C', 'C', 'C', 'C', 'C'].forEach((s, i) => {
      const a = i * Math.PI / 3;
      m.atomos.push([s, Math.cos(a) * 1.25, Math.sin(a) * 1.25, i % 2 ? 0.25 : -0.25]);
    });
    for (let i = 0; i < 6; i++) m.enlaces.push([i, (i + 1) % 6, 1]);
    [1, 2, 3, 4].forEach(i => {
      const o = crecer(m, 'O', i, 1.15, 0.35);
      if (i === 2 || i === 3) crecer(m, 'H', o, 0.75, 0.2);
    });
    const c6 = crecer(m, 'C', 5, 1.3, 0.45);
    const o6 = crecer(m, 'O', c6, 1.0, 0.4);
    crecer(m, 'H', o6, 0.7, 0.3);
    [1, 2, 3, 4, 5].forEach(i => crecer(m, 'H', i, 0.5, i % 2 ? -0.95 : 0.95));
    return centrarMolecula(m);
  })(),

  // Dióxido de silicio: tetraedros SiO4 unidos en red
  silice: (() => {
    const t = 0.85;
    const m = { atomos: [['Si', 0, 0, 0], ['O', t, t, t], ['O', t, -t, -t], ['O', -t, t, -t], ['O', -t, -t, t]], enlaces: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], nota: 'Cada átomo de silicio queda rodeado por cuatro de oxígeno y así se forma una red.' };
    m.atomos.push(['Si', 2 * t, 2 * t, 2 * t]); m.enlaces.push([1, 5, 1]);
    m.atomos.push(['Si', -2 * t, -2 * t, 2 * t]); m.enlaces.push([4, 6, 1]);
    return centrarMolecula(m);
  })(),

  // PET: anillo de benceno con dos grupos éster (unidad que se repite)
  pet: (() => {
    const m = { atomos: [], enlaces: [], nota: 'La pieza que se repite miles de veces en el plástico PET.' };
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      m.atomos.push(['C', Math.cos(a), Math.sin(a), 0]);
      m.enlaces.push([i, (i + 1) % 6, i % 2 ? 2 : 1]);
    }
    [0, 3].forEach(i => {
      const s = i === 0 ? 1 : -1;
      const c = m.atomos.push(['C', 2.1 * s, 0, 0]) - 1; m.enlaces.push([i, c, 1]);
      const o1 = m.atomos.push(['O', 2.7 * s, 0.9, 0]) - 1; m.enlaces.push([c, o1, 2]);
      const o2 = m.atomos.push(['O', 2.8 * s, -0.85, 0]) - 1; m.enlaces.push([c, o2, 1]);
      const c2 = m.atomos.push(['C', 3.9 * s, -0.85, 0.3]) - 1; m.enlaces.push([o2, c2, 1]);
    });
    [1, 2, 4, 5].forEach(i => crecer(m, 'H', i, 0.75));
    return centrarMolecula(m);
  })(),

  aguasalada: (() => {
    const m = { atomos: [], enlaces: [], nota: 'Moléculas de agua con iones de sodio (Na⁺) y de cloro (Cl⁻) disueltos.' };
    agua(m, -1.6, -0.9, 0.3); agua(m, -1.2, 1.3, -0.4);
    m.atomos.push(['Na', 1.2, -0.9, 0, '+']);
    m.atomos.push(['Cl', 1.6, 1.1, 0.2, '−']);
    return centrarMolecula(m);
  })(),

  aguacoco: (() => {
    const m = { atomos: [], enlaces: [], nota: 'Agua con iones de potasio (K⁺), un electrolito natural.' };
    agua(m, -1.5, -0.6, 0.2); agua(m, -0.6, 1.4, -0.5); agua(m, 1.6, 1.0, 0.3);
    m.atomos.push(['K', 1.2, -1.0, 0, '+']);
    return centrarMolecula(m);
  })(),

  // Cera: cadena larga de carbonos e hidrógenos (hidrofóbica)
  cera: (() => {
    const m = { atomos: [], enlaces: [], nota: 'Cadena de carbono e hidrógeno: por eso repele el agua.' };
    for (let i = 0; i < 7; i++) {
      m.atomos.push(['C', (i - 3) * 1.0, i % 2 ? 0.35 : -0.35, 0]);
      if (i > 0) m.enlaces.push([i - 1, i, 1]);
    }
    for (let i = 0; i < 7; i++) {
      const [, x, y] = m.atomos[i];
      const s = i % 2 ? 1 : -1;
      m.atomos.push(['H', x, y + s * 0.45, 0.85]); m.enlaces.push([i, m.atomos.length - 1, 1]);
      m.atomos.push(['H', x, y + s * 0.45, -0.85]); m.enlaces.push([i, m.atomos.length - 1, 1]);
    }
    return centrarMolecula(m);
  })(),

  // Vitamina C (ácido ascórbico) simplificada
  vitaminac: (() => {
    const m = { atomos: [], enlaces: [], nota: 'Ácido ascórbico, la vitamina C (modelo simplificado).' };
    ['O', 'C', 'C', 'C', 'C'].forEach((s, i) => {
      const a = i * 2 * Math.PI / 5 - Math.PI / 2;
      m.atomos.push([s, Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0]);
    });
    for (let i = 0; i < 5; i++) m.enlaces.push([i, (i + 1) % 5, i === 2 ? 2 : 1]);
    crecer(m, 'O', 1, 1.1, 0, 2);
    const oa = crecer(m, 'O', 2, 1.1); crecer(m, 'H', oa, 0.7);
    const ob = crecer(m, 'O', 3, 1.1); crecer(m, 'H', ob, 0.7);
    const c5 = crecer(m, 'C', 4, 1.2, 0.5);
    const oc = crecer(m, 'O', c5, 1.0, 0.4); crecer(m, 'H', oc, 0.7);
    return centrarMolecula(m);
  })(),

  // Batería: ácido sulfúrico + plomo
  acido: (() => {
    const t = 0.8;
    const m = { atomos: [['S', 0.8, 0, 0], ['O', 0.8 + t, t, t], ['O', 0.8 + t, -t, -t], ['O', 0.8 - t, t, -t], ['O', 0.8 - t, -t, t]], enlaces: [[0, 1, 2], [0, 2, 2], [0, 3, 1], [0, 4, 1]], nota: 'Ácido sulfúrico (H₂SO₄) junto a un átomo de plomo, como dentro de la batería.' };
    m.atomos.push(['H', 0.8 - 1.4 * t, 1.6 * t, -t]); m.enlaces.push([3, 5, 1]);
    m.atomos.push(['H', 0.8 - 1.4 * t, -1.6 * t, t]); m.enlaces.push([4, 6, 1]);
    m.atomos.push(['Pb', -2.3, 0, 0]);
    return centrarMolecula(m);
  })(),

  cobre: Object.assign(redCristalina(() => 'Cu', 3, 3, 2, 1.25, false), { electrones: 26, nota: 'Red metálica: los puntos azules son electrones que se mueven libremente.' }),
  gan: Object.assign(redCristalina((i, j, k) => (i + j + k) % 2 ? 'N' : 'Ga', 3, 3, 2, 1.15, true), { nota: 'Nitruro de galio (GaN), el semiconductor de los LED blancos y azules.' }),
  magnetita: Object.assign(redCristalina((i, j, k) => (i + j + k) % 2 ? 'Fe' : 'O', 3, 3, 2, 1.15, true), { nota: 'Red cristalina de óxido de hierro (Fe₃O₄), en versión simplificada.' })
};

// ---------------------------------------------------------------------
//  OBJETOS QUE ALEK PUEDE RECOGER
//  art   = nombre con artículo, para armar frases («busca la botella»)
//  texto = lo que BRISA dice en voz alta: frases cortas, sin fórmulas ni siglas
//          difíciles de pronunciar, y evitando las palabras que son comandos de voz
// ---------------------------------------------------------------------
const OBJETOS = {
  madera: {
    corto: 'Madera', art: 'la madera', nombre: 'Madera seca de deriva', emoji: '🪵', formula: '(C₆H₁₀O₅)ₙ · celulosa', molecula: 'celulosa', uso: 'FUEGO · combustible',
    texto: 'Madera seca de deriva. Está hecha sobre todo de celulosa, una cadena larga de átomos de carbono, hidrógeno y oxígeno. Mientras el árbol estaba vivo, guardó en ella la energía del Sol gracias a la fotosíntesis. Al quemarla, esa energía se libera como calor y luz. Que esté seca es clave: así el fuego no gasta energía evaporando agua.'
  },
  pedernal: {
    corto: 'Pedernal', art: 'el pedernal', nombre: 'Pedernal (sílex)', emoji: '🪨', formula: 'SiO₂ · dióxido de silicio', molecula: 'silice', uso: 'FUEGO · chispa',
    texto: 'Pedernal, también llamado sílex. Está formado por dióxido de silicio, el mismo compuesto de la arena y del vidrio. Es tan duro que, al rasparlo contra un trozo de acero, arranca diminutas virutas de hierro. Esas virutas se calientan tanto que brillan, y son las chispas que darán la energía para iniciar el fuego.'
  },
  botella: {
    corto: 'Botella', art: 'la botella', nombre: 'Botella plástica PET', emoji: '🧴', formula: '(C₁₀H₈O₄)ₙ · polímero', molecula: 'pet', uso: 'AGUA · destilador',
    texto: 'Botella de plástico PET. Este plástico es un polímero, es decir, una cadena enorme de moléculas iguales, fabricada a partir del petróleo. En el mar puede durar cientos de años sin degradarse. Pero aquí nos sirve: es transparente, deja pasar la luz del Sol y con ella podemos armar un destilador solar.'
  },
  aguamar: {
    corto: 'Agua de mar', art: 'el agua de mar', nombre: 'Agua de mar', emoji: '🌊', formula: 'H₂O + NaCl (35 g/L)', molecula: 'aguasalada', uso: 'AGUA · hay que destilarla',
    texto: 'Agua de mar. Además de agua, tiene sal disuelta: unos treinta y cinco gramos por cada litro, en forma de iones de sodio y de cloro. No es potable, porque la sal hace que tus células pierdan agua por ósmosis y te deshidratarías más rápido. Primero hay que separar el agua de la sal.'
  },
  coco: {
    corto: 'Coco', art: 'el coco', nombre: 'Coco verde', emoji: '🥥', formula: 'H₂O + K⁺ (electrolitos)', molecula: 'aguacoco', uso: 'CONSUMIBLE · tecla 1 o «beber»', consumible: { hidr: 35 },
    texto: 'Coco verde. Por dentro guarda agua limpia, protegida por la cáscara. Además trae electrolitos, como el potasio, que tus músculos y tus nervios necesitan para funcionar. Guárdalo y, cuando tu hidratación baje, presiona la tecla 1.'
  },
  yesca: {
    corto: 'Yesca', art: 'la yesca', nombre: 'Yesca de fibra de coco', emoji: '🌾', formula: '(C₆H₁₀O₅)ₙ · fibras finas', molecula: 'celulosa', uso: 'FUEGO · encendido',
    texto: 'Yesca de fibra de coco. Son fibras de celulosa muy delgadas y secas. Como son tan finas, gran parte de su superficie toca el oxígeno del aire, y por eso arden con muy poco calor. La yesca convierte un pequeño punto de calor en una llama capaz de prender la leña.'
  },
  liana: {
    corto: 'Liana', art: 'la liana', nombre: 'Liana (bejuco)', emoji: '🌿', formula: 'fibras de celulosa', molecula: 'celulosa', uso: 'CUERDA · tensión',
    texto: 'Liana, también llamada bejuco. Es una planta trepadora con fibras largas de celulosa, que resisten mucha tensión sin romperse. Por eso sirve como cuerda para amarrar un refugio o una antena. Muchas comunidades indígenas de la Amazonía la usan para tejer canastos y hacer puentes colgantes.'
  },
  hoja: {
    corto: 'Hoja de palma', art: 'la hoja de palma', nombre: 'Hoja de palma', emoji: '🍃', formula: 'cutícula de cera (C–H)', molecula: 'cera', uso: 'REFUGIO · techo',
    texto: 'Hoja de palma. Su superficie está cubierta por una capa de cera, formada por cadenas de carbono e hidrógeno, que repele el agua. Por eso, si pones varias hojas sobre un techo inclinado, la lluvia resbala por encima en lugar de entrar al refugio.'
  },
  fruta: {
    corto: 'Guayaba', art: 'la guayaba', nombre: 'Guayaba', emoji: '🍐', formula: 'C₆H₈O₆ · vitamina C', molecula: 'vitaminac', uso: 'CONSUMIBLE · tecla 2 o «comer»', consumible: { energia: 35 },
    texto: 'Guayaba. Tiene más vitamina C que una naranja y, además, azúcares naturales. Tus células transforman esos azúcares en energía mediante la respiración celular. Guárdala y, cuando tu energía baje, presiona la tecla 2.'
  },
  bateria: {
    corto: 'Batería', art: 'la batería', nombre: 'Batería de 12 V del AURORA', emoji: '🔋', formula: 'Pb + PbO₂ + H₂SO₄', molecula: 'acido', uso: 'BALIZA · fuente de energía',
    texto: 'Batería de doce voltios del buque Aurora. Por dentro tiene placas de plomo y de dióxido de plomo sumergidas en ácido sulfúrico. Entre ellas ocurre una reacción química que empuja electrones por el circuito: así transforma energía química en energía eléctrica. Tiene seis celdas de dos voltios conectadas en serie. Seis por dos: doce voltios.'
  },
  cobre: {
    corto: 'Cable de cobre', art: 'el cable de cobre', nombre: 'Cable de cobre', emoji: '🧵', formula: 'Cu · metal conductor', molecula: 'cobre', uso: 'BALIZA · conductor',
    texto: 'Cable de cobre. Cada átomo de cobre tiene veintinueve protones. Sus electrones más externos no se quedan quietos: se comparten entre todos los átomos y forman un mar de electrones que se mueve con facilidad. Por eso el cobre es uno de los mejores conductores de electricidad.'
  },
  lampara: {
    corto: 'Lámpara LED', art: 'la lámpara LED', nombre: 'Lámpara LED de la baliza', emoji: '💡', formula: 'GaN · semiconductor', molecula: 'gan', uso: 'BALIZA · luz',
    texto: 'Lámpara LED de la baliza. LED significa diodo emisor de luz. Está fabricado con un semiconductor llamado nitruro de galio. Cuando la corriente lo atraviesa, los electrones liberan su energía en forma de luz. Gasta mucho menos que un bombillo común y casi no se calienta.'
  },
  magnetita: {
    corto: 'Magnetita', art: 'la magnetita', nombre: 'Roca de magnetita', emoji: '🧲', formula: 'Fe₃O₄ · óxido de hierro', molecula: 'magnetita', uso: 'EXTRA · imán natural',
    texto: 'Magnetita. Es un óxido de hierro que funciona como un imán natural. Los navegantes antiguos frotaban agujas de hierro con esta piedra para magnetizarlas, y así construyeron las primeras brújulas. La aguja se alinea con el campo magnético de la Tierra y señala el norte.'
  }
};

// ---------------------------------------------------------------------
//  ZONAS DE LA ISLA (cada una es una pantalla)
//  suelo = altura (en px) donde camina Alek
// ---------------------------------------------------------------------
const ZONAS = [
  {
    id: 'playa', nombre: 'PLAYA AURORA', corto: 'PLAYA', icono: '🏖️', hacia: 'la playa', fondo: 'assets/img/zona_playa.jpg', suelo: 612, lluvia: true,
    mision: 'Explora la playa y recoge los objetos útiles que dejó el naufragio.',
    intro: 'Estamos en la Playa Aurora. Busca los objetos que brillan en la arena, acércate y presiona E. Yo los escaneo y te digo de qué átomos están hechos.',
    objetos: [{ id: 'madera', x: 250 }, { id: 'coco', x: 470 }, { id: 'botella', x: 690 }, { id: 'pedernal', x: 900 }, { id: 'aguamar', x: 1110 }]
  },
  {
    id: 'selva', nombre: 'SELVA PROFUNDA', corto: 'SELVA', icono: '🌴', hacia: 'la selva', fondo: 'assets/img/zona_selva.jpg', suelo: 628, lluvia: true, motas: true,
    mision: 'Cruza la selva y consigue materiales vegetales.',
    intro: 'Entramos a la selva. Aquí encontraremos fibras, hojas y frutas. Casi todos los seres vivos están hechos de los mismos tres elementos: carbono, hidrógeno y oxígeno.',
    objetos: [{ id: 'yesca', x: 260 }, { id: 'liana', x: 500 }, { id: 'fruta', x: 760 }, { id: 'hoja', x: 1010 }]
  },
  {
    id: 'campamento', nombre: 'CAMPAMENTO', corto: 'CAMPAMENTO', icono: '⛺', hacia: 'el campamento', fondo: 'assets/img/zona_campamento.jpg', suelo: 618, lluvia: true,
    mision: 'Consigue agua potable y prende el fuego.',
    intro: 'Este es un buen lugar para acampar. Primero consigamos agua potable con el destilador solar, a la izquierda. Después prendamos el fuego en el anillo de piedras, a la derecha.',
    objetos: [{ id: 'coco', x: 700 }],
    estaciones: [
      { tipo: 'agua', x: 235, marcaY: 300, nombre: 'DESTILADOR SOLAR', icono: '💧', requiere: ['botella', 'aguamar'], para: 'Para armar el destilador solar', pendiente: 'conseguir agua en el destilador solar' },
      { tipo: 'fuego', x: 1150, marcaY: 400, nombre: 'ANILLO DE PIEDRAS', icono: '🔥', requiere: ['madera', 'yesca', 'pedernal'], para: 'Para prender el fuego', pendiente: 'prender el fuego en el anillo de piedras' }
    ]
  },
  {
    id: 'cumbre', nombre: 'CUMBRE DE LA ANTENA', corto: 'CUMBRE', icono: '📡', hacia: 'la cumbre', fondo: 'assets/img/zona_cumbre.jpg', suelo: 632, lluvia: false, viento: true,
    mision: 'Repara la baliza y envía la señal de auxilio.',
    intro: 'Llegamos a la cumbre. La baliza de emergencia no tiene energía. Busca la batería, el cable de cobre y la lámpara para repararla.',
    objetos: [{ id: 'lampara', x: 230 }, { id: 'bateria', x: 680 }, { id: 'magnetita', x: 860 }, { id: 'cobre', x: 1060 }],
    estaciones: [
      { tipo: 'baliza', x: 470, marcaY: 250, nombre: 'BALIZA DE EMERGENCIA', icono: '📡', requiere: ['bateria', 'cobre', 'lampara'], para: 'Para reparar la baliza', pendiente: 'reparar la baliza' }
    ]
  }
];

// Objetos opcionales: no bloquean el avance (los consumibles y el bonus)
const OPCIONALES = ['coco', 'fruta', 'magnetita'];

// ---------------------------------------------------------------------
//  CINEMÁTICAS (imágenes de Google Stitch + voz de BRISA)
// ---------------------------------------------------------------------
const ESCENAS_INTRO = [
  { img: 'assets/img/cine_tormenta.jpg', texto: 'Océano Pacífico, tres y cuarenta de la madrugada. Una tormenta arrastra al buque de investigación Aurora contra los arrecifes de una isla desconocida.' },
  { img: 'assets/img/menu.jpg', texto: 'Al amanecer, Alek despierta en la playa. Está solo, no tiene agua potable y se encuentra muy lejos de cualquier ruta de barcos.' },
  { img: 'assets/img/cine_brisa.jpg', texto: 'De pronto, su reloj se enciende: «Hola, Alek. Soy Brisa, tu asistente científica. Puedo escanear todo lo que encuentres y decirte de qué está hecho».' },
  { img: 'assets/img/zona_cumbre.jpg', texto: 'En la cumbre de la isla hay una antena de emergencia dañada. Para llegar hasta allá y pedir rescate, Alek necesitará agua, fuego y electricidad. En otras palabras: ciencia.' }
];

const ESCENAS_DERROTA = {
  hidratacion: [{ img: 'assets/img/menu.jpg', filtro: 'grayscale(.7) sepia(.5) hue-rotate(-25deg) brightness(.55)', texto: 'Hidratación crítica. Sin agua potable, el cuerpo humano no puede seguir funcionando. Alek se desmaya sobre la arena.' }],
  energia: [{ img: 'assets/img/cine_selva.jpg', filtro: 'grayscale(.7) sepia(.4) hue-rotate(-25deg) brightness(.5)', texto: 'Energía agotada. Sin alimento ni calor, el cuerpo gasta todas sus reservas. Alek ya no tiene fuerzas para seguir caminando.' }]
};

// Datos científicos para la pantalla final
const DATOS_FINALES = {
  hidratacion: 'Cerca del 60 % de tu cuerpo es agua. Si pierdes apenas un 2 %, ya te cuesta concentrarte y tienes menos fuerza. Por eso, en una emergencia, conseguir agua potable es lo primero, incluso antes que la comida. Y nunca agua de mar: la sal te deshidrata todavía más.',
  energia: 'Tus células obtienen energía de la glucosa mediante la respiración celular: la glucosa reacciona con el oxígeno y produce dióxido de carbono, agua y energía. Si no comes ni te mantienes caliente, el cuerpo gasta sus reservas hasta agotarse.',
  victoria: 'Usaste tres ideas de la ciencia: los cambios de fase, para obtener agua dulce; el triángulo del fuego, para tener calor; y la ley de Ohm, para encender la baliza. Así es como la ciencia salva vidas.'
};

const INSIGNIAS = [
  { reto: 'agua', icono: '💧', nombre: 'DESTILACIÓN SOLAR', frase: 'Evaporación y condensación separan el agua de la sal.' },
  { reto: 'fuego', icono: '🔥', nombre: 'TRIÁNGULO DEL FUEGO', frase: 'Combustible, oxígeno y calor juntos producen fuego.' },
  { reto: 'baliza', icono: '📡', nombre: 'CIRCUITO ELÉCTRICO', frase: 'Ley de Ohm: 12 V ÷ 6 Ω = 2 A en un circuito cerrado.' }
];
