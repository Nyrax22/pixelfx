import * as S from "../src/sim.js";
import { playRun } from "./bot.js";
for (const seed of [1,2,3]) {
  const meta = S.newMeta(); meta.seenPrologue = true;
  const R = S.makeRng(seed);
  const run = S.newRun(meta, seed);
  let leaks = 0, log = [];
  const orig = run.events;
  let guard = 0;
  while (run.phase !== "end" && guard++ < 200000) {
    if (run.phase === "night_pick") { S.choosePick(run, meta, 0); 
      for (let i = run.hand.length-1;i>=0;i--){const c=run.hand[i];const tg=S.cardTargets(run,c); if(tg&&tg.length&&S.cardCost(run,c)<=run.mana){const p=tg.find(([c,r])=>r===2)||tg[0]; S.playCard(run,meta,i,p[0],p[1]);}}
    }
    else if (run.phase === "wave") S.step(run, meta, 1/30);
    else if (run.phase === "dawn") { log.push(`dawn d${run.day} heart ${run.heart.hp}/${run.heart.max} kills ${run.kills} spared ${run.spared} mana ${run.mana.toFixed(1)} mons ${run.monsters.filter(m=>m.hp>0).length} hand ${run.hand.length}`); S.startDay(run, meta); }
    else if (run.phase === "day") { while (S.canBreed(run)) { const ms = run.monsters.filter(m=>m.hp>0); S.breed(run, meta, ms[0].id, ms[1].id);} const type=run.roomOffer[0]; const tg=S.roomTargets(run,type); const p=tg.find(([c,r])=>r===2)||tg[0]; S.placeRoom(run,meta,type,p[0],p[1]); S.startNight(run, meta); }
    for (const e of run.events) { if (e.t==="heartHit") leaks++; if (e.t==="flee") log.push(`  flee ${e.cls}`); if (e.t==="escape") log.push(`  escape ${e.name} looter ${e.looter}`); if (e.t==="death") log.push(`  death ${e.cls}`); if (e.t==="wave") log.push(` wave ${e.n}/${e.of} ${e.party}`);}
    run.events.length = 0;
  }
  console.log("seed", seed, "result", JSON.stringify(run.result), "heartHits", leaks, "heart", run.heart.hp);
  console.log(log.join("\n"));
}
