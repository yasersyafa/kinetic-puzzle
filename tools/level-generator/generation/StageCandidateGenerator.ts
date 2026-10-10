import { generateCandidate, SeededRandom, type Candidate } from './CandidateGenerator';
import type { LevelDesignContract } from '../director/DesignContract';
import type { LevelData, Direction, ExitSide } from '../../../src/types/Game';
import { colorLevel } from './ProductPolicy';
import { hash } from '../output/Integrity';
export const STAGE_GENERATOR_VERSION = '1.0.0';
/** Layout of the player-approved reference L2. Proposals alter its actors/geometry, never inherit approval. */
const REFERENCE: LevelData = {
  id:2,cols:5,rows:5,parMoves:10,pack:'playtest',exits:[{side:'LEFT',index:3}],
  blocks:[
    {id:'m1',type:'simple',color:'red',position:[2,4],size:[1,1]},
    {id:'m2',type:'simple',color:'red',position:[1,3],size:[1,1]},
    {id:'m3',type:'simple',color:'red',position:[0,0],size:[1,1]},
    {id:'o1',type:'obstacle',color:'red',position:[1,0],size:[1,1]},
    {id:'o2',type:'obstacle',color:'red',position:[3,2],size:[1,1]},
    {id:'o3',type:'obstacle',color:'red',position:[2,2],size:[1,1]},
  ],
};
export function generateStageCandidate(contract:LevelDesignContract,id:number,seed:number,attempt:number):Candidate {
  if (!contract.mandatoryPrematureExitTrap || attempt % 2 === 0 || !contract.allowedMechanics.includes('obstacle') || !contract.allowedMechanics.includes('constrained') || contract.grid.minCols > 5 || contract.grid.maxCols < 5 || contract.grid.minRows > 5 || contract.grid.maxRows < 5) return generateCandidate(contract,id,seed,attempt);
  const random=new SeededRandom(seed ^ Math.imul(attempt+1,0x9e3779b1) ^ Math.imul(id,0x85ebca6b));
  const level=structuredClone(REFERENCE);level.id=id;level.parMoves=1;level.pack='stage-1';
  level.blocks[1]={...level.blocks[1],type:'constrained',direction:'LEFT',color:'yellow'};
  const free=Array.from({length:25},(_,i)=>[i%5,Math.floor(i/5)] as [number,number]).filter(p=>!level.blocks.some(b=>b.position[0]===p[0]&&b.position[1]===p[1]));
  const take=()=>free.splice(random.int(0,free.length-1),1)[0];
  const added=random.int(id===17?0:1,1);
  for(let i=0;i<added;i++)level.blocks.push({id:`m${i+4}`,type:'simple',color:'red',position:take(),size:[1,1]});
  const target=random.pick([0,2,4,5]);level.blocks[target].position=take();
  if(random.int(0,2)===0){const other=random.pick([0,2,4,5].filter(i=>i!==target));level.blocks[other].position=take();}
  const rotateDir:Record<Direction,Direction>={UP:'RIGHT',RIGHT:'DOWN',DOWN:'LEFT',LEFT:'UP'};
  const rotateSide:Record<ExitSide,ExitSide>={TOP:'RIGHT',RIGHT:'BOTTOM',BOTTOM:'LEFT',LEFT:'TOP'};
  for(let turns=random.int(0,3);turns>0;turns--){
    level.blocks=level.blocks.map(b=>({...b,position:[4-b.position[1],b.position[0]],direction:b.direction?rotateDir[b.direction]:undefined}));
    const exit=level.exits[0];level.exits=[{side:rotateSide[exit.side],index:exit.side==='TOP'||exit.side==='BOTTOM'?exit.index:4-exit.index}];
  }
  return {candidateId:`${contract.contractId}-mutation-${attempt}`,level:colorLevel(level),contract,provenance:{seed,attempt,generatorVersion:`stage-${STAGE_GENERATOR_VERSION}`,strategy:'mutation',parentId:'shared-exit-reference-L2',sourceCandidateHash:hash(REFERENCE),sourceGeneratorVersion:'3.1.0',history:[{reason:'Require meaningful irreversible exit choices',operation:'Constrain the aligned block; change actor/obstacle positions and optionally add a red actor'}]}};
}
