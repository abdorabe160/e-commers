import type { MetadataRoute } from "next";

import { profile } from "@/lib/portfolio-data";

// One-page portfolio: the home page is the only URL worth indexing.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: profile.siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
      images: [`${profile.siteUrl}/opengraph-image`],
    },
  ];
}
