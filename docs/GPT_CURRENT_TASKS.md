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

### DT 3.5.5 — More perf content (SKIPPED/DEFERRED)

Goal: Add more perf content so that future tasks are easier to test.

This goal wasn't achieved because moving the performance system itself happened across DT 3.6 and 3.7, so it was not 
available for testing until after the refactors.

### DT 3.6 — Engine refactor dev task (COMPLETE)

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

### DT 3.7 — ES module reorganization (COMPLETE)

Goal: refactor monolithic code into clean ES modules **after engine contracts are stable**.

Expected splits (prediction):
- config
- CP437
- SGR parsing / writing
- framebuffer ops
- HTML rendering
- UI scaling + reporting
- engine core
- boot / startup wiring

Actual splits (committed):
- main
- config
- log
- dom_utils
- ansi
- engine
- rendering
- animation
- ui
- boot_assets

---

### DT 4 — More perf content (COMPLETE)

#### Goal
Add additional performance test content now that the performance system,
drivers, and engine contracts are stable.

This task exists to improve confidence and observability for future feature
work, not to change engine behavior.

#### Background
This task was originally planned as DT 3.5.5 but was skipped at the time because
the performance system itself was moved and finalized across DT 3.6 and DT 3.7.
As a result, there was no stable surface available for adding meaningful perf
coverage.

With the engine refactor and ES module reorganization complete, perf drivers are
now available and suitable for extension.

#### Constraints
- No changes to engine behavior or invariants
- No new scheduling policies
- Perf remains driver-owned, not engine-owned
- This task must not introduce engine-side conditionals for testing

### DT 5 — Output Writers + Evennia I/O Integration (CURRENT)

#### Goal
Introduce an output writer abstraction and integrate Evennia input/output using
that abstraction, without leaking Evennia-specific logic into the engine.

These two concerns are treated as a single dev task because they are
co-dependent and cannot be meaningfully validated in isolation.

#### Scope
- Define a writer abstraction for terminal output
- Route engine frame output through writers rather than direct sinks
- Implement an Evennia-specific writer / adapter
- Integrate Evennia output as an external data source
- Integrate Evennia input submission without affecting engine scheduling

#### Constraints
- No Evennia-specific logic inside:
  - engine core
  - scheduler
  - framebuffer mutation
- Writers must operate on engine-defined boundaries (frame-complete, output-ready)
- No implicit background polling or hidden loops
- Engine invariants remain unchanged

#### Notes
- This task establishes the primary I/O boundary for DreamNET
- Writer abstraction must be validated by real Evennia integration, not
  speculative design
- Animation, buffering, and input gating policies are explicitly out of scope
  and handled in later dev tasks

### DT 6 — Webclient input → DreamNET server → Evennia (MVP)

#### Goal
Implement the **client-side input path** and server forwarding so a player can
type a line in the DreamNET webclient and have it reach Evennia reliably.

This task completes the “I” side of DreamNET I/O. Output correctness + layout
were handled in DT5.

#### Scope
- Add a minimal input UI surface (single-line prompt)
- Capture user text + submit on Enter
- Add a DreamNET input bridge parallel to output ingest:
  - `window.dreamnet.input.submit(line, meta?)`
- Send submitted lines to the DreamNET server using the existing transport
- Forward server-side to Evennia in the correct format
- Define explicit local echo policy (no accidental duplicates)

#### Behavior
- User types into a prompt input.
- Enter submits exactly one command line.
- Submitted line is delivered to DreamNET server immediately (no idle gating).
- Client clears the prompt after submit (unless echo policy requires otherwise).
- Transport failures are surfaced (DEV logging is sufficient for A1).

#### Notes / Constraints
- This task is NOT the “await buffer.” Do not idle-gate input here.
- Keep input logic out of engine scheduling; use engine only as a consumer of
  output frames, not as an input clock.
- DT6 should not require Evennia ANSI output changes.

---

### DT 6.5 — Input await buffer with idle-gated flush (polish / optional)

#### Goal
Add a client-side **input await buffer** so submitted player commands are sent to
Evennia only when the terminal engine becomes idle, flushing **one command per
idle**.

This is polish unless latency / sequencing issues make it necessary for usability.

#### Behavior
- On Enter/Submit:
  - If not awaiting idle: store submitted line in `pendingInput` (size 1).
  - Enter “limited input mode”: disable prompt typing and visually indicate lock.
- On each `engine:idle`:
  - If `pendingInput` is non-empty, send it and clear the buffer.
  - Unlock the prompt and exit limited input mode.

#### Notes / Constraints
- Locking happens only while awaiting an idle-triggered flush.
- Keep this independent of animation logic.
- Engine changes (if any) must be limited to exposing a reliable `engine:idle`
  signal (and `engine:start` if needed for UI state).

---

### DT 7 — Runtime config fetch
Load tunables dynamically without dirtying git.

---

### DT 8 - Look into ANSI font codes
Codes to change font family (required invariant: all fonts must be the same calculated size)

---

### DT 8 — Render string-build optimization
Replace O(n²) string concatenation with array accumulation + join.

---

### DT 9 - Center the terminal in the viewport

---
