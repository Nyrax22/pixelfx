// One expedition: walk, jump, climb and dig through the cave, grab what you can, and get out alive.

import { createFx, painterFor, Rng } from "../../../src/core/index.js";
import * as burstFx from "../../../src/fx/pickups/collect-burst.js";
import * as sparkFx from "../../../src/fx/impacts/hit-spark.js";
import * as poofFx from "../../../src/fx/spawn/poof.js";
import * as torchFx from "../../../src/fx/fire/torch.js";
import * as campfireFx from "../../../src/fx/fire/campfire.js";
import * as beamFx from "../../../src/fx/pickups/loot-beam.js";
import { W, H, T, MW, MH, ITEM, RARITY, SEAL_DEPTH, PHYS, DIG, STONE_PICK, DARK_DRAIN, ROPE_LEN, DEPTH_SCALE, MISSIONS, COMBO_BONUS, GOLD_SLIME, SURVIVE, START_KIT, EVENTS, BEASTS, ORES } from "./data.js";
import { shape, PALS, variantPal, EXPLORER, EXPLORER_PAL, COIN, COIN_PAL, LADDER_TILE, LADDER_PAL, ROPE_TILE, ROPE_PAL, SPIKES_TILE, SPIKES_PAL, BAT_HANG, BAT_HANG_PAL, BAT, BAT_PAL, SLIME, SLIME_PAL, RED_SLIME_PAL, SKULL, SKULL_PAL, STALACTITE as STALACTITE_SPR, STALACTITE_PAL, BOULDER, BOULDER_PAL, SLIME_KING, SLIME_KING_PAL, GOLEM, GOLEM_PAL, HEART_SPR, HEART_PAL, CHEST, CHEST_PAL, GOLD_SLIME_PAL, MUSHROOM, MUSHROOM_PAL, OIL, OIL_PAL, ROOT_SPR, ROOT_PAL, CRATE, CRATE_PAL, ALTAR, ALTAR_PAL, MERCHANT, MERCHANT_PAL, CURSED_PAL, VAULT_PAL } from "./sprites.js";
import { makeCave, AIR, DIRT, STONE, BEDROCK, GOLD, GEM, BRICK, WOOD, GATE, SOLID, MAT_NAME, NONE, LADDER, SPIKES, ROPE, WINCH, TORCH, STALACTITE, POOL, ROOT, rollItem } from "./cave.js";
import { drawCave, fillAmbient, addLight } from "./bg.js";
import { zoneAt, missionProgress } from "./logic.js";
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
const BEAST = Object.fromEntries(BEASTS.map((b) => [b.id, b]));
const ORE_COL = { copper: [0xff3a8ae0, 0xff9ad0ff], iron: [0xffc8b4a0, 0xfffff0e0], crystal: [0xffffe04a, 0xffffffb0] };
const beastOf = (en) => (en.gold ? "gold_slime" : en.red ? "red_slime" : en.kind);
const NO_PERKS = { dig: 1, waterK: 1, jumpK: 1, fall: 0, lightK: 1, lamp: 1, hearts: 0, detect: 0, poolK: 1, oil: 0, torchK: 1, campStone: 0, hunterK: 1, kit: {} };

export class Run {
  constructor(save, st, first = false, start = null) {
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
    // survival: three meters (0-100) and what you carry
    this.food = 100;
    this.water = 100;
    this.light = 100;
    this.pk = st.pk ?? NO_PERKS;
    this.inv = { ...START_KIT, wood: START_KIT.wood + (st.ropes ?? 0) * 2 };
    for (const [k, v] of Object.entries(this.pk.kit)) this.inv[k] = (this.inv[k] ?? 0) + v;
    // the long game: what this dive brings home besides relics and coins
    this.mats = {};
    this.beasts = {};          // id -> { seen, kills, drops }
    this.used = {};
    this.torchesPlaced = 0;
    this.eventsMet = [];
    this.ores = this.cave.ores ?? new Map();
    this.carry = st.bag;
    this.starveT = 0;
    this.spawnT = SURVIVE.hunters.lit;
    this.lights = [];          // torches and campfires you've placed: { x, y, r, kind, fx }
    this.hintsShown = new Set(save.hintsShown ?? []);
    this.won = false;
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
    this.heartList = this.cave.hearts.map((h) => ({ x: h.tx * T + 8, y: h.ty * T + 10 }));
    this.mushrooms = this.cave.mushrooms.map((m) => ({ x: m.tx * T + 8, y: (m.ty + 1) * T }));
    this.oils = this.cave.oils.map((o) => ({ x: o.tx * T + 8, y: (o.ty + 1) * T }));
    this.pools = new Map(this.cave.pools.map((q) => [q.ty * MW + q.tx, { units: SURVIVE.poolUnits, regen: 0, sip: 0 }]));
    this.chests = this.cave.chests.map((c) => ({ ...c, x: c.tx * T + 8, y: (c.ty + 1) * T, open: false, t: 0 }));
    this.hints = this.cave.hints.map((h) => ({ ...h, shown: false }));
    this.evs = (this.cave.events ?? []).map((e) => ({ ...e, x: e.tx * T + 8, y: (e.ty + 1) * T, done: false, found: false }));
    this.nearEv = null;
    // what this expedition did, for missions
    this.tally = { slimes: 0, bats: 0, skulls: 0, gold: 0, chests: 0, hearts: 0, goldSlime: 0, combo: 0, depth: 0, winch: 0, escapeWith: 0, boss_slime_king: 0, boss_golem: 0 };
    this.missionsDone = new Set();
    this.combo = 0;
    this.freeze = 0;
    this.enemies = this.cave.enemies.map((en) => en.kind === "slime"
      ? { ...en, x: en.tx * T + 8, y: (en.ty + 1) * T, vx: (en.seed & 1 ? 1 : -1) * (en.red ? 34 : 22), alive: true, hp: en.red ? 2 : 1, t: 0 }
      : { ...en, x: en.tx * T + 8, y: en.ty * T + 4, state: "hang", vx: 0, vy: 0, alive: true, hp: 1, t: 0, cd: 1 });
    this.falling = [];        // stalactites on their way down
    this.shots = [];          // boulders and loose rocks
    this.bosses = this.cave.arenas.map((a) => {
      const extra = Math.min(3, save.bossKills?.[a.id] ?? 0);
      return { ...a, state: "sleep", hp: a.hp + extra, maxHp: a.hp + extra, x: (a.x1 - 6) * T, y: a.floor * T, vx: 0, vy: 0, t: 0, cd: 1.5, hurtT: 0, face: -1, ground: true, enraged: false, spawned: false };
    });
    // a shortcut start: in a beaten boss's hall, its gate open, an exit winch beside you
    if (start?.boss) {
      const bi = this.bosses.findIndex((b) => b.id === start.boss);
      for (let i = 0; i <= bi; i++) {
        const b = this.bosses[i];
        b.state = "dead";
    this.tally["boss_" + b.id] = 1;
        for (const y of [b.floor, b.floor + 1]) { this.tile[y * MW + b.gx] = AIR; this.deco[y * MW + b.gx] = LADDER; }
      }
      const b = this.bosses[bi];
      this.addLight((b.gx + 4) * T + 8, b.floor * T, "campfire");
      this.p.x = (b.gx + 1) * T + 3;
      this.p.y = b.floor * T - PH;
      this.p.fallTop = this.p.y;
      this.depthStart = b.floor;
      this.zonesSeen.add("mine");
      this.snapCamera();
    }
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
  /** How much tougher things are at depth y (pixels). */
  hard(y) {
    return 1 + Math.max(0, y / T) / DEPTH_SCALE;
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

    if (this.freeze > 0) { this.freeze -= dt; return; }
    if (this.state === "play") {
      this.updateSurvival(dt, input);
      this.updatePlayer(dt, input);
      if (this.state === "play") {
        this.updateItems(dt);
        this.updateEnemies(dt);
        this.updateHazards(dt);
        this.updateBosses(dt);
        this.updateResources(dt);
        this.spawnHunters(dt);
        this.updateEvents(input);
      }
      this.depthMax = Math.max(this.depthMax, this.depth);
      this.tally.depth = this.depthMax;
      if (this.p.ground || this.p.climb) this.combo = 0;
      this.updateChests(dt);
      if (!this.won && this.depth >= SURVIVE.exitDepth) {
        this.won = true;
        this.emit("toast", { key: "reachedExit" });
        this.escape();
      }
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

  // ------------------------------------------------------------ survival
  hint(key) {
    if (this.hintsShown.has(key)) return;
    this.hintsShown.add(key);
    this.emit("hint", { key });
  }
  /** Is world point (x, y) inside the light of a torch or campfire? */
  lit(x, y, pad = 0) {
    for (const l of this.lights) if (Math.hypot(l.x - x, l.y - 6 - y) < l.r + pad) return l;
    return null;
  }
  addLight(x, y, kind) {
    const fx = createFx(kind === "campfire" ? campfireFx : torchFx, { seed: this.lights.length + 3 });
    this.lights.push({ x, y, kind, fx, r: kind === "campfire" ? SURVIVE.campfire.radius : SURVIVE.torch.radius * (this.pk?.torchK ?? 1), healT: 0 });
  }
  updateSurvival(dt, input) {
    const S = SURVIVE, st = this.st, p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    this.alive = (this.alive ?? 0) + dt;
    const camp = this.lit(cx, cy);
    // meters run down; a campfire keeps the lantern topped up
    this.food = Math.max(0, this.food - (100 / (S.food * st.stomach)) * dt);
    this.water = Math.max(0, this.water - (100 / (S.water * st.stomach)) * this.pk.waterK * dt);
    if (camp?.kind === "campfire") this.light = Math.min(100, this.light + 20 * dt);
    else this.light = Math.max(0, this.light - (100 / st.lantern) * this.pk.lightK * dt);
    if (this.food < 35) this.hint("hintEat");
    if (this.water < 35) this.hint("hintDrink");
    if (this.light < 30) this.hint("hintLight");
    if (this.light <= 0) this.hint("hintDark");
    // empty hunger or thirst eats your health
    if (this.food <= 0 || this.water <= 0) {
      this.starveT += dt;
      if (this.starveT >= S.starveEvery) { this.starveT = 0; this.hint("hintStarve"); this.hurt(1, "starve"); }
    } else this.starveT = 0;
    // a campfire mends you
    if (camp?.kind === "campfire") {
      this.hint("hintCamp");
      camp.healT += dt;
      if (camp.healT >= S.campfire.heal && this.hp < st.hearts) { camp.healT = 0; this.hp++; this.text("+1", cx, p.y - 8, "#ff7a8a", "big"); audio.play("heal"); }
    }
    if (input.eat) this.eat(camp);
    if (input.drink) this.drink();
    if (input.torch) this.craft("torch");
    if (input.campfire) this.craft("campfire");
  }
  eat(camp) {
    if (this.inv.mushroom <= 0) return this.emit("toast", { key: "needs", what: "mushroom" });
    if (this.food >= 99) return this.emit("toast", { key: "full" });
    this.inv.mushroom--;
    this.use("eat");
    const cooked = camp?.kind === "campfire";
    this.food = Math.min(100, this.food + (cooked ? SURVIVE.cooked : SURVIVE.mushroom));
    this.text(cooked ? "YUM!" : "+FOOD", this.p.x + 5, this.p.y - 8, "#ffb04a", "big");
    if (cooked) this.emit("toast", { key: "cooked" });
    audio.play("eat");
    this.emit("inv");
  }
  drink() {
    if (this.inv.water <= 0) return this.emit("toast", { key: "needs", what: "water" });
    if (this.water >= 99) return this.emit("toast", { key: "full" });
    this.inv.water--;
    this.use("drink");
    this.water = Math.min(100, this.water + SURVIVE.drink);
    this.text("+WATER", this.p.x + 5, this.p.y - 8, "#6ac8ff", "big");
    audio.play("drink");
    this.emit("inv");
  }
  use(k) {
    this.used[k] = (this.used[k] ?? 0) + 1;
  }
  craftCost(kind) {
    const c = { ...SURVIVE[kind] };
    if (kind === "campfire") c.stone = Math.max(0, c.stone - this.pk.campStone);
    return c;
  }
  craft(kind) {
    const cost = this.craftCost(kind), p = this.p;
    for (const k of ["wood", "stone"]) if ((cost[k] ?? 0) > this.inv[k]) return this.emit("toast", { key: "needs", what: k });
    if (kind === "campfire" && !p.ground) return;
    for (const k of ["wood", "stone"]) this.inv[k] -= cost[k] ?? 0;
    this.addLight(p.x + PW / 2 + p.face * 8, p.y + PH, kind);
    this.use(kind);
    if (kind === "torch") this.torchesPlaced++;
    this.emit("toast", { key: "placed", what: kind });
    audio.play("place");
    this.emit("inv");
  }
  /** Mushrooms, oil, pools of water, roots for wood. */
  updateResources(dt) {
    const p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (const m of this.mushrooms) {
      if (m.taken || Math.abs(m.x - cx) > 9 || Math.abs(m.y - 4 - cy) > 12) continue;
      if (this.inv.mushroom >= this.carry) { if (!m.warned) { m.warned = true; this.text("FULL", m.x, m.y - 14, "#ff8a6a"); } continue; }
      m.taken = true; this.inv.mushroom++;
      this.text("+1", m.x, m.y - 12, "#ffb04a"); audio.play("pickup", 0); this.emit("inv");
    }
    for (const o of this.oils) {
      if (o.taken || Math.abs(o.x - cx) > 9 || Math.abs(o.y - 4 - cy) > 12 || this.light > 95) continue;
      o.taken = true; this.light = Math.min(100, this.light + SURVIVE.oil + this.pk.oil);
      this.text("+LIGHT", o.x, o.y - 12, "#ffe06a", "big"); audio.play("heal");
    }
    // pools: stand in one and your flask fills, sip by sip
    const ptx = Math.floor(cx / T), pty = Math.floor((p.y + PH - 1) / T);
    for (const [k, q] of this.pools) {
      q.regen += dt;
      if (q.regen >= SURVIVE.poolRegen && q.units < SURVIVE.poolUnits) { q.regen = 0; q.units++; }
    }
    const pool = this.decoAt(ptx, pty) === POOL ? this.pools.get(pty * MW + ptx) : null;
    if (pool) {
      this.hint("hintPool");
      pool.sip += dt;
      if (pool.sip >= SURVIVE.poolFill * this.pk.poolK && pool.units > 0 && this.inv.water < this.carry) {
        pool.sip = 0; pool.units--; this.inv.water++;
        this.text("+1", cx, p.y - 6, "#6ac8ff"); audio.play("drink"); this.emit("inv");
      }
    }
    // roots: brush past one and pull it down
    for (const ty of [pty - 2, pty - 1, pty]) {
      if (this.decoAt(ptx, ty) !== ROOT) continue;
      if (ty === pty - 2 && p.ground) continue; // the high ones need a jump
      if (this.inv.wood >= this.carry + 4) continue;
      this.deco[ty * MW + ptx] = NONE;
      this.inv.wood++;
      this.chips(ptx, ty, WOOD, 5);
      this.text("+WOOD", ptx * T + 8, ty * T, "#c89a60"); audio.play("break"); this.emit("inv");
      this.hint("hintRoot");
    }
    for (const l of this.lights) l.fx.update(dt);
  }
  /** In the dark, things come looking for you. Torchlight keeps them off. */
  spawnHunters(dt) {
    const H_ = SURVIVE.hunters, p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    if (this.lit(cx, cy)) return;
    const k = this.hard(p.y);
    this.spawnT -= dt * k * (this.light <= 0 ? 2.2 : 1) * this.pk.hunterK;
    if (this.spawnT > 0) return;
    this.spawnT = this.light <= 0 ? H_.dark : H_.lit + this.rng.range(-3, 3);
    if (this.depth < 12) return;
    const near = this.enemies.filter((e) => e.alive && Math.abs(e.x - cx) < W && Math.abs(e.y - cy) < H).length;
    if (near >= H_.cap) return;
    this.spawnHunter(170, 230);
  }
  /** One creature somewhere open, between dmin and dmax pixels away. */
  spawnHunter(dmin, dmax, ignoreLight = false) {
    const p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (let tries = 0; tries < 20; tries++) {
      const ang = this.rng.range(0, Math.PI * 2), d = this.rng.range(dmin, dmax);
      const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d * 0.7;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (ty < 1 || this.solid(tx, ty) || (!ignoreLight && this.lit(x, y, 20))) continue;
      const mine = zoneAt(ty).id === "mine";
      const kind = mine && this.rng.next() < 0.4 ? "skull" : "bat";
      this.enemies.push({ kind, x, y, state: kind === "bat" ? "fly" : "hang", vx: 0, vy: 0, alive: true, hp: 1, t: 0, cd: 1, seed: this.rng.int(1, 999), hunter: true });
      return;
    }
  }

  // ------------------------------------------------------------ the long game: materials, monsters, events
  addMat(id, n, x, y) {
    this.mats[id] = (this.mats[id] ?? 0) + n;
    this.text(`+${n} ${id.toUpperCase()}`, x, y, "#9ae0ff", "big");
    this.emit("mat", { id, n });
  }
  spot(id, y) {
    if (!this.beasts[id]) { this.beasts[id] = { seen: Math.max(0, Math.floor(y / T)), kills: 0, drops: {} }; this.emit("beastSeen", { id }); }
  }
  killed(id, x, y) {
    this.spot(id, y);
    const b = this.beasts[id];
    b.kills++;
    for (const [m, ch] of Object.entries(BEAST[id]?.drops ?? {})) {
      const n = ch >= 1 ? Math.round(ch) : this.rng.next() < ch ? 1 : 0;
      if (!n) continue;
      b.drops[m] = true;
      this.addMat(m, n, x, y - 10);
    }
  }
  /** The rare material this depth's ore would be. */
  zoneMat(ty) {
    const opts = ORES.filter((o) => ty >= o.from - 10 && ty < o.to).map((o) => o.id);
    return opts.length ? opts[this.rng.int(0, opts.length - 1)] : "copper";
  }
  updateEvents(input) {
    const p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    const upEdge = input.up && !this.upWas;
    this.upWas = input.up;
    this.nearEv = null;
    for (const ev of this.evs) {
      const dx = Math.abs(ev.x - cx), dy = Math.abs(ev.y - 8 - cy);
      if (!ev.found && dx < 150 && dy < 90) {
        ev.found = true;
        this.eventsMet.push(ev.type);
        this.emit("evFound", { type: ev.type });
        audio.play("reveal", 2);
      }
      if (ev.done || EVENTS[ev.type].passive || dx > 16 || dy > 18 || !p.ground) continue;
      this.nearEv = ev;
      if (upEdge || input.look) this.emit("event", { ev });
    }
  }
  /** Can the dive pay this cost right now? hp must stay above zero. */
  canPay(cost) {
    return Object.entries(cost).every(([k, v]) => (k === "hp" ? this.hp > v : k === "coins" ? this.coins >= v : (this.inv[k] ?? 0) >= v));
  }
  /** Do an event's option. Returns a message key, or null if it couldn't be done. */
  resolveEvent(ev, id) {
    const def = EVENTS[ev.type], opt = def.opts?.find((o) => o.id === id);
    if (!opt || ev.done || !this.canPay(opt.cost)) return null;
    for (const [k, v] of Object.entries(opt.cost)) { if (k === "hp") this.hp -= v; else if (k === "coins") this.coins -= v; else this.inv[k] -= v; }
    const z = zoneAt(ev.ty), x = ev.x, y = ev.y - 12;
    const relic = (item, variant = false) => {
      const id2 = item ?? rollItem(this.rng, z, ev.ty, (i) => this.save.book[i]?.count ?? 0, 2);
      if (id2) this.items.push({ id: id2, variant, tx: ev.tx, ty: ev.ty - 1, x, y: y - 14, pop: 0.3 });
    };
    const coins = (n) => { for (let k = 0; k < n; k++) this.popCoins.push({ x, y, vx: this.rng.range(-110, 110), vy: this.rng.range(-260, -120), v: z.coinValue, t: 0 }); };
    let msg = id;
    switch (id) {
      case "blood": relic(); this.shake = 0.3; audio.play("set"); break;
      case "offer": this.addMat(this.zoneMat(ev.ty), 1, x - 10, y); this.addMat(this.zoneMat(ev.ty), 1, x + 10, y - 10); audio.play("set"); break;
      case "food": this.inv.mushroom += 2; msg = "bought"; break;
      case "water": this.inv.water += 2; msg = "bought"; break;
      case "oil": this.light = 100; msg = "bought"; break;
      case "mats": this.inv.wood += 3; this.inv.stone += 3; msg = "bought"; break;
      case "rare": this.addMat(this.zoneMat(ev.ty), 1, x, y); msg = "bought"; break;
      case "open":
        relic(ev.item, ev.variant); coins(14); this.addMat(this.zoneMat(ev.ty), 2, x, y);
        this.light = Math.max(0, this.light - 50);
        for (let k = 0; k < 4; k++) this.spawnHunter(90, 150, true);
        this.shake = 0.6; audio.play("boss");
        break;
      case "break": relic(ev.item, ev.variant); coins(10); this.addMat(this.zoneMat(ev.ty), 2, x, y); this.chips(ev.tx, ev.ty, STONE, 12); audio.play("chest"); break;
      case "drink": this.water = 100; this.hp = Math.min(this.st.hearts, this.hp + 1); audio.play("heal"); break;
    }
    if (msg === "bought") audio.play("coin");
    if (!def.stay) ev.done = true;
    this.emit("inv");
    return msg;
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
    if (p.climb && !onLadder && !ladderBelow) {
      // over the top rung: step up onto it rather than hanging off the end
      const fy = Math.floor((p.y + PH - 0.01) / T);
      if (input.up && this.ladderTop(Math.floor(cx / T), fy)) { p.y = fy * T - PH; p.vy = 0; p.ground = true; }
      p.climb = false;
    }
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
        p.vy = -P.jump * this.pk.jumpK;
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
      if (fell > P.fallHurt2 + this.pk.fall) this.hurt(2, "fall");
      else if (fell > P.fallHurt + this.pk.fall) this.hurt(1, "fall");
      else if (fell > 1.5) audio.play("land");
      this.dust(p.x + PW / 2, p.y + PH, 4);
    }
    if (p.ground || p.climb) p.fallTop = p.y;
    if (p.climb) p.offLadder = this.t; // don't dig the floor out the moment you step off a ladder

    // digging: push into a wall, hold down on the ground, or climb up into a ceiling
    let target = null;
    if (p.ground && input.dir && blockedX) target = [Math.floor((input.dir > 0 ? p.x + PW + 1 : p.x - 1) / T), Math.floor((p.y + PH - 2) / T)];
    else if (p.ground && input.down && !ladderBelow && !input.dir && this.t - (p.offLadder ?? -9) > 0.4) target = [Math.floor(cx / T), Math.floor((p.y + PH + 1) / T)];
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
        this.tally.winch = 1;
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
    if (m === GATE) {
      if (!this.warnedHard.has(i)) { this.warnedHard.add(i); this.emit("toast", { key: "gateShut" }); audio.play("clang"); }
      return;
    }
    if ((m === STONE || m === GEM) && this.st.pick < STONE_PICK && false) {
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
    // what the rock gives back
    const ore = this.ores.get(i);
    if (ore) { this.ores.delete(i); this.addMat(ore, 1, tx * T + 8, ty * T - 6); audio.play("newItem"); }
    if (m === STONE || m === GEM || m === BRICK) { this.inv.stone++; this.text("+STONE", tx * T + 8, ty * T, "#b8b8c8"); this.emit("inv"); }
    if (m === WOOD) { this.inv.wood++; this.text("+WOOD", tx * T + 8, ty * T, "#c89a60"); this.emit("inv"); }
    if (m === GOLD) this.tally.gold++;
    if (m === GOLD || m === GEM) {
      this.text(`+${(m === GEM ? 6 : 4) * zoneAt(ty).coinValue * (m === GEM ? 2 : 1)}`, tx * T + 8, ty * T, "#ffd23a");
      const n = m === GEM ? 6 : 4, v = zoneAt(ty).coinValue * (m === GEM ? 2 : 1);
      for (let k = 0; k < n; k++) this.popCoins.push({ x: tx * T + 8, y: ty * T + 8, vx: this.rng.range(-70, 70), vy: this.rng.range(-170, -80), v, t: 0 });
      audio.play("coin");
    }
    // a thrown rope or ladder above stays; things resting on this tile fall
    for (const en of this.enemies) if (en.kind === "slime" && Math.floor(en.x / T) === tx && Math.floor((en.y + 1) / T) === ty) en.falling = true;
  }

  throwRope() {
    const p = this.p;
    if (this.inv.wood < SURVIVE.rope.wood) return this.emit("toast", { key: "needs", what: "wood" });
    const tx = Math.floor((p.x + PW / 2) / T), ty = Math.floor((p.y + PH - 1) / T);
    // find the ceiling above, then hang the rope from it down to the floor
    let top = ty;
    while (top > 0 && ty - top < ROPE_LEN && !this.solid(tx, top - 1)) top--;
    let bot = ty;
    while (bot < MH - 1 && !this.solid(tx, bot + 1) && bot - top < ROPE_LEN + 4) bot++;
    if (top === ty && bot === ty) return;
    this.inv.wood -= SURVIVE.rope.wood;
    this.use("rope");
    this.emit("inv");
    for (let y = top; y <= bot; y++) if (this.deco[y * MW + tx] === NONE) this.deco[y * MW + tx] = ROPE;
    audio.play("rope");
    this.emit("rope");
  }

  updateItems(dt) {
    const p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (const it of this.items) {
      if (it.taken) continue;
      if (it.pop > 0) { it.pop -= dt; it.y += 60 * dt; continue; }
      const dx = cx - it.x, dy = cy - it.y;
      if (Math.abs(dx) > 260 || Math.abs(dy) > 160) continue;
      if (this.seen[it.id] == null && Math.abs(dx) < 150 && Math.abs(dy) < 110) this.seen[it.id] = it.ty;
      if (Math.abs(dx) > 11 || Math.abs(dy) > 13) continue;
      const room = true, slot = -1; // relics don't take up room: they're your score
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
    for (const h of this.heartList) {
      if (h.taken || Math.abs(h.x - cx) > 10 || Math.abs(h.y - cy) > 12 || this.hp >= this.st.hearts) continue;
      h.taken = true;
      this.hp++;
      this.tally.hearts++;
      this.text("+1", h.x, h.y - 10, "#ff7a8a", "big");
      audio.play("heal");
      this.emit("heal");
    }
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

  }

  updateEnemies(dt) {
    const p = this.p, px = p.x + PW / 2, py = p.y + PH / 2;
    for (const en of this.enemies) {
      if (!en.alive) continue;
      const dx = px - en.x, dy = py - en.y;
      if (Math.abs(dx) > W || Math.abs(dy) > H) continue;
      if (Math.abs(dx) < W / 2 && Math.abs(dy) < H / 2) this.spot(beastOf(en), en.y);
      en.t += dt;
      const k = this.hard(en.y);
      if (en.kind === "bat") {
        if (en.state === "hang") {
          if (Math.hypot(dx, dy) < 84 + k * 10) { en.state = "fly"; audio.play("squeak"); }
          continue;
        }
        const d = Math.hypot(dx, dy) || 1, sp = 50 * k;
        const wob = Math.sin(this.t * 5 + en.seed) * 30;
        let vx = (dx / d) * sp - (dy / d) * wob * 0.3, vy = (dy / d) * sp + (dx / d) * wob * 0.3 + Math.sin(this.t * 7 + en.seed) * 20;
        // light drives them back
        const L = this.lit(en.x + vx * dt * 6, en.y + vy * dt * 6);
        if (L) { const a = Math.atan2(en.y - L.y + 6, en.x - L.x); vx = Math.cos(a) * sp * 1.2; vy = Math.sin(a) * sp * 1.2; }
        this.flyMove(en, vx * dt, vy * dt);
        this.touch(en, 6, 4);
      } else if (en.kind === "skull") {
        // hovers, then lines up and dashes straight at you
        if (en.state === "hang") {
          en.y += Math.sin(en.t * 3 + en.seed) * 0.2;
          if (Math.hypot(dx, dy) < 120) { en.state = "aim"; en.cd = 0.7 / k; audio.play("squeak"); }
        } else if (en.state === "aim") {
          en.cd -= dt;
          if (en.cd <= 0) {
            const d = Math.hypot(dx, dy) || 1, sp = 190 * k;
            if (this.lit(px, py)) { en.state = "rest"; en.cd = 1.5; }
            else { en.vx = (dx / d) * sp; en.vy = (dy / d) * sp; en.state = "dash"; en.cd = 0.75; }
          }
        } else if (en.state === "dash") {
          en.cd -= dt;
          const hit = this.flyMove(en, en.vx * dt, en.vy * dt);
          if (hit || en.cd <= 0) { en.state = "rest"; en.cd = 1.1 / k; if (hit) this.chipsAt(en.x, en.y, DIRT, 4); }
        } else {
          en.cd -= dt;
          this.flyMove(en, (dx > 0 ? 1 : -1) * 15 * dt, -10 * dt);
          if (en.cd <= 0) { en.state = "aim"; en.cd = 0.6 / k; }
        }
        this.touch(en, 5, 5);
      } else {
        if (en.falling || !this.solid(Math.floor(en.x / T), Math.floor((en.y + 1) / T))) {
          en.y += 140 * dt;
          if (this.solid(Math.floor(en.x / T), Math.floor((en.y + 1) / T))) { en.y = Math.floor((en.y + 1) / T) * T; en.falling = false; }
        } else {
          // red slimes notice you and come at you; golden ones run
          if (en.red && Math.abs(dy) < 20 && Math.abs(dx) < 120) en.vx = Math.sign(dx) * Math.abs(en.vx);
          if (en.gold) {
            const near = Math.abs(dy) < 40 && Math.abs(dx) < 110;
            en.vx = (near ? -Math.sign(dx) || 1 : Math.sign(en.vx) || 1) * (near ? 62 : 18);
            if (near && !en.seen) { en.seen = true; this.emit("toast", { key: "jackpot" }); }
          }
          const ahead = en.x + Math.sign(en.vx) * 7;
          const wall = this.solid(Math.floor(ahead / T), Math.floor((en.y - 6) / T));
          const ledge = !this.solid(Math.floor(ahead / T), Math.floor((en.y + 2) / T));
          if (wall || ledge || this.lit(ahead, en.y - 6)) en.vx = -en.vx;
          else en.x += en.vx * k * dt;
        }
        this.touch(en, 6, 8, -4);
      }
    }
  }
  /** Move a flier, staying out of rock; returns true if it bumped into something. */
  flyMove(en, dx, dy) {
    let hit = false;
    if (!this.solid(Math.floor((en.x + dx + Math.sign(dx) * 4) / T), Math.floor(en.y / T))) en.x += dx; else hit = true;
    if (!this.solid(Math.floor(en.x / T), Math.floor((en.y + dy + Math.sign(dy) * 4) / T))) en.y += dy; else hit = true;
    return hit;
  }
  /** Contact with an enemy: land on top to squash it, anything else hurts. */
  touch(en, rx, ry, oy = 0) {
    const p = this.p, ex = en.x, ey = en.y + oy;
    if (p.x + PW < ex - rx || p.x > ex + rx || p.y + PH < ey - ry || p.y > ey + ry) return;
    // falling with your feet above its middle counts: generous on purpose
    if (p.vy > 0 && p.y + PH < en.y + oy + ry * 0.5) {
      p.vy = -230;
      p.fallTop = p.y;
      this.freeze = 0.06;
      if (--en.hp > 0) { en.hurtT = 0.3; audio.play("stomp"); return; }
      en.alive = false;
      this.killed(beastOf(en), ex, ey);
      this.combo++;
      this.tally.combo = Math.max(this.tally.combo, this.combo);
      if (en.kind === "slime") this.tally.slimes++;
      if (en.kind === "bat") this.tally.bats++;
      if (en.kind === "skull") this.tally.skulls++;
      if (en.gold) {
        this.tally.goldSlime++;
        this.shake = 0.3;
        for (let k = 0; k < GOLD_SLIME.coins; k++) this.popCoins.push({ x: ex, y: ey, vx: this.rng.range(-130, 130), vy: this.rng.range(-280, -120), v: 1, t: 0 });
        this.fxs.push({ fx: createFx(burstFx, { palette: BURST.legendary, seed: 9, light: 1 }), x: ex, y: ey + 30 });
        this.text("JACKPOT!", ex, ey - 18, "#ffd23a", "big");
        audio.play("newItem");
      }
      const pal = en.kind === "slime" ? (en.red ? ["#2a0610", "#8a1a2a", "#e04a4a", "#ff8a7a", "#ffd0c0", "#ffffff"] : ["#061412", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"]) : POOF_DARK;
      this.fxs.push({ fx: createFx(poofFx, { palette: pal, seed: en.seed }), x: ex, y: ey + 30 });
      const n = (en.kind === "skull" ? 3 : en.red ? 3 : 2) + (this.combo - 1) * COMBO_BONUS;
      for (let k = 0; k < n; k++) this.popCoins.push({ x: ex, y: ey, vx: this.rng.range(-60, 60), vy: this.rng.range(-160, -90), v: zoneAt(Math.floor(ey / T)).coinValue, t: 0 });
      audio.play("stomp", this.combo);
      if (this.combo > 1) this.text(`COMBO x${this.combo}`, ex, ey - 12, "#ff9a3a", "big");
      else if (!en.gold) this.text("POW", ex, ey - 12, "#ffe06a", "big");
      return;
    }
    this.hurt(en.dmg ?? 1, en.kind, ex);
  }

  updateChests(dt) {
    const p = this.p, cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (const c of this.chests) {
      if (c.open) { c.t += dt; continue; }
      if (Math.abs(c.x - cx) > 12 || Math.abs(c.y - 6 - cy) > 14) continue;
      // open: coins fly, the relic pops out on top
      c.open = true;
      this.tally.chests++;
      this.freeze = 0.08;
      this.shake = 0.2;
      if (c.crate) {
        // a supply crate: wood, often food or water, sometimes oil
        const got = [];
        const add = (k, n) => { const room = (k === "wood" || k === "stone" ? this.carry + 4 : this.carry) - this.inv[k]; const g = Math.max(0, Math.min(n, room)); this.inv[k] += g; if (g) got.push(`+${g} ${k.toUpperCase()}`); };
        add("wood", this.rng.int(2, 3));
        if (this.rng.next() < 0.6) add("mushroom", 1);
        if (this.rng.next() < 0.5) add("water", 1);
        if (this.rng.next() < 0.35) add("stone", 2);
        if (this.rng.next() < 0.3) { this.light = Math.min(100, this.light + SURVIVE.oil); got.push("+LIGHT"); }
        got.forEach((g, i) => this.text(g, c.x, c.y - 14 - i * 8, "#ffe0a0"));
        this.chips(c.tx, c.ty, WOOD, 10);
        audio.play("break");
        this.emit("inv");
        continue;
      }
      for (let k = 0; k < c.coins; k++) this.popCoins.push({ x: c.x, y: c.y - 8, vx: this.rng.range(-110, 110), vy: this.rng.range(-260, -120), v: 1, t: 0 });
      this.fxs.push({ fx: createFx(burstFx, { palette: BURST.legendary, seed: 5, light: 1 }), x: c.x, y: c.y + 18 });
      this.items.push({ id: c.item, variant: c.variant, tx: c.tx, ty: c.ty, x: c.x, y: c.y - 22, pop: 0.35 });
      this.inv.mushroom = Math.min(this.carry, this.inv.mushroom + 1);
      this.inv.water = Math.min(this.carry, this.inv.water + 1);
      this.emit("inv");
      this.emit("toast", { key: "chestOpen" });
      audio.play("chest");
    }
    // first-expedition hints, once each, when you get close
    for (const h of this.hints) {
      if (h.shown || Math.abs(h.tx * T + 8 - cx) > 26 || Math.abs(h.ty * T + 8 - cy) > 20) continue;
      h.shown = true;
      this.emit("toast", { key: h.key });
    }
  }
  /** Announce a mission the moment it's met (it pays out at the results). */
  checkMissions() {
    for (const m of this.save.missions?.active ?? []) {
      const def = MISSIONS[m.i];
      if (this.missionsDone.has(def.id) || def.kind === "escapeWith" || def.kind === "winch") continue;
      if (missionProgress(m, this.tally, false) >= def.n) {
        this.missionsDone.add(def.id);
        this.emit("mission", { id: def.id, i: m.i });
        audio.play("set");
      }
    }
  }

  updateHazards(dt) {
    const p = this.p, x0 = Math.floor((p.x + 1) / T), x1 = Math.floor((p.x + PW - 2) / T), ty = Math.floor((p.y + PH - 0.01) / T);
    for (let tx = x0; tx <= x1; tx++) if (this.decoAt(tx, ty) === SPIKES && p.y + PH > ty * T + 9) {
      this.hurt(1, "spikes");
      if (this.state === "play") p.vy = -260;
      break;
    }
    // stalactites above you shake loose
    const ptx = Math.floor((p.x + PW / 2) / T), pty = Math.floor(p.y / T);
    for (let y = pty; y >= Math.max(0, pty - 7); y--) {
      if (this.solid(ptx, y)) break;
      for (const tx of [ptx - 1, ptx, ptx + 1]) {
        if (this.decoAt(tx, y) !== STALACTITE) continue;
        this.deco[y * MW + tx] = NONE;
        this.falling.push({ x: tx * T + 8, y: y * T + 2, vy: 0, wait: 0.35 });
        audio.play("crack");
      }
    }
    for (const f of this.falling) {
      if (f.wait > 0) { f.wait -= dt; continue; }
      f.vy = Math.min(500, f.vy + 900 * dt);
      f.y += f.vy * dt;
      if (Math.abs(p.x + PW / 2 - f.x) < 7 && f.y > p.y && f.y < p.y + PH) { f.done = true; this.hurt(1, "rock", f.x); }
      if (this.solid(Math.floor(f.x / T), Math.floor((f.y + 6) / T))) { f.done = true; this.chipsAt(f.x, f.y, STONE, 6); audio.play("break"); }
    }
    this.falling = this.falling.filter((f) => !f.done);
    // boulders and rocks from bosses
    for (const r of this.shots) {
      r.vy = Math.min(480, r.vy + (r.g ?? 700) * dt);
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.t = (r.t ?? 0) + dt;
      if (Math.abs(p.x + PW / 2 - r.x) < 8 && r.y > p.y - 3 && r.y < p.y + PH + 3) { r.done = true; this.hurt(r.dmg ?? 1, "rock", r.x); }
      if (r.t > 0.1 && this.solid(Math.floor(r.x / T), Math.floor(r.y / T))) { r.done = true; this.chipsAt(r.x, r.y, STONE, 6); audio.play("break"); }
      if (r.t > 6) r.done = true;
    }
    this.shots = this.shots.filter((r) => !r.done);
  }

  // ------------------------------------------------------------ bosses
  updateBosses(dt) {
    const p = this.p, px = p.x + PW / 2, d = this.depth;
    for (const b of this.bosses) {
      if (b.state === "dead") continue;
      if (b.state === "sleep") {
        if (d >= b.top && d <= b.floor) {
          b.state = "fight";
          b.x = px < MW * T / 2 ? (MW - 6) * T : 6 * T;
          this.emit("bossWake", { id: b.id, hp: b.hp });
          this.spot(b.id, b.y);
          audio.play("boss");
          this.shake = 0.5;
        }
        continue;
      }
      b.t += dt;
      b.hurtT = Math.max(0, b.hurtT - dt);
      b.enraged = b.hp <= Math.ceil(b.maxHp / 2);
      const lo = (b.x0 + 2) * T, hi = (b.x1 - 1) * T;
      if (b.id === "slime_king") this.slimeKing(b, dt, px, lo, hi);
      else this.golem(b, dt, px, lo, hi);
      b.x = Math.max(lo, Math.min(hi, b.x));
      // contact: from above it's a hit, otherwise it hurts
      const w = b.id === "golem" ? 12 : 13, h = b.id === "golem" ? 30 : 18;
      if (p.x + PW > b.x - w && p.x < b.x + w && p.y + PH > b.y - h && p.y < b.y) {
        if (p.vy > 20 && p.y + PH < b.y - h + 8 && b.hurtT <= 0) this.hitBoss(b);
        else if (b.hurtT <= 0.4) this.hurt(1, b.id, b.x);
      }
    }
  }
  slimeKing(b, dt, px, lo, hi) {
    if (!b.ground) {
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y >= b.floor * T) {
        b.y = b.floor * T; b.vy = 0; b.ground = true; b.cd = b.enraged ? 0.75 : 1.25;
        this.shake = 0.3;
        audio.play("land");
        this.dust(b.x, b.y, 10);
        // the landing sends a shockwave along the floor: be in the air
        if (this.p.ground && Math.abs(px - b.x) < 72 && Math.abs(this.p.y + PH - b.y) < 4) this.hurt(1, "shock", b.x);
      }
      return;
    }
    b.cd -= dt;
    if (b.cd <= 0) {
      b.ground = false;
      b.vy = -(260 + Math.random() * 90);
      b.vx = Math.max(-150, Math.min(150, (px - b.x) * 1.1));
      b.face = b.vx < 0 ? -1 : 1;
    }
    if (b.enraged && !b.spawned) {
      b.spawned = true;
      for (const side of [-1, 1]) this.enemies.push({ kind: "slime", x: b.x + side * 30, y: b.floor * T, vx: side * 30, alive: true, hp: 1, t: 0, seed: 7 + side });
    }
  }
  golem(b, dt, px, lo, hi) {
    b.cd -= dt;
    if (b.act === "slam") {
      b.actT -= dt;
      if (b.actT <= 0) {
        b.act = null;
        this.shake = 0.5;
        audio.play("slam");
        this.dust(b.x, b.y, 14);
        if (this.p.ground && Math.abs(px - b.x) < 100 && Math.abs(this.p.y + PH - b.y) < 4) this.hurt(2, "shock", b.x);
        // the ceiling comes down
        const n = b.enraged ? 6 : 4;
        for (let i = 0; i < n; i++) this.shots.push({ x: lo + Math.random() * (hi - lo), y: (b.top + 0.5) * T, vx: 0, vy: 0, g: 500 + Math.random() * 300, dmg: 1, rock: true });
      }
      return;
    }
    if (b.act === "throw") {
      b.actT -= dt;
      if (b.actT <= 0) {
        b.act = null;
        const dx = px - b.x, t = 0.9;
        this.shots.push({ x: b.x, y: b.y - 30, vx: dx / t, vy: -320, g: 700, dmg: 1 });
        audio.play("throw");
      }
      return;
    }
    // walk toward you, then pick an attack
    b.face = px < b.x ? -1 : 1;
    if (Math.abs(px - b.x) > 20) b.x += b.face * (b.enraged ? 46 : 30) * dt;
    if (b.cd <= 0) {
      b.cd = b.enraged ? 1.9 : 2.8;
      if (Math.abs(px - b.x) < 120 || Math.random() < 0.4) { b.act = "slam"; b.actT = b.enraged ? 0.5 : 0.75; }
      else { b.act = "throw"; b.actT = 0.5; }
    }
  }
  hitBoss(b) {
    const p = this.p;
    b.hp--;
    b.hurtT = 0.8;
    p.vy = -330;
    p.fallTop = p.y;
    this.shake = 0.3;
    this.fxs.push({ fx: createFx(sparkFx, { angle: Math.PI / 2, seed: this.rng.int(1, 99) }), x: b.x, y: b.y - 10 });
    audio.play("stomp");
    this.text(b.hp > 0 ? "HIT!" : "K.O.", b.x, b.y - 40, "#ffe06a", "big");
    this.emit("bossHp", { id: b.id, hp: b.hp });
    if (b.hp > 0) return;
    // down it goes: coins, its trophy, and the gate opens
    b.state = "dead";
    for (let i = 0; i < 3; i++) this.fxs.push({ fx: createFx(poofFx, { seed: 3 + i }), x: b.x + (i - 1) * 14, y: b.y + 20 - i * 6 });
    for (let k = 0; k < b.coins; k++) this.popCoins.push({ x: b.x, y: b.y - 16, vx: this.rng.range(-120, 120), vy: this.rng.range(-260, -120), v: 1, t: 0 });
    this.items.push({ id: b.trophy, variant: false, tx: Math.floor(b.x / T), ty: b.floor - 1, x: b.x, y: (b.floor - 1) * T + 9 });
    for (const y of [b.floor, b.floor + 1]) { this.tile[y * MW + b.gx] = AIR; this.deco[y * MW + b.gx] = LADDER; }
    this.bossesBeaten = [...(this.bossesBeaten ?? []), b.id];
    this.killed(b.id, b.x, b.y - 30);
    this.emit("bossDown", { id: b.id });
    audio.play("set");
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
    this.food = Math.max(this.food, 40); this.water = Math.max(this.water, 40); this.light = Math.max(this.light, 40);
    this.state = "play";
  }
  relight(seconds) {
    this.light = 100;
    this.relit = true;
    this.lanternOutSent = false;
    this.darkT = 0;
  }
  escape() {
    if (this.state === "done") return;
    this.tally.escapeWith = this.bag.length;
    this.state = "done";
    audio.play("escape");
    this.emit("escaped");
  }

  // ------------------------------------------------------------ bits
  chipsAt(x, y, m, n) {
    this.chips(Math.floor(x / T), Math.floor(y / T), m, n);
  }
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
    // as your light fades, so does the cave (but never the sky)
    const fade = 0.35 + 0.65 * Math.max(0, Math.min(1, this.light / 60));
    if (fade < 1) for (let sy = Math.max(0, -camY); sy < H; sy++) for (let i = sy * W, e = i + W; i < e; i++) lm[i] *= fade;
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
      else if (d === STALACTITE) P.sprite(STALACTITE_SPR, STALACTITE_PAL, ox + 4, oy);
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

    // placed torches and campfires, and their light
    for (const l of this.lights) {
      if (!onScreen(l.x, l.y, 120)) continue;
      l.fx.options.x = sx(l.x);
      l.fx.options.y = sy(l.y) + (l.kind === "torch" ? -2 : 0);
      l.fx.draw(frame);
      addLight(lm, sx(l.x), sy(l.y) - 14, l.r, l.kind === "campfire" ? 0.85 : 0.7);
    }
    P = painterFor(frame);
    // mushrooms, oil flasks, water pools, roots
    for (const m of this.mushrooms) if (!m.taken && onScreen(m.x, m.y)) P.sprite(MUSHROOM, MUSHROOM_PAL, sx(m.x) - 4, sy(m.y) - 7);
    for (const o of this.oils) if (!o.taken && onScreen(o.x, o.y)) {
      P.sprite(OIL, OIL_PAL, sx(o.x) - 3, sy(o.y) - 9);
      P.glow(sx(o.x), sy(o.y) - 5, 9, 0xff3ac8ff, 0.4 + Math.sin(t * 4 + o.x) * 0.1);
    }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const d = this.deco[ty * MW + tx];
      if (d === POOL) {
        const q = this.pools.get(ty * MW + tx), level = q ? q.units / SURVIVE.poolUnits : 0, h = 2 + Math.round(level * 5), ox = tx * T - camX, oy = (ty + 1) * T - camY;
        P.rect(ox, oy - h, T, h, 0xffc06a2a);
        P.rect(ox, oy - h, T, 1, 0xfff0c890);
        for (let i = 0; i < 3; i++) P.dot(ox + ((t * 6 + i * 5 + tx * 3) % 16 | 0), oy - h, 0xffffffff, 0.8);
        P.glow(ox + 8, oy - h, 10, 0xffff8a3a, 0.25);
      } else if (d === ROOT) P.sprite(ROOT_SPR, ROOT_PAL, tx * T - camX + 5, ty * T - camY);
    }
    // rare ore glinting in the rock
    for (const [i, id] of this.ores) {
      const tx = i % MW, ty = (i / MW) | 0, ox = tx * T - camX, oy = ty * T - camY;
      if (ox < -16 || ox > W || oy < -16 || oy > H) continue;
      const [c1, c2] = ORE_COL[id];
      for (const [ax, ay] of [[4, 5], [10, 3], [7, 10], [12, 11], [3, 12]]) P.rect(ox + ax, oy + ay, 2, 2, c1);
      const s2 = Math.floor(t * 3 + i) % 5;
      P.dot(ox + [4, 10, 7, 12, 3][s2], oy + [5, 3, 10, 11, 12][s2], c2);
      P.glow(ox + 8, oy + 8, 10, c1, 0.3 + Math.sin(t * 3 + i) * 0.1);
      addLight(lm, ox + 8, oy + 8, 14, 0.25);
    }
    // events
    for (const ev of this.evs) {
      if (!onScreen(ev.x, ev.y, 40)) continue;
      const ex = sx(ev.x), ey = sy(ev.y);
      if (ev.type === "altar") {
        P.sprite(ALTAR, ALTAR_PAL, ex - 8, ey - ALTAR.length);
        if (!ev.done) { P.glow(ex, ey - 14, 14, 0xffff5ac2, 0.6 + Math.sin(t * 3) * 0.2); addLight(lm, ex, ey - 12, 40, 0.5); }
      } else if (ev.type === "merchant") {
        P.sprite(MERCHANT, MERCHANT_PAL, ex - 6, ey - MERCHANT.length, { flip: this.p.x < ev.x });
        P.glow(ex + 6, ey - 8, 10, 0xff40c0ff, 0.6); addLight(lm, ex + 4, ey - 8, 50, 0.6);
      } else if (ev.type === "cursed" || ev.type === "vault") {
        const fr = CHEST[ev.done ? 1 : 0];
        P.sprite(fr, ev.type === "cursed" ? CURSED_PAL : VAULT_PAL, ex - 7, ey - fr.length);
        if (!ev.done && ev.type === "cursed") for (let k = 0; k < 3; k++) { const a = t * 1.5 + k * 2.1; P.glow(ex + Math.sin(a) * 6, ey - 14 - ((t * 10 + k * 7) % 14), 5, 0xff8a1a6a, 0.6); }
        if (!ev.done && ev.type === "vault") P.rect(ex - 1, ey - 7, 3, 3, 0xff40c0f0);
        addLight(lm, ex, ey - 6, 24, 0.3);
      } else if (ev.type === "spring") {
        P.rect(ex - 10, ey - 4, 20, 4, ev.done ? 0xff7a5a3a : 0xffffb84a);
        P.rect(ex - 10, ey - 4, 20, 1, 0xfffff0c8);
        if (!ev.done) for (let k = 0; k < 3; k++) P.dot(ex - 6 + k * 6, ey - 5 - (Math.floor(t * 6 + k * 3) % 6), 0xffffffff, 0.8);
        P.glow(ex, ey - 4, 16, 0xffffa040, ev.done ? 0.1 : 0.5); addLight(lm, ex, ey - 6, 34, 0.4);
      }
      if (this.nearEv === ev) {
        const ay = ey - 36 + Math.round(Math.sin(t * 6));
        P.tri(ex, ay - 1, ex - 5, ay + 5, ex + 5, ay + 5, 0xff0a0810);
        P.tri(ex, ay + 1, ex - 3, ay + 4, ex + 3, ay + 4, 0xffffe06a);
        addLight(lm, ex, ay + 2, 14, 1);
      }
    }
    // the detector: an arrow toward the nearest thing worth finding
    if (this.pk.detect && this.state === "play") {
      const px0 = p.x + PW / 2, py0 = p.y + PH / 2;
      let best = null, bd = 34 * T;
      const consider = (x, y) => { const d = Math.hypot(x - px0, y - py0); if (d < bd && d > 40) { bd = d; best = [x, y]; } };
      for (const c of this.chests) if (!c.open && !c.crate) consider(c.x, c.y - 6);
      for (const ev of this.evs) if (!ev.done && !EVENTS[ev.type].passive) consider(ev.x, ev.y - 8);
      for (const [i] of this.ores) consider((i % MW) * T + 8, ((i / MW) | 0) * T + 8);
      if (best) {
        const a = Math.atan2(best[1] - py0, best[0] - px0), r = 22, ax = sx(px0) + Math.cos(a) * r, ay = sy(py0) + Math.sin(a) * r;
        const col = 0xff6aff9a, k = 0.6 + Math.sin(t * 6) * 0.3;
        P.tri(ax + Math.cos(a) * 5, ay + Math.sin(a) * 5, ax + Math.cos(a + 2.4) * 4, ay + Math.sin(a + 2.4) * 4, ax + Math.cos(a - 2.4) * 4, ay + Math.sin(a - 2.4) * 4, col);
        P.glow(ax, ay, 6, col, k);
      }
    }
    // chests
    for (const c of this.chests) {
      if (!onScreen(c.x, c.y)) continue;
      if (c.crate) { if (!c.open) P.sprite(CRATE, CRATE_PAL, sx(c.x) - 6, sy(c.y) - 11); continue; }
      const fr = CHEST[c.open ? 1 : 0];
      P.sprite(fr, CHEST_PAL, sx(c.x) - 7, sy(c.y) - fr.length);
      if (!c.open) {
        P.glow(sx(c.x), sy(c.y) - 6, 12, 0xff3ad2ff, 0.35 + Math.sin(t * 4 + c.x) * 0.1);
        const a = t * 2.5 + c.x;
        P.light(sx(c.x) + Math.cos(a) * 9, sy(c.y) - 6 + Math.sin(a) * 5, 0xffffffff, 0.8);
      }
      addLight(lm, sx(c.x), sy(c.y) - 6, 20, 0.3);
    }
    // hearts, bobbing
    for (const h of this.heartList) {
      if (h.taken || !onScreen(h.x, h.y)) continue;
      const hy = sy(h.y + Math.sin(t * 4 + h.x) * 1.5);
      P.sprite(HEART_SPR, HEART_PAL, sx(h.x) - 4, hy - 4);
      P.glow(sx(h.x), hy, 9, 0xff5a4aff, 0.45);
    }
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

    // enemies, stalactites, rocks
    for (const en of this.enemies) {
      if (!en.alive || !onScreen(en.x, en.y, 40)) continue;
      const ex = sx(en.x), ey = sy(en.y), flash = en.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
      if (en.kind === "bat") {
        if (en.state === "hang") {
          P.sprite(BAT_HANG, BAT_HANG_PAL, ex - 3, ey - 4);
          P.light(ex - 1, ey - 1, 0xff3b30ff, 0.6);
          P.light(ex + 1, ey - 1, 0xff3b30ff, 0.6);
        } else {
          P.sprite(BAT[Math.floor(t * 12 + en.seed) % 3], BAT_PAL, ex - 5, ey - 3);
          P.light(ex - 1, ey + 1, 0xff3b30ff, 0.7);
          P.light(ex + 1, ey + 1, 0xff3b30ff, 0.7);
        }
      } else if (en.kind === "skull") {
        const shake = en.state === "aim" ? Math.round(Math.sin(t * 60)) : 0;
        P.sprite(SKULL[Math.floor(t * 8) % 2], SKULL_PAL, ex - 4 + shake, ey - 4, { flip: this.p.x < en.x });
        P.glow(ex, ey - 4, 10, 0xff2a6aff, en.state === "aim" ? 0.9 : 0.4);
        addLight(lm, ex, ey, 22, 0.35);
      } else {
        const fr = SLIME[Math.floor(en.t * 3 + en.seed) % 2];
        P.sprite(fr, en.gold ? GOLD_SLIME_PAL : en.red ? RED_SLIME_PAL : SLIME_PAL, ex - 6, ey - 9, { flip: en.vx < 0, tint: flash ? 0xffffffff : undefined });
        P.glow(ex, ey - 4, en.gold ? 16 : 9, en.gold ? 0xff3ad2ff : en.red ? 0xff3a3aff : 0xff52c747, en.gold ? 0.7 : 0.25);
        if (en.gold) { addLight(lm, ex, ey - 4, 26, 0.4); P.light(ex + Math.cos(t * 5) * 8, ey - 6 + Math.sin(t * 5) * 4, 0xffffffff, 0.9); }
      }
    }
    for (const f of this.falling) P.sprite(STALACTITE_SPR, STALACTITE_PAL, sx(f.x) - 4 + (f.wait > 0 ? Math.round(Math.sin(t * 70)) : 0), sy(f.y) - 2);
    for (const r of this.shots) P.sprite(BOULDER, BOULDER_PAL, sx(r.x) - 4, sy(r.y) - 4, { flip: Math.floor((r.t ?? 0) * 10) % 2 === 1 });

    // braziers light the boss halls
    for (const b of this.bosses) {
      const top = b.top * T - camY, bot = b.floor * T - camY;
      if (bot < -40 || top > H + 40) continue;
      for (let x = 40; x < MW * T; x += 110) {
        const lx = x - camX, ly = bot - 6;
        if (lx < -90 || lx > W + 90) continue;
        P.rect(lx - 3, ly - 3, 7, 4, 0xff3a3a46);
        P.rect(lx - 2, ly - 6, 5, 3, 0xff1a8aff);
        P.dot(lx, ly - 8 - (Math.floor(t * 8 + x) % 2), 0xff6ae0ff);
        P.glow(lx, ly - 7, 12, 0xff2a8aff, 0.8);
        addLight(lm, lx, ly - 20, 95, b.state === "dead" ? 0.3 : 0.5);
      }
    }
    // bosses
    for (const b of this.bosses) {
      if (b.state === "dead" || !onScreen(b.x, b.y - 20, 60)) continue;
      const bx = sx(b.x), by = sy(b.y), flash = b.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
      const tint = flash ? 0xffffffff : undefined;
      if (b.id === "slime_king") {
        const fr = SLIME_KING[!b.ground || (b.cd < 0.25 && b.state === "fight") ? 1 : 0];
        P.sprite(fr, SLIME_KING_PAL, bx - 15, by - fr.length, { flip: b.face > 0, tint });
        P.glow(bx, by - 12, 28, b.enraged ? 0xff3a3aff : 0xff52c747, 0.3);
        addLight(lm, bx, by - 12, 50, 0.4);
      } else {
        const fr = GOLEM[b.act === "slam" || b.act === "throw" ? 1 : 0];
        const bob = b.act ? 0 : Math.round(Math.abs(Math.sin(b.t * 4)));
        P.sprite(fr, GOLEM_PAL, bx - 15, by - fr.length - bob, { flip: b.face > 0, tint });
        P.glow(bx, by - 15, 16, 0xff2a7aff, b.act ? 0.9 : 0.5);
        addLight(lm, bx, by - 15, 56, 0.45);
        // a red warning line on the floor before a slam
        if (b.act === "slam" && Math.floor(t * 12) % 2) P.rect(bx - 100, by - 1, 200, 1, 0xff3a3aff);
      }
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
    const lr = Math.max(0, Math.min(1, this.light / 100));
    const dark = this.light <= 0;
    const lampX = px + 5 + p.face * 4, lampY = py + 2;
    const flick = 1 + Math.sin(t * 13) * 0.02 + (lr < 0.2 ? Math.sin(t * 31) * 0.08 : 0);
    addLight(lm, lampX, lampY + 6, dark ? 30 : (50 + 80 * lr) * flick * this.pk.lamp, dark ? 0.5 : 0.95);
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
