import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { LevelData } from '../../../src/types/Game';
import type { LevelDesignContract } from '../director/DesignContract';
import { solve } from '../core/SolverV2';
import { replaySolution } from '../../../src/core/puzzle/SolutionReplay';
import { verifyEvidence } from '../evaluation/FormalEvidence';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/approved-baseline.json', import.meta.url), 'utf8')) as {
  level: LevelData; contract: LevelDesignContract; optimalMoves: number;
}[];
for (const fixture of fixtures) {
  test(`frozen approved baseline L${fixture.level.id}: optimum, replay and required evidence`, () => {
    assert.deepEqual(validateLevel(fixture.level), []);
    const budget = { maxStates: 10000, timeoutMs: 30000 };
    const result = solve(fixture.level, budget);
    assert.equal(result.status, 'SOLVED');
    assert.equal(result.optimalMoves, fixture.optimalMoves);
    assert.equal(replaySolution(fixture.level, result.solutionPath!).success, true);
    for (const spec of fixture.contract.requiredEvidence ?? []) {
      const evidence = verifyEvidence(fixture.level, result, spec, budget);
      assert.equal(evidence.status, 'VERIFIED', `${spec.id}: ${evidence.reason}`);
    }
  });
}
