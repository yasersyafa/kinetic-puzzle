import { validateStages } from '../../src/core/campaign/Stage';
import { readJson, hash,runtimeHash,type RuntimeCampaign,EXPORTER_VERSION } from './output/Artifacts';
import { stableProof } from './output/Integrity';
import { levelContentVersion } from '../../src/core/puzzle/LevelVersion';
import { RULES_VERSION } from '../../src/core/puzzle/GameRules';
import { validateCatalog } from '../../src/core/puzzle/LevelValidator';
import { evaluateBounded } from './evaluation/BoundedEvaluation';
import type { EvaluationReport } from './evaluation/Evaluators';
import { validateCampaign,type AcceptedCandidate } from './director/CurriculumPlanner';
import { fileURLToPath } from 'node:url';
import { join,dirname,resolve } from 'node:path';
import type { LevelDesignContract } from './director/DesignContract';
import { validateApprovalContext } from './evaluation/ApprovalContext';
import type { EvaluationContext } from './evaluation/EvaluationContext';
export async function verifyExport(file:string):Promise<RuntimeCampaign>{
  const dir=dirname(file),campaign=readJson<RuntimeCampaign>(file),contracts=readJson<LevelDesignContract[]>(join(dir,'contracts.json'));
  if(!/^[a-z0-9-]+$/.test(campaign.campaignId)||campaign.campaignVersion!==campaign.contentHash.slice(0,12)||campaign.auditVersion!==campaign.auditHash?.slice(0,12))throw new Error('Campaign identity mismatch');
  if(!['2.0.0','2.1.0'].includes(campaign.schemaVersion))throw new Error('Legacy campaign requires reapproval under v2 policies');
  if(campaign.rulesVersion!==RULES_VERSION||campaign.contentHash!==runtimeHash(campaign))throw new Error('Campaign integrity/version mismatch');
  const contexts=readJson<EvaluationContext[]>(join(dir,'contexts.json')),reports=readJson<EvaluationReport[]>(join(dir,'reports.json'));
  const manifest=readJson<{files:Record<string,string>;auditHash:string;exporterVersion:string;provenance:unknown}>(join(dir,'manifest.json'));
  if(manifest.exporterVersion!==EXPORTER_VERSION)throw new Error('Exporter policy version mismatch; reexport required');
  for(const name of ['campaign.json','contracts.json','reports.json','contexts.json','campaign-validation.json','predictions.json','generation.json'])if(manifest.files[name]!==hash(readJson(join(dir,name))))throw new Error(`Artifact integrity mismatch: ${name}`);
  const validation=readJson(join(dir,'campaign-validation.json'));
  if(campaign.auditHash!==hash({exporterVersion:EXPORTER_VERSION,contentHash:campaign.contentHash,contracts,reports:stableProof(reports),validation,provenance:manifest.provenance,generation:stableProof(readJson(join(dir,'generation.json')))})||manifest.auditHash!==campaign.auditHash)throw new Error('Audit identity mismatch');
  if(campaign.schemaVersion==='2.1.0'&&!campaign.stageConfig)throw new Error('Missing stage configuration');
  if(campaign.stageConfig){const stageErrors=validateStages(campaign.stageConfig,campaign.levels);if(stageErrors.length)throw new Error(stageErrors.join('\n'));}
  const errors=validateCatalog(campaign.levels);if(errors.length)throw new Error('Invalid campaign schema');
  if([contracts.length,contexts.length,reports.length].some(n=>n!==campaign.levels.length))throw new Error('Audit count mismatch');
  const accepted:AcceptedCandidate[]=[];
  for(let i=0;i<campaign.levels.length;i++){
    validateApprovalContext(contexts[i],contexts[0],accepted);
    const level=campaign.levels[i],contract=contracts[i],report=await evaluateBounded(level,contract,contexts[i]);
    if(report.decision!=='ELIGIBLE'||hash(stableProof(report))!==hash(stableProof(reports[i])))throw new Error(`L${level.id}: verification differs: ${report.reasons.join(', ')}`);
    if(report.solver!.optimalMoves!==level.parMoves||hash(report.solver!.solutionPath)!==hash(campaign.solutions[level.id]))throw new Error(`L${level.id}: par/solution mismatch`);
    accepted.push({candidate:{candidateId:`verify-${level.id}`,level,contract,provenance:{seed:0,attempt:0,generatorVersion:'verification',strategy:'reuse'}},report});
  }
  const expectedPredictions=accepted.map(a=>({campaignId:campaign.campaignId,campaignVersion:campaign.campaignVersion,levelId:a.candidate.level.id,levelVersion:levelContentVersion(a.candidate.level),score:a.report.difficulty!.score,modelVersion:a.report.difficulty!.modelVersion,features:a.report.difficulty!.features}));
  if(hash(readJson(join(dir,'predictions.json')))!==hash(expectedPredictions))throw new Error('Prediction data differs from verified reports');
  const checked=validateCampaign(accepted,campaign.levels.length,30,campaign.stageConfig);if(!checked.success)throw new Error(checked.errors.join('\n'));
  const roles=Object.fromEntries(accepted.map(a=>[a.candidate.level.id,a.candidate.contract.progressionRole]));
  const tutorials=Object.fromEntries(accepted.filter(a=>a.candidate.contract.progressionRole==='TEACH').map(a=>[a.candidate.level.id,{title:a.candidate.contract.primaryInsight,body:a.candidate.contract.learningObjective}]));
  if(hash(roles)!==hash(campaign.roles)||hash(tutorials)!==hash(campaign.tutorials))throw new Error('Runtime curriculum metadata differs from contracts');
  return campaign;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))verifyExport(process.argv[2]).then(campaign=>console.log(JSON.stringify({verified:campaign.levels.length,campaign}))).catch(e=>{console.error(e instanceof Error?e.message:'Verification failed');process.exitCode=1;});
