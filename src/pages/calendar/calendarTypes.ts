export type CalendarEventType = 'game' | 'training' | 'event' | 'other';

export type CalendarEvent = {
  id: string;
  team_season_id: string;
  event_type: CalendarEventType;
  starts_at: string;
  end_at?: string | null;
  meetup_at?: string | null;
  location: string | null;
  address?: string | null;
  opponent?: string | null;
  notes?: string | null;
  description?: string | null;
  title: string;
  team_name: string | null;
};

export type DayEvents = CalendarEvent[];

export type CalendarView = 'list' | 'week' | 'month';

