import { CAMPAIGN_ID,CAMPAIGN_VERSION,levelVersion,getStage,getMoveLimit } from '../config/Levels';
export interface AttemptTelemetry {
  schemaVersion:'1.0.0'|'2.0.0';campaignId:string;campaignVersion:string;levelId:number;levelVersion:string;attemptId:string;
  testerId?:string;sessionId?:string;abandoned?:boolean;reportedDifficulty?:number;timeBasis?:'ACTIVE';
  stageId?:string;moveLimit?:number;outcome?:'WIN'|'MOVE_LIMIT'|'STUCK'|'RESTART'|'ABANDONED';
  completed:boolean;completionTimeMs:number;moveCount:number;undoCount:number;restartCount:number;hintCount:number;deadEndCount:number;mode:'HUMAN'|'AUTOPLAY';
}
const KEY='kinetic-local-playtest-v2';
export class PlayerTelemetry {
  private consent=false;private rows:AttemptTelemetry[]=[];
  private testerId='';private sessionId='';private paused=new Set<string>();
  private current?:{row:AttemptTelemetry;last:number;activeMs:number};
  constructor(private storage?:Storage,private clock:()=>number=()=>Date.now()){}
  get enabled():boolean{return this.consent;}
  get count():number{return this.rows.length;}
  setConsent(value:boolean):void {
    this.consent=value;
    if(value){
      this.testerId=crypto.randomUUID();this.sessionId=crypto.randomUUID();
      try{const saved=JSON.parse(this.storage?.getItem(KEY)??'null');if(saved?.consent===true&&typeof saved.testerId==='string'&&Array.isArray(saved.rows)){this.testerId=saved.testerId;this.rows=saved.rows.slice(-1000);}}catch{this.rows=[];}
      this.persist();
    }else{this.current=undefined;this.rows=[];this.testerId='';this.sessionId='';this.storage?.removeItem(KEY);}
  }
  start(levelId:number,autoplay:boolean):void {
    this.finish(false);if(!this.consent)return;
    this.current={last:this.clock(),activeMs:0,row:{schemaVersion:'2.0.0',campaignId:CAMPAIGN_ID,campaignVersion:CAMPAIGN_VERSION,levelId,levelVersion:levelVersion(levelId),attemptId:crypto.randomUUID(),testerId:this.testerId,sessionId:this.sessionId,timeBasis:'ACTIVE',completed:false,completionTimeMs:0,moveCount:0,undoCount:0,restartCount:0,hintCount:0,deadEndCount:0,mode:autoplay?'AUTOPLAY':'HUMAN',stageId:getStage(levelId)?.id,moveLimit:getMoveLimit(levelId)}};
  }
  private tick():void{if(!this.current)return;const now=this.clock();if(!this.paused.size)this.current.activeMs+=Math.max(0,now-this.current.last);this.current.last=now;}
  setPaused(value:boolean,reason='scene'):void{this.tick();if(value)this.paused.add(reason);else this.paused.delete(reason);}
  increment(field:'moveCount'|'undoCount'|'restartCount'|'hintCount'|'deadEndCount'):void{if(this.current)this.current.row[field]++;}
  finish(completed:boolean,outcome:AttemptTelemetry['outcome']=completed?'WIN':'ABANDONED'):void {
    if(!this.current)return;this.tick();const {row,activeMs}=this.current;row.completed=completed;row.outcome=outcome;row.abandoned=outcome==='ABANDONED'||outcome==='RESTART';row.completionTimeMs=Math.round(activeMs);
    this.rows.push({...row});if(this.rows.length>1000)this.rows.shift();this.current=undefined;this.persist();
  }
  rateLast(rating:number):void{if(!Number.isInteger(rating)||rating<1||rating>5)throw new Error('Difficulty rating must be 1–5');const row=this.rows[this.rows.length-1];if(row){row.reportedDifficulty=rating;this.persist();}}
  exportJsonl():string{return this.rows.map(r=>JSON.stringify(r)).join('\n');}
  clear():void{this.rows=[];this.current=undefined;this.persist();}
  private persist():void{if(!this.consent)return;try{this.storage?.setItem(KEY,JSON.stringify({consent:true,testerId:this.testerId,rows:this.rows}));}catch{/* Export remains available if storage is full/unavailable. */}}
}
let storage:Storage|undefined;try{if(typeof window!=='undefined')storage=window.localStorage;}catch{}
export const playerTelemetry=new PlayerTelemetry(storage);
