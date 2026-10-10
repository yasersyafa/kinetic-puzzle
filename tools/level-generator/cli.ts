import { cpus } from 'node:os';
import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS, PACKS, SOLUTIONS } from '../../src/config/Levels';
import { RULES_VERSION } from '../../src/core/puzzle/GameRules';
import { validateCatalog, validateLevel } from '../../src/core/puzzle/LevelValidator';
import { replaySolution } from '../../src/core/puzzle/SolutionReplay';
import { solveBounded } from './core/BoundedSolver';
import { type SolverOptions } from './core/SolverV2';
import { readJson, writeJson, hash, safeOutput, type RuntimeCampaign,runtimeHash } from './output/Artifacts';
import { buildPipeline, runPipeline, type RunCheckpoint, type PipelineConfig } from './Pipeline';
import type { Candidate } from './generation/CandidateGenerator';
import { evaluateBounded } from './evaluation/BoundedEvaluation';
import { createEvaluationContext } from './evaluation/EvaluationContext';
import type { LevelData } from '../../src/types/Game';
import type { LevelDesignContract } from './director/DesignContract';
const commands=['generate','evaluate','build','validate','replay','report','calibrate','research','direct'];
async function main():Promise<void>{
  const {values,positionals}=parseArgs({allowPositionals:true,options:{
    help:{type:'boolean'},source:{type:'string',default:'existing'},input:{type:'string'},output:{type:'string'},run:{type:'string'},
    level:{type:'string'},count:{type:'string'},seed:{type:'string',default:'42'},'max-states':{type:'string',default:'200000'},
    'max-transitions':{type:'string',default:'2000000'},'timeout-ms':{type:'string',default:'5000'},'max-depth':{type:'string'},
    'attempts-per-slot':{type:'string',default:'300'},'candidate-budget':{type:'string',default:'10000'},'max-run-ms':{type:'string',default:'600000'},
    contracts:{type:'string'},reuse:{type:'string'},'campaign-id':{type:'string',default:'generated'},resume:{type:'boolean'},'require-advanced-targets':{type:'boolean'},'max-similarity':{type:'string'},
    model:{type:'string'},'calibration':{type:'string'},'director-url':{type:'string',default:process.env.LEVEL_AI_ENDPOINT_URL},'knowledge':{type:'string'},'pool-size':{type:'string',default:'5'},'beam-width':{type:'string',default:'32'},'ai-max-requests':{type:'string',default:'30'},'ai-max-tokens':{type:'string',default:'100000'},'ai-max-cost':{type:'string',default:'5'},
  }});
  const command=positionals[0];
  if(values.help){console.log(`Usage: npm run levels:<command> -- [options]\nCommands: ${commands.join(', ')}\n--source existing|campaign --input <file> --output <generated/path>\n--count N --seed N --contracts <file> --campaign-id <name> --resume --reuse <checkpoint.json>\n--max-states N --max-transitions N --timeout-ms N --max-depth N\n--attempts-per-slot N --candidate-budget N --max-run-ms N\n--level N (replay) --run <directory> (report)\n--director-url <configured JSON agent endpoint> --knowledge <file>\n--pool-size N --beam-width N --require-advanced-targets --max-similarity 0.9 --ai-max-requests N --ai-max-tokens N --ai-max-cost N\nExit codes: 0 success, 1 failed/unresolved, 2 usage/internal error.\nAI endpoint credentials: LEVEL_AI_API_KEY; never stored in artifacts.`);return;}
  if(positionals.length!==1)throw new Error('Exactly one command is required; use --help');
  if(!commands.includes(command))throw new Error(`Unknown command '${command}'. Use --help.`);
  const number=(key:keyof typeof values,defaultValue?:number):number=>{
    const raw=values[key];const n=raw===undefined?defaultValue:Number(raw);
    if(n===undefined||!Number.isSafeInteger(n)||n<0)throw new Error(`--${key} requires a nonnegative safe integer`);return n;
  };
  const solver:SolverOptions={maxStates:number('max-states'),maxTransitions:number('max-transitions'),timeoutMs:number('timeout-ms'),maxDepth:values['max-depth']!==undefined?number('max-depth'):undefined};
  const defaultOutput=resolve('generated/runs',`${command}-${Date.now()}`),output=safeOutput(values.output??defaultOutput);
  const log=(value:unknown)=>console.log(JSON.stringify(value));
  if(command==='report'){
    const dir=values.run??values.input;if(!dir)throw new Error('--run is required');
    const file=join(dir,existsSync(join(dir,'report.json'))?'report.json':existsSync(join(dir,'checkpoint.json'))?'checkpoint.json':'analysis.json');const report=readJson<Record<string,unknown>>(file);
    const summary={status:report.status,candidateCount:report.candidateCount,accepted:Array.isArray(report.accepted)?report.accepted.length:undefined,summary:report.summary,reasons:report.reasons};
    log(summary);writeJson(join(output,'summary.json'),summary);
    const {writeHumanReport}=await import('./output/ReportWriter');writeHumanReport(join(output,'report.html'),report);return;
  }
  if(command==='calibrate'){
    if(!values.input||!values.source||values.source==='existing')throw new Error('Use --input <telemetry.jsonl> --source <predictions.json>');
    const {calibrate}=await import('./analytics/Calibration');
    const rows=readFileSync(values.input,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
    const report=calibrate(rows,readJson(values.source));writeJson(join(output,'calibration.json'),report);if(report.fitting.status==='FITTED'){const {DEFAULT_MODEL}=await import('./evaluation/EvaluationContext');writeJson(join(output,'model-proposal.json'),{...DEFAULT_MODEL,version:`calibrated-${hash(report.fitting.model).slice(0,12)}`,fit:report.fitting.model});}log(report);return;
  }
  if(command==='research'||command==='direct'){
    const {runAgentTask}=await import('./director/AgentProvider');
    if(!values['director-url'])throw new Error('--director-url is required for AI operation');
    const taskInput=values.input?readJson(values.input):{count:number('count',80),mechanics:['sliding','constrained','dependent','obstacle','lock','ice'],existingCatalog:LEVELS};
    const knowledge=values.knowledge?readJson(values.knowledge):undefined;
    const result=await runAgentTask(values['director-url'],command,{constraints:taskInput,knowledge},output);
    writeJson(join(output,`${command}.json`),result);log({event:command,output});return;
  }
  if(command==='generate'||command==='build'){
    const count=number('count',command==='build'?80:10);if(count<1||count>80)throw new Error('--count must be between 1 and 80');
    let proposals: PipelineConfig['proposals'];
    let plannedContracts = values.contracts ? readJson<LevelDesignContract[]>(values.contracts) : undefined;
    const config:PipelineConfig={count,seed:number('seed'),attemptsPerSlot:number('attempts-per-slot'),candidateBudget:number('candidate-budget'),maxRunMs:number('max-run-ms'),output,solver,campaignId:values['campaign-id']!,resume:values.resume??false,
      difficultyModel:values.model?readJson(values.model):undefined,requireAdvancedTargets:values['require-advanced-targets']??false,maxSimilarity:values['max-similarity']===undefined?undefined:Number(values['max-similarity']),poolSize:number('pool-size'),beamWidth:number('beam-width'),agentUrl:values['director-url'],maxAIRequests:number('ai-max-requests'),maxAITokens:number('ai-max-tokens'),maxAICost:number('ai-max-cost'),
      contracts:plannedContracts,proposals,reuse:values.reuse?readJson<RunCheckpoint>(values.reuse).accepted:undefined};
    if(config.agentUrl){
      const {prepareAutonomous}=await import('./director/AutonomousWorkflow');
      const planned=await prepareAutonomous(config,{knowledge:values.knowledge?readJson(values.knowledge):undefined,calibration:values.calibration?readJson(values.calibration):undefined});
      config.contracts=planned.contracts;config.proposals=planned.proposals;
    }
    if(!config.attemptsPerSlot||!config.candidateBudget)throw new Error('Generation budgets must be positive');
    const controller=new AbortController();const cancel=()=>controller.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
    let run:RunCheckpoint;
    try{run=command==='build'?await buildPipeline(config,controller.signal,log):await runPipeline(config,controller.signal,log);}
    finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
    if(values['director-url']) {
      const {runAgentTask} = await import('./director/AgentProvider');
      try { const {agentOptions}=await import('./director/AutonomousWorkflow');await runAgentTask(values['director-url'], 'critic', { accepted: run.accepted.map(a=>a.report), rejections: run.rejections, rule: 'Gate decisions are immutable; feedback is advisory.' }, output,agentOptions(config)); }
      catch(e) { log({event:'critic-unavailable',reason:e instanceof Error?e.message:'Unknown'}); }
    }
    log({event:'summary',status:run.status,candidates:run.candidateCount,accepted:run.accepted.length,reasons:run.reasons,output});if(run.status!=='COMPLETE')process.exitCode=1;return;
  }
  let levels=LEVELS,solutions=SOLUTIONS;let campaign:RuntimeCampaign|undefined;
  if(values.input){
    const input=readJson<unknown>(values.input);
    if(Array.isArray(input))levels=input as LevelData[];
    else if(input&&typeof input==='object'&&'levels'in input){campaign=input as RuntimeCampaign;levels=campaign.levels;solutions=campaign.solutions;}
    else if(input&&typeof input==='object'&&'contract'in input){
      if(command!=='evaluate')throw new Error('Candidate files require evaluate');const candidate=input as Candidate;
      const result=await evaluateBounded(candidate.level,candidate.contract,createEvaluationContext(LEVELS,solver));writeJson(join(output,'evaluation.json'),result);log(result);if(result.decision!=='ELIGIBLE')process.exitCode=1;return;
    }else throw new Error('Input must be level array, campaign or candidate');
  }else if(values.source!=='existing')throw new Error('--input is required for non-existing source');
  const issues=validateCatalog(levels,{packIds:campaign?undefined:PACKS.map(p=>p.id)});
  if(issues.length){writeJson(join(output,'validation.json'),{success:false,issues});log({event:'schema-failed',issues});process.exitCode=1;return;}
  if(campaign&&(campaign.rulesVersion!==RULES_VERSION||campaign.contentHash!==runtimeHash(campaign))){log({event:'campaign-integrity-failed'});process.exitCode=1;return;}
  if(command==='validate'&&campaign){const {verifyExport}=await import('./verify-export');const verified=await verifyExport(values.input!);writeJson(join(output,'validation.json'),{success:true,verified:verified.levels.length,contentHash:verified.contentHash,auditHash:verified.auditHash});log({event:'verified',count:verified.levels.length});return;}
  if(command==='replay'){
    const id=number('level');const level=levels.find(l=>l.id===id);if(!level)throw new Error(`Level ${id} not found`);
    const replay=replaySolution(level,solutions[id]??[]);const result={levelId:id,success:replay.success,failedAction:replay.failedAction,reason:replay.reason,actions:replay.transitions.length};
    writeJson(join(output,'replay.json'),result);log(result);if(!replay.success)process.exitCode=1;return;
  }
  const auditLevels=values.level?levels.filter(l=>l.id===number('level')):levels;if(!auditLevels.length)throw new Error('Requested audit level does not exist');
  const auditStarted=Date.now();const reports=[];
  for(const level of auditLevels){
    const result=await solveBounded(level,solver),stored=replaySolution(level,solutions[level.id]??[]);
    const verified=result.status==='SOLVED'&&result.optimalityProven&&replaySolution(level,result.solutionPath!).success;
    reports.push({levelId:level.id,contentHash:hash(level),schema:validateLevel(level),solver:result,storedReplay:{success:stored.success,failedAction:stored.failedAction,reason:stored.reason},existingPar:level.parMoves,parDelta:result.optimalMoves===undefined?undefined:level.parMoves-result.optimalMoves,verified});
    log({event:'evaluated',levelId:level.id,status:result.status,optimalMoves:result.optimalMoves,storedReplay:stored.success});
  }
  const summary={total:reports.length,verified:reports.filter(r=>r.verified).length,unresolved:reports.filter(r=>['TIMEOUT','RESOURCE_LIMIT'].includes(r.solver.status)).length,storedReplayFailures:reports.filter(r=>!r.storedReplay.success).length,parMismatches:reports.filter(r=>r.parDelta!==undefined&&r.parDelta!==0).length};
  writeJson(join(output,'analysis.json'),{rulesVersion:RULES_VERSION,reports,summary,benchmark:{nodeVersion:process.version,platform:process.platform,arch:process.arch,cpuModel:cpus()[0]?.model,cpuCount:cpus().length,solverBudget:solver,wallMs:Date.now()-auditStarted}});log({event:'summary',...summary,output});
  if(summary.verified!==summary.total||summary.storedReplayFailures)process.exitCode=1;
}
main().catch(error=>{console.error(JSON.stringify({event:'error',message:error instanceof Error?error.message:'Unknown error'}));process.exitCode=2;});
