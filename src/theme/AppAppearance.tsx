import React, { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { isProductionApp } from '../lib/appEnvironment';
import { dsGlassIconButtonClass } from '../lib/premiumDesignSystem';
import { useAppAppearance } from './appAppearance';
import './appAppearance.css';

export function AppAppearanceToggle() {
  const { appearance, toggleAppearance } = useAppAppearance();
  if (isProductionApp()) return null;
  const label = appearance === 'dark' ? 'Tagmodus aktivieren' : 'Nachtmodus aktivieren';
  return (
    <button
      type="button"
      className={`${dsGlassIconButtonClass()} app-appearance-toggle`}
      onClick={toggleAppearance}
      aria-label={label}
      title={label}
    >
      {appearance === 'dark' ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  );
}

/** Apply the device preference only inside the test app, including portal dialogs. */
export function AppAppearanceSync() {
  const { pathname } = useLocation();
  const { appearance } = useAppAppearance();
  const active = !isProductionApp() && /^\/(app|demo)(\/|$)/.test(pathname);

  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousColor = meta?.getAttribute('content');
    root.dataset.appAppearance = appearance;
    meta?.setAttribute('content', appearance === 'light' ? '#ffffff' : '#0b0b0f');
    return () => {
      delete root.dataset.appAppearance;
      if (meta) {
        if (previousColor == null) meta.removeAttribute('content');
        else meta.setAttribute('content', previousColor);
      }
    };
  }, [active, appearance]);

  return active ? (
    <div
      aria-hidden
      data-app-chrome-edge
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'max(1px, env(safe-area-inset-top, 0px))',
        background: appearance === 'light' ? '#ffffff' : '#0b0b0f',
        pointerEvents: 'none', zIndex: 2147483646,
      }}
    />
  ) : null;
}
