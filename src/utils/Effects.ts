import Phaser from 'phaser';
import { TOKENS } from '../ui/Theme';
import { Direction } from '../types/Game';

export function burstParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 14,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 120 + Math.random() * 180;
    const size = 11 + Math.random() * 14;
    const p = scene.add.rectangle(x, y, size, size, color);
    p.setStrokeStyle(4, TOKENS.ink, 1);
    p.setAlpha(0.95);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * speed,
      y: y + Math.sin(angle) * speed,
      alpha: 0,
      angle: Math.random() * 360,
      scale: 0.3,
      duration: 500 + Math.random() * 250,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

const CONFETTI_COLORS = [
  TOKENS.red,
  TOKENS.blue,
  TOKENS.mint,
  TOKENS.yellow,
  TOKENS.sky,
  0xffa3a3,
];

export function confetti(scene: Phaser.Scene, durationMs = 1800): void {
  const { width, height } = scene.scale;
  const launches = 60;
  for (let i = 0; i < launches; i++) {
    const delay = (durationMs * i) / launches;
    scene.time.delayedCall(delay, () => {
      const x = Math.random() * width;
      const c = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const w = 14 + Math.random() * 14;
      const h = 25 + Math.random() * 18;
      const p = scene.add.rectangle(x, -20, w, h, c).setAngle(Math.random() * 360);
      p.setStrokeStyle(4, TOKENS.ink, 1);
      scene.tweens.add({
        targets: p,
        y: height + 40,
        x: x + (Math.random() - 0.5) * 200,
        angle: p.angle + 360 * (Math.random() > 0.5 ? 1 : -1),
        duration: 1400 + Math.random() * 1100,
        ease: 'Sine.easeIn',
        onComplete: () => p.destroy(),
      });
    });
  }
}

export function fadeIn(scene: Phaser.Scene, ms = 250): void {
  scene.cameras.main.fadeIn(ms, 251, 243, 213);
}

export function fadeOutAndStart(
  scene: Phaser.Scene,
  nextKey: string,
  data?: object,
  ms = 250,
): void {
  scene.cameras.main.fadeOut(ms, 251, 243, 213);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start(nextKey, data);
  });
}

export function screenshake(
  scene: Phaser.Scene,
  intensity = 0.005,
  duration = 120,
): void {
  scene.cameras.main.shake(duration, intensity);
}

const DUST_DELTA: Record<Direction, [number, number]> = {
  UP: [0, 1],
  DOWN: [0, -1],
  LEFT: [1, 0],
  RIGHT: [-1, 0],
};

export function dustPuff(
  scene: Phaser.Scene,
  x: number,
  y: number,
  dir: Direction,
  count = 6,
): void {
  const [vx, vy] = DUST_DELTA[dir];
  for (let i = 0; i < count; i++) {
    const offset = (Math.random() - 0.5) * 44;
    const ox = vy !== 0 ? offset : 0;
    const oy = vx !== 0 ? offset : 0;
    const size = 8 + Math.random() * 8;
    const p = scene.add.rectangle(x + ox, y + oy, size, size, 0xece2c0);
    p.setStrokeStyle(3, TOKENS.ink, 0.7);
    p.setAlpha(0.95);
    const dist = 32 + Math.random() * 40;
    scene.tweens.add({
      targets: p,
      x: p.x + vx * dist,
      y: p.y + vy * dist,
      alpha: 0,
      scale: 0.3,
      duration: 220 + Math.random() * 120,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

export function removalBloom(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
): void {
  const ring = scene.add.graphics();
  ring.lineStyle(9, TOKENS.ink, 1);
  ring.strokeCircle(0, 0, 46);
  ring.fillStyle(color, 0.55);
  ring.fillCircle(0, 0, 43);
  ring.x = x;
  ring.y = y;
  ring.setScale(0.2);
  scene.tweens.add({
    targets: ring,
    scale: 2.6,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

export function portalSuck(
  scene: Phaser.Scene,
  x: number,
  y: number,
  dir: Direction,
): void {
  for (let i = 0; i < 6; i++) {
    const off = 26 + Math.random() * 22;
    const lateral = (Math.random() - 0.5) * 36;
    const ox = dir === 'LEFT' ? off : dir === 'RIGHT' ? -off : lateral;
    const oy = dir === 'UP' ? off : dir === 'DOWN' ? -off : lateral;
    const p = scene.add.rectangle(x + ox, y + oy, 9, 9, TOKENS.exitGlow);
    p.setStrokeStyle(2.5, TOKENS.ink, 1);
    scene.tweens.add({
      targets: p,
      x,
      y,
      alpha: 0,
      scale: 0.35,
      duration: 240 + Math.random() * 120,
      ease: 'Sine.easeIn',
      onComplete: () => p.destroy(),
    });
  }
  const ring = scene.add.graphics();
  ring.lineStyle(8, TOKENS.exitGlow, 1);
  ring.strokeCircle(0, 0, 38);
  ring.x = x;
  ring.y = y;
  ring.setScale(0.55);
  scene.tweens.add({
    targets: ring,
    scale: 2.2,
    alpha: 0,
    duration: 320,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

export function deadEndPulse(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, TOKENS.danger, 0);
  overlay.setDepth(900);
  scene.tweens.add({
    targets: overlay,
    alpha: { from: 0, to: 0.32 },
    duration: 200,
    yoyo: true,
    repeat: 1,
    onComplete: () => overlay.destroy(),
  });
  scene.cameras.main.shake(160, 0.006);
}
