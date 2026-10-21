// Single source of truth for the portfolio's personal content.
// Everything marked "placeholder" is meant to be replaced with your real details.

export const profile = {
  name: "Abdo Rabe",
  fullName: "Abdelrahman Mohamed Rabie",
  fullNameAr: "عبدالرحمن محمد ربيع",
  roleAr: "مطور واجهات أمامية",
  // Other spellings people search for (Arabic, transliterations, nickname, site name).
  alternateNames: [
    "Abdelrahman Mohamed Rabie",
    "Abdelrahman Rabie",
    "Abdulrahman Mohamed Rabie",
    "Abdel Rahman Rabie",
    "Abdo Rabie",
    "Abdo Rabe",
    "abdorabe",
    "عبدالرحمن محمد ربيع",
    "عبد الرحمن محمد ربيع",
    "عبدالرحمن ربيع",
    "عبده ربيع",
  ],
  initials: "AR",
  role: "Front-End Developer",
  yearsOfExperience: 3,
  location: "Egypt",
  locationAr: "مصر",
  countryCode: "EG",
  email: "abdorabe160@gmail.com",
  siteUrl: "https://abdorabe.vercel.app",
  github: "https://github.com/abdorabe160",
  availability: "Open to new opportunities",
  socials: [
    {
      label: "Facebook",
      href: "https://www.facebook.com/share/1Hked52YGr/",
    },
    {
      label: "Instagram",
      href: "https://www.instagram.com/abdo_rabe30_0",
    },
    {
      label: "WhatsApp",
      href: "https://wa.me/201030152633",
    },
  ],
  // Optional form backend (Formspree, Getform, Basin, ...). When unset, the
  // contact form opens the visitor's email app pre-filled instead.
  contactFormEndpoint: process.env.NEXT_PUBLIC_CONTACT_FORM_ENDPOINT,
} as const;

export const expertise = [
  {
    name: "AI-Assisted Front-End",
    description:
      "Steering AI coding tools with design languages and agent skills so generated interfaces stay on-brand, intentional, and free of generic defaults.",
  },
  {
    name: "Design Systems",
    description:
      "Token-driven systems, reusable components, and responsive layouts that stay consistent across themes, stores, and marketing pages.",
  },
  {
    name: "Testing & Automation",
    description:
      "End-to-end coverage with Playwright: cross-browser specs, auto-waiting locators, and automated checks that keep shipping fast and safe.",
  },
] as const;

export const stack = [
  "React",
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "Framer Motion",
  "GSAP",
  "Three.js",
  "Playwright",
  "MCP",
  "AI Tooling",
] as const;

export type Project = {
  slug:
    | "decafe-coffee-theme"
    | "lamp-store"
    | "electronics-store-theme"
    | "sportswear-theme"
    | "mish-mavin-theme"
    | "fashion-try-on";
  title: string;
  category: string;
  year: string;
  summary: string;
  description: string;
  tags: readonly string[];
  liveUrl?: string;
  sourceUrl?: string;
};

export const projects: readonly Project[] = [
  {
    slug: "decafe-coffee-theme",
    title: "DECAFE Coffee Theme",
    category: "E-commerce Theme",
    year: "2026",
    summary: "A premium specialty coffee store theme with a dark, warm roastery feel.",
    description:
      "A specialty coffee storefront for Qumra Cloud: a cinematic pour-over hero, shop-by-category cards, a farm-to-cup coffee journey, product quick view, and a coffee journal, all in Arabic and English with full RTL support.",
    tags: ["Theme Development", "Tailwind CSS", "Alpine.js", "RTL", "Bilingual"],
    liveUrl: "https://coffee.qumra.store/",
    sourceUrl: "#", // placeholder: your repo link
  },
  {
    slug: "fashion-try-on",
    title: "3D Fashion Try-On",
    category: "E-commerce Storefront",
    year: "2026",
    summary: "An Arabic fashion store where 3D characters try on every piece you pick.",
    description:
      "A Three.js storefront with male and female 3D characters: every garment is fitted on the body itself, layers over what's already worn, and moves with the character as it stands, walks and puts the clothes on.",
    tags: ["Three.js", "3D", "Next.js", "RTL", "E-commerce"],
    liveUrl: "/fashion",
  },
  {
    slug: "lamp-store",
    title: "Lamp Lighting Store",
    category: "E-commerce Storefront",
    year: "2026",
    summary: "A premium Arabic storefront for home LED lighting with a day/night mode.",
    description:
      "An RTL lighting store built with Next.js: a lights on/off toggle that swaps every scene from day to night, an ivory and champagne-gold palette, a filterable catalog with search and sorting, and a slide-out cart.",
    tags: ["Next.js", "Day / Night Mode", "RTL", "Responsive UI", "E-commerce"],
    liveUrl: "https://lamp-store-one.vercel.app/",
    sourceUrl: "#", // placeholder: your repo link
  },
  {
    slug: "electronics-store-theme",
    title: "Electronics Store Theme",
    category: "E-commerce Theme",
    year: "2026",
    summary: "A liquid glass e-commerce theme for an electronics store.",
    description:
      "A full electronics store theme built with a liquid glass design: frosted translucent panels, soft blur layers, and vibrant gradients over an RTL storefront with category navigation, product listings, and offers.",
    tags: ["Liquid Glass", "Theme Development", "CSS Animations", "Responsive UI", "RTL"],
    liveUrl: "https://electronics-store.qumra.store/",
    sourceUrl: "#", // placeholder: your repo link
  },
  {
    slug: "sportswear-theme",
    title: "Sportswear Theme",
    category: "E-commerce Theme",
    year: "2026",
    summary: "A sportswear store theme built for apparel brands.",
    description:
      "A dedicated theme for a sportswear brand: bold product grids, filterable collections, and a streamlined checkout flow, all wrapped in a liquid glass interface that keeps the focus on the apparel.",
    tags: ["Theme Development", "Liquid Glass", "CSS Animations", "Responsive UI", "RTL"],
    liveUrl: "https://bulk.qumra.store/",
    sourceUrl: "#", // placeholder: your repo link
  },
  {
    slug: "mish-mavin-theme",
    title: "Mish-Mavin Apparel Theme",
    category: "E-commerce Theme",
    year: "2026",
    summary: "A clean, bilingual store theme for sportswear and casual wear.",
    description:
      "A minimal, editorial storefront for a men's and women's apparel brand: a promo hero slider, an announcement marquee, shop-by-category grids, and an Arabic/English interface with full RTL support.",
    tags: ["Theme Development", "Responsive UI", "RTL", "Bilingual", "E-commerce"],
    liveUrl: "https://mish-mavin.qumra.store/",
    sourceUrl: "#", // placeholder: your repo link
  },
];

// The tools I work with and contribute to. `stars` shows real GitHub counts.
export type Skill = {
  slug: "impeccable" | "taste-skill" | "vercel" | "magic-mcp" | "playwright";
  title: string;
  category: string;
  year: string;
  language: string;
  stars: string;
  summary: string;
  description: string;
  tags: readonly string[];
  repoUrl: string;
  liveUrl?: string;
};

export const skills: readonly Skill[] = [
  {
    slug: "impeccable",
    title: "Impeccable",
    category: "Design Systems",
    year: "2025",
    language: "JavaScript",
    stars: "78.8k",
    summary: "The design language that makes your AI harness better at design.",
    description:
      "A shared design language that plugs into AI coding tools and lifts the quality of everything they generate: typography, spacing, and motion rules expressed as a portable spec any harness can consume.",
    tags: ["Design Tokens", "AI Tooling", "Open Source", "Documentation"],
    repoUrl: "https://github.com/pbakaus/impeccable",
    liveUrl: "https://impeccable.style",
  },
  {
    slug: "taste-skill",
    title: "Taste Skill",
    category: "AI Tooling",
    year: "2026",
    language: "JavaScript",
    stars: "93.9k",
    summary: "Gives your AI good taste, so it stops generating generic slop.",
    description:
      "An agent skill that installs front-end taste into AI assistants: opinionated rules for layout, colour, and motion that push generated interfaces away from bland defaults and toward considered, designed work.",
    tags: ["Skill", "AI", "Front-End", "Open Source"],
    repoUrl: "https://github.com/Leonxlnx/taste-skill",
    liveUrl: "https://tasteskill.dev",
  },
  {
    slug: "vercel",
    title: "Vercel",
    category: "Deploy & Preview",
    year: "2016",
    language: "TypeScript",
    stars: "16.3k",
    summary: "Develop. Preview. Ship.",
    description:
      "The platform behind the deploy workflow my work ships on: instant preview URLs per branch, edge delivery, and a CLI that turns a git push into a live production deployment.",
    tags: ["TypeScript", "CLI", "Deployment", "Edge"],
    repoUrl: "https://github.com/vercel/vercel",
    liveUrl: "https://vercel.com",
  },
  {
    slug: "magic-mcp",
    title: "Magic MCP",
    category: "Developer Tooling",
    year: "2025",
    language: "TypeScript",
    stars: "5.9k",
    summary: "Like v0, but inside your editor.",
    description:
      "An MCP server that brings a 10,000+ React and Tailwind component library into Cursor, Claude Code, and Windsurf: search components, generate new UI with AI, and publish your own without leaving the editor.",
    tags: ["MCP", "React", "Tailwind CSS", "TypeScript"],
    repoUrl: "https://github.com/21st-dev/magic-mcp",
    liveUrl: "https://21st.dev/mcp",
  },
  {
    slug: "playwright",
    title: "Playwright",
    category: "Testing & Automation",
    year: "2019",
    language: "TypeScript",
    stars: "97.3k",
    summary: "A framework for web testing and automation.",
    description:
      "Cross-browser testing done right: one API drives Chromium, Firefox, and WebKit, with auto-waiting, network interception, and traces that make flaky failures reproducible.",
    tags: ["TypeScript", "E2E Testing", "Automation", "Open Source"],
    repoUrl: "https://github.com/microsoft/playwright",
    liveUrl: "https://playwright.dev",
  },
];
