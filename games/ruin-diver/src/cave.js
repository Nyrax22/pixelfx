// The cave: a new one every expedition. Tiles, ladders, escape winches, treasure and things that bite.

import { Rng } from "../../../src/core/index.js";
import { MW, MH, ZONES, ITEMS, WINCH_DEPTHS, SEAL_DEPTH, VARIANT_CHANCE, RARITY, BOSSES, CHESTS, GOLD_SLIME, ORES, EVENTS, PROPS, CRITTERS, LANDMARKS, SECRETS, TABLETS } from "./data.js";
import { pickEvents } from "./meta.js";
import { zoneAt } from "./logic.js";

// tile materials
export const AIR = 0, DIRT = 1, STONE = 2, BEDROCK = 3, GOLD = 4, GEM = 5, BRICK = 6, WOOD = 7, GATE = 8, CRACK = 9;
export const SOLID = [false, true, true, true, true, true, true, true, true, true];
export const MAT_NAME = ["air", "dirt", "stone", "bedrock", "gold", "gem", "brick", "wood", "gate", "crack"];
// overlays on air tiles
export const NONE = 0, LADDER = 1, SPIKES = 2, ROPE = 3, WINCH = 4, TORCH = 5, STALACTITE = 6, POOL = 7, ROOT = 8;

const ENTRANCE = { ladderX: 23, floorY: 9, holeX: 29 };
export let FILL = 0.5;
export const setFill = (f) => (FILL = f);

export function makeCave(seed, save, firstRun) {
  const first = false; // every cave is a real one now; the first run only gets hints
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
  {
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

  let sealSpot = null;
  // secret rooms: sealed chambers in the rock, opened through one cracked wall beside the open cave
  const secrets = [], tablets = [];
  for (const z of ZONES) {
    if (z.coming) continue;
    const cand = [];
    for (let y = Math.max(z.from, 18); y < Math.min(z.to, SEAL_DEPTH - 6); y++) {
      if (inArena(y) || inArena(y - 4) || inArena(y + 2)) continue;
      for (let x = 2; x < MW - 2; x++) {
        if (!floorAt(x, y) || dist[at(x, y)] < 0 || path[at(x, y)]) continue;
        for (const side of [1, -1]) {
          // the room: 5 wide, 3 high, starting two tiles off the side; everything around it solid rock
          const x0 = side > 0 ? x + 2 : x - 6, ok = x0 >= 1 && x0 + 4 <= MW - 2;
          if (!ok) continue;
          let solid = true;
          for (let yy = y - 3; yy <= y + 1 && solid; yy++) for (let xx = x0 - 1; xx <= x0 + 5 && solid; xx++) {
            const t = tile[at(xx, yy)];
            if (!(t === DIRT || t === STONE) || path[at(xx, yy)]) solid = false;
          }
          if (solid && SOLID[tile[at(x + side, y)]]) cand.push([x, y, side, x0]);
        }
      }
    }
    for (let n = 0; n < SECRETS[z.id] && cand.length; n++) {
      const [x, y, side, x0] = cand.splice(R.int(0, cand.length - 1), 1)[0];
      if (!free(x0 + 2, y)) { n--; continue; }
      for (let yy = y - 2; yy <= y; yy++) for (let xx = x0; xx <= x0 + 4; xx++) tile[at(xx, yy)] = AIR;
      // the way in: the wall tile beside the cave is cracked, the one between is plain rock
      tile[at(x + side, y)] = CRACK;
      const gap = side > 0 ? x + 2 : x - 2;
      if (gap !== x0 && gap !== x0 + 4) tile[at(side > 0 ? x0 - 1 : x0 + 5, y)] = CRACK;
      for (let xx = Math.min(x + side, x0); xx <= Math.max(x + side, x0 + 4); xx++) if (tile[at(xx, y)] !== AIR && tile[at(xx, y)] !== CRACK) tile[at(xx, y)] = CRACK;
      const id = rollItem(R, z, y, bookCount, 2);
      if (id) chests.push({ tx: x0 + 3, ty: y, item: id, variant: R.next() < VARIANT_CHANCE * 3, coins: CHESTS.coins[z.id] * 2 });
      tablets.push({ tx: x0 + 1, ty: y });
      secrets.push({ x0, x1: x0 + 4, y0: y - 2, y1: y, crack: [x + side, y] });
      claim(x0 + 2, y, 4);
      for (let k = 0; k < 3; k++) claim(x + side * k, y, 1);
    }
  }
  // tablets out in the cave, far from the main way
  for (const z of ZONES) {
    if (z.coming) continue;
    const far = floors.filter(([fx, fy]) => fy >= Math.max(z.from, 16) && fy < z.to && free(fx, fy) && dist[at(fx, fy)] > 6 && tile[at(fx, fy - 1)] === AIR);
    for (let n = 0; n < TABLETS[z.id] && far.length; n++) { const [fx, fy] = far.splice(R.int(0, far.length - 1), 1)[0]; tablets.push({ tx: fx, ty: fy }); claim(fx, fy, 2); }
  }
  // the sealed relic: one per cave, deep in the mine
  {
    const def = EVENTS.seal;
    const spots = floors.filter(([fx, fy]) => fy >= def.from && fy < SEAL_DEPTH - 20 && free(fx, fy) && free(fx - 1, fy) && free(fx + 1, fy) && tile[at(fx, fy - 1)] === AIR && tile[at(fx, fy - 2)] === AIR && dist[at(fx, fy)] >= 0 && dist[at(fx, fy)] < 10);
    if (spots.length) { const [fx, fy] = spots[R.int(0, spots.length - 1)]; sealSpot = { tx: fx, ty: fy }; claim(fx, fy, 3); }
  }
  // landmarks: one special place per zone, in the biggest open cavern we can find
  const landmarks = [];
  for (const z of ZONES) {
    if (z.coming || !LANDMARKS[z.id]) continue;
    const def = LANDMARKS[z.id][R.int(0, LANDMARKS[z.id].length - 1)];
    let best = null, bestN = 0;
    for (let tries = 0; tries < 400; tries++) {
      const fl = floors[R.int(0, floors.length - 1)];
      if (!fl) break;
      const [fx, fy] = fl;
      if (fy < Math.max(z.from, 20) || fy >= z.to - 4 || inArena(fy) || dist[at(fx, fy)] < 0) continue;
      let n = 0;
      for (let dx = -5; dx <= 5; dx++) if (floorAt(fx + dx, fy) && free(fx + dx, fy) && tile[at(fx + dx, fy - 2)] === AIR) n++;
      if (n > bestN) { bestN = n; best = [fx, fy]; }
    }
    if (!best || bestN < 5) continue;
    const [lx, ly] = best;
    landmarks.push({ id: def.id, tx: lx, ty: ly, def });
    claim(lx, ly, 6);
  }

  // random events: a few per zone, picked fresh every dive
  const events = [], enemiesPre = [];
  if (sealSpot) events.push({ type: "seal", ...sealSpot });
  for (const t of tablets) events.push({ type: "tablet", tx: t.tx, ty: t.ty });
  for (const z of ZONES) {
    if (z.coming) continue;
    for (const type of pickEvents(R, z.id, save.eventLog ?? [])) {
      const def = EVENTS[type], lo = Math.max(z.from, def.from ?? 0);
      if (type === "cavein") {
        // rubble across the main way: dig through it (stone for your trouble) or find another way
        const segs = pathCells.filter(([px, py]) => py >= lo && py < z.to && !inArena(py) && deco[at(px, py)] === NONE && deco[at(px + 1, py)] === NONE && deco[at(px - 1, py)] === NONE
          && SOLID[tile[at(px, py + 1)]] && SOLID[tile[at(px + 1, py + 1)]] && free(px, py));
        if (!segs.length) continue;
        const [cx, cy] = segs[R.int(0, segs.length - 1)];
        for (const xx of [cx, cx + 1]) for (let yy = cy; yy > cy - 3 && tile[at(xx, yy)] === AIR && deco[at(xx, yy)] === NONE; yy--) tile[at(xx, yy)] = STONE;
        events.push({ type, tx: cx, ty: cy });
        claim(cx, cy, 2);
        continue;
      }
      // everything else stands on a floor near the way down, with room around it
      const spots = floors.filter(([fx, fy]) => fy >= lo && fy < z.to && free(fx, fy) && free(fx - 1, fy) && free(fx + 1, fy)
        && floorAt(fx - 1, fy) && floorAt(fx + 1, fy) && tile[at(fx, fy - 1)] === AIR && tile[at(fx, fy - 2)] === AIR
        && dist[at(fx, fy)] >= (type === "supply" ? 2 : 1) && dist[at(fx, fy)] <= 16);
      if (!spots.length) continue;
      const [fx, fy] = spots[R.int(0, spots.length - 1)];
      if (type === "supply") {
        // a cache of crates, and something living in it
        for (const dx of [-1, 0, 1]) chests.push({ tx: fx + dx * 1, ty: fy, crate: true });
        const cs = ceilings.filter(([cx, cy]) => Math.abs(cx - fx) < 6 && cy < fy && fy - cy < 7);
        for (let k = 0; k < 2 && cs.length; k++) { const [bx, by] = cs.splice(R.int(0, cs.length - 1), 1)[0]; enemiesPre.push({ kind: "bat", tx: bx, ty: by, seed: R.int(1, 999) }); }
      }
      if (type === "vault" || type === "cursed") {
        const id = rollItem(R, z, fy, bookCount, 2);
        events.push({ type, tx: fx, ty: fy, item: id, variant: R.next() < VARIANT_CHANCE * 3 });
      } else events.push({ type, tx: fx, ty: fy });
      claim(fx, fy, 3);
    }
  }

  // rare ores, sealed in the rock beside open cave: dig them out
  const ores = new Map();
  for (const o of ORES) {
    const cand = [];
    for (let y = Math.max(o.from, 12); y < Math.min(o.to, SEAL_DEPTH - 2); y++) {
      if (inArena(y)) continue;
      for (let x = 1; x < MW - 1; x++) {
        const tt = tile[at(x, y)];
        if (tt !== DIRT && tt !== STONE) continue;
        // touching air that you can reach
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy)).filter((j) => tile[j] === AIR && dist[j] >= 0);
        if (!nb.length) continue;
        const d = Math.min(...nb.map((j) => dist[j]));
        cand.push([x, y, d]);
      }
    }
    // weighted toward the far corners
    const w = cand.map(([, , d]) => 1 + Math.min(d, 20) / 4);
    let tw = w.reduce((a, b) => a + b, 0);
    for (let n = 0; n < o.n && tw > 0; n++) {
      let t = R.next() * tw, k = 0;
      while (k < cand.length - 1 && (t -= w[k]) > 0) k++;
      tw -= w[k]; w[k] = 0;
      const [x, y] = cand[k];
      if (ores.has(at(x, y))) continue;
      tile[at(x, y)] = STONE;
      ores.set(at(x, y), o.id);
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

  // what you live on: mushrooms, water pools, oil, roots for wood, supply crates
  const mushrooms = [], oils = [], pools = [];
  const near = (fx, fy) => dist[at(fx, fy)] >= 0 && dist[at(fx, fy)] < 14;
  for (const z of ZONES) {
    if (z.coming) continue;
    const span = (z.to - Math.max(z.from, 12)) / 100;
    const pool = () => floors.filter(([fx, fy]) => fy >= Math.max(z.from, 12) && fy < z.to && free(fx, fy) && near(fx, fy) && deco[at(fx, fy)] === NONE);
    let fl = pool();
    for (let k = Math.round(z.mushrooms * span); k > 0 && fl.length; k--) {
      const [x, y] = fl.splice(R.int(0, fl.length - 1), 1)[0];
      mushrooms.push({ tx: x, ty: y }); claim(x, y, 0);
    }
    fl = pool().filter(([x, y]) => SOLID[tile[at(x - 1, y + 1)]] && SOLID[tile[at(x + 1, y + 1)]]);
    for (let k = Math.round(z.pools * span); k > 0 && fl.length; k--) {
      const [x, y] = fl.splice(R.int(0, fl.length - 1), 1)[0];
      deco[at(x, y)] = POOL; pools.push({ tx: x, ty: y }); claim(x, y, 1);
    }
    fl = pool();
    for (let k = Math.round(z.oils * span); k > 0 && fl.length; k--) {
      const [x, y] = fl.splice(R.int(0, fl.length - 1), 1)[0];
      oils.push({ tx: x, ty: y }); claim(x, y, 0);
    }
    fl = pool();
    for (let k = Math.round(z.crates * span); k > 0 && fl.length; k--) {
      const [x, y] = fl.splice(R.int(0, fl.length - 1), 1)[0];
      chests.push({ tx: x, ty: y, crate: true }); claim(x, y, 1);
    }
    // roots only where a jump reaches them: the floor two or three tiles below
    const cl = ceilings.filter(([cx, cy]) => cy >= Math.max(z.from, 12) && cy < z.to && free(cx, cy) && deco[at(cx, cy)] === NONE && (SOLID[tile[at(cx, cy + 3)]] || SOLID[tile[at(cx, cy + 4)]]));
    for (let k = Math.round(z.roots * span); k > 0 && cl.length; k--) {
      const [x, y] = cl.splice(R.int(0, cl.length - 1), 1)[0];
      deco[at(x, y)] = ROOT; claim(x, y, 0);
    }
  }
  // the entrance chamber always has a little of everything, to show what's what
  mushrooms.push({ tx: 18, ty: 8 }, { tx: 32, ty: 8 });
  deco[at(26, 8)] = POOL; pools.push({ tx: 26, ty: 8 });
  chests.push({ tx: 21, ty: 8, crate: true });
  oils.push({ tx: 15, ty: 8 });

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
  const enemies = [...enemiesPre];
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

  // props, critters and landmark dressing: the cave looks lived in
  const props = [], critters = [];
  for (const lm of landmarks) {
    const { def } = lm, row = [];
    for (let dx = -5; dx <= 5; dx++) if (floorAt(lm.tx + dx, lm.ty)) row.push(lm.tx + dx);
    def.props.forEach((id, k) => { const x = row[(k * 3 + 1) % row.length]; if (x != null) props.push({ id, tx: x, ty: lm.ty, ox: R.int(-4, 4) }); });
    for (let k = 0; k < (def.mushrooms ?? 0); k++) mushrooms.push({ tx: row[R.int(0, row.length - 1)], ty: lm.ty });
    for (let k = 0; k < (def.crates ?? 0); k++) chests.push({ tx: row[R.int(0, row.length - 1)], ty: lm.ty, crate: true });
    if (def.relic) { const z = zoneAt(lm.ty), id = rollItem(R, z, lm.ty, bookCount, 2); if (id) items.push({ id, tx: lm.tx, ty: lm.ty - 1, variant: false }); }
  }
  for (const z of ZONES) {
    if (z.coming || !PROPS[z.id]) continue;
    const P = PROPS[z.id];
    const fl = floors.filter(([fx, fy]) => fy >= Math.max(z.from, 12) && fy < z.to && free(fx, fy) && !path[at(fx, fy)] && deco[at(fx, fy)] === NONE);
    for (let n = 0; n < P.n && fl.length; n++) {
      const [fx, fy] = fl.splice(R.int(0, fl.length - 1), 1)[0];
      props.push({ id: P.floor[R.int(0, P.floor.length - 1)], tx: fx, ty: fy, ox: R.int(-3, 3) });
      claim(fx, fy, 0);
    }
    const cl = ceilings.filter(([cx, cy]) => cy >= Math.max(z.from, 12) && cy < z.to && free(cx, cy) && deco[at(cx, cy)] === NONE);
    for (let n = 0; n < P.ceilN && cl.length; n++) {
      const [cx, cy] = cl.splice(R.int(0, cl.length - 1), 1)[0];
      props.push({ id: P.ceil[R.int(0, P.ceil.length - 1)], tx: cx, ty: cy, ceil: true, ox: 0 });
      claim(cx, cy, 0);
    }
    const cr = floors.filter(([fx, fy]) => fy >= Math.max(z.from, 14) && fy < z.to && floorAt(fx - 1, fy) && floorAt(fx + 1, fy));
    for (let n = 0; n < CRITTERS.n && cr.length; n++) {
      const [fx, fy] = cr.splice(R.int(0, cr.length - 1), 1)[0];
      critters.push({ id: CRITTERS[z.id][R.int(0, CRITTERS[z.id].length - 1)], tx: fx, ty: fy });
    }
  }

  return { tile, deco, items, chests, coins, hearts, mushrooms, oils, pools, enemies, winches, rooms, arenas, entrance: ENTRANCE, path, dist, hints: [], events, ores, secrets, landmarks, props, critters };
}

export function rollItem(R, zone, m, bookCount, bump = 0) {
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
