# Calavera Valiente

Plataformas con RPG en 8 bits. Osmo, un esqueleto con bufanda roja, cruza ocho mundos por un mapamundi con caminos que se bifurcan, sube de nivel, aprende hechizos elementales y se enfrenta al Rey Diablo.

## Cómo jugar

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev      # abre http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run check` | Solo comprueba tipos |
| `npm run sim` | Comprueba datos, que todos los niveles (y sus salidas secretas) se pueden terminar, el balance, los mecanismos y que cada jefe se puede vencer. `npm run sim -- --rapido` es más corto |
| `npm run deploy` | Publica `dist/` en GitHub Pages (rama `gh-pages`) |

### Controles

| Tecla | Acción |
|---|---|
| Flechas o A/D | Moverse |
| Z, Espacio o ↑ | Saltar (mantén para saltar más alto). Bajo el agua: una brazada |
| ↑ delante de una puerta | Entrar |
| ↓ + saltar sobre un tablón | Bajar a través de él |
| X o J | Golpe de fémur: rompe ladrillos, agrieta muros y mueve palancas |
| C o K | Lanzar el hechizo elegido |
| Q / E | Cambiar de hechizo |
| Mayús o L | Embestida ósea (nivel 6): atraviesa monstruos y rompe muros |
| En el aire, ↓ + saltar | Pisotón sísmico (nivel 9) |
| V | Rearmarse: cura el 35% (nivel 13) |
| B | Lluvia de calaveras (nivel 23) |
| 1 / 2 | Poción / éter |
| Esc o Enter | Pausa |

Con mando: A saltar, X golpe, Y hechizo, B embestida, LB/RB cambiar de hechizo.

## Qué incluye

- **8 mundos con 8 niveles cada uno**: Praderas del Osario, Bosque Sombrío, Desierto de Ceniza, Mar Hundido, Cumbres Heladas, Cavernas de Magma, Torre de las Nubes y la Fortaleza del Rey Diablo. El nivel 4 de cada mundo es una fortaleza con un jefe intermedio y el 8, el castillo del jefe del mundo.
- **Mapamundi con ramas**: se elige camino. Las salidas secretas abren caminos ocultos hacia un nivel secreto con un cofre del tesoro, una sala de monedas y un atajo al castillo.
- **Tipos de nivel**, cada uno con lo suyo:
  - llanura y bosque (copas de árboles, setas que hacen de resorte);
  - desierto (tormentas de arena que empujan);
  - agua (se nada; peces, medusas y peces globo);
  - nieve (suelo resbaladizo);
  - cuevas (algunas a oscuras, con antorchas y estalactitas que caen);
  - cielo sin suelo (nubes y tablones que se derrumban);
  - torres que se suben en vertical (algunas con lava que sube);
  - vagonetas que no frenan;
  - castillos con barras de fuego, cañones y bloques que aplastan.
- **Obstáculos y secretos**:
  - llaves que abren cerraduras;
  - palancas que cambian los bloques rojos y azules;
  - muros agrietados que se rompen a golpes;
  - muros falsos;
  - bloques invisibles;
  - puertas a salas de monedas.
- **Monstruos de tres tamaños** (pequeños, medianos y grandes) y 16 jefes, cada uno con su repertorio de ataques y una segunda fase.
- **Elementos**: hueso, fuego, hielo (congela a los monstruos y puedes subirte encima), rayo, tierra y luz. Cada monstruo es débil, resistente o inmune a algunos; el bestiario del menú lo dice.
- **RPG**: experiencia, niveles hasta el 40, 14 habilidades, armas y armaduras en las tiendas, tesoros con elemento en los cofres secretos, pociones y éteres.
- Si te quedas sin vida, conservas la experiencia y puedes seguir desde el punto de control. La partida se guarda sola.

## Créditos

- Casillas, monedas, algunos monstruos e iconos: [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) y [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) de Kenney, licencia CC0 (ver `public/assets/LICENSE-*.txt`).
- Osmo, el Rey Diablo, el resto de monstruos y jefes, proyectiles e iconos del mapa: arte propio en `src/gfx/art.ts` y `src/gfx/monsters.ts`.
- Música: temas de Juhani Junkala (SubspaceAudio), licencia CC0, de [5 Chiptunes (Action)](https://opengameart.org/content/5-chiptunes-action) y [4 Chiptunes (Adventure)](https://opengameart.org/content/4-chiptunes-adventure) en OpenGameArt (ver `public/music/CREDITOS.txt`). Si un tema no carga, suena una versión sintetizada.
- Sonidos: sintetizados con WebAudio en `src/ui/audio.ts`.
