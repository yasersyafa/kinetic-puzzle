import type { LevelData, BlockData, Direction, ExitSide } from '../../../src/types/Game';
import type { LevelDesignContract } from '../director/DesignContract';
import { colorLevel } from './ProductPolicy';
interface Random {int(min:number,max:number):number;pick<T>(items:readonly T[]):T}
/** Shared open board: actors can serve as temporary stoppers; no isolated exit lanes. */
export function interactiveProposal(contract:LevelDesignContract,id:number,random:Random):LevelData {
  const cols=random.int(contract.grid.minCols,Math.min(contract.grid.maxCols,6));
  const rows=random.int(contract.grid.minRows,Math.min(contract.grid.maxRows,6));
  const side=random.pick<ExitSide>(['TOP','BOTTOM','LEFT','RIGHT']);
  const span=side==='TOP'||side==='BOTTOM'?cols:rows;
  const index=random.int(span>2?1:0,span>2?span-2:span-1);
  const cells=Array.from({length:cols*rows},(_,i)=>[i%cols,Math.floor(i/cols)] as [number,number]);
  const take=()=>cells.splice(random.int(0,cells.length-1),1)[0];
  const count=Math.min(cells.length,contract.allowedMechanics.includes('obstacle')?Infinity:span,random.int(contract.targetDifficulty==='TUTORIAL'||contract.progressionRole==='RELIEF'?2:3,contract.targetDifficulty==='TUTORIAL'||contract.progressionRole==='RELIEF'?3:4));
  const blocks:BlockData[]=Array.from({length:count},(_,i)=>({id:`m${i+1}`,type:'simple',color:'red',position:take(),size:[1,1]}));
  const specials=['constrained','dependent','lock'] as const;let slot=count-1;
  const selected=specials.filter(t=>contract.allowedMechanics.includes(t)&& (contract.requiredMechanics.includes(t)||contract.introducedMechanic===t||random.int(0,2)===0));
  selected.sort((a,b)=>Number(contract.requiredMechanics.includes(b))-Number(contract.requiredMechanics.includes(a)));
  for(const type of selected){
    if(slot<1)break;const block=blocks[slot--];block.type=type;
    if(type==='constrained'){
      const target:[number,number]=side==='TOP'||side==='BOTTOM'?[index,block.position[1]]:[block.position[0],index];
      const occupied=blocks.find(b=>b!==block&&b.position[0]===target[0]&&b.position[1]===target[1]);
      const emptyIndex=cells.findIndex(p=>p[0]===target[0]&&p[1]===target[1]);
      if(occupied)occupied.position=block.position;else if(emptyIndex>=0)cells[emptyIndex]=block.position;
      block.position=target;block.direction=({TOP:'UP',BOTTOM:'DOWN',LEFT:'LEFT',RIGHT:'RIGHT'} as Record<ExitSide,Direction>)[side];}
    if(type==='dependent')block.dependsOn='m1';
    if(type==='lock')block.unlockAt=random.int(1,Math.min(2,count-1));
  }
  if(contract.allowedMechanics.includes('obstacle'))for(let i=0,n=random.int(1,Math.min(4,cells.length));i<n;i++)blocks.push({id:`o${i+1}`,type:'obstacle',color:'red',position:take(),size:[1,1]});
  // Without static stoppers, reserve a solvable onboarding alignment instead of
  // proposing mostly impossible internal-exit boards. Challenge contracts still reject it.
  if(!contract.allowedMechanics.includes('obstacle')){
    const lanes=Array.from({length:side==='TOP'||side==='BOTTOM'?rows:cols},(_,i)=>i);
    for(const block of blocks){const lane=lanes.splice(random.int(0,lanes.length-1),1)[0];block.position=side==='TOP'||side==='BOTTOM'?[index,lane]:[lane,index];}
  }
  const level:LevelData={id,cols,rows,blocks,exits:[{side,index}],parMoves:1,pack:'playtest'};
  if(contract.allowedMechanics.includes('ice')&&cells.length)level.iceCells=[take()];
  return colorLevel(level);
}
