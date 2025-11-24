// Canvas module: initialize Fabric canvas and handlers
export let canvas = null;
// When false, starting a marquee (box) selection by dragging on empty canvas is disabled.
export let allowBoxSelection = true;

export function initCanvas(canvasId = 'c') {
  canvas = new fabric.Canvas(canvasId, {
    selection: true,
    preserveObjectStacking: true,
    skipTargetFind: false,
    backgroundColor: 'white'
  });
  fitCanvas();
  window.addEventListener('resize', () => { fitCanvas(); if (canvas) canvas.requestRenderAll(); });
  setupInputHandlers();
  return canvas;
}

export function fitCanvas() {
  const toolbarH = document.getElementById('toolbar') ? document.getElementById('toolbar').offsetHeight : 0;
  const panelW = document.getElementById('panel') ? document.getElementById('panel').offsetWidth : 300;
  const appEl = document.getElementById('app') || document.body;
  const w = Math.max(300, appEl.clientWidth - panelW - 10);
  const h = Math.max(200, appEl.clientHeight || (window.innerHeight - toolbarH));
  if (canvas) {
    canvas.setWidth(w);
    canvas.setHeight(h);
    canvas.calcOffset();
  }
}

export function centerCanvas() {
  if (!canvas) return;
  canvas.setViewportTransform([1,0,0,1,0,0]);
  canvas.renderAll();
}

// Input / panning handlers
let isPanning = false;
let lastPos = { x: 0, y: 0 };
let spaceDown = false;
let isObjectMoving = false;
let mouseDownInfo = null;
let selectionBase = [];

function nativeStartPan(e) {
  if (!canvas) return;
  if (e.button !== 1) return;
  e.preventDefault();
  e.stopPropagation();
  isPanning = true;
  lastPos = { x: e.clientX, y: e.clientY };
  canvas.selection = false;
  canvas.defaultCursor = 'grabbing';
}

function nativePanMove(e) {
  if (!canvas || !isPanning) return;
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
  if (!canvas || !isPanning) return;
  isPanning = false;
  canvas.selection = true;
  canvas.defaultCursor = 'default';
}

function setupInputHandlers() {
  // --- Advanced event logic from app.js ---
  // Panning
  canvas.on('object:moving', function() { isObjectMoving = true; });
  canvas.on('object:modified', function() { isObjectMoving = false; });

  const upperEl = canvas.upperCanvasEl;
  if (upperEl) {
    upperEl.addEventListener('mousedown', nativeStartPan, { passive: false });
    window.addEventListener('mousemove', nativePanMove, { passive: false });
    window.addEventListener('mouseup', nativeEndPan, { passive: false });
    upperEl.addEventListener('auxclick', (e) => { if (e.button === 1) nativeEndPan(e); }, { passive: false });
    window.addEventListener('blur', nativeEndPan);
  }

  // Selection helpers and full-overlap marquee selection
  let selectionStart = null;
  let selectionDragging = false;
  let selectionBase = [];
  let shiftDown = false;
  let mouseDownInfo = null;
  let lastNonEmptySelection = [];
  let _suppressSelectionFilter = false;

  canvas.on('mouse:down', function(opt) {
    const e = opt.e;
    isObjectMoving = false;
    if (e.button === 1 || spaceDown) {
      isPanning = true;
      if (e.button === 1) { e.preventDefault(); e.stopPropagation(); }
      lastPos = { x: e.clientX, y: e.clientY };
      canvas.selection = false;
      canvas.defaultCursor = 'grabbing';
      return;
    }
    if (e.button === 0) {
      const currentActive = canvas.getActiveObjects().slice();
      const prevSel = (currentActive.length === 0 && e.shiftKey && lastNonEmptySelection.length > 0)
        ? lastNonEmptySelection.slice()
        : currentActive;
      mouseDownInfo = {
        target: opt.target || null,
        start: canvas.getPointer(e),
        prevSelection: prevSel,
        shiftAtDown: e.shiftKey
      };
      selectionBase = mouseDownInfo.prevSelection.slice();
    } else {
      mouseDownInfo = null;
      selectionBase = [];
    }
    selectionStart = null;
    selectionDragging = false;
  });

  canvas.on('mouse:move', function(opt) {
    if (!isPanning) {
      if (mouseDownInfo && !selectionDragging && opt.e) {
        const p = canvas.getPointer(opt.e);
        const dx = Math.abs(p.x - mouseDownInfo.start.x);
        const dy = Math.abs(p.y - mouseDownInfo.start.y);
        if (dx > 4 || dy > 4) {
          // Start marquee selection only when clicking on empty space and box selection is allowed
          if (!mouseDownInfo.target && canvas && canvas.allowBoxSelection !== false) {
            selectionStart = mouseDownInfo.start;
            selectionDragging = true;
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
    if (selectionDragging && selectionStart && opt.e) {
      const end = canvas.getPointer(opt.e);
      const x1 = Math.min(selectionStart.x, end.x);
      const y1 = Math.min(selectionStart.y, end.y);
      const x2 = Math.max(selectionStart.x, end.x);
      const y2 = Math.max(selectionStart.y, end.y);
      const contained = [];
      canvas.getObjects().forEach(obj => {
        if (!obj.selectable || !obj.visible) return;
        const br = obj.getBoundingRect(true);
        const objLeft = br.left;
        const objTop = br.top;
        const objRight = br.left + br.width;
        const objBottom = br.top + br.height;
        if (objLeft >= x1 && objTop >= y1 && objRight <= x2 && objBottom <= y2) {
          contained.push(obj);
        }
      });
      const shiftHeldNow = (opt.e && opt.e.shiftKey) || shiftDown;
      if (mouseDownInfo && (mouseDownInfo.shiftAtDown || shiftHeldNow)) {
        const snapBase = (selectionBase && selectionBase.length > 0) ? selectionBase.slice() : (mouseDownInfo.prevSelection ? mouseDownInfo.prevSelection.slice() : []);
        const snapContained = contained.slice();
        setTimeout(() => {
          canvas.selection = true;
          canvas.requestRenderAll();
          const union = [];
          const add = (o) => { if (!union.includes(o)) union.push(o); };
          snapBase.forEach(add);
          snapContained.forEach(add);
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
    selectionStart = null;
    selectionDragging = false;
    selectionBase = [];
    mouseDownInfo = null;
    isObjectMoving = false;
  });

  function filterSelectionByContainment() {
    if (_suppressSelectionFilter) return;
    const gs = canvas._groupSelector;
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

  // Mousewheel scrolling and zoom
  canvas.on('mouse:wheel', function(opt) {
    const e = opt.e;
    if (e.ctrlKey) {
      const delta = e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.max(0.25, Math.min(4, zoom));
      const pointer = canvas.getPointer(e);
      canvas.zoomToPoint(pointer, zoom);
    } else {
      const vpt = canvas.viewportTransform;
      vpt[5] += -e.deltaY;
      canvas.setViewportTransform(vpt);
    }
    e.preventDefault();
    e.stopPropagation();
  });

  // Keyboard shortcuts
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

  // Selection logging
  function getObjectLabel(obj) {
    if (!obj) return 'unknown';
    const idx = canvas.getObjects().indexOf(obj);
    const color = obj.fill || obj.stroke || 'none';
    return `${obj.type || 'obj'}#${idx}(${color})`;
  }
  canvas.on('selection:created', (e) => {
    const objs = canvas.getActiveObjects();
    if (objs && objs.length === 1) {
      const label = getObjectLabel(objs[0]);
      if (window._dbg && window._dbg.log) window._dbg.log('[select] selected ' + label);
    }
    const objsAll = canvas.getActiveObjects();
    if (objsAll && objsAll.length > 0) lastNonEmptySelection = objsAll.slice();
  });
  canvas.on('selection:updated', (e) => {
    const objs = canvas.getActiveObjects();
    if (objs && objs.length === 1) {
      const label = getObjectLabel(objs[0]);
      if (window._dbg && window._dbg.log) window._dbg.log('[select] updated selection ' + label);
    } else if (objs && objs.length > 1) {
      if (window._dbg && window._dbg.log) window._dbg.log('[select] updated group selection (' + objs.length + ' items)');
    }
    const objsAll2 = canvas.getActiveObjects();
    if (objsAll2 && objsAll2.length > 0) lastNonEmptySelection = objsAll2.slice();
  });
}

export function addSvgGroupToCanvas(svgGroup) {
  if (!canvas || !svgGroup) return;

  // Add the group to the canvas
  canvas.add(svgGroup);

  // Calculate the bounding box of the group (ignoring the total SVG size)
  const groupBoundingBox = svgGroup.getBoundingRect(true);

  // Calculate the center of the canvas
  const canvasCenter = {
    x: canvas.getWidth() / 2,
    y: canvas.getHeight() / 2
  };

  // Calculate the offset to center the group
  const offsetX = canvasCenter.x - (groupBoundingBox.left + groupBoundingBox.width / 2);
  const offsetY = canvasCenter.y - (groupBoundingBox.top + groupBoundingBox.height / 2);

  // Adjust the positions of all objects in the group to maintain relative positions
  svgGroup.getObjects().forEach((obj) => {
    obj.left += offsetX;
    obj.top += offsetY;
  });

  // Update the group and render the canvas
  svgGroup.setCoords();
  canvas.requestRenderAll();
}
