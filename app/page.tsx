import { MotionProvider } from "@/components/motion-provider";
import { Navigation } from "@/components/navigation";
import { HorizonHeroSection } from "@/components/ui/horizon-hero-section";
import { AboutSection } from "@/app/sections/about";
import { ContactSection } from "@/app/sections/contact";
import { SiteFooter } from "@/app/sections/footer";
import { ProjectsSection } from "@/app/sections/projects";
import { SkillsSection } from "@/app/sections/skills";
import { StructuredData } from "@/app/structured-data";

export default function Home() {
  return (
    <MotionProvider>
      <StructuredData />
      <Navigation />
      <main>
        <HorizonHeroSection />
        <AboutSection />
        <ProjectsSection />
        <SkillsSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </MotionProvider>
  );
}
