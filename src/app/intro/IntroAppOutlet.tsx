import React from 'react';
import { Outlet } from 'react-router-dom';

/** Shell unter /app: rendert Intro-Routen oder InternalLayout + Outlet. */
export const IntroAppOutlet: React.FC = () => <Outlet />;
