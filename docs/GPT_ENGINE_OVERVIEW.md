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

- `requestFrame(commands, reason="")` is the **only** public entry point.
- Each call requests **exactly one engine frame**.
- A frame consists of:
  1. executing the submitted command list in-order
  2. rendering exactly once
  3. incrementing `frameNo`
  4. emitting `frameComplete`
- The engine does not expose any other wake, staging, or scheduling mechanisms.

#### 3.1.1 Frame request shape (CURRENT)

- The engine operates exclusively on **FrameCommandList**: an ordered list of command objects.
- Current command set (MVP):
  - `drawRect`: rectangular write into the framebuffer using ANSI SGR handling
  - `hold`: a frame-level guarantee (pacing/no-op frame). Must be the only command in the request.
- Command-type switching exists in the engine today (MVP scope). This is expected to evolve as input/control
  commands are introduced, and as rendering dispatch migrates further into the renderer module.

**Note (DT 3.7 modularization):**
- Framebuffer allocation and DOM surface binding live in `renderer.js`.
- `TerminalEngine` initializes the renderer at construction time (single-instance invariant) and obtains the
  framebuffer via `getFramebuffer()` for frame execution.

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

### 3.4 Engine events
The engine emits minimal lifecycle signals for external coordination:
- The engine exposes a single lifecycle signal: frame completion.
Consumers subscribe to frame completion and inspect engine state directly.
- There is no general event bus and no explicit idle/start events.
The engine becoming idle is defined structurally as the scheduler stopping when no pending work remains.
- Performance metrics are currently driver-owned, not engine-owned

---

## 4. Scaling model (CURRENT, UI-owned)

- `#terminalRoot` defines **layout size** (scaled dimensions).
- `#termSurface` defines **visual surface** (native size + transform).
- Scaling is applied only when integer `k` changes.
- No scale reporting when `k` is unchanged.
- Initial scale always applies (even at k=1).

---

## 5. Design philosophy

- Correctness > cleverness
- Determinism > convenience
- No background work when idle
- UI concerns do not leak into engine logic
- Refactors happen **after** behavior is locked

---

## 6. Open notes

- This document should be updated when invariants change.

---
