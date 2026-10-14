/**
 * Preparation contracts for club media, social publishing and stadium announcing.
 * Not wired to routes or persistence. Server authorization must enforce club scope.
 */
export type CommunicationsCapability = 'media.edit' | 'media.approve' | 'social.publish' | 'speaker.edit' | 'speaker.operate' | 'audio.manage';
export type SourceOrigin = 'oefb' | 'confirmed_match' | 'club_settings' | 'manual';
export type SourceFact = { id: string; origin: SourceOrigin; checkedAt: string | null; value: string | number; confirmed: boolean };
export type SectionStatus = 'draft' | 'needs_review' | 'approved';
export type SpeakerSection = {
  id: string;
  title: string;
  offsetMinutes: number | null;
  trigger: 'scheduled' | 'halftime' | 'second_half' | 'fulltime' | 'manual';
  text: string;
  status: SectionStatus;
  editedByUser: boolean;
  sourceFactIds: string[];
  audioCue: string | null;
};
export type MediaDraft = {
  id: string; clubId: string; teamSeasonId: string | null; eventId: string | null;
  template: 'matchday' | 'result' | 'lineup' | 'squad' | 'news';
  format: 'feed' | 'story'; revision: number; caption: string;
  status: 'draft' | 'needs_review' | 'approved';
  sources: SourceFact[]; imageAssetIds: string[]; updatedAt: string;
};
export type SpeakerProgram = {
  id: string; clubId: string; eventId: string; revision: number; kickoff: string;
  sectionOrder: string[]; sections: SpeakerSection[]; sources: SourceFact[];
  matchdaySponsorIds: string[]; confirmedSupporterIds: string[];
};
export type SocialPublishRequest = {
  draftId: string; approvedRevision: number; connectionId: string;
  target: 'facebook_page' | 'instagram_feed' | 'instagram_story'; scheduledAt: string | null;
};
export type SocialPublishReceipt = {
  requestId: string; remotePostId: string | null; remoteUrl: string | null;
  status: 'queued' | 'processing' | 'confirmed' | 'failed' | 'unknown';
};
export type AudioAsset = {
  id: string; clubId: string; name: string; storagePath: string;
  mimeType: string; durationSeconds: number; availableOffline: boolean;
};

/** Own source wording; variable facts deliberately stay visible until supplied. */
export const DEFAULT_SPEAKER_SECTIONS: readonly SpeakerSection[] = [
  { id: 'welcome', title: 'Begrüßung', offsetMinutes: -15, trigger: 'scheduled',
    text: 'Liebe Fußballfans – grias eich und herzlich willkommen!\n\nHier auf der {{venue}} begrüßen wir euch zum Meisterschaftsspiel {{round}} in der {{competition}}.\n\nUnser {{club}} empfängt heute {{opponent}}!\n\n{{previous_results}}\n\n{{table_summary}}',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: null },
  { id: 'anthem', title: 'Vereinshymne', offsetMinutes: -12, trigger: 'scheduled',
    text: 'Und jetzt heißt’s: Einstimmung auf das heutige Spiel! Hier ist unsere Vereinshymne: {{anthem_title}}!',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: 'club_anthem' },
  { id: 'sponsors', title: 'Schirmherrschaft, Patronanz und Ballspende', offsetMinutes: -10, trigger: 'scheduled',
    text: 'Liebe Fußballfreunde, wir sagen ein großes Dankeschön an unsere Unterstützer!\n\n{{matchday_sponsors}}\n\n{{present_supporters}}\n\nHerzlichen Dank für eure Unterstützung rund um unseren {{club}}!',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: 'sponsor_jingle' },
  { id: 'away_lineup', title: 'Aufstellung der Gäste', offsetMinutes: -7, trigger: 'scheduled',
    text: 'Wir kommen zur Mannschaftsaufstellung unserer Gäste von {{opponent}}.\n\n{{away_lineup}}\n\n{{away_bench}}\n\n{{away_coaches}}',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: null },
  { id: 'home_lineup', title: 'Eigene Aufstellung', offsetMinutes: -5, trigger: 'scheduled',
    text: 'Unser {{club}} beginnt mit folgender Mannschaft:\n\n{{home_lineup}}\n\n{{home_bench}}\n\n{{home_coaches}}',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: 'fan_jingle' },
  { id: 'officials', title: 'Schiedsrichterteam', offsetMinutes: -4, trigger: 'scheduled',
    text: 'Ich darf euch auch das Schiedsrichterteam vorstellen:\n\n{{officials}}',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: null },
  { id: 'entrance', title: 'Einlauf', offsetMinutes: -2, trigger: 'scheduled',
    text: 'Liebe Fußballfans! Einen kräftigen Applaus für das Schiedsrichterteam und die beiden Mannschaften!',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: 'entrance' },
  { id: 'kickoff', title: 'Ehrenanstoß und Anpfiff', offsetMinutes: 0, trigger: 'scheduled',
    text: '{{honorary_kickoff}}\n\nWir wünschen uns allen ein faires und spannendes Spiel. Und jetzt, liebe Fans: volle Unterstützung für unsere Mannschaft!',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: null },
  { id: 'halftime', title: 'Halbzeit', offsetMinutes: null, trigger: 'halftime',
    text: 'Pausenstand zwischen unserem {{club}} und {{opponent}}: {{halftime_score}}.\n\n{{other_scores}}\n\n{{halftime_sponsors}}\n\n{{raffle}}',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: 'halftime' },
  { id: 'second_half', title: 'Beginn der zweiten Halbzeit', offsetMinutes: null, trigger: 'second_half',
    text: 'Die Mannschaften stehen bereit – wir starten in die zweite Spielhälfte! Einen kräftigen Sonderapplaus für unseren {{club}}! Auf geht’s!',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: null },
  { id: 'fulltime', title: 'Spielende und Vorschau', offsetMinutes: null, trigger: 'fulltime',
    text: '{{result_summary}}\n\n{{other_final_scores}}\n\n{{next_fixtures}}\n\nDanke für euren heutigen Besuch! Kommt’s gut heim, pfiat eich und bis bald – auf Wiedersehen!',
    status: 'draft', editedByUser: false, sourceFactIds: [], audioCue: 'outro' },
];

/** No replacement of edited or approved speech without an explicit section selection. */
export function mergeGeneratedSections(current: readonly SpeakerSection[], generated: readonly SpeakerSection[], explicitlyReplaceIds: readonly string[] = []): SpeakerSection[] {
  const existing = new Map(current.map(section => [section.id, section]));
  const incoming = new Map(generated.map(section => [section.id, section]));
  if (existing.size !== current.length || incoming.size !== generated.length) throw new Error('Doppelte Abschnitts-ID.');
  const replace = new Set(explicitlyReplaceIds);
  const ids = [...current.map(section => section.id), ...generated.filter(section => !existing.has(section.id)).map(section => section.id)];
  return ids.map(id => {
    const old = existing.get(id);
    const next = incoming.get(id);
    if (!next) return { ...old!, sourceFactIds: [...old!.sourceFactIds] };
    if (old && (old.editedByUser || old.status === 'approved') && !replace.has(id)) return { ...old, sourceFactIds: [...old.sourceFactIds] };
    return { ...next, status: 'needs_review', editedByUser: false, sourceFactIds: [...next.sourceFactIds] };
  });
}

/** Resolve only approved facts. Missing keys remain markers, never invented values. */
export function renderSpeakerTemplate(template: string, values: Record<string, string | number | null | undefined>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(/\{\{([a-z_]+)\}\}/g, (_marker, key: string) => {
    const value = values[key];
    if (value == null || (typeof value === 'string' && !value.trim()) || (typeof value === 'number' && !Number.isFinite(value))) {
      missing.add(key);
      return '[OFFEN: ' + key + ']';
    }
    return String(value);
  });
  return { text, missing: [...missing] };
}

export function speakerCueTime(kickoffIso: string, offsetMinutes: number): { iso: string; dayKey: string; label: string } {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(kickoffIso)) throw new Error('Anpfiff benötigt eine Zeitzone.');
  const kickoff = Date.parse(kickoffIso);
  if (!Number.isFinite(kickoff) || !Number.isInteger(offsetMinutes)) throw new Error('Ungültige Zeitangabe.');
  const date = new Date(kickoff + offsetMinutes * 60_000);
  if (!Number.isFinite(date.getTime())) throw new Error('Zeit außerhalb des gültigen Bereichs.');
  const options = { timeZone: 'Europe/Vienna' };
  return {
    iso: date.toISOString(),
    dayKey: new Intl.DateTimeFormat('sv-SE', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    label: new Intl.DateTimeFormat('de-AT', { ...options, hour: '2-digit', minute: '2-digit' }).format(date),
  };
}

function level(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Ungültiger Audiopegel.');
  return Math.min(1, Math.max(0, value));
}
/** Calculation only. Playback, smooth gain ramps and ALL STOP belong to the audio adapter. */
export function deckGains(crossfade: number, volumeA: number, volumeB: number, speaking: boolean, duckLevel = 0.2): { a: number; b: number } {
  const position = level(crossfade);
  const attenuation = speaking ? level(duckLevel) : 1;
  return {
    a: (position === 1 ? 0 : Math.cos(position * Math.PI / 2)) * level(volumeA) * attenuation,
    b: (position === 0 ? 0 : Math.sin(position * Math.PI / 2)) * level(volumeB) * attenuation,
  };
}
