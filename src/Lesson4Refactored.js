/**
 * Lesson 4: Fill & Stroke (REFACTORED)
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

class Lesson4State {
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

const lesson4State = new Lesson4State();

/**
 * Update page metadata for Lesson 4
 */
function updatePageMetadata() {
  try {
    document.title = 'Inkscape Les 4: Vulling en Streek';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 4: Vulling en Streek'));
    }
  } catch (error) {
    console.warn('[Lesson4] Failed to update metadata:', error);
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
        <li><kbd>Ctrl+Y</kbd> - Opnieuw</li>
      </ul>
      <p><strong>Let op:</strong> De objecten hebben geen vulling, alleen een streek. Je moet precies op de lijn klikken!</p>
    `;
  } catch (error) {
    console.warn('[Lesson4] Failed to update panel:', error);
  }
}

/**
 * Load screwdriver assets from SVG
 */
async function loadLessonAssets() {
  try {
    // Load individual parts from the SVG
    const parts = await assetLoader.loadFabricGroups(
      ASSETS.LESSON_4_SVG,
      ['Handle', 'Top']
    );

    console.log('[Lesson4] Loaded parts:', Object.keys(parts));
    
    return {
      handle: parts['Handle'],
      top: parts['Top']
    };
  } catch (error) {
    console.error('[Lesson4] Failed to load assets:', error);
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

  console.log('[Lesson4] Screwdriver parts added (linked movement).');
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
    console.log('[Lesson4] Selection cleared');
    panel.updateForObject(null);
  });
  
  return panel;
}

/**
 * Start Lesson 4
 */
export async function startLesson4() {
  if (lesson4State.isActive) {
    console.log('[Lesson4] Already active');
    return;
  }

  try {
    console.log('[Lesson4] Starting...');
    lesson4State.isActive = true;

    // Update UI
    updatePageMetadata();
    updateInstructionPanel();

    // Reset canvas
    resetViewport();
    canvas.clear();

    // Load assets
    console.log('[Lesson4] Loading assets...');
    const { handle, top } = await loadLessonAssets();

    // Setup screwdriver
    const { handle: handleObj, top: topObj, moveListener } = setupScrewdriver(handle, top);
    lesson4State.objects.handle = handleObj;
    lesson4State.objects.top = topObj;
    lesson4State.moveListener = moveListener;

    // Setup Fill & Stroke panel
    lesson4State.fillStrokePanel = setupFillStrokePanel();

    // Enable copy-paste if configured for this lesson
    if (LESSON_FEATURES[4]?.COPY_PASTE) {
      copyPasteController.enable();
      undoRedoController.enable();
      console.log('[Lesson4] Copy-paste and undo/redo enabled (Ctrl+C/V/Z/Y, Delete)');
    }

    canvas.requestRenderAll();
    console.log('[Lesson4] Started successfully');

  } catch (error) {
    console.error('[Lesson4] Failed to start:', error);
    lesson4State.isActive = false;
    throw error;
  }
}

/**
 * Clean up Lesson 4
 */
export function cleanupLesson4() {
  if (!lesson4State.isActive) return;

  console.log('[Lesson4] Cleaning up...');

  // Remove canvas objects
  if (lesson4State.objects.handle) canvas.remove(lesson4State.objects.handle);
  if (lesson4State.objects.top) canvas.remove(lesson4State.objects.top);

  // Remove panel
  if (lesson4State.fillStrokePanel) {
    lesson4State.fillStrokePanel.destroy();
  }

  // Disable copy-paste and undo/redo
  copyPasteController.disable();
  undoRedoController.disable();

  // Clear canvas event listeners
  canvas.off('selection:created');
  canvas.off('selection:updated');
  canvas.off('selection:cleared');
  if (lesson4State.moveListener) {
    canvas.off('object:moving', lesson4State.moveListener);
  }

  // Reset state
  lesson4State.reset();
  
  console.log('[Lesson4] Cleanup complete');
}
