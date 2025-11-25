/**
 * Animation Controller
 * Centralized animation management using Fabric.js animation utilities
 * Eliminates duplication of animation logic across tutorial functions
 */

import { ANIMATION_DURATION, ANIMATION_SCALE } from './constants.js';

export class AnimationController {
  constructor(canvas) {
    this.canvas = canvas;
    this.activeAnimations = new Map(); // Track active animations for cleanup
  }

  /**
   * Pulse animation (opacity oscillation)
   * @param {fabric.Object} target - Object to animate
   * @param {string} animationId - Unique identifier for cleanup
   * @param {number} duration - Full cycle duration in ms
   * @returns {number} Animation frame ID
   */
  startPulseAnimation(target, animationId = 'pulse', duration = ANIMATION_DURATION.HELMET_TARGET_PULSE) {
    const startTime = performance.now();
    
    const animate = () => {
      const now = performance.now();
      const elapsed = (now - startTime) % duration;
      const progress = elapsed / duration; // 0..1
      const opacity = 0.5 * (1 - Math.cos(2 * Math.PI * progress));
      
      target.opacity = opacity;
      target.setCoords();
      
      if (this.canvas) {
        this.canvas.requestRenderAll();
      }
      
      const frameId = fabric.util.requestAnimFrame(animate);
      this.activeAnimations.set(animationId, frameId);
    };
    
    const frameId = fabric.util.requestAnimFrame(animate);
    this.activeAnimations.set(animationId, frameId);
    return frameId;
  }

  /**
   * Bounce animation (scale up and down)
   * @param {fabric.Object} target - Object to animate
   * @param {number} scaleMultiplier - Peak scale (1.0 = no change)
   * @param {Function} onComplete - Callback after animation completes
   */
  bounceAnimation(target, scaleMultiplier = ANIMATION_SCALE.TOOLBOX_BOUNCE, onComplete = null) {
    const baseScaleX = target.scaleX || 1;
    const baseScaleY = target.scaleY || 1;
    const targetScaleX = baseScaleX * scaleMultiplier;
    const targetScaleY = baseScaleY * scaleMultiplier;
    
    // Scale up
    fabric.util.animate({
      startValue: baseScaleX,
      endValue: targetScaleX,
      duration: ANIMATION_DURATION.TOOLBOX_BOUNCE_UP,
      onChange: (value) => {
        if (!this.canvas) return; // Canvas was cleaned up
        target.scaleX = value;
        target.scaleY = baseScaleY * (value / baseScaleX);
        target.setCoords();
        this.canvas.requestRenderAll();
      },
      onComplete: () => {
        // Scale down
        fabric.util.animate({
          startValue: targetScaleX,
          endValue: baseScaleX,
          duration: ANIMATION_DURATION.TOOLBOX_BOUNCE_DOWN,
          onChange: (value) => {
            if (!this.canvas) return; // Canvas was cleaned up
            target.scaleX = value;
            target.scaleY = baseScaleY * (value / baseScaleX);
            target.setCoords();
            this.canvas.requestRenderAll();
          },
          onComplete: () => {
            if (onComplete) onComplete();
          }
        });
      }
    });
  }

  /**
   * Double bounce animation (bounce twice in sequence)
   * @param {fabric.Object} target - Object to animate
   * @param {Function} onComplete - Callback after both bounces complete
   */
  doubleBounce(target, onComplete = null) {
    this.bounceAnimation(target, ANIMATION_SCALE.TOOLBOX_BOUNCE, () => {
      this.bounceAnimation(target, ANIMATION_SCALE.TOOLBOX_BOUNCE, onComplete);
    });
  }

  /**
   * Continuous rotation animation
   * @param {Array<fabric.Object>} targets - Objects to rotate
   * @param {string} animationId - Unique identifier for cleanup
   * @param {number} speed - Rotation speed in degrees per millisecond
   * @returns {Object} Control object with start/stop methods
   */
  startRotationAnimation(targets, animationId = 'rotation', speed = ANIMATION_DURATION.GEAR_ROTATION_SPEED) {
    let isAnimating = false;
    let frameId = null;
    const startTime = performance.now();
    
    const animate = (now) => {
      if (!isAnimating) return;
      
      const elapsed = now - startTime;
      const rotation = (elapsed * speed) % 360;
      
      targets.forEach((target) => {
        target.set({ angle: rotation });
        target.setCoords();
      });
      
      if (this.canvas) {
        this.canvas.requestRenderAll();
      }
      
      frameId = fabric.util.requestAnimFrame(animate);
      this.activeAnimations.set(animationId, frameId);
    };
    
    const controller = {
      start: () => {
        if (isAnimating) return;
        isAnimating = true;
        frameId = fabric.util.requestAnimFrame(animate);
        this.activeAnimations.set(animationId, frameId);
      },
      stop: () => {
        isAnimating = false;
        if (frameId) {
          fabric.util.cancelAnimFrame(frameId);
          this.activeAnimations.delete(animationId);
          frameId = null;
        }
      }
    };
    
    controller.start();
    return controller;
  }

  /**
   * Wiggle animation (oscillating rotation)
   * @param {fabric.Object} target - Object to wiggle
   * @param {string} animationId - Unique identifier
   * @param {number} degrees - Maximum rotation angle
   * @param {number} period - Oscillation period in ms
   * @returns {Object} Control object with start/stop methods
   */
  startWiggleAnimation(target, animationId = 'wiggle', degrees = ANIMATION_SCALE.OWL_WIGGLE_DEGREES, period = ANIMATION_DURATION.OWL_WIGGLE_PERIOD) {
    let isAnimating = false;
    let frameId = null;
    const startTime = performance.now();
    const baseAngle = target.angle || 0;
    
    // Ensure origin is centered for proper rotation
    target.set({ originX: 'center', originY: 'center' });
    
    const animate = (now) => {
      if (!isAnimating) return;
      
      const elapsed = now - startTime;
      const wiggleAngle = Math.sin(elapsed / period) * degrees;
      target.set({ angle: baseAngle + wiggleAngle });
      target.setCoords();
      
      if (this.canvas) {
        this.canvas.requestRenderAll();
      }
      
      frameId = fabric.util.requestAnimFrame(animate);
      this.activeAnimations.set(animationId, frameId);
    };
    
    const controller = {
      start: () => {
        if (isAnimating) return;
        isAnimating = true;
        frameId = fabric.util.requestAnimFrame(animate);
        this.activeAnimations.set(animationId, frameId);
      },
      stop: () => {
        isAnimating = false;
        if (frameId) {
          fabric.util.cancelAnimFrame(frameId);
          this.activeAnimations.delete(animationId);
          frameId = null;
        }
        // Reset to base angle
        if (this.canvas) {
          target.set({ angle: baseAngle });
          target.setCoords();
          this.canvas.requestRenderAll();
        }
      }
    };
    
    controller.start();
    return controller;
  }

  /**
   * Button press animation (scale down and back)
   * @param {fabric.Object} button - Button object
   * @param {Function} onComplete - Callback when animation completes
   */
  animateButtonPress(button, onComplete = null) {
    const originalScaleX = button.scaleX || 1;
    const originalScaleY = button.scaleY || 1;
    const pressedScale = ANIMATION_SCALE.BUTTON_PRESS;
    
    button.animate('scaleX', originalScaleX * pressedScale, {
      duration: ANIMATION_DURATION.BUTTON_PRESS,
      onChange: () => { if (this.canvas) this.canvas.requestRenderAll(); },
      onComplete: () => {
        button.animate('scaleX', originalScaleX, {
          duration: ANIMATION_DURATION.BUTTON_PRESS,
          onChange: () => { if (this.canvas) this.canvas.requestRenderAll(); },
          onComplete
        });
      }
    });
    
    button.animate('scaleY', originalScaleY * pressedScale, {
      duration: ANIMATION_DURATION.BUTTON_PRESS,
      onChange: () => { if (this.canvas) this.canvas.requestRenderAll(); },
      onComplete: () => {
        button.animate('scaleY', originalScaleY, {
          duration: ANIMATION_DURATION.BUTTON_PRESS,
          onChange: () => { if (this.canvas) this.canvas.requestRenderAll(); }
        });
      }
    });
  }

  /**
   * Smooth zoom and pan to target
   * @param {Object} config - Animation configuration
   * @param {number} config.targetZoom - Target zoom level
   * @param {number} config.targetX - Target X coordinate (canvas space)
   * @param {number} config.targetY - Target Y coordinate (canvas space)
   * @param {number} config.duration - Animation duration in ms
   * @param {Function} config.onProgress - Progress callback
   * @param {Function} config.onComplete - Completion callback
   */
  animateViewport(config) {
    const {
      targetZoom,
      targetX,
      targetY,
      duration = ANIMATION_DURATION.ZOOM_OUT,
      onProgress = null,
      onComplete = null
    } = config;
    
    const currentZoom = this.canvas.getZoom();
    const currentVpt = this.canvas.viewportTransform;
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();
    
    // Calculate target viewport transform
    const targetVptX = -(targetX * targetZoom) + canvasWidth / 2;
    const targetVptY = -(targetY * targetZoom) + canvasHeight / 2;
    
    const startTime = performance.now();
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      if (this.canvas) {
        const newZoom = currentZoom + (targetZoom - currentZoom) * eased;
        const newVptX = currentVpt[4] + (targetVptX - currentVpt[4]) * eased;
        const newVptY = currentVpt[5] + (targetVptY - currentVpt[5]) * eased;
        
        this.canvas.setViewportTransform([newZoom, 0, 0, newZoom, newVptX, newVptY]);
        this.canvas.requestRenderAll();
      }
      
      if (onProgress) {
        onProgress(progress, eased);
      }
      
      if (progress < 1) {
        fabric.util.requestAnimFrame(animate);
      } else if (onComplete) {
        onComplete();
      }
    };
    
    fabric.util.requestAnimFrame(animate);
  }

  /**
   * Stop a specific animation by ID
   * @param {string} animationId - Animation identifier
   */
  stopAnimation(animationId) {
    const frameId = this.activeAnimations.get(animationId);
    if (frameId) {
      try {
        fabric.util.cancelAnimFrame(frameId);
      } catch (e) {
        console.warn('[AnimationController] Error stopping animation:', e);
      }
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Stop all active animations
   */
  stopAllAnimations() {
    this.activeAnimations.forEach((frameId, animationId) => {
      try {
        fabric.util.cancelAnimFrame(frameId);
      } catch (e) {
        console.warn('[AnimationController] Error stopping animation:', animationId, e);
      }
    });
    this.activeAnimations.clear();
  }

  /**
   * Get count of active animations (for debugging)
   */
  getActiveCount() {
    return this.activeAnimations.size;
  }
}
