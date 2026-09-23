'use client';

import s from './landing.module.css';

type Item = { name: string; price: string };

// CSS marquee. The list is rendered twice so the track can slide by -50% and loop seamlessly.
export default function Ticker({ items }: { items: Item[] }) {
  const row = [...items, ...items];
  return (
    <div className={s.ticker} aria-hidden>
      <div className={s.tickerTrack}>
        {row.map((it, i) => (
          <span className={s.tickerItem} key={`${it.name}-${i}`}>
            <span className={s.tickerName}>{it.name}</span>
            <span className={s.tickerPrice}>{it.price}</span>
            <span className={s.tickerUp}>live</span>
          </span>
        ))}
      </div>
    </div>
  );
}
