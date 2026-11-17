# Ruin Diver (prototype)

A survival web game for Poki built on pixelfx. You're trapped in a cave; the way out is 300m down. Hunger,
thirst and light run down all the time: eat mushrooms, collect water from pools, refill your lantern with oil,
and build torches (wood) and campfires (wood and stone) from what you dig and gather. Creatures come looking
for you in the dark and keep out of torchlight; campfires heal you and cook your food. Two bosses guard the way
down (the Slime King at 88-98m, the Ancient Golem at 189-199m); beating one lets you start the next run in its
hall. Gold buys permanent upgrades (lantern, pack, health, pickaxe, an iron stomach), and relics you find go
into the collection book.

```bash
npm install
node games/ruin-diver/build.mjs      # writes games/ruin-diver/dist/index.html (one file, ~150 KB)
```

Open `dist/index.html` in a browser (`?debug` exposes `window.__rd` for automated playtests).

Controls: ←→/AD move, Space/Z jump (↑ jumps too away from ladders), ↑↓ climb ladders and ropes, push into a
wall or hold ↓ to dig, 1 eat, 2 drink, 3 torch, 4 campfire, X rope, Esc pauses. On touch: drag on the left half to move (down digs, up
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
| `art/` | painted cave backdrops (village, mine), generated with Scenario's Retro Diffusion Plus; also the title screen |
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
