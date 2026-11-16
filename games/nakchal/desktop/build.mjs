// Copies the web game into ./app and makes it fully offline:
// three.js from node_modules instead of the CDN, fonts from @fontsource instead of Google Fonts.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..'), out = path.join(here, 'app');
const nm = path.join(here, 'node_modules');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const cp = (a, b) => fs.cpSync(a, b, { recursive: true });

// game assets (GLB only — the .json base64 copies exist just for the web artifact)
cp(path.join(src, 'assets'), path.join(out, 'assets'));

// three.js
const three = path.join(nm, 'three');
fs.mkdirSync(path.join(out, 'vendor/three/build'), { recursive: true });
fs.copyFileSync(path.join(three, 'build/three.module.js'), path.join(out, 'vendor/three/build/three.module.js'));
for (const d of ['postprocessing', 'shaders', 'environments', 'loaders', 'libs', 'utils'])
  cp(path.join(three, 'examples/jsm', d), path.join(out, 'vendor/three/examples/jsm', d));

// fonts
const fonts = [
  ['black-han-sans', ['400']], ['jua', ['400']], ['ibm-plex-sans-kr', ['400', '500', '700']],
  ['ibm-plex-mono', ['500', '700']], ['nanum-myeongjo', ['400', '700', '800']]
];
let css = '';
for (const [pkg, ws] of fonts) {
  const dir = path.join(nm, '@fontsource', pkg);
  fs.mkdirSync(path.join(out, 'vendor/fonts', pkg, 'files'), { recursive: true });
  for (const f of fs.readdirSync(path.join(dir, 'files')))
    if (f.endsWith('.woff2') && ws.some(w => f.includes(`-${w}-normal`)))
      fs.copyFileSync(path.join(dir, 'files', f), path.join(out, 'vendor/fonts', pkg, 'files', f));
  for (const w of ws) {
    const f = path.join(dir, `${w}.css`);
    css += fs.readFileSync(f, 'utf8').replace(/url\(\.\/files\//g, `url(./${pkg}/files/`) + '\n';
  }
}
fs.writeFileSync(path.join(out, 'vendor/fonts/fonts.css'), css);

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="vendor/fonts/fonts.css">')
  .replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/build/', './vendor/three/build/')
  .replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', './vendor/three/examples/jsm/');
if (/https?:\/\/(cdn|fonts)\./.test(html)) console.warn('warning: external URL still present');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('app/ ready');
