import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageThreeContracts } from '../stage-curriculum';
import { stageThreeCandidate, hasTemporaryParking } from '../stage-three-build';
import { validateContract } from '../director/DesignContract';
import { readJson, type RuntimeCampaign } from '../output/Artifacts';
import { replaySolution } from '../../../src/core/puzzle/SolutionReplay';
import { levelContentVersion } from '../../../src/core/puzzle/LevelVersion';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
import { productErrors } from '../generation/ProductPolicy';
import { canonicalSignature, solutionPattern, solutionPatternSimilarity } from '../evaluation/DiversityEvaluator';
import type { EvaluationReport } from '../evaluation/Evaluators';

test('Precision alternates existing mechanics, proves preparation and exit order, and places relief before both finales', () => {
  const contracts = stageThreeContracts();
  assert.equal(contracts.length, 20);
  for (const contract of contracts) {
    assert.deepEqual(validateContract(contract), []);
    assert.equal(contract.introducedMechanic, undefined);
    assert.notEqual(contract.progressionRole, 'TEACH');
    assert.ok(!contract.allowedMechanics.includes('ice'));
    assert.ok(contract.mandatoryDifficultyScore);
  }
  assert.deepEqual(contracts.filter(c => c.progressionRole === 'RELIEF').map(c => c.contractId), ['stage3-49', 'stage3-59']);
  assert.deepEqual(contracts.filter(c => c.progressionRole === 'MASTERY').map(c => c.contractId), ['stage3-50', 'stage3-60']);
  assert.ok(contracts.slice(0, 10).every(c => !c.allowedMechanics.includes('lock')));
  assert.ok(contracts.slice(10).every(c => c.requiredMechanics.includes('dependent') && c.requiredMechanics.includes('lock')));
  assert.ok(contracts.slice(14, 18).every(c => c.requiredEvidence!.some(e => e.claim === 'multi-step-planning' && e.minSteps! >= 4)));
});

test('Precision proposals keep deterministic seeds, semantic colors and valid parent references', () => {
  for (const contract of stageThreeContracts()) for (let attempt = 0; attempt < 5; attempt++) {
    const id = Number(contract.contractId.split('-')[1]);
    const candidate = stageThreeCandidate(contract, id, 20261014, attempt);
    assert.deepEqual(candidate, stageThreeCandidate(contract, id, 20261014, attempt));
    assert.equal(candidate.level.pack, 'stage-3');
    assert.deepEqual(validateLevel(candidate.level), []);
    assert.deepEqual(productErrors(candidate.level), []);
  }
});

test('published Precision preserves the first 40 levels and meets solution, evidence, diversity and pacing gates', () => {
  const basePointer = readJson<{ campaignPath: string }>('generated/runs/stage-two/latest.json');
  const base = readJson<RuntimeCampaign>(basePointer.campaignPath);
  const pointer = readJson<{ campaignPath: string }>('generated/runs/stage-three/latest.json');
  const campaign = readJson<RuntimeCampaign>(pointer.campaignPath);
  const reports = readJson<EvaluationReport[]>(pointer.campaignPath.replace('campaign.json', 'reports.json'));
  assert.equal(campaign.levels.length, 60);
  assert.deepEqual(campaign.levels.slice(0, 40), base.levels);
  assert.deepEqual(campaign.levels.slice(0, 40).map(levelContentVersion), base.levels.map(levelContentVersion));
  for (const level of base.levels) assert.deepEqual(campaign.solutions[level.id], base.solutions[level.id]);
  assert.deepEqual(campaign.tutorials, base.tutorials);
  assert.equal(new Set(campaign.levels.map(canonicalSignature)).size, 60);
  const patterns = campaign.levels.map(level => solutionPattern(level, campaign.solutions[level.id]));
  for (const level of campaign.levels.slice(40)) {
    const report = reports[level.id - 1], contract = stageThreeContracts()[level.id - 41];
    assert.deepEqual(validateLevel(level), []); assert.deepEqual(productErrors(level), []);
    assert.equal(replaySolution(level, campaign.solutions[level.id]).success, true);
    assert.equal(campaign.solutions[level.id].length, level.parMoves);
    assert.equal(report.decision, 'ELIGIBLE');
    assert.ok(report.evidence.every(e => e.status === 'VERIFIED'));
    if (contract.requiredEvidence!.some(e => e.claim === 'multi-step-planning')) assert.ok(hasTemporaryParking(level, campaign.solutions[level.id]));
    assert.ok(report.difficulty!.score >= contract.mandatoryDifficultyScore!.min && report.difficulty!.score <= contract.mandatoryDifficultyScore!.max);
    assert.ok(report.difficulty!.score - reports[level.id - 2].difficulty!.score <= (level.id === 60 ? 25 : 12));
    for (const prior of patterns.slice(level.id - 3, level.id - 1)) assert.ok(solutionPatternSimilarity(patterns[level.id - 1], prior) <= 0.88);
  }
  for (const id of [41, 49, 59]) assert.ok(reports[id - 1].difficulty!.score < reports[id - 2].difficulty!.score - 2);
  assert.ok(reports[59].difficulty!.score >= Math.max(...reports.slice(40, 59).map(r => r.difficulty!.score)));
});
