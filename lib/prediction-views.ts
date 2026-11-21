import type {PredictionPayload,ResultPayload} from './editorial';
export type PublicPrediction = {id:string;title:string;payload:PredictionPayload;publishedAt?:string|null;createdAt?:string};
export type PublicResult = {id:string;title:string;payload:ResultPayload};
export function sofiaDay(value: string | number | Date = Date.now()):string {
 const date=new Date(value);
 if(!Number.isFinite(date.getTime())) return '';
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function slipDay(p:PublicPrediction):string {
 const days=p.payload.selections.map(s=>sofiaDay(s.kickoff));
 return days.length && days.every(Boolean) ? days.sort().at(-1)! : '';
}
export function todayPredictions<T extends PublicPrediction>(predictions:T[],today:string,results:PublicResult[]=[]):T[]{
 const settled=new Set(results.filter(r=>["WIN","LOSS","VOID"].includes(r.payload.outcome)).map(r=>r.payload.predictionId));
 return today ? predictions.filter(p=>!settled.has(p.id) && p.payload.selections.some(s=>sofiaDay(s.kickoff)===today)) : [];
}
export function resultHistory(predictions:PublicPrediction[],results:PublicResult[],today:string){
 const resultByPrediction=new Map(results.map(r=>[r.payload.predictionId,r]));
 const groups=new Map<string,{prediction:PublicPrediction;result?:PublicResult}[]>();
 for(const p of predictions){
  const day=slipDay(p),result=resultByPrediction.get(p.id);
  if(!result && day && (!today || day>=today))continue;
  const items=groups.get(day)||[];items.push({prediction:p,result});groups.set(day,items);
 }
 return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([date,slips])=>({date,slips}));
}
