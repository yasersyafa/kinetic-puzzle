export const PREFERENCES_KEY='fpp-shared-preferences-v1';
const fields=['sfxEnabled','audioEnabled'] as const;
function preferences(value:Record<string,unknown>):Record<string,unknown>{
  const result:Record<string,unknown>={};
  for(const field of fields)if(typeof value[field]==='boolean')result[field]=value[field];
  return result;
}
function parse(raw:string|null):Record<string,unknown>|undefined {
  if(!raw)return;try{const v=JSON.parse(raw);return v&&typeof v==='object'?v:undefined;}catch{return;}
}
export function campaignStorage(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>){
  return {
    getItem(name:string):string|null {
      const saved=parse(storage.getItem(name));
      const shared=parse(storage.getItem(PREFERENCES_KEY));
      const legacy=parse(storage.getItem('fpp-game-state-v2'));
      const prefs=preferences(shared??(legacy?.state as Record<string,unknown>)??{});
      if(!saved&&!Object.keys(prefs).length)return null;
      return JSON.stringify({...saved,version:saved?.version??0,state:{...(saved?.state as object??{}),...prefs}});
    },
    setItem(name:string,value:string):void {
      const parsed=parse(value);if(parsed?.state)storage.setItem(PREFERENCES_KEY,JSON.stringify(preferences(parsed.state as Record<string,unknown>)));
      storage.setItem(name,value);
    },
    removeItem(name:string):void {storage.removeItem(name);},
  };
}
