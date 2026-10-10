import { performance } from 'node:perf_hooks';
import { createState, gameRules, type Action, type PuzzleState } from '../../../src/core/puzzle/GameRules';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
import type { LevelData } from '../../../src/types/Game';
export const SOLVER_VERSION = '1.0.0';
export type SolverStatus = 'SOLVED' | 'UNSOLVABLE' | 'TIMEOUT' | 'RESOURCE_LIMIT' | 'ERROR';
export interface SolverOptions {
  maxStates?: number; maxTransitions?: number; timeoutMs?: number; maxDepth?: number;
  // A predicate excludes transitions for counterexample search; only complete exhaustion proves evidence.
  allowTransition?: (state: PuzzleState, action: Action, next: PuzzleState) => boolean;
}
export interface SolverResult {
  status: SolverStatus; optimalMoves?: number; solutionPath?: Action[]; optimalityProven: boolean;
  visitedStates: number; exploredTransitions: number; elapsedMs: number; solverVersion: string; reason?: string;
}
export function solve(level: LevelData, options: SolverOptions = {}): SolverResult {
  const started = performance.now(); let exploredTransitions = 0;
  const maxStates = options.maxStates ?? 200000, maxTransitions = options.maxTransitions ?? 2000000;
  const timeout = options.timeoutMs ?? 5000, maxDepth = options.maxDepth ?? Infinity;
  const nodes: { state: PuzzleState; parent: number; action?: Action; depth: number }[] = [];
  const finish = (status: SolverStatus, reason?: string, index?: number): SolverResult => {
    const result: SolverResult = { status,reason,visitedStates:nodes.length,exploredTransitions,
      elapsedMs:performance.now()-started,solverVersion:SOLVER_VERSION,optimalityProven:status === 'SOLVED' };
    if (index !== undefined) {
      const path: Action[] = []; let cursor = index;
      while (nodes[cursor].parent !== -1) { path.push(nodes[cursor].action!); cursor = nodes[cursor].parent; }
      result.solutionPath = path.reverse(); result.optimalMoves = path.length;
    }
    return result;
  };
  if (validateLevel(level).length) return finish('ERROR','Invalid level schema');
  if (![maxStates,maxTransitions,timeout].every(v => Number.isFinite(v) && v >= 0) || !(maxDepth >= 0)) return finish('ERROR','Invalid solver budget');
  if (maxStates < 1) return finish('RESOURCE_LIMIT','maxStates');
  nodes.push({ state:createState(level),parent:-1,depth:0 });
  // Static level data is shared across nodes; dynamic keys preserve block identity.
  const key = (s: PuzzleState) => `${s.exitCount}|${s.blocks.map(b => b.removed ? 'X' : b.gridPos.join(',')).join('|')}`;
  const seen = new Set([key(nodes[0].state)]); let depthTruncated = false;
  for (let head = 0; head < nodes.length; head++) {
    if (performance.now()-started >= timeout) return finish('TIMEOUT','timeoutMs');
    const node = nodes[head]; if (gameRules.isWin(node.state)) return finish('SOLVED',undefined,head);
    const actions = gameRules.getLegalActions(node.state);
    if (node.depth >= maxDepth) { if (actions.length) depthTruncated = true; continue; }
    for (const action of actions) {
      if (performance.now()-started >= timeout) return finish('TIMEOUT','timeoutMs');
      if (exploredTransitions >= maxTransitions) return finish('RESOURCE_LIMIT','maxTransitions');
      exploredTransitions++;
      const next = gameRules.applyAction(node.state,action).state;
      if (options.allowTransition && !options.allowTransition(node.state,action,next)) continue;
      const signature = key(next); if (seen.has(signature)) continue;
      if (nodes.length >= maxStates) return finish('RESOURCE_LIMIT','maxStates');
      seen.add(signature); nodes.push({ state:next,parent:head,action,depth:node.depth+1 });
    }
  }
  return depthTruncated ? finish('RESOURCE_LIMIT','maxDepth') : finish('UNSOLVABLE');
}
