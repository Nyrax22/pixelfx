// The cave: a new one every expedition. Tiles, ladders, escape winches, treasure and things that bite.

import { Rng } from "../../../src/core/index.js";
import { MW, MH, ZONES, ITEMS, WINCH_DEPTHS, SEAL_DEPTH, VARIANT_CHANCE, RARITY, BOSSES, CHESTS, GOLD_SLIME, ORES, EVENTS, PROPS, CRITTERS, LANDMARKS, SECRETS, TABLETS } from "./data.js";
import { pickEvents } from "./meta.js";
import { PATH, SIDE, RW, RH, mirror, planRows } from "./rooms.js";
import { zoneAt } from "./logic.js";

// tile materials
export const AIR = 0, DIRT = 1, STONE = 2, BEDROCK = 3, GOLD = 4, GEM = 5, BRICK = 6, WOOD = 7, GATE = 8, CRACK = 9, ARROW = 10, CRUMBLE = 11;
export const SOLID = [false, true, true, true, true, true, true, true, true, true, true, true];
export const MAT_NAME = ["air", "dirt", "stone", "bedrock", "gold", "gem", "brick", "wood", "gate", "crack", "arrow", "crumble"];
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

  // 1. solid rock everywhere; the rooms are cut out of it
  tile.fill(DIRT);

  // 2. the entrance: ground at the surface, a ladder down into a chamber, a hole in its floor
  for (let y = 0; y < 13; y++) for (let x = 0; x < MW; x++) tile[at(x, y)] = DIRT;
  for (let y = 4; y <= 8; y++) for (let x = 14; x <= 33; x++) carve(x, y, true);
  for (let y = 0; y <= 8; y++) { tile[at(ENTRANCE.ladderX, y)] = AIR; tile[at(ENTRANCE.ladderX + 1, y)] = AIR; deco[at(ENTRANCE.ladderX, y)] = LADDER; path[at(ENTRANCE.ladderX, y)] = 1; }
  for (let y = 6; y <= 8; y++) { for (let x = 6; x < 14; x++) carve(x, y); for (let x = 34; x < 42; x++) carve(x, y); }

  // 3. the room grid: rows of four designed rooms, broken where the boss halls cut across the cave
  const pathCells = [], rooms = [];
  const pre = { chests: [], coins: [], mush: [], oils: [], pools: [], pots: [], tnts: [], mons: [], idols: [], arrows: new Map() };
  const segs = [[]];
  for (let yy = 12; yy + RH <= SEAL_DEPTH - 2; ) {
    const b = BOSSES.find((bb) => yy + RH - 1 >= bb.top - 2 && yy <= bb.floor + 2);
    if (b) { segs.push([]); yy = b.floor + 3; continue; }
    segs[segs.length - 1].push(yy);
    yy += RH;
  }
  // a ladder shaft from (x, y0) down until it stands on something below yMin
  const shaft = (x, y0, yMin, yMax) => {
    for (let y = y0; y <= yMax; y++) {
      if (y > yMin && SOLID[tile[at(x, y + 1)]] && tile[at(x, y + 1)] !== CRUMBLE) { carve(x, y, true); deco[at(x, y)] = LADDER; return y; }
      carve(x, y, true);
      deco[at(x, y)] = LADDER;
    }
    return yMax;
  };
  const sideCount = new Map(), sideRooms = [], recent = [];
  const startCols = segs.map((_, i) => (i === 0 ? Math.floor(ENTRANCE.holeX / RW) : R.int(0, 3)));
  const segPlans = segs.map((rows, si) => planRows(R, rows, startCols[si]));
  for (let si = 0; si < segs.length; si++) {
    const plan = segPlans[si];
    for (const row of plan) {
      const z = zoneAt(row.y), mat = z.roomTile === "wood" ? WOOD : BRICK;
      for (let c = 0; c < 4; c++) {
        let tpl;
        if (row.kinds[c] === "path") {
          // never the same room twice in a row: skip the last few used
          let k = R.int(0, PATH.length - 1);
          for (let tries = 0; tries < 8 && recent.includes(k); tries++) k = R.int(0, PATH.length - 1);
          recent.push(k); if (recent.length > 4) recent.shift();
          tpl = PATH[k];
        }
        else {
          // vaults and idols are special: at most a couple of each per zone
          let k = R.int(0, SIDE.length - 1);
          const key = z.id + k;
          if ((k === 0 || k === 1 || k === 8) && (sideCount.get(key) ?? 0) >= 2) k = 3 + R.int(0, 4);
          sideCount.set(z.id + k, (sideCount.get(z.id + k) ?? 0) + 1);
          tpl = SIDE[k];
        }
        if (R.next() < 0.5) tpl = mirror(tpl);
        const x0 = c * RW;
        if (row.kinds[c] === "side") sideRooms.push({ x0, y: row.y, left: row.kinds[c - 1] === "path", right: row.kinds[c + 1] === "path", zone: z.id });
        for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) {
          const x = x0 + i, y = row.y + j, ch = tpl[j][i], k2 = at(x, y);
          if (x === 0 || x === MW - 1) continue;
          let t = AIR;
          switch (ch) {
            case "#": t = DIRT; break;
            case "?": t = R.next() < 0.5 ? DIRT : AIR; break;
            case "=": t = mat; break;
            case "w": t = WOOD; break;
            case "_": t = CRUMBLE; break;
            case "G": t = GOLD; break;
            case ">": case "<": t = ARROW; pre.arrows.set(k2, ch === ">" ? 1 : -1); break;
            case "L": deco[k2] = LADDER; break;
            case "^": deco[k2] = SPIKES; break;
            case "~": deco[k2] = POOL; pre.pools.push({ tx: x, ty: y }); break;
            case "C": pre.chests.push([x, y]); break;
            case "P": pre.pots.push([x, y]); break;
            case "X": pre.tnts.push([x, y]); break;
            case "M": if (R.next() < 0.6) pre.mons.push([x, y]); break;
            case "I": pre.idols.push([x, y]); break;
            case "$": pre.coins.push([x, y]); break;
            case "m": pre.mush.push([x, y]); break;
            case "o": pre.oils.push([x, y]); break;
          }
          tile[k2] = t;
          if (row.kinds[c] === "path" && t === AIR) path[k2] = 1;
        }
      }
      // path rooms side by side always join at walking height
      for (let c = 0; c < 3; c++) if (row.kinds[c] === "path" && row.kinds[c + 1] === "path")
        for (const x of [c * RW + RW - 1, (c + 1) * RW]) for (let y = row.y + 4; y <= row.y + 6; y++) if (tile[at(x, y)] !== ARROW) carve(x, y, true);
    }
    // drops: from where the path leaves a row, a ladder down into the next one
    for (let r = 0; r < plan.length; r++) {
      const row = plan[r], x = row.exit * RW + 5;
      if (r + 1 < plan.length) shaft(x, row.y + 6, plan[r + 1].y + 1, plan[r + 1].y + RH - 1);
    }
  }
  // the way in from the entrance chamber
  if (segPlans[0].length) shaft(ENTRANCE.holeX, ENTRANCE.floorY, segPlans[0][0].y + 1, segPlans[0][0].y + RH - 1);
  for (const plan of segPlans) for (const row of plan) for (let c = 0; c < 4; c++) if (row.kinds[c] === "path")
    for (let i = 1; i < RW - 1; i++) { const x = c * RW + i, y = row.y + 6; if (tile[at(x, y)] === AIR && SOLID[tile[at(x, y + 1)]]) pathCells.push([x, y]); }

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
  BOSSES.forEach((b, bi) => {
    const before = segPlans[bi], after = segPlans[bi + 1];
    const gx = after?.length ? after[0].entry * RW + 5 : 23;
    for (let y = b.top; y < b.floor; y++) for (let x = 1; x < MW - 1; x++) { tile[at(x, y)] = AIR; deco[at(x, y)] = NONE; path[at(x, y)] = 1; }
    for (let y = b.floor; y <= b.floor + 1; y++) for (let x = 1; x < MW - 1; x++) { tile[at(x, y)] = BEDROCK; deco[at(x, y)] = NONE; }
    tile[at(gx, b.floor)] = GATE; tile[at(gx, b.floor + 1)] = GATE;
    for (const [lx, ly] of [[8, b.floor - 4], [MW - 14, b.floor - 4]]) for (let i = 0; i < 6; i++) tile[at(lx + i, ly)] = WOOD;
    // in from above: a ladder from the last room of the stretch down into the hall
    if (before?.length) { const last = before[before.length - 1], x = last.exit * RW + 5; for (let y = last.y + 6; y < b.floor; y++) { carve(x, y, true); deco[at(x, y)] = LADDER; } }
    // out below the gate: a ladder down into the first room of the next stretch
    if (after?.length) shaft(gx, b.floor + 2, after[0].y + 1, after[0].y + RH - 1);
    arenas.push({ ...b, gx, x0: 1, x1: MW - 2 });
  });
  // the last stretch reaches down to the exit
  { const plan = segPlans[segPlans.length - 1], last = plan[plan.length - 1];
    if (last) for (let y = last.y + 6; y < SEAL_DEPTH - 1; y++) { if (tile[at(last.exit * RW + 5, y + 1)] === BEDROCK) break; carve(last.exit * RW + 5, y, true); deco[at(last.exit * RW + 5, y)] = LADDER; } }
  // safety net: if the rooms happen to seal the way down, cut a plain walkway along the path
  {
    const pass = (t) => t === AIR || t === GATE || t === CRACK || t === CRUMBLE;
    const reach = () => {
      const seen = new Uint8Array(MW * MH), q = [at(ENTRANCE.holeX, ENTRANCE.floorY)];
      seen[q[0]] = 1;
      let deep = 0;
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % MW, y = (i / MW) | 0;
        deep = Math.max(deep, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const j = at(X, Y); if (!seen[j] && pass(tile[j])) { seen[j] = 1; q.push(j); } }
      }
      return deep;
    };
    if (reach() < SEAL_DEPTH - 4) for (const plan of segPlans) for (const row of plan) {
      const xa = Math.min(row.entry, row.exit) * RW + 5, xb = Math.max(row.entry, row.exit) * RW + 5;
      for (let x = xa; x <= xb; x++) for (const y of [row.y + 5, row.y + 6]) if (tile[at(x, y)] !== BEDROCK) carve(x, y, true);
    }
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
  for (const k of ["chests", "pots", "tnts", "mons", "idols", "coins", "mush", "oils"]) for (const [x, y] of pre[k]) claim(x, y, 0);

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
        if (!floorAt(x, y) || dist[at(x, y)] < 0) continue;
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
  // closed side rooms beside the path become secret rooms too: one wall between them turns to cracked stone
  {
    const left = Object.fromEntries(ZONES.map((z) => [z.id, (SECRETS[z.id] ?? 0) + 2]));
    for (const room of sideRooms.sort(() => R.next() - 0.5)) {
      if (!left[room.zone] || inArena(room.y) || inArena(room.y + RH)) continue;
      const inner = [];
      for (let y = room.y + 1; y < room.y + RH - 1; y++) for (let x = room.x0 + 1; x < room.x0 + RW - 1; x++) if (tile[at(x, y)] === AIR) inner.push(at(x, y));
      if (inner.length < 8 || inner.some((i) => dist[i] >= 0)) continue;
      let done = false;
      for (const side of [room.left ? -1 : 0, room.right ? 1 : 0]) {
        if (!side || done) continue;
        for (const y of [room.y + 6, room.y + 5, room.y + 4]) {
          // walk from the room's inside outward to the path's open air
          let x = side < 0 ? room.x0 + 1 : room.x0 + RW - 2;
          while (x > room.x0 && x < room.x0 + RW - 1 && tile[at(x, y)] === AIR) x += side;
          const wall = [];
          while (wall.length < 4 && inb(x, y) && SOLID[tile[at(x, y)]] && tile[at(x, y)] !== BEDROCK) { wall.push(x); x += side; }
          if (!wall.length || wall.length > 3 || !inb(x, y) || tile[at(x, y)] !== AIR || dist[at(x, y)] < 0 || !SOLID[tile[at(x, y + 1)]]) continue;
          for (const wx of wall) tile[at(wx, y)] = CRACK;
          const outer = wall[wall.length - 1];
          secrets.push({ x0: room.x0 + 1, x1: room.x0 + RW - 2, y0: room.y + 1, y1: room.y + RH - 2, crack: [outer, y] });
          if (!inner.some((i) => chests.some((ch) => at(ch.tx, ch.ty) === i))) { const id = rollItem(R, zoneAt(room.y), room.y, bookCount, 2); const fl = inner.filter((i) => SOLID[tile[i + MW]]); if (id && fl.length) { const i = fl[R.int(0, fl.length - 1)]; chests.push({ tx: i % MW, ty: (i / MW) | 0, item: id, variant: false, coins: 12 }); } }
          if (R.next() < 0.6) { const fl = inner.filter((i) => SOLID[tile[i + MW]]); if (fl.length) { const i = fl[R.int(0, fl.length - 1)]; tablets.push({ tx: i % MW, ty: (i / MW) | 0 }); } }
          left[room.zone]--;
          done = true;
          break;
        }
      }
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
        for (const xx of [cx, cx + 1]) for (let yy = cy; yy > cy - 3 && tile[at(xx, yy)] === AIR && deco[at(xx, yy)] === NONE; yy--) tile[at(xx, yy)] = DIRT;
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

  // what the room templates asked for
  for (const [x, y] of pre.chests) { const z = zoneAt(y), id = rollItem(R, z, y, bookCount, 1); if (id) chests.push({ tx: x, ty: y, item: id, variant: R.next() < VARIANT_CHANCE * 2, coins: CHESTS.coins[z.id] }); }
  // loose coins along the way down, a trail to follow
  const coins = pre.coins.map(([x, y]) => ({ tx: x, ty: y, v: zoneAt(y).coinValue }));
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
  const mushrooms = pre.mush.map(([x, y]) => ({ tx: x, ty: y })), oils = pre.oils.map(([x, y]) => ({ tx: x, ty: y })), pools = [...pre.pools];
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
  // the very first dive: treasure within ten seconds
  if ((save.runs ?? 0) === 0) chests.push({ tx: 28, ty: 8, item: "rag_doll", variant: false, coins: 6 });

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
  for (const [x, y] of pre.mons) {
    const z = zoneAt(y), mine = z.id === "mine", r = R.next();
    if (r < 0.45) enemies.push({ kind: "slime", tx: x, ty: y + (SOLID[tile[at(x, y + 1)]] ? 0 : 1), seed: R.int(1, 999), red: mine && R.next() < 0.6 });
    else if (mine && r < 0.75) enemies.push({ kind: "skull", tx: x, ty: y, seed: R.int(1, 999) });
    else { let cy = y; while (cy > 0 && !SOLID[tile[at(x, cy - 1)]]) cy--; enemies.push({ kind: "bat", tx: x, ty: cy, seed: R.int(1, 999) }); }
  }
  const pick = (list, z) => {
    // weighted toward the bottom of the zone
    const w = list.map(([, y]) => 1 + 2 * (y - z.from) / (z.to - z.from));
    let t = R.next() * w.reduce((a, b) => a + b, 0), k = 0;
    while (k < list.length - 1 && (t -= w[k]) > 0) k++;
    return list.splice(k, 1)[0];
  };
  if (!first) for (const z of ZONES) {
    if (z.coming) continue;
    const span = 0.4 * (z.to - Math.max(z.from, z.enemyFrom)) / 100; // the rooms bring their own monsters
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
  const props = pre.pots.map(([x, y]) => ({ id: "pot", tx: x, ty: y, ox: 0 })), critters = [];
  for (const [x, y] of pre.tnts) props.push({ id: "tnt", tx: x, ty: y, ox: 0 });
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

  return { tile, deco, items, chests, coins, hearts, mushrooms, oils, pools, enemies, winches, rooms, arenas, entrance: ENTRANCE, path, dist, hints: [], events, ores, secrets, landmarks, props, critters, idols: pre.idols.map(([x, y]) => ({ tx: x, ty: y })), arrows: pre.arrows };
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
