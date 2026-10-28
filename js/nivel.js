// =====================================================================
//  nivel.js → Los niveles de plataformas.
//  Piso con huecos (agua, lodo o abismo), plataformas (cajas, rocas,
//  troncos y puentes de bambú), enemigos que patrullan (cangrejos y
//  serpientes), rocas que caen, ráfagas de viento y el fondo con
//  profundidad (se mueve más lento que el primer plano: efecto parallax).
// =====================================================================

const VISTA_W = 1280, VISTA_H = 720;
const FONDO_W = 1472, FONDO_H = 828;      // fondo un poco más grande que la pantalla

// Número pseudoaleatorio fijo para cada posición (así los detalles no "bailan")
const azar = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const TERRENOS = {
  arena:  { arriba: '#dcbc88', abajo: '#a27b4b', borde: '#f2dcb0', roca: ['#a8957a', '#6f604e'] },
  tierra: { arriba: '#5a4129', abajo: '#21150c', borde: '#6e9a3a', roca: ['#6d7558', '#3c4232'] },
  roca:   { arriba: '#80858a', abajo: '#383b3f', borde: '#a9afb4', roca: ['#8a8f94', '#45494d'] }
};

const Nivel = {
  z: null,
  ancho: VISTA_W,
  suelo: 600,
  segmentos: [],
  plataformas: [],
  todos: [],
  enemigos: [],
  rocas: [],
  rocaT: 2.5,
  viento: { t: 0, fuerza: 0 },
  fondo: null,

  cargar(z) {
    this.z = z;
    this.ancho = z.ancho || VISTA_W;
    this.suelo = z.suelo;
    // el piso es todo el ancho menos los huecos
    this.segmentos = [];
    let x = 0;
    (z.huecos || []).forEach(([a, b]) => { this.segmentos.push({ x1: x, x2: a, y: z.suelo, piso: true }); x = b; });
    this.segmentos.push({ x1: x, x2: this.ancho, y: z.suelo, piso: true });
    this.plataformas = (z.plataformas || []).map(([px, py, w, tipo]) => ({ x1: px, x2: px + w, y: py, tipo }));
    this.todos = this.segmentos.concat(this.plataformas);
    this.enemigos = (z.enemigos || []).map(([tipo, a, b], i) => ({
      tipo, x1: a, x2: b, x: (a + b) / 2, y: z.suelo, dir: i % 2 ? -1 : 1, vivo: true, muerteT: 0, fase: azar(i) * 6
    }));
    this.rocas = [];
    this.rocaT = 2.5;
    this.viento = { t: 0, fuerza: 0 };
    this.prepararFondo(z);
  },

  // ------------------------------------------------------------ física
  // Plataforma o piso donde aterriza alguien que baja de yAntes a yDespues
  aterrizaje(x, yAntes, yDespues) {
    let mejor = null;
    for (const s of this.todos) {
      if (x >= s.x1 - 12 && x <= s.x2 + 12 && yAntes <= s.y + 2 && yDespues >= s.y && (!mejor || s.y < mejor.y)) mejor = s;
    }
    return mejor;
  },
  // Primer piso que hay debajo de (x, desde)
  pisoBajo(x, desde) {
    let y = VISTA_H + 80;
    for (const s of this.todos) if (x >= s.x1 && x <= s.x2 && s.y >= desde && s.y < y) y = s.y;
    return y;
  },
  enHueco(x) { return (this.z.huecos || []).some(([a, b]) => x > a && x < b); },

  // ---------------------------------------------------------- peligros
  actualizar(dt, jugador) {
    this.enemigos.forEach(e => {
      if (!e.vivo) { e.muerteT -= dt; return; }
      const v = e.tipo === 'cangrejo' ? 75 : 48;
      e.x += e.dir * v * dt;
      if (e.x < e.x1) { e.x = e.x1; e.dir = 1; }
      if (e.x > e.x2) { e.x = e.x2; e.dir = -1; }
      e.fase += dt * (e.tipo === 'cangrejo' ? 14 : 5);
    });
    // rocas que caen (solo en la cumbre y delante de Alek)
    if (this.z.rocas) {
      const [desde, hasta] = this.z.rocas;
      this.rocaT -= dt;
      if (this.rocaT <= 0 && jugador.x > desde && jugador.x < hasta) {
        const x = jugador.x + 60 + Math.random() * 320;
        if (!this.enHueco(x)) this.rocas.push({ x, y: -40, vy: 0, r: 15 + Math.random() * 9, giro: 0, piso: this.pisoBajo(x, 0) });
        this.rocaT = 1.9 + Math.random() * 1.6;
      }
    }
    this.rocas.forEach(r => { r.vy += 1100 * dt; r.y += r.vy * dt; r.giro += dt * 5; });
    // ráfagas de viento: cada 8 s, durante 2,5 s
    if (this.z.viento) {
      this.viento.t += dt;
      const ciclo = this.viento.t % 8;
      this.viento.fuerza = ciclo > 5.5 ? Math.sin((ciclo - 5.5) / 2.5 * Math.PI) : 0;
    }
  },

  // ------------------------------------------------------------- fondo
  prepararFondo(z) {
    this.fondo = null;
    if (z.fondoFijo) return;
    const img = IMG[z.id];
    const hacer = () => {
      const lienzoFondo = document.createElement('canvas');
      lienzoFondo.width = FONDO_W;
      lienzoFondo.height = FONDO_H;
      const c = lienzoFondo.getContext('2d');
      c.filter = 'blur(2px) brightness(0.8) saturate(0.95)';   // desenfocado = se ve lejos
      c.drawImage(img, 0, 0, FONDO_W, FONDO_H);
      this.fondo = lienzoFondo;
    };
    if (img.complete && img.naturalWidth) hacer();
    else img.addEventListener('load', () => { if (this.z === z) hacer(); }, { once: true });
  },

  dibujarFondo(c, camX) {
    const img = IMG[this.z.id];
    if (this.z.fondoFijo && img.complete && img.naturalWidth) { c.drawImage(img, 0, 0, VISTA_W, VISTA_H); return; }
    if (!this.z.fondoFijo && this.fondo) {
      const avance = camX / Math.max(1, this.ancho - VISTA_W);
      c.drawImage(this.fondo, -avance * (FONDO_W - VISTA_W), -70);
      return;
    }
    const g = c.createLinearGradient(0, 0, 0, VISTA_H);
    g.addColorStop(0, '#1d5f8a'); g.addColorStop(1, '#c9a66b');
    c.fillStyle = g; c.fillRect(0, 0, VISTA_W, VISTA_H);
  },

  // ----------------------------------------------------- primer plano
  dibujarTerreno(c, camX, t) {
    if (!this.z.fondoFijo) {
      (this.z.huecos || []).forEach(([a, b]) => { if (b > camX - 40 && a < camX + VISTA_W + 40) this.dibujarHueco(c, a, b, t); });
      this.segmentos.forEach(s => { if (s.x2 > camX - 40 && s.x1 < camX + VISTA_W + 40) this.dibujarPiso(c, s, camX); });
    }
    this.plataformas.forEach(p => { if (p.x2 > camX - 60 && p.x1 < camX + VISTA_W + 60) this.dibujarPlataforma(c, p, t); });
  },

  dibujarPiso(c, s, camX) {
    const col = TERRENOS[this.z.terreno];
    const y = s.y;
    const g = c.createLinearGradient(0, y, 0, VISTA_H);
    g.addColorStop(0, col.arriba); g.addColorStop(1, col.abajo);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(s.x1, VISTA_H);
    c.lineTo(s.x1, y + 16); c.quadraticCurveTo(s.x1, y, s.x1 + 16, y);
    c.lineTo(s.x2 - 16, y); c.quadraticCurveTo(s.x2, y, s.x2, y + 16);
    c.lineTo(s.x2, VISTA_H);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = col.borde; c.lineWidth = 4;
    c.beginPath(); c.moveTo(s.x1 + 10, y + 2); c.lineTo(s.x2 - 10, y + 2); c.stroke();
    // detalles del terreno
    const desde = Math.max(s.x1 + 8, Math.floor((camX - 20) / 18) * 18), hasta = Math.min(s.x2 - 12, camX + VISTA_W + 20);
    for (let x = desde; x < hasta; x += 18) {
      const h = azar(x);
      if (this.z.terreno === 'arena') {
        c.fillStyle = 'rgba(110,80,45,0.35)';
        c.fillRect(x + h * 12, y + 14 + azar(x + 1) * 95, 3, 2);
        if (h > 0.85) { c.fillStyle = '#efe2c8'; c.beginPath(); c.ellipse(x, y + 6, 4, 2.5, 0, 0, Math.PI * 2); c.fill(); }  // conchas
      } else if (this.z.terreno === 'tierra') {
        c.fillStyle = h > 0.5 ? '#4e7d31' : '#3b6326';
        c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + 5, y - 6 - h * 7); c.lineTo(x + 10, y + 4); c.fill();
        if (h < 0.15) { c.fillStyle = '#6b5a45'; c.beginPath(); c.ellipse(x + 6, y + 30 + h * 200, 5, 3, 0, 0, Math.PI * 2); c.fill(); }
      } else {
        if (h < 0.35) {                                                 // manchas de roca
          c.fillStyle = h < 0.17 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.07)';
          c.beginPath(); c.ellipse(x + 6, y + 30 + azar(x + 3) * 70, 8 + h * 20, 4 + h * 8, 0, 0, Math.PI * 2); c.fill();
        }
        if (h > 0.6) {
          c.strokeStyle = 'rgba(25,27,30,0.45)'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(x, y + 10 + h * 20); c.lineTo(x + 8, y + 22 + h * 30); c.lineTo(x + 4, y + 40 + h * 30); c.stroke();
        }
      }
    }
  },

  dibujarHueco(c, a, b, t) {
    const y = this.suelo;
    if (this.z.peligro === 'agua') {
      const g = c.createLinearGradient(0, y + 20, 0, VISTA_H);
      g.addColorStop(0, '#2a8fb0'); g.addColorStop(1, '#0a3246');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(a, VISTA_H);
      for (let x = a; x <= b; x += 8) c.lineTo(x, y + 26 + Math.sin(x * 0.06 + t * 3) * 4);
      c.lineTo(b, VISTA_H); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(230,250,255,0.75)'; c.lineWidth = 2;
      c.beginPath();
      for (let x = a; x <= b; x += 8) { const yy = y + 26 + Math.sin(x * 0.06 + t * 3) * 4; x === a ? c.moveTo(x, yy) : c.lineTo(x, yy); }
      c.stroke();
    } else if (this.z.peligro === 'lodo') {
      const g = c.createLinearGradient(0, y + 18, 0, VISTA_H);
      g.addColorStop(0, '#5d4627'); g.addColorStop(1, '#241a0e');
      c.fillStyle = g; c.fillRect(a, y + 18, b - a, VISTA_H - y - 18);
      for (let k = 0; k < 6; k++) {                                   // burbujas
        const bx = a + (b - a) * azar(a + k), fase = (t * 0.6 + azar(k + a)) % 1;
        c.strokeStyle = `rgba(150,120,70,${1 - fase})`; c.lineWidth = 2;
        c.beginPath(); c.arc(bx, y + 24, 2 + fase * 7, Math.PI, 0); c.stroke();
      }
    } else {
      const g = c.createLinearGradient(0, y, 0, VISTA_H);
      g.addColorStop(0, 'rgba(25,35,48,0.55)'); g.addColorStop(0.4, '#0b1118'); g.addColorStop(1, '#030507');
      c.fillStyle = g; c.fillRect(a, y + 4, b - a, VISTA_H - y - 4);
      c.fillStyle = 'rgba(200,215,230,0.12)';                         // neblina
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(a + (b - a) * ((t * 0.05 + k / 3) % 1), y + 70 + k * 25, 60, 12, 0, 0, Math.PI * 2); c.fill(); }
    }
  },

  dibujarPlataforma(c, p, t) {
    const w = p.x2 - p.x1;
    const col = TERRENOS[this.z.terreno || 'arena'];
    c.lineJoin = 'round';
    if (p.tipo === 'caja') {
      const piso = this.pisoBajo(p.x1 + w / 2, p.y + 5);
      const alto = 42;
      const n = Math.max(1, Math.ceil((Math.min(piso, VISTA_H) - p.y) / alto));
      for (let k = n - 1; k >= 0; k--) {
        const by = p.y + k * alto, dx = k % 2 ? 4 : -2;
        c.fillStyle = '#a07848'; c.strokeStyle = '#4f3519'; c.lineWidth = 2;
        c.fillRect(p.x1 + dx, by, w, alto); c.strokeRect(p.x1 + dx, by, w, alto);
        c.strokeStyle = 'rgba(79,53,25,0.6)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(p.x1 + dx + 4, by + alto / 2); c.lineTo(p.x1 + dx + w - 4, by + alto / 2); c.stroke();
        c.beginPath(); c.moveTo(p.x1 + dx + 4, by + 4); c.lineTo(p.x1 + dx + w - 4, by + alto - 4); c.stroke();
      }
      c.fillStyle = '#c29a62'; c.fillRect(p.x1 - 2, p.y, w, 4);
    } else if (p.tipo === 'roca') {
      // pilar de roca con silueta irregular (cada roca es distinta, pero siempre igual)
      const [claro, oscuro] = col.roca;
      const semilla = p.x1;
      const alto = VISTA_H - p.y;
      const silueta = [[p.x1 - 16, VISTA_H]];
      for (let k = 5; k >= 1; k--) silueta.push([p.x1 - 2 - azar(semilla + k) * 16, p.y + alto * k / 6]);
      silueta.push([p.x1 + 1, p.y + 10], [p.x1 + 12, p.y], [p.x1 + w * 0.5, p.y - 2], [p.x2 - 12, p.y], [p.x2 - 1, p.y + 10]);
      for (let k = 1; k <= 5; k++) silueta.push([p.x2 + 2 + azar(semilla + 10 + k) * 16, p.y + alto * k / 6]);
      silueta.push([p.x2 + 16, VISTA_H]);
      const trazar = () => { c.beginPath(); silueta.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
      const g = c.createLinearGradient(p.x1 - 10, 0, p.x2 + 10, 0);
      g.addColorStop(0, oscuro); g.addColorStop(0.35, claro); g.addColorStop(0.6, claro); g.addColorStop(1, oscuro);
      c.fillStyle = g; trazar(); c.fill();
      c.save(); trazar(); c.clip();
      c.fillStyle = 'rgba(0,0,0,0.2)';                                   // cara en sombra
      c.beginPath(); c.moveTo(p.x1 + w * 0.62, p.y); c.lineTo(p.x2 + 20, p.y + 20); c.lineTo(p.x2 + 20, VISTA_H); c.lineTo(p.x1 + w * 0.45, VISTA_H); c.closePath(); c.fill();
      for (let k = 0; k < 7; k++) {                                       // manchas de mineral
        c.fillStyle = k % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.13)';
        c.beginPath(); c.ellipse(p.x1 + azar(semilla + 20 + k) * w, p.y + 24 + azar(semilla + 30 + k) * (alto - 40), 6 + azar(k + semilla) * 10, 4 + azar(k + 2) * 6, 0, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(20,20,22,0.45)'; c.lineWidth = 1.6;           // grietas
      for (let k = 0; k < 2; k++) {
        let gx = p.x1 + w * (0.25 + 0.45 * azar(semilla + 40 + k)), gy = p.y + 14 + k * 50;
        c.beginPath(); c.moveTo(gx, gy);
        for (let s = 0; s < 4; s++) { gx += (azar(semilla + s + k * 7) - 0.5) * 16; gy += 14 + azar(s + k) * 12; c.lineTo(gx, gy); }
        c.stroke();
      }
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; trazar(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 3;            // borde de arriba iluminado
      c.beginPath(); c.moveTo(p.x1 + 12, p.y + 2); c.lineTo(p.x2 - 12, p.y + 2); c.stroke();
      if (this.z.terreno === 'tierra') {                                   // musgo
        c.fillStyle = '#4e7d31';
        c.beginPath(); c.moveTo(p.x1 + 2, p.y + 6); c.quadraticCurveTo(p.x1 + w / 2, p.y - 6, p.x2 - 2, p.y + 6); c.lineTo(p.x2 - 8, p.y + 14); c.quadraticCurveTo(p.x1 + w / 2, p.y + 4, p.x1 + 8, p.y + 14); c.closePath(); c.fill();
      } else if (this.z.terreno === 'arena') {                             // arena encima
        c.fillStyle = '#e6cc9a';
        c.beginPath(); c.moveTo(p.x1 + 8, p.y + 3); c.quadraticCurveTo(p.x1 + w / 2, p.y - 5, p.x2 - 8, p.y + 3); c.closePath(); c.fill();
      }
    } else if (p.tipo === 'tronco') {
      const piso = this.pisoBajo(p.x1 + w / 2, p.y + 30);
      c.strokeStyle = '#4a2f1a'; c.lineWidth = 7;                      // soportes
      [p.x1 + 18, p.x2 - 18].forEach(px => { c.beginPath(); c.moveTo(px, p.y + 18); c.lineTo(px, Math.min(piso, VISTA_H)); c.stroke(); });
      const g = c.createLinearGradient(0, p.y, 0, p.y + 24);
      g.addColorStop(0, '#946238'); g.addColorStop(1, '#5c3a1f');
      c.fillStyle = g; c.strokeStyle = '#3a2412'; c.lineWidth = 2;
      rrect(c, p.x1, p.y, w, 24, 12); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(58,36,18,0.55)'; c.lineWidth = 1.5;
      for (let x = p.x1 + 20; x < p.x2 - 14; x += 26) { c.beginPath(); c.moveTo(x, p.y + 6); c.lineTo(x + 12, p.y + 8); c.stroke(); }
      c.fillStyle = '#d1a36b';                                         // anillos del tronco
      c.beginPath(); c.ellipse(p.x2 - 5, p.y + 12, 5, 11, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (p.tipo === 'rama') {
      c.strokeStyle = '#3e6b2a'; c.lineWidth = 3;                      // lianas que la sostienen
      [p.x1 + 10, p.x2 - 10].forEach(px => {
        c.beginPath(); c.moveTo(px, 0); c.quadraticCurveTo(px + Math.sin(t + px) * 6, p.y / 2, px, p.y); c.stroke();
      });
      for (let fila = 0; fila < 2; fila++) {                           // bambú
        const y = p.y + fila * 9;
        c.fillStyle = fila ? '#9c8a3c' : '#c2ad52'; c.strokeStyle = '#5f5420'; c.lineWidth = 1.5;
        rrect(c, p.x1, y, w, 10, 5); c.fill(); c.stroke();
        for (let x = p.x1 + 22; x < p.x2 - 6; x += 24) { c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x, y + 9); c.stroke(); }
      }
      c.fillStyle = '#4e7d31';
      [p.x1 + 6, p.x2 - 14].forEach(px => { c.beginPath(); c.ellipse(px + 4, p.y + 4, 9, 5, 0.4, 0, Math.PI * 2); c.fill(); });
    }
  },

  // --------------------------------------------------------- enemigos
  dibujarEnemigos(c, camX) {
    this.enemigos.forEach(e => {
      if (e.x < camX - 80 || e.x > camX + VISTA_W + 80) return;
      if (!e.vivo && e.muerteT <= 0) return;
      c.save();
      c.translate(e.x, e.y);
      if (!e.vivo) { const k = Math.max(0, e.muerteT / 0.45); c.globalAlpha = k; c.scale(1, Math.max(0.15, k)); }
      if (e.tipo === 'cangrejo') this.dibujarCangrejo(c, e); else this.dibujarSerpiente(c, e);
      c.restore();
    });
  },

  dibujarCangrejo(c, e) {
    const paso = Math.sin(e.fase);
    c.lineCap = 'round';
    c.strokeStyle = '#a3311d'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const dx = 8 + i * 6, lev = (i % 2 ? paso : -paso) * 3;
      [-1, 1].forEach(s => { c.beginPath(); c.moveTo(s * dx * 0.6, -10); c.lineTo(s * (dx + 6), -15 + lev); c.lineTo(s * (dx + 10), -1 + lev * 0.4); c.stroke(); });
    }
    const g = c.createRadialGradient(-4, -18, 2, 0, -14, 20);
    g.addColorStop(0, '#f58055'); g.addColorStop(1, '#b0381d');
    c.fillStyle = g; c.strokeStyle = '#5e1b0d'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, -14, 19, 11, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    [-1, 1].forEach(s => {
      c.strokeStyle = '#b0381d'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(s * 14, -18); c.lineTo(s * 22, -26 + paso * 2); c.stroke();
      c.fillStyle = '#e45a33'; c.strokeStyle = '#5e1b0d'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(s * 25, -28 + paso * 2, 6.5, 4.5, s * 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(s * 24, -28 + paso * 2); c.lineTo(s * 31, -31 + paso * 2); c.stroke();
    });
    [-5, 5].forEach(dx => {
      c.strokeStyle = '#b0381d'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(dx, -22); c.lineTo(dx, -30); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(dx, -31, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111111'; c.beginPath(); c.arc(dx + e.dir, -31, 1.5, 0, Math.PI * 2); c.fill();
    });
  },

  dibujarSerpiente(c, e) {
    c.scale(e.dir, 1);
    const puntos = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      puntos.push([-66 + u * 58, -7 + Math.sin(e.fase - u * 6) * 5 * (0.3 + u * 0.7) - u * 4]);
    }
    const trazo = () => { c.beginPath(); puntos.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#1f4d1c'; c.lineWidth = 13; trazo();
    c.strokeStyle = '#4f9e43'; c.lineWidth = 9; trazo();
    c.fillStyle = '#d8c24a';
    puntos.forEach(([x, y], i) => { if (i % 2 === 0 && i < 12) { c.beginPath(); c.arc(x, y - 1, 2.2, 0, Math.PI * 2); c.fill(); } });
    const [hx, hy] = puntos[12];
    c.fillStyle = '#3e8a37'; c.strokeStyle = '#1f4d1c'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(hx + 7, hy - 2, 11, 7.5, -0.15, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#f5e66b'; c.beginPath(); c.arc(hx + 10, hy - 5, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111111'; c.fillRect(hx + 9.6, hy - 7, 1.2, 4);
    if (Math.sin(e.fase * 1.7) > 0.4) {                                 // lengua
      c.strokeStyle = '#d6303a'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(hx + 17, hy - 1); c.lineTo(hx + 25, hy - 1); c.lineTo(hx + 28, hy - 4); c.moveTo(hx + 25, hy - 1); c.lineTo(hx + 28, hy + 2); c.stroke();
    }
  },

  // Caja de choque de cada enemigo (para saber si toca a Alek)
  cajaEnemigo(e) {
    if (e.tipo === 'cangrejo') return { x1: e.x - 24, x2: e.x + 24, y1: e.y - 32, y2: e.y };
    const cabeza = e.x + e.dir * 10;
    return { x1: Math.min(cabeza, e.x - e.dir * 64) - 4, x2: Math.max(cabeza, e.x - e.dir * 64) + 14, y1: e.y - 22, y2: e.y };
  },

  // ------------------------------------------------------------ rocas
  dibujarRocas(c) {
    this.rocas.forEach(r => {
      const cerca = Math.max(0, Math.min(1, 1 - (r.piso - r.y) / 700));
      c.fillStyle = `rgba(0,0,0,${0.18 + 0.4 * cerca})`;              // sombra de aviso
      c.beginPath(); c.ellipse(r.x, r.piso, r.r * (0.6 + 0.9 * cerca), 6, 0, 0, Math.PI * 2); c.fill();
      c.save();
      c.translate(r.x, r.y); c.rotate(r.giro);
      const g = c.createRadialGradient(-r.r * 0.3, -r.r * 0.3, 2, 0, 0, r.r);
      g.addColorStop(0, '#a3a8ad'); g.addColorStop(1, '#4a4e52');
      c.fillStyle = g; c.strokeStyle = '#25282b'; c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr2 = r.r * (0.8 + azar(k + r.r) * 0.3); k ? c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      c.closePath(); c.fill(); c.stroke();
      c.restore();
    });
  },

  // --------------------------------------------- torre de la baliza
  // Devuelve dónde está la lámpara (para la luz giratoria)
  dibujarTorre(c, x, piso, encendida) {
    const alto = 300, arriba = piso - alto;
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = '#8a8f94'; c.strokeStyle = '#2f3337'; c.lineWidth = 2;
    rrect(c, x - 48, piso - 26, 96, 28, 3); c.fill(); c.stroke();            // base de concreto
    c.strokeStyle = '#7a5136'; c.lineWidth = 5;                             // patas oxidadas
    c.beginPath(); c.moveTo(x - 32, piso - 26); c.lineTo(x - 11, arriba + 32); c.stroke();
    c.beginPath(); c.moveTo(x + 32, piso - 26); c.lineTo(x + 11, arriba + 32); c.stroke();
    c.lineWidth = 2.5;                                                       // travesaños en X
    const niveles = 7, paso = (alto - 58) / niveles;
    for (let k = 0; k < niveles; k++) {
      const y1 = piso - 26 - k * paso, y2 = y1 - paso;
      const a1 = 32 - (32 - 11) * (k / niveles), a2 = 32 - (32 - 11) * ((k + 1) / niveles);
      c.beginPath(); c.moveTo(x - a1, y1); c.lineTo(x + a2, y2); c.moveTo(x + a1, y1); c.lineTo(x - a2, y2); c.moveTo(x - a2, y2); c.lineTo(x + a2, y2); c.stroke();
    }
    c.fillStyle = '#4a4f54'; c.fillRect(x - 20, arriba + 26, 40, 8);
    c.strokeStyle = '#5a5f63'; c.lineWidth = 2;                             // antenas
    c.beginPath(); c.moveTo(x - 6, arriba + 12); c.lineTo(x - 16, arriba - 42); c.moveTo(x + 6, arriba + 12); c.lineTo(x + 20, arriba - 30); c.stroke();
    c.fillStyle = encendida ? '#eaffff' : '#33444a'; c.strokeStyle = '#1f2326';  // lámpara
    c.beginPath(); c.arc(x, arriba + 22, 13, Math.PI, 0); c.lineTo(x + 13, arriba + 27); c.lineTo(x - 13, arriba + 27); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#9a9f8f';                                                  // caja eléctrica
    rrect(c, x + 16, piso - 128, 28, 36, 2); c.fill(); c.stroke();
    c.fillStyle = encendida ? '#3dff7a' : '#ff4040';
    c.beginPath(); c.arc(x + 30, piso - 118, 3, 0, Math.PI * 2); c.fill();
    if (!encendida) {                                                         // cables sueltos
      c.strokeStyle = '#d68a4c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + 22, piso - 92); c.quadraticCurveTo(x + 30, piso - 60, x + 48, piso - 70); c.stroke();
      c.strokeStyle = '#d6303a';
      c.beginPath(); c.moveTo(x + 36, piso - 92); c.quadraticCurveTo(x + 46, piso - 50, x + 60, piso - 58); c.stroke();
    }
    return { x, y: arriba + 20 };
  }
};
