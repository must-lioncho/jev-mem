import { showAfterRoute } from "./show.mjs";

// Claude Code (and GLM via glm-claude, which shares ~/.claude) UserPromptSubmit hook.
export const claude = {
  read: (input) => ({ prompt: typeof input.prompt === "string" ? input.prompt : "", cwd: input.cwd }),
  write: ({ prompt, context, status }) => {
    if (!prompt) return "{}";
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: showAfterRoute(status, context) },
    });
  },
};
