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
import * as holyPillar from "../../../src/fx/holy/holy-pillar.js";
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
  healAoe, sunburst, holyPillar, runeCircle, dirtBoom, bigBoom, firework, eggHatch, fireflies,
};

export const CELL = 64;
// the dungeon seen from the side: a strip of sky and ground on top, floors of rooms going down
const LAYOUT = { land: { CW: 96, CH: 72, MX: 36, SKY: 112, BOT: 44 }, port: { CW: 68, CH: 70, MX: 12, SKY: 104, BOT: 36 } };
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
/** A color a little brighter, so rooms stand out from the earth around them. */
const lift = (hex, k) => "#" + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, "0")).join("");
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
    this.impacts = []; this.rings = []; this.corpses = []; this.embers = []; this.chains = []; this.sealCircle = null; this.heartDead = false;
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
    Object.assign(this, portrait ? LAYOUT.port : LAYOUT.land);
    this.W = this.MX * 2 + COLS * this.CW;
    this.H = this.SKY + ROWS * this.CH + this.BOT;
    this.cv.width = this.W; this.cv.height = this.H;
    this.g.imageSmoothingEnabled = false;
    const mk = () => { const c = document.createElement("canvas"); c.width = this.W; c.height = this.H; return c; };
    this.roomCv = mk(); this.darkCv = mk(); this.underCv = mk(); this.overCv = mk();
    this.under = createFrame(this.W, this.H); this.over = createFrame(this.W, this.H);
    this.underImg = new ImageData(this.W, this.H); this.overImg = new ImageData(this.W, this.H);
    this.roomsDirty = true;
  }

  // ---- coordinates (side view: c is left to right, r is how deep the floor is)
  cellXY(c, r) { return [this.MX + c * this.CW, this.SKY + r * this.CH]; }
  /** The floor line of a row: where feet stand. Linear in r, so climbing between floors interpolates. */
  floorY(gy) { return this.SKY + gy * this.CH + this.CH - 9; }
  /** Grid coordinates (cell units, may be fractional) to a point at chest height in that room. */
  gw(gx, gy) { return [this.MX + gx * this.CW + this.CW / 2, this.floorY(gy) - 20]; }
  cellAt(x, y) {
    const c = Math.floor((x - this.MX) / this.CW), r = Math.floor((y - this.SKY) / this.CH);
    return c >= 0 && r >= 0 && c < COLS && r < ROWS ? [c, r] : null;
  }
  /** World pixel of an adventurer's feet. */
  advXY(a) {
    const [gx, gy] = advPos(a);
    const x = this.MX + gx * this.CW + this.CW / 2, y = this.floorY(gy);
    const climbing = a.next && a.next[1] !== a.cell[1];
    // a crowd spreads along the floor, a little in depth; on a ladder they queue up
    return climbing ? [x + a.lane * 3, y] : [x + a.lane * this.CW * 0.2, y + Math.round(a.lane * 2)];
  }
  /** Which way an adventurer faces on screen. */
  faceOf(a) {
    if (!a.next) return a.sface ?? 1;
    if (a.next[0] !== a.cell[0]) a.sface = a.next[0] > a.cell[0] ? 1 : -1;
    return a.sface ?? 1;
  }
  monXY(m) {
    const [x] = this.cellXY(m.c, m.r);
    const fx = [0.2, 0.8, 0.5][m.slot] ?? 0.5;
    return [Math.round(x + this.CW * fx), this.floorY(m.r) + (SPECIES_Y[m.species] ?? 0)];
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
    const add = (c, r) => { const [x, y] = this.cellXY(c, r); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + this.CW); y1 = Math.max(y1, y + this.CH); };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (run.rooms[key(c, r)]) add(c, r);
    for (const h of this.highlights) add(h[0], h[1]);
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: this.W, y1: this.H };
    // always keep a slice of the surface in view: the gate, the sky, the castle on the hill
    const m = this.portrait ? 4 : 14;
    return { x0: x0 - m, y0: Math.min(y0, this.SKY - 58), x1: x1 + m, y1: y1 + m };
  }
  worldToScreen(x, y) { return [(this.dx + x * this.dz) / this.dpr, (this.dy + y * this.dz) / this.dpr]; }
  screenToWorld(px, py) { return [(px * this.dpr - this.dx) / this.dz, (py * this.dpr - this.dy) / this.dz]; }

  present(run, dt) {
    const vg = this.vg, V = this.view, dpr = this.dpr;
    let tx, ty, tz, rate = 4;
    const o = this.camOverride;
    if (o) {
      tx = o.x; ty = o.y; tz = o.z; rate = o.speed ?? 2;
      // keep cinematic shots inside the world, unless the shot means to leave it (the dive)
      if (!o.free) {
        const hw = this.vw / (2 * tz), hh = this.vh / (2 * tz);
        tx = this.W > hw * 2 ? Math.max(hw, Math.min(this.W - hw, tx)) : this.W / 2;
        ty = this.H > hh * 2 ? Math.max(hh, Math.min(this.H - hh, ty)) : this.H / 2;
      }
    }
    else {
      const b = this.bounds(run);
      tx = (b.x0 + b.x1) / 2; ty = (b.y0 + b.y1) / 2;
      tz = Math.max(0.6, Math.min(3.6, this.vw / (b.x1 - b.x0), this.vh / (b.y1 - b.y0)));
      // in a fight the camera comes down close and follows the intruders, like a game screen;
      // picking a card pulls it back out so every room is in reach
      const act = run && run.phase === "wave" && this.follow !== false && !this.highlights.length ? run.advs.filter((a) => !a.dead && !a.out && !a.npc) : [];
      if (act.length) {
        let mx = 0, my = 0;
        for (const a of act) { const [x, y] = this.advXY(a); mx += x; my += y; }
        mx /= act.length; my /= act.length;
        tz = Math.min(3.4, Math.max(tz * 1.5, this.portrait ? 1.7 : 2.4));
        const hw = this.vw / (2 * tz), hh = this.vh / (2 * tz);
        tx = b.x1 - b.x0 > hw * 2 ? Math.max(b.x0 + hw, Math.min(b.x1 - hw, mx)) : (b.x0 + b.x1) / 2;
        ty = b.y1 - b.y0 > hh * 2 ? Math.max(b.y0 + hh, Math.min(b.y1 - hh, my - 16)) : (b.y0 + b.y1) / 2;
        rate = 2.2;
      }
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
  /** The seal: a vast turning circle of runes over the dungeon, and chains from the sky into the heart. */
  drawSeal() {
    const g = this.g, sc = this.sealCircle;
    if (sc) {
      const t = Math.min(1, sc.age / 3), R = sc.r * (1 - Math.pow(1 - t, 3)), a = Math.min(1, sc.age);
      g.save();
      g.shadowColor = "#7ad8ff"; g.shadowBlur = 6;
      g.strokeStyle = `rgba(180,230,255,${0.85 * a})`; g.lineWidth = 1;
      for (const k of [1, 0.86, 0.55]) { g.beginPath(); g.ellipse(sc.x, sc.y, R * k, R * k * 0.62, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = `rgba(200,240,255,${0.9 * a})`;
      for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2 + sc.age * 0.25, rr = R * 0.93;
        g.fillRect(Math.round(sc.x + Math.cos(ang) * rr), Math.round(sc.y + Math.sin(ang) * rr * 0.62), i % 5 ? 1 : 3, i % 5 ? 3 : 2);
      }
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const ang = ((i * 2) / 6) * Math.PI * 2 - sc.age * 0.4, p = [sc.x + Math.cos(ang) * R * 0.55, sc.y + Math.sin(ang) * R * 0.55 * 0.62];
        i ? g.lineTo(...p) : g.moveTo(...p);
      }
      g.stroke();
      g.restore();
    }
    for (const ch of this.chains) {
      const len = Math.hypot(ch.x1 - ch.x0, ch.y1 - ch.y0) * ch.t, ang = Math.atan2(ch.y1 - ch.y0, ch.x1 - ch.x0);
      for (let d = 0, i = 0; d < len; d += 5, i++) {
        const x = Math.round(ch.x0 + Math.cos(ang) * d), y = Math.round(ch.y0 + Math.sin(ang) * d);
        g.fillStyle = "#14161f"; g.fillRect(x - 2, y - 2, 5, 5);
        g.fillStyle = i % 2 ? "#c8d0e0" : "#8a92a8";
        if (i % 2) g.fillRect(x - 1, y - 2, 3, 4); else g.fillRect(x - 2, y - 1, 4, 3);
        g.fillStyle = "#14161f"; g.fillRect(x, y, 1, 1);
      }
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
    const g = this.roomCv.getContext("2d"), W = this.W, H = this.H, SKY = this.SKY, CW = this.CW, CH = this.CH;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const gold = this.mode === "golden";
    // far hills and the king's castle against the sky (the sky itself is painted live, for day and night)
    g.fillStyle = gold ? "#c8945a" : "#1c1634";
    for (let x = 0; x < W; x++) { const hgt = 22 + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.053 + 1) * 4; g.fillRect(x, SKY - 14 - hgt, 1, hgt); }
    const cx = Math.round(W * 0.74), base = SKY - 30;
    g.fillStyle = gold ? "#a8744a" : "#120e24";
    for (const [dx, w, hgt] of [[-26, 10, 30], [-14, 30, 20], [16, 10, 34], [-4, 8, 42]]) {
      g.fillRect(cx + dx, base - hgt, w, hgt);
      for (let k = 0; k < w; k += 3) g.fillRect(cx + dx + k, base - hgt - 2, 2, 2);
    }
    g.fillStyle = gold ? "#fff0b0" : "#ffcc5a";
    for (const [dx, dy] of [[-22, -20], [20, -26], [-8, -12], [2, -14], [-1, -34]]) g.fillRect(cx + dx, base + dy, 1, 2);
    // little houses of the village
    for (let i = 0; i < 6; i++) {
      const hx = Math.round(W * 0.42 + i * 13 + hash(i, 3) * 6), hh = 6 + ((hash(i, 4) * 5) | 0);
      g.fillStyle = gold ? "#b07a50" : "#16122a"; g.fillRect(hx, SKY - 14 - hh, 9, hh);
      g.fillRect(hx + 1, SKY - 16 - hh, 7, 2); g.fillRect(hx + 3, SKY - 18 - hh, 3, 2);
      if (hash(i, 5) > 0.4) { g.fillStyle = "#ffd070"; g.fillRect(hx + 3, SKY - 11 - hh / 2, 2, 2); }
    }
    // the ground: grass on top, then layers of earth that get darker and stranger with depth
    const soil = g.createLinearGradient(0, SKY - 10, 0, H);
    soil.addColorStop(0, gold ? "#5a3e24" : "#2a1c1c"); soil.addColorStop(0.5, gold ? "#3e2a1a" : "#1a1220"); soil.addColorStop(1, gold ? "#24180e" : "#0c0812");
    g.fillStyle = soil; g.fillRect(0, SKY - 10, W, H);
    for (let x = 0; x < W; x += 1) {
      const t = (hash(x, 9) * 3) | 0;
      g.fillStyle = gold ? "#7aa040" : "#2e4a2a"; g.fillRect(x, SKY - 14, 1, 5 + (t === 0 ? 1 : 0));
      if (t === 2) { g.fillStyle = gold ? "#a8d060" : "#4a7a3a"; g.fillRect(x, SKY - 15, 1, 2); }
    }
    for (let i = 0; i < 4; i++) {
      // strata
      const y0 = SKY + 6 + i * CH * 0.9 + CH * 0.35;
      g.fillStyle = "rgba(0,0,0,0.22)";
      for (let x = 0; x < W; x++) g.fillRect(x, Math.round(y0 + Math.sin(x * 0.04 + i * 2) * 3), 1, 2);
    }
    for (let y = SKY - 8; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        const h = hash(x, y, 7), depth = (y - SKY) / (H - SKY);
        if (h < 0.05) { g.fillStyle = h < 0.015 ? "#4a3a3a" : "#120c14"; g.fillRect(x, y, 2, 2); }
        else if (h > 0.9992 - depth * 0.002) { g.fillStyle = depth > 0.5 ? "#3ac8d8" : "#b8a890"; g.fillRect(x, y, 2, 1); }
      }
    // roots from the grass, bones deeper down
    g.fillStyle = gold ? "#6a4a2a" : "#3a2418";
    for (let i = 0; i < 18; i++) { let x = hash(i, 11) * W, y = SKY - 9; for (let k = 0; k < 14 + hash(i, 12) * 16; k++) { g.fillRect(x | 0, y | 0, 1, 1); x += hash(i, k) - 0.5; y += 1; } }
    g.fillStyle = "#8a8070";
    for (let i = 0; i < 7; i++) { const x = hash(i, 21) * W | 0, y = (SKY + CH * 1.5 + hash(i, 22) * (H - SKY - CH * 1.5)) | 0; g.fillRect(x, y, 5, 1); g.fillRect(x - 1, y - 1, 2, 3); g.fillRect(x + 4, y - 1, 2, 3); }

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const rm = run.rooms[key(c, r)]; if (rm) this.drawRoom(g, run, rm, c, r); }
    // doorways between neighbours on a floor, ladders between floors
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm) continue;
      const [x, y] = this.cellXY(c, r), FY = y + CH - 9, fl = this.floorOf(rm.type);
      if (roomAt(run, c + 1, r)) {
        const ox = x + CW - 6;
        g.fillStyle = fl[0]; g.fillRect(ox, FY - 30, 12, 30);
        g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(ox, FY - 30, 12, 4);
        g.fillStyle = "#1a1226"; g.fillRect(ox - 1, FY - 33, 14, 3);
        g.fillStyle = "#6a5a90"; g.fillRect(ox, FY, 12, 1);
        g.fillStyle = "#4a3c6e"; g.fillRect(ox, FY + 1, 12, 7);
      }
      if (roomAt(run, c, r + 1)) {
        const lx = x + CW / 2 - 7, FY2 = FY + CH;
        g.fillStyle = "#0a0712"; g.fillRect(lx, FY, 14, CH - 22 + 22 - 14);
        g.fillStyle = "#0a0712"; g.fillRect(lx, FY, 14, 16);
        g.fillStyle = "#8a6a3a"; g.fillRect(lx + 1, FY - 14, 2, FY2 - FY + 14); g.fillRect(lx + 11, FY - 14, 2, FY2 - FY + 14);
        g.fillStyle = "#b08a4a"; for (let yy = FY - 12; yy < FY2; yy += 5) g.fillRect(lx + 1, yy, 12, 1);
      }
    }
    // the gatehouse on the surface and the stairs down into the entrance room
    const [ex, ey] = this.cellXY(...ENT), gx = ex + CW / 2;
    g.fillStyle = "#0a0712"; g.fillRect(gx - 9, SKY - 10, 18, ey - SKY + 16);
    g.fillStyle = "#5a5068"; for (let i = 0; i < 6; i++) g.fillRect(gx - 9 + (i % 2) * 6, SKY - 6 + i * 4, 12, 2);
    g.fillStyle = gold ? "#d8c090" : "#4a4458"; g.fillRect(gx - 18, SKY - 46, 36, 34);
    g.fillStyle = gold ? "#f0e0b0" : "#5e5870"; g.fillRect(gx - 20, SKY - 50, 40, 5);
    for (let k = 0; k < 40; k += 6) g.fillRect(gx - 20 + k, SKY - 54, 4, 4);
    g.fillStyle = "#0a0712"; g.fillRect(gx - 8, SKY - 34, 16, 22); g.fillRect(gx - 6, SKY - 36, 12, 2);
    g.fillStyle = "#8a1a2a"; g.fillRect(gx - 16, SKY - 44, 5, 12); g.fillRect(gx + 11, SKY - 44, 5, 12);
    this.gateXY = [gx, SKY - 30];
    this.roomsDirty = false;
  }
  floorOf(type) { return this.mode === "golden" ? GOLD_FLOOR : FLOOR[type] ?? FLOOR.hall; }

  drawRoom(g, run, rm, c, r) {
    const CW = this.CW, CH = this.CH;
    const [x, y] = this.cellXY(c, r), fl = this.floorOf(rm.type).map((h) => lift(h, 1.35)), FY = y + CH - 9, iw = CW - 8;
    // the carved-out room: a stone frame, a brick back wall, a ceiling and a thick floor slab
    g.fillStyle = "#140e1e"; g.fillRect(x + 1, y + 1, CW - 2, CH - 2);
    g.fillStyle = fl[0]; g.fillRect(x + 4, y + 6, iw, FY - y - 6);
    g.fillStyle = fl[1];
    for (let yy = y + 6, row = 0; yy < FY; yy += 8, row++) {
      g.fillRect(x + 4, yy, iw, 1);
      for (let xx = x + 4 + (row % 2) * 7; xx < x + 4 + iw; xx += 14) g.fillRect(xx, yy, 1, 8);
    }
    for (let i = 0; i < 9; i++) { g.fillStyle = fl[2]; g.fillRect(x + 6 + ((hash(c, r, i) * (iw - 10)) | 0), y + 8 + ((hash(r, c, i) * (FY - y - 18)) | 0), 6, 1); }
    const sh = g.createLinearGradient(0, y + 6, 0, FY);
    sh.addColorStop(0, "rgba(0,0,0,0.45)"); sh.addColorStop(0.35, "rgba(0,0,0,0.05)"); sh.addColorStop(1, "rgba(0,0,0,0.25)");
    g.fillStyle = sh; g.fillRect(x + 4, y + 6, iw, FY - y - 6);
    g.fillStyle = "#3a2e58"; g.fillRect(x + 2, y + 2, CW - 4, 4);
    g.fillStyle = "#2a2040"; g.fillRect(x + 2, y + 5, CW - 4, 1);
    g.fillStyle = "#6a5a90"; g.fillRect(x + 2, FY, CW - 4, 1);
    g.fillStyle = "#4a3c6e"; g.fillRect(x + 2, FY + 1, CW - 4, 5);
    g.fillStyle = "#2a2040"; g.fillRect(x + 2, FY + 6, CW - 4, 2);
    const P = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
    const F = FY - y, M = CW / 2;
    switch (rm.type) {
      case "entrance":
        // daylight falling down the stairs from the gate
        g.fillStyle = "rgba(255,230,170,0.14)";
        g.beginPath(); g.moveTo(x + M - 8, y + 6); g.lineTo(x + M + 8, y + 6); g.lineTo(x + M + 22, FY); g.lineTo(x + M - 22, FY); g.fill();
        for (let i = 0; i < 4; i++) P(M - 10 + i * 2, 8 + i * 9, 20 - i * 4 + 8, 3, "#5a5068");
        break;
      case "heart":
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; for (let k = 10; k < 40; k++) P(M + Math.cos(a + k * 0.04) * k * 1.1, F * 0.48 + Math.sin(a + k * 0.04) * k * 0.6, 1, 1, "#6a1a34"); }
        P(M - 14, F - 6, 28, 6, "#5a1a2a"); P(M - 10, F - 8, 20, 2, "#7a2a3a");
        break;
      case "water":
        P(4, F - 20, iw, 20, "#1e4a8a"); P(4, F - 20, iw, 1, "#7ac0ff");
        for (let i = 0; i < 7; i++) P(8 + ((hash(c, i) * (iw - 12)) | 0), F - 16 + ((hash(i, r) * 12) | 0), 6, 1, "#3a7ac8");
        break;
      case "treasure":
        P(CW - 34, F - 12, 20, 12, "#8a5a20"); P(CW - 34, F - 12, 20, 4, "#b07a2c"); P(CW - 26, F - 8, 4, 3, "#ffe07a");
        for (let i = 0; i < 20; i++) { const px = 8 + hash(c, r, i) * 30, ph = 1 + ((hash(i, c) * 6) | 0); P(px, F - ph, 2, ph, i % 3 ? "#e8b23a" : "#ffe07a"); }
        break;
      case "nest":
        for (let a = 0; a < 30; a++) { const t = (a / 30) * Math.PI; P(M + Math.cos(t) * 22, F - 3 - Math.sin(t) * 6, 3, 2, a % 2 ? "#8a6a3a" : "#b08a4a"); }
        P(M - 20, F - 4, 40, 4, "#8a6a3a");
        P(M - 6, F - 10, 5, 6, "#f4ead0"); P(M + 2, F - 9, 5, 5, "#e8dcc0");
        break;
      case "web":
        for (const [sx, dx] of [[5, 1], [CW - 6, -1]]) for (let k = 0; k < 18; k++) { P(sx + dx * k, 7 + k, 1, 1, "#c8c8dc"); P(sx + dx * k, 7, 1, 1, "#9a9ab0"); P(sx, 7 + k, 1, 1, "#9a9ab0"); if (k % 6 === 5) for (let j = 0; j < k; j++) P(sx + dx * j, 7 + k, 1, 1, "#7a7a90"); }
        break;
      case "lava":
        P(4, F - 9, iw, 9, "#c83a10"); P(4, F - 9, iw, 2, "#ff8a2a");
        for (let i = 0; i < 5; i++) { let px = 8 + hash(c, i) * (iw - 10), py = 10; for (let k = 0; k < 10; k++) { P(px, py, 1, 2, "#8a2a10"); px += hash(k, i) * 3 - 1.5; py += 2; } }
        break;
      case "icecave":
        for (let i = 0; i < 9; i++) { const px = 6 + ((hash(c, r, i) * (iw - 6)) | 0), ln = 4 + ((hash(i, r) * 12) | 0); for (let k = 0; k < ln; k++) P(px + (k > ln * 0.6 ? 0.5 : 0), 6 + k, k < ln * 0.5 ? 3 : k < ln * 0.8 ? 2 : 1, 1, k < 2 ? "#e0f6ff" : "#9ad8ff"); }
        P(4, F - 2, iw, 2, "#bfe8ff");
        break;
      case "altar":
        P(M - 12, F - 16, 24, 16, "#5a4a90"); P(M - 14, F - 18, 28, 3, "#7a6ab0"); P(M - 3, F - 34, 6, 10, "#c89aff"); P(M - 1, F - 36, 2, 2, "#ffffff");
        break;
      case "dark":
        for (let i = 0; i < 24; i++) P(6 + ((hash(c, r, i) * (iw - 8)) | 0), 8 + ((hash(i, r, c) * (F - 12)) | 0), 3, 1, "#2a1a44");
        break;
      case "mushroom":
        for (let i = 0; i < 6; i++) { const px = 8 + ((hash(c, r, i) * (iw - 12)) | 0), hgt = 4 + ((hash(i, c) * 8) | 0); P(px + 1, F - hgt, 2, hgt, "#e8dcc8"); P(px - 2, F - hgt - 3, 7, 3, i % 2 ? "#c83a5a" : "#8a4ac8"); P(px, F - hgt - 3, 1, 1, "#ffffff"); }
        break;
      case "library":
        for (let i = 0; i < Math.floor(iw / 18); i++) { P(6 + i * 18, 10, 16, F - 12, "#4a3020"); for (let sy = 12; sy < F - 6; sy += 11) for (let k = 0; k < 7; k++) P(7 + i * 18 + k * 2, sy, 2, 9, ["#a02a2a", "#2a5aa0", "#3a8a3a", "#c8a040"][(k + sy) % 4]); }
        break;
      case "sealed":
        P(M - 16, 10, 32, F - 10, "#5a4a30"); P(M - 14, 12, 28, F - 12, "#3a2e1e"); P(M - 2, F * 0.5, 4, 6, "#c8a040"); P(M - 1, 12, 2, F - 12, "#2a2014");
        for (let k = 0; k < 3; k++) P(M - 14, 18 + k * 14, 28, 2, "#6a5a3a");
        break;
      case "secret":
        P(6, 10, iw - 4, 10, "#6a4a2a");
        for (let k = 0; k < (iw - 6) / 3; k++) P(7 + k * 3, 12, 2, 7, ["#a0602a", "#6a3a1a", "#c89a5a"][k % 3]);
        P(14, F - 8, 3, 8, "#f0e0c0"); P(CW - 18, F - 10, 3, 10, "#f0e0c0"); P(M - 10, F - 6, 20, 6, "#6a4a2a");
        break;
    }
  }

  // ---- monsters keep a live critter effect each
  monFx(m) {
    let it = this.mons.get(m.id);
    if (!it) {
      const sp = MON.species[m.species] ?? MON.species.slime;
      const opts = { seed: m.id * 13 };
      const pal = m.palette ?? sp.palette;
      if (pal) opts.palette = pal;
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
        this.corpses.push({ spr: chibi(e.cls === "boss" ? "boss" : e.cls, 0, "scared"), k: e.boss ? 2 : 1, x, y: y + 20, h: 4, vx: dir * (45 + Math.random() * 45) * pow, vh: (110 + Math.random() * 70) * pow, rot: 0, vr: dir * (7 + Math.random() * 7) * pow, bounces: 0, age: 0 });
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
      case "shriek": { const m = run.monsters.find((q) => q.id === e.mid); if (m) { const [x, y] = this.monXY(m); this.floatText(x, y - 26, "비명", "shriek"); } break; }
      case "synergy": { const [x, y] = at(e.c, e.r, -18); this.floatText(x, y, e.text, "synergy"); break; }
      case "scare": break;
    }
  }

  trapFx(e, run) {
    const [cx, cy] = this.gw(e.c, e.r);
    const d = CARDS[e.id];
    const targets = (e.targets ?? (e.target ? [e.target] : [])).map((id) => run.advs.find((a) => a.id === id)).filter(Boolean);
    const tp = targets.map((a) => this.advXY(a));
    const [ix, iy] = this.iconXY(e.c, e.r, d?.kind);
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
      case "flame": this.spawn("flamethrower", cx - this.CW / 2 + 6, cy + 12, { reach: this.CW - 24 }, "over", 0.9); this.light(cx, cy, 50, "255,150,60", 0.6); break;
      case "frost": this.spawn("snowflake", cx, cy + 16, { count: 6 }, "over"); this.light(cx, cy, 40, "150,220,255", 0.5); break;
      case "gas": break;
      case "arrow": for (const [x, y] of tp) this.shoot(ix + 12, iy + 8, x, y - 10, "arrow"); break;
      case "crystal": for (const [x, y] of tp) this.shoot(ix + 12, iy + 4, x, y - 10, "orb"); break;
      case "totem": this.pulses = this.pulses ?? []; this.pulses.push({ x: cx, y: cy + 8, age: 0 }); break;
    }
    if (d?.fear) for (const [x, y] of tp) if (Math.random() < 0.3) this.floatText(x, y - 30, "공포", "fear");
  }
  spellFx(e) {
    const [x, y] = this.gw(e.c, e.r);
    const big = e.id.startsWith("pro_");
    switch (e.id) {
      case "strike": case "pro_judge": this.spawn("lightningStrike", x, y + 20, {}, "over", 1.8); this.shake = 0.6; this.flash = 0.3; this.stop(0.09); this.impact(x, y, 0.5); break;
      case "meteor": case "pro_meteor": this.spawn("meteorFx", x, y + 20, {}, "over", 2.6); this.shake = 0.8; this.stop(0.08); this.impact(x, y, 0.6); break;
      case "pro_pillar": this.spawn("flamePillar", x, y + 24, {}, "over", 2.4); this.shake = 0.5; break;
      case "nova": this.spawn("iceSpikes", x, y + 20, {}, "over", 1.6); this.spawn("snowflake", x, y + 16, {}, "over"); this.shake = 0.3; break;
      case "scream": this.spawn("necro", x, y + 18, {}, "over", 1.6); this.floatText(x, y - 24, "절규", "fear"); break;
    }
    this.light(x, y, big ? 90 : 60, "255,230,180", 0.8);
  }
  /** Where a placed card sits: traps on the floor, facilities up on the back wall. */
  iconXY(c, r, kind = "trap") { const [x, y] = this.cellXY(c, r); return kind === "facility" ? [Math.round(x + this.CW / 2 - 12), y + 8] : [Math.round(x + this.CW / 2 - 12), y + this.CH - 9 - 22]; }

  // ---- the frame
  update(dt) {
    this.t += dt;
    for (const it of this.fx) { it.fx.update(dt); it.age += dt; if (it.vy) it.fx.options.y += it.vy * dt; if (it.dur && it.age >= it.dur) it.fx.stop(); }
    for (const e of this.embers) { e.age += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.97; }
    this.embers = this.embers.filter((e) => e.age < e.life);
    for (const ch of this.chains) ch.t = Math.min(1, ch.t + dt * 2.2);
    if (this.sealCircle) this.sealCircle.age += dt;
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
        // no stars and coins: black smoke, embers, and the soul leaving the body
        this.spawn("poof", c.x, c.y, { palette: ["#06040a", "#140a1a", "#24142c", "#3a2442", "#5a3a5e", "#8a6a8a"], stars: ["#ff6a3a", "#ffb05a", "#ffe0a0"] }, "over");
        const soul = this.spawn("wisp", c.x, c.y - 6, { palette: ["#0a0a1a", "#1a1a3a", "#3a3a6a", "#6a7aaa", "#a8b8e0", "#e0e8ff", "#ffffff"], hover: 0 }, "over", 1.1);
        if (soul) soul.vy = -34;
        for (let i = 0; i < 8; i++) this.embers.push({ x: c.x + (Math.random() - 0.5) * 10, y: c.y - 4, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, age: 0, life: 0.8 + Math.random() * 0.8 });
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
    this.drawSky();
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
    this.drawSeal();
    for (const e of this.embers) { g.fillStyle = e.age / e.life < 0.5 ? "#ffb05a" : "#c8402a"; g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); }
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

  /** Dusk by day, stars and a moon by night; gold in the prologue. */
  drawSky() {
    const g = this.g, SKY = this.SKY, n = this.mode === "golden" ? 0 : this.night;
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * n));
    const top = this.mode === "golden" ? [250, 214, 140] : mix([226, 120, 90], [10, 8, 30]);
    const bot = this.mode === "golden" ? [255, 236, 190] : mix([248, 190, 130], [40, 24, 60]);
    const gr = g.createLinearGradient(0, 0, 0, SKY);
    gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = gr; g.fillRect(0, 0, this.W, SKY);
    if (n > 0.2) {
      g.fillStyle = `rgba(255,250,230,${n})`;
      for (let i = 0; i < 60; i++) { const x = hash(i, 31) * this.W | 0, y = hash(i, 32) * (SKY - 30) | 0; if ((this.t * 2 + i) % 7 > 0.6) g.fillRect(x, y, 1, 1); }
      const mx = Math.round(this.W * 0.18), my = 22;
      g.fillStyle = `rgba(240,236,210,${n})`; g.beginPath(); g.arc(mx, my, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(10,8,30,${n})`; g.beginPath(); g.arc(mx + 4, my - 2, 8, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = `rgba(255,230,150,${0.9 - n})`; g.beginPath(); g.arc(this.W * 0.2, SKY - 26, 12, 0, Math.PI * 2); g.fill();
    }
  }

  blit(frame, img, cv) {
    composite(frame, img.data, null);
    cv.getContext("2d").putImageData(img, 0, 0);
    this.g.drawImage(cv, 0, 0);
  }

  drawLiving(run, pulse, breath) {
    const g = this.g, CW = this.CW, CH = this.CH;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm) continue;
      const [x, y] = this.cellXY(c, r), FY = y + CH - 9;
      // the back wall breathes: it swells darker and lighter with a slow breath
      g.fillStyle = `rgba(20,0,20,${0.04 + breath * 0.1})`; g.fillRect(x + 4, y + 6, CW - 8, FY - y - 6);
      // cracks in the floor slab glow with the heartbeat
      g.fillStyle = `rgba(240,40,80,${0.2 + pulse * 0.6})`;
      for (let i = 0; i < 5; i++) { let px = x + 6 + hash(c, r, i + 40) * (CW - 12); for (let k = 0; k < 4; k++) { g.fillRect(px | 0, FY + 1 + k, 1, 1); px += hash(i, k, c) > 0.5 ? 1 : -1; } }
      if (rm.type === "water") {
        g.fillStyle = "rgba(160,220,255,0.7)";
        for (let i = 0; i < 6; i++) { const px = x + 6 + ((hash(c, i, r) * (CW - 16) + this.t * 8 * (i % 2 ? 1 : -1)) % (CW - 16) + (CW - 16)) % (CW - 16); g.fillRect(px | 0, FY - 20 + (i % 2), 5, 1); }
        g.fillStyle = "rgba(30,80,160,0.35)"; g.fillRect(x + 4, FY - 19, CW - 8, 19);
      }
      if (rm.type === "lava") {
        g.fillStyle = `rgba(255,140,40,${0.3 + 0.2 * Math.sin(this.t * 3 + c)})`; g.fillRect(x + 4, FY - 9, CW - 8, 9);
        const b = (this.t * 1.3 + c * 0.37) % 1; g.fillStyle = "#ffd070"; g.fillRect(x + 10 + ((hash(c, Math.floor(this.t * 1.3)) * (CW - 20)) | 0), FY - 9 - Math.round(b * 6), 2, 2);
      }
      if (rm.type === "dark") { g.fillStyle = "rgba(8,2,18,0.4)"; g.fillRect(x + 4, y + 6, CW - 8, FY - y - 6); }
      if (rm.type === "secret") { g.fillStyle = `rgba(120,180,255,${0.12 + 0.06 * Math.sin(this.t * 2)})`; g.fillRect(x + 4, y + 6, CW - 8, FY - y - 6); }
      // two torches on the back wall
      for (const tx of [x + 10, x + CW - 12]) {
        if (rm.type === "water" && tx > x + CW / 2) continue;
        const ty = y + 22, f = Math.floor(this.t * 10 + c * 3 + r + tx) % 3;
        g.fillStyle = "#5a3a1a"; g.fillRect(tx, ty, 2, 6); g.fillRect(tx - 1, ty + 5, 4, 1);
        g.fillStyle = "#ff8a2a"; g.fillRect(tx - (f === 1 ? 1 : 0), ty - 4, 2 + (f === 1 ? 1 : 0), 4);
        g.fillStyle = "#ffe26b"; g.fillRect(tx, ty - 3 - (f === 2 ? 1 : 0), 1 + (f === 0 ? 1 : 0), 2);
      }
      if (rm.type === "heart") {
        const hurt = this.heartHurt > 0 ? 1 : 0;
        const s = 12 + pulse * 3.5;
        const sp = this.heartDead ? heartSprite(12, 1, 1) : heartSprite(s, hurt || (run.heart.hp / run.heart.max < 0.34 ? 1 : 0));
        g.drawImage(sp, Math.round(x + CW / 2 - sp.width / 2), Math.round(y + (FY - y) * 0.46 - sp.height / 2));
      }
    }
  }

  drawCards(run) {
    const g = this.g;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rm = run.rooms[key(c, r)];
      if (!rm?.card) continue;
      const d = CARDS[rm.card.id];
      const [ix, iy] = this.iconXY(c, r, d.kind);
      const pop = this.spikeT?.[key(c, r)] > 0 ? -5 : 0;
      if (d.kind === "facility") { g.fillStyle = "#2a2040"; g.fillRect(ix + 10, iy - 2, 4, 3); }
      g.drawImage(cardIcon(rm.card.id), ix, iy + pop);
      if (rm.card.disabledT > 0) {
        g.fillStyle = "rgba(20,12,28,0.6)"; g.fillRect(ix, iy, 24, 24);
        g.fillStyle = "#ff6a4a"; for (let i = 0; i < 12; i++) { g.fillRect(ix + 6 + i, iy + 6 + i, 1, 1); g.fillRect(ix + 17 - i, iy + 6 + i, 1, 1); }
      }
      if (d.hp) this.bar(ix + 2, iy - 4, 20, rm.card.hp / d.hp, "#4fe0e8");
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
    const w = spr.width * k, fullH = spr.height * k, h = (spr.vh ?? spr.height) * k;
    const bob = moving && frame ? -1 : 0;
    const knock = a.hitT > 0 ? -this.faceOf(a) * (a.hitT / 0.18) * 5 : 0;
    // shadow
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(Math.round(x - 6 * k), Math.round(y - 1), 12 * k, 2);
    g.save();
    g.translate(Math.round(x + knock), Math.round(y + bob));
    if (this.faceOf(a) < 0) g.scale(-1, 1);
    g.drawImage(spr, -w / 2, -fullH, w, fullH);
    g.restore();
    if (a.hitT > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.7; g.save(); g.translate(Math.round(x), Math.round(y)); if (this.faceOf(a) < 0) g.scale(-1, 1); g.drawImage(spr, -w / 2, -fullH, w, fullH); g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
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
    const d = this.darkCv.getContext("2d"), CW = this.CW, CH = this.CH;
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, this.W, this.H);
    const base = this.mode === "golden" ? 0 : 0.08 + this.night * 0.26;
    if (base <= 0.01) return;
    // underground is darker than the open air
    d.fillStyle = `rgba(6,3,18,${base * 0.5})`; d.fillRect(0, 0, this.W, this.SKY - 12);
    d.fillStyle = `rgba(6,3,18,${base})`; d.fillRect(0, this.SKY - 12, this.W, this.H);
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
      for (const tx of [x + 11, x + CW - 11]) hole(tx, y + 20, 34 + Math.sin(this.t * 9 + c + tx) * 1.5, 0.7);
      hole(x + CW / 2, y + CH * 0.55, CW * 0.55, 0.45);
      if (rm.type === "secret" || rm.type === "lava") hole(x + CW / 2, y + CH / 2, CW * 0.5, 0.65);
    }
    const [hx, hy] = this.gw(...HEART);
    hole(hx, hy - 6, 40 + pulse * 12, 0.9);
    if (this.gateXY) hole(this.gateXY[0], this.gateXY[1], 30, 0.6);
    for (const a of run.advs) if (!a.dead && !a.out) { const [x, y] = this.advXY(a); hole(x + 4, y - 14, 22, 0.7); }
    for (const m of run.monsters) if (m.hp > 0 && (m.species === "wisp" || m.traits.includes("불"))) { const [x, y] = this.monXY(m); hole(x, y - 8, 24, 0.7); }
    for (const l of this.lights) hole(l.x, l.y, l.r, Math.min(1, l.life / l.max));
    for (const it of this.fx) if (it.layer === "over" && it.age < 1.2) hole(it.fx.options.x, it.fx.options.y - 12, 36, 0.6);
    d.globalCompositeOperation = "source-over";
    this.g.drawImage(this.darkCv, 0, 0);
  }

  drawHighlights(run) {
    const g = this.g;
    const t = 0.5 + 0.5 * Math.sin(this.t * 6);
    for (const h of this.highlights) {
      const [x, y] = this.cellXY(h[0], h[1]);
      g.fillStyle = `rgba(79,224,232,${0.1 + 0.12 * t})`;
      g.fillRect(x + 3, y + 3, this.CW - 6, this.CH - 6);
      g.strokeStyle = `rgba(79,224,232,${0.5 + 0.4 * t})`;
      g.lineWidth = 1;
      g.strokeRect(x + 2.5, y + 2.5, this.CW - 5, this.CH - 5);
    }
    for (const h of this.range) {
      const [x, y] = this.cellXY(h[0], h[1]);
      g.fillStyle = "rgba(255,180,60,0.16)";
      g.fillRect(x + 3, y + 3, this.CW - 6, this.CH - 6);
    }
    if (this.hover) {
      const [x, y] = this.cellXY(this.hover[0], this.hover[1]);
      g.strokeStyle = this.hoverBad ? "rgba(255,90,90,0.9)" : "rgba(255,255,255,0.95)";
      g.lineWidth = 2;
      g.strokeRect(x + 2, y + 2, this.CW - 4, this.CH - 4);
    }
    if (this.breach != null) {
      const [x, y] = this.cellXY(this.breach % COLS, (this.breach / COLS) | 0);
      g.strokeStyle = `rgba(255,60,80,${0.5 + 0.5 * t})`; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, this.CW - 4, this.CH - 4);
    }
  }

  /** The seal turning the world to stone, from the edges in. */
  drawGray() {
    // stone creeping in from the edges: a soft-edged oval of colour that shrinks to nothing
    const g = this.vg, V = this.view, k = Math.min(1, this.gray);
    if (!this.grayCv || this.grayCv.width !== V.width || this.grayCv.height !== V.height) { this.grayCv = document.createElement("canvas"); this.grayCv.width = V.width; this.grayCv.height = V.height; }
    const m = this.grayCv.getContext("2d");
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, V.width, V.height);
    m.fillStyle = "#808080"; m.fillRect(0, 0, V.width, V.height);
    if (k < 1) {
      m.globalCompositeOperation = "destination-out";
      const r = Math.hypot(V.width, V.height) * 0.62 * (1 - k);
      const gr = m.createRadialGradient(V.width / 2, V.height / 2, r * 0.7, V.width / 2, V.height / 2, Math.max(1, r));
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      m.fillStyle = gr; m.fillRect(0, 0, V.width, V.height);
    }
    g.save();
    g.globalCompositeOperation = "saturation";
    g.drawImage(this.grayCv, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.25 * k; g.fillStyle = "#464654"; g.fillRect(0, 0, V.width, V.height);
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
  if (palette ?? sp.palette) opts.palette = palette ?? sp.palette;
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
  const L = LAYOUT.land, cv = document.createElement("canvas");
  cv.width = L.CW; cv.height = L.CH;
  const g = cv.getContext("2d");
  const fake = Object.assign(Object.create(Renderer.prototype), L, { mode: "normal", SKY: 0, MX: 0 });
  fake.drawRoom(g, null, { type }, 0, 0);
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
