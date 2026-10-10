import { Worker } from 'node:worker_threads';
import type { LevelData } from '../../../src/types/Game';
import type { LevelDesignContract } from '../director/DesignContract';
import type { EvaluationContext } from './EvaluationContext';
import { EVALUATOR_VERSION,type EvaluationReport } from './Evaluators';
export function evaluateBounded(level:LevelData,contract:LevelDesignContract,context:EvaluationContext,signal?:AbortSignal):Promise<EvaluationReport>{
  return new Promise(resolve=>{
    let done=false;
    const fallback=(reason:string,failed=false):EvaluationReport=>({levelId:level.id,contractId:contract.contractId,decision:failed?'REJECT':'HOLD',gates:{performance:failed?'FAIL':'UNKNOWN'},reasons:[reason],evidence:[],softPenalty:100,evaluatorVersion:EVALUATOR_VERSION,context});
    if(signal?.aborted){resolve(fallback('Interrupted'));return;}
    const worker=new Worker(`const {register}=require('tsx/cjs/api');register();const {parentPort,workerData}=require('node:worker_threads');const {evaluate}=require(${JSON.stringify(new URL('./Evaluators.ts',import.meta.url).pathname)});parentPort.postMessage(evaluate(workerData.level,workerData.contract,[],{},[],workerData.context));`,{eval:true,workerData:{level,contract,context},resourceLimits:{maxOldGenerationSizeMb:256}});
    const finish=(report:EvaluationReport)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();resolve(report);};
    const abort=()=>finish(fallback('Interrupted'));
    const timer=setTimeout(()=>finish(fallback('Evaluation watchdog TIMEOUT')),(context.budget.timeoutMs??5000)+2000);
    signal?.addEventListener('abort',abort,{once:true});
    worker.once('message',finish);worker.once('error',(e:Error&{code?:string})=>finish(fallback(e.code==='ERR_WORKER_OUT_OF_MEMORY'?'RESOURCE_LIMIT':e.message,e.code!=='ERR_WORKER_OUT_OF_MEMORY')));
    worker.once('exit',code=>{if(!done)finish(fallback(`Evaluation worker exit ${code}`,true));});
  });
}
