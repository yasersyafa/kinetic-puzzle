import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateCandidate, SeededRandom, reviseCandidate } from '../generation/CandidateGenerator';
import { advancedTemplate } from '../generation/AdvancedTemplates';
import { defaultCurriculum, MECHANICS } from '../director/DesignContract';
import { evaluate } from '../evaluation/Evaluators';
import { createEvaluationContext } from '../evaluation/EvaluationContext';
import { canonicalSignature, similarity, solutionPattern, solutionPatternSimilarity } from '../evaluation/DiversityEvaluator';
import { requireAdvancedTargets } from '../director/DifficultyTargets';
import { DEFAULT_MODEL } from '../evaluation/EvaluationContext';
import { limitSimilarity } from '../director/DiversityTargets';
import { validateLevel } from '../../../src/core/puzzle/LevelValidator';
const contracts=defaultCurriculum(80),budget={maxStates:10000,timeoutMs:30000};
function assessed(id:number,attempt=0) {
  const candidate=generateCandidate(contracts[id-1],id,42,attempt);
  const context=createEvaluationContext([],budget,MECHANICS,[candidate.contract.primaryInsight]);
  return {candidate,report:evaluate(candidate.level,candidate.contract,[],budget,context.learned,context)};
}

test('advanced proposals reach HARD/EXPERT with the unchanged model and verified mechanics',()=>{
  for(const id of [42,55,80]) {
    const {candidate,report}=assessed(id);
    assert.equal(report.decision,'ELIGIBLE',report.reasons.join(', '));
    assert.equal(report.difficulty!.modelVersion,'heuristic-2.0.0');
    assert.equal(report.difficulty!.category,id===42?'HARD':'EXPERT');
    assert.ok(report.solver!.optimalMoves!>20);
    assert.ok(report.evidence.every(e=>e.status==='VERIFIED'));
    assert.deepEqual(candidate,generateCandidate(contracts[id-1],id,42,0));
  }
});
test('advanced topology families vary structure and recorded solution pattern',()=>{
  const byFamily=new Map<string,ReturnType<typeof assessed>>();
  for(let attempt=0;attempt<16&&byFamily.size<2;attempt++) {
    if(attempt%4===3)continue;
    const result=assessed(80,attempt);
    assert.equal(result.report.decision,'ELIGIBLE',result.report.reasons.join(', '));
    byFamily.set(result.candidate.provenance.family!,result);
  }
  assert.equal(byFamily.size,2);
  const [a,b]=[...byFamily.values()];
  assert.notEqual(canonicalSignature(a.candidate.level),canonicalSignature(b.candidate.level));
  assert.ok(similarity(a.candidate.level,b.candidate.level)<0.9);
  assert.ok(solutionPatternSimilarity(solutionPattern(a.candidate.level,a.report.solver!.solutionPath!),solutionPattern(b.candidate.level,b.report.solver!.solutionPath!))<0.9);
});
test('advanced relief reduces difficulty without falling back to a tutorial duplicate',()=>{
  for(const [regular,relief] of [[47,48],[55,56],[71,72]]) {
    const a=assessed(regular),b=assessed(relief);
    assert.equal(b.report.decision,'ELIGIBLE',b.report.reasons.join(', '));
    assert.ok(b.report.difficulty!.score<a.report.difficulty!.score);
    assert.ok(b.report.difficulty!.score>=30);
  }
});
test('mandatory difficulty bands reject earlier easy artifacts and accept proven expert proposals',()=>{
  const {candidate}=assessed(80);
  const contract={...candidate.contract,mandatoryDifficultyScore:{min:70,max:100}};
  const context=createEvaluationContext([],budget,MECHANICS,[contract.primaryInsight]);
  assert.equal(evaluate(candidate.level,contract,[],budget,context.learned,context).decision,'ELIGIBLE');
  const old=JSON.parse(readFileSync(new URL('./fixtures/approved-baseline.json',import.meta.url),'utf8')).find((f:any)=>f.level.id===80);
  const rejected=evaluate(old.level,contract,[],budget,context.learned,context);
  assert.equal(rejected.gates.difficulty,'FAIL');assert.equal(rejected.decision,'REJECT');
});
test('advanced construction declines infeasible grids and move budgets',()=>{
  const contract=contracts[79];
  assert.equal(advancedTemplate({...contract,grid:{minCols:3,maxCols:5,minRows:3,maxRows:5}},80,new SeededRandom(42)),undefined);
  assert.equal(advancedTemplate({...contract,optimalMoves:{min:1,max:2}},80,new SeededRandom(42)),undefined);
});
test('medium alignment chains bridge to the first hard level within the pacing budget',()=>{
  const regular=assessed(39),relief=assessed(40),hard=assessed(41);
  assert.equal(regular.report.decision,'ELIGIBLE');assert.equal(relief.report.decision,'ELIGIBLE');assert.equal(hard.report.decision,'ELIGIBLE');
  assert.equal(regular.report.difficulty!.category,'MEDIUM');
  assert.ok(relief.report.difficulty!.score<regular.report.difficulty!.score);
  assert.ok(hard.report.difficulty!.score-relief.report.difficulty!.score<=30);
});
test('required advanced tiers intersect product bands and never weaken existing constraints',()=>{
  const result=requireAdvancedTargets(contracts);
  assert.equal(result[41].mandatoryDifficultyScore!.min,50);
  assert.ok(result[41].mandatoryDifficultyScore!.max<70);
  assert.equal(result[54].mandatoryDifficultyScore!.min,70);
  assert.equal(result[55].mandatoryDifficultyScore,undefined); // relief
  assert.equal(contracts[41].mandatoryDifficultyScore,undefined); // no mutation
  assert.equal(requireAdvancedTargets([{...contracts[41],mandatoryDifficultyScore:{min:55,max:60}}])[0].mandatoryDifficultyScore!.min,55);
  assert.throws(()=>requireAdvancedTargets([{...contracts[41],mandatoryDifficultyScore:{min:1,max:40}}]),/conflicts/);
  assert.equal(requireAdvancedTargets([contracts[54]],{...DEFAULT_MODEL,thresholds:[10,20,40,60]})[0].mandatoryDifficultyScore!.min,60);
});
test('difficulty failure targets a bounded new proposal and still requires re-evaluation',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/approved-baseline.json',import.meta.url),'utf8')).find((f:any)=>f.level.id===80);
  const parent=generateCandidate(requireAdvancedTargets([contracts[79]])[0],80,42,0);parent.level=old.level;
  const context=createEvaluationContext([],budget,MECHANICS,[parent.contract.primaryInsight]);
  const failed=evaluate(parent.level,parent.contract,[],budget,context.learned,context);
  assert.equal(failed.gates.difficulty,'FAIL');
  const revised=reviseCandidate(parent,failed,42,1);
  assert.equal(revised.provenance.history!.at(-1)!.operation,'rebuild-for-difficulty');
  assert.equal(revised.provenance.strategy,'mutation');
  assert.deepEqual(revised.contract,parent.contract);
  assert.equal(evaluate(revised.level,revised.contract,[],budget,context.learned,context).decision,'ELIGIBLE');
});
test('medium proposals vary chain lengths and diversity failures produce validated new proposals',()=>{
  const counts=new Set<number>();
  for(let attempt=0;attempt<16;attempt++) {
    if(attempt%4===3)continue;
    const {candidate,report}=assessed(39,attempt);
    assert.equal(report.decision,'ELIGIBLE');
    assert.equal(report.difficulty!.category,'MEDIUM');
    counts.add(candidate.level.blocks.length);
  }
  assert.ok(counts.size>=2);
  const {candidate,report}=assessed(80);
  const revised=reviseCandidate(candidate,{...report,gates:{...report.gates,uniqueness:'FAIL'},decision:'REJECT',reasons:['uniqueness: FAIL']},42,1);
  assert.equal(revised.provenance.history!.at(-1)!.operation,'rebuild-for-diversity');
  const context=createEvaluationContext([],budget,MECHANICS,[candidate.contract.primaryInsight]);
  assert.equal(evaluate(revised.level,revised.contract,[],budget,context.learned,context).decision,'ELIGIBLE');
});
test('structural similarity policy cannot relax a stricter contract and is enforced by evaluation',()=>{
  const bounded=limitSimilarity([{...contracts[79],mandatoryMaxSimilarity:0.8}],0.9);
  assert.equal(bounded[0].mandatoryMaxSimilarity,0.8);
  assert.throws(()=>limitSimilarity(contracts,1.1),/between/);assert.throws(()=>limitSimilarity(contracts,NaN),/between/);
  const {candidate,report:approved}=assessed(80);
  const near=structuredClone(candidate.level);near.blocks.find(b=>b.id==='direction')!.position[1]=2;near.parMoves=approved.solver!.optimalMoves!;
  assert.deepEqual(validateLevel(near),[]);
  const context=createEvaluationContext([near],budget,MECHANICS,[candidate.contract.primaryInsight]);
  const report=evaluate(candidate.level,limitSimilarity([candidate.contract],0.9)[0],[near],budget,context.learned,context);
  assert.equal(report.diversity!.exactDuplicate,false);
  assert.equal(report.gates.similarity,'FAIL');assert.equal(report.decision,'REJECT');
});
