/*
 * Prompts for each generation step. The system prompt is shared and stable so
 * it can be cached; the per-request material goes in the user message.
 */

export const SYSTEM = `You turn a university student's own course materials into exam-revision content for a bilingual (English + Simplified Chinese) review website.

Ground rules:
- Use only the materials provided. Do not add facts, numbers, dates, weights or cases that are not in them. If something is not stated, leave the field empty rather than guess.
- English is the exam language and is primary. The Chinese must say the same thing as the English: a faithful translation, not a different explanation. Keep technical terms in English inside the Chinese where students would see them on the exam, e.g. "挣值管理（EVM）".
- Formulas must match the slides exactly, using plain-text notation (e.g. CPI = EV / AC).
- Write for a student revising in the last week before the exam: short, concrete, exam-focused.
- Do not copy long passages verbatim from the slides; summarise in your own words. Past exam papers are only a guide to style and topics; never reproduce their questions.`;

export function overviewPrompt(syllabus: string, lectureNames: string[]) {
  return `Below is the course syllabus / outline. The student also uploaded these lecture files: ${lectureNames.join("; ") || "(none listed)"}.

Extract the assessment information and the marking rubric for case-study answers if there is one. Every exam_event and rubric item must carry a source_quote copied word-for-word from the syllabus (one sentence or phrase); entries without a real quote will be discarded.

<syllabus>
${syllabus}
</syllabus>`;
}

export function lectureCardsPrompt(index: number, courseTitle: string, text: string) {
  return `Course: ${courseTitle || "(unknown)"}. This is lecture ${index}.

Write concept flash cards covering every examinable concept in this lecture (usually 8–15 cards; more for dense lectures). Each card back should give key points, a short example from the lecture where there is one, and a common exam trap. Also list every formula in the lecture in "formulas" (empty array if there are none).

<lecture>
${text}
</lecture>`;
}

export function lectureQuizPrompt(index: number, courseTitle: string, text: string) {
  return `Course: ${courseTitle || "(unknown)"}. This is lecture ${index}.

Write 6–8 multiple-choice questions on this lecture, each with exactly 4 options and one correct answer. Mix the types: "Concept" (definitions, distinctions, true/false style judgements), "Calculation" (only if the lecture has formulas — apply them to small numbers), and "Case" (a short scenario where the student picks the right decision or tool).

For every Calculation question, also give calc_expression (one arithmetic expression with numbers only that evaluates to the correct answer) and option_values (the numeric value of each option). These are re-computed by code and the question is discarded if they disagree, so make sure the keyed option is the computed value and the distractors are clearly different (common mistakes, not rounding variants).

Vary which letter is correct. Explanations must show the reasoning or working.

<lecture>
${text}
</lecture>`;
}

export function casePrompt(courseTitle: string, caseText: string, modelAnswer: string | undefined, rubricLabels: string[]) {
  return `Course: ${courseTitle || "(unknown)"}.

Break this practice case down as a case coach would, for a student who will answer a similar case in the exam. Scenario bullets must only contain facts from the case text.${modelAnswer ? " Use the model answer as the benchmark for the analysis and recommendations." : ""}

For "rb", describe what the marker looks for in THIS case under each rubric dimension, in order:
a) ${rubricLabels[0]}
b) ${rubricLabels[1]}
c) ${rubricLabels[2]}
d) ${rubricLabels[3]}

<case>
${caseText}
</case>${modelAnswer ? `\n\n<model_answer>\n${modelAnswer}\n</model_answer>` : ""}`;
}
