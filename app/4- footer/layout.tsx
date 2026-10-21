import type { Metadata } from "next";

// Leftover store demo pages: keep them out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
