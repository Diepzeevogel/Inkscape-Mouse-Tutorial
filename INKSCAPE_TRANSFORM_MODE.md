# Inkscape-like Transform Mode

This module implements Inkscape's distinctive two-mode transformation behavior in Fabric.js.

## How It Works

### User Interaction Flow

1. **First Click on Object** → **Scale Mode**
   - Object is selected
   - Shows 8 resize handles (4 corners + 4 edges)
   - Rotation handle is hidden
   - Blue border (`#0096fd`)
   - User can resize/scale the object

2. **Second Click on Same Object** → **Rotate Mode**
   - Toggles to rotation mode
   - Shows 4 corner handles + rotation handle (mtr)
   - Edge handles are hidden
   - Green dashed border (`#00d455`)
   - User can rotate the object

3. **Third Click** → Back to Scale Mode (toggles)

### Visual Feedback

| Mode | Border Color | Border Style | Visible Controls |
|------|-------------|--------------|------------------|
| **Scale** | Blue (#0096fd) | Solid | 8 handles (corners + edges) + NO rotation |
| **Rotate** | Green (#00d455) | Dashed (5,5) | 4 corner handles + rotation handle |

## Usage

### Automatic Activation

The transform mode is **automatically enabled** when you call `initCanvas()`:

```javascript
import { initCanvas } from './canvas.js';

// This automatically enables Inkscape-like transform behavior
const canvas = initCanvas('c');
```

### Manual Control (for Tutorials)

You can manually force an object into a specific mode:

```javascript
import { forceScaleMode, forceRotateMode, getCurrentMode, TRANSFORM_MODE } from './canvas.js';

// Force an object to scale mode
forceScaleMode(myObject, canvas);

// Force an object to rotate mode
forceRotateMode(myObject, canvas);

// Check current mode
const mode = getCurrentMode(myObject);
if (mode === TRANSFORM_MODE.SCALE) {
  console.log('Object is in scale mode');
} else if (mode === TRANSFORM_MODE.ROTATE) {
  console.log('Object is in rotate mode');
}
```

### Disabling the Behavior

If you need to disable the behavior (e.g., for specific tutorial lessons):

```javascript
import { enableInkscapeTransformMode } from './InkscapeTransformMode.js';

// Enable and get cleanup function
const cleanup = enableInkscapeTransformMode(canvas);

// Later, disable it
cleanup();
```

## Implementation Details

### Event Listeners

The module listens to:
- `selection:created` - Sets initial scale mode
- `selection:updated` - Resets to scale mode for new selections
- `selection:cleared` - Clears tracking state
- `mouse:down` - Detects clicks on already-selected objects to toggle mode

### State Tracking

- Uses `WeakMap` to store mode state per object (memory efficient)
- Tracks currently selected object to detect re-clicks
- Modes: `'scale'` or `'rotate'`

## Customization

### Changing Colors

Edit `/src/InkscapeTransformMode.js`:

```javascript
// In setScaleMode():
obj.set({
  borderColor: '#YOUR_COLOR',
  cornerColor: '#YOUR_COLOR',
  // ...
});

// In setRotateMode():
obj.set({
  borderColor: '#YOUR_COLOR',
  cornerColor: '#YOUR_COLOR',
  // ...
});
```

### Using Custom Handle Graphics

To use Inkscape's original UI graphics for handles, you'll need to:

1. Add SVG/PNG files to `/assets/icons/`
2. Create custom Fabric.js control renderers
3. Override default controls in `InkscapeTransformMode.js`

Example:
```javascript
// Custom rotation handle with image
fabric.Object.prototype.controls.mtr = new fabric.Control({
  x: 0,
  y: -0.5,
  offsetY: -40,
  cursorStyle: 'crosshair',
  actionHandler: fabric.controlsUtils.rotationWithSnapping,
  render: function(ctx, left, top, styleOverride, fabricObject) {
    // Custom rendering with your Inkscape graphics
    // Load and draw your SVG/image here
  }
});
```

## Tutorial-Specific Usage

### Lesson 1: Teaching Scale First
```javascript
// After object selection
forceScaleMode(selectedObject, canvas);
// Optionally disable mode toggling temporarily
```

### Lesson 2: Teaching Rotation
```javascript
// Start in rotate mode
forceRotateMode(selectedObject, canvas);
```

## Benefits

1. **Authentic Inkscape Experience** - Users learn actual Inkscape behavior
2. **Reduced Clutter** - Only shows relevant controls for current task
3. **Clear Visual Feedback** - Different colors/styles indicate mode
4. **Prevents Accidents** - Can't accidentally rotate when trying to scale
5. **Per-Pixel Selection** - Objects must be clicked on their actual stroke/fill, not just their bounding box

## Per-Pixel Selection

The canvas is configured with `perPixelTargetFind: true` for authentic Inkscape selection behavior:

- **Unfilled objects**: Must click directly on the stroke (outline)
- **Filled objects**: Can click anywhere on the fill or stroke
- **Tolerance**: 4px around strokes for easier clicking
- **Behavior**: Mimics Inkscape's precise selection model

This makes the tutorial more realistic for Inkscape users, as they learn that empty shapes require clicking on the actual path.

## Future Enhancements

- [x] Add custom Inkscape-style handle graphics
- [x] Per-pixel selection for authentic behavior
- [ ] Show rotation center point indicator
- [ ] Add keyboard shortcut to toggle modes (e.g., 'R' for rotate)
- [ ] Tutorial tooltips explaining mode switch
- [ ] Sound feedback on mode change
