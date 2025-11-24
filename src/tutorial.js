import { canvas } from './canvas.js';
import { rectsOverlap, findGroupFragments, makeFabricGroupFromFragment } from './utils.js';

let tutorialStarted = false;
let tutorialObjects = { owl: null, helmet: null, helmetTarget: null, owlWithHelmet: null, helmetAnimId: null };

export async function startTutorial() {
  if (tutorialStarted) return;
  tutorialStarted = true;
  const url = 'assets/tutorials/selecteren_en_slepen.svg';
  console.info('[tutorial] fetching SVG fragments for new structure:', url);
  const ids = {
    owl: ['Owl'],
    helmet: ['Helmet'],
    helmetTarget: ['Helmet_Target'],
    owlWithHelmet: ['Owl_with_Helmet']
  };
  const allIds = [...ids.owl, ...ids.helmet, ...ids.helmetTarget, ...ids.owlWithHelmet];
  const found = await findGroupFragments(url, allIds);
  console.log('[tutorial] findGroupFragments result:', found);
  const owlFrag = found['Owl'];
  const helmetFrag = found['Helmet'];
  const helmetTargetFrag = found['Helmet_Target'];
  const owlWithHelmetFrag = found['Owl_with_Helmet'];
  if (!owlFrag) console.warn('[tutorial] Owl fragment not found');
  if (!helmetFrag) console.warn('[tutorial] Helmet fragment not found');
  if (!helmetTargetFrag) console.warn('[tutorial] Helmet_Target fragment not found');
  if (!owlWithHelmetFrag) console.warn('[tutorial] Owl_with_Helmet fragment not found');
  // Log actual SVG fragments
  console.log('[tutorial] SVG fragments:', { owlFrag, helmetFrag, helmetTargetFrag, owlWithHelmetFrag });
  async function logFabricGroup(fragment, label) {
    if (!fragment) return null;
    try {
      const wrapped = `<svg xmlns=\"http://www.w3.org/2000/svg\">${fragment}</svg>`;
      console.log(`[tutorial] Loading ${label} with wrapped SVG:`, wrapped);
      return await makeFabricGroupFromFragment(fragment).then(g => {
        if (!g) console.warn(`[tutorial] Fabric group for ${label} is null`);
        else console.log(`[tutorial] Fabric group for ${label}:`, g);
        return g;
      });
    } catch (err) {
      console.error(`[tutorial] Error loading ${label}:`, err);
      return null;
    }
  }
  const [owlGroup, helmetGroup, helmetTargetGroup, owlWithHelmetGroup] = await Promise.all([
    logFabricGroup(owlFrag, 'Owl'),
    logFabricGroup(helmetFrag, 'Helmet'),
    logFabricGroup(helmetTargetFrag, 'Helmet_Target'),
    logFabricGroup(owlWithHelmetFrag, 'Owl_with_Helmet')
  ]);
  // Show Owl and Helmet, keep Helmet_Target invisible, Owl_with_Helmet hidden
  if (owlGroup) {
    owlGroup.set({ selectable: false, evented: false, visible: true });
    canvas.add(owlGroup);
    console.log('[tutorial] Added Owl group to canvas:', owlGroup);
  } else {
    console.warn('[tutorial] Owl group not added to canvas');
  }
    if (helmetTargetGroup) {
    helmetTargetGroup.set({ selectable: false, evented: false, visible: true, opacity: 0 });
    canvas.add(helmetTargetGroup);
    tutorialObjects.helmetTarget = helmetTargetGroup;
    console.log('[tutorial] Added Helmet_Target group to canvas (visible):', helmetTargetGroup);
    // Start looping opacity animation (0 -> 1 -> 0) over 3 seconds
    (function startHelmetTargetAnimation() {
      const duration = 3000;
      const t0 = performance.now();
      function step() {
        const now = performance.now();
        const t = ((now - t0) % duration) / duration; // 0..1
        const v = 0.5 * (1 - Math.cos(2 * Math.PI * t));
        helmetTargetGroup.opacity = v;
        helmetTargetGroup.setCoords();
        canvas.requestRenderAll();
        tutorialObjects.helmetAnimId = fabric.util.requestAnimFrame(step);
      }
      tutorialObjects.helmetAnimId = fabric.util.requestAnimFrame(step);
    })();
  } else {
    console.warn('[tutorial] Helmet_Target group not added to canvas');
  }
  if (helmetGroup) {
    helmetGroup.set({ selectable: true, evented: true, visible: true });
    canvas.add(helmetGroup);
    console.log('[tutorial] Added Helmet group to canvas:', helmetGroup);
  } else {
    console.warn('[tutorial] Helmet group not added to canvas');
  }
  if (owlWithHelmetGroup) {
    owlWithHelmetGroup.set({ selectable: false, evented: false, visible: false });
    canvas.add(owlWithHelmetGroup);
    console.log('[tutorial] Added Owl_with_Helmet group to canvas (hidden):', owlWithHelmetGroup);
  } else {
    console.warn('[tutorial] Owl_with_Helmet group not added to canvas');
  }
  canvas.requestRenderAll();
  // Success logic: when helmet is moved within 10px of helmetTarget, show Owl_with_Helmet and remove others
  canvas.on('object:moving', function(e) {
    const moved = e.target;
    if (!moved || moved !== helmetGroup || !helmetTargetGroup) return;
    const hb = helmetGroup.getBoundingRect(true);
    const tb = helmetTargetGroup.getBoundingRect(true);
    const dist = Math.sqrt(Math.pow(hb.left - tb.left, 2) + Math.pow(hb.top - tb.top, 2));
    if (dist < 15) {
      if (owlGroup) canvas.remove(owlGroup);
      if (helmetGroup) canvas.remove(helmetGroup);
      if (helmetTargetGroup) {
        // stop animation if running
        if (tutorialObjects.helmetAnimId) {
          try { cancelAnimationFrame(tutorialObjects.helmetAnimId); } catch (e) { }
          tutorialObjects.helmetAnimId = null;
        }
        canvas.remove(helmetTargetGroup);
      }
      if (owlWithHelmetGroup) {
        owlWithHelmetGroup.visible = true;
        owlWithHelmetGroup.setCoords();
        canvas.requestRenderAll();
        // Show next tutorial button in aside panel
        const panel = document.getElementById('panel');
        if (panel) {
          let btn = document.getElementById('next-tutorial-btn');
          if (!btn) {
            btn = document.createElement('button');
            btn.id = 'next-tutorial-btn';
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.height = '64px';
            btn.style.margin = '32px auto 0 auto';
            btn.style.background = '#1976d2';
            btn.style.border = 'none';
            btn.style.borderRadius = '32px';
            btn.style.cursor = 'pointer';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            btn.innerHTML = '<i class="fa-solid fa-arrow-right" style="font-size:2.5em;color:white;"></i>';
            btn.onclick = function() {
              startSecondTutorial();
            };
            panel.appendChild(btn);
          }
        }
      }
    }
  });
}

// Panel instructions are now set in index.html

// --- Second tutorial: shift-select and drag to toolbox ---
async function startSecondTutorial() {
  // Disable marquee box-selection so user must Shift+click to multi-select
  if (canvas) {
    canvas.selection = true; // keep selection enabled so shift-click works
    canvas.allowBoxSelection = false; // but disable box (marquee) selection
  }

  // Update page title and toolbar for Lesson 2
  try {
    document.title = 'Inkscape Les 2: Meerdere objecten selecteren';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      // rebuild brand content keeping the logo image
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 2: Meerdere objecten selecteren'));
    }
    const panel = document.getElementById('panel');
    if (panel) {
      panel.innerHTML = `
        <h3>Opdracht</h3>
        <p>Oh nee! Al het gereedschap is uit de koffer gevallen.</p>
        <p>Steek jij ze er terug in?</p>
        <ol>
          <li>Houd <strong>Shift</strong> ingedrukt en klik op alle gereedschappen om ze te selecteren.</li>
          <li>Als je <strong>al</strong> het gereedschap geselecteerd heb, sleep je het naar de gereedschapskist.</li>
        </ol>
        <p>Probeer het ook met een selectievak. Klik en sleep een rechthoek om meerdere gereedschappen tegelijk te selecteren.</p>
      `;
    }
  } catch (err) {
    // ignore DOM errors in non-browser environments
  }

  const url = 'assets/tutorials/shift_select.svg';
  const ids = ['Toolbox', 'Wrench', 'Screwdriver', 'Saw', 'Pencil', 'Hammer'];
  const found = await findGroupFragments(url, ids);
  const groups = await Promise.all(ids.map(id => makeFabricGroupFromFragment(found[id] || '')));

  // Add all groups; toolbox will be non-selectable. Position other items in a circle around it.
  const added = [];
  const baseX = canvas.getWidth() * 0.4; // approximate right side for toolbox placement
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const g = groups[i];
    if (!g) continue;
    if (id === 'Toolbox') {
      g.set({ selectable: false, evented: false, visible: true });
      // place toolbox near right edge center
      g.left = baseX;
      g.top = canvas.getHeight() / 2 - 80;
      canvas.add(g);
      tutorialObjects.toolbox = g;
      continue;
    }
    g.set({ selectable: true, evented: true, visible: true,
            lockScalingX: true, lockScalingY: true, lockUniScaling: true });
    // add now; final positions will be set in a circle around the toolbox
    canvas.add(g);
    // Hide scaling controls
    if (typeof g.setControlsVisibility === 'function') {
      g.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false, bl:false, br:false, tl:false, tr:false });
    }
    added.push(g);
  }

  // After adding, position added items in a circle around the toolbox group
  if (tutorialObjects.toolbox && added.length > 0) {
    const tbRect = tutorialObjects.toolbox.getBoundingRect(true);
    const cx = tbRect.left + tbRect.width / 2;
    const cy = tbRect.top + tbRect.height / 2;
    const radius = Math.max(tbRect.width, tbRect.height) * 0.8 + 60;
    const n = added.length;
    for (let i = 0; i < n; i++) {
      const obj = added[i];
      const angle = (i / n) * (2 * Math.PI) - Math.PI / 2; // start at top
      const px = cx + radius * Math.cos(angle);
      const py = cy + radius * Math.sin(angle);
      const br = obj.getBoundingRect(true);
      obj.left = px - (br.width / 2);
      obj.top = py - (br.height / 2);
      obj.setCoords();
    }
  }

  canvas.requestRenderAll();

  const totalToSelect = added.length;
  let isDragging = false;
  let completed = false;

  function pointerOverToolbox(e) {
    if (!e || !tutorialObjects.toolbox) return false;
    // use canvas pointer (canvas coordinates) and toolbox bounding rect (canvas coordinates)
    const p = canvas.getPointer(e);
    const br = tutorialObjects.toolbox.getBoundingRect(true);
    if (!br) return false;
    return (p.x >= br.left && p.x <= (br.left + br.width) && p.y >= br.top && p.y <= (br.top + br.height));
  }

  function onObjectMoving(opt) {
    if (completed) return;
    isDragging = true;
    const e = opt && opt.e;
    if (!e) return;
    const active = canvas.getActiveObjects();
    // Only accept when the user has selected exactly the set of added items
    if (!active || active.length !== totalToSelect) return;
    // If pointer is over the canvas toolbox, collect immediately (do not wait for mouseup)
    if (pointerOverToolbox(e)) {
      completed = true;
      const selectedToRemove = active.slice();
      selectedToRemove.forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();

      // Animate toolbox: bounce scale to 1.2 and back twice over 1000ms total
      const tb = tutorialObjects.toolbox;
      if (tb) {
        const baseScaleX = tb.scaleX || 1;
        const baseScaleY = tb.scaleY || 1;
        const targetScaleX = baseScaleX * 1.2;
        const targetScaleY = baseScaleY * 1.2;
        const singleUp = 250;
        const singleDown = 250;
        function bounceOnce(onDone) {
          fabric.util.animate({
            startValue: baseScaleX,
            endValue: targetScaleX,
            duration: singleUp,
            onChange(value) {
              tb.scaleX = value;
              tb.scaleY = baseScaleY * (value / baseScaleX);
              tb.setCoords();
              canvas.requestRenderAll();
            },
            onComplete() {
              fabric.util.animate({
                startValue: targetScaleX,
                endValue: baseScaleX,
                duration: singleDown,
                onChange(value) {
                  tb.scaleX = value;
                  tb.scaleY = baseScaleY * (value / baseScaleX);
                  tb.setCoords();
                  canvas.requestRenderAll();
                },
                onComplete() { if (onDone) onDone(); }
              });
            }
          });
        }
        // when both bounces finish, show the continue button in the side panel
        const showContinue = () => {
          const panel = document.getElementById('panel');
          if (!panel) return;
          let btn = document.getElementById('next-tutorial-btn-2');
          if (!btn) {
            btn = document.createElement('button');
            btn.id = 'next-tutorial-btn-2';
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.height = '64px';
            btn.style.margin = '32px auto 0 auto';
            btn.style.background = '#1976d2';
            btn.style.border = 'none';
            btn.style.borderRadius = '32px';
            btn.style.cursor = 'pointer';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            btn.innerHTML = '<i class="fa-solid fa-arrow-right" style="font-size:2.5em;color:white;"></i>';
            btn.onclick = function() {
              // proceed to next tutorial (placeholder)
              console.info('[tutorial] Continue to next tutorial (button)');
            };
            panel.appendChild(btn);
          }
        };

        bounceOnce(() => { bounceOnce(() => { showContinue(); }); });
      }

      // cleanup event handlers and restore selection behavior
      canvas.off('object:moving', onObjectMoving);
      canvas.off('mouse:up', onMouseUp);
      canvas.selection = true;
      if (canvas) canvas.allowBoxSelection = true;
      console.info('[tutorial] Collected all items into toolbox — moving to next tutorial');
    }
  }

  async function onMouseUp(opt) {
    const e = opt && opt.e;
    if (!isDragging || !e) { isDragging = false; return; }
    const active = canvas.getActiveObjects();
    if (!active || active.length !== totalToSelect) { isDragging = false; return; }
    // check pointer over toolbox area
    if (pointerOverToolbox(e)) {
      // gather selected objects then remove them
      const selectedToRemove = active.slice();
      selectedToRemove.forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();

      // Animate toolbox: bounce scale to 1.2 and back twice over 1000ms total
      const tb = tutorialObjects.toolbox;
      if (tb) {
        const baseScaleX = tb.scaleX || 1;
        const baseScaleY = tb.scaleY || 1;
        const targetScaleX = baseScaleX * 1.2;
        const targetScaleY = baseScaleY * 1.2;
        const singleUp = 250;
        const singleDown = 250;
        // perform one up-down bounce, then repeat once
        function bounceOnce(onDone) {
          // up
          fabric.util.animate({
            startValue: baseScaleX,
            endValue: targetScaleX,
            duration: singleUp,
            onChange(value) {
              tb.scaleX = value;
              tb.scaleY = baseScaleY * (value / baseScaleX);
              tb.setCoords();
              canvas.requestRenderAll();
            },
            onComplete() {
              // down
              fabric.util.animate({
                startValue: targetScaleX,
                endValue: baseScaleX,
                duration: singleDown,
                onChange(value) {
                  tb.scaleX = value;
                  tb.scaleY = baseScaleY * (value / baseScaleX);
                  tb.setCoords();
                  canvas.requestRenderAll();
                },
                onComplete() { if (onDone) onDone(); }
              });
            }
          });
        }

        bounceOnce(() => { bounceOnce(() => { /* done */ }); });
      }

      // cleanup event handlers and restore selection behavior
      canvas.off('object:moving', onObjectMoving);
      canvas.off('mouse:up', onMouseUp);
      canvas.selection = true;
      if (canvas) canvas.allowBoxSelection = true;
      console.info('[tutorial] Collected all items into toolbox — moving to next tutorial');
    }
    isDragging = false;
  }

  canvas.on('object:moving', onObjectMoving);
  canvas.on('mouse:up', onMouseUp);
}

