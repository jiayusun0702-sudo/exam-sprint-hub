/*
 * The daily plan is computed in code, not by the model: it only depends on the
 * exam date and how much content each lecture has, and doing it here makes it
 * free, instant and always consistent with the generated content.
 */

export type PlanLecture = { key: string; short_en: string; short_zh: string; cards: number; questions: number };
export type PlanCase = { title_en: string; title_zh: string };

export type PlanBlock = { tm: string; h: string; c: string; t_en: string; t_zh: string; p_en: string; p_zh: string };
export type PlanDay = {
  d: string;
  date: string;
  hours: string;
  color: string;
  goal_en: string;
  goal_zh: string;
  blocks: PlanBlock[];
  checklist_en: string[];
  checklist_zh: string[];
};

const DAY_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#d97706", "#db2777", "#0d9488", "#dc2626"];
const BLOCK_COLORS = { cards: "#10b981", quiz: "#2563eb", case: "#d97706", review: "#7c3aed" };
const MIN_PER_CARD = 2;
const MIN_PER_QUESTION = 3;
const MIN_PER_CASE = 45;
const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }).replace(",", "");
const fmtHours = (min: number) => `≈${Math.max(0.5, Math.round((min / 60) * 2) / 2)}h`;

/** Which calendar days the plan covers: up to 7 days, ending the day before the exam. */
export function planDates(now: Date, examIso: string | null): Date[] {
  const today = startOfDay(now);
  if (!examIso) return Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY_MS));
  const examDay = startOfDay(new Date(examIso));
  const daysLeft = Math.round((examDay.getTime() - today.getTime()) / DAY_MS);
  if (daysLeft <= 1) return [today];
  const n = Math.min(7, daysLeft);
  const start = examDay.getTime() - n * DAY_MS;
  return Array.from({ length: n }, (_, i) => new Date(start + i * DAY_MS));
}

function chunk<T>(items: T[], parts: number): T[][] {
  const out: T[][] = Array.from({ length: parts }, () => []);
  items.forEach((it, i) => out[Math.floor((i * parts) / items.length)].push(it));
  return out;
}

export function buildPlan(opts: { now: Date; examIso: string | null; lectures: PlanLecture[]; cases: PlanCase[]; hasFormulas: boolean }): PlanDay[] {
  const dates = planDates(opts.now, opts.examIso);
  const n = dates.length;
  // Keep the last day for review when there is room for it.
  const studyDays = n >= 3 ? n - 1 : n;
  const lectureGroups = chunk(opts.lectures, Math.min(studyDays, Math.max(1, opts.lectures.length)));
  const dayBlocks: PlanBlock[][] = dates.map(() => []);
  const dayGoals: { en: string; zh: string }[] = dates.map(() => ({ en: "", zh: "" }));

  // Spread lecture groups over the study days.
  lectureGroups.forEach((group, gi) => {
    const di = Math.floor((gi * studyDays) / lectureGroups.length);
    for (const l of group) {
      dayBlocks[di].push({
        tm: "",
        h: `${l.cards * MIN_PER_CARD} min`,
        c: BLOCK_COLORS.cards,
        t_en: `${l.short_en}: flip all ${l.cards} concept cards`,
        t_zh: `${l.short_zh}：翻完 ${l.cards} 张概念卡`,
        p_en: "Say the answer out loud before flipping; mark the ones you missed.",
        p_zh: "翻面前先说出答案；记下没答上来的卡。",
      });
      if (l.questions) {
        dayBlocks[di].push({
          tm: "",
          h: `${l.questions * MIN_PER_QUESTION} min`,
          c: BLOCK_COLORS.quiz,
          t_en: `${l.short_en}: quiz (${l.questions} questions)`,
          t_zh: `${l.short_zh}：自测（${l.questions} 题）`,
          p_en: "Answer first, then read every explanation, including for the ones you got right.",
          p_zh: "先作答，再看所有解析，答对的也要看。",
        });
      }
    }
    const names = group.map((l) => l.short_en).join(", ");
    const namesZh = group.map((l) => l.short_zh).join("、");
    dayGoals[di] = { en: `Learn and test ${names}.`, zh: `学完并自测 ${namesZh}。` };
  });

  // Cases go on the days after the lectures are covered (the review day included); if there are none, spread over all days.
  const lastLectureDay = Math.max(0, ...dayBlocks.map((b, i) => (b.length ? i : 0)));
  const after = dates.map((_, i) => i).filter((i) => i > lastLectureDay);
  const caseDays = after.length ? after : dates.map((_, i) => i);
  opts.cases.forEach((c, ci) => {
    const di = caseDays[ci % caseDays.length];
    dayBlocks[di].push({
      tm: "",
      h: `${MIN_PER_CASE} min`,
      c: BLOCK_COLORS.case,
      t_en: `Case coach: ${c.title_en}`,
      t_zh: `案例教练：${c.title_zh}`,
      p_en: "Diagnose it yourself first, write a timed answer under the four headings, then compare step by step.",
      p_zh: "先自己诊断，限时按四个标题写答案，再逐步对照要点。",
    });
  });

  // Final day: review.
  const last = n - 1;
  if (n >= 3 || dayBlocks[last].length === 0) {
    dayBlocks[last].push({
      tm: "",
      h: "45 min",
      c: BLOCK_COLORS.review,
      t_en: "Redo every quiz question you got wrong",
      t_zh: "重做所有错题",
      p_en: "Use the topic filter on the Quiz page; read the explanation again for each one.",
      p_zh: "在自测页按讲次筛选，每道错题重看解析。",
    });
    if (opts.hasFormulas) {
      dayBlocks[last].push({
        tm: "",
        h: "20 min",
        c: BLOCK_COLORS.review,
        t_en: "Rewrite the formula sheet from memory",
        t_zh: "默写一页纸公式表",
        p_en: "Check against the formula sheet on the Concepts page.",
        p_zh: "写完对照概念页的公式表。",
      });
    }
    dayGoals[last] = { en: "Final review: close the gaps, no new material.", zh: "考前总复习：补漏洞，不再学新内容。" };
  }

  return dates.map((date, i) => {
    const blocks = dayBlocks[i].map((b, bi) => ({ ...b, tm: `#${bi + 1}` }));
    const minutes = blocks.reduce((a, b) => a + parseInt(b.h, 10), 0);
    if (!dayGoals[i].en) dayGoals[i] = { en: "Catch up and revisit marked cards.", zh: "补进度，复习标记过的卡片。" };
    return {
      d: `Day ${i + 1}`,
      date: fmtDate(date),
      hours: fmtHours(minutes),
      color: DAY_COLORS[i % DAY_COLORS.length],
      goal_en: dayGoals[i].en,
      goal_zh: dayGoals[i].zh,
      blocks,
      checklist_en: blocks.map((b) => b.t_en),
      checklist_zh: blocks.map((b) => b.t_zh),
    };
  });
}
