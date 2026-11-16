import { NextResponse } from "next/server";
import { OverviewOut, OverviewReq } from "@/lib/schemas";
import { overviewPrompt } from "@/lib/prompts";
import { verifyOverview } from "@/lib/verify";
import { errorResponse, guardedGenerate } from "@/lib/route";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = OverviewReq.parse(await req.json());
    const { data, usage } = await guardedGenerate(body.token, OverviewOut, overviewPrompt(body.syllabus.text, body.lectureNames));
    const { overview, dropped } = verifyOverview(data, body.syllabus.text);
    return NextResponse.json({ overview, dropped, usage });
  } catch (err) {
    return errorResponse(err);
  }
}
