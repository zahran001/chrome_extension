# GSD Toolkit Architecture

GSD (Get Shit Done) is a phase-wave execution orchestrator for Claude Code. It separates planning from execution, specializes agents by role, and verifies goal achievement — not just task completion.

---

## High-Level Overview

```
User Command (/gsd:execute-phase 01)
         │
         ▼
    Skill Router
         │
         ▼
  Workflow (.md) ◄─────────────────────────────────┐
  (thin orchestrator)                              │
         │                                         │
         ├─ gsd-tools.cjs (init execute-phase 01)  │
         │   └─ Returns: models, config, plan list │
         │                                         │
         ├─ Discovers plans by WAVE                │
         │   ┌──────────────────────────────────┐  │
         │   │  Wave 1 (parallel)               │  │
         │   │   ├─ gsd-executor (plan 01) ─────┤  │
         │   │   └─ gsd-executor (plan 02) ─────┤  │
         │   └──────────────────────────────────┘  │
         │   ┌──────────────────────────────────┐  │
         │   │  Wave 2 (after Wave 1 completes) │  │
         │   │   └─ gsd-executor (plan 03) ─────┤  │
         │   └──────────────────────────────────┘  │
         │                                         │
         ├─ Checkpoint? → Pause → User → Resume ───┘
         │
         └─ Done → STATE.md updated, commits made
```

---

## Planning Sequence (`/gsd:plan-phase`)

```
/gsd:plan-phase 01
      │
      ▼
 plan-phase.md workflow
      │
      ├──[1] gsd-phase-researcher
      │       ├─ Input: ROADMAP phase + CONTEXT.md
      │       └─ Output: {phase}-RESEARCH.md
      │
      ├──[2] gsd-planner
      │       ├─ Input: RESEARCH.md + REQUIREMENTS.md + CONTEXT.md
      │       ├─ Goal-backward decomposition
      │       ├─ Wave/dependency assignment
      │       └─ Output: N × {phase}-{plan}-PLAN.md
      │         (each with wave:, depends_on:, must_haves:)
      │
      └──[3] gsd-plan-checker (loop up to 3×)
              ├─ Input: All PLAN.md files
              ├─ Validates: coverage, dependencies, must_haves
              └─ Output: Approve or revision list → back to planner
```

---

## Execution Sequence (`/gsd:execute-phase`)

```
/gsd:execute-phase 01
      │
      ▼
 execute-phase.md workflow
      │
      ├──[init] gsd-tools.cjs init execute-phase 01
      │          └─ Returns: executor_model, plan inventory grouped by wave
      │
      ├──[wave 1] Plans with no dependencies → run in parallel
      │    ├─ gsd-executor (plan 01-01)
      │    │    ├─ Reads PLAN.md frontmatter (tasks, must_haves)
      │    │    ├─ Executes tasks → atomic git commits
      │    │    └─ Writes {plan}-SUMMARY.md
      │    └─ gsd-executor (plan 01-02)   [same wave = parallel]
      │
      ├──[spot check] Verify files exist, commits created
      │
      ├──[wave 2] Plans depending on wave 1 → run next
      │    └─ gsd-executor (plan 01-03)
      │         └─ Writes SUMMARY.md
      │
      ├──[checkpoint?]
      │    ├─ human-verify → pause → user confirms → resume
      │    ├─ decision     → pause → user picks option → resume
      │    └─ human-action → always pauses (can't automate)
      │
      └──[verify] gsd-verifier
               ├─ Checks must_haves against actual code
               └─ Gaps → fix plans → re-execute → re-verify
```

---

## PLAN.md → Execution Data Flow

```
PLAN.md frontmatter
┌────────────────────────────┐
│ wave: 2                    │  ─→  which execution group
│ depends_on: [01-01]        │  ─→  must wait for plan 01-01
│ autonomous: false          │  ─→  has checkpoints, will pause
│ must_haves:                │
│   truths: [...]            │  ─→  behavioral verification
│   artifacts: [...]         │  ─→  file existence + pattern match
│   key_links: [...]         │  ─→  cross-file connections
└────────────────────────────┘
         │
         ▼
  gsd-executor runs tasks
         │
         ▼
  SUMMARY.md (output)
┌────────────────────────────┐
│ phase/plan metadata        │
│ provides: [what was built] │
│ affects: [what changed]    │
│ key-files: {created, mod.} │
│ key-decisions: [...]       │
│ duration: Xmin             │
└────────────────────────────┘
```

---

## Agent Specialization & Model Budget

| Agent | Role | Quality | Balanced | Budget |
|---|---|---|---|---|
| gsd-planner | Design wave plans | opus | opus | sonnet |
| gsd-executor | Write + commit code | opus | sonnet | sonnet |
| gsd-phase-researcher | Research domain | opus | sonnet | haiku |
| gsd-plan-checker | Validate plans | sonnet | sonnet | haiku |
| gsd-verifier | Check must_haves | sonnet | sonnet | haiku |
| gsd-debugger | Diagnose failures | opus | sonnet | sonnet |
| gsd-codebase-mapper | Read architecture | sonnet | haiku | haiku |
| gsd-roadmapper | Create ROADMAP.md | opus | sonnet | sonnet |

---

## Project Lifecycle State Machine

```
[new-project] → PROJECT.md + REQUIREMENTS.md + ROADMAP.md + STATE.md
      │
      ▼
[plan-phase] → CONTEXT.md + RESEARCH.md + N×PLAN.md
      │
      ▼
[execute-phase] ──────────────────────────────────┐
      │   Wave 1 → Wave 2 → ... → Wave N          │
      │   Each plan: tasks → commits → SUMMARY.md  │
      │   Checkpoints: pause for human             │
      ◄─────────────────────────────────────────── ┘
      │
      ▼
[verify-work] → VERIFICATION.md → pass or gap-fix loop
      │
      ▼
[next phase] → repeat plan → execute → verify
      │
      ▼
[complete-milestone] → archive phases → milestones/v*-phases/
                     → optional branch merge
```

---

## Directory Structure

```
.claude/get-shit-done/
├── bin/
│   ├── gsd-tools.cjs          # Main CLI (124 commands)
│   └── lib/
│       ├── core.cjs           # Model profiles, git, phase lookup
│       ├── state.cjs          # STATE.md operations
│       ├── phase.cjs          # Phase CRUD & lifecycle
│       ├── roadmap.cjs        # Roadmap parsing & updates
│       ├── template.cjs       # Template selection & filling
│       └── verify.cjs         # Validation helpers
├── templates/
│   ├── config.json            # Default GSD configuration
│   ├── phase-prompt.md        # PLAN.md template
│   ├── roadmap.md             # Roadmap template
│   └── ...
├── workflows/                 # 32 markdown orchestration workflows
│   ├── execute-phase.md
│   ├── plan-phase.md
│   ├── execute-plan.md
│   ├── verify-phase.md
│   ├── new-project.md
│   └── ...
└── references/                # Config docs, patterns, TDD guides
```

```
.planning/
├── config.json                # Branching, model profile, parallelization
├── PROJECT.md                 # Project context + tech decisions
├── REQUIREMENTS.md            # Functional requirements
├── ROADMAP.md                 # Phase structure + goals
├── STATE.md                   # Current position + blockers + decisions
└── phases/
    └── 01-core-mvp/
        ├── 01-CONTEXT.md
        ├── 01-RESEARCH.md
        ├── 01-01-PLAN.md
        ├── 01-01-SUMMARY.md
        └── ...
```

---

## Checkpoint Types

| Type | Trigger | Behavior |
|---|---|---|
| `human-verify` | Visual/functional check needed | Pauses; user visits URL and confirms |
| `decision` | Implementation choice required | Pauses; user picks from options |
| `human-action` | Auth gate, external setup | Always pauses; cannot be automated |

Set `auto_advance: true` in config to skip `human-verify` and `decision` checkpoints automatically. `human-action` always pauses.

---

## Configuration (`config.json`)

```json
{
  "model_profile": "balanced",
  "git": {
    "branching_strategy": "none"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false
  },
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3
  }
}
```

`branching_strategy` options: `"none"` (current branch), `"phase"` (one branch per phase), `"milestone"` (one branch per milestone).

---

## Key Design Principles

| Principle | Implementation |
|---|---|
| Orchestrators coordinate, agents execute | Workflows are thin `.md` files; agents do real work |
| Wave parallelism | Pre-computed `wave:` in PLAN.md; same wave runs in parallel |
| Goal-backward verification | `must_haves` in plan → verifier checks code actually delivers it |
| Atomic history | One git commit per task, not per plan |
| Context isolation | Each agent gets fresh 200k context; orchestrator stays lean |
| Config-driven behavior | Model profile, branching, auto-advance all in `config.json` |
