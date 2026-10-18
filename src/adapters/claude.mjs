// Claude Code (and GLM via glm-claude, which shares ~/.claude) UserPromptSubmit hook.
export const claude = {
  read: (input) => ({ prompt: typeof input.prompt === "string" ? input.prompt : "", cwd: input.cwd }),
  write: ({ context, status }) => {
    const out = { systemMessage: status };
    if (context) out.hookSpecificOutput = { hookEventName: "UserPromptSubmit", additionalContext: context };
    return JSON.stringify(out);
  },
};
