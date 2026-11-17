/** User-facing login errors; keep provider internals out of the login form. */
export function authErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === 'captcha_failed' || /captcha|turnstile|timeout-or-duplicate/i.test(error.message)) {
    return 'Die Sicherheitsprüfung ist abgelaufen oder konnte nicht bestätigt werden. Sie wird neu gestartet. Bitte danach erneut anmelden.';
  }
  if (error.code === 'unexpected_failure') {
    return 'Der Anmeldedienst ist vorübergehend nicht erreichbar. Bitte die neue Sicherheitsprüfung abwarten und erneut anmelden.';
  }
  const message=error.message||'';
  if(error.code==='invalid_credentials'||/invalid login credentials/i.test(message))return 'E-Mail-Adresse oder Passwort ist falsch. Bitte prüfe deine Eingabe.';
  if(error.code==='email_not_confirmed'||/email not confirmed/i.test(message))return 'Bitte bestätige zuerst deine E-Mail-Adresse. Öffne dazu die Bestätigungsmail.';
  if(/rate_limit|over_.*rate_limit/.test(error.code||'')||/too many requests|security purposes|rate limit/i.test(message))return 'Zu viele Versuche. Bitte warte kurz und versuche es danach erneut.';
  if(error.code==='user_already_exists'||/already registered|already been registered/i.test(message))return 'Für diese E-Mail-Adresse besteht bereits ein Konto. Bitte melde dich an oder verwende „Passwort vergessen“.';
  if(error.code==='same_password'||/different from the old password/i.test(message))return 'Bitte wähle ein anderes als dein bisheriges Passwort.';
  if(error.code==='weak_password'||/password should|password must|weak password/i.test(message))return 'Das Passwort ist zu schwach. Bitte verwende ein längeres Passwort mit Buchstaben und Zahlen.';
  if(error.code==='otp_expired'||/expired|invalid.*token|token.*invalid/i.test(message))return 'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.';
  if(/fetch|network|failed to send/i.test(message))return 'Die Verbindung ist fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut.';
  if(/[äöüß]|Bitte |Dein |Deine |konnte |nicht |bereits /.test(message))return message;
  return 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut oder verwende „Passwort vergessen“.';
}
