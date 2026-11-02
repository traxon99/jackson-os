import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const themeColor = '#141414';
const textColor = '#f0f0f0';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(scriptDir, '../public/icons');

function monogramSvg(size, maskable) {
  const safe = maskable ? Math.round(size * 0.2) : 0;
  const fontSize = Math.round((size - safe * 2) * 0.34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${themeColor}"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="${fontSize}" font-weight="700" fill="${textColor}">JOS</text>
</svg>`;
}

async function writeIcon(fileName, size, maskable = false) {
  const png = await sharp(Buffer.from(monogramSvg(size, maskable)))
    .png()
    .toBuffer();
  await writeFile(join(iconsDir, fileName), png);
}

await mkdir(iconsDir, { recursive: true });
await writeIcon('icon-192.png', 192);
await writeIcon('icon-512.png', 512);
await writeIcon('icon-512-maskable.png', 512, true);
await writeIcon('apple-touch-icon.png', 180);

console.log(`Wrote PWA icons to ${iconsDir}`);
