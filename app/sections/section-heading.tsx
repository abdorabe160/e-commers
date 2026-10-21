import type { ReactNode } from "react";
import { Reveal } from "./reveal";

type SectionHeadingProps = {
  id: string;
  index: string;
  label: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function SectionHeading({
  id,
  index,
  label,
  title,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <Reveal className={className}>
      <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        <span className="text-aurora">{index}</span>
        <span
          aria-hidden="true"
          className="h-px w-10 bg-linear-to-r from-aurora/70 to-transparent"
        />
        {label}
      </p>
      <h2
        id={id}
        className="mt-5 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </Reveal>
  );
}
