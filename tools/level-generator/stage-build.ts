import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Candidate } from './generation/CandidateGenerator';
import { generateStageCandidate, STAGE_GENERATOR_VERSION } from './generation/StageCandidateGenerator';
import { createState, gameRules } from '../../src/core/puzzle/GameRules';
import { findProposalSolution, PROPOSAL_SEARCH_VERSION } from './generation/ProposalSearch';
import { evaluateBounded } from './evaluation/BoundedEvaluation';
import { createEvaluationContext } from './evaluation/EvaluationContext';
import { solutionPattern } from './evaluation/DiversityEvaluator';
import { exportCampaign, writeJson, readJson, hash } from './output/Artifacts';
import { writeHumanReport } from './output/ReportWriter';
import { stageOneContracts } from './stage-curriculum';
import { INITIAL_STAGES } from '../../src/core/campaign/Stage';
import type { AcceptedCandidate } from './director/CurriculumPlanner';

async function main() {
  const {values} = parseArgs({options:{help:{type:'boolean'},seed:{type:'string',default:'20261011'},attempts:{type:'string',default:'6000'},output:{type:'string',default:'generated/runs/stage-one'},'max-run-ms':{type:'string',default:'2700000'},'candidate-budget':{type:'string',default:'120000'}}});
  if (values.help) { console.log('levels:stage:build [--seed N] [--attempts N] [--output generated/path] [--max-run-ms N] [--candidate-budget N]\nBuild and checkpoint 20 verified Stage 1 levels; publish only a complete batch. Resume by repeating the same command.'); return; }
  const seed = Number(values.seed), attempts = Number(values.attempts), output = values.output, maxRunMs = Number(values['max-run-ms']), candidateBudget = Number(values['candidate-budget']);
  if (!Number.isSafeInteger(seed) || ![attempts,maxRunMs,candidateBudget].every(n=>Number.isSafeInteger(n)&&n>0)) throw new Error('Seed must be an integer; budgets must be positive integers');
  const controller = new AbortController(); process.once('SIGINT',()=>controller.abort()); process.once('SIGTERM',()=>controller.abort());
  let candidateCount = 0;
  const budget = { maxStates: 30000, maxTransitions: 400000, timeoutMs: 3000 };
  let prior = existsSync(join(output, 'selection.json')) ? readJson<AcceptedCandidate[]>(join(output, 'selection.json')) : [];
  const previousPointer = existsSync(join(output, 'latest.json')) ? readJson<{campaignPath:string}>(join(output, 'latest.json')) : undefined;
  const previousGeneration = previousPointer ? readJson<{seed:number;rejectionCounts?:Record<string,number>;initialSearchStatistics?:{candidateCount:number;rejectionCounts:Record<string,number>}}>(join(previousPointer.campaignPath, '..', 'generation.json')) : undefined;
  if(previousPointer){const manifest=readJson<{files:Record<string,string>}>(join(previousPointer.campaignPath,'..','manifest.json'));if(manifest.files['generation.json']!==hash(previousGeneration))throw new Error('Previous generation statistics integrity mismatch');}
  if (!prior.length && previousPointer) {
    const directory = join(previousPointer.campaignPath, '..');
    const saved = readJson<import('./output/Artifacts').RuntimeCampaign>(previousPointer.campaignPath);
    const contracts = readJson<import('./director/DesignContract').LevelDesignContract[]>(join(directory, 'contracts.json'));
    const reports = readJson<import('./evaluation/Evaluators').EvaluationReport[]>(join(directory, 'reports.json'));
    const manifest = readJson<{provenance:Candidate['provenance'][]}>(join(directory, 'manifest.json'));
    prior = saved.levels.map((level,i)=>({ candidate:{candidateId:`snapshot-${level.id}`,level,contract:contracts[i],provenance:manifest.provenance[i]},report:reports[i] }));
  }
  let reusedCount = 0;
  const contractHash = hash(stageOneContracts());
  const checkpoint = existsSync(join(output, 'checkpoint.json')) ? readJson<{seed:number;slot:number;nextAttempt:number;contractHash?:string;proposalSearchVersion?:string;stageGeneratorVersion?:string}>(join(output, 'checkpoint.json')) : undefined;
  const accepted: AcceptedCandidate[] = [], learned: string[] = [], insights: string[] = [], patterns: { levelId: number; pattern: string[] }[] = [];
  const started = Date.now(); setTimeout(()=>controller.abort(),maxRunMs).unref();
  const rejectionCounts: Record<string, number> = {};
  const reject = (reason: string) => { rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1; };
  for (const contract of stageOneContracts()) {
    const id = accepted.length + 1;
    const context = () => createEvaluationContext(accepted.map(a => a.candidate.level), { ...budget, timeoutMs: 60000 }, learned, insights, patterns);
    let chosen: AcceptedCandidate | undefined;
    const proposalPath = join(output, 'proposals', `${id}.json`);
    const proposal = existsSync(proposalPath) ? readJson<Candidate>(proposalPath) : undefined;
    const previous = prior[id - 1]?.candidate ?? proposal;
    if (previous?.provenance.seed === seed && Number.isSafeInteger(previous.provenance.attempt) && previous.provenance.attempt >= 0) {
      const fresh = generateStageCandidate(contract, id, seed, previous.provenance.attempt); fresh.level.pack = 'stage-1';
      if (hash({ ...previous.level, parMoves: 1 }) === hash(fresh.level)) {
        const report = await evaluateBounded(previous.level, contract, context(), controller.signal);
        if (report.decision === 'ELIGIBLE' && (id === 1 || report.difficulty!.score - accepted.at(-1)!.report.difficulty!.score <= 25) && (id !== 18 || report.difficulty!.score < accepted.at(-1)!.report.difficulty!.score - 2)) { fresh.level.parMoves = report.solver!.optimalMoves!; chosen = { candidate: fresh, report }; reusedCount++; }
      }
    }
    const firstAttempt = !chosen && checkpoint?.seed === seed && checkpoint.contractHash === contractHash && checkpoint.proposalSearchVersion === PROPOSAL_SEARCH_VERSION && checkpoint.stageGeneratorVersion === STAGE_GENERATOR_VERSION && checkpoint.slot === id ? checkpoint.nextAttempt : 0;
    for (let attempt = firstAttempt; !chosen && attempt < firstAttempt + attempts && Date.now() - started < maxRunMs && candidateCount < candidateBudget && !controller.signal.aborted; attempt++) {
      if (attempt % 100 === 0) { await new Promise(r=>setTimeout(r,0)); console.log(JSON.stringify({ event: 'search', slot: id, attempt, rejectionCounts })); writeJson(join(output, 'checkpoint.json'), { seed, slot: id, nextAttempt: attempt, contractHash, proposalSearchVersion: PROPOSAL_SEARCH_VERSION, stageGeneratorVersion: STAGE_GENERATOR_VERSION }); }
      candidateCount++;
      const candidate = generateStageCandidate(contract, id, seed, attempt); candidate.level.pack = 'stage-1';
      const proposed = findProposalSolution(candidate.level, { ...budget, maxDepth: contract.optimalMoves.max });
      if (proposed.status !== 'FOUND') { reject(`proposal_${proposed.status}`); continue; }
      if (proposed.path!.length < contract.optimalMoves.min || proposed.path!.length > contract.optimalMoves.max) { reject('move_range'); continue; }
      if (id >= 6) {
        let state = createState(candidate.level), stopper = false;
        for (const action of proposed.path!) { const t = gameRules.applyAction(state, action); if (t.trace.stopperId && state.blocks.find(b => b.blockId === t.trace.stopperId)?.type !== 'obstacle') stopper = true; state = t.state; }
        if (!stopper) { reject('missing_stopper'); continue; }
      }
      const report = await evaluateBounded(candidate.level, contract, context(), controller.signal);
      if (report.decision !== 'ELIGIBLE') { report.reasons.forEach(reject); continue; }
      const priorScore = accepted.at(-1)?.report.difficulty?.score ?? 0, score = report.difficulty!.score;
      if ((id > 1 && score - priorScore > 25) || (id === 18 && score >= priorScore - 2)) { reject('pacing'); continue; }
      candidate.level.parMoves = report.solver!.optimalMoves!;
      chosen = { candidate, report };
    }
    if (!chosen) { const partial = { status: 'PARTIAL' as const, failedSlot: id, accepted, candidateCount, rejections: rejectionCounts, reasons: [`Slot ${id} unresolved`] }; writeJson(join(output, 'partial.json'), partial); writeJson(join(output, 'report.json'), partial); writeHumanReport(join(output, 'report.html'), partial); throw new Error(`Slot ${id} unresolved. Checkpoint saved; published campaign remains unchanged.`); }
    accepted.push(chosen);
    if (contract.introducedMechanic) learned.push(contract.introducedMechanic);
    insights.push(contract.primaryInsight); patterns.push({ levelId: id, pattern: solutionPattern(chosen.candidate.level, chosen.report.solver!.solutionPath!) });
    writeJson(join(output, 'selection.json'), accepted);
    writeJson(join(output, 'checkpoint.json'), { seed, slot: id + 1, nextAttempt: 0, contractHash, proposalSearchVersion: PROPOSAL_SEARCH_VERSION, stageGeneratorVersion: STAGE_GENERATOR_VERSION });
    console.log(JSON.stringify({ event: 'accepted', id, attempt: chosen.candidate.provenance.attempt, optimal: chosen.report.solver!.optimalMoves, difficulty: chosen.report.difficulty!.score }));
  }
  const initialSearchStatistics = reusedCount === 20 && previousGeneration?.seed === seed ? previousGeneration.initialSearchStatistics ?? { candidateCount: accepted.reduce((sum,a)=>sum+a.candidate.provenance.attempt+1,0), rejectionCounts: previousGeneration.rejectionCounts ?? {} } : { candidateCount, rejectionCounts };
  const campaign = await exportCampaign(accepted, 20, join(output, 'approved'), 'kinetic-stages', controller.signal, started + maxRunMs, { stageBuilderVersion: '1.0.0', stageGeneratorVersion: STAGE_GENERATOR_VERSION, proposalSearchVersion: PROPOSAL_SEARCH_VERSION, seed, purpose: 'Stage 1 player testing', candidateCount, reusedCount, rejectionCounts, initialSearchStatistics, budget: { solver: budget, attemptsPerSlot: attempts, candidateBudget, maxRunMs } }, INITIAL_STAGES);
  const campaignPath = join(output, 'approved', `kinetic-stages-${campaign.campaignVersion}-${campaign.auditVersion}`, 'campaign.json');
  const runReport = { status: 'COMPLETE' as const, accepted, candidateCount: initialSearchStatistics.candidateCount, rejections: initialSearchStatistics.rejectionCounts, reasons: [] };
  writeJson(join(output, 'report.json'), runReport);
  writeHumanReport(join(output, 'report.html'), runReport);
  const oldPointer = existsSync(join(output, 'latest.json')) ? readJson(join(output, 'latest.json')) : undefined;
  if (oldPointer && (oldPointer as {campaignPath:string}).campaignPath !== campaignPath) writeJson(join(output, 'previous.json'), oldPointer);
  writeJson(join(output, 'latest.json'), { campaignPath });
  console.log(JSON.stringify({ event: 'complete', campaignPath, count: 20 }));
  console.log(`Stage 1 ready: 20 verified levels. Run bun run playtest. Snapshot: ${campaignPath}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
