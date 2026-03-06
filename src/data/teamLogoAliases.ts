/**
 * Map: normalisierte Teamnamen (lowercase, St.→st, Umlaute→oe/ae/ue) → Logo-Dateiname (lowercase, snake_case).
 * Wird für Server-Logo-URLs verwendet (Linux Case-Sensitivity).
 */
export const TEAM_LOGO_ALIASES: Record<string, string> = {
  'spg rohrbach': 'spg_rohrbach.png',
  'spg rohrbach a': 'spg_rohrbach.png',
  'spg rohrbach u12': 'spg_rohrbach.png',
  'alpenvorland usg': 'alpenvorland_usg.png',
  'usg alpenvorland': 'alpenvorland_usg.png',
  'usg alpenvorland u12': 'alpenvorland_usg.png',
  'skn st poelten': 'skn_stpoelten_a.png',
  'skn st pölten': 'skn_stpoelten_a.png',
  'skn st poelten a': 'skn_stpoelten_a.png',
  'skn st pölten a': 'skn_stpoelten_a.png',
  'skvg pottenbrunn': 'pottenbrunn.png',
  'pottenbrunn': 'pottenbrunn.png',
  'spg weinburg a': 'spg_weinburg_a.png',
};
