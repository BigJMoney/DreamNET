# DreamNET Webclient — Engine Overview

It defines:
- engine invariants that must not be violated
- the current execution model
- what is locked

---

## 1. High-level goal

DreamNET Webclient is a **deterministic, framebuffer-first terminal renderer**.

The engine’s job is to:
- apply staged work to a fixed-size framebuffer
- render exactly once per frame
- run only when work exists
- stop completely when idle

Presentation (scaling, DOM layout, reporting) is explicitly **not** an engine concern long-term.

---

## 2. Core invariants (LOCKED)

These are non-negotiable unless this document is revised.

### 2.1 Fixed grid
- Terminal grid size (`cols`, `rows`) is fixed at construction.
- Browser resize **must not** change grid dimensions.
- No dynamic reflow of rows/cols.

### 2.2 Deterministic cell metrics
- CP437-compatible glyph set.
- Fixed cell width/height measured once at k=1.
- Font size, line-height and spacing are immutable
- No fractional or per-cell scaling.

### 2.3 Integer-only UI scaling
- UI scale factor `k ∈ {1,2,3,…}`.
- Scaling is **visual only**.
- Engine logic is scale-agnostic.

### 2.4 Frame model
- A “frame” consists of:
  1. draining staged commands
  2. mutating the framebuffer
  3. rendering exactly once
- **No framebuffer mutation outside the frame loop.**
- **Exactly one render per frame.**

### 2.5 Scheduler invariants
- At most **one scheduled callback** (rAF or timer) in flight.
- Loop **stops completely when idle**.
- Loop starts only via explicit work staging.
- No background ticking.

### 2.6 FPS policy
- `fps` is immutable after construction.
- `fps = 0` → event-driven (rAF only when requested). Only permitted  dev and testing.
- `fps > 0` → capped cadence using deadline-based scheduling. Shipped builds always have a cap (authoritative mode)
- Being exactly on-time (`nextFrameDue === now`) runs immediately.
- No artificial frame skipping.

---

## 3. Engine execution model (CURRENT)

### 3.1 Entry points (Public API)
- `requestFrame(frameRequest, reason)` will be the **only** public entry point.
- `stageJob(...)` is being removed as part of the DT 3.6 refactor.
- A frame request represents **exactly one frame**: apply work to framebuffer + render once.
- Each call to `requestFrame` requests **exactly one frame**. A frame consists of:
  - applying framebuffer mutations
  - rendering exactly once
- The payload is required for every call, even if it contains no patches.
- The engine does not expose any other wake, staging, or scheduling mechanisms.

#### 3.1.1 Frame request shape (CURRENT TARGET)
- The engine operates exclusively on **frames**, not jobs.
- A frame request is expressed as one or more **rectangular patches**. Each patch specifies:
  - position (`x`, `y`)
  - size (`w`, `h`)
  - content (`text`)
- A full-screen update is represented as a patch covering the entire terminal grid.
- There is no command-type switching inside the engine. Rectangular patching is the universal primitive.

### 3.2 Loop lifecycle
- Idle → no timers, no rAF, `running=false`
- First requested frame:
  - resets scheduler state
  - marks engine as running
  - schedules first tick
- When no pending work:
  - scheduler stops
  - all timing state cleared

### 3.3 Scheduler behavior
- Uncapped mode:
  - rAF
  - guarded to prevent accumulation
- Capped mode:
  - `nextFrameDue` deadline tracking
  - catch-up only when late
  - never schedule more than one timer

### 3.4 Engine events (CURRENT TARGET)
The engine emits minimal lifecycle signals for external coordination:
- `frame:complete` — emitted after a frame is rendered
- `engine:idle` — emitted when the scheduler stops due to no pending work

These events were chosen as an alternative to a Promise-based coordination solution, and enable reactive drivers.

---

## 4. Scaling model (CURRENT, UI-owned)

- `#terminalRoot` defines **layout size** (scaled dimensions).
- `#termSurface` defines **visual surface** (native size + transform).
- Scaling is applied only when integer `k` changes.
- No scale reporting when `k` is unchanged.
- Initial scale always applies (even at k=1).

> Note: scaling logic will be fully removed from the engine in a later dev task.

---

## 5. Perf harness (CURRENT)

- Perf is currently embedded in the engine as a temporary driver.

> This will be removed from the engine and replaced with an external **animation driver**.

### 5.1 Driver direction (CURRENT TARGET)
- Drivers do not own timing; they are paced by engine frames.
- Drivers request work by calling `requestFrame(...)`.
- The first driver is an **AnimationDriver** 
- It will initially support a 'commit resolve' mode only; i.e. it will not cache any frames before the animation plays

---

## 6. Design philosophy

- Correctness > cleverness
- Determinism > convenience
- No background work when idle
- UI concerns do not leak into engine logic
- Refactors happen **after** behavior is locked

---

## 7. Open notes

- Naming cleanup and entry-point unification deferred to DT 3.6.
- Module split deferred to DT 3.7 intentionally.
- This document should be updated when invariants change.

---
