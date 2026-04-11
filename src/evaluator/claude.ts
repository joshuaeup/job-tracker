import type { NormalizedJob, EvaluationResult } from "../types/index.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";
const CLAUDE_RATE_DELAY_MS = 500;

const FALLBACK_RESULT: EvaluationResult = {
  fitScore: 0,
  recommendation: "skip",
  summary: "Parse error — manual review required",
  flags: ["evaluation_failed"],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AnthropicMessage = {
  content: Array<{ type: string; text?: string }>;
};

function parseEvaluationResult(text: string): EvaluationResult {
  const parsed = JSON.parse(text) as Record<string, unknown>;

  const rawScore = parsed["fitScore"];
  const fitScore =
    typeof rawScore === "number" ? Math.min(100, Math.max(0, rawScore)) : 0;

  const rec = parsed["recommendation"];
  const recommendation: EvaluationResult["recommendation"] =
    rec === "apply" || rec === "research" || rec === "skip" ? rec : "skip";

  const rawSummary = parsed["summary"];
  const summary =
    typeof rawSummary === "string" ? rawSummary : "No summary provided";

  const rawFlags = parsed["flags"];
  const flags = Array.isArray(rawFlags) ? rawFlags.map((f) => String(f)) : [];

  return { fitScore, recommendation, summary, flags };
}

/**
 * Sends a normalized job to the Claude API for fit evaluation and returns
 * a structured `EvaluationResult`. Retries JSON parsing once (stripping
 * markdown fences) before falling back to a zero-score skip result.
 *
 * @param job - The normalized job to evaluate.
 * @param apiKey - Anthropic API key.
 * @param delayBefore - When true, waits 500ms before the API call to
 *   respect the rate limit between sequential evaluations.
 */
export async function evaluate(
  job: NormalizedJob,
  apiKey: string,
  delayBefore = true
): Promise<EvaluationResult> {
  if (delayBefore) {
    await sleep(CLAUDE_RATE_DELAY_MS);
  }

  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(job) }],
  });

  let rawText = "";

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as AnthropicMessage;
    const block = data.content.find((b) => b.type === "text");
    rawText = block?.text ?? "";
  } catch (err: unknown) {
    console.error(
      `[EVAL] Claude API call failed for "${job.title}" at ${job.company}:`,
      err instanceof Error ? err.message : err
    );
    return FALLBACK_RESULT;
  }

  try {
    return parseEvaluationResult(rawText);
  } catch {
    console.warn(`[EVAL] First parse failed for "${job.title}", retrying...`);
  }

  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    return parseEvaluationResult(cleaned);
  } catch {
    console.error(
      `[EVAL] Both parse attempts failed for "${job.title}" at ${job.company}. Raw:`,
      rawText.slice(0, 200)
    );
    return FALLBACK_RESULT;
  }
}
