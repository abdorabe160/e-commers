import { ArrowUpRight, Mail } from "lucide-react";

import { SocialIcon } from "@/components/icons";
import { profile } from "@/lib/portfolio-data";
import { ContactForm, CopyEmailButton } from "./contact-form";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { Stagger, StaggerItem } from "./stagger";

export function ContactSection() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="relative scroll-mt-24 overflow-x-clip px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24"
    >
      <div className="starfield opacity-60" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-10 size-128 rounded-full bg-nebula-pink/15 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-20 size-120 rounded-full bg-nebula-blue/20 blur-[130px]"
      />
      {/* Planet horizon, a nod to the hero (clipped to the section's bottom edge) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[calc(100%-7rem)] size-560 -translate-x-1/2 rounded-full border-t border-white/15 bg-black shadow-[0_-40px_140px_-50px_var(--nebula-blue)]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading
            id="contact-title"
            index="03"
            label="Contact"
            title={
              <>
                Let&apos;s build something <span className="text-nebula">stellar.</span>
              </>
            }
            description="Have a project in mind, a role to fill, or just want to say hi? Send a message and I'll get back to you."
          />

          <Stagger staggerDelay={0.12} className="mt-10 space-y-4">
            <StaggerItem>
              <p className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/20 bg-emerald-400/6 px-3.5 py-1.5 text-sm text-emerald-200">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                {profile.availability}
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="glass flex items-center gap-4 rounded-2xl p-3 pl-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-nebula-blue/30 to-nebula-pink/20 text-white">
                  <Mail className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Email
                  </p>
                  <a
                    href={`mailto:${profile.email}`}
                    className="block break-all text-white transition-colors hover:text-aurora sm:truncate"
                  >
                    {profile.email}
                  </a>
                </div>
                <CopyEmailButton />
              </div>
            </StaggerItem>

            <StaggerItem>
              <ul className="flex flex-wrap gap-3 pt-2">
                {profile.socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-white/3 px-4 text-sm text-white/85 transition hover:-translate-y-0.5 hover:border-white/25 hover:text-white hover:shadow-[0_0_24px_-8px_var(--nebula-blue)]"
                    >
                      <SocialIcon label={social.label} className="size-4" />
                      {social.label}
                      <ArrowUpRight className="size-3.5 text-white/40" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </StaggerItem>
          </Stagger>
        </div>

        <Reveal delay={0.15} className="lg:col-span-7">
          <div className="glass relative overflow-hidden rounded-[1.75rem] p-6 sm:p-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-aurora/70 to-transparent"
            />
            <ContactForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
