/**
 * Lesson 6: Fill & Stroke (REFACTORED)
 * Demonstrates:
 * - Selecting stroke-only objects (precision selection)
 * - Grouped objects that move together but are individually colorable
 * - Using the Fill & Stroke panel to apply colors
 */

import { canvas, resetViewport } from './canvas.js';
import { assetLoader } from './AssetLoader.js';
import { AnimationController } from './AnimationController.js';
import { FillStrokePanel } from './FillStrokePanel.js';
import { ASSETS, SVG_IDS, LESSON_FEATURES } from './constants.js';
import { startLesson5, enterEndState } from './Lesson5.js';
import { copyPasteController } from './CopyPasteController.js';
import { undoRedoController } from './UndoRedoController.js';
import { register as registerEvent, unregisterAllForOwner } from './EventRegistry.js';
import { shapeDrawingController } from './ShapeDrawingController.js';
import { penToolController } from './PenToolController.js';
import { markLessonCompleted } from './utils.js';
import { Pasted, LockedFromDelete, LastPos, Placed } from './MetadataRegistry.js';

class Lesson6State {
  constructor() {
    this.isActive = false;
    this.objects = {
      handle: null,
      top: null
    };
    this.fillStrokePanel = null;
    this.moveListener = null;
    this.keydownHandler = null;
    this.animations = {
      holePulse: null
    };
    this.drawnCircle = null;  // Track the circle being drawn
    this.shapeDrawingExitHandler = null;  // Track shape drawing exit handler
    this.originalHoleStyle = null;
    this.animationController = null;
    this.holeCompleted = false;
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
    this.keydownHandler = null;
    this.animations = {
      holePulse: null
    };
    this.drawnCircle = null;
    this.shapeDrawingExitHandler = null;
    this.animationController = null;
    this.originalHoleStyle = null;
    this.holeCompleted = false;
  }
}

const lesson6State = new Lesson6State();

// Feature flag: set to false to prevent the badge from appearing (useful for debugging)
const ENABLE_BADGE_OUTPUT = true;

/**
 * Update page metadata for Lesson 6
 */
function updatePageMetadata() {
  try {
    document.title = 'Inkscape Les 6: Maker Badge';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 6: Maker Badge'));
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
      ['Badge', 'Ink', 'Hole', 'Owl', 'Lightning', 'Lightning_x5F_target', 'Lightning_x5F_target2', 'Lightning_x5F_target3', 'Name']
    );

    console.log('[Lesson6] Loaded badge parts:', Object.keys(parts));
    return {
      badge: parts['Badge'],
      ink: parts['Ink'],
      hole: parts['Hole'],
      owl: parts['Owl'],
      lightning: parts['Lightning'],
      lightningTarget1: parts['Lightning_x5F_target'],
      lightningTarget2: parts['Lightning_x5F_target2'],
      lightningTarget3: parts['Lightning_x5F_target3'],
      name: parts['Name']
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
  LastPos.set(handle, { left: handle.left, top: handle.top });
  LastPos.set(top, { left: top.left, top: top.top });

  // Link movement so dragging either part moves both
  const moveListener = (e) => {
    const obj = e.target;
    if (!obj || (obj !== handle && obj !== top)) return;

    const other = obj === handle ? top : handle;
    const last = LastPos.get(obj) || { left: obj.left, top: obj.top };
    const dx = obj.left - last.left;
    const dy = obj.top - last.top;
    // move the other object by the same delta and keep coords up to date
    other.set({ left: other.left + dx, top: other.top + dy });
    other.setCoords();
    // update last positions for BOTH objects so swapping selection doesn't jump
    LastPos.set(obj, { left: obj.left, top: obj.top });
    LastPos.set(other, { left: other.left, top: other.top });
    canvas.requestRenderAll();
  };
  canvas.on('object:moving', moveListener);

  console.log('[Lesson6] Screwdriver parts added (linked movement).');
  return { handle, top, moveListener };
}
*/
/**
 * Setup Fill & Stroke panel
 */
function setupFillStrokePanel() {
  const panel = new FillStrokePanel(canvas);
  const panelElement = panel.create();
  // create() will append if needed; ensure we don't append duplicates
  try {
    if (!document.body.contains(panelElement)) document.body.appendChild(panelElement);
  } catch (e) { /* ignore */ }
  // Hide the panel initially - no selections yet
  panel.hide();
  return panel;
}

/**
 * Validate and snap the drawn circle to the hole
 * Circle must be 15x15 with black stroke and no fill
 * @param {fabric.Object} hole - The hole element to snap to
 * @param {fabric.Object} holeRef - (removed) reference is no longer required
 * @returns {boolean} true if circle was valid and snapped, false otherwise
 */
function checkAndSnapCircle(hole) {
  const drawnCircle = canvas.getObjects().find(obj => 
    obj.type === 'ellipse' && obj !== hole
  );
  
  if (!drawnCircle) {
    console.log('[Lesson6] No circle found on canvas');
    return false;
  }
  
  // Get actual dimensions (rx/ry are radii in fabric.Ellipse)
  const rx = drawnCircle.rx * (drawnCircle.scaleX || 1);
  const ry = drawnCircle.ry * (drawnCircle.scaleY || 1);

  // Robust stroke color check: accept hex, named and rgb formats for black
  const strokeVal = drawnCircle.stroke;
  const hasStroke = strokeVal !== null && strokeVal !== undefined;
  const strokeIsBlack = hasStroke && (/black/i.test(String(strokeVal)) || /^#0{3,6}$/i.test(String(strokeVal)) || /rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(String(strokeVal)) || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*1\s*\)/i.test(String(strokeVal)));

  // Detect absence of fill (null/undefined/'transparent' or transparent rgba)
  const fillVal = drawnCircle.fill;
  const hasNoFill = (!fillVal) || String(fillVal).toLowerCase() === 'transparent' || /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.\d+)?\s*\)/i.test(String(fillVal));
  
  console.log('[Lesson6] Circle validation:', {
    rx: rx.toFixed(2),
    ry: ry.toFixed(2),
    stroke: strokeVal,
    isBlack: strokeIsBlack,
    hasStroke: hasStroke,
    fill: fillVal,
    hasNoFill: hasNoFill
  });

  // Expect the user to draw an ellipse with radii 15x15 (rx/ry = 15)
  const TARGET_RX = 15;
  const TARGET_RY = 15;
  const TOLERANCE = 1; // allow small floating point tolerance
  const isCorrectSize = Math.abs(rx - TARGET_RX) < TOLERANCE && Math.abs(ry - TARGET_RY) < TOLERANCE;
  
  if (!isCorrectSize || !hasStroke || !strokeIsBlack || !hasNoFill) {
    console.log('[Lesson6] Circle does not meet requirements');
    console.log('[Lesson6]   Size OK:', isCorrectSize, '(rx~7.5, ry~7.5)');
    console.log('[Lesson6]   Has stroke:', hasStroke, '- Is black:', strokeIsBlack);
    console.log('[Lesson6]   No fill:', hasNoFill);
    
    // Show feedback message
    const panel = document.getElementById('panel');
    if (panel) {
      let feedback = '<p style="color: #d9534f;"><strong>Oeps!</strong> De cirkel voldoet niet:</p><ul>';
      if (!isCorrectSize) {
        feedback += `<li>Grootte moet 15 × 15 zijn (nu: ${(rx).toFixed(1)} × ${(ry).toFixed(1)})</li>`;
      }
      if (!hasStroke) {
        feedback += '<li>De cirkel moet een omtrek (streek) hebben</li>';
      }
      if (hasStroke && !strokeIsBlack) {
        feedback += '<li>De omtrek moet zwart zijn</li>';
      }
      if (!hasNoFill) {
        feedback += '<li>De cirkel mag geen vulling hebben</li>';
      }
      feedback += '</ul>';
      
      const existingPanel = panel.innerHTML;
      panel.innerHTML = feedback + '<p>Probeer opnieuw!</p>';
    }
    
    return false;
  }

  // Require the circle to be close to the hole center before snapping (max 5px)
  try {
    const circleCenter = (typeof drawnCircle.getCenterPoint === 'function') ? drawnCircle.getCenterPoint() : { x: drawnCircle.left, y: drawnCircle.top };
    const holeCenter = (typeof hole.getCenterPoint === 'function') ? hole.getCenterPoint() : { x: hole.left, y: hole.top };
    const dx = circleCenter.x - holeCenter.x;
    const dy = circleCenter.y - holeCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    console.log('[Lesson6] Circle distance to hole:', distance.toFixed(2));
    const MAX_DISTANCE = 5; // pixels
    if (distance > MAX_DISTANCE) {
      console.log('[Lesson6] Circle too far from hole - not snapping (distance:', distance.toFixed(2), ')');
      const panelEl = document.getElementById('panel');
      if (panelEl) {
        panelEl.innerHTML = `<p> Zet het gaatje op de juiste plaats.</p>`;
      }
      return false;
    }
  } catch (err) {
    console.warn('[Lesson6] Could not compute distance to hole:', err);
  }
  
  // Circle is valid! Snap it into place
  console.log('[Lesson6] Circle is valid! Snapping into place...');
  
  // Remove the drawn circle from canvas
  canvas.remove(drawnCircle);
  lesson6State.drawnCircle = null;
  
  // Restore hole with original styling (no dashed stroke, back to normal)
  // Stop the pulse animation first to avoid animation frames overriding styles
  try {
    if (lesson6State.animations.holePulse && lesson6State.animationController) {
      try { lesson6State.animationController.stopAnimation(lesson6State.animations.holePulse); } catch (e) {}
      lesson6State.animations.holePulse = null;
    }
    // Also stop generic ids just in case
    if (lesson6State.animationController) {
      try { lesson6State.animationController.stopAnimation('hole-pulse'); } catch (e) {}
      try { lesson6State.animationController.stopAnimation('pulse'); } catch (e) {}
    }
  } catch (e) { /* ignore */ }

  const orig = lesson6State.originalHoleStyle || { stroke: '#00619c', strokeDashArray: null, fill: '#ffffff', opacity: 1 };
  const applyOrig = () => {
    try {
      hole.set({
        visible: true,
        opacity: (orig.opacity !== undefined && orig.opacity !== null) ? orig.opacity : 1,
        stroke: orig.stroke || '#00619c',
        strokeDashArray: orig.strokeDashArray || null,
        fill: orig.fill || '#ffffff'
      });
      if (hole._objects) {
        hole._objects.forEach(obj => {
          try { obj.set({ stroke: orig.stroke || '#00619c', strokeDashArray: orig.strokeDashArray || null, fill: orig.fill || '#ffffff' }); } catch (e) {}
        });
      }
      if (typeof hole.setCoords === 'function') hole.setCoords();
      canvas.requestRenderAll();
    } catch (e) { /* ignore */ }
  };

  // Apply immediately and again on next tick to guard against racing animation frames
  applyOrig();
  setTimeout(applyOrig, 0);

  // Defensive: ensure hole is visible and styled correctly (guard against animation/race issues)
  try {
    if (hole) {
      const finalOpacity = (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.opacity !== undefined && lesson6State.originalHoleStyle.opacity !== null) ? lesson6State.originalHoleStyle.opacity : 1;
      hole.set({ visible: true, opacity: finalOpacity, stroke: (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.stroke) || '#00619c', strokeDashArray: (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.strokeDashArray) || null, fill: (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.fill) || '#ffffff' });
      if (hole._objects) {
        hole._objects.forEach(obj => {
          try { obj.set({ visible: true, stroke: (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.stroke) || '#00619c', strokeDashArray: (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.strokeDashArray) || null, fill: (lesson6State.originalHoleStyle && lesson6State.originalHoleStyle.fill) || '#ffffff' }); } catch (e) {}
        });
      }

      // Also defensively stop any known pulse animation ids that might be active
      try {
        if (lesson6State.animationController) {
          lesson6State.animationController.stopAnimation('hole-pulse');
          lesson6State.animationController.stopAnimation('pulse');
        }
      } catch (e) { /* ignore */ }

      if (typeof hole.setCoords === 'function') hole.setCoords();
      canvas.requestRenderAll();
    }
  } catch (e) {
    console.warn('[Lesson6] Defensive restore of hole failed:', e);
  }
  
  // Update instructions
  const panel = document.getElementById('panel');
  if (panel) {
    panel.innerHTML = `
      <h3>Goed gedaan!</h3>
      <p>Je hebt het gat voor de ketting voltooid! De badge is nu compleet.</p>
      <p>De maakuil kan deze nu om zijn nek hangen!</p>
    `;
  }
  // Mark hole as completed so subsequent UI actions don't revert instructions
  try { lesson6State.holeCompleted = true; } catch (e) {}
  
  // Reveal the lightning visual and enable the pen tool for tracing
  try {
    const lightningRef = lesson6State.lightning;
    if (lightningRef) {
      lightningRef.set({ visible: true, selectable: false, evented: false });
      lightningRef.setCoords();
    }

    // Style the first lightning target as an outlined dashed target (like the hole)
    const lt1 = lesson6State.lightningTarget1;
    if (lt1) {
      lt1.set({ visible: true, selectable: false, evented: false, stroke: '#999', strokeDashArray: [6, 6], fill: null, opacity: 1 });
      if (lt1._objects) {
        lt1._objects.forEach(o => o.set({ stroke: '#999', strokeDashArray: [6, 6], fill: null }));
      }
      lt1.setCoords();
      if (lesson6State.animationController) {
        lesson6State.animationController.startPulseAnimation(lt1, 'lightning-target-pulse');
        lesson6State.animations.lightningPulse = 'lightning-target-pulse';
      }
    }

    // Keep the next lightning targets hidden for now; they will be revealed
    // only after the first traced shape snaps to target 1.
    const lt2 = lesson6State.lightningTarget2;
    if (lt2) {
      lt2.set({ visible: false, selectable: false, evented: false });
      if (typeof lt2.setCoords === 'function') lt2.setCoords();
    }

    const lt3 = lesson6State.lightningTarget3;
    if (lt3) {
      lt3.set({ visible: false, selectable: false, evented: false });
      if (typeof lt3.setCoords === 'function') lt3.setCoords();
    }

    // Enable pen tool in toolbar and on controller
    const penToolBtn = document.getElementById('tool-pen');
    if (penToolBtn) {
      penToolBtn.disabled = false;
      penToolBtn.setAttribute('aria-disabled', 'false');
    }

    // Wire pen tool controller but DO NOT enable/activate it automatically.
    // The toolbar button must be pressed by the user to switch tools.
    if (typeof penToolController !== 'undefined') {
      penToolController.setFillStrokePanel(lesson6State.fillStrokePanel);
    }

    // Update instructions to prompt tracing
    if (panel) {
      panel.innerHTML = `
        <h3>Stap 3: Gebruik de pen-tool</h3>
        <p>De badge heeft maar 1 bliksemschicht. Is dat wel genoeg?</p>
        <p>Gebruik de pen-tool <img src="assets/icons/draw-path.svg" alt="Pen-Tool" style="width:30px;height:30px;vertical-align:middle">&nbsp; om zo goed mogelijk de originele bliksemschicht te traceren.</p>
        <p>Als je klaar bent, selecteer je het getekende pad en verplaats je die naar de omlijnde plek met de selectie-tool.</p>
      `;
    }

    // After the user has drawn and then moved the drawn path, snap it to the nearest visible lightning target within threshold
    const handlePenObjectModified = (e) => {
      const obj = e.target;
      if (!obj) return;
      const isPenShape = (obj.type === 'polyline' || obj.type === 'polygon') && obj.penToolPoints;
      if (!isPenShape) return;

      // Collect targets from state
      const targets = [lesson6State.lightningTarget1, lesson6State.lightningTarget2, lesson6State.lightningTarget3].filter(Boolean);
      if (targets.length === 0) return;

      try {
        const objCenter = (typeof obj.getCenterPoint === 'function') ? obj.getCenterPoint() : { x: obj.left, y: obj.top };

        // Find nearest target and distance
        let nearest = null;
        let nearestDist = Infinity;
        targets.forEach(t => {
          const tCenter = (typeof t.getCenterPoint === 'function') ? t.getCenterPoint() : { x: t.left, y: t.top };
          const dx = objCenter.x - tCenter.x;
          const dy = objCenter.y - tCenter.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = { target: t, center: tCenter };
          }
        });

        const SNAP_MAX = 12; // pixels
        if (nearest && nearestDist <= SNAP_MAX) {
          obj.set({ left: nearest.center.x, top: nearest.center.y, originX: 'center', originY: 'center' });
          obj.setCoords();
          canvas.requestRenderAll();
          obj.set({ lockMovementX: true, lockMovementY: true });

          // Prevent scaling and deletion: remove transform controls and lock scaling.
            try {
            obj.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, selectable: true, evented: true });
            Placed.set(obj, true);
            LockedFromDelete.set(obj, true);
            try { LastPos.set(obj, { left: obj.left, top: obj.top }); } catch (e) { /* ignore */ }

            // Attach a preservation handler that re-adds locked objects if accidentally removed
            if (!lesson6State.preserveRemovalHandler) {
              lesson6State.preserveRemovalHandler = (ev) => {
                try {
                  const removed = ev.target;
                  if (!removed) return;
                  if (LockedFromDelete.has(removed)) {
                    // Re-add the removed object to the canvas immediately
                    setTimeout(() => {
                      try {
                        canvas.add(removed);
                        if (typeof removed.setCoords === 'function') removed.setCoords();
                        canvas.requestRenderAll();
                      } catch (e) { /* ignore */ }
                    }, 0);
                  }
                } catch (e) { /* ignore */ }
              };
              canvas.on('object:removed', lesson6State.preserveRemovalHandler);
            }
          } catch (err) {
            console.warn('[Lesson6] Could not lock snapped pen object:', err);
          }

          // Hide the target object and stop any pulse animation tied to it
          try {
            const targetObj = nearest.target;
            if (targetObj) {
              targetObj.set({ visible: false, evented: false, selectable: false });
              if (typeof targetObj.setCoords === 'function') targetObj.setCoords();
            }
            if (lesson6State.animationController && lesson6State.animations && lesson6State.animations.lightningPulse) {
              lesson6State.animationController.stopAnimation(lesson6State.animations.lightningPulse);
              delete lesson6State.animations.lightningPulse;
            }
          } catch (err) {
            console.warn('[Lesson6] Error hiding lightning target after snap:', err);
          }

          console.log('[Lesson6] Pen shape snapped to lightning target (dist:', nearestDist.toFixed(1), ')');

          // Reveal the next lightning targets and update instructions to ask
          // the user to copy-paste their traced path onto the new targets.
          try {
            const lt2 = lesson6State.lightningTarget2;
            const lt3 = lesson6State.lightningTarget3;
            if (lt2) {
              lt2.set({ visible: true, selectable: false, evented: false, stroke: '#999', strokeDashArray: [6, 6], fill: null, opacity: 1 });
              if (lt2._objects) lt2._objects.forEach(o => o.set({ stroke: '#999', strokeDashArray: [6, 6], fill: null }));
              lt2.setCoords();
              if (lesson6State.animationController) {
                lesson6State.animationController.startPulseAnimation(lt2, 'lightning-target-pulse-2');
                lesson6State.animations.lightningPulse2 = 'lightning-target-pulse-2';
              }
            }
            if (lt3) {
              lt3.set({ visible: true, selectable: false, evented: false, stroke: '#999', strokeDashArray: [6, 6], fill: null, opacity: 1 });
              if (lt3._objects) lt3._objects.forEach(o => o.set({ stroke: '#999', strokeDashArray: [6, 6], fill: null }));
              lt3.setCoords();
              if (lesson6State.animationController) {
                lesson6State.animationController.startPulseAnimation(lt3, 'lightning-target-pulse-3');
                lesson6State.animations.lightningPulse3 = 'lightning-target-pulse-3';
              }
            }

            // Update the instruction panel to explain copy-paste step
            const panel = document.getElementById('panel');
            if (panel) {
              panel.innerHTML = `
                <h3>Stap 4: Kopieer en plak</h3>
                <p>Kopieer je eerder getekende pad met <img src="assets/icons/ctrl-control-button.svg" alt="Ctrl button" style="width:30px;height:30px;vertical-align:middle">&nbsp;<strong> + C</strong> en plak kopieën op de omlijnde plekken met <img src="assets/icons/ctrl-control-button.svg" alt="Ctrl button" style="width:30px;height:30px;vertical-align:middle">&nbsp;<strong> + V</strong></p>
                <p>Sleep de kopieën naar de juiste plek met de selectie-tool <img src="assets/icons/tool-pointer.svg" alt="Select" style="width:30px;height:30px;vertical-align:middle">&nbsp;</p>
              `;
            }

            // Ensure copy-paste functionality is available
            if (typeof copyPasteController !== 'undefined' && !copyPasteController.isEnabled) {
              try { copyPasteController.enable(); } catch (e) { /* ignore */ }
            }

            // Setup handler that snaps pasted copies when they are moved near a visible target
            const handlePastedObjectModified = (ev) => {
              const pasted = ev.target;
              if (!pasted) return;
              if (!Pasted.has(pasted)) return;

              // Consider targets 2 and 3 (only visible ones)
              const targets = [lesson6State.lightningTarget2, lesson6State.lightningTarget3].filter(t => t && t.visible);
              if (targets.length === 0) return;

              try {
                const objCenter = (typeof pasted.getCenterPoint === 'function') ? pasted.getCenterPoint() : { x: pasted.left, y: pasted.top };
                let nearestT = null;
                let nearestD = Infinity;
                targets.forEach(t => {
                  const tCenter = (typeof t.getCenterPoint === 'function') ? t.getCenterPoint() : { x: t.left, y: t.top };
                  const dx = objCenter.x - tCenter.x;
                  const dy = objCenter.y - tCenter.y;
                  const d = Math.sqrt(dx * dx + dy * dy);
                  if (d < nearestD) { nearestD = d; nearestT = { target: t, center: tCenter }; }
                });

                const SNAP_MAX = 12;
                if (nearestT && nearestD <= SNAP_MAX) {
                  pasted.set({ left: nearestT.center.x, top: nearestT.center.y, originX: 'center', originY: 'center' });
                  pasted.setCoords();
                  canvas.requestRenderAll();
                  pasted.set({ lockMovementX: true, lockMovementY: true });

                  // Hide the target and stop its pulse
                  try {
                    const tObj = nearestT.target;
                    if (tObj) {
                      tObj.set({ visible: false, selectable: false, evented: false });
                      if (typeof tObj.setCoords === 'function') tObj.setCoords();
                    }
                    if (lesson6State.animationController && lesson6State.animations) {
                      if (tObj === lesson6State.lightningTarget2 && lesson6State.animations.lightningPulse2) {
                        lesson6State.animationController.stopAnimation(lesson6State.animations.lightningPulse2);
                        delete lesson6State.animations.lightningPulse2;
                      }
                      if (tObj === lesson6State.lightningTarget3 && lesson6State.animations.lightningPulse3) {
                        lesson6State.animationController.stopAnimation(lesson6State.animations.lightningPulse3);
                        delete lesson6State.animations.lightningPulse3;
                      }
                    }
                  } catch (err) {
                    console.warn('[Lesson6] Error hiding lightning target after paste snap:', err);
                  }

                  // Mark pasted as placed and lock it (prevent scaling/deletion)
                  Pasted.delete(pasted);
                  Placed.set(pasted, true);
                  try { LastPos.set(pasted, { left: pasted.left, top: pasted.top }); } catch (e) { /* ignore */ }
                  try {
                    pasted.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, lockMovementX: true, lockMovementY: true, selectable: true, evented: true });
                    LockedFromDelete.set(pasted, true);
                    // Ensure preserveRemovalHandler exists so deletion attempts are reversed
                    if (!lesson6State.preserveRemovalHandler) {
                      lesson6State.preserveRemovalHandler = (ev) => {
                        try {
                          const removed = ev.target;
                          if (!removed) return;
                          if (LockedFromDelete.has(removed)) {
                            setTimeout(() => {
                              try { canvas.add(removed); if (typeof removed.setCoords === 'function') removed.setCoords(); canvas.requestRenderAll(); } catch (e) {}
                            }, 0);
                          }
                        } catch (e) { /* ignore */ }
                      };
                      canvas.on('object:removed', lesson6State.preserveRemovalHandler);
                    }
                  } catch (err) {
                    console.warn('[Lesson6] Could not lock pasted object after snap:', err);
                  }
                  console.log('[Lesson6] Pasted copy snapped to target (dist:', nearestD.toFixed(1), ')');

                  // If both pasted copies have been placed, enable the text tool
                  try {
                    const placedCount = canvas.getObjects().filter(o => Placed.has(o)).length;
                    if (placedCount >= 2) {
                      const textBtn = document.getElementById('tool-text');
                      if (textBtn) {
                        textBtn.disabled = false;
                        textBtn.setAttribute('aria-disabled', 'false');
                      }
                      // Make lesson name selectable so user can click it when text tool is active
                      try {
                        if (lesson6State.name) {
                          lesson6State.name.set({ selectable: true, evented: true });
                          if (typeof lesson6State.name.setCoords === 'function') lesson6State.name.setCoords();
                        }
                      } catch (err) {
                        console.warn('[Lesson6] Could not make name selectable:', err);
                      }
                      const panel = document.getElementById('panel');
                      if (panel) {
                        panel.innerHTML = `
                          <h3>Stap 5: Bewerk de naam</h3>
                          <p>De echte maker van vandaag, dat ben jij!</p>
                          <p>Pas de naam op de badge aan naar jouw naam.</p>
                          <p>Klik op de <img src="assets/icons/draw-text.svg" alt="Text tool" style="width:24px;height:24px;vertical-align:middle"> knop en selecteer vervolgens de naam om deze te bewerken.</p>
                        `;
                        // Add a manual "Next" button so the user proceeds when ready
                        try {
                          let proceedBtn = document.getElementById('lesson6-next-after-name');
                          if (!proceedBtn) {
                            proceedBtn = document.createElement('button');
                            proceedBtn.id = 'lesson6-next-after-name';
                            proceedBtn.innerHTML = '<i class="fa-solid fa-arrow-right" style="font-size:2.5em;color:white;"></i>';
                            proceedBtn.style.cssText = `
                              display: block;
                              width: 100%;
                              height: 48px;
                              margin: 12px auto 0 auto;
                              background: #1976d2;
                              color: white;
                              border: none;
                              border-radius: 24px;
                              cursor: pointer;
                              box-shadow: 0 2px 8px rgba(0,0,0,0.12);
                            `;
                            proceedBtn.addEventListener('click', async () => {
                              try {
                                // Show final congratulations and a single big download button
                                panel.innerHTML = `
                                  <h3>🎉 Gefeliciteerd!</h3>
                                  <p>Je kent nu de basisfuncties van Inkscape en hebt de badge voltooid.</p>
                                  <p>Download de badge als een SVG-bestand via de knop hieronder.</p>
                                  <p>Je kunt de badge later altijd opnieuw bewerken in Inkscape!</p>
                                `;
                                try {
                                  let bigDownload = document.getElementById('lesson6-download-btn');
                                  if (!bigDownload) {
                                    bigDownload = document.createElement('button');
                                    bigDownload.id = 'lesson6-download-btn';
                                    bigDownload.style.cssText = `
                                      display: block;
                                      width: 100%;
                                      height: 64px;
                                      margin: 12px auto 0 auto;
                                      background: #1976d2;
                                      border: none;
                                      border-radius: 32px;
                                      cursor: pointer;
                                      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                                      color: white;
                                    `;
                                    bigDownload.innerHTML = '<i class="fa-solid fa-download" style="font-size:2.2em;color:white;"></i>';
                                    bigDownload.addEventListener('click', async () => {
                                      try {
                                        const exportVisibleOnly = async () => {
                                          try {
                                            const visibleObjs = canvas.getObjects().filter(o => !!o.visible);
                                            const tmpEl = document.createElement('canvas');
                                            tmpEl.width = canvas.getWidth();
                                            tmpEl.height = canvas.getHeight();
                                            const tmpCanvas = new fabric.StaticCanvas(tmpEl, { enableRetinaScaling: false });
                                            tmpCanvas.setWidth(canvas.getWidth());
                                            tmpCanvas.setHeight(canvas.getHeight());

                                            // Clone visible objects
                                            const clones = await Promise.all(visibleObjs.map(o => new Promise((res) => {
                                              try {
                                                if (typeof o.clone === 'function') {
                                                  o.clone((cl) => {
                                                    try { cl.set({ selectable: false, evented: false }); } catch (e) {}
                                                    res(cl);
                                                  });
                                                } else {
                                                  const objData = o.toObject();
                                                  fabric.util.enlivenObjects([objData], (objs) => res(objs[0]));
                                                }
                                              } catch (err) {
                                                console.warn('[Lesson6] Error cloning object for export:', err);
                                                res(null);
                                              }
                                            })));

                                            // Filter out null clones
                                            const realClones = clones.filter(Boolean);

                                            if (realClones.length === 0) {
                                              return canvas.toSVG();
                                            }

                                            // Create a group from the clones and center it on the temporary canvas
                                            const group = new fabric.Group(realClones, {
                                              originX: 'center',
                                              originY: 'center'
                                            });

                                            // Position group at center of tmp canvas
                                            group.left = tmpCanvas.getWidth() / 2;
                                            group.top = tmpCanvas.getHeight() / 2;
                                            group.setCoords();

                                            // Add group to temp canvas (clear any previous content)
                                      Pasted.delete(pasted);
                                      Placed.set(pasted, true);
                                      // Prevent scaling and deletion of the placed copy
                                      try {
                                        pasted.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, selectable: true, evented: true });
                                        LockedFromDelete.set(pasted, true);
                                        if (!lesson6State.preserveRemovalHandler) {
                                          lesson6State.preserveRemovalHandler = (ev) => {
                                            try {
                                              const removed = ev.target;
                                              if (!removed) return;
                                              if (LockedFromDelete.has(removed)) {
                                                setTimeout(() => {
                                                  try { canvas.add(removed); if (typeof removed.setCoords === 'function') removed.setCoords(); canvas.requestRenderAll(); } catch (e) {}
                                                }, 0);
                                              }
                                            } catch (e) {}
                                          };
                                          canvas.on('object:removed', lesson6State.preserveRemovalHandler);
                                        }
                                      } catch (err) {
                                        console.warn('[Lesson6] Could not lock pasted object:', err);
                                      }
                                            tmpCanvas.renderAll();

                                            const svg = tmpCanvas.toSVG();
                                            try { tmpCanvas.dispose && tmpCanvas.dispose(); } catch (e) {}
                                            return svg;
                                          } catch (err) {
                                            console.warn('[Lesson6] Failed to export visible-only SVG:', err);
                                            return canvas.toSVG();
                                          }
                                        };
                                        const svg = await exportVisibleOnly();
                                        // Prefer native Save File Picker when available (Chromium-based browsers)
                                        if (window.showSaveFilePicker) {
                                          try {
                                            const options = {
                                              suggestedName: 'badge.svg',
                                              types: [
                                                {
                                                  description: 'SVG File',
                                                  accept: { 'image/svg+xml': ['.svg'] }
                                                }
                                              ]
                                            };
                                            const handle = await window.showSaveFilePicker(options);
                                            const writable = await handle.createWritable();
                                            // Write SVG string as a Blob so encoding is preserved
                                            const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
                                            await writable.write(svgBlob);
                                            await writable.close();
                                            console.log('[Lesson6] Saved badge via File System Access API');
                                          } catch (err) {
                                            // If the user cancelled the Save File Picker, do NOT fall back to automatic download.
                                            const name = err && err.name ? String(err.name) : '';
                                            const message = err && err.message ? String(err.message) : '';
                                            if (name === 'AbortError' || name === 'NotAllowedError' || /user cancelled|user aborted|cancelled/i.test(message)) {
                                              console.log('[Lesson6] User cancelled Save File Picker; aborting save without fallback');
                                              return;
                                            }
                                            console.warn('[Lesson6] SaveFilePicker failed, falling back to download:', err);
                                            const blob = new Blob([svg], { type: 'image/svg+xml' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = 'badge.svg';
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                            setTimeout(() => URL.revokeObjectURL(url), 1500);
                                          }
                                        } else {
                                          // Fallback: create anchor download which many browsers will show a Save As dialog depending on user settings
                                          const blob = new Blob([svg], { type: 'image/svg+xml' });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = 'badge.svg';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => URL.revokeObjectURL(url), 1500);
                                        }
                                      } catch (err) {
                                        console.warn('[Lesson6] Failed to generate SVG for download:', err);
                                      }
                                    });
                                    panel.appendChild(bigDownload);
                                  }
                                } catch (err) {
                                  console.warn('[Lesson6] Could not add download button to final panel:', err);
                                }
                              } catch (err) {
                                console.warn('[Lesson6] Error showing final panel from proceed button:', err);
                              }
                            });
                            panel.appendChild(proceedBtn);
                          }
                        } catch (err) {
                          console.warn('[Lesson6] Could not add proceed button to name panel:', err);
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('[Lesson6] Error enabling text tool after placing copies:', err);
                  }
                }
              } catch (err) {
                console.warn('[Lesson6] Error snapping pasted object:', err);
              }
            };

            lesson6State.pasteModifiedHandler = handlePastedObjectModified;
            canvas.on('object:modified', handlePastedObjectModified);

          } catch (err) {
            console.warn('[Lesson6] Error revealing further targets after snap:', err);
          }

          // Remove the pen handler since initial trace is placed
          canvas.off('object:modified', handlePenObjectModified);
        } else {
          console.log('[Lesson6] No nearby lightning target to snap to (nearest:', nearestDist.toFixed(1), ')');
        }
      } catch (err) {
        console.warn('[Lesson6] Error snapping pen object:', err);
      }
    };

    // Delay attaching snap handlers until the learner finishes the aside exercise.
    // Store the pen handler for later invocation and register a light-weight
    // owner-scoped `object:added` handler that shows the aside when a pen object
    // is created. The aside's arrow will call `handlePenObjectModified` to perform
    // the actual snapping and continuation to copy/paste.
    try {
      lesson6State.pendingPenHandler = handlePenObjectModified;

      const handlePenAddedForAside = (ev) => {
        try {
          const obj = ev.target;
          if (!obj) return;
          const isPenShape = (obj.type === 'polyline' || obj.type === 'polygon') && obj.penToolPoints;
          if (!isPenShape) return;

          // Remember the last drawn pen object and mark that we're awaiting the aside
          lesson6State.lastPenObject = obj;
          lesson6State.awaitingStrokeAside = true;

          // Show the aside in the instruction panel (Stap 4) and surface the Fill & Stroke panel
          try {
            const panel = document.getElementById('panel');
            if (panel) {
              panel.innerHTML = `
                <h3>Stap 4: Selecteer de streek (niet de vulling)</h3>
                <p>Je getekende pad heeft standaard <strong>geen vulling</strong> en alleen een <strong>streek</strong> (de lijn). Om het pad te selecteren moet je precies op de lijn klikken — klikken in het lege binnengebied werkt niet.</p>
                <p>Probeer nu het pad te selecteren (klik op de lijn). Gebruik het paneel rechts om de <strong>streek</strong> kleur en de <strong>vulling</strong> uit te proberen. Als je een vulling toevoegt, kun je daarna ook in het binnengebied klikken om te selecteren.</p>
                <div style="margin-top:10px;">
                  <button id="lesson6-continue-to-copypaste" aria-label="Volgende" style="width:100%;height:44px;background:#1976d2;color:white;border:none;border-radius:8px;cursor:pointer">
                    <i class="fa-solid fa-arrow-right" style="font-size:1.4em;color:white;"></i>
                  </button>
                </div>
              `;
            }

            // Ensure the Fill & Stroke panel is available and visible
            if (!lesson6State.fillStrokePanel) {
              lesson6State.fillStrokePanel = setupFillStrokePanel();
            }
            try { lesson6State.fillStrokePanel.show(); } catch (e) { /* ignore */ }

            // Select the drawn object so the panel operates on it
            try { canvas.setActiveObject(obj); canvas.requestRenderAll(); } catch (e) { /* ignore */ }

            // Wire the continue arrow to invoke the original pen handler (which performs snapping)
            const cont = document.getElementById('lesson6-continue-to-copypaste');
            if (cont) {
              const onContinue = () => {
                try {
                  // Hide panel and mark that aside is done
                  try { lesson6State.fillStrokePanel.hide(); } catch (e) {}
                  lesson6State.awaitingStrokeAside = false;

                  // Invoke the original pen handler to snap this object and continue flow
                  try { handlePenObjectModified({ target: obj }); } catch (e) { /* ignore */ }

                  // Unbind this continue handler
                  try { cont.removeEventListener('click', onContinue); } catch (e) {}
                } catch (e) { /* ignore */ }
              };
              cont.addEventListener('click', onContinue, { once: true });
              lesson6State.continueButtonHandler = onContinue;
            }
          } catch (err) {
            console.warn('[Lesson6] Error showing stroke-vs-fill aside:', err);
          }
        } catch (e) { /* ignore */ }
      };

      // Register the aside-triggering handler owner-scoped so it will be cleaned up on lesson exit
      registerEvent(canvas, 'object:added', handlePenAddedForAside, lesson6State);
      lesson6State.penAsideHandler = handlePenAddedForAside;
    } catch (err) {
      console.warn('[Lesson6] Could not attach pen aside handler:', err);
    }
    // Ensure pasted copies that are added and are already near targets get locked immediately
    try {
            lesson6State.pasteAddedHandler = (ev) => {
        try {
          const obj = ev.target;
          if (!obj) return;
          // If this object was just pasted (controller sets registry)
          const isPasted = Pasted.has(obj);
          // Also consider objects that were placed programmatically
          const alreadyPlaced = Placed.has(obj);
          if (!isPasted && !alreadyPlaced) return;

          const targets = [lesson6State.lightningTarget1, lesson6State.lightningTarget2, lesson6State.lightningTarget3].filter(Boolean);
          if (targets.length === 0) return;

          const objCenter = (typeof obj.getCenterPoint === 'function') ? obj.getCenterPoint() : { x: obj.left, y: obj.top };
          let nearest = null;
          let nd = Infinity;
          targets.forEach(t => {
            if (!t.visible) return;
            const tCenter = (typeof t.getCenterPoint === 'function') ? t.getCenterPoint() : { x: t.left, y: t.top };
            const dx = objCenter.x - tCenter.x;
            const dy = objCenter.y - tCenter.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nd) { nd = d; nearest = { target: t, center: tCenter }; }
          });

          const SNAP_MAX = 12;
          if (nearest && nd <= SNAP_MAX) {
            // Snap into place and lock the object
            obj.set({ left: nearest.center.x, top: nearest.center.y, originX: 'center', originY: 'center' });
            obj.setCoords();
            canvas.requestRenderAll();
            obj.set({ lockMovementX: true, lockMovementY: true, hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, selectable: true, evented: true });
            Pasted.delete(obj);
            Placed.set(obj, true);
            LockedFromDelete.set(obj, true);
            try { LastPos.set(obj, { left: obj.left, top: obj.top }); } catch (e) { /* ignore */ }

            // Hide the target and stop its pulse if applicable
            try {
              const tObj = nearest.target;
              if (tObj) {
                tObj.set({ visible: false, selectable: false, evented: false });
                if (typeof tObj.setCoords === 'function') tObj.setCoords();
              }
            } catch (e) { /* ignore */ }

            // Ensure preserveRemovalHandler exists so deletion attempts are reversed
            if (!lesson6State.preserveRemovalHandler) {
              lesson6State.preserveRemovalHandler = (ev2) => {
                try {
                  const removed = ev2.target;
                  if (!removed) return;
                  if (LockedFromDelete.has(removed)) {
                    setTimeout(() => { try { canvas.add(removed); if (typeof removed.setCoords === 'function') removed.setCoords(); canvas.requestRenderAll(); } catch (e) {} }, 0);
                  }
                } catch (e) {}
              };
              canvas.on('object:removed', lesson6State.preserveRemovalHandler);
            }
          }
        } catch (err) { /* ignore */ }
      };
      canvas.on('object:added', lesson6State.pasteAddedHandler);
    } catch (err) {
      console.warn('[Lesson6] Could not attach paste-added handler:', err);
    }
  } catch (err) {
    console.warn('[Lesson6] Could not enable pen tracing step:', err);
  }
  return true;
}

/**
 * Start Lesson 6
 */
export async function startLesson6() {
  if (lesson6State.isActive) {
    console.log('[Lesson6] Already active');
    return;
  }

  try {
    console.log('[Lesson6] Starting...');
    lesson6State.isActive = true;

    // Ensure shape/text tools are disabled initially to avoid them being
    // pre-enabled when entering lessons non-linearly.
    try {
      const ellipseTool = document.getElementById('tool-ellipse');
      const textTool = document.getElementById('tool-text');
      const penTool = document.getElementById('tool-pen');
      if (ellipseTool) {
        ellipseTool.disabled = true;
        ellipseTool.setAttribute('aria-disabled', 'true');
        ellipseTool.classList && ellipseTool.classList.remove('active');
      }
      if (textTool) {
        textTool.disabled = true;
        textTool.setAttribute('aria-disabled', 'true');
        textTool.classList && textTool.classList.remove('active');
      }
      if (penTool) {
        penTool.disabled = true;
        penTool.setAttribute('aria-disabled', 'true');
        penTool.classList && penTool.classList.remove('active');
      }
    } catch (e) { /* defensive */ }

    // Auto-cleanup when user navigates away (hash change) or refreshes
    try {
      lesson6State._hashChangeHandler = () => {
        try {
          if (!location.hash || !location.hash.includes('lesson=6')) {
            cleanupLesson6();
          }
        } catch (e) { /* ignore */ }
      };
      window.addEventListener('hashchange', lesson6State._hashChangeHandler, true);

      lesson6State._beforeUnloadHandler = () => { try { cleanupLesson6(); } catch (e) {} };
      window.addEventListener('beforeunload', lesson6State._beforeUnloadHandler, true);
    } catch (e) { /* ignore */ }

    // First, show the end state of Lesson 5 so the user sees the machine and context
    try {
      await startLesson5();
    } catch (e) {
      console.warn('[Lesson6] Could not start Lesson 5 as backdrop:', e);
    }

    // Enter Lesson 5 end state (bulbs on, gears rotating, owl wiggling, viewport zoomed to machine)
    // Pass 6 to indicate we're in Lesson 6, so object positions are set immediately without animation
    enterEndState(6);

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
    //updateInstructionPanel();

    
    // Setup Fill & Stroke panel for Lesson 6 interactions
    lesson6State.fillStrokePanel = setupFillStrokePanel();
    // Enable the panel for this lesson (it remains hidden until explicitly shown)
    try { lesson6State.fillStrokePanel.enable(); } catch (e) { /* ignore */ }
    // Hide panel initially until user selects something
    try { lesson6State.fillStrokePanel.hide(); } catch (e) { /* ignore */ }

    // Create animation controller for this lesson and store on state
    lesson6State.animationController = new AnimationController(canvas);

    // Monkey-patch canvas.remove to block removal of locked objects while lesson active
    try {
      if (!lesson6State._origCanvasRemove) {
        lesson6State._origCanvasRemove = canvas.remove.bind(canvas);
        canvas.remove = function(obj) {
          try {
            // If an array of objects, filter out locked ones
            if (Array.isArray(obj)) {
              const allowed = obj.filter(o => !(o && LockedFromDelete.has(o)));
              if (allowed.length === 0) return canvas;
              return lesson6State._origCanvasRemove(allowed);
            }
            if (obj && LockedFromDelete.has(obj)) {
              console.warn('[Lesson6] Blocked removal of locked object');
              return canvas;
            }
          } catch (e) { /* ignore */ }
          return lesson6State._origCanvasRemove(obj);
        };
      }
    } catch (err) {
      console.warn('[Lesson6] Could not patch canvas.remove to protect locked objects:', err);
    }

    // Intercept Delete/Backspace while lesson is active to protect locked objects
    try {
      lesson6State.keydownHandler = (ev) => {
        try {
          const key = ev.key || ev.keyCode;
          if (key === 'Delete' || key === 'Backspace' || key === 8 || key === 46) {
            const active = (typeof canvas.getActiveObjects === 'function') ? canvas.getActiveObjects() : (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
            if (active && active.some(o => o && LockedFromDelete.has(o))) {
              ev.preventDefault();
              ev.stopPropagation();
              /*try {
                const panel = document.getElementById('panel');
                if (panel) {
                  const original = panel.innerHTML;
                  panel.innerHTML = '<p style="color:#d9534f;"><strong>Dit object kan niet verwijderd worden.</strong></p>';
                  setTimeout(() => { try { if (document.getElementById('panel')) document.getElementById('panel').innerHTML = original; } catch (e) {} }, 1400);
                }
              } catch (e) {}*/
            }
          }
        } catch (e) { /* ignore */ }
      };
      window.addEventListener('keydown', lesson6State.keydownHandler, true);
    } catch (err) {
      console.warn('[Lesson6] Could not attach keydown protect handler:', err);
    }

    // Load badge assets (badge, ink stains, hole)
    console.log('[Lesson6] Loading badge assets...');
    let { badge, ink, hole, owl, lightning, lightningTarget1, lightningTarget2, lightningTarget3, name } = await loadBadgeAssets();

    if (!badge) {
      console.error('[Lesson6] Badge asset missing, aborting lesson setup');
      return;
    }
    
    console.log('[Lesson6] Badge loaded successfully:', badge);
    console.log('[Lesson6] Badge dimensions:', badge.width, 'x', badge.height);
    console.log('[Lesson6] Badge has', badge._objects?.length || 0, 'child objects');
    
    // Log detailed badge structure
    if (badge._objects) {
      console.log('[Lesson6] Badge structure:');
      badge._objects.forEach((obj, i) => {
        console.log(`  [${i}] type=${obj.type}, id=${obj.id}, visible=${obj.visible}, opacity=${obj.opacity}`);
        if (obj.type === 'group' && obj._objects) {
          console.log(`      Contains ${obj._objects.length} children:`);
          obj._objects.forEach((child, j) => {
            console.log(`        [${j}] type=${child.type}, id=${child.id}, visible=${child.visible}`);
          });
        }
      });
    }
    
    console.log('[Lesson6] Ink loaded:', !!ink, ink?._objects?.length || 0, 'children');
    console.log('[Lesson6] Hole loaded:', !!hole, hole?._objects?.length || 0, 'children');
    console.log('[Lesson6] Owl loaded:', !!owl, owl?._objects?.length || 0, 'children');
    console.log('[Lesson6] Lightning loaded:', !!lightning, lightning?._objects?.length || 0, 'children');
    console.log('[Lesson6] Lightning targets loaded:', !!lightningTarget1, !!lightningTarget2, !!lightningTarget3);
    console.log('[Lesson6] Name loaded:', !!name, name?._objects?.length || 0, 'children');
    if (name) {
      console.log('[Lesson6] Name dimensions:', name.width, 'x', name.height, 'scale:', name.scaleX, name.scaleY);
    }

    // Replace the imported `Name` SVG group with an editable Fabric IText
    // using a default label 'MaakUil' but positioned where the original
    // `name` object was. This ensures an editable text object exists regardless
    // of the SVG fragment content.
    if (name) {
      try {
        const textContent = 'MaakUil';
        const fontSize = 60; // default size matching layout
        const fontFamily = 'Arial';
        const txt = new fabric.IText(textContent, {
          left: (typeof name.left !== 'undefined') ? name.left : 0,
          top: (typeof name.top !== 'undefined') ? name.top : 0,
          originX: name?.originX || 'center',
          originY: name?.originY || 'center',
          fontSize,
          fontFamily,
          fill: '#263238',
          stroke: '#00619c',
          selectable: false,
          evented: false
        });

        // Preserve scaling from the original group if present
        try { if (typeof name.scaleX !== 'undefined') txt.scaleX = name.scaleX; } catch (e) {}
        try { if (typeof name.scaleY !== 'undefined') txt.scaleY = name.scaleY; } catch (e) {}

        // Replace the `name` reference so the IText will be added to the canvas
        name = txt;
      } catch (err) {
        console.warn('[Lesson6] Could not create IText for Name replacement:', err);
      }
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

    if (ENABLE_BADGE_OUTPUT) {
      // Find the machine to use as reference for badge placement
      const machine = canvas.getObjects().find(o => 
        (o.tutorialId && o.tutorialId === 'MakerMachine') || 
        (o.id && o.id.toLowerCase().includes('layer_2'))
      );
      
      console.log('[Lesson6] Machine found:', !!machine);
      
      // Get the center of the badge itself (in its local coordinate space)
      const badgeBounds = badge.getBoundingRect(true);
      const badgeCenterLocalX = badgeBounds.left + badgeBounds.width / 2;
      const badgeCenterLocalY = badgeBounds.top + badgeBounds.height / 2;
      console.log('[Lesson6] Badge local center:', badgeCenterLocalX, badgeCenterLocalY);
      console.log('[Lesson6] Badge bounds:', badgeBounds);
      
      // Get the machine's center in object space (what the user is viewing)
      let machineCenterX, machineCenterY;
      if (machine) {
        const machineBounds = machine.getBoundingRect(true);
        machineCenterX = machineBounds.left + machineBounds.width / 2;
        machineCenterY = machineBounds.top + machineBounds.height / 2;
        console.log('[Lesson6] Machine center in object space:', machineCenterX, machineCenterY);
      } else {
        // Fallback to screen center converted to object space
        const screenCenterX = canvas.getWidth() / 2;
        const screenCenterY = canvas.getHeight() / 2;
        const vpt = canvas.viewportTransform;
        const zoom = canvas.getZoom();
        machineCenterX = (screenCenterX - vpt[4]) / zoom;
        machineCenterY = (screenCenterY - vpt[5]) / zoom;
        console.log('[Lesson6] Using screen center in object space:', machineCenterX, machineCenterY);
      }
      
      // Position the badge group so its center aligns with the machine's center
      const badgeGroupLeft = machineCenterX;
      const badgeGroupTop = machineCenterY;
      
      console.log('[Lesson6] Badge group will be positioned at:', badgeGroupLeft, badgeGroupTop);

      // Prepare elements with their original relative positions preserved
      // Set visibility and interaction properties without changing positions
      badge.set({
        visible: true,
        opacity: 1,
        selectable: true,
        evented: true
      });

      if (ink) {
        ink.set({
          visible: true,
          selectable: true,
          evented: true
        });
      }

      if (hole) {
        hole.set({
          visible: false,  // Hide hole initially - show after ink deleted
          selectable: false,
          evented: false
        });
        // Preserve original hole styling so we can restore it after snapping
        lesson6State.originalHoleStyle = {
          stroke: hole.stroke,
          strokeDashArray: hole.strokeDashArray,
          fill: hole.fill,
          opacity: hole.opacity
        };
      }

      if (owl) {
        owl.set({
          visible: true,
          selectable: true,
          evented: true
        });
      }

      if (lightning) {
        // Show the visual lightning (the one to trace) at the badge start
        // The outlined target versions should remain hidden until pen-tracing
        lightning.set({
          visible: true,
          selectable: false,
          evented: false
        });
      }

      if (name) {
        // Set the font size to 60pt to match original design
        name.set({
          visible: true,
          selectable: false,
          evented: false,
          fontSize: 60
        });
        console.log('[Lesson6] Name font size set to 60pt');
      }

      // Keep lightning targets hidden initially; reveal the outlined target
      // only when we enter the pen-tracing step.
      if (lightningTarget1) {
        lightningTarget1.set({
          visible: false,
          selectable: false,
          evented: false
        });
      }

      if (lightningTarget2) {
        lightningTarget2.set({
          visible: false,
          selectable: false,
          evented: false
        });
      }

      if (lightningTarget3) {
        lightningTarget3.set({
          visible: false,
          selectable: false,
          evented: false
        });
      }

      // Add all badge elements directly to canvas (ungrouped) but lock them in place
      // Layer order from original SVG: Badge (bottom), Lightning targets, Lightning, Hole, Name, Owl, Ink (top)
      const badgeElements = [badge, lightningTarget1, lightningTarget2, lightningTarget3, lightning, hole, name, owl, ink].filter(Boolean);
      
      // First, calculate the overall bounds of all badge elements to preserve relative positions
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      badgeElements.forEach(el => {
        const bounds = el.getBoundingRect(true);
        minX = Math.min(minX, bounds.left);
        minY = Math.min(minY, bounds.top);
        maxX = Math.max(maxX, bounds.left + bounds.width);
        maxY = Math.max(maxY, bounds.top + bounds.height);
      });
      const overallCenterX = (minX + maxX) / 2;
      const overallCenterY = (minY + maxY) / 2;
      
      console.log('[Lesson6] Badge overall bounds:', { minX, minY, maxX, maxY, overallCenterX, overallCenterY });
      
      // Position and lock all badge elements while preserving their relative positions
      badgeElements.forEach(element => {
        // Get the element's position relative to the overall badge center
        const bounds = element.getBoundingRect(true);
        const elementCenterX = bounds.left + bounds.width / 2;
        const elementCenterY = bounds.top + bounds.height / 2;
        const offsetX = elementCenterX - overallCenterX;
        const offsetY = elementCenterY - overallCenterY;
        
        // Position element relative to machine center, preserving relative offset
        element.set({
          left: badgeGroupLeft + offsetX,
          top: badgeGroupTop + offsetY,
          originX: 'center',
          originY: 'center',
          scaleX: 0.05,
          scaleY: 0.05,
          objectCaching: false
        });
        
        // Lock movement on all elements
        element.set({
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          hasControls: false
        });
        
        // Make only ink selectable
        if (element === ink) {
          element.set({ selectable: true, evented: true });
        } else {
          element.set({ selectable: false, evented: false });
        }
        
        element.setCoords();
        canvas.add(element);
      });
      
      canvas.bringToFront(ink); // Ensure ink is on top
      canvas.requestRenderAll();
      
      console.log('[Lesson6] Badge elements added to canvas (ungrouped)');
      console.log('[Lesson6] Badge elements count:', badgeElements.length);
      badgeElements.forEach((el, i) => {
        console.log(`[Lesson6]   Element ${i}: type=${el.type}, selectable=${el.selectable}, visible=${el.visible}`);
      });
      console.log('[Lesson6] Canvas objects count:', canvas.getObjects().length);

      // Store references for event handlers
      const badgeRef = badge;
      const inkRef = ink;
      // Keep lightning refs on state for later steps
      lesson6State.lightning = lightning;
      lesson6State.lightningTarget1 = lightningTarget1;
      lesson6State.lightningTarget2 = lightningTarget2;
      lesson6State.lightningTarget3 = lightningTarget3;
      // Keep name ref on state for later editing steps
      lesson6State.name = name;

      // Final panel is shown manually via the "Volgende" button in the name-edit instructions.

      // Animate badge elements from small to full size
      console.log('[Lesson6] Starting badge animation. Target scale: 1');
      
      fabric.util.animate({
        startValue: 0.05,
        endValue: 1,
        duration: 1400,
        easing: fabric.util.ease.easeOutCubic,
        onChange(value) {
          // Scale all badge elements together
          badgeElements.forEach(el => {
            el.scaleX = el.scaleY = value;
            el.setCoords();
          });
          canvas.requestRenderAll();
        },
        onComplete() {
          console.log('[Lesson6] Badge animation complete');
          
          // When badge is large enough, scale down and hide other lesson 5 elements
          const lesson5Objects = canvas.getObjects().filter(obj => !badgeElements.includes(obj));
          
          console.log('[Lesson6] Scaling down', lesson5Objects.length, 'lesson 5 objects');
          
          // Animate all lesson 5 objects scaling down
          lesson5Objects.forEach(obj => {
            const originalScale = obj.scaleX || 1;
            fabric.util.animate({
              startValue: originalScale,
              endValue: 0,
              duration: 800,
              easing: fabric.util.ease.easeInCubic,
              onChange(value) {
                obj.scaleX = obj.scaleY = value;
                obj.setCoords();
                canvas.requestRenderAll();
              },
              onComplete() {
                obj.visible = false;
                obj.evented = false;
                obj.selectable = false;
                canvas.requestRenderAll();
              }
            });
          });

          console.log('[Lesson6] Badge elements are now locked in place, only ink is selectable');
          
          // Setup selection and object-added event handlers (store on state for precise cleanup)
          lesson6State.selectionCreatedHandler = (e) => {
            try {
              const selected = canvas.getActiveObject();
              console.log('[Lesson6] Selection created:', {
                type: selected?.type,
                isInk: selected === ink,
                id: selected?.id,
                name: selected?.name
              });
              if (lesson6State.fillStrokePanel) lesson6State.fillStrokePanel.updateForObject(selected);
              // If this is a multi-selection (ActiveSelection) and it contains any placed/locked objects,
              // disable transform controls on the selection so marquee selection cannot scale/rotate them.
              try {
                  const isActiveSel = selected && (selected.type === 'activeSelection' || Array.isArray(selected._objects));
                if (isActiveSel) {
                  const objs = selected._objects || [];
                  const hasLocked = objs.some(o => o && (LockedFromDelete.has(o) || Placed.has(o)));
                  if (hasLocked) {
                    try {
                      selected.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, lockMovementX: true, lockMovementY: true, selectable: true, evented: true });
                      // Ensure children remain selectable for copy/paste but are not individually transformable or movable via group handles
                      objs.forEach(o => { try { o.set({ selectable: true, hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, lockMovementX: true, lockMovementY: true }); } catch (e) {} });
                      if (typeof selected.setCoords === 'function') selected.setCoords();
                      canvas.requestRenderAll();
                    } catch (e) { /* ignore */ }
                  }
                }
              } catch (e) { /* ignore */ }
              try {
                const textBtn = document.getElementById('tool-text');
                if (selected === lesson6State.name && textBtn && textBtn.classList.contains('active')) {
                  selected.set({ selectable: true, evented: true });
                  canvas.setActiveObject(selected);
                  if (typeof selected.enterEditing === 'function') selected.enterEditing();
                  if (typeof selected.selectAll === 'function') selected.selectAll();
                }
              } catch (err) { console.warn('[Lesson6] Error handling selection for text editing:', err); }
            } catch (err) { console.warn('[Lesson6] selectionCreatedHandler error:', err); }
          };

          lesson6State.selectionUpdatedHandler = (e) => {
            try {
              const selected = canvas.getActiveObject();
              console.log('[Lesson6] Selection updated:', { type: selected?.type, id: selected?.id });
              if (lesson6State.fillStrokePanel) lesson6State.fillStrokePanel.updateForObject(selected);
              // Apply same protection for updated selections (marquee/resizing updates)
              try {
                const isActiveSel = selected && (selected.type === 'activeSelection' || Array.isArray(selected._objects));
                if (isActiveSel) {
                  const objs = selected._objects || [];
                  const hasLocked = objs.some(o => o && (LockedFromDelete.has(o) || Placed.has(o)));
                  if (hasLocked) {
                    try {
                      selected.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, lockMovementX: true, lockMovementY: true, selectable: true, evented: true });
                      objs.forEach(o => { try { o.set({ selectable: true, hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, lockMovementX: true, lockMovementY: true }); } catch (e) {} });
                      if (typeof selected.setCoords === 'function') selected.setCoords();
                      canvas.requestRenderAll();
                    } catch (e) { /* ignore */ }
                  }
                }
              } catch (e) { /* ignore */ }
              try {
                const textBtn = document.getElementById('tool-text');
                if (selected === lesson6State.name && textBtn && textBtn.classList.contains('active')) {
                  selected.set({ selectable: true, evented: true });
                  canvas.setActiveObject(selected);
                  if (typeof selected.enterEditing === 'function') selected.enterEditing();
                  if (typeof selected.selectAll === 'function') selected.selectAll();
                }
              } catch (err) { console.warn('[Lesson6] Error handling selection for text editing:', err); }
            } catch (err) { console.warn('[Lesson6] selectionUpdatedHandler error:', err); }
          };

          lesson6State.selectionClearedHandler = (e) => {
            try {
              console.log('[Lesson6] Selection cleared');
              if (lesson6State.fillStrokePanel) lesson6State.fillStrokePanel.updateForObject(null);
            } catch (err) { console.warn('[Lesson6] selectionClearedHandler error:', err); }
          };

          canvas.on('selection:created', lesson6State.selectionCreatedHandler);
          canvas.on('selection:updated', lesson6State.selectionUpdatedHandler);
          canvas.on('selection:cleared', lesson6State.selectionClearedHandler);

          // Protect placed/locked objects from being moved, including via marquee (activeSelection)
          lesson6State.moveProtectHandler = (e) => {
            try {
              const obj = e.target;
              if (!obj) return;
              // If an ActiveSelection is being moved, restore any locked children to their last positions
              if (obj.type === 'activeSelection' || Array.isArray(obj._objects)) {
                const objs = obj._objects || [];
                const hasLocked = objs.some(o => o && (LockedFromDelete.has(o) || Placed.has(o)));
                if (hasLocked) {
                  objs.forEach(o => {
                    try {
                      if (o && (LockedFromDelete.has(o) || Placed.has(o))) {
                        const last = LastPos.get(o);
                        if (last) {
                          o.set({ left: last.left, top: last.top });
                          if (typeof o.setCoords === 'function') o.setCoords();
                        }
                      }
                    } catch (err) { /* ignore */ }
                  });
                  if (typeof obj.setCoords === 'function') obj.setCoords();
                  canvas.requestRenderAll();
                }
                return;
              }

              // Single object protection
              if (obj && (LockedFromDelete.has(obj) || Placed.has(obj))) {
                const last = LastPos.get(obj);
                if (last) {
                  obj.set({ left: last.left, top: last.top });
                  if (typeof obj.setCoords === 'function') obj.setCoords();
                  canvas.requestRenderAll();
                }
              }
            } catch (err) { /* ignore */ }
          };
          canvas.on('object:moving', lesson6State.moveProtectHandler);

          // When the user draws a new shape (ellipse), track it and show Fill/Stroke panel
          lesson6State.objectAddedHandler = (e) => {
            try {
              const obj = e.target;
              if (!obj) return;
              // Handle ellipses/circles (hole drawing)
              if (obj.type === 'ellipse' || obj.type === 'circle') {
                lesson6State.drawnCircle = obj;
                if (lesson6State.fillStrokePanel) {
                  lesson6State.fillStrokePanel.updateForObject(obj);
                  lesson6State.fillStrokePanel.show();
                }
                console.log('[Lesson6] User-drawn shape added:', obj.type, obj);
              }

              // Handle pen-tool shapes (polyline/polygon) so Fill/Stroke panel can edit them
              if ((obj.type === 'polyline' || obj.type === 'polygon') && obj.penToolPoints) {
                if (lesson6State.fillStrokePanel) {
                  lesson6State.fillStrokePanel.updateForObject(obj);
                  lesson6State.fillStrokePanel.show();
                }
                console.log('[Lesson6] Pen-tool shape added:', obj.type, obj);
              }
            } catch (err) { console.warn('[Lesson6] objectAddedHandler error:', err); }
          };
          canvas.on('object:added', lesson6State.objectAddedHandler);

          // Enable delete functionality via CopyPasteController
          copyPasteController.enable();
          
          // Disable Ctrl+A to prevent selecting all and making everything movable
          const ctrlAHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
              e.preventDefault();
              e.stopImmediatePropagation();
              console.log('[Lesson6] Ctrl+A disabled in lesson 6');
            }
          };
          lesson6State.keydownHandler = ctrlAHandler;
          // Use capture phase to intercept before canvas.js handlers
          window.addEventListener('keydown', ctrlAHandler, true);

          canvas.requestRenderAll();

          // Update instructions for deleting ink stains
          const panel = document.getElementById('panel');
          if (panel) {
            panel.innerHTML = `
              <h3>Opdracht: Verwijder de inktplekken</h3>
              <p>De machine heeft een badge uitgespuwd.</p> 
              <p>Verwijder alle inktplekken door ze aan te klikken en op <img src="assets/icons/del-delete-button-icon.svg" alt="Delete button" style="width:30px;height:30px;vertical-align:middle">&nbsp; of <img src="assets/icons/backspace-icon.svg" alt="Backspace" style="width:30px;height:30px;vertical-align:middle">&nbsp; te drukken.</p>
            `;
          }
        }
      });
    }


    // Copy-paste, shape tools and node editing are intentionally disabled for this lesson (only Fill/Stroke allowed)
    console.log('[Lesson6] Interactive features restricted: only Fill/Stroke panel is enabled');

    if (ENABLE_BADGE_OUTPUT) {
      // Use the lesson-wide animation controller
      const animationController = lesson6State.animationController;
      
      // Wire up event: when ink is deleted, show and animate the hole
        const inkRemovedHandler = (e) => {
          const removedObj = e.target;
          if (removedObj === ink) {
          // Show the hole with styling similar to lesson 1 helmet target
          // Apply dashed grey stroke style matching helmet/wrench outline targets
          hole.set({
            visible: true,
            selectable: false,
            evented: false,
            opacity: 0,  // Start transparent for animation
            stroke: '#999',  // Grey stroke
            strokeDashArray: [6, 6],  // Dashed line
            fill: null  // No fill, just stroke
          });
          
          // Apply stroke style to all child objects if it's a group
          if (hole._objects) {
            hole._objects.forEach(obj => {
              obj.set({
                stroke: '#999',
                strokeDashArray: [6, 6],
                fill: null
              });
            });
          }
          
          hole.setCoords();
          canvas.requestRenderAll();
          
          // Start pulsing animation like helmet target from lesson 1
          animationController.startPulseAnimation(hole, 'hole-pulse');
          lesson6State.animations.holePulse = 'hole-pulse';
          
          console.log('[Lesson6] Hole revealed with dashed grey styling and pulsing animation');
          
          // Enable the ellipse tool so user can draw the hole circle
          const ellipseTool = document.getElementById('tool-ellipse');
          if (ellipseTool) {
            ellipseTool.disabled = false;
            ellipseTool.setAttribute('aria-disabled', 'false');
          }

          // If the hole has already been completed, ensure clicking the ellipse tool
          // does not reset the aside panel back to the hole instructions. We add
          // a capture-phase listener that preserves current panel content when
          // `holeCompleted` is true.
          try {
            if (ellipseTool && !lesson6State._ellipsePreserveHandler) {
              lesson6State._ellipsePreserveHandler = (ev) => {
                try {
                  if (!lesson6State.holeCompleted) return;
                  const panelEl = document.getElementById('panel');
                  if (!panelEl) return;
                  const current = panelEl.innerHTML;
                  // After other click handlers run, restore the panel content
                  setTimeout(() => {
                    try { panelEl.innerHTML = current; } catch (e) {}
                  }, 0);
                } catch (e) { /* ignore */ }
              };
              ellipseTool.addEventListener('click', lesson6State._ellipsePreserveHandler, true);
            }
          } catch (err) {
            console.warn('[Lesson6] Could not attach ellipse preserve handler:', err);
          }
          
          // Set up fill/stroke panel for drawing the circle (black stroke, no fill)
          lesson6State.fillStrokePanel.setFillColor(null);  // No fill
          lesson6State.fillStrokePanel.setStrokeColor('#000000');  // Black stroke
          lesson6State.fillStrokePanel.show();
          
          // Configure the shape drawing controller for ellipse drawing but DO NOT
          // activate the tool — user must press the toolbar button to start drawing.
          shapeDrawingController.setFillStrokePanel(lesson6State.fillStrokePanel);
          
          // Set initial circle dimensions to 15x15 in the toolbar
          setTimeout(() => {
            const rxInput = document.getElementById('shape-rx');
            const ryInput = document.getElementById('shape-ry');
            if (rxInput) rxInput.value = '15';
            if (ryInput) ryInput.value = '15';
          }, 100);
          
          const panel = document.getElementById('panel');
          if (panel) {
            panel.innerHTML = `
              <h3>Stap 2: Teken een cirkel</h3>
              <p>Je hebt alle inktplekken verwijderd. Goed gedaan!</p>
              <p>Nu zie je de mooie badge die de machine heeft gemaakt.</p>
              <p>Spijtig genoeg kan de maakuil deze nog niet om zijn nek hangen, want er is geen gaatje voor een touwtje.</p>
              <p>Voeg jij dit toe met de <img src="assets/icons/draw-ellipse.svg" alt="Ellipse tool" style="width:30px;height:30px;vertical-align:middle">&nbsp; tool?</p>
              <p><strong>Let op:</strong> De cirkel moet <strong>15 × 15</strong> zijn. Gebruik de werkbalk bovenaan om de afmetingen exact aan te passen.</p>
              <p>Zorg dat het cirkeltje geen vulling heeft, alleen een zwarte omtrek (streek).</p>
            `;
          }
          
          // Setup handler for when user exits ellipse tool
          const handleEllipseToolExit = () => {
            // Re-enable the fill/stroke panel
            lesson6State.fillStrokePanel.show();
            
            // Check if a valid circle was drawn
            const validCircle = checkAndSnapCircle(hole);
            if (validCircle) {
              console.log('[Lesson6] Valid circle detected - snapping into place');
              // Remove the handler since we're done
              ellipseTool.removeEventListener('click', handleEllipseToolExit);
            }
          };
          
          lesson6State.shapeDrawingExitHandler = handleEllipseToolExit;
          ellipseTool.addEventListener('click', handleEllipseToolExit);
          
          // Setup handler for when circle is modified (via FillStrokePanel or dimension inputs)
          // Show the original lightning visual while the user is drawing the hole
          try {
            if (lesson6State.lightning) {
              lesson6State.lightning.set({ visible: true, selectable: false, evented: false });
              if (typeof lesson6State.lightning.setCoords === 'function') lesson6State.lightning.setCoords();
            }
            // Ensure the outlined lightning target is hidden during hole drawing
            if (lesson6State.lightningTarget1) {
              lesson6State.lightningTarget1.set({ visible: false, selectable: false, evented: false });
              if (typeof lesson6State.lightningTarget1.setCoords === 'function') lesson6State.lightningTarget1.setCoords();
            }
            canvas.requestRenderAll();
          } catch (err) {
            console.warn('[Lesson6] Could not toggle lightning visual for hole drawing:', err);
          }
          const handleCircleModified = (e) => {
            const modifiedObj = e.target;
            // Check if this is the drawn circle
            if (modifiedObj && modifiedObj.type === 'ellipse' && modifiedObj !== hole) {
              // Try to snap if it meets requirements
              checkAndSnapCircle(hole);
            }
          };
          
          canvas.on('object:modified', handleCircleModified);
          
          // Close inkRemovedHandler and attach it now that the handler body has been defined
        }
      };
      lesson6State.inkRemovedHandler = inkRemovedHandler;
      canvas.on('object:removed', inkRemovedHandler);
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
  // Always attempt to remove Fill & Stroke panel from DOM and clear controller refs
  try {
    if (lesson6State.fillStrokePanel) {
      try { lesson6State.fillStrokePanel.destroy(); } catch (e) { /* ignore */ }
      lesson6State.fillStrokePanel = null;
    }
    try {
      document.querySelectorAll('.fill-stroke-panel').forEach(el => {
        try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {}
      });
    } catch (e) { /* ignore */ }
    try { penToolController.setFillStrokePanel(null); } catch (e) { /* ignore */ }
    try { shapeDrawingController.setFillStrokePanel(null); } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }

  if (!lesson6State.isActive) return;

  console.log('[Lesson6] Cleaning up...');
  // If we patched canvas.remove earlier, restore it immediately so cleanup removals are not blocked
  try {
    if (lesson6State._origCanvasRemove) {
      try { canvas.remove = lesson6State._origCanvasRemove; } catch (e) { /* ignore */ }
      lesson6State._origCanvasRemove = null;
    }
  } catch (e) { /* ignore */ }

  // Remove lesson-specific placement/lock metadata so normal canvas clearing can remove objects
  try {
    const allObjs = canvas.getObjects().slice();
    allObjs.forEach(o => {
      try {
        if (Placed.has(o) || LockedFromDelete.has(o) || LastPos.has(o) || Pasted.has(o)) {
          try { Placed.delete(o); } catch (e) {}
          try { LockedFromDelete.delete(o); } catch (e) {}
          try { LastPos.delete(o); } catch (e) {}
          try { Pasted.delete(o); } catch (e) {}
        }
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }

  // Explicitly remove Lesson 6 badge/lightning/name objects that may remain on canvas
  try {
    if (lesson6State.lightningTarget1) { try { canvas.remove(lesson6State.lightningTarget1); } catch (e) {} lesson6State.lightningTarget1 = null; }
    if (lesson6State.lightningTarget2) { try { canvas.remove(lesson6State.lightningTarget2); } catch (e) {} lesson6State.lightningTarget2 = null; }
    if (lesson6State.lightningTarget3) { try { canvas.remove(lesson6State.lightningTarget3); } catch (e) {} lesson6State.lightningTarget3 = null; }
    if (lesson6State.lightning) { try { canvas.remove(lesson6State.lightning); } catch (e) {} lesson6State.lightning = null; }
    if (lesson6State.name) { try { canvas.remove(lesson6State.name); } catch (e) {} lesson6State.name = null; }
  } catch (e) { /* ignore */ }

  // Remove canvas objects
  if (lesson6State.objects.handle) canvas.remove(lesson6State.objects.handle);
  if (lesson6State.objects.top) canvas.remove(lesson6State.objects.top);

  // Disable copy-paste for this lesson; keep global undo/redo enabled
  copyPasteController.disable();

  // Disable shape tools
  const rectTool = document.getElementById('tool-rect');
  const ellipseTool = document.getElementById('tool-ellipse');
  const penTool = document.getElementById('tool-pen');
  const textTool = document.getElementById('tool-text');
  if (rectTool) {
    rectTool.disabled = true;
    rectTool.setAttribute('aria-disabled', 'true');
    rectTool.classList && rectTool.classList.remove('active');
  }
  if (ellipseTool) {
    ellipseTool.disabled = true;
    ellipseTool.setAttribute('aria-disabled', 'true');
    ellipseTool.classList && ellipseTool.classList.remove('active');
  }
  if (penTool) {
    penTool.disabled = true;
    penTool.setAttribute('aria-disabled', 'true');
    penTool.classList && penTool.classList.remove('active');
  }
  penToolController.disable();

  // Disable node editing tool
  const nodeTool = document.getElementById('tool-node');
  if (nodeTool) {
    nodeTool.disabled = true;
    nodeTool.setAttribute('aria-disabled', 'true');
  }

  // Remove only the lesson-specific canvas event listeners (do not remove global handlers)
  try {
    if (lesson6State.selectionCreatedHandler) { canvas.off('selection:created', lesson6State.selectionCreatedHandler); lesson6State.selectionCreatedHandler = null; }
    if (lesson6State.selectionUpdatedHandler) { canvas.off('selection:updated', lesson6State.selectionUpdatedHandler); lesson6State.selectionUpdatedHandler = null; }
    if (lesson6State.selectionClearedHandler) { canvas.off('selection:cleared', lesson6State.selectionClearedHandler); lesson6State.selectionClearedHandler = null; }
    if (lesson6State.objectAddedHandler) { canvas.off('object:added', lesson6State.objectAddedHandler); lesson6State.objectAddedHandler = null; }
    if (lesson6State.penModifiedHandler) { canvas.off('object:modified', lesson6State.penModifiedHandler); lesson6State.penModifiedHandler = null; }
    if (lesson6State.pasteModifiedHandler) { canvas.off('object:modified', lesson6State.pasteModifiedHandler); lesson6State.pasteModifiedHandler = null; }
    if (lesson6State.penAddedHandler) { canvas.off('object:added', lesson6State.penAddedHandler); lesson6State.penAddedHandler = null; }
    if (lesson6State.pasteAddedHandler) { canvas.off('object:added', lesson6State.pasteAddedHandler); lesson6State.pasteAddedHandler = null; }
    if (lesson6State.preserveRemovalHandler) { canvas.off('object:removed', lesson6State.preserveRemovalHandler); lesson6State.preserveRemovalHandler = null; }
    if (lesson6State.inkRemovedHandler) { canvas.off('object:removed', lesson6State.inkRemovedHandler); lesson6State.inkRemovedHandler = null; }
    if (lesson6State.moveProtectHandler) { canvas.off('object:moving', lesson6State.moveProtectHandler); lesson6State.moveProtectHandler = null; }
    if (lesson6State.moveListener) { canvas.off('object:moving', lesson6State.moveListener); lesson6State.moveListener = null; }
  } catch (e) {
    console.warn('[Lesson6] Error removing lesson-specific canvas handlers:', e);
  }
  if (lesson6State.keydownHandler) {
    window.removeEventListener('keydown', lesson6State.keydownHandler, true);
  }

  // Remove ellipse tool exit click handler if set
  try {
    const ellipseTool = document.getElementById('tool-ellipse');
    if (ellipseTool && lesson6State.shapeDrawingExitHandler) {
      ellipseTool.removeEventListener('click', lesson6State.shapeDrawingExitHandler);
    }
    if (ellipseTool && lesson6State._ellipsePreserveHandler) {
      try { ellipseTool.removeEventListener('click', lesson6State._ellipsePreserveHandler, true); } catch (e) { /* ignore */ }
      lesson6State._ellipsePreserveHandler = null;
    }
    // Remove any hash/unload handlers added by startLesson6
    try {
      if (lesson6State._hashChangeHandler) {
        window.removeEventListener('hashchange', lesson6State._hashChangeHandler, true);
        lesson6State._hashChangeHandler = null;
      }
    } catch (e) { /* ignore */ }
    try {
      if (lesson6State._beforeUnloadHandler) {
        window.removeEventListener('beforeunload', lesson6State._beforeUnloadHandler, true);
        lesson6State._beforeUnloadHandler = null;
      }
    } catch (e) { /* ignore */ }

    // Ensure text tool is disabled when leaving the lesson
    try {
      if (textTool) {
        textTool.disabled = true;
        textTool.setAttribute('aria-disabled', 'true');
        textTool.classList && textTool.classList.remove('active');
      }
    } catch (e) { /* ignore */ }
    // Remove preserveRemovalHandler if attached
    try {
      if (lesson6State.preserveRemovalHandler) {
        canvas.off('object:removed', lesson6State.preserveRemovalHandler);
        lesson6State.preserveRemovalHandler = null;
      }
    } catch (e) { /* ignore */ }
    // Remove pen added handler
    try {
      if (lesson6State.penAddedHandler) {
        canvas.off('object:added', lesson6State.penAddedHandler);
        lesson6State.penAddedHandler = null;
      }
    } catch (e) { /* ignore */ }
    // Restore original canvas.remove if we patched it
    try {
      if (lesson6State._origCanvasRemove) {
        try {
          // Remove any objects that were marked as placed/locked by this lesson
          try {
            const objs = canvas.getObjects().slice();
            const toRemove = objs.filter(o => o && (Placed.has(o) || LockedFromDelete.has(o)));
            if (toRemove.length > 0) {
              try {
                // Use the original remove to ensure removal isn't blocked
                lesson6State._origCanvasRemove(toRemove);
              } catch (e) {
                try { canvas.remove(toRemove); } catch (e2) { /* ignore */ }
              }
              // Clean registry entries for removed objects
              toRemove.forEach(o => {
                try { Placed.delete(o); LockedFromDelete.delete(o); LastPos.delete(o); Pasted.delete(o); } catch (e) { /* ignore */ }
              });
            }
          } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
        try { canvas.remove = lesson6State._origCanvasRemove; } catch (e) { /* ignore */ }
        lesson6State._origCanvasRemove = null;
      }
    } catch (e) { /* ignore */ }
  } catch (e) {
    console.warn('[Lesson6] Error removing ellipse tool handler:', e);
  }

  // Stop any running animations
  if (lesson6State.animationController) {
    lesson6State.animationController.stopAllAnimations();
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
