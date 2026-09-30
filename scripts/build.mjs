// Arma el juego en un solo archivo HTML autocontenido (index.html en la raíz del repo),
// para que se pueda abrir con doble clic sin servidor. También genera dist/artifact.html,
// la misma página sin el esqueleto del documento, para publicarla como Artifact.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const minify = process.argv.includes('--min');
const SITE = (process.env.PUBLIC_URL || 'https://contracorriente.onrender.com').replace(/\/$/, '');
const appVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  minify,
  legalComments: 'none',
  charset: 'utf8',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const template = readFileSync(join(root, 'src/index.html'), 'utf8').replaceAll('__SITE__', SITE);

// Reemplazo con función: evita que los "$&" del código se interpreten como patrones
// Temas grabados (assets/music): embebidos en el archivo suelto y en el artifact;
// en el sitio publicado van como archivos aparte y se descargan solo si se usan.
const musicDir = join(root, 'assets/music');
const samples = readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
const embedded = samples.map(f => `<script id="sample-${f.replace('.mp3', '')}" type="application/octet-stream">${readFileSync(join(musicDir, f)).toString('base64')}</script>`).join('\n');
const page = template.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
const html = page.replace('<!--__SAMPLES__-->', () => embedded);
const siteHtml = page.replace('<!--__SAMPLES__-->', '');
writeFileSync(join(root, 'index.html'), html);

const artifact = html
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<\/head>\s*<body>\s*/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), artifact);

// Sitio publicable (GitHub Pages, Netlify, etc.): el juego + archivos para instalarlo como app
const site = join(root, 'dist/site');
mkdirSync(site, { recursive: true });
writeFileSync(join(site, 'index.html'), siteHtml);
mkdirSync(join(site, 'music'), { recursive: true });
for (const f of samples) copyFileSync(join(musicDir, f), join(site, 'music', f));
const version = createHash('sha1').update(siteHtml).digest('hex').slice(0, 10);
for (const f of readdirSync(join(root, 'static'))) {
  if (f === 'sw.js') writeFileSync(join(site, f), readFileSync(join(root, 'static', f), 'utf8').replace('__VERSION__', version));
  else copyFileSync(join(root, 'static', f), join(site, f));
}
// Buscadores: robots.txt y sitemap.xml con la dirección pública
writeFileSync(join(site, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'terminos', 'privacidad', 'reembolsos'].map(p => `  <url><loc>${SITE}/${p}</loc></url>`).join('\n')}\n</urlset>\n`);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`index.html ${kb(html.length)} · js ${kb(js.length)} · css ${kb(css.length)}`);
