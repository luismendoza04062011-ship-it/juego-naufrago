// =====================================================================
//  audio.js → Efectos de sonido generados con la Web Audio API
//  (no se usa ningún archivo de audio: todo se sintetiza en vivo)
// =====================================================================

const Sonido = {
  ctx: null,
  maestro: null,
  bufferRuido: null,
  silenciado: false,

  // El AudioContext solo puede crearse después de un clic del usuario
  contexto() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = 0.55;
      this.maestro.connect(this.ctx.destination);
      // Un segundo de ruido blanco reutilizable (fuego, chispas, pasos)
      this.bufferRuido = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const datos = this.bufferRuido.getChannelData(0);
      for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // Oscilador con envolvente: frecuencia (Hz), duración (s), forma de onda, volumen
  tono(frec, dur, tipo = 'sine', vol = 0.3, frecFinal = null, retraso = 0) {
    const ctx = this.ctx;
    if (!ctx || this.silenciado) return;
    const t0 = ctx.currentTime + retraso;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frec, t0);
    if (frecFinal) osc.frequency.exponentialRampToValueAtTime(frecFinal, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(this.maestro);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  // Ruido filtrado: crepitar, viento, chispas
  ruido(dur, vol, frecFiltro = 1000, tipoFiltro = 'bandpass', retraso = 0) {
    const ctx = this.ctx;
    if (!ctx || this.silenciado) return;
    const t0 = ctx.currentTime + retraso;
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.bufferRuido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipoFiltro;
    filtro.frequency.value = frecFiltro;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    fuente.connect(filtro).connect(env).connect(this.maestro);
    fuente.start(t0, Math.random() * 0.5);
    fuente.stop(t0 + dur + 0.05);
  },

  click()    { this.tono(720, 0.05, 'square', 0.06); },
  recoger()  { this.tono(520, 0.09, 'triangle', 0.25, 880); this.tono(880, 0.14, 'triangle', 0.2, 1320, 0.08); },
  escaneo()  { this.tono(260, 0.7, 'sawtooth', 0.05, 1500); this.tono(1500, 0.08, 'sine', 0.15, null, 0.7); },
  error()    { this.tono(240, 0.16, 'square', 0.1, 160); this.tono(180, 0.2, 'square', 0.08, 120, 0.12); },
  alerta()   { this.tono(880, 0.12, 'square', 0.09); this.tono(660, 0.14, 'square', 0.09, null, 0.16); },
  paso()     { this.ruido(0.06, 0.05, 420, 'lowpass'); },
  chispa()   { this.ruido(0.08, 0.6, 5200, 'highpass'); this.tono(2600, 0.05, 'square', 0.04, 3600); },
  crepitar() { this.ruido(0.03 + Math.random() * 0.04, 0.12 + Math.random() * 0.2, 1800 + Math.random() * 2500, 'bandpass'); },
  viento(v)  { this.ruido(0.25, 0.05 + v * 0.12, 500 + v * 600, 'bandpass'); },
  zumbido()  { this.tono(110, 0.9, 'sawtooth', 0.07, 220); },
  morse(dur) { this.tono(760, dur, 'sine', 0.22); },
  puntos()   { this.tono(990, 0.07, 'square', 0.05); this.tono(1320, 0.1, 'square', 0.05, null, 0.06); },
  logro()    { [523, 659, 784, 1047].forEach((f, i) => this.tono(f, 0.22, 'triangle', 0.22, null, i * 0.09)); },
  victoria() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tono(f, 0.4, 'triangle', 0.2, null, i * 0.12)); },
  derrota()  { [392, 349, 311, 262].forEach((f, i) => this.tono(f, 0.45, 'triangle', 0.2, null, i * 0.32)); },

  // Rotor del helicóptero: ruido grave que se "corta" 13 veces por segundo (tap-tap-tap)
  rotor: null,
  iniciarRotor() {
    const ctx = this.ctx;
    if (!ctx || this.rotor) return;
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.bufferRuido;
    fuente.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 380;
    const pulso = ctx.createGain();
    pulso.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lfoGanancia = ctx.createGain();
    lfoGanancia.gain.value = 0.5;
    lfo.connect(lfoGanancia).connect(pulso.gain);
    const volumen = ctx.createGain();
    volumen.gain.value = 0;
    fuente.connect(filtro).connect(pulso).connect(volumen).connect(this.maestro);
    fuente.start();
    lfo.start();
    this.rotor = { fuente, lfo, volumen };
  },
  volumenRotor(v) {
    if (this.rotor && !this.silenciado) this.rotor.volumen.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  },
  detenerRotor() {
    if (!this.rotor) return;
    const r = this.rotor;
    this.rotor = null;
    r.volumen.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    setTimeout(() => { try { r.fuente.stop(); r.lfo.stop(); } catch (e) { /* ya estaba detenido */ } }, 500);
  }
};
