'use client';

import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion, animate } from 'framer-motion';

// Counts up from 0 to `value` once it scrolls into view.
export default function Counter({
  value,
  prefix = '',
  suffix = '',
  duration = 1.4,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!ref.current) return;
    if (!inView) return;
    if (reduce) {
      ref.current.textContent = `${prefix}${value}${suffix}`;
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = `${prefix}${Math.round(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, value, prefix, suffix, duration, reduce]);

  return <span ref={ref}>{`${prefix}0${suffix}`}</span>;
}
