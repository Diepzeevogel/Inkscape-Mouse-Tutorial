/**
 * ShapeDrawingController
 * Handles drawing rectangles and ellipses by dragging on the canvas
 * Provides dimension controls in the top toolbar
 */

import { canvas } from './canvas.js';

class ShapeDrawingController {
  constructor() {
    this.isEnabled = false;
    this.activeShapeType = null; // 'rect' or 'ellipse'
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentShape = null;
    
    // Event handlers
    this.mouseDownHandler = null;
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;
    
    // Dimension controls
    this.dimensionControls = null;
    
    // Reference to FillStrokePanel for getting colors
    this.fillStrokePanel = null;
  }

  /**
   * Set the FillStrokePanel reference for color picking
   * @param {FillStrokePanel} panel - The FillStrokePanel instance
   */
  setFillStrokePanel(panel) {
    this.fillStrokePanel = panel;
  }

  /**
   * Enable shape drawing mode
   * @param {string} shapeType - 'rect' or 'ellipse'
   */
  enable(shapeType) {
    if (this.isEnabled && this.activeShapeType === shapeType) {
      console.log('[ShapeDrawing] Already enabled for', shapeType);
      return;
    }

    // Disable any previous mode
    this.disable();

    this.activeShapeType = shapeType;
    this.isEnabled = true;

    // Make canvas non-selectable while drawing
    canvas.selection = false;
    canvas.forEachObject(obj => {
      obj.selectable = false;
      obj.evented = false;
    });

    // Setup event handlers
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.mouseUpHandler = this.onMouseUp.bind(this);

    canvas.on('mouse:down', this.mouseDownHandler);
    canvas.on('mouse:move', this.mouseMoveHandler);
    canvas.on('mouse:up', this.mouseUpHandler);

    // Create dimension controls
    this.createDimensionControls(shapeType);

    console.log('[ShapeDrawing] Enabled for', shapeType);
  }

  /**
   * Disable shape drawing mode
   */
  disable() {
    if (!this.isEnabled) return;

    // Remove event handlers
    if (this.mouseDownHandler) {
      canvas.off('mouse:down', this.mouseDownHandler);
      canvas.off('mouse:move', this.mouseMoveHandler);
      canvas.off('mouse:up', this.mouseUpHandler);
    }

    // Restore canvas interactivity
    canvas.selection = true;
    canvas.forEachObject(obj => {
      obj.selectable = true;
      obj.evented = true;
    });

    // Remove dimension controls
    this.removeDimensionControls();

    this.isEnabled = false;
    this.activeShapeType = null;
    this.isDrawing = false;
    this.currentShape = null;

    console.log('[ShapeDrawing] Disabled');
  }

  /**
   * Create dimension control inputs in the toolbar
   */
  createDimensionControls(shapeType) {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    // Create container for dimension controls
    const container = document.createElement('div');
    container.id = 'dimension-controls';
    container.className = 'dimension-controls';

    if (shapeType === 'rect') {
      container.innerHTML = `
        <div class="dimension-group">
          <label>B:</label>
          <input type="number" id="shape-width" min="0" step="0.1" value="0" />
        </div>
        <div class="dimension-group">
          <label>H:</label>
          <input type="number" id="shape-height" min="0" step="0.1" value="0" />
        </div>
      `;
    } else if (shapeType === 'ellipse') {
      container.innerHTML = `
        <div class="dimension-group">
          <label>Rx:</label>
          <input type="number" id="shape-rx" min="0" step="0.1" value="0" />
        </div>
        <div class="dimension-group">
          <label>Ry:</label>
          <input type="number" id="shape-ry" min="0" step="0.1" value="0" />
        </div>
      `;
    }

    // Insert after the brand element
    const brand = toolbar.querySelector('.brand');
    if (brand) {
      brand.insertAdjacentElement('afterend', container);
    } else {
      toolbar.insertBefore(container, toolbar.firstChild);
    }

    this.dimensionControls = container;

    // Attach input event listeners
    this.attachDimensionListeners();
  }

  /**
   * Attach event listeners to dimension inputs
   */
  attachDimensionListeners() {
    if (!this.dimensionControls) return;

    const inputs = this.dimensionControls.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.updateShapeFromInputs();
      });
    });
  }

  /**
   * Remove dimension controls from toolbar
   */
  removeDimensionControls() {
    if (this.dimensionControls && this.dimensionControls.parentNode) {
      this.dimensionControls.parentNode.removeChild(this.dimensionControls);
      this.dimensionControls = null;
    }
  }

  /**
   * Handle mouse down - start drawing
   */
  onMouseDown(e) {
    if (this.isDrawing) return;

    const pointer = canvas.getPointer(e.e);
    this.startX = pointer.x;
    this.startY = pointer.y;
    this.isDrawing = true;

    // Get colors from FillStrokePanel if available, otherwise use defaults
    const fillColor = this.fillStrokePanel ? this.fillStrokePanel.getLastFillColor() : '#0000ff';
    const strokeColor = this.fillStrokePanel ? this.fillStrokePanel.getLastStrokeColor() : '#000000';
    const strokeWidth = this.fillStrokePanel ? this.fillStrokePanel.getLastStrokeWidth() : 1;

    // Create initial shape
    if (this.activeShapeType === 'rect') {
      this.currentShape = new fabric.Rect({
        left: this.startX,
        top: this.startY,
        width: 0,
        height: 0,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        selectable: false,
        evented: false
      });
    } else if (this.activeShapeType === 'ellipse') {
      this.currentShape = new fabric.Ellipse({
        left: this.startX,
        top: this.startY,
        rx: 0,
        ry: 0,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });
    }

    if (this.currentShape) {
      canvas.add(this.currentShape);
      canvas.requestRenderAll();
    }
  }

  /**
   * Handle mouse move - update shape size
   */
  onMouseMove(e) {
    if (!this.isDrawing || !this.currentShape) return;

    const pointer = canvas.getPointer(e.e);

    if (this.activeShapeType === 'rect') {
      const width = Math.abs(pointer.x - this.startX);
      const height = Math.abs(pointer.y - this.startY);
      const left = Math.min(this.startX, pointer.x);
      const top = Math.min(this.startY, pointer.y);

      this.currentShape.set({
        left: left,
        top: top,
        width: width,
        height: height
      });

      this.updateDimensionInputs(width, height);
    } else if (this.activeShapeType === 'ellipse') {
      const rx = Math.abs(pointer.x - this.startX) / 2;
      const ry = Math.abs(pointer.y - this.startY) / 2;
      const centerX = (this.startX + pointer.x) / 2;
      const centerY = (this.startY + pointer.y) / 2;

      this.currentShape.set({
        left: centerX,
        top: centerY,
        rx: rx,
        ry: ry
      });

      this.updateDimensionInputs(rx, ry);
    }

    this.currentShape.setCoords();
    canvas.requestRenderAll();
  }

  /**
   * Handle mouse up - finish drawing
   */
  onMouseUp(e) {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.currentShape) {
      // Make the shape selectable and evented
      this.currentShape.set({
        selectable: true,
        evented: true
      });
      this.currentShape.setCoords();

      // Select the newly created shape
      canvas.setActiveObject(this.currentShape);
      
      // Fire event for undo/redo tracking
      canvas.fire('object:added', { target: this.currentShape });
      
      canvas.requestRenderAll();
      
      console.log('[ShapeDrawing] Created', this.activeShapeType, 'shape');
    }

    this.currentShape = null;
  }

  /**
   * Update dimension inputs based on current shape
   */
  updateDimensionInputs(val1, val2) {
    if (!this.dimensionControls) return;

    if (this.activeShapeType === 'rect') {
      const widthInput = this.dimensionControls.querySelector('#shape-width');
      const heightInput = this.dimensionControls.querySelector('#shape-height');
      if (widthInput) widthInput.value = val1.toFixed(2);
      if (heightInput) heightInput.value = val2.toFixed(2);
    } else if (this.activeShapeType === 'ellipse') {
      const rxInput = this.dimensionControls.querySelector('#shape-rx');
      const ryInput = this.dimensionControls.querySelector('#shape-ry');
      if (rxInput) rxInput.value = val1.toFixed(2);
      if (ryInput) ryInput.value = val2.toFixed(2);
    }
  }

  /**
   * Update shape dimensions from input values
   */
  updateShapeFromInputs() {
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    if (this.activeShapeType === 'rect' && activeObject.type === 'rect') {
      const widthInput = this.dimensionControls.querySelector('#shape-width');
      const heightInput = this.dimensionControls.querySelector('#shape-height');
      
      if (widthInput && heightInput) {
        const width = parseFloat(widthInput.value) || 0;
        const height = parseFloat(heightInput.value) || 0;
        
        activeObject.set({
          width: width,
          height: height
        });
        activeObject.setCoords();
        canvas.requestRenderAll();
        
        // Fire modified event for undo/redo
        canvas.fire('object:modified', { target: activeObject });
      }
    } else if (this.activeShapeType === 'ellipse' && activeObject.type === 'ellipse') {
      const rxInput = this.dimensionControls.querySelector('#shape-rx');
      const ryInput = this.dimensionControls.querySelector('#shape-ry');
      
      if (rxInput && ryInput) {
        const rx = parseFloat(rxInput.value) || 0;
        const ry = parseFloat(ryInput.value) || 0;
        
        activeObject.set({
          rx: rx,
          ry: ry
        });
        activeObject.setCoords();
        canvas.requestRenderAll();
        
        // Fire modified event for undo/redo
        canvas.fire('object:modified', { target: activeObject });
      }
    }
  }

  /**
   * Update dimension controls when a shape is selected
   * Call this when selection changes
   */
  updateControlsForSelection(obj) {
    if (!this.dimensionControls || !obj) return;

    if (this.activeShapeType === 'rect' && obj.type === 'rect') {
      this.updateDimensionInputs(obj.width * obj.scaleX, obj.height * obj.scaleY);
    } else if (this.activeShapeType === 'ellipse' && obj.type === 'ellipse') {
      this.updateDimensionInputs(obj.rx * obj.scaleX, obj.ry * obj.scaleY);
    }
  }
}

// Export singleton instance
export const shapeDrawingController = new ShapeDrawingController();
