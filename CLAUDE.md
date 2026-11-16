# Calavera Valiente — guía para asistentes de IA

Plataformas con RPG (estilo plataformas clásico con mapamundi, mundos y niveles). El protagonista es Osmo, un esqueleto; los enemigos son monstruos y el jefe final es el Rey Diablo. El usuario escribe en español: el texto del juego, los comentarios y los documentos van en español. Es el tercer juego de JASA-OS (`../Jasa018.github.io`).

No copies personajes, niveles, música ni gráficos de juegos existentes: las mecánicas del género sí, el contenido es original.

## Diseño (pedido por el usuario)

- 8 mundos × 8 niveles. El nivel 4 es una fortaleza con jefe intermedio; el 8, el castillo del jefe del mundo. Cada mundo tiene además un nivel secreto (S) y una sala de monedas (B).
- Mapa no lineal: se elige camino. Las salidas secretas de los niveles 3 y 6 abren caminos ocultos (nivel secreto → cofre; sala de monedas → atajo al castillo).
- Cada nivel debe sentirse distinto: tipos de nivel (agua, torre, cueva, castillo, bosque, nieve, cielo sin suelo, vagoneta…) y mecanismos (llave y cerradura, palancas, muros agrietados, muros falsos, puertas a salas).
- Monstruos de varios tamaños y hechizos elementales con debilidades y resistencias.

## Arquitectura

- `src/data/*` es contenido puro. Añade contenido aquí antes de tocar la lógica.
  - `chunks.ts`: tramos (leyenda de casillas arriba del archivo) y `POOLS` por tipo de nivel. Los tramos horizontales miden 15 filas, con suelo en las filas 13-14 de la primera y última columna y aire en las filas 9-12. Los de torre miden 26 de ancho y se apilan de abajo arriba. Las salas (`sala_*`) van detrás de las puertas `D`.
  - `worlds.ts`: niveles (tipo, ambiente, longitud, mecanismos, salida secreta, oscuridad, viento, lava…) y el mapa, generado a partir de una plantilla que se voltea según el mundo. Los caminos tienen `by` (nivel que los abre) y `secret`.
  - `monsters.ts`: las estadísticas son multiplicadores sobre un monstruo normal de la dificultad del nivel (`game/formulas.ts`), así un monstruo sirve en cualquier mundo. Los jefes se definen por su lista de ataques (`BossDef`).
  - `skills.ts`: elementos, hechizos y habilidades. `items.ts`: objetos y tesoros.
- `src/game/level.ts` elige los tramos de cada nivel con una semilla fija por id (`chunkList`) y monta la cuadrícula, las salas y las puertas.
- `src/game/stage.ts` es la simulación a 60 f/s (física con agua, hielo, viento y vagoneta, mecanismos, combate con elementos, IA y jefes). `game/progress.ts` lleva la partida (v2) y `game/worldmap.ts` el mapa. Ninguno importa el DOM ni el canvas, porque `scripts/sim.ts` los ejecuta en Node. Avisan a la interfaz con `events` (`GameEvent` en `game/types.ts`).
- `src/gfx/*` dibuja en un lienzo de 480 × 270 con casillas de 18 px. La cámara se mueve en los dos ejes y se limita a la zona (`stage.region`) en la que está Osmo. Sprites de Kenney (CC0) en `public/assets`; arte propio en `gfx/art.ts` y `gfx/monsters.ts`. `gfx/sheets.ts` recolorea las casillas por ambiente y tinta sprites (`tint` en `SpriteRef`).
- `src/ui/*` es DOM puro: menús con pila de teclado (`dom.ts`), entrada (`input.ts`), sonido y música (`audio.ts`) y pantallas (`screens.ts`).
- `src/main.ts` orquesta título → mapa → nivel con `async/await`.

## Reglas

- Usa `stage.solidAt()` para colisiones: la reja `W`, los bloques `E`/`F` (según la palanca) y las cerraduras dependen del estado del nivel.
- Los niveles del mundo 1 (menos el secreto) no deben exigir doble salto (se aprende al nivel 3). Los tramos marcados `hard` lo exigen y solo salen a partir del mundo 2.
- Los tramos de vagoneta no pueden tener paredes: la vagoneta no frena y chocar hace daño.
- La vida y el maná se rellenan al entrar en un nivel. Las monedas cogidas solo se suman al terminarlo; la experiencia se gana al momento.

## Comprobaciones

- `npm run check` y `npm run sim` tras cambiar lógica, tramos, mundos o balance (`npm run sim -- --rapido` para ir más deprisa). `sim` comprueba el contrato de los tramos y busca por casillas que se llegue a la salida (y a la salida secreta) con el alcance real del salto, teniendo en cuenta llaves, palancas, puertas y nado. También resume el balance por mundo, prueba los mecanismos en un nivel de prueba y juega cada nivel y cada jefe con un piloto automático.
- Si un nivel no se puede terminar, el error lista sus tramos; `npx tsx scripts/_tramo.ts <nivel> <tramo>` imprime la cuadrícula montada de ese tramo.
- En desarrollo, `window.__play('2-3')` entra en un nivel, `window.__stage` es el nivel en curso y `window.__save()` la partida.
