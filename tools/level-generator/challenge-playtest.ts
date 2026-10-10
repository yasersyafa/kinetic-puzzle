import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateCandidate } from './generation/CandidateGenerator';
import { PRODUCT_POLICY } from './generation/ProductPolicy';
import { createState,gameRules } from '../../src/core/puzzle/GameRules';
import { solve } from './core/SolverV2';
import { analyzeDecisions } from './evaluation/DecisionAnalysis';
import { evaluate } from './evaluation/Evaluators';
import { createEvaluationContext } from './evaluation/EvaluationContext';
import { solutionPattern } from './evaluation/DiversityEvaluator';
import { exportCampaign,writeJson,readJson,hash } from './output/Artifacts';
import type { LevelDesignContract,Mechanic,EvidenceSpec } from './director/DesignContract';
import type { AcceptedCandidate } from './director/CurriculumPlanner';
async function main(){
const output='generated/runs/shared-exit-playtest',budget={maxStates:30000,maxTransitions:400000,timeoutMs:3000};
const prior=existsSync(join(output,'selection.json'))?readJson<AcceptedCandidate[]>(join(output,'selection.json')):[];
const started=Date.now();
const accepted:AcceptedCandidate[]=[],learned:string[]=[],insights:string[]=[],patterns:{levelId:number;pattern:string[]}[]=[];
const phases:Mechanic[]=['sliding','obstacle','constrained','dependent','lock','lock'];
const claim:Record<string,EvidenceSpec['claim']>={sliding:'sliding-required',obstacle:'obstacle-interaction',constrained:'direction-interaction',dependent:'dependency-planning',lock:'lock-planning'};
for(let index=0;index<phases.length;index++){
  const introduced=phases[index],id=index+1,teach=index<5;
  const allowed=[...new Set(phases.slice(0,index+1))];
  const contract:LevelDesignContract={schemaVersion:'2.0.0',productPolicy:PRODUCT_POLICY,contractId:`shared-exit-${id}`,targetDifficulty:id===1?'TUTORIAL':id<4?'MEDIUM':'HARD',grid:{minCols:4,maxCols:5,minRows:4,maxRows:5},optimalMoves:{min:[2,8,10,12,14,16][index],max:35},allowedMechanics:allowed,requiredMechanics:[introduced],primaryInsight:id===1?'One shared exit':'Plan which block must remain before using the shared exit',secondaryInsights:[],learningObjective:id===1?'Move every block through the same exit.':'All blocks share one exit. A block can be needed as a stopper before it leaves.',progressionRole:teach?'TEACH':'MASTERY',introducedMechanic:teach?introduced:undefined,preferred:{difficultyScore:id*7,maxSimilarity:0.95},mandatoryDecisionPoints:id===1?undefined:3,requiredEvidence:[...(id===1?[]:[{id:'stopper',claim:'block-as-stopper',scope:'ALL_WINNING_PATHS'} as EvidenceSpec]),{id:'mechanic',claim:claim[introduced],scope:['constrained','dependent','lock'].includes(introduced)?'COUNTERFACTUAL_EFFECT':'ALL_WINNING_PATHS'}],primaryEvidenceId:'mechanic'};
  let chosen:AcceptedCandidate|undefined;
  for(let attempt=0;attempt<3000&&Date.now()-started<900000;attempt++){
    const previous=prior[index];
    if(attempt===0&&previous&&hash(previous.candidate.contract)===hash(contract)){
      const regenerated=generateCandidate(contract,id,20261010,previous.candidate.provenance.attempt);
      if(hash({...previous.candidate.level,parMoves:1})===hash(regenerated.level)){
        const context=createEvaluationContext(accepted.map(a=>a.candidate.level),{...budget,timeoutMs:60000},learned,insights,patterns);
        const report=evaluate(previous.candidate.level,contract,[],{},[],context);
        if(report.decision==='ELIGIBLE'){chosen={candidate:{...previous.candidate,provenance:{...previous.candidate.provenance,generatorVersion:regenerated.provenance.generatorVersion}},report};console.log(JSON.stringify({id,reused:true,optimal:report.solver!.optimalMoves}));break;}
      }
    }
    if(attempt%100===0)console.log(JSON.stringify({slot:id,attempt}));
    const candidate=generateCandidate(contract,id,20261010,attempt),solver=solve(candidate.level,budget);
    if(solver.status!=='SOLVED'||solver.optimalMoves!<contract.optimalMoves.min)continue;
    let state=createState(candidate.level),stopper=false;
    for(const action of solver.solutionPath!){const t=gameRules.applyAction(state,action);if(t.trace.stopperId&&state.blocks.find(b=>b.blockId===t.trace.stopperId)?.type!=='obstacle')stopper=true;state=t.state;}
    if(id>1&&!stopper)continue;
    const decisions=analyzeDecisions(candidate.level,budget);
    if(decisions.status!=='VERIFIED'||decisions.decisionPoints!<(contract.mandatoryDecisionPoints??0))continue;
    const context=createEvaluationContext(accepted.map(a=>a.candidate.level),{...budget,timeoutMs:60000},learned,insights,patterns);
    const report=evaluate(candidate.level,contract,[],{},[],context);
    if(report.decision!=='ELIGIBLE')continue;
    candidate.level.parMoves=report.solver!.optimalMoves!;
    const maximum=accepted.at(-1)?.report.difficulty?.score??0;
    if(id>1&&report.difficulty!.score-maximum>30)continue;
    chosen={candidate,report};console.log(JSON.stringify({id,attempt,optimal:solver.optimalMoves,decisions,score:report.difficulty!.score}));break;
  }
  if(!chosen){writeJson(join(output,'partial.json'),{status:'PARTIAL',failedSlot:id,accepted});throw new Error(`No verified candidate for slot ${id}; previous campaign is not a fallback`);}
  accepted.push(chosen);if(teach)learned.push(introduced);insights.push(contract.primaryInsight);patterns.push({levelId:id,pattern:solutionPattern(chosen.candidate.level,chosen.report.solver!.solutionPath!)});
  writeJson(join(output,'selection.json'),accepted);
}
const campaign=await exportCampaign(accepted,accepted.length,join(output,'approved'),'shared-exit',undefined,Infinity,{seed:20261010,policy:PRODUCT_POLICY,purpose:'Human difficulty validation; not an approved 80-level replacement'});
const campaignPath=join(output,'approved',`shared-exit-${campaign.campaignVersion}-${campaign.auditVersion}`,'campaign.json');writeJson(join(output,'latest.json'),{campaignPath});console.log(JSON.stringify({campaignPath}));

}
main().catch(error=>{console.error(error);process.exitCode=1;});
