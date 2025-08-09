import React from "react";

type Props = {
  title: string;
  value: React.ReactNode;
  hint?: string;
};

export default function StatsCard({ title, value, hint }: Props) {
  return (
    <div className='stats__card'>
      <div className='stats__title'>
        {title}
        {hint ? (
          <span className='hint' title={hint} aria-label={hint}>
            i
          </span>
        ) : null}
      </div>
      <div className='stats__value'>{value}</div>
    </div>
  );
}
