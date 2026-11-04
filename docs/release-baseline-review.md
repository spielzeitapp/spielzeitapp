# One-time release baseline review

Status: blocked; no candidate has been promoted and no LIVE database changes have been applied.

LIVE source: `e0f175a37c9aa6cbb2b433335a2382e73a7ff587`. TEST source before traffic-light change: `cdb0c83efc902003544846ef9329f3a0af018b26`.

A normal merge of LIVE into a separate TEST integration worktree reports **117 unresolved file conflicts**. The conflicts include login/session handling, events, live matches, Manager permissions, deployment configuration and two historical SQL migrations. Do not resolve all conflicts by choosing one branch, create an ancestry-only merge, or mark an unreviewed baseline as approved.

The LIVE migration history was read without modifying it: **128 entries**. Repository SQL files differ from that history, including changed historical files and equivalent changes with different versions. Missing history is not proof a migration should be rerun. The excluded admin-org migrations `20260818140000` and `20260818140100` remain unapproved.

## Required review

1. Resolve application conflicts while preserving tested LIVE fixes and intended TEST features.
2. Preserve existing shipped SQL; place any required compatible delta in new migrations and review against actual LIVE schema.
3. Review separate deployment of changed Supabase Edge Functions and workflow files.
4. Build/typecheck/test the resulting TEST integration, then run user acceptance checks.
5. Review the exact final code and migration diff before the first publication.

The traffic light permits fully enumerated large code-only diffs with yellow warnings. It does not override any of these baseline blockers.

## Conflicted files

- `.github/workflows/player-access-active-season.yml`
- `manager.html`
- `package-lock.json`
- `package.json`
- `public/fonts/Anton-OFL.txt`
- `public/landingpage.html`
- `scripts/calendar-event-location-test.cjs`
- `scripts/landingpage-clean-hero-test.mjs`
- `scripts/live-opponent-logo-test.mjs`
- `scripts/manager-trainer-mode-test.mjs`
- `scripts/manager-venue-grants-ui2-test.mjs`
- `scripts/match-no-show-stats-test.mjs`
- `scripts/parent-email-invite-test.mjs`
- `scripts/parent-invite-ux-polish-test.mjs`
- `scripts/speaker-music-mode-test.mjs`
- `scripts/step19-tournament-live-robustness-test.mjs`
- `scripts/team-season-naming-test.mjs`
- `scripts/team-view-selection-test.mjs`
- `scripts/training-exercise-import1-test.mjs`
- `scripts/training-session-add-exercise-test.mjs`
- `scripts/venue-model-final-regression-test.mjs`
- `server/lib/reminderStatus.js`
- `server/push/send-team.js`
- `src/app/App.tsx`
- `src/app/components/BottomNav.tsx`
- `src/app/components/MatchCardLigaportal.tsx`
- `src/app/components/TeamSwitcher.tsx`
- `src/app/intro/WelcomeScreen.tsx`
- `src/app/layout/Header.tsx`
- `src/app/layout/InternalLayout.tsx`
- `src/auth/RequireAuth.tsx`
- `src/auth/useSession.tsx`
- `src/components/events/EventFeedCommunicationSection.tsx`
- `src/components/events/OpponentLogoField.tsx`
- `src/components/feed/MatchdayFeedPostCard.tsx`
- `src/components/feed/MatchdayPosterArtwork.tsx`
- `src/components/feed/PosterClubName.tsx`
- `src/components/feed/ResultFeedPostCard.tsx`
- `src/components/feed/ResultPosterArtwork.tsx`
- `src/components/feed/SquadPosterArtwork.tsx`
- `src/components/feed/resultPoster.css`
- `src/components/live/LiveMusicDock.tsx`
- `src/components/live/LivePremiumShell.tsx`
- `src/components/match/MatchTypeHeading.tsx`
- `src/components/match/MatchVideosPanel.tsx`
- `src/components/schedule/EventHeroCard.tsx`
- `src/components/schedule/PastMatchResultCard.tsx`
- `src/components/schedule/ScheduleHeroEventCard.tsx`
- `src/components/team/ParentAccessPlayerRow.tsx`
- `src/components/team/PlayerProfileModal.tsx`
- `src/components/team/SeasonMatchCard.tsx`
- `src/components/team/TeamSquadShowcase.tsx`
- `src/components/team/profile/ProfileHeroCard.tsx`
- `src/components/team/profile/TrainerProfileBody.tsx`
- `src/components/team/profile/TrainerProfileHeroCard.tsx`
- `src/components/training/TrainingExerciseDetailModal.tsx`
- `src/demo/components/DemoManagerPreview.tsx`
- `src/demo/demoDataSource.ts`
- `src/demo/pages/DemoTeamSchedulePage.tsx`
- `src/features/home/HomeFeedComposer.tsx`
- `src/features/home/HomePage.tsx`
- `src/features/home/HomeSpieltagHintCard.tsx`
- `src/hooks/useTeamFeedPosts.ts`
- `src/lib/autoMatchdayFeedEnabled.ts`
- `src/lib/clubBranding.ts`
- `src/lib/ensureLineupFeedPost.ts`
- `src/lib/matchdayPosterExport.ts`
- `src/lib/opponentCatalog.ts`
- `src/lib/parentLinkInvites.ts`
- `src/lib/platformClubAdmin.ts`
- `src/lib/rosterPlayer.ts`
- `src/lib/seasonLifecycle.ts`
- `src/lib/stats/playerStatsService.ts`
- `src/lib/teamViewSelection.ts`
- `src/lib/tournamentPlan.ts`
- `src/lib/trainingExercisePdfPayload.ts`
- `src/manager/ClubBrandingFields.tsx`
- `src/manager/ManagerAccessGate.tsx`
- `src/manager/ManagerClubDetailPage.tsx`
- `src/manager/ManagerClubsPage.tsx`
- `src/manager/ManagerDashboardPage.tsx`
- `src/manager/ManagerLayout.tsx`
- `src/manager/ManagerMatchVideosPage.tsx`
- `src/manager/ManagerOefbImportPage.tsx`
- `src/manager/ManagerPlatformDashboardPage.tsx`
- `src/manager/ManagerSeasonRosterPage.tsx`
- `src/manager/ManagerSpeakerStudioPage.tsx`
- `src/manager/ManagerTeamScope.tsx`
- `src/manager/ManagerWorkModeContext.tsx`
- `src/manager/components/ManagerHeader.tsx`
- `src/manager/components/ManagerMobileNav.tsx`
- `src/manager/components/ManagerSidebar.tsx`
- `src/manager/managerNav.ts`
- `src/manager/managerShell.css`
- `src/manager/managerSpeakerStudio.css`
- `src/manager/mobile/ManagerMobileMorePage.tsx`
- `src/manager/mobile/ManagerMobileTeamsPage.tsx`
- `src/pages/EventDetailPage.tsx`
- `src/pages/FanOnboardingPage.tsx`
- `src/pages/JugglingChallengePage.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/MoreHubPage.tsx`
- `src/pages/ParentAccessPlayerPage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/pages/RegisterPage.tsx`
- `src/pages/SchedulePage.tsx`
- `src/pages/SprintChallengePage.tsx`
- `src/pages/TeamPage.tsx`
- `src/pages/live/LiveMatchScreen.tsx`
- `src/styles/components.css`
- `src/styles/tokens.css`
- `src/theme/ClubThemeProvider.tsx`
- `supabase/functions/generate-club-communications/index.ts`
- `supabase/migrations/20260828043000_platform_admin_dashboard_modules.sql`
- `supabase/migrations/20260904113000_training_1100_match_rsvp_reminders.sql`
- `vercel.json`
- `vite.config.ts`
