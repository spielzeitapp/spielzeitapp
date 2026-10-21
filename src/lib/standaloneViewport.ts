export type StandaloneViewportInput = {
  ios: boolean;
  standalone: boolean;
  screenWidth: number;
  screenHeight: number;
  innerWidth: number;
  innerHeight: number;
  visibleHeight: number;
  visibleTop: number;
  scale: number;
  editing: boolean;
};

/** iOS can restore a toolbar-sized viewport in a fullscreen Homescreen app.
 * Only recover a small discrepancy on a full-width, unzoomed standalone screen.
 * Keyboard, Safari chrome, split-screen and rotated/stale screen dimensions are excluded.
 */
export function standaloneFullscreenHeight(input: StandaloneViewportInput): number | null {
  const { ios, standalone, screenWidth, screenHeight, innerWidth, innerHeight, visibleHeight, visibleTop, scale, editing } = input;
  if (!ios || !standalone || editing || Math.abs(scale - 1) > 0.01 || Math.abs(visibleTop) > 1) return null;
  if (![screenWidth, screenHeight, innerWidth, innerHeight, visibleHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  if (Math.abs(screenWidth - innerWidth) > 2) return null;
  const gap = screenHeight - Math.min(innerHeight, visibleHeight);
  if (gap < 0 || gap > 120 || innerHeight > screenHeight + 1 || visibleHeight > screenHeight + 1) return null;
  return screenHeight;
}
