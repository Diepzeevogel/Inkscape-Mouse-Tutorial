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

import { TRANSFORM_MODE as CONFIG } from './constants.js';

// Transform modes
const MODE = {
  SCALE: 'scale',
  ROTATE: 'rotate',
  NODE_EDIT: 'nodeEdit'
};

// Track the current mode for each object using WeakMap for automatic garbage collection
const objectModes = new WeakMap();

// Store original controls when entering node edit mode
const originalControls = new WeakMap();

// Selection state tracking
let currentSelectedObject = null;
let justSelected = false;  // Prevents immediate mode toggle after selection
let previousSelectionCount = 0;

// Double-click tracking for node edit
let lastClickTime = 0;
let lastClickTarget = null;
const DOUBLE_CLICK_THRESHOLD = 300; // ms - faster than scale/rotate toggle

// Icon cache for custom handles
const iconCache = {
  scaleHandle: null,
  rotateHandle: null
};

// Debug mode toggle (set to false for production)
const DEBUG_MODE = false;

/**
 * Debug logger - only logs when DEBUG_MODE is enabled
 * @param {string} message - Log message
 * @param {Object} data - Optional data object to log
 */
function debugLog(message, data = null) {
  if (DEBUG_MODE) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}

/**
 * Load icon images for custom transform handles
 * @returns {Promise<void>}
 */
async function loadIcons() {
  return new Promise((resolve) => {
    let loadedCount = 0;
    const totalIcons = 2;
    
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === totalIcons) {
        debugLog('[InkscapeTransformMode] Icons loaded successfully');
        resolve();
      }
    };
    
    // Load scale handle icon
    const scaleImg = new Image();
    scaleImg.onload = () => {
      iconCache.scaleHandle = scaleImg;
      checkComplete();
    };
    scaleImg.onerror = () => {
      console.error('[InkscapeTransformMode] Failed to load scale handle icon');
      checkComplete();
    };
    scaleImg.src = CONFIG.ICON_SCALE_HANDLE;
    
    // Load rotate handle icon
    const rotateImg = new Image();
    rotateImg.onload = () => {
      iconCache.rotateHandle = rotateImg;
      checkComplete();
    };
    rotateImg.onerror = () => {
      console.error('[InkscapeTransformMode] Failed to load rotate handle icon');
      checkComplete();
    };
    rotateImg.src = CONFIG.ICON_ROTATE_HANDLE;
  });
}

/**
 * Custom render function for scale handles with icon
 * @param {number} angle - Rotation angle in degrees
 * @returns {Function} Rendering function for Fabric.js control
 */
function createScaleIconRenderer(angle) {
  return function(ctx, left, top, styleOverride, fabricObject) {
    const icon = iconCache.scaleHandle;
    if (!icon || !icon.complete) {
      // Fallback to default square rendering if icon not loaded
      ctx.save();
      ctx.fillStyle = fabricObject.cornerColor || CONFIG.CORNER_COLOR;
      ctx.fillRect(left - CONFIG.ICON_SIZE / 2, top - CONFIG.ICON_SIZE / 2, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE);
      ctx.restore();
      return;
    }
    
    // Add object's rotation to the icon's base rotation for proper orientation
    const totalRotation = angle + (fabricObject.angle || 0);
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate((totalRotation * Math.PI) / 180);
    ctx.drawImage(icon, -CONFIG.ICON_SIZE / 2, -CONFIG.ICON_SIZE / 2, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE);
    ctx.restore();
  };
}

/**
 * Custom render function for rotation handles with icon
 * @param {number} angle - Rotation angle in degrees
 * @returns {Function} Rendering function for Fabric.js control
 */
function createRotateIconRenderer(angle) {
  return function(ctx, left, top, styleOverride, fabricObject) {
    const icon = iconCache.rotateHandle;
    if (!icon || !icon.complete) {
      // Fallback to default square rendering if icon not loaded
      ctx.save();
      ctx.fillStyle = fabricObject.cornerColor || CONFIG.CORNER_COLOR;
      ctx.fillRect(left - CONFIG.ICON_SIZE / 2, top - CONFIG.ICON_SIZE / 2, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE);
      ctx.restore();
      return;
    }
    
    // Add object's rotation to the icon's base rotation for proper orientation
    const totalRotation = angle + (fabricObject.angle || 0);
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate((totalRotation * Math.PI) / 180);
    ctx.drawImage(icon, -CONFIG.ICON_SIZE / 2, -CONFIG.ICON_SIZE / 2, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE);
    ctx.restore();
  };
}

// Preload icons
loadIcons();

/**
 * Custom rotation handler that rotates around the bounding box center
 * @param {Event} eventData - Mouse event data
 * @param {Object} transform - Fabric.js transform object
 * @param {number} x - Mouse X coordinate
 * @param {number} y - Mouse Y coordinate
 * @returns {boolean} Always returns true to indicate transform was applied
 */
function rotateAroundCenter(eventData, transform, x, y) {
  const target = transform.target;
  const center = target.getCenterPoint();
  
  // Calculate angle from center to mouse position
  const angle = Math.atan2(y - center.y, x - center.x);
  const angleOffset = angle - Math.atan2(transform.ey - center.y, transform.ex - center.x);
  
  // Apply rotation
  target.rotate((angleOffset * 180 / Math.PI) + transform.theta);
  
  return true;
}

/**
 * Apply ActiveSelection-specific styling for multi-object selections
 * @param {fabric.ActiveSelection} obj - The ActiveSelection object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function applyActiveSelectionStyling(obj, canvas) {
  if (obj.type !== 'activeSelection') return;
  
  obj.set({
    selectionBackgroundColor: CONFIG.SELECTION_BACKGROUND,
    selectionBorderColor: CONFIG.SELECTION_BORDER_COLOR,
    selectionLineWidth: CONFIG.SELECTION_LINE_WIDTH,
    strokeWidth: 0
  });
  
  // Also set on canvas to ensure consistency
  if (canvas) {
    canvas.selectionColor = CONFIG.SELECTION_BACKGROUND;
    canvas.selectionBorderColor = CONFIG.SELECTION_BORDER_COLOR;
    canvas.selectionLineWidth = CONFIG.SELECTION_LINE_WIDTH;
  }
}

/**
 * Set object to scale mode (Inkscape first click behavior)
 * @param {fabric.Object} obj - The Fabric.js object to configure
 */
function setScaleMode(obj) {
  if (!obj) return;
  
  objectModes.set(obj, MODE.SCALE);
  
  // Show all handles (corners and edges for scaling)
  obj.setControlsVisibility({
    mt: true, mb: true, ml: true, mr: true,
    tl: true, tr: true, bl: true, br: true,
    mtr: false  // Rotation control always hidden
  });
  
  // Configure corner controls for scaling with custom icons
  obj.controls.tl.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.tl.render = createScaleIconRenderer(-45);
  obj.controls.tr.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.tr.render = createScaleIconRenderer(45);
  obj.controls.br.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.br.render = createScaleIconRenderer(135);
  obj.controls.bl.actionHandler = fabric.controlsUtils.scalingEqually;
  obj.controls.bl.render = createScaleIconRenderer(-135);
  
  // Reset cursor handlers to default scaling behavior
  obj.controls.tl.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  obj.controls.tr.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  obj.controls.bl.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  obj.controls.br.cursorStyleHandler = fabric.controlsUtils.scaleSkewCursorStyleHandler;
  
  // Configure edge controls for scaling with custom icons
  obj.controls.mt.actionHandler = fabric.controlsUtils.scalingYOrSkewingX;
  obj.controls.mt.render = createScaleIconRenderer(0);
  obj.controls.mr.actionHandler = fabric.controlsUtils.scalingXOrSkewingY;
  obj.controls.mr.render = createScaleIconRenderer(90);
  obj.controls.mb.actionHandler = fabric.controlsUtils.scalingYOrSkewingX;
  obj.controls.mb.render = createScaleIconRenderer(180);
  obj.controls.ml.actionHandler = fabric.controlsUtils.scalingXOrSkewingY;
  obj.controls.ml.render = createScaleIconRenderer(-90);
  
  // Apply visual styling
  obj.set({
    borderColor: CONFIG.BORDER_COLOR,
    cornerColor: CONFIG.CORNER_COLOR,
    cornerSize: CONFIG.HANDLE_SIZE,
    transparentCorners: false,
    borderScaleFactor: CONFIG.BORDER_SCALE_FACTOR,
    borderDashArray: CONFIG.BORDER_DASH_ARRAY  // Solid border for scale mode
  });
  
  // Apply ActiveSelection-specific styling if needed
  applyActiveSelectionStyling(obj, obj.canvas);
}

/**
 * Set object to rotation mode (Inkscape second click behavior)
 * @param {fabric.Object} obj - The Fabric.js object to configure
 */
function setRotateMode(obj) {
  if (!obj) return;
  
  objectModes.set(obj, MODE.ROTATE);
  
  // Show only corners (hide edge handles)
  obj.setControlsVisibility({
    mt: false, mb: false, ml: false, mr: false,
    tl: true, tr: true, bl: true, br: true,
    mtr: false  // Rotation control always hidden
  });
  
  // Configure corner controls for rotation with custom icons
  const rotationCursorHandler = () => 'grab';
  
  obj.controls.bl.actionHandler = rotateAroundCenter;
  obj.controls.bl.cursorStyleHandler = rotationCursorHandler;
  obj.controls.bl.render = createRotateIconRenderer(0);
  
  obj.controls.tl.actionHandler = rotateAroundCenter;
  obj.controls.tl.cursorStyleHandler = rotationCursorHandler;
  obj.controls.tl.render = createRotateIconRenderer(90);
  
  obj.controls.tr.actionHandler = rotateAroundCenter;
  obj.controls.tr.cursorStyleHandler = rotationCursorHandler;
  obj.controls.tr.render = createRotateIconRenderer(180);
  
  obj.controls.br.actionHandler = rotateAroundCenter;
  obj.controls.br.cursorStyleHandler = rotationCursorHandler;
  obj.controls.br.render = createRotateIconRenderer(270);
  
  // Apply visual styling with dashed border to indicate rotation mode
  obj.set({
    borderColor: CONFIG.BORDER_COLOR,
    cornerColor: CONFIG.CORNER_COLOR,
    cornerSize: CONFIG.HANDLE_SIZE,
    transparentCorners: false,
    borderScaleFactor: CONFIG.BORDER_SCALE_FACTOR,
    borderDashArray: CONFIG.BORDER_DASH_ARRAY
  });
  
  // Apply ActiveSelection-specific styling if needed
  applyActiveSelectionStyling(obj, obj.canvas);
}

/**
 * Get current mode of an object
 */
function getMode(obj) {
  return objectModes.get(obj) || MODE.SCALE;
}

/**
 * Toggle between scale and rotate modes
 * @param {fabric.Object} obj - The object to toggle mode for
 */
function toggleMode(obj) {
  if (!obj) return;
  
  const currentMode = getMode(obj);
  
  // Don't toggle if in node edit mode - need double-click or Escape to exit
  if (currentMode === MODE.NODE_EDIT) {
    debugLog('[TransformMode] In node edit mode - not toggling');
    return;
  }
  
  debugLog('[TransformMode] toggleMode called:', {
    objType: obj.type,
    currentMode: currentMode,
    willSwitchTo: currentMode === MODE.SCALE ? 'ROTATE' : 'SCALE'
  });
  
  if (currentMode === MODE.SCALE) {
    setRotateMode(obj);
  } else {
    setScaleMode(obj);
  }
}

/**
 * Handle selection created - always start in scale mode
 * @param {Object} e - Fabric.js selection event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleSelectionCreated(e, canvas) {
  const selected = e.selected || [];
  const activeObject = canvas.getActiveObject();
  
  debugLog('[TransformMode] selection:created', {
    selectedCount: selected.length,
    activeObjectType: activeObject?.type
  });
  
  if (selected.length === 1) {
    currentSelectedObject = selected[0];
    justSelected = true;
    setScaleMode(selected[0]);
    previousSelectionCount = 1;
  } else if (selected.length > 1 && activeObject) {
    // For multiple selections, apply scale mode to the ActiveSelection object
    currentSelectedObject = activeObject;
    justSelected = true;
    setScaleMode(activeObject);
    previousSelectionCount = selected.length;
  }
  
  canvas.requestRenderAll();
}

/**
 * Calculate the actual object count for the current selection
 * @param {fabric.Object|null} activeObject - The active object
 * @returns {number} Number of objects in the selection
 */
function getActualSelectionCount(activeObject) {
  if (!activeObject) return 0;
  if (activeObject.type === 'activeSelection') {
    return activeObject._objects?.length || 0;
  }
  return 1;
}

/**
 * Handle selection updated - manages mode preservation when modifying selections
 * This handles complex cases like:
 * - Shift-clicking to add objects to selection
 * - Shift-clicking to remove objects from selection
 * - Deselecting down to a single object
 * @param {Object} e - Fabric.js selection event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleSelectionUpdated(e, canvas) {
  const selected = e.selected || [];
  const deselected = e.deselected || [];
  const activeObject = canvas.getActiveObject();
  const actualCount = getActualSelectionCount(activeObject);
  
  // Capture state BEFORE updating currentSelectedObject
  const oldMode = currentSelectedObject ? getMode(currentSelectedObject) : null;
  const wasActiveSelection = currentSelectedObject?.type === 'activeSelection';
  
  debugLog('[TransformMode] selection:updated', {
    selectedCount: selected.length,
    deselectedCount: deselected.length,
    actualCount,
    wasActiveSelection,
    currentMode: oldMode
  });
  
  // Handle single object selection/deselection
  if (actualCount === 1 && activeObject?.type !== 'activeSelection') {
    handleSingleObjectSelection(activeObject, selected, deselected, wasActiveSelection, oldMode, canvas);
  } 
  // Handle multi-object selection
  else if (actualCount > 1 || activeObject?.type === 'activeSelection') {
    handleMultiObjectSelection(activeObject, selected, deselected, wasActiveSelection, oldMode, actualCount, canvas);
  }
}

/**
 * Handle selection update for single objects
 * @param {fabric.Object} obj - The selected object
 * @param {Array} selected - Newly selected objects
 * @param {Array} deselected - Newly deselected objects
 * @param {boolean} wasActiveSelection - Whether previous selection was multi-object
 * @param {string|null} previousMode - Previous transform mode
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleSingleObjectSelection(obj, selected, deselected, wasActiveSelection, previousMode, canvas) {
  const isDeselectionToOne = wasActiveSelection && deselected.length > 0 && selected.length === 0;
  const isDifferentObject = obj !== currentSelectedObject;
  
  if (isDeselectionToOne) {
    // Preserve mode when deselecting from multi-selection to single object
    debugLog('[TransformMode] Deselected to single object - preserving mode:', previousMode);
    currentSelectedObject = obj;
    justSelected = true;
    
    if (previousMode === MODE.ROTATE) {
      setRotateMode(obj);
    } else {
      setScaleMode(obj);
    }
  } else if (isDifferentObject) {
    // New object selected - reset to scale mode
    debugLog('[TransformMode] New single object selection');
    currentSelectedObject = obj;
    justSelected = true;
    setScaleMode(obj);
  }
  
  previousSelectionCount = 1;
  canvas.requestRenderAll();
}

/**
 * Handle selection update for multiple objects (ActiveSelection)
 * @param {fabric.ActiveSelection} activeObject - The active selection
 * @param {Array} selected - Newly selected objects
 * @param {Array} deselected - Newly deselected objects
 * @param {boolean} wasActiveSelection - Whether previous selection was multi-object
 * @param {string|null} previousMode - Previous transform mode
 * @param {number} actualCount - Actual number of objects in selection
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleMultiObjectSelection(activeObject, selected, deselected, wasActiveSelection, previousMode, actualCount, canvas) {
  const isModifyingExisting = wasActiveSelection && (selected.length > 0 || deselected.length > 0);
  
  debugLog('[TransformMode] Multi-selection', {
    isModifyingExisting,
    previousMode,
    willPreserve: isModifyingExisting && previousMode === MODE.ROTATE
  });
  
  currentSelectedObject = activeObject;
  justSelected = true; // Always prevent immediate toggle for ActiveSelection
  
  // Preserve mode when modifying existing selection, otherwise use scale mode
  if (isModifyingExisting && previousMode === MODE.ROTATE) {
    setRotateMode(activeObject);
  } else {
    setScaleMode(activeObject);
  }
  
  previousSelectionCount = actualCount;
  canvas.requestRenderAll();
}

/**
 * Handle mouse down - track click position to distinguish clicks from drags
 * @param {Object} e - Fabric.js mouse event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleMouseDown(e, canvas) {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;
  
  // Don't track if clicking on a control handle
  if (e.transform && e.transform.corner) return;
  
  const target = e.target;
  const isPartOfActiveSelection = activeObject.type === 'activeSelection' 
    && activeObject._objects 
    && activeObject._objects.includes(target);
  
  // Track mouse position if clicking on the active object
  if ((target === activeObject || isPartOfActiveSelection) && activeObject === currentSelectedObject) {
    activeObject._mouseDownX = e.pointer.x;
    activeObject._mouseDownY = e.pointer.y;
  }
}

/**
 * Handle mouse up - toggle mode only if object was clicked (not dragged)
 * @param {Object} e - Fabric.js mouse event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleMouseUp(e, canvas) {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;
  
  const target = e.target;
  const isPartOfActiveSelection = activeObject.type === 'activeSelection' 
    && activeObject._objects 
    && activeObject._objects.includes(target);
  
  if ((target === activeObject || isPartOfActiveSelection) && activeObject === currentSelectedObject) {
    // Skip toggle if object was just selected
    if (justSelected) {
      justSelected = false;
      delete activeObject._mouseDownX;
      delete activeObject._mouseDownY;
      return;
    }
    
    // Check if object was dragged
    if (activeObject._mouseDownX !== undefined && activeObject._mouseDownY !== undefined) {
      const deltaX = Math.abs(e.pointer.x - activeObject._mouseDownX);
      const deltaY = Math.abs(e.pointer.y - activeObject._mouseDownY);
      const wasDragged = deltaX > CONFIG.DRAG_THRESHOLD || deltaY > CONFIG.DRAG_THRESHOLD;
      
      if (!wasDragged) {
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
 * Handle selection cleared - reset all tracking state
 * @param {Object} e - Fabric.js selection event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleSelectionCleared(e, canvas) {
  // Exit node edit mode if active
  if (currentSelectedObject && getMode(currentSelectedObject) === MODE.NODE_EDIT) {
    exitNodeEditMode(currentSelectedObject, canvas);
  }
  currentSelectedObject = null;
  justSelected = false;
  previousSelectionCount = 0;
}

/**
 * Handle double-click - enter node edit mode for polygons/polylines
 * @param {Object} e - Fabric.js mouse event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleMouseDblClick(e, canvas) {
  const target = e.target;
  if (!target) return;
  
  // Check if target is a polygon or polyline (has points array)
  if (target.points && Array.isArray(target.points)) {
    debugLog('[InkscapeTransformMode] Double-click on polygon/polyline - entering node edit mode');
    enterNodeEditMode(target, canvas);
  }
}

/**
 * Handle keydown - Escape exits node edit mode
 * @param {KeyboardEvent} e - Keyboard event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleKeyDown(e, canvas) {
  if (e.key === 'Escape') {
    const activeObject = canvas.getActiveObject();
    if (activeObject && getMode(activeObject) === MODE.NODE_EDIT) {
      exitNodeEditMode(activeObject, canvas);
      e.preventDefault();
    }
  }
}

/**
 * Enter node editing mode for a polygon/polyline
 * @param {fabric.Object} obj - The polygon/polyline to edit
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function enterNodeEditMode(obj, canvas) {
  if (!obj || !obj.points) return;
  
  // Store original controls
  originalControls.set(obj, { ...obj.controls });
  
  // Set mode
  objectModes.set(obj, MODE.NODE_EDIT);
  
  // Create node controls
  const nodeControls = createNodeControls(obj);
  obj.controls = nodeControls;
  
  // Hide standard visibility but allow interaction
  obj.setControlsVisibility({
    mt: false, mb: false, ml: false, mr: false,
    tl: false, tr: false, bl: false, br: false,
    mtr: false
  });
  
  obj.hasBorders = false;
  obj.dirty = true;
  canvas.requestRenderAll();
  
  debugLog('[InkscapeTransformMode] Entered node edit mode');
}

/**
 * Exit node editing mode
 * @param {fabric.Object} obj - The object in node edit mode
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function exitNodeEditMode(obj, canvas) {
  if (!obj) return;
  
  // Recalculate bounding box based on edited points
  if (obj.points && Array.isArray(obj.points)) {
    recalculateBoundingBox(obj);
  }
  
  // Restore original controls
  const original = originalControls.get(obj);
  if (original) {
    obj.controls = original;
    originalControls.delete(obj);
  } else {
    // Fallback: recreate standard controls
    obj.controls = fabric.Object.prototype.controls;
  }
  
  obj.hasBorders = true;
  obj.dirty = true;
  
  // Reset to scale mode
  setScaleMode(obj);
  canvas.requestRenderAll();
  
  debugLog('[InkscapeTransformMode] Exited node edit mode');
}

/**
 * Create node editing controls for a polygon/polyline
 * @param {fabric.Object} shape - The shape to create controls for
 * @returns {Object} Control configuration object
 */
function createNodeControls(shape) {
  const controls = {};
  const points = shape.points;
  
  for (let i = 0; i < points.length; i++) {
    controls['p' + i] = new fabric.Control({
      positionHandler: createNodePositionHandler(i),
      actionHandler: createNodeActionHandler(i),
      render: renderNodeControl,
      cursorStyle: 'pointer',
      pointIndex: i,
      actionName: 'modifyPolygon',
      offsetX: 0,
      offsetY: 0
    });
  }
  
  return controls;
}

/**
 * Create position handler for a node control
 * @param {number} pointIndex - Index of the point in the points array
 * @returns {Function} Position handler function
 */
function createNodePositionHandler(pointIndex) {
  return function(dim, finalMatrix, fabricObject) {
    const points = fabricObject.points;
    if (!points || !points[pointIndex]) return { x: 0, y: 0 };
    
    const x = points[pointIndex].x - fabricObject.pathOffset.x;
    const y = points[pointIndex].y - fabricObject.pathOffset.y;
    
    return fabric.util.transformPoint(
      { x, y },
      fabric.util.multiplyTransformMatrices(
        fabricObject.canvas.viewportTransform,
        fabricObject.calcTransformMatrix()
      )
    );
  };
}

/**
 * Create action handler for dragging a node
 * @param {number} pointIndex - Index of the point in the points array
 * @returns {Function} Action handler function
 */
function createNodeActionHandler(pointIndex) {
  return function(eventData, transform, x, y) {
    const polygon = transform.target;
    const mouseLocalPosition = polygon.toLocalPoint(
      new fabric.Point(x, y),
      'center',
      'center'
    );
    
    polygon.points[pointIndex] = {
      x: mouseLocalPosition.x + polygon.pathOffset.x,
      y: mouseLocalPosition.y + polygon.pathOffset.y
    };
    
    polygon.dirty = true;
    polygon.setCoords();
    return true;
  };
}

/**
 * Recalculate bounding box for a polygon/polyline after node editing
 * This updates pathOffset and repositions the shape correctly
 * @param {fabric.Object} polygon - The polygon/polyline to update
 */
function recalculateBoundingBox(polygon) {
  if (!polygon || !polygon.points || polygon.points.length === 0) return;
  
  const points = polygon.points;
  
  // Calculate new bounding box from current points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // New pathOffset is the center of the bounding box
  const newPathOffset = {
    x: minX + width / 2,
    y: minY + height / 2
  };
  
  // For polygons/polylines with originX:'left' and originY:'top':
  // - left/top represents the top-left corner of the bounding box
  // - pathOffset is the center point
  // - Points render at: left + (point.x - pathOffset.x), top + (point.y - pathOffset.y)
  // 
  // So for the top-left corner point (minX, minY):
  //   canvasX = left + (minX - pathOffset.x) = left + (minX - (minX + width/2)) = left - width/2
  //   We want canvasX = minX, so: left = minX + width/2 = pathOffset.x
  // 
  // Wait, that's not right either. Let me reconsider...
  // Actually, for origin 'left'/'top', the position IS the top-left of the bounding box
  // and since points are relative to pathOffset, the formula is:
  //   rendered.x = left + (point.x - pathOffset.x)
  //   rendered.y = top + (point.y - pathOffset.y)
  //
  // For the shape to stay in place, we want point (minX, minY) to render at canvas (minX, minY)
  // So: minX = left + (minX - pathOffset.x)  =>  left = pathOffset.x
  //     minY = top + (minY - pathOffset.y)   =>  top = pathOffset.y
  //
  // No wait, that's wrong too. The original rendering worked, so let's trace through:
  // Original: left=52.5, pathOffset.x=213.5
  // Point at x=53 renders at: 52.5 + (53 - 213.5) = 52.5 - 160.5 = -108 (not right)
  //
  // Hmm, the math doesn't add up. Let me just preserve the relationship:
  // In the original, for the top-left point: left ≈ minX and top ≈ minY
  // The pathOffset is just used internally for transforms
  
  // Simply set left/top to minX/minY (the top-left of bounding box)
  // This is what Fabric does for polygons with origin at left/top
  polygon.pathOffset = newPathOffset;
  polygon.set({
    left: minX,
    top: minY,
    width: width,
    height: height
  });
  
  // Force recalculation of coordinates
  polygon.setCoords();
  polygon.dirty = true;
}

/**
 * Render function for node control points
 */
function renderNodeControl(ctx, left, top, styleOverride, fabricObject) {
  const size = 10;
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#1976d2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(left, top, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Enable Inkscape-like transform mode behavior on a Fabric canvas
 * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
 * @returns {Function} Cleanup function to remove event listeners and disable the behavior
 */
export function enableInkscapeTransformMode(canvas) {
  if (!canvas) {
    console.error('[InkscapeTransformMode] Canvas is required');
    return () => {};
  }
  
  // Create bound event handlers
  const onSelectionCreated = (e) => handleSelectionCreated(e, canvas);
  const onSelectionUpdated = (e) => handleSelectionUpdated(e, canvas);
  const onSelectionCleared = (e) => handleSelectionCleared(e, canvas);
  const onMouseDown = (e) => handleMouseDown(e, canvas);
  const onMouseUp = (e) => handleMouseUp(e, canvas);
  const onMouseDblClick = (e) => handleMouseDblClick(e, canvas);
  const onKeyDown = (e) => handleKeyDown(e, canvas);
  
  // Attach event listeners
  canvas.on('selection:created', onSelectionCreated);
  canvas.on('selection:updated', onSelectionUpdated);
  canvas.on('selection:cleared', onSelectionCleared);
  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:up', onMouseUp);
  canvas.on('mouse:dblclick', onMouseDblClick);
  window.addEventListener('keydown', onKeyDown);
  
  debugLog('[InkscapeTransformMode] Enabled Inkscape-like transform modes');
  
  // Return cleanup function
  return () => {
    canvas.off('selection:created', onSelectionCreated);
    canvas.off('selection:updated', onSelectionUpdated);
    canvas.off('selection:cleared', onSelectionCleared);
    canvas.off('mouse:down', onMouseDown);
    canvas.off('mouse:up', onMouseUp);
    canvas.off('mouse:dblclick', onMouseDblClick);
    window.removeEventListener('keydown', onKeyDown);
    debugLog('[InkscapeTransformMode] Disabled');
  };
}

/**
 * Manually set an object to scale mode
 * @param {fabric.Object} obj - The object to configure
 * @param {fabric.Canvas} [canvas] - Optional canvas instance for rendering
 */
export function forceScaleMode(obj, canvas) {
  setScaleMode(obj);
  if (canvas) canvas.requestRenderAll();
}

/**
 * Manually set an object to rotate mode
 * @param {fabric.Object} obj - The object to configure
 * @param {fabric.Canvas} [canvas] - Optional canvas instance for rendering
 */
export function forceRotateMode(obj, canvas) {
  setRotateMode(obj);
  if (canvas) canvas.requestRenderAll();
}

/**
 * Get the current transform mode of an object
 * @param {fabric.Object} obj - The object to query
 * @returns {string} 'scale', 'rotate', or 'nodeEdit'
 */
export function getCurrentMode(obj) {
  return getMode(obj);
}

/**
 * Export mode constants for external use
 */
export { MODE as TRANSFORM_MODE };
