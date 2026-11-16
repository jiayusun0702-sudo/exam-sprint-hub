import type { CaseOut, LectureCardsOut, OverviewOut, QuizOut } from "./schemas";
import { firstExamIso, rubricLabels, type SiteInput } from "./site";

/*
 * Orchestrates one course build. The same code drives the browser (calling the
 * API routes) and the command-line test script (calling the model directly),
 * through the `call` function passed in.
 */

export type Doc = { name: string; text: string };
export type Materials = { syllabus: Doc | null; lectures: Doc[]; cases: { caseDoc: Doc; modelAnswer?: Doc }[] };

export type StepKind = "overview" | "lecture" | "case";
export type StepCall = (kind: StepKind, body: Record<string, unknown>) => Promise<any>;
export type StepStatus = { id: string; label: string; state: "pending" | "running" | "done" | "failed"; note?: string };

export type PipelineResult = { input: SiteInput; dropped: string[]; failed: string[] };

async function pool<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

export async function runPipeline(opts: {
  materials: Materials;
  call: StepCall;
  onStatus: (s: StepStatus[]) => void;
  examIsoOverride: string | null;
  defaultLang: "en" | "zh";
  courseLabel: string;
  now?: Date;
  concurrency?: number;
}): Promise<PipelineResult> {
  const { materials: m, call } = opts;
  const status: StepStatus[] = [];
  const add = (id: string, label: string) => status.push({ id, label, state: "pending" });
  const set = (id: string, state: StepStatus["state"], note?: string) => {
    const s = status.find((x) => x.id === id)!;
    s.state = state;
    s.note = note;
    opts.onStatus(status.map((x) => ({ ...x })));
  };
  const dropped: string[] = [];
  const failed: string[] = [];

  // One retry for transient failures (timeouts, cut-off output).
  async function step<T>(id: string, fn: () => Promise<T>): Promise<T | null> {
    set(id, "running");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fn();
        set(id, "done");
        return r;
      } catch (e: any) {
        if (attempt === 0 && e?.retryable !== false) continue;
        set(id, "failed", e?.message || String(e));
        failed.push(`${status.find((x) => x.id === id)!.label}: ${e?.message || e}`);
        return null;
      }
    }
    return null;
  }

  if (m.syllabus) add("overview", "读取大纲：考试安排 / Syllabus");
  m.lectures.forEach((l, i) => {
    add(`cards${i}`, `第 ${i + 1} 讲概念卡 · L${i + 1} cards (${l.name})`);
    add(`quiz${i}`, `第 ${i + 1} 讲自测题 · L${i + 1} quiz`);
  });
  m.cases.forEach((c, i) => add(`case${i}`, `案例 ${i + 1} · Case ${i + 1} (${c.caseDoc.name})`));
  opts.onStatus(status.map((x) => ({ ...x })));

  // 1. Overview first: the case rubric and course title feed the other steps.
  let overview: OverviewOut | null = null;
  if (m.syllabus) {
    const r = await step("overview", () => call("overview", { syllabus: m.syllabus, lectureNames: m.lectures.map((l) => l.name) }));
    if (r) {
      overview = r.overview;
      dropped.push(...(r.dropped as string[]));
    }
  }
  const courseTitle = overview?.course_title_en || opts.courseLabel;
  const rb = rubricLabels(overview).map((r) => r.en);

  // 2. Lectures (cards + quiz) and cases in parallel.
  const cards: (LectureCardsOut | null)[] = new Array(m.lectures.length).fill(null);
  const quizzes: QuizOut["questions"][] = m.lectures.map(() => []);
  const cases: (CaseOut | null)[] = new Array(m.cases.length).fill(null);
  const tasks: (() => Promise<void>)[] = [];
  m.lectures.forEach((lecture, i) => {
    tasks.push(async () => {
      const r = await step(`cards${i}`, () => call("lecture", { index: i + 1, lecture, part: "cards", courseTitle }));
      if (r) cards[i] = r.cards;
    });
    tasks.push(async () => {
      const r = await step(`quiz${i}`, () => call("lecture", { index: i + 1, lecture, part: "quiz", courseTitle }));
      if (r) {
        quizzes[i] = r.questions;
        dropped.push(...(r.dropped as string[]).map((d) => `L${i + 1} quiz ${d}`));
      }
    });
  });
  m.cases.forEach((c, i) => {
    tasks.push(async () => {
      const r = await step(`case${i}`, () => call("case", { caseDoc: c.caseDoc, modelAnswer: c.modelAnswer, rubricLabels: rb, courseTitle }));
      if (r) cases[i] = r.case;
    });
  });
  await pool(tasks, opts.concurrency ?? 4);

  // A lecture without cards is left out; its questions would have no topic chip.
  const lectures = m.lectures.flatMap((_, i) => (cards[i] ? [{ cards: cards[i]!, questions: quizzes[i] }] : []));
  const now = opts.now ?? new Date();
  return {
    input: {
      overview,
      lectures,
      cases: cases.filter((c): c is CaseOut => c !== null),
      examIso: opts.examIsoOverride || firstExamIso(overview, now),
      planStartIso: now.toISOString(),
      defaultLang: opts.defaultLang,
      courseLabel: opts.courseLabel,
    },
    dropped,
    failed,
  };
}
