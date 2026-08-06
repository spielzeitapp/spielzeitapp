import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { DemoProvider } from './DemoContext';

/**
 * Nur DemoProvider + Outlet.
 * Splash/Welcome und produktives InternalLayout kommen über die Routen — kein eigenes Demo-Shell.
 */
export function DemoLayout(): React.ReactElement {
  useEffect(() => {
    document.title = 'SpielzeitApp Trainer-Demo';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Teste SpielzeitApp mit einem vollständig vorbereiteten U12-Demoteam.',
    );
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
    return () => {
      document.title = 'Spielzeit';
    };
  }, []);

  return (
    <DemoProvider>
      <Outlet />
    </DemoProvider>
  );
}
