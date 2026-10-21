import type { ReactNode } from "react";

import { projects, type Project } from "@/lib/portfolio-data";
import { ProjectCard } from "./project-card";
import { ProjectCover } from "./project-previews";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const previews: Record<Project["slug"], ReactNode> = {
  "lamp-store": <ProjectCover src="/lamp-banner.webp" />,
  "electronics-store-theme": <ProjectCover src="/electronics-banner.webp" />,
  "sportswear-theme": <ProjectCover src="/sportswear-banner.webp" />,
  "mish-mavin-theme": <ProjectCover src="/mish-mavin-banner.webp" />,
  "fashion-try-on": <ProjectCover src="/products/coat.webp" />,
};

export function ProjectsSection() {
  return (
    <section
      id="projects"
      aria-labelledby="projects-title"
      className="relative scroll-mt-24 overflow-x-clip px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="starfield opacity-50" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-120 w-240 -translate-x-1/2 rounded-full bg-nebula-violet/15 blur-[140px]"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionHeading
            id="projects-title"
            index="02"
            label="Selected Work"
            title="Selected Projects"
            description="Storefronts and themes I've designed and built, from product listings to checkout flow."
          />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {projects.map((project, index) => (
            <Reveal
              key={project.slug}
              delay={index * 0.12}
              className="h-full [perspective:1400px] md:last:odd:col-span-2"
            >
              <ProjectCard
                project={project}
                index={index}
                preview={previews[project.slug]}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
