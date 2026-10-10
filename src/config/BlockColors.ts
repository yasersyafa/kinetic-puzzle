import type { BlockData, Color } from '../types/Game';
/** Gameplay language is fixed; cosmetic palettes may change UI, not mechanic colors. */
export function blockColor(type:BlockData['type']):Color {
  return type==='constrained'?'yellow':type==='dependent'?'blue':type==='lock'?'purple':'red';
}
export const BLOCK_FILLS:Record<Color,number>={red:0xe56b6f,yellow:0xffd96a,blue:0x7fb7e8,purple:0xc9a4d8,green:0xb8e5c8,orange:0xf2a76b};
