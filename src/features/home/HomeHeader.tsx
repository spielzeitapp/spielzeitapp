import React from 'react';

type HomeHeaderProps = {
  welcomeLine: string;
  teamName: string;
};

export const HomeHeader: React.FC<HomeHeaderProps> = ({ welcomeLine, teamName }) => {
  return (
    <header className="space-y-1 pb-2 pt-1">
      <h1 className="text-2xl font-bold leading-tight text-white">{welcomeLine}</h1>
      <p className="text-base text-white/55">Überblick · {teamName}</p>
    </header>
  );
};
