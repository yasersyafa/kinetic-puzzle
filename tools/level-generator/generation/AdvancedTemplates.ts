import type { LevelData, BlockData } from '../../../src/types/Game';
import type { LevelDesignContract } from '../director/DesignContract';

interface RandomSource { int(min:number,max:number):number }
export interface AdvancedProposal { level:LevelData; family:'switchback'|'return-route'|'alignment-chain' }

/** Constructive proposals only: optimum, influence and diversity still require verification. */
export function advancedTemplate(contract:LevelDesignContract,id:number,random:RandomSource):AdvancedProposal|undefined {
  if(contract.targetDifficulty==='MEDIUM'&&contract.allowedMechanics.includes('dependent')&&contract.allowedMechanics.includes('constrained')&&
    !contract.requiredMechanics.some(m=>['obstacle','lock','ice'].includes(m)))return alignmentChain(contract,id,random);
  if(!['HARD','EXPERT'].includes(contract.targetDifficulty)||
    !['constrained','dependent','obstacle'].every(m=>contract.allowedMechanics.includes(m as 'constrained'|'dependent'|'obstacle')))return;
  const ice=contract.requiredEvidence?.some(e=>e.claim==='ice-push')??false;
  if(ice&&!contract.allowedMechanics.includes('ice'))return;
  const lock=contract.allowedMechanics.includes('lock');
  const relief=contract.progressionRole==='RELIEF';
  const shortCount=relief?(lock?3:2):(lock?7:6);
  const longCount=relief?(lock?3:2):(lock?5:contract.progressionRole==='TEACH'?3:4);
  const shortMoves=shortCount*(ice?5:4)+1;
  const useShort=random.int(0,1)===1&&!(contract.targetDifficulty==='HARD'&&contract.progressionRole==='TEACH')&&contract.grid.maxCols>=shortCount+2&&
    shortMoves>=contract.optimalMoves.min&&shortMoves<=contract.optimalMoves.max;
  const count=useShort?shortCount:longCount;
  const moves=count*(useShort?(ice?5:4):(ice?7:6))+1;
  if(moves<contract.optimalMoves.min||moves>contract.optimalMoves.max)return;
  const minCols=Math.max(contract.grid.minCols,count+2,ice?7:6);
  const minRows=Math.max(contract.grid.minRows,7);
  if(minCols>contract.grid.maxCols||minRows>contract.grid.maxRows)return;
  const cols=random.int(minCols,contract.grid.maxCols),rows=random.int(minRows,contract.grid.maxRows);
  const end=random.int(Math.max(count+1,ice?6:5),cols-1);
  const start=random.int(6,rows-1),middle=random.int(3,start-2),turn=random.int(1,middle-2);
  const left=random.int(2,ice?Math.min(3,end-4):Math.min(3,end-2));
  const path=new Set<string>();const open=(x:number,y:number)=>path.add(`${x},${y}`);
  for(let x=0;x<=end;x++)open(x,start);
  for(let y=middle;y<=start;y++)open(end,y);
  for(let x=left;x<=end;x++)open(x,middle);
  if(useShort){for(let y=0;y<=middle;y++)open(left,y);}
  else {
    for(let y=turn;y<=middle;y++)open(left,y);
    for(let x=left;x<=end;x++)open(x,turn);
    for(let y=0;y<=turn;y++)open(end,y);
  }
  // A separate chamber permits a real relaxed-rule direction witness.
  for(let y=0;y<=2;y++)open(0,y);
  const iceRow=useShort?middle:turn,iceCol=useShort?left+3:end-3;
  const skipCol=useShort?left+2:end-2;
  const level:LevelData={id,cols,rows,blocks:[],exits:[{side:'TOP',index:useShort?left:end},{side:'TOP',index:0}],parMoves:1,pack:contract.targetDifficulty.toLowerCase()};
  if(ice)level.iceCells=[[iceCol,iceRow]];
  let obstacleId=0;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!path.has(`${x},${y}`)||(ice&&x===skipCol&&y===iceRow))
    level.blocks.push({id:`o${++obstacleId}`,type:'obstacle',color:'red',position:[x,y],size:[1,1]});
  const available=Array.from({length:end-2},(_,i)=>i+2),positions:number[]=[];
  for(let i=0;i<count-1;i++)positions.push(available.splice(random.int(0,available.length-1),1)[0]);
  positions.sort((a,b)=>b-a);positions.push(0);
  for(let i=0;i<count;i++) {
    const block:BlockData={id:`m${i+1}`,type:i===0?'simple':i===count-1&&lock?'lock':'dependent',color:'blue',position:[positions[i],start],size:[1,1]};
    if(block.type==='dependent')block.dependsOn=`m${i}`;
    // Keep a gap before the lock so removing its constraint changes a winning path.
    if(block.type==='lock')block.unlockAt=count-1;
    level.blocks.push(block);
  }
  level.blocks.push({id:'direction',type:'constrained',direction:'UP',color:'green',position:[0,1],size:[1,1]});
  return {level,family:useShort?'return-route':'switchback'};
}

function alignmentChain(contract:LevelDesignContract,id:number,random:RandomSource):AdvancedProposal|undefined {
  const maxCount=Math.min(7,contract.grid.maxRows);
  if(contract.progressionRole!=='RELIEF'&&maxCount<5)return;
  const count=contract.progressionRole==='RELIEF'?4:random.int(5,maxCount);
  const moves=2*count-1;
  if(contract.grid.maxRows<count||contract.grid.maxCols<2||moves<contract.optimalMoves.min||moves>contract.optimalMoves.max)return;
  const cols=random.int(Math.max(2,contract.grid.minCols),contract.grid.maxCols),rows=random.int(Math.max(count,contract.grid.minRows),contract.grid.maxRows);
  const level:LevelData={id,cols,rows,blocks:[{id:'m1',type:'constrained',direction:'UP',color:'green',position:[0,1],size:[1,1]}],exits:[{side:'TOP',index:0}],parMoves:1,pack:contract.targetDifficulty.toLowerCase()};
  const available=Array.from({length:rows},(_,i)=>i);
  for(let i=1;i<count;i++)level.blocks.push({id:`m${i+1}`,type:'dependent',dependsOn:`m${i}`,color:'blue',position:[random.int(1,cols-1),available.splice(random.int(0,available.length-1),1)[0]],size:[1,1]});
  return {level,family:'alignment-chain'};
}
