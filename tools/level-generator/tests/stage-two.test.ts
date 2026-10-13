import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageTwoContracts } from '../stage-curriculum';
import { validateContract } from '../director/DesignContract';
import { stageTwoCandidate } from '../stage-two-build';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
import { productErrors } from '../generation/ProductPolicy';

test('Connections separates dependency and lock lessons, then combines them with two relief levels', () => {
  const contracts = stageTwoContracts();
  assert.equal(contracts.length, 20);
  for (const contract of contracts) assert.deepEqual(validateContract(contract), []);
  assert.deepEqual(contracts.filter(c => c.introducedMechanic).map(c => [c.contractId, c.introducedMechanic]), [
    ['stage2-21', 'sliding'], ['stage2-22', 'dependent'], ['stage2-31', 'lock'],
  ]);
  assert.ok(contracts.slice(0, 10).every(c => !c.allowedMechanics.includes('lock')));
  assert.deepEqual(contracts.filter(c => c.progressionRole === 'RELIEF').map(c => c.contractId), ['stage2-30', 'stage2-39']);
  assert.equal(contracts.at(-1)!.progressionRole, 'MASTERY');
  for (const contract of contracts.slice(15)) assert.ok(contract.requiredEvidence!.some(e => e.claim === 'dependency-planning') && contract.requiredEvidence!.some(e => e.claim === 'lock-planning'));
  assert.ok(new Set(contracts.map(c => c.primaryInsight)).size >= 15);
});

test('Stage 2 proposals preserve semantic colors, valid dependency references and deterministic seeds', () => {
  for (const index of [1, 6, 7, 10, 15, 19]) for (let attempt = 0; attempt < 10; attempt++) {
    const contract = stageTwoContracts()[index], id = index + 21;
    const first = stageTwoCandidate(contract, id, 20261013, attempt);
    assert.deepEqual(first, stageTwoCandidate(contract, id, 20261013, attempt));
    assert.deepEqual(validateLevel(first.level), []);
    assert.deepEqual(productErrors(first.level), []);
    assert.equal(first.level.pack, 'stage-2');
    assert.equal(first.level.exits.length, 1);
    assert.equal(first.level.iceCells, undefined);
  }
});

test('stage palettes have distinct backgrounds and repeat deterministically without manual choices', async () => {
  const { getStagePalette } = await import('../../../src/config/Palettes');
  assert.deepEqual([1, 2, 3].map(n => getStagePalette(n).id), ['classic', 'ocean', 'sunset']);
  assert.equal(new Set([1, 2, 3].map(n => getStagePalette(n).ui.bg)).size, 3);
  assert.equal(getStagePalette(4).id, getStagePalette(1).id);
});

test('published Connections preserves Stage 1 and proves varied, meaningful puzzles in a complete batch', async () => {
  const { readJson } = await import('../output/Artifacts');
  const { replaySolution } = await import('../../../src/core/puzzle/SolutionReplay');
  const { levelContentVersion } = await import('../../../src/core/puzzle/LevelVersion');
  const { canonicalSignature, solutionPattern, solutionPatternSimilarity } = await import('../evaluation/DiversityEvaluator');
  const base = readJson<import('../output/Artifacts').RuntimeCampaign>('generated/runs/stage-one/approved/kinetic-stages-3bacc398317c-192dac966e1b/campaign.json');
  const { campaignPath } = readJson<{ campaignPath: string }>('generated/runs/stage-two/latest.json');
  const campaign = readJson<import('../output/Artifacts').RuntimeCampaign>(campaignPath);
  const reports = readJson<import('../evaluation/Evaluators').EvaluationReport[]>(campaignPath.replace('campaign.json', 'reports.json'));
  assert.equal(campaign.levels.length, 40);
  assert.deepEqual(campaign.levels.slice(0, 20), base.levels);
  assert.deepEqual(campaign.levels.slice(0, 20).map(levelContentVersion), base.levels.map(levelContentVersion));
  for (const id of [1, 3, 20]) assert.deepEqual(campaign.solutions[id], base.solutions[id]);
  assert.deepEqual(Object.keys(campaign.tutorials).map(Number), [1, 2, 3, 21, 22, 31]);
  assert.equal(new Set(campaign.levels.map(canonicalSignature)).size, 40);
  const patterns = campaign.levels.map(level => solutionPattern(level, campaign.solutions[level.id]));
  for (const level of campaign.levels.slice(20)) {
    assert.deepEqual(validateLevel(level), []); assert.deepEqual(productErrors(level), []);
    assert.equal(replaySolution(level, campaign.solutions[level.id]).success, true);
    assert.equal(campaign.solutions[level.id].length, level.parMoves);
    assert.equal(reports[level.id - 1].decision, 'ELIGIBLE');
    assert.ok(reports[level.id - 1].evidence.every(e => e.status === 'VERIFIED'));
    if (level.id < 31) assert.ok(level.blocks.every(b => b.type !== 'lock'));
    for (const prior of patterns.slice(Math.max(0, level.id - 3), level.id - 1)) assert.ok(solutionPatternSimilarity(patterns[level.id - 1], prior) <= 0.88);
  }
  for (const id of [30, 39]) assert.ok(reports[id - 1].difficulty!.score < reports[id - 2].difficulty!.score);
  assert.ok(reports[39].difficulty!.score >= Math.max(...reports.slice(20, 39).map(r => r.difficulty!.score)));
});


test('dependency inspection requires the correct tap and cannot advance by NEXT or a swipe', async () => {
  const { TutorialSession } = await import('../../../src/core/campaign/TutorialSession');
  const session = new TutorialSession([
    { text: 'Tap Blue', inspectBlockId: 'blue', highlightBlockId: 'blue' },
    { text: 'The circle marks its parent', highlightParentId: 'red' },
    { text: 'Release the parent', action: { blockId: 'red', dir: 'RIGHT' } },
  ]);
  assert.equal(session.next(), false);
  assert.equal(session.moved({ blockId: 'red', dir: 'RIGHT' }), false);
  assert.equal(session.inspected('other'), false); assert.equal(session.index, 0);
  assert.equal(session.inspected('blue'), true); assert.equal(session.current!.highlightParentId, 'red');
  assert.equal(session.inspected('blue'), false); assert.equal(session.index, 1);
  assert.equal(session.next(), true); assert.equal(session.moved({ blockId: 'red', dir: 'RIGHT' }), true);
  assert.equal(session.finished, true);
  const skipped = new TutorialSession([{ text: 'Tap Blue', inspectBlockId: 'blue' }]);
  skipped.skip(); assert.equal(skipped.inspected('blue'), false);
});
