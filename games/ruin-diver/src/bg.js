// Drawing the cave: tile textures with lit and shaded edges, the back wall behind open space, the sky over the
// surface, and the light that falls off with depth.

import { W, H, T, MW, MH } from "./data.js";
import { IMG } from "./pix.js";
import { AIR, DIRT, STONE, BEDROCK, GOLD, GEM, BRICK, WOOD, GATE, SOLID } from "./cave.js";

const rgb = (r, g, b) => (255 << 24) | ((Math.max(0, Math.min(255, b)) & 255) << 16) | ((Math.max(0, Math.min(255, g)) & 255) << 8) | (Math.max(0, Math.min(255, r)) & 255);
const hx = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
function h2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sh = (c, k) => rgb(c[0] * k, c[1] * k, c[2] * k);
const VAR = 4; // texture variants per material

// Tiles are drawn the way a pixel artist would: a few flat tones per material, shapes with a lit top-left and a
// shaded bottom-right, no per-pixel noise. A palette is [darkest, dark, base, light, lightest].
function paint(pal, fn) {
  const P = pal.map(hx);
  return Array.from({ length: VAR }, (_, v) => {
    const g = new Uint8Array(T * T).fill(2);
    fn(g, v);
    const t = new Uint32Array(T * T);
    for (let i = 0; i < T * T; i++) t[i] = sh(P[g[i]], 1);
    return t;
  });
}
const put = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < T && y < T) g[y * T + x] = c; };
// a pebble: a small rounded blob, light on top, dark underneath
function pebble(g, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
    put(g, x + i, y + j, j === 0 ? 3 : j === h - 1 || i === w - 1 ? 0 : 1);
  }
}
function dirt(g, v) {
  const spots = [[2, 2, 3, 2], [9, 5, 4, 3], [4, 10, 3, 3], [12, 12, 3, 2], [1, 7, 2, 2], [10, 1, 2, 2]];
  for (let k = 0; k < 4; k++) {
    const [x, y, w, h] = spots[(k + v * 2) % spots.length];
    pebble(g, (x + v * 5) % 13, (y + v * 3) % 13, w, h);
  }
  for (let k = 0; k < 6; k++) put(g, (k * 7 + v * 3 + 1) % T, (k * 5 + v * 7 + 3) % T, k % 2 ? 3 : 1);
}
// stone: two or three chiselled blocks with seams between them
function blocks(g, v) {
  const splits = [[[0, 0, 16, 7], [0, 7, 9, 9], [9, 7, 7, 9]], [[0, 0, 7, 9], [7, 0, 9, 9], [0, 9, 16, 7]], [[0, 0, 10, 8], [10, 0, 6, 8], [0, 8, 16, 8]], [[0, 0, 16, 9], [0, 9, 6, 7], [6, 9, 10, 7]]][v];
  for (const [x, y, w, h] of splits) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    put(g, X, Y, i === w - 1 || j === h - 1 ? 0 : i === 0 || j === 0 ? 3 : (i + j * 3 + v) % 11 === 0 ? 1 : 2);
  }
  put(g, splits[0][0] + 2, splits[0][1] + 2, 4);
}
function brick(g, v) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = y >> 2, off = row & 1 ? 4 : 0, lx = (x + off) & 7, ly = y & 3;
    put(g, x, y, ly === 3 || lx === 7 ? 0 : ly === 0 ? 3 : lx === 6 ? 1 : 2);
  }
  put(g, (5 + v * 4) % T, 5, 1);
}
function planks(g, v) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const ly = y & 3, seam = (x + (y >> 2) * 6 + v * 3) % 16 === 0;
    put(g, x, y, ly === 3 || seam ? 0 : ly === 0 ? 3 : 2);
  }
  for (let r = 0; r < 4; r++) { put(g, (r * 5 + v + 2) % T, r * 4 + 1, 1); put(g, (r * 5 + v + 3) % T, r * 4 + 1, 1); }
}
// the back wall: the same shapes, two tones, quiet
function backDirt(g, v) {
  g.fill(2);
  dirt(g, v);
  for (let i = 0; i < T * T; i++) g[i] = g[i] === 3 ? 2 : g[i] === 0 ? 1 : g[i];
}
function backStone(g, v) {
  blocks(g, v);
  for (let i = 0; i < T * T; i++) g[i] = g[i] >= 3 ? 2 : g[i] === 0 ? 1 : g[i];
}
// ore: nuggets set into the base texture
function withOre(base, cols) {
  const O = cols.map(hx);
  return base.map((t, v) => {
    const o = t.slice();
    const spots = [[4, 4], [11, 9], [6, 12], [12, 3], [2, 9]];
    for (let k = 0; k < 3; k++) {
      const [x, y] = spots[(k + v) % spots.length];
      const px = [[0, -1, 2], [-1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 1, 0]];
      for (const [dx, dy, c] of px) o[(y + dy) * T + x + dx] = sh(O[c], 1);
    }
    return o;
  });
}

const V_DIRT = ["#2a160e", "#4a2a1a", "#6e4228", "#8e5e38", "#b0844e"];
const M_DIRT = ["#1e1614", "#3a2c26", "#54443a", "#6e5c4e", "#8e7a66"];
const V_STONE = ["#22222c", "#3e3e4c", "#5a5a6c", "#7a7a8e", "#a4a4b8"];
const M_STONE = ["#1a1c26", "#32364a", "#4a4e64", "#666c84", "#8e94ac"];
const dirtV = paint(V_DIRT, dirt), dirtM = paint(M_DIRT, dirt);
const stoneV = paint(V_STONE, blocks), stoneM = paint(M_STONE, blocks);
const GOLD_C = ["#a0620a", "#f0b424", "#fff4b0"], GEM_C = ["#1a6a9a", "#4ad0ff", "#e8ffff"];
// [village, mine] textures per material
const TEX = {
  [DIRT]: [dirtV, dirtM],
  [STONE]: [stoneV, stoneM],
  [BEDROCK]: [paint(["#08060c", "#121018", "#1c1a24", "#2a2834", "#3a3846"], blocks), paint(["#08060c", "#121018", "#1c1a24", "#2a2834", "#3a3846"], blocks)],
  [GOLD]: [withOre(dirtV, GOLD_C), withOre(dirtM, GOLD_C)],
  [GEM]: [withOre(stoneM, GEM_C), withOre(stoneM, GEM_C)],
  [BRICK]: [paint(["#2a120c", "#4e2418", "#7a3e2a", "#9a5a3a", "#c08060"], brick), paint(["#2a120c", "#4e2418", "#7a3e2a", "#9a5a3a", "#c08060"], brick)],
  [WOOD]: [paint(["#2a1608", "#4a2c14", "#7a5030", "#a07040", "#c89a60"], planks), paint(["#2a1608", "#4a2c14", "#7a5030", "#a07040", "#c89a60"], planks)],
};
// the boss gate: iron bars over darkness, rivets top and bottom
function bars(g) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const bar = x % 4 === 1 || x % 4 === 2, band = y === 2 || y === 13;
    put(g, x, y, band ? (x % 4 === 0 ? 4 : 3) : bar ? (x % 4 === 1 ? 3 : 1) : 0);
  }
}
TEX[9] = TEX[DIRT];
TEX[10] = TEX[STONE]; // arrow trap block (its face is drawn by the world)
TEX[11] = TEX[WOOD];  // crumbling planks // a cracked wall looks like the rock around it, plus its cracks
TEX[GATE] = [paint(["#06040a", "#3a3448", "#5a5468", "#8a84a0", "#c0b8d8"], bars), paint(["#06040a", "#3a3448", "#5a5468", "#8a84a0", "#c0b8d8"], bars)];
const BACK = [
  paint(["#140a06", "#22140c", "#2e1c12", "#2e1c12", "#2e1c12"], backDirt),
  paint(["#0c0c12", "#16161e", "#20202a", "#20202a", "#20202a"], backStone),
];
const OUTLINE = [hx("#120a06"), hx("#0c0c12")];
const GRASS = hx("#4a8a3a"), GRASS_HI = hx("#8ac04a"), GRASS_DK = hx("#2a5a2a");
const SKY = ["#141030", "#2e2450", "#6a4066", "#d07a5a"].map(hx);

/** Zone for texture choice: a soft dithered seam at 100m. */
const zoneIdx = (wx, wy) => {
  const d = wy - 100 * T;
  if (d < -12) return 0;
  if (d > 12) return 1;
  return h2(wx, wy, 99) < (d + 12) / 24 ? 1 : 0;
};

/**
 * Paint the cave for a camera whose top-left is at world (camX, camY), whole pixels. dig: Map of tile index
 * to dig progress 0..1, drawn as cracks.
 */
// Painted backdrops behind open space (one per zone), set from the page once their images decode.
// Each is darkened so tiles and sprites in front stay readable.
const BACKDROP = [null, null];
const BD_PARALLAX = 0.3;
export function setBackdrop(z, w, h, rgba) {
  const px = new Uint32Array(rgba.buffer.slice(0)), out = new Uint32Array(w * h);
  for (let i = 0; i < px.length; i++) {
    const c = px[i];
    out[i] = rgb((c & 255) * 0.42, ((c >>> 8) & 255) * 0.42, ((c >>> 16) & 255) * 0.5);
  }
  BACKDROP[z] = { w, h, px: out };
}
// the backdrop repeats sideways and mirrors on the way down, so it never ends
function blitBackdrop(C, bd, ox, oy, camX, camY) {
  const x0 = Math.max(0, -ox), x1 = Math.min(T, W - ox), y0 = Math.max(0, -oy), y1 = Math.min(T, H - oy);
  const offX = Math.floor(camX * BD_PARALLAX), offY = Math.floor(camY * BD_PARALLAX), H2 = bd.h * 2;
  for (let y = y0; y < y1; y++) {
    const sy = oy + y;
    let by = (((sy + offY) % H2) + H2) % H2;
    if (by >= bd.h) by = H2 - 1 - by;
    const row = sy * W, brow = by * bd.w;
    for (let x = x0; x < x1; x++) {
      const sx = ox + x, bx = (((sx + offX) % bd.w) + bd.w) % bd.w;
      C[row + sx] = bd.px[brow + bx];
    }
  }
}

// painted Wang tiles (PixelLab) for dirt and stone, drawn on a grid offset half a tile so each one's four corners
// are the four real tiles around it; bricks, timber, gold and gems keep their own textures on top
const WANG_MAT = new Set([1, 2, 3, 9]); // DIRT, STONE, BEDROCK, CRACK
const STONY = new Set([2, 3, 5, 8]);  // STONE, BEDROCK, GEM, GATE
function blitImg(C, img, ox, oy, flip) {
  for (let y = 0; y < img.h; y++) {
    const sy = oy + y;
    if (sy < 0 || sy >= H) continue;
    for (let x = 0; x < img.w; x++) {
      const sx = ox + x;
      if (sx < 0 || sx >= W) continue;
      const c = img.px[y * img.w + (flip ? img.w - 1 - x : x)];
      if (c >>> 24 > 100) C[sy * W + sx] = (c | 0xff000000) >>> 0;
    }
  }
}
export function drawCave(frame, cave, camX, camY, dig) {
  const C = frame.color, { tile } = cave;
  // sky above the surface
  for (let sy = 0; sy < H; sy++) {
    const wy = camY + sy;
    if (wy >= 0) break;
    const t = Math.max(0, Math.min(1, (wy + 260) / 260)) * (SKY.length - 1), i = Math.min(SKY.length - 2, Math.floor(t)), f = t - i;
    const a = SKY[i], b = SKY[i + 1], row = sy * W;
    for (let x = 0; x < W; x++) {
      const d = (h2(x + camX, wy, 3) - 0.5) * 6;
      C[row + x] = h2(x + camX, wy, 4) < 0.002 && wy < -120 ? rgb(230, 220, 240) : rgb(a[0] + (b[0] - a[0]) * f + d, a[1] + (b[1] - a[1]) * f + d, a[2] + (b[2] - a[2]) * f + d);
    }
  }
  const tx0 = Math.floor(camX / T), ty0 = Math.max(0, Math.floor(camY / T));
  const tx1 = Math.floor((camX + W - 1) / T), ty1 = Math.min(MH - 1, Math.floor((camY + H - 1) / T));
  const solidAt = (x, y) => (x < 0 || x >= MW || y >= MH ? true : y < 0 ? false : SOLID[tile[y * MW + x]]);
  const wangOn = !!(IMG.t_dirt_w && IMG.t_stone_w);
  // past the side walls the camera may look a little beyond the map: it's all bedrock out there
  const tileAt = (x, y) => (x < 0 || x >= MW ? 3 : tile[y * MW + x]);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const m = tileAt(tx, ty), v = (h2(tx, ty, 7) * VAR) | 0, z = zoneIdx(tx * T, ty * T);
    const ox = tx * T - camX, oy = ty * T - camY;
    const painted = wangOn && WANG_MAT.has(m);
    if (m === AIR || painted) {
      if (BACKDROP[z]) blitBackdrop(C, BACKDROP[z], ox, oy, camX, camY);
      else blit(C, BACK[z][v], ox, oy, 0, 0, 0, 0, 0, 0);
      continue;
    }
    const top = !solidAt(tx, ty - 1), bot = !solidAt(tx, ty + 1), lf = !solidAt(tx - 1, ty), rt = !solidAt(tx + 1, ty);
    blit(C, TEX[m][z][v], ox, oy, top, bot, lf, rt, ty <= 1 && top && (m === DIRT || m === GOLD), dig?.get(ty * MW + tx) ?? 0, z);
  }
  if (!wangOn) return;
  const matAt = (x, y) => (x < 0 || x >= MW || y >= MH ? 3 : y < 0 ? 0 : tile[y * MW + x]);
  for (let vy = ty0; vy <= ty1 + 1; vy++) for (let vx = tx0; vx <= tx1 + 1; vx++) {
    const nw = matAt(vx - 1, vy - 1), ne = matAt(vx, vy - 1), sw = matAt(vx - 1, vy), se = matAt(vx, vy);
    const key = (SOLID[nw] ? 8 : 0) | (SOLID[ne] ? 4 : 0) | (SOLID[sw] ? 2 : 0) | (SOLID[se] ? 1 : 0);
    if (!key) continue;
    let stony = 0, n = 0;
    for (const m of [nw, ne, sw, se]) if (SOLID[m]) { n++; if (STONY.has(m)) stony++; }
    const set = stony * 2 > n ? IMG.t_stone_w : IMG.t_dirt_w, img = set[key];
    if (img) blitImg(C, img, vx * T - 8 - camX, vy * T - 8 - camY, key === 15 && h2(vx, vy, 11) < 0.5);
  }
  // the special blocks keep their look, and digging shows its cracks
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const m = tileAt(tx, ty), ox = tx * T - camX, oy = ty * T - camY;
    if (m === AIR) continue;
    const crack = dig?.get(ty * MW + tx) ?? 0;
    if (!WANG_MAT.has(m)) {
      const v = (h2(tx, ty, 7) * VAR) | 0, z = zoneIdx(tx * T, ty * T);
      blit(C, TEX[m][z][v], ox, oy, !solidAt(tx, ty - 1), !solidAt(tx, ty + 1), !solidAt(tx - 1, ty), !solidAt(tx + 1, ty), false, crack, z);
    } else if (m === 9 && !crack) {
      const pat = CRACK[2];
      for (let y = 0; y < T; y++) { const sy = oy + y; if (sy < 0 || sy >= H) continue; for (let x = 0; x < T; x++) { const sx = ox + x; if (sx >= 0 && sx < W && pat[y * T + x]) C[sy * W + sx] = 0xff2a3a4a; } }
    } else if (crack > 0) {
      const pat = CRACK[Math.min(3, (crack * 4) | 0)];
      for (let y = 0; y < T; y++) { const sy = oy + y; if (sy < 0 || sy >= H) continue; for (let x = 0; x < T; x++) { const sx = ox + x; if (sx >= 0 && sx < W && pat[y * T + x]) C[sy * W + sx] = 0xff140c0a; } }
    }
  }
}

function blit(C, tex, ox, oy, top, bot, lf, rt, grass, crack, z = 0) {
  const x0 = Math.max(0, -ox), x1 = Math.min(T, W - ox), y0 = Math.max(0, -oy), y1 = Math.min(T, H - oy);
  const ol = OUTLINE[z], olc = sh(ol, 1);
  for (let y = y0; y < y1; y++) {
    const row = (oy + y) * W + ox;
    for (let x = x0; x < x1; x++) {
      let c = tex[y * T + x];
      if (grass && y < 4) c = y === 0 ? ((x * 5) % 7 < 4 ? sh(GRASS_HI, 1) : sh(GRASS, 1)) : y === 1 ? sh(GRASS, 1) : y === 2 ? ((x * 3) % 5 < 2 ? sh(GRASS_DK, 1) : c) : c;
      else if (top && y === 0) c = olc;
      else if (top && y === 1) c = lighten(c, 1.3);
      if ((bot && y === T - 1) || (lf && x === 0) || (rt && x === T - 1)) c = olc;
      if (crack > 0 && CRACK[Math.min(3, (crack * 4) | 0)][y * T + x]) c = olc;
      C[row + x] = c;
    }
  }
}
const lighten = (c, k) => rgb((c & 255) * k, ((c >>> 8) & 255) * k, ((c >>> 16) & 255) * k);
// four stages of cracks, each adding to the last
const CRACK = (() => {
  const lines = [
    [[8, 8, 4, 3], [8, 8, 12, 5]],
    [[8, 8, 3, 12], [12, 5, 14, 2]],
    [[8, 8, 13, 13], [4, 3, 1, 6], [3, 12, 6, 15]],
    [[8, 8, 8, 1], [13, 13, 15, 10], [1, 6, 2, 9], [8, 8, 9, 15]],
  ];
  const out = [];
  let acc = new Uint8Array(T * T);
  for (const set of lines) {
    acc = acc.slice();
    for (const [a, b, c, d] of set) {
      const n = Math.max(Math.abs(c - a), Math.abs(d - b));
      for (let i = 0; i <= n; i++) acc[Math.round(b + ((d - b) * i) / n) * T + Math.round(a + ((c - a) * i) / n)] = 1;
    }
    out.push(acc);
  }
  return out;
})();

// ---------------------------------------------------------------- light

/** How much daylight reaches world y (pixels). */
export function ambientAt(wy) {
  if (wy < 0) return 1;
  const m = wy / T;
  if (m < 3) return 0.85 - m * 0.12;
  if (m < 100) return Math.max(0.16, 0.5 - ((m - 3) / 97) * 0.34);
  return Math.max(0.07, 0.16 - ((m - 100) / 200) * 0.09);
}
export function fillAmbient(lm, camY) {
  for (let sy = 0; sy < H; sy++) lm.fill(ambientAt(camY + sy), sy * W, sy * W + W);
}
/** Add a pool of light around (cx, cy), screen space: k at the center, smooth to 0 at radius r. */
export function addLight(lm, cx, cy, r, k) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy, row = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const f = 1 - d2 / r2;
      lm[row + x] += k * f * f;
    }
  }
}
/** Color times light, plus the frame's additive glow, into RGBA bytes. Light steps a little: pixel-art banding. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export function compositeLit(frame, lm, out) {
  const C = frame.color, L = frame.light, n = W * H;
  for (let i = 0; i < n; i++) {
    const c = C[i], l = L[i];
    // light in eight steps, ordered-dithered between them: the classic pixel-art falloff
    let k = lm[i];
    k = k > 1.25 ? 1.25 : Math.floor(k * 6 + BAYER[(((i / W) | 0) & 3) * 4 + (i % W & 3)]) / 6;
    let r = (c & 255) * k, g = ((c >>> 8) & 255) * k, b = ((c >>> 16) & 255) * k;
    if (l) { r += l & 255; g += (l >>> 8) & 255; b += (l >>> 16) & 255; }
    const j = i << 2;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
}
