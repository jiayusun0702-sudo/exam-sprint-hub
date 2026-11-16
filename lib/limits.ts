import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/*
 * Free-tier guard rails. Generation costs real money, so every course build
 * needs a job token from /api/start, which checks:
 *   - a daily spend cap for the whole site (DAILY_BUDGET_USD)
 *   - a per-IP daily course limit (FREE_COURSES_PER_IP_PER_DAY)
 * and each token allows a bounded number of model calls.
 *
 * Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set
 * (needed on Vercel, where instances don't share memory). Without them an
 * in-memory map is used, which is only suitable for local development.
 */

const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD || 20);
const COURSES_PER_IP = Number(process.env.FREE_COURSES_PER_IP_PER_DAY || 1);
export const MAX_CALLS_PER_JOB = 50;
const JOB_TTL_SEC = 2 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return s || "dev-only-secret";
}

/* ---------- tiny KV ---------- */

const mem = new Map<string, { v: number; exp: number }>();

async function upstash(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}
const useUpstash = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

async function incrBy(key: string, by: number, ttlSec: number): Promise<number> {
  if (useUpstash()) {
    const v = Number(await upstash(["INCRBYFLOAT", key, by]));
    await upstash(["EXPIRE", key, ttlSec, "NX"]);
    return v;
  }
  const now = Date.now();
  const cur = mem.get(key);
  const base = cur && cur.exp > now ? cur.v : 0;
  const v = base + by;
  mem.set(key, { v, exp: cur && cur.exp > now ? cur.exp : now + ttlSec * 1000 });
  return v;
}
async function get(key: string): Promise<number> {
  if (useUpstash()) return Number((await upstash(["GET", key])) ?? 0);
  const cur = mem.get(key);
  return cur && cur.exp > Date.now() ? cur.v : 0;
}

const today = () => new Date().toISOString().slice(0, 10);
const DAY = 26 * 60 * 60;

/* ---------- job tokens ---------- */

type Job = { jid: string; exp: number };

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}
export function issueToken(): string {
  const job: Job = { jid: randomUUID(), exp: Math.floor(Date.now() / 1000) + JOB_TTL_SEC };
  const body = Buffer.from(JSON.stringify(job)).toString("base64url");
  return `${body}.${sign(body)}`;
}
export function readToken(token: string): Job | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const job = JSON.parse(Buffer.from(body, "base64url").toString()) as Job;
  return job.exp > Date.now() / 1000 ? job : null;
}

export class LimitError extends Error {
  constructor(message: string, public status = 429) {
    super(message);
  }
}

/** Called once per course build. */
export async function startJob(ip: string): Promise<string> {
  if ((await get(`spend:${today()}`)) >= DAILY_BUDGET_USD) {
    throw new LimitError("今日免费额度已用完，请明天再来。Today's free capacity is used up — please come back tomorrow.");
  }
  const token = issueToken();
  const n = await incrBy(`ip:${ip}:${today()}`, 1, DAY);
  if (n > COURSES_PER_IP) {
    throw new LimitError(`免费版每天可生成 ${COURSES_PER_IP} 门课。The free version allows ${COURSES_PER_IP} course(s) per day.`);
  }
  return token;
}

/** Called before every model call. */
export async function useCall(token: string): Promise<void> {
  const job = readToken(token);
  if (!job) throw new LimitError("生成会话已过期，请重新开始。Session expired — please start again.", 401);
  if ((await get(`spend:${today()}`)) >= DAILY_BUDGET_USD) {
    throw new LimitError("今日免费额度已用完，请明天再来。Today's free capacity is used up — please come back tomorrow.");
  }
  const n = await incrBy(`job:${job.jid}`, 1, JOB_TTL_SEC);
  if (n > MAX_CALLS_PER_JOB) throw new LimitError("这门课的生成次数已达上限。Too many generation steps for one course.");
}

export async function recordSpend(usd: number) {
  await incrBy(`spend:${today()}`, Number(usd.toFixed(4)), DAY);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) || "unknown";
}
