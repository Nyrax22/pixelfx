# Ruin Diver (prototype)

A web game for Poki built on pixelfx: explore a new cave every expedition, dig, climb and fight your way to
relics, then get out alive (back up the entrance ladder or at an escape winch) or collapse and lose your bag.
Fill the collection book between expeditions. This is the early game: the Fallen Village (0-100m) and the
Deep Mine (100-300m), 31 relics (two are boss trophies), 4 sets, 5 upgrades, and two bosses: the Slime King
at 88-98m and the Ancient Golem at 189-199m. Each guards a gate down; beat one once and you can start the next
expedition in its hall. Enemies get faster and more numerous with depth.

The first minute is built by hand: grab three relics in the entrance chamber, dig through a gold wall, stomp a
slime, dig down to a treasure chest and escape at a winch. It can't be lost, and the chest completes the first
set. After that: treasure chests in rooms and far corners, stomp combos (x2, x3...) for bonus coins, a rare
golden slime that runs from you, and three missions at a time with coin rewards.

```bash
npm install
node games/ruin-diver/build.mjs      # writes games/ruin-diver/dist/index.html (one file, ~150 KB)
```

Open `dist/index.html` in a browser (`?debug` exposes `window.__rd` for automated playtests).

Controls: ←→/AD move, Space/Z jump (↑ jumps too away from ladders), ↑↓ climb ladders and ropes, X throws a
rope, push into a wall or hold ↓ to dig, Esc pauses. On touch: drag on the left half to move (down digs, up
climbs), buttons on the right jump and throw a rope.

## Pacing

`node games/ruin-diver/tools/pacing.mjs 0.6 60 v` plays an hour on real generated caves with a modeled explorer
and prints when each upgrade is bought, deaths, and when each boss falls. It's an estimate for tuning numbers in
`src/data.js`, not a substitute for playtesting.

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
| `tools/pacing.mjs` | the pacing model above |
| `fonts/` | Galmuri11 Bold by Lee Minseo (SIL OFL 1.1, see `fonts/OFL.md`); the build embeds only the characters used |
| `src/poki.js` | Poki SDK wrapper (no-op off Poki, with a stand-in for rewarded ads) |
| `src/audio.js` | synthesized sounds |

Effects from pixelfx: collect burst, hit spark, poof, torch, loot beam, confetti. Creatures and bosses are
sprites in `src/sprites.js`, drawn at the explorer's pixel scale.

## Poki checklist

- Add the Poki SDK script tag to `index.html` before submitting; `poki.js` picks it up.
- `gameplayStart` when an expedition starts, `gameplayStop` on pause, prompts, results and ads;
  `commercialBreak` only when starting another expedition from the results screen.
- Rewarded ads: relight the lantern, get back up after collapsing, double coins.
- Rewarded buttons (🎬, never green) always sit next to a standard button of the same size or larger.
- No external requests, no purchases, one currency, saves wrapped in try/catch.
- Still to do: static and animated thumbnails, portrait layout (landscape only for now).
