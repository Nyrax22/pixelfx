# Ruin Diver (prototype)

A web game for Poki built on pixelfx: dive down a rope into a ruined shaft, grab relics, climb out before
the mine caves in, and fill the collection book. This is the early game: the Fallen Village (0-100m) and
the Deep Mine (100-300m), 29 relics, 4 sets, 5 upgrades.

```bash
npm install
node games/ruin-diver/build.mjs      # writes games/ruin-diver/dist/index.html (one file, ~150 KB)
```

Open `dist/index.html` in a browser. Controls: drag (or A/D, arrow keys) to move, the Go up button (or W/↑)
to climb early, Esc/Space to pause.

## Files

| file | what's in it |
|---|---|
| `src/data.js` | every number and string: items, zones, sets, upgrades, Korean and English text |
| `src/logic.js` | the save, stats, the collection, what a dive is worth |
| `src/world.js` | one dive: spawning, pickups, bats, falling rocks, drawing |
| `src/bg.js` | wall textures, sky, light falling off with depth |
| `src/sprites.js` | item, explorer, coin and rock pixel sprites |
| `src/main.js` | the loop, input, HUD, results, collection, pause |
| `src/poki.js` | Poki SDK wrapper (no-op off Poki, with a stand-in for rewarded ads) |
| `src/audio.js` | synthesized sounds |

Effects from pixelfx: bat, collect burst, hit spark, poof, torch, loot beam, confetti.

## Poki checklist

- Add the Poki SDK script tag to `index.html` before submitting; `poki.js` picks it up.
- `gameplayStart` on the first dive, `gameplayStop` on pause, results and ads; `commercialBreak` only when
  diving again from the results screen.
- Rewarded buttons (🎬, never green) always sit next to a standard button of the same size or larger.
- No external requests, no purchases, one currency, saves wrapped in try/catch.
- Still to do: static and animated thumbnails, portrait layout (landscape only for now).
