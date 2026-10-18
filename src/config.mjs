import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".jev-mem");
export const CONFIG_PATH = join(CONFIG_DIR, "settings.json");

export const DEFAULTS = Object.freeze({
  enabled: true,
  // "top1": inject only the best record. "all": inject every record that passes the threshold.
  mode: "top1",
  // Vector candidates pulled from claude-mem for JEV to judge.
  candidates: 5,
  // Upper bound for mode "all".
  maxInject: 5,
  // JEV yes-probability a record needs before it is injected. Nothing passes -> nothing injected.
  minProbability: 0.7,
  // "narrative": full record text. "index": one line per record plus its id.
  format: "narrative",
  narrativeChars: 1200,
  // "project": search the current project first, then all projects if it has no records.
  // "all": always search every project.
  scope: "project",
  minPromptChars: 20,
  timeoutMs: 6000,
  workerUrl: null,
  logPrompt: false,
});

const ENV = {
  JEV_MEM_ENABLED: ["enabled", "bool"],
  JEV_MEM_MODE: ["mode", "string"],
  JEV_MEM_CANDIDATES: ["candidates", "int"],
  JEV_MEM_MAX_INJECT: ["maxInject", "int"],
  JEV_MEM_MIN_PROBABILITY: ["minProbability", "float"],
  JEV_MEM_FORMAT: ["format", "string"],
  JEV_MEM_SCOPE: ["scope", "string"],
  JEV_MEM_TIMEOUT_MS: ["timeoutMs", "int"],
  JEV_MEM_WORKER_URL: ["workerUrl", "string"],
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function cast(value, kind) {
  if (kind === "bool") return value === "true" || value === "1";
  if (kind === "int") return Number.parseInt(value, 10);
  if (kind === "float") return Number.parseFloat(value);
  return value;
}

/** Settings file, then environment overrides, then validation back to defaults. */
export function loadConfig({ env = process.env, path = CONFIG_PATH } = {}) {
  const config = { ...DEFAULTS, ...readJson(path) };
  for (const [name, [key, kind]] of Object.entries(ENV)) {
    if (env[name] !== undefined && env[name] !== "") config[key] = cast(env[name], kind);
  }
  return normalize(config);
}

export function normalize(config) {
  const out = { ...DEFAULTS, ...config };
  const between = (v, lo, hi, fallback) => (Number.isFinite(v) && v >= lo && v <= hi ? v : fallback);
  if (!["top1", "all"].includes(out.mode)) out.mode = DEFAULTS.mode;
  if (!["narrative", "index"].includes(out.format)) out.format = DEFAULTS.format;
  if (!["project", "all"].includes(out.scope)) out.scope = DEFAULTS.scope;
  out.candidates = between(out.candidates, 1, 20, DEFAULTS.candidates);
  out.maxInject = between(out.maxInject, 1, out.candidates, Math.min(DEFAULTS.maxInject, out.candidates));
  out.minProbability = between(out.minProbability, 0, 1, DEFAULTS.minProbability);
  out.narrativeChars = between(out.narrativeChars, 100, 10000, DEFAULTS.narrativeChars);
  out.minPromptChars = between(out.minPromptChars, 0, 1000, DEFAULTS.minPromptChars);
  out.timeoutMs = between(out.timeoutMs, 500, 30000, DEFAULTS.timeoutMs);
  out.enabled = out.enabled !== false;
  out.logPrompt = out.logPrompt === true;
  return out;
}

/** claude-mem's worker address: its own settings, else its default port (37700 + uid % 100). */
export function workerUrl(config, { env = process.env } = {}) {
  if (config.workerUrl) return config.workerUrl.replace(/\/$/, "");
  const mem = readJson(join(homedir(), ".claude-mem", "settings.json"));
  const host = env.CLAUDE_MEM_WORKER_HOST || mem.CLAUDE_MEM_WORKER_HOST || "127.0.0.1";
  const port = env.CLAUDE_MEM_WORKER_PORT || mem.CLAUDE_MEM_WORKER_PORT || String(37700 + ((process.getuid?.() ?? 77) % 100));
  return `http://${host}:${port}`;
}
