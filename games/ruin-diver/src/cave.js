// The cave: a new one every expedition. Tiles, ladders, escape winches, treasure and things that bite.

import { Rng } from "../../../src/core/index.js";
import { MW, MH, ZONES, ITEMS, WINCH_DEPTHS, FIRST_DIVE, FIRST_CHEST_ITEM, SEAL_DEPTH, VARIANT_CHANCE, RARITY, BOSSES, CHESTS, GOLD_SLIME } from "./data.js";
import { zoneAt } from "./logic.js";

// tile materials
export const AIR = 0, DIRT = 1, STONE = 2, BEDROCK = 3, GOLD = 4, GEM = 5, BRICK = 6, WOOD = 7, GATE = 8;
export const SOLID = [false, true, true, true, true, true, true, true, true];
export const MAT_NAME = ["air", "dirt", "stone", "bedrock", "gold", "gem", "brick", "wood", "gate"];
// overlays on air tiles
export const NONE = 0, LADDER = 1, SPIKES = 2, ROPE = 3, WINCH = 4, TORCH = 5, STALACTITE = 6;

const ENTRANCE = { ladderX: 23, floorY: 9, holeX: 29 };
export let FILL = 0.5;
export const setFill = (f) => (FILL = f);

export function makeCave(seed, save, first) {
  const R = new Rng(seed);
  const tile = new Uint8Array(MW * MH), deco = new Uint8Array(MW * MH), path = new Uint8Array(MW * MH);
  const at = (x, y) => y * MW + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const carve = (x, y, onPath = false) => {
    if (x < 1 || x > MW - 2 || y < 1 || y > MH - 4) return;
    tile[at(x, y)] = AIR;
    if (onPath) path[at(x, y)] = 1;
  };

  // 1. noise, smoothed into caverns
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) tile[at(x, y)] = R.next() < FILL ? DIRT : AIR;
  const solidN = (g, x, y) => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const X = x + dx, Y = y + dy;
      n += !inb(X, Y) || g[at(X, Y)] !== AIR ? 1 : 0;
    }
    return n;
  };
  for (let it = 0; it < 5; it++) {
    const g = tile.slice();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const n = solidN(g, x, y);
      const cur = g[at(x, y)] !== AIR;
      tile[at(x, y)] = n >= 5 || (cur && n >= 4) || (it < 2 && n <= 1) ? DIRT : AIR;
    }
  }

  // 2. the entrance: ground at the surface, a ladder down into a chamber, a hole in its floor
  for (let y = 0; y < 13; y++) for (let x = 0; x < MW; x++) tile[at(x, y)] = DIRT;
  for (let y = 4; y <= 8; y++) for (let x = 14; x <= 33; x++) carve(x, y, true);
  for (let y = 0; y <= 8; y++) { tile[at(ENTRANCE.ladderX, y)] = AIR; tile[at(ENTRANCE.ladderX + 1, y)] = AIR; deco[at(ENTRANCE.ladderX, y)] = LADDER; path[at(ENTRANCE.ladderX, y)] = 1; }
  for (let y = 6; y <= 8; y++) { for (let x = 6; x < 14; x++) carve(x, y); for (let x = 34; x < 42; x++) carve(x, y); }

  // 3. the main way down: runs across and drops with ladders, so there's always a way back up
  let x = ENTRANCE.holeX, y = ENTRANCE.floorY, dir = R.next() < 0.5 ? -1 : 1;
  const pathCells = [];
  const bottom = SEAL_DEPTH - 3;
  while (y < bottom) {
    const drop = R.int(3, 7);
    for (let i = 0; i < drop && y < bottom; i++, y++) {
      carve(x, y, true);
      deco[at(x, y)] = LADDER;
      pathCells.push([x, y]);
    }
    // the floor under a drop
    const run = R.int(4, 11);
    for (let i = 0; i < run; i++) {
      carve(x, y, true); carve(x, y - 1, true); carve(x, y - 2, true);
      pathCells.push([x, y]);
      if (x + dir < 3 || x + dir > MW - 5) dir = -dir;
      x += dir;
    }
    if (R.next() < 0.35) dir = -dir;
  }
  // the ladder of a drop ends on a floor tile; make sure that floor exists
  // (a drop that opens into a cavern gets a ledge to land on rather than a ladder down into nothing)
  for (let yy = MH - 2; yy > 9; yy--) for (let xx = 1; xx < MW - 1; xx++) {
    if (deco[at(xx, yy)] !== LADDER || deco[at(xx, yy + 1)] === LADDER || tile[at(xx, yy + 1)] !== AIR) continue;
    let n = 1;
    while (n < 5 && tile[at(xx, yy + n + 1)] === AIR) n++;
    if (tile[at(xx, yy + n + 1)] !== AIR) for (let k = 1; k <= n; k++) deco[at(xx, yy + k)] = LADDER;
    else { tile[at(xx, yy + 1)] = WOOD; tile[at(xx + 1, yy + 1)] = WOOD; }
  }

  // 4. side passages off the main way
  for (let i = 0; i < pathCells.length; i += R.int(8, 16)) {
    let [bx, by] = pathCells[i], bd = R.next() < 0.5 ? -1 : 1;
    if (by < 16) continue;
    const len = R.int(6, 18);
    for (let k = 0; k < len; k++) {
      carve(bx, by); carve(bx, by - 1);
      if (R.next() < 0.3) carve(bx, by - 2);
      bx += bd;
      if (R.next() < 0.18) by += R.next() < 0.5 ? -1 : 1;
      if (bx < 2 || bx > MW - 3) break;
    }
  }

  // 5. rooms: ruined houses in the village, timbered chambers in the mine, each holding something good
  const rooms = [];
  for (const z of ZONES) {
    if (z.coming) continue;
    for (let i = 0; i < z.rooms; i++) {
      const rw = R.int(6, 9), rh = R.int(4, 5), rx = R.int(2, MW - rw - 3), ry = R.int(Math.max(14, z.from + 6), z.to - rh - 6);
      const mat = z.roomTile === "brick" ? BRICK : WOOD;
      for (let yy = ry - 1; yy <= ry + rh; yy++) for (let xx = rx - 1; xx <= rx + rw; xx++) {
        const edge = yy === ry - 1 || yy === ry + rh || xx === rx - 1 || xx === rx + rw;
        tile[at(xx, yy)] = edge ? mat : AIR;
      }
      // a doorway on one side, or none: then it's a sealed vault you dig into
      if (R.next() < 0.7) {
        const dx = R.next() < 0.5 ? rx - 1 : rx + rw;
        tile[at(dx, ry + rh - 1)] = AIR; tile[at(dx, ry + rh - 2)] = AIR;
      }
      rooms.push({ x: rx, y: ry, w: rw, h: rh, zone: z.id });
    }
  }

  // the chamber floor stays whole: one hole with a ladder down
  for (let x = 14; x <= 33; x++) if (x !== ENTRANCE.holeX) { tile[at(x, ENTRANCE.floorY)] = DIRT; deco[at(x, ENTRANCE.floorY)] = NONE; }
  for (let x = 13; x <= 34; x++) for (let y = 10; y <= 11; y++) if (!path[at(x, y)]) tile[at(x, y)] = DIRT;

  // a room wall built across a ladder gets a hole cut for it
  for (let i = 0; i < tile.length; i++) if (deco[i] === LADDER && tile[i] !== AIR) tile[i] = AIR;

  // 6. materials: clusters of stone, gold and gems along exposed faces, bedrock round the edge
  const n2 = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const h = (a, b) => ((Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s, 2246822519)) >>> 0) / 4294967296;
    const v = (a, b) => { let q = Math.imul(a ^ (a >>> 13), 1274126177) ^ b; return h(q, b); };
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1), u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w;
  };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = at(x, y);
    if (x === 0 || x === MW - 1 || y >= SEAL_DEPTH) { tile[i] = BEDROCK; deco[i] = NONE; continue; }
    if (tile[i] !== DIRT) continue;
    const z = zoneAt(y);
    if (z.coming) continue;
    if (y > 12 && n2(x / 5, y / 5, seed & 1023) < z.stone) tile[i] = STONE;
    const open = (inb(x, y - 1) && tile[at(x, y - 1)] === AIR) || (inb(x, y + 1) && tile[at(x, y + 1)] === AIR) || (tile[at(x - 1, y)] === AIR) || (tile[at(x + 1, y)] === AIR);
    if (y > 3 && R.next() < (open ? z.gold * 1.6 : z.gold * 0.5)) tile[i] = tile[i] === STONE && z.gem && R.next() < 0.5 ? GEM : GOLD;
  }

  // 6b. boss arenas: a hall across the whole cave with a bedrock floor and one gate down
  const arenas = [];
  for (const b of BOSSES) {
    const gx = 23;
    for (let y = b.top; y < b.floor; y++) for (let x = 1; x < MW - 1; x++) { tile[at(x, y)] = AIR; deco[at(x, y)] = deco[at(x, y)] === LADDER && y < b.top + 2 ? LADDER : NONE; }
    for (let y = b.floor; y <= b.floor + 1; y++) for (let x = 1; x < MW - 1; x++) { tile[at(x, y)] = BEDROCK; deco[at(x, y)] = NONE; }
    tile[at(gx, b.floor)] = GATE; tile[at(gx, b.floor + 1)] = GATE;
    // ledges to jump from, and a ladder down from wherever the way in arrives
    for (const [lx, ly] of [[8, b.floor - 4], [MW - 14, b.floor - 4]]) for (let i = 0; i < 6; i++) tile[at(lx + i, ly)] = WOOD;
    for (let x = 1; x < MW - 1; x++) if (deco[at(x, b.top)] === LADDER || deco[at(x, b.top - 1)] === LADDER) for (let y = b.top; y < b.floor; y++) deco[at(x, y)] = LADDER;
    // below the gate: a shaft down to the main way
    let target = null;
    for (const [px, py] of pathCells) if (py > b.floor + 2 && py < b.floor + 20 && (!target || Math.abs(px - gx) + (py - b.floor) < Math.abs(target[0] - gx) + (target[1] - b.floor))) target = [px, py];
    const ty = target ? target[1] : b.floor + 6;
    for (let y = b.floor + 2; y <= ty; y++) { carve(gx, y, true); deco[at(gx, y)] = LADDER; }
    if (target) for (let x = Math.min(gx, target[0]); x <= Math.max(gx, target[0]); x++) { carve(x, ty, true); carve(x, ty - 1, true); }
    arenas.push({ ...b, gx, x0: 1, x1: MW - 2 });
  }
  const inArena = (y) => arenas.some((a) => y >= a.top - 1 && y <= a.floor + 1);

  // 7. what's where: reachability from the main way, floors, ceilings
  const dist = new Int16Array(MW * MH).fill(-1), q = [];
  for (let i = 0; i < path.length; i++) if (path[i] && tile[i] === AIR) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], cx = i % MW, cy = (i / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = cx + dx, Y = cy + dy;
      if (!inb(X, Y)) continue;
      const j = at(X, Y);
      if (tile[j] !== AIR || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      q.push(j);
    }
  }
  const floorAt = (x, y) => inb(x, y + 1) && tile[at(x, y)] === AIR && SOLID[tile[at(x, y + 1)]] && deco[at(x, y)] === NONE;
  const ceilAt = (x, y) => inb(x, y - 1) && tile[at(x, y)] === AIR && SOLID[tile[at(x, y - 1)]] && deco[at(x, y)] === NONE;
  const floors = [], ceilings = [];
  for (let y = 12; y < SEAL_DEPTH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (inArena(y)) continue;
    if (floorAt(x, y)) floors.push([x, y]);
    if (ceilAt(x, y) && inb(x, y + 2) && tile[at(x, y + 1)] === AIR && tile[at(x, y + 2)] === AIR) ceilings.push([x, y]);
  }
  const taken = new Set();
  const claim = (x, y, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) taken.add(at(x + dx, y + dy));
  };
  const free = (x, y) => !taken.has(at(x, y));
  claim(ENTRANCE.ladderX, 8, 3);

  // escape winches near the main way at set depths
  const winches = [];
  for (const d of WINCH_DEPTHS) {
    const c = floors.filter(([fx, fy]) => Math.abs(fy - d) < 6 && dist[at(fx, fy)] >= 0 && dist[at(fx, fy)] < 6 && tile[at(fx, fy - 1)] === AIR && free(fx, fy));
    if (!c.length) continue;
    const [wx, wy] = c[R.int(0, c.length - 1)];
    deco[at(wx, wy)] = WINCH;
    winches.push({ x: wx, y: wy });
    claim(wx, wy, 2);
  }

  // items: more of them, and rarer, the further they are from the main way
  const items = [], chests = [];
  const bookCount = (id) => save.book[id]?.count ?? 0;
  if (first) {
    for (const f of FIRST_DIVE) items.push({ id: f.item, tx: f.tx, ty: f.ty, variant: false });
  } else {
    // every room keeps a chest; a few more sit far off the main way
    for (const r of rooms) {
      const cx = r.x + R.int(1, r.w - 2), cy = r.y + r.h - 1;
      if (inArena(cy) || inArena(r.y)) continue;
      const id = rollItem(R, zoneAt(cy), cy, bookCount, 1);
      if (id) { chests.push({ tx: cx, ty: cy, item: id, variant: R.next() < VARIANT_CHANCE * 2, coins: CHESTS.coins[zoneAt(cy).id] }); claim(cx, cy, 1); }
    }
    for (const z of ZONES) {
      if (z.coming) continue;
      const far = floors.filter(([fx, fy]) => fy >= Math.max(z.from, 14) && fy < z.to && free(fx, fy) && (dist[at(fx, fy)] < 0 || dist[at(fx, fy)] > 10));
      for (let n = 0; n < CHESTS.remote[z.id] && far.length; n++) {
        const [fx, fy] = far.splice(R.int(0, far.length - 1), 1)[0];
        const id = rollItem(R, z, fy, bookCount, 1);
        if (id) { chests.push({ tx: fx, ty: fy, item: id, variant: R.next() < VARIANT_CHANCE * 2, coins: CHESTS.coins[z.id] }); claim(fx, fy, 1); }
      }
    }
    for (const z of ZONES) {
      if (z.coming) continue;
      const pool = floors.filter(([fx, fy]) => fy >= Math.max(z.from, 12) && fy < z.to);
      const w = pool.map(([fx, fy]) => { const d = dist[at(fx, fy)]; return d < 0 ? 6 : 1 + Math.min(d, 24) / 5; });
      let tw = w.reduce((a, b) => a + b, 0);
      for (let n = 0; n < z.items && pool.length; n++) {
        let t = R.next() * tw, k = 0;
        while (k < pool.length - 1 && (t -= w[k]) > 0) k++;
        const [fx, fy] = pool[k];
        tw -= w[k]; w[k] = 0;
        if (!free(fx, fy)) continue;
        const d = dist[at(fx, fy)], bump = d < 0 || d > 14 ? 1 : 0;
        const id = rollItem(R, z, fy, bookCount, bump);
        if (!id) continue;
        items.push({ id, tx: fx, ty: fy, variant: R.next() < VARIANT_CHANCE });
        claim(fx, fy, 1);
      }
    }
  }

  // loose coins along the way down, a trail to follow
  const coins = [];
  for (const [fx, fy] of floors) if (dist[at(fx, fy)] >= 0 && dist[at(fx, fy)] < 3 && free(fx, fy) && R.next() < 0.07) coins.push({ tx: fx, ty: fy, v: zoneAt(fy).coinValue });

  // hearts to pick up: a little mercy on the way down
  const hearts = [];
  if (!first) for (const z of ZONES) {
    if (z.coming || !z.hearts) continue;
    const pool = floors.filter(([fx, fy]) => fy >= Math.max(z.from, 15) && fy < z.to && free(fx, fy) && dist[at(fx, fy)] >= 0 && dist[at(fx, fy)] < 10);
    const n = Math.round(z.hearts * (z.to - Math.max(z.from, 15)) / 100);
    for (let k = 0; k < n && pool.length; k++) {
      const [hx, hy] = pool.splice(R.int(0, pool.length - 1), 1)[0];
      hearts.push({ tx: hx, ty: hy });
      claim(hx, hy, 1);
    }
  }

  // spikes in the floors of side caves, never on the main way
  if (!first) for (const [fx, fy] of floors) {
    const z = zoneAt(fy);
    if (fy < 20 || !free(fx, fy) || path[at(fx, fy)] || dist[at(fx, fy)] < 3) continue;
    if (R.next() < z.spikes) { deco[at(fx, fy)] = SPIKES; claim(fx, fy, 0); }
  }

  // torches on walls beside the main way
  for (let i = 0; i < pathCells.length; i += 14) {
    const [px, py] = pathCells[i];
    for (const side of [-1, 1]) {
      const X = px + side, Y = py - 1;
      if (inb(X, Y) && tile[at(X, Y)] === AIR && SOLID[tile[at(X + side, Y)]] && deco[at(X, Y)] === NONE) { deco[at(X, Y)] = TORCH; break; }
    }
  }

  // enemies: bats hang from ceilings, slimes patrol floors, skulls haunt the mine; more of all of them deeper down
  const enemies = [];
  const pick = (list, z) => {
    // weighted toward the bottom of the zone
    const w = list.map(([, y]) => 1 + 2 * (y - z.from) / (z.to - z.from));
    let t = R.next() * w.reduce((a, b) => a + b, 0), k = 0;
    while (k < list.length - 1 && (t -= w[k]) > 0) k++;
    return list.splice(k, 1)[0];
  };
  if (!first) for (const z of ZONES) {
    if (z.coming) continue;
    const span = (z.to - Math.max(z.from, z.enemyFrom)) / 100;
    const cs = ceilings.filter(([cx, cy]) => cy >= z.enemyFrom && cy >= z.from && cy < z.to && free(cx, cy));
    for (let n = Math.round(z.bats * span); n > 0 && cs.length; n--) {
      const [cx, cy] = pick(cs, z);
      enemies.push({ kind: "bat", tx: cx, ty: cy, seed: R.int(1, 999) });
      claim(cx, cy, 2);
    }
    for (let n = Math.round(z.skulls * span); n > 0 && cs.length; n--) {
      const [cx, cy] = pick(cs, z);
      enemies.push({ kind: "skull", tx: cx, ty: cy + 1, seed: R.int(1, 999) });
      claim(cx, cy, 2);
    }
    const fs = floors.filter(([fx, fy]) => fy >= z.enemyFrom && fy >= z.from && fy < z.to && free(fx, fy) && floorAt(fx - 1, fy) && floorAt(fx + 1, fy) && !path[at(fx, fy)]);
    for (let n = Math.round(z.slimes * span); n > 0 && fs.length; n--) {
      const [fx, fy] = pick(fs, z);
      enemies.push({ kind: "slime", tx: fx, ty: fy, seed: R.int(1, 999), red: R.next() < z.redSlimes });
      claim(fx, fy, 2);
    }
  }

  // now and then a golden slime: it runs from you, and it's worth chasing
  if (!first && R.next() < GOLD_SLIME.chance) {
    const fs = floors.filter(([fx, fy]) => fy >= GOLD_SLIME.from && fy < GOLD_SLIME.to && free(fx, fy) && floorAt(fx - 1, fy) && floorAt(fx + 1, fy) && dist[at(fx, fy)] >= 0);
    if (fs.length) {
      const [fx, fy] = fs[R.int(0, fs.length - 1)];
      enemies.push({ kind: "slime", gold: true, tx: fx, ty: fy, seed: R.int(1, 999) });
      claim(fx, fy, 2);
    }
  }

  // stalactites: they let go when you walk underneath
  if (!first) for (const [cx, cy] of ceilings) {
    const z = zoneAt(cy);
    if (cy < 30 || !free(cx, cy) || deco[at(cx, cy)] !== NONE) continue;
    if (R.next() < z.stalactites * (1 + (cy - z.from) / 100)) { deco[at(cx, cy)] = STALACTITE; claim(cx, cy, 0); }
  }

  const cave = { tile, deco, items, chests, coins, hearts, enemies, winches, rooms, arenas, entrance: ENTRANCE, path, dist, hints: [] };
  return first ? tutorial(cave) : cave;
}

/**
 * The first expedition's cave, by hand: below the entrance chamber, a corridor walled with gold to dig through,
 * a slime to stomp, a ladder down, a chest you dig down to, and a winch out. Everything below is solid.
 */
function tutorial(cave) {
  const { tile, deco } = cave, at = (x, y) => y * MW + x;
  const fill = (x0, y0, x1, y1, m, d = NONE) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { tile[at(x, y)] = m; deco[at(x, y)] = d; } };
  fill(1, 10, MW - 2, MH - 1, DIRT);
  fill(0, 34, MW - 1, MH - 1, BEDROCK);
  // down from the chamber floor into the upper corridor
  fill(ENTRANCE.holeX, 9, ENTRANCE.holeX, 15, AIR, LADDER);
  fill(24, 13, 35, 15, AIR);
  fill(36, 13, 37, 15, GOLD);            // dig through this
  fill(38, 13, 45, 15, AIR);             // the slime's room
  fill(45, 16, 45, 22, AIR, LADDER);     // a ladder down
  fill(8, 20, 45, 22, AIR);              // the lower corridor
  deco[at(45, 20)] = LADDER; deco[at(45, 21)] = LADDER; deco[at(45, 22)] = LADDER;
  fill(17, 24, 23, 24, AIR);             // a pocket under the floor, dug into from above
  fill(16, 25, 24, 25, STONE);           // with a floor you can't dig through yet
  fill(16, 24, 16, 24, STONE); fill(24, 24, 24, 24, STONE);
  fill(17, 23, 17, 24, AIR, LADDER);     // and a ladder back up (its top is a step you can walk over)
  tile[at(26, 21)] = GOLD; tile[at(26, 22)] = GOLD; tile[at(27, 22)] = GOLD;
  deco[at(9, 22)] = WINCH;
  cave.winches = [{ x: 9, y: 22 }];
  cave.chests = [{ tx: 22, ty: 24, item: FIRST_CHEST_ITEM, variant: false, coins: 15 }];
  cave.enemies = [{ kind: "slime", tx: 42, ty: 15, seed: 11 }];
  cave.coins = [[30, 15], [32, 15], [34, 15], [39, 15], [40, 15], [41, 13], [38, 22], [35, 22], [32, 22], [29, 22], [18, 24], [19, 24], [20, 24]].map(([tx, ty]) => ({ tx, ty, v: 2 }));
  cave.hearts = [];
  cave.hints = [{ tx: 34, ty: 15, key: "digHint" }, { tx: 39, ty: 15, key: "stompHint" }, { tx: 20, ty: 22, key: "digDownHint" }];
  cave.arenas = [];
  cave.rooms = [];
  return cave;
}

function rollItem(R, zone, m, bookCount, bump = 0) {
  if (!zone.weights) return null;
  const pool = ITEMS.filter((it) => it.zone === zone.id && !it.boss && (it.min ?? 0) <= m);
  const rarities = Object.entries(zone.weights).filter(([r]) => pool.some((it) => it.rarity === r));
  // a bump shifts the odds toward the rarer end
  const ws = rarities.map(([r, w]) => w * (bump ? 1 + RARITY[r].order * 1.2 : 1));
  let roll = R.next() * ws.reduce((a, b) => a + b, 0), rarity = rarities[0]?.[0];
  for (let i = 0; i < rarities.length; i++) if ((roll -= ws[i]) < 0) { rarity = rarities[i][0]; break; }
  const list = pool.filter((it) => it.rarity === rarity);
  if (!list.length) return null;
  const iw = list.map((it) => (bookCount(it.id) ? 1 : 2.2));
  let t = R.next() * iw.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((t -= iw[i]) < 0) return list[i].id;
  return list[0].id;
}
