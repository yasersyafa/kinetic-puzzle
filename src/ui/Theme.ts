import Phaser from 'phaser';
import { paletteUI } from '../config/Palettes';

export const TOKENS = {
  cream: 0xfbf3d5,
  creamHex: '#fbf3d5',
  ink: 0x111111,
  inkHex: '#111111',
  white: 0xffffff,
  whiteHex: '#ffffff',
  mint: 0xb8e5c8,
  mintHover: 0xa3dab9,
  sky: 0xa8d4f0,
  skyHover: 0x90c4e8,
  yellow: 0xffd96a,
  yellowHover: 0xf2c850,
  lockGray: 0xd9d9d9,
  obstacleGray: 0x4a4a4a,
  red: 0xe56b6f,
  redHover: 0xd45b5f,
  blue: 0x7fb7e8,
  blueHover: 0x6da6d8,
  danger: 0xf28b82,
  shadowOffset: 6,
  borderPx: 6,
  cornerR: 18,
  pillCornerR: 32,
  exitGlow: 0xff8a5b,
  exitGlowAccent: 0xffd96a,
};

export const FONT_NEO = '"Bungee", "Arial Black", "Helvetica Neue", sans-serif';
export const FONT_BODY_NEO = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

export interface NeoTileOpts {
  cornerR?: number;
  shadowOffset?: number;
  borderPx?: number;
  shadowColor?: number;
  borderColor?: number;
}

export function neoTextStyle(
  size: number,
  colorHex: string = TOKENS.inkHex,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_BODY_NEO,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color: colorHex,
  };
}

export function neoHeaderStyle(
  size: number,
  colorHex: string = TOKENS.inkHex,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_NEO,
    fontSize: `${size}px`,
    color: colorHex,
  };
}

function drawNeoRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  opts: NeoTileOpts = {},
): void {
  const cornerR = opts.cornerR ?? TOKENS.cornerR;
  const shadowOffset = opts.shadowOffset ?? TOKENS.shadowOffset;
  const borderPx = opts.borderPx ?? TOKENS.borderPx;
  const shadowColor = opts.shadowColor ?? TOKENS.ink;
  const borderColor = opts.borderColor ?? TOKENS.ink;

  g.clear();
  g.fillStyle(shadowColor, 1);
  g.fillRoundedRect(-w / 2 + shadowOffset, -h / 2 + shadowOffset, w, h, cornerR);
  g.fillStyle(borderColor, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, cornerR);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(
    -w / 2 + borderPx,
    -h / 2 + borderPx,
    w - borderPx * 2,
    h - borderPx * 2,
    Math.max(0, cornerR - borderPx / 2),
  );
}

export function neoTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  opts: NeoTileOpts = {},
): { container: Phaser.GameObjects.Container; redraw: (newFill: number) => void } {
  const g = scene.add.graphics();
  drawNeoRect(g, 0, 0, w, h, fill, opts);
  const container = scene.add.container(x, y, [g]);
  container.setSize(w, h);
  return {
    container,
    redraw: (newFill: number) => drawNeoRect(g, 0, 0, w, h, newFill, opts),
  };
}

export interface NeoButtonHandle {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
  setFill: (fill: number) => void;
  setEnabled: (enabled: boolean) => void;
}

export function neoButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  fill: number,
  onClick: () => void,
  opts: { textSize?: number; textColor?: string; hoverFill?: number } = {},
): NeoButtonHandle {
  const textSize = opts.textSize ?? 40;
  const textColor = opts.textColor ?? TOKENS.inkHex;
  const hoverFill = opts.hoverFill ?? darken(fill, 0.08);

  let currentFill = fill;
  const g = scene.add.graphics();
  drawNeoRect(g, 0, 0, w, h, currentFill);
  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_BODY_NEO,
      fontSize: `${textSize}px`,
      fontStyle: 'bold',
      color: textColor,
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [g, txt]);
  container.setSize(w, h);
  
  const shadow = TOKENS.shadowOffset;
  // Container.displayOriginX/Y = w/2, h/2 — Phaser shifts hit-test by +displayOrigin,
  // so the rect uses (0,0) origin (not -w/2,-h/2) to land centered on the container.
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, w + shadow, h + shadow),
    Phaser.Geom.Rectangle.Contains,
  );
  if (container.input) {
    container.input.cursor = 'pointer';
  }

  let pressed = false;
  let enabled = true;

  const redraw = (f: number) => drawNeoRect(g, 0, 0, w, h, f);

  let hoverTween: Phaser.Tweens.Tween | null = null;
  const animScale = (target: number, dur: number) => {
    if (hoverTween) hoverTween.stop();
    hoverTween = scene.tweens.add({
      targets: container,
      scale: target,
      duration: dur,
      ease: 'Back.easeOut',
    });
  };

  container.on('pointerover', () => {
    if (!enabled) return;
    redraw(hoverFill);
    animScale(1.06, 140);
  });
  container.on('pointerout', () => {
    if (!enabled) return;
    redraw(currentFill);
    animScale(1, 140);
    if (pressed) {
      pressed = false;
      g.x = 0;
      g.y = 0;
      txt.x = 0;
      txt.y = 0;
    }
  });
  container.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    g.x = 4;
    g.y = 4;
    txt.x = 4;
    txt.y = 4;
    animScale(0.98, 80);
  });
  container.on('pointerup', () => {
    if (!enabled) return;
    if (pressed) {
      pressed = false;
      g.x = 0;
      g.y = 0;
      txt.x = 0;
      txt.y = 0;
      animScale(1.06, 120);
      onClick();
    }
  });

  return {
    container,
    setLabel: (t) => txt.setText(t),
    setFill: (f) => {
      currentFill = f;
      redraw(f);
    },
    setEnabled: (v) => {
      enabled = v;
      container.setAlpha(v ? 1 : 0.5);
    },
  };
}

export function neoPill(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { w?: number; h?: number; fill?: number; textColor?: string; textSize?: number } = {},
): NeoButtonHandle {
  return neoButton(
    scene,
    x,
    y,
    opts.w ?? 116,
    opts.h ?? 100,
    label,
    opts.fill ?? TOKENS.white,
    onClick,
    {
      textSize: opts.textSize ?? 44,
      textColor: opts.textColor ?? TOKENS.inkHex,
    },
  );
}

export function dottedBackground(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const ui = paletteUI();
  scene.cameras.main.setBackgroundColor(ui.bgHex);
  const g = scene.add.graphics();
  g.fillStyle(TOKENS.ink, 0.18);
  const spacing = 40;
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      g.fillCircle(x, y, 2.2);
    }
  }
  g.setDepth(-100);
}

export function drawLockIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number = 50,
  color: number = 0x9a9a9a,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  const bodyW = size;
  const bodyH = size * 0.78;
  g.fillRoundedRect(x - bodyW / 2, y - bodyH / 2 + 8, bodyW, bodyH, 8);
  g.lineStyle(Math.max(3, size * 0.13), color, 1);
  g.beginPath();
  const r = size * 0.32;
  const cy = y - bodyH / 2 + 8;
  g.arc(x, cy, r, Math.PI, 0, false);
  g.strokePath();
  return g;
}

export function drawChevronIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
  color: number = TOKENS.ink,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  const half = size / 2;
  let p1x = 0;
  let p1y = 0;
  let p2x = 0;
  let p2y = 0;
  let p3x = 0;
  let p3y = 0;
  if (direction === 'RIGHT') {
    p1x = x - half; p1y = y - half;
    p2x = x - half; p2y = y + half;
    p3x = x + half; p3y = y;
  } else if (direction === 'LEFT') {
    p1x = x + half; p1y = y - half;
    p2x = x + half; p2y = y + half;
    p3x = x - half; p3y = y;
  } else if (direction === 'UP') {
    p1x = x - half; p1y = y + half;
    p2x = x + half; p2y = y + half;
    p3x = x; p3y = y - half;
  } else {
    p1x = x - half; p1y = y - half;
    p2x = x + half; p2y = y - half;
    p3x = x; p3y = y + half;
  }
  g.fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
  return g;
}

export function popIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & { setScale: (s: number) => unknown; scale?: number },
  delay = 0,
): void {
  (target as unknown as { setScale: (s: number) => unknown }).setScale(0);
  scene.tweens.add({
    targets: target,
    scale: 1,
    duration: 380,
    delay,
    ease: 'Back.easeOut',
  });
}

export function slideUpIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  delay = 0,
  fromOffset = 72,
): void {
  const baseY = target.y;
  target.y = baseY + fromOffset;
  target.setAlpha(0);
  scene.tweens.add({
    targets: target,
    y: baseY,
    alpha: 1,
    duration: 360,
    delay,
    ease: 'Back.easeOut',
  });
}

export interface DecorBlock {
  container: Phaser.GameObjects.Container;
}

export function floatingDecor(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  fill: number,
  opts: {
    rotateDeg?: number;
    bobDur?: number;
    bobAmt?: number;
    rotateRange?: number;
    icon?: 'chevron' | 'chain' | 'cross';
    iconDir?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  } = {},
): DecorBlock {
  const tile = neoTile(scene, x, y, size, size, fill);
  const initialAngle = opts.rotateDeg ?? (Math.random() - 0.5) * 14;
  tile.container.setAngle(initialAngle);

  if (opts.icon === 'chevron') {
    const dir = opts.iconDir ?? 'RIGHT';
    const chev = drawChevronIcon(scene, 0, 0, size * 0.32, dir, TOKENS.ink);
    tile.container.add(chev);
  } else if (opts.icon === 'chain') {
    const g = scene.add.graphics();
    const r = size * 0.12;
    const sep = r * 1.6;
    g.lineStyle(Math.max(4.5, r * 0.4), TOKENS.ink, 1);
    g.strokeCircle(-sep, 0, r);
    g.strokeCircle(sep, 0, r);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRect(-sep + r * 0.6, -r * 0.32, sep * 2 - r * 1.2, r * 0.6);
    tile.container.add(g);
  } else if (opts.icon === 'cross') {
    const g = scene.add.graphics();
    g.lineStyle(6, TOKENS.ink, 0.6);
    const m = size * 0.28;
    g.beginPath();
    g.moveTo(-m, -m); g.lineTo(m, m);
    g.moveTo(-m, m);  g.lineTo(m, -m);
    g.strokePath();
    tile.container.add(g);
  }

  const bobAmt = opts.bobAmt ?? 11;
  const bobDur = opts.bobDur ?? 1800 + Math.random() * 800;
  const rotRange = opts.rotateRange ?? 5;

  scene.tweens.add({
    targets: tile.container,
    y: y + bobAmt,
    duration: bobDur,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: tile.container,
    angle: initialAngle + rotRange,
    duration: bobDur * 1.2,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return tile;
}

export function idlePulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  scale = 1.06,
  duration = 1100,
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    scale,
    duration,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function darken(color: number, amt: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amt));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amt));
  const b = Math.max(0, (color & 0xff) * (1 - amt));
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
