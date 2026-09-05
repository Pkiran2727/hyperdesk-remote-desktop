export class TouchGestureTranslator {
  constructor(canvasWidth = 1920, canvasHeight = 1080) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.scale = 1.0;
  }

  translateTap(touchX, touchY, screenWidth, screenHeight) {
    const xPct = Math.max(0, Math.min(100, (touchX / screenWidth) * 100));
    const yPct = Math.max(0, Math.min(100, (touchY / screenHeight) * 100));

    return {
      category: 'MOUSE',
      type: 'click',
      button: 0, // Left Click
      xPct,
      yPct,
      timestamp: Date.now()
    };
  }

  translateLongPress(touchX, touchY, screenWidth, screenHeight) {
    const xPct = Math.max(0, Math.min(100, (touchX / screenWidth) * 100));
    const yPct = Math.max(0, Math.min(100, (touchY / screenHeight) * 100));

    return {
      category: 'MOUSE',
      type: 'contextmenu',
      button: 2, // Right Click
      xPct,
      yPct,
      timestamp: Date.now()
    };
  }

  translatePinchZoom(scaleFactor) {
    this.scale = Math.max(1.0, Math.min(3.0, this.scale * scaleFactor));
    return {
      category: 'VIEWPORT',
      type: 'zoom',
      scale: this.scale,
      timestamp: Date.now()
    };
  }
}
