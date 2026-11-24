// Read JSON data only; never execute scripts from the provider page.
function assignedObject(html, variable) {
  const marker = new RegExp(`window\\.${variable}\\s*=\\s*`, 'g');
  const match = marker.exec(html);
  if (!match) return null;
  const start = marker.lastIndex;
  if (html[start] !== '{') return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function plainText(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function extractMeinTurnierplanEmbeddedJson(html, tournamentId) {
  const compact = assignedObject(html, '_cpStadiumData');
  if (compact?.participants) {
    const name = plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const pageText = plainText(html);
    const readDuration = (label) => {
      const duration = Number(pageText.match(label)?.[1]);
      return duration > 0 && duration <= 120 ? duration : undefined;
    };
    const duration = readDuration(/Spieldauer\s*:?\s*(\d+)\s*Minuten/i);
    const groupMatchDuration = compact.groupMatchDuration
      ?? readDuration(/Spieldauer (?:in )?(?:der )?(?:Gruppenphase|Vorrunde)\s*:?\s*(\d+)\s*Minuten/i)
      ?? duration;
    const finalMatchDuration = compact.finalMatchDuration
      ?? readDuration(/Spieldauer (?:in )?(?:der )?Finalrunde\s*:?\s*(\d+)\s*Minuten/i)
      ?? duration;
    return { ...compact, name: compact.name || name, groupMatchDuration, finalMatchDuration };
  }
  const state = assignedObject(html, 'preloadedState');
  for (const entry of Object.values(state?.tournaments ?? {})) {
    if (!entry?.data) continue;
    if ([entry.slug, entry.data.slug, entry.data.slugId].includes(tournamentId)) return entry.data;
  }
  return null;
}
