// Drawing: the dungeon that breathes, the things that live in it, and pixelfx for everything that glows.

import { createFrame, clearFrame, createFx, composite } from "../../../src/core/index.js";
import { rasterText, textWidth } from "../../../src/core/font.js";
import { VOLT } from "../../../src/fx/lightning/_lib.js";
import * as slime from "../../../src/fx/critters/slime.js";
import * as bat from "../../../src/fx/critters/bat.js";
import * as frog from "../../../src/fx/critters/frog.js";
import * as ghost from "../../../src/fx/critters/ghost.js";
import * as snake from "../../../src/fx/critters/snake.js";
import * as eyeball from "../../../src/fx/critters/eyeball.js";
import * as skull from "../../../src/fx/critters/flying-skull.js";
import * as wisp from "../../../src/fx/critters/wisp.js";
import * as hitSpark from "../../../src/fx/impacts/hit-spark.js";
import * as bluntHit from "../../../src/fx/impacts/blunt-hit.js";
import * as zapHit from "../../../src/fx/lightning/zap-hit.js";
import * as lightningStrike from "../../../src/fx/lightning/lightning-strike.js";
import * as flamethrower from "../../../src/fx/fire/flamethrower.js";
import * as flamePillar from "../../../src/fx/fire/flame-pillar.js";
import * as meteorFx from "../../../src/fx/fire/meteor.js";
import * as snowflake from "../../../src/fx/ice/snowflake-burst.js";
import * as iceSpikes from "../../../src/fx/ice/ice-spikes.js";
import * as toxicPuddle from "../../../src/fx/nature/toxic-puddle.js";
import * as necro from "../../../src/fx/shadow/necro-skulls.js";
import * as darkBoom from "../../../src/fx/shadow/dark-explosion.js";
import * as poof from "../../../src/fx/spawn/poof.js";
import * as coinDrop from "../../../src/fx/spawn/coin-drop.js";
import * as summonRise from "../../../src/fx/spawn/summon-rise.js";
import * as collect from "../../../src/fx/pickups/collect-burst.js";
import * as lootBeam from "../../../src/fx/pickups/loot-beam.js";
import * as coinSpin from "../../../src/fx/pickups/coin-spin.js";
import * as healAoe from "../../../src/fx/holy/heal-aoe.js";
import * as sunburst from "../../../src/fx/holy/sunburst.js";
import * as runeCircle from "../../../src/fx/arcane/rune-circle.js";
import * as dirtBoom from "../../../src/fx/explosions/dirt-explosion.js";
import * as bigBoom from "../../../src/fx/explosions/big-explosion.js";
import * as firework from "../../../src/fx/explosions/firework-burst.js";
import * as eggHatch from "../../../src/fx/spawn/egg-hatch.js";
import * as fireflies from "../../../src/fx/weather/fireflies.js";
import { COLS, ROWS, ENT, HEART, CARDS, MON, advPos, advCell, room as roomAt, key } from "./sim.js";
import { chibi, cardIcon, heartSprite, angryGhost, diaryPage, Pix, INK } from "./sprites.js";

export const FX = {
  slime, bat, frog, ghost, snake, eyeball, "flying-skull": skull, wisp, hitSpark, bluntHit, zapHit, lightningStrike, flamethrower,
  flamePillar, meteorFx, snowflake, iceSpikes, toxicPuddle, necro, darkBoom, poof, coinDrop, summonRise, collect, lootBeam, coinSpin,
  healAoe, sunburst, runeCircle, dirtBoom, bigBoom, firework, eggHatch, fireflies,
};

export const CELL = 64, M = 48;
const PAL = {
  fire: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffe26b", "#fff3a6", "#ffffff"],
  lightning: ["#120a33", "#2a1b78", "#4630c0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"],
  ice: ["#151a3d", "#212f6b", "#2c58aa", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"],
  poison: ["#0c100c", "#1e2814", "#2e5a18", "#5a9a1c", "#a6d42a", "#ecff86", "#ffffff"],
  arcane: ["#140a26", "#2b1252", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"],
  physical: ["#2a2440", "#5e5878", "#9a94b4", "#cdc8e0", "#f2f0fa", "#ffffff", "#ffffff"],
  fear: ["#08060e", "#2c2048", "#463470", "#6a54a0", "#9c86d0", "#e0d4ff", "#ffffff"],
  holy: ["#3d2027", "#c97a4a", "#f2b46a", "#ffd994", "#fff0cf", "#fffaf2", "#ffffff"],
  blood: ["#12040a", "#64101e", "#a01c2c", "#e03a44", "#ff8a8a", "#ffe0e0", "#ffffff"],
  cyan: ["#04141a", "#0a3a44", "#127a86", "#1fb8c4", "#4fe0e8", "#a8fff8", "#ffffff"],
  gold: ["#1a1004", "#6e4a10", "#b07a1c", "#e8b23a", "#ffe07a", "#fff8d8", "#ffffff"],
};
const NUM_COL = { fire: "#ffb04a", lightning: "#9ed8ff", ice: "#a6ecff", poison: "#a6f06a", arcane: "#d79aff", physical: "#ffffff", fear: "#c8b0ff", holy: "#ffe07a" };
const SPECIES_Y = { slime: 0, bat: -12, frog: 0, ghost: -2, snake: 0, eyeball: 0, skull: -4, wisp: -2 };

// floors: base, line, accent
const FLOOR = {
  hall: ["#2a2142", "#221a37", "#33294f"], entrance: ["#2c2838", "#221e2e", "#3a3448"], heart: ["#3a1428", "#2a0e1e", "#5a1a34"],
  water: ["#163060", "#122650", "#2a5aa0"], treasure: ["#2e2442", "#251c38", "#3a2e52"], nest: ["#2e2236", "#251a2c", "#3a2c44"],
  web: ["#26203a", "#1e1930", "#302848"], lava: ["#2a1010", "#200a0a", "#3a1410"], icecave: ["#1c3450", "#162a42", "#2a4a6a"],
  altar: ["#2a1f48", "#21183a", "#382a5c"], dark: ["#120e1c", "#0e0a16", "#1a1428"], mushroom: ["#1e2a1c", "#172216", "#283a24"],
  library: ["#2c2236", "#231a2c", "#3a2c44"], sealed: ["#3a3020", "#2e2618", "#4a3e2a"], secret: ["#4a3a24", "#3e301c", "#5e4a2e"],
};
const GOLD_FLOOR = ["#6a5020", "#5a4218", "#8a6a2a"];

const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export class Renderer {
  constructor(canvas) {
    // the world is drawn at native pixel size offscreen, then a camera shows part of it on the real canvas
    this.view = canvas;
    this.vg = canvas.getContext("2d");
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d");
    this.cam = { x: 0, y: 0, z: 2 };
    this.camOverride = null;
    this.camSnap = true;
    this.vw = 800; this.vh = 600; this.dpr = 1;
    this.hitStop = 0; this.slowT = 0; this.slowK = 0.3;
    this.impacts = []; this.rings = []; this.corpses = [];
    this.flashColor = "255,255,255"; this.redPulse = 0; this.focus = null;
    this.fx = [];
    this.mons = new Map();
    this.ambient = new Map();
    this.nums = [];
    this.floaters = [];
    this.bolts = [];
    this.shots = [];
    this.lights = [];
    this.shake = 0;
    this.t = 0;
    this.beat = 0;
    this.mode = "normal";
    this.night = 0;
    this.nightTarget = 0;
    this.gray = 0;
    this.highlights = [];
    this.hover = null;
    this.range = [];
    this.flash = 0;
    this.roomsDirty = true;
    this.setLayout(false);
  }

  setLayout(portrait) {
    this.portrait = portrait;
    this.camSnap = true;
    this.W = (portrait ? ROWS : COLS) * CELL + M * 2;
    this.H = (portrait ? COLS : ROWS) * CELL + M * 2;
    this.cv.width = this.W; this.cv.height = this.H;
    this.g.imageSmoothingEnabled = false;
    const mk = () => { const c = document.createElement("canvas"); c.width = this.W; c.height = this.H; return c; };
    this.roomCv = mk(); this.darkCv = mk(); this.underCv = mk(); this.overCv = mk();
    this.under = createFrame(this.W, this.H); this.over = createFrame(this.W, this.H);
    this.underImg = new ImageData(this.W, this.H); this.overImg = new ImageData(this.W, this.H);
    this.roomsDirty = true;
  }

  // ---- coordinates
  cellXY(c, r) { return this.portrait ? [M + r * CELL, M + c * CELL] : [M + c * CELL, M + r * CELL]; }
  /** Grid coordinates (cell units, may be fractional) to the world pixel at that cell's middle. */
  gw(gx, gy) { const [x, y] = this.cellXY(gx, gy); return [x + CELL / 2, y + CELL / 2]; }
  cellAt(x, y) {
    const a = Math.floor((x - M) / CELL), b = Math.floor((y - M) / CELL);
    const [c, r] = this.portrait ? [b, a] : [a, b];
    return c >= 0 && r >= 0 && c < COLS && r < ROWS ? [c, r] : null;
  }
  /** World pixel of an adventurer's feet. */
  advXY(a) {
    const [gx, gy] = advPos(a);
    const [x, y] = this.gw(gx, gy);
    const off = a.lane * 9;
    // spread the party across the corridor, perpendicular to the way they walk
    let horiz = !this.portrait;
    if (a.next) { const dc = a.next[0] !== a.cell[0]; horiz = this.portrait ? !dc : dc; }
    return horiz ? [x, y + 8 + off] : [x + off, y + 8];
  }
  /** Which way an adventurer faces on screen. */
  faceOf(a) {
    if (!a.next) return a.sface ?? 1;
    const [x0] = this.gw(...a.cell), [x1] = this.gw(...a.next);
    if (x1 !== x0) a.sface = x1 > x0 ? 1 : -1;
    return a.sface ?? 1;
  }
  monXY(m) {
    const [x, y] = this.cellXY(m.c, m.r);
    const sx = [16, 48, 32][m.slot] ?? 32, sy = [50, 50, 58][m.slot] ?? 50;
    return [x + sx, y + sy + (SPECIES_Y[m.species] ?? 0)];
  }

  // ---- effects
  spawn(name, x, y, opts = {}, layer = "over", dur = 0) {
    const mod = FX[name];
    if (!mod) return null;
    const fx = createFx(mod, { x: Math.round(x), y: Math.round(y), seed: (Math.random() * 1e6) | 0, ...opts });
    const it = { fx, layer, dur, age: 0 };
    this.fx.push(it);
    return it;
  }
  light(x, y, r, color = "255,200,140", life = 0.3) { this.lights.push({ x, y, r, color, life, max: life }); }
  number(x, y, n, el = "physical", big = false) {
    if (n >= 999) return;
    const txt = String(Math.max(1, Math.round(n)));
    this.nums.push({ x: x + (Math.random() * 10 - 5), y: y - 24, txt: big ? txt + "!" : txt, col: big ? "#ffe07a" : NUM_COL[el] ?? "#fff", big, small: n < 1.5, age: 0 });
    if (this.nums.length > 60) this.nums.shift();
  }
  bolt(x0, y0, x1, y1, color = "#cfeeff", life = 0.16) {
    const pts = [[x0, y0]];
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + (Math.random() - 0.5) * 9, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 9]);
    }
    pts.push([x1, y1]);
    this.bolts.push({ pts, color, life, max: life });
    this.light(x1, y1, 30, "160,200,255", 0.25);
  }
  shoot(x0, y0, x1, y1, kind) {
    this.shots.push({ x0, y0, x1, y1, kind, t: 0, dur: kind === "orb" ? 0.32 : 0.16 });
  }
  floatText(x, y, text, cls = "") { this.onText?.(x, y, text, cls); }

  // ---- feel: freeze frames, slow motion, punch-ins, manga impact lines
  stop(t) { this.hitStop = Math.max(this.hitStop, t); }
  slowmo(t, k = 0.3) { this.slowT = Math.max(this.slowT, t); this.slowK = k; }
  punch(x, y, dur = 0.4, zoom = 0.35) { this.focus = { x, y, dur, age: 0, zoom }; }
  impact(x, y, dur = 0.5) { this.impacts.push({ x, y, dur, age: 0 }); }
  /** How fast game time runs this frame (0 during a freeze), given real time dt. */
  timeScale(dt) {
    if (this.hitStop > 0) { this.hitStop -= dt; return 0; }
    if (this.slowT > 0) { this.slowT -= dt; return this.slowK; }
    return 1;
  }

  // ---- the camera
  resizeView(w, h, dpr) {
    this.vw = w; this.vh = h; this.dpr = dpr;
    this.view.width = Math.round(w * dpr); this.view.height = Math.round(h * dpr);
    this.vignette = null;
  }
  bounds(run) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (c, r) => { const [x, y] = this.cellXY(c, r); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + CELL); y1 = Math.max(y1, y + CELL); };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (run.rooms[key(c, r)]) add(c, r);
    for (const h of this.highlights) add(h[0], h[1]);
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: this.W, y1: this.H };
    const m = this.portrait ? 6 : 18;
    return { x0: x0 - m, y0: y0 - m - 10, x1: x1 + m, y1: y1 + m };
  }
  worldToScreen(x, y) { return [(this.dx + x * this.dz) / this.dpr, (this.dy + y * this.dz) / this.dpr]; }
  screenToWorld(px, py) { return [(px * this.dpr - this.dx) / this.dz, (py * this.dpr - this.dy) / this.dz]; }

  present(run, dt) {
    const vg = this.vg, V = this.view, dpr = this.dpr;
    let tx, ty, tz, rate = 4;
    const o = this.camOverride;
    if (o) { tx = o.x; ty = o.y; tz = o.z; rate = o.speed ?? 2; }
    else {
      const b = this.bounds(run);
      tx = (b.x0 + b.x1) / 2; ty = (b.y0 + b.y1) / 2;
      tz = Math.max(0.6, Math.min(3.6, this.vw / (b.x1 - b.x0), this.vh / (b.y1 - b.y0)));
      if (tz * dpr >= 2) tz = Math.floor(tz * dpr * 2) / (dpr * 2);
    }
    if (this.focus) {
      // a quick punch-in toward something that matters, easing back out
      const f = this.focus, p = Math.sin(Math.min(1, f.age / f.dur) * Math.PI);
      tx += (f.x - tx) * 0.5 * p; ty += (f.y - ty) * 0.5 * p; tz *= 1 + f.zoom * p;
      rate = Math.max(rate, 10);
    }
    const k = this.camSnap ? 1 : 1 - Math.exp(-dt * rate);
    this.camSnap = false;
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.z = Math.exp(Math.log(this.cam.z) + (Math.log(tz) - Math.log(this.cam.z)) * k);
    const sh = this.shake > 0 ? this.shake * 14 : 0;
    const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    const z = this.cam.z * dpr;
    this.dz = z;
    this.dx = Math.round(V.width / 2 - this.cam.x * z + sx * dpr);
    this.dy = Math.round(V.height / 2 - this.cam.y * z + sy * dpr);
    vg.setTransform(1, 0, 0, 1, 0, 0);
    vg.fillStyle = "#05030a";
    vg.fillRect(0, 0, V.width, V.height);
    vg.imageSmoothingEnabled = false;
    vg.drawImage(this.cv, this.dx, this.dy, this.W * z, this.H * z);
    // vignette, red at the edges when the heart is hurt
    if (!this.vignette) {
      const gr = vg.createRadialGradient(V.width / 2, V.height / 2, Math.min(V.width, V.height) * 0.35, V.width / 2, V.height / 2, Math.max(V.width, V.height) * 0.75);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.75)");
      this.vignette = gr;
    }
    vg.fillStyle = this.vignette; vg.fillRect(0, 0, V.width, V.height);
    const low = run ? 1 - run.heart.hp / Math.max(1, run.heart.max) : 0;
    const red = Math.max(this.redPulse, low > 0.6 ? (0.25 + 0.2 * Math.sin(this.t * 8)) * low : 0);
    if (red > 0) {
      const gr = vg.createRadialGradient(V.width / 2, V.height / 2, Math.min(V.width, V.height) * 0.3, V.width / 2, V.height / 2, Math.max(V.width, V.height) * 0.7);
      gr.addColorStop(0, "rgba(160,0,30,0)"); gr.addColorStop(1, `rgba(200,10,40,${Math.min(0.6, red)})`);
      vg.fillStyle = gr; vg.fillRect(0, 0, V.width, V.height);
    }
    if (this.gray > 0.01) this.drawGray();
    for (const im of this.impacts) { im.age += dt; this.drawImpact(im); }
    this.impacts = this.impacts.filter((im) => im.age < im.dur);
    if (this.flash > 0) { vg.fillStyle = `rgba(${this.flashColor},${Math.min(0.5, this.flash * 1.2)})`; vg.fillRect(0, 0, V.width, V.height); }
    else this.flashColor = "255,255,255";
  }
  drawImpact(im) {
    const vg = this.vg, V = this.view;
    const [cx, cy] = this.worldToScreen(im.x, im.y).map((v) => v * this.dpr);
    const a = Math.max(0, 1 - im.age / im.dur), R0 = Math.min(V.width, V.height) * (0.22 + 0.1 * (1 - a)), R1 = Math.hypot(V.width, V.height);
    vg.fillStyle = `rgba(0,0,0,${0.55 * a})`;
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * Math.PI * 2 + Math.random() * 0.08, w = 0.006 + Math.random() * 0.018, r0 = R0 * (0.8 + Math.random() * 0.6);
      vg.beginPath();
      vg.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      vg.lineTo(cx + Math.cos(ang - w) * R1, cy + Math.sin(ang - w) * R1);
      vg.lineTo(cx + Math.cos(ang + w) * R1, cy + Math.sin(ang + w) * R1);
      vg.fill();
    }
  }
  drawRing(r) {
    if (r.age < 0) return;
    const g = this.g, t = r.age / r.dur, rad = r.r * (1 - Math.pow(1 - t, 3));
    g.strokeStyle = r.color ? `rgba(${r.color},${1 - t})` : `rgba(255,${120 + 120 * t | 0},${140 + 100 * t | 0},${1 - t})`;
    g.lineWidth = Math.max(1, 6 * (1 - t));
    g.beginPath(); g.ellipse(r.x, r.y + 8, rad, rad * 0.62, 0, 0, Math.PI * 2); g.stroke();
  }
  drawCorpse(c) {
    const g = this.g, w = c.spr.width * c.k, hgt = c.spr.height * c.k;
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(Math.round(c.x - 6), Math.round(c.y - 1), 12, 2);
    g.save();
    g.translate(Math.round(c.x), Math.round(c.y - c.h - hgt / 2));
    g.rotate(c.rot);
    g.drawImage(c.spr, -w / 2, -hgt / 2, w, hgt);
    g.restore();
  }

  // ---- static rooms
  renderRooms(run) {
    const g = this.roomCv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#0b0814";
    g.fillRect(0, 0, this.W, this.H);
    // rock speckle
    for (let y = 0; y < this.H; y += 2)
      for (let x = 0; x < this.W; x += 2) {
        const h = hash(x, y, 7);
        if (h < 0.08) { g.fillStyle = h < 0.02 ? "#241c3a" : "#150f24"; g.fillRect(x, y, 2, 2); }
        else if (h > 0.9985) { g.fillStyle = "#3a6a8a"; g.fillRect(x, y, 1, 1); }
      }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const rm = run.rooms[key(c, r)]; if (rm) this.drawRoom(g, run, rm, c, r); }
    // doorways
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm) continue;
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const o = roomAt(run, c + dc, r + dr);
        if (!o) continue;
        const [x0, y0] = this.cellXY(c, r), [x1, y1] = this.cellXY(c + dc, r + dr);
        const fl = this.floorOf(rm.type);
        g.fillStyle = fl[0];
        if (x0 !== x1) g.fillRect(Math.min(x0, x1) + CELL - 5, y0 + CELL / 2 - 9, 10, 18);
        else g.fillRect(x0 + CELL / 2 - 9, Math.min(y0, y1) + CELL - 5, 18, 10);
        g.fillStyle = fl[1];
        if (x0 !== x1) { g.fillRect(Math.min(x0, x1) + CELL - 5, y0 + CELL / 2 - 9, 10, 1); }
        else { g.fillRect(x0 + CELL / 2 - 9, Math.min(y0, y1) + CELL - 5, 1, 10); }
      }
    }
    // the entrance opens to daylight at the edge of the grid
    const [ex, ey] = this.cellXY(...ENT);
    g.fillStyle = "#c8b890";
    if (this.portrait) g.fillRect(ex + 22, ey - 12, 20, 16); else g.fillRect(ex - 12, ey + 22, 16, 20);
    g.fillStyle = "#fff0c8";
    if (this.portrait) g.fillRect(ex + 26, ey - 12, 12, 10); else g.fillRect(ex - 12, ey + 26, 10, 12);
    this.roomsDirty = false;
  }
  floorOf(type) { return this.mode === "golden" ? GOLD_FLOOR : FLOOR[type] ?? FLOOR.hall; }

  drawRoom(g, run, rm, c, r) {
    const [x, y] = this.cellXY(c, r), fl = this.floorOf(rm.type);
    // walls: lit top edge, dark sides
    g.fillStyle = "#3a2e58"; g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    g.fillStyle = "#4a3c6e"; g.fillRect(x + 1, y + 1, CELL - 2, 3);
    g.fillStyle = fl[0]; g.fillRect(x + 5, y + 6, CELL - 10, CELL - 11);
    // 32px tiles, quartered
    g.fillStyle = fl[1];
    g.fillRect(x + 5, y + 6 + 26, CELL - 10, 1); g.fillRect(x + 5 + 27, y + 6, 1, CELL - 11);
    for (let i = 0; i < 10; i++) {
      const h = hash(c, r, i);
      g.fillStyle = h > 0.5 ? fl[2] : fl[1];
      g.fillRect(x + 7 + Math.floor(hash(r, c, i) * 48), y + 8 + Math.floor(h * 46), 2, 1);
    }
    const P = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(x + px, y + py, w, h); };
    switch (rm.type) {
      case "entrance":
        for (let i = 0; i < 4; i++) P(10, 12 + i * 10, 44, 6, i % 2 ? "#3a3448" : "#4a4458");
        break;
      case "heart":
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; for (let k = 8; k < 26; k++) P(32 + Math.cos(a + k * 0.05) * k | 0, 34 + Math.sin(a + k * 0.05) * k * 0.8 | 0, 1, 1, "#6a1a34"); }
        break;
      case "water":
        P(8, 10, 48, 44, "#1e4a8a");
        for (let i = 0; i < 9; i++) P(10 + ((hash(c, i) * 40) | 0), 12 + ((hash(i, r) * 38) | 0), 6, 1, "#3a7ac8");
        break;
      case "treasure":
        P(36, 30, 18, 12, "#8a5a20"); P(36, 30, 18, 4, "#b07a2c"); P(43, 34, 4, 3, "#ffe07a");
        for (let i = 0; i < 14; i++) P(10 + ((hash(c, r, i) * 24) | 0), 40 + ((hash(i, c) * 12) | 0), 2, 2, i % 3 ? "#e8b23a" : "#ffe07a");
        break;
      case "nest":
        for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; P(32 + Math.cos(t) * 18 | 0, 40 + Math.sin(t) * 9 | 0, 3, 2, a % 2 ? "#8a6a3a" : "#b08a4a"); }
        break;
      case "web":
        for (const [sx, sy, dx, dy] of [[6, 7, 1, 1], [57, 7, -1, 1]]) for (let k = 0; k < 16; k++) { P(sx + dx * k, sy + dy * k, 1, 1, "#c8c8dc"); P(sx + dx * k, sy, 1, 1, "#9a9ab0"); P(sx, sy + dy * k, 1, 1, "#9a9ab0"); }
        break;
      case "lava":
        for (let i = 0; i < 6; i++) { let px = 8 + hash(c, i) * 48, py = 10 + hash(i, r) * 40; for (let k = 0; k < 9; k++) { P(px | 0, py | 0, 2, 1, "#c83a10"); px += hash(k, i) * 4 - 2; py += 1; } }
        break;
      case "icecave":
        for (let i = 0; i < 5; i++) { const px = 8 + ((hash(c, r, i) * 44) | 0); P(px, 14, 3, 8, "#9ad8ff"); P(px + 1, 10, 1, 4, "#e0f6ff"); }
        break;
      case "altar":
        P(22, 26, 20, 16, "#5a4a90"); P(22, 26, 20, 3, "#7a6ab0"); P(29, 16, 6, 10, "#c89aff"); P(31, 14, 2, 2, "#ffffff");
        break;
      case "dark":
        for (let i = 0; i < 20; i++) P(6 + ((hash(c, r, i) * 50) | 0), 8 + ((hash(i, r, c) * 46) | 0), 3, 1, "#2a1a44");
        break;
      case "mushroom":
        for (let i = 0; i < 6; i++) { const px = 8 + ((hash(c, r, i) * 44) | 0), py = 12 + ((hash(i, c) * 38) | 0); P(px + 1, py + 2, 2, 3, "#e8dcc8"); P(px - 1, py, 6, 3, i % 2 ? "#c83a5a" : "#8a4ac8"); P(px, py, 1, 1, "#ffffff"); }
        break;
      case "library":
        for (let i = 0; i < 3; i++) { P(8 + i * 17, 7, 15, 14, "#4a3020"); for (let k = 0; k < 6; k++) P(9 + i * 17 + k * 2, 9, 2, 10, ["#a02a2a", "#2a5aa0", "#3a8a3a", "#c8a040"][k % 4]); }
        break;
      case "sealed":
        P(18, 8, 28, 40, "#5a4a30"); P(20, 10, 24, 36, "#3a2e1e"); P(30, 24, 4, 6, "#c8a040"); P(31, 10, 2, 36, "#2a2014");
        break;
      case "secret":
        P(8, 7, 48, 10, "#6a4a2a");
        for (let k = 0; k < 18; k++) P(9 + k * 2.6, 9, 2, 7, ["#a0602a", "#6a3a1a", "#c89a5a"][k % 3]);
        P(14, 40, 3, 6, "#f0e0c0"); P(46, 38, 3, 8, "#f0e0c0");
        break;
    }
  }

  // ---- monsters keep a live critter effect each
  monFx(m) {
    let it = this.mons.get(m.id);
    if (!it) {
      const sp = MON.species[m.species] ?? MON.species.slime;
      const opts = { seed: m.id * 13 };
      if (m.palette) opts.palette = m.palette;
      if (m.species === "slime") opts.hop = 8;
      if (m.species === "ghost") opts.hover = 5;
      if (m.species === "wisp") opts.hover = 8;
      const fx = createFx(FX[sp.fx], opts);
      fx.update(Math.random() * 2);
      it = { fx, flip: m.slot === 1 };
      this.mons.set(m.id, it);
    }
    return it;
  }

  // ---- events from the rules
  onEvent(e, run) {
    const at = (c, r, dy = 0) => { const [x, y] = this.gw(c, r); return [x, y + dy]; };
    const advById = (id) => run.advs.find((a) => a.id === id);
    switch (e.t) {
      case "dmg": {
        const [x, y] = this.gw(e.x, e.y);
        this.number(x, y, e.amount, e.el, e.boosted);
        if (!e.dot && Math.random() < 0.6) this.spawn("hitSpark", x, y - 4, { palette: PAL[e.el] ?? PAL.physical, height: 10 }, "over");
        break;
      }
      case "trap": this.trapFx(e, run); break;
      case "spell": this.spellFx(e); break;
      case "death": {
        const [x, y] = this.gw(e.x, e.y);
        const fx0 = e.from ? this.gw(...e.from)[0] : x - (Math.random() < 0.5 ? 1 : -1);
        const dir = Math.sign(x - fx0) || (Math.random() < 0.5 ? -1 : 1);
        const pow = e.boss ? 0.6 : e.big ? 1.7 : 1.1;
        // the body gets thrown, spins, bounces once, then pops into stars and coins
        this.corpses.push({ spr: chibi(e.cls === "boss" ? "boss" : e.cls, 0, "scared"), k: e.boss ? 2 : 1, x, y: y + 10, h: 4, vx: dir * (45 + Math.random() * 45) * pow, vh: (110 + Math.random() * 70) * pow, rot: 0, vr: dir * (7 + Math.random() * 7) * pow, bounces: 0, age: 0 });
        if (e.execute) this.spawn("necro", x, y + 10, {}, "over", 1.2);
        if (e.big) this.stop(0.06);
        if (e.boss) { this.spawn("bigBoom", x, y + 10, {}, "over"); this.shake = 0.9; this.flash = 0.6; this.stop(0.35); this.slowmo(1.6); this.impact(x, y, 1.2); this.punch(x, y, 0.5); }
        if (e.last) { this.slowmo(1.1); this.punch(x, y, 0.35); this.impact(x, y, 0.6); }
        this.light(x, y, 40, "255,220,120", 0.5);
        break;
      }
      case "roar": {
        const [x, y] = this.gw(...HEART);
        for (let i = 0; i < 3; i++) this.rings.push({ x, y, age: -i * 0.12, dur: 0.9, r: 420 });
        this.flash = 0.45; this.flashColor = "255,60,90"; this.shake = 0.8; this.stop(0.14); this.slowmo(0.9); this.impact(x, y, 0.9); this.punch(x, y, 0.4);
        this.spawn("darkBoom", x, y + 16, { palette: ["#12040a", "#360814", "#64101e", "#a01c2c", "#e03a44", "#ff8a8a", "#ffe0e0", "#ffffff"] }, "over", 1.2);
        this.light(x, y, 160, "255,90,110", 1.2);
        break;
      }
      case "diary": {
        const [x, y] = this.gw(e.x, e.y);
        this.floaters.push({ x, y: y - 10, sprite: diaryPage(), age: 0, vy: 8, sway: true, life: 2.2 });
        break;
      }
      case "heartHit": {
        const [x, y] = at(...HEART, 0);
        this.redPulse = 0.6;
        this.spawn("hitSpark", x, y, { palette: PAL.blood, height: 12 }, "over");
        this.number(x, y - 6, e.amount, "fire", true);
        this.shake = Math.max(this.shake, 0.3);
        this.heartHurt = 0.4;
        break;
      }
      case "monAtk": {
        const [x, y] = this.gw(e.x, e.y);
        const m = run.monsters.find((q) => q.id === e.mid);
        if (m) {
          const [mx, my] = this.monXY(m);
          if (Math.abs(mx - x) > 40 || Math.abs(my - y) > 40) this.shoot(mx, my - 10, x, y - 8, "orb");
        }
        break;
      }
      case "advHit": {
        const m = run.monsters.find((q) => q.id === e.mid);
        if (m) { const [x, y] = this.monXY(m); this.spawn("hitSpark", x, y - 6, { palette: PAL.physical, height: 8, flip: true }, "over"); }
        break;
      }
      case "monDeath": {
        const m = this.mons.get(e.mid);
        this.mons.delete(e.mid);
        const [x, y] = this.gw(e.c, e.r);
        this.spawn("poof", x, y + 18, { palette: ["#2a2440", "#4a3a5a", "#7a6a8a", "#a89ab8", "#d8d0e8", "#ffffff"] }, "over");
        break;
      }
      case "summon": { const [x, y] = this.monXY(e.m); this.spawn("poof", x, y, { palette: PAL.arcane.slice(0, 6) }, "over"); this.light(x, y, 30, "200,140,255", 0.4); break; }
      case "place": { const [x, y] = at(e.c, e.r, 8); this.spawn("collect", x, y, { palette: ["#04141a", "#0a3a44", "#127a86", "#1fb8c4", "#4fe0e8", "#a8fff8", "#e0ffff", "#ffffff"] }, "over"); this.roomsDirty = true; break; }
      case "room": { const [x, y] = at(e.c, e.r, 20); this.spawn("dirtBoom", x, y, {}, "over", 0.9); this.shake = 0.25; this.roomsDirty = true; break; }
      case "secret": { const [x, y] = at(e.c, e.r, 20); this.spawn("lootBeam", x, y, { palette: ["#06142a", "#0c2a52", "#1a4a8a", "#2a7ac8", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"] }, "over", 3.5); this.roomsDirty = true; this.light(x, y, 50, "120,180,255", 2); break; }
      case "wallHit": { const [x, y] = at(e.c, e.r, 4); this.spawn("bluntHit", x, y, {}, "over"); break; }
      case "wallBreak": { const [x, y] = at(e.c, e.r, 16); this.spawn("dirtBoom", x, y, {}, "over", 1); this.roomsDirty = true; this.shake = 0.3; break; }
      case "disarmed": { const [x, y] = at(e.c, e.r, 0); this.spawn("poof", x, y, {}, "over"); this.floatText(x, y - 20, "함정 해제됨", "warn"); break; }
      case "heal": { const [x, y] = this.gw(e.x, e.y); this.spawn("collect", x, y, { palette: ["#1a1004", "#3e2808", "#6e4a10", "#b07a1c", "#e8b23a", "#ffe07a", "#fff8d8", "#ffffff"] }, "over"); break; }
      case "fx":
        if (e.id === "heal") { const [x, y] = at(e.c, e.r, 16); this.spawn("healAoe", x, y, {}, "over"); this.light(x, y, 50, "255,200,200", 1); }
        if (e.id === "rage") { const [x, y] = at(e.c, e.r, 16); this.spawn("runeCircle", x, y, { palette: PAL.blood }, "over", 1.4); }
        if (e.id === "monHeal") { const [x, y] = at(e.c, e.r, 14); this.spawn("collect", x, y, { palette: ["#0a1f2e", "#0f3d52", "#14707e", "#1fa8a8", "#4fe0c8", "#a8fff0", "#e0fff8", "#ffffff"] }, "over"); }
        break;
      case "loot": { const a = advById(e.id); if (a) { const [x, y] = this.advXY(a); this.spawn("coinSpin", x, y - 26, {}, "over", 1.2); } break; }
      case "spawn": { const [x, y] = at(...ENT, 14); this.spawn("poof", x, y, {}, "over"); if (e.boss) { this.shake = 0.5; } break; }
      case "shriek": { const m = run.monsters.find((q) => q.id === e.mid); if (m) { const [x, y] = this.monXY(m); this.floatText(x, y - 26, "끼야아악!", "shriek"); } break; }
      case "synergy": { const [x, y] = at(e.c, e.r, -18); this.floatText(x, y, e.text, "synergy"); break; }
      case "scare": break;
    }
  }

  trapFx(e, run) {
    const [cx, cy] = this.gw(e.c, e.r);
    const d = CARDS[e.id];
    const targets = (e.targets ?? (e.target ? [e.target] : [])).map((id) => run.advs.find((a) => a.id === id)).filter(Boolean);
    const tp = targets.map((a) => this.advXY(a));
    const [ix, iy] = this.iconXY(e.c, e.r);
    switch (e.id) {
      case "spike": this.spikeT = this.spikeT ?? {}; this.spikeT[key(e.c, e.r)] = 0.35; break;
      case "boulder": for (const [x, y] of tp) { this.floaters.push({ x, y: y - 50, boulder: true, age: 0, vy: 220, life: 0.25 }); this.spawn("bluntHit", x, y - 2, {}, "over"); } this.shake = 0.3; break;
      case "zap":
      case "tesla": {
        let [px, py] = [ix + 12, iy + 4];
        for (const [x, y] of tp) {
          this.bolt(px, py, x, y - 10, e.chained ? "#ffffff" : "#bfe8ff");
          this.spawn("zapHit", x, y - 4, {}, "over");
          if (e.id === "tesla") [px, py] = [x, y - 10];
        }
        if (e.chained) { this.flash = 0.12; this.flashColor = "200,220,255"; this.light(cx, cy, 60, "150,190,255", 0.35); if (tp.length >= 3) { this.stop(0.05); this.shake = Math.max(this.shake, 0.3); } }
        break;
      }
      case "flame": this.spawn("flamethrower", cx - 26, cy + 10, { reach: 52 }, "over", 0.9); this.light(cx, cy, 50, "255,150,60", 0.6); break;
      case "frost": this.spawn("snowflake", cx, cy + 16, { count: 6 }, "over"); this.light(cx, cy, 40, "150,220,255", 0.5); break;
      case "gas": break;
      case "arrow": for (const [x, y] of tp) this.shoot(ix + 12, iy + 8, x, y - 10, "arrow"); break;
      case "crystal": for (const [x, y] of tp) this.shoot(ix + 12, iy + 4, x, y - 10, "orb"); break;
      case "totem": this.pulses = this.pulses ?? []; this.pulses.push({ x: cx, y: cy + 8, age: 0 }); break;
    }
    if (d?.fear) for (const [x, y] of tp) if (Math.random() < 0.3) this.floatText(x, y - 30, "덜덜", "fear");
  }
  spellFx(e) {
    const [x, y] = this.gw(e.c, e.r);
    const big = e.id.startsWith("pro_");
    switch (e.id) {
      case "strike": case "pro_judge": this.spawn("lightningStrike", x, y + 20, {}, "over", 1.8); this.shake = 0.6; this.flash = 0.3; this.stop(0.09); this.impact(x, y, 0.5); break;
      case "meteor": case "pro_meteor": this.spawn("meteorFx", x, y + 20, {}, "over", 2.6); this.shake = 0.8; this.stop(0.08); this.impact(x, y, 0.6); break;
      case "pro_pillar": this.spawn("flamePillar", x, y + 24, {}, "over", 2.4); this.shake = 0.5; break;
      case "nova": this.spawn("iceSpikes", x, y + 20, {}, "over", 1.6); this.spawn("snowflake", x, y + 16, {}, "over"); this.shake = 0.3; break;
      case "scream": this.spawn("necro", x, y + 18, {}, "over", 1.6); this.floatText(x, y - 24, "우오오오…", "fear"); break;
    }
    this.light(x, y, big ? 90 : 60, "255,230,180", 0.8);
  }
  iconXY(c, r) { const [x, y] = this.cellXY(c, r); return [x + 20, y + 14]; }

  // ---- the frame
  update(dt) {
    this.t += dt;
    for (const it of this.fx) { it.fx.update(dt); it.age += dt; if (it.dur && it.age >= it.dur) it.fx.stop(); }
    this.fx = this.fx.filter((it) => !it.fx.done());
    for (const n of this.nums) n.age += dt;
    this.nums = this.nums.filter((n) => n.age < 0.9);
    for (const f of this.floaters) f.age += dt;
    this.floaters = this.floaters.filter((f) => f.age < (f.life ?? 1.3));
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const s of this.shots) s.t += dt;
    for (const s of this.shots) if (s.t >= s.dur && !s.hit) { s.hit = true; this.spawn("hitSpark", s.x1, s.y1 + 6, { palette: s.kind === "orb" ? PAL.arcane : PAL.physical, height: 6 }, "over"); }
    this.shots = this.shots.filter((s) => s.t < s.dur);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter((l) => l.life > 0);
    if (this.pulses) { for (const p of this.pulses) p.age += dt; this.pulses = this.pulses.filter((p) => p.age < 0.8); }
    if (this.spikeT) for (const k in this.spikeT) this.spikeT[k] -= dt;
    for (const c of this.corpses) {
      c.age += dt; c.vh -= 480 * dt; c.h += c.vh * dt; c.x += c.vx * dt; c.rot += c.vr * dt;
      if (c.h <= 0 && c.age > 0.05) {
        c.h = 0;
        if (c.bounces++ === 0) { c.vh = Math.abs(c.vh) * 0.35; c.vx *= 0.45; c.vr *= 0.5; }
        else c.done = true;
      }
      if (c.done) {
        this.spawn("poof", c.x, c.y, {}, "over");
        this.spawn("coinDrop", c.x, c.y, {}, "over");
        this.floaters.push({ x: c.x, y: c.y - 16, sprite: angryGhost(), age: 0, vy: -26, life: 1.4 });
      }
    }
    this.corpses = this.corpses.filter((c) => !c.done && c.age < 4);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.dur);
    if (this.focus) { this.focus.age += dt; if (this.focus.age > this.focus.dur) this.focus = null; }
    this.redPulse = Math.max(0, this.redPulse - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.heartHurt = Math.max(0, (this.heartHurt ?? 0) - dt);
    this.night += (this.nightTarget - this.night) * Math.min(1, dt * 1.5);
  }

  draw(run, ui = {}) {
    const g = this.g;
    if (this.roomsDirty) this.renderRooms(run);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.roomCv, 0, 0);

    const lowHp = run.heart.hp / Math.max(1, run.heart.max);
    const bpm = 60 + (1 - lowHp) * 90 + (run.phase === "wave" ? 20 : 0);
    this.beat += (bpm / 60) * (1 / 60);
    const ph = this.beat % 1, pulse = ph < 0.12 ? ph / 0.12 : ph < 0.3 ? 1 - (ph - 0.12) / 0.18 : 0;
    const breath = Math.sin(this.t * 1.4) * 0.5 + 0.5;
    this.drawLiving(run, pulse, breath);
    this.drawCards(run);

    // under layer: critters, puddles
    clearFrame(this.under);
    let underUsed = false;
    for (const [k, rm] of run.rooms.entries()) {
      if (rm?.card?.id === "gas" && !(rm.card.disabledT > 0)) {
        let a = this.ambient.get(k);
        if (!a) { a = createFx(toxicPuddle, { width: 30, seed: k }); this.ambient.set(k, a); }
        a.update(1 / 60);
        const [x, y] = this.gw(k % COLS, (k / COLS) | 0);
        a.options.x = x; a.options.y = y + 18;
        a.draw(this.under); underUsed = true;
      }
    }
    const alive = new Set();
    for (const m of run.monsters) {
      if (m.hp <= 0) continue;
      alive.add(m.id);
      const it = this.monFx(m);
      it.fx.update(1 / 60 * (m.atkT > 0 ? 3 : 1));
      const [x, y] = this.monXY(m);
      it.fx.options.x = x; it.fx.options.y = y; it.fx.options.flip = it.flip;
      it.fx.draw(this.under);
      underUsed = true;
    }
    for (const id of this.mons.keys()) if (!alive.has(id)) this.mons.delete(id);
    for (const it of this.fx) if (it.layer === "under") { it.fx.draw(this.under); underUsed = true; }
    if (underUsed) this.blit(this.under, this.underImg, this.underCv);

    // mutant monsters get a rainbow rim; everyone gets a tiny health bar
    for (const m of run.monsters) {
      if (m.hp <= 0) continue;
      const [x, y] = this.monXY(m);
      if (m.mutant) { g.fillStyle = `hsl(${(this.t * 200) % 360},90%,65%)`; g.fillRect(x - 6, y + 3, 12, 1); }
      if (m.hp < m.max) this.bar(x - 7, y + 5, 14, m.hp / m.max, "#6af07a");
      if (m.hitT > 0) { g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(x - 8, y - 14, 16, 16); }
    }

    // adventurers, back to front
    const advs = run.advs.filter((a) => !a.dead && !a.out).sort((p, q) => this.advXY(p)[1] - this.advXY(q)[1]);
    for (const a of advs) this.drawAdv(a, run);
    for (const s of this.shots) this.drawShot(s);
    for (const f of this.floaters) this.drawFloater(f);
    for (const c of this.corpses) this.drawCorpse(c);

    // darkness with holes for every light
    this.drawDark(run, pulse);

    // over layer: hits, spells
    clearFrame(this.over);
    let overUsed = false;
    for (const it of this.fx) if (it.layer === "over") { it.fx.draw(this.over); overUsed = true; }
    if (overUsed) this.blit(this.over, this.overImg, this.overCv);
    for (const b of this.bolts) this.drawBolt(b);
    if (this.pulses) for (const p of this.pulses) { g.strokeStyle = `rgba(160,130,255,${1 - p.age / 0.8})`; g.lineWidth = 1; g.beginPath(); g.ellipse(p.x, p.y, 6 + p.age * 40, 3 + p.age * 18, 0, 0, Math.PI * 2); g.stroke(); }
    for (const r of this.rings) this.drawRing(r);
    for (const n of this.nums) this.drawNum(n);

    // ui highlights
    this.drawHighlights(run);
    if (this.mode === "golden") {
      // the golden age: warm light and drifting motes
      g.fillStyle = "rgba(255,214,140,0.10)"; g.fillRect(0, 0, this.W, this.H);
      g.fillStyle = "rgba(255,240,190,0.85)";
      for (let i = 0; i < 40; i++) { const x = (hash(i, 1) * this.W + this.t * (6 + hash(i, 2) * 10)) % this.W, y = (hash(i, 3) * this.H - this.t * (4 + hash(i, 4) * 6) + this.H * 10) % this.H; if ((this.t * 3 + i) % 4 < 3) g.fillRect(x | 0, y | 0, 1, 1); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  blit(frame, img, cv) {
    composite(frame, img.data, null);
    cv.getContext("2d").putImageData(img, 0, 0);
    this.g.drawImage(cv, 0, 0);
  }

  drawLiving(run, pulse, breath) {
    const g = this.g;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm) continue;
      const [x, y] = this.cellXY(c, r);
      // walls breathe in and out by a pixel
      const b = breath > 0.5 ? 1 : 0;
      g.fillStyle = "#3a2e58";
      g.fillRect(x + 5, y + 6, CELL - 10, b); g.fillRect(x + 5, y + CELL - 5 - b, CELL - 10, b);
      g.fillRect(x + 5, y + 6, b, CELL - 11); g.fillRect(x + CELL - 5 - b, y + 6, b, CELL - 11);
      // cracks in the floor glow with the heartbeat
      g.fillStyle = `rgba(230,40,80,${0.15 + pulse * 0.45})`;
      for (let i = 0; i < 6; i++) {
        let px = x + 8 + hash(c, r, i + 40) * 46, py = y + 10 + hash(r, c, i + 40) * 42;
        for (let k = 0; k < 4; k++) { g.fillRect(px | 0, py | 0, 1, 1); px += hash(i, k, c) > 0.5 ? 1 : -1; py += 1; }
      }
      if (rm.type === "water") {
        g.fillStyle = "rgba(140,200,255,0.5)";
        for (let i = 0; i < 6; i++) { const px = x + 10 + ((hash(c, i, r) * 40 + this.t * 6 * (i % 2 ? 1 : -1)) % 42 + 42) % 42; g.fillRect(px | 0, y + 12 + i * 7, 5, 1); }
      }
      if (rm.type === "lava") { g.fillStyle = `rgba(255,120,30,${0.25 + 0.2 * Math.sin(this.t * 3 + c)})`; g.fillRect(x + 6, y + 7, CELL - 12, CELL - 13); }
      if (rm.type === "dark") { g.fillStyle = "rgba(10,4,20,0.35)"; g.fillRect(x + 5, y + 6, CELL - 10, CELL - 11); }
      if (rm.type === "secret") { g.fillStyle = `rgba(120,180,255,${0.12 + 0.06 * Math.sin(this.t * 2)})`; g.fillRect(x + 5, y + 6, CELL - 10, CELL - 11); }
      // a little torch on each wall
      if (rm.type !== "water") {
        const tx = x + 50, ty = y + 5, f = Math.floor(this.t * 10 + c * 3 + r) % 3;
        g.fillStyle = "#5a3a1a"; g.fillRect(tx, ty + 2, 2, 4);
        g.fillStyle = "#ff8a2a"; g.fillRect(tx - (f === 1 ? 1 : 0), ty - 2, 2 + (f === 1 ? 1 : 0), 4);
        g.fillStyle = "#ffe26b"; g.fillRect(tx, ty - 1 - (f === 2 ? 1 : 0), 1 + (f === 0 ? 1 : 0), 2);
      }
      if (rm.type === "heart") {
        const hurt = this.heartHurt > 0 ? 1 : 0;
        const s = 9 + pulse * 2.5;
        const sp = heartSprite(s, hurt || (run.heart.hp / run.heart.max < 0.34 ? 1 : 0));
        g.drawImage(sp, Math.round(x + CELL / 2 - sp.width / 2), Math.round(y + CELL / 2 - sp.height / 2));
      }
    }
  }

  drawCards(run) {
    const g = this.g;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm?.card) continue;
      const [ix, iy] = this.iconXY(c, r);
      const pop = this.spikeT?.[key(c, r)] > 0 ? -3 : 0;
      g.drawImage(cardIcon(rm.card.id), ix, iy + pop);
      if (rm.card.disabledT > 0) {
        g.fillStyle = "rgba(20,12,28,0.6)"; g.fillRect(ix, iy, 24, 24);
        g.fillStyle = "#ff6a4a"; for (let i = 0; i < 12; i++) { g.fillRect(ix + 6 + i, iy + 6 + i, 1, 1); g.fillRect(ix + 17 - i, iy + 6 + i, 1, 1); }
      }
      const d = CARDS[rm.card.id];
      if (d.hp) this.bar(ix + 2, iy + 25, 20, rm.card.hp / d.hp, "#4fe0e8");
    }
  }

  drawAdv(a, run) {
    const g = this.g;
    const [x, y] = this.advXY(a);
    const moving = a.next && a.frozenT <= 0;
    const frame = moving ? Math.floor(this.t * 6 + a.id) % 2 : 0;
    const mood = a.state === "flee" ? "scared" : "walk";
    const spr = chibi(a.skin ?? (a.boss ? "boss" : a.cls), frame, a.cheer ? "cheer" : mood);
    const k = a.boss ? 2 : 1;
    const w = spr.width * k, h = spr.height * k;
    const bob = moving && frame ? -1 : 0;
    const knock = a.hitT > 0 ? -this.faceOf(a) * (a.hitT / 0.18) * 5 : 0;
    // shadow
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(Math.round(x - 6 * k), Math.round(y - 1), 12 * k, 2);
    g.save();
    g.translate(Math.round(x + knock), Math.round(y + bob));
    if (this.faceOf(a) < 0) g.scale(-1, 1);
    g.drawImage(spr, -w / 2, -h, w, h);
    g.restore();
    if (a.hitT > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.7; g.save(); g.translate(Math.round(x), Math.round(y)); if (this.faceOf(a) < 0) g.scale(-1, 1); g.drawImage(spr, -w / 2, -h, w, h); g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    if (a.frozenT > 0) { g.fillStyle = "rgba(150,220,255,0.45)"; g.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h); }
    if (a.burnT > 0 && Math.floor(this.t * 12) % 2) { g.fillStyle = "#ff8a2a"; g.fillRect(Math.round(x - 3 + Math.random() * 6), Math.round(y - h + 4), 2, 2); }
    if (a.poisonT > 0 && Math.floor(this.t * 8) % 3 === 0) { g.fillStyle = "#a6f06a"; g.fillRect(Math.round(x + 4), Math.round(y - h - 1), 2, 2); }
    if (a.npc || a.cheer) return;
    // bars and badges
    const top = Math.round(y - h - 4);
    this.bar(Math.round(x - 8 * k), top, 16 * k, a.hp / a.max, a.boss ? "#ff4a5a" : "#f05a5a");
    if (a.state !== "flee") this.bar(Math.round(x - 8 * k), top + 3, 16 * k, Math.max(0, a.courage) / a.courageMax, "#9c86d0", 1);
    let gx = x - 8;
    for (const el of a.gear) { g.fillStyle = NUM_COL[el] ?? "#fff"; g.fillRect(Math.round(gx), top - 4, 3, 3); g.fillStyle = INK; g.fillRect(Math.round(gx) + 3, top - 4, 1, 3); gx += 5; }
    if (a.nemesis) this.tag(x, top - 10, "숙적", "#ff8a6a");
    if (a.state === "flee" && a.spare === null && !a.looter) this.tag(x, top - 10, "?", "#ffffff");
    if (a.spare === true) this.tag(x, top - 10, "♥", "#ff9ab0");
    if (a.disarmT > 0) { this.bar(Math.round(x - 8), top - 6, 16, 1 - a.disarmT / 1.6, "#ffe07a"); }
    if (a.lootT > 0) { g.fillStyle = "#ffe07a"; g.fillRect(Math.round(x - 1 + Math.sin(this.t * 10) * 6), top - 6, 2, 2); }
  }
  tag(x, y, text, col) {
    const g = this.g, w = textWidth(text === "♥" ? "+" : text.replace(/[^\x20-\x7e]/g, "AA"), "mini");
    if (/[^\x20-\x7e]/.test(text)) {
      g.font = "8px sans-serif"; g.textAlign = "center"; g.fillStyle = INK; g.fillText(text, Math.round(x) + 1, Math.round(y) + 1); g.fillStyle = col; g.fillText(text, Math.round(x), Math.round(y)); g.textAlign = "start";
      return;
    }
    this.pixText(Math.round(x - w / 2), Math.round(y - 5), text, col);
  }
  bar(x, y, w, f, col, h = 2) {
    const g = this.g;
    g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = "#3a2a3a"; g.fillRect(x, y, w, h);
    g.fillStyle = col; g.fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, f))), h);
  }
  pixText(x, y, text, col, scale = 1) {
    const g = this.g;
    g.fillStyle = INK;
    rasterText(text, "mini", (px, py) => g.fillRect(x + px * scale + 1, y + py * scale + 1, scale, scale));
    g.fillStyle = col;
    rasterText(text, "mini", (px, py) => g.fillRect(x + px * scale, y + py * scale, scale, scale));
  }
  drawNum(n) {
    // pop in big, settle, float up, blink out
    const base = n.big ? 3 : n.small ? 1 : 2;
    const k = n.age < 0.08 ? base + 1 : base, rise = n.age * 30, w = textWidth(n.txt, "mini") * k;
    if (n.age > 0.65 && Math.floor(n.age * 20) % 2) return;
    this.pixText(Math.round(n.x - w / 2), Math.round(n.y - rise - (k - 1) * 2), n.txt, n.col, k);
  }
  drawShot(s) {
    const g = this.g, t = Math.min(1, s.t / s.dur);
    const x = s.x0 + (s.x1 - s.x0) * t, y = s.y0 + (s.y1 - s.y0) * t - Math.sin(t * Math.PI) * (s.kind === "orb" ? 6 : 2);
    if (s.kind === "arrow") {
      const a = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
      g.fillStyle = "#e8e0d0";
      for (let i = 0; i < 6; i++) g.fillRect(Math.round(x - Math.cos(a) * i), Math.round(y - Math.sin(a) * i), 1, 1);
      g.fillStyle = "#4fe0e8"; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    } else {
      g.fillStyle = "#c684ff"; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      this.lights.push({ x, y, r: 14, color: "200,140,255", life: 0.05, max: 0.05 });
    }
  }
  drawBolt(b) {
    const g = this.g;
    g.strokeStyle = b.color; g.lineWidth = 1; g.globalAlpha = Math.min(1, (b.life / b.max) * 1.5);
    g.beginPath();
    b.pts.forEach(([x, y], i) => (i ? g.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5) : g.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5)));
    g.stroke();
    g.strokeStyle = "rgba(120,170,255,0.5)"; g.lineWidth = 3; g.stroke();
    g.globalAlpha = 1;
  }
  drawFloater(f) {
    const g = this.g;
    if (f.sprite) {
      const y = f.y + f.vy * f.age, x = f.x + (f.sway ? Math.sin(f.age * 5) * 6 : 0);
      g.globalAlpha = Math.max(0, 1 - f.age / (f.life ?? 1.3));
      g.drawImage(f.sprite, Math.round(x - f.sprite.width / 2), Math.round(y - f.sprite.height));
      g.globalAlpha = 1;
    } else if (f.boulder) {
      const y = f.y + f.vy * f.age;
      g.fillStyle = "#6e5a4a"; g.fillRect(Math.round(f.x - 5), Math.round(y - 5), 10, 9);
      g.fillStyle = "#8e7a66"; g.fillRect(Math.round(f.x - 3), Math.round(y - 4), 4, 3);
    }
  }

  drawDark(run, pulse) {
    const d = this.darkCv.getContext("2d");
    const night = this.night;
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, this.W, this.H);
    const base = this.mode === "golden" ? 0 : 0.1 + night * 0.34;
    if (base <= 0.01) return;
    d.fillStyle = `rgba(6,3,18,${base})`;
    d.fillRect(0, 0, this.W, this.H);
    d.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k = 1) => {
      const gr = d.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm) continue;
      const [x, y] = this.cellXY(c, r);
      hole(x + 51, y + 10, 30 + Math.sin(this.t * 9 + c) * 1.5, 0.7);
      hole(x + 32, y + 34, 30, 0.35);
      if (rm.card) hole(x + 32, y + 26, 16, 0.5);
      if (rm.type === "secret") hole(x + 32, y + 32, 30, 0.7);
      if (rm.type === "lava") hole(x + 32, y + 32, 34, 0.6);
    }
    const [hx, hy] = this.gw(...HEART);
    hole(hx, hy, 34 + pulse * 10, 0.9);
    for (const a of run.advs) if (!a.dead && !a.out) { const [x, y] = this.advXY(a); hole(x + 4, y - 14, 20, 0.7); }
    for (const m of run.monsters) if (m.hp > 0 && (m.species === "wisp" || m.traits.includes("불"))) { const [x, y] = this.monXY(m); hole(x, y - 8, 22, 0.7); }
    for (const l of this.lights) hole(l.x, l.y, l.r, Math.min(1, l.life / l.max));
    for (const it of this.fx) if (it.layer === "over" && it.age < 1.2) hole(it.fx.options.x, it.fx.options.y - 12, 34, 0.6);
    d.globalCompositeOperation = "source-over";
    this.g.drawImage(this.darkCv, 0, 0);
  }

  drawHighlights(run) {
    const g = this.g;
    const t = 0.5 + 0.5 * Math.sin(this.t * 6);
    for (const h of this.highlights) {
      const [x, y] = this.cellXY(h[0], h[1]);
      g.fillStyle = `rgba(79,224,232,${0.1 + 0.12 * t})`;
      g.fillRect(x + 4, y + 5, CELL - 8, CELL - 9);
      g.strokeStyle = `rgba(79,224,232,${0.5 + 0.4 * t})`;
      g.lineWidth = 1;
      g.strokeRect(x + 3.5, y + 4.5, CELL - 7, CELL - 8);
    }
    for (const h of this.range) {
      const [x, y] = this.cellXY(h[0], h[1]);
      g.fillStyle = "rgba(255,180,60,0.16)";
      g.fillRect(x + 4, y + 5, CELL - 8, CELL - 9);
    }
    if (this.hover) {
      const [x, y] = this.cellXY(this.hover[0], this.hover[1]);
      g.strokeStyle = this.hoverBad ? "rgba(255,90,90,0.9)" : "rgba(255,255,255,0.95)";
      g.lineWidth = 2;
      g.strokeRect(x + 3, y + 4, CELL - 6, CELL - 7);
    }
    if (this.breach != null) {
      const [x, y] = this.cellXY(this.breach % COLS, (this.breach / COLS) | 0);
      g.strokeStyle = `rgba(255,60,80,${0.5 + 0.5 * t})`; g.lineWidth = 2; g.strokeRect(x + 2, y + 3, CELL - 4, CELL - 5);
    }
  }

  /** The seal turning the world to stone, from the edges in. */
  drawGray() {
    const g = this.vg, V = this.view, k = Math.min(1, this.gray);
    const ix = (V.width / 2) * (1 - k) * 1.05, iy = (V.height / 2) * (1 - k) * 1.05;
    g.save();
    g.beginPath();
    g.rect(0, 0, V.width, V.height);
    if (k < 1) g.rect(V.width / 2 - ix, V.height / 2 - iy, ix * 2, iy * 2);
    g.clip("evenodd");
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "#808080";
    g.fillRect(0, 0, V.width, V.height);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(70,70,84,0.3)";
    g.fillRect(0, 0, V.width, V.height);
    g.restore();
  }
}

/** A small offscreen stage for a single effect, used by the hatching window. */
export function miniStage(canvas, makeFx) {
  const g = canvas.getContext("2d");
  const frame = createFrame(canvas.width, canvas.height);
  const img = new ImageData(canvas.width, canvas.height);
  let list = makeFx(createFx, FX) ?? [];
  return {
    add(fx) { list.push(fx); },
    tick(dt) {
      clearFrame(frame);
      for (const f of list) { f.update(dt); f.draw(frame); }
      list = list.filter((f) => !f.done?.() || f.meta?.loop);
      composite(frame, img.data, null);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.putImageData(img, 0, 0);
    },
  };
}

// ---------------------------------------------------------------- icons for the DOM
const iconCache = new Map();
/** A still of a monster, for cards and the breeding window. */
export function critterIcon(species, palette = null) {
  const k = species + ":" + (palette ? palette.join() : "");
  if (iconCache.has(k)) return iconCache.get(k);
  const W = 64, H = 56, frame = createFrame(W, H), img = new ImageData(W, H);
  const sp = MON.species[species] ?? MON.species.slime;
  const opts = { x: 32, y: 48 + (SPECIES_Y[species] ?? 0) * 0.5, seed: 3 };
  if (palette) opts.palette = palette;
  if (species === "slime") opts.hop = 0;
  if (species === "ghost" || species === "wisp") opts.hover = 0;
  const fx = createFx(FX[sp.fx], opts);
  fx.update(0.25);
  fx.draw(frame);
  composite(frame, img.data, null);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.getContext("2d").putImageData(img, 0, 0);
  iconCache.set(k, cv);
  return cv;
}
/** A room's floor, for room cards. */
export function roomIcon(type) {
  const k = "room:" + type;
  if (iconCache.has(k)) return iconCache.get(k);
  const cv = document.createElement("canvas");
  cv.width = CELL; cv.height = CELL;
  const g = cv.getContext("2d");
  const fake = { cellXY: () => [0, 0], floorOf: (t) => FLOOR[t] ?? FLOOR.hall, mode: "normal" };
  Renderer.prototype.drawRoom.call(fake, g, null, { type }, 3, 1);
  if (type === "sealed" || type === "secret") { g.fillStyle = "rgba(120,180,255,0.15)"; g.fillRect(5, 6, 54, 53); }
  iconCache.set(k, cv);
  return cv;
}
/** Copy a cached canvas so it can sit in the DOM more than once. */
export function cloneCanvas(src, cls = "") {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  if (cls) c.className = cls;
  return c;
}
