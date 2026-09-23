'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

// Scroll-in reveal
export default function Reveal({
  children,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
