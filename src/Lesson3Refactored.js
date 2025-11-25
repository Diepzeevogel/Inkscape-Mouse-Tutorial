/**
 * Lesson 3: Pan and Zoom (REFACTORED)
 * Demonstrates:
 * - Uses AnimationController for all animations
 * - Uses AssetLoader for SVG loading
 * - Uses constants instead of magic numbers
 * - Proper object-oriented structure
 */

import { canvas, resetViewport } from './canvas.js';
import { AnimationController } from './AnimationController.js';
import { assetLoader } from './AssetLoader.js';
import { 
  ASSETS, 
  SVG_IDS, 
  ZOOM,
  INTERACTION_THRESHOLD,
  STYLE,
  LAYOUT,
  ANIMATION_DURATION
} from './constants.js';

class Lesson3State {
  constructor() {
    this.isActive = false;
    this.objects = {
      machine: null,
      owl: null,
      toolbox: null,
      startButton: null,
      directionArrow: null
    };
    this.animations = {
      arrow: null,
      gears: null,
      owlWiggle: null
    };
    this.bulbOffObjects = [];
    this.gearObjects = [];
    this.buttonEnabled = false;
  }

  reset() {
    this.isActive = false;
    this.objects = { machine: null, owl: null, toolbox: null, startButton: null, directionArrow: null };
    this.animations = { arrow: null, gears: null, owlWiggle: null };
    this.bulbOffObjects = [];
    this.gearObjects = [];
    this.buttonEnabled = false;
  }
}

const lesson3State = new Lesson3State();
let animationController = null;

/**
 * Update page metadata
 */
function updatePageMetadata() {
  try {
    document.title = 'Inkscape Les 3: Pannen en zoomen';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 3: Pannen en zoomen'));
    }
  } catch (error) {
    console.warn('[Lesson3] Failed to update metadata:', error);
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
      <p>Laten we de creativiteits-machine starten!</p>
      <ol>
        <li>Volg de <span style="color:#1976d2">blauwe pijl</span> om de machine te vinden.</li>
        <li><i class="fa-solid fa-hand"></i>&nbsp; Klik en sleep met de midden-muis knop om te <strong>pannen</strong> (verschuiven).</li>
        <li><strong>Ctrl + Scroll</strong> om in en uit te <strong>zoomen</strong>.</li>
        <li>Zoom ver genoeg in op de machine om de <strong>startknop</strong> te vinden.</li>
        <li>Klik op de startknop om de machine aan te zetten!</li>
      </ol>
    `;
  } catch (error) {
    console.warn('[Lesson3] Failed to update panel:', error);
  }
}

/**
 * Load helper objects from previous lessons
 */
async function loadHelperObjects() {
  const objects = {};
  
  // Load owl from lesson 1
  try {
    const owl1Groups = await assetLoader.loadFabricGroups(ASSETS.LESSON_1_SVG, ['Owl_with_Helmet']);
    objects.owl = owl1Groups['Owl_with_Helmet'];
  } catch (error) {
    console.warn('[Lesson3] Failed to load owl:', error);
  }
  
  // Load toolbox from lesson 2
  try {
    const lesson2Groups = await assetLoader.loadFabricGroups(ASSETS.LESSON_2_SVG, ['Toolbox']);
    objects.toolbox = lesson2Groups['Toolbox'];
  } catch (error) {
    console.warn('[Lesson3] Failed to load toolbox:', error);
  }
  
  return objects;
}

/**
 * Setup helper objects (owl and toolbox from previous lessons)
 */
function setupHelperObjects(helpers) {
  if (helpers.owl) {
    helpers.owl.set({ selectable: false, evented: false, visible: true });
    try { helpers.owl.tutorialId = 'Owl_with_Helmet'; } catch (e) {}
    canvas.add(helpers.owl);
    lesson3State.objects.owl = helpers.owl;
    console.log('[Lesson3] Owl added');
  }
  
  if (helpers.toolbox) {
    helpers.toolbox.set({ selectable: false, evented: false, visible: true });
    try { helpers.toolbox.tutorialId = 'Toolbox'; } catch (e) {}
    
    const baseX = canvas.getWidth() * LAYOUT.TOOLBOX_X_RATIO;
    const topY = canvas.getHeight() / 2 + LAYOUT.TOOLBOX_Y_OFFSET;
    helpers.toolbox.left = baseX;
    helpers.toolbox.top = topY;
    
    canvas.add(helpers.toolbox);
    helpers.toolbox.setCoords();
    lesson3State.objects.toolbox = helpers.toolbox;
    console.log('[Lesson3] Toolbox added');
  }
}

/**
 * Load machine asset
 */
async function loadMachineAsset() {
  const groups = await assetLoader.loadFabricGroups(ASSETS.LESSON_3_SVG, ['Layer_2']);
  return groups['Layer_2'];
}

/**
 * Disable caching recursively
 */
function disableObjectCaching(group) {
  if (!group) return;
  group.objectCaching = false;
  if (group.getObjects) {
    group.getObjects().forEach(obj => {
      obj.objectCaching = false;
      if (obj.getObjects) disableObjectCaching(obj);
    });
  }
}

/**
 * Position machine off-canvas
 */
function positionMachine(machine) {
  const centerX = canvas.getWidth() / 2;
  const centerY = canvas.getHeight() / 2;
  
  machine.set({ 
    selectable: false, 
    evented: true, 
    visible: true,
    hoverCursor: 'default',
    subTargetCheck: true
  });
  
  canvas.add(machine);
  machine.setCoords();
  
  const bounds = machine.getBoundingRect(true);
  const targetCenterX = centerX + INTERACTION_THRESHOLD.MACHINE_OFFSET;
  const desiredLeft = targetCenterX - bounds.width / 2;
  const desiredTop = centerY - bounds.height / 2;
  
  const deltaX = desiredLeft - bounds.left;
  const deltaY = desiredTop - bounds.top;
  
  machine.left = machine.left + deltaX;
  machine.top = machine.top + deltaY;
  machine.setCoords();
  
  try { machine.tutorialId = 'MakerMachine'; } catch (e) {}
  lesson3State.objects.machine = machine;
}

/**
 * Find and collect objects by ID pattern
 */
function findObjectsById(group, pattern, collection = []) {
  if (!group || !group.getObjects) return collection;
  
  group.getObjects().forEach(obj => {
    const objId = obj.id || obj.svgId || obj.data?.id;
    const objIdLower = objId ? String(objId).toLowerCase() : '';
    
    if (objIdLower && objIdLower.match(pattern)) {
      collection.push(obj);
    }
    
    if (obj.type === 'group' && obj.getObjects) {
      findObjectsById(obj, pattern, collection);
    }
  });
  
  return collection;
}

/**
 * Setup machine bulbs
 */
function setupMachineBulbs(machine) {
  // Hide all Bulb_On objects
  const bulbOnObjects = findObjectsById(machine, /^bulb_on$|^bulb_x5f_on$/);
  bulbOnObjects.forEach(obj => {
    obj.visible = false;
    obj.dirty = true;
  });
  
  // Collect Bulb_Off objects
  lesson3State.bulbOffObjects = findObjectsById(machine, /^bulb_off$|^bulb_x5f_off$/);
  
  console.log('[Lesson3] Hidden', bulbOnObjects.length, 'bulb_on objects');
  console.log('[Lesson3] Found', lesson3State.bulbOffObjects.length, 'bulb_off objects');
}

/**
 * Disable events on main machine parts
 */
function disableMainObjects(machine) {
  const mainObjects = findObjectsById(machine, /^main$/);
  mainObjects.forEach(obj => obj.set({ evented: false }));
  console.log('[Lesson3] Disabled', mainObjects.length, 'main objects');
}

/**
 * Setup gears for rotation
 */
function setupGears(machine) {
  const gears = findObjectsById(machine, /^gear\d*$/);
  
  gears.forEach(gear => {
    const rect = gear.getBoundingRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    gear.set({ 
      originX: 'center', 
      originY: 'center',
      left: centerX,
      top: centerY
    });
    gear.setCoords();
  });
  
  lesson3State.gearObjects = gears;
  console.log('[Lesson3] Found', gears.length, 'gears');
}

/**
 * Find start button
 */
function findStartButton(machine) {
  const buttons = findObjectsById(machine, /^start$|^start_x5f_button$|^startbutton$/);
  return buttons[0] || null;
}

/**
 * Toggle bulbs (turn machine on)
 */
function toggleBulbs() {
  // Hide Bulb_Off
  lesson3State.bulbOffObjects.forEach(obj => {
    obj.visible = false;
    obj.dirty = true;
  });
  
  // Show Bulb_On
  const machine = lesson3State.objects.machine;
  const bulbOnObjects = findObjectsById(machine, /^bulb_on$|^bulb_x5f_on$/);
  bulbOnObjects.forEach(obj => {
    obj.visible = true;
    obj.dirty = true;
  });
  
  canvas.requestRenderAll();
}

/**
 * Animate zoom out to show complete scene
 */
function animateZoomOutToScene() {
  const machine = lesson3State.objects.machine;
  if (!machine) return;
  
  const machineBounds = machine.getBoundingRect(true);
  const machineCenterX = machineBounds.left + machineBounds.width / 2;
  const machineCenterY = machineBounds.top + machineBounds.height / 2;
  
  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  const padding = LAYOUT.MACHINE_ZOOM_PADDING;
  
  const zoomX = (canvasWidth - padding * 2) / machineBounds.width;
  const zoomY = (canvasHeight - padding * 2) / machineBounds.height;
  const targetZoom = Math.min(zoomX, zoomY, 1);
  
  // Target positions for owl and toolbox
  const owlTargetX = machineCenterX;
  const owlTargetY = machineCenterY + machineBounds.height / 4 + 100;
  const toolboxTargetX = machineCenterX + machineBounds.width / 3;
  const toolboxTargetY = machineCenterY + machineBounds.height / 4;
  
  const owl = lesson3State.objects.owl;
  const toolbox = lesson3State.objects.toolbox;
  
  const owlStartX = owl ? owl.left : owlTargetX;
  const owlStartY = owl ? owl.top : owlTargetY;
  const toolboxStartX = toolbox ? toolbox.left : toolboxTargetX;
  const toolboxStartY = toolbox ? toolbox.top : toolboxTargetY;
  
  animationController.animateViewport({
    targetZoom,
    targetX: machineCenterX,
    targetY: machineCenterY,
    duration: ANIMATION_DURATION.ZOOM_OUT,
    onProgress: (progress, eased) => {
      if (owl) {
        owl.left = owlStartX + (owlTargetX - owlStartX) * eased;
        owl.top = owlStartY + (owlTargetY - owlStartY) * eased;
        owl.setCoords();
      }
      if (toolbox) {
        toolbox.left = toolboxStartX + (toolboxTargetX - toolboxStartX) * eased;
        toolbox.top = toolboxStartY + (toolboxTargetY - toolboxStartY) * eased;
        toolbox.setCoords();
      }
    },
    onComplete: () => {
      showCompletionMessage();
    }
  });
}

/**
 * Show completion message
 */
function showCompletionMessage() {
  try {
    const panel = document.getElementById('panel');
    if (!panel) return;
    
    panel.innerHTML = `
      <h3>🎉 Gefeliciteerd!</h3>
      <p>Je hebt alle lessen voltooid!</p>
      <p>Je kunt nu:</p>
      <ul>
        <li><strong>Selecteren</strong> door op objecten te klikken</li>
        <li><strong>Slepen</strong> om objecten te verplaatsen</li>
        <li><strong>Meerdere objecten selecteren</strong> met Shift of een selectievak</li>
        <li><strong>Pannen</strong> door te klikken en slepen op het canvas</li>
        <li><strong>Zoomen</strong> met Ctrl + Scroll</li>
      </ul>
      <p>Je bent nu klaar om de <strong>basisfuncties van Inkscape</strong> te leren!</p>
    `;
  } catch (error) {
    console.warn('[Lesson3] Failed to show completion:', error);
  }
}

/**
 * Handle button click
 */
function handleButtonClick() {
  if (!lesson3State.buttonEnabled) return;
  
  const button = lesson3State.objects.startButton;
  if (!button) return;
  
  // Animate button press
  animationController.animateButtonPress(button);
  
  // Toggle bulbs
  toggleBulbs();
  
  // Start gear rotation
  if (lesson3State.gearObjects.length > 0) {
    lesson3State.animations.gears = animationController.startRotationAnimation(
      lesson3State.gearObjects, 
      'gear-rotation'
    );
  }
  
  // Start owl wiggle
  if (lesson3State.objects.owl) {
    lesson3State.animations.owlWiggle = animationController.startWiggleAnimation(
      lesson3State.objects.owl,
      'owl-wiggle'
    );
  }
  
  // Bring owl and toolbox to front
  if (lesson3State.objects.owl) canvas.bringToFront(lesson3State.objects.owl);
  if (lesson3State.objects.toolbox) canvas.bringToFront(lesson3State.objects.toolbox);
  
  // Zoom out to show scene
  animateZoomOutToScene();
  
  console.log('[Lesson3] Machine activated!');
}

/**
 * Check zoom level and enable/disable button
 */
function checkZoomLevel() {
  const currentZoom = canvas.getZoom();
  const required = ZOOM.REQUIRED_FOR_BUTTON;
  const button = lesson3State.objects.startButton;
  
  if (!button) return;
  
  if (currentZoom >= required && !lesson3State.buttonEnabled) {
    button.set({ hoverCursor: 'pointer' });
    lesson3State.buttonEnabled = true;
    canvas.requestRenderAll();
  } else if (currentZoom < required && lesson3State.buttonEnabled) {
    button.set({ hoverCursor: 'default' });
    lesson3State.buttonEnabled = false;
    canvas.requestRenderAll();
  }
}

/**
 * Setup start button
 */
function setupStartButton(button) {
  if (!button) {
    console.warn('[Lesson3] Start button not found');
    return;
  }
  
  button.set({ 
    selectable: false, 
    evented: true,
    hoverCursor: 'default',
    perPixelTargetFind: true,
    targetFindTolerance: 5
  });
  
  button.on('mousedown', handleButtonClick);
  
  lesson3State.objects.startButton = button;
  
  // Monitor zoom level
  canvas.on('mouse:wheel', checkZoomLevel);
  canvas.on('after:render', checkZoomLevel);
  checkZoomLevel();
  
  console.log('[Lesson3] Start button configured');
}

/**
 * Create direction arrow
 */
function createDirectionArrow() {
  const arrow = new fabric.Triangle({ 
    width: STYLE.ARROW_SIZE, 
    height: STYLE.ARROW_SIZE, 
    fill: STYLE.ARROW_COLOR,
    left: 0, 
    top: 0, 
    angle: 0,
    selectable: false, 
    evented: false,
    originX: 'center',
    originY: 'center',
    visible: true
  });
  
  try { arrow.tutorialId = 'MakerMachineArrow'; } catch (e) {}
  canvas.add(arrow);
  arrow.setCoords();
  
  lesson3State.objects.directionArrow = arrow;
  return arrow;
}

/**
 * Start arrow animation
 */
function startArrowAnimation() {
  const arrow = lesson3State.objects.directionArrow;
  const machine = lesson3State.objects.machine;
  
  if (!arrow || !machine) return;
  
  let isAnimating = true;
  const startTime = performance.now();
  const edgeMargin = INTERACTION_THRESHOLD.ARROW_EDGE_MARGIN;
  
  const animate = (now) => {
    if (!isAnimating) return;
    
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const viewportCenterX = -vpt[4] / zoom + (canvas.getWidth() / zoom) / 2;
    const viewportCenterY = -vpt[5] / zoom + (canvas.getHeight() / zoom) / 2;
    
    const machineRect = machine.getBoundingRect(true);
    const machineCenterX = machineRect.left + machineRect.width / 2;
    const machineCenterY = machineRect.top + machineRect.height / 2;
    
    const vectorX = machineCenterX - viewportCenterX;
    const vectorY = machineCenterY - viewportCenterY;
    const vectorLength = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
    
    if (vectorLength === 0) {
      arrow.visible = false;
      arrow.dirty = true;
      canvas.requestRenderAll();
      fabric.util.requestAnimFrame(animate);
      return;
    }
    
    const dirX = vectorX / vectorLength;
    const dirY = vectorY / vectorLength;
    const angleRad = Math.atan2(dirY, dirX);
    const angleDeg = angleRad * 180 / Math.PI;
    
    const viewportWidth = canvas.getWidth() / zoom;
    const viewportHeight = canvas.getHeight() / zoom;
    const viewportLeft = viewportCenterX - viewportWidth / 2;
    const viewportTop = viewportCenterY - viewportHeight / 2;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    
    const margin = edgeMargin / zoom;
    const intersections = [];
    
    if (dirX > 0) {
      const t = (viewportRight - margin - viewportCenterX) / dirX;
      const y = viewportCenterY + t * dirY;
      if (y >= viewportTop + margin && y <= viewportBottom - margin) {
        intersections.push({ x: viewportRight - margin, y, t });
      }
    }
    
    if (dirX < 0) {
      const t = (viewportLeft + margin - viewportCenterX) / dirX;
      const y = viewportCenterY + t * dirY;
      if (y >= viewportTop + margin && y <= viewportBottom - margin) {
        intersections.push({ x: viewportLeft + margin, y, t });
      }
    }
    
    if (dirY > 0) {
      const t = (viewportBottom - margin - viewportCenterY) / dirY;
      const x = viewportCenterX + t * dirX;
      if (x >= viewportLeft + margin && x <= viewportRight - margin) {
        intersections.push({ x, y: viewportBottom - margin, t });
      }
    }
    
    if (dirY < 0) {
      const t = (viewportTop + margin - viewportCenterY) / dirY;
      const x = viewportCenterX + t * dirX;
      if (x >= viewportLeft + margin && x <= viewportRight - margin) {
        intersections.push({ x, y: viewportTop + margin, t });
      }
    }
    
    let intersectX, intersectY;
    if (intersections.length > 0) {
      intersections.sort((a, b) => a.t - b.t);
      intersectX = intersections[0].x;
      intersectY = intersections[0].y;
    } else {
      intersectX = viewportCenterX;
      intersectY = viewportCenterY;
    }
    
    // Add wiggle
    const wiggleT = ((now - startTime) / ANIMATION_DURATION.ARROW_WIGGLE_PERIOD) * Math.PI * 2;
    const wiggleAmount = Math.sin(wiggleT) * 10 / zoom;
    intersectX += dirX * wiggleAmount;
    intersectY += dirY * wiggleAmount;
    
    // Check visibility
    const machineVisible = (
      machineRect.left < viewportRight &&
      machineRect.left + machineRect.width > viewportLeft &&
      machineRect.top < viewportBottom &&
      machineRect.top + machineRect.height > viewportTop
    );
    
    if (machineVisible) {
      arrow.visible = false;
    } else {
      arrow.visible = true;
      arrow.set({
        left: intersectX,
        top: intersectY,
        angle: angleDeg + 90
      });
      arrow.setCoords();
    }
    
    canvas.requestRenderAll();
    fabric.util.requestAnimFrame(animate);
  };
  
  fabric.util.requestAnimFrame(animate);
  
  lesson3State.animations.arrow = { stop: () => { isAnimating = false; } };
}

/**
 * Cleanup
 */
function cleanup() {
  if (animationController) {
    animationController.stopAllAnimations();
  }
  
  if (lesson3State.animations.arrow) {
    lesson3State.animations.arrow.stop();
  }
  if (lesson3State.animations.gears) {
    lesson3State.animations.gears.stop();
  }
  if (lesson3State.animations.owlWiggle) {
    lesson3State.animations.owlWiggle.stop();
  }
  
  canvas.off('mouse:wheel', checkZoomLevel);
  canvas.off('after:render', checkZoomLevel);
  
  Object.values(lesson3State.objects).forEach(obj => {
    if (obj && canvas.contains(obj)) {
      canvas.remove(obj);
    }
  });
  
  lesson3State.reset();
  canvas.requestRenderAll();
  
  console.log('[Lesson3] Cleanup complete');
}

/**
 * Start Lesson 3
 */
export async function startLesson3() {
  if (lesson3State.isActive) {
    console.log('[Lesson3] Already active');
    return;
  }
  
  lesson3State.isActive = true;
  
  try {
    history.replaceState(null, '', '#lesson=3');
    // Trigger hashchange event to update lesson buttons
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (e) {
    console.warn('[Lesson3] Could not update URL:', e);
  }
  
  updatePageMetadata();
  updateInstructionPanel();
  
  // Reset viewport to default position and zoom
  resetViewport();
  
  // Initialize animation controller with current canvas
  if (!animationController) {
    animationController = new AnimationController(canvas);
  }
  
  console.info('[Lesson3] Loading assets...');
  
  // Load helper objects
  const helpers = await loadHelperObjects();
  setupHelperObjects(helpers);
  
  // Load machine
  const machine = await loadMachineAsset();
  if (!machine) {
    console.error('[Lesson3] Failed to load machine');
    return;
  }
  
  disableObjectCaching(machine);
  positionMachine(machine);
  setupMachineBulbs(machine);
  disableMainObjects(machine);
  setupGears(machine);
  
  const button = findStartButton(machine);
  setupStartButton(button);
  
  const arrow = createDirectionArrow();
  startArrowAnimation();
  
  canvas.requestRenderAll();
  
  console.info('[Lesson3] Started successfully');
}

/**
 * Restart Lesson 3
 */
export async function restartLesson3() {
  cleanup();
  canvas.getObjects().slice().forEach(obj => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  
  lesson3State.isActive = false;
  await startLesson3();
}

export { cleanup as cleanupLesson3 };
