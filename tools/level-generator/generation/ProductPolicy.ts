import type { LevelData } from '../../../src/types/Game';
import { blockColor } from '../../../src/config/BlockColors';
import { defaultCurriculum } from '../director/DesignContract';
import type { LevelDesignContract } from '../director/DesignContract';
export const PRODUCT_POLICY='single-exit-semantic-1.0.0' as const;
export function applyProductPolicy(contracts:LevelDesignContract[]):LevelDesignContract[]{
  if(!Array.isArray(contracts)||contracts.some(c=>!c||typeof c!=='object'))throw new Error('Curriculum contracts must be an array of contract objects');
  return contracts.map(c=>({...c,productPolicy:PRODUCT_POLICY}));
}
export function colorLevel(level:LevelData):LevelData{return {...level,blocks:level.blocks.map(b=>({...b,color:blockColor(b.type)}))};}
export function productErrors(level:LevelData):string[]{
  const errors:string[]=[];
  if(level.exits.length!==1)errors.push('Exactly one shared exit is required');
  for(const b of level.blocks)if(b.color!==blockColor(b.type))errors.push(`Block ${b.id}: ${b.type??'simple'} must use ${blockColor(b.type)}`);
  return errors;
}

/** Two onboarding levels; mechanic teaching then proceeds through compact decision puzzles. */
export function productCurriculum(count:number):LevelDesignContract[]{
  if(count!==80)return applyProductPolicy(defaultCurriculum(count));
  const order=['sliding','obstacle','constrained','dependent','lock','ice'] as const;
  const claims={sliding:'sliding-required',obstacle:'obstacle-interaction',constrained:'direction-interaction',dependent:'dependency-planning',lock:'lock-planning',ice:'ice-push'} as const;
  const original=defaultCurriculum(80),starts=[0,2,5,10,18,30],source=[0,14,27,40,54,67];
  return Array.from({length:count},(_,i)=>{
    const phase=starts.reduce((selected,start,index)=>i>=start?index:selected,0),base=structuredClone(original[source[phase]]),teach=i===starts[phase];
    const role=teach?'TEACH':i===79?'MASTERY':i>4&&i%8===7?'RELIEF':i%3===0?'TWIST':'PRACTICE';
    const minimum=i<2?2:role==='RELIEF'?6:Math.min(20,6+Math.floor(i/4));
    const mechanic=order[phase];
    base.allowedMechanics=[...order.slice(0,phase+1)];base.requiredMechanics=[mechanic];base.introducedMechanic=mechanic;
    base.primaryInsight=phase===0?'One shared exit':`Plan interactions with ${mechanic}`;base.learningObjective=`Use ${mechanic} while every block shares a single exit`;
    base.requiredEvidence=[{id:'teaching',claim:claims[mechanic],scope:['constrained','dependent','lock'].includes(mechanic)?'COUNTERFACTUAL_EFFECT':'ALL_WINNING_PATHS'}];base.primaryEvidenceId='teaching';
    const evidence=[...base.requiredEvidence!];
    if(i>1)evidence.push({id:'shared-stopper',claim:'block-as-stopper',scope:'ALL_WINNING_PATHS'});
    if(i===79){base.requiredEvidence=original[79].requiredEvidence;base.requiredMechanics=original[79].requiredMechanics;}
    return {...base,contractId:`slot-${String(i+1).padStart(3,'0')}`,productPolicy:PRODUCT_POLICY,progressionRole:role,introducedMechanic:teach?base.introducedMechanic:undefined,optimalMoves:{min:minimum,max:35},grid:{minCols:4,maxCols:6,minRows:4,maxRows:6},requiredEvidence:i===79?[...base.requiredEvidence!,evidence.at(-1)!]:evidence,mandatoryDecisionPoints:i<2?undefined:role==='RELIEF'?2:Math.min(6,2+Math.floor(i/12))};
  });
}
