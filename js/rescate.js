// =====================================================================
//  rescate.js → El final del juego, animado dentro del juego:
//  la baliza se enciende, llega el helicóptero del buque Orión,
//  baja un cable y sube a Alek. Dura unos 16 segundos (Enter lo salta).
// =====================================================================

const Rescate = {
  activo: false,
  t: 0,
  heli: { x: 0, y: 0, inclinacion: 0 },
  cable: 0,          // largo del cable (px)
  elevacion: 0,      // cuánto ha subido Alek (px)
  esperaX: 830,      // lugar despejado donde Alek espera
  hitos: {},
  confeti: [],

  iniciar() {
    const p = J.jugador;
    this.activo = true;
    this.t = 0;
    this.hitos = {};
    this.confeti = [];
    this.cable = 0;
    this.elevacion = 0;
    this.heli = { x: ANCHO + 280, y: 70, inclinacion: -0.15 };
    p.pose = null;
    p.item = null;
    p.oculto = false;
    J.estado = 'rescate';
    Sensores.callar();
    decir('¡La señal de auxilio salió! El buque Orión la recibió y envía su helicóptero de rescate.');
  },

  // Dónde se engancha el cable en el helicóptero (coordenadas del mundo)
  gancho() {
    const h = this.heli, a = h.inclinacion;
    return { x: h.x + 16 * Math.cos(a) + 24 * Math.sin(a), y: h.y + 16 * Math.sin(a) - 24 * Math.cos(a) };
  },

  unaVez(nombre, fn) { if (!this.hitos[nombre]) { this.hitos[nombre] = true; fn(); } },

  actualizar(dt) {
    const t = (this.t += dt);
    const p = J.jugador;
    const z = ZONAS[J.zonaIdx];
    const h = this.heli;

    // 1. Alek camina al claro y saluda (0–3 s)
    if (t < 8) {
      const dx = this.esperaX - p.x;
      if (Math.abs(dx) > 4) {
        p.mov = true; p.dir = Math.sign(dx);
        p.x += Math.sign(dx) * Math.min(Math.abs(dx), 200 * dt);
        p.fase += dt * 10;
        p.pose = null;
      } else {
        p.mov = false; p.dir = 1;
        if (t > 1.5) p.pose = 'saludo';
      }
    }

    // 2. El helicóptero llega y se queda flotando (2–6 s)
    if (t >= 2) this.unaVez('rotor', () => { Sonido.iniciarRotor(); });
    if (t >= 2 && t < 11.5) {
      const u = suave((t - 2) / 4);
      h.x = (ANCHO + 280) + (this.esperaX - 16 - (ANCHO + 280)) * u;
      h.y = 70 + (205 - 70) * u + Math.sin(t * 2) * 4;
      h.inclinacion = -0.15 * (1 - u) + Math.sin(t * 1.3) * 0.02;
      Sonido.volumenRotor(0.12 + 0.35 * u);
    }

    // 3. Baja el cable (6–8 s)
    const g = this.gancho();
    const manos = z.suelo - 214;           // altura de las manos con los brazos arriba
    if (t >= 6) this.unaVez('cable', () => decir('Ya bajan el cable. ¡Agárrate fuerte, Alek!'));
    if (t >= 6 && t < 8) this.cable = (manos - g.y) * suave((t - 6) / 2);

    // 4. Alek se agarra y sube (8–11.3 s)
    if (t >= 8) this.unaVez('agarre', () => { p.pose = 'colgado'; p.mov = false; Sonido.recoger(); });
    if (t >= 8.3 && t < 11.3) {
      const u = suave((t - 8.3) / 3);
      this.elevacion = (manos - g.y) * u;
      this.cable = (manos - g.y) * (1 - u);
      p.x += (g.x - p.x) * Math.min(1, dt * 3);
    }

    // 5. Entra al helicóptero y se van (11.3–15 s)
    if (t >= 11.3) this.unaVez('adentro', () => {
      p.oculto = true;
      this.cable = 0;
      Sonido.victoria();
      decir('¡Rescatado! Lo lograste gracias a la ciencia.');
      for (let k = 0; k < 90; k++) {
        this.confeti.push({ x: ANCHO / 2 + (Math.random() - 0.5) * 300, y: 300, vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 300, color: ['#00e5ff', '#e5c384', '#ffffff', '#6fdc8c'][k % 4], vida: 3 });
      }
    });
    if (t >= 11.5) {
      const u = suave((t - 11.5) / 3.5);
      h.x = this.esperaX - 16 - 1700 * u;
      h.y = 205 - 260 * u + Math.sin(t * 2) * 4;
      h.inclinacion = -0.2 * Math.min(1, (t - 11.5) * 2);
      Sonido.volumenRotor(0.47 * (1 - u));
    }

    // BRISA acompaña a Alek y al final entra al helicóptero
    const bx = p.oculto ? g.x : p.x - p.dir * 58;
    const by = p.oculto ? g.y : z.suelo - 205 - this.elevacion + Math.sin(J.t * 2.2) * 7;
    J.brisa.x += (bx - J.brisa.x) * Math.min(1, dt * 3);
    J.brisa.y += (by - J.brisa.y) * Math.min(1, dt * 3);

    this.confeti.forEach(q => { q.vy += 420 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt; });
    this.confeti = this.confeti.filter(q => q.vida > 0);
    J.flotantes = J.flotantes.filter(f => { f.vida -= dt; f.y -= 40 * dt; return f.vida > 0; });

    if (t >= 16) this.terminar();
  },

  // Se dibuja encima del mundo (antes del HUD)
  dibujar(c) {
    const t = this.t;
    const h = this.heli;
    // atardecer que se oscurece
    c.fillStyle = `rgba(10,20,45,${0.32 * suave(t / 3)})`;
    c.fillRect(0, 0, ANCHO, ALTO);
    if (t >= 2) {
      // haz del reflector sobre Alek
      const fx = h.x - 92 * Math.cos(h.inclinacion), fy = h.y + 20;
      c.save();
      c.globalCompositeOperation = 'lighter';
      const gr = c.createLinearGradient(fx, fy, fx, ZONAS[J.zonaIdx].suelo);
      gr.addColorStop(0, 'rgba(255,250,215,0.35)'); gr.addColorStop(1, 'rgba(255,250,215,0.05)');
      c.fillStyle = gr;
      const suelo = ZONAS[J.zonaIdx].suelo;
      c.beginPath(); c.moveTo(fx - 6, fy); c.lineTo(fx + 6, fy); c.lineTo(this.esperaX + 90, suelo); c.lineTo(this.esperaX - 70, suelo); c.closePath(); c.fill();
      c.restore();
    }
    // cable
    if (this.cable > 1 || (this.elevacion > 0 && !J.jugador.oculto)) {
      const g = this.gancho();
      const largo = this.elevacion > 0 ? Math.max(4, this.cable) : this.cable;
      c.strokeStyle = '#d9dde0'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(g.x, g.y); c.lineTo(g.x, g.y + largo); c.stroke();
      c.fillStyle = '#e8572a';
      c.beginPath(); c.arc(g.x, g.y + largo, 5, 0, Math.PI * 2); c.fill();
    }
    dibujarHelicoptero(c, h.x, h.y, J.t, h.inclinacion);
    // confeti y título final
    this.confeti.forEach(q => { c.fillStyle = q.color; c.fillRect(q.x, q.y, 6, 9); });
    if (t >= 12) {
      const a = Math.min(1, (t - 12) / 0.6);
      c.save();
      c.globalAlpha = a;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 84px "Space Grotesk", sans-serif';
      c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.strokeText('¡RESCATADO!', ANCHO / 2, 300);
      c.fillStyle = '#00e5ff'; c.shadowColor = '#00e5ff'; c.shadowBlur = 30;
      c.fillText('¡RESCATADO!', ANCHO / 2, 300);
      c.shadowBlur = 0;
      c.font = '600 26px "Chivo", sans-serif'; c.fillStyle = '#ffffff';
      c.fillText('Alek sobrevivió gracias a la ciencia', ANCHO / 2, 360);
      c.restore();
    }
  },

  terminar() {
    if (!this.activo) return;
    this.activo = false;
    Sonido.detenerRotor();
    J.jugador.oculto = false;
    victoria();
  },

  cancelar() {
    this.activo = false;
    Sonido.detenerRotor();
  }
};
