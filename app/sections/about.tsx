import {
  Accessibility,
  Gauge,
  Layers,
  MousePointerClick,
  Sparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { expertise, profile, stack } from "@/lib/portfolio-data";
import { Tilt } from "@/components/tilt";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const expertiseIcons: Record<(typeof expertise)[number]["name"], LucideIcon> = {
  "AI-Assisted Front-End": Sparkles,
  "Design Systems": Layers,
  "Testing & Automation": Wind,
};

const principles = [
  { icon: Gauge, label: "Performance-first" },
  { icon: Accessibility, label: "Accessible by default" },
  { icon: MousePointerClick, label: "Pixel-perfect delivery" },
];

export function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="relative scroll-mt-24 overflow-x-clip px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="starfield opacity-60" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-48 top-16 size-136 rounded-full bg-nebula-blue/20 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 size-120 rounded-full bg-nebula-pink/15 blur-[130px]"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          id="about-title"
          index="01"
          label="About"
          title={
            <>
              I turn ambitious designs into{" "}
              <span className="text-nebula">fast, living interfaces.</span>
            </>
          }
        />
        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Photo */}
          <Reveal direction="left" className="lg:col-span-4">
            <div className="glass group relative h-full overflow-hidden rounded-3xl p-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                <img
                  src="/profile.webp"
                  alt={profile.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
              </div>
            </div>
          </Reveal>

          {/* Bio */}
          <Reveal direction="right" className="lg:col-span-8">
            <div className="glass h-full rounded-3xl p-7 sm:p-10">
              <p className="text-lg leading-relaxed text-white/90 sm:text-xl">
                I&apos;m {profile.name}, a {profile.role.toLowerCase()} with{" "}
                <span className="font-semibold text-white">
                  {profile.yearsOfExperience} years of experience
                </span>{" "}
                building modern web applications — now with AI tooling, design
                languages, and automation baked into the workflow.
              </p>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                My sweet spot is where design meets engineering: component
                architecture in Next.js, token-driven design systems with
                Tailwind CSS, and motion with Framer Motion and GSAP that guides
                the eye instead of distracting it. I steer AI coding tools with
                design languages and agent skills, and back everything up with
                Playwright end-to-end coverage.
              </p>
              <ul className="mt-8 flex flex-wrap gap-2.5">
                {principles.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3.5 py-2 text-sm text-white/85"
                  >
                    <Icon className="size-4 text-aurora" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Experience */}
          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="glass relative flex h-full min-h-72 flex-col justify-between overflow-hidden rounded-3xl p-7 sm:p-10">
              {/* Orbit decoration */}
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-20 size-72 rounded-full border border-white/8"
              />
              <div
                aria-hidden="true"
                className="absolute -right-6 -top-6 size-44 rounded-full border border-white/10"
              />
              <div
                aria-hidden="true"
                className="absolute right-14 top-16 size-3 rounded-full bg-aurora shadow-[0_0_24px_6px_var(--aurora)]"
              />

              <p className="relative font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Experience
              </p>
              <div className="relative mt-10">
                <p className="font-display text-[7rem] font-bold leading-none tracking-tighter text-nebula-static sm:text-[8.5rem]">
                  {profile.yearsOfExperience}
                </p>
                <p className="mt-2 text-lg text-white/90">
                  Years shipping production front-ends
                </p>
              </div>
            </div>
          </Reveal>

          {/* Expertise */}
          {expertise.map((item, index) => {
            const Icon = expertiseIcons[item.name];
            // Card #3 ("Testing & Automation") stays static — no tilt, no lift.
            const still = index === 2;
            const card = (
              <article
                className={`glass group relative h-full overflow-hidden rounded-3xl p-7 transition duration-300 hover:border-white/20${
                  still ? "" : " hover:-translate-y-1"
                }`}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-aurora/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="mb-6 grid size-12 place-items-center rounded-2xl border border-white/10 bg-linear-to-br from-nebula-blue/30 to-nebula-pink/20 text-white shadow-[0_0_30px_-8px_var(--nebula-blue)]">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-xl font-semibold text-white">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </article>
            );
            return (
              <Reveal key={item.name} delay={0.12 + index * 0.08} className="lg:col-span-4">
                {still ? (
                  card
                ) : (
                  <Tilt className="h-full" max={8} lift={6}>
                    {card}
                  </Tilt>
                )}
              </Reveal>
            );
          })}
        </div>

        {/* Tech stack marquee */}
        <Reveal className="mt-10">
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <ul
              aria-label="Tech stack"
              className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]"
            >
              {[...stack, ...stack].map((tech, index) => (
                <li
                  key={`${tech}-${index}`}
                  aria-hidden={index >= stack.length || undefined}
                  className="whitespace-nowrap rounded-full border border-white/10 bg-white/3 px-5 py-2.5 font-mono text-sm text-white/75"
                >
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
