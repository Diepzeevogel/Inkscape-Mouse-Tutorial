/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// Animation Durations (milliseconds)
export const ANIMATION_DURATION = {
  HELMET_TARGET_PULSE: 3000,
  TOOLBOX_BOUNCE_UP: 250,
  TOOLBOX_BOUNCE_DOWN: 250,
  BUTTON_PRESS: 100,
  ZOOM_OUT: 1000,
  OWL_WIGGLE_PERIOD: 300,
  ARROW_WIGGLE_PERIOD: 400,
  GEAR_ROTATION_SPEED: 0.03 // degrees per millisecond
};

// Animation Scales
export const ANIMATION_SCALE = {
  TOOLBOX_BOUNCE: 1.2,
  BUTTON_PRESS: 0.8,
  OWL_WIGGLE_DEGREES: 5
};

// Interaction Thresholds (pixels)
export const INTERACTION_THRESHOLD = {
  HELMET_SNAP_DISTANCE: 15,
  DRAG_START_MOVEMENT: 4,
  ARROW_EDGE_MARGIN: 60,
  MACHINE_OFFSET: 1000
};

// Zoom Levels
export const ZOOM = {
  MIN: 0.25,
  MAX: 6,
  DEFAULT: 1,
  REQUIRED_FOR_BUTTON: 2
};

// Layout Positions (relative to canvas)
export const LAYOUT = {
  TOOLBOX_X_RATIO: 0.4,
  TOOLBOX_Y_OFFSET: -80,
  TOOL_CIRCLE_RADIUS_MULTIPLIER: 0.8,
  TOOL_CIRCLE_OFFSET: 60,
  MACHINE_ZOOM_PADDING: 100
};

// Visual Styles
export const STYLE = {
  ARROW_COLOR: '#1976d2',
  ARROW_SIZE: 20,
  PRIMARY_COLOR: '#1976d2',
  BUTTON_BORDER_RADIUS: '32px'
};

// Tutorial Asset Paths
export const ASSETS = {
  LESSON_1_SVG: 'assets/tutorials/les1.svg',
  LESSON_2_SVG: 'assets/tutorials/les2.svg',
  LESSON_3_SVG: 'assets/tutorials/les3.svg',
  LESSON_4_SVG: 'assets/tutorials/les4.svg'
};

// SVG Element IDs
export const SVG_IDS = {
  LESSON_1: {
    OWL: ['Owl'],
    HELMET: ['Helmet'],
    HELMET_TARGET: ['Helmet_Target'],
    OWL_WITH_HELMET: ['Owl_with_Helmet']
  },
  LESSON_2: {
    TOOLBOX: 'Toolbox',
    WRENCH: 'Wrench',
    SCREWDRIVER: 'Screwdriver',
    SAW: 'Saw',
    PENCIL: 'Pencil',
    HAMMER: 'Hammer'
  },
  LESSON_3: {
    MACHINE_LAYER: 'Layer_2',
    BULB_ON: 'bulb_on',
    BULB_OFF: 'bulb_off',
    START_BUTTON: 'start',
    MAIN: 'main',
    GEAR: 'gear'
  },
  LESSON_4: {
    SCREWDRIVER: 'Screwdriver',
    HANDLE: 'Handle',
    TOP: 'Top'
  }
};

// Color Palette (from MaakBib palette)
export const COLOR_PALETTE = [
  { r: 255, g: 0, b: 0, name: 'Snijden' },
  { r: 0, g: 0, b: 255, name: 'Graveren' },
  { r: 0, g: 0, b: 0, name: 'Rasteren' },
  { r: 234, g: 77, b: 100, name: 'Maakbib Rood 1' },
  { r: 190, g: 32, b: 51, name: 'Maakbib Rood 2' },
  { r: 255, g: 245, b: 223, name: 'Maakbib Geel 1' },
  { r: 255, g: 232, b: 174, name: 'Maakbib Geel 2' },
  { r: 250, g: 180, b: 0, name: 'Maakbib Geel 3' },
  { r: 203, g: 146, b: 49, name: 'Maakbib Geel 4' },
  { r: 180, g: 132, b: 49, name: 'Maakbib Geel 5' },
  { r: 234, g: 102, b: 19, name: 'Maakbib Geel 6' },
  { r: 184, g: 133, b: 104, name: 'Maakbib Bruin' },
  { r: 159, g: 213, b: 220, name: 'Maakbib Blauw 1' },
  { r: 98, g: 155, b: 211, name: 'Maakbib Blauw 2' },
  { r: 82, g: 132, b: 196, name: 'Maakbib Blauw 3' },
  { r: 0, g: 97, b: 156, name: 'Maakbib Blauw 4' },
  { r: 52, g: 96, b: 127, name: 'Maakbib Blauw 5' },
  { r: 38, g: 50, b: 56, name: 'Maakbib Blauw 6' },
  { r: 59, g: 55, b: 52, name: 'Maakbib Grijs' },
  { r: 175, g: 175, b: 175, name: 'Maakbib Grijs 2' }
];

// Inkscape Transform Mode Constants
export const TRANSFORM_MODE = {
  // Icon Configuration
  ICON_SIZE: 16,
  HANDLE_SIZE: 24,
  
  // Visual Styling
  BORDER_COLOR: '#5F5FD7',
  CORNER_COLOR: '#000000',
  BORDER_SCALE_FACTOR: 0.3,
  BORDER_DASH_ARRAY: [5, 5],
  
  // Selection Colors
  SELECTION_BACKGROUND: 'rgba(95, 95, 215, 0.05)',
  SELECTION_BORDER_COLOR: '#5F5FD7',
  SELECTION_LINE_WIDTH: 1,
  
  // Interaction Thresholds
  DRAG_THRESHOLD: 5,
  
  // Asset Paths
  ICON_SCALE_HANDLE: 'assets/icons/transform/arrow-scale-handle.svg',
  ICON_ROTATE_HANDLE: 'assets/icons/transform/arrow-rotate-handle.svg'
};

// Lesson Feature Flags
export const LESSON_FEATURES = {
  1: {
    COPY_PASTE: false
  },
  2: {
    COPY_PASTE: false
  },
  3: {
    COPY_PASTE: false
  },
  4: {
    COPY_PASTE: true
  }
};
