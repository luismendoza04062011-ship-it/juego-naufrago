// =====================================================================
//  cinematic.js → Cinemáticas narradas por BRISA
//  Usa las ilustraciones de Google Stitch con efecto Ken Burns
//  (zoom y desplazamiento lento) + subtítulos + voz sintetizada.
// =====================================================================

const Cinematica = {
  escenas: [],
  i: -1,
  capa: 0,
  token: 0,
  timers: [],
  alTerminar: null,
  activa: false,

  reproducir(escenas, alTerminar) {
    this.escenas = escenas;
    this.i = -1;
    this.alTerminar = alTerminar;
    this.activa = true;
    mostrarPantalla('pantalla-cine');
    this.siguiente();
  },

  limpiarTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  },

  siguiente() {
    this.limpiarTimers();
    this.i++;
    if (this.i >= this.escenas.length) return this.fin();
    const escena = this.escenas[this.i];
    const capas = [document.getElementById('cine-a'), document.getElementById('cine-b')];
    const nueva = capas[this.capa];
    const vieja = capas[1 - this.capa];
    this.capa = 1 - this.capa;

    nueva.style.backgroundImage = `url(${escena.img})`;
    nueva.style.filter = escena.filtro || '';
    nueva.classList.remove('kb1', 'kb2');
    void nueva.offsetWidth; // reinicia la animación CSS
    nueva.classList.add(this.i % 2 ? 'kb2' : 'kb1');
    nueva.style.opacity = 1;
    vieja.style.opacity = 0;

    const sub = document.getElementById('cine-texto');
    sub.textContent = escena.texto;
    sub.classList.remove('visible');
    void sub.offsetWidth;
    sub.classList.add('visible');

    const id = ++this.token;
    const minimo = escena.duracion || 4500;
    const t0 = performance.now();
    Sensores.hablar(escena.texto, {
      alTerminar: () => {
        if (id !== this.token) return;
        const resta = Math.max(700, minimo - (performance.now() - t0));
        this.timers.push(setTimeout(() => { if (id === this.token) this.siguiente(); }, resta));
      }
    });
    // Seguro: si la voz no termina (o no existe), avanzamos igual
    this.timers.push(setTimeout(() => { if (id === this.token) this.siguiente(); }, Math.max(minimo, escena.texto.length * 85 + 3000)));
  },

  saltar() {
    if (!this.activa) return;
    this.fin();
  },

  fin() {
    this.limpiarTimers();
    this.token++;
    this.activa = false;
    Sensores.callar();
    const cb = this.alTerminar;
    this.alTerminar = null;
    if (cb) cb();
  }
};
