// Pacing model: real caves from makeCave and a modeled explorer (descend, detour for loot, dig ore, take hits,
// fight bosses, head home), buying the cheapest upgrade after each run. An estimate for tuning, not the game itself.
// node games/ruin-diver/tools/pacing.mjs [skill 0..1] [minutes] [v]
const R = new URL('../src/', import.meta.url).href;
const C = await import(R + 'cave.js'); const L = await import(R + 'logic.js'); const D = await import(R + 'data.js');
const SKILL = Number(process.argv[2] ?? 0.6), MIN = Number(process.argv[3] ?? 60), VERBOSE = process.argv[4] === 'v';
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const save = L.defaultSave(); let time = 0, runs = 0; const log = [];
const DOWN = 0.7, UP = 0.6, OVERHEAD = 8; // seconds per meter going down (exploring) and up; menu time per run
const HIT = { bat: 0.3, slime: 0.18, skull: 0.45 };
while (time < MIN * 60) {
  const first = save.runs === 0, st = L.stats(save);
  const cave = C.makeCave((runs + 1) * 7919, save, first);
  // pick a start: the deepest unlocked shortcut, unless the village still has things to find
  const vill = L.zonePercent(save, 'village'), mine = L.zonePercent(save, 'mine');
  let start = D.STARTS[0];
  for (const s of D.STARTS) if (s.boss && (save.bossKills[s.boss] ?? 0) > 0 && (s.id === 'mine' ? vill > 0.6 : mine > 0.5) && rnd() < 0.75) start = s;
  let t = 0, hp = st.hearts, bag = [], coins = 0, depth = start.depth || 9, died = false, seen = {}, kills = [];
  if (start.boss) cave.winches.push({ x: 26, y: start.depth });
  const lantern = first ? 999 : st.lantern;
  if (first) { bag = cave.items.map(i => ({ id: i.id, variant: false })); t = 15; }
  else {
    const exitAbove = (d) => { let best = d; for (const w of cave.winches) if (w.y <= d) best = Math.min(best, d - w.y); return best; };
    const byDepth = new Map(); for (const it of cave.items) { const k = it.ty; (byDepth.get(k) ?? byDepth.set(k, []).get(k)).push(it); }
    const enemies = cave.enemies.map(e => ({ ...e, d: cave.dist[e.ty * D.MW + e.tx] }));
    const bosses = cave.arenas.map(a => ({ ...a, hp: a.hp + Math.min(3, save.bossKills[a.id] ?? 0) })).filter(b => b.top > depth);
    while (!died) {
      const ret = exitAbove(depth) * UP + 8;
      if (t + ret >= lantern) break;
      if (hp <= 1 && st.hearts > 2) break; // hurt: get out with what you have
      // one more meter down
      t += DOWN; depth++;
      if (depth >= D.SEAL_DEPTH - 3) break;
      // a boss blocks the way
      const boss = bosses.find(b => depth === b.top + 5);
      if (boss) {
        if (rnd() < 0.15 + (1 - SKILL) * 0.2 && save.runs < 12) break; // timid early on
        const per = boss.id === 'golem' ? 0.65 : 0.45; // hearts lost per hit landed
        const dmg = Math.round(boss.hp * per * (1.4 - SKILL) + rnd());
        if (hp <= Math.round(boss.hp * per * (1.4 - SKILL)) && rnd() < 0.7) break; // not enough hearts: head home
        hp -= dmg; t += 6 * boss.hp;
        if (hp <= 0) { died = true; break; }
        kills.push(boss.id);
        coins += boss.coins;
        if (bag.length < st.bag) bag.push({ id: boss.trophy, variant: false });
      }
      // things near this depth
      for (const it of byDepth.get(depth) ?? []) {
        const dd = cave.dist[it.ty * D.MW + it.tx], far = dd < 0 ? 10 : dd;
        seen[it.id] ??= depth;
        const budget = lantern - t - exitAbove(depth) * UP - 8;
        const cost = far * 0.5 + 1 + (dd < 0 ? 4 / st.pick : 0);
        if (far > 4 + SKILL * 14 || cost > budget * 0.25 || (dd < 0 && st.pick < 1.4 && rnd() < 0.5)) continue;
        t += cost;
        const r = D.RARITY[D.ITEM[it.id].rarity].order;
        if (bag.length < st.bag) bag.push({ id: it.id, variant: it.variant });
        else { let w = 0; bag.forEach((b, i) => { if (D.RARITY[D.ITEM[b.id].rarity].order < D.RARITY[D.ITEM[bag[w].id].rarity].order) w = i; }); if (D.RARITY[D.ITEM[bag[w].id].rarity].order < r) bag[w] = { id: it.id, variant: it.variant }; }
      }
      // ore and coins along the way
      const z = L.zoneAt(depth);
      if (rnd() < (z.id === 'mine' ? 0.35 : 0.28)) { const gem = z.id === 'mine' && st.pick >= D.STONE_PICK && rnd() < 0.4; coins += (gem ? 6 * 2 : 4) * z.coinValue; t += (gem ? 0.9 : 0.45) / st.pick + 0.3; }
      if (rnd() < 0.18) coins += z.coinValue;
      for (const e of enemies) if (e.ty === depth && e.d >= 0 && e.d < 6) {
        const k = 1 + depth / D.DEPTH_SCALE;
        if (rnd() < (HIT[e.kind] ?? 0.2) * k * (1.3 - SKILL)) hp -= 1;
        if (rnd() < 0.5) coins += (e.kind === 'skull' || e.red ? 3 : 2) * z.coinValue;
      }
      if (z.stalactites && rnd() < z.stalactites * 3 * (1.2 - SKILL)) hp -= 1;
      if (rnd() < (z.hearts ?? 0) / 100 * 0.8 * (0.5 + SKILL * 0.5)) hp = Math.min(st.hearts, hp + 1);
      if (rnd() < 0.006 * (1.3 - SKILL)) hp -= 1; // a bad fall
      if (hp <= 0) died = true;
    }
    if (!died) t += exitAbove(depth) * UP;
    else t += 2;
  }
  for (const id of kills) save.bossKills[id] = (save.bossKills[id] ?? 0) + 1;
  const res = L.applyRun(save, { bag: died ? [] : bag, dropped: died ? bag : [], seen, coins: died ? Math.floor(coins / 2) : coins, depth });
  runs++; time += t + OVERHEAD;
  const bought = [];
  for (;;) {
    const c = D.UPGRADES.map(u => [u, L.upgradeState(save, u)]).filter(([, s]) => s.affordable).sort((a, b) => a[1].cost - b[1].cost)[0];
    if (!c) break; L.buyUpgrade(save, c[0].id); bought.push(c[0].id + save.up[c[0].id]);
  }
  log.push({ start: start.id, t: time, runs, rt: t, depth, died, total: res.total, bought, book: Math.round(L.bookPercent(save) * 100), kills: kills.join(',') });
}
let last = 0; const gaps = []; let firstBoss = null, secondBoss = null, deaths = 0;
for (const l of log) {
  if (l.bought.length) { gaps.push(l.t - last); last = l.t; }
  if (l.died) deaths++;
  if (!firstBoss && l.kills.includes('slime_king')) firstBoss = l.t;
  if (!secondBoss && l.kills.includes('golem')) secondBoss = l.t;
  if (VERBOSE || l.bought.length || l.kills) console.log(`${(l.t / 60).toFixed(1).padStart(5)}m #${String(l.runs).padStart(3)} ${l.rt.toFixed(0).padStart(3)}s ${String(l.depth).padStart(3)}m ${l.died ? 'DIED' : '    '} ${l.start.padEnd(4)} +${String(l.total).padStart(4)} book ${l.book}% ${l.bought.join(',')} ${l.kills ? '[' + l.kills + ']' : ''}`);
}
const avg = a => (a.reduce((x, y) => x + y, 0) / (a.length || 1)).toFixed(0);
const g10 = []; let acc = 0; for (const g of gaps) { acc += g; if (acc > 600) break; g10.push(g); }
console.log(`runs ${runs}, deaths ${deaths} (${Math.round(deaths / runs * 100)}%), upgrade gap avg ${avg(gaps)}s, first 10 min ${avg(g10)}s, max ${Math.max(...gaps).toFixed(0)}s`);
console.log(`boss 1 at ${firstBoss ? (firstBoss / 60).toFixed(1) + 'm' : '-'}, boss 2 at ${secondBoss ? (secondBoss / 60).toFixed(1) + 'm' : '-'}, final up ${JSON.stringify(save.up)} best ${save.best} book ${Math.round(L.bookPercent(save) * 100)}%`);
