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

import { TRANSFORM_MODE as CONFIG, LESSON_FEATURES } from './constants.js';

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

// Selected nodes tracking (Set of anchor indices)
const selectedNodes = new Set();

/**
 * Get the currently selected node indices
 * @returns {Set<number>} Set of selected anchor indices
 */
export function getSelectedNodes() {
  return new Set(selectedNodes);
}

/**
 * Select a node by index
 * @param {number} anchorIndex - Index of the anchor to select
 * @param {boolean} addToSelection - If true, add to selection; if false, replace selection
 */
export function selectNode(anchorIndex, addToSelection = false) {
  if (!addToSelection) {
    selectedNodes.clear();
  }
  selectedNodes.add(anchorIndex);
}

/**
 * Deselect a node by index
 * @param {number} anchorIndex - Index of the anchor to deselect
 */
export function deselectNode(anchorIndex) {
  selectedNodes.delete(anchorIndex);
}

/**
 * Clear all node selections
 */
export function clearNodeSelection() {
  selectedNodes.clear();
}

/**
 * Check if a node is selected
 * @param {number} anchorIndex - Index of the anchor to check
 * @returns {boolean} True if the node is selected
 */
export function isNodeSelected(anchorIndex) {
  return selectedNodes.has(anchorIndex);
}
const DOUBLE_CLICK_THRESHOLD = 300; // ms - faster than scale/rotate toggle

/**
 * Check if node editing feature is enabled for the current lesson
 * @returns {boolean} True if NODE_EDITING is enabled for the current lesson
 */
function isNodeEditingEnabled() {
  const match = (location.hash || '').match(/lesson=(\d+)/);
  const lesson = match ? parseInt(match[1], 10) : null;
  return lesson && LESSON_FEATURES[lesson]?.NODE_EDITING === true;
}

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
  
  // If clicking on empty canvas while in node edit mode, exit it
  if (!e.target && activeObject && getMode(activeObject) === MODE.NODE_EDIT) {
    exitNodeEditMode(activeObject, canvas);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return;
  }
  
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
  // Only allow node editing if the feature is enabled for the current lesson
  if (!isNodeEditingEnabled()) return;
  
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
  
  // Close path for polygons - Z implicitly draws back to start
  // The closing segment can be converted to a curve using makeClosingSegmentCurve()
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
export function enterNodeEditMode(obj, canvas) {
  if (!obj) return;
  
  // Clear any previous node selection
  selectedNodes.clear();
  
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
  
  // Add segment click handler for selecting segments
  const segmentClickHandler = (e) => {
    // Only handle if clicking on this path
    if (e.target !== targetObj) return;
    // Let control handlers take precedence
    if (e.transform && e.transform.corner) return;
    
    handleNodeEditMouseDown(e, targetObj, canvas);
  };
  
  canvas.on('mouse:down', segmentClickHandler);
  targetObj._segmentClickHandler = segmentClickHandler;
  
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
  
  // Remove segment click handler
  if (obj._segmentClickHandler) {
    canvas.off('mouse:down', obj._segmentClickHandler);
    delete obj._segmentClickHandler;
  }
  
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
  // Reset context transform to identity - we'll apply transforms manually
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  ctx.strokeStyle = '#1976d2';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  
  // Iterate through controls to find bezier handle pairs
  // Use the control's positionHandler to get exact screen coordinates
  // This ensures we use the same calculation as the control rendering
  const controlKeys = Object.keys(path.controls);
  
  // Calculate the transform matrix once for efficiency
  const matrix = fabric.util.multiplyTransformMatrices(
    path.canvas.viewportTransform,
    path.calcTransformMatrix()
  );
  
  for (const key of controlKeys) {
    const control = path.controls[key];
    
    // Check if this is a cp1 control (connects to previous anchor)
    if (key.startsWith('cp1_')) {
      const anchorIndex = parseInt(key.replace('cp1_', ''));
      const anchorKey = 'p' + anchorIndex;
      
      // Get cp1 position from positionHandler (returns screen coords)
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
      let anchorKey = 'p' + anchorIndex;
      
      // Get cp2 position
      const cp2Pos = control.positionHandler(
        { x: path.width, y: path.height },
        null,
        path
      );
      
      // For closing curves, the anchor control doesn't exist - use p0 instead
      if (!path.controls[anchorKey] && control.isClosingCurve) {
        anchorKey = 'p0';
      }
      
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
 * Calculate squared distance from a point to a line segment
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} x1 - Segment start X
 * @param {number} y1 - Segment start Y
 * @param {number} x2 - Segment end X
 * @param {number} y2 - Segment end Y
 * @returns {number} Squared distance
 */
function pointToLineSegmentDistanceSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    // Segment is a point
    return (px - x1) ** 2 + (py - y1) ** 2;
  }
  
  // Project point onto line, clamp to segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  
  return (px - projX) ** 2 + (py - projY) ** 2;
}

/**
 * Calculate approximate distance from a point to a cubic bezier curve
 * Uses sampling approach for efficiency
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} x0 - Start point X
 * @param {number} y0 - Start point Y
 * @param {number} cp1x - Control point 1 X
 * @param {number} cp1y - Control point 1 Y
 * @param {number} cp2x - Control point 2 X
 * @param {number} cp2y - Control point 2 Y
 * @param {number} x3 - End point X
 * @param {number} y3 - End point Y
 * @returns {number} Squared distance (approximate)
 */
function pointToBezierDistanceSq(px, py, x0, y0, cp1x, cp1y, cp2x, cp2y, x3, y3) {
  // Sample the curve at multiple points and find minimum distance
  const samples = 20;
  let minDistSq = Infinity;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    // Cubic bezier formula
    const bx = mt3 * x0 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * x3;
    const by = mt3 * y0 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * y3;
    
    const distSq = (px - bx) ** 2 + (py - by) ** 2;
    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }
  
  return minDistSq;
}

/**
 * Find the closest segment to a click point in local path coordinates
 * @param {fabric.Path} path - The path object
 * @param {number} localX - Click X in local path coordinates (relative to pathOffset)
 * @param {number} localY - Click Y in local path coordinates (relative to pathOffset)
 * @param {number} threshold - Maximum distance (in path coords) to consider a "hit"
 * @returns {Object|null} {segmentIndex, anchorStart, anchorEnd} or null if no segment close enough
 */
function findClosestSegment(path, localX, localY, threshold = 10) {
  if (!path || !path.path) return null;
  
  const pathData = path.path;
  const anchors = getPathAnchors(pathData);
  
  if (anchors.length < 2) return null;
  
  const thresholdSq = threshold * threshold;
  let closestSegment = null;
  let minDistSq = thresholdSq;
  
  // Check each segment
  for (let i = 0; i < anchors.length; i++) {
    const startAnchor = anchors[i];
    let endAnchor, segmentCmd;
    
    // Find the next anchor (could be next in array or wrap to start for closing)
    if (i < anchors.length - 1) {
      endAnchor = anchors[i + 1];
      segmentCmd = pathData[endAnchor.commandIndex];
    } else {
      // Check for Z closing segment
      const lastCmd = pathData[pathData.length - 1];
      if (lastCmd[0] === 'Z') {
        // Closing segment from last anchor to first anchor
        endAnchor = anchors[0];
        // Check if there's a closing curve
        const prevCmd = pathData[pathData.length - 2];
        if (prevCmd && prevCmd[0] === 'C' && 
            Math.abs(prevCmd[5] - endAnchor.x) < 0.001 && 
            Math.abs(prevCmd[6] - endAnchor.y) < 0.001) {
          // It's a closing curve
          segmentCmd = prevCmd;
        } else {
          // It's a closing line (implicit L from Z)
          segmentCmd = ['L', endAnchor.x, endAnchor.y];
        }
      } else {
        continue; // No closing segment
      }
    }
    
    let distSq;
    if (segmentCmd[0] === 'L') {
      distSq = pointToLineSegmentDistanceSq(
        localX, localY,
        startAnchor.x, startAnchor.y,
        segmentCmd[1], segmentCmd[2]
      );
    } else if (segmentCmd[0] === 'C') {
      distSq = pointToBezierDistanceSq(
        localX, localY,
        startAnchor.x, startAnchor.y,
        segmentCmd[1], segmentCmd[2], // cp1
        segmentCmd[3], segmentCmd[4], // cp2
        segmentCmd[5], segmentCmd[6]  // end
      );
    } else {
      continue; // Skip other command types
    }
    
    if (distSq < minDistSq) {
      minDistSq = distSq;
      closestSegment = {
        segmentIndex: i,
        anchorStartIndex: i,
        anchorEndIndex: (i + 1) % anchors.length
      };
    }
  }
  
  return closestSegment;
}

/**
 * Handle mouse down in node edit mode - check for segment clicks
 * @param {Object} e - Fabric.js mouse event
 * @param {fabric.Path} path - The path object being edited
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if a segment was clicked
 */
function handleNodeEditMouseDown(e, path, canvas) {
  // Only handle if clicking on the path itself, not on a control
  if (e.transform && e.transform.corner) return false;
  
  // Check if click is on a node control - if so, let the control handle it
  const pointer = canvas.getPointer(e.e);
  
  // Convert pointer to path local coordinates
  const localPoint = path.toLocalPoint(
    new fabric.Point(pointer.x, pointer.y),
    'center',
    'center'
  );
  const localX = localPoint.x + path.pathOffset.x;
  const localY = localPoint.y + path.pathOffset.y;
  
  // Determine threshold based on zoom level
  const zoom = canvas.getZoom();
  const threshold = 12 / zoom; // Larger threshold at lower zoom
  
  // Find closest segment
  const segment = findClosestSegment(path, localX, localY, threshold);
  
  if (segment) {
    const shiftKey = e.e && e.e.shiftKey;
    
    if (!shiftKey) {
      // Clear existing selection
      selectedNodes.clear();
    }
    
    // Select both endpoints of the segment
    selectedNodes.add(segment.anchorStartIndex);
    selectedNodes.add(segment.anchorEndIndex);
    
    debugLog(`[InkscapeTransformMode] Selected segment ${segment.segmentIndex} (nodes ${segment.anchorStartIndex}, ${segment.anchorEndIndex})`);
    
    path.dirty = true;
    canvas.requestRenderAll();
    return true;
  }
  
  return false;
}

/**
 * Get anchor points from a path (M, L, C, Q endpoints - not control points)
 * @param {Array} pathData - The path data array
 * @returns {Array} Array of {commandIndex, x, y, command, isClosingCurve} for each anchor
 */
function getPathAnchors(pathData) {
  const anchors = [];
  
  // Get first point for detecting closing curves
  let firstX = null, firstY = null;
  if (pathData.length > 0 && pathData[0][0] === 'M') {
    firstX = pathData[0][1];
    firstY = pathData[0][2];
  }
  
  for (let i = 0; i < pathData.length; i++) {
    const cmd = pathData[i];
    const command = cmd[0];
    
    // Check if next command is Z (closing)
    const isFollowedByZ = (i + 1 < pathData.length && pathData[i + 1][0] === 'Z');
    
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
        // Check if this is a closing curve (ends at first point and followed by Z)
        const isClosingCurve = isFollowedByZ && 
          firstX !== null && 
          Math.abs(cmd[5] - firstX) < 0.001 && 
          Math.abs(cmd[6] - firstY) < 0.001;
        
        anchors.push({
          commandIndex: i,
          x: cmd[5],  // End point x
          y: cmd[6],  // End point y
          command: command,
          // Also store control points for later
          cp1x: cmd[1], cp1y: cmd[2],
          cp2x: cmd[3], cp2y: cmd[4],
          isClosingCurve: isClosingCurve
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
    
    // Skip creating anchor control for closing curves (the endpoint is same as p0)
    // But we still need to create the bezier handle controls below
    if (!anchor.isClosingCurve) {
      controls['p' + i] = new fabric.Control({
        positionHandler: createPathNodePositionHandler(anchor.commandIndex, anchor.command),
        actionHandler: createPathNodeActionHandler(anchor.commandIndex, anchor.command),
        mouseDownHandler: createNodeMouseDownHandler(i),
        render: renderNodeControl,
        cursorStyle: 'pointer',
        anchorIndex: i,
        commandIndex: anchor.commandIndex,
        actionName: 'modifyPath',
        offsetX: 0,
        offsetY: 0
      });
    }
    
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
        isClosingCurve: anchor.isClosingCurve,
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
        isClosingCurve: anchor.isClosingCurve,
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
 * Find the anchor index for a given handle
 * - cp1 belongs to the PREVIOUS anchor (it's the outgoing handle from there)
 * - cp2 belongs to the CURRENT command's endpoint
 * @param {Array} pathData - The path data array
 * @param {number} commandIndex - Index of the C command
 * @param {string} handleType - 'cp1' or 'cp2'
 * @returns {number} The anchor index, or -1 if not found
 */
function getAnchorIndexForHandle(pathData, commandIndex, handleType) {
  const anchors = getPathAnchors(pathData);
  
  if (handleType === 'cp2') {
    // cp2 belongs to the endpoint of this command - find it
    // Special case: if this is a closing curve, cp2 belongs to anchor 0
    const cmd = pathData[commandIndex];
    if (cmd && cmd[0] === 'C') {
      // Check if this is a closing curve (ends at first point)
      const firstX = pathData[0][1];
      const firstY = pathData[0][2];
      if (Math.abs(cmd[5] - firstX) < 0.001 && Math.abs(cmd[6] - firstY) < 0.001) {
        // Check if followed by Z
        const nextCmd = pathData[commandIndex + 1];
        if (nextCmd && nextCmd[0] === 'Z') {
          return 0; // cp2 of closing curve belongs to anchor 0
        }
      }
    }
    
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i].commandIndex === commandIndex) {
        return i;
      }
    }
  } else { // cp1
    // cp1 belongs to the previous anchor - find the anchor just before this command
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i].commandIndex === commandIndex) {
        return Math.max(0, i - 1);
      }
    }
  }
  return -1;
}

/**
 * Get the opposite handle info for a given handle
 * For smooth/auto-smooth nodes, when one handle moves, the opposite should follow
 * @param {Array} pathData - The path data array
 * @param {number} commandIndex - Index of the C command being dragged
 * @param {string} handleType - 'cp1' or 'cp2'
 * @param {number} anchorX - The anchor point X coordinate
 * @param {number} anchorY - The anchor point Y coordinate
 * @returns {Object|null} {commandIndex, handleType, handleX, handleY} or null
 */
function getOppositeHandle(pathData, commandIndex, handleType, anchorX, anchorY) {
  // Get first point coordinates for detecting closing curves
  const firstX = pathData[0] && pathData[0][0] === 'M' ? pathData[0][1] : null;
  const firstY = pathData[0] && pathData[0][0] === 'M' ? pathData[0][2] : null;
  
  if (handleType === 'cp2') {
    // Check if this is a closing curve's cp2 (belongs to anchor 0)
    const cmd = pathData[commandIndex];
    if (cmd && cmd[0] === 'C' && firstX !== null) {
      if (Math.abs(cmd[5] - firstX) < 0.001 && Math.abs(cmd[6] - firstY) < 0.001) {
        const nextCmd = pathData[commandIndex + 1];
        if (nextCmd && nextCmd[0] === 'Z') {
          // This is a closing curve - opposite is cp1 of the first curve after M
          for (let i = 1; i < pathData.length; i++) {
            if (pathData[i][0] === 'C') {
              return {
                commandIndex: i,
                handleType: 'cp1',
                handleX: pathData[i][1],
                handleY: pathData[i][2]
              };
            }
          }
        }
      }
    }
    
    // Regular case: Opposite is cp1 of the NEXT C command (if any)
    for (let i = commandIndex + 1; i < pathData.length; i++) {
      if (pathData[i][0] === 'C') {
        return {
          commandIndex: i,
          handleType: 'cp1',
          handleX: pathData[i][1],
          handleY: pathData[i][2]
        };
      }
      if (pathData[i][0] === 'Z') break; // No more commands after close
    }
  } else { // cp1
    // Check if this cp1 is for anchor 0 (first curve after M)
    // If so, opposite is cp2 of the closing curve
    if (commandIndex === 1 || (pathData[commandIndex - 1] && pathData[commandIndex - 1][0] === 'M')) {
      // This cp1 is the outgoing handle from anchor 0
      // Look for a closing curve
      for (let i = pathData.length - 1; i >= 0; i--) {
        if (pathData[i][0] === 'C' && firstX !== null) {
          if (Math.abs(pathData[i][5] - firstX) < 0.001 && Math.abs(pathData[i][6] - firstY) < 0.001) {
            const nextCmd = pathData[i + 1];
            if (nextCmd && nextCmd[0] === 'Z') {
              // Found the closing curve
              return {
                commandIndex: i,
                handleType: 'cp2',
                handleX: pathData[i][3],
                handleY: pathData[i][4]
              };
            }
          }
        }
        if (pathData[i][0] === 'M') break;
      }
    }
    
    // Regular case: Opposite is cp2 of the PREVIOUS C command (if any)
    for (let i = commandIndex - 1; i >= 0; i--) {
      if (pathData[i][0] === 'C') {
        return {
          commandIndex: i,
          handleType: 'cp2',
          handleX: pathData[i][3],
          handleY: pathData[i][4]
        };
      }
      if (pathData[i][0] === 'M') break; // Reached the start
    }
  }
  return null;
}

/**
 * Create action handler for dragging a bezier control handle
 * Enforces smooth/auto-smooth constraints when applicable
 * @param {number} commandIndex - Index of the command in the path array
 * @param {string} handleType - 'cp1' or 'cp2'
 * @returns {Function} Action handler function
 */
function createBezierHandleActionHandler(commandIndex, handleType) {
  return function(eventData, transform, x, y) {
    const path = transform.target;
    const pathData = path.path;
    const mouseLocalPosition = path.toLocalPoint(
      new fabric.Point(x, y),
      'center',
      'center'
    );
    
    const newX = mouseLocalPosition.x + path.pathOffset.x;
    const newY = mouseLocalPosition.y + path.pathOffset.y;
    
    const cmd = pathData[commandIndex];
    if (cmd[0] !== 'C') return false;
    
    // Update the dragged handle
    if (handleType === 'cp1') {
      cmd[1] = newX;
      cmd[2] = newY;
    } else { // cp2
      cmd[3] = newX;
      cmd[4] = newY;
    }
    
    // Check if node type constraint applies
    const anchorIndex = getAnchorIndexForHandle(pathData, commandIndex, handleType);
    const nodeType = path._nodeTypes && path._nodeTypes[anchorIndex];
    
    if (nodeType === 'smooth' || nodeType === 'auto-smooth') {
      // Get anchor position
      const anchors = getPathAnchors(pathData);
      if (anchorIndex >= 0 && anchorIndex < anchors.length) {
        const anchor = anchors[anchorIndex];
        const anchorX = anchor.x;
        const anchorY = anchor.y;
        
        // Get opposite handle info
        const opposite = getOppositeHandle(pathData, commandIndex, handleType, anchorX, anchorY);
        
        if (opposite) {
          // Calculate distance from anchor to dragged handle
          const draggedDx = newX - anchorX;
          const draggedDy = newY - anchorY;
          const draggedLen = Math.sqrt(draggedDx * draggedDx + draggedDy * draggedDy);
          
          if (draggedLen > 0.001) {
            // Normalize direction
            const normDx = draggedDx / draggedLen;
            const normDy = draggedDy / draggedLen;
            
            // Determine opposite handle length
            let oppositeLen;
            if (nodeType === 'auto-smooth') {
              // Auto-smooth: same length as dragged handle
              oppositeLen = draggedLen;
            } else {
              // Smooth: keep original length of opposite handle
              const oppDx = opposite.handleX - anchorX;
              const oppDy = opposite.handleY - anchorY;
              oppositeLen = Math.sqrt(oppDx * oppDx + oppDy * oppDy);
            }
            
            // Set opposite handle position (opposite direction)
            const newOppX = anchorX - normDx * oppositeLen;
            const newOppY = anchorY - normDy * oppositeLen;
            
            const oppCmd = pathData[opposite.commandIndex];
            if (opposite.handleType === 'cp1') {
              oppCmd[1] = newOppX;
              oppCmd[2] = newOppY;
            } else {
              oppCmd[3] = newOppX;
              oppCmd[4] = newOppY;
            }
          }
        }
      }
    }
    
    path.dirty = true;
    path.setCoords();
    return true;
  };
}

/**
 * Create mouse down handler for node selection
 * Handles click-to-select and shift+click for multi-select
 * @param {number} anchorIndex - Index of the anchor
 * @returns {Function} Mouse down handler function
 */
function createNodeMouseDownHandler(anchorIndex) {
  return function(eventData, transform, x, y) {
    const shiftKey = eventData.e && eventData.e.shiftKey;
    
    if (shiftKey) {
      // Toggle selection with shift
      if (selectedNodes.has(anchorIndex)) {
        selectedNodes.delete(anchorIndex);
      } else {
        selectedNodes.add(anchorIndex);
      }
    } else {
      // Replace selection without shift
      selectedNodes.clear();
      selectedNodes.add(anchorIndex);
    }
    
    // Request render to update visual selection state
    if (transform.target && transform.target.canvas) {
      transform.target.dirty = true;
      transform.target.canvas.requestRenderAll();
    }
    
    // Return false to allow the default action (dragging) to proceed
    return false;
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
 * When moving an anchor, its associated control handles move with it:
 * - cp2 of the current C command (incoming handle)
 * - cp1 of the next C command (outgoing handle)
 * @param {number} commandIndex - Index of the command in the path array
 * @param {string} command - The path command type (M, L, C, Q)
 * @returns {Function} Action handler function
 */
function createPathNodeActionHandler(commandIndex, command) {
  return function(eventData, transform, x, y) {
    const path = transform.target;
    const pathData = path.path;
    const mouseLocalPosition = path.toLocalPoint(
      new fabric.Point(x, y),
      'center',
      'center'
    );
    
    const newX = mouseLocalPosition.x + path.pathOffset.x;
    const newY = mouseLocalPosition.y + path.pathOffset.y;
    
    const cmd = pathData[commandIndex];
    
    // Calculate delta for moving associated control points
    let oldX, oldY;
    switch (command) {
      case 'M':
      case 'L':
        oldX = cmd[1];
        oldY = cmd[2];
        break;
      case 'C':
        oldX = cmd[5];
        oldY = cmd[6];
        break;
      case 'Q':
        oldX = cmd[3];
        oldY = cmd[4];
        break;
      default:
        oldX = newX;
        oldY = newY;
    }
    const dx = newX - oldX;
    const dy = newY - oldY;
    
    // Update endpoint coordinates based on command type
    switch (command) {
      case 'M':
      case 'L':
        cmd[1] = newX;
        cmd[2] = newY;
        break;
      case 'C':
        // Move second control point (cp2) with the endpoint
        cmd[3] += dx;
        cmd[4] += dy;
        // Update endpoint
        cmd[5] = newX;
        cmd[6] = newY;
        break;
      case 'Q':
        // Move control point with the endpoint
        cmd[1] += dx;
        cmd[2] += dy;
        cmd[3] = newX;
        cmd[4] = newY;
        break;
    }
    
    // Move cp1 of the NEXT command if it's a C command (outgoing handle from this anchor)
    const nextIndex = commandIndex + 1;
    if (nextIndex < pathData.length && pathData[nextIndex][0] === 'C') {
      pathData[nextIndex][1] += dx;
      pathData[nextIndex][2] += dy;
    }
    
    // If this is the first point (M command), handle closing curve connections
    if (command === 'M' && commandIndex === 0) {
      const lastIndex = pathData.length - 1;
      
      // Check if path ends with Z and has a C command before it
      if (lastIndex >= 1 && pathData[lastIndex][0] === 'Z') {
        const closingCurveIndex = lastIndex - 1;
        const beforeZ = pathData[closingCurveIndex];
        if (beforeZ[0] === 'C') {
          // Update the closing curve's endpoint to match the new M position
          beforeZ[5] = newX;
          beforeZ[6] = newY;
          // Also move cp2 of the closing curve (it should stay relative to the endpoint)
          beforeZ[3] += dx;
          beforeZ[4] += dy;
        }
      }
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
 * Calculate the bounding box of a cubic bezier curve
 * Uses calculus to find the actual extremes of the curve
 * @param {number} p0 - Start point coordinate
 * @param {number} p1 - First control point coordinate  
 * @param {number} p2 - Second control point coordinate
 * @param {number} p3 - End point coordinate
 * @returns {Object} {min, max} for this dimension
 */
function getBezierBounds1D(p0, p1, p2, p3) {
  let min = Math.min(p0, p3);
  let max = Math.max(p0, p3);
  
  // Coefficients of the derivative: 3at² + 2bt + c = 0
  const a = -p0 + 3*p1 - 3*p2 + p3;
  const b = 2*p0 - 4*p1 + 2*p2;
  const c = -p0 + p1;
  
  // Solve quadratic equation for t
  if (Math.abs(a) > 0.0001) {
    const discriminant = b*b - 4*a*c;
    if (discriminant >= 0) {
      const sqrtD = Math.sqrt(discriminant);
      const t1 = (-b + sqrtD) / (2*a);
      const t2 = (-b - sqrtD) / (2*a);
      
      // Check if t values are in valid range [0, 1]
      for (const t of [t1, t2]) {
        if (t > 0 && t < 1) {
          // Evaluate bezier at t
          const mt = 1 - t;
          const val = mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      }
    }
  } else if (Math.abs(b) > 0.0001) {
    // Linear case: bt + c = 0
    const t = -c / b;
    if (t > 0 && t < 1) {
      const mt = 1 - t;
      const val = mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }
  
  return { min, max };
}

/**
 * Recalculate bounding box for a Path when exiting node edit mode
 * This version captures the actual screen position of the first point,
 * recalculates bounds, then adjusts to maintain the same screen position
 * @param {fabric.Path} path - The path to update
 */
function recalculatePathBoundingBoxFinal(path) {
  if (!path || !path.path || path.path.length === 0 || !path.canvas) return;
  
  // STEP 1: Capture the current screen position of the first point (M command)
  const firstCmd = path.path[0];
  if (firstCmd[0] !== 'M') return;
  
  const firstPointLocal = {
    x: firstCmd[1] - path.pathOffset.x,
    y: firstCmd[2] - path.pathOffset.y
  };
  
  // Transform to screen coordinates
  const transformMatrix = path.calcTransformMatrix();
  const firstPointScreen = fabric.util.transformPoint(firstPointLocal, transformMatrix);
  
  // STEP 2: Calculate new bounding box (actual curve bounds, not control points)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let prevX = 0, prevY = 0;
  
  for (const cmd of path.path) {
    const command = cmd[0];
    switch (command) {
      case 'M':
        prevX = cmd[1];
        prevY = cmd[2];
        minX = Math.min(minX, cmd[1]);
        minY = Math.min(minY, cmd[2]);
        maxX = Math.max(maxX, cmd[1]);
        maxY = Math.max(maxY, cmd[2]);
        break;
      case 'L':
        prevX = cmd[1];
        prevY = cmd[2];
        minX = Math.min(minX, cmd[1]);
        minY = Math.min(minY, cmd[2]);
        maxX = Math.max(maxX, cmd[1]);
        maxY = Math.max(maxY, cmd[2]);
        break;
      case 'C':
        const boundsX = getBezierBounds1D(prevX, cmd[1], cmd[3], cmd[5]);
        const boundsY = getBezierBounds1D(prevY, cmd[2], cmd[4], cmd[6]);
        minX = Math.min(minX, boundsX.min);
        maxX = Math.max(maxX, boundsX.max);
        minY = Math.min(minY, boundsY.min);
        maxY = Math.max(maxY, boundsY.max);
        prevX = cmd[5];
        prevY = cmd[6];
        break;
      case 'Q':
        minX = Math.min(minX, cmd[3]);
        minY = Math.min(minY, cmd[4]);
        maxX = Math.max(maxX, cmd[3]);
        maxY = Math.max(maxY, cmd[4]);
        prevX = cmd[3];
        prevY = cmd[4];
        break;
    }
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // STEP 3: Set new pathOffset and dimensions
  const newPathOffset = {
    x: minX + width / 2,
    y: minY + height / 2
  };
  
  path.pathOffset = newPathOffset;
  path.width = width;
  path.height = height;
  
  // STEP 4: Calculate where the first point would now appear with current left/top
  const newFirstPointLocal = {
    x: firstCmd[1] - newPathOffset.x,
    y: firstCmd[2] - newPathOffset.y
  };
  
  // We need to find left/top such that newFirstPointLocal transforms to firstPointScreen
  // For an unrotated, unscaled object: screenX = left + localX, screenY = top + localY
  // But we need to account for any rotation/scaling, so we use the inverse approach:
  
  // Temporarily update coords to get the new transform matrix
  path.setCoords();
  
  // Now calculate where the first point appears with current settings
  const currentMatrix = path.calcTransformMatrix();
  const currentFirstPointScreen = fabric.util.transformPoint(newFirstPointLocal, currentMatrix);
  
  // Calculate the difference and adjust left/top
  const deltaX = firstPointScreen.x - currentFirstPointScreen.x;
  const deltaY = firstPointScreen.y - currentFirstPointScreen.y;
  
  path.set({
    left: path.left + deltaX,
    top: path.top + deltaY
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
 * Shows different styling for selected vs unselected nodes
 */
function renderNodeControl(ctx, left, top, styleOverride, fabricObject) {
  // 'this' is the control object, which has anchorIndex
  const control = this;
  const isSelected = control && control.anchorIndex !== undefined && selectedNodes.has(control.anchorIndex);
  
  const size = isSelected ? 12 : 10;
  ctx.save();
  
  if (isSelected) {
    // Selected node: filled blue with white border (like Inkscape)
    ctx.fillStyle = '#1976d2';
    ctx.strokeStyle = 'white';
  } else {
    // Unselected node: white with blue border
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#1976d2';
  }
  
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Draw diamond shape like Inkscape
  ctx.moveTo(left, top - size/2);
  ctx.lineTo(left + size/2, top);
  ctx.lineTo(left, top + size/2);
  ctx.lineTo(left - size/2, top);
  ctx.closePath();
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
 * For anchor 0 (first point), converts the closing segment (last segment back to first)
 * @param {fabric.Path} path - The path object
 * @param {number} anchorIndex - Index of the anchor point (from getPathAnchors)
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if conversion was successful
 */
export function makeSegmentCurve(path, anchorIndex, canvas) {
  if (!path || !path.path) return false;
  
  const anchors = getPathAnchors(path.path);
  if (anchorIndex < 0 || anchorIndex >= anchors.length) return false;
  
  // Special case: anchor 0 means convert the closing segment
  if (anchorIndex === 0) {
    return makeClosingSegmentCurve(path, canvas);
  }
  
  const anchor = anchors[anchorIndex];
  const commandIndex = anchor.commandIndex;
  const cmd = path.path[commandIndex];
  
  // Can only convert L (line) commands to C (curve)
  if (cmd[0] !== 'L') {
    debugLog('[InkscapeTransformMode] Cannot convert - not a line segment');
    return false;
  }
  
  // Get the previous anchor point to calculate control points
  // (anchorIndex > 0 is guaranteed since we handle 0 above with makeClosingSegmentCurve)
  const prevAnchor = anchors[anchorIndex - 1];
  
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
  
  // Special case: anchor 0 means convert the closing segment
  if (anchorIndex === 0) {
    return makeClosingSegmentLine(path, canvas);
  }
  
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
 * Convert the closing segment curve back to a line (implicit Z)
 * This removes the C command before Z
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if conversion was successful
 */
export function makeClosingSegmentLine(path, canvas) {
  if (!path || !path.path) return false;
  
  const pathData = path.path;
  const lastIndex = pathData.length - 1;
  
  // Check if path ends with Z
  if (pathData[lastIndex][0] !== 'Z') {
    debugLog('[InkscapeTransformMode] Path does not end with Z - no closing segment');
    return false;
  }
  
  // Check if there's a C command before Z (the closing curve)
  if (lastIndex < 1) return false;
  const beforeZ = pathData[lastIndex - 1];
  
  if (beforeZ[0] !== 'C') {
    debugLog('[InkscapeTransformMode] Closing segment is not a curve');
    return false;
  }
  
  // Remove the C command - Z will implicitly draw a line back to start
  pathData.splice(lastIndex - 1, 1);
  
  debugLog('[InkscapeTransformMode] Converted closing curve to line (removed C before Z)');
  
  // Recreate node controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
  
  return true;
}

/**
 * Convert the closing segment (Z) to a cubic bezier curve
 * This replaces Z with a C command that curves back to the first point
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if conversion was successful
 */
export function makeClosingSegmentCurve(path, canvas) {
  if (!path || !path.path) return false;
  
  const pathData = path.path;
  const lastIndex = pathData.length - 1;
  
  // Check if path ends with Z
  if (pathData[lastIndex][0] !== 'Z') {
    debugLog('[InkscapeTransformMode] Path does not end with Z - no closing segment');
    return false;
  }
  
  // Get the first point (M command)
  const firstCmd = pathData[0];
  if (firstCmd[0] !== 'M') {
    debugLog('[InkscapeTransformMode] Path does not start with M');
    return false;
  }
  const endX = firstCmd[1];
  const endY = firstCmd[2];
  
  // Get the last anchor point (before Z)
  let startX, startY;
  const prevCmd = pathData[lastIndex - 1];
  switch (prevCmd[0]) {
    case 'M':
    case 'L':
      startX = prevCmd[1];
      startY = prevCmd[2];
      break;
    case 'C':
      startX = prevCmd[5];
      startY = prevCmd[6];
      break;
    case 'Q':
      startX = prevCmd[3];
      startY = prevCmd[4];
      break;
    default:
      debugLog('[InkscapeTransformMode] Unknown command before Z');
      return false;
  }
  
  // Calculate control points (with perpendicular offset for visible curve)
  const dx = endX - startX;
  const dy = endY - startY;
  const perpX = -dy * 0.25;
  const perpY = dx * 0.25;
  
  const cp1x = startX + dx * 0.33 + perpX;
  const cp1y = startY + dy * 0.33 + perpY;
  const cp2x = startX + dx * 0.67 + perpX;
  const cp2y = startY + dy * 0.67 + perpY;
  
  // Replace Z with C command followed by Z
  // The C command curves back to the first point
  pathData[lastIndex] = ['C', cp1x, cp1y, cp2x, cp2y, endX, endY];
  pathData.push(['Z']);
  
  debugLog('[InkscapeTransformMode] Converted closing segment to curve:', {
    from: [startX, startY],
    to: [endX, endY],
    cp1: [cp1x, cp1y],
    cp2: [cp2x, cp2y]
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
  
  // Also convert the closing segment if path is closed
  if (makeClosingSegmentCurve(path, null)) {
    converted++;
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
 * Convert selected segment(s) to curves
 * Only converts a segment if BOTH of its endpoints are selected
 * If no nodes are selected, converts all segments
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
export function makeSelectedSegmentsCurves(path, canvas) {
  if (!path || !path.path) return;
  
  if (selectedNodes.size === 0) {
    // No selection - convert all
    makeAllSegmentsCurves(path, canvas);
    return;
  }
  
  const pathData = path.path;
  const anchors = getPathAnchors(pathData);
  const numAnchors = anchors.length;
  
  // Check if path is closed
  const lastCmd = pathData[pathData.length - 1];
  const isClosed = lastCmd && lastCmd[0] === 'Z';
  
  let converted = 0;
  
  // Check each segment - a segment connects anchor[i] to anchor[i+1]
  // (or anchor[last] to anchor[0] for closing segment)
  for (let i = 0; i < numAnchors; i++) {
    const nextIndex = (i + 1) % numAnchors;
    
    // Skip the "wrap-around" segment if path is not closed
    if (nextIndex === 0 && !isClosed) continue;
    
    // Only convert if BOTH endpoints are selected
    if (selectedNodes.has(i) && selectedNodes.has(nextIndex)) {
      // This is the segment from anchor[i] to anchor[nextIndex]
      // The command that defines this segment is at anchor[nextIndex].commandIndex
      // (except for closing segment which is implicit)
      
      if (nextIndex === 0) {
        // Closing segment - use makeClosingSegmentCurve
        if (makeClosingSegmentCurve(path, null)) {
          converted++;
        }
      } else {
        // Regular segment - convert anchor[nextIndex]'s command to curve
        if (makeSegmentCurve(path, nextIndex, null)) {
          converted++;
        }
      }
    }
  }
  
  if (converted === 0) {
    debugLog('[InkscapeTransformMode] No segments converted - select both endpoints of a segment');
    return;
  }
  
  debugLog(`[InkscapeTransformMode] Converted ${converted} selected segments to curves`);
  
  // Regenerate controls and render
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
}

/**
 * Convert selected segment(s) to lines
 * Only converts a segment if BOTH of its endpoints are selected
 * If no nodes are selected, converts all segments
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
export function makeSelectedSegmentsLines(path, canvas) {
  if (!path || !path.path) return;
  
  const pathData = path.path;
  
  if (selectedNodes.size === 0) {
    // No selection - convert all curves to lines
    for (let i = 0; i < pathData.length; i++) {
      const cmd = pathData[i];
      if (cmd[0] === 'C') {
        pathData[i] = ['L', cmd[5], cmd[6]];
      } else if (cmd[0] === 'Q') {
        pathData[i] = ['L', cmd[3], cmd[4]];
      }
    }
  } else {
    // Convert only segments where BOTH endpoints are selected
    const anchors = getPathAnchors(pathData);
    const numAnchors = anchors.length;
    
    // Check if path is closed
    const lastCmd = pathData[pathData.length - 1];
    const isClosed = lastCmd && lastCmd[0] === 'Z';
    
    let converted = 0;
    
    for (let i = 0; i < numAnchors; i++) {
      const nextIndex = (i + 1) % numAnchors;
      
      // Skip the "wrap-around" segment if path is not closed
      if (nextIndex === 0 && !isClosed) continue;
      
      // Only convert if BOTH endpoints are selected
      if (selectedNodes.has(i) && selectedNodes.has(nextIndex)) {
        if (nextIndex === 0) {
          // Closing segment - need to handle specially
          // Look for a closing curve (C command that ends at first point)
          for (let j = pathData.length - 2; j >= 0; j--) {
            const cmd = pathData[j];
            if (cmd[0] === 'C') {
              const firstAnchor = anchors[0];
              if (Math.abs(cmd[5] - firstAnchor.x) < 0.001 && 
                  Math.abs(cmd[6] - firstAnchor.y) < 0.001) {
                // This is the closing curve - convert to L
                pathData[j] = ['L', cmd[5], cmd[6]];
                converted++;
                break;
              }
            }
            if (cmd[0] === 'M') break;
          }
        } else {
          // Regular segment
          makeSegmentLine(path, nextIndex, null);
          converted++;
        }
      }
    }
    
    if (converted === 0) {
      debugLog('[InkscapeTransformMode] No segments converted - select both endpoints of a segment');
      return;
    }
  }
  
  debugLog(`[InkscapeTransformMode] Converted selected segments to lines`);
  
  // Regenerate controls and render
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
}

/**
 * Delete selected node(s) from the path
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if any nodes were deleted
 */
export function deleteSelectedNodes(path, canvas) {
  if (!path || !path.path || selectedNodes.size === 0) return false;
  
  const pathData = path.path;
  let anchors = getPathAnchors(pathData);
  
  // Sort selected indices in descending order to delete from end first
  // This prevents index shifting issues
  const sortedIndices = Array.from(selectedNodes).sort((a, b) => b - a);
  
  let deleted = 0;
  
  for (const anchorIndex of sortedIndices) {
    // Recalculate anchors after each deletion since indices change
    anchors = getPathAnchors(pathData);
    
    if (anchorIndex < 0 || anchorIndex >= anchors.length) continue;
    
    // Don't allow deleting if it would leave less than 2 points
    if (anchors.length - deleted <= 2) {
      debugLog('[InkscapeTransformMode] Cannot delete - path needs at least 2 points');
      break;
    }
    
    const anchor = anchors[anchorIndex];
    const commandIndex = anchor.commandIndex;
    
    // Special handling for first point (M command)
    if (anchorIndex === 0) {
      // We need to promote the next point to be the new M command
      if (anchors.length > 1) {
        const nextAnchor = anchors[1];
        const nextCmdIndex = nextAnchor.commandIndex;
        const nextCmd = pathData[nextCmdIndex];
        
        // Update the M command with the next point's position
        pathData[0][1] = nextAnchor.x;
        pathData[0][2] = nextAnchor.y;
        
        // Remove the next command (which has now been absorbed into M)
        pathData.splice(nextCmdIndex, 1);
        
        deleted++;
        debugLog(`[InkscapeTransformMode] Deleted first node, promoted next point to M`);
      }
      continue;
    }
    
    // Remove the command at this index
    pathData.splice(commandIndex, 1);
    deleted++;
    
    debugLog(`[InkscapeTransformMode] Deleted node at anchor ${anchorIndex}, command ${commandIndex}`);
  }
  
  if (deleted > 0) {
    // Clear selection since indices are now invalid
    selectedNodes.clear();
    
    // Regenerate controls
    const nodeControls = createPathNodeControls(path);
    path.controls = nodeControls;
    path.dirty = true;
    path.setCoords();
    if (canvas) canvas.requestRenderAll();
  }
  
  return deleted > 0;
}

/**
 * Add a node to the closing segment (last anchor to first anchor)
 * @param {fabric.Path} path - The path object
 * @param {Array} anchors - Array of anchor objects from getPathAnchors
 * @param {number} lastAnchorIndex - Index of the last anchor
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if a node was added
 */
function addNodeToClosingSegment(path, anchors, lastAnchorIndex, canvas) {
  const pathData = path.path;
  const lastIndex = pathData.length - 1;
  
  // Make sure path ends with Z
  if (pathData[lastIndex][0] !== 'Z') {
    debugLog('[InkscapeTransformMode] Path does not end with Z - no closing segment');
    return false;
  }
  
  // Get the first point (M command) - this is where the closing segment ends
  const firstCmd = pathData[0];
  if (firstCmd[0] !== 'M') {
    debugLog('[InkscapeTransformMode] Path does not start with M');
    return false;
  }
  const endX = firstCmd[1];
  const endY = firstCmd[2];
  
  // Get the last anchor point (before Z) - this is where the closing segment starts
  const lastAnchor = anchors[lastAnchorIndex];
  const startX = lastAnchor.x;
  const startY = lastAnchor.y;
  
  // Check if there's an explicit command for the closing segment (C before Z)
  // or if it's an implicit straight line
  const prevCmd = pathData[lastIndex - 1];
  const prevCmdType = prevCmd[0];
  
  // Check if the command before Z explicitly goes to first point (explicit closing segment)
  // or if Z just creates an implicit line from the last anchor to first
  let isExplicitClosingCurve = false;
  if (prevCmdType === 'C') {
    // Check if the C command ends at the first point
    const cEndX = prevCmd[5];
    const cEndY = prevCmd[6];
    if (Math.abs(cEndX - endX) < 0.01 && Math.abs(cEndY - endY) < 0.01) {
      isExplicitClosingCurve = true;
    }
  }
  
  if (isExplicitClosingCurve) {
    // Split the explicit C command that goes to the first point
    const cp1x = prevCmd[1], cp1y = prevCmd[2];
    const cp2x = prevCmd[3], cp2y = prevCmd[4];
    // endX, endY are the curve's end point (which equals first point)
    
    // Get the actual start of this C command (the anchor before it)
    const cmdStartAnchor = anchors[lastAnchorIndex - 1] || anchors[lastAnchorIndex];
    const cStartX = cmdStartAnchor.x;
    const cStartY = cmdStartAnchor.y;
    
    const t = 0.5;
    
    // de Casteljau's algorithm
    const p01x = cStartX + t * (cp1x - cStartX);
    const p01y = cStartY + t * (cp1y - cStartY);
    const p12x = cp1x + t * (cp2x - cp1x);
    const p12y = cp1y + t * (cp2y - cp1y);
    const p23x = cp2x + t * (endX - cp2x);
    const p23y = cp2y + t * (endY - cp2y);
    
    const p012x = p01x + t * (p12x - p01x);
    const p012y = p01y + t * (p12y - p01y);
    const p123x = p12x + t * (p23x - p12x);
    const p123y = p12y + t * (p23y - p12y);
    
    const midX = p012x + t * (p123x - p012x);
    const midY = p012y + t * (p123y - p012y);
    
    // Replace the C command with first half
    pathData[lastIndex - 1] = ['C', p01x, p01y, p012x, p012y, midX, midY];
    
    // Insert second half before Z
    pathData.splice(lastIndex, 0, ['C', p123x, p123y, p23x, p23y, endX, endY]);
    
    debugLog(`[InkscapeTransformMode] Split closing bezier at midpoint: (${midX}, ${midY})`);
    
  } else {
    // Implicit straight line from last anchor to first - insert L commands
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Insert L to midpoint, then L to first point, before Z
    // Actually, we just need one L to the midpoint - the Z will still close to first point
    pathData.splice(lastIndex, 0, ['L', midX, midY]);
    
    debugLog(`[InkscapeTransformMode] Added node at midpoint of closing segment: (${midX}, ${midY})`);
  }
  
  // Clear selection and select the new node (it's now the last anchor before Z)
  selectedNodes.clear();
  // The new node is at index lastAnchorIndex + 1 (one after the previous last anchor)
  selectedNodes.add(lastAnchorIndex + 1);
  
  // Regenerate controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
  
  return true;
}

/**
 * Add a node by splitting a segment at its midpoint
 * Adds a node to the segment AFTER the selected node
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 * @returns {boolean} True if a node was added
 */
export function addNodeAtSelectedSegment(path, canvas) {
  if (!path || !path.path) return false;
  
  const pathData = path.path;
  const anchors = getPathAnchors(pathData);
  const numAnchors = anchors.length;
  
  // Check if path is closed
  const lastCmd = pathData[pathData.length - 1];
  const isClosed = lastCmd && lastCmd[0] === 'Z';
  
  // Find a segment where BOTH endpoints are selected
  let segmentStart = -1;
  let segmentEnd = -1;
  
  for (let i = 0; i < numAnchors; i++) {
    const nextIndex = (i + 1) % numAnchors;
    
    // Skip wrap-around segment if path is not closed
    if (nextIndex === 0 && !isClosed) continue;
    
    // Check if both endpoints are selected
    if (selectedNodes.has(i) && selectedNodes.has(nextIndex)) {
      segmentStart = i;
      segmentEnd = nextIndex;
      break; // Use first matching segment
    }
  }
  
  if (segmentStart === -1) {
    debugLog('[InkscapeTransformMode] Select both endpoints of a segment to add a node');
    return false;
  }
  
  // Handle closing segment specially (last anchor to first anchor)
  if (segmentEnd === 0) {
    return addNodeToClosingSegment(path, anchors, segmentStart, canvas);
  }
  
  const currentAnchor = anchors[segmentStart];
  const nextCommandIndex = anchors[segmentEnd].commandIndex;
  const nextCmd = pathData[nextCommandIndex];
  
  // Get start point (current anchor)
  const startX = currentAnchor.x;
  const startY = currentAnchor.y;
  
  if (nextCmd[0] === 'L') {
    // Split a line segment - insert new L at midpoint
    const endX = nextCmd[1];
    const endY = nextCmd[2];
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Insert new L command at the midpoint
    pathData.splice(nextCommandIndex, 0, ['L', midX, midY]);
    
    debugLog(`[InkscapeTransformMode] Added node at midpoint of line segment: (${midX}, ${midY})`);
    
  } else if (nextCmd[0] === 'C') {
    // Split a cubic bezier using de Casteljau's algorithm at t=0.5
    const cp1x = nextCmd[1], cp1y = nextCmd[2];
    const cp2x = nextCmd[3], cp2y = nextCmd[4];
    const endX = nextCmd[5], endY = nextCmd[6];
    
    const t = 0.5;
    
    // First level interpolation
    const p01x = startX + t * (cp1x - startX);
    const p01y = startY + t * (cp1y - startY);
    const p12x = cp1x + t * (cp2x - cp1x);
    const p12y = cp1y + t * (cp2y - cp1y);
    const p23x = cp2x + t * (endX - cp2x);
    const p23y = cp2y + t * (endY - cp2y);
    
    // Second level interpolation
    const p012x = p01x + t * (p12x - p01x);
    const p012y = p01y + t * (p12y - p01y);
    const p123x = p12x + t * (p23x - p12x);
    const p123y = p12y + t * (p23y - p12y);
    
    // Third level - the point on the curve
    const midX = p012x + t * (p123x - p012x);
    const midY = p012y + t * (p123y - p012y);
    
    // Replace original C with first half curve
    pathData[nextCommandIndex] = ['C', p01x, p01y, p012x, p012y, midX, midY];
    
    // Insert second half curve after
    pathData.splice(nextCommandIndex + 1, 0, ['C', p123x, p123y, p23x, p23y, endX, endY]);
    
    debugLog(`[InkscapeTransformMode] Split bezier curve at midpoint: (${midX}, ${midY})`);
    
  } else {
    debugLog(`[InkscapeTransformMode] Cannot split segment type: ${nextCmd[0]}`);
    return false;
  }
  
  // Clear selection and select the new node
  selectedNodes.clear();
  selectedNodes.add(segmentStart + 1);
  
  // Regenerate controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
  
  return true;
}

/**
 * Make selected node(s) cusp (corner) - handles move independently
 * This is the default behavior, so this mainly serves as a visual indicator
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
export function makeNodesCusp(path, canvas) {
  if (!path || !path.path || selectedNodes.size === 0) return;
  
  // For cusp nodes, we don't need to change the path data
  // The handles already move independently
  // This could store node type metadata for future use
  
  debugLog(`[InkscapeTransformMode] Set ${selectedNodes.size} node(s) to cusp type`);
  
  // Mark nodes as cusp type (for potential future visualization)
  for (const anchorIndex of selectedNodes) {
    // Store node type on the path object
    if (!path._nodeTypes) path._nodeTypes = {};
    path._nodeTypes[anchorIndex] = 'cusp';
  }
  
  if (canvas) canvas.requestRenderAll();
}

/**
 * Make selected node(s) smooth - handles are collinear but can have different lengths
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
/**
 * Get the incoming and outgoing handles for an anchor
 * Properly handles anchor 0 in closed paths (handles wrap around)
 * @param {Array} pathData - The path data array
 * @param {Array} anchors - The anchors array from getPathAnchors
 * @param {number} anchorIndex - Index of the anchor
 * @returns {Object} {inHandle: {cmdIndex, x, y}|null, outHandle: {cmdIndex, x, y}|null}
 */
function getHandlesForAnchor(pathData, anchors, anchorIndex) {
  const result = { inHandle: null, outHandle: null };
  
  if (anchorIndex < 0 || anchorIndex >= anchors.length) return result;
  
  const anchor = anchors[anchorIndex];
  
  // Skip if this is a closing curve (it doesn't have its own handles in the UI sense)
  if (anchor.isClosingCurve) return result;
  
  // Check if path is closed
  const lastCmd = pathData[pathData.length - 1];
  const isClosed = lastCmd && lastCmd[0] === 'Z';
  
  // Get first point for detecting closing curves
  const firstX = pathData[0][1];
  const firstY = pathData[0][2];
  
  // Find the "real" last anchor index (excluding closing curve)
  let lastRealAnchorIndex = anchors.length - 1;
  if (anchors[lastRealAnchorIndex] && anchors[lastRealAnchorIndex].isClosingCurve) {
    lastRealAnchorIndex--;
  }
  
  // Find incoming handle (cp2)
  if (anchor.command === 'C') {
    // Regular C command - cp2 is in this command
    result.inHandle = {
      cmdIndex: anchor.commandIndex,
      x: anchor.cp2x,
      y: anchor.cp2y
    };
  } else if (anchorIndex === 0 && isClosed) {
    // Anchor 0 in closed path - look for closing curve's cp2
    for (let i = pathData.length - 2; i >= 0; i--) {
      const cmd = pathData[i];
      if (cmd[0] === 'C') {
        if (Math.abs(cmd[5] - firstX) < 0.001 && Math.abs(cmd[6] - firstY) < 0.001) {
          result.inHandle = {
            cmdIndex: i,
            x: cmd[3],
            y: cmd[4]
          };
          break;
        }
      }
      if (cmd[0] === 'M') break;
    }
  }
  
  // Find outgoing handle (cp1 of next curve)
  if (anchorIndex === 0) {
    // Anchor 0 - look for first C command after M
    for (let i = 1; i < pathData.length; i++) {
      if (pathData[i][0] === 'C') {
        result.outHandle = {
          cmdIndex: i,
          x: pathData[i][1],
          y: pathData[i][2]
        };
        break;
      }
      if (pathData[i][0] === 'Z') break;
    }
  } else if (anchorIndex < anchors.length - 1) {
    // Look at next anchor's command
    const nextAnchor = anchors[anchorIndex + 1];
    if (nextAnchor.command === 'C') {
      result.outHandle = {
        cmdIndex: nextAnchor.commandIndex,
        x: pathData[nextAnchor.commandIndex][1],
        y: pathData[nextAnchor.commandIndex][2]
      };
    }
  } else if (isClosed && anchorIndex === lastRealAnchorIndex) {
    // Last real anchor in closed path - look for closing curve's cp1
    // The closing curve goes FROM this anchor TO anchor 0
    for (let i = pathData.length - 2; i >= 0; i--) {
      const cmd = pathData[i];
      if (cmd[0] === 'C') {
        if (Math.abs(cmd[5] - firstX) < 0.001 && Math.abs(cmd[6] - firstY) < 0.001) {
          result.outHandle = {
            cmdIndex: i,
            x: cmd[1],
            y: cmd[2]
          };
          break;
        }
      }
      if (cmd[0] === 'M') break;
    }
  }
  
  return result;
}

export function makeNodesSmooth(path, canvas) {
  if (!path || !path.path || selectedNodes.size === 0) return;
  
  const pathData = path.path;
  const anchors = getPathAnchors(pathData);
  
  for (const anchorIndex of selectedNodes) {
    if (anchorIndex < 0 || anchorIndex >= anchors.length) continue;
    
    const anchor = anchors[anchorIndex];
    const anchorX = anchor.x;
    const anchorY = anchor.y;
    
    // Get handles using the helper function
    const handles = getHandlesForAnchor(pathData, anchors, anchorIndex);
    
    const inHandle = handles.inHandle;
    const outHandle = handles.outHandle;
    
    // If we have both handles, make them collinear
    if (inHandle && outHandle) {
      // Calculate the average direction
      const inDx = anchorX - inHandle.x;
      const inDy = anchorY - inHandle.y;
      const outDx = outHandle.x - anchorX;
      const outDy = outHandle.y - anchorY;
      
      const inLen = Math.sqrt(inDx * inDx + inDy * inDy);
      const outLen = Math.sqrt(outDx * outDx + outDy * outDy);
      
      if (inLen > 0 && outLen > 0) {
        // Average the directions (normalized)
        const avgDx = (inDx / inLen + outDx / outLen) / 2;
        const avgDy = (inDy / inLen + outDy / outLen) / 2;
        const avgLen = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
        
        if (avgLen > 0) {
          const normDx = avgDx / avgLen;
          const normDy = avgDy / avgLen;
          
          // Update incoming handle (cp2) - keep original length
          const newInX = anchorX - normDx * inLen;
          const newInY = anchorY - normDy * inLen;
          pathData[inHandle.cmdIndex][3] = newInX;
          pathData[inHandle.cmdIndex][4] = newInY;
          
          // Update outgoing handle (cp1) - keep original length
          const newOutX = anchorX + normDx * outLen;
          const newOutY = anchorY + normDy * outLen;
          pathData[outHandle.cmdIndex][1] = newOutX;
          pathData[outHandle.cmdIndex][2] = newOutY;
        }
      }
    }
    
    // Store node type
    if (!path._nodeTypes) path._nodeTypes = {};
    path._nodeTypes[anchorIndex] = 'smooth';
  }
  
  debugLog(`[InkscapeTransformMode] Set ${selectedNodes.size} node(s) to smooth type`);
  
  // Regenerate controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
}

/**
 * Make selected node(s) auto-smooth - handles are collinear and symmetric
 * @param {fabric.Path} path - The path object
 * @param {fabric.Canvas} canvas - The canvas instance
 */
export function makeNodesAutoSmooth(path, canvas) {
  if (!path || !path.path || selectedNodes.size === 0) return;
  
  const pathData = path.path;
  const anchors = getPathAnchors(pathData);
  
  // Check if path is closed
  const lastCmd = pathData[pathData.length - 1];
  const isClosed = lastCmd && lastCmd[0] === 'Z';
  
  // Find the "real" last anchor index (excluding closing curve)
  let lastRealAnchorIndex = anchors.length - 1;
  if (anchors[lastRealAnchorIndex] && anchors[lastRealAnchorIndex].isClosingCurve) {
    lastRealAnchorIndex--;
  }
  
  for (const anchorIndex of selectedNodes) {
    if (anchorIndex < 0 || anchorIndex >= anchors.length) continue;
    
    const anchor = anchors[anchorIndex];
    
    // Skip closing curve anchors
    if (anchor.isClosingCurve) continue;
    
    const anchorX = anchor.x;
    const anchorY = anchor.y;
    
    // Get previous and next anchor points for auto-smooth calculation
    let prevX, prevY, nextX, nextY;
    
    if (anchorIndex > 0) {
      const prevAnchor = anchors[anchorIndex - 1];
      if (!prevAnchor.isClosingCurve) {
        prevX = prevAnchor.x;
        prevY = prevAnchor.y;
      }
    } else if (isClosed && lastRealAnchorIndex > 0) {
      // Anchor 0 in closed path - previous is last real anchor
      const prevAnchor = anchors[lastRealAnchorIndex];
      prevX = prevAnchor.x;
      prevY = prevAnchor.y;
    }
    
    if (anchorIndex < lastRealAnchorIndex) {
      const nextAnchor = anchors[anchorIndex + 1];
      if (!nextAnchor.isClosingCurve) {
        nextX = nextAnchor.x;
        nextY = nextAnchor.y;
      }
    } else if (isClosed && anchorIndex === lastRealAnchorIndex) {
      // Last real anchor in closed path - next is anchor 0
      nextX = anchors[0].x;
      nextY = anchors[0].y;
    }
    
    // Calculate smooth handles based on neighboring anchors
    if (prevX !== undefined && nextX !== undefined) {
      // Direction from prev to next anchor
      const dx = nextX - prevX;
      const dy = nextY - prevY;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len > 0) {
        const normDx = dx / len;
        const normDy = dy / len;
        
        // Calculate handle length as 1/3 of distance to neighbors
        const prevDist = Math.sqrt((anchorX - prevX) ** 2 + (anchorY - prevY) ** 2);
        const nextDist = Math.sqrt((nextX - anchorX) ** 2 + (nextY - anchorY) ** 2);
        const handleLen = Math.min(prevDist, nextDist) / 3;
        
        // Get handles using the helper
        const handles = getHandlesForAnchor(pathData, anchors, anchorIndex);
        
        // Update incoming handle (cp2)
        if (handles.inHandle) {
          pathData[handles.inHandle.cmdIndex][3] = anchorX - normDx * handleLen;
          pathData[handles.inHandle.cmdIndex][4] = anchorY - normDy * handleLen;
        }
        
        // Update outgoing handle (cp1)
        if (handles.outHandle) {
          pathData[handles.outHandle.cmdIndex][1] = anchorX + normDx * handleLen;
          pathData[handles.outHandle.cmdIndex][2] = anchorY + normDy * handleLen;
        }
      }
    }
    
    // Store node type
    if (!path._nodeTypes) path._nodeTypes = {};
    path._nodeTypes[anchorIndex] = 'auto-smooth';
  }
  
  debugLog(`[InkscapeTransformMode] Set ${selectedNodes.size} node(s) to auto-smooth type`);
  
  // Regenerate controls
  const nodeControls = createPathNodeControls(path);
  path.controls = nodeControls;
  path.dirty = true;
  path.setCoords();
  if (canvas) canvas.requestRenderAll();
}

/**
 * Export mode constants for external use
 */
export { MODE as TRANSFORM_MODE };
