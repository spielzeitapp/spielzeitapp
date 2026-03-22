import React from 'react';
import { Outlet } from 'react-router-dom';

/** Shell für /app/mehr/* (Hub, Profil, Nachrichten). */
export const MoreLayout: React.FC = () => {
  return (
    <div className="w-full">
      <Outlet />
    </div>
  );
};
