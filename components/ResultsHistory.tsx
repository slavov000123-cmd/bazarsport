'use client';
import {useState} from 'react';
import {useLanguage} from './LanguageProvider';
import MatchLeague from './MatchLeague';
import {categoryLabel} from '@/lib/categories';
import {resultHistory,type PublicPrediction,type PublicResult} from '@/lib/prediction-views';
const colors:Record<string,string>={WIN:'text-lime-300',LOSS:'text-red-300',VOID:'text-amber-300',UNVERIFIED:'text-white/50'};
export default function ResultsHistory({predictions,results,today}:{predictions:PublicPrediction[];results:PublicResult[];today:string}){
 const {t,language}=useLanguage();
 const [daysShown,setDaysShown]=useState(7);
 const groups=resultHistory(predictions,results,today);
 const en=language==='en';
 const date=(day:string)=>day?new Intl.DateTimeFormat(en?'en-GB':'bg-BG',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Sofia'}).format(new Date(day+'T12:00:00Z')):t('Непотвърдена дата');
 if(!groups.length)return <p className="mt-5 rounded-xl border border-white/10 p-4 text-sm text-white/60">{t('Все още няма минали талони.')}</p>;
 return <div className="mt-5 space-y-5">{groups.slice(0,daysShown).map(group=><section key={group.date || 'unknown'}>
  <h2 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-bold"><time dateTime={group.date || undefined}>{date(group.date)}</time><span className="font-normal text-white/45">{t('Талони:')} {group.slips.length}</span></h2>
  <div className="overflow-hidden rounded-lg border border-lime-400/20 bg-[#101818]">
   <table className="w-full table-fixed border-collapse text-left text-sm leading-snug">
    <caption className="sr-only">{en?'Results by slip for ':'Резултати по талони за '}{date(group.date)}</caption>
    <colgroup><col className="w-[43%] sm:w-[50%]"/><col className="w-[25%] sm:w-[25%]"/><col className="w-[13%] sm:w-[10%]"/><col className="w-[19%] sm:w-[15%]"/></colgroup>
    <thead className="bg-white/[0.035] text-white/50"><tr>
     <th scope="col" className="px-2 py-2 font-medium sm:px-3">{en?'Match':'Мач'}</th>
     <th scope="col" className="px-1 py-2 font-medium">{en?'Pick':'Залог'}</th>
     <th scope="col" className="px-1 py-2 text-center font-medium">{en?'Odds':'Коеф.'}</th>
     <th scope="col" className="px-1 py-2 text-center font-medium">{en?'Slip':'Талон'}</th>
    </tr></thead>
    {group.slips.map(({prediction:p,result},slipIndex)=>{
     const outcome=result?.payload.outcome || 'UNVERIFIED';
     const total=p.payload.selections.reduce((a,s)=>a*s.odds,1);
     return <tbody key={p.id} className="border-t border-lime-400/20">
      <tr className="bg-lime-400/[0.035]"><th colSpan={4} scope="rowgroup" className="px-2 py-1.5 font-normal sm:px-3"><span className="flex flex-wrap justify-between gap-x-2 gap-y-1"><span className="text-xs font-bold tracking-wide text-lime-300">{categoryLabel(p.payload.category)} <span className="font-normal text-white/40">· {slipIndex+1}</span></span><span className="text-xs text-white/60">{en?'Total':'Общ коеф.'} <b className="text-white/85">@{Number.isFinite(total)?total.toFixed(2):'—'}</b></span></span></th></tr>
      {p.payload.selections.map((s,i)=><tr key={i} className="border-t border-white/[0.07] align-middle">
       <td className="break-words px-2 py-2 sm:px-3"><span className="font-medium">{t(s.home)} <span className="text-white/35">–</span> {t(s.away)}</span><span className="mt-0.5 hidden text-xs text-white/40 sm:block"><MatchLeague {...s}/></span></td>
       <td className="break-words px-1 py-2 text-white/70">{p.payload.category==='elite'?(en?'1H corners W1':'1П корнери W1'):t(s.market)+' · '+t(s.choice)}</td>
       <td className="px-1 py-2 text-center tabular-nums text-lime-200">{Number.isFinite(s.odds)?s.odds.toFixed(2):'—'}</td>
       {i===0&&<td rowSpan={p.payload.selections.length} className={'border-l border-white/10 px-1 py-2 text-center font-bold '+(colors[outcome]||colors.UNVERIFIED)} title={result?.payload.approvalMode==='owner_confirmation'?(en?'Slip result confirmed by owner':'Резултат на талона, потвърден от собственика'):(en?'Result of the entire slip':'Резултат на целия талон')}><span className="sr-only">{en?'Slip result: ':'Резултат на талона: '}</span>{outcome==='UNVERIFIED'?(en?'Pending':'Чака'):outcome}</td>}
      </tr>)}
     </tbody>;
    })}
   </table>
  </div>
 </section>)}{groups.length>daysShown&&<button className="rounded-lg border border-white/20 px-4 py-2 text-sm" onClick={()=>setDaysShown(n=>n+7)}>{en?'Older results':'По-стари резултати'}</button>}</div>;
}
