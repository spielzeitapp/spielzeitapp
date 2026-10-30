# Manager App preview (TEST)

Open Manager → Vereine → Verein → App vorab prüfen, select the saved team season,
and choose App-Vorschau öffnen. The same UI components are used for Splash,
Welcome, Home, Termine, Team, Profil and Mehr. Use the preview's top toolbar to
switch pages. Inner controls are intentionally locked.

The iframe has its own MemoryRouter and a fan-only SessionViewProvider. It does
not mount SessionProvider, change stored favorites, switch the work season or
create memberships. Platform-admin authorization is read from user_roles and
admin_get_club independently validates access on the server. Parent messages
are restricted to the same origin and the actual iframe parent. Only branding
and a temporary local logo URL are sent, never credentials.

A separate fetch guard permits GET/HEAD/OPTIONS, token refresh and a small
explicit list of read RPCs. All other writes fail locally with HTTP 403, before
network dispatch. This is additional preview protection; Supabase remains the
actual authorization boundary. No RLS, schema or team-status changes are made.

Unsaved logo and palette are supplied by the manager form. Roster and events
come from the selected saved season. The preview does not publish anything;
it also does not introduce a draft/publication workflow. Existing save and
activation behavior is unchanged.

Checks: production build, TypeScript, isolated-session and actual guarded-fetch
unit tests (including denied roster/storage/RPC writes and logout), existing
fan/read-scope, navigation and Welcome source-layout tests. Physical iPhone and
signed-in browser acceptance tests remain necessary.
