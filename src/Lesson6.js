/**
 * Lesson 6: Fill & Stroke (REFACTORED)
 * Demonstrates:
 * - Selecting stroke-only objects (precision selection)
 * - Grouped objects that move together but are individually colorable
 * - Using the Fill & Stroke panel to apply colors
 */

import { canvas, resetViewport } from './canvas.js';
import { assetLoader } from './AssetLoader.js';
import { FillStrokePanel } from './FillStrokePanel.js';
import { ASSETS, SVG_IDS, LESSON_FEATURES } from './constants.js';
import { copyPasteController } from './CopyPasteController.js';
import { undoRedoController } from './UndoRedoController.js';
import { shapeDrawingController } from './ShapeDrawingController.js';
import { penToolController } from './PenToolController.js';

class Lesson6State {
  constructor() {
    this.isActive = false;
    this.objects = {
      handle: null,
      top: null
    };
    this.fillStrokePanel = null;
    this.moveListener = null;
  }

  reset() {
    this.isActive = false;
    this.objects = {
      handle: null,
      top: null
    };
    if (this.fillStrokePanel) {
      this.fillStrokePanel.destroy();
      this.fillStrokePanel = null;
    }
    this.moveListener = null;
  }
}

const lesson6State = new Lesson6State();

/**
 * Update page metadata for Lesson 4
 */
function updatePageMetadata() {
  try {
    document.title = 'Inkscape Les 6: Vulling en Streek';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 6: Vulling en Streek'));
    }
  } catch (error) {
    console.warn('[Lesson6] Failed to update metadata:', error);
  }
}

/**
 * Update instruction panel
 */
function updateInstructionPanel() {
  try {
    const panel = document.getElementById('panel');
    if (!panel) return;

    panel.innerHTML = `
      <h3>Opdracht</h3>
      <p>Leer hoe je kleuren toepast op objecten met enkel een omtrek (streek).</p>
      <ol>
        <li>Selecteer het handvat van de schroevendraaier door precies op de streek te klikken</li>
        <li>Gebruik de RGB schuivers in het paneel rechts om een kleur te kiezen</li>
        <li>Selecteer nu de punt van de schroevendraaier</li>
        <li>Geef deze een andere kleur</li>
      </ol>
      <p><strong>Sneltoetsen:</strong></p>
      <ul style="font-size: 0.9em; margin-top: 8px;">
        <li><kbd>Ctrl+C</kbd> - Kopiëren</li>
        <li><kbd>Ctrl+V</kbd> - Plakken</li>
        <li><kbd>Delete</kbd> / <kbd>Backspace</kbd> - Verwijderen</li>
        <li><kbd>Ctrl+Z</kbd> - Ongedaan maken</li>
        <li><kbd>Ctrl+Shift+Z</kbd> - Opnieuw</li>
      </ul>
      <p><strong>Let op:</strong> De objecten hebben geen vulling, alleen een streek. Je moet precies op de lijn klikken!</p>
    `;
  } catch (error) {
    console.warn('[Lesson6] Failed to update panel:', error);
  }
}

/**
 * Load screwdriver assets from SVG
 */
async function loadLessonAssets() {
  try {
    // Load individual parts from the SVG
    const parts = await assetLoader.loadFabricGroups(
      ASSETS.LESSON_6_SVG,
      ['Handle', 'Top']
    );

    console.log('[Lesson6] Loaded parts:', Object.keys(parts));
    
    return {
      handle: parts['Handle'],
      top: parts['Top']
    };
  } catch (error) {
    console.error('[Lesson6] Failed to load assets:', error);
    throw error;
  }
}

/**
 * Setup screwdriver on canvas without grouping
 * - Each part is individually selectable and shows its own borders
 * - Moving one part moves the other by the same delta
 */
function setupScrewdriver(handle, top) {
  // Improve stroke-only hit testing
  const commonProps = {
    selectable: true,
    hasControls: false,
    hasBorders: true,
    hoverCursor: 'pointer',
    evented: true,
    perPixelTargetFind: true,
    targetFindTolerance: 4,
    objectCaching: false
  };

  handle.set(commonProps);
  top.set(commonProps);

  // Compute current bounding box of the two parts and center them together
  const minX = Math.min(handle.left, top.left);
  const minY = Math.min(handle.top, top.top);
  const maxX = Math.max(handle.left + (handle.width || 0), top.left + (top.width || 0));
  const maxY = Math.max(handle.top + (handle.height || 0), top.top + (top.height || 0));
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const centerX = canvas.width / 2 - (minX + bboxW / 2);
  const centerY = canvas.height / 2 - (minY + bboxH / 2);

  handle.set({ left: handle.left + centerX, top: handle.top + centerY });
  top.set({ left: top.left + centerX, top: top.top + centerY });

  canvas.add(handle);
  canvas.add(top);

  // Track last known position to compute deltas
  handle._lastPos = { left: handle.left, top: handle.top };
  top._lastPos = { left: top.left, top: top.top };

  // Link movement so dragging either part moves both
  const moveListener = (e) => {
    const obj = e.target;
    if (!obj || (obj !== handle && obj !== top)) return;

    const other = obj === handle ? top : handle;
    const last = obj._lastPos || { left: obj.left, top: obj.top };
    const dx = obj.left - last.left;
    const dy = obj.top - last.top;
    // move the other object by the same delta and keep coords up to date
    other.set({ left: other.left + dx, top: other.top + dy });
    other.setCoords();
    // update last positions for BOTH objects so swapping selection doesn't jump
    obj._lastPos = { left: obj.left, top: obj.top };
    other._lastPos = { left: other.left, top: other.top };
    canvas.requestRenderAll();
  };
  canvas.on('object:moving', moveListener);

  console.log('[Lesson6] Screwdriver parts added (linked movement).');
  return { handle, top, moveListener };
}

/**
 * Setup Fill & Stroke panel
 */
function setupFillStrokePanel() {
  const panel = new FillStrokePanel(canvas);
  const panelElement = panel.create();
  document.body.appendChild(panelElement);
  
  // Show the panel
  panel.show();
  
  // Listen to selection events
  canvas.on('selection:created', () => {
    const obj = canvas.getActiveObject();
    panel.updateForObject(obj);
  });
  
  canvas.on('selection:updated', () => {
    const obj = canvas.getActiveObject();
    panel.updateForObject(obj);
  });
  
  canvas.on('selection:cleared', () => {
    console.log('[Lesson6] Selection cleared');
    panel.updateForObject(null);
  });
  
  return panel;
}

/**
 * Start Lesson 4
 */
export async function startLesson6() {
  if (lesson6State.isActive) {
    console.log('[Lesson6] Already active');
    return;
  }

  try {
    console.log('[Lesson6] Starting...');
    lesson6State.isActive = true;

    // Update UI
    updatePageMetadata();
    updateInstructionPanel();

    // Reset canvas
    resetViewport();
    canvas.clear();

    // Load assets
    console.log('[Lesson6] Loading assets...');
    const { handle, top } = await loadLessonAssets();

    // Setup screwdriver
    const { handle: handleObj, top: topObj, moveListener } = setupScrewdriver(handle, top);
    lesson6State.objects.handle = handleObj;
    lesson6State.objects.top = topObj;
    lesson6State.moveListener = moveListener;

    // Setup Fill & Stroke panel
    lesson6State.fillStrokePanel = setupFillStrokePanel();

    // Enable copy-paste if configured for this lesson
    if (LESSON_FEATURES[6]?.COPY_PASTE) {
      copyPasteController.enable();
      undoRedoController.enable();
      console.log('[Lesson6] Copy-paste and undo/redo enabled (Ctrl+C/V/Z/Y, Delete)');
    }

    // Enable shape tools if configured for this lesson
    if (LESSON_FEATURES[6]?.SHAPE_TOOLS) {
      const rectTool = document.getElementById('tool-rect');
      const ellipseTool = document.getElementById('tool-ellipse');
      const penTool = document.getElementById('tool-pen');
      if (rectTool) {
        rectTool.disabled = false;
        rectTool.removeAttribute('aria-disabled');
      }
      if (ellipseTool) {
        ellipseTool.disabled = false;
        ellipseTool.removeAttribute('aria-disabled');
      }
      if (penTool) {
        penTool.disabled = false;
        penTool.removeAttribute('aria-disabled');
      }
      // Set FillStrokePanel reference so shapes and pen tool use the current colors
      shapeDrawingController.setFillStrokePanel(lesson6State.fillStrokePanel);
      penToolController.setFillStrokePanel(lesson6State.fillStrokePanel);
      console.log('[Lesson6] Shape tools enabled');
    }

    canvas.requestRenderAll();
    console.log('[Lesson6] Started successfully');

  } catch (error) {
    console.error('[Lesson6] Failed to start:', error);
    lesson6State.isActive = false;
    throw error;
  }
}

/**
 * Clean up Lesson 4
 */
export function cleanupLesson6() {
  if (!lesson6State.isActive) return;

  console.log('[Lesson6] Cleaning up...');

  // Remove canvas objects
  if (lesson6State.objects.handle) canvas.remove(lesson6State.objects.handle);
  if (lesson6State.objects.top) canvas.remove(lesson6State.objects.top);

  // Remove panel
  if (lesson6State.fillStrokePanel) {
    lesson6State.fillStrokePanel.destroy();
  }

  // Disable copy-paste and undo/redo
  copyPasteController.disable();
  undoRedoController.disable();

  // Disable shape tools
  const rectTool = document.getElementById('tool-rect');
  const ellipseTool = document.getElementById('tool-ellipse');
  const penTool = document.getElementById('tool-pen');
  if (rectTool) {
    rectTool.disabled = true;
    rectTool.setAttribute('aria-disabled', 'true');
  }
  if (ellipseTool) {
    ellipseTool.disabled = true;
    ellipseTool.setAttribute('aria-disabled', 'true');
  }
  if (penTool) {
    penTool.disabled = true;
    penTool.setAttribute('aria-disabled', 'true');
  }
  penToolController.disable();

  // Clear canvas event listeners
  canvas.off('selection:created');
  canvas.off('selection:updated');
  canvas.off('selection:cleared');
  if (lesson6State.moveListener) {
    canvas.off('object:moving', lesson6State.moveListener);
  }

  // Reset state
  lesson6State.reset();
  
  console.log('[Lesson6] Cleanup complete');
}

/**
 * Restart Lesson 6
 */
export async function restartLesson6() {
  cleanupLesson6();
  await startLesson6();
}
