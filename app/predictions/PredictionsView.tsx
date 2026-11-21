'use client';
import {useEffect} from 'react';
import ResultsHistory from '@/components/ResultsHistory';
import {useSofiaDay} from '@/components/useSofiaDay';
import {todayPredictions,sofiaDay,slipDay} from '@/lib/prediction-views';
import {categoryLabel} from "@/lib/categories";
import {useLanguage, LanguageSwitch} from '@/components/LanguageProvider';
import MatchLeague from '@/components/MatchLeague';
import MatchTeams from "@/components/MatchTeams";
import type { publicReport, PredictionPayload, ResultPayload } from "@/lib/editorial";

const outcomeClass: Record<string,string> = {
  WIN: "bg-lime-400/15 text-lime-300", LOSS: "bg-red-400/15 text-red-200", VOID: "bg-amber-400/15 text-amber-200", UNVERIFIED: "bg-white/10 text-white/60",
};

export default function PredictionsView({report,view='predictions'}: {view?:'predictions'|'results'|'statistics';report: Awaited<ReturnType<typeof publicReport>> | null}) {
  const {t, language} = useLanguage();
  useEffect(()=>{if(view!=='predictions')return;const target=window.location.hash==='#verified-results'?'/results/':window.location.hash==='#statistics'?'/statistics/':null;if(target)window.location.replace(target);},[view]);
  const bgTime = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'bg-BG', {dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Sofia'}).format(new Date(value)) : t('Часът не е потвърден');
  const today=useSofiaDay(report?.today);
  const predictions=todayPredictions(report?.predictions || [],today,report?.results || []);
  const results = report?.results || [];
  const stats = report?.metrics;
  return <main className="min-h-screen bg-[#080d0d] text-[#f0f5f1]">
    <header className="border-b border-white/10 bg-[#101818]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <a href="/index.html" className="flex items-center gap-3"><img src="/assets/mark.svg" width="48" height="48" alt="" /><span className="text-2xl font-black tracking-tight">BAZAR<span className="text-lime-400">SPORT</span><small className="block text-[9px] font-medium tracking-[0.24em] text-white/50">FOOTBALL INTELLIGENCE</small></span></a>
        <nav className="flex flex-wrap gap-5 text-sm text-white/70"><a href="/index.html">{t("Начало")}</a><a href="/mobile/" className="text-lime-300">{t("Приложение")}</a><a href="/predictions/">{t("Прогнози")}</a><a href="/results/">{t("Резултати")}</a><a href="/statistics/">{t("Статистика")}</a><LanguageSwitch/></nav>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-5 sm:pt-8 sm:px-8">{!report && <p role="alert" className="mb-5 text-amber-200">{language==='en'?'Data could not be loaded. Please refresh.':'Данните не могат да се заредят. Обнови страницата.'}</p>}
      {view==='predictions' && <section id="slip-columns">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.2em] text-lime-400">01 / TODAY'S PICKS</p><h1 className="mt-2 text-3xl font-extrabold">{t("Днешните прогнози")}</h1></div><span className="text-xs text-white/40">{predictions.length}  {t("одобрени публикации")}</span></div>
        {!predictions.length ? <div className="mt-6 rounded-3xl border border-dashed border-white/20 bg-[#101818] px-6 py-14 text-center"><div className="text-4xl text-lime-300">◎</div><h3 className="mt-4 text-xl font-bold">{t("Няма публикувани прогнози за днес")}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">{t("Миналите талони са в Резултати.")}</p></div> :
          <div className="mt-6 grid gap-5 lg:grid-cols-2">{predictions.map(p=>{
            const data = p.payload as PredictionPayload;
            const attached = results.find(r => (r.payload as ResultPayload).predictionId === p.id);
            const outcome = attached ? (attached.payload as ResultPayload).outcome : null;
            return <article key={p.id} className="rounded-3xl border border-white/10 bg-[#111a19] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-lime-400">{data.category==="elite"?t("🎯 CORNER HUNTER"):t("⚡ BET STRIKE")}</p><h3 className="mt-2 text-xl font-extrabold">{slipDay(p) ? new Intl.DateTimeFormat(language==='en'?'en-GB':'bg-BG',{dateStyle:'long',timeZone:'Europe/Sofia'}).format(new Date(slipDay(p)+'T12:00:00Z')) : t('Непотвърдена дата')}</h3><p className="mt-1 text-xs text-white/40">{t("Публикувано:")} {bgTime(p.publishedAt || p.createdAt)}</p></div><span className="rounded-xl bg-lime-400 px-4 py-2 text-lg font-black text-[#14220d]">@{data.selections.reduce((total,s)=>total*s.odds,1).toFixed(2)}</span></div>
              {data.approvalMode==="owner_unverified" && <p className="mt-3 text-xs text-amber-200">{t("Ръчно одобрено · без независима проверка")}</p>}
              <p className="mt-3 text-xs text-white/50">{t("Общ коефициент на целия талон")}{data.selections.some(s=>sofiaDay(s.kickoff)!==today) && <> · {t("Показани са само днешните срещи")}</>}</p><div className="mt-5 space-y-3">{data.selections.filter(s=>sofiaDay(s.kickoff)===today).map((s,i)=><div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/45"><MatchLeague {...s}/> · {bgTime(s.kickoff)}</p><div className="mt-2 flex items-start justify-between gap-3"><b className="flex flex-wrap items-center gap-x-2 gap-y-1"><MatchTeams {...s}/></b><span className="font-extrabold text-lime-300">@{s.odds.toFixed(2)}</span></div><p className="mt-1 text-sm text-white/70">{t(s.market)} · {t(s.choice)}</p>
              </div>)}</div>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50"><span>{t("Виртуална прогноза · 18+")}</span>{outcome && <span className={"rounded-full px-3 py-1 font-bold "+outcomeClass[outcome]}>{outcome}</span>}</div>
            </article>;
          })}</div>}
      </section>}
      {view==='statistics' && <section id="statistics">
        <h1 className="mt-2 text-3xl font-extrabold">{t("Статистика")}</h1>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["WIN",stats?.wins ?? 0],["LOSS",stats?.losses ?? 0],[t("Успеваемост"),stats?.winRate == null?"—":stats.winRate+"%"],["ROI",stats?.roi == null?"—":stats.roi+"%"]].map(([k,v])=><div key={String(k)} className="rounded-2xl border border-white/10 bg-[#111a19] px-5 py-6"><div className="text-3xl font-black text-lime-300">{v}</div><div className="mt-2 text-xs text-white/50">{k}</div></div>)}
        </div><p className="mt-3 text-xs leading-5 text-white/45">{t("Само публикувани прогнози с одобрени и проверени резултати участват в отчета. Приема се фиксиран виртуален залог от 1 единица на талон; VOID не носи печалба или загуба, а UNVERIFIED не влиза в ROI. Миналата статистика не гарантира бъдеща печалба.")}</p>
      </section>}
      {view==='results' && <section id="verified-results">
        <h1 className="mt-2 text-3xl font-extrabold">{t("Резултати")}</h1>
        <ResultsHistory predictions={report?.predictions || []} results={results} today={today}/>
      </section>}
      <p className="mt-14 border-t border-white/10 pt-6 text-xs leading-6 text-white/40">{t("BAZARSPORT не приема залози. Всички прогнози са с информационна цел. 18+ · Играй отговорно.")}</p>
    </div>
  </main>;
}
