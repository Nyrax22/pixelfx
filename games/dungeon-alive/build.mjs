// Bundles the game into one self-contained HTML file: dist/index.html.
//   node games/dungeon-alive/build.mjs          build once
//   node games/dungeon-alive/build.mjs --watch  rebuild on change
import { build, context } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
mkdirSync(out, { recursive: true });

const opts = {
  entryPoints: [join(here, "src/main.js")], bundle: true, format: "esm", minify: true, write: false,
  target: ["es2020", "safari15"], legalComments: "none", logLevel: "warning",
};
function emit(res) {
  const js = res.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
  const html = readFileSync(join(here, "index.html"), "utf8")
    .replace('<script type="module" src="./src/main.js"></script>', () => `<script type="module">${js}</script>`);
  writeFileSync(join(out, "index.html"), html);
  console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
}
if (process.argv.includes("--watch")) {
  const ctx = await context({ ...opts, plugins: [{ name: "emit", setup(b) { b.onEnd((r) => r.outputFiles && emit(r)); } }] });
  await ctx.watch();
} else emit(await build(opts));
