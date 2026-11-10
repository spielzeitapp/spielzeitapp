import React from 'react';
import {SpielzeitAppBrand} from '../../components/branding/SpielzeitAppBrand';

/** Use the same original image assets as the app, including the red angular A. */
export function ManagerCentralBrand({compact = false}: {compact?: boolean}) {
  return <span className={'szc-original-brand' + (compact ? ' szc-original-brand--compact' : '')}>
    <SpielzeitAppBrand className="szc-original-brand-mark" iconClassName="szc-original-brand-icon" wordmarkClassName="szc-original-brand-wordmark"/>
    {!compact && <small>VEREINSZENTRALE</small>}
  </span>;
}
