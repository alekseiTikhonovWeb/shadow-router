'use client';

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import s from './landing.module.css';
import MockupScreens from './MockupScreens';

// Only transform / opacity are animated; reduced-motion turns everything off.

const EASE = [0.16, 1, 0.3, 1] as const;

const line = {
  hidden: { y: '110%' },
  show: (i: number) => ({
    y: '0%',
    transition: { duration: 0.9, delay: 0.15 + i * 0.12, ease: EASE },
  }),
};

export default function Hero({ ctas }: { ctas: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0); // -1..1 across the width
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 60, damping: 18 });
  const smy = useSpring(my, { stiffness: 60, damping: 18 });

  const rotateY = useTransform(smx, [-1, 1], [6, -6]);
  const rotateX = useTransform(smy, [-1, 1], [-4, 4]);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  return (
    <section className={s.hero} onMouseMove={reduce ? undefined : onMove} ref={ref}>
      <div className={`container ${s.heroInner}`}>
        <div>
          <motion.p
            className="eyebrow"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            Private AI gateway
          </motion.p>

          <h1 className={s.heroTitle} style={{ marginTop: 16 }}>
            {[
              { text: 'All the models.', accent: false },
              { text: 'None of', accent: false },
              { text: 'your data.', accent: true },
            ].map((l, i) => (
              <span className={s.heroTitleLine} key={l.text}>
                <motion.span
                  style={{ display: 'block' }}
                  className={l.accent ? s.heroTitleNone : undefined}
                  variants={line}
                  custom={i}
                  initial={reduce ? false : 'hidden'}
                  animate="show"
                >
                  {l.text}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className={s.heroSub}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          >
            Chat with GPT, Gemini and more. One account, one balance. No email.
            No KYC. Prompts never stored. Pay in crypto, start in 20 seconds.
          </motion.p>

          <motion.div
            className={s.heroCtas}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
          >
            {ctas}
          </motion.div>

        </div>

        <motion.div
          className={s.deviceWrap}
          initial={reduce ? false : { opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.45, ease: EASE }}
        >
          {/* Live screen content is projected onto the mockup (MockupScreens); the cursor tilt is on this wrapper. */}
          <motion.div
            className={s.heroMockup}
            style={reduce ? undefined : { rotateX, rotateY }}
          >
            <img
              src="/mockups/iphones-isometric.svg"
              alt=""
              className={s.heroMockupImg}
              draggable={false}
            />
            {/* screen content + calibration mode (/?calibrate=1) */}
            <MockupScreens />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
