/** Keep human hints; event titles and internal tournament metadata are not display notes. */
export function tournamentDisplayNotes(notes: unknown, title: string): string | null {
  if (typeof notes !== 'string') return null;
  const text = notes
    .split(/\r?\n| · /)
    .map(line => line.trim())
    .filter(line => line && line !== title.trim())
    .filter(line => !/^(?:Ende|Turniermannschaft|Turniersaison|Turnierdatum|Fan-Testdaten)\s*:/i.test(line))
    .join('\n');
  return text || null;
}
