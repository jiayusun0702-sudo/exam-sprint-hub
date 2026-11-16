import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { IncompleteError, RefusedError, generate } from "./claude";
import { LimitError, recordSpend, useCall } from "./limits";

export function errorResponse(err: unknown) {
  if (err instanceof LimitError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError) return NextResponse.json({ error: "Bad request", issues: err.issues.slice(0, 5) }, { status: 400 });
  if (err instanceof RefusedError || err instanceof IncompleteError) {
    return NextResponse.json({ error: err.message, retryable: err instanceof IncompleteError }, { status: 502 });
  }
  console.error(err);
  return NextResponse.json({ error: "Generation failed, please retry.", retryable: true }, { status: 500 });
}

/** Spend one call from the job token, run the model, record the cost. */
export async function guardedGenerate<S extends z.ZodType>(token: string, schema: S, prompt: string) {
  await useCall(token);
  const res = await generate(schema, prompt);
  await recordSpend(res.costUsd);
  return res;
}
