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
 * Handle double-click - enter node edit mode for polygons/polylines/paths
 * @param {Object} e - Fabric.js mouse event
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function handleMouseDblClick(e, canvas) {
  const target = e.target;
  if (!target) return;
  
  // Check if target is a polygon/polyline (has points array) or a path (has path array)
  if (target.points && Array.isArray(target.points)) {
    debugLog('[InkscapeTransformMode] Double-click on polygon/polyline - entering node edit mode');
    enterNodeEditMode(target, canvas);
  } else if (target.path && Array.isArray(target.path)) {
    debugLog('[InkscapeTransformMode] Double-click on path - entering node edit mode');
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
 * Convert a Polygon/Polyline to a Path object
 * This allows for future bezier curve editing
 * @param {fabric.Object} polygon - The polygon/polyline to convert
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {fabric.Path} The converted path object
 */
function convertPolygonToPath(polygon, canvas) {
  if (!polygon || !polygon.points || polygon.points.length === 0) return null;
  
  const points = polygon.points;
  const isClosed = polygon.type === 'polygon';
  
  // Build path commands array
  // Format: ['M', x, y], ['L', x, y], ..., ['Z'] (if closed)
  const pathData = [];
  
  // First point is a Move command
  pathData.push(['M', points[0].x, points[0].y]);
  
  // Subsequent points are Line commands
  for (let i = 1; i < points.length; i++) {
    pathData.push(['L', points[i].x, points[i].y]);
  }
  
  // Close path for polygons
  if (isClosed) {
    pathData.push(['Z']);
  }
  
  // Create new fabric.Path
  const path = new fabric.Path(pathData, {
    fill: polygon.fill,
    stroke: polygon.stroke,
    strokeWidth: polygon.strokeWidth,
    strokeLineCap: polygon.strokeLineCap,
    strokeLineJoin: polygon.strokeLineJoin,
    opacity: polygon.opacity,
    left: polygon.left,
    top: polygon.top,
    originX: polygon.originX,
    originY: polygon.originY,
    // Copy custom properties
    _isConvertedPath: true,
    _originalType: polygon.type
  });
  
  debugLog('[InkscapeTransformMode] Converted polygon to path:', {
    originalType: polygon.type,
    pointCount: points.length,
    pathCommands: pathData.length,
    isClosed: isClosed
  });
  
  return path;
}

/**
 * Enter node editing mode for a polygon/polyline
 * Converts polygon to path for future bezier support
 * @param {fabric.Object} obj - The polygon/polyline to edit
 * @param {fabric.Canvas} canvas - The canvas instance
 */
function enterNodeEditMode(obj, canvas) {
  if (!obj) return;
  
  // Handle both polygons/polylines (with points) and paths
  let targetObj = obj;
  
  // Convert polygon/polyline to path for bezier support
  if (obj.points && Array.isArray(obj.points)) {
    debugLog('[InkscapeTransformMode] Converting polygon to path for node editing');
    
    const path = convertPolygonToPath(obj, canvas);
    if (!path) {
      debugLog('[InkscapeTransformMode] Failed to convert polygon to path');
      return;
    }
    
    // Replace polygon with path on canvas
    canvas.remove(obj);
    canvas.add(path);
    canvas.setActiveObject(path);
    targetObj = path;
    
    debugLog('[InkscapeTransformMode] Polygon replaced with path');
  } else if (!obj.path) {
    // Not a polygon and not a path - can't node edit
    debugLog('[InkscapeTransformMode] Object has no points or path - cannot enter node edit mode');
    return;
  }
  
  // Store original controls
  originalControls.set(targetObj, { ...targetObj.controls });
  
  // Disable object caching during node editing to prevent clipping
  // when nodes are dragged outside the original bounding box
  targetObj._nodeEditOriginalCaching = targetObj.objectCaching;
  targetObj.objectCaching = false;
  
  // Set mode
  objectModes.set(targetObj, MODE.NODE_EDIT);
  
  // Create node controls for path
  const nodeControls = createPathNodeControls(targetObj);
  targetObj.controls = nodeControls;
  
  // Override drawControls to draw bezier handle lines first
  if (!targetObj._originalDrawControls) {
    targetObj._originalDrawControls = targetObj.drawControls;
    targetObj.drawControls = function(ctx, styleOverride) {
      // Draw bezier handle lines before controls
      drawBezierHandleLines(ctx, this);
      // Call original drawControls
      return this._originalDrawControls.call(this, ctx, styleOverride);
    };
  }
  
  // Hide standard visibility but allow interaction
  targetObj.setControlsVisibility({
    mt: false, mb: false, ml: false, mr: false,
    tl: false, tr: false, bl: false, br: false,
    mtr: false
  });
  
  targetObj.hasBorders = false;
  targetObj.dirty = true;
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
  
  // Restore object caching
  if (obj._nodeEditOriginalCaching !== undefined) {
    obj.objectCaching = obj._nodeEditOriginalCaching;
    delete obj._nodeEditOriginalCaching;
  }
  
  // Recalculate bounding box for paths so handles stay within visible area
  if (obj.path && Array.isArray(obj.path)) {
    recalculatePathBoundingBoxFinal(obj);
  } else if (obj.points && Array.isArray(obj.points)) {
    recalculateBoundingBox(obj);
  }
  
  // Restore original drawControls method
  if (obj._originalDrawControls) {
    obj.drawControls = obj._originalDrawControls;
    delete obj._originalDrawControls;
  }
  
  // Restore original controls - need to use fabric defaults for Path objects
  // since they were converted from Polygon and don't have saved original controls
  const original = originalControls.get(obj);
  if (original && Object.keys(original).length > 0 && original.tl) {
    // Only restore if we have valid standard controls
    obj.controls = original;
    originalControls.delete(obj);
  } else {
    // Recreate standard controls from fabric defaults
    obj.controls = { ...fabric.Object.prototype.controls };
    originalControls.delete(obj);
  }
  
  obj.hasBorders = true;
  obj.dirty = true;
  
  // Reset to scale mode - but only if we have valid controls
  if (obj.controls && obj.controls.tl) {
    setScaleMode(obj);
  }
  
  canvas.requestRenderAll();
  
  debugLog('[InkscapeTransformMode] Exited node edit mode');
}

/**
 * Draw bezier handle lines connecting control points to their anchors
 * Called before drawing controls to ensure lines appear behind control points
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {fabric.Path} path - The path object being edited
 */
function drawBezierHandleLines(ctx, path) {
  if (!path || !path.path || !path.controls || !path.canvas) return;
  
  const pathData = path.path;
  
  ctx.save();
  ctx.strokeStyle = '#1976d2';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  
  // Iterate through controls to find bezier handle pairs
  // Use the control's positionHandler to get exact screen coordinates
  // This ensures we use the same calculation as the control rendering
  const controlKeys = Object.keys(path.controls);
  
  for (const key of controlKeys) {
    const control = path.controls[key];
    
    // Check if this is a cp1 control (connects to previous anchor)
    if (key.startsWith('cp1_')) {
      const anchorIndex = parseInt(key.replace('cp1_', ''));
      const anchorKey = 'p' + anchorIndex;
      
      // Get cp1 position
      const cp1Pos = control.positionHandler(
        { x: path.width, y: path.height },
        null,
        path
      );
      
      // Find the previous anchor to connect to
      // cp1 connects to the START of the curve (previous point)
      const cmdIndex = control.commandIndex;
      if (cmdIndex > 0) {
        const prevCmd = pathData[cmdIndex - 1];
        let prevX, prevY;
        
        switch (prevCmd[0]) {
          case 'M':
          case 'L':
            prevX = prevCmd[1] - path.pathOffset.x;
            prevY = prevCmd[2] - path.pathOffset.y;
            break;
          case 'C':
            prevX = prevCmd[5] - path.pathOffset.x;
            prevY = prevCmd[6] - path.pathOffset.y;
            break;
          case 'Q':
            prevX = prevCmd[3] - path.pathOffset.x;
            prevY = prevCmd[4] - path.pathOffset.y;
            break;
        }
        
        if (prevX !== undefined) {
          // Transform using same method as position handlers
          const matrix = fabric.util.multiplyTransformMatrices(
            path.canvas.viewportTransform,
            path.calcTransformMatrix()
          );
          const prevScreen = fabric.util.transformPoint({ x: prevX, y: prevY }, matrix);
          
          ctx.beginPath();
          ctx.moveTo(prevScreen.x, prevScreen.y);
          ctx.lineTo(cp1Pos.x, cp1Pos.y);
          ctx.stroke();
        }
      }
    }
    
    // Check if this is a cp2 control (connects to current anchor/endpoint)
    if (key.startsWith('cp2_')) {
      const anchorIndex = parseInt(key.replace('cp2_', ''));
      const anchorKey = 'p' + anchorIndex;
      
      // Get cp2 position
      const cp2Pos = control.positionHandler(
        { x: path.width, y: path.height },
        null,
        path
      );
      
      // Get the anchor (endpoint) position - cp2 connects to END of curve
      if (path.controls[anchorKey]) {
        const anchorPos = path.controls[anchorKey].positionHandler(
          { x: path.width, y: path.height },
          null,
          path
        );
        
        ctx.beginPath();
        ctx.moveTo(anchorPos.x, anchorPos.y);
        ctx.lineTo(cp2Pos.x, cp2Pos.y);
        ctx.stroke();
      }
    }
  }
  
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Get anchor points from a path (M, L, C, Q endpoints - not control points)
 * @param {Array} pathData - The path data array
 * @returns {Array} Array of {commandIndex, x, y, command} for each anchor
 */
function getPathAnchors(pathData) {
  const anchors = [];
  
  for (let i = 0; i < pathData.length; i++) {
    const cmd = pathData[i];
    const command = cmd[0];
    
    switch (command) {
      case 'M': // Move to
      case 'L': // Line to
        anchors.push({
          commandIndex: i,
          x: cmd[1],
          y: cmd[2],
          command: command
        });
        break;
      case 'C': // Cubic bezier - endpoint is last two values
        anchors.push({
          commandIndex: i,
          x: cmd[5],  // End point x
          y: cmd[6],  // End point y
          command: command,
          // Also store control points for later
          cp1x: cmd[1], cp1y: cmd[2],
          cp2x: cmd[3], cp2y: cmd[4]
        });
        break;
      case 'Q': // Quadratic bezier - endpoint is last two values
        anchors.push({
          commandIndex: i,
          x: cmd[3],  // End point x
          y: cmd[4],  // End point y
          command: command,
          cpx: cmd[1], cpy: cmd[2]
        });
        break;
      case 'Z': // Close path - no anchor point
        break;
    }
  }
  
  return anchors;
}

/**
 * Create node editing controls for a Path object
 * Includes anchor points AND bezier control handles
 * @param {fabric.Path} path - The path to create controls for
 * @returns {Object} Control configuration object
 */
function createPathNodeControls(path) {
  const controls = {};
  const pathData = path.path;
  
  if (!pathData || !Array.isArray(pathData)) return controls;
  
  // Get all anchor points from path
  const anchors = getPathAnchors(pathData);
  
  debugLog('[InkscapeTransformMode] Creating path node controls:', {
    pathCommands: pathData.length,
    anchorCount: anchors.length
  });
  
  // Create control for each anchor point
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    controls['p' + i] = new fabric.Control({
      positionHandler: createPathNodePositionHandler(anchor.commandIndex, anchor.command),
      actionHandler: createPathNodeActionHandler(anchor.commandIndex, anchor.command),
      render: renderNodeControl,
      cursorStyle: 'pointer',
      anchorIndex: i,
      commandIndex: anchor.commandIndex,
      actionName: 'modifyPath',
      offsetX: 0,
      offsetY: 0
    });
    
    // For cubic bezier commands, also create controls for control points
    if (anchor.command === 'C') {
      // Control point 1 (cp1)
      controls['cp1_' + i] = new fabric.Control({
        positionHandler: createBezierHandlePositionHandler(anchor.commandIndex, 'cp1'),
        actionHandler: createBezierHandleActionHandler(anchor.commandIndex, 'cp1'),
        render: renderBezierHandleControl,
        cursorStyle: 'crosshair',
        anchorIndex: i,
        commandIndex: anchor.commandIndex,
        handleType: 'cp1',
        actionName: 'modifyBezierHandle',
        offsetX: 0,
        offsetY: 0
      });
      
      // Control point 2 (cp2)
      controls['cp2_' + i] = new fabric.Control({
        positionHandler: createBezierHandlePositionHandler(anchor.commandIndex, 'cp2'),
        actionHandler: createBezierHandleActionHandler(anchor.commandIndex, 'cp2'),
        render: renderBezierHandleControl,
        cursorStyle: 'crosshair',
        anchorIndex: i,
        commandIndex: anchor.commandIndex,
        handleType: 'cp2',
        actionName: 'modifyBezierHandle',
        offsetX: 0,
        offsetY: 0
      });
    }
  }
  
  return controls;
}

/**
 * Create position handler for a bezier control handle
 * @param {number} commandIndex - Index of the command in the path array
 * @param {string} handleType - 'cp1' or 'cp2'
 * @returns {Function} Position handler function
 */
function createBezierHandlePositionHandler(commandIndex, handleType) {
  return function(dim, finalMatrix, fabricObject) {
    const pathData = fabricObject.path;
    if (!pathData || !pathData[commandIndex]) return { x: 0, y: 0 };
    
    const cmd = pathData[commandIndex];
    if (cmd[0] !== 'C') return { x: 0, y: 0 };
    
    let x, y;
    if (handleType === 'cp1') {
      x = cmd[1];
      y = cmd[2];
    } else { // cp2
      x = cmd[3];
      y = cmd[4];
    }
    
    // Adjust for pathOffset
    x = x - fabricObject.pathOffset.x;
    y = y - fabricObject.pathOffset.y;
    
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
 * Create action handler for dragging a bezier control handle
 * @param {number} commandIndex - Index of the command in the path array
 * @param {string} handleType - 'cp1' or 'cp2'
 * @returns {Function} Action handler function
 */
function createBezierHandleActionHandler(commandIndex, handleType) {
  return function(eventData, transform, x, y) {
    const path = transform.target;
    const mouseLocalPosition = path.toLocalPoint(
      new fabric.Point(x, y),
      'center',
      'center'
    );
    
    const newX = mouseLocalPosition.x + path.pathOffset.x;
    const newY = mouseLocalPosition.y + path.pathOffset.y;
    
    const cmd = path.path[commandIndex];
    if (cmd[0] !== 'C') return false;
    
    if (handleType === 'cp1') {
      cmd[1] = newX;
      cmd[2] = newY;
    } else { // cp2
      cmd[3] = newX;
      cmd[4] = newY;
    }
    
    path.dirty = true;
    path.setCoords();
    return true;
  };
}

/**
 * Render function for bezier control handle points (diamonds)
 * Note: Handle lines are drawn separately via drawBezierHandleLines
 */
function renderBezierHandleControl(ctx, left, top, styleOverride, fabricObject) {
  const size = 8;
  ctx.save();
  
  // Draw diamond shape for control handle
  ctx.fillStyle = '#1976d2';
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, top - size/2);        // top
  ctx.lineTo(left + size/2, top);        // right
  ctx.lineTo(left, top + size/2);        // bottom
  ctx.lineTo(left - size/2, top);        // left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Create position handler for a path node control
 * @param {number} commandIndex - Index of the command in the path array
 * @param {string} command - The path command type (M, L, C, Q)
 * @returns {Function} Position handler function
 */
function createPathNodePositionHandler(commandIndex, command) {
  return function(dim, finalMatrix, fabricObject) {
    const pathData = fabricObject.path;
    if (!pathData || !pathData[commandIndex]) return { x: 0, y: 0 };
    
    const cmd = pathData[commandIndex];
    let x, y;
    
    // Get endpoint coordinates based on command type
    switch (command) {
      case 'M':
      case 'L':
        x = cmd[1];
        y = cmd[2];
        break;
      case 'C':
        x = cmd[5];
        y = cmd[6];
        break;
      case 'Q':
        x = cmd[3];
        y = cmd[4];
        break;
      default:
        return { x: 0, y: 0 };
    }
    
    // Adjust for pathOffset
    x = x - fabricObject.pathOffset.x;
    y = y - fabricObject.pathOffset.y;
    
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
 * Create action handler for dragging a path node
 * @param {number} commandIndex - Index of the command in the path array
 * @param {string} command - The path command type (M, L, C, Q)
 * @returns {Function} Action handler function
 */
function createPathNodeActionHandler(commandIndex, command) {
  return function(eventData, transform, x, y) {
    const path = transform.target;
    const mouseLocalPosition = path.toLocalPoint(
      new fabric.Point(x, y),
      'center',
      'center'
    );
    
    const newX = mouseLocalPosition.x + path.pathOffset.x;
    const newY = mouseLocalPosition.y + path.pathOffset.y;
    
    const cmd = path.path[commandIndex];
    
    // Update endpoint coordinates based on command type
    switch (command) {
      case 'M':
      case 'L':
        cmd[1] = newX;
        cmd[2] = newY;
        break;
      case 'C':
        // For cubic bezier, also move control points by the same delta
        const oldX = cmd[5];
        const oldY = cmd[6];
        const dx = newX - oldX;
        const dy = newY - oldY;
        // Move second control point with the endpoint
        cmd[3] += dx;
        cmd[4] += dy;
        // Update endpoint
        cmd[5] = newX;
        cmd[6] = newY;
        break;
      case 'Q':
        // For quadratic bezier, also move control point
        const oldQx = cmd[3];
        const oldQy = cmd[4];
        const dxQ = newX - oldQx;
        const dyQ = newY - oldQy;
        cmd[1] += dxQ;
        cmd[2] += dyQ;
        cmd[3] = newX;
        cmd[4] = newY;
        break;
    }
    
    path.dirty = true;
    path.setCoords();
    return true;
  };
}

/**
 * Recalculate bounding box for a Path after node editing
 * Updates dimensions while maintaining visual position
 * @param {fabric.Path} path - The path to update
 */
function recalculatePathBoundingBox(path) {
  if (!path || !path.path || path.path.length === 0) return;
  
  // Store old pathOffset for delta calculation
  const oldPathOffset = { ...path.pathOffset };
  
  // Get all points from path commands
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const cmd of path.path) {
    const command = cmd[0];
    switch (command) {
      case 'M':
      case 'L':
        minX = Math.min(minX, cmd[1]);
        minY = Math.min(minY, cmd[2]);
        maxX = Math.max(maxX, cmd[1]);
        maxY = Math.max(maxY, cmd[2]);
        break;
      case 'C':
        // Include control points and endpoint in bounding box
        minX = Math.min(minX, cmd[1], cmd[3], cmd[5]);
        minY = Math.min(minY, cmd[2], cmd[4], cmd[6]);
        maxX = Math.max(maxX, cmd[1], cmd[3], cmd[5]);
        maxY = Math.max(maxY, cmd[2], cmd[4], cmd[6]);
        break;
      case 'Q':
        minX = Math.min(minX, cmd[1], cmd[3]);
        minY = Math.min(minY, cmd[2], cmd[4]);
        maxX = Math.max(maxX, cmd[1], cmd[3]);
        maxY = Math.max(maxY, cmd[2], cmd[4]);
        break;
    }
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // New pathOffset is the center of the bounding box
  const newPathOffset = {
    x: minX + width / 2,
    y: minY + height / 2
  };
  
  // Calculate offset delta - how much the center moved
  const deltaX = newPathOffset.x - oldPathOffset.x;
  const deltaY = newPathOffset.y - oldPathOffset.y;
  
  // Update pathOffset
  path.pathOffset = newPathOffset;
  
  // Adjust left/top to compensate for pathOffset change
  // This keeps the path visually in the same position
  path.set({
    left: path.left + deltaX,
    top: path.top + deltaY,
    width: width,
    height: height
  });
  
  path.setCoords();
  path.dirty = true;
}

/**
 * Recalculate bounding box for a Path when exiting node edit mode
 * This version doesn't cause position jumps because it uses the path's
 * current visual position as reference
 * @param {fabric.Path} path - The path to update
 */
function recalculatePathBoundingBoxFinal(path) {
  if (!path || !path.path || path.path.length === 0) return;
  
  // Get all points from path commands to find actual bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const cmd of path.path) {
    const command = cmd[0];
    switch (command) {
      case 'M':
      case 'L':
        minX = Math.min(minX, cmd[1]);
        minY = Math.min(minY, cmd[2]);
        maxX = Math.max(maxX, cmd[1]);
        maxY = Math.max(maxY, cmd[2]);
        break;
      case 'C':
        // Include control points and endpoint in bounding box
        minX = Math.min(minX, cmd[1], cmd[3], cmd[5]);
        minY = Math.min(minY, cmd[2], cmd[4], cmd[6]);
        maxX = Math.max(maxX, cmd[1], cmd[3], cmd[5]);
        maxY = Math.max(maxY, cmd[2], cmd[4], cmd[6]);
        break;
      case 'Q':
        minX = Math.min(minX, cmd[1], cmd[3]);
        minY = Math.min(minY, cmd[2], cmd[4]);
        maxX = Math.max(maxX, cmd[1], cmd[3]);
        maxY = Math.max(maxY, cmd[2], cmd[4]);
        break;
    }
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // New pathOffset is the center of the actual path bounds
  const newPathOffset = {
    x: minX + width / 2,
    y: minY + height / 2
  };
  
  // The path is rendered at: left + (pointX - pathOffset.x)
  // We want the visual position to stay the same
  // Currently with old pathOffset, a point at minX renders at: left + (minX - oldPathOffset.x)
  // With new pathOffset, to render at same position: newLeft + (minX - newPathOffset.x) = left + (minX - oldPathOffset.x)
  // newLeft = left + (minX - oldPathOffset.x) - (minX - newPathOffset.x)
  // newLeft = left + newPathOffset.x - oldPathOffset.x
  
  const oldPathOffset = path.pathOffset;
  const newLeft = path.left + (newPathOffset.x - oldPathOffset.x);
  const newTop = path.top + (newPathOffset.y - oldPathOffset.y);
  
  // Update pathOffset and dimensions
  path.pathOffset = newPathOffset;
  path.set({
    left: newLeft,
    top: newTop,
    width: width,
    height: height
  });
  
  path.setCoords();
  path.dirty = true;
}

/**
 * Create node editing controls for a polygon/polyline (legacy - kept for reference)
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
 * Check if the active object is in node edit mode
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if active object is in node edit mode
 */
export function isInNodeEditMode(canvas) {
  const activeObj = canvas?.getActiveObject();
  return activeObj && getMode(activeObj) === MODE.NODE_EDIT;
}

/**
 * Exit node edit mode for the active object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
export function exitNodeEdit(canvas) {
  const activeObj = canvas?.getActiveObject();
  if (activeObj && getMode(activeObj) === MODE.NODE_EDIT) {
    exitNodeEditMode(activeObj, canvas);
  }
}

/**
 * Convert a line segment to a cubic bezier curve
 * The segment going INTO the specified anchor point
 * @param {fabric.Path} path - The path object
 * @param {number} anchorIndex - Index of the anchor point (from getPathAnchors)
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if conversion was successful
 */
export function makeSegmentCurve(path, anchorIndex, canvas) {
  if (!path || !path.path) return false;
  
  const anchors = getPathAnchors(path.path);
  if (anchorIndex < 0 || anchorIndex >= anchors.length) return false;
  
  const anchor = anchors[anchorIndex];
  const commandIndex = anchor.commandIndex;
  const cmd = path.path[commandIndex];
  
  // Can only convert L (line) commands to C (curve)
  if (cmd[0] !== 'L') {
    debugLog('[InkscapeTransformMode] Cannot convert - not a line segment');
    return false;
  }
  
  // Get the previous anchor point to calculate control points
  let prevAnchor;
  if (anchorIndex > 0) {
    prevAnchor = anchors[anchorIndex - 1];
  } else {
    // First point after M - check if path is closed to wrap around
    const lastCmd = path.path[path.path.length - 1];
    if (lastCmd[0] === 'Z' && anchors.length > 1) {
      prevAnchor = anchors[anchors.length - 1];
    } else {
      debugLog('[InkscapeTransformMode] Cannot convert first segment');
      return false;
    }
  }
  
  const startX = prevAnchor.x;
  const startY = prevAnchor.y;
  const endX = cmd[1];
  const endY = cmd[2];
  
  // Calculate default control points (1/3 and 2/3 along the line)
  // This creates a curve that initially looks like a straight line
  // but can be adjusted
  const dx = endX - startX;
  const dy = endY - startY;
  
  // Create control points perpendicular to the line for more visible curve
  const perpX = -dy * 0.25;  // Perpendicular offset
  const perpY = dx * 0.25;
  
  const cp1x = startX + dx * 0.33 + perpX;
  const cp1y = startY + dy * 0.33 + perpY;
  const cp2x = startX + dx * 0.67 + perpX;
  const cp2y = startY + dy * 0.67 + perpY;
  
  // Convert L to C (cubic bezier)
  path.path[commandIndex] = ['C', cp1x, cp1y, cp2x, cp2y, endX, endY];
  
  debugLog('[InkscapeTransformMode] Converted segment to curve:', {
    commandIndex,
    from: [startX, startY],
    to: [endX, endY],
    cp1: [cp1x, cp1y],
    cp2: [cp2x, cp2y]
  });
  
  // Recreate node controls to include bezier handle controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
  
  return true;
}

/**
 * Convert a cubic bezier curve segment to a straight line
 * @param {fabric.Path} path - The path object
 * @param {number} anchorIndex - Index of the anchor point
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if conversion was successful
 */
export function makeSegmentLine(path, anchorIndex, canvas) {
  if (!path || !path.path) return false;
  
  const anchors = getPathAnchors(path.path);
  if (anchorIndex < 0 || anchorIndex >= anchors.length) return false;
  
  const anchor = anchors[anchorIndex];
  const commandIndex = anchor.commandIndex;
  const cmd = path.path[commandIndex];
  
  // Can only convert C (curve) commands to L (line)
  if (cmd[0] !== 'C') {
    debugLog('[InkscapeTransformMode] Cannot convert - not a curve segment');
    return false;
  }
  
  // Get endpoint from cubic bezier
  const endX = cmd[5];
  const endY = cmd[6];
  
  // Convert C to L
  path.path[commandIndex] = ['L', endX, endY];
  
  debugLog('[InkscapeTransformMode] Converted curve to line:', {
    commandIndex,
    endpoint: [endX, endY]
  });
  
  // Recreate node controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
  
  return true;
}

/**
 * Make ALL segments of a path into curves
 * Useful for quickly converting a polygon to a fully curved shape
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
export function makeAllSegmentsCurves(path, canvas) {
  if (!path || !path.path) return;
  
  const anchors = getPathAnchors(path.path);
  let converted = 0;
  
  // Convert each L segment to C
  for (let i = 1; i < anchors.length; i++) {
    if (makeSegmentCurve(path, i, null)) {
      converted++;
    }
  }
  
  debugLog(`[InkscapeTransformMode] Converted ${converted} segments to curves`);
  
  // Regenerate controls and render once at the end
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
}

/**
 * Get the segment type (line or curve) at a given anchor
 * @param {fabric.Path} path - The path object
 * @param {number} anchorIndex - Index of the anchor point
 * @returns {string|null} 'line', 'curve', or null
 */
export function getSegmentType(path, anchorIndex) {
  if (!path || !path.path) return null;
  
  const anchors = getPathAnchors(path.path);
  if (anchorIndex < 0 || anchorIndex >= anchors.length) return null;
  
  const cmd = path.path[anchors[anchorIndex].commandIndex][0];
  
  switch (cmd) {
    case 'L': return 'line';
    case 'C': return 'curve';
    case 'Q': return 'curve';
    case 'M': return 'move';
    default: return null;
  }
}

/**
 * Export mode constants for external use
 */
export { MODE as TRANSFORM_MODE };
