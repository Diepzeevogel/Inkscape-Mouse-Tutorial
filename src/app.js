// Fabric.js interactive tutorial for mouse operations
const canvasEl = document.getElementById('c');

const canvas = new fabric.Canvas('c', {
  selection: true,
  preserveObjectStacking: true,
  skipTargetFind: false,
  backgroundColor: '#f6f7f8'
});

function fitCanvas() {
  const toolbarH = document.getElementById('toolbar').offsetHeight;
  const panelW = document.getElementById('panel').offsetWidth;
  const appEl = document.getElementById('app');
  // compute available width inside the `#app` container (subtract panel width)
  const w = Math.max(300, appEl.clientWidth - panelW - 10); // Adjusted to prevent overlap
  const h = Math.max(200, appEl.clientHeight || (window.innerHeight - toolbarH));
  // use Fabric API to set canvas dimensions (keeps internal state consistent)
  canvas.setWidth(w);
  canvas.setHeight(h);
  canvas.calcOffset();
}

fitCanvas();
window.addEventListener('resize', () => { fitCanvas(); canvas.requestRenderAll(); });

// Add sample objects
function addSampleObjects(count = 18) {
  const w = canvas.getWidth(), h = canvas.getHeight();
  const colors = ['#f94144','#f3722c','#f8961e','#f9c74f','#90be6d','#43aa8b','#577590','#277da1'];
  for (let i = 0; i < count; i++) {
    const x = 40 + Math.random() * (w - 120);
    const y = 40 + Math.random() * (h - 120);
    const size = 30 + Math.random() * 70;
    const type = Math.floor(Math.random() * 3);
    const options = {
      left: x, top: y, fill: colors[i % colors.length], selectable: true, stroke: '#222', strokeWidth: 1, originX: 'center', originY: 'center'
    };
    let obj;
    if (type === 0) obj = new fabric.Rect(Object.assign({ width: size, height: size, rx: 6, ry: 6 }, options));
    else if (type === 1) obj = new fabric.Circle(Object.assign({ radius: size / 2 }, options));
    else obj = new fabric.Triangle(Object.assign({ width: size, height: size }, options));
    obj.shadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 6, offsetX: 2, offsetY: 2 });
    canvas.add(obj);
  }
  canvas.renderAll();
}

// Don't populate canvas with random shapes for the lesson — start empty
// addSampleObjects();

// Selection helpers: allow Shift/Ctrl/Meta + click to add/remove from current selection
// Use Fabric's built-in selection behavior (no custom toggle logic)

// Panning
let isPanning = false;
let lastPos = { x: 0, y: 0 };
let spaceDown = false;
// Selection-drag tracking for full-inside selection
let selectionStart = null;
let selectionDragging = false;
let selectionBase = [];
let shiftDown = false;
let mouseDownInfo = null; // { target, start, prevSelection }
// track when the user is actively dragging an object (so we don't
// confuse object-moves with marquee selection and accidentally
// re-apply/replace active selection while objects are moving)
let isObjectMoving = false;
// remember the last non-empty selection (helps when selection was
// accidentally cleared before the user starts a Shift+marquee union)
let lastNonEmptySelection = [];

canvas.on('mouse:down', function(opt) {
  const e = opt.e;
  // reset object-moving flag at the start of a new interaction
  isObjectMoving = false;
  if (e.button === 1 || spaceDown) {
    // middle button or space -> pan
    isPanning = true;
    // stop browser middle-click autoscroll / propagation so we get move events
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
    lastPos = { x: e.clientX, y: e.clientY };
    canvas.selection = false;
    canvas.defaultCursor = 'grabbing';
    return;
  }
  // record mousedown info so we can decide on move whether user intends
  // a marquee (box) selection or a click/drag of an object
  if (e.button === 0) {
    const currentActive = canvas.getActiveObjects().slice();
    // If the user pressed Shift and there's no active selection right now,
    // fall back to the last known non-empty selection so a union still
    // makes sense even if the selection was cleared by an intervening click.
    const prevSel = (currentActive.length === 0 && e.shiftKey && lastNonEmptySelection.length > 0)
      ? lastNonEmptySelection.slice()
      : currentActive;
    mouseDownInfo = {
      target: opt.target || null,
      start: canvas.getPointer(e),
      prevSelection: prevSel,
      shiftAtDown: e.shiftKey
    };
    // Always snapshot current selection as the base so we can union later
    // if the user holds Shift (either at down or during drag).
    selectionBase = mouseDownInfo.prevSelection.slice();
  } else {
    mouseDownInfo = null;
    selectionBase = [];
  }
  // clear selection flags; actual marquee will be started on move if needed
  selectionStart = null;
  selectionDragging = false;
  // Let Fabric handle selection (including Shift+click) for clicks on objects.
});

// track Fabric object move events so selection filtering can ignore
// transient selection changes while objects are being dragged.
canvas.on('object:moving', function() {
  isObjectMoving = true;
});
canvas.on('object:modified', function() {
  // object finished moving / transformed
  isObjectMoving = false;
});

// Native handlers on the upper canvas element to support middle-button panning
// reliably (some mice / browsers don't always route through Fabric events).
function nativeStartPan(e) {
  // only start on middle button (button === 1)
  if (e.button !== 1) return;
  // prevent browser autoscroll
  e.preventDefault();
  e.stopPropagation();
  isPanning = true;
  lastPos = { x: e.clientX, y: e.clientY };
  canvas.selection = false;
  canvas.defaultCursor = 'grabbing';
}

function nativePanMove(e) {
  if (!isPanning) return;
  // compute delta and move viewport
  const dx = e.clientX - lastPos.x;
  const dy = e.clientY - lastPos.y;
  const vpt = canvas.viewportTransform;
  vpt[4] += dx;
  vpt[5] += dy;
  canvas.setViewportTransform(vpt);
  lastPos = { x: e.clientX, y: e.clientY };
  canvas.requestRenderAll();
}

function nativeEndPan(e) {
  // end panning on middle button release (mouseup) or auxclick
  // auxclick typically fires for non-primary buttons
  if (!isPanning) return;
  isPanning = false;
  canvas.selection = true;
  canvas.defaultCursor = 'default';
}

// attach native listeners to the Fabric upper canvas element
const upperEl = canvas.upperCanvasEl;
if (upperEl) {
  upperEl.addEventListener('mousedown', nativeStartPan, { passive: false });
  window.addEventListener('mousemove', nativePanMove, { passive: false });
  window.addEventListener('mouseup', nativeEndPan, { passive: false });
  // some browsers dispatch auxclick for middle button release
  upperEl.addEventListener('auxclick', (e) => { if (e.button === 1) nativeEndPan(e); }, { passive: false });
  // also ensure we stop panning if pointer leaves window
  window.addEventListener('blur', nativeEndPan);
}

canvas.on('mouse:move', function(opt) {
  // no custom pending toggle logic — Fabric handles drag selection
  if (!isPanning) {
    // decide whether to start a marquee selection even if the mousedown
    // happened on an object. Start marquee when movement exceeds threshold.
    if (mouseDownInfo && !selectionDragging && opt.e) {
      const p = canvas.getPointer(opt.e);
      const dx = Math.abs(p.x - mouseDownInfo.start.x);
      const dy = Math.abs(p.y - mouseDownInfo.start.y);
      if (dx > 4 || dy > 4) {
        // Only start marquee selection if mousedown was on empty space
        if (!mouseDownInfo.target) {
          selectionStart = mouseDownInfo.start;
          selectionDragging = true;
          // Do NOT overwrite selectionBase here; it was set at mouse down
        }
      }
    }
    return;
  }
  const e = opt.e;
  const vpt = canvas.viewportTransform;
  const dx = e.clientX - lastPos.x;
  const dy = e.clientY - lastPos.y;
  vpt[4] += dx;
  vpt[5] += dy;
  canvas.setViewportTransform(vpt);
  lastPos = { x: e.clientX, y: e.clientY };
  canvas.requestRenderAll();
});

canvas.on('mouse:up', function(opt) {
  if (isPanning) {
    isPanning = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
  }
  // Debug output for union condition variables at the start of mouse:up (overlay only)
  if (_dbg && _dbg.log) {
    _dbg.log('[union] mouse:up: shiftAtDown=' + (mouseDownInfo ? mouseDownInfo.shiftAtDown : 'null') + ', selectionBase.length=' + (selectionBase ? selectionBase.length : 'null'));
  }

  // If the user dragged a selection marquee (started on empty space), compute
  // which objects are fully contained in the selection rectangle and select
  // only those. This makes box-select require full containment instead of
  // the default intersect behaviour.
  if (selectionDragging && selectionStart && opt.e) {
    const end = canvas.getPointer(opt.e);
    const x1 = Math.min(selectionStart.x, end.x);
    const y1 = Math.min(selectionStart.y, end.y);
    const x2 = Math.max(selectionStart.x, end.x);
    const y2 = Math.max(selectionStart.y, end.y);
    const contained = [];
    canvas.getObjects().forEach(obj => {
      if (!obj.selectable || !obj.visible) return;
      // get bounding rect in canvas coordinates (absolute = true)
      const br = obj.getBoundingRect(true);
      const objLeft = br.left;
      const objTop = br.top;
      const objRight = br.left + br.width;
      const objBottom = br.top + br.height;
      if (objLeft >= x1 && objTop >= y1 && objRight <= x2 && objBottom <= y2) {
        contained.push(obj);
      }
    });
    // Always run union logic and log when Shift is held (either at down or currently),
    // even if selectionBase is empty. Fall back to mouseDownInfo.prevSelection.
    const shiftHeldNow = (opt.e && opt.e.shiftKey) || shiftDown;
    if (mouseDownInfo && (mouseDownInfo.shiftAtDown || shiftHeldNow)) {
      // Capture snapshots now to avoid them being cleared before the timeout runs.
      const snapBase = (selectionBase && selectionBase.length > 0) ? selectionBase.slice() : (mouseDownInfo.prevSelection ? mouseDownInfo.prevSelection.slice() : []);
      const snapContained = contained.slice();
      setTimeout(() => {
        // Ensure Fabric selection is enabled before union
        canvas.selection = true;
        canvas.requestRenderAll();
        // Use contained objects from marquee, not just Fabric's active selection
        const union = [];
        const add = (o) => { if (!union.includes(o)) union.push(o); };
        snapBase.forEach(add);
        snapContained.forEach(add);
        // Debug log: show selectionBase, contained, and union (overlay only)
        if (_dbg && _dbg.log) {
          _dbg.log('[union] usedBase=[' + (snapBase ? snapBase.map(getObjectLabel).join(',') : '') + ']');
          _dbg.log('[union] contained=[' + snapContained.map(getObjectLabel).join(',') + ']');
          _dbg.log('[union] result=[' + union.map(getObjectLabel).join(',') + ']');
        }
        if (union.length === 0) canvas.discardActiveObject();
        else if (union.length === 1) canvas.setActiveObject(union[0]);
        else canvas.setActiveObject(new fabric.ActiveSelection(union, { canvas }));
        canvas.requestRenderAll();
        selectionBase = [];
      }, 10);
    } else {
      if (contained.length === 0) canvas.discardActiveObject();
      else if (contained.length === 1) canvas.setActiveObject(contained[0]);
      else canvas.setActiveObject(new fabric.ActiveSelection(contained, { canvas }));
      canvas.requestRenderAll();
      selectionBase = [];
    }
  }
  // reset tracking
  selectionStart = null;
  selectionDragging = false;
  selectionBase = [];
  mouseDownInfo = null;
  // ensure move flag is cleared after interaction completes
  isObjectMoving = false;
});

// Filter group-selection so only objects fully inside the marquee remain selected.
let _suppressSelectionFilter = false;
function filterSelectionByContainment() {
  if (_suppressSelectionFilter) return;
  // canvas._groupSelector is Fabric's internal marquee rect (when dragging to select)
  const gs = canvas._groupSelector;
  // Only apply containment-filtering when a marquee selection is actively
  // being dragged. Also skip while objects are being moved (object:moving)
  // to avoid interfering with normal drag/move interactions.
  if (!gs || !selectionDragging || isObjectMoving) return;
  const selLeft = gs.left;
  const selTop = gs.top;
  const selRight = gs.left + gs.width;
  const selBottom = gs.top + gs.height;
  const selected = canvas.getActiveObjects();
  if (!selected || selected.length === 0) return;
  const contained = selected.filter(obj => {
    if (!obj.selectable || !obj.visible) return false;
    const br = obj.getBoundingRect(true);
    const objLeft = br.left;
    const objTop = br.top;
    const objRight = br.left + br.width;
    const objBottom = br.top + br.height;
    return objLeft >= selLeft && objTop >= selTop && objRight <= selRight && objBottom <= selBottom;
  });
  // if nothing changed, no-op
  // Only enforce containment here; unioning with previous selection (if
  // the user held Shift) is handled on mouseup so the final selection is
  // computed reliably once the drag completes.
  if (contained.length === selected.length && contained.every((v,i)=>v===selected[i])) return;
  _suppressSelectionFilter = true;
  if (contained.length === 0) canvas.discardActiveObject();
  else if (contained.length === 1) canvas.setActiveObject(contained[0]);
  else canvas.setActiveObject(new fabric.ActiveSelection(contained, { canvas }));
  canvas.requestRenderAll();
  _suppressSelectionFilter = false;
}

canvas.on('selection:created', filterSelectionByContainment);
canvas.on('selection:updated', filterSelectionByContainment);

// Helper to produce a readable label for an object (type + index + color)
function getObjectLabel(obj) {
  if (!obj) return 'unknown';
  const idx = canvas.getObjects().indexOf(obj);
  const color = obj.fill || obj.stroke || 'none';
  return `${obj.type || 'obj'}#${idx}(${color})`;
}

// Log when a single object is selected (click/select)
canvas.on('selection:created', (e) => {
  const objs = canvas.getActiveObjects();
  if (objs && objs.length === 1) {
    const label = getObjectLabel(objs[0]);
    if (_dbg && _dbg.log) _dbg.log('[select] selected ' + label);
  }
  // remember the last non-empty selection for Shift+marquee fallback
  const objsAll = canvas.getActiveObjects();
  if (objsAll && objsAll.length > 0) lastNonEmptySelection = objsAll.slice();
});
canvas.on('selection:updated', (e) => {
  const objs = canvas.getActiveObjects();
  if (objs && objs.length === 1) {
    const label = getObjectLabel(objs[0]);
    if (_dbg && _dbg.log) _dbg.log('[select] updated selection ' + label);
  } else if (objs && objs.length > 1) {
    if (_dbg && _dbg.log) _dbg.log('[select] updated group selection (' + objs.length + ' items)');
  }
  // remember the last non-empty selection for Shift+marquee fallback
  const objsAll2 = canvas.getActiveObjects();
  if (objsAll2 && objsAll2.length > 0) lastNonEmptySelection = objsAll2.slice();
});

// Wheel zoom centered on pointer
canvas.on('mouse:wheel', function(opt) {
  const e = opt.e;
  // Zoom only when Ctrl is pressed. Otherwise, use the wheel to pan
  // the canvas up/down (so normal scrolling moves the view).
  if (e.ctrlKey) {
    const delta = e.deltaY;
    let zoom = canvas.getZoom();
    // smooth zoom factor
    zoom *= 0.999 ** delta;
    zoom = Math.max(0.25, Math.min(4, zoom));
    const pointer = canvas.getPointer(e);
    canvas.zoomToPoint(pointer, zoom);
  } else {
    // Pan vertically by wheel delta. Adjust sign so scroll moves view naturally.
    const vpt = canvas.viewportTransform;
    vpt[5] += -e.deltaY;
    canvas.setViewportTransform(vpt);
  }
  e.preventDefault();
  e.stopPropagation();
});

// Keyboard handlers
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { spaceDown = true; e.preventDefault(); canvas.defaultCursor = 'grab'; }
  if (e.key === 'Shift') { shiftDown = true; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    const all = canvas.getObjects().slice();
    if (all.length) {
      const sel = new fabric.ActiveSelection(all, { canvas });
      canvas.setActiveObject(sel);
      canvas.requestRenderAll();
    }
  }
  if (e.key === 'Escape') {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; canvas.defaultCursor = 'default'; } });
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') { shiftDown = false; } });

// Toolbar buttons
// Top toolbar controls (reset/select/clear) removed for lesson — handlers omitted

// initial zoom fit
function centerCanvas() {
  canvas.setViewportTransform([1,0,0,1,0,0]);
  canvas.renderAll();
}

centerCanvas();

// --- Welcome overlay / tutorial intro ---
function installWelcomeOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'welcomeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:10000;pointer-events:none';

  const card = document.createElement('div');
  card.className = 'welcome-card';
  card.style.cssText = 'width:640px;max-width:90%;background:white;padding:20px;border-radius:10px;display:flex;gap:16px;align-items:center;pointer-events:auto';

  const logo = document.createElement('div');
  logo.innerHTML = '<img src="assets/branding/MaakBib_Logo_LeftRight.svg" alt="logo" style="height:56px">';

  const content = document.createElement('div');
  content.innerHTML = '<h2>Welkom — MaakBib: Inkscape Les 1: Selecteren en slepen</h2><p>Volg een korte oefening om vertrouwd te raken met muisbediening: selecteren, meerdere selecteren, pannen en zoomen.</p>';

  card.appendChild(logo);
  card.appendChild(content);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return overlay;
}

const welcomeOverlay = installWelcomeOverlay();

// Hook the left toolbar select button to remove overlay when clicked
const selectBtn = document.getElementById('tool-select');
if (selectBtn) {
  selectBtn.addEventListener('click', (e) => {
    // mark active
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    selectBtn.classList.add('active');
    if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    // Start the tutorial when the select tool is activated
    startTutorial();
  });
}

// Make all left toolbar buttons toggle active state when clicked
const leftToolbar = document.getElementById('leftToolbar');
if (leftToolbar) {
  leftToolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    // ignore clicks for disabled (non-interactive) buttons
    if (btn.disabled) return;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // if the select tool was clicked, remove the welcome overlay
    if (btn.id === 'tool-select' && welcomeOverlay && welcomeOverlay.parentNode) {
      welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    }
  });
}

// Only let the select tool actually be clickable for this first lesson.
// Disable all other buttons so they serve only as visual guidance.
document.querySelectorAll('#leftToolbar .tool-btn').forEach(b => {
  if (b.id !== 'tool-select') {
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
  }
});

// also allow programmatic removal when user uses the actual select via Fabric
canvas.on('selection:created', () => {
  if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
});

// Also allow keyboard shortcut `V` to dismiss overlay and activate select
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'v') {
    const btn = document.getElementById('tool-select');
    if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
    if (btn) {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  }
});

// Highlight the selection tool button
const selectToolBtn = document.getElementById('tool-select');
selectToolBtn.classList.add('highlight');

// Add a select-tool button on top of the welcome overlay that overlaps the toolbar button below and retains the rest of the overlay.
const selectToolOverlay = document.createElement('button');
selectToolOverlay.id = 'selectToolOverlay';
selectToolOverlay.className = 'tool-btn';
selectToolOverlay.style.cssText = 'position: absolute; top: 55px; left: 5px; z-index: 10001; animation: wiggle 0.5s infinite; width: 40px; height: 40px; border: 1px solid #ccc; background: white; border-radius: 4px; box-shadow: 0 0 10px rgba(0, 123, 255, 0.8);';
selectToolOverlay.innerHTML = '<img src="assets/icons/tool-pointer.svg" alt="Select" style="width: 24px; height: 24px;">';
selectToolOverlay.addEventListener('click', () => {
  if (welcomeOverlay && welcomeOverlay.parentNode) welcomeOverlay.parentNode.removeChild(welcomeOverlay);
  const btn = document.getElementById('tool-select');
  if (btn) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
});

// Insert the select-tool overlay button on top of the welcome overlay
const card = document.querySelector('.welcome-card');
if (card) {
  card.appendChild(selectToolOverlay);
}

// --- Tutorial logic ------------------------------------------------------
let tutorialStarted = false;
let tutorialObjects = { owl: null, helmet: null, owlWithHelmet: null };

function updatePanelWithInstructions() {
  const panel = document.getElementById('panel');
  if (!panel) return;
  panel.innerHTML = `
    <h3>Opdracht</h3>
    <p>Selecteer de helm en sleep deze op het hoofd van het uiltje.</p>
    <ul>
      <li><i class="fa-solid fa-mouse"></i>&nbsp; Linker muisknop: selecteren</li>
      <li><i class="fa-solid fa-hand-fist"></i>&nbsp; Klik en sleep om te verplaatsen</li>
      <li><i class="fa-solid fa-arrows-up-down-left-right"></i>&nbsp; Gebruik de muis om te positioneren</li>
    </ul>
  `;
}

function rectsOverlap(a, b) {
  return !(a.left > b.left + b.width || a.left + a.width < b.left || a.top > b.top + b.height || a.top + a.height < b.top);
}

function startTutorial() {
  if (tutorialStarted) return;
  tutorialStarted = true;
  updatePanelWithInstructions();

  fabric.loadSVGFromURL('assets/tutorials/selecteren_en_slepen.svg', (objects, options) => {
    // Debug: list loaded objects and options to help identify elements
    console.info('[tutorial] Loaded SVG, objects count =', objects.length);
    console.info('[tutorial] SVG loader options:', options);
    function dumpInfo(o) {
      try {
        return {
          id: o.id || null,
          type: o.type || null,
          title: o.title || null,
          name: o.name || null,
          // some elements created by fabric may expose original SVG attributes
          inkscapeLabel: o.inkscapeLabel || null,
          visible: typeof o.visible !== 'undefined' ? o.visible : null
        };
      } catch (err) { return { error: String(err) }; }
    }
    objects.forEach((o, i) => {
      console.debug(`[tutorial] object[${i}]`, dumpInfo(o));
    });

    // Try to locate the elements by observed svg ids/names
    let owl = null, helmet = null, owlWithHelmet = null;
    for (const obj of objects) {
      if (!obj) continue;
      if (obj.id === 'use1' || (obj.title && obj.title.toLowerCase().includes('uiltje') && !obj.id)) {
        if (!owl) { owl = obj; console.info('[tutorial] matched owl by id/title:', dumpInfo(obj)); }
      }
      if (obj.id === 'use1-6' || (obj.title && obj.title.toLowerCase().includes('helmet') && !obj.id)) {
        if (!helmet) { helmet = obj; console.info('[tutorial] matched helmet by id/title:', dumpInfo(obj)); }
      }
      if (obj.id === 'use1-3' || (obj.title && obj.title.toLowerCase().includes('uiltje helm') && !obj.id)) {
        if (!owlWithHelmet) { owlWithHelmet = obj; console.info('[tutorial] matched owlWithHelmet by id/title:', dumpInfo(obj)); }
      }
    }

    // Additional fallback: match by substring of id or title
    if (!owl || !helmet || !owlWithHelmet) {
      for (const obj of objects) {
        if (!owl && obj.id && obj.id.toLowerCase().includes('use1')) { owl = obj; console.info('[tutorial] fallback matched owl by id substring:', dumpInfo(obj)); }
        if (!helmet && obj.id && obj.id.toLowerCase().includes('use1-6')) { helmet = obj; console.info('[tutorial] fallback matched helmet by id substring:', dumpInfo(obj)); }
        if (!owlWithHelmet && obj.id && obj.id.toLowerCase().includes('use1-3')) { owlWithHelmet = obj; console.info('[tutorial] fallback matched owlWithHelmet by id substring:', dumpInfo(obj)); }
      }
    }

    // Add only the relevant objects to the canvas so we control them directly
    console.info('[tutorial] match results:', { owl: !!owl, helmet: !!helmet, owlWithHelmet: !!owlWithHelmet });
    if (owl) {
      console.debug('[tutorial] owl object info before add:', dumpInfo(owl));
      try {
        owl.set({ selectable: false, evented: false });
        canvas.add(owl);
        tutorialObjects.owl = owl;
        console.info('[tutorial] added owl to canvas');
      } catch (err) { console.error('[tutorial] failed adding owl:', err); }
    }
    if (helmet) {
      console.debug('[tutorial] helmet object info before add:', dumpInfo(helmet));
      try {
        helmet.set({ selectable: true, evented: true });
        // Ensure helmet is above the owl
        helmet.set({ hoverCursor: 'grab' });
        canvas.add(helmet);
        tutorialObjects.helmet = helmet;
        console.info('[tutorial] added helmet to canvas');
      } catch (err) { console.error('[tutorial] failed adding helmet:', err); }
    }
    if (owlWithHelmet) {
      console.debug('[tutorial] owlWithHelmet object info before add:', dumpInfo(owlWithHelmet));
      try {
        owlWithHelmet.set({ selectable: false, evented: false, visible: false });
        canvas.add(owlWithHelmet);
        tutorialObjects.owlWithHelmet = owlWithHelmet;
        console.info('[tutorial] added owlWithHelmet to canvas (hidden)');
      } catch (err) { console.error('[tutorial] failed adding owlWithHelmet:', err); }
    }

    // If any of the objects are null, bail out gracefully and print detailed listing
    if (!tutorialObjects.owl || !tutorialObjects.helmet || !tutorialObjects.owlWithHelmet) {
      console.warn('Tutorial: some tutorial objects were not found in the SVG.', {
        found: { owl: !!tutorialObjects.owl, helmet: !!tutorialObjects.helmet, owlWithHelmet: !!tutorialObjects.owlWithHelmet }
      });
      // Print a compact list of candidate identifiers to help debugging
      const summary = objects.map((o, i) => ({ index: i, id: o.id || null, title: o.title || null, type: o.type || null }));
      console.debug('[tutorial] available objects summary:', summary);
      canvas.requestRenderAll();
      return;
    }

    // When the helmet is moved, check for overlap with the owl
    canvas.on('object:moving', function(e) {
      const moved = e.target;
      if (!moved || moved !== tutorialObjects.helmet) return;
      const hb = tutorialObjects.helmet.getBoundingRect(true);
      const ob = tutorialObjects.owl.getBoundingRect(true);
      console.debug('[tutorial] moving helmet bounding rect:', hb);
      console.debug('[tutorial] owl bounding rect:', ob);
      if (rectsOverlap(hb, ob)) {
        // Success: hide owl and helmet, show owl-with-helmet
        tutorialObjects.owl.visible = false;
        tutorialObjects.helmet.visible = false;
        tutorialObjects.owlWithHelmet.visible = true;
        tutorialObjects.owlWithHelmet.setCoords();
        canvas.requestRenderAll();
        // Optionally disable interaction for remaining tutorial objects
        tutorialObjects.owlWithHelmet.selectable = false;
        console.info('[tutorial] helmet placed on owl — success. Swapped to owlWithHelmet.');
      }
    });

    // Focus canvas and render
    canvas.requestRenderAll();
  });
}

//# sourceMappingURL=app.js.map
