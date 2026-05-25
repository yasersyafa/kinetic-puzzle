import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./Constants";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { LevelSelectScene } from "../scenes/LevelSelectScene";
import { GameScene } from "../scenes/GameScene";
import { PauseScene } from "../scenes/PauseScene";
import { GameOverScene } from "../scenes/GameOverScene";
import { CosmeticsScene } from "../scenes/CosmeticsScene";

const dpr =
  typeof window !== "undefined"
    ? Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    : 1;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#fbf3d5",
  title: "Static Puzzle",
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
    roundPixels: true,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    expandParent: true,
  },
  input: {
    activePointers: 1,
  },
  audio: {
    noAudio: true,
  },
  scene: [
    BootScene,
    MenuScene,
    LevelSelectScene,
    GameScene,
    PauseScene,
    GameOverScene,
    CosmeticsScene,
  ],
};
