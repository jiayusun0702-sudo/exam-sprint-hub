import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, planDates } from "../lib/plan";

const lectures = [1, 2, 3, 4, 5].map((i) => ({ key: `l${i}`, short_en: `L${i}`, short_zh: `第${i}讲`, cards: 10, questions: 7 }));

test("plan covers up to 7 days and ends the day before the exam", () => {
  const now = new Date(2027, 0, 1, 10);
  const dates = planDates(now, new Date(2027, 0, 20, 19).toISOString());
  assert.equal(dates.length, 7);
  assert.equal(dates[6].getDate(), 19);
  assert.equal(planDates(now, new Date(2027, 0, 4, 9).toISOString()).length, 3);
  assert.equal(planDates(now, new Date(2027, 0, 1, 19).toISOString()).length, 1);
  assert.equal(planDates(now, null).length, 7);
});

test("every lecture and case appears exactly once and the last day is review", () => {
  const plan = buildPlan({ now: new Date(2027, 0, 1), examIso: new Date(2027, 0, 20).toISOString(), lectures, cases: [{ title_en: "C1", title_zh: "案1" }, { title_en: "C2", title_zh: "案2" }], hasFormulas: true });
  const all = plan.flatMap((d) => d.checklist_en);
  for (const l of lectures) {
    assert.equal(all.filter((t) => t.startsWith(`${l.short_en}: flip`)).length, 1);
    assert.equal(all.filter((t) => t.startsWith(`${l.short_en}: quiz`)).length, 1);
  }
  assert.equal(all.filter((t) => t.startsWith("Case coach")).length, 2);
  assert.ok(plan[6].checklist_en.includes("Redo every quiz question you got wrong"));
  for (const d of plan) assert.equal(d.checklist_en.length, d.checklist_zh.length);
});

test("one-day plan still includes all lectures", () => {
  const plan = buildPlan({ now: new Date(2027, 0, 1, 8), examIso: new Date(2027, 0, 1, 19).toISOString(), lectures, cases: [], hasFormulas: false });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].checklist_en.filter((t) => t.includes("flip")).length, 5);
});
