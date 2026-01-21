# Current Feature Tracks and Dev Tasks (MEDIUM TERM PROJECT STRUCTURE)

Feature Tracks are **high-level phases** that represent small "milestones" along the path to completed features. 
Each feature maintains its own internal versioning scheme Ax By Rz (alpha, beta, release). Dev Tasks are steps to 
complete the next phase, and are not 1:1 with Git commits.

Dev Task numbering is project-global and does not correspond directly to Feature Implementation versions. It's 
loosely chronological and may skip or group numbers as planning evolves.

For a higher level view of feature work that informs future planning of this structure, see ROADMAP.md in Github 
dreamnet/docs. 

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

### DT 3.6 — Engine refactor dev task (NEXT)

Goal: simplify and clarify the engine without changing behavior.

Checklist:
- Bake scheduling policy at construction
- Tighten `TerminalEngine` API surface
- Clarify staging / command semantics
- Decide fate of `shouldRunFrame`
- Extract perf into a generic driver abstraction
- Revisit `_tick` vs `_runOneFrame`
- Remove `requestFrame()` once drivers exist
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

---

### DT 4 — Writers
Output writer abstraction.

### DT 5 — Evennia I/O
Evennia input/output integration.

### DT 6 — Runtime config fetch
Load tunables dynamically without dirtying git.

### DT 7 — Render string-build optimization
Replace O(n²) string concatenation with array accumulation + join.

---
