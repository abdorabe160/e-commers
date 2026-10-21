import { ArrowUp } from "lucide-react";
import { profile } from "@/lib/portfolio-data";

export function SiteFooter() {
  return (
    <footer className="relative px-4 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-muted-foreground sm:flex-row">
        <div className="space-y-1 text-center sm:text-start">
          <p>
            &copy; {new Date().getFullYear()} {profile.fullName} ({profile.name}).
            Built with Next.js, Three.js &amp; GSAP.
          </p>
          <p lang="ar" dir="rtl" className="text-white/50">
            {profile.fullNameAr} · {profile.roleAr}
          </p>
        </div>
        <a
          href="#home"
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 transition-colors hover:text-white"
        >
          Back to top
          <ArrowUp className="size-4" aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
