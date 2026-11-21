// Stable database identifiers; branding is applied only when presenting records.
export const categoryLabel = (category: string) => category === 'elite' ? '🎯 CORNER HUNTER' : '⚡ BET STRIKE';
export function displayBrand(text: string): string {
 return text.replace(/\bQuantBet\s+ELITE\b/gi,'CORNER HUNTER')
  .replace(/\bQuantBet(?:\s+2\.0(?:0)?\b)?/gi,'BET STRIKE')
  .replace(/\bELITE\b/g,'CORNER HUNTER');
}
export function presentEntry<T extends {title:string;payload:any}>(entry:T):T {
 const payload={...entry.payload};
 for(const key of ['analysis','risk','description']) if(typeof payload[key]==='string') payload[key]=displayBrand(payload[key]);
 return {...entry,title:displayBrand(entry.title),payload};
}
