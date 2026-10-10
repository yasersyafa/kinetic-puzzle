import type { BlockType, LevelData } from '../../types/Game';

export type MoveBudget = { mode: 'UNLIMITED' } | { mode: 'OPTIMAL_PLUS'; extraMoves: number };
export interface StageDefinition {
  id: string;
  number: number;
  name: string;
  firstLevel: number;
  levelCount: number;
  allowedBlockTypes: BlockType[];
  moveBudget: MoveBudget;
}
export interface CampaignStages {
  targetLevels: number;
  batchSize: number;
  stages: StageDefinition[];
}
export type AttemptResult = 'WIN' | 'MOVE_LIMIT' | 'STUCK';

export function stageDefinition(number: number): StageDefinition {
  if (!Number.isInteger(number) || number < 1 || number > 50) throw new Error('Stage number must be between 1 and 50');
  return {
    id: `stage-${number}`, number, name: number === 1 ? 'First Steps' : number === 2 ? 'Connections' : number === 3 ? 'Precision' : `Mastery ${number - 3}`,
    firstLevel: (number - 1) * 20 + 1, levelCount: 20,
    allowedBlockTypes: number === 1 ? ['simple', 'constrained', 'obstacle'] : ['simple', 'constrained', 'obstacle', 'dependent', 'lock'],
    moveBudget: number === 1 ? { mode: 'UNLIMITED' } : { mode: 'OPTIMAL_PLUS', extraMoves: number === 2 ? 2 : number === 3 ? 1 : 0 },
  };
}
export const INITIAL_STAGES: CampaignStages = { targetLevels: 1000, batchSize: 20, stages: [1, 2, 3, 4].map(stageDefinition) };
export function stageOf(stages: readonly StageDefinition[], levelId: number): StageDefinition | undefined {
  return stages.find(s => levelId >= s.firstLevel && levelId < s.firstLevel + s.levelCount);
}
export function moveLimit(stage: StageDefinition | undefined, provenOptimal: number): number | undefined {
  return stage?.moveBudget.mode === 'OPTIMAL_PLUS' ? provenOptimal + stage.moveBudget.extraMoves : undefined;
}
/** Resolve after a valid transition settles: winning on the final allowed move succeeds. */
export function resolveAttempt(won: boolean, moves: number, limit: number | undefined, hasLegalMove: boolean): AttemptResult | undefined {
  if (won) return 'WIN';
  if (limit !== undefined && moves >= limit) return 'MOVE_LIMIT';
  if (!hasLegalMove) return 'STUCK';
}
export function validateStages(config: CampaignStages, levels: readonly LevelData[]): string[] {
  const errors: string[] = [];
  if (!config || config.batchSize !== 20 || !Number.isInteger(config.targetLevels) || config.targetLevels < 20 || config.targetLevels > 1000 || config.targetLevels % 20 || !Array.isArray(config.stages) || !config.stages.length || config.stages.length * 20 > config.targetLevels) return ['Invalid stage configuration'];
  const ids = new Set<string>();
  config.stages.forEach((s, i) => {
    if (!s || typeof s !== 'object') { errors.push(`Invalid stage ${i + 1}`); return; }
    if (s.number !== i + 1 || s.id !== `stage-${i + 1}` || ids.has(s.id) || s.firstLevel !== i * 20 + 1 || s.levelCount !== 20 || typeof s.name !== 'string' || !s.name.trim()) errors.push(`Invalid stage ${i + 1}`);
    ids.add(s?.id);
    if (!s?.moveBudget || !['UNLIMITED', 'OPTIMAL_PLUS'].includes(s.moveBudget.mode) || (s.moveBudget.mode === 'OPTIMAL_PLUS' && (!Number.isInteger(s.moveBudget.extraMoves) || s.moveBudget.extraMoves < 0))) errors.push(`Invalid move budget for stage ${i + 1}`);
    if (!Array.isArray(s?.allowedBlockTypes) || !s.allowedBlockTypes.length || s.allowedBlockTypes.some(t => !['simple','constrained','obstacle','dependent','lock'].includes(t))) errors.push(`Invalid mechanics for stage ${i + 1}`);
    const expected = stageDefinition(i + 1);
    if (s.moveBudget?.mode !== expected.moveBudget.mode || (s.moveBudget?.mode === 'OPTIMAL_PLUS' && expected.moveBudget.mode === 'OPTIMAL_PLUS' && s.moveBudget.extraMoves !== expected.moveBudget.extraMoves)) errors.push(`Stage ${i + 1}: move policy differs from product progression`);
    if (Array.isArray(s.allowedBlockTypes) && s.allowedBlockTypes.some(t => !expected.allowedBlockTypes.includes(t))) errors.push(`Stage ${i + 1}: mechanic introduced too early`);
    const contained = levels.filter(l => l.id >= s?.firstLevel && l.id < s?.firstLevel + s?.levelCount);
    if (contained.length && contained.length !== 20) errors.push(`Stage ${i + 1} must publish a complete batch of 20`);
    for (const l of contained) {
      if (l.pack !== s.id || l.exits.length !== 1 || l.iceCells?.length || l.blocks.some(b => !s.allowedBlockTypes?.includes(b.type ?? 'simple'))) errors.push(`L${l.id}: stage mechanics/exit/pack mismatch`);
      if (!Number.isInteger(l.parMoves) || l.parMoves < 1) errors.push(`L${l.id}: invalid proven optimum`);
    }
  });
  if (errors.length) return errors;
  if (levels.length > config.targetLevels || levels.some((l, i) => l.id !== i + 1 || !stageOf(config.stages, l.id))) errors.push('Invalid staged campaign positions');
  return errors;
}
