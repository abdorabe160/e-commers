import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";

const description =
  "دولاب متجر ملابس أونلاين بغرفة بروفة ثلاثية الأبعاد: اختار التيشيرت أو الجاكيت أو الجزمة، وشوف الموديل بيلبسها قدامك قبل ما تضيفها للسلة.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`),
  title: {
    default: "دولاب | جرّب هدومك قبل ما تشتري",
    template: "%s | دولاب",
  },
  description,
  applicationName: "دولاب",
  keywords: [
    "متجر ملابس",
    "ملابس أونلاين",
    "غرفة بروفة افتراضية",
    "تجربة الملابس 3D",
    "تيشيرتات",
    "جواكت",
    "جينز",
    "كوتشيات",
    "إكسسوارات",
    "مصر",
  ],
  category: "shopping",
  alternates: { canonical: "/" },
  openGraph: {
    title: "دولاب | جرّب هدومك قبل ما تشتري",
    description,
    type: "website",
    siteName: "دولاب",
    locale: "ar_EG",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "دولاب | جرّب هدومك قبل ما تشتري",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#171513" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
