import { Color } from '../types/Game';
import { useGameStore } from '../managers/GameStateManager';
import { STAGES } from './Levels';

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
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Stage identity follows the selected level; old manual selections are ignored. */
export function getStagePalette(stageNumber: number): Palette {
  const order: PaletteId[] = ['classic', 'ocean', 'sunset'];
  return getPalette(order[(Math.max(1, stageNumber) - 1) % order.length]);
}

export function paletteUI(levelId = useGameStore.getState().currentLevel): PaletteUI {
  const stage = STAGES.find(s => levelId >= s.firstLevel && levelId < s.firstLevel + s.levelCount);
  return getStagePalette(stage?.number ?? 1).ui;
}
