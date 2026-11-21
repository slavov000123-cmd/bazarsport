import { NextRequest, NextResponse } from "next/server";
import { decideDraft, editDraft, type EntryInput } from "@/lib/editorial";
import { ownerFromRequest } from "@/lib/owner";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext) {
  const actor = ownerFromRequest(request);
  if (!actor) return NextResponse.json({ error: "Забранен достъп." }, { status: 403 });
  try {
    const { id } = await context.params;
    const data = await request.json() as EntryInput;
    return NextResponse.json(await editDraft(id, data, actor));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Грешка." }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const actor = ownerFromRequest(request);
  if (!actor) return NextResponse.json({ error: "Забранен достъп." }, { status: 403 });
  try {
    const { id } = await context.params;
    const { action, confirmFixtures } = await request.json() as { action: "publish" | "reject"; confirmFixtures?: boolean };
    if (!["publish", "reject"].includes(action)) throw Error("Непознато действие.");
    return NextResponse.json(await decideDraft(id, action, actor, confirmFixtures === true));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Грешка." }, { status: 400 });
  }
}
