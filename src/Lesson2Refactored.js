/**
 * Lesson 2: Multi-Selection (REFACTORED)
 * Demonstrates:
 * - Uses AnimationController for bounce animation
 * - Uses AssetLoader for SVG loading
 * - Uses constants instead of magic numbers
 * - Clear separation of concerns
 */

import { canvas, resetViewport } from './canvas.js';
import { AnimationController } from './AnimationController.js';
import { assetLoader } from './AssetLoader.js';
import { 
  ASSETS, 
  SVG_IDS, 
  LAYOUT,
  STYLE 
} from './constants.js';

class Lesson2State {
  constructor() {
    this.isActive = false;
    this.objects = {
      owlWithHelmet: null,
      toolbox: null,
      tools: [] // wrench, screwdriver, saw, pencil, hammer
    };
    this.completed = false;
    this.isDragging = false;
  }

  reset() {
    this.isActive = false;
    this.objects = { owlWithHelmet: null, toolbox: null, tools: [] };
    this.completed = false;
    this.isDragging = false;
  }
}

const lesson2State = new Lesson2State();
let animationController = null;

/**
 * Update page metadata for Lesson 2
 */
function updatePageMetadata() {
  try {
    document.title = 'Inkscape Les 2: Meerdere objecten selecteren';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 2: Meerdere objecten selecteren'));
    }
  } catch (error) {
    console.warn('[Lesson2] Failed to update metadata:', error);
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
      <p>Oh nee! Al het gereedschap is uit de koffer gevallen.</p>
      <p>Steek jij ze er terug in?</p>
      <ol>
        <li><img src="assets/icons/shift-button.svg" alt="Shift button" style="width:30px;height:30px;vertical-align:middle">&nbsp; + <img src="assets/icons/left-click.svg" alt="Left click" style="width:30px;height:30px;vertical-align:middle">&nbsp; Houd <strong>Shift</strong> ingedrukt en klik op alle gereedschappen om ze te selecteren.</li>
        <li>Als je <strong>al</strong> het gereedschap geselecteerd heb, sleep je het naar de gereedschapskist.</li>
      </ol>
      <p>Probeer het ook met een selectievak. Klik en sleep een rechthoek om meerdere gereedschappen tegelijk te selecteren.</p>
    `;
  } catch (error) {
    console.warn('[Lesson2] Failed to update panel:', error);
  }
}

/**
 * Load all SVG assets for Lesson 2
 */
async function loadLessonAssets() {
  // Load owl with helmet from Lesson 1 (end state)
  const lesson1Assets = await assetLoader.loadFabricGroups(ASSETS.LESSON_1_SVG, ['Owl_with_Helmet']);
  
  // Load Lesson 2 tools and toolbox
  const identifiers = ['Toolbox', 'Wrench', 'Screwdriver', 'Saw', 'Pencil', 'Hammer'];
  const groups = await assetLoader.loadFabricGroups(ASSETS.LESSON_2_SVG, identifiers);
  
  return {
    owlWithHelmet: lesson1Assets['Owl_with_Helmet'],
    toolbox: groups['Toolbox'],
    wrench: groups['Wrench'],
    screwdriver: groups['Screwdriver'],
    saw: groups['Saw'],
    pencil: groups['Pencil'],
    hammer: groups['Hammer']
  };
}

/**
 * Setup owl with helmet (end state from Lesson 1)
 */
function setupOwlWithHelmet(owlWithHelmet) {
  if (!owlWithHelmet) {
    console.warn('[Lesson2] Owl with helmet not found');
    return;
  }
  
  owlWithHelmet.set({
    selectable: false,
    evented: false,
    visible: true
  });
  
  canvas.add(owlWithHelmet);
  owlWithHelmet.setCoords();
  
  try {
    owlWithHelmet.tutorialId = 'Owl_with_Helmet';
  } catch (e) {
    console.warn('[Lesson2] Could not set tutorialId:', e);
  }
  
  lesson2State.objects.owlWithHelmet = owlWithHelmet;
  console.log('[Lesson2] Owl with helmet added to canvas');
}

/**
 * Setup toolbox (non-interactive target)
 */
function setupToolbox(toolbox) {
  toolbox.set({ 
    selectable: false, 
    evented: false, 
    visible: true 
  });
  
  const baseX = canvas.getWidth() * LAYOUT.TOOLBOX_X_RATIO;
  const topY = canvas.getHeight() / 2 + LAYOUT.TOOLBOX_Y_OFFSET;
  
  toolbox.left = baseX;
  toolbox.top = topY;
  
  canvas.add(toolbox);
  toolbox.setCoords();
  
  try { 
    toolbox.tutorialId = 'Toolbox'; 
  } catch (e) {
    console.warn('[Lesson2] Could not set tutorialId:', e);
  }
  
  lesson2State.objects.toolbox = toolbox;
  console.log('[Lesson2] Toolbox added');
}

/**
 * Setup tool objects in circle around toolbox
 */
function setupTools(tools) {
  const addedTools = [];
  
  Object.values(tools).forEach(tool => {
    if (!tool) return;
    
    tool.set({ 
      selectable: true, 
      evented: true, 
      visible: true,
      lockScalingX: true, 
      lockScalingY: true, 
      lockUniScaling: true 
    });
    
    canvas.add(tool);
    
    // Hide scaling controls
    if (typeof tool.setControlsVisibility === 'function') {
      tool.setControlsVisibility({ 
        mt: false, mb: false, ml: false, mr: false, 
        bl: false, br: false, tl: false, tr: false 
      });
    }
    
    addedTools.push(tool);
  });
  
  // Position tools in circle
  positionToolsInCircle(addedTools);
  
  lesson2State.objects.tools = addedTools;
  console.log('[Lesson2] Added', addedTools.length, 'tools');
}

/**
 * Position tools in circle around toolbox
 */
function positionToolsInCircle(tools) {
  if (!lesson2State.objects.toolbox || tools.length === 0) return;
  
  const toolboxRect = lesson2State.objects.toolbox.getBoundingRect(true);
  const centerX = toolboxRect.left + toolboxRect.width / 2;
  const centerY = toolboxRect.top + toolboxRect.height / 2;
  const radius = Math.max(toolboxRect.width, toolboxRect.height) * LAYOUT.TOOL_CIRCLE_RADIUS_MULTIPLIER + LAYOUT.TOOL_CIRCLE_OFFSET;
  
  tools.forEach((tool, index) => {
    const angle = (index / tools.length) * (2 * Math.PI) - Math.PI / 2;
    const posX = centerX + radius * Math.cos(angle);
    const posY = centerY + radius * Math.sin(angle);
    const toolRect = tool.getBoundingRect(true);
    
    tool.left = posX - (toolRect.width / 2);
    tool.top = posY - (toolRect.height / 2);
    tool.setCoords();
  });
}

/**
 * Check if pointer is over toolbox
 */
function isPointerOverToolbox(event) {
  if (!event || !lesson2State.objects.toolbox) return false;
  
  const pointer = canvas.getPointer(event);
  const toolboxRect = lesson2State.objects.toolbox.getBoundingRect(true);
  
  return (
    pointer.x >= toolboxRect.left && 
    pointer.x <= toolboxRect.left + toolboxRect.width &&
    pointer.y >= toolboxRect.top && 
    pointer.y <= toolboxRect.top + toolboxRect.height
  );
}

/**
 * Check if all tools are selected
 */
function areAllToolsSelected() {
  const activeObjects = canvas.getActiveObjects();
  const toolCount = lesson2State.objects.tools.length;
  
  if (activeObjects.length !== toolCount) return false;
  
  // Verify all active objects are tools
  return activeObjects.every(obj => lesson2State.objects.tools.includes(obj));
}

/**
 * Handle successful tool collection
 */
function handleSuccess() {
  if (lesson2State.completed) return;
  
  lesson2State.completed = true;
  
  const selectedTools = canvas.getActiveObjects().slice();
  selectedTools.forEach(tool => canvas.remove(tool));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  
  // Animate toolbox with double bounce
  if (lesson2State.objects.toolbox) {
    animationController.doubleBounce(lesson2State.objects.toolbox, () => {
      showNextButton();
    });
  } else {
    showNextButton();
  }
  
  // Cleanup and restore selection behavior
  cleanupEventHandlers();
  if (canvas) canvas.allowBoxSelection = true;
  
  console.info('[Lesson2] All tools collected!');
}

/**
 * Show next lesson button
 */
function showNextButton() {
  const panel = document.getElementById('panel');
  if (!panel) return;
  
  let button = document.getElementById('next-tutorial-btn-2');
  if (button) return;
  
  button = document.createElement('button');
  button.id = 'next-tutorial-btn-2';
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
    import('./tutorial.js').then(module => {
      module.startThirdTutorial();
    });
  };
  
  panel.appendChild(button);
}

/**
 * Handle object moving event
 */
function handleObjectMoving(event) {
  if (lesson2State.completed) return;
  
  lesson2State.isDragging = true;
  
  if (!event || !event.e) return;
  if (!areAllToolsSelected()) return;
  
  if (isPointerOverToolbox(event.e)) {
    handleSuccess();
  }
}

/**
 * Handle mouse up event
 */
function handleMouseUp(event) {
  lesson2State.isDragging = false;
}

/**
 * Attach event handlers
 */
function attachEventHandlers() {
  canvas.on('object:moving', handleObjectMoving);
  canvas.on('mouse:up', handleMouseUp);
}

/**
 * Cleanup event handlers
 */
function cleanupEventHandlers() {
  canvas.off('object:moving', handleObjectMoving);
  canvas.off('mouse:up', handleMouseUp);
}

/**
 * Cleanup function
 */
function cleanup() {
  if (animationController) {
    animationController.stopAllAnimations();
  }
  
  cleanupEventHandlers();
  
  if (lesson2State.objects.owlWithHelmet && canvas.contains(lesson2State.objects.owlWithHelmet)) {
    canvas.remove(lesson2State.objects.owlWithHelmet);
  }
  
  if (lesson2State.objects.toolbox && canvas.contains(lesson2State.objects.toolbox)) {
    canvas.remove(lesson2State.objects.toolbox);
  }
  
  lesson2State.objects.tools.forEach(tool => {
    if (tool && canvas.contains(tool)) {
      canvas.remove(tool);
    }
  });
  
  lesson2State.reset();
  canvas.requestRenderAll();
  
  console.log('[Lesson2] Cleanup complete');
}

/**
 * Start Lesson 2
 */
export async function startLesson2() {
  if (lesson2State.isActive) {
    console.log('[Lesson2] Already active');
    return;
  }
  
  lesson2State.isActive = true;
  
  // Disable box selection, keep shift-click
  if (canvas) {
    canvas.selection = true;
    canvas.allowBoxSelection = false;
  }
  
  try {
    history.replaceState(null, '', '#lesson=2');
    // Trigger hashchange event to update lesson buttons
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (e) {
    console.warn('[Lesson2] Could not update URL:', e);
  }
  
  updatePageMetadata();
  updateInstructionPanel();
  
  // Reset viewport to default position and zoom
  resetViewport();
  
  // Initialize animation controller with current canvas
  if (!animationController) {
    animationController = new AnimationController(canvas);
  }
  
  console.info('[Lesson2] Loading assets...');
  
  const assets = await loadLessonAssets();
  
  if (!assets.owlWithHelmet) console.warn('[Lesson2] Owl with helmet not found');
  if (!assets.toolbox) console.warn('[Lesson2] Toolbox not found');
  
  // Setup owl with helmet first (background element)
  if (assets.owlWithHelmet) setupOwlWithHelmet(assets.owlWithHelmet);
  
  if (assets.toolbox) setupToolbox(assets.toolbox);
  
  const tools = {
    wrench: assets.wrench,
    screwdriver: assets.screwdriver,
    saw: assets.saw,
    pencil: assets.pencil,
    hammer: assets.hammer
  };
  
  setupTools(tools);
  attachEventHandlers();
  
  canvas.requestRenderAll();
  
  console.info('[Lesson2] Started successfully');
}

/**
 * Restart Lesson 2
 */
export async function restartLesson2() {
  cleanup();
  canvas.getObjects().slice().forEach(obj => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  
  lesson2State.isActive = false;
  await startLesson2();
}

export { cleanup as cleanupLesson2 };
