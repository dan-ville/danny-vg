#!/usr/bin/env node
// Ralph loop: repeatedly spawn a fresh, headless `claude -p` session, each doing
// ONE committable slice of work toward the spec, until everything loop-ownable is done.
//
// Why a fresh process per iteration? Clean context each time. A ralph loop only works
// because its state lives OUTSIDE the conversation. Here that state — the loop's memory —
// is three things, in order of authority:
//   1. plan.md         — the immutable spec (what we're building). The loop never edits it.
//   2. the code + git  — ground truth of what actually exists.
//   3. .ralph/state.json — the agent-owned cursor: which milestones are done, and a one-line
//                          note per milestone so the next fresh session orients in O(1)
//                          instead of re-deriving "where are we" from the whole repo.
//
// Each iteration the agent reconstructs "what's left" by reading the spec and diffing it
// against reality, advances one slice, commits, and updates state.json. The loop itself
// stays dumb: it only READS state.json (for the done/progress signals) and never parses
// the spec. That's deliberate — the spec can be prose, milestones, anything; the agent is
// the one who understands it.
//
// Usage:
//   node scripts/ralph.mjs                 # run the loop
//   MODEL=claude-opus-4-8 node scripts/ralph.mjs
//   MAX_ITERS=40 node scripts/ralph.mjs
//   DRY_RUN=1 node scripts/ralph.mjs       # print what it would do, don't call claude
//   PLAN_PATH=plan.md STATE_PATH=.ralph/state.json node scripts/ralph.mjs
//
// Stops when: state.json reports "done": true (all loop-ownable milestones complete — the
// agent is told to leave deploys / real credentials / the manual-acceptance pass for a human),
// OR an iteration makes no progress (no new commit AND no change to state.json — the task is
// stuck), OR MAX_ITERS hit.
//
// Ctrl-C is always safe: every iteration commits its code AND state.json before exiting, so
// re-running resumes from the next unfinished milestone.

import { spawnSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PLAN = process.env.PLAN_PATH ? join(ROOT, process.env.PLAN_PATH) : join(ROOT, "plan.md")
const STATE = process.env.STATE_PATH ? join(ROOT, process.env.STATE_PATH) : join(ROOT, ".ralph", "state.json")
const MAX_ITERS = Number(process.env.MAX_ITERS ?? 40)
const DRY_RUN = !!process.env.DRY_RUN

const rel = (p) => relative(ROOT, p).replace(/\\/g, "/")
const planRel = rel(PLAN)
const stateRel = rel(STATE)

// The single-iteration prompt — the body of the loop. Each fresh session gets exactly this.
// It tells the agent how to read the memory, advance one slice, and write the memory back.
const PROMPT = [
  `You are one iteration of an autonomous build loop with a fresh context.`,
  `Your only memory is: the spec in ${planRel}, the code on disk, the git history, and the progress file ${stateRel}.`,
  `Read ${stateRel}. If it does not exist, create it: derive the milestone list from the spec's build plan (section 17 of ${planRel}, M1–M4),`,
  `writing each as {"id","title","status":"todo","note":""} plus a top-level "done": false.`,
  `Treat ${planRel} as the source-of-truth spec and ${stateRel} as your cursor into it — do NOT edit the spec.`,
  `Pick the first milestone whose status is not "done". Implement the next concrete, committable slice of it using TDD (failing test → run → implement → run → commit).`,
  `Skip anything that needs a human or credentials — Vercel deploys, real API keys, the manual-acceptance pass — leave those for the human and do not block on them.`,
  `Set a milestone's status to "done" ONLY when it is fully implemented and verified; keep its "note" current (one line: what's done / what's next).`,
  `When every milestone is done, set top-level "done": true.`,
  `Commit your code changes AND the updated ${stateRel} before you stop.`,
].join(" ")

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" })
  return (r.stdout ?? "").trim()
}

// The loop's view of its memory. Returns the raw text (for change detection), whether the
// file exists yet, the done flag, and a compact human summary of milestone statuses.
function readState() {
  if (!existsSync(STATE)) return { raw: "", exists: false, done: false, summary: "(not seeded yet)" }
  const raw = readFileSync(STATE, "utf8")
  let done = false
  let summary = "(unparseable)"
  try {
    const s = JSON.parse(raw)
    done = s.done === true
    if (Array.isArray(s.milestones)) {
      summary = s.milestones.map((m) => `${m.id ?? "?"}:${m.status ?? "?"}`).join(" ")
    }
  } catch {
    /* leave defaults — a malformed file just reads as not-done; the diff check still works */
  }
  return { raw, exists: true, done, summary }
}

function runClaude() {
  // shell:true is required on Windows so the `claude` .cmd shim resolves — but with
  // shell:true Node does NOT quote an args array, so a prompt with spaces gets split
  // into separate tokens (claude would see only `-p Open`). Build a single, explicitly
  // quoted command string instead so the whole prompt arrives as one argument.
  const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`
  const parts = ["claude", "-p", q(PROMPT), "--dangerously-skip-permissions"]
  if (process.env.MODEL) parts.push("--model", q(process.env.MODEL))
  // stdio inherit to stream output live.
  const r = spawnSync(parts.join(" "), {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  })
  return r.status ?? 1
}

console.log(`Ralph loop`)
console.log(`Repo:  ${ROOT}`)
console.log(`Spec:  ${planRel}`)
console.log(`State: ${stateRel}  ·  max ${MAX_ITERS} iterations\n`)

for (let i = 1; i <= MAX_ITERS; i++) {
  const before = readState()
  if (before.exists && before.done) {
    console.log(
      `\n✓ All loop-ownable milestones complete (${stateRel} → "done": true).\n  Deploys + the manual-acceptance pass are left for you.`,
    )
    break
  }

  const beforeHead = git(["rev-parse", "HEAD"])
  console.log(
    `\n══ Iteration ${i} — state: ${before.summary} ══════════════════════════`,
  )

  if (DRY_RUN) {
    console.log(`[dry-run] would run: claude -p "<one-slice prompt>" --dangerously-skip-permissions`)
    break
  }

  const code = runClaude()
  if (code !== 0) {
    console.error(`\n✗ claude exited with code ${code}. Stopping.`)
    process.exit(code)
  }

  const after = readState()
  const afterHead = git(["rev-parse", "HEAD"])
  const stateChanged = after.raw !== before.raw
  const committed = afterHead !== beforeHead && afterHead !== "" // ignore "" when not a git repo
  if (!stateChanged && !committed) {
    console.error(
      `\n✗ No progress this iteration: no new commit and no change to ${stateRel}.\n` +
        `  The task is likely stuck (build error, unclear step, or a blocker). Inspect the output above.`,
    )
    process.exit(1)
  }
  console.log(
    `\n→ Progress: ${before.summary} → ${after.summary}` +
      (committed
        ? `  (HEAD ${beforeHead.slice(0, 7) || "—"} → ${afterHead.slice(0, 7)})`
        : `  (state.json updated)`),
  )
}
