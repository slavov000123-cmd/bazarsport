import { NextRequest, NextResponse } from "next/server";
import { createDraft, publicationErrors, readEntries, type EntryInput, type PredictionPayload } from "@/lib/editorial";
import { ownerFromRequest } from "@/lib/owner";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!ownerFromRequest(request)) return NextResponse.json({ error: "Само собственикът има достъп." }, { status: 403 });
  try {
    const data = await readEntries();
    return NextResponse.json({ entries: data.map(entry => ({
      ...entry, ownerConfirmationValidation: entry.status === "draft" && entry.kind === "prediction" && (entry.payload as PredictionPayload).category === "elite" ? publicationErrors(entry as EntryInput, true) : null, manualApprovalValidation: entry.status === "draft" && entry.kind === "prediction" ? publicationErrors(entry as EntryInput, false, true) : null, validation: entry.status === "draft" ? publicationErrors(entry as EntryInput) : [],
    })) });
  }
  catch { return NextResponse.json({ error: "Грешка при зареждане на черновите." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const actor = ownerFromRequest(request);
  if (!actor) return NextResponse.json({ error: "Само собственикът създава чернови." }, { status: 403 });
  try {
    const input = await request.json() as EntryInput;
    return NextResponse.json(await createDraft(input, actor), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Невалидна чернова." }, { status: 400 });
  }
}
