// A bot that plays whole runs with no screen: picks cards, places them, breeds, drafts rooms.
// Run with `node games/dungeon-alive/test/run.mjs`. It checks the rules never throw or stall,
// and prints how long nights take and how often runs are won, to keep the curve honest.

import * as S from "../src/sim.js";

function onRoad(run, w) {
  // a waypoint on the shortest way from the gate to the heart
  const fh = S.field(run, S.HEART_WP, false), fe = S.field(run, S.ENT_WP, false);
  return fh[w] + fe[w] <= fh[S.ENT_WP] + 1;
}
function botPlace(run, meta, R) {
  // play whatever is affordable, aiming traps at the main road
  for (let i = run.hand.length - 1; i >= 0; i--) {
    const card = run.hand[i];
    if (S.cardCost(run, card) > run.mana) continue;
    const d = S.cardDef(card);
    if (d.kind === "spell") {
      const busy = run.advs.filter((a) => !a.dead && !a.out);
      if (busy.length < 2) continue;
      S.playCard(run, meta, i, S.advCell(busy[0]));
      continue;
    }
    const tg = S.cardTargets(run, card);
    if (tg === null) { if (run.heart.hp < run.heart.max * 0.6) S.playCard(run, meta, i, null); continue; }
    if (!tg.length) continue;
    // prefer water for lightning, otherwise the road
    const road = tg.filter((w) => onRoad(run, w));
    const pref = tg.find((w) => d.el === "lightning" && S.roomOf(run, w).type === "water") ?? (road.length ? R.pick(road) : R.pick(tg));
    S.playCard(run, meta, i, pref);
  }
}

export function playRun(meta, seed, opts = {}) {
  const R = S.makeRng(seed * 7 + 3);
  const run = S.newRun(meta, seed);
  const dt = 1 / 30;
  let guard = 0, nightTime = 0;
  const nights = [];
  while (run.phase !== "end") {
    if (++guard > 400000) throw new Error("run stalled in phase " + run.phase + " day " + run.day);
    if (run.phase === "night_pick") {
      const o = run.pick.options;
      const best = o.findIndex((id) => ["trap", "facility"].includes(S.CARDS[id].kind));
      S.choosePick(run, meta, best >= 0 && R.chance(0.7) ? best : R.int(o.length));
      botPlace(run, meta, R);
    } else if (run.phase === "wave") {
      S.step(run, meta, dt);
      if (run.rage >= run.rageNeed && run.advs.filter((a) => !a.dead && !a.out).length >= 4) S.roar(run, meta);
      nightTime += dt;
      if (guard % 15 === 0) botPlace(run, meta, R);
      for (const id of [...run.mercy]) if (R.chance(0.02)) S.decideMercy(run, meta, id, R.chance(0.6));
      if (run.phase !== "wave" && run.phase !== "night_pick") { nights.push(nightTime); nightTime = 0; }
    } else if (run.phase === "dawn") {
      S.startDay(run, meta);
    } else if (run.phase === "day") {
      while (S.canBreed(run)) {
        const ms = run.monsters.filter((m) => m.hp > 0);
        S.breed(run, meta, ms[0].id, ms[1].id);
      }
      const type = run.roomOffer.find((t) => t === "water" || t === "lava" || t === "web") ?? R.pick(run.roomOffer);
      const tg = S.roomTargets(run, type);
      if (tg.length) S.placeRoom(run, meta, type, R.pick(tg));
      botPlace(run, meta, R);
      S.startNight(run, meta);
    }
    run.events.length = 0;
  }
  return { run, nights };
}
export { S };
