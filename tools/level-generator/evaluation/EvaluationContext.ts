import type { LevelData } from '../../../src/types/Game';
import { RULES_VERSION } from '../../../src/core/puzzle/GameRules';
import { SOLVER_VERSION, type SolverOptions } from '../core/SolverV2';
import type { FittedDifficultyModel } from '../analytics/Calibration';
import { hash } from '../output/Integrity';
export const EVALUATION_VERSION='2.1.0';
export interface DifficultyModel {version:string;weights:Record<string,number>;thresholds:number[];fit?:FittedDifficultyModel}
export const DEFAULT_MODEL:DifficultyModel={version:'heuristic-2.0.0',weights:{moves:1.2,branching:1.5,dependency:4,repositioning:2,deadEnds:10,mechanics:3,novelty:5,pathComplexity:2},thresholds:[15,30,50,70]};
export interface EvaluationContext {
  schemaVersion:'2.0.0';rulesVersion:string;solverVersion:string;evaluatorVersion:string;
  budget:Omit<SolverOptions,'allowTransition'>; catalog:LevelData[];learned:string[];learnedInsights:string[];
  catalogPatterns:{levelId:number;pattern:string[]}[];model:DifficultyModel;maxSpike:number; graphMaxStates:number; contextHash:string;
}
export function createEvaluationContext(catalog:readonly LevelData[]=[],budget:SolverOptions={},learned:readonly string[]=[],insights:readonly string[]=[],patterns:{levelId:number;pattern:string[]}[]=[],model:DifficultyModel=DEFAULT_MODEL):EvaluationContext {
  validateDifficultyModel(model);
  if(budget.allowTransition)throw new Error('Evaluation context cannot contain executable predicates');
  const data={schemaVersion:'2.0.0' as const,rulesVersion:RULES_VERSION,solverVersion:SOLVER_VERSION,evaluatorVersion:EVALUATION_VERSION,budget:{maxStates:budget.maxStates??200000,maxTransitions:budget.maxTransitions??2000000,timeoutMs:budget.timeoutMs??5000,...(budget.maxDepth===undefined?{}:{maxDepth:budget.maxDepth})},catalog:structuredClone([...catalog]),learned:[...new Set(learned)].sort(),learnedInsights:[...new Set(insights)].sort(),catalogPatterns:structuredClone(patterns),model:structuredClone(model),maxSpike:30,graphMaxStates:5000};
  return {...data,contextHash:hash(data)};
}
export function validateContext(context:EvaluationContext):void {
  if(context?.model)validateDifficultyModel(context.model);
  if(!context||context.schemaVersion!=='2.0.0'||context.rulesVersion!==RULES_VERSION||context.solverVersion!==SOLVER_VERSION||context.evaluatorVersion!==EVALUATION_VERSION||hash({...context,contextHash:undefined})!==context.contextHash)throw new Error('Evaluation context integrity/version mismatch');
}

export function validateDifficultyModel(model:DifficultyModel):void {
  if(!model||typeof model.version!=='string'||!model.version||!model.weights||Object.keys(DEFAULT_MODEL.weights).some(k=>!Number.isFinite(model.weights[k])||model.weights[k]<0)||!Array.isArray(model.thresholds)||model.thresholds.length!==4||model.thresholds.some((v,i)=>!Number.isFinite(v)||v<0||v>100||(i>0&&v<=model.thresholds[i-1])))throw new Error('Invalid difficulty model');
  if(model.fit){const f=model.fit,n=f.featureNames?.length;if(!n||new Set(f.featureNames).size!==n||f.featureNames.some(k=>!Object.keys(DEFAULT_MODEL.weights).includes(k))||[f.means,f.scales,f.coefficients].some(a=>!Array.isArray(a)||a.length!==n||a.some(v=>!Number.isFinite(v)))||f.scales.some(v=>v<=0)||!Number.isFinite(f.intercept)||!f.version)throw new Error('Invalid calibrated model');}
}
