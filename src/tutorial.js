import { canvas } from './canvas.js';
import { rectsOverlap, findGroupFragments, makeFabricGroupFromFragment } from './utils.js';
import { startLesson1 as startLesson1Refactored, restartLesson1, cleanupLesson1 } from './Lesson1Refactored.js';
import { startLesson2 as startLesson2Refactored, restartLesson2, cleanupLesson2 } from './Lesson2Refactored.js';
import { startLesson3 as startLesson3Refactored, restartLesson3, cleanupLesson3 } from './Lesson3Refactored.js';

let tutorialStarted = false;
let tutorialInitializing = false;
let tutorialObjects = { owl: null, helmet: null, helmetTarget: null, owlWithHelmet: null, helmetAnimId: null, machine: null, machineBulb: null, machineArrowAnim: null };

/**
 * Clean up all lessons to ensure clean state when switching between them
 */
function cleanupAllLessons() {
  try {
    cleanupLesson1();
  } catch (e) {
    console.warn('[Tutorial] Error cleaning up Lesson 1:', e);
  }
  try {
    cleanupLesson2();
  } catch (e) {
    console.warn('[Tutorial] Error cleaning up Lesson 2:', e);
  }
  try {
    cleanupLesson3();
  } catch (e) {
    console.warn('[Tutorial] Error cleaning up Lesson 3:', e);
  }
}

export async function startTutorial() {
  // Use refactored version
  cleanupAllLessons();
  return startLesson1Refactored();
}

// Keep original implementation as fallback
export async function startTutorialOriginal() {
  if (tutorialStarted) return;
  tutorialStarted = true;
  // reflect current lesson in the URL
  try { history.replaceState(null, '', '#lesson=1'); } catch (e) {}

  // Update page title and toolbar for Lesson 1
  try {
    document.title = 'Inkscape Les 1: Selecteren en slepen';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      // rebuild brand content keeping the logo image
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 1: Selecteren en slepen'));
    }
  } catch (err) { /* ignore DOM errors in non-browser env */ }

  // Ensure aside panel shows Lesson 1 instructions when preparing/starting
  try {
    const panel = document.getElementById('panel');
    if (panel) {
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
    }
  } catch (err) { /* ignore DOM errors in non-browser env */ }
  const url = 'assets/tutorials/les1.svg';
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
    // mark for tutorial identification so other startup flows can detect it
    try { owlWithHelmetGroup.tutorialId = 'Owl_with_Helmet'; } catch (e) {}
    tutorialObjects.owlWithHelmet = owlWithHelmetGroup;
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

// Reset tutorial state and restart lesson 1 without overlays
export async function startTutorialDirect() {
  // Use refactored version
  cleanupAllLessons();
  return restartLesson1();
}

// Keep original implementation as fallback
export async function startTutorialDirectOriginal() {
  if (tutorialInitializing) return;
  tutorialInitializing = true;
  // Stop any running animations
  try {
    if (tutorialObjects && tutorialObjects.helmetAnimId) {
      try { cancelAnimationFrame(tutorialObjects.helmetAnimId); } catch (e) {}
      tutorialObjects.helmetAnimId = null;
    }
  } catch (e) {}

  // Remove any tutorial-specific event handlers to avoid duplicates
  try {
    if (canvas) {
      canvas.off('object:moving');
      canvas.off('mouse:up');
      // remove all objects
      const objs = canvas.getObjects().slice();
      objs.forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  } catch (e) {}

  // Reset flag and start normally
  tutorialStarted = false;
  await startTutorial();
  tutorialInitializing = false;
}

// Panel instructions are now set in index.html

// --- Second tutorial: shift-select and drag to toolbox ---
export async function startSecondTutorial() {
  // Use refactored version
  cleanupAllLessons();
  return startLesson2Refactored();
}

// Keep original implementation as fallback
export async function startSecondTutorialOriginal() {
  // Disable marquee box-selection so user must Shift+click to multi-select
  if (canvas) {
    canvas.selection = true; // keep selection enabled so shift-click works
    canvas.allowBoxSelection = false; // but disable box (marquee) selection
  }
  // reflect current lesson in the URL (use location.hash so hashchange fires and UI updates)
  try { location.hash = 'lesson=2'; } catch (e) {}

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

  const url = 'assets/tutorials/les2.svg';
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
              // proceed to next tutorial
              try { startThirdTutorial(); } catch (e) { console.info('[tutorial] next -> lesson3', e); }
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

      // Animate toolbox: bounce scale to 1.1 and back twice over 1000ms total
      const tb = tutorialObjects.toolbox;
      if (tb) {
        const baseScaleX = tb.scaleX || 1;
        const baseScaleY = tb.scaleY || 1;
        const targetScaleX = baseScaleX * 1.1;
        const targetScaleY = baseScaleY * 1.1;
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

export async function prepareLesson2State() {
  // Ensure the Owl_with_Helmet (end state of lesson 1) is present on the canvas.
  try {
    // Also ensure the aside panel shows Lesson 2 instructions when preparing state
    try {
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
    } catch (err) { /* ignore DOM errors */ }

    // If the owl-with-helmet is already present, keep it (preserve position)
    const exists = canvas.getObjects().some(o => o && o.tutorialId === 'Owl_with_Helmet');
    if (exists) return;

    const url = 'assets/tutorials/les1.svg';
    const found = await findGroupFragments(url, ['Owl_with_Helmet']);
    const frag = found['Owl_with_Helmet'];
    if (!frag) return;
    const g = await makeFabricGroupFromFragment(frag);
    if (!g) return;
    g.set({ selectable: false, evented: false, visible: true });
    try { g.tutorialId = 'Owl_with_Helmet'; } catch (e) {}
    tutorialObjects.owlWithHelmet = g;
    canvas.add(g);
    g.setCoords();
    canvas.requestRenderAll();
  } catch (err) {
    console.error('[tutorial] prepareLesson2State error:', err);
  }
}

// --- Third tutorial: Maker Machine spawn off-canvas and arrow indicator ---
export async function startThirdTutorial() {
  // Use refactored version
  cleanupAllLessons();
  return startLesson3Refactored();
}

// Keep original implementation as fallback
export async function startThirdTutorialOriginal() {
  // reflect current lesson in the URL
  try { location.hash = 'lesson=3'; } catch (e) {}

  // Update page title and toolbar for Lesson 3
  try {
    document.title = 'Inkscape Les 3: Pannen en zoomen';
    const brand = document.querySelector('#toolbar .brand');
    if (brand) {
      const img = brand.querySelector('img');
      brand.innerHTML = '';
      if (img) brand.appendChild(img);
      brand.appendChild(document.createTextNode(' Inkscape Les 3: Pannen en zoomen'));
    }
    const panel = document.getElementById('panel');
    if (panel) {
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
    }
  } catch (err) {
    // ignore DOM errors in non-browser environments
  }

  // avoid duplicate starts
  if (tutorialObjects.machine && canvas.getObjects().includes(tutorialObjects.machine)) return;

  // ensure helper objects (owl with helmet, toolbox) are present
  try { await ensureLesson3Helpers(); } catch (e) { console.warn('[tutorial] ensureLesson3Helpers error', e); }

  const url = 'assets/tutorials/les3.svg';
  const ids = ['Layer_2']; // Main machine layer containing Bulb_Off, Bulb_On, Main, and Start
  const found = await findGroupFragments(url, ids);
  const frag = found['Layer_2'];
  if (!frag) {
    console.warn('[tutorial] Layer_2 fragment not found in', url);
    return;
  }

  const g = await makeFabricGroupFromFragment(frag);
  if (!g) {
    console.warn('[tutorial] Could not create fabric group for Layer_2');
    return;
  }
  
  // Disable object caching to prevent fuzzy rendering when zoomed in
  function disableCaching(group) {
    if (!group) return;
    group.objectCaching = false;
    if (group.getObjects) {
      group.getObjects().forEach(obj => {
        obj.objectCaching = false;
        if (obj.getObjects) {
          disableCaching(obj);
        }
      });
    }
  }
  disableCaching(g);

  // place machine at center + offset (offset controlled via `targetOffset` below)
  const centerX = canvas.getWidth() / 2;
  const centerY = canvas.getHeight() / 2;
  const targetOffset = 1000; // change this value to 1000 when you want it far off-canvas
  g.set({ 
    selectable: false, 
    evented: true, 
    visible: true, 
    hoverCursor: 'default',
    subTargetCheck: true  // Allow interaction with individual children (like Start button)
  });
  canvas.add(g);
  g.setCoords();
  // bounding rect before moving
  const br = g.getBoundingRect(true);
  const targetCenterX = centerX + targetOffset;
  const desiredLeft = targetCenterX - br.width / 2;
  const desiredTop = centerY - br.height / 2;
  // compute delta for moving the machine
  const deltaX = desiredLeft - br.left;
  const deltaY = desiredTop - br.top;
  // move the group by setting its left/top (don't mutate child coordinates)
  g.left = g.left + deltaX;
  g.top = g.top + deltaY;
  g.setCoords();
  
  // Find and hide the Bulb_On group that's inside the Machine group
  // We'll keep a reference to it so we can toggle it visible later
  let bulbChild = null;
  let hiddenBulbCount = 0;
  
  function hideAllBulbOnObjects(group, depth = 0) {
    if (!group || !group.getObjects) return;
    const objs = group.getObjects();
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      // Fabric.js stores SVG id in various ways - check all possible properties
      const objId = obj.id || obj.svgId || obj.data?.id;
      const objIdLower = objId ? String(objId).toLowerCase() : '';
      
      // Hide ALL objects with Bulb_On id (Fabric flattens <g> into individual paths)
      // Keep Bulb_Off visible
      if (objIdLower === 'bulb_on' || objIdLower === 'bulb_x5f_on') {
        obj.visible = false;
        obj.dirty = true;
        hiddenBulbCount++;
        
        // Store reference to first Bulb_On object for later reveal
        if (!bulbChild) {
          bulbChild = obj;
        }
      }
      
      // Recursively search in nested groups
      if (obj.type === 'group' && obj.getObjects) {
        hideAllBulbOnObjects(obj, depth + 1);
      }
    }
  }
  
  hideAllBulbOnObjects(g);
  
  // Disable events on all "Main" objects to prevent cursor change
  function disableMainObjects(group) {
    if (!group || !group.getObjects) return;
    const objs = group.getObjects();
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const objId = obj.id || obj.svgId || obj.data?.id;
      const objIdLower = objId ? String(objId).toLowerCase() : '';
      
      // Disable events on all "Main" objects (the static machine parts)
      if (objIdLower === 'main') {
        obj.set({ evented: false });
      }
      
      // Recursively process nested groups
      if (obj.type === 'group' && obj.getObjects) {
        disableMainObjects(obj);
      }
    }
  }
  disableMainObjects(g);
  
  // Find and collect all Bulb_Off objects for later toggling
  const bulbOffObjects = [];
  function collectBulbOffObjects(group) {
    if (!group || !group.getObjects) return;
    const objs = group.getObjects();
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const objId = obj.id || obj.svgId || obj.data?.id;
      const objIdLower = objId ? String(objId).toLowerCase() : '';
      
      // Collect all Bulb_Off objects
      if (objIdLower === 'bulb_off' || objIdLower === 'bulb_x5f_off') {
        bulbOffObjects.push(obj);
      }
      
      // Recursively search in nested groups
      if (obj.type === 'group' && obj.getObjects) {
        collectBulbOffObjects(obj);
      }
    }
  }
  collectBulbOffObjects(g);
  
  // Find and collect all Gear objects for rotation animation
  const gearObjects = [];
  function collectGearObjects(group, depth = 0) {
    if (!group || !group.getObjects) return;
    const objs = group.getObjects();
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const objId = obj.id || obj.svgId || obj.data?.id;
      const objIdLower = objId ? String(objId).toLowerCase() : '';
      
      // Collect all Gear objects (Gear, Gear1, Gear2, Gear3, Gear4)
      // These are groups containing multiple elements that should rotate together
      if (objIdLower && (objIdLower === 'gear' || objIdLower.match(/^gear\d*$/))) {
        // Get bounding rect before changing origin
        const rect = obj.getBoundingRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Set origin to center for proper rotation and adjust position to compensate
        obj.set({ 
          originX: 'center', 
          originY: 'center',
          left: centerX,
          top: centerY
        });
        obj.setCoords();
        
        gearObjects.push(obj);
      }
      
      // Recursively search in nested groups
      if (obj.type === 'group' && obj.getObjects) {
        collectGearObjects(obj, depth + 1);
      }
    }
  }
  collectGearObjects(g);
  console.log('[tutorial] Found', gearObjects.length, 'gear groups');
  
  // Animation state for gears
  let gearsAnimating = false;
  let gearAnimationFrame = null;
  
  function startGearRotation() {
    if (gearsAnimating) return; // Already animating
    gearsAnimating = true;
    
    const startTime = performance.now();
    
    function animateGears(now) {
      if (!gearsAnimating) return;
      
      const elapsed = now - startTime;
      
      // Rotate all gears at the same speed in the same direction
      const speed = 0.03; // Degrees per millisecond
      const rotation = (elapsed * speed) % 360;
      
      gearObjects.forEach((gear) => {
        gear.set({ angle: rotation });
        gear.setCoords();
      });
      
      canvas.requestRenderAll();
      gearAnimationFrame = fabric.util.requestAnimFrame(animateGears);
    }
    
    gearAnimationFrame = fabric.util.requestAnimFrame(animateGears);
  }
  
  function stopGearRotation() {
    gearsAnimating = false;
    if (gearAnimationFrame) {
      fabric.util.cancelAnimFrame(gearAnimationFrame);
      gearAnimationFrame = null;
    }
  }
  
  // Store references for cleanup
  tutorialObjects.startGearRotation = startGearRotation;
  tutorialObjects.stopGearRotation = stopGearRotation;
  
  // Find the 'Start' object and make it clickable to toggle the bulbs
  function findAndSetupStartButton(group) {
    if (!group || !group.getObjects) return null;
    const objs = group.getObjects();
    
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const objId = obj.id || obj.svgId || obj.data?.id;
      const objIdLower = objId ? String(objId).toLowerCase() : '';
      
      // Check if this is the Start object
      if (objIdLower === 'start' || objIdLower === 'start_x5f_button' || objIdLower === 'startbutton') {
        return obj;
      }
      
      // Recursively search in nested groups
      if (obj.type === 'group' && obj.getObjects) {
        const found = findAndSetupStartButton(obj);
        if (found) return found;
      }
    }
    return null;
  }
  
  const startButton = findAndSetupStartButton(g);
  if (startButton) {
    // Button starts as non-clickable - user must zoom in first
    const MAX_ZOOM = 6; // defined in canvas.js
    const REQUIRED_ZOOM = MAX_ZOOM * 0.5; // 50% of max = 3
    let buttonEnabled = false;
    
    // Keep evented:true always so we can detect hover, but control cursor and click behavior
    // Also set perPixelTargetFind to ensure accurate hit detection for the circle
    startButton.set({ 
      selectable: false, 
      evented: true, 
      hoverCursor: 'default',
      perPixelTargetFind: true,
      targetFindTolerance: 5
    });
    
    // Click handler for when button becomes enabled
    const toggleBulbs = function(e) {
      if (!buttonEnabled) {
        return;
      }
      
      // Animate the button click - scale down and back up
      const originalScaleX = startButton.scaleX || 1;
      const originalScaleY = startButton.scaleY || 1;
      
      startButton.animate('scaleX', originalScaleX * 0.8, {
        duration: 100,
        onChange: canvas.requestRenderAll.bind(canvas),
        onComplete: function() {
          startButton.animate('scaleX', originalScaleX, {
            duration: 100,
            onChange: canvas.requestRenderAll.bind(canvas)
          });
        }
      });
      
      startButton.animate('scaleY', originalScaleY * 0.8, {
        duration: 100,
        onChange: canvas.requestRenderAll.bind(canvas),
        onComplete: function() {
          startButton.animate('scaleY', originalScaleY, {
            duration: 100,
            onChange: canvas.requestRenderAll.bind(canvas)
          });
        }
      });
      
      // Hide all Bulb_Off objects
      bulbOffObjects.forEach(obj => {
        obj.visible = false;
        obj.dirty = true;
      });
      
      // Show all Bulb_On objects (reverse the hiding we did earlier)
      function showAllBulbOnObjects(group) {
        if (!group || !group.getObjects) return;
        const objs = group.getObjects();
        for (let i = 0; i < objs.length; i++) {
          const obj = objs[i];
          const objId = obj.id || obj.svgId || obj.data?.id;
          const objIdLower = objId ? String(objId).toLowerCase() : '';
          
          if (objIdLower === 'bulb_on' || objIdLower === 'bulb_x5f_on') {
            obj.visible = true;
            obj.dirty = true;
          }
          
          if (obj.type === 'group' && obj.getObjects) {
            showAllBulbOnObjects(obj);
          }
        }
      }
      showAllBulbOnObjects(g);
      
      // Start gear rotation when bulb turns on
      startGearRotation();
      
      // Bring owl and toolbox to front (above machine)
      const owlWithHelmet = canvas.getObjects().find(o => o.tutorialId === 'Owl_with_Helmet');
      const toolbox = canvas.getObjects().find(o => o.tutorialId === 'Toolbox');
      if (owlWithHelmet) canvas.bringToFront(owlWithHelmet);
      if (toolbox) canvas.bringToFront(toolbox);
      
      // Zoom out to show the whole machine
      const machineBounds = g.getBoundingRect(true);
      const machineCenterX = machineBounds.left + machineBounds.width / 2;
      const machineCenterY = machineBounds.top + machineBounds.height / 2;
      
      // Calculate zoom level to fit machine with some padding
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const padding = 100; // pixels of padding around machine
      const zoomX = (canvasWidth - padding * 2) / machineBounds.width;
      const zoomY = (canvasHeight - padding * 2) / machineBounds.height;
      const targetZoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 1:1
      
      // Calculate positions for owl and toolbox near the machine
      const owlTargetX = machineCenterX;
      const owlTargetY = machineCenterY + machineBounds.height / 4 + 100;
      const toolboxTargetX = machineCenterX + machineBounds.width / 3;
      const toolboxTargetY = machineCenterY + machineBounds.height / 4;
      
      // Animate zoom out and center on machine
      const currentZoom = canvas.getZoom();
      const currentVpt = canvas.viewportTransform;
      const currentCenterX = -currentVpt[4] / currentZoom + canvasWidth / (2 * currentZoom);
      const currentCenterY = -currentVpt[5] / currentZoom + canvasHeight / (2 * currentZoom);
      
      // Store initial positions of owl and toolbox
      const owlStartX = owlWithHelmet ? owlWithHelmet.left : owlTargetX;
      const owlStartY = owlWithHelmet ? owlWithHelmet.top : owlTargetY;
      const toolboxStartX = toolbox ? toolbox.left : toolboxTargetX;
      const toolboxStartY = toolbox ? toolbox.top : toolboxTargetY;
      const owlStartAngle = owlWithHelmet ? (owlWithHelmet.angle || 0) : 0;
      
      // Calculate target viewport transform
      const targetVptX = -(machineCenterX * targetZoom) + canvasWidth / 2;
      const targetVptY = -(machineCenterY * targetZoom) + canvasHeight / 2;
      
      // Set owl rotation origin to center
      if (owlWithHelmet) {
        owlWithHelmet.set({
          originX: 'center',
          originY: 'center'
        });
      }
      
      // Start owl wiggle animation
      let owlWiggleActive = true;
      const owlWiggleStart = performance.now();
      function animateOwlWiggle(now) {
        if (!owlWiggleActive || !owlWithHelmet) return;
        
        const elapsed = now - owlWiggleStart;
        const wiggleAngle = Math.sin(elapsed / 300) * 5; // ±5 degrees wiggle
        owlWithHelmet.set({ angle: owlStartAngle + wiggleAngle });
        owlWithHelmet.setCoords();
        
        if (owlWiggleActive) {
          fabric.util.requestAnimFrame(animateOwlWiggle);
        }
      }
      fabric.util.requestAnimFrame(animateOwlWiggle);
      
      // Smooth zoom and pan animation
      const animDuration = 1000; // 1 second
      const startTime = performance.now();
      
      function animateZoomOut(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / animDuration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const newZoom = currentZoom + (targetZoom - currentZoom) * eased;
        const newVptX = currentVpt[4] + (targetVptX - currentVpt[4]) * eased;
        const newVptY = currentVpt[5] + (targetVptY - currentVpt[5]) * eased;
        
        canvas.setViewportTransform([newZoom, 0, 0, newZoom, newVptX, newVptY]);
        
        // Move owl and toolbox into view
        if (owlWithHelmet) {
          const newOwlX = owlStartX + (owlTargetX - owlStartX) * eased;
          const newOwlY = owlStartY + (owlTargetY - owlStartY) * eased;
          owlWithHelmet.set({ left: newOwlX, top: newOwlY });
          owlWithHelmet.setCoords();
        }
        
        if (toolbox) {
          const newToolboxX = toolboxStartX + (toolboxTargetX - toolboxStartX) * eased;
          const newToolboxY = toolboxStartY + (toolboxTargetY - toolboxStartY) * eased;
          toolbox.set({ left: newToolboxX, top: newToolboxY });
          toolbox.setCoords();
        }
        
        canvas.requestRenderAll();
        
        if (progress < 1) {
          fabric.util.requestAnimFrame(animateZoomOut);
        } else {
          // Update side panel with completion message
          try {
            const panel = document.getElementById('panel');
            if (panel) {
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
            }
          } catch (err) {
            // ignore DOM errors
          }
        }
      }
      
      fabric.util.requestAnimFrame(animateZoomOut);
      
      canvas.requestRenderAll();
    };
    
    startButton.on('mousedown', toggleBulbs);
    
    // Monitor zoom level and enable button when zoomed in enough
    const checkZoomLevel = function() {
      const currentZoom = canvas.getZoom();
      if (currentZoom >= REQUIRED_ZOOM && !buttonEnabled) {
        startButton.set({ hoverCursor: 'pointer' });
        buttonEnabled = true;
        canvas.requestRenderAll();
      } else if (currentZoom < REQUIRED_ZOOM && buttonEnabled) {
        startButton.set({ hoverCursor: 'default' });
        buttonEnabled = false;
        canvas.requestRenderAll();
      }
    };
    
    // Check zoom on mouse wheel and other zoom events
    canvas.on('mouse:wheel', checkZoomLevel);
    canvas.on('after:render', checkZoomLevel);
    
    // Initial check
    checkZoomLevel();
  } else {
    console.warn('[tutorial] Could not find Start button in Machine group');
  }
  
  canvas.requestRenderAll();
  try { g.tutorialId = 'MakerMachine'; } catch (e) {}
  tutorialObjects.machine = g;
  tutorialObjects.machineBulb = bulbChild; // store reference to the bulb inside the machine

  // Create an arrow that points toward the machine from the edge of the visible canvas
  // The arrow follows the user as they pan, always staying at the edge pointing to the machine
  const arrowSize = 20;
  const EDGE_MARGIN = 60; // Distance from canvas edge (increased for better visibility)
  const tri = new fabric.Triangle({ 
    width: arrowSize, 
    height: arrowSize, 
    fill: '#1976d2', 
    left: 0, 
    top: 0, 
    angle: 0, 
    selectable: false, 
    evented: false,
    originX: 'center',
    originY: 'center',
    visible: true
  });
  try { tri.tutorialId = 'MakerMachineArrow'; } catch (e) {}
  canvas.add(tri);
  tri.setCoords();

  // Animation loop
  let start = performance.now();
  let running = true;
  function animateArrow(now) {
    if (!running) return;
    
    // Get viewport center in canvas coordinates
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const viewportCenterX = -vpt[4] / zoom + (canvas.getWidth() / zoom) / 2;
    const viewportCenterY = -vpt[5] / zoom + (canvas.getHeight() / zoom) / 2;
    
    // Get machine center in canvas coordinates
    const mrect = tutorialObjects.machine ? tutorialObjects.machine.getBoundingRect(true) : null;
    if (!mrect) {
      tutorialObjects.machineArrowAnim = fabric.util.requestAnimFrame(animateArrow);
      return;
    }
    
    const machineCenterX = mrect.left + mrect.width / 2;
    const machineCenterY = mrect.top + mrect.height / 2;
    
    // Calculate vector from viewport center to machine center
    const vectorX = machineCenterX - viewportCenterX;
    const vectorY = machineCenterY - viewportCenterY;
    const vectorLength = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
    
    if (vectorLength === 0) {
      // Machine is at viewport center, hide arrow
      tri.visible = false;
      tri.dirty = true;
      canvas.requestRenderAll();
      tutorialObjects.machineArrowAnim = fabric.util.requestAnimFrame(animateArrow);
      return;
    }
    
    // Normalize vector
    const dirX = vectorX / vectorLength;
    const dirY = vectorY / vectorLength;
    
    // Calculate arrow angle (pointing toward machine)
    const angleRad = Math.atan2(dirY, dirX);
    const angleDeg = angleRad * 180 / Math.PI;
    
    // Calculate intersection with viewport edges (in canvas coordinates)
    const viewportWidth = canvas.getWidth() / zoom;
    const viewportHeight = canvas.getHeight() / zoom;
    const viewportLeft = viewportCenterX - viewportWidth / 2;
    const viewportTop = viewportCenterY - viewportHeight / 2;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    
    // Find intersection with viewport edges using parametric line equation
    let intersectX, intersectY;
    const margin = EDGE_MARGIN / zoom;
    
    // Check all four edges and find the nearest intersection
    const intersections = [];
    
    // Right edge
    if (dirX > 0) {
      const t = (viewportRight - margin - viewportCenterX) / dirX;
      const y = viewportCenterY + t * dirY;
      if (y >= viewportTop + margin && y <= viewportBottom - margin) {
        intersections.push({ x: viewportRight - margin, y, t });
      }
    }
    
    // Left edge
    if (dirX < 0) {
      const t = (viewportLeft + margin - viewportCenterX) / dirX;
      const y = viewportCenterY + t * dirY;
      if (y >= viewportTop + margin && y <= viewportBottom - margin) {
        intersections.push({ x: viewportLeft + margin, y, t });
      }
    }
    
    // Bottom edge
    if (dirY > 0) {
      const t = (viewportBottom - margin - viewportCenterY) / dirY;
      const x = viewportCenterX + t * dirX;
      if (x >= viewportLeft + margin && x <= viewportRight - margin) {
        intersections.push({ x, y: viewportBottom - margin, t });
      }
    }
    
    // Top edge
    if (dirY < 0) {
      const t = (viewportTop + margin - viewportCenterY) / dirY;
      const x = viewportCenterX + t * dirX;
      if (x >= viewportLeft + margin && x <= viewportRight - margin) {
        intersections.push({ x, y: viewportTop + margin, t });
      }
    }
    
    // Use the nearest intersection (smallest positive t)
    if (intersections.length > 0) {
      intersections.sort((a, b) => a.t - b.t);
      intersectX = intersections[0].x;
      intersectY = intersections[0].y;
    } else {
      // Fallback: use viewport center
      intersectX = viewportCenterX;
      intersectY = viewportCenterY;
    }
    
    // Add wiggle animation along the direction vector
    const wiggleT = ((now - start) / 400) * Math.PI * 2; // speed
    const wiggleAmount = Math.sin(wiggleT) * 10 / zoom; // wiggle ±10px in canvas coordinates
    intersectX += dirX * wiggleAmount;
    intersectY += dirY * wiggleAmount;
    
    // Check if machine is visible in viewport
    const machineVisible = (
      mrect.left < viewportRight &&
      mrect.left + mrect.width > viewportLeft &&
      mrect.top < viewportBottom &&
      mrect.top + mrect.height > viewportTop
    );
    
    if (machineVisible) {
      // Machine is in view -> hide arrow but keep animating to detect when it leaves view
      tri.visible = false;
      tri.dirty = true;
    } else {
      // Machine is not in view -> show arrow
      tri.visible = true;
      tri.dirty = true;
      
      // Update arrow position and rotation
      tri.set({
        left: intersectX,
        top: intersectY,
        angle: angleDeg + 90 // Triangle points up by default, so add 90 to point in direction
      });
      tri.setCoords();
    }
    
    canvas.requestRenderAll();
    tutorialObjects.machineArrowAnim = fabric.util.requestAnimFrame(animateArrow);
  }
  tutorialObjects.machineArrowAnim = fabric.util.requestAnimFrame(animateArrow);
}

// Ensure lesson 1 owl_with_helmet and lesson 2 toolbox can be spawned for lesson 3
export async function ensureLesson3Helpers() {
  // add Owl_with_Helmet from les1.svg if missing
  try {
    const existsOwl = canvas.getObjects().some(o => o && o.tutorialId === 'Owl_with_Helmet');
    if (!existsOwl) {
      const found1 = await findGroupFragments('assets/tutorials/les1.svg', ['Owl_with_Helmet']);
      const frag = found1['Owl_with_Helmet'];
      if (frag) {
        const g = await makeFabricGroupFromFragment(frag);
        if (g) {
          // Preserve the original coordinates from the SVG (same as lesson 1 behavior)
          g.set({ selectable: false, evented: false, visible: true });
          try { g.tutorialId = 'Owl_with_Helmet'; } catch (e) {}
          canvas.add(g);
          g.setCoords();
        }
      }
    }
  } catch (e) { console.warn('[tutorial] ensureLesson3Helpers owl error', e); }

  // add Toolbox from les2.svg if missing
  try {
    const existsTb = canvas.getObjects().some(o => o && o.tutorialId === 'Toolbox');
    if (!existsTb) {
      const found2 = await findGroupFragments('assets/tutorials/les2.svg', ['Toolbox']);
      const frag2 = found2['Toolbox'];
      if (frag2) {
        const tg = await makeFabricGroupFromFragment(frag2);
        if (tg) {
          tg.set({ selectable: false, evented: false, visible: true });
          try { tg.tutorialId = 'Toolbox'; } catch (e) {}
          // Position toolbox exactly as in startSecondTutorial(): baseX = canvas.getWidth() * 0.4, top = canvas.getHeight()/2 - 80
          const baseX = canvas.getWidth() * 0.4;
          const topY = canvas.getHeight() / 2 - 80;
          canvas.add(tg);
          // center the group around the baseX/topY anchor
          const br = tg.getBoundingRect(true);
          tg.left = baseX;
          tg.top = topY;
          tg.setCoords();
          tutorialObjects.toolbox = tg;
        }
      }
    }
  } catch (e) { console.warn('[tutorial] ensureLesson3Helpers toolbox error', e); }
  canvas.requestRenderAll();
}

