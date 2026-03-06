# Rollen-System – Bestandsaufnahme

## Wo wird die Rolle gesetzt?

- **RoleContext** (`src/app/role/RoleContext.tsx`): `setRole()` schreibt in `localStorage` unter Key `sz_role_v1`. Werte: `viewer` | `parent` | `trainer` | `admin`. Wird von Header, Profil, SchedulePage, MatchDetailPage genutzt.
- **useSession** (`src/auth/useSession.tsx`): `setRole()` schreibt in `localStorage` unter Key `spielzeit_role`. Werte: `fan` | `parent` | `player` | `trainer` | `co_trainer` | `head_coach` (Typ aus `src/auth/rbac.tsx`). Wird von TeamPage, MatchDetail, LivePage, MatchDetailsPage, RoleSwitcherDev genutzt.

Es gibt also **zwei getrennte Rollen-Quellen**: UI-Rolle (sz_role_v1) und Session-/Backend-Rolle (spielzeit_role).

## Wo wird die Rolle gespeichert?

| Quelle        | Key             | Typ (Werte) |
|---------------|-----------------|-------------|
| RoleContext   | `sz_role_v1`    | viewer, parent, trainer, admin |
| useSession    | `spielzeit_role`| fan, parent, player, trainer, co_trainer, head_coach |

Beide werden nur im **localStorage** gehalten. Kein Query-Parameter, kein Server-Token für die Rolle in der aktuellen Implementierung.

## Wo wird der User geladen?

- **Nirgends per API.** In `useSession` wird ein fester Mock-User gebaut: `defaultUserBase` (id, name) + aktuelle `role` aus State. Es gibt keinen Aufruf wie `/api/v1/me`. Die „Backend-Rolle“ ist de facto die in `spielzeit_role` gespeicherte Session-Rolle (RBAC-Typ).

## Zusammenfassung

- **Backend-Rolle (fix):** Kommt aus `localStorage spielzeit_role` (useSession). Kein echtes Backend; Quelle ist lokal.
- **UI-Testrolle (optional):** Bisher in `localStorage sz_role_v1` (RoleContext). Wird durch zentrale `role.ts` abgelöst: DEV-Override in `dev_ui_role`, nur wenn Backend-Rolle admin/head und DEV_MODE.
