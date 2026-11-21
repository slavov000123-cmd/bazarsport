'use client';
import {useState} from 'react';
import {useLanguage} from './LanguageProvider';
import MatchLeague from './MatchLeague';
import MatchTeams from './MatchTeams';
import {categoryLabel} from '@/lib/categories';
import {resultHistory,type PublicPrediction,type PublicResult} from '@/lib/prediction-views';
const colors:Record<string,string>={WIN:'bg-lime-400/15 text-lime-300',LOSS:'bg-red-400/15 text-red-200',VOID:'bg-amber-400/15 text-amber-200',UNVERIFIED:'bg-white/10 text-white/60'};
export default function ResultsHistory({predictions,results,today}:{predictions:PublicPrediction[];results:PublicResult[];today:string}){
 const {t,language}=useLanguage();
 const [daysShown,setDaysShown]=useState(7);
 const groups=resultHistory(predictions,results,today);
 const date=(day:string)=>day?new Intl.DateTimeFormat(language==='en'?'en-GB':'bg-BG',{dateStyle:'long',timeZone:'Europe/Sofia'}).format(new Date(day+'T12:00:00Z')):t('Непотвърдена дата');
 if(!groups.length)return <p className="mt-5 rounded-2xl border border-white/10 p-6 text-sm text-white/60">{t('Все още няма минали талони.')}</p>;
 return <div className="mt-6 space-y-6">{groups.slice(0,daysShown).map(group=><section key={group.date || 'unknown'}><h2 className="mb-3 flex flex-wrap items-center gap-3 text-base font-bold"><time dateTime={group.date || undefined}>{date(group.date)}</time><span className="text-sm font-normal text-white/50">{t('Талони:')} {group.slips.length}</span></h2><div className="grid gap-3 lg:grid-cols-2">{group.slips.map(({prediction:p,result})=>{
 const outcome=result?.payload.outcome || 'UNVERIFIED';
 return <article key={p.id} className="min-w-0 rounded-xl border border-white/10 bg-[#111a19] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-lime-300">{categoryLabel(p.payload.category)}</h3><span className={'rounded-full px-2 py-1 text-xs font-bold '+(colors[outcome]||colors.UNVERIFIED)}><span className="sr-only">{language==='en'?'Slip result: ':'Резултат на талона: '}</span>{outcome}</span></div><div className="space-y-3">{p.payload.selections.map((s,i)=><div key={i} className="border-t border-white/10 pt-2"><div className="mb-1 text-xs text-white/50"><MatchLeague {...s}/></div><div className="text-sm font-semibold"><MatchTeams {...s}/></div><div className="mt-1 flex justify-between gap-3 text-sm"><span className="text-white/65">{p.payload.category==='elite'?(language==='en'?'1H corners · W1':'1П корнери · W1'):t(s.market)+' · '+t(s.choice)}</span><b className="shrink-0 text-lime-300">@{s.odds.toFixed(2)}</b></div></div>)}</div></article>;
 })}</div></section>)}{groups.length>daysShown&&<button className="rounded-xl border border-white/20 px-4 py-2 text-sm" onClick={()=>setDaysShown(n=>n+7)}>{language==='en'?'Older results':'По-стари резултати'}</button>}</div>;
}
