# Refactoring Plan — Inkscape Mouse Tutorial

## Purpose
This document is a concrete, prioritized blueprint for Phase 3: incremental, file-by-file refactors. The goals are to remove fragile ad-hoc patterns, stabilize lifecycle management (listeners/animations), reduce memory/cpu cost of undo, and make the codebase easier to maintain and test.

## High-level goals & principles
- Prioritize safety: small, reversible changes with tests where possible.
- Centralize cross-cutting concerns (events, keyboard, metadata, animations).
- Replace object-attached ad-hoc metadata with external registries (`WeakMap`).
- Ensure every module registers listeners and exposes a deterministic cleanup.
- Reduce undo memory impact by making it diff/command-based or lowering snapshot frequency.

## Scope & priorities
Priority order (do earlier items first):
1. Centralize event listener lifecycle (EventRegistry) and migrate all `canvas.on`/`window` listeners to it.
2. Migrate object metadata (`_isPasted`, `_lockedFromDelete`, `_lastPos`, etc.) into `WeakMap` registries.
3. Centralize keyboard shortcuts handling (single KeyboardController) and remove multiple ad-hoc key handlers.
4. Harden undo/redo: reduce snapshot frequency and prepare an incremental/command-backed approach.
5. Audit animations and ensure `AnimationController` covers every running animation; remove per-module frame loops.
6. Per-lesson: enforce deterministic `start`/`cleanup` contract and verify cleanup removes listeners/animations.
7. Add lightweight unit/integration checks to validate canvas state after lesson restart/cleanup.

## New small utilities to add
- `src/EventRegistry.js` — exports `register`, `unregisterAllForOwner(owner)`, and `removeAll()`.
- `src/MetadataRegistry.js` — simple exports for `createObjectMetadataMap(name)` returning `{get, set, has, delete}` wrapping a `WeakMap`.
- `src/KeyboardController.js` — centralized keyboard registration with owner-scoped handlers.
- `src/UndoStrategy.md` — design doc for migrating undo to commands (optional separate doc).

## File-by-file plan (actions to perform per file)

- `src/AnimationController.js`
  - Ensure it exposes `registerAnimation(owner, id, cancelFn)` and `stopAnimationsFor(owner)`.
  - Where animations are started elsewhere, move registration calls to AnimationController.

- `src/AssetLoader.js`
  - Keep as-is; verify it has no stray listeners. No immediate change required.

- `src/CopyPasteController.js`
  - Replace `_isPasted` on objects with `MetadataRegistry.isPasted.set(obj, true)`.
  - Move keyboard handlers registration into `KeyboardController`.
  - Ensure paste uses `EventRegistry` for any canvas listeners and owner-scoped cleanup.

- `src/PenToolController.js`
  - Migrate any `canvas.on` bindings to `EventRegistry.register(canvas, event, handler, owner)`.
  - Keep pen state local to controller; store per-object metadata (if needed) in `WeakMap`.

- `src/ShapeDrawingController.js`
  - Same as `PenToolController`: move listeners to `EventRegistry`; remove ad-hoc global state.

- `src/UndoRedoController.js`
  - Add configuration to throttle snapshot saves and a `saveMode` toggle: `snapshot` vs `incremental`.
  - Implement dedup debounce (e.g., 500ms) and limit max history entries.
  - Mark TODO for future command/diff migration and add `UndoStrategy.md` placeholder.

- `src/FillStrokePanel.js`
  - Remove any direct `document` keyboard or mouse listeners; use `EventRegistry` if needed.

- `src/InkscapeTransformMode.js`
  - Extract and centralize any per-object flags into `MetadataRegistry`.
  - Ensure `enterNodeEditMode` returns an object that can be used by caller to `cleanup()`.
  - Replace direct control of `canvas.on` with owner-scoped `EventRegistry` registrations.

- `src/tutorial.js` and `src/Lesson1.js` .. `src/Lesson6.js`
  - For each lesson file: identify all `canvas.on`, `window` and `document` listeners and replace with `EventRegistry.register(..., owner=lessonState)`.
  - Ensure `cleanup()` calls `EventRegistry.unregisterAllForOwner(lessonState)` and `AnimationController.stopAnimationsFor(lessonState)`.
  - Replace direct ad-hoc properties on objects with `MetadataRegistry` usage.
  - Add small integration test that `start()` then `cleanup()` leaves no registered listeners and no running animations.

- `src/utils.js`, `src/constants.js`
  - `utils` can host small helper wiring to create `WeakMap` registries; `constants` remains read-only.

- `src/CopyPasteController.js` and `src/UndoRedoController.js` (again)
  - After WeakMap migration, verify delete logic checks `MetadataRegistry.isLocked.has(obj)` instead of `_lockedFromDelete`.

## Migration approach and coding patterns
- Owner-scoped registration: every registration call should pass an `owner` object (usually the lesson state or controller instance). Example API:

```js
// EventRegistry.js (concept)
function register(target, eventName, handler, owner) { /* store tuple in internal list */ }
function unregisterAllForOwner(owner) { /* remove all handlers associated with owner */ }
```

- WeakMap metadata example:

```js
// MetadataRegistry.js (concept)
const isPasted = new WeakMap();
export const Pasted = { set: (obj, v) => isPasted.set(obj, v), get: (obj) => !!isPasted.get(obj) };
```

Replace `obj._isPasted = true` with `Pasted.set(obj, true)`.

## Testing and verification
- Add a small test helper `tests/verify_cleanup.js` to simulate `start()`/`cleanup()` for a lesson and assert no listeners/animations remain.
- Manual test checklist per refactor step:
  - Start lesson, interact, trigger success flow.
  - Call `cleanup()` and check console for no leftover `object:moving` or `window` listeners.
  - Run `UndoRedoController` boundary test (many modifications) to validate memory usage.

## Rollout strategy
1. Implement `EventRegistry.js`, `MetadataRegistry.js`, `KeyboardController.js` as isolated changes with unit tests.
2. Migrate low-risk modules (`CopyPasteController`, `PenToolController`, `ShapeDrawingController`).
3. Migrate lessons, one lesson at a time; run verification after each.
4. Harden `UndoRedoController` last, switching snapshot frequency first, then exploring command/diff.

## Backout plan
- Each file change is staged in a single commit per file. If a refactor causes regression, revert the commit for that file and restore behavior.

## Timeline (rough)
- Day 1: Add registries (`EventRegistry`, `MetadataRegistry`, `KeyboardController`) and tests.
- Day 2–3: Migrate controllers and `UndoRedoController` snapshot throttling.
- Day 4–6: Migrate lessons one-by-one and run integration checks.

## Next immediate developer actions (what I'll do next if you approve)
1. Create `src/EventRegistry.js` and `src/MetadataRegistry.js` and a minimal `KeyboardController.js` scaffold.
2. Migrate `CopyPasteController.js` to use `MetadataRegistry` and `KeyboardController`.
3. Run the per-file verification for `CopyPasteController` and report results.

---
If you'd like, I can start by implementing the registries now and migrating a single low-risk file (`src/CopyPasteController.js`) as a demo. Which file should I refactor first?
