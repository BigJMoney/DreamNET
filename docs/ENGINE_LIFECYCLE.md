# DreamNET Webclient — Engine Lifecycle & State Transitions

## Purpose

This document describes the **engine’s lifecycle**, **state transitions**, and the **allowed ways work enters and exits the frame loop**.

It exists to make refactors safer by explicitly documenting:

- what “running” means
- what “idle” means
- how staging interacts with the scheduler
- what constitutes “pending work”
- what is guaranteed to happen per frame
- what must never happen outside the frame loop

This document complements (and must not contradict) `ENGINE_OVERVIEW.md`.  
If a conflict exists, `ENGINE_OVERVIEW.md` is authoritative.

---

## Terminology

### Engine
The deterministic loop that:
1. drains staged work
2. mutates the framebuffer
3. renders exactly once  
…and stops completely when idle.

---

### Frame
A single deterministic execution cycle with a strict order:

1. **Drain staged commands / jobs**
2. **Apply framebuffer mutations**
3. **Render exactly once**
4. **Decide whether another tick is required**

No framebuffer mutation is permitted outside a frame.

---

### Staged work
Work that has been queued for application on a future frame.

Rules:
- Staging must not directly mutate the framebuffer
- Staging may occur from any async context
- Staging is the primary wake mechanism for the engine

---

### Pending work
The engine is considered to have pending work if **any** of the following are true:

- staged jobs / commands exist
- a temporary driver (e.g. perf harness) indicates more work is required
- other explicit engine-owned queues exist (if applicable)

> **DT3-6 update point:** redefine “pending work” precisely once the engine API and driver abstraction are finalized.

---

## Engine state model

The engine is described as a small, explicit state machine.

---

### States

#### IDLE
- `running === false`
- No scheduled callback in flight
- No timers
- No `requestAnimationFrame` callbacks pending
- Engine performs no work

The engine remains idle until explicitly woken by staged work.

---

#### RUNNING
- `running === true`
- Exactly **one** scheduler callback in flight
- Engine will execute frames until no pending work remains

> **Locked invariant:** at most one scheduled callback may exist at any time.

---

## State transitions

### IDLE → RUNNING (wake)

Occurs **only** when work is staged via a public entrypoint.

Wake semantics:
- set `running = true`
- reset scheduler bookkeeping as required
- schedule the first tick according to FPS policy

Expected logging:
- `[frame] wake: <reason>`
- `[sched] schedule first tick: <mode>`

> **DT3-6 update point:** document the single blessed wake API once legacy entrypoints are removed or consolidated.

---

### RUNNING → IDLE (stop)

Occurs only after a frame completes and **no pending work remains**.

Stop semantics:
- cancel or clear all scheduler state
- ensure “no callbacks in flight” invariant is restored
- set `running = false`

Expected logging:
- `[frame] idle; stop loop`
- `[sched] cleared`

No background work may continue after this transition.

---

## Scheduler interaction

The scheduler is an implementation detail of the RUNNING state.

Rules:
- The scheduler may use rAF, timers, or deadlines depending on FPS policy
- The scheduler must never enqueue more than one callback
- Scheduler state must be fully reset on transition to IDLE

The engine does **not** tick “just in case”.

---

## Wake mechanisms

### Primary mechanism: staging (current)

Staging work is the **only supported way** to wake the engine.

Requirements:
- staging is safe from any async context
- staging does not mutate framebuffer state
- staging is observable via logs

Legacy mechanisms may exist temporarily but are not considered part of the long-term contract.

> **DT3-6 update point:** remove or formally deprecate legacy wake paths (e.g. `requestFrame()`), and update this section accordingly.

---

## Frame guarantees

For every executed frame:

- staged work is drained exactly once
- framebuffer mutations occur only during the frame
- rendering occurs **exactly once**
- post-frame logic decides whether another tick is required

No frame may:
- render more than once
- mutate framebuffer state outside the frame body
- leave scheduler state ambiguous

---

## Logging expectations

Logs serve as an **execution trace**, not just error reporting.

At minimum, logs should make it possible to determine:

- why the engine woke
- when the loop started
- when and why it stopped
- whether a frame was scheduled, skipped, or run immediately

Refactors must preserve or improve trace clarity.

---

## Living document note

This document must be reviewed and updated after **DT3-6** completes to ensure:

- terminology matches the refactored API
- wake mechanisms are accurate
- driver abstractions are reflected correctly

Behavioral changes that affect lifecycle semantics **must** be recorded here.
