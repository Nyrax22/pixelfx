// One dive: down the rope picking things up, then back up before the shaft caves in.

import { createFx, painterFor, Rng } from "../../../src/core/index.js";
import * as batFx from "../../../src/fx/critters/bat.js";
import * as burstFx from "../../../src/fx/pickups/collect-burst.js";
import * as sparkFx from "../../../src/fx/impacts/hit-spark.js";
import * as poofFx from "../../../src/fx/spawn/poof.js";
import * as torchFx from "../../../src/fx/fire/torch.js";
import * as beamFx from "../../../src/fx/pickups/loot-beam.js";
import {
  W, H, SHAFT_L, SHAFT_R, PX_PER_M, ITEMS, ITEM, RARITY, ZONES, SEAL_DEPTH, FIRST_DIVE,
  DESCENT_SPEED, ASCENT_K, BAT_HIT_LANTERN, VARIANT_CHANCE,
} from "./data.js";
import { shape, PALS, variantPal, EXPLORER, EXPLORER_PAL, COIN, COIN_PAL, ROCK, ROCK_PAL } from "./sprites.js";
import { drawBackground, fillAmbient, addLight, SURFACE } from "./bg.js";
import { zoneAt } from "./logic.js";
import { audio } from "./audio.js";

const PX = PX_PER_M;
const ANCHOR_Y = -18, ANCHOR_X = (SHAFT_L + SHAFT_R) / 2;
const START_Y = 4;

export const BURST = {
  common: ["#14121a", "#2a2630", "#46404e", "#6a6470", "#9a948e", "#c8c2b8", "#ece6dc", "#ffffff"],
  uncommon: ["#04140a", "#0a3018", "#14582a", "#249a40", "#3fd05a", "#8af08a", "#d4ffd0", "#ffffff"],
  rare: ["#040a1e", "#0a1a46", "#14327a", "#2058c0", "#3c8cff", "#86baff", "#d2e6ff", "#ffffff"],
  epic: ["#14051e", "#300a46", "#561478", "#8a22c0", "#b03cff", "#d086ff", "#f0d2ff", "#ffffff"],
  legendary: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
};
const GLOW_K = { common: 0.12, uncommon: 0.22, rare: 0.4, epic: 0.6, legendary: 0.8 };
const hexNum = (h) => { const v = parseInt(h.slice(1), 16); return (255 << 24) | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255); };
const RCOL = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, hexNum(r.glow)]));
const RTXT = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, r.color]));

export class Run {
  /** save: the save (read only here), st: stats(save), first: the scripted first dive. */
  constructor(save, st, first = false) {
    this.save = save;
    this.st = st;
    this.first = first;
    this.rng = new Rng(((Date.now() & 0xffffff) ^ (save.runs * 7919)) >>> 0);
    this.maxY = st.rope * PX;
    this.state = "idle";      // idle -> descend -> (lanternOut) -> ascend -> done
    this.p = { x: ANCHOR_X, y: START_Y, tx: ANCHOR_X, face: 1, swing: 0 };
    this.camY = this.p.y - 85;
    this.lantern = st.lantern;
    this.helmet = st.helmet;
    this.bag = [];
    this.bagVer = 0;
    this.dropped = [];
    this.seen = {};
    this.coins = 0;
    this.depthMax = 0;
    this.t = 0;
    this.invuln = 0;
    this.shake = 0;
    this.events = [];
    this.fxs = [];
    this.texts = [];
    this.rocks = [];
    this.warns = [];
    this.fallers = [];
    this.rockTimer = 1;
    this.torches = new Map();
    this.zonesSeen = new Set(["village"]);
    this.relit = false;
    this.items = [];
    this.coinList = [];
    this.bats = [];
    this.generate();
  }

  // ------------------------------------------------------------ setup
  generate() {
    const R = this.rng, bookCount = (id) => this.save.book[id]?.count ?? 0;
    const xr = () => R.range(SHAFT_L + 18, SHAFT_R - 18);
    if (this.first) {
      let prev = { x: ANCHOR_X, y: START_Y + 20 };
      for (const f of FIRST_DIVE) {
        const it = { id: f.item, x: SHAFT_L + f.x * (SHAFT_R - SHAFT_L), y: f.m * PX, variant: false };
        // a trail of coins leading to each item teaches the drag without words
        const n = Math.floor((it.y - prev.y) / 14);
        for (let i = 1; i < n; i++) {
          const k = i / n;
          this.coinList.push({ x: prev.x + (it.x - prev.x) * k, y: prev.y + (it.y - prev.y) * k, v: 1 });
        }
        this.items.push(it);
        prev = it;
      }
      return;
    }
    let y = 6 * PX;
    const end = this.maxY + 3 * PX;
    while (y < end) {
      const m = y / PX, zone = zoneAt(m);
      if (zone.coming) break;
      if (R.next() < 0.66) {
        const id = this.rollItem(zone, m, bookCount);
        if (id) this.items.push({ id, x: xr(), y, variant: R.next() < VARIANT_CHANCE });
      } else {
        const n = R.int(3, 5), x0 = R.range(SHAFT_L + 30, SHAFT_R - 30 - n * 9), vert = R.next() < 0.4;
        for (let i = 0; i < n; i++) this.coinList.push({ x: vert ? x0 + 10 : x0 + i * 10, y: y + (vert ? i * 10 : Math.sin(i * 0.9) * -5), v: zone.coinValue });
      }
      y += zone.id === "village" ? R.range(30, 48) : R.range(32, 50);
    }
    // bats: none in the first stretch, more of them deeper
    let by = 25 * PX;
    while (by < this.maxY) {
      const zone = zoneAt(by / PX);
      if (zone.coming || !zone.batEvery) break;
      if (by / PX >= zone.batFrom) {
        this.bats.push({ y0: by, cx: R.range(SHAFT_L + 50, SHAFT_R - 50), amp: R.range(25, 85), sp: R.range(0.5, 1.3), ph: R.range(0, 6.28), alive: true, fx: null, x: 0, y: by, seed: R.int(1, 999) });
      }
      by += R.range(zone.batEvery[0], zone.batEvery[1]) * PX;
    }
  }

  rollItem(zone, m, bookCount) {
    const R = this.rng;
    const pool = ITEMS.filter((it) => it.zone === zone.id && (it.min ?? 0) <= m);
    const rarities = Object.entries(zone.weights).filter(([r]) => pool.some((it) => it.rarity === r));
    let total = rarities.reduce((s, [, w]) => s + w, 0), roll = R.next() * total, rarity = rarities[0]?.[0];
    for (const [r, w] of rarities) if ((roll -= w) < 0) { rarity = r; break; }
    const list = pool.filter((it) => it.rarity === rarity);
    if (!list.length) return null;
    // things you haven't got yet turn up a bit more often
    const ws = list.map((it) => (bookCount(it.id) ? 1 : 2.2));
    let t = R.next() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((t -= ws[i]) < 0) return list[i].id;
    return list[0].id;
  }

  // ------------------------------------------------------------ control
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  get depth() {
    return Math.max(0, Math.floor(this.p.y / PX));
  }
  start() {
    if (this.state !== "idle") return;
    this.state = "descend";
    audio.play("click");
  }
  ascend(reason) {
    if (this.state !== "descend" && this.state !== "lanternOut") return;
    this.state = "ascend";
    this.emit("ascend", { reason });
    audio.play("ascend");
    if (this.p.y > 100 * PX) audio.play("rumble");
  }
  relight(seconds) {
    if (this.state !== "lanternOut") return;
    this.lantern = seconds;
    this.relit = true;
    this.state = "descend";
  }

  // ------------------------------------------------------------ update
  update(dt, input) {
    this.t += dt;
    const p = this.p, st = this.st;
    if (this.invuln > 0) this.invuln -= dt;
    this.shake = Math.max(0, this.shake - dt);

    if (this.state === "descend" || this.state === "ascend") {
      p.tx += input.dx * 1.3 + input.dir * 210 * dt;
      p.tx = Math.max(SHAFT_L + 10, Math.min(SHAFT_R - 10, p.tx));
      const vx = (p.tx - p.x) * Math.min(1, dt * 16);
      p.x += vx;
      if (Math.abs(vx) > 0.15) p.face = vx > 0 ? 1 : -1;
      p.swing += (vx * 0.6 - p.swing) * Math.min(1, dt * 8);
      const speed = DESCENT_SPEED * st.speed;
      if (this.state === "descend") {
        p.y += speed * dt;
        this.lantern -= dt;
        if (p.y >= this.maxY) {
          p.y = this.maxY;
          if (this.maxY >= SEAL_DEPTH * PX) this.emit("seal");
          this.emit("toast", { key: "ropeEnd" });
          this.ascend("rope");
        } else if (this.lantern <= 0) {
          this.lantern = 0;
          this.state = "lanternOut";
          this.emit("lanternOut", { depth: this.depth, relit: this.relit });
        }
      } else {
        p.y -= speed * ASCENT_K * dt;
        this.updateRocks(dt, p.y > 100 * PX);
        if (p.y <= START_Y) {
          p.y = START_Y;
          this.state = "done";
          this.emit("escaped");
          audio.play("escape");
        }
      }
      this.depthMax = Math.max(this.depthMax, this.depth);
      const z = zoneAt(this.depth);
      if (!this.zonesSeen.has(z.id) && !z.coming) {
        this.zonesSeen.add(z.id);
        this.emit("zone", { zone: z.id, depth: z.from });
      }
      this.updateItems(dt);
      this.updateBats(dt);
    } else {
      // idle and done: hang and sway at the top
      p.swing = Math.sin(this.t * 1.6) * 0.8;
      p.x += (p.tx - p.x) * Math.min(1, dt * 4);
    }

    // camera: the explorer high on screen going down (to see what's coming), low going up
    const targetSy = this.state === "ascend" ? 190 : 85;
    const want = p.y - targetSy;
    this.camY += (want - this.camY) * Math.min(1, dt * (this.state === "ascend" || this.state === "descend" ? 7 : 3));

    for (const f of this.fxs) f.fx.update(dt);
    this.fxs = this.fxs.filter((f) => !f.fx.done());
    for (const t of this.texts) { t.t += dt; t.y -= 18 * dt; }
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const f of this.fallers) { f.vy += 400 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.rot += dt * 8; }
    this.fallers = this.fallers.filter((f) => f.y < this.camY + H + 40);
  }

  onScreen(y, pad = 30) {
    return y > this.camY - pad && y < this.camY + H + pad;
  }

  /** The bag slot a find would replace when the bag is full: the least valuable thing, if the find beats it. */
  swapSlot(it) {
    const val = (b) => RARITY[ITEM[b.id].rarity].order * 2 + (b.variant ? 1 : 0);
    let worst = 0;
    for (let j = 1; j < this.bag.length; j++) if (val(this.bag[j]) <= val(this.bag[worst])) worst = j;
    return val(it) > val(this.bag[worst]) ? worst : -1;
  }

  updateItems(dt) {
    const p = this.p, st = this.st, cx = p.x, cy = p.y + 9;
    const room = this.bag.length < st.bag;
    const reach = 12 + st.magnet * 1.5 + (this.first ? 26 : 0);
    for (const it of this.items) {
      if (it.taken || !this.onScreen(it.y, 10)) continue;
      if (this.seen[it.id] == null && it.y < this.camY + H - 10) this.seen[it.id] = Math.floor(it.y / PX);
      const dx = cx - it.x, dy = cy - it.y, d = Math.hypot(dx, dy);
      // with a full bag, only something better than the worst thing in it comes to you
      const slot = room ? -1 : this.swapSlot(it);
      if (!room && slot < 0) {
        if (d < 12 && !it.warned) {
          it.warned = true;
          this.text("FULL", it.x, it.y - 10, "#ff8a6a");
        }
        continue;
      }
      if (d < reach || it.pull) {
        it.pull = true;
        const s = Math.min(d, 300 * dt);
        it.x += (dx / (d || 1)) * s;
        it.y += (dy / (d || 1)) * s;
      }
      if (d < 9) this.take(it, slot);
    }
    for (const c of this.coinList) {
      if (c.taken || !this.onScreen(c.y, 10)) continue;
      const dx = cx - c.x, dy = cy - c.y, d = Math.hypot(dx, dy);
      if (d < reach + 4 || c.pull) {
        c.pull = true;
        const s = Math.min(d, 340 * dt);
        c.x += (dx / (d || 1)) * s;
        c.y += (dy / (d || 1)) * s;
      }
      if (d < 8) {
        c.taken = true;
        this.coins += c.v;
        audio.play("coin");
        this.emit("coin", { total: this.coins });
      }
    }
  }

  take(it, slot = -1) {
    it.taken = true;
    const def = ITEM[it.id], r = def.rarity;
    if (slot >= 0) {
      // out goes the least valuable thing, tumbling away
      const [out] = this.bag.splice(slot, 1, { id: it.id, variant: it.variant });
      this.fallers.push({ ...out, x: this.p.x, y: this.p.y + 10, vx: this.rng.range(-50, 50), vy: -80, rot: 0 });
      this.swapped = (this.swapped ?? 0) + 1;
    } else this.bag.push({ id: it.id, variant: it.variant });
    this.bagVer++;
    this.seen[it.id] ??= Math.floor(it.y / PX);
    this.fxs.push({ fx: createFx(burstFx, { palette: BURST[r], seed: this.rng.int(1, 999), light: 0.9 }), x: it.x, y: it.y + 30 });
    const known = (this.save.book[it.id]?.count ?? 0) > 0 || this.bag.filter((b) => b.id === it.id).length > 1;
    if (!known || it.variant) {
      this.text(it.variant ? "VARIANT!" : "NEW!", it.x, it.y - 14, RTXT[r], "big");
      audio.play("newItem");
    } else audio.play("pickup", RARITY[r].order);
    if (slot >= 0) this.text("SWAP", this.p.x, this.p.y - 6, "#9ad0ff");
    this.emit("pickup", { id: it.id, variant: it.variant, isNew: !known });
    if (this.bag.length >= this.st.bag && slot < 0) this.emit("toast", { key: "bagFull" });
  }

  updateBats(dt) {
    const p = this.p, cx = p.x, cy = p.y + 8;
    for (const b of this.bats) {
      if (!b.alive) continue;
      if (!this.onScreen(b.y0, 60)) {
        if (b.fx && Math.abs(b.y0 - this.p.y) > H * 2) b.fx = null;
        continue;
      }
      b.fx ??= createFx(batFx, { seed: b.seed });
      b.x = b.cx + Math.sin(this.t * b.sp + b.ph) * b.amp;
      b.y = b.y0 + Math.sin(this.t * 2.2 + b.ph) * 5;
      b.fx.update(dt);
      const d = Math.hypot(cx - b.x, cy - b.y);
      if (this.state === "ascend") {
        // going up, bats just get out of the way
        if (d < 30) this.scare(b);
        continue;
      }
      if (d < 14 && this.invuln <= 0) {
        b.alive = false;
        this.invuln = 0.8;
        this.shake = 0.25;
        this.lantern = Math.max(0.01, this.lantern - BAT_HIT_LANTERN);
        this.fxs.push({ fx: createFx(sparkFx, { angle: Math.atan2(cy - b.y, cx - b.x), seed: this.rng.int(1, 99) }), x: (cx + b.x) / 2, y: (cy + b.y) / 2 + 20 });
        this.fxs.push({ fx: createFx(poofFx, { palette: ["#120c18", "#2a2036", "#4a3a5a", "#6a5a7a", "#9a8aaa", "#c8bad8"], seed: b.seed }), x: b.x, y: b.y + 30 });
        this.text(`-${BAT_HIT_LANTERN}s`, cx, cy - 18, "#ffb04a", "big");
        audio.play("hit");
        this.emit("hit");
      }
    }
  }
  scare(b) {
    b.alive = false;
    this.fxs.push({ fx: createFx(poofFx, { palette: ["#120c18", "#2a2036", "#4a3a5a", "#6a5a7a", "#9a8aaa", "#c8bad8"], seed: b.seed }), x: b.x, y: b.y + 30 });
  }

  updateRocks(dt, spawn) {
    const p = this.p, R = this.rng, m = p.y / PX;
    if (!spawn) this.warns = [];
    this.rockTimer -= dt;
    if (spawn && this.rockTimer <= 0) {
      const k = Math.min(1, (m - 100) / 200);
      this.rockTimer = 1.35 - k * 0.75 + R.range(-0.15, 0.15);
      const x = Math.max(SHAFT_L + 10, Math.min(SHAFT_R - 10, p.x + R.range(-55, 55)));
      this.warns.push({ x, t: 0.7 });
    }
    for (const w of this.warns) {
      w.t -= dt;
      if (w.t <= 0) this.rocks.push({ x: w.x, y: this.camY - 12, vy: 160, rot: 0, s: R.next() < 0.5 });
    }
    this.warns = this.warns.filter((w) => w.t > 0);
    const cx = p.x, cy = p.y + 8;
    for (const r of this.rocks) {
      r.vy += 280 * dt;
      r.y += r.vy * dt;
      if (!r.hit && this.invuln <= 0 && Math.hypot(cx - r.x, cy - r.y) < 10) {
        r.hit = true;
        this.rockHit(r);
      }
    }
    this.rocks = this.rocks.filter((r) => !r.hit && r.y < this.camY + H + 20);
  }

  rockHit(r) {
    const p = this.p;
    this.invuln = 1;
    this.shake = 0.35;
    this.fxs.push({ fx: createFx(sparkFx, { angle: Math.PI / 2, seed: this.rng.int(1, 99), palette: ["#2a2430", "#5e5464", "#9a8e9e", "#cec4c8", "#fff3a6", "#ffffff", "#ffffff"] }), x: p.x, y: p.y + 20 });
    if (this.helmet > 0) {
      this.helmet--;
      audio.play("clang");
      this.text("BLOCK", p.x, p.y - 10, "#ffe06a", "big");
      this.emit("toast", { key: "helmetSave" });
      return;
    }
    if (!this.bag.length) {
      audio.play("hit");
      return;
    }
    // lose the least valuable thing in the bag
    let i = 0;
    for (let j = 1; j < this.bag.length; j++)
      if (RARITY[ITEM[this.bag[j].id].rarity].order <= RARITY[ITEM[this.bag[i].id].rarity].order) i = j;
    const [lost] = this.bag.splice(i, 1);
    this.bagVer++;
    this.dropped.push(lost);
    this.fallers.push({ ...lost, x: p.x, y: p.y + 10, vx: this.rng.range(-40, 40), vy: -60, rot: 0 });
    audio.play("drop");
    this.text("-1", p.x, p.y - 10, "#ff6a6a", "big");
    this.emit("drop", { id: lost.id });
  }

  text(str, x, y, color, font = "mini") {
    this.texts.push({ str, x, y, color, font, t: 0, life: font === "big" ? 1.1 : 0.8 });
  }

  // ------------------------------------------------------------ draw
  draw(frame, lm) {
    const camY = Math.round(this.camY), p = this.p, t = this.t;
    const sx = (x) => Math.round(x), sy = (y) => Math.round(y - camY);
    drawBackground(frame, camY);
    fillAmbient(lm, camY);

    // torches on the walls, every 150 px, alternating sides
    const first = Math.max(0, Math.floor((camY - 60) / 150)), last = Math.floor((camY + H + 60) / 150);
    for (let i = first; i <= last; i++) {
      const wy = 60 + i * 150;
      if (wy > this.maxY + 200 && wy > SEAL_DEPTH * PX) continue;
      let f = this.torches.get(i);
      const left = i % 2 === 0;
      if (!f) this.torches.set(i, (f = createFx(torchFx, { seed: i + 3, flip: !left, x: 0, y: 0 })));
      f.options.x = left ? SHAFT_L - 7 : SHAFT_R + 7;
      f.options.y = sy(wy);
      f.update(1 / 60);
      f.draw(frame);
      addLight(lm, f.options.x + (left ? 6 : -6), f.options.y - 22, 62, 0.55 + Math.sin(t * 9 + i) * 0.04);
    }
    for (const k of this.torches.keys()) if (k < first - 4 || k > last + 4) this.torches.delete(k);

    let P = painterFor(frame);
    // the rope's anchor: a beam across the top of the shaft on two posts
    if (camY < 10) {
      P.rect(SHAFT_L - 8, sy(ANCHOR_Y) - 3, SHAFT_R - SHAFT_L + 16, 5, 0xff1a2a4a);
      P.rect(SHAFT_L - 8, sy(ANCHOR_Y) - 3, SHAFT_R - SHAFT_L + 16, 1, 0xff3a5a8a);
      P.rect(SHAFT_L - 8, sy(ANCHOR_Y) - 3, 5, -sy(ANCHOR_Y) + sy(SURFACE) + 3, 0xff1a2a4a);
      P.rect(SHAFT_R + 3, sy(ANCHOR_Y) - 3, 5, -sy(ANCHOR_Y) + sy(SURFACE) + 3, 0xff1a2a4a);
      P.circle(ANCHOR_X, sy(ANCHOR_Y), 3, 0xff6a6a7a);
    }

    // the seal at the bottom of the mine
    const sealY = sy(SEAL_DEPTH * PX);
    if (sealY > -20 && sealY < H + 20) {
      for (let x = SHAFT_L; x < SHAFT_R; x++) {
        const w = Math.sin(x * 0.2 + t * 3) * 1.5;
        P.dot(x, sealY + w, 0xffffe0b0, 0.9);
        P.light(x, sealY + w, 0xffffc84a, 0.5);
      }
      for (let i = 0; i < 5; i++) {
        const gx = SHAFT_L + 24 + i * 48;
        P.ring(gx, sealY + 6, 7 + Math.sin(t * 2 + i) * 1, 1.4, 0xffffd890);
        P.glow(gx, sealY + 6, 18, 0xffff9a3a, 0.45);
      }
    }

    // coins
    for (const c of this.coinList) {
      if (c.taken || !this.onScreen(c.y)) continue;
      const fi = Math.floor(t * 8 + c.x * 0.1) % 4, fr = COIN[fi === 3 ? 1 : fi];
      P.sprite(fr, COIN_PAL, sx(c.x) - 3, sy(c.y) - 3);
      P.glow(c.x, sy(c.y), 6, 0xff1a6ad0, 0.25);
    }

    // items, glowing in their rarity's color
    for (const it of this.items) {
      if (it.taken || !this.onScreen(it.y)) continue;
      const def = ITEM[it.id], rows = shape(def.sprite), pal = it.variant ? variantPal(def.pal) : PALS[def.pal];
      const bob = Math.sin(t * 3 + it.x) * 1.5, ix = sx(it.x), iy = sy(it.y + bob);
      if (def.rarity === "epic" || def.rarity === "legendary") {
        it.beam ??= createFx(beamFx, { palette: BURST[def.rarity], seed: 4, light: 0.6 });
        it.beam.options.x = ix;
        it.beam.options.y = iy + 8;
        it.beam.update(1 / 60);
        it.beam.draw(frame);
        P = painterFor(frame);
      }
      const col = it.variant ? hueCol(t * 0.5 + it.x) : RCOL[def.rarity];
      P.glow(ix, iy, 14, col, GLOW_K[def.rarity] * (0.85 + Math.sin(t * 4 + it.x) * 0.15) + (it.variant ? 0.3 : 0));
      addLight(lm, ix, iy, 16, 0.25);
      P.sprite(rows, pal, ix - (rows[0].length >> 1), iy - (rows.length >> 1));
      if (RARITY[def.rarity].order >= 2 || it.variant) {
        const a = t * 2 + it.x, r = 9;
        P.light(ix + Math.cos(a) * r, iy + Math.sin(a) * r, 0xffffffff, 0.8);
        P.light(ix - Math.cos(a) * r, iy - Math.sin(a) * r, col, 0.6);
      }
    }

    // bats
    for (const b of this.bats) {
      if (!b.alive || !b.fx || !this.onScreen(b.y0, 60)) continue;
      b.fx.options.x = sx(b.x);
      b.fx.options.y = sy(b.y);
      b.fx.draw(frame);
    }
    P = painterFor(frame);

    // the rope and the explorer
    const px = sx(p.x), py = sy(p.y), hx = px, hy = py;
    const ax = ANCHOR_X, ay = sy(ANCHOR_Y);
    P.line(ax, Math.max(ay, -2), hx, hy, 0xff3a6a9a);
    P.line(ax + 1, Math.max(ay, -2), hx + 1, hy, 0xff6aa0d0);
    const blink = this.invuln > 0 && Math.floor(t * 20) % 2 === 0;
    if (!blink) {
      const fr = EXPLORER[Math.abs(p.swing) > 0.6 || Math.floor(t * 2.5) % 2 ? 1 : 0];
      P.sprite(fr, EXPLORER_PAL, px - 5, py, { flip: p.face < 0 });
    }
    const lampX = px + (p.face < 0 ? -4 : 4), lampY = py + 4;
    const lr = this.state === "done" || this.state === "idle" ? 1 : Math.max(0, Math.min(1, this.lantern / this.st.lantern));
    const flick = 1 + Math.sin(t * 13) * 0.02 + (lr < 0.25 ? Math.sin(t * 31) * 0.08 : 0);
    addLight(lm, lampX, lampY + 6, (48 + 62 * lr) * flick, 0.95 * Math.max(0.35, lr));
    P.glow(lampX, lampY, 10, 0xff60c0ff, 0.45);

    // rocks, warnings and things falling out of the bag
    for (const r of this.rocks) P.sprite(ROCK, ROCK_PAL, sx(r.x) - 4, sy(r.y) - 4, { flip: r.s });
    for (const w of this.warns) {
      if (Math.floor(w.t * 10) % 2) continue;
      P.tri(w.x, 3, w.x - 5, 12, w.x + 5, 12, 0xff2a2aff);
      P.rect(w.x, 5, 1, 4, 0xffffffff);
      P.dot(w.x, 10, 0xffffffff);
      P.glow(w.x, 8, 12, 0xff2a2aff, 0.6);
    }
    for (const f of this.fallers) {
      const def = ITEM[f.id], rows = shape(def.sprite);
      P.sprite(rows, f.variant ? variantPal(def.pal) : PALS[def.pal], sx(f.x) - 6, sy(f.y) - 6, { flipY: Math.floor(f.rot) % 2 === 1 });
    }

    for (const f of this.fxs) {
      f.fx.options.x = sx(f.x);
      f.fx.options.y = sy(f.y);
      f.fx.draw(frame);
    }
    P = painterFor(frame);
    for (const tx of this.texts) {
      const a = Math.min(1, (tx.life - tx.t) * 4);
      P.text(tx.str, sx(tx.x), sy(tx.y), hexNum(tx.color), { font: tx.font, align: "center", outline: 0xff0a0810, a });
      addLight(lm, sx(tx.x), sy(tx.y) + 3, 26, 1.1);
    }
  }
}

function hueCol(h) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return Math.round((0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (255 << 24) | (f(4) << 16) | (f(8) << 8) | f(0);
}
