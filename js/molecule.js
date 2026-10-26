// =====================================================================
//  molecule.js → Visor del ESCÁNER ATÓMICO de BRISA
//   · modo 'mol': la molécula del objeto girando en 3D
//   · modo 'atomo': modelo de Bohr de un elemento (núcleo + capas de electrones)
// =====================================================================

class VisorMolecular {
  constructor(canvas) {
    this.lienzo = canvas;
    this.c = canvas.getContext('2d');
    this.W = 380;   // tamaño lógico (el canvas real es el doble para verse nítido)
    this.H = 260;
    this.modo = 'mol';
    this.mol = null;
    this.simbolo = null;
    this.t = 0;
    this.raf = null;
    this.electrones = [];
  }

  mostrarMolecula(mol) {
    this.modo = 'mol';
    this.mol = mol;
    this.t = 0;
    // escala: se prueba la molécula en 24 posiciones de giro para que siempre quepa en el visor
    let maxX = 0.5, maxY = 0.5;
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, b = 0.38;
      mol.atomos.forEach(([, x, y, z]) => {
        const z1 = -x * Math.sin(a) + z * Math.cos(a);
        maxX = Math.max(maxX, Math.abs(x * Math.cos(a) + z * Math.sin(a)) * (1 + Math.abs(z1) * 0.07));
        maxY = Math.max(maxY, Math.abs(y * Math.cos(b) - z1 * Math.sin(b)) * (1 + Math.abs(z1) * 0.07));
      });
    }
    this.escala = Math.min(72, (this.W / 2 - 20) / maxX, (this.H / 2 - 18) / maxY);
    this.electrones = [];
    for (let i = 0; i < (mol.electrones || 0); i++) {
      this.electrones.push({ x: Math.random() * this.W, y: Math.random() * this.H, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120 });
    }
    this.arrancar();
  }

  mostrarAtomo(simbolo) {
    this.modo = 'atomo';
    this.simbolo = simbolo;
    this.t = 0;
    this.arrancar();
  }

  arrancar() {
    if (this.raf) return;
    let ultimo = performance.now();
    const paso = (ahora) => {
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      this.t += dt;
      this.dibujar(dt);
      this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }

  detener() {
    cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  dibujar(dt) {
    const c = this.c;
    c.setTransform(this.lienzo.width / this.W, 0, 0, this.lienzo.height / this.H, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    // cuadrícula de laboratorio
    c.strokeStyle = 'rgba(0,229,255,0.06)';
    c.lineWidth = 1;
    for (let x = 0; x < this.W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.H); c.stroke(); }
    for (let y = 0; y < this.H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(this.W, y); c.stroke(); }
    if (this.modo === 'mol' && this.mol) this.dibujarMolecula(dt);
    if (this.modo === 'atomo' && this.simbolo) this.dibujarBohr();
  }

  esfera(x, y, r, color) {
    const c = this.c;
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, color);
    g.addColorStop(1, oscurecer(color, 0.45));
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1;
    c.stroke();
  }

  dibujarMolecula(dt) {
    const c = this.c;
    const m = this.mol;
    const a = this.t * 0.55;   // giro sobre el eje Y
    const b = 0.38;            // inclinación fija sobre el eje X
    const esc = this.escala;
    const cx = this.W / 2, cy = this.H / 2;

    const pts = m.atomos.map(([s, x, y, z, carga], i) => {
      const x1 = x * Math.cos(a) + z * Math.sin(a);
      const z1 = -x * Math.sin(a) + z * Math.cos(a);
      const y1 = y * Math.cos(b) - z1 * Math.sin(b);
      const z2 = y * Math.sin(b) + z1 * Math.cos(b);
      const p = 1 + z2 * 0.07;
      const aparicion = Math.max(0, Math.min(1, this.t * 7 - i * 0.3));
      return { s, carga, X: cx + x1 * esc * p, Y: cy + y1 * esc * p, z: z2, p, ap: easeOutBack(aparicion) };
    });

    // enlaces
    (m.enlaces || []).forEach(([i, j, orden]) => {
      const A = pts[i], B = pts[j];
      if (A.ap < 0.6 || B.ap < 0.6) return;
      c.strokeStyle = 'rgba(205,225,238,0.75)';
      c.lineWidth = 3.2 * (A.p + B.p) / 2;
      if (orden === 2) {
        const dx = B.X - A.X, dy = B.Y - A.Y, L = Math.hypot(dx, dy) || 1;
        const ox = -dy / L * 3, oy = dx / L * 3;
        [1, -1].forEach(s => { c.beginPath(); c.moveTo(A.X + ox * s, A.Y + oy * s); c.lineTo(B.X + ox * s, B.Y + oy * s); c.stroke(); });
      } else {
        c.beginPath(); c.moveTo(A.X, A.Y); c.lineTo(B.X, B.Y); c.stroke();
      }
    });

    // átomos (de atrás hacia adelante)
    [...pts].sort((A, B) => A.z - B.z).forEach(P => {
      const el = ELEMENTOS[P.s];
      const r = el.r * P.p * P.ap * Math.max(0.75, Math.min(1.15, esc / 46));
      if (r <= 0.5) return;
      this.esfera(P.X, P.Y, r, el.color);
      c.fillStyle = luminancia(el.color) > 0.55 ? '#10161a' : '#ffffff';
      c.font = `700 ${Math.max(8, r * 0.85)}px "JetBrains Mono", monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(P.s, P.X, P.Y + 0.5);
      if (P.carga) {
        c.fillStyle = '#00e5ff';
        c.font = '700 13px "JetBrains Mono", monospace';
        c.fillText(P.carga, P.X + r * 0.9, P.Y - r * 0.9);
      }
    });

    // mar de electrones (metales)
    this.electrones.forEach(e => {
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x < 40 || e.x > this.W - 40) e.vx *= -1;
      if (e.y < 30 || e.y > this.H - 30) e.vy *= -1;
      c.fillStyle = 'rgba(0,229,255,0.9)';
      c.shadowColor = '#00e5ff';
      c.shadowBlur = 8;
      c.beginPath(); c.arc(e.x, e.y, 2.6, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
    });
  }

  dibujarBohr() {
    const c = this.c;
    const el = ELEMENTOS[this.simbolo];
    const cx = this.W / 2, cy = this.H / 2 + 4;
    const n = el.capas.length;
    const radioNucleo = 12 + Math.min(10, el.protones / 9);
    const espacio = Math.min(22, (this.H / 2 - 18 - (radioNucleo + 12)) / Math.max(1, n - 1));

    // núcleo: protones (rojo) y neutrones (gris) en un racimo
    const piezas = Math.min(18, 3 + Math.round(el.protones / 4));
    for (let i = 0; i < piezas; i++) {
      const ang = i * 2.39996;
      const rr = Math.sqrt(i / piezas) * radioNucleo * 0.75;
      this.esfera(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 5.2, i % 2 ? '#9aa4ad' : '#ff5a4f');
    }

    // capas y electrones girando
    el.capas.forEach((cantidad, k) => {
      const R = radioNucleo + 12 + k * espacio;
      c.strokeStyle = 'rgba(0,229,255,0.28)';
      c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      for (let j = 0; j < cantidad; j++) {
        const ang = this.t * (1.3 / (k + 1)) + j * Math.PI * 2 / cantidad;
        c.fillStyle = '#00e5ff';
        c.shadowColor = '#00e5ff';
        c.shadowBlur = 6;
        c.beginPath(); c.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, cantidad > 20 ? 2 : 3, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
      }
    });

    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = '#ffffff';
    c.font = '700 20px "Space Grotesk", sans-serif';
    c.fillText(`${this.simbolo} · ${el.nombre}`, 10, 8);
    c.font = '500 11px "JetBrains Mono", monospace';
    c.fillStyle = '#bac9cc';
    c.fillText(`${el.protones} protones · ${el.protones} electrones`, 10, 32);
    c.textBaseline = 'bottom';
    c.fillText(`Capas: ${el.capas.join(', ')}`, 10, this.H - 8);
  }
}

// --- utilidades de color y animación ---
function oscurecer(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f)), g = Math.round(((n >> 8) & 255) * (1 - f)), b = Math.round((n & 255) * (1 - f));
  return `rgb(${r},${g},${b})`;
}
function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
