/**
 * PenToolController
 * Handles drawing polylines/polygons by clicking to place vertices
 * Based on Fabric.js poly-controls pattern for node editing
 */

import { canvas } from './canvas.js';

class PenToolController {
  constructor() {
    this.isEnabled = false;
    this.isDrawing = false;
    this.points = []; // Array of {x, y} points
    this.currentPath = null; // The polyline being drawn
    this.previewLine = null; // Line from last point to cursor
    this.startPointIndicator = null; // Circle indicating first point (for closing)
    
    // Event handlers
    this.mouseDownHandler = null;
    this.mouseMoveHandler = null;
    this.keyDownHandler = null;
    this.dblClickHandler = null;
    
    // Reference to FillStrokePanel for colors
    this.fillStrokePanel = null;
    
    // Configuration
    this.closeThreshold = 15; // Distance to first point to close path
    this.pointIndicatorRadius = 6;
  }

  /**
   * Set the FillStrokePanel reference for color picking
   * @param {FillStrokePanel} panel - The FillStrokePanel instance
   */
  setFillStrokePanel(panel) {
    this.fillStrokePanel = panel;
  }

  /**
   * Enable pen tool mode
   */
  enable() {
    if (this.isEnabled) {
      console.log('[PenTool] Already enabled');
      return;
    }

    this.isEnabled = true;

    // Make canvas non-selectable while drawing
    canvas.selection = false;
    canvas.forEachObject(obj => {
      obj._wasSelectable = obj.selectable;
      obj._wasEvented = obj.evented;
      obj.selectable = false;
      obj.evented = false;
    });

    // Setup event handlers
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.keyDownHandler = this.onKeyDown.bind(this);
    this.dblClickHandler = this.onDoubleClick.bind(this);

    canvas.on('mouse:down', this.mouseDownHandler);
    canvas.on('mouse:move', this.mouseMoveHandler);
    canvas.on('mouse:dblclick', this.dblClickHandler);
    window.addEventListener('keydown', this.keyDownHandler);

    // Change cursor
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';

    console.log('[PenTool] Enabled');
  }

  /**
   * Disable pen tool mode
   */
  disable() {
    if (!this.isEnabled) return;

    // Cancel any in-progress drawing (don't auto-finish)
    this.cancelDrawing();

    // Remove event handlers
    canvas.off('mouse:down', this.mouseDownHandler);
    canvas.off('mouse:move', this.mouseMoveHandler);
    canvas.off('mouse:dblclick', this.dblClickHandler);
    window.removeEventListener('keydown', this.keyDownHandler);

    // Restore canvas interactivity
    canvas.selection = true;
    canvas.forEachObject(obj => {
      if (obj._wasSelectable !== undefined) {
        obj.selectable = obj._wasSelectable;
        obj.evented = obj._wasEvented;
        delete obj._wasSelectable;
        delete obj._wasEvented;
      }
    });

    // Reset cursor
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    this.isEnabled = false;
    console.log('[PenTool] Disabled');
  }

  /**
   * Handle mouse down - add a point
   */
  onMouseDown(e) {
    // Ignore if not left click
    if (e.e.button !== 0) return;
    
    const pointer = canvas.getPointer(e.e);
    
    // Check if clicking near start point to close path
    if (this.isDrawing && this.points.length >= 3) {
      const firstPoint = this.points[0];
      const distance = Math.sqrt(
        Math.pow(pointer.x - firstPoint.x, 2) + 
        Math.pow(pointer.y - firstPoint.y, 2)
      );
      
      if (distance < this.closeThreshold) {
        this.finishPath(true); // Close the path
        return;
      }
    }
    
    // Add new point
    this.addPoint(pointer.x, pointer.y);
  }

  /**
   * Handle mouse move - update preview line
   */
  onMouseMove(e) {
    if (!this.isDrawing || this.points.length === 0) return;
    
    const pointer = canvas.getPointer(e.e);
    this.updatePreviewLine(pointer.x, pointer.y);
    this.updateStartPointIndicator(pointer.x, pointer.y);
  }

  /**
   * Handle double click - finish path
   */
  onDoubleClick(e) {
    if (!this.isDrawing) return;
    
    // Remove the last point added by the first click of the double-click
    if (this.points.length > 2) {
      this.points.pop();
      this.finishPath(false);
    }
  }

  /**
   * Handle key press
   */
  onKeyDown(e) {
    if (!this.isEnabled) return;
    
    if (e.key === 'Enter') {
      // Finish path
      if (this.isDrawing && this.points.length >= 2) {
        this.finishPath(false);
      }
    } else if (e.key === 'Escape') {
      // Cancel drawing
      this.cancelDrawing();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // Remove last point
      if (this.isDrawing && this.points.length > 1) {
        e.preventDefault();
        this.removeLastPoint();
      }
    }
  }

  /**
   * Add a point to the path
   */
  addPoint(x, y) {
    // Don't add point if too close to the last one
    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1];
      const distance = Math.sqrt(
        Math.pow(x - lastPoint.x, 2) + 
        Math.pow(y - lastPoint.y, 2)
      );
      if (distance < 5) return;
    }
    
    this.points.push({ x, y });
    
    if (!this.isDrawing) {
      this.isDrawing = true;
      this.createPath();
      this.createStartPointIndicator();
    } else {
      this.updatePath();
    }
    
    console.log('[PenTool] Added point', this.points.length, 'at', x.toFixed(0), y.toFixed(0));
  }

  /**
   * Remove the last point
   */
  removeLastPoint() {
    if (this.points.length <= 1) return;
    
    this.points.pop();
    this.updatePath();
    
    console.log('[PenTool] Removed last point, now have', this.points.length);
  }

  /**
   * Create the initial path object
   */
  createPath() {
    // Get colors from FillStrokePanel or use defaults
    const strokeColor = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastStrokeColor() 
      : '#000000';
    const strokeWidth = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastStrokeWidth() 
      : 0.3;
    
    // Create polyline (no fill while drawing)
    this.currentPath = new fabric.Polyline(this.points, {
      fill: 'transparent',
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      selectable: false,
      evented: false,
      objectCaching: false
    });
    
    canvas.add(this.currentPath);
    
    // Create preview line
    this.previewLine = new fabric.Line([0, 0, 0, 0], {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false
    });
    canvas.add(this.previewLine);
  }

  /**
   * Create indicator for the start point
   */
  createStartPointIndicator() {
    if (this.points.length === 0) return;
    
    const firstPoint = this.points[0];
    this.startPointIndicator = new fabric.Circle({
      left: firstPoint.x,
      top: firstPoint.y,
      radius: this.pointIndicatorRadius,
      fill: 'white',
      stroke: '#1976d2',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });
    canvas.add(this.startPointIndicator);
  }

  /**
   * Update the path with current points
   */
  updatePath() {
    if (!this.currentPath) return;
    
    // Remove old path and create new one with updated points
    canvas.remove(this.currentPath);
    
    const strokeColor = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastStrokeColor() 
      : '#000000';
    const strokeWidth = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastStrokeWidth() 
      : 0.3;
    
    this.currentPath = new fabric.Polyline([...this.points], {
      fill: 'transparent',
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      selectable: false,
      evented: false,
      objectCaching: false
    });
    
    canvas.add(this.currentPath);
    canvas.requestRenderAll();
  }

  /**
   * Update the preview line from last point to cursor
   */
  updatePreviewLine(x, y) {
    if (!this.previewLine || this.points.length === 0) return;
    
    const lastPoint = this.points[this.points.length - 1];
    this.previewLine.set({
      x1: lastPoint.x,
      y1: lastPoint.y,
      x2: x,
      y2: y
    });
    this.previewLine.setCoords();
    canvas.requestRenderAll();
  }

  /**
   * Update start point indicator appearance based on cursor proximity
   */
  updateStartPointIndicator(x, y) {
    if (!this.startPointIndicator || this.points.length < 3) return;
    
    const firstPoint = this.points[0];
    const distance = Math.sqrt(
      Math.pow(x - firstPoint.x, 2) + 
      Math.pow(y - firstPoint.y, 2)
    );
    
    // Highlight when close enough to close
    if (distance < this.closeThreshold) {
      this.startPointIndicator.set({
        fill: '#1976d2',
        radius: this.pointIndicatorRadius + 2
      });
    } else {
      this.startPointIndicator.set({
        fill: 'white',
        radius: this.pointIndicatorRadius
      });
    }
  }

  /**
   * Finish the path
   * @param {boolean} closed - Whether to close the path
   */
  finishPath(closed) {
    if (this.points.length < 2) {
      this.cancelDrawing();
      return;
    }
    
    // Remove temporary objects
    if (this.previewLine) {
      canvas.remove(this.previewLine);
      this.previewLine = null;
    }
    if (this.startPointIndicator) {
      canvas.remove(this.startPointIndicator);
      this.startPointIndicator = null;
    }
    if (this.currentPath) {
      canvas.remove(this.currentPath);
    }
    
    // Get colors
    const fillColor = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastFillColor() 
      : 'transparent';
    const strokeColor = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastStrokeColor() 
      : '#000000';
    const strokeWidth = this.fillStrokePanel 
      ? this.fillStrokePanel.getLastStrokeWidth() 
      : 0.3;
    
    // Create final shape
    let finalShape;
    if (closed) {
      finalShape = new fabric.Polygon([...this.points], {
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        selectable: true,
        evented: true,
        objectCaching: false
      });
    } else {
      finalShape = new fabric.Polyline([...this.points], {
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        selectable: true,
        evented: true,
        objectCaching: false
      });
    }
    
    // TODO: Node editing is disabled for now as it conflicts with InkscapeTransformMode
    // The custom controls replace standard controls which breaks selection handling
    // this.addNodeControls(finalShape);
    
    // Store original points for future editing
    finalShape.penToolPoints = [...this.points];
    
    canvas.add(finalShape);
    canvas.setActiveObject(finalShape);
    canvas.requestRenderAll();
    
    // Fire event for undo/redo
    canvas.fire('object:added', { target: finalShape });
    
    console.log('[PenTool] Finished path with', this.points.length, 'points, closed:', closed);
    
    // Reset state completely
    this.points = [];
    this.currentPath = null;
    this.previewLine = null;
    this.startPointIndicator = null;
    this.isDrawing = false;
  }

  /**
   * Cancel the current drawing
   */
  cancelDrawing() {
    // Remove temporary objects
    if (this.previewLine) {
      canvas.remove(this.previewLine);
      this.previewLine = null;
    }
    if (this.startPointIndicator) {
      canvas.remove(this.startPointIndicator);
      this.startPointIndicator = null;
    }
    if (this.currentPath) {
      canvas.remove(this.currentPath);
      this.currentPath = null;
    }
    
    // Reset state
    this.points = [];
    this.isDrawing = false;
    
    canvas.requestRenderAll();
    console.log('[PenTool] Drawing cancelled');
  }

  /**
   * Add custom node controls to a polygon/polyline
   * Based on Fabric.js poly-controls demo
   */
  addNodeControls(shape) {
    // Define the control render function
    function renderPointControl(ctx, left, top, styleOverride, fabricObject) {
      const size = 8;
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
    
    // Position handler for point controls
    function pointPositionHandler(dim, finalMatrix, fabricObject, point) {
      const points = fabricObject.points;
      const pointIndex = parseInt(this.pointIndex);
      
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
    }
    
    // Action handler for dragging points
    function pointActionHandler(eventData, transform, x, y) {
      const polygon = transform.target;
      const pointIndex = parseInt(transform.corner.replace('p', ''));
      const mouseLocalPosition = polygon.toLocalPoint(
        new fabric.Point(x, y),
        'center',
        'center'
      );
      
      polygon.points[pointIndex] = {
        x: mouseLocalPosition.x + polygon.pathOffset.x,
        y: mouseLocalPosition.y + polygon.pathOffset.y
      };
      
      // Update penToolPoints if stored
      if (polygon.penToolPoints) {
        polygon.penToolPoints[pointIndex] = { ...polygon.points[pointIndex] };
      }
      
      polygon.dirty = true;
      polygon.setCoords();
      return true;
    }
    
    // Create a control for each point
    const points = shape.points;
    const controls = {};
    
    for (let i = 0; i < points.length; i++) {
      controls['p' + i] = new fabric.Control({
        positionHandler: pointPositionHandler,
        actionHandler: pointActionHandler,
        render: renderPointControl,
        pointIndex: i,
        actionName: 'modifyPolygon',
        cursorStyle: 'pointer'
      });
    }
    
    shape.controls = controls;
    
    // Disable default controls
    shape.setControlsVisibility({
      mt: false, mb: false, ml: false, mr: false,
      bl: false, br: false, tl: false, tr: false,
      mtr: false
    });
  }
}

// Export singleton instance
export const penToolController = new PenToolController();
