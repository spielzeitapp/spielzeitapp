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
};

export type ManagerNavSection = {
  id: string;
  label: string;
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
      { id: 'seasons', label: 'Saisonen', status: 'planned' },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    items: [
      { id: 'training', label: 'Trainingsplanung', to: '/manager/training/einheiten', status: 'ready' },
      { id: 'training-lib', label: 'Übungsbibliothek', to: '/manager/training/bibliothek', status: 'ready' },
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
    items: [
      { id: 'equipment', label: 'Ausrüstung & Teamshop', status: 'planned' },
      { id: 'facilities', label: 'Sportanlagen', to: '/manager/platzbelegung?tab=facilities', status: 'ready' },
      { id: 'permissions', label: 'Berechtigungen', status: 'planned' },
    ],
  },
] as const;
