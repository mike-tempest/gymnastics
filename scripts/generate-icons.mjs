import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'apps', 'web', 'public');
const svgPath = join(publicDir, 'favicon.svg');

const svgBuffer = readFileSync(svgPath);

const icons = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const icon of icons) {
  await sharp(svgBuffer).resize(icon.size, icon.size).png().toFile(join(publicDir, icon.name));

  console.log(`Generated ${icon.name} (${icon.size}x${icon.size})`);
}

// ICO supports PNG image data. Keep its 32px entry in sync with the SVG.
const png = readFileSync(join(publicDir, 'favicon-32x32.png'));
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader[6] = 32;
icoHeader[7] = 32;
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(png.length, 14);
icoHeader.writeUInt32LE(22, 18);
writeFileSync(join(publicDir, 'favicon.ico'), Buffer.concat([icoHeader, png]));

const marketingDir = join(__dirname, '..', 'marketing-site', 'public-tumblebase');
writeFileSync(join(marketingDir, 'favicon.svg'), svgBuffer);
writeFileSync(
  join(marketingDir, 'apple-touch-icon.png'),
  readFileSync(join(publicDir, 'apple-touch-icon.png'))
);

console.log('All icons generated successfully.');
