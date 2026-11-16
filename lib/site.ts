import type { CaseOut, LectureCardsOut, OverviewOut, QuizOut } from "./schemas";
import { buildPlan } from "./plan";

/*
 * Turns the verified model outputs into the data object the site template
 * expects, and injects it into the template. Runs in the browser (preview /
 * download) and on the server (shared links), so it must stay dependency-free.
 */

export type SiteInput = {
  overview: OverviewOut | null;
  lectures: { cards: LectureCardsOut; questions: QuizOut["questions"] }[];
  cases: CaseOut[];
  /** ISO date-time of the exam the countdown and plan aim at; null if unknown. */
  examIso: string | null;
  /** When the plan starts (usually "now" in the student's browser). */
  planStartIso: string;
  defaultLang: "en" | "zh";
  courseLabel: string;
};

const GENERIC_RUBRIC = [
  { en: "Analysis", zh: "分析" },
  { en: "Concepts", zh: "概念" },
  { en: "Recommendations", zh: "建议" },
  { en: "Communication", zh: "表达" },
];

export const html = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function rubricLabels(o: OverviewOut | null) {
  if (o && o.case_rubric.length === 4) {
    return o.case_rubric.map((r) => ({ en: `${r.label_en} ${r.weight_percent}%`, zh: `${r.label_zh} ${r.weight_percent}%` }));
  }
  return GENERIC_RUBRIC;
}

function examLabel(iso: string, zh: boolean) {
  if (!iso) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = dateOnly
    ? { month: "short", day: "numeric", weekday: "short" }
    : { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false };
  return d.toLocaleString(zh ? "zh-CN" : "en-US", opts);
}

/** Earliest upcoming exam in the syllabus, if any has a date. */
export function firstExamIso(o: OverviewOut | null, now = new Date()): string | null {
  const times = (o?.exam_events ?? [])
    .map((e) => e.when_iso)
    .filter(Boolean)
    .map((iso) => ({ iso, t: new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T09:00:00` : iso).getTime() }))
    .filter((x) => !Number.isNaN(x.t) && x.t > now.getTime())
    .sort((a, b) => a.t - b.t);
  return times[0]?.iso ?? null;
}

export function buildSiteData(input: SiteInput) {
  const o = input.overview;
  const code = (o?.course_code || input.courseLabel || "Course").trim();
  const titleEn = o?.course_title_en || input.courseLabel || "Exam Sprint";
  const titleZh = o?.course_title_zh || titleEn;

  const TPHASE: Record<string, { en: string; zh: string }> = {};
  const TSHORT: Record<string, string> = {};
  const KNOWLEDGE: Record<string, unknown> = {};
  const FORMULAS: { f_en: string; s_en: string; s_zh: string }[] = [];
  const QUIZ: unknown[] = [];

  input.lectures.forEach((l, i) => {
    const key = `l${i + 1}`;
    TPHASE[key] = { en: html(l.cards.short_en || `L${i + 1}`), zh: html(l.cards.short_zh || `第${i + 1}讲`) };
    TSHORT[key] = `L${i + 1}`;
    KNOWLEDGE[key] = {
      title_en: l.cards.title_en,
      title_zh: l.cards.title_zh,
      cards: l.cards.cards.map((c) => ({ t_en: c.t_en, t_zh: c.t_zh, d_en: c.d_en, d_zh: c.d_zh, f_en: c.f || null, f_zh: c.f || null, b_en: c.b_en, b_zh: c.b_zh })),
    };
    for (const f of l.cards.formulas) FORMULAS.push({ f_en: f.f, s_en: f.s_en, s_zh: f.s_zh });
    l.questions.forEach((q, qi) => {
      QUIZ.push({
        id: `${key}_q${qi + 1}`,
        topic: key,
        n: QUIZ.length + 1,
        type: q.type,
        q_en: q.q_en,
        q_zh: q.q_zh,
        opts_en: q.opts_en,
        opts_zh: q.opts_zh,
        ans: q.ans,
        explain_en: q.explain_en,
        explain_zh: q.explain_zh,
      });
    });
  });

  const CASES = input.cases.map((c, i) => ({ id: `case${i + 1}`, no: i + 1, group: "cases", ...c }));
  const CGROUPS = CASES.length ? { cases: { en: "Practice cases", zh: "练习案例" } } : {};

  const PLAN = buildPlan({
    now: new Date(input.planStartIso),
    examIso: input.examIso,
    lectures: input.lectures.map((l, i) => ({
      key: `l${i + 1}`,
      short_en: l.cards.short_en || `L${i + 1}`,
      short_zh: l.cards.short_zh || `第${i + 1}讲`,
      cards: l.cards.cards.length,
      questions: l.questions.length,
    })),
    cases: input.cases.map((c) => ({ title_en: c.title_en, title_zh: c.title_zh })),
    hasFormulas: FORMULAS.length > 0,
  });

  const rb = rubricLabels(o);
  const glance = (zh: boolean) => {
    const items = (o?.exam_events ?? []).map((e) => {
      const when = examLabel(e.when_iso, zh);
      const label = zh ? e.label_zh : e.label_en;
      const details = zh ? e.details_zh : e.details_en;
      return `${when ? `<b>${html(when)}</b> · ` : ""}<b>${html(label)}</b>: ${html(details)}`;
    });
    if (!items.length) items.push(zh ? "大纲里没有找到考试安排，请以老师通知为准。" : "No exam details were found in the syllabus — check your course announcements.");
    const tip = zh ? o?.strategy_zh : o?.strategy_en;
    if (tip) items.push(html(tip));
    return items;
  };
  const n = input.lectures.length;
  const cardCount = input.lectures.reduce((a, l) => a + l.cards.cards.length, 0);
  const course = (zh: boolean) => ({
    brand: `${html(code)} ${zh ? "冲刺站" : "Sprint Hub"}`,
    heroK: html([code, ...(o?.exam_events ?? []).map((e) => (zh ? e.label_zh : e.label_en))].join(" · ")),
    heroH1: html(`${zh ? titleZh : titleEn} — ${zh ? "考前冲刺" : "Exam Sprint"}`),
    heroP: html(
      (zh ? o?.hero_tagline_zh : o?.hero_tagline_en) ||
        (zh
          ? `${n} 讲、${cardCount} 张概念卡、${QUIZ.length} 道带解析的自测题${CASES.length ? `、${CASES.length} 个案例拆解` : ""}。你的进度保存在本浏览器。`
          : `${n} lectures, ${cardCount} concept cards, ${QUIZ.length} quiz questions with explanations${CASES.length ? `, ${CASES.length} case walk-throughs` : ""}. Your progress is saved in this browser.`),
    ),
    glance: glance(zh),
    planTitle: zh ? `每日计划（${PLAN.length} 天）` : `Daily Plan (${PLAN.length} days)`,
    caseIntroTitle: zh ? "案例分析打法" : "Case study playbook",
    caseIntro: (zh
      ? ["先自己读案例、列提纲，再打开要点逐步对照。", `按四个维度作答：${rb.map((r) => r.zh).join(" / ")}。`]
      : ["Read the case and outline your own answer first, then open the key points and compare step by step.", `Answer under four headings: ${rb.map((r) => r.en).join(" / ")}.`]
    ).map(html),
    tmpl: rb.map((r, i) => [
      html(`${"①②③④"[i]} ${zh ? r.zh : r.en}`),
      html(
        zh
          ? ["一句话点出核心问题和根因，不要照抄题目。", "点名所用课程概念/工具，并结合案例事实或计算。", "2–3 条可执行建议，每条说清为什么和预期效果。", "加粗标题、分点、术语准确、结构清晰。"][i]
          : ["Name the core problem and its root cause in one sentence; do not just restate the scenario.", "Name the course concept or tool and tie it to facts or numbers in the case.", "2–3 actionable recommendations, each with why and the expected effect.", "Bold headings, bullet points, precise terms, clear structure."][i],
      ),
    ]),
    rbA: html(zh ? rb[0].zh : rb[0].en),
    rbB: html(zh ? rb[1].zh : rb[1].en),
    rbC: html(zh ? rb[2].zh : rb[2].en),
    rbD: html(zh ? rb[3].zh : rb[3].en),
  });

  return {
    KEY: `esh_${code.toLowerCase().replace(/[^a-z0-9]/g, "")}_${hash(JSON.stringify(QUIZ)).slice(0, 6)}`,
    TITLE_EN: `${code} · ${titleEn} Review Hub`,
    TITLE_ZH: `${code} · ${titleZh} 复习站`,
    EXAM_ISO: input.examIso,
    DEFAULT_LANG: input.defaultLang,
    I: { en: course(false), zh: course(true) },
    TPHASE,
    TSHORT,
    CGROUPS,
    KNOWLEDGE,
    FORMULAS,
    QUIZ,
    CASES,
    PLAN,
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export const DATA_MARKER = "/*__SITE_DATA__*/null";

/** JSON that is safe to embed inside an inline <script>. */
export function scriptSafeJson(v: unknown) {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

export function renderSite(template: string, input: SiteInput) {
  if (!template.includes(DATA_MARKER)) throw new Error("Template is missing the data marker");
  const data = buildSiteData(input);
  return template.replace(DATA_MARKER, () => scriptSafeJson(data));
}
