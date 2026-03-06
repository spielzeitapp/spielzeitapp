import React from 'react';

export const AppBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <div className="bg-glow" />
      <img className="bg-watermark" src={`${import.meta.env.BASE_URL}logos/nsg-goelsental.png`} alt="" />
      <div className="bg-vignette" />
      <div className="app-shell appShell">{children}</div>
    </>
  );
};
