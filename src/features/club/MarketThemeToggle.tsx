import React from 'react';import {Sun,Moon} from 'lucide-react';
import {useMarketTheme} from './marketTheme';
export function MarketThemeToggle(){const {theme,toggle}=useMarketTheme();const label=theme==='dark'?'Tagmodus aktivieren':'Nachtmodus aktivieren';return <button type="button" className="market-theme-toggle" onClick={toggle} aria-label={label} title={label}>{theme==='dark'?<Sun size={20} aria-hidden="true"/>:<Moon size={20} aria-hidden="true"/>}</button>;}
