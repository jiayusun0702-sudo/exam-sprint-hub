import { test } from "node:test";
import assert from "node:assert/strict";
import { checkQuestion, evalArithmetic, quoteInSource, verifyOverview } from "../lib/verify";
import { demoInput } from "./fixtures/demo";

test("evalArithmetic handles precedence, powers, sqrt and percent", () => {
  assert.equal(evalArithmetic("(4 + 4*6 + 14) / 6"), 7);
  assert.equal(evalArithmetic("2^3^2"), 512);
  assert.equal(evalArithmetic("-3 + sqrt(16)"), 1);
  assert.equal(evalArithmetic("200 × 15%"), 30);
  assert.equal(evalArithmetic("1,000 / 4"), 250);
});

test("evalArithmetic rejects anything that is not arithmetic", () => {
  for (const bad of ["alert(1)", "2 +", "process.exit()", "1/0", "x*2"]) assert.throws(() => evalArithmetic(bad), bad);
});

test("calculation questions are kept only when the keyed answer recomputes", () => {
  const good = demoInput.lectures[0].questions[0];
  assert.equal(checkQuestion(good), null);
  assert.match(checkQuestion({ ...good, ans: 2 })!, /does not match/);
  assert.match(checkQuestion({ ...good, option_values: [7, 7, 8, 8.5] })!, /more than one/);
  assert.match(checkQuestion({ ...good, calc_expression: "" })!, /checkable/);
  assert.match(checkQuestion({ ...good, opts_zh: ["a", "b", "c"] })!, /4 options/);
});

test("exam facts survive only when their quote is in the syllabus", () => {
  const syllabus = "Assessment. The MCQ quiz has 20 questions and lasts 30 minutes.\nMarking: Analysis 30%, Concepts 25%, Recommendations 30%, Communication 15%.";
  assert.ok(quoteInSource("the MCQ quiz has 20 questions and lasts 30 minutes", syllabus));
  assert.ok(!quoteInSource("The MCQ quiz has 25 questions", syllabus));
  const { overview, dropped } = verifyOverview(demoInput.overview!, syllabus);
  assert.equal(overview.exam_events.length, 1);
  assert.equal(overview.case_rubric.length, 4);
  assert.deepEqual(dropped, []);
  const forged = { ...demoInput.overview!, exam_events: [{ ...demoInput.overview!.exam_events[0], source_quote: "Final exam on 1 Feb worth 60%" }] };
  const r2 = verifyOverview(forged, syllabus);
  assert.equal(r2.overview.exam_events.length, 0);
  assert.equal(r2.dropped.length, 1);
});
