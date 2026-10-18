import { execFileSync } from "node:child_process";
import { basename } from "node:path";

/** Project names to try, most specific first: git root folder, then the working folder. */
export function projectNames(cwd) {
  const names = [];
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    }).trim();
    if (root) names.push(basename(root));
  } catch {
    // Not a git repository.
  }
  if (cwd) names.push(basename(cwd));
  return [...new Set(names.filter(Boolean))];
}

/** Vector search through claude-mem's local worker. Returns observation rows, best match first. */
export async function searchObservations({ baseUrl, query, project, limit, signal }) {
  const params = new URLSearchParams({ query, type: "observations", format: "json", limit: String(limit) });
  if (project) params.set("project", project);
  const response = await fetch(`${baseUrl}/api/search?${params}`, { signal });
  if (!response.ok) throw new Error(`claude-mem worker HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data?.observations) ? data.observations.slice(0, limit) : [];
}

/** Current project first; every project only when the current one has no records. */
export async function findCandidates({ baseUrl, query, cwd, limit, scope, signal }) {
  if (scope === "project") {
    for (const project of projectNames(cwd)) {
      const rows = await searchObservations({ baseUrl, query, project, limit, signal });
      if (rows.length) return { rows, project };
    }
  }
  return { rows: await searchObservations({ baseUrl, query, limit, signal }), project: null };
}
