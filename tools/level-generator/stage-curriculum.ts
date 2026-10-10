import type { LevelDesignContract, EvidenceSpec, Mechanic } from './director/DesignContract';
import { PRODUCT_POLICY } from './generation/ProductPolicy';

/** Stage 1: teach red, obstacle, then yellow; deepen interactions without new block types. */
export function stageOneContracts(): LevelDesignContract[] {
  const minima = [2, 5, 6, 7, 8, 9, 10, 11, 10, 12, 12, 13, 14, 13, 15, 15, 14, 9, 15, 16];
  return minima.map((min, i) => {
    const id = i + 1, introduced: Mechanic | undefined = id === 1 ? 'sliding' : id === 2 ? 'obstacle' : id === 3 ? 'constrained' : undefined;
    const exitOrder = [17,19,20].includes(id);
    const role = introduced ? 'TEACH' : id >= 19 ? 'MASTERY' : id === 18 ? 'RELIEF' : exitOrder || id % 3 === 0 ? 'TWIST' : 'PRACTICE';
    const claim = id === 1 ? 'sliding-required' : id === 2 ? 'obstacle-interaction' : 'direction-interaction';
    const evidence: EvidenceSpec[] = [{ id: 'mechanic', claim, scope: id >= 3 ? 'COUNTERFACTUAL_EFFECT' : 'ALL_WINNING_PATHS' }];
    if (id >= 6) evidence.push({ id: 'stopper', claim: 'block-as-stopper', scope: 'ALL_WINNING_PATHS' });
    if (exitOrder) evidence.push({ id: 'exit-order', claim: 'false-opportunity', scope: 'EXISTS_REACHABLE_TRAP' });
    const insight = exitOrder ? 'Predict an irreversible exit order' : id === 1 ? 'One exit for everyone' : id === 2 ? 'Obstacles stop your slide' : id === 3 ? 'Yellow follows its arrow' : id <= 10 ? 'Keep a stopper until its job is done' : id <= 15 ? 'Position first, exit later' : 'Plan the complete exit order';
    return {
      schemaVersion: '2.0.0', diversityMode: 'LAYOUT_AND_STRUCTURE', productPolicy: PRODUCT_POLICY, contractId: `stage1-${id}`, targetDifficulty: id <= 3 ? 'TUTORIAL' : id <= 5 || id === 18 ? 'EASY' : id <= 15 ? 'MEDIUM' : 'HARD',
      grid: { minCols: 4, maxCols: 5, minRows: 4, maxRows: 5 }, optimalMoves: { min, max: id === 18 ? 12 : id <= 5 ? min + 4 : min + 8 },
      allowedMechanics: id === 1 ? ['sliding'] : id === 2 ? ['sliding', 'obstacle'] : ['sliding', 'obstacle', 'constrained'],
      requiredMechanics: id === 1 ? ['sliding'] : id === 2 ? ['obstacle'] : ['obstacle', 'constrained'],
      primaryInsight: insight, secondaryInsights: [], learningObjective: id === 1 ? 'Swipe the highlighted red block. It keeps sliding until stopped. Send every block through the same exit.' : id === 2 ? 'Gray obstacles stay in place. Use them to line up the shared exit.' : id === 3 ? 'Yellow blocks move only in their arrow direction. Red blocks can help them reach the exit.' : insight,
      progressionRole: role, introducedMechanic: introduced, requiredEvidence: evidence, primaryEvidenceId: exitOrder ? 'exit-order' : 'mechanic', mandatoryPrematureExitTrap: exitOrder || undefined, prematureExitTrapScope: exitOrder ? 'REACHABLE_WINNING_STATES' : undefined,
      preferred: { difficultyScore: id === 18 ? 32 : 10 + id * 2, maxSimilarity: 0.9 }, mandatoryMaxSimilarity: 0.94,
      mandatoryDecisionPoints: id >= 6 ? id === 18 ? 2 : id >= 16 ? 5 : 3 : undefined,
    } satisfies LevelDesignContract;
  });
}
