export const CONTRACT_VERSION = '2.1.0';
export const MECHANICS = ['sliding','constrained','dependent','obstacle','lock','ice'] as const;
export type Mechanic = typeof MECHANICS[number];
export type EvidenceClaim = 'ice-push' | 'block-as-stopper' | 'dependency-planning' | 'lock-planning';
export type FormalClaim = EvidenceClaim | 'sliding-required' | 'forced-positioning' | 'direction-interaction' | 'dependency-chain' | 'multi-step-planning' | 'false-opportunity' | 'dead-end-avoidance' | 'obstacle-interaction';
export interface EvidenceSpec {
  id:string;claim:FormalClaim;scope:'ALL_WINNING_PATHS'|'EXISTS_REACHABLE_TRAP'|'COUNTERFACTUAL_EFFECT';
  blockIds?:string[];position?:[number,number];minSteps?:number;
}
export interface LevelDesignContract {
  productPolicy?:'single-exit-semantic-1.0.0';
  mandatoryDecisionPoints?:number;
  mandatoryPrematureExitTrap?:boolean;
  schemaVersion?:'2.0.0';
  requiredEvidence?:EvidenceSpec[];primaryEvidenceId?:string;
  contractId: string;
  targetDifficulty: 'TUTORIAL' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  grid: { minCols:number; maxCols:number; minRows:number; maxRows:number };
  optimalMoves: { min:number; max:number };
  allowedMechanics: Mechanic[];
  requiredMechanics: (Mechanic|EvidenceClaim)[];
  primaryInsight: string; secondaryInsights:string[];
  learningObjective:string;
  progressionRole:'TEACH'|'PRACTICE'|'TWIST'|'MASTERY'|'RELIEF';
  preferred: { difficultyScore:number; maxSimilarity:number };
  // Mandatory thresholds are explicit; soft targets stay in preferred.
  mandatoryMaxSimilarity?: number;
  mandatoryMaxDeadEndRatio?:number;
  mandatoryDifficultyScore?:{min:number;max:number};
  introducedMechanic?: Mechanic;
}
export function validateContract(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Expected contract object'];
  const c = value as LevelDesignContract; const errors:string[] = [];
  if(typeof c.contractId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(c.contractId))errors.push('contractId must be an ASCII identifier of 1–80 characters');
  if (!['TUTORIAL','EASY','MEDIUM','HARD','EXPERT'].includes(c.targetDifficulty)) errors.push('targetDifficulty');
  if (!['TEACH','PRACTICE','TWIST','MASTERY','RELIEF'].includes(c.progressionRole)) errors.push('progressionRole');
  if (!c.grid || ![c.grid.minCols,c.grid.maxCols,c.grid.minRows,c.grid.maxRows].every(v=>Number.isInteger(v)&&v>=1&&v<=12) || c.grid.minCols>c.grid.maxCols || c.grid.minRows>c.grid.maxRows) errors.push('grid');
  if (!c.optimalMoves || !Number.isInteger(c.optimalMoves.min) || !Number.isInteger(c.optimalMoves.max) || c.optimalMoves.min<1 || c.optimalMoves.min>c.optimalMoves.max) errors.push('optimalMoves');
  if (!Array.isArray(c.allowedMechanics) || !c.allowedMechanics.includes('sliding') || c.allowedMechanics.some(m=>!MECHANICS.includes(m))) errors.push('allowedMechanics');
  if (!Array.isArray(c.requiredMechanics) || c.requiredMechanics.some(m=>c.schemaVersion==='2.0.0'?!(MECHANICS as readonly string[]).includes(m):!['ice-push','block-as-stopper','dependency-planning','lock-planning'].includes(m))) errors.push('requiredMechanics');
  for (const name of ['primaryInsight','learningObjective'] as const) if (typeof c[name]!=='string' || !c[name].trim()) errors.push(name);
  if (!Array.isArray(c.secondaryInsights) || c.secondaryInsights.some(s=>typeof s!=='string')) errors.push('secondaryInsights');
  if (!c.preferred || !Number.isFinite(c.preferred.difficultyScore) || c.preferred.difficultyScore<0 || c.preferred.difficultyScore>100 || !Number.isFinite(c.preferred.maxSimilarity) || c.preferred.maxSimilarity<0 || c.preferred.maxSimilarity>1) errors.push('preferred');
  if(c.mandatoryMaxDeadEndRatio!==undefined&&(!Number.isFinite(c.mandatoryMaxDeadEndRatio)||c.mandatoryMaxDeadEndRatio<0||c.mandatoryMaxDeadEndRatio>1))errors.push('mandatoryMaxDeadEndRatio');
  if(c.mandatoryDifficultyScore&&(!Number.isFinite(c.mandatoryDifficultyScore.min)||!Number.isFinite(c.mandatoryDifficultyScore.max)||c.mandatoryDifficultyScore.min<0||c.mandatoryDifficultyScore.max>100||c.mandatoryDifficultyScore.min>c.mandatoryDifficultyScore.max))errors.push('mandatoryDifficultyScore');
  if (c.mandatoryMaxSimilarity !== undefined && (!Number.isFinite(c.mandatoryMaxSimilarity) || c.mandatoryMaxSimilarity<0 || c.mandatoryMaxSimilarity>1)) errors.push('mandatoryMaxSimilarity');
  if(c.productPolicy!==undefined&&c.productPolicy!=='single-exit-semantic-1.0.0')errors.push('productPolicy');
  if(c.mandatoryDecisionPoints!==undefined&&(!Number.isInteger(c.mandatoryDecisionPoints)||c.mandatoryDecisionPoints<1))errors.push('mandatoryDecisionPoints');
  if(c.mandatoryPrematureExitTrap!==undefined&&typeof c.mandatoryPrematureExitTrap!=='boolean')errors.push('mandatoryPrematureExitTrap');
  if(c.schemaVersion!==undefined&&c.schemaVersion!=='2.0.0')errors.push('schemaVersion');
  if(c.requiredEvidence!==undefined){
    if(!Array.isArray(c.requiredEvidence)||c.requiredEvidence.some(e=>!validEvidenceSpec(e)))errors.push('requiredEvidence');
    else if(new Set(c.requiredEvidence.map(e=>e.id)).size!==c.requiredEvidence.length)errors.push('requiredEvidence duplicate IDs');
  }
  if(c.schemaVersion==='2.0.0'&&Array.isArray(c.requiredMechanics)&&c.requiredMechanics.some(m=>!c.allowedMechanics?.includes(m as Mechanic)))errors.push('requiredMechanics must be allowed');
  if(c.schemaVersion==='2.0.0'&&!c.requiredEvidence?.some(e=>e.id===c.primaryEvidenceId))errors.push('primaryEvidenceId must reference requiredEvidence');
  if(c.schemaVersion==='2.0.0'&&(!c.requiredEvidence?.length))errors.push('requiredEvidence required for v2');
  if (c.introducedMechanic !== undefined && (!MECHANICS.includes(c.introducedMechanic) || !c.allowedMechanics?.includes(c.introducedMechanic))) errors.push('introducedMechanic');
  return errors;
}
export function mechanicsOf(level: import('../../../src/types/Game').LevelData): Mechanic[] {
  const present = new Set<Mechanic>(['sliding']);
  for (const b of level.blocks) if (b.type && b.type !== 'simple') present.add(b.type);
  if (level.iceCells?.length) present.add('ice');
  return MECHANICS.filter(m=>present.has(m));
}
export function defaultCurriculum(count:number): LevelDesignContract[] {
  return Array.from({length:count},(_,i)=> {
    const phase = Math.min(count===80?5:1,Math.floor(i/Math.max(1,count/(count===80?6:2))));
    const allowedMechanics = MECHANICS.slice(0,phase+1) as Mechanic[];
    const relief = i>0 && i%8===7 && i!==count-1;
    const evidence:EvidenceSpec[]=[{id:'sliding',claim:'sliding-required',scope:'ALL_WINNING_PATHS'}];
    const teachingClaim:Partial<Record<Mechanic,FormalClaim>>={constrained:'direction-interaction',dependent:'dependency-planning',obstacle:'obstacle-interaction',lock:'lock-planning',ice:'ice-push'};
    if(teachingClaim[allowedMechanics[phase]]){const claim=teachingClaim[allowedMechanics[phase]]!;evidence.push({id:'teaching',claim,scope:claim==='dependency-planning'||claim==='lock-planning'||claim==='direction-interaction'?'COUNTERFACTUAL_EFFECT':'ALL_WINNING_PATHS'});}
    if(count===80&&i===count-1)evidence.push({id:'finale-ice',claim:'ice-push',scope:'ALL_WINNING_PATHS'},{id:'finale-sequencing',claim:'dependency-planning',scope:'COUNTERFACTUAL_EFFECT'},{id:'finale-direction',claim:'direction-interaction',scope:'COUNTERFACTUAL_EFFECT'},{id:'finale-lock',claim:'lock-planning',scope:'COUNTERFACTUAL_EFFECT'},{id:'finale-obstacle',claim:'obstacle-interaction',scope:'ALL_WINNING_PATHS'});
    return {
      schemaVersion:'2.0.0',requiredEvidence:evidence,primaryEvidenceId:phase===0?'sliding':'teaching',
      contractId:`slot-${String(i+1).padStart(3,'0')}`,
      targetDifficulty: (['TUTORIAL','EASY','MEDIUM','HARD','EXPERT','EXPERT'] as const)[phase],
      grid:{minCols:3,maxCols:Math.min(10,5+phase),minRows:3,maxRows:Math.min(10,5+phase)},
      optimalMoves:{min:relief?2:2+phase,max:8+phase*6},allowedMechanics,
      requiredMechanics:count===80&&i===count-1?[...MECHANICS]:[allowedMechanics[phase]],
      primaryInsight:phase===0?'Sliding and exit alignment':`Combining ${allowedMechanics.join(', ')}`,
      secondaryInsights:[],learningObjective:`Apply ${allowedMechanics[phase] ?? 'sliding'} within previously learned rules`,
      progressionRole:i===0 || phase!==Math.min(count===80?5:1,Math.floor((i-1)/Math.max(1,count/(count===80?6:2))))?'TEACH':i===count-1?'MASTERY':relief?'RELIEF':i%3===0?'TWIST':'PRACTICE',
      introducedMechanic: i===0 || phase!==Math.min(count===80?5:1,Math.floor((i-1)/Math.max(1,count/(count===80?6:2)))) ? allowedMechanics[phase] : undefined,
      preferred:{difficultyScore:Math.max(0,(phase*15+5)-(relief?12:0)),maxSimilarity:0.9},
    } satisfies LevelDesignContract;
  });
}

export function validEvidenceSpec(value:unknown):value is EvidenceSpec {
  if(!value||typeof value!=='object')return false;
  const e=value as EvidenceSpec;
  const claims:FormalClaim[]=['ice-push','block-as-stopper','dependency-planning','lock-planning','sliding-required','forced-positioning','direction-interaction','dependency-chain','multi-step-planning','false-opportunity','dead-end-avoidance','obstacle-interaction'];
  if(!e.id||typeof e.id!=='string'||!claims.includes(e.claim))return false;
  const scope=e.claim==='false-opportunity'||e.claim==='dead-end-avoidance'?'EXISTS_REACHABLE_TRAP':['dependency-planning','lock-planning','direction-interaction'].includes(e.claim)?'COUNTERFACTUAL_EFFECT':'ALL_WINNING_PATHS';
  if(e.scope!==scope)return false;
  if(e.blockIds!==undefined&&(!Array.isArray(e.blockIds)||!e.blockIds.length||e.blockIds.some(id=>typeof id!=='string'||!id)||new Set(e.blockIds).size!==e.blockIds.length))return false;
  if(e.claim==='forced-positioning'&&(!e.blockIds||e.blockIds.length!==1||!Array.isArray(e.position)||e.position.length!==2||!e.position.every(x=>Number.isInteger(x)&&x>=0)))return false;
  if(e.claim==='dependency-chain'&&(!e.blockIds||e.blockIds.length<2))return false;
  if(e.claim==='multi-step-planning'&&(!e.blockIds||!Number.isInteger(e.minSteps)||e.minSteps!<2))return false;
  return true;
}
