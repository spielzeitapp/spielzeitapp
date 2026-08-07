/**
 * Kompatibilitäts-Bridge: re-exportiert Tour-Live-Aktionen.
 * Kanonische Implementierung liegt in `demoTourActions.ts`.
 */

export {
  DEMO_TOUR_FINISH_MATCH_EVENT,
  DEMO_TOUR_FOCUS_PLAYTIME_EVENT,
  finishDemoLiveMatchForTour,
  requestDemoTourFocusPlaytime,
  buildDemoWinnerPreviewData,
} from './demoTourActions';

/** Alias – gleiche Aktion wie finishDemoLiveMatchForTour. */
export { finishDemoLiveMatchForTour as requestDemoTourEndMatch } from './demoTourActions';
