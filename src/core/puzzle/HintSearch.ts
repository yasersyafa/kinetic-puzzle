import { createState, gameRules, type Action, type PuzzleState } from './GameRules';
import type { LevelData } from '../../types/Game';
/** Reuse the exported winning path when the current board matches a replay prefix. */
export function hintFromSolution(current: PuzzleState, level: LevelData, path: readonly Action[], maxDepth = Infinity): Action | undefined {
  let state = createState(level), hint: Action | undefined;
  const currentKey = gameRules.serializeState(current);
  for (let i = 0; i < path.length; i++) {
    if (gameRules.serializeState(state) === currentKey && path.length - i <= maxDepth) hint = path[i];
    const transition = gameRules.applyAction(state, path[i]);
    if (transition.result.kind === 'invalid') return;
    state = transition.state;
  }
  return gameRules.isWin(state) ? hint : undefined;
}
export async function findHint(initial: PuzzleState, maxDepth = Infinity, cancelled = () => false): Promise<Action | undefined> {
  const nodes: { state: PuzzleState; first?: Action; depth: number }[] = [{ state: initial, depth: 0 }];
  const key = (s: PuzzleState) => `${s.exitCount}|${s.blocks.map(b => b.removed ? 'X' : b.gridPos.join(',')).join('|')}`;
  const seen = new Set([key(initial)]), started = performance.now();
  for (let head = 0; head < nodes.length; head++) {
    if (head % 100 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); if (cancelled() || performance.now() - started > 1500) return; }
    const node = nodes[head];
    if (gameRules.isWin(node.state)) return node.first;
    if (node.depth >= maxDepth) continue;
    for (const action of gameRules.getLegalActions(node.state)) {
      const state = gameRules.applyAction(node.state, action).state, signature = key(state);
      if (seen.has(signature)) continue;
      if (nodes.length >= 30000) return;
      seen.add(signature); nodes.push({ state, depth: node.depth + 1, first: node.first ?? action });
    }
  }
}
