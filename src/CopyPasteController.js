/**
 * CopyPasteController
 * Handles Ctrl+C, Ctrl+V, Delete, and Backspace functionality for Fabric.js canvas objects
 * - Copy: Stores selected object's JSON representation
 * - Paste: Creates a new independent object from the stored data
 * - Delete: Removes selected objects from canvas
 * - Offset: Slightly offsets pasted objects so they don't overlap exactly
 */

import { canvas } from './canvas.js';
import { KeyboardController } from './KeyboardController.js';
import { Pasted, LockedFromDelete, LastPos } from './MetadataRegistry.js';

class CopyPasteController {
  constructor() {
    this.clipboard = null;
    this.isEnabled = false;
    this.pasteOffset = 10; // pixels to offset pasted objects
  }

  /**
   * Enable copy-paste functionality
   * Adds keyboard event listeners for Ctrl+C, Ctrl+V, Delete, and Backspace
   */
  enable() {
    if (this.isEnabled) {
      console.log('[CopyPaste] Already enabled');
      return;
    }
    KeyboardController.register(this, this.handleKeydown.bind(this));
    this.isEnabled = true;
    console.log('[CopyPaste] Enabled (Ctrl+C / Ctrl+V / Delete / Backspace)');
  }

  /**
   * Disable copy-paste functionality
   * Removes keyboard event listeners and clears clipboard
   */
  disable() {
    if (!this.isEnabled) return;
    KeyboardController.unregister(this);
    this.clipboard = null;
    this.isEnabled = false;
    console.log('[CopyPaste] Disabled');
  }

  /**
   * Handle keyboard events
   */
  handleKeydown(e) {
    // Check for Ctrl+C or Cmd+C (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this.copy();
    }
    // Check for Ctrl+V or Cmd+V (Mac)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      this.paste();
    }
    // Check for Delete or Backspace
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Only delete if not typing in an input field
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return; // Let the default behavior happen in input fields
      }
      e.preventDefault();
      this.delete();
    }
  }

  /**
   * Copy the currently selected object to clipboard
   */
  copy() {
    const activeObject = canvas.getActiveObject();
    
    if (!activeObject) {
      console.log('[CopyPaste] No object selected to copy');
      return;
    }

    // For ActiveSelection (multiple objects selected), we need special handling
    if (activeObject.type === 'activeSelection') {
      // Get the objects in the selection
      const selectedObjects = activeObject.getObjects();
      
      // Calculate the bounding box of the entire selection
      const boundingRect = activeObject.getBoundingRect(true);
      
      // Create a temporary group for serialization (without modifying the canvas)
      const tempGroup = new fabric.Group(selectedObjects.map(obj => {
        // Clone each object for the temp group
        return fabric.util.object.clone(obj);
      }));
      
      // Serialize the temporary group
      this.clipboard = tempGroup.toObject([
        'perPixelTargetFind',
        'targetFindTolerance',
        'objectCaching',
        'hasControls',
        'hasBorders',
        'lockMovementX',
        'lockMovementY',
        'lockRotation',
        'lockScalingX',
        'lockScalingY',
        'selectable',
        'evented',
        'hoverCursor'
      ]);
      
      // Store the absolute bounding box for positioning
      this.clipboard._absoluteLeft = boundingRect.left;
      this.clipboard._absoluteTop = boundingRect.top;
      this.clipboard._type = 'group';
      
      console.log('[CopyPaste] Copied ActiveSelection as Group:', selectedObjects.length, 'objects at', boundingRect.left, boundingRect.top);
      
      // Important: Don't change the canvas, leave the selection as-is
      return;
    }

    // For single objects or already-grouped objects
    const boundingRect = activeObject.getBoundingRect(true);
    
    // Serialize the object to JSON with all current properties
    this.clipboard = activeObject.toObject([
      'perPixelTargetFind',
      'targetFindTolerance',
      'objectCaching',
      'hasControls',
      'hasBorders',
      'lockMovementX',
      'lockMovementY',
      'lockRotation',
      'lockScalingX',
      'lockScalingY',
      'selectable',
      'evented',
      'hoverCursor'
    ]);
    
    // Store the absolute bounding box for positioning
    this.clipboard._absoluteLeft = boundingRect.left;
    this.clipboard._absoluteTop = boundingRect.top;
    this.clipboard._type = activeObject.type;
    
    console.log('[CopyPaste] Copied object:', activeObject.type, 'absolute pos:', boundingRect.left, boundingRect.top);
  }

  /**
   * Paste the clipboard object to canvas
   * Creates a new independent object offset from the original
   */
  paste() {
    if (!this.clipboard) {
      console.log('[CopyPaste] Clipboard is empty');
      return;
    }

    // Deselect current selection
    canvas.discardActiveObject();

    // Calculate the new position with offset using absolute coordinates
    const newAbsoluteLeft = this.clipboard._absoluteLeft + this.pasteOffset;
    const newAbsoluteTop = this.clipboard._absoluteTop + this.pasteOffset;

    // Reconstruct the object from JSON
    fabric.util.enlivenObjects([this.clipboard], (objects) => {
      if (!objects || objects.length === 0) {
        console.error('[CopyPaste] Failed to create object from clipboard');
        return;
      }

      const clonedObj = objects[0];
      
      // For groups loaded from SVG, we need to handle the coordinate system carefully
      if (clonedObj.type === 'group' && clonedObj._objects) {
        // First add to canvas so Fabric can calculate proper coordinates
        canvas.add(clonedObj);
        
        // Get the current bounding rect
        const currentBoundingRect = clonedObj.getBoundingRect(true, true);
        
        // Calculate where we want it
        const targetCenterX = newAbsoluteLeft + currentBoundingRect.width / 2;
        const targetCenterY = newAbsoluteTop + currentBoundingRect.height / 2;
        
        // Groups are positioned by their center, so set the center position
        clonedObj.set({
          left: targetCenterX,
          top: targetCenterY
        });
        
      } else {
        // For non-group objects, use the simpler approach
        const currentBoundingRect = clonedObj.getBoundingRect(true);
        const deltaLeft = newAbsoluteLeft - currentBoundingRect.left;
        const deltaTop = newAbsoluteTop - currentBoundingRect.top;
        
        clonedObj.set({
          left: clonedObj.left + deltaLeft,
          top: clonedObj.top + deltaTop
        });
        
        canvas.add(clonedObj);
      }

      // Initialize _lastPos for linked movement if needed
      LastPos.set(clonedObj, { left: clonedObj.left, top: clonedObj.top });
      
      // Update coordinates
      clonedObj.setCoords();
      
      // Ensure the pasted copy is movable/selectable even if the original was locked.
      try {
        clonedObj.set({ lockMovementX: false, lockMovementY: false, selectable: true, evented: true });
        if (clonedObj._objects && Array.isArray(clonedObj._objects)) {
          clonedObj._objects.forEach(o => o.set({ lockMovementX: false, lockMovementY: false, selectable: true, evented: true }));
        }
      } catch (err) {
        console.warn('[CopyPaste] Could not unlock pasted object:', err);
      }

      // Mark this object as a pasted copy so lesson logic can treat it specially
      try {
        Pasted.set(clonedObj, true);
      } catch (err) {
        // ignore
      }

      // Select the newly pasted object
      canvas.setActiveObject(clonedObj);
      
      // Update clipboard absolute position for the next paste
      this.clipboard._absoluteLeft = newAbsoluteLeft;
      this.clipboard._absoluteTop = newAbsoluteTop;
      
      canvas.requestRenderAll();
      console.log('[CopyPaste] Pasted object:', clonedObj.type, 'at absolute', newAbsoluteLeft, newAbsoluteTop);

      // Trigger selection events so the Fill & Stroke panel updates
      canvas.fire('selection:created', { 
        selected: [clonedObj],
        target: clonedObj 
      });
    });
  }

  /**
   * Clear the clipboard
   */
  clear() {
    this.clipboard = null;
    console.log('[CopyPaste] Clipboard cleared');
  }

  /**
   * Delete the currently selected object(s) from the canvas
   */
  delete() {
    const activeObject = canvas.getActiveObject();
    
    if (!activeObject) {
      console.log('[CopyPaste] No object selected to delete');
      return;
    }

    // Handle ActiveSelection (multiple objects selected)
    if (activeObject.type === 'activeSelection') {
      const objects = activeObject.getObjects().slice(); // Clone array
      canvas.discardActiveObject();
      let deleted = 0;
      let skipped = 0;
      objects.forEach(obj => {
        try {
          if (obj && LockedFromDelete.has(obj)) {
            skipped++;
            console.log('[CopyPaste] Skipped deletion of locked object:', obj.type || obj);
            return;
          }
        } catch (e) { /* ignore */ }
        canvas.remove(obj);
        deleted++;
      });
      console.log('[CopyPaste] Deleted', deleted, 'objects', skipped ? `; skipped ${skipped} locked` : '');
    } else {
      // Single object
      try {
        if (activeObject && LockedFromDelete.has(activeObject)) {
          console.log('[CopyPaste] Skipped deletion of locked object:', activeObject.type);
        } else {
          canvas.remove(activeObject);
          console.log('[CopyPaste] Deleted object:', activeObject.type);
        }
      } catch (e) {
        console.warn('[CopyPaste] Error during delete:', e);
      }
    }
    
    canvas.requestRenderAll();
  }
}

// Export singleton instance
export const copyPasteController = new CopyPasteController();
