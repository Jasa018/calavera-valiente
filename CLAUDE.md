# Calavera Valiente — guía para asistentes de IA

Plataformas con RPG (estilo plataformas clásico con mapamundi, mundos y niveles). El protagonista es Osmo, un esqueleto; los enemigos son monstruos y el jefe final es el Rey Diablo. El usuario escribe en español: el texto del juego, los comentarios y los documentos van en español. Es el tercer juego de JASA-OS (`../Jasa018.github.io`).

No copies personajes, niveles, música ni gráficos de juegos existentes: las mecánicas del género sí, el contenido es original.

## Arquitectura

- `src/data/*` es contenido puro: tramos de nivel (`chunks.ts`), mundos con sus niveles y mapa (`worlds.ts`), monstruos, habilidades y objetos. Añade contenido aquí antes de tocar la lógica.
- Un nivel es una lista de tramos (`chunks`). Cada tramo mide 15 filas y su primera y última columna tienen suelo en las filas 13-14 y aire encima, para que cualquier orden funcione. Las letras `a b c f` son monstruos según el `roster` del mundo.
- `src/game/stage.ts` es la simulación de un nivel a 60 f/s (física, combate, IA, jefes). `game/progress.ts` lleva la partida guardada y la subida de nivel; `game/worldmap.ts`, el mapa. Ninguno importa el DOM ni el canvas, porque `scripts/sim.ts` los ejecuta en Node. Avisan a la interfaz con `events` (`GameEvent` en `game/types.ts`).
- `src/gfx/*` dibuja en un lienzo de 480 × 270 con casillas de 18 px. Los sprites son de Kenney (CC0) en `public/assets`, salvo Osmo, el Rey Diablo y los proyectiles (`gfx/art.ts`). El castillo recolorea la hoja de casillas (`gfx/sheets.ts`).
- `src/ui/*` es DOM puro: menús con pila de teclado (`dom.ts`, el manejador va en captura y el juego ignora las teclas ya usadas), entrada del juego (`input.ts`), sonido y música (`audio.ts`) y pantallas (`screens.ts`).
- `src/main.ts` orquesta título → mapa → nivel con `async/await`.

## Reglas

- Usa `stage.solidAt()` para colisiones: la reja `W` de la sala del jefe solo es sólida cuando se cierra (`gateClosed`).
- Los niveles del mundo 1 no deben exigir doble salto (se aprende al nivel 3). Los tramos marcados `hard` lo exigen.
- La vida y el maná se rellenan al entrar en un nivel. Las monedas cogidas solo se suman al terminarlo; la experiencia se gana al momento.
- En los scripts de edición con Node, usa `s.replace(a, () => b)`: un `$` en el texto de reemplazo es un patrón especial.

## Comprobaciones

- `npm run check` y `npm run sim` tras cambiar lógica, tramos, mundos o balance. `sim` mide el salto real, comprueba que cada nivel se puede terminar (búsqueda por casillas con el alcance del salto), resume el balance por mundo y juega cada nivel y cada jefe con un piloto automático.
- En desarrollo, `window.__play('2-3')` entra en un nivel, `window.__stage` es el nivel en curso y `window.__save()` la partida.
