'use client';

import { useState } from 'react';
import s from './landing.module.css';

// At most one item open: opening one closes the other in the same frame.
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={s.faq}>
      {items.map((f, i) => (
        <div className={s.faqItem} key={f.q}>
          <button
            type="button"
            className={s.faqQ}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {f.q}
            <span className={s.faqIcon} aria-hidden>
              +
            </span>
          </button>
          <div className={s.faqA} data-open={open === i ? '' : undefined}>
            <div className={s.faqAInner}>
              <p className={s.faqBody}>{f.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
