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
    id: 'overview',
    label: 'Übersicht',
    items: [{ id: 'dashboard', label: 'Dashboard', to: '/manager', status: 'ready' }],
  },
  {
    id: 'my-team',
    label: 'Mein Team',
    items: [
      { id: 'squad', label: 'Mannschaft', status: 'planned' },
      { id: 'players', label: 'Spieler', status: 'planned' },
      { id: 'parents', label: 'Eltern', status: 'planned' },
      { id: 'events', label: 'Termine', status: 'planned' },
      { id: 'seasons', label: 'Saisonen', to: '/manager/saisons', status: 'ready' },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    items: [
      { id: 'training', label: 'Trainingsplanung', to: '/manager/training/einheiten', status: 'ready' },
      { id: 'training-lib', label: 'Übungsbibliothek', to: '/manager/training/bibliothek', status: 'ready' },
      { id: 'training-tpl', label: 'Vorlagen', to: '/manager/training/vorlagen', status: 'ready' },
      { id: 'training-chronik', label: 'Chronik', to: '/manager/training/chronik', status: 'ready' },
      { id: 'matches', label: 'Spiele', status: 'planned' },
      { id: 'tournaments', label: 'Turniere', status: 'planned' },
      { id: 'venues', label: 'Platzbelegung', to: '/manager/platzbelegung', status: 'ready' },
      { id: 'video', label: 'Video & Analyse', status: 'planned' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { id: 'chronicle', label: 'Team-Chronik', status: 'planned' },
      { id: 'social', label: 'Social Media', status: 'planned' },
    ],
  },
  {
    id: 'club',
    label: 'Verein',
    hideInTrainerMode: true,
    items: [
      {
        id: 'clubs',
        label: 'Vereine',
        to: '/manager/vereine',
        status: 'ready',
        platformAdminOnly: true,
      },
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
