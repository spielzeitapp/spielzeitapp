import { USC_APP_PATH, isUscAppPath } from "./uscClub";
const AUTH_SUFFIXES = new Set([
  "anmelden",
  "registrieren",
  "passwort-vergessen",
]);
export type UscAuthScreen = "anmelden" | "registrieren" | "passwort-vergessen";
/** A club return URL is presentation/navigation context, never an access grant. */
export function safeUscReturn(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://club.invalid");
    if (url.origin !== "https://club.invalid" || url.pathname !== USC_APP_PATH)
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
export function uscAuthTarget(pathname: string, search: string): string | null {
  const requested = safeUscReturn(new URLSearchParams(search).get("next"));
  if (
    isUscAppPath(pathname) &&
    AUTH_SUFFIXES.has(pathname.slice(USC_APP_PATH.length + 1))
  )
    return requested ?? USC_APP_PATH;
  return [
    "/login",
    "/register",
    "/forgot-password",
    "/app/set-password",
  ].includes(pathname)
    ? requested
    : null;
}
export function uscAuthPath(
  screen: UscAuthScreen,
  returnTo: string = USC_APP_PATH,
): string {
  return `${USC_APP_PATH}/${screen}?next=${encodeURIComponent(safeUscReturn(returnTo) ?? USC_APP_PATH)}`;
}
