import { canvas } from './canvas.js';
import { rectsOverlap, findGroupFragments, makeFabricGroupFromFragment } from './utils.js';

let tutorialStarted = false;
let tutorialObjects = { owl: null, helmet: null, owlWithHelmet: null };

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
  if (helmetGroup) {
    helmetGroup.set({ selectable: true, evented: true, visible: true });
    canvas.add(helmetGroup);
    console.log('[tutorial] Added Helmet group to canvas:', helmetGroup);
  } else {
    console.warn('[tutorial] Helmet group not added to canvas');
  }
  if (helmetTargetGroup) {
    helmetTargetGroup.set({ selectable: false, evented: false, visible: false });
    canvas.add(helmetTargetGroup);
    console.log('[tutorial] Added Helmet_Target group to canvas (invisible):', helmetTargetGroup);
  } else {
    console.warn('[tutorial] Helmet_Target group not added to canvas');
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
    if (dist < 10) {
      if (owlGroup) canvas.remove(owlGroup);
      if (helmetGroup) canvas.remove(helmetGroup);
      if (helmetTargetGroup) canvas.remove(helmetTargetGroup);
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
              // Placeholder: move to next tutorial logic
              alert('Next tutorial!');
            };
            panel.appendChild(btn);
          }
        }
      }
    }
  });
}

// Panel instructions are now set in index.html

