"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type StaggerProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  delay?: number;
};

// Parent container that reveals its children one after another.
export function Stagger({
  children,
  className,
  staggerDelay = 0.1,
  delay = 0,
}: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  from?: "up" | "left" | "scale";
};

// Child of a <Stagger>; animates in with a small offset when its turn arrives.
export function StaggerItem({
  children,
  className,
  from = "up",
}: StaggerItemProps) {
  const offsets = {
    up: { y: 24 },
    left: { x: -24 },
    scale: { scale: 0.95 },
  } as const;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, ...offsets[from] },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
