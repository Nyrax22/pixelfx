// One expedition: walk, jump, climb and dig through the cave, grab what you can, and get out alive.

import { createFx, painterFor, Rng } from "../../../src/core/index.js";
import * as batFx from "../../../src/fx/critters/bat.js";
import * as slimeFx from "../../../src/fx/critters/slime.js";
import * as burstFx from "../../../src/fx/pickups/collect-burst.js";
import * as sparkFx from "../../../src/fx/impacts/hit-spark.js";
import * as poofFx from "../../../src/fx/spawn/poof.js";
import * as torchFx from "../../../src/fx/fire/torch.js";
import * as beamFx from "../../../src/fx/pickups/loot-beam.js";
import { W, H, T, MW, MH, ITEM, RARITY, SEAL_DEPTH, PHYS, DIG, STONE_PICK, DARK_DRAIN, ROPE_LEN } from "./data.js";
import { shape, PALS, variantPal, EXPLORER, EXPLORER_PAL, COIN, COIN_PAL, LADDER_TILE, LADDER_PAL, ROPE_TILE, ROPE_PAL, SPIKES_TILE, SPIKES_PAL, BAT_HANG, BAT_HANG_PAL } from "./sprites.js";
import { makeCave, AIR, DIRT, STONE, BEDROCK, GOLD, GEM, BRICK, WOOD, SOLID, MAT_NAME, NONE, LADDER, SPIKES, ROPE, WINCH, TORCH } from "./cave.js";
import { drawCave, fillAmbient, addLight } from "./bg.js";
import { zoneAt } from "./logic.js";
import { audio } from "./audio.js";

export const BURST = {
  common: ["#14121a", "#2a2630", "#46404e", "#6a6470", "#9a948e", "#c8c2b8", "#ece6dc", "#ffffff"],
  uncommon: ["#04140a", "#0a3018", "#14582a", "#249a40", "#3fd05a", "#8af08a", "#d4ffd0", "#ffffff"],
  rare: ["#040a1e", "#0a1a46", "#14327a", "#2058c0", "#3c8cff", "#86baff", "#d2e6ff", "#ffffff"],
  epic: ["#14051e", "#300a46", "#561478", "#8a22c0", "#b03cff", "#d086ff", "#f0d2ff", "#ffffff"],
  legendary: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
};
const GLOW_K = { common: 0.14, uncommon: 0.24, rare: 0.42, epic: 0.6, legendary: 0.8 };
const hexNum = (h) => { const v = parseInt(h.slice(1), 16); return (255 << 24) | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255); };
const RCOL = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, hexNum(r.glow)]));
const RTXT = Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, r.color]));
const DEBRIS = { [DIRT]: ["#6a4630", "#4a2e1e", "#8a6a4a"], [STONE]: ["#6a6a78", "#4a4a58", "#9a9aa8"], [GOLD]: ["#f0b424", "#6a4630", "#fff0a0"], [GEM]: ["#4ad0ff", "#585c6c", "#e0ffff"], [BRICK]: ["#7a4a3a", "#5a3020", "#a06a50"], [WOOD]: ["#7a5230", "#5a3a20", "#b07a40"] };
const POOF_DARK = ["#120c18", "#2a2036", "#4a3a5a", "#6a5a7a", "#9a8aaa", "#c8bad8"];
const PW = 10, PH = 15; // the explorer's box

export class Run {
  constructor(save, st, first = false) {
    this.save = save;
    this.st = st;
    this.first = first;
    const seed = ((Date.now() & 0xffffff) ^ (save.runs * 7919)) >>> 0;
    this.rng = new Rng(seed);
    this.cave = makeCave(seed, save, first);
    this.tile = this.cave.tile;
    this.deco = this.cave.deco;
    const e = this.cave.entrance;
    this.p = { x: (e.ladderX + 2) * T + 2, y: e.floorY * T - PH, vx: 0, vy: 0, face: 1, ground: false, climb: false, coyote: 0, buf: 0, fallTop: 0, walk: 0, jumpHeld: false };
    this.p.fallTop = this.p.y;
    this.camX = 0;
    this.camY = 0;
    this.snapCamera();
    this.state = "play";       // play -> winch -> done, or play -> dead
    this.hp = st.hearts;
    this.lantern = st.lantern;
    this.ropes = st.ropes;
    this.darkT = 0;
    this.lanternOutSent = false;
    this.bag = [];
    this.bagVer = 0;
    this.seen = {};
    this.coins = 0;
    this.depthMax = 0;
    this.t = 0;
    this.invuln = 0;
    this.shake = 0;
    this.events = [];
    this.fxs = [];
    this.texts = [];
    this.debris = [];
    this.popCoins = [];
    this.dig = new Map();
    this.digTick = 0;
    this.warnedHard = new Set();
    this.torches = new Map();
    this.zonesSeen = new Set(["village"]);
    this.sealSent = false;
    this.relit = false;
    this.revived = false;
    this.items = this.cave.items.map((it) => ({ ...it, x: it.tx * T + 8, y: it.ty * T + 9 }));
    this.coinList = this.cave.coins.map((c) => ({ ...c, x: c.tx * T + 8, y: c.ty * T + 11 }));
    this.enemies = this.cave.enemies.map((en) => en.kind === "bat"
      ? { ...en, x: en.tx * T + 8, y: en.ty * T + 4, state: "hang", vx: 0, vy: 0, alive: true, fx: null }
      : { ...en, x: en.tx * T + 8, y: (en.ty + 1) * T, vx: (en.seed & 1 ? 1 : -1) * 22, alive: true, fx: null });
  }

  // ------------------------------------------------------------ the map
  tileAt(tx, ty) {
    if (tx < 0 || tx >= MW || ty >= MH) return BEDROCK;
    if (ty < 0) return AIR;
    return this.tile[ty * MW + tx];
  }
  solid(tx, ty) {
    return SOLID[this.tileAt(tx, ty)];
  }
  decoAt(tx, ty) {
    return tx < 0 || tx >= MW || ty < 0 || ty >= MH ? NONE : this.deco[ty * MW + tx];
  }
  /** The top rung of a ladder or rope: something to stand on unless you're holding down. */
  ladderTop(tx, ty) {
    const d = this.decoAt(tx, ty), u = this.decoAt(tx, ty - 1);
    return (d === LADDER || d === ROPE) && u !== LADDER && u !== ROPE && !this.solid(tx, ty - 1);
  }
  standable(tx, ty) {
    return this.solid(tx, ty) || (!this.downHeld && this.ladderTop(tx, ty));
  }
  climbable(px, py) {
    const d = this.decoAt(Math.floor(px / T), Math.floor(py / T));
    return d === LADDER || d === ROPE;
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  get depth() {
    return Math.max(0, Math.floor((this.p.y + PH) / T));
  }
  /** The nearest way out above the explorer: the entrance or a winch. */
  nearestExit() {
    let best = this.depth;
    for (const w of this.cave.winches) if (w.y <= this.depth + 2 && this.depth - w.y < best) best = Math.max(0, this.depth - w.y);
    return best;
  }

  // ------------------------------------------------------------ update
  update(dt, input) {
    this.t += dt;
    if (this.invuln > 0) this.invuln -= dt;
    this.shake = Math.max(0, this.shake - dt);
    const p = this.p;

    if (this.state === "play") {
      this.updateLantern(dt);
      this.updatePlayer(dt, input);
      if (this.state === "play") {
        this.updateItems(dt);
        this.updateEnemies(dt);
        this.updateHazards();
      }
      this.depthMax = Math.max(this.depthMax, this.depth);
      const z = zoneAt(this.depth);
      if (!this.zonesSeen.has(z.id) && !z.coming) {
        this.zonesSeen.add(z.id);
        this.emit("zone", { zone: z.id, depth: z.from });
      }
      if (!this.sealSent && this.depth >= SEAL_DEPTH - 4) {
        this.sealSent = true;
        this.emit("seal");
      }
    } else if (this.state === "winch") {
      // hauled up and out
      this.winchT += dt;
      p.y -= (120 + this.winchT * 500) * dt;
      p.x += (this.winchX - p.x) * Math.min(1, dt * 10);
      if (this.winchT > 1.3) this.escape();
    }

    // camera: keep the explorer a little above center so you see what's below
    const tx = Math.max(0, Math.min(MW * T - W, p.x + PW / 2 - W / 2));
    const ty = Math.max(-140, Math.min(MH * T - H, p.y - H / 2 + 20));
    const k = Math.min(1, dt * 8);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;

    for (const f of this.fxs) f.fx.update(dt);
    this.fxs = this.fxs.filter((f) => !f.fx.done());
    for (const t of this.texts) { t.t += dt; t.y -= 16 * dt; }
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const d of this.debris) {
      d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt;
      if (this.solid(Math.floor(d.x / T), Math.floor(d.y / T))) { d.vy *= -0.3; d.vx *= 0.6; d.y -= 1; }
    }
    this.debris = this.debris.filter((d) => d.life > 0);
  }
  snapCamera() {
    this.camX = Math.max(0, Math.min(MW * T - W, this.p.x + PW / 2 - W / 2));
    this.camY = Math.max(-140, Math.min(MH * T - H, this.p.y - H / 2 + 20));
  }

  updateLantern(dt) {
    if (this.first) return; // the first dive is about grabbing and getting out
    this.lantern -= dt;
    if (this.lantern > 0) return;
    this.lantern = 0;
    if (!this.lanternOutSent) {
      this.lanternOutSent = true;
      this.emit("lanternOut", { relit: this.relit });
    }
    this.darkT += dt;
    if (this.darkT >= DARK_DRAIN) {
      this.darkT = 0;
      this.hurt(1, "dark");
    }
  }

  updatePlayer(dt, input) {
    const p = this.p, P = PHYS;
    this.downHeld = input.down;
    if (input.jumpPressed) p.buf = P.jumpBuffer;
    else p.buf = Math.max(0, p.buf - dt);
    p.coyote = p.ground ? P.coyote : Math.max(0, p.coyote - dt);
    const cx = p.x + PW / 2, cy = p.y + PH / 2;

    // ladders and ropes: up or down on one grabs it
    const onLadder = this.climbable(cx, cy) || this.climbable(cx, p.y + 2);
    const ladderBelow = p.ground && this.climbable(cx, p.y + PH + 2);
    if (!p.climb && ((onLadder && input.up) || (input.down && (ladderBelow || (onLadder && !p.ground))))) {
      p.climb = true;
      p.vx = 0;
      p.vy = 0;
    }
    if (p.climb && !onLadder && !ladderBelow) p.climb = false;
    if (p.climb && p.buf > 0 && !input.up) {
      p.climb = false;
      p.buf = 0;
      p.vy = -P.jump * 0.75;
      audio.play("jump");
    }

    if (p.climb) {
      p.vy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * P.climb;
      p.vx = input.dir * 45;
      // drift onto the ladder's line
      const lx = Math.floor(cx / T) * T + T / 2 - PW / 2;
      if (!input.dir) p.x += (lx - p.x) * Math.min(1, dt * 12);
      p.walk += Math.abs(p.vy) * dt;
      p.fallTop = p.y;
    } else {
      const target = input.dir * P.walk;
      const a = P.accel * (p.ground ? 1 : 0.7) * dt;
      p.vx = p.vx < target ? Math.min(target, p.vx + a) : Math.max(target, p.vx - a);
      p.vy = Math.min(P.maxFall, p.vy + P.gravity * dt);
      if (p.buf > 0 && p.coyote > 0) {
        p.vy = -P.jump;
        p.buf = 0;
        p.coyote = 0;
        p.ground = false;
        audio.play("jump");
      }
      // let go of jump early for a short hop
      if (!input.jump && p.jumpHeld && p.vy < -120) p.vy = -120;
      if (p.ground) p.walk += Math.abs(p.vx) * dt;
    }
    p.jumpHeld = input.jump;
    if (input.dir) p.face = input.dir;

    // move and collide, one axis at a time
    const wasGround = p.ground;
    const blockedX = this.moveX(p.vx * dt);
    const hitY = this.moveY(p.vy * dt);
    const fy = Math.floor((p.y + PH + 1) / T), onTop = p.y + PH <= fy * T + 0.5;
    p.ground = hitY > 0 || (p.climb ? false : (this.solid(Math.floor((p.x + 1) / T), fy) || this.solid(Math.floor((p.x + PW - 1) / T), fy) || (onTop && (this.standable(Math.floor((p.x + 1) / T), fy) || this.standable(Math.floor((p.x + PW - 1) / T), fy)))));
    if (p.ground && p.vy > 0) p.vy = 0;
    if (!p.ground && !p.climb) p.fallTop = Math.min(p.fallTop, p.y);
    if (p.ground && !wasGround && !p.climb) {
      const fell = (p.y - p.fallTop) / T;
      if (fell > P.fallHurt2) this.hurt(2, "fall");
      else if (fell > P.fallHurt) this.hurt(1, "fall");
      else if (fell > 1.5) audio.play("land");
      this.dust(p.x + PW / 2, p.y + PH, 4);
    }
    if (p.ground || p.climb) p.fallTop = p.y;

    // digging: push into a wall, hold down on the ground, or climb up into a ceiling
    let target = null;
    if (p.ground && input.dir && blockedX) target = [Math.floor((input.dir > 0 ? p.x + PW + 1 : p.x - 1) / T), Math.floor((p.y + PH - 2) / T)];
    else if (p.ground && input.down && !ladderBelow && !input.dir) target = [Math.floor(cx / T), Math.floor((p.y + PH + 1) / T)];
    else if (p.climb && input.up && hitY < 0) target = [Math.floor(cx / T), Math.floor((p.y - 1) / T)];
    if (target) this.digAt(target[0], target[1], dt);

    // a thrown rope hangs from the ceiling above down to here
    if (input.ropePressed) this.throwRope();

    // winches: stand at one and press up
    const wtx = Math.floor(cx / T), wty = Math.floor((p.y + PH - 1) / T);
    if (this.decoAt(wtx, wty) === WINCH || this.decoAt(wtx, wty + 1) === WINCH) {
      if (!this.atWinch) { this.atWinch = true; this.emit("toast", { key: "winchHint" }); }
      if (input.up) {
        this.state = "winch";
        this.winchT = 0;
        this.winchX = wtx * T + T / 2 - PW / 2;
        audio.play("ascend");
      }
    } else this.atWinch = false;

    // out through the top of the entrance
    if (p.y < 1) this.escape();
  }

  /** Move along x; returns true if a wall stopped the move. */
  moveX(dx) {
    const p = this.p;
    if (!dx) return false;
    p.x += dx;
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH - 0.01) / T);
    if (dx > 0) {
      const tx = Math.floor((p.x + PW - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { p.x = tx * T - PW; p.vx = 0; return true; }
    } else {
      const tx = Math.floor(p.x / T);
      for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { p.x = (tx + 1) * T; p.vx = 0; return true; }
    }
    return false;
  }
  /** Move along y; returns 1 on landing, -1 on bumping a ceiling, 0 otherwise. */
  moveY(dy) {
    const p = this.p;
    if (!dy) return 0;
    p.y += dy;
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor((p.y + PH - 0.01) / T), wasAbove = p.y - dy + PH <= ty * T + 0.5;
      for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty) || (wasAbove && !p.climb && this.standable(tx, ty))) { p.y = ty * T - PH; p.vy = 0; return 1; }
    } else {
      const ty = Math.floor(p.y / T);
      for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) { p.y = (ty + 1) * T; p.vy = 0; return -1; }
    }
    return 0;
  }

  digAt(tx, ty, dt) {
    const m = this.tileAt(tx, ty);
    if (!SOLID[m] || ty < 1) return;
    const i = ty * MW + tx;
    if (m === BEDROCK) return;
    if ((m === STONE || m === GEM) && this.st.pick < STONE_PICK) {
      if (!this.warnedHard.has(i)) {
        this.warnedHard.add(i);
        this.emit("toast", { key: "tooHard" });
        audio.play("clang");
      }
      return;
    }
    const prog = (this.dig.get(i) ?? 0) + (dt * this.st.pick) / DIG[MAT_NAME[m]];
    this.digTick -= dt;
    if (this.digTick <= 0) {
      this.digTick = 0.13;
      audio.play("dig");
      this.chips(tx, ty, m, 2);
    }
    if (prog < 1) { this.dig.set(i, prog); return; }
    this.dig.delete(i);
    this.tile[i] = AIR;
    this.chips(tx, ty, m, 10);
    audio.play("break");
    // ore pays out in coins that pop loose
    if (m === GOLD || m === GEM) {
      const n = m === GEM ? 5 : 3, v = zoneAt(ty).coinValue * (m === GEM ? 2 : 1);
      for (let k = 0; k < n; k++) this.popCoins.push({ x: tx * T + 8, y: ty * T + 8, vx: this.rng.range(-70, 70), vy: this.rng.range(-170, -80), v, t: 0 });
      audio.play("coin");
    }
    // a thrown rope or ladder above stays; things resting on this tile fall
    for (const en of this.enemies) if (en.kind === "slime" && Math.floor(en.x / T) === tx && Math.floor((en.y + 1) / T) === ty) en.falling = true;
  }

  throwRope() {
    const p = this.p;
    if (this.ropes <= 0) return this.emit("toast", { key: "noRope" });
    const tx = Math.floor((p.x + PW / 2) / T), ty = Math.floor((p.y + PH - 1) / T);
    // find the ceiling above, then hang the rope from it down to the floor
    let top = ty;
    while (top > 0 && ty - top < ROPE_LEN && !this.solid(tx, top - 1)) top--;
    let bot = ty;
    while (bot < MH - 1 && !this.solid(tx, bot + 1) && bot - top < ROPE_LEN + 4) bot++;
    if (top === ty && bot === ty) return;
    this.ropes--;
    for (let y = top; y <= bot; y++) if (this.deco[y * MW + tx] === NONE) this.deco[y * MW + tx] = ROPE;
    audio.play("rope");
    this.emit("rope");
  }

  updateItems(dt) {
    const p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (const it of this.items) {
      if (it.taken) continue;
      const dx = cx - it.x, dy = cy - it.y;
      if (Math.abs(dx) > 260 || Math.abs(dy) > 160) continue;
      if (this.seen[it.id] == null && Math.abs(dx) < 150 && Math.abs(dy) < 110) this.seen[it.id] = it.ty;
      if (Math.abs(dx) > 11 || Math.abs(dy) > 13) continue;
      const room = this.bag.length < this.st.bag, slot = room ? -1 : this.swapSlot(it);
      if (!room && slot < 0) {
        if (!it.warned) { it.warned = true; this.text("FULL", it.x, it.y - 10, "#ff8a6a"); }
        continue;
      }
      this.take(it, slot);
    }
    const grab = (c) => {
      const dx = cx - c.x, dy = cy - c.y, d = Math.hypot(dx, dy);
      if (d < 26) { const s = Math.min(d, 260 * dt); c.x += (dx / (d || 1)) * s; c.y += (dy / (d || 1)) * s; }
      if (d < 9) {
        c.taken = true;
        this.coins += c.v;
        audio.play("coin");
        this.emit("coin");
      }
    };
    for (const c of this.coinList) if (!c.taken && Math.abs(c.y - cy) < 60) grab(c);
    for (const c of this.popCoins) {
      if (c.taken) continue;
      c.t += dt;
      if (c.t < 0.35) {
        c.vy += 600 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (this.solid(Math.floor(c.x / T), Math.floor(c.y / T))) { c.y -= c.vy * dt; c.vy *= -0.4; c.vx *= 0.5; }
      } else {
        const dx = cx - c.x, dy = cy - c.y, d = Math.hypot(dx, dy), s = Math.min(d, 320 * dt);
        c.x += (dx / (d || 1)) * s; c.y += (dy / (d || 1)) * s;
        if (d < 8) grab(c);
      }
    }
    this.popCoins = this.popCoins.filter((c) => !c.taken);
  }
  swapSlot(it) {
    const val = (b) => RARITY[ITEM[b.id].rarity].order * 2 + (b.variant ? 1 : 0);
    let worst = 0;
    for (let j = 1; j < this.bag.length; j++) if (val(this.bag[j]) <= val(this.bag[worst])) worst = j;
    return val(it) > val(this.bag[worst]) ? worst : -1;
  }
  take(it, slot = -1) {
    it.taken = true;
    const r = ITEM[it.id].rarity;
    if (slot >= 0) {
      const [out] = this.bag.splice(slot, 1, { id: it.id, variant: it.variant });
      // the swapped-out thing is left lying where the new one was
      this.items.push({ id: out.id, variant: out.variant, tx: it.tx, ty: it.ty, x: it.x, y: it.y, warned: true });
      this.text("SWAP", this.p.x + 5, this.p.y - 8, "#9ad0ff");
    } else this.bag.push({ id: it.id, variant: it.variant });
    this.bagVer++;
    this.seen[it.id] ??= it.ty;
    this.fxs.push({ fx: createFx(burstFx, { palette: BURST[r], seed: this.rng.int(1, 999), light: 0.9 }), x: it.x, y: it.y + 30 });
    const known = (this.save.book[it.id]?.count ?? 0) > 0 || this.bag.filter((b) => b.id === it.id).length > 1;
    if (!known || it.variant) {
      this.text(it.variant ? "VARIANT!" : "NEW!", it.x, it.y - 14, RTXT[r], "big");
      audio.play("newItem");
    } else audio.play("pickup", RARITY[r].order);
    this.emit("pickup", { id: it.id, isNew: !known });
    if (this.bag.length >= this.st.bag && slot < 0) this.emit("toast", { key: "bagFull" });
    if (this.first && this.bag.length >= 3) this.emit("toast", { key: "exitHint" });
  }

  updateEnemies(dt) {
    const p = this.p, px = p.x + PW / 2, py = p.y + PH / 2;
    for (const en of this.enemies) {
      if (!en.alive) continue;
      const dx = px - en.x, dy = py - en.y;
      if (Math.abs(dx) > W || Math.abs(dy) > H) { en.fx = null; continue; }
      if (en.kind === "bat") {
        if (en.state === "hang") {
          if (Math.hypot(dx, dy) < 84) { en.state = "fly"; audio.play("squeak"); }
          continue;
        }
        en.fx ??= createFx(batFx, { seed: en.seed });
        en.fx.update(dt);
        const d = Math.hypot(dx, dy) || 1, sp = 52;
        const wob = Math.sin(this.t * 5 + en.seed) * 30;
        const vx = (dx / d) * sp - (dy / d) * wob * 0.3, vy = (dy / d) * sp + (dx / d) * wob * 0.3 + Math.sin(this.t * 7 + en.seed) * 20;
        // bats keep out of the rock
        if (!this.solid(Math.floor((en.x + vx * dt * 4) / T), Math.floor(en.y / T))) en.x += vx * dt;
        if (!this.solid(Math.floor(en.x / T), Math.floor((en.y + vy * dt * 4) / T))) en.y += vy * dt;
        this.touch(en, 7, 6);
      } else {
        en.fx ??= createFx(slimeFx, { seed: en.seed, hop: 5 });
        en.fx.update(dt);
        if (en.falling || !this.solid(Math.floor(en.x / T), Math.floor((en.y + 1) / T))) {
          en.y += 140 * dt;
          if (this.solid(Math.floor(en.x / T), Math.floor((en.y + 1) / T))) { en.y = Math.floor((en.y + 1) / T) * T; en.falling = false; }
        } else {
          const ahead = en.x + Math.sign(en.vx) * 10;
          const wall = this.solid(Math.floor(ahead / T), Math.floor((en.y - 6) / T));
          const ledge = !this.solid(Math.floor(ahead / T), Math.floor((en.y + 2) / T));
          if (wall || ledge) en.vx = -en.vx;
          en.x += en.vx * dt;
        }
        this.touch(en, 10, 12, -6);
      }
    }
  }
  /** Contact with an enemy: land on top to squash it, anything else hurts. */
  touch(en, rx, ry, oy = 0) {
    const p = this.p, ex = en.x, ey = en.y + oy;
    if (p.x + PW < ex - rx || p.x > ex + rx || p.y + PH < ey - ry || p.y > ey + ry) return;
    if (p.vy > 30 && p.y + PH < ey) {
      en.alive = false;
      p.vy = -230;
      p.fallTop = p.y;
      this.fxs.push({ fx: createFx(poofFx, { palette: en.kind === "bat" ? POOF_DARK : ["#061412", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"], seed: en.seed }), x: ex, y: ey + 30 });
      for (let k = 0; k < 2; k++) this.popCoins.push({ x: ex, y: ey, vx: this.rng.range(-60, 60), vy: this.rng.range(-160, -90), v: zoneAt(Math.floor(ey / T)).coinValue, t: 0 });
      audio.play("stomp");
      this.text("POW", ex, ey - 12, "#ffe06a", "big");
      return;
    }
    this.hurt(1, en.kind, ex);
  }

  updateHazards() {
    const p = this.p, x0 = Math.floor((p.x + 1) / T), x1 = Math.floor((p.x + PW - 2) / T), ty = Math.floor((p.y + PH - 1) / T);
    for (let tx = x0; tx <= x1; tx++) if (this.decoAt(tx, ty) === SPIKES && p.y + PH > ty * T + 9) {
      this.hurt(1, "spikes");
      if (this.state === "play") p.vy = -260;
      return;
    }
  }

  hurt(n, src, fromX) {
    if (this.state !== "play") return;
    if (this.invuln > 0 && src !== "dark") return;
    const p = this.p;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 1.2;
    this.shake = 0.3;
    if (src !== "dark") {
      const away = fromX != null ? Math.sign(p.x + PW / 2 - fromX) || -p.face : -p.face;
      p.vx = away * 140;
      if (src !== "fall") p.vy = Math.min(p.vy, -170);
      p.climb = false;
    }
    this.fxs.push({ fx: createFx(sparkFx, { angle: -Math.PI / 2, seed: this.rng.int(1, 99) }), x: p.x + PW / 2, y: p.y + 24 });
    this.text(`-${n}`, p.x + PW / 2, p.y - 8, "#ff5a5a", "big");
    audio.play("hit");
    this.emit("hurt", { src, hp: this.hp });
    if (this.hp <= 0) {
      this.state = "dead";
      p.vx = 0;
      this.fxs.push({ fx: createFx(poofFx, { seed: 5 }), x: p.x + PW / 2, y: p.y + 40 });
      audio.play("die");
      this.emit("dead", { src });
    }
  }
  revive() {
    this.hp = Math.min(2, this.st.hearts);
    this.invuln = 2.5;
    this.revived = true;
    if (this.lantern < 20) { this.lantern = 20; this.lanternOutSent = false; this.darkT = 0; }
    this.state = "play";
  }
  relight(seconds) {
    this.lantern = seconds;
    this.relit = true;
    this.lanternOutSent = false;
    this.darkT = 0;
  }
  escape() {
    if (this.state === "done") return;
    this.state = "done";
    audio.play("escape");
    this.emit("escaped");
  }

  // ------------------------------------------------------------ bits
  chips(tx, ty, m, n) {
    const cols = DEBRIS[m] ?? DEBRIS[DIRT];
    for (let k = 0; k < n; k++)
      this.debris.push({ x: tx * T + this.rng.range(2, 14), y: ty * T + this.rng.range(2, 14), vx: this.rng.range(-80, 80), vy: this.rng.range(-160, -30), c: hexNum(cols[k % 3]), life: this.rng.range(0.4, 0.9) });
  }
  dust(x, y, n) {
    for (let k = 0; k < n; k++) this.debris.push({ x: x + this.rng.range(-5, 5), y: y - 1, vx: this.rng.range(-40, 40), vy: this.rng.range(-50, -10), c: 0xff8a9aaa, life: 0.35 });
  }
  text(str, x, y, color, font = "mini") {
    this.texts.push({ str, x, y, color, font, t: 0, life: font === "big" ? 1.1 : 0.8 });
  }

  // ------------------------------------------------------------ draw
  draw(frame, lm) {
    const camX = Math.round(this.camX), camY = Math.round(this.camY), p = this.p, t = this.t;
    const sx = (x) => Math.round(x - camX), sy = (y) => Math.round(y - camY);
    const onScreen = (x, y, pad = 24) => x > camX - pad && x < camX + W + pad && y > camY - pad && y < camY + H + pad;
    drawCave(frame, this.cave, camX, camY, this.dig);
    fillAmbient(lm, camY);
    let P = painterFor(frame);

    // overlays on tiles: ladders, ropes, spikes, winches, torches
    const tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(MW - 1, Math.floor((camX + W) / T));
    const ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(MH - 1, Math.floor((camY + H) / T));
    const torchesNow = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const d = this.deco[ty * MW + tx];
      if (!d) continue;
      const ox = tx * T - camX, oy = ty * T - camY;
      if (d === LADDER) P.sprite(LADDER_TILE, LADDER_PAL, ox, oy);
      else if (d === ROPE) P.sprite(ROPE_TILE, ROPE_PAL, ox, oy);
      else if (d === SPIKES) P.sprite(SPIKES_TILE, SPIKES_PAL, ox, oy + 9);
      else if (d === WINCH) this.drawWinch(P, lm, ox, oy, ty);
      else if (d === TORCH) torchesNow.push([tx, ty, ox, oy]);
    }
    for (const [tx, ty, ox, oy] of torchesNow) {
      const key = ty * MW + tx, wallRight = this.solid(tx + 1, ty);
      let f = this.torches.get(key);
      if (!f) this.torches.set(key, (f = createFx(torchFx, { seed: key % 97, flip: wallRight })));
      f.options.x = ox + (wallRight ? 13 : 3);
      f.options.y = oy + 14;
      f.update(1 / 60);
      f.draw(frame);
      addLight(lm, ox + 8, oy, 70, 0.6 + Math.sin(t * 9 + key) * 0.04);
    }
    if (this.torches.size > 40) this.torches.clear();
    P = painterFor(frame);

    // surface: the camp sign by the entrance
    if (camY < 0) {
      const ex = this.cave.entrance.ladderX * T - camX, gy = -camY;
      P.rect(ex - 30, gy - 22, 2, 22, 0xff2a4a6a);
      P.rect(ex - 40, gy - 26, 22, 9, 0xff3a6a9a);
      P.text("EXIT", ex - 29, gy - 24, 0xfff0f8ff, { align: "center" });
    }

    // the seal at the bottom
    const sealY = SEAL_DEPTH * T - camY;
    if (sealY > -20 && sealY < H + 20) {
      for (let i = 0; i < 9; i++) {
        const gx = 30 + i * 52 - (camX % 52);
        P.ring(gx, sealY - 6, 7 + Math.sin(t * 2 + i), 1.4, 0xffffd890);
        P.glow(gx, sealY - 6, 18, 0xffff9a3a, 0.5);
      }
    }

    // coins
    const coin = (c) => {
      if (!onScreen(c.x, c.y)) return;
      const fi = Math.floor(t * 8 + c.x * 0.1) % 4, fr = COIN[fi === 3 ? 1 : fi];
      P.sprite(fr, COIN_PAL, sx(c.x) - 3, sy(c.y) - 3);
      P.glow(sx(c.x), sy(c.y), 6, 0xff1a6ad0, 0.25);
    };
    for (const c of this.coinList) if (!c.taken) coin(c);
    for (const c of this.popCoins) coin(c);

    // items glowing in their rarity's color
    for (const it of this.items) {
      if (it.taken || !onScreen(it.x, it.y)) continue;
      const def = ITEM[it.id], rows = shape(def.sprite), pal = it.variant ? variantPal(def.pal) : PALS[def.pal];
      const ix = sx(it.x), iy = sy(it.y + Math.sin(t * 3 + it.x) * 1.2);
      if (def.rarity === "epic" || def.rarity === "legendary") {
        it.beam ??= createFx(beamFx, { palette: BURST[def.rarity], seed: 4, light: 0.5 });
        it.beam.options.x = ix;
        it.beam.options.y = iy + 7;
        it.beam.update(1 / 60);
        it.beam.draw(frame);
        P = painterFor(frame);
      }
      const col = it.variant ? hueCol(t * 0.5 + it.x) : RCOL[def.rarity];
      P.glow(ix, iy, 14, col, GLOW_K[def.rarity] * (0.85 + Math.sin(t * 4 + it.x) * 0.15) + (it.variant ? 0.3 : 0));
      addLight(lm, ix, iy, 18, 0.3);
      P.sprite(rows, pal, ix - (rows[0].length >> 1), iy - (rows.length >> 1));
      if (RARITY[def.rarity].order >= 2 || it.variant) {
        const a = t * 2 + it.x;
        P.light(ix + Math.cos(a) * 9, iy + Math.sin(a) * 9, 0xffffffff, 0.8);
      }
    }

    // enemies
    for (const en of this.enemies) {
      if (!en.alive || !onScreen(en.x, en.y, 40)) continue;
      if (en.kind === "bat" && en.state === "hang") {
        P.sprite(BAT_HANG, BAT_HANG_PAL, sx(en.x) - 3, sy(en.y) - 4);
        P.light(sx(en.x) - 1, sy(en.y) - 1, 0xff3b30ff, 0.6);
        P.light(sx(en.x) + 1, sy(en.y) - 1, 0xff3b30ff, 0.6);
        continue;
      }
      if (!en.fx) continue;
      en.fx.options.x = sx(en.x);
      en.fx.options.y = sy(en.y);
      en.fx.draw(frame);
      P = painterFor(frame);
    }

    // the explorer
    const px = sx(p.x), py = sy(p.y);
    if (this.state !== "dead" && !(this.invuln > 0 && Math.floor(t * 20) % 2 === 0)) {
      let fr = EXPLORER.stand, flip = p.face < 0;
      if (p.climb || this.state === "winch") { fr = EXPLORER.climb; flip = Math.floor(p.walk / 8) % 2 === 1; }
      else if (!p.ground) fr = EXPLORER.jump;
      else if (Math.abs(p.vx) > 10) fr = Math.floor(p.walk / 7) % 2 ? EXPLORER.walk1 : EXPLORER.walk2;
      P.sprite(fr, EXPLORER_PAL, px - 1, py, { flip });
    }
    if (this.state === "winch") P.line(px + 5, py, px + 5, -2, 0xff6aa0d0);
    const lr = this.first ? 1 : Math.max(0, Math.min(1, this.lantern / this.st.lantern));
    const dark = !this.first && this.lantern <= 0;
    const lampX = px + 5 + p.face * 4, lampY = py + 2;
    const flick = 1 + Math.sin(t * 13) * 0.02 + (lr < 0.2 ? Math.sin(t * 31) * 0.08 : 0);
    addLight(lm, lampX, lampY + 6, dark ? 30 : (50 + 80 * lr) * flick, dark ? 0.5 : 0.95);
    if (!dark) P.glow(lampX, lampY, 9, 0xff60c0ff, 0.5);

    for (const d of this.debris) P.dot(sx(d.x), sy(d.y), d.c, Math.min(1, d.life * 3));
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

  drawWinch(P, lm, ox, oy, ty) {
    // a hand winch on a frame, its rope running up into the dark, a lamp that says "this way out"
    const t = this.t;
    P.rect(ox + 1, oy - 14, 2, 30, 0xff24406a);
    P.rect(ox + 13, oy - 14, 2, 30, 0xff24406a);
    P.rect(ox + 1, oy - 15, 14, 3, 0xff3a6a9a);
    P.circle(ox + 8, oy + 6, 4, 0xff3a5a7a);
    P.circle(ox + 8, oy + 6, 2, 0xff9ac0e0);
    const a = t * 2;
    P.line(ox + 8, oy + 6, ox + 8 + Math.cos(a) * 6, oy + 6 + Math.sin(a) * 6, 0xffe0f0ff);
    P.line(ox + 8, oy - 13, ox + 8, Math.max(0, oy - 13 - 400), 0xff6aa0d0);
    const pulse = 0.6 + Math.sin(t * 4) * 0.25;
    P.circle(ox + 8, oy - 18, 2, 0xff80ff9a);
    P.glow(ox + 8, oy - 18, 20, 0xff60ff7a, pulse);
    addLight(lm, ox + 8, oy - 6, 46, 0.5);
    const ay = oy - 32 + Math.sin(t * 5) * 2;
    P.tri(ox + 8, ay, ox + 3, ay + 6, ox + 13, ay + 6, 0xff9affb0);
    P.rect(ox + 6, ay + 6, 4, 4, 0xff9affb0);
  }
}

function hueCol(h) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return Math.round((0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (255 << 24) | (f(4) << 16) | (f(8) << 8) | f(0);
}
