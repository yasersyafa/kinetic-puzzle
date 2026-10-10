import { createState, gameRules, type PuzzleState, type Action } from '../../../src/core/puzzle/GameRules';
import type { LevelData } from '../../../src/types/Game';
import type { SolverOptions } from '../core/SolverV2';
export interface GraphEdge {to:number;action:Action}
export interface StateGraph {states:PuzzleState[];edges:GraphEdge[][];winning:Set<number>;complete:boolean;reason?:string;parents:{from:number;action:Action}[]}
/** Reverse reachability proves losing states only after complete forward enumeration. */
export function exploreGraph(level:LevelData,budget:SolverOptions={}):StateGraph {
  const started=Date.now(),states=[createState(level)],edges:GraphEdge[][]=[[]],parents=[{from:-1,action:{blockId:'',dir:'UP'} as Action}];
  const depths=[0];
  const seen=new Map([[gameRules.serializeState(states[0]),0]]);let transitions=0,complete=true,reason:string|undefined;
  outer:for(let i=0;i<states.length;i++){
    if(Date.now()-started>=(budget.timeoutMs??5000)){complete=false;reason='TIMEOUT';break;}
    if(gameRules.isWin(states[i]))continue;
    if(depths[i]>=(budget.maxDepth??Infinity)){if(gameRules.getLegalActions(states[i]).length){complete=false;reason='maxDepth';}continue;}
    for(const action of gameRules.getLegalActions(states[i])){
      if(transitions++>=(budget.maxTransitions??2000000)){complete=false;reason='maxTransitions';break outer;}
      const next=gameRules.applyAction(states[i],action).state,key=gameRules.serializeState(next);let to=seen.get(key);
      if(to===undefined){if(states.length>=(budget.maxStates??5000)){complete=false;reason='maxStates';break outer;}to=states.length;seen.set(key,to);states.push(next);depths.push(depths[i]+1);edges.push([]);parents.push({from:i,action});}
      edges[i].push({to,action});
    }
  }
  const reverse:number[][]=states.map(()=>[]);edges.forEach((es,i)=>es.forEach(e=>reverse[e.to].push(i)));
  const queue:number[]=[];states.forEach((s,i)=>{if(gameRules.isWin(s))queue.push(i);});const winning=new Set(queue);
  for(let i=0;i<queue.length;i++)for(const p of reverse[queue[i]])if(!winning.has(p)){winning.add(p);queue.push(p);}
  return {states,edges,parents,winning,complete,reason};
}
export function graphPath(graph:StateGraph,index:number):Action[]{const path:Action[]=[];while(graph.parents[index].from!==-1){path.push(graph.parents[index].action);index=graph.parents[index].from;}return path.reverse();}
