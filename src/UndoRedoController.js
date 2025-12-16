/**
 * UndoRedoController
 * Handles Ctrl+Z (undo) and Ctrl+Shift+Z (redo) functionality for Fabric.js canvas
 * Maintains a history stack of canvas states
 */

import { canvas } from './canvas.js';
import { register as registerEvent, unregisterAllForOwner } from './EventRegistry.js';
import { KeyboardController } from './KeyboardController.js';

class UndoRedoController {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.keydownHandler = null;
    // Start disabled; enable explicitly on app init so listeners are registered once
    this.isEnabled = false;
    this.maxStackSize = 50; // Maximum number of undo states to keep
    this.isRecording = true; // Flag to prevent recording during undo/redo
    this.saveTimeout = null; // Debounce timer for saving state
    this.debounceDelay = 500; // milliseconds to wait before saving
    // bound handler reference so we can remove listeners precisely
    this._boundCanvasModified = this.onCanvasModified.bind(this);
  }

  /**
   * Enable undo/redo functionality
   * Adds keyboard event listeners and starts tracking canvas changes
   */
  enable() {
    if (this.isEnabled) {
      console.log('[UndoRedo] Already enabled');
      return;
    }
    this.keydownHandler = this.handleKeydown.bind(this);
    // Register via KeyboardController so handlers are owner-scoped
    KeyboardController.register(this, this.keydownHandler);
    
    // Track canvas modifications
    this.setupCanvasListeners();
    
    // Save initial state
    this.saveState();
    
    this.isEnabled = true;
    console.log('[UndoRedo] Enabled (Ctrl+Z / Ctrl+Shift+Z)');
  }

  /**
   * Disable undo/redo functionality
   * Removes event listeners and clears history
   */
  disable() {
    if (!this.isEnabled) return;

    if (this.keydownHandler) {
      KeyboardController.unregister(this);
      this.keydownHandler = null;
    }
    
    this.removeCanvasListeners();
    this.undoStack = [];
    this.redoStack = [];
    this.isEnabled = false;
    console.log('[UndoRedo] Disabled');
  }

  /**
   * Setup canvas event listeners to track changes
   */
  setupCanvasListeners() {
    // Track object modifications (includes color, size, rotation changes)
    registerEvent(canvas, 'object:modified', this._boundCanvasModified, this);
    registerEvent(canvas, 'object:added', this._boundCanvasModified, this);
    registerEvent(canvas, 'object:removed', this._boundCanvasModified, this);
    // Track property changes that might not trigger object:modified
    registerEvent(canvas, 'object:scaling', this._boundCanvasModified, this);
    registerEvent(canvas, 'object:rotating', this._boundCanvasModified, this);
    registerEvent(canvas, 'object:skewing', this._boundCanvasModified, this);
  }

  /**
   * Remove canvas event listeners
   */
  removeCanvasListeners() {
    // Unregister any owner-scoped handlers registered via EventRegistry
    try {
      unregisterAllForOwner(this);
    } catch (e) { /* ignore */ }
  }

  /**
   * Handle canvas modification events
   */
  onCanvasModified() {
    if (this.isRecording) {
      // Debounce the save to avoid creating too many undo states
      // during rapid changes (like dragging sliders)
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this.saveState();
        this.saveTimeout = null;
      }, this.debounceDelay);
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeydown(e) {
    // Ignore key events from inputs/textareas or contenteditable elements
    try {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    } catch (err) { /* ignore */ }

    // Check for Ctrl+Z or Cmd+Z (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }
    // Check for Ctrl+Shift+Z or Cmd+Shift+Z for redo (do NOT accept Ctrl+Y)
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.redo();
    }
  }

  /**
   * Save the current canvas state to the undo stack
   */
  saveState() {
    if (!this.isRecording) return;

    const json = canvas.toJSON([
      'perPixelTargetFind',
      'targetFindTolerance',
      'objectCaching',
      'hasControls',
      'hasBorders',
      'selectable',
      'evented',
      'hoverCursor',
      '_lastPos'
    ]);

    // Wrap the canvas JSON together with the current URL hash so undo/redo can restore lesson navigation
    const wrapper = {
      canvas: json,
      hash: (typeof location !== 'undefined' && location.hash) ? location.hash : ''
    };

    this.undoStack.push(JSON.stringify(wrapper));
    
    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    // Clear redo stack when a new action is performed
    this.redoStack = [];
  }

  /**
   * Undo the last action
   */
  undo() {
    if (this.undoStack.length <= 1) {
      console.log('[UndoRedo] Nothing to undo');
      return;
    }

    // Clear any pending save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Stop recording during undo
    this.isRecording = false;

    // Move current state to redo stack
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);

    // Load previous state
    const previousState = this.undoStack[this.undoStack.length - 1];
    this.loadState(previousState);

    console.log('[UndoRedo] Undo performed');
  }

  /**
   * Redo the last undone action
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log('[UndoRedo] Nothing to redo');
      return;
    }

    // Clear any pending save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Stop recording during redo
    this.isRecording = false;

    // Move state from redo to undo stack
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);

    // Load next state
    this.loadState(nextState);

    console.log('[UndoRedo] Redo performed');
  }

  /**
   * Load a canvas state from JSON
   */
  loadState(stateJson) {
    const parsed = JSON.parse(stateJson);
    // Support legacy format (raw canvas JSON) and new wrapper format { canvas, hash }
    const canvasState = (parsed && parsed.canvas) ? parsed.canvas : parsed;
    const savedHash = (parsed && typeof parsed.hash !== 'undefined') ? parsed.hash : null;

    canvas.clear();
    canvas.loadFromJSON(canvasState, () => {
      canvas.requestRenderAll();

      // Restore URL hash if present in the saved state. Use replaceState to avoid adding extra history
      try {
        if (savedHash !== null && savedHash !== undefined) {
          history.replaceState(null, '', savedHash);
          // Notify listeners that the hash changed so lessons update accordingly
          try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }

      // Resume recording after a short delay
      setTimeout(() => {
        this.isRecording = true;
      }, 100);
    });
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    console.log('[UndoRedo] History cleared');
  }
}

// Export singleton instance
export const undoRedoController = new UndoRedoController();
