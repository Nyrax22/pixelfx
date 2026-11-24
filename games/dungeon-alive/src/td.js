// The rules of the defense: one road from the gate down to the heart, build spots beside it, blood
// as money. Intruders walk the road in waves; traps built on the spots hurt them; the heart's own
// hand throws them into the rock; every few waves the heart wakes a little more (a card to keep).
// No DOM, no drawing: the renderer and the UI read the state and drain `run.events`.

import TD from "../data/td.json";
import { WP, ZONES, HEART_WP, ENT_WP, GATE_WP, MAP, wpXY, nearestWp } from "./map.js";
import { flyStep, hollowAt, ceilingAbove } from "./phys.js";

export { TD, WP, ZONES, HEART_WP, ENT_WP, GATE_WP, wpXY, hollowAt };

// ---------------------------------------------------------------- the road
/** Waypoint ids from the far end of the surface to the heart, by the shortest walk. */
export const ROUTE = (() => {
  const prev = new Map([[ENT_WP, null]]), q = [ENT_WP];
  while (q.length) {
    const w = q.shift();
    if (w === HEART_WP) break;
    for (const nb of WP[w].nb) if (!prev.has(nb)) { prev.set(nb, w); q.push(nb); }
  }
  const out = [];
  for (let w = HEART_WP; w != null; w = prev.get(w)) out.unshift(w);
  return out;
})();
const IDX = new Map(ROUTE.map((w, i) => [w, i]));
const SEG = ROUTE.map((w, i) => (i < ROUTE.length - 1 ? Math.hypot(WP[ROUTE[i + 1]].x - WP[w].x, WP[ROUTE[i + 1]].y - WP[w].y) : 0));
const ACC = SEG.reduce((a, s, i) => (a.push(a[i] + s), a), [0]);
export const ROUTE_LEN = ACC[ACC.length - 1];
/** The build spots: each one a waypoint on the road. */
export const SPOTS = (MAP.spots ?? []).map(([x, y], i) => ({ i, w: nearestWp(x, y, 40, (p) => IDX.has(p.id)), x, y }));
const routeAt = (x, y, maxR = Infinity) => nearestWp(x, y, maxR, (p) => IDX.has(p.id));

// ---------------------------------------------------------------- random
function rng(run) {
  return () => {
    let t = (run.rs = (run.rs + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

// ---------------------------------------------------------------- a run
export function newRun(seed = (Math.random() * 2 ** 31) | 0) {
  const rooms = {};
  for (const z of Object.values(ZONES)) rooms[z.id] = { type: z.kind === "heart" ? "heart" : z.kind === "entrance" ? "entrance" : "hall", open: true };
  const run = {
    td: 1, v: 4, seed, rs: seed >>> 0 || 1, phase: "build", night: 1, wave: 0, waveTotal: TD.nights * TD.wavesPerNight,
    blood: TD.start.blood, heart: { hp: TD.start.lives, max: TD.start.lives }, rooms,
    cards: [], monsters: [], advs: [], rocks: [], spawnQ: [], spawnT: 0, nextT: 0, t: 0, uid: 1,
    relics: [], mods: {}, offer: null, kills: 0, leaked: 0, events: [], result: null,
    cd: { grab: 0, rockfall: 0, roll: 0 }, streak: { n: 0, t: 0, best: 0 }, speed: 1,
    // the renderer reads these from the old rules; keep them harmless
    rage: 0, rageNeed: 1, mercy: [], day: 1,
  };
  run.preview = makeWave(run, 0);
  return run;
}
const mod = (run, k) => run.mods[k] ?? 0;
const has = (run, id) => run.relics.includes(id);

// ---------------------------------------------------------------- building
export const towerDef = (id) => TD.towers[id];
export function costOf(run, id, lvl) {
  const c = TD.towers[id].lv[lvl - 1].cost;
  return Math.round(c * (has(run, "cheap") ? 0.85 : 1));
}
export const towerAt = (run, spot) => run.cards.find((c) => c.spot === spot) ?? null;
export function build(run, spot, id) {
  if (towerAt(run, spot) || !TD.towers[id]) return false;
  const cost = costOf(run, id, 1);
  if (run.blood < cost) return false;
  run.blood -= cost;
  const S = SPOTS[spot];
  const t = { uid: run.uid++, id, spot, w: S.w, lvl: 1, spent: cost, cd: 0.3, hp: 0, disabledT: 0, kills: 0 };
  run.cards.push(t);
  run.events.push({ t: "place", w: S.w, id, spot });
  if (id === "nest") refillNest(run, t, true);
  return true;
}
export function upgrade(run, spot) {
  const t = towerAt(run, spot);
  if (!t || t.lvl >= 3) return false;
  const cost = costOf(run, t.id, t.lvl + 1);
  if (run.blood < cost) return false;
  run.blood -= cost; t.spent += cost; t.lvl++;
  run.events.push({ t: "upgrade", w: t.w, id: t.id, lvl: t.lvl, spot });
  if (t.id === "nest") { for (const m of run.monsters) if (m.owner === t.uid) { const L = nestLv(run, t); m.max = L.hp; m.hp = L.hp; m.atk = L.atk; } refillNest(run, t, true); }
  return true;
}
export function sell(run, spot) {
  const t = towerAt(run, spot);
  if (!t) return false;
  run.blood += Math.floor(t.spent * TD.sellBack);
  run.cards = run.cards.filter((c) => c !== t);
  run.monsters = run.monsters.filter((m) => m.owner !== t.uid);
  run.events.push({ t: "sell", w: t.w, spot });
  return true;
}

// slimes from a nest stand on the road next to it and hold the line
function nestLv(run, t) {
  const L = TD.towers.nest.lv[t.lvl - 1];
  return { ...L, hp: Math.round(L.hp * (has(run, "slimeHp") ? 1.7 : 1)), atk: L.atk * (has(run, "slimeHp") ? 1.4 : 1) };
}
function refillNest(run, t, now = false) {
  const L = nestLv(run, t);
  const mine = run.monsters.filter((m) => m.owner === t.uid);
  t.waiting ??= 0;
  const i0 = IDX.get(t.w);
  for (let k = mine.length; k < L.count; k++) {
    if (!now && t.waiting > 0) return;
    const slot = [0, -3, 3][k] ?? 0;
    const w = ROUTE[Math.max(1, Math.min(ROUTE.length - 3, i0 + slot))];
    const m = { id: run.uid++, w, species: "slime", hp: L.hp, max: L.hp, atk: L.atk, rate: 1, cd: 0, hitT: 0, owner: t.uid, traits: [], face: k % 2 ? 1 : -1, name: null };
    run.monsters.push(m);
    run.events.push({ t: "summon", w, m });
    t.waiting = L.respawn;
  }
}

// ---------------------------------------------------------------- waves
function makeWave(run, g) {
  const R = rng(run);
  const last = g === run.waveTotal - 1, n = g + 1;
  const pool = ["warrior", "rogue"];
  if (g >= 1) pool.push("mage");
  if (g >= 3) pool.push("cleric");
  const groups = [];
  let budget = 34 + g * 26 + g * g * 1.6;
  const price = { warrior: 6, rogue: 4.5, mage: 6.5, cleric: 7.5, knight: 26 };
  if (g >= 5 && g % 2 === 1) { const k = 1 + Math.floor((g - 5) / 4); groups.push(["knight", k]); budget -= price.knight * k; }
  while (budget > 4) {
    const cls = pick(R, pool), cnt = Math.max(2, Math.min(8, Math.round(budget / price[cls] * (0.35 + R() * 0.3))));
    groups.push([cls, cnt]);
    budget -= cnt * price[cls];
  }
  if (last) groups.push(["boss", 1]);
  return { n, groups, band: pick(R, TD.bands), captain: pick(R, TD.captains), hp: 1 + g * 0.09 + Math.max(0, g - 8) * 0.09 };
}
/** Start the next wave now (from the build phase, or early while the countdown runs). */
export function callWave(run) {
  if (run.phase === "relic" || run.phase === "end") return false;
  if (run.wave >= run.waveTotal) return false;
  const early = run.phase === "wave" && run.nextT > 0 ? Math.round(run.nextT * TD.earlyBonus) : 0;
  if (run.phase === "wave" && (run.spawnQ.length || run.nextT <= 0)) return false;
  if (early) { run.blood += early; run.events.push({ t: "early", amount: early }); }
  const W = run.preview;
  const R = rng(run);
  let lane = 0;
  for (const [cls, cnt] of W.groups) for (let i = 0; i < cnt; i++) run.spawnQ.push(makeAdv(run, cls, W.hp, lane++ % 3 - 1, R));
  run.spawnT = 0;
  run.wave++;
  run.phase = "wave";
  run.nextT = 0;
  run.events.push({ t: "wave", band: W.band, captain: W.captain, n: run.wave, of: run.waveTotal, party: run.spawnQ.map((a) => a.cls), boss: W.groups.some((g) => g[0] === "boss") });
  run.preview = run.wave < run.waveTotal ? makeWave(run, run.wave) : null;
  return true;
}
function makeAdv(run, cls, hpK, lane, R) {
  const E = TD.enemies[cls];
  const hp = Math.round(E.hp * hpK);
  return {
    id: run.uid++, cls, hp, max: hp, speed: E.speed * (0.92 + R() * 0.16), armor: E.armor, mres: E.mres, atk: E.atk, rate: E.rate, cd: 0,
    bounty: E.bounty, lives: E.lives, boss: cls === "boss", skin: E.skin, scale: E.scale ?? 1, ranged: E.ranged ?? 0, heal: E.heal ?? 0, healT: E.healEvery ?? 0,
    i: 0, cell: ROUTE[0], next: ROUTE[1], prog: 0, lane, face: 1, fly: null, frozenT: 0, dazeT: 0, slowT: 0, slowK: 0, burnT: 0, burnDps: 0, bleedT: 0, bleedDps: 0,
    hitT: 0, dead: false, out: false, gear: [], courage: 1, courageMax: 1, state: "walk", trig: [], name: TD.enemies[cls].name,
  };
}
const active = (a) => !a.dead && !a.out;
const targetable = (a) => active(a) && !a.npc;
/** How far along the road an intruder is: the front of the line is who traps aim at. */
const travel = (a) => (a.fly ? ACC[a.i] ?? 0 : ACC[a.i] + SEG[a.i] * a.prog);

export function advPos(a) {
  if (a.fly) return [a.fly.x, a.fly.y];
  const A = WP[a.cell];
  if (a.next == null) return [A.x, A.y];
  const B = WP[a.next];
  return [A.x + (B.x - A.x) * a.prog, A.y + (B.y - A.y) * a.prog];
}
const dist = (a, x, y) => { const [ax, ay] = advPos(a); return Math.hypot(ax - x, ay - y); };
export const advsNear = (run, x, y, r) => run.advs.filter((a) => targetable(a) && dist(a, x, y) <= r);

// ---------------------------------------------------------------- damage
function deal(run, a, amount, el, src = {}) {
  if (!targetable(a) || amount <= 0) return 0;
  let dmg = amount;
  if (el === "physical") dmg *= 1 - a.armor;
  else if (el === "fire" || el === "arcane") dmg *= 1 - a.mres;
  if (a.sticky > 0 && has(run, "sticky")) dmg *= 1.2;
  dmg = Math.max(0.5, Math.round(dmg * 10) / 10);
  a.hp -= dmg;
  a.hitT = 0.18;
  const [x, y] = advPos(a);
  if (!src.dot) run.events.push({ t: "dmg", id: a.id, amount: dmg, el, x, y, boosted: amount >= 20 });
  else { a.dot = (a.dot ?? 0) + dmg; if (a.dot >= 1) { run.events.push({ t: "dmg", id: a.id, amount: Math.floor(a.dot), el, dot: true, x, y }); a.dot -= Math.floor(a.dot); } }
  if (a.hp > 0 && has(run, "execute") && !a.boss && a.hp / a.max < 0.12) { run.events.push({ t: "execute", id: a.id, x, y }); a.hp = 0; }
  if (a.hp <= 0) kill(run, a, src);
  return dmg;
}
function kill(run, a, src) {
  a.dead = true; a.hp = 0;
  run.kills++;
  const [x, y] = advPos(a);
  const gain = Math.round(a.bounty * (has(run, "bounty") ? 1.3 : 1));
  run.blood += gain;
  const sk = run.streak;
  sk.n = sk.t > 0 ? sk.n + 1 : 1; sk.t = 2.2; sk.best = Math.max(sk.best, sk.n);
  if (sk.n >= 3) { const bonus = sk.n >= 8 ? 15 : sk.n >= 5 ? 8 : 4; run.blood += bonus; run.events.push({ t: "streak", n: sk.n, bonus }); }
  else if (sk.n === 2) run.events.push({ t: "streak", n: 2, bonus: 0 });
  const fv = a.fly ? [a.fly.vx, a.fly.vy] : null;
  a.fly = null;
  if (src.tower) src.tower.kills++;
  run.events.push({ t: "death", id: a.id, x, y, fv, cls: a.skin === "boss" ? "boss" : a.cls, boss: a.boss, big: a.scale > 1 || src.big, from: src.from ?? null, bounty: gain,
    last: !run.spawnQ.length && run.advs.filter(active).length === 0 && run.wave === run.waveTotal });
  // burning bodies go up like torches
  if (a.burnT > 0 && has(run, "pyre")) {
    run.events.push({ t: "pyre", x, y });
    for (const o of advsNear(run, x, y, 36)) if (o !== a) deal(run, o, 12, "fire", {});
  }
}

// ---------------------------------------------------------------- the heart's hand and the rock
export function launch(run, a, vx, vy) {
  if (!targetable(a)) return;
  const heavy = a.boss ? 0.15 : a.scale > 1 ? 0.45 : a.cls === "warrior" ? 0.8 : 1;
  const [x, y] = advPos(a);
  if (a.fly) { a.fly.vx += vx * heavy; a.fly.vy = Math.min(a.fly.vy, vy * heavy); a.fly.ground = false; return; }
  a.fly = { x, y: y - 1, vx: vx * heavy, vy: vy * heavy, t: 0, hit: [] };
  a.next = null; a.prog = 0;
}
export function grab(run, id) {
  if (run.phase === "end" || run.cd.grab > 0 || run.advs.some((o) => o.fly?.held)) return { ok: false, why: "cd" };
  const a = run.advs.find((x) => x.id === id);
  if (!a || !targetable(a)) return { ok: false };
  if (a.boss || a.scale > 1.2) { run.events.push({ t: "tooHeavy", id }); return { ok: false, why: "heavy" }; }
  const [x, y] = advPos(a);
  a.fly = { x, y, vx: 0, vy: 0, t: 0, hit: [], held: true, holdT: 0 };
  a.next = null; a.prog = 0;
  run.events.push({ t: "grab", id, x, y });
  return { ok: true };
}
export function holdAt(run, x, y) {
  const a = run.advs.find((o) => o.fly?.held);
  if (!a) return false;
  const f = a.fly, open = (px, py) => hollowAt(run.rooms, px, py) && hollowAt(run.rooms, px, py - 12);
  const dx = x - f.x, dy = y - f.y, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let i = 1; i <= steps; i++) {
    const px = f.x + dx / steps, py = f.y + dy / steps;
    if (open(px, py)) { f.x = px; f.y = py; } else if (open(px, f.y)) f.x = px; else if (open(f.x, py)) f.y = py; else break;
  }
  return true;
}
export function fling(run, vx, vy) {
  const a = run.advs.find((o) => o.fly?.held);
  if (!a) return false;
  const f = a.fly, sp = Math.hypot(vx, vy), max = TD.abilities.grab.flingMax, k = sp > max ? max / sp : 1;
  const heavy = a.cls === "warrior" ? 0.8 : 1;
  f.vx = vx * k * heavy; f.vy = vy * k * heavy; f.held = false; f.ground = false; f.t = 0;
  run.cd.grab = TD.abilities.grab.cd - (has(run, "quickHand") ? 2.5 : 0);
  run.events.push({ t: "fling", id: a.id, x: f.x, y: f.y, speed: sp * k });
  return true;
}
function flyAdv(run, a, dt) {
  const f = a.fly;
  if (f.held) { f.holdT += dt; if (f.holdT > 2.2) fling(run, 0, 0); return; }
  f.t += dt;
  const heavy = has(run, "heavyHand") ? 1.6 : 1;
  const hit = (kind, v) => {
    if (!targetable(a)) return;
    const thr = kind === "floor" ? 230 : 170;
    if (v <= thr) return;
    const dmg = (v - thr) * (kind === "floor" ? 0.08 : 0.075) * heavy * (1 + run.wave * 0.06);
    run.events.push({ t: "slam", id: a.id, kind, v, x: f.x, y: f.y, vx: f.vx, vy: f.vy });
    deal(run, a, dmg, "true", { big: v > 420 });
  };
  const air = flyStep(run.rooms, f, dt, hit, { height: 16 });
  if (!targetable(a)) { a.fly = null; return; }
  const sp = Math.hypot(f.vx, f.vy);
  if (sp > 220) for (const o of run.advs) {
    if (o === a || !targetable(o) || f.hit.includes(o.id) || o.fly) continue;
    const [ox, oy] = advPos(o);
    if (Math.abs(ox - f.x) < 11 && Math.abs(oy - f.y) < 16) {
      f.hit.push(o.id);
      run.events.push({ t: "bowl", id: o.id, x: ox, y: oy });
      deal(run, o, sp * 0.035 * heavy, "true", {});
      if (targetable(o)) launch(run, o, f.vx * 0.7, -140 - sp * 0.15);
      f.vx *= 0.75;
    }
  }
  if (f.y > MAP.H + 20) return kill(run, a, {});
  if (!air || f.t > 5) {
    const w = routeAt(f.x, f.y, 60) ?? routeAt(f.x, f.y);
    a.fly = null;
    a.i = Math.min(IDX.get(w), ROUTE.length - 2); a.cell = ROUTE[a.i]; a.next = ROUTE[a.i + 1]; a.prog = 0;
    a.frozenT = Math.max(a.frozenT, 0.7); a.dazeT = Math.max(a.dazeT, 0.7);
    run.events.push({ t: "land", id: a.id });
  }
}
/** Ability by button: drop the ceiling or roll a boulder back up the road. */
export function cast(run, kind, x, y) {
  if (run.phase === "end" || run.cd[kind] > 0) return false;
  const A = TD.abilities[kind];
  const w = routeAt(x, y + 10, 80);
  if (w == null) return false;
  const [wx, wy] = wpXY(w);
  if (kind === "rockfall") {
    const n = A.count + (has(run, "landslide") ? 4 : 0);
    for (let i = 0; i < n; i++) {
      const rx = wx + (i - (n - 1) / 2) * 9 + (Math.random() - 0.5) * 6;
      if (!hollowAt(run.rooms, rx, wy - 4)) continue;
      run.rocks.push({ kind: "drop", x: rx, y: ceilingAbove(run.rooms, rx, wy - 4) + 3, vx: 0, vy: 0, t: -i * 0.07 - Math.random() * 0.05, hit: [], dmg: A.dmg, stun: A.stun });
    }
    run.events.push({ t: "rumble", x: wx, y: wy });
    run.cd.rockfall = A.cd - (has(run, "landslide") ? 4 : 0);
  } else {
    const n = has(run, "boulderX") ? 2 : 1;
    for (let k = 0; k < n; k++) run.rocks.push({ kind: "roll", x: wx + k * 16, y: wy - 1, vx: 0, vy: 0, ground: true, t: -k * 0.35, hit: [], dmg: A.dmg, knock: A.knock, speed: A.speed, i: IDX.get(w) });
    run.events.push({ t: "spell", id: "roll", w });
    run.cd.roll = A.cd;
  }
  return true;
}
function stepRocks(run, dt) {
  for (const r of run.rocks) {
    r.t += dt;
    if (r.t < 0) continue;
    let gone = false;
    if (r.kind === "roll") {
      // a boulder rolls back up the road toward the gate, over everyone on it
      const f = Math.max(0, r.i - 1), nx = WP[ROUTE[f]].x, ny = WP[ROUTE[f]].y;
      const L = Math.hypot(nx - r.x, ny - r.y), step = r.speed * dt;
      if (L <= step) { r.x = nx; r.y = ny; r.i = f; if (f === 0) gone = true; } else { r.x += ((nx - r.x) / L) * step; r.y += ((ny - r.y) / L) * step; }
      r.vx = nx < r.x ? -r.speed : r.speed;
      r.speed = Math.min(260, r.speed + 30 * dt);
    } else {
      const hit = () => { gone = true; };
      flyStep(run.rooms, r, dt, hit, { height: 10 });
    }
    for (const a of run.advs) {
      if (!targetable(a) || r.hit.includes(a.id)) continue;
      const [ax, ay] = advPos(a);
      if (Math.abs(ax - r.x) < 10 && r.y > ay - 24 * a.scale && r.y < ay + 6) {
        r.hit.push(a.id);
        run.events.push({ t: "rockHit", id: a.id, x: ax, y: ay, kind: r.kind });
        deal(run, a, r.dmg * (1 + run.wave * 0.05), "physical", { big: true });
        if (!targetable(a)) continue;
        if (r.kind === "roll") launch(run, a, Math.sign(r.vx) * r.knock, -r.knock * 0.75);
        else { a.frozenT = Math.max(a.frozenT, r.stun); a.dazeT = Math.max(a.dazeT, r.stun); gone = true; }
      }
    }
    if (r.t > 9 || r.y > MAP.H + 20) gone = true;
    if (gone) { r.dead = true; run.events.push({ t: "rockBreak", x: r.x, y: r.y, kind: r.kind }); }
  }
  run.rocks = run.rocks.filter((r) => !r.dead);
}

// ---------------------------------------------------------------- the step
export function step(run, dt) {
  if (run.phase === "end" || run.phase === "relic") return;
  run.t += dt;
  for (const k in run.cd) run.cd[k] = Math.max(0, run.cd[k] - (k === "grab" && run.advs.some((a) => a.fly?.held) ? 0 : dt));
  if (run.streak.t > 0) { run.streak.t -= dt; if (run.streak.t <= 0) run.streak.n = 0; }
  stepRocks(run, dt);
  for (const t of run.cards) stepTower(run, t, dt);
  if (run.phase !== "wave") return;

  if (run.spawnQ.length) {
    run.spawnT -= dt;
    if (run.spawnT <= 0) {
      const a = run.spawnQ.shift();
      run.advs.push(a);
      run.spawnT = a.cls === "rogue" ? 0.45 : a.scale > 1 ? 1.4 : 0.75;
      run.events.push({ t: "spawn", id: a.id, cls: a.cls, boss: a.boss, name: a.name });
      // the next wave's horn starts counting once this one is all in
      if (!run.spawnQ.length && run.wave < run.waveTotal && !relicDue(run)) run.nextT = TD.waveGap;
    }
  } else if (run.nextT > 0) {
    run.nextT -= dt;
    if (run.nextT <= 0) { run.nextT = 0.0001; callWave(run); }
  }
  for (const a of run.advs) if (active(a)) stepAdv(run, a, dt);
  for (const m of run.monsters) if (m.hp > 0) stepMonster(run, m, dt);
  for (const m of run.monsters) if (m.hp <= 0) m.deadT -= dt;
  run.monsters = run.monsters.filter((m) => m.hp > 0 || m.deadT > 0);
  run.advs = run.advs.filter((a) => active(a) || run.t - (a.goneT ??= run.t) < 2);

  if (run.heart.hp <= 0) { run.heart.hp = 0; return finish(run, false); }
  if (!run.spawnQ.length && !run.advs.some(active) && run.clearedAt !== run.wave) {
    run.clearedAt = run.wave;
    if (run.wave >= run.waveTotal) return finish(run, true);
    const interest = has(run, "interest") ? Math.min(40, Math.floor(run.blood * 0.1)) : 0;
    if (interest) { run.blood += interest; run.events.push({ t: "interest", amount: interest }); }
    run.events.push({ t: "waveClear", n: run.wave });
    if (relicDue(run)) offerRelic(run);
    else if (run.nextT <= 0) run.nextT = Math.min(TD.waveGap, 8);
  }
}
const relicDue = (run) => run.wave % TD.relicEvery === 0 && run.wave < run.waveTotal && run.relicAt !== run.wave;

function stepAdv(run, a, dt) {
  a.hitT = Math.max(0, a.hitT - dt);
  a.cd -= dt;
  if (a.burnT > 0) { a.burnT -= dt; deal(run, a, a.burnDps * dt, "fire", { dot: true }); }
  if (a.bleedT > 0) { a.bleedT -= dt; deal(run, a, a.bleedDps * dt, "true", { dot: true }); }
  if (!active(a)) return;
  if (a.fly) return flyAdv(run, a, dt);
  if (a.dazeT > 0) a.dazeT -= dt;
  if (a.slowT > 0) a.slowT -= dt;
  if (a.sticky > 0) a.sticky -= dt;
  if (a.frozenT > 0) { a.frozenT -= dt; return; }
  const [x, y] = advPos(a);
  // clerics patch up whoever is hurt nearby
  if (a.heal) {
    a.healT -= dt;
    if (a.healT <= 0) {
      a.healT = TD.enemies.cleric.healEvery;
      const low = advsNear(run, x, y, 60).filter((o) => o.hp < o.max).sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
      if (low) { low.hp = Math.min(low.max, low.hp + a.heal * (1 + run.wave * 0.05)); run.events.push({ t: "heal", id: low.id, x: advPos(low)[0], y: advPos(low)[1] }); }
    }
  }
  // the heart
  if (a.i >= ROUTE.length - 2 || Math.hypot(WP[HEART_WP].x - x, WP[HEART_WP].y - y) < 34) {
    a.out = true;
    run.heart.hp -= a.lives;
    run.leaked += a.lives;
    run.events.push({ t: "heartHit", id: a.id, amount: a.lives });
    return;
  }
  // slimes in the way: stop and fight (mages throw fire from further off)
  const reach = a.ranged || 16;
  const foe = run.monsters.find((m) => m.hp > 0 && Math.abs(WP[m.w].x - x) < reach && Math.abs(WP[m.w].y - y) < 20 && (IDX.get(m.w) ?? 0) >= a.i - 1);
  if (foe) {
    a.sticky = 0.3;
    if (Math.abs(WP[foe.w].x - x) > 0.5) a.face = WP[foe.w].x > x ? 1 : -1;
    if (a.cd <= 0) {
      a.cd = a.rate;
      foe.hp -= a.atk * (1 + run.wave * 0.05);
      foe.hitT = 0.15;
      run.events.push({ t: "advHit", id: a.id, mid: foe.id, cls: a.cls });
      if (a.ranged) run.events.push({ t: "advShot", id: a.id, x, y, tx: WP[foe.w].x, ty: WP[foe.w].y });
      if (foe.hp <= 0) { foe.deadT = 0.4; const t = run.cards.find((c) => c.uid === foe.owner); if (t) t.waiting = nestLv(run, t).respawn; run.events.push({ t: "monDeath", mid: foe.id, w: foe.w }); }
    }
    if (!a.ranged || Math.abs(WP[foe.w].x - x) < 16) return;
  }
  // walk
  const slow = Math.max(a.slowT > 0 ? a.slowK : 0, a.sticky > 0 && has(run, "sticky") ? 0.4 : 0);
  a.prog += (dt * a.speed * (1 - slow)) / Math.max(1, SEG[a.i]);
  while (a.prog >= 1 && a.i < ROUTE.length - 2) { a.prog -= 1; a.i++; }
  a.cell = ROUTE[a.i]; a.next = ROUTE[a.i + 1];
  const dx = WP[a.next].x - WP[a.cell].x;
  if (Math.abs(dx) > 0.5) a.face = dx > 0 ? 1 : -1;
}
function stepMonster(run, m, dt) {
  m.hitT = Math.max(0, (m.hitT ?? 0) - dt);
  m.cd -= dt;
  if (m.cd > 0) return;
  const [x, y] = wpXY(m.w);
  const a = advsNear(run, x, y, 22).filter((o) => !o.fly)[0];
  if (!a) return;
  m.cd = m.rate;
  m.atkT = 0.2;
  run.events.push({ t: "monAtk", mid: m.id, x: advPos(a)[0], y: advPos(a)[1] });
  deal(run, a, m.atk, "physical", {});
}
function stepTower(run, t, dt) {
  const D = TD.towers[t.id], L = D.lv[t.lvl - 1];
  if (t.id === "nest") {
    if (t.waiting > 0) t.waiting -= dt;
    else refillNest(run, t);
    return;
  }
  if (run.phase !== "wave") return;
  t.cd -= dt;
  if (t.cd > 0) return;
  const [x, y] = wpXY(t.w);
  const wallY = D.where === "wall" ? y - 40 : y;
  const r = L.r * (t.id === "flame" && has(run, "flameRange") ? 1.3 : 1);
  let near = advsNear(run, x, D.where === "wall" ? y - 10 : y, r).filter((a) => !a.fly || D.where === "wall");
  if (!near.length) { t.cd = 0.05; return; }
  near.sort((p, q) => travel(q) - travel(p));
  const src = { tower: t, from: [x, wallY] };
  let every = L.every;
  if (t.id === "spike") {
    const dmg = L.dmg * (has(run, "spikeDmg") ? 1.45 : 1);
    run.events.push({ t: "trap", id: "spike", w: t.w, targets: near.map((a) => a.id) });
    for (const a of near) {
      deal(run, a, dmg, "physical", src);
      const bl = (L.bleed ?? 0) + (has(run, "bleed") ? 3 : 0);
      if (bl && targetable(a)) { a.bleedT = 3; a.bleedDps = Math.max(a.bleedDps, bl); }
    }
  } else if (t.id === "arrow") {
    if (has(run, "arrowRate")) every /= 1.3;
    const n = 1 + (L.pierce ?? 0) + (has(run, "pierce") ? 1 : 0), tg = near.slice(0, n);
    run.events.push({ t: "trap", id: "arrow", w: t.w, targets: tg.map((a) => a.id) });
    for (const a of tg) deal(run, a, L.dmg, "physical", src);
  } else if (t.id === "flame") {
    run.events.push({ t: "trap", id: "flame", w: t.w, targets: near.map((a) => a.id), r });
    const burn = L.burn * (has(run, "flameRange") ? 1.5 : 1);
    for (const a of near) { deal(run, a, L.dmg, "fire", src); if (targetable(a)) { a.burnT = 3; a.burnDps = Math.max(a.burnDps, burn); } }
  } else if (t.id === "tesla") {
    const n = L.chain + (has(run, "chain") ? 2 : 0), tg = [near[0]];
    while (tg.length < n) {
      const [lx, ly] = advPos(tg[tg.length - 1]);
      const nx = run.advs.filter((a) => targetable(a) && !tg.includes(a) && dist(a, lx, ly) < 70).sort((p, q) => dist(p, lx, ly) - dist(q, lx, ly))[0];
      if (!nx) break;
      tg.push(nx);
    }
    run.events.push({ t: "trap", id: "tesla", w: t.w, targets: tg.map((a) => a.id) });
    for (const a of tg) deal(run, a, L.dmg, "lightning", src);
  }
  t.cd = every;
}

// ---------------------------------------------------------------- relics and the end
function offerRelic(run) {
  const R = rng(run);
  const pool = TD.relics.filter((r) => !run.relics.includes(r.id));
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0].id);
  run.offer = out;
  run.relicAt = run.wave;
  run.phase = "relic";
  run.events.push({ t: "relic", options: out });
}
export function chooseRelic(run, i) {
  if (run.phase !== "relic") return false;
  const id = run.offer[i];
  if (!id) return false;
  run.relics.push(id);
  if (id === "lives") { run.heart.max += 6; run.heart.hp += 6; }
  run.offer = null;
  // a new night after every second card
  if (run.wave % TD.wavesPerNight === 0) {
    run.night++;
    run.blood += TD.start.nightBlood;
    run.events.push({ t: "night", n: run.night });
  }
  run.phase = "wave";
  run.nextT = TD.waveGap;
  run.events.push({ t: "relicTaken", id });
  return true;
}
function finish(run, win) {
  run.phase = "end";
  run.result = { win, wave: run.wave, kills: run.kills, night: run.night, relics: run.relics.length, lives: run.heart.hp };
  run.events.push({ t: "end", win });
}
