import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { generateCandidate, type Candidate } from './generation/CandidateGenerator';
import { colorLevel } from './generation/ProductPolicy';
import { stageTwoContracts } from './stage-curriculum';
import { solve } from './core/SolverV2';
import { evaluateBounded } from './evaluation/BoundedEvaluation';
import { createEvaluationContext } from './evaluation/EvaluationContext';
import { solutionPattern, solutionPatternSimilarity } from './evaluation/DiversityEvaluator';
import { exportCampaign, readJson, writeJson, hash, type RuntimeCampaign } from './output/Artifacts';
import type { AcceptedCandidate } from './director/CurriculumPlanner';
import type { EvaluationReport } from './evaluation/Evaluators';
import type { LevelDesignContract } from './director/DesignContract';

export function stageTwoCandidate(contract: LevelDesignContract, id: number, seed: number, attempt: number): Candidate {
  const candidate = generateCandidate(contract, id, seed, attempt);
  candidate.level.pack = 'stage-2';
  if (id === 27 || id === 28) {
    const movable = candidate.level.blocks.filter(b => b.type !== 'obstacle');
    // Chain lessons need three actors. A fourth preserves positioning choices.
    if (movable.length === 4) {
      Object.assign(movable[1], { type: 'dependent', dependsOn: 'm1', direction: undefined, unlockAt: undefined });
      Object.assign(movable[3], { type: 'dependent', dependsOn: 'm2', direction: undefined, unlockAt: undefined });
    }
    candidate.level = colorLevel(candidate.level);
  }
  return candidate;
}

async function main() {
  const { values } = parseArgs({ options: {
    seed: { type: 'string', default: '20261013' }, attempts: { type: 'string', default: '12000' },
    output: { type: 'string', default: 'generated/runs/stage-two' },
    base: { type: 'string', default: 'generated/runs/stage-one/approved/kinetic-stages-3bacc398317c-192dac966e1b/campaign.json' },
  } });
  const seed = Number(values.seed), attempts = Number(values.attempts), output = values.output!, basePath = values.base!;
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(attempts) || attempts < 1) throw new Error('Invalid generation budget');
  const campaign = readJson<RuntimeCampaign>(basePath), baseDirectory = dirname(basePath);
  if (campaign.levels.length !== 20 || !campaign.stageConfig) throw new Error('A complete Stage 1 snapshot is required');
  const contracts = readJson<LevelDesignContract[]>(join(baseDirectory, 'contracts.json'));
  const reports = readJson<EvaluationReport[]>(join(baseDirectory, 'reports.json'));
  const manifest = readJson<{ provenance: Candidate['provenance'][]; files: Record<string, string> }>(join(baseDirectory, 'manifest.json'));
  for (const name of ['campaign.json', 'contracts.json', 'reports.json']) if (hash(readJson(join(baseDirectory, name))) !== manifest.files[name]) throw new Error(`Base snapshot integrity: ${name}`);
  const accepted: AcceptedCandidate[] = campaign.levels.map((level, i) => ({ candidate: { candidateId: `stage1-${level.id}`, level, contract: contracts[i], provenance: manifest.provenance[i] }, report: reports[i] }));
  const saved = existsSync(join(output, 'selection.json')) ? readJson<AcceptedCandidate[]>(join(output, 'selection.json')) : [];
  const policy = reports[0].context!;
  const curriculum = stageTwoContracts();
  const rejectionCounts: Record<string, number> = {};
  for (const contract of curriculum) {
    const id = accepted.length + 1;
    const context = createEvaluationContext(accepted.map(a => a.candidate.level), policy.budget,
      accepted.filter(a => a.candidate.contract.progressionRole === 'TEACH').map(a => a.candidate.contract.introducedMechanic!),
      accepted.map(a => a.candidate.contract.primaryInsight),
      accepted.map(a => ({ levelId: a.candidate.level.id, pattern: solutionPattern(a.candidate.level, a.report.solver!.solutionPath!) })), policy.model);
    let chosen: AcceptedCandidate | undefined;
    const previous = saved.find(a => a.candidate.level.id === id);
    const firstAttempt = previous?.candidate.provenance.seed === seed && hash(previous.candidate.contract) === hash(contract) ? previous.candidate.provenance.attempt : 0;
    for (let attempt = firstAttempt; attempt < firstAttempt + attempts; attempt++) {
      if (attempt % 100 === 0) console.log(JSON.stringify({ event: 'search', id, attempt, rejectionCounts }));
      const candidate = stageTwoCandidate(contract, id, seed, attempt);
      // Fast exact BFS rejects impossible and out-of-range proposals before evidence searches.
      const proof = solve(candidate.level, { ...policy.budget, timeoutMs: 1500 });
      if (proof.status !== 'SOLVED' || proof.optimalMoves! < contract.optimalMoves.min || proof.optimalMoves! > contract.optimalMoves.max) continue;
      candidate.level.parMoves = proof.optimalMoves!;
      const pattern = solutionPattern(candidate.level, proof.solutionPath!);
      if (accepted.slice(-2).some(a => solutionPatternSimilarity(pattern, solutionPattern(a.candidate.level, a.report.solver!.solutionPath!)) > 0.88)) continue;
      const report = await evaluateBounded(candidate.level, contract, context);
      if (report.decision !== 'ELIGIBLE') { for (const reason of report.reasons) rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1; continue; }
      const score = report.difficulty!.score, prior = accepted.at(-1)!.report.difficulty!.score;
      if (score - prior > 25 || contract.progressionRole === 'RELIEF' && score >= prior - 2) continue;
      if (id === 40 && score < Math.max(...accepted.slice(20).map(a => a.report.difficulty!.score))) continue;
      chosen = { candidate, report }; break;
    }
    if (!chosen) throw new Error(`Stage 2 L${id} unresolved; checkpoint retained, active campaign unchanged`);
    accepted.push(chosen); writeJson(join(output, 'selection.json'), accepted.slice(20));
    console.log(JSON.stringify({ event: 'accepted', id, attempt: chosen.candidate.provenance.attempt, optimal: chosen.report.solver!.optimalMoves, score: chosen.report.difficulty!.score, insight: contract.primaryInsight }));
  }
  const exported = await exportCampaign(accepted, 40, join(output, 'approved'), campaign.campaignId, undefined, Infinity,
    { purpose: 'Stage 2 Connections', seed, generatorVersion: 'stage2-1.0.0', baseContentHash: campaign.contentHash, rejectionCounts,
      maxRecentSolutionSimilarity: 0.88, maxLayoutSimilarity: 0.9 }, campaign.stageConfig);
  const campaignPath = join(output, 'approved', `${exported.campaignId}-${exported.campaignVersion}-${exported.auditVersion}`, 'campaign.json');
  writeJson(join(output, 'latest.json'), { campaignPath });
  console.log(JSON.stringify({ event: 'complete', campaignPath, count: exported.levels.length }));
}
if (process.argv[1]?.endsWith('stage-two-build.ts')) main().catch(error => { console.error(error); process.exitCode = 1; });
