// Simple owner-scoped event registry for DOM and Fabric canvas events
const registrations = [];

function isFabricCanvas(target) {
  return target && typeof target.on === 'function' && typeof target.off === 'function';
}

export function register(target, eventName, handler, owner) {
  if (!target) return;
  if (isFabricCanvas(target)) {
    target.on(eventName, handler);
  } else if (target.addEventListener) {
    target.addEventListener(eventName, handler);
  } else {
    return;
  }
  registrations.push({ target, eventName, handler, owner });
}

export function unregisterAllForOwner(owner) {
  for (let i = registrations.length - 1; i >= 0; --i) {
    const reg = registrations[i];
    if (reg.owner === owner) {
      const { target, eventName, handler } = reg;
      try {
        if (isFabricCanvas(target)) {
          target.off(eventName, handler);
        } else if (target.removeEventListener) {
          target.removeEventListener(eventName, handler);
        }
      } catch (e) {
        // ignore removal errors
      }
      registrations.splice(i, 1);
    }
  }
}

export function removeAll() {
  for (let i = registrations.length - 1; i >= 0; --i) {
    const { target, eventName, handler } = registrations[i];
    try {
      if (isFabricCanvas(target)) {
        target.off(eventName, handler);
      } else if (target.removeEventListener) {
        target.removeEventListener(eventName, handler);
      }
    } catch (e) {
      // ignore
    }
  }
  registrations.length = 0;
}

export function countRegistrations() {
  return registrations.length;
}
