/**
 * Lesson 1: Select and Drag (REFACTORED)
 * Demonstrates the improvements from Phase 1 refactoring:
 * - Uses AnimationController for pulse animation
 * - Uses AssetLoader for SVG loading
 * - Uses constants instead of magic numbers
 * - Clear separation of concerns
 * - Improved naming and readability
 */

import { canvas, resetViewport } from './canvas.js';
import { AnimationController } from './AnimationController.js';
import { assetLoader } from './AssetLoader.js';
import { 
  ASSETS, 
  SVG_IDS, 
  INTERACTION_THRESHOLD,
  STYLE 
} from './constants.js';

// Tutorial state container (will be further improved in Phase 2.3)
class Lesson1State {
  constructor() {
    this.isActive = false;
    this.isInitializing = false;
    this.objects = {
      owl: null,
      helmet: null,
      helmetTarget: null,
      owlWithHelmet: null
    };
    this.animations = {
      helmetTargetPulse: null
    };
  }

  reset() {
    this.isActive = false;
    this.objects = {
      owl: null,
      helmet: null,
      helmetTarget: null,
      owlWithHelmet: null
    };
    this.animations = {
      helmetTargetPulse: null
    };
  }
}

const lesson1State = new Lesson1State();
let animationController = null;

/**
 * Update page title and toolbar for Lesson 1
 */
function updatePageMetadata() {
  try {
    document.title = 'Inkscape Les 1: Selecteren en slepen';
    
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 1: Selecteren en slepen'));
    }
  } catch (error) {
    console.warn('[Lesson1] Failed to update page metadata:', error);
  }
}

/**
 * Update instruction panel with lesson objectives
 */
function updateInstructionPanel() {
  try {
    const panel = document.getElementById('panel');
    if (!panel) return;

    panel.innerHTML = `
      <h3>Opdracht</h3>
      <p>Help het uiltje zich klaar te maken voor de maakplaats!</p>
      <p>Zet de helm op zijn hoofd.</p>
      <ul>
        <li><img src="assets/icons/left-click.svg" alt="Left click" style="width:20px;height:20px;vertical-align:middle">&nbsp; Linker muisknop: Selecteer de helm</li>
        <li><i class="fa-solid fa-arrows-up-down-left-right"></i>&nbsp; Klik en sleep om te verplaatsen</li>
        <li><i class="fa-solid fa-hand-pointer"></i>&nbsp; Laat los om te plaatsen</li>
      </ul>
    `;
  } catch (error) {
    console.warn('[Lesson1] Failed to update instruction panel:', error);
  }
}

/**
 * Load all required SVG assets for Lesson 1
 * @returns {Promise<Object>} Loaded Fabric groups
 */
async function loadLessonAssets() {
  const identifiers = [
    ...SVG_IDS.LESSON_1.OWL,
    ...SVG_IDS.LESSON_1.HELMET,
    ...SVG_IDS.LESSON_1.HELMET_TARGET,
    ...SVG_IDS.LESSON_1.OWL_WITH_HELMET
  ];

  const groups = await assetLoader.loadFabricGroups(ASSETS.LESSON_1_SVG, identifiers);

  return {
    owl: groups[SVG_IDS.LESSON_1.OWL[0]],
    helmet: groups[SVG_IDS.LESSON_1.HELMET[0]],
    helmetTarget: groups[SVG_IDS.LESSON_1.HELMET_TARGET[0]],
    owlWithHelmet: groups[SVG_IDS.LESSON_1.OWL_WITH_HELMET[0]]
  };
}

/**
 * Setup owl object (non-interactive background element)
 * @param {fabric.Group} owlGroup - Loaded owl group
 */
function setupOwl(owlGroup) {
  owlGroup.set({
    selectable: false,
    evented: false,
    visible: true
  });
  
  canvas.add(owlGroup);
  lesson1State.objects.owl = owlGroup;
  
  console.log('[Lesson1] Owl added to canvas');
}

/**
 * Setup helmet target indicator with pulsing animation
 * @param {fabric.Group} targetGroup - Loaded helmet target group
 */
function setupHelmetTarget(targetGroup) {
  targetGroup.set({
    selectable: false,
    evented: false,
    visible: true,
    opacity: 0
  });
  
  canvas.add(targetGroup);
  lesson1State.objects.helmetTarget = targetGroup;
  
  // Start pulsing animation
  const animationId = animationController.startPulseAnimation(targetGroup, 'helmet-target-pulse');
  lesson1State.animations.helmetTargetPulse = animationId;
  
  console.log('[Lesson1] Helmet target added with pulse animation');
}

/**
 * Setup draggable helmet object
 * @param {fabric.Group} helmetGroup - Loaded helmet group
 */
function setupHelmet(helmetGroup) {
  helmetGroup.set({
    selectable: true,
    evented: true,
    visible: true
  });
  
  canvas.add(helmetGroup);
  lesson1State.objects.helmet = helmetGroup;
  
  console.log('[Lesson1] Helmet added to canvas (draggable)');
}

/**
 * Setup owl with helmet (success state, initially hidden)
 * @param {fabric.Group} owlWithHelmetGroup - Loaded owl with helmet group
 */
function setupOwlWithHelmet(owlWithHelmetGroup) {
  owlWithHelmetGroup.set({
    selectable: false,
    evented: false,
    visible: false
  });
  
  // Mark for tutorial identification
  try {
    owlWithHelmetGroup.tutorialId = 'Owl_with_Helmet';
  } catch (error) {
    console.warn('[Lesson1] Could not set tutorialId:', error);
  }
  
  canvas.add(owlWithHelmetGroup);
  lesson1State.objects.owlWithHelmet = owlWithHelmetGroup;
  
  console.log('[Lesson1] Owl with helmet added (hidden)');
}

/**
 * Check if helmet is close enough to target
 * @returns {boolean} True if helmet overlaps target
 */
function isHelmetAtTarget() {
  const { helmet, helmetTarget } = lesson1State.objects;
  if (!helmet || !helmetTarget) return false;

  const helmetBounds = helmet.getBoundingRect(true);
  const targetBounds = helmetTarget.getBoundingRect(true);

  const distance = Math.sqrt(
    Math.pow(helmetBounds.left - targetBounds.left, 2) +
    Math.pow(helmetBounds.top - targetBounds.top, 2)
  );

  return distance < INTERACTION_THRESHOLD.HELMET_SNAP_DISTANCE;
}

/**
 * Handle successful helmet placement
 */
function handleSuccess() {
  const { owl, helmet, helmetTarget, owlWithHelmet } = lesson1State.objects;

  // Remove owl and helmet
  if (owl) canvas.remove(owl);
  if (helmet) canvas.remove(helmet);

  // Stop and remove helmet target animation
  if (helmetTarget) {
    animationController.stopAnimation('helmet-target-pulse');
    canvas.remove(helmetTarget);
  }

  // Show success state
  if (owlWithHelmet) {
    owlWithHelmet.visible = true;
    owlWithHelmet.setCoords();
  }

  canvas.requestRenderAll();
  
  // Show next tutorial button
  showNextButton();
  
  console.log('[Lesson1] Success! Helmet placed on owl.');
}

/**
 * Display button to proceed to next lesson
 */
function showNextButton() {
  const panel = document.getElementById('panel');
  if (!panel) return;

  let button = document.getElementById('next-tutorial-btn');
  if (button) return; // Already exists

  button = document.createElement('button');
  button.id = 'next-tutorial-btn';
  button.style.cssText = `
    display: block;
    width: 100%;
    height: 64px;
    margin: 32px auto 0 auto;
    background: ${STYLE.PRIMARY_COLOR};
    border: none;
    border-radius: ${STYLE.BUTTON_BORDER_RADIUS};
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;
  button.innerHTML = '<i class="fa-solid fa-arrow-right" style="font-size:2.5em;color:white;"></i>';
  
  button.onclick = () => {
    // Import dynamically to avoid circular dependencies
    import('./tutorial.js').then(module => {
      module.startSecondTutorial();
    });
  };

  panel.appendChild(button);
}

/**
 * Attach event handler for helmet movement
 */
function attachEventHandlers() {
  const moveHandler = (event) => {
    const movedObject = event.target;
    
    if (movedObject !== lesson1State.objects.helmet) return;
    if (!lesson1State.objects.helmetTarget) return;

    if (isHelmetAtTarget()) {
      // Remove handler to prevent multiple triggers
      canvas.off('object:moving', moveHandler);
      handleSuccess();
    }
  };

  canvas.on('object:moving', moveHandler);
}

/**
 * Cleanup function to remove all lesson objects and animations
 */
function cleanup() {
  // Stop all animations
  if (animationController) {
    animationController.stopAllAnimations();
  }

  // Remove all objects
  Object.values(lesson1State.objects).forEach(obj => {
    if (obj && canvas.contains(obj)) {
      canvas.remove(obj);
    }
  });

  // Remove event handlers
  canvas.off('object:moving');

  // Reset state
  lesson1State.reset();
  
  canvas.requestRenderAll();
  
  console.log('[Lesson1] Cleanup complete');
}

/**
 * Main entry point: Start Lesson 1
 * @returns {Promise<void>}
 */
export async function startLesson1() {
  if (lesson1State.isActive) {
    console.log('[Lesson1] Already active');
    return;
  }

  lesson1State.isActive = true;

  try {
    // Update URL hash
    history.replaceState(null, '', '#lesson=1');
    // Trigger hashchange event to update lesson buttons
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (error) {
    console.warn('[Lesson1] Could not update URL:', error);
  }

  // Update UI
  updatePageMetadata();
  updateInstructionPanel();

  // Reset viewport to default position and zoom
  resetViewport();

  // Initialize animation controller with current canvas
  if (!animationController) {
    animationController = new AnimationController(canvas);
  }

  console.info('[Lesson1] Loading assets...');

  // Load all assets
  const assets = await loadLessonAssets();

  // Validate assets
  if (!assets.owl) console.warn('[Lesson1] Owl not found');
  if (!assets.helmet) console.warn('[Lesson1] Helmet not found');
  if (!assets.helmetTarget) console.warn('[Lesson1] Helmet target not found');
  if (!assets.owlWithHelmet) console.warn('[Lesson1] Owl with helmet not found');

  // Setup scene objects
  if (assets.owl) setupOwl(assets.owl);
  if (assets.helmetTarget) setupHelmetTarget(assets.helmetTarget);
  if (assets.helmet) setupHelmet(assets.helmet);
  if (assets.owlWithHelmet) setupOwlWithHelmet(assets.owlWithHelmet);

  // Attach interaction handlers
  attachEventHandlers();

  canvas.requestRenderAll();
  
  console.info('[Lesson1] Started successfully');
}

/**
 * Restart Lesson 1 (with cleanup)
 * @returns {Promise<void>}
 */
export async function restartLesson1() {
  if (lesson1State.isInitializing) return;
  
  lesson1State.isInitializing = true;

  try {
    // Cleanup existing state
    cleanup();
    
    // Clear canvas
    canvas.getObjects().slice().forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  } catch (error) {
    console.error('[Lesson1] Cleanup failed:', error);
  }

  // Restart
  lesson1State.isActive = false;
  await startLesson1();
  
  lesson1State.isInitializing = false;
}

// Export cleanup for external use
export { cleanup as cleanupLesson1 };
