import type { LevelDesignContract } from './DesignContract';
export function limitSimilarity(contracts:LevelDesignContract[],maximum:number):LevelDesignContract[] {
  if(!Number.isFinite(maximum)||maximum<0||maximum>1)throw new Error('Maximum structural similarity must be between 0 and 1');
  return contracts.map(contract=>({...structuredClone(contract),mandatoryMaxSimilarity:Math.min(maximum,contract.mandatoryMaxSimilarity??1)}));
}
