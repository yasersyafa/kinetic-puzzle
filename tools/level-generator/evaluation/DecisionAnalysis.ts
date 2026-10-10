import type { LevelData } from '../../../src/types/Game';
import { gameRules } from '../../../src/core/puzzle/GameRules';
import { exploreGraph } from './StateGraph';
import type { SolverOptions } from '../core/SolverV2';
export interface DecisionAnalysis {trapScope?:'REACHABLE_WINNING_STATES';status:'VERIFIED'|'UNKNOWN';states:number;optimalMoves?:number;decisionPoints?:number;prematureExitTraps?:number;initialOptimalActionFraction?:number;reason?:string}
/** Measures choices on a deterministic shortest path, not perceived human difficulty. */
export function analyzeDecisions(level:LevelData,budget:SolverOptions={},trapScope?:'REACHABLE_WINNING_STATES'):DecisionAnalysis {
  const graph=exploreGraph(level,budget);
  if(!graph.complete)return {status:'UNKNOWN',states:graph.states.length,reason:graph.reason};
  const reverse:number[][]=graph.states.map(()=>[]),distance=graph.states.map(()=>Infinity),queue:number[]=[];
  graph.edges.forEach((edges,i)=>edges.forEach(e=>reverse[e.to].push(i)));
  graph.states.forEach((s,i)=>{if(gameRules.isWin(s)){distance[i]=0;queue.push(i);}});
  for(let i=0;i<queue.length;i++)for(const from of reverse[queue[i]])if(distance[from]===Infinity){distance[from]=distance[queue[i]]+1;queue.push(from);}
  if(!Number.isFinite(distance[0]))return {status:'VERIFIED',states:graph.states.length,reason:'UNSOLVABLE'};
  let current=0,previous=-1,decisionPoints=0,prematureExitTraps=0;
  while(distance[current]>0){
    const edges=graph.edges[current],best=edges.filter(e=>distance[e.to]===distance[current]-1);
    // Count different successor states, excluding immediately reversing the previous move.
    const worse=edges.filter(e=>e.to!==previous&&distance[e.to]>=distance[current]);
    if(best.length&&worse.length)decisionPoints++;
    prematureExitTraps+=edges.filter(e=>!Number.isFinite(distance[e.to])&&gameRules.applyAction(graph.states[current],e.action).result.kind==='exit').length;
    previous=current;current=best[0].to;
  }
  if(trapScope==='REACHABLE_WINNING_STATES')prematureExitTraps=graph.edges.reduce((sum,edges,i)=>sum+(Number.isFinite(distance[i])?edges.filter(e=>!Number.isFinite(distance[e.to])&&gameRules.applyAction(graph.states[i],e.action).result.kind==='exit').length:0),0);
  return {status:'VERIFIED',...(trapScope?{trapScope}:{}),states:graph.states.length,optimalMoves:distance[0],decisionPoints,prematureExitTraps,initialOptimalActionFraction:graph.edges[0].filter(e=>distance[e.to]===distance[0]-1).length/Math.max(1,graph.edges[0].length)};
}
