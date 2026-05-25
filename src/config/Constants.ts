import { Color } from "../types/Game";

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export const CELL_SIZE = 180;
export const BOARD_PADDING = 32;

export const HUD_HEIGHT = 126;

export const COLORS: Record<Color, number> = {
  red: 0xe56b6f,
  blue: 0x7fb7e8,
  green: 0xb8e5c8,
  yellow: 0xffd96a,
  purple: 0xc9a4d8,
  orange: 0xf2a76b,
};

export const DRAG_THRESHOLD = 5;
export const TOTAL_LEVELS = 80;

export const SCENE_KEYS = {
  Boot: "BootScene",
  Menu: "MenuScene",
  LevelSelect: "LevelSelectScene",
  Game: "GameScene",
  Pause: "PauseScene",
  GameOver: "GameOverScene",
  Cosmetics: "CosmeticsScene",
} as const;

export const FONT_HEADER = '"Bungee", "Arial Black", sans-serif';
export const FONT_BODY = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
