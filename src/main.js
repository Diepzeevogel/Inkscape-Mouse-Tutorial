import { initCanvas, centerCanvas, canvas } from './canvas.js';
import { installWelcomeOverlay, createSelectOverlayButton } from './overlay.js';
import { startTutorial, startTutorialDirect, startLesson2, startLesson3, startLesson4, startLesson5 } from './tutorial.js';
import { startLesson6, cleanupLesson6 } from './Lesson6.js';
import { shapeDrawingController } from './ShapeDrawingController.js';
import { penToolController } from './PenToolController.js';

// Device detection - check for desktop/laptop with mouse
function isDesktopWithMouse() {
  const checks = {
    hasFinePrimaryPointer: false,
    hasLargeScreen: false,
    isNotMobileUA: false,
    hasHoverSupport: false
  };

  // Check 1: Primary pointer is "fine" (mouse/trackpad) not "coarse" (touch)
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    checks.hasFinePrimaryPointer = true;
  }

  // Check 2: Screen size - desktop typically > 1024px width
  if (window.innerWidth >= 1024) {
    checks.hasLargeScreen = true;
  }

  // Check 3: User agent doesn't contain mobile/tablet identifiers
  const ua = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
  const isMobile = mobileKeywords.some(keyword => ua.includes(keyword));
  if (!isMobile) {
    checks.isNotMobileUA = true;
  }

  // Check 4: Hover support (typically indicates mouse)
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    checks.hasHoverSupport = true;
  }

  // Require at least 3 out of 4 checks to pass
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return passedChecks >= 3;
}

function showUnsupportedDeviceOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'unsupported-device-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.color = 'white';
  overlay.style.padding = '20px';
  overlay.style.textAlign = 'center';

  const icon = document.createElement('div');
  icon.style.fontSize = '64px';
  icon.style.marginBottom = '20px';
  icon.innerHTML = '🖱️';

  const title = document.createElement('h1');
  title.style.fontSize = '28px';
  title.style.marginBottom = '16px';
  title.textContent = 'Computer met muis vereist';

  const message = document.createElement('p');
  message.style.fontSize = '18px';
  message.style.maxWidth = '600px';
  message.style.lineHeight = '1.6';
  message.innerHTML = `
    Deze Inkscape tutorials zijn ontworpen voor desktop- of laptopcomputers met een fysieke muis.<br><br>
    <strong>Toegang tot deze tutorial is mogelijk vanaf:</strong><br>
    • Een desktopcomputer of laptop<br>
    • Gebruik van een fysieke muis (geen touchpad of touchscreen)
  `;

  overlay.appendChild(icon);
  overlay.appendChild(title);
  overlay.appendChild(message);
  document.body.appendChild(overlay);
}

// Check device compatibility before initializing
if (!isDesktopWithMouse()) {
  showUnsupportedDeviceOverlay();
  throw new Error('Unsupported device: Desktop with mouse required');
}

// Initialize canvas
initCanvas('c');
centerCanvas();

// Install overlay and hook select tool
const welcomeOverlay = installWelcomeOverlay();
const selectTool = document.getElementById('tool-select');
const selectButtonOverlay = createSelectOverlayButton(async () => {
  // If lesson 1 is already active, don't reinitialize the view.
  const currentMatch = (location.hash || '').match(/lesson=([\d.]+)/);
  const currentLesson = currentMatch ? parseFloat(currentMatch[1]) : null;
  if (currentLesson === 1) {
    // simply remove overlays and highlight the select tool without re-initializing
    if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
    if (selectTool) {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      selectTool.classList.add('active');
    }
    return;
  }

  // navigate to lesson 1 and initialize the lesson state
  try { location.hash = 'lesson=1'; } catch (e) {}
  if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
  if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
  if (selectTool) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    selectTool.classList.add('active');
  }
  await startTutorialDirect();
});
document.body.appendChild(selectButtonOverlay);

// Lesson buttons (bottom of the aside panel)
const lessons = [
  { id: 1, title: 'Les 1', icon: 'assets/icons/tutorial_icons/les1.svg' },
  { id: 2, title: 'Les 2', icon: 'assets/icons/tutorial_icons/les2.svg' },
  { id: 3, title: 'Les 3', icon: 'assets/icons/tutorial_icons/les3.svg' },
  { id: 4, title: 'Les 4', icon: 'assets/icons/tutorial_icons/les4.svg' },
  { id: 5, title: 'Les 5', icon: 'assets/icons/tutorial_icons/les5.svg' },
  { id: 6, title: 'Les 6', icon: 'assets/icons/tutorial_icons/les6.svg' }
];

function createLessonButtons() {
  let container = document.getElementById('lesson-buttons');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lesson-buttons';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(48px, max-content))';
    container.style.maxWidth = 'calc(5 * 48px + 4 * 8px)'; // 5 columns max with gaps
    container.style.gap = '8px';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    // fixed bottom center, separate from the aside panel so it remains on top
    container.style.position = 'fixed';
    container.style.bottom = '16px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '10000';
    container.style.background = 'rgba(255,255,255,0.95)';
    container.style.padding = '8px';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)';
    document.body.appendChild(container);
  }
  container.innerHTML = '';
  lessons.forEach(lesson => {
    const btn = document.createElement('button');
    btn.className = 'lesson-btn';
    btn.type = 'button';
    btn.dataset.lesson = String(lesson.id);
    btn.title = lesson.title;
    btn.style.border = '1px solid #ddd';
    btn.style.background = 'white';
    btn.style.padding = '6px';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.width = '48px';
    btn.style.height = '48px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';

    const img = document.createElement('img');
    img.src = lesson.icon;
    img.alt = lesson.title;
    img.style.width = '28px';
    img.style.height = '28px';
    btn.appendChild(img);

    btn.addEventListener('click', async (e) => {
      const curMatch = (location.hash || '').match(/lesson=([\d.]+)/);
      const cur = curMatch ? parseFloat(curMatch[1]) : null;
      const target = lesson.id;
      // If clicking current lesson, treat as refresh: reinitialize
      if (cur === target) {
        // clear canvas and re-run initialization for the lesson
        try {
          const objs = canvas.getObjects().slice();
          objs.forEach(o => canvas.remove(o));
          canvas.discardActiveObject();
        } catch (err) {}
        if (target === 1) await startTutorialDirect();
        if (target === 2) await startLesson2();
        if (target === 3) await startLesson3();
        if (target === 4) await startLesson4();
        if (target === 5) await startLesson5();
        if (target === 6) await startLesson6();
        updateLessonButtons();
        return;
      }

      // switch to target lesson
      try { location.hash = `lesson=${target}`; } catch (err) {}
      // remove overlays
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (err) {}

      // clear canvas before switching
      try {
        const objs = canvas.getObjects().slice();
        objs.forEach(o => canvas.remove(o));
        canvas.discardActiveObject();
        // Clean up any active lesson
        if (cur === 6) cleanupLesson6();
      } catch (err) {}

      if (target === 1) {
        await startTutorialDirect();
      } else if (target === 2) {
        await startLesson2();
      } else if (target === 3) {
        await startLesson3();
      } else if (target === 4) {
        await startLesson4();
      } else if (target === 5) {
        await startLesson5();
      } else if (target === 6) {
        await startLesson6();
      }
      updateLessonButtons();
    });

    container.appendChild(btn);
  });
}

function updateLessonButtons() {
  const container = document.getElementById('lesson-buttons');
  if (!container) return;
  const currentMatch = (location.hash || '').match(/lesson=([\d.]+)/);
  const currentLesson = currentMatch ? parseFloat(currentMatch[1]) : null;
  Array.from(container.children).forEach(child => {
    const btn = child;
    const lessonId = parseInt(btn.dataset.lesson, 10);
    // remove any refresh overlay
    const existing = btn.querySelector('.refresh-icon');
    if (existing) existing.remove();
    if (lessonId === currentLesson) {
      // overlay a refresh icon
      const span = document.createElement('span');
      span.className = 'refresh-icon';
      span.style.position = 'absolute';
      span.style.width = '18px';
      span.style.height = '18px';
      span.style.right = '2px';
      span.style.bottom = '2px';
      span.style.borderRadius = '9px';
      span.style.background = 'rgba(0,0,0,0.6)';
      span.style.display = 'flex';
      span.style.alignItems = 'center';
      span.style.justifyContent = 'center';
      span.style.color = 'white';
      span.style.fontSize = '10px';
      span.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
      btn.style.position = 'relative';
      btn.appendChild(span);
    }
  });
}

createLessonButtons();
updateLessonButtons();
window.addEventListener('hashchange', updateLessonButtons);
// Positioning: align the fixed lesson button bar over the bottom-center of the aside panel
function positionLessonButtons() {
  const container = document.getElementById('lesson-buttons');
  if (!container) return;
  const panel = document.getElementById('panel');
  if (panel) {
    const rect = panel.getBoundingClientRect();
    const left = rect.left + rect.width / 2;
    // place a bit above the panel bottom (12px)
    const bottom = Math.max(8, window.innerHeight - rect.bottom + 12);
    container.style.left = `${left}px`;
    container.style.transform = 'translateX(-50%)';
    container.style.bottom = `${bottom}px`;
  } else {
    // fallback to centered at viewport bottom
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.bottom = '16px';
  }
}

// Reposition on load, resize and when the hash or DOM might change the panel
positionLessonButtons();
window.addEventListener('resize', positionLessonButtons);
window.addEventListener('hashchange', () => { updateLessonButtons(); positionLessonButtons(); });

// Observe panel size/position changes (e.g., when panel content is updated) and reposition
const panel = document.getElementById('panel');
if (panel && typeof ResizeObserver !== 'undefined') {
  try {
    const ro = new ResizeObserver(positionLessonButtons);
    ro.observe(panel);
  } catch (e) { /* ignore */ }
}

// Wire the select tool in the left toolbar
if (selectTool) {
  selectTool.addEventListener('click', async () => {
    const currentMatch = (location.hash || '').match(/lesson=(\d+)/);
    const currentLesson = currentMatch ? parseInt(currentMatch[1], 10) : null;
    // If lesson 1 is already showing, do not reset the view
    if (currentLesson > 0) {
      // just ensure the select tool is visually active
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      selectTool.classList.add('active');
      return;
    }

    // set the URL to lesson 1 and start the lesson initialization
    //try { location.hash = 'lesson=1'; } catch (e) {}
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    selectTool.classList.add('active');
    if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
    await startTutorialDirect();
  });
}

// Disable all non-select tools for the first lesson
document.querySelectorAll('#leftToolbar .tool-btn').forEach(b => {
  if (b.id !== 'tool-select') {
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
  }
});

// Shape drawing tool handlers
const rectTool = document.getElementById('tool-rect');
const ellipseTool = document.getElementById('tool-ellipse');

if (rectTool) {
  rectTool.addEventListener('click', () => {
    // Deactivate other tools
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    rectTool.classList.add('active');
    
    // Enable rectangle drawing mode
    shapeDrawingController.enable('rect');
    penToolController.disable();
  });
}

if (ellipseTool) {
  ellipseTool.addEventListener('click', () => {
    // Deactivate other tools
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    ellipseTool.classList.add('active');
    
    // Enable ellipse drawing mode
    shapeDrawingController.enable('ellipse');
    penToolController.disable();
  });
}

// Pen tool handler
const penTool = document.getElementById('tool-pen');
if (penTool) {
  penTool.addEventListener('click', () => {
    // Deactivate other tools
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    penTool.classList.add('active');
    
    // Disable shape drawing and enable pen tool
    shapeDrawingController.disable();
    penToolController.enable();
  });
}

// When select tool is clicked, disable shape drawing and pen tool
if (selectTool) {
  const originalSelectHandler = selectTool.onclick;
  selectTool.addEventListener('click', () => {
    shapeDrawingController.disable();
    penToolController.disable();
  }, { capture: true });
}

// Update dimension controls when selection changes
canvas.on('selection:created', (e) => {
  if (e.selected && e.selected[0]) {
    shapeDrawingController.updateControlsForSelection(e.selected[0]);
  }
});

canvas.on('selection:updated', (e) => {
  if (e.selected && e.selected[0]) {
    shapeDrawingController.updateControlsForSelection(e.selected[0]);
  }
});

canvas.on('object:modified', (e) => {
  if (e.target) {
    shapeDrawingController.updateControlsForSelection(e.target);
  }
});

// Remove overlay when selection is made in Fabric
if (canvas) {
  canvas.on('selection:created', () => {
    if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
  });
}

// Keyboard shortcut to activate the select tool and dismiss overlay
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'v') {
    if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    if (selectTool) {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      selectTool.classList.add('active');
    }
  }
});

// Highlight select tool
if (selectTool) selectTool.classList.add('highlight');

// Expose for debugging
window.startTutorial = startTutorial;
window.startLesson3 = startLesson3;

// Start a specific tutorial when requested via URL hash (#lesson=1 or #lesson=2)
async function startFromHash() {
  try {
    const h = location.hash || '';
    if (!h) return;
    const m = h.match(/lesson=([\d.]+)/);
    if (!m) return;
    const lesson = parseFloat(m[1]);
    if (lesson === 1) {
      // remove overlays and start lesson 1 directly without overlay
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (e) {}
      await startTutorialDirect();
    } else if (lesson === 2) {
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (e) {}
      await startLesson2();
    } else if (lesson === 3) {
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (e) {}
      await startLesson3();
    } else if (lesson === 4) {
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (e) {}
      await startLesson4();
    } else if (lesson === 5) {
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (e) {}
      await startLesson5();
    } else if (lesson === 6) {
      try {
        if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        if (selectButtonOverlay && selectButtonOverlay.parentNode) selectButtonOverlay.parentNode.removeChild(selectButtonOverlay);
      } catch (e) {}
      await startLesson6();
    }
  } catch (e) { /* ignore */ }
}

// run at load
startFromHash();

// Ensure Fabric.js canvases are styled correctly
// --- Canvas CSS: ensure pointer events and scrolling work ---
const style = document.createElement('style');
style.innerHTML = `
  canvas.lower-canvas, canvas.upper-canvas {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    height: 100% !important;
    pointer-events: auto !important;
    touch-action: none;
  }
  canvas.lower-canvas {
    z-index: 0;
    background: #fff;
  }
  canvas.upper-canvas {
    z-index: 1;
    background: transparent !important;
  }
`;
document.head.appendChild(style);
// Note: pointer-events: auto is required for scrolling and selection to work with Fabric.js.
