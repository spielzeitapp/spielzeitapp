/**
 * Serien-Bearbeitung: wiederkehrende Termine teilen `series_id`.
 *
 * - `single`: ein Termin inkl. Zeit & Treffpunkt
 * - `future`: ab diesem Termin nur gemeinsame Felder (Ort, Adresse, Gegner/Bezeichnung)
 * - `series`: alle Termine der Serie – gleiche Einschränkung wie future
 *
 * Zeit/Treffpunkt-Massenänderung wäre pro Zeile nötig → aktuell nur bei `single`.
 */

export type SeriesEditScope = 'single' | 'future' | 'series';
