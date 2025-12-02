/**
 * UndoRedoController
 * Handles Ctrl+Z (undo) and Ctrl+Y (redo) functionality for Fabric.js canvas
 * Maintains a history stack of canvas states
 */

import { canvas } from './canvas.js';

class UndoRedoController {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.keydownHandler = null;
    this.isEnabled = false;
    this.maxStackSize = 50; // Maximum number of undo states to keep
    this.isRecording = true; // Flag to prevent recording during undo/redo
    this.saveTimeout = null; // Debounce timer for saving state
    this.debounceDelay = 500; // milliseconds to wait before saving
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
    document.addEventListener('keydown', this.keydownHandler);
    
    // Track canvas modifications
    this.setupCanvasListeners();
    
    // Save initial state
    this.saveState();
    
    this.isEnabled = true;
    console.log('[UndoRedo] Enabled (Ctrl+Z / Ctrl+Y)');
  }

  /**
   * Disable undo/redo functionality
   * Removes event listeners and clears history
   */
  disable() {
    if (!this.isEnabled) return;

    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
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
    canvas.on('object:modified', this.onCanvasModified.bind(this));
    canvas.on('object:added', this.onCanvasModified.bind(this));
    canvas.on('object:removed', this.onCanvasModified.bind(this));
    
    // Track property changes that might not trigger object:modified
    canvas.on('object:scaling', this.onCanvasModified.bind(this));
    canvas.on('object:rotating', this.onCanvasModified.bind(this));
    canvas.on('object:skewing', this.onCanvasModified.bind(this));
  }

  /**
   * Remove canvas event listeners
   */
  removeCanvasListeners() {
    canvas.off('object:modified');
    canvas.off('object:added');
    canvas.off('object:removed');
    canvas.off('object:scaling');
    canvas.off('object:rotating');
    canvas.off('object:skewing');
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
    // Check for Ctrl+Z or Cmd+Z (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }
    // Check for Ctrl+Y or Cmd+Shift+Z (Mac)
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
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

    this.undoStack.push(JSON.stringify(json));
    
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
    const state = JSON.parse(stateJson);
    
    canvas.clear();
    canvas.loadFromJSON(state, () => {
      canvas.requestRenderAll();
      
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
