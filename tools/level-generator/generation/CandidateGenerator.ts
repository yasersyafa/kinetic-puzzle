import { interactiveProposal } from './InteractiveProposal';
import type { LevelData, BlockData, Direction, ExitSide } from '../../../src/types/Game';
import { createState,gameRules } from '../../../src/core/puzzle/GameRules';
import { solve } from '../core/SolverV2';
import type { EvaluationReport } from '../evaluation/Evaluators';
import type { LevelDesignContract } from '../director/DesignContract';
import { advancedTemplate } from './AdvancedTemplates';
export const GENERATOR_VERSION='3.1.0';
export class SeededRandom {
  constructor(public state:number) {this.state>>>=0;}
  next():number {this.state=(this.state+0x6d2b79f5)>>>0;let x=this.state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;}
  int(min:number,max:number):number{return min+Math.floor(this.next()*(max-min+1));}
  pick<T>(items:readonly T[]):T{return items[this.int(0,items.length-1)];}
}
export interface Candidate { candidateId:string; level:LevelData; contract:LevelDesignContract; provenance:{seed:number;attempt:number;generatorVersion:string;strategy:'constraint'|'mutation'|'reuse'|'ai'|'reverse'|'crossover';family?:'switchback'|'return-route'|'alignment-chain';parentId?:string;sourceCandidateHash?:string;sourceGeneratorVersion?:string;ai?:{modelId:string;promptVersion:string;requestHash:string;artifactName:string};history?:{reason:string;operation:string}[];witness?:import('../../../src/core/puzzle/GameRules').Action[]} }
export function generateCandidate(contract:LevelDesignContract,id:number,seed:number,attempt:number,parent?:Candidate):Candidate {
  const random=new SeededRandom(seed ^ Math.imul(attempt+1,0x9e3779b1) ^ Math.imul(id,0x85ebca6b));
  if(contract.productPolicy&&!parent)return {candidateId:`${contract.contractId}-a${attempt}`,level:interactiveProposal(contract,id,random),contract,provenance:{seed,attempt,generatorVersion:GENERATOR_VERSION,strategy:'constraint'}};
  if(!parent&&attempt%4!==3){const advanced=advancedTemplate(contract,id,random);if(advanced)return {candidateId:`${contract.contractId}-a${attempt}`,level:advanced.level,contract,provenance:{seed,attempt,generatorVersion:GENERATOR_VERSION,strategy:'constraint',family:advanced.family}};}
  if(!parent&&attempt%4===1){const template=curriculumTemplate(contract,id,random);if(template)return {candidateId:`${contract.contractId}-a${attempt}`,level:template,contract,provenance:{seed,attempt,generatorVersion:GENERATOR_VERSION,strategy:'constraint'}};}
  const level:LevelData=parent?structuredClone(parent.level):{
    id,cols:random.int(contract.grid.minCols,contract.grid.maxCols),rows:random.int(contract.grid.minRows,contract.grid.maxRows),blocks:[],exits:[],parMoves:1,
  };
  level.id=id;
  level.pack=contract.targetDifficulty.toLowerCase();
  const side=random.pick<ExitSide>(['TOP','BOTTOM','LEFT','RIGHT']);const index=random.int(0,(side==='TOP'||side==='BOTTOM'?level.cols:level.rows)-1);
  if (!parent && (contract.requiredMechanics.includes('ice-push')||contract.requiredEvidence?.some(e=>e.claim==='ice-push')) && contract.allowedMechanics.includes('ice') && contract.allowedMechanics.includes('obstacle') && contract.grid.maxCols >= 6 && (!contract.requiredEvidence?.some(e=>e.claim==='direction-interaction'||e.claim==='lock-planning')||contract.grid.maxCols>=10)) {
    // Construct a corridor whose only winning route crosses an ice stopper.
    // This is a proposal, not a proof: the same solver/evidence gates still apply.
    const directionRequired=contract.requiredEvidence?.some(e=>e.claim==='direction-interaction'||e.claim==='lock-planning');
    const minimumCols=directionRequired?10:6;
    level.cols = random.int(Math.max(minimumCols,contract.grid.minCols), contract.grid.maxCols);
    const row = random.int(0,level.rows-1);
    const count = Math.min(level.cols-3, Math.max(2, Math.ceil(contract.optimalMoves.min/2)));
    level.exits = [{side:'RIGHT',index:row}];
    level.iceCells = [[level.cols-4,row]];
    let obstacle = 0;
    for (const y of [row-1,row+1]) if(y>=0 && y<level.rows) for(let x=0;x<level.cols;x++)
      level.blocks.push({id:`o${++obstacle}`,color:'red',position:[x,y],size:[1,1],type:'obstacle'});
    level.blocks.push({id:`o${++obstacle}`,color:'red',position:[level.cols-3,row],size:[1,1],type:'obstacle'});
    for(let i=0;i<count;i++){
      const b:BlockData={id:`m${i+1}`,color:random.pick(['red','blue','green','yellow','purple','orange'] as const),position:[directionRequired?(i===0?count+1:i===1?count-1:count-1-i):count-1-i,row],size:[1,1],type:'simple'};
      if(i===0 && contract.allowedMechanics.includes('constrained')){b.type='constrained';b.direction='RIGHT';}
      else if(i===2 && contract.allowedMechanics.includes('lock')){b.type='lock';b.unlockAt=2;}
      else if(i>0 && contract.allowedMechanics.includes('dependent')){b.type='dependent';b.dependsOn=`m${i}`;}
      level.blocks.push(b);
    }
    return {candidateId:`${contract.contractId}-a${attempt}`,level,contract,provenance:{seed,attempt,generatorVersion:GENERATOR_VERSION,strategy:'constraint'}};
  }
  if(!parent){
    level.exits=[{side,index}];
    const cells=Array.from({length:level.cols*level.rows},(_,i)=>[i%level.cols,Math.floor(i/level.cols)] as [number,number]);
    const take=()=>cells.splice(random.int(0,cells.length-1),1)[0];
    const phase=contract.allowedMechanics.length-1;
    const count=Math.min(cells.length-1,random.int(2,Math.min(6,3+phase)));
    const colors=['red','blue','green','yellow','purple','orange'] as const;
    for(let i=0;i<count;i++){
      const b:BlockData={id:`m${i+1}`,color:colors[i%colors.length],position:take(),size:[1,1],type:'simple'};
      const available=contract.allowedMechanics.filter(m=>m!=='sliding'&&m!=='ice'&&m!=='obstacle');
      const mechanic=i===count-1&&contract.introducedMechanic?contract.introducedMechanic:random.next()<0.35&&available.length?random.pick(available):'sliding';
      if(mechanic==='constrained'){b.type='constrained';b.direction=({TOP:'UP',BOTTOM:'DOWN',LEFT:'LEFT',RIGHT:'RIGHT'} as Record<ExitSide,Direction>)[side];}
      if(mechanic==='dependent'&&i>0){b.type='dependent';b.dependsOn=`m${random.int(1,i)}`;}
      if(mechanic==='lock'){b.type='lock';b.unlockAt=random.int(1,Math.max(1,count-1));}
      level.blocks.push(b);
    }
    if(contract.allowedMechanics.includes('obstacle'))for(let i=0,n=random.int(contract.introducedMechanic==='obstacle'?1:0,Math.min(5,cells.length));i<n;i++)level.blocks.push({id:`o${i+1}`,color:'red',position:take(),size:[1,1],type:'obstacle'});
    if(contract.allowedMechanics.includes('ice'))level.iceCells=Array.from({length:random.int(1,3)},()=>take());
  }else{
    const b=random.pick(level.blocks);b.position=[random.int(0,level.cols-1),random.int(0,level.rows-1)];
    if(random.next()<0.3)level.exits=[{side,index}];
    if(level.iceCells?.length&&random.next()<0.4)level.iceCells[random.int(0,level.iceCells.length-1)]=[random.int(0,level.cols-1),random.int(0,level.rows-1)];
  }
  return {candidateId:`${contract.contractId}-a${attempt}`,level,contract,provenance:{seed,attempt,generatorVersion:GENERATOR_VERSION,strategy:parent?'mutation':'constraint',parentId:parent?.candidateId}};
}

export function reviseCandidate(parent:Candidate,report:EvaluationReport,seed:number,attempt:number):Candidate {
  const candidate=structuredClone(parent),random=new SeededRandom(seed^Math.imul(attempt+1,0x9e3779b1));
  if(parent.contract.productPolicy){const replacement=generateCandidate(parent.contract,parent.level.id,seed,attempt);replacement.provenance={...replacement.provenance,strategy:'mutation',parentId:parent.candidateId,history:[...(parent.provenance.history??[]).slice(-49),{reason:report.reasons.join('; '),operation:'rebuild-shared-exit-interactions'}]};return replacement;}
  const failed=report.evidence.find(e=>e.status==='NOT_VERIFIED');let operation='relocate';
  const difficultyFailure=report.gates.difficulty==='FAIL';
  const diversityFailure=report.gates.similarity==='FAIL'||report.gates.uniqueness==='FAIL';
  const replacement=!parent.contract.productPolicy&&(difficultyFailure||diversityFailure)?advancedTemplate(parent.contract,parent.level.id,random):undefined;
  const level=candidate.level;
  if(replacement){candidate.level=replacement.level;candidate.provenance.family=replacement.family;operation=difficultyFailure?'rebuild-for-difficulty':'rebuild-for-diversity';}
  else if(failed?.claim==='ice-push'&&level.iceCells?.length){
    level.exits=level.exits.filter((_,i)=>i===0);operation='remove-bypass-exits';
  }else if(failed?.claim==='dependency-planning'||failed?.claim==='lock-planning'){
    const block=level.blocks.find(b=>b.type===(failed.claim==='lock-planning'?'lock':'dependent'));
    if(block){block.position=[random.int(0,level.cols-1),random.int(0,level.rows-1)];operation='reposition-sequencing-block';}
  }else {
    const occupied=new Set(level.blocks.map(b=>b.position.join(',')));
    const empty=Array.from({length:level.cols*level.rows},(_,i)=>[i%level.cols,Math.floor(i/level.cols)] as [number,number]).filter(p=>!occupied.has(p.join(',')));
    if(empty.length){const block=random.pick(level.blocks);block.position=random.pick(empty);}
  }
  candidate.candidateId=`${parent.contract.contractId}-a${attempt}`;candidate.provenance={...candidate.provenance,generatorVersion:GENERATOR_VERSION,attempt,strategy:'mutation',parentId:parent.candidateId,history:[...(parent.provenance.history??[]).slice(-49),{reason:report.reasons.join('; ')||failed?.claim||'Improve soft targets',operation}]};return candidate;
}
/** Reverse design uses a replayable slide-only solution prefix, never assumes moves are invertible. */
export function reverseDesign(parent:Candidate,steps=1):Candidate|undefined {
  const result=solve(parent.level,{maxStates:10000,timeoutMs:1000});if(!result.solutionPath)return;
  let state=createState(parent.level),used=0;
  for(const action of result.solutionPath.slice(0,steps)){const t=gameRules.applyAction(state,action);if(t.result.kind!=='slide')break;state=t.state;used++;}
  if(!used)return;
  const candidate=structuredClone(parent);candidate.level.blocks=candidate.level.blocks.map(b=>({...b,position:[...state.blocks.find(x=>x.blockId===b.id)!.gridPos]}));candidate.level.parMoves=1;
  candidate.provenance={...parent.provenance,strategy:'reverse',parentId:parent.candidateId,witness:result.solutionPath.slice(used)};return candidate;
}
export function crossover(a:Candidate,b:Candidate,seed:number):Candidate {
  const candidate=structuredClone(a),random=new SeededRandom(seed);
  if(a.level.cols===b.level.cols&&a.level.rows===b.level.rows){candidate.level.blocks=candidate.level.blocks.map((block,i)=>random.next()<0.5&&b.level.blocks[i]?{...block,position:[...b.level.blocks[i].position]}:block);}
  candidate.provenance={...a.provenance,strategy:'crossover',parentId:`${a.candidateId}+${b.candidateId}`};return candidate;
}

function curriculumTemplate(contract:LevelDesignContract,id:number,random:SeededRandom):LevelData|undefined {
  if(contract.allowedMechanics.includes('ice'))return; // Ice corridor proposal above supplies verified-interaction candidates.
  const minimum=Math.max(2,contract.optimalMoves.min),max=Math.min(contract.grid.maxRows,contract.optimalMoves.max,minimum+2);
  if(minimum>max)return;
  const count=random.int(minimum,max),rows=random.int(Math.max(count,contract.grid.minRows),contract.grid.maxRows),cols=random.int(Math.max(3,contract.grid.minCols),contract.grid.maxCols);
  const level:LevelData={id,cols,rows,blocks:[],exits:[],parMoves:1,pack:contract.targetDifficulty.toLowerCase()};
  const obstacle=contract.requiredEvidence?.some(e=>e.claim==='obstacle-interaction');
  if(obstacle){
    const obstacleCount=Math.max(2,Math.ceil(contract.optimalMoves.min/2));if(obstacleCount+1>contract.grid.maxRows)return;
    level.rows=random.int(Math.max(contract.grid.minRows,obstacleCount+1),contract.grid.maxRows);level.cols=Math.max(3,contract.grid.minCols);
    const lanes=Array.from({length:level.rows-1},(_,i)=>i+1);
    for(let i=0;i<obstacleCount;i++){
      const row=lanes.splice(random.int(0,lanes.length-1),1)[0];
      level.blocks.push({id:`m${i+1}`,color:'blue',position:[0,row],size:[1,1],type:'simple'});
      level.blocks.push({id:`o${i+1}`,color:'red',position:[2,row],size:[1,1],type:'obstacle'});
    }
    level.exits=[{side:'TOP',index:1}];return level;
  }
  const availableRows=Array.from({length:rows},(_,i)=>i);
  for(let i=0;i<count;i++){
    const row=availableRows.splice(random.int(0,availableRows.length-1),1)[0];
    const block:BlockData={id:`m${i+1}`,color:random.pick(['red','blue','green','yellow','purple','orange'] as const),position:[random.int(1,cols-1),row],size:[1,1],type:contract.allowedMechanics.includes('constrained')?'constrained':'simple'};
    if(block.type==='constrained')block.direction='RIGHT';
    if(i===1&&contract.allowedMechanics.includes('dependent')){block.type='dependent';block.direction=undefined;block.dependsOn='m1';}
    if(i===count-1&&contract.allowedMechanics.includes('lock')){block.type='lock';block.direction=undefined;block.unlockAt=Math.min(count-1,2);}
    level.blocks.push(block);level.exits.push({side:'RIGHT',index:row});
  }
  return level;
}
