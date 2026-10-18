import { profile, projects, stack } from "@/lib/portfolio-data";

// Schema.org description of the person, the site and the work, for search engines.
export function StructuredData() {
  const personId = `${profile.siteUrl}/#person`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name: profile.name,
        alternateName: profile.alternateNames,
        givenName: "Abdelrahman",
        additionalName: "Mohamed",
        familyName: "Rabie",
        jobTitle: [profile.role, profile.roleAr],
        url: profile.siteUrl,
        image: `${profile.siteUrl}/profile.jpg`,
        email: `mailto:${profile.email}`,
        sameAs: [profile.github, ...profile.socials.map((social) => social.href)],
        knowsAbout: [...stack],
      },
      {
        "@type": "WebSite",
        "@id": `${profile.siteUrl}/#website`,
        url: profile.siteUrl,
        name: profile.name,
        alternateName: ["abdorabe", profile.fullName, profile.fullNameAr, "عبده ربيع"],
        inLanguage: ["en", "ar"],
        publisher: { "@id": personId },
      },
      {
        "@type": "ProfilePage",
        url: profile.siteUrl,
        name: `${profile.name} | ${profile.role}`,
        mainEntity: { "@id": personId },
        hasPart: projects.map((project) => ({
          "@type": "CreativeWork",
          name: project.title,
          description: project.summary,
          url: project.liveUrl,
          dateCreated: project.year,
          creator: { "@id": personId },
          keywords: project.tags.join(", "),
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
