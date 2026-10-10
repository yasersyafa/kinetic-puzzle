import { mkdirSync, writeFileSync, renameSync, readFileSync, realpathSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash, stableProof,legacyHash } from './Integrity';
export { hash } from './Integrity';
import { levelContentVersion } from '../../../src/core/puzzle/LevelVersion';
import { RULES_VERSION } from '../../../src/core/puzzle/GameRules';
import { validateCatalog } from '../../../src/core/puzzle/LevelValidator';
import { replaySolution } from '../../../src/core/puzzle/SolutionReplay';
import { validateCampaign, type AcceptedCandidate } from '../director/CurriculumPlanner';
import { evaluateBounded } from '../evaluation/BoundedEvaluation';
import { validateApprovalContext } from '../evaluation/ApprovalContext';
import { validateStages, type CampaignStages } from '../../../src/core/campaign/Stage';
import { validateContext } from '../evaluation/EvaluationContext';

export const EXPORTER_VERSION='2.2.0';
export function safeOutput(path:string,root=resolve('generated')):string {
  const target=resolve(path),base=resolve(root),rel=relative(base,target);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Output must remain within generated/');
  // Existing symlink ancestors must not escape the approved root.
  let ancestor=target;while(!existsSync(ancestor))ancestor=dirname(ancestor);
  if(existsSync(base)){
    const realBase=realpathSync(base),realAncestor=realpathSync(ancestor),r=relative(realBase,realAncestor);
    if(r.startsWith('..')||isAbsolute(r))throw new Error('Output symlink escapes generated/');
  }else if(realpathSync(ancestor)!==ancestor)throw new Error('Output ancestor is a symlink');
  return target;
}
export function writeJson(path:string,value:unknown,pretty=true):void {
  const target=safeOutput(path);mkdirSync(dirname(target),{recursive:true});
  const temporary=`${target}.${randomUUID()}.tmp`;writeFileSync(temporary,JSON.stringify(value,null,pretty?2:undefined)+'\n');renameSync(temporary,target);
}
export function readJson<T>(path:string):T{return JSON.parse(readFileSync(path,'utf8')) as T;}
export interface RuntimeCampaign {
  schemaVersion:string; campaignId:string; campaignVersion:string; contentHash:string;rulesVersion:string;
  stageConfig?:CampaignStages;
  levels:import('../../../src/types/Game').LevelData[];
  auditHash?:string;auditVersion?:string;
  solutions:Record<number,import('../../../src/core/puzzle/GameRules').Action[]>;
  roles:Record<number,string>;
  tutorials:Record<number,{title:string;body:string}>;
}
export function runtimeHash(campaign:RuntimeCampaign):string {
  return ['2.0.0','2.1.0'].includes(campaign.schemaVersion)?hash({levels:campaign.levels,solutions:campaign.solutions,roles:campaign.roles,tutorials:campaign.tutorials,rulesVersion:campaign.rulesVersion,...(campaign.stageConfig?{stageConfig:campaign.stageConfig}:{})}):legacyHash({levels:campaign.levels,solutions:campaign.solutions});
}
export async function exportCampaign(accepted:AcceptedCandidate[],count:number,output:string,campaignId:string,signal?:AbortSignal,deadline=Infinity,generation:unknown={},stageConfig?:CampaignStages):Promise<RuntimeCampaign> {
  if(accepted.some(a=>a.candidate.contract.schemaVersion!=='2.0.0'))throw new Error('Legacy contracts require v2 reapproval before export');
  if(!/^[a-z0-9-]+$/.test(campaignId))throw new Error('Invalid campaign ID');
  if(stageConfig){const stageErrors=validateStages(stageConfig,accepted.map(a=>a.candidate.level));if(stageErrors.length)throw new Error(stageErrors.join('\n'));}
  const errors=validateCatalog(accepted.map(a=>a.candidate.level));if(errors.length)throw new Error('Final schema validation failed');
  const checkDeadline=()=>{if(signal?.aborted||Date.now()>=deadline)throw new Error('Export interrupted or deadline exceeded');};checkDeadline();
  const verified:AcceptedCandidate[]=[];const base=accepted[0]?.report.context;if(!base)throw new Error('Missing approval context');
  for(const entry of accepted){
    checkDeadline();const context=entry.report.context;if(!context)throw new Error('Legacy approval requires new evaluation context');validateContext(context);validateApprovalContext(context,base,verified);
    const proof=await evaluateBounded(entry.candidate.level,entry.candidate.contract,context,signal);
    if(proof.decision!=='ELIGIBLE')throw new Error(`Final verification failed L${entry.candidate.level.id}: ${proof.reasons.join(', ')}`);
    if(proof.solver?.optimalMoves!==entry.candidate.level.parMoves)throw new Error('parMoves does not match proven optimum');
    if(hash(proof.solver?.solutionPath)!==hash(entry.report.solver?.solutionPath))throw new Error('Solution changed after approval');
    if(hash(stableProof(proof))!==hash(stableProof(entry.report)))throw new Error('Approval differs from final verification');
    if(!replaySolution(entry.candidate.level,proof.solver!.solutionPath!).success)throw new Error('Final replay failed');
    verified.push({...entry,report:proof});
  }
  const validation=validateCampaign(verified,count,30,stageConfig);if(!validation.success)throw new Error(validation.errors.join('\n'));
  const levels=verified.map(a=>a.candidate.level),solutions=Object.fromEntries(verified.map(a=>[a.candidate.level.id,a.report.solver!.solutionPath!]));
  const roles=Object.fromEntries(verified.map(a=>[a.candidate.level.id,a.candidate.contract.progressionRole]));
  const tutorials=Object.fromEntries(verified.filter(a=>a.candidate.contract.progressionRole==='TEACH').map(a=>[a.candidate.level.id,{title:a.candidate.contract.primaryInsight,body:a.candidate.contract.learningObjective}]));
  const contracts=verified.map(a=>a.candidate.contract),reports=verified.map(a=>a.report),contexts=reports.map(r=>r.context!);
  const contentHash=hash({levels,solutions,roles,tutorials,rulesVersion:RULES_VERSION,...(stageConfig?{stageConfig}:{})});
  const provenance=verified.map(a=>a.candidate.provenance);
  const auditHash=hash({exporterVersion:EXPORTER_VERSION,contentHash,contracts,reports:stableProof(reports),validation,provenance,generation:stableProof(generation)});
  const version=contentHash.slice(0,12),auditVersion=auditHash.slice(0,12);
  const campaign:RuntimeCampaign={schemaVersion:stageConfig?'2.1.0':'2.0.0',...(stageConfig?{stageConfig}:{}),campaignId,campaignVersion:version,contentHash,auditHash,auditVersion,rulesVersion:RULES_VERSION,levels,solutions,roles,tutorials};
  const target=safeOutput(join(output,`${campaignId}-${version}-${auditVersion}`));
  const predictions=verified.map(a=>({campaignId,campaignVersion:version,levelId:a.candidate.level.id,levelVersion:levelContentVersion(a.candidate.level),score:a.report.difficulty!.score,modelVersion:a.report.difficulty!.modelVersion,features:a.report.difficulty!.features}));
  const files:Record<string,unknown>={'campaign.json':campaign,'contracts.json':contracts,'reports.json':reports,'contexts.json':contexts,'campaign-validation.json':validation,'predictions.json':predictions,'generation.json':generation};
  const manifest={schemaVersion:'2.0.0',exporterVersion:EXPORTER_VERSION,campaignId,campaignVersion:version,auditVersion,contentHash,auditHash,provenance,files:Object.fromEntries(Object.entries(files).map(([name,value])=>[name,hash(value)]))};
  if(existsSync(target)){
    const existing=readJson<typeof manifest>(join(target,'manifest.json'));
    const names=Object.keys(files).sort();
    if(existing.auditHash!==auditHash||existing.exporterVersion!==EXPORTER_VERSION||hash(Object.keys(existing.files).sort())!==hash(names)||names.some(name=>hash(readJson(join(target,name)))!==existing.files[name]))throw new Error('Immutable output integrity conflict');
    const savedCampaign=readJson<RuntimeCampaign>(join(target,'campaign.json'));
    const savedAudit=hash({exporterVersion:EXPORTER_VERSION,contentHash,contracts:readJson(join(target,'contracts.json')),reports:stableProof(readJson(join(target,'reports.json'))),validation:readJson(join(target,'campaign-validation.json')),provenance:existing.provenance,generation:stableProof(readJson(join(target,'generation.json')))});
    if(runtimeHash(savedCampaign)!==contentHash||savedAudit!==auditHash)throw new Error('Immutable audit integrity conflict');
    return readJson<RuntimeCampaign>(join(target,'campaign.json'));
  }
  const staging=safeOutput(`${target}.${randomUUID()}.staging`);mkdirSync(staging,{recursive:true});
  try{for(const [name,value]of Object.entries(files))writeJson(join(staging,name),value);writeJson(join(staging,'manifest.json'),manifest);checkDeadline();renameSync(staging,target);return campaign;}
  catch(e){rmSync(staging,{recursive:true,force:true});throw e;}
}
