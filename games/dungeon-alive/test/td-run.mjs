import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".tdbot.mjs");
await build({ entryPoints: [join(here, "td-bot.js")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const { play, T } = await import(out + "?" + Date.now());
const N = +(process.argv[2] ?? 20), skill = +(process.argv[3] ?? 1);
let wins = 0, waves = 0, err = 0, leaks = 0, tt = 0;
const lost = {};
for (let i = 0; i < N; i++) {
  try {
    const { run, t } = play(500 + i, { skill });
    if (run.result?.win) wins++; else lost[run.wave] = (lost[run.wave] ?? 0) + 1;
    waves += run.wave; leaks += run.leaked; tt += t;
  } catch (e) { err++; console.log(e.stack); }
}
console.log(`runs ${N} skill ${skill} errors ${err} wins ${wins} avgWave ${(waves / N).toFixed(1)} avgLeak ${(leaks / N).toFixed(1)} avgTime ${(tt / N / 60).toFixed(1)}min lostAt ${JSON.stringify(lost)}`);
