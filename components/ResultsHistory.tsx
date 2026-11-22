'use client';
import {useState} from 'react';
import {useLanguage} from './LanguageProvider';
import MatchLeague from './MatchLeague';
import {categoryLabel} from '@/lib/categories';
import {resultHistory,type PublicPrediction,type PublicResult} from '@/lib/prediction-views';

const statusColors:Record<string,string>={
 WIN:'border-lime-400/25 bg-lime-400/10 text-lime-300',
 LOSS:'border-red-400/25 bg-red-400/10 text-red-300',
 VOID:'border-amber-400/25 bg-amber-400/10 text-amber-200',
 UNVERIFIED:'border-white/15 bg-white/5 text-white/55',
};

export default function ResultsHistory({predictions,results,today}:{predictions:PublicPrediction[];results:PublicResult[];today:string}){
 const {t,language}=useLanguage();
 const [daysShown,setDaysShown]=useState(7);
 const groups=resultHistory(predictions,results,today);
 const english=language==='en';
 const date=(day:string)=>day?new Intl.DateTimeFormat(english?'en-GB':'bg-BG',{dateStyle:'medium',timeZone:'Europe/Sofia'}).format(new Date(day+'T12:00:00Z')):t('Непотвърдена дата');
 if(!groups.length)return <p className="mt-5 rounded-xl border border-white/10 p-5 text-sm text-white/60">{t('Все още няма минали талони.')}</p>;
 return <div className="mt-4 space-y-4">
  <p className="text-xs leading-5 text-white/45">{english?'One row per match; WIN/LOSS is the result of the whole slip. Profit is simulated for 1 unit per slip, not real money.':'Един ред за всеки мач; WIN/LOSS е за целия талон. Печалбата е виртуална, при залог 1 единица на талон.'}</p>
  {groups.slice(0,daysShown).map(group=><section key={group.date||'unknown'} className="overflow-hidden rounded-xl border border-cyan-400/20 bg-[#0d1515]">
   <div className="flex items-center justify-between gap-3 border-b border-cyan-400/25 bg-[#112020] px-3 py-2">
    <h2 className="text-sm font-bold text-cyan-200"><time dateTime={group.date||undefined}>{date(group.date)}</time></h2>
    <span className="text-[11px] text-white/55">{english?'Slips: ':'Талони: '}{group.slips.length}</span>
   </div>
   {group.slips.map(({prediction:p,result})=>{
    const outcome=result?.payload.outcome||'UNVERIFIED';
    const totalOdds=Math.round(p.payload.selections.reduce((acc,s)=>acc*s.odds,1)*10000)/10000;
    const profit=outcome==='WIN'?totalOdds-1:outcome==='LOSS'?-1:outcome==='VOID'?0:null;
    const profitLabel=profit==null?'—':(profit>0?'+':'')+profit.toFixed(2);
    const picks=p.payload.selections;
    return <article key={p.id} className="border-b border-white/10 last:border-b-0">
     <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-white/[0.035] px-3 py-2">
      <h3 className="text-xs font-bold text-lime-300">{categoryLabel(p.payload.category)}</h3>
      <div className="flex items-center gap-2 text-[11px]">
       <span className="whitespace-nowrap text-white/65">{english?'Total':'Общо'} <b className="text-white">@{totalOdds.toFixed(2)}</b></span>
       <span className={'whitespace-nowrap rounded border px-1.5 py-0.5 font-bold '+(statusColors[outcome]||statusColors.UNVERIFIED)}>{outcome}</span>
       <span className={'min-w-12 whitespace-nowrap text-right font-bold '+(profit==null?'text-white/35':profit>0?'text-lime-300':profit<0?'text-red-300':'text-white/70')} title={english?'Virtual units for the entire slip':'Виртуални единици за целия талон'}>{profitLabel}</span>
      </div>
     </div>
     <table className="w-full table-fixed border-collapse text-[11px] leading-snug sm:text-xs">
      <caption className="sr-only">{categoryLabel(p.payload.category)} — {date(group.date)}; {english?'overall slip status':'общ статус на талона'}: {outcome}</caption>
      <colgroup><col style={{width:'44%'}}/><col style={{width:'40%'}}/><col style={{width:'16%'}}/></colgroup>
      <thead><tr className="bg-black/20 text-[10px] uppercase tracking-wide text-cyan-200/70">
       <th scope="col" className="px-2 py-1.5 text-left font-semibold sm:px-3">{english?'Match':'Мач'}</th>
       <th scope="col" className="px-2 py-1.5 text-left font-semibold">{english?'Prediction':'Прогноза'}</th>
       <th scope="col" className="px-2 py-1.5 text-right font-semibold sm:px-3">{english?'Odds':'Коеф.'}</th>
      </tr></thead>
      <tbody>{picks.map((s,i)=><tr key={i} className="border-t border-cyan-400/15 align-top">
       <td className="px-2 py-2 sm:px-3"><div className="break-words font-semibold text-white/90">{s.home} <span className="text-white/35">–</span> {s.away}</div><div className="mt-0.5 truncate text-[10px] text-white/40" title={s.league}><MatchLeague {...s}/></div></td>
       <td className="break-words px-2 py-2 text-white/75">{p.payload.category==='elite'?(english?'1H corners · W1':'1П корнери · W1'):t(s.market)+' · '+t(s.choice)}</td>
       <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-cyan-200 sm:px-3">@{s.odds.toFixed(2)}</td>
      </tr>)}</tbody>
     </table>
     {result?.payload.description&&<details className="border-t border-white/5 px-3 py-1.5 text-[11px] text-white/50">
      <summary className="cursor-pointer select-none">{english?'Result details':'Подробности за резултата'}{result.payload.approvalMode==='owner_confirmation'?' · '+(english?'Owner confirmed':'Потвърдено от собственика'):''}</summary>
      <p className="py-2 leading-5 text-white/70">{result.payload.description}</p>
     </details>}
    </article>;
   })}
  </section>)}
  {groups.length>daysShown&&<button type="button" className="rounded-lg border border-white/20 px-4 py-2 text-xs text-white/80" onClick={()=>setDaysShown(n=>n+7)}>{english?'Older results':'По-стари резултати'}</button>}
 </div>;
}
