// =====================================================================
//  minigames.js → Los 3 RETOS CIENTÍFICOS
//   agua   → Destilador solar (evaporación y condensación + clima real)
//   fuego  → Triángulo del fuego (¡soplar al micrófono!)
//   baliza → Circuito eléctrico (ley de Ohm) + ¡gritar AUXILIO!
// =====================================================================

const Minijuego = {
  tipo: null,
  paso: 0,
  t: 0,
  s: {},              // estado propio de cada reto
  W: 720, H: 420,     // tamaño lógico del lienzo
  c: null,
  lienzo: null,
  alTerminar: null,
  aviso: null,        // mensaje temporal sobre el lienzo

  iniciar(tipo, alTerminar) {
    this.lienzo = document.getElementById('mini-lienzo');
    this.c = this.lienzo.getContext('2d');
    this.tipo = tipo;
    this.paso = 0;
    this.t = 0;
    this.s = { particulas: [] };
    this.aviso = null;
    this.alTerminar = alTerminar;
    const reto = RETOS[tipo];
    document.getElementById('mini-modulo').textContent = reto.modulo;
    document.getElementById('mini-titulo').textContent = reto.titulo;
    document.getElementById('mini-dato').innerHTML = reto.dato();
    this.pasos = reto.pasos;
    this.pintarPasos();
    document.getElementById('ov-mini').classList.add('visible');
    reto.iniciar(this);
  },

  terminar() {
    document.getElementById('ov-mini').classList.remove('visible');
    const cb = this.alTerminar;
    this.alTerminar = null;
    this.tipo = null;
    if (cb) cb();
  },

  // ---------- utilidades de interfaz ----------
  pintarPasos() {
    const ol = document.getElementById('mini-pasos');
    ol.innerHTML = '';
    this.pasos.forEach((texto, i) => {
      const li = document.createElement('li');
      li.textContent = texto;
      if (i < this.paso) li.className = 'hecho';
      else if (i === this.paso) li.className = 'actual';
      ol.append(li);
    });
  },
  irAPaso(n) { this.paso = n; this.pintarPasos(); },
  instruccion(texto) { document.getElementById('mini-instruccion').innerHTML = texto; },
  estado(texto) { document.getElementById('mini-estado').textContent = texto; },
  avisar(texto, color = '#ffb4ab', dur = 3.2) { this.aviso = { texto, color, hasta: this.t + dur }; },
  decir(texto) { Sensores.hablar(texto); hudBrisa(texto); },

  // ---------- ciclo ----------
  actualizar(dt) {
    if (!this.tipo) return;
    this.t += dt;
    RETOS[this.tipo].actualizar(this, dt);
    if (!this.tipo) return; // el reto pudo terminar en este mismo fotograma
    this.s.particulas = this.s.particulas.filter(p => {
      p.vida -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      return p.vida > 0;
    });
    this.dibujar();
  },

  dibujar() {
    const c = this.c;
    c.setTransform(this.lienzo.width / this.W, 0, 0, this.lienzo.height / this.H, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    RETOS[this.tipo].dibujar(this, c);
    // partículas compartidas (chispas, vapor, etc.)
    this.s.particulas.forEach(p => {
      c.globalAlpha = Math.max(0, Math.min(1, p.vida / (p.vidaMax || 1)));
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
    if (this.aviso && this.t < this.aviso.hasta) {
      c.font = '700 15px "Chivo", sans-serif';
      const w = Math.min(this.W - 40, c.measureText(this.aviso.texto).width + 32);
      c.fillStyle = 'rgba(10,14,17,0.88)';
      c.fillRect((this.W - w) / 2, 12, w, 34);
      c.strokeStyle = this.aviso.color; c.lineWidth = 1.5;
      c.strokeRect((this.W - w) / 2, 12, w, 34);
      c.fillStyle = this.aviso.color;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.aviso.texto, this.W / 2, 29, this.W - 60);
    }
  },

  medidorMic(c, x, y, h) {
    const v = Sensores.mic.activo ? Sensores.intensidad() : (teclas.espacio ? 0.85 : 0);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, y, 16, h);
    const g = c.createLinearGradient(0, y + h, 0, y);
    g.addColorStop(0, '#00e5ff'); g.addColorStop(1, '#e5c384');
    c.fillStyle = g; c.fillRect(x, y + h * (1 - v), 16, h * v);
    c.strokeStyle = 'rgba(0,229,255,0.5)'; c.strokeRect(x, y, 16, h);
    c.fillStyle = '#bac9cc'; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText(Sensores.mic.activo ? 'MIC' : 'ESP', x + 8, y + h + 14);
  },

  // ---------- entradas ----------
  tecla(k) {
    if (!this.tipo) return;
    const reto = RETOS[this.tipo];
    if (k === 'e' || k === 'enter') reto.accion(this);
    if (reto.tecla) reto.tecla(this, k);
  },
  comando(cmd) {
    if (!this.tipo) return;
    const reto = RETOS[this.tipo];
    if (cmd === 'accion' || cmd === 'cerrar') reto.accion(this);
    if (reto.comando) reto.comando(this, cmd);
  },
  clic(x, y) {
    if (!this.tipo) return;
    const reto = RETOS[this.tipo];
    if (reto.clic) reto.clic(this, x, y);
  }
};

// =====================================================================
const RETOS = {};

// ------------------------------------------------- 1. DESTILADOR SOLAR
RETOS.agua = {
  modulo: 'RETO 1 · TERMODINÁMICA · CAMBIOS DE FASE',
  titulo: 'Destilador solar',
  pasos: ['Echar el agua de mar', 'Inclinar el plástico (25°–45°)', 'Evaporación y condensación', 'Beber el agua dulce'],

  radiacion() {
    if (CLIMA.ok && CLIMA.esDia && CLIMA.radiacion > 60) return { valor: CLIMA.radiacion, real: true };
    return { valor: 600, real: false };
  },

  dato() {
    const r = this.radiacion();
    const litros = (r.valor * 3600 * 0.35 / 2.26e6).toFixed(2).replace('.', ',');
    const fuente = r.real
      ? `<b>☀️ Radiación solar REAL ahora en ${CONFIG.colegio.ciudad}:</b> ${Math.round(r.valor)} W/m² <small>(API Open-Meteo, en vivo)</small>`
      : `<b>☀️ Radiación solar de un mediodía típico:</b> 600 W/m² <small>${CLIMA.ok ? '(en el colegio ahora es de noche o está muy nublado)' : '(no hay conexión con el clima real)'}</small>`;
    return `<p>${fuente}</p>
      <p><b>Producción estimada:</b> con 1 m² de destilador y un 35 % de eficiencia se obtendrían unos <b>${litros} litros de agua por hora</b>.</p>
      <p><b>Q = m · Lᵥ:</b> para evaporar 1 kg de agua se necesitan unos 2260 kJ de energía. La sal no se evapora, por eso se queda en el recipiente.</p>`;
  },

  iniciar(M) {
    const r = this.radiacion();
    Object.assign(M.s, { nivel: 0, vertiendo: false, ang: 6, enRango: 0, prod: 0, gotas: [], caidas: [], rad: r.valor, dur: Math.max(3.5, Math.min(9, 9 - r.valor / 150)) });
    M.estado('☀️ ' + Math.round(r.valor) + ' W/m²');
    M.instruccion('Presiona <kbd>E</kbd> (o di «usar») para <b>echar el agua de mar</b> en el recipiente.');
    M.decir('Este es un destilador solar. El Sol evapora el agua, pero la sal se queda abajo. El vapor sube, se enfría al tocar el plástico y vuelve a convertirse en gotas de agua dulce. Primero, presiona E para echar el agua de mar en el recipiente.');
  },

  // geometría: extremo bajo del plástico (P2) sobre el vaso; el alto (P1) depende del ángulo
  plastico(s) {
    const P2 = { x: 505, y: 262 };
    const L = 360, a = s.ang * Math.PI / 180;
    return { P1: { x: P2.x - L * Math.cos(a), y: P2.y - L * Math.sin(a) }, P2 };
  },

  accion(M) {
    const s = M.s;
    if (M.paso === 0 && !s.vertiendo) { s.vertiendo = true; Sonido.ruido(1.1, 0.12, 700, 'lowpass'); }
    else if (M.paso === 1 && s.ang >= 25 && s.ang <= 45) this.empezarEvaporacion(M);
    else if (M.paso === 3) M.terminar();
  },

  empezarEvaporacion(M) {
    M.irAPaso(2);
    Sonido.puntos();
    M.instruccion('El Sol calienta el agua y <b>se evapora</b>. El vapor toca el plástico, que está más frío, y <b>se condensa</b> en gotas que resbalan hasta el vaso.');
  },

  actualizar(M, dt) {
    const s = M.s;
    if (M.paso === 0 && s.vertiendo) {
      s.nivel = Math.min(1, s.nivel + dt * 0.9);
      if (s.nivel >= 1) {
        M.irAPaso(1);
        M.instruccion('Inclina el plástico con las flechas <kbd>←</kbd> <kbd>→</kbd> (o con los botones ◀ ▶) hasta que quede <b>entre 25° y 45°</b>.');
        M.decir('Ahora inclina el plástico con las flechas hasta que quede entre veinticinco y cuarenta y cinco grados. Así las gotas resbalan hasta el vaso.');
      }
    }
    if (M.paso === 1) {
      s.ang = Math.max(0, Math.min(60, s.ang + ((teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0)) * 26 * dt));
      s.enRango = s.ang >= 25 && s.ang <= 45 ? s.enRango + dt : 0;
      if (s.enRango > 0.9) this.empezarEvaporacion(M);
    }
    if (M.paso === 2) {
      s.prod = Math.min(1, s.prod + dt / s.dur);
      const { P1, P2 } = this.plastico(s);
      const superficie = 340 - 62 * (1 - 0.35 * s.prod);
      // vapor que sube desde el agua
      if (Math.random() < dt * 28) {
        const x = 200 + Math.random() * 240;
        M.s.particulas.push({ x, y: superficie, vx: (Math.random() - 0.5) * 10, vy: -45 - Math.random() * 30, r: 2 + Math.random() * 2, vida: 1.6, vidaMax: 1.6, color: 'rgba(220,240,255,0.55)', vapor: true });
      }
      // el vapor que toca el plástico se convierte en gota
      M.s.particulas.forEach(p => {
        if (!p.vapor) return;
        const yPlastico = P2.y - (P2.x - p.x) * Math.tan(s.ang * Math.PI / 180);
        if (p.y <= yPlastico + 4) {
          p.vida = 0;
          const u = Math.max(0, Math.min(1, (p.x - P1.x) / (P2.x - P1.x)));
          if (s.gotas.length < 40) s.gotas.push({ u, r: 2 });
        }
      });
      // las gotas resbalan hacia el extremo bajo
      s.gotas.forEach(g => { g.u += dt * (0.18 + Math.sin(s.ang * Math.PI / 180) * 0.6); g.r = Math.min(4.5, g.r + dt * 2); });
      s.gotas = s.gotas.filter(g => {
        if (g.u >= 1) { s.caidas.push({ y: P2.y + 4, vy: 60 }); return false; }
        return true;
      });
      if (s.prod >= 1) {
        M.irAPaso(3);
        Sonido.logro();
        M.estado('AGUA POTABLE ✓');
        M.instruccion('¡Ya tienes agua dulce! La sal se quedó en el recipiente. Presiona <kbd>E</kbd> para <b>beberla</b> (+50 de hidratación).');
        M.decir('¡Lo lograste! El agua pasó de líquido a vapor, y de vapor otra vez a líquido. Son dos cambios de fase, y la sal se quedó en el recipiente.');
      }
    }
    s.caidas.forEach(g => { g.vy += 500 * dt; g.y += g.vy * dt; });
    s.caidas = s.caidas.filter(g => g.y < 330);
  },

  dibujar(M, c) {
    const s = M.s;
    // cielo y arena
    const cielo = c.createLinearGradient(0, 0, 0, 330);
    cielo.addColorStop(0, '#0d3b5c'); cielo.addColorStop(1, '#3f7fa3');
    c.fillStyle = cielo; c.fillRect(0, 0, M.W, 330);
    c.fillStyle = '#c9a66b'; c.fillRect(0, 330, M.W, M.H - 330);
    // sol (más brillante con más radiación)
    const brillo = Math.min(1, s.rad / 800);
    const sol = c.createRadialGradient(70, 62, 6, 70, 62, 90);
    sol.addColorStop(0, `rgba(255,236,170,${0.95 * brillo + 0.05})`); sol.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = sol; c.beginPath(); c.arc(70, 62, 90, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(70, 62, 26, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `rgba(255,230,150,${0.6 * brillo})`; c.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 + M.t * 0.3;
      c.beginPath(); c.moveTo(70 + Math.cos(a) * 34, 62 + Math.sin(a) * 34); c.lineTo(70 + Math.cos(a) * 48, 62 + Math.sin(a) * 48); c.stroke();
    }
    // recipiente con agua de mar
    c.fillStyle = '#2b2f33';
    c.beginPath(); c.moveTo(170, 268); c.lineTo(470, 268); c.lineTo(445, 342); c.lineTo(195, 342); c.closePath(); c.fill();
    const nivelAgua = s.nivel * (1 - 0.35 * s.prod);
    if (nivelAgua > 0) {
      const sup = 340 - 62 * nivelAgua;
      c.fillStyle = 'rgba(40,140,200,0.85)';
      c.beginPath(); c.moveTo(195 - (340 - sup) * 0.33, sup); c.lineTo(445 + (340 - sup) * 0.33, sup); c.lineTo(445, 340); c.lineTo(195, 340); c.closePath(); c.fill();
      if (M.paso === 2) {
        c.strokeStyle = 'rgba(255,190,120,0.5)'; c.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          const x = 220 + i * 48;
          c.beginPath();
          for (let k = 0; k < 10; k++) c.lineTo(x + Math.sin(M.t * 6 + k + i) * 4, sup - 6 - k * 5);
          c.stroke();
        }
      }
    }
    // cristales de sal que aparecen al evaporarse el agua
    const sal = Math.floor(s.prod * 28);
    c.fillStyle = '#f4f4f4';
    for (let i = 0; i < sal; i++) c.fillRect(205 + ((i * 37) % 230), 334 - ((i * 13) % 6), 4, 4);
    // vaso colector
    c.fillStyle = 'rgba(200,230,255,0.25)'; c.strokeStyle = '#c3f5ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(485, 285); c.lineTo(545, 285); c.lineTo(538, 345); c.lineTo(492, 345); c.closePath(); c.fill(); c.stroke();
    if (s.prod > 0) {
      const h = 55 * s.prod;
      c.fillStyle = 'rgba(120,220,255,0.85)';
      c.fillRect(493, 344 - h, 45, h);
    }
    c.fillStyle = '#e8f8ff'; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText(`${(s.prod * 0.5).toFixed(2).replace('.', ',')} L`, 515, 368);
    // plástico inclinado
    const { P1, P2 } = this.plastico(s);
    c.strokeStyle = '#8a6a44'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(P1.x, P1.y); c.lineTo(P1.x, 268); c.stroke();
    c.strokeStyle = 'rgba(230,250,255,0.9)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(P1.x, P1.y); c.lineTo(P2.x, P2.y); c.stroke();
    c.strokeStyle = 'rgba(230,250,255,0.25)'; c.lineWidth = 12;
    c.beginPath(); c.moveTo(P1.x, P1.y); c.lineTo(P2.x, P2.y); c.stroke();
    // gotas en el plástico y cayendo
    c.fillStyle = '#9ee7ff';
    s.gotas.forEach(g => {
      const x = P1.x + (P2.x - P1.x) * g.u, y = P1.y + (P2.y - P1.y) * g.u + 4;
      c.beginPath(); c.arc(x, y, g.r, 0, Math.PI * 2); c.fill();
    });
    s.caidas.forEach(g => { c.beginPath(); c.arc(P2.x + 8, g.y, 3, 0, Math.PI * 2); c.fill(); });
    // medidor de ángulo
    const ok = s.ang >= 25 && s.ang <= 45;
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
    c.beginPath(); c.arc(P2.x, P2.y, 60, Math.PI, Math.PI + 1.05); c.stroke();
    c.strokeStyle = 'rgba(78,200,110,0.8)'; c.lineWidth = 5;
    c.beginPath(); c.arc(P2.x, P2.y, 60, Math.PI + 25 * Math.PI / 180, Math.PI + 45 * Math.PI / 180); c.stroke();
    c.fillStyle = ok ? '#7dffa0' : '#ffb4ab';
    c.font = '700 22px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillText(`${Math.round(s.ang)}°`, 560, 228);
    if (M.paso === 1) {
      c.font = '700 14px "Chivo", sans-serif';
      c.textAlign = 'center';
      const msg = s.ang < 25 ? 'Muy plano: las gotas caerían otra vez en el agua salada.' : s.ang > 45 ? 'Muy inclinado: el vapor se escapa por los lados.' : '¡Ángulo ideal! Mantenlo así…';
      c.fillText(msg, M.W / 2, 400);
    }
    // etiquetas de las fases
    if (M.paso >= 2) {
      c.font = '700 12px "JetBrains Mono", monospace'; c.fillStyle = '#ffe2a8'; c.textAlign = 'left';
      c.fillText('EVAPORACIÓN ↑', 200, 255);
      c.fillStyle = '#c3f5ff';
      c.fillText('CONDENSACIÓN', (P1.x + P2.x) / 2 - 40, (P1.y + P2.y) / 2 - 16);
    }
  }
};

// ------------------------------------------------- 2. TRIÁNGULO DEL FUEGO
RETOS.fuego = {
  modulo: 'RETO 2 · QUÍMICA · COMBUSTIÓN',
  titulo: 'Triángulo del fuego',
  pasos: ['Combustible: madera y yesca', 'Calor: raspar el pedernal 5 veces', 'Oxígeno: ¡soplar al micrófono!', '¡Fuego encendido!'],

  dato() {
    return `<p><b>Combustión:</b> celulosa + O₂ → CO₂ + H₂O + energía (calor y luz).</p>
      <p><b>Energía de activación:</b> la chispa calienta la yesca hasta la temperatura a la que empieza a arder.</p>
      <p><b>Sin oxígeno no hay fuego:</b> por eso, si cubres una llama con arena, se apaga.</p>
      <p class="mic-nota">${Sensores.mic.activo ? '🎤 Micrófono activo: ¡sopla de verdad!' : '⌨️ Micrófono apagado: mantén presionado <kbd>ESPACIO</kbd> para soplar.'}</p>`;
  },

  iniciar(M) {
    Object.assign(M.s, { golpes: 0, brasa: 0, o2: 0, tiempo: 20, llama: 0, vientoT: 0, crepT: 0 });
    M.estado('O₂ 0%');
    M.instruccion('Colocando la madera y la yesca en el anillo de piedras…');
    M.decir('Para tener fuego se necesitan tres cosas a la vez: combustible, calor y oxígeno. Eso es el triángulo del fuego. La madera y la yesca ya son el combustible. Ahora falta el calor: presiona E cinco veces para raspar el pedernal contra el acero.');
  },

  accion(M) {
    const s = M.s;
    if (M.paso === 1) {
      s.golpes++;
      Sonido.chispa();
      for (let i = 0; i < 16; i++) {
        M.s.particulas.push({ x: 440, y: 245, vx: -60 - Math.random() * 140, vy: -40 + Math.random() * 120, g: 200, r: 1.6 + Math.random() * 1.6, vida: 0.6, vidaMax: 0.6, color: Math.random() < 0.5 ? '#ffd166' : '#ff8c42' });
      }
      M.instruccion(`Raspa el pedernal contra el acero: <b>${s.golpes} de 5</b>. Presiona <kbd>E</kbd> o di «chispa».`);
      if (s.golpes >= 5) {
        s.brasa = 0.3; s.tiempo = 20; s.o2 = 0;
        M.irAPaso(2);
        M.instruccion(Sensores.mic.activo
          ? '¡Ya hay una brasa! <b>Sopla fuerte al micrófono</b> para darle oxígeno (o mantén presionado <kbd>ESPACIO</kbd>). Tienes 20 segundos.'
          : '¡Ya hay una brasa! Mantén presionado <kbd>ESPACIO</kbd> para soplarle oxígeno. Tienes 20 segundos.');
        M.decir('Ya hay una brasa, pero necesita oxígeno. Sopla fuerte al micrófono, o mantén presionada la barra espaciadora.');
      }
    } else if (M.paso === 3 && s.llama >= 1) {
      M.terminar();
    }
  },

  comando(M, cmd) { if (cmd === 'chispa' && M.paso === 1) this.accion(M); },

  actualizar(M, dt) {
    const s = M.s;
    if (M.paso === 0 && M.t > 1.4) {
      M.irAPaso(1);
      M.instruccion('Presiona <kbd>E</kbd> 5 veces (o di «chispa») para raspar el pedernal contra el acero.');
    }
    if (M.paso === 2) {
      const mic = Sensores.mic.activo ? Math.min(1, Sensores.intensidad() * 2) : 0;
      const soplo = Math.max(mic, teclas.espacio ? 0.85 : 0);
      // con un soplido normal se llena en unos 2 segundos
      s.o2 = Math.max(0, Math.min(100, s.o2 + (soplo * 95 - 8) * dt));
      s.brasa = 0.3 + 0.7 * s.o2 / 100;
      s.tiempo -= dt;
      M.estado(`O₂ ${Math.round(s.o2)}% · ${Math.max(0, Math.ceil(s.tiempo))} s`);
      if (soplo > 0.15) {
        s.vientoT -= dt;
        if (s.vientoT <= 0) { Sonido.viento(soplo); s.vientoT = 0.22; }
        if (Math.random() < dt * 30) M.s.particulas.push({ x: 120 + Math.random() * 40, y: 250 + Math.random() * 80, vx: 260, vy: (Math.random() - 0.5) * 20, r: 1.4, vida: 0.8, vidaMax: 0.8, color: 'rgba(195,245,255,0.7)' });
      }
      if (s.o2 >= 100) {
        M.irAPaso(3);
        Sonido.logro();
        M.estado('COMBUSTIÓN ✓');
        M.instruccion('¡Hay fuego! Se juntaron <b>combustible, oxígeno y calor</b>. Si falta cualquiera de los tres, la llama se apaga. Presiona <kbd>E</kbd> para seguir.');
        M.decir('¡Lo lograste, hay fuego! Recuerda: si quitas cualquiera de los tres lados del triángulo, la llama se apaga.');
      } else if (s.tiempo <= 0) {
        s.golpes = 0; s.brasa = 0; s.o2 = 0;
        M.irAPaso(1);
        M.avisar('La brasa se apagó por falta de oxígeno. ¡Raspa otra vez el pedernal!');
        M.instruccion('Presiona <kbd>E</kbd> 5 veces (o di «chispa») para raspar otra vez el pedernal.');
        Sonido.error();
        M.decir('La brasa se apagó porque le faltó oxígeno. Inténtalo de nuevo y sopla con más fuerza.');
      }
    }
    if (M.paso === 3) {
      s.llama = Math.min(1, s.llama + dt / 1.4);
      s.crepT -= dt;
      if (s.crepT <= 0) { Sonido.crepitar(); s.crepT = 0.08 + Math.random() * 0.2; }
    }
    // llamas
    const fuerza = M.paso === 3 ? 0.4 + s.llama * 0.6 : (s.brasa > 0.55 ? (s.brasa - 0.55) : 0);
    if (fuerza > 0 && Math.random() < dt * 90 * fuerza) {
      M.s.particulas.push({ x: 360 + (Math.random() - 0.5) * 50 * fuerza, y: 292, vx: (Math.random() - 0.5) * 20, vy: -70 - Math.random() * 90 * fuerza, r: 5 + Math.random() * 8 * fuerza, vida: 0.7, vidaMax: 0.7, color: Math.random() < 0.5 ? 'rgba(255,170,60,0.85)' : 'rgba(255,90,40,0.8)' });
    }
  },

  dibujar(M, c) {
    const s = M.s;
    c.fillStyle = '#0d1418'; c.fillRect(0, 0, M.W, M.H);
    const V = { o2: { x: 360, y: 52 }, comb: { x: 120, y: 368 }, calor: { x: 600, y: 368 } };
    const hechoComb = M.paso >= 1, hechoCalor = M.paso >= 2, hechoO2 = M.paso >= 3;
    // lados del triángulo
    const lado = (A, B, activo) => {
      c.setLineDash(activo ? [] : [8, 8]);
      c.strokeStyle = activo ? '#00e5ff' : 'rgba(0,229,255,0.25)';
      c.lineWidth = activo ? 3 : 2;
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
    };
    lado(V.comb, V.calor, hechoComb && hechoCalor);
    lado(V.comb, V.o2, hechoComb && hechoO2);
    lado(V.calor, V.o2, hechoCalor && hechoO2);
    c.setLineDash([]);
    // vértices
    const vertice = (P, etiqueta, icono, progreso, abajo) => {
      c.fillStyle = 'rgba(18,23,26,0.95)';
      c.beginPath(); c.arc(P.x, P.y, 30, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 4;
      c.beginPath(); c.arc(P.x, P.y, 30, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = progreso >= 1 ? '#00e5ff' : '#e5c384'; c.lineWidth = 4;
      c.beginPath(); c.arc(P.x, P.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progreso); c.stroke();
      c.font = '24px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(icono, P.x, P.y + 1);
      c.font = '700 13px "JetBrains Mono", monospace';
      c.fillStyle = progreso >= 1 ? '#00e5ff' : '#dfe3e7';
      c.fillText(etiqueta, P.x, P.y + (abajo ? 46 : -46));
    };
    vertice(V.o2, 'OXÍGENO (O₂)', '💨', hechoO2 ? 1 : (M.paso === 2 ? s.o2 / 100 : 0), false);
    vertice(V.comb, 'COMBUSTIBLE', '🪵', hechoComb ? 1 : Math.min(1, M.t / 1.4), true);
    vertice(V.calor, 'CALOR', '✨', hechoCalor ? 1 : s.golpes / 5, true);
    // fogata en el centro
    const brillo = M.paso === 3 ? 1 : s.brasa;
    if (brillo > 0) {
      const g = c.createRadialGradient(360, 290, 4, 360, 290, 90 + 60 * brillo);
      g.addColorStop(0, `rgba(255,140,40,${0.55 * brillo})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(360, 290, 150, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      c.fillStyle = '#6b6f73';
      c.beginPath(); c.ellipse(360 + Math.cos(a) * 62, 300 + Math.sin(a) * 18, 14, 10, 0, 0, Math.PI * 2); c.fill();
    }
    c.save(); c.translate(360, 296);
    [[-0.5, '#7a4a2a'], [0.5, '#6a3e22'], [0, '#83532f']].forEach(([rot, col]) => {
      c.save(); c.rotate(rot); c.fillStyle = col; c.fillRect(-46, -6, 92, 12); c.restore();
    });
    c.restore();
    c.fillStyle = s.brasa > 0 || M.paso === 3 ? `rgb(${200 + 55 * brillo},${120 + 60 * brillo},40)` : '#c8a860';
    c.beginPath(); c.ellipse(360, 288, 18, 9, 0, 0, Math.PI * 2); c.fill();
    // pedernal y acero
    if (M.paso <= 1) {
      c.font = '30px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      c.fillText('🪨', 452 + Math.sin(M.t * 20) * (M.paso === 1 ? 1.5 : 0), 236);
    }
    // barra de oxígeno
    if (M.paso >= 2) {
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(250, 392, 220, 12);
      c.fillStyle = '#00e5ff'; c.fillRect(250, 392, 220 * s.o2 / 100, 12);
      c.strokeStyle = 'rgba(0,229,255,0.5)'; c.strokeRect(250, 392, 220, 12);
    }
    if (M.paso === 2) M.medidorMic(c, 680, 150, 160);
  }
};

// ------------------------------------------------- 3. CIRCUITO DE LA BALIZA
const BORNES = {
  1: { id: 'B+', x: 215, y: 150, nombre: 'Batería (+)' },
  2: { id: 'B-', x: 215, y: 290, nombre: 'Batería (−)' },
  3: { id: 'L+', x: 505, y: 150, nombre: 'LED (+) ánodo' },
  4: { id: 'L-', x: 505, y: 290, nombre: 'LED (−) cátodo' }
};

RETOS.baliza = {
  modulo: 'RETO 3 · FÍSICA · ELECTRICIDAD',
  titulo: 'Circuito de la baliza S.O.S.',
  pasos: ['Unir el (+) de la batería con el (+) del LED', 'Unir el (−) del LED con el (−) de la batería', 'Circuito cerrado: V = I · R', 'Enviar el S.O.S. ¡con tu voz!'],

  dato() {
    return `<p><b>Ley de Ohm:</b> V = I · R</p>
      <p>Batería <b>12 V</b> · LED con resistencia <b>6 Ω</b></p>
      <p><b>I</b> = 12 V ÷ 6 Ω = <b>2 A</b> · <b>P</b> = V · I = <b>24 W</b></p>
      <p><b>Diodo LED:</b> la corriente solo lo atraviesa en un sentido, del ánodo (+) al cátodo (−).</p>
      <p><b>Cortocircuito:</b> si unes + con − sin nada en medio, la resistencia es casi cero y la corriente se dispara.</p>`;
  },

  iniciar(M) {
    Object.assign(M.s, { sel: null, cables: [], cerrado: false, grito: 0, morse: null, flash: 0 });
    M.estado('CIRCUITO ABIERTO');
    M.instruccion('Haz clic en dos bornes para unirlos con un cable (o usa las teclas <kbd>1</kbd> a <kbd>4</kbd>). Une el <b>+ con el +</b> y el <b>− con el −</b>.');
    M.decir('Para prender la baliza hay que cerrar el circuito. Une el positivo de la batería con el positivo del LED, y el negativo del LED con el negativo de la batería. Haz clic en los bornes o presiona las teclas del uno al cuatro.');
  },

  tieneCable(s, a, b) { return s.cables.some(([x, y]) => (x === a && y === b) || (x === b && y === a)); },
  usado(s, id) { return s.cables.some(([x, y]) => x === id || y === id); },

  elegir(M, n) {
    const s = M.s;
    if (s.cerrado || !BORNES[n]) return;
    const id = BORNES[n].id;
    if (s.sel === null) { s.sel = id; Sonido.click(); return; }
    if (s.sel === id) { s.sel = null; return; }
    this.conectar(M, s.sel, id);
    s.sel = null;
  },

  conectar(M, a, b) {
    const s = M.s;
    const par = [a, b].sort().join('|');
    if (this.usado(s, a) || this.usado(s, b)) { M.avisar('Ese borne ya tiene un cable.'); Sonido.error(); return; }
    if (par === 'B+|B-') {
      s.flash = 1;
      M.avisar('¡Cortocircuito! Sin nada en medio, la corriente se dispara. Quitamos el cable.', '#ff5252', 4);
      Sonido.error();
      M.decir('¡Cortocircuito! Si unes el positivo con el negativo sin nada en medio, la corriente se dispara y la batería se recalienta.');
      return;
    }
    if (par === 'L+|L-') { M.avisar('Así la corriente no pasa por la batería y no hay circuito.'); Sonido.error(); return; }
    s.cables.push([a, b]);
    Sonido.click();
    const correcto1 = this.tieneCable(s, 'B+', 'L+'), correcto2 = this.tieneCable(s, 'B-', 'L-');
    const invertido = this.tieneCable(s, 'B+', 'L-') && this.tieneCable(s, 'B-', 'L+');
    if (invertido) {
      s.cables = [];
      M.avisar('El LED quedó al revés: solo deja pasar corriente en un sentido. Quitamos los cables.', '#ffb4ab', 4.5);
      Sonido.error();
      M.decir('El LED quedó al revés. Un diodo solo deja pasar la corriente en un sentido. Inténtalo de nuevo.');
      M.irAPaso(0);
      return;
    }
    if (correcto1 && M.paso === 0) M.irAPaso(1);
    if (correcto1 && correcto2) {
      s.cerrado = true;
      M.irAPaso(2);
      Sonido.zumbido();
      Sonido.logro();
      M.estado('2 A · 24 W');
      M.instruccion('¡Circuito cerrado! Los electrones salen por el (−) de la batería y regresan por el (+). Presiona <kbd>E</kbd> para prender la baliza.');
      M.decir('¡Circuito cerrado! Doce voltios divididos entre seis ohmios dan una corriente de dos amperios. Presiona E para prender la baliza.');
    }
  },

  accion(M) {
    if (M.paso === 2) {
      M.irAPaso(3);
      M.instruccion('¡GRITA <b class="grito">«AUXILIO»</b> al micrófono! <small>(o presiona <kbd>S</kbd>)</small>');
      M.decir('Ahora grita con fuerza la palabra que aparece en la pantalla.');
    }
  },

  tecla(M, k) {
    if (['1', '2', '3', '4'].includes(k) && M.paso <= 1) this.elegir(M, Number(k));
    if (k === 's' && M.paso === 3) this.enviarSOS(M);
  },

  comando(M, cmd) { if (cmd === 'auxilio' && M.paso === 3) this.enviarSOS(M); },

  clic(M, x, y) {
    if (M.paso > 1) return;
    for (const n in BORNES) {
      if (Math.hypot(BORNES[n].x - x, BORNES[n].y - y) < 26) { this.elegir(M, Number(n)); return; }
    }
  },

  enviarSOS(M) {
    if (M.s.morse) return;
    Sensores.callar();
    M.estado('S.O.S. ···———···');
    M.instruccion('<b>Enviando el S.O.S.</b> en código Morse: tres destellos cortos, tres largos y tres cortos.');
    // secuencia [encendido, duración]
    const sec = [];
    const letra = (dur) => { for (let i = 0; i < 3; i++) { sec.push([true, dur]); sec.push([false, 0.2]); } sec[sec.length - 1][1] = 0.55; };
    letra(0.2); letra(0.6); letra(0.2);
    M.s.morse = { sec, i: 0, t: 0 };
    Sonido.morse(sec[0][1]);
  },

  actualizar(M, dt) {
    const s = M.s;
    s.flash = Math.max(0, s.flash - dt * 2);
    if (M.paso === 3 && !s.morse) {
      s.grito = Sensores.gritando() ? s.grito + dt : Math.max(0, s.grito - dt * 0.5);
      if (s.grito > 0.5) this.enviarSOS(M);
    }
    if (s.morse) {
      const m = s.morse;
      m.t += dt;
      if (m.i < m.sec.length && m.t >= m.sec[m.i][1]) {
        m.t = 0; m.i++;
        if (m.i < m.sec.length && m.sec[m.i][0]) Sonido.morse(m.sec[m.i][1]);
      }
      if (m.i >= m.sec.length && m.t > 0.9) { M.irAPaso(4); M.terminar(); }
    }
  },

  dibujar(M, c) {
    const s = M.s;
    c.fillStyle = '#0d1418'; c.fillRect(0, 0, M.W, M.H);
    if (s.flash > 0) { c.fillStyle = `rgba(255,60,60,${s.flash * 0.35})`; c.fillRect(0, 0, M.W, M.H); }
    // batería
    c.fillStyle = '#20262b'; c.strokeStyle = '#3b494c'; c.lineWidth = 2;
    c.fillRect(95, 120, 110, 200); c.strokeRect(95, 120, 110, 200);
    c.fillStyle = '#e5c384'; c.font = '700 16px "Space Grotesk", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('12 V', 150, 205); c.font = '600 10px "JetBrains Mono", monospace'; c.fillStyle = '#bac9cc'; c.fillText('AURORA', 150, 228);
    // LED / lámpara
    const encendida = s.cerrado && (!s.morse || (s.morse.i < s.morse.sec.length && s.morse.sec[s.morse.i][0]));
    const luz = encendida ? (s.morse ? 1 : 0.45) : 0;
    if (luz > 0) {
      const g = c.createRadialGradient(585, 220, 10, 585, 220, 200 * luz + 40);
      g.addColorStop(0, `rgba(230,255,255,${0.9 * luz})`); g.addColorStop(1, 'rgba(0,229,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(585, 220, 240, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = luz > 0 ? '#e9ffff' : '#2a3a40';
    c.beginPath(); c.arc(585, 205, 42, Math.PI, 0); c.lineTo(627, 245); c.lineTo(543, 245); c.closePath(); c.fill();
    c.strokeStyle = '#849396'; c.stroke();
    c.fillStyle = '#20262b'; c.fillRect(540, 245, 90, 60); c.strokeRect(540, 245, 90, 60);
    c.fillStyle = '#bac9cc'; c.font = '600 10px "JetBrains Mono", monospace'; c.fillText('LED GaN · 6 Ω', 585, 278);
    // cables internos de los bornes a los componentes
    c.strokeStyle = '#555f66'; c.lineWidth = 3;
    [[215, 150, 205, 150], [215, 290, 205, 290], [505, 150, 560, 170], [505, 290, 540, 290]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
    // cables del jugador
    s.cables.forEach(([a, b]) => {
      const A = Object.values(BORNES).find(x => x.id === a), B = Object.values(BORNES).find(x => x.id === b);
      c.strokeStyle = a.includes('+') || b.includes('+') ? '#ff5a4f' : '#2b2b2b';
      if (a.includes('-') && b.includes('-')) c.strokeStyle = '#1d1d1d';
      c.lineWidth = 7;
      c.beginPath(); c.moveTo(A.x, A.y); c.bezierCurveTo((A.x + B.x) / 2, A.y - 40, (A.x + B.x) / 2, B.y - 40, B.x, B.y); c.stroke();
      c.strokeStyle = '#d68a4c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(A.x, A.y); c.bezierCurveTo((A.x + B.x) / 2, A.y - 40, (A.x + B.x) / 2, B.y - 40, B.x, B.y); c.stroke();
    });
    // electrones fluyendo (de − a +)
    if (s.cerrado) {
      const ruta = [[215, 290], [360, 250], [505, 290], [585, 230], [505, 150], [360, 110], [215, 150], [150, 220], [215, 290]];
      c.fillStyle = '#00e5ff'; c.shadowColor = '#00e5ff'; c.shadowBlur = 8;
      for (let k = 0; k < 14; k++) {
        const u = ((M.t * 0.25 + k / 14) % 1) * (ruta.length - 1);
        const i = Math.floor(u), f = u - i;
        const x = ruta[i][0] + (ruta[i + 1][0] - ruta[i][0]) * f, y = ruta[i][1] + (ruta[i + 1][1] - ruta[i][1]) * f;
        c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
      }
      c.shadowBlur = 0;
      c.fillStyle = '#c3f5ff'; c.font = '700 18px "JetBrains Mono", monospace';
      c.fillText('I = V / R = 12 / 6 = 2 A', 360, 360);
      c.font = '600 12px "JetBrains Mono", monospace'; c.fillStyle = '#bac9cc';
      c.fillText('Los electrones van del (−) al (+)', 360, 386);
    }
    // bornes
    Object.entries(BORNES).forEach(([n, b]) => {
      const sel = s.sel === b.id;
      c.fillStyle = sel ? '#00e5ff' : (b.id.includes('+') ? '#93000a' : '#303539');
      c.beginPath(); c.arc(b.x, b.y, 16, 0, Math.PI * 2); c.fill();
      c.strokeStyle = sel ? '#ffffff' : '#c3f5ff'; c.lineWidth = sel ? 3 : 1.5; c.stroke();
      c.fillStyle = '#ffffff'; c.font = '700 15px "JetBrains Mono", monospace';
      c.fillText(b.id.includes('+') ? '+' : '−', b.x, b.y + 1);
      c.font = '600 11px "JetBrains Mono", monospace'; c.fillStyle = '#e5c384';
      c.fillText(`[${n}] ${b.nombre}`, b.x + (b.x < 360 ? -10 : 10), b.y + (b.y < 200 ? -28 : 30));
    });
    if (M.paso === 3 && !s.morse) {
      c.fillStyle = '#ffffff'; c.font = '700 40px "Space Grotesk", sans-serif';
      c.fillText('¡AUXILIO!', 360, 60 + Math.sin(M.t * 8) * 3);
      M.medidorMic(c, 680, 150, 160);
      c.strokeStyle = '#ff5252'; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(676, 150 + 160 * (1 - 0.62)); c.lineTo(700, 150 + 160 * (1 - 0.62)); c.stroke(); c.setLineDash([]);
    }
  }
};
