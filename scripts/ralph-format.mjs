// Pure formatting helpers for the Ralph loop's live console feed.
//
// `claude -p --output-format stream-json` emits one JSON object per line as the
// session works (assistant turns with text + tool_use blocks, tool results, a
// final result). These helpers turn that firehose into one short, human-readable
// line per meaningful action — "edit src/foo.ts", "bash vitest run", a trimmed
// note — so you can watch an iteration progress instead of staring at dead air.
//
// Kept free of Node/child_process/DOM so the event→line mapping can be unit-tested
// deterministically; ralph.mjs owns the actual spawn, stream parsing, heartbeat,
// and hang detection. Mirrors the src/ pure-model convention (stars.ts, ripples.ts).

/** Format a millisecond duration as `M:SS` (minutes uncapped, seconds zero-padded). */
export function fmtElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Collapse all whitespace to single spaces, trim, and ellipsize past `max` chars. */
export function oneLine(str, max) {
  const flat = String(str ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1) + "…";
}

/** Shorten a file path to repo-relative (posix) when under `root`, else its basename. */
export function shortPath(p, root) {
  if (!p) return "";
  const np = String(p).replace(/\\/g, "/");
  const nr = root ? String(root).replace(/\\/g, "/").replace(/\/$/, "") : "";
  if (nr && np.startsWith(nr + "/")) return np.slice(nr.length + 1);
  return np.split("/").pop();
}

/**
 * Describe a single tool_use block as `{ verb, detail }` — a short lowercase verb
 * and a compact target (shortened path, trimmed command, pattern, or count).
 * Unknown tools fall back to their lower-cased name with a blank detail.
 */
export function describeTool(name, input = {}, root = "") {
  switch (name) {
    case "Read":
      return { verb: "read", detail: shortPath(input.file_path, root) };
    case "Edit":
    case "MultiEdit":
      return { verb: "edit", detail: shortPath(input.file_path, root) };
    case "NotebookEdit":
      return { verb: "edit", detail: shortPath(input.notebook_path, root) };
    case "Write":
      return { verb: "write", detail: shortPath(input.file_path, root) };
    case "Bash":
      return { verb: "bash", detail: oneLine(input.command, 80) };
    case "Grep":
      return { verb: "grep", detail: oneLine(input.pattern, 60) };
    case "Glob":
      return { verb: "glob", detail: oneLine(input.pattern, 60) };
    case "LS":
      return { verb: "ls", detail: shortPath(input.path, root) };
    case "TodoWrite":
      return { verb: "todo", detail: `${input.todos?.length ?? 0} items` };
    case "Task":
      return { verb: "task", detail: oneLine(input.description, 70) };
    case "WebFetch":
      return { verb: "fetch", detail: oneLine(input.url, 80) };
    case "WebSearch":
      return { verb: "search", detail: oneLine(input.query, 70) };
    default:
      return { verb: String(name ?? "tool").toLowerCase(), detail: "" };
  }
}

/**
 * Map one parsed stream-json event to the lines worth showing (possibly several,
 * in order, for a multi-block assistant turn — or none for the chatter we hide:
 * tool results, system init, and successful final results). An errored result is
 * surfaced as a single `error` line so a failed iteration says why.
 */
export function formatEvent(evt, root = "") {
  if (!evt || typeof evt !== "object") return [];

  if (evt.type === "assistant") {
    const blocks = evt.message?.content ?? [];
    const lines = [];
    for (const b of blocks) {
      if (b?.type === "text") {
        const detail = oneLine(b.text, 100);
        if (detail) lines.push({ verb: "note", detail });
      } else if (b?.type === "tool_use") {
        lines.push(describeTool(b.name, b.input, root));
      }
    }
    return lines;
  }

  if (evt.type === "result" && evt.is_error) {
    return [{ verb: "error", detail: oneLine(evt.result ?? evt.subtype ?? "unknown error", 120) }];
  }

  // user (tool results), system (init), and successful results: intentionally quiet.
  return [];
}

/**
 * Interpret the loop's memory file (state.json) text into the signals the loop acts on.
 * Pure (takes the raw string, no fs) so the done/settled decision is unit-tested.
 *
 *   done       — agent declared all loop-ownable work complete (top-level "done": true).
 *   settled    — every milestone is "done" or "blocked", i.e. nothing loop-ownable remains
 *                anywhere. This is the key fix: a milestone blocked purely on a human step
 *                (deploy, credentials, manual acceptance) counts as settled, so the loop can
 *                finish cleanly instead of mistaking "only human steps left" for "stuck".
 *   summary    — compact "M1:done M2:blocked …" line for the iteration banner.
 *   humanTodos — the handoff checklist the agent leaves for the human (strings only).
 *
 * A malformed file degrades to not-done / not-settled with an "(unparseable)" summary —
 * the loop's commit/state-diff progress check still works regardless.
 */
export function parseState(raw) {
  let s;
  try {
    s = JSON.parse(raw);
  } catch {
    return { done: false, settled: false, summary: "(unparseable)", humanTodos: [] };
  }
  const milestones = Array.isArray(s?.milestones) ? s.milestones : [];
  const humanTodos = Array.isArray(s?.humanTodos)
    ? s.humanTodos.filter((t) => typeof t === "string")
    : [];
  const summary = milestones.length
    ? milestones.map((m) => `${m?.id ?? "?"}:${m?.status ?? "?"}`).join(" ")
    : "(no milestones)";
  const settled =
    milestones.length > 0 &&
    milestones.every((m) => m?.status === "done" || m?.status === "blocked");
  return { done: s?.done === true, settled, summary, humanTodos };
}
