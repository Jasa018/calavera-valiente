# Calavera Valiente

Plataformas con RPG en 8 bits. Osmo, un esqueleto con bufanda roja, cruza cuatro mundos por un mapamundi, sube de nivel, aprende habilidades y se enfrenta al Rey Diablo.

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
| `npm run sim` | Comprueba datos, que todos los niveles se pueden terminar, el balance y que cada jefe se puede vencer |
| `npm run deploy` | Publica `dist/` en GitHub Pages (rama `gh-pages`) |

### Controles

| Tecla | Acción |
|---|---|
| Flechas o A/D | Moverse |
| Z, Espacio o ↑ | Saltar (mantén para saltar más alto) |
| ↓ + saltar sobre un tablón | Bajar a través de él |
| X o J | Golpe de fémur (también rompe ladrillos) |
| C o K | Hueso arrojadizo (nivel 4, 2 PM) |
| Mayús o L | Embestida ósea (nivel 6, 3 PM) |
| En el aire, ↓ + saltar | Pisotón sísmico (nivel 8) |
| V | Rearmarse: cura el 35% (nivel 10, 6 PM) |
| B | Lluvia de calaveras (nivel 13, 12 PM) |
| 1 / 2 | Poción / éter |
| Esc o Enter | Pausa |

En el mapa: flechas para moverte por los caminos, Enter para entrar, Esc para el menú (estado, habilidades, equipo, objetos y opciones). Funciona también con mando.

## Qué incluye

- **Mapamundi** al estilo de los plataformas clásicos: caminos entre casillas; un nivel sin superar corta el paso. Cada mundo tiene 3 niveles, una tienda y un castillo con jefe.
- **4 mundos**: Praderas del Osario, Desierto de Ceniza, Cumbres Heladas y la Fortaleza del Rey Diablo, cada uno con sus monstruos (babosas, ratas, pinchones, arañas, cangrejos, erizos de hierro, fantasmas que se quedan quietos si los miras, bloques que caen a plomo, caballeros que embisten, diablillos que lanzan fuego...).
- **Jefes**: la Gran Babosa, el Cangrejo Colosal, el Bloque Titán y el Rey Diablo, con dos fases cada uno.
- **RPG**: experiencia, niveles (PV, PM, ataque y defensa), 8 habilidades que se aprenden al subir de nivel, armas y armaduras en las tiendas, pociones y éteres. Al subir de nivel te recompones entero.
- **Plataformas**: bloques premio, ladrillos rompibles, tablones, resortes, plataformas móviles, pinchos, agua y lava, puntos de control y monedas. Pisar a un monstruo le hace daño (salvo si tiene pinchos).
- **Caer** en un abismo quita el 20% de la vida y te devuelve al último suelo firme. Si te quedas sin vida, conservas la experiencia y puedes seguir desde el punto de control.
- La partida se guarda sola en el navegador al volver al mapa.

## Créditos

- Casillas, monedas, monstruos e iconos: [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) y [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) de Kenney, licencia CC0 (ver `public/assets/LICENSE-*.txt`).
- Osmo, el Rey Diablo, proyectiles y castillo del mapa: arte propio en `src/gfx/art.ts`.
- Música y sonidos: sintetizados con WebAudio en `src/ui/audio.ts`.
