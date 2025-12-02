/**
 * Fill & Stroke Panel Component
 * Provides RGB color controls for fills and strokes, mimicking Inkscape's interface
 */

import { COLOR_PALETTE } from './constants.js';

/**
 * Fill & Stroke Panel Class
 * Manages color editing UI for selected Fabric.js objects
 */
export class FillStrokePanel {
  constructor(canvas) {
    this.canvas = canvas;
    this.panelElement = null;
    this.activeObject = null;
    this.activeTab = 'fill'; // 'fill' | 'stroke' | 'stroke-style'
    this.isStrokeMode = false; // false = fill mode, true = stroke mode (for color tabs)
    
    // Color state
    this.currentColor = { r: 0, g: 0, b: 0 };
  }

  /**
   * Create the panel DOM structure
   * @returns {HTMLElement} The panel element
   */
  create() {
    const panel = document.createElement('div');
    panel.className = 'fill-stroke-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <div class="panel-tabs">
          <button class="panel-tab active" data-tab="fill" title="Vulling">
            <img src="assets/icons/stroke_fill/object-fill.svg" alt="Vulling" />
            <span>Vulling</span>
          </button>
          <button class="panel-tab" data-tab="stroke" title="Streekkleur">
            <img src="assets/icons/stroke_fill/object-stroke.svg" alt="Streekkleur" />
            <span>Streekkleur</span>
          </button>
          <button class="panel-tab" data-tab="stroke-style" title="Streekstijl">
            <img src="assets/icons/stroke_fill/object-stroke-style.svg" alt="Streekstijl" />
            <span>Streekstijl</span>
          </button>
        </div>
      </div>
      
      <div class="panel-content">
        <div id="color-pane">
          <div class="paint-mode-row">
            <button class="paint-btn" data-mode="none" title="Geen">
              <img src="assets/icons/stroke_fill/paint-none.svg" alt="Geen" />
            </button>
            <button class="paint-btn active" data-mode="solid" title="Egale kleur">
              <img src="assets/icons/stroke_fill/paint-solid.svg" alt="Egale kleur" />
            </button>
            <button class="paint-btn disabled" data-mode="linear" title="Lineair verloop" disabled>
              <img src="assets/icons/stroke_fill/paint-gradient-linear.svg" alt="Lineair" />
            </button>
            <button class="paint-btn disabled" data-mode="radial" title="Radiaal verloop" disabled>
              <img src="assets/icons/stroke_fill/paint-gradient-radial.svg" alt="Radiaal" />
            </button>
            <button class="paint-btn disabled" data-mode="pattern" title="Patroon" disabled>
              <img src="assets/icons/stroke_fill/paint-pattern.svg" alt="Patroon" />
            </button>
          </div>

          <div class="color-mode-section">
            <label class="section-label">Egale kleur</label>
          </div>
          
          <div class="rgb-sliders">
            <div class="slider-row">
              <label>R:</label>
              <input type="range" class="color-slider" id="slider-r" min="0" max="255" value="0">
              <input type="number" class="color-input" id="input-r" min="0" max="255" value="0">
            </div>
            
            <div class="slider-row">
              <label>G:</label>
              <input type="range" class="color-slider" id="slider-g" min="0" max="255" value="0">
              <input type="number" class="color-input" id="input-g" min="0" max="255" value="0">
            </div>
            
            <div class="slider-row">
              <label>B:</label>
              <input type="range" class="color-slider" id="slider-b" min="0" max="255" value="0">
              <input type="number" class="color-input" id="input-b" min="0" max="255" value="0">
            </div>
          
            <div class="hex-input-section">
              <label>RGB:</label>
              <input type="text" class="hex-input" id="hex-input" value="000000" maxlength="6">
              <div class="color-preview" id="color-preview"></div>
            </div>
            
            <div class="color-swatches" id="color-swatches"></div>
          </div>
        </div>

        <div id="stroke-style-pane" class="hidden">
          <div class="stroke-style-row">
            <label>Dikte:</label>
            <input type="range" class="color-slider" id="stroke-width-slider" min="0" max="4" step="0.1" value="1">
            <input type="number" class="color-input" id="stroke-width-input" min="0" max="4" step="0.1" value="1">
            <button id="stroke-style-reset" title="Reset">Reset</button>
          </div>
        </div>
      </div>
    `;
    
    this.panelElement = panel;
    this.populateSwatches();
    this.attachEventListeners();
    return panel;
  }

  /**
   * Populate color swatches from palette
   */
  populateSwatches() {
    const container = this.panelElement.querySelector('#color-swatches');
    if (!container) return;
    
    COLOR_PALETTE.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
      swatch.title = color.name;
      swatch.addEventListener('click', () => {
        this.setColor({ r: color.r, g: color.g, b: color.b });
        this.applyColorToObject();
      });
      container.appendChild(swatch);
    });
  }

  /**
   * Attach event listeners to panel controls
   */
  attachEventListeners() {
    // Tab switching
    const tabs = this.panelElement.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.dataset.tab;
        this.isStrokeMode = this.activeTab === 'stroke';
        this.togglePanes();
        this.updatePanelForCurrentObject();
      });
    });

    // Paint mode buttons
    const paintButtons = this.panelElement.querySelectorAll('.paint-btn');
    paintButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;
        paintButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        // Update UI first so sliders enable/disable immediately
        this.setPaintModeUI(mode);
        // Then apply the mode to the active object
        this.applyPaintMode(mode);
      });
    });

    // RGB sliders
    ['r', 'g', 'b'].forEach(channel => {
      const slider = this.panelElement.querySelector(`#slider-${channel}`);
      const input = this.panelElement.querySelector(`#input-${channel}`);
      
      slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        input.value = value;
        this.currentColor[channel] = value;
        this.updateColor();
      });
      
      input.addEventListener('input', (e) => {
        let value = parseInt(e.target.value) || 0;
        value = Math.max(0, Math.min(255, value));
        slider.value = value;
        this.currentColor[channel] = value;
        this.updateColor();
      });
    });

    // Hex input
    const hexInput = this.panelElement.querySelector('#hex-input');
    hexInput.addEventListener('input', (e) => {
      const hex = e.target.value.replace(/[^0-9a-fA-F]/g, '');
      if (hex.length === 6) {
        const rgb = this.hexToRgb(hex);
        if (rgb) {
          this.currentColor = rgb;
          this.updateSliders();
          this.applyColorToObject();
        }
      }
    });

    // Stroke style controls
    const widthSlider = this.panelElement.querySelector('#stroke-width-slider');
    const widthInput = this.panelElement.querySelector('#stroke-width-input');
    const resetBtn = this.panelElement.querySelector('#stroke-style-reset');

    const applyWidth = (val) => {
      if (!this.activeObject) return;
      const obj = this.activeObject;
      const center = obj.getCenterPoint();
      obj.set('strokeWidth', val);
      // Keep the object visually in the same position
      obj.setPositionByOrigin(center, 'center', 'center');
      obj.setCoords();
      this.canvas.renderAll();
      
      // Fire modified event so undo/redo can track this change
      this.canvas.fire('object:modified', { target: obj });
    };

    widthSlider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      widthInput.value = v;
      applyWidth(v);
    });
    widthInput.addEventListener('input', (e) => {
      const v = Math.max(0, Math.min(300, parseFloat(e.target.value) || 0));
      widthSlider.value = v;
      applyWidth(v);
    });

    resetBtn.addEventListener('click', () => {
      widthSlider.value = 0.3;
      widthInput.value = 0.3;
      applyWidth(0.3);
    });
  }

  /**
   * Show the panel with animation
   */
  show() {
    if (this.panelElement) {
      // Use requestAnimationFrame to ensure CSS transition works
      requestAnimationFrame(() => {
        this.panelElement.classList.add('active');
      });
    }
  }

  /**
   * Hide the panel with animation
   */
  hide() {
    if (this.panelElement) {
      this.panelElement.classList.remove('active');
    }
  }

  /**
   * Update panel with selected object's color
   * @param {fabric.Object|null} obj - The selected object
   */
  updateForObject(obj) {
    this.activeObject = obj;
    this.updatePanelForCurrentObject();
  }

  /**
   * Update panel controls based on current object and mode
   */
  updatePanelForCurrentObject() {
    if (!this.activeObject) {
      this.setColor({ r: 0, g: 0, b: 0 });
      this.updateStrokeStyleUI(null);
      return;
    }

    if (this.activeTab === 'stroke-style') {
      this.updateStrokeStyleUI(this.activeObject);
    } else {
      // Get current color from object
      const colorValue = this.isStrokeMode 
        ? this.activeObject.stroke 
        : this.activeObject.fill;
      
      // Update paint mode buttons UI based on presence of color
      const hasColor = !!colorValue && colorValue !== 'transparent' && colorValue !== 'none';
      this.setPaintModeUI(hasColor ? 'solid' : 'none');

      if (hasColor) {
        const rgb = this.colorToRgb(colorValue);
        if (rgb) {
          this.setColor(rgb);
        }
      } else {
        this.setColor({ r: 0, g: 0, b: 0 });
      }
    }
  }

  /**
   * Set color values and update UI
   * @param {{r: number, g: number, b: number}} rgb - RGB color object
   */
  setColor(rgb) {
    this.currentColor = rgb;
    this.updateSliders();
    this.updateHexInput();
    this.updateColorPreview();
  }

  /**
   * Update slider positions and input values
   */
  updateSliders() {
    ['r', 'g', 'b'].forEach(channel => {
      const slider = this.panelElement.querySelector(`#slider-${channel}`);
      const input = this.panelElement.querySelector(`#input-${channel}`);
      const value = this.currentColor[channel];
      
      slider.value = value;
      input.value = value;
    });
  }

  /**
   * Update hex input field
   */
  updateHexInput() {
    const hex = this.rgbToHex(this.currentColor.r, this.currentColor.g, this.currentColor.b);
    const hexInput = this.panelElement.querySelector('#hex-input');
    hexInput.value = hex;
  }

  /**
   * Update color preview box
   */
  updateColorPreview() {
    const preview = this.panelElement.querySelector('#color-preview');
    const color = `rgb(${this.currentColor.r}, ${this.currentColor.g}, ${this.currentColor.b})`;
    preview.style.backgroundColor = color;
  }

  /**
   * Update color based on current slider values
   */
  updateColor() {
    this.updateHexInput();
    this.updateColorPreview();
    this.applyColorToObject();
  }

  /**
   * Apply current color to the active object
   */
  applyColorToObject() {
    if (!this.activeObject) return;

    const color = `rgb(${this.currentColor.r}, ${this.currentColor.g}, ${this.currentColor.b})`;
    
    console.log('[FillStrokePanel] Applying color:', color, 'to object:', this.activeObject);
    console.log('[FillStrokePanel] Mode:', this.isStrokeMode ? 'stroke' : 'fill');
    
    if (this.isStrokeMode) {
      this.activeObject.set('stroke', color);
    } else {
      this.activeObject.set('fill', color);
    }
    
    // Mark object as dirty to force re-render
    this.activeObject.dirty = true;
    this.canvas.renderAll();
    
    // Fire modified event so undo/redo can track this change
    this.canvas.fire('object:modified', { target: this.activeObject });
  }

  togglePanes() {
    const colorPane = this.panelElement.querySelector('#color-pane');
    const stylePane = this.panelElement.querySelector('#stroke-style-pane');
    const showStyle = this.activeTab === 'stroke-style';
    colorPane.classList.toggle('hidden', showStyle);
    stylePane.classList.toggle('hidden', !showStyle);
  }

  updateStrokeStyleUI(obj) {
    const widthSlider = this.panelElement.querySelector('#stroke-width-slider');
    const widthInput = this.panelElement.querySelector('#stroke-width-input');
    if (!obj) {
      widthSlider.value = 1;
      widthInput.value = 1;
      return;
    }
    const w = typeof obj.strokeWidth === 'number' ? obj.strokeWidth : 1;
    widthSlider.value = w;
    widthInput.value = w;
  }

  /**
   * Apply paint mode (none or solid supported)
   */
  applyPaintMode(mode) {
    if (!this.activeObject) return;
    if (mode === 'none') {
      if (this.isStrokeMode) {
        this.activeObject.set({ stroke: null });
      } else {
        this.activeObject.set({ fill: null });
      }
      this.canvas.renderAll();
      
      // Fire modified event so undo/redo can track this change
      this.canvas.fire('object:modified', { target: this.activeObject });
      return;
    }
    if (mode === 'solid') {
      // Ensure we apply current sliders
      this.applyColorToObject();
    }
  }

  /** Update paint-mode buttons UI only */
  setPaintModeUI(mode) {
    const paintButtons = this.panelElement.querySelectorAll('.paint-btn');
    paintButtons.forEach(b => {
      if (b.dataset.mode === mode) b.classList.add('active');
      else b.classList.remove('active');
    });
    // Update label and visibility based on mode
    const label = this.panelElement.querySelector('.section-label');
    const rgbSliders = this.panelElement.querySelector('.rgb-sliders');
    const hexSection = this.panelElement.querySelector('.hex-input-section');
    const colorPreview = this.panelElement.querySelector('#color-preview');
    
    if (mode === 'none') {
      if (label) label.textContent = 'Geen opvulling';
      if (rgbSliders) rgbSliders.classList.add('hidden');
      if (hexSection) hexSection.classList.add('hidden');
      if (colorPreview) colorPreview.classList.add('hidden');
    } else {
      if (label) label.textContent = 'Egale kleur';
      if (rgbSliders) rgbSliders.classList.remove('hidden');
      if (hexSection) hexSection.classList.remove('hidden');
      if (colorPreview) colorPreview.classList.remove('hidden');
    }
  }

  /**
   * Convert RGB to hex string
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} Hex color string without #
   */
  rgbToHex(r, g, b) {
    return [r, g, b]
      .map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert hex to RGB object
   * @param {string} hex - Hex color string (with or without #)
   * @returns {{r: number, g: number, b: number}|null} RGB object or null if invalid
   */
  hexToRgb(hex) {
    hex = hex.replace('#', '');
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert any color format to RGB
   * @param {string} color - Color in any CSS format
   * @returns {{r: number, g: number, b: number}|null} RGB object or null
   */
  colorToRgb(color) {
    // Handle hex colors
    if (color.startsWith('#')) {
      return this.hexToRgb(color);
    }
    
    // Handle rgb(r, g, b) format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }
    
    // For other formats, create a temporary element to compute the color
    const temp = document.createElement('div');
    temp.style.color = color;
    document.body.appendChild(temp);
    const computed = window.getComputedStyle(temp).color;
    document.body.removeChild(temp);
    
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    
    return null;
  }

  /**
   * Clean up the panel
   */
  destroy() {
    if (this.panelElement && this.panelElement.parentNode) {
      this.panelElement.parentNode.removeChild(this.panelElement);
    }
    this.panelElement = null;
    this.activeObject = null;
  }
}
