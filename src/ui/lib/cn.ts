/** Klassen-Strings zusammenführen (kein externes Dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
