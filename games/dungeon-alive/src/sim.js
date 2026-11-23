// The rules of 던전이 살아있다: a run, its days and nights, and everything that fights in it.
// No DOM, no drawing: the renderer and the UI read the state and drain `run.events`.
// Every number lives in ../data/*.json.

import CARDS from "../data/cards.json";
import ROOMS from "../data/rooms.json";
import BAL from "../data/balance.json";
import POWERS from "../data/powers.json";
import MON from "../data/monsters.json";
import STORY from "../data/story.json";

export { CARDS, ROOMS, BAL, POWERS, MON, STORY };

export const COLS = BAL.grid.cols, ROWS = BAL.grid.rows;
export const ENT = BAL.grid.entrance, HEART = BAL.grid.heart;

// ---------------------------------------------------------------- random
export function makeRng(seed) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    get state() { return a; },
    set state(v) { a = v >>> 0; },
  };
}
function weighted(R, items, w) {
  const tot = items.reduce((s, it) => s + w(it), 0);
  let x = R.next() * tot;
  for (const it of items) if ((x -= w(it)) <= 0) return it;
  return items[items.length - 1];
}
const shuffle = (R, arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = R.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// ---------------------------------------------------------------- meta (survives runs)
export function newMeta() {
  return {
    v: 1, souls: 0, powers: [], seenPrologue: false, runs: 0, wins: 0, records: [], diaries: [],
    lineage: [], favorite: null, sparedTotal: 0, killedTotal: 0, bestDay: 0, bossKills: 0, breeds: 0, named: false,
  };
}
export const hasPower = (meta, id) => meta.powers.includes(id);
const powerSum = (meta, key) => POWERS.filter((p) => meta.powers.includes(p.id)).reduce((s, p) => s + (p[key] ?? 0), 0);
export const unlocked = (meta, def) => !def.unlock || meta.powers.includes(def.unlock);
export function act(meta) {
  const n = meta.powers.length;
  return n < 6 ? 1 : n < 14 ? 2 : 3;
}
export function nextPower(meta) {
  return POWERS.find((p) => !meta.powers.includes(p.id)) ?? null;
}
export function buyPower(meta, id) {
  const p = POWERS.find((q) => q.id === id);
  if (!p || meta.powers.includes(id) || meta.souls < p.cost) return false;
  // powers come back in order: the first missing one is the only one on offer
  if (nextPower(meta)?.id !== id) return false;
  meta.souls -= p.cost;
  meta.powers.push(id);
  return true;
}
function grantRecord(run, meta, id) {
  if (!id || meta.records.includes(id)) return false;
  meta.records.push(id);
  run.recordsFound.push(id);
  run.events.push({ t: "record", id });
  return true;
}

// ---------------------------------------------------------------- cards
export function cardDef(card) {
  if (card.id === "bred") {
    const m = card.mon;
    return { name: m.name, kind: "monster", el: m.el ?? "physical", cost: 2, species: m.species, hp: m.hp, atk: m.atk, rate: m.rate, traits: m.traits, desc: traitLine(m.traits), bred: true };
  }
  return CARDS[card.id];
}
export function cardCost(run, card) {
  const d = cardDef(card);
  return Math.max(0, d.cost - (run.discount ?? 0));
}
function traitLine(traits) {
  return traits.length ? traits.map((t) => "#" + t).join(" ") : "평범한 몬스터";
}

// ---------------------------------------------------------------- grid helpers
export const key = (c, r) => r * COLS + c;
export const inGrid = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
export const room = (run, c, r) => (inGrid(c, r) ? run.rooms[key(c, r)] : null);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function neighbors(run, c, r) {
  const out = [];
  for (const [dc, dr] of N4) if (room(run, c + dc, r + dr)) out.push([c + dc, r + dr]);
  return out;
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const isFixed = (rm) => rm && (rm.type === "entrance" || rm.type === "heart");

/** A* over rooms. Rooms the guild knows to be deadly cost more, so parties walk around them when they can. */
export function findPath(run, from, to, avoid = true) {
  const start = key(...from), goal = key(...to);
  const open = new Map([[start, 0]]), came = new Map(), g = new Map([[start, 0]]);
  while (open.size) {
    let cur = -1, best = Infinity;
    for (const [k, f] of open) if (f < best) { best = f; cur = k; }
    if (cur === goal) break;
    open.delete(cur);
    const c = cur % COLS, r = (cur / COLS) | 0;
    for (const [nc, nr] of neighbors(run, c, r)) {
      const nk = key(nc, nr), rm = run.rooms[nk];
      let cost = 1;
      if (avoid && run.guild.known[nk] && rm.card) cost += 4;
      const ng = g.get(cur) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); came.set(nk, cur);
        open.set(nk, ng + dist([nc, nr], to));
      }
    }
  }
  if (!came.has(goal) && start !== goal) return null;
  const path = [];
  for (let k = goal; k !== start; k = came.get(k)) path.unshift([k % COLS, (k / COLS) | 0]);
  return path;
}

// ---------------------------------------------------------------- runs
export function newRun(meta, seed = (Math.random() * 2 ** 31) | 0) {
  const first = meta.runs === 0;
  const R = makeRng(seed);
  const rooms = new Array(COLS * ROWS).fill(null);
  const run = {
    seed, rs: R.state, first, day: 1, maxDays: first ? 3 : 7, phase: "night_pick", t: 0,
    heart: { hp: 0, max: 0 }, mana: BAL.mana.start + powerSum(meta, "mana"), manaMax: BAL.mana.max + powerSum(meta, "manaMax"),
    regenT: 0, hand: [], rooms, monsters: [], advs: [], wave: 0, waves: [], spawnQ: [], spawnT: 0, gapT: 0,
    kills: 0, spared: 0, executed: 0, nemeses: [], guild: { gear: {}, known: {} }, diaries: [], recordsFound: [],
    events: [], uid: 1, pick: null, roomOffer: null, pendingRoom: null, breedsLeft: 0, mercy: [], mercyShown: 0,
    combo: { n: 0, t: 0, last: null }, discount: powerSum(meta, "discount"), options: BAL.night.pickOptions + powerSum(meta, "options"),
    breach: {}, stats: { dmg: 0, hits: 0 }, rage: 0, rageNeed: meta.runs === 0 ? BAL.roar.firstNeed : BAL.roar.need, roars: 0, bossDown: false, result: null, firstKillDone: false, speed: 1,
  };
  const max = (first ? BAL.heart.firstRunHp : BAL.heart.hp) + powerSum(meta, "heart");
  run.heart = { hp: max, max };
  rooms[key(...ENT)] = { type: "entrance", card: null };
  rooms[key(...HEART)] = { type: "heart", card: null };
  for (let c = ENT[0] + 1; c < HEART[0]; c++) rooms[key(c, ENT[1])] = { type: "hall", card: null };
  // what was left after a hundred years: one rusty trap and two slimes
  rooms[key(2, 2)].card = { id: "spike", cd: 0 };
  addMonster(run, CARDS.slime, 3, 2);
  addMonster(run, CARDS.slime, 4, 2);
  if (!first && meta.favorite) {
    const fav = meta.lineage.find((m) => m.id === meta.favorite);
    if (fav) run.hand.push({ id: "bred", mon: fav, uid: run.uid++ });
  }
  startNight(run, meta);
  return run;
}
const rngOf = (run) => {
  const R = makeRng(1);
  R.state = run.rs;
  return R;
};
// every rule draws from the run's seeded stream so a run can be replayed and tested
function withRng(run, fn) {
  const R = rngOf(run);
  const out = fn(R);
  run.rs = R.state;
  return out;
}

// ---------------------------------------------------------------- night
export function startNight(run, meta) {
  run.phase = "night_pick";
  run.wave = 0;
  if (run.day > 1) run.mana = Math.min(run.manaMax, Math.max(run.mana, 0) + BAL.mana.carry + powerSum(meta, "mana") * 0.5);
  run.waves = withRng(run, (R) => makeWaves(run, meta, R));
  // the guild's watch list lasts one night: tonight's parties know what last night's survivors told them
  offerPick(run, meta, "night");
}

function makeWaves(run, meta, R) {
  const d = run.day, H = BAL.horde;
  const pool = ["warrior", "rogue", "mage", "cleric"];
  const party = (n, must = []) => {
    const out = [...must];
    while (out.length < n) out.push(weighted(R, pool, (c) => BAL.classes[c].weight));
    return shuffle(R, out);
  };
  // parties come as hordes: many weak bodies, so traps that hit a room at once feel like they should
  if (run.first) {
    if (d === 1) return [party(4, ["warrior", "rogue"])];
    if (d === 2) return [party(6, ["warrior", "rogue", "cleric"]), party(6, ["warrior", "mage"])];
    return [party(7, ["rogue", "mage"]), party(9, ["warrior", "cleric", "mage"])];
  }
  const nW = d <= 2 ? 2 : 3;
  const size = Math.min(H.max, Math.round(H.base + d * H.perDay + (act(meta) - 1)));
  const waves = [];
  for (let w = 0; w < nW; w++) waves.push(party(size - (nW - 1 - w)));
  if (d === 7) waves[waves.length - 1].push("boss");
  return waves;
}

export function offerPick(run, meta, reason) {
  const opts = withRng(run, (R) => pickOptions(run, meta, R));
  run.pick = { options: opts, reason };
  run.phase = "night_pick";
}
function pickOptions(run, meta, R) {
  const n = run.options;
  if (run.first && run.day === 1 && run.wave === 0) return ["spike", "zap", "bat"];
  if (run.first && run.day === 2 && run.wave === 0) return ["zap", "strike", "frog"];
  const ids = Object.keys(CARDS).filter((id) => !CARDS[id].prologue && unlocked(meta, CARDS[id]));
  const groups = [
    ids.filter((id) => ["trap", "facility"].includes(CARDS[id].kind)),
    ids.filter((id) => CARDS[id].kind === "monster"),
    ids.filter((id) => ["spell", "support"].includes(CARDS[id].kind)),
  ];
  const out = [];
  for (const g of groups) if (out.length < n) out.push(R.pick(g));
  while (out.length < n) {
    const id = R.pick(ids);
    if (!out.includes(id)) out.push(id);
  }
  return shuffle(R, out);
}

export function choosePick(run, meta, i) {
  if (run.phase !== "night_pick" || !run.pick) return false;
  const id = run.pick.options[i];
  if (id) run.hand.push({ id, uid: run.uid++ });
  run.pick = null;
  run.events.push({ t: "sfx", name: "pick" });
  beginWave(run, meta);
  return true;
}

function beginWave(run, meta) {
  const party = run.waves[run.wave];
  run.phase = "wave";
  run.spawnT = 0.6;
  run.spawnQ = withRng(run, (R) => party.map((cls) => makeAdv(run, meta, cls, R)));
  // a nemesis sometimes joins: someone you let go, back with better gear
  if (!run.first && run.nemeses.length && withRng(run, (R) => R.chance(0.5))) {
    const n = run.nemeses.shift();
    run.spawnQ.push(withRng(run, (R) => makeAdv(run, meta, n.cls, R, n)));
  }
  run.events.push({ t: "wave", n: run.wave + 1, of: run.waves.length, party: run.spawnQ.map((a) => a.cls) });
}

function makeAdv(run, meta, cls, R, nemesis = null) {
  const C = BAL.classes[cls], S = BAL.scale;
  const day = run.day;
  let hpMul = (1 + S.hpPerDay * (day - 1)) * (1 + S.hpPerAct * (act(meta) - 1));
  if (run.first && day === 1) hpMul *= 0.8;
  if (nemesis) hpMul *= S.nemesisHp * (1 + 0.15 * (nemesis.lvl - 1));
  let atkMul = 1 + S.atkPerDay * (day - 1);
  if (cls !== "boss") { hpMul *= BAL.horde.hp; atkMul *= BAL.horde.atk; }
  const gear = [];
  for (const [el, lvl] of Object.entries(run.guild.gear)) {
    if (el === "trap" && cls !== "rogue") continue;
    if (gear.length < 2 && R.chance(Math.min(0.9, BAL.gear.chance * lvl))) gear.push(el);
  }
  if (nemesis) for (const g of nemesis.gear) if (!gear.includes(g)) gear.push(g);
  const name = nemesis?.name ?? R.pick(STORY.names);
  const town = nemesis?.town ?? R.pick(STORY.towns);
  const hp = Math.round(C.hp * hpMul);
  return {
    id: run.uid++, cls, name, town, lvl: nemesis ? nemesis.lvl : 1, nemesis: !!nemesis, boss: cls === "boss",
    hp, max: hp, atk: C.atk * atkMul, rate: C.rate, speed: C.speed, courage: C.courage, courageMax: C.courage,
    gear, cell: [...ENT], next: null, prog: 0, state: "walk", cd: 0.5, healT: 1, disarmT: 0, disarmCell: null,
    lootT: 0, looted: false, slowT: 0, slowK: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, frozenT: 0,
    dmgBy: {}, srcBy: {}, spare: null, mercyT: 0, lane: R.next() * 2 - 1, face: 1, hitT: 0, dead: false, out: false,
    diary: makeDiary(R, cls, name, town),
  };
}
function makeDiary(R, cls, name, town) {
  const D = STORY.diary, vars = { town, class: BAL.classes[cls].name, name };
  return { name, cls, town, lines: [fill(R.pick(D.open), vars), fill(R.pick(D.rumor), vars), fill(R.pick(D.fear), vars)] };
}

// ---------------------------------------------------------------- playing cards
/** Where card could go: "room" cells, or null for no target. */
export function cardTargets(run, card) {
  const d = cardDef(card), out = [];
  if (d.kind === "support" && d.heal) return null;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (canPlay(run, card, c, r).ok) out.push([c, r]);
  return out;
}
export function canPlay(run, card, c, r) {
  const d = cardDef(card), rm = room(run, c, r);
  if (cardCost(run, card) > run.mana) return { ok: false, why: "마나가 모자라요" };
  if (d.kind === "support" && d.heal) return { ok: true };
  if (!rm) return { ok: false, why: "방이 아닌 곳이에요" };
  if (d.kind === "trap" || d.kind === "facility") {
    if (isFixed(rm) || rm.type === "secret" || rm.type === "sealed") return { ok: false, why: "여기엔 놓을 수 없어요" };
    if (rm.card) return { ok: false, why: "이미 무언가 놓여 있어요" };
    return { ok: true };
  }
  if (d.kind === "monster") {
    if (rm.type === "entrance") return { ok: false, why: "입구에는 둘 수 없어요" };
    const cap = ROOMS[rm.type].monsterCap ?? 2;
    if (monstersIn(run, c, r).length >= cap) return { ok: false, why: "방이 꽉 찼어요" };
    return { ok: true };
  }
  if (d.kind === "support" && d.buff) {
    if (!monstersIn(run, c, r).length) return { ok: false, why: "몬스터가 있는 방에 써요" };
    return { ok: true };
  }
  return { ok: true };
}
export function playCard(run, meta, handIdx, c, r) {
  const card = run.hand[handIdx];
  if (!card) return { ok: false };
  const chk = canPlay(run, card, c, r);
  if (!chk.ok) return chk;
  const d = cardDef(card);
  if (run.phase !== "wave" && run.phase !== "night_pick" && run.phase !== "prologue" && d.kind !== "trap" && d.kind !== "facility" && d.kind !== "monster")
    return { ok: false, why: "밤에만 쓸 수 있어요" };
  run.mana -= cardCost(run, card);
  run.hand.splice(handIdx, 1);
  const rm = room(run, c, r);
  if (d.kind === "trap" || d.kind === "facility") {
    rm.card = { id: card.id, cd: 0.4, hp: d.hp ?? 0, disabledT: 0 };
    run.events.push({ t: "place", c, r, id: card.id });
  } else if (d.kind === "monster") {
    const m = addMonster(run, card.id === "bred" ? card.mon : d, c, r);
    run.events.push({ t: "summon", c, r, m });
  } else if (d.kind === "spell") {
    castSpell(run, meta, d, c, r, card.id);
  } else if (d.kind === "support") {
    if (d.heal) {
      run.heart.hp = Math.min(run.heart.max, run.heart.hp + d.heal);
      run.events.push({ t: "fx", id: "heal", c: HEART[0], r: HEART[1] });
    } else if (d.buff) {
      for (const m of monstersIn(run, c, r)) { m.buffT = d.dur; m.hp = Math.min(m.max, m.hp + m.max * 0.5); }
      run.events.push({ t: "fx", id: "rage", c, r });
    }
  }
  run.events.push({ t: "sfx", name: "play" });
  return { ok: true };
}

function castSpell(run, meta, d, c, r, id) {
  run.events.push({ t: "spell", id, c, r });
  const hit = (cc, rr, dmg) => {
    for (const a of advsIn(run, cc, rr)) {
      if (dmg) deal(run, meta, a, dmg, d.el, { kind: "spell", id, key: key(c, r) });
      if (d.freeze) a.frozenT = Math.max(a.frozenT, d.freeze);
      if (d.fear) scare(run, meta, a, d.fear);
    }
  };
  hit(c, r, d.dmg);
  if (d.radius) for (const [nc, nr] of neighbors(run, c, r)) hit(nc, nr, d.splash ?? d.dmg);
}

/** The heart's own blow: everyone in the dungeon, once the rage meter is full. */
export function roar(run, meta) {
  if (run.phase !== "wave" || run.rage < run.rageNeed) return false;
  run.rage = 0;
  run.roars++;
  run.events.push({ t: "roar" });
  const dmg = BAL.roar.dmg + BAL.roar.perDay * (run.day - 1);
  for (const a of run.advs.filter(targetable)) {
    deal(run, meta, a, dmg, "holy", { kind: "roar" });
    if (targetable(a)) { scare(run, meta, a, BAL.roar.fear); a.frozenT = Math.max(a.frozenT, 0.6); }
  }
  return true;
}

// ---------------------------------------------------------------- monsters
export function monstersIn(run, c, r) {
  return run.monsters.filter((m) => m.c === c && m.r === r && m.hp > 0);
}
export function addMonster(run, spec, c, r) {
  const traits = spec.traits ?? [];
  let hpK = 1, atkK = 1;
  for (const t of traits) { hpK += MON.traits[t]?.hp ?? 0; atkK += MON.traits[t]?.atk ?? 0; }
  const slot = [0, 1, 2].find((s) => !run.monsters.some((m) => m.hp > 0 && m.c === c && m.r === r && m.slot === s)) ?? 0;
  const hp = Math.round(spec.hp * hpK);
  const m = {
    id: run.uid++, species: spec.species, name: spec.name, traits: [...traits], palette: spec.palette ?? null,
    mutant: !!spec.mutant, lineageId: spec.lineageId ?? spec.id ?? null, el: spec.el ?? "physical",
    hp, max: hp, atk: spec.atk * atkK, rate: spec.rate ?? 1, cd: 0.5, c, r, slot, buffT: 0, healT: 1, hitT: 0, atkT: 0, split: false,
  };
  run.monsters.push(m);
  return m;
}
const has = (m, t) => m.traits.includes(t);
function monsterEl(m) {
  for (const t of m.traits) if (MON.traits[t]?.el) return MON.traits[t].el;
  return m.el ?? "physical";
}
function reachOf(m) {
  return m.traits.some((t) => MON.traits[t]?.reach) ? 1 : 0;
}

// ---------------------------------------------------------------- adventurers
export function advPos(a) {
  if (!a.next) return [a.cell[0], a.cell[1]];
  return [a.cell[0] + (a.next[0] - a.cell[0]) * a.prog, a.cell[1] + (a.next[1] - a.cell[1]) * a.prog];
}
/** The room an adventurer counts as being in. */
export function advCell(a) {
  return a.next && a.prog >= 0.5 ? a.next : a.cell;
}
const active = (a) => !a.dead && !a.out;
const targetable = (a) => active(a) && a.spare !== true && !a.npc;
export function advsIn(run, c, r) {
  return run.advs.filter((a) => targetable(a) && advCell(a)[0] === c && advCell(a)[1] === r);
}
function advsNear(run, c, r, range) {
  return run.advs.filter((a) => targetable(a) && dist(advCell(a), [c, r]) <= range);
}

function deal(run, meta, a, amount, el, src) {
  if (!targetable(a) || amount <= 0) return 0;
  const [c, r] = advCell(a);
  const rm = room(run, c, r);
  let dmg = amount;
  const mods = ROOMS[rm?.type]?.mods;
  if (mods && mods[el]) dmg *= mods[el];
  if (a.gear.includes(el)) dmg *= 1 - BAL.gear.resist;
  if (src.kind === "monster" && a.gear.includes("monster")) dmg *= 0.75;
  if (src.kind !== "status") dmg = Math.round(dmg * 10) / 10;
  a.hp -= dmg;
  a.hitT = 0.18;
  a.dmgBy[el] = (a.dmgBy[el] ?? 0) + dmg;
  const sk = src.kind === "card" ? (CARDS[src.id]?.kind === "trap" ? "trap" : "facility") : src.kind;
  a.srcBy[sk] = (a.srcBy[sk] ?? 0) + dmg;
  if (src.key != null) (a.hitRooms ??= new Set()).add(src.key);
  a.courage -= dmg * BAL.fear.dmgToCourage;
  run.stats.dmg += dmg; run.stats.hits++;
  if (src.kind !== "status" && src.kind !== "roar") run.rage = Math.min(run.rageNeed, (run.rage ?? 0) + BAL.roar.perHit);
  if (src.kind === "status") {
    // burns and poison tick every frame: show them as one number per whole point
    a.dot = (a.dot ?? 0) + dmg;
    if (a.dot >= 1) { run.events.push({ t: "dmg", id: a.id, amount: Math.floor(a.dot), el, dot: true, x: advPos(a)[0], y: advPos(a)[1] }); a.dot -= Math.floor(a.dot); }
    if (a.hp <= 0) kill(run, meta, a, src);
    else checkFlee(run, a);
    return dmg;
  }
  run.events.push({ t: "dmg", id: a.id, amount: dmg, el, boosted: mods?.[el] > 1, x: advPos(a)[0], y: advPos(a)[1] });
  // a combo is several different sources landing on the party in quick succession
  const cb = run.combo, sid = src.kind + ":" + (src.id ?? src.mid ?? "") + ":" + (src.key ?? "");
  if (cb.t > 0 && cb.last !== sid) { cb.n++; if (cb.n >= 3) run.events.push({ t: "combo", n: cb.n }); }
  else if (cb.t <= 0) cb.n = 1;
  cb.last = sid; cb.t = 1.1;
  if (a.hp <= 0) kill(run, meta, a, src);
  else checkFlee(run, a);
  return dmg;
}
function scare(run, meta, a, amount) {
  if (!targetable(a)) return;
  const rm = room(run, ...advCell(a));
  let f = amount * (ROOMS[rm?.type]?.mods?.fear ?? 1);
  if (a.gear.includes("fear")) f *= 1 - BAL.gear.resist;
  a.courage -= f;
  a.dmgBy.fear = (a.dmgBy.fear ?? 0) + f * 0.3;
  run.events.push({ t: "scare", id: a.id, x: advPos(a)[0], y: advPos(a)[1] });
  checkFlee(run, a);
}
function checkFlee(run, a) {
  if (a.boss || a.state === "flee" || !active(a)) return;
  const low = a.hp / a.max < BAL.fear.fleeHp && a.cls !== "warrior";
  if (a.courage <= 0 || low) {
    a.state = "flee";
    a.spare = null;
    a.mercyT = BAL.mercy.timeout;
    a.disarmT = 0; a.lootT = 0;
    run.mercy.push(a.id);
    run.events.push({ t: "flee", id: a.id, name: a.name, cls: a.cls });
  }
}
function kill(run, meta, a, src) {
  a.dead = true;
  a.hp = 0;
  run.kills++;
  run.rage = Math.min(run.rageNeed, (run.rage ?? 0) + BAL.roar.perKill);
  run.mana = Math.min(run.manaMax, run.mana + (src.kind === "execute" ? BAL.mana.execute : BAL.mana.kill));
  run.mercy = run.mercy.filter((id) => id !== a.id);
  const [x, y] = advPos(a);
  const from = src.key != null ? [src.key % COLS, (src.key / COLS) | 0] : src.kind === "roar" ? HEART : null;
  run.events.push({ t: "death", id: a.id, x, y, cls: a.cls, execute: src.kind === "execute", boss: a.boss, from, big: src.kind === "spell" || src.kind === "roar" || (CARDS[src.id]?.dmg ?? 0) >= 12, last: !run.spawnQ.length && run.advs.filter((o) => !o.dead && !o.out && !o.npc).length === 0 && run.wave === run.waves.length - 1 });
  for (const o of run.advs) if (active(o) && o !== a && dist(advCell(o), advCell(a)) <= 2) { o.courage -= BAL.fear.allyDeath; checkFlee(run, o); }
  // the diary page that flutters down
  const libs = run.rooms.some((rm) => rm?.type === "library") ? 2 : 1;
  if (run.first && !run.firstKillDone) {
    run.firstKillDone = true;
    grantRecord(run, meta, "k_grandma");
  } else if (withRng(run, (R) => R.chance(0.35 * libs))) {
    const d = { ...a.diary, lines: [...a.diary.lines, fill(withRng(run, (R) => R.pick(STORY.diary.death)), {})], end: "death", day: run.day };
    run.diaries.push(d);
    meta.diaries.push(d);
    if (meta.diaries.length > 80) meta.diaries.shift();
    run.events.push({ t: "diary", x, y, diary: d });
  }
  if (a.boss) {
    run.bossDown = true;
    meta.bossKills++;
    grantRecord(run, meta, "k_order");
  }
}
function escape(run, meta, a) {
  a.out = true;
  if (!a.looter) { run.spared++; meta.sparedTotal++; }
  run.mercy = run.mercy.filter((id) => id !== a.id);
  // the survivor reports to the guild: what hurt the most, and which rooms to avoid
  const top = Object.entries(a.dmgBy).sort((p, q) => q[1] - p[1])[0];
  if (top) run.guild.gear[top[0]] = (run.guild.gear[top[0]] ?? 0) + 1;
  const srcTop = Object.entries(a.srcBy).sort((p, q) => q[1] - p[1])[0];
  if (srcTop?.[0] === "trap") run.guild.gear.trap = (run.guild.gear.trap ?? 0) + 1;
  if (srcTop?.[0] === "monster") run.guild.gear.monster = (run.guild.gear.monster ?? 0) + 1;
  for (const k of a.hitRooms ?? []) run.guild.known[k] = true;
  run.nemeses.push({ name: a.name, cls: a.cls === "boss" ? "warrior" : a.cls, town: a.town, lvl: a.lvl + 1, gear: top ? [top[0]] : [] });
  run.events.push({ t: "escape", id: a.id, name: a.name, learned: top?.[0] ?? null, looter: !!a.looter });
  if (meta.sparedTotal >= 5 && !a.looter) grantRecord(run, meta, "k_letter");
}

export function decideMercy(run, meta, id, spare) {
  const a = run.advs.find((x) => x.id === id);
  run.mercy = run.mercy.filter((x) => x !== id);
  if (!a || !active(a) || a.state !== "flee") return;
  if (spare) {
    a.spare = true;
    run.events.push({ t: "spare", id });
  } else {
    run.executed++;
    kill(run, meta, a, { kind: "execute" });
  }
}

// ---------------------------------------------------------------- the step
export function step(run, meta, dt) {
  if (run.phase !== "wave") return;
  run.t += dt;
  const cb = run.combo;
  if (cb.t > 0) cb.t -= dt;

  // mana trickles in during a wave; altars make it faster
  const altar = run.rooms.filter((rm) => rm?.type === "altar").length * (ROOMS.altar.manaRegen ?? 0);
  run.regenT += dt * (1 + altar);
  if (run.regenT >= BAL.mana.regenEvery) { run.regenT -= BAL.mana.regenEvery; run.mana = Math.min(run.manaMax, run.mana + 1); }

  // spawning
  if (run.spawnQ.length) {
    run.spawnT -= dt;
    if (run.spawnT <= 0) {
      const a = run.spawnQ.shift();
      run.advs.push(a);
      // they come in clumps: sometimes two at once, then a breath
      run.spawnT = withRng(run, (R) => (R.chance(0.35) ? 0.08 : BAL.night.spawnGap * (0.6 + R.next() * 0.9)));
      run.events.push({ t: "spawn", id: a.id, cls: a.cls, boss: a.boss, nemesis: a.nemesis, name: a.name });
    }
  }

  for (const a of run.advs) if (active(a) && !a.npc) updateAdv(run, meta, a, dt);
  for (const [k, rm] of run.rooms.entries()) if (rm?.card) updateCard(run, meta, rm, k % COLS, (k / COLS) | 0, dt);
  for (const m of run.monsters) if (m.hp > 0) updateMonster(run, meta, m, dt);
  run.monsters = run.monsters.filter((m) => m.hp > 0 || m.deadT > 0);
  for (const m of run.monsters) if (m.hp <= 0) m.deadT -= dt;

  // mercy timers: nobody chose, so the dungeon lets them go
  for (const id of [...run.mercy]) {
    const a = run.advs.find((x) => x.id === id);
    if (!a) continue;
    a.mercyT -= dt;
    if (a.mercyT <= 0) decideMercy(run, meta, id, true);
  }

  if (run.heart.hp <= 0) return endNight(run, meta, false);
  // wave over?
  if (!run.spawnQ.length && !run.advs.some(active)) {
    run.advs = [];
    run.mercy = [];
    run.wave++;
    run.events.push({ t: "waveClear" });
    if (run.wave >= run.waves.length) return endNight(run, meta, true);
    offerPick(run, meta, "wave");
  }
}

function updateAdv(run, meta, a, dt) {
  a.cd -= dt;
  a.hitT = Math.max(0, a.hitT - dt);
  // statuses
  if (a.burnT > 0) { a.burnT -= dt; deal(run, meta, a, a.burnDps * dt, "fire", { kind: "status", id: "burn" }); }
  if (a.poisonT > 0) { a.poisonT -= dt; deal(run, meta, a, a.poisonDps * dt, "poison", { kind: "status", id: "poison" }); if (a.poisonT <= 0) a.poisonDps = 0; }
  if (!active(a)) return;
  const here = advCell(a), rm = room(run, ...here), RD = ROOMS[rm?.type] ?? {};
  if (RD.burn && a.burnT <= 0) { a.burnT = 1; a.burnDps = RD.burn; }
  if (a.slowT > 0) a.slowT -= dt;
  if (a.frozenT > 0) { a.frozenT -= dt; return; }
  if (!active(a)) return;

  // the cleric patches people up and steadies their nerves
  if (a.cls === "cleric" && a.state !== "flee") {
    a.healT -= dt;
    if (a.healT <= 0) {
      a.healT = BAL.classes.cleric.healEvery;
      const near = run.advs.filter((o) => active(o) && o.state !== "flee" && dist(advCell(o), here) <= 1);
      const low = near.sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
      if (low && low.hp < low.max) {
        low.hp = Math.min(low.max, low.hp + BAL.classes.cleric.heal * (1 + 0.15 * (run.day - 1)));
        run.events.push({ t: "heal", id: low.id, x: advPos(low)[0], y: advPos(low)[1] });
      }
      for (const o of near) o.courage = Math.min(o.courageMax, o.courage + 8);
    }
  }

  const fleeing = a.state === "flee";
  if (a.prog === 0) {
    // standing in the middle of a room: is something holding us here?
    if (fleeing && here[0] === ENT[0] && here[1] === ENT[1]) return escape(run, meta, a);
    if (!fleeing) {
      if (a.disarmT > 0) {
        a.disarmT -= dt;
        if (a.disarmT <= 0 && rm?.card) { rm.card.disabledT = 14; run.events.push({ t: "disarmed", c: here[0], r: here[1] }); }
        return;
      }
      if (a.lootT > 0) {
        a.lootT -= dt;
        if (a.lootT <= 0) { a.looted = true; run.events.push({ t: "looted", id: a.id, c: here[0], r: here[1] }); }
        return;
      }
      const mons = monstersIn(run, ...here);
      if (mons.length) return fight(run, meta, a, mons);
      if (rm.type === "heart") return hitHeart(run, meta, a);
    }
    const goal = fleeing ? ENT : goalOf(run, a);
    const path = findPath(run, here, goal, !fleeing);
    if (!path || !path.length) {
      if (!fleeing && rm.type === "treasure" && !a.looted) a.lootT = ROOMS.treasure.loot;
      return;
    }
    const nxt = path[0];
    // a wall in this room blocks the way forward until it breaks
    if (!fleeing && rm.card && CARDS[rm.card.id]?.blocks && rm.card.hp > 0) return hitWall(run, meta, a, rm, here);
    a.next = nxt;
    a.face = nxt[0] > here[0] ? 1 : nxt[0] < here[0] ? -1 : a.face;
  }
  // walking
  const slow = Math.max(a.slowT > 0 ? a.slowK : 0, RD.slow ?? 0);
  a.prog += dt * a.speed * (fleeing ? 1.35 : 1) * (1 - slow);
  if (a.prog >= 1) {
    a.cell = a.next; a.next = null; a.prog = 0;
    onEnter(run, meta, a);
  }
}
function goalOf(run, a) {
  if (!a.looted) {
    // greed: the nearest unlooted treasure room first
    let best = null, bd = Infinity;
    for (const [k, rm] of run.rooms.entries()) if (rm?.type === "treasure") {
      const p = [k % COLS, (k / COLS) | 0], d = dist(p, a.cell);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) return best;
  }
  return HEART;
}
function onEnter(run, meta, a) {
  const [c, r] = a.cell, rm = room(run, c, r);
  run.breach[key(c, r)] = (run.breach[key(c, r)] ?? 0) + 1;
  if (a.state !== "flee" && rm.type === "treasure" && !a.looted) a.lootT = ROOMS.treasure.loot;
  if (!rm.card || rm.card.disabledT > 0) return;
  const d = CARDS[rm.card.id];
  // a rogue spots traps and tries to take them apart
  if (a.cls === "rogue" && a.state !== "flee" && d.kind === "trap" && !ROOMS[rm.type].hideTraps) {
    const p = BAL.classes.rogue.disarm + (a.gear.includes("trap") ? 0.4 : 0);
    if (withRng(run, (R) => R.chance(p))) {
      a.disarmT = BAL.classes.rogue.disarmTime;
      run.events.push({ t: "disarm", id: a.id, c, r });
      return;
    }
  }
  if (d.trigger === "enter" && rm.card.cd <= 0 && a.spare !== true) {
    rm.card.cd = d.rearm;
    run.events.push({ t: "trap", id: rm.card.id, c, r, target: a.id });
    deal(run, meta, a, d.dmg, d.el, { kind: "card", id: rm.card.id, key: key(c, r) });
  }
}
function fight(run, meta, a, mons) {
  if (a.cd > 0) return;
  a.cd = a.rate;
  const m = mons.sort((p, q) => p.hp - q.hp)[0];
  let dmg = a.atk * (a.gear.includes("monster") ? 1.5 : 1);
  hurtMonster(run, meta, m, dmg, a);
  run.events.push({ t: "advHit", id: a.id, mid: m.id, cls: a.cls });
}
function hitWall(run, meta, a, rm, [c, r]) {
  if (a.cd > 0) return;
  a.cd = a.rate;
  rm.card.hp -= a.atk;
  const d = CARDS[rm.card.id];
  if (d.thorns) deal(run, meta, a, d.thorns, "physical", { kind: "card", id: rm.card.id, key: key(c, r) });
  run.events.push({ t: "wallHit", c, r, id: a.id });
  if (rm.card.hp <= 0) { rm.card = null; run.events.push({ t: "wallBreak", c, r }); }
}
function hitHeart(run, meta, a) {
  if (a.cd > 0) return;
  a.cd = a.boss ? 2 : a.rate;
  // the first run is the tutorial: the heart comes close to breaking but holds
  const floor = run.first ? Math.ceil(run.heart.max * BAL.heart.firstRunFloor) : 0;
  const dmg = Math.round((BAL.classes[a.cls].heart ?? 4) * (1 + 0.1 * (run.day - 1)));
  run.heart.hp = Math.max(floor, run.heart.hp - dmg);
  run.events.push({ t: "heartHit", id: a.id, amount: dmg });
  const pulse = powerSum(meta, "pulse");
  if (pulse) deal(run, meta, a, pulse, "holy", { kind: "heart" });
  // one blow and they grab what they can and run: catch them on the way out
  if (!a.boss && active(a)) {
    a.state = "flee"; a.looter = true; a.spare = null; a.looted = true;
    run.events.push({ t: "loot", id: a.id });
  }
}
function hurtMonster(run, meta, m, dmg, by) {
  m.hp -= dmg;
  m.hitT = 0.18;
  run.events.push({ t: "monHit", mid: m.id, amount: dmg });
  if (has(m, "겁많음")) {
    // the scaredy monster's shriek frightens the party more than it frightens itself
    for (const a of advsIn(run, m.c, m.r)) scare(run, meta, a, MON.traits["겁많음"].scared);
    run.events.push({ t: "shriek", mid: m.id });
  }
  if (m.hp <= 0) {
    m.deadT = 0.01;
    run.events.push({ t: "monDeath", mid: m.id, c: m.c, r: m.r });
    if (has(m, "분열") && !m.split) {
      for (let i = 0; i < 2; i++) {
        const kid = addMonster(run, { species: m.species, name: "작은 " + m.name, traits: m.traits.filter((t) => t !== "분열"), palette: m.palette, hp: Math.max(4, Math.round(m.max * 0.3)), atk: m.atk * 0.5, rate: m.rate }, m.c, m.r);
        kid.split = true;
      }
    }
  }
}

function updateMonster(run, meta, m, dt) {
  m.cd -= dt;
  m.hitT = Math.max(0, m.hitT - dt);
  m.atkT = Math.max(0, m.atkT - dt);
  if (m.buffT > 0) m.buffT -= dt;
  const rm = room(run, m.c, m.r);
  if (ROOMS[rm.type].regen) m.hp = Math.min(m.max, m.hp + ROOMS[rm.type].regen * dt);
  if (has(m, "치유")) {
    m.healT -= dt;
    if (m.healT <= 0) {
      m.healT = 2;
      for (const o of monstersIn(run, m.c, m.r)) o.hp = Math.min(o.max, o.hp + MON.traits["치유"].heal);
      run.events.push({ t: "fx", id: "monHeal", c: m.c, r: m.r });
    }
  }
  if (m.cd > 0) return;
  const targets = advsNear(run, m.c, m.r, reachOf(m));
  if (!targets.length) return;
  m.cd = m.rate;
  m.atkT = 0.25;
  const a = targets.sort((p, q) => dist(advCell(p), [m.c, m.r]) - dist(advCell(q), [m.c, m.r]) || p.hp - q.hp)[0];
  const crowns = monstersIn(run, m.c, m.r).filter((o) => o !== m && has(o, "왕관")).length;
  let dmg = m.atk * (m.buffT > 0 ? 2 : 1) * (1 + crowns * MON.traits["왕관"].aura);
  const el = monsterEl(m);
  run.events.push({ t: "monAtk", mid: m.id, target: a.id, el, x: advPos(a)[0], y: advPos(a)[1] });
  const done = deal(run, meta, a, dmg, el, { kind: "monster", mid: m.id, key: key(m.c, m.r) });
  for (const t of m.traits) {
    const T = MON.traits[t];
    if (T.burn) { a.burnT = T.burn[1]; a.burnDps = Math.max(a.burnDps, T.burn[0]); }
    if (T.poison) { a.poisonT = T.poison[1]; a.poisonDps = Math.min(4, a.poisonDps + T.poison[0]); }
    if (T.slow) { a.slowT = T.slow[1]; a.slowK = Math.max(a.slowK, T.slow[0]); }
    if (T.fear) scare(run, meta, a, T.fear);
    if (T.leech) m.hp = Math.min(m.max, m.hp + done * T.leech);
  }
}

function updateCard(run, meta, rm, c, r, dt) {
  const card = rm.card, d = CARDS[card.id];
  if (card.disabledT > 0) { card.disabledT -= dt; return; }
  card.cd -= dt;
  if (d.trigger !== "interval" || card.cd > 0) return;
  const RD = ROOMS[rm.type];
  const range = d.range ?? 0;
  let targets = range ? advsNear(run, c, r, range) : advsIn(run, c, r);
  if (!targets.length) { card.cd = 0; return; }
  card.cd = d.interval;
  const src = { kind: "card", id: card.id, key: key(c, r) };
  let mode = d.target;
  // water carries lightning to everyone in the room
  const chained = RD.chain && RD.chain === d.el && mode === "one";
  if (chained) mode = "all";
  if (mode === "one") targets = [targets.sort((p, q) => dist(advCell(p), [c, r]) - dist(advCell(q), [c, r]) || p.hp - q.hp)[0]];
  if (mode === "chain") targets = targets.sort((p, q) => dist(advCell(p), [c, r]) - dist(advCell(q), [c, r])).slice(0, d.chain);
  run.events.push({ t: "trap", id: card.id, c, r, targets: targets.map((a) => a.id), chained, positions: targets.map(advPos) });
  if (chained && targets.length) run.events.push({ t: "synergy", c, r, text: "물 + 번개! 피해 ×2" });
  for (const a of targets) {
    if (d.dmg) deal(run, meta, a, d.dmg, d.el, src);
    if (!targetable(a)) continue;
    if (d.fear) scare(run, meta, a, d.fear);
    if (d.burn) { a.burnT = d.burn[1]; a.burnDps = Math.max(a.burnDps, d.burn[0]); }
    if (d.poison) { a.poisonT = d.poison[1] * (ROOMS[rm.type].mods?.poison ?? 1); a.poisonDps = Math.min(5, a.poisonDps + d.poison[0]); }
    if (d.slow) { a.slowT = d.slow[1] * (RD.slowMul ?? 1); a.slowK = Math.max(a.slowK, d.slow[0]); }
  }
}

// ---------------------------------------------------------------- dawn and day
function endNight(run, meta, survived) {
  run.advs = [];
  run.mercy = [];
  if (!survived) {
    run.phase = "end";
    run.result = finishRun(run, meta, false);
    run.events.push({ t: "defeat" });
    return;
  }
  meta.bestDay = Math.max(meta.bestDay, run.day);
  if (run.day >= run.maxDays) {
    run.phase = "end";
    run.result = finishRun(run, meta, true);
    run.events.push({ t: "victory" });
    return;
  }
  // dawn: settle up, heal the monsters, count the treasure
  const treasure = run.rooms.filter((rm) => rm?.type === "treasure").length * ROOMS.treasure.manaPerDay;
  run.mana = Math.min(run.manaMax, run.mana + treasure);
  for (const m of run.monsters) if (m.hp > 0) m.hp = m.max;
  for (const rm of run.rooms) if (rm?.card) { rm.card.disabledT = 0; if (CARDS[rm.card.id].hp) rm.card.hp = Math.max(rm.card.hp, CARDS[rm.card.id].hp * 0.5); }
  run.dawn = { day: run.day, treasure, diaries: run.diaries.filter((d) => d.day === run.day).length, spared: run.spared, rumor: rumorOf(run) };
  run.phase = "dawn";
  run.events.push({ t: "dawn" });
}
export function rumorOf(run) {
  const top = Object.entries(run.guild.gear).sort((p, q) => q[1] - p[1])[0];
  return STORY.rumors[top?.[0] ?? "none"];
}

export function startDay(run, meta) {
  run.day++;
  run.phase = "day";
  run.breedsLeft = BAL.breed.slots + powerSum(meta, "breed");
  run.roomOffer = withRng(run, (R) => roomOptions(run, meta, R));
  run.roomPicked = false;
  run.events.push({ t: "day", day: run.day });
}
export const canBreed = (run) => run.breedsLeft > 0 && run.monsters.filter((m) => m.hp > 0).length >= 2;

function roomOptions(run, meta, R) {
  if (run.first && run.day === 2) return ["water", "treasure", "nest"];
  if (run.first && run.day === 3) return ["sealed", "web", "water"];
  const pool = Object.keys(ROOMS).filter((id) => !["hall", "entrance", "heart", "secret", "sealed"].includes(id) && unlocked(meta, ROOMS[id]));
  const out = shuffle(R, pool).slice(0, BAL.room.options);
  const sealedLeft = !meta.records.includes("k_mage1") || (meta.powers.length >= 8 && !meta.records.includes("k_abyss"));
  if (sealedLeft && !run.rooms.some((rm) => rm?.type === "sealed") && R.chance(0.25)) out[R.int(out.length)] = "sealed";
  return out;
}
export function roomTargets(run, type) {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (canPlaceRoom(run, type, c, r)) out.push([c, r]);
  return out;
}
export function canPlaceRoom(run, type, c, r) {
  const rm = room(run, c, r);
  if (rm) return rm.type === "hall";
  if (!inGrid(c, r)) return false;
  return neighbors(run, c, r).some(([nc, nr]) => room(run, nc, nr).type !== "secret");
}
export function placeRoom(run, meta, type, c, r) {
  if (!canPlaceRoom(run, type, c, r)) return false;
  const old = room(run, c, r);
  run.rooms[key(c, r)] = { type, card: old?.card ?? null };
  run.roomPicked = true;
  run.events.push({ t: "room", c, r, type });
  if (type === "sealed") openSecret(run, meta, c, r, sealedRecord(meta));
  for (const cb of STORY.combos) {
    if (meta.records.includes(cb.record)) continue;
    if (comboAt(run, cb.rooms)) { const at = comboAt(run, cb.rooms); openSecret(run, meta, at[0], at[1], cb.record); }
  }
  return true;
}
function sealedRecord(meta) {
  if (!meta.records.includes("k_mage1")) return "k_mage1";
  if (!meta.records.includes("k_abyss")) return "k_abyss";
  return null;
}
function comboAt(run, [a, b]) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (room(run, c, r)?.type !== a) continue;
    for (const [nc, nr] of neighbors(run, c, r)) if (room(run, nc, nr).type === b) return [c, r];
  }
  return null;
}
function openSecret(run, meta, c, r, record) {
  // the wall splits and blue light leaks out: a secret room in the rock next door
  const spot = N4.map(([dc, dr]) => [c + dc, r + dr]).find(([x, y]) => inGrid(x, y) && !room(run, x, y));
  if (spot) run.rooms[key(...spot)] = { type: "secret", card: null };
  run.events.push({ t: "secret", c: spot?.[0] ?? c, r: spot?.[1] ?? r, record });
  grantRecord(run, meta, record);
}

// ---------------------------------------------------------------- breeding
function natureOf(species) {
  return { slime: "단단함", bat: "날개", frog: "단단함", ghost: "공포", snake: "독", eyeball: "원거리", skull: "불", wisp: "치유" }[species];
}
export function breed(run, meta, idA, idB) {
  const A = run.monsters.find((m) => m.id === idA), B = run.monsters.find((m) => m.id === idB);
  if (!A || !B || A === B || run.breedsLeft <= 0) return null;
  run.breedsLeft--;
  return withRng(run, (R) => {
    const species = R.chance(0.5) ? A.species : B.species;
    const ta = A.traits.length ? R.pick(A.traits) : natureOf(A.species);
    let tb = B.traits.length ? R.pick(B.traits) : natureOf(B.species);
    if (tb === ta) tb = R.pick(Object.keys(MON.traits).filter((t) => t !== ta && !MON.mutations.includes(t)));
    const traits = [ta, tb];
    const firstEver = meta.breeds === 0;
    const pMut = BAL.breed.mutation * (powerSum(meta, "mutate") || 1);
    let mutant = false;
    if (firstEver) {
      // the first breeding always goes gloriously wrong
      traits.length = 0; traits.push("왕관", "겁많음"); mutant = true;
    } else if (R.chance(pMut)) {
      const m = R.pick(MON.mutations.filter((t) => !traits.includes(t)));
      traits.push(m); mutant = true;
    }
    const base = Object.values(CARDS).find((cd) => cd.kind === "monster" && cd.species === species) ?? CARDS.slime;
    const gen = Math.max(A.gen ?? 1, B.gen ?? 1) + 1;
    const palName = traits.map((t) => MON.traits[t]?.palette).find(Boolean);
    const palette = mutant && !firstEver ? MON.palettes.rainbow : palName ? MON.palettes[palName] : A.palette ?? MON.species[species].palette ?? null;
    const sp = MON.special[[ta, tb].join("+")] ?? MON.special[[tb, ta].join("+")];
    const name = sp ?? [...traits.map((t) => MON.traits[t].adj), MON.species[species].name].join(" ");
    const mon = {
      id: "m" + Date.now().toString(36) + R.int(1e6).toString(36), species, name, traits, palette, mutant, gen,
      hp: Math.round(base.hp * (1 + 0.1 * (gen - 1))), atk: base.atk * (1 + 0.1 * (gen - 1)), rate: base.rate, el: base.el,
      parents: [A.name ?? MON.species[A.species].name, B.name ?? MON.species[B.species].name],
    };
    mon.lineageId = mon.id;
    meta.breeds++;
    meta.lineage.push(mon);
    if (meta.lineage.length > 40) meta.lineage.shift();
    if (!meta.favorite || mutant) meta.favorite = mon.id;
    run.hand.push({ id: "bred", mon, uid: run.uid++ });
    run.events.push({ t: "hatch", mon, firstEver });
    return mon;
  });
}
export function renameMonster(run, meta, monId, name) {
  const m = meta.lineage.find((x) => x.id === monId);
  if (!m || !name.trim()) return;
  m.name = name.trim().slice(0, 16);
  for (const c of run.hand) if (c.mon?.id === monId) c.mon.name = m.name;
  meta.named = true;
}

// ---------------------------------------------------------------- the end of a run
function finishRun(run, meta, win) {
  const S = BAL.souls;
  const days = win ? run.day : run.day - 1;
  let souls = S.base + Math.floor(days / S.daysPer) + Math.floor(run.kills / S.killsPer) + (win ? S.win : 0) + Math.floor(run.spared / S.sparedPer);
  if (run.rooms.some((rm) => rm?.type === "library")) souls += ROOMS.library.soulBonus;
  meta.souls += souls;
  meta.runs++;
  meta.killedTotal += run.kills;
  if (win) { meta.wins++; if (!run.first) grantRecord(run, meta, "k_ledger"); }
  const top = Object.entries(run.breach).sort((p, q) => q[1] - p[1]);
  return { win, souls, days, kills: run.kills, spared: run.spared, executed: run.executed, breach: top[0] ? +top[0][0] : null };
}

// ---------------------------------------------------------------- saving
export function snapshot(run) {
  const { events, ...rest } = run;
  return JSON.parse(JSON.stringify({ ...rest, events: [] }));
}
