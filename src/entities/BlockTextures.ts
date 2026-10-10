import Phaser from 'phaser';
import { TOKENS } from '../ui/Theme';
import { fillRoundedRect } from '../utils/CanvasShapes';

/** Shared immutable body textures. Geometry is drawn only on the first use of a style/size. */
export function cachedBlockBody(scene: Phaser.Scene, w: number, h: number, fill: number, obstacle: boolean): Phaser.GameObjects.Image {
  const density = 2;
  const padding = 2;
  const shadowOffset = TOKENS.shadowOffset;
  const borderPx = TOKENS.borderPx;
  const cornerR = TOKENS.cornerR;
  const pixelWidth = Math.ceil((w + shadowOffset + padding * 2) * density);
  const pixelHeight = Math.ceil((h + shadowOffset + padding * 2) * density);
  const key = `block-body-v1-${w}-${h}-${fill}-${obstacle}-${density}-${cornerR}-${shadowOffset}-${borderPx}`;
  if (!scene.textures.exists(key)) {
    // Canvas baking also works in HEADLESS replay tests without a GPU renderer.
    const texture = scene.textures.createCanvas(key, pixelWidth, pixelHeight);
    if (!texture) throw new Error(`Unable to create block texture ${key}`);
    const context = texture.context;
    context.save(); context.scale(density, density); context.translate(w / 2 + padding, h / 2 + padding);
    context.fillStyle = '#111111';
    fillRoundedRect(context, -w / 2 + shadowOffset, -h / 2 + shadowOffset, w, h, cornerR);
    fillRoundedRect(context, -w / 2, -h / 2, w, h, cornerR);
    context.fillStyle = `#${fill.toString(16).padStart(6, '0')}`;
    fillRoundedRect(context, -w / 2 + borderPx, -h / 2 + borderPx,
      w - borderPx * 2, h - borderPx * 2, Math.max(0, cornerR - borderPx / 2));

    if (obstacle) {
      context.lineWidth = 4; context.strokeStyle = 'rgba(17,17,17,0.55)';
      const inset = borderPx + 8;
      const minX = -w / 2 + inset;
      const maxX = w / 2 - inset;
      const minY = -h / 2 + inset;
      const maxY = h / 2 - inset;
      const span = Math.max(w, h);
      const step = 18;
      for (let off = -span; off <= span; off += step) {
        const x1 = minX + off;
        const y1 = minY;
        const x2 = x1 + (maxY - minY);
        const y2 = maxY;
        const cx1 = Math.max(minX, Math.min(maxX, x1));
        const cy1 = minY + (cx1 - x1);
        const cx2 = Math.max(minX, Math.min(maxX, x2));
        const cy2 = minY + (cx2 - x1);
        context.beginPath();
        context.moveTo(cx1, cy1);
        context.lineTo(cx2, cy2);
        context.stroke();
      }
    }

    context.restore(); if (scene.game.renderer) texture.refresh();
  }
  return scene.add.image(0, 0, key)
    .setOrigin((w / 2 + padding) * density / pixelWidth, (h / 2 + padding) * density / pixelHeight)
    .setDisplaySize(pixelWidth / density, pixelHeight / density)
    .setName('cached-block-body');
}
