// Survival balance check: does a dive have enough food, water and light to reach the exit?
// Builds real caves, counts what's within reach of the way down, and walks a model player down at a steady pace,
// picking up a share of what it passes. Run: node tools/balance.mjs
import { makeCave } from "../src/cave.js";
import { defaultSave, stats } from "../src/logic.js";
import { SURVIVE, UPGRADES, START_KIT } from "../src/data.js";

const CAVES = 12, PACE = 0.55; // meters of depth per second, detours included (from playtests: ~9 min to the exit)
const REACH = 14;              // tiles off the main way a player bothers going

function bands(cave) {
  // what sits within reach, per meter of depth
  const b = Array.from({ length: 300 }, () => ({ food: 0, pools: 0, oil: 0, wood: 0 }));
  const near = (x, y) => { const d = cave.dist[y * 48 + x]; return d >= 0 && d <= REACH; };
  for (const m of cave.mushrooms) if (m.ty < 300 && near(m.tx, m.ty)) b[m.ty].food++;
  for (const o of cave.oils) if (o.ty < 300 && near(o.tx, o.ty)) b[o.ty].oil++;
  for (const q of cave.pools) if (q.ty < 300 && near(q.tx, q.ty)) b[q.ty].pools++;
  for (const c of cave.chests) if (c.crate && c.ty < 300) { b[c.ty].food += 0.6; b[c.ty].wood += 2.5; b[c.ty].oil += 0.3; }
  return b;
}

/** Walk one model dive; returns the depth where it gives out (or 300). */
function walk(b, st, share) {
  let food = 100, water = 100, light = 100, inv = { m: START_KIT.mushroom, w: START_KIT.water }, hp = st.hearts, starve = 0, dark = 0;
  const dt = 1 / PACE; // one meter per step
  for (let d = 0; d < 300; d++) {
    // pick up a share of what's at this depth (keeping fractions as expected values)
    inv.m = Math.min(st.bag, inv.m + b[d].food * share);
    inv.w = Math.min(st.bag, inv.w + b[d].pools * share * 2.2); // a pool gives a few sips before you move on
    light = Math.min(100, light + b[d].oil * share * SURVIVE.oil);
    food -= (100 / (SURVIVE.food * st.stomach)) * dt;
    water -= (100 / (SURVIVE.water * st.stomach)) * dt;
    light -= (100 / st.lantern) * dt;
    if (food < 50 && inv.m >= 1) { inv.m--; food = Math.min(100, food + SURVIVE.mushroom); }
    if (water < 50 && inv.w >= 1) { inv.w--; water = Math.min(100, water + SURVIVE.drink); }
    if (light <= 0) { light = 0; dark += dt; }
    if (food <= 0 || water <= 0) { starve += dt; food = Math.max(0, food); water = Math.max(0, water); }
    while (starve >= SURVIVE.starveEvery) { starve -= SURVIVE.starveEvery; hp--; }
    if (hp <= 0) return { depth: d, dark };
  }
  return { depth: 300, dark };
}

const save = defaultSave();
const caves = Array.from({ length: CAVES }, (_, i) => bands(makeCave(1000 + i * 77, save, false)));
const tiers = [
  ["fresh", {}],
  ["early (stomach 1, lantern 2)", { stomach: 1, lantern: 2 }],
  ["mid (stomach 3, lantern 4, bag 3)", { stomach: 3, lantern: 4, bag: 3 }],
  ["late (stomach 5, lantern 7, bag 6)", { stomach: 5, lantern: 7, bag: 6 }],
];
console.log(`pace ${PACE} m/s · ${CAVES} caves · depth reached (avg / worst) and seconds in the dark\n`);
console.log("share picked up:        " + [0.3, 0.45, 0.6].map((s) => `${Math.round(s * 100)}%`.padStart(16)).join(""));
for (const [name, up] of tiers) {
  const s = defaultSave();
  Object.assign(s.up, up);
  const st = stats(s);
  const cells = [0.3, 0.45, 0.6].map((share) => {
    const r = caves.map((b) => walk(b, st, share));
    const avg = r.reduce((a, x) => a + x.depth, 0) / r.length, worst = Math.min(...r.map((x) => x.depth));
    const dark = r.reduce((a, x) => a + x.dark, 0) / r.length;
    return `${Math.round(avg)}/${worst}m ${Math.round(dark)}s`.padStart(16);
  });
  console.log(name.padEnd(24) + cells.join(""));
}
