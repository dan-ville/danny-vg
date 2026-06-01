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
//   HANG_MINS=10 HEARTBEAT_SECS=30 node scripts/ralph.mjs  # tune the live-feed cadence
//
// Live feed: each iteration runs `claude -p` in stream-json mode and prints one short
// line per action (read/edit/bash/test/note) as it happens, plus a "...still working"
// heartbeat during any quiet stretch — so you can tell processing from stuck at a glance.
// (NB: a fresh session does ONE committable slice per iteration by design — clean context
// each time — then the loop repeats. One-slice-per-iteration is the point, not a stop.)
//
// Stops CLEANLY when every milestone is "done" or "blocked" — i.e. no loop-ownable work
// remains anywhere (state.json reports "done": true, and/or every milestone is settled). A
// human step (deploy, real credentials, manual-acceptance pass) is recorded as a "blocked"
// milestone + a top-level "humanTodos" entry and NEVER keeps the loop running — the loop
// prints the handoff checklist and exits 0. A ralph loop must not depend on a manual step.
//
// Stops with an ERROR when: an iteration makes no progress (no new commit AND no change to
// state.json — genuinely stuck: build error, unclear step), OR an iteration goes silent for
// HANG_MINS (default 10) — treated as a hang and killed, OR MAX_ITERS hit.
//
// Ctrl-C is always safe: every iteration commits its code AND state.json before exiting, so
// re-running resumes from the next unfinished milestone.

import { spawn, spawnSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"
import { fmtElapsed, oneLine, formatEvent, parseState } from "./ralph-format.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PLAN = process.env.PLAN_PATH ? join(ROOT, process.env.PLAN_PATH) : join(ROOT, "plan.md")
const STATE = process.env.STATE_PATH ? join(ROOT, process.env.STATE_PATH) : join(ROOT, ".ralph", "state.json")
const MAX_ITERS = Number(process.env.MAX_ITERS ?? 40)
const DRY_RUN = !!process.env.DRY_RUN
// Live-feed cadence. The heartbeat prints a pulse after this many seconds of silence;
// the hang guard kills an iteration that produces NO output for this many minutes (a
// genuinely stuck session, vs. one that's just churning on a long step).
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_SECS ?? 30) * 1000
const HANG_MS = Number(process.env.HANG_MINS ?? 10) * 60 * 1000

const rel = (p) => relative(ROOT, p).replace(/\\/g, "/")
const planRel = rel(PLAN)
const stateRel = rel(STATE)

// The single-iteration prompt — the body of the loop. Each fresh session gets exactly this.
// It tells the agent how to read the memory, advance one slice, and write the memory back.
const PROMPT = [
  `You are one iteration of an autonomous build loop with a fresh context.`,
  `Your only memory is: the spec in ${planRel}, the code on disk, the git history, and the progress file ${stateRel}.`,
  `Read ${stateRel}. If it does not exist, create it: derive the milestone list from the spec's build plan (section 17 of ${planRel}, M1–M4),`,
  `writing each as {"id","title","status":"todo","note":""} plus a top-level "done": false and a top-level "humanTodos": [].`,
  `Treat ${planRel} as the source-of-truth spec and ${stateRel} as your cursor into it — do NOT edit the spec.`,
  `A milestone's "status" is one of: "todo" (loop-ownable work remains), "done" (fully implemented and verified), or "blocked" (the only work left needs a human/credentials).`,
  `Pick the first milestone whose status is "todo". Implement the next concrete, committable slice of it using TDD (failing test → run → implement → run → commit).`,
  `NEVER perform or wait on a step that needs a human or credentials — Vercel deploys, real API keys, the manual-acceptance pass. If a milestone's ONLY remaining work is such a step, set its status to "blocked", note why, and append the concrete manual step(s) to the top-level "humanTodos" array. A blocked milestone never counts as loop work again.`,
  `Set a milestone's status to "done" ONLY when it is fully implemented and verified; keep its "note" current (one line: what's done / what's next).`,
  `When every milestone is "done" or "blocked" — i.e. no loop-ownable work remains anywhere — set top-level "done": true and make sure "humanTodos" lists every manual step left for the human. Do this even if deploys/credentials remain; those are never loop work and must not keep the loop running.`,
  `Commit your code changes AND the updated ${stateRel} before you stop.`,
].join(" ")

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" })
  return (r.stdout ?? "").trim()
}

// The loop's view of its memory: the raw text (for change detection), whether the file
// exists yet, and the interpreted signals (done / settled / summary / humanTodos) from
// parseState. "settled" means every milestone is done-or-blocked — nothing loop-ownable
// is left, so the loop can hand off to the human and stop cleanly.
function readState() {
  if (!existsSync(STATE)) {
    return { raw: "", exists: false, done: false, settled: false, summary: "(not seeded yet)", humanTodos: [] }
  }
  const raw = readFileSync(STATE, "utf8")
  return { raw, exists: true, ...parseState(raw) }
}

// Print the human handoff: the manual steps the loop deliberately left undone.
function printHandoff(humanTodos) {
  if (humanTodos && humanTodos.length) {
    console.log(`  Left for you (the loop can't do these):`)
    for (const t of humanTodos) console.log(`    • ${t}`)
  } else {
    console.log(`  Deploys + the manual-acceptance pass are left for you.`)
  }
}

// Kill the whole subtree. With shell:true the direct child is the shell, and claude
// runs as its grandchild — on Windows a plain child.kill() would orphan it, so walk
// the tree with taskkill. Best-effort: a kill failure must not crash the loop.
function killTree(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" })
  } else {
    try {
      child.kill("SIGTERM")
    } catch {
      /* already gone */
    }
  }
}

// Run one iteration of claude, streaming a live activity feed as it works.
//
// We ask for `--output-format stream-json` (NDJSON, one event per line) instead of the
// default text format, because plain `claude -p` stays silent until the whole turn ends
// and then dumps everything at once — minutes of dead air that read as "stuck". Streaming
// lets us print each action as it happens. spawn (async) rather than spawnSync is required:
// spawnSync blocks the event loop, so neither the heartbeat nor the hang timer could fire.
//
// Returns the exit code (Promise<number>); a detected hang resolves to 1.
function runClaude() {
  // shell:true is required on Windows so the `claude` .cmd shim resolves — but with
  // shell:true Node does NOT quote an args array, so a prompt with spaces gets split
  // into separate tokens (claude would see only `-p Open`). Build a single, explicitly
  // quoted command string instead so the whole prompt arrives as one argument.
  const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`
  const parts = [
    "claude",
    "-p",
    q(PROMPT),
    "--output-format",
    "stream-json",
    "--verbose", // required by claude when -p is paired with stream-json
    "--dangerously-skip-permissions",
  ]
  if (process.env.MODEL) parts.push("--model", q(process.env.MODEL))

  return new Promise((resolve) => {
    const start = Date.now()
    let lastActivity = start
    let hung = false
    const child = spawn(parts.join(" "), { cwd: ROOT, shell: true })

    const elapsed = () => fmtElapsed(Date.now() - start)
    // One feed line: `  <elapsed>  <verb> <detail>`. Any real output also resets the
    // silence clock that drives the heartbeat and hang guard.
    const line = (verb, detail) => {
      lastActivity = Date.now()
      console.log(`  ${elapsed()}  ${String(verb).padEnd(6)} ${detail ?? ""}`.trimEnd())
    }
    const handle = (evt) => {
      for (const item of formatEvent(evt, ROOT)) line(item.verb, item.detail)
    }

    // stdout is newline-delimited JSON; buffer partial lines across chunks.
    let buf = ""
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      buf += chunk
      let nl
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!raw) continue
        try {
          handle(JSON.parse(raw))
        } catch {
          line("·", oneLine(raw, 120)) // non-JSON line: show it rather than swallow it
        }
      }
    })

    // stderr is claude's own diagnostics/warnings — surface them as-is.
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => {
      for (const l of String(chunk).split(/\r?\n/)) {
        if (l.trim()) line("stderr", oneLine(l, 160))
      }
    })

    // Heartbeat + hang guard share one timer ticking at the heartbeat interval.
    const timer = setInterval(() => {
      const quiet = Date.now() - lastActivity
      if (quiet >= HANG_MS) {
        hung = true
        console.error(`\n✗ No output for ${fmtElapsed(quiet)} — treating this iteration as hung. Killing it.`)
        killTree(child)
        return
      }
      if (quiet >= HEARTBEAT_MS) {
        console.log(`  ${elapsed()}  ...still working (${elapsed()} elapsed)`)
      }
    }, HEARTBEAT_MS)

    child.on("error", (err) => {
      clearInterval(timer)
      console.error(`\n✗ Failed to launch claude: ${err.message}`)
      resolve(1)
    })
    child.on("close", (code) => {
      clearInterval(timer)
      const tail = buf.trim() // flush a final unterminated line if any
      if (tail) {
        try {
          handle(JSON.parse(tail))
        } catch {
          /* ignore a partial trailing fragment */
        }
      }
      resolve(hung ? 1 : (code ?? 1))
    })
  })
}

console.log(`Ralph loop`)
console.log(`Repo:  ${ROOT}`)
console.log(`Spec:  ${planRel}`)
console.log(`State: ${stateRel}  ·  max ${MAX_ITERS} iterations\n`)

for (let i = 1; i <= MAX_ITERS; i++) {
  const before = readState()
  if (before.exists && (before.done || before.settled)) {
    const reason = before.done ? `${stateRel} → "done": true` : `every milestone is done or blocked`
    console.log(`\n✓ All loop-ownable work complete (${reason}).`)
    printHandoff(before.humanTodos)
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

  const code = await runClaude()
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
        `  The task is likely stuck (build error, unclear step, or a blocker). Inspect the output above.\n` +
        `  (If the only work left needs a human — a deploy or credentials — the iteration should have\n` +
        `   marked that milestone "blocked" and set "done": true to hand off cleanly, not stalled here.)`,
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
