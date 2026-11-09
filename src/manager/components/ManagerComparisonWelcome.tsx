import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, FlaskConical, Globe2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile, getDisplayFirstName } from '../../auth/useProfile';
import { isStagingApp } from '../../lib/appEnvironment';

type Props = {
  clubName?: string;
  season?: string | null;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  stats?: Array<{label:string;value:number;hint:string}>;
};

/** Shared visual entry for the real platform and club workspace. No placeholder club data. */
export function ManagerComparisonWelcome({clubName,season,actionLabel,actionTo,onAction,stats}:Props) {
  const {user}=useAuth();
  const {profile}=useProfile(user?.id);
  const name=getDisplayFirstName(profile);
  const hour=Number(new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',hour:'numeric',hourCycle:'h23'}).format(new Date()));
  const greeting=hour>=5&&hour<12?'Guten Morgen':hour>=12&&hour<18?'Guten Tag':'Guten Abend';
  const staging=isStagingApp();
  const action=<>{actionLabel??(clubName?'Verein einrichten':'Verein auswählen')}<ArrowRight size={23} aria-hidden /></>;
  return <div className="central-welcome">
    <div className="central-greeting">
      <p className="central-eyebrow">{clubName??'SPIELZEITAPP'} · {clubName?'VEREINSZENTRALE':'PLATTFORMZENTRALE'}</p>
      <h1>{greeting}{name?`, ${name}`:''}.</h1>
      <p>{clubName?'Hier läuft alles zusammen. Bereit für den nächsten Spieltag?':'Deine Vereine. Deine Mannschaften. Alles an einem Ort.'}</p>
    </div>
    <div className="central-program-flow" aria-label="Arbeitsbereich und Programmstand">
      <span><Activity size={20} aria-hidden /><strong>Manager</strong><small>Datenpflege</small></span>
      <ArrowRight size={16} aria-hidden />
      <span><strong><FlaskConical size={14} aria-hidden />TEST</strong><small>{staging?'Diese Umgebung':'Separate Umgebung'}</small></span>
      <ArrowRight size={16} aria-hidden />
      <Link to="/manager/live-veroeffentlichung"><strong><Globe2 size={14} aria-hidden />LIVE</strong><small>Stand prüfen ↗</small></Link>
    </div>
    <section className="central-hero" aria-label={clubName?'Deine Vereinszentrale':'Deine Plattformzentrale'}>
      <div className="central-hero-copy">
        <p className="central-eyebrow">{season?`SAISON ${season}`:clubName?'DEIN VEREIN':'DEIN ÜBERBLICK'} <span>• {clubName?'VEREIN':'PLATTFORM'}</span></p>
        <h2>{clubName?'Ein Team.':'Deine Vereine.'}<br />Eine Zentrale.</h2>
        <p>Von der ersten Trainingseinheit bis zum Abpfiff.<br />{clubName?'Alles, was deinen Verein bewegt.':'Alles, was eure Vereine bewegt.'}</p>
        {onAction?<button type="button" onClick={onAction} className="central-hero-action">{action}</button>:<Link to={actionTo??'/manager/vereine'} className="central-hero-action">{action}</Link>}
      </div>
      <div className="central-pitch" aria-hidden="true">
        <svg viewBox="0 0 240 330" fill="none"><rect x="10" y="10" width="220" height="310" rx="6"/><path d="M10 165h220M75 10v48h90V10M75 320v-48h90v48"/><circle cx="120" cy="165" r="38"/>{[[63,88,4],[176,88,5],[120,165,10],[62,234,7],[177,234,8],[120,292,1]].map(([cx,cy,n])=><g key={n}><circle cx={cx} cy={cy} r="16" className={n===10?'central-pitch-player central-pitch-player-active':'central-pitch-player'}/><text x={cx} y={cy+4}>{n}</text></g>)}</svg>
        <span>#GEMEINSAM</span>
      </div>
    </section>
    {stats&&<div className="central-club-metrics">{stats.map(stat=><article key={stat.label}><strong>{stat.value}</strong><h3>{stat.label}</h3><p>{stat.hint}</p></article>)}</div>}
  </div>;
}
