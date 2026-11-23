// Bundles the bot with esbuild (the rules import JSON) and plays a few hundred runs.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".bot.mjs");
await build({
  entryPoints: [join(here, "bot.js")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error",
});
const { playRun, S } = await import(out + "?" + Date.now());

const RUNS = +(process.argv[2] ?? 120);
let wins = 0, total = 0, nightSum = 0, nightN = 0, days = 0, err = 0;
const meta = { v: 1, souls: 0, powers: [], seenPrologue: true, runs: 0, wins: 0, records: [], diaries: [], lineage: [], favorite: null, sparedTotal: 0, killedTotal: 0, bestDay: 0, bossKills: 0, breeds: 0, named: false };
const firstRuns = [], byPow = {};
for (let i = 0; i < RUNS; i++) {
  try {
    const m = i % 10 === 0 ? JSON.parse(JSON.stringify({ ...meta, runs: 0 })) : meta;
    const { run, nights } = playRun(m, 1000 + i);
    if (i % 10 === 0) firstRuns.push(run.result.win);
    total++;
    if (run.result.win) wins++;
    days += run.result.days;
    if (m === meta) { const k = Math.floor(meta.powers.length / 5) * 5; (byPow[k] ??= []).push(run.result.days + (run.result.win ? 0.5 : 0)); }
    for (const n of nights) { nightSum += n; nightN++; }
    // spend souls like a player would
    let p;
    while (m === meta && (p = S.nextPower(meta)) && meta.souls >= p.cost) S.buyPower(meta, p.id);
  } catch (e) {
    err++;
    console.error("run", i, e.stack);
    if (err > 3) break;
  }
}
console.log(`runs ${total}  errors ${err}  wins ${wins} (${((wins / total) * 100).toFixed(0)}%)  first-run wins ${firstRuns.filter(Boolean).length}/${firstRuns.length}`);
console.log(`avg night ${(nightSum / nightN).toFixed(1)}s game time  avg days survived ${(days / total).toFixed(2)}  powers ${meta.powers.length}  souls ${meta.souls}`);
for (const [k, v] of Object.entries(byPow)) console.log(`  powers ${k}+: ${v.length} runs, avg days ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}, wins ${v.filter((x) => x % 1).length}`);
process.exit(err ? 1 : 0);
