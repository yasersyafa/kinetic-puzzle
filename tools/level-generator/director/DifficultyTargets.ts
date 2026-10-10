import type { LevelDesignContract } from './DesignContract';
import { DEFAULT_MODEL, validateDifficultyModel, type DifficultyModel } from '../evaluation/EvaluationContext';

/** Product opt-in: require measured advanced tiers; relief remains intentionally lower. */
export function requireAdvancedTargets(contracts:LevelDesignContract[],model:DifficultyModel=DEFAULT_MODEL):LevelDesignContract[] {
  validateDifficultyModel(model);
  return contracts.map(contract=>{
    if(contract.progressionRole==='RELIEF'||!['HARD','EXPERT'].includes(contract.targetDifficulty))return structuredClone(contract);
    const hard=contract.targetDifficulty==='HARD';
    const upper=hard?model.thresholds[3]:100;
    const max=hard?upper-Math.max(Number.EPSILON*Math.abs(upper)*2,Number.MIN_VALUE):100;
    const band={min:Math.max(hard?model.thresholds[2]:model.thresholds[3],contract.mandatoryDifficultyScore?.min??0),max:Math.min(max,contract.mandatoryDifficultyScore?.max??100)};
    if(band.min>band.max)throw new Error(`${contract.contractId}: mandatory score conflicts with required ${contract.targetDifficulty} tier`);
    return {...structuredClone(contract),mandatoryDifficultyScore:band};
  });
}
