// Hooks fire before jev-router picks the model, so a hook-printed line lands above "[Jev] routed ...".
// Ask the model to print the status right after the router line instead, so the screen reads route first, memory second.
export function showAfterRoute(status, context) {
  const show = `Print this exact line right after the "[Jev] routed ..." line (or first, if there is none), then continue:\n${status}`;
  return context ? `${show}\n\n${context}` : show;
}
