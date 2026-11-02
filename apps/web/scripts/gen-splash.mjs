import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const themeColor = '#141414';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const splashDir = join(scriptDir, '../public/splash');
const iconPath = join(scriptDir, '../public/icons/apple-touch-icon.png');

/** width x height @ devicePixelRatio */
const splashSpecs = [
  { file: 'iphone-14-pro-portrait.png', width: 393, height: 852, dpr: 3 },
  { file: 'iphone-15-pro-max-portrait.png', width: 430, height: 932, dpr: 3 },
  { file: 'iphone-14-portrait.png', width: 390, height: 844, dpr: 3 },
  { file: 'iphone-se-portrait.png', width: 375, height: 667, dpr: 2 },
];

async function splashPng(width, height, dpr) {
  const pixelWidth = width * dpr;
  const pixelHeight = height * dpr;
  const iconSize = Math.round(Math.min(pixelWidth, pixelHeight) * 0.22);
  const icon = await sharp(iconPath)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: pixelWidth,
      height: pixelHeight,
      channels: 3,
      background: themeColor,
    },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer();
}

await mkdir(splashDir, { recursive: true });

for (const spec of splashSpecs) {
  const png = await splashPng(spec.width, spec.height, spec.dpr);
  const out = join(splashDir, spec.file);
  await writeFile(out, png);
  console.log(
    `Wrote ${out} (${spec.width * spec.dpr}×${spec.height * spec.dpr})`,
  );
}
