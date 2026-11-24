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
import { CARDS, MON, advPos, HEART_WP, GATE_WP, ZONES, WP, wpXY, cardRadius, spellRadius, cardDef } from "./sim.js";
import { W as MW, H as MH, GROUND } from "./map.js";
import { paintCave, decoZone } from "./cave.js";
import { chibi, cardIcon, diaryPage, INK } from "./sprites.js";
import heartUrl from "../assets/heart.webp";
import heartStoneUrl from "../assets/heart_stone.webp";

const img = (src) => { const i = new Image(); i.src = src; return i; };
export const IMG = { heart: img(heartUrl), heartStone: img(heartStoneUrl) };
/** The world canvas holds two pixels per world unit, so painted art keeps its detail. */
const RS = 2;

export const FX = {
  slime, bat, frog, ghost, snake, eyeball, "flying-skull": skull, wisp, hitSpark, bluntHit, zapHit, lightningStrike, flamethrower,
  flamePillar, meteorFx, snowflake, iceSpikes, toxicPuddle, necro, darkBoom, poof, coinDrop, summonRise, collect, lootBeam, coinSpin,
  healAoe, sunburst, holyPillar, runeCircle, dirtBoom, bigBoom, firework, eggHatch, fireflies,
};

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
    this.targets = null; this.zoneTargets = []; this.hoverW = null; this.hoverZone = null; this.hoverCard = null;
    this.torches = []; this.gateXY = [160, GROUND - 24];
    this.W = MW; this.H = MH;
    this.cv.width = MW * RS; this.cv.height = MH * RS;
    this.g.imageSmoothingEnabled = false;
    const mk = (w = MW, h = MH) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    this.caveCv = mk(MW * RS, MH * RS); this.darkCv = mk(); this.underCv = mk(); this.overCv = mk();
    this.under = createFrame(MW, MH); this.over = createFrame(MW, MH);
    this.underImg = new ImageData(MW, MH); this.overImg = new ImageData(MW, MH);
  }

  /** One cave for every screen shape; the camera does the fitting. */
  setLayout(portrait) { this.portrait = portrait; this.camSnap = true; }

  // ---- coordinates: world units, the cave seen from the side
  wXY(w) { return wpXY(w); }
  /** A point at chest height above a waypoint. */
  chest(w) { const [x, y] = wpXY(w); return [x, y - 20]; }
  /** World position of an adventurer's feet, spread a little along the floor so a crowd reads as a crowd. */
  advXY(a) {
    const [x, y] = advPos(a);
    if (a.next == null) return [x + a.lane * 4, y];
    const A = WP[a.cell], B = WP[a.next], L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    return [x + ((B.x - A.x) / L) * a.lane * 5, y + ((B.y - A.y) / L) * a.lane * 5];
  }
  faceOf(a) { return a.face ?? 1; }
  monXY(m) {
    const [x, y] = wpXY(m.w);
    return [Math.round(x), Math.round(y) + (SPECIES_Y[m.species] ?? 0)];
  }
  /** Where a placed card sits: traps on the floor, facilities up on the back wall. */
  cardXY(cd) {
    const [x, y] = wpXY(cd.w), d = CARDS[cd.id];
    return d?.kind === "facility" ? [Math.round(x - 12), Math.round(y - 52)] : [Math.round(x - 12), Math.round(y - 20)];
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
    for (const z of Object.values(ZONES)) {
      const show = run.rooms[z.id]?.open || this.zoneTargets.includes(z.id) || (z.kind === "chamber" && !run.rooms[z.id]?.open);
      if (!show) continue;
      x0 = Math.min(x0, z.x0 - 22); x1 = Math.max(x1, z.x1 + 22); y0 = Math.min(y0, z.yTop - 8); y1 = Math.max(y1, z.y + 14);
    }
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: this.W, y1: this.H };
    x0 = Math.min(x0, this.gateXY[0] - 46);
    // always keep a slice of the surface in view: the gate, the saints, the sky
    return { x0: Math.max(0, x0), y0: Math.max(0, Math.min(y0, GROUND - 84)), x1: Math.min(this.W, x1), y1: Math.min(this.H, y1) };
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
      const act = run && run.phase === "wave" && this.follow !== false && !this.targets && !this.zoneTargets.length ? run.advs.filter((a) => !a.dead && !a.out && !a.npc) : [];
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

  // ---- the cave itself, repainted when it changes
  renderCave(run) {
    const p = paintCave(run, this.mode === "golden" ? "golden" : "normal");
    this.torches = p.torches; this.gateXY = p.gate;
    const g = this.caveCv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.caveCv.width, this.caveCv.height);
    g.drawImage(p.canvas, 0, 0, this.caveCv.width, this.caveCv.height);
    this.roomsDirty = false;
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
    const at = (w, dy = 0) => { const [x, y] = wpXY(w); return [x, y + dy]; };
    const advById = (id) => run.advs.find((a) => a.id === id);
    const HXY = () => { const [x, y] = wpXY(HEART_WP); return [x, y - 56]; };
    switch (e.t) {
      case "dmg": {
        const x = e.x, y = e.y - 20;
        this.number(x, y, e.amount, e.el, e.boosted);
        if (!e.dot && Math.random() < 0.6) this.spawn("hitSpark", x, y - 4, { palette: PAL[e.el] ?? PAL.physical, height: 10 }, "over");
        break;
      }
      case "trap": this.trapFx(e, run); break;
      case "spell": this.spellFx(e); break;
      case "death": {
        const x = e.x, y = e.y - 20;
        const fx0 = e.from ? e.from[0] : x - (Math.random() < 0.5 ? 1 : -1);
        const dir = Math.sign(x - fx0) || (Math.random() < 0.5 ? -1 : 1);
        const pow = e.boss ? 0.6 : e.big ? 1.7 : 1.1;
        // the body gets thrown, spins, lands, and the soul leaves it
        this.corpses.push({ spr: chibi(e.cls === "boss" ? "boss" : e.cls, 0, "scared"), k: e.boss ? 2 : 1, x, y: e.y, h: 4, vx: dir * (45 + Math.random() * 45) * pow, vh: (110 + Math.random() * 70) * pow, rot: 0, vr: dir * (7 + Math.random() * 7) * pow, bounces: 0, age: 0 });
        if (e.execute) this.spawn("necro", x, y + 10, {}, "over", 1.2);
        if (e.big) this.stop(0.06);
        if (e.boss) { this.spawn("bigBoom", x, y + 10, {}, "over"); this.shake = 0.9; this.flash = 0.6; this.stop(0.35); this.slowmo(1.6); this.impact(x, y, 1.2); this.punch(x, y, 0.5); }
        if (e.last) { this.slowmo(1.1); this.punch(x, y, 0.35); this.impact(x, y, 0.6); }
        this.light(x, y, 40, "255,160,120", 0.5);
        break;
      }
      case "roar": {
        const [x, y] = HXY();
        for (let i = 0; i < 3; i++) this.rings.push({ x, y, age: -i * 0.12, dur: 0.9, r: 420 });
        this.flash = 0.45; this.flashColor = "255,60,90"; this.shake = 0.8; this.stop(0.14); this.slowmo(0.9); this.impact(x, y, 0.9); this.punch(x, y, 0.4);
        this.spawn("darkBoom", x, y + 16, { palette: ["#12040a", "#360814", "#64101e", "#a01c2c", "#e03a44", "#ff8a8a", "#ffe0e0", "#ffffff"] }, "over", 1.2);
        this.light(x, y, 160, "255,90,110", 1.2);
        break;
      }
      case "diary": this.floaters.push({ x: e.x, y: e.y - 30, sprite: diaryPage(), age: 0, vy: 8, sway: true, life: 2.2 }); break;
      case "heartHit": {
        const [x, y] = HXY();
        this.redPulse = 0.6;
        this.spawn("hitSpark", x + (Math.random() - 0.5) * 30, y + 10, { palette: PAL.blood, height: 14 }, "over");
        this.number(x, y - 10, e.amount, "fire", true);
        this.shake = Math.max(this.shake, 0.3);
        this.heartHurt = 0.4;
        break;
      }
      case "monAtk": {
        const m = run.monsters.find((q) => q.id === e.mid);
        if (m) {
          const [mx, my] = this.monXY(m);
          if (Math.abs(mx - e.x) > 30 || Math.abs(my - e.y) > 30) this.shoot(mx, my - 10, e.x, e.y - 18, "orb");
        }
        break;
      }
      case "advHit": {
        const m = run.monsters.find((q) => q.id === e.mid);
        if (m) { const [x, y] = this.monXY(m); this.spawn("hitSpark", x, y - 6, { palette: PAL.physical, height: 8, flip: true }, "over"); }
        break;
      }
      case "monDeath": {
        this.mons.delete(e.mid);
        const [x, y] = at(e.w);
        this.spawn("poof", x, y - 2, { palette: ["#06040a", "#140a1a", "#24142c", "#3a2442", "#5a3a5e", "#8a6a8a"] }, "over");
        break;
      }
      case "summon": { const [x, y] = this.monXY(e.m); this.spawn("summonRise", x, y, {}, "over", 1); this.spawn("poof", x, y, { palette: PAL.blood.slice(0, 6) }, "over"); this.light(x, y, 30, "255,90,110", 0.5); break; }
      case "place": { const [x, y] = at(e.w, -8); this.spawn("collect", x, y, { palette: PAL.blood }, "over"); this.light(x, y, 26, "255,90,110", 0.4); break; }
      case "room": {
        const z = ZONES[e.z];
        const x = z.cx, y = z.y - 10;
        this.spawn("dirtBoom", x, y, {}, "over", 0.9);
        if (e.dug) { this.spawn("dirtBoom", x - 24, y, {}, "over", 0.9); this.spawn("dirtBoom", x + 24, y, {}, "over", 0.9); this.shake = 0.5; this.stop(0.08); }
        else this.shake = 0.25;
        this.roomsDirty = true;
        break;
      }
      case "secret": { const z = ZONES[e.z]; const x = z.cx, y = z.y; this.spawn("lootBeam", x, y, { palette: ["#06142a", "#0c2a52", "#1a4a8a", "#2a7ac8", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"] }, "over", 3.5); this.roomsDirty = true; this.light(x, y - 20, 50, "120,180,255", 2); break; }
      case "wallHit": { const [x, y] = at(e.w, -14); this.spawn("bluntHit", x, y, {}, "over"); break; }
      case "wallBreak": { const [x, y] = at(e.w, -4); this.spawn("dirtBoom", x, y, {}, "over", 1); this.shake = 0.3; break; }
      case "disarmed": { const [x, y] = at(e.w, -10); this.spawn("poof", x, y, {}, "over"); this.floatText(x, y - 20, "함정 해제됨", "warn"); break; }
      case "heal": this.spawn("collect", e.x, e.y - 20, { palette: ["#1a1004", "#3e2808", "#6e4a10", "#b07a1c", "#e8b23a", "#ffe07a", "#fff8d8", "#ffffff"] }, "over"); break;
      case "fx":
        if (e.id === "heal") { const [x, y] = HXY(); this.spawn("healAoe", x, y + 40, {}, "over"); this.light(x, y, 60, "255,200,200", 1); }
        if (e.id === "rage") { const [x, y] = at(e.w, -4); this.spawn("runeCircle", x, y, { palette: PAL.blood }, "over", 1.4); }
        if (e.id === "monHeal") { const [x, y] = at(e.w, -6); this.spawn("collect", x, y, { palette: ["#0a1f2e", "#0f3d52", "#14707e", "#1fa8a8", "#4fe0c8", "#a8fff0", "#e0fff8", "#ffffff"] }, "over"); }
        break;
      case "loot": { const a = advById(e.id); if (a) { const [x, y] = this.advXY(a); this.spawn("coinSpin", x, y - 46, {}, "over", 1.2); } break; }
      case "spawn": { const [x, y] = this.gateXY; this.spawn("poof", x, y + 22, { palette: ["#06040a", "#140a1a", "#24142c", "#3a2442", "#5a3a5e", "#8a6a8a"] }, "over"); if (e.boss) this.shake = 0.5; break; }
      case "shriek": { const m = run.monsters.find((q) => q.id === e.mid); if (m) { const [x, y] = this.monXY(m); this.floatText(x, y - 26, "비명", "shriek"); } break; }
      case "synergy": { const [x, y] = at(e.w, -40); this.floatText(x, y, e.text, "synergy"); break; }
      case "scare": break;
    }
  }

  trapFx(e, run) {
    const [cx, cy] = wpXY(e.w);
    const d = CARDS[e.id];
    const targets = (e.targets ?? (e.target ? [e.target] : [])).map((id) => run.advs.find((a) => a.id === id)).filter(Boolean);
    const tp = targets.map((a) => this.advXY(a));
    const cd = run.cards.find((c) => c.w === e.w && c.id === e.id);
    const [ix, iy] = cd ? this.cardXY(cd) : [cx - 12, cy - 20];
    switch (e.id) {
      case "spike": (this.spikeT ??= {})[e.w] = 0.35; this.spawn("bluntHit", cx, cy - 6, {}, "over"); break;
      case "boulder": for (const [x, y] of tp) { this.floaters.push({ x, y: y - 70, boulder: true, age: 0, vy: 260, life: 0.25 }); this.spawn("bluntHit", x, y - 4, {}, "over"); } this.shake = 0.3; break;
      case "zap":
      case "tesla": {
        let [px, py] = [ix + 12, iy + 4];
        for (const [x, y] of tp) {
          this.bolt(px, py, x, y - 20, e.chained ? "#ffffff" : "#bfe8ff");
          this.spawn("zapHit", x, y - 14, {}, "over");
          if (e.id === "tesla") [px, py] = [x, y - 20];
        }
        if (e.chained) { this.flash = 0.12; this.flashColor = "200,220,255"; this.light(cx, cy - 20, 70, "150,190,255", 0.35); if (tp.length >= 3) { this.stop(0.05); this.shake = Math.max(this.shake, 0.3); } }
        break;
      }
      case "flame": {
        const r = cardRadius(d), right = tp.length ? tp[0][0] >= cx : true;
        this.spawn("flamethrower", cx, cy - 6, { reach: r * 1.6, flip: !right }, "over", 0.9);
        this.light(cx, cy - 10, r + 20, "255,150,60", 0.6);
        break;
      }
      case "frost": this.spawn("snowflake", cx, cy - 10, { count: 6 }, "over"); this.light(cx, cy - 10, 40, "150,220,255", 0.5); break;
      case "gas": break;
      case "arrow": for (const [x, y] of tp) this.shoot(ix + 12, iy + 8, x, y - 20, "arrow"); break;
      case "crystal": for (const [x, y] of tp) this.shoot(ix + 12, iy + 4, x, y - 20, "orb"); break;
      case "totem": (this.pulses ??= []).push({ x: cx, y: cy - 2, age: 0, r: cardRadius(d) }); break;
    }
    if (d?.fear) for (const [x, y] of tp) if (Math.random() < 0.3) this.floatText(x, y - 50, "공포", "fear");
  }
  spellFx(e) {
    const [x, y] = wpXY(e.w);
    const big = e.id.startsWith("pro_");
    switch (e.id) {
      case "strike": case "pro_judge": this.spawn("lightningStrike", x, y, {}, "over", 1.8); this.shake = 0.6; this.flash = 0.3; this.stop(0.09); this.impact(x, y - 20, 0.5); break;
      case "meteor": case "pro_meteor": this.spawn("meteorFx", x, y, {}, "over", 2.6); this.shake = 0.8; this.stop(0.08); this.impact(x, y - 20, 0.6); break;
      case "pro_pillar": this.spawn("flamePillar", x, y + 4, {}, "over", 2.4); this.shake = 0.5; break;
      case "nova": this.spawn("iceSpikes", x, y, {}, "over", 1.6); this.spawn("snowflake", x, y - 4, {}, "over"); this.shake = 0.3; break;
      case "scream": this.spawn("necro", x, y - 2, {}, "over", 1.6); this.floatText(x, y - 44, "절규", "fear"); break;
    }
    this.light(x, y - 20, big ? 90 : 60, "255,230,180", 0.8);
  }

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
    if (this.roomsDirty) this.renderCave(run);
    g.setTransform(RS, 0, 0, RS, 0, 0);
    g.imageSmoothingEnabled = false;
    this.drawSky();
    g.drawImage(this.caveCv, 0, 0, this.W, this.H);

    const lowHp = run.heart.hp / Math.max(1, run.heart.max);
    const bpm = 56 + (1 - lowHp) * 90 + (run.phase === "wave" ? 20 : 0);
    this.beat += (bpm / 60) * (1 / 60);
    const ph = this.beat % 1, pulse = ph < 0.12 ? ph / 0.12 : ph < 0.3 ? 1 - (ph - 0.12) / 0.18 : ph < 0.4 ? (ph - 0.3) / 0.1 * 0.4 : ph < 0.55 ? 0.4 * (1 - (ph - 0.4) / 0.15) : 0;
    const breath = Math.sin(this.t * 1.4) * 0.5 + 0.5;
    this.drawLiving(run, pulse, breath);
    this.drawCards(run);

    // under layer: critters, puddles
    clearFrame(this.under);
    let underUsed = false;
    for (const cd of run.cards) {
      if (cd.id !== "gas" || cd.disabledT > 0) continue;
      let a = this.ambient.get(cd.uid);
      if (!a) { a = createFx(toxicPuddle, { width: 40, seed: cd.uid }); this.ambient.set(cd.uid, a); }
      a.update(1 / 60);
      const [x, y] = wpXY(cd.w);
      a.options.x = Math.round(x); a.options.y = Math.round(y);
      a.draw(this.under); underUsed = true;
    }
    const alive = new Set();
    for (const m of run.monsters) {
      if (m.hp <= 0) continue;
      alive.add(m.id);
      const it = this.monFx(m);
      it.fx.update(1 / 60 * (m.atkT > 0 ? 3 : 1));
      const [x, y] = this.monXY(m);
      it.fx.options.x = x; it.fx.options.y = y; it.fx.options.flip = (m.face ?? (m.id % 2 ? 1 : -1)) < 0;
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
      if (m.hp < m.max) this.bar(x - 7, y + 5, 14, m.hp / m.max, "#c83a4a");
      if (m.hitT > 0) { g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x - 8, y - 14, 16, 16); }
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
    if (this.pulses) for (const p of this.pulses) { g.strokeStyle = `rgba(200,90,255,${1 - p.age / 0.8})`; g.lineWidth = 1; g.beginPath(); g.ellipse(p.x, p.y, 6 + p.age * (p.r ?? 40), 2 + p.age * (p.r ?? 40) * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
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
      for (let i = 0; i < 60; i++) { const x = (hash(i, 1) * this.W + this.t * (6 + hash(i, 2) * 10)) % this.W, y = (hash(i, 3) * this.H - this.t * (4 + hash(i, 4) * 6) + this.H * 10) % this.H; if ((this.t * 3 + i) % 4 < 3) g.fillRect(x | 0, y | 0, 1, 1); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Dusk by day, stars and a blood moon by night; gold in the golden age. */
  drawSky() {
    const g = this.g, SKY = GROUND + 4, n = this.mode === "golden" ? 0 : this.night;
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * n));
    const top = this.mode === "golden" ? [210, 120, 70] : mix([120, 40, 46], [8, 6, 18]);
    const bot = this.mode === "golden" ? [255, 200, 120] : mix([226, 120, 80], [46, 16, 30]);
    const gr = g.createLinearGradient(0, 0, 0, SKY);
    gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = gr; g.fillRect(0, 0, this.W, SKY);
    if (n > 0.2) {
      g.fillStyle = `rgba(255,240,230,${n})`;
      for (let i = 0; i < 70; i++) { const x = hash(i, 31) * this.W | 0, y = hash(i, 32) * (SKY - 40) | 0; if ((this.t * 2 + i) % 7 > 0.6) g.fillRect(x, y, 1, 1); }
      // the moon is red over this valley
      const mx = Math.round(this.W * 0.8), my = 26;
      g.fillStyle = `rgba(150,20,30,${0.25 * n})`; g.beginPath(); g.arc(mx, my, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(200,50,50,${n})`; g.beginPath(); g.arc(mx, my, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(140,24,34,${n})`; g.fillRect(mx - 5, my - 3, 4, 3); g.fillRect(mx + 2, my + 4, 3, 2);
    } else {
      g.fillStyle = `rgba(255,200,120,${0.9 - n})`; g.beginPath(); g.arc(this.W * 0.82, SKY - 30, 14, 0, Math.PI * 2); g.fill();
    }
    // the kingdom on the far hills: a cathedral, walls, towers, and windows that light up at night
    const base = SKY - 6, far = this.mode === "golden" ? "#8a5a40" : n > 0.5 ? "#0e0a16" : "#3a1e26";
    g.fillStyle = this.mode === "golden" ? "#a8704a" : n > 0.5 ? "#140e1e" : "#4a2830";
    for (let x = 0; x < this.W; x += 2) { const h = 16 + Math.sin(x * 0.017) * 7 + Math.sin(x * 0.051 + 1) * 4; g.fillRect(x, base - h, 2, h + 6); }
    g.fillStyle = far;
    const cx = Math.round(this.W * 0.6);
    g.fillRect(cx - 70, base - 30, 150, 30);
    for (let k = 0; k < 150; k += 5) g.fillRect(cx - 70 + k, base - 33, 3, 3);
    for (const [dx, w, h] of [[-62, 8, 44], [-30, 10, 40], [8, 22, 54], [44, 9, 46], [70, 8, 38]]) {
      g.fillRect(cx + dx, base - h, w, h);
      g.beginPath(); g.moveTo(cx + dx - 1, base - h); g.lineTo(cx + dx + w / 2, base - h - w * 1.8); g.lineTo(cx + dx + w + 1, base - h); g.fill();
    }
    g.fillRect(cx + 18, base - 92, 2, 14); g.fillRect(cx + 15, base - 88, 8, 2);
    if (n > 0.3 || this.mode === "golden") {
      g.fillStyle = this.mode === "golden" ? "#ffe8a0" : `rgba(255,190,90,${n})`;
      for (let i = 0; i < 26; i++) { const x = cx - 66 + ((hash(i, 41) * 144) | 0), y = base - 6 - ((hash(i, 42) * 40) | 0); if (hash(i, 43) > 0.3) g.fillRect(x, y, 1, 2); }
    }
  }

  blit(frame, img, cv) {
    composite(frame, img.data, null);
    cv.getContext("2d").putImageData(img, 0, 0);
    this.g.drawImage(cv, 0, 0, this.W, this.H);
  }

  drawLiving(run, pulse, breath) {
    const g = this.g;
    for (const z of Object.values(ZONES)) {
      const rm = run.rooms[z.id];
      if (!rm?.open) continue;
      const F = z.y, iw = z.x1 - z.x0;
      if (rm.type === "water") {
        g.fillStyle = "rgba(150,210,255,0.6)";
        for (let i = 0; i < 8; i++) { const px = z.x0 + ((hash(i, 3, z.x0) * iw + this.t * 8 * (i % 2 ? 1 : -1)) % iw + iw) % iw; g.fillRect(px | 0, F - 14 + (i % 2), 5, 1); }
      }
      if (rm.type === "lava") {
        g.fillStyle = `rgba(255,140,40,${0.3 + 0.2 * Math.sin(this.t * 3 + z.x0)})`; g.fillRect(z.x0, F - 8, iw, 8);
        const b = (this.t * 1.3 + z.x0 * 0.01) % 1; g.fillStyle = "#ffd070"; g.fillRect(z.x0 + 6 + ((hash(z.x0, Math.floor(this.t * 1.3)) * (iw - 12)) | 0), F - 8 - Math.round(b * 7), 2, 2);
      }
      if (rm.type === "secret") { g.fillStyle = `rgba(120,180,255,${0.08 + 0.05 * Math.sin(this.t * 2)})`; g.fillRect(z.x0 - 8, z.yTop + 8, iw + 16, z.h - 8); }
    }
    // torches flicker on the walls
    for (const [tx, ty] of this.torches) {
      const f = Math.floor(this.t * 10 + tx) % 3;
      g.fillStyle = "#ff6a1a"; g.fillRect(tx - 1 - (f === 1 ? 1 : 0), ty - 3, 3 + (f === 1 ? 1 : 0), 5);
      g.fillStyle = "#ffd26b"; g.fillRect(tx, ty - 2 - (f === 2 ? 1 : 0), 1 + (f === 0 ? 1 : 0), 3);
    }
    // the heart: painted flesh that beats, swelling with each double knock
    const [hx, fy] = wpXY(HEART_WP);
    const im = this.heartDead ? IMG.heartStone : IMG.heart;
    if (im.complete && im.naturalWidth) {
      const hurt = this.heartHurt > 0 ? this.heartHurt / 0.4 : 0;
      const k = this.heartDead ? 1 : 1 + pulse * 0.05 + breath * 0.012;
      const S = 118 * k, cy = fy - 8 - 59;
      // a glow behind it, stronger on the beat
      if (!this.heartDead) {
        const gl = g.createRadialGradient(hx, cy, 4, hx, cy, 90);
        gl.addColorStop(0, `rgba(255,60,50,${0.25 + pulse * 0.35})`); gl.addColorStop(1, "rgba(255,30,40,0)");
        g.fillStyle = gl; g.fillRect(hx - 90, cy - 90, 180, 180);
      }
      g.save();
      g.imageSmoothingEnabled = true;
      g.translate(hx + (hurt ? (Math.random() - 0.5) * 3 : 0), cy);
      g.drawImage(im, -S / 2, -S / 2 - (k - 1) * 20, S, S);
      if (hurt) { g.globalCompositeOperation = "lighter"; g.globalAlpha = hurt * 0.5; g.drawImage(im, -S / 2, -S / 2, S, S); }
      g.restore();
    }
  }

  drawCards(run) {
    const g = this.g;
    for (const cd of run.cards) {
      const d = CARDS[cd.id];
      const [ix, iy] = this.cardXY(cd);
      const pop = this.spikeT?.[cd.w] > 0 ? -5 : 0;
      if (d.kind === "facility") { g.fillStyle = "#1a1220"; g.fillRect(ix + 10, iy + 22, 4, 6); }
      g.drawImage(cardIcon(cd.id), ix, iy + pop);
      if (cd.disabledT > 0) {
        g.fillStyle = "rgba(20,12,28,0.6)"; g.fillRect(ix, iy, 24, 24);
        g.fillStyle = "#ff6a4a"; for (let i = 0; i < 12; i++) { g.fillRect(ix + 6 + i, iy + 6 + i, 1, 1); g.fillRect(ix + 17 - i, iy + 6 + i, 1, 1); }
      }
      if (d.hp) this.bar(ix + 2, iy - 4, 20, cd.hp / d.hp, "#c8a0ff");
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
    const d = this.darkCv.getContext("2d");
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, this.W, this.H);
    const base = this.mode === "golden" ? 0 : 0.12 + this.night * 0.3;
    if (base <= 0.01) return;
    // underground is darker than the open air
    d.fillStyle = `rgba(4,2,10,${base * 0.4})`; d.fillRect(0, 0, this.W, GROUND - 4);
    d.fillStyle = `rgba(4,2,10,${base})`; d.fillRect(0, GROUND - 4, this.W, this.H);
    d.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k = 1) => {
      const gr = d.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const [tx, ty] of this.torches) hole(tx, ty, 34 + Math.sin(this.t * 9 + tx) * 1.5, 0.75);
    for (const z of Object.values(ZONES)) {
      const rm = run.rooms[z.id];
      if (!rm?.open || z.kind === "tunnel" || z.kind === "entrance") continue;
      hole(z.cx, z.y - z.h * 0.4, (z.x1 - z.x0) * 0.55, 0.35);
      if (rm.type === "secret" || rm.type === "lava") hole(z.cx, z.y - 16, (z.x1 - z.x0) * 0.5, 0.6);
    }
    const [hx, hy] = wpXY(HEART_WP);
    if (!this.heartDead) hole(hx, hy - 66, 80 + pulse * 20, 0.95);
    hole(this.gateXY[0], this.gateXY[1], 34, 0.6);
    for (const a of run.advs) if (!a.dead && !a.out) { const [x, y] = this.advXY(a); hole(x + 4, y - 24, 22, 0.7); }
    for (const m of run.monsters) if (m.hp > 0 && (m.species === "wisp" || m.traits.includes("불"))) { const [x, y] = this.monXY(m); hole(x, y - 8, 24, 0.7); }
    for (const l of this.lights) hole(l.x, l.y, l.r, Math.min(1, l.life / l.max));
    for (const it of this.fx) if (it.layer === "over" && it.age < 1.2) hole(it.fx.options.x, it.fx.options.y - 12, 36, 0.6);
    d.globalCompositeOperation = "source-over";
    this.g.imageSmoothingEnabled = true;
    this.g.drawImage(this.darkCv, 0, 0, this.W, this.H);
    this.g.imageSmoothingEnabled = false;
  }

  /** Where things can go: a glowing seam along the valid floor, a ring of reach under the pointer. */
  drawHighlights(run) {
    const g = this.g;
    const t = 0.5 + 0.5 * Math.sin(this.t * 6);
    if (this.targets) {
      g.fillStyle = `rgba(255,70,90,${0.35 + 0.25 * t})`;
      for (const w of this.targets) { const [x, y] = wpXY(w); g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 1); }
    }
    for (const zid of this.zoneTargets) this.zoneOutline(ZONES[zid], `rgba(255,90,110,${0.45 + 0.4 * t})`, zid === this.hoverZone);
    if (this.hoverZone && !this.zoneTargets.includes(this.hoverZone) && this.zoneTargets.length) this.zoneOutline(ZONES[this.hoverZone], "rgba(120,120,140,0.6)", false);
    if (this.hoverW != null && this.hoverCard) {
      const [x, y] = wpXY(this.hoverW), d = this.hoverCard;
      const r = d.kind === "spell" ? spellRadius(d) : d.kind === "monster" ? (d.traits?.some((q) => q === "날개" || q === "원거리") ? 64 : 20) : cardRadius(d);
      g.strokeStyle = this.hoverBad ? "rgba(255,90,90,0.9)" : "rgba(255,230,220,0.95)";
      g.fillStyle = this.hoverBad ? "rgba(255,60,60,0.12)" : "rgba(255,80,100,0.16)";
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y - 2, r, Math.max(4, r * 0.32), 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = this.hoverBad ? "#ff6a6a" : "#ffffff";
      g.fillRect(Math.round(x) - 1, Math.round(y) - 26, 3, 20);
      g.beginPath(); g.moveTo(x - 4, y - 8); g.lineTo(x + 5, y - 8); g.lineTo(x + 0.5, y - 2); g.fill();
    }
    if (this.breach != null && ZONES[this.breach]) this.zoneOutline(ZONES[this.breach], `rgba(255,60,80,${0.5 + 0.5 * t})`, true);
  }
  zoneOutline(z, col, strong) {
    const g = this.g;
    g.strokeStyle = col; g.lineWidth = strong ? 2 : 1;
    const pad = z.kind === "tunnel" ? 4 : 8;
    g.beginPath();
    g.moveTo(z.x0 - pad, z.y + 2);
    const cx = z.cx, hw = (z.x1 - z.x0) / 2 + pad;
    for (let x = z.x0 - pad; x <= z.x1 + pad; x += 3) { const tt = (x - cx) / hw; g.lineTo(x, z.y + 2 - (z.h - 4) * Math.pow(Math.max(0, 1 - tt * tt), 0.45)); }
    g.lineTo(z.x1 + pad, z.y + 2); g.closePath(); g.stroke();
    if (strong) { g.fillStyle = col.replace(/[\d.]+\)$/, "0.12)"); g.fill(); }
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
/** A little chamber with its dressing, for room cards. */
export function roomIcon(type) {
  const k = "room:" + type;
  if (iconCache.has(k)) return iconCache.get(k);
  const cv = document.createElement("canvas");
  cv.width = 96; cv.height = 72;
  const g = cv.getContext("2d");
  g.fillStyle = "#1a1322"; g.fillRect(0, 0, 96, 72);
  for (let y = 4; y < 62; y += 9) { g.fillStyle = "#120d18"; g.fillRect(0, y, 96, 1); for (let x = ((y / 9) % 2) * 9; x < 96; x += 18) g.fillRect(x, y, 1, 9); }
  g.fillStyle = "#4a3650"; g.fillRect(0, 62, 96, 2); g.fillStyle = "#2a1e30"; g.fillRect(0, 64, 96, 8);
  decoZone(g, type, 0, 96, 62, 60, 7);
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
