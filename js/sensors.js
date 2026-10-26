// =====================================================================
//  sensors.js → EL EFECTO WOW
//   1. Micrófono (getUserMedia + AnalyserNode): detecta SOPLIDOS y GRITOS
//   2. Comandos de voz (Web Speech API · SpeechRecognition)
//   3. Voz de BRISA (Web Speech API · speechSynthesis)
//  Todo está protegido con try/catch: si el navegador no lo soporta o el
//  usuario niega el permiso, el juego sigue funcionando con el teclado.
// =====================================================================

// Quita tildes y signos para comparar frases ("¿Qué es?" → "que es")
function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Frases que entiende el juego (las más largas primero)
const COMANDOS_VOZ = [
  { cmd: 'beber', frases: ['tomar agua', 'agua de coco', 'beber', 'bebe', 'bebo'] },
  { cmd: 'comer', frases: ['comer', 'come', 'guayaba'] },
  { cmd: 'repetir', frases: ['que es', 'analizar', 'analiza', 'explica', 'repite', 'repetir', 'otra vez'] },
  { cmd: 'cerrar', frases: ['listo', 'lista', 'cerrar', 'cierra', 'siguiente', 'continuar', 'vale', 'okay'] },
  { cmd: 'chispa', frases: ['chispa', 'golpe', 'golpear', 'golpea'] },
  { cmd: 'auxilio', frases: ['auxilio', 'sos', 's o s', 'ayuda', 'socorro', 'mayday'] },
  { cmd: 'accion', frases: ['recoger', 'recoge', 'recojo', 'agarrar', 'agarra', 'coger', 'coge', 'tomar', 'toma', 'usar', 'usa', 'construir', 'encender', 'enciende', 'reparar', 'repara'] },
  { cmd: 'pausa', frases: ['pausa', 'pausar'] }
];

const Sensores = {
  mic: { activo: false, nivel: 0, ruido: 0.012, analizador: null, datos: null, error: '' },
  voz: {
    soportado: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    activa: false, rec: null, ultimo: '', ultimoEn: 0, error: '',
    disparados: new Set(), enfriamiento: {}
  },
  tts: { soportado: 'speechSynthesis' in window, voz: null, hablando: false, texto: '', finEn: 0, token: 0, intento: 0, vozFalla: false, vivas: [] },
  alComando: null, // el juego asigna aquí qué hacer con cada comando

  // ------------------------------------------------------------ MICRÓFONO
  async activarMicrofono() {
    if (this.mic.activo) return true;
    try {
      const ctx = Sonido.contexto();
      if (!ctx || !navigator.mediaDevices) throw new Error('Este navegador no permite usar el micrófono.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const fuente = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      fuente.connect(an); // NO se conecta a los parlantes (evita el eco)
      this.mic.analizador = an;
      this.mic.datos = new Float32Array(an.fftSize);
      this.mic.activo = true;
      this.mic.error = '';
      return true;
    } catch (e) {
      this.mic.error = e && e.name === 'NotAllowedError' ? 'Permiso negado. Puedes usar ESPACIO.' : 'Micrófono no disponible. Puedes usar ESPACIO.';
      return false;
    }
  },

  // Volumen RMS (raíz cuadrática media) suavizado; se llama en cada fotograma
  actualizar(dt) {
    const m = this.mic;
    if (!m.activo) return;
    m.analizador.getFloatTimeDomainData(m.datos);
    let suma = 0;
    for (let i = 0; i < m.datos.length; i++) suma += m.datos[i] * m.datos[i];
    const rms = Math.sqrt(suma / m.datos.length);
    m.nivel += (rms - m.nivel) * Math.min(1, dt * 14);
  },

  // Intensidad de 0 a 1 por encima del ruido del ambiente
  intensidad() {
    if (!this.mic.activo) return 0;
    return Math.max(0, Math.min(1, (this.mic.nivel - this.mic.ruido * 1.6 - 0.008) / 0.14));
  },
  soplando() { return this.intensidad() > 0.18; },
  gritando() { return this.intensidad() > 0.62; },

  // Mide 1,5 s de "silencio" para saber cuánto ruido hay en el stand
  calibrar() {
    return new Promise(resolve => {
      if (!this.mic.activo) return resolve(false);
      const muestras = [];
      const t0 = performance.now();
      const medir = () => {
        muestras.push(this.mic.nivel);
        if (performance.now() - t0 < 1500) requestAnimationFrame(medir);
        else {
          this.mic.ruido = Math.max(0.004, muestras.reduce((a, b) => a + b, 0) / muestras.length);
          resolve(true);
        }
      };
      medir();
    });
  },

  // ------------------------------------------------------ COMANDOS DE VOZ
  iniciarVoz() {
    if (!this.voz.soportado) { this.voz.error = 'No disponible en este navegador (usa Google Chrome).'; return false; }
    if (this.voz.activa) return true;
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'es-CO';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = () => this.voz.disparados.clear();
      rec.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          this.procesarFrase(ev.results[i][0].transcript, i, ev.results[i].isFinal);
        }
      };
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          this.voz.activa = false;
          this.voz.error = 'Permiso de voz negado.';
        } else if (ev.error === 'network') {
          this.voz.error = 'Sin internet: la voz necesita conexión.';
        }
      };
      // Chrome detiene el reconocimiento cada cierto tiempo: lo reiniciamos
      rec.onend = () => {
        if (this.voz.activa) setTimeout(() => { try { rec.start(); } catch (e) { /* ya estaba iniciado */ } }, 300);
      };
      rec.start();
      this.voz.rec = rec;
      this.voz.activa = true;
      this.voz.error = '';
      return true;
    } catch (e) {
      this.voz.error = 'No se pudo iniciar el reconocimiento de voz.';
      return false;
    }
  },

  procesarFrase(transcripcion, indice, esFinal) {
    const texto = normalizar(transcripcion);
    if (!texto) return;
    this.voz.ultimo = transcripcion.trim();
    this.voz.ultimoEn = performance.now();
    for (const grupo of COMANDOS_VOZ) {
      for (const frase of grupo.frases) {
        if (!new RegExp(`(^| )${frase}( |$)`).test(texto)) continue;
        if (this.esEco(frase)) continue;
        const clave = `${indice}:${grupo.cmd}`;
        const ahora = performance.now();
        if (this.voz.disparados.has(clave) || ahora - (this.voz.enfriamiento[grupo.cmd] || 0) < 900) return;
        this.voz.disparados.add(clave);
        this.voz.enfriamiento[grupo.cmd] = ahora;
        if (this.alComando) this.alComando(grupo.cmd);
        return;
      }
    }
  },

  // Si BRISA acaba de decir esa palabra por los parlantes, no es el jugador
  esEco(frase) {
    const reciente = this.tts.hablando || performance.now() - this.tts.finEn < 2000;
    return reciente && normalizar(this.tts.texto).includes(frase);
  },

  // --------------------------------------------------------- VOZ DE BRISA
  elegirVoz() {
    if (!this.tts.soportado) return;
    const voces = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('es'));
    if (!voces.length) return;
    const puntaje = (v) => {
      const l = v.lang.toLowerCase();
      let p = 0;
      if (l === 'es-co') p += 50; else if (l === 'es-mx') p += 40; else if (l === 'es-us') p += 35; else if (l === 'es-419') p += 30; else if (l === 'es-es') p += 20;
      if (/natural|online/i.test(v.name)) p += 25;
      if (/google/i.test(v.name)) p += 15;
      if (/salome|dalia|paloma|helena|sabina|elvira|ximena|camila/i.test(v.name)) p += 8; // voces femeninas para BRISA
      return p;
    };
    this.tts.voz = voces.sort((a, b) => puntaje(b) - puntaje(a))[0];
  },

  prepararVoces() {
    if (!this.tts.soportado) return;
    this.elegirVoz();
    speechSynthesis.onvoiceschanged = () => this.elegirVoz();
  },

  // Voz instalada en el computador (no depende de internet): respaldo si la voz en línea falla
  vozLocal() {
    if (!this.tts.soportado) return null;
    const locales = speechSynthesis.getVoices().filter(v => v.localService && v.lang && v.lang.toLowerCase().startsWith('es'));
    return locales.find(v => /-(co|mx|us|419)$/i.test(v.lang)) || locales[0] || null;
  },

  // Lee el texto en voz alta. Se divide en frases porque Chrome corta los textos largos.
  // opciones: alEmpezar(), alTerminar(), alPalabra(indiceCaracter)
  hablar(texto, opciones = {}) {
    const token = ++this.tts.token;
    if (!this.tts.soportado || !texto) { if (opciones.alTerminar) setTimeout(opciones.alTerminar, 0); return; }
    try {
      speechSynthesis.cancel();
      this.tts.texto = texto;
      this.tts.hablando = true;
      // cada frase con la posición donde empieza (para iluminar las palabras)
      const frases = [];
      let desplazamiento = 0;
      (texto.match(/[^.!?:]+[.!?:]*/g) || [texto]).forEach(frase => {
        const inicio = texto.indexOf(frase, desplazamiento);
        desplazamiento = inicio + frase.length;
        if (frase.trim()) frases.push({ frase: frase.trim(), inicio });
      });
      // Chrome a veces descarta lo que se pide justo después de cancel(): esperamos un instante
      setTimeout(() => this.decirFrases(frases, 0, token, opciones, this.tts.vozFalla), 90);
    } catch (e) {
      this.tts.hablando = false;
      if (opciones.alTerminar) opciones.alTerminar();
    }
  },

  decirFrases(frases, desde, token, opciones, usarLocal) {
    if (token !== this.tts.token) return;
    const intento = ++this.tts.intento;
    const voz = usarLocal ? (this.vozLocal() || this.tts.voz) : this.tts.voz;
    const vigente = () => token === this.tts.token && intento === this.tts.intento;
    let empezo = false;
    const fin = () => {
      if (!vigente()) return;
      this.tts.hablando = false;
      this.tts.finEn = performance.now();
      if (opciones.alTerminar) opciones.alTerminar();
    };
    // Si la voz en línea falla, se repite desde esa frase con una voz instalada
    const reintentar = (i) => {
      if (!vigente()) return;
      if (!usarLocal && this.vozLocal()) {
        this.tts.vozFalla = true;
        speechSynthesis.cancel();
        setTimeout(() => this.decirFrases(frases, i, token, opciones, true), 90);
      } else fin();
    };
    this.tts.vivas = []; // referencias para que el navegador no borre las frases a mitad de camino
    try { speechSynthesis.resume(); } catch (e) { /* nada */ }
    frases.slice(desde).forEach(({ frase, inicio }, k) => {
      const i = desde + k;
      const u = new SpeechSynthesisUtterance(frase);
      u.lang = voz ? voz.lang : 'es-CO';
      if (voz) u.voice = voz;
      u.rate = 1.04;
      u.pitch = 1.05;
      u.onstart = () => {
        if (!vigente()) return;
        if (!empezo && opciones.alEmpezar) opciones.alEmpezar(inicio);
        empezo = true;
      };
      u.onboundary = (ev) => { if (vigente() && opciones.alPalabra) opciones.alPalabra(inicio + (ev.charIndex || 0)); };
      u.onerror = (ev) => {
        if (!vigente() || ev.error === 'interrupted' || ev.error === 'canceled') return;
        reintentar(i);
      };
      if (i === frases.length - 1) u.onend = fin;
      this.tts.vivas.push(u);
      speechSynthesis.speak(u);
    });
    // Vigilante: si en 2 s la voz no arrancó, se reintenta con la voz local
    setTimeout(() => { if (vigente() && !empezo && !speechSynthesis.speaking) reintentar(desde); }, 2000);
  },

  callar() {
    this.tts.token++;
    if (this.tts.hablando) this.tts.finEn = performance.now();
    this.tts.hablando = false;
    if (this.tts.soportado) speechSynthesis.cancel();
  }
};
