# DreamNET — Project Overview & Working Conventions

This document captures context for the DreamNET project:
- integration assumptions
- project-level goals
- working conventions and preferences

Engine behavior, invariants, and technical contracts are documented elsewhere. This file exists to reduce context loss across time, tools, and collaborators.

All docs are stored in this project's Github page at (...) in dreamnet/docs. Markdown docs for the Chat GPT Project are 
prefixed with GPT_*, and will be kept up to date in both the GPT project and Github. 

---

## 1. Project context

### 1.1 DreamNET + Evennia relationship
- The engine and UI must not gate initialization on websocket connection state.
- Rendering and scheduling logic should be deterministic regardless of network readiness.
- Evennia I/O is treated as an external data source, not a controlling authority.

> In practice, development and testing are performed with a running Evennia server,
> which provides core web assets and infrastructure.

---

### 1.2 Integration philosophy
- Evennia integration is **explicit and layered**.
- No Evennia-specific logic should leak into:
  - core rendering logic
  - scheduling
  - framebuffer mutation
- Adapters / writers are preferred over direct coupling.

This keeps DreamNET usable as:
- a standalone terminal renderer
- a test harness
- a reusable component

---

## 2. Development workflow assumptions

### 2.1 Dev Tasks vs commits
- **Dev Tasks** represent conceptual phases (engine refactor, writers, I/O, etc.).
- Git commits are free-form and may occur:
  - multiple times per dev task
  - between checklist items
- Dev Tasks are *planning artifacts*, not version-control events.

---

### 2.2 Refactors happen after behavior is locked
- Behavior is stabilized first.
- Refactors are deferred until:
  - invariants are explicit
  - failure modes are understood
- Large structural changes (e.g. ES module split) are intentionally postponed until contracts settle.

---

### 2.3 Documentation is authoritative
- Markdown documents in the project are **canonical references**.
- Chat discussions are exploratory and disposable.
- If a design decision matters long-term, it should be written down.

> When in doubt, docs win over chat memory.

### 2.4 Post–Dev Task documentation review

After completing each Dev Task, a brief documentation review is performed to determine whether markdown updates are required.

This review explicitly records:
- which documents were checked
- whether changes were made

A “no changes required” outcome is valid and should be noted.

This ritual exists to ensure that markdown documents remain the authoritative record of project state as refactors and feature work progress.

---

## 3. Coding and review preferences

These are **personal working conventions** used throughout the project.

### 3.1 Preference for explicitness over cleverness
- Clear state transitions are preferred over compact abstractions.
- Readability and traceability matter more than minimal code size.
- “Boring but obvious” is a feature.

---

### 3.2 Logging philosophy
- Logs are used as **execution trace**, not just error reporting.
- Key lifecycle events should log:
  - when loops start
  - when they stop
  - why work is scheduled
- Async or deferred behavior should be observable in logs.

---

### 3.3 Dislike of hidden background behavior
- No implicit background loops.
- No silent timers.
- No work happening “just in case”.

If something runs, it should be:
- explicitly requested
- observable
- stoppable

---

### 3.4 Guardrails over defensive clutter
- Code is written under **explicit invariants**.
- If an invariant is violated, that’s a bug to fix — not something to paper over with redundant checks.
- Redundant safety code is avoided unless it protects against *known* failure modes.

---

## 4. Tooling and collaboration expectations

### 4.1 ChatGPT’s role
- ChatGPT is treated as:
  - a design reviewer
  - a refactor assistant
  - a documentation co-author
- It is **not** trusted to remember code or architecture unless it is written into project files.

---

### 4.2 Preferred interaction style
- Point out real issues directly.
- Avoid speculative “what if” changes that violate stated constraints.
- Respect decisions once they are locked and documented.

---

## 5. Scope boundaries (non-engine)

Out of scope for this document:
- scheduler semantics
- rendering invariants
- framebuffer rules
- scaling contracts

The above are specific items that belong in engine-specific documentation, but the principle applies to any area of specific feature design and implementation.

---

## 6. Living document note

This document may evolve as:
- integration scope grows
- collaboration expands
- tooling changes

Updates should reflect **actual practice**, not aspirational rules.

---
