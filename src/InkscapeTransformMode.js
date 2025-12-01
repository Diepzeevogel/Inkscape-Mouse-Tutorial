/**
 * Inkscape-like Transform Mode Controller
 * 
 * Implements Inkscape's two-mode transformation behavior:
 * - First click: Scale/Resize mode (corner and edge handles)
 * - Second click: Rotation mode (rotation handles and center point)
 * 
 * Usage:
 *   import { enableInkscapeTransformMode } from './InkscapeTransformMode.js';
 *   enableInkscapeTransformMode(canvas);
 */

// Transform modes
const MODE = {
  SCALE: 'scale',
  ROTATE: 'rotate'
};

// Icon display size (in pixels)
const ICON_SIZE = 16;

// Track the current mode for each object
const objectModes = new WeakMap();

// Track the currently selected object to detect re-clicks
let currentSelectedObject = null;
let justSelected = false;  // Flag to prevent immediate toggle after selection

// Icon cache for custom handles
const iconCache = {
  scaleHandle: null,
  rotateHandle: null
};

/**
 * Load icon images for custom handles
 */
async function loadIcons() {
  return new Promise((resolve) => {
    let loadedCount = 0;
    const totalIcons = 2;
    
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === totalIcons) {
        console.log('[InkscapeTransformMode] Icons loaded successfully');
        resolve();
      }
    };
    
    // Load scale handle icon
    const scaleImg = new Image();
    scaleImg.onload = () => {
      iconCache.scaleHandle = scaleImg;
      checkComplete();
    };
    scaleImg.onerror = (e) => {
      console.error('[InkscapeTransformMode] Failed to load scale handle icon');
      checkComplete();
    };
    scaleImg.src = 'assets/icons/transform/arrow-scale-handle.svg';
    
    // Load rotate handle icon
    const rotateImg = new Image();
    rotateImg.onload = () => {
      iconCache.rotateHandle = rotateImg;
      checkComplete();
    };
    rotateImg.onerror = (e) => {
      console.error('[InkscapeTransformMode] Failed to load rotate handle icon');
      checkComplete();
    };
    rotateImg.src = 'assets/icons/transform/arrow-rotate-handle.svg';
  });
}

/**
 * Custom render function for scale handles with icon
 * @param {number} angle - Rotation angle in degrees
 */
function createScaleIconRenderer(angle) {
  return function(ctx, left, top, styleOverride, fabricObject) {
    const icon = iconCache.scaleHandle;
    if (!icon || !icon.complete) {
      // Fallback to default square rendering if icon not loaded
      const size = ICON_SIZE;
      ctx.save();
      ctx.fillStyle = fabricObject.cornerColor || '#000';
      ctx.fillRect(left - size/2, top - size/2, size, size);
      ctx.restore();
      return;
    }
    
    const size = ICON_SIZE;
    // Add object's rotation to the icon's base rotation
    const totalRotation = angle + (fabricObject.angle || 0);
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate((totalRotation * Math.PI) / 180);
    ctx.drawImage(icon, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
}

/**
 * Custom render function for rotation handles with icon
 * @param {number} angle - Rotation angle in degrees
 */
function createRotateIconRenderer(angle) {
  return function(ctx, left, top, styleOverride, fabricObject) {
    const icon = iconCache.rotateHandle;
    if (!icon || !icon.complete) {
      // Fallback to default square rendering if icon not loaded
      const size = ICON_SIZE;
      ctx.save();
      ctx.fillStyle = fabricObject.cornerColor || '#000';
      ctx.fillRect(left - size/2, top - size/2, size, size);
      ctx.restore();
      return;
    }
    
    const size = ICON_SIZE;
    // Add object's rotation to the icon's base rotation
    const totalRotation = angle + (fabricObject.angle || 0);
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate((totalRotation * Math.PI) / 180);
    ctx.drawImage(icon, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
}

// Preload icons
loadIcons();

/**
 * Custom rotation handler that rotates around the bounding box center
 */
function rotateAroundCenter(eventData, transform, x, y) {
  const target = transform.target;
  
  // Get the center of the bounding box
  const center = target.getCenterPoint();
  
  // Calculate angle from center to mouse position
  const angle = Math.atan2(y - center.y, x - center.x);
  
  // Calculate the angle relative to the object's initial state
  const angleOffset = angle - Math.atan2(
    transform.ey - center.y,
    transform.ex - center.x
  );
  
  // Apply rotation
  target.rotate((angleOffset * 180 / Math.PI) + transform.theta);
  
  return true;
}

/**
 * Set object to scale mode (Inkscape first click behavior)
 */
function setScaleMode(obj) {
  if (!obj) return;
  
  objectModes.set(obj, MODE.SCALE);
  
  // Show all handles (corners and edges for scaling)
  obj.setControlsVisibility({
    mt: true,   // middle-top
    mb: true,   // middle-bottom
    ml: true,   // middle-left
    mr: true,   // middle-right
    tl: true,   // top-left corner
    tr: true,   // top-right corner
    bl: true,   // bottom-left corner
    br: true,   // bottom-right corner
    mtr: false  // rotation control - always hidden (we use corners instead)
  });
  
  // Set corner controls to scaling behavior with custom icons
  // Scale handle is oriented for middle-top, so rotate accordingly:
  // tl: -45° (top-left diagonal)
  obj.controls.tl.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.tl.render = createScaleIconRenderer(-45);
  
  // tr: 45° (top-right diagonal)
  obj.controls.tr.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.tr.render = createScaleIconRenderer(45);
  
  // br: 135° (bottom-right diagonal)
  obj.controls.br.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.br.render = createScaleIconRenderer(135);
  
  // bl: -135° (bottom-left diagonal)
  obj.controls.bl.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.bl.render = createScaleIconRenderer(-135);
  
  // Reset cursor handlers to default for scaling (remove custom handlers)
  obj.controls.tl.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  obj.controls.tr.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  obj.controls.bl.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  obj.controls.br.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  
  // Set edge controls to scaling behavior with custom icons
  // mt: 0° (middle-top, original orientation)
  obj.controls.mt.actionHandler = fabric.controlsUtils.scalingYOrSkewingX;
  obj.controls.mt.render = createScaleIconRenderer(0);
  
  // mr: 90° (middle-right)
  obj.controls.mr.actionHandler = fabric.controlsUtils.scalingXOrSkewingY;
  obj.controls.mr.render = createScaleIconRenderer(90);
  
  // mb: 180° (middle-bottom)
  obj.controls.mb.actionHandler = fabric.controlsUtils.scalingYOrSkewingX;
  obj.controls.mb.render = createScaleIconRenderer(180);
  
  // ml: -90° (middle-left)
  obj.controls.ml.actionHandler = fabric.controlsUtils.scalingXOrSkewingY;
  obj.controls.ml.render = createScaleIconRenderer(-90);
  
  // Visual feedback: standard border
  obj.set({
    borderColor: '#5F5FD7',
    cornerColor: '#000000',
    cornerSize: 24,  // Increased size for custom icons
    transparentCorners: false,
    borderScaleFactor: 0.3,
    borderDashArray: [5, 5]
  });
}

/**
 * Set object to rotation mode (Inkscape second click behavior)
 */
function setRotateMode(obj) {
  if (!obj) return;
  
  objectModes.set(obj, MODE.ROTATE);
  
  // Keep corners visible, hide edges
  obj.setControlsVisibility({
    mt: false,   // hide middle-top
    mb: false,   // hide middle-bottom
    ml: false,   // hide middle-left
    mr: false,   // hide middle-right
    tl: true,    // show corners - they now rotate
    tr: true,
    bl: true,
    br: true,
    mtr: false   // rotation control - hidden (we use corners instead)
  });
  
  // Change corner controls to use custom rotation around center with custom icons
  // Rotate handle is oriented for bottom-left, so rotate accordingly:
  const rotationCursorHandler = () => 'grab';
  
  // bl: 0° (bottom-left, original orientation)
  obj.controls.bl.actionHandler = rotateAroundCenter;
  obj.controls.bl.cursorStyleHandler = rotationCursorHandler;
  obj.controls.bl.render = createRotateIconRenderer(0);
  
  // tl: 90° (top-left)
  obj.controls.tl.actionHandler = rotateAroundCenter;
  obj.controls.tl.cursorStyleHandler = rotationCursorHandler;
  obj.controls.tl.render = createRotateIconRenderer(90);
  
  // tr: 180° (top-right)
  obj.controls.tr.actionHandler = rotateAroundCenter;
  obj.controls.tr.cursorStyleHandler = rotationCursorHandler;
  obj.controls.tr.render = createRotateIconRenderer(180);
  
  // br: 270° (bottom-right)
  obj.controls.br.actionHandler = rotateAroundCenter;
  obj.controls.br.cursorStyleHandler = rotationCursorHandler;
  obj.controls.br.render = createRotateIconRenderer(270);
  
  // Visual feedback: different style for rotation mode
  obj.set({
    borderColor: '#5F5FD7',
    cornerColor: '#000000',
    cornerSize: 24,  // Increased size for custom icons
    transparentCorners: false,
    borderScaleFactor: 0.3,
    borderDashArray: [5, 5]  // Dashed border to indicate rotation mode
  });
}

/**
 * Get current mode of an object
 */
function getMode(obj) {
  return objectModes.get(obj) || MODE.SCALE;
}

/**
 * Toggle between scale and rotate modes
 */
function toggleMode(obj) {
  if (!obj) return;
  
  const currentMode = getMode(obj);
  
  if (currentMode === MODE.SCALE) {
    setRotateMode(obj);
  } else {
    setScaleMode(obj);
  }
}

/**
 * Handle selection created - always start in scale mode
 */
function handleSelectionCreated(e, canvas) {
  const selected = e.selected || [];
  
  if (selected.length === 1) {
    const obj = selected[0];
    currentSelectedObject = obj;
    justSelected = true;  // Mark that we just selected this object
    setScaleMode(obj);
    canvas.requestRenderAll();
  } else if (selected.length > 1) {
    // For multiple selections, use scale mode
    selected.forEach(obj => setScaleMode(obj));
    currentSelectedObject = null;
    justSelected = false;
    canvas.requestRenderAll();
  }
}

/**
 * Handle selection updated - reset to scale mode for new objects
 */
function handleSelectionUpdated(e, canvas) {
  const selected = e.selected || [];
  
  if (selected.length === 1) {
    const obj = selected[0];
    
    // If selecting a different object, reset to scale mode
    if (obj !== currentSelectedObject) {
      currentSelectedObject = obj;
      justSelected = true;  // Mark that we just selected this object
      setScaleMode(obj);
      canvas.requestRenderAll();
    }
  } else if (selected.length > 1) {
    selected.forEach(obj => setScaleMode(obj));
    currentSelectedObject = null;
    justSelected = false;
    canvas.requestRenderAll();
  }
}

/**
 * Handle mouse down - detect clicks on already-selected objects to toggle mode
 */
function handleMouseDown(e, canvas) {
  // Only process if we have an active object
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;
  
  // Check if we're clicking on a control handle - if so, don't toggle mode
  if (e.transform && e.transform.corner) {
    // User is interacting with a control handle, don't toggle
    return;
  }
  
  // Check if clicking on the active object itself (not on controls)
  const target = e.target;
  
  if (target === activeObject && activeObject === currentSelectedObject) {
    // Store the mouse position to detect dragging vs clicking
    activeObject._mouseDownX = e.pointer.x;
    activeObject._mouseDownY = e.pointer.y;
    activeObject._wasDragged = false;
  }
}

/**
 * Handle mouse up - toggle mode only if object wasn't dragged
 */
function handleMouseUp(e, canvas) {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;
  
  const target = e.target;
  
  if (target === activeObject && activeObject === currentSelectedObject) {
    // If this object was just selected, don't toggle yet
    if (justSelected) {
      justSelected = false;  // Clear the flag
      // Clean up tracking properties
      delete activeObject._mouseDownX;
      delete activeObject._mouseDownY;
      return;
    }
    
    // Check if the object was dragged
    if (activeObject._mouseDownX !== undefined && activeObject._mouseDownY !== undefined) {
      const deltaX = Math.abs(e.pointer.x - activeObject._mouseDownX);
      const deltaY = Math.abs(e.pointer.y - activeObject._mouseDownY);
      
      // If mouse moved more than 5 pixels, consider it a drag, not a click
      const dragThreshold = 5;
      const wasDragged = deltaX > dragThreshold || deltaY > dragThreshold;
      
      if (!wasDragged) {
        // It was a click (not a drag), toggle the mode
        toggleMode(activeObject);
        canvas.requestRenderAll();
      }
      
      // Clean up tracking properties
      delete activeObject._mouseDownX;
      delete activeObject._mouseDownY;
    }
  }
}

/**
 * Handle selection cleared - reset tracking
 */
function handleSelectionCleared(e, canvas) {
  currentSelectedObject = null;
  justSelected = false;
}

/**
 * Enable Inkscape-like transform mode behavior on a Fabric canvas
 * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
 * @returns {Function} Cleanup function to remove the behavior
 */
export function enableInkscapeTransformMode(canvas) {
  if (!canvas) {
    console.error('[InkscapeTransformMode] Canvas is required');
    return () => {};
  }
  
  // Create bound handlers
  const onSelectionCreated = (e) => handleSelectionCreated(e, canvas);
  const onSelectionUpdated = (e) => handleSelectionUpdated(e, canvas);
  const onSelectionCleared = (e) => handleSelectionCleared(e, canvas);
  const onMouseDown = (e) => handleMouseDown(e, canvas);
  const onMouseUp = (e) => handleMouseUp(e, canvas);
  
  // Attach event listeners
  canvas.on('selection:created', onSelectionCreated);
  canvas.on('selection:updated', onSelectionUpdated);
  canvas.on('selection:cleared', onSelectionCleared);
  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:up', onMouseUp);
  
  console.log('[InkscapeTransformMode] Enabled Inkscape-like transform modes');
  
  // Return cleanup function
  return () => {
    canvas.off('selection:created', onSelectionCreated);
    canvas.off('selection:updated', onSelectionUpdated);
    canvas.off('selection:cleared', onSelectionCleared);
    canvas.off('mouse:down', onMouseDown);
    canvas.off('mouse:up', onMouseUp);
    console.log('[InkscapeTransformMode] Disabled');
  };
}

/**
 * Manually set an object to scale mode
 * Useful for tutorial-specific control
 */
export function forceScaleMode(obj, canvas) {
  setScaleMode(obj);
  if (canvas) canvas.requestRenderAll();
}

/**
 * Manually set an object to rotate mode
 * Useful for tutorial-specific control
 */
export function forceRotateMode(obj, canvas) {
  setRotateMode(obj);
  if (canvas) canvas.requestRenderAll();
}

/**
 * Get the current mode of an object
 * Returns 'scale' or 'rotate'
 */
export function getCurrentMode(obj) {
  return getMode(obj);
}

/**
 * Export mode constants for external use
 */
export { MODE as TRANSFORM_MODE };
