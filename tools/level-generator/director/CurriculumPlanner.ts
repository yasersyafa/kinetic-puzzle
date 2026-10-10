import type { Candidate } from '../generation/CandidateGenerator';
import type { EvaluationReport } from '../evaluation/Evaluators';
import { MECHANICS, mechanicsOf } from './DesignContract';
export interface AcceptedCandidate { candidate:Candidate; report:EvaluationReport }
export const PREREQUISITES:Record<string,string[]>={sliding:[],constrained:['sliding'],dependent:['sliding'],obstacle:['sliding'],lock:['dependent'],ice:['obstacle']};
export interface CampaignValidation { success:boolean; errors:string[]; warnings:string[]; difficultyCurve:{levelId:number;score:number;role:string}[] }
export function validateCampaign(levels:AcceptedCandidate[],count:number,maxSpike=30):CampaignValidation {
  const errors:string[]=[],warnings:string[]=[];const learned=new Set<string>();const ids=new Set<number>();
  if(levels.length!==count)errors.push(`Expected ${count} levels, received ${levels.length}`);
  const difficultyCurve=levels.map(({candidate,report},i)=>{
    const {level,contract}=candidate;
    if(ids.has(level.id)||level.id!==i+1)errors.push(`Invalid campaign position/ID ${level.id}`);ids.add(level.id);
    if(report.decision!=='ELIGIBLE')errors.push(`L${level.id} is not eligible`);
    for(const m of mechanicsOf(level)){
      for(const p of PREREQUISITES[m]??[])if(!learned.has(p))errors.push(`L${level.id}: prerequisite ${p} before ${m}`);
      if(!learned.has(m)&&contract.progressionRole!=='TEACH')errors.push(`L${level.id}: ${m} introduced outside TEACH`);
    }
    if(contract.progressionRole==='TEACH'){
      const introduced=contract.introducedMechanic;
      if(contract.schemaVersion==='2.0.0'&&(!introduced||!report.evidence.some(e=>e.status==='VERIFIED'&&((introduced==='sliding'&&e.claim==='sliding-required')||(introduced==='constrained'&&e.claim==='direction-interaction')||(introduced==='dependent'&&e.claim==='dependency-planning')||(introduced==='lock'&&e.claim==='lock-planning')||(introduced==='ice'&&e.claim==='ice-push')||(introduced==='obstacle'&&e.claim==='obstacle-interaction')))))errors.push(`L${level.id}: teaching objective lacks verified evidence`);
      if(introduced)learned.add(introduced);else if(contract.schemaVersion!=='2.0.0')mechanicsOf(level).forEach(m=>learned.add(m));
    }
    const score=report.difficulty?.score??0;
    if(contract.progressionRole==='RELIEF'&&i>0&&score>=(levels[i-1].report.difficulty?.score??0))errors.push(`L${level.id}: relief must reduce estimated difficulty`);
    if(i>0&&score-(levels[i-1].report.difficulty?.score??0)>maxSpike)errors.push(`L${level.id}: difficulty spike exceeds ${maxSpike}`);
    if(report.diversity&&report.diversity.similarity>contract.preferred.maxSimilarity)warnings.push(`L${level.id}: high structural similarity`);
    return {levelId:level.id,score,role:contract.progressionRole};
  });
  if(count===80){for(const m of MECHANICS)if(!learned.has(m))errors.push(`Missing campaign mechanic ${m}`);if((levels.at(-1)?.candidate.contract.requiredEvidence?.length??0)<2)errors.push('Final mastery requires combined verified insights');if(levels.at(-1)?.candidate.contract.progressionRole!=='MASTERY')errors.push('Final level must be MASTERY');}
  return {success:errors.length===0,errors,warnings,difficultyCurve};
}
