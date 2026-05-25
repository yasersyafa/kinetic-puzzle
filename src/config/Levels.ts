import { LevelData, BlockData, Color, ExitZone, Direction } from '../types/Game';

const S = (id: string, c: number, r: number): BlockData => ({
  id, color: 'red', position: [c, r], size: [1, 1], type: 'simple',
});
const O = (id: string, c: number, r: number): BlockData => ({
  id, color: 'red', position: [c, r], size: [1, 1], type: 'obstacle',
});
const C = (id: string, c: number, r: number, dir: Direction): BlockData => ({
  id, color: 'yellow', position: [c, r], size: [1, 1], type: 'constrained', direction: dir,
});
const D = (id: string, c: number, r: number, dep: string): BlockData => ({
  id, color: 'blue', position: [c, r], size: [1, 1], type: 'dependent', dependsOn: dep,
});
const SC = (id: string, c: number, r: number, color: Color): BlockData => ({
  id, color, position: [c, r], size: [1, 1], type: 'simple',
});
const K = (id: string, c: number, r: number, unlockAt: number, color: Color = 'purple'): BlockData => ({
  id, color, position: [c, r], size: [1, 1], type: 'lock', unlockAt,
});
const E = (
  side: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT',
  index: number,
): ExitZone => ({ side, index });
const L = (
  id: number, cols: number, rows: number, blocks: BlockData[], exits: ExitZone[],
  parMoves: number, pack?: string, iceCells?: [number, number][],
): LevelData => ({ id, cols, rows, blocks, exits, parMoves, pack, iceCells });

// AUTO-BAKED via scripts/bake-v2.ts. Each level verified solvable by A* solver
// matching MovementSystem (slide momentum + constrained + dependent).
// parMoves = optimal solver solution length (used for 3-star thresholds).

export const LEVELS: LevelData[] = [
  L(1, 5, 5, [S('m1',3,2), S('m2',1,2)], [E('RIGHT',2)], 2, 'tutorial'),
  L(2, 5, 5, [O('o1',2,3), S('m1',0,3), S('m2',1,1)], [E('BOTTOM',1)], 3, 'tutorial'),
  L(3, 5, 5, [O('o1',0,1), C('m1',1,2,'LEFT'), S('m2',2,3)], [E('LEFT',2)], 4, 'tutorial'),
  L(4, 5, 5, [O('o1',0,0), C('m1',1,3,'UP'), S('m2',3,3), S('m3',1,2)], [E('TOP',1)], 5, 'tutorial'),
  L(5, 5, 5, [O('o1',4,3), S('m1',4,2), S('m2',1,0), D('m3',1,2,'m1')], [E('RIGHT',2)], 5, 'tutorial'),
  L(6, 6, 6, [O('o1',2,0), C('m1',3,2,'DOWN'), S('m2',0,5), D('m3',3,1,'m1')], [E('BOTTOM',3)], 6, 'tutorial'),
  L(7, 6, 6, [O('o1',0,1), C('m1',5,2,'LEFT'), S('m2',3,2), D('m3',2,4,'m1')], [E('LEFT',2)], 5, 'tutorial'),
  L(8, 6, 6, [O('o1',5,0), O('o2',4,5), C('m1',4,2,'UP'), S('m2',4,4), D('m3',5,2,'m1')], [E('TOP',4)], 6, 'tutorial'),
  L(9, 6, 6, [O('o1',5,4), C('m1',3,3,'RIGHT'), S('m2',0,4), D('m3',0,3,'m1')], [E('RIGHT',3)], 6, 'hook'),
  L(10, 6, 6, [O('o1',1,5), C('m1',2,4,'DOWN'), S('m2',2,0), D('m3',4,0,'m1')], [E('BOTTOM',2)], 5, 'hook'),
  L(11, 7, 7, [O('o1',1,6), O('o2',6,4), C('m1',4,5,'LEFT'), S('m2',2,5), D('m3',6,0,'m1')], [E('LEFT',5)], 10, 'hook'),
  L(12, 7, 7, [O('o1',4,0), O('o2',4,1), C('m1',5,1,'UP'), S('m2',0,2), D('m3',5,6,'m1'), D('m4',5,4,'m3')], [E('TOP',5)], 10, 'hook'),
  L(13, 6, 6, [O('o1',5,3), C('m1',4,4,'RIGHT'), S('m2',4,0), D('m3',0,4,'m1')], [E('RIGHT',4)], 6, 'hook'),
  L(14, 7, 7, [O('o1',2,5), O('o2',6,2), O('o3',2,0), C('m1',1,6,'DOWN'), S('m2',3,1), D('m3',1,0,'m1'), D('m4',0,3,'m3')], [E('BOTTOM',1)], 9, 'hook'),
  L(15, 7, 7, [O('o1',6,4), O('o2',4,6), C('m1',1,5,'LEFT'), S('m2',5,5), D('m3',1,6,'m1')], [E('LEFT',5)], 10, 'hook'),
  L(16, 7, 7, [O('o1',3,0), O('o2',1,5), C('m1',4,1,'UP'), S('m2',2,6), D('m3',4,3,'m1'), D('m4',0,1,'m3')], [E('TOP',4)], 10, 'hook'),
  L(17, 7, 7, [O('o1',4,3), O('o2',6,0), O('o3',6,6), C('m1',6,5,'RIGHT'), S('m2',3,5), D('m3',1,5,'m1'), D('m4',2,5,'m3')], [E('RIGHT',5)], 10, 'hook'),
  L(18, 7, 7, [O('o1',0,4), O('o2',3,5), C('m1',2,6,'DOWN'), S('m2',2,0), D('m3',0,2,'m1')], [E('BOTTOM',2)], 8, 'hook'),
  L(19, 7, 7, [O('o1',1,4), O('o2',6,2), O('o3',1,5), C('m1',5,1,'LEFT'), S('m2',6,1), D('m3',5,4,'m1'), D('m4',4,5,'m3')], [E('LEFT',1)], 10, 'hook'),
  L(20, 8, 8, [O('o1',3,7), O('o2',0,7), O('o3',6,3), C('m1',2,4,'UP'), S('m2',3,1), D('m3',2,7,'m1'), D('m4',0,5,'m3')], [E('TOP',2)], 13, 'hook'),
  L(21, 7, 7, [O('o1',4,2), O('o2',3,2), C('m1',4,3,'RIGHT'), S('m2',3,3), D('m3',5,4,'m1'), D('m4',0,3,'m3')], [E('RIGHT',3)], 9, 'hook'),
  L(22, 7, 7, [O('o1',6,6), O('o2',5,1), O('o3',3,6), C('m1',4,6,'DOWN'), S('m2',4,1), D('m3',4,0,'m1'), D('m4',4,5,'m3')], [E('BOTTOM',4)], 10, 'hook'),
  L(23, 8, 8, [O('o1',5,5), O('o2',6,0), O('o3',7,1), C('m1',1,2,'LEFT'), S('m2',0,2), D('m3',3,6,'m1'), D('m4',4,2,'m3')], [E('LEFT',2)], 14, 'hook'),
  L(24, 7, 7, [O('o1',4,1), O('o2',3,5), O('o3',1,4), C('m1',2,0,'UP'), S('m2',2,3), D('m3',1,2,'m1'), D('m4',2,1,'m3')], [E('TOP',2)], 11, 'gears'),
  L(25, 7, 7, [O('o1',0,1), O('o2',0,0), O('o3',0,5), C('m1',6,4,'RIGHT'), S('m2',6,1), D('m3',3,4,'m1'), D('m4',5,4,'m3')], [E('RIGHT',4)], 11, 'gears'),
  L(26, 8, 8, [O('o1',0,0), O('o2',3,4), O('o3',6,1), C('m1',1,4,'DOWN'), S('m2',7,1), S('m3',1,7), D('m4',3,1,'m1'), D('m5',1,3,'m4')], [E('BOTTOM',1)], 12, 'gears'),
  L(27, 7, 7, [O('o1',2,3), O('o2',3,3), O('o3',0,1), C('m1',2,2,'LEFT'), S('m2',4,1), D('m3',1,3,'m1'), D('m4',4,0,'m3')], [E('LEFT',2)], 11, 'gears'),
  L(28, 8, 8, [O('o1',0,4), O('o2',5,0), O('o3',1,5), O('o4',7,6), C('m1',6,1,'UP'), S('m2',6,4), D('m3',3,0,'m1'), D('m4',0,0,'m3'), D('m5',6,7,'m4')], [E('TOP',6)], 15, 'gears'),
  L(29, 8, 8, [O('o1',1,4), O('o2',4,1), O('o3',7,6), O('o4',7,2), C('m1',4,5,'RIGHT'), S('m2',6,5), D('m3',5,7,'m1'), D('m4',1,5,'m3'), D('m5',0,5,'m4')], [E('RIGHT',5)], 14, 'gears'),
  L(30, 7, 7, [O('o1',2,1), O('o2',4,2), O('o3',0,0), C('m1',3,2,'DOWN'), S('m2',3,1), D('m3',3,0,'m1'), D('m4',0,3,'m3')], [E('BOTTOM',3)], 12, 'gears'),
  L(31, 8, 8, [O('o1',7,1), O('o2',7,7), O('o3',1,5), O('o4',0,7), C('m1',0,2,'LEFT'), S('m2',1,2), D('m3',5,2,'m1'), D('m4',7,2,'m3'), D('m5',4,2,'m4')], [E('LEFT',2)], 17, 'gears'),
  L(32, 8, 8, [O('o1',2,7), O('o2',3,6), O('o3',6,1), C('m1',1,6,'UP'), S('m2',1,4), S('m3',7,5), D('m4',6,0,'m1'), D('m5',6,2,'m4')], [E('TOP',1)], 14, 'gears'),
  L(33, 8, 8, [O('o1',3,0), O('o2',1,2), O('o3',5,4), O('o4',0,2), C('m1',7,3,'RIGHT'), S('m2',2,5), D('m3',3,3,'m1'), D('m4',6,3,'m3'), D('m5',1,3,'m4')], [E('RIGHT',3)], 13, 'gears'),
  L(34, 8, 8, [O('o1',7,5), O('o2',5,7), O('o3',3,0), O('o4',3,5), C('m1',4,4,'DOWN'), S('m2',4,5), D('m3',7,0,'m1'), D('m4',4,1,'m3'), D('m5',5,4,'m4')], [E('BOTTOM',4)], 15, 'gears'),
  L(35, 8, 8, [O('o1',7,5), O('o2',2,3), O('o3',1,7), C('m1',2,6,'LEFT'), S('m2',1,6), S('m3',7,3), D('m4',7,6,'m1'), D('m5',4,6,'m4')], [E('LEFT',6)], 14, 'gears'),
  L(36, 8, 8, [O('o1',1,3), O('o2',1,1), O('o3',0,0), O('o4',4,6), C('m1',1,0,'UP'), S('m2',1,2), D('m3',1,5,'m1'), D('m4',4,0,'m3'), D('m5',3,6,'m4')], [E('TOP',1)], 16, 'gears'),
  L(37, 9, 9, [O('o1',8,7), O('o2',0,5), O('o3',0,6), O('o4',6,0), O('o5',1,8), C('m1',7,6,'RIGHT'), S('m2',8,6), D('m3',0,4,'m1'), D('m4',3,6,'m3'), D('m5',6,4,'m4')], [E('RIGHT',6)], 18, 'gears'),
  L(38, 8, 8, [O('o1',7,2), O('o2',4,2), O('o3',1,7), O('o4',4,7), C('m1',2,4,'DOWN'), S('m2',2,0), D('m3',2,2,'m1'), D('m4',0,1,'m3'), D('m5',5,6,'m4')], [E('BOTTOM',2)], 14, 'gears'),
  L(39, 8, 8, [O('o1',5,7), O('o2',0,4), O('o3',0,7), O('o4',0,1), C('m1',7,6,'LEFT'), S('m2',0,6), D('m3',6,7,'m1'), D('m4',1,5,'m3'), D('m5',3,5,'m4')], [E('LEFT',6)], 17, 'gears'),
  L(40, 9, 9, [O('o1',5,0), O('o2',1,8), O('o3',6,0), O('o4',6,2), O('o5',5,8), C('m1',2,0,'UP'), S('m2',2,3), D('m3',3,3,'m1'), D('m4',2,2,'m3'), D('m5',2,1,'m4')], [E('TOP',2)], 17, 'gears'),
  L(41, 8, 8, [O('o1',6,0), O('o2',1,0), O('o3',7,4), O('o4',3,2), C('m1',5,3,'RIGHT'), S('m2',7,5), D('m3',5,5,'m1'), D('m4',4,3,'m3'), D('m5',0,3,'m4')], [E('RIGHT',3)], 14, 'gears'),
  L(42, 9, 9, [O('o1',8,0), O('o2',7,4), O('o3',2,3), O('o4',3,4), O('o5',3,1), C('m1',4,6,'DOWN'), S('m2',4,7), D('m3',4,1,'m1'), D('m4',4,4,'m3'), D('m5',4,2,'m4')], [E('BOTTOM',4)], 16, 'gears'),
  L(43, 9, 9, [O('o1',5,3), O('o2',8,4), O('o3',1,2), O('o4',5,8), O('o5',0,5), C('m1',3,3,'LEFT'), S('m2',4,3), D('m3',6,3,'m1'), D('m4',8,3,'m3'), D('m5',7,2,'m4')], [E('LEFT',3)], 21, 'gears'),
  L(44, 8, 8, [O('o1',3,0), O('o2',2,7), O('o3',3,5), O('o4',7,2), O('o5',2,3), C('m1',1,2,'UP'), S('m2',1,7), D('m3',6,0,'m1'), D('m4',1,3,'m3')], [E('TOP',1)], 15, 'stones'),
  L(45, 8, 8, [O('o1',4,6), O('o2',3,6), O('o3',3,7), O('o4',4,2), O('o5',7,4), C('m1',5,5,'RIGHT'), S('m2',1,1), D('m3',0,5,'m1'), D('m4',4,5,'m3')], [E('RIGHT',5)], 16, 'stones'),
  L(46, 9, 9, [O('o1',4,8), O('o2',2,3), O('o3',1,2), O('o4',6,0), O('o5',0,3), O('o6',3,0), C('m1',5,6,'DOWN'), D('m2',0,8,'m1'), D('m3',1,0,'m2'), D('m4',0,2,'m3')], [E('BOTTOM',5)], 18, 'stones'),
  L(47, 8, 8, [O('o1',2,7), O('o2',3,4), O('o3',7,6), O('o4',4,0), O('o5',5,3), C('m1',0,2,'LEFT'), S('m2',6,3), D('m3',6,4,'m1'), D('m4',2,2,'m3')], [E('LEFT',2)], 17, 'stones'),
  L(48, 9, 9, [O('o1',5,1), O('o2',7,6), O('o3',3,7), O('o4',8,5), O('o5',5,6), O('o6',6,8), C('m1',4,0,'UP'), S('m2',4,4), D('m3',4,2,'m1'), D('m4',2,0,'m3'), D('m5',4,1,'m4')], [E('TOP',4)], 17, 'stones'),
  L(49, 9, 9, [O('o1',8,8), O('o2',4,3), O('o3',6,1), O('o4',1,0), O('o5',8,3), O('o6',4,8), C('m1',8,7,'RIGHT'), D('m2',1,7,'m1'), D('m3',0,7,'m2'), D('m4',2,7,'m3')], [E('RIGHT',7)], 16, 'stones'),
  L(50, 9, 9, [O('o1',0,1), O('o2',4,8), O('o3',5,1), O('o4',5,3), O('o5',1,3), O('o6',8,3), C('m1',5,6,'DOWN'), S('m2',1,2), D('m3',5,0,'m1'), D('m4',4,7,'m3'), D('m5',5,4,'m4')], [E('BOTTOM',5)], 18, 'stones'),
  L(51, 8, 8, [O('o1',6,4), O('o2',7,7), O('o3',4,3), O('o4',3,3), O('o5',1,0), C('m1',3,4,'LEFT'), S('m2',5,6), D('m3',6,2,'m1'), D('m4',1,1,'m3')], [E('LEFT',4)], 17, 'stones'),
  L(52, 9, 9, [O('o1',4,7), O('o2',3,4), O('o3',7,3), O('o4',2,5), O('o5',1,5), O('o6',5,6), C('m1',2,2,'UP'), S('m2',2,0), D('m3',2,8,'m1'), D('m4',2,3,'m3'), D('m5',2,7,'m4')], [E('TOP',2)], 19, 'stones'),
  L(53, 9, 9, [O('o1',6,3), O('o2',2,7), O('o3',7,3), O('o4',4,2), O('o5',3,7), O('o6',7,5), O('o7',0,2), C('m1',8,2,'RIGHT'), S('m2',2,5), D('m3',8,7,'m1'), D('m4',1,2,'m3'), D('m5',3,4,'m4')], [E('RIGHT',2)], 20, 'stones'),
  L(54, 9, 9, [O('o1',5,8), O('o2',7,1), O('o3',0,5), O('o4',0,3), O('o5',3,4), O('o6',6,5), C('m1',4,7,'DOWN'), D('m2',4,1,'m1'), D('m3',4,5,'m2'), D('m4',8,0,'m3')], [E('BOTTOM',4)], 18, 'stones'),
  L(55, 9, 9, [O('o1',3,6), O('o2',4,1), O('o3',3,5), O('o4',3,0), O('o5',5,5), O('o6',4,2), C('m1',0,4,'LEFT'), S('m2',1,4), D('m3',4,4,'m1'), D('m4',3,4,'m3'), D('m5',5,4,'m4')], [E('LEFT',4)], 18, 'stones'),
  L(56, 10, 10, [O('o1',0,1), O('o2',3,5), O('o3',3,2), O('o4',5,3), O('o5',5,4), O('o6',0,2), O('o7',9,8), C('m1',1,1,'UP'), S('m2',1,0), D('m3',1,9,'m1'), D('m4',7,3,'m3'), D('m5',1,3,'m4')], [E('TOP',1)], 21, 'stones'),
  L(57, 9, 9, [O('o1',5,2), O('o2',0,8), O('o3',6,3), O('o4',3,1), O('o5',8,2), O('o6',1,1), C('m1',8,1,'RIGHT'), S('m2',2,1), D('m3',0,1,'m1'), D('m4',6,1,'m3'), D('m5',1,0,'m4')], [E('RIGHT',1)], 17, 'stones'),
  L(58, 9, 9, [O('o1',7,1), O('o2',5,0), O('o3',2,2), O('o4',0,5), O('o5',2,8), O('o6',6,4), O('o7',3,6), C('m1',4,7,'DOWN'), S('m2',4,4), D('m3',4,1,'m1'), D('m4',4,3,'m3'), D('m5',4,5,'m4')], [E('BOTTOM',4)], 21, 'stones'),
  L(59, 10, 10, [O('o1',8,5), O('o2',3,3), O('o3',7,7), O('o4',0,8), O('o5',7,2), O('o6',1,9), O('o7',1,7), C('m1',3,6,'LEFT'), S('m2',8,6), D('m3',7,6,'m1'), D('m4',6,6,'m3'), D('m5',5,6,'m4')], [E('LEFT',6)], 21, 'stones'),
  L(60, 9, 9, [O('o1',1,4), O('o2',0,5), O('o3',6,6), O('o4',0,4), O('o5',8,1), O('o6',1,8), C('m1',5,0,'UP'), S('m2',5,5), D('m3',2,8,'m1'), D('m4',1,5,'m3'), D('m5',7,3,'m4')], [E('TOP',5)], 21, 'stones'),
  L(61, 10, 10, [O('o1',3,1), O('o2',2,8), O('o3',4,0), O('o4',3,9), O('o5',0,7), O('o6',7,7), O('o7',9,6), C('m1',9,1,'RIGHT'), S('m2',4,7), D('m3',0,1,'m1'), D('m4',4,1,'m3'), D('m5',8,1,'m4')], [E('RIGHT',1)], 22, 'stones'),
  L(62, 9, 9, [O('o1',3,6), O('o2',3,0), O('o3',6,0), O('o4',0,3), O('o5',2,1), O('o6',6,1), O('o7',3,5), C('m1',2,5,'DOWN'), S('m2',2,7), D('m3',6,2,'m1'), D('m4',0,5,'m3'), D('m5',7,8,'m4')], [E('BOTTOM',2)], 20, 'stones'),
  L(63, 10, 10, [O('o1',4,5), O('o2',5,6), O('o3',7,3), O('o4',3,1), O('o5',5,7), O('o6',5,5), O('o7',6,3), C('m1',1,6,'LEFT'), S('m2',4,6), D('m3',8,4,'m1'), D('m4',8,6,'m3'), D('m5',3,6,'m4')], [E('LEFT',6)], 22, 'stones'),
  L(64, 9, 9, [O('o1',3,1), O('o2',5,6), O('o3',3,7), O('o4',0,7), O('o5',1,0), C('m1',4,0,'UP'), S('m2',1,8), D('m3',2,4,'m1'), D('m4',4,5,'m3'), D('m5',4,2,'m4')], [E('TOP',4)], 18, 'master'),
  L(65, 9, 9, [O('o1',0,4), O('o2',1,5), O('o3',0,1), O('o4',0,5), O('o5',4,1), C('m1',5,3,'RIGHT'), S('m2',2,2), D('m3',0,2,'m1'), D('m4',7,2,'m3'), D('m5',0,3,'m4')], [E('RIGHT',3)], 20, 'master'),
  L(66, 10, 10, [O('o1',9,7), O('o2',6,8), O('o3',4,2), O('o4',7,9), O('o5',4,9), O('o6',1,6), C('m1',5,7,'DOWN'), S('m2',7,4), D('m3',0,5,'m1'), D('m4',5,0,'m3'), D('m5',5,6,'m4')], [E('BOTTOM',5)], 21, 'master'),
  L(67, 9, 9, [O('o1',0,3), O('o2',7,0), O('o3',6,2), O('o4',1,7), O('o5',8,4), C('m1',1,6,'LEFT'), S('m2',8,1), D('m3',3,6,'m1'), D('m4',2,6,'m3'), D('m5',6,1,'m4')], [E('LEFT',6)], 20, 'master'),
  L(68, 10, 10, [O('o1',1,9), O('o2',4,8), O('o3',8,5), O('o4',9,7), O('o5',7,6), O('o6',1,0), C('m1',5,2,'UP'), S('m2',5,8), D('m3',5,7,'m1'), D('m4',5,9,'m3'), D('m5',5,6,'m4')], [E('TOP',5)], 21, 'master'),
  L(69, 10, 10, [O('o1',6,0), O('o2',4,6), O('o3',7,3), O('o4',3,1), O('o5',9,4), O('o6',3,2), C('m1',7,2,'RIGHT'), S('m2',1,2), D('m3',2,2,'m1'), D('m4',4,2,'m3'), D('m5',5,7,'m4')], [E('RIGHT',2)], 21, 'master'),
  L(70, 10, 10, [O('o1',1,3), O('o2',7,9), O('o3',9,8), O('o4',8,4), O('o5',5,8), O('o6',3,6), C('m1',8,6,'DOWN'), S('m2',8,9), D('m3',9,3,'m1'), D('m4',8,0,'m3'), D('m5',4,5,'m4')], [E('BOTTOM',8)], 23, 'master'),
  L(71, 9, 9, [O('o1',1,6), O('o2',8,5), O('o3',0,3), O('o4',4,8), O('o5',8,2), C('m1',1,5,'LEFT'), S('m2',5,3), D('m3',8,1,'m1'), D('m4',8,0,'m3'), D('m5',2,5,'m4')], [E('LEFT',5)], 22, 'master'),
  L(72, 10, 10, [O('o1',9,1), O('o2',2,6), O('o3',8,2), O('o4',6,5), O('o5',1,7), O('o6',5,0), O('o7',4,3), O('o8',4,8), C('m1',6,2,'UP'), S('m2',6,4), D('m3',2,3,'m1'), D('m4',6,9,'m3'), D('m5',0,8,'m4')], [E('TOP',6)], 25, 'master'),

  // === MASTER PACK FIXTURES (L73-78): single-exit ice + lock intros ===
  // L73 — ice push intro: skip 1 obstacle
  L(73, 5, 3, [SC('m1',0,1,'red'), O('o1',2,1)], [E('RIGHT',1)], 2, 'master', [[1,1]]),
  // L74 — chain push through two obstacles
  L(74, 7, 3, [SC('m1',0,1,'red'), O('o1',2,1), O('o2',4,1)], [E('RIGHT',1)], 2, 'master', [[1,1],[3,1]]),
  // L75 — chain push landing on ice
  L(75, 6, 3, [SC('m1',0,1,'red'), O('o1',3,1)], [E('RIGHT',1)], 2, 'master', [[2,1],[4,1]]),
  // L76 — lock counter intro: unlockAt 1
  L(76, 6, 3, [SC('m1',0,1,'red'), K('k1',0,2,1), O('o1',5,0)], [E('RIGHT',1)], 4, 'master'),
  // L77 — lock unlockAt 2 (need 2 exits first)
  L(77, 7, 3, [SC('m1',0,1,'red'), SC('m2',0,2,'blue'), K('k1',6,2,2), O('o1',5,0), O('o2',6,0)], [E('RIGHT',1)], 6, 'master'),
  // L78 — two locks, staggered unlock (1 and 2)
  L(78, 8, 3, [SC('m1',0,1,'red'), K('k1',0,2,1), K('k2',7,2,2), O('o1',6,0), O('o2',7,0)], [E('RIGHT',1)], 6, 'master'),
  // === FIXTURE PACK (L79-80): legendary finale ===
  // L79 — Penultimate showcase. Ice push + lock counter + dep chain depth 4 + all mechanics.
  // Single exit RIGHT row 5. Lock at (5,5) opens after 3 exits.
  L(79, 10, 10, [
    SC('m1',0,5,'red'),
    D('m2',0,2,'m1'),
    D('m3',0,8,'m2'),
    D('m4',9,2,'m3'),
    SC('m5',3,5,'blue'),
    K('k1',5,5,3,'purple'),
    O('o1',9,4), O('o2',7,2), O('o3',2,7), O('o4',4,0), O('o5',6,0), O('o6',1,7), O('o7',8,8), O('o8',2,1), O('o9',7,7), O('o10',3,3), O('o11',1,9), O('o12',4,4), O('o13',4,6), O('o14',6,4), O('o15',6,6), O('o16',1,4), O('o17',1,6),
  ], [E('RIGHT',5)], 32, 'fixture', [[6,5],[5,3]]),
  // L80 — final boss. Single exit. All mechanics. Par 38 target. Dep chain depth 4.
  L(80, 10, 10, [
    SC('m1',0,5,'red'),
    D('m2',0,2,'m1'),
    D('m3',0,8,'m2'),
    D('m4',9,2,'m3'),
    D('m5',3,5,'m4'),
    K('k1',5,5,4,'purple'),
    SC('m6',9,8,'blue'),
    O('o1',9,4), O('o2',7,2), O('o3',2,7), O('o4',4,0), O('o5',6,0), O('o6',1,7), O('o7',8,8),
    O('o8',2,1), O('o9',7,7), O('o10',3,3), O('o11',1,9), O('o12',4,4), O('o13',4,6),
    O('o14',6,4), O('o15',6,6), O('o16',1,4), O('o17',1,6), O('o18',3,9),
  ], [E('RIGHT',5)], 39, 'fixture', [[6,5],[5,3]]),
];

export type SolutionMove = { blockId: string; dir: Direction };

export const SOLUTIONS: Record<number, SolutionMove[]> = {
  1: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}],
  2: [{blockId:'m2',dir:'DOWN'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m1',dir:'DOWN'}],
  3: [{blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'LEFT'}],
  4: [{blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m1',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  5: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}],
  6: [{blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}],
  7: [{blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}],
  8: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'UP'}],
  9: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}],
  10: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}],
  11: [{blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}],
  12: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  13: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}],
  14: [{blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}],
  15: [{blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}],
  16: [{blockId:'m1',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}],
  17: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}],
  18: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}],
  19: [{blockId:'m1',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}],
  20: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}],
  21: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}],
  22: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}],
  23: [{blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}],
  24: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  25: [{blockId:'m2',dir:'DOWN'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}],
  26: [{blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m1',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}],
  27: [{blockId:'m1',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}],
  28: [{blockId:'m1',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  29: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}],
  30: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}],
  31: [{blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}],
  32: [{blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m3',dir:'UP'}],
  33: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}],
  34: [{blockId:'m2',dir:'DOWN'}, {blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}],
  35: [{blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}],
  36: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  37: [{blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}],
  38: [{blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}],
  39: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}],
  40: [{blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'UP'}],
  41: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}],
  42: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}],
  43: [{blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}],
  44: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'UP'}],
  45: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}],
  46: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}],
  47: [{blockId:'m1',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}],
  48: [{blockId:'m1',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}],
  49: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}],
  50: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}],
  51: [{blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}],
  52: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'UP'}],
  53: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}],
  54: [{blockId:'m1',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}],
  55: [{blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}],
  56: [{blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m5',dir:'UP'}],
  57: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}],
  58: [{blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}],
  59: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}],
  60: [{blockId:'m1',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}],
  61: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}],
  62: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}],
  63: [{blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}],
  64: [{blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  65: [{blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m1',dir:'RIGHT'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}],
  66: [{blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}],
  67: [{blockId:'m1',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}],
  68: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'UP'}],
  69: [{blockId:'m1',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}],
  70: [{blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m1',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'DOWN'}],
  71: [{blockId:'m1',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m2',dir:'RIGHT'}, {blockId:'m2',dir:'UP'}, {blockId:'m2',dir:'LEFT'}, {blockId:'m2',dir:'DOWN'}, {blockId:'m2',dir:'LEFT'}],
  72: [{blockId:'m1',dir:'UP'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'DOWN'}, {blockId:'m3',dir:'RIGHT'}, {blockId:'m3',dir:'UP'}, {blockId:'m3',dir:'LEFT'}, {blockId:'m3',dir:'UP'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m2',dir:'UP'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'DOWN'}, {blockId:'m4',dir:'RIGHT'}, {blockId:'m4',dir:'UP'}, {blockId:'m4',dir:'LEFT'}, {blockId:'m4',dir:'UP'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'DOWN'}, {blockId:'m5',dir:'RIGHT'}, {blockId:'m5',dir:'UP'}, {blockId:'m5',dir:'LEFT'}, {blockId:'m5',dir:'UP'}],
  73: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  74: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  75: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  76: [{blockId:'m1',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'k1',dir:'UP'},{blockId:'k1',dir:'RIGHT'}],
  77: [{blockId:'m1',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'k1',dir:'UP'},{blockId:'k1',dir:'RIGHT'}],
  78: [{blockId:'m1',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'k1',dir:'UP'},{blockId:'k1',dir:'RIGHT'},{blockId:'k2',dir:'UP'},{blockId:'k2',dir:'RIGHT'}],
  79: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'UP'},{blockId:'m1',dir:'RIGHT'},{blockId:'m5',dir:'UP'},{blockId:'m5',dir:'LEFT'},{blockId:'m5',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m5',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'DOWN'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'UP'},{blockId:'m3',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'m5',dir:'RIGHT'},{blockId:'m4',dir:'LEFT'},{blockId:'m4',dir:'DOWN'},{blockId:'m4',dir:'RIGHT'},{blockId:'m4',dir:'UP'},{blockId:'m4',dir:'RIGHT'}],
  80: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m6',dir:'DOWN'},{blockId:'m6',dir:'LEFT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'UP'},{blockId:'m6',dir:'RIGHT'},{blockId:'m6',dir:'UP'},{blockId:'m1',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m6',dir:'LEFT'},{blockId:'m6',dir:'UP'},{blockId:'m2',dir:'LEFT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'DOWN'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'UP'},{blockId:'m3',dir:'RIGHT'},{blockId:'m4',dir:'LEFT'},{blockId:'m4',dir:'DOWN'},{blockId:'m4',dir:'RIGHT'},{blockId:'m4',dir:'UP'},{blockId:'m4',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'m5',dir:'RIGHT'},{blockId:'m6',dir:'DOWN'},{blockId:'m6',dir:'RIGHT'},{blockId:'m6',dir:'UP'},{blockId:'m6',dir:'RIGHT'}],
};

export function getSolution(id: number): SolutionMove[] {
  return SOLUTIONS[id] ?? [];
}

export function getLevel(id: number): LevelData {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))];
}

export const MAX_LEVEL_COLS = LEVELS.reduce((m, l) => Math.max(m, l.cols), 0);
export const MAX_LEVEL_ROWS = LEVELS.reduce((m, l) => Math.max(m, l.rows), 0);

export interface WorldPack {
  id: string;
  name: string;
  theme: string;
  levelIds: number[];
  unlockAfter: number;
}

export const PACKS: WorldPack[] = [
  { id: 'tutorial', name: 'Tutorial', theme: 'intro',     levelIds: LEVELS.filter(l => l.pack === 'tutorial').map(l => l.id), unlockAfter: 0 },
  { id: 'hook',     name: 'Hook',     theme: 'wow',       levelIds: LEVELS.filter(l => l.pack === 'hook').map(l => l.id),     unlockAfter: 6 },
  { id: 'gears',    name: 'Gears',    theme: 'dependent', levelIds: LEVELS.filter(l => l.pack === 'gears').map(l => l.id),    unlockAfter: 20 },
  { id: 'stones',   name: 'Stones',   theme: 'obstacle',  levelIds: LEVELS.filter(l => l.pack === 'stones').map(l => l.id),   unlockAfter: 40 },
  { id: 'master',   name: 'Master',   theme: 'mixed',     levelIds: LEVELS.filter(l => l.pack === 'master').map(l => l.id),   unlockAfter: 60 },
  { id: 'fixture',  name: 'Finale',   theme: 'boss',      levelIds: LEVELS.filter(l => l.pack === 'fixture').map(l => l.id),  unlockAfter: 75 },
];

export const FIXTURE_IDS = LEVELS.filter((l) => l.id >= 73).map((l) => l.id);

export function getPackOf(levelId: number): WorldPack | undefined {
  return PACKS.find((p) => p.levelIds.includes(levelId));
}

export function starsFor(parMoves: number, moves: number): 1 | 2 | 3 {
  if (moves <= parMoves) return 3;
  if (moves <= Math.ceil(parMoves * 1.4)) return 2;
  return 1;
}
