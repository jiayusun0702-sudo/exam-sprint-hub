import { NextResponse } from "next/server";
import { LectureCardsOut, LectureReq, QuizOut } from "@/lib/schemas";
import { lectureCardsPrompt, lectureQuizPrompt } from "@/lib/prompts";
import { verifyQuiz } from "@/lib/verify";
import { errorResponse, guardedGenerate } from "@/lib/route";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = LectureReq.parse(await req.json());
    if (body.part === "cards") {
      const { data, usage } = await guardedGenerate(body.token, LectureCardsOut, lectureCardsPrompt(body.index, body.courseTitle, body.lecture.text));
      return NextResponse.json({ cards: data, usage });
    }
    const { data, usage } = await guardedGenerate(body.token, QuizOut, lectureQuizPrompt(body.index, body.courseTitle, body.lecture.text));
    const { kept, dropped } = verifyQuiz(data.questions);
    return NextResponse.json({ questions: kept, dropped, usage });
  } catch (err) {
    return errorResponse(err);
  }
}
