import { NextResponse } from "next/server";
import { CaseOut, CaseReq } from "@/lib/schemas";
import { casePrompt } from "@/lib/prompts";
import { errorResponse, guardedGenerate } from "@/lib/route";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = CaseReq.parse(await req.json());
    const { data, usage } = await guardedGenerate(
      body.token,
      CaseOut,
      casePrompt(body.courseTitle, body.caseDoc.text, body.modelAnswer?.text, body.rubricLabels),
    );
    return NextResponse.json({ case: data, usage });
  } catch (err) {
    return errorResponse(err);
  }
}
