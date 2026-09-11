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
        'sz-club-feed-shell rounded-2xl border p-5 shadow-lg',
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
