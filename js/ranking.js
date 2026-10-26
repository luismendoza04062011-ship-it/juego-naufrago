// =====================================================================
//  ranking.js → Salón de la Fama en la nube (Firebase Firestore)
//  Colección: 'records_feria'. Top 5 en tiempo real con onSnapshot.
//  Si Firebase falla (sin internet o reglas cerradas) se usa un ranking
//  local guardado en este computador, para que el stand nunca se quede sin tabla.
// =====================================================================

const Ranking = {
  db: null,
  nube: null,         // null = conectando, true = en vivo, false = modo local
  top: [],
  oyentes: [],

  iniciar() {
    try {
      if (!window.firebase) throw new Error('Firebase no cargó');
      if (!firebase.apps.length) firebase.initializeApp(CONFIG.firebase);
      this.db = firebase.firestore();
      this.db.collection(CONFIG.coleccionRanking)
        .orderBy('puntaje', 'desc')
        .limit(5)
        .onSnapshot(
          (snap) => {
            this.nube = true;
            this.top = snap.docs.map(d => d.data());
            this.avisar();
          },
          () => this.usarLocal()
        );
    } catch (e) {
      this.usarLocal();
    }
  },

  usarLocal() {
    this.nube = false;
    this.top = this.leerLocal().slice(0, 5);
    this.avisar();
  },

  alCambiar(fn) { this.oyentes.push(fn); fn(this.top, this.nube); },
  avisar() { this.oyentes.forEach(fn => fn(this.top, this.nube)); },

  // Nombre seguro: sin etiquetas HTML, máximo 12 caracteres
  limpiarNombre(nombre) {
    const limpio = String(nombre || '').replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
    return limpio || 'Anónimo';
  },

  async guardar(registro) {
    const r = { ...registro, nombre: this.limpiarNombre(registro.nombre), puntaje: Math.max(0, Math.floor(registro.puntaje)) };
    this.guardarLocal(r);
    if (this.db) {
      try {
        await this.db.collection(CONFIG.coleccionRanking).add({ ...r, fecha: firebase.firestore.FieldValue.serverTimestamp() });
        return 'nube';
      } catch (e) { /* reglas cerradas o sin internet: queda guardado local */ }
    }
    if (!this.nube) this.usarLocal();
    return 'local';
  },

  leerLocal() {
    try {
      const lista = JSON.parse(localStorage.getItem('naufrago_records') || '[]');
      return Array.isArray(lista) ? lista.sort((a, b) => b.puntaje - a.puntaje) : [];
    } catch (e) { return []; }
  },

  guardarLocal(r) {
    try {
      const lista = this.leerLocal();
      lista.push(r);
      lista.sort((a, b) => b.puntaje - a.puntaje);
      localStorage.setItem('naufrago_records', JSON.stringify(lista.slice(0, 50)));
    } catch (e) { /* navegador sin almacenamiento */ }
  }
};
