import { supabase } from '../supabaseClient';
import { formatEventDateVienna, formatEventTimeVienna } from './format';

type CreatedEvent = {
  id: string;
  starts_at: string;
  kind?: string | null;
  type?: string | null;
  notes?: string | null;
  opponent?: string | null;
  location?: string | null;
  status?: string | null;
};

/** One announcement for the saved batch; daily reminders remain independent. */
export function newEventsAnnouncement(events: CreatedEvent[], nowMs = Date.now()) {
  const upcoming = events.filter(event => Date.parse(event.starts_at) > nowMs &&
    (!event.status || event.status === 'upcoming'))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  if (!upcoming.length) return null;
  const first = upcoming[0];
  const label = first.notes?.split(/[\n·]/)[0]?.trim() ||
    (first.opponent ? `Spiel gegen ${first.opponent}` :
      first.kind === 'training' ? 'Training' : first.kind === 'tournament' ? 'Turnier' : 'Termin');
  const title = upcoming.length === 1 ? `Neuer Termin: ${label}` : `${upcoming.length} neue Termine: ${label}`;
  const dates = upcoming.slice(0, 5).map(event =>
    `${formatEventDateVienna(event.starts_at)}, ${formatEventTimeVienna(event.starts_at)} Uhr`).join('; ');
  const body = `${label}: ${dates}${upcoming.length > 5 ? ` und ${upcoming.length - 5} weitere` : ''}. Bitte Termine in der App ansehen.`;
  return { title, body, url: upcoming.length === 1 ? `/app/events/${first.id}` : '/app/termine', related_event_id: first.id };
}

/** Returns a visible warning after saving, never asks the caller to recreate events. */
export async function announceNewEvents(teamSeasonId: string, events: CreatedEvent[]): Promise<string | null> {
  const announcement = newEventsAnnouncement(events);
  if (!announcement) return null;
  const warning = 'Termin gespeichert. Die Benachrichtigung konnte nicht vollständig versendet werden. Bitte bei Bedarf über Team-Push informieren.';
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return warning;
    const response = await fetch('/api/push/send-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ team_season_id: teamSeasonId, recipient_group: 'all', message_type: 'event_created', ...announcement }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result.ok === false || result.notificationsInsertError || result.messagesInsertError || Number(result.failed) > 0) return warning;
    return null;
  } catch {
    return warning;
  }
}
