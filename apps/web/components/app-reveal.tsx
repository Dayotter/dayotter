"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * A restrained entrance for logged-in pages — the app counterpart to marketing's
 * `Reveal`. Content here is above the fold, so it animates immediately (not on
 * scroll) with a shorter rise and faster duration than the marketing cascade.
 * Honors `prefers-reduced-motion` (renders static). Use to give app pages a
 * subtle sense of life without the heavy marketing choreography.
 */
export function AppReveal({
  children,
  delay = 0,
  y = 10,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay }}
    >
      {children}
    </motion.div>
  );
}
