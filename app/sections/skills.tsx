"use client";

import { motion } from "framer-motion";

import { Tilt } from "@/components/tilt";
import { skills } from "@/lib/portfolio-data";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function SkillsSection() {
  return (
    <section
      id="skills"
      aria-labelledby="skills-title"
      className="relative scroll-mt-24 overflow-x-clip px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="starfield opacity-40" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 top-1/4 size-144 rounded-full bg-nebula-violet/12 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-1/4 size-120 rounded-full bg-nebula-blue/15 blur-[130px]"
      />

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="flex items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <span className="text-aurora">03</span>
            <span
              aria-hidden="true"
              className="h-px w-10 bg-linear-to-r from-aurora/70 to-transparent"
            />
            Skills
            <span
              aria-hidden="true"
              className="h-px w-10 bg-linear-to-l from-aurora/70 to-transparent"
            />
          </p>
          <h2
            id="skills-title"
            className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Tools I <span className="text-nebula">work with</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            The AI tooling, design languages, and automation stack behind
            everything I ship — and contribute to.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10% 0px" }}
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {skills.map((tool) => {
            const card = (
              <article className="glass group relative flex h-full flex-col overflow-hidden rounded-3xl p-6 transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(61,107,255,0.55)] sm:p-8">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-20 -right-14 size-44 rounded-full bg-nebula-violet/25 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-aurora/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="relative flex items-start justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                    {tool.category}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {tool.year}
                  </span>
                </div>

                <h3 className="relative mt-5 font-display text-2xl font-semibold tracking-tight text-white">
                  {tool.title}
                </h3>
                <p className="relative mt-1.5 text-sm font-medium text-aurora">
                  {tool.summary}
                </p>
                <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>

                <ul
                  aria-label={`${tool.title} topics`}
                  className="relative mt-5 flex flex-wrap gap-2"
                >
                  {tool.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>

                <div className="relative mt-6 flex items-center justify-between border-t border-white/8 pt-5">
                  <span className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full bg-[#3178c6]"
                      />
                      {tool.language}
                    </span>
                    <span aria-hidden="true" className="text-white/15">
                      /
                    </span>
                    <span>★ {tool.stars}</span>
                  </span>
                </div>
              </article>
            );

            return (
              <motion.div
                key={tool.slug}
                variants={itemVariants}
                className="h-full"
              >
                <Tilt className="h-full" max={7} lift={8}>
                  {card}
                </Tilt>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
