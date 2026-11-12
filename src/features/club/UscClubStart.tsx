import React, { useEffect, useState } from "react";
import { ClubLogo } from "../../components/branding/ClubLogo";
import { USC_LOGO } from "./uscClub";

export const USC_START_PHOTO = "/clubs/usc-rohrbach/welcome-action.jpg";
const SESSION_KEY = "usc_start_seen_v1";
function shouldShowStart(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return false;
  try { return !window.sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}
export function UscClubStart({ enabled, ready }: { enabled: boolean; ready: boolean }) {
  const [visible, setVisible] = useState(() => shouldShowStart(enabled));
  const dismiss = () => {
    try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* Optional visual only. */ }
    setVisible(false);
  };
  useEffect(() => {
    if (!visible || !ready) return;
    const timer = window.setTimeout(dismiss, 1400);
    return () => window.clearTimeout(timer);
  }, [visible, ready]);
  // Always dismissible; do not hold the app behind a failed image or network request.
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(dismiss, 3500);
    return () => window.clearTimeout(timer);
  }, [visible]);
  if (!visible) return null;
  return <div className="usc-start" role="region" aria-label="USC Fotostart">
    <img className="usc-start-photo" src={USC_START_PHOTO} alt="USC-Spieler am Ball" />
    <ClubLogo className="usc-start-logo" src={USC_LOGO} removeDarkBackground alt="USC Rohrbach" />
    <div className="usc-start-copy"><h1>DEIN VEREIN.<br />IMMER DABEI.</h1><p>#GEMEINSAMSTARK</p><button className="usc-action" type="button" onClick={dismiss}>Zum USC</button><small>USC Rohrbach · powered by SpielzeitApp</small></div>
  </div>;
}
