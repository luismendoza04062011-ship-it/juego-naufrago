# NÁUFRAGO · La Ciencia de Sobrevivir

Videojuego educativo (*serious game*) para la **Feria de la Ciencia y la Tecnología 2026**.
**Autor:** Luis Alejandro Mendoza Camacho · Grado 10-01 · Colegio Carlos Vicente Rey

🎮 **Jugar:** https://luismendoza04062011-ship-it.github.io/juego-naufrago/
🖨️ **Afiche con QR:** https://luismendoza04062011-ship-it.github.io/juego-naufrago/qr.html

## La historia
Alek naufraga con el buque de investigación AURORA en una isla del Pacífico. Lo acompaña **BRISA**, una IA que escanea cada objeto que él recoge, le muestra **de qué átomos está hecho** y se lo explica **en voz alta**. Para ser rescatado debe cruzar la isla (playa → selva → campamento → cumbre), superar 3 retos científicos y encender la baliza S.O.S. antes de que su hidratación o su energía lleguen a 0.

## Efecto WOW (sensores del navegador, sin comprar nada)
| Sensor | Para qué se usa | API |
|---|---|---|
| 🎤 Micrófono | **Soplar** para darle oxígeno al fuego y **gritar «auxilio»** para enviar el S.O.S. | `getUserMedia` + `AnalyserNode` (Web Audio) |
| 🗣️ Voz | Comandos: «recoger», «¿qué es?», «listo», «beber», «comer», «chispa», «auxilio» | Web Speech API · `SpeechRecognition` |
| 🔊 BRISA | Lee cada explicación en voz alta con subtítulos | Web Speech API · `speechSynthesis` |
| ☀️ Clima real | La **radiación solar real** del colegio define cuánta agua produce el destilador; si llueve en el colegio, llueve en la isla | API Open-Meteo |
| ☁️ Ranking | Top 5 de la feria en tiempo real | Firebase Firestore (`records_feria`) |

## Qué enseña
| Reto / objeto | Ciencia |
|---|---|
| 💧 Destilador solar | Cambios de fase: evaporación y condensación. Q = m·Lᵥ. La sal no se evapora. |
| 🔥 Triángulo del fuego | Combustión: combustible + oxígeno + calor. Energía de activación. |
| 📡 Circuito de la baliza | Ley de Ohm (V = I·R → 12 V / 6 Ω = 2 A), polaridad del LED, cortocircuito. |
| ⚛️ Escáner atómico (13 objetos) | Moléculas en 3D (celulosa, SiO₂, PET, H₂O + NaCl, vitamina C, H₂SO₄, GaN, Fe₃O₄, red metálica del cobre) y modelo de Bohr de cada elemento (protones y capas de electrones). |

## Controles
`←` `→` mover · `E` recoger / usar · `1` beber coco · `2` comer guayaba · `ESPACIO` soplar (si no hay micrófono) · `ESC` pausa · `F` pantalla completa.
En el escáner: `A` ver átomo por átomo · `M` ver molécula · `R` repetir.
En celular aparecen botones táctiles (girar a horizontal).

## Cómo correrlo en el computador
El micrófono y la voz necesitan `https` o `localhost` (no funcionan con doble clic en el archivo):
- **VS Code:** extensión *Live Server* → clic derecho en `index.html` → *Open with Live Server*.
- **O en terminal:** `python -m http.server 8000` dentro de esta carpeta y abrir http://localhost:8000
- Usar **Google Chrome** (Edge también sirve). Firefox no tiene reconocimiento de voz: el juego funciona igual con teclado.

## Firebase (ranking en la nube)
El juego usa el proyecto `bogotaai` (el mismo de CiberRun). Si las reglas de Firestore están cerradas, el juego **no se rompe**: guarda los récords en este computador y muestra "Ranking local".
Para activar la nube: Firebase Console → Firestore Database → **Reglas** → pegar el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.

## Estructura
```
index.html        pantallas (menú, cinemática, sensores, juego, final)
css/style.css     diseño "Scientific Survival HUD" (hecho en Google Stitch)
js/data.js        TODO el contenido científico: objetos, átomos, moléculas, zonas, textos de BRISA
js/game.js        motor Canvas 2D (60 FPS), personaje, zonas, HUD, inventario, supervivencia
js/minigames.js   los 3 retos científicos
js/molecule.js    visor 3D de moléculas y modelo de Bohr
js/sensors.js     micrófono, comandos de voz y voz de BRISA
js/audio.js       efectos de sonido sintetizados (Web Audio, sin archivos)
js/ranking.js     Firebase Firestore + respaldo local
js/cinematic.js   cinemáticas narradas (ilustraciones de Stitch + efecto Ken Burns)
assets/img/       ilustraciones exportadas de Google Stitch
qr.html           afiche imprimible con el código QR
```

## Pitch de 30 segundos
> "Diseñamos **Náufrago: La Ciencia de Sobrevivir**, un simulador donde sobrevives en una isla usando química, física y biología. Cada objeto que recoges, la IA BRISA lo escanea, te muestra sus átomos y te lo explica en voz alta. Para prender el fuego tienes que **soplar de verdad** al micrófono, el destilador usa la **radiación solar real** del colegio, y para ser rescatado armas un circuito y **gritas auxilio**. Está programado en JavaScript con Canvas, usa sensores de audio y voz, y guarda el ranking en la nube con Firebase."
