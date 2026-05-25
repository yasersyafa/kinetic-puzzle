export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type ExitSide = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
export type BlockType = 'simple' | 'constrained' | 'dependent' | 'obstacle' | 'lock';

export interface BlockData {
  id: string;
  color: Color;
  position: [number, number];
  size: [number, number];
  type?: BlockType;
  direction?: Direction;
  dependsOn?: string;
  allowedExits?: ExitSide[];
  unlockAt?: number;
}

export interface ExitZone {
  side: ExitSide;
  index: number;
}

export interface LevelData {
  id: number;
  cols: number;
  rows: number;
  blocks: BlockData[];
  exits: ExitZone[];
  parMoves: number;
  pack?: string;
  iceCells?: [number, number][];
}

export interface MoveHistoryEntry {
  blockId: string;
  prevPos: [number, number];
  removed: boolean;
  unlockedDeps?: string[];
}
