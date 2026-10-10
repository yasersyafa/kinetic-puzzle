import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import type { LevelData } from '../../src/types/Game';
import { RULES_VERSION } from '../../src/core/puzzle/GameRules';
import { validateCatalog } from '../../src/core/puzzle/LevelValidator';
import { replaySolution } from '../../src/core/puzzle/SolutionReplay';
import { solve } from './core/SolverV2';
import { validateContract, type LevelDesignContract } from './director/DesignContract';
import { verifyEvidence } from './evaluation/FormalEvidence';
import { evaluateDifficulty } from './evaluation/Evaluators';
import { createEvaluationContext, DEFAULT_MODEL, type DifficultyModel } from './evaluation/EvaluationContext';
import { evaluateDiversity } from './evaluation/DiversityEvaluator';
import { requireAdvancedTargets } from './director/DifficultyTargets';
import { runtimeHash, type RuntimeCampaign } from './output/Artifacts';
import { LEVELS } from '../../src/config/Levels';

interface Baseline {
  rulesVersion: string; campaignVersion: string;
  model?:DifficultyModel;policy?:{requireAdvancedTargets:boolean;maxSimilarity:number};
  fixtures: { level: LevelData; contract: LevelDesignContract; optimalMoves: number }[];
}
const budget = { maxStates: 10000, timeoutMs: 30000 };
let verified=0;
for(const name of ['approved-campaign.json','controlled-campaign.json']) {
const baseline = JSON.parse(readFileSync(new URL(`./tests/fixtures/${name}`, import.meta.url), 'utf8')) as Baseline;
assert.equal(baseline.rulesVersion, RULES_VERSION, 'Rules changed: review the frozen campaign baseline');
assert.equal(baseline.fixtures.length, 80);
assert.deepEqual(validateCatalog(baseline.fixtures.map(f => f.level)), []);
const selected:LevelData[]=[],learned:string[]=[],insights:string[]=[];
const solutions:RuntimeCampaign['solutions']={},roles:RuntimeCampaign['roles']={},tutorials:RuntimeCampaign['tutorials']={};
let previousScore:number|undefined;
for (const { level, contract, optimalMoves } of baseline.fixtures) {
  assert.equal(level.id,selected.length+1);
  assert.deepEqual(validateContract(contract), [], `L${level.id}: contract`);
  const result = solve(level, budget);
  assert.equal(result.status, 'SOLVED', `L${level.id}: ${result.status}`);
  assert.equal(result.optimalMoves, optimalMoves, `L${level.id}: frozen optimum changed`);
  assert.equal(replaySolution(level, result.solutionPath!).success, true, `L${level.id}: replay`);
  for (const spec of contract.requiredEvidence ?? []) {
    const evidence = verifyEvidence(level, result, spec, budget);
    assert.equal(evidence.status, 'VERIFIED', `L${level.id}: ${spec.id}: ${evidence.reason}`);
  }
  if(baseline.policy){
    assert.ok(contract.mandatoryMaxSimilarity!==undefined&&contract.mandatoryMaxSimilarity<=baseline.policy.maxSimilarity);
    const diversity=evaluateDiversity(level,[...LEVELS,...selected]);
    assert.equal(diversity.exactDuplicate,false,`L${level.id}: duplicate`);
    assert.ok(diversity.similarity<=contract.mandatoryMaxSimilarity,`L${level.id}: similarity ${diversity.similarity}`);
    const model=baseline.model??DEFAULT_MODEL;
    if(baseline.policy.requireAdvancedTargets)assert.deepEqual(contract.mandatoryDifficultyScore,requireAdvancedTargets([contract],model)[0].mandatoryDifficultyScore,`L${level.id}: advanced target policy weakened`);
    const context=createEvaluationContext([],budget,learned,insights,[],model);
    const analysis=evaluateDifficulty(level,result,learned,context,contract.primaryInsight)!;
    if(contract.mandatoryDifficultyScore)assert.ok(analysis.score>=contract.mandatoryDifficultyScore.min&&analysis.score<=contract.mandatoryDifficultyScore.max,`L${level.id}: mandatory difficulty`);
    if(previousScore!==undefined){
      assert.ok(analysis.score-previousScore<=30,`L${level.id}: difficulty spike`);
      if(contract.progressionRole==='RELIEF')assert.ok(analysis.score<previousScore,`L${level.id}: relief`);
    }
    previousScore=analysis.score;
  }
  solutions[level.id]=result.solutionPath!;roles[level.id]=contract.progressionRole;
  if(contract.progressionRole==='TEACH'){
    if(contract.introducedMechanic)learned.push(contract.introducedMechanic);
    tutorials[level.id]={title:contract.primaryInsight,body:contract.learningObjective};
  }
  insights.push(contract.primaryInsight);selected.push(level);verified++;
  console.log(JSON.stringify({ event: 'regression-verified', baseline:baseline.campaignVersion,levelId: level.id, optimalMoves }));
}
assert.equal(runtimeHash({schemaVersion:'2.0.0',campaignId:'generated',campaignVersion:baseline.campaignVersion,contentHash:'',rulesVersion:RULES_VERSION,levels:selected,solutions,roles,tutorials}).slice(0,12),baseline.campaignVersion,'Frozen runtime identity changed');
}
console.log(JSON.stringify({ event: 'summary', verified, campaigns:2 }));
