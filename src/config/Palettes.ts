import { Color } from '../types/Game';
import { useGameStore } from '../managers/GameStateManager';
import { PACKS } from './Levels';

export type PaletteId = 'classic' | 'sunset' | 'ocean';

export interface PaletteUI {
  bg: number;
  bgHex: string;
  primary: number;     // main CTA button
  secondary: number;   // secondary action
  accent: number;      // tertiary
  danger: number;      // destructive
  exitGlow: number;
}

export interface Palette {
  id: PaletteId;
  name: string;
  description: string;
  colors: Record<Color, number>;
  ui: PaletteUI;
  unlock: { tag: 'always' | 'pack-clear'; packId?: string };
}

export const PALETTES: Palette[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Default palette.',
    colors: {
      red: 0xe56b6f,
      blue: 0x7fb7e8,
      green: 0xb8e5c8,
      yellow: 0xffd96a,
      purple: 0xc9a4d8,
      orange: 0xf2a76b,
    },
    ui: {
      bg: 0xfbf3d5,
      bgHex: '#fbf3d5',
      primary: 0xb8e5c8,
      secondary: 0xa8d4f0,
      accent: 0xffd96a,
      danger: 0xf28b82,
      exitGlow: 0xff8a5b,
    },
    unlock: { tag: 'always' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm desert tones.',
    colors: {
      red: 0xff6b3d,
      blue: 0xffb068,
      green: 0xffe066,
      yellow: 0xffd4a3,
      purple: 0xd96b6b,
      orange: 0xff8c42,
    },
    ui: {
      bg: 0xffeed5,
      bgHex: '#ffeed5',
      primary: 0xff8c42,
      secondary: 0xffb068,
      accent: 0xffe066,
      danger: 0xd96b6b,
      exitGlow: 0xff6b3d,
    },
    unlock: { tag: 'pack-clear', packId: 'tutorial' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool deep-sea tones.',
    colors: {
      red: 0x4a90c2,
      blue: 0x5fb3d4,
      green: 0x7fcdbb,
      yellow: 0xc6e1e8,
      purple: 0x6a87b8,
      orange: 0x4ecdc4,
    },
    ui: {
      bg: 0xe0f0f5,
      bgHex: '#e0f0f5',
      primary: 0x4ecdc4,
      secondary: 0x5fb3d4,
      accent: 0xc6e1e8,
      danger: 0x6a87b8,
      exitGlow: 0x4a90c2,
    },
    unlock: { tag: 'pack-clear', packId: 'gears' },
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function getEquippedPalette(): Palette {
  return getPalette(useGameStore.getState().equippedPalette);
}

export function paletteUI(): PaletteUI {
  return getEquippedPalette().ui;
}

export function isPaletteUnlocked(id: PaletteId): boolean {
  const p = getPalette(id);
  const store = useGameStore.getState();
  if (p.unlock.tag === 'always') return true;
  if (p.unlock.tag === 'pack-clear' && p.unlock.packId) {
    const pack = PACKS.find((pk) => pk.id === p.unlock.packId);
    if (!pack) return false;
    return pack.levelIds.every((lvl) => store.starsFor(lvl) > 0);
  }
  return false;
}

export function unlockProgress(id: PaletteId): { current: number; total: number } | null {
  const p = getPalette(id);
  const store = useGameStore.getState();
  if (p.unlock.tag === 'always') return null;
  if (p.unlock.tag === 'pack-clear' && p.unlock.packId) {
    const pack = PACKS.find((pk) => pk.id === p.unlock.packId);
    if (!pack) return null;
    const cleared = pack.levelIds.filter((lvl) => store.starsFor(lvl) > 0).length;
    return { current: cleared, total: pack.levelIds.length };
  }
  return null;
}
