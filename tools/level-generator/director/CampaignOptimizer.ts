import { canonicalSignature,structuralFeatures,solutionPattern,solutionPatternSimilarity } from '../evaluation/DiversityEvaluator';
import { predictRating } from '../analytics/Calibration';
import { hash } from '../output/Integrity';
import type { AcceptedCandidate } from './CurriculumPlanner';
import { PREREQUISITES } from './CurriculumPlanner';
import { mechanicsOf } from './DesignContract';
export const PLANNER_VERSION='2.1.0';
export interface RankedSequence {levels:AcceptedCandidate[];penalty:number;learned:string[]}
/** Fixed curriculum slots remain ordered; beam search selects the combination of candidates globally. */
export function optimizeCampaign(pools:AcceptedCandidate[][],beamWidth=32):RankedSequence|undefined {
  if(!Number.isSafeInteger(beamWidth)||beamWidth<1)throw new Error('Invalid beam width');
  const candidates=pools.flat();
  if(new Set(candidates.map(a=>a.candidate.candidateId)).size!==candidates.length)throw new Error('Candidate IDs must be unique across campaign pools');
  const signatures=new Map(candidates.map(a=>[a.candidate.candidateId,canonicalSignature(a.candidate.level)]));
  const features=new Map(candidates.map(a=>[a.candidate.candidateId,structuralFeatures(a.candidate.level)]));
  const patterns=new Map(candidates.map(a=>[a.candidate.candidateId,solutionPattern(a.candidate.level,a.report.solver?.solutionPath??[])]));
  const pairCache=new Map<string,{structure:number;solution:number}>();
  const pair=(a:AcceptedCandidate,b:AcceptedCandidate)=>{
    const ids=[a.candidate.candidateId,b.candidate.candidateId].sort(),key=ids.join('|');const saved=pairCache.get(key);if(saved)return saved;
    const x=features.get(ids[0])!,y=features.get(ids[1])!;const structure=signatures.get(ids[0])===signatures.get(ids[1])?1:[...x].filter(v=>y.has(v)).length/new Set([...x,...y]).size;
    const value={structure,solution:solutionPatternSimilarity(patterns.get(ids[0])!,patterns.get(ids[1])!)};pairCache.set(key,value);return value;
  };
  let beam:RankedSequence[]=[{levels:[],penalty:0,learned:[]}];
  for(const pool of pools){
    const next:RankedSequence[]=[];
    for(const sequence of beam)for(const candidate of pool){
      const contract=candidate.candidate.contract,mechanics=mechanicsOf(candidate.candidate.level);
      if(mechanics.some(m=>(PREREQUISITES[m]??[]).some(p=>!sequence.learned.includes(p))))continue;
      if(mechanics.some(m=>!sequence.learned.includes(m)&&!(contract.progressionRole==='TEACH'&&m===contract.introducedMechanic)))continue;
      const signature=signatures.get(candidate.candidate.candidateId)!;
      if(sequence.levels.some(a=>signatures.get(a.candidate.candidateId)===signature))continue;
      const old=candidate.report.difficulty;if(!old)continue;
      const novelty=0.5*mechanics.filter(m=>!sequence.learned.includes(m)).length/Math.max(1,mechanics.length)+0.5*(sequence.levels.some(a=>a.candidate.contract.primaryInsight===contract.primaryInsight)?0:1);
      const noveltyContribution=novelty*(candidate.report.context?.model.weights.novelty??5);
      const fit=candidate.report.context?.model.fit;const score=fit&&old.features?(predictRating(fit,{...old.features,novelty})-1)*25:Math.min(100,old.score-(old.breakdown.novelty??0)+noveltyContribution);
      const previous=sequence.levels.at(-1)?.report.difficulty?.score;
      if(previous!==undefined&&(score-previous>30||(contract.progressionRole==='RELIEF'&&score>=previous)))continue;
      const diversity=Math.max(0,...sequence.levels.map(a=>pair(candidate,a).structure));
      if(contract.mandatoryMaxSimilarity!==undefined&&diversity>contract.mandatoryMaxSimilarity)continue;
      const updated={...candidate,report:{...candidate.report,difficulty:{...old,score,noveltyScore:novelty,breakdown:{...old.breakdown,novelty:noveltyContribution}}}};
      const solutionSimilarity=Math.max(0,...sequence.levels.map(a=>pair(candidate,a).solution));
      const repetition=sequence.levels.slice(-3).filter(a=>a.candidate.contract.primaryInsight===contract.primaryInsight).length;
      const penalty=sequence.penalty+Math.abs(score-contract.preferred.difficultyScore)+Math.max(0,diversity-contract.preferred.maxSimilarity)*20+Math.max(0,solutionSimilarity-contract.preferred.maxSimilarity)*10+repetition*2;
      const learned=[...sequence.learned];if(contract.progressionRole==='TEACH'&&contract.introducedMechanic&&!learned.includes(contract.introducedMechanic))learned.push(contract.introducedMechanic);
      next.push({levels:[...sequence.levels,updated],penalty,learned});
    }
    const keys=new Map(next.map(s=>[s,hash(s.levels.map(x=>x.candidate.candidateId))]));
    next.sort((a,b)=>a.penalty-b.penalty||compare(keys.get(a)!,keys.get(b)!));const representatives:RankedSequence[]=[],lastIds=new Set<string>();for(const sequence of next){const id=sequence.levels.at(-1)!.candidate.candidateId;if(!lastIds.has(id)){lastIds.add(id);representatives.push(sequence);}}const selected=new Set(representatives);beam=[...representatives,...next.filter(s=>!selected.has(s))].slice(0,beamWidth);if(!beam.length)return;
  }
  return beam[0];
}
function compare(a:string,b:string){return a<b?-1:a>b?1:0;}
