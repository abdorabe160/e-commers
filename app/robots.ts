import type { MetadataRoute } from "next";

import { profile } from "@/lib/portfolio-data";

export default function robots(): MetadataRoute.Robots {
  return {
    // The old store demo routes stay crawlable so bots can read their noindex tag.
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${profile.siteUrl}/sitemap.xml`,
    host: profile.siteUrl,
  };
}
