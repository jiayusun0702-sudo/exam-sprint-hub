/*
 * Build a site from a local folder of course files, calling the model directly
 * (no web server, no free-tier limits). Prints tokens and cost for every step.
 *
 *   ANTHROPIC_API_KEY=... npm run pipeline -- ./samples/MA6084 [--lang zh] [--exam 2026-11-30T13:00+08:00]
 *
 * Files are classified by name the same way as the web UI (syllabus / case / answer / lecture).
 * Output: out/<folder>.html and out/<folder>.json
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generate } from "../lib/claude";
import { guessRole, naturalSort } from "../lib/extract";
import { runPipeline, type Doc, type StepCall } from "../lib/pipeline";
import { casePrompt, lectureCardsPrompt, lectureQuizPrompt, overviewPrompt } from "../lib/prompts";
import { CaseOut, LectureCardsOut, OverviewOut, QuizOut } from "../lib/schemas";
import { renderSite } from "../lib/site";
import { verifyOverview, verifyQuiz } from "../lib/verify";

async function readDoc(file: string): Promise<Doc> {
  const name = path.basename(file);
  const lower = name.toLowerCase();
  const buf = readFileSync(file);
  if (lower.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const c = await (await doc.getPage(p)).getTextContent();
      pages.push(`[Page ${p}]\n` + c.items.map((i: any) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "")).join(""));
    }
    return { name, text: pages.join("\n\n") };
  }
  if (lower.endsWith(".docx")) {
    const mammoth: any = await import("mammoth");
    return { name, text: (await mammoth.extractRawText({ buffer: buf })).value };
  }
  return { name, text: buf.toString("utf8") };
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!dir) throw new Error("usage: npm run pipeline -- <folder> [--lang zh] [--exam ISO]");
  const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);

  const files = readdirSync(dir).filter((f) => /\.(pdf|docx|txt|md)$/i.test(f)).sort(naturalSort);
  const docs = await Promise.all(files.map((f) => readDoc(path.join(dir, f))));
  const by = (role: string) => docs.filter((d) => guessRole(d.name) === role);
  const answers = by("answer");
  const materials = {
    syllabus: by("syllabus")[0] ?? null,
    lectures: by("lecture"),
    cases: by("case").map((c, i) => ({ caseDoc: c, modelAnswer: answers[i] })),
  };
  console.log(`syllabus: ${materials.syllabus?.name ?? "-"}`);
  console.log(`lectures: ${materials.lectures.map((l) => l.name).join(", ")}`);
  console.log(`cases:    ${materials.cases.map((c) => c.caseDoc.name).join(", ") || "-"}\n`);

  let total = 0;
  const log = (label: string, r: { costUsd: number; usage: { input: number; output: number } }) => {
    total += r.costUsd;
    console.log(`  ${label}: in ${r.usage.input} / out ${r.usage.output} tokens, $${r.costUsd.toFixed(3)}`);
  };
  const call: StepCall = async (kind, b: any) => {
    if (kind === "overview") {
      const r = await generate(OverviewOut, overviewPrompt(b.syllabus.text, b.lectureNames));
      log("overview", r);
      return verifyOverview(r.data, b.syllabus.text);
    }
    if (kind === "lecture" && b.part === "cards") {
      const r = await generate(LectureCardsOut, lectureCardsPrompt(b.index, b.courseTitle, b.lecture.text));
      log(`L${b.index} cards`, r);
      return { cards: r.data };
    }
    if (kind === "lecture") {
      const r = await generate(QuizOut, lectureQuizPrompt(b.index, b.courseTitle, b.lecture.text));
      log(`L${b.index} quiz`, r);
      const { kept, dropped } = verifyQuiz(r.data.questions);
      return { questions: kept, dropped };
    }
    const r = await generate(CaseOut, casePrompt(b.courseTitle, b.caseDoc.text, b.modelAnswer?.text, b.rubricLabels));
    log("case", r);
    return { case: r.data };
  };

  const t0 = Date.now();
  const res = await runPipeline({
    materials,
    call,
    onStatus: () => {},
    examIsoOverride: opt("--exam") ?? null,
    defaultLang: (opt("--lang") as "en" | "zh") || "en",
    courseLabel: path.basename(dir),
  });
  const html = renderSite(readFileSync("public/site-template.html", "utf8"), res.input);
  mkdirSync("out", { recursive: true });
  const out = `out/${path.basename(dir)}.html`;
  writeFileSync(out, html);
  writeFileSync(out.replace(/\.html$/, ".json"), JSON.stringify(res, null, 1));
  console.log(`\nwrote ${out} in ${Math.round((Date.now() - t0) / 1000)}s, total cost $${total.toFixed(2)}`);
  if (res.dropped.length) console.log(`dropped by checks:\n  ${res.dropped.join("\n  ")}`);
  if (res.failed.length) console.log(`failed:\n  ${res.failed.join("\n  ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
