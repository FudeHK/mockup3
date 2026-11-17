// PWA アイコンを自作 SVG から生成（外部素材は使用しない）
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 未導入なら npm i -D playwright
import path from 'node:path';
const out = path.resolve('public/icons');
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${pad ? 0 : 110}" fill="#b9501f"/>
<g transform="translate(256 256) scale(${pad ? 0.72 : 1}) translate(-256 -256)">
<rect x="136" y="110" width="240" height="300" rx="28" fill="#fff8f0"/>
<rect x="176" y="170" width="160" height="22" rx="11" fill="#e8743b"/>
<rect x="176" y="225" width="120" height="22" rx="11" fill="#e8743b"/>
<rect x="176" y="280" width="140" height="22" rx="11" fill="#e8743b"/>
<circle cx="350" cy="370" r="62" fill="#4f8f60"/><path d="M322 370l20 20 38-40" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: path.join(out, name), omitBackground: true });
}
await b.close();
console.log('icons ok');
