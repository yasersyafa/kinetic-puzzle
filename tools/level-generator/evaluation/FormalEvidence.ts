import { createState, gameRules, type PuzzleState, type Action } from '../../../src/core/puzzle/GameRules';
import type { LevelData } from '../../../src/types/Game';
import { solve, type SolverOptions, type SolverResult } from '../core/SolverV2';
import type { EvidenceSpec } from '../director/DesignContract';
import { exploreGraph,graphPath } from './StateGraph';
export interface FormalEvidence {actionDomain:'SWIPES_ONLY';id:string;claim:string;scope:string;definition:string;status:'VERIFIED'|'NOT_VERIFIED'|'UNKNOWN';traceSteps:number[];counterexample?:Action[];witness?:Action[];reason?:string;visitedStates:number}
export function verifyEvidence(level:LevelData,result:SolverResult,spec:EvidenceSpec,budget:SolverOptions):FormalEvidence {
  const base:FormalEvidence={actionDomain:'SWIPES_ONLY',id:spec.id,claim:spec.claim,scope:spec.scope,definition:`${spec.scope}: ${spec.claim}`,status:'UNKNOWN',traceSteps:[],visitedStates:0};
  const definitions:Partial<Record<EvidenceSpec['claim'],string>>={'sliding-required':'Every winning path includes displacement greater than zero','forced-positioning':'Every winning path reaches the requested noninitial position','dependency-chain':'Every winning path exits the specified dependency chain in order','multi-step-planning':'Every winning path uses at least the requested number of nonexit actions on the selected blocks','false-opportunity':'Complete graph contains a reachable choice with winning and losing successors','dead-end-avoidance':'Complete graph contains a reachable choice with winning and losing successors'};
  base.definition=definitions[spec.claim]??base.definition;
  if(result.status!=='SOLVED'||!result.solutionPath)return {...base,reason:'No verified winning path'};
  if(spec.blockIds?.some(id=>!level.blocks.some(b=>b.id===id)))return {...base,status:'NOT_VERIFIED',reason:'Unknown evidence block reference'};
  if(spec.position&&(spec.position[0]>=level.cols||spec.position[1]>=level.rows))return {...base,status:'NOT_VERIFIED',reason:'Evidence position outside grid'};
  if(spec.claim==='dependency-chain'&&spec.blockIds!.slice(1).some((id,i)=>level.blocks.find(b=>b.id===id)?.dependsOn!==spec.blockIds![i]))return {...base,status:'NOT_VERIFIED',reason:'Claimed dependency chain does not exist'};
  if(spec.scope==='COUNTERFACTUAL_EFFECT'){
    base.definition='Relaxing a selected constraint reduces proven optimal cost or enables a winning path forbidden by that constraint';
    const kind=spec.claim==='direction-interaction'?'constrained':spec.claim==='lock-planning'?'lock':'dependent';
    const selected=level.blocks.filter(b=>b.type===kind&&(!spec.blockIds||spec.blockIds.includes(b.id)));
    base.traceSteps=result.solutionPath.flatMap((action,index)=>selected.some(b=>b.id===action.blockId)?[index]:[]);
    if(!selected.length)return {...base,status:'NOT_VERIFIED',reason:'No targeted sequencing/direction constraint'};
    const relaxed={...level,blocks:level.blocks.map(b=>selected.includes(b)?{...b,type:'simple' as const,direction:undefined,dependsOn:undefined,unlockAt:undefined}:b)};
    // A witnessed relaxed winning path is sufficient; proving a relaxed optimum is optional.
    // Try inserting a forbidden action into the verified path before expanding a graph.
    const witnessStarted=Date.now();let prefixState=createState(relaxed),witnessVisits=1;
    const prefix:Action[]=[];
    for(let index=0;index<result.solutionPath.length;index++){
      for(const action of gameRules.getLegalActions(prefixState)){
        if(Date.now()-witnessStarted>=(budget.timeoutMs??5000))return {...base,visitedStates:witnessVisits,reason:'TIMEOUT'};
        if(witnessVisits>=(budget.maxStates??200000)||witnessVisits-1>=(budget.maxTransitions??2000000))return {...base,visitedStates:witnessVisits,reason:'maxStates'};
        const originalState={...prefixState,blocks:prefixState.blocks.map(b=>{const original=level.blocks.find(x=>x.id===b.blockId)!;return {...b,type:original.type??'simple',direction:original.direction,dependsOn:original.dependsOn,unlockAt:original.unlockAt??0};})};
        if(gameRules.applyAction(originalState,action).result.kind!=='invalid')continue;
        let next=gameRules.applyAction(prefixState,action).state;const path=[...prefix,action];let valid=true;witnessVisits++;
        for(const continuation of result.solutionPath.slice(index)){
          if(next.blocks.find(b=>b.blockId===continuation.blockId)?.removed)continue;
          if(witnessVisits>=(budget.maxStates??200000)||path.length>=(budget.maxTransitions??2000000)){valid=false;break;}
          const t=gameRules.applyAction(next,continuation);witnessVisits++;if(t.result.kind==='invalid'){valid=false;break;}next=t.state;path.push(continuation);
        }
        if(valid&&gameRules.isWin(next))return {...base,status:'VERIFIED',visitedStates:witnessVisits,counterexample:path,reason:'Replayed relaxed winning path includes an action forbidden by the original constraint'};
      }
      const action=result.solutionPath[index];prefix.push(action);prefixState=gameRules.applyAction(prefixState,action).state;
    }
    budget={...budget,timeoutMs:Math.max(0,(budget.timeoutMs??5000)-(Date.now()-witnessStarted)),maxStates:Math.max(0,(budget.maxStates??200000)-witnessVisits)};
    const counter=solve(relaxed,{...budget,maxStates:Math.min(500,budget.maxStates??200000),timeoutMs:Math.min(500,budget.timeoutMs??5000)});
    base.visitedStates=counter.visitedStates;
    if(counter.status==='SOLVED'&&counter.optimalMoves!<result.optimalMoves!)return {...base,status:'VERIFIED',counterexample:counter.solutionPath,reason:'Constraint relaxation strictly reduces proven optimum'};
    // Same optimum may still hide meaningful sequencing: find a relaxed winning path
    // with an action forbidden by the original constraint, preserving monitor history.
    const nodes:{state:PuzzleState;used:boolean;parent:number;action?:Action;depth:number}[]=[{state:createState(relaxed),used:false,parent:-1,depth:0}];
    const seen=new Set<string>(),started=Date.now();let transitions=0,truncated=false;
    const frontier=[0];
    while(frontier.length){
      const head=frontier.pop()!;
      if(Date.now()-started>=(budget.timeoutMs??5000))return {...base,visitedStates:nodes.length,reason:'TIMEOUT'};
      const node=nodes[head];
      if(gameRules.isWin(node.state)&&node.used){
        const path:Action[]=[];let i=head;while(nodes[i].parent!==-1){path.push(nodes[i].action!);i=nodes[i].parent;}
        return {...base,status:'VERIFIED',visitedStates:nodes.length,counterexample:path.reverse(),reason:'Relaxation enables a winning path forbidden by the original constraint'};
      }
      if(gameRules.isWin(node.state))continue;
      if(node.depth>=(budget.maxDepth??Infinity)){truncated=true;continue;}
      for(const action of gameRules.getLegalActions(node.state)){
        if(transitions++>=(budget.maxTransitions??2000000))return {...base,visitedStates:nodes.length,reason:'maxTransitions'};
        const originalState={...node.state,blocks:node.state.blocks.map(b=>{const original=level.blocks.find(x=>x.id===b.blockId)!;return {...b,type:original.type??'simple',direction:original.direction,dependsOn:original.dependsOn,unlockAt:original.unlockAt??0};})};
        const used=node.used||gameRules.applyAction(originalState,action).result.kind==='invalid';
        const next=gameRules.applyAction(node.state,action).state,key=`${gameRules.serializeState(next)}|relaxed:${used}`;
        if(seen.has(key))continue;if(nodes.length>=(budget.maxStates??200000))return {...base,visitedStates:nodes.length,reason:'maxStates'};
        seen.add(key);nodes.push({state:next,used,parent:head,action,depth:node.depth+1});frontier.push(nodes.length-1);
      }
    }
    return {...base,status:truncated?'UNKNOWN':'NOT_VERIFIED',visitedStates:nodes.length,reason:truncated?'maxDepth':'Relaxation does not change winning paths or optimal cost'};
  }
  if(spec.scope==='EXISTS_REACHABLE_TRAP'){
    const graph=exploreGraph(level,budget);base.visitedStates=graph.states.length;
    if(!graph.complete)return {...base,reason:`Incomplete reachable graph: ${graph.reason}`};
    const index=graph.edges.findIndex((es,i)=>graph.winning.has(i)&&es.some(e=>!graph.winning.has(e.to)&&(!spec.blockIds||spec.blockIds.includes(e.action.blockId)))&&es.some(e=>graph.winning.has(e.to)));
    if(index<0)return {...base,status:'NOT_VERIFIED',reason:'No reachable choice between provably winning and losing successors'};
    const trap=graph.edges[index].find(e=>!graph.winning.has(e.to)&&(!spec.blockIds||spec.blockIds.includes(e.action.blockId)))!;
    return {...base,status:'VERIFIED',witness:graphPath(graph,index),counterexample:[...graphPath(graph,index),trap.action],reason:'Complete graph proves reachable trap and winning alternative'};
  }
  const occurs=(s:PuzzleState,a?:Action,next=s):boolean=>{
    if(spec.claim==='forced-positioning'){const b=next.blocks.find(b=>b.blockId===spec.blockIds![0]);return !!b&&!b.removed&&b.gridPos[0]===spec.position![0]&&b.gridPos[1]===spec.position![1];}
    if(!a)return false;
    const t=gameRules.applyAction(s,a);
    if(spec.blockIds&&!spec.blockIds.includes(a.blockId)&&!['dependency-chain','multi-step-planning'].includes(spec.claim))return false;
    if(spec.claim==='sliding-required')return t.result.kind!=='invalid'&&t.result.distance>0;
    if(spec.claim==='ice-push')return t.trace.icePush;
    if(spec.claim==='block-as-stopper'||spec.claim==='obstacle-interaction')return !!t.trace.stopperId&&(spec.claim==='obstacle-interaction'||!t.trace.icePush)&&(s.blocks.find(b=>b.blockId===t.trace.stopperId)?.type==='obstacle')===(spec.claim==='obstacle-interaction');
    return false;
  };
  // Monitor state is included in the key: histories with different progress never merge.
  type Node={state:PuzzleState;progress:number;parent:number;action?:Action;depth:number};
  const start=createState(level);
  if(spec.claim==='forced-positioning'&&occurs(start))return {...base,status:'NOT_VERIFIED',reason:'Position already holds initially; forced repositioning is not established'};
  const nodes:Node[]=[{state:start,progress:occurs(start)?1:0,parent:-1,depth:0}],seen=new Set<string>();
  const target=spec.claim==='dependency-chain'?spec.blockIds!.length:spec.claim==='multi-step-planning'?spec.minSteps!:1;
  const started=Date.now();let transitions=0,truncated=false;
  const progress=(node:Node,a:Action,next:PuzzleState):number=>{
    if(spec.claim==='dependency-chain')return Math.min(target,node.progress+(a.blockId===spec.blockIds![node.progress]&&next.blocks.find(b=>b.blockId===a.blockId)?.removed?1:0));
    if(spec.claim==='multi-step-planning')return Math.min(target,node.progress+(spec.blockIds!.includes(a.blockId)&&!next.blocks.find(b=>b.blockId===a.blockId)?.removed?1:0));
    return Math.max(node.progress,occurs(node.state,a,next)?1:0);
  };
  let replayNode=nodes[0];result.solutionPath.forEach((a,i)=>{const next=gameRules.applyAction(replayNode.state,a).state,p=progress(replayNode,a,next);if(p>replayNode.progress)base.traceSteps.push(i);replayNode={state:next,progress:p,parent:-1,depth:i+1};});
  if(replayNode.progress<target)return {...base,status:'NOT_VERIFIED',counterexample:result.solutionPath,reason:'Verified winning path avoids the required interaction'};
  for(let head=0;head<nodes.length;head++){
    if(Date.now()-started>=(budget.timeoutMs??5000))return {...base,visitedStates:nodes.length,reason:'TIMEOUT'};
    const node=nodes[head];
    if(gameRules.isWin(node.state)){
      if(node.progress<target){const path:Action[]=[];let i=head;while(nodes[i].parent!==-1){path.push(nodes[i].action!);i=nodes[i].parent;}return {...base,status:'NOT_VERIFIED',visitedStates:nodes.length,counterexample:path.reverse()};}continue;
    }
    if(node.progress>=target)continue;
    if(node.depth>=(budget.maxDepth??Infinity)){truncated=true;continue;}
    for(const action of gameRules.getLegalActions(node.state)){
      if(transitions++>=(budget.maxTransitions??2000000))return {...base,visitedStates:nodes.length,reason:'maxTransitions'};
      const next=gameRules.applyAction(node.state,action).state,p=progress(node,action,next),key=`${gameRules.serializeState(next)}|monitor:${p}`;
      if(p>=target)continue;
      if(seen.has(key))continue;
      if(nodes.length>=(budget.maxStates??200000))return {...base,visitedStates:nodes.length,reason:'maxStates'};
      seen.add(key);nodes.push({state:next,progress:p,parent:head,action,depth:node.depth+1});
    }
  }
  return {...base,status:truncated?'UNKNOWN':'VERIFIED',visitedStates:nodes.length,reason:truncated?'maxDepth':'Exhausted augmented graph; no avoiding winning path'};
}
