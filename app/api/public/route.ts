import { NextResponse } from "next/server";
import { publicReport } from "@/lib/editorial";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await publicReport(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Неуспешно зареждане на данни." }, { status: 500 }); }
}
