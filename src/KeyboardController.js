// Centralized keyboard controller with owner-scoped handlers
const _handlers = new Map();
let _started = false;

function _globalKeydown(e) {
  for (const handler of _handlers.values()) {
    try {
      handler(e);
    } catch (err) {
      console.error('[KeyboardController] handler error', err);
    }
  }
}

export const KeyboardController = {
  register(owner, handler) {
    if (!_started) {
      document.addEventListener('keydown', _globalKeydown);
      _started = true;
    }
    _handlers.set(owner, handler);
  },
  unregister(owner) {
    _handlers.delete(owner);
    if (_handlers.size === 0 && _started) {
      document.removeEventListener('keydown', _globalKeydown);
      _started = false;
    }
  },
  unregisterAll() {
    _handlers.clear();
    if (_started) {
      document.removeEventListener('keydown', _globalKeydown);
      _started = false;
    }
  },
};
