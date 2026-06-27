---
type: Added
title: Undo/redo keyboard shortcuts
---

A `useUndoRedoShortcuts` hook (in `/hooks`) binds the global undo/redo chords — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, and Ctrl+Y — to a document-level history. It owns the keyboard wiring only (you pass `canUndo`/`canRedo` and the `onUndo`/`onRedo` steppers from your store), bails out while focus is inside an editable element so native field undo keeps working, and takes an `enabled` flag to silence the shortcuts while another surface (an open drawer) owns the keyboard.
