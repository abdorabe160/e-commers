"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "scale";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: Direction;
};

const directions: Record<Direction, { x?: number; y?: number; scale?: number }> = {
  up: { y: 24 },
  down: { y: -24 },
  left: { x: -32 },
  right: { x: 32 },
  scale: { scale: 0.94 },
};

// Fades content in from a chosen direction once it enters the viewport.
export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.7,
  direction = "up",
}: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...directions[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
