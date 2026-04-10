import React from 'react';

type FeedCardProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article';
};

/** Einheitliche Feed-Karte (dunkel, abgerundet). */
export const FeedCard: React.FC<FeedCardProps> = ({ children, className = '', as: Tag = 'div' }) => {
  return (
    <Tag
      className={[
        'rounded-2xl border border-white/[0.08] bg-[#181818] p-5 shadow-lg',
        'text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
};
