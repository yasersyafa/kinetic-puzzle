import { createState, gameRules, DIRECTIONS, type Action, type PuzzleState } from '../../../src/core/puzzle/GameRules';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
import type { LevelData } from '../../../src/types/Game';
import type { SolverOptions } from '../core/SolverV2';
export const PROPOSAL_SEARCH_VERSION = '1.0.0';
export interface ProposalSearchResult {
  status: 'FOUND' | 'NOT_FOUND' | 'TIMEOUT' | 'RESOURCE_LIMIT' | 'ERROR';
  path?: Action[]; visitedStates: number; exploredTransitions: number; reason?: string;
}
/** Prioritize fewer remaining exits/alignment moves. This proposes a path; BFS remains the approval authority. */
export function findProposalSolution(level: LevelData, budget: SolverOptions = {}): ProposalSearchResult {
  if (validateLevel(level).length) return { status: 'ERROR', visitedStates: 0, exploredTransitions: 0, reason: 'Invalid level' };
  const maxStates = budget.maxStates ?? 30000, maxTransitions = budget.maxTransitions ?? 400000, timeout = budget.timeoutMs ?? 3000, maxDepth = budget.maxDepth ?? Infinity;
  if (![maxStates,maxTransitions,timeout].every(n=>Number.isFinite(n)&&n>=0) || !(maxDepth>=0)) return {status:'ERROR',visitedStates:0,exploredTransitions:0,reason:'Invalid proposal budget'};
  const exit = level.exits.length === 1 ? level.exits[0] : undefined;
  const vertical = exit?.side === 'TOP' || exit?.side === 'BOTTOM';
  const heuristic = (s: PuzzleState) => s.blocks.filter(b=>!b.removed&&b.type!=='obstacle').reduce((n,b)=>n+1+Number(!!exit&&(vertical?b.gridPos[0]:b.gridPos[1])!==exit.index),0);
  const key = (s: PuzzleState) => `${s.exitCount}|${s.blocks.map(b=>b.removed?'X':b.gridPos.join(',')).join('|')}`;
  interface Node {state:PuzzleState;g:number;h:number;f:number;parent:number;action?:Action}
  const initial = createState(level), h = heuristic(initial), nodes:Node[]=[{state:initial,g:0,h,f:h,parent:-1}], heap:number[]=[], best = new Map([[key(initial),0]]);
  let exploredTransitions=0,depthTruncated=false;const started=performance.now();
  const result = (status:ProposalSearchResult['status'],reason?:string,index?:number):ProposalSearchResult => {
    const output:ProposalSearchResult={status,reason,visitedStates:best.size,exploredTransitions};
    if(index!==undefined){const path:Action[]=[];while(nodes[index].parent!==-1){path.push(nodes[index].action!);index=nodes[index].parent;}output.path=path.reverse();}return output;
  };
  if(maxStates<1)return result('RESOURCE_LIMIT','maxStates');
  const less=(a:number,b:number)=>nodes[a].f<nodes[b].f||nodes[a].f===nodes[b].f&&(nodes[a].h<nodes[b].h||nodes[a].h===nodes[b].h&&a<b);
  const push=(index:number)=>{heap.push(index);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const index=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],heap[i]))break;[heap[c],heap[i]]=[heap[i],heap[c]];i=c;}}return index;};
  push(0);
  while(heap.length){
    if(performance.now()-started>=timeout)return result('TIMEOUT','timeoutMs');
    const index=pop(),node=nodes[index];if(best.get(key(node.state))!==node.g)continue;
    if(gameRules.isWin(node.state))return result('FOUND',undefined,index);
    if(node.g>=maxDepth){if(gameRules.getLegalActions(node.state).length)depthTruncated=true;continue;}
    for(const block of node.state.blocks){if(block.removed||block.type==='obstacle')continue;for(const dir of DIRECTIONS){
      if(exploredTransitions>=maxTransitions)return result('RESOURCE_LIMIT','maxTransitions');exploredTransitions++;
      const action:Action={blockId:block.blockId,dir},transition=gameRules.applyAction(node.state,action);if(transition.result.kind==='invalid')continue;
      if(budget.allowTransition&&!budget.allowTransition(node.state,action,transition.state))continue;
      const signature=key(transition.state),g=node.g+1;if((best.get(signature)??Infinity)<=g)continue;
      if(!best.has(signature)&&best.size>=maxStates)return result('RESOURCE_LIMIT','maxStates');
      best.set(signature,g);const h=heuristic(transition.state);nodes.push({state:transition.state,g,h,f:g+h,parent:index,action});push(nodes.length-1);
    }}
  }
  return depthTruncated?result('RESOURCE_LIMIT','maxDepth'):result('NOT_FOUND');
}
