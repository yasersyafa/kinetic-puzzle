import { productErrors } from '../generation/ProductPolicy';
import { analyzeDecisions,type DecisionAnalysis } from './DecisionAnalysis';
import type { LevelData } from '../../../src/types/Game';
import { createState, gameRules } from '../../../src/core/puzzle/GameRules';
import { replaySolution } from '../../../src/core/puzzle/SolutionReplay';
import { solve, type SolverOptions, type SolverResult } from '../core/SolverV2';
import { mechanicsOf, validateContract, type LevelDesignContract, type EvidenceClaim } from '../director/DesignContract';
import { evaluateDiversity, solutionPattern,solutionPatternSimilarity,type DiversityAnalysis } from './DiversityEvaluator';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
import { createEvaluationContext,validateContext,DEFAULT_MODEL,EVALUATION_VERSION,type EvaluationContext } from './EvaluationContext';
import { verifyEvidence,type FormalEvidence } from './FormalEvidence';
import { predictRating } from '../analytics/Calibration';
import { exploreGraph } from './StateGraph';
export const EVALUATOR_VERSION=EVALUATION_VERSION;
export interface MechanicEvidence { actionDomain?:'SWIPES_ONLY';claim:EvidenceClaim; status:'VERIFIED'|'NOT_VERIFIED'|'UNKNOWN'; definition:string; traceSteps:number[]; counterexample?:import('../../../src/core/puzzle/GameRules').Action[]; reason?:string }
export function evaluateMechanic(level:LevelData,result:SolverResult,claim:EvidenceClaim,budget:SolverOptions):MechanicEvidence {
  const definition=claim==='ice-push'?'Every winning path includes a successful ice push':claim==='block-as-stopper'?'Every winning path includes a non-ice slide stopped by another movable block':
    'Sequencing constraint changes optimal solution cost and is exercised in winning replay';
  const base:MechanicEvidence={actionDomain:'SWIPES_ONLY',claim,status:'UNKNOWN',definition,traceSteps:[]};
  if (result.status!=='SOLVED'||!result.solutionPath) return {...base,reason:'No verified solution'};
  const replay=replaySolution(level,result.solutionPath);let state=createState(level);
  const occurs=(s:typeof state,a:import('../../../src/core/puzzle/GameRules').Action)=> {
    const t=gameRules.applyAction(s,a);
    if(claim==='ice-push')return t.result.kind!=='invalid'&&t.trace.icePush;
    if(claim==='block-as-stopper')return t.result.kind==='slide'&&!t.trace.icePush&&!!t.trace.stopperId&&s.blocks.find(b=>b.blockId===t.trace.stopperId)?.type!=='obstacle';
    return s.blocks.find(b=>b.blockId===a.blockId)?.type===(claim==='dependency-planning'?'dependent':'lock');
  };
  result.solutionPath.forEach((a,i)=>{if(occurs(state,a))base.traceSteps.push(i);state=replay.transitions[i].state;});
  if(!base.traceSteps.length)return {...base,status:'NOT_VERIFIED',counterexample:result.solutionPath,reason:'Known winning path avoids claimed interaction'};
  if(claim==='dependency-planning'||claim==='lock-planning') {
    const relaxed:LevelData={...level,blocks:level.blocks.map(b=>b.type===(claim==='dependency-planning'?'dependent':'lock')?{...b,type:'simple',dependsOn:undefined,unlockAt:undefined}:b)};
    const r=solve(relaxed,budget);
    if(r.status!=='SOLVED')return {...base,reason:'Counterfactual search incomplete'};
    return {...base,status:r.optimalMoves!<result.optimalMoves!?'VERIFIED':'NOT_VERIFIED',reason:'Compare optimum after removing sequencing constraint'};
  }
  const counter=solve(level,{...budget,allowTransition:(s,a)=>!occurs(s,a)});
  return {...base,status:counter.status==='UNSOLVABLE'?'VERIFIED':counter.status==='SOLVED'?'NOT_VERIFIED':'UNKNOWN',counterexample:counter.solutionPath,reason:counter.reason};
}
export interface DifficultyAnalysis { score:number; category:string; optimalMoves:number; dependencyDepth:number; effectiveBranching:number; deadEndRisk:number|null; graphStatus?:string; deadEndRiskVerified?:boolean; features?:Record<string,number>; mechanicComplexity:number; noveltyScore:number; modelVersion:string; confidence:number; coverage:string; breakdown:Record<string,number> }
export function evaluateDifficulty(level:LevelData,result:SolverResult,learned:readonly string[]=[],context?:EvaluationContext,primaryInsight?:string):DifficultyAnalysis|undefined {
  if(result.status!=='SOLVED'||!result.solutionPath)return;
  const byId=new Map(level.blocks.map(b=>[b.id,b]));
  const depth=(id:string,seen=new Set<string>()):number=>{const b=byId.get(id);if(b?.type!=='dependent'||!b.dependsOn||seen.has(id))return 0;return 1+depth(b.dependsOn,new Set([...seen,id]));};
  const dependencyDepth=Math.max(0,...level.blocks.map(b=>depth(b.id)));
  let state=createState(level),branches=0,reposition=0,switches=0,previous='';const moved=new Set<string>();
  for(const a of result.solutionPath){
    branches+=new Set(gameRules.getLegalActions(state).map(action=>gameRules.serializeState(gameRules.applyAction(state,action).state))).size;
    const t=gameRules.applyAction(state,a);if(moved.has(a.blockId)&&t.result.kind==='slide')reposition++;
    if(previous&&previous!==a.blockId)switches++;previous=a.blockId;moved.add(a.blockId);state=t.state;
  }
  const graph=exploreGraph(level,{...context?.budget,maxStates:context?.graphMaxStates??1000,timeoutMs:context?.budget.timeoutMs??1000});
  const losing=graph.complete?graph.states.filter((s,i)=>!gameRules.isWin(s)&&!graph.winning.has(i)).length:undefined;
  const deadEndRisk=losing===undefined?0:losing/Math.max(1,graph.states.length);
  const mechanics=mechanicsOf(level),mechanicNovelty=mechanics.filter(m=>!learned.includes(m)).length/Math.max(1,mechanics.length),novelty=primaryInsight&&context?0.5*mechanicNovelty+0.5*(context.learnedInsights.includes(primaryInsight)?0:1):mechanicNovelty;
  const features={moves:result.optimalMoves!,branching:branches/Math.max(1,result.solutionPath.length),dependency:dependencyDepth,repositioning:reposition,deadEnds:deadEndRisk,mechanics:Math.max(0,mechanics.length-1),novelty,pathComplexity:switches/Math.max(1,result.solutionPath.length)};
  const model=context?.model??DEFAULT_MODEL;
  const caps:Record<string,number>={moves:35,branching:20,dependency:15,repositioning:10,deadEnds:10,mechanics:15,novelty:5,pathComplexity:5};
  const breakdown=Object.fromEntries(Object.entries(features).map(([k,v])=>[k,Math.min(caps[k],v*model.weights[k])]));
  const score=model.fit?(predictRating(model.fit,features)-1)*25:Math.min(100,Object.values(breakdown).reduce((a,b)=>a+b,0));
  const category=['TUTORIAL','EASY','MEDIUM','HARD','EXPERT'][model.thresholds.findIndex(t=>score<t)===-1?4:model.thresholds.findIndex(t=>score<t)];
  return {score,category,optimalMoves:result.optimalMoves!,dependencyDepth,effectiveBranching:features.branching,deadEndRisk:graph.complete?deadEndRisk:null,graphStatus:graph.complete?'COMPLETE':graph.reason,deadEndRiskVerified:graph.complete,mechanicComplexity:mechanics.length,noveltyScore:novelty,modelVersion:model.version,confidence:graph.complete?0.4:0.25,features,coverage:graph.complete?`Complete reachable graph (${graph.states.length} states)`:`Partial graph (${graph.states.length} states); dead-end risk is unresolved and excluded from score`,breakdown};
}
export interface EvaluationReport { levelId:number; contractId:string; decision:'REJECT'|'HOLD'|'ELIGIBLE'; gates:Record<string,'PASS'|'FAIL'|'UNKNOWN'>; reasons:string[]; solver?:SolverResult; difficulty?:DifficultyAnalysis; evidence:(MechanicEvidence|FormalEvidence)[];context?:EvaluationContext; diversity?:DiversityAnalysis; softPenalty:number;softFindings?:string[]; evaluatorVersion:string; decisions?:DecisionAnalysis }
export function evaluate(level:LevelData,contract:LevelDesignContract,catalog:readonly LevelData[],budget:SolverOptions={},learned:readonly string[]=[],suppliedContext?:EvaluationContext):EvaluationReport {
  const context=suppliedContext??createEvaluationContext(catalog,budget,learned);validateContext(context);catalog=context.catalog;budget=context.budget;learned=context.learned;
  const started=Date.now();const remaining=():SolverOptions=>({...budget,timeoutMs:Math.max(0,(budget.timeoutMs??5000)-(Date.now()-started))});
  const report:EvaluationReport={levelId:level.id,contractId:contract.contractId,decision:'REJECT',gates:{},reasons:[],evidence:[],softPenalty:0,evaluatorVersion:EVALUATOR_VERSION,context};
  const schema=validateLevel(level),contractErrors=validateContract(contract);
  report.gates.schema=schema.length?'FAIL':'PASS';report.gates.rules=schema.length?'FAIL':'PASS';report.gates.contractSchema=contractErrors.length?'FAIL':'PASS';
  if(schema.length||contractErrors.length){report.reasons.push(...schema.map(e=>`${e.path}: ${e.message}`),...contractErrors.map(e=>`contract.${e}`));return report;}
  if(contract.productPolicy){const errors=productErrors(level);report.gates.product=errors.length?'FAIL':'PASS';if(errors.length){report.reasons.push(...errors);return report;}}
  const r=solve(level,remaining());report.solver=r;
  report.gates.solvability=r.status==='SOLVED'?'PASS':r.status==='UNSOLVABLE'||r.status==='ERROR'?'FAIL':'UNKNOWN';
  report.gates.optimality=r.optimalityProven?'PASS':'UNKNOWN';
  report.gates.performance=['TIMEOUT','RESOURCE_LIMIT'].includes(r.status)?'UNKNOWN':r.status==='ERROR'?'FAIL':'PASS';
  report.gates.replay=r.solutionPath?replaySolution(level,r.solutionPath).success?'PASS':'FAIL':'UNKNOWN';
  const mechanics=mechanicsOf(level);
  const matches=level.cols>=contract.grid.minCols&&level.cols<=contract.grid.maxCols&&level.rows>=contract.grid.minRows&&level.rows<=contract.grid.maxRows&&mechanics.every(m=>contract.allowedMechanics.includes(m))&&(contract.schemaVersion!=='2.0.0'||contract.requiredMechanics.every(m=>(mechanics as readonly string[]).includes(m)))&&(!contract.introducedMechanic||mechanics.includes(contract.introducedMechanic));
  report.gates.contract=!matches?'FAIL':r.optimalMoves===undefined?'UNKNOWN':r.optimalMoves>=contract.optimalMoves.min&&r.optimalMoves<=contract.optimalMoves.max?'PASS':'FAIL';
  report.evidence=[...(contract.schemaVersion==='2.0.0'?[]:contract.requiredMechanics.map(claim=>evaluateMechanic(level,r,claim as EvidenceClaim,remaining()))),...(contract.requiredEvidence??[]).map(spec=>verifyEvidence(level,r,spec,remaining()))];
  report.gates.evidence=report.evidence.some(e=>e.status==='NOT_VERIFIED')?'FAIL':report.evidence.some(e=>e.status==='UNKNOWN')?'UNKNOWN':'PASS';
  report.diversity=evaluateDiversity(r.optimalMoves!==undefined?{...level,parMoves:r.optimalMoves}:level,catalog,contract.diversityMode);
  if(r.solutionPath&&context.catalogPatterns.length){const pattern=solutionPattern(level,r.solutionPath);const ranked=context.catalogPatterns.map(p=>({levelId:p.levelId,score:solutionPatternSimilarity(pattern,p.pattern)})).sort((a,b)=>b.score-a.score||a.levelId-b.levelId);report.diversity.solutionSimilarity=ranked[0]?.score??0;report.diversity.solutionSimilarLevelId=ranked[0]?.levelId;report.diversity.reasons.push('Solution similarity covers the recorded optimal path only');}
  report.gates.uniqueness=report.diversity.exactDuplicate?'FAIL':'PASS';
  report.gates.similarity=contract.mandatoryMaxSimilarity!==undefined&&report.diversity.similarity>contract.mandatoryMaxSimilarity?'FAIL':'PASS';
  report.difficulty=evaluateDifficulty(level,r,learned,{...context,budget:remaining()},contract.primaryInsight);
  if(report.difficulty?.graphStatus==='TIMEOUT')report.gates.performance='UNKNOWN';
  if(contract.schemaVersion==='2.0.0'&&!contract.requiredEvidence?.length)report.gates.evidence='FAIL';
  if(contract.mandatoryMaxDeadEndRatio!==undefined)report.gates.deadEndRisk=report.difficulty?.deadEndRiskVerified?(report.difficulty.deadEndRisk!<=contract.mandatoryMaxDeadEndRatio?'PASS':'FAIL'):'UNKNOWN';
  if(contract.mandatoryDifficultyScore)report.gates.difficulty=report.difficulty?(report.difficulty.score>=contract.mandatoryDifficultyScore.min&&report.difficulty.score<=contract.mandatoryDifficultyScore.max?'PASS':'FAIL'):'UNKNOWN';
  if(contract.mandatoryDecisionPoints!==undefined||contract.mandatoryPrematureExitTrap){
    report.decisions=analyzeDecisions(level,remaining(),contract.prematureExitTrapScope);
    report.gates.decisions=report.decisions.status==='UNKNOWN'?'UNKNOWN':((report.decisions.decisionPoints??0)>=(contract.mandatoryDecisionPoints??0)&&(!contract.mandatoryPrematureExitTrap||(report.decisions.prematureExitTraps??0)>0))?'PASS':'FAIL';
  }
  report.softFindings=[];if(report.difficulty?.category!==contract.targetDifficulty)report.softFindings.push(`Predicted difficulty ${report.difficulty?.category??'unknown'} differs from ${contract.targetDifficulty}`);if(report.diversity.similarity>contract.preferred.maxSimilarity)report.softFindings.push('Structural similarity above preferred threshold');if((report.diversity.solutionSimilarity??0)>contract.preferred.maxSimilarity)report.softFindings.push('Recorded solution pattern similarity above preferred threshold');
  report.softPenalty=(report.difficulty?Math.abs(report.difficulty.score-contract.preferred.difficultyScore):100)+Math.max(0,report.diversity.similarity-contract.preferred.maxSimilarity)*20+Math.max(0,(report.diversity.solutionSimilarity??0)-contract.preferred.maxSimilarity)*10;
  for(const [gate,status]of Object.entries(report.gates))if(status!=='PASS')report.reasons.push(`${gate}: ${status}`);
  report.decision=Object.values(report.gates).includes('FAIL')?'REJECT':Object.values(report.gates).includes('UNKNOWN')?'HOLD':'ELIGIBLE';
  return report;
}
