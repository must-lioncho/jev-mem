#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_PATH, loadConfig, workerUrl } from "../src/config.mjs";
import { apiKey } from "../src/jev.mjs";
import { LOG_PATH, selectContext } from "../src/run.mjs";

const MEM_SETTINGS = join(homedir(), ".claude-mem", "settings.json");
// claude-mem keys this plugin replaces: its own prompt-time injection and its session-start list.
const MEM_KEYS = {
  CLAUDE_MEM_SEMANTIC_INJECT: "false",
  CLAUDE_MEM_CONTEXT_OBSERVATIONS: "0",
  CLAUDE_MEM_CONTEXT_SESSION_COUNT: "0",
};

const USAGE = `jev-mem — JEV picks which claude-mem records reach the prompt

  jev-mem try "<prompt>" [--cwd DIR] [--json]   dry run: candidates, JEV scores, injected text
  jev-mem doctor                                check worker, JEV key, claude-mem settings
  jev-mem setup [--apply]                       show (or apply, with backup) claude-mem settings changes
  jev-mem config                                print effective settings

Settings: ${CONFIG_PATH}
Decision log: ${LOG_PATH}`;

function readMemSettings() {
  if (!existsSync(MEM_SETTINGS)) return {};
  return JSON.parse(readFileSync(MEM_SETTINGS, "utf8"));
}

async function doctor() {
  const config = loadConfig();
  const base = workerUrl(config);
  let worker = "unreachable";
  try {
    const r = await fetch(`${base}/api/search?query=health&type=observations&format=json&limit=1`, {
      signal: AbortSignal.timeout(2000),
    });
    worker = r.ok ? "ok" : `HTTP ${r.status}`;
  } catch {}
  const mem = readMemSettings();
  const conflicts = Object.entries(MEM_KEYS).filter(([k, v]) => String(mem[k] ?? "") !== v);
  console.log(`claude-mem worker  ${base}  ${worker}`);
  console.log(`JEV key            ${apiKey() ? "found" : "missing (JEV_API_KEY, ~/.jev-router.env, or Keychain typesafe-ai-api)"}`);
  console.log(`claude-mem config  ${conflicts.length ? `change needed: ${conflicts.map(([k]) => k).join(", ")} (run: jev-mem setup)` : "ok"}`);
  console.log(`mode               ${config.mode}, candidates ${config.candidates}, minProbability ${config.minProbability}`);
}

function setup(apply) {
  const mem = readMemSettings();
  const changes = Object.entries(MEM_KEYS).filter(([k, v]) => String(mem[k] ?? "") !== v);
  if (!changes.length) return console.log("claude-mem settings already match.");
  for (const [k, v] of changes) console.log(`${k}: ${mem[k] ?? "(default)"} -> ${v}`);
  if (!apply) return console.log("\nNothing written. Re-run with --apply to write (a backup is kept).");
  if (existsSync(MEM_SETTINGS)) {
    const backup = `${MEM_SETTINGS}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(MEM_SETTINGS, backup);
    console.log(`backup: ${backup}`);
  }
  writeFileSync(MEM_SETTINGS, `${JSON.stringify({ ...mem, ...Object.fromEntries(changes) }, null, 2)}\n`);
  console.log(`written: ${MEM_SETTINGS} (other keys kept). Takes effect in new sessions.`);
}

async function tryPrompt(args) {
  const i = args.indexOf("--cwd");
  const cwd = i >= 0 ? args[i + 1] : process.cwd();
  const json = args.includes("--json");
  const prompt = args.filter((a, j) => !a.startsWith("--") && args[j - 1] !== "--cwd").join(" ");
  const { context, decision } = await selectContext({ prompt, cwd, config: loadConfig() });
  if (json) return console.log(JSON.stringify({ decision, context }, null, 2));
  console.log(`project ${decision.project ?? "(all)"}  ${decision.ms} ms  ${decision.skipped ?? decision.error ?? ""}`);
  for (const c of decision.candidates) {
    const mark = decision.injected.includes(c.id) ? "INJECT" : "      ";
    console.log(`${mark} vec#${c.vectorRank} p=${c.p?.toFixed(2) ?? " -- "}  #${c.id} ${c.title}`);
  }
  console.log(context ? `\n${context}` : "\n(nothing injected)");
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "try") await tryPrompt(rest);
else if (cmd === "doctor") await doctor();
else if (cmd === "setup") setup(rest.includes("--apply"));
else if (cmd === "config") console.log(JSON.stringify(loadConfig(), null, 2));
else console.log(USAGE);
