import { readFileSync } from "node:fs";
import { showAfterRoute } from "./show.mjs";

// Antigravity CLI PreInvocation hook (~/.gemini/config/hooks.json).
// It fires before every model call and does not carry the prompt, so read the
// newest user message from the transcript and act only on the turn's first call.
function lastUserInput(transcriptPath) {
  const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");
  const last = JSON.parse(lines.at(-1));
  if (last.type !== "USER_INPUT") return "";
  return String(last.content ?? "").replace(/<\/?USER_REQUEST>/g, "").trim();
}

export const agy = {
  read: (input) => ({
    prompt: input.transcriptPath ? lastUserInput(input.transcriptPath) : "",
    cwd: input.workspacePaths?.[0],
  }),
  write: ({ prompt, context, status }) =>
    prompt ? JSON.stringify({ injectSteps: [{ ephemeralMessage: showAfterRoute(status, context) }] }) : "{}",
};
