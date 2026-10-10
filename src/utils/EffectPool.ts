import Phaser from 'phaser';

type Effect = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics;
const pools = new WeakMap<Phaser.Scene, EffectPool>();

/** Bounded scene-local pool. Effects return here after animation; only shutdown destroys them. */
export class EffectPool {
  private rectangles: Phaser.GameObjects.Rectangle[] = [];
  private graphics: Phaser.GameObjects.Graphics[] = [];
  private leased = new Set<Effect>();
  private disposed = false;
  private allocated = 32;
  constructor(private scene: Phaser.Scene) {
    for (let i = 0; i < 32; i++) this.rectangles.push(scene.add.rectangle(0, 0, 1, 1).setName('pooled-effect').setActive(false).setVisible(false));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }
  private createRectangle(): Phaser.GameObjects.Rectangle {
    this.allocated++; return this.scene.add.rectangle(0, 0, 1, 1).setName('pooled-effect');
  }
  private createGraphic(): Phaser.GameObjects.Graphics {
    this.allocated++; return this.scene.add.graphics().setName('pooled-effect');
  }
  rectangle(x: number, y: number, width: number, height: number, color: number): Phaser.GameObjects.Rectangle | undefined {
    if (this.disposed) return;
    const object = this.rectangles.pop() ?? (this.allocated < 192 ? this.createRectangle() : undefined);
    if (!object) return;
    object.setPosition(x, y).setSize(width, height).setFillStyle(color, 1).setStrokeStyle().setScale(1).setAngle(0).setAlpha(1).setDepth(0).setActive(true).setVisible(true);
    this.leased.add(object); return object;
  }
  graphic(): Phaser.GameObjects.Graphics | undefined {
    if (this.disposed) return;
    const object = this.graphics.pop() ?? (this.allocated < 192 ? this.createGraphic() : undefined);
    if (!object) return;
    object.clear().setPosition(0, 0).setScale(1).setAngle(0).setAlpha(1).setDepth(0).setActive(true).setVisible(true);
    this.leased.add(object); return object;
  }
  release(object: Effect): void {
    if (this.disposed || !this.leased.delete(object)) return;
    object.setActive(false).setVisible(false);
    if (object instanceof Phaser.GameObjects.Graphics) this.graphics.push(object);
    else this.rectangles.push(object);
  }
  /** Also used when an emitter is removed before its animations finish. */
  cancel(object: Effect): void { this.scene.tweens.killTweensOf(object); this.release(object); }
  private dispose(): void {
    this.disposed = true;
    for (const object of [...this.rectangles, ...this.graphics, ...this.leased]) {
      this.scene.tweens.killTweensOf(object);
      if (object.scene) object.destroy();
    }
    this.rectangles.length = this.graphics.length = 0; this.leased.clear(); pools.delete(this.scene);
  }
}
export function effectPool(scene: Phaser.Scene): EffectPool {
  let pool = pools.get(scene);
  if (!pool) { pool = new EffectPool(scene); pools.set(scene, pool); }
  return pool;
}
