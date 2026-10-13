import { generateCandidate, type Candidate } from './generation/CandidateGenerator';
import type { LevelDesignContract } from './director/DesignContract';
import { buildConnectedStage } from './stage-two-build';
import { stageThreeContracts } from './stage-curriculum';
import { createState, gameRules, type Action } from '../../src/core/puzzle/GameRules';
import type { LevelData } from '../../src/types/Game';

export function stageThreeCandidate(contract: LevelDesignContract, id: number, seed: number, attempt: number): Candidate {
  const candidate = generateCandidate(contract, id, seed, attempt);
  candidate.level.pack = 'stage-3';
  return candidate;
}

/** A recorded shortest solution parks an actor farther from the exit, then uses it again. */
export function hasTemporaryParking(level: LevelData, path: Action[]): boolean {
  const exit = level.exits[0];
  const target = exit.side === 'TOP' ? [exit.index, -1] : exit.side === 'BOTTOM' ? [exit.index, level.rows]
    : exit.side === 'LEFT' ? [-1, exit.index] : [level.cols, exit.index];
  const distance = (position: readonly number[]) => Math.abs(position[0] - target[0]) + Math.abs(position[1] - target[1]);
  let state = createState(level);
  for (const [index, action] of path.entries()) {
    const before = state.blocks.find(b => b.blockId === action.blockId)!;
    const transition = gameRules.applyAction(state, action);
    const after = transition.state.blocks.find(b => b.blockId === action.blockId)!;
    if (transition.result.kind === 'slide' && distance(after.gridPos) > distance(before.gridPos)
      && path.slice(index + 1).some(next => next.blockId === action.blockId)) return true;
    state = transition.state;
  }
  return false;
}

if (process.argv[1]?.endsWith('stage-three-build.ts')) buildConnectedStage({
  number: 3, name: 'Precision', seed: '20261014', output: 'generated/runs/stage-three',
  base: 'generated/runs/stage-two/approved/kinetic-stages-1a7993503381-445ff8f460ac/campaign.json',
  contracts: stageThreeContracts, candidate: stageThreeCandidate,
  acceptsSolution: (candidate, path) => !candidate.contract.requiredEvidence!.some(e => e.claim === 'multi-step-planning')
    || hasTemporaryParking(candidate.level, path),
}).catch(error => { console.error(error); process.exitCode = 1; });
