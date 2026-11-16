import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { SYSTEM } from "./prompts";

// Model and effort are configurable so cost can be tuned without code changes.
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.CLAUDE_EFFORT || "medium") as "low" | "medium" | "high";

// USD per million tokens, used only for the daily budget guard.
// Defaults are Claude Opus 5.5 list prices; override if you change model.
const PRICE_IN = Number(process.env.PRICE_INPUT_PER_MTOK || 4);
const PRICE_OUT = Number(process.env.PRICE_OUTPUT_PER_MTOK || 20);

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class RefusedError extends Error {}
export class IncompleteError extends Error {}

export type GenResult<T> = { data: T; costUsd: number; usage: { input: number; output: number } };

/**
 * One structured-output call. Streams (long outputs would otherwise hit HTTP
 * timeouts) and validates the result against the Zod schema.
 */
export async function generate<S extends z.ZodType>(schema: S, prompt: string, maxTokens = 32000): Promise<GenResult<z.infer<S>>> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    // If the model declines on a safety classifier, the API retries on a fallback model in the same call.
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new RefusedError("The model declined this material.");
  if (msg.stop_reason === "max_tokens") throw new IncompleteError("Output was cut off (max_tokens).");
  if (!msg.parsed_output) throw new IncompleteError("Output did not match the expected format.");
  const u = msg.usage;
  const input = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  const output = u.output_tokens ?? 0;
  const costUsd = (input * PRICE_IN + output * PRICE_OUT) / 1e6;
  return { data: msg.parsed_output as z.infer<S>, costUsd, usage: { input: Math.round(input), output } };
}
