/** User-facing login errors; keep provider internals out of the login form. */
export function authErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === 'captcha_failed' || /captcha|turnstile|timeout-or-duplicate/i.test(error.message)) {
    return 'Die Sicherheitsprüfung ist abgelaufen oder konnte nicht bestätigt werden. Sie wird neu gestartet. Bitte danach erneut anmelden.';
  }
  if (error.code === 'unexpected_failure') {
    return 'Der Anmeldedienst ist vorübergehend nicht erreichbar. Bitte die neue Sicherheitsprüfung abwarten und erneut anmelden.';
  }
  return error.message;
}
