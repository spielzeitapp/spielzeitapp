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
  /** Zero means iOS already reserved a separate status bar outside the viewport. */
  safeAreaTop?: number;
};

/** Safari page zoom changes both layout width and visualViewport.scale.
 * Pinch zoom changes the visual viewport without changing layout width.
 * Only accept a scale whose layout width still fills the physical screen. */
export function standalonePageScale(input: Pick<StandaloneViewportInput, 'ios' | 'standalone' | 'screenWidth' | 'innerWidth' | 'scale'>): number | null {
  const {ios, standalone, screenWidth, innerWidth, scale} = input;
  if (!ios || !standalone || ![screenWidth, innerWidth, scale].every(value => Number.isFinite(value) && value > 0)) return null;
  if (scale < 0.5 || scale > 2 || Math.abs(screenWidth - innerWidth * scale) > 2) return null;
  return scale;
}

/** Recover a small iOS Homescreen viewport discrepancy in layout CSS pixels.
 * Screen dimensions are at device scale; page zoom must be applied before
 * comparing them with innerHeight (e.g. 874 / .85, rather than 874).
 * Keyboard, Safari chrome, split-screen and actual pinch zoom are excluded. */
export function standaloneFullscreenHeight(input: StandaloneViewportInput): number | null {
  const { screenHeight, innerHeight, visibleHeight, visibleTop, editing } = input;
  const pageScale = standalonePageScale(input);
  if (input.safeAreaTop !== undefined && input.safeAreaTop <= 1) return null;
  if (pageScale === null || editing || !Number.isFinite(visibleTop) || Math.abs(visibleTop) > 1) return null;
  if (![screenHeight, innerHeight, visibleHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const gap = screenHeight - Math.min(innerHeight, visibleHeight) * pageScale;
  if (gap < -1 || gap > 120 || innerHeight * pageScale > screenHeight + 1 || visibleHeight * pageScale > screenHeight + 1) return null;
  return screenHeight / pageScale;
}
