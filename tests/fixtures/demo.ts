import type { SiteInput } from "../../lib/site";

// A small fictional course used for tests and the demo page. Not real course material.
export const demoInput: SiteInput = {
  overview: {
    course_code: "DEMO101",
    course_title_en: "Project Cost Basics",
    course_title_zh: "项目成本基础",
    hero_tagline_en: "Two lectures on cost estimating and earned value, with a practice case.",
    hero_tagline_zh: "两讲成本估算与挣值管理，附一个练习案例。",
    exam_events: [
      {
        label_en: "MCQ Quiz",
        label_zh: "选择题测验",
        when_iso: "2027-01-12T19:00:00+08:00",
        details_en: "20 questions, 30 minutes, closed book.",
        details_zh: "20 题，30 分钟，闭卷。",
        source_quote: "The MCQ quiz has 20 questions and lasts 30 minutes.",
      },
    ],
    case_rubric: [
      { label_en: "Analysis", label_zh: "分析", weight_percent: 30, source_quote: "Analysis 30%" },
      { label_en: "Concepts", label_zh: "概念", weight_percent: 25, source_quote: "Concepts 25%" },
      { label_en: "Recommendations", label_zh: "建议", weight_percent: 30, source_quote: "Recommendations 30%" },
      { label_en: "Communication", label_zh: "表达", weight_percent: 15, source_quote: "Communication 15%" },
    ],
    strategy_en: "Practise the EVM formulas until you can do them without notes.",
    strategy_zh: "把挣值公式练到不看笔记也能算。",
  },
  lectures: [
    {
      cards: {
        title_en: "Cost Estimating",
        title_zh: "成本估算",
        short_en: "L1 · Estimating",
        short_zh: "第1讲 · 估算",
        cards: [
          { t_en: "Three-point estimate", t_zh: "三点估算", d_en: "Weighted average of optimistic, most likely and pessimistic estimates.", d_zh: "乐观、最可能、悲观三个估计的加权平均。", f: "E = (O + 4M + P) / 6", b_en: "Use when uncertainty is high. Trap: the weight 4 goes on M, not P.", b_zh: "不确定性高时使用。陷阱：权重 4 在 M 上，不在 P 上。" },
          { t_en: "Contingency reserve", t_zh: "应急储备", d_en: "Budget for identified risks.", d_zh: "为已识别风险准备的预算。", f: "", b_en: "Part of the cost baseline. Trap: management reserve is not.", b_zh: "属于成本基准。陷阱：管理储备不属于。" },
        ],
        formulas: [{ f: "E = (O + 4M + P) / 6", s_en: "O optimistic, M most likely, P pessimistic.", s_zh: "O 乐观，M 最可能，P 悲观。" }],
      },
      questions: [
        { type: "Calculation", q_en: "O = 4, M = 6, P = 14 days. What is the three-point estimate?", q_zh: "O = 4、M = 6、P = 14 天，三点估算是多少？", opts_en: ["6 days", "7 days", "8 days", "8.5 days"], opts_zh: ["6 天", "7 天", "8 天", "8.5 天"], ans: 1, explain_en: "(4 + 4×6 + 14) / 6 = 42 / 6 = 7.", explain_zh: "(4 + 4×6 + 14) / 6 = 42 / 6 = 7。", calc_expression: "(4 + 4*6 + 14) / 6", option_values: [6, 7, 8, 8.5] },
        { type: "Concept", q_en: "Which reserve is part of the cost baseline?", q_zh: "哪种储备属于成本基准？", opts_en: ["Management reserve", "Contingency reserve", "Both", "Neither"], opts_zh: ["管理储备", "应急储备", "两者都是", "都不是"], ans: 1, explain_en: "Contingency reserve covers known risks and sits in the baseline.", explain_zh: "应急储备覆盖已知风险，在基准内。", calc_expression: "", option_values: [] },
      ],
    },
    {
      cards: {
        title_en: "Earned Value",
        title_zh: "挣值管理",
        short_en: "L2 · EVM",
        short_zh: "第2讲 · 挣值",
        cards: [{ t_en: "CPI", t_zh: "成本绩效指数", d_en: "Cost efficiency of work done.", d_zh: "已完成工作的成本效率。", f: "CPI = EV / AC", b_en: "Below 1 means over budget.", b_zh: "小于 1 表示超支。" }],
        formulas: [{ f: "CPI = EV / AC", s_en: "EV earned value, AC actual cost.", s_zh: "EV 挣值，AC 实际成本。" }],
      },
      questions: [
        { type: "Calculation", q_en: "EV = 80, AC = 100. CPI?", q_zh: "EV = 80，AC = 100，CPI 是多少？", opts_en: ["0.8", "1.25", "20", "-20"], opts_zh: ["0.8", "1.25", "20", "-20"], ans: 0, explain_en: "80 / 100 = 0.8.", explain_zh: "80 / 100 = 0.8。", calc_expression: "80/100", option_values: [0.8, 1.25, 20, -20] },
      ],
    },
  ],
  cases: [
    {
      title_en: "Practice Case: Over-budget Office Fit-out <script>alert(1)</script>",
      title_zh: "练习案例：超支的办公室装修",
      scenario_en: ["Budget S$200k; after 50% of work, S$140k spent."],
      scenario_zh: ["预算 20 万新元；完成 50% 时已花 14 万。"],
      analysis_en: ["CPI = 100/140 ≈ 0.71: the project is over budget because of scope creep."],
      analysis_zh: ["CPI = 100/140 ≈ 0.71：范围蔓延导致超支。"],
      concepts_en: ["Earned value, change control."],
      concepts_zh: ["挣值、变更控制。"],
      recs_en: ["Freeze scope through a change control board."],
      recs_zh: ["通过变更控制委员会冻结范围。"],
      rb: { a_en: "Root cause, not symptoms", a_zh: "找根因而非症状", b_en: "Correct CPI", b_zh: "正确算出 CPI", c_en: "Feasible actions", c_zh: "可行措施", d_en: "Clear headings", d_zh: "标题清晰" },
    },
  ],
  examIso: "2027-01-12T19:00:00+08:00",
  planStartIso: "2027-01-05T10:00:00+08:00",
  defaultLang: "en",
  courseLabel: "DEMO101",
};
