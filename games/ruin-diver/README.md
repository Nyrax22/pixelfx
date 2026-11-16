# Ruin Diver (prototype)

A web game for Poki built on pixelfx: explore a new cave every expedition, dig, climb and fight your way to
relics, then get out alive (back up the entrance ladder or at an escape winch) or collapse and lose your bag.
Fill the collection book between expeditions. This is the early game: the Fallen Village (0-100m) and the
Deep Mine (100-300m), 29 relics, 4 sets, 5 upgrades.

```bash
npm install
node games/ruin-diver/build.mjs      # writes games/ruin-diver/dist/index.html (one file, ~150 KB)
```

Open `dist/index.html` in a browser (`?debug` exposes `window.__rd` for automated playtests).

Controls: ←→/AD move, Space/Z jump (↑ jumps too away from ladders), ↑↓ climb ladders and ropes, X throws a
rope, push into a wall or hold ↓ to dig, Esc pauses. On touch: drag on the left half to move (down digs, up
climbs), buttons on the right jump and throw a rope.

## Files

| file | what's in it |
|---|---|
| `src/data.js` | every number and string: items, zones, sets, upgrades, Korean and English text |
| `src/logic.js` | the save, stats, the collection, what a dive is worth |
| `src/cave.js` | cave generation: caverns, the main way down with ladders, side passages, rooms, ore, winches, items, enemies |
| `src/world.js` | one expedition: platformer physics, digging, ropes, enemies, hazards, escape and collapse, drawing |
| `src/bg.js` | tile textures, sky, light falling off with depth |
| `src/sprites.js` | item, explorer, coin and rock pixel sprites |
| `src/main.js` | the loop, input, HUD, results, collection, pause |
| `src/poki.js` | Poki SDK wrapper (no-op off Poki, with a stand-in for rewarded ads) |
| `src/audio.js` | synthesized sounds |

Effects from pixelfx: bat, slime, collect burst, hit spark, poof, torch, loot beam, confetti.

## Poki checklist

- Add the Poki SDK script tag to `index.html` before submitting; `poki.js` picks it up.
- `gameplayStart` when an expedition starts, `gameplayStop` on pause, prompts, results and ads;
  `commercialBreak` only when starting another expedition from the results screen.
- Rewarded ads: relight the lantern, get back up after collapsing, double coins.
- Rewarded buttons (🎬, never green) always sit next to a standard button of the same size or larger.
- No external requests, no purchases, one currency, saves wrapped in try/catch.
- Still to do: static and animated thumbnails, portrait layout (landscape only for now).
