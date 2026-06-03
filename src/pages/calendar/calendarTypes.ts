export type CalendarEventType = 'game' | 'training' | 'event' | 'other' | 'tournament';

export type CalendarEvent = {
  id: string;
  team_season_id: string;
  type: CalendarEventType;
  starts_at: string;
  end_at?: string | null;
  meeting_at?: string | null;
  location: string | null;
  opponent?: string | null;
  notes?: string | null;
  description?: string | null;
  title: string;
  team_name: string | null;
};

export type DayEvents = CalendarEvent[];

export type CalendarView = 'list' | 'week' | 'month';

