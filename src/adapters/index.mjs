import { claude } from "./claude.mjs";

// One adapter per runtime: parse its hook stdin, format its hook stdout.
// Codex and Gemini get added here once their prompt-time hook contracts are verified.
export const ADAPTERS = { claude };
