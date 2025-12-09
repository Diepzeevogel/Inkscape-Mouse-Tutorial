// Adapter: Fabric <-> Paper.js for curve-preserving boolean ops
// Uses global `paper` (PaperScope) included via script tag in index.html

let paperScope = null;

function ensurePaper(fabricCanvas) {
  if (paperScope) return paperScope;
  if (typeof paper === 'undefined') throw new Error('Paper.js not loaded');
  paperScope = new paper.PaperScope();

  // Offscreen canvas for Paper to operate on. Size it to Fabric's canvas
  // backing store (accounting for retina scaling) so coordinate spaces match.
  const off = document.createElement('canvas');
  try {
    const rs = fabricCanvas && typeof fabricCanvas.getRetinaScaling === 'function' ? fabricCanvas.getRetinaScaling() : (window.devicePixelRatio || 1);
    const w = fabricCanvas && typeof fabricCanvas.getWidth === 'function' ? fabricCanvas.getWidth() : 1;
    const h = fabricCanvas && typeof fabricCanvas.getHeight === 'function' ? fabricCanvas.getHeight() : 1;
    off.width = Math.max(1, Math.round(w * rs));
    off.height = Math.max(1, Math.round(h * rs));
  } catch (e) {
    off.width = 1;
    off.height = 1;
  }

  paperScope.setup(off);

  // Align Paper's view matrix with Fabric's viewportTransform and retina scaling
  try {
    if (fabricCanvas && fabricCanvas.viewportTransform) {
      const vt = fabricCanvas.viewportTransform; // [a,b,c,d,e,f]
      const rs = fabricCanvas.getRetinaScaling ? fabricCanvas.getRetinaScaling() : (window.devicePixelRatio || 1);
      const a = vt[0] * rs;
      const b = vt[1] * rs;
      const c = vt[2] * rs;
      const d = vt[3] * rs;
      const tx = vt[4] * rs;
      const ty = vt[5] * rs;
      paperScope.view.matrix = new paperScope.Matrix(a, b, c, d, tx, ty);
    }
  } catch (e) {
    // ignore
  }

  return paperScope;
}

function transformPointUsingCanvas(obj, x, y, canvas) {
  // Combined transform: viewportTransform * object.calcTransformMatrix()
  // Map a point from object-local coordinates to canvas coordinates.
  // Note: do NOT include canvas.viewportTransform here — we want coordinates
  // in canvas space (device-independent) so Paper.js operations align with Fabric's
  // object positions correctly. Including viewportTransform caused offsets
  // when Fabric applies viewport transforms at render time.
  const objMatrix = obj.calcTransformMatrix();
  const pt = new fabric.Point(x, y);
  const transformed = fabric.util.transformPoint(pt, objMatrix);
  return { x: transformed.x, y: transformed.y };
}

function fabricPathToPaperPath(obj, canvas) {
  const ps = ensurePaper(canvas);
  const Path = ps.Path;
  const Point = ps.Point;

  const p = new Path();
  p.closed = false;

  if (!obj.path || !Array.isArray(obj.path)) return null;

  let prevPoint = null;

  for (let i = 0; i < obj.path.length; i++) {
    const cmd = obj.path[i];
    const type = cmd[0];
    if (type === 'M') {
      const pt = transformPointUsingCanvas(obj, cmd[1], cmd[2], canvas);
      p.add(new ps.Segment(new Point(pt.x, pt.y)));
      prevPoint = { x: pt.x, y: pt.y };
    } else if (type === 'L') {
      const pt = transformPointUsingCanvas(obj, cmd[1], cmd[2], canvas);
      p.add(new ps.Segment(new Point(pt.x, pt.y)));
      prevPoint = { x: pt.x, y: pt.y };
    } else if (type === 'C') {
      // ['C', x1, y1, x2, y2, x, y]
      const cp1t = transformPointUsingCanvas(obj, cmd[1], cmd[2], canvas);
      const cp2t = transformPointUsingCanvas(obj, cmd[3], cmd[4], canvas);
      const pt = transformPointUsingCanvas(obj, cmd[5], cmd[6], canvas);

      // Ensure there's a previous segment to attach handleOut
      const prev = p.lastSegment;
      if (prev) {
        prev.handleOut = new Point(cp1t.x - prev.point.x, cp1t.y - prev.point.y);
      }

      p.add(new ps.Segment(new Point(pt.x, pt.y), new Point(cp2t.x - pt.x, cp2t.y - pt.y)));
      prevPoint = { x: pt.x, y: pt.y };
    } else if (type === 'Q') {
      // Quadratic -> convert to cubic approximation (exact conversion)
      // ['Q', cx, cy, x, y]
      const cpt = transformPointUsingCanvas(obj, cmd[1], cmd[2], canvas);
      const pt = transformPointUsingCanvas(obj, cmd[3], cmd[4], canvas);

      const prev = p.lastSegment;
      if (!prev) {
        // fallback to simple line
        p.add(new ps.Segment(new Point(pt.x, pt.y)));
        prevPoint = { x: pt.x, y: pt.y };
        continue;
      }

      // Convert quadratic control point to cubic control points
      const cp1x = prev.point.x + (2 / 3) * (cpt.x - prev.point.x);
      const cp1y = prev.point.y + (2 / 3) * (cpt.y - prev.point.y);
      const cp2x = pt.x + (2 / 3) * (cpt.x - pt.x);
      const cp2y = pt.y + (2 / 3) * (cpt.y - pt.y);

      prev.handleOut = new Point(cp1x - prev.point.x, cp1y - prev.point.y);
      p.add(new ps.Segment(new Point(pt.x, pt.y), new Point(cp2x - pt.x, cp2y - pt.y)));
      prevPoint = { x: pt.x, y: pt.y };
    } else if (type === 'Z' || type === 'z') {
      p.closed = true;
    }
  }

  p.flatten(0); // small cleanup: ensures segment structure is consistent
  return p;
}

function paperPathToFabricPath(paperPath) {
  // Support single Path, CompoundPath, or Group by normalizing to an array of paper.Path items
  const items = [];
  if (paperPath instanceof paper.Path) {
    items.push(paperPath);
  } else if (paperPath instanceof paper.CompoundPath || paperPath instanceof paper.Group) {
    for (let i = 0; i < paperPath.children.length; i++) {
      const child = paperPath.children[i];
      if (child instanceof paper.Path) items.push(child);
    }
  } else if (paperPath.children && paperPath.children.length) {
    for (let i = 0; i < paperPath.children.length; i++) {
      const child = paperPath.children[i];
      if (child instanceof paper.Path) items.push(child);
    }
  }

  if (items.length === 0) return null;

  const combinedPathData = [];

  items.forEach((item) => {
    const segments = item.segments;
    if (!segments || segments.length === 0) return;

    // Start a new subpath
    const first = segments[0].point;
    combinedPathData.push(['M', first.x, first.y]);

    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const cur = segments[i];

      const hasPrevOut = !(prev.handleOut.isZero());
      const hasCurIn = !(cur.handleIn.isZero());

      if (hasPrevOut || hasCurIn) {
        const cp1x = prev.point.x + prev.handleOut.x;
        const cp1y = prev.point.y + prev.handleOut.y;
        const cp2x = cur.point.x + cur.handleIn.x;
        const cp2y = cur.point.y + cur.handleIn.y;
        combinedPathData.push(['C', cp1x, cp1y, cp2x, cp2y, cur.point.x, cur.point.y]);
      } else {
        combinedPathData.push(['L', cur.point.x, cur.point.y]);
      }
    }

    if (item.closed) combinedPathData.push(['Z']);
  });

  if (combinedPathData.length === 0) return null;

  // Compute bounding box (minX,minY,maxX,maxY) of the combined path data
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  combinedPathData.forEach(cmd => {
    const type = cmd[0];
    for (let i = 1; i < cmd.length; i += 2) {
      const x = cmd[i];
      const y = cmd[i + 1];
      if (typeof x === 'number' && typeof y === 'number') {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  });
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxX)) maxX = minX;
  if (!isFinite(maxY)) maxY = minY;

  // Use center-based origin which is more stable with Fabric's transform behavior
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Shift coordinates to be relative to center (cx, cy)
  const localPathData = combinedPathData.map(cmd => {
    const type = cmd[0];
    if (type === 'Z' || type === 'z') return cmd.slice();
    const out = [type];
    for (let i = 1; i < cmd.length; i += 2) {
      const x = cmd[i];
      const y = cmd[i + 1];
      if (typeof x === 'number' && typeof y === 'number') {
        out.push(x - cx, y - cy);
      } else {
        out.push(cmd[i], cmd[i + 1]);
      }
    }
    return out;
  });

  // Create fabric.Path with local coordinates centered at origin (0,0).
  // We'll return the path and the transform target (cx, cy) so the caller
  // can set a precise transformMatrix on the Fabric object.
  const fabricPath = new fabric.Path(localPathData, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top'
  });

  return { fabricPath, tx: cx, ty: cy };
}

export async function doCurveBooleanUnion(canvas) {
  if (!canvas) throw new Error('Canvas required');
  const selected = canvas.getActiveObjects();
  if (!selected || selected.length < 2) return null;

  console.debug('[curveBoolean] Starting union for selection count=', selected.length);
  selected.forEach((o, idx) => {
    try {
      console.debug('[curveBoolean] sel', idx, o.type, 'left', o.left, 'top', o.top, 'angle', o.angle, 'scaleX', o.scaleX, 'scaleY', o.scaleY, 'originX', o.originX, 'originY', o.originY);
    } catch (e) { /* ignore */ }
  });

  const ps = ensurePaper(canvas);

  // Convert first object
  let resultPaperPath = null;
  for (let i = 0; i < selected.length; i++) {
    const obj = selected[i];
    // If polygon type, convert to path via existing helper? We expect path-like objects
    // Ensure we have a fabric.Path-like object for conversion
    let sourceObj = obj;
    if (!obj.path) {
      // Polygons (points)
      if (obj.points && Array.isArray(obj.points)) {
        const pathData = [];
        pathData.push(['M', obj.points[0].x, obj.points[0].y]);
        for (let k = 1; k < obj.points.length; k++) {
          pathData.push(['L', obj.points[k].x, obj.points[k].y]);
        }
        if (obj.type === 'polygon') pathData.push(['Z']);
        sourceObj = new fabric.Path(pathData, {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          originX: obj.originX || 'left',
          originY: obj.originY || 'top'
        });
      } else if (obj.type === 'rect' || (obj.width && obj.height)) {
        // Rectangle -> create path from local rect coordinates respecting origin
        const w = obj.width;
        const h = obj.height;
        // compute origin offsets
        const ox = obj.originX === 'center' ? w / 2 : (obj.originX === 'right' ? w : 0);
        const oy = obj.originY === 'center' ? h / 2 : (obj.originY === 'bottom' ? h : 0);
        const pathData = [
          ['M', -ox, -oy],
          ['L', w - ox, -oy],
          ['L', w - ox, h - oy],
          ['L', -ox, h - oy],
          ['Z']
        ];
        sourceObj = new fabric.Path(pathData, {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          originX: obj.originX || 'left',
          originY: obj.originY || 'top'
        });
      } else {
        // unsupported object type for now
        console.warn('[curveBoolean] Unsupported object type for boolean conversion:', obj.type || obj);
        continue;
      }
    }
    const p = fabricPathToPaperPath(sourceObj, canvas);
    if (!p) continue;
    if (!resultPaperPath) resultPaperPath = p;
    else {
      try {
        const next = p;
        const united = resultPaperPath.unite(next);
        // Clean up previous paths to avoid memory buildup
        resultPaperPath.remove();
        next.remove();
        resultPaperPath = united;
      } catch (err) {
        console.error('Paper boolean error', err);
      }
    }
  }

  if (!resultPaperPath) return null;

  console.debug('[curveBoolean] Paper result type=', resultPaperPath && resultPaperPath.className, 'bounds=', resultPaperPath.bounds);

  // Convert back to Fabric path and get target translation
  const converted = paperPathToFabricPath(resultPaperPath);
  if (!converted || !converted.fabricPath) {
    console.error('[curveBoolean] Failed to convert Paper result to Fabric path');
    return null;
  }

  const out = converted.fabricPath;
  const tx = converted.tx;
  const ty = converted.ty;

  // Copy some visual properties from first object
  const src = selected[0];
  out.set({ fill: src.fill, stroke: src.stroke, strokeWidth: src.strokeWidth, opacity: src.opacity });

  // Prepare preview overlay (semi-transparent) so user can confirm placement
  let preview = null;
  try {
    const previewOpts = {
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      opacity: Math.max(0.25, (src && src.opacity) ? src.opacity * 0.6 : 0.5),
      fill: src && src.fill ? src.fill : 'rgba(0,0,0,0.15)',
      stroke: src && src.stroke ? src.stroke : 'rgba(0,0,0,0.6)',
      strokeWidth: src && src.strokeWidth ? src.strokeWidth : 1
    };
    preview = new fabric.Path(out.path, previewOpts);
    const previewMatrix = [1, 0, 0, 1, tx, ty];
    // Try transformMatrix placement first
    try {
      preview.set({ transformMatrix: previewMatrix });
      preview.setCoords();
    } catch (merr) {
      // fallback to left/top placement
      preview.set({ left: tx, top: ty, originX: 'left', originY: 'top' });
      preview.setCoords();
    }
    // Add preview on top and bring to front
    canvas.add(preview);
    canvas.bringToFront(preview);
    canvas.requestRenderAll();
    canvas._booleanPreview = preview;
    console.debug('[curveBoolean] Preview created at tx,ty', tx, ty);
  } catch (e) {
    console.warn('[curveBoolean] preview creation failed', e);
    preview = null;
  }

  // Ask user to confirm the boolean result placement
  const apply = window.confirm('Preview shown. Apply boolean result?');
  // Remove preview if present
  if (canvas._booleanPreview) {
    try { canvas.remove(canvas._booleanPreview); } catch (e) {}
    delete canvas._booleanPreview;
    canvas.requestRenderAll();
  }
  if (!apply) {
    console.debug('[curveBoolean] User cancelled boolean operation');
    return null;
  }

  // Set an explicit transformMatrix mapping the Fabric object's local coords to
  // Paper/canvas coordinates. This avoids origin/viewport mismatches.
  const matrix = [1, 0, 0, 1, tx, ty];
  out.set({ transformMatrix: matrix, selectable: true });
  out.setCoords();

  console.debug('[curveBoolean] Adding result with transformMatrix=', matrix, 'path len=', out.path && out.path.length);

  // Remove original objects and add new result (preserve insertion index of first selected)
  try {
    const firstIndex = canvas.getObjects().indexOf(selected[0]);
    selected.forEach(o => canvas.remove(o));
    if (firstIndex >= 0) {
      canvas.insertAt(out, Math.max(0, firstIndex), true);
    } else {
      canvas.add(out);
    }
  } catch (err) {
    // fallback
    selected.forEach(o => canvas.remove(o));
    canvas.add(out);
  }

  out.setCoords();
  canvas.setActiveObject(out);
  canvas.requestRenderAll();

  // Cleanup paper scope project items
  try { resultPaperPath.remove(); } catch (e) {}

  return out;
}
