import * as S from "../src/sim.js";
const meta = S.newMeta(); meta.runs = 3;
const run = S.newRun(meta, 42);
S.choosePick(run, meta, 0);
let t = 0, ev = {};
while (run.phase === "wave" && t < 200) {
  S.step(run, meta, 1 / 30); t += 1 / 30;
  for (const e of run.events) ev[e.t] = (ev[e.t] ?? 0) + 1;
  run.events.length = 0;
  const a = run.advs.find((x) => !x.dead && !x.out && !x.fly);
  if (a && run.grabCd <= 0 && Math.round(t * 30) % 20 === 0) {
    const [x, y] = S.advPos(a);
    S.grab(run, meta, a.id); S.holdAt(run, x, y - 15);
    S.fling(run, meta, 500, -150);
    const hp0 = a.hp; let n = 0;
    while (a.fly && n < 300) { S.step(run, meta, 1 / 60); n++; for (const e of run.events) { ev[e.t] = (ev[e.t] ?? 0) + 1; if (e.t === "slam") console.log("  slam", e.kind, Math.round(e.v)); } run.events.length = 0; }
    console.log(a.cls, "from", x.toFixed(0), y.toFixed(0), "->", S.advPos(a).map((v) => v.toFixed(0)).join(","), "hp", hp0.toFixed(1), "->", a.hp.toFixed(1), "frames", n, a.dead ? "DEAD" : "");
  }
}
console.log(run.phase, t.toFixed(0), JSON.stringify(ev));
