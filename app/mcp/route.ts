import { NextRequest, NextResponse } from "next/server";
import { createDraft, publicReport, readEntries, type EntryInput, type PredictionPayload, type ResultPayload } from "@/lib/editorial";
import { ownerFromRequest } from "@/lib/owner";

export const dynamic = "force-dynamic";

const tools = [
  {
    name: "create_prediction_draft",
    description: "Save an UNPUBLISHED BAZARSPORT BET STRIKE or CORNER HUNTER prediction draft for Ivaylo to review. Never invent fixtures, odds, sources or kickoff times. CORNER HUNTER accepts oddsSource=owner_slip without odds URLs; fixture existence and correct kickoff require fixtureVerified, fixtureCheckedAt and at least one reliable fixtureSources URL. No historical corner statistics are required to create or approve a prediction. Unknown fields may be empty; incomplete drafts remain unpublished. BET STRIKE requires two independent odds URLs. This tool cannot publish.",
    inputSchema: { type: "object", required: ["title", "category", "analysis", "risk", "selections"], properties: {
      title: { type: "string" }, category: { type: "string", enum: ["quantbet", "elite"], description: "Stable IDs: quantbet = BET STRIKE (2–3 selections, target odds 1.85–2.15); elite = CORNER HUNTER (first-half corners 3-way W1; ties lose)." },
      analysis: { type: "string" }, risk: { type: "string" },
      selections: { type: "array", minItems: 1, maxItems: 3, items: { type: "object", required: ["home","away","league","kickoff","market","choice","odds"], properties: {
        homeLogo: { type: "string", description: "Optional verified club crest HTTPS URL from an official or licensed source; omit when unknown." },
        awayLogo: { type: "string", description: "Optional verified away club crest HTTPS URL; omit when unknown." },
        homeCountry: { type: "string", description: "Country flag code for the home national team or club country: ISO alpha-2 (FR, HR, etc.), GB-ENG, GB-SCT, GB-WLS. Supply for clubs; omit if unknown." },
        awayCountry: { type: "string", description: "Country flag code for the away national team or club country; same format as homeCountry. Supply for clubs; omit if unknown." },
        home: { type: "string" }, away: { type: "string" }, league: { type: "string" }, kickoff: { type: "string", description: "ISO date with timezone" },
        market: { type: "string" }, choice: { type: "string" }, odds: { type: "number" }, oddsCheckedAt: { type: "string", description: "ISO date with timezone" },
        oddsSource: { type: "string", enum: ["independent_urls", "owner_slip"] },
        bookmaker: { type: "string", description: "Bookmaker if known; otherwise omit" },
        oddsReceivedAt: { type: "string", description: "Actual receipt timestamp with timezone; not a market verification" },
        slipImage: { type: "string", description: "Optional HTTPS image URL or image data URL" },
        fixtureVerified: { type: "boolean" }, fixtureCheckedAt: { type: "string" },
        fixtureSources: { type: "array", items: { type: "string" }, description: "At least one reliable fixture and kickoff verification URL, separate from odds; no historical corner statistics required" },
        sources: { type: "array", items: { type: "string" }, description: "Two independent ODDS URLs required for BET STRIKE; optional for CORNER HUNTER owner_slip" },
      } } },
    } },
  },
  {
    name: "create_result_draft",
    description: "Save an UNPUBLISHED verified result proposal for a previously published prediction. Ivaylo must approve it. Require independently checked final score or first-half corner stats, without guessing.",
    inputSchema: { type: "object", required: ["title","predictionId","outcome","checkedAt","sources","description"], properties: {
      title: { type: "string" }, predictionId: { type: "string" },
      outcome: { type: "string", enum: ["WIN","LOSS","VOID","UNVERIFIED"] },
      checkedAt: { type: "string", description: "ISO time with timezone" },
      cornerResults: { type: "array", description: "CORNER HUNTER: verified first-half home/away corner counts in selection order; draw loses", items: { type: "object", required: ["home","away"], properties: { home: { type: "integer", minimum: 0 }, away: { type: "integer", minimum: 0 } } } },
      sources: { type: "array", items: { type: "string" } }, description: { type: "string" },
    } },
  },
  { name: "list_editorial_drafts", description: "List pending BAZARSPORT drafts and their source details for owner review; never publishes anything.", inputSchema: { type: "object", properties: {} } },
  { name: "get_bazarsport_public_report", description: "Get published predictions, published verified results, and virtual WIN/LOSS/ROI statistics.", inputSchema: { type: "object", properties: {} } },
];

function respond(id: unknown, result?: unknown, error?: string) {
  return NextResponse.json(error ? { jsonrpc: "2.0", id, error: { code: -32000, message: error } } : { jsonrpc: "2.0", id, result });
}
function toolText(data: unknown) { return { content: [{ type: "text", text: JSON.stringify(data) }], isError: false }; }

export async function POST(request: NextRequest) {
  let message: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try { message = await request.json(); } catch { return respond(null, undefined, "Невалиден JSON."); }
  const id = message.id ?? null;
  if (message.method === "server/discover") return respond(id, { supportedVersions: ["2026-07-28"], capabilities: { tools: {} } });
  if (message.method === "tools/list") return respond(id, { tools });
  if (message.method !== "tools/call") return respond(id, undefined, "Неподдържан метод.");
  const owner = ownerFromRequest(request);
  if (!owner) return respond(id, undefined, "Само собственикът на BAZARSPORT може да използва редакционните инструменти.");
  const args = message.params?.arguments || {};
  try {
    switch (message.params?.name) {
      case "create_prediction_draft": {
        const input: EntryInput = { kind: "prediction", title: String(args.title || ""), payload: {
          category: args.category, analysis: args.analysis, risk: args.risk, selections: args.selections,
        } as PredictionPayload };
        return respond(id, toolText(await createDraft(input, owner)));
      }
      case "create_result_draft": {
        const input: EntryInput = { kind: "result", title: String(args.title || ""), payload: {
          predictionId: args.predictionId, outcome: args.outcome, checkedAt: args.checkedAt, sources: args.sources, description: args.description, cornerResults: args.cornerResults,
        } as ResultPayload };
        return respond(id, toolText(await createDraft(input, owner)));
      }
      case "list_editorial_drafts": return respond(id, toolText((await readEntries()).filter(r => r.status === "draft")));
      case "get_bazarsport_public_report": return respond(id, toolText(await publicReport()));
      default: return respond(id, undefined, "Непознат инструмент.");
    }
  } catch (e) { return respond(id, { content: [{ type: "text", text: e instanceof Error ? e.message : "Грешка." }], isError: true }); }
}
