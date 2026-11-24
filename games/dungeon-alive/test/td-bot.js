// A rough player for the defense: builds on free spots in order, upgrades when rich, throws people.
import * as T from "../src/td.js";
export { T };
const ORDER = ["arrow", "spike", "nest", "flame", "arrow", "tesla", "spike", "flame", "arrow", "tesla"];
export function play(seed, { skill = 1 } = {}) {
  const run = T.newRun(seed);
  let t = 0, guard = 0;
  const dt = 1 / 30;
  while (run.phase !== "end" && t < 3600) {
    guard++;
    if (run.phase === "relic") { T.chooseRelic(run, guard % 3); continue; }
    if (run.phase === "build") { botBuild(run); T.callWave(run); continue; }
    T.step(run, dt); t += dt;
    run.events.length = 0;
    if (guard % 20 === 0) botBuild(run);
    if (skill > 0 && guard % 40 === 0 && run.cd.grab <= 0) {
      const a = run.advs.find((x) => !x.dead && !x.out && !x.fly && x.scale <= 1);
      if (a && T.grab(run, a.id).ok) { const [x, y] = T.advPos(a); T.holdAt(run, x, y - 24); T.fling(run, (seed + guard) % 2 ? 420 : -420, -160); }
    }
    if (skill > 0 && run.cd.rockfall <= 0 && guard % 15 === 0) { const a = run.advs.filter((x) => !x.dead && !x.out && !x.fly)[3]; if (a) T.cast(run, "rockfall", ...T.advPos(a)); }
    if (skill > 0 && run.cd.roll <= 0 && guard % 15 === 0) { const a = run.advs.filter((x) => !x.dead && !x.out && !x.fly)[5]; if (a) T.cast(run, "roll", ...T.advPos(a)); }
  }
  return { run, t };
}
function botBuild(run) {
  for (let s = 0; s < T.SPOTS.length; s++) {
    if (!T.towerAt(run, s)) { const id = ORDER[s % ORDER.length]; if (run.blood >= T.costOf(run, id, 1)) T.build(run, s, id); return; }
  }
  const t = run.cards.filter((c) => c.lvl < 3).sort((p, q) => p.lvl - q.lvl)[0];
  if (t && run.blood >= T.costOf(run, t.id, t.lvl + 1)) T.upgrade(run, t.spot);
}
