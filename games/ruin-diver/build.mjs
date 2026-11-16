// Bundles the game into one self-contained HTML file: dist/index.html.
// node games/ruin-diver/build.mjs [--watch]
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
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
let html = readFileSync(join(here, "index.html"), "utf8").replace("<!--GAME-->", () => `<script>${js}</script>`);

// the pixel font, cut down to the characters the game actually uses (fonttools), or whole if that's unavailable
const fontSrc = join(here, "fonts/Galmuri11-Bold.woff2");
let font = readFileSync(fontSrc);
try {
  const chars = new Set(readFileSync(join(here, "index.html"), "utf8") + readdirSync(join(here, "src")).map((f) => readFileSync(join(here, "src", f), "utf8")).join(""));
  for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
  for (const c of "★☆×…·→↑↓←⬆∞%") chars.add(c);
  const tmp = mkdtempSync(join(tmpdir(), "rd-font-")), txt = join(tmp, "chars.txt"), outFont = join(tmp, "font.woff2");
  writeFileSync(txt, [...chars].filter((c) => c.codePointAt(0) >= 32).join(""));
  execFileSync("python3", ["-m", "fontTools.subset", fontSrc, `--text-file=${txt}`, "--flavor=woff2", `--output-file=${outFont}`, "--layout-features=*"], { stdio: "ignore" });
  font = readFileSync(outFont);
} catch {
  console.log("fonttools not available: embedding the whole font");
}
html = html.replace("/*FONT*/", `@font-face { font-family: "Galmuri"; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); font-display: block; }`);
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist/index.html"), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} KB`);

// the same game without the document skeleton, for hosts that add their own (a claude.ai artifact)
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, "");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(join(here, "dist/embed.html"), head.trim() + "\n" + body.trim() + "\n");
