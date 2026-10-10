import type { LevelData } from '../../../src/types/Game';
import type { AcceptedCandidate } from '../director/CurriculumPlanner';
import { hash } from '../output/Integrity';
import { solutionPattern } from './DiversityEvaluator';
import { validateContext,type EvaluationContext } from './EvaluationContext';
/** Campaign position determines learning history; artifacts cannot supply an invented history. */
export function validateApprovalContext(context:EvaluationContext,base:EvaluationContext,previous:AcceptedCandidate[]):void {
  validateContext(context);validateContext(base);
  const catalog:LevelData[]=[...base.catalog,...previous.map(a=>a.candidate.level)];
  const learned=[...new Set(previous.filter(a=>a.candidate.contract.progressionRole==='TEACH').flatMap(a=>a.candidate.contract.introducedMechanic?[a.candidate.contract.introducedMechanic]:[]))].sort();
  const insights=[...new Set(previous.map(a=>a.candidate.contract.primaryInsight))].sort();
  const patterns=[...base.catalogPatterns,...previous.map(a=>({levelId:a.candidate.level.id,pattern:solutionPattern(a.candidate.level,a.report.solver!.solutionPath!)}))];
  if(hash(context.catalog)!==hash(catalog)||hash(context.learned)!==hash(learned)||hash(context.learnedInsights)!==hash(insights)||hash(context.catalogPatterns)!==hash(patterns))throw new Error('Approval learning/catalog context does not match campaign position');
  const policy=(c:EvaluationContext)=>({budget:c.budget,model:c.model,maxSpike:c.maxSpike,graphMaxStates:c.graphMaxStates,rulesVersion:c.rulesVersion,solverVersion:c.solverVersion,evaluatorVersion:c.evaluatorVersion});
  if(hash(policy(context))!==hash(policy(base)))throw new Error('Campaign evaluation policies differ between levels');
}
