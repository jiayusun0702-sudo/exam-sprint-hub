"use client";

import { useEffect, useMemo, useState } from "react";
import { extractFile, guessRole, naturalSort, type Role } from "@/lib/extract";
import { runPipeline, type Materials, type StepStatus } from "@/lib/pipeline";
import { renderSite, type SiteInput } from "@/lib/site";
import { MAX_DOC_CHARS } from "@/lib/schemas";

type FileRow = { id: string; name: string; text: string; pages: number; role: Role; error?: string };

const MAX_LECTURES = 12;
const MAX_CASES = 4;
const MAX_TOTAL_CHARS = 600_000;

const ROLE_LABEL: Record<Role, string> = {
  syllabus: "课程大纲 Syllabus",
  lecture: "课件 Lecture",
  case: "练习案例 Case",
  answer: "案例参考答案 Model answer",
  skip: "不使用 Skip",
};

export default function Home() {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [reading, setReading] = useState(0);
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [examDate, setExamDate] = useState("");
  const [agree, setAgree] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ html: string; input: SiteInput; dropped: string[]; failed: string[]; token: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setSharing(Boolean(c.sharing)))
      .catch(() => {});
  }, []);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    setReading((n) => n + files.length);
    for (const f of files) {
      const id = `${f.name}-${f.size}-${f.lastModified}`;
      try {
        const ex = await extractFile(f);
        const error = !ex.text.trim()
          ? "没读到文字（可能是扫描件）No text found — scanned PDF?"
          : ex.text.length > MAX_DOC_CHARS
            ? `文件太长，请拆分 Too long (${Math.round(ex.text.length / 1000)}k chars, max ${MAX_DOC_CHARS / 1000}k) — please split it`
            : undefined;
        setRows((r) => [...r.filter((x) => x.id !== id), { id, name: f.name, text: ex.text, pages: ex.pages, role: error ? "skip" : guessRole(f.name), error }]);
      } catch (e: any) {
        setRows((r) => [...r.filter((x) => x.id !== id), { id, name: f.name, text: "", pages: 0, role: "skip", error: e?.message || "读取失败 Could not read" }]);
      } finally {
        setReading((n) => n - 1);
      }
    }
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => naturalSort(a.name, b.name)), [rows]);
  const materials: Materials = useMemo(() => {
    const use = (role: Role) => sorted.filter((r) => r.role === role && !r.error).map((r) => ({ name: r.name, text: r.text }));
    const answers = use("answer");
    return {
      syllabus: use("syllabus")[0] ?? null,
      lectures: use("lecture"),
      cases: use("case").map((c, i) => ({ caseDoc: c, modelAnswer: answers[i] })),
    };
  }, [sorted]);

  const totalChars = rows.filter((r) => r.role !== "skip").reduce((a, r) => a + r.text.length, 0);
  const problems = [
    !materials.lectures.length && "至少需要 1 份课件 · Add at least one lecture",
    materials.lectures.length > MAX_LECTURES && `免费版最多 ${MAX_LECTURES} 讲 · Max ${MAX_LECTURES} lectures`,
    materials.cases.length > MAX_CASES && `免费版最多 ${MAX_CASES} 个案例 · Max ${MAX_CASES} cases`,
    totalChars > MAX_TOTAL_CHARS && "材料总量超出免费版上限 · Too much material for the free version",
    sorted.filter((r) => r.role === "syllabus").length > 1 && "只能选 1 份大纲 · Choose only one syllabus",
  ].filter(Boolean) as string[];

  async function generate() {
    setError("");
    setResult(null);
    setShareUrl("");
    setRunning(true);
    try {
      const start = await fetch("/api/start", { method: "POST" });
      const sj = await start.json();
      if (!start.ok) throw new Error(sj.error || "无法开始 Could not start");
      const token: string = sj.token;
      const call = async (kind: string, body: Record<string, unknown>) => {
        const r = await fetch(`/api/gen/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, token }),
        });
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { retryable: r.status >= 500 && j.retryable !== false });
        return j;
      };
      const courseLabel = (materials.syllabus?.name || materials.lectures[0]?.name || "Course").replace(/\.[a-z]+$/i, "").slice(0, 40);
      const res = await runPipeline({
        materials,
        call,
        onStatus: setSteps,
        examIsoOverride: examDate ? new Date(examDate).toISOString() : null,
        defaultLang: lang,
        courseLabel,
      });
      if (!res.input.lectures.length) throw new Error("所有课件都生成失败了，请稍后重试。All lectures failed — please retry later.");
      const template = await (await fetch("/site-template.html")).text();
      setResult({ html: renderSite(template, res.input), input: res.input, dropped: res.dropped, failed: res.failed, token });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  function preview() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
  }
  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([result.html], { type: "text/html" }));
    a.download = `${(result.input.overview?.course_code || result.input.courseLabel || "review").replace(/[^\w-]+/g, "_")}-review.html`;
    a.click();
  }
  async function share() {
    if (!result) return;
    setShareBusy(true);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-job-token": result.token },
        body: JSON.stringify(result.input),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setShareUrl(j.url);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setShareBusy(false);
    }
  }

  const stats = result && {
    lectures: result.input.lectures.length,
    cards: result.input.lectures.reduce((a, l) => a + l.cards.cards.length, 0),
    questions: result.input.lectures.reduce((a, l) => a + l.questions.length, 0),
    cases: result.input.cases.length,
  };

  return (
    <main className="wrap">
      <header className="hero">
        <div className="kicker">Exam Sprint Hub · 免费公测版</div>
        <h1>考前冲刺复习站</h1>
        <p>
          放入课件和课程大纲，几分钟后得到一个双语复习网站：考试纵览与倒计时、每日计划、可翻转概念卡、带解析的自测题，有案例材料时还有案例教练。
        </p>
      </header>

      <section className="card">
        <h2>1 · 放入材料</h2>
        <p className="muted">支持 PDF、DOCX、TXT。文件在你的浏览器里读取，只把文字发给生成服务。至少需要 1 份课件；有大纲才能生成考试安排。</p>
        <label className="drop">
          <input type="file" multiple accept=".pdf,.docx,.txt,.md" onChange={(e) => addFiles(e.target.files)} disabled={running} />
          <span>点击选择文件，或拖到这里 · Choose or drop files</span>
        </label>
        {reading > 0 && <p className="muted">正在读取 {reading} 个文件…</p>}
        {sorted.length > 0 && (
          <table className="files">
            <thead>
              <tr>
                <th>文件</th>
                <th>用途</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <div className="muted small">{r.error ? <span className="bad">{r.error}</span> : `${r.pages ? `${r.pages} 页 · ` : ""}${Math.round(r.text.length / 1000)}k 字符`}</div>
                  </td>
                  <td>
                    <select value={r.role} disabled={!!r.error || running} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, role: e.target.value as Role } : x)))}>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((k) => (
                        <option key={k} value={k}>
                          {ROLE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {materials.cases.length > 0 && <p className="muted small">案例与参考答案按文件名顺序一一配对。</p>}
      </section>

      <section className="card">
        <h2>2 · 设置</h2>
        <div className="row">
          <label>
            网站默认语言
            <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "zh")} disabled={running}>
              <option value="en">English（考试语言，可切中文）</option>
              <option value="zh">中文（可切英文）</option>
            </select>
          </label>
          <label>
            考试时间（可选，大纲里没有时填写）
            <input type="datetime-local" value={examDate} onChange={(e) => setExamDate(e.target.value)} disabled={running} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={running} />
          我确认这些材料是我合法获得的课程材料，生成的网站仅用于个人复习。内容由 AI 生成，可能有误，以官方课程材料为准。
        </label>
      </section>

      <section className="card">
        <h2>3 · 生成</h2>
        {problems.length > 0 && (
          <ul className="bad">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <button className="primary" disabled={running || reading > 0 || problems.length > 0 || !agree} onClick={generate}>
          {running ? "生成中，请勿关闭页面…" : "生成复习网站"}
        </button>
        <p className="muted small">免费版每人每天 1 门课。一般需要 3–8 分钟。</p>
        {steps.length > 0 && (
          <ul className="steps">
            {steps.map((s) => (
              <li key={s.id} className={s.state}>
                <span className="dot" />
                {s.label}
                {s.note && <span className="muted small"> — {s.note}</span>}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="bad">{error}</p>}
      </section>

      {result && stats && (
        <section className="card done">
          <h2>完成 ✓</h2>
          <p>
            {stats.lectures} 讲 · {stats.cards} 张概念卡 · {stats.questions} 道自测题{stats.cases ? ` · ${stats.cases} 个案例` : ""}
          </p>
          <div className="actions">
            <button className="primary" onClick={preview}>
              打开预览
            </button>
            <button onClick={download}>下载 HTML（可离线用）</button>
            {sharing && (
              <button onClick={share} disabled={shareBusy || !!shareUrl}>
                {shareBusy ? "生成链接中…" : "生成分享链接"}
              </button>
            )}
          </div>
          {shareUrl && (
            <p>
              分享链接：<a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
              <br />
              <span className="muted small">知道链接的人都能打开，请只在班级内分享。</span>
            </p>
          )}
          {result.failed.length > 0 && (
            <details open>
              <summary className="bad">有 {result.failed.length} 个部分没生成成功</summary>
              <ul className="small">
                {result.failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          )}
          {result.dropped.length > 0 && (
            <details>
              <summary>自动质检剔除了 {result.dropped.length} 项（答案复算不一致或在大纲里找不到原文）</summary>
              <ul className="small">
                {result.dropped.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <footer className="muted small">内容由 AI 根据你上传的材料生成，可能有误，一切以官方课程材料和老师说明为准。</footer>
    </main>
  );
}
