import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { profile } from "@/lib/portfolio-data";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteTitle = `${profile.name} | ${profile.role} in ${profile.location} – Next.js & E-commerce Themes`;
const siteDescription = `${profile.name} (${profile.fullName} · ${profile.fullNameAr}) is a freelance ${profile.role.toLowerCase()} in ${profile.location} with ${profile.yearsOfExperience} years of experience building fast web apps, Arabic RTL e-commerce storefronts and store themes with Next.js, React, Tailwind CSS, GSAP and Three.js. ${profile.roleAr} في ${profile.locationAr}: تصميم وبرمجة متاجر إلكترونية وثيمات متاجر.`;

export const metadata: Metadata = {
  metadataBase: new URL(profile.siteUrl),
  title: {
    default: siteTitle,
    template: `%s | ${profile.name}`,
  },
  description: siteDescription,
  applicationName: profile.name,
  keywords: [
    ...profile.alternateNames,
    profile.roleAr,
    `${profile.name} portfolio`,
    // Role + location
    "front-end developer",
    "front-end developer Egypt",
    "freelance front-end developer",
    "frontend developer portfolio",
    "Next.js developer",
    "Next.js developer Egypt",
    "hire Next.js developer",
    "React developer",
    "React developer Egypt",
    "مطور فرونت اند",
    "مطور فرونت اند مصر",
    "مبرمج React",
    "مطور Next.js",
    "مبرمج مواقع فريلانس",
    // Services
    "e-commerce theme developer",
    "Next.js e-commerce storefront developer",
    "RTL e-commerce theme",
    "Qumra theme developer",
    "landing page developer",
    "تصميم متجر إلكتروني",
    "برمجة متجر إلكتروني",
    "تصميم ثيم متجر",
    "مطور ثيمات متاجر",
    "مطور ثيمات قمرة",
    "متجر عربي RTL",
    "تصميم واجهات مواقع",
    "مطور مواقع بأنيميشن",
    // Stack
    "Tailwind CSS",
    "GSAP",
    "Three.js",
    "GSAP Three.js animated website developer",
    "liquid glass UI",
  ],
  authors: [{ name: profile.name, url: profile.siteUrl }],
  creator: profile.name,
  alternates: { canonical: "/" },
  verification: { google: "YSs5cMXoIAn6VwkhH4-hoMoV5LsK3fuvkOXgbS-6jvg" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "profile",
    url: "/",
    siteName: profile.name,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn(
        "dark h-full antialiased",
        dmSans.variable,
        spaceGrotesk.variable,
        geistMono.variable
      )}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
