import {sofiaDay} from "@/lib/prediction-views";
import { presentEntry } from "@/lib/categories";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, entries } from "@/db/schema";

export type PredictionSelection = {
  home: string;
  homeCountry?: string;
  homeLogo?: string;
  awayLogo?: string;
  awayCountry?: string;
  away: string;
  league: string;
  kickoff: string;
  market: string;
  choice: string;
  odds: number;
  oddsCheckedAt: string;
  sources: string[];
  oddsSource?: "independent_urls" | "owner_slip";
  bookmaker?: string;
  oddsReceivedAt?: string;
  slipImage?: string;
  fixtureVerified?: boolean;
  fixtureVerificationMethod?: "sources" | "owner_confirmation";
  fixtureCheckedAt?: string;
  fixtureSources?: string[];
};

export type PredictionPayload = {
  category: "quantbet" | "elite";
  analysis: string;
  risk: string;
  selections: PredictionSelection[];
  virtualStake?: number;
  approvalMode?: "owner_unverified";
};

export type ResultPayload = {
  predictionId: string;
  outcome: "WIN" | "LOSS" | "VOID" | "UNVERIFIED";
  checkedAt: string;
  sources: string[];
  description: string;
  cornerResults?: { home: number; away: number }[];
  approvalMode?: "owner_confirmation";
  cornerVerificationMethod?: "owner_confirmation" | "recorded_counts";
};

export type EntryInput = {
  kind: "prediction" | "result";
  title: string;
  payload: PredictionPayload | ResultPayload;
};

export function publicationErrors(input: EntryInput, ownerConfirmsFixtures = false, manualApproval = false): string[] {
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push("Заглавието е задължително.");
  if (input.kind === "prediction") {
    const data = input.payload as PredictionPayload;
    if (!["quantbet", "elite"].includes(data.category)) errors.push("Невалидна категория.");
    if (!manualApproval && !data.analysis?.trim()) errors.push("Добави аргументиран анализ.");
    if (!manualApproval && !data.risk?.trim()) errors.push("Добави рисковете.");
    if (!Array.isArray(data.selections) || data.selections.length < 1 || data.selections.length > 3) {
      errors.push("Необходими са от 1 до 3 селекции.");
    } else for (const [i, match] of data.selections.entries()) {
      const n = i + 1;
      if (!["home","away","league","market","choice"].every((k) => typeof match[k as keyof PredictionSelection] === "string" && String(match[k as keyof PredictionSelection]).trim())) errors.push("Селекция " + n + ": попълни отбори, лига и пазар.");
      if (!Number.isFinite(match.odds) || match.odds <= 1 || match.odds > 100) errors.push("Селекция " + n + ": невалиден коефициент.");
      const kick = Date.parse(match.kickoff);
      if (!Number.isFinite(kick)) errors.push("Селекция " + n + ": невалиден час.");
      else if (kick <= Date.now()) errors.push("Селекция " + n + ": мачът вече е започнал; не може да бъде публикуван като предстоящ.");
      const ownerSlip = data.category === "elite" && match.oddsSource === "owner_slip";
      if (ownerSlip) {
        if (!manualApproval && !Number.isFinite(Date.parse(match.oddsReceivedAt || ""))) errors.push("Селекция " + n + ": липсва дата и час на получаване на фиша.");
        if (match.slipImage && !/^https:\/\/|^data:image\/(png|jpeg|webp);base64,/.test(match.slipImage)) errors.push("Невалидна снимка на фиша.");
      }
      if (!manualApproval && !ownerSlip && !Number.isFinite(Date.parse(match.oddsCheckedAt))) errors.push("Селекция " + n + ": липсва час на проверката на коефициента.");
      if (!manualApproval && !ownerSlip && !independentSources(match.sources)) errors.push("Селекция " + n + ": нужни са два независими източника за коефициента.");
      if (data.category === "elite" && !manualApproval && !ownerConfirmsFixtures && (!match.fixtureVerified || !Number.isFinite(Date.parse(match.fixtureCheckedAt || "")) || !fixtureSource(match.fixtureSources))) errors.push("Селекция " + n + ": потвърди реалната среща и началния час с надежден източник.");
      if (data.category === "elite" && (!/3[- ]?(?:way|посочен)|трипосочен/i.test(match.market) || match.choice !== "W1")) errors.push("CORNER HUNTER изисква 3-way W1; равенството по корнери 1П е LOSS.");
      if (data.category === "elite" && (!/корнер|corner/i.test(match.market) || !/първ|1п|1h/i.test(match.market))) {
        errors.push("CORNER HUNTER допуска само корнери за първото полувреме.");
      }
    }
  } else if (input.kind === "result") {
    const data = input.payload as ResultPayload;
    if (!data.predictionId?.trim()) errors.push("Посочи публикувана прогноза.");
    if (!["WIN","LOSS","VOID","UNVERIFIED"].includes(data.outcome)) errors.push("Невалиден резултат.");
    if (!Number.isFinite(Date.parse(data.checkedAt))) errors.push("Посочи кога са проверени резултатите.");
    if (!independentSources(data.sources)) errors.push("Резултатът изисква два независими източника.");
    if (!data.description?.trim()) errors.push("Добави описание на проверката.");
  } else errors.push("Невалиден тип.");
  return errors;
}

function fixtureSource(values: unknown): boolean {
  return Array.isArray(values) && values.some(value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname); } catch { return false; }
  });
}

function independentSources(values: unknown): boolean {
  if (!Array.isArray(values)) return false;
  try {
    const hosts = values.filter((s): s is string => typeof s === "string")
      .map((s) => {const url=new URL(s);if (!["https:","http:"].includes(url.protocol)) throw Error("Invalid source protocol");return url.hostname.toLowerCase().replace(/^www\./, "");});
    return new Set(hosts).size >= 2 && hosts.every(Boolean);
  } catch { return false; }
}

export function combinedOdds(data: PredictionPayload): number {
  return Math.round(data.selections.reduce((acc, item) => acc * item.odds, 1) * 10000) / 10000;
}

export async function readEntries(status?: string) {
  const db = getDb();
  const rows = status
    ? await db.select().from(entries).where(eq(entries.status, status)).orderBy(desc(entries.createdAt))
    : await db.select().from(entries).orderBy(desc(entries.createdAt));
  return rows.map((r) => presentEntry({ ...r, payload: JSON.parse(r.payload) }));
}

function validateStoredInput(input: EntryInput) {
 if (!input || !["prediction","result"].includes(input.kind) || typeof input.title!=="string" || !input.title.trim() || !input.payload || typeof input.payload!=="object") throw Error("Невалиден формат на черновата.");
 if (JSON.stringify(input).length > 2_100_000) throw Error("Черновата е прекалено голяма.");
 if (input.kind === "prediction") {
  const selections=(input.payload as PredictionPayload).selections;
  if (!Array.isArray(selections) || !selections.length || selections.length>3 || selections.some(s=>!s || typeof s!=="object")) throw Error("Нужни са от 1 до 3 селекции.");
  if (selections.some(s=>s.slipImage && (typeof s.slipImage!=="string" || s.slipImage.length>700_000 || !/^https:\/\/|^data:image\/(png|jpeg|webp);base64,/.test(s.slipImage)))) throw Error("Невалидна или прекалено голяма снимка на фиша.");
 }
}

export async function createDraft(input: EntryInput, actor: string) {
  validateStoredInput(input);
  if (!["prediction", "result"].includes(input.kind) || !input.title?.trim() || !input.payload || typeof input.payload !== "object") throw Error("Нужни са тип, заглавие и съдържание.");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(entries).values({
    id, kind: input.kind, title: input.title.trim().slice(0, 180),
    payload: JSON.stringify(input.payload), status: "draft",
    referenceId: input.kind === "result" ? (input.payload as ResultPayload).predictionId : null,
    createdAt: now, updatedAt: now, createdBy: actor,
  });
  await recordAudit(id, actor, "draft_created");
  return { id, status: "draft", validation: publicationErrors(input) };
}

export async function editDraft(id: string, input: EntryInput, actor: string) {
  validateStoredInput(input);
  const db = getDb();
  const original = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  if (!original[0] || original[0].status !== "draft") throw Error("Само чернови могат да се редактират.");
  if (!input.payload || !["prediction", "result"].includes(input.kind)) throw Error("Невалиден формат.");
  await db.update(entries).set({
    kind: input.kind, title: input.title.trim().slice(0, 180),
    payload: JSON.stringify(input.payload),
    referenceId: input.kind === "result" ? (input.payload as ResultPayload).predictionId : null,
    updatedAt: new Date().toISOString(), revision: original[0].revision + 1,
  }).where(and(eq(entries.id, id), eq(entries.status, "draft")));
  await recordAudit(id, actor, "draft_edited");
  return { id, validation: publicationErrors(input) };
}

export async function decideDraft(id: string, action: "publish" | "reject", actor: string, ownerConfirmsFixtures = false, manualApproval = false) {
  const db = getDb();
  const rows = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  const row = rows[0];
  if (row?.status === "published" && action === "publish") return { id, status: "published" };
  if (!row || row.status !== "draft") throw Error("Черновата не е налична или вече е обработена.");
  const input = { kind: row.kind, title: row.title, payload: JSON.parse(row.payload) } as EntryInput;
  if (action === "publish") {
    const canManualApprove = manualApproval === true;
    validateStoredInput(input);
    const canConfirmFixtures = !canManualApprove && ownerConfirmsFixtures === true && input.kind === "prediction" && (input.payload as PredictionPayload).category === "elite";
    const errors = canManualApprove ? [] : publicationErrors(input, canConfirmFixtures);
    if (row.kind === "result") {
      const ref = await db.select().from(entries).where(and(eq(entries.id, row.referenceId || ""), eq(entries.kind, "prediction"), eq(entries.status, "published"))).limit(1);
      if (!ref[0]) errors.push("Резултатът трябва да е свързан с публикувана прогноза.");
      else if (!canManualApprove && Date.parse((input.payload as ResultPayload).checkedAt) < Math.max(...(JSON.parse(ref[0].payload) as PredictionPayload).selections.map(s=>Date.parse(s.kickoff)))) {
        errors.push("Резултатът е проверен преди началото на един от мачовете.");
      }
      if (ref[0] && !canManualApprove) {
        const parent = JSON.parse(ref[0].payload) as PredictionPayload;
        const result = input.payload as ResultPayload;
        if (parent.category === "elite" && ["WIN", "LOSS"].includes(result.outcome)) {
          const corners = result.cornerResults;
          if (corners == null || (Array.isArray(corners) && corners.length === 0)) {
            delete result.cornerResults;
            result.cornerVerificationMethod = "owner_confirmation";
          } else if (!Array.isArray(corners) || corners.length !== parent.selections.length || corners.some(c => !c || !Number.isInteger(c.home) || !Number.isInteger(c.away) || c.home < 0 || c.away < 0)) {
            errors.push("Поправи въведените корнери 1П или остави полето празно за лично потвърждение.");
          } else {
            result.cornerVerificationMethod = "recorded_counts";
            if (result.outcome !== (corners.every(c => c.home > c.away) ? "WIN" : "LOSS")) errors.push("Неправилен CORNER HUNTER резултат: равенство или по-малко корнери на домакина е LOSS.");
          }
        }
      }
      const previous = await db.select().from(entries).where(and(eq(entries.referenceId, row.referenceId || ""), eq(entries.kind, "result"), eq(entries.status, "published")));
      if (previous.length) errors.push("За тази прогноза вече има публикуван резултат.");
    }
    if (errors.length) throw Error(errors.join(" "));
    if (canManualApprove && input.kind === "prediction") {
      (input.payload as PredictionPayload).approvalMode = "owner_unverified";
    }
    if (canManualApprove && input.kind === "result") {
      const result = input.payload as ResultPayload;
      if (!["WIN", "LOSS", "VOID", "UNVERIFIED"].includes(result.outcome)) throw Error("Избери WIN, LOSS, VOID или UNVERIFIED.");
      result.approvalMode = "owner_confirmation";
    }
    if (canConfirmFixtures) {
      const checkedAt = new Date().toISOString();
      (input.payload as PredictionPayload).selections = (input.payload as PredictionPayload).selections.map(s => ({...s, fixtureVerified:true, fixtureCheckedAt:checkedAt, fixtureVerificationMethod:"owner_confirmation"}));
    }
  }
  const now = new Date().toISOString();
  const changed = await db.update(entries).set({
    status: action === "publish" ? "published" : "rejected",
    ...(action === "publish" && (input.kind === "result" || manualApproval === true && input.kind === "prediction" || ownerConfirmsFixtures === true && input.kind === "prediction" && (input.payload as PredictionPayload).category === "elite") ? {payload:JSON.stringify(input.payload)} : {}),
    approvedBy: actor, publishedAt: action === "publish" ? now : null,
    updatedAt: now, revision: row.revision + 1,
  }).where(and(eq(entries.id, id), eq(entries.status, "draft"))).returning({ id: entries.id });
  if (!changed.length) throw Error("Черновата е променена; обнови екрана.");
  await recordAudit(id, actor, action === "publish" ? (manualApproval === true && input.kind === "result" ? "result_confirmed_by_owner" : input.kind === "result" && (input.payload as ResultPayload).cornerVerificationMethod === "owner_confirmation" ? "result_confirmed_by_owner_without_corner_counts" : manualApproval === true && input.kind === "prediction" ? "published_by_owner_unverified" : ownerConfirmsFixtures === true && input.kind === "prediction" && (input.payload as PredictionPayload).category === "elite" ? "published_by_owner_with_fixture_confirmation" : "published_by_owner") : "rejected_by_owner");
  return { id, status: action === "publish" ? "published" : "rejected" };
}

export async function publicReport() {
  const rows = await readEntries("published");
  const predictions = rows.filter((r) => r.kind === "prediction");
  const results = rows.filter((r) => r.kind === "result");
  const seen=new Set<string>();
  const completed = results.filter((r) => {const result=r.payload as ResultPayload; if(seen.has(result.predictionId) || !predictions.some(p=>p.id===result.predictionId) || !["WIN","LOSS","VOID"].includes(result.outcome))return false;seen.add(result.predictionId);return true;});
  const wins = completed.filter((r) => (r.payload as ResultPayload).outcome === "WIN").length;
  const losses = completed.filter((r) => (r.payload as ResultPayload).outcome === "LOSS").length;
  const voids = completed.filter((r) => (r.payload as ResultPayload).outcome === "VOID").length;
  const net = completed.reduce((sum, r) => {
    const result = r.payload as ResultPayload;
    const parent = predictions.find((p) => p.id === result.predictionId);
    if (!parent) return sum;
    return sum + (result.outcome === "WIN" ? combinedOdds(parent.payload as PredictionPayload) - 1 : result.outcome === "LOSS" ? -1 : 0);
  }, 0);
  const settled = wins + losses;
  return {
    predictions: predictions.map(({id,kind,status,title,payload,createdAt,publishedAt})=>({id,kind,status,title,createdAt,publishedAt,payload:{...payload,selections:(payload as PredictionPayload).selections.map(({slipImage,...selection})=>selection)}})),
    results: results.map(({id,kind,status,title,payload,createdAt,publishedAt})=>({id,kind,status,title,payload,createdAt,publishedAt})), today:sofiaDay(),
    metrics: { wins, losses, voids, verified: completed.length, winRate: settled ? +(100 * wins / settled).toFixed(1) : null, roi: completed.length ? +(100 * net / completed.length).toFixed(1) : null, virtualStake: 1 },
  };
}

async function recordAudit(entryId: string, actor: string, action: string) {
  await getDb().insert(auditEvents).values({ id: crypto.randomUUID(), entryId, actor, action, at: new Date().toISOString() });
}
