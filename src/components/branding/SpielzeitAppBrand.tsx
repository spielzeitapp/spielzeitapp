import React from 'react';
import spielzeitappIcon from '../../assets/branding/spielzeitapp-icon.png';

const WORDMARK_PATH = `${import.meta.env.BASE_URL || '/'}intro/spielzeitapp-wordmark-angular.jpeg`;

type WordmarkProps = {
  className?: string;
  label?: string;
};

/** Offizielle Wortmarke mit kantigem roten A; schwarzer Bildgrund wird auf dunklen Flächen ausgeblendet. */
export function SpielzeitAppWordmark({ className = '', label = 'SpielzeitApp' }: WordmarkProps) {
  return (
    <img
      src={WORDMARK_PATH}
      alt={label}
      className={`block h-auto object-contain mix-blend-screen ${className}`}
      width={689}
      height={141}
      decoding="async"
    />
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
