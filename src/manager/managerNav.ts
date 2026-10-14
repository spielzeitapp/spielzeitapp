/**
 * Sidebar-Navigation für den Spielzeit Manager.
 * STEP 1: Dashboard · STEP 2: Platzbelegung · STEP 3A: Training.
 */

export type ManagerNavItem = {
  id: string;
  label: string;
  /** Aktive Route (nur für umgesetzte Module). */
  to?: string;
  status: 'ready' | 'planned';
  /** Nur Plattformadmin (user_roles.admin) – kein neues Rechte-Modul. */
  platformAdminOnly?: boolean;
  /** In Trainer-Arbeitsmodus ausblenden (z. B. Sportanlagen-Verwaltung). */
  hideInTrainerMode?: boolean;
  /** Nur in der globalen Plattformverwaltung, nicht im Vereins-/Supportkontext. */
  platformGlobalOnly?: boolean;
  /** Zugehöriges Vereinsmodul; Grundmodule sind ebenfalls im Katalog enthalten. */
  moduleKey?: string;
};

export type ManagerNavSection = {
  id: string;
  label: string;
  /** Ganze Sektion in Trainer-Arbeitsmodus ausblenden. */
  hideInTrainerMode?: boolean;
  items: ManagerNavItem[];
};

export const MANAGER_NAV_SECTIONS: readonly ManagerNavSection[] = [
  {
    id: 'platform',
    label: 'Plattform',
    items: [
      {
        id: 'platform-dashboard',
        label: 'Plattform-Dashboard',
        to: '/manager/plattform',
        status: 'ready',
        platformAdminOnly: true,
        platformGlobalOnly: true,
      },
      {
        id: 'clubs',
        label: 'Vereine',
        to: '/manager/vereine',
        status: 'ready',
        platformAdminOnly: true,
        platformGlobalOnly: true,
      },
    ],
  },
  {
    id: 'overview',
    label: 'Übersicht',
    items: [{ id: 'dashboard', label: 'Dashboard', to: '/manager/dashboard', status: 'ready', moduleKey: 'dashboard' }],
  },
  {
    id: 'my-team',
    label: 'Mein Team',
    items: [
      { id: 'squad', label: 'Team', to: '/manager/team', status: 'ready' },
      { id: 'players', label: 'Spieler', to: '/manager/spieler', status: 'ready' },
      { id: 'parents', label: 'Eltern & Zugänge', to: '/manager/mehr/parent-access', status: 'ready' },
      { id: 'events', label: 'Termine', to: '/manager/termine', status: 'ready' },
      { id: 'seasons', label: 'Saisonen', to: '/manager/saisons', status: 'ready', moduleKey: 'seasons' },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    items: [
      { id: 'training', label: 'Trainingsplanung', to: '/manager/training/einheiten', status: 'ready', moduleKey: 'training' },
      { id: 'training-lib', label: 'Übungsbibliothek', to: '/manager/training/bibliothek', status: 'ready', moduleKey: 'training-lib' },
      { id: 'training-tpl', label: 'Vorlagen', to: '/manager/training/vorlagen', status: 'ready', moduleKey: 'training-tpl' },
      { id: 'training-chronik', label: 'Chronik', to: '/manager/training/chronik', status: 'ready', moduleKey: 'training-chronik' },
      { id: 'matches', label: 'Spiele', to: '/manager/spiele', status: 'ready' },
      { id: 'competition', label: 'Tabelle & Liga', to: '/manager/tabelle', status: 'ready' },
      { id: 'tournaments', label: 'Turniere', to: '/manager/turniere', status: 'ready' },
      { id: 'venues', label: 'Platzbelegung', to: '/manager/platzbelegung', status: 'ready', moduleKey: 'venues' },
      { id: 'video', label: 'Video & Analyse', to: '/manager/video', status: 'ready' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { id: 'social', label: 'Feed & Beiträge', to: '/manager/home', status: 'ready' },
      { id: 'media-studio', label: 'Vereinsmedien', to: '/manager/vereinsmedien', status: 'ready' },
      { id: 'social-media', label: 'Social Media', to: '/manager/social-media', status: 'ready' },
      { id: 'music-studio', label: 'Musikstudio', to: '/manager/musikstudio', status: 'ready' },
      { id: 'speaker-studio', label: 'Sprecherstudio', to: '/manager/sprecherstudio', status: 'ready', hideInTrainerMode: true },
      { id: 'team-push', label: 'Team-Nachricht', to: '/manager/mehr/trainer/team-push', status: 'ready' },
      { id: 'reminders', label: 'Erinnerungen', to: '/manager/mehr/trainer/erinnerungen', status: 'ready' },
    ],
  },
  {
    id: 'club',
    label: 'Verein',
    hideInTrainerMode: true,
    items: [
      { id: 'equipment', label: 'Ausrüstung & Teamshop', status: 'planned' },
      {
        id: 'facilities',
        label: 'Sportanlagen',
        to: '/manager/platzbelegung?tab=facilities',
        status: 'ready',
        hideInTrainerMode: true,
      },
      { id: 'permissions', label: 'Berechtigungen', status: 'planned' },
    ],
  },
] as const;
