// Lightweight metadata registries using WeakMap to avoid mutating Fabric objects
const _pasted = new WeakMap();
const _lockedFromDelete = new WeakMap();
const _lastPos = new WeakMap();

export const Pasted = {
  set: (obj, v = true) => _pasted.set(obj, v),
  get: (obj) => _pasted.get(obj),
  has: (obj) => _pasted.has(obj),
  delete: (obj) => _pasted.delete(obj),
};

export const LockedFromDelete = {
  set: (obj, v = true) => _lockedFromDelete.set(obj, v),
  has: (obj) => _lockedFromDelete.has(obj),
  get: (obj) => _lockedFromDelete.get(obj),
  delete: (obj) => _lockedFromDelete.delete(obj),
};

export const LastPos = {
  set: (obj, pos) => _lastPos.set(obj, pos),
  get: (obj) => _lastPos.get(obj),
  has: (obj) => _lastPos.has(obj),
  delete: (obj) => _lastPos.delete(obj),
};

const _placed = new WeakMap();
export const Placed = {
  set: (obj, v = true) => _placed.set(obj, v),
  has: (obj) => _placed.has(obj),
  get: (obj) => _placed.get(obj),
  delete: (obj) => _placed.delete(obj),
};

// Store previous interactive state (selectable/evented) for transient tool modes
const _prevInteractive = new WeakMap();
export const PrevInteractive = {
  set: (obj, state) => _prevInteractive.set(obj, state),
  get: (obj) => _prevInteractive.get(obj),
  has: (obj) => _prevInteractive.has(obj),
  delete: (obj) => _prevInteractive.delete(obj),
};
