// The rules of 던전이 살아있다: a run, its days and nights, and everything that fights in it.
// No DOM, no drawing: the renderer and the UI read the state and drain `run.events`.
// Every number lives in ../data/*.json.

import CARDS from "../data/cards.json";
import ROOMS from "../data/rooms.json";
import BAL from "../data/balance.json";
import POWERS from "../data/powers.json";
import MON from "../data/monsters.json";
import STORY from "../data/story.json";
import { WP, ZONES, HEART_WP, ENT_WP, GATE_WP, zoneOf, zoneLinks, distW, wpXY, nearestWp } from "./map.js";
import { flyStep, hollowAt, ceilingAbove } from "./phys.js";

export { CARDS, ROOMS, BAL, POWERS, MON, STORY, WP, ZONES, HEART_WP, ENT_WP, GATE_WP, zoneOf, wpXY, hollowAt };

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

// ---------------------------------------------------------------- the cave
// Rooms are zones of the hand-drawn cave (chambers, tunnels, the gate, the heart's hall).
// Everything stands on a waypoint `w`; distances are in world pixels.
export const roomOf = (run, w) => (w == null ? null : run.rooms[zoneOf(w)] ?? null);
export const isOpenW = (run, w) => !!run.rooms[zoneOf(w)]?.open;
export const isFixed = (rm) => rm && (rm.type === "entrance" || rm.type === "heart");
const dW = (a, b) => distW(a, b);
const R_TRAP = 12, R_ZONE = 34, R_MELEE = 20, R_REACH = 64, R_SPELL = 30, R_SPLASH = 78, R_FEAR = 90, R_HEAL = 50;
export const cardRadius = (d) => (d.trigger === "enter" ? R_TRAP : d.range ? R_ZONE + d.range * 60 : R_ZONE);
export const spellRadius = (d) => (d.radius ? R_SPLASH : R_SPELL);

/** Tunnels are open when both ends are. */
function refreshTunnels(run) {
  for (const z of Object.values(ZONES)) if (z.kind === "tunnel") run.rooms[z.id].open = !!(run.rooms[z.join[0]]?.open && run.rooms[z.join[1]]?.open);
  run.ver = (run.ver ?? 0) + 1;
}
const fields = new WeakMap();
/** Walking distance from every waypoint to the goal. Zones the guild knows are deadly cost more, so parties walk around them when they can. */
export function field(run, goal, avoid = true) {
  let c = fields.get(run);
  if (!c || c.ver !== run.ver) { c = { ver: run.ver, f: {} }; fields.set(run, c); }
  const k = goal + ":" + (avoid ? 1 : 0);
  if (c.f[k]) return c.f[k];
  const n = WP.length, dist = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
  const danger = {};
  if (avoid) for (const cd of run.cards) { const z = zoneOf(cd.w); if (run.guild.known[z]) danger[z] = true; }
  dist[goal] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const v of WP[u].nb) {
      if (done[v] || !isOpenW(run, v)) continue;
      const nd = best + dW(u, v) + (danger[zoneOf(v)] ? 24 : 0);
      if (nd < dist[v]) dist[v] = nd;
    }
  }
  return (c.f[k] = dist);
}
function nextToward(run, here, goal, avoid) {
  const f = field(run, goal, avoid);
  let best = null, bd = f[here];
  for (const nb of WP[here].nb) if (isOpenW(run, nb) && f[nb] < bd) { bd = f[nb]; best = nb; }
  return best;
}
const bump = (run) => { run.ver = (run.ver ?? 0) + 1; };

// ---------------------------------------------------------------- runs
export function newRun(meta, seed = (Math.random() * 2 ** 31) | 0) {
  const first = meta.runs === 0;
  const R = makeRng(seed);
  const rooms = {};
  for (const z of Object.values(ZONES)) rooms[z.id] = { type: { entrance: "entrance", heart: "heart", secret: "secret" }[z.kind] ?? "hall", open: !z.closed };
  const run = {
    v: 2, ver: 1, seed, rs: R.state, first, day: 1, maxDays: first ? 3 : 7, phase: "night_pick", t: 0,
    heart: { hp: 0, max: 0 }, mana: BAL.mana.start + powerSum(meta, "mana"), manaMax: BAL.mana.max + powerSum(meta, "manaMax"),
    regenT: 0, hand: [], rooms, cards: [], monsters: [], advs: [], wave: 0, waves: [], spawnQ: [], spawnT: 0, gapT: 0,
    kills: 0, spared: 0, executed: 0, nemeses: [], guild: { gear: {}, known: {} }, diaries: [], recordsFound: [],
    events: [], uid: 1, pick: null, roomOffer: null, pendingRoom: null, breedsLeft: 0, mercy: [], mercyShown: 0,
    combo: { n: 0, t: 0, last: null }, discount: powerSum(meta, "discount"), options: BAL.night.pickOptions + powerSum(meta, "options"),
    breach: {}, stats: { dmg: 0, hits: 0 }, rage: 0, rageNeed: meta.runs === 0 ? BAL.roar.firstNeed : BAL.roar.need, roars: 0, bossDown: false, result: null, firstKillDone: false, speed: 1,
  };
  refreshTunnels(run);
  const max = (first ? BAL.heart.firstRunHp : BAL.heart.hp) + powerSum(meta, "heart");
  run.heart = { hp: max, max };
  // what was left after a hundred years on the old road: one rusty trap and two slimes
  run.cards.push({ uid: run.uid++, id: "spike", w: ZONES.tAB.center, cd: 0, hp: 0, disabledT: 0 });
  addMonster(run, CARDS.slime, ZONES.B.center);
  addMonster(run, CARDS.slime, ZONES.H.center);
  // the deck: spells come back after use, buildings are spent once built
  run.deck = withRng(run, (R) => shuffle(R, BAL.deck.start.map((id) => ({ id, uid: run.uid++ }))));
  run.discard = [];
  run.drawT = 0;
  run.clawCd = 0;
  run.streak = { n: 0, t: 0, best: 0 };
  if (!first && meta.favorite) {
    const fav = meta.lineage.find((m) => m.id === meta.favorite);
    if (fav) run.deck.unshift({ id: "bred", mon: fav, uid: run.uid++ });
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
/** Draw one card into the hand; an empty draw pile is refilled from the discards. */
export function draw(run) {
  ensureDeck(run);
  if (run.hand.length >= BAL.deck.hand) return null;
  if (!run.deck.length && run.discard.length) { run.deck = withRng(run, (R) => shuffle(R, run.discard)); run.discard = []; }
  const c = run.deck.shift();
  if (c) { run.hand.push(c); run.events.push({ t: "draw", id: c.id }); }
  return c;
}
export function ensureDeck(run) { run.deck ??= []; run.discard ??= []; run.drawT ??= 0; run.clawCd ??= 0; run.grabCd ??= 0; run.rocks ??= []; run.streak ??= { n: 0, t: 0, best: 0 }; }
export function startNight(run, meta) {
  ensureDeck(run);
  run.phase = "night_pick";
  run.wave = 0;
  for (let i = 0; i < BAL.deck.nightDraw; i++) draw(run);
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
    if (d === 1) return [party(7, ["warrior", "rogue", "mage"])];
    if (d === 2) return [party(8, ["warrior", "rogue", "cleric"]), party(8, ["warrior", "mage"])];
    return [party(9, ["rogue", "mage"]), party(11, ["warrior", "cleric", "mage"])];
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

const BANDS = ["왕국 토벌대", "잿빛 늑대 용병단", "성광 기사단 분대", "붉은 방패단", "심장 사냥꾼 조합", "왕실 채굴단 호위대"];
function beginWave(run, meta) {
  const party = run.waves[run.wave];
  run.phase = "wave";
  run.spawnT = 0.6;
  // they march in order: shields in front, healers at the back
  const ORDER = { boss: 0, warrior: 1, rogue: 2, mage: 3, cleric: 4 };
  run.spawnQ = withRng(run, (R) => [...party].sort((a, b) => ORDER[a] - ORDER[b]).map((cls) => makeAdv(run, meta, cls, R)));
  run.spawnQ.forEach((a, i) => (a.lane = ((i % 3) - 1) * 0.8));
  // a nemesis sometimes joins: someone you let go, back with better gear
  if (!run.first && run.nemeses.length && withRng(run, (R) => R.chance(0.5))) {
    const n = run.nemeses.shift();
    run.spawnQ.push(withRng(run, (R) => makeAdv(run, meta, n.cls, R, n)));
  }
  const band = withRng(run, (R) => R.pick(BANDS));
  run.events.push({ t: "wave", n: run.wave + 1, of: run.waves.length, party: run.spawnQ.map((a) => a.cls), band, captain: run.spawnQ[0]?.name });
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
    gear, cell: ENT_WP, next: null, prog: 0, zone: "entrance", trig: [], seen: [], state: "walk", cd: 0.5, healT: 1, disarmT: 0, disarmCard: null,
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
/** Every waypoint a card could go on, or null when it needs no target. */
export function cardTargets(run, card) {
  const d = cardDef(card), out = [];
  if (d.kind === "support" && d.heal) return null;
  for (const w of WP) if (canPlay(run, card, w.id).ok) out.push(w.id);
  return out;
}
export const cardAt = (run, w, r = 14) => run.cards.find((c) => dW(c.w, w) < r) ?? null;
export function canPlay(run, card, w) {
  const d = cardDef(card);
  if (cardCost(run, card) > run.mana) return { ok: false, why: "마나가 모자라요" };
  if (d.kind === "support" && d.heal) return { ok: true };
  const rm = roomOf(run, w);
  if (!rm || !rm.open) return { ok: false, why: "무너진 곳이에요" };
  if (d.kind === "trap" || d.kind === "facility") {
    if (isFixed(rm) || rm.type === "secret" || rm.type === "sealed") return { ok: false, why: "여기엔 놓을 수 없어요" };
    if (cardAt(run, w, 16)) return { ok: false, why: "바로 옆에 이미 무언가 있어요" };
    if (dW(w, GATE_WP) < 30) return { ok: false, why: "문 앞은 너무 밝아요" };
    return { ok: true };
  }
  if (d.kind === "monster") {
    if (rm.type === "entrance") return { ok: false, why: "입구에는 둘 수 없어요" };
    const cap = ROOMS[rm.type].monsterCap ?? 2;
    if (run.monsters.filter((m) => m.hp > 0 && zoneOf(m.w) === zoneOf(w)).length >= cap) return { ok: false, why: "이 방은 꽉 찼어요" };
    if (run.monsters.some((m) => m.hp > 0 && dW(m.w, w) < 10)) return { ok: false, why: "너무 붙어 있어요" };
    return { ok: true };
  }
  if (d.kind === "support" && d.buff) {
    if (!monstersNear(run, w, 40).length) return { ok: false, why: "몬스터 곁에 써요" };
    return { ok: true };
  }
  return { ok: true };
}
export function playCard(run, meta, handIdx, w) {
  const card = run.hand[handIdx];
  if (!card) return { ok: false };
  const chk = canPlay(run, card, w);
  if (!chk.ok) return chk;
  const d = cardDef(card);
  if (run.phase !== "wave" && run.phase !== "night_pick" && run.phase !== "prologue" && d.kind !== "trap" && d.kind !== "facility" && d.kind !== "monster")
    return { ok: false, why: "밤에만 쓸 수 있어요" };
  run.mana -= cardCost(run, card);
  run.hand.splice(handIdx, 1);
  // spells and support go back into the deck; what gets built is spent
  if (d.kind === "spell" || d.kind === "support") { ensureDeck(run); run.discard.push(card); }
  if (d.kind === "trap" || d.kind === "facility") {
    run.cards.push({ uid: run.uid++, id: card.id, w, cd: 0.4, hp: d.hp ?? 0, disabledT: 0 });
    bump(run);
    run.events.push({ t: "place", w, id: card.id });
  } else if (d.kind === "monster") {
    const m = addMonster(run, card.id === "bred" ? card.mon : d, w);
    run.events.push({ t: "summon", w, m });
  } else if (d.kind === "spell") {
    castSpell(run, meta, d, w, card.id);
  } else if (d.kind === "support") {
    if (d.heal) {
      run.heart.hp = Math.min(run.heart.max, run.heart.hp + d.heal);
      run.events.push({ t: "fx", id: "heal", w: HEART_WP });
    } else if (d.buff) {
      for (const m of monstersNear(run, w, 40)) { m.buffT = d.dur; m.hp = Math.min(m.max, m.hp + m.max * 0.5); }
      run.events.push({ t: "fx", id: "rage", w });
    }
  }
  run.events.push({ t: "sfx", name: "play" });
  return { ok: true };
}

function castSpell(run, meta, d, w, id) {
  run.events.push({ t: "spell", id, w });
  const [x, y] = wpXY(w);
  if (d.spawn === "roll") return spawnBoulder(run, w, d);
  if (d.spawn === "rockfall") return spawnRockfall(run, w, d);
  for (const a of advsNearXY(run, x, y, spellRadius(d))) {
    const direct = Math.hypot(advPos(a)[0] - x, advPos(a)[1] - y) <= R_SPELL;
    const dmg = direct ? d.dmg : d.splash ?? d.dmg;
    if (dmg) deal(run, meta, a, dmg, d.el, { kind: "spell", id, w });
    if (d.freeze) a.frozenT = Math.max(a.frozenT, d.freeze);
    if (d.fear) scare(run, meta, a, d.fear);
    if (d.knock && targetable(a) && !a.fly) { const [ax] = advPos(a); launch(run, a, Math.sign(ax - x || 1) * d.knock * 0.35, -d.knock); }
  }
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
export function monstersNear(run, w, r) {
  return run.monsters.filter((m) => m.hp > 0 && dW(m.w, w) <= r);
}
export function monstersInZone(run, zid) {
  return run.monsters.filter((m) => m.hp > 0 && zoneOf(m.w) === zid);
}
export function addMonster(run, spec, w) {
  const traits = spec.traits ?? [];
  let hpK = 1, atkK = 1;
  for (const t of traits) { hpK += MON.traits[t]?.hp ?? 0; atkK += MON.traits[t]?.atk ?? 0; }
  const hp = Math.round(spec.hp * hpK);
  const m = {
    id: run.uid++, species: spec.species, name: spec.name, traits: [...traits], palette: spec.palette ?? null,
    mutant: !!spec.mutant, lineageId: spec.lineageId ?? spec.id ?? null, el: spec.el ?? "physical",
    hp, max: hp, atk: spec.atk * atkK, rate: spec.rate ?? 1, cd: 0.5, w, buffT: 0, healT: 1, hitT: 0, atkT: 0, split: false,
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
  return m.traits.some((t) => MON.traits[t]?.reach) ? R_REACH : R_MELEE;
}

// ---------------------------------------------------------------- adventurers
/** World position of an adventurer's feet. */
export function advPos(a) {
  if (a.fly) return [a.fly.x, a.fly.y];
  const A = WP[a.cell];
  if (a.next == null) return [A.x, A.y];
  const B = WP[a.next];
  return [A.x + (B.x - A.x) * a.prog, A.y + (B.y - A.y) * a.prog];
}
/** The waypoint an adventurer counts as standing on. */
export function advCell(a) {
  return a.next != null && a.prog >= 0.5 ? a.next : a.cell;
}
const active = (a) => !a.dead && !a.out;
const targetable = (a) => active(a) && a.spare !== true && !a.npc;
function advsNearXY(run, x, y, r) {
  return run.advs.filter((a) => { if (!targetable(a)) return false; const [ax, ay] = advPos(a); return Math.hypot(ax - x, ay - y) <= r; });
}
export function advsNear(run, w, r) {
  const [x, y] = wpXY(w);
  return advsNearXY(run, x, y, r);
}
const advDist = (a, w) => { const [x, y] = advPos(a), [wx, wy] = wpXY(w); return Math.hypot(x - wx, y - wy); };
const zoneOfAdv = (a) => zoneOf(advCell(a));

function deal(run, meta, a, amount, el, src) {
  if (!targetable(a) || amount <= 0) return 0;
  const rm = run.rooms[zoneOfAdv(a)];
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
  if (src.w != null) (a.hitZones ??= new Set()).add(zoneOf(src.w));
  a.courage -= dmg * BAL.fear.dmgToCourage;
  run.stats.dmg += dmg; run.stats.hits++;
  if (src.kind !== "status" && src.kind !== "roar") run.rage = Math.min(run.rageNeed, (run.rage ?? 0) + BAL.roar.perHit);
  const [x, y] = advPos(a);
  if (src.kind === "status") {
    // burns and poison tick every frame: show them as one number per whole point
    a.dot = (a.dot ?? 0) + dmg;
    if (a.dot >= 1) { run.events.push({ t: "dmg", id: a.id, amount: Math.floor(a.dot), el, dot: true, x, y }); a.dot -= Math.floor(a.dot); }
    if (a.hp <= 0) kill(run, meta, a, src);
    else checkFlee(run, a);
    return dmg;
  }
  run.events.push({ t: "dmg", id: a.id, amount: dmg, el, boosted: mods?.[el] > 1, x, y });
  // a combo is several different sources landing on the party in quick succession
  const cb = run.combo, sid = src.kind + ":" + (src.id ?? src.mid ?? "") + ":" + (src.w ?? "");
  if (cb.t > 0 && cb.last !== sid) { cb.n++; if (cb.n >= 3) run.events.push({ t: "combo", n: cb.n }); }
  else if (cb.t <= 0) cb.n = 1;
  cb.last = sid; cb.t = 1.1;
  if (a.hp <= 0) kill(run, meta, a, src);
  else checkFlee(run, a);
  return dmg;
}
function scare(run, meta, a, amount) {
  if (!targetable(a)) return;
  const rm = run.rooms[zoneOfAdv(a)];
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
    a.disarmT = 0; a.lootT = 0;
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
  ensureDeck(run);
  const sk = run.streak;
  sk.n = sk.t > 0 ? sk.n + 1 : 1; sk.t = BAL.streak.window; sk.best = Math.max(sk.best, sk.n);
  const bonus = BAL.streak.bonus[sk.n];
  if (bonus) run.mana = Math.min(run.manaMax, run.mana + bonus);
  if (sk.n >= 2) run.events.push({ t: "streak", n: sk.n, bonus: bonus ?? 0 });
  const [x, y] = advPos(a);
  const from = src.w != null ? wpXY(src.w) : src.kind === "roar" ? wpXY(HEART_WP) : null;
  const fv = a.fly ? [a.fly.vx, a.fly.vy] : null;
  a.fly = null;
  run.events.push({ t: "death", id: a.id, x, y, fv, src: src.kind, cls: a.cls, execute: src.kind === "execute", boss: a.boss, from, big: src.kind === "spell" || src.kind === "roar" || (CARDS[src.id]?.dmg ?? 0) >= 12, last: !run.spawnQ.length && run.advs.filter((o) => !o.dead && !o.out && !o.npc).length === 0 && run.wave === run.waves.length - 1 });
  for (const o of run.advs) if (active(o) && o !== a && Math.hypot(advPos(o)[0] - x, advPos(o)[1] - y) <= R_FEAR) { o.courage -= BAL.fear.allyDeath; checkFlee(run, o); }
  // the diary page that flutters down
  const libs = Object.values(run.rooms).some((rm) => rm.open && rm.type === "library") ? 2 : 1;
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
  // the survivor reports to the guild: what hurt the most, and which places to avoid
  const top = Object.entries(a.dmgBy).sort((p, q) => q[1] - p[1])[0];
  if (top) run.guild.gear[top[0]] = (run.guild.gear[top[0]] ?? 0) + 1;
  const srcTop = Object.entries(a.srcBy).sort((p, q) => q[1] - p[1])[0];
  if (srcTop?.[0] === "trap") run.guild.gear.trap = (run.guild.gear.trap ?? 0) + 1;
  if (srcTop?.[0] === "monster") run.guild.gear.monster = (run.guild.gear.monster ?? 0) + 1;
  for (const z of a.hitZones ?? []) run.guild.known[z] = true;
  bump(run);
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

// ---------------------------------------------------------------- bodies in the air
const PH = () => BAL.phys;
/** Knock an intruder off its feet with a velocity (world units per second). */
export function launch(run, a, vx, vy) {
  if (!targetable(a)) return;
  const heavy = a.boss ? 0.35 : a.cls === "warrior" ? 0.8 : 1;
  const [x, y] = advPos(a);
  if (a.fly) { a.fly.vx += vx * heavy; a.fly.vy = Math.min(a.fly.vy, vy * heavy); a.fly.ground = false; return; }
  a.fly = { x, y: y - 1, vx: vx * heavy, vy: vy * heavy, t: 0, peak: y, hit: [] };
  a.next = null; a.prog = 0;
}
/** The heart's hand closes around an intruder. */
export function grab(run, meta, id) {
  ensureDeck(run);
  if (run.phase !== "wave" || run.grabCd > 0 || run.advs.some((o) => o.fly?.held)) return { ok: false, why: "cd" };
  const a = run.advs.find((x) => x.id === id);
  if (!a || !targetable(a)) return { ok: false };
  if (a.boss) { run.events.push({ t: "tooHeavy", id }); return { ok: false, why: "heavy" }; }
  const [x, y] = advPos(a);
  a.fly = { x, y, vx: 0, vy: 0, t: 0, peak: y, hit: [], held: true, holdT: 0 };
  a.next = null; a.prog = 0;
  scare(run, meta, a, 10);
  run.events.push({ t: "grab", id, x, y });
  return { ok: true };
}
/** Drag the held intruder toward (x, y) (feet), never through rock. */
export function holdAt(run, x, y) {
  const a = run.advs.find((o) => o.fly?.held);
  if (!a) return false;
  const f = a.fly, open = (px, py) => hollowAt(run.rooms, px, py) && hollowAt(run.rooms, px, py - 12);
  const dx = x - f.x, dy = y - f.y, L = Math.hypot(dx, dy), steps = Math.ceil(L / 2);
  for (let i = 1; i <= steps; i++) {
    const px = f.x + (dx * 1) / steps, py = f.y + (dy * 1) / steps;
    if (open(px, py)) { f.x = px; f.y = py; }
    else if (open(px, f.y)) f.x = px;
    else if (open(f.x, py)) f.y = py;
    else break;
  }
  f.peak = Math.min(f.peak, f.y);
  return true;
}
/** Let go: the held intruder flies with the hand's velocity. */
export function fling(run, meta, vx, vy) {
  const a = run.advs.find((o) => o.fly?.held);
  if (!a) return false;
  const f = a.fly, sp = Math.hypot(vx, vy), max = PH().flingMax, k = sp > max ? max / sp : 1;
  const heavy = a.cls === "warrior" ? 0.8 : 1;
  f.vx = vx * k * heavy; f.vy = vy * k * heavy; f.held = false; f.ground = false; f.t = 0; f.peak = f.y;
  run.grabCd = PH().grabCd;
  run.events.push({ t: "fling", id: a.id, x: f.x, y: f.y, speed: sp * k });
  return true;
}
function flyAdv(run, meta, a, dt) {
  const f = a.fly, P = PH();
  if (f.held) {
    f.holdT += dt;
    if (f.holdT > P.holdMax) fling(run, meta, 0, 0);
    return;
  }
  f.t += dt;
  const scale = 1 + P.perDay * (run.day - 1);
  const hit = (kind, v) => {
    if (!targetable(a)) return;
    const thr = kind === "floor" ? P.fallT : P.wallT;
    if (v <= thr) return;
    const dmg = Math.round((v - thr) * (kind === "floor" ? P.fallK : P.wallK) * scale * 10) / 10;
    run.events.push({ t: "slam", id: a.id, kind, v, x: f.x, y: f.y, vx: f.vx, vy: f.vy });
    if (dmg > 0) deal(run, meta, a, dmg, "physical", { kind: "slam" });
  };
  const air = flyStep(run.rooms, f, dt, hit, { height: 16 });
  if (!targetable(a)) { if (a.fly) a.fly = null; return; }
  f.peak = Math.min(f.peak, f.y);
  // a fast body bowls over whoever it hits
  const sp = Math.hypot(f.vx, f.vy);
  if (sp > P.bowlV) {
    for (const o of run.advs) {
      if (o === a || !targetable(o) || f.hit.includes(o.id)) continue;
      const [ox, oy] = advPos(o);
      if (Math.abs(ox - f.x) < 10 && Math.abs(oy - 8 - (f.y - 8)) < 14) {
        f.hit.push(o.id);
        run.events.push({ t: "bowl", id: o.id, x: ox, y: oy });
        deal(run, meta, o, Math.round(sp * P.bowlK * scale * 10) / 10, "physical", { kind: "slam" });
        if (targetable(o)) launch(run, o, f.vx * 0.7, -140 - sp * 0.15);
        f.vx *= 0.75;
      }
    }
  }
  if (f.y > 600) { run.events.push({ t: "abyss", id: a.id, x: f.x }); return kill(run, meta, a, { kind: "slam" }); }
  if (!air || f.t > 5) {
    // back on the floor: pick up the nearest walkable spot and get up, dazed
    const w = nearestWp(f.x, f.y, 40, (p) => isOpenW(run, p.id)) ?? nearestWp(f.x, f.y, Infinity, (p) => isOpenW(run, p.id));
    a.fly = null;
    a.cell = w; a.next = null; a.prog = 0;
    a.frozenT = Math.max(a.frozenT, P.daze); a.dazeT = Math.max(a.dazeT ?? 0, P.daze);
    run.events.push({ t: "land", id: a.id });
    onEnter(run, meta, a);
  }
}

// rolling boulders and falling rocks: the cave itself as a weapon
function spawnBoulder(run, w, d) {
  ensureDeck(run);
  const f = field(run, ENT_WP, false);
  let dir = 0, bd = f[w];
  for (const nb of WP[w].nb) if (isOpenW(run, nb) && f[nb] < bd) { bd = f[nb]; dir = Math.sign(WP[nb].x - WP[w].x); }
  if (!dir) dir = -1;
  const [x, y] = wpXY(w);
  run.rocks.push({ kind: "roll", x, y: y - 1, vx: dir * d.speed, vy: 0, ground: true, t: 0, hit: [], dmg: d.dmg, knock: d.knock, id: run.uid++ });
}
function spawnRockfall(run, w, d) {
  ensureDeck(run);
  const [x, y] = wpXY(w);
  for (let i = 0; i < d.count; i++) {
    const rx = x + (i - (d.count - 1) / 2) * 9 + withRng(run, (R) => R.next() * 6 - 3);
    if (!hollowAt(run.rooms, rx, y - 4)) continue;
    const top = ceilingAbove(run.rooms, rx, y - 4) + 3;
    run.rocks.push({ kind: "drop", x: rx, y: top, vx: 0, vy: 0, t: -i * 0.09 - withRng(run, (R) => R.next() * 0.06), hit: [], dmg: d.dmg, stun: d.stun, id: run.uid++ });
  }
  run.events.push({ t: "rumble", x, y });
}
function stepRocks(run, meta, dt) {
  for (const r of run.rocks) {
    r.t += dt;
    if (r.t < 0) continue;
    let gone = false;
    const hit = (kind, v) => { if (r.kind === "roll" ? kind === "wall" : true) gone = true; };
    const air = flyStep(run.rooms, r, dt, hit, { roll: r.kind === "roll", height: 10 });
    if (r.kind === "roll" && !air && !gone && r.vx === 0) gone = true;
    if (r.kind === "roll" && r.ground) r.vx = Math.sign(r.vx) * Math.min(260, Math.abs(r.vx) + 30 * dt);
    for (const a of run.advs) {
      if (!targetable(a) || r.hit.includes(a.id)) continue;
      const [ax, ay] = advPos(a);
      if (Math.abs(ax - r.x) < 9 && r.y > ay - 22 && r.y < ay + 4) {
        r.hit.push(a.id);
        run.events.push({ t: "rockHit", id: a.id, x: ax, y: ay, kind: r.kind });
        deal(run, meta, a, r.dmg * (1 + 0.1 * (run.day - 1)), "physical", { kind: "spell", id: r.kind });
        if (!targetable(a)) continue;
        if (r.kind === "roll") launch(run, a, Math.sign(r.vx) * r.knock, -r.knock * 0.8);
        else { a.frozenT = Math.max(a.frozenT, r.stun); a.dazeT = Math.max(a.dazeT ?? 0, r.stun); gone = true; }
      }
    }
    if (r.t > 6 || r.y > 600) gone = true;
    if (gone) { r.dead = true; run.events.push({ t: "rockBreak", x: r.x, y: r.y, kind: r.kind }); }
  }
  run.rocks = run.rocks.filter((r) => !r.dead);
}

// ---------------------------------------------------------------- the step
/** The heart's own hand: a spike of black rock from the floor under one intruder. */
export function claw(run, meta, id) {
  ensureDeck(run);
  if (run.phase !== "wave" || run.clawCd > 0) return false;
  const a = run.advs.find((x) => x.id === id);
  if (!a || !targetable(a)) return false;
  run.clawCd = BAL.claw.cd;
  const [x, y] = advPos(a);
  run.events.push({ t: "claw", id, x, y });
  deal(run, meta, a, Math.round((BAL.claw.dmg + BAL.claw.perDay * (run.day - 1) + powerSum(meta, "pulse") * 0.5) * 10) / 10, "physical", { kind: "claw" });
  if (targetable(a)) { scare(run, meta, a, BAL.claw.fear); launch(run, a, (a.face ?? 1) * -40, -170); }
  return true;
}
export function step(run, meta, dt) {
  if (run.phase !== "wave") return;
  ensureDeck(run);
  run.t += dt;
  run.clawCd = Math.max(0, run.clawCd - dt);
  if (!run.advs.some((a) => a.fly?.held)) run.grabCd = Math.max(0, run.grabCd - dt);
  stepRocks(run, meta, dt);
  if (run.streak.t > 0) { run.streak.t -= dt; if (run.streak.t <= 0) run.streak.n = 0; }
  // a fresh card every few seconds while the fight lasts
  run.drawT += dt;
  if (run.drawT >= BAL.deck.drawEvery) { run.drawT = 0; draw(run); }
  const cb = run.combo;
  if (cb.t > 0) cb.t -= dt;

  // mana trickles in during a wave; altars make it faster
  const altar = Object.values(run.rooms).filter((rm) => rm.open && rm.type === "altar").length * (ROOMS.altar.manaRegen ?? 0);
  run.regenT += dt * (1 + altar);
  if (run.regenT >= BAL.mana.regenEvery) { run.regenT -= BAL.mana.regenEvery; run.mana = Math.min(run.manaMax, run.mana + 1); }

  // spawning
  if (run.spawnQ.length) {
    run.spawnT -= dt;
    if (run.spawnT <= 0) {
      const a = run.spawnQ.shift();
      run.advs.push(a);
      // they come in clumps: sometimes two at once, then a breath
      run.spawnT = BAL.night.spawnGap * 0.7;
      run.events.push({ t: "spawn", id: a.id, cls: a.cls, boss: a.boss, nemesis: a.nemesis, name: a.name });
    }
  }

  for (const a of run.advs) if (active(a) && !a.npc) updateAdv(run, meta, a, dt);
  for (const cd of [...run.cards]) updateCard(run, meta, cd, dt);
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
  if (a.fly) return flyAdv(run, meta, a, dt);
  const here = advCell(a), rm = roomOf(run, here), RD = ROOMS[rm?.type] ?? {};
  if (RD.burn && a.burnT <= 0) { a.burnT = 1; a.burnDps = RD.burn; }
  if (a.slowT > 0) a.slowT -= dt;
  if (a.dazeT > 0) a.dazeT -= dt;
  if (a.frozenT > 0) { a.frozenT -= dt; return; }
  if (!active(a)) return;

  // the cleric patches people up and steadies their nerves
  if (a.cls === "cleric" && a.state !== "flee") {
    a.healT -= dt;
    if (a.healT <= 0) {
      a.healT = BAL.classes.cleric.healEvery;
      const [cx, cy] = advPos(a);
      const near = run.advs.filter((o) => active(o) && o.state !== "flee" && Math.hypot(advPos(o)[0] - cx, advPos(o)[1] - cy) <= R_HEAL);
      const low = near.sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
      if (low && low.hp < low.max) {
        low.hp = Math.min(low.max, low.hp + BAL.classes.cleric.heal * (1 + 0.15 * (run.day - 1)));
        run.events.push({ t: "heal", id: low.id, x: advPos(low)[0], y: advPos(low)[1] });
      }
      for (const o of near) o.courage = Math.min(o.courageMax, o.courage + 8);
    }
  }

  const fleeing = a.state === "flee";
  if (a.next == null) {
    // standing on a waypoint: is something holding us here?
    if (fleeing && here === ENT_WP) return escape(run, meta, a);
    if (!fleeing) {
      if (a.disarmT > 0) {
        a.disarmT -= dt;
        const cd = run.cards.find((c) => c.uid === a.disarmCard);
        if (a.disarmT <= 0 && cd) { cd.disabledT = 14; run.events.push({ t: "disarmed", w: cd.w }); }
        return;
      }
      if (a.lootT > 0) {
        a.lootT -= dt;
        if (a.lootT <= 0) { a.looted = true; run.events.push({ t: "looted", id: a.id, w: here }); }
        return;
      }
      const mons = monstersNear(run, here, 16);
      if (mons.length) return fight(run, meta, a, mons);
      if (dW(here, HEART_WP) <= 30) return hitHeart(run, meta, a);
    }
    const goal = fleeing ? ENT_WP : goalOf(run, a);
    const nxt = nextToward(run, here, goal, !fleeing);
    if (nxt == null) {
      if (!fleeing && rm?.type === "treasure" && !a.looted) a.lootT = ROOMS.treasure.loot;
      return;
    }
    // a wall across the path blocks the way forward until it breaks
    if (!fleeing) {
      const wall = run.cards.find((c) => CARDS[c.id]?.blocks && c.hp > 0 && dW(c.w, nxt) < 8 && dW(c.w, nxt) < dW(c.w, here));
      if (wall) return hitWall(run, meta, a, wall);
    }
    a.next = nxt;
    a.len = Math.max(1, dW(here, nxt));
    const dx = WP[nxt].x - WP[here].x;
    if (Math.abs(dx) > 0.5) a.face = dx > 0 ? 1 : -1;
  }
  // walking: about 45 pixels a second for an ordinary pace
  const slow = Math.max(a.slowT > 0 ? a.slowK : 0, RD.slow ?? 0);
  a.prog += (dt * a.speed * 100 * (fleeing ? 1.35 : 1) * (1 - slow)) / (a.len ?? 6);
  if (a.prog >= 1) {
    a.cell = a.next; a.next = null; a.prog = 0;
    onEnter(run, meta, a);
  }
}
function goalOf(run, a) {
  if (!a.looted) {
    // greed: the nearest unlooted treasure room first
    let best = null, bd = Infinity;
    for (const z of Object.values(ZONES)) {
      const rm = run.rooms[z.id];
      if (!rm.open || rm.type !== "treasure") continue;
      const f = field(run, z.center, true)[a.cell];
      if (f < bd) { bd = f; best = z.center; }
    }
    if (best != null) return best;
  }
  return HEART_WP;
}
function onEnter(run, meta, a) {
  const w = a.cell, z = zoneOf(w), rm = run.rooms[z];
  if (z !== a.zone) { a.zone = z; run.breach[z] = (run.breach[z] ?? 0) + 1; }
  if (a.state !== "flee" && rm.type === "treasure" && !a.looted && w === ZONES[z].center) a.lootT = ROOMS.treasure.loot;
  a.trig = a.trig.filter((uid) => { const c = run.cards.find((q) => q.uid === uid); return c && dW(c.w, w) < 20; });
  for (const cd of run.cards) {
    if (cd.disabledT > 0) continue;
    const d = CARDS[cd.id], dist = dW(cd.w, w);
    // a rogue spots traps as they come up and tries to take them apart
    if (a.cls === "rogue" && a.state !== "flee" && d.kind === "trap" && dist < 24 && !a.seen.includes(cd.uid) && !ROOMS[run.rooms[zoneOf(cd.w)].type].hideTraps) {
      a.seen.push(cd.uid);
      const p = BAL.classes.rogue.disarm + (a.gear.includes("trap") ? 0.4 : 0);
      if (withRng(run, (R) => R.chance(p))) {
        a.disarmT = BAL.classes.rogue.disarmTime;
        a.disarmCard = cd.uid;
        run.events.push({ t: "disarm", id: a.id, w: cd.w });
        return;
      }
    }
    if (d.trigger === "enter" && dist <= R_TRAP && cd.cd <= 0 && a.spare !== true && !a.trig.includes(cd.uid)) {
      cd.cd = d.rearm;
      a.trig.push(cd.uid);
      run.events.push({ t: "trap", id: cd.id, w: cd.w, target: a.id });
      deal(run, meta, a, d.dmg, d.el, { kind: "card", id: cd.id, w: cd.w });
    }
  }
}
function fight(run, meta, a, mons) {
  if (a.cd > 0) return;
  a.cd = a.rate;
  const m = mons.sort((p, q) => p.hp - q.hp)[0];
  const tx = WP[m.w].x - advPos(a)[0];
  if (Math.abs(tx) > 0.5) a.face = tx > 0 ? 1 : -1;
  let dmg = a.atk * (a.gear.includes("monster") ? 1.5 : 1);
  hurtMonster(run, meta, m, dmg, a);
  run.events.push({ t: "advHit", id: a.id, mid: m.id, cls: a.cls });
}
function hitWall(run, meta, a, cd) {
  if (a.cd > 0) return;
  a.cd = a.rate;
  cd.hp -= a.atk;
  const d = CARDS[cd.id];
  if (d.thorns) deal(run, meta, a, d.thorns, "physical", { kind: "card", id: cd.id, w: cd.w });
  run.events.push({ t: "wallHit", w: cd.w, id: a.id });
  if (cd.hp <= 0) { run.cards = run.cards.filter((c) => c !== cd); bump(run); run.events.push({ t: "wallBreak", w: cd.w }); }
}
function hitHeart(run, meta, a) {
  if (a.cd > 0) return;
  a.cd = a.boss ? 2 : a.rate;
  a.face = WP[HEART_WP].x > advPos(a)[0] ? 1 : -1;
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
    for (const a of advsNear(run, m.w, 30)) scare(run, meta, a, MON.traits["겁많음"].scared);
    run.events.push({ t: "shriek", mid: m.id });
  }
  if (m.hp <= 0) {
    m.deadT = 0.01;
    run.events.push({ t: "monDeath", mid: m.id, w: m.w });
    if (has(m, "분열") && !m.split) {
      for (let i = 0; i < 2; i++) {
        const nb = WP[m.w].nb[i] ?? m.w;
        const kid = addMonster(run, { species: m.species, name: "작은 " + m.name, traits: m.traits.filter((t) => t !== "분열"), palette: m.palette, hp: Math.max(4, Math.round(m.max * 0.3)), atk: m.atk * 0.5, rate: m.rate }, nb);
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
  const rm = roomOf(run, m.w);
  if (ROOMS[rm.type].regen) m.hp = Math.min(m.max, m.hp + ROOMS[rm.type].regen * dt);
  if (has(m, "치유")) {
    m.healT -= dt;
    if (m.healT <= 0) {
      m.healT = 2;
      for (const o of monstersNear(run, m.w, 40)) o.hp = Math.min(o.max, o.hp + MON.traits["치유"].heal);
      run.events.push({ t: "fx", id: "monHeal", w: m.w });
    }
  }
  if (m.cd > 0) return;
  const targets = advsNear(run, m.w, reachOf(m));
  if (!targets.length) return;
  m.cd = m.rate;
  m.atkT = 0.25;
  const a = targets.sort((p, q) => advDist(p, m.w) - advDist(q, m.w) || p.hp - q.hp)[0];
  m.face = advPos(a)[0] > WP[m.w].x ? 1 : -1;
  const crowns = monstersNear(run, m.w, 40).filter((o) => o !== m && has(o, "왕관")).length;
  let dmg = m.atk * (m.buffT > 0 ? 2 : 1) * (1 + crowns * MON.traits["왕관"].aura);
  const el = monsterEl(m);
  run.events.push({ t: "monAtk", mid: m.id, target: a.id, el, x: advPos(a)[0], y: advPos(a)[1] });
  const done = deal(run, meta, a, dmg, el, { kind: "monster", mid: m.id, w: m.w });
  for (const t of m.traits) {
    const T = MON.traits[t];
    if (T.burn) { a.burnT = T.burn[1]; a.burnDps = Math.max(a.burnDps, T.burn[0]); }
    if (T.poison) { a.poisonT = T.poison[1]; a.poisonDps = Math.min(4, a.poisonDps + T.poison[0]); }
    if (T.slow) { a.slowT = T.slow[1]; a.slowK = Math.max(a.slowK, T.slow[0]); }
    if (T.fear) scare(run, meta, a, T.fear);
    if (T.leech) m.hp = Math.min(m.max, m.hp + done * T.leech);
  }
}

function updateCard(run, meta, cd, dt) {
  const d = CARDS[cd.id];
  if (cd.disabledT > 0) { cd.disabledT -= dt; return; }
  cd.cd -= dt;
  if (d.trigger !== "interval" || cd.cd > 0) return;
  const z = zoneOf(cd.w), RD = ROOMS[run.rooms[z].type];
  let targets = advsNear(run, cd.w, cardRadius(d));
  let mode = d.target;
  // water carries lightning to everyone in the room
  const chained = RD.chain && RD.chain === d.el && mode === "one";
  if (chained) { mode = "all"; targets = run.advs.filter((a) => targetable(a) && zoneOfAdv(a) === z); }
  if (!targets.length) { cd.cd = 0; return; }
  cd.cd = d.interval;
  const src = { kind: "card", id: cd.id, w: cd.w };
  if (mode === "one") targets = [targets.sort((p, q) => advDist(p, cd.w) - advDist(q, cd.w) || p.hp - q.hp)[0]];
  if (mode === "chain") targets = targets.sort((p, q) => advDist(p, cd.w) - advDist(q, cd.w)).slice(0, d.chain);
  run.events.push({ t: "trap", id: cd.id, w: cd.w, targets: targets.map((a) => a.id), chained, positions: targets.map(advPos) });
  if (chained && targets.length) run.events.push({ t: "synergy", w: cd.w, text: "물 + 번개! 피해 ×2" });
  for (const a of targets) {
    if (d.dmg) deal(run, meta, a, d.dmg, d.el, src);
    if (!targetable(a)) continue;
    if (d.fear) scare(run, meta, a, d.fear);
    if (d.burn) { a.burnT = d.burn[1]; a.burnDps = Math.max(a.burnDps, d.burn[0]); }
    if (d.poison) { a.poisonT = d.poison[1] * (RD.mods?.poison ?? 1); a.poisonDps = Math.min(5, a.poisonDps + d.poison[0]); }
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
  const treasure = Object.values(run.rooms).filter((rm) => rm.open && rm.type === "treasure").length * ROOMS.treasure.manaPerDay;
  run.mana = Math.min(run.manaMax, run.mana + treasure);
  for (const m of run.monsters) if (m.hp > 0) m.hp = m.max;
  for (const cd of run.cards) { cd.disabledT = 0; if (CARDS[cd.id].hp) cd.hp = Math.max(cd.hp, CARDS[cd.id].hp * 0.5); }
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
  if (sealedLeft && !Object.values(run.rooms).some((rm) => rm.type === "sealed") && R.chance(0.25)) out[R.int(out.length)] = "sealed";
  return out;
}
/** Chambers a room card could go into: an empty one, or a collapsed one next to the open cave (digging it out). */
export function roomTargets(run, type) {
  return Object.keys(ZONES).filter((z) => canPlaceRoom(run, type, z));
}
export function canPlaceRoom(run, type, zid) {
  const z = ZONES[zid], rm = run.rooms[zid];
  if (!z || z.kind !== "chamber") return false;
  if (rm.open) return rm.type === "hall";
  return zoneLinks(zid).some(({ other }) => run.rooms[other]?.open && ZONES[other].kind !== "secret");
}
export function placeRoom(run, meta, type, zid) {
  if (!canPlaceRoom(run, type, zid)) return false;
  const dug = !run.rooms[zid].open;
  run.rooms[zid] = { type, open: true };
  refreshTunnels(run);
  run.roomPicked = true;
  run.events.push({ t: "room", z: zid, type, dug });
  if (type === "sealed") openSecret(run, meta, zid, sealedRecord(meta));
  for (const cb of STORY.combos) {
    if (meta.records.includes(cb.record)) continue;
    const at = comboAt(run, cb.rooms);
    if (at) openSecret(run, meta, at, cb.record);
  }
  return true;
}
function sealedRecord(meta) {
  if (!meta.records.includes("k_mage1")) return "k_mage1";
  if (!meta.records.includes("k_abyss")) return "k_abyss";
  return null;
}
function comboAt(run, [a, b]) {
  for (const z of Object.keys(ZONES)) {
    if (!run.rooms[z].open || run.rooms[z].type !== a) continue;
    // two rooms count as neighbours when one tunnel joins them
    for (const { other } of zoneLinks(z)) if (run.rooms[other]?.open && run.rooms[other].type === b) return z;
  }
  return null;
}
function openSecret(run, meta, near, record) {
  // the wall splits and blue light leaks out: a hidden prayer room in the rock
  const hidden = Object.values(ZONES).filter((z) => z.kind === "secret" && !run.rooms[z.id].open);
  const pick = hidden.find((z) => zoneLinks(z.id).some(({ other }) => other === near)) ?? hidden[0];
  if (pick) { run.rooms[pick.id].open = true; refreshTunnels(run); }
  run.events.push({ t: "secret", z: pick?.id ?? near, record });
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
  if (Object.values(run.rooms).some((rm) => rm.open && rm.type === "library")) souls += ROOMS.library.soulBonus;
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
