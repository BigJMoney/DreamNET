# Current Feature Tracks and Dev Tasks (MEDIUM TERM PROJECT STRUCTURE)

Feature Tracks are **high-level phases** that represent small "milestones" along the path to completed features. 
Each feature maintains its own internal versioning scheme Ax By Rz (alpha, beta, release). Dev Tasks are steps to 
complete the next phase, and are not 1:1 with Git commits.

Dev Task numbering is project-global and does not correspond directly to Feature Implementation versions. It's 
loosely chronological and may skip or group numbers as planning evolves.

For a higher level view of feature work that informs future planning of this structure, see ROADMAP.md in Github 
under /docs. 

## Current Track - Terminal-Based Webclient UI [A1]
For more details, see GPT_ENGINE_OVERVIEW.md and GPT_ENGINE_LIFECYCLE.md. In A1 most work is oriented toward setting 
up rendering.

### DT 1, 2, 3 (COMPLETE / OLD)

### DT 3.5 — Engine sanity + lock-in (COMPLETE / BASELINE)
- Scheduler correctness
- Deadline-based capped FPS
- Idle stop correctness
- Double-scaling fix
- Deterministic frame invariants
- Perf harness stabilized

This dev task establishes a **safe rollback baseline**.

---

### DT 3.5.5 — More perf content (NEXT)

Goal: Add more perf content so that future tasks are easier to test.

### DT 3.6 — Engine refactor dev task

Goal: simplify and clarify the engine without changing behavior.

Checklist:
- Bake scheduling policy at construction
- Tighten `TerminalEngine` API surface
- Clarify staging / command semantics
- Decide fate of `shouldRunFrame`
- Extract perf into a generic driver abstraction
- Revisit `_tick` vs `_runOneFrame`
- Remove `stageJob()` once drivers exist
- Remove scaling from the engine (UI-only)

---

### DT 3.7 — ES module reorganization

Goal: refactor monolithic code into clean ES modules **after engine contracts are stable**.

Expected splits:
- config
- CP437
- SGR parsing / writing
- framebuffer ops
- HTML rendering
- UI scaling + reporting
- engine core
- boot / startup wiring
- investigate optimization: uncapped framebuffer construction (html write still capped)

---

### DT 4 — Writers
Output writer abstraction.

### DT 5 — Evennia I/O
Evennia input/output integration.

### DT 6: Input await buffer with idle-gated flush (one per idle)

#### Goal
Add a client-side **input await buffer** so submitted player commands are sent to Evennia **only when the terminal 
engine becomes idle**, storing **exactly one command per idle** and flushing afterward.

#### Behavior
- The engine will need a new event for when it starts up, to alert input systems enter a limited input ode and begin 
  listening for the idle event
- The user can type normally at first.
- When the user presses **Enter / Submit**:
  1. The submitted line is enqueued into `pendingInput` buffer that only holds one command.
  2. If the system is *still listening for the next `engine:idle` event* (i.e., the command cannot be flushed 
     immediately), then the prompt becomes **locked for input** Typing will be disabled and the prompt grayed out.
- On each `engine:idle` event:
  - If `pendingInput` is non-empty, dequeue the command and send it.
  - Unlock the prompt for new input
  - Return to normal input mode (no input limit, no buffer storage)

#### Notes / Constraints
- Submit locking happens **after** a command is entered, and **only** while awaiting an idle-triggered flush 
  (limited input mode)
- This task is scoped to buffering + idle-based flush + submit lock only; do not couple it to animation logic.
- Any changes needed in the engine should be limited to exposing a reliable `engine:idle` and `engine:start` signal (if 
  not already present).

### DT 7 — Runtime config fetch
Load tunables dynamically without dirtying git.

### DT 8 - Look into ANSI font codes
Codes to change font family (required invariant: all fonts must be the same calculated size)

### DT 8 — Render string-build optimization
Replace O(n²) string concatenation with array accumulation + join.

### DT 9 - Center the terminal in the viewport

---
