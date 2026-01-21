# Feature Tracks and Dev Tasks (PROJECT STRUCTURE)

Feature Tracks are **high-level phases** that represent small "milestones" along the path to completed features. Each feature maintains its own internal versioning scheme (vX.Y.Z; release.beta.alpha). Dev Tasks are steps to complete the next phase, and are not 1:1 with Git commits.

Dev Task numbering is project-global and does not correspond directly to Feature Implementation versions. It's loosely chronological and may skip or group numbers as planning evolves.

Optional higher-level milestones may be introduced later to group multiple Feature Tracks, but are not currently used.

## FT I. — Terminal-Based UI Rendering (v0.0.1)

## DT 1, 2, 3 (COMPLETE / OLD)

## DT3-5 — Engine sanity + lock-in (COMPLETE / BASELINE)
- Scheduler correctness
- Deadline-based capped FPS
- Idle stop correctness
- Double-scaling fix
- Deterministic frame invariants
- Perf harness stabilized

This dev task establishes a **safe rollback baseline**.

---

## DT3-6 — Engine refactor dev task (NEXT)

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

## DT3-7 — ES module reorganization

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

## DT4 — Writers
Output writer abstraction.

## DT5 — Evennia I/O
Evennia input/output integration.

## DT6 — Runtime config fetch
Load tunables dynamically without dirtying git.

## DT7 — Render string-build optimization
Replace O(n²) string concatenation with array accumulation + join.

---
