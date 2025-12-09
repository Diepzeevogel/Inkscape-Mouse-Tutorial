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
import { startLesson5 } from './Lesson5.js';
import { AnimationController } from './AnimationController.js';
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
    // Load legacy screwdriver parts if present (fallback)
    const parts = await assetLoader.loadFabricGroups(
      ASSETS.LESSON_6_SVG,
      ['Handle', 'Top']
    );

    console.log('[Lesson6] Loaded parts (fallback):', Object.keys(parts));
    return {
      handle: parts['Handle'],
      top: parts['Top']
    };
  } catch (error) {
    console.warn('[Lesson6] Fallback assets not found:', error);
    return { handle: null, top: null };
  }
}

/**
 * Load the lesson badge (Badge, Ink, Hole groups) from the badge SVG
 */
async function loadBadgeAssets() {
  try {
    const parts = await assetLoader.loadFabricGroups(
      ASSETS.LESSON_6_BADGE,
      ['Badge', 'Ink', 'Hole']
    );

    console.log('[Lesson6] Loaded badge parts:', Object.keys(parts));
    return {
      badge: parts['Badge'],
      ink: parts['Ink'],
      hole: parts['Hole']
    };
  } catch (error) {
    console.error('[Lesson6] Failed to load badge assets:', error);
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
    
    // Update URL hash
    try {
      history.replaceState(null, '', '#lesson=6');
      // Trigger hashchange event to update lesson buttons
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      console.warn('[Lesson6] Could not update URL:', e);
    }

    // Update UI
    updatePageMetadata();
    updateInstructionPanel();

    // First, show the end state of Lesson 5 so the user sees the machine and context
    try {
      await startLesson5();
    } catch (e) {
      console.warn('[Lesson6] Could not start Lesson 5 as backdrop:', e);
    }

    // After rendering lesson 5, simulate the 'end of lesson 5' active state
    // by starting bulbs, gears and owl wiggle and zooming/panning to the machine.
    const animCtrl = new AnimationController(canvas);

    // Helper to find objects by tutorialId or svg id
    function findByTutorialId(id) {
      return canvas.getObjects().find(o => (o.tutorialId && o.tutorialId === id) || (o.svgId && o.svgId === id) || (o.id && o.id === id));
    }

    const machine = findByTutorialId('MakerMachine') || canvas.getObjects().find(o => (o.id || '').toLowerCase().includes('layer_2'));
    const owl = findByTutorialId('Owl_with_Helmet') || findByTutorialId('Owl');
    const toolbox = findByTutorialId('Toolbox');

    // Toggle bulbs: find bulb_off / bulb_on children inside machine and swap visibility
    if (machine && machine.getObjects) {
      const machineChildren = machine.getObjects();
      const bulbOff = machineChildren.filter(o => (o.id || o.svgId || '').toLowerCase().includes('bulb_off'));
      const bulbOn = machineChildren.filter(o => (o.id || o.svgId || '').toLowerCase().includes('bulb_on'));

      bulbOff.forEach(b => { b.visible = false; b.dirty = true; });
      bulbOn.forEach(b => { b.visible = true; b.dirty = true; });
    }

    // Start gear rotation (search for gear* in machine)
    let gearObjects = [];
    if (machine && machine.getObjects) {
      gearObjects = machine.getObjects().filter(o => /(gear\d*)/i.test((o.id || o.svgId || '').toString()));
    }
    if (gearObjects.length > 0) {
      animCtrl.startRotationAnimation(gearObjects, 'lesson6-gears', 0.03);
    }

    // Start owl wiggle animation
    if (owl) {
      animCtrl.startWiggleAnimation(owl, 'lesson6-owl', 5, 300);
      canvas.bringToFront(owl);
    }
    if (toolbox) canvas.bringToFront(toolbox);

    // Animate viewport to focus on the machine similar to Lesson5.animateZoomOutToScene
    if (machine) {
      const machineBounds = machine.getBoundingRect(true);
      const machineCenterX = machineBounds.left + machineBounds.width / 2;
      const machineCenterY = machineBounds.top + machineBounds.height / 2;
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const padding = 100; // similar to LAYOUT.MACHINE_ZOOM_PADDING

      const zoomX = (canvasWidth - padding * 2) / machineBounds.width;
      const zoomY = (canvasHeight - padding * 2) / machineBounds.height;
      const targetZoom = Math.min(zoomX, zoomY, 1);

      animCtrl.animateViewport({
        targetZoom,
        targetX: machineCenterX,
        targetY: machineCenterY,
        duration: 1000
      });
    }

    // Setup Fill & Stroke panel for Lesson 6 interactions
    lesson6State.fillStrokePanel = setupFillStrokePanel();

    // Load badge assets (badge, ink stains, hole)
    console.log('[Lesson6] Loading badge assets...');
    const { badge, ink, hole } = await loadBadgeAssets();

    if (!badge) {
      console.error('[Lesson6] Badge asset missing, aborting lesson setup');
      return;
    }

    // Add background objects from lesson 5 if available so badge can cover them
    // Try loading lesson 5 main group as backdrop (non-interactive)
    try {
      const backdropParts = await assetLoader.loadFabricGroups(ASSETS.LESSON_5_SVG, ['main']);
      if (backdropParts && backdropParts['main']) {
        const backdrop = backdropParts['main'];
        backdrop.set({ selectable: false, evented: false, opacity: 1 });
        canvas.add(backdrop);
      }
    } catch (e) {
      console.warn('[Lesson6] Could not load backdrop from lesson 5:', e);
    }

    // Place badge small in front of canvas and animate it scaling up
    badge.set({ selectable: false, evented: false, originX: 'center', originY: 'center' });
    // center it near the machine area (approx center)
    badge.left = canvas.width / 2;
    badge.top = canvas.height / 2;
    badge.scaleX = badge.scaleY = 0.05; // start very small
    badge.setCoords();
    canvas.add(badge);

    // Add ink stains (selectable initially for deletion)
    if (ink) {
      ink.set({ selectable: true, evented: true, originX: 'center', originY: 'center' });
      ink.left = badge.left;
      ink.top = badge.top;
      canvas.add(ink);
    }

    // Add hole object but keep hidden (if provided)
    if (hole) {
      hole.set({ selectable: false, evented: false, visible: false, originX: 'center', originY: 'center' });
      hole.left = badge.left;
      hole.top = badge.top;
      canvas.add(hole);
    }

    canvas.requestRenderAll();

    // Animate badge from small to covering most of the canvas
    const targetScale = Math.max((canvas.width * 0.8) / (badge.width || canvas.width), (canvas.height * 0.8) / (badge.height || canvas.height));
    fabric.util.animate({
      startValue: 0.05,
      endValue: targetScale,
      duration: 1400,
      easing: fabric.util.ease.easeOutCubic,
      onChange(value) {
        badge.scaleX = badge.scaleY = value;
        badge.setCoords();
        canvas.requestRenderAll();
      },
      onComplete() {
        // When badge is large enough, hide other lesson 5 elements
        canvas.forEachObject(obj => {
          if (obj === badge || obj === ink || obj === hole) return;
          // Hide any lesson-5 backdrop elements
          obj.visible = false;
          obj.evented = false;
          obj.selectable = false;
        });

        // Make badge group selectable as a whole now
        badge.set({ selectable: true, evented: true });

        // Only ink stains remain selectable for deletion at this stage
        if (ink) {
          ink.bringToFront();
          ink.set({ selectable: true, evented: true });
        }

        canvas.requestRenderAll();

        // Update instructions for deleting ink stains
        const panel = document.getElementById('panel');
        if (panel) {
          panel.innerHTML = `
            <h3>Opdracht: Verwijder de inktplekken</h3>
            <p>De machine heeft een badge uitgespuwd. Verwijder alle inktplekken (<em>Ink</em>) door ze te selecteren en op <kbd>Delete</kbd> of <kbd>Backspace</kbd> te drukken.</p>
            <p>Je kunt enkel de inktplekken selecteren. Als je klaar bent, selecteer de hele badge en zet de vulling uit via het Fill-panel.</p>
          `;
        }
      }
    });


    // Copy-paste, shape tools and node editing are intentionally disabled for this lesson (only Fill/Stroke allowed)
    console.log('[Lesson6] Interactive features restricted: only Fill/Stroke panel is enabled');

    // Wire up event: when ink group is removed (all ink paths deleted), guide the user to select the badge group and remove fills
    canvas.on('object:removed', (e) => {
      // If removed object belonged to ink group, check remaining ink objects
      // If no ink objects remain, update instructions
      const inkObjects = canvas.getObjects().filter(o => o && o._objects && o._objects.some(s => s && s.type && s.type !== 'group') && o === ink);
      // Simpler check: if ink group no longer exists on canvas
      const hasInk = canvas.getObjects().includes(ink);
      if (!hasInk) {
        const panel = document.getElementById('panel');
        if (panel) {
          panel.innerHTML = `
            <h3>Stap 2: Maak de badge leeg</h3>
            <p>Selecteer de hele badge (klik op de Badge groep) en open het Fill-panel. Kies <strong>None</strong> of klik op het vakje zonder kleur om alle vullingen te verwijderen.</p>
            <p>Als alle vullingen verwijderd zijn, de 'Hole' ontbreekt nog. Teken een cirkel van <strong>10 × 10</strong> met de Ellipse-tool om het gat toe te voegen.</p>
          `;
        }

        // Make badge selectable so user can select it as a group
        badge.set({ selectable: true, evented: true });
        canvas.requestRenderAll();
      }
    });

    // After badge is selected and user clears fill, we need to enable drawing a small circle (10x10)
    // Wire selection: when user selects badge, show hint to clear fills
    canvas.on('selection:created', (e) => {
      const obj = canvas.getActiveObject();
      if (obj === badge) {
        // advise user via panel
        const panel = document.getElementById('panel');
        if (panel) panel.insertAdjacentHTML('beforeend', '<p>Nu: kies <strong>Fill: None</strong> in het Fill-panel.</p>');
      }
    });

    // Listen for add of a new circle from the ShapeDrawingController (user-drawn)
    // We'll detect newly added Ellipse with small size and animate it into the Hole position
    canvas.on('object:added', (e) => {
      const obj = e.target;
      if (!obj) return;
      if (obj.type === 'ellipse' || obj.type === 'circle') {
        // Check approximate size (10 × 10 suggested) - ellipse uses rx/ry
        const w = (obj.rx || obj.radius || obj.width/2) * 2;
        const h = (obj.ry || obj.radius || obj.height/2) * 2;
        if (Math.abs(w - 10) < 6 && Math.abs(h - 10) < 6) {
          // Animate the new circle (outline pulse) then snap to hole position
          obj.set({ strokeDashArray: [6,6], stroke: '#999', fill: 'transparent' });
          obj.setCoords();
          canvas.requestRenderAll();

          // Compute target position from Hole group if available
          if (hole) {
            // Make hole visible while snapping
            hole.visible = true;
            hole.setCoords();

            // Animate movement and snapping
            const startLeft = obj.left;
            const startTop = obj.top;
            const endLeft = hole.left;
            const endTop = hole.top;

            fabric.util.animate({
              startValue: 0,
              endValue: 1,
              duration: 600,
              onChange(v) {
                obj.left = startLeft + (endLeft - startLeft) * v;
                obj.top = startTop + (endTop - startTop) * v;
                obj.scaleX = obj.scaleY = 1; // ensure consistent
                obj.setCoords();
                canvas.requestRenderAll();
              },
              onComplete() {
                // Snap exactly
                obj.left = endLeft;
                obj.top = endTop;
                obj.set({ selectable: false, evented: false, hasControls: false });
                obj.setCoords();
                canvas.requestRenderAll();

                // Mark lesson as focused only on badge now
                const panel = document.getElementById('panel');
                if (panel) panel.insertAdjacentHTML('beforeend', '<p>Hole geplaatst en vergrendeld.</p>');
              }
            });
          }
        }
      }
    });

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

  // Disable node editing tool
  const nodeTool = document.getElementById('tool-node');
  if (nodeTool) {
    nodeTool.disabled = true;
    nodeTool.setAttribute('aria-disabled', 'true');
  }

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
