import type { OverviewOut, QuizOut } from "./schemas";

/* ---------- 1. Quotes must really be in the syllabus ---------- */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[^\p{L}\p{N}%.:\-/]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the quote (normalised) occurs in the source (normalised). */
export function quoteInSource(quote: string, source: string): boolean {
  const q = normalize(quote);
  if (q.length < 8) return false;
  return normalize(source).includes(q);
}

export function verifyOverview(o: OverviewOut, syllabus: string) {
  const dropped: string[] = [];
  const exam_events = o.exam_events.filter((e) => {
    const ok = quoteInSource(e.source_quote, syllabus);
    if (!ok) dropped.push(`exam event "${e.label_en}" (quote not found in syllabus)`);
    return ok;
  });
  let case_rubric = o.case_rubric.filter((r) => quoteInSource(r.source_quote, syllabus));
  if (case_rubric.length !== o.case_rubric.length) dropped.push("case rubric (quote not found in syllabus)");
  // The site shows exactly four rubric dimensions; anything else falls back to the generic rubric.
  if (case_rubric.length !== 4) case_rubric = [];
  return { overview: { ...o, exam_events, case_rubric }, dropped };
}

/* ---------- 2. Calculation answers are recomputed ---------- */

/** Safe arithmetic evaluator: numbers, + - * / ^, parentheses, sqrt(). No identifiers, no eval(). */
export function evalArithmetic(expr: string): number {
  const src = expr.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, "");
  let i = 0;
  const peek = () => src[i];
  const fail = (msg: string): never => {
    throw new Error(`${msg} at ${i} in "${expr}"`);
  };
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parsePow();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = parsePow();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function parsePow(): number {
    const base = parseUnary();
    if (peek() === "^") {
      i++;
      return Math.pow(base, parsePow());
    }
    return base;
  }
  function parseUnary(): number {
    if (peek() === "-") {
      i++;
      return -parseUnary();
    }
    if (peek() === "+") {
      i++;
      return parseUnary();
    }
    return parseAtom();
  }
  function parseAtom(): number {
    if (src.startsWith("sqrt(", i)) {
      i += 5;
      const v = parseExpr();
      if (peek() !== ")") fail("expected )");
      i++;
      return Math.sqrt(v);
    }
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (peek() !== ")") fail("expected )");
      i++;
      return v;
    }
    const m = /^\d+(\.\d+)?(e[+-]?\d+)?%?/i.exec(src.slice(i));
    if (!m) fail("unexpected token");
    i += m![0].length;
    const n = parseFloat(m![0]);
    return m![0].endsWith("%") ? n / 100 : n;
  }
  const v = parseExpr();
  if (i !== src.length) fail("trailing input");
  if (!Number.isFinite(v)) fail("not a finite number");
  return v;
}

function close(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  return diff <= 0.01 || diff <= Math.abs(b) * 0.01;
}

type Q = QuizOut["questions"][number];

/** Returns null when the question passes, otherwise the reason it was dropped. */
export function checkQuestion(q: Q): string | null {
  if (q.opts_en.length !== 4 || q.opts_zh.length !== 4) return "needs exactly 4 options in both languages";
  if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans > 3) return "answer index out of range";
  if (new Set(q.opts_en.map((o) => normalize(o))).size !== 4) return "duplicate options";
  if (q.type !== "Calculation") return null;
  if (!q.calc_expression || q.option_values.length !== 4) return "calculation without a checkable expression";
  let v: number;
  try {
    v = evalArithmetic(q.calc_expression);
  } catch {
    return "calculation expression could not be evaluated";
  }
  if (!close(v, q.option_values[q.ans])) return `recomputed ${v} does not match the keyed option`;
  const matches = q.option_values.filter((x) => close(v, x)).length;
  if (matches !== 1) return "more than one option matches the recomputed value";
  return null;
}

export function verifyQuiz(questions: Q[]) {
  const kept: Q[] = [];
  const dropped: string[] = [];
  for (const q of questions) {
    const why = checkQuestion(q);
    if (why) dropped.push(`"${q.q_en.slice(0, 60)}…": ${why}`);
    else kept.push(q);
  }
  return { kept, dropped };
}
