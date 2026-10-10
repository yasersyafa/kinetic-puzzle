import { Worker } from 'node:worker_threads';
import type { LevelData } from '../../../src/types/Game';
import { SOLVER_VERSION, type SolverOptions, type SolverResult } from './SolverV2';
export function solveBounded(level:LevelData,options:SolverOptions={}):Promise<SolverResult> {
  if(options.allowTransition)throw new Error('Function predicates cannot cross worker boundaries');
  const started=Date.now();
  return new Promise(resolve=>{
    let finished=false;
    // tsx/api registers the loader inside the worker, independently of CLI launch flags.
    const worker=new Worker(`const { register } = require('tsx/cjs/api'); register(); require(${JSON.stringify(new URL('./SolverWorker.ts',import.meta.url).pathname)});`,{
      eval:true,workerData:{level,options},resourceLimits:{maxOldGenerationSizeMb:256},
    });
    const fallback=(status:SolverResult['status'],reason:string):SolverResult=>({status,reason,optimalityProven:false,visitedStates:0,exploredTransitions:0,elapsedMs:Date.now()-started,solverVersion:SOLVER_VERSION});
    const finish=(r:SolverResult)=>{if(finished)return;finished=true;clearTimeout(timer);void worker.terminate();resolve(r);};
    const timer=setTimeout(()=>finish(fallback('TIMEOUT','Worker watchdog')), (options.timeoutMs??5000)+2000);
    worker.once('message',(r:SolverResult)=>finish(r));
    worker.once('error',(e:Error&{code?:string})=>finish(fallback(e.code==='ERR_WORKER_OUT_OF_MEMORY'?'RESOURCE_LIMIT':'ERROR',e.message)));
    worker.once('exit',code=>{if(!finished)finish(fallback('ERROR',`Worker exited without result (${code})`));});
  });
}
