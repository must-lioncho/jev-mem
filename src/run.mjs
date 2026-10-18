import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findCandidates } from "./claude-mem.mjs";
import { CONFIG_DIR, workerUrl } from "./config.mjs";
import { apiKey, evaluate } from "./jev.mjs";
import { buildPayload, choose, render } from "./select.mjs";

export const LOG_PATH = join(CONFIG_DIR, "decisions.jsonl");

/**
 * Vector candidates from claude-mem, judged by JEV, rendered for injection.
 * Every failure ends in "inject nothing": a wrong record costs more than a missing one.
 */
export async function selectContext({ prompt, cwd, config }) {
  const started = Date.now();
  const decision = { mode: config.mode, minProbability: config.minProbability, candidates: [], injected: [] };
  const finish = (context, extra = {}) => ({ context, decision: { ...decision, ...extra, ms: Date.now() - started } });

  if (!config.enabled) return finish("", { skipped: "disabled" });
  if (!prompt || prompt.trim().length < config.minPromptChars) return finish("", { skipped: "short-prompt" });

  const key = apiKey();
  if (!key) return finish("", { skipped: "no-jev-key" });

  const signal = AbortSignal.timeout(config.timeoutMs);
  try {
    const { rows, project } = await findCandidates({
      baseUrl: workerUrl(config),
      query: prompt.slice(0, 1000),
      cwd,
      limit: config.candidates,
      scope: config.scope,
      signal,
    });
    decision.project = project;
    if (!rows.length) return finish("", { skipped: "no-candidates" });

    const answers = await evaluate({ payload: buildPayload(prompt, rows), key, signal });
    const { scored, picked } = choose(rows, answers, config);
    decision.candidates = scored.map((s) => ({ id: s.row.id, title: s.row.title, vectorRank: s.vectorRank, p: s.probability }));
    decision.injected = picked.map((s) => s.row.id);
    return finish(render(picked, config));
  } catch (err) {
    return finish("", { error: err.name === "TimeoutError" ? "timeout" : err.message });
  }
}

export function logDecision({ decision, prompt, config }) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      promptChars: prompt?.length ?? 0,
      promptSha: createHash("sha256").update(prompt ?? "").digest("hex").slice(0, 12),
      ...(config.logPrompt ? { prompt } : {}),
      ...decision,
    };
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // Logging never blocks the prompt.
  }
}
