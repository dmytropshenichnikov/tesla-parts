// Після `vite build`: вбудовуємо єдиний CSS-файл у index.html.
// Мета — прибрати render-blocking запит (Lighthouse: ~150 мс до FCP/LCP).
// Побічний плюс: сторінка з prerender-бекенду малюється одним пакетом.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const htmlPath = join(dist, 'index.html');
let html = readFileSync(htmlPath, 'utf8');

const linkRe = /<link[^>]+rel="stylesheet"[^>]*>/g;
const links = html.match(linkRe) || [];
if (!links.length) {
  console.log('inline-css: no stylesheet links, skipping');
  process.exit(0);
}

let inlined = 0;
for (const link of links) {
  const href = (link.match(/href="([^"]+)"/) || [])[1];
  if (!href || !href.startsWith('/assets/') || !href.endsWith('.css')) continue;
  const file = join(dist, href.replace(/^\//, ''));
  const css = readFileSync(file, 'utf8');
  html = html.replace(link, `<style>${css}</style>`);
  inlined += 1;
}

writeFileSync(htmlPath, html);
console.log(`inline-css: inlined ${inlined} stylesheet(s), ${(html.length / 1024).toFixed(1)} KiB html`);
