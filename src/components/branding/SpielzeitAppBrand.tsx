import React from 'react';
import spielzeitappIcon from '../../assets/branding/spielzeitapp-icon.png';

const WORDMARK_PATH = `${import.meta.env.BASE_URL || '/'}intro/spielzeitapp-wordmark-angular.jpeg`;

type WordmarkProps = {
  className?: string;
  label?: string;
};

/** Exakter Marken-Schriftzug mit dem kantigen roten A. */
export function SpielzeitAppWordmark({ className = '', label = 'SpielzeitApp' }: WordmarkProps) {
  return (
    <svg
      viewBox="280 34 640 126"
      className={`block overflow-visible mix-blend-screen ${className}`}
      role="img"
      aria-label={label}
    >
      <image href={WORDMARK_PATH} width="1206" height="180" />
    </svg>
  );
}

type BrandProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  label?: string;
};

/** Einheitliche horizontale Marke für Header, Login und Welcome. */
export function SpielzeitAppBrand({
  className = '',
  iconClassName = 'h-12 w-12',
  wordmarkClassName = 'w-44',
  label = 'SpielzeitApp',
}: BrandProps) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-label={label} role="img">
      <img
        src={spielzeitappIcon}
        alt=""
        className={`shrink-0 object-contain ${iconClassName}`}
        width={512}
        height={512}
        decoding="async"
      />
      <SpielzeitAppWordmark className={`-ml-1 shrink-0 ${wordmarkClassName}`} label="" />
    </span>
  );
}
