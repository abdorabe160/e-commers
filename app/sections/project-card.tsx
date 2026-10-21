"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { ArrowUpRight } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { Project } from "@/lib/portfolio-data";

gsap.registerPlugin(ScrollTrigger);

type ProjectCardProps = {
  project: Project;
  index: number;
  preview: ReactNode;
};

export function ProjectCard({ project, index, preview }: ProjectCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Feed the pointer position to CSS so the spotlight follows the cursor.
  const trackPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  useEffect(() => {
    const card = cardRef.current;
    const preview = previewRef.current;
    const depth = depthRef.current;
    const content = contentRef.current;
    const sheen = sheenRef.current;
    if (!card || !preview || !depth || !content || !sheen) return;

    const teardown: Array<() => void> = [];
    const tags = tagRefs.current.filter(Boolean) as HTMLLIElement[];

    const ctx = gsap.context(() => {
      /* ── 1. Cursor tilt: the card leans toward the pointer ── */
      const rotX = gsap.quickTo(card, "rotationX", {
        duration: 0.5,
        ease: "power3.out",
      });
      const rotY = gsap.quickTo(card, "rotationY", {
        duration: 0.5,
        ease: "power3.out",
      });
      const lift = gsap.quickTo(card, "y", {
        duration: 0.5,
        ease: "power3.out",
      });

      /* ── 2. Depth layers: preview counter-moves, text drifts along ── */
      const previewX = gsap.quickTo(preview, "x", {
        duration: 0.6,
        ease: "power3.out",
      });
      const previewY = gsap.quickTo(preview, "y", {
        duration: 0.6,
        ease: "power3.out",
      });
      const contentX = gsap.quickTo(content, "x", {
        duration: 0.6,
        ease: "power3.out",
      });

      /* ── 3. Sheen sweep is skewed by GSAP so inline transforms don't clash ── */
      gsap.set(sheen, { skewX: -14 });

      const onMove = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        rotY(px * 11);
        rotX(-py * 9);
        lift(-6);
        previewX(-px * 16);
        previewY(-py * 12);
        contentX(px * 6);
      };

      const onEnter = () => {
        // Diagonal light sweep across the preview window.
        gsap.fromTo(
          sheen,
          { xPercent: -60, opacity: 1 },
          {
            xPercent: 460,
            opacity: 0,
            duration: 1,
            ease: "power2.out",
            overwrite: "auto",
          }
        );
        // Tech tags pop up in a quick wave.
        if (tags.length) {
          gsap.to(tags, {
            y: -4,
            duration: 0.35,
            stagger: 0.05,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
      };

      const onLeave = () => {
        rotX(0);
        rotY(0);
        lift(0);
        previewX(0);
        previewY(0);
        contentX(0);
        if (tags.length) {
          gsap.to(tags, {
            y: 0,
            duration: 0.4,
            stagger: 0.03,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
      };

      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointerleave", onLeave);
      teardown.push(() => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerenter", onEnter);
        card.removeEventListener("pointerleave", onLeave);
      });

      /* ── 5. Scroll-scrubbed parallax inside the preview window ── */
      gsap.fromTo(
        depth,
        { yPercent: -5 },
        {
          yPercent: 5,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        }
      );

      /* ── 6. Text content rises in as the card enters the viewport ── */
      gsap.from(content.children, {
        y: 26,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 80%", once: true },
      });
    }, card);

    return () => {
      teardown.forEach((fn) => fn());
      ctx.revert();
    };
  }, []);

  return (
    <article
      ref={cardRef}
      onPointerMove={trackPointer}
      aria-labelledby={`${project.slug}-title`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/3 backdrop-blur-xl transition-[border-color,box-shadow] duration-500 focus-within:border-white/25 hover:border-white/20 hover:shadow-[0_30px_80px_-40px_rgba(99,102,241,0.5)]"
    >
      {/* Cursor spotlight + top edge glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(460px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgb(130 160 255 / 0.14), transparent 45%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-white/40 to-transparent"
      />

      {/* Full-card link: sits on top of everything so a click anywhere opens the live project. */}
      <a
        href={project.liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit the ${project.title} live site (opens in a new tab)`}
        className="absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
      />

      <div className="relative p-3 pb-0">
        <div
          role="img"
          aria-label={`Illustrated preview of the ${project.title} interface`}
          className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0a10]"
        >
          {/* Hover parallax layer */}
          <div ref={previewRef} className="absolute inset-0">
            {/* Scroll-scrub layer, oversized so parallax never shows edges */}
            <div ref={depthRef} className="absolute -inset-[7%]">
              {preview}
            </div>
          </div>

          {/* Diagonal sheen sweep */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              ref={sheenRef}
              className="absolute left-0 top-0 h-full w-1/4 bg-linear-to-r from-transparent via-white/30 to-transparent opacity-0"
            />
          </div>
        </div>
      </div>

      <div ref={contentRef} className="relative flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>
            <span className="text-aurora">{String(index + 1).padStart(2, "0")}</span>
            {" / "}
            {project.category}
          </span>
          <span>{project.year}</span>
        </div>

        <h3
          id={`${project.slug}-title`}
          className="mt-4 font-display text-3xl font-semibold tracking-tight text-white"
        >
          <span className="inline-flex items-center gap-2">
            {project.title}
            <ArrowUpRight
              className="size-6 shrink-0 text-white/40 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-aurora"
              aria-hidden="true"
            />
          </span>
        </h3>
        <p className="mt-2 text-base text-white/90">{project.summary}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>

        <ul aria-label="Technologies" className="mt-auto flex flex-wrap gap-2 pt-6">
          {project.tags.map((tag, tagIndex) => (
            <li
              key={tag}
              ref={(el) => {
                tagRefs.current[tagIndex] = el;
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
