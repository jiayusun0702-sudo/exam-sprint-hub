# Exam Sprint Hub · 考前冲刺复习站

Students upload their own course materials (lecture slides, syllabus, practice cases) and get a bilingual (EN ⇄ 中文) single-file review website: exam overview with countdown, a day-by-day plan, flip cards, a quiz with explanations, and a case coach.

## How it works

1. **In the browser**: PDF/DOCX/TXT files are read with pdf.js / mammoth. Only the extracted text is sent to the server.
2. **Generation** (`app/api/gen/*`): one Claude call per step, each returning JSON in a fixed schema (`lib/schemas.ts`): syllabus → exam facts; each lecture → cards + formulas, and separately → quiz; each case → five-step breakdown. Steps run in parallel from the browser (`lib/pipeline.ts`).
3. **Automatic checks** (`lib/verify.ts`), in place of a human reviewer:
   - every exam date, weight and rubric item must carry a quote that is actually found in the syllabus, otherwise it is dropped;
   - every calculation question is recomputed from its arithmetic expression; if the keyed answer does not match (or two options match), the question is dropped;
   - every question needs exactly four distinct options in both languages.
4. **Daily plan** (`lib/plan.ts`) is computed in code from the exam date and the amount of content — no model call.
5. **Rendering** (`lib/site.ts`): the data is injected into `public/site-template.html` (the generic version of the original MA6084 site). The result is one self-contained HTML file that works offline; progress is saved in `localStorage`.
6. **Share links** (`/api/publish`, `/s/<id>`): the server re-renders the site from the content (it never accepts raw HTML), stores it in Vercel Blob and serves it with a strict CSP and `noindex`.

## Free-tier guard rails (`lib/limits.ts`)

- Each course build needs a signed session from `/api/start`, which enforces a site-wide **daily spend cap** (`DAILY_BUDGET_USD`) and **courses per IP per day** (`FREE_COURSES_PER_IP_PER_DAY`).
- Each session allows at most 50 model calls; the UI also caps a course at 12 lectures, 4 cases and 600k characters.
- Spend is estimated from token usage and the prices in `.env`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY and SESSION_SECRET
npm run dev
```

Without Upstash the counters are in memory (fine locally, not on Vercel). Without Blob the "share link" button is hidden.

Generate from a local folder without the web UI, with per-step token and cost output:

```bash
ANTHROPIC_API_KEY=... npm run pipeline -- ./samples/MA6084
```

Files are classified by name (`outline`/`syllabus`/`大纲` → syllabus, `answer`/`solution`/`答案` → model answer, `case`/`案例` → case, everything else → lecture). Keep real course materials in `samples/` — it is git-ignored, because this repository is public.

## Checks

```bash
npm test              # verify / plan / render unit tests
npm run typecheck
npx tsx scripts/render-demo.ts && node scripts/browser-check.cjs out/demo.html   # desktop + phone walk-through, fails on console errors
```

## Deploy (Vercel)

1. Import the repo in Vercel.
2. Add a Blob store and an Upstash Redis database from the Vercel Marketplace (both have free tiers); they set `BLOB_READ_WRITE_TOKEN` and `UPSTASH_REDIS_REST_*`.
3. Set `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `DAILY_BUDGET_USD`.
4. Generation routes use `maxDuration = 300`; each call is one lecture-part, which normally finishes well within that.
