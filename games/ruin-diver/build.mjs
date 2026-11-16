// Bundles the game into one self-contained HTML file: dist/index.html.
// node games/ruin-diver/build.mjs [--watch]
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, "src/main.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  legalComments: "none",
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync(join(here, "index.html"), "utf8").replace("<!--GAME-->", () => `<script>${js}</script>`);
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist/index.html"), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} KB`);
