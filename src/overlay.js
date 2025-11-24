// Overlay module: welcome overlay and select overlay button
export function installWelcomeOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'welcomeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:10000;pointer-events:none';

  const card = document.createElement('div');
  card.className = 'welcome-card';
  card.style.cssText = 'width:640px;max-width:90%;background:white;padding:20px;border-radius:10px;display:flex;gap:16px;align-items:center;pointer-events:auto;position:relative';

  const logo = document.createElement('div');
  logo.innerHTML = '<img src="assets/branding/MaakBib_Logo_LeftRight.svg" alt="logo" style="height:56px">';

  const content = document.createElement('div');
  content.innerHTML = '<h2>Welkom — MaakBib: Inkscape Les 1</h2><p>Klik op de selectie tool <img src="assets/icons/tool-pointer.svg" alt="Select" style="width:24px;height:24px"> om te beginnen.</p>';

  card.appendChild(logo);
  card.appendChild(content);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return overlay;
}

export function createSelectOverlayButton(onClick) {
  const selectToolOverlay = document.createElement('button');
  selectToolOverlay.id = 'selectToolOverlay';
  selectToolOverlay.className = 'tool-btn';
  // Position fixed so the overlay button is aligned to the viewport (not to the welcome card)
  selectToolOverlay.style.cssText = 'position:fixed;top:57px;left:8px;z-index:10001;animation:wiggle 0.5s infinite;width:40px;height:40px;border:1px solid #ccc;background:white;border-radius:4px;box-shadow:0 0 10px rgba(0,123,255,0.8);pointer-events:auto';
  selectToolOverlay.innerHTML = '<img src="assets/icons/tool-pointer.svg" alt="Select" style="width:24px;height:24px">';
  selectToolOverlay.addEventListener('click', onClick);
  return selectToolOverlay;
}
