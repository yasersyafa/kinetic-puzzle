import { readFileSync } from 'node:fs';
const file=process.argv[2];
try{
  const report=JSON.parse(readFileSync(file,'utf8')) as {reports:{levelId:number;solver:{status:string};storedReplay:{success:boolean}}[]};
  if(!Array.isArray(report.reports)||report.reports.length!==80)throw new Error('Incomplete existing campaign audit');
  const blocking=report.reports.filter(r=>['UNSOLVABLE','ERROR'].includes(r.solver.status)||!r.storedReplay.success);
  if(blocking.length)throw new Error(`Blocking audit failures: ${blocking.map(r=>`${r.levelId}:${r.solver.status}`).join(', ')}`);
  const unresolved=report.reports.filter(r=>['TIMEOUT','RESOURCE_LIMIT'].includes(r.solver.status));
  console.log(JSON.stringify({blocking:0,unresolved:unresolved.map(r=>r.levelId),policy:'Unresolved audits remain unresolved; never approved by this check'}));
}catch(e){console.error(e instanceof Error?e.message:'Invalid audit');process.exitCode=1;}
