# Why magic-link emails work but signup confirmation emails don’t

## 1. Code: signUp vs magic-link

| Aspect | Magic link (working) | Signup confirmation (current) |
|--------|----------------------|-------------------------------|
| Method | `signInWithOtp({ email, options: { emailRedirectTo } })` | `signUp({ email, password, options: { data, emailRedirectTo } })` |
| Redirect | `emailRedirectTo` was set (e.g. `https://app.spielzeitapp.at/app`) | **Was missing** → now set to `EMAIL_REDIRECT_TO` in `RegisterPage.tsx` |
| Template (Supabase) | “Magic Link” | “Confirm signup” (separate template) |

## 2. Supabase dashboard checks

- **Authentication → Providers → Email**
  - Is **“Confirm email”** turned **on**?  
    If it’s off, Supabase does **not** send a confirmation email on signup (and may return a session immediately).
- **Authentication → URL Configuration**
  - Add `https://app.spielzeitapp.at/app` (and `/app` if needed) to **Redirect URLs** so the confirmation link is allowed.
- **Authentication → Email Templates**
  - **Magic Link** = template used by `signInWithOtp` (this one works).
  - **Confirm signup** = template used when “Confirm email” is on.
  - Compare: same SMTP/sender, subject, and that “Confirm signup” is enabled. Check for typos in `{{ .ConfirmationURL }}` or `{{ .RedirectTo }}`.

## 3. What the app does now

- **emailRedirectTo** is set in `signUp` options to `https://app.spielzeitapp.at/app`.
- **Console logging** in `RegisterPage` after `signUp`:
  - `hasData`, `hasError`, `errorMessage`, `errorCode`
  - `hasSession`, `hasUser`, `userIdentitiesLength`, `userEmailConfirmed`, `userId`
- If **identities.length === 0** (e.g. email already registered), a warning is logged: Supabase typically does **not** send another confirmation email in that case.

## 4. How to find the exact cause

1. Register a **new** email (never used in this project) and watch the browser console for `[RegisterPage] signUp result:`.
2. If `hasError` is true → show/use `errorMessage` and `errorCode` (they’re already logged).
3. If `hasSession` is true → “Confirm email” is likely **off** in Supabase; no confirmation email is sent.
4. If `hasSession` is false and `userIdentitiesLength === 0` → email may already be registered; no new confirmation email.
5. If no error, no session, identities.length > 0 → Supabase should send the “Confirm signup” email; then check **Authentication → Email Templates → Confirm signup** and SMTP/rate limits.

## 5. Reference

- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase signUp options](https://supabase.com/docs/reference/javascript/auth-signup) (`emailRedirectTo` under `options`)
