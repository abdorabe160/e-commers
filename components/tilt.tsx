"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

type TiltProps = {
  children: ReactNode;
  className?: string;
  /** Maximum tilt angle in degrees (each axis). */
  max?: number;
  /** How many pixels the card lifts on hover. */
  lift?: number;
  /** Perspective distance in px — lower is more dramatic. */
  perspective?: number;
  /** Set to true to keep the card completely static on hover. */
  disabled?: boolean;
};

/**
 * Wraps any card in a smooth 3D tilt that follows the cursor, powered by GSAP
 * quickTo (one tween per axis, re-targeted for buttery 60fps updates).
 */
export function Tilt({
  children,
  className,
  max = 10,
  lift = 8,
  perspective = 1200,
  disabled = false,
}: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const ctx = gsap.context(() => {
      gsap.set(el, { transformPerspective: perspective });

      const rotX = gsap.quickTo(el, "rotationX", {
        duration: 0.5,
        ease: "power3.out",
      });
      const rotY = gsap.quickTo(el, "rotationY", {
        duration: 0.5,
        ease: "power3.out",
      });
      const moveY = gsap.quickTo(el, "y", {
        duration: 0.5,
        ease: "power3.out",
      });

      const onMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        rotY(px * max * 2);
        rotX(-py * max * 2);
        moveY(-lift);
      };
      const onLeave = () => {
        rotX(0);
        rotY(0);
        moveY(0);
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    }, el);

    return () => ctx.revert();
  }, [max, lift, perspective, disabled]);

  return (
    <div
      ref={ref}
      className={className}
      style={disabled ? undefined : { willChange: "transform" }}
    >
      {children}
    </div>
  );
}
