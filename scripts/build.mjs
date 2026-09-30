// Arma el juego en un solo archivo HTML autocontenido (index.html en la raíz del repo),
// para que se pueda abrir con doble clic sin servidor. También genera dist/artifact.html,
// la misma página sin el esqueleto del documento, para publicarla como Artifact.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const minify = process.argv.includes('--min');

const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  minify,
  legalComments: 'none',
  charset: 'utf8',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const template = readFileSync(join(root, 'src/index.html'), 'utf8');

// Reemplazo con función: evita que los "$&" del código se interpreten como patrones
const html = template.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
writeFileSync(join(root, 'index.html'), html);

const artifact = html
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<\/head>\s*<body>\s*/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), artifact);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`index.html ${kb(html.length)} · js ${kb(js.length)} · css ${kb(css.length)}`);
