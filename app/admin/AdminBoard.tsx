"use client";
import {safeSourceUrl} from '@/lib/media';
import {categoryLabel} from "@/lib/categories";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Selection = {
  homeLogo?: string; awayLogo?: string; homeCountry?: string; awayCountry?: string;
  home: string; away: string; league: string; kickoff: string; market: string; choice: string;
  odds: number; oddsCheckedAt: string; sources: string[];
  oddsSource?: "owner_slip" | "independent_urls"; bookmaker?: string; oddsReceivedAt?: string; slipImage?: string; fixtureVerificationMethod?: "sources" | "owner_confirmation"; fixtureVerified?: boolean; fixtureCheckedAt?: string; fixtureSources?: string[];
};
type PredictionData = { category: "quantbet" | "elite"; analysis: string; risk: string; selections: Selection[] };
type ResultData = { predictionId: string; outcome: string; checkedAt: string; sources: string[]; description: string; cornerResults?: { home: number; away: number }[] };
type Entry = { id: string; kind: string; title: string; status: string; payload: PredictionData | ResultData;
  createdAt: string; updatedAt: string; publishedAt: string | null; validation: string[]; ownerConfirmationValidation?: string[] | null };
type EntryForm = { kind: "prediction" | "result"; title: string; payload: PredictionData | ResultData };

const initialSelection = (): Selection => ({ home: "", away: "", league: "", kickoff: "", market: "", choice: "", odds: 1, oddsCheckedAt: "", sources: ["", ""] });
function emptyForm(kind: "prediction" | "result" = "prediction"): EntryForm {
  return kind === "prediction" ?
    { kind, title: "", payload: { category: "quantbet", analysis: "", risk: "", selections: [initialSelection(), initialSelection()] } } :
    { kind, title: "", payload: { predictionId: "", outcome: "UNVERIFIED", checkedAt: "", sources: ["", ""], description: "" } };
}
const bgTime = (iso: string) => {
  if (!iso || Number.isNaN(Date.parse(iso))) return "Часът не е проверен";
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(new Date(iso));
};
const shapeTime = (input: string) => input && Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : input;
const field = "w-full rounded-xl border border-white/10 bg-[#141d1d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-lime-400";
const label = "text-xs font-medium uppercase tracking-wider text-white/50";

export default function AdminBoard({ owner }: { owner: string }) {
  const [records, setRecords] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("draft");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts", { cache: "no-store" });
      const data = await res.json() as { entries: Entry[]; error?: string };
      if (!res.ok) throw Error(data.error || "Грешка при зареждане.");
      setRecords(data.entries);
    } catch (e) { setError(e instanceof Error ? e.message : "Грешка."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const feedback = (message: string, bad = false) => { setError(bad ? message : ""); setSuccess(bad ? "" : message); };
  const update = (change: Partial<EntryForm>) => setForm(f => ({ ...f, ...change }));
  const updatePayload = (change: Partial<PredictionData & ResultData>) =>
    setForm(f => ({ ...f, payload: { ...f.payload, ...change } as PredictionData | ResultData }));
  const updateSelection = (index: number, change: Partial<Selection>) => {
    const p = form.payload as PredictionData;
    updatePayload({ selections: p.selections.map((s,i) => i === index ? { ...s, ...change } : s) });
  };
  const submit = async () => {
    setBusy("save"); setError(""); setSuccess("");
    try {
      const payload = structuredClone(form);
      if (payload.kind === "prediction") {
        const data = payload.payload as PredictionData;
        data.selections = data.selections.map(s => ({ ...s, kickoff: shapeTime(s.kickoff), oddsCheckedAt: shapeTime(s.oddsCheckedAt) }));
      } else { const data = payload.payload as ResultData; data.checkedAt = shapeTime(data.checkedAt); }
      const res = await fetch(editId ? "/api/drafts/" + editId : "/api/drafts", {
        method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json() as { error?: string; validation?: string[] };
      if (!res.ok) throw Error(response.error || "Не може да се запише.");
      setShowForm(false); setEditId(null); setForm(emptyForm());
      await refresh();
      feedback(response.validation?.length
        ? "Черновата е запазена. Преди публикуване попълни липсващите проверки."
        : "Черновата е запазена и очаква твоето одобрение.");
    } catch (e) { feedback(e instanceof Error ? e.message : "Грешка при запис.", true); }
    finally { setBusy(""); }
  };
  const decision = async (record: Entry, action: "publish" | "reject") => {
    const confirmFixtures = action === "publish" && record.kind === "prediction" && (record.payload as PredictionData).category === "elite" && !!record.validation?.length && record.ownerConfirmationValidation?.length === 0;
    if (confirmFixtures && !confirm("Потвърждавам лично, че следните срещи и начални часове са верни:\n\n" + (record.payload as PredictionData).selections.map(s=>s.home+" — "+s.away+" · "+bgTime(s.kickoff)).join("\n") + "\n\nТова ще бъде записано като потвърждение от собственика, не като независима проверка. Да потвърдя и публикувам?")) return;
    if (action === "publish" && !confirmFixtures && !confirm("Да публикувам ли „" + record.title + "“? Това ще стане видимо в сайта.")) return;
    if (action === "reject" && !confirm("Да отхвърля ли черновата „" + record.title + "“?")) return;
    setBusy(record.id); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/drafts/" + record.id, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirmFixtures }),
      });
      const response = await res.json() as { error?: string };
      if (!res.ok) throw Error(response.error || "Неуспешно действие.");
      await refresh();
      feedback(action === "publish" ? "Публикувано след твоето одобрение." : "Черновата е отхвърлена.");
    } catch (e) { feedback(e instanceof Error ? e.message : "Грешка.", true); }
    finally { setBusy(""); }
  };
  const editing = (record: Entry) => {
    setForm({ title: record.title, kind: record.kind as "prediction" | "result", payload: structuredClone(record.payload) });
    setEditId(record.id); setShowForm(true); setError(""); setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const recordsByStatus = records.filter(r => r.status === tab);
  return (
    <main className="min-h-screen bg-[#080c0d] text-white">
      <div className="border-b border-white/10 bg-[#101717]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <a href="/index.html" className="flex items-center gap-3 font-black tracking-tight">
            <img src="/assets/mark.svg" alt="" className="h-10 w-10" />
            <span className="text-xl">BAZAR<span className="text-lime-400">SPORT</span></span>
          </a>
          <Link href="/predictions" className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:text-lime-300">Виж публичната страница ↗</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-lime-400">ЧАСТЕН РЕДАКЦИОНЕН ЦЕНТЪР</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Ти решаваш.<br/><span className="text-lime-400">AI подготвя.</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Здравей, {owner}. Преглеждаш проверките, редактираш предложенията и само ти можеш да публикуваш. AI няма бутон за публикуване.</p>
          </div>
          <button onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(s => !s); }} className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-[#10200b] hover:bg-lime-300">
            {showForm ? "Затвори формата" : "＋ Нова чернова"}
          </button>
        </div>
        <nav className="mt-5 flex gap-5 text-sm text-lime-300"><a href="/results/">Резултати</a><a href="/statistics/">Статистика и ROI</a></nav><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Чакащи одобрение", records.filter(r => r.status === "draft").length], ["Публикувани", records.filter(r => r.status === "published").length],
          ["Отхвърлени", records.filter(r => r.status === "rejected").length], ["Автоматично публикувани", "0"]].map(([name,value]) =>
            <div key={name} className="rounded-2xl border border-white/10 bg-[#101818] p-4">
              <div className="text-3xl font-black text-lime-300">{value}</div><div className="mt-1 text-xs text-white/50">{name}</div>
            </div>)}
        </div>
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
        {success && <div role="status" className="mt-5 rounded-xl border border-lime-400/20 bg-lime-900/20 p-4 text-sm text-lime-200">{success}</div>}
        {showForm && <section className="mt-7 rounded-3xl border border-lime-400/25 bg-[#111a1a] p-4 sm:p-7">
          <h2 className="text-xl font-bold">{editId ? "Редакция на чернова" : "Нова чернова"}</h2>
          <p className="mt-1 text-sm text-white/50">Записът остава скрит, докато не натиснеш „Одобри и публикувай“.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2"><span className={label}>Вид</span><select disabled={Boolean(editId)} className={field} value={form.kind} onChange={e => setForm(emptyForm(e.target.value as "prediction" | "result"))}><option value="prediction">Прогноза</option><option value="result">Проверен резултат</option></select></label>
            <label className="grid gap-2"><span className={label}>Заглавие</span><input className={field} value={form.title} onChange={e => update({ title: e.target.value })} placeholder="BET STRIKE — 14 ноември" /></label>
          </div>
          {form.kind === "prediction" ? <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2"><span className={label}>Категория</span><select className={field} value={(form.payload as PredictionData).category} onChange={e => { const category=e.target.value as "quantbet" | "elite"; updatePayload({category, selections:(form.payload as PredictionData).selections.map(s=>({...s,oddsSource:category==="elite"?"owner_slip":"independent_urls",market:category==="elite"?"1П корнери (3-way)":s.market,choice:category==="elite"?"W1":s.choice}))}); }}><option value="quantbet">⚡ BET STRIKE</option><option value="elite">🎯 CORNER HUNTER</option></select></label>
              <label className="grid gap-2"><span className={label}>Рискове</span><input className={field} value={(form.payload as PredictionData).risk} onChange={e => updatePayload({ risk: e.target.value })} placeholder="Състави, темпо, ротация..." /></label>
            </div>
            <label className="mt-4 grid gap-2"><span className={label}>Аргументиран анализ</span><textarea rows={3} className={field} value={(form.payload as PredictionData).analysis} onChange={e => updatePayload({ analysis: e.target.value })} /></label>
            {(form.payload as PredictionData).selections.map((s,i) => <div key={i} className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex items-center justify-between"><h3 className="font-bold text-lime-200">Селекция {i+1}</h3>{(form.payload as PredictionData).selections.length > 1 && <button className="text-xs text-red-300" onClick={() => updatePayload({ selections: (form.payload as PredictionData).selections.filter((_,j)=>i!==j) })}>Премахни</button>}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([["home","Домакин"],["away","Гост"],["league","Първенство"],["market","Пазар"],["choice","Избор"]] as const).map(([key,name])=>
                  <label key={key} className="grid gap-1"><span className={label}>{name}</span><input className={field} value={s[key]} onChange={e => updateSelection(i,{[key]:e.target.value})}/></label>)}
                {([['homeCountry','Държава на домакина'],['awayCountry','Държава на госта']] as const).map(([key,title])=><label key={key} className="grid gap-1"><span className={label}>{title}</span><input className={field} placeholder="FR, BG, GB-ENG… (за клуб: държавата на клуба)" value={s[key] || ''} onChange={e=>updateSelection(i,{[key]:e.target.value.toUpperCase()})}/></label>)}
                {([['homeLogo','Лого на домакина'],['awayLogo','Лого на госта']] as const).map(([key,title])=><label key={key} className="grid gap-1"><span className={label}>{title} · HTTPS URL</span><input className={field} type="url" value={s[key] || ''} onChange={e=>updateSelection(i,{[key]:e.target.value})}/><span className="text-xs text-white/40">Само потвърдено лого от официален клубен сайт или разрешен доставчик.</span></label>)}
                <label className="grid gap-1"><span className={label}>Коефициент</span><input type="number" min="1.01" step="0.01" className={field} value={s.odds} onChange={e=>updateSelection(i,{odds:Number(e.target.value)})}/></label>
                <label className="grid gap-1"><span className={label}>Начало · ISO с часова зона</span><input className={field} value={s.kickoff} placeholder="2026-11-14T17:00:00+02:00" onChange={e => updateSelection(i,{kickoff:e.target.value})}/></label>
                {(form.payload as PredictionData).category === "elite" && <>
                  <label className="grid gap-1"><span className={label}>Източник на коефициента</span><select className={field} value={s.oddsSource || "independent_urls"} onChange={e=>updateSelection(i,{oddsSource:e.target.value as Selection["oddsSource"]})}><option value="independent_urls">Независими URL източници</option><option value="owner_slip">Фиш от собственика</option></select></label>
                  {s.oddsSource === "owner_slip" && <>
                    <p className="text-xs text-amber-200 sm:col-span-2">Фиш от собственика — не е независимо потвърдена пазарна цена. Неизвестните данни остават непотвърдени.</p>
                    <label><span className={label}>Букмейкър, ако е известен</span><input className={field} value={s.bookmaker || ""} onChange={e=>updateSelection(i,{bookmaker:e.target.value})}/></label>
                    <label><span className={label}>Дата и час на получаване · ISO</span><input className={field} value={s.oddsReceivedAt || ""} onChange={e=>updateSelection(i,{oddsReceivedAt:e.target.value})}/></label>
                    <label><span className={label}>Снимка на фиша · URL</span><input className={field} value={s.slipImage?.startsWith("data:") ? "" : s.slipImage || ""} onChange={e=>updateSelection(i,{slipImage:e.target.value})}/></label>
                    <label><span className={label}>Качи снимка (до 500 KB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>500000){feedback("Снимката трябва да е до 500 KB.",true);return;}const reader=new FileReader();reader.onload=()=>updateSelection(i,{slipImage:String(reader.result)});reader.readAsDataURL(file);}}/></label>
                    {s.slipImage && <img src={s.slipImage} alt="Фиш от собственика" className="max-h-48 max-w-full rounded-xl"/>}
                  </>}
                  <label><input type="checkbox" checked={!!s.fixtureVerified} onChange={e=>updateSelection(i,{fixtureVerified:e.target.checked})}/> Срещата и началният час са проверени</label>
                  <label><span className={label}>Проверка на срещата · ISO</span><input className={field} value={s.fixtureCheckedAt || ""} onChange={e=>updateSelection(i,{fixtureCheckedAt:e.target.value})}/></label>
                  {[0,1].map(k=><label key={k}><span className={label}>Източник за срещата {k+1} {k===1?"(незадължителен)":""}</span><input className={field} value={s.fixtureSources?.[k] || ""} onChange={e=>{const urls=[...(s.fixtureSources || ["",""])];urls[k]=e.target.value;updateSelection(i,{fixtureSources:urls});}}/></label>)}
                  <p className="text-xs text-amber-200 sm:col-span-2">Пазар: 1П корнери (3-way), избор: W1. Равенство = губеща прогноза.</p>
                </>}
                {!((form.payload as PredictionData).category==="elite" && s.oddsSource==="owner_slip") && <><label className="grid gap-1"><span className={label}>Проверка на коефициента · ISO (за URL източници)</span><input className={field} value={s.oddsCheckedAt || ""} placeholder="2026-11-14T08:00:00+02:00" onChange={e => updateSelection(i,{oddsCheckedAt:e.target.value})}/></label>
                {[0,1].map(k=><label key={k} className="grid gap-1 sm:col-span-2"><span className={label}>Източник на коефициента {k+1} · URL (за URL източници)</span><input className={field} value={(s.sources || [])[k] || ""} onChange={e=>updateSelection(i,{sources:[...(s.sources || []).slice(0,k),e.target.value,...(s.sources || []).slice(k+1)]})}/></label>)}</>}
              </div>
            </div>)}
            {(form.payload as PredictionData).selections.length < 3 && <button className="mt-3 text-sm text-lime-300" onClick={() => updatePayload({ selections: [...(form.payload as PredictionData).selections, {...initialSelection(), ...((form.payload as PredictionData).category==="elite" ? {oddsSource:"owner_slip" as const,market:"1П корнери (3-way)",choice:"W1"}: {})}] })}>＋ Добави мач</button>}
          </> : <>
            <label className="mt-4 grid gap-1"><span className={label}>CORNER HUNTER корнери 1П · домакин:гост за всяка селекция</span><input className={field} placeholder="3:1, 2:2" defaultValue={(form.payload as ResultData).cornerResults?.map(c=>`${c.home}:${c.away}`).join(", ") || ""} onBlur={e=>updatePayload({cornerResults:e.target.value ? e.target.value.split(",").map(pair=>{const [home,away]=pair.trim().split(":").map(Number);return {home,away};}) : undefined})}/><span className="text-xs text-amber-200">Равенство по корнери 1П е LOSS.</span></label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1"><span className={label}>Публикувана прогноза</span><select className={field} value={(form.payload as ResultData).predictionId} onChange={e=>updatePayload({ predictionId:e.target.value })}><option value="">Избери талон</option>{records.filter(r=>r.kind==="prediction"&&r.status==="published").map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
              <label className="grid gap-1"><span className={label}>Краен статус</span><select className={field} value={(form.payload as ResultData).outcome} onChange={e=>updatePayload({outcome:e.target.value})}>{["WIN","LOSS","VOID","UNVERIFIED"].map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="grid gap-1"><span className={label}>Проверено на · ISO</span><input className={field} placeholder="2026-11-15T00:30:00+02:00" value={(form.payload as ResultData).checkedAt} onChange={e=>updatePayload({checkedAt:e.target.value})}/></label>
              <label className="grid gap-1"><span className={label}>Официален резултат / корнери</span><input className={field} value={(form.payload as ResultData).description} onChange={e=>updatePayload({description:e.target.value})}/></label>
              {[0,1].map(i=><label key={i} className="grid gap-1 sm:col-span-2"><span className={label}>Източник {i+1}</span><input className={field} value={(form.payload as ResultData).sources[i] || ""} onChange={e=>{const p=form.payload as ResultData;updatePayload({sources:[...p.sources.slice(0,i),e.target.value,...p.sources.slice(i+1)]})}} /></label>)}
            </div>
          </>}
          <div className="mt-6 flex flex-wrap gap-3"><button disabled={Boolean(busy)} className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-40" onClick={submit}>{busy==="save"?"Запазване...":"Запази като чернова"}</button><button className="rounded-xl border border-white/20 px-5 py-3 text-sm" onClick={()=>{setShowForm(false);setEditId(null)}}>Отказ</button></div>
        </section>}
        <div className="mt-9 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {[["draft","Чакащи одобрение"],["published","Публикувани"],["rejected","Отхвърлени"]].map(([value,name]) =>
            <button key={value} onClick={()=>setTab(value)} className={"rounded-full px-4 py-2 text-sm "+(tab===value?"bg-lime-400 font-bold text-black":"bg-[#162020] text-white/60 hover:text-white")}>{name} · {records.filter(r=>r.status===value).length}</button>)}
          <button className="ml-auto text-xs text-white/50 underline underline-offset-4" onClick={()=>void refresh()}>Обнови</button>
        </div>
        {loading ? <p className="mt-8 text-white/50">Зареждане...</p> : !recordsByStatus.length ? <div className="mt-7 rounded-2xl border border-dashed border-white/15 p-10 text-center"><div className="text-3xl">◎</div><h2 className="mt-3 text-lg font-bold">Няма записи в тази категория</h2><p className="mt-1 text-sm text-white/45">AI черновите ще се показват тук след свързване на редакционния плъгин.</p></div> :
          <div className="mt-5 grid gap-4">{recordsByStatus.map(r=><article key={r.id} className="rounded-2xl border border-white/10 bg-[#101818] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-lime-400">{r.kind==="result"?("ПРОВЕРКА НА РЕЗУЛТАТ · "+(records.find(p=>p.id===(r.payload as ResultData).predictionId)?categoryLabel((records.find(p=>p.id===(r.payload as ResultData).predictionId)!.payload as PredictionData).category):"")):((r.payload as PredictionData).category==="elite"?"🎯 CORNER HUNTER":"⚡ BET STRIKE")}</p><h3 className="mt-1 text-xl font-extrabold">{r.title}</h3><p className="mt-1 text-xs text-white/40">Добавено: {bgTime(r.createdAt)} · {r.status==="draft"?"Само за теб":r.status==="published"?"Публикувано":"Отхвърлено"}</p></div><span className={"rounded-full border px-3 py-1 text-xs font-bold "+(r.status==="draft"?"border-amber-400/30 text-amber-200":r.status==="published"?"border-lime-400/30 text-lime-300":"border-white/20 text-white/50")}>{r.status==="draft"?"ЧЕРНОВА":r.status==="published"?"ПУБЛИКУВАНО":"ОТХВЪРЛЕНО"}</span></div>
            {r.kind==="prediction" ? <div className="mt-4 space-y-3">{(r.payload as PredictionData).selections?.map((s,i)=><div key={i} className="rounded-xl bg-black/20 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><b>{s.home} — {s.away}</b><b className="text-lime-300">@{s.odds}</b></div>
              <p className="mt-1 text-white/65">{s.market} · {s.choice}</p>
              <p className="mt-1 text-xs text-white/45">{s.league} · {bgTime(s.kickoff)}</p>
              {s.oddsSource !== "owner_slip" && <p className="mt-2 text-xs text-white/60">Източник на коефициентите: URL източници · Проверка: {bgTime(s.oddsCheckedAt)}</p>}
              {s.oddsSource === "owner_slip" && <div className="mt-2 text-xs text-amber-200"><p>Фиш от собственика · Букмейкър: {s.bookmaker || "непотвърден"} · Получен: {bgTime(s.oddsReceivedAt || "")}</p><p>Не е независимо потвърдена пазарна цена.</p>{s.slipImage ? <img src={s.slipImage} alt="Фиш от собственика" className="mt-2 max-h-48 rounded-lg"/> : <p>Снимка: не е предоставена.</p>}</div>}
              {(r.payload as PredictionData).category === "elite" && <p className="mt-2 text-xs">Среща: {s.fixtureVerificationMethod==="owner_confirmation" ? "потвърдена лично от собственика" : s.fixtureVerified ? "проверена" : "непотвърдена"} · {bgTime(s.fixtureCheckedAt || "")} · {(s.fixtureSources || []).map((u,j)=><a key={j} href={safeSourceUrl(u)} target="_blank" rel="noreferrer" className="mr-3 text-sky-300 underline">Проверка {j+1}</a>)} · Равенство = LOSS</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs">{(s.sources||[]).filter(Boolean).map((u,j)=><a key={j} className="text-sky-300 underline" href={safeSourceUrl(u)} target="_blank" rel="noopener noreferrer">Източник {j+1}</a>)}</div>
            </div>)}<p className="text-sm font-bold">Резултат: {records.find(entry=>entry.kind==="result" && entry.status==="published" && (entry.payload as ResultData).predictionId===r.id) ? (records.find(entry=>entry.kind==="result" && entry.status==="published" && (entry.payload as ResultData).predictionId===r.id)!.payload as ResultData).outcome : "UNVERIFIED"}</p><p className="font-bold text-lime-300">Общ коефициент: {Number((r.payload as PredictionData).selections.reduce((v,s)=>v*s.odds,1).toFixed(4))}</p><p className="text-sm text-white/65">{(r.payload as PredictionData).analysis}</p><p className="text-sm text-amber-200/70">Риск: {(r.payload as PredictionData).risk}</p></div> :
              <div className="mt-4 text-sm text-white/70"><b className="text-lime-300">{(r.payload as ResultData).outcome}</b> · {(r.payload as ResultData).description}<p className="mt-1 text-xs">Източници: {(r.payload as ResultData).sources?.map((u,i)=><a key={i} className="ml-3 text-sky-300 underline" href={safeSourceUrl(u)} target="_blank" rel="noreferrer">{i+1}</a>)}</p></div>}
            {r.validation?.length>0 && <div className="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><b>{r.ownerConfirmationValidation?.length===0 ? "Остава твоето потвърждение за срещите и часовете:" : "Не е готово за публикуване:"}</b><ul className="mt-2 list-disc space-y-1 pl-5">{r.validation.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
            {r.status==="draft" && <div className="mt-5 flex flex-wrap gap-2"><button disabled={Boolean(busy)||Boolean(r.validation?.length && r.ownerConfirmationValidation?.length !== 0)} className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-35" onClick={()=>void decision(r,"publish")}>{r.validation?.length && r.ownerConfirmationValidation?.length===0 ? "✓ Потвърди срещите и публикувай" : "✓ Одобри и публикувай"}</button><button disabled={Boolean(busy)} className="rounded-lg border border-white/20 px-4 py-2 text-sm" onClick={()=>editing(r)}>Редактирай</button><button disabled={Boolean(busy)} className="rounded-lg px-4 py-2 text-sm text-red-300 hover:bg-red-950/40" onClick={()=>void decision(r,"reject")}>Отхвърли</button></div>}
          </article>)}</div>}
        <p className="mt-10 text-center text-xs leading-6 text-white/35">BAZARSPORT · Всички публикувания са с решение на собственика. Няма гарантирана печалба. 18+ · Виртуална статистика.</p>
      </div>
    </main>
  );
}
