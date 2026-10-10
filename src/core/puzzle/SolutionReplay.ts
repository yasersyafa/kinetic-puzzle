import { createState, gameRules, type Action, type PuzzleState, type TransitionResult } from './GameRules';
import type { LevelData } from '../../types/Game';
export interface ReplayResult { success: boolean; state: PuzzleState; failedAction?: number; reason?: string; transitions: TransitionResult[] }
export function replaySolution(level: LevelData, path: readonly Action[]): ReplayResult {
  let state = createState(level); const transitions: TransitionResult[] = [];
  for (let i = 0; i < path.length; i++) {
    const transition = gameRules.applyAction(state,path[i]);
    if (transition.result.kind === 'invalid') return { success:false,state,failedAction:i,reason:transition.result.reason,transitions };
    transitions.push(transition); state = transition.state;
  }
  return { success:gameRules.isWin(state),state,transitions,reason:gameRules.isWin(state) ? undefined : 'Final state is not a win' };
}
