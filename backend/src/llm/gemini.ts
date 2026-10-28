// The ONE place that talks to Gemini. Everything else calls generateJson()
// and gets back a plain result: it never throws, so a slow, broken or
// missing LLM can never take an endpoint down with it.
import { GoogleGenAI, ApiError as GeminiApiError } from "@google/genai";
import { z } from "zod";
import { config } from "../config.js";

export type LlmFailure =
  | "no_key"     // GEMINI_API_KEY not set
  | "timeout"    // no answer within GEMINI_TIMEOUT_MS
  | "api_error"  // 400 bad key/model, 429 rate limit, 5xx, network...
  | "empty"      // answered, but no text (e.g. blocked by a safety filter)
  | "bad_json"   // text that isn't JSON
  | "bad_shape"; // JSON, but not what our zod schema allows

export type LlmResult<T> =
  | { ok: true; data: T; ms: number }
  | { ok: false; reason: LlmFailure; message: string; ms: number };

// Created on first use, so importing this file never needs a key.
let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (!config.gemini.apiKey) return null;
  client ??= new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
}

export type JsonRequest<S extends z.ZodType> = {
  system: string; // the standing instructions (role, rules)
  prompt: string; // this call's data
  schema: S;      // what the answer must look like
};

// Ask for JSON that matches `schema`. The same zod schema is used twice:
//   1. converted to JSON Schema and SENT, so Gemini generates that shape
//   2. used to VALIDATE the answer, because the shape is a strong hint,
//      not a guarantee we can skip checking
export async function generateJson<S extends z.ZodType>(
  req: JsonRequest<S>,
): Promise<LlmResult<z.output<S>>> {
  const start = performance.now();
  const fail = (reason: LlmFailure, message: string): LlmResult<z.output<S>> => ({
    ok: false,
    reason,
    message,
    ms: Math.round(performance.now() - start),
  });

  const ai = getClient();
  if (!ai) return fail("no_key", "GEMINI_API_KEY is not set");

  const signal = AbortSignal.timeout(config.gemini.timeoutMs);
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: req.prompt,
      config: {
        systemInstruction: req.system,
        temperature: 0, // labelling, not creative writing: same input, same answer
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(req.schema),
        abortSignal: signal,
      },
    });
    text = response.text;
  } catch (err) {
    if (signal.aborted) return fail("timeout", `No answer within ${config.gemini.timeoutMs} ms`);
    if (err instanceof GeminiApiError) return fail("api_error", `Gemini ${err.status}: ${err.message}`);
    return fail("api_error", err instanceof Error ? err.message : String(err));
  }

  if (!text) return fail("empty", "Gemini returned no text");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail("bad_json", `Not JSON: ${text.slice(0, 120)}`);
  }

  const parsed = req.schema.safeParse(json);
  if (!parsed.success) return fail("bad_shape", z.prettifyError(parsed.error));

  return { ok: true, data: parsed.data, ms: Math.round(performance.now() - start) };
}