import type { AttemptTelemetry } from '../../../src/systems/PlayerTelemetry';
export type { AttemptTelemetry } from '../../../src/systems/PlayerTelemetry';
export interface Prediction {campaignId:string;campaignVersion:string;levelId:number;levelVersion:string;score:number;modelVersion:string;features?:Record<string,number>}
type RatedAttempt = AttemptTelemetry & { reportedDifficulty?:number };
export function validateTelemetry(value:unknown):value is RatedAttempt {
  if(!value||typeof value!=='object')return false;const v=value as RatedAttempt;
  return ['1.0.0','2.0.0'].includes(v.schemaVersion)&&[v.campaignId,v.campaignVersion,v.levelVersion,v.attemptId].every(s=>typeof s==='string'&&s.length>0)&&Number.isInteger(v.levelId)&&v.levelId>0&&typeof v.completed==='boolean'&&[v.completionTimeMs,v.moveCount,v.undoCount,v.restartCount,v.hintCount,v.deadEndCount].every(n=>Number.isFinite(n)&&n>=0)&&[v.moveCount,v.undoCount,v.restartCount,v.hintCount,v.deadEndCount].every(Number.isInteger)&&(v.schemaVersion!=='2.0.0'||(typeof v.testerId==='string'&&!!v.testerId&&typeof v.sessionId==='string'&&!!v.sessionId&&v.timeBasis==='ACTIVE'))&&['HUMAN','AUTOPLAY'].includes(v.mode)&&(v.reportedDifficulty===undefined||(Number.isFinite(v.reportedDifficulty)&&v.reportedDifficulty>=1&&v.reportedDifficulty<=5));
}
const median=(values:number[]):number|undefined=>{if(!values.length)return;const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
export function calibrate(rows:unknown[],predictions:Prediction[]){
  if(!Array.isArray(predictions)||predictions.some(p=>!p||!Number.isFinite(p.score)||p.score<0||p.score>100||!p.modelVersion||!p.levelVersion||!p.campaignId||!p.campaignVersion||!Number.isInteger(p.levelId)))throw new Error('Invalid predictions');
  const valid:RatedAttempt[]=[];const seen=new Set<string>();let excludedAutoplay=0;
  for(const row of rows){if(!validateTelemetry(row))throw new Error('Invalid attempt telemetry');if(row.mode==='AUTOPLAY'){excludedAutoplay++;continue;}const id=`${row.campaignId}:${row.campaignVersion}:${row.attemptId}`;if(seen.has(id))throw new Error('Duplicate attempt ID');seen.add(id);valid.push(row);}
  const report=predictions.map(p=>{
    const attempts=valid.filter(v=>v.campaignId===p.campaignId&&v.campaignVersion===p.campaignVersion&&v.levelId===p.levelId&&v.levelVersion===p.levelVersion);
    const completed=attempts.filter(v=>v.completed),completionRate=attempts.length?completed.length/attempts.length:undefined;
    const hintRate=attempts.length?attempts.filter(a=>a.hintCount>0).length/attempts.length:undefined;
    const testerCount=new Set(attempts.flatMap(a=>a.testerId?[a.testerId]:[])).size;
    const recommendations:string[]=[];
    if(attempts.length<10||testerCount<5)recommendations.push('Collect more human attempts before changing model');
    else {if(completionRate!<0.4)recommendations.push('Review difficulty or clarity; low completion is a correlation, not a cause');if(hintRate!>0.5)recommendations.push('Review mechanic explanation and solution readability');}
    const firstByTester=new Map<string,RatedAttempt>();for(const a of attempts)if(a.testerId&&!firstByTester.has(a.testerId))firstByTester.set(a.testerId,a);
    const independent=[...firstByTester.values()],n=independent.length,firstRate=n?independent.filter(a=>a.completed).length/n:undefined,z=1.96;
    const center=n?(firstRate!+z*z/(2*n))/(1+z*z/n):0,margin=n?z*Math.sqrt(firstRate!*(1-firstRate!)/n+z*z/(4*n*n))/(1+z*z/n):0;
    const reported=median(attempts.flatMap(a=>a.reportedDifficulty===undefined?[]:[a.reportedDifficulty]));
    return {...p,testerCount,status:testerCount<5?'INSUFFICIENT_DATA':'OBSERVATIONAL',firstObservedTesterCompletionRate:firstRate,firstObservedTesterCompletionInterval95:n?[Math.max(0,center-margin),Math.min(1,center+margin)]:undefined,predictedReportedDifficulty:1+p.score/25,ratingResidual:reported===undefined?undefined:reported-(1+p.score/25),medianUnassistedCompletionTimeMs:median(completed.filter(a=>a.hintCount===0).map(a=>a.completionTimeMs)),attemptCount:attempts.length,completionRate,medianCompletionTimeMs:median(completed.map(v=>v.completionTimeMs)),medianMoves:median(completed.map(v=>v.moveCount)),medianUndo:median(attempts.map(v=>v.undoCount)),medianRestart:median(attempts.map(v=>v.restartCount)),hintRate,medianReportedDifficulty:median(attempts.flatMap(a=>a.reportedDifficulty===undefined?[]:[a.reportedDifficulty])),recommendations};
  });
  return {schemaVersion:'2.0.0',calibrationVersion:'observational-2.0.0',excludedAutoplay,levels:report,fitting:fitDifficulty(valid,predictions),policy:'Recommendations only; no automatic causal claims or model replacement'};
}

export interface FittedDifficultyModel {version:string;featureNames:string[];means:number[];scales:number[];coefficients:number[];intercept:number}
export function predictRating(model:FittedDifficultyModel,features:Record<string,number>):number {
  const prediction=model.intercept+model.featureNames.reduce((sum,k,i)=>sum+model.coefficients[i]*(features[k]-model.means[i])/model.scales[i],0);
  if(!Number.isFinite(prediction))throw new Error('Difficulty model produces non-finite predictions');
  return Math.max(1,Math.min(5,prediction));
}
export function fitDifficulty(rows:RatedAttempt[],predictions:Prediction[],minimumTesters=20,minimumRatings=100){
  const rawSamples=rows.flatMap(row=>{const p=predictions.find(p=>p.campaignId===row.campaignId&&p.campaignVersion===row.campaignVersion&&p.levelId===row.levelId&&p.levelVersion===row.levelVersion);return row.mode==='HUMAN'&&row.testerId&&row.reportedDifficulty!==undefined&&p?.features?[{row,p}]:[];});
  const unique=new Map<string,typeof rawSamples>();for(const sample of rawSamples){const k=`${sample.row.testerId}:${sample.p.campaignId}:${sample.p.campaignVersion}:${sample.p.levelId}:${sample.p.levelVersion}`;unique.set(k,[...(unique.get(k)??[]),sample]);}
  const samples=[...unique.values()].map(group=>({...group[0],row:{...group[0].row,reportedDifficulty:median(group.map(s=>s.row.reportedDifficulty!))!}}));
  const testers=[...new Set(samples.map(s=>s.row.testerId!))].sort();
  if(testers.length<minimumTesters||samples.length<minimumRatings||new Set(samples.map(s=>`${s.row.campaignId}:${s.row.campaignVersion}:${s.row.levelId}:${s.row.levelVersion}`)).size<5)return {status:'INSUFFICIENT_DATA',testerCount:testers.length,ratingCount:samples.length};
  const names=Object.keys(samples[0].p.features!).sort();
  if(!names.length||samples.some(s=>names.some(k=>!Number.isFinite(s.p.features![k]))||Object.keys(s.p.features!).sort().join('|')!==names.join('|')))throw new Error('Inconsistent calibration feature vectors');
  const heldOut=new Set(testers.filter((_,i)=>i%5===0));
  const train=samples.filter(s=>!heldOut.has(s.row.testerId!)),test=samples.filter(s=>heldOut.has(s.row.testerId!));
  const means=names.map(k=>train.reduce((sum,s)=>sum+s.p.features![k],0)/train.length);
  const scales=names.map((k,i)=>Math.sqrt(train.reduce((sum,s)=>sum+(s.p.features![k]-means[i])**2,0)/train.length)||1);
  const vectors=train.map(s=>[1,...names.map((k,i)=>(s.p.features![k]-means[i])/scales[i])]);
  const n=names.length+1,matrix=Array.from({length:n},()=>Array(n+1).fill(0) as number[]);
  vectors.forEach((x,index)=>{for(let i=0;i<n;i++){for(let j=0;j<n;j++)matrix[i][j]+=x[i]*x[j];matrix[i][n]+=x[i]*train[index].row.reportedDifficulty!;}});
  for(let i=1;i<n;i++)matrix[i][i]+=10; // Fixed ridge penalty, never tuned against held-out testers.
  for(let i=0;i<n;i++){
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;
    [matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];const divisor=matrix[i][i];if(Math.abs(divisor)<1e-10)throw new Error('Singular calibration matrix');
    for(let j=i;j<=n;j++)matrix[i][j]/=divisor;
    for(let row=0;row<n;row++)if(row!==i){const factor=matrix[row][i];for(let j=i;j<=n;j++)matrix[row][j]-=factor*matrix[i][j];}
  }
  const model:FittedDifficultyModel={version:'calibrated-ridge-2.0.0',featureNames:names,means,scales,intercept:matrix[0][n],coefficients:matrix.slice(1).map(row=>row[n])};
  const heldOutMAE=test.reduce((sum,s)=>sum+Math.abs(predictRating(model,s.p.features!)-s.row.reportedDifficulty!),0)/test.length;
  const baselineMAE=test.reduce((sum,s)=>sum+Math.abs(1+s.p.score/25-s.row.reportedDifficulty!),0)/test.length;
  return {status:'FITTED',model,trainingTesters:testers.filter(t=>!heldOut.has(t)),heldOutTesters:[...heldOut],trainingRows:train.length,heldOutRows:test.length,heldOutMAE,baselineMAE,promotion:'MANUAL_PRODUCT_POLICY',recommended:heldOutMAE<baselineMAE,policy:'Tester-disjoint evaluation; observational associations only'};
}
