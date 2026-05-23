import { NextRequest, NextResponse } from "next/server";
import { runTutorAgent } from "@/lib/tutorAgent";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const result = await runTutorAgent(payload);

  return NextResponse.json(result);
}
