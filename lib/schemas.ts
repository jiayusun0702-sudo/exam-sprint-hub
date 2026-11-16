import { z } from "zod";

/*
 * Schemas for what the model returns. They are deliberately flat and simple so
 * they work with structured outputs; extra rules (4 options, answer index in
 * range, calculation re-check, quotes found in the syllabus) are enforced in
 * code by lib/verify.ts.
 */

export const OverviewOut = z.object({
  course_code: z.string().describe("Course code exactly as written in the syllabus, e.g. MA6084. Empty string if not stated."),
  course_title_en: z.string(),
  course_title_zh: z.string(),
  hero_tagline_en: z.string().describe("One sentence: what this review site covers. No numbers that are not in the syllabus."),
  hero_tagline_zh: z.string(),
  exam_events: z
    .array(
      z.object({
        label_en: z.string().describe("Short name, e.g. 'MCQ Quiz (CA2)' or 'Final Exam'"),
        label_zh: z.string(),
        when_iso: z
          .string()
          .describe("Start date-time in ISO 8601 with UTC offset if the syllabus states date AND time, date only (YYYY-MM-DD) if only the date is stated, empty string if not stated."),
        details_en: z.string().describe("Format, length, question count, weight, open/closed book — only what the syllabus states."),
        details_zh: z.string(),
        source_quote: z.string().describe("A verbatim sentence or phrase copied from the syllabus that supports this entry."),
      }),
    )
    .describe("Every assessment the syllabus describes. Never invent one."),
  case_rubric: z
    .array(
      z.object({
        label_en: z.string(),
        label_zh: z.string(),
        weight_percent: z.number(),
        source_quote: z.string(),
      }),
    )
    .describe("Marking criteria for case-study / essay answers if the syllabus gives them, otherwise an empty array."),
  strategy_en: z.string().describe("One practical revision tip grounded in the syllabus."),
  strategy_zh: z.string(),
});
export type OverviewOut = z.infer<typeof OverviewOut>;

export const LectureCardsOut = z.object({
  title_en: z.string().describe("Lecture title in English"),
  title_zh: z.string(),
  short_en: z.string().describe("Very short chip label, e.g. 'L3 · Bidding'"),
  short_zh: z.string(),
  cards: z.array(
    z.object({
      t_en: z.string().describe("Concept name (front of the card)"),
      t_zh: z.string(),
      d_en: z.string().describe("One-sentence definition"),
      d_zh: z.string(),
      f: z.string().describe("Formula if the concept has one, else empty string"),
      b_en: z.string().describe("Back of the card: key points, an example from the slides, and common exam traps"),
      b_zh: z.string(),
    }),
  ),
  formulas: z.array(
    z.object({
      f: z.string().describe("The formula exactly as in the slides"),
      s_en: z.string().describe("What each symbol means and when to use it"),
      s_zh: z.string(),
    }),
  ),
});
export type LectureCardsOut = z.infer<typeof LectureCardsOut>;

export const QuizOut = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["Concept", "Calculation", "Case"]),
      q_en: z.string(),
      q_zh: z.string(),
      opts_en: z.array(z.string()).describe("Exactly 4 options"),
      opts_zh: z.array(z.string()).describe("Exactly 4 options, same order as opts_en"),
      ans: z.number().int().describe("0-based index of the correct option"),
      explain_en: z.string().describe("Why the answer is right, including the working for calculations"),
      explain_zh: z.string(),
      calc_expression: z
        .string()
        .describe("Calculation questions only: one arithmetic expression using only numbers, + - * / ^ ( ) and sqrt(), that evaluates to the correct answer. Empty string for other types."),
      option_values: z
        .array(z.number())
        .describe("Calculation questions only: the numeric value of each of the 4 options, same order. Empty array for other types."),
    }),
  ),
});
export type QuizOut = z.infer<typeof QuizOut>;

export const CaseOut = z.object({
  title_en: z.string(),
  title_zh: z.string(),
  scenario_en: z.array(z.string()).describe("Key facts and figures from the case text, one per bullet"),
  scenario_zh: z.array(z.string()),
  analysis_en: z.array(z.string()).describe("Diagnosis: the root problems, not symptoms"),
  analysis_zh: z.array(z.string()),
  concepts_en: z.array(z.string()).describe("Which course concepts/tools apply and how"),
  concepts_zh: z.array(z.string()),
  recs_en: z.array(z.string()).describe("Actionable recommendations, each with its justification"),
  recs_zh: z.array(z.string()),
  rb: z.object({
    a_en: z.string(),
    a_zh: z.string(),
    b_en: z.string(),
    b_zh: z.string(),
    c_en: z.string(),
    c_zh: z.string(),
    d_en: z.string(),
    d_zh: z.string(),
  }).describe("What a marker looks for under each of the four rubric dimensions given in the prompt"),
});
export type CaseOut = z.infer<typeof CaseOut>;

/* ----- Request bodies sent by the browser ----- */

export const MAX_DOC_CHARS = 120_000;

const Doc = z.object({ name: z.string().max(300), text: z.string().min(1).max(MAX_DOC_CHARS) });

export const OverviewReq = z.object({
  token: z.string(),
  syllabus: Doc,
  lectureNames: z.array(z.string().max(300)).max(20),
});
export const LectureReq = z.object({
  token: z.string(),
  index: z.number().int().min(1).max(20),
  lecture: Doc,
  part: z.enum(["cards", "quiz"]),
  courseTitle: z.string().max(300),
});
export const CaseReq = z.object({
  token: z.string(),
  caseDoc: Doc,
  modelAnswer: Doc.optional(),
  rubricLabels: z.array(z.string().max(200)).length(4),
  courseTitle: z.string().max(300),
});

export const SiteInputSchema = z.object({
  overview: OverviewOut.nullable(),
  lectures: z.array(z.object({ cards: LectureCardsOut, questions: QuizOut.shape.questions })).max(20),
  cases: z.array(CaseOut).max(10),
  examIso: z.string().max(40).nullable(),
  planStartIso: z.string().max(40),
  defaultLang: z.enum(["en", "zh"]),
  courseLabel: z.string().max(200),
});
