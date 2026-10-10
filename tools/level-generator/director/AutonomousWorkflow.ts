import { applyProductPolicy } from '../generation/ProductPolicy';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PipelineConfig } from '../Pipeline';
import type { Candidate } from '../generation/CandidateGenerator';
import type { LevelDesignContract } from './DesignContract';
import type { EvaluationReport } from '../evaluation/Evaluators';
import { runAgentTask,PROMPT_VERSION,type AgentOptions } from './AgentProvider';
import { hash,readJson,writeJson } from '../output/Artifacts';
import { RULES_VERSION } from '../../../src/core/puzzle/GameRules';
import { requireAdvancedTargets } from './DifficultyTargets';
import { DEFAULT_MODEL } from '../evaluation/EvaluationContext';
import { limitSimilarity } from './DiversityTargets';
export async function prepareAutonomous(config:PipelineConfig,knowledge?:unknown):Promise<{contracts:LevelDesignContract[];proposals:NonNullable<PipelineConfig['proposals']>}>{
  if(!config.agentUrl)throw new Error('AI endpoint required');
  const model=config.difficultyModel??DEFAULT_MODEL;
  if(config.maxSimilarity!==undefined)limitSimilarity([],config.maxSimilarity);
  const input={constraints:{count:config.count,seed:config.seed,rulesVersion:RULES_VERSION,immutableGates:true,exitCount:1,blockColors:{simple:'red',constrained:'yellow',dependent:'blue',lock:'purple'},mechanics:['sliding','constrained','dependent','obstacle','lock','ice'],...(config.maxSimilarity===undefined?{}:{maxStructuralSimilarity:config.maxSimilarity}),...(config.requireAdvancedTargets?{advancedDifficultyPolicy:{HARD:model.thresholds[2],EXPERT:model.thresholds[3],excludeRelief:true,modelVersion:model.version}}:{})},knowledge};
  const file=join(config.output,'ai-plan.json'),inputHash=hash({input,endpoint:new URL(config.agentUrl).toString(),promptVersion:PROMPT_VERSION,researchSources:process.env.LEVEL_RESEARCH_SOURCES,researchSearch:process.env.LEVEL_RESEARCH_SEARCH_URL});
  if(existsSync(file)){const cached=readJson<{inputHash:string;plan:{contracts:LevelDesignContract[];proposals:NonNullable<PipelineConfig['proposals']>};integrityHash:string}>(file);if(cached.integrityHash!==hash({...cached,integrityHash:undefined}))throw new Error('AI plan integrity mismatch');if(cached.inputHash!==inputHash)throw new Error('AI planning input mismatch');return cached.plan;}
  if(config.resume)throw new Error('Resume requires persisted AI plan');
  const supplied=knowledge&&typeof knowledge==='object'&&'knowledge' in knowledge?(knowledge as {knowledge?:unknown}).knowledge:knowledge;
  if(!supplied&&(process.env.LEVEL_RESEARCH_SOURCES||process.env.LEVEL_RESEARCH_SEARCH_URL)){const sources=process.env.LEVEL_RESEARCH_SOURCES?.split(',').filter(Boolean);const research=await runAgentTask(config.agentUrl,'research',{constraints:{sources,query:'Sliding puzzle design, learning progression and difficulty'}},config.output,agentOptions(config));input.knowledge={...(knowledge&&typeof knowledge==='object'?knowledge:{}),knowledge:research.output};}
  const director=await runAgentTask(config.agentUrl,'direct',input,config.output,agentOptions(config));
  const proposedContracts=applyProductPolicy((director.output as {contracts:LevelDesignContract[]}).contracts);
  const difficultyContracts=config.requireAdvancedTargets?requireAdvancedTargets(proposedContracts,model):proposedContracts;
  const contracts=config.maxSimilarity===undefined?difficultyContracts:limitSimilarity(difficultyContracts,config.maxSimilarity);
  if(contracts.length!==config.count||contracts.some(c=>c.schemaVersion!=='2.0.0'))throw new Error('Director must produce count-matched v2 contracts');
  let architect;
  try{architect=await runAgentTask(config.agentUrl,'architect',{contracts,rulesVersion:RULES_VERSION},config.output,agentOptions(config));}
  catch(e){const plan={contracts,proposals:[]};const saved={inputHash,plan,fallback:'PROCEDURAL',architectFailure:e instanceof Error?e.message:'Architect unavailable'};writeJson(file,{...saved,integrityHash:hash(saved)});return plan;}
  const plan={contracts,proposals:(architect.output as {proposals:NonNullable<PipelineConfig['proposals']>}).proposals.map(p=>({...p,ai:{modelId:architect.modelId,...architect.provenance!}}))};
  if(plan.proposals.some(p=>!contracts.some(c=>c.contractId===p.contractId)))throw new Error('Architect proposal references unknown contract');
  writeJson(file,{inputHash,plan,integrityHash:hash({inputHash,plan})});return plan;
}
export function agentOptions(config:PipelineConfig):AgentOptions{return {maxRequests:config.maxAIRequests??30,maxTokens:config.maxAITokens??100000,maxCost:config.maxAICost??5};}
export async function revisionProposal(config:PipelineConfig,contract:LevelDesignContract,candidate:Candidate,report:EvaluationReport):Promise<Candidate|undefined>{
  if(!config.agentUrl)return;
  const feedback={contract,candidate:candidate.level,evaluation:report,policy:'Contract and gates immutable. Revise candidate only. No playtest claims.'};
  const critic=await runAgentTask(config.agentUrl,'critic',feedback,config.output,agentOptions(config));
  // Director receives failure feedback but may only recommend strategy within frozen contracts.
  const director=await runAgentTask(config.agentUrl,'direct',{constraints:{count:1,contracts:[contract],immutableGates:true,exitCount:1,blockColors:{simple:'red',constrained:'yellow',dependent:'blue',lock:'purple'}},feedback,critic:critic.output},config.output,agentOptions(config));
  const returned=(director.output as {contracts:LevelDesignContract[]}).contracts;
  if(returned.length!==1||hash(returned[0])!==hash(contract))throw new Error('Director revision changed frozen product contract');
  const architect=await runAgentTask(config.agentUrl,'architect',{contracts:[contract],feedback,critic:critic.output,strategy:(director.output as {strategy:string}).strategy},config.output,agentOptions(config));
  const proposal=(architect.output as {proposals:NonNullable<PipelineConfig['proposals']>}).proposals.find(p=>p.contractId===contract.contractId);
  if(!proposal)return;
  return {...structuredClone(candidate),candidateId:`${contract.contractId}-a${candidate.provenance.attempt+1}`,level:{...proposal.level,id:candidate.level.id,pack:contract.targetDifficulty.toLowerCase()},provenance:{...candidate.provenance,attempt:candidate.provenance.attempt+1,strategy:'ai',parentId:candidate.candidateId,ai:{modelId:architect.modelId,...architect.provenance!}}};
}
