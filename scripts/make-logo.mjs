// Generate Kinetic Puzzle logo PNG (630x500). Run: node scripts/make-logo.mjs
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outDir = resolve(__dirname, '..', 'marketing', 'logo');
const outPath = resolve(outDir, 'kinetic-puzzle.png');
mkdirSync(outDir, { recursive: true });

const W = 630;
const H = 500;

// Neo-brut palette (matches in-game TOKENS)
const C = {
  cream: '#fbf3d5',
  ink: '#111111',
  white: '#ffffff',
  mint: '#b8e5c8',
  sky: '#a8d4f0',
  yellow: '#ffd96a',
  red: '#e56b6f',
  blue: '#7fb7e8',
};

// Neo-brut tile: shadow + border + fill
function tile(x, y, w, h, fill, r = 22, shadow = 8, border = 6) {
  return `
    <rect x="${x + shadow}" y="${y + shadow}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${C.ink}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${C.ink}"/>
    <rect x="${x + border}" y="${y + border}" width="${w - border * 2}" height="${h - border * 2}" rx="${Math.max(0, r - border / 2)}" ry="${Math.max(0, r - border / 2)}" fill="${fill}"/>
  `;
}

// Block tile w/ portal arrow on right edge
function blockTile(x, y, w, h, fill, arrow = false) {
  let s = tile(x, y, w, h, fill);
  if (arrow) {
    const ax = x + w - 22;
    const ay = y + h / 2;
    s += `<polygon points="${ax - 12},${ay - 14} ${ax + 8},${ay} ${ax - 12},${ay + 14}" fill="${C.ink}"/>`;
  }
  return s;
}

// Dotted background
function dots(W, H, step = 28, r = 2) {
  let s = '';
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.ink}" opacity="0.06"/>`;
    }
  }
  return s;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .title { font-family: 'Bungee', 'Arial Black', sans-serif; font-weight: 900; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.cream}"/>
  ${dots(W, H)}

  <!-- Mini-board demo: 2x2 grid of blocks with a portal hint on the right -->
  ${(() => {
    const cellSize = 78;
    const gap = 10;
    const gridW = cellSize * 2 + gap;
    const gridH = cellSize * 2 + gap;
    const gridX = (W - gridW) / 2;
    const gridY = 56;
    let g = '';
    // Faint board frame
    const pad = 16;
    g += `<rect x="${gridX - pad}" y="${gridY - pad}" width="${gridW + pad * 2}" height="${gridH + pad * 2}" rx="22" ry="22" fill="${C.white}" stroke="${C.ink}" stroke-width="5"/>`;
    // Blocks
    g += blockTile(gridX, gridY, cellSize, cellSize, C.red, false);
    g += blockTile(gridX + cellSize + gap, gridY, cellSize, cellSize, C.yellow, true);
    g += blockTile(gridX, gridY + cellSize + gap, cellSize, cellSize, C.blue, false);
    g += blockTile(gridX + cellSize + gap, gridY + cellSize + gap, cellSize, cellSize, C.mint, true);
    return g;
  })()}

  <!-- Title -->
  <g transform="translate(${W / 2}, 320)">
    <rect x="-300" y="-50" width="600" height="100" rx="22" ry="22" fill="${C.ink}" transform="translate(7,7)"/>
    <rect x="-300" y="-50" width="600" height="100" rx="22" ry="22" fill="${C.ink}"/>
    <rect x="-294" y="-44" width="588" height="88" rx="18" ry="18" fill="${C.yellow}"/>
    <text x="0" y="14" text-anchor="middle"
          class="title"
          font-size="50"
          fill="${C.ink}"
          letter-spacing="2">KINETIC PUZZLE</text>
  </g>

  <!-- Subtitle pill -->
  <g transform="translate(${W / 2}, 415)">
    <rect x="-220" y="-28" width="440" height="56" rx="16" ry="16" fill="${C.ink}" transform="translate(5,5)"/>
    <rect x="-220" y="-28" width="440" height="56" rx="16" ry="16" fill="${C.ink}"/>
    <rect x="-215" y="-23" width="430" height="46" rx="12" ry="12" fill="${C.mint}"/>
    <text x="0" y="9" text-anchor="middle"
          class="title"
          font-size="20"
          fill="${C.ink}"
          letter-spacing="3">SLIDE · STACK · ESCAPE</text>
  </g>
</svg>
`;

const svgPath = resolve(outDir, 'kinetic-puzzle.svg');
writeFileSync(svgPath, svg, 'utf8');

await sharp(Buffer.from(svg))
  .resize(W, H, { fit: 'contain', background: C.cream })
  .png()
  .toFile(outPath);

console.log(`Wrote ${outPath} (${W}x${H})`);
