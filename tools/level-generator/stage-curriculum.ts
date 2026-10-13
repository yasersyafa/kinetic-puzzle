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

/** Connections: pacing resets for each new rule; alternate sequencing and positioning insights. */
export function stageTwoContracts(): LevelDesignContract[] {
  const minima = [5, 3, 5, 7, 8, 9, 10, 11, 12, 6, 4, 6, 8, 9, 10, 12, 13, 14, 8, 16];
  const insights = [
    'Plan within the move budget', 'Release the parent first', 'Open a route for Blue',
    'Keep a stopper for the unlocked block', 'Yellow sets the exit order', 'Position the parent before release',
    'Unlock a two-link chain', 'Prepare the chain landing points', 'Keep help until the final exit',
    'A short dependency reset', 'Count exits to open Purple', 'Choose who leaves before the lock opens',
    'Prepare Purple before the gate opens', 'Yellow controls the unlock order', 'Keep a stopper for Purple',
    'Coordinate Blue and Purple', 'Unlock first, align second', 'Plan every release and landing',
    'A short combined reset', 'Master the connected exit order',
  ];
  return minima.map((min, i) => {
    const id = i + 21, dependent = id >= 22 && id <= 30 || id >= 36;
    const lock = id >= 31;
    const constrained = [21, 25, 29, 34, 37, 40].includes(id);
    const relief = id === 30 || id === 39;
    const introduced: Mechanic | undefined = id === 21 ? 'sliding' : id === 22 ? 'dependent' : id === 31 ? 'lock' : undefined;
    const evidence: EvidenceSpec[] = [];
    if (id === 21) evidence.push({ id: 'budget', claim: 'sliding-required', scope: 'ALL_WINNING_PATHS' });
    if (dependent) evidence.push({ id: 'dependency', claim: 'dependency-planning', scope: 'COUNTERFACTUAL_EFFECT' });
    if (lock) evidence.push({ id: 'lock', claim: 'lock-planning', scope: 'COUNTERFACTUAL_EFFECT' });
    if (constrained) evidence.push({ id: 'direction', claim: 'direction-interaction', scope: 'COUNTERFACTUAL_EFFECT' });
    if ([24, 26, 29, 33, 35, 38, 40].includes(id)) evidence.push({ id: 'stopper', claim: 'block-as-stopper', scope: 'ALL_WINNING_PATHS' });
    if ([27, 28].includes(id)) evidence.push({ id: 'chain', claim: 'dependency-chain', scope: 'ALL_WINNING_PATHS', blockIds: ['m1', 'm2', 'm4'] });
    const required: Mechanic[] = ['sliding', ...(dependent ? ['dependent' as const] : []), ...(lock ? ['lock' as const] : []), ...(constrained ? ['constrained' as const] : [])];
    return {
      schemaVersion: '2.0.0', diversityMode: 'LAYOUT_AND_STRUCTURE', productPolicy: PRODUCT_POLICY,
      contractId: `stage2-${id}`, targetDifficulty: introduced || relief ? 'EASY' : id <= 25 || id <= 34 && id >= 31 ? 'MEDIUM' : 'HARD',
      grid: { minCols: 4, maxCols: 5, minRows: 4, maxRows: 5 }, optimalMoves: { min, max: min + (introduced || relief ? 4 : 7) },
      allowedMechanics: ['sliding', 'obstacle', ...(constrained ? ['constrained' as const] : []), ...(dependent ? ['dependent' as const] : []), ...(lock ? ['lock' as const] : [])],
      requiredMechanics: required, primaryInsight: insights[i], secondaryInsights: [],
      learningObjective: id === 21 ? 'You have two moves beyond the shortest solution. Plan before you swipe.'
        : id === 22 ? 'Blue stays locked until its connected parent leaves through the exit. Release the parent, then move Blue.'
        : id === 31 ? 'Purple unlocks after its numbered exit count. Send that many other blocks out first, then move Purple.' : insights[i],
      progressionRole: introduced ? 'TEACH' : id === 40 ? 'MASTERY' : relief ? 'RELIEF' : i % 3 === 0 ? 'TWIST' : 'PRACTICE',
      introducedMechanic: introduced, requiredEvidence: evidence, primaryEvidenceId: id === 21 ? 'budget' : lock ? 'lock' : 'dependency',
      preferred: { difficultyScore: introduced ? 22 : relief ? 30 : 30 + i, maxSimilarity: 0.85 }, mandatoryMaxSimilarity: 0.9,
    } satisfies LevelDesignContract;
  });
}
