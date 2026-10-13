/** Manager pages are authenticated workspaces, like /app; public schedules stay read-only. */
export function isPublicSchedulePath(pathname: string, managerSimpleMode = false): boolean {
  if (managerSimpleMode) return false;
  return !['/app', '/demo', '/manager'].some(base => pathname === base || pathname.startsWith(`${base}/`));
}
