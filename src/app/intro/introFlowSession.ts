/**
 * Intro-Flow (Splash → Welcome): einmal pro Browser-Tab-Session.
 * Keine Business-Logik — nur Steuerung der ersten Präsentation nach Login/Start auf /app.
 */
export const INTRO_FLOW_SESSION_KEY = 'spielzeit_intro_flow_v1';
export const INTRO_FLOW_COMPLETED_VALUE = 'completed';

export function isIntroFlowCompleted(): boolean {
  try {
    return (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(INTRO_FLOW_SESSION_KEY) === INTRO_FLOW_COMPLETED_VALUE
    );
  } catch {
    return false;
  }
}

export function markIntroFlowCompleted(): void {
  try {
    sessionStorage.setItem(INTRO_FLOW_SESSION_KEY, INTRO_FLOW_COMPLETED_VALUE);
  } catch {
    /* z. B. privates Fenster */
  }
}
